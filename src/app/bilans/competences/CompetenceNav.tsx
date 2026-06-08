"use client";

import { useRouter } from "next/navigation";
import { moisStr, monthLabel } from "@/lib/week";

const MOIS = ["Janv", "Févr", "Mars", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];

export default function CompetenceNav({
  year,
  month0,
  seuil,
}: {
  year: number;
  month0: number;
  seuil: number;
}) {
  const router = useRouter();
  const go = (y: number, m: number, s: number) =>
    router.push(`/bilans/competences?mois=${moisStr(y, m)}&seuil=${s}`);

  const years = [year - 1, year, year + 1];
  const prev = month0 === 0 ? [year - 1, 11] : [year, month0 - 1];
  const next = month0 === 11 ? [year + 1, 0] : [year, month0 + 1];
  const now = new Date();

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Annee + mois (comme l'ordonnancement) */}
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div className="segments">
          {years.map((y) => (
            <button key={y} type="button" className={y === year ? "seg active" : "seg"} onClick={() => go(y, month0, seuil)}>
              {y}
            </button>
          ))}
        </div>
        <span style={{ display: "inline-block", width: 40 }} />
        <div className="segments">
          {MOIS.map((lbl, m) => (
            <button key={m} type="button" className={m === month0 ? "seg active" : "seg"} onClick={() => go(year, m, seuil)}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation + seuil de competence */}
      <div className="toolbar" style={{ alignItems: "center", marginTop: 10 }}>
        <button type="button" className="iconbtn" onClick={() => go(prev[0], prev[1], seuil)} title="Mois précédent">
          &lsaquo;
        </button>
        <button type="button" className="btn-sm" style={{ width: "auto" }} onClick={() => go(now.getFullYear(), now.getMonth(), seuil)}>
          Aujourd&apos;hui
        </button>
        <button type="button" className="iconbtn" onClick={() => go(next[0], next[1], seuil)} title="Mois suivant">
          &rsaquo;
        </button>
        <strong style={{ marginLeft: 6 }}>{monthLabel(year, month0)}</strong>
        <span style={{ display: "inline-block", width: 24 }} />
        <span className="muted">Compétent à partir de :</span>
        <div className="segments">
          {[1, 2, 3, 4].map((s) => (
            <button key={s} type="button" className={s === seuil ? "seg active" : "seg"} onClick={() => go(year, month0, s)}>
              Niv &ge; {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
