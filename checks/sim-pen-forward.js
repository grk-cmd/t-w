/* sim-pen-forward.js — 🖊️ 펜 앱(클립스튜디오 등)이 앞이면 forward 를 끄되, 깨울 길이 없으면 끄지 않는다(main.js)
   실행:  node sim-pen-forward.js   (main.js 가 있는 폴더에서)
   ★ 왜 — forward(마우스 이동을 렌더러로 넘기기)가 켜져 있으면 펜 앱의 선 보정이 어긋나 «펜이 씹힌다»(제보 · 진단 로그 pen=true ignore=true).
     예전엔 «통과 중이면 무조건 forward» 한 줄이 그 보호를 통째로 껐다 — 고착(통과 + forward 꺼짐 → 렌더러가 못 깨어남)을 막으려던 것이다.
     이제는 50ms 커서 감시가 우리 창 자리를 알 때만 끈다. 이 검사는 두 쪽(펜 보호 · 고착 방지)을 함께 지킨다.
   ・1절: main.js 의 실물 함수(_penWakeReady · _forwardFor · _reapplyIgnoreMouse · _syncCursorWatcher · _checkCursorNearChar · _applyForwardOnly)를
     가짜 창 · 화면 · 타이머 위에서 돌린다 — 펜 앱 진입 · 근처 · 멀어짐 · 자리 잃음 · 자리 찾음 · 펜 앱 이탈 · 같은 값은 다시 안 걸기
   ・2절: 깨 보기 — 옛 한 줄 되살리기 · 깨울 길 검사 빼기 · 감시를 늦게 켜기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const MAIN = (() => { for (const c of ['main.js', '../main.js']) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; })();
if (!MAIN) { say('  ? 원본 못 찾음 — main.js'); process.exit(2); }
function grab(src, name){
  const i = src.indexOf('function ' + name + '('); if (i < 0) return null;
  let k = src.indexOf('{', i), d = 0;
  for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); }
  return null;
}
const NAMES = ['_penWakeReady', '_forwardFor', '_reapplyIgnoreMouse', '_syncCursorWatcher', '_checkCursorNearChar', '_applyForwardOnly'];

/* 무대 — 모듈 변수는 무대 안 let 으로, 바깥 것(화면 · 판정 · 찌르기)은 가짜로 */
function stage(src){
  const fns = NAMES.map(n => grab(src, n));
  if (fns.some(f => !f)) return null;
  const S = { calls: [], timers: new Map(), id: 0, cursor: { x: 1000, y: 500 }, onUI: false, sent: [] };
  const body = 'let _penAppActive = false, _penMouseNearChar = false, _lastIgnoreRequested = true, _cursorWatchTimer = null, _fwdApplied = null;\n'
    + 'let _mainWinScreenBounds = { x: 0, y: 0, width: 1920, height: 1140 }, _lastCharBounds = { x: 300, y: 900, r: 110 }, _lastRegions = [];\n'
    + 'let _penRepokeAt = 0, _penRepokePt = null; const PEN_REPOKE_MS = 150, PEN_MOVE_MIN_PX = 3;\n'
    + fns.join('\n')
    + '\nreturn { get: (k) => eval(k), set: (k, v) => { eval(k + " = v"); }, reapply: _reapplyIgnoreMouse, tick: _checkCursorNearChar, fwd: _forwardFor };';
  const mainWindow = { isDestroyed: () => false, setIgnoreMouseEvents: (ig, o) => S.calls.push({ ig, fwd: o && o.forward }) };
  const screen = { getCursorScreenPoint: () => ({ x: S.cursor.x, y: S.cursor.y }) };
  const api = new Function('mainWindow', 'screen', 'setInterval', 'clearInterval', '_reportCursorActivity', '_ptOnOurUI', '_sendHitTest', '_syncHoverWatcher', 'Date', body)(
    mainWindow, screen, (f) => { const i = ++S.id; S.timers.set(i, f); return i; }, (i) => { S.timers.delete(i); },
    () => {}, () => S.onUI, (p) => S.sent.push(p), () => {}, { now: () => 0 });
  S.api = api;
  S.last = () => S.calls[S.calls.length - 1];
  S.tick = () => api.tick();
  return S;
}

function behave(src){
  const r = {}; const S = stage(src); if (!S) return null;
  const A = S.api;
  A.reapply();                                                  // 보통 앱 · 통과 중
  r.plain = S.last().ig === true && S.last().fwd === true && A.get('_cursorWatchTimer') === null;
  A.set('_penAppActive', true); A.reapply();                    // 클립스튜디오가 앞으로(활성 창 폴링)
  r.penFar = S.last().fwd === false && A.get('_cursorWatchTimer') !== null;
  const n0 = S.calls.length;
  for (let i = 0; i < 20; i++) S.tick();                        // 1초 동안 그리기 — 멀리서
  r.quiet = S.calls.length === n0;                              // 같은 값은 다시 안 건다(영상 깜빡임)
  S.onUI = true; S.tick();                                      // 캐릭터 · 대화창 근처로
  r.near = S.last().fwd === true && S.sent.some(p => p && p.x != null);
  S.onUI = false; S.tick();
  r.away = S.last().fwd === false && S.sent.some(p => p && p.left);
  A.set('_lastCharBounds', null); A.set('_lastRegions', []); S.tick();   // 우리 창 자리를 잃음(투영 보류 등)
  r.lost = S.last().fwd === true;                               // 깨울 길이 없다 — 켠다(고착 방지)
  const n1 = S.calls.length; S.tick(); S.tick();
  r.lostQuiet = S.calls.length === n1;
  A.set('_lastCharBounds', { x: 300, y: 900, r: 110 }); S.tick();
  r.found = S.last().fwd === false;                             // 자리를 다시 앎 — 다시 끈다
  A.set('_penAppActive', false); A.reapply();                   // 펜 앱을 떠남
  r.leave = S.last().fwd === true && A.get('_cursorWatchTimer') === null;
  A.set('_penAppActive', true); A.set('_mainWinScreenBounds', null); A.reapply();
  r.noWin = S.last().fwd === true;                              // 창 좌표를 모르면 끄지 않는다
  A.set('_mainWinScreenBounds', { x: 0, y: 0, width: 1920, height: 1140 }); A.set('_lastIgnoreRequested', false); A.reapply();
  r.capture = S.last().ig === false;                            // 클릭 받는 중엔 forward 가 쓰이지 않는다(값은 상관없음)
  return r;
}

say('\n── 1절: 실물 함수 실행');
const b = behave(MAIN);
if (!b) { chk(false, 'main.js 에서 ' + NAMES.join(' · ') + ' 를 다 찾았다'); }
else {
  chk(b.plain, '보통 앱 · 통과 중 — forward 켬 · 펜 감시 안 돎');
  chk(b.penFar, '★ 펜 앱이 앞이고 멀면 forward 를 끈다(펜 보호) — 감시를 먼저 켜서 바로 끈다');
  chk(b.quiet, '  그리는 동안 50ms 감시는 같은 값을 다시 걸지 않는다(1초 · 20틱 · 0번)');
  chk(b.near, '  우리 창 근처면 forward 를 켜고 재판정을 찌른다(렌더러가 깨어남)');
  chk(b.away, '  멀어지면 다시 끄고 «벗어남» 을 알린다');
  chk(b.lost, '★ 우리 창 자리를 잃으면 forward 를 켠다 — 깨울 길이 없으니(고착 방지)');
  chk(b.lostQuiet, '  잃은 동안에도 다시 걸지 않는다');
  chk(b.found, '  자리를 다시 알면 다시 끈다');
  chk(b.leave, '펜 앱을 떠나면 forward 켬 · 감시 멈춤');
  chk(b.noWin, '★ 창 좌표를 모르면 펜 앱이어도 끄지 않는다');
  chk(b.capture, '클릭 받는 중(ignore=false)도 그대로 건다');
}
chk(/' pen=' \+ _penAppActive \+ ' fwd=' \+ _fwdApplied/.test(MAIN), '진단 줄 끝에 fwd= — 다음 제보 때 forward 를 껐는지 로그로 본다');

say('\n── 2절: 깨 보기');
const old = behave(MAIN.replace('function _forwardFor(){\n', 'function _forwardFor(){\n  if(_lastIgnoreRequested) return true;\n'));
chk(!!old && old.penFar === false, '옛 «통과 중이면 무조건 forward» 를 되살리면 1절 «펜 보호» 가 빨강');
const noWake = behave(MAIN.replace('  return !_penWakeReady();\n', '  return false;\n'));
chk(!!noWake && (noWake.lost === false || noWake.noWin === false), '깨울 길 검사를 빼면 1절 «자리를 잃으면 켠다 · 창 좌표 모름» 이 빨강');
const late = behave(MAIN.replace("  _syncCursorWatcher();   // 먼저", "  0;   // 먼저").replace("  try{ _syncHoverWatcher(); }catch(_){}   // 일반 앱 호버 감시", "  _syncCursorWatcher(); try{ _syncHoverWatcher(); }catch(_){}   // 일반 앱 호버 감시"));
chk(!!late && late.penFar === false, '감시를 forward 뒤에 켜면(옛 순서) 1절 «바로 끈다» 가 빨강');

say(`\n결과: ${pass}·${fail}`);
process.exit(fail ? 1 : 0);
