/* ═══ 🔋 sim-frame-pace.js — 프레임 상한 · rAF 멈춤 감시(launcher/frame-pace.js · app.js 분리 M16) ═══════════════
   ・1절: 상한 fps(_frameCap) — 포커스 · 손댐 · 비행 · 끄는 중 · «하는 중»(입력칸 · 꾸미기 · 춤 · 생성기)이 FrameBudget.pickFps 와 같은 답
   ・2절: rAF 멈춤 감시 — 1초 안 오면 타이머가 frame 을 대신 · 첫 호출은 시각만 적음 · 포커스 · 블러 듣기
   ・3절: 자동 화질을 낮출 때 setRunLowered · 카메라 갱신
   ・4절: 연결 — deps 모양(값 / 읽는 함수 / 쓰는 함수 / 함수) · _lastRafAt 쓰는 자리
   ・5절: mutation test
   [실행] 저장소 루트에서 / 러너 스테이징. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const stripC = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
const depPairs = (APP, mod, glob, create) => { const m = APP.match(new RegExp('const ' + mod + ' = ' + glob + '\\.' + create + '\\(\\{\\n([\\s\\S]*?)\\n\\}\\);')); return m ? m[1].split('\n').map(l => /^  ([\w$]+): (.+),$/.exec(l)).filter(Boolean).map(x => [x[1], x[2]]) : null; };
const SRC = read('launcher/frame-pace.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html');
const FB = require(fs.existsSync('shared/frame-budget.js') ? './shared/frame-budget.js' : (fs.existsSync('app/parts/shared/frame-budget.js') ? process.cwd() + '/app/parts/shared/frame-budget.js' : process.cwd() + '/frame-budget.js'));
const GT = (() => { for(const p of ['app/parts/shared/gpu-timer.js', 'gpu-timer.js', 'parts/shared/gpu-timer.js']) if(fs.existsSync(p)) return require(process.cwd() + '/' + p); return null; })();
if(!SRC || !APP || !HTML || !FB || !GT){ say('  ? 원본 못 찾음'); process.exit(2); }
function build(src, o){
  o = o || {};
  const listeners = {}, intervals = [], calls = [], t = { now: 0 };
  const els = { active: o.active || null, hotPanel: !!o.panel };
  const bodyCl = new Set(o.body || ['runmode']);
  const document = { hasFocus: () => o.focused !== false, activeElement: o.active || null, body: { classList: { contains: (c) => bodyCl.has(c) } }, querySelector: () => (o.panel ? {} : null) };
  const win = { addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); }, companion: o.companion };
  const st = { fly: 0, drag: null, creator: false, lastRaf: 0, q: 'auto' };
  const deps = { _flyActive: () => st.fly, _renderQuality: () => st.q, setRunLowered: (v) => calls.push('lowered:' + v), creatorOpen: () => st.creator, frame: (n, m) => calls.push('frame:' + m), renderer: { getContext: () => null, capabilities: { isWebGL2: false } }, seatCameraMod: { updateCameraOnly: () => calls.push('cam') }, seatPointerMod: { drag: () => st.drag }, seats: o.seats || [] };
  const performance = { now: () => t.now };
  new Function('window', 'document', 'performance', 'FrameBudget', 'TwGpuTimer', 'setInterval', 'module', src)(win, document, performance, FB, GT, (fn, ms) => intervals.push({ fn, ms }), undefined);
  const mod = win.TwFramePace.createFramePace(deps);
  return { mod, calls, intervals, listeners, t, st, bodyCl };
}
say('§1 상한 fps');
{
  const b = build(SRC, { seats: [] });
  const idle = (now) => b.mod._frameBudget.idleMs(now);
  const want = (now, hot, focused, busy) => FB.pickFps({ hot, focused, runMode: true, busy, idleMs: idle(now) });
  chk(b.mod._frameCap(30000) === want(30000, false, true, false), '손 안 댄 포커스 상태 — pickFps 와 같은 답');
  b.t.now = 30000; b.mod._uiHot(); chk(b.mod._frameCap(performance_now(b)) === want(performance_now(b), true, true, false), '_uiHot 직후엔 «손댐» 으로 풀린다');
  const b2 = build(SRC, { seats: [] }); b2.st.fly = 1;
  chk(b2.mod._frameCap(30000) === FB.pickFps({ hot: true, focused: true, runMode: true, busy: false, idleMs: b2.mod._frameBudget.idleMs(30000) }), '★ 비행 중(_flyActive 를 부를 때마다 읽는다)은 풀린다');
  b2.st.fly = 0; b2.st.drag = {};
  chk(b2.mod._frameCap(30000) === FB.pickFps({ hot: true, focused: true, runMode: true, busy: false, idleMs: b2.mod._frameBudget.idleMs(30000) }), '끄는 중(drag)도 풀린다');
  const b3 = build(SRC, { seats: [], active: { tagName: 'INPUT' } });
  chk(b3.mod._frameCap(30000) === FB.pickFps({ hot: false, focused: true, runMode: true, busy: true, idleMs: b3.mod._frameBudget.idleMs(30000) }), '입력칸에 커서가 있으면 «하는 중»');
  const b4 = build(SRC, { seats: [{ _danceStartAt: 1 }] });
  chk(b4.mod._frameCap(30000) === FB.pickFps({ hot: false, focused: true, runMode: true, busy: true, idleMs: b4.mod._frameBudget.idleMs(30000) }), '춤 추는 좌석이 있으면 «하는 중»');
  const b5 = build(SRC, { seats: [] }); b5.st.creator = true;
  chk(b5.mod._frameCap(30000) === FB.pickFps({ hot: false, focused: true, runMode: true, busy: true, idleMs: b5.mod._frameBudget.idleMs(30000) }), '생성기가 열려 있으면(creatorOpen 을 읽는다) «하는 중»');
  const b6 = build(SRC, { seats: [], panel: true });
  chk(b6.mod._frameCap(30000) === FB.pickFps({ hot: false, focused: true, runMode: true, busy: true, idleMs: b6.mod._frameBudget.idleMs(30000) }), '꾸미기 패널이 열려 있으면 «하는 중»');
  const b8 = build(SRC, { seats: [] }); b8.mod._frameCap(30000); b8.st.creator = true;
  const stale = b8.mod._frameCap(30200);
  b8.mod._frameCap(30600);
  chk(FB.pickFps({ hot: false, focused: true, runMode: true, busy: false, idleMs: b8.mod._frameBudget.idleMs(30200) }) === stale, '  0.5초 안에는 낡은 판정 그대로(DOM 을 안 본다)');
  const cap = b.mod._frameCapped(7000);
  chk(typeof cap === 'boolean', '_frameCapped 는 건너뜀 여부(true/false)를 돌려준다');
  { const bq = build(SRC, { seats: [] });
    const capQ = (q) => { bq.st.q = q; return bq.mod._frameCap(30000); };
    const wantQ = (q) => FB.pickFps({ hot: false, focused: true, runMode: true, busy: false, idleMs: bq.mod._frameBudget.idleMs(30000), quality: q });
    chk(capQ('lowest') === wantQ('lowest') && capQ('auto') === wantQ('auto') && FB.fpsFor('lowest').active < FB.fpsFor('auto').active,
      '★ 저장된 화질(«최저»)을 부를 때마다 읽어 상한에 넘긴다 — 최저는 상한이 더 낮다'); }
}
function performance_now(b){ return b.t.now; }
say('§2 rAF 멈춤 감시 · 듣기');
{
  const b = build(SRC, { seats: [] });
  chk(b.intervals.length === 1 && b.intervals[0].ms === 400, '만들 때 400ms 타이머를 한 번 건다');
  b.t.now = 500; b.intervals[0].fn();
  chk(b.calls.length === 0 && b.mod._lastRafAt() === 500, '첫 호출은 시각만 적고 frame 을 부르지 않는다');
  b.t.now = 1400; b.intervals[0].fn();
  chk(b.calls.length === 0, '마지막 rAF 뒤 1초가 안 지났으면 가만히');
  b.t.now = 1600; b.intervals[0].fn();
  chk(b.calls.join() === 'frame:true', '★ 1초 넘게 rAF 가 안 오면 타이머가 frame(t, true) 를 대신 돌린다');
  b.mod.setLastRafAt(1700); b.t.now = 2000; b.calls.length = 0; b.intervals[0].fn();
  chk(b.calls.length === 0 && b.mod._lastRafAt() === 1700, 'frame 이 rAF 로 돈 시각을 setLastRafAt 로 알리면 다시 가만히');
  const bl = b.listeners;
  chk(['focus', 'blur', 'pointerdown', 'keydown', 'wheel'].every(e => (bl[e] || []).length === 1) && !bl.mousemove, '듣기 — focus · blur · pointerdown · keydown · wheel (mousemove 는 세지 않는다)');
  b.t.now = 30000; bl.blur[0]();
  const blurred = b.mod._frameCap(30000);
  bl.focus[0]();
  chk(blurred === FB.pickFps({ hot: false, focused: false, runMode: true, busy: false, idleMs: b.mod._frameBudget.idleMs(30000) }), 'blur 하면 비포커스 상한으로 내려간다');
}
say('§3 자동 화질');
{
  const b = build(SRC, { seats: [] }); b.mod._lowerRunQuality();
  chk(b.calls.join() === 'lowered:true,cam', '낮추면 «이번 실행 낮춤» 을 알리고 카메라를 다시 맞춘다');
}
say('§4 연결');
{
  const iM = HTML.indexOf('<script src="parts/launcher/frame-pace.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
  chk(iM > 0 && iA > iM, 'html — frame-pace.js 를 app.js 보다 먼저 싣는다');
  const code = stripC(APP);
  const pairs = depPairs(APP, 'framePaceMod', 'TwFramePace', 'createFramePace');
  const READ = ['_flyActive', '_renderQuality', 'creatorOpen'], FN = ['frame'];
  const shape = (n, v) => n === 'setRunLowered' ? v === '(v)=>{ _runLowered = v; }' : n === '_flyActive' ? v === '()=>flyChairMod._flyActive()' : READ.includes(n) ? v === '()=>' + n : FN.includes(n) ? v === '(...a)=>' + n + '(...a)' : v === n;
  chk(!!pairs && pairs.length === 9 && pairs.every(([n, v]) => shape(n, v)), '★ deps 9개 모양 — 읽는 함수 셋(_flyActive · _renderQuality · creatorOpen) · 함수 하나(frame) · 쓰는 함수 하나 · 값 넷');
  const bad = pairs ? pairs.map(([n, v]) => n === 'creatorOpen' ? [n, 'creatorOpen'] : [n, v]) : [];
  chk(!bad.every(([n, v]) => shape(n, v)), '  mutation test: 읽는 함수를 값으로 넘기면 빨강');
  chk(['_FB', '_frameBudget', '_runSlowWatch', '_gpuTimer', '_frameJsStats', '_lowerRunQuality', '_uiHot', '_frameCap', '_frameCapped'].every(n => new RegExp('^const ' + n + ' = framePaceMod\\.' + n + ';', 'm').test(code)), '  옛 이름 아홉을 const 로 받는다');
  chk(/framePaceMod\.setLastRafAt\(now\)/.test(stripC(read('launcher/frame-loop.js'))) && !/^\s*_lastRafAt\s*=/m.test(code), '  frame()(launcher/frame-loop.js)이 rAF 시각을 setLastRafAt 으로 알린다(직접 대입이 안 남음)');
  chk(!/function (_uiHot|_frameCap|_frameCapped|_fbIsBusy|_lowerRunQuality)\b/.test(code), '  본문이 app.js 에 안 남음');
}
say('§5 mutation test');
{
  const brk = (a, c) => { const m = SRC.replace(a, c); return m === SRC ? null : m; };
  const m1 = brk("if(t - _lastRafAt < RAF_STALL_MS) return;", "");
  chk(!!m1 && (() => { const b = build(m1, { seats: [] }); b.t.now = 500; b.intervals[0].fn(); b.t.now = 600; b.intervals[0].fn(); return b.calls.length === 1; })(), '멈춤 판정 문턱을 빼면 빨강');
  const m2 = brk("hot: !!_flyActive() ||", "hot: false ||");
  chk(!!m2 && (() => { const b = build(m2, { seats: [] }); b.st.fly = 1; return b.mod._frameCap(30000) !== FB.pickFps({ hot: true, focused: true, runMode: true, busy: false, idleMs: b.mod._frameBudget.idleMs(30000) }); })(), '비행 중 상한 해제를 빼면 빨강');
  const m3 = brk("if(now - _fbBusyAt < 500) return _fbBusy;", "");
  chk(!!m3 && (() => { const b = build(m3, { seats: [] }); b.mod._frameCap(30000); b.st.creator = true; b.mod._frameCap(30100); return FB.pickFps({ hot: false, focused: true, runMode: true, busy: true, idleMs: b.mod._frameBudget.idleMs(30100) }) === b.mod._frameCap(30100); })(), '0.5초 캐시를 빼면 빨강');
  const m4 = brk("    quality: _renderQuality(),", "");
  chk(!!m4 && (() => { const b = build(m4, { seats: [] }); b.st.q = 'lowest'; return b.mod._frameCap(30000) !== FB.pickFps({ hot: false, focused: true, runMode: true, busy: false, idleMs: b.mod._frameBudget.idleMs(30000), quality: 'lowest' }); })(), '화질을 상한에 안 넘기면 빨강');
}
say(''); say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail); process.exit(fail ? 1 : 0);
