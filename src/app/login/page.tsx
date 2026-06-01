"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setPending(false);
    if (error) {
      setError("Identifiants invalides.");
      return;
    }
    // Recharge cote serveur pour que le middleware voie la session.
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="container">
      <div className="card card-narrow">
        <h1>Connexion</h1>
        <form onSubmit={onSubmit}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label htmlFor="password">Mot de passe</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" disabled={pending}>
            {pending ? "Connexion..." : "Se connecter"}
          </button>
          {error && <p className="error">{error}</p>}
        </form>
        <p className="muted" style={{ marginTop: 16 }}>
          <Link href="/forgot">Mot de passe oublie ?</Link>
        </p>
      </div>
    </div>
  );
}
