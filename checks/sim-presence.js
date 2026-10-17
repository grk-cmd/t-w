/* sim-presence.js — 🛰 방 접속 상태(room/presence.js — Presence) 동작 · 연결
   실행:  node sim-presence.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — Presence 는 39개 구역이 쓰는 방 핵심 상태다. app.js 에서 모듈로 옮겼으니(C 구역 떼기 w4)
     «방에 무엇을 보내는가 · 언제 안 보내는가 · 자동 자리비움이 언제 걸리고 풀리는가» 를 입력 → 출력으로 고정한다.
   ・1절: 만들 때 — 가짜 deps 위에서 던지지 않고 { Presence } 하나를 내놓는다 · 첫 자동 자리비움 틱을 예약한다
   ・2절: 부팅 상태 되살리기 — tw.userStatus · tw.awayKind(자동 / 수동 / 기록 없음 / 모르는 값)
   ・3절: 방 입장 · payload — join 칸 · 방 코드 돌려줌 · friends 콜백 · 같은 값은 다시 안 보냄 · 거르기(소음 · 그림 크기 · 이름)
   ・4절: 채팅 · poke · 나가기 — 140자 · 탭 · 날리기 칸 · poke 중복 / 지난 값 거르기 · 쓰다듬기 · stop
   ・5절: 자동 자리비움 — 20분 무반응이면 away(auto) · 돌아오면 직전 상태 · 밥 · 게임은 건너뜀 · 손으로 고르면 manual
   ・6절: app.js 연결 — 옮긴 선언이 app.js 에 안 남음 · deps 20줄 · 옛 전역 이름 한 줄 · html(app.js 앞) · smoke · 되살리기 도우미
   ・7절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('room/presence.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html');
const SMOKE = read('smoke.js') || read('checks/smoke.js'), RSRC = read('sim-renderer-src.js') || read('checks/sim-renderer-src.js');
if (!MOD || !APP || !HTML) { say('  ? 원본 못 찾음 — presence.js · app.js · desk-companion-prototype.html'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = ['getMyUserId', 'toast', 'triggerPet'];
const VAL_DEPS = ['USER_STATUSES', 'chatUiMod', 'floatersMod', 'iDeskMod', 'roomSyncMod', 'seats', 'tricksMod'];
const GET_DEPS = ['awayPicMod', 'customStatusConf', 'expBarMod', 'focusLevelMod', 'focusShareMod', 'isAdmin', 'isPremium', 'lastAnyInput', 'roomEntryMod', 'roomNet'];
const STATUSES = { meal: 1, gaming: 1, away: 1, custom: 1, busy: 1 };

/* 가짜 세상 — 모듈을 만들고 무엇이 불렸는지 적는다. o 로 저장값 · 유휴 시간 등을 바꾼다 */
function world(src, o = {}) {
  const log = { updates: [], joins: [], pokes: [], toasts: [], pets: 0, leaves: 0, exitCancel: 0, exitWarn: 0, winStatus: [], changes: [] };
  const store = Object.assign({}, o.store || {});
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const timers = [];
  const env = { idleSec: 0, now: 1000, mobile: false };
  const me = { isMe: true };
  const deps = {
    getMyUserId: () => 'u1', toast: (m) => log.toasts.push(m), triggerPet: () => { log.pets++; },
    USER_STATUSES: STATUSES,
    chatUiMod: { _chatTabOut: () => null },
    floatersMod: { _myPetLocalAt: () => -1e9, MY_PET_ECHO_MS: 800, FLOATER_BURST: 0, spawnFloater: () => {} },
    iDeskMod: { DANCE_MOVES: [{ style: 'sway', dur: 6000 }] },
    roomSyncMod: { _autoExitCancel: () => { log.exitCancel++; }, _autoExitWarn: () => { log.exitWarn++; }, AUTO_EXIT_AFTER_AWAY_MS: 6 * 3600e3, AUTO_EXIT_WARN_MS: 60e3,
      _srvNow: () => 5000, POKE_SKEW_MS: 60000, _pokeFresh: (ts) => ts > 1000, ensureRoomFaceUrls: async () => {}, makeFirebaseProvider: () => provider },
    seats: [me],
    tricksMod: { _myFlyCoolUntil: () => 0, applyRemoteFly: () => {}, applyRemoteBonk: () => {} },
    awayPicMod: () => ({ _awayUrlOk: (u) => typeof u === 'string' && u.startsWith('https://ok/'), awayImgUrl: () => '', _awaySzOk: (n) => n === 60 || n === 80 || n === 100, awayImgSz: () => 80, AWAY_PIC_SCREEN_PX: () => 80 }),
    customStatusConf: () => o.customStatusConf || null,
    expBarMod: () => ({ myExpCells: () => 3 }),
    focusLevelMod: () => ({ getFocusLevel: () => 7, myStarOut: () => ({ cyc: 0, clv: 7, starC: '' }), _mobileOn: () => env.mobile, _mobileRoomLabel: () => null }),
    focusShareMod: () => ({ _focusShowConf: () => o.focusShow || null, _focusShowMarkSent: () => {} }),
    isAdmin: () => false, isPremium: () => !!o.premium, lastAnyInput: () => 0,
    roomNet: () => (o.noApi ? undefined : {}),   // 데이터 provider — 전역 firebaseAPI 는 일부러 비워 둔다(모듈이 roomNet 만 보는지)
    roomEntryMod: () => ({ _waitFirebaseApi: async () => {}, NET_READY_WAIT_MS: 1, _mockRoomAllowed: () => !!o.mockOk, makeMockProvider: () => provider }),
  };
  let pokeCb = null;
  const provider = {
    join: (room, payload, onFriends, onPoke) => { log.joins.push({ room, payload }); pokeCb = onPoke; onFriends({ f1: { name: '친구' } }); return o.joinRes; },
    update: (p) => log.updates.push(p), poke: (id, t) => log.pokes.push([id, t]), pokeSelf: (t) => log.pokes.push(['self', t]), leave: () => { log.leaves++; },
  };
  const win = { firebaseAPI: undefined, companion: { getIdleSeconds: async () => env.idleSec } };
  win.setUserStatus = (v) => { log.winStatus.push(v); P.setUserStatus(v); };
  const perf = { now: () => env.now };
  const api = new Function('window', 'localStorage', 'setTimeout', 'clearTimeout', 'performance', 'companion', 'module',
    src + '\nreturn window.TwPresence;')(win, ls, (fn, ms) => { timers.push([fn, ms]); return timers.length; }, () => {}, perf, win.companion, undefined);
  const out = api.createPresence(deps);
  const P = out.Presence;
  return { out, P, log, store, timers, env, me, provider, poke: (p) => pokeCb(p), tick: async () => { const t = timers[timers.length - 1]; await t[0](); } };
}
const last = (w) => w.log.updates[w.log.updates.length - 1];

async function behave(src) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let w = null, err = null;
  try { w = world(src); } catch (e) { err = e; }
  t(!err && w && Object.keys(w.out).join() === 'Presence', '만들 때 던지지 않고 { Presence } 하나를 내놓는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  if (!w) return r;
  const API = ['start', 'setState', 'setUserStatus', 'setCustomStatus', 'setFocusShow', 'setAwayImg', 'setAwaySz', 'setNoise', 'setLevel', 'setName', 'poke', 'pokeSelf', 'updateDef', 'sendChat', 'stop', 'broadcastRide', 'broadcastNow', 'active', 'roomCode', 'friendsObj', 'myDef', 'serverProvider'];
  t(API.every((n) => typeof w.P[n] === 'function'), 'Presence 의 함수 ' + API.length + '개');
  t(w.timers.length === 1 && w.timers[0][1] === 60000, '첫 자동 자리비움 틱을 60초 뒤로 예약한다');
  t(w.P.active() === false && w.P.roomCode() === null && w.P.serverProvider() === null, '처음엔 방 밖(active false · roomCode null)');

  /* 2. 부팅 상태 되살리기 — 상태는 join payload 의 userStatus 로 본다 */
  const bootOf = async (store) => { const x = world(src, { store }); await x.P.start('R1', {}, '나'); return { x, st: x.log.joins[0].payload.userStatus, tick: x.timers[x.timers.length - 1][1] }; };
  let b = await bootOf({ 'tw.userStatus': 'away' });
  t(b.st === 'away' && b.x.timers[0][1] === 5000, '저장된 away · 종류 기록 없음 → 자동으로 본다(복귀 감시 5초 틱)');
  b = await bootOf({ 'tw.userStatus': 'away', 'tw.awayKind': JSON.stringify({ k: 'manual' }) });
  t(b.st === 'away' && b.x.timers[0][1] === 60000, '손으로 고른 away(manual) → 그대로 · 평소 60초 틱');
  b = await bootOf({ 'tw.userStatus': 'meal' });
  t(b.st === 'meal' && b.x.timers[0][1] === 60000, '저장된 meal → 그대로 되살린다');
  b = await bootOf({ 'tw.userStatus': 'zzz' });
  t(b.st === null, '모르는 상태 값은 버린다(null)');
  b = await bootOf({});
  t(b.st === null, '저장값이 없으면 null');

  /* 3. 방 입장 · payload */
  w = world(src, { focusShow: { emo: '🕒', text: '오늘 1:00' } });
  const ret = await w.P.start('ROOM1', { d: 1 }, '', (fr) => w.log.changes.push(fr));
  const j = w.log.joins[0];
  t(ret === 'ROOM1' && w.P.active() && w.P.roomCode() === 'ROOM1', 'Firebase 방은 방 코드를 돌려주고 active · roomCode 가 선다');
  t(j && j.payload.name === '나' && j.payload.level === 7 && j.payload.userId === 'u1' && j.payload.awaySz === 80 && j.payload.noise === '' && j.payload.lic === false && j.payload.awayImg === '',
    'join payload — 이름 없으면 «나» · 레벨 · userId · 그림 크기 80 · 소음 빈 값 · lic · awayImg');
  t(j && j.payload.userStatus === 'custom' && j.payload.customStatus.text === '오늘 1:00', '상태가 없으면 오늘 기록 전시를 custom 칸으로 싣는다');
  t(w.P.friendsObj().f1 && w.log.changes.length === 1, 'friends 콜백 → friendsObj · onChange');
  t(w.P.myDef().d === 1, 'myDef — 방에 보낸 def');
  w.log.updates.length = 0;
  w.P.setUserStatus('meal');
  t(last(w) && last(w).userStatus === 'meal' && last(w).customStatus === null, '상태를 고르면 그 상태가 전시보다 먼저 나간다');
  w.P.setNoise('pencil'); const n1 = w.log.updates.length;
  w.P.setNoise('pencil');
  t(last(w).noise === 'pencil' && w.log.updates.length === n1, '소음 pencil 은 한 번만 보낸다(같은 값은 다시 안 보냄)');
  w.P.setNoise('drum');
  t(last(w).noise === '', '모르는 소음은 빈 문자열');
  w.P.setAwaySz(100); t(last(w).awaySz === 100, '그림 크기 100 은 그대로');
  w.P.setAwaySz(55); t(last(w).awaySz === 80, '그림 크기 55 는 기본 80 으로');
  w.P.setAwayImg('http://evil/x.png'); const n2 = w.log.updates.length;
  w.P.setAwayImg('https://ok/a.webp');
  t(n2 === w.log.updates.length - 1 && last(w).awayImg === 'https://ok/a.webp', '허용 안 된 그림 주소는 빈 값(이미 빈 값이라 안 보냄) · 허용 주소는 보낸다');
  const n3 = w.log.updates.length; w.P.setLevel(7); w.P.setLevel(7);
  t(w.log.updates.length === n3 + 1, '레벨은 바뀔 때만(같은 값 두 번 → 한 번)');
  w.P.setName(''); const n4 = w.log.updates.length; w.P.setName('');
  w.P.setName('민수');
  t(n4 === w.log.updates.length - 1 && last(w).name === '민수', '이름 — 빈 값은 «나»(처음과 같아 안 보냄) · 바뀐 이름만 name 칸에 얹는다');
  const n5 = w.log.updates.length; w.P.setState('idle');
  w.P.setState('focus');
  t(w.log.updates.length === n5 + 1 && last(w).state === 'focus', '상태(state)도 같은 값은 안 보낸다');
  w.P.setFocusShow({ emo: 'a', text: 'b' }); const n6 = w.log.updates.length;
  w.P.setFocusShow({ emo: 'a', text: 'b' });
  t(w.log.updates.length === n6, '전시 값도 같으면 안 보낸다');
  w.me.ridingOn = { friendUserId: 'u9' }; w.me.seatedOn = { isMe: true }; w.me.seatSlot = 2;
  w.P.broadcastRide();
  t(last(w).ridingOn === 'u9' && last(w).seatedOn.host === 'self' && last(w).seatedOn.slot === 2 && last(w).exp === 3, '올라타기 · 벤치 · 경험치 칸');

  /* 4. 채팅 · poke · 나가기 */
  w.P.sendChat('가'.repeat(200), false, null, null, 'general');
  t(last(w).chat && last(w).chat.text.length === 140 && !('fly' in last(w).chat) && !('tab' in last(w).chat), '채팅 — 140자로 자름 · 날리기 아니면 fly 칸 없음 · #일반은 tab 칸 없음');
  w.P.sendChat('hi', true, '#fff', 'l', 'movie');
  t(last(w).chatTab && !last(w).chat && last(w).chatTab.tab === 'movie' && last(w).chatTab.fly === true && last(w).chatTab.flyColor === '#fff' && !('flySize' in last(w).chatTab),
    '탭 채팅은 chatTab 칸 · 날리기 색 · 대(l)는 안 싣는다');
  w.P.sendChat('hi', true, null, 'm');
  t(last(w).chat.flySize === 'm', '날리기 크기 m 은 싣는다');
  w.P.poke('f1', 'pet'); w.P.pokeSelf('bonk:x');
  t(JSON.stringify(w.log.pokes) === JSON.stringify([['f1', 'pet'], ['self', 'bonk:x']]), 'poke · pokeSelf 는 provider 로');
  w.poke({ type: 'pet', ts: 6000 });
  w.poke({ type: 'pet', ts: 6000 });
  w.poke({ type: 'pet', ts: 5500 });
  t(w.log.pets === 1, '받은 poke — 같은 ts · 뒤로 가는 ts 는 다시 재생하지 않는다');
  w.poke({ type: 'pet', ts: 900 });
  t(w.log.pets === 1, '받은 poke — 유통기한 지난 값은 안 본다');
  w.poke({ type: 'pet' });
  t(w.log.pets === 2, 'ts 없는 poke(옛 클라이언트)는 그냥 재생');
  w.me.ridingOn = null;   // 타고 있으면 춤은 건너뛴다
  w.poke({ type: 'dance:sway', ts: 7000 });
  t(w.me.danceStyle === 'sway' && w.me.danceUntil === 1000 + 6000, '방 전원 춤 — 내 좌석이 그 춤을 dur 동안');
  const lv = w.log.leaves; await w.P.stop();
  t(w.log.leaves === lv + 1 && !w.P.active() && w.P.roomCode() === null && Object.keys(w.P.friendsObj()).length === 0, 'stop — leave · 방 밖으로');
  const nU = w.log.updates.length; w.P.setNoise('page');
  t(w.log.updates.length === nU, '방 밖에서는 보내지 않는다');

  /* 서버가 준비 안 됨 · 가짜 방 막힘 */
  const w2 = world(src, { noApi: true });
  const r2 = await w2.P.start('R2', {}, '나');
  t(r2 === undefined && !w2.P.active() && w2.log.toasts.length === 1 && w2.log.joins.length === 0, '데이터 provider(roomNet) 없음 · 가짜 방 막힘 → 들어가지 않고 알린다');
  const w3 = world(src, { joinRes: Promise.resolve({ ok: false, code: 'full' }) });
  const r3 = await w3.P.start('R3', {}, '나', null, { provider: w3.provider });
  t(r3 && r3.ok === false && r3.code === 'full' && !w3.P.active(), '방 서버 입장 실패 → { ok:false, code } · 방 밖');

  /* 5. 자동 자리비움 */
  w = world(src); await w.P.start('R', {}, '나');
  w.P.setUserStatus('busy');
  w.env.idleSec = 19 * 60; await w.tick();
  t(!w.log.winStatus.includes('away'), '19분 무반응은 그대로');
  w.env.idleSec = 20 * 60; await w.tick();
  t(w.log.winStatus[w.log.winStatus.length - 1] === 'away' && JSON.parse(w.store['tw.awayKind']).k === 'auto' && JSON.parse(w.store['tw.awayKind']).pre === 'busy' && w.timers[w.timers.length - 1][1] === 5000,
    '20분 무반응 → 전역 setUserStatus(away) · 종류 auto(직전 busy) · 5초 틱');
  w.env.idleSec = 0; const c0 = w.log.exitCancel; await w.tick();
  t(w.log.winStatus[w.log.winStatus.length - 1] === 'busy' && w.log.exitCancel > c0 && w.timers[w.timers.length - 1][1] === 60000, '돌아오면 직전 상태(busy)로 · 자동 퇴장 안내를 거둔다 · 60초 틱');
  w.P.setUserStatus('meal'); w.env.idleSec = 99 * 60; const s0 = w.log.winStatus.length; await w.tick();
  t(w.log.winStatus.length === s0, '밥먹는중은 자동 자리비움으로 안 바꾼다');
  w.P.setUserStatus('away');
  t(JSON.parse(w.store['tw.awayKind']).k === 'manual', '손으로 고른 away 는 manual 로 남는다');
  w.P.setUserStatus(null);
  t(!('tw.awayKind' in w.store), 'away 가 아니면 종류 기록을 지운다');
  w = world(src); w.env.mobile = true; w.env.idleSec = 99 * 60; await w.tick();
  t(!w.log.winStatus.length, '폰 포커싱 중이면 무반응이어도 자리비움으로 안 바꾼다');
  return r;
}

function wire(app, html) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const A = strip(app.split('\n').filter((l) => !l.includes('// 옛 전역 이름')).join('\n'));
  t(!/^const Presence\s*=\s*\(\(\)=>/m.test(A) && !/function _autoAwayCheck\b/.test(A), 'app.js 에 옮긴 본문(const Presence=(()=>{ … })이 안 남았다');
  const mk = (app.match(/const presenceMod = TwPresence\.createPresence\(\{\n([\s\S]*?)\n\}\);/) || [])[1] || '';
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : 'val') : '?' + l; };
  const want = [...FN_DEPS.map((n) => n + '|fn'), ...VAL_DEPS.map((n) => n + '|val'), ...GET_DEPS.map((n) => n + '|get')].sort();
  const got = mk ? mk.split('\n').map(kindOf).sort() : [];
  t(got.length === 20 && want.every((k, i) => got[i] === k), '만드는 줄(가드 없이) · deps 20개 — 함수 3 · 값 7 · 읽는 함수 10');
  t(/^const Presence = presenceMod\.Presence;\s+\/\/ 옛 전역 이름/m.test(app) && app.indexOf('const Presence = presenceMod.Presence;') > app.indexOf('const presenceMod = TwPresence.createPresence('), '옛 전역 이름 한 줄(만드는 줄 바로 뒤)');
  t(!/presenceMod\.Presence\b/.test(A.replace('const Presence = presenceMod.Presence;', '')), 'app.js 나머지는 Presence.이름 그대로(presenceMod.Presence 를 직접 부르지 않는다)');
  const iM = html.indexOf('<script src="parts/room/presence.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — room/presence.js 를 app.js 보다 먼저 싣는다');
  return r;
}

(async () => {
  console.warn = () => {};   // 모듈이 남기는 경고(입장 멈춤 등)는 판정과 무관 — 출력만 줄인다
  const B = await behave(MOD);
  B.forEach(([ok, msg], i) => {
    const secs = { 0: '── 1. 만들 때', 4: '── 2. 부팅 상태 되살리기', 9: '── 3. 방 입장 · payload', 25: '── 4. 채팅 · poke · 나가기', 37: '── 5. 자동 자리비움' };
    if (secs[i]) say(secs[i]);
    chk(ok, msg);
  });
  say('── 6. app.js 연결');
  wire(APP, HTML).forEach(([ok, msg]) => chk(ok, msg));
  chk(!SMOKE || /PRELOAD\.push\('presence\.js'\);/.test(SMOKE), 'smoke 가 presence.js 를 먼저 싣는다');
  chk(!RSRC || /file: 'presence\.js', mod: 'presenceMod', glob: 'TwPresence'/.test(RSRC), '되살리기 도우미(sim-renderer-src) 목록에 있다');

  say('── 7. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
  const breaks = [
    ['140자 자르기를 141로', (m) => m.replace('const CHAT_TEXT_MAX = 140;', 'const CHAT_TEXT_MAX = 141;'), null, null],
    ['같은 소음도 다시 보냄', (m) => m.replace('if(v === myNoise) return;', ''), null, null],
    ['poke 중복 거르기 없앰', (m) => m.replace('if(_pts <= _myPokeSeenTs) return;', ''), null, null],
    ['20분을 21분으로', (m) => m.replace('const AUTO_AWAY_MS = 20 * 60 * 1000;', 'const AUTO_AWAY_MS = 21 * 60 * 1000;'), null, null],
    ['밥 · 게임 예외 없앰', (m) => m.replace("myUserStatus === 'meal' || myUserStatus === 'gaming'", 'false'), null, null],
    ['manual 기록 무시', (m) => m.replace("if(rec && rec.k === 'manual') return;", ''), null, null],
    ['provider 대신 전역 firebaseAPI 를 봄', (m) => m.replace('if(!roomNet() && !roomEntryMod()', 'if(!window.firebaseAPI && !roomEntryMod()'), null, null],
    ['만들 때 던짐', (m) => m.replace('function createPresence(deps){', 'function createPresence(deps){ throw new Error("깨 봄");'), null, null],
    ['app.js 에 본문이 남음', null, (a) => a + '\nconst Presence=(()=>{ return {}; })();', null],
    /* presence 를 만드는 줄 안의 것을 지운다 — 같은 deps 줄이 다른 모듈(seat-panel 등)을 만드는 줄에도 있다 */
    ['deps 하나 빠짐', null, (a) => { const i = a.indexOf('const presenceMod = TwPresence.createPresence({'); const j = a.indexOf('\n});', i) + 1; return a.slice(0, i) + a.slice(i, j).replace('  triggerPet: (...a)=>triggerPet(...a),\n', '') + a.slice(j); }, null],
    ['옛 전역 이름 줄 빠짐', null, (a) => a.replace(/^const Presence = presenceMod\.Presence;.*\n/m, ''), null],
    ['html 줄 빠짐', null, null, (h) => h.replace('<script src="parts/room/presence.js"></script>', '')],
  ];
  for (const [name, fm, fa, fh] of breaks) {
    const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(APP) : APP, h2 = fh ? fh(HTML) : HTML;
    const changed = m2 !== MOD || a2 !== APP || h2 !== HTML;
    let rows; try { rows = (fm ? await behave(m2) : []).concat(wire(a2, h2)); } catch (_) { rows = [[false, '던짐']]; }
    chk(changed && rows.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
  }
  say('\n' + (fail ? '✗ 통과 ' + pass + ' · 실패 ' + fail : '전부 통과 ✅ ' + pass + ' — 방 접속 상태는 room/presence.js 에서'));
  process.exit(fail ? 1 : 0);
})();
