"use client";

export default function PrintButton({ label = "Imprimer / PDF" }: { label?: string }) {
  return (
    <button type="button" className="btn-sm btn-ghost noprint" onClick={() => window.print()}>
      {label}
    </button>
  );
}
