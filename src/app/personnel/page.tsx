import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import AppHeader from "@/components/AppHeader";
import { requireModule, canWrite } from "@/lib/permissions";
import { createPersonne } from "./actions";
import PersonnelTable from "./PersonnelTable";

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

export default async function PersonnelPage() {
  const { profile, perms } = await requireModule("personnel", "read");
  const isAdmin = canWrite(perms, "personnel");

  const supabase = await getServerClient();
  const { data: equipesData } = await supabase
    .from("equipe")
    .select("id, nom")
    .order("nom")
    .returns<Equipe[]>();
  const equipes = equipesData ?? [];

  const { data: rowsData } = await supabase
    .from("personne")
    .select("id, matricule, nom, prenom, type_contrat, statut, equipe:equipe_id(nom)")
    .order("nom")
    .returns<Row[]>();
  const rows = (rowsData ?? []).map((r) => ({
    id: r.id,
    matricule: r.matricule,
    nom: r.nom,
    prenom: r.prenom,
    equipe: r.equipe?.nom ?? "",
    type_contrat: r.type_contrat,
    statut: r.statut,
  }));

  return (
    <>
      <AppHeader role={profile.role} active="/personnel" />
      <div className="container">
        <h1>Personnel</h1>

        <div style={{ marginBottom: 24 }}>
          <PersonnelTable rows={rows} isAdmin={isAdmin} />
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
                <div className="field">
                  <span>Pointure</span>
                  <input name="pointure" maxLength={5} style={{ width: 70 }} placeholder="ex. 42" />
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
