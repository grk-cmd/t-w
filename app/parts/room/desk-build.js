/* desk-build.js — 🪑 기본 책상 · 화분 · 컵 · 책 · 대신 몸(placeholder) 만들기와 그 재질(앱 FSD · app.js 분리 M3)
   app.js SETUP · BUILDERS 구역의 «물건 만들기» 를 글 그대로 옮긴 모듈이다. 동작은 옮기기 전과 같다. 만들기만 한다 — 좌석에 올리기 · 저장은 app.js · desk-*.js.
   ・책임: 재질 헬퍼 M(color, roughness, metalness)과 이름 붙은 재질 아홉 · 기본 책상(buildDesk(plain)) · 책상 위 소품 셋(DESK_ITEMS) · 3D 몸을 못 불러왔을 때 쓰는 대신 몸(buildPlaceholder).
   ・받는 deps: 없음(THREE 는 전역 — app.js 앞에 싣는 classic script).
   ・내놓는 것: M · matWood · matWoodD · DESK_ITEMS · DEFAULT_DESK_OVERRIDE_ID · NO_DESK_ID · buildDesk · buildPlaceholder — app.js 가 같은 이름 const 로 받는다(옛 전역 이름).
   ⚠️ DEFAULT_DESK_OVERRIDE_ID · NO_DESK_ID 는 저장된 값(deskCatalogId)이라 글자를 바꾸지 말 것 — 옛 앱 · 방 서버가 그대로 받는다.
   검사: checks/sim-desk-build.js */
(function(){

function createDeskBuild(deps){
const M=(c,r=0.85,m=0)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m});
const matSage=M(0x9dba8a,0.8),matSageD=M(0x84a172,0.8),matInk=M(0x4a3f35,0.6),matWhite=M(0xfdfaf2,0.7),
      matWood=M(0xc9a57b,0.85),matWoodD=M(0xb08a5e,0.85),matPot=M(0xd98e73,0.8),matLeaf=M(0x88b06f,0.7),matBlush=M(0xe89b9b,0.6);

const TORSO_Y=0.46;
function buildDeskPlant(){ const g=new THREE.Group();
  const pot=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.075,0.13,16),matPot); pot.position.y=0.065; pot.castShadow=true; g.add(pot);
  for(let i=0;i<3;i++){const lf=new THREE.Mesh(new THREE.SphereGeometry(0.07,12,12),matLeaf);
    lf.scale.set(0.7,1.4,0.7); lf.position.set(Math.cos(i/3*6.28)*0.04,0.18,Math.sin(i/3*6.28)*0.04);
    lf.rotation.z=(i-1)*0.3; lf.castShadow=true; g.add(lf);} return g; }
function buildCup(){ const g=new THREE.Group();
  const cup=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.05,0.11,18),matPot); cup.position.y=0.055; cup.castShadow=true; g.add(cup);
  const h=new THREE.Mesh(new THREE.TorusGeometry(0.035,0.013,8,16),matPot); h.position.set(0.07,0.06,0); h.rotation.y=Math.PI/2; g.add(h); return g; }
function buildBooks(){ const g=new THREE.Group(); const cols=[matSage,matBlush,matWoodD];
  for(let i=0;i<3;i++){ const b=new THREE.Mesh(new THREE.BoxGeometry(0.22-i*0.02,0.04,0.16),cols[i%cols.length]);
    b.position.set(0,0.02+i*0.045,0); b.rotation.y=(i-1)*0.12; b.castShadow=true; g.add(b);} return g; }
const DESK_ITEMS=[{id:'plant',name:'화분',build:buildDeskPlant},{id:'cup',name:'머그컵',build:buildCup},{id:'books',name:'책',build:buildBooks}];
const DEFAULT_DESK_OVERRIDE_ID='__default_desk__';   // 관리자가 "기본 책상"을 우클릭해서 등록하면 이 예약 ID로 저장됨
const NO_DESK_ID='__no_desk__';   // 🚫 «책상 없음» — deskCatalogId 에 넣는다(새 칸이 아니라 옛 앱 · 방 서버가 그대로 받는다)
function buildDesk(plain){
  const desk=new THREE.Group(); const deskTopY=0.46,deskZ=0.50;
  const topM=new THREE.Mesh(new THREE.BoxGeometry(1.7,0.08,0.6),matWood);
  topM.position.set(0,deskTopY-0.04,deskZ); topM.castShadow=topM.receiveShadow=true; topM.name='deskTop'; desk.add(topM);
  [[-0.72,0.32],[0.72,0.32],[-0.72,0.88],[0.72,0.88]].forEach(([x,z])=>{
    const leg=new THREE.Mesh(new THREE.BoxGeometry(0.09,deskTopY-0.04,0.09),matWoodD);
    leg.position.set(x,(deskTopY-0.04)/2,z); leg.castShadow=true; desk.add(leg);});
  if(!plain){ const prop=buildDeskPlant(); prop.position.set(0.5,deskTopY,deskZ-0.06); desk.add(prop); }
  const anchor=new THREE.Group(); anchor.position.set(0,deskTopY,deskZ); anchor.name='deskAnchor'; desk.add(anchor);
  desk.userData.deskAnchor=anchor; return desk;
}

function buildPlaceholder(){
  const root=new THREE.Group();
  const torso=new THREE.Group(); torso.position.y=TORSO_Y; root.add(torso);
  const body=new THREE.Mesh(new THREE.SphereGeometry(0.42,32,32),matSage); body.scale.set(1,1.1,0.9); body.castShadow=true; torso.add(body);
  const head=new THREE.Group(); head.position.set(0,0.62,0); torso.add(head);
  const hm=new THREE.Mesh(new THREE.SphereGeometry(0.4,32,32),matSage); hm.castShadow=true; head.add(hm);
  function eye(x){const g=new THREE.Group();
    const w=new THREE.Mesh(new THREE.SphereGeometry(0.085,16,16),matWhite); w.scale.set(1,1.15,0.6);
    const p=new THREE.Mesh(new THREE.SphereGeometry(0.05,16,16),matInk); p.position.z=0.05; p.scale.set(1,1.1,0.6);
    g.add(w);g.add(p); g.position.set(x,0.05,0.34); return g;}
  const eyeL=eye(-0.15),eyeR=eye(0.15); head.add(eyeL);head.add(eyeR);
  function cheek(x){const c=new THREE.Mesh(new THREE.SphereGeometry(0.055,16,16),matBlush); c.scale.set(1.3,0.8,0.4); c.position.set(x,-0.08,0.33); return c;}
  head.add(cheek(-0.22));head.add(cheek(0.22));
  const mouth=new THREE.Mesh(new THREE.SphereGeometry(0.03,12,12),matInk); mouth.scale.set(1.6,0.7,0.5); mouth.position.set(0,-0.12,0.37); head.add(mouth);
  [[-0.16,-0.4],[0.16,0.4]].forEach(([x,rot])=>{const l=new THREE.Mesh(new THREE.SphereGeometry(0.09,16,16),matSageD);
    l.scale.set(0.6,1.3,0.5); l.position.set(x,0.4,0); l.rotation.z=rot; l.castShadow=true; head.add(l);});
  function arm(x){const a=new THREE.Mesh(new THREE.SphereGeometry(0.13,16,16),matSage); a.scale.set(0.7,0.7,1.1); a.position.set(x,0.10,0.22); a.castShadow=true; return a;}
  const armL=arm(-0.38),armR=arm(0.38); torso.add(armL);torso.add(armR);
  return {root,torso,head,eyeL,eyeR,armL,armR};
}

return {
  M,
  matWood,
  matWoodD,
  DESK_ITEMS,
  DEFAULT_DESK_OVERRIDE_ID,
  NO_DESK_ID,
  buildDesk,
  buildPlaceholder,
};
}

const api = { createDeskBuild };
if(typeof window !== 'undefined') window.TwDeskBuild = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
