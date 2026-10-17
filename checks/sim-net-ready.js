/* sim-net-ready.js — 🛰 «네트워크(provider) 준비됨» 기다리기 한 곳(shared/net-ready.js)
   실행:  node sim-net-ready.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — «연결이 있으면 바로, 없으면 firebase-ready 를 한 번 기다림» 판단이 15곳에 따로 있던 것을 묶었다.
     서버 이관 때 준비 신호를 갈아 끼울 자리가 이 파일 하나뿐이려면, 이벤트에 직접 귀를 대는 곳이 다시 생기면 안 된다.
   ・1절: whenNetReady — 준비면 바로(기다리지 않음) · 아니면 once 로 한 번 · need(함수 이름)가 없으면 기다림 · 신호 뒤 부름
   ・2절: onNetReady(once 없음 — 두 번 오면 두 번) · waitNetReady(ms) — 신호면 true · 시간이 다 되면 그때 연결 유무 · 한 번만 풀림
   ・3절: firebase-ready 에 직접 addEventListener 하는 곳 0곳(이 모듈 빼고) · 쓰는 파일 열한 곳이 TwNetReady 를 부른다 · html 순서 · smoke PRELOAD
   ・4절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, 'checks/' + f, path.basename(f)]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('shared/net-ready.js'), HTML = read('desk-companion-prototype.html'), SMOKE = read('smoke.js');
if (!MOD || !HTML || !SMOKE) { say('  ? 원본 못 찾음 — net-ready.js · desk-companion-prototype.html · smoke.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
/* TwNetReady 를 부르는 파일(묶을 때의 15곳 — app.js 넷 · room-entry 둘 · 나머지 하나씩) */
const USERS = ['app.js', 'launcher/ad-banner.js', 'room/room-entry.js', 'room/room-invite-ui.js', 'room/overhead.js', 'room/room-sync.js',
  'character/catalog-source.js', 'myhome/scheduler.js', 'account/license-request.js', 'support/bug-board-ui.js', 'account/my-info.js'];
const EVT_RE = /addEventListener\(\s*['"`]firebase-ready['"`]/;

/* 가짜 window — 귀(once 표시) · 타이머는 손으로 */
function mkWin(api) {
  const w = { firebaseAPI: api, L: [], T: [] };
  w.addEventListener = (t, fn, o) => w.L.push({ t, fn, once: !!(o && o.once) });
  w.fire = (t) => { const hit = w.L.filter(l => l.t === t); w.L = w.L.filter(l => !(l.t === t && l.once)); hit.forEach(l => l.fn({ type: t })); };
  return w;
}
function load(mod, win) {
  const T = [];
  new Function('window', 'module', 'setTimeout', mod)(win, undefined, (fn, ms) => { T.push({ fn, ms }); return T.length; });
  win.T = T;
  return win.TwNetReady;
}
const flush = async () => { for (let i = 0; i < 4; i++) await Promise.resolve(); };

async function judge(mod, html, smoke, files) {
  const r = {};
  try {
    let w = mkWin({}), N = load(mod, w), n = 0;
    r.event = N.NET_READY_EVENT === 'firebase-ready';
    N.whenNetReady(() => n++);
    r.readyNow = n === 1 && w.L.length === 0;
    w = mkWin(undefined); N = load(mod, w); n = 0;
    N.whenNetReady(() => n++);
    r.waitOnce = n === 0 && w.L.length === 1 && w.L[0].t === 'firebase-ready' && w.L[0].once;
    w.firebaseAPI = {}; w.fire('firebase-ready'); w.fire('firebase-ready');
    r.firedOnce = n === 1;
    w = mkWin({ subscribeMyFriends() {} }); N = load(mod, w); n = 0;
    N.whenNetReady(() => n++, 'subscribeMyFriends');
    r.needHas = n === 1 && !w.L.length;
    w = mkWin({}); N = load(mod, w); n = 0;
    N.whenNetReady(() => n++, 'subscribeMyFriends');
    r.needMissing = n === 0 && w.L.length === 1 && w.L[0].once;
    r.isReady = N.isNetReady() === true && N.isNetReady('subscribeMyFriends') === false && load(mod, mkWin(null)).isNetReady() === false;
    /* 이벤트가 인자를 넘기던 자리 — 귀에 건 함수가 그대로 받는다 */
    w = mkWin(undefined); N = load(mod, w); let arg = null;
    N.whenNetReady((e) => { arg = e; }); w.fire('firebase-ready');
    r.passEvent = arg && arg.type === 'firebase-ready';
    /* onNetReady — once 없음 */
    w = mkWin(undefined); N = load(mod, w); n = 0;
    N.onNetReady(() => n++);
    r.onNoOnce = w.L.length === 1 && !w.L[0].once;
    w.fire('firebase-ready'); w.fire('firebase-ready');
    r.onTwice = n === 2;
    /* waitNetReady */
    w = mkWin({}); N = load(mod, w);
    r.waitReady = (await N.waitNetReady(10000)) === true && !w.L.length && !w.T.length;
    w = mkWin(undefined); N = load(mod, w);
    let p = N.waitNetReady(10000); w.firebaseAPI = {}; w.fire('firebase-ready');
    r.waitSignal = (await p) === true && w.T.length === 1 && w.T[0].ms === 10000;
    w = mkWin(undefined); N = load(mod, w);
    p = N.waitNetReady(10); let got = 'pending'; p.then(v => { got = v; });
    w.T[0].fn(); await flush();
    r.waitTimeout = got === false;
    w.firebaseAPI = {}; w.fire('firebase-ready'); await flush();
    r.waitSettleOnce = got === false;
    w = mkWin(undefined); N = load(mod, w);
    p = N.waitNetReady(10); w.firebaseAPI = {}; w.T[0].fn();
    r.waitTimeoutLate = (await p) === true;
  } catch (e) { r.err = String(e && e.message || e); }
  r.direct = files.filter(([f, t]) => f !== 'shared/net-ready.js' && EVT_RE.test(strip(t))).map(([f]) => f);
  r.notUsing = USERS.filter(u => { const t = (files.find(([f]) => f === u) || [])[1]; return !t || !/\bTwNetReady\.(whenNetReady|onNetReady|waitNetReady)\(/.test(strip(t)); });
  const iN = html.indexOf('<script src="parts/shared/net-ready.js"></script>');
  r.late = iN < 0 ? ['net-ready.js 없음'] : USERS.filter(u => { const i = html.indexOf('<script src="parts/' + u + '"></script>'); return i >= 0 && i < iN; });
  r.firstBeforeApp = iN > 0 && iN < html.indexOf('<script src="parts/app.js"></script>');
  r.smoke = /^PRELOAD\.push\('net-ready\.js'\);$/m.test(smoke);
  return r;
}

(async () => {
const SRCS = [...HTML.matchAll(/<script(?: type="module")? src="parts\/([^"]+\.js)"/g)].map(m => m[1]);
const FILES = SRCS.map(f => [f, read(f)]).filter(([, t]) => t);
const R = await judge(MOD, HTML, SMOKE, FILES);

say('── 1. whenNetReady');
chk(!R.err && R.event, '준비 신호 이름은 firebase-ready 한 곳(NET_READY_EVENT)' + (R.err ? ' — ' + R.err : ''));
chk(R.readyNow, '연결이 있으면 바로 부르고 귀를 대지 않는다');
chk(R.waitOnce, '없으면 부르지 않고 firebase-ready 에 once 로 한 번 귀를 댄다');
chk(R.firedOnce, '  신호가 두 번 와도 한 번만 부른다');
chk(R.needHas, 'need — firebaseAPI 에 그 함수가 있으면 바로');
chk(R.needMissing, '  연결은 있어도 그 함수가 없으면 기다린다(예전 «firebaseAPI && firebaseAPI.subscribeX» 와 같다)');
chk(R.isReady, 'isNetReady — 연결 유무 · need 함수 유무');
chk(R.passEvent, '귀에 건 함수는 이벤트를 그대로 받는다(예전에 함수를 바로 걸던 자리와 같다)');
say('── 2. onNetReady · waitNetReady');
chk(R.onNoOnce && R.onTwice, 'onNetReady — once 없음 · 두 번 오면 두 번(overhead · room-sync 의 예전 귀 그대로)');
chk(R.waitReady, 'waitNetReady — 이미 있으면 바로 true · 귀도 타이머도 없음');
chk(R.waitSignal, '  신호가 오면 true · 시간 제한은 받은 ms 그대로');
chk(R.waitTimeout && R.waitSettleOnce, '  시간이 다 되면 false · 그 뒤 신호는 아무 일도 안 함(한 번만 풀림)');
chk(R.waitTimeoutLate, '  시간이 다 될 때 연결이 생겨 있으면 true');
say('── 3. 쓰는 곳 · 싣는 순서');
chk(!R.direct.length, 'firebase-ready 에 직접 addEventListener 하는 곳 0곳(이 모듈 빼고)' + (R.direct.length ? ' — ' + R.direct.join(' · ') : ''));
chk(!R.notUsing.length, '쓰는 파일 ' + USERS.length + '곳이 TwNetReady 로 기다린다' + (R.notUsing.length ? ' — 빠짐 ' + R.notUsing.join(' · ') : ''));
chk(!R.late.length && R.firstBeforeApp, 'html — net-ready.js 를 쓰는 모듈 · app.js 보다 먼저 싣는다' + (R.late.length ? ' — ' + R.late.join(' · ') : ''));
chk(R.smoke, 'smoke.js PRELOAD 에 net-ready.js');

say('── 4. 일부러 깨 보기');
const bk = async (mod, files, html, smoke) => judge(mod || MOD, html || HTML, smoke || SMOKE, files || FILES);
let b = await bk(MOD.replace('window.addEventListener(NET_READY_EVENT, cb, { once:true });', 'window.addEventListener(NET_READY_EVENT, cb);'));
chk(!b.waitOnce || !b.firedOnce, 'whenNetReady 에서 once 를 빼면 빨강');
b = await bk(MOD.replace("if(isNetReady(need)){ cb(); return; }", ''));
chk(!b.readyNow, '준비돼 있어도 기다리게 바꾸면 빨강');
b = await bk(MOD.replace('return need ? !!api[need] : true;', 'return true;'));
chk(!b.needMissing, 'need 를 무시하면 빨강');
b = await bk(MOD.replace('window.addEventListener(NET_READY_EVENT, cb);\n', 'window.addEventListener(NET_READY_EVENT, cb, { once:true });\n'));
chk(!b.onTwice, 'onNetReady 에 once 를 붙이면 빨강(동작 무변경 — overhead 는 CONFIRM 결정 전까지 그대로)');
b = await bk(MOD.replace('const fin = ()=>{ if(done) return; done = true; res(!!window.firebaseAPI); };', 'const fin = ()=>{ res(false); };'));
chk(!b.waitSignal, 'waitNetReady 가 신호에도 false 면 빨강');
b = await bk(null, FILES.map(([f, t]) => [f, f === 'room/overhead.js' ? t + "\nwindow.addEventListener('firebase-ready', ()=>{});\n" : t]));
chk(b.direct.includes('room/overhead.js'), '다른 파일이 firebase-ready 에 직접 귀를 대면 빨강');
b = await bk(null, FILES.map(([f, t]) => [f, f === 'myhome/scheduler.js' ? t.split('TwNetReady.').join('XNetReady.') : t]));
chk(b.notUsing.includes('myhome/scheduler.js'), '쓰는 파일이 TwNetReady 를 안 부르면 빨강');
const line = '<script src="parts/shared/net-ready.js"></script>';
const iL = HTML.indexOf(line), eL = HTML.indexOf('\n', iL);
const lateHtml = iL < 0 ? HTML : (HTML.slice(0, iL) + HTML.slice(eL + 1)).replace('<script src="parts/app.js"></script>', '<script src="parts/app.js"></script>\n' + line);
b = await bk(null, null, lateHtml);
chk(b.late.length > 0 || !b.firstBeforeApp, 'net-ready.js 를 app.js 뒤로 옮기면 빨강');
b = await bk(null, null, null, SMOKE.replace("PRELOAD.push('net-ready.js');", ''));
chk(!b.smoke, 'smoke PRELOAD 에서 빼면 빨강');

say('\n' + (fail ? '✗ 통과 ' + pass + ' · 실패 ' + fail : '전부 통과 ✅ ' + pass + ' — 네트워크 준비 기다리기는 net-ready.js 한 곳'));
process.exit(fail ? 1 : 0);
})();
