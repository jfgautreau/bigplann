import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import AppHeader from "@/components/AppHeader";
import PeriodNav from "@/components/PeriodNav";
import { parseMonday, weekDays, isoDate, addDays, mondayOf, isoWeekNumber } from "@/lib/week";
import OrdoGrid from "./OrdoGrid";

type Ligne = { id: string; nom: string; atelier: { nom: string } | null };
type Equipe = { id: string; nom: string };

export default async function OrdonnancementPage({
  searchParams,
}: {
  searchParams: Promise<{ semaine?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin" && profile.role !== "ordo") redirect("/");

  const sp = await searchParams;
  const center = parseMonday(sp.semaine);
  const centerIso = isoDate(center);
  const weekMondays = [addDays(center, -7), center, addDays(center, 7)];
  const days = weekMondays.flatMap((wm) =>
    weekDays(wm).map((d, di) => ({ iso: d.iso, nom: d.nom, num: d.num, firstOfWeek: di === 0 }))
  );
  const isos = days.map((d) => d.iso);
  const weekBlocks = weekMondays.map((wm) => ({ num: isoWeekNumber(wm), span: 7 }));

  const supabase = await getServerClient();
  const [{ data: lignesD }, { data: equipesD }, { data: jeq }, { data: louv }] = await Promise.all([
    supabase
      .from("ligne")
      .select("id, nom, atelier:atelier_id(nom)")
      .eq("actif", true)
      .order("nom")
      .returns<Ligne[]>(),
    supabase.from("equipe").select("id, nom").eq("actif", true).order("nom").returns<Equipe[]>(),
    supabase
      .from("jour_equipe")
      .select("jour, equipe_id, actif")
      .in("jour", isos)
      .returns<{ jour: string; equipe_id: string; actif: boolean }[]>(),
    supabase
      .from("ligne_ouverture")
      .select("jour, ligne_id, equipe_id, ouverte")
      .in("jour", isos)
      .returns<{ jour: string; ligne_id: string; equipe_id: string; ouverte: boolean }[]>(),
  ]);

  const equipeState: Record<string, boolean> = {};
  for (const r of jeq ?? []) equipeState[`${r.equipe_id}:${r.jour}`] = r.actif;

  const ligneStateByEquipe: Record<string, Record<string, boolean>> = {};
  for (const r of louv ?? []) {
    (ligneStateByEquipe[r.equipe_id] ??= {})[`${r.ligne_id}:${r.jour}`] = r.ouverte;
  }

  const navHref = (s: string) => `/ordonnancement?semaine=${s}`;

  return (
    <>
      <AppHeader role={profile.role} active="/ordonnancement" />
      <div className="container" style={{ maxWidth: 1500 }}>
        <h1>Ordonnancement</h1>
        <PeriodNav base="/ordonnancement" semaine={centerIso} />
        <div className="toolbar" style={{ alignItems: "center" }}>
          <Link href={navHref(isoDate(addDays(center, -7)))} className="iconbtn" scroll={false} title="Semaine precedente">
            &lsaquo;
          </Link>
          <Link href={navHref(isoDate(mondayOf()))} className="btn-sm" style={{ textDecoration: "none" }} scroll={false}>
            Aujourd&apos;hui
          </Link>
          <Link href={navHref(isoDate(addDays(center, 7)))} className="iconbtn" scroll={false} title="Semaine suivante">
            &rsaquo;
          </Link>
          <span className="muted">
            Semaines {weekBlocks.map((w) => w.num).join(" · ")}
          </span>
        </div>

        <OrdoGrid
          days={days}
          weekBlocks={weekBlocks}
          todayIso={isoDate(new Date())}
          equipes={(equipesD ?? []).map((e) => ({ id: e.id, label: e.nom }))}
          lignes={(lignesD ?? []).map((l) => ({
            id: l.id,
            label: l.atelier?.nom ? `${l.atelier.nom} / ${l.nom}` : l.nom,
          }))}
          equipeState={equipeState}
          ligneStateByEquipe={ligneStateByEquipe}
        />
      </div>
    </>
  );
}
