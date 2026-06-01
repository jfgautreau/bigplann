import Link from "next/link";
import { addDays, isoDate, parseMonday } from "@/lib/week";

// Navigation semaine precedente / suivante / courante. Preserve les autres
// parametres de recherche fournis dans `extra`.
export default function WeekNav({
  base,
  semaine,
  extra = {},
}: {
  base: string;
  semaine: string;
  extra?: Record<string, string>;
}) {
  const monday = parseMonday(semaine);
  const prev = isoDate(addDays(monday, -7));
  const next = isoDate(addDays(monday, 7));
  const cur = isoDate(monday);
  const end = addDays(monday, 6);

  const href = (s: string) => {
    const p = new URLSearchParams({ ...extra, semaine: s });
    return `${base}?${p.toString()}`;
  };

  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

  return (
    <div className="toolbar" style={{ alignItems: "center" }}>
      <Link href={href(prev)} className="btn-sm btn-ghost" style={{ textDecoration: "none" }}>
        &larr; Semaine prec.
      </Link>
      <strong>
        Semaine du {fmt(monday)} au {fmt(end)}
      </strong>
      <Link href={href(next)} className="btn-sm btn-ghost" style={{ textDecoration: "none" }}>
        Semaine suiv. &rarr;
      </Link>
      <Link href={href(isoDate(parseMonday()))} className="navlink">
        Cette semaine
      </Link>
      <input type="hidden" value={cur} readOnly />
    </div>
  );
}
