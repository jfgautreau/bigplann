import { describe, it, expect } from "vitest";
import { validatePasswordPolicy } from "./password";

describe("validatePasswordPolicy", () => {
  it("refuse un mot de passe trop court", () => {
    expect(validatePasswordPolicy("Ab1!")).not.toBeNull();
  });

  it("refuse moins de 3 classes de caracteres", () => {
    expect(validatePasswordPolicy("abcdefgh")).not.toBeNull();
    expect(validatePasswordPolicy("abcdefg1")).not.toBeNull(); // 2 classes
  });

  it("accepte 8+ caracteres et 3 classes", () => {
    expect(validatePasswordPolicy("Abc12345")).toBeNull(); // maj+min+chiffre
    expect(validatePasswordPolicy("abcd123!")).toBeNull(); // min+chiffre+special
  });
});
