/* 🧪 1번 검증 — 모자 파츠를 끼고 벗어도 '머리 꼭대기' 측정값이 안 흔들리는가.
   app.js 에서 해당 함수 원문만 뽑아 최소 THREE 스텁 위에서 돌린다(파일 수정 없이 실제 코드를 평가). */
const fs = require('fs');
const src = fs.readFileSync((process.argv[2] || __dirname + '/app.js'), 'utf8');

// ── 원문 추출: HEAD_DECOR_MESH_KEYS 선언부터 measureHeadBoxNoParts 끝까지
const start = src.indexOf("const HEAD_DECOR_MESH_KEYS");
const endMark = src.indexOf("function measureCharBox");
if (start < 0 || endMark < 0) throw new Error('추출 실패 — 함수 위치가 바뀌었다');
const snippet = src.slice(start, endMark);

// ── 최소 THREE 스텁 (축정렬 박스 · 월드 변환 없음 = 로컬 좌표가 곧 월드)
class Box3 {
  constructor(){ this.min={x:0,y:0,z:0}; this.max={x:0,y:0,z:0}; this.empty=true; }
  isEmpty(){ return this.empty; }
  clone(){ const b=new Box3(); b.min={...this.min}; b.max={...this.max}; b.empty=this.empty; return b; }
  setFromObject(o){
    this.empty = true;
    if(o.box){ this.min={...o.box.min}; this.max={...o.box.max}; this.empty=false; }
    return this;
  }
  union(b){
    if(b.empty) return this;
    if(this.empty){ this.min={...b.min}; this.max={...b.max}; this.empty=false; return this; }
    for(const k of ['x','y','z']){
      this.min[k]=Math.min(this.min[k], b.min[k]);
      this.max[k]=Math.max(this.max[k], b.max[k]);
    }
    return this;
  }
}
const THREE = { Box3 };

const fn = new Function('THREE', snippet + '\n return { measureHeadBoxNoParts, headDecorMeshSet };');
const { measureHeadBoxNoParts } = fn(THREE);

// ── 장면 구성: 몸 + 기본 모자(몸보다 위로 뻗음)
function node(name, box, extra){
  return Object.assign({ name, box, isMesh:!!box, visible:true, userData:{}, children:[],
    parent:null, updateWorldMatrix(){}, traverse(cb){ cb(this); this.children.forEach(c=>c.traverse(cb)); },
    add(c){ c.parent=this; this.children.push(c); return this; } }, extra||{});
}
const B = (y0,y1)=>({min:{x:-1,y:y0,z:-1}, max:{x:1,y:y1,z:1}});

function buildScene(){
  const root = node('root', null, {isMesh:false});
  const body = node('body', B(0, 4.00));
  const hat  = node('hat',  B(3.90, 4.10));   // 기본 모자 — 머리보다 0.10 위로 뻗는다
  root.add(body); root.add(hat);
  return { root, seat:{ hatMesh:hat, maskMesh:null, glassesMesh:null, wingMesh:null }, hat };
}
// 가챠 모자 파츠 착용 = __partWrap_ 하위로 붙고, applyClothVisibility 가 기본 모자를 숨긴다
function equipHatPart(scene, topY){
  const wrap = node('__partWrap_hat', null, {isMesh:false});
  wrap.add(node('gachaHat', B(3.95, topY)));
  scene.root.add(wrap);
  scene.hat.visible = false;
}

const f = v => v.toFixed(4);
let fail = 0;
function check(label, got, want){
  const ok = Math.abs(got - want) < 1e-9;
  if(!ok) fail++;
  console.log((ok?'  ✅':'  ❌') + ' ' + label + ' → ' + f(got) + (ok?'':'  (기대 ' + f(want) + ')'));
}

console.log('[옛 규칙 — meshHost 를 안 넘긴 경우] 파츠 착용에 따라 흔들리는가');
{
  const a = buildScene(); const before = measureHeadBoxNoParts(a.root).max.y;
  const b = buildScene(); equipHatPart(b, 4.05); const after = measureHeadBoxNoParts(b.root).max.y;
  console.log('  착용 전 ' + f(before) + ' / 착용 후 ' + f(after) + '  차이 ' + f(before - after));
  console.log((Math.abs(before-after) > 1e-9 ? '  ✅' : '  ❌') + ' 흔들림이 재현된다(= 제보된 증상)');
  if(Math.abs(before-after) <= 1e-9) fail++;
}

console.log('[새 규칙 — meshHost 를 넘긴 경우] 기본 모자 제외로 고정되는가');
{
  const a = buildScene();
  check('착용 전', measureHeadBoxNoParts(a.root, null, a.seat).max.y, 4.00);

  const b = buildScene(); equipHatPart(b, 4.05);
  check('낮은 파츠 착용', measureHeadBoxNoParts(b.root, null, b.seat).max.y, 4.00);

  const c = buildScene(); equipHatPart(c, 9.00);
  check('아주 높은 파츠 착용(파츠 끝에 안 얹혀야 함)', measureHeadBoxNoParts(c.root, null, c.seat).max.y, 4.00);
}

console.log('[회귀] 자리비움 페이드로 몸이 숨은 경우는 예전대로 제외되는가');
{
  const d = buildScene();
  d.root.children.find(o=>o.name==='body').visible = false;
  const box = measureHeadBoxNoParts(d.root, null, d.seat);
  console.log((box.isEmpty() ? '  ✅' : '  ❌') + ' 숨은 메쉬 제외 규칙 유지(빈 박스)');
  if(!box.isEmpty()) fail++;
}

console.log('[회귀] 장식 메쉬가 없는 캐릭터는 값이 그대로인가');
{
  const e = buildScene(); e.root.children = e.root.children.filter(o=>o.name!=='hat');
  const plain = { hatMesh:null, maskMesh:null, glassesMesh:null, wingMesh:null };
  check('모자 없는 캐릭터', measureHeadBoxNoParts(e.root, null, plain).max.y, 4.00);
  check('meshHost 미전달과 동일', measureHeadBoxNoParts(e.root).max.y, 4.00);
}

console.log(fail ? '\n❌ 실패 ' + fail + '건' : '\n✅ 전부 통과');
process.exit(fail ? 1 : 0);
