/* ═══ 🍚 sim-user-status-table.js — 🍚 상태 표 · 커스텀 상태 저장값 모듈 구조 (2026-10-16 신설 · 구역 떼기 C · w1) ═══════════════
   app.js 의 상태 표 · 커스텀 상태 저장값 을 parts/status/user-status-table.js 로 옮겼다(글자 그대로 · 바뀐 줄 0 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(4절 — 표 · 불러오기 · 자르기).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(CUSTOM_STATUS_KEY · CUSTOM_STATUS_MAXLEN · USER_STATUSES · customStatusConf · setCustomStatusConf · loadCustomStatusFromStorage)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 0줄 그대로 · 부르는 곳은 userStatusTableMod.이름 · html(app.js 앞)
   ・4절: 동작 — 순수 판정 · 가짜 객체로 입력 → 출력 · 경계값(옮기기 전 app.js 글로도 같은 판정이 돈다)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · user-status-table.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["user-status-table.js","parts/status/user-status-table.js","app/parts/status/user-status-table.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — user-status-table.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = [];
const VAL_DEPS = [];
const GET_DEPS = [];
const SET_DEPS = [];
const EXPORTS = ["CUSTOM_STATUS_KEY","CUSTOM_STATUS_MAXLEN","USER_STATUSES","customStatusConf","setCustomStatusConf","loadCustomStatusFromStorage"];
const MOVED = ["USER_STATUSES","CUSTOM_STATUS_KEY","CUSTOM_STATUS_MAXLEN","customStatusConf","loadCustomStatusFromStorage"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = [];

/* 아무 이름 · 아무 부름이나 받아 주는 가짜 — 만들 때 하는 일(버튼 연결 · 저장값 읽기)이 던지지 않는지만 본다.
   then 도 받는다 — 만들 때 부르는 서버 요청(.then 잇기)이 던지지 않게(풀리지는 않는다) */
function anything(){
  const f = function(){ return P; };
  const P = new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? (() => '') : k === 'then' ? (() => P) : k === 'length' ? 0 : P, apply: () => P, construct: () => P, set: () => true, has: () => true });
  return P;
}
function build(src){
  const any = anything();
  const deps = {};
  FN_DEPS.forEach(n => { deps[n] = () => any; });
  VAL_DEPS.forEach(n => { deps[n] = any; });
  GET_DEPS.forEach(n => { deps[n] = () => any; });
  SET_DEPS.forEach(n => { deps['set' + n.replace(/^_+/, '').replace(/^./, c => c.toUpperCase())] = () => {}; });
  const win = new Proxy({}, { get: (t, k) => k in t ? t[k] : any, set: (t, k, v) => { t[k] = v; return true; } });
  const store = {};
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'addEventListener', 'removeEventListener', 'module', 'MutationObserver', 'ResizeObserver',
    src + '\nreturn window.TwUserStatusTable;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined, class { observe(){} disconnect(){} }, class { observe(){} disconnect(){} });
  return api.createUserStatusTable(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwUserStatusTable = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwUserStatusTable(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("USER_STATUS_TABLE_MOD_OFF") && app.includes("const userStatusTableMod = TwUserStatusTable.createUserStatusTable({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const userStatusTableMod = TwUserStatusTable\\.createUserStatusTable\\(\\{\\n([\\s\\S]*?)\\n?\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = (mk ? mk.split('\n') : []).map(kindOf);   // deps 가 하나도 없으면 «({\n});»
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  /* 같은 이름의 딴 지역 변수가 app.js 에 따로 있는 이름(예: 함수 안 let)은 이 판정에서 뺀다 — 설정 localSame */
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:]|\\(\\)\\{\\})').test(A.replace(/const userStatusTableMod = [\s\S]*?\n\}\);/, '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''")));   // 따옴표 글자 안의 이름(안내 문구)은 부르는 곳이 아니다
  t(!bare.length, '부르는 곳은 userStatusTableMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/status/user-status-table.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/status/user-status-table.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/status/user-status-table.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  /* deps 가 없는 모듈이면 거꾸로 한 줄을 끼워 넣어 본다(키 수가 어긋나야 잡힌다) */
  ['deps 하나 빠짐', null, GLUE.length ? (a => { const i = a.indexOf("const userStatusTableMod = TwUserStatusTable.createUserStatusTable({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }) : (a => a.replace("const userStatusTableMod = TwUserStatusTable.createUserStatusTable({", "const userStatusTableMod = TwUserStatusTable.createUserStatusTable({" + '\n  _extra: 1,')), null],
  ['전역 이름 안 걺', m => m.replace('window.TwUserStatusTable = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* «옛 전역 이름» 이음 줄이 아닌 자리에서 하나를 옛 이름으로 되돌린다(이음 줄은 판정에서 빠진다) */
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith('const userStatusTableMod =')) continue; const n = EXPORTS.find(x => ls[i].includes('userStatusTableMod.' + x)); if(n){ ls[i] = ls[i].replace('userStatusTableMod.' + n, n); return ls.join('\n'); } } return a + '\n' + EXPORTS[0] + '(true);'; }, null],   // app.js 에 부르는 자리가 없으면(다른 모듈만 부른다) 옛 이름 부름을 끼워 본다
  ['만들 때 던짐', m => m.replace('function createUserStatusTable(deps){', 'function createUserStatusTable(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
/* ── 4. 동작 — 상태 표 · 커스텀 상태 저장값 불러오기(옮기기 전 app.js 글로도 같은 판정) */
say('── 4. 동작 — 상태 표 · 커스텀 상태 저장값');
{
  function mk(store){
    const ls = { getItem: (k) => (k in store ? store[k] : null) };
    if(typeof MOD === 'string' && MOD){
      const win = {}; new Function('window', 'module', 'localStorage', MOD)(win, undefined, ls);
      const m = win.TwUserStatusTable.createUserStatusTable({});
      return Object.assign({}, m, { cs: () => m.customStatusConf() });
    }
    const a = SRC.indexOf('const USER_STATUSES = {'), a2 = SRC.indexOf('\n};\n', a) + 4;
    const b = SRC.indexOf('/* ✨ 커스텀 상태 (프리미엄)'), b2 = SRC.indexOf('function saveCustomStatusConf(');
    return new Function('localStorage', SRC.slice(a, a2) + SRC.slice(b, b2) + '\nreturn { USER_STATUSES, CUSTOM_STATUS_KEY, CUSTOM_STATUS_MAXLEN, loadCustomStatusFromStorage, cs: () => customStatusConf };')(ls);
  }
  const J = (x) => JSON.stringify(x);
  let T = mk({});
  chk(J(Object.keys(T.USER_STATUSES)) === J(['meal', 'away', 'grind', 'gaming', 'custom']), '상태 표 — 다섯 상태(차례 그대로)');
  chk(T.USER_STATUSES.away.forceSleep === true && T.USER_STATUSES.away.opacity === 0 && T.USER_STATUSES.grind.idleTweak === true && T.USER_STATUSES.meal.idleTweak === true && !T.USER_STATUSES.gaming.idleTweak, '  자리비움은 sleep 강제 · 투명 · 밥 · 빡일중은 idle 변형');
  chk(Object.values(T.USER_STATUSES).every(s => /^#[0-9a-f]{6}$/.test(s.dot) && s.emo && s.label), '  모두 이모지 · 이름 · 점 색(#rrggbb)');
  chk(T.CUSTOM_STATUS_KEY === 'tw.customStatus' && T.CUSTOM_STATUS_MAXLEN === 12 && J(T.cs()) === J({ emo: '', text: '' }), '커스텀 — 저장 키 · 12자 · 처음엔 빈 값');
  T.loadCustomStatusFromStorage(); chk(J(T.cs()) === J({ emo: '', text: '' }), '  저장값이 없으면 그대로');
  T = mk({ 'tw.customStatus': J({ emo: '🐱🐶🐭', text: '가나다라마바사아자차카타파하' }) }); T.loadCustomStatusFromStorage();
  chk(T.cs().emo === '🐱' && T.cs().text === '가나다라마바사아자차카타', '  불러오기 — 이모지 2 코드유닛 · 문구 12자로 자른다');
  T = mk({ 'tw.customStatus': '{깨짐' }); T.loadCustomStatusFromStorage(); chk(J(T.cs()) === J({ emo: '', text: '' }), '  깨진 저장값은 무시');
  T = mk({ 'tw.customStatus': J({ emo: 3, text: null }) }); T.loadCustomStatusFromStorage(); chk(J(T.cs()) === J({ emo: '', text: '' }), '  글자가 아니면 빈 값');
  T = mk({ 'tw.customStatus': '"문자열"' }); T.loadCustomStatusFromStorage(); chk(J(T.cs()) === J({ emo: '', text: '' }), '  객체가 아니면 무시');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
