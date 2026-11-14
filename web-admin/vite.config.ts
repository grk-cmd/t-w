/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';

const DEV_PROJECT = 'together-working-dev';

// 두 판 가운데 하나를 빌드 때 고른다 — 값이 없거나 다른 글자면 빌드가 멈춘다. 모드 파일(.env.firebase · .env.api · .env.development · .env.test)이나 셸 값으로 준다.
function adminBackend(mode: string) {
  const raw = loadEnv(mode, process.cwd(), 'VITE_').VITE_ADMIN_BACKEND;
  if (raw !== 'firebase' && raw !== 'api') {
    throw new Error(
      `VITE_ADMIN_BACKEND 는 'firebase' 또는 'api' 여야 해요 (지금: ${raw || '없음'}) — npm run build:firebase · build:api 로 빌드해요`,
    );
  }
  return raw;
}

function buildCommit() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

// 앱은 Firebase 설정을 Hosting 예약 주소(/__/firebase/init.json)에서 받는다 — 설정값을 저장소에 두지 않기 위해서다.
// 개발 서버에는 그 주소가 없으므로 로그인된 Firebase CLI 로 dev 설정을 받아 대신 돌려준다. 로컬은 항상 dev 에 붙는다.
function devFirebaseConfig(): Plugin {
  let cached: string | null = null;
  const load = () => {
    // 셸로 부른다 — Windows 의 firebase 는 firebase.cmd 라 셸 없이는 못 찾는다. 명령은 고정 글자뿐이다
    const out = execSync(`firebase apps:sdkconfig WEB --project ${DEV_PROJECT} --json`, { encoding: 'utf8' });
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

export default defineConfig(({ mode }) => {
  adminBackend(mode);
  return {
    base: '/admin/',
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    define: { __ADMIN_BUILD_COMMIT__: JSON.stringify(buildCommit()) },
    plugins: [react(), devFirebaseConfig()],
    build: {
      outDir: '../hosting/admin',
      emptyOutDir: true,
    },
    test: {
      include: ['tests/**/*.test.ts'], // e2e/ 는 Playwright 가 돌린다
      environment: 'node',
    },
  };
});
