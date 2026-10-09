/* ═══ 🖌 칠하기 도구 — 붓 · 페인트통 · 지우개 ═══════════════════════════════════════════════
   사람 생성기(2 표정 · 3 감은눈) · 동물 생성기(3 표정 · 4 감은눈) · 꾸미기 ✎ 그리기가 같은 도구 줄을 쓴다.
   app.js · animal.js 보다 먼저 로드되고, 각 생성기가 createPaintTools(deps) 로 자기 도구 상태를 하나씩 만든다.
   · 도구는 셋 중 하나만 — 예전의 «지우개 켜고 끄기» 를 대신한다. 부르는 쪽은 onChange 에서
     자기 지우개 변수(eraser · pEraser)를 맞춘다. 붓 · 지우개 획은 예전 그대로 그 변수를 본다.
   · 지우개 = 그림 층을 투명하게(destination-out) — 아래의 바탕(사람은 피부, 동물은 흰색)이 다시 보인다.
     예전 지우개와 같은 뜻이다. 페인트통 Shift+클릭도 같은 방식으로 «누른 조각만» 지운다.
   · 생성기 페인트통은 누른 메쉬의 UV 섬만 칠한다(uv-fill.js fillIsland). 칠할 자리가 있을 때만 되돌리기 한 칸.
     꾸미기는 파츠 하나가 곧 칠할 자리라 예전처럼 누른 메쉬 전체(fillMesh)를 칠한다 — 도구 상태만 여기 것을 쓴다.
   · 셋 중 하나만이라 «지우개 + 채우기» 가 같이 켜질 수 없다. 조각(파츠)을 통째로 지우는 일은 페인트통 Shift+클릭.
   DOM 은 mount 할 때만 만진다 — node 에서 검사한다(sim-paint-tools.js). */
(function(){
'use strict';

const PAINT_TOOLS = ['brush', 'bucket', 'eraser'];
/* 글자 → 도구. C 는 예전부터 지우개 켜고 끄기였다 — 손에 익은 키라 그대로 둔다(toggleEraser). */
const TOOL_BY_KEY = { b:'brush', g:'bucket', e:'eraser' };
const TOOL_INFO = {
  brush:  { label:'붓',      tip:'붓 (B) — 끌어서 그려요' },
  bucket: { label:'페인트통', tip:'페인트통 (G) — 누른 조각만 지금 색으로 채워요 · Shift+클릭은 그 조각 지우기' },
  eraser: { label:'지우개',   tip:'지우개 (E · C) — 끌어서 지워요' },
};

/* 아이콘은 currentColor 로 그린다 — 버튼 글자색(var(--ink))을 따라가서 테마마다 따로 안 만든다. */
const SVG_HEAD = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">';
const ICON_BODY = {
  brush:  '<path d="M14.2 1.8 8.4 7.6"/><path d="M8.6 7.4c-1.7-.5-3.3.5-3.5 2.2-.2 1.5-.9 2.5-2.8 3.1 2.8 1.1 6.9.3 7.4-2.6.2-1.2-.2-2.2-1.1-2.7z" fill="currentColor"/>',
  bucket: '<path d="M2.6 7.6 7.4 2.8l5.4 5.4-4.8 4.8a1.5 1.5 0 0 1-2.1 0L2.6 9.7a1.5 1.5 0 0 1 0-2.1z"/><path d="M2.4 8.4h10.2"/><path d="M5.6 1.2 7.4 3"/><path d="M14.3 10.4s1.1 1.5 1.1 2.3a1.1 1.1 0 0 1-2.2 0c0-.8 1.1-2.3 1.1-2.3z" fill="currentColor"/>',
  eraser: '<path d="M9.6 2.2 14.2 6.8 7.6 13.4H4.4L1.8 10.8z"/><path d="M5.6 6.2l4.6 4.6"/><path d="M7.6 13.4h6.6"/>',
};
const ICON = {};
PAINT_TOOLS.forEach(t=>{ ICON[t] = SVG_HEAD + ICON_BODY[t] + '</svg>'; });

/* 캔버스 위 커서 — 흰 테두리 위에 검은 선이라 밝은 · 어두운 바탕 어디서나 보인다(테마와 무관한 3D 화면 위). */
function _cursor(body, hx, hy, fallback){
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 16 16" fill="none" stroke-linecap="round" stroke-linejoin="round">'
    + '<g stroke="#fff" stroke-width="3">' + body + '</g><g stroke="#000" stroke-width="1.2">' + body + '</g></svg>';
  return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '") ' + hx + ' ' + hy + ', ' + fallback;
}
const TOOL_CURSOR = {
  brush:  'crosshair',
  bucket: _cursor(ICON_BODY.bucket, 21, 20, 'cell'),   // 물방울 끝
  eraser: _cursor(ICON_BODY.eraser, 4, 19, 'cell'),    // 지우개 아래 모서리
};

/* 🪣 페인트통 한 번. 칠할 자리가 있을 때만 되돌리기 한 칸(pushHistory)을 남기고 칠한 뒤 화면을 갱신(blit)한다.
   바꾼 텍셀 수를 돌려준다 — 0 이면 아무것도 안 했다(이력도 안 남긴다). 대칭 두 번째 칸은 pushHistory 없이 부른다. */
/* 여백까지 채운다(uv-fill.js fillIslandOwned — 조각 사이 빈 텍셀은 가까운 조각 몫) · 다른 조각 안쪽은 안 칠한다.
   o.peers = 같은 캔버스에 UV 를 둔 다른 geometry 목록(동물 몸 ↔ 얼굴형 넷 · 귀의 다른 메쉬). */
function applyBucket(o){
  const U = o && o.uvFill;
  if(!U || !o.ctx || !o.geometry) return 0;
  if(!U.islandTriangles(o.geometry, o.size, o.faceIndex, o.uv).length) return 0;   // 못 찾음 · 넓이 0 — 이력도 안 남긴다
  if(typeof o.pushHistory === 'function') o.pushHistory();
  const n = U.fillIslandOwned(o.ctx, o.size, o.geometry, o.faceIndex, o.uv, o.peers, { color:o.color, erase:!!o.erase });
  if(typeof o.blit === 'function') o.blit();
  return n;
}

function createPaintTools(deps){
  const d = deps || {};
  const tips = {};   // 꾸미기는 페인트통 설명이 다르다(d.tips 로 덮는다)
  PAINT_TOOLS.forEach(t=>{ tips[t] = (d.tips && d.tips[t]) || TOOL_INFO[t].tip; });
  let tool = 'brush';
  let btns = {};

  const get = ()=>tool;
  const is = (t)=>tool === t;
  const erasing = ()=>tool === 'eraser';
  const cursor = ()=>TOOL_CURSOR[tool];

  function sync(){
    PAINT_TOOLS.forEach(t=>{
      const b = btns[t]; if(!b) return;
      const on = t === tool;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  function set(t){
    if(PAINT_TOOLS.indexOf(t) < 0 || t === tool) return false;
    const prev = tool;
    tool = t;
    sync();
    if(typeof d.onChange === 'function') d.onChange(t, prev);
    return true;
  }
  const toggleEraser = ()=>set(tool === 'eraser' ? 'brush' : 'eraser');
  /* 색을 골랐으면(칩 · 자유 색 · 스포이드) 지우개는 붓으로 돌아간다 — 예전 «색을 고르면 지우개 꺼짐» 그대로.
     페인트통은 그대로 둔다: 색을 바꿔 가며 조각을 채우는 일이 많다. 도장을 켤 때도 이것을 부른다. */
  const dropEraser = ()=>{ if(tool === 'eraser') set('brush'); };

  /* 글자 키 → 도구 이름(아니면 ''). Ctrl · Cmd · Alt · Shift 가 붙으면 도구 키가 아니다
     (Ctrl+E 관리자 나가기 · 동물 Shift+G 전체 채우기). 한글 상태 맥은 hotkeyLetter(key-input.js)가 물리 키로 본다. */
  function toolForKey(e){
    if(!e || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.repeat) return '';
    const k = typeof d.hotkeyLetter === 'function' ? d.hotkeyLetter(e) : String(e.key || '').toLowerCase();
    return TOOL_BY_KEY[k] || '';
  }
  /* 처리했으면 true — preventDefault 는 부르는 쪽 몫 */
  function handleKey(e){ const t = toolForKey(e); if(!t) return false; set(t); return true; }

  /* 좌클릭이 할 일 — 'stroke'(붓 · 지우개 획) · 'fill' · 'fillErase'(페인트통 + Shift) */
  function pointerAction(e){
    if(tool !== 'bucket') return 'stroke';
    return (e && e.shiftKey) ? 'fillErase' : 'fill';
  }

  const bucket = (o)=>applyBucket(Object.assign({ uvFill:d.uvFill }, o));

  /* 도구 줄을 host 안에 만든다. 다시 부르면 예전 버튼을 버리고 새로 만든다(창을 다시 그리는 경우). */
  function mount(host){
    const doc = d.doc || (host && host.ownerDocument);
    if(!host || !doc) return null;
    const seg = doc.createElement('span');
    seg.className = 'pt-seg';
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-label', '칠하기 도구');
    btns = {};
    PAINT_TOOLS.forEach(t=>{
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'pt-tool' + (d.btnClass ? ' ' + d.btnClass : '');   // 꾸미기 줄은 wd-pic-btn 모양을 입힌다
      b.dataset.tool = t;
      b.title = tips[t];
      b.setAttribute('aria-label', TOOL_INFO[t].label);
      b.innerHTML = ICON[t];
      b.onclick = ()=>set(t);
      seg.appendChild(b);
      btns[t] = b;
    });
    host.innerHTML = '';
    host.appendChild(seg);
    sync();
    return seg;
  }

  return { get, is, set, erasing, cursor, sync, toggleEraser, dropEraser, toolForKey, handleKey, pointerAction, bucket, mount };
}

const api = { PAINT_TOOLS, TOOL_BY_KEY, TOOL_INFO, TOOL_CURSOR, ICON, applyBucket, createPaintTools };
if(typeof window !== 'undefined') window.PaintTools = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
