"use client";

import { useRouter } from "next/navigation";
import { parseMonday, isoDate, addDays, mondayOf, isoWeekNumber } from "@/lib/week";

const MOIS = ["Janv", "Févr", "Mars", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];

// Navigation planning : Annee / Mois (segments) + pastilles des semaines du mois.
// Cliquer une semaine ouvre la vue 3 semaines (S-1 / S / S+1) centree dessus.
export default function PlanningNav({
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
  const centerIso = isoDate(center);
  const todayMonday = isoDate(mondayOf());

  // Mois "ISO" de la semaine centrale = mois du jeudi de cette semaine.
  const thu = addDays(center, 3);
  const navYear = thu.getFullYear();
  const navMonth = thu.getMonth();

  const goWeek = (mondayIso: string) => {
    const p = new URLSearchParams({ ...extra, semaine: mondayIso });
    router.push(`${base}?${p.toString()}`);
  };
  const goMonth = (y: number, m: number) => goWeek(isoDate(mondayOf(new Date(y, m, 1))));

  // Semaines dont le lundi tombe dans le mois (une semaine a cheval -> rattachee au mois de son lundi).
  const last = new Date(navYear, navMonth + 1, 0);
  const weeks: { num: number; iso: string }[] = [];
  let mm = mondayOf(new Date(navYear, navMonth, 1));
  while (mm <= last) {
    weeks.push({ num: isoWeekNumber(mm), iso: isoDate(mm) });
    mm = addDays(mm, 7);
  }
  const years = [navYear - 1, navYear, navYear + 1];

  const monthBtn = (m: number) => (
    <button key={m} type="button" className={m === navMonth ? "seg active" : "seg"} onClick={() => goMonth(navYear, m)}>
      {MOIS[m]}
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
      {/* 1. Aujourd'hui + defilement + semaines */}
      <div className="toolbar" style={{ alignItems: "center", gap: 6, margin: 0 }}>
        <button type="button" className="iconbtn" onClick={() => goWeek(isoDate(addDays(center, -7)))} title="Semaine précédente">
          &lsaquo;
        </button>
        <button type="button" className="btn-sm" style={{ width: "auto" }} onClick={() => goWeek(todayMonday)}>
          Aujourd&apos;hui
        </button>
        <button type="button" className="iconbtn" onClick={() => goWeek(isoDate(addDays(center, 7)))} title="Semaine suivante">
          &rsaquo;
        </button>
        <span className="muted" style={{ marginLeft: 4 }}>Semaines :</span>
        <div className="segments">
          {weeks.map((w) => {
            const isCenter = w.iso === centerIso;
            const isToday = w.iso === todayMonday;
            return (
              <button
                key={w.iso}
                type="button"
                className={isCenter ? "seg active" : "seg"}
                onClick={() => goWeek(w.iso)}
                title={isToday ? "Semaine en cours" : undefined}
              >
                {isToday && !isCenter && (
                  <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#16a34a", marginRight: 5, verticalAlign: "middle" }} />
                )}
                S{w.num}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Annee */}
      <div className="segments">
        {years.map((y) => (
          <button key={y} type="button" className={y === navYear ? "seg active" : "seg"} onClick={() => goMonth(y, navMonth)}>
            {y}
          </button>
        ))}
      </div>

      {/* 3. Mois (12 sur une ligne) */}
      <div className="segments">{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(monthBtn)}</div>
    </div>
  );
}
