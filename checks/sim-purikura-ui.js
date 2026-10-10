/* ═══ 📷 sim-purikura-ui.js — 스티커사진 창 모듈 (2026-10-10 신설 · 앱 FSD 3번) ═══════════════════
   app.js 의 📷 스티커사진 구역(촬영 창 + 무대 · 로비 · 전용 씬 · 키 · 매 프레임 · 촬영 · 꾸미기 · 창 옮기기 · 배선)을
   parts/purikura-ui.js 로 옮겼다. 동작은 그대로여야 한다. 화면 규약(렌더러 · 캡처 · 꾸미기 · 필터)은 sim-purikura-stage ·
   -deco · -fish · sim-pk-fit · sim-fix-0923 이 이 파일을 읽어 보고, 여기서는 «옮긴 것» 자체를 굴려 본다.
   ・1절: 만들 때 — _pkWire 가 버튼 · ⎋ 사다리(escRegisterWindow) · 창 크기 감시를 건다 · DOM 이 없으면 조용히
   ・2절: 문 — 회사원 모드 · 세션 없음 · 방 밖 · 정원 닫힘 · 촬영 중이면 자리를 안 잡고 안내만 (officeMode · Presence 는 읽는 함수)
   ・3절: 열고 닫기 — 가짜 THREE · DOM 위에서 실제로 연다 · 정원 · slots · frames 구독 · 방장 설정 전송 · 키 · 무대 루프 ·
          BGM(듣던 플레이리스트 재우기 → 닫으면 되살리기 — _plPlaying 은 읽는 함수 + setPlPlaying) · 닫으면 구독 해제 · 세는 중엔 못 닫음
   ・4절: 세션 콜백 — onPeers · onMeta · onPeerEvent · onShot 이 창이 닫혀 있어도 안 터진다
   ・5절: app.js 배선 — 정의는 모듈에만 · createPurikuraUi 는 원래 자리(세션 입구 _purikura 뒤 · 🎟️ 하루 횟수 앞) ·
          부르는 곳은 purikuraUi.이름 · 빈 껍데기 · deps 모양 · html 순서 · 전역 이름
   [실행] purikura-ui.js · purikura-net.js · app.js · desk-companion-prototype.html 이 있는 폴더에서. */
'use strict';
const fs = require('fs');
const vm = require('vm');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = ['purikura-ui.js', 'purikura-net.js', 'app.js', 'desk-companion-prototype.html'];
const SRC = {};
for(const f of need){ SRC[f] = read(f); if(SRC[f] == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } }
const APP = SRC['app.js'], HTML = SRC['desk-companion-prototype.html'], MOD = SRC['purikura-ui.js'], NET = SRC['purikura-net.js'];
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
    closed: 0, configs: [], pause: 0, resume: 0, plPlaying: !!opt.plPlaying, plRender: 0, office: !!opt.office,
    room: opt.room === undefined ? 'ROOM1' : opt.room, audio: [], fbWrites: [] };
  const els = {};
  const getEl = id => (opt.noDom ? null : (els[id] || (els[id] = mkEl('div', id))));
  const sess = opt.noSession ? null : Object.assign(new Proxy({}, { get: (t, k) => (k in t ? t[k] : (typeof k === 'symbol' || k === 'then') ? undefined : (() => Promise.resolve(true))) }), {
    checkQuota: async () => (opt.quota || { ok: true, label: '3 / 400', message: '' }),
    peek: async () => ({ busy: !!opt.busy }),
    open: async (room, me) => { env.opened = { room, me }; return opt.openRes || { ok: true, slot: 0, host: true }; },
    watchQuota: cb => { env.watch++; env.quotaCb = cb; return () => { env.unwatch++; }; },
    setConfig: cfg => { env.configs.push(cfg); return Promise.resolve(true); },
    hostSlot: () => 0, adoptSlots(){}, close(){ env.closed++; },
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
    confirm: () => true, THREE: U(),
    companion: { pauseBgm(){ env.pause++; }, resumeBgm(){ env.resume++; } },
    firebaseAPI: {
      pkOnValue: (path, cb) => { env.subs.push(path); return () => { env.unsubs++; }; },
      pkUpdate: (path, v) => { env.fbWrites.push(path); return Promise.resolve(); },
      pkUploadFrame: async () => 'https://x', serverNow: () => 1000,
    },
  };
  ctx.window = ctx;
  ctx.addEventListener = (t, fn) => { (env.winL[t] = env.winL[t] || []).push(fn); };
  ctx.removeEventListener = (t, fn) => { env.winL[t] = (env.winL[t] || []).filter(f => f !== fn); };
  vm.createContext(ctx);
  vm.runInContext(NET, ctx, { filename: 'purikura-net.js' });
  vm.runInContext(MOD, ctx, { filename: 'purikura-ui.js' });
  env.ctx = ctx; env.els = els;
  env.mk = () => ctx.TwPurikuraUi.createPurikuraUi({
    purikura: () => sess,
    toast: (m) => env.toasts.push(m),
    getMyUserId: () => 'uA',
    getDisplayName: () => '나',
    bringWinToFront: (id) => { env.front = id; },
    escRegisterWindow: (o) => env.esc.push(o),
    plRender: () => { env.plRender++; },
    plPlaying: () => env.plPlaying,
    setPlPlaying: v => { env.plPlaying = v; },
    officeMode: () => env.office,
    presence: () => (env.room == null ? undefined : { roomCode: () => env.room }),
    mkFrontFill: () => U(), findMySeat: () => null, setFaceMap(){}, animateRig(){}, targetFor: () => U(),
    setBone(){}, hueOBC(){}, trickArmBase: () => 0, trickArmSpread: () => 0, trickLegPose: () => ({ legL: { x: 0, z: 0 }, legR: { x: 0, z: 0 } }),
    seats: [],
    mainLightCol: 0xffffff, mainLightInt: 1, keyLightMul: 1, fillLightMul: 1, animalHandRest: -1,
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
  chk(['onPeers', 'onMeta', 'onPeerEvent', 'onShot'].every(n => typeof ui[n] === 'function'), '세션 콜백 넷 — onPeers · onMeta · onPeerEvent · onShot');
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
  chk(e.toasts[0] === '오늘은 닫혔어요' && !e.opened, '정원이 닫혔으면 그 문구');
  e = mkEnv({ busy: true }); ui = e.mk(); await ui.open();
  chk(e.toasts[0] === '📷 지금 촬영 중이에요 — 끝나면 들어갈 수 있어요' && !e.opened, '촬영 중이면 자리를 잡기 전에 막는다');
  e = mkEnv({ openRes: { ok: false, reason: 'full' } }); ui = e.mk(); await ui.open();
  chk(e.toasts[0] === '자리가 다 찼어요 (4명까지)' && !ui.isOpen(), '자리가 다 찼으면 안내');
});

await sec('── 3. 열고 닫기 — 가짜 THREE · DOM 위에서', async () => {
  const e = mkEnv({ plPlaying: true }); const ui = e.mk();
  await ui.open();
  const PK = ui.state();
  chk(ui.isOpen() && PK.room === 'ROOM1' && PK.slot === 0 && PK.host === true, '열렸다 — 방 · 자리 · 방장');
  chk(e.opened && e.opened.me.userId === 'uA' && e.opened.me.name === '나', '자리 잡기에 내 아이디 · 이름');
  chk(e.els.pkOverlay.classList.contains('on') && e.front === 'pkOverlay' && e.esc[0].isOpen(), '#pkOverlay.on · 맨 앞으로 · ⎋ 사다리도 열림으로 본다');
  chk(e.watch === 1 && e.subs.join() === 'rooms/ROOM1/_photo/slots,rooms/ROOM1/_photo/frames', '정원 구독 하나 · slots · frames 구독(창이 열려 있는 동안만)');
  chk(e.configs.length === 1 && e.configs[0].orient === 'p' && e.configs[0].cuts === 4, '방장이면 지금 설정을 방에 알린다');
  chk(e.fbWrites.join() === 'rooms/ROOM1/_photo/frames', '방장으로 로비를 잡으면 남은 프레임 노드를 비운다');
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
  chk(e.unwatch === 1 && e.unsubs === 2 && e.closed === 1, '닫으면 정원 · slots · frames 구독을 풀고 자리를 내놓는다');
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

await sec('── 4. 세션 콜백 — 창이 닫혀 있어도 안 터진다', () => {
  const e = mkEnv(); const ui = e.mk();
  ui.onPeers({ 1: { x: 1 } });
  chk(ui.state().peers[1].x === 1, 'onPeers 가 PK.peers 를 갈아 끼운다');
  ui.onPeers(null);
  chk(JSON.stringify(ui.state().peers) === '{}', '  null 이면 빈 것');
  let ok = true;
  try{ ui.onMeta({ state: 'lobby' }); ui.onPeerEvent(1, { k: 'j', at: 1 }); ui.onShot({ i: 0, at: 1 }); }catch(err){ ok = false; say('    ' + err.message); }
  chk(ok && !ui.isOpen(), 'onMeta · onPeerEvent · onShot — 닫혀 있으면 조용히 흘린다');
});

await sec('── 5. app.js 배선', () => {
  const code = strip(APP);
  chk(!/function (openPurikura|closePurikura|_pk[A-Z]\w*|_pkd[A-Z]\w*)\(|\bconst (PK|PKD|PK_[A-Z_]+)\s*=|\blet _pk\w+\s*=\s*null/.test(code.replace(/let _pkSession = null;/, '')),
    '스티커사진 창 정의는 app.js 에 없다(모듈에만 — 세션 입구 _purikura · _pkSession 만 남음)');
  chk(/function _purikura\(\)/.test(APP) && /async function openPurikura\(\)/.test(MOD) && /function closePurikura\(force\)/.test(MOD) && /window\.TwPurikuraUi = api/.test(MOD),
    '세션 입구는 app.js · 화면은 모듈 · window.TwPurikuraUi');
  chk((code.match(/TwPurikuraUi\.createPurikuraUi\(/g) || []).length === 1, 'createPurikuraUi 는 한 곳');
  const iMk = APP.indexOf('TwPurikuraUi.createPurikuraUi('), iEntry = APP.indexOf('function _purikura()'), iNext = APP.indexOf('/* ═══ 🎟️ [2026-10-02 요청] 하루 횟수 제한');
  chk(iEntry > 0 && iMk > iEntry && iNext > iMk, '원래 자리 — 세션 입구(_purikura) 뒤 · 🎟️ 하루 횟수 제한 앞');
  chk(/onPeers: p => \{ purikuraUi\.onPeers\(p\); \}/.test(APP) && /onMeta : m => \{ purikuraUi\.onMeta\(m\); \}/.test(APP)
    && /onEvent: \(slot, ev\) => \{ purikuraUi\.onPeerEvent\(slot, ev\); \}/.test(APP) && /onShot : s => \{ purikuraUi\.onShot\(s\); \}/.test(APP),
    '세션 콜백 넷이 모듈로 들어간다');
  chk(/try\{ if\(purikuraUi\.isOpen\(\)\) return; \}catch\(_\)\{\}/.test(code) && /try\{ await purikuraUi\.open\(\); \}/.test(code)
    && /if\(purikuraUi\.isOpen\(\)\)\{\s*if\(purikuraUi\.phase\(\) === 'shooting'\)[^\n]*\n\s*else if\(purikuraUi\.close\(true\)\)/.test(code),
    '부르는 곳 — 때리기 조준 키 · 📷 버튼 · 회사원 모드 켜기');
  const off = (APP.match(/const PURIKURA_UI_OFF = \{([\s\S]*?)\};/) || [])[1] || '';
  const used = [...new Set((code.match(/purikuraUi\.(\w+)/g) || []).map(s => s.split('.')[1]))];
  chk(off && used.every(n => new RegExp('\\b' + n + '\\b').test(off)), '빈 껍데기 PURIKURA_UI_OFF 가 부르는 이름을 다 갖는다 (' + used.join(' · ') + ')');
  const call = (APP.match(/TwPurikuraUi\.createPurikuraUi\(\{([\s\S]*?)\n\}\);/) || [])[1] || '';
  const deps = call.split('\n').map(s => s.trim()).filter(Boolean);
  chk(deps.length === 31 && deps.every(l => /^\w+: (\(\)=>|\(\.\.\.a\)=>|v=>\{ _\w+ = v; \},$|[A-Z_]+,$)|^seats,$/.test(l)),
    'deps 31개 — 함수는 화살표로 감싼다(부를 때 찾게) · 값은 상수만 (' + deps.length + ')');
  chk(/plPlaying: \(\)=>_plPlaying,/.test(call) && /setPlPlaying: v=>\{ _plPlaying = v; \},/.test(call) && /officeMode: \(\)=>officeMode,/.test(call),
    '다시 대입되는 let(officeMode · _plPlaying)은 읽는 함수로 · 쓰기는 setPlPlaying');
  chk(['presence: ()=>Presence', 'spineAxis: ()=>SPINE_AXIS', 'headAxis: ()=>HEAD_AXIS', 'handRest: ()=>HAND_REST', 'shakeArmDroop: ()=>SHAKE_ARM_DROOP'].every(s => call.indexOf(s) >= 0)
    && ['const Presence', 'const SPINE_AXIS', 'const HAND_REST', 'const SHAKE_ARM_DROOP'].every(s => APP.indexOf(s) > iMk),
    '이 줄보다 뒤에 선언되는 const(Presence · 리그 상수 넷)는 읽는 함수로 — 만들 때 읽으면 TDZ');
  const m = strip(MOD);
  chk(!/[^.\w]officeMode\)/.test(m) && !/!!_plPlaying;/.test(m) && !/_plPlaying = (true|false)/.test(m) && !/Presence\.roomCode/.test(m) && !/SPINE_AXIS\*|HEAD_AXIS\*|: HAND_REST,|SHAKE_ARM_DROOP,/.test(m),
    '모듈 본문은 읽는 함수만 부른다(값으로 쓰면 함수가 늘 참이 된다)');
  const iU = HTML.indexOf('<script src="parts/purikura-ui.js"></script>'), iN = HTML.indexOf('<script src="parts/purikura-net.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
  chk(iN > 0 && iU > iN && iU < iA, 'html — purikura-ui.js 를 purikura-net.js 뒤 · app.js 앞에 싣는다');
  /* #103 교훈 — 크로미움 내장 전역(Scheduler 등)과 겹치면 typeof 가드가 늘 통과한다. 접두사로 피한다(헤드리스 크로미움에서 typeof 확인) */
  chk(/^Tw[A-Z]/.test('TwPurikuraUi') && !/window\.(Purikura|PurikuraUi)\s*=/.test(MOD), '전역 이름은 Tw 접두사 — 내장 전역 · 통신 계층(window.Purikura)과 안 겹침');
});

say('');
say(fail ? ('✗ ' + fail + '건 어긋남 · 통과 ' + pass) : ('✅ 전부 통과 ' + pass));
console.log(pass + ' · ' + fail);
process.exit(fail ? 1 : 0);
})();
