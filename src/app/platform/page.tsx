import Link from "next/link";
import { getAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type SiteRow = {
  id: string;
  slug: string;
  nom: string;
  statut: "actif" | "suspendu" | "archive";
  cree_le: string;
};

// Liste des sites de la plateforme, avec compteurs (utilisateurs actifs et
// personnes) rapides. On utilise getAdminClient() (service_role) : le
// super_admin doit voir TOUS les sites, la RLS de `site` ne l'autorise qu'à
// voir le sien depuis une session normale.
export default async function PlatformIndex() {
  const admin = getAdminClient();

  const { data: sites } = await admin
    .from("site")
    .select("id, slug, nom, statut, cree_le")
    .order("cree_le", { ascending: false })
    .returns<SiteRow[]>();

  // Compteurs par site : on fait 2 lectures agrégées plutôt que N requêtes.
  const { data: users } = await admin
    .from("app_user")
    .select("site_id, is_active")
    .returns<{ site_id: string; is_active: boolean }[]>();
  const { data: pers } = await admin
    .from("personne")
    .select("site_id, statut")
    .returns<{ site_id: string; statut: string }[]>();

  const nbUsers = new Map<string, number>();
  const nbPersonnes = new Map<string, number>();
  for (const u of users ?? []) {
    if (u.is_active) nbUsers.set(u.site_id, (nbUsers.get(u.site_id) ?? 0) + 1);
  }
  for (const p of pers ?? []) {
    if (p.statut === "ACTIF") nbPersonnes.set(p.site_id, (nbPersonnes.get(p.site_id) ?? 0) + 1);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Sites de la plateforme</h1>
        <Link
          href="/platform/nouveau"
          style={{
            background: "#2563eb",
            color: "#fff",
            padding: "8px 14px",
            borderRadius: 6,
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          + Nouveau site
        </Link>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
        <thead style={{ background: "#f1f5f9" }}>
          <tr>
            <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 12, textTransform: "uppercase", color: "#64748b" }}>Site</th>
            <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 12, textTransform: "uppercase", color: "#64748b" }}>Slug</th>
            <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 12, textTransform: "uppercase", color: "#64748b" }}>Statut</th>
            <th style={{ textAlign: "right", padding: "10px 14px", fontSize: 12, textTransform: "uppercase", color: "#64748b" }}>Utilisateurs</th>
            <th style={{ textAlign: "right", padding: "10px 14px", fontSize: 12, textTransform: "uppercase", color: "#64748b" }}>Personnes</th>
            <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 12, textTransform: "uppercase", color: "#64748b" }}>Créé le</th>
            <th style={{ padding: "10px 14px" }}></th>
          </tr>
        </thead>
        <tbody>
          {(sites ?? []).map((s) => (
            <tr key={s.id} style={{ borderTop: "1px solid #e2e8f0" }}>
              <td style={{ padding: "10px 14px", fontWeight: 600 }}>{s.nom}</td>
              <td style={{ padding: "10px 14px", fontFamily: "monospace", color: "#475569" }}>{s.slug}</td>
              <td style={{ padding: "10px 14px" }}>
                <span style={{
                  padding: "2px 8px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  background: s.statut === "actif" ? "#dcfce7" : s.statut === "suspendu" ? "#fef3c7" : "#e2e8f0",
                  color: s.statut === "actif" ? "#166534" : s.statut === "suspendu" ? "#92400e" : "#475569",
                }}>
                  {s.statut}
                </span>
              </td>
              <td style={{ padding: "10px 14px", textAlign: "right" }}>{nbUsers.get(s.id) ?? 0}</td>
              <td style={{ padding: "10px 14px", textAlign: "right" }}>{nbPersonnes.get(s.id) ?? 0}</td>
              <td style={{ padding: "10px 14px", fontSize: 13, color: "#64748b" }}>
                {new Date(s.cree_le).toLocaleDateString("fr-FR")}
              </td>
              <td style={{ padding: "10px 14px", textAlign: "right" }}>
                <Link href={`/platform/${s.id}`} style={{ color: "#2563eb", textDecoration: "none" }}>Détail →</Link>
              </td>
            </tr>
          ))}
          {(sites ?? []).length === 0 && (
            <tr>
              <td colSpan={7} style={{ padding: 20, textAlign: "center", color: "#94a3b8" }}>
                Aucun site.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
