/* ═══ 📱 sim-mobile-focus.js — 태블릿·폰 포커싱 연결 (2026-09-23 · 개정 74 신설 · handoff-2026-09-18 §4 · §5) ═══════
   [무엇을 지키나]
   ・1절: 판정 합치기 — 진짜 `_applyActiveAppState` 를 가짜 환경에서 돌린다.
          폰 켜짐 → focusGateSleep=false · _focusWasActive=true · PC 입력이 없어도 시간이 쌓인다 ·
          🎯집중(달성표)에는 안 들어간다 · 폰 꺼짐이면 예전과 똑같다 · 안전 상한(4시간)을 넘으면 꺼짐.
   ・2절: 곁가지 — 집중 포즈(seatState) · 자동 자리비움 건너뜀 · lastActivity 를 건드리지 않음 · main.js 무관.
   ・3절: 방 — 평소·입장 payload 에 mobile 한 칸 · 받는 쪽 거르기 · 말풍선 순서(상태 > 📱 > 🕒) · _statusOut 을 실제로 돌려 본다.
   ・4절: 서버 길 — 진짜 focus-level.js 를 가짜 deps 위에서 돌린다(D5-5). realtime mobileFocus{on} → 켜짐 · at 이 4시간 넘음 → 꺼짐(서버 시각) ·
          계정 바뀜 뒤 신호 → 무시 · 키 만들기 · 끊기는 진척을 받은 뒤에만 부르고(읽기 전이면 요청 0 · E-FOCUS-08 · 09) · 실패 → 번호 · 키 유지 ·
          성공 → 계정 칸 tw.mobileKey · 끊기 → 키 지움 · 단추 잠금 · 늦은 답 버림 · 옛 { u, k } 칸 읽기.
   ・5절: 규칙 — mobileKeys 읽기 금지 · state 쓰기 = 주인 또는 (key 일치 + live 있음) · 방 mobile ≤ 40.
   ・6절: 화면 — 📱 칸이 #fsTabApp 안 · #fsSlotHint 뒤 · QR 창 베젤 radius · 클릭 목록 두 곳 · QR 라이브러리가 로컬 파일 ·
          새 클래스에 fly 없음 · 키는 주소의 # 뒤 · 안내 페이지.
   [실행] app.js · desk-companion-prototype.html · firebase-init.js · firebase-database-rules.json 이 있는 폴더에서(run.js 가 맞춰 준다). */
'use strict';
const { joinRenderer: _joinRenderer } = require('./sim-renderer-src.js');   // 앱 FSD 로 옮긴 모듈을 «옮기기 전 app.js 글» 로 되살려 읽는다
const fs = require('fs'), path = require('path'), vm = require('vm');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
/* 찾던 함수가 없으면(개명·삭제) 도중에 멈춘다 — 멈춘 것도 빨강으로 센다(판정 줄은 남긴다). */
process.on('uncaughtException', (e) => { fail++; say('  ✗ 판정 도중 멈춤 — 찾던 함수·글자가 없다(개명·삭제?): ' + (e && e.message)); say(`\n✗ 통과 ${pass} · 실패 ${fail}`); process.exit(1); });
const read = (...fs_) => { for(const f of fs_){ try{ return fs.readFileSync(f, 'utf8'); }catch(_){} } return null; };
const SRC = _joinRenderer(read('app.js')), HTML = read('desk-companion-prototype.html'), FBI = read('firebase-init.js'), RULES = read('firebase-database-rules.json');
if(!SRC || !HTML || !FBI || !RULES){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html · firebase-init.js · firebase-database-rules.json'); process.exit(2); }
const GATE = read('focus-gate.js', path.join('app', 'parts', 'focus', 'focus-gate.js'));
if(!GATE){ say('  ? 원본 못 찾음 — focus-gate.js'); process.exit(2); }
const QRLIB = read('vendor/qrcode.js', path.join('app', 'vendor', 'qrcode.js'), path.join('..', 'app', 'vendor', 'qrcode.js'));
const HOST  = read('hosting/help/link.html', path.join('..', 'hosting', 'help', 'link.html'));
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
const CODE = strip(SRC);
const HTMLC = HTML.replace(/<!--[\s\S]*?-->/g, ' ');
/* 함수 하나를 떼어 온다 — 여는 중괄호부터 짝이 맞는 닫는 중괄호까지(문자열 안 괄호는 이 파일들에 없다). */
function grabFn(name, src){
  src = src || SRC;
  const m = new RegExp('(?:async\\s+)?function\\s+' + name.replace(/\$/g, '\\$') + '\\s*\\(').exec(src);
  if(!m) return null;
  let i = src.indexOf('{', m.index), d = 0;
  for(let j = i; j < src.length; j++){ const c = src[j]; if(c === '{') d++; else if(c === '}'){ d--; if(!d) return src.slice(m.index, j + 1); } }
  return null;
}
function grabBlock(src, start){ const i = src.indexOf(start); if(i < 0) return null; let k = src.indexOf('{', i), d = 0;
  for(let j = k; j < src.length; j++){ const c = src[j]; if(c === '{') d++; else if(c === '}'){ d--; if(!d) return src.slice(i, j + 1); } } return null; }

say('── 1. 판정 합치기 (_applyActiveAppState 를 실제로 돌린다)');
{
  const need = ['_mobileNow', '_mobileOn', '_mobileRoomLabel', '_applyActiveAppState'];
  const parts = need.map(n => grabFn(n));
  const maxM = /const MOBILE_MAX_ON_MS = ([^;]+);/.exec(SRC);
  chk(parts.every(Boolean) && !!maxM, '함수 넷 + MOBILE_MAX_ON_MS 를 찾았다');
  chk(maxM && eval(maxM[1]) === 4*60*60*1000, '안전 상한 = 4시간 (§6-2 확정)');
  if(parts.every(Boolean) && maxM){
  const mk = () => {
    const env = { now: 100000, srv: 5e12, added: 0, chal: 0 };
    const ctx = {
      env, window: { firebaseAPI: { serverNow: () => env.srv } }, performance: { now: () => env.now },
      console,
    };
    ctx.firebaseAPI = ctx.window.firebaseAPI;
    vm.createContext(ctx);
    vm.runInContext(`
      const MOBILE_MAX_ON_MS = ${maxM[1]};
      let _mobileFocus = { on:false, app:'', since:0, seen:false };
      let lastActivity = 0, figureMode = false, focusGateSleep = true, _penAppFocused = false;
      function focusWindowMs(){ return 1500; }
      function addFocusSeconds(d){ env.added += d; }
      /* 👑 달성표는 weekly-challenge.js 모듈(앱 FSD 2번) — app.js 는 weeklyChal.focusTick · setKeyPlatform 으로 부른다 */
      const weeklyChal = { focusTick(s, d){ env.chal += d; }, setKeyPlatform(v){ env.plat = v; } };
      const focusProgressMod = { focusEnded(){} };   // 집중 끝남 알림(서버 올리기) — 이 검사는 보지 않는다(sim-figure-mode · sim-focus-progress)
      let _focusLastTick = performance.now(), _focusWasActive = false, _focusAccruedLast = false, _selfAppActive = false;
      const focusGate = (function(){ const window = {}; ${GATE}\n; return window.TwFocusGate; })();
      ${parts.join('\n')}
      this.api = { apply: _applyActiveAppState, on: _mobileOn, label: _mobileRoomLabel,
        setMob: (o) => { _mobileFocus = o; }, setAct: (t) => { lastActivity = t; },
        get: () => ({ gate: focusGateSleep, was: _focusWasActive }) };`, ctx);
    return ctx;
  };
  const NOT_REG = { hasAnyRegistered: true, isFocusedAppRegistered: false };   // PC 는 등록 안 된 앱(예: 바탕화면)
  // (a) 폰 켜짐 · PC 입력 없음
  { const c = mk(), A = c.api, E = c.env;
    A.setMob({ on:true, app:'Procreate', since:E.srv - 60000, seen:true }); A.setAct(0);
    A.apply(NOT_REG); let g = A.get();
    chk(g.gate === false && g.was === true, '폰 켜짐 → focusGateSleep=false · _focusWasActive=true (PC 는 등록 안 된 앱)');
    E.now += 1000; A.apply(NOT_REG);
    chk(Math.abs(E.added - 1) < 1e-6, '폰 켜짐 → PC 입력이 없어도 1초가 쌓인다 (notFocusingNow 건너뜀)');
    chk(E.chal === 0, '🎯집중(달성표)에는 안 들어간다 (§6-3 · exe 기준)');
    chk(A.label() === 'Procreate', '방에 싣는 이름 = 앱 이름'); }
  // (b) 폰 꺼짐 — 예전과 동일
  { const c = mk(), A = c.api, E = c.env;
    A.setMob({ on:false, app:'Procreate', since:0, seen:true }); A.setAct(0);
    A.apply(NOT_REG); E.now += 1000; A.apply(NOT_REG); const g = A.get();
    chk(g.gate === true && g.was === false && E.added === 0, '폰 꺼짐 → 예전 그대로(재움 · 안 쌓임)');
    chk(A.label() === '', '폰 꺼짐 → 방에 빈 문자열');
    A.setAct(E.now); A.apply({ hasAnyRegistered:true, isFocusedAppRegistered:true }); E.now += 1000; A.setAct(E.now); A.apply({ hasAnyRegistered:true, isFocusedAppRegistered:true });
    chk(Math.abs(E.added - 1) < 1e-6 && Math.abs(E.chal - 1) < 1e-6, '폰 꺼짐 · PC 포커싱 어플 입력 → 예전처럼 쌓이고 달성표도 센다'); }
  // (c) 상한
  { const c = mk(), A = c.api, E = c.env;
    A.setMob({ on:true, app:'X', since:E.srv - 4*3600*1000 - 1, seen:true });
    chk(A.on() === false, '4시간 넘게 새 «열림» 이 없으면 꺼짐으로 본다');
    A.setMob({ on:true, app:'X', since:E.srv - 4*3600*1000 + 60000, seen:true });
    chk(A.on() === true, '4시간 안이면 켜짐');
    A.setMob({ on:true, app:'X', since:0, seen:true });
    chk(A.on() === false, 'since 가 없으면 켜짐으로 안 본다'); }
  // (d) figureMode 는 예전 그대로 이긴다
  { const c = mk(), A = c.api;
    vm.runInContext('figureMode = true;', c); A.setMob({ on:false, app:'', since:0 }); A.apply(NOT_REG);
    chk(A.get().gate === false, '피규어 모드 분기는 그대로'); }
  }
  const ap = strip(grabFn('_applyActiveAppState') || '');
  chk(/weeklyChal\.focusTick\(state, dt\)/.test(ap) && /!pcNotFocusing\) weeklyChal\.focusTick/.test(ap), '달성표는 PC 입력 기준(pcNotFocusing)을 본다');
}

say('── 2. 곁가지');
{
  const ss = strip(grabFn('seatState') || '');
  const iGate = ss.indexOf('if(desktopMode && focusGateSleep) return focusGate.gatedPose('), iMob = ss.indexOf('_mobileOn()) return \'focus\'');
  chk(iGate > 0 && iMob > iGate && /seat\.isMe && _mobileOn\(\)\) return 'focus'/.test(ss), '집중 포즈 — 내 좌석 · 게이트 뒤 · 입력 판정(idle) 앞');
  chk(iMob < ss.indexOf('const idle=now-lastActivity'), '  입력 판정보다 앞이라 PC 입력이 없어도 집중 포즈');
  const aw = strip(grabFn('_autoAwayCheck') || '');
  chk(/const idle = _mobileOn\(\) \? 0 : await _idleMs\(\);/.test(aw), '자동 자리비움 · 6시간 퇴장 — 폰 켜짐이면 유휴 0 (복원 갈래로 돌아온다)');
  const mobFns = ['_mobileOn', '_mobileApplyState', 'startMobile', '_mobRenderPanel', '_mobMakeKey', '_applyActiveAppState'].map(n => strip(grabFn(n) || '')).join('\n');
  chk(!/lastActivity\s*=/.test(mobFns) && !/activity\(\)/.test(mobFns), 'lastActivity 를 인위로 갱신하지 않는다(펜 앱 판정·입력 진단과 섞이지 않게)');
  const MAIN = read('main.js');
  chk(!MAIN || !/mobileLink|_mobileOn/.test(MAIN), 'main.js 는 폰 판정을 모른다(렌더러에서 합친다)');
}

say('── 3. 방');
{
  chk(/bench:_myBench\(\), mobile:_mobileRoomLabel\(\), danceStyle:/.test(CODE), '평소 payload(_basePayload)에 mobile 한 칸');
  chk(/\.\.\.myStarOut\(\),mobile:_mobileRoomLabel\(\), noise:myNoise/.test(CODE), '입장 payload 에도 mobile');
  chk(/flyCool:_myFlyCool\(\), noise:myNoise\}; \}/.test(CODE) && /_mobileRoomLabel\(\), noise:myNoise, awayImg:myAwayImg\}/.test(CODE), '  남의 검사가 붙잡은 글자(noise 끝 · 입장 줄)는 그대로');
  chk(/s\.remoteMobile=_mobileCleanApp\(friends\[id\]\.mobile\);/.test(CODE), '받는 쪽 — _mobileCleanApp 으로 거른다');
  const clean = new Function(grabFn('_mobileCleanApp').replace('MOBILE_APP_MAX', '40') + ' return _mobileCleanApp;')();
  chk(clean(undefined) === '' && clean(5) === '' && clean(' <b>Pro</b>\n') === 'bPro/b' && clean('x'.repeat(60)).length === 40, '  문자열만 · 제어문자·꺾쇠 제거 · 40자');
  const so = grabFn('_statusOut');
  const out = (u, f, c, mob) => new Function('u', 'f', 'c', 'm', 'let myUserStatus=u, myFocusShow=f, myCustomStatus=c; const _mobileOn=()=>m;' + so + ' return _statusOut();')(u, f, c, mob);
  const F = { emo:'🕒', text:'오늘 3:20' }, C = { emo:'✨', text:'마감 중' };
  let r = out(null, F, C, true);  chk(r.userStatus === null, '📱 켜짐 · 상태 없음 → 🕒 를 싣지 않는다(받는 쪽이 📱 를 띄운다)');
  r = out('custom', F, C, true);  chk(r.userStatus === 'custom' && r.customStatus === C, '📱 켜짐 · 사용자가 고른 상태 → 상태가 이긴다');
  r = out(null, F, C, false);     chk(r.userStatus === 'custom' && r.customStatus === F, '📱 꺼짐 → 🕒 예전 그대로');
  chk(/const _conf = \(_mobApp && !us\) \? null : statusConfFor\(seat, us\);/.test(CODE), '내 화면도 같은 순서(상태 > 📱 > 🕒)');
  chk(/setSeatHeadBubble\(seat, _conf \? _conf\.label : _mobileBubbleText\(_mobApp\), true\)/.test(CODE), '상태 말풍선 자리에 «📱 앱» (생각 말풍선 · 회사원·숨김 갈래는 그대로)');
  const bt = new Function(grabFn('_mobileBubbleText').replace('MOBILE_APP_MAX', '40') + ' return _mobileBubbleText;')();
  chk(bt('Procreate') === '📱 Procreate' && bt('') === null, '  «📱 Procreate» · 빈 값이면 말풍선 없음');
  chk(/function _mobileChanged\(\)\{[\s\S]*?Presence\.broadcastNow\(\)/.test(CODE), '켜짐/꺼짐이 바뀌면 방에 바로 싣는다');
}

(async () => {
say('── 4. 서버 길 (focus-level.js 를 돌린다)');
{
  const LEVEL = read('focus-level.js', path.join('app', 'parts', 'focus', 'focus-level.js'));
  if(!LEVEL){ chk(false, '원본 못 찾음 — focus-level.js'); }
  else{
    const KEY = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const ids = ['fsMobSt', 'fsMobMain', 'fsMobSub', 'fsMobQr', 'fsMobUnlink', 'fsMobNote', 'mobLinkOverlay', 'mobLinkKey', 'mobLinkRenew', 'mobLinkCopy', 'mobLinkClose', 'mobLinkDone'];
    const tick = async () => { for(let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r)); };
    /* 모듈을 가짜 deps 위에서 만든다. opt: ready(진척을 받았나) · issue · unlink(api 가 줄 답) · store(계정 칸 처음 값) · src(깨 본 글) */
    function mk(opt){
      opt = opt || {};
      const env = { now: 5e12, calls: [], notes: [], toasts: [], bcast: 0, store: Object.assign({}, opt.store || {}), msgFns: [], subs: [], resets: [], ivs: [], ready: opt.ready !== false,
        issue: opt.issue || { status: 'ok', key: KEY }, unlink: opt.unlink || { status: 'ok' }, gate: null };
      const els = {}; ids.forEach((id) => { els[id] = { textContent: '', style: {}, className: '', disabled: false, onclick: null, title: '', classList: { add(){}, remove(){} }, getContext: () => null, width: 132 }; });
      const document = { getElementById: (id) => els[id] || null };
      const win = { firebaseAPI: { serverNow: () => env.now }, TWQR: null, addEventListener(){} };
      const done = (v) => env.gate ? env.gate.then(() => v) : Promise.resolve(v);
      const deps = {
        progress: { STAR_PALETTE: [['#ffd76a', '금']], whenReady: async () => { env.calls.push('ready'); return env.ready; } },
        FOCUS_CYCLE_CAP: 1, FOCUS_CYCLE_SEC: 1, FOCUS_LEVEL_CAP_HOURS: 1,
        Presence: { broadcastNow: () => { env.bcast++; } },
        focusApi: { issueMobileKey: (u) => { env.calls.push('issue:' + u); return done(env.issue); }, unlinkMobile: (u) => { env.calls.push('unlink:' + u); return done(env.unlink); } },
        focusStore: { get: (k) => (k in env.store ? env.store[k] : null), set: (k, v) => { env.store[k] = String(v); return true; }, remove: (k) => { delete env.store[k]; return true; } },
        notifyError: (c) => { env.notes.push(c); },
        rtOnMessage: (t, fn) => { env.msgFns.push([t, fn]); return () => { env.msgFns = env.msgFns.filter((x) => x[1] !== fn); }; },
        _acctDetached: () => false, _focusSessionSec: () => 0, findMySeat: () => null, getMyUserId: () => 'u1', toast: (t) => env.toasts.push(t),
        wdDraftDef: () => null, setFocusSessionSec: () => {}, addFocusToday: () => {}, _focusTotalStarted: () => true,
      };
      const src = opt.src || LEVEL;
      const thrower = () => { throw new Error('localStorage 를 건드림'); };
      const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'setTimeout', 'clearTimeout', 'module', 'console', src + '\nreturn window.TwFocusLevel;')(
        win, document, { getItem: thrower, setItem: thrower, removeItem: thrower }, {}, win.firebaseAPI,
        () => 1, () => {}, undefined, console).createFocusLevel(deps);
      const session = {
        onReset: (f) => env.resets.push(f), on: (f) => { env.subs.push(f); return f; }, setInterval: (f, ms) => { env.ivs.push([f, ms]); return env.ivs.length; },
      };
      /* 세션이 끝날 때 — 구독 해제 → 비우기 훅(session.js dispose 순서) */
      const dispose = () => { env.subs.splice(0).forEach((f) => f()); env.resets.splice(0).forEach((f) => f()); };
      return { api, env, els, session, dispose };
    }
    const fire = (w, m) => w.env.msgFns.filter((x) => x[0] === 'mobileFocus').forEach((x) => x[1](m));
    const hours = (h) => h * 3600 * 1000;

    /* (a) 시작 — 구독 · 틱 · 계정 칸의 키 */
    { const w = mk({ store: { 'tw.mobileKey': KEY } });
      chk(w.env.msgFns.length === 0 && w.env.subs.length === 0 && w.env.ivs.length === 0, '만들 때는 구독 · 타이머 · 계정 칸 읽기가 없다(시작은 startMobile 한 번)');
      w.api.startMobile('umfk2x3ab9c8d7e6f', {}, w.session);
      chk(w.env.msgFns.length === 1 && w.env.msgFns[0][0] === 'mobileFocus' && w.env.subs.length === 1, '시작 — realtime mobileFocus 를 한 번 건다(해제는 세션에 맡김)');
      chk(w.env.ivs.length === 1 && w.env.ivs[0][1] === 60000, '  1분 표시 틱은 세션 타이머로');
      chk(w.els.fsMobQr.textContent === 'QR 다시 보기', '  계정 칸의 키를 읽는다 → «QR 다시 보기»');
      w.api.startMobile('umfk2x3ab9c8d7e6f', {}, w.session);
      chk(w.env.msgFns.length === 1, '  두 번 시작해도 구독은 하나');
      const w2 = mk({ store: { 'tw.mobileKey': JSON.stringify({ u: 'umfk2x3ab9c8d7e6f', k: KEY }) } }); w2.api.startMobile('umfk2x3ab9c8d7e6f', {}, w2.session);
      chk(w2.els.fsMobQr.textContent === 'QR 다시 보기', '옛 0.12 칸 { u, k } 도 읽는다(이 계정 것일 때)');
      const w3 = mk({ store: { 'tw.mobileKey': JSON.stringify({ u: 'ux', k: KEY }) } }); w3.api.startMobile('umfk2x3ab9c8d7e6f', {}, w3.session);
      chk(w3.els.fsMobQr.textContent === 'QR로 연결하기', '  다른 계정 것이면 없는 것으로 본다'); }

    /* (b) 신호 → 켜짐 · 4시간 상한(서버 시각) */
    { const w = mk(); w.api.startMobile('u1', {}, w.session);
      fire(w, { t: 'mobileFocus', on: true, app: 'Procreate', at: w.env.now - 60000 });
      chk(w.api._mobileOn() === true && w.api._mobileRoomLabel() === 'Procreate' && w.env.bcast === 1, 'mobileFocus{on:true} → 켜짐 · 방 이름 · 방에 바로 알림');
      fire(w, { t: 'mobileFocus', on: true, app: ' <b>X</b> ', at: w.env.now - 1000 });
      chk(w.api._mobileRoomLabel() === 'bX/b', '  앱 이름은 거른다(제어문자 · 꺾쇠)');
      fire(w, { t: 'mobileFocus', on: false, app: null, at: w.env.now });
      chk(w.api._mobileOn() === false && w.api._mobileRoomLabel() === '', 'on:false → 꺼짐');
      fire(w, { t: 'mobileFocus', on: true, app: 'A', at: w.env.now - hours(4) - 1 });
      chk(w.api._mobileOn() === false, '★ at 이 서버 시각으로 4시간 넘음 → 꺼짐으로 본다');
      fire(w, { t: 'mobileFocus', on: true, app: 'A', at: w.env.now - hours(4) + 60000 });
      chk(w.api._mobileOn() === true, '  4시간 안이면 켜짐');
      w.env.now += hours(1);
      chk(w.api._mobileOn() === false, '  서버 시각이 흘러 상한을 넘으면 꺼짐(새 신호 없이)');
      const bk = LEVEL.replace('(_mobileNow() - m.since)', '(Date.now() - m.since)');
      const wb = bk !== LEVEL ? mk({ src: bk }) : null; if(wb){ wb.api.startMobile('u1', {}, wb.session); fire(wb, { on: true, app: 'A', at: wb.env.now - hours(4) - 1 }); }
      chk(!!wb && wb.api._mobileOn() === true, '  (깨 보기) 4시간 셈을 PC 시계로 바꾸면 위 «4시간 넘음 → 꺼짐» 판정이 빨강'); }

    /* (c) 계정 바뀜 */
    { const w = mk(); w.api.startMobile('u1', {}, w.session);
      fire(w, { on: true, app: 'A', at: w.env.now - 1000 });
      w.dispose();
      chk(w.api._mobileOn() === false && w.env.msgFns.length === 0, '계정이 바뀌면(세션 끝) 폰 상태가 비고 구독이 풀린다');
      fire(w, { on: true, app: 'A', at: w.env.now });
      chk(w.api._mobileOn() === false, '★ 끝난 뒤의 신호 → 무시');
      const wl = mk(); wl.api.startMobile('u1', {}, wl.session); const h = wl.env.msgFns[0][1]; wl.dispose(); h({ on: true, app: 'A', at: wl.env.now });
      chk(wl.api._mobileOn() === false, '  풀리기 전에 이미 나간 호출이 와도 무시(코드 없음)');
      const w2 = mk(); w2.api.startMobile('u2', {}, w2.session); chk(w2.env.msgFns.length === 1, '  다음 계정은 다시 시작할 수 있다'); }

    /* (d) 키 만들기 */
    { const w = mk(); w.api.startMobile('u1', {}, w.session);
      w.els.fsMobQr.onclick(); await tick();
      chk(w.env.calls.join() === 'ready,issue:u1', '★ 키 만들기 — 진척을 받은 뒤에 요청(읽은 주인이 있어야 stale 이 아니다)');
      chk(w.env.store['tw.mobileKey'] === KEY && w.els.fsMobQr.textContent === 'QR 다시 보기' && w.env.notes.length === 0, '  성공 → 계정 칸에 키 · 번호 없음');
      chk(w.els.fsMobQr.disabled === false && w.els.fsMobUnlink.disabled === false, '  끝나면 단추 잠금이 풀린다');
      const wf = mk({ issue: { status: 'failed', err: new Error('x') } }); wf.api.startMobile('u1', {}, wf.session); wf.els.fsMobQr.onclick(); await tick();
      chk(wf.env.notes.join() === 'E-FOCUS-08' && !('tw.mobileKey' in wf.env.store) && wf.els.fsMobQr.textContent === 'QR로 연결하기', '★ 실패 → E-FOCUS-08 한 번 · 키를 남기지 않는다');
      const wn = mk({ ready: false }); wn.api.startMobile('u1', {}, wn.session); wn.els.fsMobQr.onclick(); await tick();
      chk(wn.env.notes.join() === 'E-FOCUS-08' && !wn.env.calls.some((c) => c.startsWith('issue')), '★ 진척을 못 받았으면 요청 0 · E-FOCUS-08');
      const ws = mk({ issue: { status: 'stale' } }); ws.api.startMobile('u1', {}, ws.session); ws.els.fsMobQr.onclick(); await tick();
      chk(ws.env.notes.length === 0 && !('tw.mobileKey' in ws.env.store), '  stale(계정이 바뀌는 중) → 조용히 버린다');
      const wg = mk(); wg.api.startMobile('u1', {}, wg.session); let open; wg.env.gate = new Promise((r) => { open = r; });
      wg.els.fsMobQr.onclick(); await tick();
      chk(wg.els.fsMobQr.disabled === true && wg.els.mobLinkRenew.disabled === true && wg.els.fsMobUnlink.disabled === true, '★ 만드는 중에는 단추 셋이 잠긴다');
      wg.els.fsMobQr.onclick(); await tick();
      chk(wg.env.calls.filter((c) => c.startsWith('issue')).length === 1, '  잠긴 동안 또 눌러도 요청은 하나');
      wg.dispose(); open(); await tick();
      chk(!('tw.mobileKey' in wg.env.store) && wg.env.notes.length === 0, '★ 만드는 중 계정이 바뀌면 늦은 답은 아무것도 바꾸지 못한다');
      const wr = mk({ store: { 'tw.mobileKey': KEY } }); wr.api.startMobile('u1', {}, wr.session); fire(wr, { on: true, app: 'A', at: wr.env.now - 1000 });
      wr.env.issue = { status: 'ok', key: 'ZYXWVUTSRQPNMKJHGFEDCBA2' }; wr.els.mobLinkRenew.onclick(); wr.els.mobLinkRenew.onclick(); await tick();
      chk(wr.env.store['tw.mobileKey'] === 'ZYXWVUTSRQPNMKJHGFEDCBA2' && wr.api._mobileOn() === false, '  새 키(두 번 누름) → 계정 칸 키가 바뀌고 옛 폰 상태는 비운다'); }

    /* (e) 연결 끊기 */
    { const w = mk({ store: { 'tw.mobileKey': KEY } }); w.api.startMobile('u1', {}, w.session); fire(w, { on: true, app: 'A', at: w.env.now - 1000 });
      w.els.fsMobUnlink.onclick(); await tick();
      chk(w.env.calls.length === 0, '끊기 — 한 번 누르면 아무것도 안 보낸다(두 번 누름)');
      w.els.fsMobUnlink.onclick(); await tick();
      chk(w.env.calls.join() === 'ready,unlink:u1', '★ 두 번 누르면 진척을 받은 뒤 DELETE');
      chk(!('tw.mobileKey' in w.env.store) && w.api._mobileOn() === false && w.els.fsMobQr.textContent === 'QR로 연결하기' && w.env.notes.length === 0, '  성공 → 키 지움 · 폰 꺼짐 · 번호 없음');
      const wf = mk({ store: { 'tw.mobileKey': KEY }, unlink: { status: 'failed', err: new Error('x') } }); wf.api.startMobile('u1', {}, wf.session);
      wf.els.fsMobUnlink.onclick(); wf.els.fsMobUnlink.onclick(); await tick();
      chk(wf.env.notes.join() === 'E-FOCUS-09' && wf.env.store['tw.mobileKey'] === KEY, '★ 실패 → E-FOCUS-09 · 키는 그대로(서버에 아직 있다)');
      const wn = mk({ store: { 'tw.mobileKey': KEY }, ready: false }); wn.api.startMobile('u1', {}, wn.session);
      wn.els.fsMobUnlink.onclick(); wn.els.fsMobUnlink.onclick(); await tick();
      chk(wn.env.notes.join() === 'E-FOCUS-09' && !wn.env.calls.some((c) => c.startsWith('unlink')) && wn.env.store['tw.mobileKey'] === KEY, '★ 진척을 못 받았으면 요청 0 · E-FOCUS-09'); }

    /* (f) 글 — 걷은 길 */
    const LV = strip(LEVEL);
    chk(!/firebaseAPI\.mobile|mobileDiag|mobileLinkStart|mobileSetKey|mobileUnlink|localStorage|getRandomValues|\bsetInterval\(/.test(LV.replace(/session\.setInterval\(/g, '')), 'Firebase 길 · 진단 줄 · PC 에서 키를 짓는 코드 · 모듈 꼭대기 타이머가 없다(키는 서버가 만든다)');
    chk(!/mobile-diag|fsMobDiag/.test(HTML) && !read('mobile-diag.js', path.join('app', 'parts', 'focus', 'mobile-diag.js')), '설정 › 포커싱어플의 📱 진단 줄이 사라졌다(html · 파일)');
    const ak = (SRC.match(/const ACCOUNT_LOCAL_KEYS = \(\)=>\[([\s\S]*?)\n\];/) || [])[1] || '';
    chk(!/MOBILE_KEY|tw\.mobileKey/.test(ak), '  로그아웃 목록 밖(키는 계정 칸에 있다 — 계정을 바꾸면 안 보인다)');
  }
}

say('── 5. 규칙');
{
  let R = null; try{ R = JSON.parse(RULES).rules; }catch(_){}
  chk(!!R, '규칙 파일이 JSON');
  const K = R && R.mobileKeys && R.mobileKeys.$userId, L = R && R.mobileLink && R.mobileLink.$userId;
  chk(!!K && K['.read'] === false, 'mobileKeys 읽기 금지 (users/* 는 공개 읽기라 최상위에 둔다)');
  chk(!!K && /userAuth/.test(K['.write']) && /\[A-Z2-9\]\{24\}/.test(K['.validate']), 'mobileKeys 쓰기 = 주인 · 24자 모양');
  const S = L && L.state;
  chk(!!S && /newData\.child\('key'\)\.val\(\) === root\.child\('mobileKeys\/'\+\$userId\)\.val\(\)/.test(S['.write'])
          && /root\.child\('mobileLink\/'\+\$userId\+'\/live'\)\.exists\(\)/.test(S['.write']), 'state 쓰기 — key 일치 + live 있음(PC 가 꺼지면 거절)');
  chk(!!S && S.app && /length <= 40/.test(S.app['.validate']) && S.on && /isBoolean/.test(S.on['.validate']) && S.$other && S.$other['.validate'] === false, 'state 검증 — on bool · app ≤40 · 다른 칸 거부');
  chk(!!L && L.live && /userAuth/.test(L.live['.write']), 'live 쓰기 = 주인');
  chk(!!L && /userAuth/.test(L['.read']), 'mobileLink 읽기 = 주인');
  const M = R && R.rooms && R.rooms.$room && R.rooms.$room.$memberId;
  chk(!!M && /newData\.child\('mobile'\)\.val\(\)\.length <= 40/.test(M['.validate']), '방 멤버 mobile ≤ 40');
}

say('── 6. 화면');
{
  const iTab = HTMLC.indexOf('id="fsTabApp"'), iHint = HTMLC.indexOf('id="fsSlotHint"'), iMob = HTMLC.indexOf('id="fsMob"'), iNext = HTMLC.indexOf('id="fsTabDisplay"');
  chk(iTab > 0 && iHint > iTab && iMob > iHint && iMob < iNext, '📱 칸 — #fsTabApp 안 · #fsSlotHint 뒤');
  const blk = HTMLC.slice(iMob, iNext);
  chk(/id="fsMobSt"/.test(blk) && /id="fsMobQr"/.test(blk) && /id="fsMobUnlink"/.test(blk) && /id="fsMobNote"/.test(blk), '  상태 칸 · 버튼 둘 · 안내 줄');
  chk((blk.match(/<button/g) || []).length <= 2, '  버튼 한 줄 최대 2개(패널 300px)');
  chk(/#mobLinkOverlay \.box\{[^}]*border-color:var\(--win-hi\)[^}]*border-radius:var\(--win-radius-el\)/.test(HTML), 'QR 창 베젤 radius');
  chk(/html\[data-theme="bubble"\] #mobLinkOverlay \.ttl,/.test(HTML), '  제목줄이 버블 목록에');
  chk(/const UI_HIT_SEL = '[^']*#mobLinkOverlay/.test(CODE), '클릭 통과 목록(UI_HIT_SEL)에 QR 창');
  chk(/FS_KEEP_OPEN_SEL = \[[\s\S]*?'#mobLinkOverlay'[\s\S]*?\]\.join/.test(CODE), '설정 바깥 클릭 예외에도 QR 창');
  const iQr = HTMLC.indexOf('<script src="vendor/qrcode.js"></script>'), iApp = HTMLC.indexOf('<script src="parts/app.js"></script>');
  chk(iQr > 0 && iQr < iApp, 'QR 라이브러리 — 로컬 파일 · app.js 앞');
  chk(!/<script[^>]+src="https?:[^"]*qr/i.test(HTMLC), '  CDN 이 아니다(CSP)');
  const newCls = [...HTML.matchAll(/class="([^"]*(?:fs-mob|mob-)[^"]*)"/g)].map(m => m[1]).join(' ');
  chk(!!newCls && !/\bfly\b/.test(newCls), '새 클래스에 fly 없음');
  chk(/'https:\/\/help\.together-working\.com\/link#u='/.test(CODE) && !/link\?[uk]=/.test(CODE), 'QR 주소 — 키는 # 뒤(서버 로그에 안 남는다)');
  if(QRLIB){
    const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(QRLIB, ctx);
    const q = ctx.window.TWQR && ctx.window.TWQR.make('https://help.together-working.com/link#u=umfk2x3ab9c8d7e6f&k=ABCDEFGHJKLMNPQRSTUVWX23', 'M');
    const finder = q && [0, 6].every(r => [0, 6].every(c => q.dark(r, c))) && q.dark(0, q.n - 1) && q.dark(q.n - 1, 0) && !q.dark(7, 7);
    // 칸 수는 주소 길이로 정해진다(help.together-working.com 주소 = 41칸) — 화면 캔버스(132px)에서 한 칸이 3px 아래면 폰이 못 읽는다
    const QR_CANVAS_PX = 132, QR_MIN_CELL_PX = 3;
    chk(!!q && finder && Math.floor(QR_CANVAS_PX / q.n) >= QR_MIN_CELL_PX && /id="mobLinkQr" width="132"/.test(HTML), 'QR 인코더가 돈다 — 세 모서리 파인더 · 캔버스 132px 에서 한 칸 3px 이상 (' + (q && q.n) + '칸)');
    chk(/MIT/.test(QRLIB.slice(0, 1200)), '  MIT 표기 남음');
  } else say('  · vendor/qrcode.js 를 못 찾음 — QR 인코더 판정 건너뜀');
  if(HOST){
    chk(/location\.hash/.test(HOST) && !/location\.search/.test(HOST), '안내 페이지 — # 뒤에서 읽는다');
    chk(/method:'POST'/.test(HOST) && /'X-Mobile-Key': K/.test(HOST) && /API \+ '\/v1\/focus\/mobile-link\/state'/.test(HOST) && /https:\/\/api\.together-working\.com'/.test(HOST), '  서버 POST /v1/focus/mobile-link/state · 키는 머리(X-Mobile-Key)');
    chk(!/firebasedatabase|\.sv|method:'PUT'|mobileLink\/'/.test(HOST) && !/key: K/.test(HOST), '  Firebase REST 길 · 본문 키가 없다');
    chk(/신호 보내 보기/.test(HOST) && /✓ PC에 신호가 갔어요/.test(HOST) && /iPhone·iPad/.test(HOST) && /갤럭시/.test(HOST), '  시안 ④ 문구(탭 · 테스트 · 결과)');
  } else say('  · hosting/help/link.html 을 못 찾음 — 안내 페이지 판정 건너뜀');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
})().catch((e) => { fail++; say('  ✗ 판정 도중 멈춤 — ' + (e && e.message)); say(`\n✗ 통과 ${pass} · 실패 ${fail}`); process.exit(1); });
