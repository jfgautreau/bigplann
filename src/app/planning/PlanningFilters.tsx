"use client";

import { useRouter } from "next/navigation";

type Opt = { id: string; label: string };

export default function PlanningFilters({
  equipes = [],
  equipe = "",
  semaine = "",
  quart = "",
}: {
  equipes?: Opt[];
  equipe?: string;
  semaine?: string;
  quart?: string;
}) {
  const router = useRouter();

  function go(eq: string) {
    const p = new URLSearchParams();
    if (eq) p.set("equipe", eq);
    if (semaine) p.set("semaine", semaine);
    if (quart) p.set("quart", quart);
    const qs = p.toString();
    router.push(qs ? `/planning?${qs}` : "/planning");
  }

  return (
    <div className="toolbar" style={{ alignItems: "center" }}>
      <span className="muted">Equipe :</span>
      <div className="segments">
        <button type="button" className={equipe === "" ? "seg active" : "seg"} onClick={() => go("")}>
          Toutes
        </button>
        {equipes.map((e) => (
          <button
            key={e.id}
            type="button"
            className={equipe === e.id ? "seg active" : "seg"}
            onClick={() => go(e.id)}
          >
            {e.label}
          </button>
        ))}
      </div>
    </div>
  );
}
