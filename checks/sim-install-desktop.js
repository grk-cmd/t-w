/* ═══ 📦 sim-install-desktop.js — 루트 postinstall 이 앱 의존성을 한 번만 깐다(scripts/install-desktop.js) ═══
   [왜] `npm --prefix apps/desktop install` 이 Windows 에서 루트를 다시 깔아 postinstall 이 끝없이 되풀이됐다.
   1. 부르는 모양 — 가짜 npm(npm_execpath)을 실제로 불러: cwd = apps/desktop · 인자 install · 표시(GUARD) · local_prefix 지움 · 종료 코드 그대로
   2. 한 번만 — 표시가 있으면 npm 을 부르지 않고 알아볼 문구와 함께 실패 · 가짜 npm 이 «루트를 다시 까는»(Windows 증상) 흉내를 내도 한 번에 멈추고 설치 전체가 실패로 끝난다
   3. 실제 npm 으로 — 의존성 없는 가짜 저장소에서 루트 → 앱 postinstall 이 한 번씩만 돈다
   4. 깨 보기 — 표시를 빼거나 cwd 를 루트로 바꾼 사본은 위 판정에 걸린다
   [실행] 러너 스테이징 또는 저장소 루트에서(`scripts/install-desktop.js` 를 cwd 상대로 찾는다). */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const SRC = ['scripts/install-desktop.js', '../scripts/install-desktop.js'].map((f) => { try { return fs.readFileSync(f, 'utf8'); } catch (_) { return null; } }).find(Boolean);
if (!SRC){ say('  ? 원본 못 찾음 — scripts/install-desktop.js'); process.exit(2); }

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-install-desktop-'));
const NODE = process.execPath;

/* 가짜 저장소 — 루트 · scripts/ · apps/desktop. src 는 시험할 스크립트 글 */
function mkRepo(name, src){
  const root = path.join(TMP, name);
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'apps', 'desktop'), { recursive: true });
  fs.writeFileSync(path.join(root, 'scripts', 'install-desktop.js'), src);
  return root;
}
/* 가짜 npm — 부른 모양을 log 에 한 줄씩. mode 'rerun' 이면 Windows 증상처럼 루트 postinstall 을 다시 부른다(5번에서 멈춤) */
function mkFakeNpm(root, mode, code){
  const log = path.join(root, 'npm-log.jsonl');
  const fake = path.join(root, 'fake-npm.js');
  fs.writeFileSync(fake, `
const fs = require('fs'); const { spawnSync } = require('child_process');
const n = fs.existsSync(${JSON.stringify(log)}) ? fs.readFileSync(${JSON.stringify(log)}, 'utf8').trim().split('\\n').length : 0;
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify({ cwd: process.cwd(), argv: process.argv.slice(2), guard: process.env.TW_DESKTOP_INSTALL || null, lp: process.env.npm_config_local_prefix || null }) + '\\n');
if (${JSON.stringify(mode)} === 'rerun' && n < 4){
  const r = spawnSync(process.execPath, [${JSON.stringify(path.join(root, 'scripts', 'install-desktop.js'))}], { cwd: ${JSON.stringify(root)}, env: process.env, stdio: 'inherit' });
  process.exit(r.status);
}
process.exit(${Number(code) || 0});`);
  return { fake, log };
}
const readLog = (log) => fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
function runScript(root, env){
  return spawnSync(NODE, [path.join(root, 'scripts', 'install-desktop.js')], { cwd: root, env, encoding: 'utf8', timeout: 30000 });
}
const baseEnv = () => { const e = { ...process.env }; delete e.TW_DESKTOP_INSTALL; return e; };

/* 판정 묶음 — 깨 보기에서 같은 판정을 고친 사본에 다시 건다 */
function judge(src){
  const out = [];
  const t = (ok, msg) => out.push([!!ok, msg]);
  /* 1. 부르는 모양 */
  {
    const root = mkRepo('shape-' + Math.random().toString(36).slice(2), src);
    const { fake, log } = mkFakeNpm(root, 'ok', 3);
    const r = runScript(root, { ...baseEnv(), npm_execpath: fake, npm_config_local_prefix: root });
    const L = readLog(log);
    const want = fs.realpathSync(path.join(root, 'apps', 'desktop'));
    t(L.length === 1 && fs.realpathSync(L[0].cwd) === want && JSON.stringify(L[0].argv) === '["install"]', '★ 가짜 npm 을 한 번 · cwd = apps/desktop · 인자 install (--prefix 없음)');
    t(L.length === 1 && L[0].guard === '1' && L[0].lp === null, '★ 부른 npm 에 표시(GUARD)를 넘기고 npm_config_local_prefix 는 지운다');
    t(r.status === 3, '  ↳ npm 의 종료 코드를 그대로 돌려준다(실패를 삼키지 않음)');
  }
  /* 2. 한 번만 */
  {
    const root = mkRepo('guard-' + Math.random().toString(36).slice(2), src);
    const { fake, log } = mkFakeNpm(root, 'ok', 0);
    const r = runScript(root, { ...baseEnv(), npm_execpath: fake, TW_DESKTOP_INSTALL: '1' });
    t(r.status === 1 && readLog(log).length === 0 && /\[install-desktop\] 앱 설치가 루트를 다시 깔았다/.test(r.stderr || ''), '★ 표시가 있으면 npm 을 부르지 않고 «루트를 다시 깔았다» 문구와 함께 실패(1) — 조용히 성공하지 않음');
    const root2 = mkRepo('rerun-' + Math.random().toString(36).slice(2), src);
    const f2 = mkFakeNpm(root2, 'rerun', 0);
    const r2 = runScript(root2, { ...baseEnv(), npm_execpath: f2.fake });
    t(r2.status !== 0 && readLog(f2.log).length === 1 && /루트를 다시 깔았다/.test(r2.stderr || ''), '★ 자식이 루트 postinstall 을 다시 불러도(Windows 증상) npm 은 한 번만 — 되풀이 없이 실패로 알린다');
  }
  return out;
}

say('── 1 · 2. 부르는 모양 · 한 번만');
const rows = judge(SRC);
rows.forEach(([ok, msg]) => chk(ok, msg));

say('── 3. 실제 npm 으로 — 루트 → 앱 postinstall 이 한 번씩');
{
  const root = mkRepo('real', SRC);
  const calls = path.join(root, 'calls.txt');
  const rec = (who) => `node -e "require('fs').appendFileSync(${JSON.stringify(calls).replace(/"/g, "'")},'${who}\\n')"`;
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'root', version: '1.0.0', private: true, scripts: { postinstall: rec('root') + ' && node scripts/install-desktop.js' } }));
  fs.writeFileSync(path.join(root, 'apps', 'desktop', 'package.json'), JSON.stringify({ name: 'desk', version: '1.0.0', private: true, scripts: { postinstall: rec('desk') } }));
  const env = baseEnv();
  const r = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--no-audit', '--no-fund', '--offline'], { cwd: root, env, encoding: 'utf8', timeout: 120000, shell: process.platform === 'win32' });
  if (r.error && r.error.code === 'ENOENT') say('  · npm 이 없다 — 실제 npm 확인 건너뜀(1 · 2 · 4 는 돌았다)');
  else {
    const got = fs.existsSync(calls) ? fs.readFileSync(calls, 'utf8').trim().split('\n') : [];
    chk(r.status === 0 && got.join(',') === 'root,desk', '★ npm install 한 번 → root · desk postinstall 한 번씩 (' + (got.join(',') || '없음') + ')');
  }
}

say('── 4. 깨 보기 — 하나라도 못 잡으면 빨강');
{
  const noGuard = SRC.replace(/if\s*\(process\.env\[GUARD\]\)\s*\{[^}]*\}/, '');
  const atRoot = SRC.replace(/cwd: DESKTOP/g, "cwd: path.join(__dirname, '..')").replace(/\['install'\]/g, "['--prefix', 'apps/desktop', 'install']");
  const keepLp = SRC.replace(/delete out\[k\];/, '');
  const cases = [['표시 확인을 뺀 사본', noGuard], ['루트에서 --prefix 로 부르는 사본', atRoot], ['local_prefix 를 남기는 사본', keepLp]];
  for (const [name, src] of cases){
    const changed = src !== SRC;
    const caught = changed && judge(src).some(([ok]) => !ok);
    chk(caught, '  ↳ ' + name + ' → 빨강' + (changed ? '' : ' (사본을 못 만듦 — 원본 글이 바뀌었다)'));
  }
}

fs.rmSync(TMP, { recursive: true, force: true });
say('\n' + pass + ' · ' + fail);
process.exit(fail ? 1 : 0);
