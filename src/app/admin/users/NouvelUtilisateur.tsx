"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROLE_LABELS, ROLES } from "@/lib/roles";
import LienMotDePasse from "./LienMotDePasse";

// Bouton « + » + modale de creation d'un compte. Plus de mot de passe saisi par
// l'admin : on cree le compte et on affiche un lien que l'utilisateur suivra pour
// choisir le sien.
export default function NouvelUtilisateur() {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("chef_equipe");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cree, setCree] = useState<{ email: string; lien?: string; lienErreur?: string } | null>(null);

  function fermer() {
    setOuvert(false);
    setError(null);
    setCree(null);
    setName("");
    setEmail("");
    setRole("chef_equipe");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, role }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Échec.");
      setCree({ email: json.email ?? email, lien: json.lien, lienErreur: json.lienErreur });
      router.refresh();
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Échec.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        title="Ajouter un utilisateur"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          width: "auto",
          margin: 0,
          padding: "6px 16px",
          fontSize: 14,
          fontWeight: 700,
          borderRadius: 999,
        }}
      >
        <span style={{ fontSize: 19, lineHeight: 1, fontWeight: 800 }}>+</span> Ajouter
      </button>

      {ouvert && (
        <div
          onClick={fermer}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgba(15,23,42,0.45)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "8vh 16px",
            overflow: "auto",
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 520 }}>
            <div className="card" style={{ margin: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <h2 style={{ margin: 0, fontSize: 19 }}>Ajouter un utilisateur</h2>
                <button type="button" onClick={fermer} title="Fermer" style={{ width: "auto", margin: 0, padding: "2px 10px", fontSize: 16 }}>
                  ✕
                </button>
              </div>

              {cree ? (
                <>
                  <p className="success" style={{ marginTop: 0 }}>Compte créé pour {cree.email}.</p>
                  {cree.lien ? (
                    <LienMotDePasse lien={cree.lien} email={cree.email} />
                  ) : (
                    <p className="error">
                      Le compte existe, mais le lien n&apos;a pas pu être généré ({cree.lienErreur}).
                      Utilisez « Lien de mot de passe » sur sa ligne pour réessayer.
                    </p>
                  )}
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
                    <button type="button" className="btn-sm btn-ghost" style={{ width: "auto", margin: 0 }} onClick={() => setCree(null)}>
                      Ajouter un autre
                    </button>
                    <button type="button" className="btn-sm" style={{ width: "auto", margin: 0 }} onClick={fermer}>
                      Terminé
                    </button>
                  </div>
                </>
              ) : (
                <form onSubmit={onSubmit} autoComplete="off">
                  <label htmlFor="nu-name">Nom complet</label>
                  <input id="nu-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />

                  <label htmlFor="nu-email">Email</label>
                  <input id="nu-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

                  <label htmlFor="nu-role">Rôle</label>
                  <select id="nu-role" value={role} onChange={(e) => setRole(e.target.value)} required>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>

                  <p className="muted" style={{ marginTop: 10, fontSize: 12.5 }}>
                    Aucun mot de passe à choisir : après création, un lien s&apos;affiche.
                    Transmettez-le à la personne, qui définira elle-même son mot de passe.
                  </p>

                  <button type="submit" disabled={pending}>
                    {pending ? "Création…" : "Créer le compte"}
                  </button>
                  {error && <p className="error">{error}</p>}
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
