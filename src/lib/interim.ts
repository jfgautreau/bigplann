// Repère visuel des intérimaires : un fond JAUNE, partagé par tous les écrans.
//
// La couleur était incohérente : l'affichage TV surlignait les intérimaires en
// VERT (#bbf7d0), les autres écrans ne les distinguaient pas du tout. On unifie
// sur le jaune, seule source de vérité ici — changer la teinte se fait à un seul
// endroit.
//
// Jaune choisi pour ne heurter aucune couleur métier déjà en place : les équipes
// ont leurs propres teintes, le rouge dit « absence » / « habilitation manquante »,
// le vert « aujourd'hui » sur la TV. Le jaune restait libre.

export const INTERIM_BG = "#fde68a"; // ambre 200 : lisible en texte noir
export const INTERIM_BORDER = "#f59e0b"; // ambre 500, pour un liseré discret

export function estInterim(typeContrat: string | null | undefined): boolean {
  return typeContrat === "INTERIM";
}

// Style de fond à poser sur le libellé d'un intérimaire (nom, pastille…).
// Rend `undefined` pour un non-intérimaire : à étaler sur un objet de style
// existant (`{ ...styleInterim(p.type_contrat) }`) sans rien casser.
export function styleInterim(typeContrat: string | null | undefined): React.CSSProperties {
  if (!estInterim(typeContrat)) return {};
  return { background: INTERIM_BG, borderRadius: 3 };
}
