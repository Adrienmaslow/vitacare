"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthCard, ConfigMissing } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { authErrorMessage } from "@/lib/auth-errors";
import { getBrowserSupabase } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const supabase = getBrowserSupabase();
  const router = useRouter();
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <AuthCard title="Nouveau mot de passe" subtitle="Choisis un mot de passe d'au moins 10 caractères avec lettres et chiffres.">
      {!supabase ? <ConfigMissing /> : null}
      <form className="grid gap-4" onSubmit={async (e) => {
        e.preventDefault();
        if (pwd.length < 10 || !/[A-Za-z]/.test(pwd) || !/\d/.test(pwd)) return setError("Au moins 10 caractères, avec lettres et chiffres.");
        if (pwd !== confirm) return setError("Les mots de passe ne correspondent pas.");
        setBusy(true);
        const { error: err } = await supabase!.auth.updateUser({ password: pwd });
        setBusy(false);
        if (err) return setError(authErrorMessage(err.message));
        router.replace("/app");
      }}>
        {error ? <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{error}</p> : null}
        <Field label="Nouveau mot de passe" htmlFor="pwd"><Input id="pwd" type="password" autoComplete="new-password" value={pwd} onChange={(e) => setPwd(e.target.value)} /></Field>
        <Field label="Confirmation" htmlFor="confirm"><Input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
        <Button type="submit" size="lg" disabled={busy || !supabase}>Mettre à jour</Button>
      </form>
    </AuthCard>
  );
}
