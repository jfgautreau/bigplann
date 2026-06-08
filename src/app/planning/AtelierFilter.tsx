"use client";

import { useRouter } from "next/navigation";

type Opt = { id: string; label: string };

export default function AtelierFilter({
  ateliers = [],
  atelier = "",
  equipe = "",
  quart = "",
  semaine = "",
}: {
  ateliers?: Opt[];
  atelier?: string;
  equipe?: string;
  quart?: string;
  semaine?: string;
}) {
  const router = useRouter();

  function go(at: string) {
    const p = new URLSearchParams();
    if (equipe) p.set("equipe", equipe);
    if (at) p.set("atelier", at);
    if (semaine) p.set("semaine", semaine);
    if (quart) p.set("quart", quart);
    const qs = p.toString();
    router.push(qs ? `/planning?${qs}` : "/planning");
  }

  if (ateliers.length === 0) return null;

  return (
    <div className="toolbar" style={{ alignItems: "center" }}>
      <span className="muted">Atelier :</span>
      <div className="segments">
        <button type="button" className={atelier === "" ? "seg active" : "seg"} onClick={() => go("")}>
          Tous
        </button>
        {ateliers.map((a) => (
          <button
            key={a.id}
            type="button"
            className={atelier === a.id ? "seg active" : "seg"}
            onClick={() => go(a.id)}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
