/* sim-chat-focus.js — 📊 시크릿룸 #집중 탭(방 전체 집중 기록 · 오늘 / 이번 주 · 사람별 순위)
   ・1절: 순수 규칙 — 주 시작(월요일) · 통계(오늘 · 이번 주 · 누적 · 합친 초 · 틀린 칸 버림) · 순위(기준 · 동점) · 12주 합치기 계획 · 시간 글자
   ・2절: 화면 조각 — 남이 쓴 이름은 escape · 불러오는 중 / 실패 / 없음 · 내 줄 · 막대 · 지우기 확인
   ・3절: 컨트롤러(가짜 DOM · 가짜 provider) — 열 때만 구독 · 올리기 켜기 · 순위 기준 · 내 기록 지우기(실패는 E-CHAT-02) · 12주 합치기 한 번 · 쓸 곳 없음 · 방이 바뀜 · 시크릿룸이 아니면 없음
   ・4절: 연결 — 채팅 모듈 · html · 에러 번호 · 모듈이 채팅 / 서버를 직접 안 부름
   ・5절: 깨 보기
   [실행] node checks/run.js sim-chat-focus */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, 'apps/desktop/app/parts/' + f, 'apps/desktop/app/' + f, path.basename(f)]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = {
  mod: read('chat/chat-focus.js'), days: read('shared/room-focus-days.js'), safe: read('shared/safe-html.js'), state: read('room/room-state.js'),
  chatui: read('chat/chat-ui.js'), lock: read('chat/chat-lock.js'), html: read('desk-companion-prototype.html'), codes: read('shared/error-codes.js'),
};
for (const k of Object.keys(SRC)) if (SRC[k] == null) { say('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const loadWin = (src, win) => { new Function('window', 'module', src)(win, undefined); return win; };
const SH = loadWin(SRC.safe, {}).TwSafeHtml;
const DAYS = loadWin(SRC.days, {}).TwRoomFocusDays;
const RS = loadWin(SRC.state, { _roomMetaCache: null }).TwRoomState;
const tick = () => new Promise((res) => setImmediate(res));

function mkEl(){
  const cls = new Set();
  const el = { innerHTML: '', textContent: '', value: '', _l: {}, focused: 0,
    classList: { toggle(c, on){ (on === undefined ? !cls.has(c) : on) ? cls.add(c) : cls.delete(c); }, contains: (c) => cls.has(c) },
    addEventListener(t, fn){ (el._l[t] = el._l[t] || []).push(fn); }, focus(){ el.focused++; } };
  return el;
}
function mkDoc(){ const els = {}; ['chatFocus', 'chatWindow', 'chatInput'].forEach((id) => { els[id] = mkEl(); }); return { els, getElementById: (id) => els[id] || null }; }

const TODAY = '20261113';   // 금요일 — 이번 주 월요일은 20261109
const RAW = {
  'MATE-1': { n: '꿀곰', d: { '20261113': 3600, '20261110': 1800, '20261101': 600 }, o: 7200 },
  'MATE-2': { n: '<b>파니니</b>', d: { '20261113': 600, '20261108': 900 } },
  'MATE-3': { n: ' ', d: { '20261112': 120 } },
  'MATE-4': { n: '유령', d: {} },
};

function mkCtl(src, o){
  o = o || {};
  const doc = mkDoc(), calls = [], toasts = [], errors = [];
  const cur = { room: o.room === undefined ? 'SCRT-AB12' : o.room, me: o.me === undefined ? 'MATE-1' : o.me, on: !!o.on };
  let cb = null, unsubs = 0, subs = 0;
  const provider = {
    subscribe: (room, f) => { subs++; calls.push(['sub', room]); cb = f; return () => { unsubs++; }; },
    compact: async (room, uid, plan) => { calls.push(['compact', room, uid, plan]); return { ok: true }; },
    removeMine: async (room, uid) => { calls.push(['wipe', room, uid]); return o.failWipe ? { ok: false } : { ok: true }; },
  };
  const sync = { isOn: (r) => cur.on, setOn: (r, v) => { calls.push(['setOn', r, v]); cur.on = v; }, forgetName: (r) => { calls.push(['forget', r]); } };
  const M = loadWin(src, { TwRoomFocusDays: DAYS }).TwChatFocus;
  const c = M.createChatFocus({ document: doc, escHtml: SH.text, toast: (m) => toasts.push(m), getMyUserId: () => cur.me, roomCode: () => cur.room, roomState: RS, provider, sync, todayKey: () => o.today || TODAY, notifyError: (code) => errors.push(code) });
  let changes = 0; c.onChange(() => { changes++; });
  return { c, M, doc, calls, toasts, errors, cur, push: (raw) => cb(raw), counts: () => ({ subs, unsubs }), changes: () => changes };
}

async function judge(S){
  const out = [];
  const t = (ok, msg) => out.push([!!ok, msg]);
  try {
    const M = loadWin(S.mod, { TwRoomFocusDays: DAYS }).TwChatFocus;
    /* ── 1절 순수 규칙 ── */
    const st = M.stats(RAW, TODAY);
    const byId = Object.fromEntries(st.rows.map((r) => [r.id, r]));
    t(byId['MATE-1'].today === 3600 && byId['MATE-1'].week === 5400 && byId['MATE-1'].total === 3600 + 1800 + 600 + 7200, '통계 — 오늘 · 이번 주(월~오늘) · 누적(날 칸 + 합친 초 o)');
    t(byId['MATE-2'].week === 600 && byId['MATE-2'].total === 1500, '  이번 주 앞날(일요일 20261108)은 주에 안 들어가고 누적에만');
    t(byId['MATE-3'].name === '이름 없음' && !byId['MATE-4'], '  이름이 비면 «이름 없음» · 기록이 0 인 사람은 줄에서 뺀다');
    t(st.roomTotal === 13200 + 1500 + 120 && st.roomToday === 4200 && st.roomWeek === 5400 + 600 + 120, '  방 전체 — 누적 · 오늘 · 이번 주 합');
    const bad = M.stats({ a: { n: 'x', d: { '20261113': -5, '20261112': 90000, 'x': 5, '2026-11-11': 5, '20261111': '5', '20261110': 60 }, o: -3 }, b: null, c: 'z', d: { n: 'y', d: [1, 2], o: 'a' } }, TODAY);
    t(bad.rows.length === 1 && bad.rows[0].total === 60 && bad.roomTotal === 60, '  모양이 틀린 값(음수 · 하루 상한 초과 · 이상한 키 · 문자 · 배열)은 버리고 읽는다');
    { const fu = M.stats({ a: { n: 'x', d: { '20261113': 60, '20261114': 999 } } }, TODAY).rows[0];
      t(fu.today === 60 && fu.week === 60 && fu.total === 1059, '  오늘보다 앞선 날(시계가 앞선 기기)은 오늘 · 이번 주에 안 세고 누적에만'); }
    t(M.stats(null, TODAY).rows.length === 0 && M.stats('x', TODAY).roomTotal === 0, '  비었거나 이상한 서버 사본은 빈 통계');
    t(M.stats({ a: { n: '가'.repeat(30), d: { '20261113': 5 } } }, TODAY).rows[0].name.length === 20, '  이름은 20자까지만 쓴다');
    const r1 = M.rank(st.rows, 'today').map((r) => r.id).join();
    t(r1 === 'MATE-1,MATE-2', '순위(오늘) — 큰 순 · 오늘 0 인 사람은 뺀다');
    t(M.rank(st.rows, 'total').map((r) => r.id).join() === 'MATE-1,MATE-2,MATE-3' && M.rank(st.rows, 'week').map((r) => r.id).join() === 'MATE-1,MATE-2,MATE-3' && M.rank(st.rows, '???').map((r) => r.id).join() === 'MATE-1,MATE-2,MATE-3', '  누적 · 이번 주 · 모르는 기준은 이번 주');
    t(M.rank([{ id: 'b', name: '나', today: 5, week: 5, total: 5 }, { id: 'a', name: '가', today: 5, week: 5, total: 5 }], 'today').map((r) => r.id).join() === 'a,b', '  동점은 이름순');
    t(M.compactPlan(RAW['MATE-1'], TODAY) === null, '합치기 — 12주(84일) 안의 날만 있으면 할 일 없음');
    const cp = M.compactPlan({ d: { '20260820': 100, '20260821': 50, '20260101': 200, 'x': 9, '20260102': 90000 }, o: 1000 }, TODAY);
    t(cp && cp.keys.sort().join() === '20260101,20260820' && cp.newO === 1300, '  84일보다 오래된 날(20260820 이전)만 · 기존 o 에 더한다 · 이상한 칸은 건드리지 않는다');
    t(M.compactPlan({ d: { '20260821': 5 } }, TODAY) === null && M.compactPlan(null, TODAY) === null && M.compactPlan({}, TODAY) === null, '  경계 — 정확히 84일 전 날은 남긴다 · 비었으면 null');
    t(M.fmtDur(0) === '0분' && M.fmtDur(59) === '0분' && M.fmtDur(60) === '1분' && M.fmtDur(3599) === '59분' && M.fmtDur(3600) === '1시간 00분' && M.fmtDur(43500) === '12시간 05분' && M.fmtDur(-5) === '0분' && M.fmtDur('x') === '0분', '시간 글자 — 분 단위 · 1시간부터 «n시간 mm분» · 이상한 값은 0분');

    /* ── 2절 화면 조각 ── */
    const ui = { on: false, metric: 'week', delAsk: false, failed: false, loading: false, myId: 'MATE-1' };
    const html = M.viewHtml(st, ui, SH.text);
    t(/방 전체 누적/.test(html) && html.indexOf('4시간') < 0 === false || /cf-total-v/.test(html), '큰 글씨 «방 전체 누적» 이 맨 위');
    t(!/<b>파니니/.test(html) && /&lt;b&gt;파니니/.test(html), '남이 쓴 이름은 escape 를 거친다(<b> 가 그대로 안 들어간다)');
    t(/class="cf-row me"/.test(html) && (html.match(/class="cf-row/g) || []).length === 3, '내 줄은 me 표시 · 이번 주 기록이 있는 3명');
    t(/data-m="week"[^>]*class="on"/.test(html) && !/data-act="toggle" checked/.test(html), '고른 기준(이번 주)이 켜져 있고 올리기는 꺼진 상태');
    t(/data-act="toggle" checked/.test(M.viewHtml(st, Object.assign({}, ui, { on: true }), SH.text)), '  올리기를 켜면 체크됨');
    t(/불러오는 중/.test(M.viewHtml(st, Object.assign({}, ui, { loading: true }), SH.text)) && !/cf-row/.test(M.viewHtml(st, Object.assign({}, ui, { loading: true }), SH.text)), '불러오는 중 — 줄 대신 안내');
    t(/불러오지 못했어요/.test(M.viewHtml(st, Object.assign({}, ui, { failed: true }), SH.text)) && !/아직 .* 기록이 없어요/.test(M.viewHtml(st, Object.assign({}, ui, { failed: true }), SH.text)), '읽기 실패는 «없음» 이 아니라 «불러오지 못했어요»');
    t(/아직 이번 주 기록이 없어요/.test(M.viewHtml(M.stats({}, TODAY), ui, SH.text)), '기록이 없으면 «아직 … 기록이 없어요»');
    t(/data-act="wipe"/.test(html) && !/wipeok/.test(html) && /data-act="wipeok"/.test(M.viewHtml(st, Object.assign({}, ui, { delAsk: true }), SH.text)) && /data-act="cancel"/.test(M.viewHtml(st, Object.assign({}, ui, { delAsk: true }), SH.text)), '내 기록 지우기 — 눌러야 «정말?» 이 나온다(그 자리에서 확인)');
    t(/올리기가 켜져 있어서 지운 뒤에도 다시 쌓여요/.test(M.viewHtml(st, Object.assign({}, ui, { delAsk: true, on: true }), SH.text)) && !/다시 쌓여요/.test(M.viewHtml(st, Object.assign({}, ui, { delAsk: true, on: false }), SH.text)), '  켜 둔 채 지우면 «지운 뒤에도 다시 쌓여요» 를 알린다(꺼져 있으면 말하지 않는다)');
    t(/width:100%/.test(html) && /width:\d+%/.test(html) && !/width:NaN/.test(html), '막대 길이는 1등 대비 % 숫자');

    /* ── 3절 컨트롤러 ── */
    { const k = mkCtl(S.mod); t(k.c.available() && !k.c.isActive() && k.counts().subs === 0, '시크릿룸 — 탭은 있고 열기 전에는 구독하지 않는다(읽기 0)');
      k.c.open(); const h = () => k.doc.els.chatFocus.innerHTML;
      t(k.c.isActive() && k.counts().subs === 1 && k.doc.els.chatWindow.classList.contains('focus-mode') && /불러오는 중/.test(h()) && k.changes() >= 1, '열면 구독 1 · focus-mode · 응답 전에는 «불러오는 중» · 탭 줄 다시 그리기 알림');
      k.push(RAW); t(/방 전체 누적/.test(h()) && /꿀곰/.test(h()), '  응답이 오면 그린다');
      k.c.act('metric', 'today'); t(/data-m="today"[^>]*class="on"/.test(h()), '순위 기준 단추(오늘)');
      k.c.act('metric', '???'); t(/data-m="today"[^>]*class="on"/.test(h()), '  모르는 기준은 무시');
      k.c.act('toggle', true); t(k.calls.some((c) => c[0] === 'setOn' && c[1] === 'SCRT-AB12' && c[2] === true) && /data-act="toggle" checked/.test(h()), '올리기 켜기 — 이 방에만 · 화면에도 체크');
      k.c.act('toggle', false); t(k.calls.filter((c) => c[0] === 'setOn').pop()[2] === false && !/data-act="toggle" checked/.test(h()), '  끄기');
      const before = k.counts().subs; k.c.start(); t(k.counts().subs === before, '같은 방에서 start() 해도 구독이 겹치지 않는다');
      k.cur.room = 'SCRT-ZZ99'; k.c.start(); t(k.counts().unsubs === 1 && k.counts().subs === 2 && k.calls.filter((c) => c[0] === 'sub').pop()[1] === 'SCRT-ZZ99', '방이 바뀌면 옛 방 구독을 풀고 새 방을 건다(보는 중이면)');
      k.cur.room = 'WORK-AB12'; k.c.start(); t(!k.c.available() && !k.c.isActive() && k.counts().unsubs === 2 && !k.doc.els.chatWindow.classList.contains('focus-mode'), '시크릿룸을 벗어나면 구독 해제 · 보기 해제');
      k.cur.room = 'SCRT-AB12'; k.c.open(); const n = k.changes(); k.c.close();
      t(!k.c.isActive() && k.changes() > n && !k.doc.els.chatWindow.classList.contains('focus-mode') && k.counts().unsubs === 3, '닫으면 구독 해제 · 탭 줄 알림'); }
    { const k = mkCtl(S.mod, { room: 'WORK-AB12' }); k.c.open();
      t(!k.c.available() && !k.c.isActive() && k.counts().subs === 0, '시크릿룸이 아니면 열지 않는다(탭도 없다)'); }
    { const k = mkCtl(S.mod); k.c.open(); k.push(null);
      t(/불러오지 못했어요/.test(k.doc.els.chatFocus.innerHTML), '읽기 실패 — «불러오지 못했어요»'); k.c.close(); k.c.open();
      t(k.counts().subs === 2, '  다시 열면 다시 건다'); }
    { const k = mkCtl(S.mod); k.c.open(); const inp = mkEl(); inp.value = '쓰던 글';
      t(k.c.submit(inp) === true && k.toasts.length === 1 && inp.value === '쓰던 글', '#집중 에서 Enter — 안내만 하고 채팅으로 안 보낸다 · 친 글은 그대로');
      k.c.close(); t(k.c.submit(inp) === false, '  #집중 이 아니면 건드리지 않는다(채팅 그대로)');
      t(/집중/.test(k.c.hint()), '  입력칸 안내문'); }
    { const k = mkCtl(S.mod); k.c.open(); k.push(RAW); k.c.act('wipe'); t(/data-act="wipeok"/.test(k.doc.els.chatFocus.innerHTML) && k.calls.every((c) => c[0] !== 'wipe'), '내 기록 지우기 — 처음 눌러서는 지우지 않고 묻는다');
      k.c.act('cancel'); t(!/wipeok/.test(k.doc.els.chatFocus.innerHTML), '  취소');
      k.c.act('wipe'); k.c.act('wipeok'); await tick(); await tick();
      t(k.calls.some((c) => c[0] === 'wipe' && c[1] === 'SCRT-AB12' && c[2] === 'MATE-1') && k.toasts.some((m) => /지웠/.test(m)) && k.errors.length === 0, '  확인하면 내 칸(내 id)만 지운다');
      t(k.calls.some((c) => c[0] === 'forget' && c[1] === 'SCRT-AB12'), '  지운 뒤 올리기 모듈에 «이름 다시 쓰기» 를 알린다'); }
    { const k = mkCtl(S.mod, { failWipe: true }); k.c.open(); k.push(RAW); k.c.act('wipe'); k.c.act('wipeok'); await tick(); await tick();
      t(k.errors.join() === 'E-CHAT-02' && k.calls.every((c) => c[0] !== 'forget'), '  지우기가 서버에서 실패하면 E-CHAT-02(이름은 그대로 — 지워지지 않았으니)'); }
    { const old = { 'MATE-1': { n: '꿀곰', d: { '20260101': 100, '20261113': 5 }, o: 50 }, 'MATE-2': { d: { '20260101': 999 } } };
      const k = mkCtl(S.mod); k.c.open(); k.push(old); await tick(); k.push(old); await tick();
      const cc = k.calls.filter((c) => c[0] === 'compact');
      t(cc.length === 1 && cc[0][2] === 'MATE-1' && cc[0][3].newO === 150 && cc[0][3].keys.join() === '20260101', '12주 합치기 — 내 칸의 오래된 날만 · 구독이 여러 번 와도 한 번(남의 칸은 건드리지 않는다)');
      const k2 = mkCtl(S.mod, { me: '' }); k2.c.open(); k2.push(old); await tick();
      t(k2.calls.every((c) => c[0] !== 'compact'), '  내 id 가 없으면 합치지 않는다'); }

    /* ── 4절 연결 ── */
    const C = S.chatui;
    t(/const chatFocus = deps\.chatFocus;/.test(C) && /chatFocus\.onChange\(\(\) => \{ _chatTabsRender\(\); _chatOffRefreshUI\(\); \}\)/.test(C) && /chatFocus\.start\(\);/.test(C) && /chatFocus\.stop\(\);/.test(C) && /if\(chatFocus\.submit\(\)\) return;/.test(C), '채팅 모듈 — 알림 걸기 · 창 열 때 · 닫을 때 · Enter 가 #집중 이면 전송 건너뜀');
    t(/if\(t\.dataset\.tab === 'focus'\)\{ if\(chatNotice\.isActive\(\)\) chatNotice\.close\(\); chatFocus\.open\(\); return; \}/.test(C) && /if\(chatFocus\.isActive\(\)\) chatFocus\.close\(\);/.test(C) && /if\(id === 'notice' \|\| id === 'focus'\) return;/.test(C), '  탭 누르기 — 공지와 집중은 한 번에 하나 · 다른 탭을 누르면 둘 다 나온다 · 우클릭 메뉴 없음');
    t(/chatFocus\.available\(\)[\s\S]{0,400}data-tab="focus"/.test(C) && /!noticeOn && !focusOn/.test(C) && C.indexOf('data-tab="notice"') < C.indexOf('data-tab="focus"'), '  탭 줄 — #공지 다음에 #집중 · 보는 동안 #일반 은 꺼진 표시');
    t(/chatUiMod\._chatViewHint\(\) \|\| \(off \?/.test(S.lock), '채팅 잠금 — #공지 · #집중 이면 입력칸 안내문을 그에 맞게');
    const H = S.html;
    t(/id="chatFocus"/.test(H) && H.indexOf('id="chatNotices"') < H.indexOf('id="chatFocus"') && /#chatWindow\.focus-mode \.chat-msgbox,[\s\S]*?\.chat-memberbar,[\s\S]*?\.chat-toolbar,[\s\S]*?\.chat-flyrow,[\s\S]*?\.chat-pin\{display:none !important;\}/.test(H) && /#chatWindow\.focus-mode \.chat-focus\{display:block;\}/.test(H) && /#chatWindow\.min \.chat-focus,/.test(H), 'html — #집중 본문 자리 · 보는 동안 대화 칸 숨김 · 접으면 숨김');
    t(!/#[0-9a-fA-F]{3,8}\b/.test(H.slice(H.indexOf('.chat-focus{display:none'), H.indexOf('.chat-focus .cf-del button')).replace(/background:#fff;/, '')), '  #집중 스타일은 토큰만(색 코드 직접 쓰기 없음 — 흰 칸 #fff 한 곳은 대화 칸과 같다)');
    t(/'E-CHAT-02': \{ msg: '[^']+', where: 'chat\/chat-focus\.js/.test(S.codes), '에러 번호 E-CHAT-02 이 표에 있다');
    t(!/chat-ui|chat-lock|Presence|firebaseAPI|window\.firebase/.test(S.mod.replace(/\/\*[\s\S]*?\*\//g, '')), '집중 탭 모듈은 채팅 · 잠금 모듈 · Presence · firebaseAPI 를 직접 부르지 않는다(provider · deps 로만)');
  } catch (err) {
    t(false, '돌리다 오류 — ' + (err && err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : err));
  }
  return out;
}

(async () => {
  say('── 1 ~ 4. 규칙 · 화면 · 컨트롤러 · 연결 (진짜 모듈을 돌린다)');
  (await judge(SRC)).forEach(([ok, msg]) => chk(ok, msg));
  say('── 5. 일부러 깨 보기 — 빨강이 나야 한다');
  const BREAKS = [
    ['mod', "if(k >= wk && k <= todayKey) week += d[k];", "if(k >= wk) week += d[k];", '이번 주에 앞날(미래)까지 셈'],
    ['mod', "if(k >= wk && k <= todayKey) week += d[k];", "if(k <= todayKey) week += d[k];", '이번 주가 지난주까지 셈'],
    ['mod', "let today = 0, week = 0, total = okSec(v.o, 360000000) ? v.o : 0;", "let today = 0, week = 0, total = 0;", '합친 초(o)가 누적에서 빠짐'],
    ['mod', "if(!isDayKey(k) || !okSec(d[k], DAY_MAX)) return;", "if(!isDayKey(k)) return;", '하루 상한을 넘는 값도 셈'],
    ['mod', "if(total <= 0) return;", "", '기록 0 인 사람도 줄에 나옴'],
    ['mod', "return rows.filter(r => r[m] > 0).sort(", "return rows.sort(", '순위가 그 기준이 0 인 사람을 안 뺌'],
    ['mod', "(b[m] - a[m]) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)", "(a[m] - b[m])", '순위가 작은 순 · 동점 규칙 없음'],
    ['mod', "k < cut && okSec(node.d[k], DAY_MAX)", "k <= cut && okSec(node.d[k], DAY_MAX)", '12주 경계 하루가 어긋남'],
    ['mod', "(okSec(node.o, 360000000) ? node.o : 0) + sum", "sum", '합칠 때 기존 o 를 덮어씀'],
    ['mod', "escHtml(r.name)", "r.name", '이름을 escape 없이 화면에 넣음'],
    ['mod', "if(ui.failed){", "if(false){", '읽기 실패를 «없음» 으로 그림'],
    ['mod', "(ui.on ? '<br>올리기가 켜져 있어서", "(false ? '<br>올리기가 켜져 있어서", '켜 둔 채 지울 때 다시 쌓인다는 안내가 없음'],
    ['mod', "else if(name === 'wipe'){ delAsk = true; paint(); }", "else if(name === 'wipe') wipe();", '묻지 않고 바로 지움'],
    ['mod', "provider.removeMine(room, me)", "provider.removeMine(room, '*')", '내 칸이 아닌 곳을 지움'],
    ['mod', "if(!(r && r.ok)) notifyError('E-CHAT-02');", "", '지우기 실패를 알리지 않음'],
    ['mod', "sync.forgetName(room); ", "", '지운 뒤 올리기에 이름 다시 쓰기를 알리지 않음'],
    ['mod', "if(sig === compactedFor) return;", "", '같은 합치기를 구독마다 다시 보냄'],
    ['mod', "const me = getMyUserId(); if(!me || !raw || !raw[me]) return;", "const me = Object.keys(raw)[0]; if(!me || !raw || !raw[me]) return;", '남의 칸을 합침'],
    ['mod', "if(unsub && subRoom === room) return;", "if(unsub) return;", '방이 바뀌어도 옛 방을 계속 구독'],
    ['mod', "    toast('#집중 에서는 글을 쓸 수 없어요 — #일반 에서 이야기해요');\n    return true;", "    return false;", '#집중 에서 쓴 글이 채팅으로 나감'],
    ['mod', "unsubscribe(); raw = {}; loaded = false; loadFailed = false;\n    paint(); changed();", "raw = {}; loaded = false; loadFailed = false;\n    paint(); changed();", '탭을 닫아도 구독이 남음'],
    ['chatui', "chatFocus.submit()) return;", "chatFocus.submit() && false) return;", 'Enter 가 #집중 에서 채팅으로 샘'],
    ['chatui', "if(id === 'notice' || id === 'focus') return;", "if(id === 'notice') return;", '#집중 에 우클릭 삭제 메뉴가 뜸'],
    ['html', "#chatWindow.focus-mode .chat-msgbox,\n", "", '#집중 보는 동안 대화 칸이 안 숨음'],
    ['html', "  #chatWindow.min .chat-focus,\n", "", '접어도 #집중 본문이 남음'],
  ];
  for (const [k, from, to, why] of BREAKS) {
    if (SRC[k].indexOf(from) < 0) { chk(false, '깨 볼 글을 못 찾음 — ' + why); continue; }
    const s2 = Object.assign({}, SRC, { [k]: SRC[k].replace(from, to) });
    let rows;
    try { rows = await judge(s2); } catch (e) { rows = [[false, String(e)]]; }
    chk(rows.some(([ok]) => !ok), why + ' → 빨강');
  }
  say('');
  say(fail ? '✗ 통과 ' + pass + ' · 실패 ' + fail : '전부 통과 ✅ — 열 때만 읽고 · 켠 사람의 이름과 시간만 보이고 · 오늘 / 이번 주 / 누적 순위가 맞는다');
  process.exit(fail ? 1 : 0);
})();
