"use client";

import Link from "next/link";
import Logo from "@/components/Logo";

// Barre d'actions de l'ecran TV : impression PDF et retour a l'application.
// Masquee a l'impression (`noprint`).
//
// Impression : UNE page A3 verticale. Comme au Placement, aucune regle CSS ne
// sait « faire rentrer » un contenu — on mesure, puis on met a l'echelle.
// A3 portrait a 96 dpi : 297 x 420 mm, moins les marges de 8 mm du @page,
// soit 281 x 404 mm = 1062 x 1527 px utiles.
const PAGE_L = 1060;
const PAGE_H = 1525;
// Plusieurs largeurs d'essai : une feuille plus etroite que la page autorise un
// AGRANDISSEMENT (le tableau d'une semaine est bien plus large que haut, il se
// tasserait en haut d'une A3 verticale) ; une plus large permet de reduire.
const LARGEURS_ESSAI = [700, 820, 940, 1060, 1300, 1600, 1900];
const ECHELLE_MAX = 1.6;

// Gabarit commun aux deux commandes : le bouton porte une bordure, le logo n'en
// a pas — sans taille imposee, ils ne tombaient pas d'aplomb.
const TAILLE = 42;

export default function AffichageBarre({ cadreId, contenuId }: { cadreId: string; contenuId: string }) {
  function imprimer() {
    const el = document.getElementById(contenuId);
    if (!el) {
      window.print();
      return;
    }
    const largeur0 = el.style.width;
    const transform0 = el.style.transform;

    el.style.transformOrigin = "top left";
    el.style.transform = "none";
    let meilleur = { f: 0, w: PAGE_L };
    for (const w of LARGEURS_ESSAI) {
      el.style.width = `${w}px`;
      const f = Math.min(ECHELLE_MAX, PAGE_L / w, PAGE_H / el.scrollHeight);
      if (f > meilleur.f) meilleur = { f, w };
    }
    el.style.width = `${meilleur.w}px`;
    el.style.transform = `scale(${meilleur.f})`;

    window.print();

    // window.print() bloque jusqu'a la fermeture de la boite : on peut rendre
    // l'ecran a son etat normal juste apres (c'est un ecran TV, il reste affiche).
    el.style.width = largeur0;
    el.style.transform = transform0;
  }

  return (
    <>
      {/* Regles d'impression propres a cet ecran. Le @page global est en A4
          paysage ; declare ici APRES, celui-ci l'emporte pour cette page. Le
          cadre est borne a une page exactement, sinon la feuille elargie avant
          reduction sortirait de la zone imprimable. */}
      <style>{`
        @media print {
          @page { size: A3 portrait; margin: 8mm; }
          #${cadreId} { width: ${PAGE_L}px; height: ${PAGE_H}px; overflow: hidden; padding: 0 !important; }
        }
      `}</style>

      <div className="noprint" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          type="button"
          onClick={imprimer}
          title="Imprimer / enregistrer en PDF (A3 vertical, une page)"
          aria-label="Imprimer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            // Meme gabarit que le logo Polaris a cote.
            width: TAILLE,
            height: TAILLE,
            padding: 0,
            margin: 0,
            // Fond clair : la couleur doit etre posee explicitement, le style
            // global des boutons impose du blanc (cf. CLAUDE.md).
            background: "#fff",
            color: "#1d4ed8",
            border: "1px solid var(--border)",
            borderRadius: 9,
            cursor: "pointer",
          }}
        >
          {/* Imprimante : capot, corps, feuille qui sort. */}
          <svg viewBox="0 0 24 24" width={Math.round(TAILLE * 0.62)} height={Math.round(TAILLE * 0.62)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 9V3h10v6" />
            <path d="M7 18H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
            <rect x="7" y="15" width="10" height="6" rx="1" />
          </svg>
        </button>

        <Link
          href="/"
          title="Revenir à Polaris"
          aria-label="Revenir à l'application"
          style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}
        >
          <Logo size={TAILLE} id="affichage" />
        </Link>
      </div>
    </>
  );
}
