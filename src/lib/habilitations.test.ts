import { describe, it, expect } from "vitest";
import { habStatut, joursRestants } from "./habilitations";

describe("habStatut", () => {
  it("rouge uniquement quand echeance depassee", () => {
    expect(habStatut(-1)).toBe("rouge");
    expect(habStatut(-5)).toBe("rouge");
  });
  it("orange de 0 a 90 jours avant echeance", () => {
    expect(habStatut(0)).toBe("orange");
    expect(habStatut(29)).toBe("orange");
    expect(habStatut(30)).toBe("orange");
    expect(habStatut(90)).toBe("orange");
  });
  it("vert au-dela de 90 jours", () => {
    expect(habStatut(91)).toBe("vert");
  });
  it("null si pas de date", () => {
    expect(habStatut(null)).toBeNull();
    expect(joursRestants(null)).toBeNull();
  });
});
