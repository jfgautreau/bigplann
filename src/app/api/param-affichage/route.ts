import { NextResponse, type NextRequest } from "next/server";
import { moduleWriteGuard } from "@/lib/permissions";
import { getCurrentSite } from "@/lib/current-site";

// POST /api/param-affichage { jours_avant, jours_apres }
// Petit endpoint dédié à l'auto-save du bloc « Fenêtre d'affichage » de Param RH.
// La table `parametre_affichage` est sous RLS `is_admin()` — on passe par la
// garde de module qui rend un client admin quand l'appelant a le droit `motifs`.
// PK = site_id depuis la migration 0051.
export async function POST(req: NextRequest) {
  const garde = await moduleWriteGuard("motifs");
  if (!garde.ok) return NextResponse.json({ error: garde.error }, { status: garde.status });

  const site = await getCurrentSite();
  const body = (await req.json().catch(() => null)) as { jours_avant?: number; jours_apres?: number } | null;
  const avant = Math.max(0, Math.min(14, Number(body?.jours_avant ?? 1)));
  const apres = Math.max(0, Math.min(30, Number(body?.jours_apres ?? 4)));

  const { error } = await garde.supabase
    .from("parametre_affichage")
    .upsert(
      { site_id: site.id, jours_avant: avant, jours_apres: apres, updated_at: new Date().toISOString() },
      { onConflict: "site_id" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}
