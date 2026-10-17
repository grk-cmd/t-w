/* floor-snap-diag.js — 🩺 바닥 맞춤 진단 — 콘솔에서 floorSnapReport() 한 줄로 실행 화면 · 꾸미기 미리보기의 발밑 깊이 · 파츠 wrapper 위치를 나란히
   책임: 진단 전용 — 아무것도 고치지 않고 화면도 안 건드린다. window.floorSnapReport 를 걸고 콘솔에만 적는다.
   받는 deps: measureUnderfootDepth(char-measure.js) · findMySeat · wardrobeMod(읽는 함수). 내보내는 것: floorSnapReport(window 에도).
   app.js «FIT» 구역의 진단 몫을 그대로 옮겼다(구역 떼기 C · w1). 동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 2줄 —
     wardrobeMod 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 1개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: 없음 — 만들 때 건다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwFloorSnapDiag — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-floor-snap-diag.js */
(function(){

function createFloorSnapDiag(deps){
const charMeasureMod = deps.charMeasureMod;
const findMySeat = deps.findMySeat;
const wardrobeMod = deps.wardrobeMod;   // 읽는 함수
const BELOW_FLOOR_EPS = 0.001;      // 월드 바닥(0)보다 이만큼 넘게 아래면 «바닥 아래» 로 적는다
const DEPTH_MISMATCH_EPS = 1e-4;    // 실행 화면 · 미리보기 깊이 차가 이보다 크면 경고
const PARENT_CHAIN_MAX = 6;         // 부모 사슬은 이만큼만 적는다
/* 🩺 바닥 맞춤 진단 — 콘솔에서 `floorSnapReport()` 한 줄로 미리보기와 실행 화면을 나란히 본다.
   [왜 필요한가] "파츠가 바닥에 가라앉아 있다"의 원인 후보가 셋이고, 겉보기로는 구분이 안 된다.
     ① 파츠가 측정에서 **제외**되고 있다(숨은 메쉬·리깅 표식) → depth 가 0 으로 나온다
     ② 측정은 맞는데 fitModel 이 **안 불렸다**(붙는 시점이 재계산보다 늦다) → 지금 재보면 0 이 아니다
     ③ 미리보기와 실행이 **다른 값**을 쓴다 → 두 쪽 depth·position 이 다르다
   이 보고서는 셋을 한 번에 가른다. 발밑으로 내려간 메쉬를 전부 나열하고, 제외된 것은 그 이유까지 적는다.
   ⚠️ 진단 전용이다 — 아무것도 고치지 않고 화면도 안 건드린다. */
function _floorSnapProbe(root){
  const out = { depth:null, meshes:[], counted:0, skipped:0 };
  if(!root) return out;
  const tmp = new THREE.Box3();
  try{ root.updateWorldMatrix(true,true); }catch(_){}
  try{
    root.traverse(o=>{
      if(!o.isMesh) return;
      let why = null;
      if(o.visible === false) why = '자기 자신이 숨김';
      else if(o.userData && o.userData._origBind) why = '리깅 파츠의 스킨드메시';
      else {
        let p = o;
        while(p && p !== root){
          if(p.visible === false){ why = '조상이 숨김(' + (p.name||'이름없음') + ')'; break; }
          if(p.userData && p.userData.rigged){ why = '리깅 파츠(' + (p.name||'이름없음') + ')'; break; }
          p = p.parent;
        }
      }
      let minY = null;
      try{ tmp.setFromObject(o); if(!tmp.isEmpty()) minY = tmp.min.y; }catch(_){}
      if(why) out.skipped++; else out.counted++;
      // 발밑으로 내려간 것만 보고한다 — 위쪽 메쉬까지 찍으면 목록이 길어져 읽을 수가 없다
      if(minY != null && minY < -BELOW_FLOOR_EPS){
        let wrap = null;
        for(let q = o; q && q !== root; q = q.parent){
          if(typeof q.name === 'string' && q.name.indexOf('__partWrap_') === 0){ wrap = q.name; break; }
        }
        out.meshes.push({ name:o.name || '(이름없음)', minY:+minY.toFixed(4), wrap:wrap || '(캐릭터 본체)', skip:why });
      }
    });
  }catch(_){}
  try{ out.depth = charMeasureMod.measureUnderfootDepth(root); }catch(_){}
  return out;
}
function floorSnapReport(){
  const f = v => (v == null ? 'null' : (+v).toFixed(4));
  /* 좌석마다 이름이 다르다 — 실제 좌석은 gltfRoot, 꾸미기 미리보기는 root 다(그 객체 리터럴 참고).
     앞 판(gltfRoot 만 보던 것)은 그래서 둘 다 '모델 없음' 으로 떨어졌다. */
  const modelOf = s => s ? (s.gltfRoot || s.modelRoot || s.root || null) : null;
  /* 파츠 wrapper 를 전부 찾아 **월드 최저점**을 적는다. 바닥은 월드 y=0 이므로 음수면 가라앉은 것이다.
     ★ 핵심은 '어디에 매달렸는가'다 — 모델(gltfRoot) 안이면 바닥 맞춤이 걸리고,
       책상 앵커(deskAnchor) 밑이면 모델 밖이라 애초에 측정 대상이 아니다. */
  function wraps(rootNode, model){
    const out = []; if(!rootNode) return out;
    const tmp = new THREE.Box3();
    try{ rootNode.updateWorldMatrix(true,true); }catch(_){}
    rootNode.traverse(o=>{
      if(typeof o.name !== 'string' || o.name.indexOf('__partWrap_') !== 0) return;
      let minY = null;
      try{ tmp.setFromObject(o); if(!tmp.isEmpty()) minY = tmp.min.y; }catch(_){}
      let inModel = false, chain = [];
      for(let q = o.parent; q; q = q.parent){
        chain.push(q.name || (q.type||'?'));
        if(model && q === model) inModel = true;
        if(chain.length >= PARENT_CHAIN_MAX) break;
      }
      out.push({ name:o.name, minY, inModel, rigged:!!(o.userData && o.userData.rigged), chain:chain.join(' < ') });
    });
    return out;
  }
  const rows = [];
  const push = (label, seat, extraRoots)=>{
    const model = modelOf(seat);
    if(!seat){ console.log('[바닥맞춤] ' + label + ' — 좌석 없음'); return; }
    let depth = null;
    try{ if(model) depth = charMeasureMod.measureUnderfootDepth(model); }catch(_){}
    console.log('[바닥맞춤] ' + label
      + ' | 모델노드=' + (model ? (model.name || model.type || 'Group') : '없음')
      + ' | depth=' + f(depth)
      + (model ? (' | 모델 position y=' + f(model.position.y) + ' z=' + f(model.position.z)
                  + ' scale=' + f(model.scale.x)) : '')
      + ' | userZ=' + f(seat.userZ) + ' userScale=' + f(seat.userScale)
      + ' bodyWrap.scale=' + (seat.bodyWrap ? f(seat.bodyWrap.scale.x) : '없음')
      + ' rig.z=' + (seat.rig ? f(seat.rig.position.z) : '없음'));
    const seen = [];
    [seat.group, model, seat.deskGroup, seat.deskAnchor].concat(extraRoots || []).forEach(r=>{
      if(!r || seen.indexOf(r) >= 0) return; seen.push(r);
      wraps(r, model).forEach(w=>{
        if(rows.indexOf(w.name + label) >= 0) return; rows.push(w.name + label);
        console.log('    ' + (w.minY != null && w.minY < -BELOW_FLOOR_EPS ? '⬇ 바닥아래' : '  바닥위 ')
          + ' 월드minY=' + f(w.minY)
          + '  ' + w.name
          + '  [' + (w.inModel ? '모델 안 → 바닥맞춤 대상' : '모델 밖 → 측정에서 빠짐') + ']'
          + (w.rigged ? ' (리깅 표식 있음 → 측정 제외)' : '')
          + '  부모사슬: ' + w.chain);
      });
    });
    return depth;
  };
  let dRun = null, dPrev = null;
  try{ dRun = push('실행화면', findMySeat()); }catch(e){ console.log('[바닥맞춤] 실행화면 조회 실패', e); }
  try{ dPrev = push('꾸미기/보관함 미리보기', wardrobeMod().wdPreviewBase(),
        [wardrobeMod().wdScene()]); }catch(e){ console.log('[바닥맞춤] 미리보기 조회 실패', e); }
  if(dRun != null && dPrev != null && Math.abs(dRun - dPrev) > DEPTH_MISMATCH_EPS){
    console.warn('[바닥맞춤] ⚠️ 실행 depth=' + f(dRun) + ' 미리보기 depth=' + f(dPrev) + ' — 같은 파츠인데 한쪽만 세고 있습니다');
  }
  return '위 로그를 복사해서 보내주세요';
}
try{ window.floorSnapReport = floorSnapReport; }catch(_){}

return {

};
}

const api = { createFloorSnapDiag };
if(typeof window !== 'undefined') window.TwFloorSnapDiag = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
