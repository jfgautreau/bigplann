"use client";

import { useRouter } from "next/navigation";
import { parseMonday, isoDate, addDays, mondayOf } from "@/lib/week";

// Boutons de navigation semaine (precedente / aujourd'hui / suivante).
export default function WeekNav({
  base,
  semaine,
  extra = {},
}: {
  base: string;
  semaine: string;
  extra?: Record<string, string>;
}) {
  const router = useRouter();
  const center = parseMonday(semaine);
  const today = isoDate(mondayOf());
  const go = (iso: string) => {
    const p = new URLSearchParams({ ...extra, semaine: iso });
    router.push(`${base}?${p.toString()}`);
  };
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 6, justifyContent: "center", alignItems: "center" }}>
      <button
        type="button"
        className="iconbtn"
        style={{ fontSize: 20, lineHeight: 1, padding: "4px 11px", fontWeight: 800 }}
        onClick={() => go(isoDate(addDays(center, -7)))}
        title="Semaine précédente"
      >
        &lsaquo;
      </button>
      <button
        type="button"
        style={{ width: "auto", margin: 0, padding: "7px 16px", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", boxShadow: "0 1px 3px rgba(0,0,0,0.18)" }}
        onClick={() => go(today)}
      >
        Aujourd&apos;hui
      </button>
      <button
        type="button"
        className="iconbtn"
        style={{ fontSize: 20, lineHeight: 1, padding: "4px 11px", fontWeight: 800 }}
        onClick={() => go(isoDate(addDays(center, 7)))}
        title="Semaine suivante"
      >
        &rsaquo;
      </button>
    </div>
  );
}
