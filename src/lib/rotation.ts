// Rotation des equipes par "reference datee".
//
// Une reference = une semaine (lundi ISO) + le quart de chaque equipe tournante
// cette semaine-la. L'alternance des semaines suivantes est une rotation cyclique
// du vecteur de quarts, calculee ici et jamais stockee.
//
// Pour une semaine cible, la reference active est la plus recente dont la semaine
// est <= la cible. Les semaines anterieures a toute reference n'ont pas de
// rotation (retour au defaut cote appelant). Changer la rotation = ajouter une
// nouvelle reference datee : le passe, calcule depuis une reference anterieure,
// n'est pas modifie.
//
// L'ordre des equipes dans le cycle est deterministe (tri par equipe_id). Avec
// deux equipes, le sens du cycle est indifferent (echange une semaine sur deux) ;
// avec trois equipes ou plus, le cycle avance dans cet ordre.

export type RotationRef = { semaine: string; equipe_id: string; quart_code: string };

// Nombre de semaines entre deux lundis ISO (>= 0 quand b >= a).
// Passe par les jours entiers pour absorber les sauts d'heure d'ete.
export function weeksBetween(aIso: string, bIso: string): number {
  const [ay, am, ad] = aIso.split("-").map(Number);
  const [by, bm, bd] = bIso.split("-").map(Number);
  const a = new Date(ay, am - 1, ad).getTime();
  const b = new Date(by, bm - 1, bd).getTime();
  const days = Math.round((b - a) / 86400000);
  return Math.round(days / 7);
}

// Quart de chaque equipe tournante pour la semaine `cibleIso` (lundi ISO), selon
// les references fournies. Retourne { equipe_id -> quart_code } ; vide si aucune
// reference n'est active pour cette semaine.
export function rotationForWeek(refs: RotationRef[], cibleIso: string): Record<string, string> {
  // Reference active : plus grande semaine <= cible (comparaison lexicographique
  // = chronologique sur des dates ISO).
  let refWeek = "";
  for (const r of refs) {
    if (r.semaine <= cibleIso && r.semaine > refWeek) refWeek = r.semaine;
  }
  if (!refWeek) return {};

  const bloc = refs
    .filter((r) => r.semaine === refWeek)
    .sort((x, y) => x.equipe_id.localeCompare(y.equipe_id));
  const k = bloc.length;
  if (k === 0) return {};

  const n = weeksBetween(refWeek, cibleIso); // >= 0
  const quarts = bloc.map((r) => r.quart_code);
  const out: Record<string, string> = {};
  for (let i = 0; i < k; i++) {
    out[bloc[i].equipe_id] = quarts[(((i + n) % k) + k) % k];
  }
  return out;
}
