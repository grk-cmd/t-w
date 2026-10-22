/*
 * 🎧 같이 듣기 창(room/listen-ui.js) 검사 — 가짜 화면 · 가짜 재생 창(companion) · 가짜 provider 로 실제로 돌린다.
 * 1. 들어감 · 나감(구독 · 🎵↔🎧 · 내 플레이리스트 멈춤 · 방 서버 방은 안 함)
 * 2. 듣는 사람 — 곡을 지금 위치부터 · 같은 곡은 다시 안 엶 · 멈춤 · 다시 · 곡 끝은 기다림
 * 3. DJ — 빈 칸이면 첫 곡 · 곡 끝 → 다음 곡(한 번만) · 승계(옛 DJ 곡 다음은 내 첫 곡 · 멈춘 채 나갔으면 다시) · 예비 판정 · 버튼
 * 4. 다른 음악이 이김 · [다시 듣기] · 내가 닫은 창은 이김이 아님
 * 5. 하트비트 — 어긋남 맞추기 · 광고 · 길이 적기   6. 실패 번호   7. 창 글 · DJ 딱지   8. 이어 붙인 곳(app.js · html · room-entry · account)
 * 9. 깨 보기
 * 설계: docs/LISTEN_TOGETHER.md 1 · 4장
 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const need = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } };
const SRC = need('listen-ui.js'), MODEL_SRC = need('listen-model.js');
const APP = need('app.js'), HTML = need('desk-companion-prototype.html'), RE = need('room-entry.js'), ACC = need('account.js');
const FI = need('firebase-init.js'), OH = need('overhead.js'), PL = need('playlist.js');
const MODEL = (() => { const w = {}; new Function('window', MODEL_SRC)(w); return w.TwListenModel; })();
const flush = () => new Promise(r => setImmediate(r));
const T0 = 1700000000000;
const A = 'aaaaaaaaaaa', B = 'bbbbbbbbbbb', C = 'ccccccccccc';

function mkDom(){
  const els = {};
  const mk = (id) => ({
    id, textContent: '', title: '', hidden: false, disabled: false, value: '', style: {}, _l: [],
    classList: { s: new Set(id === 'listenBox' ? ['hidden'] : []), add(c){ this.s.add(c); }, remove(c){ this.s.delete(c); },
      toggle(c, on){ on ? this.s.add(c) : this.s.delete(c); }, contains(c){ return this.s.has(c); } },
    addEventListener(t, f, cap){ this._l.push({ t, f, cap: !!cap }); },
    click(){
      const e = { stopped: false, stopImmediatePropagation(){ this.stopped = true; }, stopPropagation(){} };
      for(const cap of [true, false]) for(const l of this._l.filter(x => x.t === 'click' && x.cap === cap)){ if(e.stopped) return; l.f(e); }
    },
    fire(t){ this._l.filter(x => x.t === t).forEach(l => l.f({ stopPropagation(){}, stopImmediatePropagation(){} })); },
  });
  return { getElementById: (id) => els[id] || (els[id] = mk(id)), els };
}

function mk(o, src){
  o = o || {};
  const st = { code: o.code === undefined ? 'PLAY-AB12' : o.code, meta: o.meta === undefined ? { host: 'dj', music: true } : o.meta,
    me: o.me || 'me', members: o.members || ['dj', 'x'], items: o.items || [{ id: A, title: '가' }, { id: B, title: '나' }, { id: C, title: '다' }],
    server: false, secret: !!o.secret, now: T0, plPlaying: !!o.plPlaying, writeOk: true };
  const dom = mkDom();
  const store = {};
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  const timers = { iv: [], to: [] };
  const comp = { log: [], cb: {} };
  ['openListenTrack', 'closeBgm', 'pauseBgm', 'resumeBgm', 'bgmSeek', 'setBgmVolume', 'setBgmLoop'].forEach(n => { comp[n] = (...a) => comp.log.push([n].concat(a)); });
  comp.onListenSignal = (f) => { comp.cb.signal = f; };
  comp.onBgmMode = (f) => { comp.cb.mode = f; };
  comp.onBgmClosed = (f) => { comp.cb.closed = f; };
  const prov = { subs: [], writes: [], unsubs: 0,
    subscribe(room, cb, onErr){ cb(undefined); prov.subs.push({ room, cb, onErr }); return () => { prov.unsubs++; }; },
    async write(room, m){ prov.writes.push([room, m]); return { ok: st.writeOk, err: st.writeOk ? undefined : 'denied' }; },
    now: () => st.now };
  const errs = [];
  let personalStops = 0;
  const chipCloses = [];
  const w = {};
  new Function('window', 'document', 'localStorage', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', src || SRC)(
    w, dom, ls, (f) => { timers.iv.push(f); return timers.iv.length; }, (id) => { timers.iv[id - 1] = null; },
    (f) => { timers.to.push(f); return 0; }, () => {});
  const ui = w.TwListenUi.createListenUi({
    model: MODEL, provider: prov, companion: () => comp,
    roomCode: () => st.code, meta: () => st.meta, isServerRoom: () => st.server, isSecretRoom: () => st.secret,
    myId: () => st.me, memberIds: () => st.members, nameOf: (u) => '닉_' + u,
    djItems: () => st.items, stopPersonal: () => { if(!st.plPlaying) return false; st.plPlaying = false; personalStops++; return true; }, positionPopup: () => {}, closeChipPopups: (id) => chipCloses.push(id),
    escRegisterWindow: () => {}, notifyError: (c) => errs.push(c),
  });
  const tick = () => timers.iv.filter(Boolean).forEach(f => f());
  const push = (m) => prov.subs[prov.subs.length - 1].cb(m);
  const calls = (n) => comp.log.filter(c => c[0] === n);
  return { ui, st, dom, comp, prov, errs, tick, push, calls, el: dom.getElementById, personalStops: () => personalStops, store, chipCloses };
}
const song = (o) => Object.assign({ id: A, title: '가', by: 'dj', at: T0 - 30000, paused: false, pos: 0, seq: 5 }, o || {});

(async () => {
say('── 1. 들어감 · 나감');
{
  let t = mk({ meta: { host: 'dj' } });
  t.ui.sync();
  chk(t.prov.subs.length === 0 && t.el('myPlBtn').textContent === '🎵', '일반 방(music 아님)은 구독하지 않고 🎵 그대로');
  t.st.meta = { host: 'dj', music: true };
  t.st.plPlaying = true;
  t.ui.sync();
  chk(t.prov.subs.length === 1 && t.prov.subs[0].room === 'PLAY-AB12', '★ meta 가 같이 듣기 방이 되면 곡 칸 하나를 구독');
  chk(t.el('myPlBtn').textContent === '🎧' && t.el('myPlBtn').title === '같이 듣기', '  상태칩 🎵 버튼이 🎧 «같이 듣기» 가 된다');
  t.ui.sync();
  chk(t.prov.subs.length === 1, '  같은 방에서 다시 불려도 구독은 하나');
  t.push(song());
  chk(t.personalStops() === 0 && t.calls('closeBgm').length === 0 && t.calls('openListenTrack').length === 1,
    '★ 곡이 있으면 내 플레이리스트 창을 닫지 않고 넘겨받는다(닫기는 늦게 끝나 막 연 곡까지 닫는다 — 플레이리스트는 onBgmMode 로 진다)');
  t.st.code = null; t.st.meta = null;
  t.ui.sync();
  chk(t.prov.unsubs === 1 && t.el('myPlBtn').textContent === '🎵', '★ 나가면 구독을 끊고 버튼을 되돌린다');
  const tq = mk({ plPlaying: true });
  tq.ui.sync(); tq.push(null);
  const tp = mk({ plPlaying: true });
  tp.ui.sync(); tp.push(song({ paused: true, pos: 9 }));
  chk(tq.personalStops() === 1 && tp.personalStops() === 1, '★ 틀 곡이 없거나 멈춘 방에 들어오면 내 플레이리스트를 멈춘다');
  chk(t.calls('closeBgm').length === 1 && t.calls('openListenTrack').length === 1, '  같이 듣기 곡을 닫는다(내 플레이리스트는 멈춘 채 — 다시 틀지 않는다)');
  t = mk();
  t.st.server = true;
  t.ui.sync();
  chk(t.prov.subs.length === 0 && t.el('myPlBtn').textContent === '🎵', '방 서버 방은 같이 듣기를 하지 않는다(서버가 music 을 받기 전까지)');
}

say('── 2. 듣는 사람');
{
  const t = mk();
  t.ui.sync();
  chk(t.calls('openListenTrack').length === 0, '불러오는 중(undefined)엔 아무것도 안 연다');
  t.push(song());
  const o = t.calls('openListenTrack');
  chk(o.length === 1 && o[0][1] === 'https://www.youtube.com/watch?v=' + A && o[0][2] === '가' && o[0][3] === 30, '★ DJ 의 곡을 지금 위치(30초)부터 연다');
  chk(t.calls('setBgmLoop').length === 1 && t.calls('setBgmLoop')[0][1] === false, '  열기 전 «한 곡 반복» 을 끈다(곡 끝 신호가 오게)');
  t.push(song({ dur: 204, seq: 6 }));
  chk(t.calls('openListenTrack').length === 1, '★ 같은 곡(길이만 적힘)은 다시 열지 않는다');
  t.push(song({ paused: true, pos: 40, seq: 7 }));
  chk(t.calls('pauseBgm').length === 1, '★ DJ 가 멈추면 내 재생 창도 멈춘다');
  t.push(song({ paused: true, pos: 40, seq: 7 }));
  chk(t.calls('pauseBgm').length === 1, '  두 번 멈추지 않는다');
  t.st.now = T0 + 100000;
  t.push(MODEL.resumed(song({ paused: true, pos: 40, seq: 7 }), t.st.now));
  const o2 = t.calls('openListenTrack');
  chk(o2.length === 2 && o2[1][3] === 40, '★ 다시 틀면 멈춘 자리(40초)부터 새로 연다');
  t.comp.cb.signal('ended');
  await flush();
  chk(t.prov.writes.length === 0, '★ 듣는 사람은 곡이 끝나도 쓰지 않는다 — DJ 를 기다린다');
  t.push(null);
  chk(t.calls('closeBgm').length === 1, '  틀 곡이 없어지면 재생 창을 닫는다');
  const t2 = mk();
  t2.ui.sync();
  t2.push(song({ paused: true, pos: 12 }));
  chk(t2.calls('openListenTrack').length === 0, '  멈춘 방에 들어오면 열지 않는다(«멈춤» 화면만)');
}

say('── 3. DJ');
{
  let t = mk({ meta: { host: 'me', music: true } });
  t.ui.sync();
  t.push(null);
  await flush();
  chk(t.prov.writes.length === 1 && t.prov.writes[0][1].id === A && t.prov.writes[0][1].by === 'me' && t.prov.writes[0][1].seq === 0 && t.prov.writes[0][1].at === T0,
    '★ 칸이 비었으면 내 플레이리스트 첫 곡을 0초 · 차례 0 으로 쓴다');
  t.push(t.prov.writes[0][1]);
  t.comp.cb.signal('ended');
  await flush();
  t.comp.cb.signal('ended');   // 새 곡이 오기 전에 한 번 더(쓰기는 이미 끝남)
  await flush();
  chk(t.prov.writes.length === 2 && t.prov.writes[1][1].id === B && t.prov.writes[1][1].seq === 1, '★ 곡 끝 → 다음 곡(차례 +1) — 신호가 두 번 와도 한 번만');
  t.push(t.prov.writes[1][1]);
  t.el('lsSkip').click();
  await flush();
  t.push(t.prov.writes[2][1]);
  t.el('lsPrev').click();
  await flush();
  chk(t.prov.writes[2][1].id === C && t.prov.writes[3][1].id === B, '⏭ · ⏮ 버튼 — 다음 · 이전 곡');
  t.push(t.prov.writes[3][1]);
  t.el('lsPlay').click();
  await flush();
  chk(t.prov.writes[4][1].paused === true && t.prov.writes[4][1].seq === t.prov.writes[3][1].seq + 1, '⏸ — 멈춤을 쓴다(방 모두 멈춤)');

  t = mk({ meta: { host: 'me', music: true }, members: ['x'] });
  t.ui.sync();
  t.push(song({ id: C, by: 'old' }));
  t.comp.cb.signal('ended');
  await flush();
  chk(t.prov.writes.length === 1 && t.prov.writes[0][1].id === A && t.prov.writes[0][1].by === 'me', '★ 승계: 옛 DJ 곡이 끝나면 내 플레이리스트 첫 곡부터');
  t = mk({ meta: { host: 'me', music: true } });
  t.ui.sync();
  t.push(song({ by: 'old', paused: true, pos: 77 }));
  await flush();
  chk(t.prov.writes.length === 1 && t.prov.writes[0][1].paused === false && MODEL.posOf(t.prov.writes[0][1], T0) === 77 && t.prov.writes[0][1].by === 'me', '★ 옛 DJ 가 멈춘 채 나갔으면 새 DJ 가 그 자리부터 다시 튼다(이제 내 곡)');
  t = mk({ meta: { host: 'me', music: true } });
  t.ui.sync();
  t.push(song({ by: 'old' }));
  t.el('lsPlay').click();
  await flush();
  t.push(t.prov.writes[0][1]);
  await flush();
  chk(t.prov.writes.length === 1 && t.prov.writes[0][1].paused === true && t.prov.writes[0][1].by === 'me', '★ 이어받은 DJ 가 옛 DJ 곡을 멈추면 멈춘 채로 — «옛 DJ 가 멈춘 채 나감» 으로 다시 풀지 않는다');
  t = mk({ meta: { host: 'me', music: true } });
  t.st.writeOk = false;
  t.ui.sync();
  t.push(song({ by: 'me', dur: 20 }));
  t.tick();
  await flush();
  t.tick(); t.tick();
  await flush();
  chk(t.prov.writes.length === 1, '  쓰기가 막히면 1초 tick 마다 다시 쓰지 않는다(잠깐 기다림)');
  t.st.writeOk = true;
  t.el('lsSkip').click();
  await flush();
  chk(t.prov.writes.length === 2 && t.prov.writes[1][1].id === B, '★ 다음 곡 쓰기가 실패해도 그 곡에 갇히지 않는다 — ⏭ 로 다시 넘긴다');
  t = mk({ meta: { host: 'me', music: true } });
  t.ui.sync();
  t.push(song({ by: 'me', dur: 20 }));
  t.tick();
  await flush();
  chk(t.prov.writes.length === 1 && t.prov.writes[0][1].id === B, '★ 곡 끝 신호를 못 받아도 예비 판정(길이 + 3초)으로 넘긴다');
  t = mk({ meta: { host: 'me', music: true }, items: [] });
  t.ui.sync();
  t.push(song({ by: 'old' }));
  t.comp.cb.signal('ended');
  await flush();
  chk(t.prov.writes.length === 1 && t.prov.writes[0][1] === null, '  내 플레이리스트가 비었으면 칸을 지운다(«틀 곡 없음»)');
  t.push(null);
  t.tick();
  await flush();
  chk(t.prov.writes.length === 1, '  빈 목록으로는 계속 쓰지 않는다');
  t = mk({ meta: { host: 'dj', music: true }, secret: true, members: ['x'] });
  t.ui.sync();
  t.push(song({ dur: 20 }));
  t.tick();
  await flush();
  chk(t.prov.writes.length === 0, '★ DJ(방장)가 방에 없으면 아무도 쓰지 않는다 — 곡이 끝나면 멈춤(시크릿룸 «쉬는 중»)');
}

say('── 4. 다른 음악이 이김');
{
  let t = mk();
  t.ui.sync();
  t.push(song());
  t.comp.cb.mode('home');
  t.push(song({ id: B, seq: 6 }));
  chk(t.calls('openListenTrack').length === 1, '★ 마이홈 BGM · 내 플레이리스트가 이기면 다음 곡이 와도 재생 창을 안 뺏는다');
  t.el('listenBox').classList.remove('hidden');
  t.ui.sync();
  chk(t.el('lsMsg').textContent === '다른 음악을 틀고 있어 같이 듣기가 멈췄어요' && t.el('lsRetry').hidden === false, '  창에 «다른 음악 … [다시 듣기]»');
  t.el('lsRetry').click();
  const o = t.calls('openListenTrack');
  chk(o.length === 2 && o[1][1].indexOf(B) > 0 && t.el('lsRetry').hidden === true, '★ [다시 듣기] — DJ 의 지금 곡 · 지금 위치로');
  t.comp.cb.mode('playlist');
  t.st.code = null; t.st.meta = null;
  t.ui.sync();
  chk(t.calls('closeBgm').length === 0, '  이긴 음악이 나는 채로 방을 나가면 그 음악은 그대로 둔다');

  t = mk({ plPlaying: true });
  t.ui.sync();
  t.push(null);            // 틀 곡 없음 → 내 플레이리스트를 멈춘다(창 닫기 요청)
  t.push(song());          // 그 닫힘 알림이 오기 전에 DJ 곡이 와서 연다
  t.comp.cb.closed();      // 늦은 닫힘 — 막 연 곡도 같이 닫혔다
  chk(t.calls('openListenTrack').length === 2, '★ 내가 닫은 창의 «닫힘» 이 곡을 연 뒤에 오면 이김이 아니고 · 같이 닫힌 곡을 다시 연다');
  t.push(song({ paused: true, pos: 40, seq: 6 }));
  chk(t.calls('pauseBgm').length === 1, '  늦은 닫힘 뒤에도 DJ 멈춤을 따른다');
  t.st.code = null; t.st.meta = null; t.ui.sync();
  chk(t.calls('closeBgm').length === 1, '  늦은 닫힘 뒤에도 나가면 같이 듣기 곡을 닫는다');
  t = mk();
  t.ui.sync(); t.push(song());
  t.comp.cb.closed();
  t.push(song({ id: C, seq: 7 }));
  chk(t.calls('openListenTrack').length === 1, '  내가 안 닫은 재생 창이 닫히면 이김으로 본다');
}

say('── 5. 하트비트');
{
  let t = mk();
  t.ui.sync();
  t.push(song());   // 30초
  t.st.now = T0 + 20000;   // 지금 50초
  t.comp.cb.signal('hb:20|200|0|0');
  chk(t.calls('bgmSeek').length === 0, '  곡을 연 직후 8초 안에는 옮기지 않는다');
  const realNow = Date.now;
  Date.now = () => realNow() + 9000;
  t.comp.cb.signal('hb:20|200|0|1');
  chk(t.calls('bgmSeek').length === 0, '★ 광고 중이면 안 옮긴다');
  t.comp.cb.signal('hb:20|200|0|0');
  chk(t.calls('bgmSeek').length === 1 && t.calls('bgmSeek')[0][1] === 50, '★ 5초 넘게 어긋나면 DJ 위치(50초)로 옮긴다');
  t.comp.cb.signal('hb:20|200|0|0');
  chk(t.calls('bgmSeek').length === 1, '  옮긴 직후 다시 옮기지 않는다');
  Date.now = realNow;
  t = mk({ meta: { host: 'me', music: true } });
  t.ui.sync();
  t.push(song({ by: 'me' }));
  t.comp.cb.signal('hb:31|204|0|0');
  await flush();
  chk(t.prov.writes.length === 1 && t.prov.writes[0][1].dur === 204, 'DJ 는 하트비트로 안 곡 길이를 한 번 적는다(예비 판정용)');
  t.push(t.prov.writes[0][1]);
  t.comp.cb.signal('hb:36|204|0|0');
  await flush();
  chk(t.prov.writes.length === 1, '  이미 적었으면 다시 안 쓴다');
}

say('── 6. 실패 번호');
{
  let t = mk();
  t.ui.sync();
  t.push(song());
  t.comp.cb.signal('err');
  t.comp.cb.signal('err');
  chk(t.errs.filter(c => c === 'E-ROOM-06').length === 1, '★ 못 트는 곡은 E-ROOM-06 — 곡마다 한 번');
  t = mk({ meta: { host: 'me', music: true } });
  t.st.writeOk = false;
  t.ui.sync();
  t.push(null);
  await flush();
  chk(t.errs.indexOf('E-ROOM-05') >= 0, '★ DJ 의 쓰기가 막히면 E-ROOM-05');
  t = mk();
  t.ui.sync();
  t.prov.subs[0].onErr('denied');
  t.el('listenBox').classList.remove('hidden');
  t.ui.sync();
  chk(t.errs.indexOf('E-ROOM-07') >= 0 && t.el('lsMsg').textContent === '같이 듣기를 불러오지 못했어요', '★ 구독이 거부되면 E-ROOM-07 · 창에도 «못 불러옴»(«틀 곡 없음» 과 다르다)');
}

say('── 7. 창 글 · DJ 딱지');
{
  let t = mk();
  t.ui.sync();
  t.el('myPlBtn').click();
  chk(!t.el('listenBox').classList.contains('hidden'), '★ 같이 듣기 방에서 🎧 를 누르면 같이 듣기 창이 열린다');
  chk(t.chipCloses.length === 1 && t.chipCloses[0] === 'listenBox', '  열 때 상태칩 드롭메뉴를 닫는다(같이 듣기 창은 빼고 — 플레이리스트 창과 같은 규칙)');
  chk(t.el('lsMsg').textContent === '불러오는 중…', '  불러오는 중');
  t.push(song({ title: '<b>제목</b>' }));
  chk(t.el('lsTitle').textContent === '<b>제목</b>' && t.el('lsDj').textContent === '🎧 DJ 닉_dj · 듣는 사람 3명', '  곡 제목은 글로만(textContent) · DJ · 사람 수');
  chk(t.el('lsCtl').hidden === true && t.el('lsEdit').hidden === true, '  듣는 사람에겐 곡 버튼이 없다(소리 크기 · 음소거만)');
  t.el('lsMute').click();
  chk(t.calls('setBgmVolume').slice(-1)[0][1] === 0 && t.store['tw.listenMute'] === '1' && t.el('lsMute').textContent === '🔇', '음소거 — 이 기기에만 · 소리 0');
  t.el('lsMute').click(); t.el('lsVol').value = '30'; t.el('lsVol').fire('input');
  chk(t.calls('setBgmVolume').slice(-1)[0][1] === 0.3 && t.store['tw.listenVol'] === '30', '소리 크기 — 이 기기에만');
  t.st.meta = { host: 'me', music: true };
  t.ui.sync();
  chk(t.el('lsCtl').hidden === false && t.el('lsNext').textContent === '다음 곡 · 가', 'DJ 가 되면 곡 버튼 · 다음 곡(옛 DJ 곡 다음은 내 첫 곡)');
  chk(t.ui.djId() === 'me', '  djId — 이름표 «🎧 DJ» 딱지가 읽는 값');
  t.st.meta = { host: 'gone', music: true };
  t.push(song({ dur: 10 }));
  t.ui.sync();
  chk(t.el('lsMsg').textContent === 'DJ 가 없어서 쉬는 중이에요' && t.ui.djId() === null, 'DJ 가 없고 곡이 끝났으면 «쉬는 중» · 딱지 없음');
  t.st.secret = true; t.ui.sync();
  chk(t.el('lsMsg').textContent === 'DJ(방 주인)가 없어서 쉬는 중이에요', '  시크릿룸은 «DJ(방 주인)»');
  t.el('lsEdit').hidden = false;
  t.st.meta = { host: 'me', music: true }; t.ui.sync();
  let plOpened = 0;
  t.el('myPlBtn').addEventListener('click', () => { plOpened++; });
  t.el('lsEdit').click();
  chk(plOpened === 1 && t.el('listenBox').classList.contains('hidden'), 'DJ «🎵 내 플레이리스트 고치기» — 같이 듣기 창을 닫고 플레이리스트 창을 한 번 연다');
  t.el('myPlBtn').click();
  chk(plOpened === 1 && !t.el('listenBox').classList.contains('hidden'), '  그다음 🎧 는 다시 같이 듣기 창');
  t.st.code = null; t.st.meta = null; t.ui.sync();
  t.el('myPlBtn').click();
  chk(plOpened === 2 && t.ui.djId() === null, '  방을 나가면 🎵 는 플레이리스트 창 · DJ 없음');
}

say('── 8. 이어 붙인 곳');
{
  const iL = APP.indexOf('const listenUi = TwListenUi.createListenUi({'), iRe = APP.indexOf('const roomEntryMod = TwRoomEntry.createRoomEntry({');
  chk(iL > 0 && iRe > iL && /\nroomEntryMod\.onRoomChanged\(\(\)=>listenUi\.sync\(\)\);/.test(APP) && !/listenUi\.connect/.test(APP), 'app.js: 방 입장 모듈보다 먼저 만들고 · 방 입장 모듈의 «방이 바뀜» 알림에 sync 를 건다(방 입장은 같이 듣기를 모른다)');
  chk(/function _roomChanged\(\)\{ paintRoomInfo\(\); _roomChangedFns\.forEach\(f => f\(\)\); \}/.test(RE) && (RE.match(/\b_roomChanged\(\);/g) || []).length === 3, '  room-entry: 들어감 · 나감 · meta 세 곳이 알림을 보낸다');
  chk(/closeChipPopups: \(id\)=>chipPopupsMod\._closeChipPopups\(id\)/.test(APP), '  app.js: 상태칩 «한 번에 하나» 닫기를 넘긴다');
  chk(/provider: TwListenProvider\.createListenProvider\(\{ api: \(\)=>window\.firebaseAPI \}\)/.test(APP) && /stopPersonal: \(\)=>plMod\.stopIfPlaying\(\)/.test(APP), '  provider · 내 플레이리스트 멈추기');
  chk(/stopIfPlaying: \(\)=>\{ if\(_plNow < 0\) return false; _plStop\(\); return true; \}/.test(PL), 'playlist.js: 나고 있을 때만 멈추고 true');
  const fr = (APP.match(/\nfunction frame\(now, manual\)\{[\s\S]*?\n\}\n/) || [''])[0];
  const iDj = fr.indexOf('const _djNow = listenUi.djId();'), iLoop = fr.indexOf('  seats.forEach(seat=>{');
  chk(iDj > 0 && iLoop > iDj && (fr.match(/listenUi\.djId\(\)/g) || []).length === 1, '이름표 «🎧 DJ» — DJ 판정은 프레임에 한 번, 좌석 줄 앞에서(좌석마다 방 사람 목록을 다시 만들지 않게)');
  chk(/setSeatNamePlate\(seat, lv, seat\.friendName\|\|'\(이름 없음\)', st, !!seat\.friendUserId && _djNow === seat\.friendUserId\)/.test(APP)
    && /setSeatNamePlate\(seat, lv, getDisplayName\(\), st, !!getMyUserId\(\) && _djNow === getMyUserId\(\)\)/.test(APP), '  남 · 나 둘 다 그 값으로(내 코드가 없으면 null===null 로 켜지지 않게)');
  chk(/function setSeatNamePlate\(seat, level, name, star, dj\)/.test(OH) && /\+ \(dj \? '\|dj' : ''\)/.test(OH) && /b\.className = 'np-dj'; b\.textContent = '🎧 DJ';/.test(OH), '  overhead.js: 딱지는 열쇠에 들어가 바뀔 때만 다시 그린다');
  const chip = HTML.slice(HTML.indexOf('<div id="myStatusChip"'), HTML.indexOf('<!-- 캐릭터 머리 위 설정 패널'));
  chk(['listenBox', 'lsClose', 'lsTitle', 'lsDj', 'lsBar', 'lsNow', 'lsLen', 'lsMsg', 'lsRetry', 'lsCtl', 'lsPrev', 'lsPlay', 'lsSkip', 'lsNext', 'lsVol', 'lsMute', 'lsEdit', 'lsHint'].every(id => chip.indexOf('id="' + id + '"') > 0),
    '★ html: 같이 듣기 창이 #myStatusChip 안에 있다(실행 화면에서 클릭이 뒤로 새지 않게)');
  const iM = HTML.indexOf('parts/room/listen-model.js'), iU = HTML.indexOf('parts/room/listen-ui.js'), iA = HTML.indexOf('<script src="parts/app.js">');
  chk(iM > 0 && iU > iM && iA > iU && HTML.indexOf('parts/room/listen-provider.js') > iM, '  html: model · provider · 창을 app.js 앞에 싣는다');
  chk(/id="rcMusic"/.test(HTML) && /id="fsSecretMusicRow"[\s\S]{0,80}id="fsSecretMusic"/.test(HTML), '  방 만들기 «🎧 같이 듣기 방» · F1 «내 시크릿룸을 같이 듣기로 열기» 칸');
  chk(/const _srOpen = \(_iAmSrOwner && _roomCount === 0\) \? \{ music: _secretMusicOn\(\) \} : undefined;/.test(RE)
    && /setRoomChannel\(code, 'togetherroom', _secretOwner, undefined, _srOpen\)/.test(RE), '★ 시크릿룸: 주인이 빈 방을 열 때만 같이 듣기를 정한다(손님이 들어올 때마다 쓰면 곡이 지워진다)');
  chk(/const SECRET_MUSIC_KEY = 'tw\.secretRoomMusic';/.test(RE) && /'tw\.secretRoomMusic',/.test(ACC), '  F1 칸은 이 기기에 기억 · 로그아웃 때 지움(account.js)');
  chk(/music: !!\(settings && settings\.music\) \};/.test(RE), '  방 만들기: 고른 값에 music');
  chk(/subscribeRoomMusic\(room, cb, onErr\)/.test(FI) && /async setRoomMusic\(room, music\)/.test(FI), '  firebase-init: 곡 칸 구독 · 쓰기(sim-listen-provider 가 자세히)');
}

say('── 9. 깨 보기');
{
  const B1 = SRC.replace("  if(owner === 'listen' && openedKey === keyOf(music)) return;\n", '');
  let t = mk({}, B1);
  t.ui.sync(); t.push(song()); t.push(song({ dur: 204, seq: 6 }));
  chk(t.calls('openListenTrack').length === 2, '«같은 곡은 다시 안 엶» 을 빼면 2절이 빨강');
  const B2 = SRC.replace('  if(!amDj() || !music || advancedSeq === music.seq) return;', '  if(!amDj() || !music) return;');
  t = mk({ meta: { host: 'me', music: true } }, B2);
  t.ui.sync(); t.push(song({ by: 'me' })); t.comp.cb.signal('ended');
  await flush(); t.comp.cb.signal('ended'); await flush();
  chk(t.prov.writes.length === 2, '«한 차례에 한 번» 을 빼면 3절이 빨강');
  const B3 = SRC.replace("  if(mode !== 'listen' && room && !lost){", "  if(false){");
  t = mk({}, B3);
  t.ui.sync(); t.push(song()); t.comp.cb.mode('home'); t.push(song({ id: B, seq: 6 }));
  chk(t.calls('openListenTrack').length === 2, '«다른 음악이 이김» 을 빼면 4절이 빨강');
}

say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
})();
