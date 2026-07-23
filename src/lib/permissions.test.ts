import { describe, it, expect, vi } from "vitest";

// `permissions.ts` lit `role_permission` via Supabase. On neutralise l'acces
// base : les tests portent sur les DEFAUTS (`defaultsFor`) et sur la regle
// anti-escalade qui les compare. `getPermissions` retombe alors sur les defauts,
// exactement comme en production quand la table est vide.
vi.mock("@/lib/supabase-server", () => ({
  getServerClient: async () => {
    throw new Error("pas de base en test");
  },
  getAdminClient: () => {
    throw new Error("pas de base en test");
  },
}));
vi.mock("@/lib/current-user", () => ({ getCurrentProfile: async () => null }));

const {
  defaultsFor,
  canWrite,
  canRead,
  canWriteModule,
  canWritePlacementData,
  droitsCouvertsPar,
  roleModifiablePar,
  verifierChangementDroit,
  ROLE_TOUT_PUISSANT,
  MODULE_KEYS,
  RANG,
} = await import("@/lib/permissions");
const { ROLES } = await import("@/lib/roles");

describe("defaultsFor — droits par defaut", () => {
  it("donne tout a l'admin, sur tous les modules", () => {
    const p = defaultsFor("admin");
    for (const m of MODULE_KEYS) expect(p[m]).toBe("write");
  });

  it("ne donne rien a un role inconnu (fermeture par defaut)", () => {
    const p = defaultsFor("intrus");
    for (const m of MODULE_KEYS) expect(p[m]).toBe("none");
  });

  it("n'accorde le module utilisateurs a personne d'autre que l'admin", () => {
    for (const r of ROLES) {
      if (r === "admin") continue;
      expect(defaultsFor(r).utilisateurs).toBe("none");
    }
  });

  it("ne rend aucun niveau hors de l'echelle none/read/write", () => {
    for (const r of [...ROLES, "intrus"]) {
      for (const m of MODULE_KEYS) expect(RANG[defaultsFor(r)[m]]).toBeTypeOf("number");
    }
  });

  it("le chef d'equipe a bien Placement des lors qu'il a Planning", () => {
    const p = defaultsFor("chef_equipe");
    expect(canWrite(p, "planning")).toBe(true);
    expect(canWrite(p, "placement")).toBe(true);
  });
});

describe("canWriteModule — le chef d'equipe reste dans son perimetre (L5)", () => {
  it("refuse l'ecriture COMPLETE au chef d'equipe meme la ou il a write", () => {
    expect(canWrite(defaultsFor("chef_equipe"), "matrice")).toBe(true);
    // ... mais l'ecriture « complete » (client admin, bypass RLS) lui est refusee.
    return expect(canWriteModule("chef_equipe", "matrice")).resolves.toBe(false);
  });

  it("l'accorde a l'admin", async () => {
    expect(await canWriteModule("admin", "matrice")).toBe(true);
  });

  it("canWritePlacementData suit Planning OU Placement, jamais pour le chef", async () => {
    expect(await canWritePlacementData("admin")).toBe(true);
    expect(await canWritePlacementData("chef_equipe")).toBe(false);
    expect(await canWritePlacementData("rh")).toBe(false);
  });
});

describe("droitsCouvertsPar — anti-escalade de privileges", () => {
  it("un role est toujours couvert par lui-meme", async () => {
    for (const r of ROLES) expect(await droitsCouvertsPar(r, r)).toBe(true);
  });

  it("l'admin couvre tous les autres roles", async () => {
    for (const r of ROLES) expect(await droitsCouvertsPar(r, "admin")).toBe(true);
  });

  it("AUCUN autre role ne couvre l'admin : pas de promotion vers admin", async () => {
    for (const r of ROLES) {
      if (r === "admin") continue;
      expect(await droitsCouvertsPar("admin", r)).toBe(false);
    }
  });

  it("un role sans droits ne couvre personne d'autre que lui", async () => {
    for (const r of ROLES) {
      if (defaultsFor(r) === defaultsFor("intrus")) continue;
      expect(await droitsCouvertsPar(r, "intrus")).toBe(false);
    }
  });

  it("est reflexive et antisymetrique sur des roles de forces differentes", async () => {
    // ordo est en lecture la ou codir l'est aussi, mais codir a `journal: read`
    // que ordo n'a pas -> aucun des deux ne couvre l'autre.
    expect(await droitsCouvertsPar("codir", "ordo")).toBe(false);
    expect(await droitsCouvertsPar("ordo", "codir")).toBe(false);
  });

  it("le scenario d'escalade complet est ferme", async () => {
    // Un titulaire de « utilisateurs: write » qui n'est pas admin (ici : un role
    // fictif calque sur rh) ne doit pas pouvoir se creer un compte admin.
    expect(await droitsCouvertsPar("admin", "rh")).toBe(false);
    expect(await droitsCouvertsPar("admin", "codir")).toBe(false);
    expect(await droitsCouvertsPar("admin", "planning")).toBe(false);
    expect(await droitsCouvertsPar("admin", "chef_equipe")).toBe(false);
    expect(await droitsCouvertsPar("admin", "ordo")).toBe(false);
  });
});

describe("roleModifiablePar — colonnes de la matrice des droits", () => {
  it("personne ne peut modifier les droits de l'admin, pas meme l'admin", async () => {
    for (const r of ROLES) expect(await roleModifiablePar("admin", r)).toBe(false);
  });

  it("nul ne modifie son propre role (anti-verrou)", async () => {
    for (const r of ROLES) expect(await roleModifiablePar(r, r)).toBe(false);
  });

  it("l'admin peut modifier tous les autres roles", async () => {
    for (const r of ROLES) {
      if (r === "admin") continue;
      expect(await roleModifiablePar(r, "admin")).toBe(true);
    }
  });

  it("le role tout-puissant est DEDUIT de la matrice, pas ecrit en dur", () => {
    expect(ROLE_TOUT_PUISSANT).toBe("admin");
    for (const m of MODULE_KEYS) expect(defaultsFor(ROLE_TOUT_PUISSANT!)[m]).toBe("write");
  });

  it("un delegue garde une matrice UTILISABLE : tous les roles sauf admin et le sien", async () => {
    // Garde-fou d'ergonomie. Une regle plus stricte — n'editer que les roles
    // strictement plus faibles que soi — grisait TOUTE la matrice, les roles
    // n'etant pas ordonnes entre eux.
    const ouverts: string[] = [];
    for (const r of ROLES) if (await roleModifiablePar(r, "planning")) ouverts.push(r);
    expect(ouverts).not.toContain("admin");
    expect(ouverts).not.toContain("planning");
    expect(ouverts.length).toBe(ROLES.length - 2);
  });
});

describe("verifierChangementDroit — les 3 verrous de /api/droits", () => {
  it("REGRESSION : un delegue ne peut pas DEGRADER l'admin", async () => {
    // Bug remonte le 23/07/2026 : l'anti-escalade seule laissait passer la
    // retrogradation. Baisser un droit de l'admin est un abaissement, donc
    // invisible pour un controle qui ne regarde que « accorde-t-on trop ? ».
    for (const r of ROLES) {
      if (r === "admin") continue;
      for (const niveau of ["none", "read", "write"] as const) {
        const v = await verifierChangementDroit(r, "admin", "personnel", niveau);
        expect(v.ok, `${r} ne doit pas pouvoir mettre admin.personnel a ${niveau}`).toBe(false);
      }
    }
  });

  it("l'admin lui-meme ne peut pas toucher aux droits de l'admin (anti-verrou)", async () => {
    const v = await verifierChangementDroit("admin", "admin", "utilisateurs", "none");
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.status).toBe(400);
  });

  it("refuse d'accorder un niveau qu'on n'a pas soi-meme (anti-escalade)", async () => {
    // ordo n'a que `personnel: read` -> il ne peut pas donner `personnel: write`.
    const v = await verifierChangementDroit("ordo", "rh", "personnel", "write");
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.status).toBe(403);
  });

  it("laisse passer un changement legitime", async () => {
    expect((await verifierChangementDroit("admin", "ordo", "bilans", "write")).ok).toBe(true);
    expect((await verifierChangementDroit("admin", "rh", "journal", "none")).ok).toBe(true);
  });

  it("l'admin garde tous ses droits quel que soit l'appelant et le module", async () => {
    for (const m of MODULE_KEYS) {
      for (const r of ROLES) {
        expect((await verifierChangementDroit(r, "admin", m, "none")).ok).toBe(false);
      }
    }
  });
});

describe("canRead / canWrite", () => {
  it("write implique read", () => {
    const p = defaultsFor("admin");
    for (const m of MODULE_KEYS) {
      expect(canRead(p, m)).toBe(true);
      expect(canWrite(p, m)).toBe(true);
    }
  });

  it("none n'implique rien", () => {
    const p = defaultsFor("intrus");
    for (const m of MODULE_KEYS) {
      expect(canRead(p, m)).toBe(false);
      expect(canWrite(p, m)).toBe(false);
    }
  });
});
