/* ═══ 📷 sim-purikura-ui.js — 스티커사진 창 모듈 (2026-10-10 신설 · 앱 FSD 3번) ═══════════════════
   app.js 의 📷 스티커사진 구역(촬영 창 + 무대 · 로비 · 전용 씬 · 키 · 매 프레임 · 촬영 · 꾸미기 · 창 옮기기 · 배선)을
   parts/purikura-ui.js 로 옮겼다. 동작은 그대로여야 한다. 화면 규약(렌더러 · 캡처 · 꾸미기 · 필터)은 sim-purikura-stage ·
   -deco · -fish · sim-pk-fit · sim-fix-0923 이 이 파일을 읽어 보고, 여기서는 «옮긴 것» 자체를 굴려 본다.
   ・1절: 만들 때 — _pkWire 가 버튼 · ⎋ 사다리(escRegisterWindow) · 창 크기 감시를 건다 · DOM 이 없으면 조용히
   ・2절: 문 — 회사원 모드 · 세션 없음 · 방 밖 · 정원 닫힘 · 정원을 못 읽음(E-PK-01) · 자리 잡기 거절 코드마다 안내(촬영 중 · 자리 없음 · 방 밖은 안내만 ·
          시간 초과 · 연결 없음 · 서버 오류는 E-PK-02) (officeMode · Presence 는 읽는 함수)
   ・3절: 열고 닫기 — 가짜 THREE · DOM 위에서 실제로 연다 · 정원 구독 · 첫 자리 · 프레임 · 판을 세션 포트에서 받아 그린다 · 방장 설정 전송 ·
          키 · 무대 루프 · BGM(듣던 플레이리스트 재우기 → 닫으면 되살리기) · 닫으면 듣기를 끊고 자리를 놓음 · 세는 중엔 못 닫음
   ・4절: 세션 콜백 — onPeers · onMeta · onPeerEvent · onShot · onSlots · onFrames · onRefused 가 창이 닫혀 있어도 안 터진다
   ・4-2절: 서버 소식 — 자리가 바뀌면 다시 그림 · 자리를 잃으면 한 번만 안내 · 방장 일 거절은 E-PK-04 · 프레임 거절은 E-PK-05 · 촬영 시작 실패는 까닭마다(정원 닫힘은 안내만 · 나머지 E-PK-03)
   ・5절: app.js 배선 — 정의는 모듈에만 · createPurikuraUi 는 원래 자리(세션 입구 _purikura 뒤 · 🎟️ 하루 횟수 앞) · 세션 입구는 세션 포트 하나 ·
          Firebase 경로(pk*)가 화면 · app.js 에 없다 · 부르는 곳은 purikuraUi.이름 · deps 모양 · html 순서 · 전역 이름
   [실행] purikura-ui.js · purikura-net.js · ps1-dither.js · app.js · chat-window.js · desk-companion-prototype.html 이 있는 폴더에서. */
'use strict';
const { joinRenderer: _joinRenderer } = require('./sim-renderer-src.js');   // 앱 FSD 로 옮긴 모듈을 «옮기기 전 app.js 글» 로 되살려 읽는다
const fs = require('fs');
const vm = require('vm');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = ['purikura-ui.js', 'purikura-net.js', 'purikura-rt.js', 'ps1-dither.js', 'safe-html.js', 'app.js', 'desk-companion-prototype.html', 'chat-window.js', 'myhome-hooks.js', 'pk-bgm.js', 'bgm-hush.js'];
const SRC = {};
for(const f of need){ SRC[f] = read(f); if(SRC[f] == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } }
const APP = _joinRenderer(SRC['app.js']), HTML = SRC['desk-companion-prototype.html'], MOD = SRC['purikura-ui.js'], NET = SRC['purikura-net.js'];
const CW = SRC['chat-window.js'];   // 💬 대화창 배선(📷 버튼)은 chat-window.js 로 옮겼다(앱 FSD 14번)
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const flush = async (n = 8) => { for(let i = 0; i < n; i++) await new Promise(r => setImmediate(r)); };

/* ── 무엇이든 받는 가짜 — THREE · 캔버스 · 모르는 DOM 칸. 읽으면 또 가짜, 부르면 또 가짜, 숫자로 쓰면 0 ── */
function U(){
  const store = {};
  return new Proxy(function(){}, {
    get(t, k){
      if(k in store) return store[k];
      if(k === Symbol.toPrimitive) return () => 0;
      if(k === 'then' || typeof k === 'symbol') return undefined;
      if(k === 'length') return 0;
      return (store[k] = U());
    },
    set(t, k, v){ store[k] = v; return true; },
    apply(){ return U(); },
    construct(){ return U(); },
  });
}
/* DOM 칸 — classList · style · 이벤트 · 자식은 진짜, 나머지는 가짜(U) */
function mkEl(tag, id){
  const cls = new Set(), L = {}, base = {
    tagName: String(tag || 'div').toUpperCase(), id: id || '', style: {}, dataset: {}, children: [],
    textContent: '', innerHTML: '', value: '', disabled: false, onclick: null,
    classList: { add: (...a) => a.forEach(c => cls.add(c)), remove: (...a) => a.forEach(c => cls.delete(c)),
      toggle: (c, f) => { const on = (f === undefined) ? !cls.has(c) : !!f; on ? cls.add(c) : cls.delete(c); return on; },
      contains: c => cls.has(c) },
    appendChild(c){ base.children.push(c); return c; },
    addEventListener(t, fn){ (L[t] = L[t] || []).push(fn); },
    removeEventListener(t, fn){ L[t] = (L[t] || []).filter(f => f !== fn); },
    _L: L,
    querySelector: sel => (sel === '.pk-tbar' ? (base._bar = base._bar || mkEl('div')) : null), querySelectorAll: () => [],   // 창 끌기 손잡이만
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 500, right: 600, bottom: 500 }),
    getContext: () => U(), toDataURL: () => 'data:image/png;base64,', remove(){}, focus(){}, blur(){},
    setPointerCapture(){}, releasePointerCapture(){}, closest: () => null,
  };
  return new Proxy(base, {
    get(t, k){ if(k in t) return t[k]; if(typeof k === 'symbol' || k === 'then') return undefined; return (t[k] = U()); },
    set(t, k, v){ t[k] = v; return true; },
  });
}

function mkEnv(opt){
  opt = opt || {};
  const env = { toasts: [], warns: [], esc: [], winL: {}, raf: [], subs: [], unsubs: 0, watch: 0, unwatch: 0,
    closed: 0, starts: 0, notices: [], configs: [], errors: [], frameWrites: [], pause: 0, resume: 0, plPlaying: !!opt.plPlaying, plRender: 0, office: !!opt.office,
    room: opt.room === undefined ? 'ROOM1' : opt.room, audio: [], ls: Object.assign({}, opt.ls || {}), lsSets: [], mySlot: 0, host: true, mySeatCalls: 0 };
  const els = {};
  const getEl = id => (opt.noDom ? null : (els[id] || (els[id] = mkEl('div', id))));
  const slots0 = opt.slots || { 0: { uid: 'uA', name: '나', fx: 1 } };
  const sess = opt.noSession ? null : Object.assign(new Proxy({}, { get: (t, k) => (k in t ? t[k] : (typeof k === 'symbol' || k === 'then') ? undefined : (() => Promise.resolve(true))) }), {
    checkQuota: async () => { if(opt.quotaThrows) throw new Error('offline'); return (opt.quota || { ok: true, label: '3 / 400', message: '' }); },
    open: async (room, me) => { env.opened = { room, me }; if(opt.openThrows) throw new Error('boom'); return opt.openRes || { ok: true, slot: 0, host: true }; },
    watchQuota: cb => { env.watch++; env.quotaCb = cb; return () => { env.unwatch++; }; },
    setConfig: cfg => { env.configs.push(cfg); return Promise.resolve(true); },
    setFrameUrl: (i, u) => { env.frameWrites.push([i, u]); return Promise.resolve(true); },
    start: async () => { env.starts++; return (opt.startRes || { ok: true, n: 1, left: 399, nth: '1번째 · 399회 남음' }); },
    setCut: (i, at) => { (env.cuts = env.cuts || []).push([i, at]); return Promise.resolve(true); },
    isHost: () => env.host, mySlot: () => env.mySlot, hostSlot: () => 0, serverNow: () => (opt.srvNow === undefined ? 1000 : opt.srvNow),
    slotsNow: () => slots0, framesNow: () => (opt.frames || {}), metaNow: () => (opt.meta === undefined ? null : opt.meta),
    close(){ env.closed++; },
  });
  class FakeAudio { constructor(src){ this.src = src; this.paused = true; env.audio.push(this); }
    addEventListener(){} load(){} play(){ this.paused = false; return Promise.resolve(); } pause(){ this.paused = true; } }
  const ctx = {
    Math, JSON, String, Number, Array, Object, Promise, Map, Set, Date, Boolean, Error, isFinite, parseInt, parseFloat,
    console: { warn: (...a) => env.warns.push(a.join(' ')), log(){}, debug(){} },
    document: { getElementById: getEl, createElement: t => mkEl(t), activeElement: null, body: mkEl('body') },
    setTimeout: () => 0, clearTimeout(){}, setInterval: () => 0, clearInterval(){},
    requestAnimationFrame: fn => { env.raf.push(fn); return env.raf.length; }, cancelAnimationFrame(){},
    performance: { now: () => 1000 }, devicePixelRatio: 1, innerWidth: 1280, innerHeight: 800,
    Audio: FakeAudio, Image: class { constructor(){ this.onload = null; } }, URL: { createObjectURL: () => 'blob:x', revokeObjectURL(){} },
    confirm: () => true, THREE: U(), TwGlContext: { make: () => (opt.noGl ? null : U()) },
    localStorage: { getItem: (k) => (k in env.ls ? env.ls[k] : null) },
    companion: { pauseBgm(){ env.pause++; }, resumeBgm(){ env.resume++; } },
    firebaseAPI: { pkUploadFrame: async () => 'https://x' },   // 남은 Firebase 경로는 프레임 Storage 올리기 하나
    TwErrorCodes: { notify: (code, err, text) => { env.errors.push([code, err, text]); env.notices.push(code); return true; } },
  };
  ctx.window = ctx;
  ctx.addEventListener = (t, fn) => { (env.winL[t] = env.winL[t] || []).push(fn); };
  ctx.removeEventListener = (t, fn) => { env.winL[t] = (env.winL[t] || []).filter(f => f !== fn); };
  vm.createContext(ctx);
  vm.runInContext(SRC['safe-html.js'], ctx, { filename: 'safe-html.js' });   // 자리 칸 이름을 씻어 넣는다(TwSafeHtml)
  vm.runInContext(SRC['ps1-dither.js'], ctx, { filename: 'ps1-dither.js' });   // 🕹️ PS1 필터가 부를 때 읽는 디더 규칙(TwPs1Dither)
  vm.runInContext(NET, ctx, { filename: 'purikura-net.js' });
  vm.runInContext(SRC['myhome-hooks.js'], ctx, { filename: 'myhome-hooks.js' });
  /* 🎵 마이홈 BGM 고리(myhome-edit.js 가 부팅 때 고리판에 건다) — 여기선 마이홈 BGM 이 안 도는 판 */
  ctx.TwMyHomeHooks.on(ctx.TwMyHomeHooks.HOOK.BGM_PLAYING, () => false); ctx.TwMyHomeHooks.on(ctx.TwMyHomeHooks.HOOK.BGM_SET_PLAYING, () => {});
  vm.runInContext(SRC['bgm-hush.js'], ctx, { filename: 'bgm-hush.js' });   // 🔇 듣던 BGM 재우기 · 되살리기 규칙(TwBgmHush)
  vm.runInContext(SRC['pk-bgm.js'], ctx, { filename: 'pk-bgm.js' });   // 🎵 창 BGM(재생 · 끄기 기억) — purikura-ui.js 가 만들 때 부른다
  vm.runInContext(opt.mod || MOD, ctx, { filename: 'purikura-ui.js' });
  env.ctx = ctx; env.els = els; env.opt = opt;
  env.mk = () => ctx.TwPurikuraUi.createPurikuraUi({
    purikura: () => sess,
    toast: (m) => env.toasts.push(m),
    myCode: () => 'uA',
    bringWinToFront: (id) => { env.front = id; },
    escRegisterWindow: (o) => env.esc.push(o),
    plRender: () => { env.plRender++; },
    plPlaying: () => env.plPlaying,
    setPlPlaying: v => { env.plPlaying = v; },
    officeMode: () => env.office,
    lsSet: (k, v) => { env.lsSets.push([k, v]); env.ls[k] = String(v); return true; },
    presence: () => (env.room == null ? undefined : { roomCode: () => env.room }),
    addRunLights: () => U(), findMySeat: () => { env.mySeatCalls++; return null; }, setFaceMap(){}, animateRig(){}, targetFor: () => U(),
    setBone(){}, hueOBC(){}, trickArmBase: () => 0, trickArmSpread: () => 0, trickLegPose: () => ({ legL: { x: 0, z: 0 }, legR: { x: 0, z: 0 } }),
    seats: [],
    animalHandRest: -1,
    spineAxis: () => 1, headAxis: () => 1, handRest: () => -1, shakeArmDroop: () => 0.5,
  });
  return env;
}
const sec = async (title, fn) => { say(title); try{ await fn(); }catch(e){ chk(false, '이 절을 못 돌았다 — ' + (e && e.stack || e)); } };

(async () => {
await sec('── 1. 만들 때 — 배선 _pkWire', () => {
  const e = mkEnv(); const ui = e.mk();
  chk(typeof ui.open === 'function' && typeof ui.close === 'function' && typeof ui.isOpen === 'function' && typeof ui.phase === 'function',
    '내놓는 이름 — open · close · isOpen · phase');
  chk(['onPeers', 'onMeta', 'onPeerEvent', 'onShot', 'onSlots', 'onFrames', 'onRefused', 'onLateStart'].every(n => typeof ui[n] === 'function'), '세션 콜백 여덟 — onPeers · onMeta · onPeerEvent · onShot · onSlots · onFrames · onRefused · onLateStart');
  chk(e.esc.length === 1 && e.esc[0].key === 'purikura' && e.esc[0].el === e.els.pkOverlay, '⎋ 사다리에 한 번 태운다(key purikura · #pkOverlay)');
  chk(e.esc[0].isOpen() === false, '  isOpen 은 DOM(.on)을 읽는다 — 처음엔 닫힘');
  chk(typeof e.els.pkCloseBtn.onclick === 'function' && typeof e.els.pkStartBtn.onclick === 'function' && typeof e.els.pkSaveBtn.onclick === 'function',
    '버튼 연결 — ✕ · 촬영 시작 · 저장');
  chk((e.winL.resize || []).length === 1 && (e.els.pkWin.querySelector('.pk-tbar')._L.pointerdown || []).length === 1, '창 끌기(타이틀바) · 창 크기가 바뀌면 창을 데려오는 감시 하나');
  chk(ui.isOpen() === false && ui.phase() === 'lobby' && ui.close(false) === false, '처음엔 닫혀 있고 로비 · 닫기는 false');
  const e2 = mkEnv({ noDom: true }); let ok = true; try{ e2.mk(); }catch(_){ ok = false; }
  chk(ok && e2.esc.length === 0, 'DOM 이 없으면(#pkOverlay 없음) 조용히 아무것도 안 건다');
});

await sec('── 2. 문 — 자리를 잡기 전에 막는다', async () => {
  let e = mkEnv({ office: true }); let ui = e.mk(); await ui.open();
  chk(e.toasts[0] === '🏢 회사원 모드에서는 쓸 수 없어요' && !e.opened && !ui.isOpen(), '🏢 회사원 모드 — 안내만 (officeMode 는 읽는 함수)');
  e = mkEnv(); ui = e.mk(); e.office = true; await ui.open();
  chk(e.toasts[0] === '🏢 회사원 모드에서는 쓸 수 없어요', '  만든 뒤에 켜도 그 순간 값을 본다(값을 붙들지 않는다)');
  e = mkEnv({ noSession: true }); ui = e.mk(); await ui.open();
  chk(e.toasts[0] === '📷 스티커사진은 아직 준비 중이에요', '세션이 없으면 «준비 중»');
  e = mkEnv({ room: null }); ui = e.mk(); await ui.open();
  chk(e.toasts[0] === '방에 들어간 뒤에 쓸 수 있어요' && !e.opened, '방 밖이면 안내 (Presence 는 읽는 함수)');
  e = mkEnv({ quota: { ok: false, label: '0 / 400', message: '오늘은 닫혔어요' } }); ui = e.mk(); await ui.open();
  chk(e.toasts[0] === '오늘은 닫혔어요' && !e.opened && e.errors.length === 0, '정원이 닫혔으면 그 문구(실패 번호 없이 안내만)');
  e = mkEnv({ quotaThrows: true }); ui = e.mk(); await ui.open();
  chk(e.errors.length === 1 && e.errors[0][0] === 'E-PK-01' && e.toasts.length === 0 && !e.opened && !ui.isOpen(), '★ 정원을 못 읽으면 E-PK-01 — «닫힘» 안내와 다르다(못 읽음 ≠ 0회 남음) · 자리를 안 잡는다');
  const refuse = async (reason) => { const m = mkEnv({ openRes: { ok: false, reason } }); const u = m.mk(); await u.open(); return [m, u]; };
  let u2; [e, u2] = await refuse('busy');
  chk(e.opened && e.toasts[0] === '📷 지금 촬영 중이에요 — 끝나면 들어갈 수 있어요' && !u2.isOpen() && e.errors.length === 0, '★ 촬영 중(busy)이면 서버 거절 그대로 안내 — peek 으로 미리 읽지 않는다(판정은 서버)');
  [e, u2] = await refuse('full');
  chk(e.toasts[0] === '자리가 다 찼어요 (4명까지)' && !u2.isOpen() && e.errors.length === 0, '자리가 다 찼으면(full) 안내');
  [e, u2] = await refuse('notInRoom');
  chk(e.toasts[0] === '방에 들어간 뒤에 쓸 수 있어요' && !u2.isOpen() && e.errors.length === 0, '서버가 방 밖이라 하면(notInRoom) 안내');
  for(const reason of ['timeout', 'notReady', 'error', undefined]){
    [e, u2] = await refuse(reason);
    chk(e.errors.length === 1 && e.errors[0][0] === 'E-PK-02' && e.toasts.length === 0 && !u2.isOpen(), '자리 잡기 실패(' + reason + ') → E-PK-02 · 창은 안 열린다');
  }
  e = mkEnv({ openThrows: true }); ui = e.mk(); await ui.open();
  chk(e.errors.length === 1 && e.errors[0][0] === 'E-PK-02' && !ui.isOpen(), '자리 잡기가 던져도 E-PK-02 로 알린다(조용히 멈추지 않는다)');
  e = mkEnv(); ui = e.mk(); await ui.open();
  chk(e.opened.me.userCode === 'uA' && !('userId' in e.opened.me) && !('name' in e.opened.me), '내 코드(userCode)만 넘긴다 — 이름은 서버가 방 멤버 이름으로 채운다');
});

await sec('── 3-2. 3D 없는 방장 — 촬영 시작을 막고 안내만(E-SYS-07)', async () => {
  const e = mkEnv({ noGl: true }); const ui = e.mk(); await ui.open();
  const PK = ui.state();
  chk(ui.isOpen() && PK.host === true && !PK.renderer, '3D 를 못 만들어도 창은 열린다(방장) — 무대는 없음');
  await e.els.pkStartBtn.onclick({ stopPropagation(){} });
  chk(e.starts === 0 && e.notices.join() === 'E-SYS-07' && PK.state !== 'shooting' && PK.shots.length === 0, '★ 촬영 시작을 눌러도 시작하지 않는다(정원 차감 start 안 부름) · 안내 번호 E-SYS-07 한 번 · 촬영 중이 아님');
  const ok = mkEnv({}); const ui2 = ok.mk(); await ui2.open();
  await ok.els.pkStartBtn.onclick({ stopPropagation(){} });
  chk(ok.starts === 1 && ok.notices.length === 0, '3D 가 있는 방장은 예전처럼 시작한다(다른 사람 영향 없음)');
  const g = mkEnv({ noGl: true, openRes: { ok: true, slot: 1, host: false } }); g.host = false; g.mySlot = 1; const ui3 = g.mk(); await ui3.open();
  await g.els.pkStartBtn.onclick({ stopPropagation(){} });
  chk(g.starts === 0 && g.notices.length === 0, '방장이 아닌 참가자는 눌러도 아무 일 없고 안내도 없다(3D 없어도 로비 사용)');
  const MUT = MOD.replace("if(!PK.renderer){ TwErrorCodes.notify('E-SYS-07'); return; }", '');
  const m = mkEnv({ noGl: true, mod: MUT }); const um = m.mk(); await um.open(); let th = null;
  try{ await m.els.pkStartBtn.onclick({ stopPropagation(){} }); }catch(err){ th = err; }
  chk(MUT !== MOD && (m.starts === 1 || m.notices.length === 0), 'mutation test: 얼리 리턴을 지우면 3D 없는 방장도 시작해 버린다(정원 차감 start 가 불린다) → 빨강');
});
await sec('── 3. 열고 닫기 — 가짜 THREE · DOM 위에서', async () => {
  const e = mkEnv({ plPlaying: true }); const ui = e.mk();
  await ui.open();
  const PK = ui.state();
  chk(ui.isOpen() && PK.room === 'ROOM1' && PK.slot === 0 && PK.host === true, '열렸다 — 방 · 자리 · 방장');
  chk(e.els.pkOverlay.classList.contains('on') && e.front === 'pkOverlay' && e.esc[0].isOpen(), '#pkOverlay.on · 맨 앞으로 · ⎋ 사다리도 열림으로 본다');
  chk(e.watch === 1 && PK.listening === true, '정원 구독 하나 · 자리 · 프레임 듣기(창이 열려 있는 동안만 — 구독은 서버 세션 쪽)');
  chk(JSON.stringify(PK.members) === '{"0":{"uid":"uA","name":"나","fx":1}}', '★ 자리를 잡는 답에 실려 온 첫 자리 배치를 열 때 한 번 그린다(welcome 은 창이 열리기 전에 도착)');
  chk(e.configs.length === 1 && e.configs[0].orient === 'p' && e.configs[0].cuts === 4, '방장이면 지금 설정을 방에 알린다');
  chk(e.frameWrites.length === 4 && e.frameWrites.every(([i, u], k) => i === k && u === null), '방장으로 로비를 잡으면 남은 프레임 넷을 서버에서 비운다(setFrameUrl(i, null))');
  chk((e.winL.keydown || []).length === 1 && (e.winL.keyup || []).length === 1 && e.raf.length === 1, '키 둘 · 무대 루프를 건다');
  chk(!!PK.renderer && !!PK.scene && !!PK.cam, '전용 렌더러 · 씬 · 카메라');
  chk(e.pause === 1 && e.plPlaying === false && e.plRender === 1 && PK.hushed && PK.hushed.pl === true, '듣던 플레이리스트를 재우고 ▶ 표시도 내린다 (setPlPlaying(false))');
  chk(e.audio.length === 1 && e.audio[0].paused === false && /purikura-bgm\.mp3$/.test(e.audio[0].src), '이 창의 BGM 을 건다');
  let loopOk = true; try{ e.raf[0](1016); }catch(err){ loopOk = false; say('    ' + err.message); }
  chk(loopOk, '무대 루프 한 바퀴가 안 터진다');
  e.quotaCb({ ok: true, label: '4 / 400' });
  chk(e.els.pkQuota.textContent === '오늘 4 / 400', '정원 구독이 «오늘 n» 을 고친다');
  PK.state = 'shooting'; PK.cutIdx = 0;
  chk(ui.close(false) === false && e.toasts.indexOf('세는 중에는 닫을 수 없어요') >= 0 && ui.isOpen(), '세는 중에는 못 닫는다');
  chk(ui.phase() === 'shooting', 'phase 는 PK.state 를 그대로 (회사원 모드가 이걸 본다)');
  PK.state = 'lobby'; PK.cutIdx = -1;
  chk(ui.close(false) === true && !ui.isOpen(), '로비에서는 닫힌다');
  chk(e.unwatch === 1 && e.closed === 1 && PK.listening === false, '닫으면 정원 구독을 풀고 듣기를 끊고 자리를 내놓는다');
  chk((e.winL.keydown || []).length === 0 && (e.winL.keyup || []).length === 0, '키를 돌려준다');
  chk(!e.els.pkOverlay.classList.contains('on') && !PK.renderer && PK.room === null && PK.slot === -1, '창을 숨기고 무대를 치운다');
  chk(e.audio[0].paused === true && e.resume === 1 && e.plPlaying === true && e.plRender === 2, 'BGM 을 끄고 재웠던 플레이리스트만 되살린다 (setPlPlaying(true))');
  /* 다시 열기 — 지난 값이 남지 않는다 */
  await ui.open();
  chk(ui.isOpen() && PK.waitCut === -1 && PK.frozen === false && PK.up.length === 4, '다시 열면 지난 촬영 값이 안 남는다');
  e.plPlaying = true;   // 그 사이에 사용자가 직접 다시 틀었다
  ui.close(true);
  chk(e.resume === 1, '그 사이에 직접 다시 틀었으면 resume 을 또 안 부른다(두 소리가 겹친다)');
});

await sec('── 3-2. 제목줄 «음악 끄기 / 음악 켜기»', async () => {
  const e = mkEnv(); const ui = e.mk();
  const btn = e.els.pkBgmBtn;
  chk(typeof btn.onclick === 'function', '제목줄 버튼을 건다(#pkBgmBtn)');
  await ui.open();
  chk(e.audio[0] && e.audio[0].paused === false && btn.textContent === '음악 끄기' && !btn.classList.contains('off'), '처음엔 음악이 나고 버튼은 «음악 끄기»');
  let stopped = 0; btn.onclick({ stopPropagation(){ stopped++; } });
  chk(e.audio[0].paused === true && btn.textContent === '음악 켜기' && btn.classList.contains('off') && stopped === 1, '★ 누르면 바로 멈추고 «음악 켜기»(노란 글) · 창 끌기로 안 번진다');
  chk(e.lsSets.length === 1 && e.lsSets[0][0] === 'tw.pkBgmMuted' && e.lsSets[0][1] === '1', '★ 끈 상태를 이 PC 에 기억한다(_lsSet — 실패 알림은 그쪽)');
  ui.close(false);
  await ui.open();
  chk(e.audio[0].paused === true && btn.textContent === '음악 켜기', '★ 꺼 두고 다시 열면 소리 없이 «음악 켜기» 로 연다');
  btn.onclick({ stopPropagation(){} });
  chk(e.audio[0].paused === false && btn.textContent === '음악 끄기' && e.lsSets[1][1] === '0', '다시 누르면 켜지고 기억도 풀린다');
  ui.close(false);
  chk(e.audio[0].paused === true, '닫으면 멈춘다');
  const e2 = mkEnv({ ls: { 'tw.pkBgmMuted': '1' } }); const ui2 = e2.mk(); await ui2.open();
  chk(e2.audio.length === 0 && e2.els.pkBgmBtn.textContent === '음악 켜기' && e2.pause === 0, '★ 지난번에 꺼 둔 PC — 처음 열 때부터 소리 없음(파일도 안 만든다)');
});

await sec('── 4. 세션 콜백 — 창이 닫혀 있어도 안 터진다', () => {
  const e = mkEnv(); const ui = e.mk();
  ui.onPeers({ 1: { x: 1 } });
  chk(ui.state().peers[1].x === 1, 'onPeers 가 PK.peers 를 갈아 끼운다');
  ui.onPeers(null);
  chk(JSON.stringify(ui.state().peers) === '{}', '  null 이면 빈 것');
  let ok = true;
  try{ ui.onMeta({ state: 'lobby' }); ui.onPeerEvent(1, { k: 'j', at: 1 }); ui.onShot({ i: 0, at: 1 }); ui.onSlots({ 0: { uid: 'uB', name: 'b', fx: 1 } }); ui.onFrames({ 0: 'https://x' }); ui.onRefused({ ref: 'photoConfig', code: 'ROOM_PHOTO_NOT_HOST' }); ui.onLateStart(); }catch(err){ ok = false; say('    ' + err.message); }
  chk(ok && !ui.isOpen() && e.errors.length === 0, 'onMeta · onPeerEvent · onShot · onSlots · onFrames · onRefused — 닫혀 있으면 조용히 흘린다(번호도 안 띄운다)');
  const st0 = ui.state();
  chk(Object.keys(st0.members || {}).length === 0 && Object.keys(st0.frameSrc || {}).length === 0, '  닫혀 있을 때 온 자리 · 프레임으로 상태가 바뀌지 않는다(듣는 동안만 받는다)');
});

await sec('── 4-2. 서버 시각을 모르면 컷을 열지 않는다', async () => {
  /* 방장이 📷 를 눌렀는데 서버 시각이 null — 기기 시계로 컷 시각을 정하지 않고(setCut 안 부름) E-PK-03 · console.warn · 다시 누를 수 있게 기다림 칸을 되돌린다 */
  const press = async (mod) => {
    const m = mkEnv({ startRes: { ok: true, n: 1, left: 399, nth: '1번째 · 399회 남음' }, mod }); const u = m.mk(); await u.open(); await m.els.pkStartBtn.onclick({ stopPropagation(){} }); await flush();
    const PK = u.state(); m.cuts = []; m.errors.length = 0; m.warns.length = 0;
    m.opt.srvNow = null; PK.camUI.shoot.onclick();
    const r = { cuts: m.cuts.slice(), errs: m.errors.map(x => x[0]), warned: m.warns.some(w => /서버 시각/.test(w)), wait: PK.waitCut };
    m.opt.srvNow = 5000; PK.waitCut = 0; m.cuts = []; PK.camUI.shoot.onclick();
    r.later = m.cuts.slice(); r.waitAfter = PK.waitCut; u.close(true);
    return r;
  };
  const r = await press();
  chk(r.cuts.length === 0 && r.errs.join() === 'E-PK-03' && r.warned && r.wait === 0, '★ 서버 시각 null — 컷을 열지 않고(setCut 0건) E-PK-03 · console.warn · 기다림 칸 그대로(다시 누를 수 있다)');
  chk(r.later.length === 1 && r.later[0][0] === 0 && r.later[0][1] === 5000 && r.waitAfter === -1, '  시각이 있으면 그 서버 시각으로 컷을 연다(setCut(0, 5000))');
  const bad = MOD.replace("const t = pk ? pk.serverNow() : null;", "const t = pk ? (pk.serverNow() === null ? Date.now() : pk.serverNow()) : Date.now();");
  const rb = bad === MOD ? null : await press(bad);
  chk(rb && rb.cuts.length === 1, 'mutation test: 시각을 모를 때 기기 시계로 대신하게 되돌리면 4-2절이 빨강');
});

await sec('── 5. app.js 배선', () => {
  const code = strip(APP);
  chk(!/function (openPurikura|closePurikura|_pk[A-Z]\w*|_pkd[A-Z]\w*)\(|\bconst (PK|PKD|PK_[A-Z_]+)\s*=|\blet _pk\w+\s*=\s*null/.test(code.replace(/let _pkSession = null;/, '')),
    '스티커사진 창 정의는 app.js 에 없다(모듈에만 — 세션 입구 _purikura · _pkSession 만 남음)');
  chk(/function _purikura\(\)/.test(APP) && /async function openPurikura\(\)/.test(MOD) && /function closePurikura\(force\)/.test(MOD) && /window\.TwPurikuraUi = api/.test(MOD),
    '세션 입구는 app.js · 화면은 모듈 · window.TwPurikuraUi');
  chk((code.match(/TwPurikuraUi\.createPurikuraUi\(/g) || []).length === 1, 'createPurikuraUi 는 한 곳');
  const iMk = APP.indexOf('TwPurikuraUi.createPurikuraUi('), iEntry = APP.indexOf('function _purikura()'), iNext = APP.indexOf('/* ═══ 🔫 러시안룰렛');
  chk(iEntry > 0 && iMk > iEntry && iNext > iMk, '원래 자리 — 세션 입구(_purikura) 뒤 · 🔫 러시안룰렛 앞');
  const entry = (APP.match(/function _purikura\(\)\{[\s\S]*?\n\}/) || [''])[0];
  chk(/TwPurikuraRt\.createPhotoSession\(\{/.test(entry) && /hub: TwRtHub\.store, api: TwApi\.authed, P: Purikura/.test(entry) && /p\.serverNow\(\)/.test(entry), '세션 입구 — 세션 포트 하나(realtime 연결 · 로그인 API · 순수 계산) · 서버 시각은 방 포트 시계');
  chk(!/makeSession|firebaseAPI|pkGet|pkOnValue/.test(entry) && !/Purikura\.makeSession|firebaseAPI\.pk(?!UploadFrame)/.test(APP), '  Firebase 경로(makeSession · pk*)가 app.js 에 없다');
  chk(/onPeers: p => \{ purikuraUi\.onPeers\(p\); \}/.test(entry) && /onMeta : m => \{ purikuraUi\.onMeta\(m\); \}/.test(entry)
    && /onEvent: \(slot, ev\) => \{ purikuraUi\.onPeerEvent\(slot, ev\); \}/.test(entry) && /onShot : s => \{ purikuraUi\.onShot\(s\); \}/.test(entry)
    && /onSlots: o => \{ purikuraUi\.onSlots\(o\); \}/.test(entry) && /onFrames: o => \{ purikuraUi\.onFrames\(o\); \}/.test(entry) && /onRefused: o => \{ purikuraUi\.onRefused\(o\); \}/.test(entry) && /onLateStart: \(\) => \{ purikuraUi\.onLateStart\(\); \}/.test(entry),
    '세션 콜백 여덟이 모듈로 들어간다');
  chk(/try\{ if\(purikuraUi\.isOpen\(\)\) return; \}catch\(_\)\{\}/.test(code) && /try\{ await purikuraUi\.open\(\); \}/.test(strip(CW))
    && /if\(purikuraUi\.isOpen\(\)\)\{\s*if\(purikuraUi\.phase\(\) === 'shooting'\)[^\n]*\n\s*else if\(purikuraUi\.close\(true\)\)/.test(code),
    '부르는 곳 — 때리기 조준 키 · 📷 버튼(chat-window.js) · 회사원 모드 켜기');
  const off = (APP.match(/const PURIKURA_UI_OFF = \{([\s\S]*?)\};/) || [])[1] || '';
  const used = [...new Set((code.match(/purikuraUi\.(\w+)/g) || []).map(s => s.split('.')[1]))];
  chk(!/\bPURIKURA_UI_OFF\b/.test(APP), '빈 껍데기 PURIKURA_UI_OFF 없음 — 모듈은 늘 싣는다(가드 걷기 3차)');
  const call = (APP.match(/TwPurikuraUi\.createPurikuraUi\(\{([\s\S]*?)\n\}\);/) || [])[1] || '';
  const deps = call.split('\n').map(s => s.trim()).filter(Boolean);
  chk(deps.length === 27 && deps.every(l => /^\w+: (\(\)=>|\(\.\.\.a\)=>|v=>\{ (_\w+|plMod\.st\.\w+) = v; \},$|[A-Z_]+,$)|^seats,$/.test(l)),
    'deps 27개 — 함수는 화살표로 감싼다(부를 때 찾게) · 값은 상수만 (' + deps.length + ')');
  chk(/myCode: \(\)=>TwRoomRt\.store\.myCode\(\),/.test(call) && !/getMyUserId|getDisplayName/.test(call), '내 코드는 방 포트의 연결의 나(myCode) — 옛 getMyUserId · getDisplayName 은 안 받는다');
  chk(/plPlaying: \(\)=>plMod\.st\.playing,/.test(call) && /setPlPlaying: v=>\{ plMod\.st\.playing = v; \},/.test(call) && /officeMode: \(\)=>officeMode,/.test(call),
    '다시 대입되는 let(officeMode · _plPlaying — playlist.js 상태 묶음 plMod.st.playing)은 읽는 함수로 · 쓰기는 setPlPlaying');
  chk(['presence: ()=>Presence', 'spineAxis: ()=>SPINE_AXIS', 'headAxis: ()=>HEAD_AXIS', 'handRest: ()=>HAND_REST', 'shakeArmDroop: ()=>SHAKE_ARM_DROOP'].every(s => call.indexOf(s) >= 0)
    && ['const Presence', 'const SPINE_AXIS', 'const HAND_REST', 'const SHAKE_ARM_DROOP'].every(s => APP.indexOf(s) > iMk),
    '이 줄보다 뒤에 선언되는 const(Presence · 리그 상수 넷)는 읽는 함수로 — 만들 때 읽으면 TDZ');
  const m = strip(MOD);
  chk(!/[^.\w]officeMode\)/.test(m) && !/!!_plPlaying;/.test(m) && !/_plPlaying = (true|false)/.test(m) && !/Presence\.roomCode/.test(m) && !/SPINE_AXIS\*|HEAD_AXIS\*|: HAND_REST,|SHAKE_ARM_DROOP,/.test(m),
    '모듈 본문은 읽는 함수만 부른다(값으로 쓰면 함수가 늘 참이 된다)');
  const at = (f) => { const m = HTML.match(new RegExp('<script src="parts/(?:purikura/)?' + f.replace('.', '\\.') + '"></script>')); return m ? m.index : -1; };   // 📂 purikura/ 폴더로 옮겼다(구조 정리 3단계) — 예전 자리도 받는다
  const iU = at('purikura-ui.js'), iN = at('purikura-net.js'), iR = at('purikura-rt.js'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
  chk(iN > 0 && iU > iN && iU < iA, 'html — purikura-ui.js 를 purikura-net.js 뒤 · app.js 앞에 싣는다');
  chk(iR > iN && iR < iA, 'html — purikura-rt.js 를 purikura-net.js 뒤 · app.js 앞에 싣는다');
  chk(!/firebaseAPI\.(?!pkUploadFrame\()\w+/.test(m) && !/\bpk(?:OnValue|Update|Get|Set|Remove|Transaction)\(|\.peek\(|adoptSlots/.test(m), '화면(purikura-ui.js)에 Firebase 경로가 없다 — 남은 것은 프레임 Storage 올리기(pkUploadFrame)뿐 · peek · adoptSlots 도 없다');
  /* #103 교훈 — 크로미움 내장 전역(Scheduler 등)과 겹치면 typeof 가드가 늘 통과한다. 접두사로 피한다(헤드리스 크로미움에서 typeof 확인) */
  chk(/^Tw[A-Z]/.test('TwPurikuraUi') && !/window\.(Purikura|PurikuraUi)\s*=/.test(MOD), '전역 이름은 Tw 접두사 — 내장 전역 · 통신 계층(window.Purikura)과 안 겹침');
});

say('');
say(fail ? ('✗ ' + fail + '건 어긋남 · 통과 ' + pass) : ('✅ 전부 통과 ' + pass));
console.log(pass + ' · ' + fail);
process.exit(fail ? 1 : 0);
})();
