import { Fragment } from "react";
import { getAdminClient } from "@/lib/supabase-server";
import { isoDate, mondayOf, parseMonday, weekDays } from "@/lib/week";
import AutoRefresh from "@/components/AutoRefresh";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

type Atelier = { id: string; nom: string };
type Poste = { id: string; nom: string; est_conducteur: boolean };
type Ligne = { id: string; nom: string; poste: (Poste & { actif: boolean })[] };
type PlacementRow = {
  poste_id: string | null;
  jour: string;
  equipe_id: string | null;
  personne: { nom: string; prenom: string; type_contrat: string } | null;
  equipe: { nom: string } | null;
};
type HoraireRow = { poste_id: string; equipe_id: string; jour: number; debut: string | null; fin: string | null };

const dow = (iso: string) => (new Date(iso + "T00:00").getDay() + 6) % 7;

export default async function AffichageAtelier({
  params,
  searchParams,
}: {
  params: Promise<{ atelier: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { atelier: param } = await params;
  const sp = await searchParams;
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
        <p className="muted">Verifiez l&apos;URL (/affichage).</p>
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

  const byPoste = new Map<string, PlacementRow[]>(); // `${poste}:${iso}`
  const horMap = new Map<string, { debut: string | null; fin: string | null }>(); // `${poste}:${equipe}:${dow}`
  if (posteIds.length) {
    const [{ data: pl }, { data: hor }] = await Promise.all([
      admin
        .from("placement")
        .select("poste_id, jour, equipe_id, personne:personne_id(nom, prenom, type_contrat), equipe:equipe_id(nom)")
        .in("jour", isos)
        .in("poste_id", posteIds)
        .returns<PlacementRow[]>(),
      admin
        .from("horaire_poste")
        .select("poste_id, equipe_id, jour, debut, fin")
        .in("poste_id", posteIds)
        .returns<HoraireRow[]>(),
    ]);
    for (const r of pl ?? []) {
      if (!r.poste_id) continue;
      const k = `${r.poste_id}:${r.jour}`;
      const arr = byPoste.get(k) ?? [];
      arr.push(r);
      byPoste.set(k, arr);
    }
    for (const h of hor ?? []) horMap.set(`${h.poste_id}:${h.equipe_id}:${h.jour}`, { debut: h.debut, fin: h.fin });
  }

  const horaireTxt = (posteId: string, equipeId: string | null, iso: string) => {
    if (!equipeId) return "";
    const h = horMap.get(`${posteId}:${equipeId}:${dow(iso)}`);
    if (!h || (!h.debut && !h.fin)) return "";
    return `${h.debut ?? "?"}-${h.fin ?? "?"}`;
  };

  const cell = (posteId: string, iso: string) => {
    const rows = byPoste.get(`${posteId}:${iso}`) ?? [];
    if (!rows.length) return <span style={{ color: "#cbd5e1" }}>—</span>;
    return rows.map((r, i) => {
      const p = r.personne;
      if (!p) return null;
      const interim = p.type_contrat === "INTERIM";
      const h = horaireTxt(posteId, r.equipe_id, iso);
      return (
        <div key={i} style={{ lineHeight: 1.25 }}>
          <span style={{ background: interim ? "#bbf7d0" : undefined, padding: interim ? "0 4px" : 0, borderRadius: 3 }}>
            {p.nom} {p.prenom}
          </span>
          {h && <span style={{ color: "#1d4ed8", fontWeight: 700, marginLeft: 5 }}>{h}</span>}
        </div>
      );
    });
  };

  const FLUO = "#fde047"; // jaune fluo pour le jour
  const colBg = (iso: string) => (iso === todayIso ? FLUO : undefined);
  const cellBorder = "1px solid #d9dce1";

  return (
    <div style={{ padding: "18px 24px" }}>
      <AutoRefresh seconds={300} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <h1 style={{ fontSize: 30, margin: 0 }}>{atelier.nom}</h1>
        <PrintButton label="Imprimer / PDF" />
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 16, tableLayout: "fixed" }}>
        <thead>
          <tr>
            <th style={{ width: 180, border: cellBorder, background: "#1e3a8a", color: "#fff", padding: "8px 10px" }}></th>
            {days.map((d) => (
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
          {lignes.map((l) => (
            <Fragment key={l.id}>
              <tr>
                <td
                  colSpan={days.length + 1}
                  style={{ background: "#eef2ff", fontWeight: 800, fontSize: 17, padding: "6px 10px", border: cellBorder }}
                >
                  {l.nom}
                </td>
              </tr>
              {l.poste.map((p) => (
                <tr key={p.id}>
                  <td style={{ border: cellBorder, padding: "5px 10px", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {p.nom}
                  </td>
                  {days.map((d) => (
                    <td key={d.iso} style={{ border: cellBorder, padding: "4px 6px", verticalAlign: "top" }}>
                      {cell(p.id, d.iso)}
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
          {lignes.length === 0 && (
            <tr>
              <td colSpan={days.length + 1} className="muted" style={{ padding: 10 }}>Aucun poste.</td>
            </tr>
          )}
        </tbody>
      </table>

      <div style={{ marginTop: 14, fontSize: 14, color: "#6b7280" }}>
        Legende : <span style={{ background: "#bbf7d0", padding: "0 6px" }}>Interimaire</span>{" "}
        · <span style={{ background: FLUO, padding: "0 6px" }}>Aujourd&apos;hui</span> · horaires en bleu ·
        mise a jour auto toutes les 5 min.
      </div>
    </div>
  );
}
