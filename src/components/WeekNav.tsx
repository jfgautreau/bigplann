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
    <div style={{ display: "flex", gap: 4, marginBottom: 4, justifyContent: "center" }}>
      <button type="button" className="iconbtn" onClick={() => go(isoDate(addDays(center, -7)))} title="Semaine précédente">&lsaquo;</button>
      <button type="button" className="btn-sm" style={{ width: "auto", padding: "2px 8px" }} onClick={() => go(today)}>Auj.</button>
      <button type="button" className="iconbtn" onClick={() => go(isoDate(addDays(center, 7)))} title="Semaine suivante">&rsaquo;</button>
    </div>
  );
}
