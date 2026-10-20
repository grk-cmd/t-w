import { chromium, type FullConfig } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { ADMIN_EMAIL, ADMIN_STATE, ADMIN_UID_FILE, signInWithEmulatorPopup } from './support/auth';
import { resetDb } from './support/emulator';

// 관리자 로그인 상태를 한 번 만들어 둔다: 처음 로그인은 «관리자가 아님» 으로 막히며 uid 를 보여 준다 →
// 그 uid 를 admins 에 넣고 다시 로그인 → 로그인 상태(IndexedDB 포함)를 파일로 저장해 모든 테스트가 쓴다.
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL!;
  mkdirSync('e2e/.auth', { recursive: true });
  await resetDb('nobody');

  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });
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

  await signInWithEmulatorPopup(page, ADMIN_EMAIL);
  await page.getByRole('button', { name: '로그아웃' }).waitFor();
  await page.context().storageState({ path: ADMIN_STATE, indexedDB: true });
  await browser.close();
}
