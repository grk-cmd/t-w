/* overhead.js — 💬 머리 위 말풍선 · 회사원 모드 라벨 · 🏷️ 머리 위 이름표 · 상태칩 방향 · 공지 배너
   app.js «💬 머리 위 말풍선 · 회사원 모드 라벨» · «🏷️ 머리 위 이름표 · 상태칩 방향 · 공지 배너» 두 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 34번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도 · 덩이 2개를 원래 차례로 · 사이에 빈 줄 하나). 바뀐 줄은 3줄 —
     focusLevelMod · officeMode 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 6개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: setSeatMenu · setLabelDrag · bindLabelDrag · NAMEPLATE_BELOW_EXPBAR · _officeDemojiHtml · _seatLabelName · applyChipOrientation · chipHorizontal · dismissSeatHeadBubble · ensureSeatLabelsLayer · nameplateEnabled · projectWorldToScreenPx · removeSeatLabels · setSeatHeadBubble · setSeatNamePlate — app.js 는 overheadMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwOverhead — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-overhead.js */
(function(){

function createOverhead(deps){
const ANIMAL_RUN_SCALE = deps.ANIMAL_RUN_SCALE;
const _chatEsc = deps._chatEsc;
const _diceSvg = deps._diceSvg;
/* 좌석 우클릭 메뉴를 열 곳 — 메뉴(room/seat-menu.js)가 신고 · 마이홈 · 놀이를 거쳐 이 모듈로 돌아오므로 deps 로 받으면 서로를 부른다(sim-dep-cycles).
   app.js 가 메뉴를 만든 뒤 setSeatMenu 로 잇는다. */
let _seatMenuFn = null;   // 이름이 메뉴 함수(_seatCtxMenu)와 겹치지 않게 — 되살린 글(sim-renderer-src)에서 한 글이 된다
function setSeatMenu(fn){ _seatMenuFn = fn; }
/* 🏷️ 이름표 · 경험치 바를 눌러 끌면 자리 바꾸기(room/seat-label-drag.js) — 끌기 상태가 app.js 에 있어 만든 뒤 setLabelDrag 로 잇는다.
   ⚠️ 잇기 전에 만든 라벨도 듣도록 리스너는 늘 걸고, 누를 때 함수를 본다. */
let _labelDragFn = null;
function setLabelDrag(fn){ _labelDragFn = fn; }
function bindLabelDrag(el, seat){
  el.addEventListener('pointerdown', e=>{ if(_labelDragFn) _labelDragFn(e, seat); });
}
const _starPaint = deps._starPaint;
const _wpTmp3 = deps._wpTmp3;
const camera = deps.camera;
const chatUiMod = deps.chatUiMod;
const focusLevelMod = deps.focusLevelMod;   // 읽는 함수
const getDisplayName = deps.getDisplayName;
const officeMode = deps.officeMode;   // 읽는 함수
const renderer = deps.renderer;
const rtHub = deps.rtHub;   // 🛰 realtime 연결 하나(TwRtHub — .store) — 확성기 announce 메시지
const seatScale = deps.seatScale;
const seats = deps.seats;
const tricksMod = deps.tricksMod;
/* 📐 잰 값 기억(room/label-measure.js) — 라벨을 적은 뒤 바로 재서 매 프레임 강제 레이아웃이 나지 않게 */
const labelMeasure = TwLabelMeasure.createLabelMeasure({
  readCanvasRect: ()=>renderer.domElement.getBoundingClientRect(),
  now: ()=>performance.now(),
});
/* ── 머리 위 레벨/이름 이름표 + 말풍선 — DOM 요소로 구현(3D 스프라이트 아님).
   이유: 1) 저해상도(도트) 렌더는 WebGL 캔버스 전체 해상도를 낮추는 방식이라 3D 스프라이트도 같이 뭉개졌는데,
        DOM은 별도 레이어라 전혀 영향 안 받음. 2) 캔버스 텍스처는 고정 폭이라 긴 이름이 잘렸는데, DOM 텍스트는
        자동으로 폭이 늘어나서 잘릴 일이 없음. 3) 픽셀 단위 오프셋(예: 3px)을 정확히 줄 수 있음(3D 월드좌표는 근사치만 가능).
   위치 갱신은 상태칩(updateMyStatusChipPosition)과 완전히 같은 방식: 3D 월드좌표 → project(camera) → 화면 픽셀. ── */
let nameplateEnabled = (localStorage.getItem('tw.nameplate') !== '0');   // 기본 켜짐
/* 상태칩 배치 — 'v'(세로, 기본) | 'h'(가로). 설정 > 화면표시에서 전환, localStorage에 유지.
   CSS는 #myStatusChip.horz 로 방향만 바꾸고, 화면상 위치는 updateMyStatusChipPosition이 분기 처리한다. */
let chipHorizontal = (localStorage.getItem('tw.chipHorz') === '1');
function applyChipOrientation(){
  const chip = document.getElementById('myStatusChip');
  if(chip) chip.classList.toggle('horz', chipHorizontal);
}
try{ applyChipOrientation(); }catch(_){}
// 저장된 이름표 크기(--nameplate-size)를 페이지 로드 시점에 즉시 CSS 변수에 반영. 설정 패널을 안 열어도 유지됨.
(function _applySavedNameplateSize(){
  try{
    const v=parseInt(localStorage.getItem('tw.nameplateSize'),10);
    if(isFinite(v)&&v>0){
      const layer=document.getElementById('seatLabelsLayer');
      if(layer) layer.style.setProperty('--nameplate-size', v+'px');
    }
  }catch(e){}
})();
const _labelWP=new THREE.Vector3();
function projectWorldToScreenPx(worldVec3){
  _labelWP.copy(worldVec3).project(camera);
  const rect=labelMeasure.canvasRect();
  return { x: rect.left+(_labelWP.x*0.5+0.5)*rect.width, y: rect.top+(-_labelWP.y*0.5+0.5)*rect.height };
}
function ensureSeatLabelsLayer(){
  let layer=document.getElementById('seatLabelsLayer');
  return layer;
}
function ensureSeatNamePlateEl(seat){
  if(seat.namePlateEl) return seat.namePlateEl;
  const layer=ensureSeatLabelsLayer(); if(!layer) return null;
  const el=document.createElement('div');
  el.className='seat-nameplate';
  /* 🖱 이름표 우클릭 = 좌석 우클릭과 같은 메뉴(2026-09-23 요청). 캔버스 우클릭의 게이트를 그대로 따른다 —
     조준 중이면 안 열고, 회사원 모드면 남의 좌석은 조용히 막는다. 책상은 원래 seat.group 에 들어 있어
     캔버스 레이캐스트로 이미 같은 메뉴가 뜬다.
     ⚠️ 이름표는 pointer-events:auto(CSS) + UI_HIT_SEL '.seat-nameplate' 라야 실행 화면에서 클릭을 받는다. */
  el.addEventListener('contextmenu', e=>{
    e.preventDefault(); e.stopPropagation();
    try{ if((typeof tricksMod._flyAiming !== 'undefined' && tricksMod._flyAiming()) || (typeof tricksMod._bonkAiming !== 'undefined' && tricksMod._bonkAiming())) return; }catch(_){}
    if(typeof officeMode() !== 'undefined' && officeMode() && seat.remote) return;
    if(_seatMenuFn) _seatMenuFn(e, seat);
  });
  bindLabelDrag(el, seat);
  layer.appendChild(el);
  seat.namePlateEl=el; return el;
}
/* 🐾 라벨(이름표·말풍선) 기준 높이 — 예전엔 인간 키 1.2를 하드코딩해서, 40% 크기인 동물 위에는
   라벨이 허공에 뜨는 문제가 있었다. 동물이면 같은 배율(ANIMAL_RUN_SCALE)을 곱해 머리 바로 위로 내린다.
   (라벨 사이 간격 상수들은 절대값 그대로 — 글자까지 작아지면 안 되므로 의도적으로 유지) */
function seatLabelHeadY(seat){
  const animCorr = (seat && seat.charDef && seat.charDef.animal) ? ANIMAL_RUN_SCALE : 1;
  /* 🪑 평준화된 좌석은 몸이 k 배로 커져 있다(fitModel 의 bodyWrap.scale). 여기서 raw userScale 을
     쓰면 라벨만 옛 키에 남아 커진 캐릭터의 얼굴을 가린다 — 그래서 seatScale(실효값)이다. */
  return 1.2*seatScale(seat)*0.82*animCorr;
}
/* 🔻 반전 배치(캐릭터가 화면 위쪽 → 라벨이 발 밑으로 뒤집힘)에서 라벨끼리의 여백(px).
   발 → 이름표 → 공지 순으로 이만큼씩만 띄운다. 말풍선은 꼬리가 들어갈 자리가 필요해서
   따로 BUBBLE_INV_GAP_FEET_PX(18)를 쓴다 — 이름표는 꼬리가 없어 더 붙어도 된다.
   ★ 예전엔 월드 오프셋(-0.2/-0.5)이었다. 그 값은 요소의 실제 높이와 무관해서 화면상 20px 넘게
     벌어졌고(요청: 줄여달라), 캐릭터 크기가 달라지면 여백만 같이 커지는 문제도 있었다. */
const LABEL_INV_GAP_PX = 5;
/* 🏷️ 이름표를 항상 '발밑 · 경험치 바 아래'에 둔다(요청 사양).
   [왜] 예전엔 평소 머리 위 / 화면 위쪽에 붙으면 발밑(반전) / 남의 머리에 올라타면 바 아래 —
     이렇게 세 자리를 오갔다. 그래서 같은 화면에서 탑을 쌓은 캐릭터와 안 쌓은 캐릭터의
     이름표 위치가 서로 달라 보였다(제보). 항상 한 자리면 그 불일치가 사라지고,
     이름표가 아래 캐릭터 얼굴을 가리는 문제도 구조적으로 안 생긴다.
   ⚠️ **비키는 방향은 한쪽뿐이어야 한다.** 경험치 바가 이름표를 피하고 이름표도 바를 피하면
      매 프레임 서로를 밀어내며 화면 아래로 흘러내린다(setSeatHeadBubble 주석의 그 문제).
      그래서 이 값이 켜지면 바는 이름표를 **안 피하고**(updateSeatExpBar), 이름표가 바를 피한다.
      프레임 루프의 호출 순서도 '바 → 이름표 → 말풍선'으로 뒤집어 뒀다 — 순서가 곧 배치 규칙이다.
   ⚠️ seat._invertLabels 는 계속 예전 규칙대로 계산한다. 말풍선이 그 값을 보고 '말하는 캐릭터
      머리 위'를 유지하기 때문이다 — 여기서 같이 뒤집으면 말풍선까지 발밑으로 내려간다.
   false 로 두면 예전 3자리 규칙으로 그대로 돌아간다. */
const NAMEPLATE_BELOW_EXPBAR = true;
/* 이름표 높이(px) — 경험치 바(화면 아래 눌러 올리기)와 이름표가 같이 읽는다. 못 잰 적이 없으면 0 */
function nameplateHeight(seat){
  const el = seat && seat.namePlateEl;
  const m = el ? labelMeasure.size(el, el._npKey + '|' + el.className) : null;
  return (m && m.h) || 0;
}
/* dj — 🎧 같이 듣기 방의 지금 DJ 면 이름 뒤에 «🎧 DJ» 딱지(누가 DJ 인지는 app.js 가 listen-ui 에서 받아 넘긴다) */
function setSeatNamePlate(seat, level, name, star, dj){
  const el=ensureSeatNamePlateEl(seat); if(!el) return;
  // ★ 말풍선(headAnchor 기준, userScale에 비례)이랑 순서가 안 뒤집히게 이름표도 같은 비례식으로 "머리 바로 위" 높이 계산.
  //   group 기준(rig 아님)이라 흔들기/드래그 중에도 책상·상태칩처럼 제자리 고정.
  const headY = seatLabelHeadY(seat);
  // ─── 캐릭터 상단 반전 판정 ───
  //   캐릭터를 화면 위로 옮기면 이름표/공지/말풍선이 화면 밖으로 잘림 → 캐릭터 아래(발 밑)로 반전 배치.
  //   판정 기준: 정상 배치의 최상단 요소(headY+0.9 = 공지 있을 때 말풍선 위치)의 화면 y가 임계값 이하면 반전.
  //   히스테리시스로 진동 방지: 반전 시작은 y<24, 해제는 y>50(경계 26px 폭).
  //   결과는 seat._invertLabels에 저장 — updateSeatAnnounceEl, setSeatHeadBubble이 참조.
  seat.group.getWorldPosition(_wpTmp3); _wpTmp3.y += headY + 0.6;   // 라벨군 전체 하강에 맞춰 반전 판정 기준도 함께
  const topP = projectWorldToScreenPx(_wpTmp3);
  const prevInvert = !!seat._invertLabels;
  const invert = prevInvert ? (topP.y < 50) : (topP.y < 24);
  seat._invertLabels = invert;
  // ─── 이름표 위치 ───
  //   정상: headY+0.55 (머리 위 앵커, transform -100%로 위쪽으로 그려짐)
  //   반전: -0.2 (발 밑 앵커, transform 0으로 아래쪽으로 그려짐 — .inverted 클래스가 처리)
  //   NAMEPLATE_BELOW_EXPBAR 가 켜져 있으면 반전 판정과 무관하게 **항상** 발밑이다.
  const _atFeet = NAMEPLATE_BELOW_EXPBAR || invert;
  seat.group.getWorldPosition(_wpTmp3);
  //   발밑일 땐 발 원점을 그대로 투영하고, 실제 간격은 아래에서 px로 준다(LABEL_INV_GAP_PX 주석 참고).
  if(!_atFeet) _wpTmp3.y += headY + 0.25;   // 요청: 이름표가 너무 높음 — 머리에 더 가깝게 0.55→0.25
  const p=projectWorldToScreenPx(_wpTmp3);
  let _plateTop = _atFeet ? (p.y + LABEL_INV_GAP_PX) : p.y;
  /* 내 경험치 바 아래로 비킨다. 바는 이 프레임에 **이미** 자리를 잡았다 — 호출 순서를
     '바 → 이름표'로 뒤집어 뒀기 때문이다. 위치는 style.top 파싱이 아니라 실제 화면 사각형으로
     잰다(transform·클래스·단위가 어떻게 바뀌어도 이미 반영된 결과값이라서). */
  if(NAMEPLATE_BELOW_EXPBAR){
    const _mb = seat.expBarEl;
    if(_mb && _mb.style.display !== 'none' && _mb._bottom != null) _plateTop = Math.max(_plateTop, _mb._bottom + 4);
  }
  /* 화면 아래로 잘리지 않게 — 이름표는 바가 아니라 **발밑**을 기준으로 놓이므로, 바만 화면 안으로 올리면
     이름표는 그대로 밖에 남는다(제보: 화면 아래에 두면 이름이 잘림). 바는 이미 이 높이만큼 올라가 있다
     (updateSeatExpBar 의 below) — 그래서 이 제한과 위의 «바 아래» 가 서로 밀지 않는다. */
  const _h = nameplateHeight(seat);
  if(_atFeet){
    if(_h) _plateTop = Math.min(_plateTop, innerHeight - _h - 2);
  }
  el.style.left=p.x+'px'; el.style.top=_plateTop+'px';
  el._bottom = _atFeet ? _plateTop + _h : _plateTop;   // 말풍선 · 공지가 사각형을 다시 재지 않고 읽는다
  el.classList.toggle('inverted', _atFeet);   // CSS의 transform 방향 뒤집기
  seat._plateAtFeet = _atFeet;                // (배너는 더 이상 이 값을 안 본다 — updateSeatAnnounceEl 주석 참고)
  /* 🗑️ [폐기] '올라탄 좌석의 이름표를 탑 바닥 발밑으로 내리는' 분기가 여기 있었다.
     이름표가 머리 위에 있던 시절, 올라탄 좌석의 이름표가 아래 캐릭터 얼굴을 가려서 넣었던 것이다.
     이제는 NAMEPLATE_BELOW_EXPBAR 로 **모든 좌석의 이름표가 항상 발밑**이라 가릴 일이 없고,
     아래에서 올라탄 좌석은 아예 숨기므로 이 자리 계산 자체가 쓸모없어졌다.
     (앵커 헬퍼 _uiAnchorSeat/_uiAnchorWorld 는 상태칩이 계속 쓰므로 그대로 둔다.) */
  // 공지 배너는 이름표 켜짐 여부와 관계없이 항상 위치 갱신 — 요청사항: 이름표 꺼도 배너는 표시.
  updateSeatAnnounceEl(seat, headY);
  if(!nameplateEnabled || document.body.classList.contains('config')){ el.style.display='none'; return; }
  /* 🐾 탑에서는 **바닥 캐릭터의 이름표만** 보인다 — 올라탄 좌석은 숨긴다(요청 사양).
     [바뀐 이력] 예전엔 정반대였다: 바닥을 숨기고 맨 위 것만 남겼다. 그때는 이름표가 머리 위에
       있어서 바닥 캐릭터의 이름표가 곧 위층 캐릭터에 덮이는 자리였기 때문이다.
       이름표가 전부 발밑으로 내려온 지금은 덮이지 않고, 발밑에 있는 것은 바닥 캐릭터의 것이
       자연스럽다(경험치 바도 바닥 좌석 것만 뜬다 — updateSeatExpBar 가 ridingOn 이면 숨긴다).
     ・직속 여부만 보면 충분하다 — ridingOn 이 있으면 2층이든 5층이든 전부 숨는다.
     ・updateSeatAnnounceEl 뒤에 두는 게 중요하다 — 앞에서 return하면 공지 배너 갱신이 멈춘다. */
  if(seat.ridingOn){ el.style.display='none'; return; }
  /* 🌟 회차면 'Lv.' 자리에 색 있는 별(.np-star · 번쩍임)이 선다 — «★342  이름» (개정 70).
     ★ 매 프레임 불리므로 열쇠(_npKey)가 같으면 DOM 을 안 건드린다. 별은 span 이라 textContent 비교로는 못 잰다. */
  const key = (star ? ('\u2605|' + star.cyc + '|' + star.color + '|' + level + '|' + name) : ('Lv.' + level + '  ' + name)) + (dj ? '|dj' : '');
  if(el._npKey !== key){
    el._npKey = key;
    if(star){
      el.textContent = '';
      const sp = document.createElement('span'); sp.className = 'np-star'; sp.textContent = focusLevelMod().lvStarStr(star.cyc);
      el.appendChild(sp);
      el.appendChild(document.createTextNode(level + '  ' + name));
    } else el.textContent = 'Lv.' + level + '  ' + name;
    if(dj){ const b = document.createElement('span'); b.className = 'np-dj'; b.textContent = '🎧 DJ'; el.appendChild(b); }
    _starPaint(el, star);
  }
  el.style.display='block';
}
// ★ 런처5: 공지 배너 element 관리 — 활성 공지가 있으면 이름표 위에 200px 마퀴로 표시.
function ensureSeatAnnounceEl(seat){
  if(seat.announceEl) return seat.announceEl;
  const layer=ensureSeatLabelsLayer(); if(!layer) return null;
  const el=document.createElement('div'); el.className='seat-announce';
  const inner=document.createElement('span'); inner.className='marquee';
  el.appendChild(inner);
  layer.appendChild(el);
  seat.announceEl=el; return el;
}
/* 📢 이 좌석에 공지 배너를 띄울 것인가 — 내 좌석에서만 띄운다.
   공지(_activeAnnounceText)는 전원에게 똑같이 내려오는 하나의 문구인데, 예전엔 좌석마다 그려서
   6인 방이면 같은 배너가 6개 겹쳐 떴다. 읽는 내용은 하나뿐이라 정보가 늘지 않고 화면만 어지럽다.
   ★ 말풍선 높이 계산(ANNOUNCE_EXTRA)도 반드시 같은 판정을 써야 한다 —
     여기만 숨기면 남의 말풍선이 없는 배너 자리만큼 붕 뜬 채로 남는다. */
function _seatShowsAnnounce(seat){ return !!(_activeAnnounceText && seat && seat.isMe); }
function updateSeatAnnounceEl(seat, headY){
  const active = _seatShowsAnnounce(seat) ? _activeAnnounceText : null;
  if(!active){
    if(seat.announceEl) seat.announceEl.style.display='none';
    return;
  }
  const el=ensureSeatAnnounceEl(seat); if(!el) return;
  const inner=el.querySelector('.marquee');
  const displayText = '📢[공지] ' + active;   // 요청사항: 관리자가 안 넣어도 말머리는 항상 붙음
  if(inner.textContent!==displayText){ inner.textContent=displayText; el._annFit = false; }
  // 위치: 정상은 머리 위(headY+0.4), 반전은 발밑 라벨 아래.
  /* 📢 배너 자리 — 이름표를 따라다니지 **않는다**. 이름표는 NAMEPLATE_BELOW_EXPBAR 로 항상 발밑에
     내려갔지만, 배너까지 같이 내려가니 발밑에 바·이름표·칩·배너가 한 줄로 쌓여서 가로 배치
     상태칩이 배너를 덮었다(제보). 배너는 다시 머리 위가 기본이다.
     ⚠️ 그래서 여기서는 _plateAtFeet 를 보지 않고 _invertLabels 만 본다 — 캐릭터가 화면 위쪽에
       붙어(프로그램을 모니터 상단에 두면) 머리 위가 잘릴 때만 발밑으로 뒤집힌다.
     ★ 말풍선 쪽은 이미 이 배치를 전제로 짜여 있다(ANNOUNCE_EXTRA 0.2 만큼 배너 위로 비킨다) —
       따로 손댈 것이 없다. */
  const invert = !!seat._invertLabels;
  seat.group.getWorldPosition(_wpTmp3);
  if(!invert) _wpTmp3.y += headY + 0.4;   // 공지도 이름표와 같이 하강 (0.7→0.4, 간격 유지)
  const p=projectWorldToScreenPx(_wpTmp3);
  let _top = p.y;
  if(invert){
    /* 반전 — 이름표 아래변에 붙인다. 이 함수는 setSeatNamePlate가 이름표 좌표를 찍은 '직후'에
       불리므로 같은 프레임의 최신 값이다(말풍선은 순서상 한 프레임 전 값을 본다). */
    const np = seat.namePlateEl;
    const npBottom = (np && np.style.display !== 'none' && np.classList.contains('inverted') && np._bottom != null)
      ? np._bottom : null;
    _top = (npBottom != null ? npBottom : p.y) + LABEL_INV_GAP_PX;
    /* 🎛️ 반전일 때는 상태칩보다 **아래**로 내려간다.
       [왜] 발밑이 뒤집힌 자리에는 가로 배치 상태칩도 같이 앉는다(updateMyStatusChipPosition 이
         이름표 아래에 놓는다). 배너가 그 위에 서면 칩 줄에 그대로 가린다.
       ⚠️ 방향은 한쪽뿐이다 — 칩은 바·이름표까지만 피하고 배너는 쳐다보지 않는다. 여기서만
         칩을 피하므로 서로 밀어내는 일이 없다(setSeatNamePlate 주석의 그 함정).
       ※ 칩은 프레임 맨 끝에 배치되므로 여기서 읽는 값은 한 프레임 전이다. 칩 자리는 배너와
         무관하게 정해지므로 값이 튀지 않는다. 세로 배치라 가로로 안 겹치면 그냥 넘어간다. */
    const _chip = document.getElementById('myStatusChip');
    if(_chip && _chip.style.display !== 'none'){
      const _cr = _chip.getBoundingClientRect();
      const _as = labelMeasure.size(el, el.className);
      const _halfW = ((_as && _as.w) || 200) / 2;
      if(_cr.height && _cr.right > p.x - _halfW && _cr.left < p.x + _halfW)
        _top = Math.max(_top, _cr.bottom + LABEL_INV_GAP_PX);
    }
  }
  el.style.left=p.x+'px'; el.style.top=_top+'px';
  el.classList.toggle('inverted', invert);   // CSS의 transform 방향 뒤집기
  { const _as = labelMeasure.size(el, displayText + '|' + el.className);
    el._bottom = invert ? _top + ((_as && _as.h) || 0) : _top; }
  if(document.body.classList.contains('config')){ el.style.display='none'; return; }
  el.style.display='block';
  /* 텍스트가 배너 폭보다 길면 마퀴 스크롤, 짧으면 정지 & 중앙 정렬 — 글이 바뀌었을 때만 잰다(매 프레임 재면 강제 레이아웃) */
  if(el._annFit) return;
  el._annFit = true;
  requestAnimationFrame(()=>{
    const textW = inner.scrollWidth;
    const wrapW = el.clientWidth;
    if(!wrapW){ el._annFit = false; return; }   // 그 사이 숨음 — 다시 보일 때 잰다
    if(textW > wrapW - 4){
      el.classList.add('scrolling');
      inner.style.paddingLeft = '100%';
    } else {
      el.classList.remove('scrolling');
      inner.style.paddingLeft = ((wrapW - textW)/2)+'px';
    }
  });
}
// 현재 활성 공지 텍스트(null=없음) — realtime announce 메시지가 갱신
let _activeAnnounceText = null;
let _announceExpireTimer = null;
const ANNOUNCE_MAX_MS = 60000;   // 서버가 보내는 확성기는 길어야 60초 — 이 기기 시계가 틀려도 이보다 오래 보이지 않게
/* m = { text, until(ms) } — text 가 null 이면 끔. until 은 서버가 정한 끝나는 때 */
function _refreshAnnounceState(m){
  clearTimeout(_announceExpireTimer);
  _activeAnnounceText = null;
  if(m && m.text && typeof m.until === 'number'){
    const remain = Math.min(m.until - Date.now(), ANNOUNCE_MAX_MS);
    if(remain > 0){
      _activeAnnounceText = m.text;
      _announceExpireTimer = setTimeout(()=>{ _activeAnnounceText = null; _hideAllAnnounceEls(); }, remain);
    }
  }
  if(!_activeAnnounceText) _hideAllAnnounceEls();
}
function _hideAllAnnounceEls(){ seats.forEach(s=>{ if(s.announceEl) s.announceEl.style.display='none'; }); }
rtHub.store.onMessage('announce', _refreshAnnounceState);   // 📣 확성기 — 서버가 보낼 때 · 접속 직후 아직 안 끝난 것

/* 🔻 반전 배치(캐릭터가 화면 위쪽에 있어 라벨이 발 밑으로 뒤집힌 경우) 말풍선 여백(px).
   두 값을 나눠 쓴다 — 위에 라벨이 있을 때와 없을 때 필요한 여백이 다르다.
     ・LABEL: 이름표·공지 아래벽에 바로 붙일 때. 라벨끼리는 촘촘한 게 한 묶음으로 읽힌다.
     ・FEET : 위에 아무 라벨도 없을 때 발에서 띄우는 양. 캐릭터에 딱 붙으면 꼬리가 발에 파묻힌다.
   [왜 벌어졌었나] 예전엔 월드 오프셋 하나(-0.3~-0.65)로 찍었는데, 그 값은 `nameplateEnabled`
   (전역 설정)만 보고 **이 좌석에 이름표가 실제로 그려지는지**는 안 봤다. 이름표가 없는 좌석
   (동물·자리추가 등)에서는 -0.4 자리에 아무것도 없어 발밑이 통째로 비었다 — 그게 넓어 보인 여백이다.
   px 단위인 이유: 이름표·말풍선 자체가 고정 px 크기의 DOM이라, 여백도 같은 단위여야
   캐릭터 크기(동물 40% 등)에 따라 여백만 이상하게 커지거나 붙지 않는다. */
/* 🔻 반전(발밑) 배치에서는 말풍선이 꼬리도 동그라미도 안 그린다 — CSS 의 .inverted:after 주석 참고.
   그래서 이 여백은 예전 값 그대로다. 한때 생각 말풍선의 동그라미가 위로 45px 뻗는 것을 피하려고
   12px 로 올렸는데, 지금은 그 동그라미 자체가 반전에서 사라지므로 되돌렸다.
   ⚠️ 반전에서 꼬리를 다시 살리면 이 값을 그만큼 키워야 한다. 안 그러면 이름표를 가린다. */
const BUBBLE_INV_GAP_LABEL_PX = 6;
const BUBBLE_INV_GAP_FEET_PX  = 18;
/* ↔️ 말풍선 좌우 미세 이동(px). 양수=오른쪽. 0 = 캐릭터 한가운데. */
const BUBBLE_X_NUDGE_PX = 0;
function ensureSeatBubbleEl(seat){
  if(seat.bubbleEl) return seat.bubbleEl;
  const layer=ensureSeatLabelsLayer(); if(!layer) return null;
  const el=document.createElement('div');
  el.className='seat-bubble-dom';
  /* ★ 글은 안쪽 .bub-txt 에 넣는다 — 줄 수 제한(-webkit-line-clamp)에 필요한 overflow:hidden 을
     바깥에 두면 꼬리(::after/::before)가 바깥에 그려지는 탓에 통째로 잘려 사라진다.
     또 바깥은 표시할 때 style.display='block' 으로 덮이므로 -webkit-box 를 유지할 수도 없다. */
  const txt=document.createElement('div');
  txt.className='bub-txt';
  el.appendChild(txt);
  // ★ 부모 레이어(#seatLabelsLayer)가 pointer-events:none이라 클릭이 그대로 캔버스(3D 씬)로 뚫고
  //   지나감 — 말풍선은 머리보다 위 허공에 떠 있어서 그 지점 레이캐스트가 캐릭터 몸체를 못 맞히는
  //   경우가 많아 "말풍선을 직접 클릭"하면 안 사라지던 원인. 여기서 자체적으로 클릭을 받게 함.
  el.style.pointerEvents='auto';
  el.style.cursor='pointer';
  el.addEventListener('click', e=>{ e.stopPropagation(); dismissSeatHeadBubble(seat); });
  layer.appendChild(el);
  seat.bubbleEl=el; return el;
}
/* 🏢 회사원 모드 — 머리 위 '한 줄 라벨' 글자 만들기 ────────────────────────
   말풍선 요소를 그대로 쓰고 클래스만 .office 로 바꾼다(배경·테두리·꼬리를 CSS 에서 없앤다).
   새 DOM 을 만들면 반전 배치(_invertLabels)·탑쌓기 숨김·좌석별 정리 배관을 전부 다시 짜야 한다 —
   그게 이미 말풍선에 다 붙어 있다.
   ★ 모양은 `닉네임: 채팅내용` 한 덩어리다(시안 — 괄호는 뺀다).
     **내 닉네임만** 테마색으로 물들여 나와 남을 구분한다(.office-nick.me → CSS).
   ★ 접는 자리는 **CSS 폭에 맡긴다.** 예전엔 여기서 \n 을 넣어 '8자 초과면 반으로 갈라 두 줄'로
     접었는데, 접두어가 붙으면서 그 규칙이 시안(한 줄 15자 이상 · 자연 줄바꿈)과 정면으로
     어긋났다. 이제 폭(--office-label-max-w)과 2줄 클램프가 정하고, 넘치면 … 가 붙는다.
     ⚠️ 맞바꾼 것: 접는 자리가 글꼴·해상도에 따라 달라진다. 자리를 다시 고정하고 싶으면
       여기서 \n 을 넣는 대신 폭 토큰을 조절할 것 — 두 방식을 섞으면 줄이 세 줄로 샌다.
   ⚠️ 반환값은 **HTML 문자열**이다(닉네임 span 때문에). 닉네임·본문 둘 다 여기서 이스케이프하고,
     호출부는 그대로 innerHTML 에 넣는다. 새 조각을 붙일 때 _chatEsc 를 빠뜨리지 말 것. */
function _officeLabelHtml(name, text, isMe){
  const body = _chatEsc(String(text == null ? '' : text));
  const nm = String(name == null ? '' : name).trim();
  if(!nm) return body;                       // 이름을 모르면 접두어 없이 본문만
  return '<span class="office-nick' + (isMe ? ' me' : '') + '">'
    + _chatEsc(nm) + ':</span> ' + body;
}
/* 😊 회사원 모드 라벨의 [demoji:id] → 번들 이미지. 아는 id 만 바꾸고 모르는 것은 글자로 남긴다
   (임의 URL 을 로드하지 않는다 — 채팅 말풍선 쪽과 같은 규칙).
   ★ 입력은 **이미 이스케이프된 HTML** 이다(_officeLabelHtml 의 반환값). 마커는 특수문자가 없어
     이스케이프를 지나도 `[demoji:d01]` 그대로 남으므로 여기서 그대로 찾을 수 있다.
     ⚠️ 순서를 뒤집어 이 함수를 먼저 돌리면, 뒤이은 이스케이프가 <img> 를 글자로 만들어 버린다.
   ★ 크기는 **전부 30px** 로 통일한다. 채팅 말풍선은 춤(d25)만 60px 예외를 두는데, 여기는
     배경 없는 12px 한 줄 라벨이라 예외 하나가 라벨 높이를 통째로 바꾼다.
   ⚠️ 주사위 [dice:N] 와 뿅망치는 여기서 다루지 않는다. 뿅망치는 'Bonk!' 글자로 바꾸기로 한
     결정이 따로 있고(BONK 주석), 주사위는 회사원 모드에서 글자로 두기로 했다. */
const OFFICE_DEMOJI_PX = 30;
function _officeDemojiHtml(html){
  if(!html || typeof chatUiMod.DEMOJI_BY_ID === 'undefined') return html;
  return String(html).replace(/\[demoji:(d\d{2})\]/g, (m, id) => {
    const d = chatUiMod.DEMOJI_BY_ID[id];
    if(!d) return m;
    const sc = OFFICE_DEMOJI_PX / Math.max(d.w, d.h);
    const w  = Math.max(1, Math.round(d.w * sc));
    const h  = Math.max(1, Math.round(d.h * sc));
    return `<img class="bubble-demoji" src="${chatUiMod.DEMOJI_DIR}${d.file}" alt="${_chatEsc(d.cmd)}"`
      + ` style="width:${w}px;height:${h}px;">`;
  });
}
/* 라벨에 쓸 표시 이름 — 이름표(setSeatNamePlate 호출부)와 **같은 출처**를 쓴다.
   여기서 다른 이름을 고르면 머리 위 라벨과 발밑 이름표가 서로 다른 사람처럼 보인다. */
function _seatLabelName(seat){
  if(!seat) return '';
  if(seat.remote) return seat.friendName || '';
  if(seat.isMe) return getDisplayName();
  return '';
}
/* @param think 💭 true 면 '생각 말풍선'(꼬리 대신 동그라미 둘) 모양으로 그린다.
     ★ 무엇을 보여줄지(상태냐 채팅이냐)는 **호출부**가 이미 알고 있으므로 여기서 다시 판정하지 않는다.
       안쪽에서 chatBubbleUntil 을 또 보면 같은 판정이 두 곳으로 갈려 언젠가 한쪽만 고쳐진다.
     ⚠️ 회사원 모드에서는 배경도 꼬리도 없는 한 줄 라벨이라 이 모양을 쓰지 않는다(아래에서 뺀다). */
/* 📐 [2026-08-29] **말풍선을 정수 픽셀에 앉힌다.** — 도트 테두리에 1px 투명 선이 나던 자리.

   [무엇이 났나] 이모티콘·뿅망치·한글이 들어간 말풍선의 테두리를 세로로 관통하는 1px 틈이 생긴다.
     제보 캡처를 픽셀로 재보니 그 열의 색이 **뒤 배경색 그대로**였고, 크림 부분뿐 아니라
     **위아래 검은 테두리까지 관통**하고 있었다. 배경(padding-box)과 테두리(border-box)가
     어긋난 것이었다면 크림 구간에서만 났어야 하므로, 원인은 그쪽이 아니다.

   [진짜 원인] `border-image` 는 좌·중·우(그리고 상·중·하) **아홉 조각을 따로 그린다.** 요소가
     반픽셀 위에 놓이면 브라우저가 조각마다 폭을 따로 반올림해서, 가운데 조각의 오른쪽 끝과
     오른쪽 조각의 왼쪽 끝이 1px 벌어진다. 위·아래 테두리도 같은 x 에서 잘리므로 그 틈이
     세로로 관통한다 — 캡처에서 본 모양 그대로다.

   [반픽셀이 어디서 오나] 두 군데다.
     ① 좌표 — `projectWorldToScreenPx` 의 결과는 3D 투영값이라 늘 소수다.
     ② 폭   — CSS 의 `translate(-50%,-100%)` 가 `width:max-content` 의 절반을 더한다.
              내용 폭이 홀수면 정확히 .5px 이 남는다.
     이모티콘이 잘 걸리는 이유가 여기 있다. `.bubble-demoji` 는 `vertical-align:middle` 인
     30px 이미지라 줄상자 높이·폭을 소수로 만든다. 한글도 폰트 폴백(Tahoma→맑은 고딕) 때문에
     폭이 홀수로 떨어지는 경우가 많다.

   ⇒ 그리는 방식은 하나도 안 건드리고 **자리만 정수로 스냅한다.** 도트 아트·테두리 9px·여백은
     그대로다. 눈에 보이는 변화는 틈이 사라지는 것뿐이다.

   ⚠️ 매 프레임 offsetWidth 를 읽으면 그때마다 레이아웃이 강제로 돌아간다(좌석 수 × 60fps).
     그래서 **바뀔 때만** 재는다: 글이 바뀌었을 때 · 클래스(office/think/inverted)가 바뀌었을 때 ·
     그림이 늦게 로드됐을 때. 그 셋을 `_bxfDirty` / `_bxfCls` 가 잡는다.
   ⚠️ 숨어 있을 때는 offsetWidth 가 0 이라 재지 않고 dirty 를 유지한다 — 0 으로 캐싱하면
     다시 보일 때 왼쪽으로 밀린 채 한 프레임 튄다.
   ⚠️ CSS 의 `translate(-50%,-100%)` 는 지우지 않았다. 첫 스냅 전까지의 폴백이고, 이 함수를
     안 거치는 경로가 생겨도 자리가 깨지지 않는다(인라인 style 이 항상 이긴다). */
/* 📐 [2026-08-29 · 2] **CSS 픽셀이 아니라 디바이스 픽셀 격자에 맞춘다.** — 제보로 확정

   [첫 수정이 왜 오히려 나빠졌나] 처음에는 `Math.round(v)` 로 **CSS 픽셀**을 정수로 맞췄다.
     배율 100% 에서는 그게 곧 디바이스 픽셀이라 맞았지만, 150% 에서는 CSS 1px = 실제 1.5px 이라
     **정수 CSS 좌표가 홀수면 실제 화면에서 정확히 .5px 에 앉는다.** 전에는 투영값이 제각각이라
     우연히 맞는 프레임도 있었는데, 반올림이 그걸 "항상 어긋남" 으로 고정시켜 버렸다.
     제보: "빌드했더니 더 심해졌다 · 디스플레이 150%".
   ⇒ 반올림 단위를 1/devicePixelRatio 로 바꾼다. 이러면 어느 배율에서도 요소의 좌상단이
     실제 픽셀 경계에 앉는다.
   ⚠️ dpr 은 모니터를 옮기면 바뀐다 — 캐시 키에 넣어서 그때 다시 재게 한다.
   ⚠️ **이것만으로 이음매가 완전히 사라진다는 보장은 없다.** 테두리 9px 은 150% 에서 13.5
     디바이스 픽셀이고, 브라우저가 이걸 변마다 따로 반올림한다(제보 캡처에서 왼쪽 검정 5px,
     오른쪽 4px 로 다르게 나온 것이 그 증거). 좌표를 맞춰도 테두리 폭 자체가 반픽셀이면
     가운데 조각과 가장자리 조각의 경계는 계속 어긋날 수 있다.
     남은 두 갈래(테두리 폭·요소 크기를 디바이스 정수로 맞추기)는 `bubble-seam-test.html` 로
     실측해서 고를 것 — 추론으로 고르려다 이미 한 번 틀렸다. */
function _bubSnapTransform(el, invert){
  const dpr = window.devicePixelRatio || 1;
  const snap = v => Math.round(v * dpr) / dpr;
  if(el._bxfHalfW == null || el._bxfDirty || el._bxfCls !== el.className || el._bxfDpr !== dpr){
    const w = el.offsetWidth;
    if(w > 0){
      el._bxfHalfW = snap(w / 2);
      el._bxfH     = snap(el.offsetHeight);
      el._bxfCls   = el.className;
      el._bxfDpr   = dpr;
      el._bxfDirty = false;
    }
  }
  const hw = el._bxfHalfW || 0;
  el.style.transform = invert
    ? ('translate(' + (-hw) + 'px, 0px)')
    : ('translate(' + (-hw) + 'px, ' + (-(el._bxfH || 0)) + 'px)');
}
function setSeatHeadBubble(seat, text, think){
  const el=ensureSeatBubbleEl(seat); if(!el) return;
  /* 🏢 회사원 모드 — 같은 요소를 '한 줄 라벨' 모양으로 바꾼다.
     ⚠️ 글자 변환을 아래 dismiss·중복 판정보다 **먼저** 해야 한다. 모드를 켜고 끄면 같은 대사라도
        표시 문자열이 달라지는데, 뒤에서 바꾸면 seat._lastBubble 비교가 예전 문자열을 물고 있어
        모드를 바꾼 순간 라벨이 갱신되지 않는다. */
  const office = !!officeMode();
  el.classList.toggle('office', office);
  /* ★ 내 화면에서는 내 말풍선이 항상 맨 앞 (.seat-bubble-dom.mine → z-index:3).
     말풍선끼리는 전부 같은 z-index 라 "DOM 에 먼저 생긴 순서"가 앞뒤를 정했고, 그래서 먼저 접속한
     사람의 상태 말풍선이 뒤에 온 사람의 채팅 말풍선을 덮었다. 남들끼리의 앞뒤는 그대로 두고
     내 좌석 것 하나만 올린다.
     ⚠️ 채팅/상태를 구분하지 않는다 — 한 좌석 안에서는 그 둘이 **같은 요소**라 배타적으로 교체되므로,
       좌석을 통째로 올리면 내 채팅은 자동으로 맨 앞이 된다.
     ⚠️ 여기서(=아래 _lastBubble 비교보다 **앞에서**) 토글해야 한다. 뒤에 두면 글자가 같을 때
       조기 return 에 걸려 안 바뀐다 — 바로 위 .office 토글이 여기 있는 것과 같은 이유다.
     ⚠️ ensureSeatBubbleEl(생성 시 한 번)이 아니라 여기인 이유: switchMainCharacter 가 주 캐릭터와
       자리추가 좌석의 isMe 를 서로 맞바꾼다. 생성 때 한 번만 얹으면 맞바꾼 뒤 엉뚱한 좌석이
       맨 앞에 남는다. (classList.toggle 은 값이 같으면 아무 것도 안 바꾸므로 매 프레임 안전하다 —
       JS 로 style.zIndex 를 직접 쓰는 것과 다르다.) */
  el.classList.toggle('mine', !!seat.isMe);
  /* 💭 생각 말풍선 모양 — 상태 말풍선일 때만. 회사원 모드는 배경도 꼬리도 없으므로 제외한다.
     ⚠️ 위 .office/.mine 토글과 **같은 이유로** 여기(=아래 _lastBubble 비교보다 앞)여야 한다.
       뒤에 두면 글자가 같을 때 조기 return 에 걸려, 채팅 5초가 끝나고 같은 문구의 상태로 돌아올 때
       모양만 채팅 꼬리인 채로 남는다. */
  el.classList.toggle('think', !!think && !office);
  /* ⚠️ office 경로의 text 는 이 줄부터 **이스케이프된 HTML**이다. 아래 dismiss·중복 판정이
     이 문자열을 그대로 비교 키로 쓰므로, 닉네임이 바뀌어도 라벨이 같이 갱신된다. */
  /* 🔨 회사원 모드에는 그림이 안 들어간다(아래 _hasMarker 가 office 를 통째로 뺀다). 마커를
     그대로 흘리면 "홍길동: [bonk]" 처럼 대괄호가 글자로 찍히므로 글자로 되돌린다.
     ⚠️ _officeLabelHtml 보다 **먼저** 해야 한다 — 거기서 이스케이프되고 나면 늦다.
     ★ 다른 세 자리(커서·메뉴·말풍선)는 전부 뿅망치 **그림**인데 여기만 글자인 이유:
       회사원 모드는 말풍선에 그림을 안 넣는 게 규칙이라 그림을 쓸 수 없다. 뿅망치에 해당하는
       이모지도 없어서(🔨 는 공사용 망치라 다른 물건이다) 'Bonk!' 라고 적기로 했다.
       글자라 기기·이모지 폰트에 상관없이 어디서나 같게 보인다 — 이 점이 이모지보다 낫다. */
  if(office && text) text = String(text).split(tricksMod.BONK_BUBBLE_MARK).join('Bonk!');
  if(office && text) text = _officeLabelHtml(_seatLabelName(seat), text, !!seat.isMe);
  // ★ 예전엔 headAnchor(머리 본) 기준이라 캐릭터가 흔들리거나 고개를 움직이면 말풍선도 같이 흔들렸는데,
  //   레벨/이름표처럼 "그 자리에 고정"되길 원해서 seat.group(흔들림 없는 좌석 기준점) 기준으로 변경.
  const headY = seatLabelHeadY(seat);
  seat.group.getWorldPosition(_wpTmp3);
  // 캐릭터 상단 반전: seat._invertLabels(setSeatNamePlate가 갱신)를 참조 — 초기값 false라 첫 프레임도 안전.
  const invert = !!seat._invertLabels;
  if(invert){
    /* 반전 배치 (발 밑 쪽) — 발 원점을 그대로 기준으로 쓰고, 실제 자리는 아래에서 '픽셀'로 정한다.
       예전엔 이름표(-0.2)·공지(-0.5)·말풍선(-0.4~-0.65)을 각각 월드 오프셋으로 따로 찍었다.
       그 값들은 위 요소의 실제 높이와 아무 관계가 없어서 사이에 빈 공간이 남았고, 특히 이름표를
       끄면 발밑이 통째로 벌어졌다(요청: 여백을 반으로).
       → 이제 '바로 위 요소의 아래변에서 BUBBLE_INV_GAP_PX 만큼'만 띄운다. 이름표를 켜든 끄든,
         공지가 있든 없든 여백이 항상 같고 요소가 겹칠 수도 없다. */
  } else {
    // 정상 배치 (머리 위)
    // ★ 이름표가 headY+0.55라서 예전 값(0.55)은 말풍선이 이름표(레벨·이름)와 정확히 겹치던 원인.
    //   공지 배너가 없을 땐 배너 자리(0.7)로 한 칸 올려 이름표 위에 뜨게 함.
    const BUBBLE_Y_WITH_NAMEPLATE = 0.4;    // 라벨군 전체 하강 (0.7→0.4)
    const BUBBLE_Y_NO_NAMEPLATE   = 0.2;
    // 런처5: 확성기 공지(headY+0.7)가 표시 중이면 말풍선을 그 위로(0.7+0.2=0.9 — 수정 전과 동일한 높이 유지).
    //   ★ 배너를 내 좌석에만 그리므로 여기도 좌석별로 판정한다(전역 _activeAnnounceText를 그대로 쓰면
    //     배너가 없는 남의 말풍선까지 빈 자리만큼 떠오른다).
    const ANNOUNCE_EXTRA = _seatShowsAnnounce(seat) ? 0.2 : 0;
    /* 🐾 [검토 후 유지] 올라탄 캐릭터를 피해 옆으로 비키거나 탑 맨 위로 올리는 안을 둘 다 시도했지만,
       말풍선이 캐릭터에서 멀어지면 '누가 말했는지'가 흐려져서 되돌렸다. 가리더라도 말하는 캐릭터
       머리 바로 위가 낫다는 판단. 다시 손대려면 그 트레이드오프를 먼저 확인할 것. */
    _wpTmp3.y += headY + (nameplateEnabled ? BUBBLE_Y_WITH_NAMEPLATE : BUBBLE_Y_NO_NAMEPLATE) + ANNOUNCE_EXTRA;
  }
  const p=projectWorldToScreenPx(_wpTmp3);
  let _bubTop = p.y;
  if(invert){
    /* 발 밑에 이름표 → 공지 → 경험치 바 → 말풍선 순으로 '붙여' 쌓는다.
       ★ 위치는 **실제 화면 사각형**(getBoundingClientRect)으로 잰다.
         예전엔 style.top 을 파싱하고 .inverted 클래스가 붙었는지까지 확인했는데, 그 방식은
         조용히 빗나갈 구멍이 많다 — CSS transform 이 바뀌거나(요소마다 다르다), 클래스가 아직
         안 붙었거나, top 이 다른 코드에서 다른 단위로 들어가면 그대로 -Infinity 가 되어
         "비켜야 할 게 없다"고 판단해버린다. 화면 사각형은 그 전부를 이미 반영한 결과값이다.
       ⚠️ **한쪽만** 상대를 피해야 한다. 바(updateSeatExpBar)는 이름표·공지까지만 피하고,
         말풍선이 마지막으로 전부를 피한다. 서로 피하게 만들면 매 프레임 서로를 밀어내며
         라벨이 화면 아래로 계속 흘러내린다.
       ※ 이 함수는 프레임 루프에서 이름표·바보다 **나중에** 돈다(그 호출부 주석 참고). 그래야
         여기서 읽는 사각형이 이번 프레임 값이다. */
    /* 바 · 이름표 · 공지는 이번 프레임에 이미 자리를 적으며 아래변(_bottom)을 남겼다 — 다시 재면 강제 레이아웃 */
    const _bottomOf = e => {
      if(!e || e.style.display === 'none' || e._bottom == null) return -Infinity;
      return e._bottom;
    };
    const _labelBottom = Math.max(_bottomOf(seat.namePlateEl), _bottomOf(seat.announceEl),
                                  _bottomOf(seat.expBarEl));
    _bubTop = Math.max(p.y + BUBBLE_INV_GAP_FEET_PX,
                       isFinite(_labelBottom) ? (_labelBottom + BUBBLE_INV_GAP_LABEL_PX) : -Infinity);
  }
  /* ↔️ 좌우 위치 — 0 이면 좌석 원점(캐릭터 한가운데)에 정확히 맞는다.
     [경위] 한때 +2px 이 박혀 있었다. 그만큼 오른쪽으로 치우쳐 있었고, 머리 위에 있을 때는
       꼬리가 캐릭터 정수리를 안 가리켜서 눈에 띄었다(제보). 발밑에서는 꼬리를 안 그리므로 티가 안 났다.
     ★ 다시 미세 조정이 필요하면 **이 상수 하나만** 만질 것. 호출부에 숫자를 더하지 말 것 —
       그렇게 박아 두면 어디서 밀렸는지 찾는 데 이번처럼 시간이 든다. */
  /* 📐 정수 반올림 — 위 _bubSnapTransform 주석의 ① 좌표 쪽 반픽셀을 여기서 없앤다.
     ⚠️ 반올림은 최대 0.5px 이동이라 눈으로는 구분되지 않는다. 꼬리(::after)도 같은 요소를
       기준으로 그려지므로 함께 움직여서 어긋나지 않는다. */
  /* 📐 디바이스 픽셀 격자 반올림 — 위 _bubSnapTransform 주석의 첫 문단 참고.
     ⚠️ `Math.round(v)` 로 되돌리지 말 것. 배율 150% 에서 정수 CSS 좌표는 실제 .5px 이다. */
  {
    const _d = window.devicePixelRatio || 1;
    const _s = v => Math.round(v * _d) / _d;
    el.style.left = _s(p.x + BUBBLE_X_NUDGE_PX) + 'px';
    el.style.top  = _s(_bubTop) + 'px';
  }
  el.classList.toggle('inverted', invert);   // 말풍선 꼬리 방향 뒤집기 (CSS ::after/::before)
  /* ⚠️ 반드시 클래스 토글 **뒤에** 부른다 — 헬퍼가 el.className 으로 재측정 여부를 가른다. */
  _bubSnapTransform(el, invert);
  if(document.body.classList.contains('config')){ el.style.display='none'; return; }

  // 같은 텍스트가 dismiss된 상태면 다시 안 띄움(사용자가 닫은 걸 존중). 텍스트가 바뀌면(=상태 변경) dismiss 해제하고 새로 표시.
  // ★ 리셋 센티널은 undefined 사용 — null은 "온라인(상태 없음)" 텍스트 값으로 실제 쓰이기 때문에 null을 센티널로 쓰면
  //   상태→온라인 전환 시 "dismissedFor(null) === text(null)"가 참이 되어 잘못 조기 return, 말풍선이 안 사라지는 버그가 있었음.
  if(seat._bubbleDismissedFor !== undefined && seat._bubbleDismissedFor === text){ return; }
  if(seat._lastBubble===text) return;
  seat._lastBubble=text;
  seat._bubbleDismissedFor = undefined;
  if(!text){ el.style.display='none'; return; }
  // ★ 주사위 마커 [dice:N]이면 SVG로 렌더(1=빨간점). 그 외엔 기존대로 순수 텍스트(안전).
  // 주사위 마커로만 이뤄진 텍스트([dice:N] 1개 이상)면 전부 SVG로 렌더(1=빨간점). 그 외엔 순수 텍스트(안전).
  // ★ 마커 렌더 확장 — [dice:N]=SVG, [demoji:id]=번들 이미지(아는 id만 — 임의 URL 로드 없음).
  //   마커가 하나라도 있으면: 텍스트 이스케이프 → 마커만 치환 → innerHTML. 그 외엔 기존대로 순수 텍스트(안전).
  /* 🏢 회사원 모드에선 마커(주사위·이모티콘)를 그리지 않는다 — 30px 이미지가 들어오면
     '작은 한 줄 라벨'이라는 목적 자체가 깨진다. 글자로만 남긴다. */
  const _hasMarker = !office && /\[(?:dice:[1-6]|demoji:d\d{2}|bonk)\]/.test(text);
  // ⚠️ 반드시 안쪽 .bub-txt 에 쓴다. el 에 직접 쓰면 그 요소가 지워져 클램프가 사라지고,
  //   textContent 대입은 자식(.bub-txt)까지 통째로 날린다.
  const _tx = el.querySelector('.bub-txt') || el;
  /* 🏢 회사원 모드 — _officeLabelHtml 이 이미 이스케이프해 만든 HTML 이다(닉네임 span 때문).
     ⚠️ 이 갈래를 지우고 아래 textContent 로 흘려보내면 <span> 이 글자로 찍힌다.
     😊 이모티콘 마커는 **여기서** 그림으로 바꾼다 — 위 _lastBubble 비교는 마커 문자열 그대로
       하게 두어야 한다. 비교 키까지 그림 HTML 로 바꾸면 같은 이모티콘을 다시 보낼 때
       문자열이 매번 같아도 이미지 태그 안의 크기 계산이 끼어들어 판정이 흔들린다. */
  if(office){ _tx.innerHTML = _officeDemojiHtml(text); }
  else if(_hasMarker){
    let bh=_chatEsc(text);
    bh=bh.replace(/\[dice:([1-6])\]/g, (m,n)=> _diceSvg(parseInt(n,10), 30));
    /* 🪄 때리기 — demoji 표(30px 상한)를 타지 않는 전용 마커다. 근거는 BONK_BUBBLE_IMG 주석 참고.
       ★ class 는 .bubble-demoji 를 그대로 쓴다 — 세로 정렬·좌우 여백 규칙이 이미 거기 있고,
         새 클래스를 만들면 HTML 쪽 CSS 를 같이 고쳐야 한다(고칠 이유가 없다).
       ⚠️ 채팅에 '[bonk]' 를 그대로 쳐도 그림이 나온다 — [dice:3]·[demoji:d01] 이 예전부터
         그랬던 것과 같다. 여기만 막으면 마커 규칙이 갈린다. */
    bh=bh.replace(/\[bonk\]/g, ()=>
      `<img class="bubble-demoji" src="${tricksMod.BONK_BUBBLE_IMG}" alt="때리기" `
      + `style="width:${tricksMod.BONK_BUBBLE_PX}px;height:${tricksMod.BONK_BUBBLE_PX}px;">`);
    bh=bh.replace(/\[demoji:(d\d{2})\]/g, (m,id)=>{
      const d=(typeof chatUiMod.DEMOJI_BY_ID!=='undefined') ? chatUiMod.DEMOJI_BY_ID[id] : null; if(!d) return m;
      const cap=(d.id==='d25')?60:30;   // 말풍선은 30px(춤만 60px) — 오버레이 부담 최소화
      const sc=cap/Math.max(d.w,d.h), bw=Math.max(1,Math.round(d.w*sc)), bhh=Math.max(1,Math.round(d.h*sc));
      return `<img class="bubble-demoji" src="${chatUiMod.DEMOJI_DIR}${d.file}" alt="${_chatEsc(d.cmd)}" style="width:${bw}px;height:${bhh}px;">`;
    });
    _tx.innerHTML = bh;
  } else { _tx.textContent=text; }
  /* 📐 글이 바뀌었으니 다음 프레임에 폭·높이를 다시 잰다(_bubSnapTransform 주석).
     ⚠️ 그림은 **늦게** 로드된다. innerHTML 직후에 잰 폭은 이미지 자리가 비어 있는 값이라,
       로드가 끝나는 순간 한 번 더 재야 한다. 안 그러면 이모티콘 말풍선만 반 칸 밀린 채 남는다. */
  el._bxfDirty = true;
  try{
    _tx.querySelectorAll('img').forEach(im=>{
      if(im.complete) return;
      im.addEventListener('load',  ()=>{ el._bxfDirty = true; }, { once:true });
      im.addEventListener('error', ()=>{ el._bxfDirty = true; }, { once:true });
    });
  }catch(_){}
  el.style.display='block';
  /* 📐 **여기서 한 번 더 스냅한다.** 위쪽 자리잡기는 이 요소가 아직 display:none 이던 시점에
     돌았고, 그때 offsetWidth 는 0 이라 잴 수가 없었다. 그냥 두면 보이기 시작한 첫 프레임만
     왼쪽 위로 밀린 채 찍혔다가 다음 프레임에 제자리로 튄다. */
  _bubSnapTransform(el, invert);
}
/* 말풍선을 클릭 등으로 즉시 숨김 — 같은 상태가 유지되는 동안은 다시 안 뜨고, 상태가 바뀌면(setSeatHeadBubble의 text 변경) 재표시됨 */
function dismissSeatHeadBubble(seat){
  if(!seat.bubbleEl || seat.bubbleEl.style.display==='none') return;
  seat.bubbleEl.style.display='none';
  seat._bubbleDismissedFor = seat._lastBubble;
}

/* 좌석이 제거될 때(친구 퇴장, 좌석 전체 리셋 등) 이름표/말풍선 DOM 요소도 같이 정리 — 안 하면 고아 DOM이 계속 쌓임 */
function removeSeatLabels(seat){
  if(seat.namePlateEl){ seat.namePlateEl.remove(); seat.namePlateEl=null; }
  if(seat.bubbleEl){ seat.bubbleEl.remove(); seat.bubbleEl=null; }
  if(seat.announceEl){ seat.announceEl.remove(); seat.announceEl=null; }   // 런처5
  // ⭐ 경험치 바도 같은 레이어에 지연 생성되므로 여기서 함께 정리한다.
  //   빠뜨리면 사람이 드나들 때마다 .seat-exp 가 화면 밖에 계속 쌓인다.
  if(seat.expBarEl){ seat.expBarEl.remove(); seat.expBarEl=null; seat.expFillEl=null; }
}

return {
  setSeatMenu,
  setLabelDrag,
  bindLabelDrag,
  NAMEPLATE_BELOW_EXPBAR,
  beginLabelFrame: labelMeasure.beginFrame,
  labelSize: labelMeasure.size,
  nameplateHeight,
  _officeDemojiHtml,
  _seatLabelName,
  applyChipOrientation,
  chipHorizontal: ()=>chipHorizontal,   // 읽는 함수
  setChipHorizontal: (v)=>{ chipHorizontal = v; },   // 쓰는 함수 — app.js 가 비운다
  dismissSeatHeadBubble,
  ensureSeatLabelsLayer,
  nameplateEnabled: ()=>nameplateEnabled,   // 읽는 함수
  setNameplateEnabled: (v)=>{ nameplateEnabled = v; },   // 쓰는 함수 — app.js 가 비운다
  projectWorldToScreenPx,
  removeSeatLabels,
  setSeatHeadBubble,
  setSeatNamePlate,
};
}

const api = { createOverhead };
if(typeof window !== 'undefined') window.TwOverhead = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
