import Link from "next/link";
import { getServerClient } from "@/lib/supabase-server";
import AppHeader from "@/components/AppHeader";
import PlanningNav from "@/components/PlanningNav";
import {
  parseMonday,
  weekDays,
  isoDate,
  addDays,
  mondayOf,
  isoWeekNumber,
} from "@/lib/week";
import { requireModule } from "@/lib/permissions";
import PlanningFilters from "./PlanningFilters";
import AtelierFilter from "./AtelierFilter";
import QuartSelector from "./QuartSelector";
import PlanningGrid from "./PlanningGrid";

type PosteRow = {
  id: string;
  nom: string;
  nom_court: string | null;
  actif: boolean;
  effectif_requis: number;
  niveau_min_requis: number;
  categorie: string;
};
type LigneRow = { id: string; nom: string; atelier: { id: string; nom: string } | null; poste: PosteRow[] };
type Equipe = { id: string; nom: string; couleur: string; quart_fixe: string | null };
type Quart = { code: string; libelle: string };
type Personne = { id: string; nom: string; prenom: string; equipe_id: string | null };
type Placement = {
  personne_id: string;
  jour: string;
  poste_id: string | null;
  motif_absence_id: string | null;
  non_travaille: boolean;
  quart_code: string | null;
};
type MatRow = { personne_id: string; poste_id: string; niveau_actuel: number };
type Motif = { id: string; code_court: string; libelle: string; couleur: string };

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ equipe?: string; semaine?: string; quart?: string; atelier?: string }>;
}) {
  const { profile } = await requireModule("planning", "read");

  const sp = await searchParams;
  const center = parseMonday(sp.semaine);
  const centerIso = isoDate(center);
  const equipe = sp.equipe ?? "";
  const atelier = sp.atelier ?? "";

  const weekMondays = [addDays(center, -7), center, addDays(center, 7)];
  const todayMondayIso = isoDate(mondayOf());
  const rawDays = weekMondays.flatMap((wm, wi) =>
    weekDays(wm).map((d, di) => ({ ...d, firstOfWeek: di === 0, wi }))
  );
  const allIsos = rawDays.map((d) => d.iso);

  const supabase = await getServerClient();
  const isAdmin = profile.role === "admin";
  // Vague 1 : referentiel + personnes + perimetre chef, tout independant du calcul
  // d'ouverture qui suit. allActive sert aux indicateurs (tout le quart, toutes equipes).
  const [
    { data: equipesD },
    { data: lignesD },
    { data: motifsD },
    { data: quartsD },
    { data: allActiveD },
    { data: chefData },
    { data: pqOffD },
  ] = await Promise.all([
    supabase.from("equipe").select("id, nom, couleur, quart_fixe").eq("actif", true).order("nom").returns<Equipe[]>(),
    supabase
      .from("ligne")
      .select("id, nom, atelier:atelier_id(id, nom), poste(id, nom, nom_court, actif, effectif_requis, niveau_min_requis, categorie)")
      .eq("actif", true)
      .order("nom")
      .returns<LigneRow[]>(),
    supabase
      .from("motif_absence")
      .select("id, code_court, libelle, couleur")
      .eq("actif", true)
      .order("libelle")
      .returns<Motif[]>(),
    supabase.from("quart").select("code, libelle").order("ordre").returns<Quart[]>(),
    supabase.from("personne").select("id, nom, prenom, equipe_id").eq("statut", "ACTIF").order("nom").returns<Personne[]>(),
    isAdmin
      ? Promise.resolve({ data: [] as { equipe_id: string }[] })
      : supabase.from("equipe_chef").select("equipe_id").eq("app_user_id", profile.authId).returns<{ equipe_id: string }[]>(),
    supabase.from("poste_quart").select("poste_id, quart_code").eq("actif", false).returns<{ poste_id: string; quart_code: string }[]>(),
  ]);
  const motifs = motifsD ?? [];
  const quarts = quartsD ?? [];
  const quartCodes = quarts.map((q) => q.code);

  // Quart selectionne : ?quart, sinon quart fixe de l'equipe, sinon rotation de la
  // semaine, sinon "matin".
  let quart = sp.quart && quartCodes.includes(sp.quart) ? sp.quart : "";
  if (!quart && equipe) {
    const eqRow = (equipesD ?? []).find((e) => e.id === equipe);
    if (eqRow?.quart_fixe && quartCodes.includes(eqRow.quart_fixe)) {
      quart = eqRow.quart_fixe;
    } else {
      const { data: rot } = await supabase
        .from("equipe_quart_semaine")
        .select("quart_code")
        .eq("equipe_id", equipe)
        .eq("semaine", centerIso)
        .maybeSingle<{ quart_code: string }>();
      if (rot?.quart_code) quart = rot.quart_code;
    }
  }
  if (!quart) quart = quartCodes.includes("matin") ? "matin" : quartCodes[0] ?? "matin";

  const groupsAll = (lignesD ?? [])
    .map((l) => ({
      ligneNom: l.nom,
      ligneId: l.id,
      atelierId: l.atelier?.id ?? null,
      postes: [...(l.poste ?? [])].filter((p) => p.actif).sort((a, b) => a.nom.localeCompare(b.nom)),
    }))
    .filter((g) => g.postes.length > 0);

  // Ateliers presents (lignes actives ayant au moins un poste actif) -> segments de filtre.
  const ateliersMap = new Map<string, string>();
  for (const g of groupsAll) {
    const l = (lignesD ?? []).find((x) => x.id === g.ligneId);
    if (l?.atelier) ateliersMap.set(l.atelier.id, l.atelier.nom);
  }
  const ateliers = [...ateliersMap]
    .map(([id, nom]) => ({ id, label: nom }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // Etiquettes de tous les postes (pour afficher proprement un placement hors atelier filtre).
  const posteLabelAll: Record<string, string> = {};
  for (const g of groupsAll)
    for (const p of g.postes) posteLabelAll[p.id] = (p.nom_court || p.nom).slice(0, 6);

  // Filtre poste x quart : un poste desactive pour le quart affiche n'apparait pas
  // (et n'est pas compte). Defaut actif : pqOff ne contient que les desactivations.
  const pqOff = new Set((pqOffD ?? []).map((r) => `${r.poste_id}:${r.quart_code}`));
  const posteActifQuart = (pid: string) => !pqOff.has(`${pid}:${quart}`);

  const groups = (atelier ? groupsAll.filter((g) => g.atelierId === atelier) : groupsAll)
    .map((g) => ({ ...g, postes: g.postes.filter((p) => posteActifQuart(p.id)) }))
    .filter((g) => g.postes.length > 0);

  const lineEffectif: Record<string, number> = {};
  for (const g of groups)
    lineEffectif[g.ligneId] = g.postes.reduce((s, p) => s + (p.effectif_requis ?? 0), 0);

  // Ouverture par quart selectionne
  const [{ data: ouv }, { data: jq }] = await Promise.all([
    supabase
      .from("ouverture_quart")
      .select("jour, ligne_id, ouverte")
      .eq("quart_code", quart)
      .in("jour", allIsos)
      .returns<{ jour: string; ligne_id: string; ouverte: boolean }[]>(),
    supabase
      .from("jour_quart")
      .select("jour, actif")
      .eq("quart_code", quart)
      .in("jour", allIsos)
      .returns<{ jour: string; actif: boolean }[]>(),
  ]);
  const ouvMap = new Map<string, boolean>();
  for (const r of ouv ?? []) ouvMap.set(`${r.jour}:${r.ligne_id}`, r.ouverte);
  const actMap = new Map<string, boolean>();
  for (const r of jq ?? []) actMap.set(r.jour, r.actif);

  const quartActif = (iso: string) => (actMap.has(iso) ? actMap.get(iso)! : false);
  const lineOpen = (iso: string, ligneId: string) =>
    quartActif(iso) ? (ouvMap.has(`${iso}:${ligneId}`) ? ouvMap.get(`${iso}:${ligneId}`)! : true) : false;

  const visible = rawDays
    .map((d) => {
      const openIds = quartActif(d.iso) ? groups.filter((g) => lineOpen(d.iso, g.ligneId)).map((g) => g.ligneId) : [];
      const besoin = openIds.reduce((s, lid) => s + (lineEffectif[lid] ?? 0), 0);
      return { ...d, open: openIds.length > 0, besoin, openIds };
    })
    .filter((d) => d.open);

  const openByIso: Record<string, string[]> = {};
  for (const d of visible) openByIso[d.iso] = d.openIds;

  const days = visible.map((d) => ({ iso: d.iso, nom: d.nom, num: d.num, firstOfWeek: d.firstOfWeek }));
  const besoin = visible.map((d) => d.besoin);
  const visIsos = visible.map((d) => d.iso);

  const weekBlocks: { num: number; span: number; year: number; isCurrent: boolean }[] = [];
  for (let wi = 0; wi < 3; wi++) {
    const span = visible.filter((d) => d.wi === wi).length;
    if (span > 0)
      weekBlocks.push({
        num: isoWeekNumber(weekMondays[wi]),
        year: weekMondays[wi].getFullYear(),
        span,
        isCurrent: isoDate(weekMondays[wi]) === todayMondayIso,
      });
  }
  const seenWeek = new Set<number>();
  visible.forEach((d, idx) => {
    days[idx].firstOfWeek = !seenWeek.has(d.wi);
    seenWeek.add(d.wi);
  });

  // Personnes actives recuperees en vague 1. On n'affiche que l'equipe filtree
  // (lignes), mais les indicateurs Present/Delta/Alertes comptent TOUT le quart.
  const allActive = allActiveD ?? [];
  const allIds = allActive.map((p) => p.id);

  // Filtre souple par atelier : on n'affiche que les personnes affectees a l'atelier
  // choisi (best-effort : colonne atelier_id ajoutee en 0020 ; si absente -> map vide).
  // Non bloquant : une personne reste placable sur n'importe quel poste.
  const persAtelier = new Map<string, string | null>();
  if (atelier && allIds.length) {
    const { data: paData, error: paErr } = await supabase
      .from("personne")
      .select("id, atelier_id")
      .in("id", allIds)
      .returns<{ id: string; atelier_id: string | null }[]>();
    if (!paErr) for (const r of paData ?? []) persAtelier.set(r.id, r.atelier_id);
  }

  const displayed = allActive.filter(
    (p) => (!equipe || p.equipe_id === equipe) && (!atelier || persAtelier.get(p.id) === atelier)
  );
  const displayedSet = new Set(displayed.map((p) => p.id));

  // Une affectation sur poste n'apparait que pour le quart courant ; une absence/NT
  // vaut pour tous les quarts. matchQuart gere les anciens placements (quart null -> matin).
  const matchQuart = (qc: string | null) => (qc ? qc === quart : quart === (quartCodes[0] ?? "matin"));

  const initial: Record<string, string> = {};
  const otherByCell: Record<string, string> = {}; // place sur un autre quart -> code du quart
  const matrice: Record<string, number> = {};
  const exceptions: Record<string, { debut: string; fin: string; motif: string }> = {};
  if (allIds.length && visIsos.length) {
    const [{ data: pl }, { data: mat }, { data: exc }] = await Promise.all([
      supabase
        .from("placement")
        .select("personne_id, jour, poste_id, motif_absence_id, non_travaille, quart_code")
        .in("jour", visIsos)
        .in("personne_id", allIds)
        .returns<Placement[]>(),
      supabase
        .from("matrice")
        .select("personne_id, poste_id, niveau_actuel")
        .in("personne_id", allIds)
        .returns<MatRow[]>(),
      supabase
        .from("horaire_exception")
        .select("personne_id, jour, debut, fin, motif")
        .in("jour", visIsos)
        .in("personne_id", allIds)
        .returns<{ personne_id: string; jour: string; debut: string | null; fin: string | null; motif: string | null }[]>(),
    ]);
    for (const r of pl ?? []) {
      const k = `${r.personne_id}:${r.jour}`;
      if (r.non_travaille) initial[k] = "X";
      else if (r.motif_absence_id) initial[k] = `m:${r.motif_absence_id}`;
      else if (r.poste_id && matchQuart(r.quart_code)) initial[k] = r.poste_id;
      else if (r.poste_id && displayedSet.has(r.personne_id)) otherByCell[k] = r.quart_code ?? (quartCodes[0] ?? "matin");
    }
    for (const r of mat ?? []) matrice[`${r.personne_id}:${r.poste_id}`] = r.niveau_actuel;
    for (const r of exc ?? [])
      exceptions[`${r.personne_id}:${r.jour}`] = { debut: r.debut ?? "", fin: r.fin ?? "", motif: r.motif ?? "" };
  }

  // Temps partiel (best-effort, colonnes 0025). Calcul serveur :
  //  - tpBlocked : demi-journees non travaillees -> case "TP" pour le quart courant.
  //  - tpRedirect : demi-journee FIXE (matin/aprem) -> "-> Mat/Apr" sur les autres quarts.
  const tpBlocked: Record<string, boolean> = {};
  const tpRedirect: Record<string, string> = {};
  if (allIds.length) {
    const { data: tpData, error: tpErr } = await supabase
      .from("personne")
      .select("id, temps_partiel, tp_config")
      .in("id", allIds)
      .returns<{ id: string; temps_partiel: boolean; tp_config: { demi?: { mode: string }; off?: Record<string, string[]> } | null }[]>();
    if (!tpErr) {
      const isoDow = (iso: string) => {
        const d = new Date(iso + "T00:00").getDay();
        return d === 0 ? 7 : d;
      };
      const blocked = (off: string[]) => {
        if (!off || !off.length) return false;
        const full = off.includes("matin") && off.includes("aprem");
        if (quart === "matin") return off.includes("matin");
        if (quart === "apres_midi") return off.includes("aprem");
        return full; // journee / nuit : seulement si journee entiere non travaillee
      };
      for (const r of tpData ?? []) {
        if (!r.temps_partiel || !displayedSet.has(r.id)) continue;
        const cfg = r.tp_config ?? {};
        const herQuart = cfg.demi?.mode === "matin" ? "matin" : cfg.demi?.mode === "aprem" ? "apres_midi" : null;
        const herLabel = herQuart === "matin" ? "Mat" : "Apr";
        for (const iso of visIsos) {
          const dow = String(isoDow(iso));
          if (cfg.off && blocked(cfg.off[dow] ?? [])) tpBlocked[`${r.id}:${iso}`] = true;
          if (herQuart && quart !== herQuart) tpRedirect[`${r.id}:${iso}`] = herLabel;
        }
      }
    }
  }

  // Perimetre chef recupere en vague 1.
  const chefEquipes = new Set((chefData ?? []).map((r) => r.equipe_id));

  const equipeColor: Record<string, string> = {};
  for (const e of equipesD ?? []) equipeColor[e.id] = e.couleur;

  const gridPersonnes = displayed.map((p) => ({
    id: p.id,
    label: `${p.nom} ${p.prenom}`,
    equipe_id: p.equipe_id,
    color: p.equipe_id ? equipeColor[p.equipe_id] : undefined,
    editable: isAdmin || (p.equipe_id != null && chefEquipes.has(p.equipe_id)),
  }));

  const gridGroups = groups.map((g) => ({
    ligneNom: g.ligneNom,
    ligneId: g.ligneId,
    postes: g.postes.map((p) => ({
      id: p.id,
      nom: (p.nom_court || p.nom).slice(0, 6),
      niveauMin: p.niveau_min_requis,
      effectif: p.effectif_requis,
      categorie: p.categorie,
    })),
  }));

  const quartLabel: Record<string, string> = {};
  for (const q of quarts) quartLabel[q.code] = q.libelle.slice(0, 3);

  const extra: Record<string, string> = { quart };
  if (equipe) extra.equipe = equipe;
  if (atelier) extra.atelier = atelier;

  return (
    <>
      <AppHeader role={profile.role} active="/planning" />
      <div
        className="container"
        style={{ maxWidth: 1500, margin: "0 auto", padding: "12px 24px", height: "calc(100vh - 46px)", display: "flex", flexDirection: "column", overflow: "hidden" }}
      >
        <div className="planning-top" style={{ justifyContent: "space-between" }}>
          <PlanningNav base="/planning" semaine={centerIso} extra={extra} />
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
            <PlanningFilters
              equipes={(equipesD ?? []).map((e) => ({ id: e.id, label: e.nom, couleur: e.couleur }))}
              equipe={equipe}
              semaine={centerIso}
              quart={quart}
              atelier={atelier}
            />
            <AtelierFilter
              ateliers={ateliers}
              atelier={atelier}
              equipe={equipe}
              quart={quart}
              semaine={centerIso}
            />
            <QuartSelector quarts={quarts} current={quart} equipe={equipe} semaine={centerIso} atelier={atelier} />
            <Link href="/horaires-specifiques" className="navlink" style={{ fontSize: 13, padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 8, whiteSpace: "nowrap" }}>
              🕐 Horaires spécifiques
            </Link>
            <Link href="/absences-specifiques" className="navlink" style={{ fontSize: 13, padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 8, whiteSpace: "nowrap" }}>
              🤒 Absences spécifiques
            </Link>
          </div>
        </div>
        <PlanningGrid
          key={`${equipe}|${atelier}|${quart}|${centerIso}`}
          days={days}
          weekBlocks={weekBlocks}
          todayIso={isoDate(new Date())}
          personnes={gridPersonnes}
          statIds={allIds}
          groups={gridGroups}
          openByIso={openByIso}
          motifs={motifs.map((m) => ({ id: m.id, code: m.code_court, couleur: m.couleur }))}
          besoin={besoin}
          initial={initial}
          matrice={matrice}
          quart={quart}
          otherByCell={otherByCell}
          tpBlocked={tpBlocked}
          tpRedirect={tpRedirect}
          quartLabel={quartLabel}
          posteLabelAll={posteLabelAll}
          exceptions={exceptions}
        />
      </div>
    </>
  );
}
