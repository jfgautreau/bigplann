// Marqueur « autorisation de conduite » dans l'en-tete d'une colonne.
//
// Pourquoi une icone dessinee plutot qu'un emoji : les en-tetes de la grille sont
// en ecriture verticale avec `transform: rotate(180deg)` (cf. .colLabel), et un
// emoji y apparait a l'envers. Un volant est en plus quasi symetrique par
// rotation : meme mal oriente il reste lisible, et il dit « conduite » sans
// dependre du rendu d'emoji de la machine.
//
// Blanc sur pastille pleine : en bleu sur le fond bleu clair de l'en-tete
// (--accent-bg), le trait se voyait a peine. La pastille est CARREE a dessein —
// dans cet ecran les ronds sont les statuts d'echeance (vert / orange / rouge),
// une pastille ronde preterait a confusion. Le bleu, lui, n'est porteur d'aucun
// statut ici.
const FOND = "#1d4ed8";

export default function AutorisationMark({ size = 13 }: { size?: number }) {
  const cote = size + 5;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: cote,
        height: cote,
        borderRadius: 5,
        background: FOND,
        color: "#fff",
        flexShrink: 0,
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.22)",
      }}
    >
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" style={{ display: "block" }}>
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.4" />
        <circle cx="12" cy="12" r="2.5" fill="currentColor" />
        <path
          d="M12 9.5 V3 M9.8 13.25 L4.2 16.5 M14.2 13.25 L19.8 16.5"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
