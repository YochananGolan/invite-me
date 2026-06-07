import { test, expect } from '@playwright/test';

const APP_URL = process.env.PLAYWRIGHT_APP_URL || 'http://localhost:3000';

test.use({
  viewport: { width: 390, height: 844 },
});

test('mobile modal headers do not render clipped glow artifacts', async ({ page }) => {
  await page.goto(`${APP_URL}/?open=features`, { waitUntil: 'domcontentloaded' });

  await expect(page.getByText('Meet-M — ניהול אירועים חכם')).toBeVisible({ timeout: 15000 });

  const visibleMobileGlowCount = await page
    .locator('.fixed.inset-0 .absolute.blur-3xl')
    .evaluateAll((nodes) =>
      nodes.filter((node) => {
        const styles = window.getComputedStyle(node);
        return styles.display !== 'none' && styles.visibility !== 'hidden' && Number(styles.opacity || '1') !== 0;
      }).length
    );

  expect(visibleMobileGlowCount).toBe(0);

  const headerBox = await page.getByText('Meet-M — ניהול אירועים חכם').boundingBox();
  expect(headerBox).not.toBeNull();
  expect(headerBox.width).toBeLessThanOrEqual(340);
});
