const { test, expect } = require('@playwright/test');

test.describe('mobile guest flows', () => {
  test('quick guests card stays hidden without an active session', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('mobile-quick-guests')).toBeHidden();
    await expect(page.getByTestId('mobile-guest-search-frame')).toBeHidden();
    await expect(page.getByTestId('mobile-guest-filter-frame')).toBeHidden();
  });

  test('mobile quick guests uses a single section title when visible', async ({ page }) => {
    await page.goto('/');
    const quickGuests = page.getByTestId('mobile-quick-guests');
    if (!(await quickGuests.isVisible())) {
      test.skip(true, 'Requires logged-in user with an active event and invited guests');
    }

    await expect(page.getByTestId('mobile-guest-section-title')).toHaveText('צפיה וחיפוש ברשימות אורחים');
    await expect(page.getByTestId('mobile-guest-search-frame').getByText('חיפוש אורח', { exact: true })).toHaveCount(0);
    await expect(page.getByTestId('mobile-guest-filter-frame').getByText('סינון וצפייה ברשימה', { exact: true })).toHaveCount(0);
  });

  test('filter pill updates guest list button label when visible', async ({ page }) => {
    await page.goto('/');
    const quickGuests = page.getByTestId('mobile-quick-guests');
    if (!(await quickGuests.isVisible())) {
      test.skip(true, 'Requires logged-in user with an active event and invited guests');
    }

    await page.getByTestId('mobile-guest-filter-pill-approved').click();
    await expect(page.getByTestId('mobile-open-guest-list')).toContainText('ראה רשימת אורחים : אישרו הגעה');

    await page.getByTestId('mobile-open-guest-list').click();
    await expect(page.getByTestId('mobile-guest-list-screen')).toBeVisible();
    await page.getByTestId('mobile-guest-list-screen-close').click();
    await expect(page.getByTestId('mobile-guest-list-screen')).toBeHidden();
  });

  test('search submit opens results overlay when visible', async ({ page }) => {
    await page.goto('/');
    const quickGuests = page.getByTestId('mobile-quick-guests');
    if (!(await quickGuests.isVisible())) {
      test.skip(true, 'Requires logged-in user with an active event and invited guests');
    }

    await page.locator('#mobile-quick-guest-search').fill('א');
    await page.getByTestId('mobile-guest-search-submit').click();
    await expect(page.getByText('תוצאות חיפוש')).toBeVisible();
  });
});
