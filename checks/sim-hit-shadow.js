/* ═══ 🗺️ sim-hit-shadow.js — 히트 맵 그림자 운행(launcher/hit-shadow.js · desktop-run.js 배선) ═══════════════
   0.12.4 는 통과 판정의 답을 옛 판정이 정하고, 새 판정(seat-hit-targets.js pick)을 옆에서 돌려 세기만 한다.
   ・1절: 셈 · 줄 — 같음 · 지도만통과 · 지도만받기 · 낡음 · 건너뜀 · 오류 · 구간 · 지도 장 수 · 다를 때 줄은 종류마다 1분에 하나 ·
          판정 없던 분은 줄 없음 · 200자 안(큰 숫자) · 1초 예산 · take 가 비움
   ・2절: desktop-run.js 를 가짜 창에서 진짜로 만들고 mousemove 를 넣어 본다 — 새 판정이 맞음 / 못 맞음 / 던짐 / 건너뜀이어도
          클릭 통과 결과(setIgnoreMouse)는 옛 판정대로 · 받기를 보낸 뒤에 그림자 · 그림자 셈이 옛 답 · 새 답 · 만듦을 받음 · [비용] 통과 시간에 그림자 몫이 안 듦
   ・3절: app.js · html 연결 — 그린 직후 표시 한 줄(markRendered) · 빈 지도 판단은 deps · desktop-run · 1분 진단에 같은 hitShadow · 싣는 차례
   ・4절: 일부러 깨 보기
   [실행] 러너 스테이징(node checks/run.js hit-shadow) 또는 저장소 루트에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('launcher/hit-shadow.js'), DR = read('launcher/desktop-run.js'), POL = read('launcher/click-through-policy.js');
const APP = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!MOD || !DR || !POL || !APP || !HTML){ say('  ? 원본 못 찾음 — hit-shadow.js · desktop-run.js · click-through-policy.js · app.js · html'); process.exit(2); }

const loadWin = (src, name) => { const win = {}; new Function('window', 'module', 'performance', src)(win, undefined, { now: () => 0 }); return win[name]; };

/* ── 1절 */
function judgePure(src){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let H = null; try{ H = loadWin(src, 'TwHitShadow'); }catch(_){}
  t(H && typeof H.createHitShadow === 'function', '불러온다 — window.TwHitShadow');
  if(!H) return r;
  const clk = { t: 0 };
  const s = H.createHitShadow({ now: () => clk.t });
  t(H.lines(s.take()).length === 0, '판정이 없던 분은 줄을 안 쓴다');
  const D = (k) => ({ x: 812, y: 640, seat: 2, kind: 'rig', rect: { l: 700, t: 500, r: 880, b: 760 }, age: 48, ride: true, oldWhy: 'char:other#2', tag: k });
  s.record({ old: true, neu: true, built: true, inRect: true, oldMs: 5, newMs: 4 });
  s.record({ old: false, neu: false, inRect: true, oldMs: 3, newMs: 2 });
  s.record({ old: false, neu: false, inRect: false, oldMs: 0.1, newMs: 0.01 });
  s.record({ old: true, neu: false, inRect: true, oldMs: 5, newMs: 1, detail: D('a') });
  s.record({ old: true, neu: false, inRect: false, oldMs: 5, newMs: 1, detail: Object.assign(D('b'), { x: 900 }) });   // 같은 종류 두 번째 — 줄은 첫 번째만
  s.record({ old: false, neu: true, inRect: true, oldMs: 2, newMs: 1, detail: Object.assign(D('c'), { kind: 'base', oldWhy: 'miss' }) });
  s.record({ old: false, neu: false, built: true, stale: true, inRect: false, oldMs: 0.2, newMs: 6 });   // 지도를 못 만들어 전체 광선
  s.record({ old: false, neu: null, inRect: true, oldMs: 3, newMs: 0.5 });   // 건너뜀 — 지도만 본 시간은 «새» 에 든다
  s.record({ old: true, neu: null, err: true, inRect: false, oldMs: 4, newMs: -1 });
  s.build(0.03, { seats: 3, parts: 96, tris: 41234, full: 1 }); s.build(0.2, { seats: 3, parts: 96, tris: 41234, full: 1 }, true);
  clk.t = 60000;
  const m = s.take();
  t(m.n === 9 && m.same === 4 && m.leak === 2 && m.grab === 1 && m.built === 2 && m.full === 1 && m.skip === 1 && m.err === 1, '셈 — 판정 9 · 같음 4 · 지도만통과 2 · 지도만받기 1 · 만듦 2 · 전체 1 · 건너뜀 1 · 오류 1 — ' + JSON.stringify({ n: m.n, same: m.same, leak: m.leak, grab: m.grab, built: m.built, full: m.full, skip: m.skip, err: m.err }));
  t(m.zone.on.n === 4 && m.zone.near.n === 3 && m.zone.far.n === 2, '  구간은 옛 답 기준 — 위(옛 맞음) 4 · 근처(사각형 안) 3 · 먼 2');
  const L = H.lines(m);
  t(L.length === 3 && L[0].startsWith('[지도] 판정 9 같음 4 지도만통과 2 지도만받기 1 건너뜀 1 전체 1 오류 1 · 먼 2 ') && /좌석 3 조각 96 삼각 41k 모름 1/.test(L[0]) && /지도 만듦 2 판정당 22% 0\.12\/0\.20ms 실패 1/.test(L[0]) && !/낡음/.test(L[0]), '[지도] 줄 — 칸 차례 · 만든 횟수 · 판정당 비율 · 실패 · 크기(낡음 칸 없음)' + ' — ' + L[0]);
  t(/· 새 1\.94\/6\.00ms/.test(L[0]) && /더함 초당 0\.26ms$/.test(L[0]), '  새 판정 평균/최대(지도 만들기 · 건너뛴 판정의 지도 보기 포함) · 더함 초당 = 새 합 ÷ 초(지도를 두 번 세지 않음)');
  t(L[1] === '[지도✗] 지도만통과 (812,640) 좌석#2 몸 사각(700,500,180,260) 나이 48ms 날 0 탐 1 벤 0 비움 0 끌 0 옛=char:other#2' && /^\[지도✗\] 지도만받기 .* 책상 .*옛=miss$/.test(L[2]), '[지도✗] 줄 — 종류마다 1분에 첫 번째 하나 · 설계 3-4 모양' + ' — ' + L[1]);
  const m2 = s.take();
  t(m2.n === 0 && m2.leak === 0 && !m2.detail.leak && m2.last.parts === 96, 'take 가 비운다(마지막 지도 크기는 남김)');
  const big = H.createHitShadow({ now: () => 0 });
  for(let i = 0; i < 3; i++) big.record({ old: i === 0, neu: i === 1 ? true : false, inRect: true, oldMs: 123456.789, newMs: 98765.4321, detail: { x: 1e9, y: -1e9, seat: 99999, kind: 'rig', rect: { l: -Infinity, t: 0, r: Infinity, b: 1e9 }, age: 1e12, oldWhy: 'char:other#99999xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' } });
  const bm = big.take(); bm.n = 123456789; bm.same = 123456789; bm.build = { n: 99999999, sum: 1e9, max: 1e9 }; bm.err = 99999; bm.buildErr = 99999; bm.built = 123456789; bm.full = 99999; bm.last = { seats: 99999, parts: 9999999, tris: 999999999, full: 99999 };
  const BL = H.lines(bm);
  t(BL.length === 3 && BL.every(x => x.length <= H.LINE_MAX), '큰 숫자에도 줄마다 200자 안 — ' + BL.map(x => x.length).join(' · '));
  const b = H.createHitShadow({ now: () => 0 });
  const a1 = b.allow(0); b.record({ old: false, neu: false, oldMs: 1, newMs: H.BUDGET_MS + 1 });
  const a2 = b.allow(500), a3 = b.allow(999.9), a4 = b.allow(1000);
  t(a1 && !a2 && !a3 && a4 && H.BUDGET_MS === 10 && H.BUDGET_WINDOW_MS === 1000, '예산 — 1초 창에서 새 판정이 10ms 를 넘게 쓰면 그 창 끝까지 건너뜀 · 다음 창에 다시');
  return r;
}

/* ── 2절 — desktop-run 을 가짜 창에서 진짜로 */
function runDesktop(drSrc, opt){
  const listeners = {}, sent = [], timers = [], costs = [], log = [];
  const clock = { t: 1000 };
  const performance = { now: () => clock.t };
  const noop = () => {};
  const companion = new Proxy({ setIgnoreMouse: (v) => { sent.push(v); log.push('send:' + v); } }, { get: (o, k) => (k in o ? o[k] : noop) });
  const win = { companion, addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); } };
  const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }), style: {} };
  const document = {
    body: { classList: { contains: (c) => c === 'runmode' || c === 'desktop', add: noop, remove: noop } },
    getElementById: (id) => id === 'scene' ? canvas : null,
    querySelector: () => null, querySelectorAll: () => [], elementFromPoint: () => null, hasFocus: () => false,
  };
  const policy = (() => { const w = {}; new Function('window', 'module', POL)(w, undefined); return w.TwClickThroughPolicy; })();
  const st = { old: [], pickArgs: [], records: [] };
  const ray = { setFromCamera: noop, intersectObjects: () => opt.oldHit ? [{ object: { parent: null } }] : [], layers: {} };
  const seatHit = {
    pick: (r, x, y, allow) => { st.pickArgs.push({ r, x, y, allow }); log.push('pick'); clock.t += opt.pickMs || 0; if(opt.pickThrows) throw new Error('깨 봄'); return opt.pick || { hit: false, inRect: false, stale: false, skipped: false, built: false }; },
    describe: (obj, x, y, extra) => Object.assign({ obj, x, y }, extra || {}),
  };
  const hitShadow = { allow: () => opt.allow !== false, record: (rec) => st.records.push(rec) };
  const deps = {
    _applyActiveAppState: noop, _charBoundsLatest: () => null, _officeHidden: () => false, _penAppFocused: () => false,
    _skipFlyingRigs: (h) => h, _skipHiddenDesk: (h) => h, _twMoveSeenAt: () => 0,
    activity: noop, anyInput: noop, backToLauncher: noop, camera: {}, clickPolicy: policy, desktopMode: true,
    drag: () => false, focusGateSleep: () => false, hitShadow, lastActivity: () => 0, lastAnyInput: () => 0, moveMode: () => false,
    ray, renderer: { setClearColor: noop }, runCost: { add: (k, d) => costs.push([k, d]) }, seatHit, seats: [{ group: {}, isMe: true }],
    setTwMoveSeenAt: noop, setLastActivity: noop, setLastAnyInput: noop,
  };
  const THREE = { Vector2: function(){ this.x = 0; this.y = 0; } };
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'performance', 'console', 'TwSafeHtml', 'module',
    drSrc + '\nreturn window.TwDesktopRun;')(win, document, { getItem: () => null, setItem: noop }, {}, companion, (fn) => { timers.push(fn); return timers.length; }, () => 0, noop, noop, () => 0, THREE, performance, { log: noop, warn: noop }, {}, undefined);
  api.createDesktopRun(deps);
  const move = (x, y) => { clock.t += 50; (listeners.mousemove || []).forEach(fn => fn({ clientX: x, clientY: y })); timers.splice(0).forEach(fn => fn()); };
  move(400, 300);
  return { sent, st, costs, listeners, log };
}

function judgeWiring(drSrc, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const cases = [
    ['옛 맞음 · 새 맞음', { oldHit: true, pick: { hit: true, inRect: true, built: true, stale: false } }, false],
    ['옛 맞음 · 새 못 맞음(샘)', { oldHit: true, pick: { hit: false, inRect: true } }, false],
    ['옛 못 맞음 · 새 맞음', { oldHit: false, pick: { hit: true, inRect: true, obj: { n: 1 } } }, true],
    ['새 판정이 던짐', { oldHit: true, pickThrows: true }, false],
    ['예산 넘음(건너뜀)', { oldHit: false, allow: false, pick: { hit: false, inRect: true, skipped: true } }, true],
  ];
  let all = true, msgs = [];
  const runs = {};
  for(const [name, opt, wantIgnore] of cases){
    let x = null; try{ x = runDesktop(drSrc, opt); }catch(e){ msgs.push(name + ' 던짐 ' + String(e.message || e).slice(0, 60)); all = false; continue; }
    runs[name] = x;
    const last = x.sent[x.sent.length - 1];
    if(last !== wantIgnore){ all = false; msgs.push(name + ' → ' + JSON.stringify(x.sent)); }
  }
  t(all, '클릭 통과 결과는 옛 판정대로 — 새 판정이 맞음 · 못 맞음 · 던짐 · 건너뜀이어도' + (msgs.length ? ' — ' + msgs.join(' / ').slice(0, 160) : ''));
  const a = runs['옛 맞음 · 새 못 맞음(샘)'], b = runs['옛 못 맞음 · 새 맞음'], c = runs['새 판정이 던짐'], d = runs['예산 넘음(건너뜀)'], e = runs['옛 맞음 · 새 맞음'];
  const ra = a && a.st.records[0], rb = b && b.st.records[0];
  t(a && a.st.records.length === 1 && ra.old === true && ra.neu === false && ra.detail && ra.detail.x === 400 && ra.detail.drag === false && !('oldWhy' in ra.detail),
    '그림자 셈 — 판정마다 한 번 · 옛 답 · 새 답 · 다르면 옛 히트 조각으로 다를 때 재료');
  t(b && rb.old === false && rb.neu === true && rb.detail && rb.detail.oldWhy === 'miss' && rb.detail.obj && rb.detail.obj.n === 1, '  지도만받기는 새 히트 조각으로 · 옛 이유 miss');
  t(e && e.st.pickArgs[0] && e.st.pickArgs[0].x === 400 && e.st.pickArgs[0].y === 300 && e.st.pickArgs[0].allow === true && e.st.records[0].detail === null, '  같으면 재료를 안 만든다 · 같은 광선 · 같은 좌표로 묻는다');
  t(c && c.st.records.length === 1 && c.st.records[0].err === true && c.st.records[0].neu === null, '  새 판정이 던지면 오류로 센다(판정은 그대로)');
  t(d && d.st.pickArgs[0].allow === false && d.st.records[0].neu === null && d.st.records[0].newMs >= 0, '  예산을 넘으면 광선 없이 건너뜀(hitShadow.allow 를 pick 에 넘김 · 지도 본 시간은 잰다)');
  t(e && e.st.records[0].built === true && e.st.records[0].stale === false, '  지도를 이번에 만들었는지 · 못 만들었는지를 셈에 넘긴다');
  const order = ['옛 맞음 · 새 맞음', '옛 맞음 · 새 못 맞음(샘)', '새 판정이 던짐'].map(n => runs[n] && runs[n].log.join(','));
  t(order.every(x => x && x.indexOf('send:false') >= 0 && x.indexOf('send:false') < x.indexOf('pick')), '받기는 그림자보다 먼저 main 에 보낸다(지연 없이 즉시) — ' + (order[0] || '-'));
  let cost = null;
  try{ cost = runDesktop(drSrc, { oldHit: true, pick: { hit: true, inRect: true }, pickMs: 5 }); }catch(_){}
  const hit = cost && cost.costs.filter(([k]) => k === 'hit');
  t(hit && hit.length === 1 && hit[0][1] >= 0 && hit[0][1] < 5, '[비용] 통과 시간에 그림자 몫(5ms)이 안 든다 — 판정 밖(보낸 뒤)에서 돈다' + (hit && hit[0] ? ' — ' + hit[0][1] : ''));
  /* 3절 — app.js · html */
  const iMake = app.indexOf('const seatHitMod = TwSeatHitTargets.createSeatHitTargets({'), iShadow = app.indexOf('const hitShadow = TwHitShadow.createHitShadow();');
  const iDiag = app.indexOf('const runDiagMinuteMod = TwRunDiagMinute.createRunDiagMinute({'), iDR = app.indexOf('const desktopRunMod = TwDesktopRun.createDesktopRun({');
  const iRay = app.indexOf('const ray=new THREE.Raycaster()'), iHid = app.indexOf('const hiddenSeatsMod = '), iOv = app.indexOf('const overheadMod = ');
  t(iShadow > 0 && iMake > iShadow && iDiag > iMake && iDR > iMake && iRay > 0 && iRay < iMake && iHid < iMake && iOv < iMake, '만드는 줄 — hitShadow → seatHitMod 가 1분 진단 · desktop-run 보다 먼저 · ray · 숨김 · 머리 위 모듈 뒤(TDZ 없음)');
  const blk = (k) => { const i = app.indexOf(k); return i < 0 ? '' : app.slice(i, app.indexOf('\n});', i)); };
  t(/\n  officeHidden: \(\)=>_officeHidden,\n  configHidden: \(\)=>_configHidesScene\(\),\n  isRunmode: \(\)=>document\.body\.classList\.contains\('runmode'\),/.test(blk('const seatHitMod')) && /\n  hitShadow: hitShadow,/.test(blk('const runDiagMinuteMod')) && /\n  hitShadow: hitShadow,/.test(blk('const desktopRunMod')) && /\n  seatHit: seatHitMod,/.test(blk('const desktopRunMod')) && /\n  noteBuild: \(\.\.\.a\)=>hitShadow\.build\(\.\.\.a\),/.test(blk('const seatHitMod')),
    '  빈 지도 판단은 deps(회사원 숨김 · 설정 화면 · 실행 화면) · 같은 hitShadow 가 지도 만들기 · desktop-run · 1분 진단에 · desktop-run 은 seatHitMod 를');
  const fr = app.slice(app.indexOf('function frame(now, manual){'), app.indexOf('\n}\n', app.indexOf('function frame(now, manual){')));
  const iR = fr.indexOf('renderer.render(scene,camera)'), iB = fr.indexOf('  seatHitMod.markRendered();');
  const drawIf = fr.indexOf("if(!_officeHidden && !_configHidesScene()){ _gpuTimer.begin(); renderer.render(scene,camera);");
  t(iR > 0 && iB > iR && fr.indexOf('seatHitMod.') === iB + 2 && fr.lastIndexOf('seatHitMod.') === iB + 2 && fr.slice(iR, iB).indexOf('updateMatrixWorld') < 0 && drawIf >= 0 && !/seatHitMod\.rebuild|skipWhy/.test(fr),
    'frame() — 그린 직후 표시 한 줄(markRendered)뿐 · 지도를 만들거나 판단하지 않음 · 그리기 조건은 _configHidesScene 한 곳');
  const pos = (f) => html.indexOf('<script src="parts/' + f + '"></script>');
  const iApp = pos('app.js');
  t(['launcher/hit-map.js', 'launcher/hit-shadow.js', 'room/seat-hit-targets.js'].every(f => pos(f) > 0 && pos(f) < iApp) && pos('launcher/hit-shadow.js') < pos('launcher/run-diag-minute.js'), 'html — hit-map · hit-shadow · seat-hit-targets 를 app.js 보다 먼저(hit-shadow 는 1분 진단보다 먼저)');
  return r;
}

const rows = judgePure(MOD);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 셈 · 줄'); chk(ok, msg); });
const rows2 = judgeWiring(DR, APP, HTML);
rows2.forEach(([ok, msg], i) => { if(i === 0) say('── 2. desktop-run 나란히 돌리기'); if(i === 9) say('── 3. app.js · html 연결'); chk(ok, msg); });
say('── 4. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['줄 길이 자르기 빠짐', 'm', m => m.replace('const cut = (s) => s.length > LINE_MAX ? s.slice(0, LINE_MAX) : s;', 'const cut = (s) => s;')],
  ['세는 칸 바뀜(지도만통과 ↔ 지도만받기)', 'm', m => m.replace("const k = r.old ? 'leak' : 'grab';", "const k = r.old ? 'grab' : 'leak';")],
  ['다를 때 줄이 매번 덮어씀', 'm', m => m.replace('if(!acc.detail[k] && r.detail)', 'if(r.detail)')],
  ['예산 안 봄', 'm', m => m.replace('return winSpent < BUDGET_MS;', 'return true;')],
  ['그림자 재료를 안 적음', 'd', d => d.replace(/\n          _shadowArm\(cx, cy, _ix, performance\.now\(\) - _t3d\);[^\n]*/, '')],
  ['보낸 뒤 그림자를 안 돌림', 'd', d => d.replace('      if(_shadow.armed) _hitShadowRun();   // 🗺️ 받기 · 통과를 보낸 뒤에(_shadowArm 주석)\n', '')],
  ['그림자가 던짐을 안 막음', 'd', d => d.replace("      }catch(_){\n        try{ hitShadow.record({ old: sh.old, neu: null, inRect: false, oldMs: sh.oldMs, newMs: performance.now() - t0, err: true }); }catch(__){}\n      }", "      }finally{}")],
  ['그림자를 [비용] 판정 안에서 돌림', 'd', d => d.replace('      const r = _pointHitsInteractiveRaw(cx, cy);\n', '      const r = _pointHitsInteractiveRaw(cx, cy);\n      if(_shadow.armed) _hitShadowRun();\n')],
  ['옛 답을 잘못 넘김', 'd', d => d.replace('_shadow.old = ix.length > 0;', '_shadow.old = true;')],
  ['그린 표시를 그리기 앞으로', 'a', a => { const L = "  seatHitMod.markRendered();   // 🗺️ 히트 맵 — 그린 장 표시만(지도는 판정이 찾을 때 만든다)\n"; return a.replace(L, '').replace('  const _tDraw = performance.now();\n', L + '  const _tDraw = performance.now();\n'); }],
  ['받기 전에 그림자가 돎(판정 안에서)', 'd', d => d.replace('_shadowArm(cx, cy, _ix, performance.now() - _t3d);', '_shadowArm(cx, cy, _ix, performance.now() - _t3d); _hitShadowRun();')],
  ['frame 이 다시 빈 지도를 판단', 'a', a => a.replace('  seatHitMod.markRendered();', '  seatHitMod.markRendered(TwHitMap.skipWhy({ officeHidden: _officeHidden }));')],
  ['html 줄 빠짐', 'h', h => h.replace('<script src="parts/room/seat-hit-targets.js"></script>', '')],
];
for(const [name, which, fn] of breaks){
  let m = MOD, d = DR, a = APP, h = HTML;
  try{ if(which === 'm') m = fn(MOD); if(which === 'd') d = fn(DR); if(which === 'a') a = fn(APP); if(which === 'h') h = fn(HTML); }catch(_){}
  const changed = m !== MOD || d !== DR || a !== APP || h !== HTML;
  let rr; try{ rr = judgePure(m).concat(judgeWiring(d, a, h)); }catch(_){ rr = [[false, '던짐']]; }
  chk(changed && rr.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
