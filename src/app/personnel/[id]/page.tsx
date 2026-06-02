import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import AppHeader from "@/components/AppHeader";
import ConfirmForm from "@/components/ConfirmForm";
import { updatePersonne, toggleStatut, anonymiserPersonne, supprimerPersonne } from "../actions";

type Equipe = { id: string; nom: string };
type Personne = {
  id: string;
  matricule: string | null;
  nom: string;
  prenom: string;
  equipe_id: string | null;
  type_contrat: string;
  agence_interim: string | null;
  date_debut: string | null;
  date_fin: string | null;
  pointure: string | null;
  commentaire: string | null;
  statut: string;
};

export default async function FichePersonne({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/personnel");

  const { id } = await params;
  const supabase = await getServerClient();

  const [{ data: p }, { data: equipesData }] = await Promise.all([
    supabase
      .from("personne")
      .select(
        "id, matricule, nom, prenom, equipe_id, type_contrat, agence_interim, date_debut, date_fin, pointure, commentaire, statut"
      )
      .eq("id", id)
      .single<Personne>(),
    supabase.from("equipe").select("id, nom").order("nom").returns<Equipe[]>(),
  ]);

  if (!p) notFound();
  const equipes = equipesData ?? [];

  return (
    <>
      <AppHeader role={profile.role} active="/personnel" />
      <div className="container">
        <p className="muted">
          <Link href="/personnel">&larr; Personnel</Link>
        </p>
        <div className="card">
          <div className="toolbar">
            <h1 style={{ margin: 0 }}>
              {p.nom} {p.prenom}
            </h1>
            <span className={p.statut === "ACTIF" ? "tag" : "tag tag-off"}>
              {p.statut === "ACTIF" ? "Actif" : "Parti"}
            </span>
            <form action={toggleStatut}>
              <input type="hidden" name="id" value={p.id} />
              <input
                type="hidden"
                name="statut"
                value={p.statut === "ACTIF" ? "PARTI" : "ACTIF"}
              />
              <button type="submit" className="btn-sm btn-ghost">
                {p.statut === "ACTIF" ? "Marquer parti" : "Reactiver"}
              </button>
            </form>
          </div>

          <form action={updatePersonne} autoComplete="off">
            <input type="hidden" name="id" value={p.id} />
            <div className="toolbar">
              <div className="field">
                <span>Nom *</span>
                <input name="nom" defaultValue={p.nom} required />
              </div>
              <div className="field">
                <span>Prenom *</span>
                <input name="prenom" defaultValue={p.prenom} required />
              </div>
              <div className="field">
                <span>Matricule</span>
                <input name="matricule" defaultValue={p.matricule ?? ""} />
              </div>
            </div>
            <div className="toolbar">
              <div className="field">
                <span>Equipe</span>
                <select name="equipe_id" defaultValue={p.equipe_id ?? ""}>
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
                <select name="type_contrat" defaultValue={p.type_contrat}>
                  <option value="CDI">CDI</option>
                  <option value="CDD">CDD</option>
                  <option value="INTERIM">Interim</option>
                </select>
              </div>
              <div className="field">
                <span>Agence (si interim)</span>
                <input name="agence_interim" defaultValue={p.agence_interim ?? ""} />
              </div>
            </div>
            <div className="toolbar">
              <div className="field">
                <span>Debut</span>
                <input name="date_debut" type="date" defaultValue={p.date_debut ?? ""} />
              </div>
              <div className="field">
                <span>Fin (CDD/interim)</span>
                <input name="date_fin" type="date" defaultValue={p.date_fin ?? ""} />
              </div>
              <div className="field">
                <span>Pointure</span>
                <input name="pointure" maxLength={5} defaultValue={p.pointure ?? ""} style={{ width: 70 }} />
              </div>
            </div>
            <label htmlFor="commentaire">Commentaire</label>
            <input id="commentaire" name="commentaire" defaultValue={p.commentaire ?? ""} />
            <p className="muted" style={{ marginTop: 4 }}>
              Ne pas saisir d&apos;information medicale.
            </p>
            <button type="submit">Enregistrer</button>
          </form>
        </div>

        {/* RGPD */}
        <div className="card" style={{ marginTop: 24, borderColor: "#fca5a5" }}>
          <h2 style={{ marginTop: 0 }}>RGPD</h2>
          <div className="toolbar" style={{ alignItems: "center" }}>
            <a href={`/api/personnel/${p.id}/export`} className="btn-sm btn-ghost" style={{ textDecoration: "none" }}>
              Exporter les donnees (JSON)
            </a>
            <ConfirmForm
              action={anonymiserPersonne}
              hidden={{ id: p.id }}
              label="Anonymiser"
              confirm="Anonymiser cette personne ? Le nom est remplace, l'historique de placement est conserve."
            />
            <ConfirmForm
              action={supprimerPersonne}
              hidden={{ id: p.id }}
              label="Supprimer (droit a l'oubli)"
              className="btn-sm"
              confirm="Supprimer DEFINITIVEMENT cette personne et tout son historique ? Action irreversible."
            />
          </div>
          <p className="muted" style={{ marginTop: 8 }}>
            Anonymiser conserve l&apos;historique (bilans) en retirant l&apos;identite.
            Supprimer efface definitivement la personne et ses donnees liees.
          </p>
        </div>
      </div>
    </>
  );
}
