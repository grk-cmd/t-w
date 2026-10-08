/* ═══ 🏷️ 이름 확인 — 운영진처럼 보이는 이름을 새로 정하지 못하게 ══════════════════════════════════
   app.js 보다 먼저 로드된다(desk-companion-prototype.html). commitUserName(닉네임 저장 한 곳)이 부른다.
   **정확히 그 이름일 때만**(앞뒤 공백 · 대소문자 무시) 막는다 — «운영체제덕후» 처럼 말이 들어 있기만 한 이름은 된다.
   규칙 users/$userId/profile .validate 도 같은 목록을 본다(이미 그 이름인 사람은 이름을 바꾸지 않는 한 그대로 둔다). */
const STAFF_NAMES = Object.freeze(['운영자', '관리자', '운영팀', '관리팀', 'admin', 'administrator']);

function isStaffName(name){
  return STAFF_NAMES.includes(String(name == null ? '' : name).trim().toLowerCase());
}
