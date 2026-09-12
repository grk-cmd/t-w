/* 🧪 3번 검증 — 머리 중앙 파츠 위에 얹기 판정.
   app.js 에서 _measureRideablePartTop 원문과 RIDE_PART_CENTER_MARGIN 상수를 뽑아 스텁 위에서 돌린다.
   사용: node sim-ride-part-top.js [app.js 경로] */
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || __dirname + '/app.js', 'utf8');

function pick(a, b){
  const i = src.indexOf(a); if(i < 0) throw new Error('추출 실패 — ' + a);
  const j = src.indexOf(b, i); if(j < 0) throw new Error('추출 실패(끝) — ' + b);
  return src.slice(i, j);
}
const MARGIN_SRC = pick('const RIDE_PART_CENTER_MARGIN', '\n/* 🦶 위 실측값');
const FN_SRC     = pick('function _partAllowsRideTop', '\n/* 🐾 대상의');

class Box3 {
  constructor(){ this.min={x:0,y:0,z:0}; this.max={x:0,y:0,z:0}; this.empty=true; }
  isEmpty(){ return this.empty; }
  setFromObject(o){ this.empty = true; if(o.box){ this.min={...o.box.min}; this.max={...o.box.max}; this.empty=false; } return this; }
  union(b){
    if(b.empty) return this;
    if(this.empty){ this.min={...b.min}; this.max={...b.max}; this.empty=false; return this; }
    for(const k of ['x','y','z']){ this.min[k]=Math.min(this.min[k],b.min[k]); this.max[k]=Math.max(this.max[k],b.max[k]); }
    return this;
  }
}
const THREE = { Box3 };
let savedParts = [];
const env = new Function('THREE', 'savedParts', `
  ${MARGIN_SRC}
  ${FN_SRC}
  return { _measureRideablePartTop, RIDE_PART_CENTER_MARGIN };
`);

function node(name, box, extra){
  return Object.assign({ name, box, isMesh:!!box, visible:true, userData:{}, children:[], parent:null,
    traverse(cb){ cb(this); this.children.forEach(c=>c.traverse(cb)); },
    add(c){ c.parent=this; this.children.push(c); return this; } }, extra||{});
}
const box = (x0,x1,y0,y1,z0,z1)=>({min:{x:x0,y:y0,z:z0}, max:{x:x1,y:y1,z:z1}});
// 머리 꼭대기 층: 좌우·앞뒤 폭 100, 중심 0, 꼭대기 y=400
const slab = Object.assign(new Box3(), { min:{x:-50,y:380,z:-50}, max:{x:50,y:400,z:50}, empty:false });

function scene(parts){
  savedParts = parts.map((p,i)=>({ id:'p'+i, rideTop:p.rideTop !== false }));
  const root = node('root', null, {isMesh:false});
  parts.forEach((p,i)=>{
    const w = node('__partWrap_hat', null, {isMesh:false});
    w.userData.__twPartWrap = true; w.userData.partId = 'p'+i;
    if(p.wrapHidden) w.visible = false;
    const m = node('mesh', box(p.x-p.w/2, p.x+p.w/2, 400, 400+p.h, p.z-p.d/2, p.z+p.d/2));
    if(p.meshHidden) m.visible = false;
    w.add(m); root.add(w);
  });
  const { _measureRideablePartTop } = env(THREE, savedParts);
  return _measureRideablePartTop({ gltfRoot: root }, slab);
}
const { RIDE_PART_CENTER_MARGIN: M } = env(THREE, []);

let fail = 0;
const check = (label, got, want) => {
  const ok = (got === want) || (want !== null && got !== null && Math.abs(got-want) < 1e-9);
  if(!ok) fail++;
  console.log((ok?'  ✅':'  ❌') + ' ' + label + ' → ' + got + (ok?'':'  (기대 ' + want + ')'));
};
console.log('중앙 기준 = ' + Math.round(M*100) + '% (머리 폭 100 → 여유 ' + (M*100) + ' 필요)');

console.log('[통과해야 하는 것]');
check('정중앙 넓은 접시', scene([{x:0,z:0,w:80,d:80,h:10}]), 410);
check('여유 딱 기준만큼', scene([{x:0,z:0,w:30,d:30,h:10}]), 410);
check('살짝 치우쳤지만 넓다', scene([{x:20,z:0,w:90,d:90,h:12}]), 412);
check('둘 통과하면 높은 쪽', scene([{x:0,z:0,w:80,d:80,h:10},{x:0,z:0,w:60,d:60,h:30}]), 430);

console.log('[떨어져야 하는 것]');
check('뿔 — 정중앙이지만 좁다', scene([{x:0,z:0,w:8,d:8,h:60}]), null);
check('여유가 기준에 1 모자람', scene([{x:0,z:0,w:28,d:28,h:10}]), null);
check('중심을 아예 안 덮음', scene([{x:60,z:0,w:40,d:40,h:10}]), null);
check('앞뒤로만 치우침', scene([{x:0,z:40,w:80,d:40,h:10}]), null);
check('관리자가 안 켠 파츠', scene([{x:0,z:0,w:80,d:80,h:10,rideTop:false}]), null);
check('넓지만 통과 못한 것과 섞임', scene([{x:0,z:0,w:8,d:8,h:60},{x:70,z:0,w:20,d:20,h:40}]), null);

console.log('[회귀] 숨은 것은 안 센다');
check('wrapper 가 숨음', scene([{x:0,z:0,w:80,d:80,h:10,wrapHidden:true}]), null);
check('안쪽 메쉬가 숨음', scene([{x:0,z:0,w:80,d:80,h:10,meshHidden:true}]), null);

console.log('[회귀] 잴 것이 없으면 null');
check('파츠 없음', scene([]), null);
{
  const { _measureRideablePartTop } = env(THREE, []);
  check('꼭대기 층 측정 실패(통메쉬)', _measureRideablePartTop({ gltfRoot: node('r', null, {isMesh:false}) }, new Box3()), null);
  check('좌석 없음', _measureRideablePartTop(null, slab), null);
}

console.log(fail ? '\n❌ 실패 ' + fail + '건' : '\n✅ 전부 통과');
process.exit(fail ? 1 : 0);
