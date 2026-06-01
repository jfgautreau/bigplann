"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROLE_LABELS, ROLES } from "@/lib/roles";

type Mode = "create" | "invite";

export default function UserForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("create");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("chef_equipe");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setPending(true);

    const endpoint =
      mode === "create" ? "/api/users/create" : "/api/users/invite";
    const payload =
      mode === "create"
        ? { email, name, role, password }
        : { email, name, role };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setPending(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "Echec.");
      return;
    }
    setSuccess(
      mode === "create"
        ? `Compte cree pour ${email}.`
        : `Invitation envoyee a ${email}.`
    );
    setName("");
    setEmail("");
    setPassword("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="modes">
        <label className="mode">
          <input
            type="radio"
            name="mode"
            checked={mode === "create"}
            onChange={() => setMode("create")}
          />
          Creer avec un mot de passe
        </label>
        <label className="mode">
          <input
            type="radio"
            name="mode"
            checked={mode === "invite"}
            onChange={() => setMode("invite")}
          />
          Inviter par email
        </label>
      </div>

      <label htmlFor="name">Nom complet</label>
      <input
        id="name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />

      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <label htmlFor="role">Role</label>
      <select
        id="role"
        value={role}
        onChange={(e) => setRole(e.target.value)}
        required
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </select>

      {mode === "create" && (
        <>
          <label htmlFor="password">Mot de passe initial</label>
          <input
            id="password"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <p className="muted" style={{ marginTop: 4 }}>
            Min. 8 caracteres, 3 classes parmi maj/min/chiffre/special.
          </p>
        </>
      )}

      <button type="submit" disabled={pending}>
        {pending
          ? "..."
          : mode === "create"
            ? "Creer l'utilisateur"
            : "Inviter l'utilisateur"}
      </button>
      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}
    </form>
  );
}
