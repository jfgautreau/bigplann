"use client";

import { useRef, useState } from "react";
import ToggleSwitch from "@/components/ToggleSwitch";

type Poste = {
  id: string;
  nom: string;
  nom_court: string | null;
  est_conducteur: boolean;
  categorie: string;
  effectif_requis: number;
  difficulte_formation: number | null;
  niveau_min_requis: number;
  ordre_affichage: number;
  actif: boolean;
};
type Ligne = { id: string; nom: string; actif: boolean; ordre_affichage: number; poste: Poste[] };
type Atelier = { id: string; nom: string; actif: boolean; ligne: Ligne[] };
type Quart = { code: string; libelle: string };

const CATEGORIES: { value: string; label: string }[] = [
  { value: "manager", label: "Manager" },
  { value: "conducteur", label: "Conducteur" },
  { value: "operateur", label: "Opérateur" },
];

const byNom = <T extends { nom: string }>(a: T, b: T) => a.nom.localeCompare(b.nom);

// Petit champ d'ajout : saisie d'un nom + Entree (ou bouton) pour creer.
function AddInput({ placeholder, onAdd, width = 220 }: { placeholder: string; onAdd: (v: string) => void; width?: number }) {
  const [v, setV] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const t = v.trim();
        if (t) { onAdd(t); setV(""); }
      }}
      className="inline-form"
      style={{ margin: 0 }}
    >
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} style={{ width }} />
      <button type="submit" className="btn-sm btn-ghost">+ Ajouter</button>
    </form>
  );
}

export default function ReferentielEditor({
  initial,
  quarts = [],
  pqOff = [],
}: {
  initial: Atelier[];
  quarts?: Quart[];
  pqOff?: string[];
}) {
  const [tree, setTree] = useState<Atelier[]>(initial);
  // Desactivations poste x quart (cle `${poste}:${quart}`). Absent = actif.
  const [off, setOff] = useState<Set<string>>(new Set(pqOff));
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function post(op: string, payload: Record<string, unknown>) {
    setSave("saving");
    try {
      const res = await fetch("/api/referentiel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op, ...payload }),
      });
      if (!res.ok) throw new Error();
      const j = await res.json().catch(() => ({}));
      setSave("saved");
      return j as { ok?: boolean; row?: unknown };
    } catch {
      setSave("error");
      return null;
    } finally {
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSave("idle"), 1500);
    }
  }
  function schedule(key: string, fn: () => void, delay: number) {
    if (timers.current[key]) clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(fn, delay);
  }

  // -- mutateurs d'etat immuables --
  const setAtelier = (aid: string, fn: (a: Atelier) => Atelier) =>
    setTree((t) => t.map((a) => (a.id === aid ? fn(a) : a)));
  const setLigne = (aid: string, lid: string, fn: (l: Ligne) => Ligne) =>
    setAtelier(aid, (a) => ({ ...a, ligne: a.ligne.map((l) => (l.id === lid ? fn(l) : l)) }));
  const setPoste = (aid: string, lid: string, pid: string, fn: (p: Poste) => Poste) =>
    setLigne(aid, lid, (l) => ({ ...l, poste: l.poste.map((p) => (p.id === pid ? fn(p) : p)) }));

  // -- Atelier --
  function renameAtelier(aid: string, nom: string) {
    setAtelier(aid, (a) => ({ ...a, nom }));
    schedule(`a:${aid}`, () => post("update-atelier", { id: aid, nom }), 500);
  }
  function toggleAtelier(aid: string, actif: boolean) {
    setAtelier(aid, (a) => ({ ...a, actif }));
    post("toggle", { entity: "atelier", id: aid, actif });
  }
  async function addAtelier(nom: string) {
    const j = await post("create-atelier", { nom });
    if (j?.row) setTree((t) => [...t, j.row as Atelier].sort(byNom));
  }

  // -- Ligne --
  function renameLigne(aid: string, lid: string, nom: string) {
    setLigne(aid, lid, (l) => ({ ...l, nom }));
    schedule(`l:${lid}`, () => post("update-ligne", { id: lid, nom }), 500);
  }
  function ligneOrdre(aid: string, lid: string, ordre_affichage: number) {
    setLigne(aid, lid, (l) => ({ ...l, ordre_affichage }));
    schedule(`l:${lid}:ordre`, () => post("update-ligne", { id: lid, ordre_affichage }), 500);
  }
  function toggleLigne(aid: string, lid: string, actif: boolean) {
    setLigne(aid, lid, (l) => ({ ...l, actif }));
    post("toggle", { entity: "ligne", id: lid, actif });
  }
  async function addLigne(aid: string, nom: string) {
    const j = await post("create-ligne", { atelier_id: aid, nom });
    if (j?.row) setAtelier(aid, (a) => ({ ...a, ligne: [...a.ligne, j.row as Ligne].sort(byNom) }));
  }

  // -- Poste --
  function posteField(aid: string, lid: string, pid: string, key: keyof Poste, value: unknown) {
    setPoste(aid, lid, pid, (p) => ({ ...p, [key]: value }));
    const delay = key === "nom" || key === "nom_court" || key === "effectif_requis" || key === "ordre_affichage" ? 500 : 0;
    schedule(`p:${pid}:${key}`, () => post("update-poste", { id: pid, patch: { [key]: value } }), delay);
  }
  function togglePoste(aid: string, lid: string, pid: string, actif: boolean) {
    posteField(aid, lid, pid, "actif", actif);
  }
  // Activation poste x quart (coche = actif). Defaut actif : on ne stocke que les off.
  const quartOn = (pid: string, q: string) => !off.has(`${pid}:${q}`);
  function toggleQuart(pid: string, q: string, on: boolean) {
    setOff((s) => {
      const n = new Set(s);
      const k = `${pid}:${q}`;
      if (on) n.delete(k);
      else n.add(k);
      return n;
    });
    post("poste-quart", { poste_id: pid, quart_code: q, actif: on });
  }
  async function addPoste(aid: string, lid: string, nom: string) {
    const j = await post("create-poste", { ligne_id: lid, nom });
    if (j?.row) setLigne(aid, lid, (l) => ({ ...l, poste: [...l.poste, j.row as Poste].sort(byNom) }));
  }

  const saveLabel =
    save === "saving" ? "Enregistrement…" : save === "saved" ? "Enregistré ✓" : save === "error" ? "Échec d'enregistrement" : "";
  const saveColor = save === "error" ? "var(--danger)" : save === "saved" ? "var(--ok)" : "var(--muted)";

  const num = (v: number) => (Number.isFinite(v) ? v : 0);

  return (
    <div>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          display: "flex",
          justifyContent: "flex-end",
          minHeight: 18,
          fontSize: 12,
          fontWeight: 600,
          color: saveColor,
          marginBottom: 6,
        }}
      >
        {saveLabel}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <AddInput placeholder="Nouvel atelier (nom + Entrée)" onAdd={addAtelier} />
      </div>

      {tree.map((a) => (
        <div key={a.id} className="card section" style={{ opacity: a.actif ? 1 : 0.55 }}>
          {/* Atelier */}
          <div className="toolbar" style={{ alignItems: "center" }}>
            <input
              value={a.nom}
              onChange={(e) => renameAtelier(a.id, e.target.value)}
              style={{ fontSize: 16, fontWeight: 700, width: 260 }}
            />
            <ToggleSwitch on={a.actif} onChange={(v) => toggleAtelier(a.id, v)} title="Activer / désactiver l'atelier" />
          </div>

          {/* Lignes */}
          {a.ligne.map((l) => (
            <div key={l.id} className="section" style={{ marginLeft: 16, borderLeft: "2px solid #eee", paddingLeft: 16, opacity: l.actif ? 1 : 0.6 }}>
              <div className="toolbar" style={{ alignItems: "center" }}>
                <input
                  value={l.nom}
                  onChange={(e) => renameLigne(a.id, l.id, e.target.value)}
                  style={{ fontWeight: 600, width: 220 }}
                />
                <label style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--muted)" }} title="N° d'affichage de la ligne sur les TV / PDF (croissant)">
                  N° aff.
                  <input
                    type="number"
                    min={0}
                    value={num(l.ordre_affichage)}
                    onChange={(e) => ligneOrdre(a.id, l.id, Number(e.target.value))}
                    style={{ width: 60 }}
                  />
                </label>
                <ToggleSwitch on={l.actif} onChange={(v) => toggleLigne(a.id, l.id, v)} title="Activer / désactiver la ligne" />
              </div>

              {/* Postes */}
              <table style={{ width: "auto" }}>
                <thead>
                  <tr>
                    <th>Poste</th>
                    <th>Code</th>
                    <th>Effectif</th>
                    <th>Catégorie</th>
                    <th>Diff.</th>
                    <th>Niv. min</th>
                    <th title="N° d'affichage du poste sur les TV / PDF (croissant)">N° aff.</th>
                    {quarts.map((q) => (
                      <th key={q.code} title={`Tourne en ${q.libelle}`} style={{ fontSize: 11 }}>
                        {q.libelle.slice(0, 4)}
                      </th>
                    ))}
                    <th>Actif</th>
                  </tr>
                </thead>
                <tbody>
                  {l.poste.map((p) => (
                    <tr key={p.id} style={{ opacity: p.actif ? 1 : 0.5 }}>
                      <td>
                        <input value={p.nom} onChange={(e) => posteField(a.id, l.id, p.id, "nom", e.target.value)} style={{ width: 170 }} />
                      </td>
                      <td>
                        <input
                          value={p.nom_court ?? ""}
                          maxLength={6}
                          onChange={(e) => posteField(a.id, l.id, p.id, "nom_court", e.target.value)}
                          style={{ width: 80 }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          value={num(p.effectif_requis)}
                          onChange={(e) => posteField(a.id, l.id, p.id, "effectif_requis", Number(e.target.value))}
                          style={{ width: 64 }}
                        />
                      </td>
                      <td>
                        <select
                          value={p.categorie ?? "operateur"}
                          onChange={(e) => posteField(a.id, l.id, p.id, "categorie", e.target.value)}
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          value={p.difficulte_formation?.toString() ?? ""}
                          onChange={(e) => posteField(a.id, l.id, p.id, "difficulte_formation", e.target.value === "" ? null : Number(e.target.value))}
                        >
                          <option value="">-</option>
                          <option value="1">1</option>
                          <option value="2">2</option>
                          <option value="3">3</option>
                        </select>
                      </td>
                      <td>
                        <select
                          value={p.niveau_min_requis.toString()}
                          onChange={(e) => posteField(a.id, l.id, p.id, "niveau_min_requis", Number(e.target.value))}
                        >
                          {[0, 1, 2, 3, 4].map((n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          value={num(p.ordre_affichage)}
                          onChange={(e) => posteField(a.id, l.id, p.id, "ordre_affichage", Number(e.target.value))}
                          style={{ width: 60 }}
                        />
                      </td>
                      {quarts.map((q) => (
                        <td key={q.code} style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={quartOn(p.id, q.code)}
                            onChange={(e) => toggleQuart(p.id, q.code, e.target.checked)}
                            style={{ width: "auto" }}
                            title={`${p.nom} tourne en ${q.libelle}`}
                          />
                        </td>
                      ))}
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={p.actif}
                          onChange={(e) => togglePoste(a.id, l.id, p.id, e.target.checked)}
                          style={{ width: "auto" }}
                        />
                      </td>
                    </tr>
                  ))}
                  {l.poste.length === 0 && (
                    <tr>
                      <td colSpan={8 + quarts.length} className="muted">Aucun poste.</td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div style={{ marginTop: 6 }}>
                <AddInput placeholder="Nouveau poste (nom + Entrée)" onAdd={(v) => addPoste(a.id, l.id, v)} width={200} />
              </div>
            </div>
          ))}

          {/* Ajout ligne */}
          <div style={{ marginTop: 10, marginLeft: 16 }}>
            <AddInput placeholder="Nouvelle ligne (nom + Entrée)" onAdd={(v) => addLigne(a.id, v)} width={200} />
          </div>
        </div>
      ))}

      {tree.length === 0 && <p className="muted">Aucun atelier. Ajoutez-en un ci-dessus.</p>}
    </div>
  );
}
