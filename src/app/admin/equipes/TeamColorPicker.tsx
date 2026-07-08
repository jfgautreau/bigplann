"use client";

import { useState } from "react";

// Palette de pastilles (évite le sélecteur de couleur natif <input type="color">
// qui peut faire planter l'onglet sur certains navigateurs/pilotes). La valeur
// courante est conservée dans un champ caché (name="couleur").
const PRESETS = [
  "#16a34a", "#22c55e", "#0d9488", "#0891b2", "#2563eb", "#4f46e5",
  "#7c3aed", "#db2777", "#e11d48", "#ea580c", "#ca8a04", "#64748b",
];

export default function TeamColorPicker({ name, defaultValue }: { name: string; defaultValue: string }) {
  const [val, setVal] = useState(defaultValue || "#64748b");
  const isSel = (c: string) => val.toLowerCase() === c.toLowerCase();
  const custom = !PRESETS.some(isSel);
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
      <input type="hidden" name={name} value={val} />
      {custom && (
        <span title={`Couleur actuelle ${val}`} style={{ width: 20, height: 20, borderRadius: 5, background: val, border: "2px solid #111", display: "inline-block" }} />
      )}
      {PRESETS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => setVal(c)}
          title={c}
          aria-label={`Couleur ${c}`}
          style={{ width: 20, height: 20, borderRadius: 5, background: c, border: isSel(c) ? "2px solid #111" : "1px solid #cbd5e1", cursor: "pointer", padding: 0, margin: 0 }}
        />
      ))}
    </span>
  );
}
