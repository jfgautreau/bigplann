"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

type Quart = { code: string; libelle: string };

export default function QuartSelector({
  quarts,
  current,
  equipe,
  semaine,
  atelier = "",
}: {
  quarts: Quart[];
  current: string;
  equipe: string;
  semaine: string;
  atelier?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function go(code: string) {
    const p = new URLSearchParams();
    if (equipe) p.set("equipe", equipe);
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
