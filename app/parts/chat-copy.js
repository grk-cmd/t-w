/* ═══ 📋 대화 복사 형식 — parts/chat-copy.js ═══════════════════════════════════════
   대화창(#chatMessages)에서 고른 메시지를 클립보드용 글자로 바꾼다. 화면(DOM)은 안 본다 — 원문만.
   ★ 이모티콘 생략은 **원문 마커 기준**이다. DOM 에서 img 를 빼는 방식은 렌더링이 바뀌면 깨진다.
   ★ 한 메시지 = 한 줄 `이름: 내용`. 시각은 안 넣는다. 이모티콘을 뺀 뒤 내용이 비면 그 줄은 통째로 뺀다.
   ⚠️ app.js 보다 먼저 싣는다(classic script · window.ChatCopy). 검사 sim-chat-copy.js 가 node 로 돌린다. */
(function(root){
  'use strict';
  const EMOJI_RE = /\[(?:emoji|demoji):[^\]]*\]/g;
  // 🎲 주사위 마커는 그림 대신 글자로 — 지우면 "주사위를 굴렸다"는 뜻이 사라진다.
  const DICE_RE = /\[dice:([1-6])\]/g;

  function bodyText(text){
    return String(text == null ? '' : text)
      .replace(EMOJI_RE, ' ')
      .replace(DICE_RE, '🎲$1')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }
  /* 한 줄. 내용이 비면 null — 이모티콘만 있던 줄은 빠진다. */
  function lineFor(msg){
    if(!msg) return null;
    const body = bodyText(msg.text);
    if(!body) return null;
    return String(msg.name || '?') + ': ' + body;
  }
  function textFor(msgs){
    return (msgs || []).map(lineFor).filter(Boolean).join('\n');
  }
  const api = { EMOJI_RE, bodyText, lineFor, textFor };
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ChatCopy = api;
})(typeof window !== 'undefined' ? window : this);
