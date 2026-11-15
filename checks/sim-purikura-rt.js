/* sim-purikura-rt.js — 📷 스티커사진 세션 포트(purikura/purikura-rt.js) 검사 — 가짜 연결 · 가짜 정원 API 로 그대로 돌린다
   ・1절: 자리 잡기 — photoOpen{ fx } · photoWelcome 의 자리 · 방장 · 프레임 · 거절 코드마다 화면 까닭 · 시간 초과(자리 놓기) · 연결 없음
   ・2절: 자리가 바뀔 때 — 방장은 서버가 보낸 meta.host(작은 번호가 아니어도 따른다) · 승계 · 떠난 사람 좌표 치움 · 좌표 · 사건 · 셔터 받기
   ・3절: 방장 일 — 방장만 보낸다 · 보낸 모양이 서버 규약(허용 목록 · 범위)을 지킨다 · 서버 거절 알림(onRefused)
   ・4절: 촬영 시작 — photoStarted · 거절 코드마다 까닭 문구 · 정원 숫자 갱신 · 시간 초과 · 한 번에 하나
   ・5절: 좌표 · 사건 보내기 — 안 움직이면 안 보냄 · 10Hz · force · 못 보냈으면 기억하지 않음
   ・6절: 자리를 잃을 때 — 연결 끊김 · 방 밖 답 · 혼자 다시 들어가지 않음 · 닫기 · 놓기
   ・7절: 정원 — GET 모양(못 읽음은 던짐 ≠ 0회 남음) · 알림이 오면 한 번 다시 읽기 · 창을 닫으면 안 받음 · 경계값
   ・8절: 서버 규약 대조 · 배선(html 순서) · 걷은 길 · 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find((v) => v != null);
const SRC0 = {
  RT: pick(['purikura-rt.js', 'parts/purikura/purikura-rt.js', 'app/parts/purikura/purikura-rt.js']),
  NET: pick(['purikura-net.js', 'parts/purikura/purikura-net.js', 'app/parts/purikura/purikura-net.js']),
  HUB: pick(['rt-hub.js', 'parts/realtime/rt-hub.js', 'app/parts/realtime/rt-hub.js']),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const load = (src) => { const m = { exports: {} }; new Function('module', 'window', src)(m, undefined); return m.exports; };
const tick = async () => { for(let i = 0; i < 10; i++) await Promise.resolve(); };
const KST = (iso) => Date.parse(iso + '+09:00');

/* ── 서버 통신 규약 4-6 — 보낸 모양이 서버가 받는 모양인지 대조하는 표(서버가 정답) ─────────────────── */
const WIRE = {
  orients: ['p', 'l'], cuts: { p: [1, 4], l: [1, 2, 4] }, basics: ['none', 'white', 'black'],
  bgs: ['white', 'sky', 'sepia', 'blue', 'red', 'gray'], filters: ['none', 'soft', 'ps1', 'fish', 'mono', 'dawn', 'vint', 'toon'],
  events: ['jump', 'pose', 'blink'], posRe: /^-?[0-9]+,-?[0-9]+(,-?[0-9]+,-?[0-9]+,-?[0-9]+)?$/, posMax: 24, frameMax: 512,
  camH: [0.5, 2.6], camP: [0, 26], slots: 4,
};
const RID_RE = /^[A-Za-z0-9_.:-]{1,16}$/;   // 서버 rid 모양(PROTOCOL 1장)
const onlyKeys = (o, ks) => Object.keys(o).every((k) => ks.indexOf(k) >= 0);
const isInt = (v, a, b) => Number.isInteger(v) && v >= a && v <= b;
/* 서버가 받는 모양이면 null, 아니면 이유 */
function wireProblem(m){
  switch(m.t){
    case 'photoOpen': return onlyKeys(m, ['t', 'fx', 'rid']) && (m.fx === undefined || isInt(m.fx, 0, 99)) && RID_RE.test(m.rid) ? null : 'photoOpen 모양';
    case 'photoStart': return onlyKeys(m, ['t', 'rid']) && RID_RE.test(m.rid) ? null : 'photoStart 모양';
    case 'photoLeave': case 'photoDone': return onlyKeys(m, ['t']) ? null : m.t + ' 모양';
    case 'photoConfig': {
      const ks = ['orient', 'cuts', 'basic', 'bg', 'filter', 'camH', 'camP'];
      if(!onlyKeys(m, ['t'].concat(ks)) || !ks.every((k) => k in m)) return 'photoConfig 칸';
      if(WIRE.orients.indexOf(m.orient) < 0 || (WIRE.cuts[m.orient] || []).indexOf(m.cuts) < 0) return 'photoConfig 방향 · 컷';
      if(WIRE.basics.indexOf(m.basic) < 0) return 'photoConfig basic';
      const bgs = String(m.bg).split(',');
      if(bgs.length < 1 || bgs.length > 6 || bgs.some((b) => WIRE.bgs.indexOf(b) < 0)) return 'photoConfig bg';
      if(WIRE.filters.indexOf(m.filter) < 0) return 'photoConfig filter';
      return typeof m.camH === 'number' && typeof m.camP === 'number' ? null : 'photoConfig cam';
    }
    case 'photoFilter': return onlyKeys(m, ['t', 'filter']) && WIRE.filters.indexOf(m.filter) >= 0 ? null : 'photoFilter 모양';
    case 'photoCam': return onlyKeys(m, ['t', 'h', 'p']) && typeof m.h === 'number' && typeof m.p === 'number' ? null : 'photoCam 모양';
    case 'photoCut': return onlyKeys(m, ['t', 'i', 'at']) && isInt(m.i, 0, 3) && typeof m.at === 'number' && m.at >= 0 ? null : 'photoCut 모양';
    case 'photoFrame': return onlyKeys(m, ['t', 'i', 'url']) && isInt(m.i, 0, 3) && (m.url === null || (typeof m.url === 'string' && m.url.length >= 1 && m.url.length <= WIRE.frameMax)) ? null : 'photoFrame 모양';
    case 'photoPos': return onlyKeys(m, ['t', 'p']) && typeof m.p === 'string' && m.p.length <= WIRE.posMax && WIRE.posRe.test(m.p) ? null : 'photoPos 모양';
    case 'photoEvent': return onlyKeys(m, ['t', 'k', 'v']) && WIRE.events.indexOf(m.k) >= 0 && (m.v === undefined || m.v === null || typeof m.v === 'number') ? null : 'photoEvent 모양';
    case 'photoShutter': return onlyKeys(m, ['t', 'n']) && isInt(m.n, 0, 3) ? null : 'photoShutter 모양';
    default: return '서버가 모르는 메시지 ' + m.t;
  }
}

function mk(S, o){
  o = o || {};
  const fns = {}, kinds = {}, states = [], sent = [], timers = [], cb = { peers: [], meta: [], event: [], shot: [], slots: [], frames: [], refused: [], late: [] }, gets = [], warns = [];
  const st = { ready: !o.offline, T: o.T === undefined ? KST('2026-03-15T14:00:00') : o.T, clock: 1000, getRes: o.getRes, getErr: o.getErr };
  const hub = {
    onMessage(t, fn){ (fns[t] = fns[t] || []).push(fn); },
    on(k, fn){ (kinds[k] = kinds[k] || []).push(fn); },
    onState(fn){ states.push(fn); },
    isReady: () => st.ready,
    send(m){ if(!st.ready || o.sendFails) return false; sent.push(m); return true; },
  };
  const api = { get(path, opts){ gets.push([path, opts]); if(st.getErr) return Promise.reject(st.getErr); return Promise.resolve(st.getRes); } };
  const P = load(S.NET);
  const R = load(S.RT);
  const sess = R.createPhotoSession({
    hub, api, P, serverNow: () => st.T, clock: () => st.clock, warn: (...a) => warns.push(a.join(' ')),
    setTimeout: (f, ms) => { const h = { f, ms }; timers.push(h); return h; }, clearTimeout: (h) => { const i = timers.indexOf(h); if(i >= 0) timers.splice(i, 1); },
    onPeers: (v) => cb.peers.push(JSON.stringify(v)), onMeta: (v) => cb.meta.push(v), onEvent: (s, e) => cb.event.push([s, e]),
    onShot: (v) => cb.shot.push(v), onSlots: (v) => cb.slots.push(JSON.stringify(v)), onFrames: (v) => cb.frames.push(JSON.stringify(v)), onRefused: (v) => cb.refused.push(v), onLateStart: () => cb.late.push(1),
  });
  /* 서버는 photoOpen · photoStart 의 답에 그 요청의 rid 를 돌려준다 — rid 를 안 적은 답은 «가장 최근 그 요청의 rid» 를 달아 보낸다(늦은 답은 rid 를 직접 적는다) */
  const lastRid = (t) => { for(let i = sent.length - 1; i >= 0; i--) if(sent[i].t === t) return sent[i].rid; return undefined; };
  const emit = (m) => {
    if(m.rid === undefined){
      const t = m.t === 'photoWelcome' ? 'photoOpen' : m.t === 'photoStarted' ? 'photoStart' : (m.t === 'error' && (m.ref === 'photoOpen' || m.ref === 'photoStart')) ? m.ref : null;
      if(t && lastRid(t) !== undefined && !m.noRid) m = Object.assign({}, m, { rid: lastRid(t) });
    }
    (fns[m.t] || []).forEach((f) => f(m));
  };
  return { R, P, sess, hub, st, sent, timers, cb, gets, warns, states, kinds, fns, emit,
    notify: () => (kinds.photoQuota || []).forEach((f) => f({ kind: 'photoQuota', resync: false })),
    drop: () => { st.ready = false; states.forEach((f) => f('retrying')); },
    fireTimer: (ms) => { const i = timers.findIndex((t) => ms === undefined || t.ms === ms); if(i >= 0){ const t = timers.splice(i, 1)[0]; t.f(); } },
    last: () => sent[sent.length - 1] };
}
const META = (o) => Object.assign({ host: 'uA', orient: 'p', cuts: 4, basic: 'none', bg: 'white', filter: 'none', camH: 1.65, camP: 16, state: 'lobby', startedAt: 0, cut: 0, cutAt: 0 }, o || {});
const WELCOME = (o) => Object.assign({ t: 'photoWelcome', slot: 0, slots: [{ userCode: 'uA', name: '나', fx: 1 }, null, null, null], meta: META(), frames: [null, null, null, null] }, o || {});
/* 자리를 잡은 상태까지 */
async function opened(S, o){
  o = o || {};
  const e = mk(S, o.mk);
  const p = e.sess.open('ROOM1', { userCode: o.me || 'uA' });
  e.emit(WELCOME(o.welcome));
  e.openRes = await p;
  e.sent.length = 0;
  return e;
}
const QUOTA = (o) => Object.assign({ day: '2026-03-15', used: 5, cap: 400, left: 395, reopenAt: '2026-03-15T15:00:00Z' }, o || {});

async function judge(S){
  say('── 1. 자리 잡기');
  let e = mk(S);
  const p1 = e.sess.open('ROOM1', { userCode: 'uA' });
  chk(e.sent.length === 1 && e.sent[0].t === 'photoOpen' && e.sent[0].fx === e.P.FILTER_REV && wireProblem(e.sent[0]) === null, 'photoOpen{ fx } — 내 앱이 아는 필터 판(방장 안내용) · 서버 모양');
  chk((await e.sess.open('ROOM1', { userCode: 'uA' })).reason === 'error', '  답을 기다리는 동안 또 열면 거절(자리 둘을 잡지 않게)');
  e.emit(WELCOME({ slot: 1, slots: [{ userCode: 'uB', name: '방장', fx: 1 }, { userCode: 'uA', name: '나', fx: 0 }, null, null],
    meta: META({ host: 'uB', cuts: 2, orient: 'l' }), frames: ['https://x/0.webp', null, 'https://x/2.webp', null] }));
  const r1 = await p1;
  chk(r1.ok === true && r1.slot === 1 && r1.host === false, 'photoWelcome → ok · 내 자리 1번 · 방장 아님(방장은 meta.host)');
  chk(JSON.stringify(e.sess.slotsNow()) === '{"0":{"uid":"uB","name":"방장","fx":1},"1":{"uid":"uA","name":"나","fx":0}}', '  자리 칸은 { uid(=userCode), name, fx } — 빈 자리는 싣지 않는다');
  chk(e.sess.mySlot() === 1 && e.sess.hostSlot() === 0 && e.sess.isHost() === false, '  mySlot · hostSlot · isHost');
  chk(JSON.stringify(e.sess.framesNow()) === '{"0":"https://x/0.webp","2":"https://x/2.webp"}' && e.sess.metaNow().cuts === 2, '  프레임(빈 칸 빼고) · 판이 손에 있다');
  chk(e.cb.slots.length === 1 && e.cb.meta.length === 1 && e.cb.meta[0].orient === 'l' && e.cb.frames.length === 1, '  onSlots · onMeta · onFrames 가 한 번씩 불린다(창이 첫 값을 그리게)');
  e = await opened(S);
  chk(e.openRes.ok && e.openRes.slot === 0 && e.openRes.host === true && e.sess.isHost(), '혼자 들어오면 0번 방장');
  const refuse = async (code, ref) => { const m = mk(S); const pp = m.sess.open('ROOM1', { userCode: 'uA' }); m.emit({ t: 'error', code, ref: ref || 'photoOpen' }); return pp; };
  chk((await refuse('ROOM_PHOTO_BUSY')).reason === 'busy', '거절 ROOM_PHOTO_BUSY → busy(촬영 중)');
  chk((await refuse('ROOM_PHOTO_FULL')).reason === 'full', '거절 ROOM_PHOTO_FULL → full(넷이 참)');
  chk((await refuse('notInRoom')).reason === 'notInRoom', '거절 notInRoom → notInRoom(방 밖)');
  chk((await refuse('badRequest')).reason === 'error' && (await refuse('whatever')).reason === 'error', '그 밖의 코드 → error(까닭을 지어내지 않는다)');
  e = mk(S); let settled = null; const p3 = e.sess.open('ROOM1', { userCode: 'uA' }).then((r) => { settled = r; });
  e.emit({ t: 'error', code: 'ROOM_PHOTO_BUSY', ref: 'photoStart' }); e.emit({ t: 'error', code: 'ROOM_PHOTO_BUSY', ref: 'chatSay' }); e.emit({ t: 'error', code: 'ROOM_PHOTO_BUSY' }); await tick();
  chk(settled === null, '다른 요청 · 다른 포트의 오류(ref 가 다름 · 없음)는 자리 잡기를 건드리지 않는다');
  e.fireTimer(e.R.OPEN_WAIT_MS); await p3;
  chk(settled && settled.reason === 'timeout' && e.last().t === 'photoLeave', '답이 안 오면 timeout + 서버에 자리를 놓는다(늦게 온 welcome 이 남의 자리를 막지 않게)');
  e.emit(WELCOME()); chk(e.sess.mySlot() === -1 && !e.sess.isHost(), '  늦게 온 photoWelcome 은 버린다');
  e = mk(S); const q1 = e.sess.open('ROOM1', { userCode: 'uA' }); const rid1 = e.sent[0].rid; e.fireTimer(e.R.OPEN_WAIT_MS); await q1;
  let q2res = null; const q2 = e.sess.open('ROOM1', { userCode: 'uA' }).then((r) => { q2res = r; });
  e.emit(WELCOME({ rid: rid1, slots: [{ userCode: 'uZ', name: '첫 답', fx: 1 }, null, null, null], meta: META({ host: 'uZ' }) })); await tick();
  chk(q2res === null && e.sess.mySlot() === -1, '★ 시간 초과 뒤 다시 열면 — 첫 요청의 늦은 photoWelcome(첫 rid)을 두 번째 답으로 받지 않는다(rid 짝짓기)');
  e.emit(WELCOME()); await q2;
  chk(q2res.ok === true && e.sess.mySlot() === 0, '  두 번째 답에서 자리를 잡는다');
  e = mk(S); const q3 = e.sess.open('ROOM1', { userCode: 'uA' }); const rid3 = e.sent[0].rid; e.fireTimer(e.R.OPEN_WAIT_MS); await q3;
  let q4res = null; const q4 = e.sess.open('ROOM1', { userCode: 'uA' }).then((r) => { q4res = r; });
  e.emit({ t: 'error', code: 'ROOM_PHOTO_BUSY', ref: 'photoOpen', rid: rid3 }); await tick();
  chk(q4res === null, '  첫 요청의 늦은 거절(첫 rid)도 두 번째 요청을 끝내지 않는다');
  e.emit(WELCOME()); await q4; chk(q4res.ok === true, '  두 번째 답은 정상으로 받는다');
  e = mk(S); const q5 = e.sess.open('ROOM1', { userCode: 'uA' }); e.fireTimer(e.R.OPEN_WAIT_MS); await q5; e.drop(); e.st.ready = true;
  const q6 = e.sess.open('ROOM1', { userCode: 'uA' }); e.emit(WELCOME()); chk((await q6).ok === true, '  연결이 끊겼다 붙으면 줄을 비운다(끊긴 연결에는 늦은 답이 오지 않는다)');
  e = mk(S, { offline: true });
  chk((await e.sess.open('ROOM1', { userCode: 'uA' })).reason === 'notReady', '연결이 없으면 notReady');
  e = mk(S, { sendFails: true });
  chk((await e.sess.open('ROOM1', { userCode: 'uA' })).reason === 'notReady', '보내기가 안 나가도 notReady(기다리다 timeout 이 되지 않게)');
  e = mk(S);
  chk((await e.sess.open('', { userCode: 'uA' })).reason === 'notInRoom' && (await e.sess.open('R', {})).reason === 'notInRoom' && (await e.sess.open('R')).reason === 'notInRoom' && e.sent.length === 0, '방 코드 · 내 코드가 없으면 보내지 않고 notInRoom');

  say('── 2. 자리가 바뀔 때');
  e = await opened(S, { me: 'uA', welcome: { slot: 0, slots: [{ userCode: 'uA', name: '나', fx: 1 }, { userCode: 'uB', name: '방장', fx: 1 }, null, null], meta: META({ host: 'uB' }) } });
  chk(e.sess.mySlot() === 0 && e.sess.hostSlot() === 1 && e.sess.isHost() === false && e.openRes.host === false, '★ 서버가 큰 번호(1번)를 방장으로 보내면 따른다 — 내가 0번이어도 방장이 아니다');
  await e.sess.close();
  e = await opened(S, { me: 'uB', welcome: { slot: 1, slots: [{ userCode: 'uA', name: '방장', fx: 1 }, { userCode: 'uB', name: '나', fx: 1 }, null, null], meta: META({ host: 'uA' }) } });
  e.emit({ t: 'photoPos', slot: 0, p: '-42,131' }); e.emit({ t: 'photoPos', slot: 3, p: '5,5' });
  chk(JSON.stringify(Object.keys(e.sess.peersNow())) === '["0"]' && e.sess.peersNow()[0].wx === -0.42 && e.sess.peersNow()[0].d === 1.31, '남의 좌표 photoPos → peers(자리 번호로) · 빈 자리의 좌표는 버린다');
  e.emit({ t: 'photoPos', slot: 1, p: '1,1' }); e.emit({ t: 'photoPos', slot: 0, p: 'rubbish' });
  chk(!e.sess.peersNow()[1] && e.sess.peersNow()[0].wx === -0.42, '  내 자리 번호의 좌표 · 읽을 수 없는 값은 버린다');
  e.emit({ t: 'photoSlots', slots: [null, { userCode: 'uB', name: '나', fx: 1 }, { userCode: 'uC', name: '새', fx: 1 }, null] });
  chk(e.sess.hostSlot() === -1 && e.sess.isHost() === false, '방장이 나간 직후 photoMeta 가 오기 전에는 앱이 방장을 지어내지 않는다(옛 meta.host 가 자리에 없음)');
  const nSl = e.cb.slots.length;
  e.emit({ t: 'photoMeta', meta: META({ host: 'uB' }) });
  chk(e.sess.hostSlot() === 1 && e.sess.isHost() === true && e.sess.mySlot() === 1, '서버가 photoMeta 로 새 방장(meta.host)을 보내면 내가 승계');
  chk(e.cb.slots.length === nSl + 1, '  방장이 바뀌면 onSlots 를 한 번 더 불러 화면이 다시 그린다');
  e.emit({ t: 'photoMeta', meta: META({ host: 'uB', filter: 'soft' }) });
  chk(e.cb.slots.length === nSl + 1, '  방장이 그대로면 onSlots 를 또 부르지 않는다');
  chk(!e.sess.peersNow()[0], '  나간 사람의 좌표는 치운다');
  const nPeers = e.cb.peers.length;
  e.emit({ t: 'photoMeta', meta: META({ host: 'uB', filter: 'fish' }) });
  chk(e.sess.metaNow().filter === 'fish' && e.cb.meta.length === 4 && e.cb.meta[3].filter === 'fish', 'photoMeta 통째로 갈아 끼움 → onMeta');
  e.emit({ t: 'photoFrames', frames: [null, 'https://x/1.webp', null, null] });
  chk(JSON.stringify(e.sess.framesNow()) === '{"1":"https://x/1.webp"}' && e.cb.frames.length === 2, 'photoFrames 통째로 → onFrames');
  e.emit({ t: 'photoEvent', slot: 2, k: 'jump', v: undefined, ts: 77 }); e.emit({ t: 'photoEvent', slot: 1, k: 'pose', v: 2, ts: 78 });
  chk(e.cb.event.length === 1 && e.cb.event[0][0] === 2 && e.cb.event[0][1].k === 'jump' && e.cb.event[0][1].v === null && e.cb.event[0][1].ts === 77, '남의 사건 → onEvent(자리, { k, v(없으면 null), ts }) · 내 것은 되받지 않는다');
  e.emit({ t: 'photoShot', n: 2, at: 99 });
  chk(e.cb.shot.length === 1 && e.cb.shot[0].n === 2 && e.cb.shot[0].at === 99, '셔터 photoShot → onShot({ n, at }) — 방장 자신도 받는다');
  const fresh = mk(S);
  ['photoSlots', 'photoMeta', 'photoFrames', 'photoPos', 'photoEvent', 'photoShot'].forEach((t) => fresh.emit({ t, slots: [], meta: META(), frames: [], slot: 1, p: '1,1', k: 'jump', n: 0, at: 1 }));
  chk(fresh.cb.slots.length + fresh.cb.meta.length + fresh.cb.frames.length + fresh.cb.event.length + fresh.cb.shot.length + fresh.cb.peers.length === 0, '세션에 들기 전에 온 것(옛 세션의 늦은 신호)은 전부 버린다');
  chk(nPeers >= 0, '  (좌표 알림은 자리가 바뀔 때도 한 번 — 화면 무대가 따라간다)');

  say('── 3. 방장 일');
  e = await opened(S, { me: 'uB', welcome: { slot: 1, slots: [{ userCode: 'uA', name: 'a', fx: 1 }, { userCode: 'uB', name: 'b', fx: 1 }, null, null], meta: META({ host: 'uA' }) } });
  const cfg = { orient: 'p', cuts: 4, basic: 'white', bg: 'white,sky', filter: 'fish', camH: 1.7, camP: 14 };
  const sentHost = [e.sess.setConfig(cfg), e.sess.setFilter('fish'), e.sess.setCam(1.7, 14), e.sess.setCut(0, 0), e.sess.setCut(1, 123), e.sess.setDone(), e.sess.setFrameUrl(0, 'https://x'), e.sess.fireShutter(1)];
  chk((await Promise.all(sentHost)).every((v) => v === false) && e.sent.length === 0, '방장이 아니면 어느 것도 보내지 않는다(false)');
  e = await opened(S);
  chk(await e.sess.setConfig(cfg) === true && JSON.stringify(e.last()) === JSON.stringify({ t: 'photoConfig', orient: 'p', cuts: 4, basic: 'white', bg: 'white,sky', filter: 'fish', camH: 1.7, camP: 14 }), '방장 setConfig → photoConfig 일곱 칸 그대로');
  chk(await e.sess.setConfig({ orient: 'p', cuts: 2, basic: 'none' }) === false && await e.sess.setConfig({ orient: 'l', cuts: 3, basic: 'none' }) === false, '  세로 2컷 · 가로 3컷은 먼저 거른다(서버는 통째로 거부 — 화면이 안내하게 false)');
  chk(await e.sess.setConfig(Object.assign({}, cfg, { bg: 'white,neon' })) === false && await e.sess.setConfig(Object.assign({}, cfg, { filter: 'toon' })) === false, '  모르는 뒷배경 · 목록에서 빠진 필터(toon)도 먼저 거른다');
  const n0 = e.sent.length;
  await e.sess.setConfig({ orient: 'l', cuts: 2, basic: 'none' });
  chk(e.sent.length === n0 + 1 && e.last().bg === 'white' && e.last().filter === 'none' && e.last().camH === e.P.CAM_HEIGHT && e.last().camP === e.P.CAM_PITCH && wireProblem(e.last()) === null, '  뒷배경 · 필터 · 카메라를 안 주면 기본값으로 채워 서버 모양을 지킨다');
  await e.sess.setFilter('mono'); chk(e.last().t === 'photoFilter' && e.last().filter === 'mono', 'setFilter → photoFilter(한 칸만 — 촬영 중에도 로비로 안 돌아간다)');
  const n1 = e.sent.length; chk(await e.sess.setFilter('toon') === false && await e.sess.setFilter('x') === false && e.sent.length === n1, '  모르는 필터는 안 보낸다');
  await e.sess.setCam(9, 99); chk(e.last().t === 'photoCam' && e.last().h === e.P.CAM_H_MAX && e.last().p === e.P.CAM_P_MAX, 'setCam → photoCam · 범위로 자른다(위)');
  await e.sess.setCam(-5, -5); chk(e.last().h === e.P.CAM_H_MIN && e.last().p === e.P.CAM_P_MIN, '  범위로 자른다(아래)');
  await e.sess.setCut(2, 0); chk(JSON.stringify(e.last()) === '{"t":"photoCut","i":2,"at":0}', 'setCut(i, 0) → at 0 = «기다리는 중»');
  await e.sess.setCut(3, 1234567890123); chk(JSON.stringify(e.last()) === '{"t":"photoCut","i":3,"at":1}', 'setCut(i, 시각) → at 1(서버가 지금 시각을 찍는다 — 앱 시계를 싣지 않는다)');
  await e.sess.setDone(); chk(e.last().t === 'photoDone', 'setDone → photoDone');
  await e.sess.setFrameUrl(1, 'https://x/f.webp'); chk(JSON.stringify(e.last()) === '{"t":"photoFrame","i":1,"url":"https://x/f.webp"}', 'setFrameUrl → photoFrame');
  await e.sess.setFrameUrl(1, null); chk(e.last().url === null, '  지우기는 url null');
  await e.sess.fireShutter(3); chk(JSON.stringify(e.last()) === '{"t":"photoShutter","n":3}', 'fireShutter → photoShutter');
  chk(e.sent.every((m) => wireProblem(m) === null), '  보낸 것 전부 서버 모양(허용 목록 · 범위)을 지킨다 — ' + (e.sent.map(wireProblem).filter(Boolean)[0] || '문제 없음'));
  e.emit({ t: 'error', code: 'ROOM_PHOTO_NOT_HOST', ref: 'photoConfig' }); e.emit({ t: 'error', code: 'badRequest', ref: 'photoFrame' });
  chk(e.cb.refused.length === 2 && e.cb.refused[0].ref === 'photoConfig' && e.cb.refused[0].code === 'ROOM_PHOTO_NOT_HOST' && e.cb.refused[1].ref === 'photoFrame', '서버가 방장 일을 거절하면 onRefused({ ref, code }) — 화면이 알린다(조용히 삼키지 않는다)');
  e.emit({ t: 'error', code: 'ROOM_PHOTO_NOT_HOST', ref: 'chatClear' });
  chk(e.cb.refused.length === 2 && e.sess.mySlot() === 0, '  다른 포트의 오류는 이 포트 밖');

  say('── 4. 촬영 시작');
  e = await opened(S, { me: 'uB', welcome: { slot: 1, slots: [{ userCode: 'uA', name: 'a', fx: 1 }, { userCode: 'uB', name: 'b', fx: 1 }, null, null], meta: META({ host: 'uA' }) } });
  let r = await e.sess.start();
  chk(r.ok === false && r.reason === 'not-host' && e.sent.length === 0 && /방장이 바뀌었을/.test(r.message), '방장이 아니면 보내지 않고 not-host + 까닭');
  e = await opened(S);
  const seen = []; const off = e.sess.watchQuota((q) => seen.push(q));
  const ps = e.sess.start();
  chk(e.last().t === 'photoStart' && wireProblem(e.last()) === null, '방장 start → photoStart');
  chk((await e.sess.start()).reason === 'error', '  답을 기다리는 동안 또 누르면 거절(정원을 두 번 쓰지 않게)');
  e.emit({ t: 'photoStarted', nth: 5, left: 395 });
  r = await ps;
  chk(r.ok === true && r.n === 5 && r.left === 395 && r.nth === '5번째 · 395회 남음', 'photoStarted → ok · 몇 번째 · 남은 횟수 문구');
  chk(seen.length === 1 && seen[0].label === '395 / 400' && seen[0].cap === 400 && seen[0].used === 5 && seen[0].ok === true, '  정원 보는 창은 GET 없이 바로 갱신(상한 = nth + left)');
  const sysFail = async (code) => { const m = await opened(S); const pp = m.sess.start(); m.emit({ t: 'error', code, ref: 'photoStart' }); return [await pp, m]; };
  let [rr] = await sysFail('ROOM_PHOTO_QUOTA_EXHAUSTED');
  chk(rr.ok === false && rr.reason === 'closed' && /문을 닫았어요/.test(rr.message) && /내일 다시 열려요/.test(rr.message) && rr.reopenAt === null, '거절 QUOTA_EXHAUSTED → closed · 정원 답을 한 번도 못 받았으면 시각 없이 «내일 다시» (앱이 날짜를 세지 않는다 — D7)');
  {
    const m = await opened(S, { mk: { getRes: QUOTA({ reopenAt: '2026-03-16T15:00:00Z' }) } });   // 서버가 준 시각이 곧 문구 — 앱 계산이 아니다(일부러 하루 뒤 값)
    await m.sess.checkQuota();
    const pp = m.sess.start(); m.emit({ t: 'error', code: 'ROOM_PHOTO_QUOTA_EXHAUSTED', ref: 'photoStart' });
    const r2 = await pp;
    chk(r2.reason === 'closed' && r2.reopenAt === Date.parse('2026-03-16T15:00:00Z') && /내일 0시에 열려요/.test(r2.message), '★ D7 — 다 씀 거절 문구는 마지막으로 받은 정원 답의 reopenAt 에서 온다');
  }
  [rr] = await sysFail('ROOM_PHOTO_QUOTA_UNAVAILABLE');
  chk(rr.reason === 'unavailable' && rr.message === e.R.START_MESSAGES.unavailable && /정원을 확인할 수 없어요/.test(rr.message), '거절 QUOTA_UNAVAILABLE → unavailable · 정원을 못 물었다는 까닭(닫힘과 다르다)');
  [rr] = await sysFail('ROOM_PHOTO_NOT_HOST');
  chk(rr.reason === 'not-host' && /방장이 바뀌었을/.test(rr.message), '거절 NOT_HOST → not-host · 방장이 바뀌었을 수 있다는 까닭');
  let m2; [rr, m2] = await sysFail('notInRoom');
  chk(rr.reason === 'notInRoom' && /창을 닫았다 다시 열어/.test(rr.message) && m2.sess.mySlot() === -1, '거절 notInRoom → 까닭 + 자리를 잃음');
  [rr] = await sysFail('badRequest');
  chk(rr.reason === 'error' && rr.message === e.R.START_MESSAGES.error, '그 밖의 코드 → error · 일반 까닭');
  chk(new Set(Object.values(e.R.START_MESSAGES)).size >= 4 && Object.values(e.R.START_MESSAGES).every((s) => typeof s === 'string' && s.length > 8), '까닭 문구는 비지 않고 서로 다르다(닫힘은 날짜가 들어가 따로)');
  e = await opened(S); const pt = e.sess.start(); e.fireTimer(e.R.START_WAIT_MS); r = await pt;
  chk(r.reason === 'timeout' && !!r.message, '답이 안 오면 timeout + 까닭');
  const ridS1 = e.sent.filter((m) => m.t === 'photoStart')[0].rid;
  const pt2 = e.sess.start();
  chk(e.sent.filter((m) => m.t === 'photoStart')[1].rid !== ridS1, '  시작마다 다른 rid');
  e.emit({ t: 'photoStarted', nth: 1, left: 399, rid: ridS1 });
  chk(e.cb.late.length === 1, '★ 시간 초과 뒤 늦게 photoStarted 가 오면(서버는 촬영 시작 · 정원 씀) 방장 화면이 이어 가도록 onLateStart 를 한 번 부른다');
  e.emit({ t: 'photoStarted', nth: 2, left: 398 });
  chk((await pt2).ok === true && pt2 !== undefined && e.cb.late.length === 1, '  시간 초과 뒤에는 다시 누를 수 있고, 늦은 답(첫 rid)이 다음 요청의 답으로 읽히지 않는다(rid 짝짓기)');
  e = await opened(S); const pt3 = e.sess.start(); e.fireTimer(e.R.START_WAIT_MS); await pt3;
  e.emit({ t: 'photoMeta', meta: META({ state: 'shooting', startedAt: 5 }) }); e.emit({ t: 'photoStarted', nth: 3, left: 397 });
  chk(e.cb.late.length === 1, '★ 시간 초과 뒤 photoMeta 가 shooting 이면 그때 이어 간다 — 뒤따르는 photoStarted 로 두 번 부르지 않는다');
  e = await opened(S); const pt4 = e.sess.start(); e.fireTimer(e.R.START_WAIT_MS); await pt4;
  e.emit({ t: 'photoMeta', meta: META({ state: 'shooting' }) });
  chk(e.cb.late.length === 1, '  photoStarted 를 못 받아도 shooting 판만으로 이어 간다');
  e = await opened(S); e.emit({ t: 'photoMeta', meta: META({ state: 'shooting' }) }); e.emit({ t: 'photoStarted', nth: 1, left: 399 });
  chk(e.cb.late.length === 0, '  시간 초과가 없었으면(정상) 부르지 않는다');
  e = await opened(S, { me: 'uB', welcome: { slot: 1, slots: [{ userCode: 'uA', name: 'a', fx: 1 }, { userCode: 'uB', name: 'b', fx: 1 }, null, null], meta: META({ host: 'uA' }) } });
  e.emit({ t: 'photoMeta', meta: META({ host: 'uA', state: 'shooting' }) }); e.emit({ t: 'photoStarted', nth: 1, left: 399 });
  chk(e.cb.late.length === 0, '  방장이 아닌 사람은 부르지 않는다');
  /* 혼자 있던 방장이 시작 시간 초과 뒤 창을 닫았다 — 서버는 세션을 지워 그 start 에 답을 안 준다. 줄에 남은 stale 이 다음 열기를 가로채면 안 된다 */
  e = await opened(S); const lg = e.sess.start(); e.fireTimer(e.R.START_WAIT_MS); await lg; await e.sess.close();
  const lg2 = e.sess.open('ROOM1', { userCode: 'uA' }); e.emit(WELCOME()); await lg2;
  let lgRes = null; e.sess.start().then((r) => { lgRes = r; });
  e.emit({ t: 'photoMeta', meta: META({ state: 'shooting' }) }); e.emit({ t: 'photoStarted', nth: 2, left: 398 }); await tick();
  chk(e.cb.late.length === 0 && lgRes && lgRes.ok === true && lgRes.n === 2, '★ 시작 시간 초과 → 창 닫기 → 다시 열기 → 시작: 새 요청이 photoStarted 를 받고 onLateStart 는 0번(옛 stale 이 가로채지 않는다)');
  e = await opened(S); const lg3 = e.sess.start(); e.fireTimer(e.R.START_WAIT_MS); await lg3; await e.sess.close();
  const lg4 = e.sess.open('ROOM1', { userCode: 'uA' }); e.emit(WELCOME()); await lg4;
  let lgEx = null; e.sess.start().then((r) => { lgEx = r; }); e.emit({ t: 'error', code: 'ROOM_PHOTO_QUOTA_EXHAUSTED', ref: 'photoStart' }); await tick();
  chk(lgEx && lgEx.reason === 'closed' && /문을 닫았어요/.test(lgEx.message), '  같은 흐름에서 정원 소진 거절은 새 요청이 «문 닫음» 으로 받는다');
  e = await opened(S); const lg5 = e.sess.start(); let lg5r = null; lg5.then((r) => { lg5r = r; }); await e.sess.close(); await tick();
  chk(lg5r && lg5r.ok === false, '  기다리던 시작은 창을 닫으면 실패로 풀린다(영영 안 끝나지 않는다)');
  e = mk(S); let o1r = null; e.sess.open('ROOM1', { userCode: 'uA' }).then((r) => { o1r = r; }); await e.sess.close(); await tick();
  e.emit(WELCOME()); await tick();
  chk(o1r && o1r.ok === false && e.sess.mySlot() === -1 && !e.sess.isHost(), '★ 자리 잡는 중 닫으면 기다리던 open 은 풀리고, 뒤늦은 welcome 이 세션을 다시 켜지 않는다');
  chk(e.sent.filter((m) => m.t === 'photoLeave').length === 1, '★ 자리 잡는 중 닫으면 서버에 photoLeave 를 보내 자리가 남지 않게 한다(한 번)');
  e = await opened(S); const lg6 = e.sess.start(); e.fireTimer(e.R.START_WAIT_MS); await lg6; e.emit({ t: 'error', code: 'notInRoom', ref: 'photoPos' }); await tick();
  const lg7 = e.sess.open('ROOM1', { userCode: 'uA' }); e.emit(WELCOME()); await lg7;
  e.emit({ t: 'photoMeta', meta: META({ state: 'shooting' }) });
  chk(e.cb.late.length === 0, '  자리를 잃은(방 밖 답) 뒤 다시 열어도 옛 시작 stale 이 남아 이어 가지 않는다');
  e = await opened(S); const ps5 = e.sess.start(); e.fireTimer(e.R.START_WAIT_MS); await ps5;
  const ridP1 = e.sent.filter((m) => m.t === 'photoStart')[0].rid;
  const ps6 = e.sess.start(); e.emit({ t: 'error', code: 'ROOM_PHOTO_NOT_HOST', ref: 'photoStart', rid: ridP1 });
  e.emit({ t: 'photoStarted', nth: 4, left: 396 });
  chk((await ps6).ok === true && e.cb.late.length === 0, '  옛 시작(옛 rid)의 늦은 오류가 먼저 와도 새 시작을 끝내지 않는다 — 새 시작은 제 rid 의 답으로 이어진다');
  e = await opened(S, { mk: {} }); e.hub.send = () => false; r = await e.sess.start();
  chk(r.reason === 'notReady' && /연결된 뒤/.test(r.message), '연결이 없으면 notReady');
  e = await opened(S, { me: 'uB', welcome: { slot: 1, slots: [{ userCode: 'uA', name: 'a', fx: 1 }, { userCode: 'uB', name: 'b', fx: 1 }, null, null], meta: META({ host: 'uA' }) } });
  e.sess.watchQuota((q) => seen.push(q)); const k = seen.length; e.emit({ t: 'photoStarted', nth: 6, left: 394 });
  chk(seen.length === k + 1 && seen[k].label === '394 / 400', '방장이 아니어도 photoStarted 로 내 정원 칸이 갱신된다(시작은 resolve 하지 않음)');
  off(); const k2 = seen.length; e = await opened(S); e.sess.watchQuota(() => {})(); e.emit({ t: 'photoStarted', nth: 1, left: 399 });
  chk(seen.length === k2, '  창을 닫아 푼 구독은 더 안 받는다');
  [rr] = await sysFail('ROOM_PHOTO_NOT_HOST');
  chk(rr.ok === false, '  (촬영 시작 거절은 항상 ok:false)');

  say('── 5. 좌표 · 사건 보내기');
  e = await opened(S);
  chk(e.sess.sendPos(1.0, 3.0) === true && e.last().t === 'photoPos' && e.last().p === '100,300' && wireProblem(e.last()) === null, '첫 좌표는 보낸다 · 서버 모양');
  chk(e.sess.sendPos(1.0, 3.0) === false, '★ 똑같은 자리는 안 보낸다');
  e.st.clock += 120; chk(e.sess.sendPos(1.0005, 3.0005) === false, '★ 눈에 안 보이는 움직임은 안 보낸다(데드밴드)');
  e.st.clock += 120; chk(e.sess.sendPos(1.2, 3.0) === true, '실제로 움직이면 보낸다');
  chk(e.sess.sendPos(9.9, 9.9) === false, '★ 100ms 안에는 아무리 움직여도 안 보낸다(10Hz)');
  chk(e.sess.sendPos(1.2, 3.0, true) === true, '★ force(셔터 직전)는 데드밴드도 간격도 무시한다');
  e.st.clock += 120; const n2 = e.sent.length;
  for(let i = 0; i < 20; i++){ e.st.clock += 120; e.sess.sendPos(1.2, 3.0, false, i / 20, -i / 20); }
  chk(e.sent.length === n2, '★ 시선만 바뀌면 한 번도 안 보낸다(마우스를 흔들어도 메시지가 안 는다)');
  e.st.clock += 120; e.sess.sendPos(1.6, 3.0, false, 0.3, -0.2, 1.5);
  chk(e.last().p === '160,300,30,-20,75' && wireProblem(e.last()) === null, '움직이면 시선 · 몸 회전이 함께 실려 가고 서버 길이 상한(24) 안이다');
  const worst = (() => { e.st.clock += 120; e.sess.sendPos(-2.24, 5.4, true, -1, -1, -Math.PI); return e.last(); })();
  chk(worst.p.length <= 24 && wireProblem(worst) === null, '  가장 긴 좌표도 상한 안 — ' + worst.p);
  chk(e.sess.sendEvent('jump') === true && JSON.stringify(e.last()) === '{"t":"photoEvent","k":"jump","v":null}', '점프 = 사건 한 번(v null)');
  chk(e.sess.sendEvent('pose', 2) === true && e.last().v === 2 && e.sess.sendEvent('blink', 1) === true && e.sent.slice(-3).every((m) => wireProblem(m) === null), '포즈 · 눈 감기 — 값이 실린다');
  const q = mk(S, { sendFails: false }); q.sess.sendPos(1, 1);
  chk(q.sess.sendPos(1, 1) === false && q.sess.sendEvent('jump') === false && q.sent.length === 0, '세션에 들기 전에는 아무것도 안 보낸다');
  e = await opened(S); e.st.ready = true; const realSend = e.hub.send; e.hub.send = () => false;
  chk(e.sess.sendPos(2, 2) === false && e.sess.sendEvent('jump') === false, '연결이 막혀 못 보냈으면 false');
  e.hub.send = realSend; chk(e.sess.sendPos(2, 2) === true, '  못 보낸 좌표는 «보낸 것» 으로 기억하지 않는다(풀리면 바로 나간다)');

  say('── 6. 자리를 잃을 때');
  e = await opened(S);
  e.cb.slots.length = 0; e.drop();
  chk(e.sess.mySlot() === -1 && e.sess.hostSlot() === -1 && !e.sess.isHost() && JSON.stringify(e.sess.slotsNow()) === '{}', '연결이 끊기면 세션을 버린다(자리 · 방장 · 판 · 좌표)');
  chk(e.cb.slots.length === 1 && e.cb.slots[0] === '{}', '  onSlots({}) 로 화면에 알린다 — 화면이 «자리를 잃었어요» 를 한 번 띄운다');
  e.st.ready = true; const n3 = e.sent.length;
  chk(e.sess.sendPos(1, 1) === false && e.sess.sendEvent('jump') === false && await e.sess.setCut(0, 0) === false && e.sent.length === n3, '★ 다시 붙어도 혼자 들어가지 않는다 · 아무것도 안 보낸다(0.13: 실패 뒤 되풀이 금지)');
  e.emit({ t: 'photoSlots', slots: [{ userCode: 'uA', name: 'a', fx: 1 }, null, null, null] });
  chk(e.sess.mySlot() === -1, '  옛 세션의 늦은 알림은 버린다');
  const pOpen = e.sess.open('ROOM1', { userCode: 'uA' }); e.emit(WELCOME()); chk((await pOpen).ok === true && e.sess.isHost(), '  창을 닫았다 다시 열면(open) 서버가 같은 자리를 돌려주는 대로 다시 선다');
  e = await opened(S); e.emit({ t: 'error', code: 'notInRoom', ref: 'photoPos' });
  chk(e.sess.mySlot() === -1 && e.cb.slots.slice(-1)[0] === '{}', '서버가 «방 밖» 이라고 답하면(photoPos 도) 자리를 잃은 것');
  e = await opened(S); e.emit({ t: 'error', code: 'notInRoom', ref: 'chatSay' }); chk(e.sess.mySlot() === 0, '  다른 포트의 notInRoom 은 건드리지 않는다');
  e = mk(S); const po = e.sess.open('ROOM1', { userCode: 'uA' }); e.drop();
  chk((await po).reason === 'notReady', '기다리던 자리 잡기는 연결이 끊기면 notReady 로 접는다');
  e = await opened(S); const ps2 = e.sess.start(); e.drop(); r = await ps2;
  chk(r.reason === 'notReady' && /연결된 뒤/.test(r.message), '기다리던 촬영 시작도 접는다');
  e = await opened(S); await e.sess.close();
  chk(e.sent.length === 1 && JSON.stringify(e.sent[0]) === '{"t":"photoLeave"}' && e.sess.mySlot() === -1 && !e.sess.isHost(), '닫기 → photoLeave 한 번 · 세션을 비운다');
  await e.sess.close(); await e.sess.release(); chk(e.sent.length === 1, '  이미 비었으면 또 보내지 않는다(release 는 같은 일)');
  e = await opened(S); await e.sess.release(); chk(e.last().t === 'photoLeave', '꾸미기로 넘어갈 때 release → 자리를 놓는다(다음 사람이 방장이 된다)');

  e = await opened(S); e.sess.reset();
  chk(e.sess.mySlot() === -1 && !e.sess.isHost() && Object.keys(e.sess.slotsNow()).length === 0 && e.sess.metaNow() === null, '★ 계정이 바뀌면(reset) 세션 · 자리 · 판을 비운다 — 다음 계정이 앞 계정의 사진 세션을 물려받지 않는다');

  say('── 7. 정원');
  e = mk(S, { getRes: QUOTA() });
  let qv = await e.sess.checkQuota();
  chk(e.gets.length === 1 && e.gets[0][0] === '/v2/rooms/photo-quota' && e.gets[0][1].auth === true, 'GET /v2/rooms/photo-quota(로그인 통로)');
  chk(qv.ok && qv.left === 395 && qv.used === 5 && qv.cap === 400 && qv.label === '395 / 400' && qv.message === '' && qv.reopenAt === Date.parse('2026-03-15T15:00:00Z'), '  { ok, left, used, cap, label, 다시 여는 시각(서버 값), message }');
  e = mk(S, { getRes: QUOTA({ left: 0, used: 400 }) }); qv = await e.sess.checkQuota();
  chk(qv.ok === false && qv.left === 0 && qv.label === '0 / 400' && /문을 닫았어요/.test(qv.message), '다 썼으면 ok:false + 닫힘 문구(0회 남음)');
  for(const [name, bad] of [['null', null], ['빈 객체', {}], ['cap 없음', { left: 3 }], ['cap 0', { cap: 0, left: 0 }], ['left 가 글자', { cap: 400, left: '3' }], ['left NaN', { cap: 400, left: NaN }], ['문자열', 'x']]){
    e = mk(S, { getRes: bad }); let threw = false; try{ await e.sess.checkQuota(); }catch(_){ threw = true; }
    chk(threw, '못 읽음 ≠ 0회 남음 — 답 모양이 틀리면(' + name + ') 던진다');
  }
  e = mk(S, { getErr: new Error('offline') }); let threw2 = false; try{ await e.sess.checkQuota(); }catch(_){ threw2 = true; }
  chk(threw2, '닿지 못하면 던진다(화면이 «지금은 확인할 수 없어요»)');
  const V = e.R.quotaView, P = e.P, RO = '2026-03-15T15:00:00Z';
  chk(V({ cap: 400, left: 900, reopenAt: RO }, P).left === 400 && V({ cap: 400, left: -4, reopenAt: RO }, P).left === 0 && V({ cap: 400, left: 0, reopenAt: RO }, P).ok === false && V({ cap: 400, left: 1, reopenAt: RO }, P).ok === true, '경계값 — 남은 수는 0~cap 으로 자른다 · 1 이면 열림 · 0 이면 닫힘');
  chk(V({ cap: 400, left: 7, reopenAt: RO }, P).used === 393, '  used 가 없으면 cap - left');
  for(const bad of [undefined, null, 'x', {}]){ let th = false; try{ V({ cap: 400, left: 7, reopenAt: bad }, P); }catch(_){ th = true; } chk(th, '★ D7 — 여는 시각(reopenAt)이 없거나 못 읽으면 던진다(앱이 다음 한국 자정을 셈하지 않는다): ' + JSON.stringify(bad)); }
  e = await opened(S, { mk: { getRes: QUOTA({ left: 12, used: 388 }) } });
  const got = []; const unwatch = e.sess.watchQuota((v) => got.push(v));
  e.notify(); await tick();
  chk(e.gets.length === 1 && got.length === 1 && got[0].left === 12, '알림 photoQuota → 보는 창이 있으면 GET 한 번 → 숫자 갱신');
  e.notify(); await tick(); chk(e.gets.length === 2 && got.length === 2, '  알림마다 한 번(주기 요청이 아니다)');
  unwatch(); e.notify(); await tick(); chk(e.gets.length === 2 && got.length === 2, '  구독을 풀면 값도 GET 도 없다');
  e = await opened(S, { mk: { getRes: QUOTA() } }); e.notify(); await tick(); chk(e.gets.length === 0, '  보는 창이 없으면 GET 도 안 한다');
  e = mk(S, { getRes: QUOTA() }); e.sess.watchQuota(() => {}); e.notify(); await tick(); chk(e.gets.length === 0, '  세션에 들기 전의 알림도 무시');
  e = await opened(S, { mk: { getErr: new Error('x') } }); const g2 = []; e.sess.watchQuota((v) => g2.push(v)); e.notify(); await tick();
  chk(g2.length === 0 && e.warns.length === 1 && e.gets.length === 1, '  다시 읽기에 실패하면 숫자를 두고 경고만(혼자 되풀이하지 않는다)');

  say('── 8. 서버 규약 대조 · 배선');
  const handled = Object.keys(mk(S).fns).sort();
  const HUBX = load(S.HUB);
  chk(['photoFrames', 'photoMeta', 'photoPos', 'photoShot', 'photoSlots', 'photoStarted', 'photoWelcome', 'photoEvent', 'error'].every((t) => handled.indexOf(t) >= 0), '받는 메시지 — 서버가 보내는 photo* 여덟 + error 를 모두 건다');
  chk(handled.every((t) => HUBX.MESSAGE_TYPES.indexOf(t) >= 0), '  걸어 둔 이름이 전부 rt-hub 가 흘려 주는 종류다(없는 이름이면 허브가 던진다)');
  chk(HUBX.KINDS.indexOf('photoQuota') >= 0 && Object.keys(mk(S).kinds).join() === 'photoQuota', '  알림은 photoQuota 하나 — rt-hub 알림 종류 표에 있다');
  chk(e.R.PHOTO_REFS.every((t) => wireProblem(t === 'photoCut' ? { t, i: 0, at: 0 } : t === 'photoFrame' ? { t, i: 0, url: null } : t === 'photoPos' ? { t, p: '1,1' } : t === 'photoEvent' ? { t, k: 'jump' } : t === 'photoShutter' ? { t, n: 0 } : t === 'photoFilter' ? { t, filter: 'none' } : t === 'photoCam' ? { t, h: 1, p: 1 } : t === 'photoConfig' ? { t, orient: 'p', cuts: 4, basic: 'none', bg: 'white', filter: 'none', camH: 1, camP: 1 } : { t }) === null) && e.R.PHOTO_REFS.length === 12, '  보내는 이름 열둘 모두 서버가 아는 메시지');
  const Pn = e.P;
  chk(Pn.filterList().every((f) => WIRE.filters.indexOf(f.id) >= 0) && Pn.bgList().every((b) => WIRE.bgs.indexOf(b.id) >= 0) && Pn.bgList().length === WIRE.bgs.length, '앱의 필터 · 뒷배경 목록은 서버 허용 목록 안(뒷배경은 여섯 모두)');
  chk(['p', 'l'].every((o) => [1, 2, 3, 4].every((n) => Pn.cutAllowed(o, n) === (WIRE.cuts[o].indexOf(n) >= 0))), '컷 수 허용 표(세로 1·4 / 가로 1·2·4)가 서버와 같다');
  chk(Pn.MAX_SLOTS === WIRE.slots && Pn.CAM_H_MIN === WIRE.camH[0] && Pn.CAM_H_MAX === WIRE.camH[1] && Pn.CAM_P_MIN === WIRE.camP[0] && Pn.CAM_P_MAX === WIRE.camP[1], '자리 수 · 카메라 범위가 서버와 같다');
  chk(Pn.encPos(-2.24, 5.4, -1, -1, -Math.PI).length <= WIRE.posMax && WIRE.posRe.test(Pn.encPos(0.5, 1.2, 0.3, -0.2, 1)), '좌표 인코딩이 서버 모양 · 길이 상한 안');
  const h = S.HTML, at = (f) => h.indexOf('<script src="parts/' + f + '"></script>');
  chk(at('purikura/purikura-rt.js') > at('purikura/purikura-net.js') && at('purikura/purikura-rt.js') > at('realtime/rt-hub.js') && at('app.js') > at('purikura/purikura-rt.js'), 'html — rt-hub · purikura-net → purikura-rt → app.js');
}
/* 기다리는 약속이 영영 안 풀리면 노드가 조용히 0 으로 끝난다 — 시간 안에 못 끝난 판정은 빨강으로 센다 */
const JUDGE_MS = 3000;
const judged = (S) => new Promise((res, rej) => { const h = setTimeout(() => rej(new Error('판정이 ' + JUDGE_MS + 'ms 안에 안 끝났다')), JUDGE_MS); judge(S).then((v) => { clearTimeout(h); res(v); }, (e) => { clearTimeout(h); rej(e); }); });
let finished = false;
process.on('exit', (c) => { if(!finished && c === 0){ console.log('✗ 검사가 끝까지 돌지 못했다(기다리는 약속이 안 풀림)'); process.exitCode = 1; } });
(async () => {
  try{ await judged(SRC0); }catch(e){ chk(false, '판정을 끝까지 못 돌았다 — ' + (e && e.message)); }
  say('── 9. 깨 보기');
  const BREAKS = [
    ['RT', "e.timer = tSet(() => {\n        /* 늦게 도착할", "e.timer = tSet(() => { if(1) return;\n        /* 늦게 도착할", '시간 초과를 접지 않음'],
    ['RT', "        hub.send({ t: 'photoLeave' });\n      }, OPEN_WAIT_MS)", "      }, OPEN_WAIT_MS)", '시간 초과 때 자리를 안 놓음'],
    ['RT', "ROOM_PHOTO_FULL: 'full'", "ROOM_PHOTO_FULL: 'busy'", '자리 다 찬 까닭이 틀림'],
    ['RT', "ROOM_PHOTO_BUSY: 'busy'", "ROOM_PHOTO_BUSY: 'full'", '촬영 중 까닭이 틀림'],
    ['RT', "if(host && v.uid === host) hostSlot = i;", "if(hostSlot < 0) hostSlot = i;", '앱이 다시 작은 번호를 방장으로 계산'],
    ['RT', "    if(hostSlot !== before) onSlots(slots);", "", '방장이 바뀌어도 화면에 안 알림'],
    ['RT', "const hostSend = (msg) => Promise.resolve(isHost() ? !!hub.send(msg) : false);", "const hostSend = (msg) => Promise.resolve(!!hub.send(msg));", '방장 아니어도 보냄'],
    ['RT', "if(!P.cutAllowed(cfg.orient, cfg.cuts)) return Promise.resolve(false);", "", '세로 2컷을 안 거름'],
    ['RT', "function setCut(i, atMs){ return hostSend({ t: 'photoCut', i: i | 0, at: atMs === 0 ? 0 : 1 }); }", "function setCut(i, atMs){ return hostSend({ t: 'photoCut', i: i | 0, at: atMs }); }", '앱 시계를 서버에 실음'],
    ['RT', "if(liveOf('start')) return Promise.resolve(startFail('error'));", "", '촬영 시작을 겹쳐 보냄'],
    ['RT', "const o = (typeof m.rid === 'string') ? pending.get(m.rid) : null;", "const o = Array.from(pending.values()).find((x) => x.kind === 'open') || null;", 'welcome 을 rid 가 아니라 «지금 기다리는 open» 에 짝지음'],
    ['RT', "const was = inSession || !!liveOf('open');", "const was = inSession;", '자리 잡는 중 닫아도 photoLeave 를 안 보냄'],
    ['RT', "      pending.delete(e.rid); tClear(e.timer);\n      if(!e.stale) e.res(e.kind === 'open' ? { ok: false, reason: 'error' } : startFail('error'));", "      tClear(e.timer);\n      if(!e.stale) e.res(e.kind === 'open' ? { ok: false, reason: 'error' } : startFail('error'));", 'close 가 기다리던 요청을 안 지움(늦은 답이 되살아남)'],
    ['RT', "  function lose(){\n    dropWaiting();", "  function lose(){", '자리를 잃어도 시작 줄을 안 비움'],
    ['RT', "const h = (typeof m.rid === 'string') ? pending.get(m.rid) : null;   // rid 는", "const h = Array.from(pending.values()).find((x) => x.kind === 'start' && !x.stale) || null;   // rid 는", 'photoStarted 를 rid 가 아니라 «지금 기다리는 start» 에 짝지음'],
    ['RT', "const w = (typeof m.rid === 'string') ? pending.get(m.rid) : null;   // rid 달린 오류는", "const w = Array.from(pending.values()).find((x) => x.kind === (m.ref === 'photoOpen' ? 'open' : 'start')) || null;   // rid 달린 오류는", '오류를 rid 가 아니라 «지금 기다리는 것» 에 짝지음'],
    ['RT', "const newRid = () => 'p' + (++ridSeq).toString(36);", "const newRid = () => 'p1';", '요청마다 같은 rid'],
    ['RT', "if(h.stale){ pending.delete(h.rid); if(inSession && isHost()) lateStart(h); return; }", "if(h.stale){ pending.delete(h.rid); return; }", '늦은 photoStarted 로 이어 가지 않음'],
    ['RT', "if(meta && meta.state === 'shooting' && isHost()) lateStart();", "", 'shooting 판으로 이어 가지 않음'],
    ['RT', "    e.fired = true;\n", "", '이어 가기를 두 번 부름'],
    ['RT', "if(!e.stale) e.res(e.kind === 'open' ? { ok: false, reason: 'notReady' }", "if(false) e.res(e.kind === 'open' ? { ok: false, reason: 'notReady' }", '끊겨도 기다리던 요청을 안 풂'],
    ['RT', "ROOM_PHOTO_QUOTA_UNAVAILABLE: 'unavailable'", "ROOM_PHOTO_QUOTA_UNAVAILABLE: 'closed'", '정원 못 묻기를 닫힘으로 읽음'],
    ['RT', "reason === 'closed' ? P.closedMessage(lastReopenAt) : (START_MESSAGES[reason] || START_MESSAGES.error)", "P.closedMessage(lastReopenAt)", '모든 시작 실패를 «문 닫음» 으로'],
    ['RT', "if(!hub.send({ t: 'photoPos', p: P.encPos(wx, d, gz, gp, yaw) })) return false;\n    lastSent = { wx, d, t };", "lastSent = { wx, d, t };\n    hub.send({ t: 'photoPos', p: P.encPos(wx, d, gz, gp, yaw) });", '못 보낸 좌표를 보낸 것으로 기억'],
    ['RT', "if(t - lastSent.t < P.SEND_MIN_MS) return false;", "", '10Hz 상한 없음'],
    ['RT', "if(lastSent.wx !== null && Math.abs(wx - lastSent.wx) < P.DEAD_X && Math.abs(d - lastSent.d) < P.DEAD_D) return false;", "", '안 움직여도 보냄'],
    ['RT', "    if(hub.isReady()) return;\n    for(const e of Array.from(pending", "    return;\n    for(const e of Array.from(pending", '연결 끊김을 모름'],
    ['RT', "    if(m.code === 'notInRoom'){ lose(); return; }", "", '방 밖 답에도 자리를 안 버림'],
    ['RT', "if(inSession && HOST_REFS.indexOf(m.ref) >= 0) onRefused", "if(false) onRefused", '방장 일 거절을 삼킴'],
    ['RT', "if(!d || typeof d !== 'object' || !(d.cap > 0) || typeof d.left !== 'number' || !isFinite(d.left) || msOf(d.reopenAt) === null) throw", "if(!d) throw", '정원 답 검사 약화'],
    ['RT', "const cap = d.cap | 0, left = Math.max(0, Math.min(cap, d.left | 0));", "const cap = d.cap | 0, left = d.left | 0;", '남은 수를 안 자름'],
    ['RT', "if(!inSession || !quotaFns.length) return;", "if(!quotaFns.length) return;", '세션 밖에서도 정원을 읽음'],
    ['RT', "(e) => warn('[스티커사진] 정원을 다시 못 읽었어요', e)", "(e) => { warn('x'); return checkQuota(); }", '정원 다시 읽기 실패 뒤 되풀이'],
    ['RT', "if(was) hub.send({ t: 'photoLeave' });", "hub.send({ t: 'photoLeave' });", '비었는데도 photoLeave'],
    ['RT', "if(!inSession || m.slot === slot || !slots[m.slot]) return;", "if(!inSession || m.slot === slot) return;", '빈 자리 좌표를 받음'],
    ['RT', "if(inSession && m.slot !== slot) onEvent", "if(inSession) onEvent", '내 사건을 되받음'],
    ['RT', "bg: cfg.bg || 'white', filter: cfg.filter || 'none',", "bg: cfg.bg, filter: cfg.filter,", '기본값을 안 채움'],
    ['NET', "var MAX_SLOTS   = 4;", "var MAX_SLOTS   = 5;", '자리 수가 서버와 다름'],
  ];
  const missed = [];
  for(const [w, a, b, what] of BREAKS){
    if(SRC0[w].indexOf(a) < 0){ missed.push('못 찾음 ' + what); continue; }
    const S = Object.assign({}, SRC0); S[w] = S[w].split(a).join(b);
    quiet = true; qfail = 0; try{ await judged(S); }catch(_){ qfail++; } quiet = false;
    if(!qfail) missed.push(what);
  }
  chk(!missed.length, '일부러 깨 본 ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — ' + missed.join(' · ') : ''));
  console.log(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  finished = true;
  process.exit(fail ? 1 : 0);
})();
