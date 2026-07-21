"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROLES, ROLE_LABELS } from "@/lib/roles";

// Role d'un compte, enregistre des le choix (plus de bouton « Enregistrer »),
// avec le retour « Enregistré ✓ » du reste de l'application.
export default function UserRoleSelect({ userId, role: initial }: { userId: string; role: string }) {
  const router = useRouter();
  const [role, setRole] = useState(initial);
  const [etat, setEtat] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);

  async function change(v: string) {
    const avant = role;
    setRole(v);
    setEtat("saving");
    setErr(null);
    try {
      const res = await fetch("/api/users/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, role: v }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Échec.");
      }
      setEtat("saved");
      setTimeout(() => setEtat("idle"), 1500);
      router.refresh(); // la matrice des droits depend des roles en place
    } catch (e) {
      setRole(avant); // rollback
      setEtat("error");
      setErr(e instanceof Error ? e.message : "Échec.");
      setTimeout(() => {
        setEtat("idle");
        setErr(null);
      }, 4000);
    }
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <select value={role} onChange={(e) => change(e.target.value)} style={{ width: "auto", minWidth: 150 }}>
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </select>
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          minWidth: 88,
          color: etat === "error" ? "var(--danger)" : "var(--ok)",
        }}
      >
        {etat === "saving" ? "…" : etat === "saved" ? "Enregistré ✓" : err ?? ""}
      </span>
    </span>
  );
}
