import { chromium, type FullConfig } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { ADMIN_EMAIL, signInWithEmulatorPopup } from '../e2e/support/auth';
import { ADMIN_ME, fakeApi } from './support/api';

export const API_ADMIN_STATE = 'e2e-api/.auth/admin.json';

// 관리자 로그인 상태를 한 번 만들어 둔다 — 서버(가짜)가 관리자라고 답하게 하고 로그인해 그 상태를 파일로 저장한다.
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL!;
  mkdirSync('e2e-api/.auth', { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });
  const api = await fakeApi(page);
  api.on('GET /v2/admin/admins/me', ADMIN_ME);
  await page.goto('/admin/');
  await signInWithEmulatorPopup(page, ADMIN_EMAIL);
  await page.getByRole('navigation').waitFor();
  await page.context().storageState({ path: API_ADMIN_STATE, indexedDB: true });
  await browser.close();
}
