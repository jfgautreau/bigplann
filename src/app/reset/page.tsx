"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { validatePasswordPolicy } from "@/lib/password";

// Page atteinte apres clic sur un lien d'invitation ou de recuperation :
// la session est deja ouverte (via /auth/callback), il reste a definir le mdp.
export default function ResetPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const policyError = validatePasswordPolicy(password);
    if (policyError) {
      setError(policyError);
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setPending(true);
    const { error } = await supabase.auth.updateUser({ password });
    setPending(false);
    if (error) {
      setError("Échec de la mise à jour. Le lien a peut-être expiré.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="container">
      <div className="card card-narrow">
        <h1>Définir le mot de passe</h1>
        <form onSubmit={onSubmit}>
          <label htmlFor="password">Nouveau mot de passe</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <label htmlFor="confirm">Confirmer</label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          <p className="muted" style={{ marginTop: 4 }}>
            Min. 8 caractères, 3 classes parmi maj/min/chiffre/spécial.
          </p>
          <button type="submit" disabled={pending}>
            {pending ? "Enregistrement..." : "Valider"}
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      </div>
    </div>
  );
}
