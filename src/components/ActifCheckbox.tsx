"use client";

// Case à cocher « Actif » d'une ligne de paramétrage.
//
// La colonne « Actif » remplace le couple ancien (badge « Actif / Désactivé »
// + bouton « Désactiver / Réactiver ») : un seul geste, cochée = actif, comme
// la colonne Actif du Référentiel (postes / lignes / ateliers).
//
// L'action serveur reçoit `id` + `actif` (le NOUVEL état). Le formulaire est
// soumis dès qu'on coche : `requestSubmit()` déclenche le server action, qui
// invalide la page — la ligne se met à jour au retour.
export default function ActifCheckbox({
  id,
  actif,
  action,
  title,
  keyName = "id",
}: {
  id: string;
  actif: boolean;
  action: (fd: FormData) => Promise<void> | void;
  title?: string;
  // Nom du champ de clé — défaut `id`. Pour `type_contrat` dont la PK est `code`,
  // passer `keyName="code"`.
  keyName?: string;
}) {
  return (
    <form action={action} style={{ display: "inline", margin: 0 }}>
      <input type="hidden" name={keyName} value={id} />
      <input type="hidden" name="actif" value={String(!actif)} />
      <input
        type="checkbox"
        defaultChecked={actif}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        style={{ width: "auto", cursor: "pointer" }}
        title={title ?? (actif ? "Désactiver" : "Réactiver")}
      />
    </form>
  );
}
