"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ToggleSwitch from "@/components/ToggleSwitch";
import LienMotDePasse from "./LienMotDePasse";

// Actions par ligne (admin) : activer/desactiver le compte et generer un lien de
// mot de passe a transmettre. L'admin ne choisit plus le mot de passe des autres.
export default function UserRowActions({
  userId,
  isActive,
  isSelf,
}: {
  userId: string;
  isActive: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [active, setActive] = useState(isActive);
  const [lien, setLien] = useState<{ url: string; email?: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ t: "ok" | "err"; m: string } | null>(null);

  const flash = (t: "ok" | "err", m: string, ms = 2500) => {
    setMsg({ t, m });
    setTimeout(() => setMsg(null), ms);
  };

  async function toggleActive(v: boolean) {
    setActive(v); // optimiste
    const res = await fetch("/api/users/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, active: v }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setActive(!v); // rollback
      flash("err", j.error ?? "Échec.");
    } else {
      flash("ok", v ? "Compte activé" : "Compte désactivé");
      router.refresh();
    }
  }

  // Genere un lien a usage unique : en regenerer un invalide le precedent, on
  // referme donc l'ancien avant d'afficher le nouveau.
  async function genererLien() {
    setPending(true);
    setMsg(null);
    setLien(null);
    const res = await fetch("/api/users/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    setPending(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      flash("err", j.error ?? "Échec.", 4000);
      return;
    }
    setLien({ url: j.lien, email: j.email });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {isSelf ? (
          <span className="muted">Actif (vous)</span>
        ) : (
          <ToggleSwitch on={active} onChange={toggleActive} title="Activer / désactiver le compte (bloque la connexion)" />
        )}
        <button
          type="button"
          className="btn-sm btn-ghost"
          style={{ width: "auto" }}
          disabled={pending}
          onClick={genererLien}
          title="Générer un lien que la personne suivra pour définir son mot de passe"
        >
          🔑 {pending ? "…" : lien ? "Regénérer le lien" : "Lien de mot de passe"}
        </button>
        {lien && (
          <button type="button" className="btn-sm btn-ghost" style={{ width: "auto" }} onClick={() => setLien(null)}>
            Masquer
          </button>
        )}
      </div>
      {lien && <LienMotDePasse lien={lien.url} email={lien.email} />}
      {msg && (
        <span style={{ fontSize: 12, fontWeight: 600, color: msg.t === "err" ? "var(--danger)" : "var(--ok)" }}>{msg.m}</span>
      )}
    </div>
  );
}
