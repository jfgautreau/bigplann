"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Bouton « + Nouveau rôle » + petite modale. Le rôle créé apparaît aussitôt dans
// la matrice des droits (aucun droit par défaut) et dans les listes de rôles.
export default function NouveauRole() {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [libelle, setLibelle] = useState("");
  const [pending, setPending] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  function fermer() {
    setOuvert(false);
    setLibelle("");
    setErreur(null);
  }

  async function creer(e: React.FormEvent) {
    e.preventDefault();
    if (!libelle.trim()) return;
    setPending(true);
    setErreur(null);
    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ libelle: libelle.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Échec.");
      fermer();
      router.refresh(); // la matrice et les listes de rôles doivent se repeupler
    } catch (e2) {
      setErreur(e2 instanceof Error ? e2.message : "Échec.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="btn-sm btn-ghost"
        style={{ width: "auto", margin: 0, whiteSpace: "nowrap" }}
        title="Créer un rôle personnalisé"
      >
        + Nouveau rôle
      </button>

      {ouvert && (
        <div
          onClick={fermer}
          style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "10vh 16px", overflow: "auto" }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 440 }}>
            <div className="card" style={{ margin: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <h2 style={{ margin: 0, fontSize: 19 }}>Nouveau rôle</h2>
                <button type="button" onClick={fermer} title="Fermer" style={{ width: "auto", margin: 0, padding: "2px 10px", fontSize: 16 }}>✕</button>
              </div>
              <form onSubmit={creer} autoComplete="off">
                <label htmlFor="nr-lib">Nom du rôle</label>
                <input id="nr-lib" type="text" value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="Ex. Superviseur nuit" autoFocus required />
                <p className="muted" style={{ marginTop: 10, fontSize: 12.5 }}>
                  Le rôle est créé <strong>sans aucun droit</strong>. Réglez ses accès dans la
                  matrice ci-dessous, puis affectez-le aux comptes.
                </p>
                {erreur && <p className="error">{erreur}</p>}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                  <button type="button" className="btn-sm btn-ghost" style={{ width: "auto", margin: 0 }} onClick={fermer}>Annuler</button>
                  <button type="submit" className="btn-sm" style={{ width: "auto", margin: 0 }} disabled={pending || !libelle.trim()}>
                    {pending ? "Création…" : "Valider"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
