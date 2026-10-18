/* exp-bar.js — ⭐ 경험치 바 — 캐릭터 발밑 레벨 진행도 게이지
   app.js «⭐ 경험치 바 — 캐릭터 발밑 레벨 진행도 게이지» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 45번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 1줄 —
     _focusTotalSec 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 3개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: EXP_CELLS · EXP_SEC_PER_CELL · EXP_SEC_PER_LEVEL · myExpCells · updateSeatExpBar — app.js 는 expBarMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwExpBar — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-exp-bar.js */
(function(){

function createExpBar(deps){
const _focusTotalSec = deps._focusTotalSec;   // 읽는 함수
const _starPaint = deps._starPaint;
const lvBarClass = deps.lvBarClass;
const lvStarBarClass = deps.lvStarBarClass;
const overheadMod = deps.overheadMod;
const bindLabelDrag = deps.bindLabelDrag;   // 이름표 끌기(app.js 가 room/overhead.js 를 잇는다)
const EXP_SEC_PER_LEVEL = 3600;                                   // getFocusLevel()의 1레벨과 반드시 같아야 함
const EXP_SEC_PER_CELL  = 300;                                    // 5분
const EXP_CELLS         = EXP_SEC_PER_LEVEL / EXP_SEC_PER_CELL;   // 12
const EXP_BAR_H         = 6;    // 안쪽 채움 높이(px) — CSS의 --exp-bar-h와 같은 값
const EXP_BAR_CHROME    = 4;    // 테두리1 + 안쪽여백1 × 상하
/* ★ 바 높이 조절은 이 값 하나. 캐릭터 발밑 기준 아래로 몇 px 띄울지다.
   줄이면 위로 올라오고, 음수를 주면 발밑선보다 위(발에 겹치게)로 올라간다.
   가로 배치 상태칩은 바의 '실제 렌더된 위치'를 읽어 그 아래에 붙으므로 여기만 고치면 같이 따라온다. */
const EXP_BAR_GAP       = 2;    // 캐릭터 발밑 ↔ 바 간격(px)
/* 바 길이(px) — **모든 캐릭터 공통.** 예전엔 캐릭터 실측 폭을 따라가서(40~220) 덩치 · 동물 · 커미션 · 평준화에
   따라 누구는 길고 누구는 짧아 보였다(제보). 길이는 레벨 진행도를 읽는 자이므로 같아야 비교가 된다. */
const EXP_BAR_W         = 72;

/* 레벨 → 색 구간 + 표식 클래스. 배지(.mh-flv)와 **같은 표**를 읽는다(lvBarClass).
   ⚠️ 여기에 경계값을 다시 적지 말 것 — 어긋나면 같은 레벨인데 배지와 바 색이 달라진다. */
function expTierClass(lv){ return lvBarClass(lv); }
/* 누적초 → 채운 칸 수(0~12) — 이번 시간(= 이번 레벨) 안에서 몇 칸인가. */
function expCellsFromSec(sec){
  /* 🌟 [개정 70] 999시간에서 «가득 찬 채 멈추던» 분기를 풀었다 — 999시간을 채우면 회차가 되고 바는 이번 바퀴의
     진행도를 보인다. 한 시간 = 한 레벨이라 바퀴가 바뀌어도 «시간 안의 몇 칸» 계산은 같다. */
  const total  = Math.max(0, sec||0);
  return Math.min(EXP_CELLS, Math.floor((total % EXP_SEC_PER_LEVEL) / EXP_SEC_PER_CELL));
}
/* 내 현재 칸 수 — 프리즌스로 내보낼 값이자 내 좌석에 그릴 값. */
function myExpCells(){ return expCellsFromSec(_focusTotalSec()); }

function ensureSeatExpBarEl(seat){
  if(seat.expBarEl) return seat.expBarEl;
  const layer = overheadMod.ensureSeatLabelsLayer(); if(!layer) return null;
  const el = document.createElement('div'); el.className = 'seat-exp';
  const fill = document.createElement('div'); fill.className = 'exp-fill';
  el.appendChild(fill);
  bindLabelDrag(el, seat);   // 🏷️ 눌러 끌면 자리 바꾸기 — 이름표와 같은 길(room/seat-label-drag.js)
  layer.appendChild(el);
  seat.expBarEl = el; seat.expFillEl = fill;
  return el;
}

const _expTmpA = new THREE.Vector3();
/* 좌석의 경험치 바를 발밑에 배치하고 채운다. 바의 '아래쪽' 화면 y를 돌려준다(안 보이면 null).
   가로 배치 상태칩이 이 값을 받아 바보다 아래에 놓인다. */
function updateSeatExpBar(seat, level, cells, star){
  if(!seat || !seat.group) return null;
  /* 숨기는 조건
     · 이름표를 끄면 같이 숨긴다 — 하나만 남으면 어중간하다(요청사항).
     · cells==null — 구버전 상대라 진행도를 모른다. 0%로 그리면 "방금 레벨업"으로 오해된다.
     · ★ 남의 머리에 올라타 있으면 숨긴다(seat.ridingOn). 동물이 사람 머리에 얹히면 바가
       상대 얼굴 한복판에 뜬다. 발밑 기준으로 배치하는데 그 '발밑'이 남의 머리 위라서 그렇다.
       탑쌓기로 여러 층이 돼도 2층부터 전부 해당된다. */
  if(!overheadMod.nameplateEnabled() || document.body.classList.contains('config') || cells == null || (seat.ridingOn)){
    if(seat.expBarEl) seat.expBarEl.style.display = 'none';
    return null;
  }
  const el = ensureSeatExpBarEl(seat); if(!el) return null;
  seat.group.getWorldPosition(_expTmpA);
  const pFeet = overheadMod.projectWorldToScreenPx(_expTmpA);
  const w = EXP_BAR_W;   // 모두 같은 길이(EXP_BAR_W 주석)
  let top = pFeet.y + EXP_BAR_GAP;
  // 캐릭터가 화면 위쪽에 붙으면 이름표가 발밑으로 반전 배치된다(seat._invertLabels) — 그 아래로 비켜준다.
  //   ★ 공지 배너도 반전이면 이름표 바로 아래에 온다. 이름표만 피하면 배너와 겹친다.
  //   ⚠️ 말풍선은 여기서 보지 않는다 — 말풍선 쪽이 바를 피하도록 되어 있어서, 여기서 말풍선까지
  //     피하면 둘이 서로를 밀어내며 매 프레임 아래로 흘러내린다(setSeatHeadBubble 주석 참고).
  //   ⚠️ NAMEPLATE_BELOW_EXPBAR 가 켜지면 이 회피를 **꺼야 한다** — 이름표 쪽이 바를 피하므로,
  //     여기서 또 피하면 둘이 서로를 밀어내며 매 프레임 아래로 흘러내린다.
  if(seat._invertLabels && !overheadMod.NAMEPLATE_BELOW_EXPBAR){
    [seat.namePlateEl, seat.announceEl].forEach(e=>{
      if(!e || e.style.display === 'none') return;
      const r = e.getBoundingClientRect();
      if(r.height) top = Math.max(top, r.bottom + 4);
    });
  }
  const barH = EXP_BAR_H + EXP_BAR_CHROME;
  /* 화면 아래에 두면 바 **밑에 붙는 이름표**까지 화면 안에 들어와야 한다. 예전엔 바만 화면 안으로 눌러서,
     발밑 높이가 사람마다(키 · 화면 앵글) 조금씩 다른 만큼 어떤 사람은 이름이 잘렸다(제보).
     이름표 높이는 기억해 둔 값(overheadMod.nameplateHeight)을 쓴다 — 매 프레임 재면 강제 레이아웃이 난다. */
  let below = 0;
  if(overheadMod.NAMEPLATE_BELOW_EXPBAR && seat.namePlateEl && seat.namePlateEl.style.display !== 'none'){
    const h = overheadMod.nameplateHeight(seat);
    below = h ? h + 4 : 0;   // 4 = setSeatNamePlate 가 바 아래에 두는 간격
  }
  top = Math.max(2, Math.min(innerHeight - barH - below - 2, Math.round(top)));
  el.style.left  = Math.round(pFeet.x) + 'px';
  el.style.top   = top + 'px';
  el.style.width = w + 'px';
  el.style.display = 'block';
  /* 이름표 · 말풍선이 사각형을 다시 재지 않고 읽는 아래변 — 높이는 기억해 둔 실측(CSS 가 바뀌어도 따라간다), 못 쟀으면 barH */
  { const bs = overheadMod.labelSize(el, el.className); el._bottom = top + ((bs && bs.h) || barH); }
  /* 티어 + 표식 클래스(lvx·lvglow)를 한 문자열로 받아 통째로 갈아끼운다.
     ⚠️ className 통째 대입이라 여기서 안 만든 클래스는 지워진다. 회차 색 바(.starbar)를
       붙일 때는 이 문자열에 같이 실을 것 — 밖에서 classList.add 로 얹으면 다음 프레임에 날아간다. */
  /* 🌟 회차면 티어 자리에 lv-star — 이 한 문자열에 같이 싣는다(통째 대입 · 개정 70). 색이 바뀌어도 다시 칠하게 열쇠에 넣는다. */
  const tier = star ? lvStarBarClass() : expTierClass(level);
  const tkey = star ? (tier + '|' + star.color) : tier;
  if(el._tier !== tkey){
    el._tier = tkey;
    el.className = 'seat-exp ' + tier;
    _starPaint(el, star);
  }
  const n = Math.max(0, Math.min(EXP_CELLS, cells|0));
  if(el._cells !== n){
    el._cells = n;
    seat.expFillEl.style.width = (n / EXP_CELLS * 100) + '%';
  }
  return top + barH;
}

return {
  EXP_CELLS,
  EXP_SEC_PER_CELL,
  EXP_SEC_PER_LEVEL,
  myExpCells,
  updateSeatExpBar,
};
}

const api = { createExpBar };
if(typeof window !== 'undefined') window.TwExpBar = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
