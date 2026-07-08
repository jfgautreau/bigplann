"use client";

import { useState } from "react";

// Palette pastel (pas de sélecteur natif <input type="color"> qui pouvait faire
// planter l'onglet). On clique sur la couleur pour ouvrir la palette.
const PRESETS = [
  "#fecaca", "#fed7aa", "#fde68a", "#d9f99d", "#bbf7d0", "#a7f3d0",
  "#99f6e4", "#a5f3fc", "#bae6fd", "#bfdbfe", "#c7d2fe", "#ddd6fe",
  "#e9d5ff", "#f5d0fe", "#fbcfe8", "#fecdd3", "#e2e8f0", "#fef08a",
];

export default function TeamColorPicker({ name, defaultValue }: { name: string; defaultValue: string }) {
  const [val, setVal] = useState(defaultValue || "#bfdbfe");
  const [open, setOpen] = useState(false);
  const isSel = (c: string) => val.toLowerCase() === c.toLowerCase();

  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <input type="hidden" name={name} value={val} />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Changer la couleur"
        style={{ width: 34, height: 22, borderRadius: 5, background: val, border: "1px solid #94a3b8", cursor: "pointer", padding: 0, margin: 0 }}
      />
      {open && (
        <>
          <span onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 39 }} />
          <div
            style={{
              position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 40,
              background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8,
              boxShadow: "0 8px 24px rgba(0,0,0,0.18)", padding: 8,
              display: "grid", gridTemplateColumns: "repeat(6, 24px)", gap: 6,
            }}
          >
            {PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => { setVal(c); setOpen(false); }}
                title={c}
                aria-label={`Couleur ${c}`}
                style={{ width: 24, height: 24, borderRadius: 5, background: c, border: isSel(c) ? "2px solid #111" : "1px solid #cbd5e1", cursor: "pointer", padding: 0, margin: 0 }}
              />
            ))}
          </div>
        </>
      )}
    </span>
  );
}
