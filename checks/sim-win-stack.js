/* ═══ 🪟 sim-win-stack.js — 🪟 창 겹침 모듈 구조 (2026-10-14 신설 · 앱 FSD 42번) ═══════════════
   app.js 의 창 겹침 구역 본문 을 parts/shared/win-stack.js 로 옮겼다(글자 그대로 · 바뀐 줄 0 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(창 겹침 검사들).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(_escEditable · bringWinToFront · escRegisterWindow)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 0줄 그대로 · 부르는 곳은 winStackMod.이름 · html(app.js 앞)
   ・3절: mutation test — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · win-stack.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["win-stack.js","parts/shared/win-stack.js","app/parts/shared/win-stack.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — win-stack.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = ["backToLauncher"];
const VAL_DEPS = [];
const GET_DEPS = ["closers"];
const SET_DEPS = [];
const EXPORTS = ["closeAll","_escEditable","bringWinToFront","escRegisterWindow"];
const MOVED = ["WIN_Z_MIN","WIN_Z_MAX","_WIN_Z_LAYERS","_winZTop","_winZOf","bringWinToFront","ESC_CLOSE_ORDER","ESC_YIELD_SEL","_escWins","_escOrder","escRegisterWindow","_escSync","_escTop","_escEditable"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  closers: ()=>windowClosers,","  backToLauncher: (...a)=>backToLauncher(...a),"];

/* 아무 이름 · 아무 부름이나 받아 주는 가짜 — 만들 때 하는 일(버튼 연결 · 저장값 읽기)이 던지지 않는지만 본다.
   then 도 받는다 — 만들 때 부르는 서버 요청(.then 잇기)이 던지지 않게(풀리지는 않는다) */
function anything(){
  const f = function(){ return P; };
  const P = new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? (() => '') : k === 'then' ? (() => P) : k === 'length' ? 0 : P, apply: () => P, construct: () => P, set: () => true, has: () => true });
  return P;
}
function build(src, over){
  const any = anything();
  const deps = {};
  FN_DEPS.forEach(n => { deps[n] = () => any; });
  VAL_DEPS.forEach(n => { deps[n] = any; });
  GET_DEPS.forEach(n => { deps[n] = () => any; });
  SET_DEPS.forEach(n => { deps['set' + n.replace(/^_+/, '').replace(/^./, c => c.toUpperCase())] = () => {}; });
  const win = new Proxy({}, { get: (t, k) => k in t ? t[k] : any, set: (t, k, v) => { t[k] = v; return true; } });
  const store = {};
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'addEventListener', 'removeEventListener', 'module',
    src + '\nreturn window.TwWinStack;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined);
  return api.createWinStack(Object.assign(deps, over || {}));
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwWinStack = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwWinStack(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("WIN_STACK_MOD_OFF") && app.includes("const winStackMod = TwWinStack.createWinStack({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const winStackMod = TwWinStack\\.createWinStack\\(\\{\\n([\\s\\S]*?)\\n?\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = (mk ? mk.split('\n') : []).map(kindOf);   // deps 가 하나도 없으면 «({\n});»
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  /* 같은 이름의 딴 지역 변수가 app.js 에 따로 있는 이름(예: 함수 안 let)은 이 판정에서 뺀다 — 설정 localSame */
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:])').test(A.replace(/const winStackMod = [\s\S]*?\n\}\);/, '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''")));   // 따옴표 글자 안의 이름(안내 문구)은 부르는 곳이 아니다
  t(!bare.length, '부르는 곳은 winStackMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/shared/win-stack.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/shared/win-stack.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 2-2. 모두 닫기(closeAll) — 실제로 굴린다');
/* 가짜 창 둘(ESC 스택에 태운 것) + 표의 창들. 닫는 길마다 «닫힘 · 안 닫힘 · 던짐» 을 흉내낸다 */
function behave(mod){
  const log = [], warns = [], r = {};
  const old = console.warn; console.warn = (...a) => { warns.push(a.map(String).join(' ')); };
  try{
    const mkWin = (key, mode) => { const w = { key, open: true, el: {}, isOpen: () => w.open, close: () => { log.push('esc:' + key); if(mode === 'throw') throw new Error('x'); if(mode !== 'stuck') w.open = false; } }; return w; };
    const row = (key, mode, startOpen = true) => { const c = { key, open: startOpen, isOpen: () => c.open, close: () => { log.push('row:' + key); if(mode === 'throw') throw new Error('x'); if(mode !== 'stuck') c.open = false; } }; return c; };
    const run = (winModes, rowSpecs) => {
      log.length = 0; warns.length = 0;
      const rows = rowSpecs.map(([k, m, o]) => row(k, m, o));
      const api = build(mod, { closers: () => rows, backToLauncher: () => { log.push('launcher'); } });
      winModes.forEach(([k, m]) => api.escRegisterWindow(mkWin(k, m)));
      const stuck = api.closeAll();
      return { stuck, log: log.slice(), warns: warns.slice(), rows };
    };
    const a = run([['A'], ['B']], [['chat'], ['gacha', null, false], ['creator']]);
    r.all = a.stuck.length === 0 && a.log.join() === 'esc:B,esc:A,row:chat,row:creator,launcher' && a.warns.length === 0;   // 꼭대기(나중에 연 것)부터 · 안 열린 창은 건드리지 않음 · 런처가 맨 끝
    const b = run([['A', 'stuck'], ['B']], [['chat', 'stuck'], ['gacha'], ['creator', 'throw']]);
    const top = run([['A'], ['B', 'throw'], ['C', 'stuck']], []);   // 꼭대기(C 안 닫힘 · B 던짐) 아래의 A 도 닫힌다
    r.belowClosed = top.log.includes('esc:A') && top.stuck.includes('C') && top.stuck.includes('B') && !top.stuck.includes('A') && top.warns.length >= 2;
    r.loud = b.stuck.join() === 'A,chat,creator' || b.stuck.join() === 'chat,creator,A' || (b.stuck.includes('chat') && b.stuck.includes('creator') && b.stuck.includes('A'));
    r.loudWarn = b.warns.length >= 3 && b.warns.every(w => /모두 닫기/.test(w));
    r.goesOn = b.log.includes('row:gacha') && b.log[b.log.length - 1] === 'launcher' && b.rows[1].open === false;   // 한 창이 못 닫혀도 나머지는 닫힌다 · 런처는 늘 끝에
    const c = run([], [['chat']]);
    r.noStack = c.log.join() === 'row:chat,launcher';
  }finally{ console.warn = old; }
  return r;
}
{
  const R = behave(MOD);
  chk(R.all, '열린 창만 닫는다 — ESC 스택은 꼭대기부터 · 표의 창은 열려 있는 것만 · 런처로 돌아가기가 맨 끝');
  chk(R.loud && R.loudWarn, '★ 닫히지 않거나 던진 창은 조용히 넘기지 않는다 — 경고하고 돌려주는 key 목록에 든다');
  chk(R.goesOn && R.belowClosed, '  한 창이 못 닫혀도 나머지는 계속 닫고 런처로 돌아간다 — ESC 스택 꼭대기가 던지거나 안 닫혀도 그 아래 창이 닫힌다');
  chk(R.noStack, '  ESC 스택에 태운 창이 없어도 돈다');
}
say('── 3. mutation test — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/shared/win-stack.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  /* deps 가 없는 모듈이면 거꾸로 한 줄을 끼워 넣어 본다(키 수가 어긋나야 잡힌다) */
  ['deps 하나 빠짐', null, GLUE.length ? (a => { const i = a.indexOf("const winStackMod = TwWinStack.createWinStack({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }) : (a => a.replace("const winStackMod = TwWinStack.createWinStack({", "const winStackMod = TwWinStack.createWinStack({" + '\n  _extra: 1,')), null],
  ['전역 이름 안 걺', m => m.replace('window.TwWinStack = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* «옛 전역 이름» 이음 줄이 아닌 자리에서 하나를 옛 이름으로 되돌린다(이음 줄은 판정에서 빠진다) */
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith('const winStackMod =')) continue; const n = EXPORTS.find(x => ls[i].includes('winStackMod.' + x)); if(n){ ls[i] = ls[i].replace('winStackMod.' + n, n); return ls.join('\n'); } } return a; }, null],
  ['만들 때 던짐', m => m.replace('function createWinStack(deps){', 'function createWinStack(deps){ throw new Error("mutation");'), null, null],
];
{
  const br = (from, to) => MOD.includes(from) ? behave(MOD.replace(from, to)) : null;
  const b1 = br("try{ backToLauncher(); }catch(e){", "try{ }catch(e){");
  chk(b1 && !b1.all, 'mutation test — 런처로 돌아가기를 빼면 빨강');
  const b2 = br("console.warn('[창] 모두 닫기 — ' + w.key + ' 이(가) 닫히지 않았어요'); skip.add(w.key); stuck.push(w.key); }", "skip.add(w.key); }");
  chk(b2 && !b2.loud, 'mutation test — 닫히지 않은 ESC 창을 경고 없이 넘기면 빨강');
  const b5 = br("skip.add(w.key); stuck.push(w.key); continue; }", "break; }");
  chk(b5 && !b5.belowClosed, 'mutation test — 꼭대기 창이 던졌을 때 멈추면(아래 창이 열린 채 남음) 빨강');
  const b3 = br("    if(still){ console.warn('[창] 모두 닫기 — ' + c.key + ' 이(가) 닫히지 않았어요'); stuck.push(c.key); }", "");
  chk(b3 && !b3.loud, 'mutation test — 닫았는데 열려 있는 표의 창을 못 알아채면 빨강');
  const b4 = br("if(!open) return;\n    try{ c.close(); }", "try{ c.close(); }");
  chk(b4 && !b4.all, 'mutation test — 안 열린 창까지 닫으면 빨강');
}
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
