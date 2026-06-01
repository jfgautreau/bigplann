import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

// Lazy singleton : ne cree le client qu'une seule fois, et seulement si les
// variables d'environnement sont presentes. Evite que le build prerender
// echoue quand les env vars ne sont pas disponibles (build local sans .env.local).
let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Variables Supabase manquantes : NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY"
    );
  }
  _client = createBrowserClient(supabaseUrl, supabaseAnonKey);
  return _client;
}

// Proxy : toute interaction avec `supabase.xxx` declenche getClient() au moment
// de l'utilisation, jamais a l'import. Garde l'API standard inchangee.
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
