import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import AppHeader from "@/components/AppHeader";
import PeriodBand from "@/components/PeriodBand";
import {
  parseMonday,
  weekDays,
  isoDate,
  addDays,
  mondayOf,
  isoWeekNumber,
  defaultOpenIso,
} from "@/lib/week";
import { requireModule } from "@/lib/permissions";
import PlanningFilters from "./PlanningFilters";
import PlanningGrid from "./PlanningGrid";

type PosteRow = {
  id: string;
  nom: string;
  nom_court: string | null;
  actif: boolean;
  effectif_requis: number;
  niveau_min_requis: number;
};
type LigneRow = { id: string; nom: string; poste: PosteRow[] };
type Equipe = { id: string; nom: string };
type Personne = { id: string; nom: string; prenom: string; equipe_id: string | null };
type Placement = {
  personne_id: string;
  jour: string;
  poste_id: string | null;
  motif_absence_id: string | null;
  non_travaille: boolean;
};
type MatRow = { personne_id: string; poste_id: string; niveau_actuel: number };
type Motif = { id: string; code_court: string; libelle: string; couleur: string };

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ equipe?: string; semaine?: string }>;
}) {
  const { profile } = await requireModule("planning", "read");

  const sp = await searchParams;
  const center = parseMonday(sp.semaine);
  const centerIso = isoDate(center);
  const equipe = sp.equipe ?? "";

  const weekMondays = [addDays(center, -7), center, addDays(center, 7)];
  const todayMondayIso = isoDate(mondayOf());
  const rawDays = weekMondays.flatMap((wm, wi) =>
    weekDays(wm).map((d, di) => ({ ...d, firstOfWeek: di === 0, wi }))
  );
  const allIsos = rawDays.map((d) => d.iso);

  const supabase = await getServerClient();
  const [{ data: equipesD }, { data: lignesD }, { data: motifsD }] = await Promise.all([
    supabase.from("equipe").select("id, nom").eq("actif", true).order("nom").returns<Equipe[]>(),
    supabase
      .from("ligne")
      .select("id, nom, poste(id, nom, nom_court, actif, effectif_requis, niveau_min_requis)")
      .eq("actif", true)
      .order("nom")
      .returns<LigneRow[]>(),
    supabase
      .from("motif_absence")
      .select("id, code_court, libelle, couleur")
      .eq("actif", true)
      .order("libelle")
      .returns<Motif[]>(),
  ]);
  const motifs = motifsD ?? [];

  const groups = (lignesD ?? [])
    .map((l) => ({
      ligneNom: l.nom,
      ligneId: l.id,
      postes: [...(l.poste ?? [])].filter((p) => p.actif).sort((a, b) => a.nom.localeCompare(b.nom)),
    }))
    .filter((g) => g.postes.length > 0);

  const lineEffectif: Record<string, number> = {};
  for (const g of groups)
    lineEffectif[g.ligneId] = g.postes.reduce((s, p) => s + (p.effectif_requis ?? 0), 0);

  // Overrides explicites pour l'equipe (sinon regle par defaut : ferme le dimanche)
  const ouvOverride = new Map<string, boolean>(); // `${jour}:${ligne}` -> ouverte
  const actOverride = new Map<string, boolean>(); // jour -> actif
  if (equipe) {
    const [{ data: louv }, { data: jeq }] = await Promise.all([
      supabase
        .from("ligne_ouverture")
        .select("jour, ligne_id, ouverte")
        .in("jour", allIsos)
        .eq("equipe_id", equipe)
        .returns<{ jour: string; ligne_id: string; ouverte: boolean }[]>(),
      supabase
        .from("jour_equipe")
        .select("jour, actif")
        .in("jour", allIsos)
        .eq("equipe_id", equipe)
        .returns<{ jour: string; actif: boolean }[]>(),
    ]);
    for (const r of louv ?? []) ouvOverride.set(`${r.jour}:${r.ligne_id}`, r.ouverte);
    for (const r of jeq ?? []) actOverride.set(r.jour, r.actif);
  }

  const lineOpen = (iso: string, ligneId: string) =>
    ouvOverride.has(`${iso}:${ligneId}`) ? ouvOverride.get(`${iso}:${ligneId}`)! : defaultOpenIso(iso);
  const dayActive = (iso: string) =>
    actOverride.has(iso) ? actOverride.get(iso)! : defaultOpenIso(iso);

  // Jours visibles (au moins une ligne ouverte) + besoin
  const visible = rawDays
    .map((d) => {
      const active = dayActive(d.iso);
      const openIds = active ? groups.filter((g) => lineOpen(d.iso, g.ligneId)).map((g) => g.ligneId) : [];
      const besoin = openIds.reduce((s, lid) => s + (lineEffectif[lid] ?? 0), 0);
      return { ...d, open: openIds.length > 0, besoin, openIds };
    })
    .filter((d) => d.open);

  const openByIso: Record<string, string[]> = {};
  for (const d of visible) openByIso[d.iso] = d.openIds;

  const days = visible.map((d) => ({ iso: d.iso, nom: d.nom, num: d.num, firstOfWeek: d.firstOfWeek }));
  const besoin = visible.map((d) => d.besoin);
  const visIsos = visible.map((d) => d.iso);

  // Blocs semaine visibles
  const weekBlocks: { num: number; span: number }[] = [];
  for (let wi = 0; wi < 3; wi++) {
    const span = visible.filter((d) => d.wi === wi).length;
    if (span > 0) weekBlocks.push({ num: isoWeekNumber(weekMondays[wi]), span });
  }
  // firstOfWeek : recalc sur les jours visibles (1er jour visible de chaque semaine)
  const seenWeek = new Set<number>();
  visible.forEach((d, idx) => {
    if (!seenWeek.has(d.wi)) {
      seenWeek.add(d.wi);
      days[idx].firstOfWeek = true;
    } else {
      days[idx].firstOfWeek = false;
    }
  });

  // Personnes
  let persQ = supabase
    .from("personne")
    .select("id, nom, prenom, equipe_id")
    .eq("statut", "ACTIF")
    .order("nom");
  if (equipe) persQ = persQ.eq("equipe_id", equipe);
  const { data: persD } = await persQ.returns<Personne[]>();
  const personnes = persD ?? [];
  const persIds = personnes.map((p) => p.id);

  const initial: Record<string, string> = {};
  const matrice: Record<string, number> = {};
  if (persIds.length && visIsos.length) {
    const [{ data: pl }, { data: mat }] = await Promise.all([
      supabase
        .from("placement")
        .select("personne_id, jour, poste_id, motif_absence_id, non_travaille")
        .in("jour", visIsos)
        .in("personne_id", persIds)
        .returns<Placement[]>(),
      supabase
        .from("matrice")
        .select("personne_id, poste_id, niveau_actuel")
        .in("personne_id", persIds)
        .returns<MatRow[]>(),
    ]);
    for (const r of pl ?? [])
      initial[`${r.personne_id}:${r.jour}`] = r.non_travaille
        ? "X"
        : r.motif_absence_id
          ? `m:${r.motif_absence_id}`
          : (r.poste_id ?? "");
    for (const r of mat ?? []) matrice[`${r.personne_id}:${r.poste_id}`] = r.niveau_actuel;
  }

  // Perimetre
  const isAdmin = profile.role === "admin";
  let chefEquipes = new Set<string>();
  if (!isAdmin) {
    const { data } = await supabase
      .from("equipe_chef")
      .select("equipe_id")
      .eq("app_user_id", profile.authId)
      .returns<{ equipe_id: string }[]>();
    chefEquipes = new Set((data ?? []).map((r) => r.equipe_id));
  }

  const gridPersonnes = personnes.map((p) => ({
    id: p.id,
    label: `${p.nom} ${p.prenom}`,
    equipe_id: p.equipe_id,
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
    })),
  }));

  const extra: Record<string, string> = equipe ? { equipe } : {};
  const navHref = (s: string) => {
    const p = new URLSearchParams({ ...extra, semaine: s });
    return `/planning?${p.toString()}`;
  };

  return (
    <>
      <AppHeader role={profile.role} active="/planning" />
      <div className="container" style={{ maxWidth: 1500 }}>
        <h1>Planning</h1>
        <PeriodBand base="/planning" semaine={centerIso} extra={extra} weekNums={weekBlocks.map((w) => w.num)} />
        <PlanningFilters
          equipes={(equipesD ?? []).map((e) => ({ id: e.id, label: e.nom }))}
          equipe={equipe}
          semaine={centerIso}
        />
        <PlanningGrid
          days={days}
          weekBlocks={weekBlocks}
          todayIso={isoDate(new Date())}
          personnes={gridPersonnes}
          groups={gridGroups}
          openByIso={openByIso}
          motifs={motifs.map((m) => ({ id: m.id, code: m.code_court, couleur: m.couleur }))}
          besoin={besoin}
          initial={initial}
          matrice={matrice}
        />
      </div>
    </>
  );
}
