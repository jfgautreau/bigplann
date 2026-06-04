"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Rafraichit la page a intervalle regulier (affichage couloir).
// `router.refresh()` re-rend le RSC cote serveur et ne recharge PAS le JS/HTML
// (contrairement a location.reload()) : bien plus leger pour un ecran 24/7.
export default function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [seconds, router]);
  return null;
}
