import Link from "next/link";
import { getServerClient } from "@/lib/supabase-server";
import AppHeader from "@/components/AppHeader";
import PrintButton from "@/components/PrintButton";
import Bars from "@/app/bilans/Bars";
import ReportAtelierFilter from "@/app/bilans/ReportAtelierFilter";
import { requireModule } from "@/lib/permissions";
import { isoDate, addDays } from "@/lib/week";

type Named = { id: string; nom: string; prenom?: string };
type LigneRow = { id: string; nom: string; atelier_id: string | null; poste: { id: string; nom: string; actif: boolean }[] };
type Mat = { personne_id: string; poste_id: string; niveau_actuel: number; niveau_cible: number };
type Comp = { id: string; nom: string; a_recycler: boolean };
type PC = { personne_id: string; competence_id: string; date_expiration: string | null };

const SEUIL = 2;
const fmtDate = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");

export default async function PolyvalenceReport({ searchParams }: { searchParams: Promise<{ atelier?: string }> }) {
  const { profile } = await requireModule("matrice", "read");
  const sp = await searchParams;
  const atelier = sp.atelier ?? "";
  const todayIso = isoDate(new Date());
  const in30 = isoDate(addDays(new Date(), 30));
  const in60 = isoDate(addDays(new Date(), 60));

  const supabase = await getServerClient();
  const [{ data: persD }, { data: lignesD }, { data: matD }, { data: compD }, { data: pcD }, { data: atD }] = await Promise.all([
    supabase.from("personne").select("id, nom, prenom").eq("statut", "ACTIF").returns<Named[]>(),
    supabase.from("ligne").select("id, nom, atelier_id, poste(id, nom, actif)").eq("actif", true).order("nom").returns<LigneRow[]>(),
    supabase.from("matrice").select("personne_id, poste_id, niveau_actuel, niveau_cible").returns<Mat[]>(),
    supabase.from("competence").select("id, nom, a_recycler").eq("actif", true).returns<Comp[]>(),
    supabase.from("personne_competence").select("personne_id, competence_id, date_expiration").returns<PC[]>(),
    supabase.from("atelier").select("id, nom").eq("actif", true).order("nom").returns<{ id: string; nom: string }[]>(),
  ]);

  const active = persD ?? [];
  const activeIds = new Set(active.map((p) => p.id));
  const persNom = (id: string) => {
    const p = active.find((x) => x.id === id);
    return p ? `${p.nom} ${p.prenom ?? ""}`.trim() : "?";
  };

  // Postes du perimetre (filtre atelier via ligne.atelier_id).
  const lignesScoped = (lignesD ?? []).filter((l) => !atelier || l.atelier_id === atelier);
  const postes = lignesScoped.flatMap((l) =>
    (l.poste ?? []).filter((p) => p.actif).map((p) => ({ id: p.id, nom: p.nom, ligne: l.nom }))
  );
  const posteNom = new Map(postes.map((p) => [p.id, p]));
  const scopedPosteIds = new Set(postes.map((p) => p.id));

  // Matrice cote personnes actives ET postes du perimetre.
  const mat = (matD ?? []).filter((r) => activeIds.has(r.personne_id) && scopedPosteIds.has(r.poste_id));

  // ---- 2.1 Postes fragiles ----
  const compByPoste = new Map<string, string[]>(); // poste -> noms competents (>= seuil)
  for (const r of mat) {
    if (r.niveau_actuel >= SEUIL) (compByPoste.get(r.poste_id) ?? compByPoste.set(r.poste_id, []).get(r.poste_id)!).push(persNom(r.personne_id));
  }
  const postesEval = postes.map((p) => ({ ...p, noms: compByPoste.get(p.id) ?? [] }));
  const fragiles = postesEval.filter((p) => p.noms.length <= 1).sort((a, b) => a.noms.length - b.noms.length);
  const sansReleve = fragiles.filter((p) => p.noms.length === 0).length;

  // ---- 2.2 Ecart actuel -> cible (par poste) ----
  const ecarts = postes
    .map((p) => {
      const rows = mat.filter((r) => r.poste_id === p.id);
      const actuel = rows.filter((r) => r.niveau_actuel >= SEUIL).length;
      const cible = rows.filter((r) => r.niveau_cible >= SEUIL).length;
      return { label: p.nom, ligne: p.ligne, actuel, cible, n: Math.max(0, cible - actuel) };
    })
    .filter((e) => e.n > 0)
    .sort((a, b) => b.n - a.n);
  const ecartTotal = ecarts.reduce((s, e) => s + e.n, 0);

  // ---- 2.3 Plan de montee en competence ----
  const fragileSet = new Set(fragiles.map((p) => p.id));
  const gaps = mat
    .filter((r) => r.niveau_actuel < r.niveau_cible)
    .map((r) => ({
      personne: persNom(r.personne_id),
      poste: posteNom.get(r.poste_id)?.nom ?? "?",
      ligne: posteNom.get(r.poste_id)?.ligne ?? "",
      actuel: r.niveau_actuel,
      cible: r.niveau_cible,
      gap: r.niveau_cible - r.niveau_actuel,
      prio: fragileSet.has(r.poste_id),
    }))
    .sort((a, b) => Number(b.prio) - Number(a.prio) || b.gap - a.gap);

  // ---- 2.4 Habilitations a echeance ----
  const recyclables = new Set((compD ?? []).filter((c) => c.a_recycler).map((c) => c.id));
  const compNom = new Map((compD ?? []).map((c) => [c.id, c.nom]));
  const echeances = (pcD ?? [])
    .filter((r) => activeIds.has(r.personne_id) && recyclables.has(r.competence_id) && r.date_expiration && r.date_expiration <= in60)
    .map((r) => ({
      personne: persNom(r.personne_id),
      competence: compNom.get(r.competence_id) ?? "?",
      date: r.date_expiration!,
      statut: r.date_expiration! < todayIso ? "expiree" : r.date_expiration! <= in30 ? "urgent" : "proche",
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const echeancesCritiques = echeances.filter((e) => e.statut !== "proche").length;

  // ---- 2.5 Polyvalence par personne ----
  const masteredBy = new Map<string, number>();
  for (const r of mat) if (r.niveau_actuel >= SEUIL) masteredBy.set(r.personne_id, (masteredBy.get(r.personne_id) ?? 0) + 1);
  const polyParPers = active
    .map((p) => ({ id: p.id, label: `${p.nom} ${p.prenom ?? ""}`.trim(), n: masteredBy.get(p.id) ?? 0 }))
    .sort((a, b) => a.n - b.n);
  const polyMoy = active.length ? Math.round((polyParPers.reduce((s, p) => s + p.n, 0) / active.length) * 10) / 10 : 0;
  const moinsPoly = polyParPers.slice(0, 10);

  return (
    <>
      <AppHeader role={profile.role} active="/bilans" />
      <div className="container" style={{ maxWidth: 1500 }}>
        <div className="report-head">
          <div>
            <h1>Polyvalence &amp; compétences</h1>
            <div className="sub">Compétent = niveau ≥ {SEUIL} · {active.length} personnes actives · {postes.length} postes actifs</div>
          </div>
          <div className="noprint" style={{ display: "flex", gap: 8 }}>
            <Link href="/bilans" className="navlink">&larr; Cockpit</Link>
            <Link href="/matrice" className="navlink">Saisie matrice</Link>
            <PrintButton />
          </div>
        </div>

        <ReportAtelierFilter ateliers={atD ?? []} atelier={atelier} />

        <div className="kpi-grid">
          <div className={`kpi ${fragiles.length > 0 ? "warn" : "ok"}`}><div className="v">{fragiles.length}</div><div className="l">Postes fragiles</div><div className="s">≤ 1 personne compétente</div></div>
          <div className={`kpi ${sansReleve > 0 ? "danger" : "ok"}`}><div className="v">{sansReleve}</div><div className="l">Postes sans relève</div></div>
          <div className={`kpi ${ecartTotal > 0 ? "warn" : "ok"}`}><div className="v">{ecartTotal}</div><div className="l">Écart à combler</div><div className="s">compétences manquantes vs cible</div></div>
          <div className={`kpi ${echeancesCritiques > 0 ? "danger" : "ok"}`}><div className="v">{echeances.length}</div><div className="l">Habilitations à échéance</div><div className="s">{echeancesCritiques} critique(s)</div></div>
          <div className="kpi accent"><div className="v">{polyMoy}</div><div className="l">Polyvalence moyenne</div><div className="s">postes maîtrisés / personne</div></div>
        </div>

        {/* 2.1 Postes fragiles */}
        <div className="report-section">
          <h2>Postes fragiles (risque mono-compétence)</h2>
          {fragiles.length === 0 ? (
            <p className="muted">Aucun poste fragile : chaque poste a au moins 2 personnes compétentes.</p>
          ) : (
            <div className="card">
              <table>
                <thead><tr><th>Poste</th><th>Ligne</th><th>Personne compétente</th><th style={{ textAlign: "right" }}>Couverture</th></tr></thead>
                <tbody>
                  {fragiles.map((p) => (
                    <tr key={p.id}>
                      <td><strong>{p.nom}</strong></td>
                      <td className="muted">{p.ligne}</td>
                      <td>{p.noms.length ? p.noms.join(", ") : <span className="muted">—</span>}</td>
                      <td style={{ textAlign: "right" }}><span className={`rbadge ${p.noms.length === 0 ? "danger" : "warn"}`}>{p.noms.length === 0 ? "aucune relève" : "1 personne"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 2.2 Ecart cible */}
        <div className="report-section">
          <h2>Écart polyvalence actuel → cible</h2>
          <div className="card">
            {ecarts.length === 0 ? <p className="muted">Tous les objectifs de polyvalence sont atteints.</p> : (
              <Bars items={ecarts.map((e) => ({ label: e.label, n: e.n, sub: `${e.actuel}/${e.cible}` }))} accent="#d97706" />
            )}
          </div>
        </div>

        {/* 2.3 Plan de montee en competence */}
        <div className="report-section">
          <h2>Plan de montée en compétence <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>({gaps.length} écarts individuels)</span></h2>
          <div className="card" style={{ overflowX: "auto" }}>
            {gaps.length === 0 ? <p className="muted">Aucun écart individuel : tous au niveau cible.</p> : (
              <table>
                <thead><tr><th>Personne</th><th>Poste</th><th>Ligne</th><th style={{ textAlign: "center" }}>Actuel → Cible</th><th style={{ textAlign: "right" }}>Priorité</th></tr></thead>
                <tbody>
                  {gaps.slice(0, 25).map((g, i) => (
                    <tr key={i}>
                      <td>{g.personne}</td>
                      <td><strong>{g.poste}</strong></td>
                      <td className="muted">{g.ligne}</td>
                      <td style={{ textAlign: "center" }}>{g.actuel} → {g.cible}</td>
                      <td style={{ textAlign: "right" }}>{g.prio && <span className="rbadge danger">poste fragile</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {gaps.length > 25 && <p className="muted" style={{ marginTop: 6 }}>… et {gaps.length - 25} autres.</p>}
          </div>
        </div>

        {/* 2.4 Habilitations a echeance */}
        <div className="report-section">
          <h2>Habilitations à recycler — échéances (60 jours)</h2>
          <div className="card">
            {echeances.length === 0 ? <p className="muted">Aucune habilitation à recycler dans les 60 jours.</p> : (
              <table>
                <thead><tr><th>Personne</th><th>Habilitation</th><th style={{ textAlign: "right" }}>Expiration</th></tr></thead>
                <tbody>
                  {echeances.map((e, i) => (
                    <tr key={i}>
                      <td>{e.personne}</td>
                      <td>{e.competence}</td>
                      <td style={{ textAlign: "right" }}>
                        <span className={`rbadge ${e.statut === "expiree" ? "danger" : e.statut === "urgent" ? "danger" : "warn"}`}>
                          {e.statut === "expiree" ? "expirée · " : ""}{fmtDate(e.date)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* 2.5 Polyvalence par personne */}
        <div className="report-section">
          <h2>Personnes à développer (polyvalence la plus faible)</h2>
          <div className="card">
            <Bars items={moinsPoly} accent="#7c3aed" suffix=" postes" />
          </div>
        </div>
      </div>
    </>
  );
}
