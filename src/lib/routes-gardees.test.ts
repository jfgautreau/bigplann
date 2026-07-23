import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Le proxy (src/proxy.ts) EXCLUT `api/` de son matcher : aucune route API n'est
// protegee par lui. Chaque `route.ts` doit donc verifier lui-meme l'appelant —
// et une route nouvelle est PUBLIQUE par defaut, sans que rien ne le signale.
//
// Ce test tient l'inventaire : il echoue des qu'un fichier de route n'appelle
// aucune garde connue. C'est un filet, pas une preuve de justesse : il verifie
// qu'une garde est invoquee, pas qu'elle est la bonne.
const RACINE = join(process.cwd(), "src", "app", "api");

const GARDES = [
  "moduleWriteGuard",   // droit de module + client admin (routes de parametrage)
  "userAdminGuard",     // droit « utilisateurs » + anti-escalade
  "requireModuleWrite", // idem, variante qui leve
  "requireModule",      // garde de page, utilisable en route
  "canWriteModule",
  "canWritePlacementData",
  "getCurrentProfile",  // route qui verifie l'authentification a la main
];

function routes(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...routes(p));
    else if (e === "route.ts" || e === "route.tsx") out.push(p);
  }
  return out;
}

describe("routes API — toutes gardees", () => {
  const fichiers = routes(RACINE);

  it("trouve bien les routes du projet", () => {
    expect(fichiers.length).toBeGreaterThan(20);
  });

  it.each(fichiers.map((f) => [f.slice(f.indexOf("api")).replace(/\\/g, "/"), f]))(
    "%s appelle une garde d'autorisation",
    (_nom, chemin) => {
      const src = readFileSync(chemin, "utf8");
      const trouvees = GARDES.filter((g) => src.includes(g));
      expect(
        trouvees,
        `Aucune garde trouvee. Une route API n'est PAS protegee par le proxy : ` +
          `elle doit verifier l'appelant elle-meme (cf. ${GARDES.join(", ")}).`
      ).not.toHaveLength(0);
    }
  );

  it("aucune route ne compare un role en dur (la matrice decide)", () => {
    const fautives = fichiers.filter((f) => /role\s*[!=]==\s*"admin"/.test(readFileSync(f, "utf8")));
    expect(
      fautives.map((f) => f.slice(f.indexOf("api"))),
      "Un role ecrit en dur court-circuite la matrice des droits."
    ).toHaveLength(0);
  });
});
