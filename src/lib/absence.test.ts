import { describe, it, expect } from "vitest";
import { nbJours, tropLongue, joursRange, MAX_JOURS_ABSENCE } from "./absence";

describe("nbJours — bornes incluses", () => {
  it("compte 1 jour pour une absence d'un seul jour", () => {
    expect(nbJours("2026-07-23", "2026-07-23")).toBe(1);
  });

  it("compte une semaine pleine", () => {
    expect(nbJours("2026-07-20", "2026-07-26")).toBe(7);
  });

  it("traverse un changement d'heure sans deriver", () => {
    // 29/03/2026 : passage a l'heure d'ete en France. Un calcul en heure locale
    // perdrait une heure et pourrait rendre 30 au lieu de 31.
    expect(nbJours("2026-03-01", "2026-03-31")).toBe(31);
    // 25/10/2026 : retour a l'heure d'hiver.
    expect(nbJours("2026-10-01", "2026-10-31")).toBe(31);
  });

  it("traverse une annee bissextile", () => {
    expect(nbJours("2028-02-01", "2028-02-29")).toBe(29);
    expect(nbJours("2026-02-01", "2026-02-28")).toBe(28);
  });

  it("rend NaN sur une date invalide", () => {
    expect(nbJours("pas-une-date", "2026-07-23")).toBeNaN();
  });
});

describe("tropLongue — refuser plutot que tronquer", () => {
  it("accepte exactement la borne", () => {
    const debut = "2026-01-01";
    const fin = joursRange(debut, "2028-12-31")[MAX_JOURS_ABSENCE - 1];
    expect(nbJours(debut, fin)).toBe(MAX_JOURS_ABSENCE);
    expect(tropLongue(debut, fin)).toBe(false);
  });

  it("refuse un jour de plus", () => {
    const debut = "2026-01-01";
    const fin = joursRange(debut, "2028-12-31")[MAX_JOURS_ABSENCE];
    expect(nbJours(debut, fin)).toBe(MAX_JOURS_ABSENCE + 1);
    expect(tropLongue(debut, fin)).toBe(true);
  });

  it("REGRESSION : un conge de 3 ans est refuse, pas rogne a 800 jours", () => {
    // L'ancien garde-fou (`while (... && guard < 800)`) materialisait 800 jours
    // puis s'arretait EN SILENCE : l'absence existait, mais s'arretait au milieu.
    expect(tropLongue("2026-01-01", "2029-01-01")).toBe(true);
  });

  it("ne juge pas « trop longue » une plage inversee", () => {
    expect(tropLongue("2026-07-23", "2026-07-01")).toBe(false);
  });
});

describe("joursRange", () => {
  it("rend les jours dans l'ordre, bornes incluses", () => {
    expect(joursRange("2026-07-20", "2026-07-23")).toEqual([
      "2026-07-20",
      "2026-07-21",
      "2026-07-22",
      "2026-07-23",
    ]);
  });

  it("rend un tableau vide sur une plage inversee ou invalide", () => {
    expect(joursRange("2026-07-23", "2026-07-01")).toEqual([]);
    expect(joursRange("n'importe quoi", "2026-07-01")).toEqual([]);
  });

  it("ne saute aucun jour sur un changement d'heure", () => {
    const j = joursRange("2026-03-28", "2026-03-31");
    expect(j).toEqual(["2026-03-28", "2026-03-29", "2026-03-30", "2026-03-31"]);
    expect(new Set(j).size).toBe(j.length); // aucun doublon
  });
});
