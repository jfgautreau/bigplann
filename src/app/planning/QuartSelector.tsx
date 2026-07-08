"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

type Quart = { code: string; libelle: string };

export default function QuartSelector({
  quarts,
  current,
  semaine,
  atelier = "",
  quartToEquipe = {},
}: {
  quarts: Quart[];
  current: string;
  semaine: string;
  atelier?: string;
  quartToEquipe?: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function go(code: string) {
    const p = new URLSearchParams();
    // Auto-sélection de l'équipe par défaut du quart (rotation de la semaine) ;
    // l'utilisateur peut ensuite forcer une autre équipe via le filtre Équipe.
    const eq = quartToEquipe[code] ?? "";
    if (eq) p.set("equipe", eq);
    if (atelier) p.set("atelier", atelier);
    if (semaine) p.set("semaine", semaine);
    p.set("quart", code);
    start(() => router.push(`/planning?${p.toString()}`));
  }
  return (
    <div className="filterrow" style={{ opacity: pending ? 0.5 : 1, transition: "opacity .1s" }}>
      <span className="lbl">Quart</span>
      <div className="segments">
        {quarts.map((q) => (
          <button
            key={q.code}
            type="button"
            className={q.code === current ? "seg active" : "seg"}
            onClick={() => go(q.code)}
          >
            {q.libelle}
          </button>
        ))}
      </div>
    </div>
  );
}
