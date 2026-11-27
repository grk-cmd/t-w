import { defineConfig } from '@playwright/test';

const PORT = 5175;

// API 판 e2e — 로그인은 Firebase Auth 에뮬레이터, 서버는 시험이 대신 답한다(e2e-api/support/api.ts).
// `npm run e2e:api` 가 firebase emulators:exec 로 감싸 준다.
export default defineConfig({
  testDir: 'e2e-api',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  globalSetup: './e2e-api/global-setup.ts',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    storageState: 'e2e-api/.auth/admin.json',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npx vite --mode api --port ${PORT} --strictPort --host 127.0.0.1`,
    env: { VITE_E2E: '1' },
    url: `http://127.0.0.1:${PORT}/admin/`,
    reuseExistingServer: false,
  },
});
