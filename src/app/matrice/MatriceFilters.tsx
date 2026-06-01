"use client";

import { useRouter } from "next/navigation";

type Opt = { id: string; label: string };

export default function MatriceFilters({
  lignes,
  equipes,
  ligne,
  equipe,
}: {
  lignes: Opt[];
  equipes: Opt[];
  ligne: string;
  equipe: string;
}) {
  const router = useRouter();

  function go(next: { ligne?: string; equipe?: string }) {
    const l = next.ligne ?? ligne;
    const e = next.equipe ?? equipe;
    const params = new URLSearchParams();
    if (l) params.set("ligne", l);
    if (e) params.set("equipe", e);
    router.push(`/matrice?${params.toString()}`);
  }

  return (
    <div className="toolbar">
      <div className="field">
        <span>Ligne</span>
        <select value={ligne} onChange={(e) => go({ ligne: e.target.value })}>
          <option value="">Choisir une ligne...</option>
          {lignes.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <span>Equipe</span>
        <select value={equipe} onChange={(e) => go({ equipe: e.target.value })}>
          <option value="">Toutes</option>
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
