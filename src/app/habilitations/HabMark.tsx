import { HAB_COLOR, type HabStatut } from "@/lib/habilitations";

// Pastille d'habilitation, calee sur la pastille de niveau de la matrice
// (meme diametre, meme contour) : un cercle vide signifie « rien » dans les
// deux ecrans.
export default function HabMark({ statut }: { statut: HabStatut | "aucun" }) {
  const size = 28,
    r = 11,
    cx = 14,
    cy = 14;
  const fill = statut === "aucun" ? "#fff" : HAB_COLOR[statut];
  return (
    <svg width={size} height={size} style={{ display: "block" }} aria-hidden="true">
      <circle cx={cx} cy={cy} r={r} fill={fill} stroke="#64748b" strokeWidth={1.5} />
    </svg>
  );
}
