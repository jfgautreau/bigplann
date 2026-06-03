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
    <div className="toolbar">
      <div className="field">
        <span>Equipe</span>
        <select value={equipe} onChange={(e) => go(e.target.value)}>
          <option value="">Toutes les equipes</option>
          {equipes.map((e2) => (
            <option key={e2.id} value={e2.id}>
              {e2.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
