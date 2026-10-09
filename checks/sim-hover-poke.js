/* ═══ 🖱 sim-hover-poke.js — 일반 앱 앞에서 호버해도 클릭이 바로 안 잡히던 것 (제보 #5 · 2026-10-09 신설) ═══
   제보: 오버레이 위에 마우스를 올려도 클릭이 바로 안 잡히고 몇 초 흔들어야 된다(Windows).
   ・1절: shouldPoll — 일반 앱 · 통과 중 · 실행 화면 · 보임 · 오버레이 위 · Windows 일 때만 돈다
   ・2절: createHoverPoke — 들어오는 순간 한 번 · 가만히 있으면 다시 안 묻는다 · 안에서 움직이면 150ms 간격 · 나갔다 오면 다시
   ・3절: 시간 흉내 — 첫 재판정까지 걸리는 시간(예전 유령 감시 대비)
   ・4절: 펜 앱 근처 재질문(_checkCursorNearChar) — 본문을 떼어 실제로 돌린다: 150ms 간격 · 멈추는 조건
   ・5절: main.js 배선 · 보호 장치 그대로(_forwardFor · 50ms 펜 감시 · 유령 상수 · setIgnoreMouseEvents 개수)
   ・6절: app.js 보호 장치 그대로(사다리 펜 앱 생략 · pen=false 재판정은 생존 신호 아님 · 통과 복귀 150ms)
   ・7절: package.json build.files 에 main 이 부르는 루트 모듈이 다 있다(빠지면 설치본이 안 켜진다)
   [실행] hover-poke.js · main.js · app.js · package.json 이 있는 폴더에서(러너가 평평하게 펼친다). */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const d of [__dirname, process.cwd()]){ try{ return fs.readFileSync(path.join(d, f), 'utf8'); }catch(_){} } return null; };
const need = ['hover-poke.js', 'main.js', 'app.js', 'package.json'];
const SRC = {};
for(const f of need){ SRC[f] = read(f); if(SRC[f] == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } }
const mod = { exports: {} };
new Function('module', 'exports', 'require', SRC['hover-poke.js'])(mod, mod.exports, require);
const H = mod.exports;
const MAIN = SRC['main.js'], APP = SRC['app.js'];
const fnBody = (name) => (MAIN.match(new RegExp('function ' + name + '\\([^)]*\\)\\{[\\s\\S]*?\\n\\}')) || [''])[0];

say('── 1. shouldPoll — 돌아야 할 때만 돈다');
const ON = { win32: true, run: true, ignoring: true, penApp: false, visible: true, hasTargets: true, onOverlay: true };
chk(H.shouldPoll(ON) === true, '일반 앱 · 통과 중 · 실행 화면 · 보임 · 오버레이 위 · Windows → 돈다');
chk(H.shouldPoll(Object.assign({}, ON, { ignoring: false })) === false, '★ 클릭을 받는 중이면 안 돈다(진짜 mousemove 가 온다)');
chk(H.shouldPoll(Object.assign({}, ON, { penApp: true })) === false, '★ 펜 앱이면 안 돈다(50ms 펜 감시 · 클립 스튜디오 보호 장치가 맡는다)');
chk(H.shouldPoll(Object.assign({}, ON, { win32: false })) === false, 'Windows 가 아니면 안 돈다(맥은 타이머를 늘리지 않는다)');
chk(H.shouldPoll(Object.assign({}, ON, { run: false })) === false, '런처 · 생성기(작은 창)면 안 돈다');
chk(H.shouldPoll(Object.assign({}, ON, { visible: false })) === false, '숨김 · 최소화면 안 돈다');
chk(H.shouldPoll(Object.assign({}, ON, { onOverlay: false })) === false, '커서가 다른 모니터면 안 돈다');
chk(H.shouldPoll(Object.assign({}, ON, { hasTargets: false })) === false, '창 좌표 · 캐릭터 · 창 사각형을 아직 못 받았으면 안 돈다');
chk(H.shouldPoll(null) === false && H.shouldPoll({}) === false, '빈 값이면 안 돈다');
chk(H.HOVER_POLL_MS >= 100 && H.HOVER_POLL_MS <= 150, '폴링 간격 100~150ms (' + H.HOVER_POLL_MS + ')');
chk(H.HOVER_REPOKE_MS === 150, '안에서 다시 묻는 간격 150ms — 펜 앱 PEN_REPOKE_MS 와 같은 값');

say('── 2. createHoverPoke — 들어오는 순간 한 번');
{
  const P = H.createHoverPoke();
  let t = 0; const acts = [];
  const tick = (onUI, x, y) => { const a = P.step({ onUI, x, y, now: t }); if(a) acts.push(a); t += 120; return a; };
  tick(false, 0, 0); tick(false, 5, 5);
  chk(acts.length === 0, '밖에 있는 동안은 아무것도 안 보낸다');
  chk(tick(true, 100, 100) === 'enter', '★ 들어오는 순간 «enter» 한 번');
  for(let i = 0; i < 20; i++) tick(true, 100, 100);
  chk(acts.length === 1, '★ 가만히 있으면 2.4초 동안 다시 묻지 않는다(매 틱 아님) — ' + acts.length + '회');
  tick(true, 101, 100);
  chk(acts.length === 1, '  1px 떨림은 움직임으로 치지 않는다');
  tick(false, 900, 900);
  chk(P.isOn() === false, '나가면 상태가 풀린다');
  chk(tick(true, 100, 100) === 'enter', '★ 다시 들어오면 다시 «enter»');
  chk(acts.filter(a => a === 'enter').length === 2, '  들어온 횟수만큼만 «enter» (2)');
}
{
  // 안에서 움직임 — 50ms 표본으로 촘촘히 넣어도 150ms 에 한 번까지
  const P = H.createHoverPoke();
  let sent = [];
  for(let t = 0, x = 0; t <= 3000; t += 50, x += 5){ const a = P.step({ onUI: true, x, y: 0, now: t }); if(a) sent.push(t); }
  let minGap = Infinity; for(let i = 1; i < sent.length; i++) minGap = Math.min(minGap, sent[i] - sent[i - 1]);
  chk(sent.length > 1 && minGap >= 150, '★ 안에서 계속 움직이면 150ms 간격으로만 다시 묻는다(최소 간격 ' + minGap + 'ms · ' + sent.length + '회/3초)');
  chk(sent.length <= Math.ceil(3000 / 150) + 1, '  3초에 ' + sent.length + '회 — 상한(21) 이하');
}
{
  // 원 안 빈 자리에서 들어와 몸 위로 옮겨 감 — 움직였으니 다시 묻는다
  const P = H.createHoverPoke();
  P.step({ onUI: true, x: 10, y: 10, now: 0 });
  chk(P.step({ onUI: true, x: 30, y: 40, now: 100 }) === null, '  150ms 안이면 아직 안 묻는다');
  chk(P.step({ onUI: true, x: 30, y: 40, now: 160 }) === 'repoke', '★ 150ms 지나면 옮겨 간 자리로 다시 묻는다(멈춘 뒤라도 — 마지막으로 물은 자리와 비교)');
  chk(P.step({ onUI: true, x: 30, y: 40, now: 600 }) === null, '  그 자리에 멈춰 있으면 더는 안 묻는다');
  P.reset();
  chk(P.step({ onUI: true, x: 30, y: 40, now: 700 }) === 'enter', 'reset 뒤 첫 틱은 «enter»(타이머를 새로 켤 때)');
}

say('── 3. 시간 흉내 — 첫 재판정까지');
{
  // 커서가 t0 에 UI 로 들어온다. 폴링은 임의의 위상에서 돈다 — 최악은 폴링 간격 하나.
  let worst = 0;
  for(let phase = 0; phase < H.HOVER_POLL_MS; phase += 10){
    const P = H.createHoverPoke(); const t0 = 1000;
    for(let t = phase; t < 5000; t += H.HOVER_POLL_MS){
      if(P.step({ onUI: t >= t0, x: 1, y: 1, now: t }) === 'enter'){ worst = Math.max(worst, t - t0); break; }
    }
  }
  chk(worst <= H.HOVER_POLL_MS, '★ 일반 앱 — 들어온 뒤 늦어도 ' + worst + 'ms 안에 재판정(예전: 유령 감시 0.4초 문턱 + 500ms 폴링 → 0.5~1.0초, 그 전엔 2.0~2.5초)');
}

say('── 4. 펜 앱 근처 재질문 — main.js 본문을 떼어 돌린다');
{
  const chkFn = fnBody('_checkCursorNearChar');
  const a = chkFn.indexOf('if(near && _penMouseNearChar && _lastIgnoreRequested){');
  const b = chkFn.indexOf('if(near !== _penMouseNearChar){');
  const block = (a >= 0 && b > a) ? chkFn.slice(a, b) : '';
  chk(block.length > 0, '펜 앱 재질문 블록이 그대로 있다');
  chk(/const PEN_REPOKE_MS = 150;/.test(MAIN), 'PEN_REPOKE_MS = 150');
  chk(!/setIgnoreMouseEvents|_reapplyIgnoreMouse|_applyForwardOnly/.test(block), '  찌르기만 — 통과 설정을 다시 걸지 않는다');
  if(block){
    // eslint-disable-next-line no-new-func
    const run = new Function('ctx', 'with(ctx){' + block + '}');
    const ctx = { near: true, _penMouseNearChar: true, _lastIgnoreRequested: true, _penRepokeAt: 0, _penRepokePt: null,
      PEN_REPOKE_MS: 150, pt: { x: 0, y: 0 }, cx: 0, cy: 0, sent: [], T: 0, Math };
    ctx.Date = { now: () => ctx.T };
    ctx._sendHitTest = (p) => ctx.sent.push(ctx.T);
    for(let t = 1000; t <= 2000; t += 50){ ctx.T = t; ctx.pt = { x: t / 5, y: 0 }; run(ctx); }   // 50ms 감시 · 계속 움직임
    let minGap = Infinity; for(let i = 1; i < ctx.sent.length; i++) minGap = Math.min(minGap, ctx.sent[i] - ctx.sent[i - 1]);
    chk(ctx.sent.length >= 5 && minGap >= 150, '★ 근처 · 통과 중 · 움직이면 150ms 간격으로 다시 묻는다(' + ctx.sent.length + '회/1초 · 최소 ' + minGap + 'ms)');
    const n1 = ctx.sent.length;
    for(let t = 2050; t <= 3000; t += 50){ ctx.T = t; run(ctx); }   // 멈춤
    chk(ctx.sent.length - n1 <= 1, '  멈추면 더 묻지 않는다(마지막 자리 한 번까지)');
    const n2 = ctx.sent.length;
    ctx._lastIgnoreRequested = false;
    for(let t = 3050; t <= 4000; t += 50){ ctx.T = t; ctx.pt = { x: t, y: 0 }; run(ctx); }
    chk(ctx.sent.length === n2, '★ 클릭을 받기 시작하면 멈춘다');
    ctx._lastIgnoreRequested = true; ctx.near = false; ctx._penMouseNearChar = false;
    for(let t = 4050; t <= 5000; t += 50){ ctx.T = t; ctx.pt = { x: t * 2, y: 0 }; run(ctx); }
    chk(ctx.sent.length === n2, '★ 근처를 벗어나면 멈춘다');
  }
}

say('── 5. main.js 배선 · 보호 장치 그대로');
{
  chk(/const HoverPoke = require\('\.\/hover-poke'\);/.test(MAIN), 'hover-poke 모듈을 부른다');
  const fwd = fnBody('_forwardFor');
  chk(fwd === "function _forwardFor(){\n  if(_lastIgnoreRequested) return true;              // 통과 중 → 무조건 forward 유지(복구 통로 확보)\n  return !_penAppActive || _penMouseNearChar;        // 클릭 받는 중 → 기존 로직 그대로\n}",
    '★ _forwardFor(클립 스튜디오 보호) 글자 하나 안 바뀜');
  chk(/const shouldWatch = _penAppActive && mainWindow && !mainWindow\.isDestroyed\(\);/.test(MAIN) && /setInterval\(_checkCursorNearChar, 50\)/.test(MAIN), '  50ms 펜 감시는 펜 앱 전용 그대로');
  chk(/const GHOST_MS = 2000;/.test(MAIN) && /const GHOST_MS_PLAIN = 400;/.test(MAIN) && /const GHOST_REPOKE_MS = 3000;/.test(MAIN) && /const GHOST_MAX_POKES = 3;/.test(MAIN),
    '  유령 감시 상수 그대로(GHOST_REPOKE_MS ↔ 사다리 3초 결합 유지)');
  const sync = fnBody('_syncHoverWatcher'), tick = fnBody('_hoverTick'), stop = fnBody('_stopHoverWatcher'), st = fnBody('_hoverState');
  chk(sync && tick && stop && st, '_syncHoverWatcher · _hoverTick · _stopHoverWatcher · _hoverState 가 있다');
  const all = sync + tick + stop + st;
  chk(!/setIgnoreMouseEvents|_reapplyIgnoreMouse|_applyForwardOnly|_forwardFor|_lastIgnoreRequested\s*=[^=]/.test(all), '★ 호버 감시는 찌르기만 — setIgnoreMouseEvents · forward · 통과 값을 건드리지 않는다');
  chk(/process\.platform !== 'win32'/.test(sync) && /win32: process\.platform === 'win32'/.test(st), '  Windows 만 켠다');
  chk(/penApp: !!_penAppActive/.test(st) && /ignoring: !!_lastIgnoreRequested/.test(st) && /run: !_isConfigMode/.test(st), '  판단 재료: 펜 앱 · 통과 · 실행 화면');
  chk(/isVisible\(\) && !mainWindow\.isMinimized\(\)/.test(st) && /_ptOnOverlayWindow\(pt\)/.test(st), '  보임 · 오버레이 위');
  chk(/if\(!HoverPoke\.shouldPoll\(_hoverState\(pt\)\)\)\{ _stopHoverWatcher\(\); return; \}/.test(tick), '★ 틱마다 다시 보고 아니면 스스로 멈춘다(클릭받기 · 다른 모니터 · 숨김)');
  chk(/_hoverPoke\.step\(\{ onUI: _ptOnOurUI\(cx, cy\)/.test(tick) && /_sendHitTest\(\{ x: cx, y: cy \}\)/.test(tick), '  우리 UI 판정(_ptOnOurUI) 으로 들어옴을 보고 기존 _sendHitTest 로 찌른다(새 IPC 없음)');
  chk(/setInterval\(_hoverTick, HoverPoke\.HOVER_POLL_MS\)/.test(sync), '  간격은 모듈 상수');
  const re = fnBody('_reapplyIgnoreMouse');
  chk(/_syncHoverWatcher\(\)/.test(re), '통과/클릭받기가 바뀌는 순간 켜고 끈다(_reapplyIgnoreMouse)');
  chk(/try\{ _syncHoverWatcher\(\); \}catch\(_\)\{\}    \/\/ 🖱/.test(MAIN), '활성 창 폴링(500ms)에서도 켜고 끈다(다른 모니터에서 돌아옴 · 다시 보임)');
  const cnt = (MAIN.match(/mainWindow\.setIgnoreMouseEvents\(/g) || []).length;
  chk(cnt === 3, '★ mainWindow.setIgnoreMouseEvents 부르는 곳은 그대로 3곳(' + cnt + ') — 반복해서 다시 걸지 않는다(영상 깜빡임)');
  chk(/'호버 감시 — 찌른 뒤 '/.test(MAIN) && /HOVER_LOG_GAP_MS = 30000/.test(MAIN), '진단 줄 «호버 감시 — 찌른 뒤 Nms 에 클릭받기» · 30초에 한 줄');
}

say('── 6. app.js 보호 장치 그대로');
{
  const kick = (APP.match(/window\.__mouseKick = function\(offOverlay\)\{[\s\S]*?\n    \};/) || [''])[0];
  chk(/if\(_penAppFocused\)\{[\s\S]*?return;\s*\}/.test(kick), '★ 사다리는 펜 앱이면 건너뛴다(그리는 중 포커스 뺏김 방지)');
  chk(/if\(_lastPokePen && _lastPokeAt && now - _lastPokeAt < 3000\) return;/.test(kick), '  pen=false 재판정은 생존 신호가 아니다 — 호버 찌르기가 사다리 시계를 되감지 않는다');
  chk(/_notePoke\(pt && pt\.pen\);/.test(APP), '  재판정 수신은 _notePoke 로만 기록');
  chk(/_ignoreDebounce = setTimeout\(\(\)=>\{ _ignoreDebounce = null; _sendIgnore\(true\); \}, 150\);/.test(APP), '  통과 복귀 150ms 디바운스 그대로');
}

say('── 7. package.json — main 이 부르는 루트 모듈이 설치본에 들어간다');
{
  let files = [];
  try{ files = JSON.parse(SRC['package.json']).build.files || []; }catch(_){}
  const reqs = [...MAIN.matchAll(/require\('\.\/([a-z0-9-]+)'\)/g)].map(m => m[1]).filter(n => n !== 'oauth-config' && n !== 'package.json');
  const missing = [...new Set(reqs)].filter(n => !files.includes(n + '.js'));
  chk(files.includes('hover-poke.js'), '★ build.files 에 hover-poke.js');
  chk(missing.length === 0, '  main.js 의 require(\'./…\') 가 전부 build.files 에 있다' + (missing.length ? ' — 빠짐: ' + missing.join(', ') : ''));
}

say(`\n결과: ${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
