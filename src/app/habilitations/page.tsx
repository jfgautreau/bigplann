import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import AppHeader from "@/components/AppHeader";
import PageTitle from "@/components/PageTitle";
import { requireModule, canWrite } from "@/lib/permissions";
import { saveHabilitation } from "./actions";
import HabilitationsList from "./HabilitationsList";

type Comp = { id: string; nom: string; duree_validite_mois: number | null };
type Personne = { id: string; nom: string; prenom: string };
type Row = {
  id: string;
  personne_id: string;
  competence_id: string;
  date_obtention: string | null;
  date_expiration: string | null;
  personne: { nom: string; prenom: string } | null;
  competence: { nom: string; a_recycler: boolean } | null;
};

export default async function HabilitationsPage() {
  const { profile, perms } = await requireModule("habilitations", "read");
  const canEdit = canWrite(perms, "habilitations");

  const supabase = await getServerClient();
  const [{ data: compsD }, { data: persD }, { data: pcD }] = await Promise.all([
    supabase
      .from("competence")
      .select("id, nom, duree_validite_mois")
      .eq("a_recycler", true)
      .eq("actif", true)
      .order("nom")
      .returns<Comp[]>(),
    supabase.from("personne").select("id, nom, prenom").eq("statut", "ACTIF").order("nom").returns<Personne[]>(),
    supabase
      .from("personne_competence")
      .select("id, personne_id, competence_id, date_obtention, date_expiration, personne:personne_id(nom, prenom), competence:competence_id(nom, a_recycler)")
      .returns<Row[]>(),
  ]);

  const comps = compsD ?? [];
  const personnes = persD ?? [];
  const rows = (pcD ?? [])
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
        <p className="muted" style={{ marginBottom: 16 }}>
          Suivi des formations / habilitations à recycler. Saisissez l&apos;habilitation d&apos;une
          personne (personne + date d&apos;obtention, expiration calculée automatiquement) dans le
          formulaire ci-dessous. Les <em>types</em> d&apos;habilitation se définissent dans{" "}
          <strong>Compétences</strong> (case « à recycler »).
        </p>

        <HabilitationsList rows={rows} personnes={personnes} comps={comps.map((c) => ({ id: c.id, nom: c.nom }))}>
          {canEdit && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h2 style={{ marginTop: 0 }}>Mise à jour des habilitations</h2>
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
                    <span>Date d&apos;obtention</span>
                    <input name="date_obtention" type="date" required />
                  </div>
                  <button type="submit" className="btn-sm">Enregistrer</button>
                </form>
              )}
              <p className="muted" style={{ marginTop: 6 }}>
                L&apos;expiration est calculée automatiquement (obtention + durée de validité).
              </p>
            </div>
          )}
        </HabilitationsList>
      </div>
    </>
  );
}
