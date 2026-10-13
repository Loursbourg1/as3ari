import { expect, test, type Page } from '@playwright/test';

/**
 * End-to-end visitor journey. Runs against the production build served with the
 * production security headers (CSP). In demo mode (no Supabase configured) the
 * authenticated steps verify that contribution is blocked; with a live backend and
 * E2E_EMAIL / E2E_PASSWORD set, the "live contribution" suite exercises sign-in,
 * submission and moderation status for real.
 */

const FORBIDDEN = /add to cart|checkout|buy now|order history|shipping|panier|commander/i;

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/tile\.openstreetmap\.org/.test(m.text())) errors.push(m.text());
  });
  return errors;
}

test('visitor can discover prices, plan meals and is asked to sign in to contribute', async ({ page, isMobile }) => {
  const errors = collectErrors(page);

  // 1. Open As3ari without an account: the map is the primary interface.
  await page.goto('/');
  await expect(page.getByRole('region', { name: /map of shops/i }).first()).toBeVisible();
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await expect(page.getByText(/synthetic examples, not real observations/i)).toBeVisible();
  await expect(page.getByRole('combobox', { name: /search grocery products/i }).first()).toBeVisible();

  // 2. Search for a grocery product.
  const search = page.getByRole('combobox', { name: /search grocery products/i }).locator('visible=true').first();
  await search.fill('potatos'); // typo-tolerant
  await expect(page.getByRole('option', { name: /potatoes/i }).first()).toBeVisible();
  await search.press('Enter');

  // 3. View available price observations (dated, with units).
  const panel = page.getByTestId('product-panel');
  await expect(panel.getByRole('heading', { name: /potatoes/i })).toBeVisible();
  const rows = page.getByTestId('comparison-row');
  await expect(rows.first()).toBeVisible();
  await expect(rows.first()).toContainText(/DZD/);
  await expect(rows.first()).toContainText(/\/kg/);
  await expect(rows.first().locator('time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}$/);
  await expect(page.getByTestId('coverage-notice')).toContainText(/recent reports from \d+ shops|only one shop|old observations|no reported prices/i);

  // 4. Open the map view (mobile: bottom navigation keeps the product context).
  if (isMobile) {
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Map' }).click();
    await expect(page).toHaveURL(/\/map\?.*product=potatoes/);
  }
  const pins = page.locator('.as3-pin');
  await expect(pins.first()).toBeVisible();

  // 5. Select a physical shop or market on the map.
  await pins.first().click();
  const shopPanel = page.getByTestId('shop-panel');
  await expect(shopPanel).toBeVisible();
  await expect(shopPanel).toContainText(/potatoes at this location/i);
  await expect(shopPanel).toContainText(/not official shop prices/i);

  // 6. Compare available recent prices (back to the comparison, sort by recency).
  await shopPanel.getByRole('button', { name: 'Back' }).click();
  await page.getByLabel('Sort by').selectOption('freshness');
  await expect(rows.first()).toBeVisible();
  // Accessible list alternative to the map.
  await page.getByRole('button', { name: 'List' }).click();
  await expect(page.getByTestId('shop-list-view')).toBeVisible();

  // No ecommerce anywhere on the discovery screen.
  expect(await page.locator('body').innerText()).not.toMatch(FORBIDDEN);

  // 7. Open the meal planner.
  if (isMobile) await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Meal plan' }).click();
  else await page.getByRole('link', { name: 'Meal plan' }).first().click();
  await expect(page.getByRole('heading', { name: 'Weekly meal plan' })).toBeVisible();

  // 8. Household size, budget and pantry ingredients.
  await page.getByLabel('People in household').fill('3');
  await page.getByLabel('Weekly food budget (DZD)').fill('8000');
  await page.getByRole('button', { name: 'Add ingredient' }).click();
  await page.getByLabel('Ingredient').first().selectOption('lentils');
  await page.getByLabel('Quantity').first().fill('1');
  await page.getByLabel('No red meat').check();

  // 9. Generate a seven-day meal plan.
  await page.getByRole('button', { name: 'Generate 7-day plan' }).click();
  await expect(page.getByTestId('plan-result')).toBeVisible();
  await expect(page.getByTestId('plan-day')).toHaveCount(7);
  await expect(page.getByTestId('plan-total')).toContainText(/DZD/);
  await expect(page.getByTestId('plan-status')).toBeVisible();
  const planText = await page.getByTestId('plan-result').innerText();
  expect(planText).not.toMatch(/Lamb|Minced beef/); // exclusion respected

  // 10. Inspect the informational shopping list.
  await page.getByTestId('open-list').click();
  await expect(page.getByRole('heading', { name: 'Shopping checklist' })).toBeVisible();
  await expect(page.getByText(/does not sell anything/i).first()).toBeVisible();
  const listRows = page.getByTestId('list-row');
  await expect(listRows.first()).toBeVisible();
  const before = await page.getByTestId('list-total').innerText();
  await listRows.first().getByRole('checkbox').check();
  await expect(page.getByTestId('list-total')).not.toHaveText(before);
  expect(await page.locator('body').innerText()).not.toMatch(FORBIDDEN);

  // 11. Attempt to submit a price.
  await page.goto('/contribute?product=potatoes');

  // 12–15 (demo mode): no backend, so contribution is unavailable rather than simulated.
  await expect(page.getByTestId('contribute-unavailable')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit report' })).toHaveCount(0);
  await page.goto('/signin');
  await expect(page.getByTestId('auth-unavailable')).toBeVisible();
  await page.goto('/moderate');
  await expect(page.getByText(/accounts are unavailable/i)).toBeVisible();

  expect(errors.filter((e) => /Content Security Policy|Refused to/i.test(e))).toEqual([]);
  expect(errors).toEqual([]);
});

test('explore deep links, RTL Arabic and empty areas behave honestly', async ({ page }) => {
  // Arabic switches the document to RTL.
  await page.goto('/');
  await page.getByRole('button', { name: 'Account' }).click();
  await page.getByRole('button', { name: 'العربية' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  // The menu stays open after switching language.
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

  // A wilaya without data shows an honest empty state, not invented markers.
  await page.getByRole('button', { name: /Area:/ }).click();
  await page.getByLabel('Search wilayas').fill('Oran');
  await page.getByRole('button', { name: /Oran/ }).click();
  await expect(page.getByTestId('empty-area')).toBeVisible();
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(0);
});

const LIVE = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);

test.describe('live contribution (requires a configured Supabase test project)', () => {
  test.skip(!LIVE, 'Set E2E_BASE_URL, E2E_EMAIL and E2E_PASSWORD (verified test user) to run against a live backend.');

  test('authenticated user submits a valid observation that stays pending and private', async ({ page }) => {
    await page.goto('/contribute');
    await expect(page).toHaveURL(/\/signin\?next=/);
    await page.getByLabel('Email').fill(process.env.E2E_EMAIL!);
    await page.getByLabel('Password').fill(process.env.E2E_PASSWORD!);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('heading', { name: 'Report a price you saw' })).toBeVisible();

    await page.getByLabel('Product').selectOption('onions');
    await page.getByLabel('Shop or market').selectOption({ index: 1 });
    await page.getByLabel('Price paid or displayed (DZD)').fill(String(60 + Math.floor(Math.random() * 30)));
    await page.getByLabel('Package size').fill('1');
    await page.getByRole('button', { name: 'Submit report' }).click();

    const result = page.getByTestId('contribute-success');
    const error = page.getByRole('alert');
    await expect(result.or(error)).toBeVisible();
    if (await result.isVisible()) {
      await expect(page.getByTestId('report-status')).toContainText('Pending review');
      await page.getByRole('link', { name: 'View my reports' }).click();
      await expect(page.getByTestId('my-report').first()).toContainText('Pending review');
    } else {
      // Re-running on the same day hits the duplicate guard — also a correct outcome.
      await expect(error).toContainText(/already reported|Too many reports/);
    }

    // Ordinary users cannot moderate.
    await page.goto('/moderate');
    await expect(page.getByText('This page is only available to moderators.')).toBeVisible();
  });
});
