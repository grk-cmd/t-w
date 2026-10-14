/* ═══ 💡 표정 그리기 «원색 보기» — 생성기 미리보기 조명을 잠깐 끄고 칠한 색 그대로 ═══════════════════
   [문제] 생성기 조명은 따뜻한 빛(LIGHT_PRESET.h)이고 정면 총합이 1 을 조금 넘는다(TONE_FRONT_TOTAL).
     그래서 밝은 피부에 흰색을 칠하면 둘 다 크림색으로 날아가 칠했는지 알기 어렵다.
   [해법] 켜면 방향광(키 · 필)을 끄고 앰비언트를 흰빛으로 바꿔, 앰비언트 + emissive(FLAT_EMISSIVE) 합이
     정확히 1 이 되게 한다. r128 의 앰비언트는 «색 × 세기» 그대로라 텍스처 값이 화면에 그대로 나온다.
   ★ 보는 방법만 바꾼다 — 그림 · 저장값 · 실행 화면 조명은 건드리지 않는다.
   ★ 그리기 단계(2 표정 · 3 감은눈)에서만 버튼이 보이고, 그 밖으로 나가면 저절로 꺼진다.
   DOM 은 deps 로 받는다(검사에서 가짜 요소로 돈다 — sim-creator-flat-view.js). */
(function(){
'use strict';

/* 원색 보기일 때 앰비언트 세기. emissive 가 이미 FLAT_EMISSIVE 몫을 얹으므로 남는 만큼만. */
function flatAmbient(flatEmissive){
  const f = +flatEmissive;
  return Math.max(0, 1 - (isFinite(f) ? f : 0));
}

function createCreatorFlatView(deps){
  const btn = deps.btn, badge = deps.badge, onChange = deps.onChange || function(){};
  let on = false;

  function paint(){
    if(btn){
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.title = on ? '원래 조명으로 (L)' : '조명 끄고 원색 보기 (L)';
    }
    // 색만으로 상태를 말하지 않는다 — 켜져 있는 동안은 글로 «원색 보기» 를 띄운다
    if(badge) badge.style.display = on ? 'block' : 'none';
  }
  function set(v){
    v = !!v;
    if(v === on) return;
    on = v; paint(); onChange(on);
  }
  /* 단계가 바뀔 때. 그리기 단계가 아니면 버튼을 숨기고 끈다(색상 · 책상 화면에 원색이 남지 않게). */
  function show(visible){
    if(btn) btn.style.display = visible ? '' : 'none';
    if(!visible) set(false);
  }
  paint();
  return { isOn: function(){ return on; }, set: set, toggle: function(){ set(!on); }, show: show };
}

const api = { flatAmbient: flatAmbient, createCreatorFlatView: createCreatorFlatView };
if(typeof window !== 'undefined') window.CreatorFlatView = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
