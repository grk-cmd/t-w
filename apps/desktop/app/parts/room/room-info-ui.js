/* room-info-ui.js — 🏷️ 방 안 정보 칸(#inviteActive)의 방 제목 줄 · [⚙ 방 설정](현재 방장만 — 제목 · 공개 바꾸기).
   제목은 _meta.title — 비었거나 금칙어에 걸리면 «방장 닉네임 님의 방» 기본값으로 그린다(규칙은 room-settings.js displayTitle 한 곳).
   방장이 바뀌면(승계) 새 방장에게 버튼이 보이고 옛 방장의 열린 칸은 닫힌다 — 들어감 · 나감 · meta 가 바뀔 때 room-entry 가 paint() 를 부른다.
   저장은 saveInfo 한 곳 — Firebase 방은 _meta 쓰기, 방 서버 방은 서버 meta 요청(app.js 가 고른다). 서버 거절(금칙어 title · 방장 아님 forbidden)은 칸 아래 글로.
   Firebase _meta 는 누구나 쓸 수 있다(규칙) — 그 방에서는 이 버튼이 화면에서만 방장으로 막는다. 방 서버 방은 서버가 «방장만» 을 지킨다.
   classic script(window.TwRoomInfoUi) — app.js 가 방 입장 모듈보다 먼저 createRoomInfoUi(deps) · 부르는 곳은 roomInfoUi.paint().
   검사: checks/sim-room-info-ui.js */
(function(){

/**
 * @param {{
 *   roomSettings: typeof window.TwRoomSettings,
 *   bannedWords: typeof window.TwBannedWords,
 *   rcStore: () => { bannedWords(): string[] },
 *   isHost: () => boolean,
 *   isSecretRoom: () => boolean,
 *   roomCode: () => string|null,
 *   meta: () => { host?: string, title?: string, hostName?: string, open?: boolean }|null,
 *   saveInfo: (room: string, info: { title: string, open?: boolean }) => Promise<{ ok: boolean, code?: string }>,
 *   notifyError: (code: string, err?: unknown) => void,
 * }} deps
 */
function createRoomInfoUi(deps){
const roomSettings = deps.roomSettings;
const bannedWords = deps.bannedWords;
const rcStore = deps.rcStore;
const isHost = deps.isHost;               // 방장 · 시크릿룸 판정은 채팅 잠금과 같은 한 곳(room-state.js TwRoomState)
const isSecretRoom = deps.isSecretRoom;
const roomCode = deps.roomCode;
const meta = deps.meta;
const saveInfo = deps.saveInfo;
const notifyError = deps.notifyError;

const $ = (id) => document.getElementById(id);
let saving = false;
/* 방 서버가 거절한 까닭 → 칸 아래 글(사용자가 고칠 입력 · 바뀐 방장이라 오류 번호가 아니다). 그 밖의 실패는 E-ROOM-04. */
const SERVER_REFUSED_TEXT = Object.freeze({
  title: roomSettings.TITLE_ERROR_TEXT.banned,
  forbidden: '지금 방장만 바꿀 수 있어요',
});

function banned(){ return bannedWords.cleanBannedList(rcStore().bannedWords()); }

function showError(text){ $('riTitleErr').textContent = text || ''; }
function paintForm(){
  $('riTitleCount').textContent = $('riTitleIn').value.trim().length + '/' + roomSettings.TITLE_MAX;
  $('riOpenHint').textContent = $('riOpen').checked ? roomSettings.OPEN_HINT.on : roomSettings.OPEN_HINT.off;
}
function close(){
  $('riPanel').hidden = true;
  showError('');
}

/** 방 안 정보 칸 다시 그리기 — 들어감 · 나감 · meta 가 바뀔 때. 방 밖 · meta 를 아직 못 받았으면 줄째 숨긴다. */
function paint(){
  const code = roomCode(), m = meta();
  const show = !!code && !!m;
  $('riBox').hidden = !show;
  if(!show){ close(); return; }
  const dt = roomSettings.displayTitle(m.title, m.hostName, banned(), bannedWords);
  const t = $('riTitle');
  t.textContent = dt.text;
  t.title = dt.text;
  t.classList.toggle('dim', dt.isDefault);
  const host = isHost();
  $('riEdit').hidden = !host;
  if(!host) close();   // 그새 방장이 넘어갔으면 열린 칸을 닫는다
}

function open(){
  const code = roomCode(), m = meta();
  if(!code || !m || !isHost()) return;
  $('riTitleIn').value = (typeof m.title === 'string') ? m.title : '';
  $('riOpen').checked = m.open === true;
  $('riOpenRow').hidden = isSecretRoom();
  showError('');
  $('riPanel').hidden = false;
  paintForm();
  $('riTitleIn').focus();
}

async function save(){
  if(saving) return;
  const code = roomCode();
  if(!code || !meta() || !isHost()){ close(); paint(); return; }
  const r = roomSettings.checkTitle($('riTitleIn').value, banned(), bannedWords);
  if(!r.ok){ showError(roomSettings.TITLE_ERROR_TEXT[r.reason]); $('riTitleIn').focus(); return; }
  const info = { title: r.title };
  if(!isSecretRoom()) info.open = $('riOpen').checked;
  saving = true;
  $('riSave').disabled = true;
  let res = null;
  try{ res = await saveInfo(code, info); }catch(e){ res = null; }
  saving = false;
  $('riSave').disabled = false;
  if(!(res && res.ok)){
    const why = res && SERVER_REFUSED_TEXT[res.code];
    if(why){ showError(why); $('riTitleIn').focus(); return; }
    notifyError('E-ROOM-04');
    return;
  }
  close();   // 제목 줄은 _meta 구독이 다시 그린다(방 안 모두 같이)
}

$('riEdit').onclick = () => { if($('riPanel').hidden) open(); else close(); };
$('riCancel').onclick = close;
$('riSave').onclick = save;
$('riOpen').onchange = paintForm;
$('riTitleIn').oninput = () => { showError(''); paintForm(); };
$('riTitleIn').onkeydown = (e) => { if(e.key === 'Enter'){ e.preventDefault(); save(); } };

return { paint };
}

window.TwRoomInfoUi = { createRoomInfoUi };

})();
