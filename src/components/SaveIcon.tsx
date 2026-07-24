// Icone disquette « Enregistrer » — SVG en `currentColor`, donc suit le
// `color` du bouton parent (blanc sur fond bleu, gris sur fond clair...).
// L'emoji 💾 rendait avec ses propres couleurs et devenait illisible sur un
// fond colore : le SVG regle ca en une balise.
export default function SaveIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ verticalAlign: "-2px" }}
    >
      {/* Corps de la disquette + languette du haut + libelle du bas. */}
      <path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M8 3v5h8V3" />
      <path d="M8 14h8v6H8z" />
    </svg>
  );
}
