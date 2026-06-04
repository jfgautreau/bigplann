"use client";

import { useRouter } from "next/navigation";
import { parseMonday, isoDate, addDays, mondayOf, isoWeekNumber } from "@/lib/week";

const MOIS = ["Janv", "Fevr", "Mars", "Avr", "Mai", "Juin", "Juil", "Aout", "Sept", "Oct", "Nov", "Dec"];

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

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Niveau 1 : annee + mois */}
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div className="segments">
          {years.map((y) => (
            <button key={y} type="button" className={y === navYear ? "seg active" : "seg"} onClick={() => goMonth(y, navMonth)}>
              {y}
            </button>
          ))}
        </div>
        <span style={{ display: "inline-block", width: 40 }} />
        <div className="segments">
          {MOIS.map((lbl, m) => (
            <button key={m} type="button" className={m === navMonth ? "seg active" : "seg"} onClick={() => goMonth(navYear, m)}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Niveau 2 : semaines du mois + navigation */}
      <div className="toolbar" style={{ alignItems: "center", marginTop: 10 }}>
        <button type="button" className="iconbtn" onClick={() => goWeek(isoDate(addDays(center, -7)))} title="Semaine precedente">
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
    </div>
  );
}
