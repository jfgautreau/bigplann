import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import AppHeader from "@/components/AppHeader";
import { fetchAll } from "@/lib/fetch-all";
import PageTitle from "@/components/PageTitle";
import { requireModule, canWrite } from "@/lib/permissions";
import { saveHabilitation } from "./actions";
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
      <AppHeader role={profile.role} active="/habilitations" />
      <div className="container" style={{ maxWidth: 1500 }}>
        <div className="toolbar" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <PageTitle module="habilitations">Habilitations</PageTitle>
          {profile.role === "admin" && (
            <Link href="/admin/habilitations-param" className="navlink" title="Param. Habilitation — définir les formations" style={{ fontSize: 22, textDecoration: "none", lineHeight: 1 }}>📜</Link>
          )}
        </div>
        <HabilitationsList rows={rows} personnes={personnes} comps={comps}>
          {canEdit && (
            <>
              {comps.length === 0 ? (
                <p className="muted">
                  Aucune habilitation définie. Crée-en dans Compétences (case « à recycler »).
                </p>
              ) : (
                <form action={saveHabilitation} autoComplete="off" className="inline-form">
                  <div className="field">
                    <span>Personne</span>
                    <select name="personne_id" required defaultValue="">
                      <option value="" disabled>Choisir...</option>
                      {personnes.map((p) => (
                        <option key={p.id} value={p.id}>{p.nom} {p.prenom}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <span>Habilitation</span>
                    <select name="competence_id" required defaultValue="">
                      <option value="" disabled>Choisir...</option>
                      {comps.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nom}{c.duree_validite_mois ? ` (${c.duree_validite_mois} mois)` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <span>Date de passage</span>
                    <input name="date_obtention" type="date" required />
                  </div>
                  <div className="field">
                    <span>Autorisation de conduite (si concerné)</span>
                    <input name="date_autorisation_conduite" type="date" />
                  </div>
                  <button type="submit" className="btn-sm">Enregistrer</button>
                </form>
              )}
              <p className="muted" style={{ marginTop: 6 }}>
                L&apos;expiration est calculée automatiquement (obtention + durée de validité).
              </p>
            </>
          )}
        </HabilitationsList>
      </div>
    </>
  );
}
