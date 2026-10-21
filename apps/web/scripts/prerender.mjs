// 빌드한 index.html 틀에 언어마다 미리 그린 화면을 채워 dist/ 에 쓴다 — vite build(화면) · vite build --ssr(그리는 함수) 뒤에 돈다.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const SSR = join(ROOT, 'dist-ssr');

const { prerenderAll } = await import(join(SSR, 'entry-server.js'));
const template = readFileSync(join(DIST, 'index.html'), 'utf8');
for (const [file, html] of prerenderAll(template)) {
  const out = join(DIST, file);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  console.log(`미리 그림: dist/${file}`);
}
rmSync(SSR, { recursive: true, force: true });
