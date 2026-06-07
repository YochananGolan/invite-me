import { test, expect } from '@playwright/test';

const APP_URL = process.env.PLAYWRIGHT_APP_URL || 'http://localhost:3000';

test.use({
  viewport: { width: 390, height: 844 },
});

test('payment popup opens without clipping the Tranzila iframe on mobile', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('user_id', 'payment-e2e-user');
    localStorage.setItem('user_email', 'payment-e2e@example.com');
  });

  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

  const createEventButton = page.locator('button').filter({ hasText: 'אירוע' }).first();
  await expect(createEventButton).toBeVisible({ timeout: 15000 });
  await createEventButton.click();

  const choosePlanButton = page.locator('button').filter({ hasText: 'בחר' }).first();
  await expect(choosePlanButton).toBeVisible({ timeout: 15000 });
  await choosePlanButton.click();

  const iframe = page.locator('iframe[name="tranzila-iframe"]');
  await expect(iframe).toBeVisible({ timeout: 15000 });

  const bodyOverflow = await page.locator('body').evaluate((body) => getComputedStyle(body).overflow);
  expect(bodyOverflow).toBe('hidden');

  const iframeBox = await iframe.boundingBox();
  expect(iframeBox).not.toBeNull();
  expect(iframeBox.height).toBeGreaterThanOrEqual(500);
  expect(iframeBox.width).toBeGreaterThanOrEqual(320);

  const modalMetrics = await page.locator('iframe[name="tranzila-iframe"]').evaluate((node) => {
    const modal = node.closest('.payment-modal-shell');
    const scrollHost = node.closest('.payment-modal-scroll');
    return {
      modalHeight: modal?.getBoundingClientRect().height ?? 0,
      scrollHeight: scrollHost?.scrollHeight ?? 0,
      clientHeight: scrollHost?.clientHeight ?? 0,
      iframeBottom: node.getBoundingClientRect().bottom,
      viewportHeight: window.innerHeight,
    };
  });

  expect(modalMetrics.modalHeight).toBeLessThanOrEqual(844);
  expect(modalMetrics.scrollHeight).toBeGreaterThanOrEqual(modalMetrics.clientHeight);
  expect(modalMetrics.iframeBottom).toBeGreaterThan(500);
});
