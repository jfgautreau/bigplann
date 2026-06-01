"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, {});

  return (
    <div className="container">
      <div className="card card-narrow">
        <h1>Connexion</h1>
        <form action={formAction}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
          />
          <label htmlFor="password">Mot de passe</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          <button type="submit" disabled={pending}>
            {pending ? "Connexion..." : "Se connecter"}
          </button>
          {state.error && <p className="error">{state.error}</p>}
        </form>
      </div>
    </div>
  );
}
