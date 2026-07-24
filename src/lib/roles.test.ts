import { describe, it, expect } from "vitest";
import { slugifyRole, isRole } from "./roles";

describe("slugifyRole", () => {
  it("met en minuscules et relie les mots par _", () => {
    expect(slugifyRole("Superviseur Nuit")).toBe("superviseur_nuit");
  });

  it("retire les accents", () => {
    expect(slugifyRole("Délégué Sécurité")).toBe("delegue_securite");
  });

  it("compacte la ponctuation et les espaces multiples", () => {
    expect(slugifyRole("Chef  d'équipe -- adjoint")).toBe("chef_d_equipe_adjoint");
  });

  it("rogne les _ de tête et de queue", () => {
    expect(slugifyRole("  (Pilote)  ")).toBe("pilote");
  });

  it("borne la longueur a 40 caracteres", () => {
    expect(slugifyRole("a".repeat(60)).length).toBe(40);
  });

  it("peut produire un code deja pris par un role integre", () => {
    // Le doublon est refuse cote route (409), pas ici : slugify reste pur.
    expect(isRole(slugifyRole("RH"))).toBe(true);
  });
});
