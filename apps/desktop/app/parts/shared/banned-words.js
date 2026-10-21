/*
 * 방 제목 금칙어 판정 — 한 벌. 서버 함수(require)와 앱(classic script · window.TwBannedWords)이 같은 글을 쓴다.
 * 앱 사본은 apps/desktop/app/parts/shared/banned-words.js 이고 이 파일과 글자까지 같아야 한다(sim-room-settings 가 견준다).
 * 목록은 원격 설정 config/bannedWords(웹 관리자). 공백 · 기호 · 숫자를 끼워 피해 가는 것을 잡으려고
 * 글자만 남기고 소문자로 맞춘 뒤 부분 일치로 본다 — 그래서 숫자만 된 낱말은 걸 수 없고, 한 글자 낱말은 그 글자가 든 제목을 다 막는다.
 */
(function (root) {
  'use strict';
  const BANNED_MAX = 500;   // 목록 상한 — 넘는 줄은 버린다(제목마다 이만큼 훑는다)

  function normalizeWord(s) {
    return String(s == null ? '' : s).normalize('NFKC').toLowerCase().replace(/[^\p{L}]/gu, '');
  }

  // config/bannedWords 의 값(배열 · {0:…} 객체 · 없음) → 맞춘 낱말 배열. 빈 낱말 · 겹침 · 문자열 아닌 값은 버린다.
  function cleanBannedList(raw) {
    const vals = Array.isArray(raw) ? raw : (raw && typeof raw === 'object') ? Object.values(raw) : [];
    const out = [];
    for (const v of vals) {
      if (typeof v !== 'string') continue;
      const w = normalizeWord(v);
      if (w && out.indexOf(w) < 0) out.push(w);
      if (out.length >= BANNED_MAX) break;
    }
    return out;
  }

  // list 는 cleanBannedList 를 거친 것.
  function hasBannedWord(text, list) {
    const t = normalizeWord(text);
    if (!t || !list || !list.length) return false;
    return list.some(w => t.indexOf(w) >= 0);
  }

  const api = { BANNED_MAX, normalizeWord, cleanBannedList, hasBannedWord };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TwBannedWords = api;
})(typeof window !== 'undefined' ? window : globalThis);
