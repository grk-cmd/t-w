import { defineConfig } from '@playwright/test';

const PORT = 5174;

// 에뮬레이터 안에서 돈다 — `npm run e2e` 가 firebase emulators:exec 로 감싸 준다.
// 모든 테스트가 같은 에뮬레이터 DB 를 쓰므로 한 줄로(workers 1) 돌리고, 테스트마다 DB 를 비우고 시작한다.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    storageState: 'e2e/.auth/admin.json',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort --host 127.0.0.1`,
    env: { VITE_E2E: '1' },
    url: `http://127.0.0.1:${PORT}/admin/`,
    reuseExistingServer: false,
  },
});
