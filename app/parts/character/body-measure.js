/* body-measure.js — 캐릭터 «몸» 박스 재기 한 규칙(파츠 빼기 · 숨은 것 빼기 · 장식 메시 빼기)
   책임: root 아래 메시들의 월드 박스를 «무엇을 셀지» 옵션 하나로 잰다. 그리지도 · 옮기지도 · 저장하지도 않는다.
   받는 deps: 없음(THREE 는 전역 — app.js 앞에 싣는 classic script).
   내보내는 것: measureBodyBox(root, opts, out) · countsAsBody(mesh, root, opts) · isPartNode(node) · isPartByRigOrName(node) · PART_WRAP_PREFIX
   [왜 한 곳인가] 같은 «캐릭터 몸 크기 재기» 가 상태칩 · 올라타기 · 키 정규화 · 바닥 맞춤 · 날기 벽 · 이동 여백에
     따로 있었고 규칙이 제각각이었다(한쪽만 파츠를 빼서 리깅 모자를 쓰면 날기 위쪽 벽이 일찍 걸렸다).
   ⚠️ three r128 의 Box3.setFromObject 는 숨은 메시도 세고, 리깅(스키닝) 메시는 **스키닝 전 원본** 박스를 잰다 —
     리깅 파츠는 몸 크기로 줄여 입히므로 원본 박스가 몇 배씩 크다. 몸을 잴 때는 excludeParts 를 켠다.
   검사: checks/sim-body-measure.js */
(function(){

const PART_WRAP_PREFIX = '__partWrap_';

function createBodyMeasure(deps){

/* 꾸미기 파츠의 wrapper 인가 — 리깅 표식 · 이름 · 유령 청소 표식 셋 중 하나(셋은 붙일 때 함께 붙는다). */
function isPartNode(p){
  if(!p) return false;
  if(p.userData && (p.userData.rigged || p.userData.__twPartWrap)) return true;
  return typeof p.name === 'string' && p.name.indexOf(PART_WRAP_PREFIX) === 0;
}
/* 옛 판정 — 리깅 표식 · 이름만 본다(유령 청소 표식 __twPartWrap 은 안 봄). 진단 · 머리 여유 재기가 이 규칙이다(opts.partTest 로 넘긴다). */
function isPartByRigOrName(p){
  if(p.userData && p.userData.rigged) return true;
  return typeof p.name === 'string' && p.name.indexOf(PART_WRAP_PREFIX) === 0;
}

/* 이 메시를 몸으로 세는가.
   opts.excludeParts  true      — 꾸미기 파츠(isPartNode 하위) · 리깅 파츠 스킨드메시(_origBind) 를 뺀다
                      'rigged'  — 리깅 파츠만 뺀다(발밑 욕조 같은 파츠는 센다 — 바닥 맞춤용)
                      'skinned' — 리깅 파츠 스킨드메시(_origBind)만 뺀다(파츠 wrapper 하나 안을 잴 때 — 올라타기 귀 · 머리 파츠)
   opts.partTest      excludeParts:true 일 때 «파츠 wrapper 인가» 판정을 바꾼다(기본 isPartNode — 옛 규칙을 지키는 자리만)
   opts.visibleOnly   자기 자신이나 조상(root 는 빼고)이 숨었으면 뺀다
   opts.skipMeshes    Set — 이 메시들은 보이든 숨었든 뺀다(기본 GLB 의 모자 · 탈 등 머리 장식)
   opts.skipBranch    함수 — 자기나 조상(root 는 빼고) 중 하나라도 참이면 그 가지를 통째로 뺀다(책상 바닥 맞춤의 파츠 핀) */
function countsAsBody(o, root, opts){
  if(!o || !o.isMesh) return false;
  const op = opts || {};
  if(op.skipMeshes && op.skipMeshes.has(o)) return false;
  if(op.excludeParts && o.userData && o.userData._origBind) return false;
  if(op.visibleOnly && o.visible === false) return false;
  const isPart = op.partTest || isPartNode;
  for(let p = o; p && p !== root; p = p.parent){
    if(op.visibleOnly && p.visible === false) return false;
    if(op.excludeParts === true && isPart(p)) return false;
    if(op.excludeParts === 'rigged' && p.userData && p.userData.rigged) return false;
    if(op.skipBranch && op.skipBranch(p)) return false;
  }
  return true;
}

/* root 의 몸 박스(월드 — frame 을 주면 그 노드 좌표계). out 을 주면 그 박스에 담는다(매 프레임 new 를 피하려고).
   옵션이 하나도 없으면 three 의 setFromObject(root) 그대로 — 숨은 것 · 파츠 · 메시 아닌 도형까지 다 센다.
   opts.updateWorld  false 면 root(· frame)의 행렬을 다시 세우지 않는다(부르는 쪽이 이미 세웠거나 옛 동작이 그랬을 때)
   opts.selfOnly     메시 자기 도형만(자식은 안 셈 · 메시 행렬도 안 갱신) — 상태칩 실측의 옛 방식
   opts.frame        노드 — 그 노드의 로컬 좌표계로 잰다(자기 도형 × frame 역행렬 × 메시 월드 — selfOnly 처럼 잰다). 리그 원본 단위의 머리 여유 진단
   opts.outBoxes     배열을 주면 센 메시 하나하나의 박스를 담아 준다(올라타기 · 꼭대기 근처 메시 고르기) */
function measureBodyBox(root, opts, out){
  const box = out || new THREE.Box3();
  box.makeEmpty();
  if(!root) return box;
  const op = opts || {};
  if(!op.excludeParts && !op.visibleOnly && !op.skipMeshes && !op.skipBranch && !op.frame){ box.setFromObject(root); return box; }
  const tmp = new THREE.Box3();
  if(op.updateWorld !== false){ root.updateWorldMatrix(true, true); if(op.frame) op.frame.updateWorldMatrix(true, true); }
  const toFrame = op.frame ? new THREE.Matrix4().copy(op.frame.matrixWorld).invert() : null;
  const M = toFrame ? new THREE.Matrix4() : null;
  root.traverse(o=>{
    if(!countsAsBody(o, root, op)) return;
    try{
      if(op.selfOnly || toFrame){
        if(!o.geometry) return;
        if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        if(!o.geometry.boundingBox) return;
        tmp.copy(o.geometry.boundingBox).applyMatrix4(toFrame ? M.copy(toFrame).multiply(o.matrixWorld) : o.matrixWorld);
      } else {
        tmp.setFromObject(o);
      }
      if(!tmp.isEmpty()){ box.union(tmp); if(op.outBoxes) op.outBoxes.push(tmp.clone()); }
    }catch(_){}
  });
  return box;
}

return {
  PART_WRAP_PREFIX,
  countsAsBody,
  isPartByRigOrName,
  isPartNode,
  measureBodyBox,
};
}

const api = { createBodyMeasure };
if(typeof window !== 'undefined') window.TwBodyMeasure = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
