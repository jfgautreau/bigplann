import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import PrintButton from "@/components/PrintButton";
import { requireModule } from "@/lib/permissions";
import { getServerClient } from "@/lib/supabase-server";
import { parseMois, monthDays, isoDate } from "@/lib/week";
import CompetenceNav from "./CompetenceNav";

type Poste = { id: string; nom: string; actif: boolean };
type Ligne = { id: string; nom: string; atelier: { nom: string } | null; poste: Poste[] };
type Mat = { poste_id: string; personne_id: string; niveau_actuel: number };
type Abs = { jour: string; personne_id: string; non_travaille: boolean; motif_absence_id: string | null };

export default async function CompetencesDispoPage({
  searchParams,
}: {
  searchParams: Promise<{ mois?: string; seuil?: string }>;
}) {
  const { profile } = await requireModule("bilans", "read");

  const sp = await searchParams;
  const { year, month0 } = parseMois(sp.mois);
  const seuil = Math.max(1, Math.min(4, Number(sp.seuil) || 2));
  const days = monthDays(year, month0);
  const isos = days.map((d) => d.iso);
  const todayIso = isoDate(new Date());

  const supabase = await getServerClient();
  const [{ data: lignesD }, { data: matD }, { data: actifs }, { data: absD }] = await Promise.all([
    supabase
      .from("ligne")
      .select("id, nom, atelier:atelier_id(nom), poste(id, nom, actif)")
      .eq("actif", true)
      .order("nom")
      .returns<Ligne[]>(),
    supabase
      .from("matrice")
      .select("poste_id, personne_id, niveau_actuel")
      .gte("niveau_actuel", seuil)
      .returns<Mat[]>(),
    supabase.from("personne").select("id").eq("statut", "ACTIF").returns<{ id: string }[]>(),
    supabase
      .from("placement")
      .select("jour, personne_id, non_travaille, motif_absence_id")
      .in("jour", isos)
      .returns<Abs[]>(),
  ]);

  const actifSet = new Set((actifs ?? []).map((p) => p.id));

  // Competents (niveau >= seuil) actifs par poste
  const competentByPoste = new Map<string, Set<string>>();
  for (const r of matD ?? []) {
    if (!actifSet.has(r.personne_id)) continue;
    if (!competentByPoste.has(r.poste_id)) competentByPoste.set(r.poste_id, new Set());
    competentByPoste.get(r.poste_id)!.add(r.personne_id);
  }

  // Absents (toute absence ou NT) par jour
  const absentByDay = new Map<string, Set<string>>();
  for (const iso of isos) absentByDay.set(iso, new Set());
  for (const r of absD ?? []) {
    if (r.non_travaille || r.motif_absence_id) absentByDay.get(r.jour)?.add(r.personne_id);
  }

  const groups = (lignesD ?? [])
    .map((l) => ({
      label: l.atelier?.nom ? `${l.atelier.nom} / ${l.nom}` : l.nom,
      postes: [...(l.poste ?? [])].filter((p) => p.actif).sort((a, b) => a.nom.localeCompare(b.nom)),
    }))
    .filter((g) => g.postes.length > 0);

  const dispo = (posteId: string, iso: string) => {
    const comp = competentByPoste.get(posteId);
    if (!comp || comp.size === 0) return 0;
    const abs = absentByDay.get(iso);
    let n = 0;
    for (const pid of comp) if (!abs || !abs.has(pid)) n++;
    return n;
  };

  return (
    <>
      <AppHeader role={profile.role} active="/bilans" />
      <div className="container" style={{ maxWidth: 1500 }}>
        <div className="toolbar">
          <h1 style={{ margin: 0 }}>Competences disponibles</h1>
          <Link href="/bilans" className="navlink">&larr; Bilans</Link>
          <PrintButton />
        </div>
        <p className="muted" style={{ marginBottom: 8 }}>
          Pour chaque poste et chaque jour : nombre de personnes <strong>competentes</strong>
          (niveau &ge; {seuil}) et <strong>disponibles</strong> (pas en absence). Total des
          competents par poste indique entre parentheses.
        </p>
        <CompetenceNav year={year} month0={month0} seuil={seuil} />

        <div className="card" style={{ overflowX: "auto" }}>
          <table className="matrix" style={{ borderCollapse: "collapse", tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th style={{ width: 200, textAlign: "left", position: "sticky", left: 0, background: "#fff" }}>Poste</th>
                {days.map((d) => (
                  <th key={d.iso} style={{ width: 30, textAlign: "center", background: d.iso === todayIso ? "#dbeafe" : undefined }}>
                    {d.nom.slice(0, 2)}
                    <br />
                    <span className="muted" style={{ fontWeight: 400, fontSize: 9 }}>{d.num.slice(0, 2)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            {groups.map((g) => (
              <tbody key={g.label}>
                <tr>
                  <td colSpan={days.length + 1} style={{ background: "#eef2ff", fontWeight: 700, padding: "4px 10px" }}>
                    {g.label}
                  </td>
                </tr>
                {g.postes.map((p) => {
                  const total = competentByPoste.get(p.id)?.size ?? 0;
                  return (
                    <tr key={p.id}>
                      <td style={{ position: "sticky", left: 0, background: "#fff", whiteSpace: "nowrap", fontWeight: 600 }}>
                        {p.nom} <span className="muted">({total})</span>
                      </td>
                      {days.map((d) => {
                        const n = dispo(p.id, d.iso);
                        return (
                          <td
                            key={d.iso}
                            style={{
                              textAlign: "center",
                              fontWeight: 700,
                              color: n === 0 ? "var(--danger)" : n <= 1 ? "#9a3412" : "var(--ok)",
                              background: d.iso === todayIso ? "#eff6ff" : undefined,
                            }}
                          >
                            {n}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            ))}
            {groups.length === 0 && (
              <tbody>
                <tr>
                  <td colSpan={days.length + 1} className="muted">Aucun poste.</td>
                </tr>
              </tbody>
            )}
          </table>
        </div>
      </div>
    </>
  );
}
