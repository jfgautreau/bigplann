import AppHeader from "@/components/AppHeader";
import { getServerClient } from "@/lib/supabase-server";
import { requireModule } from "@/lib/permissions";
import ReferentielEditor from "./ReferentielEditor";

type Poste = {
  id: string;
  nom: string;
  nom_court: string | null;
  est_conducteur: boolean;
  categorie: string;
  effectif_requis: number;
  difficulte_formation: number | null;
  niveau_min_requis: number;
  actif: boolean;
};
type Ligne = { id: string; nom: string; actif: boolean; poste: Poste[] };
type Atelier = { id: string; nom: string; actif: boolean; ligne: Ligne[] };
type Quart = { code: string; libelle: string };

export default async function ReferentielPage() {
  const { profile } = await requireModule("referentiel", "write");

  const supabase = await getServerClient();
  const [{ data }, { data: quartsD }, { data: pqD }] = await Promise.all([
    supabase
      .from("atelier")
      .select(
        "id, nom, actif, ligne(id, nom, actif, poste(id, nom, nom_court, est_conducteur, categorie, effectif_requis, difficulte_formation, niveau_min_requis, actif))"
      )
      .order("nom")
      .returns<Atelier[]>(),
    supabase.from("quart").select("code, libelle").order("ordre").returns<Quart[]>(),
    supabase
      .from("poste_quart")
      .select("poste_id, quart_code")
      .eq("actif", false)
      .returns<{ poste_id: string; quart_code: string }[]>(),
  ]);

  const ateliers = (data ?? []).map((a) => ({
    ...a,
    ligne: [...(a.ligne ?? [])]
      .sort((x, y) => x.nom.localeCompare(y.nom))
      .map((l) => ({
        ...l,
        poste: [...(l.poste ?? [])].sort((x, y) => x.nom.localeCompare(y.nom)),
      })),
  }));
  const pqOff = (pqD ?? []).map((r) => `${r.poste_id}:${r.quart_code}`);

  return (
    <>
      <AppHeader role={profile.role} active="/admin/referentiel" />
      <div className="container">
        <h1>Référentiel : ateliers, lignes, postes</h1>
        <p className="muted" style={{ marginBottom: 16 }}>
          Saisie directe : modifiez un champ, il s&apos;enregistre tout seul (aucun bouton
          à valider). Cochez « Actif » pour activer/désactiver. La <strong>catégorie</strong>
          (Manager / Conducteur / Opérateur) sert aux bilans. Les colonnes de quart cochent
          sur quels quarts le poste tourne (tout coché par défaut).
        </p>

        <ReferentielEditor initial={ateliers} quarts={quartsD ?? []} pqOff={pqOff} />
      </div>
    </>
  );
}
