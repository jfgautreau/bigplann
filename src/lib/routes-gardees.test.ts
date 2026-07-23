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

// Retire commentaires de ligne et de bloc avant analyse. Sans cela, un
// commentaire qui DECRIT le defaut evite — « on ne fait plus
// `quart_code ?? "matin"` » — se fait signaler comme le defaut lui-meme.
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...sources(p));
    else if (/\.(ts|tsx)$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}

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
    const fautives = fichiers.filter((f) =>
      /role\s*[!=]==\s*"admin"/.test(sansCommentaires(readFileSync(f, "utf8")))
    );
    expect(
      fautives.map((f) => f.slice(f.indexOf("api"))),
      "Un role ecrit en dur court-circuite la matrice des droits."
    ).toHaveLength(0);
  });
});

// --- Nettoyage de l'etape 5 : ces constantes ne doivent pas revenir ---
describe("quarts et colonnes depreciees", () => {
  const tous = sources(join(process.cwd(), "src"));
  // `src/lib/quarts.ts` est le domicile legitime de la regle : c'est le seul
  // endroit ou un code de quart a le droit d'apparaitre.
  const ailleurs = tous.filter((f) => !f.endsWith(join("lib", "quarts.ts")));

  it('aucun repli `quart_code ?? "<code>"` en dur', () => {
    // La regle vit dans src/lib/quarts.ts et prend la liste des quarts du site.
    // La recopier en dur reintroduit l'incoherence entre ecrans (« matin » ici,
    // « journee » la) et empeche un site d'avoir ses propres quarts.
    // ⚠️ Le motif exige un code NON VIDE : `String(c.quart_code ?? "")` est une
    // simple coercion de saisie, pas un repli metier.
    const fautifs = ailleurs.filter((f) =>
      /quart_code\s*\?\?\s*"[a-z_]{2,}"/.test(sansCommentaires(readFileSync(f, "utf8")))
    );
    expect(fautifs.map((f) => f.slice(f.indexOf("src")))).toEqual([]);
  });

  it("aucune liste de quarts figee dans le code", () => {
    const fautifs = ailleurs.filter((f) =>
      /"journee"\s*,\s*"matin"|"matin"\s*,\s*"apres_midi"\s*,\s*"nuit"/.test(
        sansCommentaires(readFileSync(f, "utf8"))
      )
    );
    expect(
      fautifs.map((f) => f.slice(f.indexOf("src"))),
      "La table `quart` est du parametrage : la liste se lit en base."
    ).toEqual([]);
  });

  it("plus aucune lecture de `est_conducteur` (deprecie par `poste.categorie`)", () => {
    // Colonne non maintenue depuis la 0021 : au 23/07/2026, 9 postes ont
    // categorie='conducteur' et est_conducteur=false.
    const fautifs = tous.filter((f) => /est_conducteur/.test(sansCommentaires(readFileSync(f, "utf8"))));
    expect(fautifs.map((f) => f.slice(f.indexOf("src")))).toEqual([]);
  });

  it("plus aucune lecture des trois tables supprimees en 0038", () => {
    const fautifs: string[] = [];
    for (const f of tous) {
      const src = sansCommentaires(readFileSync(f, "utf8"));
      for (const t of ["equipe_quart_semaine", "ligne_ouverture", "jour_equipe"]) {
        if (new RegExp(`from\\("${t}"\\)`).test(src)) fautifs.push(`${f.slice(f.indexOf("src"))} (${t})`);
      }
    }
    expect(fautifs).toEqual([]);
  });
});
