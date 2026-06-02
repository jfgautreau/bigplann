import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/current-user";
import AppHeader from "@/components/AppHeader";

export default async function RgpdPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  return (
    <>
      <AppHeader role={profile.role} active="/admin/rgpd" />
      <div className="container" style={{ maxWidth: 900 }}>
        <h1>RGPD - Registre des traitements</h1>

        <div className="card section">
          <h2 style={{ marginTop: 0 }}>Donnees traitees</h2>
          <ul>
            <li>Personnel : matricule, nom, prenom, equipe, type de contrat, agence
              d&apos;interim, dates de contrat, commentaire libre (sans donnee de sante).</li>
            <li>Competences et habilitations (niveaux, dates d&apos;obtention/expiration).</li>
            <li>Placements journaliers et absences.</li>
            <li>Comptes utilisateurs (email, role) et journal d&apos;audit.</li>
          </ul>
          <p className="muted">Aucune donnee de sante, NIR ou coordonnee privee n&apos;est collectee.</p>
        </div>

        <div className="card section">
          <h2 style={{ marginTop: 0 }}>Finalites</h2>
          <ul>
            <li>Planification des effectifs et suivi de la polyvalence.</li>
            <li>Suivi des habilitations a recycler.</li>
            <li>Bilans d&apos;activite internes.</li>
          </ul>
        </div>

        <div className="card section">
          <h2 style={{ marginTop: 0 }}>Conservation</h2>
          <ul>
            <li>Personnel actif : tant qu&apos;actif, puis anonymisation (historique conserve pour les bilans).</li>
            <li>Interimaires : a anonymiser apres la fin de mission.</li>
            <li>Journal d&apos;audit : 3 ans.</li>
          </ul>
          <p className="muted">
            La purge/anonymisation automatique n&apos;est pas encore planifiee (a mettre en place via une tache programmee).
          </p>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Droits des personnes</h2>
          <p>
            Depuis la fiche d&apos;une personne (Personnel &rarr; Modifier), un administrateur peut :
          </p>
          <ul>
            <li><strong>Exporter</strong> ses donnees (format JSON).</li>
            <li><strong>Anonymiser</strong> (droit a l&apos;oubli en conservant les statistiques).</li>
            <li><strong>Supprimer</strong> definitivement (droit a l&apos;effacement total).</li>
          </ul>
        </div>
      </div>
    </>
  );
}
