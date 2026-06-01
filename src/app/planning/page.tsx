import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import AppHeader from "@/components/AppHeader";
import WeekNav from "@/components/WeekNav";
import { parseMonday, weekDays, isoDate } from "@/lib/week";
import PlanningFilters from "./PlanningFilters";
import PlanningGrid from "./PlanningGrid";

type PosteRow = {
  id: string;
  nom: string;
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
  non_travaille: boolean;
};
type MatRow = { personne_id: string; poste_id: string; niveau_actuel: number };

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ equipe?: string; semaine?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const sp = await searchParams;
  const monday = parseMonday(sp.semaine);
  const semaineIso = isoDate(monday);
  const days = weekDays(monday);
  const isos = days.map((d) => d.iso);

  const supabase = await getServerClient();

  const [{ data: equipesD }, { data: lignesD }, { data: louv }] = await Promise.all([
    supabase.from("equipe").select("id, nom").eq("actif", true).order("nom").returns<Equipe[]>(),
    supabase
      .from("ligne")
      .select("id, nom, poste(id, nom, actif, effectif_requis, niveau_min_requis)")
      .eq("actif", true)
      .order("nom")
      .returns<LigneRow[]>(),
    supabase
      .from("ligne_ouverture")
      .select("jour, ligne_id, ouverte")
      .in("jour", isos)
      .returns<{ jour: string; ligne_id: string; ouverte: boolean }[]>(),
  ]);

  // Groupes de postes (pour le select) + effectif par ligne (pour le besoin)
  const groups = (lignesD ?? [])
    .map((l) => ({
      ligneNom: l.nom,
      ligneId: l.id,
      postes: [...(l.poste ?? [])]
        .filter((p) => p.actif)
        .sort((a, b) => a.nom.localeCompare(b.nom)),
    }))
    .filter((g) => g.postes.length > 0);

  const lineEffectif: Record<string, number> = {};
  for (const g of groups) {
    lineEffectif[g.ligneId] = g.postes.reduce((s, p) => s + (p.effectif_requis ?? 0), 0);
  }

  // Lignes ouvertes par jour -> besoin
  const openByDay: Record<string, Set<string>> = {};
  for (const iso of isos) openByDay[iso] = new Set();
  for (const r of louv ?? []) {
    if (r.ouverte && openByDay[r.jour]) openByDay[r.jour].add(r.ligne_id);
  }
  const besoin = isos.map((iso) =>
    [...openByDay[iso]].reduce((s, lid) => s + (lineEffectif[lid] ?? 0), 0)
  );

  // Personnes affichees
  let persQ = supabase
    .from("personne")
    .select("id, nom, prenom, equipe_id")
    .eq("statut", "ACTIF")
    .order("nom");
  if (sp.equipe) persQ = persQ.eq("equipe_id", sp.equipe);
  const { data: persD } = await persQ.returns<Personne[]>();
  const personnes = persD ?? [];
  const persIds = personnes.map((p) => p.id);

  // Placements de la semaine + matrice (hors-competence)
  const initial: Record<string, string> = {};
  const matrice: Record<string, number> = {};
  if (persIds.length) {
    const [{ data: pl }, { data: mat }] = await Promise.all([
      supabase
        .from("placement")
        .select("personne_id, jour, poste_id, non_travaille")
        .in("jour", isos)
        .in("personne_id", persIds)
        .returns<Placement[]>(),
      supabase
        .from("matrice")
        .select("personne_id, poste_id, niveau_actuel")
        .in("personne_id", persIds)
        .returns<MatRow[]>(),
    ]);
    for (const r of pl ?? []) {
      initial[`${r.personne_id}:${r.jour}`] = r.non_travaille ? "X" : (r.poste_id ?? "");
    }
    for (const r of mat ?? []) matrice[`${r.personne_id}:${r.poste_id}`] = r.niveau_actuel;
  }

  // Perimetre d'edition
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
    postes: g.postes.map((p) => ({ id: p.id, nom: p.nom, niveauMin: p.niveau_min_requis })),
  }));

  return (
    <>
      <AppHeader role={profile.role} active="/planning" />
      <div className="container" style={{ maxWidth: 1300 }}>
        <h1>Planning hebdomadaire</h1>
        <WeekNav base="/planning" semaine={sp.semaine ?? ""} extra={sp.equipe ? { equipe: sp.equipe } : {}} />
        <PlanningFilters
          equipes={(equipesD ?? []).map((e) => ({ id: e.id, label: e.nom }))}
          equipe={sp.equipe ?? ""}
          semaine={semaineIso}
        />
        <PlanningGrid
          days={days}
          personnes={gridPersonnes}
          groups={gridGroups}
          besoin={besoin}
          initial={initial}
          matrice={matrice}
        />
      </div>
    </>
  );
}
