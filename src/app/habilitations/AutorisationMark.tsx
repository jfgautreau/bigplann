// Marqueur « autorisation » dans l'en-tete d'une colonne.
//
// Pourquoi une icone dessinee plutot qu'un emoji : les en-tetes de la grille sont
// en ecriture verticale avec `transform: rotate(180deg)` (cf. .colLabel), et un
// emoji y apparait a l'envers avec ses couleurs propres. Un SVG en `currentColor`
// suit la couleur de la pastille et reste lisible retourne — une carte d'identite
// stylisee (photo + lignes) se lit dans les deux sens sans confusion.
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
        {/* Contour de la carte */}
        <rect x="2.5" y="5" width="19" height="14" rx="2" ry="2"
              fill="none" stroke="currentColor" strokeWidth="1.8" />
        {/* Photo (rond) a gauche */}
        <circle cx="8" cy="11" r="2.2" fill="currentColor" />
        {/* Epaules sous la photo */}
        <path d="M5 16.5 C5.5 14.8, 10.5 14.8, 11 16.5"
              fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        {/* Lignes d'infos a droite */}
        <path d="M13 9.5 H19 M13 12 H18.5"
              stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </span>
  );
}
