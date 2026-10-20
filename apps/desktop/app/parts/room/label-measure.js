/* label-measure.js — 📐 좌석 라벨(경험치 바 · 이름표 · 공지 · 말풍선)이 매 프레임 쓰는 «잰 값» 기억
   왜: 라벨 자리를 적은(style 쓰기) 바로 뒤에 크기 · 사각형을 읽으면 브라우저가 그 자리에서 배치를 처음부터 다시 계산한다
     (강제 레이아웃). 좌석마다 몇 번씩 · 초당 최대 60번이라 사람이 많은 방일수록 무거워진다.
   그래서 캔버스 사각형은 프레임마다 한 번만(beginFrame 뒤 첫 부름), 라벨 크기는 열쇠(글 · 클래스)가 바뀌었거나 REFRESH_MS 가 지났을 때만 잰다.
   ⚠️ 숨은(display:none) 요소는 재지 않는다 — 0 을 기억하면 다시 보일 때 자리가 한 프레임 튄다. 마지막으로 잰 값을 돌려준다.
   ⚠️ 순수 모듈 — DOM · 전역을 직접 부르지 않는다(읽기는 deps 로). 검사: checks/sim-label-measure.js */
(function(){

/* 열쇠에 안 잡히는 변화(이름표 글자 크기 슬라이더 · 늦게 온 글꼴)도 이만큼 뒤엔 따라간다 */
const REFRESH_MS = 500;

/**
 * @param {{ readCanvasRect: () => {left:number, top:number, width:number, height:number}, now: () => number }} deps
 */
function createLabelMeasure(deps){
  const readCanvasRect = deps.readCanvasRect;
  const now = deps.now;
  let canvasRect = null;

  /* 프레임 맨 앞에서 부른다 — 이번 프레임의 첫 canvasRect() 가 새로 잰다 */
  function beginFrame(){ canvasRect = null; }
  function canvas(){
    if(!canvasRect) canvasRect = readCanvasRect();
    return canvasRect;
  }
  /* 요소의 { w, h } — 못 잰 적이 없으면 null */
  function size(el, key){
    if(!el) return null;
    const last = el._lm || null;
    if(el.style.display === 'none') return last;
    const t = now();
    if(last && last.key === key && t - last.at < REFRESH_MS) return last;
    const w = el.offsetWidth, h = el.offsetHeight;
    if(!(w > 0 || h > 0)) return last;   // 부모가 숨어 아직 안 그려짐 — 다음 프레임에 다시
    el._lm = { w, h, key, at: t };
    return el._lm;
  }
  return { beginFrame, canvasRect: canvas, size };
}

const api = { createLabelMeasure, REFRESH_MS };
if(typeof window !== 'undefined') window.TwLabelMeasure = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
