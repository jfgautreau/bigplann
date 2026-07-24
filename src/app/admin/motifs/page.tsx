import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import AppHeader from "@/components/AppHeader";
import { requireModule, canWrite } from "@/lib/permissions";
import LectureSeule from "@/components/LectureSeule";
import {
  createMotif, updateMotif, toggleMotif,
  createAgence, updateAgence, toggleAgence,
  createTypeContrat, updateTypeContrat, toggleTypeContrat,
  updateFenetreAffichage,
} from "./actions";
import AjoutModal from "./AjoutModal";
import BandeauErreur from "@/components/BandeauErreur";

type Motif = {
  id: string;
  libelle: string;
  code_court: string;
  couleur: string;
  actif: boolean;
};

type Agence = { id: string; nom: string; actif: boolean };
type TypeContrat = { code: string; libelle: string; actif: boolean; ordre: number };
type FenetreAffichage = { jours_avant: number; jours_apres: number };

export default async function MotifsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; err?: string }>;
}) {
  const { profile, perms } = await requireModule("motifs", "read");

  const sp = await searchParams;
  const supabase = await getServerClient();
  const [{ data }, agencesR, typesR, fenR] = await Promise.all([
    supabase
      .from("motif_absence")
      .select("id, libelle, code_court, couleur, actif")
      .order("libelle")
      .returns<Motif[]>(),
    // Best-effort : la table arrive en 0034, l'ecran ne doit pas tomber si la
    // migration n'a pas encore ete passee.
    supabase.from("agence_interim").select("id, nom, actif").order("nom").returns<Agence[]>(),
    // Migration 0040.
    supabase.from("type_contrat").select("code, libelle, actif, ordre").order("ordre").returns<TypeContrat[]>(),
    supabase.from("parametre_affichage").select("jours_avant, jours_apres").eq("id", 1).maybeSingle<FenetreAffichage>(),
  ]);
  const motifs = data ?? [];
  const agences = agencesR.data ?? [];
  const agencesIndispo = !!agencesR.error;
  const types = typesR.data ?? [];
  const typesIndispo = !!typesR.error;
  const fenetre: FenetreAffichage = fenR.data ?? { jours_avant: 1, jours_apres: 4 };
  const fenetreIndispo = !!fenR.error;

  return (
    <>
      <AppHeader role={profile.role} active="/admin/motifs" />
      <div className="container">
        <h1>Paramètres RH</h1>
        <BandeauErreur message={sp.err} />
        <LectureSeule actif={!canWrite(perms, "motifs")}>
        <h2 style={{ marginBottom: 4 }}>Motifs d&apos;absence</h2>
        <p className="muted" style={{ marginBottom: 16 }}>
          Ces motifs apparaissent dans les listes du planning. Le comptage en
          rapports sera ajouté ultérieurement.
        </p>

        <AjoutModal libelle="Ajouter un motif" titre="Ajouter un motif d'absence">
          <form action={createMotif} autoComplete="off" className="inline-form">
            <div className="field">
              <span>Couleur</span>
              <input name="couleur" type="color" defaultValue="#e5e7eb" style={{ width: 48, padding: 2 }} />
            </div>
            <div className="field">
              <span>Libellé</span>
              <input name="libelle" placeholder="Ex. Congé payé" required />
            </div>
            <div className="field">
              <span>Code</span>
              <input name="code_court" placeholder="CP" maxLength={6} required />
            </div>
            <button type="submit" className="btn-sm">Ajouter</button>
          </form>
        </AjoutModal>

        <div className="card" style={{ marginBottom: 24 }}>
          <table>
            <thead>
              <tr>
                <th>Couleur</th>
                <th>Libellé</th>
                <th>Code</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {motifs.map((m) =>
                sp.edit === `motif:${m.id}` ? (
                  <tr key={m.id}>
                    <td colSpan={5}>
                      <form action={updateMotif} autoComplete="off" className="inline-form">
                        <input type="hidden" name="id" value={m.id} />
                        <div className="field">
                          <span>Couleur</span>
                          <input name="couleur" type="color" defaultValue={m.couleur} style={{ width: 48, padding: 2 }} />
                        </div>
                        <div className="field">
                          <span>Libellé</span>
                          <input name="libelle" defaultValue={m.libelle} autoFocus required />
                        </div>
                        <div className="field">
                          <span>Code</span>
                          <input name="code_court" defaultValue={m.code_court} maxLength={6} style={{ width: 80 }} required />
                        </div>
                        <button type="submit" className="btn-sm">Enregistrer</button>
                        <Link href="/admin/motifs" className="navlink" scroll={false}>Annuler</Link>
                      </form>
                    </td>
                  </tr>
                ) : (
                  <tr key={m.id}>
                    <td>
                      <span style={{ display: "inline-block", width: 20, height: 14, borderRadius: 3, background: m.couleur, border: "1px solid #cbd5e1" }} />
                    </td>
                    <td>{m.libelle}</td>
                    <td><strong>{m.code_court}</strong></td>
                    <td>
                      <span className={m.actif ? "tag" : "tag tag-off"}>{m.actif ? "Actif" : "Désactivé"}</span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <Link href={`/admin/motifs?edit=motif:${m.id}`} className="navlink" scroll={false} prefetch={false}>Modifier</Link>
                      {"  "}
                      <form action={toggleMotif} style={{ display: "inline", margin: 0 }}>
                        <input type="hidden" name="id" value={m.id} />
                        <input type="hidden" name="actif" value={(!m.actif).toString()} />
                        <button type="submit" className="btn-sm btn-ghost">
                          {m.actif ? "Désactiver" : "Réactiver"}
                        </button>
                      </form>
                    </td>
                  </tr>
                )
              )}
              {motifs.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">Aucun motif.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ---------------- Agences d'interim ---------------- */}
        <h2 style={{ marginTop: 32, marginBottom: 4 }}>Agences d&apos;intérim</h2>
        <p className="muted" style={{ marginBottom: 16 }}>
          Cette liste alimente le menu déroulant <strong>Agence</strong> à la saisie d&apos;un
          contrat d&apos;intérim, dans Personnel. Une agence avec laquelle on ne travaille plus
          se <strong>désactive</strong> : elle disparaît du menu, mais les contrats passés qui
          la mentionnent restent intacts.
        </p>

        {agencesIndispo ? (
          <div className="card" style={{ marginBottom: 24 }}>
            <p className="muted" style={{ margin: 0 }}>
              La table des agences n&apos;existe pas encore : exécutez la migration{" "}
              <strong>0034_agence_interim.sql</strong> dans le SQL Editor.
            </p>
          </div>
        ) : (
          <>
            <AjoutModal libelle="Ajouter une agence" titre="Ajouter une agence d'intérim">
              <form action={createAgence} autoComplete="off" className="inline-form">
                <div className="field">
                  <span>Nom</span>
                  <input name="nom" placeholder="Ex. Adecco" required />
                </div>
                <button type="submit" className="btn-sm">Ajouter</button>
              </form>
            </AjoutModal>

            <div className="card" style={{ marginBottom: 24 }}>
              <table>
                <thead>
                  <tr>
                    <th>Agence</th>
                    <th>Statut</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {agences.map((a) =>
                    sp.edit === `agence:${a.id}` ? (
                      <tr key={a.id}>
                        <td colSpan={3}>
                          <form action={updateAgence} autoComplete="off" className="inline-form">
                            <input type="hidden" name="id" value={a.id} />
                            <div className="field">
                              <span>Nom</span>
                              <input name="nom" defaultValue={a.nom} autoFocus required />
                            </div>
                            <button type="submit" className="btn-sm">Enregistrer</button>
                            <Link href="/admin/motifs" className="navlink" scroll={false}>Annuler</Link>
                          </form>
                        </td>
                      </tr>
                    ) : (
                      <tr key={a.id}>
                        <td>{a.nom}</td>
                        <td>
                          <span className={a.actif ? "tag" : "tag tag-off"}>{a.actif ? "Active" : "Désactivée"}</span>
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <Link href={`/admin/motifs?edit=agence:${a.id}`} className="navlink" scroll={false} prefetch={false}>Modifier</Link>
                          {"  "}
                          <form action={toggleAgence} style={{ display: "inline", margin: 0 }}>
                            <input type="hidden" name="id" value={a.id} />
                            <input type="hidden" name="actif" value={(!a.actif).toString()} />
                            <button type="submit" className="btn-sm btn-ghost">
                              {a.actif ? "Désactiver" : "Réactiver"}
                            </button>
                          </form>
                        </td>
                      </tr>
                    )
                  )}
                  {agences.length === 0 && (
                    <tr>
                      <td colSpan={3} className="muted">Aucune agence.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </>
        )}

        {/* ---------------- Types de contrat (0040) ---------------- */}
        <h2 style={{ marginTop: 32, marginBottom: 4 }}>Types de contrat</h2>
        <p className="muted" style={{ marginBottom: 16 }}>
          Alimente le menu déroulant <strong>Contrat</strong> dans Personnel et dans les périodes
          de contrat. Le <strong>code</strong> est ce qui est stocké sur chaque personne
          (« CDI », « CDD », « INTERIM »…). Retirer un type n&apos;efface pas l&apos;historique :
          désactiver le fait disparaître du menu.
        </p>

        {typesIndispo ? (
          <div className="card" style={{ marginBottom: 24 }}>
            <p className="muted" style={{ margin: 0 }}>
              La table des types de contrat n&apos;existe pas encore : exécutez la migration{" "}
              <strong>0040_types_contrat_et_affichage.sql</strong> dans le SQL Editor.
            </p>
          </div>
        ) : (
          <>
            <AjoutModal libelle="Ajouter un type" titre="Ajouter un type de contrat">
              <form action={createTypeContrat} autoComplete="off" className="inline-form">
                <div className="field">
                  <span>Code</span>
                  <input name="code" placeholder="Ex. ALTERNANCE" maxLength={20} required style={{ textTransform: "uppercase" }} />
                </div>
                <div className="field">
                  <span>Libellé</span>
                  <input name="libelle" placeholder="Ex. Alternance" required />
                </div>
                <div className="field">
                  <span>Ordre</span>
                  <input name="ordre" type="number" defaultValue={99} min={0} max={999} style={{ width: 80 }} />
                </div>
                <button type="submit" className="btn-sm">Ajouter</button>
              </form>
            </AjoutModal>

            <div className="card" style={{ marginBottom: 24 }}>
              <table>
                <thead>
                  <tr><th>Code</th><th>Libellé</th><th>Ordre</th><th>Statut</th><th></th></tr>
                </thead>
                <tbody>
                  {types.map((t) =>
                    sp.edit === `type:${t.code}` ? (
                      <tr key={t.code}>
                        <td colSpan={5}>
                          <form action={updateTypeContrat} autoComplete="off" className="inline-form">
                            <input type="hidden" name="code" value={t.code} />
                            <div className="field"><span>Code</span><strong>{t.code}</strong></div>
                            <div className="field"><span>Libellé</span><input name="libelle" defaultValue={t.libelle} autoFocus required /></div>
                            <div className="field"><span>Ordre</span><input name="ordre" type="number" defaultValue={t.ordre} style={{ width: 80 }} /></div>
                            <button type="submit" className="btn-sm">Enregistrer</button>
                            <Link href="/admin/motifs" className="navlink" scroll={false}>Annuler</Link>
                          </form>
                        </td>
                      </tr>
                    ) : (
                      <tr key={t.code}>
                        <td><strong>{t.code}</strong></td>
                        <td>{t.libelle}</td>
                        <td>{t.ordre}</td>
                        <td><span className={t.actif ? "tag" : "tag tag-off"}>{t.actif ? "Actif" : "Désactivé"}</span></td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <Link href={`/admin/motifs?edit=type:${t.code}`} className="navlink" scroll={false} prefetch={false}>Modifier</Link>
                          {"  "}
                          <form action={toggleTypeContrat} style={{ display: "inline", margin: 0 }}>
                            <input type="hidden" name="code" value={t.code} />
                            <input type="hidden" name="actif" value={(!t.actif).toString()} />
                            <button type="submit" className="btn-sm btn-ghost">{t.actif ? "Désactiver" : "Réactiver"}</button>
                          </form>
                        </td>
                      </tr>
                    )
                  )}
                  {types.length === 0 && (<tr><td colSpan={5} className="muted">Aucun type.</td></tr>)}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ---------------- Fenêtre d'affichage du planning (0040) ---------------- */}
        <h2 style={{ marginTop: 32, marginBottom: 4 }}>Fenêtre d&apos;affichage du planning</h2>
        <p className="muted" style={{ marginBottom: 16 }}>
          Nombre de jours affichés autour d&apos;aujourd&apos;hui sur l&apos;écran TV et les vues
          glissantes du planning. Défaut : <strong>J−1</strong> et <strong>J+4</strong>.
        </p>

        {fenetreIndispo ? (
          <div className="card" style={{ marginBottom: 24 }}>
            <p className="muted" style={{ margin: 0 }}>
              La table des paramètres d&apos;affichage n&apos;existe pas encore : exécutez la migration{" "}
              <strong>0040_types_contrat_et_affichage.sql</strong> dans le SQL Editor.
            </p>
          </div>
        ) : (
          <div className="card" style={{ marginBottom: 24 }}>
            <form action={updateFenetreAffichage} autoComplete="off" className="inline-form">
              <div className="field">
                <span>Jours avant J (0-14)</span>
                <input name="jours_avant" type="number" min={0} max={14} defaultValue={fenetre.jours_avant} style={{ width: 90 }} required />
              </div>
              <div className="field">
                <span>Jours après J (0-30)</span>
                <input name="jours_apres" type="number" min={0} max={30} defaultValue={fenetre.jours_apres} style={{ width: 90 }} required />
              </div>
              <button type="submit" className="btn-sm">Enregistrer</button>
            </form>
          </div>
        )}
        </LectureSeule>
      </div>
    </>
  );
}
