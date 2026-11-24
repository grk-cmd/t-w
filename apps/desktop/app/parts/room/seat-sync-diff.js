/* seat-sync-diff.js — 🪑 친구 좌석 맞추기(syncFriendSeats)가 끝에 «좌석 줄을 다시 배치할지 · 좌석 탭만 다시 그릴지» 를 정하는 규칙
   책임: 판단 하나 — 지난번 맞춘 뒤의 모양(snapshot)과 이번 모양을 견줘 { layout, tabs } 를 낸다(순수 함수 · DOM · 서버 없음).
   ★ 왜: 방 멤버의 상태(집중 · 쉼 · 잠 · userStatus · 경험치 …)가 바뀔 때마다 메시지가 오고 syncFriendSeats 가 돈다.
     그때마다 layoutSeats(모든 좌석 몸 · 책상 재기 · 창 크기 IPC) · 좌석 탭 innerHTML · 상태칩 강제 레이아웃을 하면 메시지 수 × 좌석 수로 커진다.
     좌석 자리를 바꾸는 변화가 없으면 줄 배치는 지난번과 같으므로 건너뛴다.
   «배치에 영향 있음» 은 셋 중 하나라도 다를 때다(처음 · 모르면 늘 다시 한다):
     ① 멤버 칸 — NON_LAYOUT_FIELDS 밖의 칸(def 지문 · ridingOn · seatedOn · bench · userId · 모르는 칸). 멤버가 들고 나도 여기서 걸린다.
     ② 좌석 모양 — 좌석 순서 · 올라타기 · 벤치 · 책상(보이는 자식 · 크기 · 자리) · 몸 모델 · 크기 배율.
        책상 GLB 는 비동기로 늦게 붙고 그 자리에서 줄 배치를 부르지 않는다 — 다음 맞추기 때 여기서 잡아 다시 배치한다.
     ③ 줄 배치가 없을 때만 좌석 탭 글(이름 · 상태 이모지 · 순서)을 따로 본다.
   ⚠️ 매 프레임 흔들리는 값(group.position · rig · bodyWrap.scale 호흡)은 모양에 넣지 않는다 — 넣으면 늘 «바뀜» 이라 건너뛰기가 안 된다.
   ⚠️ NON_LAYOUT_FIELDS 에는 «syncFriendSeats 가 좌석에 값만 적고, 그 값은 프레임 반복 · 클릭이 그때그때 읽는» 칸만 둔다.
      줄 배치 · 좌석 관계를 바꾸는 칸을 넣으면 그 변화가 화면에 늦게 나온다(sim-seat-sync-diff 가 빨강).
   내놓는 것: NON_LAYOUT_FIELDS · memberKey(member, seat) · seatShapeKey(seats) · seatTabsKey(seats) · snapshot(seats, friends, ids) · plan(prev, next).
   검사: checks/sim-seat-sync-diff.js */
(function(){

/* 좌석에 값만 적고 줄 배치에 안 닿는 멤버 칸 — 읽는 곳(모두 매 프레임 · 누를 때 읽음):
   state(seatState · 탭 이모지는 frame 이 바뀔 때 다시 그림) · userStatus · customStatus(statusConfFor) · danceStyle(animateRig)
   name(좌석 탭 — ③ 에서 따로 · 이름표는 매 프레임) · level · exp · cyc · clv · starC(이름표 · 경험치 바 — 매 프레임)
   awayImg · awaySz(자리비움 그림 — 매 프레임) · mobile(폰 앱 이름표) · noise(백색소음 — noise.js 가 매번 읽음) · flyCool(누를 때)
   tab(채팅 탭) · lic(좌석에서 안 읽음 — 방장 승계만) · lastSeen(하트비트 도장 — 좌석에서 안 읽음)
   poke · chat · chatTab(ts 로 한 번만 도는 사건 — 말풍선 · 날리기 · 효과 · 줄 배치와 무관) */
const NON_LAYOUT_FIELDS = Object.freeze(['name', 'state', 'userStatus', 'customStatus', 'danceStyle', 'level', 'exp', 'cyc', 'clv', 'starC',
  'awayImg', 'awaySz', 'mobile', 'noise', 'flyCool', 'tab', 'lic', 'lastSeen', 'poke', 'chat', 'chatTab']);
const SKIP = new Set(NON_LAYOUT_FIELDS.concat(['def']));   // def 는 통째로 견주지 않고 좌석에 남긴 지문 셋으로 본다(얼굴 그림 · GLB 가 커서)
const SEP = '\u0001';
let _unreadable = 0;   // 못 읽는 값(돌고 도는 객체)은 부를 때마다 다른 열쇠 — 늘 «바뀜» 으로 다시 배치

function num(v){ return (typeof v === 'number' && isFinite(v)) ? v.toFixed(4) : String(v); }
function vec(v){ return v ? num(v.x) + ',' + num(v.y) + ',' + num(v.z) : '-'; }
function seatId(s){ return s ? (s.isMe ? 'me' : (s.remote ? 'f:' + s.friendId : 'x:' + (s.slot != null ? s.slot : '?'))) : '-'; }

/* 멤버 하나의 «배치에 닿는 칸» 열쇠 — 칸 이름 차례로 · def 는 좌석의 지문 셋(정체성 · 책상 · 파츠) */
function memberKey(member, seat){
  const m = member || {};
  const parts = [];
  Object.keys(m).sort().forEach(k => {
    if(SKIP.has(k) || m[k] === undefined) return;
    let v;
    try{ v = JSON.stringify(m[k]); }catch(_){ v = '?' + (++_unreadable); }
    parts.push(k + '=' + v);
  });
  const s = seat || {};
  parts.push('def=' + s._lastIdentityJSON + SEP + s._lastDeskJSON + SEP + s._lastEquipJSON);
  return parts.join(SEP);
}

/* 책상 — seatDeskHalfWidth 가 재는 것(보이는 자식) · 크기 · 자리 · 책상 없음 표시 */
function deskKey(d){
  if(!d) return 'nodesk';
  const kids = (d.children || []).map(ch => (ch.name || '') + '#' + (ch.uuid || '') + (ch.visible === false ? 'h' : 'v') + vec(ch.position) + vec(ch.scale)).join(';');
  const u = d.userData || {};
  return (d.visible === false ? 'h' : 'v') + vec(d.scale) + vec(d.position) + (u.noDesk ? 'N' : '') + '[' + kids + ']';
}

/* 좌석 줄 모양 — layoutSeatRow 가 읽는 것 중 프레임마다 흔들리지 않는 것 */
function seatShapeKey(seats){
  return (seats || []).map(s => {
    if(!s) return '-';
    const b = s.bench;
    return [
      seatId(s),
      'r' + (s.ridingOn ? seatId(s.ridingOn) : ''),
      's' + (s.seatedOn ? seatId(s.seatedOn) + ':' + s.seatSlot : ''),
      'b' + (b ? (b.uuid || 'b') + ':' + ((b.userData && b.userData.benchSeatCount) || '') + ':' + (s.benchDeskId || '') : ''),
      'd' + deskKey(s.desk),
      'g' + (s.deskGltf ? (s.deskGltf.uuid || 'g') : ''),
      'm' + (s.gltfRoot ? (s.gltfRoot.uuid || 'm') + vec(s.gltfRoot.scale) : ''),
      'u' + num(s.userScale) + '/' + num(s._eqK),
    ].join('|');
  }).join(SEP);
}

/* 좌석 탭 글 — renderSeatTabs 가 쓰는 것(순서 · 나 · 친구 표시 · 이름 · 친구 상태). 고른 좌석은 고르는 자리가 스스로 다시 그린다. */
function seatTabsKey(seats){
  return (seats || []).map(s => s ? ((s.isMe ? 'M' : '') + (s.remote ? 'R' : '') + ':' + (s.friendName || '') + ':' + (s.remote ? (s.remoteState || '') : '')) : '-').join(SEP);
}

/* 이번 모양 — ids 는 실제로 좌석을 세운 멤버(정원으로 자른 뒤) */
function snapshot(seats, friends, ids){
  const bySeat = {};
  (seats || []).forEach(s => { if(s && s.remote) bySeat[s.friendId] = s; });
  const members = {};
  (ids || []).forEach(id => { members[id] = memberKey(friends && friends[id], bySeat[id]); });
  return { members, shape: seatShapeKey(seats), tabs: seatTabsKey(seats) };
}

/* 무엇을 다시 하나 — 지난번(prev)이 없으면 다 한다 */
function plan(prev, next){
  if(!prev || !next) return { layout: true, tabs: true };
  const a = Object.keys(prev.members || {}), b = Object.keys(next.members || {});
  let layout = a.length !== b.length || prev.shape !== next.shape;
  if(!layout) layout = b.some(id => !(id in prev.members) || prev.members[id] !== next.members[id]);
  return { layout, tabs: layout || prev.tabs !== next.tabs };
}

const api = { NON_LAYOUT_FIELDS, memberKey, seatShapeKey, seatTabsKey, snapshot, plan };
if(typeof window !== 'undefined') window.TwSeatSyncDiff = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
