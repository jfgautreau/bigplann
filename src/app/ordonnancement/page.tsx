import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import AppHeader from "@/components/AppHeader";
import WeekNav from "@/components/WeekNav";
import { parseMonday, weekDays, isoDate } from "@/lib/week";
import OrdoGrid from "./OrdoGrid";

type Ligne = { id: string; nom: string; atelier: { nom: string } | null };
type Equipe = { id: string; nom: string };

export default async function OrdonnancementPage({
  searchParams,
}: {
  searchParams: Promise<{ semaine?: string; equipe?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin" && profile.role !== "ordo") redirect("/");

  const sp = await searchParams;
  const monday = parseMonday(sp.semaine);
  const semaineIso = isoDate(monday);
  const days = weekDays(monday);
  const isos = days.map((d) => d.iso);
  const selectedEquipe = sp.equipe ?? "";

  const supabase = await getServerClient();
  const [{ data: lignesD }, { data: equipesD }, { data: jeq }] = await Promise.all([
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
  ]);

  const equipeState: Record<string, boolean> = {};
  for (const r of jeq ?? []) equipeState[`${r.equipe_id}:${r.jour}`] = r.actif;

  // Ouverture des lignes pour l'equipe selectionnee
  const ligneState: Record<string, boolean> = {};
  if (selectedEquipe) {
    const { data: louv } = await supabase
      .from("ligne_ouverture")
      .select("jour, ligne_id, ouverte")
      .in("jour", isos)
      .eq("equipe_id", selectedEquipe)
      .returns<{ jour: string; ligne_id: string; ouverte: boolean }[]>();
    for (const r of louv ?? []) ligneState[`${r.ligne_id}:${r.jour}`] = r.ouverte;
  }

  return (
    <>
      <AppHeader role={profile.role} active="/ordonnancement" />
      <div className="container" style={{ maxWidth: 1100 }}>
        <h1>Ordonnancement</h1>
        <WeekNav
          base="/ordonnancement"
          semaine={sp.semaine ?? ""}
          extra={selectedEquipe ? { equipe: selectedEquipe } : {}}
        />
        <p className="muted" style={{ marginBottom: 16 }}>
          Tout est ouvert par defaut : decochez ce qui est ferme. Le besoin du planning
          se deduit de l&apos;abaque (effectif requis des postes des lignes ouvertes).
        </p>
        <OrdoGrid
          days={days}
          equipes={(equipesD ?? []).map((e) => ({ id: e.id, label: e.nom }))}
          equipeState={equipeState}
          lignes={(lignesD ?? []).map((l) => ({
            id: l.id,
            label: l.atelier?.nom ? `${l.atelier.nom} / ${l.nom}` : l.nom,
          }))}
          ligneState={ligneState}
          selectedEquipe={selectedEquipe}
          semaine={semaineIso}
        />
      </div>
    </>
  );
}
