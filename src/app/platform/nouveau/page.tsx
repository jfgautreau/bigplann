import Link from "next/link";
import { createSite } from "../actions";

export const dynamic = "force-dynamic";

export default async function NouveauSitePage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const sp = await searchParams;

  return (
    <div style={{ maxWidth: 560 }}>
      <Link href="/platform" style={{ color: "#64748b", textDecoration: "none", fontSize: 13 }}>← Retour à la liste</Link>
      <h1 style={{ margin: "8px 0 20px", fontSize: 22 }}>Nouveau site</h1>

      {sp.err && (
        <div style={{ background: "#fee2e2", color: "#991b1b", padding: "10px 14px", borderRadius: 6, marginBottom: 16, fontSize: 14 }}>
          {sp.err}
        </div>
      )}

      <form action={createSite} style={{ display: "flex", flexDirection: "column", gap: 12, background: "#fff", padding: 20, borderRadius: 8 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>Nom du site</span>
          <input name="nom" required placeholder="Usine XY" style={inp} />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>
            Slug <span style={{ fontWeight: 400, color: "#64748b" }}>(lettres/chiffres/tirets, ex. « usine-xy »)</span>
          </span>
          <input name="slug" required placeholder="usine-xy" pattern="^[a-z][a-z0-9-]{1,30}[a-z0-9]$" style={inp} />
        </label>

        <hr style={{ border: 0, borderTop: "1px solid #e2e8f0", margin: "8px 0" }} />

        <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
          Premier compte admin local du site :
        </p>

        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>Nom complet</span>
          <input name="nom_admin" required placeholder="Prénom Nom" style={inp} />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>Email</span>
          <input name="email_admin" type="email" required placeholder="admin@usine.fr" style={inp} />
        </label>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <Link href="/platform" style={{ padding: "8px 14px", color: "#334155", textDecoration: "none" }}>Annuler</Link>
          <button type="submit" style={{ background: "#2563eb", color: "#fff", padding: "8px 16px", border: 0, borderRadius: 6, fontWeight: 600, cursor: "pointer" }}>
            Créer le site
          </button>
        </div>
      </form>

      <p style={{ marginTop: 16, fontSize: 12, color: "#94a3b8" }}>
        Un lien de définition de mot de passe pour l&apos;admin sera généré et affiché sur la
        page de détail du site créé. À transmettre par le canal de votre choix (le SMTP
        n&apos;étant pas garanti, aucun mail n&apos;est envoyé).
      </p>
    </div>
  );
}

const inp: React.CSSProperties = {
  padding: "8px 10px",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontSize: 14,
};
