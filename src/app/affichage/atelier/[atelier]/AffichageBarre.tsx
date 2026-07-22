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
          aria-label="Imprimer en PDF"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 40,
            height: 40,
            padding: 0,
            margin: 0,
            // Fond clair : la couleur doit etre posee explicitement, le style
            // global des boutons impose du blanc (cf. CLAUDE.md).
            background: "#fff",
            color: "#b91c1c",
            border: "1px solid var(--border)",
            borderRadius: 9,
            cursor: "pointer",
          }}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path
              d="M6 2h8l4 4v16H6z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
            <path d="M14 2v4h4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
            <text x="12" y="17.5" textAnchor="middle" fill="currentColor" fontSize="6.5" fontWeight="700" fontFamily="Arial, Helvetica, sans-serif">
              PDF
            </text>
          </svg>
        </button>

        <Link
          href="/"
          title="Revenir à Polaris"
          aria-label="Revenir à l'application"
          style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}
        >
          <Logo size={40} id="affichage" />
        </Link>
      </div>
    </>
  );
}
