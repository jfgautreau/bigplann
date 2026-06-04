"use client";

// Cadenas ferme (off) / ouvert (on), facon visuel de bascule.
function Lock({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="9" rx="2" fill="#e5e7eb" />
      {open ? <path d="M8 11V7a4 4 0 0 1 8 0" /> : <path d="M8 11V7a4 4 0 0 1 8 0v4" />}
    </svg>
  );
}

// Interrupteur a bascule : vert (on) / rouge (off), libelles parametrables.
export default function ToggleSwitch({
  on,
  onChange,
  onLabel = "Actif",
  offLabel = "Inactif",
  title,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  onLabel?: string;
  offLabel?: string;
  title?: string;
}) {
  const W = 112;
  const H = 34;
  const K = 28;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      title={title}
      onClick={() => onChange(!on)}
      style={{
        position: "relative",
        width: W,
        height: H,
        flex: "0 0 auto",
        margin: 0,
        padding: 0,
        border: "none",
        borderRadius: 999,
        cursor: "pointer",
        background: on ? "#16a34a" : "#dc2626",
        boxShadow: "inset 0 1px 3px rgba(0,0,0,0.25)",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          display: "flex",
          alignItems: "center",
          left: on ? 14 : "auto",
          right: on ? "auto" : 14,
          color: "#fff",
          fontWeight: 700,
          fontSize: 12,
          letterSpacing: 0.3,
        }}
      >
        {on ? onLabel : offLabel}
      </span>
      <span
        style={{
          position: "absolute",
          top: (H - K) / 2,
          left: on ? W - K - 3 : 3,
          width: K,
          height: K,
          borderRadius: 999,
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "left 0.18s ease",
        }}
      >
        <Lock open={on} />
      </span>
    </button>
  );
}
