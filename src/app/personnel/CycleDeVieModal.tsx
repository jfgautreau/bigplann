"use client";

import { useEffect, useState } from "react";
import PeriodesEditor, { type RefletContrat } from "./PeriodesEditor";
import InfoBulle from "@/components/InfoBulle";
import ModaleDeplacable from "@/components/ModaleDeplacable";
import { statutALaDate, libelleStatut, couleurStatut, contratCouvreLe, type StatutPersonne } from "@/lib/personne-statut";

// Modale « Cycle de vie » — remplace ContratsModal + le bloc « Depart prevu »
// qui vivait auparavant dans AbsencesModal. Rassemble en un seul endroit :
//   • ARRIVEE (date_arrivee)  -> declenche A_VENIR → ACTIF
//   • CONTRATS (PeriodesEditor) -> historique, changement de type
//   • DEPART (date_depart_prevu + motif)  -> declenche ACTIF → PARTI
//
// Statut = resultante (badge en tete de modale). Aucun toggle manuel.

type Personne = {
  id: string;
  label: string;
  date_arrivee: string | null;
  date_depart_prevu: string | null;
  motif_depart: string | null;
  statut: string;
};

type Sync = {
  date_arrivee?: string | null;
  date_depart_prevu?: string | null;
  motif_depart?: string | null;
  statut?: string;
  type_contrat?: string;
  date_fin?: string | null;
  contrat_debut?: string | null;
};

export default function CycleDeVieModal({
  personne,
  canEdit,
  onClose,
  onSync,
}: {
  personne: Personne;
  canEdit: boolean;
  onClose: () => void;
  onSync: (s: Sync) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [arrivee, setArrivee] = useState(personne.date_arrivee ?? "");
  const [depart, setDepart] = useState(personne.date_depart_prevu ?? "");
  const [motif, setMotif] = useState(personne.motif_depart ?? "");
  const [etat, setEtat] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [erreur, setErreur] = useState<string | null>(null);
  const [periodes, setPeriodes] = useState<{ date_debut: string | null; date_fin: string | null }[]>([]);

  // Contrats affiches en direct : sert a signaler visuellement les trous
  // (gap entre CDD et CDI qui masquerait la personne du planning).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/personnel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ op: "periode-list", personne_id: personne.id }),
        });
        const j = await res.json();
        if (!cancelled && res.ok) setPeriodes(j.rows ?? []);
      } catch {
        /* silence */
      }
    })();
    return () => { cancelled = true; };
  }, [personne.id]);

  const statutCalc: StatutPersonne = statutALaDate(
    { date_arrivee: arrivee || null, date_depart_prevu: depart || null },
    today,
  );
  const c = couleurStatut(statutCalc);

  // Detection des trous : si un jour entre l'arrivee et le depart (ou aujourd'hui
  // si depart absent) n'est couvert par aucun contrat, la personne est masquee
  // du planning ce jour-la. On alerte sans bloquer.
  const trous = detecterTrous(periodes, arrivee || null, depart || null);

  async function enregistrer(patch: Sync) {
    if (!canEdit) return;
    setEtat("saving");
    setErreur(null);
    try {
      const res = await fetch("/api/personnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "update", id: personne.id, patch }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error ?? "Enregistrement refuse.");
      setEtat("saved");
      // On propage aussi le statut recalcule (le trigger l'a mis a jour cote DB).
      const nouveau = statutALaDate(
        {
          date_arrivee: (patch.date_arrivee ?? arrivee) || null,
          date_depart_prevu: (patch.date_depart_prevu ?? depart) || null,
        },
        today,
      );
      onSync({ ...patch, statut: nouveau });
      setTimeout(() => setEtat("idle"), 1500);
    } catch (e) {
      setEtat("error");
      setErreur(e instanceof Error ? e.message : "Enregistrement refuse.");
    }
  }

  function onSyncPeriode(reflet: RefletContrat) {
    // Le PeriodesEditor a modifie un contrat : on rafraichit la liste locale
    // (pour re-calculer les trous) et on propage au parent le nouveau reflet.
    // Recharger la liste (leger) :
    fetch("/api/personnel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "periode-list", personne_id: personne.id }),
    })
      .then((r) => r.json())
      .then((j) => setPeriodes(j.rows ?? []))
      .catch(() => {});
    onSync({
      type_contrat: reflet.type_contrat,
      date_fin: reflet.date_fin,
      contrat_debut: reflet.contrat_debut,
    });
  }

  return (
    <ModaleDeplacable onClose={onClose} largeur={1100}>
      {/* En-tete : nom + statut resultant + etat d'enregistrement */}
      <div className="mdd-drag" style={{ cursor: "move" }}>
        <div className="toolbar" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0 }}>Cycle de vie — {personne.label}</h2>
            <span
              style={{
                background: c.bg,
                color: c.fg,
                fontWeight: 600,
                fontSize: 13,
                padding: "3px 10px",
                borderRadius: 999,
              }}
              title={`Statut calcule : ${libelleStatut(statutCalc)}`}
            >
              {libelleStatut(statutCalc)}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: etat === "error" ? "var(--danger)" : "var(--ok)" }}>
              {etat === "saving" ? "…" : etat === "saved" ? "Enregistré ✓" : ""}
            </span>
          </div>
          <button type="button" className="btn-sm btn-ghost" onClick={onClose} style={{ width: "auto" }}>✕</button>
        </div>
      </div>

      {erreur && (
        <div role="alert" style={{ margin: "0 0 12px", padding: "8px 12px", borderRadius: 8, background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", fontSize: 13, fontWeight: 600 }}>
          {erreur}
        </div>
      )}

      {/* ---------- Bloc ARRIVEE ---------- */}
      <section style={sectionStyle}>
        <div style={sectionHead}>
          <h3 style={sectionTitle}>Arrivée</h3>
          <InfoBulle largeur={280}>
            Date d&apos;entrée dans l&apos;effectif. Peut être dans le futur pour anticiper une
            embauche : la personne restera <strong>À&nbsp;venir</strong> jusqu&apos;au jour&nbsp;J,
            puis passera automatiquement <strong>Actif</strong>.
          </InfoBulle>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <input
            type="date"
            value={arrivee}
            disabled={!canEdit}
            onChange={(e) => setArrivee(e.target.value)}
            onBlur={() => arrivee !== (personne.date_arrivee ?? "") && enregistrer({ date_arrivee: arrivee })}
            style={inputDate}
          />
          {arrivee && arrivee > today && (
            <span style={badgeInfo} title="La personne restera À venir jusqu'à cette date">
              Bascule Actif le {fmt(arrivee)}
            </span>
          )}
          {arrivee && arrivee <= today && (
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              Arrivée {fmt(arrivee)} ({joursDepuis(arrivee, today)}).
            </span>
          )}
        </div>
      </section>

      {/* ---------- Bloc CONTRATS ---------- */}
      <section style={sectionStyle}>
        <div style={sectionHead}>
          <h3 style={sectionTitle}>Contrats</h3>
          <InfoBulle largeur={320}>
            Historique complet. Une bascule <strong>Intérim → CDD → CDI</strong> se fait en
            ajoutant un nouveau contrat : le précédent ferme automatiquement la veille.
            Les jours entre deux contrats masquent la personne du planning (elle reste
            visible dans <em>Personnel</em>).
          </InfoBulle>
        </div>
        {trous.length > 0 && (
          <div style={alerteGap}>
            ⚠ <strong>Trou de contrat :</strong>{" "}
            {trous.map((t, i) => (
              <span key={i}>
                {i > 0 ? ", " : ""}
                {fmt(t.debut)} → {fmt(t.fin)} ({t.jours}&nbsp;j)
              </span>
            ))}
            . La personne ne sera pas visible au planning ces jours-là.
          </div>
        )}
        <PeriodesEditor personneId={personne.id} bare onSync={onSyncPeriode} />
      </section>

      {/* ---------- Bloc DEPART ---------- */}
      <section style={{ ...sectionStyle, borderBottom: "none" }}>
        <div style={sectionHead}>
          <h3 style={sectionTitle}>Départ prévu</h3>
          <InfoBulle largeur={300}>
            Date à laquelle la personne quitte l&apos;effectif (retraite, démission, fin de
            mission). Le statut passe automatiquement <strong>Parti</strong> le lendemain
            de cette date. Laisser vide si le départ n&apos;est pas programmé.
          </InfoBulle>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <input
            type="date"
            value={depart}
            disabled={!canEdit}
            onChange={(e) => {
              setDepart(e.target.value);
              enregistrer({ date_depart_prevu: e.target.value, motif_depart: motif });
            }}
            style={inputDate}
          />
          <input
            value={motif}
            disabled={!canEdit}
            placeholder="Retraite, démission, fin de mission…"
            onChange={(e) => setMotif(e.target.value)}
            onBlur={() => motif !== (personne.motif_depart ?? "") && enregistrer({ date_depart_prevu: depart, motif_depart: motif })}
            style={{ flex: 1, minWidth: 220, padding: "5px 8px", fontSize: 13 }}
          />
          {depart && canEdit && (
            <button
              type="button"
              className="btn-sm btn-ghost"
              onClick={() => {
                setDepart("");
                setMotif("");
                enregistrer({ date_depart_prevu: null, motif_depart: null });
              }}
              style={{ width: "auto", padding: "3px 10px", fontSize: 12 }}
              title="Retirer le départ prévu"
            >
              Retirer
            </button>
          )}
        </div>
        {depart && depart > today && (
          <div style={{ marginTop: 8 }}>
            <span style={badgeWarn}>Bascule Parti le {fmt(joursApres(depart, 1))} ({joursDans(depart, today)})</span>
          </div>
        )}
        {depart && depart <= today && (
          <div style={{ marginTop: 8 }}>
            <span style={badgeDanger}>Départ dépassé — statut basculé Parti</span>
          </div>
        )}
      </section>
    </ModaleDeplacable>
  );
}

// ---------- Utilitaires locaux ----------

function detecterTrous(
  contrats: { date_debut: string | null; date_fin: string | null }[],
  arrivee: string | null,
  depart: string | null,
) {
  if (!contrats.length || !arrivee) return [];
  const tries = [...contrats]
    .filter((c) => c.date_debut)
    .sort((a, b) => (a.date_debut ?? "").localeCompare(b.date_debut ?? ""));
  const fin = depart ?? new Date().toISOString().slice(0, 10);

  const trous: { debut: string; fin: string; jours: number }[] = [];
  let curseur = arrivee;
  for (const c of tries) {
    if ((c.date_debut ?? "") > curseur) {
      const veille = decale(c.date_debut!, -1);
      if (curseur <= veille && curseur <= fin && !contratCouvreLe(contrats, curseur)) {
        trous.push({ debut: curseur, fin: veille < fin ? veille : fin, jours: Math.max(1, ecart(curseur, veille < fin ? veille : fin) + 1) });
      }
    }
    if (c.date_fin) curseur = decale(c.date_fin, 1);
    else return trous; // CDI ouvert : plus de trou possible
  }
  if (curseur <= fin && !contratCouvreLe(contrats, fin)) {
    trous.push({ debut: curseur, fin, jours: Math.max(1, ecart(curseur, fin) + 1) });
  }
  return trous;
}

function decale(iso: string, jours: number): string {
  const d = new Date(iso + "T00:00");
  d.setDate(d.getDate() + jours);
  return d.toISOString().slice(0, 10);
}

function ecart(a: string, b: string): number {
  const ms = new Date(b + "T00:00").getTime() - new Date(a + "T00:00").getTime();
  return Math.round(ms / 86_400_000);
}

function fmt(iso: string): string {
  if (!iso) return "";
  return iso.split("-").reverse().join("/");
}

function joursDepuis(iso: string, today: string): string {
  const d = ecart(iso, today);
  if (d === 0) return "aujourd'hui";
  if (d === 1) return "hier";
  if (d < 30) return `il y a ${d} j`;
  if (d < 365) return `il y a ${Math.round(d / 30)} mois`;
  return `il y a ${Math.round(d / 365)} an(s)`;
}

function joursDans(iso: string, today: string): string {
  const d = ecart(today, iso);
  if (d === 0) return "aujourd'hui";
  if (d === 1) return "demain";
  if (d < 30) return `dans ${d} j`;
  if (d < 365) return `dans ${Math.round(d / 30)} mois`;
  return `dans ${Math.round(d / 365)} an(s)`;
}

function joursApres(iso: string, n: number): string {
  return decale(iso, n);
}

// ---------- Styles inline (coherents avec les autres modales) ----------

const sectionStyle: React.CSSProperties = {
  padding: "14px 0",
  borderBottom: "1px solid var(--border)",
};
const sectionHead: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 10,
};
const sectionTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 15,
  fontWeight: 700,
  color: "#0f172a",
};
const inputDate: React.CSSProperties = {
  width: "auto",
  padding: "5px 8px",
  fontSize: 13,
};
const badgeInfo: React.CSSProperties = {
  background: "#dbeafe",
  color: "#1d4ed8",
  padding: "3px 9px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
};
const badgeWarn: React.CSSProperties = {
  background: "#fef3c7",
  color: "#b45309",
  padding: "3px 9px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
};
const badgeDanger: React.CSSProperties = {
  background: "#fee2e2",
  color: "#991b1b",
  padding: "3px 9px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
};
const alerteGap: React.CSSProperties = {
  background: "#fef3c7",
  color: "#78350f",
  border: "1px solid #fde68a",
  borderRadius: 6,
  padding: "6px 10px",
  fontSize: 13,
  marginBottom: 10,
};
