import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { getCurrentProfile } from "@/lib/current-user";
import CompteForm from "./CompteForm";

export default async function ComptePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <>
      <AppHeader role={profile.role} />
      <div className="container" style={{ maxWidth: 560 }}>
        <h1>Mon compte</h1>
        <CompteForm name={profile.name} email={profile.email} role={profile.role} />
      </div>
    </>
  );
}
