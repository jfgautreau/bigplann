import { getServerClient } from "@/lib/supabase-server";
import AppHeader from "@/components/AppHeader";
import PageTitle from "@/components/PageTitle";
import { requireModule, canWritePlacementData } from "@/lib/permissions";
import { fetchAll } from "@/lib/fetch-all";
import { quartParDefaut, quartOuDefaut, memeQuart } from "@/lib/quarts";
import { isoDate, mondayOf } from "@/lib/week";
import { getRotationRefsC } from "@/lib/refdata";
import { rotationForWeek, equipesParQuart } from "@/lib/rotation";
import { addMonthsIso } from "@/lib/habilitations";
import PlacementBoard from "./PlacementBoard";

type Atelier = { id: string; nom: string };
type Equipe = { id: string; nom: string; couleur: string | null; quart_fixe?: string | null };
type Quart = { code: string; libelle: string; ordre: number };
type Personne = { id: string; nom: string; prenom: string; equipe_id: string | null; atelier_id: string | null; type_contrat: string };
type PosteRow = { id: string; nom: string; nom_court: string | null; actif: boolean; effectif_requis: number; niveau_min_requis: number; ordre_affichage: number; numero_rotation: string | null };
type LigneRow = { id: string; nom: string; ordre_affichage: number; atelier_id: string; poste: PosteRow[] };
type Placement = { personne_id: string; poste_id: string | null; motif_absence_id: string | null; non_travaille: boolean; quart_code: string | null; numero_rotation: string | null };
type MatRow = { personne_id: string; poste_id: string; niveau_actuel: number };
type Motif = { id: string; code_court: string; libelle: string; couleur: string };
type PcrRow = { poste_id: string; competence_id: string; competence: { nom: string; duree_validite_mois: number | null } | null };
type PcDetRow = { personne_id: string; competence_id: string; date_obtention: string | null; date_expiration: string | null };

const ordreThenNom = <T extends { ordre_affichage?: number; nom: string }>(a: T, b: T) =>
  (a.ordre_affichage ?? 0) - (b.ordre_affichage ?? 0) || a.nom.localeCompare(b.nom);

export default async function PlacementPage({
  searchParams,
}: {
  searchParams: Promise<{ atelier?: string; date?: string; quart?: string; vue?: string }>;
}) {
  const { profile } = await requireModule("placement", "write");
  const sp = await searchParams;

  const supabase = await getServerClient();
  const jour = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : isoDate(new Date());

  const [{ data: ateliersD }, { data: equipesD }, { data: quartsD }, { data: persD }, { data: motifsD }] = await Promise.all([
    supabase.from("atelier").select("id, nom").eq("actif", true).order("nom").returns<Atelier[]>(),
    supabase.from("equipe").select("id, nom, couleur, quart_fixe").eq("actif", true).order("nom").returns<Equipe[]>(),
    supabase.from("quart").select("code, libelle, ordre").order("ordre").returns<Quart[]>(),
    supabase.from("personne").select("id, nom, prenom, equipe_id, atelier_id, type_contrat").eq("statut", "ACTIF").order("nom").returns<Personne[]>(),
    supabase.from("motif_absence").select("id, code_court, libelle, couleur").eq("actif", true).order("libelle").returns<Motif[]>(),
  ]);

  const ateliers = ateliersD ?? [];
  const equipes = equipesD ?? [];
  const quarts = quartsD ?? [];
  const quartCodes = quarts.map((q) => q.code);
  const personnes = persD ?? [];
  const motifs = motifsD ?? [];

  const quart = sp.quart && quartCodes.includes(sp.quart) ? sp.quart : quartParDefaut(quarts);
  // Bascule Plan / Absences portee par ?vue : l'atelier reste selectionne dans les
  // deux cas, c'est lui qui filtre les absences affichees.
  const vueAbsences = sp.vue === "absences";
  const atelierId = ateliers.find((a) => a.id === sp.atelier)?.id ?? ateliers[0]?.id ?? "";

  // Postes de l'atelier + desactivations poste x quart + placements du jour + matrice.
  const [{ data: lignesD }, { data: pqOffD }, { data: plD }, mat] = await Promise.all([
    atelierId
      ? supabase
          .from("ligne")
          .select("id, nom, ordre_affichage, atelier_id, poste(id, nom, nom_court, actif, effectif_requis, niveau_min_requis, ordre_affichage, numero_rotation)")
          .eq("atelier_id", atelierId)
          .eq("actif", true)
          .order("nom")
          .returns<LigneRow[]>()
      : Promise.resolve({ data: [] as LigneRow[] }),
    supabase.from("poste_quart").select("poste_id, quart_code").eq("actif", false).returns<{ poste_id: string; quart_code: string }[]>(),
    supabase.from("placement").select("personne_id, poste_id, motif_absence_id, non_travaille, quart_code, numero_rotation").eq("jour", jour).returns<Placement[]>(),
    (async () => {
      const posteIds = ((await supabase
        .from("ligne")
        .select("poste(id)")
        .eq("atelier_id", atelierId)
        .returns<{ poste: { id: string }[] }[]>()).data ?? []).flatMap((l) => l.poste.map((p) => p.id));
      if (!posteIds.length) return [] as MatRow[];
      return fetchAll<MatRow>(() =>
        supabase.from("matrice").select("personne_id, poste_id, niveau_actuel").in("poste_id", posteIds).order("id").returns<MatRow[]>()
      );
    })(),
  ]);

  // Ouverture des lignes decidee dans l'Ordonnancement, pour ce jour et ce quart.
  // Memes regles que le Planning (cf. src/app/planning/page.tsx) : un quart sans
  // ligne dans `jour_quart` est FERME (rien n'est ouvert tant que la semaine n'a pas
  // ete initialisee) ; une ligne sans ligne dans `ouverture_quart` est ouverte.
  // Pas de fetchAll ici, contrairement au Planning et a l'affichage TV : la
  // lecture porte sur UN jour et UN quart, elle est donc bornee au nombre de
  // lignes de production (une vingtaine). Il faudrait 1000 lignes pour atteindre
  // le plafond PostgREST. Si cette requete est un jour elargie a une semaine,
  // il faudra la passer par fetchAll (cf. L8).
  const [{ data: ouvD }, { data: jqD }] = await Promise.all([
    supabase
      .from("ouverture_quart")
      .select("ligne_id, ouverte")
      .eq("quart_code", quart)
      .eq("jour", jour)
      .returns<{ ligne_id: string; ouverte: boolean }[]>(),
    supabase
      .from("jour_quart")
      .select("actif")
      .eq("quart_code", quart)
      .eq("jour", jour)
      .maybeSingle<{ actif: boolean }>(),
  ]);
  const quartOuvert = jqD?.actif === true;
  const ouvMap = new Map((ouvD ?? []).map((r) => [r.ligne_id, r.ouverte]));
  const ligneOuverte = (id: string) => quartOuvert && (ouvMap.get(id) ?? true);

  // Postes ouverts pour ce quart (poste actif + non desactive sur le quart), groupes par ligne.
  const pqOff = new Set((pqOffD ?? []).map((r) => `${r.poste_id}:${r.quart_code}`));
  const groups = (lignesD ?? [])
    .filter((l) => ligneOuverte(l.id)) // ligne fermee dans l'Ordonnancement -> pas de plan
    .map((l) => ({
      ligneId: l.id,
      ligneNom: l.nom,
      ligneOrdre: l.ordre_affichage ?? 0,
      postes: [...(l.poste ?? [])]
        .filter((p) => p.actif && !pqOff.has(`${p.id}:${quart}`))
        .sort(ordreThenNom)
        .map((p) => ({
          id: p.id,
          nom: p.nom,
          nomCourt: p.nom_court,
          effectifRequis: p.effectif_requis,
          niveauMin: p.niveau_min_requis,
          numeroRotation: p.numero_rotation,
        })),
    }))
    .filter((g) => g.postes.length > 0)
    .sort((a, b) => a.ligneOrdre - b.ligneOrdre || a.ligneNom.localeCompare(b.ligneNom));

  // Habilitations exigees par les postes affiches, et celles que les gens detiennent.
  // Le manque est recalcule a l'affichage : un placement force redevient normal des
  // que l'habilitation est regularisee, et repasse en rouge si elle expire.
  const posteIdsAffiches = groups.flatMap((g) => g.postes.map((p) => p.id));
  const { data: pcrD } = posteIdsAffiches.length
    ? await supabase
        .from("poste_competence_requise")
        .select("poste_id, competence_id, competence:competence_id(nom, duree_validite_mois)")
        .in("poste_id", posteIdsAffiches)
        .returns<PcrRow[]>()
    : { data: [] as PcrRow[] };

  const habPoste: Record<string, string[]> = {};
  const habComp: Record<string, string> = {};
  const dureeComp: Record<string, number | null> = {};
  for (const r of pcrD ?? []) {
    (habPoste[r.poste_id] ??= []).push(r.competence_id);
    habComp[r.competence_id] = r.competence?.nom ?? "habilitation";
    dureeComp[r.competence_id] = r.competence?.duree_validite_mois ?? null;
  }

  // Echeance effective par (personne, habilitation requise) : "" = valable sans
  // echeance, sinon la date. Cle absente = habilitation non detenue.
  const compRequisesIds = Object.keys(habComp);
  const habPers: Record<string, string> = {};
  if (compRequisesIds.length) {
    const det = await fetchAll<PcDetRow>(() =>
      supabase
        .from("personne_competence")
        .select("personne_id, competence_id, date_obtention, date_expiration")
        .in("competence_id", compRequisesIds)
        .order("id")
        .returns<PcDetRow[]>()
    );
    for (const d of det)
      habPers[`${d.personne_id}:${d.competence_id}`] =
        d.date_expiration ?? addMonthsIso(d.date_obtention, dureeComp[d.competence_id]) ?? "";
  }

  // Etat initial des placements (pour ce jour / quart) + personnes deja sur un autre quart.
  const placeInit: Record<string, string> = {};
  const autreQuart: Record<string, string> = {};
  const numeroInit: Record<string, string> = {};
  for (const r of plD ?? []) {
    if (r.non_travaille) placeInit[r.personne_id] = "X";
    else if (r.motif_absence_id) placeInit[r.personne_id] = `m:${r.motif_absence_id}`;
    else if (r.poste_id && memeQuart(r.quart_code, quart, quarts)) {
      placeInit[r.personne_id] = r.poste_id;
      if (r.numero_rotation) numeroInit[r.personne_id] = r.numero_rotation;
    } else if (r.poste_id) autreQuart[r.personne_id] = quartOuDefaut(r.quart_code, quarts);
  }

  // Niveau de competence par (personne, poste) pour l'aide au placement.
  const matrice: Record<string, number> = {};
  for (const r of mat) matrice[`${r.personne_id}:${r.poste_id}`] = r.niveau_actuel;

  // Perimetre d'edition : ecriture complete (admin/ordo) -> tout ; chef -> son equipe.
  // Doit coller a ce qu'acceptent les API (cf. canWritePlacementData), sinon la
  // grille se croirait editable la ou l'enregistrement echouerait.
  const fullWrite = await canWritePlacementData(profile.role);
  const chefTeams = new Set<string>();
  if (!fullWrite) {
    const { data: ct } = await supabase.from("equipe_chef").select("equipe_id").eq("app_user_id", profile.authId).returns<{ equipe_id: string }[]>();
    for (const r of ct ?? []) chefTeams.add(r.equipe_id);
  }
  const persos = personnes.map((p) => ({
    id: p.id,
    nom: p.nom,
    prenom: p.prenom,
    equipe_id: p.equipe_id,
    atelier_id: p.atelier_id,
    type_contrat: p.type_contrat,
    couleur: equipes.find((e) => e.id === p.equipe_id)?.couleur ?? null,
    editable: fullWrite || (p.equipe_id ? chefTeams.has(p.equipe_id) : false),
  }));

  const quartLib: Record<string, string> = {};
  for (const q of quarts) quartLib[q.code] = q.libelle;

  // Équipes qui travaillent chaque quart ce jour-là : celles dont le quart est
  // FIXE, plus celle que la rotation datée y place cette semaine (A ou B).
  // Le filtre du panneau des noms s'appuie dessus — choisir « Matin » doit
  // remonter « Fixe matin » ET l'équipe qui tourne au matin, pas une seule des
  // deux comme le faisait l'ancien pré-filtre.
  const rotWeek = rotationForWeek(await getRotationRefsC(), isoDate(mondayOf(new Date(jour + "T00:00"))));
  const parQuart = equipesParQuart(equipes, rotWeek);

  return (
    <div className="pagecol">
      <AppHeader role={profile.role} active="/placement" />
      <PlacementBoard
        key={`${atelierId}|${jour}|${quart}`}
        vueAbsences={vueAbsences}
        numeroInit={numeroInit}
        title={<PageTitle module="placement" style={{ fontSize: 20 }}>Placement</PageTitle>}
        jour={jour}
        quart={quart}
        atelierId={atelierId}
        ateliers={ateliers}
        equipes={equipes}
        quarts={quarts}
        quartLib={quartLib}
        groups={groups}
        personnes={persos}
        placeInit={placeInit}
        autreQuart={autreQuart}
        matrice={matrice}
        motifs={motifs.map((m) => ({ id: m.id, code: m.code_court, libelle: m.libelle, couleur: m.couleur }))}
        equipesParQuart={parQuart}
        habPoste={habPoste}
        habComp={habComp}
        habPers={habPers}
        quartOuvert={quartOuvert}
      />
    </div>
  );
}

export const dynamic = "force-dynamic";
