import { getServerClient } from "@/lib/supabase-server";
import AppHeader from "@/components/AppHeader";
import { fetchAll } from "@/lib/fetch-all";
import { requireModule, canWrite, canRead } from "@/lib/permissions";
import { getAteliersC, getEquipesC } from "@/lib/refdata";
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

export default async function HabilitationsPage({
  searchParams,
}: {
  searchParams: Promise<{ atelier?: string; equipe?: string }>;
}) {
  const { profile, perms } = await requireModule("habilitations", "read");
  const sp = await searchParams;
  const canEdit = canWrite(perms, "habilitations");

  const supabase = await getServerClient();
  // Personnes filtrees par atelier / equipe, comme la Matrice de polyvalence.
  let persQ = supabase.from("personne").select("id, nom, prenom, type_contrat").eq("statut", "ACTIF").order("nom");
  if (sp.equipe) persQ = persQ.eq("equipe_id", sp.equipe);
  if (sp.atelier) persQ = persQ.eq("atelier_id", sp.atelier);

  const [{ data: compsD }, { data: persD }, pcD, ateliers, equipes] = await Promise.all([
    supabase
      .from("competence")
      .select("id, nom, duree_validite_mois, categorie, groupe, ordre, a_autorisation_conduite")
      .eq("a_recycler", true)
      .eq("actif", true)
      .order("ordre")
      .order("nom")
      .returns<Comp[]>(),
    persQ.returns<Personne[]>(),
    fetchAll<Row>(() =>
      supabase
        .from("personne_competence")
        .select("id, personne_id, competence_id, date_obtention, date_expiration, date_autorisation_conduite, personne:personne_id(nom, prenom), competence:competence_id(nom, a_recycler, a_autorisation_conduite)")
        .order("id")
        .returns<Row[]>()
    ),
    getAteliersC(),
    getEquipesC(),
  ]);

  const comps = compsD ?? [];
  const personnes = persD ?? [];
  // La vue « Liste » doit suivre le meme perimetre que la grille, sinon elle
  // afficherait des personnes que le filtre vient d'ecarter.
  const visibles = new Set(personnes.map((p) => p.id));
  const rows = pcD
    .filter((r) => r.competence?.a_recycler && visibles.has(r.personne_id))
    .sort((a, b) => (a.date_expiration ?? "9999").localeCompare(b.date_expiration ?? "9999"));

  return (
    <>
      <div className="pagecol">
        <AppHeader role={profile.role} active="/habilitations" />
        {/* L'en-tete (titre, recherche, filtres) est rendu par HabilitationsList :
            la recherche est un etat client, elle doit vivre dans le meme composant.
            La saisie s'ouvre au clic sur une pastille de la grille. */}
        <HabilitationsList
          rows={rows}
          personnes={personnes}
          comps={comps}
          canEdit={canEdit}
          ateliers={ateliers.map((a) => ({ id: a.id, label: a.nom }))}
          equipes={equipes.map((e) => ({ id: e.id, label: e.nom }))}
          atelier={sp.atelier ?? ""}
          equipe={sp.equipe ?? ""}
          lienParam={canRead(perms, "habilitations_param")}
        />
      </div>
    </>
  );
}
