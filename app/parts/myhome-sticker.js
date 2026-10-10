/* myhome-sticker.js — 🎨 마이홈 스티커 관리 창(목록 · ◎ 데려오기 · ✎ 편집 · ✨ 움직임 · 🔗 링크 · × 삭제 · 전부 화면 안으로)
   · 스티커 편집모드(우클릭) · 드래그 이동 · 회전 핸들 · 크기 핸들
   app.js 의 «🎨 스티커 관리 창» 구역 가운데 스티커 몫 두 덩이를 그대로 옮긴 모듈이다(앱 FSD 7번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
     · 앞 덩이 — 스티커 관리 창(openStickerMgr ~ 창 버튼 연결)
     · 뒤 덩이 — 편집모드 · 드래그 · 회전 · 크기(_mhStickerEditStart ~ _mhBindStickerResize)
   두 덩이 사이에 끼어 있던 🔗 마이홈 본문 링크(bindMyHomeExternalLinks)와, 뒤에 붙은 마이홈 페이지 편집 묶음(bindMyHomePage —
   자동저장 · 프로필 사진 · 글 서식 · 새 스티커 붙이기 · 닉네임 · 🎵 BGM · 배경 · 테마 · 👑 디자인 스튜디오 · 프리셋)은
   스티커 관리 창이 아니라 app.js 에 남겼다(지도 7번 비고 — 다음 단계에서 따로 나눈다).

   ★ 아래 본문은 app.js 에 있던 글 그대로다 — 들여쓰기도 바꾸지 않았다(옮기기 전 줄과 견주어 볼 수 있게).
     바뀐 것은 app.js 의 let 을 읽고 쓰는 방법뿐이다.
       · _myHomeData → _myHomeData() · _mhViewingUserId → _mhViewingUserId() · _mhStickerEditSid → _mhStickerEditSid()
         app.js 가 다시 대입하는 let 이라(불러오기 · 친구 홈 관람 · 편집모드) 값이 아니라 읽는 함수로 받는다.
       · _mhStickerEditSid = x → _setMhStickerEditSid(x) · _mhStickerDragDist = x → _setMhStickerDragDist(x)
         두 let 은 app.js 의 renderMyHomeStickers 가 읽고(편집 표시 · 드래그 직후 링크 안 엶), 마이홈 페이지 편집 묶음도
         _mhStickerDragDist 를 쓰므로 app.js 에 두고 쓰는 함수로 받는다.
   ★ renderMyHomeStickers · commitMyHomePage 는 화살표로 받는다 — renderMyHomeStickers 는 app.js 의 마이홈 페이지 편집 묶음이
     나중에 감싸 다시 대입하고(삭제 버튼에 자동 저장을 붙인다), commitMyHomePage 는 그 묶음이 window 에 거는 이름이다.
     부를 때 찾아야 예전과 같은 함수를 부른다.
   ★ 밖으로 내놓는 이름은 반환값이다(open · close · render · bringIn · editStart · editEnd · bindDrag · bindRotate · bindResize).
     부르는 곳(app.js 의 renderMyHomeStickers · 마이홈 닫기 · [+ 스티커] · 새 스티커 붙이기)은 전부 사용자가 마이홈을 연 뒤에 돌므로
     만드는 줄보다 늦다 — myHomeSticker.이름 으로 부른다.
   ★ createMyHomeSticker 는 app.js 의 원래 자리에서 부른다. 만들 때 바로 도는 것(#stMgrClose · #stMgrBringAll 버튼 연결)이
     예전과 같은 순서 · 같은 때에 돈다.
   ⚠️ document · window · confirm 은 예전처럼 전역 이름으로 쓴다(이 파일은 app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwMyHomeSticker — 크로미움 내장 전역과 겹치는 이름(Scheduler 같은)을 쓰면 typeof 가드가 늘 통과한다(#103).
   검사: checks/sim-myhome-sticker.js — 만들 때 배선 · 관리 창 열기(관람 중 막힘) · 목록 · ◎ · ✎ · 🔗 · × · 전부 화면 안으로 ·
         편집모드 · 드래그 · 회전 · 크기 · app.js 배선 · html 순서. */
(function(){

function createMyHomeSticker(deps){
const toast = deps.toast;
const asyncPrompt = deps.asyncPrompt;                    // ✏️ 인앱 프롬프트(🔗 링크 바꾸기)
const commitMyHomePage = deps.commitMyHomePage;          // 💾 자동 저장 — app.js 마이홈 페이지 편집 묶음이 window 에 건다
const renderMyHomeStickers = deps.renderMyHomeStickers;  // 🎨 스티커 다시 그리기 — app.js(마이홈 페이지 편집 묶음이 감싸 다시 대입한다)
const _mhStickerOutOfView = deps.mhStickerOutOfView;     // 📐 스티커 자리 · 크기 도우미 — app.js(마이홈 페이지 그리기)
const _mhClampStickerPos = deps.mhClampStickerPos;
const _mhStickerDispSize = deps.mhStickerDispSize;
const _mhHomeWinSize = deps.mhHomeWinSize;
const _mhStickerTransform = deps.mhStickerTransform;
const _mhOpenStickerAnim = deps.mhOpenStickerAnim;       // ✨ 움직임 고르기 창 — app.js
const _myHomeData = deps.myHomeData;                     // 🏠 마이홈 데이터 — app.js 의 let(불러올 때 · 관람할 때 다시 대입된다)
const _mhViewingUserId = deps.mhViewingUserId;           // 👀 친구 홈 관람 중이면 그 사람 uid — app.js 의 let
const _mhStickerEditSid = deps.mhStickerEditSid;         // ✎ 지금 편집모드인 스티커 id — app.js 의 let(renderMyHomeStickers 가 읽는다)
const _setMhStickerEditSid = deps.setMhStickerEditSid;
const _setMhStickerDragDist = deps.setMhStickerDragDist; // 드래그 이동거리 — app.js 의 let(드래그 직후 링크 안 엶)
const STICKER_MAX = deps.stickerMax;
const STICKER_BASE = deps.stickerBase;
const STICKER_ROT_SNAP = deps.stickerRotSnap;

/* ============================================================ 🎨 스티커 관리 창
   [왜 필요했나] 스티커를 드래그하다 마이홈 창 밖으로 밀어내면 화면에서 통째로 사라지는데,
   보이지 않는 것은 우클릭도 드래그도 못 하니 되돌릴 방법이 아예 없었다(제보 증상).
   목록으로 두면 밖으로 나갔든 다른 스티커에 완전히 가려졌든 언제나 손이 닿는다.
   ★ 밀려나는 것 자체는 _mhClampStickerPos로 막았다 — 이 창은 그 전에 이미 밀려난 것의 구제 수단이자,
     "붙인 스티커가 지금 몇 개이고 어디 있는지"를 한눈에 보는 자리다.
   ⚠️ 관람 중(_mhViewingUserId)에는 열지 않는다. 남의 스티커를 옮기거나 지우면 안 된다. */
function openStickerMgr(){
  if(_mhViewingUserId()){ toast('친구 홈에서는 스티커를 관리할 수 없어요'); return; }
  const ov=document.getElementById('mhStickerMgrOverlay'); if(!ov) return;
  ov.classList.add('on');
  renderStickerMgr();
}
function closeStickerMgr(){
  const ov=document.getElementById('mhStickerMgrOverlay'); if(ov) ov.classList.remove('on');
}
function renderStickerMgr(){
  const ov=document.getElementById('mhStickerMgrOverlay');
  if(!ov || !ov.classList.contains('on')) return;
  const list=document.getElementById('stMgrList'); if(!list) return;
  const data=(_myHomeData() && _myHomeData().stickers) || {};
  const ids=Object.keys(data);
  const cnt=document.getElementById('stMgrCount');
  if(cnt) cnt.textContent = ids.length + ' / ' + STICKER_MAX;
  const addBtn=document.getElementById('stMgrAdd');
  if(addBtn) addBtn.disabled = ids.length >= STICKER_MAX;
  const outCount = ids.filter(id=>_mhStickerOutOfView(data[id])).length;
  const allBtn=document.getElementById('stMgrBringAll');
  if(allBtn) allBtn.disabled = outCount === 0;

  list.innerHTML='';
  if(!ids.length){
    const d=document.createElement('div'); d.className='st-mgr-empty';
    d.textContent='아직 붙인 스티커가 없어요.\n[＋ 새 스티커]로 이미지를 골라 붙여보세요.';
    d.style.whiteSpace='pre-line';
    list.appendChild(d); return;
  }
  ids.forEach(sid=>{
    const s=data[sid];
    const row=document.createElement('div'); row.className='st-mgr-row';

    const th=document.createElement('div'); th.className='st-mgr-th';
    if(s.img){ const im=document.createElement('img'); im.src=s.img; im.draggable=false; th.appendChild(im); }
    else th.textContent = s.emoji || '⭐';
    row.appendChild(th);

    const meta=document.createElement('div'); meta.className='st-mgr-meta';
    const out=_mhStickerOutOfView(s);
    const pos=document.createElement('div');
    pos.innerHTML = '위치 ' + Math.round(s.x||0) + ', ' + Math.round(s.y||0)
      + ' · 크기 ' + Math.round(((typeof s.size==='number'&&s.size>0)?s.size:1)*100) + '%'
      + (out ? ' <span class="st-mgr-out">· 화면 밖</span>' : '');
    meta.appendChild(pos);
    const lk=document.createElement('span'); lk.className='lk';
    lk.textContent = s.link ? ('🔗 ' + s.link) : '링크 없음';
    lk.title = s.link || '';
    meta.appendChild(lk);
    row.appendChild(meta);

    const btns=document.createElement('div'); btns.className='st-mgr-btns';
    const mk=(txt, title, fn)=>{ const b=document.createElement('button'); b.type='button';
      b.textContent=txt; b.title=title; b.onclick=fn; btns.appendChild(b); return b; };

    mk('◎', '보이는 자리로 데려오기', ()=>{
      _mhBringStickerIn(sid);
      renderMyHomeStickers(); commitMyHomePage(true); renderStickerMgr();
    });
    /* ★ 편집은 관리 창을 닫고 스티커 자체로 넘긴다 — 이동·크기·회전은 실제 화면에서 봐야 맞출 수 있다.
       화면 밖에 있던 스티커라면 먼저 데려온 뒤 편집모드로 들어간다(안 그러면 또 안 보인다). */
    mk('✎', '편집 (이동·크기·회전)', ()=>{
      if(_mhStickerOutOfView(s)){ _mhBringStickerIn(sid); commitMyHomePage(true); }
      closeStickerMgr();
      renderMyHomeStickers();
      _mhStickerEditStart(sid);
    });
    mk('✨', '움직임 고르기', ()=>{ _mhOpenStickerAnim(sid); });
    /* 🔗 링크 수정 — 예전엔 "등록 후에는 못 바꾼다"고 안내하고 삭제 후 재등록을 시켰다.
       고칠 자리가 생겼으니 여기서 바꾼다(이미지를 다시 고를 필요가 없다). */
    mk('🔗', '링크 바꾸기', async ()=>{
      const v=await asyncPrompt({ title:'스티커 링크',
        message:'클릭 시 이동할 링크 (비우면 링크 없음)\n\n※ 시스템 기본 브라우저에서 열려요.',
        defaultValue:s.link||'', maxLength:300 });
      if(v===null || v===undefined) return;                 // 취소 — 그대로 둔다
      const u=(v||'').trim().slice(0,300);
      if(u && !/^https?:\/\//i.test(u)){ toast('http:// 또는 https:// 로 시작하는 주소만 넣을 수 있어요'); return; }
      s.link = u || null;
      renderMyHomeStickers(); commitMyHomePage(true); renderStickerMgr();
    });
    mk('×', '삭제', ()=>{
      if(!confirm('이 스티커를 지울까요?')){ window.focus(); return; } window.focus();
      delete _myHomeData().stickers[sid];
      if(_mhStickerEditSid()===sid) _mhStickerEditEnd();
      renderMyHomeStickers(); commitMyHomePage(true); renderStickerMgr();
    });
    row.appendChild(btns);
    list.appendChild(row);
  });
}
/* 스티커를 보이는 자리로 — 창 밖이면 창 안으로 당기고, 이미 안이면 눈에 띄게 가운데로 옮긴다.
   "◎를 눌렀는데 아무 일도 안 일어난다"가 없도록 두 경우 모두 무언가는 움직인다. */
function _mhBringStickerIn(sid){
  const s=(_myHomeData() && _myHomeData().stickers || {})[sid]; if(!s) return;
  if(!_mhStickerOutOfView(s)){
    const { W, H } = _mhHomeWinSize();
    const d = _mhStickerDispSize(s);
    s.x = Math.round((W - d.w)/2); s.y = Math.round((H - d.h)/2);
  }
  _mhClampStickerPos(s);
}
try{
  document.getElementById('stMgrClose').onclick = closeStickerMgr;
  document.getElementById('stMgrBringAll').onclick = ()=>{
    const data=(_myHomeData() && _myHomeData().stickers) || {};
    let n=0;
    Object.keys(data).forEach(sid=>{ if(_mhStickerOutOfView(data[sid])){ _mhClampStickerPos(data[sid]); n++; } });
    if(n){ renderMyHomeStickers(); commitMyHomePage(true); toast(n+'개를 화면 안으로 데려왔어요'); }
    renderStickerMgr();
  };
}catch(_){}

function _mhStickerEditStart(sid){
  _setMhStickerEditSid(sid);
  const hint = document.getElementById('mhStickerEditHint');
  if(hint) hint.classList.add('on');
  renderMyHomeStickers();
  // 빈 곳을 누르면 편집 종료
  setTimeout(()=>document.addEventListener('mousedown', _mhStickerEditCloser, true), 0);
}
function _mhStickerEditEnd(){
  if(_mhStickerEditSid() === null) return;
  _setMhStickerEditSid(null);
  const hint = document.getElementById('mhStickerEditHint');
  if(hint) hint.classList.remove('on');
  document.removeEventListener('mousedown', _mhStickerEditCloser, true);
  renderMyHomeStickers();
}
function _mhStickerEditCloser(ev){
  // 편집 중인 스티커(핸들·삭제버튼 포함) 안을 누른 거면 유지
  if(ev.target.closest && ev.target.closest('.mh-sticker.editing')) return;
  _mhStickerEditEnd();
}

/* 스티커 드래그 이동 — 편집모드일 때만. 좌표는 마이홈 창 기준. */
function _mhBindStickerDrag(el, sid){
  let dragging=false, sx=0, sy=0, ox=0, oy=0;
  el.addEventListener('pointerdown', e=>{
    if(!el.classList.contains('editing')) return;                 // 편집모드 아니면 이동 안 함
    if(e.target.classList.contains('mh-sticker-handle')) return;  // 핸들은 크기 조절 담당
    if(e.target.classList.contains('mh-sticker-del')) return;
    if(e.target.classList.contains('mh-sticker-anim')) return;    // ✨ 움직임 버튼 — 드래그로 삼키지 않게
    e.preventDefault(); e.stopPropagation();
    const s = (_myHomeData().stickers||{})[sid]; if(!s) return;
    dragging=true; sx=e.clientX; sy=e.clientY;
    ox=s.x||0; oy=s.y||0; _setMhStickerDragDist(0);
    try{ el.setPointerCapture(e.pointerId); }catch(_){}
  });
  el.addEventListener('pointermove', e=>{
    if(!dragging) return;
    const s = (_myHomeData().stickers||{})[sid]; if(!s) return;
    const dx=e.clientX-sx, dy=e.clientY-sy;
    _setMhStickerDragDist(Math.abs(dx)+Math.abs(dy));
    // 창 밖으로 나가지 않게 통째로 안에 붙잡는다 (_mhClampStickerPos 주석 참고 — 나가면 되찾을 수가 없다)
    s.x = ox+dx; s.y = oy+dy;
    _mhClampStickerPos(s);
    el.style.left=s.x+'px'; el.style.top=s.y+'px';
  });
  const end=e=>{
    if(!dragging) return;
    dragging=false;
    try{ el.releasePointerCapture(e.pointerId); }catch(_){}
    commitMyHomePage(true);
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

/* 회전 핸들 — 스티커 중심을 기준으로 마우스 각도를 따라 돎. 3도 단위로 스냅.
   Shift를 누르면 15도 단위로 더 크게 스냅(빠르게 직각 맞추기). */
function _mhBindStickerRotate(handle, sid, lblEl){
  let dragging=false, cx=0, cy=0, startAngle=0, startRot=0;
  const el = ()=>handle.parentElement;

  const angleOf = (e)=>{
    // 화면상 스티커 중심에서 커서까지의 각도(도). 위쪽(-90°)을 0으로 보정.
    return Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI + 90;
  };

  handle.addEventListener('pointerdown', e=>{
    e.preventDefault(); e.stopPropagation();
    const s=(_myHomeData().stickers||{})[sid]; if(!s) return;
    const node = el(); if(!node) return;
    const r = node.getBoundingClientRect();
    cx = r.left + r.width/2;
    cy = r.top  + r.height/2;
    dragging=true;
    startAngle = angleOf(e);
    startRot = (typeof s.rot==='number') ? s.rot : 0;
    node.classList.add('rotating');
    try{ handle.setPointerCapture(e.pointerId); }catch(_){}
  });

  handle.addEventListener('pointermove', e=>{
    if(!dragging) return;
    const s=(_myHomeData().stickers||{})[sid]; if(!s) return;
    const snap = e.shiftKey ? 15 : STICKER_ROT_SNAP;   // Shift = 15° 단위로 크게
    let deg = startRot + (angleOf(e) - startAngle);
    deg = Math.round(deg / snap) * snap;               // 자석처럼 스냅
    // -180 ~ 180 범위로 정규화 (표시용)
    while(deg > 180) deg -= 360;
    while(deg <= -180) deg += 360;
    s.rot = deg;
    const node = el();
    if(node) node.style.transform = _mhStickerTransform(s);
    if(lblEl) lblEl.textContent = Math.round(deg) + '°';
  });

  const end=e=>{
    if(!dragging) return;
    dragging=false;
    const node = el();
    if(node) node.classList.remove('rotating');
    try{ handle.releasePointerCapture(e.pointerId); }catch(_){}
    commitMyHomePage(true);
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}

/* 코너 핸들로 크기 조절 — 우하단으로 끌면 커짐 */
function _mhBindStickerResize(handle, sid){
  let dragging=false, sx=0, sy=0, startSize=1;
  handle.addEventListener('pointerdown', e=>{
    e.preventDefault(); e.stopPropagation();
    const s=(_myHomeData().stickers||{})[sid]; if(!s) return;
    dragging=true; sx=e.clientX; sy=e.clientY;
    startSize=(typeof s.size==='number' && s.size>0)?s.size:1;
    try{ handle.setPointerCapture(e.pointerId); }catch(_){}
  });
  handle.addEventListener('pointermove', e=>{
    if(!dragging) return;
    const s=(_myHomeData().stickers||{})[sid]; if(!s) return;
    const dx=e.clientX-sx, dy=e.clientY-sy;
    const delta = (dx + dy) / (STICKER_BASE*2);
    s.size = Math.max(0.3, Math.min(8, startSize + delta));   // 창 전체를 쓰므로 상한을 넉넉히
    const el = handle.parentElement;
    if(el) el.style.transform = _mhStickerTransform(s);   // 회전값도 함께 유지
  });
  const end=e=>{
    if(!dragging) return;
    dragging=false;
    try{ handle.releasePointerCapture(e.pointerId); }catch(_){}
    commitMyHomePage(true);
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}

return {
  open: openStickerMgr,               // 🎨 관리 창 열기([+ 스티커])
  close: closeStickerMgr,             // 마이홈 닫기 — 딸린 창도 같이
  render: renderStickerMgr,           // 열려 있으면 목록 다시 그리기(새 스티커 붙인 뒤)
  bringIn: _mhBringStickerIn,         // ◎ 보이는 자리로(검사용)
  editStart: _mhStickerEditStart,     // 우클릭 — 편집모드
  editEnd: _mhStickerEditEnd,         // 편집모드 끝(다른 탭 · 삭제)
  bindDrag: _mhBindStickerDrag,       // renderMyHomeStickers 가 스티커마다 건다
  bindRotate: _mhBindStickerRotate,
  bindResize: _mhBindStickerResize,
};
}

const api = { createMyHomeSticker };
if(typeof window !== 'undefined') window.TwMyHomeSticker = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
