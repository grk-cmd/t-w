/* asset-cards.js — 🃏 자산 카드 공용: 썸네일 카드 한 장(swThumb) · 카드에 GLB 도트 썸네일 얹기(applyDeskDotThumb) · ☰ 끌어서 순서 바꾸기(bindReorderHandle)
   app.js «책상 세팅(5단계)» 머리의 카드 도우미 셋을 그대로 옮긴 모듈이다(C 구역 떼기 w4). 동작은 옮기기 전과 같다(바뀐 줄은 partSceneMod() 읽기 하나).
   ・책임: 카드 DOM 만들기 · 썸네일 캐시(window._deskThumbCache — 성공 data URL · pending · fail) · 포인터로 끄는 순서 바꾸기(HTML5 draggable 은 Electron 에서 불안정).
     생성기 책상 세팅(creator/desk-setup.js)과 꾸미기(character/wardrobe.js)가 같이 쓴다.
   ・받는 deps 1 — 읽는 함수 partSceneMod(도트 썸네일을 굽는 generatePartThumbnail — 뒤에서 만들어짐).
   ・내놓는 것: swThumb(label, on, icon, onDelete, active) · applyDeskDotThumb(rec, card) · bindReorderHandle(handle, cardEl, id, onDrop) — app.js 는 assetCardsMod.이름.
   ・입구 전제: applyDeskDotThumb 는 카드(첫 자식 = 아이콘 상자)가 있어야 · 실패는 조용히(이모지 그대로).
   ⚠️ document 는 전역 이름 그대로. 전역 이름은 TwAssetCards(Tw 접두사 #103).
   검사: checks/sim-asset-cards.js */
(function(){

function createAssetCards(deps){
const partSceneMod = deps.partSceneMod;   // 읽는 함수
/* 🎨 책상 아이템 카드 도트 썸네일 — 꾸미기 파츠와 동일한 렌더러(generatePartThumbnail)를 재사용.
   rec.thumbnail(배포에 포함된 것) 우선, 없으면 GLB에서 지연 생성해 메모리 캐시. 실패 시 이모지 유지. */
function applyDeskDotThumb(rec, it){
  try{
    if(!rec || !it || !it.firstChild) return;
    const c = window._deskThumbCache = window._deskThumbCache || {};
    const put = url=>{ const box=it.firstChild; if(!box||!url) return;
      // 이모지(텍스트 노드)만 제거 — ×삭제·✎수정·☰핸들 등 버튼 엘리먼트는 보존
      Array.from(box.childNodes).forEach(n=>{ if(n.nodeType===3) box.removeChild(n); });
      if(box.querySelector('img.desk-dot-thumb')) return;   // 중복 삽입 방지
      const im=document.createElement('img'); im.className='desk-dot-thumb'; im.src=url; im.draggable=false;
      im.style.cssText='width:52px;height:46px;object-fit:contain;image-rendering:pixelated;pointer-events:none;';
      box.insertBefore(im, box.firstChild||null); };
    const k=rec.id, v=c[k];
    if(typeof v==='string' && v.startsWith('data:')){ put(v); return; }
    if(v==='pending' || v==='fail') return;
    const _t = rec.thumbUrl || rec.thumbnail;
    if(_t){ c[k]=_t; put(_t); return; }
    if((!rec.glb && !rec.glbUrl)){ c[k]='fail'; return; }
    c[k]='pending';
    partSceneMod().generatePartThumbnail(rec).then(url=>{ if(url){ c[k]=url; put(url); } else c[k]='fail'; }).catch(()=>{ c[k]='fail'; });
  }catch(_){}
}
function swThumb(label,on,icon,onDelete,active){ const d=document.createElement('div');
  d.style.cssText='width:66px;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;position:relative;';
  const box=document.createElement('div'); box.textContent=icon||'';
  const borderColor = active ? '#e0842a' : (on?'#7ba05b':'#0002');
  const bgColor = active ? '#fbebd9' : (on?'#eef3e6':'#fffc');
  box.style.cssText='width:60px;height:54px;border-radius:12px;border:2px solid '+borderColor+';background:'+bgColor+';display:flex;align-items:center;justify-content:center;font-size:24px;box-shadow:0 1px 3px #0001;position:relative;';
  if(onDelete){
    const x=document.createElement('div'); x.textContent='×';
    x.style.cssText='position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;background:#d98e73;color:#fff;font-size:13px;line-height:16px;text-align:center;cursor:pointer;box-shadow:0 1px 3px #0003;font-weight:bold;z-index:2;';
    x.onclick=e=>{ e.stopPropagation(); onDelete(); };
    box.appendChild(x);
  }
  const cap=document.createElement('span'); cap.textContent=label; cap.style.cssText='font-size:11px;color:#555;text-align:center;line-height:1.1;max-width:64px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
  d.appendChild(box); d.appendChild(cap); return d; }

// ★ 관리자 전용 카드 순서 재배치 — HTML5 draggable 대신 포인터 이벤트로 직접 구현.
//   (Electron 환경에서 네이티브 HTML5 드래그가 안정적으로 안 먹히는 경우가 있어서 더 확실한 방식 사용)
//   handle: 잡는 손잡이(☰) 엘리먼트, cardEl: 카드 전체(투명도 표시용), id: 이 카드의 식별자,
//   onDrop(draggedId, targetId): 다른 카드 위에서 손을 뗐을 때 호출.
function bindReorderHandle(handle, cardEl, id, onDrop){
  handle.style.touchAction='none';   // 터치/트랙패드 제스처가 가로채는 것 방지
  handle.addEventListener('pointerdown', e=>{
    if(e.button!==0) return;   // 좌클릭만
    e.preventDefault(); e.stopPropagation();
    cardEl.style.opacity='.4';
    let lastOver=null;
    const onMove=(ev)=>{
      const el=document.elementFromPoint(ev.clientX, ev.clientY);
      const card=el && el.closest ? el.closest('[data-reorder-id]') : null;
      if(lastOver && lastOver!==card) lastOver.style.outline='';
      if(card && card.dataset.reorderId!==id){ card.style.outline='2px dashed #7ba05b'; lastOver=card; }
      else lastOver=null;
    };
    const cleanup=()=>{
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      cardEl.style.opacity='1';
      if(lastOver) lastOver.style.outline='';
    };
    const onUp=()=>{
      const target = lastOver;
      cleanup();
      if(target) onDrop(id, target.dataset.reorderId);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  });
}

return {
  applyDeskDotThumb,
  bindReorderHandle,
  swThumb,
};
}

const api = { createAssetCards };
if(typeof window !== 'undefined') window.TwAssetCards = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
