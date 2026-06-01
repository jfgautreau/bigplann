import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import AppHeader from "@/components/AppHeader";
import {
  saveEchelle,
  createCompetence,
  updateCompetence,
  toggleCompetence,
} from "./actions";

type Niveau = { niveau: number; libelle: string };
type Competence = {
  id: string;
  nom: string;
  type: string;
  a_recycler: boolean;
  duree_validite_mois: number | null;
  actif: boolean;
};

export default async function CompetencesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  const sp = await searchParams;
  const supabase = await getServerClient();

  const [{ data: niveauxData }, { data: compData }] = await Promise.all([
    supabase
      .from("competence_niveau_libelle")
      .select("niveau, libelle")
      .order("niveau")
      .returns<Niveau[]>(),
    supabase
      .from("competence")
      .select("id, nom, type, a_recycler, duree_validite_mois, actif")
      .order("nom")
      .returns<Competence[]>(),
  ]);

  const niveaux = niveauxData ?? [];
  const comps = compData ?? [];
  const libelle = (n: number) => niveaux.find((x) => x.niveau === n)?.libelle ?? "";

  return (
    <>
      <AppHeader role={profile.role} active="/admin/competences" />
      <div className="container">
        <h1>Competences</h1>

        {/* Echelle de niveaux */}
        <div className="card section">
          <h2>Echelle de niveaux (carre magique)</h2>
          <p className="muted">Libelles parametrables des niveaux 0 a 4.</p>
          <form action={saveEchelle} autoComplete="off">
            {[0, 1, 2, 3, 4].map((n) => (
              <div key={n} style={{ marginBottom: 8 }}>
                <label htmlFor={`niveau_${n}`}>Niveau {n}</label>
                <input id={`niveau_${n}`} name={`niveau_${n}`} defaultValue={libelle(n)} required />
              </div>
            ))}
            <button type="submit">Enregistrer l&apos;echelle</button>
          </form>
        </div>

        {/* Competences transverses / habilitations */}
        <div className="card section">
          <h2>Competences transverses et habilitations</h2>
          <p className="muted">
            Type NIVEAU (0-4) ou ACQUIS (oui/non). Cocher « a recycler » pour une
            habilitation a duree de validite (le suivi des echeances arrive au lot suivant).
          </p>
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Type</th>
                <th>A recycler</th>
                <th>Validite (mois)</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {comps.map((c) =>
                sp.edit === `competence:${c.id}` ? (
                  <tr key={c.id}>
                    <td colSpan={6}>
                      <form action={updateCompetence} autoComplete="off" className="inline-form">
                        <input type="hidden" name="id" value={c.id} />
                        <div className="field">
                          <span>Nom</span>
                          <input name="nom" defaultValue={c.nom} autoFocus required />
                        </div>
                        <div className="field">
                          <span>Type</span>
                          <select name="type" defaultValue={c.type}>
                            <option value="NIVEAU">Niveau (0-4)</option>
                            <option value="ACQUIS">Acquis (oui/non)</option>
                          </select>
                        </div>
                        <div className="field">
                          <span>A recycler</span>
                          <select name="a_recycler" defaultValue={c.a_recycler ? "true" : "false"}>
                            <option value="false">Non</option>
                            <option value="true">Oui</option>
                          </select>
                        </div>
                        <div className="field">
                          <span>Validite (mois)</span>
                          <input
                            name="duree_validite_mois"
                            type="number"
                            min={1}
                            defaultValue={c.duree_validite_mois ?? ""}
                            style={{ width: 90 }}
                          />
                        </div>
                        <button type="submit" className="btn-sm">Enregistrer</button>
                        <Link href="/admin/competences" className="navlink">Annuler</Link>
                      </form>
                    </td>
                  </tr>
                ) : (
                  <tr key={c.id}>
                    <td>{c.nom}</td>
                    <td>{c.type === "ACQUIS" ? "Acquis" : "Niveau"}</td>
                    <td>{c.a_recycler ? "Oui" : "-"}</td>
                    <td>{c.duree_validite_mois ?? "-"}</td>
                    <td>
                      <span className={c.actif ? "tag" : "tag tag-off"}>
                        {c.actif ? "Actif" : "Desactive"}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <Link href={`/admin/competences?edit=competence:${c.id}`} className="navlink">
                        Modifier
                      </Link>
                      {"  "}
                      <form action={toggleCompetence} style={{ display: "inline", margin: 0 }}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="actif" value={(!c.actif).toString()} />
                        <button type="submit" className="btn-sm btn-ghost">
                          {c.actif ? "Desactiver" : "Reactiver"}
                        </button>
                      </form>
                    </td>
                  </tr>
                )
              )}
              {comps.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">Aucune competence.</td>
                </tr>
              )}
            </tbody>
          </table>

          <form action={createCompetence} autoComplete="off" className="inline-form" style={{ marginTop: 12 }}>
            <div className="field">
              <span>Nouvelle competence</span>
              <input name="nom" placeholder="Ex. Tuteur, EPI, Incendie..." required />
            </div>
            <div className="field">
              <span>Type</span>
              <select name="type" defaultValue="NIVEAU">
                <option value="NIVEAU">Niveau (0-4)</option>
                <option value="ACQUIS">Acquis (oui/non)</option>
              </select>
            </div>
            <div className="field">
              <span>A recycler</span>
              <select name="a_recycler" defaultValue="false">
                <option value="false">Non</option>
                <option value="true">Oui</option>
              </select>
            </div>
            <div className="field">
              <span>Validite (mois)</span>
              <input name="duree_validite_mois" type="number" min={1} style={{ width: 90 }} />
            </div>
            <button type="submit" className="btn-sm">Ajouter</button>
          </form>
        </div>
      </div>
    </>
  );
}
