/* seat-opacity.js — 👻 캐릭터 투명도(자리비움 영혼 효과)(앱 FSD · app.js 분리 M10)
   app.js 캐릭터 투명도 구역의 setSeatOpacity 를 글 그대로 옮긴 모듈이다. 동작은 옮기기 전과 같다.
   ・책임: 좌석 몸(bodyWrap) 아래 모든 mesh 의 material 투명도 · mesh.visible 토글(자리비움 op≈0 이면 끄고 원래 값을 userData._prevVisible 에 기억) · 파츠 원본 투명도(_baseOpacity · _baseTransparent) 기억.
   ・받는 deps 0 — 좌석 객체만 읽고 쓴다.
   ・내놓는 것: setSeatOpacity(seat, op) — app.js 는 같은 이름 const 로 받는다(frame 이 매 프레임 부른다).
   ⚠️ 원본 투명도는 «불투명할 때(op≥0.999)·건드리기 전» 에만 잰다(_opTouched) — 안 그러면 자리비움 중 처음 만난 머티리얼의 0 이 원본이 돼 머리가 영영 안 보인다. 아래 주석 참고.
   ⚠️ seat._bodyOff 는 hidden-seats.js 가 읽는다(몸을 껐다는 표시 — 투명도 기준은 여기 한 곳).
   검사: checks/sim-seat-opacity-mod.js */
(function(){

function createSeatOpacity(deps){
/* 캐릭터 opacity (자리비움 영혼 효과) — bodyWrap 하위 모든 mesh의 material에 적용 */
function setSeatOpacity(seat, op){
  if(seat._lastOp===op) return;
  seat._lastOp=op;
  // 자리비움(op≈0)에선 material.opacity만 낮춰선 완전히 사라지지 않으므로 mesh.visible 자체를 함께 토글한다.
  // ★ 단, applyClothVisibility가 관리하는 mesh.visible(파츠 hides에 의한 숨김)을 덮어쓰지 않도록:
  //   자리비움 진입 시 원래 visible 값을 userData._prevVisible에 기억해두고,
  //   자리비움 해제 시 그 값으로 복원. 정상 상태(op≥0.001)에선 visible을 건드리지 않음.
  const hide = op < 0.001;
  seat._bodyOff = hide;   // 몸 메쉬를 껐다는 표시 — 동작 계산 건너뛰기(hidden-seats.js _bodyHidden)가 이것만 읽는다(기준을 두 번 쓰지 않게)
  seat.bodyWrap.traverse(o=>{
    if(o.isMesh && o.material){
      if(hide){
        // 자리비움 진입 — 원래 visible 상태 저장 후 숨김
        if(o.userData._prevVisible === undefined) o.userData._prevVisible = o.visible;
        o.visible = false;
      } else if(o.userData._prevVisible !== undefined){
        // 자리비움 해제 — 저장된 원래 visible 복원 (hides로 숨긴 상태였다면 그대로 숨김 유지)
        o.visible = o.userData._prevVisible;
        delete o.userData._prevVisible;
      }
      // 정상 상태에선 mesh.visible 안 건드림 → applyClothVisibility의 세팅 유지
      const mats=Array.isArray(o.material)?o.material:[o.material];
      mats.forEach(m=>{
        if(!m) return;
        // ★ 파츠가 블렌더에서 설정해온 원본 투명도(transparent/opacity)를 최초 1회 기억해둔다.
        //   예전엔 여기서 무조건 transparent=false, opacity=1로 덮어써서 반투명 파츠가 실행화면에서만
        //   불투명하게 보였음(꾸미기 미리보기는 이 함수를 안 거쳐서 정상이었던 원인).
        /* ★★ 그 기억은 **불투명할 때만**(op≥0.999) 잰다.
           [증상] 작업하다 어느 순간 머리(얼굴 메시)가 통째로 안 보이고, 앱을 껐다 켜야 돌아온다.
           [원인] 예전엔 "처음 보는 머티리얼이면 무조건" 그 자리의 opacity를 원본으로 적었다.
             자리비움은 opacity 0.0 이므로(STATUS 표의 away), 숨어 있는 동안 그 좌석이 다시 빌드되거나
             파츠가 새로 붙어서 그 머티리얼이 이 함수를 **처음** 통과하면, 이미 0이 된 값을 원본으로
             기억한다. 그때부터 baseOp=0 이라 자리비움이 풀려 op=1 이 와도 0 × 1 = 0 — 영영 안 보인다.
             (자동 자리비움은 20분 무반응이면 스스로 걸린다 → "자리를 비웠다 돌아오니 머리만 없다".)
           [왜 껐다 켜면 돌아오나] 이 기억은 머티리얼 메모리(userData)에만 있고 저장되지 않는다.
             즉 저장 데이터는 멀쩡하다 — 표정 텍스처가 지워진 게 아니다.
           ⚠️ _baseTransparent 를 **반드시 같은 조건에 묶어 둘 것.** 따로 재면 투명도만 돌아오고
             transparent 플래그가 켜진 채 남아 depthWrite/정렬이 어긋난다. */
        /* ⚠️ _opTouched 가 왜 필요한가 — op≥0.999 조건만 걸면 구멍이 그대로 남는다.
             숨은 동안 처음 만난 머티리얼은 여기서 못 재고 아래에서 opacity=0 이 **찍힌다.**
             그 뒤 자리비움이 풀려 op=1 로 이 함수가 다시 오면, 조건이 통과되면서
             **우리가 방금 쓴 0** 을 원본이라고 기억한다 — 고치기 전과 똑같이 굳는다.
             그래서 "이 함수가 한 번이라도 쓴 머티리얼"에는 표식을 남기고, 표식이 있으면
             다시는 재지 않는다. 원본을 잴 수 있는 시점은 **건드리기 전, 불투명할 때** 뿐이다. */
        if(m.userData._baseOpacity === undefined && !m.userData._opTouched && op >= 0.999){
          m.userData._baseOpacity     = (typeof m.opacity==='number') ? m.opacity : 1;
          m.userData._baseTransparent = !!m.transparent;
        }
        m.userData._opTouched = true;   // 아래에서 opacity/transparent 를 쓴다 — 이후 이 값은 원본이 아니다
        // 끝내 못 잰 머티리얼(숨은 동안 처음 붙은 파츠 등)은 1/불투명으로 본다.
        //   블렌더에서 반투명으로 만든 파츠라면 그 반투명이 한 번 무시되지만, 0 으로 굳어
        //   영영 안 보이는 쪽보다 이 방향이 훨씬 안전하다.
        const baseOp = (typeof m.userData._baseOpacity === 'number') ? m.userData._baseOpacity : 1;
        const baseTr = (m.userData._baseTransparent !== undefined) ? !!m.userData._baseTransparent : false;
        const eff    = baseOp * op;              // 자리비움 등 상태 투명도 × 파츠 원본 투명도
        m.transparent = baseTr || (op < 0.999);
        m.opacity     = eff;
        m.depthWrite  = (eff > 0.95);   // 반투명 시 z-fighting 줄이기
        m.needsUpdate = true;
      });
    }
  });
}

return { setSeatOpacity };
}

const api = { createSeatOpacity };
if(typeof window !== 'undefined') window.TwSeatOpacity = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
