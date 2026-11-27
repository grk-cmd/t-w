import { test as base, expect } from '@playwright/test';
import { ADMIN_ME, fakeApi, NOT_ADMIN, type FakeApi } from './support/api';

export { expect };

const ME = 'GET /v2/admin/admins/me';

// API 판 e2e — 서버(가짜)가 «관리자인가» 를 답한다. 로그인만 Firebase Auth 에뮬레이터다.
export const test = base.extend<{
  /** 서버를 대신하는 가짜 API — 길마다 `api.on(...)` 으로 답을 정하고 `api.requests` 로 받은 요청을 본다. */
  api: FakeApi;
  /** `false` 면 관리자 확인이 403 — «관리자 계정이 아니에요» 화면. */
  asAdmin: boolean;
}>({
  asAdmin: [true, { option: true }],
  api: async ({ page, asAdmin }, provide) => {
    const api = await fakeApi(page);
    api.on(ME, asAdmin ? ADMIN_ME : NOT_ADMIN);
    await provide(api);
  },
});
