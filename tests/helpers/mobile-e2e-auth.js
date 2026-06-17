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

module.exports = {
  AUTH_STATE_PATH,
  hasMobileAuthCredentials,
  loginMobileTestUser,
  ensureQuickGuestsVisible,
  saveMobileAuthState,
};
