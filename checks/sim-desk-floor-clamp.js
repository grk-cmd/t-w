/* sim-desk-floor-clamp.js — 🪑🦶 책상 바닥 클램프 되먹임 검사 (제보 2-1)
   실행:  node sim-desk-floor-clamp.js   (app.js 와 같은 폴더에서)

   ★ 왜 이 검사가 있는가 — 제보 2-1("생성기에서 기즈모로 책상을 옮기면 하늘로 솟는다")의 정체는
     좌표계도 단위도 아니었다. **잰 것과 움직이는 것이 달랐던 것**이다.

       · 책상 위 파츠는 deskAnchor 밑의 __deskPartAnchor 핀에 붙는다.
       · 그 핀은 syncDeskPartAnchor 가 책상 오프셋을 **상쇄**한다 — 책상을 옮겨도 파츠는 안 따라간다.
       · 그런데 바닥 클램프는 Box3(cDesk) 로 **파츠까지 함께** 재고 있었다.

     그래서 파츠가 y<0 에 있으면:
       ① 깊이 d 가 잡힌다 → ② 책상 전체를 d 만큼 올린다 → ③ 상쇄가 갱신돼 파츠는 제자리 →
       ④ 다음 프레임에 같은 d 가 또 잡힌다 → **매 프레임 올라간다.**
     objectChange 마다 도는 코드라 드래그하는 동안 계속 솟는다.

     [실측] 유저 콘솔에서 deskPos.y 가 0.1399 까지 올라갔는데 Box3(cDesk).min.y 는 계속 0 이었다.
       그 0 은 책상 다리가 아니라 제자리에 남은 파츠의 바닥이었다.

   ★ 무엇을 보는가 (두 층)
     §1 소스 대조 — 클램프가 skipSub 를 받는가 · 책상 호출이 파츠 핀을 빼는가 ·
        되먹임의 다른 쪽 짝(syncDeskPartAnchor 의 상쇄)이 그대로인가
     §2 런타임 — app.js 에서 _boxExcluding · floorClampWrapper 를 **원본 그대로 떼어내** 돌린다.
        상쇄되는 파츠를 매단 책상을 여러 번 클램프해서, 지금 코드는 안 솟고
        **옛 방식(전부 재기)으로 돌리면 실제로 솟는 것**까지 확인한다.

   ⚠ three.js 를 쓸 수 없어(스모크 스텁의 THREE 는 껍데기다) 이 검사는 Box3/Object3D 를
     **y 축만 계산하는 최소 구현**으로 대신한다. 회전은 없다고 가정한다 — 책상·앵커 사슬에
     회전이 들어오면 이 검사의 전제가 깨지므로 그때는 눈으로도 볼 것.
   ⚠ 기즈모 자체(TransformControls)는 보지 않는다. 클램프 산수만 본다. */
'use strict';
const fs = require('fs');
const SRC = fs.readFileSync('app.js', 'utf8');
const say = console.log;
let fail = 0;
const chk = (c, m) => { say((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };

say('=== 🪑🦶 책상 바닥 클램프 되먹임 검사 (제보 2-1) ===');
say('');

/* ── §1. 소스 대조 ───────────────────────────────────────────────── */
say('· §1 소스 대조 — 잰 것과 움직이는 것이 같은가');

chk(/function\s+_boxExcluding\s*\(\s*root\s*,\s*skipSub\s*\)/.test(SRC),
    '_boxExcluding(root, skipSub) 가 있다');
chk(/function\s+floorClampWrapper\s*\(\s*w\s*,\s*tag\s*,\s*hard\s*,\s*skipSub\s*\)/.test(SRC),
    'floorClampWrapper 가 skipSub 를 받는다');
chk(/skipSub\s*\?\s*_boxExcluding\(w,\s*skipSub\)\s*:\s*new THREE\.Box3\(\)\.setFromObject\(w\)/.test(SRC),
    'skipSub 를 안 넘기면 예전처럼 전부 잰다 (다른 호출부는 무변화)');

const deskCall = (SRC.match(/floorClampWrapper\(cDesk[^;]*;/) || [''])[0];
chk(/DESK_PART_ANCHOR_NAME/.test(deskCall),
    '★ 책상 클램프가 파츠 핀(__deskPartAnchor)을 측정에서 뺀다 — 제보 2-1 의 수정');

// 책상 위 '아이템' 은 책상을 따라가므로 빼면 안 된다
const itemCalls = [...SRC.matchAll(/floorClampWrapper\((?!cDesk)[^;]*;/g)].map(m => m[0]);
chk(itemCalls.length > 0 && itemCalls.every(c => !/DESK_PART_ANCHOR_NAME/.test(c)),
    '파츠·아이템 자신의 클램프는 예전 그대로다 (' + itemCalls.length + '곳)');

// 되먹임의 다른 쪽 짝 — 상쇄가 사라지면 이 수정의 전제도 사라진다
chk(/pin\.position\.set\(\s*-\(\+b\.x/.test(SRC),
    'syncDeskPartAnchor 의 상쇄가 그대로다 (이게 없어지면 파츠도 책상을 따라가므로 빼면 안 된다)');

say('');

/* ── §2. 런타임 ──────────────────────────────────────────────────── */
say('· §2 런타임 — 상쇄되는 파츠를 매단 책상을 여러 번 클램프하면');

/* app.js 에서 함수 두 개와 상수를 **원본 그대로** 떼어낸다(중괄호 짝맞추기). */
function cut(name){
  const i = SRC.indexOf('function ' + name + '(');
  if (i < 0) throw new Error(name + ' 를 못 찾음');
  let d = 0, j = SRC.indexOf('{', i);
  for (let k = j; k < SRC.length; k++){
    if (SRC[k] === '{') d++;
    else if (SRC[k] === '}'){ d--; if (d === 0) return SRC.slice(i, k + 1); }
  }
  throw new Error(name + ' 의 끝을 못 찾음');
}
const SNAP_MIN = +(/FLOOR_SNAP_MIN\s*=\s*([\d.]+)/.exec(SRC) || [])[1];
const SNAP_MAX = +(/FLOOR_SNAP_MAX\s*=\s*([\d.]+)/.exec(SRC) || [])[1];
const PIN_NAME = (/DESK_PART_ANCHOR_NAME\s*=\s*'([^']+)'/.exec(SRC) || [])[1];
chk(isFinite(SNAP_MIN) && isFinite(SNAP_MAX) && !!PIN_NAME,
    '상수를 읽었다 (min ' + SNAP_MIN + ' · max ' + SNAP_MAX + ' · 핀 ' + PIN_NAME + ')');

/* 최소 THREE — y 축만. 회전 없음. */
function V3(){ this.x = 0; this.y = 0; this.z = 0; }
function Box3(){ this.min = { x:0, y:Infinity, z:0 }; this.max = { x:0, y:-Infinity, z:0 }; }
Box3.prototype.isEmpty = function(){ return this.max.y < this.min.y; };
Box3.prototype.union = function(b){
  if (!b.isEmpty()){ this.min.y = Math.min(this.min.y, b.min.y); this.max.y = Math.max(this.max.y, b.max.y); }
  return this;
};
function worldRange(n){
  let lo = n.box[0], hi = n.box[1], p = n;
  while (p){ lo = lo * p.scale.y + p.position.y; hi = hi * p.scale.y + p.position.y; p = p.parent; }
  return [Math.min(lo, hi), Math.max(lo, hi)];
}
Box3.prototype.setFromObject = function(o){
  this.min.y = Infinity; this.max.y = -Infinity;
  const walk = n => {
    if (n.isMesh && n.box){ const r = worldRange(n);
      this.min.y = Math.min(this.min.y, r[0]); this.max.y = Math.max(this.max.y, r[1]); }
    (n.children || []).forEach(walk);
  };
  walk(o); return this;
};
const THREE = { Box3, Vector3: V3 };

function node(name){
  return { name, isMesh:false, visible:true, children:[], parent:null,
    position:{x:0,y:0,z:0}, scale:{x:1,y:1,z:1},
    add(c){ c.parent = this; this.children.push(c); return c; },
    updateWorldMatrix(){},
    getWorldScale(v){ let s = 1, p = this; while (p){ s *= p.scale.y; p = p.parent; } v.y = s; return v; } };
}
function mesh(name, y0, y1){ const n = node(name); n.isMesh = true; n.box = [y0, y1]; return n; }

/* 떼어낸 함수 두 개를 이 THREE 위에서 살린다 */
const mk = new Function('THREE', 'FLOOR_SNAP_MIN', 'FLOOR_SNAP_MAX',
  cut('_boxExcluding') + '\n' + cut('floorClampWrapper') +
  '\n;return {_boxExcluding, floorClampWrapper};');
const F = mk(THREE, SNAP_MIN, SNAP_MAX);

/* 생성기 책상 한 벌.
   scale 0.175 는 setDeskScale 의 실제 배율대이고, 다리는 로컬 0~0.42 (buildDesk 의 deskTopY-0.04). */
const PART_WORLD_Y = -0.05;    // 파츠가 바닥 아래로 내려가 있는 깊이
function makeDesk(){
  const scene = node('scene');
  const desk = node('desk'); desk.scale = {x:0.175, y:0.175, z:0.175}; scene.add(desk);
  desk.add(mesh('legs', 0, 0.42));                       // 책상 다리 — 책상을 따라 움직인다
  const anchor = node('deskAnchor'); desk.add(anchor);
  anchor.add(mesh('plant', 0, 0.2));                     // 책상 위 아이템 — 책상을 따라 움직인다
  const pin = node(PIN_NAME); anchor.add(pin);
  pin.add(mesh('가챠파츠', -0.4, 0.4));                    // 책상 위 파츠 — 상쇄돼 안 따라온다
  return { scene, desk, anchor, pin };
}
/* syncDeskPartAnchor 의 상쇄를 흉내낸다 — 책상이 어디로 가든 파츠의 **월드 y 를 고정**한다.
   (실제 코드는 deskPosBase 를 부모 배율로 나눠 핀에 반대로 넣는다. 결과는 같다.) */
function repin(D){
  const half = 0.4;   // 파츠 메쉬의 로컬 반높이
  // 파츠 월드 바닥 = PART_WORLD_Y 가 되도록 핀 로컬 y 를 되계산
  const chain = D.anchor.scale.y * D.desk.scale.y;
  D.pin.position.y = ((PART_WORLD_Y + half * chain) - D.desk.position.y) / chain;
}

function run(skipSub, ticks){
  const D = makeDesk();
  D.desk.position.y = 0; repin(D);
  const ys = [];
  for (let i = 0; i < ticks; i++){
    F.floorClampWrapper(D.desk, '책상', true, skipSub);
    repin(D);                                   // 클램프 직후 상쇄가 갱신된다(실제 코드와 같은 순서)
    ys.push(+D.desk.position.y.toFixed(4));
  }
  return ys;
}
const skipPin = o => o.name === PIN_NAME;

// (ㄱ) 지금 코드 — 파츠를 빼고 잰다
const now = run(skipPin, 5);
chk(now.every(v => v === 0), '★ 책상이 한 번도 안 올라간다 (' + now.join(' → ') + ')');

// (ㄴ) 옛 방식 — 전부 잰다. 이 검사가 그 함정을 잡는가
const old = run(null, 5);
chk(old[0] > 0, '옛 방식이면 첫 프레임부터 올라간다 (' + old[0] + ')');
chk(old[4] > old[0], '★ 옛 방식이면 프레임마다 계속 솟는다 (' + old.join(' → ') + ') — 되먹임 재현');

// (ㄷ) 파츠가 없으면 두 방식이 같아야 한다 (수정이 멀쩡한 책상의 동작을 바꾸지 않았는가)
function runNoPart(skipSub){
  const D = makeDesk();
  D.pin.children.length = 0;                    // 파츠 없음
  D.desk.position.y = -0.06;                    // 책상을 바닥 아래로 끌어내린 상태
  F.floorClampWrapper(D.desk, '책상', true, skipSub);
  return +D.desk.position.y.toFixed(4);
}
const a = runNoPart(skipPin), b = runNoPart(null);
chk(a === b, '파츠가 없으면 두 방식의 결과가 같다 (' + a + ' = ' + b + ')');
chk(a === 0, '★ 바닥 아래로 내려간 책상은 여전히 y=0 으로 끌어올린다 (' + a + ')');

// (ㄹ) 책상 위 '아이템'은 계속 측정에 든다 — 그건 책상을 따라 움직이므로 빼면 안 된다
{
  const D = makeDesk();
  D.pin.children.length = 0;
  D.anchor.children[0].box = [-1.0, 0.2];       // 화분이 책상 밑으로 길게 내려간 경우
  D.desk.position.y = 0;
  F.floorClampWrapper(D.desk, '책상', true, skipPin);
  chk(D.desk.position.y > 0, '★ 파츠를 빼도 책상 위 아이템은 여전히 바닥 판정에 든다 ('
      + D.desk.position.y.toFixed(4) + ')');
}

say('');
if (fail){ say('문제 ' + fail + '건'); process.exit(1); }
say('전부 통과 ✅ — 클램프가 재는 것과 움직이는 것이 같아졌다 (되먹임 없음)');
process.exit(0);
