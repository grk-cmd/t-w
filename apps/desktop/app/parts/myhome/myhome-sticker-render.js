/* myhome-sticker-render.js — 🎨 마이홈 스티커 그리기(앱 FSD · app.js 분리 M19)
   app.js 의 renderMyHomeStickers 를 글 그대로 옮긴 모듈이다. 동작은 옛 자리와 같다.
   ・책임: renderMyHomeStickers — 마이홈 탭에서만 스티커 영역을 보이고, 데이터 순서(z)대로 스티커 요소(이미지 · 이모지 · 애니 · 크기 · 회전 · 편집 핸들)를 다시 그린다.
   ・내놓는 것: renderMyHomeStickers. × 로 지우기는 상태 주인 myhomeStore.removeSticker 가 하고 저장도 그쪽이 한다(편집 묶음이 그린 뒤에 덧붙이는 일 없음).
   검사: checks/sim-myhome-sticker-render.js */
(function(){

function createMyHomeStickerRender(deps){
const mhPageMod = deps.mhPageMod;
const mhStLayoutMod = deps.mhStLayoutMod;
const myHomeSticker = deps.myHomeSticker;   // 읽는 함수
const myhomeStore = deps.myhomeStore;   // 🏠 마이홈 상태 주인 — 스티커 지우기 · 저장
const stickerLayer = deps.stickerLayer;   // 🎨 스티커 보이기(shared/device-toggle.js) — 이 PC 설정
function renderMyHomeStickers(){
  const zone=document.getElementById('mhStickerZone'); if(!zone) return;
  // 스티커는 '마이홈' 탭에서만 표시 — 친구/스케줄러/버그제보 탭에서는 감춤
  //   (예전엔 친구 탭만 숨겼는데, 스케줄러 탭에도 스티커가 따라오던 문제 수정)
  const activeTab = document.querySelector('#myHomeTabs .mh-tab.on');
  const onHomeTab = activeTab && activeTab.dataset.tab === 'home';
  const layerOn = stickerLayer.on();   // 설정 › 디스플레이 «마이홈 스티커» — 꺼져 있으면 그리지 않는다(그림도 받지 않게 비운다)
  zone.classList.toggle('hidden', !onHomeTab || !layerOn);
  if(!layerOn) zone.innerHTML='';
  if(!onHomeTab || !layerOn){ mhStLayoutMod._mhFitWindowSafe(); myHomeSticker().editEnd(); return; }

  const data = mhStLayoutMod._mhStickersData();
  const canEdit = mhStLayoutMod._mhCanEditStickers();
  zone.innerHTML='';
  TwMyHomeStickerRules.orderedIds(data).forEach(sid=>{   // 🎨 z 순서대로(뒤 → 앞) — 관리 창 ▲▼
    const s=data[sid];
    const el=document.createElement('div'); el.className='mh-sticker';
    if(canEdit && TwMyHomeStickerRules.isLocked(s)) el.classList.add('locked');   // 🔒 끌리지 않음 표시
    const stSrc = s.img && TwSafeHtml.safeUrl(s.img, 'image');   // 친구 홈 구경에서는 남의 스티커 — 허용된 그림 주소만
    if(s.img){ const im=document.createElement('img'); if(stSrc) im.src=stSrc; im.draggable=false; el.appendChild(im); }
    else {
      // ✨ 이모지도 애니메이션을 걸려면 안쪽 요소가 필요하다(바깥 div는 크기·회전이 이미 쓰고 있음).
      const sp=document.createElement('span'); sp.className='st-emoji'; sp.textContent=s.emoji||'⭐';
      el.appendChild(sp); el.classList.add('emoji');
    }
    if(s.anim) el.classList.add('a-'+s.anim);
    if(s.animSpeed) el.classList.add('spd-'+s.animSpeed);
    el.style.left=(s.x||0)+'px'; el.style.top=(s.y||0)+'px'; el.dataset.sid=sid;
    // 새 스티커는 원본 비율(w/h)을 가짐. 옛 스티커는 w/h가 없으므로 CSS 기본(40×40 정사각) 유지.
    if(s.w && s.h){
      const baseW = Math.min(s.w, mhStLayoutMod.STICKER_BASE * 2.2);   // 화면상 기본 표시 폭(size=1일 때)
      el.style.width  = baseW + 'px';
      el.style.height = Math.round(baseW * (s.h / s.w)) + 'px';
    }
    const alpha = (typeof s.alpha==='number') ? Math.max(0, Math.min(1, s.alpha)) : 1;
    const tf = mhStLayoutMod._mhStickerTransform(s);
    if(tf) el.style.transform = tf;
    if(alpha !== 1) el.style.opacity = String(alpha);

    if(sid === mhStLayoutMod._mhStickerEditSid() && canEdit) el.classList.add('editing');

    if(s.link) el.title = canEdit ? (s.link + '  (우클릭: 편집)') : s.link;   // 주소든 글이든 마우스를 올리면 보인다
    else if(canEdit) el.title = '우클릭: 편집';
    if(TwMyHomeStickerRules.isLinkUrl(s.link)){   // 누르면 여는 건 주소일 때만 — 글만 든 링크는 열기에 넘기지 않는다
      el.classList.add('linked');
      el.addEventListener('click', e=>{
        if(e.target.classList.contains('mh-sticker-del')) return;
        if(e.target.classList.contains('mh-sticker-anim')) return;
        if(el.classList.contains('editing')) return;      // 편집 중엔 링크 안 엶
        if(mhPageMod._mhStickerDragDist()>5) return;                  // 방금 드래그했으면 링크 안 엶
        if(window.companion && companion.openBrowser) companion.openBrowser(s.link);
        else window.open(s.link, '_blank');
      });
    }

    // 우클릭 → 편집모드 진입 (본인만)
    el.addEventListener('contextmenu', e=>{
      e.preventDefault(); e.stopPropagation();
      if(!canEdit) return;
      myHomeSticker().editStart(sid);
    });

    if(canEdit){
      // 삭제 버튼 (편집모드에서만 보임)
      const del=document.createElement('div'); del.className='mh-sticker-del'; del.textContent='×';
      del.onclick=e=>{
        e.stopPropagation();
        myHomeSticker().editEnd();
        myhomeStore.removeSticker(sid);   // 지우면 바로 그려지고(store 가 알림) 저장은 store 가 한다
        renderMyHomeStickers();
      };
      el.appendChild(del);

      // ✨ 움직임 버튼 — 삭제(×) 옆. 더블클릭은 드래그 처리와 겹쳐 안 잡혀서 버튼 방식으로.
      const anim=document.createElement('div'); anim.className='mh-sticker-anim'; anim.textContent='✨';
      anim.title='움직임 고르기';
      anim.onclick=e=>{ e.stopPropagation(); mhStLayoutMod._mhOpenStickerAnim(sid); };
      el.appendChild(anim);

      // 크기 조절 핸들 (편집모드에서만 보임)
      const handle=document.createElement('div'); handle.className='mh-sticker-handle';
      myHomeSticker().bindResize(handle, sid);
      el.appendChild(handle);

      // 회전 핸들 + 각도 라벨 + 회전 초기화 버튼
      const rotLbl=document.createElement('div'); rotLbl.className='mh-sticker-rotlbl';
      rotLbl.textContent = Math.round(s.rot||0) + '°';
      el.appendChild(rotLbl);

      const rot=document.createElement('div'); rot.className='mh-sticker-rot';
      rot.title='드래그해서 회전 (3° 단위)';
      myHomeSticker().bindRotate(rot, sid, rotLbl);
      el.appendChild(rot);

      // 드래그로 이동 (편집모드에서만)
      myHomeSticker().bindDrag(el, sid);
    }
    zone.appendChild(el);
  });
  mhStLayoutMod._mhFitWindowSafe();   // 🎨 런처 마이홈이면 창 밖으로 나간 스티커만큼 창을 넓힌다
}

return {
  renderMyHomeStickers,
};
}

const api = { createMyHomeStickerRender };
if(typeof window !== 'undefined') window.TwMyHomeStickerRender = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
