import Link from "next/link";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { getCurrentProfile } from "@/lib/current-user";

// Page d'accueil : logo BigPlann' en grand, centré, avec le titre « planning ».
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
          <svg viewBox="0 0 64 64" width="180" height="180" aria-hidden="true" style={{ display: "block" }}>
            <defs>
              <linearGradient id="bpHome" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#4338ca" />
                <stop offset="0.55" stopColor="#6d28d9" />
                <stop offset="1" stopColor="#7c3aed" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" rx="14" fill="url(#bpHome)" />
            <text x="30" y="47" textAnchor="middle" fill="#fff" fontFamily="Arial, Helvetica, sans-serif" fontSize="40" fontWeight="900">B</text>
            <circle cx="47" cy="20" r="3.4" fill="#ddd6fe" />
          </svg>
          <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: "-0.5px", color: "#4338ca" }}>BigPlann&apos;</div>
        </Link>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, color: "#334155" }}>planning</h1>
      </div>
    </>
  );
}
