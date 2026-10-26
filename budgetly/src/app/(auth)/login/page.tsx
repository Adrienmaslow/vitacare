"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthCard, ConfigMissing } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { Notice } from "@/components/ui/misc";
import { authErrorMessage } from "@/lib/auth-errors";
import { setDemoCookie } from "@/lib/ops/client";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { GoogleButton } from "@/components/auth/google-button";

const schema = z.object({ email: z.string().trim().email("Adresse e-mail invalide"), password: z.string().min(1, "Mot de passe requis") });

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = getBrowserSupabase();
  const [error, setError] = useState<string | null>(params.get("error") === "lien" ? "Ce lien de connexion n'est plus valide. Demande-en un nouveau." : null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const next = params.get("next")?.startsWith("/app") ? params.get("next")! : "/app";

  const onSubmit = async (v: z.infer<typeof schema>) => {
    setError(null);
    const { error: e } = await supabase!.auth.signInWithPassword(v);
    if (e) return setError(authErrorMessage(e.message));
    setDemoCookie(false);
    router.replace(next);
    router.refresh();
  };

  return (
    <AuthCard title="Connexion" subtitle="Heureux de te revoir !" footer={<>Pas encore de compte ? <Link href="/signup" className="font-semibold text-brand">Créer un compte</Link></>}>
      {!supabase ? <ConfigMissing /> : null}
      {params.get("verified") ? <Notice tone="positive" className="mb-4">Adresse vérifiée : tu peux te connecter.</Notice> : null}
      {error ? <div role="alert" className="mb-4 rounded-xl bg-danger-soft p-3 text-sm text-danger">{error}</div> : null}
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
        <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} disabled={!supabase} />
        </Field>
        <Field label="Mot de passe" htmlFor="password" error={errors.password?.message}>
          <Input id="password" type="password" autoComplete="current-password" aria-invalid={!!errors.password} {...register("password")} disabled={!supabase} />
        </Field>
        <div className="-mt-2 text-right"><Link href="/forgot-password" className="text-sm font-medium text-brand">Mot de passe oublié ?</Link></div>
        <Button type="submit" size="lg" disabled={isSubmitting || !supabase}>{isSubmitting ? "Connexion…" : "Se connecter"}</Button>
      </form>
      <GoogleButton next={next} />
      <Button variant="outline" size="lg" className="mt-3 w-full" asChild><Link href="/demo">Essayer la démonstration</Link></Button>
    </AuthCard>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
