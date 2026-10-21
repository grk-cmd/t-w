// 빌드한 index.html 틀에 언어마다 미리 그린 화면을 채워 dist/ 에 쓴다 — vite build(화면) · vite build --ssr(그리는 함수) 뒤에 돈다.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const SSR = join(ROOT, 'dist-ssr');

// import() 는 주소(URL)를 받는다 — Windows 경로(C:\…)를 그대로 넣으면 «protocol 'c:'» 로 멈춘다
const { prerenderAll } = await import(pathToFileURL(join(SSR, 'entry-server.js')).href);
const template = readFileSync(join(DIST, 'index.html'), 'utf8');
for (const [file, html] of prerenderAll(template)) {
  const out = join(DIST, file);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  console.log(`미리 그림: dist/${file}`);
}
rmSync(SSR, { recursive: true, force: true });
