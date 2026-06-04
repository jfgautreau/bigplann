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
        className="navlink"
        onClick={() => setOpen((o) => !o)}
        title="Parametrage"
        style={{ fontSize: 18, lineHeight: 1, background: open ? "rgba(255,255,255,0.18)" : undefined }}
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
