"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset`,
    });
    setPending(false);
    // Toujours afficher un succes (ne pas reveler l'existence du compte).
    setSent(true);
  }

  return (
    <div className="container">
      <div className="card card-narrow">
        <h1>Mot de passe oublie</h1>
        {sent ? (
          <p className="success">
            Si un compte existe pour cet email, un lien de reinitialisation a ete
            envoye.
          </p>
        ) : (
          <form onSubmit={onSubmit}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button type="submit" disabled={pending}>
              {pending ? "Envoi..." : "Envoyer le lien"}
            </button>
          </form>
        )}
        <p className="muted" style={{ marginTop: 16 }}>
          <Link href="/login">Retour a la connexion</Link>
        </p>
      </div>
    </div>
  );
}
