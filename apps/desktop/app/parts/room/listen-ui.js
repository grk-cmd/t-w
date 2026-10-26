/* listen-ui.js — 🎧 같이 듣기: 창(#listenBox · 상태칩 안 팝업) · 재생 창 다루기 · DJ 의 곡 쓰기 · 상태칩 🎵 버튼 바꾸기.
   같이 듣기 방(_meta.music === true)에 있는 동안만 곡 칸 하나를 구독한다(Firebase rooms/{방}/_music · 방 서버 방은 서버 music — listen-provider.js 가 고른다). 규칙 · 모양은 docs/LISTEN_TOGETHER.md.
   ・지금 DJ = 방에 있는 현재 방장(listen-model djOf). 곡을 쓰는 건 DJ 한 사람뿐 — 듣는 사람은 따라 틀기만.
   ・재생 창은 마이홈 BGM · 플레이리스트와 하나를 나눠 쓴다(나중에 연 쪽이 이김). 다른 쪽이 이기면 «다른 음악이 이김 [다시 듣기]».
   ・창은 #myStatusChip 안에 있어야 실행 화면에서 클릭이 뒤로 새지 않는다(#myPlaylistBox 와 같은 까닭).
   classic script(window.TwListenUi) — app.js 가 방 입장 모듈보다 먼저 createListenUi(deps) · 방 입장 모듈의 «방이 바뀜» 알림(roomEntryMod.onRoomChanged — 들어감 · 나감 · meta)에 sync 를 건다.
   방 입장 모듈이 이 모듈을 deps 로 받으면 방 입장 → 같이 듣기 → 플레이리스트 → … 순환이라 방향을 뒤집어 둔다(sim-dep-cycles).
   검사: checks/sim-listen-ui.js */
(function(){

const VOL_KEY = 'tw.listenVol';     // 기기 설정 — 플레이리스트 음량(tw.playlistVol)과 따로 둔다(방을 나가면 플레이리스트가 제 값으로 연다)
const MUTE_KEY = 'tw.listenMute';
const TICK_MS = 1000;
const SEEK_GAP_MS = 8000;            // 위치 옮기기 사이 최소 간격 — 옮긴 직후 하트비트가 옛 위치를 한 번 더 말해도 또 옮기지 않게
const RETRY_MS = 5000;               // 쓰기가 막힌 뒤 저절로 다시 쓰기까지 — 1초 tick 마다 거부당하지 않게(버튼은 기다리지 않는다)
const VOL_RESEND_MS = [120, 300, 600, 1000, 1600, 2400];   // 새 페이지의 <video> 가 생길 때까지 음량을 다시 보낸다(playlist.js _plApplyVolSoon 과 같은 까닭)

/**
 * @param {{
 *   model: typeof window.TwListenModel,
 *   provider: { subscribe(room: string, cb: (m: object|null|undefined) => void, onErr: (e: unknown) => void): () => void,
 *               write(room: string, m: object|null): Promise<{ ok: boolean, err?: unknown }>, now(): number, lastSeq(): number },
 *   companion: () => any,
 *   roomCode: () => string|null,
 *   meta: () => object|null,
 *   isSecretRoom: () => boolean,
 *   myId: () => string|null,
 *   memberIds: () => string[],
 *   nameOf: (uid: string) => string,
 *   djItems: () => { id: string, title?: string }[],
 *   stopPersonal: () => boolean,   // 내 플레이리스트가 나고 있었으면 멈추고 true(재생 창이 닫힌다)
 *   positionPopup: (el: HTMLElement, btn: HTMLElement) => void,
 *   closeChipPopups: (exceptId: string) => void,   // 열 때 상태칩 드롭메뉴를 닫는다(창 keep 은 남음 — chip-popups.js)
 *   escRegisterWindow: (w: { key: string, el: HTMLElement, isOpen: () => boolean, close: () => void }) => void,
 *   notifyError: (code: string, err?: unknown) => void,
 * }} deps
 */
function createListenUi(deps){
const model = deps.model;
const provider = deps.provider;
const companion = deps.companion;
const roomCode = deps.roomCode;
const meta = deps.meta;
const isSecretRoom = deps.isSecretRoom;
const myId = deps.myId;
const memberIds = deps.memberIds;
const nameOf = deps.nameOf;
const djItems = deps.djItems;
const stopPersonal = deps.stopPersonal;
const positionPopup = deps.positionPopup;
const closeChipPopups = deps.closeChipPopups;
const escRegisterWindow = deps.escRegisterWindow;
const notifyError = deps.notifyError;

const $ = (id) => document.getElementById(id);

let room = null;          // 구독 중인 방 코드
let unsub = null;
let music;                // undefined 불러오는 중 · null 틀 곡 없음 · 곡
let loadFailed = false;
let owner = null;         // 재생 창 주인 — 'listen' 이면 내가 연 곡이 나고 있다
let openedKey = null;     // 내가 연 곡(id|at) — 같은 곡을 다시 열지 않게 · 멈춤을 걸 곡인지 본다
let playerPaused = false;
let lost = false;         // 다른 음악이 이김 — [다시 듣기] 전까지 재생 창을 안 건드린다
let selfCloses = 0;       // 내가 닫은 재생 창의 «닫힘» 알림 수 — 그건 «다른 음악이 이김» 이 아니다(알림이 곡을 연 뒤에 올 수 있다)
let writing = false;
let retryAt = 0;          // 쓰기가 막힌 뒤 저절로 다시 쓰는 때(1초 tick 마다 거부당하지 않게) — 버튼은 기다리지 않는다
let advancedSeq = -1;     // 이 차례 번호에서 이미 다음 곡을 썼다(곡 끝 신호 · 예비 판정 · 버튼이 겹쳐도 한 번)
let errNotified = null;   // 못 트는 곡 알림은 곡마다 한 번
let lastSeekAt = 0;
let tickT = null;
let passOnce = false;     // 🎵 버튼 가로채기를 한 번 건너뛴다(DJ 의 «플레이리스트 고치기»)

function readNum(key, dflt){ try{ const v = parseInt(localStorage.getItem(key), 10); return isFinite(v) ? v : dflt; }catch(_){ return dflt; } }
let vol = Math.max(0, Math.min(100, readNum(VOL_KEY, 80)));
let muted = readNum(MUTE_KEY, 0) === 1;

function now(){ return provider.now(); }
function djId(){ return room ? model.djOf(meta(), [myId()].concat(memberIds())) : null; }
function amDj(){ const me = myId(); return !!me && djId() === me; }

/* ── 재생 창 ── */
function keyOf(m){ return m ? m.id + '|' + m.at : null; }
function applyVol(){ companion().setBgmVolume(muted ? 0 : vol / 100); }
let volT = [];
function applyVolSoon(){ volT.forEach(clearTimeout); volT = VOL_RESEND_MS.map(ms => setTimeout(() => { if(owner === 'listen') applyVol(); }, ms)); applyVol(); }
function closePlayer(){
  if(owner !== 'listen' || !openedKey) return false;
  selfCloses++;
  companion().closeBgm();
  owner = null; openedKey = null; playerPaused = false;
  return true;
}
/* 열 곡이 없을 때만 내 플레이리스트를 멈춘다(창을 닫는다). 곡을 열 때는 닫지 않는다 — 닫기는 늦게 끝나서 막 연 곡을 같이 닫는다.
   여는 쪽이 창을 넘겨받으면 플레이리스트는 onBgmMode 로 제 표시를 내린다(playlist.js). */
function quietPersonal(){ if(stopPersonal()) selfCloses++; }
function openPlayer(m){
  const c = companion();
  c.setBgmLoop(false);   // 개인 «한 곡 반복» 이 남아 있으면 곡 끝 신호가 안 온다
  c.openListenTrack('https://www.youtube.com/watch?v=' + m.id, m.title, Math.floor(model.posOf(m, now())));
  owner = 'listen'; openedKey = keyOf(m); playerPaused = false; lastSeekAt = Date.now();
  applyVolSoon();
}
/* 곡 칸 → 재생 창. 다시 틀기는 pos 에서 새로 연다(at 이 바뀌어 다른 열쇠) — 재생 창의 멈춤은 곡을 새로 열면 풀린다. */
function applyPlayer(){
  if(!room || lost || music === undefined) return;
  if(!music){ if(!closePlayer()) quietPersonal(); return; }
  if(music.paused){
    if(owner === 'listen' && openedKey === keyOf(music)){ if(!playerPaused){ companion().pauseBgm(); playerPaused = true; } }
    else quietPersonal();
    return;
  }
  if(owner === 'listen' && openedKey === keyOf(music)) return;
  openPlayer(music);
}

/* ── DJ 쓰기 ── */
/** 받아졌으면 true — 다른 쓰기 중이라 버렸거나 막혔으면 false */
async function write(m){
  const r0 = room;
  if(!r0 || writing) return false;
  writing = true;
  let r = null;
  try{ r = await provider.write(r0, m); }catch(e){ r = { ok: false, err: e }; }
  writing = false;
  const ok = !!(r && r.ok);
  if(room === r0 && !ok){ retryAt = Date.now() + RETRY_MS; notifyError('E-ROOM-05', r && r.err); }
  return ok;
}
/** 다음(1) · 이전(-1) 곡 — 지금 곡이 옛 DJ 것이면 내 목록 첫 곡부터 · 내 목록이 비면 칸을 지운다(«틀 곡 없음») */
async function advance(dir){
  if(!amDj() || !music || advancedSeq === music.seq) return;
  const seq = music.seq;
  advancedSeq = seq;
  const items = djItems(), me = myId();
  const i = (music.by !== me) ? model.playableFrom(items, 0, 1)
          : model.playableFrom(items, model.stepIndex(items, music.id, dir), dir);
  const ok = await write(i >= 0 ? model.makeMusic(items[i], me, now(), seq) : null);
  if(!ok && advancedSeq === seq) advancedSeq = -1;   // 못 썼으면 이 차례에서 다시 넘길 수 있게
}
/* 내가 DJ 일 때 해야 할 일 — 칸이 비었으면 첫 곡 · 옛 DJ 가 멈춘 채 나갔으면 다시 · 곡이 끝났는데 신호를 못 받았으면 다음 */
function reconcileDj(){
  if(!room || music === undefined || loadFailed || writing || Date.now() < retryAt || !amDj()) return;
  const me = myId();
  if(music === null){
    const items = djItems(), i = model.playableFrom(items, 0, 1);
    if(i >= 0) write(model.makeMusic(items[i], me, now(), provider.lastSeq()));   // 방 서버는 지운 뒤에도 차례를 기억한다
    return;
  }
  // 옛 DJ 가 멈춘 채 나감 — 다시 틀며 쓴 사람을 나로 바꾼다(내가 다시 멈춘 곡을 또 풀지 않게)
  if(music.paused && music.by !== me){ const m = model.resumed(music, now(), me); if(m) write(m); return; }
  if(model.isEnded(music, now())) advance(1);
}
function togglePause(){
  if(!amDj() || !music) return;
  const m = music.paused ? model.resumed(music, now(), myId()) : model.paused(music, now(), myId());
  if(m) write(m);
}

/* ── 재생 창 신호 ── */
function onSignal(kind){
  if(!room || owner !== 'listen' || !music) return;
  if(kind === 'ended'){ advance(1); return; }
  if(kind === 'err'){
    if(errNotified !== music.id){ errNotified = music.id; notifyError('E-ROOM-06'); }
    advance(1);
    return;
  }
  const beat = model.parseBeat(kind);
  if(!beat) return;
  if(model.needSeek(music, now(), beat) && Date.now() - lastSeekAt >= SEEK_GAP_MS){
    lastSeekAt = Date.now();
    companion().bgmSeek(Math.floor(model.posOf(music, now())));
  }
  if(!beat.ad && amDj() && music.by === myId()){ const m = model.withDur(music, beat.dur); if(m) write(m); }
}
function onMode(mode){
  if(mode !== 'listen' && room && !lost){ lost = true; openedKey = null; playerPaused = false; paint(); }
  owner = mode;
}
function onClosed(){
  const mine = selfCloses > 0;
  if(mine) selfCloses--;
  const hadOpen = owner === 'listen';
  owner = null; openedKey = null; playerPaused = false;
  // 내가 닫은 창인데 그 사이 내가 곡을 열었으면 그 곡도 같이 닫혔다 — 다시 연다
  if(mine){ if(hadOpen) applyPlayer(); return; }
  if(room && !lost && music && !music.paused){ lost = true; paint(); }
}
function relisten(){
  if(!room) return;
  lost = false; owner = null; openedKey = null;
  applyPlayer();
  paint();
}

/* ── 구독 ── */
function onMusic(v){
  music = v;
  if(v !== undefined) loadFailed = false;
  applyPlayer();
  reconcileDj();
  paint();
}
function onLoadErr(e){ loadFailed = true; notifyError('E-ROOM-07', e); paint(); }
/* 재생 창 알림은 처음 방에 들어갈 때 건다 — 앱이 아닌 곳(웹 미리보기 · smoke)엔 companion 이 없고, 같이 듣기 방은 앱에서만 들어간다 */
let bound = false;
function bindPlayer(){
  if(bound) return;
  bound = true;
  const c = companion();
  c.onListenSignal(onSignal);
  c.onBgmMode(onMode);
  c.onBgmClosed(onClosed);
}
function start(code){
  bindPlayer();
  room = code; music = undefined; loadFailed = false; lost = false; advancedSeq = -1; errNotified = null; retryAt = 0;
  // 내 플레이리스트는 곡이 오면 재생 창을 넘겨주며 지고, 틀 곡이 없거나 멈춤이면 applyPlayer 가 멈춘다
  unsub = provider.subscribe(code, onMusic, onLoadErr);
  tickT = setInterval(() => { reconcileDj(); paint(); }, TICK_MS);   // DJ · 사람 수가 meta 없이 바뀌어도 창 글이 따라가게
}
function stop(){
  if(unsub){ try{ unsub(); }catch(_){} }
  unsub = null;
  if(tickT) clearInterval(tickT);
  tickT = null;
  if(!lost) closePlayer();   // 나가면 같이 듣기는 멈추고 내 플레이리스트도 멈춘 채로(다른 음악이 이겼으면 그건 그대로 둔다)
  room = null; music = undefined; lost = false; writing = false;
  closeWin();
}
/** 들어감 · 나감 · meta 가 바뀔 때(방 입장 모듈이 부른다) — 같이 듣기 방이면 구독, 아니면 끊는다 */
function sync(){
  const code = roomCode(), m = meta();
  const want = (code && model.isMusicRoom(m)) ? code : null;
  if(want !== room){ if(room) stop(); if(want) start(want); }
  paintButton();
  if(room){ reconcileDj(); paint(); }
}

/* ── 화면 ── */
const box = $('listenBox');
const plBtn = $('myPlBtn');
function isOpen(){ return !!box && !box.classList.contains('hidden'); }
function openWin(){ if(!box || !plBtn) return; closeChipPopups('listenBox'); box.classList.remove('hidden'); plBtn.classList.add('on'); positionPopup(box, plBtn); paint(); }
function closeWin(){ if(!box) return; box.classList.add('hidden'); if(plBtn) plBtn.classList.remove('on'); }
function paintButton(){
  if(!plBtn) return;
  plBtn.textContent = room ? '🎧' : '🎵';
  plBtn.title = room ? '같이 듣기' : '플레이리스트';
}
function fmt(sec){ const s = Math.max(0, Math.floor(sec)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function paintTime(){
  if(!isOpen() || !music) return;
  const p = model.posOf(music, now()), d = Number(music.dur) || 0;
  $('lsNow').textContent = fmt(d > 0 ? Math.min(p, d) : p);
  $('lsLen').textContent = d > 0 ? fmt(d) : '';
  $('lsBar').style.width = (d > 0 ? Math.min(100, p / d * 100) : 0) + '%';
}
/** 지금 무엇을 보여 줄지(글) — 순서가 곧 우선순위 */
function stateText(dj, me){
  if(loadFailed) return '같이 듣기를 불러오지 못했어요';
  if(music === undefined) return '불러오는 중…';
  if(lost) return '다른 음악을 틀고 있어 같이 듣기가 멈췄어요';
  const ended = !!music && model.isEnded(music, now());
  if(!dj && (!music || ended)) return isSecretRoom() ? 'DJ(방 주인)가 없어서 쉬는 중이에요' : 'DJ 가 없어서 쉬는 중이에요';
  if(!music) return dj === me ? '내 플레이리스트가 비어 있어요 — 곡을 담으면 바로 틀어요' : 'DJ 가 아직 곡을 고르지 않았어요';
  if(music.paused) return '⏸ DJ 가 잠시 멈췄어요';
  if(!dj) return 'DJ 가 없어서 이 곡이 끝나면 쉬어요';
  return '';
}
function paint(){
  if(!isOpen()) return;
  const me = myId(), dj = djId(), isDj = !!me && dj === me;
  $('lsTitle').textContent = (music && music.title) || '—';
  $('lsDj').textContent = (dj ? '🎧 DJ ' + nameOf(dj) : 'DJ 없음') + ' · 듣는 사람 ' + (memberIds().length + 1) + '명';
  const msg = stateText(dj, me);
  $('lsMsg').textContent = msg;
  $('lsMsg').hidden = !msg;
  $('lsRetry').hidden = !lost;
  $('lsCtl').hidden = !isDj;
  $('lsEdit').hidden = !isDj;
  $('lsPlay').textContent = (music && music.paused) ? '▶ 다시' : '⏸ 멈춤';
  $('lsPlay').disabled = !music;
  const items = isDj ? djItems() : [];
  const ni = (isDj && music) ? model.playableFrom(items, model.stepIndex(items, music.by === me ? music.id : null, 1), 1) : -1;
  $('lsNext').textContent = (ni >= 0 && items[ni]) ? '다음 곡 · ' + (items[ni].title || items[ni].id) : '';
  $('lsHint').textContent = isDj ? '멈추거나 넘기면 방 사람 모두 같이 바뀌어요' : '곡 · 멈춤 · 넘기기는 DJ 가 정해요 · 나는 소리 크기만';
  $('lsVol').value = String(vol);
  $('lsMute').textContent = muted ? '🔇' : '🔊';
  paintTime();
}

if(box && plBtn){
  // 같이 듣기 방에서는 🎵 를 누르면 같이 듣기 창 — 플레이리스트(playlist.js)의 클릭 처리보다 먼저(캡처) 가로챈다
  plBtn.addEventListener('click', (e) => {
    if(!room) return;
    if(passOnce){ passOnce = false; return; }
    e.stopImmediatePropagation(); e.stopPropagation();
    if(isOpen()) closeWin(); else openWin();
  }, true);
  $('lsClose').addEventListener('click', (e) => { e.stopPropagation(); closeWin(); });
  $('lsRetry').addEventListener('click', (e) => { e.stopPropagation(); relisten(); });
  $('lsPlay').addEventListener('click', (e) => { e.stopPropagation(); togglePause(); });
  $('lsSkip').addEventListener('click', (e) => { e.stopPropagation(); advance(1); });
  $('lsPrev').addEventListener('click', (e) => { e.stopPropagation(); advance(-1); });
  $('lsEdit').addEventListener('click', (e) => { e.stopPropagation(); closeWin(); passOnce = true; plBtn.click(); });
  $('lsVol').addEventListener('input', () => {
    vol = Math.max(0, Math.min(100, parseInt($('lsVol').value, 10) || 0));
    try{ localStorage.setItem(VOL_KEY, String(vol)); }catch(_){}
    if(owner === 'listen') applyVol();
  });
  $('lsMute').addEventListener('click', (e) => {
    e.stopPropagation();
    muted = !muted;
    try{ localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); }catch(_){}
    if(owner === 'listen') applyVol();
    paint();
  });
  escRegisterWindow({ key: 'listen', el: box, isOpen, close: closeWin });
}

return { sync, djId };
}

window.TwListenUi = { createListenUi };

})();
