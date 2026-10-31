/* ═══ ⚠️ 에러코드 — 사용자에게 보이는 실패에 붙이는 번호 표 · 알리는 통로 ══════════════
   [왜] 실패 토스트가 «수락에 실패했어요» 처럼 문구만 있으면, 제보를 받아도 어느 코드 줄에서
     났는지 알 수 없다. 토스트에 짧은 번호(E-영역-번호)를 붙여 두면 사용자는 그 번호를 불러 주고,
     우리는 이 표에서 파일 · 함수를 바로 찾는다(목록 · 규칙은 docs/ERROR_CODES.md).
   ★ 번호 규칙
     · 모양은 E-영역-두자리. 영역은 앱 폴더와 맞춘다(AREAS).
     · 한 번 쓴 번호는 **다시 쓰지 않는다.** 걷은 번호는 RETIRED 로 옮긴다 — 옛 앱 사용자는
       옛 번호를 계속 불러 준다.
     · 새 번호는 표에 먼저 넣고 부른다. 표에 없는 번호를 부르면 검사(sim-error-codes)가 빨강이다.
   ★ 부르는 법: TwErrorCodes.notify('E-FR-01', err) — 표의 문구로 토스트를 띄우고 진단 기록에 한 줄.
     문구에 개수처럼 그때그때 다른 말이 필요하면 셋째 인자로 준다(번호는 그대로 붙는다).
   ⚠️ 이 파일은 app.js 보다 먼저 실린다. 토스트(app.js 의 toast)는 **부를 때** 찾는다 — 실릴 때는 아직 없다.
   DOM 을 직접 안 만진다(검사 sim-error-codes.js). */
(function(){
'use strict';

const AREAS = {
  ACC: '계정 · 로그인 · 초대',
  FR: '친구 · 친구 요청',
  MH: '마이홈 · 방명록 · 우편',
  ROOM: '방 입장 · 나가기 · 방 목록',
  CHAT: '채팅',
  CHAR: '캐릭터 · 꾸미기 · 가챠',
  FOCUS: '포커스 · 레벨',
  PL: '플레이리스트',
  DATA: '(걷음) 범용 데이터 통로 — 걷은 번호만',
  NET: '서버 통로 공통(API · realtime)',
  SYS: '그 밖',
};
const CODE_RE = /^E-([A-Z]+)-(\d{2})$/;

/* 문구는 사용자에게 그대로 보인다 — 무엇이 안 됐는지 + (있으면) 할 일. where 는 우리가 찾을 자리. */
const CODES = {
  'E-SYS-01': { msg: '알 수 없는 오류가 났어요', where: '(예비) 어디서 났는지 모를 때' },
  'E-FR-01': { msg: '친구 요청을 수락하지 못했어요', where: 'myhome/friend-manage.js — 요청 팝업 · 받은 요청 [수락]' },
  'E-FR-02': { msg: '친구 요청을 거절하지 못했어요', where: 'myhome/friend-manage.js — 요청 팝업 · 받은 요청 [거절]' },
  'E-FR-03': { msg: '보낸 친구 요청을 취소하지 못했어요', where: 'myhome/friend-manage.js — 보낸 요청 [취소]' },
  'E-FR-04': { msg: '선택한 친구 요청 일부를 처리하지 못했어요', where: 'myhome/friend-manage.js — 받은 요청 일괄 수락 · 거절' },
  'E-ACC-01': { msg: '닉네임을 저장하지 못했어요 — 다시 해 주세요', where: 'account/user-name.js — 닉네임 저장 뒤 서버 계정 이름(PATCH /v1/me — login-flow patchMe) 실패' },
  'E-ACC-02': { msg: '비밀번호를 확인하지 못했어요 — 잠시 뒤 다시 해 주세요', where: 'account/account.js — 비밀번호 바꾸기 · 탈퇴 · 붙이기 전 «비밀번호 확인» 창에서 너무 많이 틀림(too-many-requests) · 네트워크 실패(틀린 비밀번호는 창 안에 알림)' },
  'E-ACC-03': { msg: '서버에 연결하지 못했어요 — 인터넷 연결을 확인하고 다시 시도해 주세요', where: 'account/license-gate.js — «서버에 연결할 수 없어요» 화면에서 누른 [다시 시도] 가 또 닿지 못함(켤 때 자동으로 한 확인에는 번호 없음)' },
  'E-MH-01': { msg: '도움말을 불러오지 못했어요 — 인터넷 연결을 확인하고 다시 시도해 주세요', where: 'myhome/help-tab.js — 도움말 탭 틀에서 페이지 알림이 시간 안에 안 옴(LOAD_MS)' },
  'E-MH-02': { msg: '배경 그림을 불러오지 못했어요 — https 로 시작하는 주소를 써 주세요', where: 'myhome/mh-bg-url.js — http 배경 주소를 https 로 바꿔 불러 봤는데 못 받음(내 마이홈 · 바탕화면만)' },
  'E-MH-03': { msg: '온라인 고정을 서버에 저장하지 못했어요 — 이 PC 에는 기억했어요', where: 'myhome/presence-lock.js — 🔒 고정 · 고정 중 토글 저장(서버 계정 presencePref — PATCH /v1/me)' },
  'E-MH-08': { msg: '우편을 불러오지 못했어요 — 우편함의 «다시 시도» 를 눌러 주세요', where: 'myhome/mail-feed.js — 내 우편 받기 실패(fetchMail 던짐 — 알림함을 열 때 · «다시 시도» 를 누를 때(연 · 누른 받기에서만) · 이어지는 동안 한 번만 알림)' },
  'E-MH-09': { msg: '소식을 불러오지 못했어요 — 우편함의 «다시 시도» 를 눌러 주세요', where: 'launcher/notice-feed.js — 공지 한 판(소식 · 업데이트 공지 · 배너) 받기 실패(fetchBoard 던짐 — 알림함을 열 때 · «다시 시도» 를 누를 때(연 · 누른 받기에서만) · 이어지는 동안 한 번만 알림)' },
  'E-MH-10': { msg: '우편을 읽음으로 바꾸지 못했어요 — 잠시 뒤 다시 눌러 주세요', where: 'myhome/mail-feed.js — 읽음 · 모두 읽음 서버 쓰기 실패(markRead · markAllRead failed — 계정이 바뀌는 중(stale)은 조용히 버림)' },
  'E-MH-11': { msg: '우편을 지우지 못했어요 — 잠시 뒤 다시 눌러 주세요', where: 'myhome/mail-feed.js — 우편 지우기 서버 쓰기 실패(remove · removeRead failed — 읽은 우편 한꺼번에는 한 번에 실패하면 아무것도 안 지운 그대로)' },
  'E-MH-12': { msg: '소식을 올리거나 고치지 못했어요 — 관리자 권한과 연결을 확인해 주세요', where: 'launcher/notice-feed.js — 관리자 소식 올리기 · 📌 고정 · 내리기 실패(sendBroadcast · togglePin · remove — 409 는 다시 받고 알림)' },
  'E-ROOM-01': { msg: '방 목록을 불러오지 못했어요 — 잠시 후 다시 시도해 주세요', where: 'room/room-entry.js — 랜덤 참여 · 갈아타기 (findRandomRooms)' },
  'E-ROOM-02': { msg: '방을 옮기지 못했어요 — 참여를 다시 눌러 주세요', where: 'room/room-entry.js — 갈아타기 뒤 방 밖에 남음' },
  'E-ROOM-03': { msg: '방 목록을 불러오지 못했어요 — 다시 불러오기를 눌러 주세요', where: 'room/room-lobby-ui.js — 로비 목록 사본(roomLobby/{채널}) 읽기 실패' },
  'E-ROOM-04': { msg: '방 설정을 저장하지 못했어요 — 잠시 후 다시 눌러 주세요', where: 'room/room-info-ui.js — 방 안 [방 설정] 제목 · 공개 쓰기(setRoomInfo) 실패' },
  'E-ROOM-05': { msg: '같이 듣기 곡을 바꾸지 못했어요 — 잠시 후 다시 눌러 주세요', where: 'room/listen-ui.js — DJ 의 곡 칸(rooms/{방}/_music) 쓰기 실패' },
  'E-ROOM-06': { msg: '이 곡은 여기서 틀 수 없어요 — 다음 곡을 기다려 주세요', where: 'room/listen-ui.js — 재생 창이 곡을 못 틂(유튜브 재생 불가 · 지역 제한)' },
  'E-ROOM-07': { msg: '같이 듣기를 불러오지 못했어요 — 방에 다시 들어와 주세요', where: 'room/listen-ui.js — 곡 칸(rooms/{방}/_music) 구독 거부' },
  'E-CHAR-01': { msg: '프리셋을 저장하지 못했어요', where: 'creator/desk-preset.js — 생성기 📐 책상 프리셋 저장 · 비우기 (saveDeskPresets · tw.deskPresets)' },
  'E-CHAR-02': { msg: '프리셋을 읽지 못했어요', where: 'creator/desk-preset-store.js — 생성기 📐 책상 프리셋 읽기 해석 실패 (loadDeskPresets · tw.deskPresets)' },
  'E-CHAR-03': { msg: '프리셋의 책상 모델을 불러오지 못했어요', where: 'creator/desk-preset.js — applyDeskPreset 책상 GLB 해석 실패' },
  'E-CHAR-04': { msg: '프리셋을 저장하지 못했어요', where: 'character/animal.js — 동물 프리셋 저장 · 삭제 (_savePresets · tw.animalPresets)' },
  'E-CHAR-05': { msg: '프리셋을 읽지 못했어요', where: 'character/animal.js — 동물 프리셋 읽기 해석 실패 (_loadPresets · tw.animalPresets)' },
  'E-CHAR-06': { msg: '저장된 프리셋을 읽지 못해 덮어쓰지 않았어요', where: 'creator/desk-preset.js — 📐 책상 프리셋 저장 · 비우기를 막음(tw.deskPresets 해석 실패 · json-store save blocked)' },
  'E-CHAR-07': { msg: '저장된 프리셋을 읽지 못해 덮어쓰지 않았어요', where: 'character/animal.js — 동물 프리셋 저장 · 삭제를 막음(tw.animalPresets 해석 실패 · json-store save blocked)' },
  'E-CHAR-08': { msg: '프리셋의 책상을 찾지 못해 기본 책상으로 열었어요', where: 'creator/desk-preset.js — applyDeskPreset 카탈로그 책상을 못 찾음 · 못 받음(프리셋엔 id 만)' },
  'E-CHAR-09': { msg: '로그인이 풀려 있어 뽑지 않았어요 — 다시 로그인한 뒤 뽑아 주세요(횟수는 그대로예요)', where: 'character/gacha.js — 뽑기 서버 저장 거부 · 내 코드 없음 (gachaDraw · updateGacha denied · 서버 길 401/403)' },
  'E-CHAR-10': { msg: '서버에 닿지 않아 뽑지 않았어요 — 인터넷 연결을 확인하고 다시 시도해 주세요(횟수는 그대로예요)', where: 'character/gacha.js — 뽑기 전 연결 확인 실패 (updateGacha offline · 서버 길 닿지 못함 · 5xx)' },
  'E-CHAR-11': { msg: '서버 응답이 늦어 뽑기 결과를 확인하지 못했어요 — 잠시 뒤 보관함을 열어 확인해 주세요', where: 'character/gacha.js — 뽑기 트랜잭션 시간 초과 (updateGacha timeout · 늦게 붙으면 onLate 로 사본에 합침 · 서버 길은 상태를 다시 받음)' },
  'E-CHAR-12': { msg: '뽑기를 저장하지 못했어요 — 잠시 후 다시 시도해 주세요(횟수는 그대로예요)', where: 'character/gacha.js — 뽑기 트랜잭션 오류 (updateGacha error · 서버 길 GACHA_BUSY · CATALOG_NOT_READY · 그 밖 4xx — gacha-server.js reasonOf)' },
  'E-CHAR-13': { msg: '책상 모델을 받지 못했어요 — 인터넷 연결을 확인하고 다시 눌러 주세요', where: 'character/wardrobe.js — 꾸미기 🪑 책상 탭에서 카탈로그 책상 고르기 (resolveCatalogGlb 실패 · rec.glb 없음)' },
  'E-CHAR-14': { msg: '책상 모델을 받지 못했어요 — 인터넷 연결을 확인하고 다시 눌러 주세요', where: 'creator/desk-setup.js — 생성기 책상 카드 고르기 (resolveCatalogGlb 실패 · rec.glb 없음)' },
  'E-MH-04': { msg: '일정을 불러오지 못했어요 — 인터넷 연결을 확인하고 안내 글자를 눌러 다시 시도해 주세요', where: 'myhome/scheduler.js — 달력 · 기념일 · D-day · 오늘 일정 · 친구 태그 알림 받기 실패(이어지는 동안 한 번만)' },
  'E-MH-05': { msg: '카드 그림을 올리지 못해 저장하지 않았어요 — 다시 눌러 주세요', where: 'myhome/scheduler.js — 기념일 카드 그림 올리기 실패 · 서버가 그림 주소를 거절(IMAGE_UPLOAD · SCHEDULE_INVALID_IMAGE_URL)' },
  'E-MH-06': { msg: '친구만 태그할 수 있어요 — 친구 목록을 확인해 주세요', where: 'myhome/scheduler.js — 일정 · 기념일 저장의 그 밖의 태그 거절(SCHEDULE_TAG_SELF 등 — 아무것도 저장되지 않음). 친구가 아닌 사람 태그(SCHEDULE_TAG_NOT_FRIEND)는 번호 없이 안내 토스트' },
  'E-MH-07': { msg: '기념일 · D-day 는 각각 10개까지예요', where: 'myhome/scheduler.js — 서버가 기념일 · D-day 상한 초과를 거절(SCHEDULE_DDAY_FULL)' },
  'E-PL-01': { msg: '플레이리스트를 저장하지 못했어요 — 고치거나 창을 다시 열면 다시 올려요', where: 'status/playlist.js — 내 목록 서버 저장 실패(_plPublishNow · saveMine failed — 이어지는 동안 한 번만 알림 · 혼자 다시 올리지 않음)' },
  'E-PL-02': { msg: '파도타기는 인터넷 연결이 필요해요', where: 'status/playlist.js — 🌊 파도타기 무작위 · 친구 지목에서 목록을 못 불러옴(_plPeek · _plPeekFriend — fetchRandom · fetchOf 던짐)' },
  'E-NET-01': { msg: '로그인이 풀렸어요 — 다시 로그인해 주세요', where: 'shared/api-errors.js — 공통 AUTH_REQUIRED · 토큰 없음(NO_TOKEN)' },
  'E-NET-02': { msg: '이 작업을 할 권한이 없어요', where: 'shared/api-errors.js — 공통 ACCESS_DENIED' },
  'E-NET-03': { msg: '프리미엄에서 쓸 수 있는 기능이에요', where: 'shared/api-errors.js — 공통 PREMIUM_REQUIRED(이 기기 판정 — X-Device-Id)' },
  'E-NET-04': { msg: '요청이 너무 잦아요 — 잠시 뒤 다시 해 주세요', where: 'shared/api-errors.js — 공통 TOO_MANY_REQUESTS(Retry-After)' },
  'E-NET-05': { msg: '다른 곳에서 먼저 바뀌었어요 — 다시 시도해 주세요', where: 'shared/api-errors.js — 공통 CONCURRENT_UPDATE(다시 받고 한 번 더)' },
  'E-NET-06': { msg: '요청 모양이 맞지 않아 처리하지 못했어요', where: 'shared/api-errors.js — 공통 INVALID_REQUEST · METHOD_NOT_ALLOWED · UNSUPPORTED_MEDIA_TYPE · PAYLOAD_TOO_LARGE' },
  'E-NET-07': { msg: '서버에 닿지 못했어요 — 인터넷 연결을 확인하고 다시 해 주세요', where: 'shared/api-errors.js — 닿지 못함(네트워크 · 시간 초과 · 5xx · 사본 없음)' },
  'E-NET-08': { msg: '서버에서 처리하지 못했어요 — 잠시 뒤 다시 해 주세요', where: 'shared/api-errors.js — 표에 없는 code(기능 표 · 공통 표 둘 다 없음)' },
};
/* 걷은 번호 — { 번호: '언제 · 왜' }. 다시 쓰지 않으려고 남긴다. */
const RETIRED = {
  'E-DATA-01': '0.13 · 범용 데이터 통로(data-gateway.js)를 걷음 — 서버 오류는 api-errors.js(E-NET)',
  'E-DATA-02': '0.13 · 범용 데이터 통로(data-gateway.js)를 걷음 — 서버 오류는 api-errors.js(E-NET)',
  'E-DATA-03': '0.13 · 범용 데이터 통로(data-gateway.js)를 걷음 — 서버 오류는 api-errors.js(E-NET)',
  'E-DATA-04': '0.13 · 범용 데이터 통로(data-gateway.js)를 걷음 — 서버 오류는 api-errors.js(E-NET)',
};

const REPEAT_MS = 10000;   // 같은 번호를 이 안에 또 부르면 토스트는 한 번만(연타 · 일괄 처리) — 기록은 남는다
const TOAST_MS = 4000;     // 번호를 읽고 적을 시간 — 기본 토스트(1.9초)보다 길게
const KEEP = 20;           // 최근 기록 몇 개를 들고 있을지(나중에 제보에 붙일 몫)

function isCode(code){
  const m = CODE_RE.exec(String(code || ''));
  return !!(m && Object.prototype.hasOwnProperty.call(AREAS, m[1]));
}
function info(code){ return CODES[code] || null; }
function toastText(code, text){
  const c = CODES[code] ? code : 'E-SYS-01';
  return '⚠️ ' + (text || CODES[c].msg) + ' · 오류 ' + c;
}
/* 진단 기록 한 줄 — 원인 글은 짧게(남의 이름 같은 긴 글이 섞이지 않게 code · message 만). */
function diagText(code, err){
  let why = '';
  if(err != null){
    why = (typeof err === 'object') ? String(err.code || err.message || '') : String(err);
    why = why.replace(/[\r\n]+/g, ' ').slice(0, 80);
  }
  return '[오류] ' + code + (why ? ' ' + why : '');
}

/* deps: toast(msg, icon, ms) · diag(line) · now() · muted()(참이면 기록만 · 토스트 없음) — 모두 부를 때 찾는다. */
function createErrorNotice(deps){
  const d = deps || {};
  const now = d.now || (()=>Date.now());
  const lastShown = {};
  const recent = [];
  function notify(code, err, text){
    const c = CODES[code] ? code : 'E-SYS-01';
    const at = now();
    recent.push({ code: c, at });
    if(recent.length > KEEP) recent.shift();
    try{ if(d.diag) d.diag(diagText(c, err)); }catch(_){}
    try{ console.warn('[오류] ' + c, err == null ? '' : err); }catch(_){}
    if(d.muted && d.muted()) return false;   // 서버 점검 중 — 실패는 점검 창이 알린다(maintenance-gate.js)
    if(lastShown[c] && at - lastShown[c] < REPEAT_MS) return false;
    lastShown[c] = at;
    try{ if(d.toast) d.toast(toastText(c, text), null, TOAST_MS); }catch(_){}
    return true;
  }
  return { notify, recent: ()=>recent.slice() };
}

const api = {
  AREAS, CODES, RETIRED, CODE_RE, REPEAT_MS, TOAST_MS, KEEP,
  isCode, info, toastText, diagText, createErrorNotice,
};
/* 렌더러에서는 하나를 만들어 바로 쓴다 — 토스트 · 진단은 app.js · preload 가 걸어 둔 것을 부를 때 찾는다. */
if(typeof window !== 'undefined'){
  const notice = createErrorNotice({
    toast: (...a)=>window.toast(...a),   // app.js 의 전역 toast — 실패 알림은 부팅 뒤에만 난다(새 typeof 가드 금지)
    diag: (line)=>{ if(window.companion && window.companion.diagNote) window.companion.diagNote(line); },
    muted: ()=>window.TwMaintenance.store.on(),
  });
  api.notify = notice.notify;
  api.recent = notice.recent;
  window.TwErrorCodes = api;
}
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
