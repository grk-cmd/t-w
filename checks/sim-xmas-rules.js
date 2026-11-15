/* sim-xmas-rules.js — 🎄 크리스마스 규칙(parts/xmas/xmas-rules.js · 일회성) 을 실제로 돌려 본다
   실행: node checks/run.js sim-xmas-rules
   ・1절 서버와 같은 숫자(마감 · 끝 · 트리 300 · 한마디 30 · 64px) — functions/xmas.js 를 불러 견준다
   ・2절 날짜 판정(경계) · 한마디 다듬기(서버 cleanWord 와 같은 결과)
   ・3절 장식 자리 — 300칸 · 같은 n 이면 늘 같은 자리 · 트리 층 안
   ・4절 다시 받을 그림 — 판이 «다른» 자리만(작아져도) · 기본 장식은 안 받음
   ・5절 바꾸기 간격 · 반짝임 10번 뒤 멈춤 · 10번 누르기 · 흔들기(빠른 왕복만 · 계속 흔들면 더 많이 · 멈추면 처음으로)
   ・6절 일부러 깨 보기 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const find = (c) => c.find(p => fs.existsSync(p));
const RP = find(['xmas-rules.js', 'parts/xmas/xmas-rules.js', 'app/parts/xmas/xmas-rules.js', 'apps/desktop/app/parts/xmas/xmas-rules.js']);
const SP = find(['functions/xmas.js', 'firebase/functions/xmas.js']);
if (!RP || !SP) { say('  ? 원본 못 찾음 — xmas-rules.js · functions/xmas.js'); process.exit(2); }
const R = require(path.resolve(RP));
const SV = require(path.resolve(SP));

say('── 1절 서버와 같은 숫자');
chk(R.LETTER_DEADLINE_MS === SV.LETTER_DEADLINE_MS && R.EVENT_END_MS === SV.EVENT_END_MS, '편지 마감 · 이벤트 끝 시각이 서버와 같다');
chk(R.TREE_MAX === SV.TREE_MAX && R.WORD_MAX === SV.WORD_MAX && R.IMG_PX === SV.IMG_PX, '트리 300 · 한마디 30 · 그림 64px 가 서버와 같다');
chk(R.KINDS.join() === SV.KINDS.join(), '기본 장식 종류가 서버와 같다');

say('── 2절 날짜 · 한마디');
chk(R.eventOn(R.EVENT_END_MS - 1) && !R.eventOn(R.EVENT_END_MS) && !R.eventOn(NaN), '버튼 — 1월 1일 0시 직전까지 보이고 0시부터 숨는다 · 서버 시각 모르면 숨김');
chk(R.letterOpen(R.LETTER_DEADLINE_MS - 1) && !R.letterOpen(R.LETTER_DEADLINE_MS), '편지 쓰기 — 12/25 0시 직전까지');
chk(!R.lettersArrived(R.LETTER_DEADLINE_MS - 1) && R.lettersArrived(R.LETTER_DEADLINE_MS) && !R.lettersArrived(R.EVENT_END_MS), '편지 열람 — 12/25 0시부터 1월 1일 0시 전까지');
for (const w of ['  메리\n크리스마스  ', 'a\u0007b', '', null, '   ', 'ㅋ'.repeat(40)]) chk(R.cleanWord(w) === SV.cleanWord(w), '한마디 다듬기 서버와 같음 — ' + JSON.stringify(w).slice(0, 20));

say('── 3절 장식 자리');
const P = R.slotPositions(R.TREE_MAX);
chk(P.length === R.TREE_MAX, '300칸');
chk(JSON.stringify(R.slotPositions(R.TREE_MAX)) === JSON.stringify(P), '같은 n 이면 늘 같은 자리(모든 사람 화면에서 같은 곳)');
const top = Math.max(...R.TIERS.map(t => t.y + t.h)), low = Math.min(...R.TIERS.map(t => t.y));
chk(P.every(p => p.y > low && p.y < top && Math.hypot(p.x, p.z) < 2.2), '모든 자리가 트리 층 안');
chk(new Set(P.map(p => p.x.toFixed(3) + ',' + p.y.toFixed(3) + ',' + p.z.toFixed(3))).size === P.length, '겹치는 자리 없음');
chk(R.countOf({ 0: { k: 'star' }, 3: { k: 'img' }, 5: null }) === 2 && R.countOf(null) === 0, '걸린 수 — 빈 칸 · 없음');

say('── 4절 다시 받을 그림');
const o = { 0: { k: 'img', v: 3 }, 1: { k: 'img', v: 5 }, 2: { k: 'star', v: 9 }, 4: { k: 'img', v: 1 } };
const need = R.changedImgSlots(o, { 0: 3, 1: 6, 2: 1 });
chk(need.join() === '1,4', '판이 다른 자리(작아진 1 포함) · 처음 보는 4 만 — 같은 판 0 · 기본 장식 2 는 안 받음 (' + need.join() + ')');
chk(R.changedImgSlots(o, null).join() === '0,1,4' && R.changedImgSlots(null, {}).length === 0, '사본이 없으면 그림 자리 전부 · 목록이 없으면 없음');

say('── 5절 간격 · 반짝임 · 누르기 · 흔들기');
chk(R.cooldownLeft(NaN, 1000) === 0 && R.cooldownLeft(1000, 1000 + R.HANG_COOLDOWN_MS) === 0 && R.cooldownLeft(1000, 2000) === R.HANG_COOLDOWN_MS - 1000, '바꾸기 간격 — 처음 · 지남 · 남은 ms');
const END = R.BLINK_COUNT * R.BLINK_HALF_MS;
chk(R.blinkOpacity(END) === 1 && R.blinkOpacity(END + 5000) === 1 && R.blinkOpacity(-Infinity) === 1, '반짝임 — 10번 뒤 · 아직 안 단 장식은 또렷(1)');
let dips = 0, prev = 1; for (let t = 0; t < END; t += 20){ const v = R.blinkOpacity(t); if (v < 0.65 && prev >= 0.65) dips++; prev = v; }
chk(dips === R.BLINK_COUNT, `반짝임 — 정확히 ${R.BLINK_COUNT}번 어두워졌다 밝아진다 (${dips})`);
{ const T = R.createTaps(); let fired = 0, t = 0; for (let i = 0; i < 9; i++){ if (T.tap(t += 300)) fired++; }
  chk(!fired && T.count() === 9, '9번 연달아 — 아직');
  chk(T.tap(t += 300), '  ↳ 10번째에 떨어뜨린다');
  const T2 = R.createTaps(); for (let i = 0; i < 9; i++) T2.tap(i * 300); chk(!T2.tap(9 * 300 + R.TAP_GAP_MS), '  ↳ 1.5초 넘게 쉬면 처음부터'); }
{ const S = R.createShake(); let t = 0, drops = [];
  for (let i = 0; i < 8; i++){ drops.push(S.feed(i % 2 ? -40 : 40, t += 100)); }
  chk(drops[0] === 0 && drops.slice(1).every(n => n >= 1), '빠른 왕복 — 첫 움직임은 0 · 뒤집을 때마다 떨어진다');
  chk(drops[7] > drops[1], `계속 흔들면 더 많이 (${drops.join(',')})`);
  const S2 = R.createShake(); t = 0; let slow = 0; for (let i = 0; i < 8; i++) slow += S2.feed(i % 2 ? -10 : 10, t += 100);
  chk(slow === 0, '천천히 돌리면 안 떨어진다');
  const S3 = R.createShake(); t = 0; S3.feed(40, t); S3.feed(-40, t += 100); S3.feed(40, t += 100);
  S3.feed(1, t += R.SHAKE_RESET_MS + 1);
  chk(S3.level() === 0, '잠깐 멈추면 세기가 처음으로');
  const S4 = R.createShake(); t = 0; S4.feed(40, t); chk(S4.feed(-40, t += R.SHAKE_GAP_MS) === 0, '뒤집기가 0.35초를 넘으면 왕복이 아니다'); }

say('── 6절 깨 보기');
const broken = Object.assign({}, R, { changedImgSlots: (oo, have) => Object.keys(oo).filter(s => oo[s].k === 'img' && !(have && have[s] >= oo[s].v)) });
chk(broken.changedImgSlots(o, { 1: 6 }).indexOf('1') < 0 && need.indexOf('1') >= 0, '깨 보기 — «판이 클 때만» 받으면 작아진 판(동시 바꾸기)을 놓친다 — 위 4절이 잡는 모양');

say(`\n${fail ? '✗' : '✓'} ${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
