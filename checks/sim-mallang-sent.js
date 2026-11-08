/* ═══ 🎁 sim-mallang-sent.js — 보낸 말랑이 확인(B-1015-1) ═══════════════════════════════
   ・1절: 규칙(mallang-sent.js) — 기록 모양 씻기 · 최근 순서 · 30개 넘는 옛 기록 · 같은 친구에게 같은 그림을 보낸 적 · 깨 보기
   ・2절: 서버 규칙 — users/$uid/mallangSent 는 주인만 · to · src · ts 가 있어야 · 그림 주소는 Firebase Storage 만 · 다른 칸 거절
   ・3절: 보내기 화면(mallang.js) — 보낸 기록을 같이 읽는다 · 이미 보낸 그림에 «보냄» · 누르면 묻고 [또 보내기] 뒤에 보낸다 · 보낸 뒤 기록 + 넘는 것 지우기
   ・4절: 💝 선물함 › 보낸 선물(myhome-inbox.js) — 맨 위 두 칸 · 최근 30개 · 받은 친구 · 메시지 · 못 읽음 · 빈 목록 · 남이 정한 글자는 씻는다
   [실행] node checks/run.js mallang-sent */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const find = (names) => { for(const d of [__dirname, process.cwd()]) for(const n of names){ const p = path.join(d, n); if(fs.existsSync(p)) return p; } return null; };
const read = (names) => { const p = find(names); return p ? fs.readFileSync(p, 'utf8') : null; };
const P_MS = find(['mallang-sent.js', 'parts/myhome/mallang-sent.js']);
const SRC = {
  mallang: read(['mallang.js', 'parts/myhome/mallang.js']), inbox: read(['myhome-inbox.js', 'parts/myhome/myhome-inbox.js']),
  rules: read(['firebase-database-rules.json', 'firebase/firebase-database-rules.json']), fb: read(['firebase-init.js', 'parts/firebase-init.js']),
  html: read(['desk-companion-prototype.html']),
};
if(!P_MS || Object.values(SRC).some(v => v == null)){ say('  ? 원본 못 찾음 — mallang-sent.js · ' + Object.keys(SRC).filter(k => SRC[k] == null).join(' · ')); process.exit(2); }
const MS = require(P_MS);
const MS_SRC = fs.readFileSync(P_MS, 'utf8');
const ST = 'https://firebasestorage.googleapis.com/v0/b/x/o/';
const U = 'uabcdef1234';

say('── 1. 규칙');
chk(JSON.stringify(MS.record({ to: U, toName: '  민트 ', src: ST + 'a', img: ST + 'g', ts: 5, msg: ' 안녕 ' })) === JSON.stringify({ to: U, src: ST + 'a', ts: 5, toName: '민트', img: ST + 'g', msg: '안녕' }),
  '기록 모양 — to · src · ts + 이름 · 그림 · 메시지(앞뒤 빈칸 뗌)');
chk(MS.record({ to: 'evil', src: ST + 'a', ts: 5 }) === null && MS.record({ to: U, src: 'https://evil.com/a.png', ts: 5 }) === null && MS.record({ to: U, src: ST + 'a', ts: 0 }) === null
  && !('img' in MS.record({ to: U, src: ST + 'a', img: 'data:x', ts: 1 })), '★ 친구 코드 · 그림 주소(Storage 만) · 시각이 안 맞으면 남기지 않는다 — 사본 주소가 이상하면 그림만 뺀다');
chk(MS.record({ to: U, src: ST, ts: 1, toName: 'x'.repeat(30), msg: 'y'.repeat(80) }).toName.length === 20 && MS.record({ to: U, src: ST, ts: 1, msg: 'y'.repeat(80) }).msg.length === 50, '이름 20자 · 메시지 50자(서버 규칙과 같다)');
const many = {}; for(let i = 1; i <= 33; i++) many['g' + i] = { to: U, src: ST + (i % 3), ts: i };
many.bad = { to: 'x' };
chk(MS.list(many).length === 33 && MS.list(many)[0].id === 'g33' && MS.list(null).length === 0, '최근 것부터 · 깨진 줄은 뺀다 · 없음은 빈 목록');
chk(JSON.stringify(MS.overflow(many)) === '["g3","g2","g1"]' && MS.overflow({}).length === 0 && MS.SENT_MAX === 30, '★ 30개를 넘는 옛 기록 셋 — 보낸 뒤 지울 것');
chk(MS.lastTo(many, U, ST + '1').id === 'g31' && MS.lastTo(many, 'uzzzzzzzz9', ST + '1') === null && MS.lastTo(null, U, ST + '1') === null && MS.lastTo(many, U, '') === null,
  '★ 같은 친구 · 같은 그림의 가장 최근 기록 · 다른 친구 · 못 읽음(null)은 없음');
{ const broke = MS_SRC.replace('return list(obj).find(r => r.to === to && r.src === src) || null;', 'return list(obj).find(r => r.src === src) || null;');
  const m = { exports: {} }; new Function('module', 'window', broke)(m, undefined);
  chk(broke !== MS_SRC && m.exports.lastTo(many, 'uzzzzzzzz9', ST + '1') !== null, '  깨 보기 — 친구를 안 가르면 다른 친구에게 보낸 그림도 «보냄» 이 된다'); }

say('── 2. 서버 규칙');
{
  const R = JSON.parse(SRC.rules).rules.users.$userId.mallangSent || {}, g = R.$giftId || {};
  chk(/userAuth/.test(R['.write'] || '') && /hasChildren\(\['to', 'src', 'ts'\]\)/.test(g['.validate'] || '') && /\[uU\]\[0-9a-zA-Z\]\{8,40\}/.test((g.to || {})['.validate'] || ''),
    '주인만 쓰기 · to · src · ts 가 있어야 · to 는 친구 코드 모양');
  chk(['src', 'img'].every(k => /beginsWith\('https:\/\/firebasestorage\.googleapis\.com\/'\)/.test((g[k] || {})['.validate'] || '')) && /<= 20/.test((g.toName || {})['.validate'] || '')
    && /<= 50/.test((g.msg || {})['.validate'] || '') && (g.$other || {})['.validate'] === false, '그림 주소는 Storage 만 · 이름 20 · 메시지 50 · 다른 칸 거절');
  chk(/getMallangSent: \(uid\) => get\(ref\(db, `users\/\$\{uid\}\/mallangSent`\)\)/.test(SRC.fb) && /addMallangSent: \(uid, giftId, rec, dropIds\) => update\(ref\(db, `users\/\$\{uid\}\/mallangSent`\)/.test(SRC.fb)
    && /return \{ ok:true, giftId, imgUrl:snapUrl \};/.test(SRC.fb), '서버 함수 — 읽기(못 읽으면 null) · 쓰기와 옛 기록 지우기를 한 번에 · 보내기가 선물 id · 사본 주소를 돌려준다');
}

/* ── 가짜 DOM ── */
function mkEl(tag){
  const L = {}, cls = new Set(), o = { tagName: tag, children: [], style: {}, className: '', textContent: '', value: '', attrs: {}, dataset: {},
    classList: { add: c => cls.add(c), contains: c => cls.has(c) }, setAttribute: (k, v) => { o.attrs[k] = v; },
    addEventListener: (t, fn) => { (L[t] = L[t] || []).push(fn); }, click(){ return Promise.all((L.click || []).map(fn => fn({}))); },
    appendChild(c){ o.children.push(c); c.parent = o; return c; }, remove(){ o.removed = true; },
    querySelector(sel){ return o._q[sel] || (o._q[sel] = mkEl('q')); }, _q: {}, querySelectorAll: () => [] };
  return o;
}

(async () => {
say('── 3. 보내기 화면(mallang.js)');
{
  const B0 = SRC.mallang.indexOf('function _askAgain('), B1 = SRC.mallang.indexOf('  function injectGiftStyle(');
  const body = SRC.mallang.slice(B0, B1);
  const sends = [], recs = [], toasts = [];
  const win = mkEl('win');
  const ctx = {
    TwMallangSent: MS, TwSafeHtml: { safeUrl: (u) => u }, TwImgRetry: { retryOnError: (i) => i },
    document: { getElementById: () => null, createElement: (t) => mkEl(t), head: mkEl('head') },
    homeWin: () => win, esc: (s) => String(s), toast: (m) => toasts.push(m), getDisplayName: () => '나', myId: () => 'umeeeeeeee1', todayStr: () => '2026-11-08',
    DAILY_LIMIT: 10, GIFT_SEND_CAP: 30, MSG_MAX: 50, injectGiftStyle: () => {},
    firebaseAPI: { sendMallangGift: async (...a) => { sends.push(a); return { ok: true, giftId: 'gNEW', imgUrl: ST + 'snap' }; },
      addMallangSent: async (...a) => { recs.push(a); return true; } },
  };
  const f = new Function(...Object.keys(ctx), body + '\nreturn { buildGiftPopup, _askAgain, _recordSent };')(...Object.values(ctx));
  const sent = { g1: { to: U, src: ST + 'a', ts: Date.UTC(2026, 10, 5, 3) } };
  f.buildGiftPopup(U, '민트', [{ url: ST + 'a' }, { url: ST + 'b' }], 0, 3, sent);
  const pop = win.children[win.children.length - 1], grid = pop.querySelector('#mlGiftGrid'), again = pop.querySelector('#mlGiftAgain');
  const cA = grid.children[0], cB = grid.children[1];
  chk(cA.children.some(c => c.className === 'ml-sent' && c.textContent === '보냄') && !cB.children.some(c => c.className === 'ml-sent'), '이미 보낸 그림에만 «보냄»');
  await cA.click();
  chk(sends.length === 0 && again.style.display === 'block' && /이미 보낸 말랑이예요/.test(again.innerHTML) && /11-05/.test(again.innerHTML), '★ 누르면 보내지 않고 «이미 보낸 말랑이예요 — 그래도 또 보낼까요?»(보낸 날)');
  /* [또 보내기] — 묻는 칸의 버튼을 흉내 낸다 */
  const go = again._q['[data-a="go"]'];
  go.onclick(); await new Promise(r => setImmediate(r));
  chk(sends.length === 1 && sends[0][3] === ST + 'a', '[또 보내기] 를 누르면 그때 보낸다(막지 않는다)');
  await new Promise(r => setImmediate(r));
  chk(recs.length === 1 && recs[0][0] === 'umeeeeeeee1' && recs[0][1] === 'gNEW' && recs[0][2].to === U && recs[0][2].src === ST + 'a' && recs[0][2].img === ST + 'snap' && recs[0][2].toName === '민트',
    '★ 보낸 뒤 내 기록 — 받은 친구 · 원래 그림(같은 그림 가르기) · 사본 그림 · 이름');
  sends.length = 0; recs.length = 0;
  await cB.click(); await new Promise(r => setImmediate(r));
  chk(sends.length === 1 && recs.length === 1, '안 보낸 그림은 묻지 않고 바로 보낸다');
  const big = {}; for(let i = 1; i <= 30; i++) big['o' + i] = { to: U, src: ST + 'z', ts: i };
  f._recordSent(U, '민트', ST + 'q', { giftId: 'gN2', imgUrl: ST + 's' }, '', big);
  chk(JSON.stringify(recs[recs.length - 1][3]) === '["o1"]', '30개가 넘으면 가장 옛 기록을 같이 지운다');
  sends.length = 0; recs.length = 0;
  f.buildGiftPopup(U, '민트', [{ url: ST + 'a' }], 0, 3, null);
  const pop2 = win.children[win.children.length - 1];
  await pop2.querySelector('#mlGiftGrid').children[0].click(); await new Promise(r => setImmediate(r));
  chk(sends.length === 1, '보낸 기록을 못 읽었으면(null) 묻지 않고 보낸다');
  chk(/firebaseAPI\.getMallangSent\(myId\(\)\)/.test(SRC.mallang) && /buildGiftPopup\(friendId, friendName, mine, cnt, theirs, sent\)/.test(SRC.mallang), '창을 열 때 보낸 기록을 같이(나란히) 읽는다');
}

say('── 4. 💝 선물함 › 보낸 선물(myhome-inbox.js)');
{
  const I0 = SRC.inbox.indexOf('let _giftSub = '), I1 = SRC.inbox.indexOf('/* 받아 둔 gifts 로 다시 그린다');
  const body = SRC.inbox.slice(I0, I1);
  let srv = {};
  const stat = [];
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const btn = (k) => { const c = new Set(); return { dataset: { gs: k }, classList: { toggle: (n, f) => { f ? c.add(n) : c.delete(n); }, has: n => c.has(n) } }; };
  const bts = [btn('got'), btn('sent')];
  const listEl = { innerHTML: '', onclick: 'old', oncontextmenu: 'old', querySelectorAll: () => [] };
  const ctx = { getMyUserId: () => 'umeeeeeeee1', firebaseAPI: { getMallangSent: async () => srv, getMallangGifts: async () => ({}) }, TwMallangSent: MS,
    document: { querySelectorAll: (sel) => (sel === '#mhGiftSub [data-gs]' ? bts : []) },
    TwSafeHtml: { safeUrl: (u) => (String(u).startsWith('https://') ? u : '') }, TwImgRetry: { retryOnError(){} }, escHtml: esc, _inboxTimeStr: (t) => 'T' + t,
    _giftStat: (t) => stat.push(t), _giftBoxPaint: (b) => { b.innerHTML = 'GRID'; } };
  const f = new Function(...Object.keys(ctx), body + '\nreturn { renderGiftBox, _sentPaint };')(...Object.values(ctx));
  const tick = async () => { for(let i = 0; i < 4; i++) await new Promise(r => setImmediate(r)); };
  f.renderGiftBox(listEl); await tick();
  chk(bts[0].classList.has('on') && !bts[1].classList.has('on') && listEl.innerHTML === 'GRID', '★ 선물함 탭 줄의 «받은 선물 · 보낸 선물» — 처음은 받은 선물(지금 격자 그대로 · 같은 칸)');
  srv = { a: { to: U, toName: '<b>민트</b>', src: ST + 'a', img: ST + 'g', ts: 7, msg: '"하이"' }, b: { to: U, src: ST + 'b', ts: 9 } };
  bts[1].onclick({ stopPropagation(){} }); await tick();
  const h = listEl.innerHTML;
  chk(bts[1].classList.has('on') && listEl.onclick === null && listEl.oncontextmenu === null && h.indexOf('T9') < h.indexOf('T7') && /&lt;b&gt;민트&lt;\/b&gt;/.test(h) && /💬 &quot;하이&quot;/.test(h) && /<b>친구<\/b>/.test(h) && stat[stat.length - 1] === '최근 2개',
    '★ 보낸 선물 — 받은 선물의 누르기 · 우클릭을 걷고 · 최근 것부터 · 받은 친구 · 메시지(남이 정한 글자는 씻음) · 이름 없으면 «친구» · «최근 n개»');
  chk(/src="https:\/\/firebasestorage[^"]*\/g"/.test(h) && /src="https:\/\/firebasestorage[^"]*\/b"/.test(h), '그림은 사본 · 없으면 원래 그림');
  srv = null; await f._sentPaint(listEl);
  chk(/불러오지 못했어요/.test(listEl.innerHTML), '못 읽음은 «불러오지 못했어요»(빈 목록과 다르게)');
  srv = {}; await f._sentPaint(listEl);
  chk(/아직 보낸 선물이 없어요/.test(listEl.innerHTML), '빈 목록 안내 — 0.14.0 부터 남는다');
  chk(/#mhFmTabs:has\(\.mh-ibx-tab\.gift\.on\) \.gift-sub\{display:flex;\}/.test(SRC.html) && /id="mhGiftSub"/.test(SRC.html), '전환 단추는 선물함 탭일 때만 보인다(CSS)');
  const order = [...SRC.html.matchAll(/<script src="parts\/myhome\/(mallang-sent|myhome-inbox|mallang)\.js"/g)].map(m => m[1]);
  chk(order.join() === 'mallang-sent,myhome-inbox,mallang', 'html — mallang-sent.js 를 쓰는 두 파일보다 먼저 싣는다');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
})();
