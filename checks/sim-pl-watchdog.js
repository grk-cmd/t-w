#!/usr/bin/env node
/* sim-pl-watchdog.js — 🐕 곡이 끝나도 신호가 안 오면 다음 곡으로 넘어가는가
   실행: node sim-pl-watchdog.js   (app.js · main.js 와 같은 폴더에서)

   [제보] "간혹 노래가 끝나면 다음 곡으로 안 넘어간다."
   [원인 셋] 곡을 넘기는 신호(TWPL:ended)를 만드는 주입 스크립트가
       ① did-finish-load 가 안 와서 **아예 안 붙거나**
       ② 30분(옛 3600 tick)이 지나 안전장치가 꺼지거나
       ③ 라이브(duration=Infinity)라 atEnd 검사가 영원히 false 이거나
     하면 아무도 모른 채 멈춘다. 셋 다 «신호가 안 오면 알 방법이 없다»가 뿌리다.

   ★ **시간이 아니라 진행 여부로 판정한다.** "N분 지났으면 넘긴다"로 하면 40분짜리 믹스가
     중간에 끊긴다. 이 검사의 절반은 «넘기지 말아야 할 때 안 넘기는가»를 본다.
   ★ app.js 는 통째로 못 싣는다 — 감시견 함수만 오려내어 **실제로 부른다.**
   ★ ✗(깨짐) / ?(검사 못함) 을 구분한다. `?` 만 남아도 종료 코드 2.

   🔴 [9/11 추가 — §5·§6] 이 검사기는 18항목이 전부 통과한 채로 반복 모드 제보를 못 잡았다.
     §1~3 이 `_plNext` 를 **카운터 스텁**으로 바꿔 끼웠기 때문이다 — «넘겼다»만 세고
     «어디로 넘겼나(같은 곡? 다른 곡? 멈춤?)»는 한 번도 안 봤다. 반복 모드는 거기서 갈린다.
     ⇒ §5·§6 은 _plNext · _plSkipNext · _plPlayNow · _plOpenTrack · _plShufPick · _plStop 과
       onBgmTrackEnd 핸들러까지 **실물을** 오려서 부른다. 스텁은 main 으로 가는 IPC 뿐이다.
     ⇒ «이 기능이 쓰이는 모드»를 전부 적고 하나씩 돈다: 반복 끔 · 목록 반복 · 한 곡 반복 · 셔플,
       각각 목록 1곡 / 5곡.
   ⚠️ 여기서 못 보는 것: 같은 주소를 다시 열었을 때 **페이지가 실제로 새로 뜨는가**(핸드오프 §1 실측).
     그건 main.js · Chromium 쪽이라 여기서 못 정한다. 대신 **두 갈래를 다 흉내 낸다** —
     새로 뜨면 하트비트가 0 부터(§5-2), 안 뜨면 끝 위치에 선 채로(§5-4). 어느 쪽이 실제든
     렌더러가 «멈추지 않되, 소리 없이 영원히 다시 열지도 않는다»를 지키는지 본다.
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
const APP = need('app.js'), MAIN = need('main.js');

function cutFn(src, name){
  const m = new RegExp('function\\s+' + name + '\\s*\\(').exec(src);
  if(!m) return null;
  const open = src.indexOf('{', m.index + m[0].length - 1);
  let d = 0, started = false;
  for(let j = open; j < src.length; j++){
    if(src[j] === '{'){ d++; started = true; }
    else if(src[j] === '}'){ d--; if(started && d === 0){
      const args = src.slice(m.index + m[0].length, open).replace(/\)\s*$/, '');
      return 'globalThis.' + name + ' = function(' + args + ')' + src.slice(open, j+1) + ';';
    } }
  }
  return null;
}
const NAMES = ['_plWatchReset', '_plWatchStop', '_plWatchBeat', '_plWatchTick'];
const cuts = NAMES.map(n => cutFn(APP, n));
const missing = NAMES.filter((n, i) => !cuts[i]);

say('\n🐕 재생 감시견\n');

/* ⚠️ 감시견 함수가 없다고 여기서 끝내지 않는다. 그러면 감시견이 지워졌을 때 §4(주입 스크립트)
   검사까지 같이 눈이 먼다 — 한 곳이 사라지면 나머지 검사도 조용해지는 구조를 만들면 안 된다. */
const HAVE_WATCH = !missing.length;
if(!HAVE_WATCH) huh('감시견 함수를 원문에서 못 찾았다: ' + missing.join(', ') + ' — §1~3 을 건너뛴다');

if(HAVE_WATCH){
/* ── 무대 ────────────────────────────────────────────────────────────────────
   시계를 우리가 돌린다 — 진짜로 30초 기다리면 검사가 30초짜리가 된다. */
function makeStage(listLen){
  const log = { next: 0, stop: 0, toasts: [], warns: [] };
  let NOW = 1000000;
  /* ★ 감시견 변수·문턱은 원문 선언에서 읽는다(watchDecls, 아래 §5). 손으로 적어 두면 고침이
       변수를 하나 더할 때마다 이 무대가 ReferenceError 로 죽는다 — 9/11 에 실제로 그랬다. */
  const st = Object.assign(watchDecls(), {
    Date: { now: ()=> NOW }, Math, String, parseInt, isFinite,
    console: { warn: m => log.warns.push(String(m)), log(){} },
    setInterval: ()=> 1, clearInterval(){},
    _plNow: 0, _plErrStreak: 0,
    _plPlaying: true,   // ⏸ [2026-09-20] 감시견이 «사람이 세워 둔 동안» 을 이 값으로 본다 — 아래 §2 마지막 케이스
    _plNowItems: ()=> Array.from({ length: listLen }, (_, i)=>({ id:'v'+i })),
    _plNext: ()=>{ log.next++; },
    _plStop: ()=>{ log.stop++; },
    toast: m => log.toasts.push(String(m)),
    _log: log,
  });
  vm.createContext(st);
  vm.runInContext(cuts.join('\n'), st, { filename:'app.js:watchdog' });
  return { st, log, adv: ms => { NOW += ms; }, now: ()=> NOW };
}
const SEC = 1000;

/* ── 1. 넘겨야 할 때 넘기는가 ─────────────────────────────────────────────── */
say('── 1. 멈췄을 때');

let w = makeStage(5);
w.st._plWatchReset();
w.adv(20 * SEC); w.st._plWatchTick();
chk(w.log.next === 0, '신호가 없어도 20초까지는 기다린다 (로딩이 느린 것일 수 있다)');
w.adv(15 * SEC); w.st._plWatchTick();
chk(w.log.next === 1, '주입이 안 붙어 신호가 아예 없으면 다음 곡으로 넘긴다');
chk(w.log.warns.some(x => /신호없음/.test(x)), '왜 넘겼는지 콘솔에 남긴다');

w = makeStage(5);
w.st._plWatchReset();
for(let i=0;i<6;i++){ w.adv(5*SEC); w.st._plWatchBeat((i+1)*5 + '|180|0'); }  // 정상 재생 30초
w.st._plWatchTick();
chk(w.log.next === 0, '재생 위치가 앞으로 가는 동안은 안 넘긴다');
for(let i=0;i<7;i++){ w.adv(5*SEC); w.st._plWatchBeat('30|180|0'); }          // 같은 자리 35초
w.st._plWatchTick();
chk(w.log.next === 1, '신호는 오는데 재생 위치가 안 움직이면 넘긴다 (ended 를 놓친 경우)');
chk(w.log.warns.some(x => /진행멈춤/.test(x)), '«진행멈춤»으로 구분해 남긴다');

/* ── 2. 넘기면 안 될 때 안 넘기는가 ───────────────────────────────────────── */
say('\n── 2. 넘기면 안 되는 때');

w = makeStage(5);
w.st._plWatchReset();
/* 40분짜리 믹스 — 시간으로 자르는 구현이면 여기서 걸린다 */
for(let i=1;i<=480;i++){ w.adv(5*SEC); w.st._plWatchBeat(i*5 + '|2400|0'); w.st._plWatchTick(); }
chk(w.log.next === 0, '40분짜리 긴 곡을 중간에 자르지 않는다 (시간이 아니라 진행으로 본다)');

w = makeStage(5);
w.st._plWatchReset();
/* 라이브 — 길이가 -1(무한)이지만 위치는 계속 나아간다 */
for(let i=1;i<=200;i++){ w.adv(5*SEC); w.st._plWatchBeat(i*5 + '|-1|0'); w.st._plWatchTick(); }
chk(w.log.next === 0, '라이브 스트림은 안 넘긴다 — 나아가고 있으니 멈춘 것이 아니다');

w = makeStage(5);
w.st._plWatchReset();
for(let i=0;i<20;i++){ w.adv(5*SEC); w.st._plWatchBeat('42|180|1'); w.st._plWatchTick(); }  // 일시정지
chk(w.log.next === 0, '사람이 일시정지한 것은 멈춤으로 세지 않는다');

/* ⏸ [2026-09-20 제보 «가만히 있다가 저절로 재생된다»] 세워 둔 채 하트비트까지 끊긴 경우.
   주입 루프는 4시간(TWPL_MAX) 뒤에 죽는다 — 세워 둔 동안에도 tick 이 쌓이므로 4시간 세워 두면 신호가 끊긴다.
   예전엔 그 순간 «진행멈춤» 으로 읽고 다음 곡을 틀었다. */
w = makeStage(5);
w.st._plWatchReset();
for(let i=0;i<6;i++){ w.adv(5*SEC); w.st._plWatchBeat((i*5) + '|180|0'); w.st._plWatchTick(); }   // 30초 재생
w.st._plPlaying = false;                                                                        // ▐▐
for(let i=0;i<4;i++){ w.adv(5*SEC); w.st._plWatchBeat('30|180|1'); w.st._plWatchTick(); }       // 세워 둔 채 하트비트 몇 번
for(let i=0;i<60;i++){ w.adv(60*SEC); w.st._plWatchTick(); }                                    // 그 뒤 1시간 — 하트비트 없음
chk(w.log.next === 0 && w.log.stop === 0, '★ ▐▐ 로 세워 둔 동안은 하트비트가 끊겨도 넘기지 않는다 — 4시간 뒤 주입 루프가 죽어도 «저절로 재생» 이 없다');
w.st._plPlaying = true;                                                                         // ▶ 다시
for(let i=0;i<8 && !w.log.next;i++){ w.adv(5*SEC); w.st._plWatchTick(); }                     // 신호가 정말 없다 (무대의 _plNext 는 되감지 않으므로 첫 넘김에서 멈춘다)
chk(w.log.next === 1, '  다시 ▶ 를 누른 뒤에 신호가 없으면 그때는 예전처럼 넘긴다(주입이 죽은 페이지는 끝나도 못 알린다)');

w = makeStage(5);
w.st._plWatchReset(); w.st._plNow = -1;
w.adv(60 * SEC); w.st._plWatchTick();
chk(w.log.next === 0, '재생 중이 아니면 아무것도 안 한다');

/* ── 3. 무한 루프 방지 ────────────────────────────────────────────────────── */
say('\n── 3. 목록 전체가 이 상태라면');
w = makeStage(3);
w.st._plErrStreak = 2;             // 이미 두 곡 연속 실패
w.st._plWatchReset();
w.adv(35 * SEC); w.st._plWatchTick();
chk(w.log.stop === 1 && w.log.next === 0, '연속 실패가 목록 길이에 닿으면 멈춘다 (무한히 안 돈다)');
chk(w.log.toasts.some(t => /재생할 수 있는 곡이 없어요/.test(t)), '왜 멈췄는지 알린다');

}  // HAVE_WATCH

/* ── 4. main.js 쪽 구멍 셋이 막혔는가 ─────────────────────────────────────── */
say('\n── 4. 주입 스크립트');
const M = MAIN.replace(/\s+/g, ' ');
chk(/isFinite\(v\.duration\)/.test(M),
    '라이브(duration=Infinity)에서 atEnd 가 죽지 않게 isFinite 를 본다');
chk(/__twplArmed/.test(M), '페이지 플래그로 주입이 두 벌 되는 것을 막는다');
chk(/on\('dom-ready',\s*bgmForcePlay\)/.test(M) && /on\('did-finish-load',\s*bgmForcePlay\)/.test(M),
    'dom-ready 와 did-finish-load 양쪽에서 감시를 붙인다');
const cap = /TWPL_MAX\s*=\s*(\d+)/.exec(MAIN);
chk(!!cap && Number(cap[1]) >= 14400,
    '감시 지속이 2시간 이상이다 (옛 3600 = 30분이라 긴 곡에서 안전장치를 잃었다)');
chk(/TWPL:hb:/.test(M), '재생 위치를 하트비트로 보낸다');
chk(/_twplArmRearm/.test(M) && /신호 없음/.test(MAIN),
    '신호가 조용하면 main 이 감시를 다시 심는다');

/* ═══ 5·6. 반복 모드 — 실물 함수로 ═══════════════════════════════════════════ */
const REAL = ['_plWatchReset', '_plWatchStop', '_plWatchBeat', '_plWatchTick',
              '_plNext', '_plSkipNext', '_plAdoptCurSet', '_plPlayNow', '_plOpenTrack',
              '_plShufPick', '_plStop', '_plNowItems', '_plNowHere'];
const realCuts = REAL.map(n => cutFn(APP, n));
const realMissing = REAL.filter((n, i) => !realCuts[i]);
/* 9/11 🔁 한 곡 반복 loop 판에서 _plOpenTrack 이 부르기 시작한 이름들 — **있으면** 원문을 싣는다.
   ⚠️ 필수 목록(REAL)에 넣지 말 것. 넣으면 그 이전 판 app.js 에서 §5·§6 이 통째로 «검사 못함»이 된다.
     무대에 폴백을 세워 두고(makePlayer) 원문이 있으면 덮는다. */
const OPTIONAL = ['_plWantLoop', '_plSyncLoop'].map(n => cutFn(APP, n)).filter(Boolean);

/* onBgmTrackEnd 핸들러는 이름 없는 화살표 함수다 — 등록 자리에서 중괄호 균형으로 오려낸다.
   ★ 하트비트도 «곡 끝남»도 이 한 입구로 들어온다. 이걸 건너뛰고 _plWatchBeat 를 직접 부르면
     입구의 분기(hb: 를 맨 위에서 거르는가)가 깨져도 모른다. */
function cutHandler(src){
  const key = 'companion.onBgmTrackEnd(';
  const i = src.indexOf(key); if(i < 0) return null;
  const arrow = src.indexOf('=>', i); const open = src.indexOf('{', arrow);
  if(arrow < 0 || open < 0 || open - i > 60) return null;
  let d = 0;
  for(let j = open; j < src.length; j++){
    if(src[j] === '{') d++;
    else if(src[j] === '}' && --d === 0)
      return 'globalThis.__onTrackEnd = ' + src.slice(i + key.length, j + 1) + ';';
  }
  return null;
}
const handlerCut = cutHandler(APP);

/* 감시견 상태 변수·문턱은 원문의 선언을 그대로 읽는다 — 고침이 변수를 더해도 무대가 따라간다.
   (못 읽으면 지금 값으로 폴백. 원문이 덮는다) */
function watchDecls(){
  const out = { PL_WATCH_SILENT_MS: 30000, PL_WATCH_STUCK_MS: 25000,
                _plWatchAt: 0, _plWatchHbAt: 0, _plWatchPos: -1, _plWatchMoveAt: 0, _plWatchTimer: null };
  const re = /^(?:let|const)\s+(_plWatch\w+|PL_WATCH_\w+)\s*=\s*([^;\n]+);/gm;
  let m;
  while((m = re.exec(APP))){ try{ out[m[1]] = vm.runInNewContext(m[2]); }catch(_){} }
  return out;
}
const MODE = { off:['반복 끔', false, 0], loop:['목록 반복', true, 0], one:['한 곡 반복', true, 1], shuf:['셔플', true, 2] };
const KIND = (() => { const m = /const\s+PL_KIND_LOOP\s*=\s*(\d+)\s*,\s*PL_KIND_ONE\s*=\s*(\d+)\s*,\s*PL_KIND_SHUF\s*=\s*(\d+)/.exec(APP);
  return m ? m.slice(1).map(Number) : null; })();

function makePlayer(len, mode){
  const log = { opened: [], toasts: [], warns: [] };
  let NOW = 5000000;
  const items = Array.from({ length: len }, (_, i) => ({ id: 'v' + i }));
  const st = Object.assign(watchDecls(), {
    Date: { now: () => NOW }, Math, String, parseInt, isFinite, Number, Array,
    console: { warn: m => log.warns.push(String(m)), log(){}, error(){} },
    setInterval: () => 1, clearInterval(){}, setTimeout: () => 1, clearTimeout(){},
    PL_KIND_LOOP: KIND[0], PL_KIND_ONE: KIND[1], PL_KIND_SHUF: KIND[2],
    PL_KIND_LABEL: ['목록 반복', '한 곡 반복', '셔플'],
    _plSets: [{ items }, { items: [] }, { items: [] }],
    _plCur: 0, _plNowSet: 0, _plView: null, _plNowView: null,
    _plNow: -1, _plSel: -1, _plPlaying: false, _plErrStreak: 0, _plShufBag: [],
    _plOn: MODE[mode][1], _plKind: KIND[MODE[mode][2]],
    _plRender(){}, _plNowTitle: () => '', _plApplyVolSoon(){}, _plVolReCancel(){}, _plSetLabel: i => '프리셋 ' + (i + 1),
    _plSyncLoop: () => false,   // 폴백 — 원문에 있으면 아래에서 덮인다
    toast: m => log.toasts.push(String(m)),
  });
  st.window = st;
  st.companion = { openPlaylistTrack: url => log.opened.push(url), closeBgm(){}, pauseBgm(){}, resumeBgm(){} };
  vm.createContext(st);
  /* ★ 이 무대의 companion 에는 setBgmLoop 가 없다 = **구버전 앱**. §5·§6 은 한 곡 반복을 옛 방식(같은 주소
       다시 열기)으로 돈다 — 새 앱에서도 loop 가 안 돌 때 감시견이 타는 길이 바로 이것이라 계속 지킨다.
       loop 쪽은 sim-pl-loop.js 가 본다. */
  vm.runInContext(realCuts.concat(OPTIONAL).join('\n') + '\n' + (handlerCut || ''), st, { filename: 'app.js:playlist' });
  const feed = kind => {
    if(st.__onTrackEnd) return st.__onTrackEnd(kind);
    if(kind.indexOf('hb:') === 0) return st._plWatchBeat(kind.slice(3));
  };
  const P = {
    st, log, len,
    step: ms => { NOW += ms; },
    feed,
    beat: (pos, dur, paused) => feed('hb:' + pos + '|' + dur + '|' + (paused ? 1 : 0)),
    tick: () => st._plWatchTick(),
    /* 실제와 같은 박자: 5초 흐르고 → 하트비트 → 감시견(감시견도 5초 주기) */
    run5: (pos, dur) => { P.step(5000); P.beat(pos, dur); P.tick(); },
    opens: () => log.opened.length,
    playing: () => st._plNow >= 0,
    start: () => { st._plPlayNow(0); },
  };
  return P;
}
const DUR = 60;
/* 한 곡: 끝까지 재생된 뒤 **종료 신호만 놓친다** — 영상은 끝에 서 있고 하트비트는 계속 온다. */
function cycleMissedEnd(P){
  const before = P.opens();
  for(let p = 5; p <= DUR; p += 5) P.run5(p, DUR);
  for(let i = 0; i < 12 && P.playing() && P.opens() === before; i++) P.run5(DUR, DUR);
}
/* 한 곡: 페이지는 떴는데 한 번도 못 나아간다 — 신호조차 없다(주입 실패·못 트는 곡). */
function cycleNeverStarted(P){
  const before = P.opens();
  for(let i = 0; i < 12 && P.playing() && P.opens() === before; i++){ P.step(5000); P.tick(); }
}
/* 한 곡: 중간까지 나오다 그 자리에서 굳는다 — 끝난 것이 아니다. */
function cycleStuckMid(P){
  const before = P.opens();
  for(let p = 5; p <= 30; p += 5) P.run5(p, 180);
  for(let i = 0; i < 12 && P.playing() && P.opens() === before; i++) P.run5(30, 180);
}
const NO_TRACK = t => /재생할 수 있는 곡이 없어요/.test(t);

say('\n── 5. 반복 모드별 — 감시견이 넘긴 뒤 어디로 가는가 (실물 함수)');
const CAN5 = !realMissing.length && !!KIND;
if(!CAN5) huh('실물 함수/상수를 원문에서 못 찾았다: ' + realMissing.concat(KIND ? [] : ['PL_KIND_*']).join(', ') + ' — §5·§6 을 건너뛴다');
if(CAN5 && !handlerCut) huh('onBgmTrackEnd 핸들러를 못 오려냈다 — 하트비트를 _plWatchBeat 로 직접 먹인다(입구 분기는 검사 못함)');

if(CAN5){
  /* 5-1. 모드 지도 — 어느 모드가 «같은 주소를 다시 여는가». 핸드오프 §1 의 갈래가 여기서 정해진다.
     ★ 셔플은 한 번 뽑아 보고 판단하지 않는다 — 200번 넘겨서 본다. */
  {
    const one = makePlayer(5, 'one'); one.start();
    for(let i = 0; i < 20; i++) one.st._plNext();
    chk(new Set(one.log.opened).size === 1, '모드 지도: 한 곡 반복은 자동 진행마다 **같은 주소**를 다시 연다');
    const sh = makePlayer(5, 'shuf'); sh.start();
    for(let i = 0; i < 200; i++) sh.st._plNext();
    const same = sh.log.opened.slice(1).filter((u, i) => u === sh.log.opened[i]).length;
    chk(same === 0 && new Set(sh.log.opened).size === 5,
        '모드 지도: 셔플(5곡)은 200번 넘겨도 바로 앞 곡을 다시 열지 않는다 — 같은 주소 갈래가 아니다');
    const sh1 = makePlayer(1, 'shuf'); sh1.start();
    for(let i = 0; i < 5; i++) sh1.st._plNext();
    chk(sh1.log.opened.length === 6 && new Set(sh1.log.opened).size === 1,
        '모드 지도: 셔플(1곡)은 같은 주소를 다시 연다 — 한 곡 반복과 같은 갈래');
  }

  /* 5-2. 끝까지 재생됐는데 종료 신호만 놓친 곡 — **못 튼 곡이 아니다.**
     [제보] 「반복 재생이 중단된다」 — 감시견이 이것을 _plErrStreak 에 세서, 목록 길이만큼 쌓이면
       「재생할 수 있는 곡이 없어요」로 멈췄다. 한 곡 반복이면 매번 같은 곡이라 반드시 쌓인다.
     ★ 목록 길이 + 3 바퀴를 돌린다 — 문턱이 목록 길이라 그보다 짧게 돌리면 안 보인다. */
  for(const len of [1, 5]){
    for(const mode of ['loop', 'one', 'shuf']){
      const P = makePlayer(len, mode); P.start();
      for(let c = 0; c < len + 3 && P.playing(); c++) cycleMissedEnd(P);
      chk(P.playing() && !P.log.toasts.some(NO_TRACK),
          `끝까지 나온 곡의 신호를 ${len + 3}번 연달아 놓쳐도 재생이 안 멈춘다 — ${MODE[mode][0]} · ${len}곡`);
    }
    const P = makePlayer(len, 'off'); P.start();
    for(let c = 0; c < len + 3 && P.playing(); c++) cycleMissedEnd(P);
    chk(!P.playing() && P.log.toasts.some(t => /목록이 끝났어요/.test(t)) && !P.log.toasts.some(NO_TRACK) && P.opens() === len,
        `반복 끔 · ${len}곡: 마지막 곡까지 다 틀고 «목록이 끝났어요»로 멈춘다 («곡이 없어요»가 아니다)`);
  }

  {
    const P = makePlayer(5, 'loop'); P.start();
    cycleMissedEnd(P);
    chk(P.log.warns.some(w => /끝에서 종료 신호 놓침/.test(w)),
        '끝에서 신호를 놓쳐 넘긴 것은 콘솔에 «끝에서 종료 신호 놓침»으로 따로 남긴다 (실패와 구분)');
  }

  /* 5-3. 반대쪽 — 무한 루프 방지는 그대로 살아 있어야 한다.
     ⚠️ 5-2 를 고치려고 감시견의 셈을 통째로 빼면 여기가 깨진다(핸드오프 §1 임시 조치의 대가). */
  for(const [label, cyc] of [['신호가 한 번도 없는 곡', cycleNeverStarted], ['중간에서 굳은 곡', cycleStuckMid]]){
    for(const mode of ['loop', 'one', 'shuf']){
      const P = makePlayer(5, mode); P.start();
      for(let c = 0; c < 12 && P.playing(); c++) cyc(P);
      chk(!P.playing() && P.log.toasts.some(NO_TRACK),
          `${label}만 이어지면 목록 길이에서 멈춘다 (무한히 안 돈다) — ${MODE[mode][0]}`);
    }
  }

  /* 5-4. 같은 주소를 다시 열었는데 **페이지가 새로 안 뜨는** 갈래(핸드오프 §1 ①)를 흉내 낸다.
     첫 판은 정상으로 끝까지 나오고, 다시 연 뒤로는 영상이 끝에 선 채 하트비트만 온다.
     ⚠️ 이걸 «끝에서 신호 놓침 = 정상 종료»로 치면 멈추지는 않지만 **소리 없이 30초마다 영원히**
       같은 곡을 다시 연다. 실패로 세서 목록 길이에서 멈추고, 콘솔에 따로 남겨야 한다. */
  {
    for(const mode of ['one', 'shuf']){
      const len = mode === 'one' ? 5 : 1;       // 셔플이 같은 주소를 여는 것은 1곡일 때다(5-1)
      const P = makePlayer(len, mode); P.start();
      cycleMissedEnd(P);                          // 첫 판 — 실제로 나왔다
      for(let c = 0; c < len + 3 && P.playing(); c++){
        const before = P.opens();
        for(let i = 0; i < 12 && P.playing() && P.opens() === before; i++) P.run5(DUR, DUR);
      }
      chk(!P.playing() && P.log.toasts.some(NO_TRACK),
          `다시 연 곡이 끝에 선 채 한 번도 안 움직이면 정상 종료로 치지 않는다 — 목록 길이에서 멈춘다 (${MODE[mode][0]} · ${len}곡)`);
      chk(P.log.warns.some(w => /끝에 선 채 재생 없음/.test(w)),
          `그 경우 콘솔에 «끝에 선 채 재생 없음»으로 남긴다 — 갈래 ①의 현장 증거 (${MODE[mode][0]})`);
    }
  }
}

say('\n── 6. 곡이 바뀌는 순간 / 재생 위치가 뒤로 가는 경우');
if(CAN5){
  /* 6-1. 옛 페이지의 하트비트가 새 곡에 섞인다.
     [왜 생기나] _plOpenTrack 은 IPC 를 보내자마자 감시견을 되감는다. 그런데 새 페이지가 뜨기
       전까지 옛 페이지는 살아 있고, 끝에 선 채로 5초마다 하트비트를 보낸다. 하트비트에는 «어느
       페이지»라는 표시가 없어서, 그 한 번이 새 곡의 기준 위치를 곡 길이로 올려놓는다.
       새 곡의 위치가 그 값을 넘기 전까지는 «안 나아간다»로 읽혀 25초쯤에 잘린다.
     ★ 한 곡 반복이면 새 곡 길이 = 옛 값이라 **절대 못 넘는다.** */
  for(const mode of ['loop', 'one']){
    const P = makePlayer(5, mode); P.start();
    for(let p = 5; p <= 180; p += 5) P.run5(p, 180);
    P.feed('ended');                              // 정상 종료 → 다음(또는 같은) 곡을 연다
    const opened = P.opens(), now = P.st._plNow;
    P.beat(180, 180);                             // ← 옛 페이지가 죽기 전에 보낸 마지막 하트비트
    for(let p = 5; p <= 60; p += 5) P.run5(p, 180);   // 새 페이지가 0 부터 정상 재생
    chk(P.opens() === opened && P.st._plNow === now,
        `곡을 연 직후 옛 페이지 하트비트(끝 위치)가 섞여도 새 곡을 자르지 않는다 — ${MODE[mode][0]}`);
  }

  /* 6-2. 사람이 뒤로 감았다 — BGM 창은 늘려서 컨트롤을 만질 수 있다.
     위치가 «바뀌었다»는 것은 멈추지 않았다는 증거다. 앞으로 간 것만 세면 되감은 곡이 잘린다. */
  {
    const P = makePlayer(5, 'loop'); P.start();
    for(let p = 5; p <= 120; p += 5) P.run5(p, 180);
    const opened = P.opens();
    for(let p = 65; p <= 115; p += 5) P.run5(p, 180);  // 60초 전으로 되감고 이어서 재생
    chk(P.opens() === opened, '재생 중 뒤로 감아도 멈춤으로 읽지 않는다');
  }

  /* 6-3. 입구 분기 — 하트비트가 곡을 넘기면 안 된다(핸들러 맨 위의 hb: 거르기) */
  if(handlerCut){
    const P = makePlayer(5, 'loop'); P.start();
    for(let i = 0; i < 5; i++) P.feed('hb:' + (i * 5) + '|180|0');
    chk(P.opens() === 1, '하트비트는 곡을 넘기지 않는다 (입구에서 먼저 거른다)');
  }
}

say('');
say(fail || unknown
  ? `✗ 문제 ${fail}건${unknown ? ` · 검사 못함 ${unknown}건` : ''}`
  : `✓ 전부 통과 (${pass}항목)`);
process.exit(fail ? 1 : (unknown ? 2 : 0));
