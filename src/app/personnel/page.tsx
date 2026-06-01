import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import AppHeader from "@/components/AppHeader";
import { createPersonne } from "./actions";

type Equipe = { id: string; nom: string };
type Row = {
  id: string;
  matricule: string | null;
  nom: string;
  prenom: string;
  type_contrat: string;
  statut: string;
  equipe: { nom: string } | null;
};

export default async function PersonnelPage({
  searchParams,
}: {
  searchParams: Promise<{ equipe?: string; statut?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const sp = await searchParams;
  const isAdmin = profile.role === "admin";

  const supabase = await getServerClient();
  const { data: equipesData } = await supabase
    .from("equipe")
    .select("id, nom")
    .order("nom")
    .returns<Equipe[]>();
  const equipes = equipesData ?? [];

  let query = supabase
    .from("personne")
    .select("id, matricule, nom, prenom, type_contrat, statut, equipe:equipe_id(nom)")
    .order("nom");
  if (sp.equipe) query = query.eq("equipe_id", sp.equipe);
  if (sp.statut) query = query.eq("statut", sp.statut);

  const { data: rowsData } = await query.returns<Row[]>();
  const rows = rowsData ?? [];

  return (
    <>
      <AppHeader role={profile.role} active="/personnel" />
      <div className="container">
        <h1>Personnel ({rows.length})</h1>

        {/* Filtres */}
        <form className="toolbar" method="get">
          <div className="field">
            <span>Equipe</span>
            <select name="equipe" defaultValue={sp.equipe ?? ""}>
              <option value="">Toutes</option>
              {equipes.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nom}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <span>Statut</span>
            <select name="statut" defaultValue={sp.statut ?? ""}>
              <option value="">Tous</option>
              <option value="ACTIF">Actif</option>
              <option value="PARTI">Parti</option>
            </select>
          </div>
          <button type="submit" className="btn-sm btn-ghost">
            Filtrer
          </button>
        </form>

        <div className="card" style={{ marginBottom: 24 }}>
          <table>
            <thead>
              <tr>
                <th>Matricule</th>
                <th>Nom</th>
                <th>Prenom</th>
                <th>Equipe</th>
                <th>Contrat</th>
                <th>Statut</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>{p.matricule ?? "-"}</td>
                  <td>{p.nom}</td>
                  <td>{p.prenom}</td>
                  <td>{p.equipe?.nom ?? "-"}</td>
                  <td>{p.type_contrat}</td>
                  <td>
                    <span className={p.statut === "ACTIF" ? "tag" : "tag tag-off"}>
                      {p.statut === "ACTIF" ? "Actif" : "Parti"}
                    </span>
                  </td>
                  {isAdmin && (
                    <td>
                      <Link href={`/personnel/${p.id}`}>Modifier</Link>
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="muted">
                    Aucune personne.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Creation (admin) */}
        {isAdmin && (
          <div className="card">
            <h2>Ajouter une personne</h2>
            <form action={createPersonne} autoComplete="off">
              <div className="toolbar">
                <div className="field">
                  <span>Nom *</span>
                  <input name="nom" required />
                </div>
                <div className="field">
                  <span>Prenom *</span>
                  <input name="prenom" required />
                </div>
                <div className="field">
                  <span>Matricule</span>
                  <input name="matricule" placeholder="(auto si interim)" />
                </div>
              </div>
              <div className="toolbar">
                <div className="field">
                  <span>Equipe</span>
                  <select name="equipe_id" defaultValue="">
                    <option value="">-</option>
                    {equipes.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nom}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <span>Contrat</span>
                  <select name="type_contrat" defaultValue="CDI">
                    <option value="CDI">CDI</option>
                    <option value="CDD">CDD</option>
                    <option value="INTERIM">Interim</option>
                  </select>
                </div>
                <div className="field">
                  <span>Agence (si interim)</span>
                  <input name="agence_interim" />
                </div>
              </div>
              <div className="toolbar">
                <div className="field">
                  <span>Debut</span>
                  <input name="date_debut" type="date" />
                </div>
                <div className="field">
                  <span>Fin (CDD/interim)</span>
                  <input name="date_fin" type="date" />
                </div>
              </div>
              <label htmlFor="commentaire">Commentaire</label>
              <input id="commentaire" name="commentaire" />
              <p className="muted" style={{ marginTop: 4 }}>
                Ne pas saisir d&apos;information medicale.
              </p>
              <button type="submit">Creer</button>
            </form>
          </div>
        )}
      </div>
    </>
  );
}
