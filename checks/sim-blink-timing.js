/* ═══ 👁 sim-blink-timing.js — 깜빡임 시간표 (blink-timing.js) ═══════════════
   app.js 의 scheduleBlinks · eyeClose · 좌석 blink 초기값을 parts/shared/blink-timing.js 로 묶었다(실행 화면 좌석 · 런처 미리보기가 같이 쓰게).
   ・1절: 옮기기 전 글과 같은 결과 — 같은 난수열로 2분을 돌려 예약 · 감은 정도가 한 칸도 안 다르다
   ・2절: 동작 — 처음 깜빡임 0.8~3초 · 한 번씩 2~3번 뒤 세 번 연달아(0 · 280 · 560ms) · 감은 정도 곡선 · 끝난 깜빡임 지우기
   ・3절: 주사율과 무관 — 30 · 60 · 120 · 144Hz 에서 눈 감기 시작 시각이 한 장 간격 안에서 같다
   ・4절: 연결 — app.js 에 옛 선언이 없고 TwBlinkTiming 을 부른다 · html 이 app.js 앞에 싣는다
   ・5절: 일부러 깨 보기
   [실행] blink-timing.js · app.js · desk-companion-prototype.html 이 있는 폴더에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find(Boolean);
const MOD = pick(['blink-timing.js', 'parts/shared/blink-timing.js', 'app/parts/shared/blink-timing.js']);
const APP = pick(['app.js', 'parts/app.js', 'app/parts/app.js']);
const HTML = pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']);
if(!MOD || !APP || !HTML){ say('  ? 원본 못 찾음 — blink-timing.js · app.js · desk-companion-prototype.html'); process.exit(2); }

/* 옮기기 전 app.js 의 글 그대로(Math.random 만 rand 로) — 1절의 기준 */
const OLD = `
function oldCreate(now, rand){ return {pulses:[],nextAt:now+800+rand()*2200,singles:2+Math.floor(rand()*2),closed:false}; }
function scheduleBlinks(bl,now,rand){ if(now<bl.nextAt)return;
  if(bl.singles>0){bl.pulses.push({start:now,dur:170});bl.singles--;bl.nextAt=now+1800+rand()*1900;}
  else{bl.pulses.push({start:now,dur:160});bl.pulses.push({start:now+280,dur:160});bl.pulses.push({start:now+560,dur:160});
    bl.singles=2+Math.floor(rand()*2);bl.nextAt=now+720+2400+rand()*1800;}}
function eyeClose(bl,now){let c=0;for(let i=bl.pulses.length-1;i>=0;i--){const p=bl.pulses[i],e=now-p.start;
  if(e<0)continue;if(e>p.dur){bl.pulses.splice(i,1);continue;}c=Math.max(c,Math.sin(e/p.dur*Math.PI));}return c;}
return { createBlink: oldCreate, scheduleBlinks, eyeClose };`;
const O = new Function(OLD)();

/* 같은 씨앗이면 같은 수열 */
function seeded(seed){ let x = seed >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }
function load(src){ const w = {}; new Function('window', 'module', src)(w, undefined); return w.TwBlinkTiming; }
/* hz 로 ms 동안 돌려 [감기 시작 시각들, 매 장 감은 정도] */
function run(B, hz, ms, seed){
  const r = seeded(seed); const step = 1000 / hz;
  const bl = B.createBlink(0, r); const starts = []; const cs = []; let shut = false;
  for(let t = step; t <= ms; t += step){
    B.scheduleBlinks(bl, t, r); const c = B.eyeClose(bl, t); cs.push(c);
    const s = c > 0.5; if(s && !shut) starts.push(t); shut = s;
  }
  return { starts, cs, bl };
}

function judge(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let B = null;
  try{ B = load(mod); }catch(e){ t(false, '싣기 — ' + String(e.message || e).slice(0, 80)); return r; }
  t(B && typeof B.createBlink === 'function' && typeof B.scheduleBlinks === 'function' && typeof B.eyeClose === 'function' && B.SHUT_AT === 0.5, '내놓는 이름 — createBlink · scheduleBlinks · eyeClose · SHUT_AT(0.5)');
  /* 1. 옛 글과 같은 결과 */
  let same = true;
  for(const seed of [1, 7, 42, 2026]){
    const a = run(B, 60, 120000, seed), b = run(O, 60, 120000, seed);
    if(a.cs.length !== b.cs.length || a.cs.some((c, i) => c !== b.cs[i]) || JSON.stringify(a.bl) !== JSON.stringify(b.bl)) same = false;
  }
  t(same, '1. 옮기기 전 글과 같은 결과 — 씨앗 4개 × 2분(60Hz) 감은 정도 · 남은 예약이 한 칸도 안 다르다');
  const r1 = seeded(3), r2 = seeded(3);
  t(JSON.stringify(B.createBlink(1000, r1)) === JSON.stringify(O.createBlink(1000, r2)), '1. 처음 값(createBlink)도 옛 좌석 blink 초기값과 같다');
  /* 2. 동작 */
  const lo = B.createBlink(0, () => 0), hi = B.createBlink(0, () => 0.9999);
  t(lo.nextAt === 800 && Math.round(hi.nextAt) === 3000 && lo.singles === 2 && hi.singles === 3 && !lo.closed && !lo.pulses.length, '2. 처음 깜빡임 0.8~3초 · 한 번씩 2~3번');
  const bl = { pulses: [], nextAt: 0, singles: 1, closed: false };
  B.scheduleBlinks(bl, 100, () => 0);
  t(bl.pulses.length === 1 && bl.pulses[0].dur === 170 && bl.singles === 0 && bl.nextAt === 1900, '2. 한 번 깜빡임 170ms · 다음은 1.8초 뒤부터');
  B.scheduleBlinks(bl, 1899, () => 0); t(bl.pulses.length === 1, '2. 때가 안 됐으면 예약 안 함');
  B.scheduleBlinks(bl, 1900, () => 0);
  const tri = bl.pulses.slice(1).map(p => [p.start - 1900, p.dur]);
  t(JSON.stringify(tri) === '[[0,160],[280,160],[560,160]]' && bl.singles === 2 && bl.nextAt === 1900 + 720 + 2400, '2. 한 번씩을 다 쓰면 세 번 연달아(0 · 280 · 560ms · 160ms) · 다음은 3.12초 뒤부터');
  const one = { pulses: [{ start: 0, dur: 170 }] };
  t(B.eyeClose(one, 0) === 0 && Math.abs(B.eyeClose(one, 85) - 1) < 1e-9 && one.pulses.length === 1, '2. 감은 정도 — 시작 0 · 가운데 1');
  t(B.eyeClose(one, 171) === 0 && one.pulses.length === 0, '2. 끝난 깜빡임은 지운다');
  t(B.eyeClose({ pulses: [{ start: 500, dur: 160 }] }, 100) === 0, '2. 아직 안 온 깜빡임은 0');
  /* 3. 주사율과 무관 */
  /* 예약은 «그 시각 뒤 첫 장» 에 잡히므로 깜빡임마다 한 장 안쪽만큼 늦을 수 있고 그게 쌓인다 — 그래서 시각이 아니라 깜빡임 사이 간격을 견준다 */
  const gaps = (s) => s.slice(1).map((x, i) => x - s[i]);
  const base = gaps(run(B, 1000, 60000, 11).starts);
  const HZ = [30, 60, 120, 144];
  const worst = HZ.map(hz => { const g = gaps(run(B, hz, 60000, 11).starts); const n = Math.min(g.length, base.length); return n >= base.length - 1 ? Math.max(...g.slice(0, n).map((x, i) => Math.abs(x - base[i]))) : Infinity; });
  t(base.length > 10 && worst.every((w, i) => w <= 2 * 1000 / HZ[i] + 1e-6), '3. 깜빡임 사이 간격 — 30 · 60 · 120 · 144Hz 모두 두 장 간격 안(1분 ' + (base.length + 1) + '번 · 프레임 수로 세면 주사율 따라 배로 달라진다)');
  /* 4. 연결 */
  const A = app.replace(/\/\*[\s\S]*?\*\//g, ' ');
  t(!/function\s+scheduleBlinks\b|function\s+eyeClose\b/.test(A), '4. app.js 에 옛 scheduleBlinks · eyeClose 선언이 없다(두 벌 아님)');
  t(/blink:TwBlinkTiming\.createBlink\(performance\.now\(\)\),/.test(A) && /TwBlinkTiming\.scheduleBlinks\(seat\.blink,now\); const ca=TwBlinkTiming\.eyeClose\(seat\.blink,now\);/.test(A) && /\(ca>TwBlinkTiming\.SHUT_AT\)/.test(A), '4. 좌석은 TwBlinkTiming 으로 — 처음 값 · 예약 · 감은 정도 · 감은 눈 문턱');
  t(/window\.TwBlinkTiming = api;/.test(mod), '4. 전역 이름 TwBlinkTiming(Tw 접두사)');
  const iM = html.indexOf('<script src="parts/shared/blink-timing.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, '4. html 이 blink-timing.js 를 app.js 앞에 싣는다');
  return r;
}

const rows = judge(MOD, APP, HTML);
rows.forEach(([ok, msg]) => chk(ok, msg));
say('── 5. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['한 번 깜빡임 길이가 바뀜', m => m.replace('const SINGLE_DUR_MS = 170;', 'const SINGLE_DUR_MS = 160;'), null, null],
  ['난수 부르는 차례가 바뀜', m => m.replace("return { pulses: [], nextAt: now + FIRST_MIN_MS + r() * FIRST_SPAN_MS, singles: SINGLES_MIN + Math.floor(r() * SINGLES_SPAN), closed: false };", "const sg = SINGLES_MIN + Math.floor(r() * SINGLES_SPAN); return { pulses: [], nextAt: now + FIRST_MIN_MS + r() * FIRST_SPAN_MS, singles: sg, closed: false };"), null, null],
  ['프레임 수로 셈', m => m.replace('if(now < bl.nextAt) return;', 'bl.f = (bl.f || 0) + 1; if(bl.f * 16 < bl.nextAt) return;'), null, null],
  ['app.js 에 옛 선언이 남음', null, a => a + '\nfunction eyeClose(bl,now){ return 0; }', null],
  ['좌석이 옛 문턱을 씀', null, a => a.replace('(ca>TwBlinkTiming.SHUT_AT)', '(ca>0.5)'), null],
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/shared/blink-timing.js"></script>', '')],
];
for(const [nm, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(APP) : APP, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== APP || h2 !== HTML;
  let r2; try{ r2 = judge(m2, a2, h2); }catch(_){ r2 = [[false, '던짐']]; }
  chk(changed && r2.some(([ok]) => !ok), nm + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
