/* desk-items.js — 🧸 책상 위 아이템 등록부 — 커스텀 아이템을 customItems 에 등록 · 기본 아이템과 합친 목록
   책임: 카탈로그 · 코드로 받은 아이템 GLB 를 세션 등록부(customItems)에 올리고(registerCustomItem — 인자로 안 온 메타는 같은 id 의 저장 레코드에서), 기본 내장 아이템(DESK_ITEMS)과 합친 목록을 준다(allDeskItems · deskItemDef — 같은 id 면 커스텀이 이긴다).
   받는 deps: customItems(읽는 함수 — 생성기가 비울 때 다시 대입) · commissionMod(저장 레코드) · DESK_ITEMS · _applyItemMatTone.
   내보내는 것: registerCustomItem · allDeskItems · deskItemDef.
   app.js «🪑 책상 · 아이템 등록 · 책상 모양 바꾸기 · 크기» 구역의 앞쪽(아이템 등록 몫)을 그대로 옮겼다(구역 떼기 C · w2). 동작은 옮기기 전과 같다.
   ⚠️ loadSavedItemsIntoSession 은 app.js 에 남겼다 — 부팅 초반(이 모듈을 만드는 줄보다 앞)에서 바로 부른다.
   ★ 아래 코드는 app.js 에 있던 글 그대로다(들여쓰기도 · 옛 이야기형 주석만 «왜 · 함정» 으로 줄였다). 바뀐 코드 줄은 2줄 —
     customItems 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 1개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: allDeskItems · deskItemDef · registerCustomItem — app.js 는 deskItemsMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwDeskItems — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-desk-items.js */
(function(){

function createDeskItems(deps){
const DESK_ITEMS = deps.DESK_ITEMS;
const _applyItemMatTone = deps._applyItemMatTone;
const commissionMod = deps.commissionMod;
const customItems = deps.customItems;   // 읽는 함수
/* 인자로 안 온 메타값(크기 · 부착 위치 · 재생 모드 · 빛 · 라이선스 · 아이콘)은 같은 id 의 저장 레코드(savedItems)에서 채운다.
   ⚠️ 좌석 · 런처 · 생성기 경로는 크기 없이 등록해서, 부팅 직후 순서가 뒤집히면 0.8 로 굳어 아이템이 작아졌다. 인자로 온 값이 우선이다. */
function _savedItemMeta(id){
  try{ return Array.isArray(commissionMod.savedItems()) ? (commissionMod.savedItems().find(r=>r && r.id === id) || null) : null; }
  catch(_){ return null; }   // savedItems 선언(let) 전에 불리는 경우
}
function registerCustomItem(id,name,glbB64,template,icon,animations,attachTo,autoPlay,defaultSize,glow,licenseOnly,playMode){
  { const _m = _savedItemMeta(id);
    if(_m){
      if(attachTo == null)    attachTo = _m.attachTo;
      if(autoPlay == null)    autoPlay = _m.autoPlay;
      if(defaultSize == null) defaultSize = _m.defaultSize;
      if(glow == null)        glow = _m.glow;
      if(licenseOnly == null) licenseOnly = _m.licenseOnly;
      if(playMode == null)    playMode = _m.playMode;
      if(!icon && _m.icon)    icon = _m.icon;
    } }
  customItems()[id]={id,name,glb:glbB64,custom:true,icon:icon||'',
  attachTo: attachTo||'desk',   // 'desk'(기본, 책상 위) | 'handL' | 'handR' — equipDeskItem에서 부착 위치 결정에 사용
  autoPlay: !!autoPlay,   // true면 클릭 없이 장착되자마자 애니메이션 자동 반복재생 (하위호환용)
  playMode: playMode || (autoPlay ? 'auto' : 'click'),   // 어플 8: 'click' | 'auto' | 'idle'
  defaultSize: (defaultSize!=null) ? defaultSize : 0.8,   // 장착됐을 때 기본 크기 — 관리자가 등록 시 설정(기본 0.8)
  glow: !!glow,   // true면 옆에 은은한 원형 빛 스프라이트 추가
  licenseOnly: !!licenseOnly,   // true면 라이선스 보유자(isPremium)나 관리자만 장착 가능
  animations: animations||[],
  // ⚠️ 본이 있는 모델은 clone(true) 로 복제하면 스켈레톤 연결이 깨진다 — SkeletonUtils.clone 을 쓴다.
  build:()=>{const c=(THREE.SkeletonUtils&&THREE.SkeletonUtils.clone)?THREE.SkeletonUtils.clone(template):template.clone(true);
    c.traverse(n=>{ if(n.isMesh){ n.castShadow=true;
      // ⚠️ clone 은 머티리얼을 공유한다 — 안 나누면 한 좌석에서 _col 색을 바꿀 때 친구 좌석 아이템도 같이 바뀐다.
      if(n.material){
        if(Array.isArray(n.material)){
          n.material = n.material.map(m => (m && m.clone) ? m.clone() : m);
        } else if(n.material.clone){
          n.material = n.material.clone();
        }
      }
      // 금속도(glTF 기본 1.0) · emissive 정규화는 _applyItemMatTone 한 곳 — 캐릭터 · 파츠 · 책상과 같은 톤.
      if(n.material){
        const mats=Array.isArray(n.material)?n.material:[n.material];
        //   캐릭터·파츠·책상과 같은 톤 기준으로 정규화 — GLB 가 담아 온 emissive 와 금속도를 덮어쓴다.
        mats.forEach(m=>_applyItemMatTone(m));
      }
    }});
    return c;}}; }
function allDeskItems(){
  // customItems를 먼저 배치해서 .find(id)가 커스텀을 먼저 찾게 함 — 관리자가 기본 아이템(plant/cup/books)과
  // 같은 id로 카탈로그에 등록하면(우클릭 수정), 기본 대신 그 커스텀 GLB가 실제로 쓰이게 됨(진짜 "교체").
  const custom=Object.values(customItems());
  const overridden=new Set(custom.map(c=>c.id));
  return custom.concat(DESK_ITEMS.filter(d=>!overridden.has(d.id)));
}
function deskItemDef(id){ return allDeskItems().find(d=>d.id===id)||null; }

return {
  allDeskItems,
  deskItemDef,
  registerCustomItem,
};
}

const api = { createDeskItems };
if(typeof window !== 'undefined') window.TwDeskItems = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
