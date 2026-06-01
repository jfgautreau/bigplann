"use client";

import { useRouter } from "next/navigation";

type Opt = { id: string; label: string };

export default function MatriceFilters({
  ateliers,
  equipes,
  atelier,
  equipe,
}: {
  ateliers: Opt[];
  equipes: Opt[];
  atelier: string;
  equipe: string;
}) {
  const router = useRouter();

  function go(next: { atelier?: string; equipe?: string }) {
    const a = next.atelier ?? atelier;
    const e = next.equipe ?? equipe;
    const params = new URLSearchParams();
    if (a) params.set("atelier", a);
    if (e) params.set("equipe", e);
    const qs = params.toString();
    router.push(qs ? `/matrice?${qs}` : "/matrice");
  }

  return (
    <div className="toolbar">
      <div className="field">
        <span>Atelier</span>
        <select value={atelier} onChange={(e) => go({ atelier: e.target.value })}>
          <option value="">Tous les ateliers</option>
          {ateliers.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <span>Equipe</span>
        <select value={equipe} onChange={(e) => go({ equipe: e.target.value })}>
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
