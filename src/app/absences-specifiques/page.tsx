import Link from "next/link";
import { getServerClient } from "@/lib/supabase-server";
import AppHeader from "@/components/AppHeader";
import { requireModule } from "@/lib/permissions";
import AbsencesEditor from "./AbsencesEditor";

type Personne = { id: string; nom: string; prenom: string; atelier_id: string | null };
type Motif = { id: string; code_court: string; libelle: string; couleur: string };
type Atelier = { id: string; nom: string };
type AbsRow = {
  id: string;
  personne_id: string;
  motif_absence_id: string | null;
  date_debut: string;
  date_fin: string;
  commentaire: string | null;
  personne: { nom: string; prenom: string } | null;
};

export default async function AbsencesSpecifiquesPage() {
  const { profile } = await requireModule("planning", "read");

  const supabase = await getServerClient();
  const [{ data: persData }, { data: motifData }, { data: absData }, { data: ateliersData }] = await Promise.all([
    supabase.from("personne").select("id, nom, prenom, atelier_id").eq("statut", "ACTIF").order("nom").returns<Personne[]>(),
    supabase.from("motif_absence").select("id, code_court, libelle, couleur").eq("actif", true).order("libelle").returns<Motif[]>(),
    supabase
      .from("absence")
      .select("id, personne_id, motif_absence_id, date_debut, date_fin, commentaire, personne:personne_id(nom, prenom)")
      .order("date_debut", { ascending: false })
      .returns<AbsRow[]>(),
    supabase.from("atelier").select("id, nom").eq("actif", true).order("nom").returns<Atelier[]>(),
  ]);

  const personnes = persData ?? [];
  const motifs = motifData ?? [];
  const ateliers = ateliersData ?? [];
  const absences = (absData ?? []).map((a) => ({
    id: a.id,
    personne_id: a.personne_id,
    motif_absence_id: a.motif_absence_id ?? "",
    date_debut: a.date_debut,
    date_fin: a.date_fin,
    commentaire: a.commentaire ?? "",
    label: a.personne ? `${a.personne.nom} ${a.personne.prenom}` : "?",
  }));

  return (
    <>
      <AppHeader role={profile.role} active="/planning" />
      <div className="container" style={{ maxWidth: 1500 }}>
        <div className="toolbar" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ margin: 0 }}>Absences spécifiques</h1>
          <Link href="/planning" className="navlink">&larr; Planning</Link>
        </div>
        <p className="muted" style={{ marginBottom: 16 }}>
          Absence longue d&apos;une personne (arrêt maladie, congés…) sur une plage de dates avec un
          motif. Le motif est posé automatiquement <strong>sur chaque jour</strong>{" "}
          de la plage dans le planning, en face de la personne. Supprimer l&apos;absence
          retire le motif de ces jours.
        </p>
        <AbsencesEditor personnes={personnes} motifs={motifs} ateliers={ateliers} initial={absences} />
      </div>
    </>
  );
}
