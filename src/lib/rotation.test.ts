import { describe, it, expect } from "vitest";
import { rotationForWeek, weeksBetween, equipesParQuart, type RotationRef } from "./rotation";

// Deux equipes tournantes A/B (uuid volontairement ordonnes A < B).
const A = "aaaaaaaa-0000-0000-0000-000000000000";
const B = "bbbbbbbb-0000-0000-0000-000000000000";
const C = "cccccccc-0000-0000-0000-000000000000";

describe("weeksBetween", () => {
  it("compte les semaines entre deux lundis (traverse un changement d'heure)", () => {
    expect(weeksBetween("2026-03-23", "2026-03-30")).toBe(1); // DST europe fin mars
    expect(weeksBetween("2026-06-01", "2026-06-01")).toBe(0);
    expect(weeksBetween("2026-06-01", "2026-07-13")).toBe(6);
  });
});

describe("rotationForWeek", () => {
  const ref: RotationRef[] = [
    { semaine: "2026-06-01", equipe_id: A, quart_code: "matin" },
    { semaine: "2026-06-01", equipe_id: B, quart_code: "apres_midi" },
  ];

  it("rend l'affectation saisie la semaine de reference", () => {
    expect(rotationForWeek(ref, "2026-06-01")).toEqual({ [A]: "matin", [B]: "apres_midi" });
  });

  it("alterne la semaine suivante", () => {
    expect(rotationForWeek(ref, "2026-06-08")).toEqual({ [A]: "apres_midi", [B]: "matin" });
  });

  it("revient a l'etat de reference deux semaines plus tard", () => {
    expect(rotationForWeek(ref, "2026-06-15")).toEqual({ [A]: "matin", [B]: "apres_midi" });
  });

  it("ne calcule rien avant la premiere reference", () => {
    expect(rotationForWeek(ref, "2026-05-25")).toEqual({});
  });

  it("une nouvelle reference datee ne change pas le passe", () => {
    const refs: RotationRef[] = [
      ...ref,
      // A partir du 2026-07-06 on inverse le point de depart.
      { semaine: "2026-07-06", equipe_id: A, quart_code: "apres_midi" },
      { semaine: "2026-07-06", equipe_id: B, quart_code: "matin" },
    ];
    // Passe : toujours calcule depuis la reference de juin.
    expect(rotationForWeek(refs, "2026-06-08")).toEqual({ [A]: "apres_midi", [B]: "matin" });
    // A partir de la nouvelle reference : nouvel etat de depart.
    expect(rotationForWeek(refs, "2026-07-06")).toEqual({ [A]: "apres_midi", [B]: "matin" });
    expect(rotationForWeek(refs, "2026-07-13")).toEqual({ [A]: "matin", [B]: "apres_midi" });
  });

  it("gere un cycle a trois equipes", () => {
    const refs: RotationRef[] = [
      { semaine: "2026-06-01", equipe_id: A, quart_code: "matin" },
      { semaine: "2026-06-01", equipe_id: B, quart_code: "apres_midi" },
      { semaine: "2026-06-01", equipe_id: C, quart_code: "nuit" },
    ];
    expect(rotationForWeek(refs, "2026-06-01")).toEqual({ [A]: "matin", [B]: "apres_midi", [C]: "nuit" });
    expect(rotationForWeek(refs, "2026-06-08")).toEqual({ [A]: "apres_midi", [B]: "nuit", [C]: "matin" });
    expect(rotationForWeek(refs, "2026-06-15")).toEqual({ [A]: "nuit", [B]: "matin", [C]: "apres_midi" });
    expect(rotationForWeek(refs, "2026-06-22")).toEqual({ [A]: "matin", [B]: "apres_midi", [C]: "nuit" });
  });
});

describe("equipesParQuart — filtre du Placement", () => {
  const EQ = [
    { id: "a", quart_fixe: null },
    { id: "b", quart_fixe: null },
    { id: "fixe-matin", quart_fixe: "matin" },
    { id: "fixe-am", quart_fixe: "apres_midi" },
    { id: "fixe-nuit", quart_fixe: "nuit" },
    { id: "jour", quart_fixe: "journee" },
  ];

  it("réunit l'équipe à quart fixe ET celle que la rotation y place", () => {
    // Le cas réel : « Matin » doit remonter « Fixe Matin » + l'équipe tournante.
    const r = equipesParQuart(EQ, { a: "matin", b: "apres_midi" });
    expect(r.matin).toEqual(["fixe-matin", "a"]);
    expect(r.apres_midi).toEqual(["fixe-am", "b"]);
    expect(r.nuit).toEqual(["fixe-nuit"]);
    expect(r.journee).toEqual(["jour"]);
  });

  it("suit l'alternance : la semaine suivante, A et B échangent", () => {
    const r = equipesParQuart(EQ, { a: "apres_midi", b: "matin" });
    expect(r.matin).toEqual(["fixe-matin", "b"]);
    expect(r.apres_midi).toEqual(["fixe-am", "a"]);
  });

  it("ne compte pas deux fois une équipe fixe présente dans la rotation", () => {
    const r = equipesParQuart(EQ, { "fixe-nuit": "matin", a: "matin" });
    expect(r.matin).toEqual(["fixe-matin", "a"]); // fixe-nuit reste sur nuit
    expect(r.nuit).toEqual(["fixe-nuit"]);
  });

  it("ignore une équipe désactivée encore citée par une référence", () => {
    expect(equipesParQuart(EQ, { supprimee: "matin" }).matin).toEqual(["fixe-matin"]);
  });

  it("sans aucune rotation, seules les équipes à quart fixe apparaissent", () => {
    const r = equipesParQuart(EQ, {});
    expect(r.matin).toEqual(["fixe-matin"]);
    expect(r.journee).toEqual(["jour"]);
  });

  it("REGRESSION : une équipe sans quart fixe ET hors rotation n'apparaît nulle part", () => {
    // Cas vécu le 23/07/2026 : « Fixe Matin » et « Fixe AM » étaient déclarées
    // tournantes sans figurer dans aucune référence — elles étaient donc
    // invisibles dans le filtre par quart. C'est un défaut de PARAMÉTRAGE, pas
    // de code : le test documente la conséquence pour qu'elle soit reconnue.
    const r = equipesParQuart([{ id: "orpheline", quart_fixe: null }], {});
    expect(Object.values(r).flat()).not.toContain("orpheline");
  });
});
