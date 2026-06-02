"use client";

import { useRouter } from "next/navigation";
import { moisStr, monthLabel } from "@/lib/week";

const MOIS = ["Janv", "Fevr", "Mars", "Avr", "Mai", "Juin", "Juil", "Aout", "Sept", "Oct", "Nov", "Dec"];

export default function OrdoMonthNav({
  base,
  year,
  month0,
}: {
  base: string;
  year: number;
  month0: number;
}) {
  const router = useRouter();
  const go = (y: number, m: number) => router.push(`${base}?mois=${moisStr(y, m)}`);

  const years = [year - 1, year, year + 1];
  const prev = month0 === 0 ? [year - 1, 11] : [year, month0 - 1];
  const next = month0 === 11 ? [year + 1, 0] : [year, month0 + 1];
  const now = new Date();

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div className="segments">
          {years.map((y) => (
            <button key={y} type="button" className={y === year ? "seg active" : "seg"} onClick={() => go(y, month0)}>
              {y}
            </button>
          ))}
        </div>
        <span style={{ display: "inline-block", width: 40 }} />
        <div className="segments">
          {MOIS.map((lbl, m) => (
            <button key={m} type="button" className={m === month0 ? "seg active" : "seg"} onClick={() => go(year, m)}>
              {lbl}
            </button>
          ))}
        </div>
      </div>
      <div className="toolbar" style={{ alignItems: "center", marginTop: 10 }}>
        <button type="button" className="iconbtn" onClick={() => go(prev[0], prev[1])} title="Mois precedent">
          &lsaquo;
        </button>
        <button type="button" className="btn-sm" style={{ width: "auto" }} onClick={() => go(now.getFullYear(), now.getMonth())}>
          Aujourd&apos;hui
        </button>
        <button type="button" className="iconbtn" onClick={() => go(next[0], next[1])} title="Mois suivant">
          &rsaquo;
        </button>
        <strong style={{ marginLeft: 6 }}>{monthLabel(year, month0)}</strong>
      </div>
    </div>
  );
}
