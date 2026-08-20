import { describe, it, expect } from "vitest";
import {
  statutALaDate,
  estActifLe,
  contratCouvreLe,
  estAuTravailLe,
  libelleStatut,
} from "./personne-statut";

describe("statutALaDate", () => {
  it("A_VENIR avant la date d'arrivee", () => {
    expect(statutALaDate({ date_arrivee: "2026-09-01", date_depart_prevu: null }, "2026-08-15")).toBe("A_VENIR");
  });

  it("ACTIF entre arrivee et depart", () => {
    expect(statutALaDate({ date_arrivee: "2026-01-01", date_depart_prevu: "2026-12-31" }, "2026-06-15")).toBe("ACTIF");
  });

  it("ACTIF sans depart prevu, apres l'arrivee", () => {
    expect(statutALaDate({ date_arrivee: "2020-01-01", date_depart_prevu: null }, "2026-08-20")).toBe("ACTIF");
  });

  it("PARTI apres la date de depart", () => {
    expect(statutALaDate({ date_arrivee: "2020-01-01", date_depart_prevu: "2026-06-30" }, "2026-08-01")).toBe("PARTI");
  });

  it("ACTIF le jour meme du depart (borne inclusive)", () => {
    expect(statutALaDate({ date_arrivee: "2020-01-01", date_depart_prevu: "2026-06-30" }, "2026-06-30")).toBe("ACTIF");
  });

  it("ACTIF le jour meme de l'arrivee (borne inclusive)", () => {
    expect(statutALaDate({ date_arrivee: "2026-09-01", date_depart_prevu: null }, "2026-09-01")).toBe("ACTIF");
  });

  it("filet : arrivee nulle -> ACTIF", () => {
    // Ne devrait pas arriver apres backfill, mais le calcul doit rester defini.
    expect(statutALaDate({ date_arrivee: null, date_depart_prevu: null }, "2026-08-20")).toBe("ACTIF");
  });
});

describe("estActifLe", () => {
  it("alias direct de statutALaDate === 'ACTIF'", () => {
    expect(estActifLe({ date_arrivee: "2026-01-01", date_depart_prevu: null }, "2026-08-01")).toBe(true);
    expect(estActifLe({ date_arrivee: "2026-09-01", date_depart_prevu: null }, "2026-08-01")).toBe(false);
  });
});

describe("contratCouvreLe", () => {
  it("vrai si au moins un contrat couvre la date", () => {
    const c = [
      { date_debut: "2026-01-01", date_fin: "2026-06-30" },
      { date_debut: "2026-07-15", date_fin: null }, // CDI ouvert
    ];
    expect(contratCouvreLe(c, "2026-03-15")).toBe(true);
    expect(contratCouvreLe(c, "2026-08-01")).toBe(true);
  });

  it("faux dans un trou entre deux contrats", () => {
    const c = [
      { date_debut: "2026-01-01", date_fin: "2026-06-30" },
      { date_debut: "2026-07-15", date_fin: "2026-12-31" },
    ];
    expect(contratCouvreLe(c, "2026-07-01")).toBe(false);
    expect(contratCouvreLe(c, "2026-07-10")).toBe(false);
    expect(contratCouvreLe(c, "2026-07-14")).toBe(false);
    expect(contratCouvreLe(c, "2026-07-15")).toBe(true);
  });

  it("ignore les contrats sans date_debut", () => {
    const c = [{ date_debut: null, date_fin: "2026-12-31" }];
    expect(contratCouvreLe(c, "2026-06-15")).toBe(false);
  });

  it("faux sur liste vide", () => {
    expect(contratCouvreLe([], "2026-06-15")).toBe(false);
  });

  it("bornes inclusives des deux cotes", () => {
    const c = [{ date_debut: "2026-06-01", date_fin: "2026-06-30" }];
    expect(contratCouvreLe(c, "2026-06-01")).toBe(true);
    expect(contratCouvreLe(c, "2026-06-30")).toBe(true);
    expect(contratCouvreLe(c, "2026-05-31")).toBe(false);
    expect(contratCouvreLe(c, "2026-07-01")).toBe(false);
  });
});

describe("estAuTravailLe", () => {
  it("actif + contrat qui couvre = au travail", () => {
    const p = { date_arrivee: "2026-01-01", date_depart_prevu: null };
    const c = [{ date_debut: "2026-01-01", date_fin: null }];
    expect(estAuTravailLe(p, c, "2026-06-15")).toBe(true);
  });

  it("actif mais dans un trou = pas au travail", () => {
    const p = { date_arrivee: "2026-01-01", date_depart_prevu: null };
    const c = [
      { date_debut: "2026-01-01", date_fin: "2026-06-30" },
      { date_debut: "2026-07-15", date_fin: null },
    ];
    expect(estAuTravailLe(p, c, "2026-07-05")).toBe(false);
  });

  it("A_VENIR = jamais au travail", () => {
    const p = { date_arrivee: "2026-09-01", date_depart_prevu: null };
    const c = [{ date_debut: "2026-09-01", date_fin: null }];
    expect(estAuTravailLe(p, c, "2026-08-15")).toBe(false);
  });

  it("PARTI = jamais au travail", () => {
    const p = { date_arrivee: "2020-01-01", date_depart_prevu: "2026-06-30" };
    const c = [{ date_debut: "2020-01-01", date_fin: null }];
    expect(estAuTravailLe(p, c, "2026-08-15")).toBe(false);
  });

  it("aucun contrat renseigne = on fait confiance au statut", () => {
    // Cas legacy : donnees importees sans contrat_periode.
    const p = { date_arrivee: "2020-01-01", date_depart_prevu: null };
    expect(estAuTravailLe(p, [], "2026-06-15")).toBe(true);
  });
});

describe("libelleStatut", () => {
  it("libelles FR", () => {
    expect(libelleStatut("A_VENIR")).toBe("À venir");
    expect(libelleStatut("ACTIF")).toBe("Actif");
    expect(libelleStatut("PARTI")).toBe("Parti");
  });
});
