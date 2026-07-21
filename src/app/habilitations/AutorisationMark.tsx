// Marqueur « autorisation de conduite » dans l'en-tete d'une colonne.
//
// Pourquoi une icone dessinee plutot qu'un emoji : les en-tetes de la grille sont
// en ecriture verticale avec `transform: rotate(180deg)` (cf. .colLabel), et un
// emoji y apparait a l'envers. Un volant est en plus quasi symetrique par
// rotation : meme mal oriente il reste lisible, et il dit « conduite » sans
// dependre du rendu d'emoji de la machine.
export default function AutorisationMark({ size = 13 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" style={{ display: "block" }}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
      <path
        d="M12 9.5 V3 M9.8 13.25 L4.2 16.5 M14.2 13.25 L19.8 16.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
