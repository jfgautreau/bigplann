import { describe, it, expect } from "vitest";
import { messageErreur, urlAvecErreur } from "./erreurs";

describe("messageErreur", () => {
  it("ne dit rien quand il n'y a rien a dire", () => {
    expect(messageErreur(null)).toBeNull();
  });

  it("reconnait un code court de motif deja pris", () => {
    expect(
      messageErreur({
        code: "23505",
        message: 'duplicate key value violates unique constraint "motif_absence_code_court_key"',
      })
    ).toMatch(/code court/i);
  });

  it("reconnait une agence saisie a la casse pres", () => {
    // L'index de la migration 0034 porte sur lower(nom) : « Adecco » et
    // « ADECCO » se heurtent, ce qui n'a rien d'evident pour qui saisit.
    const m = messageErreur({
      code: "23505",
      message: 'duplicate key value violates unique constraint "agence_interim_nom_unique"',
    });
    expect(m).toMatch(/agence/i);
    expect(m).toMatch(/casse/i);
  });

  it("reconnait un matricule en double", () => {
    expect(
      messageErreur({ code: "23505", message: 'violates unique constraint "personne_matricule_key"' })
    ).toMatch(/matricule/i);
  });

  it("retombe sur un message generique pour une unicite inconnue", () => {
    const m = messageErreur({ code: "23505", message: "duplicate key on some_other_table_key" });
    expect(m).toBe("Cette valeur existe déjà.");
  });

  it("explique une suppression bloquee par une reference", () => {
    expect(messageErreur({ code: "23503", message: "violates foreign key constraint" })).toMatch(
      /désactivez/i
    );
  });

  it("traduit un refus de droits", () => {
    expect(messageErreur({ code: "42501", message: "permission denied" })).toMatch(/droit/i);
  });

  it("ne masque JAMAIS une erreur inconnue derriere un silence", () => {
    // Le defaut historique etait de tout avaler. Mieux vaut un message
    // technique qu'un ecran qui se recharge comme si de rien n'etait.
    const m = messageErreur({ code: "XX000", message: "connection reset by peer" });
    expect(m).toBe("connection reset by peer");
    expect(m).not.toBeNull();
  });

  it("rend un message meme sans code ni texte", () => {
    expect(messageErreur({ message: "" })).toBe("L'enregistrement a échoué.");
  });
});

describe("urlAvecErreur", () => {
  it("laisse l'URL intacte s'il n'y a pas de message", () => {
    expect(urlAvecErreur("/admin/motifs", null)).toBe("/admin/motifs");
  });

  it("ajoute le message encode", () => {
    expect(urlAvecErreur("/admin/motifs", "Déjà pris")).toBe("/admin/motifs?err=D%C3%A9j%C3%A0%20pris");
  });

  it("respecte une query deja presente", () => {
    expect(urlAvecErreur("/admin/motifs?edit=3", "Oups")).toBe("/admin/motifs?edit=3&err=Oups");
  });

  it("neutralise une tentative d'injection dans l'URL", () => {
    const url = urlAvecErreur("/personnel", "a&b=c#d");
    expect(url).toBe("/personnel?err=a%26b%3Dc%23d");
    expect(new URL(url, "https://x").searchParams.get("err")).toBe("a&b=c#d");
  });
});
