import AppHeader from "@/components/AppHeader";
import { getServerClient } from "@/lib/supabase-server";
import { requireModule } from "@/lib/permissions";
import ReferentielEditor from "./ReferentielEditor";

type Poste = {
  id: string;
  nom: string;
  nom_court: string | null;
  est_conducteur: boolean;
  effectif_requis: number;
  difficulte_formation: number | null;
  niveau_min_requis: number;
  actif: boolean;
};
type Ligne = { id: string; nom: string; actif: boolean; poste: Poste[] };
type Atelier = { id: string; nom: string; actif: boolean; ligne: Ligne[] };

export default async function ReferentielPage() {
  const { profile } = await requireModule("referentiel", "write");

  const supabase = await getServerClient();
  const { data } = await supabase
    .from("atelier")
    .select(
      "id, nom, actif, ligne(id, nom, actif, poste(id, nom, nom_court, est_conducteur, effectif_requis, difficulte_formation, niveau_min_requis, actif))"
    )
    .order("nom")
    .returns<Atelier[]>();

  const ateliers = (data ?? []).map((a) => ({
    ...a,
    ligne: [...(a.ligne ?? [])]
      .sort((x, y) => x.nom.localeCompare(y.nom))
      .map((l) => ({
        ...l,
        poste: [...(l.poste ?? [])].sort((x, y) => x.nom.localeCompare(y.nom)),
      })),
  }));

  return (
    <>
      <AppHeader role={profile.role} active="/admin/referentiel" />
      <div className="container">
        <h1>Référentiel : ateliers, lignes, postes</h1>
        <p className="muted" style={{ marginBottom: 16 }}>
          Saisie directe : modifiez un champ, il s&apos;enregistre tout seul (aucun bouton
          à valider). Cochez « Actif » pour activer/désactiver. Pour créer, tapez un nom
          et appuyez sur Entrée. L&apos;effectif requis par poste constitue l&apos;abaque
          (ex. 1 conducteur + 3 opérateurs).
        </p>

        <ReferentielEditor initial={ateliers} />
      </div>
    </>
  );
}
