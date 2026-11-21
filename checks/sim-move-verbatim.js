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

const APP = 'apps/desktop/app/parts/app.js', MOD = 'apps/desktop/app/parts/room/x.js';   // 0.13 저장소의 앱 자리
const rows = (file, lines, from = 1) => lines.map((text, i) => ({ file, no: from + i, text }));
const run = (removed, added, head = {}, base = {}) => { const h = { [APP]: '  n: ()=>n,\n', ...head }; return analyze(removed, added, { headText: (f) => h[f] || null, baseText: (f) => base[f] || null }); };
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
  chk(r2.violations.length === 2, 'mutation test: 다른 이름으로 바꾸면 허용 밖');
  const r3 = run(rows(APP, ['return n + 1;']), rows(MOD, ['return n() + 1;']));
  chk(r3.violations.length === 2, 'mutation test: deps 로 받지 않은 이름의 () 는 허용 밖(함수 참조 → 호출 변경을 못 숨김)');
  const r4 = run(rows(APP, ['size=+v;']), rows(APP, ['charMod.setSize(+v);'], 10));
  chk(r4.violations.length === 0 && r4.kinds.setter === 1, '쓰는 함수(size=v → xMod.setSize(v)) 허용');
  const r5 = run(rows(APP, ['go(1);']), rows(APP, ['xMod.go(1);'], 10));
  chk(r5.violations.length === 0 && r5.kinds['call-rename'] === 1, '부르는 곳 이름 바꿈(go → xMod.go) 허용');
  const r6 = run(rows(APP, ["if(typeof P!=='undefined' && P.f) f();"]), rows(MOD, ['if(P.f) f();']));
  chk(r6.violations.length === 0 && r6.kinds['guard-drop'] === 1, 'typeof 가드 걷기 허용');
  const r7 = run(rows(APP, ['go(1);']), rows(APP, ['xMod.go(2);'], 10));
  chk(r7.violations.length === 2, 'mutation test: 이름 바꿈에 인자도 바뀌면 허용 밖');
}
{
  const head = { [APP]: ['a', 'const xMod = TwX.createX({', '  foo: ()=>foo,', '  bar,', '});', 'b'].join('\n') };
  const r = run([], rows(APP, ['const xMod = TwX.createX({', '  foo: ()=>foo,', '  bar,', '});'], 2), head);
  chk(r.violations.length === 0 && r.kinds.wiring === 3, '만드는 줄과 deps 줄 → wiring(닫는 `});` 는 scaffold)');
  const r2 = run([], rows(APP, ['doSomethingNew();'], 6), head);
  chk(r2.violations.length === 1, 'mutation test: 연결 블록 밖에 새 줄을 넣으면 허용 밖');
  const mhead = { [MOD]: ['x', 'function f(){}', 'return {', '  f,', '  g,', '};'].join('\n') };
  const r3 = run([], rows(MOD, ['return {', '  f,', '  g,', '};'], 3), mhead);
  chk(r3.violations.length === 0, '모듈 꼬리 return { … } → scaffold');
  const r4 = run([], rows(MOD, ['/* 설명', '   이어지는 줄 */'], 1), { [MOD]: '/* 설명\n   이어지는 줄 */\n' });
  chk(r4.violations.length === 0 && r4.kinds.comment === 2, '여러 줄 주석의 이어지는 줄 → comment');
  const r5 = run([], rows('apps/desktop/app/desk-companion-prototype.html', ['<script src="parts/room/x.js"></script>']));
  const r6 = run([], rows('apps/desktop/app/desk-companion-prototype.html', ['<script>alert(1)</script>']));
  chk(r5.violations.length === 0 && r6.violations.length === 1, 'html 은 script src 한 줄만 허용');
}

{
  /* 숨기면 안 되는 고침 — 모두 허용 밖이어야 한다 */
  const bad = (name, removed, added, head) => { const r = run(removed, added, head); chk(r.violations.length >= 1, 'mutation test: ' + name + ' → 허용 밖'); };
  bad('deps 로 받았지만 읽는 함수가 아닌 이름의 함수 참조 → 호출', rows(APP, ['el.onclick = handler;']), rows(MOD, ['const handler = deps.handler;', 'el.onclick = handler();']));
  bad('함수 참조 → xMod.go() 호출', rows(APP, ['el.onclick = go;']), rows(APP, ['el.onclick = xMod.go();'], 10));
  bad('부르는 모듈 바꿈(aMod.f → bMod.f)', rows(APP, ['aMod.f(1);']), rows(APP, ['bMod.f(1);'], 10));
  bad('밑줄 이름 → 다른 변수(_count → count)', rows(APP, ['_count = 5;']), rows(MOD, ['count = 5;']));
  bad('밑줄 함수 → 다른 함수(_go → go)', rows(APP, ['_go(1);']), rows(MOD, ['go(1);']));
  bad('가드 뜻 뒤집기(=== && 걷기)', rows(APP, ["if(typeof X === 'undefined' && X.f) f();"]), rows(MOD, ['if(X.f) f();']));
  bad('가드 뜻 뒤집기(!== || 걷기)', rows(APP, ["if(typeof X !== 'undefined' || X.f) f();"]), rows(MOD, ['if(X.f) f();']));
  bad('typeof 가드를 새로 더함', rows(APP, ['if(P.f) f();']), rows(MOD, ["if(typeof P!=='undefined' && P.f) f();"]));
  bad('코드 뒤에 주석이 붙은 줄을 끼움', [], rows(MOD, ['leak(); /* 설명 */']));
  bad('주석 앞에 코드가 붙은 줄', [], rows(MOD, ['/* 설명 */ leak();']));
  bad('deps 줄 뒤에 코드를 붙임', [], rows(MOD, ['const a = deps.a; leak();']));
  bad('다른 이름으로 deps 를 받음', [], rows(MOD, ['const a = deps.b;']));
  bad('window.TwX 줄 뒤에 코드를 붙임', [], rows(MOD, ['window.TwX = { createX }; leak();']));
  bad('window 에 새 전역 쓰기', [], rows(APP, ['window.isAdmin = true;'], 3), { [APP]: 'a\nb\nc\n' });
  bad('한 줄짜리 만드는 줄 다음의 코드', [], rows(APP, ['leak();'], 2), { [APP]: 'const xMod = TwX.createX(opts);\nleak();\n});\n' });
  bad('연결 블록 안에 문장을 끼움', [], rows(APP, ['  leak();'], 2), { [APP]: 'const xMod = TwX.createX({\n  leak();\n});\n' });
  bad('return 블록 밑(꼬리 뒤)에 코드를 끼움', [], rows(MOD, ['leak();'], 5), { [MOD]: 'x\nreturn {\n  f,\n};\nleak();\n' });
  const wrapHead = { [APP]: '  layoutSeats: ()=>layoutSeats(),\n  n: ()=>n,\n' };
  bad('늦게 부르는 감싸개 이름의 함수 참조 → 호출', rows(APP, ['window.addEventListener("resize", layoutSeats);']), rows(MOD, ['const layoutSeats = deps.layoutSeats;', 'window.addEventListener("resize", layoutSeats());']), wrapHead);
  bad('대입 자리의 접두사 붙임(count = 1 → xMod.count = 1)', rows(APP, ['count = 1;']), rows(APP, ['xMod.count = 1;'], 10));
  bad('다른 이름 가드 걷기', rows(APP, ["if(typeof A!=='undefined' && B) go();"]), rows(MOD, ['if(B) go();']));
  bad('이름이 부분만 겹치는 가드 걷기(seat / seats)', rows(APP, ["if(typeof seat!=='undefined' && seats.length) go();"]), rows(MOD, ['if(seats.length) go();']));
  bad('이름이 부분만 겹치는 가드 걷기(A / AB)', rows(APP, ["if(typeof A==='undefined' || AB.x) return;"]), rows(MOD, ['if(AB.x) return;']));
  bad('setter 와 한 줄에 있는 다른 변수의 밑줄 떼기', rows(APP, ['_x = v; _ready = 1;']), rows(MOD, ['setX(v); ready = 1;']));
  bad('setter 줄의 비교 변수 밑줄 떼기', rows(APP, ['if(_ok===true) _x = v;']), rows(MOD, ['if(ok===true) setX(v);']));
  const okSet = run(rows(APP, ['_x = v;']), rows(MOD, ['setX(v);']));
  chk(okSet.violations.length === 0 && okSet.kinds.setter === 1, '(바탕) _x = v → setX(v) 는 setter 로 허용');
  const ok = analyze([], rows(MOD, ['setSizeFactor: (v)=>{ sizeFactor = v; },'], 3), { headText: (f) => (f === MOD ? 'x\nreturn {\n  setSizeFactor: (v)=>{ sizeFactor = v; },\n};\n' : null), baseText: () => null });
  chk(ok.violations.length === 0, '모듈 꼬리의 쓰는 함수 칸 → scaffold');
}

say('2. 임시 git 저장소(진짜 diff · 종료 코드)');
const sh = (cwd, cmd, args) => spawnSync(cmd, args, { cwd, encoding: 'utf8' });
const gitc = (cwd, ...a) => sh(cwd, 'git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...a]);
function repo(){
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mv-'));
  gitc(d, 'init', '-q', '-b', 'main');
  fs.mkdirSync(path.join(d, 'apps/desktop/app/parts/room'), { recursive: true });
  fs.writeFileSync(path.join(d, APP), ['let n = 0;', 'function a(x){', '  return x + 1;', '}', 'function b(){', '  return n + a(2);', '}', 'start();', ''].join('\n'));
  gitc(d, 'add', '-A'); gitc(d, 'commit', '-qm', 'base');
  return d;
}
function moved(d, modLines, appLines, extra){
  fs.writeFileSync(path.join(d, MOD), modLines.join('\n') + '\n');
  fs.writeFileSync(path.join(d, APP), appLines.join('\n') + '\n');
  fs.mkdirSync(path.join(d, 'checks'), { recursive: true });
  fs.writeFileSync(path.join(d, 'checks/sim-x.txt'), 'sim 같은 줄을 안 보는 파일\n');
  if (extra) fs.writeFileSync(path.join(d, extra), 'x\n');
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
  chk(r.code === 1 && /return x \+ 2/.test(r.out), 'mutation test: 옮기며 한 글자(1→2) 바꿈 → 종료 1 · 그 줄이 목록에');
  fs.rmSync(d, { recursive: true, force: true });
}
{
  const d = repo();
  const r = moved(d, [...HEAD, 'function a(x){', '  return x + 1;', '}', 'function b(){', '}', ...TAIL], WIRE);
  chk(r.code === 1 && /return n \+ a\(2\)/.test(r.out), 'mutation test: 한 줄 빠뜨림 → 종료 1 · 빠진 줄이 목록에');
  fs.rmSync(d, { recursive: true, force: true });
}
{
  const d = repo();
  const r = moved(d, [...HEAD, 'function a(x){', '  return x + 1;', '}', 'function b(){', '  return n() + a(2);', '}', ...TAIL], ['let n = 0;', 'const xMod = TwX.createX({', '  n: ()=>n,', '});', 'start(); leak();']);
  chk(r.code === 1 && /leak/.test(r.out), 'mutation test: app.js 에 끼워 넣은 줄 → 종료 1');
  fs.rmSync(d, { recursive: true, force: true });
}

{
  const d = repo();
  const r = moved(d, [...HEAD, 'function a(x){', '  return x + 1;', '}', 'function b(){', '  return n() + a(2);', '}', ...TAIL], WIRE, 'main.js');
  chk(r.code === 1 && /main\.js/.test(r.out), 'mutation test: app 밖 파일(main.js)이 같이 바뀜 → 종료 1 · 파일 이름이 목록에');
  fs.rmSync(d, { recursive: true, force: true });
}

say(`\n판정 ${pass}/${pass + fail} · 빨강 ${fail}`);
process.exit(fail ? 1 : 0);
