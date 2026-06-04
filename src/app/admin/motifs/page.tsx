import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import AppHeader from "@/components/AppHeader";
import { requireModule } from "@/lib/permissions";
import { createMotif, updateMotif, toggleMotif } from "./actions";

type Motif = {
  id: string;
  libelle: string;
  code_court: string;
  couleur: string;
  actif: boolean;
};

export default async function MotifsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { profile } = await requireModule("motifs", "write");

  const sp = await searchParams;
  const supabase = await getServerClient();
  const { data } = await supabase
    .from("motif_absence")
    .select("id, libelle, code_court, couleur, actif")
    .order("libelle")
    .returns<Motif[]>();
  const motifs = data ?? [];

  return (
    <>
      <AppHeader role={profile.role} active="/admin/motifs" />
      <div className="container">
        <h1>Motifs d&apos;absence</h1>
        <p className="muted" style={{ marginBottom: 16 }}>
          Ces motifs apparaissent dans les listes du planning. Le comptage en
          rapports sera ajouté ultérieurement.
        </p>

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
                      <Link href={`/admin/motifs?edit=motif:${m.id}`} className="navlink" scroll={false}>Modifier</Link>
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

        <div className="card">
          <h2>Ajouter un motif</h2>
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
        </div>
      </div>
    </>
  );
}
