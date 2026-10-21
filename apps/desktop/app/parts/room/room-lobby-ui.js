/* room-lobby-ui.js — 🗂️ 방 목록 로비(방 만들기 / 참여하기 모달 안 #lobbyMain).
   워킹룸 · 투게더룸 탭 · 전체 / 빈자리 있는 방 · 카드 12장(3 × 4) · 쪽 넘기기 · [방 만들기] · [빠른시작] · 맨 위 «내 시크릿룸» 줄.
   목록은 모달이 열릴 때 · [새로 고침] · 열려 있는 동안 60초마다만 읽는다(구독 없음 — 사본은 서버 함수가 1분마다 만든다).
   카드는 글(textContent)로만 그린다 — 남이 쓴 제목 · 닉네임이 HTML 로 읽히지 않게. 긴 제목은 카드에 마우스를 올리면 흐른다(CSS).
   classic script(window.TwRoomLobbyUi) — app.js 가 방 만들기 창 뒤에서 createRoomLobbyUi(deps) · 밖에서 부르는 이름 없음.
   검사: checks/sim-room-lobby-ui.js */
(function(){

const REFRESH_MS = 60 * 1000;
const CHANNEL_LABEL = Object.freeze({ workingroom: '워킹룸', togetherroom: '투게더룸' });
const TEXT = Object.freeze({
  empty: '지금 공개된 방이 없어요 — 처음으로 방을 열어 보세요',
  emptyOpen: '빈자리 있는 공개 방이 없어요',
  missing: '방 목록이 아직 준비되지 않았어요 — 잠시 후 다시 불러와 주세요',
  stale: '목록이 늦게 갱신되고 있어요 — 인원은 조금 다를 수 있어요',
  noQuick: '지금 들어갈 수 있는 공개 방이 없어요 — 방을 만들어 보세요',
  togetherLocked: '투게더룸은 라이선스가 있어야 만들 수 있어요',
  quickFailed: '방 목록을 못 불러왔어요 — 다시 불러온 뒤 눌러 주세요',
});

/**
 * @param {{
 *   model: typeof window.TwRoomLobbyModel,
 *   provider: { listRooms(channel: string): Promise<{ at: number|null, rooms: object }|null>, mySecretRoom(): Promise<{ code: string, name: string }|null>, secretGuests(code: string): Promise<number|null> },
 *   inRoom: () => boolean,
 *   twNav: typeof window.TwNav,
 *   maxPeople: () => number,
 *   isLicensed: () => boolean,
 *   joinRoom: (code: string) => Promise<void>,
 *   openCreate: (channel: string) => void,
 *   toast: (msg: string) => void,
 *   notifyError: (code: string, err?: unknown) => void,
 *   now: () => number,
 *   random: () => number,
 * }} deps
 */
function createRoomLobbyUi(deps){
const model = deps.model;
const provider = deps.provider;
const inRoom = deps.inRoom;   // 방 안이면 모달은 «연결된 방» 화면이라 로비가 안 보인다 — 읽지 않는다
const twNav = deps.twNav;     // 방을 나와 로비가 다시 보이면 room-entry 가 NAV.ROOM_LOBBY 로 알린다(서로를 모르게)
const maxPeople = deps.maxPeople;
const isLicensed = deps.isLicensed;
const joinRoom = deps.joinRoom;
const openCreate = deps.openCreate;
const toast = deps.toast;
const notifyError = deps.notifyError;
const now = deps.now;
const random = deps.random;

const $ = (id) => document.getElementById(id);
const st = { channel: 'workingroom', onlyOpen: false, page: 0, node: undefined, state: null, loading: false, joining: false, timer: null, seq: 0, secretSeq: 0 };

function el(tag, cls, text){
  const e = document.createElement(tag);
  if(cls) e.className = cls;
  if(text != null) e.textContent = text;
  return e;
}

// 카드 = 위 띠(입장 가능 / 가득 참 — 색 + 낱말) + 몸(번호 · 제목 · 방장 · 인원)
function cardEl(c){
  const b = el('button', 'lb-card' + (c.full ? ' full' : ''));
  b.type = 'button';
  b.disabled = c.full;
  b.title = c.full ? '가득 찼어요' : c.title;
  const band = el('span', 'lb-band');
  band.appendChild(el('span', 'lb-state', c.full ? '가득 참' : '입장 가능'));
  b.appendChild(band);
  const body = el('span', 'lb-body');
  body.appendChild(el('span', 'lb-no', c.no));
  const mid = el('span', 'lb-mid');
  const top = el('span', 'lb-top');
  if(c.music) top.appendChild(el('span', 'lb-tag', '같이 듣기'));
  const box = el('span', 'lb-title-box');
  box.appendChild(el('span', 'lb-title' + (c.titleIsDefault ? ' dim' : ''), c.title));
  top.appendChild(box);
  mid.appendChild(top);
  mid.appendChild(el('span', 'lb-host', c.host ? c.hostLabel + ' ' + c.host : c.hostLabel + ' —'));
  body.appendChild(mid);
  body.appendChild(el('span', 'lb-count', c.n + '/' + c.max));
  b.appendChild(body);
  if(!c.full) b.onclick = () => join(c.code);
  return b;
}

// 긴 제목만 흐르게 — 칸보다 넘치는 길이를 재서 CSS 변수로(움직임은 CSS 가 마우스를 올렸을 때만)
function measureTitles(){
  for(const t of $('lobbyGrid').querySelectorAll('.lb-title')){
    const over = t.scrollWidth - t.parentNode.clientWidth;
    t.classList.toggle('long', over > 0);
    if(over > 0) t.style.setProperty('--lb-d', (-over - 4) + 'px');
  }
}

function paint(){
  const cap = maxPeople();
  const r = model.cardsFrom(st.node === undefined ? { at: now(), rooms: {} } : st.node, { now: now(), cap, onlyOpen: st.onlyOpen });
  $('lobbyTabWorking').classList.toggle('on', st.channel === 'workingroom');
  $('lobbyTabTogether').classList.toggle('on', st.channel === 'togetherroom');
  $('lobbyAll').classList.toggle('on', !st.onlyOpen);
  $('lobbyOpen').classList.toggle('on', st.onlyOpen);
  $('lobbyRefresh').disabled = st.loading;
  const grid = $('lobbyGrid');
  grid.textContent = '';
  const ok = r.state === 'ok' || r.state === 'stale';
  $('lobbyInfo').textContent = st.loading ? '불러오는 중…'
    : ok ? CHANNEL_LABEL[st.channel] + ' 공개 방 ' + r.total + '개 · 빈자리 있는 방 ' + r.open + '개' : '';
  $('lobbyNote').textContent = r.state === 'stale' ? TEXT.stale : '';
  const pg = model.pageOf(r.list, st.page);
  st.page = pg.page;
  if(r.state === 'failed' || r.state === 'missing'){
    const box = el('div', 'lb-state-box');
    box.appendChild(el('b', 'lb-err', r.state === 'failed' ? '방 목록을 못 불러왔어요' : TEXT.missing));
    const again = el('button', 'lc-btn ghost', '다시 불러오기');
    again.type = 'button';
    again.onclick = () => refresh();
    box.appendChild(again);
    grid.appendChild(box);
  }else if(!pg.items.length && !st.loading){
    grid.appendChild(el('div', 'lb-state-box', st.onlyOpen && r.total ? TEXT.emptyOpen : TEXT.empty));
  }else{
    for(const c of pg.items) grid.appendChild(cardEl(c));
  }
  $('lobbyPage').textContent = (pg.page + 1) + ' / ' + pg.pages;
  $('lobbyPrev').disabled = pg.page <= 0;
  $('lobbyNext').disabled = pg.page >= pg.pages - 1;
  $('lobbyCreate').title = (st.channel === 'togetherroom' && !isLicensed()) ? TEXT.togetherLocked : '';
  st.cards = r.list;
  st.state = st.loading ? null : r.state;
  measureTitles();
}

// quiet — 60초 갱신은 실패해도 알리지 않는다(사람이 누른 불러오기만 알린다 · 화면에는 늘 «못 불러왔어요»)
async function refresh(quiet){
  const my = ++st.seq;
  st.loading = true;
  paint();
  let node = null;
  try{ node = await provider.listRooms(st.channel); }catch(e){ node = null; }
  if(my !== st.seq) return;   // 그새 탭을 바꿨으면 늦게 온 답은 버린다
  st.loading = false;
  st.node = node;
  if(node === null && !quiet) notifyError('E-ROOM-03');
  paint();
}

async function paintSecret(){
  const my = ++st.secretSeq;   // 그새 다시 열었으면 늦게 온 답은 버린다
  const row = $('lobbySecret');
  let s = null;
  try{ s = await provider.mySecretRoom(); }catch(_){ s = null; }
  if(my !== st.secretSeq) return;
  row.hidden = !s;
  if(!s) return;
  $('lobbySecretName').textContent = s.name;
  $('lobbySecretCount').textContent = '';
  $('lobbySecretJoin').onclick = () => join(s.code);
  let g = null;
  try{ g = await provider.secretGuests(s.code); }catch(_){ g = null; }
  if(my === st.secretSeq && g != null) $('lobbySecretCount').textContent = '손님 ' + g + '/' + Math.max(0, maxPeople() - 1);
}

async function join(code){
  if(st.joining) return;
  st.joining = true;
  try{ await joinRoom(code); }finally{ st.joining = false; }
}

// 모달이 닫혔으면(닫기 · 바깥 클릭 · ESC · 입장) 스스로 멈춘다 · 만들기 창이 덮었거나 방 안이면 이번 차례만 건너뛴다
function startTimer(){
  stopTimer();
  st.timer = setInterval(() => {
    if(!$('inviteOverlay').classList.contains('on')){ stopTimer(); return; }
    if(!$('lobbyMain').hidden && !inRoom()) refresh(true);
  }, REFRESH_MS);
}
function stopTimer(){ if(st.timer){ clearInterval(st.timer); st.timer = null; } }

/** 모달이 열릴 때 — 목록 · 내 시크릿룸을 읽고 60초 갱신을 건다. */
function onOpen(){
  if(inRoom()){ stopTimer(); return; }
  st.page = 0;
  refresh();
  paintSecret();
  startTimer();
}

function setChannel(ch){
  if(st.channel === ch) return;
  st.channel = ch;
  st.page = 0;
  st.node = undefined;
  refresh();
}

$('lobbyTabWorking').onclick = () => setChannel('workingroom');
$('lobbyTabTogether').onclick = () => setChannel('togetherroom');
$('lobbyAll').onclick = () => { st.onlyOpen = false; st.page = 0; paint(); };
$('lobbyOpen').onclick = () => { st.onlyOpen = true; st.page = 0; paint(); };
$('lobbyRefresh').onclick = () => refresh();
$('lobbyPrev').onclick = () => { st.page--; paint(); };
$('lobbyNext').onclick = () => { st.page++; paint(); };
$('lobbyCreate').onclick = () => {
  if(st.channel === 'togetherroom' && !isLicensed()){ toast(TEXT.togetherLocked); return; }
  openCreate(st.channel);
};
$('lobbyQuick').onclick = () => {
  if(st.state === 'failed'){ toast(TEXT.quickFailed); return; }
  if(st.state === 'missing'){ toast(TEXT.missing); return; }
  const code = model.pickQuick(st.cards || [], random());
  if(!code){ toast(TEXT.noQuick); return; }
  join(code);
};
for(const id of ['lcInvite', 'fsInviteCreate']) $(id).addEventListener('click', onOpen);
$('inviteClose').addEventListener('click', stopTimer);
twNav.on(twNav.NAV.ROOM_LOBBY, onOpen);

}

window.TwRoomLobbyUi = { createRoomLobbyUi, REFRESH_MS, TEXT };

})();
