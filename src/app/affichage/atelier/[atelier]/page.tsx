import Link from "next/link";
import { getAdminClient } from "@/lib/supabase-server";
import { fetchAll } from "@/lib/fetch-all";
import { getQuartsC } from "@/lib/refdata";
import { quartOuDefaut } from "@/lib/quarts";
import { INTERIM_BG } from "@/lib/interim";
import { isoDate, joursAutour, parseJour } from "@/lib/week";
import AutoRefresh from "@/components/AutoRefresh";
import AffichageBarre from "./AffichageBarre";

export const dynamic = "force-dynamic";

type Atelier = { id: string; nom: string };
type Poste = { id: string; nom: string; ordre_affichage: number };
type Ligne = { id: string; nom: string; ordre_affichage: number; poste: (Poste & { actif: boolean })[] };
type PlacementRow = {
  poste_id: string | null;
  jour: string;
  quart_code: string | null;
  personne_id: string;
  personne: { nom: string; prenom: string; type_contrat: string } | null;
};
type HoraireRow = { poste_id: string; quart_code: string; jour: number; debut: string | null; fin: string | null };

const dow = (iso: string) => (new Date(iso + "T00:00").getDay() + 6) % 7;
const isoDow = (iso: string) => {
  const d = new Date(iso + "T00:00").getDay();
  return d === 0 ? 7 : d; // 1=lundi .. 7=dimanche (cle tp_config)
};

export default async function AffichageAtelier({
  params,
  searchParams,
}: {
  params: Promise<{ atelier: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { atelier: param } = await params;
  const sp = await searchParams;
  // Fenetre glissante J-1 -> J+4 (6 jours), et non plus la semaine calendaire :
  // un ecran de couloir sert a savoir ce qui vient, pas a relire le lundi passe.
  // `?date` deplace le pivot (sans recalage sur le lundi).
  const days = joursAutour(parseJour(sp.date), 1, 4);
  const isos = days.map((d) => d.iso);
  const todayIso = isoDate(new Date());

  const admin = getAdminClient();
  // Liste des quarts du parametrage : sert de repli aux placements historiques
  // sans `quart_code` (cf. src/lib/quarts.ts).
  const quarts = await getQuartsC();

  const { data: ateliers } = await admin.from("atelier").select("id, nom").returns<Atelier[]>();
  const decoded = decodeURIComponent(param).toLowerCase();
  const atelier = (ateliers ?? []).find((a) => a.id === param || a.nom.toLowerCase() === decoded);

  if (!atelier) {
    return (
      <div className="container">
        <h1>Atelier introuvable</h1>
        <p className="muted">Vérifiez l&apos;URL (/affichage).</p>
      </div>
    );
  }

  const { data: lignesD } = await admin
    .from("ligne")
    .select("id, nom, ordre_affichage, poste(id, nom, ordre_affichage, actif)")
    .eq("atelier_id", atelier.id)
    .eq("actif", true)
    .returns<Ligne[]>();

  // Ordre d'affichage parametrable (ordre_affichage croissant, puis nom).
  const byOrdre = <T extends { ordre_affichage?: number; nom: string }>(a: T, b: T) =>
    (a.ordre_affichage ?? 0) - (b.ordre_affichage ?? 0) || a.nom.localeCompare(b.nom);
  const lignes = (lignesD ?? [])
    .map((l) => ({
      ...l,
      poste: [...(l.poste ?? [])].filter((p) => p.actif).sort(byOrdre),
    }))
    .filter((l) => l.poste.length > 0)
    .sort(byOrdre);
  const posteIds = lignes.flatMap((l) => l.poste.map((p) => p.id));
  const posteLigne = new Map<string, string>();
  const posteNom = new Map<string, string>();
  for (const l of lignes) for (const p of l.poste) { posteLigne.set(p.id, l.id); posteNom.set(p.id, p.nom); }

  const horMap = new Map<string, { debut: string | null; fin: string | null }>(); // `${poste}:${quart}:${dow}`
  const excMap = new Map<string, { debut: string | null; fin: string | null; motif: string | null }>(); // `${personne}:${iso}` (horaire specifique + commentaire)
  type TpHM = Record<string, { debut: string; fin: string }>;
  type TpCfg = { demi?: { source?: string; matin?: TpHM; aprem?: TpHM }; horaires?: TpHM };
  const tpCfgMap = new Map<string, TpCfg>(); // personne_id -> tp_config (temps partiel)
  const actMap = new Map<string, boolean>(); // `${quart}:${iso}`
  const ouvMap = new Map<string, boolean>(); // `${quart}:${ligne}:${iso}`
  type Personne = { nom: string; prenom: string; type_contrat: string };
  const persons = new Map<string, Personne>(); // personne_id -> infos
  const byPerson = new Map<string, PlacementRow[]>(); // `${personne_id}:${iso}`
  const workedDays = new Set<string>(); // jours (iso) ou au moins une personne travaille
  const openDays = new Set<string>();   // jours (iso) ouverts par l Ordonnancement

  if (posteIds.length) {
    // Trois de ces lectures couvrent une SEMAINE ENTIERE, tous quarts confondus,
    // et peuvent depasser le plafond de 1000 lignes que PostgREST applique SANS
    // erreur (cf. L8). Elles passent donc par fetchAll, avec un `.order()`
    // deterministe — `horaire_poste` et `ouverture_quart` n'ont pas d'`id`, on
    // trie sur leur cle composite. Ecran non surveille : une troncature y
    // afficherait des horaires faux ou des postes manquants sans que personne
    // ne s'en apercoive.
    //   - placement       : 6 jours x personnes placees dans l atelier
    //   - horaire_poste   : postes de l'atelier x 4 quarts x 7 jours
    //   - ouverture_quart : 6 jours x 4 quarts x lignes (NON filtre par atelier)
    // `jour_quart` (28 lignes au plus) et `horaire_exception` restent directs.
    const [pl, hor, { data: jq }, ov, { data: exc }, { data: tpH }] = await Promise.all([
      fetchAll<PlacementRow>(() =>
        admin
          .from("placement")
          .select("poste_id, jour, quart_code, personne_id, personne:personne_id(nom, prenom, type_contrat)")
          .in("jour", isos)
          .in("poste_id", posteIds)
          .order("id")
          .returns<PlacementRow[]>()
      ),
      fetchAll<HoraireRow>(() =>
        admin
          .from("horaire_poste")
          .select("poste_id, quart_code, jour, debut, fin")
          .in("poste_id", posteIds)
          .order("poste_id").order("quart_code").order("jour")
          .returns<HoraireRow[]>()
      ),
      admin
        .from("jour_quart")
        .select("jour, quart_code, actif")
        .in("jour", isos)
        .returns<{ jour: string; quart_code: string; actif: boolean }[]>(),
      fetchAll<{ jour: string; ligne_id: string; quart_code: string; ouverte: boolean }>(() =>
        admin
          .from("ouverture_quart")
          .select("jour, ligne_id, quart_code, ouverte")
          .in("jour", isos)
          .order("jour").order("ligne_id").order("quart_code")
          .returns<{ jour: string; ligne_id: string; quart_code: string; ouverte: boolean }[]>()
      ),
      admin
        .from("horaire_exception")
        .select("personne_id, jour, debut, fin, motif")
        .in("jour", isos)
        .returns<{ personne_id: string; jour: string; debut: string | null; fin: string | null; motif: string | null }[]>(),
      admin
        .from("personne")
        .select("id, tp_config")
        .eq("temps_partiel", true)
        .returns<{ id: string; tp_config: TpCfg | null }[]>(),
    ]);
    for (const h of hor) horMap.set(`${h.poste_id}:${h.quart_code}:${h.jour}`, { debut: h.debut, fin: h.fin });
    for (const e of exc ?? []) excMap.set(`${e.personne_id}:${e.jour}`, { debut: e.debut, fin: e.fin, motif: e.motif });
    for (const r of tpH ?? []) if (r.tp_config) tpCfgMap.set(r.id, r.tp_config);
    for (const r of jq ?? []) actMap.set(`${r.quart_code}:${r.jour}`, r.actif);
    for (const r of ov) ouvMap.set(`${r.quart_code}:${r.ligne_id}:${r.jour}`, r.ouverte);

    // Une cellule est affichee seulement si la ligne est ouverte ce jour-la pour ce
    // quart (coherent avec le planning / l'ordonnancement).
    const isOpen = (ligneId: string, quart: string, iso: string) => {
      const a = actMap.has(`${quart}:${iso}`) ? actMap.get(`${quart}:${iso}`)! : false;
      if (!a) return false;
      const k = `${quart}:${ligneId}:${iso}`;
      return ouvMap.has(k) ? ouvMap.get(k)! : true;
    };

    // Jours OUVERTS au sens de l'Ordonnancement : au moins une ligne de cet
    // atelier ouverte sur au moins un quart. C'est desormais ce qui decide des
    // colonnes affichees — auparavant on ne gardait que les jours ou quelqu'un
    // etait deja PLACE, si bien qu'une journee ouverte mais pas encore remplie
    // disparaissait de l'ecran, au lieu d'apparaitre vide et d'appeler la saisie.
    for (const iso of isos) {
      for (const q of quarts) {
        if (lignes.some((l) => isOpen(l.id, q.code, iso))) {
          openDays.add(iso);
          break;
        }
      }
    }

    for (const r of pl) {
      if (!r.poste_id) continue;
      const qc = quartOuDefaut(r.quart_code, quarts);
      const lid = posteLigne.get(r.poste_id);
      if (lid && !isOpen(lid, qc, r.jour)) continue; // jour/ligne ferme -> on n'affiche pas
      workedDays.add(r.jour);
      if (r.personne) persons.set(r.personne_id, r.personne);
      const pk = `${r.personne_id}:${r.jour}`;
      (byPerson.get(pk) ?? byPerson.set(pk, []).get(pk)!).push(r);
    }
  }

  // Absences (tous motifs) des personnes rattachees a cet atelier -> vue "par nom".
  // On affiche un simple "Absence" (pas de detail du motif). Les jours affiches
  // restent ceux ou au moins une personne travaille (semaine de travail).
  const absByPerson = new Map<string, Set<string>>(); // personne_id -> jours (iso) absents
  {
    type AbsP = { personne_id: string; jour: string; personne: { nom: string; prenom: string; type_contrat: string; atelier_id: string | null } | null };
    // Lecture de TOUT le site (7 jours x toutes les absences), filtree ensuite
    // par atelier en memoire : c'est la requete la plus large de la page, et
    // celle qui atteindra le plafond des 1000 lignes en premier. fetchAll +
    // `.order("id")` la mettent hors de portee de la troncature silencieuse.
    const absPl = await fetchAll<AbsP>(() =>
      admin
        .from("placement")
        .select("personne_id, jour, personne:personne_id(nom, prenom, type_contrat, atelier_id)")
        .in("jour", isos)
        .not("motif_absence_id", "is", null)
        .order("id")
        .returns<AbsP[]>()
    );
    for (const r of absPl) {
      const p = r.personne;
      if (!p || p.atelier_id !== atelier.id) continue; // seulement les gens de cet atelier
      (absByPerson.get(r.personne_id) ?? absByPerson.set(r.personne_id, new Set()).get(r.personne_id)!).add(r.jour);
      if (!persons.has(r.personne_id)) persons.set(r.personne_id, { nom: p.nom, prenom: p.prenom, type_contrat: p.type_contrat });
    }
  }

  const horaireTxt = (personId: string, posteId: string, quartCode: string | null, iso: string) => {
    const q = quartOuDefaut(quartCode, quarts);
    const std = horMap.get(`${posteId}:${q}:${dow(iso)}`);
    const ex = excMap.get(`${personId}:${iso}`);
    // Temps partiel : demi-journee a horaires saisis (selon le quart du placement),
    // sinon horaires "journee entiere". Par jour de semaine (1=lundi..7=dimanche).
    const cfg = tpCfgMap.get(personId);
    let tpHor: { debut?: string; fin?: string } | undefined;
    if (cfg) {
      const d = String(isoDow(iso));
      // ⚠️ Couplage assume : `tp_config` stocke ses demi-journees sous les clefs
      // « matin » / « aprem », qui se trouvent porter les memes noms que deux
      // codes de quart. Ce n'est PAS le meme vocabulaire (un creneau de
      // demi-journee n'est pas un quart), mais la correspondance est ecrite ici
      // en dur. Un site dont les quarts porteraient d'autres codes n'aurait pas
      // d'horaires de temps partiel par demi-journee — repli silencieux, sans
      // casse. A traiter avec le modele de `tp_config`, pas avec les quarts.
      if (cfg.demi?.source === "horaires") {
        if (q === "matin") tpHor = cfg.demi.matin?.[d];
        else if (q === "apres_midi") tpHor = cfg.demi.aprem?.[d];
      }
      if (!tpHor && cfg.horaires) tpHor = cfg.horaires[d];
    }
    // Priorite : exception ponctuelle > horaires TP > horaire standard du poste.
    // ⚠️ La priorite porte sur la SOURCE, pas sur chaque borne prise a part.
    // Resoudre `debut` et `fin` independamment recomposait un horaire qui n'a
    // jamais ete saisi nulle part : une exception renseignee cote debut seul
    // donnait « debut de l'exception – fin du poste ». On choisit la premiere
    // source qui dit quelque chose, puis on lui prend ses deux bornes.
    const renseigne = (h?: { debut?: string | null; fin?: string | null } | null) => !!(h && (h.debut || h.fin));
    const source = renseigne(ex) ? ex : renseigne(tpHor) ? tpHor : std;
    const debut = source?.debut || null;
    const fin = source?.fin || null;
    if (!debut && !fin) return "";
    return `${debut ?? "?"}-${fin ?? "?"}`;
  };

  // Commentaire de l'horaire specifique (saisi dans le planning), affiche sous l'horaire.
  const commentTxt = (personId: string, iso: string) => (excMap.get(`${personId}:${iso}`)?.motif || "").trim();

  // Le jour courant passe du jaune au VERT : le jaune est désormais réservé aux
  // intérimaires, sur tous les écrans (cf. src/lib/interim.ts). Le vert, libéré
  // par l'intérim, sert donc à marquer « aujourd'hui ».
  const AUJOURDHUI = "#86efac"; // vert 300, franc sur le fond blanc de la TV
  const colBg = (iso: string) => (iso === todayIso ? AUJOURDHUI : undefined);
  const cellBorder = "1px solid #d9dce1";

  // Cellule vue "par nom" : sur quel poste cette personne est placee ce jour-la (poste + horaire dessous).
  const cellNom = (personId: string, iso: string) => {
    const rows = byPerson.get(`${personId}:${iso}`) ?? [];
    if (!rows.length) {
      // Aucune affectation poste : si la personne est en absence ce jour-la, on
      // affiche un simple "Absence" (sans detail du motif).
      if (absByPerson.get(personId)?.has(iso)) {
        return <span style={{ color: "#b91c1c" }}>Absence</span>;
      }
      return <span style={{ color: "#cbd5e1" }}>—</span>;
    }
    return rows.map((r, i) => {
      if (!r.poste_id) return null;
      const h = horaireTxt(personId, r.poste_id, r.quart_code, iso);
      const cmt = commentTxt(personId, iso);
      return (
        <div key={i} style={{ lineHeight: 1.2, marginBottom: i < rows.length - 1 ? 6 : 0 }}>
          <div style={{ fontWeight: 600 }}>{posteNom.get(r.poste_id) ?? "?"}</div>
          {h && <div style={{ color: "#1d4ed8", fontSize: 13 }}>{h}</div>}
          {cmt && <div style={{ color: "#6b7280", fontStyle: "italic", fontSize: 12 }}>{cmt}</div>}
        </div>
      );
    });
  };

  const personList = [...persons.entries()]
    .map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => (a.nom + a.prenom).localeCompare(b.nom + b.prenom));

  // Colonnes affichees : les jours OUVERTS par l Ordonnancement, meme si aucune
  // affectation n y figure encore. Une journee ouverte et vide doit se voir.
  const shownDays = days.filter((d) => openDays.has(d.iso));
  const noWork = shownDays.length === 0;

  return (
    // Deux boites imbriquees pour l'impression : `affichage-feuille` est le cadre,
    // borne a UNE page A3 verticale ; `affichage-contenu` porte la mise a l'echelle
    // mesuree par AffichageBarre. A l'ecran, elles sont transparentes.
    <div id="affichage-feuille" style={{ padding: "18px 24px" }}>
      <AutoRefresh seconds={300} />
      <div id="affichage-contenu" style={{ transformOrigin: "top left" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h1 style={{ fontSize: 30, margin: 0 }}>{atelier.nom}</h1>
        <AffichageBarre cadreId="affichage-feuille" contenuId="affichage-contenu" />
      </div>

      {noWork ? (
        <p className="muted" style={{ fontSize: 18, padding: 20 }}>
          Aucun jour ouvert dans cet atelier sur la période affichée (J-1 à J+4).
          Vérifiez l’ouverture des lignes dans Ordonnancement.
        </p>
      ) : (
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 16, tableLayout: "fixed" }}>
        <thead>
          <tr>
            <th style={{ width: 260, border: cellBorder, background: "#1e3a8a", color: "#fff", padding: "8px 10px" }}></th>
            {shownDays.map((d) => (
              <th
                key={d.iso}
                style={{
                  border: cellBorder,
                  padding: "8px 6px",
                  textAlign: "center",
                  fontSize: 20,
                  background: colBg(d.iso) ?? "#1e3a8a",
                  color: d.iso === todayIso ? "#000" : "#fff",
                }}
              >
                {d.nom}
                <div style={{ fontSize: 14, fontWeight: 400 }}>{d.num}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {            personList.map((p) => {
              const interim = p.type_contrat === "INTERIM";
              return (
                <tr key={p.id}>
                  <td style={{ border: cellBorder, padding: "5px 10px", fontWeight: 600, whiteSpace: "nowrap" }}>
                    <span style={{ background: interim ? INTERIM_BG : undefined, padding: interim ? "0 4px" : 0, borderRadius: 3 }}>
                      {p.nom} {p.prenom}
                    </span>
                  </td>
                  {shownDays.map((d) => (
                    <td key={d.iso} style={{ border: cellBorder, padding: "4px 6px", verticalAlign: "top", overflowWrap: "anywhere", wordBreak: "break-word" }}>
                      {cellNom(p.id, d.iso)}
                    </td>
                  ))}
                </tr>
              );
            })}

          {personList.length === 0 && (
            <tr>
              <td colSpan={shownDays.length + 1} className="muted" style={{ padding: 10 }}>Aucune affectation sur la période affichée.</td>
            </tr>
          )}
        </tbody>
      </table>
      )}

      <div style={{ marginTop: 14, fontSize: 14, color: "#6b7280" }}>
        Légende : <span style={{ background: INTERIM_BG, padding: "0 6px" }}>Intérimaire</span>{" "}
        · <span style={{ background: AUJOURDHUI, padding: "0 6px" }}>Aujourd&apos;hui</span> · horaires en bleu ·{" "}
        <span style={{ color: "#b91c1c" }}>Absence</span>{" "}
        · mise à jour auto toutes les 5 min.
      </div>
      </div>
    </div>
  );
}
