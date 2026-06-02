import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import AppHeader from "@/components/AppHeader";
import { joursRestants, habStatut, HAB_COLOR } from "@/lib/habilitations";
import { saveHabilitation, deleteHabilitation } from "./actions";

type Comp = { id: string; nom: string; duree_validite_mois: number | null };
type Personne = { id: string; nom: string; prenom: string };
type Row = {
  id: string;
  date_obtention: string | null;
  date_expiration: string | null;
  personne: { nom: string; prenom: string } | null;
  competence: { nom: string; a_recycler: boolean } | null;
};

export default async function HabilitationsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  const canEdit = profile.role === "admin" || profile.role === "chef_equipe" || profile.role === "rh";

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
      .select("id, date_obtention, date_expiration, personne:personne_id(nom, prenom), competence:competence_id(nom, a_recycler)")
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
      <div className="container" style={{ maxWidth: 1100 }}>
        <h1>Habilitations a recycler</h1>

        <div className="card section">
          <table>
            <thead>
              <tr>
                <th>Personne</th>
                <th>Habilitation</th>
                <th>Obtention</th>
                <th>Expiration</th>
                <th>Echeance</th>
                {canEdit && <th></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const j = joursRestants(r.date_expiration);
                const st = habStatut(j);
                return (
                  <tr key={r.id}>
                    <td>{r.personne ? `${r.personne.nom} ${r.personne.prenom}` : "?"}</td>
                    <td>{r.competence?.nom ?? "?"}</td>
                    <td>{r.date_obtention ?? "-"}</td>
                    <td>{r.date_expiration ?? "-"}</td>
                    <td>
                      {st && (
                        <span
                          className="tag"
                          style={{ background: HAB_COLOR[st], color: "#fff" }}
                        >
                          {j !== null && j < 0 ? `expiree (${-j} j)` : `${j} j`}
                        </span>
                      )}
                    </td>
                    {canEdit && (
                      <td>
                        <form action={deleteHabilitation} style={{ margin: 0 }}>
                          <input type="hidden" name="id" value={r.id} />
                          <button type="submit" className="btn-sm btn-ghost">Supprimer</button>
                        </form>
                      </td>
                    )}
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 6 : 5} className="muted">
                    Aucune habilitation enregistree.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="muted" style={{ marginTop: 8 }}>
            <span style={{ color: HAB_COLOR.vert }}>●</span> &gt; 90 j ·{" "}
            <span style={{ color: HAB_COLOR.orange }}>●</span> 30-90 j ·{" "}
            <span style={{ color: HAB_COLOR.rouge }}>●</span> &lt; 30 j ou expiree
          </p>
        </div>

        {canEdit && (
          <div className="card">
            <h2>Enregistrer / mettre a jour une habilitation</h2>
            {comps.length === 0 ? (
              <p className="muted">
                Aucune habilitation definie. Cree-en dans Competences (case « a recycler »).
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
              L&apos;expiration est calculee automatiquement (obtention + duree de validite).
            </p>
          </div>
        )}
      </div>
    </>
  );
}
