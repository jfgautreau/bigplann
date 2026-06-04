"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Item = { href: string; label: string };

export default function SettingsMenu({ links, active }: { links: Item[]; active?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (links.length === 0) return null;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Paramétrage"
        style={{
          margin: 0,
          width: 34,
          height: 34,
          padding: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 17,
          lineHeight: 1,
          color: "#fff",
          background: open ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.14)",
          border: "1px solid rgba(255,255,255,0.35)",
          borderRadius: 8,
          cursor: "pointer",
        }}
      >
        &#9881;
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            background: "#fff",
            border: "1px solid var(--border)",
            borderRadius: 10,
            boxShadow: "0 10px 28px rgba(0,0,0,0.2)",
            minWidth: 210,
            zIndex: 60,
            padding: 6,
          }}
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              style={{
                display: "block",
                padding: "8px 12px",
                borderRadius: 7,
                textDecoration: "none",
                color: active === l.href ? "var(--primary)" : "var(--text)",
                fontWeight: active === l.href ? 600 : 400,
                fontSize: 14,
              }}
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
