/* sim-focus-sync.js — 🕒 포커스 누적 기기 간 동기화 검증기 (증분 + max 바닥)
   실행:  node sim-focus-sync.js   (app.js · smoke.js 와 같은 폴더에서)

   ★ 무엇을 보는가 — 이 병합식이 두 사고를 **동시에** 막는지 본다.
         새 서버값 = max(서버값 + 증분, 이 기기의 로컬 누적치)
       (ㄱ) 뒤처진 기기에서 한 작업이 증발하지 않는다 (증분 항)
            a=8h, b=2h 에서 연동이 안 따라와 b 로 4시간 일함 → a 로 가면 12h 여야 한다.
            max 만 쓰면 8h 가 이겨서 그 4시간이 사라진다.
       (ㄴ) 마크가 어긋나도 레벨이 깎이지 않는다 (max 바닥 항)
            마크가 없는/틀어진 기기여도 최소한 큰 쪽은 따라온다.
     서버는 HTML 의 syncFocusTotal 과 **같은 식**으로 흉내 낸다. 둘이 어긋나면 이 파일이
     거짓말을 하게 되므로, HTML 을 고치면 여기 SERVER 도 같이 고칠 것.
   ⚠ smoke.js 의 스텁을 빌려 쓴다 — 같은 폴더에 있어야 한다. */
'use strict';
const fs = require('fs'), vm = require('vm');

let smokeSrc = fs.readFileSync('smoke.js', 'utf8');
smokeSrc = smokeSrc.slice(0, smokeSrc.indexOf('/* ── 실행'))
  .split('\n').filter(l => !/require\(|const FILE =|if \(!FILE\)|process\.exit/.test(l)).join('\n');
vm.runInThisContext(smokeSrc, { filename: 'smoke-stubs.js' });

const realST = require('timers').setTimeout;
globalThis.setTimeout  = (fn, ms) => realST(fn, ms || 0);
globalThis.setInterval = () => 0;                       // 주기 타이머는 여기선 안 돌린다
globalThis.clearTimeout = require('timers').clearTimeout;

/* ── 서버 흉내 — HTML syncFocusTotal 과 같은 식 ── */
const CAP = 999 * 3600;
const SERVER = { totalSec: 0 };
let calls = 0, writes = 0, failNext = false;
globalThis.window.firebaseAPI = {
  async syncFocusTotal(uid, addSec, baselineSec){
    calls++;
    if (failNext) return { ok: false, reason: 'permission_denied' };
    const pre = SERVER.totalSec;
    const delta = Math.max(0, Math.floor(Number(addSec) || 0));
    const bn = Number(baselineSec);
    const baseline = (isFinite(bn) && bn >= 0) ? Math.min(CAP, Math.floor(bn)) : 0;
    const want = Math.min(CAP, Math.max(pre + delta, baseline));
    if (want <= pre) return { ok: true, totalSec: pre };   // 쓰기 없음
    SERVER.totalSec = want; writes++;
    return { ok: true, totalSec: want };
  },
  setMyProfile(){}, sendInboxMessage(){ return Promise.resolve(); },
};

const probe = `
;globalThis.__P = {
  sync: syncFocusTotalToServer,
  get total(){ return _focusTotalSec; },
  set total(v){ _focusTotalSec = v; },
  level: getFocusLevel,
  MARK: FOCUS_SYNCED_KEY,
};`;

const say = console.log; console.log = () => {}; console.warn = () => {};
try { vm.runInThisContext(fs.readFileSync('app.js', 'utf8') + probe, { filename: 'app.js' }); }
catch (e) { console.log = say; say('✗ app.js 평가 실패: ' + (e && e.stack || e)); process.exit(1); }
console.log = say;

const P = globalThis.__P, LS = globalThis.localStorage;
let fail = 0;
const chk = (c, m) => { say((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };
const H = 3600, h = n => (n / H) + 'h';

/* 기기 하나를 흉내 낸다 — 로컬 누적치와 마크가 곧 기기의 정체성이다.
   mark===null 이면 '이 기기는 서버와 한 번도 안 맞춰봤다'(마크 키 자체가 없음). */
function device(localSec, mark){
  P.total = localSec;
  if (mark === null || mark === undefined) LS.removeItem(P.MARK);
  else LS.setItem(P.MARK, String(mark));
}
const markNow = () => parseFloat(LS.getItem(P.MARK));

(async () => {
  say('=== 🕒 포커스 누적 동기화 — 증분 + max 바닥 ===');
  say('');

  /* ══ 1. 뒤처진 기기에서 한 작업이 살아남는가 (증분 항) ══ */
  say('【1】 연동이 안 따라온 기기에서 일한 시간');
  SERVER.totalSec = 8 * H;
  say('  · 서버 8h · b기기는 2h 에서 마크가 멈춘 채 4시간을 더 일해 6h');
  device(6 * H, 2 * H);
  await P.sync('sim');
  chk(SERVER.totalSec === 12 * H, '★ 서버가 8+4=12h 가 된다 (' + h(SERVER.totalSec) + ') — max 만이면 8h 로 사라졌다');
  chk(P.total === 12 * H, 'b기기도 12h 를 받는다 (' + h(P.total) + ')');
  say('  · a기기(로컬 8h, 마크 8h)로 이동');
  device(8 * H, 8 * H);
  await P.sync('sim');
  chk(P.total === 12 * H, '★ a기기가 12h 를 따라온다 (' + h(P.total) + ')');
  chk(P.level() === 13, '레벨 13 (' + P.level() + ')');
  say('');

  /* ══ 2. 원래 제보 시나리오 ══ */
  say('【2】 제보 시나리오 — a 4h → b +2h → 다시 a');
  SERVER.totalSec = 0;
  device(4 * H, null);                       // a: 첫 동기화(마크 없음)
  await P.sync('sim');
  chk(SERVER.totalSec === 4 * H, '서버 4h (' + h(SERVER.totalSec) + ')');
  device(6 * H, 4 * H);                      // b: 4h 를 물려받아 2시간 더
  await P.sync('sim');
  chk(SERVER.totalSec === 6 * H, '서버 6h (' + h(SERVER.totalSec) + ')');
  device(4 * H, 4 * H);                      // 다시 a
  await P.sync('sim');
  chk(P.total === 6 * H, '★ a기기가 6h 를 따라온다 (' + h(P.total) + ')');
  say('');

  /* ══ 3. 마크 없는 기기는 통째로 증분되지 않는다(두 배 사고 방지) ══ */
  say('【3】 서버와 한 번도 안 맞춰본 기기가 접속');
  SERVER.totalSec = 10 * H;
  device(10 * H, null);                      // 연동으로 10h 를 물려받았지만 마크는 없음
  await P.sync('sim');
  chk(SERVER.totalSec === 10 * H, '★ 20h 로 불어나지 않는다 (' + h(SERVER.totalSec) + ')');
  chk(markNow() === 10 * H, '마크가 생긴다 (' + h(markNow()) + ')');
  say('  · 그 기기가 로컬에만 15h 를 갖고 있었다면');
  SERVER.totalSec = 10 * H;
  device(15 * H, null);
  await P.sync('sim');
  chk(SERVER.totalSec === 15 * H, '★ max 바닥이 서버를 15h 로 끌어올린다 (' + h(SERVER.totalSec) + ')');
  say('');

  /* ══ 4. 멱등성 — 같은 값으로 계속 돌려도 안 부푼다 ══ */
  say('【4】 연속 동기화');
  const wBefore = writes;
  for (let i = 0; i < 5; i++) await P.sync('sim');
  chk(SERVER.totalSec === 15 * H && P.total === 15 * H, '15h 에서 안 움직인다 (' + h(P.total) + ')');
  chk(writes === wBefore, '쓰기 0회 — 올릴 게 없으면 읽기로 끝난다');
  say('');

  /* ══ 5. 왕복 중 쌓인 시간이 증발하지 않는가 ══ */
  say('【5】 동기화 왕복 중에도 일하고 있었다면');
  SERVER.totalSec = 100; device(100, 100);
  const keep = globalThis.window.firebaseAPI.syncFocusTotal;
  globalThis.window.firebaseAPI.syncFocusTotal = async (u, a, b) => {
    P.total = P.total + 30;                  // 왕복 사이에 30초를 더 일했다
    return keep(u, a, b);
  };
  await P.sync('sim');
  globalThis.window.firebaseAPI.syncFocusTotal = keep;
  chk(markNow() === 100, '★ 마크가 130 이 아니라 100 에 남는다 (' + markNow() + ') — 30초가 다음 증분으로 살아남는다');
  await P.sync('sim');
  chk(SERVER.totalSec === 130, '다음 동기화에서 30초가 올라간다 (' + SERVER.totalSec + '초)');
  say('');

  /* ══ 6. 실패해도 아무것도 안 망가진다 ══ */
  say('【6】 서버가 거부할 때');
  SERVER.totalSec = 5 * H; device(9 * H, 5 * H);
  failNext = true;
  await P.sync('sim');
  failNext = false;
  chk(P.total === 9 * H, '로컬 값 그대로 (' + h(P.total) + ')');
  chk(markNow() === 5 * H, '★ 마크도 안 옮긴다 — 같은 증분을 다음에 다시 시도한다 (' + h(markNow()) + ')');
  await P.sync('sim');
  chk(SERVER.totalSec === 9 * H, '연결이 돌아오면 5+4=9h 가 올라간다 (' + h(SERVER.totalSec) + ')');
  say('');

  /* ══ 7. 999시간 상한 ══ */
  say('【7】 레벨 상한');
  SERVER.totalSec = 998 * H; device(998 * H, 990 * H);   // 증분 8h
  await P.sync('sim');
  chk(SERVER.totalSec === CAP, '999시간에서 멈춘다 (' + h(SERVER.totalSec) + ')');

  say('');
  say('서버 호출 ' + calls + '회 · 그중 쓰기 ' + writes + '회');
  if (fail) { say('문제 ' + fail + '건'); process.exit(1); }
  say('전부 통과 ✅');
  process.exit(0);
})().catch(e => { say('✗ 실험 자체가 죽음: ' + (e && e.stack || e)); process.exit(1); });
