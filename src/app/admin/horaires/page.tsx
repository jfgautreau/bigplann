import { getServerClient } from "@/lib/supabase-server";
import AppHeader from "@/components/AppHeader";
import { requireModule } from "@/lib/permissions";
import { saveHoraires } from "./actions";
import HoraireGrid from "./HoraireGrid";

type PosteRow = { id: string; nom: string; actif: boolean };
type LigneRow = { id: string; nom: string; atelier: { nom: string } | null; poste: PosteRow[] };
type Quart = { code: string; libelle: string; debut: string | null; fin: string | null };
type HoraireRow = { poste_id: string; quart_code: string; jour: number; debut: string | null; fin: string | null };

export default async function HorairesPage({
  searchParams,
}: {
  searchParams: Promise<{ ligne?: string }>;
}) {
  const { profile } = await requireModule("horaires", "write");
  const sp = await searchParams;

  const supabase = await getServerClient();
  const [{ data: lignesD }, { data: quartsD }] = await Promise.all([
    supabase
      .from("ligne")
      .select("id, nom, atelier:atelier_id(nom), poste(id, nom, actif)")
      .eq("actif", true)
      .order("nom")
      .returns<LigneRow[]>(),
    supabase.from("quart").select("code, libelle, debut, fin").order("ordre").returns<Quart[]>(),
  ]);
  const lignes = lignesD ?? [];
  const quarts = (quartsD ?? []).map((q) => ({
    code: q.code,
    libelle: q.libelle,
    debut: (q.debut ?? "").slice(0, 5),
    fin: (q.fin ?? "").slice(0, 5),
  }));

  const ligne = sp.ligne ? lignes.find((l) => l.id === sp.ligne) : undefined;
  const postes = ligne
    ? [...(ligne.poste ?? [])].filter((p) => p.actif).sort((a, b) => a.nom.localeCompare(b.nom))
    : [];

  const initial: Record<string, { debut: string; fin: string }> = {};
  if (ligne && postes.length) {
    const { data: h } = await supabase
      .from("horaire_poste")
      .select("poste_id, quart_code, jour, debut, fin")
      .in("poste_id", postes.map((p) => p.id))
      .returns<HoraireRow[]>();
    for (const r of h ?? [])
      initial[`${r.poste_id}:${r.quart_code}:${r.jour}`] = { debut: r.debut ?? "", fin: r.fin ?? "" };
  }

  return (
    <>
      <AppHeader role={profile.role} active="/admin/horaires" />
      <div className="container" style={{ maxWidth: 1300 }}>
        <h1>Horaires des postes</h1>
        <p className="muted" style={{ marginBottom: 16 }}>
          Horaires propres à chaque poste, par quart (Matin / Après-midi / Nuit) et
          par jour de la semaine. Affichés à côté de chaque personne sur les écrans TV
          selon le quart où elle est placée. Le bouton « Défaut » reprend l&apos;horaire
          standard du quart ; « Lun → sem. » recopie le lundi ; « ↓ postes » recopie sur
          les autres postes de la ligne.
        </p>

        {/* Selection de la ligne */}
        <form className="toolbar" method="get">
          <div className="field">
            <span>Ligne</span>
            <select name="ligne" defaultValue={sp.ligne ?? ""}>
              <option value="">Choisir...</option>
              {lignes.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.atelier?.nom ? `${l.atelier.nom} / ${l.nom}` : l.nom}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-sm btn-ghost">Afficher</button>
        </form>

        {!sp.ligne ? (
          <p className="muted">Choisissez une ligne.</p>
        ) : (
          <form action={saveHoraires} autoComplete="off">
            <input type="hidden" name="ligne_id" value={sp.ligne} />
            <input type="hidden" name="poste_ids" value={postes.map((p) => p.id).join(",")} />
            <input type="hidden" name="quart_codes" value={quarts.map((q) => q.code).join(",")} />
            <HoraireGrid postes={postes.map((p) => ({ id: p.id, nom: p.nom }))} quarts={quarts} initial={initial} />
            <button type="submit" style={{ marginTop: 4, width: "auto", padding: "9px 22px" }}>
              Enregistrer les horaires
            </button>
          </form>
        )}
      </div>
    </>
  );
}
