/* sim-chat-notice.js — 📢 시크릿룸 공지(#공지 탭 · 고정 한 줄) — chat/chat-notice.js · chat-notice-net.js · 규칙 · 연결
   [무엇을 지키나] 시크릿룸 방장이 #공지 탭에서 공지를 쓰고 · 고치고 · 지우고 · 하나를 📌 고정하면, 모든 채팅 탭 위에 한 줄로 뜬다.
     공지는 채팅 말풍선 · 기록으로 안 나가고, 방장만 쓰며, 남이 쓴 글이라 HTML 로 안 읽힌다.
   ・1절: 순수 규칙 — list(정렬 · 잘못된 칸) · pinnedOf · cleanText(경계 300) · freeSlot(상한 20) · pinClearIds · timeText
   ・2절: 화면 조각 — 글은 escHtml 을 거친다 · 방장에게만 단추 · 고치는 줄 · 지울지 묻는 줄 · 빈 안내
   ・3절: 컨트롤러(진짜 모듈 · 가짜 DOM · 진짜 room-state) — 시크릿룸 아니면 없음 · 구독 · 열기 · 쓰기(채팅으로 안 나감) · 참여자는 못 씀 · 고치기 · 지우기 · 고정 · 고정 줄
   ・4절: 서버 읽기 · 쓰기(진짜 모듈 · 가짜 db) — 빈 자리 · 꽉 참 · 고정 묶음 · 해제
   ・5절: 연결 — 규칙(_notice · 시크릿룸만 · n1~n20 · 300자) · html · app.js · 채팅 모듈 · 에러 번호
   ・6절: 일부러 깨 보기
   [실행] node checks/run.js sim-chat-notice */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, 'apps/desktop/app/parts/' + f, 'apps/desktop/app/' + f, path.basename(f)]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = {
  mod: read('chat/chat-notice.js'), net: read('chat/chat-notice-net.js'), safe: read('shared/safe-html.js'), state: read('room/room-state.js'),
  chatui: read('chat/chat-ui.js'), lock: read('chat/chat-lock.js'), app: read('app.js'), html: read('desk-companion-prototype.html'),
  fi: read('firebase-init.js'), codes: read('shared/error-codes.js'),
  rules: (() => { for (const c of ['firebase-database-rules.json', 'firebase/firebase-database-rules.json']) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; })(),
};
for (const k of Object.keys(SRC)) if (SRC[k] == null) { say('  ? 원본 못 찾음 — ' + k); process.exit(2); }

const loadWin = (src, win) => { new Function('window', 'module', src)(win, undefined); return win; };
const SH = loadWin(SRC.safe, {}).TwSafeHtml;
const RS = loadWin(SRC.state, { _roomMetaCache: null }).TwRoomState;
const tick = () => new Promise((res) => setImmediate(res));

/* 가짜 DOM — 컨트롤러가 쓰는 것만 */
function mkEl(){
  const cls = new Set();
  const el = { innerHTML: '', textContent: '', title: '', value: '', _l: {}, focused: 0, style: { setProperty(){} },
    classList: { toggle(c, on){ (on === undefined ? !cls.has(c) : on) ? cls.add(c) : cls.delete(c); }, contains: (c) => cls.has(c) },
    addEventListener(t, fn){ (el._l[t] = el._l[t] || []).push(fn); }, querySelector: () => el._q || null, focus(){ el.focused++; }, select(){} };
  return el;
}
function mkDoc(){ const els = {}; ['chatNotices', 'chatPin', 'chatWindow', 'chatInput'].forEach((id) => { els[id] = mkEl(); }); return { els, getElementById: (id) => els[id] || null }; }

function mkCtl(src, o){
  o = o || {};
  const doc = mkDoc(), calls = [], toasts = [], errors = [], changes = { n: 0 };
  const win = { _roomMetaCache: o.meta === undefined ? { host: 'ME' } : o.meta };
  let cb = null, unsubs = 0, subs = 0;
  const provider = {
    subscribe: (room, f) => { subs++; calls.push(['sub', room]); cb = f; return () => { unsubs++; }; },
    add: async (room, t) => { calls.push(['add', room, t]); return o.addRes || { ok: true, id: 'n1' }; },
    edit: async (room, id, t) => { calls.push(['edit', room, id, t]); return { ok: true }; },
    remove: async (room, id) => { calls.push(['remove', room, id]); return { ok: true }; },
    pin: async (room, id, on, clr) => { calls.push(['pin', room, id, on, clr.join()]); return { ok: true }; },
  };
  const M = loadWin(src, win).TwChatNotice;
  const room = o.room === undefined ? 'SCRT-AB12' : o.room;
  const c = M.createChatNotice({ document: doc, escHtml: SH.text, toast: (m) => toasts.push(m), getMyUserId: () => 'ME', roomCode: () => room, roomState: RS, provider, notifyError: (code) => errors.push(code) });
  c.onChange(() => { changes.n++; });
  return { c, M, doc, calls, toasts, errors, changes, push: (raw) => cb(raw), counts: () => ({ subs, unsubs }), win };
}
const NOW = new Date(2026, 10, 13, 9, 5).getTime();
const RAW = { n1: { text: '첫 공지', ts: 100 }, n2: { text: '둘째 <b>공지</b>', ts: 300 }, n3: { text: '셋째', ts: 200, pin: true } };

async function judge(src, extra){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  try {
    const M = loadWin(src, {}).TwChatNotice;
    /* 1절 */
    const L = M.list({ n1: { text: '가', ts: 10 }, n2: { text: '나', ts: 30 }, n3: { text: '다', ts: 20, pin: true }, x9: { text: '이상한 자리', ts: 99 }, n4: { ts: 5 }, n5: { text: '   ', ts: 5 }, n6: { text: 'z'.repeat(400), ts: 1 }, n21: { text: '스물하나', ts: 9 } });
    t(L.map((x) => x.id).join() === 'n3,n2,n1,n6', 'list — 고정이 맨 위 · 새 글이 먼저 · 틀린 자리(x9 · n21) · 글 없는 칸 · 빈 글은 버린다');
    t(L[3].text.length === 300, '  300자를 넘는 글은 잘라 읽는다');
    t(M.list(null).length === 0 && M.list('x').length === 0 && M.list([]).length === 0, '  null · 글자 · 배열 → 빈 목록');
    t(M.pinnedOf(M.list({ n1: { text: 'a', ts: 5, pin: true }, n2: { text: 'b', ts: 9, pin: true } })).id === 'n2' && M.pinnedOf(M.list({ n1: { text: 'a', ts: 5 } })) === null && M.pinnedOf([]) === null, 'pinnedOf — 둘 이상이면 가장 새 것 · 없으면 null');
    t(M.cleanText('').err && M.cleanText('   \n ').err && M.cleanText(null).err, 'cleanText — 빈 글 · 공백뿐 · null 은 안내');
    t(M.cleanText(' 가\n 나   다 ').text === '가 나 다', '  줄바꿈 · 연속 공백은 한 칸 · 앞뒤 공백 뗌');
    t(M.cleanText('a'.repeat(300)).text.length === 300 && M.cleanText('a'.repeat(301)).err, '  경계 — 300자는 되고 301자는 안내');
    const full = Object.fromEntries(M.SLOTS.map((id) => [id, { text: 'x', ts: 1 }]));
    t(M.SLOTS.length === 20 && M.freeSlot(M.list(full)) === null, 'freeSlot — 20칸이 다 차면 null(상한 20)');
    const f2 = Object.assign({}, full); delete f2.n7;
    t(M.freeSlot(M.list(f2)) === 'n7' && M.freeSlot([]) === 'n1', '  지운 자리는 다시 쓴다 · 빈 목록은 n1');
    t(M.pinClearIds(M.list({ n1: { text: 'a', ts: 1, pin: true }, n2: { text: 'b', ts: 2, pin: true }, n3: { text: 'c', ts: 3 } }), 'n2').join() === 'n1', 'pinClearIds — 새로 고정할 것 말고 pin 이 서 있는 것만');
    t(M.timeText(NOW) === '11.13 09:05' && M.timeText(0) === '' && M.timeText(NaN) === '', 'timeText — 11.13 09:05 · 없으면 빈 글');

    /* 2절 */
    const esc = SH.text;
    const h1 = M.listHtml(M.list({ n1: { text: '<img src=x onerror=alert(1)>', ts: 5 } }), { host: true, editId: null, delId: null }, esc);
    t(!/<img/.test(h1) && /&lt;img/.test(h1), '화면 조각 — 남이 쓴 글은 HTML 로 안 읽힌다(escHtml)');
    const hh = M.listHtml(M.list(RAW), { host: true, editId: null, delId: null }, esc), hg = M.listHtml(M.list(RAW), { host: false, editId: null, delId: null }, esc);
    t(/data-act="pin"/.test(hh) && /data-act="edit"/.test(hh) && /data-act="del"/.test(hh) && !/data-act=/.test(hg), '  방장에게만 📌 · ✎ · 🗑 단추 — 참여자는 읽기만');
    t(/class="cn-item pin"/.test(hh) && (hh.match(/cn-pinmark/g) || []).length === 1, '  고정한 공지에만 📌 표시');
    const he = M.listHtml(M.list(RAW), { host: true, editId: 'n2', delId: null }, esc);
    t(/class="cn-edit-in"[^>]*value="둘째 &lt;b&gt;공지&lt;\/b&gt;"/.test(he) && /data-act="save"/.test(he), '  고치는 줄 — 입력칸에 글(escape) · [저장] [취소]');
    const hd = M.listHtml(M.list(RAW), { host: true, editId: null, delId: 'n1' }, esc);
    t(/삭제할까요/.test(hd) && /data-act="delok"/.test(hd), '  지울지 묻는 줄 — [삭제] [취소] 가 그 칸 안에');
    t(/아직 공지가 없어요/.test(M.listHtml([], { host: false }, esc)) && /Enter/.test(M.listHtml([], { host: true }, esc)) && !/Enter/.test(M.listHtml([], { host: false }, esc)), '  빈 안내 — 방장에게만 «쓰는 법»');

    /* 3절 */
    let k = mkCtl(src, { room: 'WORK-AB12' });
    k.c.start();
    t(!k.c.available() && k.counts().subs === 0 && !k.doc.els.chatWindow.classList.contains('notice-mode'), '컨트롤러 — 시크릿룸이 아니면 구독도 탭도 없다');
    k.c.open();
    t(!k.c.isActive(), '  열려 해도 안 열린다');
    k = mkCtl(src);
    k.c.start(); k.push(RAW);
    t(k.c.available() && k.counts().subs === 1 && k.c.count() === 3 && k.changes.n >= 1, '시크릿룸 — 구독하고 공지 3개를 받는다(탭 줄 다시 그리기 알림)');
    t(k.doc.els.chatPin.classList.contains('on') && /셋째/.test(k.doc.els.chatPin.innerHTML), '  고정한 공지가 위 한 줄에 뜬다');
    k.c.open();
    t(k.c.isActive() && k.doc.els.chatWindow.classList.contains('notice-mode') && /첫 공지/.test(k.doc.els.chatNotices.innerHTML) && !k.doc.els.chatPin.classList.contains('on'), '  #공지 탭을 열면 목록이 보이고 위 줄은 숨는다');
    t(/방장|Enter/.test(k.c.hint()) && /Enter/.test(k.c.hint()), '  입력칸 안내문 — 방장은 «공지 쓰기»');
    const inp = mkEl(); inp.value = ' 오늘 \n 8시  모임 ';
    t(k.c.submit(inp) === true && inp.value === '', '쓰기 — 공지로 처리하고(채팅으로 안 나감) 입력칸을 비운다');
    await tick();
    t(JSON.stringify(k.calls.filter((x) => x[0] === 'add')) === JSON.stringify([['add', 'SCRT-AB12', '오늘 8시 모임']]), '  다듬은 글을 서버에 올린다');
    const inp2 = mkEl(); inp2.value = '   ';
    t(k.c.submit(inp2) === true && k.calls.filter((x) => x[0] === 'add').length === 1, '  빈 글은 올리지 않고 그래도 채팅으로도 안 나간다');
    const kf = mkCtl(src, { addRes: { ok: false, reason: '공지는 20개까지예요' } });
    kf.c.start(); kf.c.open();
    const inp3 = mkEl(); inp3.value = '넘침';
    kf.c.submit(inp3); await tick(); await tick();
    t(inp3.value === '넘침' && kf.toasts.join() === '공지는 20개까지예요' && kf.errors.length === 0, '  꽉 찼으면 친 글을 돌려주고 안내(에러 번호 없이)');
    const kn = mkCtl(src, { addRes: { ok: false } });
    kn.c.start(); kn.c.open();
    const inp4 = mkEl(); inp4.value = '실패'; kn.c.submit(inp4); await tick(); await tick();
    t(inp4.value === '실패' && kn.errors.join() === 'E-CHAT-01', '  못 올리면 친 글을 돌려주고 E-CHAT-01');
    /* 고치기 · 지우기 · 고정 */
    k.calls.length = 0;
    k.c.act('pin', 'n1'); await tick();
    t(JSON.stringify(k.calls) === JSON.stringify([['pin', 'SCRT-AB12', 'n1', true, 'n3']]), '고정 — n1 을 고정하고 이미 고정된 n3 의 pin 을 같은 묶음으로 지운다(하나만)');
    k.calls.length = 0; k.c.act('pin', 'n3'); await tick();
    t(JSON.stringify(k.calls) === JSON.stringify([['pin', 'SCRT-AB12', 'n3', false, '']]), '  고정한 것을 다시 누르면 푼다');
    k.c.act('edit', 'n2');
    t(/cn-edit-in/.test(k.doc.els.chatNotices.innerHTML), '고치기 — 그 칸이 입력칸으로');
    k.doc.els.chatNotices._q = { value: '  고친   글 ', focus(){}, select(){} };
    k.calls.length = 0; k.c.act('save', 'n2'); await tick();
    t(JSON.stringify(k.calls) === JSON.stringify([['edit', 'SCRT-AB12', 'n2', '고친 글']]), '  [저장] — 다듬은 글로 고친다');
    k.c.act('del', 'n1');
    t(/삭제할까요/.test(k.doc.els.chatNotices.innerHTML) && k.calls.filter((x) => x[0] === 'remove').length === 0, '지우기 — 바로 안 지우고 그 칸에서 한 번 묻는다');
    k.c.act('cancel', 'n1');
    t(!/삭제할까요/.test(k.doc.els.chatNotices.innerHTML), '  [취소] 하면 돌아간다');
    k.c.act('del', 'n1'); k.calls.length = 0; k.c.act('delok', 'n1'); await tick();
    t(JSON.stringify(k.calls) === JSON.stringify([['remove', 'SCRT-AB12', 'n1']]), '  [삭제] — 지운다');
    /* 참여자 */
    const kg = mkCtl(src, { meta: { host: 'SOMEONE' } });
    kg.c.start(); kg.push(RAW); kg.c.open();
    t(!/data-act=/.test(kg.doc.els.chatNotices.innerHTML), '참여자 — 목록에 단추가 없다');
    const ig = mkEl(); ig.value = '몰래 씀';
    t(kg.c.submit(ig) === true && kg.toasts.join() === '방장만 공지를 쓸 수 있어요' && kg.calls.filter((x) => x[0] === 'add').length === 0 && ig.value === '몰래 씀', '  쓰기는 안내만 · 서버에 안 올린다 · 친 글은 그대로');
    kg.c.act('pin', 'n1'); kg.c.act('del', 'n1'); kg.c.act('edit', 'n1'); await tick();
    t(kg.calls.filter((x) => x[0] !== 'sub').length === 0, '  고정 · 지우기 · 고치기를 직접 불러도 서버에 안 간다');
    /* 닫기 · 멈추기 */
    k.c.close();
    t(!k.c.isActive() && !k.doc.els.chatWindow.classList.contains('notice-mode') && k.doc.els.chatPin.classList.contains('on'), '닫기 — 다시 채팅 모습 · 고정 줄이 돌아온다');
    const before = k.counts().unsubs; k.c.stop();
    t(k.counts().unsubs === before + 1 && k.c.count() === 0 && !k.doc.els.chatPin.classList.contains('on'), '멈추기 — 구독 해제 · 목록 비움 · 위 줄 숨김');
    const kr = mkCtl(src); kr.c.start(); kr.push(RAW); kr.push(null);
    t(kr.c.count() === 3, '읽기 실패(null)가 와도 있던 공지를 지우지 않는다');
    const ke = mkCtl(src); ke.c.start(); ke.c.open(); ke.push(null);
    t(/불러오지 못했어요/.test(ke.doc.els.chatNotices.innerHTML) && !/아직 공지가 없어요/.test(ke.doc.els.chatNotices.innerHTML), '읽기 실패는 «공지 없음» 이 아니라 «불러오지 못했어요» 로 그린다');
    ke.c.start(); await tick();
    t(ke.counts().subs === 2, '  끊긴 구독은 다음 start() 에서 다시 건다');
    ke.push({}); t(/아직 공지가 없어요/.test(ke.doc.els.chatNotices.innerHTML), '  다시 받으면 정상(빈 목록은 «아직 공지가 없어요»)');
    /* 5절 일부 — net */
    if (extra) {
      const N = loadWin(extra.net, {}).TwChatNoticeNet;
      const store = { v: {} }, log = [], cancels = [];
      const db = {}, ref = (d, p) => ({ p: p === undefined ? '' : p });
      const rt = async (r, fn) => { const next = fn(store.v[r.p] ? JSON.parse(JSON.stringify(store.v[r.p])) : null); if (next === undefined) return { committed: false }; store.v[r.p] = next; return { committed: true }; };
      const net = N.createChatNoticeNet({ db, ref, runTransaction: rt, now: () => 777,
        update: async (_, w) => { log.push(['update', w]); }, remove: async (r) => { log.push(['remove', r.p]); }, set: async (r, v) => { log.push(['set', r.p, v]); },
        onValue: (r, f, c) => { log.push(['on', r.p]); f({ val: () => null }); if(c) cancels.push(c); }, off: (r, e) => { log.push(['off', r.p, e]); } });
      const a1 = await net.add('SCRT-AB12', '가'), a2 = await net.add('SCRT-AB12', '나');
      t(a1.ok && a1.id === 'n1' && a2.id === 'n2' && store.v['rooms/SCRT-AB12/_notice'].n1.ts === 777, '서버 — 빈 자리(작은 번호부터)에 { text, ts } 로 쓴다');
      for (let i = 3; i <= 20; i++) await net.add('SCRT-AB12', 'x' + i);
      const fl = await net.add('SCRT-AB12', '스물하나');
      t(fl.ok === false && fl.reason === '공지는 20개까지예요' && !store.v['rooms/SCRT-AB12/_notice'].n21, '  20개가 차면 안 쓰고 사람이 읽는 말');
      t((await net.add('', 'x')).ok === false && (await net.edit('', 'n1', 'x')).ok === false && (await net.remove('SCRT-AB12', '')).ok === false, '  방 코드 · 공지 id 가 없으면 아무것도 안 한다');
      log.length = 0;
      await net.pin('SCRT-AB12', 'n2', true, ['n1', 'n2', 'n5']);
      t(JSON.stringify(log[0][1]) === JSON.stringify({ 'rooms/SCRT-AB12/_notice/n1/pin': null, 'rooms/SCRT-AB12/_notice/n5/pin': null, 'rooms/SCRT-AB12/_notice/n2/pin': true }), '  고정 — 다른 pin 을 지우고 하나만 서는 한 묶음');
      await net.pin('SCRT-AB12', 'n2', false, []);
      t(log[1][1]['rooms/SCRT-AB12/_notice/n2/pin'] === null, '  풀기 — pin 을 지운다(false 를 쓰지 않는다)');
      await net.edit('SCRT-AB12', 'n3', '고침'); await net.remove('SCRT-AB12', 'n4');
      t(log[2][1] === 'rooms/SCRT-AB12/_notice/n3/text' && log[2][2] === '고침' && log[3][1] === 'rooms/SCRT-AB12/_notice/n4', '  고치기는 text 만 · 지우기는 그 칸만');
      log.length = 0; const off = net.subscribe('SCRT-AB12', () => {}); off();
      t(log[0][0] === 'on' && log[0][1] === 'rooms/SCRT-AB12/_notice' && log.some((x) => x[0] === 'off' && x[2] === 'value'), '  구독은 공지 노드 하나 · 해제하면 off');
      { const got = []; log.length = 0; cancels.length = 0; net.subscribe('SCRT-AB12', (x) => got.push(x)); cancels[0] && cancels[0](); t(JSON.stringify(got) === '[{},null]', '  읽기 권한 거절(cancel)은 null 로 알린다(빈 {} 와 구분)'); }
      const bad = N.createChatNoticeNet({ db, ref, runTransaction: async () => { throw new Error('net'); }, update: async () => { throw new Error('x'); }, remove: async () => { throw new Error('x'); }, set: async () => { throw new Error('x'); }, onValue(){}, off(){} });
      t((await bad.add('SCRT-AB12', 'x')).ok === false && (await bad.pin('SCRT-AB12', 'n1', true, [])).ok === false && !('reason' in (await bad.add('SCRT-AB12', 'x'))) || (await bad.add('SCRT-AB12', 'x')).reason === undefined, '  서버 오류는 던지지 않고 { ok:false } — 기술 문구는 안 싣는다');
    }
  } catch (err) {
    t(false, '돌리다 오류 — ' + (err && err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : err));
  }
  return r;
}

function wire(S){
  const out = [];
  const w = (ok, msg) => out.push([!!ok, msg]);
  const R = JSON.parse(S.rules).rules.rooms.$room._notice;
  w(!!R && R['.write'] === true && !!R.$nid, '규칙 — rooms/$room/_notice 가 있다(_ 로 시작 — 방 인원으로 안 센다)');
  const V = (R.$nid || {})['.validate'] || '';
  w(/\$room\.matches\(\/\^SCRT-\/\)/.test(V) && /n\(\[1-9\]\|1\[0-9\]\|20\)/.test(V) && /length >= 1/.test(V) && /length <= 300/.test(V) && /pin'\)\.val\(\) === true/.test(V) && R.$nid.$other['.validate'] === false && Object.keys(R.$nid).filter((x) => x[0] !== '.').sort().join() === '$other,pin,text,ts', '  시크릿룸 코드만 · n1~n20 만 · 글 1~300자 · pin 은 true 만 · 모르는 칸 거절');
  /* 규칙식을 실제로 굴린다 — 앱이 보내는 모양(트랜잭션 노드 통째 · text 만 · pin true · 칸 하나)을 넣어 통과 · 거절을 본다 */
  const snap = (val) => ({
    exists: () => val !== null && val !== undefined, val: () => val,
    isNumber: () => typeof val === 'number', isString: () => typeof val === 'string',
    hasChildren: (ks) => ks.every((k) => val && val[k] !== undefined),
    child: (k) => snap(val && val[k] !== undefined ? val[k] : null),
  });
  const judge = (room, nid, val) => {
    const expr = String(V).replace(/\$(room|nid)\.matches\((\/(?:\\.|[^\/])+\/)\)/g, '$2.test($$$1)');
    return new Function('$room', '$nid', 'newData', 'return (' + expr + ');')(room, nid, snap(val));
  };
  const ok1 = (room, nid, val) => { try { return judge(room, nid, val) === true; } catch (e) { return false; } };
  const T = 1700000000000, SR = 'SCRT-AB12', long = (n) => 'ㄱ'.repeat(n);
  w(ok1(SR, 'n1', { text: '공지', ts: T }) && ok1(SR, 'n20', { text: '공지', ts: T, pin: true }) && ok1(SR, 'n7', { text: long(300), ts: T }), '규칙 실행 — 통과: 새 공지(트랜잭션) · 고정된 칸 · n20 · 300자');
  w(!ok1('WORK-AB12', 'n1', { text: '공지', ts: T }) && !ok1('ROOM-AB12', 'n1', { text: '공지', ts: T }), '  거절: 시크릿룸이 아닌 방');
  w(!ok1(SR, 'n21', { text: '공지', ts: T }) && !ok1(SR, 'n0', { text: '공지', ts: T }) && !ok1(SR, 'x1', { text: '공지', ts: T }), '  거절: n1~n20 밖의 칸 이름');
  w(!ok1(SR, 'n1', { text: long(301), ts: T }) && !ok1(SR, 'n1', { text: '', ts: T }) && !ok1(SR, 'n1', { text: 5, ts: T }) && !ok1(SR, 'n1', { ts: T }) && !ok1(SR, 'n1', { text: '공지' }) && !ok1(SR, 'n1', { text: '공지', ts: '1' }), '  거절: 301자 · 빈 글 · 글자 아님 · text 없음 · ts 없음 · ts 숫자 아님');
  w(!ok1(SR, 'n1', { text: '공지', ts: T, pin: false }) && !ok1(SR, 'n1', { text: '공지', ts: T, pin: 1 }), '  거절: pin 이 true 가 아닌 값(풀 때는 칸을 지운다)');
  w(!/import[^\n]*chat-notice-net/.test(S.fi) && /window\.TwChatNoticeNet\.createChatNoticeNet\(\{ db, ref, update, remove, set, onValue, off, runTransaction \}\)/.test(S.fi), 'firebase-init.js — 연결 한 줄만(전역 TwChatNoticeNet · 데이터 통로의 set · remove · onValue 를 그대로 넘김)');
  const H = S.html;
  const iNet = H.indexOf('<script src="parts/chat/chat-notice-net.js"'), iMod = H.indexOf('<script src="parts/chat/chat-notice.js"'), iUi = H.indexOf('<script src="parts/chat/chat-ui.js"'), iApp = H.indexOf('<script src="parts/app.js"'), iFi = H.indexOf('<script type="module" src="parts/firebase-init.js"');
  w(iNet > 0 && iMod > 0 && iMod < iUi && iUi < iApp && iFi > 0, 'html — 공지 모듈이 chat-ui · app.js 보다 먼저 실린다(서버 연결은 type=module 이라 늦게 돈다)');
  w(/id="chatPin"/.test(H) && /id="chatNotices"/.test(H) && H.indexOf('id="chatTabs"') < H.indexOf('id="chatPin"') && H.indexOf('id="chatPin"') < H.indexOf('id="chatMemberLabel"') && H.indexOf('id="chatMessages"') < H.indexOf('id="chatNotices"'), '  고정 줄은 탭 줄 아래 · #공지 본문은 대화 칸 옆(창의 직계)');
  w(/#chatWindow\.notice-mode \.chat-messages,[\s\S]*?\.chat-memberbar,[\s\S]*?\.chat-toolbar,[\s\S]*?\.chat-flyrow,[\s\S]*?\.chat-pin\{display:none !important;\}/.test(H) && /\.chat-pin:hover \.cp-text\.long\{[^}]*animation:cp-flow/.test(H), '  #공지 탭에서는 대화 · 인원 줄 · 도구 줄을 숨긴다 · 긴 고정 글은 올리면 흐른다');
  const A = S.app;
  w(/const chatNoticeMod = TwChatNotice\.createChatNotice\(\{[\s\S]*?roomState: TwRoomState[\s\S]*?firebaseAPI\.chatNotice\.pin\(\.\.\.a\)[^\n]*\n\}\);\nconst chatUiMod = TwChatUi\.createChatUi\(\{\n  demojiCatalog: demojiCatalog,\n  chatNotice: chatNoticeMod,/.test(A), 'app.js — 공지 모듈을 채팅 모듈보다 먼저 만들어 값으로 넘긴다(데이터는 firebaseAPI.chatNotice 한 곳)');
  const C = S.chatui;
  w(/chatNotice\.onChange\(\(\) => \{ _chatTabsRender\(\); _chatOffRefreshUI\(\); \}\)/.test(C) && /if\(chatNotice\.submit\(inp\)\) return;/.test(C) && /chatNotice\.start\(\);/.test(C) && /chatNotice\.stop\(\);/.test(C) && /if\(t\.dataset\.tab === 'notice'\)\{ chatNotice\.open\(\); return; \}/.test(C), '채팅 모듈 — 알림 걸기 · Enter 가 공지면 채팅 전송 건너뜀 · 창 열 때 구독 · 닫을 때 해제 · 탭 누르기');
  w(/if\(chatNotice\.isActive\(\)\) chatNotice\.close\(\);\s*\/\/ 다른 탭을 누르면 공지 보기에서 나온다/.test(C) && /_chatTabMenu\(id\)\{[\s\S]*?if\(id === 'notice'\) return;/.test(C), '  다른 탭을 누르면 공지 보기에서 나온다 · #공지 는 우클릭 메뉴가 없다');
  w(/chatUiMod\._chatNoticeHint\(\) \|\| \(off \?/.test(S.lock), '채팅 잠금 — #공지 탭이면 입력칸 안내문을 공지 쓰기로');
  w(!/chat-ui|chat-lock|Presence|firebaseAPI/.test(S.mod.replace(/\/\*[\s\S]*?\*\//g, '')), '공지 모듈은 채팅 · 잠금 모듈 · Presence · firebaseAPI 를 직접 부르지 않는다(한쪽으로만 — 순환 방지 · provider 로만)');
  w(/'E-CHAT-01': \{ msg: '[^']+', where: 'chat\/chat-notice\.js/.test(S.codes), '에러 번호 E-CHAT-01 이 표에 있다');

  return out;
}

(async () => {
  say('── 1 ~ 4. 규칙 · 화면 조각 · 컨트롤러 · 서버 읽기 쓰기 (진짜 모듈을 돌린다)');
  (await judge(SRC.mod, SRC)).forEach(([ok, m]) => chk(ok, m));

  say('── 5. 연결');
  wire(SRC).forEach(([ok, m]) => chk(ok, m));

  say('── 6. 일부러 깨 보기');
  const BREAKS = [
    ['mod', "const p = (available() && !active) ? pinnedOf(items) : null;", "const p = pinnedOf(items);", '#공지 탭에서도 고정 줄이 겹쳐 보임'],
    ['mod', "if(!isHost()){ toast('방장만 공지를 쓸 수 있어요'); return true; }", '', '참여자도 공지를 쓸 수 있음'],
    ['mod', "const t = String(raw == null ? '' : raw).replace(/\\s+/g, ' ').trim();", "const t = String(raw == null ? '' : raw).trim();", '줄바꿈 · 연속 공백을 안 정리'],
    ['mod', "if(t.length > TEXT_MAX) return", "if(t.length > TEXT_MAX + 1) return", '300자 경계가 하나 넘어감'],
    ['mod', "return out.sort((a, b) => (b.pin - a.pin) || (b.ts - a.ts) || (a.id < b.id ? -1 : 1));", "return out.sort((a, b) => (b.ts - a.ts) || (a.id < b.id ? -1 : 1));", '고정한 공지가 맨 위로 안 감'],
    ['mod', "return (items || []).filter(x => x.pin && x.id !== id).map(x => x.id);", "return [];", '새로 고정해도 옛 고정을 안 풂(둘 이상 고정)'],
    ['mod', "'<div class=\"cn-text\">' + (it.pin ? '<span class=\"cn-pinmark\">📌</span> ' : '') + escHtml(it.text) + '</div>'", "'<div class=\"cn-text\">' + (it.pin ? '<span class=\"cn-pinmark\">📌</span> ' : '') + it.text + '</div>'", '공지 글을 escape 없이 화면에 넣음'],
    ['mod', "    else if(name === 'del') askDelete(id);\n", "    else if(name === 'del') doDelete(id);\n", '지우기가 묻지 않고 바로 지움'],
    ['mod', "    inp.value = '';\n    provider.add(", "    provider.add(", '올린 뒤에도 입력칸이 안 비워짐'],
    ['mod', "if(!(r && r.ok)){ inp.value = raw; failed(r); }", "if(!(r && r.ok)){ failed(r); }", '못 올렸는데 친 글을 안 돌려줌'],
    ['mod', "loadFailed = true; unsub = null; paint();", "items = list(raw); paint();", '읽기 실패를 «공지 없음» 으로 그림'],
    ['mod', "loadFailed = true; unsub = null; paint();", "loadFailed = true; paint();", '끊긴 구독을 다시 걸지 않음'],
    ['net', "onValue(r, snap => cb(snap.val() || {}), () => cb(null));", "onValue(r, snap => cb(snap.val() || {}));", '읽기 거절을 알리지 않음'],
    ['net', "id = NOTICE_SLOTS.find(k => !t[k]) || null;", "id = NOTICE_SLOTS.find(k => !t[k]) || 'n1';", '꽉 차도 첫 자리를 덮어씀'],
    ['net', "(clearIds || []).forEach(k => { if(k !== id) w[path(room, k) + '/pin'] = null; });", '', '고정이 다른 pin 을 안 지움'],
    ['net', "w[path(room, id) + '/pin'] = on ? true : null;", "w[path(room, id) + '/pin'] = on;", '풀 때 pin:false 를 씀(규칙은 true 만 받는다)'],
  ].filter((b) => b[3]);
  for (const [k, from, to, why] of BREAKS) {
    if (SRC[k].indexOf(from) < 0) { chk(false, '깨 볼 글을 못 찾음 — ' + why); continue; }
    const s2 = Object.assign({}, SRC, { [k]: SRC[k].replace(from, to) });
    let rows;
    try { rows = await judge(s2.mod, s2); } catch (e) { rows = [[false, String(e)]]; }
    chk(rows.some(([ok]) => !ok), why + ' → 빨강');
  }
  const WB = [
    ['rules', '"pin": { ".validate": true },', '"pin": { ".validate": true },\n            "extra": { ".validate": true },', '규칙이 모르는 칸을 받음(공지 칸)'],
    ['rules', '$room.matches(/^SCRT-/) && ', '', '규칙이 시크릿룸이 아닌 방에도 공지를 받음'],
    ['html', '<div class="chat-pin" id="chatPin"></div>', '', '고정 줄 자리가 없음'],
    ['chatui', 'if(chatNotice.submit(inp)) return;', '', 'Enter 가 공지를 채팅으로 보냄'],
    ['app', '  chatNotice: chatNoticeMod,\n', '', '채팅 모듈이 공지 모듈을 못 받음'],
    ['lock', "chatUiMod._chatNoticeHint() || (off ?", "(off ?", '#공지 탭에서 입력칸 안내문이 채팅 문구'],
    ['mod', "const isHost = () =>", "const isHost = () => true; const _unused = () =>", '공지 모듈이 방장 판정을 건너뜀(연결 판정)'],
  ];
  for (const [k, from, to, why] of WB) {
    if (k === 'rules' && SRC.rules.indexOf(from) < 0) { chk(false, '깨 볼 글을 못 찾음 — ' + why); continue; }
    if (SRC[k].indexOf(from) < 0) { chk(false, '깨 볼 글을 못 찾음 — ' + why); continue; }
    const s2 = Object.assign({}, SRC, { [k]: SRC[k].replace(from, to) });
    let rows;
    try { rows = k === 'mod' ? await judge(s2.mod, s2) : wire(s2); } catch (e) { rows = [[false, String(e)]]; }
    chk(rows.some(([ok]) => !ok), why + ' → 빨강');
  }
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
