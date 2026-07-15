import { describe, it, expect } from "vitest";
import { rotationForWeek, weeksBetween, type RotationRef } from "./rotation";

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
