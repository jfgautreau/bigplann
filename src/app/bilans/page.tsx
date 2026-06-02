import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import AppHeader from "@/components/AppHeader";
import PeriodBand from "@/components/PeriodBand";
import PrintButton from "@/components/PrintButton";
import { parseMonday, weekDays, isoDate, isoWeekNumber, defaultOpenIso } from "@/lib/week";

type LigneRow = { id: string; poste: { actif: boolean; effectif_requis: number }[] };
type Placement = { jour: string; poste_id: string | null; motif_absence_id: string | null };
type Motif = { id: string; code_court: string; libelle: string };

export default async function BilansPage({
  searchParams,
}: {
  searchParams: Promise<{ semaine?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const sp = await searchParams;
  const monday = parseMonday(sp.semaine);
  const centerIso = isoDate(monday);
  const days = weekDays(monday);
  const isos = days.map((d) => d.iso);

  const supabase = await getServerClient();
  const [{ data: lignesD }, { data: motifsD }, { data: plD }] = await Promise.all([
    supabase.from("ligne").select("id, poste(actif, effectif_requis)").eq("actif", true).returns<LigneRow[]>(),
    supabase.from("motif_absence").select("id, code_court, libelle").order("libelle").returns<Motif[]>(),
    supabase
      .from("placement")
      .select("jour, poste_id, motif_absence_id")
      .in("jour", isos)
      .returns<Placement[]>(),
  ]);

  // Besoin theorique = effectif total des postes actifs (lignes ouvertes par defaut sauf dimanche)
  const totalEffectif = (lignesD ?? []).reduce(
    (s, l) => s + (l.poste ?? []).filter((p) => p.actif).reduce((a, p) => a + (p.effectif_requis ?? 0), 0),
    0
  );

  const placements = plD ?? [];
  const presentByDay: Record<string, number> = {};
  const absByMotif: Record<string, number> = {};
  for (const r of placements) {
    if (r.poste_id) presentByDay[r.jour] = (presentByDay[r.jour] ?? 0) + 1;
    if (r.motif_absence_id) absByMotif[r.motif_absence_id] = (absByMotif[r.motif_absence_id] ?? 0) + 1;
  }

  const motifs = motifsD ?? [];
  const totalAbs = Object.values(absByMotif).reduce((a, b) => a + b, 0);

  return (
    <>
      <AppHeader role={profile.role} active="/bilans" />
      <div className="container" style={{ maxWidth: 1100 }}>
        <div className="toolbar">
          <h1 style={{ margin: 0 }}>Bilans</h1>
          <PrintButton />
        </div>
        <PeriodBand base="/bilans" semaine={centerIso} weekNums={[isoWeekNumber(monday)]} />

        {/* Effectifs */}
        <div className="card section">
          <h2 style={{ marginTop: 0 }}>Effectifs (semaine {isoWeekNumber(monday)})</h2>
          <table>
            <thead>
              <tr>
                <th></th>
                {days.map((d) => (
                  <th key={d.iso} style={{ textAlign: "center" }}>
                    {d.nom.slice(0, 3)}<br />
                    <span className="muted" style={{ fontWeight: 400 }}>{d.num}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {([
                ["Besoin", (iso: string) => (defaultOpenIso(iso) ? totalEffectif : 0), () => "var(--muted)"],
                ["Present", (iso: string) => presentByDay[iso] ?? 0, () => "var(--text)"],
                [
                  "Delta",
                  (iso: string) => (presentByDay[iso] ?? 0) - (defaultOpenIso(iso) ? totalEffectif : 0),
                  (iso: string) => {
                    const d = (presentByDay[iso] ?? 0) - (defaultOpenIso(iso) ? totalEffectif : 0);
                    return d < 0 ? "var(--danger)" : d > 0 ? "#9a3412" : "var(--ok)";
                  },
                ],
              ] as [string, (iso: string) => number, (iso: string) => string][]).map(([label, fn, col]) => (
                <tr key={label}>
                  <td style={{ fontWeight: 600 }}>{label}</td>
                  {days.map((d) => {
                    const v = fn(d.iso);
                    return (
                      <td key={d.iso} style={{ textAlign: "center", fontWeight: 700, color: col(d.iso) }}>
                        {label === "Delta" && v > 0 ? `+${v}` : v}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted" style={{ marginTop: 6 }}>
            Besoin = effectif total des postes actifs (capacite pleine, hors dimanche).
            Present = personnes placees sur un poste.
          </p>
        </div>

        {/* Absences par motif */}
        <div className="card section">
          <h2 style={{ marginTop: 0 }}>Absences par motif (semaine {isoWeekNumber(monday)})</h2>
          <table>
            <thead>
              <tr>
                <th>Motif</th>
                <th>Code</th>
                <th style={{ textAlign: "right" }}>Nombre de jours</th>
              </tr>
            </thead>
            <tbody>
              {motifs.map((m) => (
                <tr key={m.id}>
                  <td>{m.libelle}</td>
                  <td><strong>{m.code_court}</strong></td>
                  <td style={{ textAlign: "right" }}>{absByMotif[m.id] ?? 0}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={2} style={{ fontWeight: 700 }}>Total</td>
                <td style={{ textAlign: "right", fontWeight: 700 }}>{totalAbs}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Polyvalence */}
        <div className="card section">
          <h2 style={{ marginTop: 0 }}>Polyvalence & ecarts de competences</h2>
          <p>
            Le detail Existant / Besoin / Ecart par poste et par niveau est sur la page{" "}
            <Link href="/matrice/bilan">Bilan polyvalence</Link>.
          </p>
        </div>

        <div className="card section">
          <h2 style={{ marginTop: 0 }}>Habilitations</h2>
          <p>
            Suivi des echeances et alertes sur la page{" "}
            <Link href="/habilitations">Habilitations a recycler</Link>.
          </p>
        </div>
      </div>
    </>
  );
}
