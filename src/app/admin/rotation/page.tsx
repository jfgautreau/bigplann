import { getServerClient } from "@/lib/supabase-server";
import AppHeader from "@/components/AppHeader";
import { requireModule } from "@/lib/permissions";
import { mondayOf, isoDate, addDays, isoWeekNumber } from "@/lib/week";
import { rotationForWeek, type RotationRef } from "@/lib/rotation";
import { saveQuartHoraires, saveRotationReference, deleteRotationReference } from "./actions";

type Quart = { code: string; libelle: string; debut: string | null; fin: string | null };
type Equipe = { id: string; nom: string; quart_fixe: string | null };

const NB_APERCU = 8;

export default async function RotationPage() {
  const { profile } = await requireModule("ordonnancement", "write");

  const supabase = await getServerClient();
  const [{ data: quartsD }, { data: equipesD }, { data: refsD }] = await Promise.all([
    supabase.from("quart").select("code, libelle, debut, fin").order("ordre").returns<Quart[]>(),
    supabase.from("equipe").select("id, nom, quart_fixe").eq("actif", true).order("nom").returns<Equipe[]>(),
    supabase.from("rotation_reference").select("semaine, equipe_id, quart_code").order("semaine").returns<RotationRef[]>(),
  ]);

  const quarts = quartsD ?? [];
  const quartLib = (code: string) => quarts.find((q) => q.code === code)?.libelle ?? code;
  // Les equipes a quart fixe ne tournent pas : hors rotation.
  const equipes = (equipesD ?? []).filter((e) => !e.quart_fixe);
  const equipesFixes = (equipesD ?? []).filter((e) => e.quart_fixe);
  const refs = refsD ?? [];

  // Pre-remplissage du formulaire : quart de chaque equipe dans la reference la
  // plus recente (etat courant), pour repartir de l'existant.
  const derniereSemaine = refs.length ? refs[refs.length - 1].semaine : "";
  const quartCourant: Record<string, string> = {};
  for (const r of refs) if (r.semaine === derniereSemaine) quartCourant[r.equipe_id] = r.quart_code;

  // Aperçu : les NB_APERCU prochaines semaines a partir du lundi courant.
  const start = mondayOf();
  const apercuWeeks = Array.from({ length: NB_APERCU }, (_, i) => {
    const m = addDays(start, i * 7);
    const iso = isoDate(m);
    return {
      iso,
      label: `S${isoWeekNumber(m)} · ${String(m.getDate()).padStart(2, "0")}/${String(m.getMonth() + 1).padStart(2, "0")}`,
      rot: rotationForWeek(refs, iso),
    };
  });

  // References existantes regroupees par semaine (recentes en premier).
  const semaines = [...new Set(refs.map((r) => r.semaine))].sort().reverse();
  const equipeNom = (id: string) => (equipesD ?? []).find((e) => e.id === id)?.nom ?? id;

  const lundiCourant = isoDate(start);

  return (
    <>
      <AppHeader role={profile.role} active="/admin/rotation" />
      <div className="container" style={{ maxWidth: 1100 }}>
        <h1>Rotation des équipes &amp; horaires des quarts</h1>

        {/* Horaires des quarts */}
        <div className="card section">
          <h2 style={{ marginTop: 0 }}>Horaires des quarts</h2>
          <form action={saveQuartHoraires} autoComplete="off">
            {quarts.map((q) => (
              <div key={q.code} className="toolbar">
                <div className="field">
                  <span>Libellé</span>
                  <input name={`lib_${q.code}`} defaultValue={q.libelle} />
                </div>
                <div className="field">
                  <span>Début</span>
                  <input name={`debut_${q.code}`} type="time" defaultValue={(q.debut ?? "").slice(0, 5)} />
                </div>
                <div className="field">
                  <span>Fin</span>
                  <input name={`fin_${q.code}`} type="time" defaultValue={(q.fin ?? "").slice(0, 5)} />
                </div>
              </div>
            ))}
            <button type="submit" style={{ width: "auto", padding: "9px 20px" }}>Enregistrer les horaires</button>
          </form>
        </div>

        {/* Reference de rotation */}
        <div className="card section">
          <h2 style={{ marginTop: 0 }}>Rotation — référence d&apos;une semaine</h2>
          <p className="muted">
            Choisissez une semaine et le quart de chaque équipe tournante ce lundi-là.
            L&apos;alternance des semaines suivantes est calculée automatiquement (échange
            hebdomadaire). Les semaines antérieures ne sont jamais modifiées : pour changer
            la rotation plus tard, enregistrez une nouvelle référence datée.
            {equipesFixes.length > 0 && (
              <>
                {" "}Équipe(s) à quart fixe (hors rotation) :{" "}
                <strong>{equipesFixes.map((e) => e.nom).join(", ")}</strong>.
              </>
            )}
          </p>

          {equipes.length === 0 ? (
            <p className="muted">Aucune équipe tournante (toutes les équipes ont un quart fixe).</p>
          ) : (
            <form action={saveRotationReference} autoComplete="off">
              <div className="toolbar" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
                <div className="field">
                  <span>Semaine (ramenée au lundi)</span>
                  <input name="semaine" type="date" defaultValue={lundiCourant} required />
                </div>
                {equipes.map((e) => (
                  <div key={e.id} className="field">
                    <span>{e.nom}</span>
                    <select name={`quart_${e.id}`} defaultValue={quartCourant[e.id] ?? ""}>
                      <option value="">—</option>
                      {quarts.map((q) => (
                        <option key={q.code} value={q.code}>{q.libelle}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <button type="submit" style={{ width: "auto", padding: "9px 20px", marginTop: 8 }}>
                Enregistrer la référence
              </button>
            </form>
          )}
        </div>

        {/* Aperçu de l'alternance */}
        <div className="card section">
          <h2 style={{ marginTop: 0 }}>Aperçu ({NB_APERCU} prochaines semaines)</h2>
          <p className="muted">Calculé d&apos;après les références enregistrées.</p>
          <div style={{ overflowX: "auto" }}>
            <table className="matrix" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Semaine</th>
                  {equipes.map((e) => (
                    <th key={e.id} style={{ textAlign: "center", minWidth: 110 }}>{e.nom}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {apercuWeeks.map((w) => (
                  <tr key={w.iso}>
                    <td style={{ whiteSpace: "nowrap", fontWeight: 600 }}>{w.label}</td>
                    {equipes.map((e) => (
                      <td key={e.id} style={{ textAlign: "center" }}>
                        {w.rot[e.id] ? quartLib(w.rot[e.id]) : <span className="muted">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* References existantes */}
        <div className="card section">
          <h2 style={{ marginTop: 0 }}>Références enregistrées</h2>
          {semaines.length === 0 ? (
            <p className="muted">Aucune référence pour l&apos;instant.</p>
          ) : (
            <table className="matrix" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>À partir du</th>
                  <th style={{ textAlign: "left" }}>Affectation</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {semaines.map((sem) => {
                  const bloc = refs.filter((r) => r.semaine === sem);
                  return (
                    <tr key={sem}>
                      <td style={{ whiteSpace: "nowrap", fontWeight: 600 }}>{sem}</td>
                      <td>{bloc.map((r) => `${equipeNom(r.equipe_id)} → ${quartLib(r.quart_code)}`).join(" · ")}</td>
                      <td style={{ textAlign: "right" }}>
                        <form action={deleteRotationReference}>
                          <input type="hidden" name="semaine" value={sem} />
                          <button type="submit" className="btn-sm btn-ghost" style={{ width: "auto", color: "var(--danger)" }}>
                            Supprimer
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
