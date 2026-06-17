const { test, expect } = require('@playwright/test');

test.describe('desktop smoke', () => {
  test('homepage loads on desktop viewport', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Meet-M/i);
  });

  test('mobile bottom navigation is hidden on desktop', async ({ page }) => {
    await page.goto('/');
    const mobileNav = page.getByRole('navigation', { name: 'ניווט תחתון' });
    await expect(mobileNav).toBeHidden();
  });

  test('mobile-only edit toggle is not shown on desktop', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('לשינוי פרטי אירוע ועיצוב לחץ כאן.')).toHaveCount(0);
  });
});
