import { getServerClient } from "@/lib/supabase-server";
import AppHeader from "@/components/AppHeader";
import { requireModule, canWrite } from "@/lib/permissions";
import PersonnelEditor from "./PersonnelEditor";

type Equipe = { id: string; nom: string };
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
};

export default async function PersonnelPage() {
  const { profile, perms } = await requireModule("personnel", "read");
  const canEdit = canWrite(perms, "personnel");

  const supabase = await getServerClient();
  const [{ data: equipesData }, { data: ateliersData }, { data: rowsData }] = await Promise.all([
    supabase.from("equipe").select("id, nom").order("nom").returns<Equipe[]>(),
    supabase.from("atelier").select("id, nom").eq("actif", true).order("nom").returns<Atelier[]>(),
    supabase
      .from("personne")
      .select("id, matricule, nom, prenom, equipe_id, type_contrat, date_debut, date_fin, pointure, statut")
      .order("nom")
      .returns<Omit<Row, "atelier_id" | "sexe" | "numero_badge" | "date_livret_accueil" | "contrat_debut">[]>(),
  ]);

  // Affectation atelier : best-effort (colonne ajoutee en 0020). Si la migration
  // n'est pas encore appliquee, la requete renvoie une erreur -> map vide, pas de plantage.
  const persAtelier = new Map<string, string | null>();
  const { data: paData, error: paErr } = await supabase
    .from("personne")
    .select("id, atelier_id")
    .returns<{ id: string; atelier_id: string | null }[]>();
  if (!paErr) for (const r of paData ?? []) persAtelier.set(r.id, r.atelier_id);

  // Sexe : best-effort (colonne ajoutee en 0022). Requete separee pour ne pas
  // casser le reste si la migration n'est pas encore appliquee.
  const persSexe = new Map<string, string | null>();
  const { data: sxData, error: sxErr } = await supabase
    .from("personne")
    .select("id, sexe")
    .returns<{ id: string; sexe: string | null }[]>();
  if (!sxErr) for (const r of sxData ?? []) persSexe.set(r.id, r.sexe);

  // Badge + livret d'accueil : best-effort (colonnes ajoutees en 0024).
  const persBadge = new Map<string, { numero_badge: string | null; date_livret_accueil: string | null }>();
  const { data: bData, error: bErr } = await supabase
    .from("personne")
    .select("id, numero_badge, date_livret_accueil")
    .returns<{ id: string; numero_badge: string | null; date_livret_accueil: string | null }[]>();
  if (!bErr) for (const r of bData ?? []) persBadge.set(r.id, { numero_badge: r.numero_badge, date_livret_accueil: r.date_livret_accueil });

  // Debut du contrat le plus ancien par personne (pour l'alerte > 18 mois).
  const minDebut = new Map<string, string>();
  const { data: cpData } = await supabase.from("contrat_periode").select("personne_id, date_debut").returns<{ personne_id: string; date_debut: string | null }[]>();
  for (const r of cpData ?? []) {
    if (!r.date_debut) continue;
    const cur = minDebut.get(r.personne_id);
    if (!cur || r.date_debut < cur) minDebut.set(r.personne_id, r.date_debut);
  }

  const rows: Row[] = (rowsData ?? []).map((r) => ({
    ...r,
    atelier_id: persAtelier.get(r.id) ?? null,
    sexe: persSexe.get(r.id) ?? null,
    numero_badge: persBadge.get(r.id)?.numero_badge ?? null,
    date_livret_accueil: persBadge.get(r.id)?.date_livret_accueil ?? null,
    contrat_debut: minDebut.get(r.id) ?? r.date_debut ?? null,
  }));

  return (
    <>
      <AppHeader role={profile.role} active="/personnel" />
      <div className="container" style={{ maxWidth: 1500 }}>
        <h1>Personnel</h1>
        <PersonnelEditor initial={rows} equipes={equipesData ?? []} ateliers={ateliersData ?? []} canEdit={canEdit} />
      </div>
    </>
  );
}
