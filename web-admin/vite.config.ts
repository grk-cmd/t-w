/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const DEV_PROJECT = 'together-working-dev';

// 앱은 Firebase 설정을 Hosting 예약 주소(/__/firebase/init.json)에서 받는다 — 설정값을 저장소에 두지 않기 위해서다.
// 개발 서버에는 그 주소가 없으므로 로그인된 Firebase CLI 로 dev 설정을 받아 대신 돌려준다. 로컬은 항상 dev 에 붙는다.
function devFirebaseConfig(): Plugin {
  let cached: string | null = null;
  const load = () => {
    const out = execFileSync('firebase', ['apps:sdkconfig', 'WEB', '--project', DEV_PROJECT, '--json'], {
      encoding: 'utf8',
    });
    return JSON.stringify(JSON.parse(out).result.sdkConfig);
  };

  return {
    name: 'dev-firebase-config',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__/firebase/init.json', (_req, res) => {
        try {
          cached ??= load();
          res.setHeader('Content-Type', 'application/json');
          res.end(cached);
        } catch {
          res.statusCode = 500;
          res.end('firebase CLI 로 dev 설정을 받지 못했어요 — firebase login 이 되어 있는지 확인해 주세요');
        }
      });
    },
  };
}

export default defineConfig({
  base: '/admin/',
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [react(), devFirebaseConfig()],
  build: {
    outDir: '../hosting/admin',
    emptyOutDir: true,
  },
  test: {
    include: ['tests/**/*.test.ts'], // e2e/ 는 Playwright 가 돌린다
    environment: 'node',
  },
});
