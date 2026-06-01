"use client";

import { useRouter } from "next/navigation";
import { mondayOf, isoDate } from "@/lib/week";

const MOIS = ["Janv", "Fevr", "Mars", "Avr", "Mai", "Juin", "Juil", "Aout", "Sept", "Oct", "Nov", "Dec"];

// Segments Annee / Mois pour naviguer rapidement (positionne la vue sur le
// lundi de la semaine du 1er du mois choisi).
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
    <div style={{ marginBottom: 12 }}>
      <div className="segments">
        {years.map((yy) => (
          <button
            key={yy}
            type="button"
            className={yy === year ? "seg active" : "seg"}
            onClick={() => goto(yy, month)}
          >
            {yy}
          </button>
        ))}
      </div>
      <div className="segments" style={{ marginTop: 6 }}>
        {MOIS.map((lbl, mm) => (
          <button
            key={mm}
            type="button"
            className={mm === month ? "seg active" : "seg"}
            onClick={() => goto(year, mm)}
          >
            {lbl}
          </button>
        ))}
      </div>
    </div>
  );
}
