import { test as base, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { ADMIN_UID_FILE } from './support/auth';
import { resetDb } from './support/emulator';

// 테스트마다: DB 를 비우고(관리자 등록 + seed) 시작하고, 확인창(confirm)은 «확인» 으로 넘긴다.
export const test = base.extend<{ seed: (data?: Record<string, unknown>) => Promise<void> }>({
  page: async ({ page }, provide) => {
    page.on('dialog', (dialog) => dialog.accept());
    await provide(page);
  },
  seed: async ({}, provide) => {
    const uid = readFileSync(ADMIN_UID_FILE, 'utf8').trim();
    await provide((data = {}) => resetDb(uid, data));
  },
});

export { expect };
