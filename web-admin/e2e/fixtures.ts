import { test as base, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { ADMIN_UID_FILE } from './support/auth';
import { resetDb } from './support/emulator';

// 1×1 투명 PNG — 화면이 그리는 외부 그림 주소에 대신 돌려준다.
const BLANK_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

// 구글 로그인 팝업(signInWithPopup)이 에뮬레이터를 써도 gapi 스크립트는 여기서 받는다 — 막으면 auth/internal-error.
const ALLOWED_HOSTS = ['127.0.0.1', 'localhost', 'apis.google.com'];

/**
 * 브라우저가 에뮬레이터 · vite 밖으로 나가지 않게 막는다 — 그림 미리보기(배너 · 자리비움 그림)가
 * 실제 firebasestorage.googleapis.com 이나 외부 사이트를 부르지 않도록. 그림은 빈 PNG 로 대신한다.
 */
export async function stayLocal(page: Page) {
  await page.route(
    (url) => !ALLOWED_HOSTS.includes(url.hostname),
    (route) =>
      route.request().resourceType() === 'image'
        ? route.fulfill({ contentType: 'image/png', body: BLANK_PNG })
        : route.abort(),
  );
}

export const adminUid = () => readFileSync(ADMIN_UID_FILE, 'utf8').trim();

// 테스트마다: DB 를 비우고(관리자 등록 + seed) 시작하고, 확인창(confirm)은 «확인» 으로 넘긴다.
export const test = base.extend<{ seed: (data?: Record<string, unknown>) => Promise<void> }>({
  page: async ({ page }, provide) => {
    page.on('dialog', (dialog) => dialog.accept());
    await stayLocal(page);
    await provide(page);
  },
  // Playwright 는 픽스처 인자를 구조 분해로 읽어 의존성을 정한다 — 쓰는 픽스처가 없어도 {} 가 있어야 한다.
  // oxlint-disable-next-line no-empty-pattern
  seed: async ({}, provide) => {
    const uid = adminUid();
    await provide((data = {}) => resetDb(uid, data));
  },
});

export { expect };
