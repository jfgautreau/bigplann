import { getServerClient } from "@/lib/supabase-server";
import AppHeader from "@/components/AppHeader";
import { requireModule } from "@/lib/permissions";
import { saveHoraires } from "./actions";
import HoraireGrid from "./HoraireGrid";

type PosteRow = { id: string; nom: string; actif: boolean };
type LigneRow = { id: string; nom: string; atelier: { nom: string } | null; poste: PosteRow[] };
type Equipe = { id: string; nom: string };
type HoraireRow = { poste_id: string; jour: number; debut: string | null; fin: string | null };

export default async function HorairesPage({
  searchParams,
}: {
  searchParams: Promise<{ ligne?: string; equipe?: string }>;
}) {
  const { profile } = await requireModule("horaires", "write");
  const sp = await searchParams;

  const supabase = await getServerClient();
  const [{ data: lignesD }, { data: equipesD }] = await Promise.all([
    supabase
      .from("ligne")
      .select("id, nom, atelier:atelier_id(nom), poste(id, nom, actif)")
      .eq("actif", true)
      .order("nom")
      .returns<LigneRow[]>(),
    supabase.from("equipe").select("id, nom").eq("actif", true).order("nom").returns<Equipe[]>(),
  ]);
  const lignes = lignesD ?? [];
  const equipes = equipesD ?? [];

  const ligne = sp.ligne ? lignes.find((l) => l.id === sp.ligne) : undefined;
  const postes = ligne
    ? [...(ligne.poste ?? [])].filter((p) => p.actif).sort((a, b) => a.nom.localeCompare(b.nom))
    : [];

  const initial: Record<string, { debut: string; fin: string }> = {};
  if (ligne && sp.equipe && postes.length) {
    const { data: h } = await supabase
      .from("horaire_poste")
      .select("poste_id, jour, debut, fin")
      .eq("equipe_id", sp.equipe)
      .in("poste_id", postes.map((p) => p.id))
      .returns<HoraireRow[]>();
    for (const r of h ?? [])
      initial[`${r.poste_id}:${r.jour}`] = { debut: r.debut ?? "", fin: r.fin ?? "" };
  }

  return (
    <>
      <AppHeader role={profile.role} active="/admin/horaires" />
      <div className="container" style={{ maxWidth: 1300 }}>
        <h1>Horaires de travail</h1>
        <p className="muted" style={{ marginBottom: 16 }}>
          Horaires par poste, par équipe et par jour de la semaine (modèle
          hebdomadaire). Affichés à côté de chaque personne sur les écrans TV.
          Pour chaque case : heure de début (haut) et de fin (bas).
        </p>

        {/* Selection ligne + equipe */}
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
          <div className="field">
            <span>Équipe</span>
            <select name="equipe" defaultValue={sp.equipe ?? ""}>
              <option value="">Choisir...</option>
              {equipes.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nom}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-sm btn-ghost">Afficher</button>
        </form>

        {!sp.ligne || !sp.equipe ? (
          <p className="muted">Choisissez une ligne et une équipe.</p>
        ) : (
          <div className="card">
            <form action={saveHoraires} autoComplete="off">
              <input type="hidden" name="ligne_id" value={sp.ligne} />
              <input type="hidden" name="equipe_id" value={sp.equipe} />
              <input type="hidden" name="poste_ids" value={postes.map((p) => p.id).join(",")} />
              <HoraireGrid postes={postes.map((p) => ({ id: p.id, nom: p.nom }))} initial={initial} />
              <button type="submit" style={{ marginTop: 14, width: "auto", padding: "9px 22px" }}>
                Enregistrer les horaires
              </button>
            </form>
          </div>
        )}
      </div>
    </>
  );
}
