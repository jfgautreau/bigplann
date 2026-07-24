"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Modale positionnée par-dessus la page et DÉPLAÇABLE : on saisit la barre de
// titre (`.mdd-drag`) et on glisse pour reposer la carte ailleurs, exactement
// comme une fenêtre. Utile quand on veut consulter le contenu masqué derrière
// (planning, liste, matrice) sans fermer la modale.
//
// La carte reste positionnée par la souris ; l'overlay ferme au clic hors carte
// comme les modales classiques.
export default function ModaleDeplacable({
  onClose,
  largeur,
  children,
  fondCarte = true,
  zIndex = 100,
}: {
  onClose: () => void;
  /** Largeur max de la carte (px). Défaut : 640. */
  largeur?: number;
  /** Contenu — DOIT inclure un élément .mdd-drag pour la poignée. */
  children: ReactNode;
  /** Si false, on n'entoure pas d'une `.card` (le contenu fournit sa carte). */
  fondCarte?: boolean;
  zIndex?: number;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ ox: number; oy: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function move(e: MouseEvent) {
      if (!drag.current) return;
      setPos({ x: e.clientX - drag.current.ox, y: e.clientY - drag.current.oy });
    }
    function up() { drag.current = null; document.body.style.userSelect = ""; }
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    // Ne déclenche que sur un élément portant la classe `.mdd-drag`.
    const cible = e.target as HTMLElement;
    if (!cible.closest(".mdd-drag")) return;
    if ((e.target as HTMLElement).closest("button, input, select, textarea, a")) return;
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    drag.current = { ox: e.clientX - rect.left, oy: e.clientY - rect.top };
    if (!pos) setPos({ x: rect.left, y: rect.top });
    document.body.style.userSelect = "none";
  };

  const stylePos: React.CSSProperties = pos
    ? { position: "absolute", left: pos.x, top: pos.y, transform: "none", margin: 0 }
    : {};

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        zIndex,
        display: pos ? "block" : "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        ref={cardRef}
        className={fondCarte ? "card" : undefined}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={onMouseDown}
        style={{
          maxWidth: largeur ?? 640,
          width: "100%",
          maxHeight: "90vh",
          overflow: "auto",
          ...stylePos,
        }}
      >
        {children}
      </div>
    </div>
  );
}
