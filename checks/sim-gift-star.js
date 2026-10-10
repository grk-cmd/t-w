/* sim-gift-star.js — 🎁 선물함 ⭐ 즐겨찾기 · 직접 삭제 검사
   실행:  node sim-gift-star.js   (app.js · mallang.js · firebase-init.js · firebase-database-rules.json 과 같은 폴더에서)

   ★ 왜 이 검사가 있는가 — 선물함은 **자동 정리**(보관 30개 초과분 삭제)가 그 계정의 어느 기기에서든 돈다.
     ⭐ 를 로컬에만 두거나, 자동 정리가 ⭐ 를 안 보면 **즐겨찾기한 선물이 조용히 지워진다.**
     되돌릴 수 없는 삭제라 화면 확인만으로는 늦다.

   ★ 무엇을 보는가
     §1 순서 · 정리 — mallang.js 의 giftOrder / giftOverflow 를 실제로 돌린다
        (⭐ 최신순 → 나머지 최신순 / 넘친 만큼 ⭐ 아닌 것 중 오래된 것부터 / ⭐ 는 절대 안 지움)
        그리고 **옛 방식(오래된 순 그대로)으로 돌리면 ⭐ 가 지워지는 것을 이 검사가 잡는가**
     §2 저장 · 규칙 — starred 가 서버에 저장되는가(로컬 키 없음) · 규칙에 starred 불리언 검증
     §3 화면 — 숫자 표시가 서브탭 줄에 있는가 · ⭐ 클릭이 칸 클릭으로 번지지 않는가 · 상한 20 · ⭐ 우클릭 삭제 막힘 ·
        확인창이 #myHomeWin 안에 붙는가 · confirm() 안 씀 */
'use strict';
const fs = require('fs'), vm = require('vm');

const say = console.log;
let fail = 0;
const chk = (ok, msg) => { if (!ok) fail++; say((ok ? '  ✓ ' : '  ✗ ') + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };

const APP = read('app.js'), ML = read('mallang.js'), FB = read('firebase-init.js');
const RULES = read('firebase-database-rules.json');
if (!APP || !ML || !FB || !RULES) { say('  ? 원본 못 찾음 — app.js · mallang.js · firebase-init.js · firebase-database-rules.json'); process.exit(2); }

/* ── §1 ── mallang.js 에서 상수·함수만 떼어 돌린다 (IIFE 전체는 DOM 이 필요하다) */
say('§1 순서 · 자동 정리');
const grab = (re, name) => { const m = ML.match(re); chk(!!m, name + ' 를 찾았다'); return m ? m[0] : ''; };
const src = [
  grab(/const GIFT_MAX = \d+;/, 'GIFT_MAX'),
  grab(/const GIFT_STAR_MAX = \d+;/, 'GIFT_STAR_MAX'),
  grab(/const _isStar = [^\n]*/, '_isStar'),
  grab(/function giftOrder\([\s\S]*?\n  \}/, 'giftOrder()'),
  grab(/function giftOverflow\([\s\S]*?\n  \}/, 'giftOverflow()'),
].join('\n') + '\n;({ GIFT_MAX, GIFT_STAR_MAX, giftOrder, giftOverflow })';
let M = null;
try { M = vm.runInNewContext(src, {}); } catch (e) { chk(false, '떼어 낸 코드가 돈다 — ' + e.message); }

if (M) {
  chk(M.GIFT_STAR_MAX < M.GIFT_MAX, '⭐ 상한(' + M.GIFT_STAR_MAX + ') < 보관 한도(' + M.GIFT_MAX + ') — 자동 정리가 늘 지울 칸을 찾는다');
  chk(M.GIFT_STAR_MAX === 20, '⭐ 상한이 20이다 (사양)');

  // 31개: g0(가장 오래됨) … g30(최신). g0·g1·g5 가 ⭐
  const gifts = {};
  for (let i = 0; i <= 30; i++) gifts['g' + i] = { imgUrl: 'x', ts: 1000 + i };
  for (const k of ['g0', 'g1', 'g5']) gifts[k].starred = true;

  const order = M.giftOrder(gifts);
  chk(order.slice(0, 3).join() === 'g5,g1,g0', '⭐ 가 맨 앞, 그 안에서 최신순 (' + order.slice(0, 3).join() + ')');
  chk(order[3] === 'g30' && order[order.length - 1] === 'g2', '나머지는 최신순, 마지막 칸 = ⭐ 아닌 것 중 가장 오래된 것 (' + order[order.length - 1] + ')');

  const drop = M.giftOverflow(gifts);
  chk(drop.length === 1 && drop[0] === 'g2', '31개 → ⭐ 아닌 것 중 가장 오래된 g2 하나만 지운다 (' + drop.join() + ')');
  chk(drop.every(k => !gifts[k].starred), '⭐ 는 지울 목록에 없다');
  chk(drop[0] === order[order.length - 1], '정렬 마지막 칸(설명에 「먼저 지워져요」) = 실제로 지워지는 칸');

  const few = {}; for (let i = 0; i < 30; i++) few['h' + i] = { ts: i };
  chk(M.giftOverflow(few).length === 0, '30개 이하면 아무것도 안 지운다');
  const legacy = { a: { ts: 1, starred: 'yes' }, b: { ts: 2 } };
  chk(M.giftOrder(legacy)[0] === 'b', 'starred 가 true 가 아닌 값이면 ⭐ 로 치지 않는다');

  say('· 일부러 옛 방식(오래된 순 그대로)으로 돌리면 — 이 검사가 잡는가');
  const oldWay = Object.keys(gifts).sort((a, b) => gifts[a].ts - gifts[b].ts).slice(0, Object.keys(gifts).length - M.GIFT_MAX);
  chk(oldWay[0] === 'g0' && gifts[oldWay[0]].starred, '★ 옛 방식이면 ⭐ g0 가 지워진다 — 위 검사가 그 차이를 가른다');

  chk(/const drop = giftOverflow\(gifts\)/.test(ML), 'loadGifts 의 자동 정리가 giftOverflow 를 쓴다');
  chk(!/byOld\.slice\(0, ids\.length - GIFT_MAX\)/.test(ML), '옛 「오래된 순 그대로 자르기」 가 남아 있지 않다');
}

/* ── §2 ── */
say('§2 저장 · 규칙');
chk(/async setMallangGiftStarred\(userId, giftId, on\)[\s\S]{0,200}mallangGifts\/\$\{giftId\}\/starred/.test(FB),
  'firebase-init: setMallangGiftStarred 가 users/{코드}/mallangGifts/{id}/starred 에 쓴다');
chk(!/localStorage[^\n]*[Ss]tar/.test(ML) && !/localStorage[^\n]*[Ss]tar/.test(APP.slice(APP.indexOf('function _giftBoxPaint'), APP.indexOf('function _mhAsk'))),
  '⭐ 를 localStorage 에 두지 않는다 (다른 기기 자동 정리가 모르고 지운다)');
let rules = null; try { rules = JSON.parse(RULES); } catch (_) {}
const gv = rules && rules.rules && rules.rules.users && rules.rules.users.$userId
  && rules.rules.users.$userId.mallangGifts && rules.rules.users.$userId.mallangGifts.$giftId
  && rules.rules.users.$userId.mallangGifts.$giftId['.validate'];
chk(!!gv && gv.includes("(!newData.child('starred').exists() || newData.child('starred').isBoolean())"),
  "규칙 mallangGifts/$giftId .validate 에 starred 불리언 검증");

/* ── §3 ── */
say('§3 화면');
const paint = APP.slice(APP.indexOf('function _giftBoxPaint'), APP.indexOf('function _mhAsk'));
const ask = APP.slice(APP.indexOf('function _mhAsk'), APP.indexOf('function renderInbox'));
chk(paint.length > 0 && ask.length > 0, '_giftBoxPaint · _mhAsk 를 찾았다');
chk(/closest\('\.gift-star'\)\)\{\s*ev\.stopPropagation\(\)/.test(paint), '⭐ 클릭은 stopPropagation 후 칸 클릭(다시 불러오기)으로 안 간다');
chk(/starN >= lim\.starMax[\s\S]{0,60}즐겨찾기는 '\+lim\.starMax\+'개까지예요/.test(paint), '⭐ 상한 초과 시 토스트');
chk(/g\.starred === true\)\{\s*_mhAsk\([^)]*⭐를 먼저 풀어 주세요/.test(paint), '⭐ 칸 우클릭은 삭제 대신 안내');
chk(/_mallangDeleteGift/.test(paint) && /if\(_isStar\(gift\)\) return 'starred'/.test(ML), '삭제 함수도 ⭐ 를 한 번 더 막는다');
chk(/_giftStat\('⭐ '\+starN\+'\/'\+lim\.starMax\+' · 보관 '\+keys\.length\+'\/'\+lim\.max/.test(paint), '「⭐ n/20 · 보관 m/30」 표시');
const HTML = read('desk-companion-prototype.html') || '';
const fmTabs = (HTML.match(/<div id="mhFmTabs">[\s\S]*?<\/div>/) || [''])[0];
chk(/id="mhGiftStat"/.test(fmTabs), '그 표시는 서브탭 줄(#mhFmTabs) 안에 있다 — 격자 위에 줄을 더하면 스크롤이 생긴다');
/* renderFriendManage 는 parts/friend-manage.js 로 옮겼다(앱 FSD 5번). */
chk(/function renderFriendManage\(\)\{\s*if\(_fmTab !== 'gift'\) _giftStat\(''\)/.test(read('friend-manage.js') || ''),'다른 서브탭으로 가면 표시를 비운다');
chk(/getElementById\('myHomeWin'\)/.test(ask) && /win\.appendChild\(ov\)/.test(ask) && !/document\.body\.appendChild/.test(ask),
  '확인창은 #myHomeWin 의 자식 (body 로 빼면 run 모드에서 클릭이 뚫린다)');
const noComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
chk(!/\bconfirm\(/.test(noComments(paint + ask)), 'confirm() 을 쓰지 않는다 (주석 제외)');
chk(/escHtml\(text\)/.test(ask) && /escHtml\(title\)/.test(ask), '확인창 문구는 escHtml 을 거친다 (fromName 은 친구가 정한 문자열)');
chk(/live = live\.filter\(x=>!\(x\.gift && x\.gift\.giftId===giftId\)\)/.test(ML) && /h\.delete\(giftId\)/.test(ML),
  '삭제 시 마이홈 live 목록 · 로컬 치움 목록에서도 뺀다');

say('');
say(fail ? '문제 ' + fail + '건' : '전부 통과 ✅ — ⭐ 는 서버에 남고, 자동 정리·우클릭 어느 쪽으로도 지워지지 않는다');
process.exit(fail ? 1 : 0);
