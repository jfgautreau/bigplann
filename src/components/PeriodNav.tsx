"use client";

import { useRouter } from "next/navigation";
import { mondayOf, isoDate } from "@/lib/week";

const MOIS = ["Janv", "Fevr", "Mars", "Avr", "Mai", "Juin", "Juil", "Aout", "Sept", "Oct", "Nov", "Dec"];

// Segments Annee + Mois (sur une ligne, espace entre les deux groupes).
export default function PeriodNav({
  base,
  semaine,
  extra = {},
}: {
  base: string;
  semaine: string;
  extra?: Record<string, string>;
}) {
  const router = useRouter();
  const ref = semaine || isoDate(mondayOf());
  const [y, m] = ref.split("-").map(Number);
  const year = y;
  const month = m - 1;
  const years = [year - 1, year, year + 1];

  function goto(yy: number, mm: number) {
    const monday = mondayOf(new Date(yy, mm, 1));
    const p = new URLSearchParams({ ...extra, semaine: isoDate(monday) });
    router.push(`${base}?${p.toString()}`);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
      <div className="segments">
        {years.map((yy) => (
          <button key={yy} type="button" className={yy === year ? "seg active" : "seg"} onClick={() => goto(yy, month)}>
            {yy}
          </button>
        ))}
      </div>
      <span style={{ display: "inline-block", width: 40 }} />
      <div className="segments">
        {MOIS.map((lbl, mm) => (
          <button key={mm} type="button" className={mm === month ? "seg active" : "seg"} onClick={() => goto(year, mm)}>
            {lbl}
          </button>
        ))}
      </div>
    </div>
  );
}
