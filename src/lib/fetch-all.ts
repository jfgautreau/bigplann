// PostgREST plafonne chaque reponse a 1000 lignes (reglage `db-max-rows` du
// projet Supabase). Au-dela, les lignes excedentaires sont omises **sans
// erreur** : `data` contient 1000 lignes, `error` vaut null, et la page affiche
// silencieusement des donnees incompletes.
//
// `fetchAll` rejoue la requete par tranches jusqu'a epuisement. La fabrique
// `makeQuery` doit poser un `.order(...)` deterministe, sinon deux tranches
// successives peuvent se recouvrir ou sauter des lignes.
export const PAGE_SIZE = 1000;

type Page<T> = { data: T[] | null; error: { message: string } | null };
type Rangeable<T> = { range(from: number, to: number): PromiseLike<Page<T>> };

export async function fetchAll<T>(makeQuery: () => Rangeable<T>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await makeQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    out.push(...batch);
    if (batch.length < PAGE_SIZE) return out;
  }
}
