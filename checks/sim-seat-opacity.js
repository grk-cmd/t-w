/* 🫧 setSeatOpacity 검증기 — node sim-seat-opacity.js
   자리비움(op≈0)이 풀렸는데 머리가 안 돌아오는 사고를 시나리오 넷으로 재현한다.

   ★ [2026-09-14] **app.js 의 본문을 직접 떼어다 태운다.**
     예전에는 새 코드를 이 파일 안에 베껴 두고 그 사본을 돌렸다(머리말에 「(임시)」라고
     적혀 있었다). 그래서 `app.js` 쪽이 어떻게 바뀌어도 이 검사는 초록이었다 —
     과거를 보여 주는 기록물이지 앞으로를 지키는 검사가 아니었다.

   ⚠️ 떼어낼 때 **주석을 걷은 본문**을 쓴다. app.js 는 본문의 30% 가 주석이고, 그 주석에
     「하지 말라」고 적어 둔 옛 코드가 그대로 인용돼 있다. 원문에 구조 검사를 걸면 그
     인용문에 걸려 초록이 된다(sim-overlay-gap 이 실제로 그렇게 통과했었다).

   ⚠️ 옛 코드(setOpacityOld)는 **지우지 않는다.** 역할이 바뀌었다 — 이제는 대조군이다.
     옛 코드가 시나리오 D 를 통과해 버리면 그건 고쳐졌다는 뜻이 아니라 **시나리오가
     무뎌졌다**는 뜻이므로, 그 자체를 빨강으로 센다. */

const fs = require('fs');
const path = require('path');

const SRC_NAME = 'app.js';
const SRC_PATH = path.join(__dirname, SRC_NAME);
if (!fs.existsSync(SRC_PATH)){
  console.log('✗ ' + SRC_NAME + ' 를 못 찾음 — ' + SRC_NAME + ' 이 있는 폴더에서 실행할 것');
  process.exit(2);
}
const SRC = fs.readFileSync(SRC_PATH, 'utf8');

/* 주석만 같은 길이의 공백으로 바꾼다(자리 보존). 문자열 안은 안 건드린다.
   ⚠️ 정규식 리터럴은 안 가린다 — 뗄 함수 안에 정규식이 없어서 괜찮다. 창을 넓히거나
     다른 함수에 쓸 때는 이 가정부터 확인할 것. */
function stripComments(s){
  const out = s.split(''); let i = 0;
  while (i < s.length){
    const c = s[i];
    if (c === '"' || c === "'" || c === '`'){
      const q = c; i++;
      while (i < s.length){
        if (s[i] === '\\'){ i += 2; continue; }
        if (s[i] === q){ i++; break; }
        if (s[i] === '\n' && q !== '`') break;
        i++;
      }
      continue;
    }
    if (c === '/' && s[i+1] === '/'){
      let j = s.indexOf('\n', i); if (j < 0) j = s.length;
      for (let k = i; k < j; k++) out[k] = ' ';
      i = j; continue;
    }
    if (c === '/' && s[i+1] === '*'){
      let j = s.indexOf('*/', i+2); j = (j < 0) ? s.length : j + 2;
      for (let k = i; k < j; k++) if (out[k] !== '\n') out[k] = ' ';
      i = j; continue;
    }
    i++;
  }
  return out.join('');
}

/* 서명부터 중괄호를 세어 본문을 뗀다. */
function fnBody(src, sig){
  const at = src.indexOf(sig);
  if (at < 0) return null;
  const win = stripComments(src.slice(at, at + 20000));
  const open = win.indexOf('{');
  if (open < 0) return null;
  let depth = 0;
  for (let k = open; k < win.length; k++){
    const c = win[k];
    if (c === '"' || c === "'" || c === '`'){
      const q = c; k++;
      while (k < win.length){
        if (win[k] === '\\'){ k += 2; continue; }
        if (win[k] === q) break;
        k++;
      }
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}'){ depth--; if (depth === 0) return win.slice(open + 1, k); }
  }
  return null;
}

const BODY = fnBody(SRC, 'function setSeatOpacity(seat, op)');
if (BODY === null){
  console.log('✗ ' + SRC_NAME + ' 안에서 setSeatOpacity 를 못 뗐다 — 서명이 바뀌었는지 확인할 것');
  process.exit(1);
}
/* ★ 이것이 검사의 핵심이다. 사본이 아니라 **app.js 에 실제로 들어 있는 본문**이 돈다. */
const setOpacityNew = new Function('seat', 'op', BODY);

/* 모형은 실물에 맞춘다 — 실물은 seat.meshes 가 아니라 seat.bodyWrap.traverse 를 돌고,
   material 이 배열일 수 있다고 보고 mats.forEach 로 편다. */
function mkMat(op){ return { opacity: op, transparent: false, depthWrite: true, needsUpdate: false, userData: {} }; }
function mkMesh(name, mat){ return { isMesh: true, name, visible: true, material: mat, userData: {} }; }
function mkSeat(){
  const seat = { _lastOp: undefined, meshes: [] };
  seat.bodyWrap = { traverse(cb){ cb(seat.bodyWrap); seat.meshes.forEach(cb); } };
  return seat;
}

/* ── 옛 코드(대조군) ── 고치기 전 본문. 시나리오가 아직 이것을 가려내는지 재는 데만 쓴다. ── */
function setOpacityOld(seat, op){
  if(seat._lastOp === op) return;
  seat._lastOp = op;
  const hide = op < 0.001;
  seat.bodyWrap.traverse(o=>{
    if(!o.isMesh) return;
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


/* ══ 구조 — 떼어온 본문이 갖춰야 할 것 ═══════════════════════════════════
   시나리오는 "이 조건에서 안 보이나"를 재고, 여기는 "왜 안 보이게 됐던가"의 방어가
   본문에 남아 있는지를 잰다. 둘 중 하나만 있으면 조용히 되돌아간다. */
console.log('════ 구조 (app.js 에서 떼어온 본문) ════');
check('원본 투명도를 **불투명할 때만** 잰다 (op >= 0.999)',
  /_baseOpacity\s*===\s*undefined[\s\S]{0,120}?op\s*>=\s*0\.999/.test(BODY));
check('한 번이라도 쓴 머티리얼에 표식을 남긴다 (_opTouched)',
  /_opTouched\s*=\s*true/.test(BODY) && /!\s*m\.userData\._opTouched/.test(BODY));
check('_baseTransparent 가 _baseOpacity 와 **같은 조건 안**에서 잰다',
  /_baseOpacity\s*=[\s\S]{0,200}?_baseTransparent\s*=/.test(BODY));
check('자리비움 해제 때 원래 visible 을 되돌린다 (_prevVisible)',
  /_prevVisible\s*!==\s*undefined/.test(BODY) && /delete\s+o\.userData\._prevVisible/.test(BODY));
const structFail = fail;

fail = 0;
console.log('\n════ 옛 코드 (대조군 — 여기서 실패가 나와야 시나리오가 살아 있는 것이다) ════');
scenarioA(setOpacityOld, '옛');
scenarioB(setOpacityOld, '옛');
scenarioC(setOpacityOld, '옛');
scenarioD(setOpacityOld, '옛');
const oldFail = fail;

fail = 0;
console.log('\n════ 지금 코드 (app.js 본문) ════');
scenarioA(setOpacityNew, '새');
scenarioB(setOpacityNew, '새');
scenarioC(setOpacityNew, '새');
scenarioD(setOpacityNew, '새');
const newFail = fail;

console.log('');
/* ★ 대조군이 전부 통과하면 고쳐진 것이 아니라 **시나리오가 무뎌진 것**이다. */
check('시나리오가 아직 옛 코드를 가려낸다 (대조군 실패 ' + oldFail + '건)', oldFail > 0);
const total = structFail + newFail + (oldFail > 0 ? 0 : 1);

console.log('  구조 ' + structFail + '건 · 지금 코드 ' + newFail + '건 · 대조군 ' + oldFail + '건(0이면 안 된다)');
if (total){ console.log('✗ 실패 ' + total + '건'); process.exit(1); }
console.log('전부 통과 ✅');
