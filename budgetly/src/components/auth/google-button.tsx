"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getBrowserSupabase } from "@/lib/supabase/client";

/** Connexion Google : affichée seulement si NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true (fournisseur activé dans Supabase). */
export function GoogleButton({ next = "/app" }: { next?: string }) {
  const [loading, setLoading] = useState(false);
  const supabase = getBrowserSupabase();
  if (process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED !== "true" || !supabase) return null;
  return (
    <Button variant="outline" size="lg" className="mt-3 w-full" disabled={loading} onClick={async () => {
      setLoading(true);
      await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` } });
    }}>
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.7 2.3 2.4 6.6 2.4 12s4.3 9.7 9.6 9.7c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z" /></svg>
      Continuer avec Google
    </Button>
  );
}
