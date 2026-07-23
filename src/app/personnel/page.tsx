import { getServerClient } from "@/lib/supabase-server";
import AppHeader from "@/components/AppHeader";
import { requireModule, canWrite } from "@/lib/permissions";
import PersonnelEditor from "./PersonnelEditor";
import { getRotationRefsC } from "@/lib/refdata";

type Equipe = { id: string; nom: string; couleur: string | null; quart_fixe: string | null };
type Quart = { code: string; libelle: string };
type Atelier = { id: string; nom: string };
type Motif = { id: string; code_court: string; libelle: string; couleur: string };
type Row = {
  id: string;
  matricule: string | null;
  nom: string;
  prenom: string;
  equipe_id: string | null;
  atelier_id: string | null;
  sexe: string | null;
  numero_badge: string | null;
  date_livret_accueil: string | null;
  type_contrat: string;
  date_debut: string | null;
  date_fin: string | null;
  date_depart_prevu: string | null;
  motif_depart: string | null;
  contrat_debut: string | null; // debut du contrat le plus ancien (alerte 18 mois)
  pointure: string | null;
  commentaire: string | null;
  statut: string;
  temps_partiel: boolean;
  tp_type: string | null;
  tp_config: TpConfig | null;
};
type HMap = Record<string, { debut: string; fin: string }>;
type TpConfig = { demi?: { mode: string; source: string; matin?: HMap; aprem?: HMap }; off?: Record<string, string[]>; horaires?: HMap };

const COLS_PERSONNE =
  "id, matricule, nom, prenom, equipe_id, atelier_id, sexe, numero_badge, date_livret_accueil, " +
  "type_contrat, date_debut, date_fin, pointure, commentaire, statut, temps_partiel, tp_type, tp_config, " +
  // Départ prévu (migration 0039) : distinct de `date_fin`, qui est le reflet
  // automatique de la période de contrat la plus récente.
  "date_depart_prevu, motif_depart";

export default async function PersonnelPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const sp = await searchParams;
  const { profile, perms } = await requireModule("personnel", "read");
  const canEdit = canWrite(perms, "personnel");

  const supabase = await getServerClient();
  // Tout en parallele (une seule vague). Les colonnes etendues (atelier_id, sexe,
  // badge, livret, temps partiel) sont desormais toujours presentes (0020-0025).
  // `quart_fixe` + rotation + quarts : servent l'apercu de quinzaine de la modale
  // temps partiel (l'alternance « une semaine sur deux » vient de la rotation de
  // l'equipe, pas du temps partiel lui-meme).
  const [{ data: equipesData }, { data: ateliersData }, { data: rowsData }, { data: cpData }, { data: quartsData }, rotationRefs, { data: motifsData }] =
    await Promise.all([
      supabase.from("equipe").select("id, nom, couleur, quart_fixe").order("nom").returns<Equipe[]>(),
      supabase.from("atelier").select("id, nom").eq("actif", true).order("nom").returns<Atelier[]>(),
      supabase.from("personne").select(COLS_PERSONNE).order("nom").returns<Omit<Row, "contrat_debut">[]>(),
      supabase.from("contrat_periode").select("personne_id, date_debut").returns<{ personne_id: string; date_debut: string | null }[]>(),
      supabase.from("quart").select("code, libelle").order("ordre").returns<Quart[]>(),
      getRotationRefsC(),
      // Motifs d absence : alimentent la declaration depuis la modale Absences.
      supabase.from("motif_absence").select("id, code_court, libelle, couleur").eq("actif", true).order("libelle").returns<Motif[]>(),
    ]);

  // Debut du contrat le plus ancien par personne (pour l'alerte > 18 mois).
  const minDebut = new Map<string, string>();
  for (const r of cpData ?? []) {
    if (!r.date_debut) continue;
    const cur = minDebut.get(r.personne_id);
    if (!cur || r.date_debut < cur) minDebut.set(r.personne_id, r.date_debut);
  }

  const rows: Row[] = (rowsData ?? []).map((r) => ({
    ...r,
    contrat_debut: minDebut.get(r.id) ?? r.date_debut ?? null,
  }));

  return (
    <>
      <div className="pagecol">
        <AppHeader role={profile.role} active="/personnel" />
        <PersonnelEditor
          initial={rows}
          equipes={equipesData ?? []}
          ateliers={ateliersData ?? []}
          canEdit={canEdit}
          erreur={sp.err}
          quarts={quartsData ?? []}
          rotationRefs={rotationRefs}
          motifs={motifsData ?? []}
        />
      </div>
    </>
  );
}
