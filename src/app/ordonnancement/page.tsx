import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import AppHeader from "@/components/AppHeader";
import WeekNav from "@/components/WeekNav";
import { parseMonday, weekDays } from "@/lib/week";
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
  const monday = parseMonday(sp.semaine);
  const days = weekDays(monday);
  const isos = days.map((d) => d.iso);

  const supabase = await getServerClient();
  const [{ data: lignesD }, { data: equipesD }, { data: louv }, { data: jeq }] = await Promise.all([
    supabase
      .from("ligne")
      .select("id, nom, atelier:atelier_id(nom)")
      .eq("actif", true)
      .order("nom")
      .returns<Ligne[]>(),
    supabase.from("equipe").select("id, nom").eq("actif", true).order("nom").returns<Equipe[]>(),
    supabase
      .from("ligne_ouverture")
      .select("jour, ligne_id, ouverte")
      .in("jour", isos)
      .returns<{ jour: string; ligne_id: string; ouverte: boolean }[]>(),
    supabase
      .from("jour_equipe")
      .select("jour, equipe_id, actif")
      .in("jour", isos)
      .returns<{ jour: string; equipe_id: string; actif: boolean }[]>(),
  ]);

  const ligneState: Record<string, boolean> = {};
  for (const r of louv ?? []) ligneState[`${r.ligne_id}:${r.jour}`] = r.ouverte;
  const equipeState: Record<string, boolean> = {};
  for (const r of jeq ?? []) equipeState[`${r.equipe_id}:${r.jour}`] = r.actif;

  return (
    <>
      <AppHeader role={profile.role} active="/ordonnancement" />
      <div className="container" style={{ maxWidth: 1100 }}>
        <h1>Ordonnancement</h1>
        <WeekNav base="/ordonnancement" semaine={sp.semaine ?? ""} />
        <p className="muted" style={{ marginBottom: 16 }}>
          Cochez les lignes ouvertes et les equipes actives pour chaque jour. Le
          besoin en effectif du planning se deduit de l&apos;abaque (effectif requis
          par poste des lignes ouvertes).
        </p>
        <OrdoGrid
          days={days}
          lignes={(lignesD ?? []).map((l) => ({
            id: l.id,
            label: l.atelier?.nom ? `${l.atelier.nom} / ${l.nom}` : l.nom,
          }))}
          equipes={(equipesD ?? []).map((e) => ({ id: e.id, label: e.nom }))}
          ligneState={ligneState}
          equipeState={equipeState}
        />
      </div>
    </>
  );
}
