import { describe, it, expect } from "vitest";
import { normaliseNom, normalisePrenom } from "./noms";

describe("normaliseNom", () => {
  it("met le nom en capitales", () => {
    expect(normaliseNom("gautreau")).toBe("GAUTREAU");
    expect(normaliseNom("Gautreau")).toBe("GAUTREAU");
  });

  it("garde les accents en capitales", () => {
    expect(normaliseNom("évrard")).toBe("ÉVRARD");
  });

  it("reduit les espaces et rogne les bords", () => {
    expect(normaliseNom("  ben   lazrek  ")).toBe("BEN LAZREK");
  });
});

describe("normalisePrenom", () => {
  it("capitalise la premiere lettre", () => {
    expect(normalisePrenom("jean")).toBe("Jean");
    expect(normalisePrenom("JEAN")).toBe("Jean");
  });

  it("capitalise chaque partie d'un prenom compose", () => {
    expect(normalisePrenom("jean-françois")).toBe("Jean-François");
    expect(normalisePrenom("JEAN-FRANCOIS")).toBe("Jean-Francois");
    expect(normalisePrenom("marie claire")).toBe("Marie Claire");
  });

  it("capitalise apres une apostrophe", () => {
    expect(normalisePrenom("n'golo")).toBe("N'Golo");
    expect(normalisePrenom("n’golo")).toBe("N’Golo");
  });

  it("rogne les bords", () => {
    expect(normalisePrenom("  anne-marie ")).toBe("Anne-Marie");
  });
});
