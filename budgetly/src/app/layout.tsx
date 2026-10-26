import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "BUDGETLY — Ton argent. Tes opportunités. Ton avenir.", template: "%s · BUDGETLY" },
  description: "BUDGETLY aide les étudiants et jeunes actifs à gérer leur budget, anticiper les fins de mois, découvrir les aides et trouver des revenus complémentaires.",
  applicationName: "BUDGETLY",
  keywords: ["budget étudiant", "gestion budget", "aides étudiantes", "job étudiant", "épargne", "prévisions financières"],
  openGraph: { title: "BUDGETLY", description: "Ton argent. Tes opportunités. Ton avenir.", type: "website", locale: "fr_FR" },
  appleWebApp: { capable: true, title: "BUDGETLY", statusBarStyle: "black-translucent" },
  icons: { icon: [{ url: "/icons/icon-192.png", sizes: "192x192" }, { url: "/icons/icon.svg", type: "image/svg+xml" }], apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#F8FAFC" }, { media: "(prefers-color-scheme: dark)", color: "#0B1220" }],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
