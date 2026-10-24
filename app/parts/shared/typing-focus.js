/* typing-focus.js — ⌨️ 우리 창 입력칸에 글자를 치는 중인지 main 에 알리기 · 한글 조합 진단
   왜: main 이 입력하는 동안 mac 전역 키 훅을 쉬게 한다(launcher/hook-pause-policy.js 머리 주석). 그동안 전역 키로 오던
     «입력 있음»(자동 자리비움 판정 anyInput)은 여기서 입력칸 keydown 으로 채운다.
   진단: 입력칸에서 나올 때, 지우기 키 없이 글자가 지워진 일이 있었으면 한 줄 남긴다(조합이 깨진 흔적 · 1분에 한 번까지).
   deps: send(on) — main 에 입력 중인가 · anyInput() · diagNote(msg) · now()
   내놓는 것: isTypingTarget(el) · attach(doc)
   검사: checks/sim-hook-pause.js */
(function(){
'use strict';

const TEXT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel']);   // 한글을 칠 수 있는 칸만 — 슬라이더 · 체크 · 색은 아니다
const DELETE_KEY_MS = 150;     // 지우기 키 뒤 이만큼 안의 지움은 사람이 지운 것
const DIAG_GAP_MS = 60000;

function isTypingTarget(el){
  if(!el) return false;
  if(el.isContentEditable) return true;
  if(el.tagName === 'TEXTAREA') return true;
  if(el.tagName !== 'INPUT') return false;
  return TEXT_TYPES.has(String(el.type || 'text').toLowerCase());
}

function createTypingFocus(deps){
  const send = deps.send;
  const anyInput = deps.anyInput;
  const diagNote = deps.diagNote;
  const now = deps.now;
  let typing = false, comps = 0, keyless = 0, delKeyAt = -Infinity, diagAt = -Infinity;

  function flush(){
    if(keyless > 0 && now() - diagAt >= DIAG_GAP_MS){
      diagAt = now();
      diagNote('[입력] 지우기 키 없이 글자가 지워짐 ' + keyless + '번 · 한글 조합 ' + comps + '번');
    }
    comps = 0; keyless = 0;
  }
  function update(doc){
    const on = isTypingTarget(doc.activeElement);
    if(on === typing) return;
    typing = on;
    send(on);
    if(!on) flush();
  }
  function attach(doc){
    send(false);   // 다시 불러온 화면이면 main 에 남은 «입력 중» 을 지운다
    doc.addEventListener('focusin', () => update(doc), true);
    doc.addEventListener('focusout', () => update(doc), true);
    doc.addEventListener('keydown', e => {
      if(!typing) return;
      anyInput();
      if(e.key === 'Backspace' || e.key === 'Delete') delKeyAt = now();
    }, true);
    doc.addEventListener('compositionstart', () => { if(typing) comps++; }, true);
    doc.addEventListener('input', e => {
      if(!typing || e.isComposing) return;
      if(String(e.inputType || '').indexOf('deleteContent') === 0 && now() - delKeyAt > DELETE_KEY_MS) keyless++;
    }, true);
  }
  return { attach, isTypingTarget };
}

const api = { createTypingFocus, isTypingTarget };
if(typeof window !== 'undefined') window.TwTypingFocus = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
