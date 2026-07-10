"use client";

import { useRef } from "react";

/**
 * Comportements communs aux grilles « personnes x colonnes » (Matrice,
 * Habilitations) :
 *   - le panneau d'en-tetes suit horizontalement la liste ;
 *   - la colonne survolee est peinte via le fond du `<col>` et une classe sur
 *     son en-tete, ecrits directement dans le DOM. Aucun rendu React, donc
 *     aucun cout sur une grille de plusieurs milliers de cellules.
 *
 * `colHeadRow` = index (1-based) de la rangee de `thead` qui porte les
 * en-tetes de colonne : 2 pour la Matrice (ligne / poste), 3 pour les
 * Habilitations (categorie / groupe / formation).
 */
export function usePersonGrid(colHoverClass: string, colHeadRow: number) {
  const headCardRef = useRef<HTMLDivElement>(null);
  const headTableRef = useRef<HTMLTableElement>(null);
  const rowsTableRef = useRef<HTMLTableElement>(null);
  const hoverCol = useRef(-1);

  function paintCol(index: number, on: boolean) {
    for (const t of [headTableRef.current, rowsTableRef.current]) {
      const col = t?.querySelector("colgroup")?.children[index] as HTMLElement | undefined;
      if (col) col.style.background = on ? "var(--col-hover)" : "";
    }
    const th = headTableRef.current?.querySelectorAll(`thead tr:nth-child(${colHeadRow}) th`)[index - 1];
    th?.classList.toggle(colHoverClass, on);
  }

  function hoverAt(index: number) {
    if (hoverCol.current === index) return;
    if (hoverCol.current > 0) paintCol(hoverCol.current, false);
    hoverCol.current = index;
    if (index > 0) paintCol(index, true);
  }

  // La liste est le seul ascenseur visible ; l'en-tete la suit.
  function syncScroll(e: React.UIEvent<HTMLDivElement>) {
    const head = headCardRef.current;
    if (head) head.scrollLeft = e.currentTarget.scrollLeft;
  }

  // A etaler sur le conteneur scrollable de la liste.
  const rowsCardProps = {
    onScroll: syncScroll,
    onMouseOver: (e: React.MouseEvent) => hoverAt((e.target as HTMLElement).closest("td")?.cellIndex ?? -1),
    onMouseLeave: () => hoverAt(-1),
  };

  return { headCardRef, headTableRef, rowsTableRef, rowsCardProps };
}
