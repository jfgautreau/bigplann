// Petits pictogrammes SVG partagés (héritent la couleur via `currentColor`,
// donc suivent le `color` du bouton parent). Un seul endroit à retoucher.

type P = { size?: number; color?: string };

// Disquette « Enregistrer ». Variante par défaut retenue le 24/07/2026 :
// bouton à fond transparent, bord gris, disquette en bleu (cf. SaveIcon usage).
export function SaveIcon({ size = 15, color = "currentColor" }: P) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ verticalAlign: "-2px" }}>
      <path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M8 3v5h8V3" />
      <path d="M8 14h8v6H8z" />
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
