/* sim-xmas-rules.js — 🎄 크리스마스 규칙(parts/xmas/xmas-rules.js · 일회성) 을 실제로 돌려 본다
   실행: node checks/run.js sim-xmas-rules
   ・1절 서버와 같은 숫자(마감 · 끝 · 트리 300 · 한마디 30 · 64px) — functions/xmas.js 를 불러 견준다
   ・2절 날짜 판정(경계) · 한마디 다듬기(서버 cleanWord 와 같은 결과)
   ・3절 장식 자리 — 300칸 · 같은 n 이면 늘 같은 자리 · 트리 층 안
   ・4절 다시 받을 그림 — 판이 «다른» 자리만(작아져도) · 기본 장식은 안 받음
   ・5절 바꾸기 간격 · 반짝임 10번 뒤 멈춤 · 10번 누르기 · 흔들기(빠른 왕복만 · 계속 흔들면 더 많이 · 멈추면 처음으로)
   ・6절 일부러 깨 보기
   ・7절 편지 — 반송 사유 · 상한이 서버와 같다 · 내 편지함 · 반송 · 받은 편지 다듬기(모양이 틀린 칸은 뺀다) · 빈 칸 · 마감 D-day(한국 날짜) · 읽음 표시 */
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

say('── 7절 편지');
chk(JSON.stringify(R.RETURN_REASONS) === JSON.stringify(SV.RETURN_REASONS), '반송 사유 표가 서버와 같다 — ' + Object.values(R.RETURN_REASONS).join(' · '));
chk(R.LETTER_IDS.join() === 'l1,l2,l3,l4,l5' && R.LETTER_MAX === 5 && R.LETTER_TEXT_MAX === 500 && R.SONG_TITLE_MAX === 40, '편지 칸 l1~l5 · 500자 · 곡 제목 40자(규칙 xmasLetters 와 같음)');
{
  const lettersSrv = { u1: { l1: { text: 'A' }, l9: { text: 'B' } }, u2: { l2: { text: 'C', song: { id: 'abcdefghijk', title: 'T' } } } };
  const sv = SV.lettersOf(lettersSrv);
  const mine = R.myLettersOf(lettersSrv.u2);
  chk(sv.length === 2 && mine.length === 1 && mine[0].song.id === sv.find(x => x.from === 'u2').song.id, '칸 이름 · 곡 모양을 서버 lettersOf 와 같게 본다(l9 는 양쪽 다 버림)');
}
const box = { l3: { text: '셋째', ts: 3 }, l1: { text: '첫째\n둘째 줄', ts: 1, song: { id: 'abcdefghijk', title: 'x'.repeat(60) } }, l2: { text: '' }, l6: { text: '없는 칸' }, l4: { ts: 4 } };
const ML = R.myLettersOf(box);
chk(ML.map(l => l.lid).join() === 'l1,l3' && ML[0].song.title.length === 40, '내 편지함 — 칸 순서 · 빈 글 · 없는 칸 · 글 없는 칸은 뺀다 · 곡 제목 40자 (' + ML.map(l => l.lid).join() + ')');
chk(R.myLettersOf(null).length === 0 && R.songOf({ id: 'short' }) === null && R.songOf({ id: 'abcdefghijk' }).title === '' && R.songOf('x') === null, '없음 · 틀린 곡 id · 제목 없는 곡');
chk(R.freeLetterId(ML) === 'l2' && R.freeLetterId([]) === 'l1' && R.freeLetterId(R.LETTER_IDS.map(lid => ({ lid }))) === null, '빈 칸 — 앞에서부터 · 다섯 통이면 null');
const RT = R.returnedOf({ l2: { reason: 'etc', note: '번호가 있어요', text: '내 번호 010', ts: 5 }, l4: { reason: 'abuse', text: '나쁜 말' }, l5: { reason: '모름', text: 'x' }, l1: { reason: 'spam' } });
chk(RT.map(r => r.lid).join() === 'l2,l4,l5' && RT[0].why === '기타 — 번호가 있어요' && RT[1].why === '욕설 · 비방' && RT[2].why === '기타', '반송 — 보여 줄 사유(기타는 적은 말까지) · 모르는 사유는 기타 · 글 없는 칸은 뺀다');
chk(SV.returnBody('etc', '번호가 있어요').indexOf('사유: ' + RT[0].why) === 0, '  ↳ 알림함 본문(서버 returnBody)과 같은 사유 글');
const G = R.gotOf({ 2: { text: '둘' }, 1: { text: '하나', song: { id: 'abcdefghijk' } }, x: { text: '?' }, 3: { song: {} }, 0: { text: '영' } });
chk(G.map(g => g.n).join() === '1,2' && G[0].song.id === 'abcdefghijk' && G[1].song === null, '받은 편지 — 번호 순 · 틀린 번호 · 글 없는 칸은 뺀다');
const kst = (s) => Date.parse(s + '+09:00');
chk(R.ddayLeft(kst('2026-12-15T00:00:00')) === 9 && R.ddayLeft(kst('2026-12-15T23:59:59')) === 9 && R.ddayLeft(kst('2026-12-24T00:00:00')) === 0 && R.ddayLeft(kst('2026-12-24T23:59:59')) === 0,
  '마감 D-day — 한국 날짜로(12/15 은 하루 내내 D-9 · 12/24 은 D-0)');
chk(R.ddayLeft(R.LETTER_DEADLINE_MS) === -1 && R.ddayLeft(NaN) === -1, '  ↳ 마감 뒤 · 시각 모름은 -1');
const RS = R.readSetOf('3,1,x,,0,1');
chk([...RS].sort().join() === '1,3' && R.readSetStr(RS) === '1,3' && R.readSetOf(null).size === 0, '읽음 표시 — 번호만 · 겹침 없이');
chk(R.hasUnread(G, new Set([1])) && !R.hasUnread(G, new Set([1, 2])) && !R.hasUnread([], new Set()), '안 읽은 편지가 있을 때만 빨간 점');
chk(R.cleanLetter('  안녕\r\n잘 지내요  ') === '안녕\n잘 지내요' && R.cleanLetter('가'.repeat(600)).length === 500 && R.cleanLetter('   ') === '', '편지 다듬기 — 앞뒤 공백 · 줄바꿈 하나로 · 500자');
{ // 깨 보기 — ddayLeft 를 «남은 ms 를 하루로 올림» 으로 쓰면 12/15 낮에 D-10 이 된다(시안 · 한국 날짜와 다름)
  const bad = (now) => Math.ceil((R.LETTER_DEADLINE_MS - now) / 86400000);
  chk(bad(kst('2026-12-15T10:00:00')) !== R.ddayLeft(kst('2026-12-15T10:00:00')), '깨 보기 — ms 를 올림하면 날짜 경계가 어긋난다(위 검사가 잡는 모양)');
}

say(`\n${fail ? '✗' : '✓'} ${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
