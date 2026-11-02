/* sim-rules-drift.js — 🔀 판끼리 DB 규칙 어긋남(scripts/rules-drift.js · 워크플로 checks.yml 의 «판끼리 DB 규칙»)
   실행:  node checks/run.js rules-drift   (git 이 있어야 한다)
   ★ 왜 — 판마다 따로 고친 규칙을 다음 판으로 손으로 옮기다 잊으면, 뒤 판 규칙을 배포하는 순간 앞 판 기능이 막힌다.
     이 비교가 «빠짐» 을 놓치거나 «뒤 판이 일부러 다시 고친 것» 을 빠짐으로 잘못 잡으면 경고를 믿을 수 없게 된다.
   ・1절: 순수 함수 — 펴기 · 주석 · 세 갈래 판정(빠짐 · 확인 필요 · 통과 · 지운 칸 · 뒤 판만 더한 칸) · 묶음 · 판 이름 · 짝 고르기
   ・2절: 진짜 git 저장소(임시 · 원격 하나) — 자리 옮긴 규칙 파일 · main · 다른 판에 들어간 판 · --ref(PR 머지 결과) · 판 없음
   ・3절: 알리기 — GitHub 경고 줄(% · 줄바꿈) · 요약 표
   ・4절: 일부러 깨 보기 — 두 갈래 판정 · 지운 칸 못 봄 · 곁가지끼리 짝 · 들어간 판 안 뺌 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, path.join(__dirname, f), path.join(__dirname, '..', f)]) { try { return fs.readFileSync(c, 'utf8'); } catch (_) {} } return null; };
const SRC = read('scripts/rules-drift.js');
if (!SRC) { say('  ? 원본 못 찾음 — scripts/rules-drift.js'); process.exit(2); }
try { execSync('git --version', { stdio: 'ignore' }); } catch (_) { say('  ? git 이 없다 — 돌리지 못함'); process.exit(2); }

function load(src) { const module = { exports: {} }; new Function('module', 'exports', 'require', '__dirname', src.replace(/^#!.*\n/, ''))(module, module.exports, require, __dirname); return module.exports; }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const throws = (fn) => { try { fn(); return false; } catch (_) { return true; } };
const rm = (d) => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} };

/* 임시 저장소 — «원격»(up)에 판 브랜치를 만들고 clone 해서 refs/remotes/origin/* 가 생기게 한다(CI 와 같은 모양) */
function fixture() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-drift-'));
  const up = path.join(d, 'up');
  fs.mkdirSync(up);
  const g = (c, cwd = up) => execSync(c, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const put = (rel, obj, cwd = up) => { fs.mkdirSync(path.dirname(path.join(cwd, rel)), { recursive: true }); fs.writeFileSync(path.join(cwd, rel), typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2)); };
  const commit = (m, cwd = up) => { g('git add -A', cwd); g(`git commit -q -m "${m}"`, cwd); };
  g('git init -q -b main'); g('git config user.name t'); g('git config user.email t@t'); g('git config commit.gpgsign false');
  const base = { rules: { a: { '.read': true, '.write': false }, z: { '.read': 'auth != null' } } };
  put('apps/desktop/package.json', { version: '0.12.1' });
  put('firebase-database-rules.json', base);
  commit('0.12.1');
  g('git branch release/0.12.1');                                   // main 에 통째로 들어간 판 — 짝에서 빠져야 한다
  /* 0.13.0 — 규칙 파일을 firebase/ 로 옮기고 b 를 더함 · a/.write 를 따로 고침 */
  g('git checkout -q -b release/0.13.0');
  fs.rmSync(path.join(up, 'firebase-database-rules.json'));
  put('firebase/firebase-database-rules.json', { rules: { a: { '.read': true, '.write': 'auth != null' }, z: { '.read': 'auth != null' }, b: { '.read': true } } });
  commit('0.13 move');
  g('git checkout -q -b release/0.13.0-server');                   // 같은 판 곁가지 — 0.13.0 과 짝 짓지 않는다
  put('firebase/firebase-database-rules.json', { rules: { a: { '.read': true, '.write': 'auth != null' }, z: { '.read': 'auth != null' }, b: { '.read': true }, s: { '.read': false } } });
  commit('server');
  /* 0.12.2 — y 를 더하고 z 를 걷고 a/.write 를 고침(0.13 과 다르게) */
  g('git checkout -q -b release/0.12.2 main');
  put('firebase-database-rules.json', '// 주석 줄\n' + JSON.stringify({ rules: { a: { '.read': true, '.write': 'auth.uid != null' }, y: { '.read': true } } }, null, 2));
  commit('0.12.2');
  g('git checkout -q main');
  const clone = path.join(d, 'c');
  g(`git clone -q "${up}" "${clone}"`, d);
  return { d, up, clone, g, put, commit };
}

say('── 1절 · 순수 함수');
const M = load(SRC);
{
  const f = M.flatten(M.parseRules('// 머리 주석\n{ "rules": { ".read": false, "x": { "$id": { ".validate": "newData.isString()" } } } }'));
  chk(same(f, { '/rules/.read': 'false', '/rules/x/$id/.validate': '"newData.isString()"' }), '펴기 — 칸 이름 · 값(JSON 글) · 줄 머리 // 주석 걷기');
  chk(M.parseRules('{ "rules": { ".validate": "x.matches(/^https?:\\/\\//)" } }').rules['.validate'].includes('//'), '문자열 속 // 는 그대로');
  const base = { k1: '1', k2: '2', k3: '3', k4: '4' };
  const src = { k1: '1', k2: 'A', k3: 'A', k4: 'A', k5: 'new' };   // k1 그대로 · k2 · k3 · k4 바꿈 · k5 더함
  const dst = { k1: 'X', k2: 'A', k3: '3', k4: 'B', k6: 'dst만' };  // k2 들어감 · k3 그대로(빠짐) · k4 따로 고침 · k5 없음
  const r = M.drift(base, src, dst);
  chk(same(r.missing, ['k3', 'k5']), `빠짐 — 기준 그대로(k3) · 앞 판만 더함(k5) → ${r.missing}`);
  chk(same(r.diverged, ['k4']), `확인 필요 — 양쪽이 다르게 고침(k4) → ${r.diverged}`);
  chk(!r.missing.includes('k1') && !r.missing.includes('k6'), '앞 판이 안 바꾼 칸(k1) · 뒤 판만 더한 칸(k6) 은 안 잡음');
  const del = M.drift({ z: '1', w: '2' }, {}, { z: '1' });
  chk(same(del, { missing: ['z'], diverged: [] }), `앞 판이 걷은 칸 — 뒤 판에 남았으면 빠짐(z) · 뒤 판도 걷었으면 통과(w) → ${JSON.stringify(del)}`);
  chk(same(M.drift({}, {}, {}), { missing: [], diverged: [] }), '빈 규칙 — 잡을 것 없음');
  const gk = M.groupKeys(['/rules/b/$x/.read', '/rules/a/.read', '/rules/b/.write']);
  chk(same(gk.map(g => [g.node, g.keys.length]), [['/rules/a', 1], ['/rules/b', 2]]), '묶음 — 노드 두 층 · 이름 차례');
  chk(same(M.parseRelease('release/0.13.0-server'), { name: 'release/0.13.0-server', core: [0, 13, 0], tag: 'server' }), '판 이름 — 꼬리 붙은 곁가지');
  chk(M.parseRelease('release/0.13') === null && M.parseRelease('hotfix/x') === null && M.parseRelease('') === null, '판 이름 아님 — 두 자리 · 다른 접두사 · 빈 값');
  chk(M.cmpCore([0, 12, 10], [0, 13, 0]) < 0 && M.cmpCore([0, 9, 0], [0, 10, 0]) < 0, '버전 비교는 숫자로(0.12.10 < 0.13.0 · 0.9 < 0.10)');
  const B = [{ name: 'main', core: [0, 12, 1] }, { name: 'release/0.12.2', core: [0, 12, 2] }, { name: 'release/0.12.0', core: [0, 12, 0], superseded: true },
    { name: 'release/0.13.0', core: [0, 13, 0] }, { name: 'release/0.13.0-server', core: [0, 13, 0] }];
  const P = M.pairs(B).map(p => p.join('>'));
  chk(!P.includes('release/0.13.0>release/0.13.0-server') && !P.includes('release/0.13.0-server>release/0.13.0'), '같은 판 곁가지끼리는 짝 안 지음');
  chk(!P.some(p => p.startsWith('release/0.12.0>')), '다른 판에 들어간 판은 앞 판으로 안 씀');
  chk(P.includes('main>release/0.12.2') && P.includes('release/0.12.2>release/0.13.0-server') && !P.some(p => p.endsWith('>main')), '앞(낮은 버전 · main) → 뒤로만');
  chk(same(M.pairs(B, 'release/0.13.0').map(p => p[0]), ['main', 'release/0.12.2']), '--target — 그 판으로 들어올 짝만');
}

say('── 2절 · 진짜 git 저장소');
let fx = null;
try {
  fx = fixture();
  const r = M.scan({ cwd: fx.clone });
  const names = r.branches.map(b => b.name + (b.superseded ? '(들어감)' : ''));
  chk(names.includes('main') && names.includes('release/0.12.1(들어감)'), `판 목록 — main(앱 버전 자리) · main 에 들어간 0.12.1 → ${names.join(' · ')}`);
  const pr = (from, to) => r.results.find(x => x.from === from && x.to === to);
  const a = pr('release/0.12.2', 'release/0.13.0');
  chk(!!a && same(a.missing, ['/rules/y/.read', '/rules/z/.read']), `옮긴 자리(firebase/)에서도 — 더한 y · 걷은 z 가 빠짐 → ${a && a.missing}`);
  chk(!!a && same(a.diverged, ['/rules/a/.write']), `양쪽이 다르게 고친 a/.write → 확인 필요 → ${a && a.diverged}`);
  chk(!r.results.some(x => x.from === 'release/0.12.1'), '들어간 판(0.12.1)은 앞 판으로 안 씀');
  chk(!pr('release/0.13.0', 'release/0.13.0-server') && !pr('release/0.13.0-server', 'release/0.13.0'), '곁가지끼리 짝 없음');
  const m = pr('main', 'release/0.13.0');
  chk(!!m && m.missing.length === 0 && m.diverged.length === 0, 'main 이 갈라진 뒤 규칙을 안 바꿨으면 통과');
  /* PR 머지 결과(--ref) — 0.13.0 에 y 를 옮기고 z 를 걷은 커밋을 원격에 올리지 않은 채 본다 */
  fx.g('git checkout -q release/0.13.0', fx.clone);
  fx.put('firebase/firebase-database-rules.json', { rules: { a: { '.read': true, '.write': 'auth.uid != null' }, b: { '.read': true }, y: { '.read': true } } }, fx.clone);
  fx.g('git config user.name t', fx.clone); fx.g('git config user.email t@t', fx.clone); fx.g('git config commit.gpgsign false', fx.clone);
  fx.commit('port', fx.clone);
  const t = M.scan({ cwd: fx.clone, target: 'release/0.13.0', ref: 'HEAD' });
  const tp = t.results.find(x => x.from === 'release/0.12.2');
  chk(t.results.every(x => x.to === 'release/0.13.0') && !!tp && !tp.missing.length && !tp.diverged.length, '--target · --ref HEAD — 옮겨 온 PR 머리에선 통과');
  const t0 = M.scan({ cwd: fx.clone, target: 'release/0.13.0' });
  chk(!!t0.results.find(x => x.from === 'release/0.12.2' && x.missing.length === 2), '--ref 없으면 원격 판 머리 그대로(아직 빠짐 2)');
  const nw = M.scan({ cwd: fx.clone, target: 'release/0.14.0', ref: 'HEAD' });
  chk(nw.results.length > 0 && nw.results.every(x => x.to === 'release/0.14.0'), '원격에 아직 없는 새 판 이름도 --ref 로 본다');
  chk(throws(() => M.scan({ cwd: fx.clone, target: 'feat/x', ref: 'HEAD' })), '판 이름이 아닌 --target 은 거절');
  const empty = path.join(fx.d, 'e');
  fx.g(`git init -q "${empty}"`, fx.d);
  chk(throws(() => M.scan({ cwd: empty })), '판 브랜치가 하나도 없으면 «보지 못함»(빈 결과로 통과시키지 않음)');
} catch (e) {
  chk(false, '임시 저장소에서 돌리다 멈춤 — ' + e.message);
} finally { if (fx) rm(fx.d); }

say('── 3절 · 알리기');
{
  const res = [{ from: 'release/0.12.2', to: 'release/0.13.0', base: 'abc1234', missing: ['/rules/p/.read', '/rules/p/x/.write'], diverged: ['/rules/q/.validate'] },
    { from: 'main', to: 'release/0.13.0', base: 'abc1234', missing: [], diverged: [] }];
  const an = M.formatAnnotations(res);
  chk(an.length === 1 && an[0].startsWith('::warning title=DB 규칙: release/0.12.2 → release/0.13.0::'), '경고 줄 — 어긋난 짝만 · 하나에 한 줄');
  chk(/빠짐 2칸\(\/rules\/p\)/.test(an[0]) && /확인 필요 1칸\(\/rules\/q\)/.test(an[0]), '경고 줄에 묶음 이름 · 칸 수');
  const odd = M.formatAnnotations([{ from: 'a%b', to: 'c\nd', base: '', missing: ['/rules/x'], diverged: [] }])[0];
  chk(!odd.includes('\n') && odd.includes('a%25b') && odd.includes('c%0Ad'), 'GitHub 규칙대로 % · 줄바꿈 바꿔 씀(경고 줄이 끊기지 않게)');
  const sm = M.formatSummary(res);
  chk(sm.includes('| release/0.12.2 → release/0.13.0 | abc1234 | 2 | 1 |') && sm.includes('| main → release/0.13.0 | abc1234 | 0 | 0 |'), '요약 표 — 짝마다 한 줄');
  chk(M.formatAnnotations(res.slice(1)).length === 0, '다 맞으면 경고 없음');
}

say('── 4절 · 일부러 깨 보기');
function broken(label, from, to) {
  if (!SRC.includes(from)) { chk(false, `깨 보기 «${label}» — 바꿀 글을 원본에서 못 찾음(검사를 원본에 맞출 것)`); return; }
  const B = load(SRC.replace(from, to));
  let caught = false;
  try {
    const r = B.drift({ k3: '3', k4: '4', z: '1' }, { k3: 'A', k4: 'A' }, { k3: '3', k4: 'B', z: '1' });
    if (!same(r, { missing: ['k3', 'z'], diverged: ['k4'] })) caught = true;
    const P = B.pairs([{ name: 'release/0.13.0', core: [0, 13, 0] }, { name: 'release/0.13.0-server', core: [0, 13, 0] },
      { name: 'release/0.12.0', core: [0, 12, 0], superseded: true }]);
    if (P.length) caught = true;
  } catch (_) { caught = true; }
  chk(caught, `깨 보기 «${label}» → 빨강`);
}
broken('두 갈래 판정(따로 고친 것도 빠짐으로)', '(dst[k] === base[k] ? missing : diverged).push(k);', 'missing.push(k);');
broken('지운 칸 못 봄(앞 판 칸만 훑음)', 'new Set([...Object.keys(base), ...Object.keys(src)])', 'new Set(Object.keys(src))');
broken('곁가지끼리 짝', 'cmpCore(a.core, b.core) >= 0', 'cmpCore(a.core, b.core) > 0');
broken('들어간 판 안 뺌', 'if(a.superseded) continue;', '');

say(`\n통과 ${pass} · 실패 ${fail}`);
say(fail ? `✗ 실패 ${fail}건` : '✓ 전부 통과');
process.exit(fail ? 1 : 0);
