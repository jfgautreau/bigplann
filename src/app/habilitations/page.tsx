import Link from "next/link";
import { getServerClient } from "@/lib/supabase-server";
import AppHeader from "@/components/AppHeader";
import { fetchAll } from "@/lib/fetch-all";
import PageTitle from "@/components/PageTitle";
import { requireModule, canWrite } from "@/lib/permissions";
import HabilitationsList from "./HabilitationsList";

type Comp = { id: string; nom: string; duree_validite_mois: number | null; categorie: string | null; groupe: string | null; ordre: number; a_autorisation_conduite: boolean };
type Personne = { id: string; nom: string; prenom: string };
type Row = {
  id: string;
  personne_id: string;
  competence_id: string;
  date_obtention: string | null;
  date_expiration: string | null;
  date_autorisation_conduite: string | null;
  personne: { nom: string; prenom: string } | null;
  competence: { nom: string; a_recycler: boolean; a_autorisation_conduite: boolean } | null;
};

export default async function HabilitationsPage() {
  const { profile, perms } = await requireModule("habilitations", "read");
  const canEdit = canWrite(perms, "habilitations");

  const supabase = await getServerClient();
  const [{ data: compsD }, { data: persD }, pcD] = await Promise.all([
    supabase
      .from("competence")
      .select("id, nom, duree_validite_mois, categorie, groupe, ordre, a_autorisation_conduite")
      .eq("a_recycler", true)
      .eq("actif", true)
      .order("ordre")
      .order("nom")
      .returns<Comp[]>(),
    supabase.from("personne").select("id, nom, prenom").eq("statut", "ACTIF").order("nom").returns<Personne[]>(),
    fetchAll<Row>(() =>
      supabase
        .from("personne_competence")
        .select("id, personne_id, competence_id, date_obtention, date_expiration, date_autorisation_conduite, personne:personne_id(nom, prenom), competence:competence_id(nom, a_recycler, a_autorisation_conduite)")
        .order("id")
        .returns<Row[]>()
    ),
  ]);

  const comps = compsD ?? [];
  const personnes = persD ?? [];
  const rows = pcD
    .filter((r) => r.competence?.a_recycler)
    .sort((a, b) => (a.date_expiration ?? "9999").localeCompare(b.date_expiration ?? "9999"));

  return (
    <>
      <div className="pagecol">
      <AppHeader role={profile.role} active="/habilitations" />
        <div className="headband headband-top">
        <div className="toolbar" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <PageTitle module="habilitations">Habilitations</PageTitle>
          {profile.role === "admin" && (
            <Link href="/admin/habilitations-param" className="navlink" title="Définir les formations et leurs durées de validité">
              📜 Paramétrer les formations &rarr;
            </Link>
          )}
        </div>
        </div>
        {/* La saisie se fait au clic sur une pastille de la grille (modale pre-remplie). */}
        <HabilitationsList rows={rows} personnes={personnes} comps={comps} canEdit={canEdit} />
      </div>
    </>
  );
}
