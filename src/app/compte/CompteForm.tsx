"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { validatePasswordPolicy } from "@/lib/password";

export default function CompteForm({
  name,
  email,
  role,
}: {
  name: string;
  email: string;
  role: string;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwdState, setPwdState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [pwdError, setPwdError] = useState<string | null>(null);

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwdError(null);
    const policyError = validatePasswordPolicy(password);
    if (policyError) {
      setPwdError(policyError);
      return;
    }
    if (password !== confirm) {
      setPwdError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setPwdState("saving");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setPwdError("Échec de la mise à jour du mot de passe.");
      setPwdState("error");
      return;
    }
    setPassword("");
    setConfirm("");
    setPwdState("saved");
  }

  const ro: React.CSSProperties = { opacity: 0.7 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Mes informations (lecture seule : gerees par un administrateur) */}
      <div className="card" style={{ padding: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Mes informations</h2>

        <label htmlFor="name">Nom affiché</label>
        <input id="name" type="text" value={name} disabled style={ro} />

        <label htmlFor="email" style={{ marginTop: 10 }}>Email</label>
        <input id="email" type="email" value={email} disabled style={ro} />

        <label htmlFor="role" style={{ marginTop: 10 }}>Rôle</label>
        <input id="role" type="text" value={role} disabled style={ro} />

        <p className="muted" style={{ marginTop: 6 }}>
          Le nom, l&apos;email et le rôle sont gérés par un administrateur.
        </p>
      </div>

      {/* Mot de passe (seul element modifiable par l'utilisateur) */}
      <form id="mot-de-passe" className="card" onSubmit={savePassword} style={{ padding: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Changer le mot de passe</h2>

        <label htmlFor="password">Nouveau mot de passe</label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <label htmlFor="confirm" style={{ marginTop: 10 }}>Confirmer</label>
        <input
          id="confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <p className="muted" style={{ marginTop: 4 }}>
          Min. 8 caractères, 3 classes parmi maj/min/chiffre/spécial.
        </p>

        <button type="submit" disabled={pwdState === "saving" || !password} style={{ width: "auto", marginTop: 6 }}>
          {pwdState === "saving" ? "Mise à jour..." : "Mettre à jour"}
        </button>
        {pwdState === "saved" && (
          <span style={{ marginLeft: 10, color: "var(--ok)", fontWeight: 600, fontSize: 13 }}>
            Mot de passe mis à jour ✓
          </span>
        )}
        {pwdError && <p className="error">{pwdError}</p>}
      </form>
    </div>
  );
}
