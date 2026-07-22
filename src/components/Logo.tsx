// Logo Polaris — l'etoile polaire, celle qui donne le cap.
// Source unique : en-tete, page d'accueil et favicon (src/app/icon.svg) doivent
// rester identiques. Les identifiants de degrade sont suffixes par `id` car
// plusieurs instances peuvent coexister dans la meme page.
export default function Logo({ size = 26, id = "logo" }: { size?: number; id?: string }) {
  const bg = `polaris-bg-${id}`;
  const glow = `polaris-glow-${id}`;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" style={{ display: "block" }}>
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#172554" />
          <stop offset="0.55" stopColor="#1d4ed8" />
          <stop offset="1" stopColor="#3b82f6" />
        </linearGradient>
        <radialGradient id={glow} cx="32" cy="31" r="23" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill={`url(#${bg})`} />
      <circle cx="32" cy="31" r="23" fill={`url(#${glow})`} />
      <path
        d="M32 6 C32 23 46 31 53 31 C46 31 32 39 32 56 C32 39 18 31 11 31 C18 31 32 23 32 6 Z"
        fill="#ffffff"
      />
      <circle cx="14" cy="14" r="2" fill="#ffffff" opacity="0.85" />
      <circle cx="51" cy="17" r="1.2" fill="#ffffff" opacity="0.6" />
      <circle cx="49" cy="49" r="1.6" fill="#ffffff" opacity="0.72" />
    </svg>
  );
}
