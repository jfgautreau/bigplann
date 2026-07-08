import Link from "next/link";
import { getServerClient } from "@/lib/supabase-server";
import AppHeader from "@/components/AppHeader";
import { requireModule } from "@/lib/permissions";
import { getSemaineType, getSemaineOuverture, getProfils } from "@/lib/semaine-type";
import SemaineTypeEditor from "./SemaineTypeEditor";

type Quart = { code: string; libelle: string };
type Ligne = { id: string; nom: string; atelier: { nom: string } | null; poste: { id: string; actif: boolean }[] };

export default async function SemaineTypePage({ searchParams }: { searchParams: Promise<{ profil?: string }> }) {
  const { profile } = await requireModule("ordonnancement", "write");
  const sp = await searchParams;

  const supabase = await getServerClient();
  const profils = await getProfils(supabase);
  const selectedId =
    sp.profil && profils.some((p) => p.id === sp.profil)
      ? sp.profil
      : (profils.find((p) => p.par_defaut) ?? profils[0])?.id ?? null;

  const [{ data: quartsD }, { data: lignesD }, { data: pqOffD }, type, ouverture] = await Promise.all([
    supabase.from("quart").select("code, libelle").order("ordre").returns<Quart[]>(),
    supabase
      .from("ligne")
      .select("id, nom, atelier:atelier_id(nom), poste(id, actif)")
      .eq("actif", true)
      .order("nom")
      .returns<Ligne[]>(),
    supabase.from("poste_quart").select("poste_id, quart_code").eq("actif", false).returns<{ poste_id: string; quart_code: string }[]>(),
    selectedId ? getSemaineType(supabase, selectedId) : Promise.resolve({}),
    selectedId ? getSemaineOuverture(supabase, selectedId) : Promise.resolve({}),
  ]);

  const quarts = quartsD ?? [];
  // poste_quart ne stocke que les DESACTIVATIONS (defaut actif). Une ligne tourne
  // sur un quart si elle a au moins un poste actif, actif sur ce quart -> coherent
  // avec le referentiel. C'est ce qui filtre les lignes proposees par quart.
  const pqOff = new Set((pqOffD ?? []).map((r) => `${r.poste_id}:${r.quart_code}`));
  const lignes = (lignesD ?? []).map((l) => {
    const actifs = (l.poste ?? []).filter((p) => p.actif);
    const runsOn = quarts.filter((q) => actifs.some((p) => !pqOff.has(`${p.id}:${q.code}`))).map((q) => q.code);
    return {
      id: l.id,
      label: l.atelier?.nom ? `${l.atelier.nom} / ${l.nom}` : l.nom,
      quarts: runsOn,
    };
  });

  return (
    <>
      <AppHeader role={profile.role} active="/ordonnancement" />
      <div className="container" style={{ maxWidth: 900 }}>
        <div className="toolbar">
          <h1 style={{ margin: 0 }}>Semaine type</h1>
          <Link href="/ordonnancement" className="iconbtn" style={{ padding: "6px 12px" }}>&larr; Ordonnancement</Link>
        </div>
        <p className="muted" style={{ marginTop: -6 }}>
          Configuration du gabarit de quarts qui se charge automatiquement et sert de base à la
          réinitialisation des semaines.
        </p>
        <SemaineTypeEditor
          quarts={quarts}
          lignes={lignes}
          initial={type}
          initialOuverture={ouverture}
          profils={profils}
          profilId={selectedId}
        />
      </div>
    </>
  );
}
