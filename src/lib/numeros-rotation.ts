// Numeros de rotation d'un poste (poste.numero_rotation, saisi libre au Referentiel).
// Un poste tenu par plusieurs personnes porte plusieurs numeros ; chacun devient un
// emplacement ou deposer quelqu'un sur l'ecran Placement.

// Garde-fou : « 1-9999 » ne doit pas fabriquer des milliers de cases.
const MAX_NUMEROS = 30;

// « 12, 15-17 » -> ["12", "15", "16", "17"]. Separateurs : virgule, point-virgule,
// espace. Un tiret entre deux nombres est une plage ; ailleurs le libelle est garde
// tel quel (un numero peut ne pas etre un nombre : « 12b », « A-3 »).
export function parseNumeros(txt: string | null | undefined): string[] {
  if (!txt) return [];
  const out: string[] = [];
  // Les espaces autour d'un tiret sont resserres d'abord : sans cela « 15 - 17 »
  // serait coupe en trois avant meme d'etre reconnu comme une plage.
  for (const part of txt.replace(/\s*-\s*/g, "-").split(/[,;\s]+/)) {
    const t = part.trim();
    if (!t) continue;
    const plage = /^(\d+)\s*-\s*(\d+)$/.exec(t);
    if (plage) {
      const [a, b] = [Number(plage[1]), Number(plage[2])];
      if (a <= b && b - a < MAX_NUMEROS) {
        for (let n = a; n <= b; n++) out.push(String(n));
        continue;
      }
    }
    out.push(t);
  }
  // Doublons ecartes : deux cases identiques seraient indistinguables a l'ecran
  // comme en base (placement.numero_rotation stocke le libelle).
  return [...new Set(out)].slice(0, MAX_NUMEROS);
}
