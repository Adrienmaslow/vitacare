import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [".next/**", "node_modules/**", "playwright-report/**", "test-results/**", "public/sw.js", "next-env.d.ts"],
  },
  {
    rules: {
      // Interface en français : les apostrophes typographiques sont du texte normal, rendu sans risque par JSX.
      "react/no-unescaped-entities": "off",
      // Les formulaires d'édition s'initialisent à partir des données chargées : signalé en avertissement
      // (refactorisation possible en composants remontés par clé, voir docs/ROADMAP.md).
      "react-hooks/set-state-in-effect": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
];

export default config;
