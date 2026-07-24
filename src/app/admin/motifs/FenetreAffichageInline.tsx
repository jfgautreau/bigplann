"use client";

import { useState, useRef } from "react";

// Réglage « Fenêtre d'affichage du planning » avec enregistrement AUTOMATIQUE :
// pas de bouton « Enregistrer ». Chaque changement de valeur envoie l'action
// serveur (debouncé de 500 ms le temps que l'utilisateur finisse de taper).
export default function FenetreAffichageInline({
  initial,
}: {
  initial: { jours_avant: number; jours_apres: number };
}) {
  const [avant, setAvant] = useState<number>(initial.jours_avant);
  const [apres, setApres] = useState<number>(initial.jours_apres);
  const [etat, setEtat] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Endpoint dédié (/api/param-affichage) plutôt qu'un server action : les
  // actions serveur redirigent (via redirect()) et rechargeraient la page à
  // chaque touche, ce qui interdit l'auto-save.
  function planifier(a: number, b: number) {
    if (timer.current) clearTimeout(timer.current);
    setEtat("saving");
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/param-affichage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jours_avant: a, jours_apres: b }),
        });
        if (!res.ok) throw new Error();
        setEtat("saved");
        setTimeout(() => setEtat("idle"), 1500);
      } catch {
        setEtat("error");
      }
    }, 500);
  }

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
      <div className="field">
        <span>Jours avant J (0-14)</span>
        <input
          type="number"
          min={0}
          max={14}
          value={avant}
          onChange={(e) => {
            const v = Math.max(0, Math.min(14, Number(e.target.value || 0)));
            setAvant(v);
            planifier(v, apres);
          }}
          style={{ width: 90 }}
        />
      </div>
      <div className="field">
        <span>Jours après J (0-30)</span>
        <input
          type="number"
          min={0}
          max={30}
          value={apres}
          onChange={(e) => {
            const v = Math.max(0, Math.min(30, Number(e.target.value || 0)));
            setApres(v);
            planifier(avant, v);
          }}
          style={{ width: 90 }}
        />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: etat === "error" ? "var(--danger)" : etat === "saved" ? "var(--ok)" : "var(--muted)", marginBottom: 6 }}>
        {etat === "saving" ? "Enregistrement…" : etat === "saved" ? "Enregistré ✓" : etat === "error" ? "Échec" : ""}
      </span>
    </div>
  );
}
