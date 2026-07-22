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
  // Suppression : confirmation en deux temps, dans la modale plutot qu'en
  // `confirm()` natif (le reste de l'app n'utilise jamais les boites du navigateur).
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const comp = comps.find((c) => c.id === competenceId);
  // Recyclage : la personne detient deja cette formation (une date etait pre-remplie).
  const recyclage = !!initial.dateObtention;
  // On ne propose la suppression que sur la ligne effectivement ouverte : si l'on
  // change de personne ou de formation dans les listes, la cible n'existe plus
  // forcement et l'on supprimerait autre chose que ce qui est affiche.
  const peutSupprimer =
    recyclage && personneId === initial.personneId && competenceId === initial.competenceId;

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

  async function supprimer() {
    setDeleting(true);
    setErr(null);
    try {
      const res = await fetch("/api/habilitations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personne_id: initial.personneId, competence_id: initial.competenceId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Échec de la suppression.");
      }
      router.refresh();
      onClose();
    } catch (e2) {
      setDeleting(false);
      setConfirmDel(false);
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

            {peutSupprimer && !confirmDel && (
              <button
                type="button"
                onClick={() => setConfirmDel(true)}
                title="Supprimer cette habilitation"
                className="btn-sm"
                style={{
                  background: "#fff",
                  // Fond clair : la couleur du texte doit etre posee explicitement,
                  // le style global des boutons impose du blanc (cf. CLAUDE.md).
                  color: "var(--danger)",
                  border: "1px solid var(--danger)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6M14 11v6" />
                </svg>
                Supprimer
              </button>
            )}

            {peutSupprimer && confirmDel && (
              <>
                <button
                  type="button"
                  onClick={supprimer}
                  disabled={deleting}
                  className="btn-sm"
                  style={{ background: "var(--danger)", color: "#fff", border: "1px solid var(--danger)" }}
                >
                  {deleting ? "Suppression…" : "Confirmer la suppression"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDel(false)}
                  disabled={deleting}
                  className="btn-sm btn-ghost"
                >
                  Annuler
                </button>
              </>
            )}
          </form>

          {peutSupprimer && confirmDel && (
            <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 8, marginBottom: 0 }}>
              L&apos;habilitation sera retirée du dossier de la personne. Cette action est définitive.
            </p>
          )}

          {err && <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 0 }}>{err}</p>}
          <p className="muted" style={{ marginTop: 8, marginBottom: 0, fontSize: 12 }}>
            L&apos;expiration est calculée automatiquement (passage + durée de validité).
          </p>
        </div>
      </div>
    </div>
  );
}
