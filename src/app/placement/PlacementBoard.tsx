"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { isoDate, addDays } from "@/lib/week";
import s from "./placement.module.css";

type Atelier = { id: string; nom: string };
type Equipe = { id: string; nom: string; couleur: string | null };
type Quart = { code: string; libelle: string };
type Poste = { id: string; nom: string; nomCourt: string | null; effectifRequis: number; niveauMin: number };
type Group = { ligneId: string; ligneNom: string; postes: Poste[] };
type Personne = { id: string; nom: string; prenom: string; equipe_id: string | null; atelier_id: string | null; couleur: string | null; editable: boolean };
type Motif = { id: string; code: string; libelle: string; couleur: string };

const norm = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
// Affichage compact : NOM P.
const label = (p: { nom: string; prenom: string }) => (p.prenom ? `${p.nom} ${p.prenom.charAt(0).toUpperCase()}.` : p.nom);
const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const jourLabel = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${JOURS[(dt.getDay() + 6) % 7]} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
};

export default function PlacementBoard({
  title,
  jour,
  quart,
  atelierId,
  ateliers,
  equipes,
  quarts,
  quartLib,
  groups,
  personnes,
  placeInit,
  autreQuart: autreQuartInit,
  matrice,
  motifs,
  defaultEquipeId = "",
}: {
  title?: ReactNode;
  jour: string;
  quart: string;
  atelierId: string;
  ateliers: Atelier[];
  equipes: Equipe[];
  quarts: Quart[];
  quartLib: Record<string, string>;
  groups: Group[];
  personnes: Personne[];
  placeInit: Record<string, string>;
  autreQuart: Record<string, string>;
  matrice: Record<string, number>;
  motifs: Motif[];
  defaultEquipeId?: string;
}) {
  const router = useRouter();
  const [place, setPlace] = useState<Record<string, string>>(placeInit);
  const [autreQuart, setAutreQuart] = useState<Record<string, string>>(autreQuartInit);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // Pre-filtre : par defaut l'equipe qui tourne ce quart ce jour (elargissable).
  const [fEquipe, setFEquipe] = useState(defaultEquipeId);
  // Pre-filtre atelier : celui du plan affiche (elargissable pour aller chercher un renfort).
  const [fAtelier, setFAtelier] = useState(atelierId);
  const [hidePlaced, setHidePlaced] = useState(false);
  const [copying, setCopying] = useState(false);
  const [drag, setDrag] = useState<string | null>(null); // personne en cours de glissement
  const [sel, setSel] = useState<string | null>(null); // mode clic : personne selectionnee
  const [over, setOver] = useState<string | null>(null); // cible de depot survolee

  const persById = useMemo(() => new Map(personnes.map((p) => [p.id, p])), [personnes]);
  const posteNom = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of groups) for (const po of g.postes) m.set(po.id, po.nom);
    return m;
  }, [groups]);
  const motifById = useMemo(() => new Map(motifs.map((mo) => [mo.id, mo])), [motifs]);

  const go = (patch: Partial<{ atelier: string; date: string; quart: string }>) =>
    router.push(`/placement?atelier=${patch.atelier ?? atelierId}&date=${patch.date ?? jour}&quart=${patch.quart ?? quart}`);

  // Personne "active" (glissee ou selectionnee) -> aide a la competence sur les postes.
  const active = drag ?? sel;
  const niveau = (persId: string, posteId: string) => matrice[`${persId}:${posteId}`] ?? 0;
  const compState = (persId: string, po: Poste): "ok" | "restrict" | "low" => {
    const n = niveau(persId, po.id);
    if (n === -1) return "restrict";
    return n >= po.niveauMin ? "ok" : "low";
  };

  const occupants = (posteId: string) => personnes.filter((p) => place[p.id] === posteId);

  async function post(persId: string, value: string) {
    const p = persById.get(persId);
    const res = await fetch("/api/placement/cell", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personne_id: persId, jour, equipe_id: p?.equipe_id ?? null, value, quart }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error ?? "Échec de l'enregistrement.");
    }
  }

  const flash = (m: string) => {
    setMsg(m);
    setSaving("error");
    setTimeout(() => {
      setMsg(null);
      setSaving("idle");
    }, 3000);
  };

  async function assign(persId: string, value: string) {
    const p = persById.get(persId);
    if (!p?.editable) {
      flash("Vous ne pouvez pas modifier cette personne (hors de votre équipe).");
      return;
    }
    const prev = place[persId] ?? "";
    const prevAutre = autreQuart[persId];
    setPlace((s2) => ({ ...s2, [persId]: value }));
    setSaving("saving");
    setMsg(null);
    try {
      const isPoste = value !== "" && value !== "X" && !value.startsWith("m:");
      // Deja sur un autre quart : on la libere d'abord avant de la poser sur ce quart.
      if (prevAutre && isPoste) await post(persId, "");
      await post(persId, value);
      setAutreQuart((a) => {
        const n = { ...a };
        delete n[persId];
        return n;
      });
      setSaving("saved");
      setTimeout(() => setSaving("idle"), 1000);
    } catch (e) {
      setPlace((s2) => ({ ...s2, [persId]: prev })); // rollback
      setSaving("error");
      setMsg(e instanceof Error ? e.message : "Échec.");
      setTimeout(() => {
        setSaving("idle");
        setMsg(null);
      }, 3500);
    }
  }

  // Copier les affectations poste d'un autre jour (meme quart) vers ce jour.
  async function copyFrom(deltaDays: number) {
    const src = isoDate(addDays(new Date(jour + "T00:00"), deltaDays));
    setCopying(true);
    setSaving("saving");
    setMsg(null);
    try {
      const res = await fetch("/api/placement/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: src, cible: jour, quart }),
      });
      const j = (await res.json().catch(() => ({}))) as { rows?: { personne_id: string; poste_id: string }[]; copied?: number; error?: string };
      if (!res.ok) throw new Error(j.error ?? "Échec de la copie.");
      setPlace((p) => {
        const n = { ...p };
        for (const r of j.rows ?? []) n[r.personne_id] = r.poste_id;
        return n;
      });
      setAutreQuart((a) => {
        const n = { ...a };
        for (const r of j.rows ?? []) delete n[r.personne_id];
        return n;
      });
      setSaving("saved");
      setMsg(`${j.copied ?? 0} affectation(s) copiée(s).`);
      setTimeout(() => {
        setSaving("idle");
        setMsg(null);
      }, 2500);
    } catch (e) {
      setSaving("error");
      setMsg(e instanceof Error ? e.message : "Échec.");
      setTimeout(() => {
        setSaving("idle");
        setMsg(null);
      }, 3000);
    } finally {
      setCopying(false);
    }
  }

  // Couverture des postes (positions couvertes / requises, postes complets).
  const coverage = useMemo(() => {
    let req = 0;
    let cov = 0;
    let complets = 0;
    let total = 0;
    for (const g of groups)
      for (const po of g.postes) {
        total++;
        req += po.effectifRequis;
        const n = personnes.filter((p) => place[p.id] === po.id).length;
        cov += Math.min(n, po.effectifRequis);
        if (po.effectifRequis > 0 && n >= po.effectifRequis) complets++;
      }
    return { req, cov, complets, total };
  }, [groups, personnes, place]);

  // Clic (secours tactile / accessibilite) : selectionner un nom puis cliquer une cible.
  function clickName(persId: string) {
    const p = persById.get(persId);
    if (!p?.editable) return;
    setSel((c) => (c === persId ? null : persId));
  }
  function clickTarget(value: string) {
    if (!sel) return;
    assign(sel, value);
    setSel(null);
  }

  // --- Drag & drop natif ---
  const onDragStartName = (persId: string) => (e: React.DragEvent) => {
    const p = persById.get(persId);
    if (!p?.editable) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("text/plain", persId);
    e.dataTransfer.effectAllowed = "move";
    setDrag(persId);
  };
  const onDrop = (value: string, key: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const persId = e.dataTransfer.getData("text/plain") || drag;
    setOver(null);
    setDrag(null);
    if (persId) assign(persId, value);
    void key;
  };
  const overProps = (key: string, value: string) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      if (over !== key) setOver(key);
    },
    onDragLeave: () => setOver((o) => (o === key ? null : o)),
    onDrop: onDrop(value, key),
  });

  const isAbsent = (persId: string) => {
    const v = place[persId];
    return v === "X" || (!!v && v.startsWith("m:"));
  };
  const inScope = (p: Personne) => (!fEquipe || p.equipe_id === fEquipe) && (!fAtelier || p.atelier_id === fAtelier);

  // Liste des noms filtree + regroupee : a placer -> absents -> sur poste -> autre quart.
  const shown = useMemo(() => {
    const q = norm(search.trim());
    const list = personnes.filter((p) => {
      if (fEquipe && p.equipe_id !== fEquipe) return false;
      if (fAtelier && p.atelier_id !== fAtelier) return false;
      if (q && !norm(`${p.nom} ${p.prenom}`).includes(q)) return false;
      if (hidePlaced && (place[p.id] || autreQuart[p.id])) return false;
      return true;
    });
    const rank = (p: Personne) => {
      const v = place[p.id];
      if (v && v !== "X" && !v.startsWith("m:")) return 2; // sur poste
      if (v === "X" || v?.startsWith("m:")) return 1; // absent
      if (autreQuart[p.id]) return 3; // autre quart
      return 0; // a placer
    };
    return [...list].sort((a, b) => rank(a) - rank(b) || `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`));
  }, [personnes, search, fEquipe, fAtelier, place, autreQuart, hidePlaced]);

  const nbAplacer = personnes.filter((p) => inScope(p) && !place[p.id] && !autreQuart[p.id]).length;
  const nbAbsents = personnes.filter((p) => inScope(p) && isAbsent(p.id)).length;

  const statutOf = (p: Personne): { txt: string; color: string } => {
    const v = place[p.id];
    if (v && v !== "X" && !v.startsWith("m:")) return { txt: `→ ${posteNom.get(v) ?? "poste"}`, color: "#0d9488" };
    if (v?.startsWith("m:")) return { txt: motifById.get(v.slice(2))?.code ?? "absent", color: "#b45309" };
    if (v === "X") return { txt: "Non travaillé", color: "#6b7280" };
    if (autreQuart[p.id]) return { txt: `sur ${quartLib[autreQuart[p.id]] ?? autreQuart[p.id]}`, color: "#9ca3af" };
    return { txt: "à placer", color: "#dc2626" };
  };

  const saveTxt = saving === "saving" ? "Enregistrement…" : saving === "saved" ? "Enregistré ✓" : saving === "error" ? "Échec" : "";
  const saveColor = saving === "error" ? "var(--danger)" : saving === "saved" ? "var(--ok)" : "var(--muted)";

  return (
    <div className={s.board}>
      {/* Filtres */}
      <div className={s.filters}>
        {title && <div style={{ alignSelf: "center", marginRight: 4 }}>{title}</div>}
        <div className={s.fitem}>
          <span>Atelier</span>
          <div className="segments">
            {ateliers.map((a) => (
              <button key={a.id} type="button" className={atelierId === a.id ? "seg active" : "seg"} onClick={() => go({ atelier: a.id })}>
                {a.nom}
              </button>
            ))}
          </div>
        </div>
        <div className={s.fitem}>
          <span>Jour</span>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button type="button" className={s.navbtn} onClick={() => go({ date: isoDate(addDays(new Date(jour + "T00:00"), -1)) })}>◀</button>
            <input type="date" value={jour} onChange={(e) => e.target.value && go({ date: e.target.value })} />
            <button type="button" className={s.navbtn} onClick={() => go({ date: isoDate(addDays(new Date(jour + "T00:00"), 1)) })}>▶</button>
          </div>
        </div>
        <div className={s.fitem}>
          <span>Quart</span>
          <div className="segments">
            {quarts.map((qq) => (
              <button key={qq.code} type="button" className={quart === qq.code ? "seg active" : "seg"} onClick={() => go({ quart: qq.code })}>
                {qq.libelle}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <span title="Positions couvertes / requises · postes complets" style={{ fontSize: 13 }}>
            <strong style={{ color: coverage.cov >= coverage.req ? "var(--ok)" : "#b91c1c" }}>{coverage.cov}/{coverage.req}</strong>{" "}
            <span className="muted">postes {coverage.complets}/{coverage.total}</span>
          </span>
          <span style={{ display: "flex", gap: 6 }}>
            <button type="button" className={s.navbtn} disabled={copying} onClick={() => copyFrom(-1)} title="Copier les postes de la veille (même quart)">Copier J‑1</button>
            <button type="button" className={s.navbtn} disabled={copying} onClick={() => copyFrom(-7)} title="Copier le même jour de la semaine dernière">Copier S‑1</button>
          </span>
          <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            <input type="checkbox" checked={hidePlaced} onChange={(e) => setHidePlaced(e.target.checked)} style={{ width: "auto" }} />
            Masquer les placés
          </label>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{jourLabel(jour)}</span>
          <span style={{ fontSize: 12, fontWeight: 700, minWidth: 90, textAlign: "right", color: saveColor }}>{msg ?? saveTxt}</span>
        </div>
      </div>

      {/* Corps : plan (gauche) + noms (droite) */}
      <div className={s.body}>
        <div className={s.plan}>
          {groups.length === 0 ? (
            <p className="muted" style={{ padding: 12 }}>Aucun poste ouvert pour ce quart dans cet atelier.</p>
          ) : (
            groups.map((g) => (
              <div key={g.ligneId} className={s.ligne}>
                <div className={s.ligneNom}>{g.ligneNom}</div>
                <div className={s.postes}>
                  {g.postes.map((po) => {
                    const occ = occupants(po.id);
                    const complet = occ.length >= po.effectifRequis && po.effectifRequis > 0;
                    const manque = occ.length < po.effectifRequis;
                    const cs = active ? compState(active, po) : null;
                    const isOver = over === `po:${po.id}`;
                    return (
                      <div
                        key={po.id}
                        className={`${s.poste} ${cs ? s[cs] : ""} ${isOver ? s.over : ""}`}
                        {...overProps(`po:${po.id}`, po.id)}
                        onClick={() => clickTarget(po.id)}
                        title={active ? `${cs === "ok" ? "Compétent" : cs === "restrict" ? "Restriction !" : "Compétence insuffisante"} · niv. ${niveau(active, po.id)} / min ${po.niveauMin}` : po.nom}
                      >
                        <div className={s.posteHead}>
                          <span className={s.posteNom}>{po.nom}</span>
                          <span className={s.eff} style={{ color: complet ? "var(--ok)" : manque ? "#b91c1c" : "var(--muted)" }}>
                            {occ.length}/{po.effectifRequis}
                          </span>
                        </div>
                        <div className={s.occ}>
                          {occ.map((p) => (
                            <span
                              key={p.id}
                              className={s.chip}
                              draggable={p.editable}
                              onDragStart={onDragStartName(p.id)}
                              onDragEnd={() => setDrag(null)}
                              onClick={(e) => { e.stopPropagation(); clickName(p.id); }}
                              style={{ borderColor: p.couleur ?? "#cbd5e1", outline: sel === p.id ? "2px solid #4f46e5" : undefined }}
                              title={`${p.nom} ${p.prenom}`}
                            >
                              <span className={s.dot} style={{ background: p.couleur ?? "#e5e7eb" }} />
                              {label(p)}
                            </span>
                          ))}
                          {occ.length === 0 && <span className={s.emptyHint}>déposer ici</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Colonne des noms (drop = retirer du poste) */}
        <div className={s.names} {...overProps("names", "")}>
          <div className={s.namesHead}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Rechercher un nom" className={s.search} />
            <div className={s.namesFilters}>
              <select value={fEquipe} onChange={(e) => setFEquipe(e.target.value)}>
                <option value="">Toutes équipes</option>
                {equipes.map((e) => (
                  <option key={e.id} value={e.id}>{e.nom}</option>
                ))}
              </select>
              <select value={fAtelier} onChange={(e) => setFAtelier(e.target.value)}>
                <option value="">Tous ateliers</option>
                {ateliers.map((a) => (
                  <option key={a.id} value={a.id}>{a.nom}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className={s.aPlacer}>{nbAplacer} à placer</span>
              {nbAbsents > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: "#b45309" }}>{nbAbsents} absent(s)</span>}
            </div>
          </div>
          <div className={s.namesList}>
            {shown.map((p) => {
              const st = statutOf(p);
              const placed = !!place[p.id] || !!autreQuart[p.id];
              return (
                <div
                  key={p.id}
                  className={`${s.nameItem} ${!p.editable ? s.locked : ""} ${placed ? s.placed : ""} ${sel === p.id ? s.selName : ""}`}
                  draggable={p.editable}
                  onDragStart={onDragStartName(p.id)}
                  onDragEnd={() => setDrag(null)}
                  onClick={() => clickName(p.id)}
                >
                  <span className={s.dot} style={{ background: p.couleur ?? "#e5e7eb" }} />
                  <span className={s.nm} title={`${p.nom} ${p.prenom}`}>{label(p)}</span>
                  <span className={s.stat} style={{ color: st.color }}>{st.txt}</span>
                  {p.editable && place[p.id] && (
                    <button
                      type="button"
                      className={s.unassign}
                      title="Désaffecter (retirer du poste / de l'absence)"
                      onClick={(e) => { e.stopPropagation(); assign(p.id, ""); }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
            {shown.length === 0 && <p className="muted" style={{ padding: 10 }}>Aucun nom.</p>}
          </div>
        </div>
      </div>

      {/* Bas : absences + non travaille (zones de depot) */}
      <div className={s.bottom}>
        <span className={s.bottomLabel}>Glisser vers :</span>
        {motifs.map((mo) => {
          const isOver = over === `m:${mo.id}`;
          return (
            <button
              key={mo.id}
              type="button"
              className={`${s.motif} ${isOver ? s.over : ""}`}
              style={{ borderColor: mo.couleur }}
              {...overProps(`m:${mo.id}`, `m:${mo.id}`)}
              onClick={() => clickTarget(`m:${mo.id}`)}
              title={mo.libelle}
            >
              <span className={s.dot} style={{ background: mo.couleur }} />
              {mo.code}
            </button>
          );
        })}
        <button type="button" className={`${s.motif} ${over === "X" ? s.over : ""}`} {...overProps("X", "X")} onClick={() => clickTarget("X")} title="Jour non travaillé">
          Non travaillé
        </button>
        {sel && (
          <span className={s.selHint}>
            {(() => { const p = persById.get(sel); return p ? label(p) : ""; })()} sélectionné — cliquez un poste ou une absence
            <button type="button" className={s.cancelSel} onClick={() => setSel(null)}>annuler</button>
          </span>
        )}
      </div>
    </div>
  );
}
