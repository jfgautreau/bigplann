"use client";

import { useState } from "react";

// Bouton « Ajouter » + fenetre modale portant le formulaire de creation.
// Le formulaire lui-meme reste rendu cote SERVEUR et arrive ici en `children` :
// il garde donc sa server action, et l'on n'a pas a rapatrier la logique
// d'ecriture dans un composant client.
export default function AjoutModal({
  libelle,
  titre,
  children,
}: {
  libelle: string;
  titre: string;
  children: React.ReactNode;
}) {
  const [ouvert, setOuvert] = useState(false);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <button type="button" className="btn-sm" style={{ width: "auto" }} onClick={() => setOuvert(true)}>
          ＋ {libelle}
        </button>
      </div>

      {ouvert && (
        <div
          onClick={() => setOuvert(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(15,23,42,0.45)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "10vh 16px",
            overflow: "auto",
          }}
        >
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ margin: 0, width: "100%", maxWidth: 520 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>{titre}</h2>
              <button
                type="button"
                className="btn-sm btn-ghost"
                onClick={() => setOuvert(false)}
                title="Fermer"
                style={{ width: "auto" }}
              >
                ✕
              </button>
            </div>
            {children}
          </div>
        </div>
      )}
    </>
  );
}
