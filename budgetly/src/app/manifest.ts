import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BUDGETLY — Ton argent. Tes opportunités. Ton avenir.",
    short_name: "BUDGETLY",
    description: "Budget, prévisions, aides, bons plans et revenus complémentaires pour étudiants et jeunes actifs.",
    lang: "fr",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#0B1220",
    theme_color: "#7357F6",
    categories: ["finance", "education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Ajouter une opération", short_name: "Opération", url: "/app/transactions", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Mon plan d'action", short_name: "Plan", url: "/app/action-plan", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Prévisions", short_name: "Prévisions", url: "/app/forecast", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Coach", short_name: "Coach", url: "/app/coach", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
