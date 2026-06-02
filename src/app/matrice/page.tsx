import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase-server";
import { getCurrentProfile } from "@/lib/current-user";
import AppHeader from "@/components/AppHeader";
import MatriceFilters from "./MatriceFilters";
import MatrixGrid from "./MatrixGrid";

type PosteRow = { id: string; nom: string; actif: boolean; objectif_polyvalence: number };
type LigneRow = { id: string; nom: string; atelier_id: string; poste: PosteRow[] };
type Atelier = { id: string; nom: string };
type Equipe = { id: string; nom: string };
type Personne = { id: string; nom: string; prenom: string; equipe_id: string | null };
type MatriceRow = {
  personne_id: string;
  poste_id: string;
  niveau_actuel: number;
  niveau_cible: number;
};

export default async function MatricePage({
  searchParams,
}: {
  searchParams: Promise<{ atelier?: string; equipe?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const sp = await searchParams;
  const supabase = await getServerClient();

  // Filtres
  const [{ data: ateliersData }, { data: equipesData }] = await Promise.all([
    supabase.from("atelier").select("id, nom").eq("actif", true).order("nom").returns<Atelier[]>(),
    supabase.from("equipe").select("id, nom").eq("actif", true).order("nom").returns<Equipe[]>(),
  ]);
  const ateliers = ateliersData ?? [];
  const equipes = equipesData ?? [];

  // Lignes (+ postes) eventuellement filtrees par atelier
  let ligneQ = supabase
    .from("ligne")
    .select("id, nom, atelier_id, poste(id, nom, actif, objectif_polyvalence)")
    .eq("actif", true)
    .order("nom");
  if (sp.atelier) ligneQ = ligneQ.eq("atelier_id", sp.atelier);
  const { data: lignesData } = await ligneQ.returns<LigneRow[]>();

  const groups = (lignesData ?? [])
    .map((l) => ({
      ligneId: l.id,
      ligneNom: l.nom,
      postes: [...(l.poste ?? [])]
        .filter((p) => p.actif)
        .sort((a, b) => a.nom.localeCompare(b.nom))
        .map((p) => ({ id: p.id, nom: p.nom, objectif: p.objectif_polyvalence ?? 0 })),
    }))
    .filter((g) => g.postes.length > 0);

  const posteIds = groups.flatMap((g) => g.postes.map((p) => p.id));

  // Personnes (filtre equipe)
  let persQ = supabase
    .from("personne")
    .select("id, nom, prenom, equipe_id")
    .eq("statut", "ACTIF")
    .order("nom");
  if (sp.equipe) persQ = persQ.eq("equipe_id", sp.equipe);
  const { data: persData } = await persQ.returns<Personne[]>();
  const personnes = persData ?? [];

  // Niveaux existants
  const initial: Record<string, { a: number; c: number }> = {};
  if (posteIds.length && personnes.length) {
    const { data: m } = await supabase
      .from("matrice")
      .select("personne_id, poste_id, niveau_actuel, niveau_cible")
      .in("personne_id", personnes.map((p) => p.id))
      .in("poste_id", posteIds)
      .returns<MatriceRow[]>();
    for (const r of m ?? []) {
      initial[`${r.personne_id}:${r.poste_id}`] = { a: r.niveau_actuel, c: r.niveau_cible };
    }
  }

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

  const gridPersonnes = personnes.map((p) => ({
    id: p.id,
    label: `${p.nom} ${p.prenom}`,
    editable: isAdmin || (p.equipe_id != null && chefEquipes.has(p.equipe_id)),
  }));

  return (
    <>
      <AppHeader role={profile.role} active="/matrice" />
      <div className="container" style={{ maxWidth: 1200 }}>
        <div className="toolbar">
          <h1 style={{ margin: 0 }}>Matrice de polyvalence</h1>
          <Link href="/matrice/bilan" className="navlink">
            Voir le bilan &rarr;
          </Link>
        </div>

        <MatriceFilters
          ateliers={ateliers.map((a) => ({ id: a.id, label: a.nom }))}
          equipes={equipes.map((e) => ({ id: e.id, label: e.nom }))}
          atelier={sp.atelier ?? ""}
          equipe={sp.equipe ?? ""}
        />

        {groups.length === 0 ? (
          <p className="muted">Aucun poste actif (verifiez le referentiel / le filtre atelier).</p>
        ) : (
          <MatrixGrid
            groups={groups}
            personnes={gridPersonnes}
            initial={initial}
            canEditObjectif={isAdmin}
          />
        )}
      </div>
    </>
  );
}
