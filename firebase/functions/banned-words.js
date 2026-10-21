/*
 * 방 제목 금칙어 판정. 목록은 원격 설정 config/bannedWords(웹 관리자 ⚙️ 설정)에 있다.
 * 앱의 같은 판정(방 만들기 · 방 설정)과 규칙이 같아야 한다 — 앱이 막은 제목을 여기서 놓치거나 그 반대가 되지 않게.
 * 공백 · 기호 · 숫자를 끼워 피해 가는 것을 잡으려고 글자만 남기고 소문자로 맞춘 뒤 부분 일치로 본다.
 */
'use strict';
const BANNED_MAX = 500;   // 목록 상한 — 규칙 config/bannedWords/$i(0~499) · 웹 관리자 칸과 같은 값

function normalizeWord(s){
  return String(s == null ? '' : s).normalize('NFKC').toLowerCase().replace(/[^\p{L}]/gu, '');
}

// config/bannedWords 의 값(배열 · {0:…} 객체 · 없음) → 맞춘 낱말 배열. 빈 낱말 · 겹침 · 문자열 아닌 값은 버린다.
function cleanBannedList(raw){
  const vals = Array.isArray(raw) ? raw : (raw && typeof raw === 'object') ? Object.values(raw) : [];
  const out = [];
  for (const v of vals){
    if (typeof v !== 'string') continue;
    const w = normalizeWord(v);
    if (w && out.indexOf(w) < 0) out.push(w);
    if (out.length >= BANNED_MAX) break;
  }
  return out;
}

// list 는 cleanBannedList 를 거친 것.
function hasBannedWord(text, list){
  const t = normalizeWord(text);
  if (!t || !list || !list.length) return false;
  return list.some(w => t.indexOf(w) >= 0);
}

module.exports = { BANNED_MAX, normalizeWord, cleanBannedList, hasBannedWord };
