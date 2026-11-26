/* char-place.js — 🧍 캐릭터 높이 · 깊이 · 자리 · 크기 저장 · 끌기 한계 · 책상 반폭(앱 FSD · app.js 분리 M7)
   app.js SETUP · SEATS 구역의 «캐릭터가 화면 어디에 얼마나 크게 서는가» 를 글 그대로 옮긴 모듈이다. 동작은 옮기기 전과 같다(좌석 목록 · 위층 부름 두 곳만 달라짐).
   ・책임: 캐릭터 기본 앞뒤 자리 CHAR_Z · 높이 상한 CHAR_Y_MAX · clampCharY · seatCharZ / 프로그램 이동 위치(deskPanX · deskPanY)의 저장 · 복원 · 안전 범위 clampDeskPan(실측 여백 _myPanHalfFrac) /
     실행 화면 캐릭터 크기 focusCharScale 의 모니터별 저장 · 복원(디스플레이 id → 해상도 지문 → default) · refreshCharScaleForCurrentDisplay / 책상 반폭 실측 seatDeskHalfWidth /
     동물 실행 크기 ANIMAL_RUN_SCALE(animal.js 가 읽는 window 고리는 app.js 가 건다 — 도메인끼리 부르는 줄이 되지 않게).
   ・받는 deps 3 — camera · bodyMeasureMod(값) · seats(읽는 함수 — 더 아래에서 만들어진다). 위층(줄 배치)은 부르지 않고 attachLayout({ layoutSeats }) 로 app.js 가 건 알림만 부른다(seat-layout 과 순환 막기).
   ・내놓는 것: CHAR_Z · CHAR_Y_MAX · clampCharY · seatCharZ · BASE_PXW · ANIMAL_RUN_SCALE · saveCharPos · saveCharScale · refreshCharScaleForCurrentDisplay · clampDeskPan · seatDeskHalfWidth · attachLayout ·
     다시 대입되는 여섯의 읽는 · 쓰는 함수: sizeFactor · deskPanX · deskPanY · focusCharScale · _cachedRowCenter · _cachedRowSpan(`이름()` / `set이름(v)`).
   ⚠️ ANIMAL_RUN_SCALE 은 이 파일 안에서 먼저 선언돼야 한다(_animalPanExtra 가 부를 때 읽는다 — 값을 미리 굳히면 TDZ 로 앱이 죽었던 자리).
   ⚠️ 저장 키(tw.deskPan · tw.focusCharScale)는 바꾸지 말 것. 크기는 모니터별 3겹(id · 지문 · default)으로 쓴다 — id 하나만 쓰면 재부팅 때 미아가 된다.
   검사: checks/sim-char-place.js */
(function(){

function createCharPlace(deps){
const camera = deps.camera;
const bodyMeasureMod = deps.bodyMeasureMod;
const seats = deps.seats;
/* 줄 배치는 위층(seat-layout)이 한다 — 이 모듈은 부르지 않고 app.js 가 attach 로 걸어 둔 알림만 부른다(모듈 순환 막기) */
let placeHooks = null;
function attachLayout(h){ placeHooks = h; }
const CHAR_Z=-0.47;                 // 캐릭터 기본 앞뒤 위치 (책상과의 간격을 살짝 좁힘)
/* 🧍 캐릭터 높이(y) — 생성기 '좌석 세팅' 의 **앞뒤 슬라이더를 대체한** 값. def.xf.y 로 저장된다.
   [경위] 앞뒤(z)는 사용자가 조정할 이유가 사실상 없었다. CHAR_Z 가 책상과의 간격을 이미 정하고,
     조정값이 붙으면 미리보기·생성기·실행 세 화면이 각자 다른 식으로 그것을 보상해야 해서
     (fitModel 의 userZ, _wdDeskGrp 의 -xf.z, fitCreator 의 CHAR_Z+cXform.z) 어긋남의 온상이었다.
     대신 예전에 "바닥 파묻힘 방지" 를 이유로 아예 없애 두었던 높이 슬라이더를 되살린다 —
     그때 문제였던 '바닥 아래' 는 이제 하한 0 으로 원천 차단한다.
   ★ 0 = 발바닥이 월드 y=0(바닥). 음수는 없다. 상한은 CHAR_Y_MAX.
   ★ 저장된 옛 xf.z 는 읽는 자리마다 0 으로 죽인다(별도 이관 패스 없이 다음 저장 때 0 이 굳는다).
     읽는 자리: applyCharToSeat · fitCreator · 런처 미리보기 · 꾸미기 미리보기 · 프리셋 로드. */
const CHAR_Y_MAX = 0.6;             // 캐릭터 키가 1.45 이므로 약 40% — 이 이상은 '떠 있는' 게 된다
function clampCharY(v){ const n = +v; return (isFinite(n) && n > 0) ? Math.min(n, CHAR_Y_MAX) : 0; }
/* 🐾 실행 화면에서 캐릭터가 책상 앞으로 나와 있는 '기본 거리'. CHAR_Z는 절대값이라, 책상만 40%로
   줄어든 동물은 이 거리가 상대적으로 2.5배가 되어 책상에서 너무 멀리 떨어져 보였다(생성기는 책상이
   100%라 CHAR_Z가 그대로 맞음). 책상과 같은 비율로 줄여서 생성기에서 본 간격이 그대로 재현되게 한다.
   ★ 실행 화면 전용 — fitCreator(생성기)와 런처 미리보기의 CHAR_Z는 손대지 않는다. */
/* 🪑🐾 캐릭터의 앞뒤 자리 — **좌석마다 예외 없이 CHAR_Z 하나다.**

   [경위 — 두 번의 뒤집기]
     ① 예전엔 여기에 동물 배율(0.4)과 평준화 배율(k)을 곱했다. 이유는 "책상이 그 배율로
        줄어 원점 쪽으로 오는데 캐릭터만 −0.47 에 남으면 간격이 어긋난다" 였고, 간격 자체는
        그 말이 맞았다.
     ② 그런데 그 방식은 **좌석마다 서 있는 깊이(z)를 다르게** 만든다. 카메라가 +z 에서
        pitch 0.09(약 5.2°)로 내려다보므로, 바닥(y=0) 위의 같은 점이라도 카메라에서 멀수록
        화면에서는 위로 잡힌다 → **발선이 좌석마다 다른 줄에 그려진다.**
        실측: 사람 z=-0.47 · 동물 z=-0.188 → 차이 0.282 × sin(0.09) ≒ 0.025
        = 캐릭터 키(0.48~0.61)의 4~5%. 제보의 "동물만 조금 높게 떠 보인다"가 정확히 이 값이다.
        발 박스는 사람·동물 둘 다 정확히 y=0 이었다 — **y 문제가 아니라 z 문제였다.**
   ★ 그래서 배율 둘을 **책상 쪽으로 옮겼다**(syncSeatDeskZ). 간격은 그대로 보존되고,
     모든 좌석이 같은 깊이에 서므로 발선이 한 줄로 겹친다.
   ★ 평준화도 같은 병을 앓고 있었다 — k 는 좌석마다 다르므로 사람끼리도 발선이 갈렸다.
     이 변경이 그쪽까지 함께 고친다.

   ⚠️ 여기 하나만 고치면 된다 — 즉시 적용(applyCharToSeat) · 비행(_updateFlyingSeats·endFlight) ·
     프레임 루프의 복귀 lerp 가 전부 이 함수를 부른다.
   ⚠️ 인자 seat 는 이제 안 쓰지만 **남겨 둔다** — 호출부가 다섯 곳이고, 나중에 좌석별로
     달라질 일이 생기면 여기 한 곳만 보면 되게 하기 위해서다.
   ⚠️ 꾸미기 미리보기(refreshWdPreviewChar)는 이 함수를 안 쓰고 CHAR_Z 를 직접 곱하는데,
     그쪽은 캐릭터를 z=0 에 두고 **간격만** 인코딩하는 다른 규약이다. 계산해 보면 이 변경 뒤에도
     두 식이 그대로 일치한다(sim-char-z.js §3 이 그 일치를 지킨다) — 건드리지 말 것. */
function seatCharZ(seat){
  return CHAR_Z;
}
let sizeFactor=1;
const BASE_PXW=190;          // 월드 1단위당 픽셀(캐릭터 크기 기준)
/* ── 캐릭터 위치·크기 영속화 ──
   deskPanX/Y ("프로그램 이동"으로 옮긴 위치), focusCharScale (설정 패널의 캐릭터 크기 슬라이더)를 localStorage에 저장.
   프로그램을 껐다 켜도 마지막으로 맞춰둔 위치/크기가 그대로 복원됨. */
const CHAR_POS_KEY = 'tw.deskPan';        // {x, y}
const CHAR_SCALE_KEY = 'tw.focusCharScale';   // ★ 모니터별로 저장: {"<디스플레이id>": 배율, "sig:<가로>x<세로>": 배율, "default": 배율}
let _currentDisplayIdForScale = null;   // companion.getDisplays()로 비동기로 알아낸 뒤 채워짐
/* 🖥️ 해상도 지문 — 디스플레이 id의 대역이다.
   ⚠️ Electron의 display.id 는 재부팅·그래픽 드라이버 갱신·모니터 재연결로 **바뀐다.**
     그래서 id 하나만 열쇠로 쓰면, 저장은 됐는데 다음 부팅에 그 열쇠가 사라져 기본값으로 돌아간다
     ("최소로 줄여놨는데 매번 다시 커진다" 제보가 정확히 이것). 같은 자리에 같은 모니터가 있으면
     해상도는 그대로이므로, id가 어긋났을 때 이 지문으로 한 번 더 찾아본다.
   ★ 해상도가 같은 모니터가 둘이면 지문이 겹치지만, 그건 "다른 모니터의 크기를 물려받는" 정도의
     어긋남이다 — 매번 기본값으로 초기화되는 것보다 낫다. id가 맞으면 언제나 id가 이긴다. */
let _currentDisplaySigForScale = null;
function _scaleSigOf(display){
  const b = display && display.bounds;
  if(!b || !isFinite(b.width) || !isFinite(b.height)) return null;
  return 'sig:' + Math.round(b.width) + 'x' + Math.round(b.height);
}
function _loadCharScaleMap(){
  try{
    const raw = localStorage.getItem(CHAR_SCALE_KEY);
    if(!raw) return {};
    const parsed = JSON.parse(raw);
    if(parsed && typeof parsed==='object' && !Array.isArray(parsed)) return parsed;
  }catch(e){}
  // 예전 버전엔 숫자 하나만 그대로 저장했었음(JSON.parse가 실패하거나 객체가 아니면 이 경로) — "default"로 이전
  try{
    const v = parseFloat(localStorage.getItem(CHAR_SCALE_KEY));
    if(isFinite(v) && v>0) return { default: v };
  }catch(e){}
  return {};
}
let _charScaleMap = _loadCharScaleMap();
function _loadCharPos(){
  try{
    const raw = localStorage.getItem(CHAR_POS_KEY);
    if(raw){ const d=JSON.parse(raw); if(typeof d.x==='number' && typeof d.y==='number') return d; }
  }catch(e){}
  return {x:0, y:0};
}
function _loadCharScale(){
  const ok = v => (typeof v==='number' && isFinite(v) && v>0) ? v : null;
  // id → 해상도 지문 → default. 부팅 직후엔 앞의 둘이 아직 null이라 default가 쓰인다.
  const byId  = (_currentDisplayIdForScale!=null) ? ok(_charScaleMap[String(_currentDisplayIdForScale)]) : null;
  if(byId!=null) return byId;
  const bySig = (_currentDisplaySigForScale!=null) ? ok(_charScaleMap[_currentDisplaySigForScale]) : null;
  if(bySig!=null) return bySig;
  return ok(_charScaleMap.default) != null ? _charScaleMap.default : 1;
}
function saveCharPos(){ try{ localStorage.setItem(CHAR_POS_KEY, JSON.stringify({x:deskPanX,y:deskPanY})); }catch(e){} }
function saveCharScale(){
  // ★ 모니터를 바꿀 때마다 다시 조정해야 하던 문제 — 현재 모니터 id로 따로 저장해서 그 모니터로
  //   돌아오면 그때 맞춰둔 크기가 복원된다.
  /* ★ 세 곳에 같이 쓴다. id 하나만 쓰면 그 id가 바뀌는 순간(재부팅 등) 저장값이 통째로 미아가 된다.
       · <id>   — 이 모니터. 가장 정확하다
       · sig:WxH — id가 어긋났을 때의 대역
       · default — 위 둘이 다 빗나갔을 때. 부팅 직후 id를 알기 전에도 이 값이 먼저 적용된다
     default 는 "마지막으로 맞춰둔 크기"라, 최악의 경우에도 기본값 1이 아니라 그 값으로 떨어진다. */
  const val = focusCharScale;
  if(_currentDisplayIdForScale!=null) _charScaleMap[String(_currentDisplayIdForScale)] = val;
  if(_currentDisplaySigForScale!=null) _charScaleMap[_currentDisplaySigForScale] = val;
  _charScaleMap.default = val;
  try{ localStorage.setItem(CHAR_SCALE_KEY, JSON.stringify(_charScaleMap)); }catch(e){}
}
// 현재 어느 모니터에 떠 있는지 비동기로 확인해서, 그 모니터 전용 저장값이 있으면 focusCharScale에 반영.
// main.js 쪽에서 이미 모니터 이동/복원을 처리하고 나면 호출하면 됨 — 여러 번 호출해도 안전(멱등).
async function refreshCharScaleForCurrentDisplay(){
  if(!window.companion || !companion.getDisplays) return;
  try{
    const displays = await companion.getDisplays();
    const cur = displays.find(d=>d.isCurrent);
    if(!cur) return;
    _currentDisplayIdForScale = cur.id;
    _currentDisplaySigForScale = _scaleSigOf(cur);
    const restored = _loadCharScale();
    /* 지금 값이 어느 열쇠에도 안 적혀 있으면(옛 저장이 id 하나만 갖고 있던 경우) 지금 값으로 채워 둔다.
       이렇게 해야 다음 부팅에 id가 또 바뀌어도 지문·default 로 이어받는다. */
    if(restored !== focusCharScale){
      focusCharScale = restored;
      placeHooks.layoutSeats();   // 즉시 화면에 반영
      // ⚠️ 예전엔 존재하지 않는 'sizeSlider'를 찾고 있었다(HTML에는 fsSizeSlider뿐) — 조용히 아무 일도 안 했다.
      const _slider=document.getElementById('fsSizeSlider'); if(_slider) _slider.value=String(focusCharScale);
      if(typeof renderSizeBar==='function') renderSizeBar();
    }
    saveCharScale();   // 열쇠 세 개(id·지문·default)를 지금 값으로 맞춰 둔다
  }catch(e){}
}
/* 데스크톱 run 모드에서 사용자가 상태칩을 끌어 옮긴 만큼의 캐릭터 위치 오프셋 (뷰 비율 단위, 0~1 근사) */
const _savedPos = _loadCharPos();
let deskPanX=_savedPos.x, deskPanY=_savedPos.y;   // "프로그램 이동"으로 사용자가 옮긴 위치 — 뷰 비율(fraction) 기준, 크기 변경에도 안 틀어짐 (localStorage에서 복원)
// ★ "프로그램 이동" 안전 범위 계산 — 기본 오프셋(-0.34, 0.28) 기준. 멀티모드에서 인원이 늘어날수록
//   책상 줄이 화면에서 차지하는 비중이 커져서, 같은 팬 값이라도 화면 밖으로 밀려나기 쉬워짐.
//   그래서 좌석 수(n)에 비례해서 안전 여백(PAN_MARGIN)을 더 크게(=팬 가능 범위를 더 좁게) 잡음.
//   layoutSeats()에서 매번 재검증하므로, 친구가 들어와서 인원이 늘어나는 순간에도 자동으로 안전 범위 안으로 당겨짐.
/* 🐾 동물 캐릭터일 때 프로그램 이동 범위에 더해주는 여유(뷰 비율).
   아래 clampDeskPan의 -0.34(좌우)/0.28(위아래)는 '인간 크기 기준 여백'이라 40%인 동물에겐 과하다.
   풀어줘야 할 양 = 원래 여백 × (1 − ANIMAL_RUN_SCALE) — 임의 상수가 아니라 여기서 유도한 값이라
   화면 가장자리(천장·작업표시줄)에 딱 맞아떨어진다.
   ★ K는 미세조정용: 1.0=이론값, 키우면 더 나가고 줄이면 덜 나간다. 0이면 인간과 동일. */
/* ── 프로그램 이동 한계 조절값 ────────────────────────────────────────────
   아래 clampDeskPan의 기본식은 위/아래를 같은 상수(0.28)로 함께 움직여서, 한쪽을 맞추면 반대쪽이
   어긋난다. 방향별로 분리해 각각 조절할 수 있게 뺐다. 숫자를 키우면 그 방향으로 '더 멀리' 간다.
   ★ PAN_DOWN_TRIM 은 인간에게도 적용 — 아래로 갈 때 머리까지 가려진 뒤에야 멈추는 문제 보정.
     0이면 예전 그대로, 키울수록 더 일찍(위에서) 멈춘다. */
const PAN_DOWN_TRIM      = 0.05;  // ★ 아래쪽 한계를 위로 당기는 양(인간·동물 공통). 키우면 덜 내려간다.
const PAN_UP_EXTRA       = 0.05;  // ★ 위쪽 한계를 더 올려주는 양(인간·동물 공통). 키우면 더 올라간다.
/* ↑ 두 값은 '실측 여백(_myPanHalfFrac) 위에 얹는 취향 조정'이다.
   예전엔 여백이 고정 상수라 화면·캐릭터 크기가 바뀌면 어긋났고, 그 오차를 이런 값들로 덧대다 보니
   한 해상도에 맞추면 다른 해상도에서 다시 틀어졌다. 지금은 여백이 자동으로 맞으므로
   이 값들은 순수하게 '얼마나 여유를 둘지'만 정한다(비율이라 해상도가 바뀌어도 유지됨). */
const ANIMAL_PAN_UP_K    = 0;      // ★ 동물이 위로 더 갈 수 있는 여유 배수 (0이면 인간과 동일)
                                   //   ★ 여백 실측(_myPanHalfFrac) 도입으로 0으로 정리 — 동물이 작다는 사실이
                                   //     이미 실측 여백에 반영되므로, 여기서 또 넓히면 천장 밖으로 나간다.
const ANIMAL_PAN_DOWN_K  = 0;     // ★ 동물이 아래로 더 갈 수 있는 여유 배수 (기본 0 — 아래는 안 넓힘)
const ANIMAL_PAN_SIDE_K  = 0.0;   // ★ 동물 좌우 여유 배수
const ANIMAL_PAN_EXTRA_K = 1.0;   // (구) 전체 배수 — 위 세 개에 함께 곱해짐
/* ★ ANIMAL_RUN_SCALE은 이 지점보다 아래(740행대)에서 const로 선언된다.
   여기서 top-level로 계산하면 TDZ ReferenceError가 나면서 app.js 전체가 죽는다(실제로 그렇게 터졌음).
   그래서 값을 미리 굳히지 않고, 실행 시점에 계산하는 함수로 둔다. */
function _animalPanExtra(){
  const r = (typeof ANIMAL_RUN_SCALE === 'number') ? ANIMAL_RUN_SCALE : 0.4;
  const k = ANIMAL_PAN_EXTRA_K;
  return { x:  0.34 * (1 - r) * k * ANIMAL_PAN_SIDE_K,
           up: 0.28 * (1 - r) * k * ANIMAL_PAN_UP_K,
           dn: 0.28 * (1 - r) * k * ANIMAL_PAN_DOWN_K };
}
/* 내 캐릭터(+책상)가 화면에서 차지하는 '절반 크기'를 뷰 비율(0~0.5)로 실측한다.
   ★ 이동 한계의 여백은 원래 이 값이어야 한다. 예전엔 0.02 같은 고정 상수라서
     화면 해상도·캐릭터 크기가 바뀌면 실제 절반 크기와 어긋나 화면 밖으로 삐져나갔다
     (한 해상도에 맞춰 상수를 고쳐도 다른 크기에서 다시 틀어지던 원인).
     실측하면 어떤 화면·어떤 크기·인간이든 동물이든 자동으로 맞는다. */
function _myPanHalfFrac(){
  try{
    const me = seats().find(s=>s.isMe);
    if(!me || !me.group || !_cvEl) return null;
    const cr = _cvEl.getBoundingClientRect();
    if(!cr.width || !cr.height) return null;
    // ★ 숨은 메시는 뺀다 — 동물 좌석의 숨은 인간 크기 placeholder 가 박스를 키운다(r128 setFromObject 는 숨은 것도 센다).
    const box = bodyMeasureMod.measureBodyBox(me.group, { visibleOnly: true, updateWorld: false });
    if(box.isEmpty()) return null;
    let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; const v=new THREE.Vector3();
    for(let i=0;i<8;i++){
      v.set((i&1)?box.max.x:box.min.x,(i&2)?box.max.y:box.min.y,(i&4)?box.max.z:box.min.z).project(camera);
      const px=(v.x*0.5+0.5)*cr.width, py=(-v.y*0.5+0.5)*cr.height;
      if(px<x0)x0=px; if(px>x1)x1=px; if(py<y0)y0=py; if(py>y1)y1=py;
    }
    const hx = ((x1-x0)/2)/cr.width, hy = ((y1-y0)/2)/cr.height;
    if(!isFinite(hx)||!isFinite(hy)||hx<=0||hy<=0||hx>0.5||hy>0.5) return null;
    return { x:hx, y:hy };
  }catch(_){ return null; }
}
function clampDeskPan(px, py){
  const _hf = _myPanHalfFrac();
  // ★ 버그 수정("여럿일 때 바닥 위에서 일찍 막힘"): 실측 여백(_myPanHalfFrac)은 _cvEl 스코프 문제로
  //   항상 null이라 실제로는 늘 이 폴백이 쓰인다. 예전 폴백은 0.02+0.02*(n-1)로 좌석 수에 비례해
  //   커져서, 친구가 들어올수록 이동 여백이 넓어져(=이동 가능 범위가 좁아져) 바닥·천장·옆에서 일찍
  //   막혔다(혼자면 n=1이라 0.02로 정상). 인원수 가산을 제거해 여럿일 때도 혼자와 동일한 여백을 쓴다.
  //   (각 좌석 간격/카메라 줌아웃은 layoutSeats가 이미 처리하므로 여기서 n을 또 반영할 필요가 없다.)
  const PAN_MARGIN_FALLBACK = 0.02;
  const PAN_MARGIN   = _hf ? _hf.x : PAN_MARGIN_FALLBACK;   // 좌우 여백 = 실제 반폭
  const PAN_MARGIN_Y = _hf ? _hf.y : PAN_MARGIN_FALLBACK;   // 위아래 여백 = 실제 반높이
  // ★ 세로 모니터(높이가 폭보다 큰 경우)는 화면에서 위아래로 이동할 수 있는 실제 여유 공간이 훨씬 많은데도
  //   가로 모니터와 똑같은 비율 범위를 쓰고 있어서 위아래 이동이 부자연스럽게 일찍 막히는 문제가 있었음 —
  //   세로 화면일 때는 위아래 범위를 더 넉넉하게 넓힘(가로 이동 범위는 그대로).
  const isPortrait = innerHeight > innerWidth;
  const yExtra = isPortrait ? 0.25 : 0;
  // 🐾 동물은 40% 크기라 화면에서 차지하는 영역이 훨씬 작은데, 아래 -0.34 / 0.28은 인간 크기를 가정한
  //   뷰 비율 상수여서 실제보다 큰 영역으로 계산돼 이동이 일찍 막힌다.
  //   ★ 상수 자체를 줄이면 범위의 위·아래가 함께 이동해서 한쪽이 오히려 좁아진다(실제로 그렇게 실패함).
  //     그래서 세로 모니터용 yExtra와 똑같이 '범위를 양쪽으로 넓히는' 방식을 쓴다 — 부호와 무관하게 확실하고,
  //     이미 검증된 선례라 안전하다. 가로 이동도 같은 이유로 넓힌다.
  let _panEX = 0, _panEUp = 0, _panEDn = 0;
  try{ const _me = seats().find(s=>s.isMe);
       if(_me && _me.charDef && _me.charDef.animal){ const _e=_animalPanExtra(); _panEX=_e.x; _panEUp=_e.up; _panEDn=_e.dn; } }catch(_){}
  //   ★ 실측 결과 nyMax 쪽이 '아래' 방향이었다 — 양쪽을 함께 넓혔더니 아래로만 자유로워져서
  //     작업표시줄 밑으로 빠져나갔다. 그래서 아래(nyMax)는 원래대로 두고 위(nyMin)만 넓힌다.
  const nxMin = -0.5 + PAN_MARGIN - (-0.34) - _panEX;
  const nxMax =  0.5 - PAN_MARGIN - (-0.34) + _panEX;
  const nyMin = -0.5 + PAN_MARGIN_Y - 0.28 - yExtra - _panEUp - PAN_UP_EXTRA;     // 위쪽 한계
  const nyMax =  0.5 - PAN_MARGIN_Y - 0.28 + yExtra + _panEDn - PAN_DOWN_TRIM;    // 아래쪽 한계
  return { x: Math.max(nxMin, Math.min(nxMax, px)), y: Math.max(nyMin, Math.min(nyMax, py)) };
}
/* 설정 패널의 "캐릭터 크기" 슬라이더 값 — 데스크톱 run 모드 전용 배율 (localStorage에서 복원) */
let focusCharScale=_loadCharScale();
// ★ 좌석 i의 책상 "반쪽 폭"을 실측(월드 기준, deskScale 등 모든 스케일 반영) — 상대방이 책상 크기를
//   키우거나 줄여도 여기서 정확히 잡아내서, layoutSeats가 항상 일정한 여백을 유지할 수 있게 함.
//   ★ deskAnchor(꾸며놓은 책상 아이템들이 붙는 자리)는 반드시 제외 — 안 그러면 아이템 크기(ITEM_TARGET_SIZE)를
//   키웠을 때 "책상 폭"이 실제보다 훨씬 크게 측정돼서 카메라가 필요 이상으로 멀리 물러나 보이는 문제가 있었음.
const DESK_HALFWIDTH_CAP_FOR_ZOOM = 1.1;   // 카메라 줌 계산에만 적용되는 상한선 — 유난히 큰 책상 하나 때문에
                                            // 전체 화면이 과하게 줌아웃되는 것 방지(좌석 간 여백 자체는 이 상한 영향 안 받음)
function seatDeskHalfWidth(seat, forZoom){
  if(!seat || !seat.desk) return 0.85;   // 책상이 아직 없으면(초기화 중 등) 기본 책상 폭(1.7)의 절반으로 대체
  /* ⚠️ updateMatrixWorld(true) 가 아니라 **updateWorldMatrix(true, true)** 여야 한다.
       앞엣것은 조상(seat.group)의 matrixWorld 를 '캐시된 그대로' 곱해 쓴다. 그런데 fitModel 은
       측정을 위해 group.position 을 0 으로 옮겼다가 값만 되돌리고 matrixWorld 는 그대로 두므로,
       fitModel 직후에는 그 캐시가 **x=0 시절의 행렬**이다. 그 상태로 재면 박스는 원점 근처(±0.85)에
       잡히는데 아래 cx 는 진짜 좌표(예 -3.5)라, reach 가 4.35 로 부풀어 좌석 간격이 통째로 벌어진다.
       (평준화를 켜면 syncSeatEqualize 가 좌석마다 fitModel 을 부르고 그 자리에서 여기로 오므로
        전 좌석이 한꺼번에 이 값을 낸다 — "켜면 간격이 굉장히 넓어졌다가 나중에 원래대로 돌아온다"의
        정체다. 돌아오는 이유는 그 사이 렌더 프레임이 matrixWorld 를 바로잡기 때문이다.)
     ★ 측정 함수는 남이 남긴 상태에 기대지 않는다 — 조상부터 자손까지 여기서 직접 세운다. */
  seat.desk.updateWorldMatrix(true, true);
  const box = new THREE.Box3(); let any=false;
  seat.desk.children.forEach(ch=>{
    if(ch.name==='deskAnchor' || ch.visible===false) return;   // 책상 위 아이템은 폭 계산에서 제외 — 책상 자체만 봄
    const b=new THREE.Box3().setFromObject(ch);
    if(!b.isEmpty()){ box.union(b); any=true; }
  });
  if(!any) return 0.85;
  const size = box.getSize(new THREE.Vector3());
  /* ★ '폭의 절반'이 아니라 '좌석 중심에서 가장 멀리 뻗은 쪽까지'를 쓴다.
     [경위] 책상 위치(deskPos)를 옮길 수 있게 되면서 책상이 좌석 중심에서 좌우로 치우칠 수 있다.
       size.x/2 는 치우쳐도 값이 그대로라(박스가 통째로 옮겨질 뿐) 옆 좌석과 겹쳐도 layoutSeats 가
       모르는 채 지나간다. 중심에서의 거리로 재면 치우친 만큼 간격이 자동으로 벌어진다.
     ★ 안 옮긴 책상(대칭)에서는 두 값이 같다 = 기존 사용자에겐 회귀가 없다. */
  const cx = (seat.group ? seat.group.position.x : 0);
  const reach = Math.max(Math.abs(box.max.x - cx), Math.abs(box.min.x - cx), size.x / 2);
  const half = Math.max(reach, 0.15);   // 너무 작은 값으로 다닥다닥 붙는 것 방지
  return forZoom ? Math.min(half, DESK_HALFWIDTH_CAP_FOR_ZOOM) : half;
}
// 마지막으로 계산된 좌석 배치 결과 캐시 — 좌석 수/책상 크기가 안 바뀌었으면(예: 캐릭터 크기 슬라이더만
//움직일 때) 이 값을 재사용해서 무거운 책상 실측(Box3)을 매번 다시 안 해도 되게 함.
let _cachedRowCenter = 0, _cachedRowSpan = 1.2;
const ANIMAL_RUN_SCALE = 0.4;      // 🐾 동물 실행화면 크기 = 인간의 40%. 캐릭터(fitModel)와 책상(setDeskScale의 animCorr)에 함께 적용됨.

return {
  attachLayout,
  CHAR_Z,
  CHAR_Y_MAX,
  clampCharY,
  seatCharZ,
  BASE_PXW,
  ANIMAL_RUN_SCALE,
  saveCharPos,
  saveCharScale,
  refreshCharScaleForCurrentDisplay,
  clampDeskPan,
  seatDeskHalfWidth,
  sizeFactor: ()=>sizeFactor,
  setSizeFactor: (v)=>{ sizeFactor = v; },
  deskPanX: ()=>deskPanX,
  setDeskPanX: (v)=>{ deskPanX = v; },
  deskPanY: ()=>deskPanY,
  setDeskPanY: (v)=>{ deskPanY = v; },
  focusCharScale: ()=>focusCharScale,
  setFocusCharScale: (v)=>{ focusCharScale = v; },
  _cachedRowCenter: ()=>_cachedRowCenter,
  setCachedRowCenter: (v)=>{ _cachedRowCenter = v; },
  _cachedRowSpan: ()=>_cachedRowSpan,
  setCachedRowSpan: (v)=>{ _cachedRowSpan = v; },
};
}

const api = { createCharPlace };
if(typeof window !== 'undefined') window.TwCharPlace = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
