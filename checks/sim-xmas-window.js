/* sim-xmas-window.js — 🎄 크리스마스 창(parts/xmas/xmas-window.js · 일회성)을 가짜 화면 · 가짜 서버로 돌려 본다
   실행: node checks/run.js sim-xmas-window
   ・1절 런처 버튼 — 서버 시각 전엔 숨김 · 이벤트 중 · 이벤트 끝 뒤(받은 편지 1/5 까지)에도 보임 · 열람 끝부터 숨고 열린 창도 닫힘
   ・2절 열기 · 불러오기 — 내 트리(없으면 지금 트리) · 그림은 판이 다른 자리만 받고 IndexedDB 에 «트리/자리@판» 사본(localStorage 는 쓰면 던진다) · 다시 열면 안 받음 · 내 장식 표시 · 걸린 수
   ・3절 장식 달기 — 고른 장식 · 한마디 다듬기 · 보던 트리 번호 · 다 찼으면 «다른 트리로 이동» · 5초 간격 · 실패 갈래(conflict 는 다시 읽기)
   ・3-2절 내 장식 덮어 그리기 — 목록(서버 캐시)이 내가 건 판보다 늦으면 걸기 응답으로 · 목록이 같거나 새 판이면 목록대로
   ・4절 신고 — 확인창 · 내 트리 · 자리 · 이미 신고 · 실패 코드 · 이벤트 끝 뒤엔 안내로 막힘
   ・5절 실패 · 닫기 — 못 불러옴(E-XMAS-01) · 닫은 뒤 늦게 온 답은 버림 · 끝난 뒤 열기 막기
   ・6절 한마디 라벨은 textContent 로만 · mutation test
   ・7절 편지 창 잇기(편지 · 뮤직바는 가짜 — 그 모듈은 sim-xmas-letter · sim-xmas-song) — 창 열면 맡긴 수 · 1분마다 단추만(받은 편지는 안 읽음) · 닫으면 편지 창도 ·
   ・9절 세션 reset 뒤 늦은 걸기 답은 다시 읽지 않음 · 켤 때 차례 startXmas(reset 둘 · 하루 창 · NaN · 창 없음) · app.js 배선
   ・8절 📩 받은 편지 알림 — 못 읽으면 다시 · 세션 reset 이 기다림 · 본 알림 · 창을 비움 · 안 읽은 XMAS_LETTER 를 처음 볼 때만 0~30초 무작위 뒤 한 번 읽기 · 기다리는 동안 또 보이면 묶음 · 반송 · 읽은 알림은 안 읽음 ·
     📩 알림함이 NAV.XMAS 로 연다('letter' 면 편지 창까지) · 빨간 점 · 로그인 안 됨 안내(오류 코드 아님) */
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
const AP = find(['app.js', 'parts/app.js', 'app/parts/app.js', 'apps/desktop/app/parts/app.js']);
const APP = AP ? fs.readFileSync(AP, 'utf8') : '';

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
  'xmasWord', 'xmasHang', 'xmasFull', 'xmasFullOk', 'xmasCloseBtn', 'xmasCanvas', 'xmasWin', 'xmasTitle', 'xmasBgmBtn', 'xmasCreditBtn', 'xmasCredit'];
function world(opts){
  const o = opts || {};
  const els = {}; IDS.forEach(i => { els[i] = el(i === 'xmasHang' || /Btn|Yes|No|Ok/.test(i) ? 'button' : 'div', i); });
  ['xmasRep', 'xmasFull', 'xmasSay', 'xmasState'].forEach(i => { els[i].hidden = true; });
  const doc = { getElementById: (i) => els[i] || null, createElement: (t) => el(t) };
  const store = {}; const idbGet = async (k) => (k in store ? store[k] : null); const idbPut = (k, v) => { store[k] = v; };   // GLB 영구 캐시(IndexedDB) 흉내
  const timers = [], timeouts = [], cleared = [];
  class Img { set src(v){ this._src = v; Promise.resolve().then(() => (this.onload && this.onload())); } get src(){ return this._src; } }
  const win = { localStorage: { getItem(){ throw new Error('localStorage 를 쓰면 안 된다'); }, setItem(){ throw new Error('localStorage 를 쓰면 안 된다'); } }, Image: Img, setInterval: (fn, ms) => timers.push([fn, ms]), setTimeout: (fn, ms) => { timeouts.push([fn, ms]); return timeouts.length; }, clearTimeout: (id) => { cleared.push(id); }, innerWidth: 1000, innerHeight: 800, URL: {}, FileReader: function(){} };
  const T = { opened: 0, closed: 0, lists: [], onSay: null, onReport: null };
  const treeMod = { baseCanvas: () => null, createXmasTree: () => ({
    open: () => { T.opened++; }, close: () => { T.closed++; }, setOrnaments: (l) => { T.lists.push(l); },
    onSay: (f) => { T.onSay = f; }, onReport: (f) => { T.onReport = f; }, isOpen: () => false }) };
  const S = { now: o.now == null ? R.LETTER_DEADLINE_MS - 86400000 : o.now, ready: null, toasts: [], errs: [], size: 0, escs: [] };
  const N = { calls: [], data: o.data || { cur: 1, mine: null, trees: { 1: {} }, imgs: {} }, fail: o.fail || {}, hangRet: o.hangRet || null, hangGate: null };
  const net = {
    where: async () => { N.calls.push('where'); return N.fail.where ? { ok: false, code: N.fail.where === 'auth' ? 'auth' : 'read' } : { ok: true, cur: N.data.cur, mine: N.data.mine }; },
    tree: async (t) => { N.calls.push('tree:' + t); if (N.hangGate) await N.hangGate; return N.fail.tree ? { ok: false, code: 'read' } : { ok: true, o: N.data.trees[t] || {} }; },
    img: async (id) => { N.calls.push('img:' + id); const d = N.data.imgs[id]; return d ? { ok: true, d } : { ok: false, code: 'read' }; },
    hang: async (d) => { N.calls.push('hang'); N.lastHang = d; if (N.hangHold) await N.hangHold; return N.hangRet || { ok: true, tree: N.data.cur, slot: 0, version: 1, moved: false, changed: false, imageId: null }; },
    schedule: () => N.sched || null,
    scheduleNow: () => N.sched || R.SCHEDULE,
    reportOrnament: async (t, s) => { N.calls.push('report:' + t + '/' + s); return o.repRet || { ok: true }; },
  };
  const Lt = { calls: [], deps: null };
  const letterMod = { createXmasLetter: (d) => { Lt.deps = d; d.escRegisterWindow({ key: 'xmasLetter' }); const c = (n) => () => { Lt.calls.push(n); };
    return { open: c('open'), close: c('close'), refresh: c('refresh'), checkGot: () => { Lt.calls.push('checkGot'); return Promise.resolve(Lt.gotOk !== false); }, paintBtn: c('paintBtn'), reset: c('reset'), isOpen: () => false }; } };
  const songMod = { createXmasSong: (d) => { Lt.songDeps = d; return { bar: () => ({}), stop: () => {}, onPlay: (fn) => { Lt.onPlay = fn; } }; } };
  /* 🎵 배경음악 · 출처 — 부른 것은 Bg.calls 에(편지 모듈 Lt.calls 와 따로). 멈출 때 편지 창이 이미 닫혔는지도 적는다 */
  const Bg = { muted: !!o.muted, deps: null, calls: [], letterClosedAtStop: null };
  const bgmMod = { CREDIT: ['머리', '곡'], createXmasBgm: (d) => { Bg.deps = d; return {
    start: () => Bg.calls.push('bgm.start'), stop: () => { Bg.calls.push('bgm.stop'); Bg.letterClosedAtStop = Lt.calls.includes('close'); }, toggle: () => { Bg.muted = !Bg.muted; Bg.calls.push('bgm.toggle'); },
    duck: (on) => Bg.calls.push('bgm.duck:' + on), isMuted: () => Bg.muted, label: () => (Bg.muted ? '음악 켜기' : '음악 끄기') }; } };
  const creditMod = { createXmasCredit: (d) => { Bg.creditDeps = d; return { toggle: () => Bg.calls.push('credit.toggle'), stop: () => Bg.calls.push('credit.stop'), showing: () => false }; } };
  const nav = { NAV: { XMAS: 'xmas' }, fns: {}, on(n, f){ this.fns[n] = f; } };
  const api = (o.mod || W).createXmasWindow({ doc, win, THREE: {}, ps1Dither: {}, rules: R, treeMod, net: () => net, serverNow: () => S.now, idbGet, idbPut,
    notifyError: (c) => S.errs.push(c), toast: (m) => S.toasts.push(m), escRegisterWindow: (x) => S.escs.push(x),
    onSizeChange: () => { S.size++; }, onReady: (fn) => { S.ready = fn; },
    songMod, letterMod, companion: () => null, ytVideoId: () => null, asyncPrompt: async () => null, storage: null, twNav: nav, random: () => (o.random == null ? 0.5 : o.random),
    bgmMod, creditMod, Audio: null, save: () => true, officeMode: () => false, warn: () => {}, bgmHush: { hush: () => null, unhush: () => {} } });
  return { api, els, T, S, N, store, timers, timeouts, cleared, Lt, nav, Bg };
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
  chk(w.els.lcXmas.hidden === false && w.els.xmasOverlay.classList.contains('on'), '1월 1일 0시(이벤트 끝)에도 보인다 — 받은 편지는 1/5 까지');
  w.S.now = R.LETTERS_VIEW_UNTIL_MS; w.api.refreshButton();
  chk(w.els.lcXmas.hidden === true && !w.els.xmasOverlay.classList.contains('on') && w.T.closed === 1, '열람 끝(1/6 0시)부터 숨고 · 열려 있던 창도 닫힌다');
  chk(w.S.escs.map(x => x.key).join() === 'xmas,xmasLetter' && w.S.escs[0].el === w.els.xmasOverlay, 'Esc 로 닫기 등록 — 트리 창을 편지 창보다 먼저(알림함 길은 둘을 같은 틱에 열어 창 쌓기가 등록 순서로 쌓는다 → Esc 에 편지 창만)');
}

say('── 2절 열기 · 불러오기');
{
  const data = { cur: 3, mine: { t: 2, s: 4, v: 2 }, trees: { 2: { 0: { k: 'star', v: 1, w: '메리' }, 4: { k: 'img', v: 2, id: 'id4' }, 7: { k: 'img', v: 5, id: 'id7' } } },
    imgs: { id4: PNG('A'), id7: PNG('B') } };
  const w = world({ data }); w.S.ready();
  w.api.open(); await settle();
  chk(w.els.xmasOverlay.classList.contains('on') && w.T.opened === 1 && w.S.size === 1, '열면 창 · 트리 · 창 크기');
  chk(w.N.calls.join() === 'where,tree:2,img:id4,img:id7', '내 트리(2)를 읽고 그림 자리만 그림 id 로 하나씩(Storage) — ' + w.N.calls.join(' · '));
  const L = w.T.lists[w.T.lists.length - 1];
  chk(L.length === 3 && L.find(x => x.slot === 4).mine === true && L.filter(x => x.mine).length === 1, '내 장식 하나만 mine');
  chk(L.find(x => x.slot === 0).word === '메리' && L.find(x => x.slot === 0).img === null && L.find(x => x.slot === 7).img, '한마디 · 기본 장식은 그림 없음 · 내 그림은 Image');
  chk(w.els.xmasCount.textContent === '트리 #2 · 3/300' && w.els.xmasHang.textContent === '내 장식 바꾸기', '걸린 수 · 단추 «내 장식 바꾸기»');
  chk(w.store['xmasimg:2/7@5'] === PNG('B') && w.store['xmasimg:2/4@2'] === PNG('A'), '그림 사본을 IndexedDB 에 «트리/자리@판» 키로(localStorage 는 안 씀)');
  w.api.close(); w.N.calls.length = 0;
  data.trees[2][7] = { k: 'img', v: 6, id: 'id7b' }; data.imgs.id7b = PNG('C'); data.trees[2][4] = { k: 'gift', v: 3 };
  w.api.open(); await settle();
  chk(w.N.calls.join() === 'where,tree:2,img:id7b', '다시 열면 판이 바뀐 자리만 받는다 — ' + w.N.calls.join(' · '));
  chk(w.store['xmasimg:2/7@6'] === PNG('C') && w.store['xmasimg:2/7@5'] === PNG('B'), '새 판은 새 키로 — 옛 판 키는 쓰이지 않고 캐시가 45일 뒤 치운다');
  const L2 = w.T.lists[w.T.lists.length - 1];
  chk(L2.find(x => x.slot === 4).img === null, '기본 장식으로 바뀐 자리는 그림 없이(사본을 안 쓴다)');
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
  for (const [code, want] of [['aborted', /잠시 뒤 다시/], ['failed-precondition', /끝났어요/], ['invalid-argument', /쓸 수 없는 말|걸 수 없어요/], ['auth', /로그인한 뒤/]]) {
    const w2 = world({ hangRet: { ok: false, code, msg: code === 'invalid-argument' ? '쓸 수 없는 말이 들어 있어요' : '' } }); w2.S.ready(); w2.api.open(); await settle();
    await w2.els.xmasHang.onclick();
    chk(want.test(w2.S.toasts.pop() || '') && !w2.S.errs.length, '실패 ' + code + ' — 안내 문구(오류 코드 아님)');
  }
  const w3 = world({ hangRet: { ok: false, code: 'internal' } }); w3.S.ready(); w3.api.open(); await settle(); await w3.els.xmasHang.onclick();
  chk(w3.S.errs.join() === 'E-XMAS-02', '그 밖 실패는 E-XMAS-02');
  const wc = world({ hangRet: { ok: false, code: 'conflict' } }); wc.S.ready(); wc.api.open(); await settle(); wc.N.calls.length = 0; await wc.els.xmasHang.onclick(); await settle();
  chk(/다른 PC 에서 먼저/.test(wc.S.toasts.join()) && !wc.S.errs.length && wc.N.calls.join() === 'hang,where,tree:1', '실패 conflict(다른 PC 가 먼저 바꿈) — 안내 · 트리 · 내 자리를 다시 읽는다(다시 보내지 않음)');
}

say('── 3-2절 내 장식 덮어 그리기(목록은 서버 캐시라 몇 초 늦을 수 있다 · 내 몫 mine 은 캐시 없음)');
{
  const overlay = async (mod) => {
    const data = { cur: 2, mine: { t: 2, s: 5, v: 1, k: 'star', w: '안녕', id: null }, trees: { 2: { 0: { k: 'star', v: 1 } } }, imgs: {} };
    const w = world({ data, mod }); w.S.ready(); w.api.open(); await settle();
    const last = () => w.T.lists[w.T.lists.length - 1];
    const m5 = last().find(x => x.slot === 5);
    const drawn = last().length === 2 && !!m5 && m5.k === 'star' && m5.word === '안녕' && m5.mine;
    data.trees[2][5] = { k: 'bulb', v: 2 }; w.api.close(); w.api.open(); await settle();
    const listWins = last().find(x => x.slot === 5).k === 'bulb';
    data.trees[2][5] = { k: 'gift', v: 0 }; w.api.close(); w.api.open(); await settle();
    const mineWins = last().find(x => x.slot === 5).k === 'star';
    delete data.trees[2][5]; data.mine = null; w.api.close(); w.api.open(); await settle();   // 관리자가 지움 · 탈퇴 — 내 몫에도 목록에도 없다
    const gone = !last().find(x => x.slot === 5);
    return { drawn, listWins, mineWins, gone };
  };
  const r = await overlay(null);
  chk(r.drawn, '늦은 목록(내 장식 없음) 위에 내 몫(mine)으로 내 장식을 그린다 — 자리 · 종류 · 한마디');
  chk(r.listWins, '  ↳ 목록이 그 판 이상이면 목록을 그대로 쓴다(다른 PC 에서 또 바꾼 것)');
  chk(r.mineWins, '  ↳ 목록이 옛 판이면 내 몫의 판으로 덮는다');
  chk(r.gone, '★ 지워진 장식(내 몫 mine 이 null)은 다시 그리지 않는다 — 관리자 지우기 · 탈퇴 뒤');
  chk(!/\bhung\b/.test(SRC.replace(/\/\*[\s\S]*?\*\//g, '')), '  ↳ 걸기 응답을 따로 들고 있지 않다(hung 없음 — 원본은 내 몫)');
  const bad = {}; new Function('window', 'module', SRC.split('    overlayMine(tr.o);\n').join(''))(bad, undefined);
  const rb = await overlay(bad.TwXmasWindow);
  chk(!rb.drawn, 'mutation test — 덮어 그리기를 빼면 위 «내 몫으로 그린다» 가 빨강');
  chk(/idbPut\(imgKey\(r\.tree, r\.slot, r\.version\), data\.img\)/.test(SRC), '  ↳ 내 그림은 걸기 응답의 «트리/자리@판» 사본으로 넣는다(그림 올리기는 FileReader · canvas 라 실제 앱에서 본다)');
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
  { // 이벤트 끝(1/1 0시) 뒤 — 창은 열리고(받은 편지 1/5 까지) 장식 신고는 안내로 막힌다(오류 번호 · 요청 없음)
    const endCase = async (mod) => {
      const we = world({ now: R.EVENT_END_MS, data: { cur: 4, mine: null, trees: { 4: { 9: { k: 'star', v: 1 } } }, imgs: {} }, mod }); we.S.ready(); we.api.open(); await settle();
      const opened = we.els.xmasOverlay.classList.contains('on');
      we.T.onReport(9);
      const blocked = we.els.xmasRep.hidden && /이벤트가 끝나 신고할 수 없어요/.test(we.S.toasts.pop() || '');
      const wl = world({ now: R.EVENT_END_MS - 1000, data: { cur: 4, mine: null, trees: { 4: { 9: { k: 'star', v: 1 } } }, imgs: {} }, mod }); wl.S.ready(); wl.api.open(); await settle();
      wl.T.onReport(9); wl.S.now = R.EVENT_END_MS; await wl.els.xmasRepYes.onclick();   // 확인창을 연 채 끝을 넘김
      const late = /이벤트가 끝나 신고할 수 없어요/.test(wl.S.toasts.pop() || '');
      return { opened, blocked, late, calls: we.N.calls.concat(wl.N.calls).filter(c => c.startsWith('report')).length, errs: we.S.errs.length + wl.S.errs.length };
    };
    const r = await endCase(null);
    chk(r.opened && r.blocked && r.late && !r.calls && !r.errs, '이벤트 끝 뒤 — 창은 열리고 · 장식 신고는 안내로 막힌다(확인창을 연 채 넘겨도) · 요청 0 · 오류 번호 없음');
    const bad = {}; new Function('window', 'module', SRC.split('if (!rules.eventOn(serverNow(), sch())){ toast(REPORT_ENDED); return; }').join(''))(bad, undefined);
    const rb = await endCase(bad.TwXmasWindow);
    chk(!(rb.blocked && rb.late && !rb.calls), 'mutation test — 끝 검사를 빼면 위 검사가 빨강(신고가 서버로 나간다)');
  }
  const wd = world({ data: { cur: 4, mine: null, trees: { 4: {} }, imgs: {} }, repRet: { ok: false, code: 'dup' } }); wd.S.ready(); wd.api.open(); await settle();
  wd.T.onReport(1); await wd.els.xmasRepYes.onclick();
  chk(/이미 신고/.test(wd.S.toasts.pop()) && !wd.S.errs.length, '이미 신고한 장식 — 안내');
  const wa = world({ data: { cur: 4, mine: null, trees: { 4: {} }, imgs: {} }, repRet: { ok: false, code: 'auth' } }); wa.S.ready(); wa.api.open(); await settle();
  wa.T.onReport(1); await wa.els.xmasRepYes.onclick();
  chk(/로그인한 뒤 신고/.test(wa.S.toasts.pop()) && !wa.S.errs.length, '로그인 안 됨 · 가입 전 — «로그인한 뒤 신고할 수 있어요»(«이미 신고» 가 아님)');
  const wg = world({ data: { cur: 4, mine: null, trees: { 4: {} }, imgs: {} }, repRet: { ok: false, code: 'gone' } }); wg.S.ready(); wg.api.open(); await settle();
  wg.T.onReport(1); await wg.els.xmasRepYes.onclick();
  chk(/이미 없는 장식이에요/.test(wg.S.toasts.pop() || '') && !wg.S.errs.length, '그 사이 지워진 장식(404 XMAS_ORNAMENT_NOT_FOUND → gone) — «이미 없는 장식이에요» 안내(오류 번호 아님)');
  for (const code of ['report', 'aborted', 'write']){
    const wx = world({ data: { cur: 4, mine: null, trees: { 4: {} }, imgs: {} }, repRet: { ok: false, code } }); wx.S.ready(); wx.api.open(); await settle();
    wx.T.onReport(1); await wx.els.xmasRepYes.onclick();
    chk(wx.S.errs.join() === 'E-XMAS-03' && !wx.S.toasts.some(t => /이미 없는/.test(t)), '  신고 실패 ' + code + '(네트워크 · 503 · 그 밖) — E-XMAS-03 · «이미 없는» 안내가 아님');
  }
  const we = world({ data: { cur: 4, mine: null, trees: { 4: {} }, imgs: {} }, repRet: { ok: false, code: 'report' } }); we.S.ready(); we.api.open(); await settle();
  we.T.onReport(1); await we.els.xmasRepYes.onclick();
  chk(we.S.errs.join() === 'E-XMAS-03', '그 밖 신고 실패는 E-XMAS-03');
}

say('── 5절 실패 · 닫기');
{
  const w = world({ fail: { where: true } }); w.S.ready(); w.api.open(); await settle();
  chk(w.S.errs.join() === 'E-XMAS-01' && /불러오지 못했어요/.test(w.els.xmasState.textContent) && !w.T.lists.length, '못 불러옴 — E-XMAS-01 · 빈 트리로 그리지 않는다');
  const wn = world({ fail: { where: 'auth' } }); wn.S.ready(); wn.api.open(); await settle();
  chk(!wn.S.errs.length && /로그인한 뒤 트리를 볼 수 있어요/.test(wn.els.xmasState.textContent), '로그인 안 됨 — «못 불러옴» 이 아니라 로그인 안내(오류 코드 없음)');
  const w2 = world({ data: { cur: 1, mine: null, trees: { 1: { 0: { k: 'star', v: 1 } } }, imgs: {} } }); w2.S.ready();
  let release; w2.N.hangGate = new Promise(r => { release = r; });
  w2.api.open(); await tick(); w2.api.close(); release(); await settle();
  chk(!w2.T.lists.length && w2.T.closed === 1 && !w2.els.xmasOverlay.classList.contains('on'), '닫은 뒤 늦게 온 답은 버린다(닫힌 창에 그리지 않음)');
  const w3 = world({ now: R.LETTERS_VIEW_UNTIL_MS }); w3.S.ready(); w3.api.open(); await settle();
  chk(!w3.T.opened && /끝났어요/.test(w3.S.toasts.pop()), '이벤트가 끝났으면 열지 않는다');
}

say('── 5-1b절 배경음악 · 음악 출처(제목줄 단추 둘)');
{
  const w = world(); w.S.ready();
  chk(w.els.xmasBgmBtn.textContent === '음악 끄기' && !w.els.xmasBgmBtn.classList.contains('off'), '만들 때 [음악 끄기] 글을 맞춘다');
  chk(w.Bg.creditDeps.box === w.els.xmasCredit && w.Bg.creditDeps.lines.join() === '머리,곡', '출처 글은 배경음악 모듈의 CREDIT · 글 상자는 #xmasCredit');
  w.api.open(); await settle();
  chk(w.Bg.calls.includes('bgm.start'), '★ 창을 열면 배경음악을 건다(bgm.start)');
  w.els.xmasBgmBtn.onclick();
  chk(w.Bg.calls.includes('bgm.toggle') && w.els.xmasBgmBtn.textContent === '음악 켜기' && w.els.xmasBgmBtn.classList.contains('off'), '[음악 끄기] — toggle · 글이 «음악 켜기» · 노란 글(.off)');
  w.els.xmasBgmBtn.onclick();
  chk(w.els.xmasBgmBtn.textContent === '음악 끄기' && !w.els.xmasBgmBtn.classList.contains('off'), '  ↳ 다시 누르면 되돌아온다');
  w.els.xmasCreditBtn.onclick();
  chk(w.Bg.calls.includes('credit.toggle'), '[음악 출처] — credit.toggle');
  w.Lt.onPlay(true); w.Lt.onPlay(false);
  chk(w.Bg.calls.includes('bgm.duck:true') && w.Bg.calls.includes('bgm.duck:false'), '★ 편지 추천곡이 나면 배경음악이 물러나고(duck) · 멈추면 돌아온다');
  w.Lt.calls.length = 0; w.api.close();
  chk(w.Bg.calls.includes('bgm.stop') && w.Bg.calls.includes('credit.stop') && w.Bg.letterClosedAtStop === false && w.Lt.calls.includes('close'),
    '★ 닫으면 배경음악 · 출처를 멈춘다 — 편지 창 닫기보다 먼저(추천곡이 멈추는 알림에 다시 켜지지 않게)');
  const wm = world({ muted: true });
  chk(wm.els.xmasBgmBtn.textContent === '음악 켜기' && wm.els.xmasBgmBtn.classList.contains('off'), '꺼 둔 PC 는 처음부터 «음악 켜기»');
  const swap = SRC.replace("    bgm.stop(); credit.stop();   // 편지 창보다 먼저 — 추천곡이 멈추며 오는 알림(duck)에 배경음악이 다시 켜지지 않게\n    letter.close();\n", "    letter.close();\n    bgm.stop(); credit.stop();\n");
  let bad = false;
  if (swap !== SRC){ const m = { exports: {} }; new Function('module', 'window', 'TwSafeHtml', swap)(m, undefined, global.TwSafeHtml); const x = world({ mod: m.exports }); x.S.ready(); x.api.open(); await settle(); x.Lt.calls.length = 0; x.api.close(); bad = x.Bg.letterClosedAtStop === true; }
  chk(swap !== SRC && bad, 'mutation test — 닫는 순서를 바꾸면(편지 창 먼저) 위 판정이 빨강');
}

say('── 5-2절 창 마크업이 없으면 던진다(조용히 넘어가지 않음)');
{
  let threw = false;
  try { W.createXmasWindow({ doc: { getElementById: () => null }, win: {}, rules: R, treeMod: {}, net: () => ({}), serverNow: () => 0 }); } catch (e) { threw = /xmasOverlay/.test(e.message); }
  chk(threw, '#xmasOverlay · #lcXmas 가 없으면 이름을 대고 던진다');
}

say('── 6절 한마디 라벨 · mutation test');
{
  const w = world(); w.S.ready(); w.api.open(); await settle();
  w.T.onSay({ word: '<img src=x onerror=alert(1)>', x: 10, y: 20 });
  chk(w.els.xmasSay.textContent === '<img src=x onerror=alert(1)>' && !w.els.xmasSay.hidden && w.els.xmasSay.style.left === '10px', '남이 쓴 한마디는 글자 그대로(textContent)');
  w.T.onSay(null); chk(w.els.xmasSay.hidden, '닫으면 숨김');
  chk(!/innerHTML/.test(SRC.replace(/\/\*[\s\S]*?\*\//g, '')), '창 모듈에 innerHTML 없음');
  chk(/TwSafeHtml\.safeUrl\(d, 'image'\)/.test(SRC), '받은 그림 주소는 safeUrl(image) 로 거른다');
  // mutation test — 2절 «판이 바뀐 자리만» 이 사본을 안 보면 잡히는지
  const wb = world({ data: { cur: 1, mine: null, trees: { 1: { 3: { k: 'img', v: 1, id: 'idz' } } }, imgs: { idz: PNG('Z') } } }); wb.S.ready();
  wb.api.open(); await settle(); wb.api.close(); wb.N.calls.length = 0; delete wb.store['xmasimg:1/3@1'];
  wb.api.open(); await settle();
  chk(wb.N.calls.includes('img:idz'), 'mutation test — 사본이 없으면 다시 받는다(사본을 안 보면 2절이 빨강)');
}

say('── 7절 편지 창 잇기');
{
  const w = world(); w.S.ready();
  chk(w.Lt.calls.join() === 'paintBtn', '서버 시각을 받으면 단추 그리기 — 받은 편지는 읽지 않는다(폴링 없음) — ' + w.Lt.calls.join(' · '));
  w.Lt.calls.length = 0; w.timers[0][0]();
  chk(w.Lt.calls.join() === 'paintBtn', '  ↳ 1분마다 단추만 다시(25일 0시가 지나면 [편지 열람])');
  w.Lt.calls.length = 0; w.api.open(); await settle();
  chk(w.Lt.calls.join() === 'refresh', '창을 열면 맡긴 수(n/1)를 위해 편지함을 한 번');
  w.Lt.calls.length = 0; w.api.close();
  chk(w.Lt.calls.join() === 'close', '창을 닫으면 편지 창도 닫는다(추천곡 멈춤은 편지 모듈)');
  w.Lt.deps.onDot(true); chk(w.els.lcXmas.classList.contains('xm-dot'), '안 읽은 받은 편지 — 런처 [크리스마스] 빨간 점');
  w.Lt.deps.onDot(false); chk(!w.els.lcXmas.classList.contains('xm-dot'), '  ↳ 다 읽으면 지운다');
  w.Lt.calls.length = 0; w.nav.fns.xmas('letter'); await settle();
  chk(w.els.xmasOverlay.classList.contains('on') && w.Lt.calls.join() === 'refresh,open', '📩 알림함 → NAV.XMAS(\'letter\') — 트리 창 · 편지 창까지');
  w.api.close(); w.Lt.calls.length = 0; w.nav.fns.xmas(); await settle();
  chk(w.Lt.calls.join() === 'refresh', '  ↳ 이름 없이 부르면 트리 창만');
  const we = world({ now: R.LETTERS_VIEW_UNTIL_MS }); we.S.ready(); we.Lt.calls.length = 0; we.nav.fns.xmas('letter');
  chk(!we.Lt.calls.includes('open') && !we.els.xmasOverlay.classList.contains('on'), '  ↳ 끝난 뒤엔 편지 창도 안 연다');
  chk(w.Lt.songDeps.songTitleMax === R.SONG_TITLE_MAX && w.Lt.deps.rules === R, '뮤직바 · 편지 모듈은 같은 규칙 한 벌로 만든다');
}

say('── 8절 📩 받은 편지 알림');
{
  const w = world({ random: 0.5 }); w.S.ready(); w.Lt.calls.length = 0;
  const M = (o) => Object.assign({ a: { kind: 'XMAS_LETTER', read: false }, b: { kind: 'XMAS_RETURNED', read: false }, c: { kind: 'LEVEL_UNLOCK', read: false } }, o || {});
  w.api.onMail({ b: { kind: 'XMAS_RETURNED', read: false }, c: { kind: 'LEVEL_UNLOCK', read: false } });
  chk(!w.timeouts.length, '반송 알림 · 다른 알림은 읽기를 걸지 않는다');
  { // 다른 PC 에서 알림을 읽었어도(read:true) 이 PC 는 켤 때 한 번 읽는다 — 받은 편지 읽음은 이 PC 값이라
    const wr = world({ random: 0 }); wr.S.ready(); wr.Lt.calls.length = 0;
    wr.api.onMail({ x: { kind: 'XMAS_LETTER', read: true } });
    chk(wr.timeouts.length === 1, '★ 이미 읽은 받은 편지 알림도 처음 보면 한 번 읽기를 건다(다른 PC 에서 알림을 읽어도 이 PC 빨간 점이 맞게)');
    wr.timeouts[0][0](); wr.api.onMail({ x: { kind: 'XMAS_LETTER', read: true } });
    chk(wr.Lt.calls.filter(c => c === 'checkGot').length === 1 && wr.timeouts.length === 1, '  ↳ 같은 알림은 다시 걸지 않는다(켤 때 한 번)');
    const wm = world({ random: 0 }); wm.S.ready(); wm.Lt.calls.length = 0;   // 켤 때 처음 받은 목록 — 읽은 것 · 안 읽은 것 · 반송이 섞여 여럿
    wm.api.onMail({ p: { kind: 'XMAS_LETTER', read: true }, q: { kind: 'XMAS_LETTER', read: false }, r: { kind: 'XMAS_LETTER', read: true }, s: { kind: 'XMAS_RETURNED', read: false } });
    wm.timeouts.forEach(t => t[0]());
    chk(wm.timeouts.length === 1 && wm.Lt.calls.filter(c => c === 'checkGot').length === 1, '  ↳ 처음 목록에 받은 편지 알림이 여럿(읽음 섞임)이어도 기다림 하나 · 읽기 한 번');
  }
  w.api.onMail(M());
  chk(w.timeouts.length === 1 && w.timeouts[0][1] === 15000 && !w.Lt.calls.includes('checkGot'), '안 읽은 XMAS_LETTER — 곧바로가 아니라 무작위(0.5 → 15초) 뒤로 건다');
  w.api.onMail(M({ d: { kind: 'XMAS_LETTER', read: false } }));
  chk(w.timeouts.length === 1, '  ↳ 기다리는 동안 또 보이면 그 한 번으로 묶는다');
  w.timeouts[0][0]();
  chk(w.Lt.calls.filter(c => c === 'checkGot').length === 1, '  ↳ 때가 되면 받은 편지를 한 번 읽는다');
  w.api.onMail(M({ d: { kind: 'XMAS_LETTER', read: false } }));
  chk(w.timeouts.length === 1, '  ↳ 이미 본 알림은 다시 읽기를 걸지 않는다(우편이 바뀔 때마다 부르지 않게)');
  w.api.onMail(M({ e: { kind: 'XMAS_LETTER', read: false } }));
  chk(w.timeouts.length === 2, '  ↳ 새 알림(다른 id)이면 다시 한 번');
  { // 못 읽으면 그 알림을 «본 것» 에서 빼 다음 우편 변화에 다시
    const wf = world({ random: 0 }); wf.S.ready(); wf.Lt.gotOk = false;
    wf.api.onMail(M()); await wf.timeouts[0][0]();
    wf.api.onMail(M());
    chk(wf.timeouts.length === 2, '★ 받은 편지 읽기가 실패하면 그 알림을 다시 본다(다음 우편 변화에 다시 건다)');
    wf.Lt.gotOk = true; await wf.timeouts[1][0](); wf.api.onMail(M());
    chk(wf.timeouts.length === 2, '  ↳ 읽고 나면 같은 알림은 다시 걸지 않는다');
  }
  { // 세션 reset(계정 바뀜) — 기다림을 버리고 본 알림 · 창을 비운다
    const resetCase = async (mod) => {
      const wr = world({ random: 0.5, mod }); wr.S.ready(); wr.Lt.calls.length = 0;
      wr.api.open(); await settle();
      wr.api.onMail(M());
      wr.api.reset();
      const dropped = wr.cleared.includes(1);
      const closed = !wr.els.xmasOverlay.classList.contains('on');
      wr.api.onMail(M());   // B 계정에 같은 id 의 알림이 와도(본 알림을 비웠으니) 다시 건다
      return { dropped, closed, again: wr.timeouts.length === 2, letterReset: wr.Lt.calls.includes('reset') };
    };
    const r = await resetCase(null);
    chk(r.dropped && r.closed && r.letterReset, '★ reset — 기다리던 읽기를 버리고(clearTimeout) · 창을 닫고 · 편지 모듈도 비운다(점 · 받은 편지)');
    chk(r.again, '  ↳ 본 알림을 비워 다음 계정에서 다시 읽기를 건다(A → B → A 도)');
    const bad = {}; new Function('window', 'module', SRC.split("    if (gotTimer){ win.clearTimeout(gotTimer); gotTimer = null; }\n    waiting = []; seenMail.clear();\n").join(''))(bad, undefined);
    const rb = await resetCase(bad.TwXmasWindow);
    chk(!(rb.dropped && rb.again), 'mutation test — reset 이 기다림 · 본 알림을 안 비우면 위 검사가 빨강');
  }
  const w0 = world({ random: 0.999999 }); w0.S.ready(); w0.api.onMail(M());
  chk(w0.timeouts[0][1] < R.READ_JITTER_MS && R.READ_JITTER_MS === 30000, '기다림은 30초 안');
}

say('── 9절 세션 reset 뒤 늦은 답 · 켤 때 차례(startXmas)');
{
  const late = async (mod) => {
    const w = world({ mod }); w.S.ready(); w.api.open(); await settle();
    let rel; w.N.hangHold = new Promise((r) => { rel = r; });
    const p = w.els.xmasHang.onclick(); await settle();
    w.api.reset(); w.N.calls.length = 0; rel(); await p; await settle();
    return w.N.calls.join();
  };
  chk((await late(null)) === '', '★ 장식 걸기가 걸린 사이 reset — 늦은 답 뒤 트리를 다시 읽지 않는다(새 계정으로 요청 0)');
  const bad = {}; new Function('window', 'module', SRC.split('    if (my !== seq) return;   // 그 사이 창이 닫혔거나 세션이 끝났다 — 다시 읽지 않는다(새 계정으로 요청을 더 보내지 않게)').join(''))(bad, undefined);
  chk((await late(bad.TwXmasWindow)) !== '', 'mutation test — 걸기 뒤 세션 검사를 빼면 위 검사가 빨강(where · tree 를 또 부른다)');

  const run = (o, mod) => {
    const ev = [], hooks = [];
    const d = { api: { reset: () => ev.push('apiReset'), refreshSchedule: () => { ev.push('refresh'); return Promise.resolve({ ok: true }); } },
      win: o.noWin ? null : { reset: () => ev.push('winReset') }, rules: R, serverNow: () => o.sn, now: () => { ev.push('now'); return o.now; } };
    const M = mod || W;
    M.startXmas(d, { onReset: (fn) => hooks.push(fn) });
    const afterStart = ev.join();
    M.loadXmasDates(d);
    hooks.forEach(f => f());
    return { afterStart, all: ev.join() };
  };
  const D0 = R.LETTER_DEADLINE_MS;
  chk(run({ sn: D0 - 3600000 }).afterStart === '' && run({ sn: D0 - 3600000 }).all === 'refresh,apiReset,winReset', 'startXmas(READY) — 요청 0 · 세션이 끝나면 provider · 창 reset 둘 다 / loadXmasDates(LATER) — 마감 앞뒤 하루 안이면 날짜 한 벌 한 번');
  chk(run({ sn: D0 - 25 * 3600000 }).all === 'apiReset,winReset' && run({ sn: D0 + 25 * 3600000 }).all === 'apiReset,winReset', '  ↳ 하루 밖이면 읽지 않는다(요청 0)');
  chk(run({ sn: NaN, now: D0 }).all === 'now,refresh,apiReset,winReset' && run({ sn: NaN, now: D0 - 30 * 3600000 }).all === 'now,apiReset,winReset', '  ↳ 서버 시각을 모르면(NaN) 이 PC 시계로 가른다');
  chk(run({ sn: D0, noWin: true }).all === '', '  ↳ 창이 없으면(기능 꺼짐) 아무것도 안 한다');
  const mutW = (from, to) => { const b = {}; const src = SRC.split(from).join(to); new Function('window', 'module', src)(b, undefined); return src === SRC ? null : b.TwXmasWindow; };
  const k1 = mutW('session.onReset(() => { d.api.reset(); d.win.reset(); });', 'session.onReset(() => { d.win.reset(); });');
  const k2 = mutW('d.rules.nearDeadline(Number.isFinite(sn) ? sn : d.now())', 'true');
  chk(k1 && run({ sn: D0 }, k1).all !== 'refresh,apiReset,winReset', 'mutation test — provider reset 을 빼면 위 검사가 빨강');
  chk(k2 && run({ sn: D0 - 25 * 3600000 }, k2).all !== 'apiReset,winReset', 'mutation test — 하루 창을 안 보면 위 «요청 0» 이 빨강');
  chk(/xmas: \(code, me, session\)=>TwXmasWindow\.startXmas\(\{ api: xmasApiMod, win: xmasWinMod \}, session\)/.test(APP)
    && /xmasDates: \(\)=>TwXmasWindow\.loadXmasDates\(\{ api: xmasApiMod, win: xmasWinMod, rules: TwXmasRules, serverNow: \(\)=>TwRtHub\.store\.serverNow\(\), now: \(\)=>Date\.now\(\) \}\)/.test(APP),
    'app.js 차례 xmas(READY) · xmasDates(LATER) — provider · 창 · 서버 시각 · 이 PC 시계를 넘긴다');
}

say(`\n${fail ? '✗' : '✓'} ${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
