import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import AppHeader from "@/components/AppHeader";
import { parseMonday, weekDays, isoDate, addDays, mondayOf } from "@/lib/week";
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
type Placement = { personne_id: string; jour: string; poste_id: string | null; non_travaille: boolean };
type MatRow = { personne_id: string; poste_id: string; niveau_actuel: number };

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ equipe?: string; semaine?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const sp = await searchParams;
  const center = parseMonday(sp.semaine);
  const centerIso = isoDate(center);
  const equipe = sp.equipe ?? "";

  // 3 semaines : passee, centrale, a venir
  const weekMondays = [addDays(center, -7), center, addDays(center, 7)];
  const todayMonday = isoDate(mondayOf());
  const todayIso = isoDate(new Date());
  const days = weekMondays.flatMap((wm, wi) =>
    weekDays(wm).map((d, di) => ({ ...d, firstOfWeek: di === 0, _wi: wi }))
  );
  const isos = days.map((d) => d.iso);
  const weeks = weekMondays.map((wm) => {
    const lbl = `Semaine du ${String(wm.getDate()).padStart(2, "0")}/${String(wm.getMonth() + 1).padStart(2, "0")}`;
    return { label: isoDate(wm) === todayMonday ? `${lbl} (en cours)` : lbl };
  });

  const supabase = await getServerClient();

  const [{ data: equipesD }, { data: lignesD }] = await Promise.all([
    supabase.from("equipe").select("id, nom").eq("actif", true).order("nom").returns<Equipe[]>(),
    supabase
      .from("ligne")
      .select("id, nom, poste(id, nom, nom_court, actif, effectif_requis, niveau_min_requis)")
      .eq("actif", true)
      .order("nom")
      .returns<LigneRow[]>(),
  ]);

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

  // Fermetures / inactivites pour l'equipe selectionnee (defaut ouvert/actif)
  const closed = new Set<string>(); // `${jour}:${ligne_id}`
  const inactive = new Set<string>(); // jour
  if (equipe) {
    const [{ data: louv }, { data: jeq }] = await Promise.all([
      supabase
        .from("ligne_ouverture")
        .select("jour, ligne_id, ouverte")
        .in("jour", isos)
        .eq("equipe_id", equipe)
        .returns<{ jour: string; ligne_id: string; ouverte: boolean }[]>(),
      supabase
        .from("jour_equipe")
        .select("jour, actif")
        .in("jour", isos)
        .eq("equipe_id", equipe)
        .returns<{ jour: string; actif: boolean }[]>(),
    ]);
    for (const r of louv ?? []) if (!r.ouverte) closed.add(`${r.jour}:${r.ligne_id}`);
    for (const r of jeq ?? []) if (!r.actif) inactive.add(r.jour);
  }

  const besoin = isos.map((iso) => {
    if (equipe && inactive.has(iso)) return 0;
    return groups.reduce(
      (s, g) => (closed.has(`${iso}:${g.ligneId}`) ? s : s + (lineEffectif[g.ligneId] ?? 0)),
      0
    );
  });

  // Personnes affichees
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
    for (const r of pl ?? []) initial[`${r.personne_id}:${r.jour}`] = r.non_travaille ? "X" : (r.poste_id ?? "");
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
    postes: g.postes.map((p) => ({
      id: p.id,
      nom: (p.nom_court || p.nom).slice(0, 6),
      niveauMin: p.niveau_min_requis,
      effectif: p.effectif_requis,
    })),
  }));

  const navHref = (s: string) => {
    const p = new URLSearchParams();
    if (equipe) p.set("equipe", equipe);
    p.set("semaine", s);
    return `/planning?${p.toString()}`;
  };

  return (
    <>
      <AppHeader role={profile.role} active="/planning" />
      <div className="container" style={{ maxWidth: 1500 }}>
        <h1>Planning (3 semaines)</h1>

        <div className="toolbar" style={{ alignItems: "center" }}>
          <Link href={navHref(isoDate(addDays(center, -7)))} className="btn-sm btn-ghost" style={{ textDecoration: "none" }}>
            &larr; Decaler -1 sem.
          </Link>
          <Link href={navHref(todayMonday)} className="btn-sm" style={{ textDecoration: "none" }}>
            Aujourd&apos;hui
          </Link>
          <Link href={navHref(isoDate(addDays(center, 7)))} className="btn-sm btn-ghost" style={{ textDecoration: "none" }}>
            Decaler +1 sem. &rarr;
          </Link>
          <span className="muted">Affichage centre sur la semaine du {centerIso}</span>
        </div>

        <PlanningFilters
          equipes={(equipesD ?? []).map((e) => ({ id: e.id, label: e.nom }))}
          equipe={equipe}
          semaine={centerIso}
        />

        <PlanningGrid
          days={days}
          weeks={weeks}
          todayIso={todayIso}
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
