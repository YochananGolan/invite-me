const { test, expect } = require('@playwright/test');
const {
  hasMobileAuthCredentials,
  loginMobileTestUser,
  ensureQuickGuestsVisible,
} = require('./helpers/mobile-e2e-auth');

test.describe('mobile guest flows (anonymous)', () => {
  test('quick guests card stays hidden without an active session', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('mobile-quick-guests')).toBeHidden();
    await expect(page.getByTestId('mobile-guest-search-frame')).toBeHidden();
    await expect(page.getByTestId('mobile-guest-filter-frame')).toBeHidden();
  });
});

test.describe('mobile guest flows (authenticated)', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    testInfo.skip(!hasMobileAuthCredentials(), 'Set E2E_MOBILE_EMAIL and E2E_MOBILE_PASSWORD');

    const loggedIn = await loginMobileTestUser(page);
    testInfo.skip(!loggedIn, 'Mobile test login failed');

    await ensureQuickGuestsVisible(page);
  });

  test('uses a single section title without duplicate frame headers', async ({ page }) => {
    await expect(page.getByTestId('mobile-guest-section-title')).toHaveText('צפיה וחיפוש ברשימות אורחים');
    await expect(page.getByTestId('mobile-guest-search-frame').getByText('חיפוש אורח', { exact: true })).toHaveCount(0);
    await expect(page.getByTestId('mobile-guest-filter-frame').getByText('סינון וצפייה ברשימה', { exact: true })).toHaveCount(0);
  });

  test('filter pill updates guest list button then opens and closes list screen', async ({ page }) => {
    await page.getByTestId('mobile-guest-filter-pill-approved').click();
    await expect(page.getByTestId('mobile-open-guest-list')).toContainText('ראה רשימת אורחים : אישרו הגעה');

    await page.getByTestId('mobile-open-guest-list').click();
    await expect(page.getByTestId('mobile-guest-list-screen')).toBeVisible();
    await page.getByTestId('mobile-guest-list-screen-close').click();
    await expect(page.getByTestId('mobile-guest-list-screen')).toBeHidden();
  });

  test('search submit opens results overlay and back returns to quick guests', async ({ page }) => {
    await page.locator('#mobile-quick-guest-search').fill('א');
    await page.getByTestId('mobile-guest-search-submit').click();
    await expect(page.getByTestId('mobile-guest-search-screen')).toBeVisible();
    await page.getByTestId('mobile-guest-search-back').click();
    await expect(page.getByTestId('mobile-guest-search-screen')).toBeHidden();
    await expect(page.getByTestId('mobile-quick-guests')).toBeVisible();
  });
});
