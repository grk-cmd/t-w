/*
 * scripts/move-verbatim.js 검사 — app.js 분리 PR 의 «그대로 옮겼다» 판정기를 실제로 돌려 본다.
 * 1. 순수 함수 analyze: 그대로 옮김 → 허용 밖 0 · 한 글자 바꿈 → 허용 밖 · 한 줄 빠뜨림 → 허용 밖 · 허용 종류(읽는 함수 · 쓰는 함수 · 이름 바꿈 · 가드 걷기)만 → 0
 * 2. 임시 git 저장소: 같은 네 경우를 진짜 diff 로 돌려 종료 코드를 본다 + 두 번 센 줄(다중집합) · 모듈이 아닌 파일은 줄을 안 봄
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };

const SCRIPT = [path.join(__dirname, 'scripts', 'move-verbatim.js'), path.join(__dirname, '..', 'scripts', 'move-verbatim.js')].find((f) => fs.existsSync(f));
if (!SCRIPT){ say('  ? 원본 못 찾음 — scripts/move-verbatim.js'); process.exit(2); }
const { analyze } = require(SCRIPT);

const APP = 'app/parts/app.js', MOD = 'app/parts/room/x.js';
const rows = (file, lines, from = 1) => lines.map((text, i) => ({ file, no: from + i, text }));
const run = (removed, added, head = {}, base = {}) => analyze(removed, added, { headText: (f) => head[f] || null, baseText: (f) => base[f] || null });
const kinds = (r) => Object.keys(r.kinds).sort().join(',');

say('1. analyze(순수 함수)');
{
  const body = ['function a(x){', '  return x + 1;', '}', 'const k = 2;'];
  const r = run(rows(APP, body), rows(MOD, ['(function(){', 'function createX(deps){', ...body, '}', '})();']));
  chk(r.violations.length === 0 && r.moved === body.length, `그대로 옮김 → 허용 밖 0 (옮긴 ${r.moved}줄)`);
  const r2 = run(rows(APP, body), rows(MOD, [...body.slice(0, 1), '  return x + 2;', ...body.slice(2)]));
  chk(r2.violations.length === 2, '한 글자 바꿈 → 허용 밖 2(빠진 줄 · 새 줄)');
  const r3 = run(rows(APP, body), rows(MOD, body.slice(0, 3)));
  chk(r3.violations.length === 1 && r3.violations[0].side === '-', '한 줄 빠뜨림 → 빠진 줄이 허용 밖');
  const r4 = run(rows(APP, [...body, 'const k = 2;']), rows(MOD, body));
  chk(r4.violations.length === 1, '같은 줄이 둘인데 하나만 옮김 → 다중집합이라 하나가 허용 밖');
  const r5 = run(rows(APP, body), rows(MOD, [...body, 'const extra = 1;']));
  chk(r5.violations.length === 1 && r5.violations[0].side === '+', '모듈에 새 줄을 끼움 → 허용 밖');
  const r6 = run(rows(APP, ['x = 1;']), rows(MOD, ['  x   =   1;']));
  chk(r6.violations.length === 0 && r6.moved === 1, '공백(들여쓰기 · 연속 공백)만 다르면 같은 줄');
}
{
  const dep = 'const n = deps.n;';
  const r = run(rows(APP, ['return n + 1;']), rows(MOD, [dep, 'return n() + 1;']));
  chk(r.violations.length === 0 && r.kinds['read-fn'] === 1, '읽는 함수(n → n()) → read-fn 으로 허용');
  const r2 = run(rows(APP, ['return n + 1;']), rows(MOD, [dep, 'return m() + 1;']));
  chk(r2.violations.length === 2, '깨 보기: 다른 이름으로 바꾸면 허용 밖');
  const r3 = run(rows(APP, ['return n + 1;']), rows(MOD, ['return n() + 1;']));
  chk(r3.violations.length === 2, '깨 보기: deps 로 받지 않은 이름의 () 는 허용 밖(함수 참조 → 호출 변경을 못 숨김)');
  const r4 = run(rows(APP, ['size=+v;']), rows(APP, ['charMod.setSize(+v);'], 10));
  chk(r4.violations.length === 0 && r4.kinds.setter === 1, '쓰는 함수(size=v → xMod.setSize(v)) 허용');
  const r5 = run(rows(APP, ['go(1);']), rows(APP, ['xMod.go(1);'], 10));
  chk(r5.violations.length === 0 && r5.kinds['call-rename'] === 1, '부르는 곳 이름 바꿈(go → xMod.go) 허용');
  const r6 = run(rows(APP, ["if(typeof P!=='undefined' && P.f) f();"]), rows(MOD, ['if(P.f) f();']));
  chk(r6.violations.length === 0 && r6.kinds['guard-drop'] === 1, 'typeof 가드 걷기 허용');
  const r7 = run(rows(APP, ['go(1);']), rows(APP, ['xMod.go(2);'], 10));
  chk(r7.violations.length === 2, '깨 보기: 이름 바꿈에 인자도 바뀌면 허용 밖');
}
{
  const head = { [APP]: ['a', 'const xMod = TwX.createX({', '  foo: ()=>foo,', '  bar,', '});', 'b'].join('\n') };
  const r = run([], rows(APP, ['const xMod = TwX.createX({', '  foo: ()=>foo,', '  bar,', '});'], 2), head);
  chk(r.violations.length === 0 && r.kinds.wiring === 3, '만드는 줄과 deps 줄 → wiring(닫는 `});` 는 scaffold)');
  const r2 = run([], rows(APP, ['doSomethingNew();'], 6), head);
  chk(r2.violations.length === 1, '깨 보기: 연결 블록 밖에 새 줄을 넣으면 허용 밖');
  const mhead = { [MOD]: ['x', 'function f(){}', 'return {', '  f,', '  g,', '};'].join('\n') };
  const r3 = run([], rows(MOD, ['return {', '  f,', '  g,', '};'], 3), mhead);
  chk(r3.violations.length === 0, '모듈 꼬리 return { … } → scaffold');
  const r4 = run([], rows(MOD, ['/* 설명', '   이어지는 줄 */'], 1), { [MOD]: '/* 설명\n   이어지는 줄 */\n' });
  chk(r4.violations.length === 0 && r4.kinds.comment === 2, '여러 줄 주석의 이어지는 줄 → comment');
  const r5 = run([], rows('app/desk-companion-prototype.html', ['<script src="parts/room/x.js"></script>']));
  const r6 = run([], rows('app/desk-companion-prototype.html', ['<script>alert(1)</script>']));
  chk(r5.violations.length === 0 && r6.violations.length === 1, 'html 은 script src 한 줄만 허용');
}

say('2. 임시 git 저장소(진짜 diff · 종료 코드)');
const sh = (cwd, cmd, args) => spawnSync(cmd, args, { cwd, encoding: 'utf8' });
const gitc = (cwd, ...a) => sh(cwd, 'git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...a]);
function repo(){
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mv-'));
  gitc(d, 'init', '-q', '-b', 'main');
  fs.mkdirSync(path.join(d, 'app/parts/room'), { recursive: true });
  fs.writeFileSync(path.join(d, APP), ['let n = 0;', 'function a(x){', '  return x + 1;', '}', 'function b(){', '  return n + a(2);', '}', 'start();', ''].join('\n'));
  gitc(d, 'add', '-A'); gitc(d, 'commit', '-qm', 'base');
  return d;
}
function moved(d, modLines, appLines){
  fs.writeFileSync(path.join(d, MOD), modLines.join('\n') + '\n');
  fs.writeFileSync(path.join(d, APP), appLines.join('\n') + '\n');
  fs.writeFileSync(path.join(d, 'checks.txt'), 'sim 같은 줄을 안 보는 파일\n');
  gitc(d, 'add', '-A'); gitc(d, 'commit', '-qm', 'move');
  const r = sh(d, 'node', [SCRIPT, 'HEAD~1', 'HEAD']);
  return { code: r.status, out: r.stdout + r.stderr };
}
const HEAD = ['(function(){', 'function createX(deps){', 'const n = deps.n;'];
const TAIL = ['return { a, b };', '}', 'window.TwX = { createX };', '})();'];
const WIRE = ['let n = 0;', 'const xMod = TwX.createX({', '  n: ()=>n,', '});', 'start();'];
{
  const d = repo();
  const r = moved(d, [...HEAD, 'function a(x){', '  return x + 1;', '}', 'function b(){', '  return n() + a(2);', '}', ...TAIL], WIRE);
  chk(r.code === 0 && /허용 밖: 0/.test(r.out), '그대로 옮김(읽는 함수 한 군데) → 종료 0');
  fs.rmSync(d, { recursive: true, force: true });
}
{
  const d = repo();
  const r = moved(d, [...HEAD, 'function a(x){', '  return x + 2;', '}', 'function b(){', '  return n() + a(2);', '}', ...TAIL], WIRE);
  chk(r.code === 1 && /return x \+ 2/.test(r.out), '깨 보기: 옮기며 한 글자(1→2) 바꿈 → 종료 1 · 그 줄이 목록에');
  fs.rmSync(d, { recursive: true, force: true });
}
{
  const d = repo();
  const r = moved(d, [...HEAD, 'function a(x){', '  return x + 1;', '}', 'function b(){', '}', ...TAIL], WIRE);
  chk(r.code === 1 && /return n \+ a\(2\)/.test(r.out), '깨 보기: 한 줄 빠뜨림 → 종료 1 · 빠진 줄이 목록에');
  fs.rmSync(d, { recursive: true, force: true });
}
{
  const d = repo();
  const r = moved(d, [...HEAD, 'function a(x){', '  return x + 1;', '}', 'function b(){', '  return n() + a(2);', '}', ...TAIL], ['let n = 0;', 'const xMod = TwX.createX({', '  n: ()=>n,', '});', 'start(); leak();']);
  chk(r.code === 1 && /leak/.test(r.out), '깨 보기: app.js 에 끼워 넣은 줄 → 종료 1');
  fs.rmSync(d, { recursive: true, force: true });
}

say(`\n판정 ${pass}/${pass + fail} · 빨강 ${fail}`);
process.exit(fail ? 1 : 0);
