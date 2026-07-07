import { NavIcon, NAV_COLOR } from "@/components/NavIcons";

// Titre de page aux couleurs du module, avec l'icone du menu devant (pastille
// coloree comme dans l'en-tete). `module` = cle du module (referentiel, personnel,
// matrice, habilitations, ordonnancement, planning, bilans).
export default function PageTitle({
  module,
  children,
  style,
}: {
  module: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const color = NAV_COLOR[module];
  return (
    <h1 style={{ display: "inline-flex", alignItems: "center", gap: 11, color, margin: 0, ...style }}>
      {color && (
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: 9,
            background: color,
            flexShrink: 0,
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.22)",
          }}
        >
          <NavIcon name={module} size={19} />
        </span>
      )}
      {children}
    </h1>
  );
}
