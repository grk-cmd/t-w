/* ═══ 🎞 sim-frame-loop.js — 프레임 한 장(launcher/frame-loop.js · app.js 분리 M17) ═══════════════
   ・1절: 상한에 걸리면 그리지 않고 다음 프레임만 건다(manual 이면 안 건다) · rAF 시각 알림은 manual 이 아닐 때만
   ・2절: 상한을 통과하면 한 장 — 비용 재기 · 그리기 한 번 · 히트 맵 표시 · 상태칩 위치 · 다음 프레임 · 회사원 숨김 / 설정 화면이면 그리지 않음 · 데스크탑이면 clear
   ・3절: 좌석 한 명 몫 — 좌석이 있어도 던지지 않고 내 좌석이면 방 상태를 보냄
   ・4절: 연결 — deps 모양 · 옛 이름 · 만드는 줄이 INIT 의 첫 rAF 보다 앞
   ・5절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const stripC = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
const depPairs = (APP, mod, glob, create) => { const m = APP.match(new RegExp('const ' + mod + ' = ' + glob + '\\.' + create + '\\(\\{\\n([\\s\\S]*?)\\n\\}\\);')); return m ? m[1].split('\n').map(l => /^  ([\w$]+): (.+),$/.exec(l)).filter(Boolean).map(x => [x[1], x[2]]) : null; };
const SRC = read('launcher/frame-loop.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !APP || !HTML){ say('  ? 원본 못 찾음'); process.exit(2); }
function anything(){
  const f = function(){ return p; };
  const p = new Proxy(f, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'then' ? undefined : k === 'forEach' || k === 'some' || k === 'filter' || k === 'map' ? () => p : p), apply: () => p, set: () => true, construct: () => p });
  return p;
}
function build(src, o){
  o = o || {};
  const log = [], raf = [];
  const any = anything();
  const mix = (obj) => new Proxy(obj, { get: (t, k) => (k in t ? t[k] : any) });
  const st = { capped: !!o.capped, hidden: !!o.hidden, config: !!o.config, desktop: !!o.desktop, now: 1000, quality: 'sharp' };
  const seats = o.seats || [];
  const deps = new Proxy({}, { get: (t, k) => (k in t ? t[k] : any) });
  Object.assign(deps, {
    seats, framePaceMod: { setLastRafAt: (n) => log.push('rafAt:' + n) }, _frameCapped: () => st.capped, _gpuTimer: { poll: () => log.push('poll'), begin: () => log.push('gpuBegin'), end: () => log.push('gpuEnd') },
    _frameJsStats: { add: () => log.push('jsStat') }, _runSlowWatch: { note: () => false }, _frameCap: () => 30, _lowerRunQuality: () => log.push('lowered'),
    _renderQuality: () => st.quality, _configHidesScene: () => st.config, officeModeMod: () => ({ _officeHidden: () => st.hidden }), desktopMode: () => st.desktop,
    renderer: { render: () => log.push('render'), clear: () => log.push('clear') }, scene: {}, camera: {},
    runCost: mix({ since: (k) => log.push('cost:' + k) }), seatHitMod: mix({ markRendered: () => log.push('markRendered') }), statusChipMod: mix({ updateMyStatusChipPosition: () => log.push('chip') }),
    overheadMod: mix({ beginLabelFrame: () => log.push('labelFrame') }), activeItemMixers: { size: 0, forEach(){} }, seatEqClampMod: { _clampSeatDeskParts(){} },
    updateIdleItemPlayback(){}, updateActivePartPlayback(){}, updateItemHandTrackers(){}, floatersMod: mix({ floaters: [] }),
    rideBenchMod: mix({ _checkCircusBalance(){}, _updateRideChains(){} }), tricksMod: mix({ _updateFlyingSeats(){} }), dotRenderMod: mix({ sweepIfOn: () => log.push('dot') }), awayPicMod: () => mix({ _awayImgFollow(){} }),
  }, o.deps || {});
  const win = {}; const performance = { now: () => st.now };
  const document = { body: { classList: { contains: (c) => c === 'runmode' && !!o.runmode } } };
  const FrameBudget = { QUALITY: { AUTO: 'auto' } };
  new Function('window', 'module', 'performance', 'requestAnimationFrame', 'document', 'FrameBudget', 'TwBlinkTiming', src)(win, undefined, performance, (fn) => { raf.push(fn); return raf.length; }, document, FrameBudget, anything());
  const mod = win.TwFrameLoop.createFrameLoop(deps);
  return { mod, log, raf, st };
}
say('§1 상한');
{
  let b = build(SRC, { capped: true });
  b.mod.frame(5000, false);
  chk(b.log.join() === 'rafAt:5000' && b.raf.length === 1 && b.raf[0] === b.mod.frame, '상한에 걸리면 그리지 않고 다음 프레임만 건다(rAF 시각은 알림)');
  b = build(SRC, { capped: true }); b.mod.frame(5000, true);
  chk(b.log.length === 0 && b.raf.length === 0, 'manual(타이머 대행)이면 rAF 시각도 안 알리고 다음 프레임도 안 건다');
}
say('§2 한 장');
{
  let b = build(SRC, {}); b.mod.frame(5000, false);
  chk(b.log.filter(l => l === 'render').length === 1 && b.log.includes('markRendered') && b.log.includes('chip') && b.log.includes('dot') && b.log.includes('cost:frame') && b.log.includes('cost:render') && b.log.includes('cost:seat'), '그리기 한 번 · 히트 맵 표시 · 상태칩 위치 · 도트 훑기 · 비용 셋(seat · render · frame)');
  chk(b.log.indexOf('render') < b.log.indexOf('markRendered') && b.log.indexOf('markRendered') < b.log.indexOf('chip'), '차례 — 그리기 → 그린 표시 → 상태칩');
  chk(b.log[0] === 'rafAt:5000' && b.raf.length === 1, '상한 통과 뒤에도 다음 프레임을 건다');
  b = build(SRC, { hidden: true }); b.mod.frame(5000, false);
  chk(!b.log.includes('render') && b.log.includes('markRendered'), '★ 회사원 모드로 숨긴 동안은 그리지 않는다(상태 계산 · 표시는 그대로)');
  b = build(SRC, { config: true }); b.mod.frame(5000, false);
  chk(!b.log.includes('render'), '설정(런처) 화면이 #scene 을 가리면 그리지 않는다');
  b = build(SRC, { desktop: true }); b.mod.frame(5000, false);
  chk(b.log.indexOf('clear') >= 0 && b.log.indexOf('clear') < b.log.indexOf('render'), '데스크탑이면 그리기 전에 투명 클리어');
  b = build(SRC, { desktop: false }); b.mod.frame(5000, false);
  chk(!b.log.includes('clear'), '데스크탑이 아니면 clear 안 함');
  b = build(SRC, { runmode: true, deps: { _renderQuality: () => 'auto', _runSlowWatch: { note: () => true } } }); b.st.quality = 'auto'; b.mod.frame(5000, false);
  chk(b.log.includes('lowered'), '자동 화질 · 실행 화면 · 감시가 «느림» 이면 배율을 낮춘다');
  b = build(SRC, { runmode: false, deps: { _renderQuality: () => 'auto', _runSlowWatch: { note: () => true } } }); b.mod.frame(5000, false);
  chk(!b.log.includes('lowered'), '실행 화면이 아니면 안 낮춘다');
}
say('§3 좌석');
{
  let threw = null;
  const seat = { isMe: false, remote: false, group: anything(), rig: anything(), desk: anything(), bodyWrap: anything(), pose: { leanX: 0, turnY: 0, slumpY: 0, breSpd: 1, breAmp: 0, eyeOpen: 1, arm: 0 }, smooth: 0.1, breathePhase: 0, state: 'idle' };
  try{ const b = build(SRC, { seats: [seat], deps: { seatState: () => 'idle', targetFor: () => ({ leanX: 0, turnY: 0, slumpY: 0, breSpd: 1, breAmp: 0, eyeOpen: 1, arm: 0 }), lerp: (a, b2, t) => a + (b2 - a) * t, animateRig: () => {}, setClip: () => {} } }); b.mod.frame(5000, false); }catch(e){ threw = e; }
  chk(!threw, '좌석 하나가 있어도 한 장이 던지지 않는다' + (threw ? ' — ' + String(threw.message).slice(0, 80) : ''));
}
say('§4 연결');
{
  const iM = HTML.indexOf('<script src="parts/launcher/frame-loop.js">'), iA = HTML.indexOf('<script src="parts/app.js">');
  chk(iM > 0 && iA > iM, 'html — frame-loop.js 를 app.js 보다 먼저 싣는다');
  const code = stripC(APP);
  const pairs = depPairs(APP, 'frameLoopMod', 'TwFrameLoop', 'createFrameLoop');
  const READ = ['_renderQuality', 'awayPicMod', 'desktopMode', 'expBarMod', 'focusLevelMod', 'focusProgressMod', 'listenUi', 'officeModeMod'];
  const shape = (n, v) => n === '_renderQuality' ? v === '()=>_renderQuality' : n === 'myCode' ? v === '()=>TwRoomRt.store.myCode()' : READ.includes(n) ? v === '()=>' + n : v === n;
  chk(!!pairs && pairs.length === 53 && pairs.every(([n, v]) => shape(n, v)), '★ deps 53개 모양 — 읽는 함수 여덟은 ()=>이름 · 방 서버 내 코드 myCode · 나머지는 값(이미 만들어진 것)' + (pairs ? ' (' + pairs.length + '개)' : ''));
  const bad = pairs ? pairs.map(([n, v]) => n === 'desktopMode' ? [n, 'desktopMode'] : [n, v]) : [];
  chk(!bad.every(([n, v]) => shape(n, v)), '  깨 보기: 읽는 함수를 값으로 넘기면 빨강');
  chk(/^const frame = frameLoopMod\.frame;/m.test(code) && !/function frame\(/.test(code) && !/^let prev=/m.test(code), '옛 이름 frame 을 const 로 받고 본문 · prev 는 안 남음');
  const iMk = code.indexOf('const frameLoopMod = TwFrameLoop'), iRaf = code.indexOf('requestAnimationFrame(frame)');
  chk(iMk > 0 && iRaf > iMk, '★ 만드는 줄이 첫 requestAnimationFrame(frame) 보다 앞(TDZ)');
}
say('§5 일부러 깨 보기');
{
  const brk = (a, c) => { const m = SRC.replace(a, c); return m === SRC ? null : m; };
  const m1 = brk("if(!manual) framePaceMod.setLastRafAt(now);", "framePaceMod.setLastRafAt(now);");
  chk(!!m1 && (() => { const b = build(m1, { capped: true }); b.mod.frame(5000, true); return b.log.length > 0; })(), 'manual 에도 rAF 시각을 알리면 빨강');
  const m2 = brk("if(!officeModeMod()._officeHidden() && !_configHidesScene()){", "if(!_configHidesScene()){");
  chk(!!m2 && (() => { const b = build(m2, { hidden: true }); b.mod.frame(5000, false); return b.log.includes('render'); })(), '회사원 숨김 조건을 빼면 빨강');
  const m3 = brk("if(_frameCapped(now)){\n    if(!manual) requestAnimationFrame(frame);\n    return;\n  }", "");
  chk(!!m3 && (() => { const b = build(m3, { capped: true }); b.mod.frame(5000, false); return b.log.includes('render'); })(), '상한 건너뛰기를 빼면 빨강');
  const m4 = brk("seatHitMod.markRendered();", "");
  chk(!!m4 && (() => { const b = build(m4, {}); b.mod.frame(5000, false); return !b.log.includes('markRendered'); })(), '히트 맵 표시를 빼면 빨강');
}
say(''); say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail); process.exit(fail ? 1 : 0);
