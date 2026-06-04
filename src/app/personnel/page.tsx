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
  pointure: string | null;
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
    .select("id, matricule, nom, prenom, type_contrat, statut, pointure, equipe:equipe_id(nom)")
    .order("nom")
    .returns<Row[]>();
  const rows = (rowsData ?? []).map((r) => ({
    id: r.id,
    matricule: r.matricule,
    nom: r.nom,
    prenom: r.prenom,
    equipe: r.equipe?.nom ?? "",
    type_contrat: r.type_contrat,
    pointure: r.pointure ?? "",
    statut: r.statut,
  }));

  return (
    <>
      <AppHeader role={profile.role} active="/personnel" />
      <div className="container">
        <h1>Personnel</h1>

        {/* Creation (admin) - au-dessus du tableau */}
        {isAdmin && (
          <div className="card" style={{ marginBottom: 24 }}>
            <h2 style={{ marginTop: 0 }}>Ajouter une personne</h2>
            <form action={createPersonne} autoComplete="off">
              {/* Ligne 1 */}
              <div className="toolbar">
                <div className="field">
                  <span>Nom *</span>
                  <input name="nom" required />
                </div>
                <div className="field">
                  <span>Prénom *</span>
                  <input name="prenom" required />
                </div>
                <div className="field">
                  <span>Matricule</span>
                  <input name="matricule" placeholder="(auto si intérim)" />
                </div>
                <div className="field">
                  <span>Équipe</span>
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
                    <option value="INTERIM">Intérim</option>
                  </select>
                </div>
              </div>
              {/* Ligne 2 */}
              <div className="toolbar">
                <div className="field">
                  <span>Début</span>
                  <input name="date_debut" type="date" />
                </div>
                <div className="field">
                  <span>Fin (CDD/intérim)</span>
                  <input name="date_fin" type="date" />
                </div>
                <div className="field">
                  <span>Agence (si intérim)</span>
                  <input name="agence_interim" />
                </div>
                <div className="field">
                  <span>Pointure</span>
                  <input name="pointure" maxLength={5} style={{ width: 70 }} placeholder="ex. 42" />
                </div>
              </div>
              {/* Ligne 3 */}
              <div className="field" style={{ marginTop: 4 }}>
                <span>Commentaire (pas d&apos;information médicale)</span>
                <input name="commentaire" style={{ width: "100%" }} />
              </div>
              <button type="submit" style={{ width: "auto", padding: "9px 22px" }}>
                Créer
              </button>
            </form>
          </div>
        )}

        <PersonnelTable rows={rows} isAdmin={isAdmin} />
      </div>
    </>
  );
}
