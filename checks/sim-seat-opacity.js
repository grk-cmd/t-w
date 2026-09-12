/* 🫧 setSeatOpacity 기억값 검증기 (임시) — node sim-seat-opacity.js
   app.js 의 setSeatOpacity / applyEquippedPartsToSeat 뒷정리 부분만 떼어내 옛 코드와 새 코드를
   같은 시나리오에 태운다. 실기기 없이 "머리만 안 돌아오는" 조건을 재현·확인하기 위한 것. */

function mkMat(op){ return { opacity: op, transparent: false, depthWrite: true, needsUpdate: false, userData: {} }; }
function mkMesh(name, mat){ return { isMesh: true, name, visible: true, material: mat, userData: {} }; }
function mkSeat(){ return { _lastOp: undefined, meshes: [] }; }

/* ── 옛 코드 ── */
function setOpacityOld(seat, op){
  if(seat._lastOp === op) return;
  seat._lastOp = op;
  const hide = op < 0.001;
  seat.meshes.forEach(o=>{
    if(hide){
      if(o.userData._prevVisible === undefined) o.userData._prevVisible = o.visible;
      o.visible = false;
    } else if(o.userData._prevVisible !== undefined){
      o.visible = o.userData._prevVisible;
      delete o.userData._prevVisible;
    }
    const m = o.material;
    if(m.userData._baseOpacity === undefined){
      m.userData._baseOpacity = (typeof m.opacity === 'number') ? m.opacity : 1;
      m.userData._baseTransparent = !!m.transparent;
    }
    const baseOp = m.userData._baseOpacity;
    const eff = baseOp * op;
    m.transparent = m.userData._baseTransparent || (op < 0.999);
    m.opacity = eff;
    m.depthWrite = (eff > 0.95);
  });
}

/* ── 새 코드 ── */
function setOpacityNew(seat, op){
  if(seat._lastOp === op) return;
  seat._lastOp = op;
  const hide = op < 0.001;
  seat.meshes.forEach(o=>{
    if(hide){
      if(o.userData._prevVisible === undefined) o.userData._prevVisible = o.visible;
      o.visible = false;
    } else if(o.userData._prevVisible !== undefined){
      o.visible = o.userData._prevVisible;
      delete o.userData._prevVisible;
    }
    const m = o.material;
    if(m.userData._baseOpacity === undefined && !m.userData._opTouched && op >= 0.999){
      m.userData._baseOpacity = (typeof m.opacity === 'number') ? m.opacity : 1;
      m.userData._baseTransparent = !!m.transparent;
    }
    m.userData._opTouched = true;
    const baseOp = (typeof m.userData._baseOpacity === 'number') ? m.userData._baseOpacity : 1;
    const baseTr = (m.userData._baseTransparent !== undefined) ? !!m.userData._baseTransparent : false;
    const eff = baseOp * op;
    m.transparent = baseTr || (op < 0.999);
    m.opacity = eff;
    m.depthWrite = (eff > 0.95);
  });
}

let fail = 0;
function check(label, cond, detail){
  console.log((cond ? '  ✅ ' : '  ❌ ') + label + (detail ? '   ' + detail : ''));
  if(!cond) fail++;
}

/* 시나리오 A — 재빌드된 머티리얼이 "숨은 동안" 처음 이 함수를 통과한 뒤 자리비움이 풀린다.
   파츠 없는 캐릭터는 _lastOp 재무장이 없어서 숨김이 한 박자 늦게 걸린다(= 그 순간 op=0 으로 첫 통과). */
function scenarioA(setOpacity, tag){
  console.log('\n[' + tag + '] A. 자리비움 중 좌석 재빌드 → 복귀');
  const seat = mkSeat();
  const head0 = mkMesh('head', mkMat(1));
  seat.meshes = [head0];
  setOpacity(seat, 1);            // 평소
  setOpacity(seat, 0);            // 자동 자리비움 진입
  // 좌석 재빌드 — 새 메시/머티리얼로 교체 (opacity 는 GLB 원본 1)
  const head1 = mkMesh('head', mkMat(1));
  seat.meshes = [head1];
  seat._lastOp = null;            // 뒷정리가 재무장(새 코드는 파츠 없어도 여기까지 온다)
  setOpacity(seat, 0);            // 숨은 상태에서 새 머티리얼 첫 통과 → opacity 0 이 찍힌다
  setOpacity(seat, 1);            // 사람이 돌아옴
  check('복귀 후 머리가 보인다',
    head1.visible === true && head1.material.opacity > 0.99,
    'visible=' + head1.visible + ' opacity=' + head1.material.opacity +
    ' base=' + head1.material.userData._baseOpacity);
  return head1;
}

/* 시나리오 B — 자리비움을 여러 번 반복해도 누적되지 않는가. */
function scenarioB(setOpacity, tag){
  console.log('[' + tag + '] B. 자리비움 3회 반복');
  const seat = mkSeat();
  const head = mkMesh('head', mkMat(1));
  seat.meshes = [head];
  setOpacity(seat, 1);
  for(let i = 0; i < 3; i++){ setOpacity(seat, 0); seat._lastOp = null; setOpacity(seat, 0); setOpacity(seat, 1); }
  check('3회 왕복 후에도 머리가 보인다',
    head.visible === true && head.material.opacity > 0.99,
    'opacity=' + head.material.opacity);
}

/* 시나리오 C — 원래 반투명한 파츠는 반투명이 유지되는가(불투명일 때 처음 만난 경우). */
function scenarioC(setOpacity, tag){
  console.log('[' + tag + '] C. 원본 반투명 파츠(0.5) 보존');
  const seat = mkSeat();
  const ghost = mkMesh('wing', mkMat(0.5));
  ghost.material.transparent = true;
  seat.meshes = [ghost];
  setOpacity(seat, 1);
  setOpacity(seat, 0);
  setOpacity(seat, 1);
  check('반투명(0.5)이 그대로 돌아온다',
    Math.abs(ghost.material.opacity - 0.5) < 1e-6,
    'opacity=' + ghost.material.opacity);
}

/* 시나리오 D — ★ 이것만이 실제로 baseOpacity=0 을 만든다.
   조건: 이 함수가 opacity 를 0 으로 써 둔 머티리얼이, **userData 를 잃은 채** 다시 들어온다.
     (머티리얼 clone 이 userData 를 안 옮기는 three 빌드, 또는 userData 를 새로 갈아끼우는 경로)
   시나리오 A·B 처럼 "새 머티리얼(opacity 1)"이 들어오는 경우엔 옛 코드도 멀쩡하다 —
   즉 이 버그는 재빌드만으로는 안 나고, **opacity 0 인 머티리얼 객체가 기억을 잃어야** 난다.
   원인 후보를 좁힐 때 이 구분이 핵심이다. */
function scenarioD(setOpacity, tag){
  console.log('[' + tag + '] D. opacity 0 인 머티리얼이 기억(userData)을 잃고 재진입');
  const seat = mkSeat();
  const mat = mkMat(1);
  const head = mkMesh('head', mat);
  seat.meshes = [head];
  setOpacity(seat, 1);
  setOpacity(seat, 0);                 // 여기서 mat.opacity = 0 이 찍힌다
  mat.userData = {};                   // ← 기억 상실 (clone/재설정 등)
  seat._lastOp = null;
  setOpacity(seat, 0);                 // 0 인 상태로 "처음 보는 머티리얼"이 되어 다시 통과
  setOpacity(seat, 1);                 // 사람이 돌아옴
  check('복귀 후 머리가 보인다',
    head.visible === true && head.material.opacity > 0.99,
    'opacity=' + head.material.opacity + ' base=' + head.material.userData._baseOpacity);
}

console.log('════ 옛 코드 ════');
scenarioA(setOpacityOld, '옛');
scenarioB(setOpacityOld, '옛');
scenarioC(setOpacityOld, '옛');
scenarioD(setOpacityOld, '옛');
const oldFail = fail;

fail = 0;
console.log('\n════ 새 코드 ════');
scenarioA(setOpacityNew, '새');
scenarioB(setOpacityNew, '새');
scenarioC(setOpacityNew, '새');
scenarioD(setOpacityNew, '새');

console.log('\n옛 코드 실패 ' + oldFail + '건 / 새 코드 실패 ' + fail + '건');
process.exit(fail === 0 ? 0 : 1);
