import Link from "next/link";
import { getServerClient } from "@/lib/supabase-server";
import AppHeader from "@/components/AppHeader";
import PageTitle from "@/components/PageTitle";
import { requireModule, canWrite } from "@/lib/permissions";
import { parseMois, monthDays, isoDate, mondayOf, addDays, isoWeekNumber } from "@/lib/week";
import { getProfils } from "@/lib/semaine-type";
import OrdoGrid from "./OrdoGrid";
import OrdoMonthNav from "./OrdoMonthNav";

type Ligne = { id: string; nom: string; atelier: { nom: string } | null; poste: { id: string; actif: boolean }[] };
type Quart = { code: string; libelle: string };

export default async function OrdonnancementPage({
  searchParams,
}: {
  searchParams: Promise<{ mois?: string }>;
}) {
  const { profile, perms } = await requireModule("ordonnancement", "read");
  const canEdit = canWrite(perms, "ordonnancement");

  const sp = await searchParams;
  const { year, month0 } = parseMois(sp.mois);
  const days = monthDays(year, month0);
  const isos = days.map((d) => d.iso);

  // Blocs-semaine (annee + n0 ISO) pour l'en-tete des tableaux.
  const weekBlocks: { num: number; year: number; span: number }[] = [];
  for (const d of days) {
    if (d.firstOfWeek || weekBlocks.length === 0) {
      const mon = mondayOf(new Date(d.iso + "T00:00"));
      weekBlocks.push({ num: isoWeekNumber(mon), year: addDays(mon, 3).getFullYear(), span: 1 });
    } else {
      weekBlocks[weekBlocks.length - 1].span += 1;
    }
  }

  const supabase = await getServerClient();
  const [{ data: quartsD }, { data: lignesD }, { data: jq }, { data: ov }, { data: pqOffD }, profils] = await Promise.all([
    supabase.from("quart").select("code, libelle").order("ordre").returns<Quart[]>(),
    supabase
      .from("ligne")
      .select("id, nom, atelier:atelier_id(nom), poste(id, actif)")
      .eq("actif", true)
      .order("nom")
      .returns<Ligne[]>(),
    supabase
      .from("jour_quart")
      .select("jour, quart_code, actif")
      .in("jour", isos)
      .returns<{ jour: string; quart_code: string; actif: boolean }[]>(),
    supabase
      .from("ouverture_quart")
      .select("jour, ligne_id, quart_code, ouverte")
      .in("jour", isos)
      .returns<{ jour: string; ligne_id: string; quart_code: string; ouverte: boolean }[]>(),
    supabase.from("poste_quart").select("poste_id, quart_code").eq("actif", false).returns<{ poste_id: string; quart_code: string }[]>(),
    getProfils(supabase),
  ]);

  const jourQuartState: Record<string, boolean> = {};
  for (const r of jq ?? []) jourQuartState[`${r.quart_code}:${r.jour}`] = r.actif;
  const ouvertureState: Record<string, boolean> = {};
  for (const r of ov ?? []) ouvertureState[`${r.quart_code}:${r.ligne_id}:${r.jour}`] = r.ouverte;

  // Lignes proposees PAR QUART = uniquement celles ayant au moins un poste actif
  // tournant sur ce quart (referentiel poste_quart, defaut actif).
  const pqOff = new Set((pqOffD ?? []).map((r) => `${r.poste_id}:${r.quart_code}`));
  const ligneLabel = (l: Ligne) => (l.atelier?.nom ? `${l.atelier.nom} / ${l.nom}` : l.nom);
  const linesByQuart: Record<string, { id: string; label: string }[]> = {};
  for (const q of quartsD ?? []) {
    linesByQuart[q.code] = (lignesD ?? [])
      .filter((l) => (l.poste ?? []).some((p) => p.actif && !pqOff.has(`${p.id}:${q.code}`)))
      .map((l) => ({ id: l.id, label: ligneLabel(l) }));
  }

  return (
    <>
      <AppHeader role={profile.role} active="/ordonnancement" />
      <div className="container" style={{ maxWidth: 1500 }}>
        <div className="toolbar" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <PageTitle module="ordonnancement">Ordonnancement</PageTitle>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/ordonnancement/semaine-type" className="iconbtn" style={{ padding: "6px 12px" }}>
              ⚙️ Semaine type
            </Link>
            <Link href="/admin/rotation" className="iconbtn" style={{ padding: "6px 12px" }}>
              Rotation des équipes &rarr;
            </Link>
          </div>
        </div>
        <OrdoMonthNav base="/ordonnancement" year={year} month0={month0} />

        <OrdoGrid
          days={days}
          weekBlocks={weekBlocks}
          todayIso={isoDate(new Date())}
          currentWeekIsos={Array.from({ length: 7 }, (_, i) => isoDate(addDays(mondayOf(), i)))}
          quarts={quartsD ?? []}
          linesByQuart={linesByQuart}
          jourQuartState={jourQuartState}
          ouvertureState={ouvertureState}
          profils={profils}
          canEdit={canEdit}
        />
      </div>
    </>
  );
}
