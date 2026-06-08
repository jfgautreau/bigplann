import Link from "next/link";
import { getServerClient } from "@/lib/supabase-server";
import AppHeader from "@/components/AppHeader";
import { requireModule } from "@/lib/permissions";
import { getSemaineType } from "@/lib/semaine-type";
import SemaineTypeEditor from "./SemaineTypeEditor";

type Quart = { code: string; libelle: string };

export default async function SemaineTypePage() {
  const { profile } = await requireModule("ordonnancement", "write");

  const supabase = await getServerClient();
  const [{ data: quartsD }, type] = await Promise.all([
    supabase.from("quart").select("code, libelle").order("ordre").returns<Quart[]>(),
    getSemaineType(supabase),
  ]);

  return (
    <>
      <AppHeader role={profile.role} active="/ordonnancement" />
      <div className="container" style={{ maxWidth: 900 }}>
        <div className="toolbar">
          <h1 style={{ margin: 0 }}>Semaine type</h1>
          <Link href="/ordonnancement" className="navlink">&larr; Ordonnancement</Link>
        </div>
        <p className="muted" style={{ marginTop: -6 }}>
          Configuration du gabarit de quarts qui se charge automatiquement et sert de base à la
          réinitialisation des semaines.
        </p>
        <SemaineTypeEditor quarts={quartsD ?? []} initial={type} />
      </div>
    </>
  );
}
