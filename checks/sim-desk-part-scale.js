/* 🧪 2번 검증 — '책상 위' 파츠가 책상 크기 슬라이더를 안 따라가는가.
   app.js 에서 syncDeskPartAnchor 원문만 뽑아 최소 스텁 위에서 돌린다.
   사용: node sim-desk-part-scale.js [app.js 경로] */
const fs = require('fs');
const path = (process.argv[2] || __dirname + '/app.js');
const src = fs.readFileSync(path, 'utf8');

function pick(startMark, endMark){
  const a = src.indexOf(startMark);
  if(a < 0) throw new Error('추출 실패 — ' + startMark);
  const b = src.indexOf(endMark, a);
  if(b < 0) throw new Error('추출 실패(끝) — ' + endMark);
  return src.slice(a, b);
}
// 실제 상수·함수 원문을 그대로 쓴다(스텁으로 베끼면 값이 갈려도 검사가 못 잡는다)
const DEFAULT_SRC = pick('const DESK_SCALE_DEFAULT', '\nlet cXform');
const RANGE_SRC   = pick('const DESK_SCALE_MIN', '\nfunction clampDeskScale');
const ANCHOR_SRC  = pick("const DESK_PART_ANCHOR_NAME", '\nfunction deskPartAnchorOf');

const env = new Function('seatDeskPosMul', `
  ${DEFAULT_SRC}
  ${RANGE_SRC}
  ${ANCHOR_SRC}
  return { syncDeskPartAnchor, DESK_SCALE_DEFAULT, DESK_SCALE_MIN, DESK_SCALE_MAX };
`)(() => 1);
const { syncDeskPartAnchor, DESK_SCALE_DEFAULT, DESK_SCALE_MIN, DESK_SCALE_MAX } = env;

// ── 최소 씬: 책상 그룹(배율) → 앵커(X 스트레치 상쇄) → 핀 → 파츠
function scene({ base, animCorr = 1, eqK = 1, lx = 1, deskPos = null }){
  const pin = { name:'__deskPartAnchor', scale:{x:1,y:1,z:1,set(x,y,z){this.x=x;this.y=y;this.z=z;}},
                position:{x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;}} };
  const s = (base||1) * animCorr * eqK;
  const anchor = { scale:{x:1/lx,y:1,z:1}, getObjectByName:n => (n===pin.name ? pin : null) };
  anchor.parent = null;
  const deskGroup = { scale:{x:s*lx, y:s, z:s},
    userData:{ deskAnchor:anchor, deskScaleBase:base, animCorr, eqK, deskLenX:lx, deskPosBase:deskPos },
    getObjectByName:()=>null };
  syncDeskPartAnchor(deskGroup);
  // 파츠가 화면에서 갖는 최종 배율 = 부모 사슬 × 핀
  return { pin, worldScaleY: deskGroup.scale.y * anchor.scale.y * pin.scale.y };
}

const f = v => (+v).toFixed(4);
let fail = 0;
const check = (label, got, want) => {
  const ok = Math.abs(got - want) < 1e-9;
  if(!ok) fail++;
  console.log((ok?'  ✅':'  ❌') + ' ' + label + ' → ' + f(got) + (ok?'':'  (기대 ' + f(want) + ')'));
};

const REF = scene({ base: DESK_SCALE_DEFAULT }).worldScaleY;   // 기준 = 슬라이더 기본값일 때의 파츠 크기
console.log('기준 파츠 배율(슬라이더 기본값 ' + DESK_SCALE_DEFAULT + ') = ' + f(REF));

console.log('[핵심] 슬라이더를 움직여도 파츠 크기가 안 변하는가');
check('최소(' + DESK_SCALE_MIN + ')',      scene({ base: DESK_SCALE_MIN }).worldScaleY, REF);
check('최대(' + DESK_SCALE_MAX + ')',      scene({ base: DESK_SCALE_MAX }).worldScaleY, REF);
check('중간(0.1)',                          scene({ base: 0.1 }).worldScaleY,            REF);

console.log('[회귀] 기본값이면 핀이 무동작인가(대부분의 사용자 화면이 안 바뀐다)');
check('pin.scale', scene({ base: DESK_SCALE_DEFAULT }).pin.scale.y, 1);

console.log('[회귀] 좌석 규약 배율은 그대로 물려받는가');
check('동물 40%',        scene({ base: 0.05, animCorr: 0.4 }).worldScaleY, REF * 0.4);
check('평준화 eqK 1.5',  scene({ base: 0.3,  eqK: 1.5 }).worldScaleY,      REF * 1.5);
check('책상 길이 lx 2 (파츠는 안 늘어남)', scene({ base: 0.05, lx: 2 }).worldScaleY, REF);

console.log('[회귀] 슬라이더 범위 밖 = 값을 모른다 → 예전 동작(무동작)');
check('base 1 (옛 폴백)', scene({ base: 1 }).pin.scale.y, 1);
check('base undefined',   scene({ base: undefined }).pin.scale.y, 1);

console.log('[회귀] 책상을 옮긴 적 없어도(deskPosBase 없음) 크기 상쇄는 걸리는가');
check('pin.scale', scene({ base: 0.05, deskPos: null }).pin.scale.y, DESK_SCALE_DEFAULT / 0.05);

console.log('[회귀] 위치 상쇄가 크기 상쇄에 안 휘둘리는가');
{
  const a = scene({ base: 0.05, deskPos:{x:2,y:0,z:0} });
  const b = scene({ base: 0.05, deskPos:{x:2,y:0,z:0}, lx: 2 });
  check('lx 와 무관하게 같은 로컬 이동량', a.pin.position.x, b.pin.position.x);
}

console.log(fail ? '\n❌ 실패 ' + fail + '건' : '\n✅ 전부 통과');
process.exit(fail ? 1 : 0);
