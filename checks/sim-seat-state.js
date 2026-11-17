/* ═══ 🫧 sim-seat-state.js — 좌석 활동 판정 · 활동 시각 · 쓰다듬기(status/seat-state.js · app.js 분리 M10) ═══════════════
   [왜] seatState · 활동 시각을 모듈로 옮겼다. 판정 순서가 하나라도 바뀌면 캐릭터 자세가 틀어진다.
   ・1절: 우선순위 — 액자 고정 · 흔들기 · 어지러움 · 쓰다듬기 · 춤(내 좌석만) · 자리비움 · 친구 상태 · 수동 · 창 포커스 · 게이트 · 폰 · 입력 간격
   ・2절: 시각 — activity · anyInput · 듣기(mousemove · keydown · wheel · blur · focus) · 읽는 함수 · 쓰는 함수 · 펜 앱 창(4초)
   ・3절: triggerPet — 쓰다듬기 시작 · 눈 깜빡임 펄스
   ・4절: 연결 — html 순서 · 만드는 줄 · 옛 이름 · app.js 에 본문이 안 남음
   ・5절: 일부러 깨 보기
   [실행] 러너 스테이징 또는 저장소 루트에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = read('status/seat-state.js'), APP = read('app.js') + '\n' + (['creator/creator-canvas.js','creator/creator-open.js','launcher/window-mode.js'].map(f => read(f) || read(f.split('/').pop()) || '').join('\n')), HTML = read('desk-companion-prototype.html');
const GATE_SRC = read('focus/focus-gate.js');
if(!SRC || !APP || !HTML || !GATE_SRC){ say('  ? 원본 못 찾음 — seat-state.js · app.js · desk-companion-prototype.html · focus-gate.js'); process.exit(2); }
const FOCUS_GATE = (() => { const w = {}; new Function('window', 'module', GATE_SRC)(w, undefined); return w.TwFocusGate; })();   // 진짜 «창이 앞이면 안 잠듦» 규칙

function build(src, o){
  o = o || {};
  const st = Object.assign({ desktop: false, figure: false, gate: false, mobile: false, us: null, manual: null }, o);
  const listeners = {}, docListeners = {};
  const win = { addEventListener: (t, f) => { listeners[t] = f; } };
  const doc = { hidden: !!o.hidden, addEventListener: (t, f) => { docListeners[t] = f; } };
  const perf = { now: () => st.t || 1000 };
  const names = ['window', 'document', 'performance', 'module'];
  new Function(...names, src)(win, doc, perf, undefined);
  const mod = win.TwSeatState.createSeatState({
    desktopMode: () => st.desktop, figureMode: () => st.figure, focusGate: FOCUS_GATE, focusGateSleep: () => st.gate,
    focusLevelMod: () => ({ _mobileOn: () => st.mobile }),
    seatPanelMod: { manual: () => st.manual }, userStatusMod: { userStatus: () => st.us },
  });
  return { mod, st, listeners, docListeners, win, doc };
}
const seat = (o) => Object.assign({ petStart: -1e9, remote: false, isMe: true }, o || {});

say('§1 상태 판정 순서');
{
  const b = build(SRC); const m = b.mod; const now = 100000;
  m.setLastActivity(now);    // 방금 입력
  chk(m.seatState(seat({ pinned: true, beingShaken: false }), now) === 'shaking', '액자 고정은 흔들림 자세');
  chk(m.seatState(seat({ beingShaken: true }), now) === 'shaking', '흔들기가 가장 먼저');
  chk(m.seatState(seat({ dizzyUntil: now + 10 }), now) === 'dizzy' && m.seatState(seat({ dizzyUntil: now - 1 }), now) !== 'dizzy', '어지러움은 끝나는 시각 전까지');
  chk(m.seatState(seat({ petStart: now - 100 }), now) === 'pet' && m.seatState(seat({ petStart: now - m.PET_MS }), now) !== 'pet', '쓰다듬기 PET_MS 안에서만');
  chk(m.seatState(seat({ danceUntil: now + 5 }), now) === 'dance', '춤 — 내 좌석');
  chk(m.seatState(seat({ danceUntil: now + 5, remote: true, remoteState: 'idle' }), now) === 'idle', '  친구 좌석은 춤 키를 안 본다(remoteState 로 전달됨)');
  b.st.us = 'away';
  chk(m.seatState(seat(), now) === 'sleep', '내 자리비움은 잠(영혼)');
  chk(m.seatState(seat({ remote: true, isMe: false, remoteUserStatus: 'away', remoteState: 'focus' }), now) === 'sleep', '친구 자리비움도 잠');
  chk(m.seatState(seat({ beingShaken: true }), now) === 'shaking', '  흔들기는 자리비움보다 우선');
  b.st.us = null;
  chk(m.seatState(seat({ remote: true, isMe: false, remoteState: 'focus' }), now) === 'focus' && m.seatState(seat({ remote: true, isMe: false }), now) === 'idle', '친구 좌석은 받은 상태 · 없으면 idle');
  b.st.manual = 'sleep';
  chk(m.seatState(seat(), now) === 'sleep', '수동 선택 상태');
  b.st.manual = null;
  b.doc.hidden = false;
}
{
  const m = build(SRC).mod;
  chk(m.FOCUS_MS === 1500 && m.SLEEP_MS === 8000 && m.PET_MS === 2200 && m.PEN_FOCUS_MS === 4000, '시간 상수 — 집중 1.5초 · 잠 8초 · 쓰다듬기 2.2초 · 펜 앱 4초(자세를 정하는 값)');
}
say('§1-2 창 포커스 · 게이트 · 입력 간격');
{
  let b = build(SRC); let m = b.mod; const now = 100000;
  b.listeners.blur();
  chk(m.seatState(seat(), now) === 'sleep', '일반 모드에서 창을 잃으면 잠');
  b.st.desktop = true;
  m.setLastActivity(now);
  chk(m.seatState(seat(), now) === 'focus', '데스크탑 · 게이트 열림 · 방금 입력 — 집중');
  b.st.gate = true;
  chk(m.seatState(seat(), now) === 'sleep', '데스크탑 · 포커싱 게이트 닫힘 — 잠');
  m.setSelfAppActive(true);
  m.setLastActivity(now); m.setLastAnyInput(now);
  chk(m.seatState(seat(), now) === 'idle', '투게더워킹 창이 맨 앞이면 평소 자세');
  chk(m.seatState(seat(), now + m.SLEEP_MS + 1) === 'sleep', '  손 뗀 지 SLEEP_MS 넘으면 잠');
  m.setLastActivity(0); m.setLastAnyInput(now);
  chk(m.seatState(seat(), now + 100) === 'idle', '  lastActivity 가 낡아도 lastAnyInput 이 최근이면 안 잔다(게이트 닫힘 때)');
  m.setSelfAppActive(false);
  b = build(SRC); m = b.mod; b.listeners.focus();   // focus → 시각 갱신
  m.setLastActivity(now);
  chk(m.seatState(seat(), now + 500) === 'focus', '입력 FOCUS_MS 안 — 집중');
  chk(m.seatState(seat(), now + 2000) === 'idle', '  FOCUS_MS 지나면 평소');
  chk(m.seatState(seat(), now + m.SLEEP_MS + 1) === 'sleep', '  SLEEP_MS 지나면 잠');
  b.st.desktop = true; b.st.figure = true;
  chk(m.seatState(seat(), now + m.SLEEP_MS + 1) === 'idle', '피규어 모드는 입력이 끊겨도 잠들지 않음');
  b.st.figure = false; b.st.desktop = false;
  b.st.mobile = true;
  chk(m.seatState(seat(), now + m.SLEEP_MS + 1) === 'focus' && m.seatState(seat({ isMe: false }), now + m.SLEEP_MS + 1) === 'sleep', '폰으로 그리는 중이면 내 좌석만 집중');
  b.st.mobile = false;
  m.setPenAppFocused(true);
  chk(m.focusWindowMs() === m.PEN_FOCUS_MS && m.seatState(seat(), now + 3500) === 'focus', '펜 앱이면 집중 창이 4초');
  m.setPenAppFocused(false);
  chk(m.focusWindowMs() === m.FOCUS_MS && m.penAppFocused() === false, '  끄면 1.5초');
}
say('§2 시각 · 듣기');
{
  const b = build(SRC, { hidden: false }); const m = b.mod; b.st.t = 5000;
  m.activity();
  chk(m.lastActivity() === 5000, 'activity — lastActivity 갱신');
  b.st.t = 6000; m.anyInput();
  chk(m.lastAnyInput() === 6000 && m.lastActivity() === 5000, 'anyInput — lastAnyInput 만 갱신(둘을 합치지 않는다)');
  b.st.t = 7000; b.listeners.mousemove();
  chk(m.lastActivity() === 7000, 'mousemove 가 activity');
  b.st.t = 8000; b.listeners.keydown(); b.st.t = 8500; b.listeners.wheel();
  chk(m.lastActivity() === 8500, 'keydown · wheel 도 activity');
  b.st.t = 9000; b.listeners.focus();
  chk(m.lastActivity() === 9000 && m.lastAnyInput() === 9000, 'focus 는 둘 다 갱신');
  m.setLastActivity(1); m.setLastAnyInput(2);
  chk(m.lastActivity() === 1 && m.lastAnyInput() === 2, '쓰는 함수');
  chk(['mousemove', 'keydown', 'wheel', 'blur', 'focus'].every(k => typeof b.listeners[k] === 'function') && typeof b.docListeners.visibilitychange === 'function', '듣기 여섯(mousemove · keydown · wheel · blur · focus · visibilitychange)을 만들 때 건다');
  b.doc.hidden = true; b.docListeners.visibilitychange();
  chk(b.mod.seatState(seat(), 1e6) === 'sleep', '창이 숨으면(visibilitychange) 일반 모드에서 잠');
  const h = build(SRC, { hidden: true });
  chk(h.mod.seatState(seat(), 1e6) === 'sleep', '처음부터 숨은 창이면 잠으로 시작');
}
say('§3 triggerPet');
{
  const b = build(SRC); b.st.t = 4242;
  const s = seat({ blink: { pulses: [] } }); b.mod.triggerPet(s);
  chk(s.petStart === 4242 && s.blink.pulses.length === 1 && s.blink.pulses[0].start === 4242 && s.blink.pulses[0].dur === 240, '쓰다듬기 시작 시각 · 눈 깜빡임 펄스');
  const s2 = seat(); let th = false; try{ b.mod.triggerPet(s2); }catch(_){ th = true; }
  chk(!th && s2.petStart === 4242, 'blink 가 없는 좌석도 던지지 않는다');
}
say('§4 연결');
{
  const iS = HTML.indexOf('<script src="parts/status/seat-state.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
  chk(iS > 0 && iA > iS, 'html — seat-state.js 를 app.js 보다 먼저 싣는다');
  const code = APP.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
  chk(/const seatStateMod = TwSeatState\.createSeatState\(\{[\s\S]*?userStatusMod: userStatusMod,\s*\}\);/.test(code), 'app.js — 만든다');
  chk(['focusWindowMs', 'activity', 'anyInput', 'seatState', 'triggerPet'].every(n => new RegExp('^const ' + n + ' = seatStateMod\\.' + n + ';', 'm').test(code)), '  옛 이름 다섯을 const 로 받는다');
  chk(!/function (seatState|triggerPet|activity|anyInput|focusWindowMs)\b|\blet (lastActivity|lastAnyInput|_penAppFocused|_selfAppActive)\b/.test(code), '  app.js 에 본문 · 다시 대입되던 let 이 안 남음');
  chk(!/(?<![\w$.'"])(lastActivity|lastAnyInput|_penAppFocused|_selfAppActive)(?![\w$'":])/.test(code.replace(/\b_penAppFocused: seatStateMod/g, '').replace(/\b(lastActivity|lastAnyInput): seatStateMod/g, '')), '  시각 · 펜 앱 값은 어디서나 seatStateMod 로 읽는다');
  chk(/setLastActivity: \(v\)=>\{ seatStateMod\.setLastActivity\(v\); \}/.test(code) && /setLastAnyInput: \(v\)=>\{ seatStateMod\.setLastAnyInput\(v\); \}/.test(code) && /seatStateMod\.setPenAppFocused\(!!state\.isPenApp\)/.test(code) && /seatStateMod\.setSelfAppActive\(focusGate\.selfFront\(state\)\)/.test(code), '  쓰는 곳 넷(desktop-run 둘 · 활성 앱 판정 둘)이 모듈을 거친다');
}
say('§5 일부러 깨 보기');
{
  const brk = (from, to) => { const m = SRC.replace(from, to); return m === SRC ? null : m; };
  const m1 = brk("if(seat.beingShaken) return 'shaking';", '');
  chk(!!m1 && (() => { const b = build(m1); return b.mod.seatState(seat({ beingShaken: true }), 1) !== 'shaking'; })(), '흔들기 판정을 빼면 빨강');
  const m2 = brk("if(us==='away') return 'sleep';", '');
  chk(!!m2 && (() => { const b = build(m2); b.st.us = 'away'; b.mod.setLastActivity(10); return b.mod.seatState(seat(), 10) !== 'sleep'; })(), '자리비움 잠을 빼면 빨강');
  const m3 = brk("  if(desktopMode() && focusGateSleep()) return focusGate.gatedPose(_selfAppActive, now-Math.max(lastActivity,lastAnyInput), SLEEP_MS);\n", '');
  chk(!!m3 && (() => { const b = build(m3); b.st.desktop = true; b.st.gate = true; b.mod.setLastActivity(10); return b.mod.seatState(seat(), 10) !== 'sleep'; })(), '포커싱 게이트 잠을 빼면 빨강');
  const m4 = brk("!(desktopMode() && figureMode())", "true");
  chk(!!m4 && (() => { const b = build(m4); b.st.desktop = true; b.st.figure = true; b.mod.setLastActivity(0); return b.mod.seatState(seat(), 20000) !== 'idle'; })(), '피규어 모드 예외를 빼면 빨강');
  const m5 = brk("window.addEventListener('blur',()=>windowFocused=false);", '');
  chk(!!m5 && (() => { const b = build(m5); return b.listeners.blur === undefined; })(), 'blur 듣기를 빼면 빨강');
  const m6 = brk("function anyInput(){ lastAnyInput = performance.now(); }", "function anyInput(){ lastActivity = performance.now(); }");
  chk(!!m6 && (() => { const b = build(m6); b.st.t = 5; b.mod.anyInput(); return b.mod.lastAnyInput() !== 5; })(), 'anyInput 이 다른 시각을 건드리면 빨강');
  const m7 = brk("seat.petStart=now;", '');
  chk(!!m7 && (() => { const b = build(m7); const s = seat({ blink: { pulses: [] } }); b.mod.triggerPet(s); return s.petStart !== 4242; })(), '쓰다듬기 시각을 안 적으면 빨강');
}
say('');
say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
