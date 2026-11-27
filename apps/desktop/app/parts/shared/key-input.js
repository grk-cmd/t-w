/* ═══ ⌨️ 키 입력 공통 — 글자 단축키 · 한글 조합 Enter ══════════════════════════════════════
   app.js 보다 먼저 로드된다(desk-companion-prototype.html). 여기 함수는 전역이라 app.js · animal.js 가 쓴다.

   🍎 [Mac 제보 2026-10-04] 두 가지 모두 «맥은 입력 소스가 시스템 전체에 걸린다» 에서 온다.
   ① 한글 상태에서 T 를 누르면 e.key 가 'ㅅ' 로 와서 글자 단축키가 안 먹었다(Windows 는 입력칸 밖에서 't').
   ② 한글 입력기가 마지막 글자를 조합 중인 채로 Enter keydown 을 보낸다 — 그 Enter 로 보내고 칸을 비우면
      남은 글자가 빈 칸에 확정돼 한 번 더 나간다(«안녕» → «안녕» + «녕»). */

/* 글자 단축키 판정 — 영문 글자가 오면 그대로 쓰고(드보락 등 배열을 존중), 아니면 물리 키(e.code 'KeyT')로 본다.
   돌려주는 값은 소문자 한 글자, 글자 키가 아니면 ''. */
function hotkeyLetter(e){
  const k = String((e && e.key) || '');
  if(/^[a-z]$/i.test(k)) return k.toLowerCase();
  const c = String((e && e.code) || '');
  return /^Key[A-Z]$/.test(c) ? c.slice(3).toLowerCase() : '';
}

function isImeComposing(e){ return !!(e && (e.isComposing || e.keyCode === 229)); }

/* 조합 중인 Enter 는 어느 입력칸의 keydown 에도 닿지 않게 맨 앞(window · 캡처)에서 끊는다.
   칸마다 가드를 넣던 방식은 새 칸에서 빠뜨렸다(모험 채팅 · 이름 편집 등 30곳). 기본 동작은 막지 않으므로
   입력기의 글자 확정은 그대로 되고, 확정 뒤 오는 Enter 는 평소대로 칸에 간다. */
window.addEventListener('keydown', e => {
  if(e.key === 'Enter' && isImeComposing(e)) e.stopImmediatePropagation();
}, true);
