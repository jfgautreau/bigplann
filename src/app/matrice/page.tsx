import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import AppHeader from "@/components/AppHeader";
import { saveMatriceRow } from "./actions";

type Ligne = { id: string; nom: string; atelier: { nom: string } | null };
type Poste = { id: string; nom: string };
type Personne = { id: string; nom: string; prenom: string; equipe_id: string | null };
type MatriceRow = {
  personne_id: string;
  poste_id: string;
  niveau_actuel: number;
  niveau_cible: number;
};
type Equipe = { id: string; nom: string };

const LEVELS = [0, 1, 2, 3, 4];

export default async function MatricePage({
  searchParams,
}: {
  searchParams: Promise<{ ligne?: string; equipe?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const sp = await searchParams;
  const supabase = await getServerClient();

  const [{ data: lignesData }, { data: equipesData }] = await Promise.all([
    supabase
      .from("ligne")
      .select("id, nom, atelier:atelier_id(nom)")
      .eq("actif", true)
      .order("nom")
      .returns<Ligne[]>(),
    supabase.from("equipe").select("id, nom").eq("actif", true).order("nom").returns<Equipe[]>(),
  ]);
  const lignes = lignesData ?? [];
  const equipes = equipesData ?? [];

  // Perimetre d'edition
  const isAdmin = profile.role === "admin";
  let chefEquipes = new Set<string>();
  if (!isAdmin) {
    const { data } = await supabase
      .from("equipe_chef")
      .select("equipe_id")
      .eq("app_user_id", profile.authId)
      .returns<{ equipe_id: string }[]>();
    chefEquipes = new Set((data ?? []).map((r) => r.equipe_id));
  }

  let postes: Poste[] = [];
  let personnes: Personne[] = [];
  const niv = new Map<string, MatriceRow>();

  if (sp.ligne) {
    const [{ data: postesData }, personnesRes] = await Promise.all([
      supabase
        .from("poste")
        .select("id, nom")
        .eq("ligne_id", sp.ligne)
        .eq("actif", true)
        .order("nom")
        .returns<Poste[]>(),
      (async () => {
        let q = supabase
          .from("personne")
          .select("id, nom, prenom, equipe_id")
          .eq("statut", "ACTIF")
          .order("nom");
        if (sp.equipe) q = q.eq("equipe_id", sp.equipe);
        return q.returns<Personne[]>();
      })(),
    ]);
    postes = postesData ?? [];
    personnes = personnesRes.data ?? [];

    if (postes.length && personnes.length) {
      const { data: m } = await supabase
        .from("matrice")
        .select("personne_id, poste_id, niveau_actuel, niveau_cible")
        .in(
          "personne_id",
          personnes.map((p) => p.id)
        )
        .in(
          "poste_id",
          postes.map((p) => p.id)
        )
        .returns<MatriceRow[]>();
      for (const r of m ?? []) niv.set(`${r.personne_id}:${r.poste_id}`, r);
    }
  }

  const canEdit = (p: Personne) =>
    isAdmin || (p.equipe_id != null && chefEquipes.has(p.equipe_id));

  return (
    <>
      <AppHeader role={profile.role} active="/matrice" />
      <div className="container">
        <div className="toolbar">
          <h1 style={{ margin: 0 }}>Matrice de polyvalence</h1>
          <Link href="/matrice/bilan" className="navlink">
            Voir le bilan &rarr;
          </Link>
        </div>

        {/* Selection */}
        <form className="toolbar" method="get">
          <div className="field">
            <span>Ligne</span>
            <select name="ligne" defaultValue={sp.ligne ?? ""}>
              <option value="">Choisir une ligne...</option>
              {lignes.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.atelier?.nom ? `${l.atelier.nom} / ` : ""}
                  {l.nom}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <span>Equipe</span>
            <select name="equipe" defaultValue={sp.equipe ?? ""}>
              <option value="">Toutes</option>
              {equipes.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nom}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-sm btn-ghost">
            Afficher
          </button>
        </form>

        {!sp.ligne && (
          <p className="muted">Choisissez une ligne pour afficher ses postes.</p>
        )}

        {sp.ligne && postes.length === 0 && (
          <p className="muted">Aucun poste actif sur cette ligne.</p>
        )}

        {sp.ligne && postes.length > 0 && (
          <div className="card" style={{ overflowX: "auto" }}>
            <p className="muted" style={{ marginBottom: 8 }}>
              Pour chaque poste : <strong>A</strong> = niveau actuel,{" "}
              <strong>C</strong> = niveau cible (0 a 4). Enregistrement par ligne.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Personne</th>
                  {postes.map((p) => (
                    <th key={p.id}>{p.nom}</th>
                  ))}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {personnes.map((pers) => {
                  const editable = canEdit(pers);
                  const label = `${pers.nom} ${pers.prenom}`;
                  if (!editable) {
                    return (
                      <tr key={pers.id}>
                        <td>{label}</td>
                        {postes.map((po) => {
                          const r = niv.get(`${pers.id}:${po.id}`);
                          return (
                            <td key={po.id}>
                              {r ? `${r.niveau_actuel} / ${r.niveau_cible}` : "0 / 0"}
                            </td>
                          );
                        })}
                        <td className="muted">lecture</td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={pers.id}>
                      <td>
                        <form
                          action={saveMatriceRow}
                          id={`f-${pers.id}`}
                          style={{ margin: 0 }}
                        >
                          <input type="hidden" name="personne_id" value={pers.id} />
                          {label}
                        </form>
                      </td>
                      {postes.map((po) => {
                        const r = niv.get(`${pers.id}:${po.id}`);
                        return (
                          <td key={po.id} style={{ whiteSpace: "nowrap" }}>
                            A
                            <select
                              form={`f-${pers.id}`}
                              name={`actuel_${po.id}`}
                              defaultValue={String(r?.niveau_actuel ?? 0)}
                              style={{ width: 48, marginRight: 4 }}
                            >
                              {LEVELS.map((n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              ))}
                            </select>
                            C
                            <select
                              form={`f-${pers.id}`}
                              name={`cible_${po.id}`}
                              defaultValue={String(r?.niveau_cible ?? 0)}
                              style={{ width: 48 }}
                            >
                              {LEVELS.map((n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              ))}
                            </select>
                          </td>
                        );
                      })}
                      <td>
                        <button type="submit" form={`f-${pers.id}`} className="btn-sm">
                          Enregistrer
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {personnes.length === 0 && (
                  <tr>
                    <td colSpan={postes.length + 2} className="muted">
                      Aucune personne active.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
