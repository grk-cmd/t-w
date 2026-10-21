/*
 * 방 목록 로비 검사 — 모듈을 그대로 불러 돌린다(가짜 DOM · 가짜 provider).
 * 1. room-lobby-model.js(카드 · 상태 · 정렬 · 거르기 · 번호 · 쪽 · 빠른시작)  2. room-lobby-provider.js(목록 · 내 시크릿룸 소유 확인 · 세션 기억 · 손님 수)
 * 3. room-lobby-ui.js(열기 · 그리기 · 위 띠 · 못 불러옴 · 탭 · 빠른시작 · 들어가기 · 만들기 · 시크릿룸 줄 · 글로만 그림 · 방 안 · 60초 갱신)  4. 배선(html · app.js · firebase-init)  5. 깨 보기
 * 설계: docs/ROOM_LOBBY.md 1 · 2.2 · 3
 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const need = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } };
const RS_SRC = need('room-settings.js'), M_SRC = need('room-lobby-model.js'), P_SRC = need('room-lobby-provider.js'), U_SRC = need('room-lobby-ui.js');
const HTML = need('desk-companion-prototype.html'), APP = need('app.js'), FI = need('firebase-init.js'), EC = need('error-codes.js');
const classic = (src, name, extra) => { const w = Object.assign({}, extra || {}); new Function('window', src)(w); return w[name]; };
const RS = classic(RS_SRC, 'TwRoomSettings');
const model = (src) => classic(src, 'TwRoomLobbyModel', { TwRoomSettings: RS });
const M = model(M_SRC);
const P = classic(P_SRC, 'TwRoomLobbyProvider');

/* 가짜 DOM — 이 화면이 쓰는 만큼만(getElementById · createElement · 글 · 자식 · 클래스 · 속성) */
function mkDom(){
  const byId = {};
  const node = (tag, id) => {
    const n = { tag, id, children: [], parentNode: null, hidden: false, disabled: false, title: '', type: '', className: '', style: { v: {}, setProperty(k, v){ this.v[k] = v; } },
      listeners: {}, clientWidth: 100, _text: '',
      get scrollWidth(){ return this._text.length * 10; },
      get textContent(){ return this._text + this.children.map((c) => c.textContent).join(''); },
      set textContent(v){ this._text = String(v); this.children = []; },
      get innerHTML(){ throw new Error('innerHTML 을 쓰면 안 된다'); },
      set innerHTML(v){ throw new Error('innerHTML 을 쓰면 안 된다'); },
      appendChild(c){ c.parentNode = this; this.children.push(c); return c; },
      addEventListener(t, f){ this.listeners[t] = f; },
      querySelectorAll(sel){ const cls = sel.replace(/^\./, ''); const out = []; (function walk(x){ for(const c of x.children){ if((' ' + c.className + ' ').includes(' ' + cls + ' ')) out.push(c); walk(c); } })(this); return out; },
    };
    n.classList = { toggle(c, on){ const s = new Set(n.className.split(' ').filter(Boolean)); (on === undefined ? !s.has(c) : on) ? s.add(c) : s.delete(c); n.className = [...s].join(' '); }, contains(c){ return n.className.split(' ').includes(c); } };
    return n;
  };
  const doc = { getElementById: (id) => byId[id] || (byId[id] = node('div', id)), createElement: (t) => node(t) };
  doc.getElementById('inviteOverlay').className = 'on';
  return { doc, byId };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

(async () => {
  say('── 1. room-lobby-model.js');
  const now = 1e12;
  const node = { at: now - 30000, rooms: {
    'WORK-AA11': { t: '마감방', n: 3, max: 4, hn: '도토리', since: 5 },
    'WORK-BB22': { t: '', n: 10, max: 10, hn: '말랑', since: 1 },          // 가득
    'WORK-CC33': { t: '조용히', n: 7, hn: '', since: 9 },                  // max 없음 → 정원
    'WORK-DD44': { t: '같이듣기', n: 3, max: 8, hn: '디제이', mu: true, since: 2 },
    'WORK-EE55': { t: '유령', n: 0, max: 4 },                               // 0명 — 빼기
    'WORK-FF66': { t: '큰방', n: 6, max: 40, since: 3 },                    // 정원보다 큰 max → 정원
  } };
  let r = M.cardsFrom(node, { now, cap: 10, onlyOpen: false });
  chk(r.state === 'ok' && r.total === 5 && r.open === 4, '사본 → 카드 5장(0명 방 뺌) · 빈자리 4');
  chk(r.list.map((c) => c.code).join() === 'WORK-CC33,WORK-FF66,WORK-DD44,WORK-AA11,WORK-BB22', '★ 정렬: 입장 가능 먼저 → 인원 많은 순 → 오래 열린 순(같은 인원이면 since 작은 쪽)');
  chk(r.list.map((c) => c.no).join() === '001,002,003,004,005', '  방 번호는 이 순서의 번호');
  const by = Object.fromEntries(r.list.map((c) => [c.code, c]));
  chk(by['WORK-CC33'].max === 10 && by['WORK-FF66'].max === 10 && by['WORK-AA11'].max === 4, '  최대 인원: 없거나 정원보다 크면 정원(입장 검사 roomCap 과 같은 뜻)');
  chk(by['WORK-BB22'].full && by['WORK-BB22'].title === '말랑 님의 방' && by['WORK-BB22'].titleIsDefault, '  가득 참 · 빈 제목은 «닉네임 님의 방»');
  chk(by['WORK-CC33'].hostLabel === '현재 방장' && by['WORK-DD44'].hostLabel === '현재 DJ' && by['WORK-DD44'].music, '  같이 듣기 방은 «현재 DJ»');
  chk(M.cardOf('X', { n: 1 }, 10).title === '이름 없는 방', '  제목 · 닉네임 둘 다 없으면 «이름 없는 방»');
  r = M.cardsFrom(node, { now, cap: 10, onlyOpen: true });
  chk(r.list.length === 4 && !r.list.some((c) => c.full) && r.list[3].no === '004', '빈자리 있는 방만 — 번호도 거른 목록 기준');
  chk(M.cardsFrom(null, { now, cap: 10 }).state === 'failed', '★ 못 읽음(null) → failed — 빈 목록과 다르다');
  chk(M.cardsFrom({ at: null, rooms: {} }, { now, cap: 10 }).state === 'missing', '  칸이 없음(서버 함수가 안 돎) → missing');
  chk(M.cardsFrom({ at: now - M.STALE_MS - 1, rooms: node.rooms }, { now, cap: 10 }).state === 'stale' && M.cardsFrom({ at: now - M.STALE_MS, rooms: {} }, { now, cap: 10 }).state === 'ok', '  3분 넘게 그대로면 stale(경계 3분은 ok)');
  const e = M.cardsFrom({ at: now, rooms: {} }, { now, cap: 10 });
  chk(e.state === 'ok' && e.list.length === 0, '  방이 없는 채널(at 만) → 빈 목록 ok');
  const many = Array.from({ length: 25 }, (_, i) => ({ code: 'C' + i }));
  chk(M.pageOf(many, 0).items.length === 12 && M.pageOf(many, 2).items.length === 1 && M.pageOf(many, 2).pages === 3, '쪽: 12장씩');
  chk(M.pageOf(many, 9).page === 2 && M.pageOf(many, -1).page === 0 && M.pageOf([], 0).pages === 1, '  범위 밖 쪽은 끝으로 · 빈 목록은 1/1');
  const list = M.cardsFrom(node, { now, cap: 10 }).list;
  chk(M.pickQuick(list, 0) === 'WORK-CC33' && M.pickQuick(list, 0.999) === 'WORK-AA11', '빠른시작: 빈자리 있는 방 중에서만');
  chk(M.pickQuick(list.filter((c) => c.full), 0.5) === null && M.pickQuick([], 0) === null, '  빈자리 없으면 null');

  say('── 2. room-lobby-provider.js');
  {
    const mkApi = (o) => ({
      getRoomLobby: async (ch) => ((o.lobby && o.lobby[ch]) || null),
      getMySecretRoom: async () => o.code || null,
      getSecretRoomPub: async (c) => { o.pubAsked = c; return o.pub || null; },
      checkSecretRoomEntry: async () => { o.entryAsked = (o.entryAsked || 0) + 1; return o.entry === undefined ? { count: 2, ownerIn: false } : o.entry; },
    });
    const mk = (o, uid) => P.createRoomLobbyProvider({ api: () => mkApi(o), myUserId: () => (uid === undefined ? 'u1' : uid), now: () => now });
    let o = { lobby: { workingroom: { at: 1, rooms: {} } } };
    chk((await mk(o).listRooms('workingroom')).at === 1 && (await mk(o).listRooms('togetherroom')) === null, 'listRooms 는 채널 사본을 그대로(못 읽음 null 그대로)');
    o = { code: 'ABCD', pub: { owner: 'u1', name: '우리 방' } };
    const s1 = await mk(o).mySecretRoom();
    chk(s1 && s1.code === 'SCRT-ABCD' && s1.name === '우리 방' && s1.guests === 2 && o.pubAsked === 'SCRT-ABCD', '★ 내 시크릿룸: 발급 칸 코드(접두어 없어도) → SCRT- · 이름 · 손님 수');
    chk((await mk({ code: 'SCRT-ABCD', pub: { owner: 'u1' } }).mySecretRoom()).name === '내 시크릿룸', '  이름이 없으면 «내 시크릿룸»');
    chk(await mk({ code: 'ABCD', pub: { owner: 'u2' } }).mySecretRoom() === null, '★ 그새 남에게 재발급된 코드(owner 가 남)는 안 보인다');
    chk(await mk({ code: 'ABCD', pub: { owner: 'u1', exp: now } }).mySecretRoom() === null, '  만료된 방은 안 보인다');
    chk(await mk({ code: null }).mySecretRoom() === null && await mk({ code: 'ABCD', pub: null }).mySecretRoom() === null, '  발급 없음 · pub 없음 → null');
    chk(await mk({ code: 'ABCD' }, null).mySecretRoom() === null, '  내 코드를 모르면 읽지 않는다');
    chk((await mk({ code: 'ABCD', pub: { owner: 'u1' }, entry: null }).mySecretRoom()).guests === null, '  인원을 못 읽으면 guests null');
    chk((await mk({ code: 'ABCD', pub: { owner: 'u1' }, entry: { count: 3, ownerIn: true } }).mySecretRoom()).guests === 2, '★ 손님 수는 방장(나)을 뺀다 — 방장 도장이 남아 있어도(입장 검사와 같은 셈)');
    {
      let pubReads = 0, uid = 'u1';
      const oo = { code: 'ABCD', pub: { owner: 'u1' } };
      const api = Object.assign(mkApi(oo), { getSecretRoomPub: async () => { pubReads++; return oo.pub; } });
      const pv = P.createRoomLobbyProvider({ api: () => api, myUserId: () => uid, now: () => now });
      await pv.mySecretRoom(); await pv.mySecretRoom();
      chk(pubReads === 1 && oo.entryAsked === 2, '★ «누구 것인가» 는 세션에 한 번만 읽는다 · 손님 수는 열 때마다');
      uid = 'u2'; oo.pub = { owner: 'u2' };
      chk((await pv.mySecretRoom()) && pubReads === 2, '  계정이 바뀌면 다시 읽는다');
      let fails = 1;
      const api2 = Object.assign(mkApi(oo), { getMySecretRoom: async () => { if(fails-- > 0) throw new Error('net'); return 'ABCD'; } });
      const pv2 = P.createRoomLobbyProvider({ api: () => api2, myUserId: () => 'u2', now: () => now });
      let threw = false; try{ await pv2.mySecretRoom(); }catch(_){ threw = true; }
      chk(threw && (await pv2.mySecretRoom()) !== null, '  못 읽었으면 기억하지 않고 다음에 다시 읽는다');
    }
  }

  say('── 3. room-lobby-ui.js — 가짜 DOM');
  async function mkUi(o){
    o = o || {};
    const { doc, byId } = mkDom();
    global.document = doc;
    const log = { joins: [], creates: [], toasts: [], errors: [], lists: [] };
    const timers = new Map(); let tid = 0;
    global.setInterval = (f) => { timers.set(++tid, f); return tid; };
    global.clearInterval = (id) => { timers.delete(id); };
    const U = classic(U_SRC, 'TwRoomLobbyUi');
    U.createRoomLobbyUi({
      model: M,
      provider: { listRooms: async (ch) => { log.lists.push(ch); return typeof o.list === 'function' ? o.list(ch) : (o.list === undefined ? node : o.list); },
        mySecretRoom: async () => o.secret || null },
      inRoom: () => !!o.inRoom, maxPeople: () => 10, isLicensed: () => !!o.licensed,
      joinRoom: async (c) => { log.joins.push(c); await tick(); },
      openCreate: (ch) => log.creates.push(ch), toast: (m) => log.toasts.push(m), notifyError: (c) => log.errors.push(c),
      now: () => now, random: () => 0,
    });
    const $ = (id) => byId[id];
    const fire = async () => { for(const f of [...timers.values()]) f(); await tick(); await tick(); };
    return { $, log, U, o, timers, fire, open: async () => { $('lcInvite').listeners.click(); await tick(); await tick(); } };
  }
  let t = await mkUi({ secret: { code: 'SCRT-ABCD', name: '<b>우리</b>', guests: 2 } });
  await t.open();
  const cards = t.$('lobbyGrid').children;
  chk(cards.length === 5 && cards[0].className === 'lb-card' && t.log.lists.join() === 'workingroom', '모달을 열면 워킹룸 목록을 읽어 카드 5장');
  chk(t.$('lobbyInfo').textContent === '워킹룸 공개 방 5개 · 빈자리 있는 방 4개' && t.$('lobbyPage').textContent === '1 / 1', '  위 줄 · 쪽 표시');
  chk(cards[4].disabled && cards[4].className.includes('full') && cards[4].textContent.includes('가득 참'), '  가득 찬 방은 눌리지 않는다');
  chk(cards[0].children[0].className === 'lb-band' && cards[0].children[0].textContent === '입장 가능' && cards[4].children[0].textContent === '가득 참'
    && cards.every((c) => (c.textContent.match(/입장 가능|가득 참/g) || []).length === 1), '★ 카드 위 띠에 «입장 가능» · «가득 참» — 한 카드에 한 번만');
  chk(!t.$('lobbySecret').hidden && t.$('lobbySecretName').textContent === '<b>우리</b>' && t.$('lobbySecretCount').textContent === '손님 2/9', '★ 내 시크릿룸 줄 — 이름은 글로만(HTML 로 안 읽힘) · 손님 수/손님 정원');
  cards[0].onclick(); cards[0].onclick();
  await tick(); await tick();
  chk(t.log.joins.join() === 'WORK-CC33', '★ 카드를 누르면 그 방으로 — 연달아 눌러도 한 번');
  t.$('lobbySecretJoin').onclick();
  await tick();
  chk(t.log.joins[1] === 'SCRT-ABCD', '  «바로 들어가기» 는 내 시크릿룸으로');
  t.$('lobbyQuick').onclick();
  await tick();
  chk(t.log.joins[2] === 'WORK-CC33', '  빠른시작은 빈자리 있는 방으로');
  t.$('lobbyOpen').onclick();
  chk(t.$('lobbyGrid').children.length === 4 && t.$('lobbyOpen').classList.contains('on'), '«빈자리 있는 방» 거르기');
  t.$('lobbyCreate').onclick();
  chk(t.log.creates.join() === 'workingroom', '[방 만들기] 는 지금 탭 채널로 방 만들기 창');
  t.$('lobbyTabTogether').onclick();
  await tick(); await tick();
  t.$('lobbyCreate').onclick();
  chk(t.log.lists.join() === 'workingroom,togetherroom' && t.log.creates.length === 1 && /라이선스/.test(t.log.toasts.pop()), '★ 투게더룸 탭 — 다시 읽고 · 보유자가 아니면 만들기 대신 안내');

  t = await mkUi({ list: null });
  await t.open();
  chk(t.$('lobbyGrid').children[0].textContent.includes('못 불러왔어요') && t.log.errors.join() === 'E-ROOM-03', '★ 못 읽으면 «못 불러왔어요» + 오류 번호 E-ROOM-03(빈 목록과 다르게)');
  t.$('lobbyGrid').children[0].children[1].onclick();
  await tick(); await tick();
  chk(t.log.lists.length === 2 && t.log.errors.length === 2, '  «다시 불러오기» 로 다시 읽는다');
  t.$('lobbyQuick').onclick();
  chk(t.log.joins.length === 0 && /못 불러왔어요/.test(t.log.toasts.pop() || ''), '  못 불러온 채로 빠른시작 → «못 불러왔어요»(«방이 없어요» 와 다르게)');
  await t.fire();
  chk(t.log.lists.length === 3 && t.log.errors.length === 2, '★ 60초 갱신 — 다시 읽되 실패를 알리지 않는다(quiet)');
  t.$('lobbyMain').hidden = true; await t.fire();
  chk(t.log.lists.length === 3 && t.timers.size === 1, '  만들기 창이 로비를 덮었으면 이번 차례만 건너뛴다');
  t.$('lobbyMain').hidden = false; t.o.inRoom = true; await t.fire();
  chk(t.log.lists.length === 3 && t.timers.size === 1, '  방 안이면(로비가 안 보임) 읽지 않는다');
  t.$('inviteOverlay').className = ''; await t.fire();
  chk(t.log.lists.length === 3 && t.timers.size === 0, '★ 모달이 닫혔으면(바깥 클릭 · ESC · 입장도) 타이머가 스스로 멈춘다');
  t = await mkUi({ inRoom: true, secret: { code: 'SCRT-ABCD', name: 'x', guests: 0 } });
  await t.open();
  chk(t.log.lists.length === 0 && t.timers.size === 0 && !t.$('lobbySecretName'), '★ 방 안에서 모달을 열면 목록 · 시크릿룸을 읽지 않는다');
  t.$('inviteOverlay').className = 'on';
  t.o.inRoom = false; await t.open();
  t.$('inviteClose').listeners.click();
  chk(t.log.lists.length === 1 && t.timers.size === 0, '  닫기 버튼은 타이머를 멈춘다');
  t = await mkUi({ list: { at: null, rooms: {} } });
  await t.open();
  chk(t.$('lobbyGrid').children[0].textContent.includes('준비되지 않았어요') && t.log.errors.length === 0, '  칸이 없음(서버 함수 전) — 안내만 · 오류 번호 없음');
  t = await mkUi({ list: { at: now, rooms: {} } });
  await t.open();
  chk(t.$('lobbyGrid').children[0].textContent.includes('공개된 방이 없어요'), '  빈 목록 → «공개된 방이 없어요»');
  t.$('lobbyQuick').onclick();
  chk(t.log.joins.length === 0 && /들어갈 수 있는 공개 방이 없어요/.test(t.log.toasts[0] || ''), '  빠른시작할 방이 없으면 안내');
  chk(t.$('lobbySecret').hidden, '  내 시크릿룸이 없으면 줄이 숨는다');
  t = await mkUi({ list: { at: now - M.STALE_MS - 5000, rooms: node.rooms } });
  await t.open();
  chk(t.$('lobbyNote').textContent.includes('늦게') && t.$('lobbyGrid').children.length === 5, '  낡은 사본은 카드를 보이고 «늦게 갱신» 표시');

  // 탭을 빨리 바꾸면 늦게 온 답은 버린다
  let release;
  t = await mkUi({ list: (ch) => ch === 'workingroom' ? new Promise((r) => { release = () => r(node); }) : { at: now, rooms: {} } });
  t.$('lcInvite').listeners.click();
  t.$('lobbyTabTogether').onclick();
  await tick(); await tick();
  release(); await tick(); await tick();
  chk(t.$('lobbyGrid').children[0].textContent.includes('공개된 방이 없어요'), '★ 탭을 바꾼 뒤 늦게 온 워킹룸 답은 버린다(투게더룸 화면 그대로)');

  // 긴 제목 — 넘치면 long · 흐를 거리
  t = await mkUi({ list: { at: now, rooms: { 'WORK-AA11': { t: '아주아주아주아주긴제목입니다요', n: 1, max: 4 }, 'WORK-BB22': { t: '짧음', n: 1, max: 4 } } } });
  await t.open();
  const titles = t.$('lobbyGrid').querySelectorAll('lb-title');
  chk(titles.length === 2 && titles[0].classList.contains('long') && /^-\d+px$/.test(titles[0].style.v['--lb-d'] || '') && !titles[1].classList.contains('long'), '★ 긴 제목만 long(마우스를 올리면 흐름) · 흐를 거리를 잰다');
  delete global.document;

  say('── 4. 배선');
  chk(/<div id="lobbyMain">/.test(HTML) && !/id="chCardWorking"/.test(HTML) && !/id="inviteChannelPick"/.test(HTML), 'html: 채널 카드 대신 로비(#lobbyMain)');
  const order = ['room/room-lobby-model.js', 'room/room-lobby-provider.js', 'room/room-lobby-ui.js', 'app.js'].map((f) => HTML.indexOf('<script src="parts/' + f + '"'));
  chk(order.every((v, i) => v > 0 && (i === 0 || v > order[i - 1])), '  스크립트 순서: model → provider → ui → app.js');
  chk(/TwRoomLobbyUi\.createRoomLobbyUi\(\{/.test(APP) && /openCreate: \(ch\)=>roomCreateUi\.open\(ch\)/.test(APP) && /joinRoom: \(code\)=>roomEntryMod\.startRoom\(code\)/.test(APP), '  app.js 가 만들고 방 만들기 창 · 입장으로 잇는다');
  chk(/async getRoomLobby\(channel\)\{\s*try\{ const v = \(await get\(ref\(db, `roomLobby\/\$\{channel\}`\)\)\)\.val\(\);/.test(FI), '  firebase-init: 채널 사본 하나만 읽는다(roomLobby 통째 아님)');
  chk(/'E-ROOM-03'/.test(EC), '  오류 번호 E-ROOM-03 이 표에 있다');
  chk(!/innerHTML/.test(U_SRC), '★ 로비 화면은 innerHTML 을 안 쓴다 — 남이 쓴 제목 · 닉네임은 글로만');

  say('── 5. 깨 보기');
  {
    const noSort = model(M_SRC.replace('if(a.full !== b.full) return a.full ? 1 : -1;', ''));
    chk(noSort.cardsFrom(node, { now, cap: 10 }).list[0].code !== 'WORK-CC33', '«입장 가능 먼저» 를 빼면 1절 정렬이 빨강');
    const noOwner = classic(P_SRC.replace('return (pub && pub.owner === uid) ? { code: full, pub } : null;', 'return pub ? { code: full, pub } : null;'), 'TwRoomLobbyProvider');
    const p2 = noOwner.createRoomLobbyProvider({ api: () => ({ getMySecretRoom: async () => 'ABCD', getSecretRoomPub: async () => ({ owner: 'u2' }), checkSecretRoomEntry: async () => null }), myUserId: () => 'u1', now: () => now });
    chk(await p2.mySecretRoom() !== null, '소유 확인을 빼면 2절 «남에게 재발급» 이 빨강');
    const noFail = model(M_SRC.replace("if(!node) return { state: 'failed', list: [], total: 0, open: 0, ageMs: null };", "if(!node) node = { at: o.now, rooms: {} };"));
    chk(noFail.cardsFrom(null, { now, cap: 10 }).state !== 'failed', '못 읽음을 빈 목록으로 뭉개면 1절 «failed» 가 빨강');
    const noOwnerIn = classic(P_SRC.replace('e.count - (e.ownerIn ? 1 : 0)', 'e.count'), 'TwRoomLobbyProvider');
    const p3 = noOwnerIn.createRoomLobbyProvider({ api: () => ({ getMySecretRoom: async () => 'ABCD', getSecretRoomPub: async () => ({ owner: 'u1' }), checkSecretRoomEntry: async () => ({ count: 3, ownerIn: true }) }), myUserId: () => 'u1', now: () => now });
    chk((await p3.mySecretRoom()).guests !== 2, '방장을 빼지 않으면 2절 «손님 수» 가 빨강');
    const noCap = model(M_SRC.replace('const max = roomCap({ max: r.max }, cap);', 'const max = Number.isInteger(r.max) ? r.max : cap;'));
    chk(noCap.cardsFrom(node, { now, cap: 10 }).list.find((c) => c.code === 'WORK-FF66').max !== 10, '정원 규칙(roomCap)을 안 거치면 1절 «정원보다 큰 max» 가 빨강');
  }

  say('');
  say('통과 ' + pass + ' · 실패 ' + fail);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
