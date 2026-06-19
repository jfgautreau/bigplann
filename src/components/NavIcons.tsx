import type { ReactElement } from "react";

// Pictogrammes de navigation : silhouettes BLANCHES + details internes en noir
// translucide (donc lisibles quelle que soit la couleur de la tuile).
// viewBox 24x24, rendus a 14px dans une pastille coloree.

const SZ = 14;
const DETAIL = "rgba(0,0,0,0.24)";

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width={SZ} height={SZ} aria-hidden="true" style={{ display: "block" }}>
      {children}
    </svg>
  );
}

export function NavIcon({ name }: { name: string }): ReactElement | null {
  switch (name) {
    // Personnel : un bonhomme
    case "personnel":
      return (
        <Svg>
          <circle cx="12" cy="8" r="4" fill="#fff" />
          <path d="M4 19.6c0-3.7 3.6-6.6 8-6.6s8 2.9 8 6.6c0 .8-.6 1.4-1.4 1.4H5.4C4.6 21 4 20.4 4 19.6z" fill="#fff" />
        </Svg>
      );

    // Matrice : chapeau de diplome (mortarboard)
    case "matrice":
      return (
        <Svg>
          <path d="M12 3 1.5 8 12 13 22.5 8z" fill="#fff" />
          <path d="M6.5 10.2 12 12.8l5.5-2.6V14c0 1.7-2.5 3-5.5 3s-5.5-1.3-5.5-3z" fill="#fff" />
          <path d="M22 8.2v4.3" stroke="#fff" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          <circle cx="22" cy="13.2" r="1.3" fill="#fff" />
        </Svg>
      );

    // Ordonnancement : barres de Gantt
    case "ordonnancement":
      return (
        <Svg>
          <rect x="3" y="5" width="11" height="3.4" rx="1.4" fill="#fff" />
          <rect x="8" y="10.3" width="12" height="3.4" rx="1.4" fill="#fff" />
          <rect x="5" y="15.6" width="9" height="3.4" rx="1.4" fill="#fff" />
        </Svg>
      );

    // Planning : calendrier
    case "planning":
      return (
        <Svg>
          <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" fill="#fff" />
          <path d="M3.5 7.5a2.5 2.5 0 0 1 2.5-2.5h12a2.5 2.5 0 0 1 2.5 2.5v1.8H3.5z" fill={DETAIL} />
          <rect x="7" y="3" width="2.2" height="4" rx="1.1" fill="#fff" />
          <rect x="14.8" y="3" width="2.2" height="4" rx="1.1" fill="#fff" />
          <g fill={DETAIL}>
            <rect x="6.4" y="11.6" width="3" height="2.6" rx="0.6" />
            <rect x="10.5" y="11.6" width="3" height="2.6" rx="0.6" />
            <rect x="14.6" y="11.6" width="3" height="2.6" rx="0.6" />
            <rect x="6.4" y="15.6" width="3" height="2.6" rx="0.6" />
            <rect x="10.5" y="15.6" width="3" height="2.6" rx="0.6" />
          </g>
        </Svg>
      );

    // Bilans : un rapport (feuille + lignes + mini histogramme)
    case "bilans":
      return (
        <Svg>
          <path d="M6.5 2.5H14l4 4v13.5A1.5 1.5 0 0 1 16.5 21.5h-10A1.5 1.5 0 0 1 5 20V4A1.5 1.5 0 0 1 6.5 2.5z" fill="#fff" />
          <path d="M14 2.5v4h4z" fill={DETAIL} />
          <g fill={DETAIL}>
            <rect x="8" y="9.5" width="7.5" height="1.6" rx="0.8" />
            <rect x="8" y="12.4" width="7.5" height="1.6" rx="0.8" />
            <rect x="8" y="17.2" width="1.9" height="2.4" rx="0.5" />
            <rect x="11" y="15.6" width="1.9" height="4" rx="0.5" />
            <rect x="14" y="16.6" width="1.9" height="3" rx="0.5" />
          </g>
        </Svg>
      );

    // Referentiel : une usine (ateliers / lignes / postes)
    case "referentiel":
      return (
        <Svg>
          <path d="M3 20.5V11l5 2.6V11l5 2.6V11l5 2.6V20.5z" fill="#fff" />
          <rect x="17.6" y="4" width="2.4" height="9" rx="0.6" fill="#fff" />
          <g fill={DETAIL}>
            <rect x="5" y="15.5" width="2.4" height="3.2" rx="0.5" />
            <rect x="10" y="15.5" width="2.4" height="3.2" rx="0.5" />
            <rect x="15" y="15.5" width="2.4" height="3.2" rx="0.5" />
          </g>
        </Svg>
      );

    default:
      return null;
  }
}
