"use client";

import { useActionState } from "react";
import { createUserAction } from "./actions";

const ROLE_OPTIONS: [string, string][] = [
  ["ADMIN", "Administrateur"],
  ["RESP_PROD", "Responsable production"],
  ["RESP_PLANNING", "Responsable planning"],
  ["CHEF_EQUIPE", "Chef d'equipe"],
  ["ORDONNANCEMENT", "Ordonnancement"],
  ["RH", "RH"],
  ["DIRECTION", "Direction / Reporting"],
];

export default function UserForm() {
  const [state, formAction, pending] = useActionState(createUserAction, {});

  return (
    <form action={formAction}>
      <label htmlFor="name">Nom complet</label>
      <input id="name" name="name" type="text" required />

      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" required />

      <label htmlFor="role">Role</label>
      <select id="role" name="role" defaultValue="CHEF_EQUIPE" required>
        {ROLE_OPTIONS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <label htmlFor="password">Mot de passe initial</label>
      <input id="password" name="password" type="text" required />
      <p className="muted" style={{ marginTop: 4 }}>
        Min. 8 caracteres, 3 classes parmi maj/min/chiffre/special.
      </p>

      <button type="submit" disabled={pending}>
        {pending ? "Creation..." : "Creer l'utilisateur"}
      </button>
      {state.error && <p className="error">{state.error}</p>}
      {state.success && <p className="success">{state.success}</p>}
    </form>
  );
}
