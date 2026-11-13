/* sim-seat-sync-diff.js — 🪑 상태만 바뀐 메시지에 좌석 줄 전체를 다시 배치하지 않는다
   실행:  node sim-seat-sync-diff.js   (seat-sync-diff.js · room-entry.js · net-ready.js · desk-companion-prototype.html · smoke.js 가 있는 폴더에서)
   ★ 왜 이 검사가 있는가 — 방 멤버의 상태(집중 · 쉼 · 잠 · 경험치 …)가 바뀔 때마다 syncFriendSeats 가 돌고, 예전엔 끝에서 늘
     layoutSeats(모든 좌석 몸 · 책상 재기 · 창 크기 IPC) · 좌석 탭 다시 그리기 · 상태칩 강제 레이아웃을 했다(메시지 수 × 좌석 수).
     줄 배치에 닿는 변화만 다시 배치하고, 그런 변화를 놓치면(늦게 붙은 책상 · 올라타기 …) 화면이 어긋나므로 둘 다 지킨다.
   ・1절: 규칙 표(seat-sync-diff.js) — 이전 모양 · 이번 모양 → { layout, tabs } · 경계(처음 · 빈 방 · 못 읽는 값)
   ・2절: 실제 room-entry.js 의 syncFriendSeats 를 가짜 좌석 위에서 돌려 layoutSeats · renderSeatTabs · 상태칩 부른 수를 센다
   ・3절: 깨 보기 — 규칙 · 부르는 자리를 망가뜨리면 1 · 2절 판정이 빨강
   ・4절: 배선 — html · smoke 에서 room-entry.js 보다 먼저 싣는다 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'parts/room/' + f, 'app/parts/room/' + f, 'parts/shared/' + f, 'app/parts/shared/' + f, 'app/' + f, 'checks/' + f]) { try { return fs.readFileSync(c, 'utf8'); } catch (_) {} } return null; };
const SSD = read('seat-sync-diff.js'), RE = read('room-entry.js'), NET = read('net-ready.js'), HTML = read('desk-companion-prototype.html'), SMOKE = read('smoke.js');
if (!SSD || !RE || !NET || !HTML || !SMOKE) { say('  ? 원본 못 찾음 — seat-sync-diff.js · room-entry.js · net-ready.js · desk-companion-prototype.html · smoke.js'); process.exit(2); }

const loadSSD = (src) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w.TwSeatSyncDiff; };

/* ── 가짜 좌석 · 멤버 ── */
let uid = 0;
const v3 = (x, y, z) => ({ x, y, z });
function mkSeat(o){
  return Object.assign({
    remote: true, friendId: 'A', isMe: false, friendName: '에이', remoteState: 'focus',
    desk: { visible: true, scale: v3(1, 1, 1), position: v3(0, 0, 0), userData: {}, children: [{ name: 'deskBody', uuid: 'd' + (++uid), visible: true, position: v3(0, 0, 0), scale: v3(1, 1, 1) }] },
    gltfRoot: { uuid: 'm' + (++uid), scale: v3(1, 1, 1) }, userScale: 1, _eqK: 1,
    group: { position: v3(0, 0, 0) }, rig: { position: v3(0, 0, 0) }, bodyWrap: { scale: v3(1, 1, 1) },
    _lastIdentityJSON: 'id0', _lastDeskJSON: 'desk0', _lastEquipJSON: '{}',
  }, o || {});
}
const member = (o) => Object.assign({ name: '에이', state: 'focus', userStatus: null, level: 3, exp: 4, userId: 'uA', ridingOn: null, seatedOn: null, bench: null }, o || {});

/* 표 한 줄 = 이름 · 바꾸기(좌석 · 멤버) · 기대 { layout, tabs } */
const CASES = [
  ['아무것도 안 바뀜', () => {}, { layout: false, tabs: false }],
  ['상태(state) 만', (w) => { w.f.A.state = 'sleep'; w.seats[1].remoteState = 'sleep'; }, { layout: false, tabs: true }],
  ['활동 상태(userStatus)', (w) => { w.f.A.userStatus = 'away'; }, { layout: false, tabs: false }],
  ['커스텀 상태 문구', (w) => { w.f.A.customStatus = { emo: '☕', text: '쉬는 중' }; }, { layout: false, tabs: false }],
  ['경험치 · 레벨 · 회차 별', (w) => { w.f.A.exp = 5; w.f.A.level = 4; w.f.A.cyc = 1; w.f.A.clv = 2; w.f.A.starC = 'gold'; }, { layout: false, tabs: false }],
  ['자리비움 그림 · 크기', (w) => { w.f.A.awayImg = 'https://x/y.png'; w.f.A.awaySz = 100; }, { layout: false, tabs: false }],
  ['폰 · 백색소음 · 춤 종류 · 쉬는 시각 · 채팅 탭 · 라이선스 · 하트비트', (w) => { Object.assign(w.f.A, { mobile: '앱', noise: 'pencil', danceStyle: 'robot', flyCool: 9, tab: 's1', lic: true, lastSeen: 123 }); }, { layout: false, tabs: false }],
  ['말풍선 · 탭 말풍선 · 찌르기(사건)', (w) => { Object.assign(w.f.A, { chat: { text: 'hi', ts: 5 }, chatTab: { tab: 's1', text: 'x', ts: 6 }, poke: { type: 'pet', ts: 7 } }); }, { layout: false, tabs: false }],
  ['이름', (w) => { w.f.A.name = '비'; w.seats[1].friendName = '비'; }, { layout: false, tabs: true }],
  ['★ 올라타기(ridingOn)', (w) => { w.f.A.ridingOn = 'uMe'; }, { layout: true, tabs: true }],
  ['★ 벤치 앉기(seatedOn)', (w) => { w.f.A.seatedOn = { host: 'uMe', slot: 1 }; }, { layout: true, tabs: true }],
  ['★ 벤치 놓기(bench)', (w) => { w.f.A.bench = { seats: 2, deskId: null }; }, { layout: true, tabs: true }],
  ['★ 유저 ID 가 늦게 옴', (w) => { w.f.A.userId = 'uA2'; }, { layout: true, tabs: true }],
  ['★ 모르는 칸(새 판이 보낸 것)', (w) => { w.f.A.newThing = 1; }, { layout: true, tabs: true }],
  ['★ 캐릭터 정체성 지문', (w) => { w.seats[1]._lastIdentityJSON = 'id1'; }, { layout: true, tabs: true }],
  ['★ 책상 지문', (w) => { w.seats[1]._lastDeskJSON = 'desk1'; }, { layout: true, tabs: true }],
  ['★ 꾸미기 파츠 지문', (w) => { w.seats[1]._lastEquipJSON = '{"hat":1}'; }, { layout: true, tabs: true }],
  ['★ 멤버가 들어옴', (w) => { w.f.B = member({ userId: 'uB' }); w.ids.push('B'); w.seats.push(mkSeat({ friendId: 'B', friendName: '비' })); }, { layout: true, tabs: true }],
  ['★ 멤버가 나감', (w) => { delete w.f.A; w.ids.length = 0; w.seats.splice(1, 1); }, { layout: true, tabs: true }],
  ['★ 늦게 붙은 책상 GLB(자식이 바뀜)', (w) => { const d = w.seats[1].desk; d.children[0].visible = false; d.children.push({ name: 'customDesk', uuid: 'cd', visible: true, position: v3(0, 0, 0.6), scale: v3(1, 1, 1) }); }, { layout: true, tabs: true }],
  ['★ 책상 없음 표시', (w) => { w.seats[1].desk.userData.noDesk = true; }, { layout: true, tabs: true }],
  ['★ 책상 크기', (w) => { w.seats[1].desk.scale.x = 1.4; }, { layout: true, tabs: true }],
  ['★ 몸 모델이 바뀜', (w) => { w.seats[1].gltfRoot = { uuid: 'new', scale: v3(1, 1, 1) }; }, { layout: true, tabs: true }],
  ['★ 평준화 배율', (w) => { w.seats[1]._eqK = 1.2; }, { layout: true, tabs: true }],
  ['★ 좌석 순서(책상 끌기)', (w) => { w.seats.reverse(); }, { layout: true, tabs: true }],
  ['★ 올라탄 좌석 관계(좌석 쪽)', (w) => { w.seats[1].ridingOn = w.seats[0]; }, { layout: true, tabs: true }],
  ['매 프레임 흔들리는 값(자리 · rig · 호흡)', (w) => { w.seats[1].group.position.x = -3.2; w.seats[1].rig.position.x = 0.4; w.seats[1].bodyWrap.scale.y = 1.02; }, { layout: false, tabs: false }],
];
function world(){
  const me = mkSeat({ remote: false, isMe: true, friendId: undefined, friendName: undefined, remoteState: undefined });
  return { f: { A: member() }, ids: ['A'], seats: [me, mkSeat()] };
}
function judgeTable(D){
  const out = [];
  CASES.forEach(([name, mut, want]) => {
    const w = world();
    const prev = D.snapshot(w.seats, w.f, w.ids);
    mut(w);
    const got = D.plan(prev, D.snapshot(w.seats, w.f, w.ids));
    out.push([got.layout === want.layout && got.tabs === want.tabs, name + ' → ' + (want.layout ? '다시 배치' : want.tabs ? '탭만' : '건너뜀')]);
  });
  return out;
}
function judgeEdges(D){
  const out = [];
  const w = world();
  const s = D.snapshot(w.seats, w.f, w.ids);
  const p0 = D.plan(null, s);
  out.push([p0.layout && p0.tabs, '처음(지난 모양 없음)은 다 한다']);
  const e1 = D.snapshot([w.seats[0]], {}, []), e2 = D.snapshot([w.seats[0]], {}, []);
  const pe = D.plan(e1, e2);
  out.push([!pe.layout && !pe.tabs, '빈 방(나만)에서 같은 모양이면 건너뜀']);
  const circ = member(); circ.weird = {}; circ.weird.self = circ.weird;
  const w2 = world(); w2.f.A = circ;
  const a = D.snapshot(w2.seats, w2.f, w2.ids), b = D.snapshot(w2.seats, w2.f, w2.ids);
  out.push([D.plan(a, b).layout, '못 읽는 칸(돌고 도는 값)은 늘 «바뀜» — 다시 배치']);
  const w3 = world(); w3.f.A.def = { skin: 1 };
  const c1 = D.snapshot(w3.seats, w3.f, w3.ids); w3.f.A.def = { skin: 2 };   // 지문은 좌석 쪽이 맡는다 — def 객체만 바뀌고 지문이 같으면 같은 모양
  out.push([!D.plan(c1, D.snapshot(w3.seats, w3.f, w3.ids)).layout, 'def 는 통째로 견주지 않고 좌석의 지문 셋으로 본다']);
  out.push([Object.isFrozen(D.NON_LAYOUT_FIELDS) && ['ridingOn', 'seatedOn', 'bench', 'userId', 'def'].every(k => D.NON_LAYOUT_FIELDS.indexOf(k) < 0), '줄 배치에 닿는 칸은 «값만 적기» 목록에 없다(얼린 표)']);
  return out;
}

say('── 1. 규칙 표');
const D = loadSSD(SSD);
chk(!!D && typeof D.plan === 'function' && typeof D.snapshot === 'function', '싣기만 하면 window.TwSeatSyncDiff');
judgeTable(D).forEach(([ok, m]) => chk(ok, m));
judgeEdges(D).forEach(([ok, m]) => chk(ok, m));

/* ── 2. 실제 syncFriendSeats ── */
function anything(){
  const f = function(){ return P; };
  const P = new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? (() => '') : k === 'then' ? (() => P) : k === 'length' ? 0 : P, apply: () => P, construct: () => P, set: () => true, has: () => true });
  return P;
}
function buildEntry(reSrc, ssdSrc){
  const any = anything();
  const seats = [];
  const count = { layout: 0, tabs: 0, chip: 0, apply: 0 };
  const deps = new Proxy({
    seats, scene: { remove(){} },
    layoutSeats: () => { count.layout++; }, renderSeatTabs: () => { count.tabs++; }, updateMyStatusChipPosition: () => { count.chip++; },
    createSeat: () => { const s = mkSeat({ remote: false, friendId: undefined, friendName: undefined, remoteState: undefined }); seats.push(s); return s; },
    applyCharToSeat: (s, def) => { count.apply++; s.charDef = def; },
    applyEquippedPartsToSeat: () => null, pruneSeatPartsAgainstDef: () => {}, refitSeatAfterParts: () => {},
    removeSeatLabels: () => {}, maxPeople: () => 10, EXP_CELLS: () => 12, getMyUserId: () => 'uMe', _pokeFresh: () => true,
    focusLevelMod: () => ({ _mobileCleanApp: (v) => v || '', starFromRemote: () => null }),
    awayPicMod: () => ({ _awayUrlOk: () => false, _awaySzOk: () => false }),
    chatUiMod: { _chatMyTabId: () => 'general', FLY_COLOR_LEVEL: 99 },
    rideBenchMod: { unmountRide(){}, mountRide(){}, unmountBench(){}, mountBench(){}, attachBenchToSeat(s){ s.bench = { uuid: 'bench1', userData: { benchSeatCount: 2 } }; }, _rideIsAbove: () => false },
    runCost: { timed: (k, fn) => fn, count(){}, add(){} },   // 1분 [비용] 진단(shared/run-cost-diag.js) — 맞춤을 그대로 부른다
    officeMode: () => false, showChatBubble: () => {}, triggerPet: () => {}, spawnFloater: () => {},
    _chatNotifyIncoming: () => {}, _demojiNotifyIncoming: () => {}, FLOATER_BURST: 0,
  }, { get: (t, k) => (k in t ? t[k] : any) });
  const win = new Proxy({ _activeChannel: 1 }, { get: (t, k) => (k in t ? t[k] : (k === 'ChatTabs' ? undefined : any)), set: (t, k, v) => { t[k] = v; return true; } });
  const ls = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const pre = NET + '\nvar TwNetReady = window.TwNetReady;\n' + ssdSrc + '\nvar TwSeatSyncDiff = window.TwSeatSyncDiff;\n';
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'addEventListener', 'removeEventListener', 'module',
    pre + reSrc + '\nreturn window.TwRoomEntry;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined);
  const mod = api.createRoomEntry(deps);
  const me = mkSeat({ remote: false, isMe: true, friendId: undefined, friendName: undefined, remoteState: undefined }); seats.push(me);
  return { mod, seats, count };
}
function judgeFlow(reSrc, ssdSrc){
  const out = [];
  let E;
  try { E = buildEntry(reSrc, ssdSrc); } catch (e) { return [[false, 'room-entry.js 를 만들 수 없다 — ' + String(e && e.message || e).slice(0, 80)]]; }
  const { mod, seats, count } = E;
  const snap = () => Object.assign({}, count);
  const f = { A: member({ def: { skin: 1, equippedParts: {} } }) };
  const step = (fn) => { const a = snap(); fn(); const b = snap(); return { layout: b.layout - a.layout, tabs: b.tabs - a.tabs, chip: b.chip - a.chip }; };
  let d = step(() => mod.syncFriendSeats(f));
  out.push([d.layout === 1 && d.tabs === 1 && d.chip === 1 && seats.length === 2, '처음 맞추기(멤버 들어옴) — 배치 · 탭 · 상태칩 한 번씩']);
  const A = seats.find(s => s.friendId === 'A');
  d = step(() => mod.syncFriendSeats({ A: Object.assign({}, f.A, { exp: 9, userStatus: 'grind', level: 5 }) }));
  out.push([d.layout === 0 && d.tabs === 0 && d.chip === 0, '★ 경험치 · 활동 상태 · 레벨만 — 배치 · 탭 · 상태칩 0']);
  out.push([A && A.friendExp === 9 && A.remoteUserStatus === 'grind' && A.friendLevel === 5, '  그래도 좌석에 값은 적었다(프레임 반복이 읽는다)']);
  d = step(() => mod.syncFriendSeats({ A: Object.assign({}, f.A, { state: 'sleep' }) }));
  out.push([d.layout === 0 && d.tabs === 1 && A.remoteState === 'sleep', '★ 상태(잠) — 탭 이모지만 다시 그리고 배치는 0']);
  d = step(() => mod.syncFriendSeats({ A: Object.assign({}, f.A, { state: 'sleep', exp: 11 }) }));
  out.push([d.layout === 0 && d.tabs === 0, '  잠인 채 경험치만 또 오면 탭도 0(지난 모양을 남겼다)']);
  d = step(() => mod.syncFriendSeats({ A: Object.assign({}, f.A, { state: 'sleep', bench: { seats: 2, deskId: null } }) }));
  out.push([d.layout === 1 && d.chip === 1, '★ 벤치를 놓음 — 다시 배치']);
  d = step(() => mod.syncFriendSeats({ A: Object.assign({}, f.A, { state: 'sleep', bench: { seats: 2, deskId: null } }) }));
  out.push([d.layout === 0, '  같은 값이 다시 와도(재배달) 배치 0']);
  A.desk.children.push({ name: 'customDesk', uuid: 'late', visible: true, position: v3(0, 0, 0.6), scale: v3(1, 1, 1) });
  d = step(() => mod.syncFriendSeats({ A: Object.assign({}, f.A, { state: 'sleep', bench: { seats: 2, deskId: null }, exp: 10 }) }));
  out.push([d.layout === 1, '★ 그사이 책상 GLB 가 늦게 붙었으면 상태만 바뀐 메시지라도 다시 배치']);
  d = step(() => mod.syncFriendSeats({ A: Object.assign({}, f.A, { state: 'sleep', bench: { seats: 2, deskId: null }, exp: 10, def: { skin: 2, equippedParts: {} } }) }));
  out.push([d.layout === 1 && count.apply >= 2, '★ 캐릭터(def)가 바뀜 — 다시 짓고 다시 배치']);
  d = step(() => mod.syncFriendSeats({}));
  out.push([d.layout === 1 && seats.length === 1, '★ 멤버가 나감 — 다시 배치']);
  return out;
}
say('── 2. 실제 syncFriendSeats — 부른 수');
judgeFlow(RE, SSD).forEach(([ok, m]) => chk(ok, m));

say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
{
  const bad1 = SSD.replace("'lastSeen', 'poke'", "'lastSeen', 'ridingOn', 'bench', 'poke'");
  chk(bad1 !== SSD && judgeTable(loadSSD(bad1)).some(([ok]) => !ok), '올라타기 · 벤치를 «값만 적기» 에 넣으면 — 표가 빨강');
  const bad2 = SSD.replace("|| prev.shape !== next.shape", '');
  chk(bad2 !== SSD && judgeTable(loadSSD(bad2)).some(([ok]) => !ok) && judgeFlow(RE, bad2).some(([ok]) => !ok), '좌석 모양(늦게 붙은 책상 등)을 안 보면 — 표 · 흐름이 빨강');
  const bad3 = SSD.replace("'u' + num(s.userScale) + '/' + num(s._eqK),", "'u' + num(s.userScale) + '/' + num(s._eqK) + vec(s.group && s.group.position),");
  chk(bad3 !== SSD && judgeTable(loadSSD(bad3)).some(([ok]) => !ok), '매 프레임 흔들리는 자리를 모양에 넣으면 — 표가 빨강(건너뛰기가 죽는다)');
  const bad4 = RE.replace('if(_todo.layout){', 'if(true){');
  chk(bad4 !== RE && judgeFlow(bad4, SSD).some(([ok]) => !ok), '늘 다시 배치하던 옛 모양으로 되돌리면 — 흐름이 빨강');
  const bad5 = RE.replace('    if(_todo.tabs) renderSeatTabs();\n', '');
  chk(bad5 !== RE && judgeFlow(bad5, SSD).some(([ok]) => !ok), '상태만 바뀐 때 탭을 안 그리면 — 흐름이 빨강');
  const bad6 = RE.replace('_lastSyncSnap = _snap;', '');
  chk(bad6 !== RE && judgeFlow(bad6, SSD).some(([ok]) => !ok), '지난 모양을 안 남기면 — 흐름이 빨강');
}

say('── 4. 배선');
{
  const iS = HTML.indexOf('<script src="parts/room/seat-sync-diff.js"></script>'), iR = HTML.indexOf('<script src="parts/room/room-entry.js"></script>');
  chk(iS > 0 && iR > iS, 'html — seat-sync-diff.js 를 room-entry.js 보다 먼저 싣는다');
  const pS = SMOKE.indexOf("PRELOAD.push('seat-sync-diff.js');"), pR = SMOKE.indexOf("PRELOAD.push('room-entry.js');");
  chk(pS > 0 && pR > pS, 'smoke PRELOAD — seat-sync-diff.js 가 room-entry.js 보다 먼저');
  chk(/const seatSyncDiff = TwSeatSyncDiff;/.test(RE) && (RE.match(/seatSyncDiff\.plan\(/g) || []).length === 1, 'room-entry.js 는 규칙을 한 곳(seatSyncDiff.plan)에서만 부른다');
}

say('\n' + (fail ? '✗' : '✓') + ' ' + pass + ' · ' + fail);
process.exit(fail ? 1 : 0);
