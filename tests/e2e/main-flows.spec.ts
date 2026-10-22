import { expect, test, type Page } from '@playwright/test';

/** Navigation via le routeur à hachage (compatible GitHub Pages). */
const go = (page: Page, path: string) => page.goto(`./#${path}`);

test.describe('Parcours principaux', () => {
  test('1. premier lancement : état initial cohérent, aucune statistique inventée', async ({
    page,
  }) => {
    await go(page, '/dashboard');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Bonjour|Bonsoir/);
    await expect(page.getByText('Comment fonctionne ECE STUDY')).toBeVisible();
    await expect(page.getByText('0/21').first()).toBeVisible();
    await expect(page.getByText('Faire le test diagnostic du cours 0')).toBeVisible();
    await go(page, '/statistiques');
    await expect(page.getByText('Pas encore de données')).toBeVisible();
  });

  test('2–3. choisir un chapitre puis lire une leçon jusqu’au bout', async ({ page }) => {
    await go(page, '/chapitres');
    await page
      .getByRole('link', { name: /Ouvrir le chapitre/ })
      .nth(1)
      .click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Conducteurs et composants' }),
    ).toBeVisible();
    await page.getByRole('link', { name: /Résistance, résistivité et géométrie/ }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: /Résistance, résistivité/ }),
    ).toBeVisible();
    await expect(page.locator('.katex').first()).toBeVisible();
    await page.getByRole('button', { name: 'J’ai terminé la leçon' }).click();
    await expect(
      page.getByRole('heading', { name: 'Vérification : QCM de la leçon' }),
    ).toBeVisible();
  });

  test('4. répondre à un QCM : correction immédiate et explication', async ({ page }) => {
    await go(page, '/qcm/session?mode=lecon&lesson=c0-l2');
    await expect(page.getByText(/1\/4/)).toBeVisible();
    // Les bonnes réponses ne sont jamais affichées avant validation.
    await expect(page.getByText('Réponse attendue')).toHaveCount(0);
    const radio = page.getByRole('radio').first();
    if (await radio.count()) await radio.check({ force: true });
    const text = page.getByRole('textbox');
    if (await text.count()) await text.fill('2 V');
    await page.getByRole('button', { name: 'Valider' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: /Correct|Pas tout à fait|Partiellement/ }),
    ).toBeVisible();
    await page.getByRole('button', { name: /Question suivante|Voir le bilan/ }).click();
  });

  test('5–7. exercice de TD : indices progressifs, réponse avec unité, correction', async ({
    page,
  }) => {
    await go(page, '/exercices/td1-ex1-2');
    await expect(page.getByRole('heading', { name: /Résistivité du cuivre/ })).toBeVisible();
    // Indices un par un
    await page.getByRole('button', { name: 'Je suis bloqué' }).click();
    await expect(page.getByText(/Indice 1 · Orientation/)).toBeVisible();
    await expect(page.getByText(/Indice 2/)).toHaveCount(0);
    await page.getByRole('button', { name: /Indice suivant \(2\/3\)/ }).click();
    await expect(page.getByText(/Indice 2 · Outil/)).toBeVisible();
    // Réponse juste avec une unité différente de celle attendue (µΩ·cm attendu)
    await page.getByRole('textbox', { name: /Ta réponse/ }).fill('1,845e-8 ohm.m');
    await page.getByRole('button', { name: 'Valider' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Correct' })).toBeVisible();
    // Correction détaillée
    await page.getByRole('button', { name: 'Voir la correction' }).first().click();
    await expect(page.getByRole('heading', { name: 'G. Correction détaillée' })).toBeVisible();
    // Question suivante : 0,26 Ω saisi en mΩ
    await page.getByRole('tab', { name: 'AD1.3' }).click();
    await page.getByRole('textbox', { name: /Ta réponse/ }).fill('260 mΩ');
    await page.getByRole('button', { name: 'Valider' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Correct' })).toBeVisible();
  });

  test('8–10. sauvegarde, rechargement et reprise de session', async ({ page }) => {
    await go(page, '/lecons/c0-l0');
    await page.getByRole('button', { name: 'J’ai terminé la leçon' }).click();
    await go(page, '/exercices/td1-ex1-3');
    await page.getByRole('textbox', { name: /Ta réponse/ }).fill('12 m/s');
    await page.getByRole('button', { name: 'Valider' }).click();
    await expect(page.getByText('Pas tout à fait')).toBeVisible();

    await page.reload();
    await go(page, '/dashboard');
    await expect(page.getByText('1/21').first()).toBeVisible();
    await expect(
      page
        .getByRole('button', { name: 'Continuer' })
        .or(page.getByRole('link', { name: 'Continuer' })),
    ).toBeVisible();
    await go(page, '/erreurs');
    await expect(page.getByText('TD1 · Ex. 1.3 · AD1.4').first()).toBeVisible();
    await go(page, '/parcours');
    await expect(page.getByText('Recommandé', { exact: true })).toBeVisible();
  });
});

test.describe('Autres fonctionnalités', () => {
  test('flashcards : retourner et noter une carte', async ({ page }) => {
    await go(page, '/flashcards');
    await page.getByRole('button', { name: 'Commencer la session' }).click();
    await page.getByRole('button', { name: /Retourner la carte/ }).click();
    await page.getByRole('button', { name: /^Facile/ }).click();
    await expect(page.getByText(/1 révisée/)).toBeVisible();
  });

  test('examen : chronomètre, rendu de copie, note sur 20', async ({ page }) => {
    await go(page, '/examen');
    await page.getByRole('radio', { name: '10' }).click();
    await page.getByRole('button', { name: 'Commencer l’examen' }).click();
    await expect(page.getByRole('timer')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Explique-moi' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Rendre', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Rendre' }).click();
    await expect(page.getByRole('heading', { name: 'Bilan de l’examen' })).toBeVisible();
    await expect(page.getByText('/20')).toBeVisible();
  });

  test('paramètres : thème sombre persistant et export disponible', async ({ page }) => {
    await go(page, '/parametres');
    await page.getByRole('radio', { name: 'Sombre' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exporter (JSON)' }).click();
    expect((await download).suggestedFilename()).toMatch(/^ece-study-sauvegarde-.*\.json$/);
  });

  test('page inconnue et rafraîchissement d’une page interne', async ({ page }) => {
    await go(page, '/formules');
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Formules' })).toBeVisible();
    await go(page, '/nimporte-quoi');
    await expect(page.getByText('Page introuvable')).toBeVisible();
  });

  test('pas de débordement horizontal (responsive)', async ({ page }) => {
    for (const p of [
      '/dashboard',
      '/lecons/c2-l9',
      '/exercices/td2-ex2-5',
      '/formules',
      '/statistiques',
    ]) {
      await go(page, p);
      await page.waitForTimeout(300);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, p).toBeLessThanOrEqual(1);
    }
  });

  test('PWA : manifeste valide et service worker', async ({ page, request }) => {
    const res = await request.get('manifest.webmanifest');
    expect(res.ok()).toBe(true);
    const m = await res.json();
    expect(m.short_name).toBe('ECE STUDY');
    expect(m.display).toBe('standalone');
    expect(m.icons.map((i: { sizes: string }) => i.sizes)).toEqual(
      expect.arrayContaining(['192x192', '512x512']),
    );
    expect(m.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
    await go(page, '/dashboard');
    const sw = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return !!reg.active;
    });
    expect(sw).toBe(true);
  });
});
