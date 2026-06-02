"use client";

// Formulaire avec confirmation avant soumission (server action).
export default function ConfirmForm({
  action,
  hidden = {},
  label,
  confirm,
  className = "btn-sm btn-ghost",
}: {
  action: (fd: FormData) => void | Promise<void>;
  hidden?: Record<string, string>;
  label: string;
  confirm: string;
  className?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
      style={{ display: "inline", margin: 0 }}
    >
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  );
}
