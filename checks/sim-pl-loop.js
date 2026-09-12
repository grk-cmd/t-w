#!/usr/bin/env node
/* sim-pl-loop.js — 🔁 한 곡 반복을 <video>.loop 로 돌리는가
   실행: node sim-pl-loop.js   (app.js · main.js · preload.js 와 같은 폴더에서)

   [제보 9/11] "한 곡 반복을 하다 보면 안 넘어가거나 반복 재생이 중단된다."
   [옛 방식] 곡이 끝나면 TWPL:ended → 렌더러 _plNext → **같은 주소를 loadURL 로 다시 연다.**
     그때 페이지가 새로 뜨는지 확인되지 않았다(핸드오프 §1 갈래 ①/②). 안 뜨면 옛 주입이 sent=true 로
     살아남아 신호가 끊기고, 감시견이 그걸 실패로 세다가 멈춘다.
   [새 방식] 한 곡 반복이면 main 이 PL 모드에서도 loop 을 건다. 같은 주소를 다시 열 일이 없다.

   ★ 이 검사의 중심은 main.js 의 **주입 스크립트**다. 텍스트로 보지 않는다 —
     bgmForcePlay 를 오려 실제로 스크립트 문자열을 만들게 하고, 그 문자열을 **가짜 유튜브 페이지**
     (시간이 흐르고, 끝에서 loop 이면 되감기고 아니면 ended 를 쏘는 <video>)에서 돌린다.
   ★ «이 기능이 쓰이는 모드»를 전부 돈다: 한 곡 반복 · 목록 반복 · 재생 중 켜기/끄기 · 다시 주입 ·
     4시간 넘게 반복 · 광고 · 마이홈 BGM(PL 아님).
   ★ ✗(깨짐) / ?(검사 못함) 을 구분한다. `?` 만 남아도 종료 코드 2.
*/
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

let fail = 0, unknown = 0, pass = 0;
const say = console.log;
const ok  = m => { pass++;    say('  ✓ ' + m); };
const bad = m => { fail++;    say('  ✗ ' + m); };
const huh = m => { unknown++; say('  ? ' + m); };
const chk = (c, m) => (c ? ok(m) : bad(m));

const need = f => { const p = path.join(__dirname, f);
  if(!fs.existsSync(p)){ say('✗ ' + f + ' 를 찾을 수 없다 — 같은 폴더에서 실행할 것'); process.exit(2); }
  return fs.readFileSync(p, 'utf8'); };
const APP = need('app.js'), MAIN = need('main.js'), PRELOAD = need('preload.js');

/* 이름 있는 함수를 중괄호 균형으로 오려 globalThis 에 얹는다(vm 에서 const/function 은 전역 속성이 안 된다). */
function cutFn(src, name){
  const m = new RegExp('function\\s+' + name + '\\s*\\(').exec(src);
  if(!m) return null;
  const open = src.indexOf('{', m.index + m[0].length - 1);
  let d = 0;
  for(let j = open; j < src.length; j++){
    if(src[j] === '{') d++;
    else if(src[j] === '}' && --d === 0){
      const args = src.slice(m.index + m[0].length, open).replace(/\)\s*$/, '');
      return 'globalThis.' + name + ' = function(' + args + ')' + src.slice(open, j + 1) + ';';
    }
  }
  return null;
}
/* key 바로 뒤의 화살표 함수 하나를 오린다 — 이름 없는 핸들러용. */
function cutArrowAfter(src, key, as){
  const i = src.indexOf(key); if(i < 0) return null;
  const arrow = src.indexOf('=>', i); const open = src.indexOf('{', arrow);
  if(arrow < 0 || open < 0 || arrow - i > key.length + 20) return null;
  const head = src.slice(i + key.length, arrow).trim();
  let d = 0;
  for(let j = open; j < src.length; j++){
    if(src[j] === '{') d++;
    else if(src[j] === '}' && --d === 0) return 'globalThis.' + as + ' = ' + head + ' => ' + src.slice(open, j + 1) + ';';
  }
  return null;
}
/* `ipcMain.on('채널', …);` 한 문장을 괄호 균형으로 오린다. */
function cutIpc(src, channel){
  const key = "ipcMain.on('" + channel + "'";
  const i = src.indexOf(key); if(i < 0) return null;
  const open = src.indexOf('(', i);
  let d = 0;
  for(let j = open; j < src.length; j++){
    if(src[j] === '(') d++;
    else if(src[j] === ')' && --d === 0) return src.slice(i, j + 1) + ';';
  }
  return null;
}

/* ═══ 가짜 유튜브 페이지 ═══════════════════════════════════════════════════
   ⚠️ <video> 는 규격대로 흉내 낸다: loop=true 면 끝에서 조용히 처음으로(ended 없음),
     false 면 끝에 서서 paused=true 가 되고 ended 를 쏜다. 끝난 영상에 play() 하면 처음부터다. */
function makeVideo(dur){
  const L = {};
  const v = {
    currentTime: 0, duration: dur, paused: false, ended: false, loop: false,
    muted: false, volume: 1, playbackRate: 1,
    addEventListener(ev, fn){ (L[ev] = L[ev] || []).push(fn); },
    play(){ if(v.ended || v.currentTime >= v.duration) v.currentTime = 0; v.ended = false; v.paused = false; return { catch(){} }; },
    _advance(sec){
      if(v.paused) return;
      v.currentTime += sec;
      if(v.currentTime >= v.duration){
        if(v.loop) v.currentTime -= v.duration;
        else { v.currentTime = v.duration; v.paused = true; v.ended = true; (L.ended || []).forEach(f => f()); }
      }
    },
  };
  return v;
}
function makePage(dur){
  const msgs = [], timers = [];
  const page = { ad: false, video: makeVideo(dur), msgs, laps: 0 };
  const doc = { querySelector(sel){
    sel = String(sel);
    if(sel === 'video') return page.video;
    if(sel.indexOf('#movie_player') === 0) return { classList: { contains: c => c === 'ad-showing' && page.ad } };
    if(sel.indexOf('.ytp-ad-player-overlay') === 0) return page.ad ? {} : null;
    return null;   // 오류 표시·자동재생 버튼·스킵 버튼·큰 재생 버튼 — 없다
  } };
  const ctx = {
    document: doc, Math, isFinite,
    console: { log: m => msgs.push(String(m)) },
    setInterval: fn => { timers.push(fn); return timers.length; },
    clearInterval: id => { if(id) timers[id - 1] = null; },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  page.ctx = ctx;
  page.run = code => vm.runInContext(code, ctx, { filename: 'bgm-page' });
  page.live = () => timers.filter(Boolean).length;
  /* 0.5초 흐르고 → 살아 있는 감시 루프를 돈다(실제 setInterval 500ms 와 같은 박자). 한 바퀴는 우리가 따로 센다. */
  page.step = () => {
    const before = page.video.currentTime;
    page.video._advance(0.5);
    timers.forEach(fn => fn && fn());
    if(page.video.currentTime < before - 1) page.laps++;
  };
  page.steps = k => { for(let i = 0; i < k; i++) page.step(); };
  page.count = re => msgs.filter(m => re.test(m)).length;
  return page;
}

/* main 쪽 무대 — bgmForcePlay 와 setBgmLoop IPC 를 실물로 싣는다. */
const FORCE = cutFn(MAIN, 'bgmForcePlay');
const IPC_LOOP = cutIpc(MAIN, 'companion:setBgmLoop');
function makeMain(page, { mode = 'playlist', loop = false } = {}){
  const handlers = {};
  const st = {
    bgmMode: mode, bgmVolume: 0.5, bgmPlLoop: loop, console: { log(){}, warn(){} },
    bgmView: page ? { webContents: { isDestroyed: () => false,
      executeJavaScript: code => { page.run(code); return Promise.resolve(); } } } : null,
    ipcMain: { on: (ch, fn) => { handlers[ch] = fn; }, handle(){} },
  };
  vm.createContext(st);
  vm.runInContext(FORCE + '\n' + (IPC_LOOP || ''), st, { filename: 'main.js:bgm' });
  st.handlers = handlers;
  return st;
}

say('\n🔁 한 곡 반복 — <video>.loop\n');
say('── 1. 주입 스크립트 (가짜 유튜브 페이지에서 실제로 돈다)');
if(!FORCE) huh('main.js 에서 bgmForcePlay 를 못 오려냈다 — §1 을 건너뛴다');
else {
  /* 1-1. 한 곡 반복 — 끝나도 신호 없이 처음부터. 길이가 0.5초 박자에 맞는 곡/안 맞는 곡 둘 다
     (안 맞으면 끝 0.4초 안전장치가 먼저 되감고, 맞으면 브라우저 loop 가 되감는다 — 두 길이 다르다). */
  for(const dur of [20, 20.3]){
    const P = makePage(dur); const M = makeMain(P, { loop: true });
    M.bgmForcePlay();
    P.steps(Math.ceil(dur * 2) * 3 + 4);   // 세 바퀴 남짓
    chk(P.video.loop === true, `한 곡 반복이면 PL 모드에서도 <video>.loop 가 켜진다 (${dur}초 곡)`);
    chk(P.count(/^TWPL:ended$/) === 0, `끝나도 TWPL:ended 를 안 보낸다 — 같은 주소를 다시 열 일이 없다 (${dur}초 곡)`);
    chk(P.laps >= 3 && !P.video.paused, `멈추지 않고 처음부터 계속 돈다 — ${P.laps}바퀴 (${dur}초 곡)`);
    chk(P.count(/^TWPL:loop$/) === P.laps, `한 바퀴마다 TWPL:loop 를 딱 한 번 보낸다 — ${P.count(/^TWPL:loop$/)}번/${P.laps}바퀴 (${dur}초 곡)`);
  }

  /* 1-2. 반복이 아니면 옛 동작 그대로 — 곡 끝에서 ended 한 번 */
  {
    const P = makePage(20.3); const M = makeMain(P, { loop: false });
    M.bgmForcePlay(); P.steps(60);
    chk(P.video.loop === false && P.count(/^TWPL:ended$/) === 1 && P.count(/^TWPL:loop$/) === 0,
        '한 곡 반복이 아니면 loop 를 끄고, 곡 끝에서 TWPL:ended 를 딱 한 번 보낸다 (옛 동작 그대로)');
    chk(P.video.paused, '그때 끝난 영상을 되살리지 않는다 (되살리면 ended 안전장치가 영영 못 걸린다)');
  }

  if(!IPC_LOOP) huh('main.js 에서 companion:setBgmLoop 핸들러를 못 오려냈다 — 1-3·1-4 를 건너뛴다');
  else {
    /* 1-3. 재생 중에 켠다 — 곡 중간에 우클릭으로 «한 곡 반복»으로 바꾼 경우 */
    {
      const P = makePage(20.3); const M = makeMain(P, { loop: false });
      M.bgmForcePlay(); P.steps(20);                 // 10초 재생
      M.handlers['companion:setBgmLoop']({}, true); P.step();
      chk(P.video.loop === true, '재생 중에 켜면 다음 tick 에 loop 가 켜진다 (페이지를 다시 열지 않는다)');
      P.steps(60);
      chk(P.count(/^TWPL:ended$/) === 0 && P.laps >= 1, '그 곡이 끝나도 넘어가지 않고 처음부터 다시 나온다');
    }
    /* 1-4. 재생 중에 끈다 — 한 바퀴 돈 뒤 목록 반복으로 바꾼 경우 */
    {
      const P = makePage(20.3); const M = makeMain(P, { loop: true });
      M.bgmForcePlay(); P.steps(50);                 // 한 바퀴 돌고 조금 더
      const lapped = P.laps >= 1;
      M.handlers['companion:setBgmLoop']({}, false); P.step();
      chk(lapped && P.video.loop === false, '한 바퀴 돈 뒤 재생 중에 끄면 다음 tick 에 loop 가 꺼진다');
      P.steps(60);
      chk(P.count(/^TWPL:ended$/) === 1, '그러면 이번 곡 끝에서 TWPL:ended 를 한 번 보낸다 (루프 중엔 안 보냈으니 막혀 있지 않다)');
    }
  }

  /* 1-5. 이미 감시가 붙은 페이지에 다시 주입 — 값은 갱신되고 감시는 두 벌이 되지 않는다 */
  {
    const P = makePage(20.3); const M = makeMain(P, { loop: false });
    M.bgmForcePlay(); P.steps(4);
    M.bgmPlLoop = true; M.bgmForcePlay(); P.step();
    chk(P.ctx.__twplLoop === true && P.video.loop === true, '다시 주입하면 무장된 페이지여도 반복 여부가 갱신된다');
    chk(P.live() === 1, '다시 주입해도 감시 루프는 한 벌이다');
  }

  /* 1-6. 4시간 넘게 한 곡 반복 — 한 페이지가 무한히 이어진다.
     [함정] 감시 상한 TWPL_MAX(4시간)는 곡마다 페이지가 새로 뜨던 시절의 값이다. 되감지 않으면 4시간 뒤
       감시가 꺼져 하트비트가 끊기고, 렌더러 감시견이 실패로 세서 1곡 목록이면 바로 멈춘다. */
  {
    const cap = /TWPL_MAX\s*=\s*(\d+)/.exec(MAIN);
    const ticks = cap ? Number(cap[1]) + 2000 : 30000;
    const P = makePage(180.3); const M = makeMain(P, { loop: true });
    M.bgmForcePlay(); P.steps(ticks);
    const tail = P.msgs.slice(-40).filter(m => /^TWPL:hb:/.test(m)).length;
    chk(P.live() === 1 && tail > 0,
        `감시 상한(${ticks - 2000} tick)을 넘겨 한 곡 반복해도 감시가 살아 있고 하트비트가 계속 온다`);
  }

  /* 1-7. 광고 — 광고 video 에 loop 가 걸리면 같은 광고가 무한 재생된다(마이홈5-1) */
  {
    const P = makePage(20.3); const M = makeMain(P, { loop: true });
    const main = P.video; const ad = makeVideo(15.2);
    P.ad = true; P.video = ad;
    M.bgmForcePlay(); P.steps(10);
    chk(ad.loop === false, '광고 중에는 한 곡 반복이어도 광고 영상에 loop 를 걸지 않는다');
    P.ad = false; P.video = main; P.steps(2);
    chk(main.loop === true, '광고가 끝나 본 영상으로 돌아오면 loop 가 걸린다');
  }

  /* 1-8. 마이홈 BGM — PL 이 아니면 예전처럼 늘 loop, 신호 없음 */
  {
    const P = makePage(20.3); const M = makeMain(P, { mode: 'home', loop: false });
    M.bgmForcePlay(); P.steps(100);
    chk(P.video.loop === true && P.count(/^TWPL:(ended|loop)$/) === 0 && P.laps >= 2,
        '마이홈 BGM 은 반복 설정과 무관하게 예전처럼 loop 로 돌고 신호를 안 보낸다');
  }
}

say('\n── 2. preload ↔ main 채널');
{
  let api = null; const sent = [];
  const fakeElectron = { contextBridge: { exposeInMainWorld: (n, a) => { api = a; } },
                         ipcRenderer: { send: (...a) => sent.push(a), invoke(){}, on(){} } };
  try{
    vm.runInNewContext(PRELOAD, { require: m => (m === 'electron' ? fakeElectron : {}) }, { filename: 'preload.js' });
  }catch(e){ huh('preload.js 를 싣지 못했다: ' + e.message); }
  if(api){
    chk(typeof api.setBgmLoop === 'function', 'preload 가 setBgmLoop 를 노출한다');
    if(typeof api.setBgmLoop === 'function'){
      api.setBgmLoop('yes');
      const [ch, val] = sent[sent.length - 1] || [];
      chk(val === true, 'setBgmLoop 는 값을 boolean 으로 보낸다');
      if(!IPC_LOOP) huh('main 쪽 핸들러가 없어 채널 짝을 검사 못함');
      else {
        const P = makePage(20.3); const M = makeMain(P);
        chk(typeof M.handlers[ch] === 'function', 'preload 가 보내는 채널(' + ch + ')을 main 이 실제로 받는다');
        const noWin = makeMain(null);
        let threw = false; try{ noWin.handlers[ch]({}, true); }catch(_){ threw = true; }
        chk(!threw && noWin.bgmPlLoop === true, '창이 아직 없어도 죽지 않고 값을 기억한다 (다음 주입이 심는다)');
      }
    }
  }
}

say('\n── 3. 렌더러 (app.js)');
const R_NAMES = ['_plWantLoop', '_plSyncLoop', '_plOpenTrack', '_plNext', '_plSkipNext', '_plAdoptCurSet',
                 '_plPlayNow', '_plShufPick', '_plStop', '_plNowItems', '_plNowHere',
                 '_plWatchReset', '_plWatchStop', '_plWatchBeat', '_plWatchTick'];
const rCuts = R_NAMES.map(n => cutFn(APP, n));
const rMissing = R_NAMES.filter((n, i) => !rCuts[i]);
const HANDLER = cutArrowAfter(APP, 'companion.onBgmTrackEnd(', '__onTrackEnd');
const CLICK = cutArrowAfter(APP, "bind('myPlLoop',", '__loopClick');
const CTX = cutArrowAfter(APP, "_loopBtn.addEventListener('contextmenu',", '__kindCtx');
const KIND = (() => { const m = /const\s+PL_KIND_LOOP\s*=\s*(\d+)\s*,\s*PL_KIND_ONE\s*=\s*(\d+)\s*,\s*PL_KIND_SHUF\s*=\s*(\d+)/.exec(APP);
  return m ? m.slice(1).map(Number) : null; })();

function watchDecls(){
  const out = { PL_WATCH_SILENT_MS: 30000, PL_WATCH_STUCK_MS: 25000,
                _plWatchAt: 0, _plWatchHbAt: 0, _plWatchPos: -1, _plWatchMoveAt: 0, _plWatchTimer: null };
  const re = /^(?:let|const)\s+(_plWatch\w+|PL_WATCH_\w+)\s*=\s*([^;\n]+);/gm;
  let m; while((m = re.exec(APP))){ try{ out[m[1]] = vm.runInNewContext(m[2]); }catch(_){} }
  return out;
}
/* opts.oldApp=true 면 preload 에 setBgmLoop 가 없는 구버전 앱 */
function makeRenderer({ on = true, kind = 1, len = 5, oldApp = false } = {}){
  const calls = [];
  const items = Array.from({ length: len }, (_, i) => ({ id: 'v' + i }));
  const st = Object.assign(watchDecls(), {
    Date: { now: () => 1e6 }, Math, String, parseInt, isFinite,
    console: { log(){}, warn(){} }, setInterval: () => 1, clearInterval(){},
    PL_KIND_LOOP: KIND[0], PL_KIND_ONE: KIND[1], PL_KIND_SHUF: KIND[2], PL_KIND_LABEL: ['목록 반복', '한 곡 반복', '셔플'],
    _plSets: [{ items }, { items: [] }, { items: [] }], _plCur: 0, _plNowSet: 0, _plView: null, _plNowView: null,
    _plNow: -1, _plSel: -1, _plPlaying: false, _plErrStreak: 0, _plShufBag: [], _plOn: on, _plKind: KIND[kind],
    _plRender(){}, _plSave(){}, _plNowTitle: () => '', _plApplyVolSoon(){}, _plVolReCancel(){}, _plSetLabel: i => 'P' + i,
    toast(){},
  });
  st.window = st;
  st.companion = { openPlaylistTrack: url => calls.push(['open', url]), closeBgm(){}, pauseBgm(){}, resumeBgm(){} };
  if(!oldApp) st.companion.setBgmLoop = v => calls.push(['loop', v]);
  vm.createContext(st);
  vm.runInContext(rCuts.join('\n') + '\n' + [HANDLER, CLICK, CTX].filter(Boolean).join('\n'), st, { filename: 'app.js:pl' });
  st.calls = calls;
  return st;
}
if(rMissing.length || !KIND) huh('app.js 에서 못 찾았다: ' + rMissing.concat(KIND ? [] : ['PL_KIND_*']).join(', ') + ' — §3 을 건너뛴다');
else {
  /* 3-1. 곡을 여는 문 — 열기 **전에** 알린다 (main 이 새 페이지에 주입할 때 그 값을 심으므로) */
  for(const [label, on, kind, want] of [['한 곡 반복', true, 1, true], ['목록 반복', true, 0, false],
                                          ['셔플', true, 2, false], ['반복 끔(종류는 한 곡)', false, 1, false]]){
    const R = makeRenderer({ on, kind });
    R._plPlayNow(2);
    const li = R.calls.findIndex(c => c[0] === 'loop'), oi = R.calls.findIndex(c => c[0] === 'open');
    chk(li >= 0 && oi > li && R.calls[li][1] === want,
        `곡을 열기 직전에 반복 여부를 알린다 — ${label} → ${want}`);
  }

  /* 3-2. 재생 중에 바꾸는 두 버튼 */
  if(!CLICK || !CTX) huh('반복 버튼 핸들러(좌클릭/우클릭)를 못 오려냈다 — 3-2 를 건너뛴다');
  else {
    const R = makeRenderer({ on: false, kind: 1 }); R._plPlayNow(0); R.calls.length = 0;
    R.__loopClick();
    chk(R.calls.some(c => c[0] === 'loop' && c[1] === true), '좌클릭으로 반복을 켜면(종류: 한 곡) 곧바로 loop 켜기를 알린다');
    R.__loopClick();
    chk(R.calls.filter(c => c[0] === 'loop').pop()[1] === false, '다시 끄면 loop 끄기를 알린다');
    const E = { preventDefault(){}, stopPropagation(){} };
    const K = makeRenderer({ on: true, kind: 0 }); K._plPlayNow(0); K.calls.length = 0;
    K.__kindCtx(E);   // 목록 → 한 곡
    const a = K.calls.filter(c => c[0] === 'loop').pop();
    K.__kindCtx(E);   // 한 곡 → 셔플
    const b = K.calls.filter(c => c[0] === 'loop').pop();
    chk(a && a[1] === true && b && b[1] === false, '우클릭으로 종류를 바꾸면 한 곡 반복에 들어갈 때 켜고 나올 때 끈다');
    chk(!K.calls.some(c => c[0] === 'open'), '반복 설정을 바꾸는 것만으로는 곡을 다시 열지 않는다');
  }

  /* 3-3. TWPL:loop — 연속 실패만 끊고 곡을 넘기지 않는다 */
  if(!HANDLER) huh('onBgmTrackEnd 핸들러를 못 오려냈다 — 3-3 을 건너뛴다');
  else {
    const R = makeRenderer({ on: true, kind: 1 }); R._plPlayNow(1);
    R._plErrStreak = 3; const opens = R.calls.filter(c => c[0] === 'open').length;
    R.__onTrackEnd('loop');
    chk(R._plErrStreak === 0, 'TWPL:loop 를 받으면 연속 실패를 0 으로 끊는다 (곡이 제대로 나왔다는 증거)');
    chk(R.calls.filter(c => c[0] === 'open').length === opens && R._plNow === 1,
        'TWPL:loop 로는 곡을 넘기지도, 같은 곡을 다시 열지도 않는다');
  }

  /* 3-4. 구버전 앱 — preload 에 setBgmLoop 가 없다. 옛 길이 그대로 살아 있어야 한다 */
  {
    const R = makeRenderer({ on: true, kind: 1, oldApp: true });
    let threw = false;
    try{ R._plPlayNow(3); R._plNext(); R._plNext(); }catch(_){ threw = true; }
    const opened = R.calls.filter(c => c[0] === 'open').map(c => c[1]);
    chk(!threw && opened.length === 3 && new Set(opened).size === 1,
        '구버전 앱(setBgmLoop 없음)에서도 죽지 않고, 한 곡 반복은 옛 방식(같은 주소 다시 열기)으로 돈다');
  }
}

say('');
say(fail || unknown
  ? `✗ 문제 ${fail}건${unknown ? ` · 검사 못함 ${unknown}건` : ''}`
  : `✓ 전부 통과 (${pass}항목)`);
process.exit(fail ? 1 : (unknown ? 2 : 0));
