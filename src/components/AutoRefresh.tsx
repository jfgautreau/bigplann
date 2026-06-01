"use client";

import { useEffect } from "react";

// Recharge la page a intervalle regulier (affichage couloir).
export default function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  useEffect(() => {
    const id = setInterval(() => location.reload(), seconds * 1000);
    return () => clearInterval(id);
  }, [seconds]);
  return null;
}
