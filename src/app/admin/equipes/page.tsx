import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import AppHeader from "@/components/AppHeader";
import {
  createEquipe,
  renameEquipe,
  toggleEquipe,
  addChef,
  removeChef,
} from "./actions";

type Chef = { id: string; app_user_id: string };
type Equipe = { id: string; nom: string; actif: boolean; equipe_chef: Chef[] };
type AppUser = { user_id: string; name: string; email: string };

export default async function EquipesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  const supabase = await getServerClient();
  const [{ data: equipesData }, { data: usersData }] = await Promise.all([
    supabase
      .from("equipe")
      .select("id, nom, actif, equipe_chef(id, app_user_id)")
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
        <h1>Equipes</h1>

        <div className="card" style={{ marginBottom: 24 }}>
          <form action={createEquipe} autoComplete="off" className="inline-form">
            <div className="field">
              <span>Nouvelle equipe</span>
              <input name="nom" placeholder="Ex. Equipe A, Nuit..." required />
            </div>
            <button type="submit">Ajouter</button>
          </form>
        </div>

        {equipes.length === 0 && <p className="muted">Aucune equipe.</p>}

        {equipes.map((e) => (
          <div key={e.id} className="card section">
            <div className="toolbar">
              <form action={renameEquipe} autoComplete="off" className="inline-form">
                <input type="hidden" name="id" value={e.id} />
                <input name="nom" defaultValue={e.nom} />
                <button type="submit" className="btn-sm btn-ghost">
                  Renommer
                </button>
              </form>
              <span className={e.actif ? "tag" : "tag tag-off"}>
                {e.actif ? "Active" : "Desactivee"}
              </span>
              <form action={toggleEquipe}>
                <input type="hidden" name="id" value={e.id} />
                <input type="hidden" name="actif" value={(!e.actif).toString()} />
                <button type="submit" className="btn-sm btn-ghost">
                  {e.actif ? "Desactiver" : "Reactiver"}
                </button>
              </form>
            </div>

            <h2 style={{ fontSize: 14, marginTop: 8 }}>Chefs d&apos;equipe</h2>
            {e.equipe_chef.length === 0 && (
              <p className="muted">Aucun chef designe.</p>
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
                <span>Designer un chef</span>
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
