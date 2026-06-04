import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { requireModule } from "@/lib/permissions";

export default async function RgpdPage() {
  const { profile } = await requireModule("rgpd", "write");

  return (
    <>
      <AppHeader role={profile.role} active="/admin/rgpd" />
      <div className="container" style={{ maxWidth: 900 }}>
        <h1>RGPD - Registre des traitements</h1>

        <div className="card section">
          <h2 style={{ marginTop: 0 }}>Données traitées</h2>
          <ul>
            <li>Personnel : matricule, nom, prénom, équipe, type de contrat, agence
              d&apos;intérim, dates de contrat, commentaire libre (sans donnée de santé).</li>
            <li>Compétences et habilitations (niveaux, dates d&apos;obtention/expiration).</li>
            <li>Placements journaliers et absences.</li>
            <li>Comptes utilisateurs (email, rôle) et journal d&apos;audit.</li>
          </ul>
          <p className="muted">Aucune donnée de santé, NIR ou coordonnée privée n&apos;est collectée.</p>
        </div>

        <div className="card section">
          <h2 style={{ marginTop: 0 }}>Finalités</h2>
          <ul>
            <li>Planification des effectifs et suivi de la polyvalence.</li>
            <li>Suivi des habilitations à recycler.</li>
            <li>Bilans d&apos;activité internes.</li>
          </ul>
        </div>

        <div className="card section">
          <h2 style={{ marginTop: 0 }}>Conservation</h2>
          <ul>
            <li>Personnel actif : tant qu&apos;actif, puis anonymisation (historique conservé pour les bilans).</li>
            <li>Intérimaires : à anonymiser après la fin de mission.</li>
            <li>Journal d&apos;audit : 3 ans.</li>
          </ul>
          <p className="muted">
            La purge/anonymisation automatique n&apos;est pas encore planifiée (à mettre en place via une tâche programmée).
          </p>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Droits des personnes</h2>
          <p>
            Depuis la fiche d&apos;une personne (Personnel &rarr; Modifier), un administrateur peut :
          </p>
          <ul>
            <li><strong>Exporter</strong> ses données (format JSON).</li>
            <li><strong>Anonymiser</strong> (droit à l&apos;oubli en conservant les statistiques).</li>
            <li><strong>Supprimer</strong> définitivement (droit à l&apos;effacement total).</li>
          </ul>
        </div>
      </div>
    </>
  );
}
