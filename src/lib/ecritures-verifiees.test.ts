import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// 16 ecritures sur 100 ignoraient leur resultat : `await supabase.from(...)
// .insert(...)` sans lire `error`. Symptome cote utilisateur, toujours le meme
// et jamais explique : « je clique sur Enregistrer, l'ecran se recharge, rien
// n'a change » — un code court deja pris, une agence en double a la casse pres,
// un matricule deja attribue.
//
// Ce test tient la ligne : toute ecriture doit soit destructurer `error`, soit
// etre explicitement chainee sur une expression qui l'exploite. C'est une
// analyse TEXTUELLE, donc faillible ; elle attrape la forme exacte du defaut
// d'origine, pas toutes ses variantes imaginables.
const SRC = join(process.cwd(), "src");
const ECRITURES = /\.(insert|update|upsert|delete)\(/;

function fichiers(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...fichiers(p));
    else if (/\.(ts|tsx)$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}

// Une ecriture « nue » : `await <client>.from(...)....insert(...)` dont le
// resultat n'est affecte a rien. On repere l'instruction complete (jusqu'au `;`)
// et on verifie qu'elle commence bien par `await` sans affectation.
function ecrituresNues(src: string): string[] {
  const out: string[] = [];
  // Instructions demarrant par `await` en debut de ligne (hors affectation).
  const re = /^[ \t]*await\s+[A-Za-z_$][\w$]*\s*\n?[\s\S]{0,600}?;/gm;
  for (const m of src.matchAll(re)) {
    const bloc = m[0];
    if (!ECRITURES.test(bloc)) continue;
    if (!/\.from\(/.test(bloc)) continue;
    out.push(bloc.split("\n")[0].trim());
  }
  return out;
}

describe("ecritures en base — le resultat est toujours lu", () => {
  const tous = fichiers(SRC);

  it("balaye bien le code source", () => {
    expect(tous.length).toBeGreaterThan(50);
  });

  it("aucune ecriture n'ignore son erreur", () => {
    const fautifs: string[] = [];
    for (const f of tous) {
      const nues = ecrituresNues(readFileSync(f, "utf8"));
      for (const n of nues) fautifs.push(`${f.slice(f.indexOf("src"))} :: ${n}`);
    }
    expect(
      fautifs,
      "Une ecriture dont l'erreur n'est pas lue echoue EN SILENCE : l'ecran se " +
        "recharge et rien n'a change. Destructurer `const { error } = await ...`."
    ).toEqual([]);
  });
});

describe("sequences effacer-puis-reecrire", () => {
  it("aucune n'est refaite en deux requetes applicatives", () => {
    // La rotation des equipes et la modification d'une absence effacaient puis
    // reinseraient depuis l'application, sans transaction : un echec de la
    // seconde requete perdait la donnee. Elles passent desormais par les
    // fonctions SQL de la migration 0037 (set_rotation_reference, maj_absence,
    // creer_absence), atomiques par construction.
    const suspects: string[] = [];
    for (const f of fichiers(SRC)) {
      const src = readFileSync(f, "utf8");
      for (const table of ["rotation_reference", "absence"]) {
        const efface = new RegExp(`from\\("${table}"\\)[\\s\\S]{0,120}?\\.delete\\(`).test(src);
        const reecrit = new RegExp(`from\\("${table}"\\)[\\s\\S]{0,200}?\\.(insert|upsert)\\(`).test(src);
        if (efface && reecrit) suspects.push(`${f.slice(f.indexOf("src"))} (${table})`);
      }
    }
    expect(
      suspects,
      "Effacer puis reinserer depuis l'application n'est pas atomique : passer " +
        "par une fonction SQL (cf. migration 0037)."
    ).toEqual([]);
  });
});
