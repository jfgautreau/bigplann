// Bandeau d'erreur des ecrans de parametrage. Les server actions n'ont pas de
// canal de retour : elles se terminent par un `redirect()`. Elles repassent donc
// le message dans l'URL (`?err=`), que la page rend ici.
//
// Volontairement discret et non bloquant : l'erreur porte sur une saisie, pas
// sur le chargement de l'ecran.
export default function BandeauErreur({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      style={{
        margin: "0 0 16px",
        padding: "10px 14px",
        borderRadius: 8,
        background: "#fef2f2",
        color: "#991b1b",
        border: "1px solid #fecaca",
        fontWeight: 600,
        fontSize: 14,
      }}
    >
      {message}
    </div>
  );
}
