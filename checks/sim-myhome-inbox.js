/* ═══ 📩 sim-myhome-inbox.js — 수령함 · 선물함 · 마이홈 친구 목록 모듈 (2026-10-13 신설 · 앱 FSD 15번) ═══════════════
   app.js 의 «📩 수령함 상태» 함수 · «👥 마이홈 친구 목록 · Ctrl+F 검색» · «📩 수령함 · 💝 선물함 그리기» 와
   sanitize 구역 사이의 친구 방 표시 둘을 parts/myhome/myhome-inbox.js 로 옮겼다. 동작은 그대로여야 한다 — 가짜 DOM 위에서 굴린다.
   ・1절: 만들 때 — 싣기만 하면 window.TwMyHomeInbox 뿐 · 만들 때 DOM · 서버 · 저장소를 안 건드린다 · 상태 초기값
   ・2절: 수령함 셈 — 개인 + 공용 공지 합치기(읽음은 로컬 집합) · 안 읽은 수 · 보상 수 · 우편함 탭 배지(9+ · 숨김) · 모두 읽음 ·
           app.js 가 다시 대입한 수령함을 부를 때마다 읽는다
   ・3절: 우편함 그리기 — 왼쪽 메뉴(칸 · 안 읽은 수) · 📩 우편 카드(모두에게 보낸 우편도 · 최신순 · 펼치면 읽음 — 개인 = 서버 · 공지 = 로컬 ·
           🐞 답변은 버그제보 글로 · × 삭제 · 📌 단추는 관리자 + 공지만 · 읽은 우편 지우기) · 📢 소식(종류 · 고정은 늘 위 · 고르면 본문 · 읽음 ·
           관리자 고정 · 지우기 확인) · 📘 도움말(준비 중) · 처음 칸 · 옛 필터 값은 '전체' 로
   ・4절: 링크 — 이스케이프 먼저 · 주소 · 끝 문장부호 · 라이선스 키 · 위임은 한 번만 · 누르면 외부 브라우저 · 키 복사
   ・5절: 선물함 — 불러오는 중 → 격자 30칸 · 「⭐ n/20 · 보관 m/30」 · ⭐ 토글 저장 · 상한 · 다시 불러오기 · ⭐ 우클릭 막힘 · 삭제 확인창(#myHomeWin 안)
   ・6절: 친구 목록 — (n/상한) · 비었을 때 · 온라인 / 오프라인 이름순 · 검색(전체 수 그대로 · 찾음 · 없음) · 강조 이스케이프 ·
           시크릿룸 코드 숨김 · 🏠 · 선택 · 놀러 가기 칸 · 삭제 확인 · 검색줄 닫으면 검색어도 비움
   ・7절: app.js 배선 — 정의는 모듈에만 · 만드는 곳 한 곳 · 원래 자리 · deps 모양 · 빈 껍데기 · 부르는 곳 · html 순서 · 전역 이름
   ・8절: 일부러 깨 보기 — 모듈 · app.js 글을 조금씩 망가뜨려 2~7절이 잡아내는지(이 검사가 헛돌지 않는지) 스스로 확인
   [실행] myhome-inbox.js · app.js · desk-companion-prototype.html 이 있는 폴더에서. */
'use strict';
globalThis.TwSafeHtml = require([__dirname, process.cwd()].flatMap(d => ['safe-html.js', 'parts/shared/safe-html.js', 'app/parts/shared/safe-html.js'].map(p => require('path').join(d, p))).find(p => require('fs').existsSync(p)));   // 🛡️ 모듈이 부르는 공용 씻기 — 진짜 파일
const { joinRenderer: _joinRenderer } = require('./sim-renderer-src.js');   // 앱 FSD 로 옮긴 모듈을 «옮기기 전 app.js 글» 로 되살려 읽는다
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = ['myhome-inbox.js', 'app.js', 'desk-companion-prototype.html', 'myhome-hooks.js', 'inbox-sections.js'];
const SRC = {};
for(const f of need){ SRC[f] = read(f); if(SRC[f] == null){ console.log('  ? 원본 못 찾음 — ' + f); process.exit(2); } }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
const escHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const flush = () => new Promise(r => setImmediate(r));

/* ── 가짜 DOM — 이 모듈이 쓰는 만큼만 ── */
function mkEl(tag, env){
  const L = {};
  const el = {
    tagName: String(tag || 'div').toUpperCase(), id: '', className: '', style: {}, dataset: {}, title: '', textContent: '', children: [], parent: null,
    onclick: null, oncontextmenu: null, _L: L, _html: '', removed: false, _stubs: {},
    get innerHTML(){ return el._html; },
    set innerHTML(v){ el._html = String(v); el.children = []; el._stubs = {}; },
    classList: {
      add: (c) => { const s = new Set(el.className.split(/\s+/).filter(Boolean)); s.add(c); el.className = [...s].join(' '); },
      remove: (c) => { el.className = el.className.split(/\s+/).filter(x => x && x !== c).join(' '); },
      contains: (c) => el.className.split(/\s+/).includes(c),
      toggle: (c, f) => { const on = f === undefined ? !el.classList.contains(c) : !!f; on ? el.classList.add(c) : el.classList.remove(c); return on; },
    },
    appendChild(c){ c.parent = el; el.children.push(c); return c; },
    remove(){ el.removed = true; if(el.parent){ el.parent.children = el.parent.children.filter(x => x !== el); el.parent = null; } },
    addEventListener(t, fn){ (L[t] = L[t] || []).push(fn); },
    fire(t, ev){ (L[t] || []).slice().forEach(fn => fn(Object.assign({ preventDefault(){ ev._pd = true; }, stopPropagation(){ ev._sp = true; } }, ev))); },
    /* .a.b — 붙인 자식 가운데 클래스를 다 가진 것, 없으면 innerHTML 의 class="…" 에 다 든 칸(한 칸에 하나뿐인 가짜) */
    querySelector(sel){
      const want = sel.split('.').filter(Boolean);
      const walk = (n) => { for(const c of n.children){ const cs = c.className.split(/\s+/); if(want.every(w => cs.includes(w))) return c; const d = walk(c); if(d) return d; } return null; };
      const hit = walk(el); if(hit) return hit;
      if(el._stubs[sel]) return el._stubs[sel];
      const attrs = [...el._html.matchAll(/class="([^"]*)"/g)].map(m => m[1].split(/\s+/));
      if(attrs.some(cs => want.every(w => cs.includes(w)))){ const s = mkEl('span', env); s.className = want.join(' '); el._stubs[sel] = s; return s; }
      return null;
    },
  };
  return el;
}
function mkEnv(o){
  o = o || {};
  const env = { calls: [], toasts: [], store: new Map(), domCalls: 0, confirmAns: true, focused: 0, opened: [], copied: [], bell: 0, profileRail: 0, homeView: [], bugOpen: [], respawn: [] };
  const byId = {};
  const doc = {
    body: mkEl('body', env),
    getElementById(id){ env.domCalls++; if(byId[id]) return byId[id]; const walk = (n) => { for(const c of n.children){ if(c.id === id) return c; const d = walk(c); if(d) return d; } return null; };
      for(const k of Object.keys(byId)){ const d = walk(byId[k]); if(d) return d; } return null; },
    querySelector(q){ env.domCalls++; return (env.q || {})[q] || null; },
    querySelectorAll(q){ env.domCalls++; return (env.qa || {})[q] || []; },
    createElement(t){ return mkEl(t, env); },
    execCommand(){ return true; },
  };
  env.byId = byId; env.doc = doc;
  env.reg = (id) => { const e = mkEl('div', env); e.id = id; byId[id] = e; return e; };
  const api = {
    removeFriend: async (u, f) => { env.calls.push('removeFriend ' + u + ' ' + f); },
    getMallangGifts: async (u) => { env.calls.push('getMallangGifts ' + u); return env.gifts; },
    setMallangGiftStarred: async (u, k, on) => { env.calls.push('star ' + k + ' ' + on); return { ok: env.starOk !== false }; },
    deleteInboxBroadcast: async (id) => { env.calls.push('deleteInboxBroadcast ' + id); },
    deleteInboxMessage: async (u, id) => { env.calls.push('deleteInboxMessage ' + u + ' ' + id); },
    setInboxBroadcastPinned: async (id, on) => { env.calls.push('pin ' + id + ' ' + on); return { ok: true }; },
    markInboxRead: (u, id) => { env.calls.push('markInboxRead ' + u + ' ' + id); },
  };
  const companion = { openBrowser: (u) => env.opened.push(u) };
  const win = {
    firebaseAPI: api, companion, focus(){ env.focused++; },
    _mallangGiftLimits: { max: 30, starMax: 20 },
    _mallangIsGiftHidden: (k) => k === 'g-out',
    _mallangGiftOrder: (g) => Object.keys(g).sort((a, b) => (g[b].ts || 0) - (g[a].ts || 0)),   // 🧸 mallang.js 가 부팅 때 건다 — 여기선 ⭐ 없이 최신순만
    _mallangRespawnGift: (k, img, msg) => { env.respawn.push(k + '|' + img + '|' + msg); return env.respawnAns || 'ok'; },
    _mallangDeleteGift: async (k) => { env.calls.push('deleteGift ' + k); return 'ok'; },
    _mallangOpenGift: (fid, nm) => env.calls.push('openGift ' + fid + ' ' + nm),
    _bugBoardOpen: (id) => env.bugOpen.push(id),
  };
  const ls = { getItem: (k) => env.store.has(k) ? env.store.get(k) : null, setItem: (k, v) => env.store.set(k, String(v)) };
  const nav = { clipboard: { writeText: (t) => env.copied.push(t) } };
  const confirmFn = () => env.confirmAns;
  const sb = { window: win, module: undefined };
  /* 🪝 마이홈 고리판 — 테마 다시 걸기는 myhome-edit.js 가 부팅 때 건다(여기선 아무 일 없음) */
  const hw = {}; new Function('window', 'module', SRC['myhome-hooks.js'])(hw, undefined);
  hw.TwMyHomeHooks.on(hw.TwMyHomeHooks.HOOK.APPLY_THEME, () => {});
  /* 📩 우편함 칸 나누기 규칙 — 진짜 모듈(inbox-sections.js)을 싣는다 */
  const sw = {}; new Function('window', 'module', SRC['inbox-sections.js'])(sw, undefined);
  new Function('window', 'module', 'document', 'localStorage', 'firebaseAPI', 'companion', 'navigator', 'confirm', 'queueMicrotask', 'TwMyHomeHooks', 'TwInboxSections', o.src || SRC['myhome-inbox.js'])
    (sb.window, undefined, doc, ls, api, companion, nav, confirmFn, (fn) => fn(), hw.TwMyHomeHooks, sw.TwInboxSections);
  env.win = win;
  env.myInbox = {}; env.bc = {}; env.friends = {}; env.admin = false; env.notice = null;
  env.mk = (extra) => win.TwMyHomeInbox.createMyHomeInbox(Object.assign({
    escHtml, toast: (m) => env.toasts.push(m), getMyUserId: () => 'ME01',
    myInbox: () => env.myInbox, inboxBroadcast: () => env.bc, INBOX_BC_READ_KEY: 'tw.inboxBcRead', isAdmin: () => env.admin,
    mhScheduler: { refreshBellBadge: () => { env.bell++; } },
    myHomeFriends: () => env.friends, friendsNotice: () => env.notice, FRIEND_MAX: 100, friendVisit: o.noVisit ? null : { ask: (fid) => env.calls.push('visit ' + fid) },
    mhStripHtml: (h) => String(h || '').replace(/<[^>]*>/g, ''),
    starFromRemote: (f) => (f && f.star) ? { color: f.star, cyc: 2, lv: 7 } : null, lvStarBadgeClass: () => 'lv-star lvx', lvStarStr: (n) => '★' + n,
    lvBadgeClass: (n) => 'lv' + n, openFriendHomeView: (fid) => env.homeView.push(fid), renderMhProfileRail: () => { env.profileRail++; },
  }, extra || {}));
  return env;
}

/* 2~6절 — 8절(일부러 깨 보기)이 망가뜨린 글로 다시 굴린다 */
async function behave(src){
  const E = (o) => mkEnv(Object.assign({ src }, o || {}));
  const today = new Date(2026, 9, 13, 15, 7).getTime();

  say('── 2. 수령함 셈');
  {
    const e = E(); const m = e.mk();
    e.myInbox = { p1: { tag: 'reward', title: '보상', ts: 5, read: false }, p2: { tag: 'notice', title: '알림', ts: 6, read: true } };
    e.bc = { b1: { tag: 'update', title: '새 판', ts: 7 }, b2: { tag: 'reward', title: '공지 보상', ts: 8 } };
    e.store.set('tw.inboxBcRead', JSON.stringify(['b1']));
    const mg = m.inboxMerged();
    chk(mg.p1._src === 'personal' && mg.b1._src === 'broadcast' && mg.b1.read === true && mg.b2.read === false && Object.keys(mg).length === 4, '개인 + 공용 공지를 합친다 · 공지 읽음은 로컬 집합(tw.inboxBcRead)');
    chk(m.inboxUnreadCount() === 2, '안 읽은 수 2(우편 + 소식)');
    e.myInbox = { p9: { tag: 'reward', ts: 1 } };   // 구독이 다시 대입한다
    chk(m.inboxUnreadCount() === 2 && m.inboxMerged().p9 && !m.inboxMerged().p1, '  app.js 가 다시 대입한 수령함을 부를 때마다 읽는다');
    const tab = mkEl('span', e); e.q = { '.mh-tab[data-tab="mail"]': tab };
    m.refreshFriendTabBadge();
    let b = tab.children[0];
    chk(b && b.className === 'mh-tab-badge' && b.textContent === '2' && b.style.display === 'inline-block', '우편함 탭 배지 — 안 읽은 수 합계(우편 + 소식)');
    e.myInbox = {}; for(let i = 0; i < 12; i++) e.myInbox['r' + i] = { tag: 'reward', ts: i };
    m.refreshFriendTabBadge();
    chk(tab.children.length === 1 && b.textContent === '9+', '  열 개가 넘으면 9+ · 배지는 하나');
    e.myInbox = {}; e.bc = {};
    m.refreshFriendTabBadge();
    chk(b.style.display === 'none', '  없으면 숨긴다');
    e.bc = { b1: {}, b3: {} };
    m.inboxBcMarkAllRead();
    chk(JSON.parse(e.store.get('tw.inboxBcRead')).sort().join() === 'b1,b3', '모두 읽음 — 공지 id 를 로컬 집합에 더한다');
    e.q = {};
    m.refreshFriendTabBadge();
    chk(true, '  탭이 없으면 조용히 지나간다');
  }

  say('── 3. 우편함 그리기');
  {
    const e = E(); const m = e.mk();
    const body = e.reg('mhInboxBody');
    const ids3 = ['mhInboxList', 'mhInboxFootInfo', 'mhNewsList', 'mhNewsView', 'mhInboxPane-mail', 'mhInboxPane-news', 'mhInboxPane-help', 'myHomeWin'];
    const R = {}; ids3.forEach(id => { R[id] = e.reg(id); });
    const list = R.mhInboxList, nList = R.mhNewsList, view = R.mhNewsView;
    const rail = ['mail', 'news', 'help'].map(sec => { const b = mkEl('button', e); b.dataset.sec = sec; if(sec !== 'help'){ const n = mkEl('span', e); n.className = 'mh-ibx-secn'; b.appendChild(n); } return b; });
    const tabs = ['all', 'notice', 'update'].map(t => { const x = mkEl('span', e); x.dataset.tag = t; return x; });
    e.qa = { '#mhInboxRail .mh-ibx-sec': rail, '#mhInboxTabs .mh-ibx-tab': tabs };
    e.myInbox = {
      a: { tag: 'notice', title: '옛 알림', body: '본문 https://x.io/a.', ts: 100, read: false },
      b: { tag: 'reward', title: '보상', body: '키 ABCD-EFGH-1234-5678', ts: 300, read: true },
      c: { tag: 'bug', title: '답변', body: '…', ts: 200, read: false, bugId: 'B9' },
      d: { tag: 'weird', title: '모르는 태그', ts: 50, read: true },
    };
    e.bc = { p: { tag: 'update', title: '고정 공지', ts: 10, pinned: true }, q: { tag: 'notice', title: '새 공지', body: '공지 본문 https://y.io', ts: 400 },
      r: { tag: 'reward', title: '모두에게 보상', ts: 350 }, u: { tag: 'update', title: '지난 판', ts: 250 } };
    e.store.set('tw.inboxBcRead', JSON.stringify(['u']));
    const card = (i) => list.children[i];
    const part = (i, cls) => { const row = card(i).children[0]; const walk = (n) => { for(const c of n.children){ if(c.className.split(/\s+/).includes(cls)) return c; const d = walk(c); if(d) return d; } return null; }; return walk(row); };
    const titles = () => list.children.map((c, i) => part(i, 'mh-ibx-title').textContent);
    m.setInboxSec('mail'); m.setInboxFilter('gift'); m.renderInbox();
    chk(m.state().inboxFilter === 'all', "옛 필터 값('gift')은 '전체' 로 되돌린다(목록이 통째로 비지 않게)");
    chk(R['mhInboxPane-mail'].classList.contains('on') && !R['mhInboxPane-news'].classList.contains('on') && !R['mhInboxPane-help'].classList.contains('on'),
      '왼쪽 메뉴 — 고른 칸만 보이고 머리줄 제목이 바뀐다');
    chk(rail[0].classList.contains('on') && !rail[1].classList.contains('on') && rail[0].children[0].textContent === '3' && rail[1].children[0].textContent === '2' && rail[1].children[0].style.display === '',
      '  메뉴마다 안 읽은 수 — 우편 3 · 소식 2(소식 중 읽은 것은 빼고)');
    chk(titles().join('|') === '모두에게 보상|보상|답변|옛 알림|모르는 태그', '📩 우편 — 나한테 온 것 + 모두에게 보낸 우편(공지 · 업데이트는 빠짐) · 최신순');
    chk(R.mhInboxFootInfo.textContent === '우편 5통', '  아래 줄 «우편 n통»(안 읽음 수는 왼쪽 메뉴 숫자로)');
    chk(card(0).className === 'mh-ibx-card unread' && card(1).className === 'mh-ibx-card read', '  카드 클래스 — 안 읽음 · 읽음');
    chk(part(0, 'mh-ibx-ic').textContent === '🎁' && part(2, 'mh-ibx-ic').textContent === '🛠️' && part(4, 'mh-ibx-ic').textContent === '📢'
      && /^우편 · /.test(part(1, 'mh-ibx-sub').textContent) && /^버그제보 답변 · /.test(part(2, 'mh-ibx-sub').textContent) && /^공지 · /.test(part(4, 'mh-ibx-sub').textContent),
      '  아이콘 · 종류 글자 — 모르는 태그는 공지로');
    chk(part(2, 'mh-ibx-go').textContent === '가기' && part(3, 'mh-ibx-go').textContent === '보기', '  버튼 — 🐞 답변은 «가기» · 나머지는 «보기»');
    chk(!part(1, 'mh-ibx-pinbtn'), '  관리자가 아니면 📌 고정 단추는 없다');
    const body3 = card(3).children[1];
    chk(/<span class="ext-link" data-url="https:\/\/x\.io\/a">https:\/\/x\.io\/a<\/span>\./.test(body3.innerHTML) && body3._extLinkBound === true, '  본문 주소는 링크로(끝 마침표 빼고) · 링크 위임을 건다');
    // 펼치기 — 개인
    e.calls = []; e.bell = 0;
    card(3).onclick();
    chk(m.state().inboxOpenId === 'a' && e.calls.join() === 'markInboxRead ME01 a' && e.bell === 1, '개인 우편을 펼치면 서버에 읽음 · 🔔 뱃지 갱신');
    chk(/mh-ibx-card unread open/.test(card(3).className) && part(3, 'mh-ibx-go').textContent === '접기', '  다시 그리면 펼친 카드에 open · 버튼은 «접기»');
    card(3).onclick();
    chk(m.state().inboxOpenId === null && e.calls.length === 1, '  한 번 더 누르면 접는다(읽음 표시는 펼칠 때만)');
    e.myInbox.a.read = true; e.calls = [];
    m.renderInbox(); card(3).onclick();
    chk(e.calls.length === 0, '  이미 읽은 것은 읽음 표시를 다시 안 보낸다');
    // 모두에게 보낸 우편 — 로컬 읽음
    m.renderInbox(); e.calls = [];
    card(0).onclick();
    chk(JSON.parse(e.store.get('tw.inboxBcRead')).includes('r') && e.calls.length === 0, '모두에게 보낸 우편을 펼치면 로컬 집합에만 읽음(서버 안 부름)');
    // 버그 답변
    m.renderInbox(); card(titles().indexOf('답변')).onclick();
    chk(e.bugOpen.join() === 'B9' && m.state().inboxOpenId === null, '🐞 답변 알림은 펼치는 대신 버그제보 글을 연다');
    // × 삭제
    m.renderInbox(); e.calls = [];
    let ev = { _sp: false, stopPropagation(){ ev._sp = true; } };
    await part(titles().indexOf('보상'), 'mh-ibx-x').onclick(ev);
    chk(ev._sp && e.calls.join() === 'deleteInboxMessage ME01 b', '× 개인 우편 — 서버에서 지운다 · 펼침으로 번지지 않는다');
    e.store.set('tw.inboxBcRead', JSON.stringify(['u'])); m.renderInbox(); e.calls = []; e.bell = 0;
    await part(titles().indexOf('모두에게 보상'), 'mh-ibx-x').onclick({ stopPropagation(){} });
    chk(e.calls.length === 0 && JSON.parse(e.store.get('tw.inboxBcRead')).includes('r') && e.bell === 1, '× 모두에게 보낸 우편(일반) — 로컬 숨김(읽음)만 · 🔔 갱신');
    e.admin = true; m.renderInbox(); e.calls = [];
    await part(titles().indexOf('모두에게 보상'), 'mh-ibx-x').onclick({ stopPropagation(){} });
    chk(e.calls.join() === 'deleteInboxBroadcast r', '× 모두에게 보낸 우편(관리자) — 전체에서 지운다');
    chk(part(0, 'mh-ibx-pinbtn') && part(0, 'mh-ibx-pinbtn').title === '상단 고정' && !part(titles().indexOf('보상'), 'mh-ibx-pinbtn'), '📌 고정 단추 — 관리자 + 모두에게 보낸 것에만');
    e.admin = false;
    // 읽은 우편 지우기
    e.calls = [];
    m.inboxClearRead();
    const ask = R.myHomeWin.children[0];
    chk(ask && /읽은 우편 3통을 지울까요/.test(ask.innerHTML) && e.calls.length === 0, '읽은 우편 지우기 — 먼저 확인창(읽은 개인 우편 수)');
    ask.fire('click', { target: { closest: (q) => q === 'button[data-i]' ? { dataset: { i: '0' } } : null } }); await flush(); await flush();
    chk(e.calls.slice().sort().join() === 'deleteInboxMessage ME01 a,deleteInboxMessage ME01 b,deleteInboxMessage ME01 d' && e.toasts.includes('읽은 우편 3통을 지웠어요'),
      '  «지우기» — 읽은 개인 우편만(안 읽은 답변 · 모두에게 보낸 우편은 남김)');
    e.myInbox = {}; e.calls = []; e.toasts = [];
    m.inboxClearRead();
    chk(e.toasts.includes('지울 읽은 우편이 없어요') && R.myHomeWin.children.length === 0, '  읽은 개인 우편이 없으면 확인창 없이 안내');
    const eU = E(); const mU = eU.mk({ getMyUserId: () => null }); eU.reg('myHomeWin'); eU.myInbox = { z: { read: true, ts: 1 } };
    mU.inboxClearRead();
    chk(eU.byId.myHomeWin.children.length === 0 && eU.calls.length === 0, '  내 코드가 없으면 아무것도 안 한다');
    e.bc = {}; m.setInboxSec('mail'); m.renderInbox();
    chk(list.innerHTML === '<div class="mh-ibx-empty">받은 우편이 없어요</div>' && R.mhInboxFootInfo.textContent === '', '비었을 때 안내 · 아래 줄 비움');
    const e2 = E(); const m2 = e2.mk(); m2.renderInbox();
    chk(e2.domCalls === 1, '우편함 칸이 없으면 아무것도 안 한다');

    say('── 3-2. 📢 소식');
    e.myInbox = { a: { tag: 'reward', title: '개인', ts: 1 } };
    e.bc = { p: { tag: 'update', title: '고정 판', ts: 10, pinned: true }, q: { tag: 'notice', title: '새 공지', body: '공지 본문 https://y.io', ts: 400 },
      u: { tag: 'update', title: '지난 판', ts: 250 }, r: { tag: 'reward', title: '모두에게 보상', ts: 350 } };
    e.store.set('tw.inboxBcRead', JSON.stringify(['u']));
    const nTitles = () => nList.children.map(it => it.children[0].children[2].textContent);
    m.setInboxSec('news'); m.setInboxFilter('all'); m.renderInbox();
    chk(R['mhInboxPane-news'].classList.contains('on'), '소식 칸이 보인다');
    chk(nTitles().join('|') === '고정 판|새 공지|지난 판', '  모두에게 보낸 공지 · 업데이트만 · 📌 먼저 · 최신순(우편은 빠짐)');
    chk(tabs[0].classList.contains('on') && tabs[1].classList.contains('new') && tabs[2].classList.contains('new') && !tabs[0].classList.contains('new'), '  종류 줄 — 고른 것 on · 새 글 있는 종류에 빨간 점');
    chk(/mh-news-item unread pinned/.test(nList.children[0].className) && nList.children[0].children[0].children[0].textContent === '📌' && /mh-news-item read/.test(nList.children[2].className),
      '  고정 · 안 읽음 · 읽음 표시');
    chk(/왼쪽 목록에서 글을 골라 주세요/.test(view.innerHTML), '  아무 글도 안 골랐으면 안내');
    m.setInboxFilter('notice'); m.renderInbox();
    chk(nTitles().join('|') === '고정 판|새 공지', '★ 공지를 골라도 📌 고정 업데이트는 맨 위에 보인다');
    m.setInboxFilter('update'); m.renderInbox();
    chk(nTitles().join('|') === '고정 판|지난 판' && tabs[2].classList.contains('on'), '  업데이트 — 고정 + 업데이트');
    m.setInboxFilter('all'); m.renderInbox(); e.calls = []; e.bell = 0;
    nList.children[1].onclick();
    chk(m.state().newsOpenId === 'q' && JSON.parse(e.store.get('tw.inboxBcRead')).includes('q') && e.calls.length === 0 && e.bell === 1, '글을 고르면 본문 · 로컬 읽음(서버 안 부름) · 🔔 갱신');
    chk(/mh-news-item read sel/.test(nList.children[1].className) && view.children[0].className === 'mh-news-banner notice' && view.children[1].textContent === '새 공지'
      && /<span class="ext-link" data-url="https:\/\/y\.io">/.test(view.children[3].innerHTML) && view.children[3]._extLinkBound === true, '  오른쪽 — 색 띠 · 제목 · 본문(링크)');
    chk(view.children[2].children.length === 1, '  관리자가 아니면 고정 · 지우기 단추가 없다');
    m.setInboxFilter('update'); m.renderInbox();
    chk(m.state().newsOpenId === null && /왼쪽 목록에서/.test(view.innerHTML), '  종류를 바꿔 목록에서 빠지면 본문도 비운다');
    // 관리자 — 고정 · 지우기
    e.admin = true; m.setInboxFilter('all'); m.renderInbox(); nList.children[0].onclick(); e.calls = [];
    const metaKids = () => view.children[2].children;
    chk(metaKids().length === 3 && metaKids()[1].className === 'mh-ibx-pinbtn on' && metaKids()[2].className === 'mh-news-del', '관리자 — 본문 머리에 📌 · 🗑');
    await metaKids()[1].onclick({ stopPropagation(){} }); await flush();
    chk(e.calls.includes('pin p false') && e.bc.p.pinned === undefined && e.toasts.includes('고정을 해제했어요') && nTitles()[0] === '새 공지', '  고정 풀기 — 서버 · app.js 의 공지 객체에서도 지우고 다시 정렬');
    nList.children[0].onclick(); e.calls = [];
    metaKids()[2].onclick({ stopPropagation(){} });
    const ask2 = R.myHomeWin.children[R.myHomeWin.children.length - 1];
    chk(ask2 && /모든 사용자에게서 지울까요/.test(ask2.innerHTML) && e.calls.length === 0, '  🗑 — 먼저 확인창');
    ask2.fire('click', { target: { closest: (q) => q === 'button[data-i]' ? { dataset: { i: '0' } } : null } }); await flush();
    chk(e.calls.join() === 'deleteInboxBroadcast q' && m.state().newsOpenId === null, '  «지우기» — 모두에게서 지우고 고른 글을 비운다');
    e.admin = false;
    e.bc = {}; m.renderInbox();
    chk(nList.innerHTML === '<div class="mh-ibx-empty">소식이 없어요</div>' && view.innerHTML === '', '소식이 없으면 안내 · 본문 칸 비움');

    say('── 3-3. 📘 도움말 · 처음 칸');
    m.setInboxSec('help'); m.renderInbox();
    chk(R['mhInboxPane-help'].classList.contains('on') && !R['mhInboxPane-news'].classList.contains('on'), '도움말 칸 — 준비 중 칸만 보인다');
    m.setInboxSec('zzz'); m.renderInbox();
    chk(m.state().inboxSec === 'mail', '  모르는 칸 이름은 우편으로');
    e.myInbox = { a: { tag: 'reward', ts: 1 } }; e.bc = { q: { tag: 'notice', ts: 2 } }; e.store.set('tw.inboxBcRead', '[]');
    m.setInboxSec('help'); m.setInboxOpenId('a'); m.inboxEnter();
    chk(m.state().inboxSec === 'mail' && m.state().inboxOpenId === null, '탭에 들어오면 — 안 읽은 우편이 있으면 우편부터 · 펼침은 접는다');
    e.myInbox.a.read = true; m.inboxEnter();
    chk(m.state().inboxSec === 'news', '  안 읽은 우편이 없으면 소식부터');
    const old = new Date(2025, 0, 2, 9, 5).getTime();
    chk(m.inboxTimeStr(old) === '25-01-02' && m.inboxTimeStr(0) === '' && /^(오전|오후) \d{1,2}:\d\d$/.test(m.inboxTimeStr(Date.now())) && m.inboxTimeStr(today) !== '', '시각 글자 — 오늘은 오전/오후 · 아니면 YY-MM-DD');
  }

  say('── 4. 링크');
  {
    const e = E(); const m = e.mk();
    const out = m.linkifyText('<b>"\'x</b> https://a.b/c?d=1&e=2), 키 ABCD-1234-WXYZ-0000 끝');
    chk(out.indexOf('&lt;b&gt;&quot;&#39;x&lt;/b&gt;') === 0, '이스케이프를 먼저 한다(다섯 문자)');
    chk(/<span class="ext-link" data-url="https:\/\/a\.b\/c\?d=1&amp;e=2">https:\/\/a\.b\/c\?d=1&amp;e=2<\/span>\),/.test(out), '주소는 링크로 · 끝 문장부호는 빼고');
    chk(/<span class="lic-key" data-key="ABCD-1234-WXYZ-0000" title="클릭하면 복사돼요">ABCD-1234-WXYZ-0000<\/span>/.test(out), '라이선스 키는 누르면 복사되는 칸');
    const root = mkEl('div', e);
    m.bindExtLinks(root); m.bindExtLinks(root); m.bindExtLinks(null);
    chk((root._L.click || []).length === 1, '위임은 한 번만 건다');
    const tgt = (sel, data) => ({ closest: (s) => s === sel ? { dataset: data } : null });
    let ev = { target: tgt('.ext-link', { url: 'https://a.b/c' }) };
    root.fire('click', ev);
    chk(e.opened.join() === 'https://a.b/c' && ev._pd && ev._sp, '링크 누르면 외부 브라우저 · 항목이 접히지 않게 막는다');
    ev = { target: tgt('.lic-key', { key: 'ABCD-1234-WXYZ-0000' }) };
    root.fire('click', ev);
    chk(e.copied.join() === 'ABCD-1234-WXYZ-0000' && e.toasts.includes('라이선스 키를 복사했어요') && e.opened.length === 1, '키 누르면 클립보드 · 안내');
  }

  say('── 5. 선물함');
  {
    const e = E(); const m = e.mk();
    const stat = e.reg('mhGiftStat'); const homeWin = e.reg('myHomeWin');
    const list = mkEl('div', e);
    e.gifts = { g1: { ts: 10, fromName: '가<나', msg: '"안녕"', imgUrl: 'https://i/1.png' }, g2: { ts: 30, starred: true, fromName: '다', imgUrl: 'https://i/2.png' }, 'g-out': { ts: 20, fromName: '라' } };
    m.renderGiftBox(list);
    chk(list.innerHTML === '<div class="mh-ibx-empty">불러오는 중…</div>', '먼저 «불러오는 중…»');
    await flush(); await flush();
    chk(e.calls.join() === 'getMallangGifts ME01', '  받은 선물은 내 코드로 한 번 받는다');
    const noUid = async (o) => { const u = E(o); const um = u.mk({ getMyUserId: () => null }); u.reg('mhGiftStat'); u.reg('myHomeWin'); u.gifts = e.gifts; const l = mkEl('div', u); um.renderGiftBox(l); await flush(); await flush();
      return u.calls.length === 0 && /아직 받은 선물이 없어요/.test(l.innerHTML); };
    chk(await noUid(), '  내 코드 없음 — 선물 요청 0 · «아직 받은 선물이 없어요»(읽기 실패 때와 같은 화면)');
    if(src === SRC['myhome-inbox.js']){
      const m2 = src.replace('if(getMyUserId() && window.firebaseAPI && firebaseAPI.getMallangGifts)', 'if(window.firebaseAPI && firebaseAPI.getMallangGifts)');
      chk(m2 !== src && !(await noUid({ src: m2 })), '    깨 보기 — 내 코드 확인을 빼면 빨강');
    }
    const cells = list.innerHTML.match(/<div class="gift-cell[^"]*"/g) || [];
    chk(cells.length === 30 && cells.filter(c => /empty/.test(c)).length === 27, '격자 30칸 — 남은 칸은 빈 칸');
    chk(/data-gid="g2"[\s\S]*data-gid="g-out"[\s\S]*data-gid="g1"/.test(list.innerHTML), '  순서 — 최신순(mallang 정렬이 없으면)');
    chk(/class="gift-cell gift-item star" data-gid="g2"/.test(list.innerHTML) && /class="gift-cell gift-item out" data-gid="g-out"/.test(list.innerHTML), '  ⭐ · 마이홈에서 치운 것 표시');
    chk(list.innerHTML.indexOf('title="가&lt;나 님이 선물했어요\n“&quot;안녕&quot;”') > 0 && list.innerHTML.indexOf('data-msg="&quot;안녕&quot;"') > 0, '  보낸 사람 · 메시지는 속성값 안이라 escHtml');
    chk(stat.textContent === '⭐ 1/20 · 보관 3/30', '「⭐ n/20 · 보관 m/30」 (' + stat.textContent + ')');
    const item = (k) => ({ dataset: { gid: k, img: 'IMG' + k, msg: 'M' + k } });
    const tg = (k, star) => ({ closest: (s) => s === '.gift-item' ? item(k) : (s === '.gift-star' && star ? {} : null) });
    e.calls = [];
    let ev = { target: tg('g1', true), stopPropagation(){ ev._sp = true; } };
    list.onclick(ev); await flush(); await flush();
    chk(ev._sp && e.calls.join() === 'star g1 true' && e.gifts.g1.starred === true && e.respawn.length === 0 && stat.textContent === '⭐ 2/20 · 보관 3/30', '⭐ 누르면 저장 · 다시 그림 · 칸 누르기(다시 불러오기)로 번지지 않는다');
    list.onclick({ target: tg('g1', false), stopPropagation(){} });
    chk(e.respawn.join() === 'g1|IMGg1|Mg1' && e.toasts.includes('🎁 마이홈에 다시 불러왔어요'), '칸 누르면 마이홈에 다시 불러온다');
    e.respawnAns = 'already'; list.onclick({ target: tg('g1', false), stopPropagation(){} });
    chk(e.toasts.includes('이미 마이홈에 나와 있어요'), '  이미 나와 있으면 알림');
    // 상한
    const e3 = E(); const m3 = e3.mk(); e3.reg('mhGiftStat'); const l3 = mkElSafe(e3);
    e3.gifts = {}; for(let i = 0; i < 21; i++) e3.gifts['s' + i] = { ts: i, starred: i < 20 };
    m3.renderGiftBox(l3); await flush(); await flush(); e3.calls = [];
    l3.onclick({ target: { closest: (s) => s === '.gift-item' ? { dataset: { gid: 's20' } } : (s === '.gift-star' ? {} : null) }, stopPropagation(){} }); await flush();
    chk(e3.calls.length === 0 && e3.toasts.includes('즐겨찾기는 20개까지예요'), '⭐ 는 20개까지 — 넘으면 저장하지 않는다');
    // 우클릭
    ev = { target: tg('g2', false), preventDefault(){ ev._pd = true; }, stopPropagation(){} };
    list.oncontextmenu(ev);
    const ov = homeWin.children[0];
    chk(ev._pd && ov && ov.id === 'mhAskOv' && /⭐를 먼저 풀어 주세요/.test(ov.innerHTML) && (ov.innerHTML.match(/<button/g) || []).length === 1, '⭐ 선물 우클릭 — 삭제 대신 안내(확인 단추 하나)');
    chk(e.doc.body.children.length === 0, '  확인창은 #myHomeWin 안에 붙는다(body 로 빼지 않는다)');
    e.calls = []; e.gifts['g-out'].fromName = '라<마';
    list.oncontextmenu({ target: tg('g-out', false), preventDefault(){}, stopPropagation(){} });
    const ov2 = homeWin.children[0];
    chk(homeWin.children.length === 1 && ov2 !== ov && /라&lt;마 님의 선물을 삭제할까요\?/.test(ov2.innerHTML) && /class="danger"/.test(ov2.innerHTML), '삭제 확인창 — 앞 창은 치우고 · 이름은 escHtml · 삭제는 위험 단추');
    ov2.fire('click', { target: { closest: (s) => s === 'button[data-i]' ? { dataset: { i: '0' } } : null } }); await flush(); await flush();
    chk(e.calls.join() === 'deleteGift g-out' && ov2.removed && e.toasts.includes('🗑 선물을 삭제했어요') && !/data-gid="g-out"/.test(list.innerHTML) && /data-gid="g1"/.test(list.innerHTML), '  [삭제] — 지우고 닫고 다시 그림');
    const ov3 = (list.oncontextmenu({ target: tg('g2', false), preventDefault(){}, stopPropagation(){} }), homeWin.children[0]);
    ov3.fire('click', { target: ov3 });
    chk(ov3.removed && e.calls.length === 1, '  바깥(배경) 누르면 그냥 닫힌다');
    e.gifts = {}; m.renderGiftBox(list); await flush(); await flush();
    chk(/아직 받은 선물이 없어요/.test(list.innerHTML) && list.onclick === null && stat.textContent === '', '선물이 없으면 안내 · 누르기 해제 · 표시 비움');
    m.giftStat('x'); chk(stat.textContent === 'x', 'giftStat 은 #mhGiftStat 에 쓴다');
  }

  say('── 6. 친구 목록');
  {
    const e = E(); const m = e.mk();
    const list = e.reg('mhFriendList'), head = e.reg('mhFriendHeadCount'), hit = e.reg('mhFriendHit');
    const sRow = e.reg('mhFriendSearch'), sInp = e.reg('mhFriendSearchInput'), hint = e.reg('mhFriendHint');
    sInp.focus = () => { e.focused += 10; }; sInp.select = () => {};
    m.renderMyHomeFriendList();
    chk(head.textContent === '(0/100)' && /아직 친구가 없어요/.test(list.innerHTML) && e.profileRail === 1, '비었을 때 — (0/상한) · 안내 · 수령함도 같이 그린다(renderMhChat)');
    /* 친구 목록을 아직 못 받았거나 못 받았으면 «친구 없음» 과 따로 — 빈 목록으로 그리면 없는 줄 안다(v0.11.3 제보) */
    e.notice = '친구 목록을 불러오는 중이에요'; m.renderMyHomeFriendList();
    chk(head.textContent === '(-/100)' && /불러오는 중이에요/.test(list.innerHTML) && !/아직 친구가 없어요/.test(list.innerHTML) && e.profileRail === 2, '불러오는 중 — (-/상한) · «불러오는 중» · «친구 없음» 아님');
    e.notice = '친구 목록을 불러오지 못했어요.\n잠시 후 다시 시도할게요';
    e.friends = { f9: { name: 'Old', online: true } }; m.renderMyHomeFriendList();
    chk(head.textContent === '(-/100)' && /불러오지 못했어요\.\n잠시 후 다시 시도할게요/.test(list.innerHTML) && /white-space:pre-line/.test(list.innerHTML) && !/Old/.test(list.innerHTML), '못 불러옴 — 안내만(옛 목록을 사실처럼 그리지 않는다) · 두 문장 사이 줄바꿈(pre-line)');
    e.notice = '<b>x</b>'; m.renderMyHomeFriendList();
    chk(!/<b>/.test(list.innerHTML), '  안내 문구도 escHtml');
    e.notice = null; e.friends = {};
    e.friends = {
      f1: { name: 'Bob', online: true, room: 'PLAY-AB12', inRoom: true, level: 12, bio: '<b>안녕</b>' },
      f2: { name: 'alice', online: true, room: 'SCRT-XYZ1', inRoom: true, level: null },
      f3: { name: 'Zed<&>', online: false, level: 3, avatar: 'javascript:alert(1)' },
      f4: { name: 'Carl', online: false, level: 5, avatar: 'data:image/png;base64,AA', star: '#ff0' },
    };
    m.renderMyHomeFriendList();
    const groups = list.children.filter(c => c.className === 'mh-fgroup').map(c => c.textContent);
    const rows = () => list.children.filter(c => /^mh-frow/.test(c.className));
    chk(head.textContent === '(4/100)' && groups.join('|') === '온라인 — 2|오프라인 — 2', '(n/상한) · 온라인 / 오프라인 묶음');
    chk(rows().map(r => /mh-fname">([^< ]*)/.exec(r.innerHTML)[1]).join() === 'alice,Bob,Carl,Zed&lt;&amp;&gt;', '  이름순(대소문자 무시 localeCompare) · 이름은 escHtml');
    const rBob = rows()[1], rAli = rows()[0], rZed = rows()[3], rCarl = rows()[2];
    chk(/ 🏠/.test(rBob.innerHTML) && / 🏠/.test(rAli.innerHTML) && !/🏠/.test(rZed.innerHTML), '🏠 — 시크릿룸이어도 붙는다(코드만 안 보인다)');
    chk(/<i class="lvp">Lv<\/i>12/.test(rBob.innerHTML) && !/mh-flv/.test(rAli.innerHTML) && /mh-flv lv-star lvx" style="--pre-c:#ff0"><i class="pre">★2<\/i>7/.test(rCarl.innerHTML), '레벨 배지 — 레벨 없으면 안 붙음 · 회차 친구는 별');
    chk(/mh-fsub">안녕</.test(rBob.innerHTML) && /mh-fsub">온라인</.test(rAli.innerHTML) && /mh-fsub">오프라인</.test(rZed.innerHTML), '한 줄 요약 — 소개글은 태그를 걷어 낸 글자 · 없으면 온라인 / 오프라인');
    const avZ = rZed.querySelector('.mh-favatar'), avC = rCarl.querySelector('.mh-favatar');
    chk(avZ.children.length === 0 && avC.children.length === 1 && avC.children[0].src === 'data:image/png;base64,AA' && avC.title === '클릭 = Carl 마이홈 관람' && !/title="[^"]*\$/.test(rCarl.innerHTML), '아바타 — data:image · http(s) 만 · title 은 프로퍼티로');
    avC.fire('click', {});
    chk(e.homeView.join() === 'f4', '  아바타 누르면 그 친구 마이홈 관람');
    rBob.fire('click', {});
    const rBob2 = rows()[1];
    chk(m.state().selectedFriend === 'f1' && /mh-frow sel/.test(rBob2.className) && /mh-fpill">온라인 · <span class="mh-fpill-code go" title="클릭하면 놀러 가요">PLAY-AB12<\/span>/.test(rBob2.innerHTML), '줄 누르면 선택 · 방 코드 칸(놀러 가기)');
    rBob2.querySelector('.mh-fpill-code.go').fire('click', {});
    chk(e.calls.join() === 'visit f1', '  코드 누르면 놀러 가기 창(friendVisit.ask)');
    rows()[0].fire('click', {});
    chk(/mh-fpill">온라인<\/span>/.test(rows()[0].innerHTML) && !/SCRT/.test(list.children.map(c => c.innerHTML).join('')), '★ 시크릿룸 친구는 코드를 아예 안 보인다');
    rows()[0].fire('contextmenu', {});
    chk(e.calls.includes('openGift f2 alice') && /우클릭: 말랑이 선물/.test(rows()[0].title), '우클릭 — 말랑이 선물 창');
    // 삭제
    e.calls = []; e.confirmAns = false;
    await rows()[0].querySelector('.mh-fremove').onclick({ stopPropagation(){} });
    chk(e.calls.length === 0 && e.focused === 1, '✕ — 확인에서 취소하면 안 지운다(창 포커스 되돌림)');
    e.confirmAns = true;
    await rows()[0].querySelector('.mh-fremove').onclick({ stopPropagation(){} });
    chk(e.calls.join() === 'removeFriend ME01 f2' && m.state().selectedFriend === null, '  확인하면 서버에서 지우고 · 선택돼 있었으면 풀기');
    // 검색
    m.setFriendFilter('LI'); m.renderMyHomeFriendList();
    chk(head.textContent === '(4/100)' && rows().length === 1 && /mh-fname">a<span class="mh-hl">li<\/span>ce/.test(rows()[0].innerHTML) && hit.textContent === '1명 찾음 · Esc 로 닫기' && hit.classList.contains('on'),
      '검색 — 헤더는 전체 수 그대로 · 찾은 줄만 · 겹치는 곳만 강조 · «n명 찾음»');
    m.setFriendFilter('없는이름'); m.renderMyHomeFriendList();
    chk(/찾는 이름이 없어요/.test(list.innerHTML), '  찾는 이름이 없으면 안내');
    chk(m.mhHl('a&b', '&') === 'a<span class="mh-hl">&amp;</span>b' && m.mhHl('<x>', '') === '&lt;x&gt;' && m.mhHl(null, 'q') === '', '강조는 원문에서 찾고 세 조각을 각각 escHtml');
    const f0 = e.focused;
    m.friendSearchToggle(true);
    chk(sRow.classList.contains('on') && hint.style.display === 'none' && e.focused === f0 + 10, 'Ctrl+F — 검색줄 열고 입력칸에 포커스 · 힌트 숨김');
    m.friendSearchToggle(true);
    chk(e.focused === f0 + 10, '  같은 상태면 아무 일도 안 한다');
    sInp.value = '없는이름';
    m.friendSearchToggle(false);
    chk(!sRow.classList.contains('on') && sInp.value === '' && m.state().friendFilter === '' && rows().length === 4 && !hit.classList.contains('on') && hint.style.display === '', '닫으면 검색어도 비우고 전체를 다시 그린다');
    const e4 = E({ noVisit: true }); const m4 = e4.mk(); e4.reg('mhFriendList'); e4.friends = { f1: { name: 'B', online: true, room: 'PLAY-AB12' } };
    m4.renderMyHomeFriendList(); e4.byId.mhFriendList.children[1].fire('click', {});
    chk(/mh-fpill-code">PLAY-AB12</.test(e4.byId.mhFriendList.children[1].innerHTML), '놀러 가기 모듈이 없으면 코드만(예전 그대로)');
    chk(m.friendRoomTag({ room: 'SCRT-AAAA' }) === '' && m.friendRoomTag({ room: 'PLAY-1' }) === 'PLAY-1' && m.friendRoomTag(null) === '', 'friendRoomTag — 시크릿룸은 빈 값');
    chk(m.friendInRoom({ online: true, inRoom: true }) && !m.friendInRoom({ online: false, inRoom: true }) && m.friendInRoom({ online: true, room: 'X' }) && !m.friendInRoom({ online: true, inRoom: false, room: 'X' }), 'friendInRoom — 온라인만 · inRoom 이 있으면 그것 · 옛 판은 코드 유무');
  }
}
function mkElSafe(e){ return mkEl('div', e); }

/* 7절 — 글만 본다 */
function wiring(MI, APP, HTML){
  say('── 7. app.js 배선');
  const A = strip(APP);
  const defs = /^(?:async )?function (renderMyHomeFriendList|renderInbox|renderGiftBox|_giftBoxPaint|_giftStat|_mhAsk|_inboxMerged|_inboxUnreadCount|_refreshFriendTabBadge|_linkifyText|_bindExtLinks|_friendRoomTag|_friendInRoom|_mhFriendSearchToggle|_mhHl|_inboxTimeStr|_inboxTagLabel)\(|^let (_mhSelectedFriend|_friendFilter|_inboxFilter|_inboxOpenId)\b/m;
  chk(!defs.test(A) && defs.test(MI), '수령함 · 선물함 · 친구 목록 정의는 모듈에만');
  chk(!/[^.\w$](renderMyHomeFriendList|renderInbox|renderGiftBox|_giftStat|_inboxUnreadCount|_refreshFriendTabBadge|_linkifyText|_bindExtLinks|_friendRoomTag|_friendInRoom|_mhFriendSearchToggle|_inboxTagLabel|_inboxTimeStr|_inboxBcMarkAllRead|_inboxFilter|_inboxOpenId|_friendFilter)\b(?!\s*:|\(\)\{)/.test(A),
    '  app.js 는 옛 이름을 부르지 않는다(전부 inboxMod.이름)');
  chk(/window\.TwMyHomeInbox = api/.test(MI) && (A.match(/TwMyHomeInbox\.createMyHomeInbox\(/g) || []).length === 1, '모듈은 window.TwMyHomeInbox · 만드는 곳은 한 곳');
  const iKey = APP.indexOf("const INBOX_BC_READ_KEY = 'tw.inboxBcRead';"), iVisit = APP.indexOf('const friendVisit = window.TwFriendVisit ?'),
    iMk = APP.indexOf('TwMyHomeInbox.createMyHomeInbox('), iStrip = APP.indexOf('\nfunction _mhStripHtml('),
    iHead = APP.indexOf('/* ═══ 📩 수령함 상태 · 안 읽은 수 · 친구 탭 배지 ═══ */'), iSched = APP.indexOf('MhScheduler.createScheduler('),
    iFHead = APP.indexOf('/* ═══ 👥 마이홈 친구 목록 · Ctrl+F 검색 ═══ */'), iGHead = APP.indexOf('/* ═══ 📩 수령함 · 💝 선물함 그리기 ═══ */'),
    iUI = APP.indexOf('/* ═══ 🏠 마이홈 창 버튼 연결(bindMyHomeUI) ═══ */');
  chk(iSched > 0 && iHead > iSched && iKey > iHead && iStrip > iKey && iFHead > iStrip && iVisit > iFHead && iMk > iVisit && iGHead > iMk && iUI > iGHead,
    '원래 자리 — 수령함 let 은 📩 수령함 상태 머리 아래 · 만드는 줄은 👥 친구 목록 머리 아래(🏠 놀러 가기 연결 바로 다음) · 📩 그리기 머리는 남김');
  chk(/parts\/(?:myhome\/)?myhome-inbox\.js 로 옮겼다/.test(APP.slice(iGHead, iUI)) && !/^(?:function|const|let) /m.test(APP.slice(iGHead, iUI)), '  📩 그리기 머리 아래는 옮긴 곳 안내뿐(구역 번호가 밀리지 않게 머리만 남김)');
  chk(/^let _myInbox = \{\};/m.test(APP) && /^let _myInboxReady = false;/m.test(APP) && /^let _inboxBroadcast = \{\};/m.test(APP) && /_myInbox = msgs \|\| \{\};/.test(A) && /_inboxBroadcast = bc \|\| \{\};/.test(A),
    '  구독이 다시 대입하는 수령함 let 셋은 app.js 에(그래서 읽는 함수)');
  const call = (APP.match(/TwMyHomeInbox\.createMyHomeInbox\(\{([\s\S]*?)\n\}\);/) || [])[1] || '';
  const deps = call.split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('//'));
  const want = [
    /^escHtml: \(\.\.\.a\)=>escHtml\(\.\.\.a\),$/, /^toast: \(\.\.\.a\)=>toast\(\.\.\.a\),$/, /^getMyUserId: \(\.\.\.a\)=>getMyUserId\(\.\.\.a\),$/,
    /^myInbox: \(\)=>_myInbox,$/, /^inboxBroadcast: \(\)=>_inboxBroadcast,$/, /^INBOX_BC_READ_KEY: INBOX_BC_READ_KEY,$/, /^isAdmin: \(\)=>isAdmin,$/, /^mhScheduler: mhScheduler,$/,
    /^myHomeFriends: \(\)=>_myHomeFriends,$/, /^friendsNotice: \(\.\.\.a\)=>friendsSubMod\.notice\(\.\.\.a\),$/, /^FRIEND_MAX: FRIEND_MAX,$/, /^friendVisit: friendVisit,$/, /^mhStripHtml: \(\.\.\.a\)=>_mhStripHtml\(\.\.\.a\),$/,
    /^starFromRemote: \(\.\.\.a\)=>starFromRemote\(\.\.\.a\),$/, /^lvStarBadgeClass: \(\.\.\.a\)=>lvStarBadgeClass\(\.\.\.a\),$/, /^lvStarStr: \(\.\.\.a\)=>lvStarStr\(\.\.\.a\),$/,
    /^lvBadgeClass: \(\.\.\.a\)=>lvBadgeClass\(\.\.\.a\),$/, /^openFriendHomeView: \(\.\.\.a\)=>openFriendHomeView\(\.\.\.a\),$/, /^renderMhProfileRail: \(\.\.\.a\)=>renderMhProfileRail\(\.\.\.a\),$/,
  ];
  const bad = want.map((re, i) => re.test(deps[i] || '') ? null : (i + ':' + (deps[i] || '없음'))).filter(Boolean);
  chk(deps.length === want.length && !bad.length, 'deps 19개 — 함수는 화살표 · let 은 읽는 함수 · const 는 값 (' + deps.length + (bad.length ? ' · 어긋남 ' + bad[0] : '') + ')');
  const iAdm = APP.indexOf('\nlet isAdmin = false;');
  chk(iAdm > iMk, '  isAdmin 은 만드는 줄보다 뒤에 선언되는 let — 값이면 TDZ');
  const iSt = APP.indexOf('\nconst mhScheduler = '), iFM = APP.indexOf('\nconst FRIEND_MAX = ');
  chk(iSt > 0 && iSt < iMk && iFM > 0 && iFM < iMk, '  mhScheduler · FRIEND_MAX · friendVisit 는 만드는 줄보다 앞의 const — 그래서 값');
  chk(/roomTagOf: \(\.\.\.a\)=>inboxMod\.friendRoomTag\(\.\.\.a\),/.test(A), '🏠 놀러 가기는 방 코드를 inboxMod.friendRoomTag 로 얻는다(부를 때 찾는다)');
  const rets = ((MI.match(/\nreturn \{([\s\S]*?)\n\};/) || [])[1] || '').split('// 검사용')[0].split('\n').map(s => (s.trim().match(/^(\w+)/) || [])[1]).filter(Boolean);
  const off = (APP.match(/const INBOX_OFF = \{([\s\S]*?)\};/) || [])[1] || '';
  const miss = rets.filter(n => !new RegExp('\\b' + n + '(\\(\\)\\{\\}|:)').test(off));
  chk(!/\bINBOX_OFF\b/.test(APP), '빈 껍데기 INBOX_OFF 없음 — 모듈은 늘 싣는다(가드 걷기 3차)');
  const uses = ['inboxMod.renderMyHomeFriendList()', 'inboxMod.renderInbox()', 'inboxMod.renderGiftBox(', 'inboxMod.giftStat(', 'inboxMod.inboxTimeStr(', 'inboxMod.inboxTagLabel(',
    'inboxMod.inboxUnreadCount()', 'inboxMod.refreshFriendTabBadge()', 'inboxMod.inboxBcMarkAllRead()', 'inboxMod.linkifyText(', 'inboxMod.bindExtLinks(', 'inboxMod.friendInRoom(',
    'inboxMod.friendSearchToggle(', 'inboxMod.setInboxFilter(', 'inboxMod.setInboxOpenId(null)', 'inboxMod.setFriendFilter(',
    'inboxMod.inboxEnter(); inboxMod.renderInbox();', 'inboxMod.setInboxSec(', 'inboxMod.inboxClearRead()'];
  const lost = uses.filter(u => A.indexOf(u) < 0);
  chk(!lost.length, '부르는 곳 — 마이홈 열기 · 버튼 연결 · 공지 팝업 · 스케줄러 · 친구 관리 · 방 초대' + (lost.length ? ' (없음 ' + lost.join(' · ') + ')' : ''));
  const iC = HTML.indexOf('<script src="parts/chat/chat-window.js"></script>'), iM = HTML.indexOf('<script src="parts/myhome/myhome-inbox.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>'),
    iV = HTML.indexOf('<script src="parts/room/friend-visit.js"></script>');
  chk(iC > 0 && iV > 0 && iM > iC && iM > iV && iA > iM, 'html — myhome-inbox.js 를 app.js 보다 먼저(chat-window.js 뒤)');
  const iS = HTML.indexOf('<script src="parts/myhome/inbox-sections.js"></script>');
  chk(iS > 0 && iS < iM, '  html — 칸 나누기 규칙(inbox-sections.js)을 myhome-inbox.js 보다 먼저');
  chk(/const inboxSec = TwInboxSections;/.test(MI) && !/sectionOf\(m\)\s*\{|_src === 'broadcast' && \(t/.test(MI), '  수령함 모듈은 칸 나누기 규칙을 받아 부른다(판단을 다시 쓰지 않는다)');
  const PG = (HTML.match(/<div id="mhPageMail"[\s\S]*?<!-- 관리자: 브로드캐스트 작성 모달 -->/) || [''])[0];
  const want2 = ['id="mhInboxRail"', 'data-sec="mail"', 'data-sec="news"', 'data-sec="help"', 'id="mhInboxBody"', 'id="mhInboxPane-mail"', 'id="mhInboxPane-news"', 'id="mhInboxPane-help"',
    'id="mhInboxList"', 'id="mhInboxFoot"', 'id="mhInboxClearRead"', 'id="mhInboxTabs"', 'id="mhNewsList"', 'id="mhNewsView"', 'id="mhInboxReadAllBtn" class="mh-ibx-readall"', 'class="admin-only mh-ibx-compose"', '도움말은 준비 중이에요'];
  const lost2 = want2.filter(w => PG.indexOf(w) < 0);
  chk(!lost2.length && !/data-tag="reward"/.test(PG), 'html — 왼쪽 메뉴 세 칸 · 칸 셋 · 소식 종류(공지 · 업데이트만) · 도움말 준비 중' + (lost2.length ? ' (없음 ' + lost2.join(' · ') + ')' : ''));
  chk(/TwMyHomeInbox/.test(MI) && !/window\.(MyHomeInbox|Inbox)\s*=/.test(MI), '전역 이름은 Tw 접두사 — 크로미움 내장 전역과 겹치지 않게');
}

async function runAll(MI, APP, HTML){
  try{ await behave(MI); }catch(err){ chk(false, '실행 오류 — ' + (err && err.stack || err).toString().split('\n').slice(0, 3).join(' | ')); }
  try{ wiring(MI, APP, HTML); }catch(err){ chk(false, '배선 검사 오류 — ' + (err && err.message || err)); }
}

(async () => {
  const MI = SRC['myhome-inbox.js'], APP = _joinRenderer(SRC['app.js']), HTML = SRC['desk-companion-prototype.html'];
  say('── 1. 만들 때');
  {
    const win = {};
    new Function('window', 'module', MI)(win, undefined);
    chk(Object.keys(win).join() === 'TwMyHomeInbox' && typeof win.TwMyHomeInbox.createMyHomeInbox === 'function', '싣기만 하면 window.TwMyHomeInbox 하나뿐');
    const e = mkEnv(); e.reg('mhFriendList'); e.reg('mhInboxList');
    const m = e.mk();
    chk(e.domCalls === 0 && e.calls.length === 0 && e.store.size === 0 && e.toasts.length === 0, '만들 때 DOM · 서버 · 저장소 · 토스트를 안 건드린다');
    chk(JSON.stringify(m.state()) === '{"selectedFriend":null,"friendFilter":"","inboxSec":"mail","inboxFilter":"all","inboxOpenId":null,"newsOpenId":null}', '상태 초기값 — 선택 없음 · 검색어 없음 · 우편 칸 · 소식 전체 · 펼침 · 고른 글 없음');
  }
  await runAll(MI, APP, HTML);

  say('── 8. 일부러 깨 보기');
  const BREAKS = [
    ['MI', '_inboxFilter = inboxSec.normCat(_inboxFilter);', '', "옛 'gift' 필터를 안 되돌림"],
    ['MI', 'const ids = inboxSec.newsIds(merged, _inboxFilter);', 'const ids = Object.keys(merged);', '소식 칸이 칸 나누기 규칙을 안 부름'],
    ['MI', 'const ids = inboxSec.mailIds(merged);', 'const ids = Object.keys(merged);', '우편 칸에 소식이 섞임'],
    ['MI', "  if(m.read) return;\n  if(m._src === 'broadcast'){ _inboxBcMarkRead(id); }", "  if(m._src === 'broadcast'){ _inboxBcMarkRead(id); }", '읽은 것도 다시 읽음 표시'],
    ['MI', '_inboxSec = inboxSec.firstSec(_inboxMerged());', "_inboxSec = 'mail';", '탭에 들어올 때 처음 칸을 안 고름'],
    ['MI', "merged[id].read && merged[id]._src === 'personal'", "merged[id]._src === 'personal'", '안 읽은 우편까지 지움'],
    ['MI', "  _mhAsk('읽은 우편 지우기',", "  ({ label:'지우기', run: async ()=>{ for(const id of ids){ await firebaseAPI.deleteInboxMessage(getMyUserId(), id); } } }).run(); (()=>0)('읽은 우편 지우기',", '확인창 없이 지움'],
    ['MI', "if(_newsOpenId && ids.indexOf(_newsOpenId) < 0) _newsOpenId = null;", '', '목록에서 빠진 글의 본문이 남음'],
    ['MI', "t.classList.toggle('new', (un[t.dataset.tag] || 0) > 0);", '', '종류 줄에 새 글 점이 없음'],
    ['MI', 'const n = _inboxUnreadCount();   // 우편 + 소식', 'const n = 0;   // 우편 + 소식', '탭 배지가 안 읽은 수를 안 셈'],
    ['MI', "if(m._src === 'broadcast'){ _inboxBcMarkRead(id); }", "if(m._src === 'broadcast'){ }", '공지 펼쳐도 읽음 안 됨'],
    ['MI', "if(isAdmin() && firebaseAPI.deleteInboxBroadcast)", 'if(firebaseAPI.deleteInboxBroadcast)', '일반 사용자가 공지를 전체 삭제'],
    ['MI', "if(!(isAdmin() && m._src === 'broadcast' && firebaseAPI.setInboxBroadcastPinned)) return null;", "if(!(m._src === 'broadcast' && firebaseAPI.setInboxBroadcastPinned)) return null;", '📌 단추가 누구에게나'],
    ['MI', 'let esc = escHtml(text);', 'let esc = String(text);', '링크 글을 이스케이프 안 함'],
    ['MI', "const clean = u.replace(/[.,;:)\\]]+$/, '');", 'const clean = u;', '주소 끝 문장부호를 같이 링크'],
    ['MI', 'root._extLinkBound = true;', '', '링크 위임이 두 번 걸림'],
    ['MI', "badge.textContent = n > 9 ? '9+' : String(n);", 'badge.textContent = String(n);', '배지 9+ 없음'],
    ['MI', 'if(on && starN >= lim.starMax){', 'if(false){', '⭐ 상한 없음'],
    ['MI', "if(ev.target.closest('.gift-star')){\n      ev.stopPropagation();", "if(ev.target.closest('.gift-star')){", '⭐ 누르기가 칸 누르기로 번짐(stopPropagation 없음)'],
    ['MI', 'win.appendChild(ov);', 'document.body.appendChild(ov);', '확인창이 body 로'],
    ['MI', "' data-img=\"'+escHtml(g.imgUrl||'')+'\" data-msg=\"'+escHtml(g.msg||'')+'\" title=\"'+escHtml(tip)+'\">'", "' data-img=\"'+escHtml(g.imgUrl||'')+'\" data-msg=\"'+(g.msg||'')+'\" title=\"'+(tip)+'\">'", '선물 글을 속성값에 그대로'],
    ['MI', "if(!r || r.indexOf('SCRT-') === 0) return '';", "if(!r) return '';", '시크릿룸 코드가 보임'],
    ['MI', "headCnt.textContent = '('+(_notice ? '-' : ids.length)+'/'+FRIEND_MAX+')';", "headCnt.textContent = '('+(_notice ? '-' : ids.length)+'/50)';", '친구 상한을 숫자로 박음'],
    ['MI', "  if(_notice){\n    _mhUpdateFriendHit('', 0);", "  if(false){\n    _mhUpdateFriendHit('', 0);", '못 받은 친구 목록을 «친구 없음» 으로 그림'],
    ['MI', "       + '<span class=\"mh-hl\">' + escHtml(s.slice(i, i + qs.length)) + '</span>'", "       + '<span class=\"mh-hl\">' + s.slice(i, i + qs.length) + '</span>'", '강조 조각을 안 씻음'],
    ['MI', "  if(inp) inp.value = '';\n  _friendFilter = '';", "  if(inp) inp.value = '';", '검색줄 닫아도 검색어가 남음'],
    ['MI', "const fSrc = TwSafeHtml.safeUrl(f.avatar, 'image');", 'const fSrc = f.avatar;', '아바타 주소를 아무거나'],
    ['MI', 'const online = shown.filter(id=>_myHomeFriends()[id].online).sort(byName);', 'const online = shown.filter(id=>_myHomeFriends()[id].online);', '온라인 친구를 이름순으로 안 둠'],
    ['MI', 'setInboxFilter: (v)=>{ _inboxFilter = v; },', '', 'setInboxFilter 를 안 내놓음'],
    ['MI', "if(typeof window !== 'undefined') window.TwMyHomeInbox = api;", "if(typeof window !== 'undefined') window.MyHomeInbox = api;", '전역 이름에 Tw 가 없음'],
    ['APP', '  isAdmin: ()=>isAdmin,', '  isAdmin: isAdmin,', 'isAdmin 을 값으로(TDZ)'],
    ['APP', '  myInbox: ()=>_myInbox,', '  myInbox: _myInbox,', '수령함을 값으로(구독이 다시 대입하면 옛 것)'],
    ['APP', 'inboxMod.setFriendFilter(', '_friendFilter = (', '검색 입력이 옛 이름에 씀'],
    ['APP', 'roomTagOf: (...a)=>inboxMod.friendRoomTag(...a),', 'roomTagOf: f=>f.room,', '놀러 가기가 방 판정을 복사'],
    ['HTML', '<script src="parts/myhome/myhome-inbox.js"></script>', '', 'html 이 모듈을 안 실음'],
    ['HTML', '<script src="parts/myhome/inbox-sections.js"></script>', '', 'html 이 칸 나누기 규칙을 안 실음'],
    ['APP', "inboxMod.inboxEnter(); inboxMod.renderInbox();", 'inboxMod.renderInbox();', '우편함 탭에 들어올 때 처음 칸을 안 고름'],
  ];
  const caught = [];
  for(const [where, from, to, what] of BREAKS){
    const s = { MI, APP, HTML };
    if(s[where].indexOf(from) < 0){ chk(false, '깨 볼 글을 못 찾음 — ' + what); continue; }
    s[where] = s[where].split(from).join(to);
    quiet = true; qfail = 0;
    await runAll(s.MI, s.APP, s.HTML);
    quiet = false;
    caught.push([what, qfail]);
  }
  const missed = caught.filter(([, n]) => n === 0).map(([w]) => w);
  chk(caught.length === BREAKS.length && !missed.length, '일부러 깨 본 ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — 못 잡음: ' + missed.join(' · ') : ''));

  say('\n통과 ' + pass + ' · 실패 ' + fail);
  process.exit(fail ? 1 : 0);
})();
