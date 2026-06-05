import { getServerClient } from "@/lib/supabase-server";
import AppHeader from "@/components/AppHeader";
import { requireModule, canWrite } from "@/lib/permissions";
import PersonnelEditor from "./PersonnelEditor";

type Equipe = { id: string; nom: string };
type Row = {
  id: string;
  matricule: string | null;
  nom: string;
  prenom: string;
  equipe_id: string | null;
  type_contrat: string;
  pointure: string | null;
  statut: string;
};

export default async function PersonnelPage() {
  const { profile, perms } = await requireModule("personnel", "read");
  const canEdit = canWrite(perms, "personnel");

  const supabase = await getServerClient();
  const [{ data: equipesData }, { data: rowsData }] = await Promise.all([
    supabase.from("equipe").select("id, nom").order("nom").returns<Equipe[]>(),
    supabase
      .from("personne")
      .select("id, matricule, nom, prenom, equipe_id, type_contrat, pointure, statut")
      .order("nom")
      .returns<Row[]>(),
  ]);

  return (
    <>
      <AppHeader role={profile.role} active="/personnel" />
      <div className="container" style={{ maxWidth: 1500 }}>
        <h1>Personnel</h1>
        <PersonnelEditor initial={rowsData ?? []} equipes={equipesData ?? []} canEdit={canEdit} />
      </div>
    </>
  );
}
