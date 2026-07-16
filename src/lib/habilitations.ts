// Echeances des habilitations a recycler (cf. cahier 6.4).

export function joursRestants(iso: string | null): number | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const exp = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((exp.getTime() - today.getTime()) / 86400000);
}

// Ajoute des mois a une date ISO (AAAA-MM-JJ). Sert a recalculer l'echeance quand
// date_expiration n'a pas ete stockee (ex. habilitations saisies avant que la duree
// de validite de la formation ne soit renseignee).
export function addMonthsIso(iso: string | null, months: number | null | undefined): string | null {
  if (!iso || !months) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1 + months, d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

// Date ISO -> JJ-MM-AAAA (« — » si absente).
export const fmtDateFr = (iso: string | null) => (iso ? iso.split("-").reverse().join("-") : "—");

export type HabStatut = "vert" | "orange" | "rouge";

// Vert > 90 j ; Orange 30-90 j ; Rouge < 30 j ou expire.
export function habStatut(jours: number | null): HabStatut | null {
  if (jours === null) return null;
  if (jours < 30) return "rouge";
  if (jours <= 90) return "orange";
  return "vert";
}

export const HAB_COLOR: Record<HabStatut, string> = {
  vert: "#16a34a",
  orange: "#f59e0b",
  rouge: "#dc2626",
};

// --- Habilitations exigees par un poste (table poste_competence_requise) ---
// Une habilitation detenue est valable tant que son echeance n'est pas passee ;
// sans echeance (formation sans recyclage) elle vaut a vie. Non detenue ou perimee
// => la personne n'est pas habilitee pour le poste.
// `expiration` : echeance effective (date stockee ou recalculee, cf. addMonthsIso).
export type HabDetenue = { expiration: string | null };

export function habValable(d: HabDetenue | undefined | null): boolean {
  if (!d) return false;
  const j = joursRestants(d.expiration);
  return j === null || j >= 0;
}

// Motif affiche a l'utilisateur : « TPE (expirée depuis 12 j) » ou « TPE (non détenue) ».
export function habManqueTxt(nom: string, d: HabDetenue | undefined | null): string {
  if (!d) return `${nom} (non détenue)`;
  const j = joursRestants(d.expiration);
  return j !== null && j < 0 ? `${nom} (expirée depuis ${-j} j)` : nom;
}
