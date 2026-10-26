/* sim-input-diag.js — 🩺 한글 씹힘 진단(input-diag.js · main.js · app.js 배선 · html 순서)
   실행:  node sim-input-diag.js   (input-diag.js · main.js · app.js · desk-companion-prototype.html 이 있는 폴더에서)
   ★ 왜 이 검사가 있는가 — 제보자 PC 기록 한 장으로 «조합 중 포커스 잃음» 과 «메인 멈춤» 을 가르려는 진단이다.
     줄이 안 남으면(이벤트 순서 · 절전 · 상한) 다시 받을 길이 없고, 너무 많이 남으면 다른 진단을 밀어낸다.
   ・1절: 조합 끊김(Electron 44 실측 순서) — 누르기 · Tab 으로 옮김은 조용 · 앱이 포커스를 뺏음 · 다른 앱이 앞으로 · 칸 다시 그림 · 글 내용 안 적음 · 연달아 한 줄 · 상한
   ・2절: 메인 멈춤 · 활성 창 조회 — 느린 것만 · 절전은 안 셈 · 1분에 한 줄 · 아무 일 없으면 조용
   ・3절: 깨 보기 — 갈래를 하나씩 지운 모듈로 1 · 2절을 다시 돌려 빨강이 나는지
   ・4절: 배선 — main 이 조회 시간을 넘기고 타이머를 끝낼 때 내림 · app.js 가 document 에 건다 · html 에서 app.js 보다 먼저 */
'use strict';
const { joinRenderer: _joinRenderer } = require('./sim-renderer-src.js');
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'parts/shared/' + f, 'app/parts/shared/' + f, 'app/parts/' + f, 'app/' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('input-diag.js'), MAIN = read('main.js'), APP = _joinRenderer(read('app.js')), HTML = read('desk-companion-prototype.html');
if (!MOD || !MAIN || !APP || !HTML) { say('  ? 원본 못 찾음 — input-diag.js · main.js · app.js · desk-companion-prototype.html'); process.exit(2); }

const load = (src) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w.TwInputDiag; };

/* 가짜 document · window — 이벤트 듣기만 흉내 낸다 */
function fakeDom(){
  const L = {}, W = {};
  const doc = { hasFocus: () => doc._focus, _focus: true, addEventListener: (n, f) => { (L[n] = L[n] || []).push(f); } };
  const win = { addEventListener: (n, f) => { (W[n] = W[n] || []).push(f); } };
  const fire = (n, e) => (L[n] || []).forEach(f => f(e || {}));
  const fireWin = (n) => (W[n] || []).forEach(f => f({}));
  return { doc, win, fire, fireWin };
}
const input = (id) => ({ tagName: 'TEXTAREA', id, classList: [], isConnected: true });

/* 1 · 2절 묶음 — 깨 보기에서 같은 묶음을 망가진 모듈로 다시 돌린다. 돌려주는 것은 [통과 수, 실패 수] */
function suite(D, quiet){
  let p = 0, f = 0;
  const c = (ok, msg) => { ok ? p++ : f++; if(!quiet) chk(ok, msg); };
  let t = 1000;
  const now = () => t;

  if(!quiet) say('── 1. 조합 끊김(크로미움 실측 순서 — Electron 44)');
  let notes = [], later = [];
  const flush = () => { const q = later; later = []; q.forEach(f => f()); };
  const mk = () => { notes = []; later = []; t += 10000; const d = fakeDom(); D.createImeWatch({ note: (m) => notes.push(m), now, defer: (f) => later.push(f) }).attach(d.doc, d.win); return d; };
  const type = (d, el) => { d.fire('compositionstart', { target: el }); t += 300; d.fire('compositionupdate', { data: '가' }); t += 200; };
  let d = mk(); const el = input('chatInput'), other = input('other');

  type(d, el); d.fire('pointerdown'); d.fire('compositionend', { target: el }); d.fire('focusout', { target: el }); flush();
  c(notes.length === 0, '★ 조합 중 다른 칸을 눌러 옮김(compositionend → focusout) — 평소 입력이라 조용');
  d = mk(); type(d, el); d.fire('keydown', { key: 'Tab' }); d.fire('compositionend', { target: el }); d.fire('focusout', { target: el }); flush();
  c(notes.length === 0, '★ 조합 중 Tab 으로 옮김 — 조용');
  d = mk(); type(d, el); d.fire('keydown', { key: 'Enter', isComposing: true }); d.fire('compositionend', { target: el }); d.fire('focusout', { target: el }); flush();
  c(notes.length === 0, '★ 조합 중 Enter 에 칸이 스스로 blur(닉네임 · 제목 칸) — 조용');
  d = mk(); type(d, el); d.fire('keydown', { key: 'Escape' }); d.fire('compositionend', { target: el }); d.fire('focusout', { target: el }); flush();
  c(notes.length === 0, '  조합 중 Esc 에 blur — 조용');
  d = mk(); type(d, el); d.fire('compositionend', { target: el }); t += 2000; d.fire('focusout', { target: el }); flush();
  c(notes.length === 0, '  확정하고 한참 뒤 포커스가 옮겨 감 — 조용');

  d = mk(); type(d, el); d.fire('compositionend', { target: el }); t += 5; d.fire('focusout', { target: el }); flush();
  c(notes.length === 1 && /포커스 뺏김/.test(notes[0]) && /textarea#chatInput/.test(notes[0]) && /시작 뒤 50\dms/.test(notes[0]), '★ 누르기 · Tab 없이 포커스가 옮겨 감(앱이 다른 곳에 focus) — 한 줄: ' + (notes[0] || '(없음)'));
  c(notes.length === 1 && !/가/.test(notes[0]) && /조합 1글자/.test(notes[0]), '★ 친 글자는 적지 않는다(조합 길이만)');
  d = mk(); type(d, el); d.fire('pointerdown'); t += D.USER_MOVE_MS + 50; d.fire('compositionend', { target: el }); d.fire('focusout', { target: el }); flush();
  c(notes.length === 1 && /포커스 뺏김/.test(notes[0]), '  누른 지 ' + (D.USER_MOVE_MS + 50) + 'ms 지나 옮겨 가면 사람이 옮긴 게 아니다 — 한 줄');

  d = mk(); type(d, el); d.doc._focus = false; d.fire('focusout', { target: el }); d.fireWin('blur'); d.fire('compositionend', { target: el }); flush();
  c(notes.length === 1 && /창 포커스 잃음/.test(notes[0]) && /창 포커스=없음/.test(notes[0]), '★ 조합 중 다른 앱이 앞으로(focusout → window blur → compositionend) — «창 포커스 잃음» 한 줄');
  d = mk(); type(d, el); d.doc._focus = false; d.fireWin('blur'); flush();
  c(notes.length === 1 && /창 포커스 잃음/.test(notes[0]), '  focusout 없이 창만 잃어도 한 줄');

  d = mk(); const gone = input('statusInput');
  type(d, gone); d.fire('focusout', { target: gone }); gone.isConnected = false; flush();
  c(notes.length === 1 && /입력칸이 사라짐/.test(notes[0]) && /statusInput/.test(notes[0]), '★ 조합 중 칸을 다시 그림(compositionend 없이 focusout · 그때는 아직 붙어 있음) — «입력칸이 사라짐»');
  d = mk(); type(d, el); d.fire('focusout', { target: el }); flush();
  c(notes.length === 1 && /칸 포커스 잃음/.test(notes[0]), '  조합이 살아 있는 채 칸만 포커스를 잃고 칸은 그대로 — «칸 포커스 잃음»');

  d = mk(); type(d, el); d.fire('focusout', { target: other }); flush();
  c(notes.length === 0, '  다른 칸의 focusout 은 이 조합과 상관없다');
  d = mk();
  for(let i = 0; i < 5; i++){ d.fire('compositionstart', { target: el }); t += 100; d.fireWin('blur'); }
  c(notes.length === 1, '★ 연달아 나면(' + D.IME_MIN_GAP_MS + 'ms 안) 한 줄만 — 5번 → ' + notes.length);
  d = mk(); type(d, el); d.fire('compositionend', { target: el }); d.fire('focusout', { target: el }); t += 100; d.fire('compositionstart', { target: el }); d.doc._focus = false; d.fireWin('blur');
  c(notes.length === 2 && /포커스 뺏김/.test(notes[0]) && /창 포커스 잃음/.test(notes[1]), '★ 묶음은 갈래마다 — «포커스 뺏김» 바로 뒤 «창 포커스 잃음» 도 남는다');
  d = mk();
  for(let i = 0; i < D.MAX_LINES + 20; i++){ type(d, el); t += D.IME_MIN_GAP_MS; d.fireWin('blur'); }
  c(notes.length === D.MAX_LINES && /기록 상한/.test(notes[notes.length - 1]), '★ 상한 ' + D.MAX_LINES + '줄 — 마지막 줄은 «기록 상한» (' + notes.length + '줄)');
  const d2 = fakeDom(); const w2 = D.createImeWatch({ note: () => {}, now, defer: (f) => f() }); w2.attach(d2.doc, d2.win);
  let n2 = 0; d2.doc.addEventListener = () => { n2++; }; w2.attach(d2.doc, d2.win);
  c(n2 === 0, '  같은 document 에 두 번 걸지 않는다');

  if(!quiet) say('── 2. 메인 멈춤 · 활성 창 조회');
  let logs = [], front = 'com.google.Chrome';
  const mkLag = () => { logs = []; t = 50000; return D.createLagWatch({ now, log: (m) => logs.push(m), front: () => front }); };
  let L = mkLag();
  const run = (ms, step) => { const end = t + ms; while(t < end){ t += step || D.LAG_TICK_MS; L.tick(); } };
  L.tick(); run(D.REPORT_MS + D.LAG_TICK_MS);
  c(logs.length === 0, '★ 아무 일 없으면 조용(1분 넘게 제때 불림)');
  L = mkLag(); L.tick(); run(1000); t += 840 + D.LAG_TICK_MS; L.tick(); run(1000); t += 150 + D.LAG_TICK_MS; L.tick(); run(D.REPORT_MS);
  c(logs.length === 1 && /메인 멈춤\(100ms\+\) 2번/.test(logs[0]) && /최대 840ms\(앞창=com\.google\.Chrome\)/.test(logs[0]), '★ 멈춤 두 번 → 1분에 한 줄 · 최대 · 그때 앞창: ' + (logs[0] || '(없음)'));
  L = mkLag(); L.tick(); run(1000); t += 60 + D.LAG_TICK_MS; L.tick(); run(D.REPORT_MS);
  c(logs.length === 0, '  ' + D.LAG_SLOW_MS + 'ms 아래로 늦은 것은 멈춤이 아니다');
  L = mkLag(); L.tick(); run(1000); t += 2 * 60 * 60 * 1000; L.tick(); run(D.REPORT_MS);
  c(logs.length === 0, '★ 절전 · 잠자기(2시간 건너뜀)는 멈춤으로 안 센다');
  L = mkLag(); L.tick(); for(let i = 0; i < 120; i++){ L.activeWinDone(i === 7 ? 310 : (i === 9 ? 60 : 3)); } run(D.REPORT_MS + D.LAG_TICK_MS);
  c(logs.length === 1 && /활성 창 조회 120번 · 느림\(50ms\+\) 2번 · 최대 310ms/.test(logs[0]) && /메인 멈춤\(100ms\+\) 0번/.test(logs[0]), '★ 활성 창 조회가 느리면 멈춤이 없어도 한 줄: ' + (logs[0] || '(없음)'));
  L = mkLag(); L.tick(); for(let i = 0; i < 120; i++) L.activeWinDone(5); run(D.REPORT_MS + D.LAG_TICK_MS);
  c(logs.length === 0, '  활성 창 조회가 다 빠르면 조용');
  L = mkLag(); L.tick();
  for(let k = 0; k < D.MAX_LINES + 5; k++){ L.activeWinDone(200); run(D.REPORT_MS + D.LAG_TICK_MS); }
  c(logs.length === D.MAX_LINES && /\[입력지연\] 기록 상한/.test(logs[logs.length - 1]), '★ 상한 ' + D.MAX_LINES + '줄 (' + logs.length + '줄)');
  return [p, f];
}

const D = load(MOD);
chk(!!D && typeof D.createImeWatch === 'function' && typeof D.createLagWatch === 'function', '싣기만 하면 window.TwInputDiag');
const [p0, f0] = suite(D, false);
pass += p0; fail += f0;

say('── 3. 깨 보기');
const breaks = [
  ['조합이 끝난 직후 포커스 뺏김을 안 봄', /if\(ended && el === ended\.el/, 'if(false && ended'],
  ['사람이 옮긴 것도 남김(평소 입력이 잡음)', /if\(now\(\) - userMoveAt > USER_MOVE_MS\) /, ''],
  ['Enter 를 사람 옮김으로 안 셈', /'Tab', 'Enter', 'Escape'/, "'Tab'"],
  ['묶음을 갈래 없이 하나로', /lastAt\.set\(why, t\)/, "lastAt.set('', t)"],
  ['칸 사라짐을 기다리지 않고 바로 적음', /defer\(\(\)=> line\(/, '(f=>f())(()=> line('],
  ['창 blur 를 안 들음', /if\(win\) win\.addEventListener\('blur'/, 'if(false) win.addEventListener(\'blur\''],
  ['절전을 멈춤으로 셈', /late < LAG_SLEEP_MS/, 'true'],
  ['줄 수 상한 없음', /if\(lines >= MAX_LINES\) return false;/, ''],
  ['연달아 나도 다 남김', /if\(t - \(lastAt\.has\(why\)[^\n]*IME_MIN_GAP_MS\) return;/, ''],
  ['활성 창 조회 느림을 안 셈', /if\(ms >= AW_SLOW_MS\) aw\.slow\+\+;/, ''],
];
for(const [name, re, to] of breaks){
  const src = MOD.replace(re, to);
  if(src === MOD){ chk(false, '깨 보기 «' + name + '» — 바꿀 자리를 못 찾음(모듈이 바뀌었으면 이 줄도 고칠 것)'); continue; }
  let r; try{ r = suite(load(src), true); }catch(e){ r = [0, 1]; }
  chk(r[1] > 0, '깨 보기 «' + name + '» → 빨강 ' + r[1]);
}

say('── 4. 배선');
const mPoll = MAIN.slice(MAIN.indexOf('function startActiveWinPolling'), MAIN.indexOf('function startActiveWinPolling') + 900);
chk(/require\('\.\/app\/parts\/shared\/input-diag'\)/.test(MAIN), 'main.js 가 input-diag.js 를 싣는다');
chk(/const t0 = Date\.now\(\);\s*const w = await activeWin\(\);\s*_lagWatch\.activeWinDone\(Date\.now\(\) - t0\);/.test(mPoll), '★ 500ms 폴링이 활성 창 조회 시간을 넘긴다(조회 바로 앞뒤)');
chk(/setInterval\(\(\) => _lagWatch\.tick\(\), InputDiag\.LAG_TICK_MS\)/.test(mPoll), '  멈춤 재기 타이머는 폴링과 같이 한 번만 켠다');
const exitFn = MAIN.slice(MAIN.indexOf('function _exitNow'), MAIN.indexOf('function _exitNow') + 700);
chk(/clearInterval\(_lagTimer\)/.test(exitFn), '  바로 끝내기(_exitNow)가 멈춤 재기 타이머도 내린다');
chk(/TwInputDiag\.createImeWatch\(\{[\s\S]{0,300}\}\)\.attach\(document, window\)/.test(APP), '★ app.js 가 document · window 에 건다');
const iMod = HTML.indexOf('<script src="parts/shared/input-diag.js"'), iApp = HTML.indexOf('<script src="parts/app.js"');
chk(iMod > 0 && iApp > 0 && iMod < iApp, '  html 에서 app.js 보다 먼저 싣는다');

say('\n결과: ' + pass + ' 통과 · ' + fail + ' 실패');
process.exit(fail ? 1 : 0);
