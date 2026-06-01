"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROLE_LABELS, ROLES } from "@/lib/roles";

export default function UserForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("chef_equipe");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setPending(true);
    const res = await fetch("/api/users/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, role }),
    });
    setPending(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "Echec de l'invitation.");
      return;
    }
    setSuccess(`Invitation envoyee a ${email}.`);
    setName("");
    setEmail("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
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

      <button type="submit" disabled={pending}>
        {pending ? "Envoi..." : "Inviter l'utilisateur"}
      </button>
      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}
    </form>
  );
}
