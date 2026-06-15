import type { Metadata } from "next";
import "./globals.css";

// Co-localiser les fonctions serveur avec Supabase (eu-west-3 / Paris) pour
// reduire la latence des requetes (1 aller-retour par requete).
export const preferredRegion = ["cdg1"];

export const metadata: Metadata = {
  title: "BigPlann'",
  description: "Gestion des plannings d'usine",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
