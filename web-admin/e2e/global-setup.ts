import { chromium, type FullConfig } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { ADMIN_ME, fakeApi, NOT_ADMIN } from './support/api';
import { ADMIN_EMAIL, ADMIN_STATE, ADMIN_UID_FILE, signInWithEmulatorPopup } from './support/auth';
import { resetDb } from './support/emulator';

// 관리자 로그인 상태를 한 번 만들어 둔다: 처음 로그인은 «관리자가 아님»(가짜 서버의 403)으로 막히며 uid 를 보여 준다 →
// 그 uid 를 admins 에 넣고(옛 길의 규칙용) 서버가 관리자라고 답하게 한 뒤 다시 열기 → 로그인 상태(IndexedDB 포함)를 파일로 저장해 모든 테스트가 쓴다.
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL!;
  mkdirSync('e2e/.auth', { recursive: true });
  await resetDb('nobody');

  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });
  const api = await fakeApi(page);
  api.on('GET /v1/admin/admins/me', NOT_ADMIN);
  await page.goto('/admin/');
  await signInWithEmulatorPopup(page, ADMIN_EMAIL);

  const denied = page.getByText(/등록할 uid: /);
  await denied.waitFor().catch(async (e) => {
    await page.screenshot({ path: 'test-results/setup-fail.png' });
    console.log('PAGE TEXT:', (await page.locator('body').innerText()).slice(0, 800));
    throw e;
  });
  const uid = (await denied.textContent())!.match(/등록할 uid: (\S+)/)![1];
  writeFileSync(ADMIN_UID_FILE, uid);
  await resetDb(uid);

  // 관리자 확인은 서버(가짜)가 한다 — 같은 로그인으로 이번엔 관리자라고 답한다
  api.on('GET /v1/admin/admins/me', ADMIN_ME);
  await page.reload();
  await page.getByRole('navigation').waitFor();
  await page.context().storageState({ path: ADMIN_STATE, indexedDB: true });
  await browser.close();
}
