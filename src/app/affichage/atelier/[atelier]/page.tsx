import { Fragment } from "react";
import Link from "next/link";
import { getAdminClient } from "@/lib/supabase-server";
import { isoDate, mondayOf, parseMonday, weekDays, defaultQuartActif } from "@/lib/week";
import AutoRefresh from "@/components/AutoRefresh";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

type Atelier = { id: string; nom: string };
type Poste = { id: string; nom: string; est_conducteur: boolean };
type Ligne = { id: string; nom: string; poste: (Poste & { actif: boolean })[] };
type PlacementRow = {
  poste_id: string | null;
  jour: string;
  quart_code: string | null;
  personne_id: string;
  personne: { nom: string; prenom: string; type_contrat: string } | null;
};
type HoraireRow = { poste_id: string; quart_code: string; jour: number; debut: string | null; fin: string | null };

const dow = (iso: string) => (new Date(iso + "T00:00").getDay() + 6) % 7;

export default async function AffichageAtelier({
  params,
  searchParams,
}: {
  params: Promise<{ atelier: string }>;
  searchParams: Promise<{ date?: string; vue?: string }>;
}) {
  const { atelier: param } = await params;
  const sp = await searchParams;
  const vue = sp.vue === "noms" ? "noms" : "postes";
  const ref = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? parseMonday(sp.date) : mondayOf();
  const days = weekDays(ref);
  const isos = days.map((d) => d.iso);
  const todayIso = isoDate(new Date());

  const admin = getAdminClient();

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
    .select("id, nom, poste(id, nom, est_conducteur, actif)")
    .eq("atelier_id", atelier.id)
    .eq("actif", true)
    .order("nom")
    .returns<Ligne[]>();

  const lignes = (lignesD ?? [])
    .map((l) => ({
      ...l,
      poste: [...(l.poste ?? [])].filter((p) => p.actif).sort((a, b) => a.nom.localeCompare(b.nom)),
    }))
    .filter((l) => l.poste.length > 0);
  const posteIds = lignes.flatMap((l) => l.poste.map((p) => p.id));
  const posteLigne = new Map<string, string>();
  const posteNom = new Map<string, string>();
  for (const l of lignes) for (const p of l.poste) { posteLigne.set(p.id, l.id); posteNom.set(p.id, p.nom); }

  const byPoste = new Map<string, PlacementRow[]>(); // `${poste}:${iso}`
  const horMap = new Map<string, { debut: string | null; fin: string | null }>(); // `${poste}:${quart}:${dow}`
  const actMap = new Map<string, boolean>(); // `${quart}:${iso}`
  const ouvMap = new Map<string, boolean>(); // `${quart}:${ligne}:${iso}`
  type Personne = { nom: string; prenom: string; type_contrat: string };
  const persons = new Map<string, Personne>(); // personne_id -> infos
  const byPerson = new Map<string, PlacementRow[]>(); // `${personne_id}:${iso}`
  const workedDays = new Set<string>(); // jours (iso) ou au moins une personne travaille

  if (posteIds.length) {
    const [{ data: pl }, { data: hor }, { data: jq }, { data: ov }] = await Promise.all([
      admin
        .from("placement")
        .select("poste_id, jour, quart_code, personne_id, personne:personne_id(nom, prenom, type_contrat)")
        .in("jour", isos)
        .in("poste_id", posteIds)
        .returns<PlacementRow[]>(),
      admin
        .from("horaire_poste")
        .select("poste_id, quart_code, jour, debut, fin")
        .in("poste_id", posteIds)
        .returns<HoraireRow[]>(),
      admin
        .from("jour_quart")
        .select("jour, quart_code, actif")
        .in("jour", isos)
        .returns<{ jour: string; quart_code: string; actif: boolean }[]>(),
      admin
        .from("ouverture_quart")
        .select("jour, ligne_id, quart_code, ouverte")
        .in("jour", isos)
        .returns<{ jour: string; ligne_id: string; quart_code: string; ouverte: boolean }[]>(),
    ]);
    for (const h of hor ?? []) horMap.set(`${h.poste_id}:${h.quart_code}:${h.jour}`, { debut: h.debut, fin: h.fin });
    for (const r of jq ?? []) actMap.set(`${r.quart_code}:${r.jour}`, r.actif);
    for (const r of ov ?? []) ouvMap.set(`${r.quart_code}:${r.ligne_id}:${r.jour}`, r.ouverte);

    // Une cellule est affichee seulement si la ligne est ouverte ce jour-la pour ce
    // quart (coherent avec le planning / l'ordonnancement).
    const isOpen = (ligneId: string, quart: string, iso: string) => {
      const a = actMap.has(`${quart}:${iso}`) ? actMap.get(`${quart}:${iso}`)! : defaultQuartActif(iso, quart);
      if (!a) return false;
      const k = `${quart}:${ligneId}:${iso}`;
      return ouvMap.has(k) ? ouvMap.get(k)! : true;
    };

    for (const r of pl ?? []) {
      if (!r.poste_id) continue;
      const qc = r.quart_code ?? "matin";
      const lid = posteLigne.get(r.poste_id);
      if (lid && !isOpen(lid, qc, r.jour)) continue; // jour/ligne ferme -> on n'affiche pas
      workedDays.add(r.jour);
      const k = `${r.poste_id}:${r.jour}`;
      (byPoste.get(k) ?? byPoste.set(k, []).get(k)!).push(r);
      if (r.personne) persons.set(r.personne_id, r.personne);
      const pk = `${r.personne_id}:${r.jour}`;
      (byPerson.get(pk) ?? byPerson.set(pk, []).get(pk)!).push(r);
    }
  }

  const horaireTxt = (posteId: string, quartCode: string | null, iso: string) => {
    const q = quartCode ?? "matin";
    const h = horMap.get(`${posteId}:${q}:${dow(iso)}`);
    if (!h || (!h.debut && !h.fin)) return "";
    return `${h.debut ?? "?"}-${h.fin ?? "?"}`;
  };

  const FLUO = "#fde047"; // jaune fluo pour le jour
  const colBg = (iso: string) => (iso === todayIso ? FLUO : undefined);
  const cellBorder = "1px solid #d9dce1";

  // Cellule vue "par poste" : qui est sur ce poste ce jour-la (nom + horaire dessous).
  const cellPoste = (posteId: string, iso: string) => {
    const rows = byPoste.get(`${posteId}:${iso}`) ?? [];
    if (!rows.length) return <span style={{ color: "#cbd5e1" }}>—</span>;
    return rows.map((r, i) => {
      const p = r.personne;
      if (!p) return null;
      const interim = p.type_contrat === "INTERIM";
      const h = horaireTxt(posteId, r.quart_code, iso);
      return (
        <div key={i} style={{ lineHeight: 1.2, marginBottom: i < rows.length - 1 ? 6 : 0 }}>
          <div>
            <span style={{ background: interim ? "#bbf7d0" : undefined, padding: interim ? "0 4px" : 0, borderRadius: 3 }}>
              {p.nom} {p.prenom}
            </span>
          </div>
          {h && <div style={{ color: "#1d4ed8", fontWeight: 700, fontSize: 13 }}>{h}</div>}
        </div>
      );
    });
  };

  // Cellule vue "par nom" : sur quel poste cette personne est placee ce jour-la (poste + horaire dessous).
  const cellNom = (personId: string, iso: string) => {
    const rows = byPerson.get(`${personId}:${iso}`) ?? [];
    if (!rows.length) return <span style={{ color: "#cbd5e1" }}>—</span>;
    return rows.map((r, i) => {
      if (!r.poste_id) return null;
      const h = horaireTxt(r.poste_id, r.quart_code, iso);
      return (
        <div key={i} style={{ lineHeight: 1.2, marginBottom: i < rows.length - 1 ? 6 : 0 }}>
          <div style={{ fontWeight: 600 }}>{posteNom.get(r.poste_id) ?? "?"}</div>
          {h && <div style={{ color: "#1d4ed8", fontWeight: 700, fontSize: 13 }}>{h}</div>}
        </div>
      );
    });
  };

  const personList = [...persons.entries()]
    .map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => (a.nom + a.prenom).localeCompare(b.nom + b.prenom));

  // On n'affiche que les jours ou au moins une personne travaille (week-end ferme masque).
  const shownDays = days.filter((d) => workedDays.has(d.iso));
  const noWork = shownDays.length === 0;

  const dateQ = sp.date ? `&date=${sp.date}` : "";
  const postesHref = `/affichage/atelier/${param}${sp.date ? `?date=${sp.date}` : ""}`;
  const nomsHref = `/affichage/atelier/${param}?vue=noms${dateQ}`;
  const tab = (active: boolean): React.CSSProperties => ({
    padding: "6px 16px",
    borderRadius: 8,
    textDecoration: "none",
    fontSize: 15,
    fontWeight: 600,
    background: active ? "#1e3a8a" : "#e2e8f0",
    color: active ? "#fff" : "#1e293b",
  });

  return (
    <div style={{ padding: "18px 24px" }}>
      <AutoRefresh seconds={300} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h1 style={{ fontSize: 30, margin: 0 }}>{atelier.nom}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href={postesHref} style={tab(vue === "postes")}>Par poste</Link>
          <Link href={nomsHref} style={tab(vue === "noms")}>Par nom</Link>
          <PrintButton label="Imprimer / PDF" />
        </div>
      </div>

      {noWork ? (
        <p className="muted" style={{ fontSize: 18, padding: 20 }}>
          Personne ne travaille cette semaine dans cet atelier.
        </p>
      ) : (
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 16, tableLayout: "fixed" }}>
        <thead>
          <tr>
            <th style={{ width: 180, border: cellBorder, background: "#1e3a8a", color: "#fff", padding: "8px 10px" }}></th>
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
          {vue === "postes" &&
            lignes.map((l) => (
              <Fragment key={l.id}>
                <tr>
                  <td
                    colSpan={shownDays.length + 1}
                    style={{ background: "#eef2ff", fontWeight: 800, fontSize: 17, padding: "6px 10px", border: cellBorder }}
                  >
                    {l.nom}
                  </td>
                </tr>
                {l.poste.map((p) => (
                  <tr key={p.id}>
                    <td style={{ border: cellBorder, padding: "5px 10px", fontWeight: 600, overflowWrap: "anywhere", wordBreak: "break-word" }}>
                      {p.nom}
                    </td>
                    {shownDays.map((d) => (
                      <td key={d.iso} style={{ border: cellBorder, padding: "4px 6px", verticalAlign: "top", background: colBg(d.iso), overflowWrap: "anywhere", wordBreak: "break-word" }}>
                        {cellPoste(p.id, d.iso)}
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}

          {vue === "noms" &&
            personList.map((p) => {
              const interim = p.type_contrat === "INTERIM";
              return (
                <tr key={p.id}>
                  <td style={{ border: cellBorder, padding: "5px 10px", fontWeight: 600, overflowWrap: "anywhere", wordBreak: "break-word" }}>
                    <span style={{ background: interim ? "#bbf7d0" : undefined, padding: interim ? "0 4px" : 0, borderRadius: 3 }}>
                      {p.nom} {p.prenom}
                    </span>
                  </td>
                  {shownDays.map((d) => (
                    <td key={d.iso} style={{ border: cellBorder, padding: "4px 6px", verticalAlign: "top", background: colBg(d.iso), overflowWrap: "anywhere", wordBreak: "break-word" }}>
                      {cellNom(p.id, d.iso)}
                    </td>
                  ))}
                </tr>
              );
            })}

          {vue === "postes" && lignes.length === 0 && (
            <tr>
              <td colSpan={shownDays.length + 1} className="muted" style={{ padding: 10 }}>Aucun poste.</td>
            </tr>
          )}
          {vue === "noms" && personList.length === 0 && (
            <tr>
              <td colSpan={shownDays.length + 1} className="muted" style={{ padding: 10 }}>Personne de placé cette semaine.</td>
            </tr>
          )}
        </tbody>
      </table>
      )}

      <div style={{ marginTop: 14, fontSize: 14, color: "#6b7280" }}>
        Légende : <span style={{ background: "#bbf7d0", padding: "0 6px" }}>Intérimaire</span>{" "}
        · <span style={{ background: FLUO, padding: "0 6px" }}>Aujourd&apos;hui</span> · horaires en bleu ·
        mise à jour auto toutes les 5 min.
      </div>
    </div>
  );
}
