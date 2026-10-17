/* myhome-sticker-layout.js — 🎨 마이홈 스티커 배치 — 크기 · 자리 계산 · 움직임 효과 창(그리기 renderMyHomeStickers 는 app.js)
   app.js «🎨 마이홈 스티커 배치 — 크기 · 자리 계산 · 움직임 효과 창(그리기 renderMyHomeStickers 는 app.js)» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 44번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 4줄 —
     _mhViewingUserId · _myHomeData 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 2개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: STICKER_BASE · STICKER_IMG_MAX_W · STICKER_MAX · STICKER_ROT_SNAP · _mhCanEditStickers · _mhClampStickerPos · _mhCloseStickerAnim · _mhFitWindowSafe · _mhHomeWinSize · _mhOpenStickerAnim · _mhStickerDispSize · _mhStickerEditSid · _mhStickerOutOfView · _mhStickerOverhang · _mhStickerTransform · _mhStickersData — app.js 는 mhStLayoutMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwMyHomeStickerLayout — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-myhome-sticker-layout.js */
(function(){

function createMyHomeStickerLayout(deps){
const _mhViewingUserId = deps._mhViewingUserId;   // 읽는 함수
const _myHomeData = deps._myHomeData;   // 읽는 함수
const applyDesktopRunClass = deps.applyDesktopRunClass;
const renderMyHomeStickers = deps.renderMyHomeStickers;
const mhHooks = TwMyHomeHooks;   // 🪝 마이홈 고리판(myhome-hooks.js) — 자동 저장은 편집 묶음이 건다
/* 🎨 스티커 — 마이홈 "창 전체"에 자유 배치.
   · 좌표는 마이홈 창(#myHomeWin) 좌상단 기준 px. 탭을 바꿔도 같은 자리에 있음.
   · 친구 탭에서는 숨김(목록이 빽빽해서 가리면 곤란) + 친구 홈 관람 중엔 그 사람 스티커만 보임.
   · 평소: 클릭 = 링크 열기. 우클릭 = 편집모드(드래그 이동 / 코너 핸들 크기 / × 삭제).
   · 편집은 본인만. 관람 중에는 우클릭해도 편집모드로 안 들어감. */
const STICKER_MAX = 5;
const STICKER_IMG_MAX_W = 400;    // 업로드 시 가로 최대 400px로 축소(비율 유지)
const STICKER_ROT_SNAP = 3;       // 회전 스냅 각도(도) — 3도 단위로 딱딱 붙음

/* 스티커의 transform 문자열 — 크기(scale)와 회전(rotate)을 함께 적용.
   ★ transform-origin이 top left라 scale은 좌상단 기준으로 커지고(위치 안정),
     회전은 그 상태에서 스티커 자기 중심을 기준으로 돌아야 자연스러움.
     그래서 rotate 앞뒤로 중심 이동(translate)을 감싸는 대신,
     scale → rotate 순서로 쓰고 rotate에만 별도 origin이 필요 없도록
     scale 이후의 좌표계에서 중앙으로 옮겼다가 되돌리는 방식을 씀. */
/* ✨ 스티커 움직임 고르기 창 — 고르는 즉시 화면에 반영되고 저장된다.
   저장되는 값은 이름 문자열 두 개(anim/animSpd)뿐이라 용량·통신 부담이 없다. */
let _mhAnimSid = null;
function _mhOpenStickerAnim(sid){
  _mhAnimSid = sid;
  const ov=document.getElementById('mhStickerAnimOverlay'); if(!ov) return;
  ov.style.display='flex';
  _mhSyncStickerAnimUI();
}
function _mhCloseStickerAnim(){
  _mhAnimSid = null;
  const ov=document.getElementById('mhStickerAnimOverlay'); if(ov) ov.style.display='none';
}
function _mhSyncStickerAnimUI(){
  const d=_mhStickersData(); const s=(_mhAnimSid && d) ? d[_mhAnimSid] : null; if(!s) return;
  document.querySelectorAll('#stAnimGrid button').forEach(b=>{
    b.classList.toggle('on', (b.dataset.a||'') === (s.anim||''));
  });
  document.querySelectorAll('#stAnimSpd button').forEach(b=>{
    b.classList.toggle('on', (b.dataset.s||'') === (s.animSpd||''));
  });
}
function _mhApplyStickerAnim(key, val){
  if(!_mhAnimSid || !_myHomeData() || !_myHomeData().stickers) return;
  const s=_myHomeData().stickers[_mhAnimSid]; if(!s) return;
  if(val) s[key]=val; else delete s[key];
  renderMyHomeStickers(); mhHooks.call(mhHooks.HOOK.COMMIT, true);
  _mhSyncStickerAnimUI();
}
try{
  document.addEventListener('click', e=>{
    const g = e.target.closest && e.target.closest('#stAnimGrid button');
    if(g){ _mhApplyStickerAnim('anim', g.dataset.a||''); return; }
    const p = e.target.closest && e.target.closest('#stAnimSpd button');
    if(p){ _mhApplyStickerAnim('animSpd', p.dataset.s||''); return; }
    if(e.target.id === 'stAnimClose') _mhCloseStickerAnim();
  });
}catch(_){}
function _mhStickerTransform(s){
  const size = (typeof s.size==='number' && s.size>0) ? s.size : 1;
  const rot  = (typeof s.rot==='number') ? s.rot : 0;
  const parts = [];
  if(size !== 1) parts.push('scale('+size+')');
  if(rot !== 0){
    // scale된 좌표계 안에서 중심으로 이동 → 회전 → 복귀
    parts.push('translate(50%, 50%)', 'rotate('+rot+'deg)', 'translate(-50%, -50%)');
  }
  return parts.join(' ');
}
const STICKER_BASE = 40;          // .mh-sticker 기본 한 변(px) — size 배율의 기준
let _mhStickerEditSid = null;     // 지금 편집모드인 스티커 id (없으면 null)

/* 📐 스티커가 화면에서 차지하는 크기 — 렌더 로직(renderMyHomeStickers)과 같은 계산을 한 곳에 모은다.
   .mh-sticker는 transform-origin:top left 라서 scale이 커져도 좌상단(x,y)은 그대로다.
   ⚠️ 렌더 쪽 baseW 계산식을 고치면 여기도 같이 고칠 것 — 어긋나면 "화면 밖 판정"이 조용히 틀어진다. */
function _mhStickerDispSize(s){
  let w = STICKER_BASE, h = STICKER_BASE;
  if(s && s.w && s.h){ w = Math.min(s.w, STICKER_BASE * 2.2); h = Math.round(w * (s.h / s.w)); }
  const k = (s && typeof s.size==='number' && s.size>0) ? s.size : 1;
  return { w: Math.max(8, w*k), h: Math.max(8, h*k) };
}
function _mhHomeWinSize(){
  const win = document.getElementById('myHomeWin');
  return { W: (win && win.clientWidth) || 760, H: (win && win.clientHeight) || 560 };
}
/* 📐 화면에 실제로 차지하는 사각형 — (x, y) 에서 얼마나 떨어진 곳(dx, dy)에 얼마만한(w, h) 상자인가.
   .mh-sticker 의 회전은 크기 맞춘 상자의 **가운데**를 축으로 돈다(_mhStickerTransform) — 돌리면 모서리가
   원래 상자 밖으로 나오므로 그 바깥 상자까지 본다. 회전이 없으면 dx = dy = 0, 크기는 _mhStickerDispSize 그대로. */
function _mhStickerBox(s){
  const d = _mhStickerDispSize(s);
  const rad = ((s && typeof s.rot === 'number') ? s.rot : 0) * Math.PI / 180;
  const c = Math.abs(Math.cos(rad)), n = Math.abs(Math.sin(rad));
  const w = d.w * c + d.h * n, h = d.w * n + d.h * c;
  return { dx: (d.w - w) / 2, dy: (d.h - h) / 2, w, h };
}
/* 스티커를 마이홈 창 안에 붙잡아 둔다.
   [왜] 예전엔 스티커 폭의 60%까지 창 밖으로 나가는 걸 허용했다. 그런데 마이홈 창은 overflow가 잘려서,
        일단 밖으로 나가면 화면에 아무것도 안 남는다 — 보이지 않으니 우클릭도 드래그도 못 하고,
        그 스티커는 되찾을 방법이 없어졌다(제보 증상). 통째로 안에 두는 편이 잃는 게 없다.
   ★ 회전한 바깥 상자(_mhStickerBox)로 본다. 크기 조절 · 회전은 이 함수를 안 거친다 — 창 밖으로 걸쳐 두는 것은
     꾸미기라서 막지 않고, 런처에서도 보이게 창을 넓힌다(_mhStickerOverhang).
   ★ 그래도 이미 밖으로 나간 옛 스티커가 있으므로, 관리 창의 [가운데로]가 구제 수단으로 남는다. */
function _mhClampStickerPos(s){
  if(!s) return s;
  const { W, H } = _mhHomeWinSize();
  const b = _mhStickerBox(s);
  s.x = Math.round(Math.max(-b.dx, Math.min(s.x||0, W - b.w - b.dx)));
  s.y = Math.round(Math.max(-b.dy, Math.min(s.y||0, H - b.h - b.dy)));
  return s;
}
/* 지금 마이홈 창 밖으로 (일부라도) 나가 있는가 — 관리 창의 '화면 밖' 배지 판정 */
function _mhStickerOutOfView(s){
  if(!s) return false;
  const { W, H } = _mhHomeWinSize();
  const b = _mhStickerBox(s);
  const x = (s.x||0) + b.dx, y = (s.y||0) + b.dy;
  return x < -0.5 || y < -0.5 || (x + b.w) > W + 0.5 || (y + b.h) > H + 0.5;
}

/* 🎨 스티커가 마이홈 창 밖으로 나간 만큼(CSS px) — 런처에서 마이홈 OS 창을 이만큼 양쪽으로 넓힌다(main.js _modeSize).
   [왜] 실행 화면은 전체화면이라 창 밖 스티커도 보이는데, 런처는 OS 창이 마이홈보다 조금만 커서 잘렸다(제보).
   마이홈 탭이 아니면 스티커를 안 그리므로 0. 관람 중이면 그 친구 스티커로 잰다(_mhStickersData). */
function _mhStickerOverhang(){
  const zone = document.getElementById('mhStickerZone');
  if(!zone || zone.classList.contains('hidden')) return { x: 0, y: 0 };
  const { W, H } = _mhHomeWinSize();
  const data = _mhStickersData();
  let x = 0, y = 0;
  Object.keys(data).forEach(sid=>{
    const s = data[sid]; if(!s) return;
    const b = _mhStickerBox(s);
    const l = (s.x||0) + b.dx, t = (s.y||0) + b.dy;
    x = Math.max(x, -l, l + b.w - W);
    y = Math.max(y, -t, t + b.h - H);
  });
  return { x: Math.max(0, Math.ceil(x)), y: Math.max(0, Math.ceil(y)) };
}
/* 크기 · 회전 핸들을 놓았을 때(myhome-sticker.js) · 스티커를 다시 그렸을 때 — 창 밖으로 나간 만큼 다시 넓힌다.
   ⚠️ 부팅 중엔 applyDesktopRunClass 가 아직 못 쓰는 이름(desktopMode)을 볼 수 있어 try 로 감싼다. 같은 크기면 main 이 건너뛴다. */
function _mhFitWindowSafe(){ try{ applyDesktopRunClass(); }catch(_){} }
window._mhFitWindow = _mhFitWindowSafe;

/* 지금 화면에 그릴 스티커 데이터 — 관람 중이면 그 친구 것, 아니면 내 것 */
function _mhStickersData(){
  // ★ 관람 중에도 소스는 _myHomeData — openFriendHomeView가 친구의 home을 통째로 여기에 담기 때문.
  //   (예전엔 _myHomeFriends[uid].home.stickers를 봤는데 그 경로엔 스티커가 없어서 관람 시 스티커가 안 보였음)
  return _myHomeData().stickers || {};
}
function _mhCanEditStickers(){ return !_mhViewingUserId(); }



return {
  STICKER_BASE,
  STICKER_IMG_MAX_W,
  STICKER_MAX,
  STICKER_ROT_SNAP,
  _mhCanEditStickers,
  _mhClampStickerPos,
  _mhCloseStickerAnim,
  _mhFitWindowSafe,
  _mhHomeWinSize,
  _mhOpenStickerAnim,
  _mhStickerDispSize,
  _mhStickerEditSid: ()=>_mhStickerEditSid,   // 읽는 함수
  setMhStickerEditSid: (v)=>{ _mhStickerEditSid = v; },   // 쓰는 함수 — app.js 가 비운다
  _mhStickerOutOfView,
  _mhStickerOverhang,
  _mhStickerTransform,
  _mhStickersData,
};
}

const api = { createMyHomeStickerLayout };
if(typeof window !== 'undefined') window.TwMyHomeStickerLayout = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
