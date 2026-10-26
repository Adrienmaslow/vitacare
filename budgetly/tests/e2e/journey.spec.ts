import { expect, test } from "@playwright/test";
import path from "node:path";
import { enterDemo, kpiValue } from "./helpers";

test.describe("Parcours BUDGETLY (mode démonstration)", () => {
  test("1. landing page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Prends le contrôle de ton argent");
    await expect(page.getByRole("link", { name: "Commencer gratuitement" })).toHaveAttribute("href", "/signup");
    await expect(page.getByRole("link", { name: "Essayer la démonstration" })).toBeVisible();
    await page.getByRole("tab", { name: /Plan d'action/ }).click();
    await expect(page.getByText(/Comparer tes 2 abonnements/)).toBeVisible();
  });

  test("2. connexion : formulaire, validation et route privée protégée", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/app/budgets");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
    await expect(page.getByLabel("E-mail")).toBeVisible();
    await expect(page.getByLabel("Mot de passe")).toBeVisible();
  });

  test("3-6. tableau de bord, création de compte, ajout d'opération et mise à jour des statistiques", async ({ page }) => {
    await enterDemo(page);
    await expect(page.getByText("Risque de fin de mois")).toBeVisible();
    await page.goto("/app/accounts");
    await page.getByRole("button", { name: "Compte" }).first().click();
    await page.getByLabel("Nom").fill("Compte Lydia");
    await page.getByLabel("Type").selectOption("wallet");
    await page.getByLabel("Solde initial").fill("15,50");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Compte Lydia")).toBeVisible();

    await page.goto("/app");
    const before = await kpiValue(page, "Dépenses du mois");
    const availBefore = await kpiValue(page, "Solde disponible");
    await page.getByRole("button", { name: "Opération" }).click();
    await page.getByLabel("Montant").fill("12,30");
    await page.getByLabel("Libellé").fill("CB CARREFOUR EXPRESS");
    await page.getByRole("button", { name: "Ajouter" }).click();
    await expect(page.getByText("Opération ajoutée")).toBeVisible();
    await expect.poll(() => kpiValue(page, "Dépenses du mois")).toBe(before + 1230);
    await expect.poll(() => kpiValue(page, "Solde disponible")).toBe(availBefore - 1230);
    await expect(page.getByText("CB CARREFOUR EXPRESS").first()).toBeVisible();
  });

  test("7. import CSV avec détection des colonnes et doublons", async ({ page }) => {
    await enterDemo(page);
    await page.goto("/app/import");
    await page.locator("#csv-file").setInputFiles(path.join(__dirname, "../../public/demo/releve-exemple.csv"));
    await expect(page.getByText(/lignes · séparateur « ; »/)).toBeVisible();
    await page.getByRole("button", { name: "Analyser les opérations" }).click();
    await expect(page.getByText("Vérifie avant d'importer")).toBeVisible();
    await expect(page.getByText("Répété dans le fichier")).toBeVisible();
    const btn = page.getByRole("button", { name: /Importer \d+ opération/ });
    const n = Number((await btn.innerText()).match(/\d+/)![0]);
    expect(n).toBeGreaterThan(5);
    await btn.click();
    await expect(page.getByRole("heading", { name: `${n} opération(s) importée(s)` })).toBeVisible();
    await page.getByRole("button", { name: "Annuler l'import" }).first().click();
    await expect(page.getByText(/retirée/)).toBeVisible();
  });

  test("8. création d'un budget", async ({ page }) => {
    await enterDemo(page);
    await page.goto("/app/budgets");
    await page.getByRole("button", { name: "Budget", exact: true }).click();
    await page.getByLabel("Catégorie").selectOption({ label: "Santé" });
    await page.getByLabel("Montant mensuel").fill("40");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByRole("heading", { name: "Santé" })).toBeVisible();
  });

  test("9. consultation des prévisions", async ({ page }) => {
    await enterDemo(page);
    await page.goto("/app/forecast");
    await expect(page.getByText("Risque de découvert")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Hypothèses utilisées" })).toBeVisible();
    await page.getByRole("tab", { name: "3 mois" }).click();
    await expect(page.locator("figure").first()).toBeVisible();
  });

  test("10-11. opportunités : exemples étiquetés et sauvegarde d'une mission", async ({ page }) => {
    await enterDemo(page);
    await page.goto("/app/earn");
    await expect(page.getByText("Exemples de démonstration :")).toBeVisible();
    const card = page.locator("div.rounded-\\[var\\(--radius-card\\)\\]").filter({ hasText: "Rédaction d'articles" }).first();
    await card.getByRole("button", { name: "Pourquoi ce score ?" }).click();
    await expect(card.getByText("Disponibilité", { exact: true })).toBeVisible();
    await card.getByRole("button", { name: "Sauvegarder" }).click();
    await expect(card.getByRole("button", { name: "Sauvegardée" })).toBeVisible();
    await page.getByRole("tab", { name: "Mes candidatures" }).click();
    await expect(page.getByText("Rédaction d'articles pour un blog (exemple)")).toBeVisible();
  });

  test("12. consultation des aides et suivi d'une démarche", async ({ page }) => {
    await enterDemo(page);
    await page.goto("/app/aids");
    await expect(page.getByText("ne sont jamais ajoutées à ton solde", { exact: false })).toBeVisible();
    await page.locator("div").filter({ hasText: /^Garantie Visale/ }).first();
    const card = page.locator("div.rounded-\\[var\\(--radius-card\\)\\]").filter({ hasText: "Garantie Visale" }).first();
    await card.getByRole("button", { name: "Conditions & suivi" }).click();
    await expect(page.getByText(/Estimation selon ton profil/)).toBeVisible();
    await page.getByRole("button", { name: "Suivre cette aide" }).click();
    await expect(page.getByText("Démarche mise à jour")).toBeVisible();
  });

  test("13. création d'un objectif", async ({ page }) => {
    await enterDemo(page);
    await page.goto("/app/goals");
    await page.getByRole("button", { name: "Objectif" }).first().click();
    await page.getByLabel("Nom").fill("Voyage à Lisbonne");
    await page.getByLabel("Montant cible").fill("600");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByRole("heading", { name: /Voyage à Lisbonne/ })).toBeVisible();
    await expect(page.getByText("Stratégies pour combler 600,00").first()).toBeVisible();
  });

  test("14. génération du plan d'action et suivi d'une action", async ({ page }) => {
    await enterDemo(page);
    await page.goto("/app/action-plan");
    await expect(page.getByText(/Limiter tes dépenses à .* par jour/)).toBeVisible();
    await page.getByRole("button", { name: "Pourquoi cette action ?" }).first().click();
    await expect(page.getByText("Urgence").first()).toBeVisible();
    await page.getByRole("button", { name: "Terminée" }).first().click();
    await page.getByLabel("Montant obtenu").fill("20");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.getByRole("tab", { name: "Résultats" }).click();
    await expect(page.getByText("Économies obtenues (déclarées)")).toBeVisible();
  });

  test("coach : réponse calculée avec faits et hypothèses", async ({ page }) => {
    await enterDemo(page);
    await page.goto("/app/coach");
    await page.getByRole("button", { name: "Est-ce que je peux acheter un ordinateur à 700 € ?" }).click();
    await expect(page.getByText(/pas recommandé ce mois-ci/)).toBeVisible();
    await expect(page.getByText("estimation").first()).toBeVisible();
  });

  test("simulateur : scénario fictif sans modification des données", async ({ page }) => {
    await enterDemo(page);
    await page.goto("/app/simulator");
    await page.getByRole("button", { name: "+200 €/mois" }).click();
    await expect(page.getByText("Variation mensuelle nette").locator("..").getByText("+200,00").first()).toBeVisible();
  });
});
