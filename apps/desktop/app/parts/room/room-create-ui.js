/* room-create-ui.js — 🏷️ 방 만들기 창(제목 · 방 종류 · 최대 인원 · 방 목록 공개 · 🎧 같이 듣기).
   방 찾기 · 만들기 모달(#inviteModal) 안의 #roomCreatePanel 을 쓴다 — 로비의 [방 만들기] 를 누르면 로비 · 코드 칸 대신 보이고,
   [방 만들기] 를 누르면 제목을 확인해(금칙어 · 길이) onCreate(채널, 설정) 를 부른다. 모달 안이라 클릭 통과 목록을 따로 늘리지 않는다.
   여는 곳은 로비(room-lobby-ui.js)의 [방 만들기] — 그 탭의 채널로 연다(투게더룸은 보유자만).
   classic script(window.TwRoomCreateUi) — app.js 가 방 입장 모듈 뒤에서 createRoomCreateUi(deps) · 부르는 곳은 roomCreateUi.open(채널).
   검사: checks/sim-room-settings.js */
(function(){

/**
 * @param {{
 *   roomSettings: typeof window.TwRoomSettings,
 *   bannedWords: typeof window.TwBannedWords,
 *   rcStore: () => { bannedWords(): string[], answered(): boolean, ready(want: unknown, ms: number): Promise<unknown>, refresh(): Promise<unknown>, onChange(fn: (c: object, key: string) => void): unknown },
 *   maxPeople: () => number|null,
 *   isLicensed: () => boolean,
 *   premiumBlocked: (locked?: () => void) => 'unknown'|'locked',
 *   premiumKnown: () => boolean,
 *   listenEnabled: boolean,
 *   onCreate: (channel: string, settings: { title: string, max: number, open: boolean, music: boolean }) => void,
 * }} deps
 */
function createRoomCreateUi(deps){
const roomSettings = deps.roomSettings;
const bannedWords = deps.bannedWords;
const rcStore = deps.rcStore;
const maxPeople = deps.maxPeople;
const isLicensed = deps.isLicensed;
const premiumBlocked = deps.premiumBlocked;   // 프리미엄이 아니라 못 열 때 — 모르면 «라이선스 확인 중» · 아니면 넘긴 잠금(account-state.js)
const premiumKnown = deps.premiumKnown;   // 읽는 함수 — 서버가 프리미엄을 확인해 줬나(아니면 «아님» 이 아니라 «모름»)
const onCreate = deps.onCreate;
const listenEnabled = deps.listenEnabled;   // 🎧 같이 듣기 스위치(listen-model.js ENABLED) — 꺼져 있으면 «같이 듣기 방» 칸을 숨기고 싣지 않는다

const $ = (id) => document.getElementById(id);
let channel = 'workingroom';
let max = null;   // 고른 최대 인원 — 정원을 모르는 동안은 null(10 으로 짐작하지 않는다)
let retrying = false;   // [다시 시도] 로 정원을 다시 묻는 중

/* 정원(원격 설정 roomMaxPeople)을 모르면 — 받는 중이면 «불러오는 중», 첫 답이 왔는데도 모르면 «불러오지 못했어요 [다시 시도]».
   모르는 동안 + · − · [방 만들기] 는 꺼 둔다(정원 판정은 서버지만 고를 범위를 짐작해 보이지 않는다). */
const CAP_LOADING = '정원을 불러오는 중이에요…';
const CAP_FAILED = '정원을 불러오지 못했어요';
const CAP_WAIT_MS = 15000;   // 첫 답을 기다리는 상한 — 첫 받기가 실패해도(값이 안 바뀌어 onChange 가 안 온다) 답이 오면 «불러오지 못했어요» 로 다시 그린다
function paintCapUnknown(){
  const failed = !retrying && rcStore().answered();
  $('rcMax').textContent = '';
  $('rcMaxDown').disabled = true;
  $('rcMaxUp').disabled = true;
  $('rcMaxHint').textContent = failed ? CAP_FAILED : CAP_LOADING;
  $('rcMaxRetry').hidden = !failed;
  $('rcCreate').disabled = true;
}
function paint(){
  $('rcChWorking').classList.toggle('on', channel === 'workingroom');
  $('rcChTogether').classList.toggle('on', channel === 'togetherroom');
  $('rcChTogether').disabled = !isLicensed() && premiumKnown();   // 모르면 잠그지 않는다 — 누르면 «확인 중»
  $('rcOpenHint').textContent = $('rcOpen').checked ? roomSettings.OPEN_HINT.on : roomSettings.OPEN_HINT.off;
  $('rcTitleCount').textContent = $('rcTitle').value.trim().length + '/' + roomSettings.TITLE_MAX;
  const cap = maxPeople();
  if(cap == null){ paintCapUnknown(); return; }
  if(max == null) max = cap;   // 연 뒤에 정원이 왔다 — 처음 값은 정원
  $('rcMaxRetry').hidden = true;
  $('rcCreate').disabled = false;
  $('rcMax').textContent = max + '명';
  $('rcMaxDown').disabled = max <= roomSettings.ROOM_MAX_MIN;
  $('rcMaxUp').disabled = max >= cap;
  $('rcMaxHint').textContent = roomSettings.ROOM_MAX_MIN + '명부터 ' + cap + '명까지';
}
function showError(text){ $('rcTitleErr').textContent = text || ''; }
function setShown(on){
  $('roomCreatePanel').hidden = !on;
  $('lobbyMain').hidden = on;   // 코드 칸도 로비 아래 줄에 있어 같이 숨는다
}

/** @param {string} ch 'workingroom' | 'togetherroom' */
function open(ch){
  channel = (ch === 'togetherroom' && isLicensed()) ? 'togetherroom' : 'workingroom';
  max = maxPeople();   // 모르면 null — 정원이 오면 paint 가 채운다
  retrying = false;
  if(max == null && !rcStore().answered()) rcStore().ready(null, CAP_WAIT_MS).then(() => { if(!$('roomCreatePanel').hidden) paint(); });   // 첫 답(성공 · 실패)이 오면 한 번 다시 그린다
  $('rcTitle').value = '';
  $('rcOpen').checked = true;
  $('rcMusic').checked = false;   // 만든 뒤엔 못 바꾸니 늘 꺼진 채로 연다(docs/LISTEN_TOGETHER.md 1장)
  $('rcMusicRow').hidden = !listenEnabled;   // 🎧 스위치가 꺼져 있으면 칸째 숨긴다(listen-model.js ENABLED)
  showError('');
  setShown(true);
  paint();
  $('rcTitle').focus();
}
function close(){ setShown(false); }

function submit(){
  const cap = maxPeople();
  if(cap == null || max == null) return;   // 정원을 모른다 — 단추가 꺼져 있다(Enter 로도 만들지 않는다)
  const r = roomSettings.checkTitle($('rcTitle').value, bannedWords.cleanBannedList(rcStore().bannedWords()), bannedWords);
  if(!r.ok){ showError(roomSettings.TITLE_ERROR_TEXT[r.reason]); $('rcTitle').focus(); return; }
  close();
  onCreate(channel, { title: r.title, max: roomSettings.clampMax(max, cap), open: $('rcOpen').checked, music: listenEnabled && $('rcMusic').checked });
}

$('rcChWorking').onclick = () => { channel = 'workingroom'; paint(); };
$('rcChTogether').onclick = () => { if(isLicensed()){ channel = 'togetherroom'; paint(); } else premiumBlocked(); };   // 모르면 «확인 중»(아님이면 단추가 꺼져 있다)
$('rcMaxDown').onclick = () => { const cap = maxPeople(); if(cap == null || max == null) return; max = roomSettings.clampMax(max - 1, cap); paint(); };
$('rcMaxUp').onclick = () => { const cap = maxPeople(); if(cap == null || max == null) return; max = roomSettings.clampMax(max + 1, cap); paint(); };
$('rcOpen').onchange = paint;
$('rcTitle').oninput = () => { showError(''); paint(); };
$('rcTitle').onkeydown = (e) => { if(e.key === 'Enter'){ e.preventDefault(); submit(); } };
$('rcCreate').onclick = submit;
/* [다시 시도] — 원격 설정을 한 번 더 묻는다(받는 동안 «불러오는 중»). 받은 값은 아래 onChange 가 그린다 · 그래도 모르면 «불러오지 못했어요» 로 */
$('rcMaxRetry').onclick = () => {
  retrying = true; paint();
  Promise.resolve(rcStore().refresh()).catch(() => {}).then(() => { retrying = false; if(!$('roomCreatePanel').hidden) paint(); });
};
rcStore().onChange((c, key) => { if(key === 'roomMaxPeople' && !$('roomCreatePanel').hidden) paint(); });   // 창을 연 채 정원이 오거나 바뀌면 다시 그린다
$('rcCancel').onclick = close;
$('inviteClose').addEventListener('click', close);   // 모달을 닫으면 다음에 열 때 로비부터 보이게

return { open, close };
}

window.TwRoomCreateUi = { createRoomCreateUi };

})();
