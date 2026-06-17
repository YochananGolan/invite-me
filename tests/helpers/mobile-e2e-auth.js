const fs = require('fs');
const path = require('path');

const AUTH_STATE_PATH = path.join(__dirname, '..', '..', '.auth', 'mobile-user.json');

async function loginMobileTestUser(page) {
  const email = process.env.E2E_MOBILE_EMAIL;
  const password = process.env.E2E_MOBILE_PASSWORD;
  if (!email || !password) return false;

  await page.goto('/');
  await page.getByRole('button', { name: 'התחברות' }).click();
  await page.getByPlaceholder('הכנס אימייל').fill(email);
  await page.getByPlaceholder('הכנס סיסמה').fill(password);
  await page.getByRole('button', { name: 'התחבר' }).click();

  await page.waitForFunction(
    () => Boolean(localStorage.getItem('user_id')),
    null,
    { timeout: 20000 },
  );

  return true;
}

async function ensureQuickGuestsVisible(page, timeout = 45000) {
  await page.goto('/');
  await page.getByTestId('mobile-quick-guests').waitFor({ state: 'visible', timeout });
}

async function saveMobileAuthState(page) {
  const dir = path.dirname(AUTH_STATE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  await page.context().storageState({ path: AUTH_STATE_PATH });
  return AUTH_STATE_PATH;
}

function hasMobileAuthCredentials() {
  return Boolean(process.env.E2E_MOBILE_EMAIL && process.env.E2E_MOBILE_PASSWORD);
}

async function swipeGuestCardRight(cardLocator) {
  await cardLocator.evaluate((card) => {
    const surface = card.querySelector('.touch-pan-y');
    if (!surface) return;
    const rect = surface.getBoundingClientRect();
    const y = rect.top + rect.height / 2;
    const startX = rect.left + 12;
    const endX = rect.right - 12;

    const touch = (clientX) => new Touch({
      identifier: 1,
      target: surface,
      clientX,
      clientY: y,
      pageX: clientX,
      pageY: y,
      screenX: clientX,
      screenY: y,
    });

    surface.dispatchEvent(new TouchEvent('touchstart', {
      bubbles: true,
      cancelable: true,
      touches: [touch(startX)],
      targetTouches: [touch(startX)],
      changedTouches: [touch(startX)],
    }));
    surface.dispatchEvent(new TouchEvent('touchmove', {
      bubbles: true,
      cancelable: true,
      touches: [touch(endX)],
      targetTouches: [touch(endX)],
      changedTouches: [touch(endX)],
    }));
    surface.dispatchEvent(new TouchEvent('touchend', {
      bubbles: true,
      cancelable: true,
      touches: [],
      targetTouches: [],
      changedTouches: [touch(endX)],
    }));
  });
}

module.exports = {
  AUTH_STATE_PATH,
  hasMobileAuthCredentials,
  loginMobileTestUser,
  ensureQuickGuestsVisible,
  saveMobileAuthState,
  swipeGuestCardRight,
};
