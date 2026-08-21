const XLSX = require("xlsx");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: "C:\\dev\\planning-usine\\.env.local" });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const norm = (s) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z ]/g, "").replace(/\s+/g, " ").trim();

const excelToIso = (serial) => {
  if (!serial) return null;
  const d = new Date((serial - 25569) * 86400 * 1000);
  return d.toISOString().slice(0, 10);
};

async function main() {
  const wb = XLSX.readFile("C:\\Users\\jfgau\\AppData\\Local\\Temp\\Liste du personnel à date - Evolianz (1).xlsx");
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(1);

  const { data: pers } = await sb.from("personne").select("id, nom, prenom, type_contrat, statut, date_livret_accueil").order("nom");
  const { data: contrats } = await sb.from("contrat_periode").select("personne_id");
  const hasContrat = new Set((contrats || []).map((c) => c.personne_id));

  // Index base : NOM PRENOM normalisé -> personne
  const baseIndex = new Map();
  for (const p of pers) {
    const key = norm(p.nom + " " + p.prenom);
    if (baseIndex.has(key)) {
      const existing = baseIndex.get(key);
      baseIndex.set(key, Array.isArray(existing) ? [...existing, p] : [existing, p]);
    } else {
      baseIndex.set(key, p);
    }
  }

  const matched = [];
  const notFound = [];
  const alreadyHas = [];

  for (const row of rows) {
    const fullName = String(row[0] || "").trim();
    const dateDebut = excelToIso(row[1]);
    const dateFin = excelToIso(row[2]);
    const type = String(row[3] || "").trim();
    const normName = norm(fullName);

    const match = baseIndex.get(normName);
    if (!match || Array.isArray(match)) {
      notFound.push({ fullName, normName, type, dateDebut, dateFin, reason: Array.isArray(match) ? "DOUBLON (" + match.length + ")" : "NON TROUVE" });
      continue;
    }

    if (hasContrat.has(match.id)) {
      alreadyHas.push({ fullName, dbName: match.nom + " " + match.prenom, type, dateDebut, dateFin, id: match.id });
      continue;
    }

    matched.push({ fullName, id: match.id, dbName: match.nom + " " + match.prenom, type, dateDebut, dateFin, dbType: match.type_contrat, statut: match.statut });
  }

  console.log("=== MATCHES CERTAINS (" + matched.length + ") ===");
  for (const m of matched) {
    console.log("  " + m.dbName.padEnd(35) + " | excel=" + m.type + " db=" + m.dbType + " | " + m.dateDebut + " -> " + (m.dateFin || "null"));
  }

  console.log("\n=== DEJA UN CONTRAT (" + alreadyHas.length + ") ===");
  for (const m of alreadyHas) {
    console.log("  " + m.fullName.padEnd(35) + " | " + m.type + " | " + m.dateDebut + " -> " + (m.dateFin || "null"));
  }

  console.log("\n=== NON TROUVES (" + notFound.length + ") ===");
  for (const m of notFound) {
    console.log("  " + m.fullName.padEnd(45) + " | " + m.reason + " | " + m.type + " | " + m.dateDebut);
  }

  // CDI en base sans match dans l'Excel (possibles partis)
  const excelNorms = new Set(rows.map((r) => norm(String(r[0] || ""))));
  const cdiNotInExcel = pers.filter(
    (p) => p.type_contrat === "CDI" && p.statut === "ACTIF" && !excelNorms.has(norm(p.nom + " " + p.prenom)) && !hasContrat.has(p.id)
  );
  console.log("\n=== CDI ACTIFS EN BASE SANS CONTRAT ET PAS DANS EXCEL (" + cdiNotInExcel.length + ") ===");
  for (const p of cdiNotInExcel) {
    console.log("  " + p.nom + " " + p.prenom);
  }

  // Intérimaires sans contrat
  const interimSans = pers.filter((p) => p.type_contrat === "INTERIM" && !hasContrat.has(p.id));
  const interimAvecLivret = interimSans.filter((p) => p.date_livret_accueil);
  const interimSansLivret = interimSans.filter((p) => !p.date_livret_accueil);
  console.log("\n=== INTERIMAIRES SANS CONTRAT: " + interimSans.length + " (avec livret: " + interimAvecLivret.length + ", sans livret: " + interimSansLivret.length + ") ===");
  console.log("Sans livret:");
  for (const p of interimSansLivret) {
    console.log("  " + p.nom + " " + p.prenom + " | statut=" + p.statut);
  }
}
main();
