/* ═══ 🩺 sim-heartbeat-policy.js — 창이 안 보일 때 하트비트의 무거운 칸을 빼는 규칙(heartbeat-policy.js) ═══════════════
   하트비트(launcher/heartbeat.js setInterval 100ms → companion.setCharBounds)는 늘 우리 창 사각형(__uiRegions — 선택자 수십 개 · 노드 수백 개에
   getComputedStyle)과 남의 좌석 원(otherSeatCircles)을 잰다. 창을 내려도(backgroundThrottling:false) 그대로 돌았다.
   ・1절: 모듈 모양 · 상수 · 판단 표(경계값 — 모름 · 0 · 999 · 1000 · NaN · 음수)
   ・2절: 하트비트(heartbeat.js — app.js 에서 옮김)를 실제로 돌린다 — 가짜 companion · 타이머 · 시계로 «보임 → 숨김 → 복귀» 를 지나며 보낸 것을 본다
   ・3절: main.js 창 보임 알림을 실제로 돌린다 — 가짜 창이 minimize · restore · hide · show 를 낼 때 보낸 값
   ・4절: 연결 — preload · html(app.js 보다 먼저) · smoke PRELOAD
   ・5절: 깨 보기 — 규칙 · 하트비트 · main 을 일부러 틀리게 고쳐 빨강이 나는지
   [실행] 스테이징(node checks/run.js) 또는 저장소 루트에서. */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const d of [process.cwd(), __dirname, path.join(__dirname, '..')]){ try{ return fs.readFileSync(path.join(d, f), 'utf8'); }catch(_){} } return null; };
const firstOf = (...fs_) => { for(const f of fs_){ const t = read(f); if(t != null) return [f, t]; } return [null, null]; };

const [, POLSRC] = firstOf('heartbeat-policy.js', 'parts/launcher/heartbeat-policy.js', 'app/parts/launcher/heartbeat-policy.js');
const [, APP] = firstOf('heartbeat.js', 'parts/launcher/heartbeat.js', 'app/parts/launcher/heartbeat.js');   // 하트비트 덩이는 app.js 에서 이 모듈로 옮겼다
const [, MAIN] = firstOf('main.js');
const [, PRELOAD] = firstOf('preload.js');
const [, HTML] = firstOf('desk-companion-prototype.html', 'app/desk-companion-prototype.html');
const [, SMOKE] = firstOf('smoke.js', 'checks/smoke.js');
if(!POLSRC || !APP || !MAIN || !PRELOAD || !HTML){ say('  ? 원본 못 찾음 — heartbeat-policy.js · heartbeat.js · main.js · preload.js · html'); process.exit(2); }

function load(src){
  const m = { exports: {} }, w = {};
  new Function('module', 'exports', 'window', src)(m, m.exports, w);
  return { mod: m.exports, win: w.TwHeartbeatPolicy };
}

/* ── 판단 표 — 정책 하나를 받아 통과 여부 목록 ── */
function policyTable(P){
  const rows = [
    [{ shown: true, sinceFull: 0 }, true, '보임 — 바로 직전에 쟀어도 잰다'],
    [{ shown: null, sinceFull: 0 }, true, '모름(아직 신호 없음) — 잰다'],
    [{ sinceFull: 0 }, true, 'shown 없음 — 잰다'],
    [undefined, true, '입력 없음 — 잰다'],
    [{ shown: false, sinceFull: 0 }, false, '숨김 · 방금 쟀다 — 뺀다'],
    [{ shown: false, sinceFull: 999 }, false, '숨김 · 999ms — 뺀다'],
    [{ shown: false, sinceFull: 1000 }, true, '숨김 · 1000ms(경계) — 한 번 잰다'],
    [{ shown: false, sinceFull: 5000 }, true, '숨김 · 오래됨 — 잰다'],
    [{ shown: false, sinceFull: NaN }, true, '숨김 · 시각 모름(NaN) — 잰다'],
    [{ shown: false, sinceFull: -5 }, true, '숨김 · 시계가 뒤로 감(음수) — 잰다'],
    [{ shown: false, sinceFull: Infinity }, true, '숨김 · 한 번도 안 잼(Infinity) — 잰다'],
  ];
  return rows.map(([f, want, msg]) => ({ ok: P.fullStep(f) === want, msg }));
}

/* ── 하트비트 모듈(heartbeat.js)을 가짜 환경에서 만든다 — 만들 때 구독 · 타이머를 건다 ── */
function runHeartbeat(src, P){
  if(!/function createHeartbeat\(deps\)\{/.test(src)) return null;
  let now = 1000000, tick = null, shownCb = null;
  const sent = [];
  let regionCalls = 0, otherCalls = 0;
  const companion = {
    setCharBounds: (b) => sent.push(b),
    onWinShown: (cb) => { shownCb = cb; },
  };
  const window = { companion, __uiRegions: () => { regionCalls++; return [{ x: 1, y: 2, w: 3, h: 4 }]; } };
  const FakeDate = { now: () => now };
  const deps = {
    _charBadWhy: () => null, _charBoundsLatest: () => ({ x: 10, y: 20, r: 120 }), _twMoveSeenAt: () => 0,
    otherSeatCircles: () => { otherCalls++; return [{ x: 5, y: 6, r: 110 }]; },
    runCost: { timed: (k, fn) => fn },   // 1분 [비용] 재기는 그대로 넘긴다(run-cost-diag.js — 검사는 sim-run-cost-diag)
  };
  const api = new Function('window', 'companion', 'TwHeartbeatPolicy', 'setInterval', 'Date', 'module', src + '\nreturn window.TwHeartbeat;')(
    window, companion, P, (fn, ms) => { tick = { fn, ms }; return 1; }, FakeDate, undefined);
  try{ api.createHeartbeat(deps); }catch(_){ return null; }
  if(!tick) return null;
  const step = (n) => { const out = []; for(let i = 0; i < n; i++){ now += tick.ms; const k = sent.length; tick.fn(); out.push(sent[k]); } return out; };
  return { tick, step, shown: (v) => shownCb && shownCb(v), hasShownCb: () => !!shownCb, counts: () => ({ regionCalls, otherCalls }) };
}
function heartbeatBehaviour(src, P){
  const H = runHeartbeat(src, P);
  if(!H) return null;
  const r = {};
  r.interval = H.tick.ms;
  r.subscribed = H.hasShownCb();
  const first = H.step(3);                                // 신호 전(모름)
  r.unknownFull = first.every(b => b && Array.isArray(b.regions) && Array.isArray(b.others));
  H.shown(true);
  const vis = H.step(5);
  r.visibleFull = vis.every(b => b && Array.isArray(b.regions) && Array.isArray(b.others));
  const c0 = H.counts();
  H.shown(false);
  const hid = H.step(30);                                 // 3초 숨김
  const c1 = H.counts();
  r.hiddenAlive = hid.every(b => b && b.x === 10 && b.y === 20 && b.r === 120 && typeof b.moveAge === 'number');
  r.hiddenFullCount = hid.filter(b => Array.isArray(b.regions)).length;
  r.hiddenLight = hid.filter(b => b.regions === undefined && b.others === undefined).length;
  r.hiddenRegionCalls = c1.regionCalls - c0.regionCalls;
  r.hiddenOtherCalls = c1.otherCalls - c0.otherCalls;
  H.shown(true);
  const back = H.step(1)[0];                              // 복귀 → 다음 틱
  r.backFull = !!back && Array.isArray(back.regions) && Array.isArray(back.others);
  return r;
}

/* ── main.js 창 보임 알림 덩이를 떼어 가짜 창에서 돌린다 ── */
/* 창 보임 판단 함수(_mainWinShown — main.js 의 한 벌)와 알림 덩이를 같이 떼어 돌린다 */
function grabWinShown(src){
  const f = src.indexOf('function _mainWinShown(){');
  const fe = src.indexOf('\n}\n', f);
  const a = src.indexOf('let _winShownSent = null;');
  const b = src.indexOf("mainWindow.webContents.on('did-finish-load'", a);
  if(f < 0 || fe < 0 || a < 0 || b < 0) return null;
  const c = src.indexOf('\n', b);
  return src.slice(f, fe + 2) + '\n' + src.slice(a, c);
}
function mainBehaviour(src){
  const block = grabWinShown(src);
  if(!block) return null;
  const handlers = {}, wcHandlers = {}, sent = [];
  const st = { visible: true, minimized: false };
  const mainWindow = {
    isDestroyed: () => false,
    isVisible: () => st.visible,
    isMinimized: () => st.minimized,
    on: (ev, fn) => { (handlers[ev] = handlers[ev] || []).push(fn); },
    webContents: {
      send: (ch, v) => sent.push([ch, v]),
      on: (ev, fn) => { (wcHandlers[ev] = wcHandlers[ev] || []).push(fn); },
    },
  };
  new Function('mainWindow', block)(mainWindow);
  const fire = (ev) => (handlers[ev] || []).forEach(f => f());
  const r = {};
  r.events = Object.keys(handlers).sort().join(',');
  (wcHandlers['did-finish-load'] || []).forEach(f => f());
  r.boot = sent.slice();
  sent.length = 0;
  st.minimized = true; fire('minimize');                  // Windows — 최소화해도 isVisible 은 참
  fire('minimize');                                       // 같은 값은 다시 안 보낸다
  r.min = sent.slice(); sent.length = 0;
  st.minimized = false; fire('restore');
  r.restore = sent.slice(); sent.length = 0;
  st.visible = false; fire('hide');
  r.hide = sent.slice(); sent.length = 0;
  st.visible = true; fire('show');
  r.show = sent.slice(); sent.length = 0;
  st.minimized = true; fire('minimize'); sent.length = 0;
  (wcHandlers['did-finish-load'] || []).forEach(f => f()); // 다시 불러옴 — 같은 값이어도 다시 알린다
  r.reload = sent.slice();
  return r;
}

/* ── main.js setCharBounds 처리기를 떼어 돌린다 — 칸이 빠지면 마지막 값을 그대로 두는가(이 PR 이 안전한 근거) ── */
function grabBoundsHandler(src){
  const a = src.indexOf("ipcMain.on('companion:setCharBounds', (e, bounds) => {");
  const b = src.indexOf('\n  });', a);
  return (a < 0 || b < 0) ? null : src.slice(a, b + '\n  });'.length);
}
function keepBehaviour(src){
  const block = grabBoundsHandler(src);
  if(!block) return null;
  const make = new Function(
    'let _lastCharBounds = null, _lastCharBoundsAt = 0, _charBadSince = 0, _rendererMoveAge = -1, _lastIgnoreWhy = "", _lastHitWhy = "", _hitWhyAt = 0;\n' +
    'let _lastRegions = [], _lastOtherSeats = [];\n' +
    'const OTHER_SEAT_MAX = 24, _zoomIn = (v) => v, _diagLog = () => {};\n' +
    'let h = null; const ipcMain = { on: (ch, fn) => { h = fn; } };\n' + block + '\n' +
    'return { send: (b) => h(null, b), get: () => ({ regions: _lastRegions, others: _lastOtherSeats, at: _lastCharBoundsAt }) };');
  const M = make();
  const r = {};
  M.send({ x: 10, y: 20, r: 120, moveAge: 5, regions: [{ x: 1, y: 2, w: 30, h: 40 }], others: [{ x: 5, y: 6, r: 110 }] });
  const full = JSON.stringify(M.get().regions) + JSON.stringify(M.get().others);
  r.fullSet = M.get().regions.length === 1 && M.get().others.length === 1;
  M.send({ x: 11, y: 21, r: 120, moveAge: 6, regions: undefined, others: undefined });   // 숨김 중 가벼운 하트비트
  r.kept = (JSON.stringify(M.get().regions) + JSON.stringify(M.get().others)) === full;
  r.alive = M.get().at > 0;
  return r;
}

/* ═══ 1. 모듈 모양 · 상수 · 판단 표 ═══ */
say('── 1. 모듈 모양 · 상수 · 판단 표');
const L = load(POLSRC), P = L.mod;
chk(P && L.win === P, 'module.exports 와 window.TwHeartbeatPolicy 가 같은 것');
chk(typeof P.fullStep === 'function', 'fullStep 함수');
chk(P.HIDDEN_FULL_EVERY_MS === 1000, '숨김 중에도 1000ms 마다 한 번은 다 잰다(값 고정 — 바꾸면 여기가 빨강)');
const table = policyTable(P);
table.forEach(t => chk(t.ok, '  ' + t.msg));

/* ═══ 2. 하트비트(heartbeat.js) ═══ */
say('\n── 2. 하트비트(heartbeat.js)를 돌려 본다(보임 → 숨김 3초 → 복귀)');
const hb = heartbeatBehaviour(APP, P);
chk(!!hb, '하트비트 덩이를 떼어 돌렸다');
if(hb){
  chk(hb.interval === 100, '주기는 100ms 그대로(main 생존 신호)');
  chk(hb.subscribed, 'companion.onWinShown 을 구독한다');
  chk(hb.unknownFull, '신호 전(모름)에는 regions · others 를 싣는다(예전과 같음)');
  chk(hb.visibleFull, '보일 때는 매 틱 싣는다(예전과 같음)');
  chk(hb.hiddenAlive, '숨김 중에도 매 틱 보낸다 — 캐릭터 좌표 · moveAge 그대로');
  chk(hb.hiddenFullCount === 3 && hb.hiddenLight === 27, '숨김 3초(30틱) 중 다 잰 것은 1초에 한 번(3번) · 나머지 27번은 무거운 칸 없음 — 받은 값: ' + hb.hiddenFullCount + ' · ' + hb.hiddenLight);
  chk(hb.hiddenRegionCalls === 3 && hb.hiddenOtherCalls === 3, '  __uiRegions · otherSeatCircles 를 실제로 부른 횟수도 3번 — 받은 값: ' + hb.hiddenRegionCalls + ' · ' + hb.hiddenOtherCalls);
  chk(hb.backFull, '복귀 신호 뒤 다음 틱에 곧바로 다 잰다');
}

/* ═══ 3. main.js 창 보임 알림 ═══ */
say('\n── 3. main.js 창 보임 알림을 돌려 본다');
const mb = mainBehaviour(MAIN);
chk(!!mb, '알림 덩이를 떼어 돌렸다');
if(mb){
  chk(['focus', 'hide', 'minimize', 'restore', 'show'].every(e => mb.events.split(',').includes(e)), 'minimize · restore · hide · show · focus 에 건다 — 받은 값: ' + mb.events);
  chk(JSON.stringify(mb.boot) === JSON.stringify([['companion:winShown', true]]), '불러오기 끝나면 지금 상태(보임)를 알린다');
  chk(JSON.stringify(mb.min) === JSON.stringify([['companion:winShown', false]]), '최소화 → false 한 번(isVisible 이 참이어도 · 같은 값은 다시 안 보냄)');
  chk(JSON.stringify(mb.restore) === JSON.stringify([['companion:winShown', true]]), '복귀 → true');
  chk(JSON.stringify(mb.hide) === JSON.stringify([['companion:winShown', false]]) && JSON.stringify(mb.show) === JSON.stringify([['companion:winShown', true]]), '숨김 → false · 보임 → true');
  chk(/const shown = _mainWinShown\(\);/.test(MAIN), '알림은 main.js 의 창 보임 판단 한 벌(_mainWinShown)을 부른다');
  chk(JSON.stringify(mb.reload) === JSON.stringify([['companion:winShown', false]]), '다시 불러오면 같은 값이어도 다시 알린다(렌더러는 모름으로 돌아가 있다)');
}

/* ═══ 3-2. main 이 빠진 칸을 덮지 않는다 ═══ */
say('\n── 3-2. main setCharBounds 처리기 — 칸을 뺀 하트비트가 마지막 값을 지우지 않는가');
const kb = keepBehaviour(MAIN);
chk(!!kb, '처리기를 떼어 돌렸다');
if(kb){
  chk(kb.fullSet, 'regions · others 를 실은 값은 받는다');
  chk(kb.kept, '뺀 값(undefined)이 오면 _lastRegions · _lastOtherSeats 를 그대로 둔다');
  chk(kb.alive, '뺀 값도 생존 신호(_lastCharBoundsAt)는 찍는다');
}

/* ═══ 4. 연결 ═══ */
say('\n── 4. 연결');
chk(/onWinShown\(callback\)\s*\{\s*ipcRenderer\.on\('companion:winShown', \(e, shown\) => callback\(shown\)\);/.test(PRELOAD), 'preload — onWinShown 이 companion:winShown 을 받는다');
const iPol = HTML.indexOf('parts/launcher/heartbeat-policy.js'), iApp = HTML.indexOf('src="parts/app.js"');
chk(iPol > 0 && iApp > 0 && iPol < iApp, 'html — heartbeat-policy.js 를 app.js 보다 먼저 싣는다');
chk(!SMOKE || /PRELOAD\.push\('heartbeat-policy\.js'\)/.test(SMOKE), 'smoke PRELOAD 에 들어 있다');

/* ═══ 5. 깨 보기 ═══ */
say('\n── 5. 깨 보기');
const broken1 = load(POLSRC.replace("if(!f || f.shown !== false) return true;", 'if(!f || f.shown === true) return true;')).mod;
chk(policyTable(broken1).some(t => !t.ok), '«모름» 을 숨김으로 읽게 고치면 1절 표가 빨강');
const broken2 = load(POLSRC.replace('return since >= HIDDEN_FULL_EVERY_MS;', 'return since > HIDDEN_FULL_EVERY_MS;')).mod;
chk(policyTable(broken2).some(t => !t.ok), '경계(1000ms)를 하나 밀면 1절 표가 빨강');
const hbBroken = heartbeatBehaviour(APP.replace('(_hbFull && window.__uiRegions) ? window.__uiRegions() : undefined', 'window.__uiRegions ? window.__uiRegions() : undefined'), P);
chk(!!hbBroken && hbBroken.hiddenRegionCalls === 30, '하트비트가 판단을 무시하고 늘 재면 2절 «3번» 이 빨강(30번)');
const hbNoBack = heartbeatBehaviour(APP.replace('companion.onWinShown(v => { _hbWinShown = !!v; });', 'companion.onWinShown(v => { if(!v) _hbWinShown = false; });'), P);
chk(!!hbNoBack && !hbNoBack.backFull, '복귀 신호를 안 받게 고치면 2절 «다음 틱에 곧바로» 가 빨강');
const mbBroken = mainBehaviour(MAIN.replace('try{ return mainWindow.isVisible() && !mainWindow.isMinimized(); }', 'try{ return mainWindow.isVisible(); }'));
chk(!!mbBroken && JSON.stringify(mbBroken.min) !== JSON.stringify([['companion:winShown', false]]), '_mainWinShown 이 isVisible 만 보면(Windows 최소화도 참) 3절 «최소화 → false» 가 빨강');
const mbOwn = mainBehaviour(MAIN.replace('const shown = _mainWinShown();', 'const shown = mainWindow.isVisible();'));
chk(!!mbOwn && JSON.stringify(mbOwn.min) !== JSON.stringify([['companion:winShown', false]]), '알림이 _mainWinShown 대신 제 판단을 쓰면 3절이 빨강');

const kbBroken1 = keepBehaviour(MAIN.replace('_lastRegions = bounds.regions.map(', '_lastRegions = (bounds.regions || []).map(').replace('if(Array.isArray(bounds.regions))', 'if(true)'));
chk(!!kbBroken1 && !kbBroken1.kept, 'main 이 빠진 regions 를 `|| []` 로 비우게 고치면 3-2절이 빨강');
const kbBroken2 = keepBehaviour(MAIN.replace('if(Array.isArray(bounds.others))', 'if(true)').replace('_lastOtherSeats = bounds.others.slice(', '_lastOtherSeats = (bounds.others || []).slice('));
chk(!!kbBroken2 && !kbBroken2.kept, 'main 이 빠진 others 를 `|| []` 로 비우게 고치면 3-2절이 빨강');

say(`\n결과: 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
