"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthCard, ConfigMissing } from "@/components/auth/auth-card";
import { GoogleButton } from "@/components/auth/google-button";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { authErrorMessage } from "@/lib/auth-errors";
import { getBrowserSupabase } from "@/lib/supabase/client";

const schema = z.object({
  email: z.string().trim().email("Adresse e-mail invalide"),
  password: z.string().min(10, "Au moins 10 caractères").regex(/[A-Za-z]/, "Au moins une lettre").regex(/\d/, "Au moins un chiffre"),
  confirm: z.string(),
  terms: z.literal(true, { error: "Tu dois accepter la politique de confidentialité" }),
}).refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Les mots de passe ne correspondent pas" });

export default function SignupPage() {
  const supabase = getBrowserSupabase();
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  const onSubmit = async (v: z.infer<typeof schema>) => {
    setError(null);
    const { error: e } = await supabase!.auth.signUp({ email: v.email, password: v.password, options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/app/onboarding` } });
    if (e) return setError(authErrorMessage(e.message));
    setSent(v.email);
  };

  if (sent) {
    return (
      <AuthCard title="Vérifie ta boîte mail" footer={<Link href="/login" className="font-semibold text-brand">Aller à la connexion</Link>}>
        <div className="flex gap-3 rounded-2xl bg-positive-soft p-4 text-sm"><MailCheck className="size-5 shrink-0 text-positive" /><p>Un lien de confirmation a été envoyé à <strong>{sent}</strong>. Clique dessus pour activer ton compte, puis personnalise ton espace.</p></div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Créer ton compte" subtitle="Gratuit, sans carte bancaire, sans connexion bancaire obligatoire." footer={<>Déjà inscrit ? <Link href="/login" className="font-semibold text-brand">Se connecter</Link></>}>
      {!supabase ? <ConfigMissing /> : null}
      {error ? <div role="alert" className="mb-4 rounded-xl bg-danger-soft p-3 text-sm text-danger">{error}</div> : null}
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
        <Field label="E-mail" htmlFor="email" error={errors.email?.message}><Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} disabled={!supabase} /></Field>
        <Field label="Mot de passe" htmlFor="password" error={errors.password?.message} hint="10 caractères minimum, avec lettres et chiffres."><Input id="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register("password")} disabled={!supabase} /></Field>
        <Field label="Confirmer le mot de passe" htmlFor="confirm" error={errors.confirm?.message}><Input id="confirm" type="password" autoComplete="new-password" aria-invalid={!!errors.confirm} {...register("confirm")} disabled={!supabase} /></Field>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1 size-4 accent-[#7357F6]" {...register("terms")} disabled={!supabase} />
          <span>J'ai lu la <Link href="/privacy" className="font-semibold text-brand" target="_blank">politique de confidentialité</Link>. Mes données ne sont ni vendues ni partagées à des fins publicitaires.</span>
        </label>
        {errors.terms ? <p role="alert" className="-mt-2 text-xs font-medium text-danger">{errors.terms.message}</p> : null}
        <Button type="submit" size="lg" disabled={isSubmitting || !supabase}>{isSubmitting ? "Création…" : "Créer mon compte"}</Button>
      </form>
      <GoogleButton next="/app/onboarding" />
    </AuthCard>
  );
}
