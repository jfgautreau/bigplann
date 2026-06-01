// Applique les migrations SQL de supabase/migrations dans l'ordre.
// Connexion via SUPABASE_DB_URL (.env.local). Idempotent : ne rejoue pas une
// migration deja appliquee (table _migrations).
//
// Usage : node scripts/migrate.mjs
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const env = {};
for (const line of readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

const connectionString = env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("SUPABASE_DB_URL manquant dans .env.local");
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

const dir = join(root, "supabase", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

await client.connect();
await client.query(
  "create table if not exists public._migrations (name text primary key, applied_at timestamptz not null default now())"
);
const { rows } = await client.query("select name from public._migrations");
const done = new Set(rows.map((r) => r.name));

let applied = 0;
for (const f of files) {
  if (done.has(f)) {
    console.log(`= deja applique : ${f}`);
    continue;
  }
  const sql = readFileSync(join(dir, f), "utf8");
  process.stdout.write(`> application : ${f} ... `);
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query("insert into public._migrations(name) values ($1)", [f]);
    await client.query("commit");
    console.log("OK");
    applied++;
  } catch (e) {
    await client.query("rollback");
    console.error("ECHEC\n", e.message);
    await client.end();
    process.exit(1);
  }
}

await client.end();
console.log(`\nTermine. ${applied} migration(s) appliquee(s), ${files.length} au total.`);
