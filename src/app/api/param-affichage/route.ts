import { NextResponse, type NextRequest } from "next/server";
import { moduleWriteGuard } from "@/lib/permissions";

// POST /api/param-affichage { jours_avant, jours_apres }
// Petit endpoint dédié à l'auto-save du bloc « Fenêtre d'affichage » de Param RH.
// La table `parametre_affichage` est sous RLS `is_admin()` — on passe par la
// garde de module qui rend un client admin quand l'appelant a le droit `motifs`.
export async function POST(req: NextRequest) {
  const garde = await moduleWriteGuard("motifs");
  if (!garde.ok) return NextResponse.json({ error: garde.error }, { status: garde.status });

  const body = (await req.json().catch(() => null)) as { jours_avant?: number; jours_apres?: number } | null;
  const avant = Math.max(0, Math.min(14, Number(body?.jours_avant ?? 1)));
  const apres = Math.max(0, Math.min(30, Number(body?.jours_apres ?? 4)));

  const { error } = await garde.supabase
    .from("parametre_affichage")
    .upsert(
      { id: 1, jours_avant: avant, jours_apres: apres, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}
