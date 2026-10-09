/* ═══ 📂 마이홈 바탕화면 «폴더 자유배치» — 외부 앱 폴더(북마크 · 말랑이 · 앞으로 생길 폴더)를 끌어서 놓는다 ═══
   ★ 위치는 바탕화면(#mhRoomPreview, 작업표시줄 위까지) 크기에 대한 **비율**로 둔다 — 마이홈 창 크기가 바뀌어도
     비슷한 자리에 남고, 방문자 화면(크기가 다르다)에도 같은 배치로 보인다.
   ★ 배치하는 동안은 폴더를 눌러도 열리지 않는다 — 클릭 · 우클릭을 바깥 상자에서 «먼저»(capture) 막는다.
     폴더마다 제 클릭 처리기를 갖고 있어서(myhome-desktop · mallang) 그쪽을 고치지 않고 한 곳에서 막는 길이다.
   ★ 저장 · 서버 · 방문자 판정은 부르는 쪽(myhome-desktop.js)이 한다. 이 파일은 DOM 을 deps 로 받는다
     (검사에서 가짜 요소로 돈다 — sim-folder-free.js). */
(function(){
'use strict';

const ID_RE = /^[A-Za-z][A-Za-z0-9_-]{0,23}$/;
const MAX_IDS = 12;

/* 서버 · 로컬에서 읽은 값을 믿지 않는다 — 모르는 모양이면 버리고 0~1 로 자른다. */
function cleanPos(o){
  const out = {};
  if(!o || typeof o !== 'object') return out;
  let n = 0;
  for(const id of Object.keys(o)){
    if(n >= MAX_IDS) break;
    const p = o[id];
    if(!ID_RE.test(id) || !p || typeof p !== 'object') continue;
    const x = +p.x, y = +p.y;
    if(!isFinite(x) || !isFinite(y)) continue;
    out[id] = { x: Math.round(Math.min(1, Math.max(0, x)) * 10000) / 10000,
                y: Math.round(Math.min(1, Math.max(0, y)) * 10000) / 10000 };
    n++;
  }
  return out;
}
function samePos(a, b){ return JSON.stringify(cleanPos(a)) === JSON.stringify(cleanPos(b)); }

/* 비율 → 픽셀. 폴더(w×h)가 상자(W×H) 밖으로 안 나가게 자른다. */
function ratioToPx(p, W, H, w, h){
  return { left: Math.round(Math.min(Math.max(0, p.x * W), Math.max(0, W - w))),
           top:  Math.round(Math.min(Math.max(0, p.y * H), Math.max(0, H - h))) };
}
function pxToRatio(left, top, W, H){
  return { x: W > 0 ? left / W : 0, y: H > 0 ? top / H : 0 };
}

/* deps: room() 바탕 상자 · items() [{id, el, reset()}] · getPos() 저장된 배치 · onSave(pos) ·
         band 안내 띠 · bottomInset 작업표시줄 높이 · canArrange() → '' 이면 됨, 아니면 못 하는 이유 · toast · onChange(on) */
function createFolderFree(deps){
  const inset = deps.bottomInset || 0;
  const toast = deps.toast || function(){};
  let arranging = false, draft = null, drag = null, bound = null;

  const box = () => { const r = deps.room(); return r ? { r, W: r.clientWidth, H: Math.max(0, r.clientHeight - inset) } : null; };
  const cur = () => arranging ? draft : cleanPos(deps.getPos());
  const itemOf = (t) => {
    if(!t || !t.closest) return null;
    return (deps.items() || []).find(it => it && it.el && (it.el === t || it.el.contains(t))) || null;
  };

  function apply(){
    const b = box(); if(!b) return;
    const pos = cur();
    (deps.items() || []).forEach(it=>{
      if(!it || !it.el) return;
      const p = pos[it.id];
      if(p){
        const xy = ratioToPx(p, b.W, b.H, it.el.offsetWidth || 66, it.el.offsetHeight || 50);
        it.el.style.right = 'auto'; it.el.style.bottom = 'auto';
        it.el.style.left = xy.left + 'px'; it.el.style.top = xy.top + 'px';
        it.el.classList.add('mhd-ff-placed');
      }else if(it.el.classList.contains('mhd-ff-placed')){
        it.el.classList.remove('mhd-ff-placed');
        try{ it.reset && it.reset(); }catch(_){}
      }
    });
  }

  /* 배치 중 클릭 · 우클릭 · 두 번 클릭은 폴더에 닿기 전에 막는다(capture). */
  function swallow(e){ if(arranging && itemOf(e.target)){ e.preventDefault(); e.stopPropagation(); } }
  function down(e){
    if(!arranging || (e.button != null && e.button !== 0)) return;
    const it = itemOf(e.target); if(!it) return;
    e.preventDefault(); e.stopPropagation();
    drag = { it, sx: e.clientX, sy: e.clientY, ox: it.el.offsetLeft, oy: it.el.offsetTop, moved: false };
    it.el.classList.add('mhd-ff-drag');
  }
  function move(e){
    if(!drag) return;
    const b = box(); if(!b) return;
    const el = drag.it.el, dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if(Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    const x = Math.min(Math.max(0, drag.ox + dx), Math.max(0, b.W - el.offsetWidth));
    const y = Math.min(Math.max(0, drag.oy + dy), Math.max(0, b.H - el.offsetHeight));
    el.style.right = 'auto'; el.style.bottom = 'auto';
    el.style.left = Math.round(x) + 'px'; el.style.top = Math.round(y) + 'px';
  }
  function up(){
    if(!drag) return;
    const d = drag; drag = null;
    d.it.el.classList.remove('mhd-ff-drag');
    const b = box(); if(!b || !d.moved) return;
    draft[d.it.id] = pxToRatio(d.it.el.offsetLeft, d.it.el.offsetTop, b.W, b.H);
    d.it.el.classList.add('mhd-ff-placed');
  }
  function key(e){ if(arranging && e.key === 'Escape'){ e.preventDefault(); finish(); } }

  function bind(on){
    const r = deps.room(); if(!r) return;
    if(on && !bound){
      bound = r;
      r.addEventListener('pointerdown', down, true);
      ['click', 'contextmenu', 'dblclick'].forEach(t=>r.addEventListener(t, swallow, true));
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('keydown', key);
    }else if(!on && bound){
      bound.removeEventListener('pointerdown', down, true);
      ['click', 'contextmenu', 'dblclick'].forEach(t=>bound.removeEventListener(t, swallow, true));
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('keydown', key);
      bound = null;
    }
  }
  function paint(){
    const r = deps.room(); if(r) r.classList.toggle('mhd-ff-arrange', arranging);
    if(deps.band) deps.band.style.display = arranging ? 'flex' : 'none';
    if(deps.onChange) deps.onChange(arranging);
  }

  function start(){
    if(arranging) return true;
    const why = deps.canArrange ? deps.canArrange() : '';
    if(why){ toast(why); return false; }
    arranging = true; draft = cleanPos(deps.getPos());
    bind(true); paint(); apply();
    return true;
  }
  /* 끝내기 — 바뀐 게 있을 때만 저장한다(쓰기 한 번). */
  function finish(){
    if(!arranging) return;
    up();
    const next = cleanPos(draft), changed = !samePos(next, deps.getPos());
    arranging = false; draft = null;
    bind(false); paint();
    if(changed){ deps.onSave(next); toast('폴더 배치를 저장했어요 — 놀러 온 친구에게도 이렇게 보여요'); }
    apply();
  }
  /* 처음 자리로 — 배치 중이면 고르던 것만 비우고([완료] 때 저장), 아니면 바로 저장. */
  function resetAll(){
    if(arranging){ draft = {}; apply(); toast('처음 자리로 돌렸어요 — [완료]를 누르면 저장돼요'); return; }
    if(Object.keys(cleanPos(deps.getPos())).length){ deps.onSave({}); apply(); }
  }
  return { apply, start, finish, toggle(){ return arranging ? (finish(), false) : start(); },
           resetAll, isArranging: () => arranging };
}

const api = { cleanPos, samePos, ratioToPx, pxToRatio, createFolderFree };
if(typeof window !== 'undefined') window.FolderFree = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
