/* image-bytes.js — 🖼 data: 그림 → 올릴 바이트 한 곳 (검사 sim-image-bytes.js)
   [왜] 화면이 줄여 만든 그림은 data:image/…;base64,… 글이다. 서버 올리기(POST /v1/me/images?purpose=…)는 바이트 그대로 받는다.
     이 풀기 · 형식 · 크기 판정이 말랑이(gift-api) · 일정 카드(schedule-api) · 박수 그림(guestbook-api)에 세 벌 있던 것을 한 곳으로 모았다.
   [내보냄] window.TwImageBytes
     parseDataUrl(u) → { type, bytes: Uint8Array } | null — data:<종류>/<세부>;base64,<글> 모양이 아니거나 base64 가 깨졌으면 null
     inspect(u, { types, maxBytes }) → { ok: true, type, bytes } | { ok: false, why: 'format' | 'empty' | 'large' }
       format = 모양이 아니거나 types 에 없는 종류 · empty = 바이트 0 · large = maxBytes 초과(maxBytes 와 같으면 통과)
   classic script — 쓰는 provider · app.js 보다 먼저 싣는다. 아무것도 부르지 않는다(순수). */
(function(){
'use strict';

/* data:image/…;base64,… → { type, bytes }. 형식이 아니면 null */
function parseDataUrl(u){
  const m = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]*)$/.exec(typeof u === 'string' ? u : '');
  if(!m) return null;
  let bin;
  try{ bin = atob(m[2]); }catch(_){ return null; }
  const bytes = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { type: m[1], bytes };
}

/* 풀고 올려도 되는지 본다 — 종류(types) · 비어 있지 않음 · 크기(maxBytes) */
function inspect(u, opts){
  const o = opts || {};
  const img = parseDataUrl(u);
  if(!img || !Array.isArray(o.types) || o.types.indexOf(img.type) < 0) return { ok: false, why: 'format' };
  if(img.bytes.length === 0) return { ok: false, why: 'empty' };
  if(typeof o.maxBytes === 'number' && img.bytes.length > o.maxBytes) return { ok: false, why: 'large' };
  return { ok: true, type: img.type, bytes: img.bytes };
}

const api = { parseDataUrl, inspect };
if(typeof window !== 'undefined') window.TwImageBytes = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
