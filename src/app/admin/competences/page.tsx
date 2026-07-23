import AppHeader from "@/components/AppHeader";
import { requireModule, canWrite } from "@/lib/permissions";
import LectureSeule from "@/components/LectureSeule";
import { getServerClient } from "@/lib/supabase-server";
import { saveEchelle } from "./actions";
import BandeauErreur from "@/components/BandeauErreur";

type Niveau = { niveau: number; libelle: string };

export default async function CompetencesPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const sp = await searchParams;
  const { profile, perms } = await requireModule("competences", "read");

  const supabase = await getServerClient();
  const { data: niveauxData } = await supabase
    .from("competence_niveau_libelle")
    .select("niveau, libelle")
    .order("niveau")
    .returns<Niveau[]>();

  const niveaux = niveauxData ?? [];
  const libelle = (n: number) => niveaux.find((x) => x.niveau === n)?.libelle ?? "";

  return (
    <>
      <AppHeader role={profile.role} active="/admin/competences" />
      <div className="container">
        <h1>Compétences</h1>
        <BandeauErreur message={sp.err} />
        <LectureSeule actif={!canWrite(perms, "competences")}>

        {/* Echelle de niveaux */}
        <div className="card section">
          <h2>Échelle de niveaux (carré magique)</h2>
          <p className="muted">Libellés paramétrables des niveaux 0 à 4.</p>
          <form action={saveEchelle} autoComplete="off">
            {[0, 1, 2, 3, 4].map((n) => (
              <div key={n} style={{ marginBottom: 8 }}>
                <label htmlFor={`niveau_${n}`}>Niveau {n}</label>
                <input id={`niveau_${n}`} name={`niveau_${n}`} defaultValue={libelle(n)} required />
              </div>
            ))}
            <button type="submit">Enregistrer l&apos;échelle</button>
          </form>
        </div>
        </LectureSeule>
      </div>
    </>
  );
}
