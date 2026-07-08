import Link from "next/link";
import { getServerClient } from "@/lib/supabase-server";
import AppHeader from "@/components/AppHeader";
import { requireModule } from "@/lib/permissions";
import { parseMonday, isoDate, addDays, isoWeekNumber } from "@/lib/week";
import RotationEditor from "./RotationEditor";
import { saveQuartHoraires } from "./actions";

type Quart = { code: string; libelle: string; debut: string | null; fin: string | null };
type Equipe = { id: string; nom: string; quart_fixe: string | null };

const NB_SEM = 8;

export default async function RotationPage({
  searchParams,
}: {
  searchParams: Promise<{ debut?: string }>;
}) {
  const { profile } = await requireModule("ordonnancement", "write");

  const sp = await searchParams;
  const start = parseMonday(sp.debut);
  const weeks = Array.from({ length: NB_SEM }, (_, i) => {
    const m = addDays(start, i * 7);
    const num = isoWeekNumber(m);
    return {
      iso: isoDate(m),
      num,
      label: `S${num} · ${String(m.getDate()).padStart(2, "0")}/${String(m.getMonth() + 1).padStart(2, "0")}/${m.getFullYear()}`,
    };
  });
  const weekIsos = weeks.map((w) => w.iso);

  const supabase = await getServerClient();
  const [{ data: quartsD }, { data: equipesD }, { data: rot }] = await Promise.all([
    supabase.from("quart").select("code, libelle, debut, fin").order("ordre").returns<Quart[]>(),
    supabase.from("equipe").select("id, nom, quart_fixe").eq("actif", true).order("nom").returns<Equipe[]>(),
    supabase
      .from("equipe_quart_semaine")
      .select("equipe_id, semaine, quart_code")
      .in("semaine", weekIsos)
      .returns<{ equipe_id: string; semaine: string; quart_code: string }[]>(),
  ]);

  const quarts = quartsD ?? [];
  // Les equipes a quart fixe ne tournent pas : on ne les affiche pas dans la rotation.
  const equipes = (equipesD ?? []).filter((e) => !e.quart_fixe);
  const equipesFixes = (equipesD ?? []).filter((e) => e.quart_fixe);
  const initial: Record<string, string> = {};
  for (const r of rot ?? []) initial[`${r.equipe_id}|${r.semaine}`] = r.quart_code;

  const navHref = (s: string) => `/admin/rotation?debut=${s}`;

  return (
    <>
      <AppHeader role={profile.role} active="/admin/rotation" />
      <div className="container" style={{ maxWidth: 1100 }}>
        <h1>Rotation des équipes & horaires des quarts</h1>

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

        {/* Rotation */}
        <div className="card section">
          <div className="toolbar">
            <h2 style={{ margin: 0 }}>Rotation (équipe &rarr; quart par semaine)</h2>
            <Link href={navHref(isoDate(addDays(start, -NB_SEM * 7)))} className="navlink">&larr; 8 sem.</Link>
            <Link href={navHref(isoDate(addDays(start, NB_SEM * 7)))} className="navlink">8 sem. &rarr;</Link>
          </div>
          <p className="muted">
            Saisie manuelle. « Pré-remplir » initialise une alternance Matin/Après-midi
            (et Nuit pour les équipes nommées « nuit ») ; ajustez ensuite à la main.
            {equipesFixes.length > 0 && (
              <>
                {" "}Équipe(s) à quart fixe (hors rotation) :{" "}
                <strong>{equipesFixes.map((e) => e.nom).join(", ")}</strong>.
              </>
            )}
          </p>
          <RotationEditor
            weeks={weeks}
            equipes={equipes.map((e) => ({ id: e.id, label: e.nom }))}
            initial={initial}
          />
        </div>
      </div>
    </>
  );
}
