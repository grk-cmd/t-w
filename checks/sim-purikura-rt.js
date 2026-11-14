/* sim-purikura-rt.js — 📷 스티커사진 세션 포트(purikura/purikura-rt.js) 검사 — 가짜 연결 · 가짜 API 로 그대로 돌린다
   ・1절: 정원 — GET /v1/rooms/photo-quota → 화면 모양 · 못 읽으면 던진다 · 알림(photoQuota)이 오면 듣는 동안만 다시 GET
   ・2절: 자리 잡기 — photoOpen{ fx } · photoWelcome → { ok, slot, host } · 거절(busy · full) · 시간 초과 · 연결 없음 · 방 밖
   ・3절: 자리 · 방장 — userCode 로 내 자리 · 살아 있는 가장 작은 번호가 방장 · 방장 일은 방장만 보낸다
   ・4절: 촬영 시작 — photoStart → photoStarted / 정원 거절 문구 · 한 번에 하나
   ・5절: 좌표 · 사건 · 셔터 · 프레임 — 데드밴드 · 10Hz · 내 것은 안 받는다 · 나가면(photoLeave) 조용
   ・6절: 배선 · 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find((v) => v != null);
const at3 = (f, d) => [f, 'parts/' + d + f, 'app/parts/' + d + f];
const SRC0 = {
  RT: pick(at3('purikura-rt.js', 'purikura/')),
  NET: pick(at3('purikura-net.js', 'purikura/')),
  UI: pick(at3('purikura-ui.js', 'purikura/')),
  APP: pick(at3('app.js', '')),
  FI: pick(at3('firebase-init.js', '')),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
  SMOKE: pick(['smoke.js', 'checks/smoke.js']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const load = (src) => { const m = { exports: {} }; new Function('module', 'window', src)(m, undefined); return m.exports; };
const P = load(SRC0.NET);   // 진짜 순수 계산 — 좌표 부호화 · 데드밴드 상수 · 정원 문구
const tick = async () => { for(let i = 0; i < 10; i++) await Promise.resolve(); };
const NOW = Date.UTC(2026, 10, 14, 3, 0, 0);
const W = (code, name, fx) => ({ userCode: code, name: name || '', fx: fx || 0 });

function mk(S, o){
  o = o || {};
  const fns = {}, kinds = {}, sent = [], timers = [], gets = [], log = { peers: [], meta: [], events: [], shots: [], slots: [], frames: [] };
  const env = { t: 1000, quota: o.quota || { day: 0, used: 5, cap: 400, left: 395 }, quotaFail: false, offline: !!o.offline };
  const hub = {
    onMessage(t, fn){ (fns[t] = fns[t] || []).push(fn); },
    on(k, fn){ (kinds[k] = kinds[k] || []).push(fn); },
    send(m){ if(env.offline) return false; sent.push(m); return true; },
  };
  const api = { get: (path, opt) => { gets.push([path, opt]); return env.quotaFail ? Promise.reject(new Error('net')) : Promise.resolve(env.quota); } };
  const s = load(S.RT).createPhotoSession({ hub, api, P, serverNow: () => NOW, clock: () => env.t,
    setTimeout: (f, ms) => { const h = { f, ms }; timers.push(h); return h; }, clearTimeout: (h) => { const i = timers.indexOf(h); if(i >= 0) timers.splice(i, 1); },
    onPeers: (p) => log.peers.push(JSON.parse(JSON.stringify(p))), onMeta: (m) => log.meta.push(m), onEvent: (sl, ev) => log.events.push([sl, ev]),
    onShot: (x) => log.shots.push(x), onSlots: (x) => log.slots.push(x), onFrames: (x) => log.frames.push(x) });
  const emit = (m) => (fns[m.t] || []).forEach((f) => f(m));
  /* 내가(ME) 자리 slot 에 들어간 세션 — others 는 { 번호: userCode } */
  const enter = async (slot, others) => {
    const arr = [null, null, null, null];
    Object.keys(others || {}).forEach((k) => { arr[k] = W(others[k], '남' + k); });
    arr[slot] = W('ME', '나', P.FILTER_REV);
    const p = s.open('PLAY-AB12', { userCode: 'ME' });
    emit({ t: 'photoWelcome', slot, slots: arr, meta: { state: 'lobby' }, frames: [null, 'https://x/1.webp', null, null] });
    return p;
  };
  return { s, env, sent, timers, gets, log, emit, enter, notify: (k) => (kinds[k] || []).forEach((f) => f({ kind: k })), fire: () => { const t = timers.shift(); if(t) t.f(); } };
}

async function judge(S){
  const R = load(S.RT);
  say('── 1. 정원');
  let e = mk(S);
  let q = await e.s.checkQuota();
  chk(e.gets.length === 1 && e.gets[0][0] === '/v1/rooms/photo-quota' && e.gets[0][1] && e.gets[0][1].auth === true, 'GET /v1/rooms/photo-quota(로그인 통로) 한 번');
  chk(q.ok === true && q.left === 395 && q.used === 5 && q.cap === 400 && q.label === '395 / 400' && q.message === '' && q.reopenAt === P.reopenAt(NOW), '  화면 모양 { ok, left, used, cap, label, reopenAt, message }');
  e = mk(S, { quota: { day: 0, used: 400, cap: 400, left: 0 } });
  q = await e.s.checkQuota();
  chk(q.ok === false && q.left === 0 && q.message === P.closedMessage(NOW) && q.message.length > 0, '  0 이면 닫힘 · 문구는 다시 여는 시각에서');
  e = mk(S); e.env.quotaFail = true;
  let threw = false; try{ await e.s.checkQuota(); }catch(_){ threw = true; }
  chk(threw, '★ 못 읽으면 던진다(화면이 «지금은 확인할 수 없어요» — 0 회로 그리지 않는다)');
  e = mk(S);
  const seenQ = [];
  const offQ = e.s.watchQuota((x) => seenQ.push(x.left));
  e.notify('photoQuota'); await tick();
  chk(e.gets.length === 0 && seenQ.length === 0, '  세션 밖이면 알림이 와도 묻지 않는다');
  await e.enter(0);
  e.env.quota = { day: 0, used: 6, cap: 400, left: 394 };
  e.notify('photoQuota'); await tick();
  chk(e.gets.length === 1 && seenQ.join() === '394', '★ 세션 안 · 듣는 동안 알림(photoQuota)이 오면 다시 GET 한 번');
  offQ(); e.notify('photoQuota'); await tick();
  chk(e.gets.length === 1 && seenQ.length === 1, '  끊으면 더 묻지 않는다(주기 요청 없음)');

  say('── 2. 자리 잡기');
  e = mk(S);
  let r = await e.enter(1, { 0: 'u7' });
  chk(JSON.stringify(e.sent[0]) === JSON.stringify({ t: 'photoOpen', fx: P.FILTER_REV }), 'photoOpen{ fx } — 방 코드 · 이름은 싣지 않는다(서버가 지금 방 · 멤버 이름으로)');
  chk(r.ok === true && r.slot === 1 && r.host === false && e.s.mySlot() === 1 && e.s.hostSlot() === 0, '  photoWelcome → { ok, slot, host } · 먼저 온 0번이 방장');
  chk(e.log.slots.length === 1 && e.log.slots[0][1].uid === 'ME' && e.log.slots[0][0].uid === 'u7' && e.log.meta[0].state === 'lobby' && JSON.stringify(e.log.frames[0]) === '{"1":"https://x/1.webp"}',
    '  환영에 실린 자리 · 설정 · 프레임을 화면 모양으로({ 번호: { uid, name, fx } } · 빈 프레임 칸은 싣지 않는다)');
  chk(e.timers.length === 0, '  답이 오면 기다림 타이머를 걷는다');
  for(const [code, reason] of [['ROOM_PHOTO_BUSY', 'busy'], ['ROOM_PHOTO_FULL', 'full'], ['notInRoom', 'notInRoom'], ['WEIRD', 'error']]){
    e = mk(S);
    const p = e.s.open('PLAY-AB12', { userCode: 'ME' });
    e.emit({ t: 'error', code, ref: 'photoOpen' });
    r = await p;
    chk(r.ok === false && r.reason === reason && e.s.mySlot() === -1, '  거절 ' + code + ' → reason ' + reason);
  }
  e = mk(S);
  let p = e.s.open('PLAY-AB12', { userCode: 'ME' });
  e.emit({ t: 'error', code: 'ROOM_PHOTO_FULL', ref: 'photoStart' });
  chk(e.timers.length === 1 && e.timers[0].ms === R.OPEN_WAIT_MS, '  다른 요청의 오류(ref)는 내 것이 아니다 — 계속 기다린다');
  e.fire(); r = await p;
  chk(r.ok === false && r.reason === 'timeout', '  답이 없으면 시간 초과');
  chk((await mk(S, { offline: true }).s.open('PLAY-AB12', { userCode: 'ME' })).reason === 'notReady', '  연결이 없으면 notReady');
  e = mk(S);
  chk((await e.s.open('', { userCode: 'ME' })).reason === 'notInRoom' && (await e.s.open('PLAY-AB12', {})).reason === 'notInRoom' && e.sent.length === 0, '  방 밖 · 내 코드 없음이면 보내지 않는다');
  e = mk(S);
  p = e.s.open('PLAY-AB12', { userCode: 'ME' });
  chk((await e.s.open('PLAY-AB12', { userCode: 'ME' })).ok === false && e.sent.length === 1, '  기다리는 중 또 누르면 보내지 않는다(한 번에 하나)');

  say('── 3. 자리 · 방장');
  e = mk(S);
  await e.enter(2, { 0: 'u7', 1: 'u8' });
  chk(e.s.isHost() === false, '뒤에 온 사람은 방장이 아니다');
  chk((await e.s.setFilter('mono')) === false && (await e.s.setDone()) === false && e.sent.length === 1, '★ 방장이 아니면 방장 일을 보내지 않는다(false)');
  e.emit({ t: 'photoPos', slot: 0, p: P.encPos(0.5, 1.2) });
  e.emit({ t: 'photoSlots', slots: [null, W('u8'), W('ME'), null] });
  chk(e.s.hostSlot() === 1 && e.s.isHost() === false && !('0' in e.s.peersNow()), '  방장이 나가면 살아 있는 가장 작은 번호가 방장 · 나간 사람 좌표는 걷는다');
  e.emit({ t: 'photoSlots', slots: [null, null, W('ME'), null] });
  chk(e.s.isHost() === true && e.s.mySlot() === 2, '★ 혼자 남으면 내가 방장(자리 번호는 그대로)');
  await e.s.setFilter('mono'); await e.s.setCam(99, -99); await e.s.setCut(1, 0); await e.s.setCut(1, 12345); await e.s.setDone(); await e.s.setFrameUrl(2, 'https://x/2.webp'); await e.s.setFrameUrl(2, null); await e.s.fireShutter(3);
  const tail = e.sent.slice(1).map((m) => JSON.stringify(m));
  chk(tail[0] === '{"t":"photoFilter","filter":"mono"}' && tail[1] === JSON.stringify({ t: 'photoCam', h: P.camClampH(99), p: P.camClampP(-99) }), '  방장 일 — photoFilter · photoCam(범위 안으로)');
  chk(tail[2] === '{"t":"photoCut","i":1,"at":0}' && tail[3] === '{"t":"photoCut","i":1,"at":1}' && tail[4] === '{"t":"photoDone"}', '  photoCut — 0 은 «기다리는 중» · 그 밖은 서버가 시각을 찍는다(1) · photoDone');
  chk(tail[5] === '{"t":"photoFrame","i":2,"url":"https://x/2.webp"}' && tail[6] === '{"t":"photoFrame","i":2,"url":null}' && tail[7] === '{"t":"photoShutter","n":3}', '  photoFrame(지우기는 null) · photoShutter');
  const n0 = e.sent.length;
  chk((await e.s.setConfig({ orient: 'p', cuts: 2, basic: 0 })) === false && (await e.s.setConfig({ orient: 'p', cuts: 4, basic: 0, filter: 'nope' })) === false && (await e.s.setFilter('nope')) === false && e.sent.length === n0,
    '  안 되는 컷 수 · 모르는 필터는 보내지 않는다(화면 안내용 먼저 거르기)');
  await e.s.setConfig({ orient: 'l', cuts: 2, basic: 1 });
  const cfg = e.sent[e.sent.length - 1];
  chk(cfg.t === 'photoConfig' && cfg.orient === 'l' && cfg.cuts === 2 && cfg.bg === 'white' && cfg.filter === 'none' && cfg.camH === P.camClampH(P.CAM_HEIGHT) && cfg.camP === P.camClampP(P.CAM_PITCH), '  photoConfig — 빈 칸은 기본값(흰 배경 · 필터 없음 · 기본 카메라)');
  e.emit({ t: 'photoMeta', meta: { state: 'shooting', cut: 1 } });
  e.emit({ t: 'photoFrames', frames: ['https://x/0.webp', null, null, null] });
  chk(e.s.metaNow().state === 'shooting' && e.log.meta.length === 2 && JSON.stringify(e.s.framesNow()) === '{"0":"https://x/0.webp"}', '  photoMeta · photoFrames 를 받아 화면으로');

  say('── 4. 촬영 시작');
  e = mk(S);
  await e.enter(0);
  const qs = [];
  e.s.watchQuota((x) => qs.push(x.left));
  p = e.s.start();
  chk(e.sent[1].t === 'photoStart' && (await e.s.start()).reason === 'busy' && e.sent.length === 2, 'photoStart — 답을 기다리는 중엔 또 보내지 않는다');
  e.emit({ t: 'photoStarted', nth: 6, left: 394 });
  r = await p;
  chk(r.ok === true && r.left === 394 && r.n === 6 && r.nth === '6번째 · 394회 남음' && qs.join() === '394', '  photoStarted{ nth, left } → { ok, n, left, nth } · 남은 횟수 칸도 그 값으로(다시 GET 안 함)');
  chk(e.gets.length === 0, '  시작이 정원을 따로 묻지 않는다(서버가 그 순간에 쓴다)');
  for(const [code, reason, closed] of [['ROOM_PHOTO_QUOTA_EXHAUSTED', 'closed', true], ['ROOM_PHOTO_QUOTA_UNAVAILABLE', 'unavailable', false], ['ROOM_PHOTO_NOT_HOST', 'not-host', false]]){
    p = e.s.start();
    e.emit({ t: 'error', code, ref: 'photoStart' });
    r = await p;
    chk(r.ok === false && r.reason === reason && r.message === (closed ? P.closedMessage(NOW) : R.START_FAIL_MSG), '  거절 ' + code + ' → ' + reason + (closed ? ' · 닫힘 문구' : ' · «잠시 뒤에»'));
  }
  p = e.s.start(); e.fire(); r = await p;
  chk(r.ok === false && r.reason === 'timeout' && r.message === R.START_FAIL_MSG, '  답이 없으면 시간 초과');
  e.env.offline = true;
  r = await e.s.start();
  chk(r.ok === false && r.reason === 'notReady' && r.message === R.START_NOT_READY_MSG, '  연결이 끊겼으면 «서버에 연결된 뒤»');
  e = mk(S); await e.enter(1, { 0: 'u7' });
  chk((await e.s.start()).reason === 'not-host' && e.sent.length === 1, '  방장이 아니면 보내지 않는다');

  say('── 5. 좌표 · 사건 · 셔터 · 나가기');
  e = mk(S);
  chk(e.s.sendPos(0, 1, true) === false && e.s.sendEvent('jump') === false && e.sent.length === 0, '세션 밖이면 좌표 · 사건을 보내지 않는다');
  await e.enter(0, { 1: 'u7' });
  e.env.t = 5000;
  chk(e.s.sendPos(0.5, 1.0, false, 0.1, 0.2, 0.3) === true && e.sent[1].t === 'photoPos' && e.sent[1].p === P.encPos(0.5, 1.0, 0.1, 0.2, 0.3), 'photoPos{ p } — 부호화한 한 줄');
  e.env.t = 5000 + P.SEND_MIN_MS - 1;
  chk(e.s.sendPos(0.9, 1.0, false) === false, '  간격(10Hz) 안이면 안 보낸다');
  e.env.t = 5000 + P.SEND_MIN_MS;
  chk(e.s.sendPos(0.5 + P.DEAD_X / 2, 1.0 + P.DEAD_D / 2, false) === false, '  데드밴드 안이면 안 보낸다(안 움직이면 0)');
  chk(e.s.sendPos(0.5 + P.DEAD_X / 2, 1.0 + P.DEAD_D / 2, true) === true, '  force(셔터 직전)는 간격 · 데드밴드를 무시');
  e.env.t += P.SEND_MIN_MS;
  chk(e.s.sendPos(0.9, 1.0, false) === true && e.sent.filter((m) => m.t === 'photoPos').length === 3, '  움직였고 간격이 지났으면 보낸다');
  e.s.sendEvent('pose', 2); e.s.sendEvent('jump');
  chk(JSON.stringify(e.sent.slice(-2)) === '[{"t":"photoEvent","k":"pose","v":2},{"t":"photoEvent","k":"jump","v":null}]', '  photoEvent{ k, v } — «눌렀다» 한 번');
  e.emit({ t: 'photoPos', slot: 1, p: P.encPos(-0.3, 2.0) });
  e.emit({ t: 'photoPos', slot: 0, p: P.encPos(9, 9) });
  e.emit({ t: 'photoPos', slot: 1, p: 12 });
  chk(e.log.peers.length === 1 && Math.abs(e.s.peersNow()[1].wx + 0.3) < 0.011 && !('0' in e.s.peersNow()), '  남의 좌표만 받는다(내 자리 · 깨진 값은 버린다)');
  e.emit({ t: 'photoEvent', slot: 1, k: 'jump', ts: 77 });
  e.emit({ t: 'photoEvent', slot: 0, k: 'jump', ts: 78 });
  chk(e.log.events.length === 1 && e.log.events[0][0] === 1 && JSON.stringify(e.log.events[0][1]) === '{"k":"jump","v":null,"ts":77}', '  남의 사건만 받는다');
  e.emit({ t: 'photoShot', n: 2, at: 999 });
  chk(JSON.stringify(e.log.shots) === '[{"n":2,"at":999}]' && e.s.freezeMs() === P.FREEZE_MS && e.s.serverNow() === NOW, '  photoShot{ n, at } · 정지 시간 · 서버 시각');
  const before = e.sent.length;
  await e.s.close();
  chk(e.sent.length === before + 1 && e.sent[before].t === 'photoLeave' && e.s.mySlot() === -1 && e.s.isHost() === false && Object.keys(e.s.slotsNow()).length === 0, '★ 닫기 — photoLeave 한 번 · 자리 · 방장 · 목록을 비운다');
  await e.s.release();
  const logged = e.log.slots.length + e.log.shots.length + e.log.meta.length;
  e.emit({ t: 'photoSlots', slots: [W('u7'), null, null, null] }); e.emit({ t: 'photoShot', n: 3, at: 1 }); e.emit({ t: 'photoMeta', meta: { state: 'lobby' } });
  chk(e.sent.length === before + 1 && e.log.slots.length + e.log.shots.length + e.log.meta.length === logged, '  나간 뒤엔 다시 안 보내고(두 번 나가기 없음) · 남의 세션 소식도 화면에 안 넘긴다');

  say('── 6. 배선');
  const h = S.HTML, at = (f) => h.indexOf('<script src="parts/' + f + '"></script>');
  chk(at('purikura/purikura-rt.js') > at('purikura/purikura-net.js') && at('purikura/purikura-rt.js') > at('realtime/rt-hub.js') && at('app.js') > at('purikura/purikura-rt.js'), 'html — purikura-net · rt-hub → purikura-rt → app.js');
  chk(/PRELOAD\.push\('purikura-rt\.js'\);/.test(S.SMOKE), '  smoke PRELOAD 에 purikura-rt.js');
  chk(/_pkSession = TwPurikuraRt\.createPhotoSession\(\{\s*hub: TwRtHub\.store, api: TwApi\.authed, P: Purikura,/.test(S.APP) && (S.APP.match(/createPhotoSession\(/g) || []).length === 1, '  app.js _purikura() 한 곳에서 만든다(연결 하나 · 로그인 API 통로)');
  chk(/onSlots: o => \{ purikuraUi\.onSlots\(o\); \}/.test(S.APP) && /onFrames: o => \{ purikuraUi\.onFrames\(o\); \}/.test(S.APP) && /myCode: \(\)=>TwRoomRt\.store\.myCode\(\),/.test(S.APP), '  자리 · 프레임 콜백 · 내 코드(userCode)를 화면에 넘긴다');
  chk(/pk\.open\(room, \{ userCode: myCode\(\) \}\)/.test(S.UI) && !/getMyUserId/.test(S.UI) && !/firebaseAPI\.(?!pkUploadFrame\b)/.test(S.UI), '★ 화면 — 내 코드로 자리 잡기 · Firebase 는 프레임 그림 올리기뿐');
  chk(/'purikura\/'\+PK\.room\+'\/'\+myCode\(\)\+'\/'\+i\+'\.webp'/.test(S.UI), '  프레임 경로 purikura/{방}/{userCode}/i.webp');
  chk(!/makeSession|BEAT_MS|SLOT_TTL_MS/.test(S.NET) && !/\bpk(?:Get|Set|Update|Remove|Transaction|OnValue|OnDisconnectRemove|OnDisconnectCancel)\b/.test(S.FI) && /async pkUploadFrame\(/.test(S.FI), '  옛 Firebase 세션(makeSession · pk* 어댑터)은 없다 — pkUploadFrame 만 남았다');
}

(async () => {
  await judge(SRC0);
  say('── 7. 깨 보기');
  const BREAKS = [
    ['RT', "    if(inSession) quotaFns.slice().forEach((f) => f(quotaOf({ left, used, cap })));\n", '', '시작해도 남은 횟수 칸이 안 바뀜'],
    ['RT', "hub.on('photoQuota', () => { if(inSession && quotaFns.length)", "hub.on('photoQuota', () => { if(true)", '세션 밖 · 듣는 곳 없어도 정원을 다시 물음'],
    ['RT', "function checkQuota(){ return Promise.resolve(api.get(QUOTA_PATH, { auth: true })).then(quotaOf); }", "function checkQuota(){ return Promise.resolve(api.get(QUOTA_PATH, { auth: true })).then(quotaOf, () => quotaOf(null)); }", '정원을 못 읽은 것을 0 회로 그림'],
    ['RT', "    if(opening && m.ref === 'photoOpen')", "    if(opening)", '남의 요청 오류로 자리 잡기를 끝냄'],
    ['RT', "      if(v.uid === myCode) mine = i;", "      if(mine < 0) mine = i;", '내 자리를 userCode 로 안 찾음'],
    ['RT', "      if(host < 0) host = i;", "      host = i;", '방장이 가장 작은 번호가 아님'],
    ['RT', "const hostSend = (msg) => Promise.resolve(isHost() ? !!hub.send(msg) : false);", "const hostSend = (msg) => Promise.resolve(!!hub.send(msg));", '방장이 아니어도 방장 일을 보냄'],
    ['RT', "      if(lastSent.wx !== null && Math.abs(wx - lastSent.wx) < P.DEAD_X && Math.abs(d - lastSent.d) < P.DEAD_D) return false;\n", '', '안 움직여도 좌표를 보냄'],
    ['RT', "      if(t - lastSent.t < P.SEND_MIN_MS) return false;\n", '', '좌표 간격(10Hz)이 없음'],
    ['RT', "    if(!inSession || !m || m.slot === slot) return;\n    const v = P.decPos(m.p);", "    if(!inSession || !m) return;\n    const v = P.decPos(m.p);", '내 좌표를 남 것으로 받음'],
    ['RT', "    if(was) hub.send({ t: 'photoLeave' });", "    hub.send({ t: 'photoLeave' });", '세션 밖에서도 나가기를 보냄'],
    ['RT', "    if(starting) return Promise.resolve({ ok: false, reason: 'busy' });\n", '', '시작을 두 번 보냄'],
    ['RT', "  hub.onMessage('photoShot', (m) => { if(inSession && m) onShot({ n: m.n, at: m.at }); });", "  hub.onMessage('photoShot', (m) => { if(m) onShot({ n: m.n, at: m.at }); });", '나간 뒤에도 셔터를 화면에 넘김'],
    ['UI', "pk.open(room, { userCode: myCode() })", "pk.open(room, { userId: myCode() })", '화면이 내 코드를 안 넘김'],
    ['HTML', '<script src="parts/purikura/purikura-rt.js"></script>', '', 'html 줄 빠짐'],
    ['APP', "    onSlots: o => { purikuraUi.onSlots(o); },\n", '', '자리 콜백을 화면에 안 넘김'],
  ];
  quiet = true;
  const rows = [];
  for(const [k, a, b, name] of BREAKS){
    const S2 = Object.assign({}, SRC0, { [k]: SRC0[k].replace(a, b) });
    const changed = S2[k] !== SRC0[k];
    qfail = 0;
    /* 깨진 판은 답을 영영 기다릴 수 있다(기다림이 안 풀림) — 그것도 빨강으로 센다 */
    if(changed){ try{ await Promise.race([judge(S2), new Promise((_, rej) => setTimeout(() => rej(new Error('안 끝남')), 500))]); }catch(_){ qfail++; } }
    rows.push([changed && qfail > 0, name + (changed ? ' → 빨강' : ' — 바꿀 글을 못 찾음')]);
  }
  quiet = false;
  rows.forEach(([ok, msg]) => chk(ok, msg));
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
