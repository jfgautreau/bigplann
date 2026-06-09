// Mini-graphe a barres horizontales (sans dependance). Composant serveur pur.
export default function Bars({
  items,
  accent,
  suffix = "",
}: {
  items: { label: string; n: number; color?: string; sub?: string }[];
  accent?: string;
  suffix?: string;
}) {
  const total = items.reduce((s, i) => s + i.n, 0);
  if (items.length === 0 || total === 0) return <p className="muted">Aucune donnée sur cette période / ce périmètre.</p>;
  const max = Math.max(1, ...items.map((i) => i.n));
  return (
    <div>
      {items.map((it, k) => (
        <div className="barrow" key={k}>
          <span className="lab" title={it.label}>
            {it.label}
            {it.sub && <span className="muted"> · {it.sub}</span>}
          </span>
          <span className="track">
            <span className="fill" style={{ width: `${(it.n / max) * 100}%`, background: it.color ?? accent ?? "var(--primary)" }} />
          </span>
          <span className="n">{it.n}{suffix}</span>
        </div>
      ))}
    </div>
  );
}
