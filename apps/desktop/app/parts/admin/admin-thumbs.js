/* admin-thumbs.js — 🖼️ 관리자 콘솔 — 파츠 썸네일 한꺼번에 다시 굽기(generateAllPartThumbnails)
   책임: F12 콘솔 함수 window.generateAllPartThumbnails(force) 하나 — 카탈로그 파츠 썸네일을 굽고(partSceneMod) 서버 카탈로그에 올린다(관리자만).
   받는 deps: partSceneMod(굽기) · catalogAdmin(올리기 — admin/catalog-admin-api.js) · premiumMod · wardrobeMod · gachaMod · isAdmin · toast.
   내보내는 것: 없음 — 만들 때 window 에 건다.
   app.js «🧊 파츠 GLB 파싱 캐시 · 썸네일» 구역 끝의 관리자 콘솔 함수를 그대로 옮겼다(구역 떼기 C · w2). 관리자 코드는 app/parts/admin/ 에 모은다 — 굽기 모듈(part-scene.js)이 관리자 등록 모듈을 부르면 서로 부르는 순환이 생긴다.
   ★ 아래 코드는 app.js 에 있던 글 그대로다(들여쓰기도 · 옛 이야기형 주석만 «왜 · 함정» 으로 줄였다). 바뀐 코드 줄은 2줄 —
     gachaMod · isAdmin 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 1개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: 없음 — 만들 때 건다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwAdminThumbs — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-admin-thumbs.js */
(function(){

function createAdminThumbs(deps){
const catalogAdmin = deps.catalogAdmin;   // 카탈로그 쓰기 서버 길(admin/catalog-admin-api.js)
const gachaMod = deps.gachaMod;   // 읽는 함수
const isAdmin = deps.isAdmin;   // 읽는 함수
const partSceneMod = deps.partSceneMod;
const premiumMod = deps.premiumMod;
const toast = deps.toast;
const wardrobeMod = deps.wardrobeMod;
// 관리자 콘솔(F12): generateAllPartThumbnails() 는 썸네일 없는 카탈로그 파츠만, (true) 는 있는 것도 다시 굽고 올린다.
window.generateAllPartThumbnails = async function(force){
  if(!isAdmin()){ console.warn('관리자만 실행 가능'); return; }
  const targets = premiumMod.savedParts().filter(p=>p.fromCatalog && (force || (!p.thumbnail && !p.thumbUrl)));
  console.log('썸네일 ' + (force ? '재생성(force)' : '생성') + ' 대상:', targets.length, '개');
  let ok=0, fail=0;
  for(const rec of targets){
    try{
      const thumb = await partSceneMod.generatePartThumbnail(rec);
      if(thumb){
        /* 구운 그림만 바꾸고 나머지 칸은 서버에서 받은 그대로 되돌려 쓴다(PUT 은 물건 전체 교체). 끝에서 한 번만 다시 받는다 */
        await catalogAdmin.savePart(rec.id, TwCatalogAdminApi.partFieldsOf(rec, { thumbPng: TwImageBytes.parseDataUrl(thumb).bytes }), { quiet: true });
        ok++;
        console.log('✓', rec.name, '('+(ok+fail)+'/'+targets.length+')');
      } else { fail++; }
    }catch(e){ fail++; console.warn('실패:', rec.name, e); }
  }
  await catalogAdmin.reload();   // 새 썸네일 주소가 든 서버 한 벌 — 목록 · 꾸미기 창이 이어서 다시 그려진다
  wardrobeMod.renderWardrobe();
  gachaMod().renderGachaInv();   // 🎰 보관함이 열려 있으면 카드도 같이 갱신
  console.log('완료: 성공', ok, '/ 실패', fail);
  toast('썸네일 생성 완료: '+ok+'개');
};

return {

};
}

const api = { createAdminThumbs };
if(typeof window !== 'undefined') window.TwAdminThumbs = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
