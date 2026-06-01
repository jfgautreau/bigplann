import { getAdminClient } from "@/lib/supabase-server";
import { isoDate, addDays } from "@/lib/week";
import AutoRefresh from "@/components/AutoRefresh";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

type Atelier = { id: string; nom: string };
type Poste = { id: string; nom: string; est_conducteur: boolean };
type Ligne = { id: string; nom: string; poste: (Poste & { actif: boolean })[] };
type PlacementRow = {
  poste_id: string | null;
  jour: string;
  personne: { nom: string; prenom: string; type_contrat: string } | null;
  equipe: { nom: string } | null;
};
type AbsenceRow = {
  jour: string;
  personne: { nom: string; prenom: string } | null;
  motif: { code_court: string } | null;
};

function dayLabel(iso: string) {
  return new Date(iso + "T00:00").toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

export default async function AffichageAtelier({
  params,
  searchParams,
}: {
  params: Promise<{ atelier: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { atelier: param } = await params;
  const sp = await searchParams;
  const j0 = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : isoDate(new Date());
  const j1 = isoDate(addDays(new Date(j0 + "T00:00"), 1));
  const jours = [j0, j1];

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

  const lignes = (lignesD ?? []).map((l) => ({
    ...l,
    poste: [...(l.poste ?? [])].filter((p) => p.actif).sort((a, b) => a.nom.localeCompare(b.nom)),
  }));
  const posteIds = lignes.flatMap((l) => l.poste.map((p) => p.id));

  const byPoste = new Map<string, PlacementRow[]>(); // key `${poste}:${jour}`
  if (posteIds.length) {
    const { data: pl } = await admin
      .from("placement")
      .select("poste_id, jour, personne:personne_id(nom, prenom, type_contrat), equipe:equipe_id(nom)")
      .in("jour", jours)
      .in("poste_id", posteIds)
      .returns<PlacementRow[]>();
    for (const r of pl ?? []) {
      if (!r.poste_id) continue;
      const k = `${r.poste_id}:${r.jour}`;
      const arr = byPoste.get(k) ?? [];
      arr.push(r);
      byPoste.set(k, arr);
    }
  }

  const { data: absD } = await admin
    .from("placement")
    .select("jour, personne:personne_id(nom, prenom), motif:motif_absence_id(code_court)")
    .in("jour", jours)
    .not("motif_absence_id", "is", null)
    .returns<AbsenceRow[]>();
  const absByDay = (iso: string) => (absD ?? []).filter((a) => a.jour === iso);

  const person = (r: PlacementRow) => {
    const p = r.personne;
    if (!p) return null;
    const interim = p.type_contrat === "INTERIM";
    return (
      <span style={{ background: interim ? "#fef08a" : undefined, padding: interim ? "0 4px" : 0, borderRadius: 3 }}>
        {p.nom} {p.prenom}
        {r.equipe?.nom ? <span style={{ color: "#6b7280", fontWeight: 400 }}> ({r.equipe.nom})</span> : null}
      </span>
    );
  };

  const cell = (posteId: string, iso: string) => {
    const rows = byPoste.get(`${posteId}:${iso}`) ?? [];
    return rows.length ? rows.map((r, i) => <span key={i}>{i > 0 ? ", " : ""}{person(r)}</span>) : <span className="muted">—</span>;
  };

  return (
    <div style={{ padding: "20px 28px" }}>
      <AutoRefresh seconds={60} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <h1 style={{ fontSize: 32, margin: 0 }}>{atelier.nom}</h1>
        <PrintButton label="Imprimer / PDF" />
      </div>

      {lignes.map((l) => (
        <div key={l.id} style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, margin: "0 0 4px", borderBottom: "2px solid #1e3a8a" }}>{l.nom}</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 17, tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th style={{ width: 220, textAlign: "left", padding: "4px 10px", border: "1px solid #d9dce1" }}>Poste</th>
                {jours.map((iso) => (
                  <th key={iso} style={{ textAlign: "left", padding: "4px 10px", border: "1px solid #d9dce1", textTransform: "capitalize" }}>
                    {dayLabel(iso)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {l.poste.map((p) => (
                <tr key={p.id} style={{ background: p.est_conducteur ? "#fecdd3" : undefined }}>
                  <td style={{ padding: "6px 10px", fontWeight: 600, border: "1px solid #d9dce1" }}>{p.nom}</td>
                  {jours.map((iso) => (
                    <td key={iso} style={{ padding: "6px 10px", border: "1px solid #d9dce1" }}>
                      {cell(p.id, iso)}
                    </td>
                  ))}
                </tr>
              ))}
              {l.poste.length === 0 && (
                <tr>
                  <td colSpan={3} className="muted" style={{ padding: 8 }}>Aucun poste.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ))}

      <div style={{ display: "flex", gap: 32, marginTop: 16 }}>
        {jours.map((iso) => {
          const abs = absByDay(iso);
          return (
            <div key={iso} style={{ flex: 1 }}>
              <h3 style={{ fontSize: 16, margin: "0 0 4px", textTransform: "capitalize" }}>Absences — {dayLabel(iso)}</h3>
              <div style={{ fontSize: 15, lineHeight: 1.6 }}>
                {abs.length ? (
                  abs.map((a, i) => (
                    <span key={i} style={{ marginRight: 14, whiteSpace: "nowrap" }}>
                      {a.personne ? `${a.personne.nom} ${a.personne.prenom}` : "?"} <strong>[{a.motif?.code_court ?? "?"}]</strong>
                    </span>
                  ))
                ) : (
                  <span className="muted">Aucune</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 16, fontSize: 14, color: "#6b7280" }}>
        Legende : <span style={{ background: "#fecdd3", padding: "0 6px" }}>Conducteur</span>{" "}
        <span style={{ background: "#fef08a", padding: "0 6px" }}>Interimaire</span> · Mise a jour auto 60 s.
      </div>
    </div>
  );
}
