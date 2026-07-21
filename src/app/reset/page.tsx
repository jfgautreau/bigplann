"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { validatePasswordPolicy } from "@/lib/password";

// Page atteinte apres clic sur un lien de recuperation. Deux provenances :
//   • « Mot de passe oublie » : le lien passe par /auth/callback, qui a deja
//     ouvert la session — on arrive ici sans parametre ;
//   • lien genere par un admin (ecran Utilisateurs) : il porte ?token_hash=…,
//     qu'on echange ici contre une session (cf. src/lib/password-link.ts).
//
// On lit l'URL via window plutot que useSearchParams() : cela evite d'imposer
// une frontiere <Suspense> et garde la page prerendue statiquement.
export default function ResetPage() {
  const router = useRouter();
  const [etat, setEtat] = useState<"verification" | "pret" | "lienInvalide">("verification");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token_hash = params.get("token_hash");
    if (!token_hash) {
      setEtat("pret"); // flux « mot de passe oublie » : session deja ouverte
      return;
    }
    let vivant = true;
    supabase.auth.verifyOtp({ token_hash, type: "recovery" }).then(({ error: e }) => {
      if (!vivant) return;
      if (e) {
        setEtat("lienInvalide");
        return;
      }
      // Le jeton ne doit pas rester dans la barre d'adresse ni dans l'historique.
      window.history.replaceState({}, "", "/reset");
      setEtat("pret");
    });
    return () => {
      vivant = false;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const policyError = validatePasswordPolicy(password);
    if (policyError) {
      setError(policyError);
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setPending(true);
    const { error } = await supabase.auth.updateUser({ password });
    setPending(false);
    if (error) {
      setError("Échec de la mise à jour. Le lien a peut-être expiré.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  if (etat === "verification") {
    return (
      <div className="container">
        <div className="card card-narrow">
          <h1>Définir le mot de passe</h1>
          <p className="muted">Vérification du lien…</p>
        </div>
      </div>
    );
  }

  if (etat === "lienInvalide") {
    return (
      <div className="container">
        <div className="card card-narrow">
          <h1>Lien inutilisable</h1>
          <p className="error" style={{ marginTop: 0 }}>
            Ce lien a expiré, a déjà servi, ou un lien plus récent l&apos;a remplacé.
          </p>
          <p className="muted">
            Demandez-en un nouveau à votre administrateur, ou utilisez{" "}
            <Link href="/forgot">Mot de passe oublié</Link> pour en recevoir un par email.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card card-narrow">
        <h1>Définir le mot de passe</h1>
        <form onSubmit={onSubmit}>
          <label htmlFor="password">Nouveau mot de passe</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <label htmlFor="confirm">Confirmer</label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          <p className="muted" style={{ marginTop: 4 }}>
            Min. 8 caractères, 3 classes parmi maj/min/chiffre/spécial.
          </p>
          <button type="submit" disabled={pending}>
            {pending ? "Enregistrement..." : "Valider"}
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      </div>
    </div>
  );
}
