// Casse normalisee des identites, appliquee a la creation d'une personne.
// La saisie vient de sources tres variees (copier-coller d'un tableur, frappe
// rapide, listes d'agence en capitales) : sans normalisation la liste Personnel
// melange « GAUTREAU », « Gautreau » et « gautreau » pour la meme famille, et le
// tri comme la recherche visuelle en patissent.
//
// Convention retenue : NOM en capitales, Prenom capitalise segment par segment
// (« GAUTREAU Jean-François »).

// Separateurs internes d'un prenom compose : espace, tiret, apostrophe droite ou
// typographique. Chaque segment qui les suit reprend une majuscule.
const SEPARATEURS = /(^|[\s\-'’])(\p{L})/gu;

/** « gautreau » -> « GAUTREAU ». Espaces multiples reduits a un seul. */
export function normaliseNom(v: string): string {
  return v.trim().replace(/\s+/g, " ").toLocaleUpperCase("fr-FR");
}

/** « jean-françois » -> « Jean-François », « MARIE CLAIRE » -> « Marie Claire ». */
export function normalisePrenom(v: string): string {
  return v
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("fr-FR")
    .replace(SEPARATEURS, (_m, sep: string, c: string) => sep + c.toLocaleUpperCase("fr-FR"));
}
