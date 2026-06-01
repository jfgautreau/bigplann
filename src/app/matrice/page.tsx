import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import AppHeader from "@/components/AppHeader";
import MatriceFilters from "./MatriceFilters";
import MatrixGrid from "./MatrixGrid";

type Ligne = { id: string; nom: string; atelier: { nom: string } | null };
type Poste = { id: string; nom: string };
type Personne = { id: string; nom: string; prenom: string; equipe_id: string | null };
type MatriceRow = {
  personne_id: string;
  poste_id: string;
  niveau_actuel: number;
  niveau_cible: number;
};
type Equipe = { id: string; nom: string };

export default async function MatricePage({
  searchParams,
}: {
  searchParams: Promise<{ ligne?: string; equipe?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const sp = await searchParams;
  const supabase = await getServerClient();

  const [{ data: lignesData }, { data: equipesData }] = await Promise.all([
    supabase
      .from("ligne")
      .select("id, nom, atelier:atelier_id(nom)")
      .eq("actif", true)
      .order("nom")
      .returns<Ligne[]>(),
    supabase.from("equipe").select("id, nom").eq("actif", true).order("nom").returns<Equipe[]>(),
  ]);
  const lignes = lignesData ?? [];
  const equipes = equipesData ?? [];

  // Perimetre d'edition
  const isAdmin = profile.role === "admin";
  let chefEquipes = new Set<string>();
  if (!isAdmin) {
    const { data } = await supabase
      .from("equipe_chef")
      .select("equipe_id")
      .eq("app_user_id", profile.authId)
      .returns<{ equipe_id: string }[]>();
    chefEquipes = new Set((data ?? []).map((r) => r.equipe_id));
  }

  let postes: Poste[] = [];
  let personnes: Personne[] = [];
  const initial: Record<string, { a: number; c: number }> = {};

  if (sp.ligne) {
    const [{ data: postesData }, personnesRes] = await Promise.all([
      supabase
        .from("poste")
        .select("id, nom")
        .eq("ligne_id", sp.ligne)
        .eq("actif", true)
        .order("nom")
        .returns<Poste[]>(),
      (async () => {
        let q = supabase
          .from("personne")
          .select("id, nom, prenom, equipe_id")
          .eq("statut", "ACTIF")
          .order("nom");
        if (sp.equipe) q = q.eq("equipe_id", sp.equipe);
        return q.returns<Personne[]>();
      })(),
    ]);
    postes = postesData ?? [];
    personnes = personnesRes.data ?? [];

    if (postes.length && personnes.length) {
      const { data: m } = await supabase
        .from("matrice")
        .select("personne_id, poste_id, niveau_actuel, niveau_cible")
        .in("personne_id", personnes.map((p) => p.id))
        .in("poste_id", postes.map((p) => p.id))
        .returns<MatriceRow[]>();
      for (const r of m ?? []) {
        initial[`${r.personne_id}:${r.poste_id}`] = {
          a: r.niveau_actuel,
          c: r.niveau_cible,
        };
      }
    }
  }

  const gridPersonnes = personnes.map((p) => ({
    id: p.id,
    label: `${p.nom} ${p.prenom}`,
    editable: isAdmin || (p.equipe_id != null && chefEquipes.has(p.equipe_id)),
  }));

  return (
    <>
      <AppHeader role={profile.role} active="/matrice" />
      <div className="container">
        <div className="toolbar">
          <h1 style={{ margin: 0 }}>Matrice de polyvalence</h1>
          <Link href="/matrice/bilan" className="navlink">
            Voir le bilan &rarr;
          </Link>
        </div>

        <MatriceFilters
          lignes={lignes.map((l) => ({
            id: l.id,
            label: l.atelier?.nom ? `${l.atelier.nom} / ${l.nom}` : l.nom,
          }))}
          equipes={equipes.map((e) => ({ id: e.id, label: e.nom }))}
          ligne={sp.ligne ?? ""}
          equipe={sp.equipe ?? ""}
        />

        {!sp.ligne && (
          <p className="muted">Choisissez une ligne pour afficher ses postes.</p>
        )}
        {sp.ligne && postes.length === 0 && (
          <p className="muted">Aucun poste actif sur cette ligne.</p>
        )}

        {sp.ligne && postes.length > 0 && (
          <MatrixGrid postes={postes} personnes={gridPersonnes} initial={initial} />
        )}
      </div>
    </>
  );
}
