/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const TOKENS_ID = 'virtual:tw-tokens.css';
const CHAR_ID = 'virtual:tw-char-assets';
const CHAR_DEV_PREFIX = '/@tw-char/';

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

// 사람 몸 모델 · 피부 그림 5장 — 앱 설치 파일에 든 공개 자산(#430 4절)을 앱 원본에서 바로 꺼내 파일로 낸다(사본을 커밋하지 않는다).
function charAssets(): Plugin {
  const DESKTOP = `${ROOT}apps/desktop/app/parts/`;
  const read = () => {
    const glb = /BASE_GLB_B64="([^"]+)"/.exec(readFileSync(`${DESKTOP}base-glb.js`, 'utf8'))?.[1];
    const skins = JSON.parse(
      /window\.SKIN_PNGS=(\{[\s\S]*\});?\s*$/.exec(readFileSync(`${DESKTOP}skin-data.js`, 'utf8'))?.[1] ??
        'null',
    ) as Record<string, string> | null;
    if (!glb || !skins) throw new Error('앱의 base-glb.js · skin-data.js 에서 몸 · 피부를 못 읽었다');
    const png = (u: string) => Buffer.from(u.replace(/^data:image\/png;base64,/, ''), 'base64');
    const files: Record<string, Buffer> = { 'body.glb': Buffer.from(glb, 'base64') };
    for (let i = 0; i < 5; i++) {
      const u = skins[String(i)];
      if (!u) throw new Error(`피부 ${i} 번이 없다`);
      files[`skin-${i}.png`] = png(u);
    }
    return files;
  };
  let isBuild = false;
  return {
    name: 'tw-char-assets',
    configResolved(c) {
      isBuild = c.command === 'build';
    },
    resolveId: (id) => (id === CHAR_ID ? `\0${CHAR_ID}` : null),
    load(id) {
      if (id !== `\0${CHAR_ID}`) return null;
      const files = read();
      const url = (name: string) =>
        isBuild
          ? `import.meta.ROLLUP_FILE_URL_${this.emitFile({ type: 'asset', name: `char/${name}`, source: files[name] })}`
          : JSON.stringify(CHAR_DEV_PREFIX + name);
      const skins = [0, 1, 2, 3, 4].map((i) => url(`skin-${i}.png`));
      return `export const bodyGlbUrl = ${url('body.glb')};\nexport const skinUrls = [${skins.join(', ')}];\n`;
    },
    configureServer(server) {
      server.middlewares.use(CHAR_DEV_PREFIX, (req, res) => {
        const name = (req.url ?? '').replace(/^\//, '');
        const file = read()[name];
        if (!file) {
          res.statusCode = 404;
          res.end();
          return;
        }
        res.setHeader('Content-Type', name.endsWith('.glb') ? 'model/gltf-binary' : 'image/png');
        res.end(file);
      });
    },
  };
}

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [react(), designTokens(), charAssets()],
  test: {
    include: ['tests/**/*.test.ts?(x)'],
    environment: 'node',
  },
});
