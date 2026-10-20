/* 빌드 두 벌 — 앱용 classic script(window.TwCharCore) · 웹용 ESM + 타입.
   앱은 번들러가 없어 빌드 결과를 apps/desktop/app/vendor/char-core/ 에 한 벌 두고 싣는다(설치 파일에 들어가는 것도 그 사본).
   그 사본이 이 빌드와 같은지는 CI(checks.yml «캐릭터 코어») 가 다시 빌드해 비교한다 — 손으로 고치지 않는다. */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'));
const DESKTOP_COPY = join(here, '..', '..', 'apps', 'desktop', 'app', 'vendor', 'char-core', 'char-core.iife.js');

const common = {
  entryPoints: [join(here, 'src', 'index.ts')],
  bundle: true,
  target: 'es2020',
  legalComments: 'none',
  charset: 'utf8',
  define: { __CHAR_CORE_VERSION__: JSON.stringify(pkg.version) },
  banner: { js: `/* ${pkg.name} ${pkg.version} — 생성 파일 · 고치지 말 것(packages/char-core 에서 npm run build) */` },
  logLevel: 'warning',
};

rmSync(join(here, 'dist'), { recursive: true, force: true });
buildSync({ ...common, format: 'iife', globalName: 'TwCharCore', outfile: join(here, 'dist', 'char-core.iife.js') });
buildSync({ ...common, format: 'esm', outfile: join(here, 'dist', 'char-core.mjs') });

const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
execFileSync(process.execPath, [tsc, '-p', join(here, 'tsconfig.build.json')], { stdio: 'inherit' });

mkdirSync(dirname(DESKTOP_COPY), { recursive: true });
copyFileSync(join(here, 'dist', 'char-core.iife.js'), DESKTOP_COPY);
console.log(`${pkg.name} ${pkg.version} — dist/ · apps/desktop/app/vendor/char-core/`);
