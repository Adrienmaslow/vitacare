import { expect, test } from "@playwright/test";

test("l'API des opérations refuse les appels non authentifiés", async ({ request }) => {
  const r = await request.post("/api/ops/accounts.list", { data: {} });
  expect([401, 503]).toContain(r.status());
  const body = await r.json();
  expect(body.ok).toBe(false);
  expect((await request.post("/api/ops/inexistante", { data: {} })).status()).toBe(404);
  expect((await request.get("/api/cron/alerts")).status()).toBe(401);
});

test("en-têtes de sécurité présents", async ({ request }) => {
  const r = await request.get("/");
  expect(r.headers()["x-frame-options"]).toBe("DENY");
  expect(r.headers()["x-content-type-options"]).toBe("nosniff");
});

test("structure accessible de la landing page", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  expect(await page.getByRole("heading", { level: 1 }).count()).toBe(1);
  const imgsWithoutAlt = await page.locator("img:not([alt])").count();
  expect(imgsWithoutAlt).toBe(0);
});
