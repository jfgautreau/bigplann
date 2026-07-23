// Regles de bornage des absences longues.
//
// Une absence est materialisee en un placement PAR JOUR (cf. /api/absence). Une
// plage aberrante — une date de fin saisie en 2192 — en produirait des dizaines
// de milliers. D'ou un plafond.
//
// ⚠️ Le garde-fou d'origine etait une boucle `while (d <= end && guard < 800)` :
// au-dela de 800 jours, elle s'arretait **en silence**. Un conge parental de
// trois ans etait donc materialise sur 800 jours puis tronque, sans message ni
// erreur. On refuse desormais, on ne rogne plus. La meme borne est posee en base
// (migration 0037) : l'application donne le message, la base garantit la regle.

export const MAX_JOURS_ABSENCE = 800;

export const MSG_TROP_LONGUE =
  `Une absence ne peut pas dépasser ${MAX_JOURS_ABSENCE} jours : découpez-la en plusieurs périodes.`;

// Nombre de jours couverts, bornes incluses. `NaN` si une date est invalide.
export function nbJours(debut: string, fin: string): number {
  const d = Date.parse(`${debut}T00:00:00Z`);
  const f = Date.parse(`${fin}T00:00:00Z`);
  if (Number.isNaN(d) || Number.isNaN(f)) return NaN;
  return Math.floor((f - d) / 86_400_000) + 1;
}

// Plage a refuser. Une plage inversee n'est pas « trop longue » : elle est
// rejetee plus tot, par son propre message.
export function tropLongue(debut: string, fin: string): boolean {
  const n = nbJours(debut, fin);
  return Number.isFinite(n) && n > MAX_JOURS_ABSENCE;
}

// Liste des jours ISO (YYYY-MM-DD) de `debut` a `fin` inclus. N'est plus
// utilisee par /api/absence — la materialisation se fait en base — mais reste le
// point de reference de la regle, teste.
export function joursRange(debut: string, fin: string): string[] {
  const n = nbJours(debut, fin);
  if (!Number.isFinite(n) || n <= 0) return [];
  const out: string[] = [];
  const d = new Date(`${debut}T00:00:00Z`);
  for (let i = 0; i < n; i++) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
