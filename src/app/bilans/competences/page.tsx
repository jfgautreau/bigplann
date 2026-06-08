import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import PrintButton from "@/components/PrintButton";
import { requireModule } from "@/lib/permissions";
import { getServerClient } from "@/lib/supabase-server";
import { parseMois, monthDays, isoDate, isoWeekNumber } from "@/lib/week";
import CompetenceNav from "./CompetenceNav";

type Poste = { id: string; nom: string; actif: boolean; categorie: string; effectif_requis: number };
type Ligne = { id: string; nom: string; poste: Poste[] };
type Mat = { poste_id: string; personne_id: string; niveau_actuel: number };
type Abs = { jour: string; personne_id: string; non_travaille: boolean; motif_absence_id: string | null };

type Cat = "manager" | "conducteur" | "operateur";
const CATS: { key: Cat; label: string }[] = [
  { key: "manager", label: "Managers" },
  { key: "conducteur", label: "Conducteurs" },
  { key: "operateur", label: "Opérateurs" },
];
const asCat = (v: string): Cat =>
  v === "manager" || v === "conducteur" || v === "operateur" ? v : "operateur";

export default async function CompetencesDispoPage({
  searchParams,
}: {
  searchParams: Promise<{ mois?: string; seuil?: string }>;
}) {
  const { profile } = await requireModule("bilans", "read");

  const sp = await searchParams;
  const { year, month0 } = parseMois(sp.mois);
  const seuil = Math.max(1, Math.min(4, Number(sp.seuil) || 2));
  const days = monthDays(year, month0);
  const isos = days.map((d) => d.iso);
  const todayIso = isoDate(new Date());

  const supabase = await getServerClient();
  const [{ data: lignesD }, { data: matD }, { data: actifs }, { data: absD }, { data: quartsD }, { data: jqD }, { data: ovD }] =
    await Promise.all([
      supabase
        .from("ligne")
        .select("id, nom, poste(id, nom, actif, categorie, effectif_requis)")
        .eq("actif", true)
        .order("nom")
        .returns<Ligne[]>(),
      supabase.from("matrice").select("poste_id, personne_id, niveau_actuel").gte("niveau_actuel", seuil).returns<Mat[]>(),
      supabase.from("personne").select("id").eq("statut", "ACTIF").returns<{ id: string }[]>(),
      supabase
        .from("placement")
        .select("jour, personne_id, non_travaille, motif_absence_id")
        .in("jour", isos)
        .returns<Abs[]>(),
      supabase.from("quart").select("code").order("ordre").returns<{ code: string }[]>(),
      supabase.from("jour_quart").select("jour, quart_code, actif").in("jour", isos).returns<{ jour: string; quart_code: string; actif: boolean }[]>(),
      supabase
        .from("ouverture_quart")
        .select("jour, ligne_id, quart_code, ouverte")
        .in("jour", isos)
        .returns<{ jour: string; ligne_id: string; quart_code: string; ouverte: boolean }[]>(),
    ]);

  const actifSet = new Set((actifs ?? []).map((p) => p.id));
  const quarts = (quartsD ?? []).map((q) => q.code);
  const lignes = lignesD ?? [];

  // Categorie de chaque poste + effectifs requis par categorie et par ligne.
  const posteCat = new Map<string, Cat>();
  const lineCatEff = new Map<string, Record<Cat, number>>();
  for (const l of lignes) {
    const eff: Record<Cat, number> = { manager: 0, conducteur: 0, operateur: 0 };
    for (const p of l.poste ?? []) {
      if (!p.actif) continue;
      const c = asCat(p.categorie);
      posteCat.set(p.id, c);
      eff[c] += p.effectif_requis ?? 0;
    }
    lineCatEff.set(l.id, eff);
  }
  const prodLines = lignes.filter((l) => {
    const e = lineCatEff.get(l.id)!;
    return e.manager + e.conducteur + e.operateur > 0;
  });

  // Competents (niveau >= seuil) actifs, regroupes par categorie.
  const competentByCat = new Map<Cat, Set<string>>([
    ["manager", new Set()],
    ["conducteur", new Set()],
    ["operateur", new Set()],
  ]);
  for (const r of matD ?? []) {
    if (!actifSet.has(r.personne_id)) continue;
    const c = posteCat.get(r.poste_id);
    if (c) competentByCat.get(c)!.add(r.personne_id);
  }

  // Absents (toute absence ou NT) par jour
  const absentByDay = new Map<string, Set<string>>();
  for (const r of absD ?? []) {
    if (r.non_travaille || r.motif_absence_id) (absentByDay.get(r.jour) ?? absentByDay.set(r.jour, new Set()).get(r.jour)!).add(r.personne_id);
  }
  const dispo = (cat: Cat, iso: string) => {
    const comp = competentByCat.get(cat)!;
    const abs = absentByDay.get(iso);
    let n = 0;
    for (const pid of comp) if (!abs || !abs.has(pid)) n++;
    return n;
  };

  // Ouverture (ordonnancement)
  const actMap = new Map<string, boolean>();
  for (const r of jqD ?? []) actMap.set(`${r.quart_code}:${r.jour}`, r.actif);
  const ouvMap = new Map<string, boolean>();
  for (const r of ovD ?? []) ouvMap.set(`${r.quart_code}:${r.ligne_id}:${r.jour}`, r.ouverte);
  const quartActif = (q: string, iso: string) => (actMap.has(`${q}:${iso}`) ? actMap.get(`${q}:${iso}`)! : false);
  const ligneOuverte = (lid: string, q: string, iso: string) =>
    ouvMap.has(`${q}:${lid}:${iso}`) ? ouvMap.get(`${q}:${lid}:${iso}`)! : true;

  // Besoin par jour et par categorie (effectifs requis cumules sur les quarts actifs).
  const besoinOf = (iso: string) => {
    const activeQuarts = quarts.filter((q) => quartActif(q, iso));
    let manager = 0;
    let conducteur = 0;
    let operateur = 0;
    let openLines = 0;
    for (const q of activeQuarts) {
      for (const l of prodLines) {
        if (ligneOuverte(l.id, q, iso)) {
          openLines++;
          const e = lineCatEff.get(l.id)!;
          manager += e.manager;
          conducteur += e.conducteur;
          operateur += e.operateur;
        }
      }
    }
    return { manager, conducteur, operateur, quarts: activeQuarts.length, openLines };
  };

  // Mois complet : tous les jours du mois sont affiches.
  const shown = days.map((d) => ({ ...d, b: besoinOf(d.iso), week: isoWeekNumber(new Date(d.iso + "T00:00")) }));

  // Marqueurs de debut de semaine + blocs d'en-tete par semaine.
  let prevWeek = -1;
  const weekBlocks: { label: string; span: number }[] = [];
  const isWeekStart: boolean[] = [];
  shown.forEach((d, i) => {
    const start = d.week !== prevWeek;
    isWeekStart[i] = start;
    if (start) weekBlocks.push({ label: `S${d.week}`, span: 1 });
    else weekBlocks[weekBlocks.length - 1].span++;
    prevWeek = d.week;
  });

  const sep = (i: number): React.CSSProperties => (isWeekStart[i] ? { borderLeft: "2px solid #94a3b8" } : {});
  const cellColor = (d: number, b: number): React.CSSProperties =>
    d < b ? { color: "#7f1d1d", background: "#fee2e2" } : { color: "var(--ok)" };

  return (
    <>
      <AppHeader role={profile.role} active="/bilans" />
      <div className="container" style={{ maxWidth: 1500 }}>
        <div className="toolbar">
          <h1 style={{ margin: 0 }}>Compétences disponibles</h1>
          <Link href="/bilans" className="navlink">&larr; Bilans</Link>
          <PrintButton />
        </div>
        <CompetenceNav year={year} month0={month0} seuil={seuil} />

        <div className="card" style={{ overflowX: "auto" }}>
          <table className="matrix" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th rowSpan={2} style={{ textAlign: "left", position: "sticky", left: 0, background: "#fff", minWidth: 150 }}>
                  Catégorie
                </th>
                {weekBlocks.map((w, i) => (
                  <th key={i} colSpan={w.span} style={{ textAlign: "center", borderLeft: "2px solid #94a3b8", background: "#f8fafc", fontSize: 12 }}>
                    {year} · {w.label}
                  </th>
                ))}
              </tr>
              <tr>
                {shown.map((d, i) => (
                  <th key={d.iso} style={{ width: 34, textAlign: "center", ...sep(i), background: d.iso === todayIso ? "#dbeafe" : undefined }}>
                    {d.nom.slice(0, 2)}
                    <br />
                    <span className="muted" style={{ fontWeight: 400, fontSize: 9 }}>{d.num.slice(0, 2)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Besoin : reference (quarts actifs / lignes ouvertes) */}
              {([
                ["Quarts actifs", (b: ReturnType<typeof besoinOf>) => b.quarts],
                ["Lignes ouvertes", (b: ReturnType<typeof besoinOf>) => b.openLines],
              ] as [string, (b: ReturnType<typeof besoinOf>) => number][]).map(([label, get]) => (
                <tr key={label} style={{ background: "#f8fafc" }}>
                  <td style={{ position: "sticky", left: 0, background: "#f8fafc", fontWeight: 600, color: "var(--muted)" }}>{label}</td>
                  {shown.map((d, i) => (
                    <td key={d.iso} style={{ textAlign: "center", color: "var(--muted)", ...sep(i) }}>{get(d.b)}</td>
                  ))}
                </tr>
              ))}

              {/* Disponibles / besoin par categorie */}
              {CATS.map((c) => {
                const total = competentByCat.get(c.key)!.size;
                return (
                  <tr key={c.key}>
                    <td style={{ position: "sticky", left: 0, background: "#fff", whiteSpace: "nowrap", fontWeight: 600 }}>
                      {c.label} <span className="muted">({total})</span>
                    </td>
                    {shown.map((d, i) => {
                      const disp = dispo(c.key, d.iso);
                      const bes = d.b[c.key];
                      return (
                        <td
                          key={d.iso}
                          title={`${disp} dispo / ${bes} besoin`}
                          style={{ textAlign: "center", fontWeight: 700, ...sep(i), ...cellColor(disp, bes) }}
                        >
                          {disp}<span style={{ fontWeight: 400, fontSize: 11, opacity: 0.7 }}>/{bes}</span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {shown.length === 0 && <p className="muted" style={{ padding: 10 }}>Aucun jour ce mois-ci.</p>}
        </div>

        <p className="muted" style={{ marginTop: 10 }}>
          Mois complet affiché. Par catégorie et par jour : <strong>disponibles / besoin</strong>.
          Disponibles = personnes actives compétentes (niveau &ge; {seuil}) et non absentes.
          Besoin (d&apos;après l&apos;ordonnancement) : Managers / Conducteurs / Opérateurs =
          effectifs requis des postes de la catégorie sur les lignes ouvertes (cumulé sur les
          quarts actifs). En <span style={{ color: "#7f1d1d", background: "#fee2e2", padding: "0 4px" }}>rouge</span>
          {" "}quand les disponibles ne couvrent pas le besoin.
        </p>
      </div>
    </>
  );
}
