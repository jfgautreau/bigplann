// Utilitaires de semaine (lundi -> dimanche), en dates locales 'YYYY-MM-DD'.

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Lundi de la semaine contenant `d` (ou aujourd'hui).
export function mondayOf(d: Date = new Date()): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // 0 = lundi
  x.setDate(x.getDate() - dow);
  return x;
}

// Parse 'YYYY-MM-DD' en Date locale (ou lundi courant si invalide).
export function parseMonday(s?: string): Date {
  if (s && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return mondayOf(new Date(y, m - 1, d));
  }
  return mondayOf();
}

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export type Jour = { iso: string; nom: string; num: string };

export function weekDays(monday: Date): Jour[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      iso: isoDate(d),
      nom: JOURS[i],
      num: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
    };
  });
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
