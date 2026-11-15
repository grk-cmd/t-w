/* sim-xmas-window.js — 🎄 크리스마스 창(parts/xmas/xmas-window.js · 일회성)을 가짜 화면 · 가짜 서버로 돌려 본다
   실행: node checks/run.js sim-xmas-window
   ・1절 런처 버튼 — 서버 시각 전엔 숨김 · 이벤트 중 보임 · 1월 1일 0시부터 숨고 열린 창도 닫힘
   ・2절 열기 · 불러오기 — 내 트리(없으면 지금 트리) · 그림은 판이 다른 자리만 받고 이 PC 에 사본 · 다시 열면 안 받음 · 내 장식 표시 · 걸린 수
   ・3절 장식 달기 — 고른 장식 · 한마디 다듬기 · 보던 트리 번호 · 다 찼으면 «다른 트리로 이동» · 5초 간격 · 실패 갈래
   ・4절 신고 — 확인창 · 내 트리 · 자리 · 이미 신고 · 실패 코드
   ・5절 실패 · 닫기 — 못 불러옴(E-XMAS-01) · 닫은 뒤 늦게 온 답은 버림 · 끝난 뒤 열기 막기
   ・6절 한마디 라벨은 textContent 로만 · 깨 보기 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const find = (c) => c.find(p => fs.existsSync(p));
const WP = find(['xmas-window.js', 'parts/xmas/xmas-window.js', 'app/parts/xmas/xmas-window.js', 'apps/desktop/app/parts/xmas/xmas-window.js']);
const RP = find(['xmas-rules.js', 'parts/xmas/xmas-rules.js', 'app/parts/xmas/xmas-rules.js', 'apps/desktop/app/parts/xmas/xmas-rules.js']);
const HP = find(['safe-html.js', 'parts/shared/safe-html.js', 'app/parts/shared/safe-html.js', 'apps/desktop/app/parts/shared/safe-html.js']);
if (!WP || !RP || !HP) { say('  ? 원본 못 찾음 — xmas-window.js · xmas-rules.js · safe-html.js'); process.exit(2); }
global.TwSafeHtml = require(path.resolve(HP));
const W = require(path.resolve(WP));
const R = require(path.resolve(RP));
const SRC = fs.readFileSync(WP, 'utf8');

/* ── 가짜 화면 ── */
function el(tag, id){
  const cls = new Set(), attrs = {}, ls = {};
  const e = { tagName: String(tag).toUpperCase(), id, hidden: false, textContent: '', value: '', disabled: false, style: {}, children: [], title: '', alt: '', src: '', type: '',
    classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c), toggle: (c, on) => (on === undefined ? (cls.has(c) ? cls.delete(c) : cls.add(c)) : on ? cls.add(c) : cls.delete(c)) },
    setAttribute: (k, v) => { attrs[k] = String(v); }, getAttribute: (k) => (k in attrs ? attrs[k] : null),
    addEventListener: (t, fn) => { (ls[t] = ls[t] || []).push(fn); }, fire: (t, ev) => (ls[t] || []).forEach(f => f(ev || {})),
    appendChild: (c) => { e.children.push(c); return c; }, insertBefore: (c) => { e.children.unshift(c); return c; },
    querySelectorAll: (sel) => (sel === 'button' ? e.children.filter(c => c.tagName === 'BUTTON') : []),
    focus: () => {}, closest: () => null, setPointerCapture: () => {}, getBoundingClientRect: () => ({ left: 0, top: 0 }), offsetWidth: 640,
    getContext: () => null, files: null };
  return e;
}
const IDS = ['xmasOverlay', 'lcXmas', 'xmasSay', 'xmasRep', 'xmasRepNo', 'xmasRepYes', 'xmasPick', 'xmasUpLab', 'xmasUp', 'xmasCount', 'xmasState',
  'xmasWord', 'xmasHang', 'xmasFull', 'xmasFullOk', 'xmasCloseBtn', 'xmasCanvas', 'xmasWin', 'xmasTitle'];
function world(opts){
  const o = opts || {};
  const els = {}; IDS.forEach(i => { els[i] = el(i === 'xmasHang' || /Btn|Yes|No|Ok/.test(i) ? 'button' : 'div', i); });
  ['xmasRep', 'xmasFull', 'xmasSay', 'xmasState'].forEach(i => { els[i].hidden = true; });
  const doc = { getElementById: (i) => els[i] || null, createElement: (t) => el(t) };
  const store = {}; const storage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  const timers = [];
  class Img { set src(v){ this._src = v; Promise.resolve().then(() => (this.onload && this.onload())); } get src(){ return this._src; } }
  const win = { localStorage: storage, Image: Img, setInterval: (fn, ms) => timers.push([fn, ms]), innerWidth: 1000, innerHeight: 800, URL: {}, FileReader: function(){} };
  const T = { opened: 0, closed: 0, lists: [], onSay: null, onReport: null };
  const treeMod = { baseCanvas: () => null, createXmasTree: () => ({
    open: () => { T.opened++; }, close: () => { T.closed++; }, setOrnaments: (l) => { T.lists.push(l); },
    onSay: (f) => { T.onSay = f; }, onReport: (f) => { T.onReport = f; }, isOpen: () => false }) };
  const S = { now: o.now == null ? R.LETTER_DEADLINE_MS - 86400000 : o.now, ready: null, toasts: [], errs: [], size: 0, escs: [] };
  const N = { calls: [], data: o.data || { cur: 1, mine: null, trees: { 1: {} }, imgs: {} }, fail: o.fail || {}, hangRet: o.hangRet || null, hangGate: null };
  const net = {
    where: async () => { N.calls.push('where'); return N.fail.where ? { ok: false, code: 'read' } : { ok: true, cur: N.data.cur, mine: N.data.mine }; },
    tree: async (t) => { N.calls.push('tree:' + t); if (N.hangGate) await N.hangGate; return N.fail.tree ? { ok: false, code: 'read' } : { ok: true, o: N.data.trees[t] || {} }; },
    img: async (t, s) => { N.calls.push('img:' + t + '/' + s); const v = (N.data.imgs[t] || {})[s]; return { ok: true, v: v ? v.v : null, d: v ? v.d : null }; },
    hang: async (d) => { N.calls.push('hang'); N.lastHang = d; return N.hangRet || { ok: true, tree: N.data.cur, slot: 0, moved: false, changed: false }; },
    reportOrnament: async (t, s) => { N.calls.push('report:' + t + '/' + s); return o.repRet || { ok: true }; },
  };
  const api = W.createXmasWindow({ doc, win, THREE: {}, ps1Dither: {}, rules: R, treeMod, net: () => net, serverNow: () => S.now, storage,
    notifyError: (c) => S.errs.push(c), toast: (m) => S.toasts.push(m), escRegisterWindow: (x) => S.escs.push(x),
    onSizeChange: () => { S.size++; }, onReady: (fn) => { S.ready = fn; } });
  return { api, els, T, S, N, store, timers };
}
const tick = () => new Promise(r => setTimeout(r, 0));
const settle = async () => { for (let i = 0; i < 6; i++) await tick(); };
const PNG = (n) => 'data:image/png;base64,iVBOR' + n;

(async () => {
say('── 1절 런처 버튼');
{
  const w = world();
  chk(w.els.lcXmas.hidden === true, '서버 시각을 받기 전엔 숨김');
  w.S.ready();
  chk(w.els.lcXmas.hidden === false && w.timers.length === 1 && w.timers[0][1] === 60000, '이벤트 중엔 보임 · 1분마다 다시 본다');
  w.els.lcXmas.onclick(); await settle();
  w.S.now = R.EVENT_END_MS; w.api.refreshButton();
  chk(w.els.lcXmas.hidden === true && !w.els.xmasOverlay.classList.contains('on') && w.T.closed === 1, '1월 1일 0시부터 숨고 · 열려 있던 창도 닫힌다');
  chk(w.S.escs.length === 1 && w.S.escs[0].key === 'xmas' && w.S.escs[0].el === w.els.xmasOverlay, 'Esc 로 닫기 등록');
}

say('── 2절 열기 · 불러오기');
{
  const data = { cur: 3, mine: { t: 2, s: 4 }, trees: { 2: { 0: { k: 'star', v: 1, w: '메리' }, 4: { k: 'img', v: 2 }, 7: { k: 'img', v: 5 } } },
    imgs: { 2: { 4: { v: 2, d: PNG('A') }, 7: { v: 5, d: PNG('B') } } } };
  const w = world({ data }); w.S.ready();
  w.api.open(); await settle();
  chk(w.els.xmasOverlay.classList.contains('on') && w.T.opened === 1 && w.S.size === 1, '열면 창 · 트리 · 창 크기');
  chk(w.N.calls.join() === 'where,tree:2,img:2/4,img:2/7', '내 트리(2)를 읽고 그림 자리만 하나씩 — ' + w.N.calls.join(' · '));
  const L = w.T.lists[w.T.lists.length - 1];
  chk(L.length === 3 && L.find(x => x.slot === 4).mine === true && L.filter(x => x.mine).length === 1, '내 장식 하나만 mine');
  chk(L.find(x => x.slot === 0).word === '메리' && L.find(x => x.slot === 0).img === null && L.find(x => x.slot === 7).img, '한마디 · 기본 장식은 그림 없음 · 내 그림은 Image');
  chk(w.els.xmasCount.textContent === '트리 #2 · 3/300' && w.els.xmasHang.textContent === '내 장식 바꾸기', '걸린 수 · 단추 «내 장식 바꾸기»');
  chk(JSON.parse(w.store['tw.xmasImg.2'])[7].v === 5, '그림 사본을 이 PC 에 판과 함께 둔다');
  w.api.close(); w.N.calls.length = 0;
  data.trees[2][7].v = 6; data.imgs[2][7] = { v: 6, d: PNG('C') }; data.trees[2][4] = { k: 'gift', v: 3 };
  w.api.open(); await settle();
  chk(w.N.calls.join() === 'where,tree:2,img:2/7', '다시 열면 판이 바뀐 자리만 받는다 — ' + w.N.calls.join(' · '));
  chk(!(4 in JSON.parse(w.store['tw.xmasImg.2'])), '기본 장식으로 바뀐 자리의 그림 사본은 지운다');
  const w2 = world({ data: { cur: 5, mine: null, trees: { 5: {} }, imgs: {} } }); w2.S.ready(); w2.api.open(); await settle();
  chk(w2.N.calls.join() === 'where,tree:5' && w2.els.xmasHang.textContent === '내 장식 달기' && /첫 장식/.test(w2.els.xmasState.textContent), '아직 안 걸었으면 지금 트리(5) 미리 보기 · 빈 트리 안내');
}

say('── 3절 장식 달기');
{
  const w = world({ data: { cur: 1, mine: null, trees: { 1: {} }, imgs: {} }, hangRet: { ok: true, tree: 2, slot: 0, moved: true, changed: false } });
  w.S.ready(); w.api.open(); await settle();
  w.els.xmasWord.value = '  메리\n크리스마스 ' + 'ㅋ'.repeat(40);
  await w.els.xmasHang.onclick(); await settle();
  chk(w.N.lastHang.kind === 'star' && w.N.lastHang.preview === 1 && !('img' in w.N.lastHang), '기본으로 고른 별 · 보던 트리 번호를 같이 보낸다');
  chk(w.N.lastHang.word.length === R.WORD_MAX && w.N.lastHang.word.startsWith('메리 크리스마스'), '한마디 — 다듬고 30자');
  chk(w.els.xmasFull.hidden === false, '다른 트리로 옮겨졌으면 «트리가 이미 다 차버렸어요» 창');
  const n = w.N.calls.filter(c => c === 'hang').length;
  await w.els.xmasHang.onclick();
  chk(w.N.calls.filter(c => c === 'hang').length === n && /초 뒤에 다시/.test(w.S.toasts.pop()), '5초 안에 또 누르면 보내지 않고 안내');
  for (const [code, want] of [['aborted', /거는 중/], ['failed-precondition', /끝났어요/], ['invalid-argument', /쓸 수 없는 말|걸 수 없어요/]]) {
    const w2 = world({ hangRet: { ok: false, code, msg: code === 'invalid-argument' ? '쓸 수 없는 말이 들어 있어요' : '' } }); w2.S.ready(); w2.api.open(); await settle();
    await w2.els.xmasHang.onclick();
    chk(want.test(w2.S.toasts.pop() || '') && !w2.S.errs.length, '실패 ' + code + ' — 안내 문구(오류 코드 아님)');
  }
  const w3 = world({ hangRet: { ok: false, code: 'internal' } }); w3.S.ready(); w3.api.open(); await settle(); await w3.els.xmasHang.onclick();
  chk(w3.S.errs.join() === 'E-XMAS-02', '그 밖 실패는 E-XMAS-02');
}

say('── 4절 신고');
{
  const w = world({ data: { cur: 4, mine: null, trees: { 4: { 9: { k: 'star', v: 1 } } }, imgs: {} } }); w.S.ready(); w.api.open(); await settle();
  w.T.onReport(9);
  chk(w.els.xmasRep.hidden === false, '우클릭 → 확인창');
  await w.els.xmasRepYes.onclick();
  chk(w.N.calls.includes('report:4/9') && w.els.xmasRep.hidden && /신고했어요/.test(w.S.toasts.pop()), '보던 트리 · 자리로 신고');
  w.T.onReport(9); w.els.xmasRepNo.onclick();
  chk(w.N.calls.filter(c => c.startsWith('report')).length === 1, '취소하면 보내지 않는다');
  const wd = world({ data: { cur: 4, mine: null, trees: { 4: {} }, imgs: {} }, repRet: { ok: false, code: 'dup' } }); wd.S.ready(); wd.api.open(); await settle();
  wd.T.onReport(1); await wd.els.xmasRepYes.onclick();
  chk(/이미 신고/.test(wd.S.toasts.pop()) && !wd.S.errs.length, '이미 신고한 장식 — 안내');
  const we = world({ data: { cur: 4, mine: null, trees: { 4: {} }, imgs: {} }, repRet: { ok: false, code: 'write' } }); we.S.ready(); we.api.open(); await settle();
  we.T.onReport(1); await we.els.xmasRepYes.onclick();
  chk(we.S.errs.join() === 'E-XMAS-03', '신고 실패는 E-XMAS-03');
}

say('── 5절 실패 · 닫기');
{
  const w = world({ fail: { where: true } }); w.S.ready(); w.api.open(); await settle();
  chk(w.S.errs.join() === 'E-XMAS-01' && /불러오지 못했어요/.test(w.els.xmasState.textContent) && !w.T.lists.length, '못 불러옴 — E-XMAS-01 · 빈 트리로 그리지 않는다');
  const w2 = world({ data: { cur: 1, mine: null, trees: { 1: { 0: { k: 'star', v: 1 } } }, imgs: {} } }); w2.S.ready();
  let release; w2.N.hangGate = new Promise(r => { release = r; });
  w2.api.open(); await tick(); w2.api.close(); release(); await settle();
  chk(!w2.T.lists.length && w2.T.closed === 1 && !w2.els.xmasOverlay.classList.contains('on'), '닫은 뒤 늦게 온 답은 버린다(닫힌 창에 그리지 않음)');
  const w3 = world({ now: R.EVENT_END_MS }); w3.S.ready(); w3.api.open(); await settle();
  chk(!w3.T.opened && /끝났어요/.test(w3.S.toasts.pop()), '이벤트가 끝났으면 열지 않는다');
}

say('── 6절 한마디 라벨 · 깨 보기');
{
  const w = world(); w.S.ready(); w.api.open(); await settle();
  w.T.onSay({ word: '<img src=x onerror=alert(1)>', x: 10, y: 20 });
  chk(w.els.xmasSay.textContent === '<img src=x onerror=alert(1)>' && !w.els.xmasSay.hidden && w.els.xmasSay.style.left === '10px', '남이 쓴 한마디는 글자 그대로(textContent)');
  w.T.onSay(null); chk(w.els.xmasSay.hidden, '닫으면 숨김');
  chk(!/innerHTML/.test(SRC.replace(/\/\*[\s\S]*?\*\//g, '')), '창 모듈에 innerHTML 없음');
  chk(/TwSafeHtml\.safeUrl\(d, 'image'\)/.test(SRC), '받은 그림 주소는 safeUrl(image) 로 거른다');
  // 깨 보기 — 2절 «판이 바뀐 자리만» 이 사본을 안 보면 잡히는지
  const wb = world({ data: { cur: 1, mine: null, trees: { 1: { 3: { k: 'img', v: 1 } } }, imgs: { 1: { 3: { v: 1, d: PNG('Z') } } } } }); wb.S.ready();
  wb.api.open(); await settle(); wb.api.close(); wb.N.calls.length = 0; wb.store['tw.xmasImg.1'] = '{}';
  wb.api.open(); await settle();
  chk(wb.N.calls.includes('img:1/3'), '깨 보기 — 사본이 없으면 다시 받는다(사본을 안 보면 2절이 빨강)');
}

say(`\n${fail ? '✗' : '✓'} ${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
