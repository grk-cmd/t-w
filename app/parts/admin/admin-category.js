/* admin-category.js — 📁 꾸미기 카테고리 관리 (관리자 — 기본 이름 바꾸기 · 되돌리기 · 커스텀 추가 · 삭제)
   app.js 의 «관리자 카테고리 관리» 앞쪽(카테고리 몫)을 그대로 옮긴 관리자 모듈이다(관리자 코드 admin 폴더 3번). 동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다. 바뀐 줄은 넷 — PART_GROUPS · PART_CATS · partCatOverrides 를 읽는 함수로.
     PART_GROUPS 는 이 모듈을 만드는 줄보다 뒤에 선언되는 const 이고, PART_CATS · partCatOverrides 는 카탈로그 구독이 다시 대입하는 let 이라
     값이 아니라 읽는 함수로 받는다.
   ★ 밖에서 부르는 이름은 renderCategoryManager 하나 — 🔄 카탈로그 동기화가 커스텀 카테고리 · 이름 덮어쓰기를 받을 때 다시 그린다
     (app.js 가 adminCategory.renderCategoryManager 로 부른다).
   검사: checks/sim-admin-license.js(관리자 3번 셋을 같이 본다)
   ⚠️ document · window · firebaseAPI · confirm · navigator 는 예전처럼 전역 이름으로 쓴다(이 파일은 app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwAdminCategory — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103). */
(function(){

function createAdminCategory(deps){
const toast = deps.toast;
const asyncPrompt = deps.asyncPrompt;
const PART_GROUPS = deps.partGroups;           // 읽는 함수 — 그룹 목록(app.js 가 뒤에서 선언하는 const)
const PART_CATS = deps.partCats;               // 읽는 함수 — 기본 + 커스텀 카테고리(카탈로그 구독이 다시 대입)
const partCatOverrides = deps.partCatOverrides; // 읽는 함수 — 기본 카테고리 이름 덮어쓰기(카탈로그 구독이 다시 대입)
let _cmAddingGroup = null;   // 지금 [+ 추가] 폼이 열려있는 그룹
function openCategoryManage(){
  const o=document.getElementById('categoryManageOverlay'); if(!o) return;
  o.classList.add('on'); o.style.display='flex';
  renderCategoryManager();
}
function closeCategoryManage(){
  const o=document.getElementById('categoryManageOverlay'); if(!o) return;
  o.classList.remove('on'); o.style.display='none';
  _cmAddingGroup = null;
  const form=document.getElementById('cmAddForm'); if(form) form.style.display='none';
}
function renderCategoryManager(){
  const listEl=document.getElementById('cmGroupList'); if(!listEl) return;
  listEl.innerHTML='';
  PART_GROUPS().forEach(g=>{
    const catsInGroup = PART_CATS().filter(c=>c.group===g.group && !c.animalOnly);   // 🐾 동물 전용 카테고리는 인간 꾸미기 창에 절대 노출 안 함(등록도 동물 생성기 안에서)
    const sec=document.createElement('div'); sec.style.cssText='margin-bottom:14px;';
    // 그룹 헤더
    const head=document.createElement('div');
    head.style.cssText='font-size:11px;font-weight:bold;color:#333;margin-bottom:6px;padding-bottom:3px;border-bottom:1px solid #a0a0a0;display:flex;justify-content:space-between;';
    head.innerHTML='<span>'+g.icon+' '+g.label+'</span><span style="color:#666;font-weight:normal;font-size:10px;">'+catsInGroup.length+'개 카테고리</span>';
    sec.appendChild(head);
    // 카테고리 목록
    const catRow=document.createElement('div');
    catRow.style.cssText='display:flex;flex-wrap:wrap;gap:4px;';
    catsInGroup.forEach(c=>{
      const chip=document.createElement('div');
      const isBuiltin = c.builtin;
      chip.style.cssText='display:inline-flex;align-items:center;gap:3px;padding:4px 8px;font-size:11px;color:#333;border:1px solid #a0a0a0;'
        + (isBuiltin ? 'background:#d4d0c8;' : 'background:#fff4d0;border-color:#d4a020;');
      chip.innerHTML = c.icon+' '+c.label + (isBuiltin ? ' <span style="font-size:9px;color:#666;">기본</span>' : '');
      if(isBuiltin){
        // ✎ 기본 카테고리 이름/아이콘 수정 — cat 식별자와 동작(부착 본·숨김 규칙)은 그대로 두고 표시 이름만 바꿈.
        //   모든 사용자에게 반영됨(catalog/catOverrides).
        const ed=document.createElement('span');
        ed.style.cssText='color:#2a6ea0;cursor:pointer;margin-left:4px;font-weight:bold;';
        ed.textContent='✎';
        ed.title='이름 바꾸기 (예: 망토 → 겉옷)';
        ed.onclick=async ()=>{
          const cur = c.label;
          const name = await asyncPrompt({ title:'카테고리 이름 바꾸기', message:'새 이름을 입력하세요 (예: 겉옷)', defaultValue:cur, maxLength:20 });
          if(name===null) return;
          const nm = String(name).trim();
          if(!nm){ toast('이름을 입력해주세요'); return; }
          const ic = await asyncPrompt({ title:'카테고리 아이콘', message:'아이콘 이모지 (비우면 기존 아이콘 유지)', defaultValue:c.icon||'', maxLength:8 });
          if(!window.firebaseAPI || !window.firebaseAPI.publishCatOverride){ toast('네트워크 연결을 확인해주세요'); return; }
          try{
            const payload = { label: nm };
            const icv = (ic==null) ? '' : String(ic).trim();
            if(icv) payload.icon = icv;
            await window.firebaseAPI.publishCatOverride(c.cat, payload);
            toast('"'+nm+'"(으)로 바꿨어요');
          }catch(_){ toast('변경 실패'); }
        };
        chip.appendChild(ed);
        // ↺ 기본 이름으로 되돌리기 — 덮어쓴 적 있을 때만
        if(partCatOverrides() && partCatOverrides()[c.cat]){
          const rs=document.createElement('span');
          rs.style.cssText='color:#666;cursor:pointer;margin-left:3px;font-weight:bold;';
          rs.textContent='↺';
          rs.title='원래 이름으로 되돌리기';
          rs.onclick=async ()=>{
            if(!window.firebaseAPI || !window.firebaseAPI.unpublishCatOverride){ toast('네트워크 연결을 확인해주세요'); return; }
            try{ await window.firebaseAPI.unpublishCatOverride(c.cat); toast('원래 이름으로 되돌렸어요'); }
            catch(_){ toast('되돌리기 실패'); }
          };
          chip.appendChild(rs);
        }
      }
      if(!isBuiltin){
        const del=document.createElement('span');
        del.style.cssText='color:#c04040;cursor:pointer;margin-left:4px;font-weight:bold;';
        del.textContent='✕';
        del.title='이 카테고리 삭제 (파츠 데이터는 유지)';
        del.onclick=async ()=>{
          if(!confirm('"'+c.label+'" 카테고리를 삭제할까요?\n(파츠 데이터는 유지되지만 카테고리가 사라지면 파츠가 안 보여요)')){ window.focus(); return; } window.focus();
          if(!window.firebaseAPI || !window.firebaseAPI.unpublishCustomCat){ toast('네트워크 연결을 확인해주세요'); return; }
          try{ await window.firebaseAPI.unpublishCustomCat(c.cat); toast('삭제했어요'); }
          catch(_){ toast('삭제 실패'); }
        };
        chip.appendChild(del);
      }
      catRow.appendChild(chip);
    });
    // + 추가 버튼
    const addBtn=document.createElement('div');
    addBtn.style.cssText='display:inline-flex;align-items:center;padding:4px 8px;font-size:11px;color:#666;background:#fff;border:1.5px dashed #808080;cursor:pointer;';
    addBtn.textContent='＋ 추가';
    addBtn.onclick=()=>{
      _cmAddingGroup = g.group;
      const lbl=document.getElementById('cmAddGroupLbl');
      if(lbl) lbl.textContent = '('+g.label+' 그룹)';
      document.getElementById('cmAddName').value='';
      document.getElementById('cmAddIcon').value='';
      document.getElementById('cmAddId').value='';
      // 그룹별로 기본 bone 자동 선택
      const boneSel=document.getElementById('cmAddBone');
      const defaultBone = { head:'head', cloth:'spine', deco:'spine', hand:'handR' }[g.group] || 'head';
      if(boneSel) boneSel.value = defaultBone;
      const form=document.getElementById('cmAddForm');
      if(form) form.style.display='block';
      setTimeout(()=>document.getElementById('cmAddName').focus(), 30);
    };
    catRow.appendChild(addBtn);
    sec.appendChild(catRow);
    listEl.appendChild(sec);
  });
}
// 이벤트 바인딩
document.getElementById('lcCategoryManage').onclick=openCategoryManage;
// 꾸미기 창 하단의 카테고리 관리 버튼 (관리자 전용)
{ const wcm=document.getElementById('wardrobeCategoryManageBtn'); if(wcm) wcm.onclick=openCategoryManage; }
document.getElementById('cmCloseX').onclick=closeCategoryManage;
document.getElementById('cmAddCancelBtn').onclick=()=>{
  const form=document.getElementById('cmAddForm'); if(form) form.style.display='none';
  _cmAddingGroup = null;
};
document.getElementById('cmAddGoBtn').onclick=async ()=>{
  if(!_cmAddingGroup){ toast('그룹이 선택되지 않았어요'); return; }
  const name=document.getElementById('cmAddName').value.trim();
  const icon=document.getElementById('cmAddIcon').value.trim();
  const catId=document.getElementById('cmAddId').value.trim().toLowerCase().replace(/[^a-z0-9_]/g,'');
  const bone=document.getElementById('cmAddBone').value;
  if(!name || !catId){ toast('이름과 ID를 입력해주세요'); return; }
  if(!/^[a-z][a-z0-9_]*$/.test(catId)){ toast('ID는 영문 소문자로 시작하고 영문/숫자/언더스코어만 사용 가능해요'); return; }
  // 기존 카테고리와 ID 겹침 방지
  if(PART_CATS().find(c=>c.cat===catId)){ toast('이미 있는 ID예요 — 다른 ID를 써주세요'); return; }
  if(!window.firebaseAPI || !window.firebaseAPI.publishCustomCat){ toast('네트워크 연결을 확인해주세요'); return; }
  try{
    await window.firebaseAPI.publishCustomCat(catId, { cat:catId, label:name, icon:icon||'🏷️', group:_cmAddingGroup, bone });
    toast('"'+name+'" 카테고리를 추가했어요');
    const form=document.getElementById('cmAddForm'); if(form) form.style.display='none';
    _cmAddingGroup = null;
  }catch(e){ toast('추가 실패'); }
};

return { renderCategoryManager };   // 🔄 카탈로그 동기화가 카테고리를 받을 때 다시 그린다
}

const api = { createAdminCategory };
if(typeof window !== 'undefined') window.TwAdminCategory = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
