import Link from "next/link";
import { getServerClient } from "@/lib/supabase-server";
import AppHeader from "@/components/AppHeader";
import PrintButton from "@/components/PrintButton";
import ReportAtelierFilter from "@/app/bilans/ReportAtelierFilter";
import { requireModule } from "@/lib/permissions";
import { isoDate, addDays, mondayOf, isoWeekNumber } from "@/lib/week";

type LigneRow = { id: string; nom: string; atelier_id: string | null; poste: { id: string; nom: string; actif: boolean; effectif_requis: number }[] };
type Personne = { id: string; nom: string; prenom: string; type_contrat: string; date_fin: string | null };
type Placement = { personne_id: string; jour: string; motif_absence_id: string | null };
type Mat = { personne_id: string; poste_id: string; niveau_actuel: number };

const SEUIL = 2;
const fmtDate = (d: string) => d.split("-").reverse().join("/");

export default async function AnticipationReport({ searchParams }: { searchParams: Promise<{ atelier?: string }> }) {
  const { profile } = await requireModule("bilans", "read");
  const sp = await searchParams;
  const atelier = sp.atelier ?? "";

  const today = new Date();
  const todayIso = isoDate(today);
  const startMon = mondayOf(today);
  const weeks = Array.from({ length: 6 }, (_, w) => {
    const mon = addDays(startMon, w * 7);
    const dayIsos = Array.from({ length: 7 }, (_, i) => isoDate(addDays(mon, i)));
    return { mon: isoDate(mon), num: isoWeekNumber(mon), dayIsos };
  });
  const horizonIsos = weeks.flatMap((w) => w.dayIsos);
  const lastIso = horizonIsos[horizonIsos.length - 1];

  const supabase = await getServerClient();
  const [{ data: lignesD }, { data: quartsD }, { data: jqD }, { data: ovD }, { data: pqOffD }, { data: persD }, { data: plD }, { data: matD }, { data: atD }] =
    await Promise.all([
      supabase.from("ligne").select("id, nom, atelier_id, poste(id, nom, actif, effectif_requis)").eq("actif", true).returns<LigneRow[]>(),
      supabase.from("quart").select("code").returns<{ code: string }[]>(),
      supabase.from("jour_quart").select("jour, quart_code, actif").in("jour", horizonIsos).returns<{ jour: string; quart_code: string; actif: boolean }[]>(),
      supabase.from("ouverture_quart").select("jour, ligne_id, quart_code, ouverte").in("jour", horizonIsos).returns<{ jour: string; ligne_id: string; quart_code: string; ouverte: boolean }[]>(),
      supabase.from("poste_quart").select("poste_id, quart_code").eq("actif", false).returns<{ poste_id: string; quart_code: string }[]>(),
      supabase.from("personne").select("id, nom, prenom, type_contrat, date_fin").eq("statut", "ACTIF").returns<Personne[]>(),
      supabase.from("placement").select("personne_id, jour, motif_absence_id").in("jour", horizonIsos).returns<Placement[]>(),
      supabase.from("matrice").select("personne_id, poste_id, niveau_actuel").gte("niveau_actuel", SEUIL).returns<Mat[]>(),
      supabase.from("atelier").select("id, nom").eq("actif", true).order("nom").returns<{ id: string; nom: string }[]>(),
    ]);

  const quarts = (quartsD ?? []).map((q) => q.code);
  const pqOff = new Set((pqOffD ?? []).map((r) => `${r.poste_id}:${r.quart_code}`));
  const actMap = new Map<string, boolean>();
  for (const r of jqD ?? []) actMap.set(`${r.quart_code}:${r.jour}`, r.actif);
  const ouvMap = new Map<string, boolean>();
  for (const r of ovD ?? []) ouvMap.set(`${r.quart_code}:${r.ligne_id}:${r.jour}`, r.ouverte);
  const quartActif = (q: string, iso: string) => actMap.get(`${q}:${iso}`) ?? false;
  const ligneOuverte = (lid: string, q: string, iso: string) => ouvMap.get(`${q}:${lid}:${iso}`) ?? true;
  const lignes = (lignesD ?? []).filter((l) => !atelier || l.atelier_id === atelier);
  const scopedPosteIds = new Set(lignes.flatMap((l) => (l.poste ?? []).filter((p) => p.actif).map((p) => p.id)));
  const besoinJour = (iso: string) => {
    let b = 0;
    for (const q of quarts) {
      if (!quartActif(q, iso)) continue;
      for (const l of lignes) {
        if (!ligneOuverte(l.id, q, iso)) continue;
        for (const p of l.poste ?? []) if (p.actif && !pqOff.has(`${p.id}:${q}`)) b += p.effectif_requis ?? 0;
      }
    }
    return b;
  };

  const active = persD ?? [];
  const activeIds = new Set(active.map((p) => p.id));
  const activeCount = active.length;
  const persNom = (id: string) => {
    const p = active.find((x) => x.id === id);
    return p ? `${p.nom} ${p.prenom}` : "?";
  };

  // Absences connues (saisies) par jour
  const placements = plD ?? [];
  const absByDay = new Map<string, string[]>();
  for (const r of placements) if (r.motif_absence_id && r.jour >= todayIso) (absByDay.get(r.jour) ?? absByDay.set(r.jour, []).get(r.jour)!).push(persNom(r.personne_id));
  const contractEndedBy = (iso: string) => active.filter((p) => p.date_fin && p.date_fin < iso).length;

  // ---- 4.1 Capacite vs charge a venir (par semaine) ----
  const semaines = weeks.map((w) => {
    let besoinTot = 0;
    let tension = 0;
    let margeMin = Infinity;
    for (const iso of w.dayIsos) {
      const besoin = besoinJour(iso);
      if (besoin <= 0) continue;
      besoinTot += besoin;
      const dispo = activeCount - (absByDay.get(iso)?.length ?? 0) - contractEndedBy(iso);
      const marge = dispo - besoin;
      if (marge < 0) tension++;
      margeMin = Math.min(margeMin, marge);
    }
    return { ...w, besoinTot, tension, margeMin: margeMin === Infinity ? null : margeMin };
  });
  const joursTension = semaines.reduce((s, w) => s + w.tension, 0);

  // ---- 4.2 Impact des absences connues (14 prochains jours) ----
  const prochainesAbsences = horizonIsos
    .filter((iso) => iso >= todayIso && (absByDay.get(iso)?.length ?? 0) > 0)
    .slice(0, 14)
    .map((iso) => ({ iso, noms: absByDay.get(iso)!, besoin: besoinJour(iso), dispo: activeCount - (absByDay.get(iso)?.length ?? 0) - contractEndedBy(iso) }));

  // ---- 4.3 Impact des fins de contrat sur la polyvalence ----
  const compByPoste = new Map<string, Set<string>>();
  for (const r of matD ?? []) if (activeIds.has(r.personne_id) && scopedPosteIds.has(r.poste_id)) (compByPoste.get(r.poste_id) ?? compByPoste.set(r.poste_id, new Set()).get(r.poste_id)!).add(r.personne_id);
  const posteNom = new Map<string, string>();
  for (const l of lignes) for (const p of l.poste ?? []) if (p.actif) posteNom.set(p.id, p.nom);
  const compByPers = new Map<string, string[]>();
  for (const r of matD ?? []) if (activeIds.has(r.personne_id) && scopedPosteIds.has(r.poste_id)) (compByPers.get(r.personne_id) ?? compByPers.set(r.personne_id, []).get(r.personne_id)!).push(r.poste_id);

  const departs = active
    .filter((p) => p.type_contrat !== "CDI" && p.date_fin && p.date_fin >= todayIso && p.date_fin <= lastIso)
    .map((p) => {
      const postesRisque = (compByPers.get(p.id) ?? [])
        .filter((pid) => (compByPoste.get(pid)?.size ?? 0) - 1 <= 1)
        .map((pid) => ({ nom: posteNom.get(pid) ?? "?", restant: (compByPoste.get(pid)?.size ?? 0) - 1 }));
      return { personne: `${p.nom} ${p.prenom}`, date: p.date_fin!, postesRisque };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const postesMisEnRisque = new Set(departs.flatMap((d) => d.postesRisque.map((r) => r.nom))).size;

  return (
    <>
      <AppHeader role={profile.role} active="/bilans" />
      <div className="container" style={{ maxWidth: 1200 }}>
        <div className="report-head">
          <div>
            <h1>Anticipation</h1>
            <div className="sub">Horizon 6 semaines (jusqu&apos;au {fmtDate(lastIso)}) · {activeCount} personnes actives</div>
          </div>
          <div className="noprint" style={{ display: "flex", gap: 8 }}>
            <Link href="/bilans" className="navlink">&larr; Cockpit</Link>
            <PrintButton />
          </div>
        </div>

        <ReportAtelierFilter ateliers={atD ?? []} atelier={atelier} />

        <div className="kpi-grid">
          <div className={`kpi ${joursTension > 0 ? "danger" : "ok"}`}><div className="v">{joursTension}</div><div className="l">Jours en tension</div><div className="s">capacité &lt; besoin (6 sem.)</div></div>
          <div className={`kpi ${prochainesAbsences.length > 0 ? "warn" : "ok"}`}><div className="v">{prochainesAbsences.length}</div><div className="l">Jours avec absences saisies</div></div>
          <div className={`kpi ${postesMisEnRisque > 0 ? "danger" : "ok"}`}><div className="v">{postesMisEnRisque}</div><div className="l">Postes mis en risque</div><div className="s">par fins de contrat</div></div>
        </div>

        {/* 4.1 Capacite vs charge */}
        <div className="report-section">
          <h2>Capacité vs charge à venir</h2>
          <div className="card">
            <table>
              <thead><tr><th>Semaine</th><th style={{ textAlign: "center" }}>Besoin (slots)</th><th style={{ textAlign: "center" }}>Marge mini / jour</th><th style={{ textAlign: "center" }}>Jours en tension</th><th style={{ textAlign: "right" }}>État</th></tr></thead>
              <tbody>
                {semaines.map((w) => (
                  <tr key={w.mon}>
                    <td><strong>S{w.num}</strong> <span className="muted">· {fmtDate(w.mon)}</span></td>
                    <td style={{ textAlign: "center" }}>{w.besoinTot || <span className="muted">non planifié</span>}</td>
                    <td style={{ textAlign: "center", fontWeight: 700, color: w.margeMin !== null && w.margeMin < 0 ? "var(--danger)" : "var(--ok)" }}>{w.margeMin === null ? "—" : w.margeMin > 0 ? `+${w.margeMin}` : w.margeMin}</td>
                    <td style={{ textAlign: "center" }}>{w.tension || "—"}</td>
                    <td style={{ textAlign: "right" }}>{w.besoinTot === 0 ? <span className="muted">—</span> : w.tension > 0 ? <span className="rbadge danger">tension</span> : <span className="rbadge ok">ok</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted" style={{ marginTop: 6 }}>
              Besoin = ordonnancement (0 si la semaine n&apos;est pas encore initialisée). Capacité = actifs − absences déjà saisies − fins de contrat passées.
            </p>
          </div>
        </div>

        {/* 4.2 Absences connues */}
        <div className="report-section">
          <h2>Impact des absences connues</h2>
          <div className="card">
            {prochainesAbsences.length === 0 ? <p className="muted">Aucune absence saisie sur l&apos;horizon.</p> : (
              <table>
                <thead><tr><th>Jour</th><th>Absents</th><th style={{ textAlign: "center" }}>Dispo / besoin</th></tr></thead>
                <tbody>
                  {prochainesAbsences.map((a) => (
                    <tr key={a.iso}>
                      <td>{fmtDate(a.iso)}</td>
                      <td>{a.noms.join(", ")}</td>
                      <td style={{ textAlign: "center" }}>{a.besoin > 0 ? <span className={`rbadge ${a.dispo < a.besoin ? "danger" : "ok"}`}>{a.dispo} / {a.besoin}</span> : <span className="muted">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* 4.3 Impact fins de contrat */}
        <div className="report-section">
          <h2>Impact des fins de contrat sur la polyvalence</h2>
          <div className="card">
            {departs.length === 0 ? <p className="muted">Aucune fin de contrat sur l&apos;horizon.</p> : (
              <table>
                <thead><tr><th>Personne</th><th style={{ textAlign: "center" }}>Fin</th><th>Postes mis en risque (relève restante)</th></tr></thead>
                <tbody>
                  {departs.map((d, i) => (
                    <tr key={i}>
                      <td>{d.personne}</td>
                      <td style={{ textAlign: "center" }}><span className="rbadge warn">{fmtDate(d.date)}</span></td>
                      <td>
                        {d.postesRisque.length === 0 ? <span className="muted">aucun (relève suffisante)</span> : d.postesRisque.map((r, k) => (
                          <span key={k} className={`rbadge ${r.restant <= 0 ? "danger" : "warn"}`} style={{ marginRight: 6 }}>{r.nom} ({r.restant <= 0 ? "0 relève" : "1 restant"})</span>
                        ))}
                      </td>
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
