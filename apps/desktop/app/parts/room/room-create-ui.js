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
 *   rcStore: () => { bannedWords(): string[] },
 *   maxPeople: () => number,
 *   isLicensed: () => boolean,
 *   serverRoomLikely: () => Promise<boolean>,   // 새 방이 방 서버로 갈 것인가 — 방 서버는 아직 같이 듣기를 모른다(docs/LISTEN_TOGETHER.md 5장)
 *   onCreate: (channel: string, settings: { title: string, max: number, open: boolean, music: boolean }) => void,
 * }} deps
 */
function createRoomCreateUi(deps){
const roomSettings = deps.roomSettings;
const bannedWords = deps.bannedWords;
const rcStore = deps.rcStore;
const maxPeople = deps.maxPeople;
const isLicensed = deps.isLicensed;
const serverRoomLikely = deps.serverRoomLikely;
const onCreate = deps.onCreate;

const $ = (id) => document.getElementById(id);
let channel = 'workingroom';
let max = 0;
let openSeq = 0;   // 창을 다시 열었으면 지난 «내 서버» 확인 결과는 버린다

function paint(){
  $('rcChWorking').classList.toggle('on', channel === 'workingroom');
  $('rcChTogether').classList.toggle('on', channel === 'togetherroom');
  $('rcChTogether').disabled = !isLicensed();
  const cap = maxPeople();
  $('rcMax').textContent = max + '명';
  $('rcMaxDown').disabled = max <= roomSettings.ROOM_MAX_MIN;
  $('rcMaxUp').disabled = max >= cap;
  $('rcMaxHint').textContent = roomSettings.ROOM_MAX_MIN + '명부터 ' + cap + '명까지';
  $('rcOpenHint').textContent = $('rcOpen').checked ? roomSettings.OPEN_HINT.on : roomSettings.OPEN_HINT.off;
  $('rcTitleCount').textContent = $('rcTitle').value.trim().length + '/' + roomSettings.TITLE_MAX;
}
function showError(text){ $('rcTitleErr').textContent = text || ''; }
function setShown(on){
  $('roomCreatePanel').hidden = !on;
  $('lobbyMain').hidden = on;
  $('inviteJoinPanel').hidden = on;
}

/** @param {string} ch 'workingroom' | 'togetherroom' */
function open(ch){
  channel = (ch === 'togetherroom' && isLicensed()) ? 'togetherroom' : 'workingroom';
  max = maxPeople();
  $('rcTitle').value = '';
  $('rcOpen').checked = true;
  $('rcMusic').checked = false;   // 만든 뒤엔 못 바꾸니 늘 꺼진 채로 연다(docs/LISTEN_TOGETHER.md 1장)
  // 방 서버 방에서는 켜도 아무 일 없는 칸이라 숨긴다 — 확인이 끝날 때까지는 숨겨 둔다
  $('rcMusicRow').hidden = true;
  const seq = ++openSeq;
  serverRoomLikely().then((server) => {
    if(seq !== openSeq || $('roomCreatePanel').hidden) return;
    $('rcMusicRow').hidden = server;
  });
  showError('');
  setShown(true);
  paint();
  $('rcTitle').focus();
}
function close(){ setShown(false); }

function submit(){
  const r = roomSettings.checkTitle($('rcTitle').value, bannedWords.cleanBannedList(rcStore().bannedWords()), bannedWords);
  if(!r.ok){ showError(roomSettings.TITLE_ERROR_TEXT[r.reason]); $('rcTitle').focus(); return; }
  close();
  onCreate(channel, { title: r.title, max: roomSettings.clampMax(max, maxPeople()), open: $('rcOpen').checked, music: !$('rcMusicRow').hidden && $('rcMusic').checked });
}

$('rcChWorking').onclick = () => { channel = 'workingroom'; paint(); };
$('rcChTogether').onclick = () => { if(isLicensed()){ channel = 'togetherroom'; paint(); } };
$('rcMaxDown').onclick = () => { max = roomSettings.clampMax(max - 1, maxPeople()); paint(); };
$('rcMaxUp').onclick = () => { max = roomSettings.clampMax(max + 1, maxPeople()); paint(); };
$('rcOpen').onchange = paint;
$('rcTitle').oninput = () => { showError(''); paint(); };
$('rcTitle').onkeydown = (e) => { if(e.key === 'Enter'){ e.preventDefault(); submit(); } };
$('rcCreate').onclick = submit;
$('rcCancel').onclick = close;
$('inviteClose').addEventListener('click', close);   // 모달을 닫으면 다음에 열 때 로비부터 보이게

return { open, close };
}

window.TwRoomCreateUi = { createRoomCreateUi };

})();
