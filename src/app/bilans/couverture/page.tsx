import Link from "next/link";
import { getServerClient } from "@/lib/supabase-server";
import AppHeader from "@/components/AppHeader";
import PrintButton from "@/components/PrintButton";
import OrdoMonthNav from "@/app/ordonnancement/OrdoMonthNav";
import ReportAtelierFilter from "@/app/bilans/ReportAtelierFilter";
import { requireModule } from "@/lib/permissions";
import { fetchAll } from "@/lib/fetch-all";
import { parseMois, monthDays, monthLabel } from "@/lib/week";

type LigneRow = { id: string; atelier_id: string | null; poste: { id: string; actif: boolean; effectif_requis: number; niveau_min_requis: number }[] };
type Placement = { personne_id: string; jour: string; poste_id: string | null; quart_code: string | null; motif_absence_id: string | null };
type Named = { id: string; nom: string; prenom: string };

const dow = (iso: string) => new Date(iso + "T00:00").getDay(); // 0 dim .. 6 sam
const isWeekend = (iso: string) => dow(iso) === 0 || dow(iso) === 6;

export default async function CouvertureReport({ searchParams }: { searchParams: Promise<{ mois?: string; atelier?: string }> }) {
  const { profile } = await requireModule("bilans", "read");
  const sp = await searchParams;
  const atelier = sp.atelier ?? "";
  const { year, month0 } = parseMois(sp.mois);
  const days = monthDays(year, month0);
  const isos = days.map((d) => d.iso);

  const supabase = await getServerClient();
  const [{ data: lignesD }, { data: quartsD }, { data: jqD }, ovD, { data: pqOffD }, plD, matD, { data: persD }, { data: atD }] =
    await Promise.all([
      supabase.from("ligne").select("id, atelier_id, poste(id, actif, effectif_requis, niveau_min_requis)").eq("actif", true).returns<LigneRow[]>(),
      supabase.from("quart").select("code, libelle").order("ordre").returns<{ code: string; libelle: string }[]>(),
      supabase.from("jour_quart").select("jour, quart_code, actif").in("jour", isos).returns<{ jour: string; quart_code: string; actif: boolean }[]>(),
      fetchAll<{ jour: string; ligne_id: string; quart_code: string; ouverte: boolean }>(() =>
        supabase.from("ouverture_quart").select("jour, ligne_id, quart_code, ouverte").in("jour", isos).order("jour").order("ligne_id").order("quart_code").returns<{ jour: string; ligne_id: string; quart_code: string; ouverte: boolean }[]>()
      ),
      supabase.from("poste_quart").select("poste_id, quart_code").eq("actif", false).returns<{ poste_id: string; quart_code: string }[]>(),
      fetchAll<Placement>(() =>
        supabase.from("placement").select("personne_id, jour, poste_id, quart_code, motif_absence_id").in("jour", isos).order("id").returns<Placement[]>()
      ),
      fetchAll<{ personne_id: string; poste_id: string; niveau_actuel: number }>(() =>
        supabase.from("matrice").select("personne_id, poste_id, niveau_actuel").order("id").returns<{ personne_id: string; poste_id: string; niveau_actuel: number }[]>()
      ),
      supabase.from("personne").select("id, nom, prenom").eq("statut", "ACTIF").returns<Named[]>(),
      supabase.from("atelier").select("id, nom").eq("actif", true).order("nom").returns<{ id: string; nom: string }[]>(),
    ]);

  const quartList = quartsD ?? [];
  const quarts = quartList.map((q) => q.code);
  const pqOff = new Set((pqOffD ?? []).map((r) => `${r.poste_id}:${r.quart_code}`));
  const actMap = new Map<string, boolean>();
  for (const r of jqD ?? []) actMap.set(`${r.quart_code}:${r.jour}`, r.actif);
  const ouvMap = new Map<string, boolean>();
  for (const r of ovD) ouvMap.set(`${r.quart_code}:${r.ligne_id}:${r.jour}`, r.ouverte);
  const quartActif = (q: string, iso: string) => actMap.get(`${q}:${iso}`) ?? false;
  const ligneOuverte = (lid: string, q: string, iso: string) => ouvMap.get(`${q}:${lid}:${iso}`) ?? true;

  const lignes = (lignesD ?? []).filter((l) => !atelier || l.atelier_id === atelier);
  const scopedPosteIds = new Set(lignes.flatMap((l) => (l.poste ?? []).filter((p) => p.actif).map((p) => p.id)));
  // Besoin du jour = somme, sur les quarts actifs et lignes ouvertes, des effectifs
  // requis des postes actifs sur ce quart (poste_quart, defaut actif).
  const besoinJour = (iso: string) => {
    let b = 0;
    for (const q of quarts) {
      if (!quartActif(q, iso)) continue;
      for (const l of lignes) {
        if (!ligneOuverte(l.id, q, iso)) continue;
        for (const p of l.poste ?? []) {
          if (p.actif && !pqOff.has(`${p.id}:${q}`)) b += p.effectif_requis ?? 0;
        }
      }
    }
    return b;
  };

  // Besoin d'un quart un jour donne (0 si le quart n'est pas actif ce jour).
  const besoinQJ = (q: string, iso: string) => {
    if (!quartActif(q, iso)) return 0;
    let b = 0;
    for (const l of lignes) {
      if (!ligneOuverte(l.id, q, iso)) continue;
      for (const p of l.poste ?? []) if (p.actif && !pqOff.has(`${p.id}:${q}`)) b += p.effectif_requis ?? 0;
    }
    return b;
  };

  const placements = plD;
  const presentJour = new Map<string, number>();
  const presentQD = new Map<string, number>(); // `${quart}:${jour}` -> nb places
  for (const r of placements)
    if (r.poste_id && scopedPosteIds.has(r.poste_id)) {
      presentJour.set(r.jour, (presentJour.get(r.jour) ?? 0) + 1);
      const qc = r.quart_code ?? "matin";
      presentQD.set(`${qc}:${r.jour}`, (presentQD.get(`${qc}:${r.jour}`) ?? 0) + 1);
    }

  // ---- 3.1 Couverture vs besoin ----
  const jours = days.map((d) => {
    const besoin = besoinJour(d.iso);
    const present = presentJour.get(d.iso) ?? 0;
    return { ...d, besoin, present, delta: present - besoin, ouvert: besoin > 0 };
  });
  const joursOuverts = jours.filter((j) => j.ouvert);
  const sousCouverts = joursOuverts.filter((j) => j.delta < 0);
  const tauxMoyen = joursOuverts.length
    ? Math.round((joursOuverts.reduce((s, j) => s + Math.min(1, j.besoin ? j.present / j.besoin : 1), 0) / joursOuverts.length) * 100)
    : 100;

  // Quarts a detailler = ceux qui ont du besoin ou des presents sur la periode.
  const usedQuarts = quartList.filter((q) =>
    joursOuverts.some((j) => besoinQJ(q.code, j.iso) > 0 || (presentQD.get(`${q.code}:${j.iso}`) ?? 0) > 0)
  );

  // 3 lignes Besoin / Present / Delta pour un couple (besoinOf, presentOf).
  const metricRows = (kp: string, besoinOf: (iso: string) => number, presentOf: (iso: string) => number) => [
    <tr key={kp + "b"}>
      <td style={{ paddingLeft: 18, color: "var(--muted)" }}>Besoin</td>
      {joursOuverts.map((j) => (<td key={j.iso} style={{ textAlign: "center", fontWeight: 700, color: "var(--muted)" }}>{besoinOf(j.iso)}</td>))}
    </tr>,
    <tr key={kp + "p"}>
      <td style={{ paddingLeft: 18 }}>Présent</td>
      {joursOuverts.map((j) => (<td key={j.iso} style={{ textAlign: "center", fontWeight: 700 }}>{presentOf(j.iso)}</td>))}
    </tr>,
    <tr key={kp + "d"}>
      <td style={{ paddingLeft: 18 }}>Delta</td>
      {joursOuverts.map((j) => {
        const d = presentOf(j.iso) - besoinOf(j.iso);
        return (<td key={j.iso} style={{ textAlign: "center", fontWeight: 700, color: d < 0 ? "var(--danger)" : d > 0 ? "#9a3412" : "var(--ok)", background: d < 0 ? "#fee2e2" : undefined }}>{d > 0 ? `+${d}` : d}</td>);
      })}
    </tr>,
  ];
  const quartHead = (label: string, bg: string) => (
    <tr><td colSpan={joursOuverts.length + 1} style={{ background: bg, fontWeight: 700, padding: "3px 8px" }}>{label}</td></tr>
  );

  // ---- 3.2 Placements hors-competence ----
  const niveauMin = new Map<string, number>();
  const posteIds = new Set<string>();
  for (const l of lignes) for (const p of l.poste ?? []) if (p.actif) { niveauMin.set(p.id, p.niveau_min_requis); posteIds.add(p.id); }
  const matNiveau = new Map<string, number>();
  for (const r of matD) matNiveau.set(`${r.personne_id}:${r.poste_id}`, r.niveau_actuel);
  const persNom = (id: string) => {
    const p = (persD ?? []).find((x) => x.id === id);
    return p ? `${p.nom} ${p.prenom}` : "?";
  };
  // nom court de poste
  const { data: postesNomD } = await supabase.from("poste").select("id, nom").in("id", [...posteIds]).returns<{ id: string; nom: string }[]>();
  const posteNom = new Map((postesNomD ?? []).map((p) => [p.id, p.nom]));

  const horsComp = placements
    .filter((r) => r.poste_id && (matNiveau.get(`${r.personne_id}:${r.poste_id}`) ?? 0) < (niveauMin.get(r.poste_id) ?? 0))
    .map((r) => ({
      personne: persNom(r.personne_id),
      poste: posteNom.get(r.poste_id!) ?? "?",
      jour: r.jour,
      niveau: matNiveau.get(`${r.personne_id}:${r.poste_id}`) ?? 0,
      min: niveauMin.get(r.poste_id!) ?? 0,
    }))
    .sort((a, b) => a.jour.localeCompare(b.jour));

  // ---- 3.3 Equite de charge & rotation ----
  const charge = new Map<string, { jours: number; nuits: number; we: number; postes: Set<string> }>();
  for (const r of placements) {
    if (!r.poste_id || !scopedPosteIds.has(r.poste_id)) continue;
    const c = charge.get(r.personne_id) ?? { jours: 0, nuits: 0, we: 0, postes: new Set<string>() };
    c.jours++;
    if (r.quart_code === "nuit") c.nuits++;
    if (isWeekend(r.jour)) c.we++;
    c.postes.add(r.poste_id);
    charge.set(r.personne_id, c);
  }
  const chargeRows = [...charge.entries()]
    .map(([id, c]) => ({ personne: persNom(id), jours: c.jours, nuits: c.nuits, we: c.we, nbPostes: c.postes.size }))
    .sort((a, b) => b.jours - a.jours);

  const fmtJJ = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);

  return (
    <>
      <AppHeader role={profile.role} active="/bilans" />
      <div className="container" style={{ maxWidth: 1500 }}>
        <div className="report-head">
          <div>
            <h1>Couverture de poste</h1>
            <div className="sub">{monthLabel(year, month0)} · besoin d&apos;après l&apos;ordonnancement, présents d&apos;après les placements</div>
          </div>
          <div className="noprint" style={{ display: "flex", gap: 8 }}>
            <Link href="/bilans" className="navlink">&larr; Cockpit</Link>
            <Link href="/bilans/competences" className="navlink">Compétences disponibles</Link>
            <PrintButton />
          </div>
        </div>

        <ReportAtelierFilter ateliers={atD ?? []} atelier={atelier} />
        <div className="noprint"><OrdoMonthNav base="/bilans/couverture" year={year} month0={month0} /></div>

        <div className="kpi-grid">
          <div className={`kpi ${tauxMoyen < 90 ? "warn" : "ok"}`}><div className="v">{tauxMoyen}<small> %</small></div><div className="l">Taux de couverture moyen</div><div className="s">présents / besoin</div></div>
          <div className={`kpi ${sousCouverts.length > 0 ? "danger" : "ok"}`}><div className="v">{sousCouverts.length}</div><div className="l">Jours sous-couverts</div><div className="s">sur {joursOuverts.length} jours ouverts</div></div>
          <div className={`kpi ${horsComp.length > 0 ? "warn" : "ok"}`}><div className="v">{horsComp.length}</div><div className="l">Placements hors-compétence</div></div>
        </div>

        {/* 3.1 Couverture vs besoin */}
        <div className="report-section">
          <h2>Couverture vs besoin — {monthLabel(year, month0)}</h2>
          <div className="card" style={{ overflowX: "auto" }}>
            <table className="matrix" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr><th style={{ textAlign: "left" }}></th>{joursOuverts.map((j) => (<th key={j.iso} style={{ textAlign: "center", minWidth: 30 }}>{j.nom.slice(0, 2)}<br /><span className="muted" style={{ fontWeight: 400, fontSize: 10 }}>{j.num.slice(0, 2)}</span></th>))}</tr>
              </thead>
              <tbody>
                {quartHead("Total — tous quarts", "#e2e8f0")}
                {metricRows("tot", besoinJour, (iso) => presentJour.get(iso) ?? 0)}
                {usedQuarts.flatMap((q) => [
                  <tr key={q.code + "h"}><td colSpan={joursOuverts.length + 1} style={{ background: "#eef2ff", fontWeight: 700, padding: "3px 8px" }}>{q.libelle}</td></tr>,
                  ...metricRows(q.code, (iso) => besoinQJ(q.code, iso), (iso) => presentQD.get(`${q.code}:${iso}`) ?? 0),
                ])}
              </tbody>
            </table>
            {joursOuverts.length === 0 && <p className="muted">Aucun jour ouvert ce mois-ci (ordonnancement non initialisé).</p>}
          </div>
        </div>

        {/* 3.2 Hors-competence */}
        <div className="report-section">
          <h2>Placements hors-compétence</h2>
          <div className="card">
            {horsComp.length === 0 ? <p className="muted">Aucun placement sous le niveau requis ce mois-ci.</p> : (
              <table>
                <thead><tr><th>Jour</th><th>Personne</th><th>Poste</th><th style={{ textAlign: "center" }}>Niveau / requis</th></tr></thead>
                <tbody>
                  {horsComp.slice(0, 40).map((h, i) => (
                    <tr key={i}><td>{fmtJJ(h.jour)}</td><td>{h.personne}</td><td><strong>{h.poste}</strong></td><td style={{ textAlign: "center" }}><span className="rbadge danger">{h.niveau} / {h.min}</span></td></tr>
                  ))}
                </tbody>
              </table>
            )}
            {horsComp.length > 40 && <p className="muted" style={{ marginTop: 6 }}>… et {horsComp.length - 40} autres.</p>}
          </div>
        </div>

        {/* 3.3 Equite & rotation */}
        <div className="report-section">
          <h2>Équité de charge &amp; rotation — {monthLabel(year, month0)}</h2>
          <div className="card" style={{ overflowX: "auto" }}>
            {chargeRows.length === 0 ? <p className="muted">Aucun placement ce mois-ci.</p> : (
              <table>
                <thead><tr><th>Personne</th><th style={{ textAlign: "center" }}>Jours travaillés</th><th style={{ textAlign: "center" }}>Nuits</th><th style={{ textAlign: "center" }}>Week-ends</th><th style={{ textAlign: "center" }}>Postes différents</th></tr></thead>
                <tbody>
                  {chargeRows.map((c, i) => (
                    <tr key={i}>
                      <td>{c.personne}</td>
                      <td style={{ textAlign: "center", fontWeight: 700 }}>{c.jours}</td>
                      <td style={{ textAlign: "center" }}>{c.nuits || "—"}</td>
                      <td style={{ textAlign: "center" }}>{c.we || "—"}</td>
                      <td style={{ textAlign: "center" }}>{c.nbPostes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
