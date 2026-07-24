"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Petite icône « i » qui affiche une bulle au survol / clic.
//
// La bulle est positionnee en `position: fixed`, coordonnees calculees a partir
// du rect de l'icone : elle sort ainsi des conteneurs `overflow: auto` (une
// modale par exemple), au lieu d'y provoquer une barre de defilement. Elle
// apparait en haut a droite de l'icone.
export default function InfoBulle({ children, largeur = 260 }: { children: ReactNode; largeur?: number }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  function afficher() {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Coin bas-gauche de la bulle = coin haut-droit de l'icone, plus une marge.
    // La bulle est ancree par (top, left) : on la place au-dessus de l'icone,
    // decalee vers la droite pour reveler une queue implicite.
    setPos({ top: r.top - 6, left: r.right + 6 });
  }
  function cacher() { setPos(null); }

  // Fermer si l'utilisateur clique ailleurs ou fait defiler la page.
  useEffect(() => {
    if (!pos) return;
    const onScroll = () => cacher();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [pos]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onMouseEnter={afficher}
        onMouseLeave={cacher}
        onFocus={afficher}
        onBlur={cacher}
        onClick={(e) => { e.stopPropagation(); pos ? cacher() : afficher(); }}
        aria-label="Aide"
        style={{
          width: 16,
          height: 16,
          padding: 0,
          margin: "0 0 0 6px",
          borderRadius: 999,
          border: "1px solid #94a3b8",
          background: "#fff",
          color: "#475569",
          fontSize: 11,
          fontWeight: 700,
          lineHeight: 1,
          cursor: "help",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          verticalAlign: "middle",
        }}
      >
        i
      </button>
      {pos && (
        <span
          role="tooltip"
          style={{
            position: "fixed",
            // La bulle est ancree par son coin BAS-GAUCHE au coin HAUT-DROIT
            // de l'icone : on tire vers le haut (transform: translateY(-100%)).
            top: pos.top,
            left: pos.left,
            transform: "translateY(-100%)",
            width: largeur,
            padding: "8px 10px",
            background: "#1f2937",
            color: "#f9fafb",
            fontSize: 12,
            fontWeight: 400,
            lineHeight: 1.4,
            borderRadius: 6,
            boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
            zIndex: 400,
            whiteSpace: "normal",
            pointerEvents: "none",
          }}
        >
          {children}
        </span>
      )}
    </>
  );
}
