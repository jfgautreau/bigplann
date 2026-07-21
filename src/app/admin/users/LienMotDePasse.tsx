"use client";

import { useState } from "react";

// Affiche le lien de mot de passe genere pour un compte, avec un bouton Copier.
// L'admin le transmet lui-meme (Teams, SMS, de vive voix) : aucun email n'est
// envoye, cf. src/lib/password-link.ts.
export default function LienMotDePasse({ lien, email }: { lien: string; email?: string }) {
  const [copie, setCopie] = useState(false);

  async function copier() {
    try {
      await navigator.clipboard.writeText(lien);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      // Presse-papiers refuse (contexte non securise) : l'utilisateur peut
      // toujours selectionner le texte a la main, il est affiche en entier.
      setCopie(false);
    }
  }

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderLeft: "3px solid var(--ok)",
        borderRadius: 8,
        background: "#f0fdf4",
        padding: "10px 12px",
        marginTop: 10,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: "#166534" }}>
        Lien à transmettre{email ? ` à ${email}` : ""}
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <input
          readOnly
          value={lien}
          onFocus={(e) => e.currentTarget.select()}
          style={{ flex: "1 1 260px", minWidth: 0, fontSize: 12, fontFamily: "ui-monospace, monospace" }}
        />
        <button
          type="button"
          className="btn-sm"
          style={{ width: "auto", margin: 0, flexShrink: 0 }}
          onClick={copier}
        >
          {copie ? "Copié ✓" : "Copier"}
        </button>
      </div>
      <p className="muted" style={{ margin: "8px 0 0", fontSize: 11.5 }}>
        Valable une seule fois et pour une durée limitée. En générer un nouveau annule
        celui-ci. Ce lien vaut accès au compte : transmettez-le à la bonne personne.
      </p>
    </div>
  );
}
