/* ═══ ✉️ sim-chat-read-on-send.js — 메시지를 보내면 그 메시지까지 읽음 (2026-10-19 신설) ═══════════════
   [버그] 투게더룸에서 보내자마자 방을 나갔다 들어오면 💬 에 «안 읽음 1» — 내가 보낸 메시지였다.
     읽음은 창을 닫을 때 «화면 목록의 마지막» 으로 저장하는데, 방금 보낸 내 줄은 서버 시각이 오기 전
     내 PC 가 어림한 임시 시각이라 읽음이 진짜 시각보다 앞에 저장됐다.
   [고침] «보내는 순간 = 거기까지 읽었다» — 서버가 받은 뒤 진짜 시각으로 그 채널 읽음을 저장(chat-ui.js _chatMarkSentRead).
   실제 chat-ui.js · chat-tabs.js 를 가짜 DOM · 가짜 대화 포트(chatNet — chatSaid 가 { id, ts } 를 준다) 위에서 돌린다(글자 판정 없음).
   ・1절: 보내기 확인 뒤 읽음 = 내 메시지 진짜 시각 · 확인 전엔 안 바뀜
   ・2절: 앞으로만 — 더 뒤 표시는 그대로 · 옛 형식(id 만) 표시는 덮는다 · 실패 · 시각 없음이면 안 건드림
   ・3절: 보낸 채널에만 — #s1 에서 보내면 #s1 만 · 확인 전에 탭을 옮겨도 보낸 탭에
   ・4절: 보내고 바로 나갔다 다시 들어와 셀 때 내 메시지가 안 읽음으로 안 잡힌다 · 열린 창의 구분선은 안 움직인다
   ・5절: 날리기(🌊)로 보내도 기록에 남으므로 읽음도 맞춘다
   ・(6절 걷음 — 서버가 chatSaid 로 줄의 id · 시각을 준다(chat-rt.js · sim-chat-rt.js))
   ・7절: 일부러 깨 보기 — 고친 줄을 되돌리면 빨강
   [실행] chat-ui.js · chat-tabs.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
globalThis.TwPersonName = require([__dirname, process.cwd()].flatMap(d => ['person-name.js', 'parts/shared/person-name.js', 'app/parts/shared/person-name.js'].map(p => require('path').join(d, p))).find(p => require('fs').existsSync(p)));   // 🏷️ 모듈이 부르는 이름 그리기(이름 없음 → «나») — 진짜 파일
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (n) => [n, 'parts/chat/' + n, 'app/parts/chat/' + n].map(read).find(Boolean);
const MOD = pick('chat-ui.js'), TABS = pick('chat-tabs.js');
if(!MOD || !TABS){ say('  ? 원본 못 찾음 — chat-ui.js · chat-tabs.js'); process.exit(2); }

const ME = 'u-me', ROOM = 'R1';
const flush = () => new Promise((r) => setImmediate(r));

function anything(){
  const f = function(){ return P; };
  const P = new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? (() => '') : k === 'then' ? undefined : k === 'length' ? 0 : P, apply: () => P, construct: () => P, set: () => true, has: () => true });
  return P;
}
/* 가짜 요소 — 아는 칸은 실제 값, 모르는 칸은 아무거나 */
function el(){
  const o = { value: '', textContent: '', innerHTML: '', style: {}, scrollTop: 0, scrollHeight: 0, clientHeight: 0,
    _cls: new Set(),
    getClientRects: () => [], getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0 }),
    focus(){}, addEventListener(){}, querySelectorAll: () => [], querySelector: () => null };
  o.classList = { add: (c) => o._cls.add(c), remove: (c) => o._cls.delete(c), contains: (c) => o._cls.has(c), toggle: (c, on) => { (on === undefined ? !o._cls.has(c) : on) ? o._cls.add(c) : o._cls.delete(c); } };
  const any = anything();
  return new Proxy(o, { get: (t, k) => (k in t ? t[k] : any), set: (t, k, v) => { t[k] = v; return true; } });
}

/* 한 판 — 모듈 하나 · 저장소 · DOM · 가짜 서버 */
function world(src, opts){
  opts = opts || {};
  const store = Object.assign({}, opts.store || {});
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const els = {};
  const doc = new Proxy({}, { get: (t, k) => k === 'getElementById' ? ((id) => (els[id] || (els[id] = el()))) : anything() });
  const sends = [];          // chatNet.sendText 부름 — { room, msg, tab, resolve }
  const subs = [];           // chatNet.subscribeLog 부름 — { room, cb, limit, tab }
  const chatNet = {
    sendText: (room, text, tab) => new Promise((resolve) => sends.push({ room, msg: { text }, tab, resolve })),
    subscribeLog: (room, cb, limit, tab, onFail) => { const s = { room, cb, limit, tab, onFail, off: false }; subs.push(s); return () => { s.off = true; }; },
  };
  const fb = {};
  let opened = null;          // 대화창 본문 구독(chatHistory.open)
  fb.chatHistory = { open: (room, tab, onList, onFail) => { if(opts.openThrows) throw new Error('chatHistory 없음'); opened = { room, tab, onList, onFail }; return () => {}; } };
  const win = { _activeChannel: 2, _roomMetaCache: { tabs: { s1: { name: '잡담', ts: 1 } } }, firebaseAPI: fb };
  const tabsApi = new Function('window', 'module', TABS + '\nreturn window.ChatTabs;')(win, undefined);
  win.ChatTabs = tabsApi;
  let cache = [];
  const any = anything();
  let room = ROOM;
  const presence = { roomCode: () => room, active: () => false, sendChat(){}, serverProvider: () => null };
  const deps = new Proxy({
    chatAccountStore: { get: (k) => ls.getItem(k), set: (k, v) => { ls.setItem(k, v); return true; }, remove: (k) => { ls.removeItem(k); return true; } },   // 계정 칸(S-3d) — 읽음 · 입장 표시 · 탭 기억
    Presence: () => presence, _chatRoomCode: () => room, _chatOffOn: () => false, _parseDanceCmdChain: () => null,
    officeMode: () => false, findMySeat: () => null, getMyUserId: () => ME, myCode: () => ME, chatNet, chatHistory: () => fb.chatHistory, getDisplayName: () => '나', toast(){},
    _chatEsc: (s) => String(s), escHtml: (s) => String(s),
    _chatLogCache: () => cache, setChatLogCache: (v) => { cache = v; }, _chatLogUnsub: () => null, setChatLogUnsub(){},
    CHAT_WIN_POS_KEY: () => 'tw.chatWinPos', bringWinToFront(){}, demojiCatalog: { DIR: '', LIST: [], BY_ID: {}, BY_CMD: {} }, seats: [], _myHomeData: () => null, isAdmin: () => false,
  }, { get: (t, k) => (k in t ? t[k] : (() => any)) });
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'ChatTabs', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'TwSafeHtml', 'module',
    src + '\nreturn window.TwChatUi;')(win, doc, ls, any, fb, tabsApi, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, undefined);
  const ui = api.createChatUi(deps);
  return {
    ui, store, els, sends, subs, win, setRoom: (v) => { room = v; },
    opened: () => opened,
    readOf: (key) => store['tw_chat_read:' + key] || null,
    type: (text) => { els.chatInput = els.chatInput || el(); els.chatInput.value = text; ui._sendChatWindowMsg(); },
    reply: async (i, r) => { sends[i].resolve(r); await flush(); },
  };
}

async function judgeAll(src){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);

  /* 1절 — 보내기 확인 뒤 읽음 */
  {
    const w = world(src, { store: { 'tw_chat_read:R1': 'T1000:-A', 'tw_chat_read:R1#s1': 'T500:-X' } });
    w.type('안녕');
    t(w.sends.length === 1 && w.sends[0].tab === 'general' && w.sends[0].msg.text === '안녕', '1-1 보낼 때 대화 포트 sendText · #일반');
    t(w.readOf('R1') === 'T1000:-A', '1-2 서버 확인 전엔 읽음 표시를 안 바꾼다');
    await w.reply(0, { ok: true, id: '-B', ts: 2000 });
    t(w.readOf('R1') === 'T2000:-B', '1-3 확인 뒤 읽음 = 내 메시지 진짜 시각(T2000:-B)' + (w.readOf('R1') !== 'T2000:-B' ? ' — 지금 ' + w.readOf('R1') : ''));
    t(w.readOf('R1#s1') === 'T500:-X', '1-4 다른 탭(#s1) 표시는 그대로');
  }
  /* 2절 — 앞으로만 */
  {
    const w = world(src, { store: { 'tw_chat_read:R1': 'T9000:-Z' } });
    w.type('늦은 확인'); await w.reply(0, { ok: true, id: '-B', ts: 2500 });
    t(w.readOf('R1') === 'T9000:-Z', '2-1 이미 더 뒤 표시면 그대로(뒤로 물리지 않는다)');
  }
  {
    const w = world(src, { store: { 'tw_chat_read:R1': 'T2000:-B' } });
    w.type('같은 시각'); await w.reply(0, { ok: true, id: '-C', ts: 2000 });
    t(w.readOf('R1') === 'T2000:-C', '2-2 같은 시각이면 id 로 가른다(-C > -B 라 앞으로)');
  }
  {
    const w = world(src, { store: { 'tw_chat_read:R1': '-OLDKEY' } });
    w.type('옛 형식'); await w.reply(0, { ok: true, id: '-B', ts: 3000 });
    t(w.readOf('R1') === 'T3000:-B', '2-3 옛 형식(id 만) 표시는 새 형식으로 덮는다(_markChatRead 와 같은 규칙)');
  }
  {
    const w = world(src, {});
    w.type('첫 글'); await w.reply(0, { ok: true, id: '-B', ts: 3000 });
    t(w.readOf('R1') === 'T3000:-B', '2-4 표시가 없던 방도 내 메시지까지로 심는다');
  }
  {
    const w = world(src, { store: { 'tw_chat_read:R1': 'T1000:-A' } });
    w.type('실패'); await w.reply(0, { ok: false, reason: 'x' });
    w.type('시각 못 읽음'); await w.reply(1, { ok: true, id: '-B', ts: null });
    w.type('옛 판 대답'); await w.reply(2, { ok: true });
    t(w.readOf('R1') === 'T1000:-A', '2-5 실패 · 시각 없음 · id 없는 대답이면 안 건드린다');
  }
  /* 3절 — 보낸 채널에만 */
  {
    const w = world(src, { store: { 'tw.chatTab.R1': 's1', 'tw_chat_read:R1': 'T1000:-A', 'tw_chat_read:R1#s1': 'T500:-X' } });
    w.type('잡담 채널');
    t(w.sends[0] && w.sends[0].tab === 's1', '3-1 #s1 탭에서 보내면 #s1 기록으로');
    await w.reply(0, { ok: true, id: '-S', ts: 4000 });
    t(w.readOf('R1#s1') === 'T4000:-S' && w.readOf('R1') === 'T1000:-A', '3-2 #s1 표시만 바뀌고 #일반은 그대로');
  }
  {
    const w = world(src, { store: { 'tw_chat_read:R1': 'T1000:-A', 'tw_chat_read:R1#s1': 'T500:-X' } });
    w.store['tw.chatTab.R2'] = 's1';
    w.type('일반에서');
    w.setRoom('R2');                                       // 확인이 오기 전에 다른 방(#s1 탭)으로 옮겨도
    w.ui._chatMyTabId();
    await w.reply(0, { ok: true, id: '-G', ts: 5000 });
    t(w.readOf('R1') === 'T5000:-G' && w.readOf('R1#s1') === 'T500:-X' && !w.readOf('R2') && !w.readOf('R2#s1'), '3-3 보낸 순간의 방 · 채널에 저장(확인 사이 방 · 탭이 바뀌어도)');
  }
  /* 4절 — 보내고 바로 나갔다 다시 들어오기 */
  {
    const w = world(src, { store: { 'tw_chat_read:R1': 'T1000:-A', 'tw_chat_join:R1': '' } });
    w.ui.openChatWindow();
    const op = w.opened();
    const before = [{ id: '-A', ts: 1000, uid: 'u-x', name: '친구', text: '전' }, { id: '-C', ts: 1500, uid: 'u-x', name: '친구', text: '안 읽음' }];
    op.onList(before);
    const sepAt = (h) => String(h).indexOf('cmUnreadSep') < 0 ? -1 : String(h).split('cm-unread-sep')[0].split('cm-row').length - 1;
    const sep0 = sepAt(w.els.chatMessages.innerHTML);
    w.type('나 간다');
    // 내 줄이 임시 시각(내 PC 어림 1990)으로 먼저 들어온다 — 진짜 시각은 2000
    op.onList(before.concat([{ id: '-B', ts: 1990, uid: ME, name: '나', text: '나 간다' }]));
    w.ui.closeChatWindow();                                // 방 나가기 → 창 닫기 → 화면 마지막(임시 시각)으로 저장
    const afterClose = w.readOf('R1');
    await w.reply(0, { ok: true, id: '-B', ts: 2000 });
    t(afterClose === 'T1990:-B' && w.readOf('R1') === 'T2000:-B', '4-1 나갈 때 임시 시각(T1990)으로 저장돼도 확인이 오면 진짜 시각(T2000)으로 앞당긴다');
    // 다시 들어옴 — 창은 닫힌 채 뱃지 구독이 서버 진짜 시각 목록을 센다
    w.els.chatOverlay.style.display = 'none';
    w.ui._syncChatBadgeSub(true);
    const sub = w.subs.filter((s) => !s.off && s.limit === 30 && s.tab === undefined).pop();
    sub && sub.cb(before.concat([{ id: '-B', ts: 2000, uid: ME, name: '나', text: '나 간다' }]));
    const badge = w.els.myChatBadge;
    t(!!sub && !badge.classList.contains('on') && badge.textContent === '', '4-2 ★ 다시 들어와 셀 때 내 메시지가 «안 읽음 1» 로 안 잡힌다' + (badge.textContent ? ' — 뱃지 ' + badge.textContent : ''));
    sub && sub.cb(before.concat([{ id: '-B', ts: 2000, uid: ME, name: '나', text: '나 간다' }, { id: '-D', ts: 2100, uid: 'u-x', name: '친구', text: '새 글' }]));
    t(badge.textContent === '1', '4-3 그 뒤 남이 쓴 새 글 하나는 센다');

    // 창이 열려 있는 동안 확인이 와도 구분선은 그대로
    const w2 = world(src, { store: { 'tw_chat_read:R1': 'T1000:-A', 'tw_chat_join:R1': '' } });
    w2.ui.openChatWindow();
    const op2 = w2.opened();
    op2.onList(before);
    w2.type('창 열고');
    await w2.reply(0, { ok: true, id: '-B', ts: 2000 });
    op2.onList(before.concat([{ id: '-B', ts: 2000, uid: ME, name: '나', text: '창 열고' }]));
    const sep1 = sepAt(w2.els.chatMessages.innerHTML);
    t(sep0 === 1 && sep1 === 1 && w2.readOf('R1') === 'T2000:-B', '4-4 창이 열린 채 확인이 와도 «여기까지 읽었습니다» 선은 그 자리(저장만 한다)' + ' — 선 ' + sep0 + '→' + sep1);
  }
  /* 5절 — 날리기 */
  {
    const w = world(src, { store: { 'tw_chat_read:R1': 'T1000:-A' } });
    w.ui.setChatFlyOn(true);
    w.type('날려라');
    t(w.sends.length === 1, '5-1 날리기도 대화 기록(sendText)에 남는다');
    w.sends.length && await w.reply(0, { ok: true, id: '-F', ts: 6000 });
    t(w.readOf('R1') === 'T6000:-F', '5-2 그래서 날리기로 보낸 줄까지도 읽음');
  }
  /* 6절 — 지난 기록을 못 받으면 «못 불러왔어요 + [다시 시도]» — 다른 길(subscribeLog)로 돌리지 않는다(#910) */
  {
    const errs = []; const warns = []; const g0 = globalThis.TwErrorCodes, w0 = console.warn;
    globalThis.TwErrorCodes = { notify: (c) => { if(c === 'E-CHAT-02') errs.push(c); } }; console.warn = (...a) => warns.push(a.join(' '));
    try{
      const w = world(src, { openThrows: true, store: { 'tw_chat_join:R1': '' } });
      w.ui.openChatWindow();
      t(errs.join() === 'E-CHAT-02' && warns.length >= 1 && /data-hist-retry/.test(String(w.els.chatMessages.innerHTML)) && w.subs.filter((s) => s.limit === undefined).length === 0, '6-1 ★ 기록 모듈이 열다 던져도 «못 불러왔어요 + [다시 시도]» + E-CHAT-02 + console.warn — 최근 줄 구독(subscribeLog)으로 돌리지 않는다');
      errs.length = 0;
      const w2 = world(src, { store: { 'tw_chat_join:R1': '' } });
      w2.ui.openChatWindow();
      const op = w2.opened(); op.onFail(new Error('서버 503'));
      t(errs.join() === 'E-CHAT-02' && /data-hist-retry/.test(String(w2.els.chatMessages.innerHTML)), '6-2 서버에서 못 받으면(onFail) 같은 안내 · E-CHAT-02');
    } finally { globalThis.TwErrorCodes = g0; console.warn = w0; }
  }
  /* 7절 — 안 읽은 수를 못 불러오면 0(다 읽음)이 아니라 «?» 로 보인다 */
  {
    const errs = []; const g0 = globalThis.TwErrorCodes, w0 = console.warn; const warns = [];
    globalThis.TwErrorCodes = { notify: (c) => { if(c === 'E-CHAT-02') errs.push(c); } }; console.warn = (...a) => warns.push(a.join(' '));
    try{
      const w = world(src, { store: { 'tw_chat_read:R1': 'T1000:-A' } });
      w.ui._syncChatBadgeSub(true);
      const sub = w.subs.filter((s) => !s.off && s.limit === 30 && s.tab === undefined).pop();
      sub.onFail(new Error('503'));
      const badge = w.els.myChatBadge;
      t(badge.textContent === '?' && badge.classList.contains('on') && warns.length >= 1, '7-1 ★ 뱃지 구독이 실패하면 «?» 로 보인다(0 으로 지우지 않는다) + console.warn');
      sub.cb([{ id: '-A', ts: 1000, uid: 'u-x', name: '친구', text: '전' }, { id: '-D', ts: 2100, uid: 'u-x', name: '친구', text: '새 글' }]);
      t(badge.textContent === '1', '7-2 다시 받으면 숫자로 돌아온다');
      t(errs.join() === 'E-CHAT-02', '7-2b ★ 뱃지 실패는 E-CHAT-02 를 알린다' + (errs.length !== 1 ? ' — ' + errs.length + '번' : ''));
      sub.onFail(new Error('503')); sub.onFail(new Error('503'));
      t(errs.length === 1, '7-2c ★ 같은 방에서 또 실패해도 E-CHAT-02 는 한 번만 알린다' + (errs.length !== 1 ? ' — ' + errs.length + '번' : ''));
    } finally { globalThis.TwErrorCodes = g0; console.warn = w0; }
  }
  /* 7-3 — 채널 탭 숫자도 같다: 못 받으면 «?» · 다시 받으면 숫자 · 보는 탭 · 아직 안 받은 탭에는 «?» 가 없다 */
  {
    const errs = []; const g0 = globalThis.TwErrorCodes, w0 = console.warn;
    globalThis.TwErrorCodes = { notify: (c) => { if(c === 'E-CHAT-02') errs.push(c); } }; console.warn = () => {};
    try{
      const w = world(src, { store: { 'tw_chat_read:R1': 'T1000:-A', 'tw_chat_read:R1#s1': 'T1000:-A', 'tw_chat_join:R1': '' } });
      w.ui.openChatWindow();
      const tabSub = w.subs.filter((s) => !s.off && s.tab === 's1').pop();
      const bar = () => String(w.els.chatTabs && w.els.chatTabs.innerHTML);
      t(!!tabSub && !/ct-unread/.test(bar()), '7-3 아직 안 받은 탭에는 안 읽은 표시가 없다(? 도 숫자도 아님)');
      tabSub.onFail(new Error('503'));
      t(/ct-unread"[^>]*>\?</.test(bar()), '7-4 ★ 탭 구독이 실패하면 그 탭에 «?» 가 보인다');
      tabSub.cb([{ id: '-A', ts: 1000, uid: 'u-x', name: '친구', text: '전' }, { id: '-D', ts: 2100, uid: 'u-x', name: '친구', text: '새 글' }]);
      t(/ct-unread">1</.test(bar()) && !/\?</.test(bar()), '7-5 다시 받으면 «?» 가 숫자로 돌아온다');
      t(errs.join() === 'E-CHAT-02', '7-6 ★ 탭 실패도 E-CHAT-02 를 알린다' + (errs.length !== 1 ? ' — ' + errs.length + '번' : ''));
    } finally { globalThis.TwErrorCodes = g0; console.warn = w0; }
  }
  return r;
}

(async () => {
  let rows; try{ rows = await judgeAll(MOD); }catch(e){ rows = [[false, '돌리다 던짐 — ' + String(e && e.message || e).slice(0, 120)]]; }
  rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1~5. 실제로 돌려 보기'); chk(ok, msg); });
  say('── 7. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
  const breaks = [
    ['탭 실패를 «?» 로 그리지 않음', (s) => s.replace("const unk = t.id !== cur && _chatTabUnread[t.id] === null;", 'const unk = false;')],
    ['뱃지 실패를 알리지 않음(0 으로 보임)', (s) => s.replace("e => { _chatUnreadFailed(room, '', e); _setChatBadge(null); }", 'undefined')],
    ['안 읽은 수 실패마다 E-CHAT-02 를 알림(한 번 제한 없음)', (s) => s.replace("if(_chatUnreadNotifiedRoom === room) return;", '')],
    ['안 읽은 수 실패를 E-CHAT-02 로 알리지 않음', (s) => s.replace("TwErrorCodes.notify('E-CHAT-02', e);\n}\nfunction _startChatBadgeSub", "}\nfunction _startChatBadgeSub")],
    ['기록을 못 열면 최근 줄 구독으로 돌림(예전 갈래)', (s) => s.replace('catch(e){ histFail(e); }', 'catch(e){ chatNet.subscribeLog(room, _onList, undefined, tab); }')],
    ['보낸 뒤 읽음 저장 빼기(예전)', (s) => s.replace('if(r && r.ok) _chatMarkSentRead(sendKey, r);', '')],
    ['앞으로만 빼기 — 늘 덮기', (s) => s.replace(/(function _chatMarkSentRead\(key, sent\)\{[\s\S]*?)if\(!old \|\| !CHAT_MARK_RE\.test\(old\) \|\| _chatIsAfter\(sent, old\)\) /, '$1')],
    ['지금 탭에 저장(보낸 탭 아님)', (s) => s.replace('_chatMarkSentRead(sendKey, r)', '_chatMarkSentRead(_chatMarkKey(room, _chatMyTabId()), r)')],
    ['열린 창 구분선도 옮기기', (s) => s.replace(/(function _chatMarkSentRead\(key, sent\)\{)/, '$1 _chatReadMarker = _chatMarkOf(sent);')],
  ];
  for(const [name, f] of breaks){
    const b = f(MOD);
    if(b === MOD){ chk(false, '깨 보기 «' + name + '» — 바꿀 줄을 못 찾음'); continue; }
    let bad = 0;
    try{ bad = (await judgeAll(b)).filter(([ok]) => !ok).length; }catch(_){ bad = 1; }
    chk(bad > 0, '깨 보기 «' + name + '» → 빨강 ' + bad + '건');
  }
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
