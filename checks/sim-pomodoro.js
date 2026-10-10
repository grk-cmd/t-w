/* ═══ 🍅 sim-pomodoro.js — 포커스 기록창 뽀모도로 (2026-10-02 · 시안 A안 확정 · 지정 알림음 beep-alarm) ═══════════════
   [무엇을 지키나] 포커스 기록창 [누적기록][🍅 뽀모][👑 달성표] — 🍅 를 누르면 달성표와 같은 자리에 서랍이 열린다.
   ・1절: 마크업 · CSS — 버튼 순서 · 세 버튼 같은 폭 규칙 · 서랍은 #focusLogWin 안 · 미니미에서 버튼·서랍 숨김 ·
          미니미 줄(#pomoMiniRow)은 #focusLogBtns **앞**(뒤에 두면 빈 버튼 줄 여백 아래로 밀린다) · 🕒 검사(sim-focus-show)가 보는 구간 침범 없음.
   ・2절: 배선 — 상태 변수는 var(★ _focusShowConf 가 스크립트 로드 중 먼저 불린다 — let 이면 TDZ 로 앱이 안 켜진다) ·
          달성표와 서랍 하나만 · 포커스 기록(addFocusSeconds)을 건드리지 않는다 · 알림음 풀은 자동재생 잠금 해제 등록보다 **앞**에서 만든다 ·
          머리 위 문구는 _focusShowConf 의 typeof 가드로만(새 필드 없음).
   ・3절: 동작 — 실제 함수(_pomoStartPhase · _pomoAdvance · _pomoTick · _pomoShowText · _pomoLeftMs)를 떼어 시계를 돌려 본다.
   [실행] app.js · weekly-challenge.js · pomodoro.js · desk-companion-prototype.html 이 있는 폴더에서.
   ※ 👑 달성표는 parts/weekly-challenge.js 로 옮겼다(앱 FSD 2번) — _chalOpen 은 그 파일에서 찾고, 뽀모 쪽은 weeklyChal.open(false) 로 부른다.
   ※ 🍅 뽀모 본체는 parts/pomodoro.js 로 옮겼다(앱 FSD 6번) — 뽀모 블록 · _pomo* 함수는 그 파일에서 찾는다. 알림음 풀 · _focusShowConf 는 app.js.
     만들 때 배선 · 버튼 흐름은 sim-pomodoro-module 이 본다. */
'use strict';
const fs = require('fs');
const SRC  = fs.readFileSync('app.js', 'utf8');
const HTML = fs.readFileSync('desk-companion-prototype.html', 'utf8');
let WC = null; try{ WC = fs.readFileSync('weekly-challenge.js', 'utf8'); }catch(_){ console.log('  ? 원본 못 찾음 — weekly-challenge.js'); process.exit(2); }
let PM = null; try{ PM = fs.readFileSync('pomodoro.js', 'utf8'); }catch(_){ console.log('  ? 원본 못 찾음 — pomodoro.js'); process.exit(2); }

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const grabFn = (name, src = SRC) => { const i = src.indexOf('function ' + name + '('); if(i < 0) return ''; let k = src.indexOf('{', i), d = 0; for(; k < src.length; k++){ if(src[k] === '{') d++; else if(src[k] === '}' && --d === 0) return src.slice(i, k + 1); } return ''; };
const CODE = strip(SRC);
/* 뽀모 블록 — 머리 주석부터 bindPomo IIFE 끝까지(pomodoro.js) */
const P0 = PM.indexOf('var POMO_KEY'), P1 = PM.indexOf('setInterval(_pomoTick, 1000);', P0);
const POMO = (P0 > 0 && P1 > P0) ? PM.slice(P0, P1 + 60) : '';

say('── 1. 마크업 · CSS');
{
  const btns = HTML.slice(HTML.indexOf('<div id="focusLogBtns">'), HTML.indexOf('</div>', HTML.indexOf('<div id="focusLogBtns">')));
  const iOk = btns.indexOf('id="focusLogOk"'), iPo = btns.indexOf('id="pomoBtn"'), iCh = btns.indexOf('id="chalBtn"');
  chk(iOk >= 0 && iPo > iOk && iCh > iPo, '버튼 순서 [누적기록][🍅 뽀모][👑 달성표]');
  chk(/<button id="pomoBtn" type="button"[^>]*>🍅 뽀모<\/button>/.test(btns), '🍅 뽀모 — 왕관 없음(무료)');
  chk(/#focusLogBtns #focusLogOk, #focusLogBtns #chalBtn, #focusLogBtns #pomoBtn\{flex:1 1 0;min-width:0;/.test(HTML), '★ 세 버튼이 한 규칙으로 같은 폭(flex:1 1 0) — 짝짝이 재발 방지');
  chk(/#focusLogBtns\{[^}]*align-self:stretch/.test(HTML), '버튼 줄이 창 폭을 다 쓴다(가운데 정렬 본문에서 줄이 줄어들지 않게)');
  const iW = HTML.indexOf('<div id="focusLogWin">'), iD = HTML.indexOf('<div id="pomoDrawer">'), iM = HTML.indexOf('<!-- 🏠 마이홈', iW);
  chk(iW > 0 && iD > iW && (iM < 0 || iD < iM), '서랍(#pomoDrawer)은 #focusLogWin 안 — 새 창이 아니다(드래그·clampWin·통과 목록이 그대로 먹는다)');
  chk(/#focusLogWin\.pomo-on #pomoDrawer\{display:block;\}/.test(HTML) && /#pomoDrawer\{display:none;/.test(HTML), '평소 닫힘 · .pomo-on 일 때만 열림');
  chk(/#focusLogWin\.mini #pomoBtn,\s*#focusLogWin\.mini #pomoDrawer\{display:none !important;\}/.test(HTML), '미니미에서는 버튼·서랍을 숨긴다');
  chk(/#focusLogWin:not\(\.mini\) #pomoMiniRow\{display:none !important;\}/.test(HTML), '미니미 줄은 미니미에서만');
  const iRow = HTML.indexOf('id="pomoMiniRow"'), iBt = HTML.indexOf('<div id="focusLogBtns">'), iR2 = HTML.indexOf('id="focusLogRow2"');
  chk(iRow > iR2 && iRow < iBt, '★ 미니미 줄은 둘째 줄 뒤 · 버튼 줄 **앞**');
  chk(!/focusLogShowClock/.test(HTML.slice(iR2, iBt)), '🕒 는 첫 줄에만(sim-focus-show 가 보는 구간 그대로)');
  /* 서랍 안 id — app.js 가 잡는 것이 전부 있다 */
  const ids = ['pomoSetup','pomoRun','pomoPresetSeg','pomoInFocus','pomoInShort','pomoInLong','pomoInEvery','pomoChkAuto','pomoChkSound','pomoStart','pomoPhase','pomoBig','pomoBar','pomoBarFill','pomoDots','pomoPause','pomoSkip','pomoStop','pomoMiniLbl','pomoMiniTime'];
  const miss = ids.filter(id => HTML.indexOf('id="' + id + '"') < 0);
  chk(!miss.length, '서랍 id ' + ids.length + '개가 마크업에 다 있다' + (miss.length ? ' — 없음: ' + miss.join(', ') : ''));
  chk(!/pomo[\w-]*tab/i.test(HTML), "이름에 'tab' 없음(audit 검사 12(b) — 폴더탭으로 오인)");
}

say('── 2. 배선');
{
  chk(!!POMO, '뽀모 블록을 찾았다(var POMO_KEY … setInterval(_pomoTick))');
  chk(/^var _pomoRun = null;/m.test(PM) && /^var _pomoCfg = /m.test(PM) && !/^(let|const) _pomo(Run|Cfg)\b/m.test(PM), '상태 변수는 var 그대로(모듈 본문은 app.js 글자 그대로)');
  chk(!/(^|\n)\s*(var|let|const) _pomo(Run|Cfg)\b|function _pomo\w*\(/.test(CODE), '★ app.js 에는 뽀모 상태 · 함수 정의가 없다(모듈에만) — 로드 중 _focusShowConf 는 typeof 가드로 window 고리만 본다');
  const conf = strip(grabFn('_focusShowConf'));
  chk(/typeof _pomoShowText === 'function'/.test(conf), '★ _focusShowConf 는 typeof 가드로만 뽀모를 본다');
  const iSh = conf.indexOf('_pomoShowText()'), iOf = conf.indexOf('officeMode');
  chk(iSh > iOf && iOf > 0, '회사원 모드 · 꺼짐 판정이 먼저 — 뽀모 문구도 그 게이트 뒤');
  chk(/if\(on\) win\.classList\.remove\('pomo-on'\)/.test(strip(grabFn('_chalOpen', WC))), '달성표를 열면 뽀모 서랍이 닫힌다');
  chk(/if\(on\)\{ try\{ weeklyChal\.open\(false\); \}catch\(_\)\{\} \}/.test(strip(grabFn('_pomoOpen', PM))), '뽀모 서랍을 열면 달성표가 닫힌다');
  chk(!/addFocusSeconds|_focusTotalSec|_focusTodaySec|_focusSessionSec/.test(strip(POMO)), '★ 포커스 기록을 건드리지 않는다(같은 시간 두 번 · 레벨·달성표 판정 변화 방지)');
  const iPool = CODE.indexOf("_mkSndPool('pomo', POMO_SND_SRC");
  const iPrime = CODE.indexOf("_sndPools.forEach(P=>{ try{ P.prime(); }catch(_){} });");
  chk(iPool > 0 && iPrime > iPool, '★ 알림음 풀은 잠금 해제 등록(once:true) **앞**에서 만든다 — 뒤면 창을 안 볼 때 조용하다');
  chk(/const POMO_SND_SRC = \['parts\/pomodoro-alarm\.mp3', 'pomodoro-alarm\.mp3'\];/.test(CODE), '알림음 경로 parts/pomodoro-alarm.mp3 (+ 같은 폴더 폴백)');
  chk(/_pomoSnd\.play\(\)/.test(strip(grabFn('_pomoChime', PM))) && /if\(!_pomoCfg\.sound\) return;/.test(strip(grabFn('_pomoChime', PM))), '소리는 지정 파일 하나 · 「끝날 때 소리」 꺼짐이면 안 남');
  chk(!/AudioContext|createOscillator/.test(strip(POMO)), '합성음(WebAudio 삑) 흔적이 없다 — 지정 파일로 바꿨다');
  chk(/endAt/.test(strip(grabFn('_pomoLeftMs', PM))), '남은 시간은 끝나는 시각(벽시계)에서 — setInterval 지연에 밀리지 않는다');
  if(!fs.existsSync('pomodoro-alarm.mp3') && !fs.existsSync('parts/pomodoro-alarm.mp3'))
    say('  · 참고: 이 폴더에 pomodoro-alarm.mp3 가 안 보인다 — 배포본 app/parts/ 에 넣었는지 확인(검사 판정에는 안 넣는다)');
}

say('── 3. 동작');
{
  const env = { now: 1e12, toasts: [], pushes: 0, plays: 0, ls: {} };
  const fns = ['_pomoClampMin','_pomoSaveCfg','_pomoSaveRun','_pomoPhaseMs','_pomoLeftMs','_pomoFmt','_pomoShowText','_pomoStartPhase','_pomoChime','_pomoAdvance','_pomoTick'].map(n => grabFn(n, PM)).join('\n');
  const T = new Function('env', `
    const Date = { now: () => env.now };
    const localStorage = { setItem:(k,v)=>{ env.ls[k]=String(v); }, getItem:(k)=>env.ls[k] ?? null, removeItem:(k)=>{ delete env.ls[k]; } };
    const toast = (m) => env.toasts.push(m);
    const _focusShowPush = () => { env.pushes++; };
    const _pomoRender = () => {};
    const _pomoSnd = { play: () => { env.plays++; } };
    var POMO_KEY = 'tw.pomo', POMO_RUN_KEY = 'tw.pomoRun';
    var _pomoCfg = { preset:'25', f:25, s:5, l:15, every:4, auto:true, sound:true };
    var _pomoRun = null;
    ${fns}
    return { cfg: () => _pomoCfg, run: () => _pomoRun, set: (r) => { _pomoRun = r; },
             start: _pomoStartPhase, adv: _pomoAdvance, tick: _pomoTick, left: _pomoLeftMs, fmt: _pomoFmt, show: _pomoShowText, clamp: _pomoClampMin };
  `)(env);
  const MIN = 60 * 1000;
  T.start('focus', false);
  chk(T.run().phase === 'focus' && T.left() === 25 * MIN && env.ls['tw.pomoRun'], '시작 → 집중 25분 · 진행 상태가 저장된다(재시작해도 이어짐)');
  chk(T.fmt(T.left()) === '25:00' && T.fmt(61 * 1000) === '01:01' && T.fmt(500) === '00:01', '시간 표시 mm:ss(남은 초는 올림 — 0:00 이 먼저 뜨지 않게)');
  env.now += 18 * MIN;
  chk(T.show() === '🍅 집중 7분', '머리 위 문구 «🍅 집중 7분»(분 단위 · 1분에 한 번 나가므로)');
  env.now += 7 * MIN; T.tick();
  chk(T.run().phase === 'short' && T.run().done === 1 && T.left() === 5 * MIN, '집중 끝 → 짧은 휴식 5분 · 한 바퀴 셈');
  chk(env.plays === 1 && env.toasts.length === 1 && env.pushes === 1, '끝날 때 소리 한 번 · 알림 한 번 · 머리 위 문구 즉시 갱신');
  chk(T.show() === '☕ 휴식 5분', '휴식 중 문구 «☕ 휴식 5분»');
  for(let i = 0; i < 3; i++){ env.now = T.run().endAt; T.tick(); env.now = T.run().endAt; T.tick(); }
  /* 지금: 집중 4번째가 끝나고 긴 휴식이어야 한다 — 위 루프는 휴식→집중→(집중 끝) 을 세 번 */
  chk(T.run().phase === 'long' && T.run().done === 4 && T.left() === 15 * MIN, '★ 4바퀴째 집중이 끝나면 긴 휴식 15분');
  env.now = T.run().endAt; T.tick();
  chk(T.run().phase === 'focus' && T.run().done === 0 && !T.run().paused, '긴 휴식 끝 → 새 사이클(바퀴 0) · 자동 시작');
  T.cfg().auto = false;
  env.now = T.run().endAt; T.tick(); env.now = T.run().endAt; T.tick();
  chk(T.run().phase === 'focus' && T.run().paused === true && T.left() === 25 * MIN, '「자동 시작」 꺼짐 → 휴식 끝에서 멈춘 채 다음 집중 대기');
  env.now += 60 * MIN; T.tick();
  chk(T.run().paused && T.left() === 25 * MIN, '멈춘 동안에는 시간이 흐르지 않는다');
  chk(T.show() === '🍅 일시정지', '멈춤 문구 «🍅 일시정지»');
  T.cfg().auto = true; T.cfg().sound = false; const p0 = env.plays;
  T.set(null); T.start('focus', false); env.now = T.run().endAt; T.tick();
  chk(env.plays === p0, '「끝날 때 소리」 꺼짐 → 안 울린다');
  /* 오래 꺼져 있다 켜짐 — 끝난 지 한참(다음 구간 길이보다 더) 지났으면 몰아서 울리지 않고 멈춘 채 새 집중 */
  T.cfg().sound = true; T.set(null); T.start('focus', false); const p1 = env.plays;
  env.now = T.run().endAt + 3 * 60 * MIN; T.tick();
  chk(T.run().phase === 'focus' && T.run().paused && T.run().done === 0 && env.plays === p1 + 1, '★ 몇 시간 뒤 켜짐 → 한 번만 알리고 멈춘 채 새 집중(지난 구간을 몰아서 울리지 않음)');
  chk([T.show(), '🍅 집중 180분', '☕ 휴식 90분'].every(t => t.length <= 12), '머리 위 문구는 최대값도 12자 안(customStatus.text)');
  chk(T.clamp('0', 1, 180, 25) === 25 && T.clamp('999', 1, 180, 25) === 25 && T.clamp('45', 1, 180, 25) === 45 && T.clamp('abc', 1, 8, 4) === 4, '직접 입력 범위 밖·글자는 받지 않는다(이전 값 유지)');
  T.set(null);
  chk(T.show() === '' && T.left() === 0, '안 돌 때 → 빈 문구(머리 위는 예전 «오늘 H:MM» 그대로)');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
