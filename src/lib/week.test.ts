import { describe, it, expect } from "vitest";
import { mondayOf, isoDate, weekDays, isoWeekNumber, defaultOpenIso, isSundayIso } from "./week";

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
