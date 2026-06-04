"use client";

import { useRouter } from "next/navigation";
import { moisStr, monthLabel } from "@/lib/week";

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

  const prev = month0 === 0 ? [year - 1, 11] : [year, month0 - 1];
  const next = month0 === 11 ? [year + 1, 0] : [year, month0 + 1];
  const now = new Date();

  return (
    <div className="toolbar" style={{ alignItems: "center" }}>
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
  );
}
