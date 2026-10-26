/** Traduction des erreurs Supabase Auth en messages compréhensibles. */
export function authErrorMessage(message: string | undefined): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou mot de passe incorrect.";
  if (m.includes("email not confirmed")) return "Confirme d'abord ton adresse e-mail grâce au lien reçu.";
  if (m.includes("user already registered") || m.includes("already been registered")) return "Un compte existe déjà avec cet e-mail. Connecte-toi ou réinitialise ton mot de passe.";
  if (m.includes("password should be") || m.includes("weak password")) return "Mot de passe trop faible : au moins 10 caractères avec lettres et chiffres.";
  if (m.includes("rate limit") || m.includes("too many")) return "Trop de tentatives. Patiente quelques minutes avant de réessayer.";
  if (m.includes("same password") || m.includes("different from the old")) return "Le nouveau mot de passe doit être différent de l'ancien.";
  if (m.includes("expired") || m.includes("invalid") && m.includes("token")) return "Ce lien a expiré ou a déjà été utilisé. Demande-en un nouveau.";
  if (m.includes("fetch")) return "Connexion au service impossible. Vérifie ta connexion Internet.";
  return "Une erreur est survenue. Réessaie dans un instant.";
}
