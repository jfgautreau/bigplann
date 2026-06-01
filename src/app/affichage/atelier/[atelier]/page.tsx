import { getAdminClient } from "@/lib/supabase-server";
import { isoDate } from "@/lib/week";
import AutoRefresh from "@/components/AutoRefresh";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

type Atelier = { id: string; nom: string };
type Poste = { id: string; nom: string; est_conducteur: boolean };
type Ligne = { id: string; nom: string; poste: Poste[] };
type PlacementRow = {
  poste_id: string | null;
  personne: { nom: string; prenom: string; type_contrat: string } | null;
  equipe: { nom: string } | null;
};
type AbsenceRow = {
  personne: { nom: string; prenom: string } | null;
  motif: { code_court: string; libelle: string } | null;
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
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : isoDate(new Date());

  const admin = getAdminClient();

  // Resolution de l'atelier (par id ou par nom)
  const { data: ateliers } = await admin.from("atelier").select("id, nom").returns<Atelier[]>();
  const decoded = decodeURIComponent(param).toLowerCase();
  const atelier = (ateliers ?? []).find(
    (a) => a.id === param || a.nom.toLowerCase() === decoded
  );

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
    .returns<(Ligne & { poste: (Poste & { actif: boolean })[] })[]>();

  const lignes = (lignesD ?? []).map((l) => ({
    ...l,
    poste: [...(l.poste ?? [])].filter((p) => p.actif).sort((a, b) => a.nom.localeCompare(b.nom)),
  }));
  const posteIds = lignes.flatMap((l) => l.poste.map((p) => p.id));

  // Placements du jour sur les postes de l'atelier
  const byPoste = new Map<string, PlacementRow[]>();
  if (posteIds.length) {
    const { data: pl } = await admin
      .from("placement")
      .select("poste_id, personne:personne_id(nom, prenom, type_contrat), equipe:equipe_id(nom)")
      .eq("jour", date)
      .in("poste_id", posteIds)
      .returns<PlacementRow[]>();
    for (const r of pl ?? []) {
      if (!r.poste_id) continue;
      const arr = byPoste.get(r.poste_id) ?? [];
      arr.push(r);
      byPoste.set(r.poste_id, arr);
    }
  }

  // Absences du jour (toutes equipes)
  const { data: absD } = await admin
    .from("placement")
    .select("personne:personne_id(nom, prenom), motif:motif_absence_id(code_court, libelle)")
    .eq("jour", date)
    .not("motif_absence_id", "is", null)
    .returns<AbsenceRow[]>();
  const absences = absD ?? [];

  const dateLabel = new Date(date + "T00:00").toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const cellPerson = (r: PlacementRow) => {
    const p = r.personne;
    if (!p) return "";
    const interim = p.type_contrat === "INTERIM";
    return (
      <span style={{ background: interim ? "#fef08a" : undefined, padding: interim ? "0 4px" : 0, borderRadius: 3 }}>
        {p.nom} {p.prenom}
        {r.equipe?.nom ? <span style={{ color: "#6b7280", fontWeight: 400 }}> ({r.equipe.nom})</span> : null}
      </span>
    );
  };

  return (
    <div style={{ padding: "24px 32px" }}>
      <AutoRefresh seconds={60} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <h1 style={{ fontSize: 34, margin: 0 }}>{atelier.nom}</h1>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 22, fontWeight: 600, textTransform: "capitalize" }}>{dateLabel}</div>
          <PrintButton label="Imprimer / PDF" />
        </div>
      </div>

      {lignes.map((l) => (
        <div key={l.id} style={{ marginBottom: 18 }}>
          <h2 style={{ fontSize: 22, margin: "0 0 6px", borderBottom: "2px solid #1e3a8a" }}>{l.nom}</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 18 }}>
            <tbody>
              {l.poste.map((p) => {
                const rows = byPoste.get(p.id) ?? [];
                return (
                  <tr key={p.id} style={{ background: p.est_conducteur ? "#fecdd3" : undefined }}>
                    <td style={{ width: 260, padding: "6px 10px", fontWeight: 600, border: "1px solid #d9dce1" }}>
                      {p.nom}
                    </td>
                    <td style={{ padding: "6px 10px", border: "1px solid #d9dce1" }}>
                      {rows.length ? rows.map((r, i) => <span key={i}>{i > 0 ? ", " : ""}{cellPerson(r)}</span>) : <span className="muted">—</span>}
                    </td>
                  </tr>
                );
              })}
              {l.poste.length === 0 && (
                <tr>
                  <td colSpan={2} className="muted" style={{ padding: 8 }}>Aucun poste.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ))}

      {absences.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: 20, margin: "0 0 6px" }}>Absences du jour</h2>
          <div style={{ fontSize: 16, lineHeight: 1.7 }}>
            {absences.map((a, i) => (
              <span key={i} style={{ marginRight: 16, whiteSpace: "nowrap" }}>
                {a.personne ? `${a.personne.nom} ${a.personne.prenom}` : "?"}
                <strong> [{a.motif?.code_court ?? "?"}]</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 20, fontSize: 14, color: "#6b7280" }}>
        Legende : <span style={{ background: "#fecdd3", padding: "0 6px" }}>Conducteur</span>{" "}
        <span style={{ background: "#fef08a", padding: "0 6px" }}>Interimaire</span> · Mise a jour auto toutes les 60 s.
      </div>
    </div>
  );
}
