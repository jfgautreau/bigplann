"use client";

import { useState, type ReactNode } from "react";

// Petite icône « i » qui affiche une bulle au survol / clic. Le texte long qui
// encombrerait l'interface (« Date à laquelle la personne quitte… ») se met ici.
export default function InfoBulle({ children, largeur = 260 }: { children: ReactNode; largeur?: number }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <span
      style={{ display: "inline-flex", position: "relative", verticalAlign: "middle", marginLeft: 6 }}
      onMouseEnter={() => setOuvert(true)}
      onMouseLeave={() => setOuvert(false)}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOuvert((v) => !v); }}
        aria-label="Aide"
        style={{
          width: 16,
          height: 16,
          padding: 0,
          margin: 0,
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
        }}
      >
        i
      </button>
      {ouvert && (
        <span
          role="tooltip"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: "50%",
            transform: "translateX(-50%)",
            width: largeur,
            padding: "8px 10px",
            background: "#1f2937",
            color: "#f9fafb",
            fontSize: 12,
            fontWeight: 400,
            lineHeight: 1.4,
            borderRadius: 6,
            boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
            zIndex: 200,
            whiteSpace: "normal",
          }}
        >
          {children}
        </span>
      )}
    </span>
  );
}
