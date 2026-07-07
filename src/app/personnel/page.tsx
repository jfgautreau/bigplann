import { getServerClient } from "@/lib/supabase-server";
import AppHeader from "@/components/AppHeader";
import PageTitle from "@/components/PageTitle";
import { requireModule, canWrite } from "@/lib/permissions";
import PersonnelEditor from "./PersonnelEditor";

type Equipe = { id: string; nom: string; couleur: string | null };
type Atelier = { id: string; nom: string };
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
  contrat_debut: string | null; // debut du contrat le plus ancien (alerte 18 mois)
  pointure: string | null;
  statut: string;
  temps_partiel: boolean;
  tp_type: string | null;
  tp_config: TpConfig | null;
};
type HMap = Record<string, { debut: string; fin: string }>;
type TpConfig = { demi?: { mode: string; source: string; matin?: HMap; aprem?: HMap }; off?: Record<string, string[]>; horaires?: HMap };

export default async function PersonnelPage() {
  const { profile, perms } = await requireModule("personnel", "read");
  const canEdit = canWrite(perms, "personnel");

  const supabase = await getServerClient();
  // Tout en parallele (une seule vague). Les colonnes etendues (atelier_id, sexe,
  // badge, livret, temps partiel) sont desormais toujours presentes (0020-0025).
  const [{ data: equipesData }, { data: ateliersData }, { data: rowsData }, { data: cpData }] = await Promise.all([
    supabase.from("equipe").select("id, nom, couleur").order("nom").returns<Equipe[]>(),
    supabase.from("atelier").select("id, nom").eq("actif", true).order("nom").returns<Atelier[]>(),
    supabase
      .from("personne")
      .select("id, matricule, nom, prenom, equipe_id, atelier_id, sexe, numero_badge, date_livret_accueil, type_contrat, date_debut, date_fin, pointure, statut, temps_partiel, tp_type, tp_config")
      .order("nom")
      .returns<Omit<Row, "contrat_debut">[]>(),
    supabase.from("contrat_periode").select("personne_id, date_debut").returns<{ personne_id: string; date_debut: string | null }[]>(),
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
      <AppHeader role={profile.role} active="/personnel" />
      <div className="container" style={{ maxWidth: 1500 }}>
        <PageTitle module="personnel">Personnel</PageTitle>
        <PersonnelEditor initial={rows} equipes={equipesData ?? []} ateliers={ateliersData ?? []} canEdit={canEdit} />
      </div>
    </>
  );
}
