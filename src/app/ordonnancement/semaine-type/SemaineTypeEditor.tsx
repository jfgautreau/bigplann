"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { defaultQuartActif } from "@/lib/week";

type Quart = { code: string; libelle: string };
type Ligne = { id: string; label: string; quarts?: string[] };
type Profil = { id: string; nom: string; par_defaut: boolean };

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
// iso de reference par jour de semaine (juste pour le fallback defaultQuartActif :
// 2024-01-01 = lundi ... 2024-01-07 = dimanche).
const REF_ISO = ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05", "2024-01-06", "2024-01-07"];

export default function SemaineTypeEditor({
  quarts,
  lignes = [],
  initial,
  initialOuverture = {},
  profils = [],
  profilId = null,
}: {
  quarts: Quart[];
  lignes?: Ligne[];
  initial: Record<string, boolean>; // `${code}:${jour 0-6}` -> actif
  initialOuverture?: Record<string, boolean>; // `${code}:${ligne}:${jour 0-6}` -> ouverte
  profils?: Profil[];
  profilId?: string | null;
}) {
  const router = useRouter();
  const [state, setState] = useState<Record<string, boolean>>(initial);
  const [ouv, setOuv] = useState<Record<string, boolean>>(initialOuverture);
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const goProfil = (id: string) => router.push(`/ordonnancement/semaine-type?profil=${id}`);
  async function profilOp(op: string, payload: Record<string, unknown>) {
    const res = await fetch("/api/ordonnancement/semaine-type-profil", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op, ...payload }),
    });
    return res.ok ? ((await res.json().catch(() => ({}))) as { row?: Profil }) : null;
  }
  async function newProfil() {
    const nom = window.prompt("Nom du nouveau profil (ex. Été) :", "")?.trim();
    if (!nom) return;
    const j = await profilOp("create", { nom });
    if (j?.row) goProfil(j.row.id);
  }
  async function renameProfil() {
    if (!profilId) return;
    const cur = profils.find((p) => p.id === profilId);
    const nom = window.prompt("Renommer le profil :", cur?.nom ?? "")?.trim();
    if (!nom) return;
    if (await profilOp("rename", { id: profilId, nom })) router.refresh();
  }
  async function deleteProfil() {
    if (!profilId) return;
    if (profils.length <= 1) { window.alert("Impossible de supprimer le dernier profil."); return; }
    if (!window.confirm("Supprimer ce profil de semaine type ? Son gabarit sera perdu.")) return;
    if (await profilOp("delete", { id: profilId })) router.push("/ordonnancement/semaine-type");
  }
  async function setDefaultProfil() {
    if (!profilId) return;
    if (await profilOp("set-default", { id: profilId })) router.refresh();
  }

  const flash = (ok: boolean) => {
    setSave(ok ? "saved" : "error");
    setTimeout(() => setSave("idle"), 1500);
  };

  const actif = (code: string, j: number) => {
    const k = `${code}:${j}`;
    return k in state ? state[k] : defaultQuartActif(REF_ISO[j], code);
  };

  // Ouverture ligne : absente = ouvert (true).
  const ligneOuverte = (code: string, lg: string, j: number) => {
    const k = `${code}:${lg}:${j}`;
    return k in ouv ? ouv[k] : true;
  };

  async function toggle(code: string, j: number) {
    if (!profilId) return;
    const next = !actif(code, j);
    setState((s) => ({ ...s, [`${code}:${j}`]: next }));
    setSave("saving");
    try {
      const res = await fetch("/api/ordonnancement/semaine-type", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profil_id: profilId, quart_code: code, jour_semaine: j, value: next }),
      });
      flash(res.ok);
    } catch {
      flash(false);
    }
  }

  async function toggleLigne(code: string, lg: string, j: number) {
    if (!profilId || !actif(code, j)) return; // quart inactif -> lignes fermees de toute facon
    const next = !ligneOuverte(code, lg, j);
    setOuv((s) => ({ ...s, [`${code}:${lg}:${j}`]: next }));
    setSave("saving");
    try {
      const res = await fetch("/api/ordonnancement/semaine-type-ouverture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profil_id: profilId, quart_code: code, ligne_id: lg, jour_semaine: j, value: next }),
      });
      flash(res.ok);
    } catch {
      flash(false);
    }
  }

  return (
    <div className="card section" style={{ overflowX: "auto" }}>
      {/* Sélecteur de profil de semaine type + gestion */}
      <div className="toolbar" style={{ alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <span className="muted" style={{ fontWeight: 600 }}>Profil :</span>
        <select value={profilId ?? ""} onChange={(e) => e.target.value && goProfil(e.target.value)} disabled={profils.length === 0} style={{ width: "auto", minWidth: 180 }}>
          {profils.length === 0 && <option value="">Aucun profil</option>}
          {profils.map((p) => (
            <option key={p.id} value={p.id}>{p.nom}{p.par_defaut ? " · défaut" : ""}</option>
          ))}
        </select>
        <button type="button" className="btn-sm btn-ghost" style={{ width: "auto" }} onClick={newProfil}>＋ Nouveau</button>
        <button type="button" className="btn-sm btn-ghost" style={{ width: "auto" }} onClick={renameProfil} disabled={!profilId}>Renommer</button>
        <button type="button" className="btn-sm btn-ghost" style={{ width: "auto" }} onClick={setDefaultProfil} disabled={!profilId || !!profils.find((p) => p.id === profilId)?.par_defaut}>Définir par défaut</button>
        <button type="button" className="btn-sm btn-ghost" style={{ width: "auto", color: "var(--danger)" }} onClick={deleteProfil} disabled={!profilId || profils.length <= 1}>Supprimer</button>
      </div>
      {profils.length === 0 && (
        <p className="muted" style={{ marginTop: -4 }}>
          Aucun profil : créez-en un (« ＋ Nouveau ») pour commencer. (Migration 0028 requise.)
        </p>
      )}

      <div className="toolbar" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Quarts actifs par jour</h2>
        <span style={{ fontSize: 12, fontWeight: 600, color: save === "error" ? "var(--danger)" : save === "saved" ? "var(--ok)" : "var(--muted)" }}>
          {save === "saving" ? "Enregistrement…" : save === "saved" ? "Enregistré ✓" : save === "error" ? "Échec" : ""}
        </span>
      </div>
      <table className="matrix" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", minWidth: 130 }}>Quart</th>
            {JOURS.map((j, i) => (
              <th key={j} style={{ textAlign: "center", width: 60, color: i === 6 ? "var(--danger)" : undefined }}>
                {j}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {quarts.map((q) => (
            <tr key={q.code}>
              <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{q.libelle}</td>
              {JOURS.map((_, j) => {
                const on = actif(q.code, j);
                return (
                  <td key={j} style={{ textAlign: "center", background: on ? undefined : "#fee2e2" }}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(q.code, j)}
                      style={{ width: "auto", cursor: "pointer" }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
          {quarts.length === 0 && (
            <tr>
              <td colSpan={8} className="muted">Aucun quart configuré.</td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="muted" style={{ marginTop: 10 }}>
        Ce gabarit définit l&apos;état <strong>par défaut</strong>{" "}
        des quarts quand une semaine n&apos;a pas encore été éditée, et sert de référence
        au bouton <strong>« Réinitialiser »</strong>{" "}
        de chaque semaine dans l&apos;ordonnancement.
      </p>

      {/* Ouverture des lignes par defaut, par quart */}
      <h2 style={{ marginTop: 24 }}>Lignes ouvertes par défaut</h2>
      <p className="muted" style={{ marginTop: -8 }}>
        Décochez une case pour fermer une ligne par défaut ce jour-là (sur le quart concerné).
        Une ligne non listée reste ouverte. Les cases sont verrouillées si le quart est inactif.
      </p>
      {quarts.map((q) => {
        // On ne propose que les lignes qui tournent sur ce quart (référentiel).
        const lignesQuart = lignes.filter((l) => !l.quarts || l.quarts.includes(q.code));
        return (
        <div key={q.code} className="card section" style={{ overflowX: "auto", marginTop: 12 }}>
          <h3 style={{ marginTop: 0, fontSize: 14 }}>{q.libelle}</h3>
          <table className="matrix" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", minWidth: 150 }}>Ligne</th>
                {JOURS.map((j, i) => (
                  <th key={j} style={{ textAlign: "center", width: 60, color: i === 6 ? "var(--danger)" : undefined }}>{j}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lignesQuart.map((l) => (
                <tr key={l.id}>
                  <td style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.label}</td>
                  {JOURS.map((_, j) => {
                    const quartOn = actif(q.code, j);
                    const on = ligneOuverte(q.code, l.id, j);
                    return (
                      <td key={j} style={{ textAlign: "center", background: quartOn && !on ? "#fee2e2" : undefined }}>
                        <input
                          type="checkbox"
                          checked={quartOn && on}
                          disabled={!quartOn}
                          onChange={() => toggleLigne(q.code, l.id, j)}
                          style={{ width: "auto", cursor: quartOn ? "pointer" : "not-allowed" }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
              {lignesQuart.length === 0 && (
                <tr>
                  <td colSpan={8} className="muted">Aucune ligne ne tourne sur ce quart (référentiel).</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        );
      })}
    </div>
  );
}
