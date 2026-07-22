import Link from "next/link";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import Logo from "@/components/Logo";
import { getCurrentProfile } from "@/lib/current-user";

// Page d'accueil : logo Polaris en grand, centré, avec le titre « planning ».
export default async function Home() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <>
      <AppHeader role={profile.role} />
      <div
        style={{
          minHeight: "calc(100vh - 46px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
          padding: 24,
        }}
      >
        <Link href="/planning" style={{ textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          <Logo size={180} id="home" />
          <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: "1px", color: "#1d4ed8" }}>Polaris</div>
        </Link>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, color: "#334155" }}>planning</h1>
      </div>
    </>
  );
}
