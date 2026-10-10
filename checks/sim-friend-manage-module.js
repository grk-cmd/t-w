/* ═══ 👥 sim-friend-manage-module.js — 친구 관리 모듈 · 버그 제보 탭 자리 옮김 (2026-10-10 신설 · 앱 FSD 5번) ═══════════════
   app.js 의 «🐞 버그 제보 탭» 구역에 섞여 있던 친구 쪽 코드(👋 요청 팝업 · 👥 친구 관리 · 📤 보낸 요청)를 parts/friend-manage.js 로,
   앞머리의 🐞 버그 제보 탭(오픈카톡 기본 링크)을 parts/bug-board-ui.js 끝으로 옮겼다. 동작은 그대로여야 한다.
   일괄 수락의 자리 계산 · 서브탭 클래스 공유 · 보낸 요청 미러는 sim-friend-manage 가, 선물함 표시 비우기는 sim-gift-star 가 본다.
   여기서는 «옮긴 것» 자체를 굴려 본다.
   ・1절: 만들 때 — 아무것도 안 건드린다 · 반환값 이름 · 빈 껍데기
   ・2절: 받은 요청 — (n) · 친구 탭 배지 · 최신이 위 · 체크 · 사라진 요청은 선택에서도 · 단건 수락(자리 없으면 남김) · 거절 · 빈 목록
          (_myFriendRequests · _myHomeFriends 는 읽는 함수 — 만든 뒤에 다시 대입돼도 새 값을 본다)
   ・3절: 일괄 — 수락(먼저 온 것부터 · 자리만큼) · 거절(확인 · 취소 · focus)
   ・4절: 서브탭 · 📤 보낸 요청 — setTab · tab · 살아 있는 것만 · 죽은 미러 치우기 · 이름 조회(캐시) · 취소
   ・5절: 👋 팝업 · reqVisible — 마이홈이 열려 있고(myHomeOpen 은 읽는 함수) 친구 탭 · 받은 요청 서브탭일 때만 «보인다» · 팝업 수락 · 상한
   ・6절: app.js 배선 — 정의는 모듈에만 · createFriendManage 는 원래 자리 · deps 모양 · 부르는 곳 · 빈 껍데기 · html 순서 · 전역 이름
   ・7절: 🐞 버그 제보 탭 — app.js 에 없고 bug-board-ui.js 끝(IIFE 밖 · 전역 그대로) · 링크 구독 · 관리자만 편집 · 링크 모양 · 공지는 그대로 실어 보냄
   [실행] friend-manage.js · bug-board-ui.js · app.js · desk-companion-prototype.html 이 있는 폴더에서. */
'use strict';
const fs = require('fs');
const vm = require('vm');
let pass = 0, fail = 0, done = false;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = ['friend-manage.js', 'bug-board-ui.js', 'app.js', 'desk-companion-prototype.html'];
const SRC = {};
for(const f of need){ SRC[f] = read(f); if(SRC[f] == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } }
const APP = SRC['app.js'], HTML = SRC['desk-companion-prototype.html'], MOD = SRC['friend-manage.js'], BUG = SRC['bug-board-ui.js'];
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const flush = async (n = 12) => { for(let i = 0; i < n; i++) await new Promise(r => setImmediate(r)); };

/* DOM 칸 — classList · style · 이벤트 · 자식은 진짜. innerHTML 을 쓰면 자식을 비운다 */
function mkEl(tag, id){
  const cls = new Set(), L = {};
  let html = '';
  const el = {
    tagName: String(tag || 'div').toUpperCase(), id: id || '', style: {}, dataset: {}, children: [],
    textContent: '', value: '', onclick: null, type: '', title: '', checked: false, disabled: false, indeterminate: false,
    get className(){ return [...cls].join(' '); }, set className(v){ cls.clear(); String(v).split(/\s+/).filter(Boolean).forEach(c => cls.add(c)); },
    get innerHTML(){ return html; }, set innerHTML(v){ html = v; el.children = []; },
    classList: { add: (...a) => a.forEach(c => cls.add(c)), remove: (...a) => a.forEach(c => cls.delete(c)), contains: c => cls.has(c),
      toggle: (c, on) => { const v = on === undefined ? !cls.has(c) : !!on; v ? cls.add(c) : cls.delete(c); return v; } },
    appendChild(c){ el.children.push(c); c.parent = el; return c; },
    addEventListener(t, fn){ (L[t] = L[t] || []).push(fn); }, _L: L,
    querySelector(sel){ if(el._q && el._q[sel]) return el._q[sel]; return sel[0] === '.' ? (el.children.find(c => c.classList && c.classList.contains(sel.slice(1))) || null) : null; },
    remove(){ el.removed = true; if(el.parent) el.parent.children = el.parent.children.filter(x => x !== el); },
    focus(){ el.focused = (el.focused || 0) + 1; },
  };
  return el;
}
const texts = (el) => el.children.map(c => c.textContent || (c.children || []).map(texts).join('|')).join('|');

function mkEnv(opt){
  opt = opt || {};
  const env = { toasts: [], reqs: {}, friends: {}, open: true, me: 'uA', accepted: [], rejected: [], pruned: [], canceled: [], lookups: [],
    gift: [], giftBox: 0, confirms: [], confirmAns: true, focus: 0, sent: {}, alive: {}, names: {}, failAccept: false, failReject: false };
  const els = {}, q = {};
  const byId = id => (opt.noDom ? null : (els[id] || (els[id] = mkEl('div', id))));
  const tab = (sel, data) => { const e = mkEl('button'); Object.assign(e.dataset, data); q[sel] = e; return e; };
  if(!opt.noDom){
    tab('#mhFmTabs .mh-ibx-tab[data-fm="req"]', { fm: 'req' });
    tab('#mhFmTabs .mh-ibx-tab[data-fm="sent"]', { fm: 'sent' });
    tab('#mhFmTabs .mh-ibx-tab[data-fm="gift"]', { fm: 'gift' });
    tab('#myHomeTabs .mh-tab[data-tab="friend"]', { tab: 'friend' });
  }
  env.homeTab = 'friend';
  const body = mkEl('body');
  const ctx = {
    Math, JSON, String, Number, Array, Object, Promise, Map, Set, Date, Boolean, Error, isFinite, parseInt,
    console: { warn(){}, log(){}, debug(){} },
    document: {
      body, getElementById: byId, createElement: t => mkEl(t), createTextNode: t => ({ textContent: t }),
      querySelector: sel => {
        if(sel === '#myHomeTabs .mh-tab.on') return opt.noDom ? null : Object.assign(mkEl('button'), { dataset: { tab: env.homeTab } });
        return q[sel] || null;
      },
      querySelectorAll: sel => (sel === '#mhFmTabs .mh-ibx-tab' ? ['req', 'sent', 'gift'].map(k => q['#mhFmTabs .mh-ibx-tab[data-fm="' + k + '"]']).filter(Boolean) : []),
    },
    confirm: (m) => { env.confirms.push(m); return env.confirmAns; },
    focus: () => { env.focus++; },
    setTimeout: () => 0, clearTimeout(){},
    firebaseAPI: opt.noApi ? undefined : {
      acceptFriendRequest: async (me, from) => { if(env.failAccept) throw new Error('x'); env.accepted.push(me + '<' + from); },
      rejectFriendRequest: async (me, from) => { if(env.failReject) throw new Error('x'); env.rejected.push(me + '<' + from); },
      getSentFriendRequests: async (me) => JSON.parse(JSON.stringify(env.sent)),
      isFriendRequestAlive: async (to, me) => env.alive[to] !== false,
      pruneSentFriendRequest: (me, to) => { env.pruned.push(to); },
      cancelFriendRequest: async (me, to) => { env.canceled.push(to); return { ok: env.cancelOk !== false }; },
      getUserNameById: async (uid) => { env.lookups.push(uid); return env.names[uid] || null; },
    },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(MOD, ctx, { filename: 'friend-manage.js' });
  env.ctx = ctx; env.els = els; env.q = q; env.body = body;
  env.mk = () => ctx.TwFriendManage.createFriendManage({
    getMyUserId: () => env.me,
    toast: (m) => env.toasts.push(m),
    escHtml: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    giftStat: (t) => env.gift.push(t),
    renderGiftBox: (el) => { env.giftBox++; },
    inboxTimeStr: (ts) => 'T' + ts,
    myHomeOpen: () => env.open,
    myHomeFriends: () => env.friends,
    myFriendRequests: () => env.reqs,
    friendMax: opt.max || 5,
  });
  return env;
}
const sec = async (title, fn) => { say(title); try{ await fn(); }catch(e){ chk(false, '이 절을 못 돌았다 — ' + (e && e.stack || e)); } };
const NAMES = ['showFriendRequestPopup', 'reqVisible', 'renderFriendManage', 'renderFriendRequests', 'refreshFriendReqBadge', 'lookupName',
  'bulkAccept', 'bulkReject', 'setTab', 'tab', 'picked'];

(async () => {
await sec('── 1. 만들 때 — 아무것도 안 건드린다', () => {
  const e = mkEnv(); const fm = e.mk();
  chk(NAMES.every(n => n in fm) && typeof fm.acceptOne === 'function' && typeof fm.seatsLeft === 'function', '반환값 — 부르는 곳이 쓰는 이름 열하나 + 검사용 둘');
  chk(Object.keys(e.els).length === 0 && e.body.children.length === 0 && e.toasts.length === 0, '만들 때는 DOM · 서버 · 토스트를 안 건드린다(상태 초기값뿐)');
  chk(fm.tab() === 'req' && fm.picked instanceof e.ctx.Set && fm.picked.size === 0, '처음 서브탭은 받은 요청 · 선택은 비어 있다');
  const e2 = mkEnv({ noDom: true }); const f2 = e2.mk(); let ok = true;
  try{ f2.renderFriendManage(); f2.renderFriendRequests(); f2.refreshFriendReqBadge(); chk(f2.reqVisible() === false, '  DOM 이 없으면 «안 보인다»'); }catch(_){ ok = false; }
  chk(ok, 'DOM 이 없어도 조용히');
});

await sec('── 2. 받은 요청 — 목록 · 배지 · 단건', async () => {
  const e = mkEnv(); const fm = e.mk(); const list = e.els.mhFmList || e.ctx.document.getElementById('mhFmList');
  fm.renderFriendRequests();
  chk(/받은 친구 요청이 없어요/.test(list.innerHTML) && !e.ctx.document.getElementById('mhFmBar').classList.contains('on'), '요청이 없으면 빈 안내 · 일괄 바 내림');
  e.reqs = { a: { name: '민지', ts: 1 }, b: { name: '현우', ts: 3 }, c: { name: '<소라>', ts: 2 } };   // app.js 는 구독마다 다시 대입한다
  fm.renderFriendRequests();
  chk(e.q['#mhFmTabs .mh-ibx-tab[data-fm="req"]'].textContent === '👋 받은 요청 (3)', '서브탭 이름에 (3) — 만든 뒤에 다시 대입된 값을 본다(읽는 함수)');
  const badge = e.q['#myHomeTabs .mh-tab[data-tab="friend"]'].children[0];
  chk(badge && badge.className === 'mh-tab-badge' && badge.textContent === '3' && badge.style.display === 'inline-block', '친구 탭 배지 3');
  chk(list.children.length === 3 && list.children.map(r => r.children[1].children[0].textContent).join() === '현우,<소라>,민지', '최신이 위 · 이름은 textContent(이스케이프 없이 글자 그대로)');
  chk(list.children[0].children[1].children[1].textContent === 'T3', '  시각은 _inboxTimeStr');
  chk(/3개 요청/.test(e.els.mhFmBarSel.textContent) && e.els.mhFmAcceptSel.disabled === true, '일괄 바 — 선택 없음이면 버튼 잠금');
  const cb = list.children[0].children[0]; cb.checked = true; cb.onclick();
  chk(fm.picked.has('b') && list.children[0].classList.contains('picked') && /3개 중 1개 선택됨/.test(e.els.mhFmBarSel.textContent) && e.els.mhFmAll.indeterminate === true, '체크하면 선택 · 줄 표시 · 바 갱신');
  e.reqs = { a: e.reqs.a, c: e.reqs.c }; fm.renderFriendRequests();
  chk(!fm.picked.has('b'), '사라진 요청은 선택에서도 뺀다');
  const ok = list.children[1].children[2].children[0];   // a(민지) — 수락
  await ok.onclick(); await flush();
  chk(e.accepted.join() === 'uA<a' && e.toasts.includes('민지 님과 친구가 됐어요'), '단건 수락');
  e.friends = { f1: 1, f2: 2, f3: 3, f4: 4, f5: 5 };   // 상한 5 — 자리 없음
  const ok2 = list.children[0].children[2].children[0];
  await ok2.onclick(); await flush();
  chk(e.accepted.length === 1 && e.toasts.includes('친구는 최대 5명까지만 추가할 수 있어요') && ok2.disabled === false, '자리가 없으면 수락 안 함 · 요청은 남김 · 버튼 다시 풀림(_myHomeFriends 는 읽는 함수)');
  const no = list.children[0].children[2].children[1];
  await no.onclick(); await flush();
  chk(e.rejected.join() === 'uA<c', '단건 거절');
  e.reqs = {}; fm.renderFriendRequests();
  chk(badge.style.display === 'none', '요청이 다 없어지면 배지 숨김');
  const many = {}; for(let i = 0; i < 12; i++) many['k' + i] = { ts: i }; e.reqs = many; fm.refreshFriendReqBadge();
  chk(badge.textContent === '9+', '10개 넘으면 9+');
});

await sec('── 3. 일괄 — 수락 · 거절', async () => {
  const e = mkEnv({ max: 5 }); const fm = e.mk();
  e.friends = { f1: 1, f2: 2, f3: 3, f4: 4 };   // 자리 1
  e.reqs = { a: { name: 'A', ts: 3 }, b: { name: 'B', ts: 1 }, c: { name: 'C', ts: 2 } };
  ['a', 'b', 'c'].forEach(id => fm.picked.add(id));
  await fm.bulkAccept(); await flush();
  chk(e.accepted.join() === 'uA<b', '자리 1칸 — 먼저 온 요청(b) 하나만');
  chk(e.toasts.includes('1명과 친구가 됐어요') && e.toasts.some(t => /2건은 자리가 없어 그대로 남겨뒀어요/.test(t)), '  받은 수 · 남긴 수 안내');
  chk(!fm.picked.has('b') && fm.picked.has('a') && fm.picked.has('c'), '  받은 것만 선택에서 빠진다');
  fm.picked.clear(); await fm.bulkAccept();
  chk(e.toasts.includes('선택된 요청이 없어요'), '선택이 없으면 안내');
  fm.picked.add('a'); fm.picked.add('c'); e.confirmAns = false;
  await fm.bulkReject();
  chk(e.confirms[0] === '2건의 친구 요청을 거절할까요?' && e.rejected.length === 0 && e.focus === 1, '거절 — 확인을 묻고, 취소하면 아무것도 안 함(창 focus 보정)');
  e.confirmAns = true; await fm.bulkReject(); await flush();
  chk(e.rejected.join() === 'uA<a,uA<c' && e.toasts.includes('2건을 거절했어요') && e.focus === 2 && fm.picked.size === 0, '확인하면 거절 · 선택 비움');
});

await sec('── 4. 서브탭 · 📤 보낸 요청', async () => {
  const e = mkEnv(); const fm = e.mk(); const list = e.ctx.document.getElementById('mhFmList');
  fm.setTab('gift'); fm.renderFriendManage();
  chk(fm.tab() === 'gift' && e.giftBox === 1 && e.q['#mhFmTabs .mh-ibx-tab[data-fm="gift"]'].classList.contains('on'), '선물함 서브탭 — renderGiftBox · on 표시');
  chk(e.gift.length === 0, '  선물함에서는 표시를 안 비운다');
  e.sent = { x: { ts: 1, toName: '지수', toCode: 'MATE-1' }, y: { ts: 2 }, z: { ts: 3, toCode: 'MATE-3' } };
  e.alive = { x: true, y: true, z: false }; e.names = { y: '도윤' };
  fm.setTab('sent'); fm.renderFriendManage(); await flush();
  chk(e.gift.join() === '', '보낸 요청 서브탭 — 선물함 표시를 비운다(_giftStat(\'\'))');
  chk(e.pruned.join() === 'z' && list.children.length === 2, '살아 있는 것만 · 죽은 미러는 치운다');
  const nm0 = list.children[0].children[0].children[0], nm1 = list.children[1].children[0].children[0];
  chk(nm1.children.map(c => c.textContent).join('') === '지수 (MATE-1)' && nm1.children[1].className === 'mh-req-code', '이름표 — 닉네임 (코드), 코드는 .mh-req-code');
  chk(nm0.textContent === '도윤' && e.lookups.join() === 'y', '이름이 없던 줄은 뒤늦게 조회해 채운다(최근 것이 위)');
  chk(e.q['#mhFmTabs .mh-ibx-tab[data-fm="sent"]'].textContent === '📤 보낸 요청 (2)', '서브탭 이름 (2)');
  chk(await fm.lookupName('y') === '도윤' && e.lookups.length === 1, 'lookupName — 캐시(같은 사람은 다시 안 묻는다)');
  await list.children[0].children[2].children[0].onclick(); await flush();
  chk(e.canceled.join() === 'y' && e.toasts.includes('요청을 취소했어요') && list.children.length === 1, '취소 — 서버 · 줄 빼기');
  chk(e.q['#mhFmTabs .mh-ibx-tab[data-fm="sent"]'].textContent === '📤 보낸 요청 (1)', '  (n) 갱신');
  e.sent = {}; fm.renderFriendManage(); await flush();
  chk(/기다리는 중인 요청이 없어요/.test(list.innerHTML), '없으면 빈 안내');
});

await sec('── 5. 👋 팝업 · reqVisible', async () => {
  const e = mkEnv({ max: 2 }); const fm = e.mk();
  chk(fm.reqVisible() === true, '마이홈 열림 · 친구 탭 · 받은 요청 서브탭이면 «보인다»');
  e.open = false; chk(fm.reqVisible() === false, '  마이홈이 닫히면 아니다(myHomeOpen 은 읽는 함수)');
  e.open = true; e.homeTab = 'mail'; chk(fm.reqVisible() === false, '  다른 탭이면 아니다');
  e.homeTab = 'friend'; fm.setTab('sent'); chk(fm.reqVisible() === false, '  다른 서브탭이면 아니다');
  /* 팝업 버튼은 innerHTML 안이라 이 가짜 DOM 에서 못 꺼낸다 — 만드는 칸마다 [data-a] 버튼을 미리 심어 둔다 */
  const okBtn = mkEl('button'), noBtn = mkEl('button');
  const realCreate = e.ctx.document.createElement;
  e.ctx.document.createElement = (t) => { const el = realCreate(t); el._q = { '[data-a="ok"]': okBtn, '[data-a="no"]': noBtn }; return el; };
  e.reqs = { a: { name: '<민지>', ts: 2 }, b: { name: '현우', ts: 1 } };
  const p1 = fm.showFriendRequestPopup(['a']); await flush();
  const ov = e.body.children[0];
  chk(ov && /friend-req-popup-ov/.test(ov.className) && /&lt;민지&gt;/.test(ov.children[0].innerHTML) && e.body.children.length === 1, '고른 요청(a)만 팝업 — 이름은 escHtml');
  fm.showFriendRequestPopup(['b']); await flush();
  chk(e.body.children.length === 1, '  떠 있는 동안은 또 안 띄운다');
  okBtn.onclick(); await p1; await flush();
  chk(e.accepted.join() === 'uA<a' && e.toasts.includes('<민지> 님과 친구가 됐어요') && e.body.children.length === 0, '팝업 [수락] — 서버 수락 · 팝업 닫힘');
  e.friends = { f1: 1, f2: 2 }; e.reqs = { b: { name: '현우', ts: 1 } };
  const p2 = fm.showFriendRequestPopup(); await flush(); okBtn.onclick(); await p2; await flush();
  chk(e.accepted.length === 1 && e.toasts.some(t => /최대 2명까지만/.test(t)), '  상한이면 수락 안 하고 남김(_myHomeFriends 는 읽는 함수)');
  const p3 = fm.showFriendRequestPopup(); await flush(); noBtn.onclick(); await p3; await flush();
  chk(e.rejected.join() === 'uA<b', '팝업 [거절]');
  e.reqs = {}; await fm.showFriendRequestPopup(['zz']);
  chk(e.body.children.length === 0, '물을 요청이 없으면 안 띄운다');
});

await sec('── 6. app.js 배선', () => {
  const code = strip(APP);
  chk(!/function (showFriendRequestPopup|_fmSentLabel|_fmSentFillName|_fmLookupName|_fmReqVisible|_fmSeatsLeft|renderFriendManage|renderSentRequests|_fmSyncSentCount|_fmAcceptOne|_fmSyncBar|renderFriendRequests|_fmBulkAccept|_fmBulkReject|_refreshFriendReqBadge)\(|\blet (_fmTab|_fmPicked|_fmSent|_fmSentBusy|_friendReqPopupBusy)\b|\b_fmNameCache\b/.test(code),
    '친구 관리 정의는 app.js 에 없다(모듈에만)');
  chk(!/\b(_fmTab|_fmPicked|_fmLookupName|_fmReqVisible|_fmBulkAccept|_fmBulkReject|_refreshFriendReqBadge)\b/.test(code), '  옛 이름으로 부르는 곳도 없다(friendManage.이름)');
  chk(/window\.TwFriendManage = api/.test(MOD) && (code.match(/TwFriendManage\.createFriendManage\(/g) || []).length === 1, '모듈은 window.TwFriendManage · createFriendManage 는 한 곳');
  const iMk = APP.indexOf('TwFriendManage.createFriendManage('), iPrev = APP.indexOf('MhScheduler.createScheduler('), iNext = APP.indexOf('let _myHomeReady = false;');
  chk(iPrev > 0 && iMk > iPrev && iNext > iMk, '원래 자리 — 📅 스케줄러 연결 뒤 · 마이홈 준비(_myHomeReady) 앞');
  const call = (APP.match(/TwFriendManage\.createFriendManage\(\{([\s\S]*?)\n\}\);/) || [])[1] || '';
  const deps = call.split('\n').map(s => s.trim()).filter(Boolean);
  chk(deps.length === 10 && deps.filter(l => !/^friendMax:/.test(l)).every(l => /^\w+: (\(\)=>|\(\.\.\.a\)=>)/.test(l)) && /friendMax: FRIEND_MAX,/.test(call),
    'deps 10개 — 함수 · 다시 대입되는 let 은 화살표, 상한은 FRIEND_MAX 값 (' + deps.length + ')');
  chk(/myHomeOpen: \(\)=>myHomeOpen,/.test(call) && /myHomeFriends: \(\)=>_myHomeFriends,/.test(call) && /myFriendRequests: \(\)=>_myFriendRequests,/.test(call),
    '다시 대입되는 let(myHomeOpen · _myHomeFriends · _myFriendRequests)은 읽는 함수로');
  const m = strip(MOD).replace(/const (_myFriendRequests|_myHomeFriends|myHomeOpen) = deps\.\w+;/g, '');
  chk(!/\b_myFriendRequests\b(?!\(\))/.test(m) && !/\b_myHomeFriends\b(?!\(\))/.test(m) && !/\bmyHomeOpen\b(?!\(\))/.test(m), '모듈 본문은 읽는 함수만 부른다(값으로 쓰면 늘 참 · 옛 값이 된다)');
  const off = (APP.match(/const FRIEND_MANAGE_OFF = \{([\s\S]*?)\};/) || [])[1] || '';
  chk(NAMES.every(n => new RegExp('\\b' + n + '\\s*(\\(|:)').test(off)), '빈 껍데기 FRIEND_MANAGE_OFF 가 부르는 이름 열하나를 다 갖는다');
  const used = [...new Set([...code.matchAll(/\bfriendManage\.(\w+)/g)].map(x => x[1]))];
  chk(used.length >= 10 && used.every(n => NAMES.includes(n)), '부르는 곳은 friendManage.이름 — 반환값에 있는 이름만 (' + used.join(' · ') + ')');
  const iF = HTML.indexOf('<script src="parts/friend-manage.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
  chk(iF > 0 && iF < iA, 'html — friend-manage.js 를 app.js 앞에 싣는다');
  chk(/^Tw[A-Z]/.test('TwFriendManage') && !/window\.FriendManage\s*=/.test(MOD), '전역 이름은 Tw 접두사(#103 — 크로미움 내장 전역과 겹치지 않게)');
});

await sec('── 7. 🐞 버그 제보 탭 — bug-board-ui.js 끝', async () => {
  const code = strip(APP);
  chk(!/bindBugReport|_bugReportConf|_bugReportLink|subscribeBugReport|setBugReport|mhBugEditBtn/.test(code), 'app.js 에 버그 제보 탭 코드가 없다');
  const iI = BUG.indexOf('})();\n\n/* ↓ app.js 에서 옮긴'), iB = BUG.indexOf('(function bindBugReport(){');
  chk(iB > 0 && /^let _bugReportConf = null;/m.test(BUG) && /^window\._bugReportLink = /m.test(BUG), 'bug-board-ui.js 맨 앞 칸 — 전역 이름 그대로(_bugReportConf · window._bugReportLink)');
  chk(iI > 0 && iB > iI, '  게시판 IIFE 뒤(밖)에 있다');
  const iBU = HTML.indexOf('<script src="parts/bug-board-ui.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
  const iFB = HTML.indexOf('<script type="module" src="parts/firebase-init.js"></script>');
  chk(iBU > iA && iFB > 0, 'html — bug-board-ui.js 는 app.js 뒤 · firebase-init.js 는 module(classic 스크립트가 다 돈 뒤에 돈다 → firebase-ready 를 놓치지 않는다)');
  /* 굴려 보기 — 게시판 IIFE 는 DOMContentLoaded 를 기다리게 두고(loading), 끝의 버그 제보 탭만 돈다 */
  const env = { toasts: [], saved: [], L: {}, admin: false };
  const els = {};
  const ctx = {
    Math, JSON, String, Number, Array, Object, Promise, Map, Set, Date, Boolean, Error, RegExp,
    console: { warn(){}, log(){} }, setTimeout: () => 0,
    document: { readyState: 'loading', addEventListener(){}, getElementById: id => (els[id] || (els[id] = mkEl('div', id))) },
    addEventListener: (t, fn, o) => { env.L[t] = fn; },
    toast: (m) => env.toasts.push(m),
    _saveFailMsg: (e, fb) => 'F:' + fb,
    escHtml: (s) => s,
  };
  Object.defineProperty(ctx, 'isAdmin', { get: () => env.admin });
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(BUG, ctx, { filename: 'bug-board-ui.js' });
  chk(typeof ctx._bugReportLink === 'function' && ctx._bugReportLink() === '', 'window._bugReportLink — 아직 안 받았으면 빈 문자열');
  chk(typeof env.L['firebase-ready'] === 'function', 'firebaseAPI 가 아직 없으면 firebase-ready 를 기다린다');
  let subCb = null;
  ctx.firebaseAPI = { subscribeBugReport: (cb) => { subCb = cb; }, setBugReport: async (n, l) => { if(env.failSave) throw new Error('denied'); env.saved.push([n, l]); } };
  env.L['firebase-ready']();
  subCb({ notice: '공지글', link: 'https://open.kakao.com/o/abc', ts: 1 });
  chk(ctx._bugReportLink() === 'https://open.kakao.com/o/abc', '구독이 오면 기본 링크를 돌려준다');
  const form = els.mhBugEditForm; form.style.display = 'none';
  els.mhBugEditBtn._L.click[0]();
  chk(form.style.display === 'none', '관리자가 아니면 편집 칸을 안 연다');
  env.admin = true; els.mhBugEditBtn._L.click[0]();
  chk(form.style.display === 'block' && els.mhBugLinkInput.value === 'https://open.kakao.com/o/abc', '관리자 — 편집 칸에 지금 링크');
  els.mhBugLinkInput.value = 'http://evil.example/'; await els.mhBugSaveBtn._L.click[0]();
  chk(env.saved.length === 0 && /open\.kakao\.com/.test(els.mhBugEditMsg.textContent), '오픈카톡 주소가 아니면 저장 안 함');
  els.mhBugLinkInput.value = ' https://open.kakao.com/o/new '; await els.mhBugSaveBtn._L.click[0](); await flush();
  chk(env.saved.length === 1 && env.saved[0][0] === '공지글' && env.saved[0][1] === 'https://open.kakao.com/o/new' && form.style.display === 'none', '저장 — 있던 공지글을 그대로 실어(규칙이 notice 필수) · 칸 닫기');
  env.failSave = true; els.mhBugEditBtn._L.click[0](); await els.mhBugSaveBtn._L.click[0](); await flush();
  chk(/^F:저장에 실패했어요/.test(els.mhBugEditMsg.textContent) && els.mhBugSaveBtn.disabled === false, '실패 — _saveFailMsg 안내 · 버튼 다시 풀림');
  env.admin = false; await els.mhBugSaveBtn._L.click[0]();
  chk(env.toasts.includes('관리자만 수정할 수 있어요'), '저장 때 관리자를 한 번 더 확인');
});

say('');
say(fail ? ('✗ ' + fail + '건 어긋남 · 통과 ' + pass) : ('✅ 전부 통과 ' + pass));
console.log(pass + ' · ' + fail);
done = true;
process.exit(fail ? 1 : 0);
})();
/* 기다리던 약속이 영영 안 풀려 이벤트 고리가 비면 node 는 0 으로 조용히 끝난다 — 판정 줄 없이 끝나면 빨강 */
process.on('exit', () => { if(!done){ console.log('  ✗ 끝까지 못 돌았다 — 기다리던 응답이 오지 않았다\n' + pass + ' · ' + (fail + 1)); process.exitCode = 1; } });
