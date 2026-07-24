// Petits pictogrammes SVG partagés (héritent la couleur via `currentColor`,
// donc suivent le `color` du bouton parent). Un seul endroit à retoucher.

type P = { size?: number; color?: string };

// Disquette « Enregistrer » — variante « pleine, deux tons » (choix du 24/07/2026).
// Corps en `currentColor` ; le curseur et l'étiquette sont évidés avec la couleur
// du FOND du bouton (`hole`, blanc par défaut car les boutons Enregistrer ont un
// fond blanc). Les deux traits de l'étiquette reprennent `currentColor`.
export function SaveIcon({ size = 15, hole = "#fff" }: { size?: number; hole?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" style={{ verticalAlign: "-2px" }}>
      <path fill="currentColor" d="M4 4.6C4 3.7 4.7 3 5.6 3H16l4 4v11.4c0 .9-.7 1.6-1.6 1.6H5.6C4.7 20 4 19.3 4 18.4V4.6Z" />
      <path fill={hole} d="M9 4.6h5.5v2.9c0 .3-.2.5-.5.5H9.5c-.3 0-.5-.2-.5-.5V4.6Z" />
      <rect fill={hole} x="7" y="13" width="10" height="6" rx=".8" />
      <path stroke="currentColor" fill="none" strokeWidth="1.3" strokeLinecap="round" d="M9 15.4h6M9 17.1h4" />
    </svg>
  );
}

// Validation (coche) — remplace le crayon en mode édition inline d'un paramètre.
export function CheckIcon({ size = 16, color = "currentColor" }: P) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color}
      strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ verticalAlign: "-3px" }}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

// Corbeille — proposition retenue (variante « couvercle + fûts »).
export function TrashIcon({ size = 15, color = "currentColor" }: P) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color}
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ verticalAlign: "-2px" }}>
      <path d="M4 7h16" />
      <path d="M10 4h4a1 1 0 0 1 1 1v2H9V5a1 1 0 0 1 1-1z" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}
