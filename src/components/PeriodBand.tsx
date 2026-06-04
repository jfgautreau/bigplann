import Link from "next/link";
import PeriodNav from "@/components/PeriodNav";
import { parseMonday, isoDate, addDays, mondayOf } from "@/lib/week";

// Bande de navigation commune (Ordo + Planning) : segments Annee/Mois +
// fleches semaine precedente / Aujourd'hui / suivante + numeros de semaine.
export default function PeriodBand({
  base,
  semaine,
  extra = {},
  weekNums = [],
}: {
  base: string;
  semaine: string;
  extra?: Record<string, string>;
  weekNums?: number[];
}) {
  const center = parseMonday(semaine);
  const href = (s: string) => {
    const p = new URLSearchParams({ ...extra, semaine: s });
    return `${base}?${p.toString()}`;
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <PeriodNav base={base} semaine={semaine} extra={extra} />
      <div className="toolbar" style={{ alignItems: "center", marginTop: 10 }}>
        <Link href={href(isoDate(addDays(center, -7)))} className="iconbtn" scroll={false} title="Semaine précédente">
          &lsaquo;
        </Link>
        <Link href={href(isoDate(mondayOf()))} className="btn-sm" style={{ textDecoration: "none" }} scroll={false}>
          Aujourd&apos;hui
        </Link>
        <Link href={href(isoDate(addDays(center, 7)))} className="iconbtn" scroll={false} title="Semaine suivante">
          &rsaquo;
        </Link>
        {weekNums.length > 0 && (
          <span className="muted">Semaines {weekNums.join(" · ")}</span>
        )}
      </div>
    </div>
  );
}
