"use client";
import Link from "next/link";
import { useState } from "react";
import { AuthCard, ConfigMissing } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { Notice } from "@/components/ui/misc";
import { authErrorMessage } from "@/lib/auth-errors";
import { getBrowserSupabase } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = getBrowserSupabase();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  return (
    <AuthCard title="Mot de passe oublié" subtitle="Indique ton e-mail : tu recevras un lien de réinitialisation." footer={<Link href="/login" className="font-semibold text-brand">Retour à la connexion</Link>}>
      {!supabase ? <ConfigMissing /> : null}
      {state === "sent" ? (
        <Notice tone="positive">Si un compte existe pour <strong>{email}</strong>, un e-mail de réinitialisation vient d'être envoyé.</Notice>
      ) : (
        <form className="grid gap-4" onSubmit={async (e) => {
          e.preventDefault();
          if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Adresse e-mail invalide");
          setError(null);
          setState("sending");
          const { error: err } = await supabase!.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/callback?next=/reset-password` });
          // Réponse identique que le compte existe ou non (pas d'énumération d'utilisateurs).
          if (err && !/user/i.test(err.message)) { setState("idle"); return setError(authErrorMessage(err.message)); }
          setState("sent");
        }}>
          <Field label="E-mail" htmlFor="email" error={error ?? undefined}><Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!supabase} /></Field>
          <Button type="submit" size="lg" disabled={state === "sending" || !supabase}>Envoyer le lien</Button>
        </form>
      )}
    </AuthCard>
  );
}
