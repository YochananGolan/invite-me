const { test, expect } = require('@playwright/test');

test.describe('mobile smoke', () => {
  test('homepage loads on mobile viewport', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Meet-M/i);
  });

  test('mobile bottom navigation is visible', async ({ page }) => {
    await page.goto('/');
    const mobileNav = page.getByRole('navigation', { name: 'ניווט תחתון' });
    await expect(mobileNav).toBeVisible();
  });

  test('desktop-only dashboard chart stays hidden on mobile', async ({ page }) => {
    await page.goto('/');
    const desktopChart = page.locator('[data-testid="desktop-guest-summary-chart"]');
    await expect(desktopChart).toBeHidden();
  });
});
