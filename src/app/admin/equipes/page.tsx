import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import AppHeader from "@/components/AppHeader";
import { requireModule } from "@/lib/permissions";
import {
  createEquipe,
  renameEquipe,
  toggleEquipe,
  addChef,
  removeChef,
} from "./actions";

type Chef = { id: string; app_user_id: string };
type Equipe = { id: string; nom: string; actif: boolean; couleur: string; equipe_chef: Chef[] };
type AppUser = { user_id: string; name: string; email: string };

export default async function EquipesPage() {
  const { profile } = await requireModule("equipes", "write");

  const supabase = await getServerClient();
  const [{ data: equipesData }, { data: usersData }] = await Promise.all([
    supabase
      .from("equipe")
      .select("id, nom, actif, couleur, equipe_chef(id, app_user_id)")
      .order("nom")
      .returns<Equipe[]>(),
    supabase
      .from("app_user")
      .select("user_id, name, email")
      .order("name")
      .returns<AppUser[]>(),
  ]);

  const equipes = equipesData ?? [];
  const users = usersData ?? [];
  const userLabel = (id: string) => {
    const u = users.find((x) => x.user_id === id);
    return u ? u.name || u.email : id;
  };

  return (
    <>
      <AppHeader role={profile.role} active="/admin/equipes" />
      <div className="container">
        <h1>Équipes</h1>

        <div className="card" style={{ marginBottom: 24 }}>
          <form action={createEquipe} autoComplete="off" className="inline-form">
            <div className="field">
              <span>Nouvelle équipe</span>
              <input name="nom" placeholder="Ex. Équipe A, Nuit..." required />
            </div>
            <div className="field">
              <span>Couleur</span>
              <input name="couleur" type="color" defaultValue="#16a34a" style={{ width: 48, padding: 2 }} />
            </div>
            <button type="submit">Ajouter</button>
          </form>
        </div>

        {equipes.length === 0 && <p className="muted">Aucune équipe.</p>}

        {equipes.map((e) => (
          <div key={e.id} className="card section">
            <div className="toolbar">
              <form action={renameEquipe} autoComplete="off" className="inline-form">
                <input type="hidden" name="id" value={e.id} />
                <span
                  style={{ display: "inline-block", width: 16, height: 16, borderRadius: 4, background: e.couleur, border: "1px solid #cbd5e1" }}
                />
                <input name="nom" defaultValue={e.nom} />
                <input name="couleur" type="color" defaultValue={e.couleur} style={{ width: 44, padding: 2 }} />
                <button type="submit" className="btn-sm btn-ghost">
                  Enregistrer
                </button>
              </form>
              <span className={e.actif ? "tag" : "tag tag-off"}>
                {e.actif ? "Active" : "Désactivée"}
              </span>
              <form action={toggleEquipe}>
                <input type="hidden" name="id" value={e.id} />
                <input type="hidden" name="actif" value={(!e.actif).toString()} />
                <button type="submit" className="btn-sm btn-ghost">
                  {e.actif ? "Désactiver" : "Réactiver"}
                </button>
              </form>
            </div>

            <h2 style={{ fontSize: 14, marginTop: 8 }}>Chefs d&apos;équipe</h2>
            {e.equipe_chef.length === 0 && (
              <p className="muted">Aucun chef désigné.</p>
            )}
            <ul style={{ margin: "4px 0 12px", paddingLeft: 18 }}>
              {e.equipe_chef.map((c) => (
                <li key={c.id} style={{ marginBottom: 4 }}>
                  {userLabel(c.app_user_id)}{" "}
                  <form action={removeChef} style={{ display: "inline", margin: 0 }}>
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" className="btn-sm btn-ghost">
                      Retirer
                    </button>
                  </form>
                </li>
              ))}
            </ul>

            <form action={addChef} autoComplete="off" className="inline-form">
              <input type="hidden" name="equipe_id" value={e.id} />
              <div className="field">
                <span>Désigner un chef</span>
                <select name="app_user_id" required defaultValue="">
                  <option value="" disabled>
                    Choisir un utilisateur...
                  </option>
                  {users.map((u) => (
                    <option key={u.user_id} value={u.user_id}>
                      {u.name || u.email}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn-sm">
                Ajouter
              </button>
            </form>
          </div>
        ))}
      </div>
    </>
  );
}
