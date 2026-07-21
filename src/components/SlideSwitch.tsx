"use client";

// Interrupteur a glissiere a deux positions, pour BASCULER ENTRE DEUX VUES
// (Plan / Absences, Actuel / Cible) — a ne pas confondre avec ToggleSwitch, qui
// dit actif / inactif en vert et rouge.
//
// La largeur est FIXE et les deux moities sont egales : c'est ce qui garantit que
// la pastille recouvre exactement le libelle actif. Avec une largeur dictee par le
// contenu, le libelle le plus long prend plus de place que l'autre et la pastille,
// a 50 %, ne tombe plus en face.
export default function SlideSwitch({
  on,
  onChange,
  offLabel,
  onLabel,
  offColor = "#4f46e5",
  onColor = "#4f46e5",
  width = 168,
  title,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  offLabel: string;
  onLabel: string;
  offColor?: string;
  onColor?: string;
  width?: number;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      title={title}
      onClick={() => onChange(!on)}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "stretch",
        flex: "0 0 auto",
        alignSelf: "flex-start", // les bandeaux sont des colonnes flex : pas d'etirement
        width,
        height: 30,
        margin: 0,
        padding: 0,
        border: "1px solid var(--border)",
        borderRadius: 999,
        background: "#eef2f7",
        cursor: "pointer",
        overflow: "hidden",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 3,
          bottom: 3,
          width: "calc(50% - 3px)",
          left: on ? "auto" : 3,
          right: on ? 3 : "auto",
          borderRadius: 999,
          background: on ? onColor : offColor,
          transition: "left .18s ease, right .18s ease, background .18s ease",
        }}
      />
      {[offLabel, onLabel].map((lib, i) => {
        const actif = i === (on ? 1 : 0);
        return (
          <span
            key={lib}
            style={{
              position: "relative",
              zIndex: 1,
              flex: "1 1 0",
              minWidth: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
              whiteSpace: "nowrap",
              color: actif ? "#fff" : "#64748b",
              transition: "color .18s ease",
            }}
          >
            {lib}
          </span>
        );
      })}
    </button>
  );
}
