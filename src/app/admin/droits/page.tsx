import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/current-user";
import AppHeader from "@/components/AppHeader";
import { MODULES, getAllPermissions } from "@/lib/permissions";
import { ROLES, ROLE_LABELS } from "@/lib/roles";
import DroitsMatrix from "./DroitsMatrix";

export default async function DroitsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  const all = await getAllPermissions();

  return (
    <>
      <AppHeader role={profile.role} active="/admin/droits" />
      <div className="container" style={{ maxWidth: 1100 }}>
        <h1>Droits d&apos;accès (rôle × module)</h1>
        <p className="muted" style={{ marginBottom: 16 }}>
          Cliquez sur une case pour changer le droit :{" "}
          <span style={{ background: "#fff", border: "1px solid #cbd5e1", padding: "1px 8px", borderRadius: 5 }}>Aucun</span>{" "}
          &rarr; <span style={{ background: "#1d4ed8", color: "#fff", padding: "1px 8px", borderRadius: 5 }}>Lecture</span>{" "}
          &rarr; <span style={{ background: "#7c3aed", color: "#fff", padding: "1px 8px", borderRadius: 5 }}>Modif.</span>.
          L&apos;administrateur a tous les droits. Chaque changement est <strong>enregistré
          automatiquement</strong>. La sécurité base (RLS) reste un garde-fou.
        </p>

        <div className="card" style={{ overflowX: "auto" }}>
          <DroitsMatrix
            roles={ROLES.map((r) => ({ key: r, label: ROLE_LABELS[r] }))}
            modules={MODULES.map((m) => ({ key: m.key, label: m.label }))}
            initial={Object.fromEntries(ROLES.filter((r) => r !== "admin").map((r) => [r, all[r]]))}
          />
        </div>
      </div>
    </>
  );
}
