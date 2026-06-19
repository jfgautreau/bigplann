import { getServerClient } from "@/lib/supabase-server";
import AppHeader from "@/components/AppHeader";
import { requireModule } from "@/lib/permissions";
import { saveHoraires } from "./actions";
import HoraireEditor from "./HoraireEditor";

type PosteRow = { id: string; nom: string; actif: boolean };
type LigneRow = { id: string; nom: string; atelier: { id: string; nom: string } | null; poste: PosteRow[] };
type Quart = { code: string; libelle: string };
type HoraireRow = { poste_id: string; quart_code: string; jour: number; debut: string | null; fin: string | null };

export default async function HorairesPage() {
  const { profile } = await requireModule("horaires", "write");

  const supabase = await getServerClient();
  const [{ data: lignesD }, { data: quartsD }] = await Promise.all([
    supabase
      .from("ligne")
      .select("id, nom, atelier:atelier_id(id, nom), poste(id, nom, actif)")
      .eq("actif", true)
      .order("nom")
      .returns<LigneRow[]>(),
    supabase.from("quart").select("code, libelle").order("ordre").returns<Quart[]>(),
  ]);

  const quarts = (quartsD ?? []).map((q) => ({ code: q.code, libelle: q.libelle }));

  // Lignes (avec leurs postes actifs), triees par atelier puis nom de ligne.
  const lignes = (lignesD ?? [])
    .map((l) => ({
      ligneId: l.id,
      ligneNom: l.nom,
      atelierId: l.atelier?.id ?? "",
      atelierNom: l.atelier?.nom ?? "(Sans atelier)",
      postes: [...(l.poste ?? [])].filter((p) => p.actif).sort((a, b) => a.nom.localeCompare(b.nom)).map((p) => ({ id: p.id, nom: p.nom })),
    }))
    .filter((l) => l.postes.length > 0)
    .sort((a, b) => a.atelierNom.localeCompare(b.atelierNom) || a.ligneNom.localeCompare(b.ligneNom));

  const ateliersMap = new Map<string, string>();
  for (const l of lignes) if (l.atelierId) ateliersMap.set(l.atelierId, l.atelierNom);
  const ateliers = [...ateliersMap].map(([id, nom]) => ({ id, nom })).sort((a, b) => a.nom.localeCompare(b.nom));

  const allPosteIds = lignes.flatMap((l) => l.postes.map((p) => p.id));

  const initial: Record<string, { debut: string; fin: string }> = {};
  if (allPosteIds.length) {
    const { data: h } = await supabase
      .from("horaire_poste")
      .select("poste_id, quart_code, jour, debut, fin")
      .in("poste_id", allPosteIds)
      .returns<HoraireRow[]>();
    for (const r of h ?? [])
      initial[`${r.poste_id}:${r.quart_code}:${r.jour}`] = { debut: r.debut ?? "", fin: r.fin ?? "" };
  }

  return (
    <>
      <AppHeader role={profile.role} active="/admin/horaires" />
      <div className="container" style={{ maxWidth: 1500 }}>
        <h1>Horaires des postes</h1>
        <p className="muted" style={{ marginBottom: 12 }}>
          Horaires propres à chaque poste, par quart et par jour de la semaine. Affichés à
          côté de chaque personne sur les écrans TV selon le quart où elle est placée.
          Filtrez par atelier, repliez les lignes, copiez/collez un poste vers un autre
          (même entre lignes), recopiez le lundi sur la semaine, ou videz un jour / un quart.
          N&apos;oubliez pas d&apos;enregistrer.
        </p>

        <form action={saveHoraires} autoComplete="off">
          <input type="hidden" name="poste_ids" value={allPosteIds.join(",")} />
          <input type="hidden" name="quart_codes" value={quarts.map((q) => q.code).join(",")} />
          <HoraireEditor ateliers={ateliers} lignes={lignes} quarts={quarts} initial={initial} />
          {lignes.length > 0 && (
            <div style={{ position: "sticky", bottom: 0, background: "var(--bg, #fff)", padding: "10px 0", marginTop: 8 }}>
              <button type="submit" style={{ width: "auto", padding: "9px 22px" }}>
                Enregistrer les horaires
              </button>
            </div>
          )}
        </form>
      </div>
    </>
  );
}
