/* sim-lint.js — 🧹 «우리 안티패턴 금지» 린트(apps/desktop/eslint.config.js)가 실제로 막는가
   실행:  node checks/sim-lint.js   (러너 · 저장소 루트 어디서든)
   ★ 왜 — 새로 생기는 안티패턴은 린트로 막고, 있던 것은 기준선(apps/desktop/eslint-suppressions.json)으로 얼린다.
     규칙 · 기준선을 더하는 법은 docs/LINT.md.
   ・1절: 저장소 앱 폴더를 ESLint(CLI 그대로)로 돌려 — 기준선 밖 위반 0 · 기준선에 낡은 줄 없음(줄었으면 prune) ·
          기준선이 가리키는 파일이 다 있음 · 대상 파일(main.js · app/parts/app.js)을 정말 읽었음.
   ・2절: 깨 보기 — 규칙마다 나쁜 예는 그 규칙 이름으로 빨강 · 좋은 예는 통과(ESLint Node API lintText).
   ・3절: 기준선 톱니 — 임시 폴더에서 «기준선 1개 + 같은 위반 1개 더» 는 빨강 · «하나 지움» 은 낡은 줄로 빨강.
   ⚠️ 러너는 검사를 저장소 밖 임시 폴더(스테이징)에서 돌리고 NODE_PATH 로 저장소 node_modules 를 넘긴다.
     스테이징엔 앱 · 검사 · 루트 파일이 한 층에 섞여 있어 린트 대상을 그대로 못 쓴다 — 그래서 저장소 앱 폴더를
     NODE_PATH(…/node_modules 의 위)에서 찾아 그곳을 돌린다.
   ⚠️ eslint 가 안 깔렸으면(루트 npm install 전) «원본 없음» 으로 물러난다 — 빨강이 아니다. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };

const CONFIG = 'eslint.config.js';
const SUPPRESS = 'eslint-suppressions.json';
const RULES = ['tw/no-timer', 'tw/no-firebase-api', 'tw/ls-key-prefix', 'tw/no-main-require-renderer'];

/* ── 찾기 ─────────────────────────────────────────────────────────────── */
const nodePaths = (process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean);
const desktopCandidates = [
  path.resolve('apps', 'desktop'),
  path.resolve(__dirname, '..', 'apps', 'desktop'),
  ...nodePaths.map((p) => path.join(path.dirname(p), 'apps', 'desktop')),
];
const DESKTOP = desktopCandidates.find((d) => fs.existsSync(path.join(d, CONFIG)) && fs.existsSync(path.join(d, 'app', 'parts')));
if (!DESKTOP) { say('  ? 원본 못 찾음 — apps/desktop/eslint.config.js'); process.exit(2); }

let eslintMod = null, ESLINT_BIN = null;
for (const from of [DESKTOP, __dirname, process.cwd()]) {
  try {
    eslintMod = require(require.resolve('eslint', { paths: [from] }));
    ESLINT_BIN = path.join(path.dirname(require.resolve('eslint/package.json', { paths: [from] })), 'bin', 'eslint.js');
    break;
  } catch (_) { /* 다음 자리 */ }
}
if (!eslintMod) { say("  ? 원본 못 찾음 — Cannot find module 'eslint' (저장소 루트에서 npm install)"); process.exit(2); }
const NODE_MODULES = path.resolve(path.dirname(ESLINT_BIN), '..', '..');

const runCli = (cwd, args) => spawnSync(process.execPath, [ESLINT_BIN, ...args], {
  cwd, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024,   // json 출력은 억제된 파일의 원문까지 싣는다(app.js 등)
  env: Object.assign({}, process.env, { NODE_PATH: [NODE_MODULES, process.env.NODE_PATH].filter(Boolean).join(path.delimiter) }),
});
const parseJson = (s) => { try { return JSON.parse(s); } catch (_) { return null; } };

(async () => {
  /* ── 1절: 저장소 ───────────────────────────────────────────────────── */
  say('1절 — 저장소(' + path.relative(process.cwd(), DESKTOP) + ') 린트');
  const r = runCli(DESKTOP, ['.', '-f', 'json']);
  const results = parseJson(r.stdout);
  chk(Array.isArray(results), 'ESLint 가 끝까지 돌았다' + (Array.isArray(results) ? '' : ' — ' + (r.stderr || r.stdout).trim().split('\n').slice(0, 3).join(' / ')));
  if (Array.isArray(results)) {
    const msgs = results.flatMap((f) => f.messages.map((m) => Object.assign({ file: path.relative(DESKTOP, f.filePath) }, m)));
    for (const m of msgs.slice(0, 20)) say('      ' + m.file + ':' + m.line + ' ' + (m.ruleId || '읽기 오류') + ' — ' + m.message);
    chk(msgs.length === 0, '기준선 밖 위반 0' + (msgs.length ? ` — ${msgs.length}건(고치거나, 까닭이 있으면 PR «왜» 에 적고 npm run lint:baseline)` : ''));
    const linted = new Set(results.map((f) => path.relative(DESKTOP, f.filePath).split(path.sep).join('/')));
    chk(linted.has('main.js') && linted.has('app/parts/app.js') && linted.has('app/parts/firebase-init.js'),
      `대상 파일을 정말 읽었다(main.js · app/parts/app.js · firebase-init.js · 모두 ${linted.size}개)`);
  }
  const stale = /suppressions left that do not occur anymore/.test(r.stderr);
  chk(!stale, '기준선에 낡은 줄 없음' + (stale ? ' — 고쳐서 줄었다. npm run lint:prune 로 기준선을 내릴 것' : ''));
  const sup = parseJson(fs.readFileSync(path.join(DESKTOP, SUPPRESS), 'utf8')) || {};
  const gone = Object.keys(sup).filter((f) => !fs.existsSync(path.join(DESKTOP, f)));
  chk(gone.length === 0, '기준선이 가리키는 파일이 다 있다' + (gone.length ? ' — 없는 파일: ' + gone.join(' · ') + '(npm run lint:prune 은 못 지운다 — 손으로 그 칸을 지울 것)' : ''));
  const unknown = Object.values(sup).flatMap((rules) => Object.keys(rules)).filter((id) => !RULES.includes(id));
  chk(unknown.length === 0, '기준선의 규칙 이름이 다 이 검사가 아는 것' + (unknown.length ? ' — ' + [...new Set(unknown)].join(' · ') : ''));
  const total = {};
  for (const rules of Object.values(sup)) for (const [id, v] of Object.entries(rules)) total[id] = (total[id] || 0) + v.count;
  say('      기준선: ' + RULES.map((id) => `${id} ${total[id] || 0}`).join(' · '));

  /* ── 2절: 깨 보기 ──────────────────────────────────────────────────── */
  say('2절 — 깨 보기(규칙마다 나쁜 예 빨강 · 좋은 예 통과)');
  const eslint = new eslintMod.ESLint({ cwd: DESKTOP, overrideConfigFile: path.join(DESKTOP, CONFIG) });
  const R = 'app/parts/room/zz-sim-lint.js';
  const MAIN = 'main.js';
  const cases = [
    ['tw/no-timer', R, 'setTimeout(()=>go(), 0);', true],
    ['tw/no-timer', R, 'window.setTimeout(go, 50);', true],
    ['tw/no-timer', R, 'requestAnimationFrame(()=>layout());', true],
    ['tw/no-timer', R, 'globalThis.requestAnimationFrame(f);', true],
    ['tw/no-timer', R, "onReady(()=>go()); clearTimeout(t); timer.setTimeout(1);", false],
    ['tw/no-timer', MAIN, 'setTimeout(()=>go(), 0);', false],
    ['tw/no-firebase-api', R, 'firebaseAPI.saveMyHome(uid, d);', true],
    ['tw/no-firebase-api', R, 'if(window.firebaseAPI) go();', true],
    ['tw/no-firebase-api', R, 'const api = deps.myhomeApi; api.save(d); const o = { firebaseAPI: 1 }; x.firebaseAPI;', false],
    ['tw/no-firebase-api', 'app/parts/shared/net-ready.js', 'const api = window.firebaseAPI; firebaseAPI.x();', false],
    ['tw/no-firebase-api', 'app/parts/firebase-init.js', 'window.firebaseAPI = {}; export const a = 1;', false],
    ['tw/ls-key-prefix', R, "localStorage.setItem('chatPos', v);", true],
    ['tw/ls-key-prefix', R, "window.localStorage.getItem('tw_chat_pos');", true],
    ['tw/ls-key-prefix', R, 'localStorage.removeItem(`seat.${id}`);', true],
    ['tw/ls-key-prefix', R, "localStorage.getItem('tw.chat.pos'); localStorage.setItem(KEY, v); localStorage.getItem(`tw.seat.${id}`); store.setItem('x', 1);", false],
    ['tw/no-main-require-renderer', MAIN, "const X = require('./app/parts/shared/help-site');", true],
    ['tw/no-main-require-renderer', 'overlay-win.js', "require('../desktop/app/parts/x');", true],
    ['tw/no-main-require-renderer', MAIN, "const o = require('./overlay-win'); const e = require('electron'); const p = require('path').join(__dirname, 'app');", false],
    ['tw/no-main-require-renderer', R, "require('./app/parts/x');", false],
  ];
  for (const [rule, file, code, bad] of cases) {
    const [res] = await eslint.lintText(code, { filePath: path.join(DESKTOP, file) });
    const hit = res.messages.filter((m) => m.ruleId === rule);
    const broken = res.messages.filter((m) => m.fatal);
    const ok = !broken.length && (bad ? hit.length > 0 && hit.every((m) => /—/.test(m.message)) : hit.length === 0);
    chk(ok, `${bad ? '빨강' : '통과'} ${rule} · ${file} · ${code.slice(0, 48)}` + (broken.length ? ' — 읽기 오류 ' + broken[0].message : ''));
  }

  /* ── 3절: 기준선 톱니 ──────────────────────────────────────────────── */
  say('3절 — 기준선 톱니(임시 폴더)');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-sim-lint-'));
  try {
    fs.copyFileSync(path.join(DESKTOP, CONFIG), path.join(tmp, CONFIG));
    const f = path.join(tmp, 'app', 'parts', 'room', 'a.js');
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(path.join(tmp, SUPPRESS), JSON.stringify({ 'app/parts/room/a.js': { 'tw/no-timer': { count: 1 } } }));
    const step = (code) => { fs.writeFileSync(f, code); return runCli(tmp, ['.']); };
    const same = step('setTimeout(go, 1);\n');
    chk(same.status === 0, '기준선만큼(1개)은 통과' + (same.status ? ' — ' + (same.stdout + same.stderr).trim().split('\n').slice(-2).join(' / ') : ''));
    const more = step('setTimeout(go, 1);\nsetTimeout(go, 2);\n');
    chk(more.status === 1 && /tw\/no-timer/.test(more.stdout), '하나 더 생기면 빨강');
    const other = step('firebaseAPI.x();\n');
    chk(other.status !== 0 && /tw\/no-firebase-api/.test(other.stdout), '타이머를 지우고 다른 금지를 넣어도 빨강(규칙 이름이 따로)');
    const fewer = step('go();\n');
    chk(fewer.status === 2 && /do not occur anymore/.test(fewer.stderr), '줄면 낡은 줄로 빨강(prune 하라고)');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  say(`통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { say('  ✗ 검사가 던졌다 — ' + (e && e.stack || e)); say(`통과 ${pass} · 실패 ${fail + 1}`); process.exit(1); });
