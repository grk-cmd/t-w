/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const TOKENS_ID = 'virtual:tw-tokens.css';

// 색 · 간격은 디자인 시스템 원본(docs/design-system/project/tokens.json) 한 벌에서 — 도움말 사이트와 같은 변환기로 빌드 때 만든다(사본을 커밋하지 않는다).
function designTokens(): Plugin {
  const require = createRequire(import.meta.url);
  const { tokensCss } = require(`${ROOT}scripts/build-design-tokens.js`) as {
    tokensCss: (t: unknown) => string;
  };
  const src = `${ROOT}docs/design-system/project/tokens.json`;
  return {
    name: 'tw-design-tokens',
    resolveId: (id) => (id === TOKENS_ID ? `\0${TOKENS_ID}` : null),
    load(id) {
      if (id !== `\0${TOKENS_ID}`) return null;
      this.addWatchFile(src);
      return tokensCss(JSON.parse(readFileSync(src, 'utf8')));
    },
  };
}

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [react(), designTokens()],
  test: {
    include: ['tests/**/*.test.ts?(x)'],
    environment: 'node',
  },
});
