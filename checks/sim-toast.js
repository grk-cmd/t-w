/* ═══ 🍞 sim-toast.js — 🍞 토스트 · 저장 실패 문구 모듈 구조 (2026-10-16 신설 · 구역 떼기 C · w2) ═══════════════
   app.js 의 토스트 · 저장 실패 문구 본문 을 parts/shared/toast.js 로 옮겼다(글자 그대로 · 바뀐 줄 0 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(4절 — 가짜 DOM · 타이머로 띄우기 · 끄기 · 그림 · 시간 경계 · 거부 문구).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(_saveFailMsg · toast)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 0줄 그대로 · 부르는 줄은 옛 이름 그대로 · 이음 함수 둘 · html(app.js 앞)
   ・4절: 동작 — 순수 판정 · 가짜 객체로 입력 → 출력 · 경계값(옮기기 전 app.js 글로도 같은 판정이 돈다)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · toast.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["toast.js","parts/shared/toast.js","app/parts/shared/toast.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — toast.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = [];
const VAL_DEPS = [];
const GET_DEPS = [];
const SET_DEPS = [];
const EXPORTS = ["_saveFailMsg","toast"];
const MOVED = ["_saveFailMsg","toastT","toast"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
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
    src + '\nreturn window.TwToast;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined, class { observe(){} disconnect(){} }, class { observe(){} disconnect(){} });
  return api.createToast(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwToast = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwToast(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("TOAST_MOD_OFF") && app.includes("const toastMod = TwToast.createToast({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const toastMod = TwToast\\.createToast\\(\\{\\n([\\s\\S]*?)\\n?\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = (mk ? mk.split('\n') : []).map(kindOf);   // deps 가 하나도 없으면 «({\n});»
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  /* 같은 이름의 딴 지역 변수가 app.js 에 따로 있는 이름(예: 함수 안 let)은 이 판정에서 뺀다 — 설정 localSame */
  /* 부르는 줄은 옛 이름 그대로 둔다(app.js 150여 곳 · 다른 파일 · window.toast) — 대신 같은 이름의 이음 함수 둘이 모듈로 넘기는지 본다 */
  const shim = (n) => new RegExp('^function ' + n + '\\(\\.\\.\\.a\\)\\{ return toastMod\\.' + n + '\\(\\.\\.\\.a\\); \\}   // 옛 전역 이름', 'm').test(app);
  const stray = app.split('\n').filter(l => l.includes('toastMod.') && !l.includes('// 옛 전역 이름')).length;
  t(EXPORTS.every(shim) && !stray, '부르는 곳은 옛 이름 그대로 — 이음 함수 둘(toast · _saveFailMsg)만 toastMod.이름 으로 넘긴다' + (stray ? ' — 이음 함수 밖 toastMod. ' + stray + '곳' : ''));
  const iM = html.indexOf('<script src="parts/shared/toast.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/shared/toast.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/shared/toast.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  /* deps 가 없는 모듈이면 거꾸로 한 줄을 끼워 넣어 본다(키 수가 어긋나야 잡힌다) */
  ['deps 하나 빠짐', null, GLUE.length ? (a => { const i = a.indexOf("const toastMod = TwToast.createToast({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }) : (a => a.replace("const toastMod = TwToast.createToast({", "const toastMod = TwToast.createToast({" + '\n  _extra: 1,')), null],
  ['전역 이름 안 걺', m => m.replace('window.TwToast = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* «옛 전역 이름» 이음 줄이 아닌 자리에서 하나를 옛 이름으로 되돌린다(이음 줄은 판정에서 빠진다) */
  ['이음 함수 빠짐', null, a => a.replace(/^function toast\(\.\.\.a\)[^\n]*\n/m, ''), null],
  ['만들 때 던짐', m => m.replace('function createToast(deps){', 'function createToast(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}

/* ── 4. 동작 — 가짜 DOM · 타이머 위에서 토스트 띄우기 · 지우기 · 저장 실패 문구(옮기기 전 app.js 글로도 같은 판정이 돈다) */
say('── 4. 동작 — 토스트 · 저장 실패 문구');
{
  const PREMOVE = !!process.env.TW_PREMOVE;
  const load = () => {
    const log = { timers: [], cleared: [] };
    let seq = 0;
    const el = { textContent: '', cls: new Set(), kids: [], classList: null, prepend(n){ this.kids.unshift(n); } };
    el.classList = { add: (c) => el.cls.add(c), remove: (c) => el.cls.delete(c) };
    Object.defineProperty(el, 'textContent', { get(){ return this._t; }, set(v){ this._t = v; this.kids = []; } });
    const doc = { getElementById: (id) => id === 'toast' ? el : null, createElement: (t) => ({ tag: t, style: {} }) };
    const st = (fn, ms) => { const id = ++seq; log.timers.push({ id, fn, ms }); return id; };
    const ct = (id) => log.cleared.push(id);
    let api;
    if(!PREMOVE){
      const w = {}; new Function('window', 'module', 'document', 'setTimeout', 'clearTimeout', MOD)(w, undefined, doc, st, ct);
      api = w.TwToast.createToast({});
    } else {
      const a = SRC.indexOf('/* --- toast --- */'), b = SRC.indexOf('/* ============================================================ ANIM', a);
      api = new Function('document', 'setTimeout', 'clearTimeout', SRC.slice(a, b) + '\nreturn { toast, _saveFailMsg };')(doc, st, ct);
    }
    return { api, log, el };
  };
  const { api, log, el } = load();
  const M = api._saveFailMsg;
  const ADMIN = '권한이 없어요 — 관리자 계정으로 로그인했는지 확인해 주세요', NET = '저장에 실패했어요 — 인터넷 연결을 확인해 주세요';
  chk(M({ code: 'PERMISSION_DENIED' }) === ADMIN && M({ message: 'permission-denied: x' }) === ADMIN && M({ code: 'permission_denied' }) === ADMIN && M({ message: 'Client: PERMISSION DENIED' }) !== ADMIN, '_saveFailMsg — 규칙 거부(PERMISSION_DENIED · permission-denied · 대소문자 무관)면 «관리자 계정으로 로그인» 안내(띄어쓰기 사이는 아님)');
  chk(M({ code: 'unavailable' }) === NET && M(null) === NET && M(undefined, '') === NET && M({ message: 'x' }, '전송 실패') === '전송 실패', '  그 밖엔 넘겨 준 문구 · 없거나 빈 글이면 «인터넷 연결을 확인해 주세요»');
  chk(M({ code: 'PERMISSION_DENIED' }, '전송 실패') === ADMIN, '  거부면 넘겨 준 문구보다 권한 안내가 먼저');
  api.toast('안녕');
  chk(el.textContent === '안녕' && el.cls.has('on') && log.timers[0].ms === 1900 && !el.kids.length, 'toast — 글(textContent)을 넣고 on · 1.9초 뒤 끈다');
  log.timers[0].fn();
  chk(!el.cls.has('on'), '  시간이 되면 on 을 뗀다');
  api.toast('<b>x</b>', 'icon.png', 5000);
  chk(el.textContent === '<b>x</b>' && el.kids.length === 1 && el.kids[0].tag === 'img' && el.kids[0].src === 'icon.png' && /width:16px/.test(el.kids[0].style.cssText) && log.timers[1].ms === 5000, '  그림은 글 앞에 img 로 끼운다(글은 HTML 로 안 읽는다) · 시간을 주면 그만큼');
  chk(log.cleared[1] === log.timers[0].id, '  새 토스트는 앞 타이머를 지운다(먼저 꺼지지 않게)');
  api.toast('a', null, 0); api.toast('b', null, -5); api.toast('c', null, '3000');
  chk(log.timers.slice(2).every(t => t.ms === 1900), '  경계 — 0 · 음수 · 숫자 아닌 시간은 1.9초');
  api.toast('d', '');
  chk(!el.kids.length, '  빈 그림 주소는 img 를 안 만든다');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
