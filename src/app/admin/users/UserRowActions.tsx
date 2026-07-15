"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ToggleSwitch from "@/components/ToggleSwitch";

// Actions par ligne (admin) : activer/desactiver le compte et reinitialiser le
// mot de passe (saisi par l'admin, applique directement).
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
  const [showReset, setShowReset] = useState(false);
  const [pwd, setPwd] = useState("");
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

  async function submitReset() {
    setPending(true);
    setMsg(null);
    const res = await fetch("/api/users/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, password: pwd }),
    });
    setPending(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      flash("err", j.error ?? "Échec.", 4000);
      return;
    }
    setPwd("");
    setShowReset(false);
    flash("ok", "Mot de passe réinitialisé.", 3500);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {isSelf ? (
          <span className="muted">Actif (vous)</span>
        ) : (
          <ToggleSwitch on={active} onChange={toggleActive} title="Activer / désactiver le compte (bloque la connexion)" />
        )}
        <button type="button" className="btn-sm btn-ghost" style={{ width: "auto" }} onClick={() => setShowReset((s) => !s)}>
          🔑 Réinitialiser le mot de passe
        </button>
      </div>
      {showReset && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <input
            type="text"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="Nouveau mot de passe"
            autoComplete="new-password"
            style={{ width: 220 }}
          />
          <button type="button" className="btn-sm" style={{ width: "auto" }} disabled={pending || !pwd} onClick={submitReset}>
            {pending ? "…" : "Valider"}
          </button>
          <span className="muted" style={{ fontSize: 11 }}>Min. 8 car., 3 classes (maj/min/chiffre/spécial).</span>
        </div>
      )}
      {msg && (
        <span style={{ fontSize: 12, fontWeight: 600, color: msg.t === "err" ? "var(--danger)" : "var(--ok)" }}>{msg.m}</span>
      )}
    </div>
  );
}
