import type { Page } from '@playwright/test';

export const ADMIN_EMAIL = 'admin@e2e.test';
export const ADMIN_STATE = 'e2e/.auth/admin.json';
export const ADMIN_UID_FILE = 'e2e/.auth/admin-uid.txt';

/** 에뮬레이터의 구글 로그인 팝업에서 계정을 고른다 — 처음이면 만들고, 있으면 목록에서 누른다. */
export async function signInWithEmulatorPopup(page: Page, email: string) {
  const loginButton = page.getByRole('button', { name: '구글 계정으로 로그인' });
  const [popup] = await Promise.all([page.waitForEvent('popup'), loginButton.click()]);
  await popup.waitForLoadState();
  const existing = popup.getByText(email, { exact: true });
  if (await existing.isVisible().catch(() => false)) {
    await existing.click();
  } else {
    await popup.getByText('Add new account').click();
    await popup.locator('#email-input').fill(email);
    await popup.getByRole('button', { name: /sign in with/i }).click();
  }
  await popup.waitForEvent('close');
}
