// Pastille de niveau (camembert 0->4) + couleurs, partagee grille / legende.
export const FILL: Record<number, string | null> = {
  0: null, // contour seul
  1: "#dc2626", // rouge
  2: "#f59e0b", // orange
  3: "#84cc16", // vert clair (lime)
  4: "#16a34a", // vert (expert)
};

export function Pie({ level }: { level: number }) {
  const size = 28, r = 11, cx = 14, cy = 14;
  const lvl = Math.max(0, Math.min(4, level));
  const f = lvl / 4;
  const fill = FILL[lvl];

  let inner = null;
  if (fill && f >= 1) {
    inner = <circle cx={cx} cy={cy} r={r} fill={fill} />;
  } else if (fill && f > 0) {
    const ang = -90 + 360 * f;
    const rad = (d: number) => (d * Math.PI) / 180;
    const x = cx + r * Math.cos(rad(ang));
    const y = cy + r * Math.sin(rad(ang));
    const large = f > 0.5 ? 1 : 0;
    inner = <path d={`M${cx},${cy} L${cx},${cy - r} A${r},${r} 0 ${large} 1 ${x},${y} Z`} fill={fill} />;
  }
  return (
    <svg width={size} height={size} style={{ display: "block" }}>
      <circle cx={cx} cy={cy} r={r} fill="#fff" stroke="#64748b" strokeWidth={1.5} />
      {inner}
    </svg>
  );
}
