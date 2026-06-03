"use client";

import { useRouter } from "next/navigation";

type Quart = { code: string; libelle: string };

export default function QuartSelector({
  quarts,
  current,
  equipe,
  semaine,
}: {
  quarts: Quart[];
  current: string;
  equipe: string;
  semaine: string;
}) {
  const router = useRouter();
  function go(code: string) {
    const p = new URLSearchParams();
    if (equipe) p.set("equipe", equipe);
    if (semaine) p.set("semaine", semaine);
    p.set("quart", code);
    router.push(`/planning?${p.toString()}`);
  }
  return (
    <div className="toolbar" style={{ alignItems: "center" }}>
      <span className="muted">Quart :</span>
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
