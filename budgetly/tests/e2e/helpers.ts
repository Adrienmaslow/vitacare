import { expect, type Page } from "@playwright/test";

export async function enterDemo(page: Page) {
  await page.goto("/demo");
  await page.waitForURL("**/app");
  await expect(page.getByRole("heading", { name: /Bonjour/ })).toBeVisible();
}

/** Valeur numérique (centimes) d'un indicateur du tableau de bord. */
export async function kpiValue(page: Page, label: string): Promise<number> {
  const card = page.locator("section[aria-label='Indicateurs clés'] > div").filter({ hasText: label }).first();
  const text = (await card.locator("p.font-display").innerText()).replace(/\s| | |€/g, "");
  const neg = text.startsWith("-") || text.startsWith("−");
  const [i, d = "00"] = text.replace(/^[-−]/, "").split(",");
  return (neg ? -1 : 1) * (Number(i) * 100 + Number(d));
}
