import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import AppHeader from "@/components/AppHeader";
import {
  createAtelier,
  renameAtelier,
  toggleAtelier,
  createLigne,
  renameLigne,
  toggleLigne,
  createPoste,
  updatePoste,
  togglePoste,
} from "./actions";

type Poste = {
  id: string;
  nom: string;
  est_conducteur: boolean;
  effectif_requis: number;
  difficulte_formation: number | null;
  niveau_min_requis: number;
  actif: boolean;
};
type Ligne = { id: string; nom: string; actif: boolean; poste: Poste[] };
type Atelier = { id: string; nom: string; actif: boolean; ligne: Ligne[] };

export default async function ReferentielPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  const sp = await searchParams;
  const isEditing = (type: string, id: string) => sp.edit === `${type}:${id}`;

  const supabase = await getServerClient();
  const { data } = await supabase
    .from("atelier")
    .select(
      "id, nom, actif, ligne(id, nom, actif, poste(id, nom, est_conducteur, effectif_requis, difficulte_formation, niveau_min_requis, actif))"
    )
    .order("nom")
    .returns<Atelier[]>();

  const ateliers = (data ?? []).map((a) => ({
    ...a,
    ligne: [...(a.ligne ?? [])]
      .sort((x, y) => x.nom.localeCompare(y.nom))
      .map((l) => ({
        ...l,
        poste: [...(l.poste ?? [])].sort((x, y) => x.nom.localeCompare(y.nom)),
      })),
  }));

  const StatutTag = ({ actif, on = "Actif" }: { actif: boolean; on?: string }) => (
    <span className={actif ? "tag" : "tag tag-off"}>{actif ? on : "Desactive"}</span>
  );

  return (
    <>
      <AppHeader role={profile.role} active="/admin/referentiel" />
      <div className="container">
        <h1>Referentiel : ateliers, lignes, postes</h1>
        <p className="muted" style={{ marginBottom: 16 }}>
          Affichage en lecture seule. Cliquez sur « Modifier » pour editer un
          element. L&apos;effectif requis par poste constitue l&apos;abaque
          (ex. 1 conducteur + 3 operateurs).
        </p>

        <div className="card" style={{ marginBottom: 24 }}>
          <form action={createAtelier} className="inline-form">
            <div className="field">
              <span>Nouvel atelier</span>
              <input name="nom" placeholder="Nom de l'atelier" required />
            </div>
            <button type="submit">Ajouter</button>
          </form>
        </div>

        {ateliers.length === 0 && (
          <p className="muted">Aucun atelier. Commencez par en creer un.</p>
        )}

        {ateliers.map((a) => (
          <div key={a.id} className="card section">
            {/* En-tete atelier */}
            {isEditing("atelier", a.id) ? (
              <form action={renameAtelier} className="inline-form">
                <input type="hidden" name="id" value={a.id} />
                <div className="field">
                  <span>Nom de l&apos;atelier</span>
                  <input name="nom" defaultValue={a.nom} autoFocus required />
                </div>
                <button type="submit" className="btn-sm">Enregistrer</button>
                <Link href="/admin/referentiel" className="navlink">Annuler</Link>
              </form>
            ) : (
              <div className="toolbar">
                <strong style={{ fontSize: 16 }}>{a.nom}</strong>
                <StatutTag actif={a.actif} />
                <Link href={`/admin/referentiel?edit=atelier:${a.id}`} className="navlink">
                  Modifier
                </Link>
                <form action={toggleAtelier}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="actif" value={(!a.actif).toString()} />
                  <button type="submit" className="btn-sm btn-ghost">
                    {a.actif ? "Desactiver" : "Reactiver"}
                  </button>
                </form>
              </div>
            )}

            {/* Lignes */}
            {a.ligne.map((l) => (
              <div
                key={l.id}
                className="section"
                style={{ marginLeft: 16, borderLeft: "2px solid #eee", paddingLeft: 16 }}
              >
                {isEditing("ligne", l.id) ? (
                  <form action={renameLigne} className="inline-form">
                    <input type="hidden" name="id" value={l.id} />
                    <div className="field">
                      <span>Nom de la ligne</span>
                      <input name="nom" defaultValue={l.nom} autoFocus required />
                    </div>
                    <button type="submit" className="btn-sm">Enregistrer</button>
                    <Link href="/admin/referentiel" className="navlink">Annuler</Link>
                  </form>
                ) : (
                  <div className="toolbar">
                    <strong>{l.nom}</strong>
                    <StatutTag actif={l.actif} />
                    <Link href={`/admin/referentiel?edit=ligne:${l.id}`} className="navlink">
                      Modifier
                    </Link>
                    <form action={toggleLigne}>
                      <input type="hidden" name="id" value={l.id} />
                      <input type="hidden" name="actif" value={(!l.actif).toString()} />
                      <button type="submit" className="btn-sm btn-ghost">
                        {l.actif ? "Desactiver" : "Reactiver"}
                      </button>
                    </form>
                  </div>
                )}

                {/* Postes */}
                <table>
                  <thead>
                    <tr>
                      <th>Poste</th>
                      <th>Effectif</th>
                      <th>Conducteur</th>
                      <th>Difficulte</th>
                      <th>Niv. min</th>
                      <th>Statut</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {l.poste.map((p) =>
                      isEditing("poste", p.id) ? (
                        <tr key={p.id}>
                          <td colSpan={7}>
                            <form action={updatePoste} className="inline-form">
                              <input type="hidden" name="id" value={p.id} />
                              <div className="field">
                                <span>Nom</span>
                                <input name="nom" defaultValue={p.nom} autoFocus required />
                              </div>
                              <div className="field">
                                <span>Effectif</span>
                                <input name="effectif_requis" type="number" min={0} defaultValue={p.effectif_requis} style={{ width: 70 }} />
                              </div>
                              <div className="field">
                                <span>Conducteur</span>
                                <select name="est_conducteur" defaultValue={p.est_conducteur ? "true" : "false"}>
                                  <option value="false">Non</option>
                                  <option value="true">Oui</option>
                                </select>
                              </div>
                              <div className="field">
                                <span>Difficulte</span>
                                <select name="difficulte_formation" defaultValue={p.difficulte_formation?.toString() ?? ""}>
                                  <option value="">-</option>
                                  <option value="1">1</option>
                                  <option value="2">2</option>
                                  <option value="3">3</option>
                                </select>
                              </div>
                              <div className="field">
                                <span>Niv. min</span>
                                <select name="niveau_min_requis" defaultValue={p.niveau_min_requis.toString()}>
                                  {[0, 1, 2, 3, 4].map((n) => (
                                    <option key={n} value={n}>{n}</option>
                                  ))}
                                </select>
                              </div>
                              <button type="submit" className="btn-sm">Enregistrer</button>
                              <Link href="/admin/referentiel" className="navlink">Annuler</Link>
                            </form>
                          </td>
                        </tr>
                      ) : (
                        <tr key={p.id}>
                          <td>{p.nom}</td>
                          <td>{p.effectif_requis}</td>
                          <td>{p.est_conducteur ? "Oui" : "-"}</td>
                          <td>{p.difficulte_formation ?? "-"}</td>
                          <td>{p.niveau_min_requis}</td>
                          <td><StatutTag actif={p.actif} on="Actif" /></td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            <Link href={`/admin/referentiel?edit=poste:${p.id}`} className="navlink">
                              Modifier
                            </Link>
                            {"  "}
                            <form action={togglePoste} style={{ display: "inline", margin: 0 }}>
                              <input type="hidden" name="id" value={p.id} />
                              <input type="hidden" name="actif" value={(!p.actif).toString()} />
                              <button type="submit" className="btn-sm btn-ghost">
                                {p.actif ? "Desactiver" : "Reactiver"}
                              </button>
                            </form>
                          </td>
                        </tr>
                      )
                    )}
                    {l.poste.length === 0 && (
                      <tr>
                        <td colSpan={7} className="muted">Aucun poste sur cette ligne.</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Ajout poste */}
                <form action={createPoste} className="inline-form" style={{ marginTop: 8 }}>
                  <input type="hidden" name="ligne_id" value={l.id} />
                  <div className="field">
                    <span>Nouveau poste</span>
                    <input name="nom" placeholder="Nom du poste" required />
                  </div>
                  <div className="field">
                    <span>Effectif</span>
                    <input name="effectif_requis" type="number" min={0} defaultValue={0} style={{ width: 70 }} />
                  </div>
                  <div className="field">
                    <span>Conducteur</span>
                    <select name="est_conducteur" defaultValue="false">
                      <option value="false">Non</option>
                      <option value="true">Oui</option>
                    </select>
                  </div>
                  <div className="field">
                    <span>Difficulte</span>
                    <select name="difficulte_formation" defaultValue="">
                      <option value="">-</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                    </select>
                  </div>
                  <div className="field">
                    <span>Niv. min</span>
                    <select name="niveau_min_requis" defaultValue="0">
                      {[0, 1, 2, 3, 4].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" className="btn-sm">Ajouter poste</button>
                </form>
              </div>
            ))}

            {/* Ajout ligne */}
            <form action={createLigne} className="inline-form" style={{ marginTop: 8 }}>
              <input type="hidden" name="atelier_id" value={a.id} />
              <div className="field">
                <span>Nouvelle ligne</span>
                <input name="nom" placeholder="Nom de la ligne" required />
              </div>
              <button type="submit" className="btn-sm">Ajouter ligne</button>
            </form>
          </div>
        ))}
      </div>
    </>
  );
}
