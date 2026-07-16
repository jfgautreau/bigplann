"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtDateFr } from "@/lib/habilitations";

type Personne = { id: string; nom: string; prenom: string };
type Comp = { id: string; nom: string; duree_validite_mois: number | null; a_autorisation_conduite: boolean };

// Saisie / recyclage d'une habilitation. Ouverte au clic sur une pastille de la
// grille : personne, formation et date du jour sont deja renseignees, il ne reste
// qu'a valider. Les trois champs restent modifiables (mauvaise pastille cliquee,
// passage anterieur a saisir apres coup).
export default function HabMajModal({
  personnes,
  comps,
  initial,
  dateJour,
  onClose,
}: {
  personnes: Personne[];
  comps: Comp[];
  initial: { personneId: string; competenceId: string; dateObtention: string | null; dateAutorisation: string | null };
  dateJour: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [personneId, setPersonneId] = useState(initial.personneId);
  const [competenceId, setCompetenceId] = useState(initial.competenceId);
  // Toujours la date du jour : on saisit une habilitation le jour ou on l'apprend.
  // L'eventuel passage precedent n'est rappele qu'a titre indicatif.
  const [dateObtention, setDateObtention] = useState(dateJour);
  const [dateAutor, setDateAutor] = useState(initial.dateAutorisation ?? "");
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);

  const comp = comps.find((c) => c.id === competenceId);
  // Recyclage : la personne detient deja cette formation (une date etait pre-remplie).
  const recyclage = !!initial.dateObtention;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    setErr(null);
    try {
      const res = await fetch("/api/habilitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personne_id: personneId,
          competence_id: competenceId,
          date_obtention: dateObtention,
          date_autorisation_conduite: dateAutor || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Échec de l'enregistrement.");
      }
      router.refresh();
      onClose();
    } catch (e2) {
      setState("error");
      setErr(e2 instanceof Error ? e2.message : "Échec.");
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "8vh 16px", overflow: "auto" }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 520 }}>
        <div className="card" style={{ margin: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h2 style={{ margin: 0, fontSize: 19 }}>{recyclage ? "Recycler une habilitation" : "Enregistrer une habilitation"}</h2>
            <button type="button" onClick={onClose} title="Fermer" style={{ width: "auto", margin: 0, padding: "2px 10px", fontSize: 16 }}>
              ✕
            </button>
          </div>

          {recyclage && (
            <p className="muted" style={{ marginTop: 0, marginBottom: 10, fontSize: 13 }}>
              Dernier passage le <strong>{fmtDateFr(initial.dateObtention)}</strong>. Enregistrer
              remplace cette date par celle saisie ci-dessous.
            </p>
          )}

          <form onSubmit={submit} autoComplete="off" className="inline-form">
            <div className="field">
              <span>Personne</span>
              <select value={personneId} onChange={(e) => setPersonneId(e.target.value)} required>
                <option value="" disabled>Choisir...</option>
                {personnes.map((p) => (
                  <option key={p.id} value={p.id}>{p.nom} {p.prenom}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <span>Habilitation</span>
              <select value={competenceId} onChange={(e) => setCompetenceId(e.target.value)} required>
                <option value="" disabled>Choisir...</option>
                {comps.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}{c.duree_validite_mois ? ` (${c.duree_validite_mois} mois)` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <span>Date de passage</span>
              <input type="date" value={dateObtention} onChange={(e) => setDateObtention(e.target.value)} required />
            </div>
            {comp?.a_autorisation_conduite && (
              <div className="field">
                <span>Autorisation de conduite</span>
                <input type="date" value={dateAutor} onChange={(e) => setDateAutor(e.target.value)} />
              </div>
            )}
            <button type="submit" className="btn-sm" disabled={state === "saving"}>
              {state === "saving" ? "Enregistrement…" : "Enregistrer"}
            </button>
          </form>

          {err && <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 0 }}>{err}</p>}
          <p className="muted" style={{ marginTop: 8, marginBottom: 0, fontSize: 12 }}>
            L&apos;expiration est calculée automatiquement (passage + durée de validité).
          </p>
        </div>
      </div>
    </div>
  );
}
