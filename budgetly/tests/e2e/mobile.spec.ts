import { expect, test } from "@playwright/test";
import { enterDemo } from "./helpers";

test("navigation mobile et PWA", async ({ page, request }) => {
  await enterDemo(page);
  const nav = page.getByRole("navigation", { name: "Navigation mobile" });
  await expect(nav).toBeVisible();
  await nav.getByRole("link", { name: "Opportunités" }).click();
  await expect(page.getByRole("heading", { name: "Opportunités" })).toBeVisible();
  await nav.getByRole("link", { name: "Profil" }).click();
  await page.getByRole("link", { name: "Plan d'action" }).click();
  await expect(page.getByRole("heading", { name: "Mon plan d'action" })).toBeVisible();
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
  expect((await request.get("/sw.js")).ok()).toBe(true);
  // Aucun défilement horizontal sur mobile.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
