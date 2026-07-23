import { describe, it, expect } from "vitest";
import { mondayOf, isoDate, weekDays, isoWeekNumber, defaultOpenIso, isSundayIso, joursAutour, parseJour, parseMonday } from "./week";

describe("week", () => {
  it("mondayOf renvoie le lundi de la semaine", () => {
    // 2026-06-03 = mercredi -> lundi 2026-06-01
    expect(isoDate(mondayOf(new Date(2026, 5, 3)))).toBe("2026-06-01");
  });

  it("weekDays renvoie 7 jours a partir du lundi", () => {
    const d = weekDays(mondayOf(new Date(2026, 5, 3)));
    expect(d).toHaveLength(7);
    expect(d[0].iso).toBe("2026-06-01");
    expect(d[6].iso).toBe("2026-06-07");
  });

  it("dimanche ferme par defaut, lundi ouvert", () => {
    expect(isSundayIso("2026-06-07")).toBe(true);
    expect(defaultOpenIso("2026-06-07")).toBe(false);
    expect(defaultOpenIso("2026-06-01")).toBe(true);
  });

  it("numero de semaine ISO", () => {
    expect(isoWeekNumber(new Date(2026, 0, 1))).toBe(1);
    expect(isoWeekNumber(new Date(2026, 5, 1))).toBe(23);
  });
});

describe("joursAutour — fenetre glissante de l'ecran TV", () => {
  const pivot = new Date(2026, 6, 23); // jeudi 23/07/2026

  it("rend J-1 a J+4, pivot compris", () => {
    const j = joursAutour(pivot, 1, 4);
    expect(j.map((x) => x.iso)).toEqual([
      "2026-07-22", "2026-07-23", "2026-07-24",
      "2026-07-25", "2026-07-26", "2026-07-27",
    ]);
  });

  it("nomme correctement les jours, week-end compris", () => {
    const j = joursAutour(pivot, 1, 4);
    expect(j.map((x) => x.nom)).toEqual([
      "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche", "Lundi",
    ]);
  });

  it("traverse un changement de mois", () => {
    const j = joursAutour(new Date(2026, 6, 31), 1, 4);
    expect(j.map((x) => x.iso)).toEqual([
      "2026-07-30", "2026-07-31", "2026-08-01",
      "2026-08-02", "2026-08-03", "2026-08-04",
    ]);
    expect(j[2].num).toBe("01/08");
  });

  it("traverse un changement d'annee", () => {
    expect(joursAutour(new Date(2026, 11, 31), 1, 4).map((x) => x.iso)).toEqual([
      "2026-12-30", "2026-12-31", "2027-01-01",
      "2027-01-02", "2027-01-03", "2027-01-04",
    ]);
  });

  it("traverse le 29 fevrier d'une annee bissextile", () => {
    expect(joursAutour(new Date(2028, 1, 28), 1, 4).map((x) => x.iso)).toEqual([
      "2028-02-27", "2028-02-28", "2028-02-29",
      "2028-03-01", "2028-03-02", "2028-03-03",
    ]);
  });
});

describe("parseJour — ne recale PAS sur le lundi", () => {
  it("rend le jour demande tel quel", () => {
    // parseMonday, lui, ramenerait au lundi : l'ecran TV a besoin du jour pivot.
    expect(isoDate(parseJour("2026-07-23"))).toBe("2026-07-23");
    expect(isoDate(parseMonday("2026-07-23"))).toBe("2026-07-20");
  });

  it("retombe sur aujourd'hui si la date est absente ou invalide", () => {
    const aujourdhui = isoDate(new Date());
    expect(isoDate(parseJour(undefined))).toBe(aujourdhui);
    expect(isoDate(parseJour("pas-une-date"))).toBe(aujourdhui);
  });
});
