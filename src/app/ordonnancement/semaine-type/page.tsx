import Link from "next/link";
import { getServerClient } from "@/lib/supabase-server";
import AppHeader from "@/components/AppHeader";
import { requireModule } from "@/lib/permissions";
import { getSemaineType, getSemaineOuverture } from "@/lib/semaine-type";
import SemaineTypeEditor from "./SemaineTypeEditor";

type Quart = { code: string; libelle: string };
type Ligne = { id: string; nom: string; atelier: { nom: string } | null };

export default async function SemaineTypePage() {
  const { profile } = await requireModule("ordonnancement", "write");

  const supabase = await getServerClient();
  const [{ data: quartsD }, { data: lignesD }, type, ouverture] = await Promise.all([
    supabase.from("quart").select("code, libelle").order("ordre").returns<Quart[]>(),
    supabase
      .from("ligne")
      .select("id, nom, atelier:atelier_id(nom)")
      .eq("actif", true)
      .order("nom")
      .returns<Ligne[]>(),
    getSemaineType(supabase),
    getSemaineOuverture(supabase),
  ]);

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
          quarts={quartsD ?? []}
          lignes={(lignesD ?? []).map((l) => ({
            id: l.id,
            label: l.atelier?.nom ? `${l.atelier.nom} / ${l.nom}` : l.nom,
          }))}
          initial={type}
          initialOuverture={ouverture}
        />
      </div>
    </>
  );
}
