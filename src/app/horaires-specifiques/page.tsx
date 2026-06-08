import Link from "next/link";
import { getServerClient } from "@/lib/supabase-server";
import AppHeader from "@/components/AppHeader";
import { requireModule } from "@/lib/permissions";
import HoraireExceptionsEditor from "./HoraireExceptionsEditor";

type Personne = { id: string; nom: string; prenom: string };
type ExcRow = {
  personne_id: string;
  jour: string;
  debut: string | null;
  fin: string | null;
  motif: string | null;
  personne: { nom: string; prenom: string } | null;
};

export default async function HorairesSpecifiquesPage() {
  const { profile } = await requireModule("planning", "read");

  const supabase = await getServerClient();
  const [{ data: persData }, { data: excData }] = await Promise.all([
    supabase
      .from("personne")
      .select("id, nom, prenom")
      .eq("statut", "ACTIF")
      .order("nom")
      .returns<Personne[]>(),
    supabase
      .from("horaire_exception")
      .select("personne_id, jour, debut, fin, motif, personne:personne_id(nom, prenom)")
      .order("jour", { ascending: false })
      .returns<ExcRow[]>(),
  ]);

  const personnes = persData ?? [];
  const exceptions = (excData ?? []).map((e) => ({
    personne_id: e.personne_id,
    jour: e.jour,
    debut: e.debut ?? "",
    fin: e.fin ?? "",
    motif: e.motif ?? "",
    label: e.personne ? `${e.personne.nom} ${e.personne.prenom}` : "?",
  }));

  return (
    <>
      <AppHeader role={profile.role} active="/planning" />
      <div className="container" style={{ maxWidth: 1000 }}>
        <div className="toolbar" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ margin: 0 }}>Horaires spécifiques</h1>
          <Link href="/planning" className="navlink">&larr; Planning</Link>
        </div>
        <p className="muted" style={{ marginBottom: 16 }}>
          Horaire ponctuel d&apos;une personne pour une date donnée. Il <strong>surcharge</strong>
          {" "}l&apos;horaire standard du poste pour ce jour (planning et écrans TV). Laisser
          début et fin vides supprime l&apos;exception. Le motif est optionnel.
        </p>
        <HoraireExceptionsEditor personnes={personnes} initial={exceptions} />
      </div>
    </>
  );
}
