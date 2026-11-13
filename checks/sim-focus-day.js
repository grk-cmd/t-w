/* ═══ 📆 sim-focus-day.js — 오늘 시간의 날 경계를 서버 날로 (0.13 앱 묶음 D5-3) ═══
   focus-total.js 를 가짜 계정 칸 · 가짜 시계 위에서 그대로 돌린다. 앱이 날짜를 셈하지 않고 서버가 준 날 글자(day) · 경계(dayEndsAt)를 따르는지 본다.
   ・1절: 경계 앞 · 뒤(20:59:59Z · 21:00:00Z) — 앞은 그대로 · 뒤는 오늘 시간 0 · 새 날 묻기 1번 · 같은 경계에서 되풀이 0
   ・2절: 서버 답 — 날이 같으면 이어 쌓고 · 다르면 0 · 옛 글자('2026-11-4')도 같은 날로 읽는다 · 답 전에는 계정 칸 값을 그대로 · 날 글자는 서버 값이 계정 칸에 남는다
   ・3절: 경계 뒤 새 날 답이 오기 전에 쌓은 초는 새 날로 센다 · 계정 놓기(null) 뒤엔 요청 없음
   ・4절: 앱 날짜 셈이 오늘 시간에 쓰이지 않는다(PC 시간대를 바꿔도 같다)
   ・5절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const MOD0 = ['focus-total.js', 'parts/focus/focus-total.js', 'app/parts/focus/focus-total.js'].map(read).find((v) => v != null);
if(!MOD0){ console.log('  ? 원본 못 찾음 — focus-total.js'); process.exit(2); }

const END = Date.parse('2026-11-13T21:00:00Z');   // 한국 11-14 06:00
const DAY = { day: '2026-11-13', isoWeek: '2026-W46', dayEndsAt: END };
const NEXT = { day: '2026-11-14', isoWeek: '2026-W46', dayEndsAt: END + 86400000 };

function world(src, o){
  o = o || {};
  const W = { now: END - 1000, asks: 0, store: new Map(Object.entries(o.store || {})) };
  const ctx = { window: {}, Date: { now: () => W.now }, Math, String, Number, parseFloat, isFinite, RegExp };
  new Function('window', 'Date', 'Math', 'String', 'Number', 'parseFloat', 'isFinite', 'RegExp', src + '\nwindow.__api = window.TwFocusTotal;')(ctx.window, ctx.Date, Math, String, Number, parseFloat, isFinite, RegExp);
  const store = { get: (k) => (W.store.has(k) ? W.store.get(k) : null), set: (k, v) => { W.store.set(k, String(v)); return true; } };
  W.mod = ctx.window.__api.createFocusTotal({ focusTotalStore: store });
  W.mod.onDayEnd(() => { W.asks++; });
  W.start = () => W.mod.startFocusTotal();
  return W;
}
const SEC = 'tw.focusTodaySec', DATE = 'tw.focusTodayDate';

function judge(src){
  let W;
  say('── 1. 경계 앞 · 뒤');
  W = world(src, { store: { [SEC]: '600', [DATE]: '2026-11-13' } });
  W.start(); W.mod.setServerDay(DAY);
  chk(W.mod._rolloverFocusToday() === 600 && W.asks === 0, '경계 1초 앞(20:59:59Z) — 오늘 시간 그대로 · 요청 0');
  W.mod.addFocusToday(30);
  chk(W.mod._rolloverFocusToday() === 630 && W.store.get(SEC) === '630' && W.store.get(DATE) === '2026-11-13', '  더하면 계정 칸에도(초 · 서버 날 글자)');
  W.now = END;
  chk(W.mod._rolloverFocusToday() === 0 && W.asks === 1, '★ 경계(21:00:00Z) — 오늘 시간 0 · 새 날 묻기 1번');
  chk(W.store.get(SEC) === '0' && W.store.get(DATE) === '', '  계정 칸도 0 · 날 글자는 비운다(새 날 답이 채운다)');
  W.mod._rolloverFocusToday(); W.mod.addFocusToday(5); W.now = END + 600000; W.mod._rolloverFocusToday();
  chk(W.asks === 1, '★ 같은 경계에서 되풀이 요청 0 — 답이 안 와도(실패) 다시 묻지 않는다');
  chk(W.mod._rolloverFocusToday() === 5, '  답 전에 쌓은 초는 새 날로 센다');
  W.mod.setServerDay(NEXT);
  chk(W.mod._rolloverFocusToday() === 5 && W.store.get(DATE) === '2026-11-14' && W.asks === 1, '  새 날 답 → 쌓은 5초를 지우지 않고 날 글자를 채운다');
  W.now = NEXT.dayEndsAt;
  W.mod._rolloverFocusToday();
  chk(W.asks === 2, '  다음 경계에서는 다시 한 번 묻는다');

  say('── 2. 서버 답');
  W = world(src, { store: { [SEC]: '900', [DATE]: '2026-11-13' } });
  W.start();
  chk(W.mod._rolloverFocusToday() === 900, '서버 답 전 — 계정 칸 값을 그대로');
  W.mod.setServerDay(DAY);
  chk(W.mod._rolloverFocusToday() === 900, '  같은 날 답 → 이어 쌓는다');
  W = world(src, { store: { [SEC]: '900', [DATE]: '2026-11-12' } });
  W.start(); W.mod.setServerDay(DAY);
  chk(W.mod._rolloverFocusToday() === 0 && W.store.get(DATE) === '2026-11-13' && W.store.get(SEC) === '0', '★ 다른 날 답 → 오늘 시간 0 · 날 글자를 서버 값으로');
  W = world(src, { store: { [SEC]: '900', [DATE]: '2026-11-4' } });
  W.start(); W.mod.setServerDay({ day: '2026-11-04', isoWeek: '2026-W45', dayEndsAt: END });
  chk(W.mod._rolloverFocusToday() === 900, '  옛 글자(0 채움 없음 «2026-11-4»)도 같은 날로 읽는다 — 업그레이드로 오늘치를 잃지 않는다');
  W = world(src, { store: { [SEC]: '900' } });
  W.start();
  chk(W.mod._rolloverFocusToday() === 0, '  날 글자가 없는 칸의 초는 버린다(어느 날 것인지 모른다)');
  W = world(src);
  W.mod.addFocusToday(10);
  chk(W.mod._rolloverFocusToday() === 0 && W.store.size === 0, '시작 전(계정 칸이 닫힌 때) — 쌓지도 쓰지도 않는다');

  say('── 3. 계정을 놓음');
  W = world(src, { store: { [SEC]: '10', [DATE]: '2026-11-13' } });
  W.start(); W.mod.setServerDay(DAY); W.mod.setServerDay(null); W.now = END + 5000;
  chk(W.mod.serverDay() === null && W.mod._rolloverFocusToday() === 10 && W.asks === 0, '서버 날이 null 이면 경계를 따지지 않는다 · 요청 0');

  say('── 4. 앱 날짜 셈 없음');
  W = world(src, { store: { [SEC]: '60', [DATE]: '2026-11-13' } });
  W.start(); W.mod.setServerDay(DAY);
  const tz = process.env.TZ; let same = true;
  for(const z of ['Asia/Seoul', 'America/Los_Angeles', 'Pacific/Kiritimati']){
    process.env.TZ = z;
    const V = world(src, { store: { [SEC]: '60', [DATE]: '2026-11-13' } });
    V.start(); V.mod.setServerDay(DAY);
    V.now = END - 1000; const a = V.mod._rolloverFocusToday();
    V.now = END; const b = V.mod._rolloverFocusToday();
    same = same && a === 60 && b === 0;
  }
  if(tz === undefined) delete process.env.TZ; else process.env.TZ = tz;
  chk(same, 'PC 시간대가 달라도 경계는 서버 dayEndsAt 하나(서울 · 로스앤젤레스 · 키리티마티)');
  chk(!/focusTotalStore\.get\(FOCUS_TODAY_DATE_KEY\)\s*!==\s*_focusDayStr/.test(src) && !/_focusMigrateDayKey/.test(src), '오늘 시간 쪽에 앱 날짜 셈(_focusDayStr 비교 · 6시 옮기기)이 없다');
  chk(!/_dayShifted|_focusDayStr|DAY_START_HOUR/.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')) && !('_dayShifted' in W.mod) && !('_focusDayStr' in W.mod) && !('DAY_START_HOUR' in W.mod), '앱 날짜 셈(_dayShifted · _focusDayStr · DAY_START_HOUR)이 모듈에 남아 있지 않다 — 달성표도 서버 날을 읽는다');
}

judge(MOD0);
say('── 5. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const BREAKS = [
  ['경계를 PC 시각으로', "t && Date.now() >= t.dayEndsAt", "t && new Date().getHours() >= 6"],
  ['경계를 지나도 0 으로 안 돌림', "    _focusTodaySec = 0; _day = null; _saveToday();\n", ""],
  ['경계마다 되풀이해서 물음', "&& _askedEnd !== t.dayEndsAt", ""],
  ['새 날을 안 물음', "    dayEndFns.forEach((fn) =>", "    [].forEach((fn) =>"],
  ['다른 날 답에도 이어 쌓음', "if(_day && _day !== t.day){ _focusTodaySec = 0; }", ""],
  ['옛 날 글자를 못 읽음', "return m ? m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0') : null;", "return v ? String(v) : null;"],
  ['날 글자를 계정 칸에 안 적음', "focusTotalStore.set(FOCUS_TODAY_DATE_KEY, _day || '');", ""],
  ['시작 전에도 쌓음', "if(!_focusTotalStarted || !(sec > 0)) return;", "if(!(sec > 0)) return;"],
];
quiet = true;
const res = BREAKS.map(([name, from, to]) => {
  const m2 = MOD0.includes(from) ? MOD0.replace(from, to) : null;
  qfail = 0;
  if(m2 === null) return [name, false, '바꿀 글을 못 찾음'];
  try{ judge(m2); }catch(e){ qfail++; }
  return [name, qfail > 0, ''];
});
quiet = false;
res.forEach(([name, caught, why]) => chk(caught, name + (why ? ' — ' + why : '')));
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
