/* admin-license.js — 🎟️ 라이선스 키 발급 · 키 목록(검색 · 회수 · 삭제) · 대기 요청(발급 · 거절 · 일괄) · 친구코드로 발급 (관리자)
   app.js 의 «🛠️ 라이선스 발급 · 공지 · 업데이트 안내(관리자)» 앞머리와 «관리자 카테고리 관리» 뒤쪽의 라이선스 몫을 그대로 옮긴
   관리자 모듈이다(관리자 코드 admin 폴더 3번 — docs/APP_FSD_MAP.md). 동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(두 덩이를 원래 차례대로 이었다 · 들여쓰기도 그대로).
   ★ app.js 함수 넷(toast · _chatEsc · _genLicenseKey · _saveFailMsg)은 app.js 가 화살표로 넘긴다.
   ★ 밖에서 부르는 이름은 renderLicenseGenList 하나 — 📄 엑셀 일괄 발급(admin-license-bulk.js)이 발급 뒤 목록을 다시 그릴 때
     app.js 가 adminLicense.renderLicenseGenList 로 잇는다. 버튼 연결은 전부 만들 때 건다.
   검사: checks/sim-admin-license.js
   ⚠️ document · window · firebaseAPI · confirm · navigator 는 예전처럼 전역 이름으로 쓴다(이 파일은 app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwAdminLicense — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103). */
(function(){

function createAdminLicense(deps){
const toast = deps.toast;
const _chatEsc = deps.chatEsc;                   // 남의 글(요청한 사람 이름) 씻기 — escHtml 별칭
const _genLicenseKey = deps.genLicenseKey;
const _saveFailMsg = deps.saveFailMsg;           // 서버 거부 / 인터넷 끊김 문구 가르기
/* --- 라이선스 키 발급 (관리자 전용) --- */
let _licenseAllCache = null;   // 검색 필터링 시 재조회 없이 캐시로 다시 그림
async function renderLicenseGenList(){
  const listEl=document.getElementById('licenseGenList');
  if(!listEl || !window.firebaseAPI) return;
  listEl.textContent='불러오는 중...';
  try{
    const all = await window.firebaseAPI.listLicenses();
    _licenseAllCache = all;
    _renderLicenseGenListFiltered();
  }catch(e){ listEl.textContent='목록을 불러오지 못했어요'; }
}
// ★ 검색어(닉네임/메모/키)로 필터해서 목록 표시 — 발급 키가 많아질 때 확인 편하게(요청사항)
function _renderLicenseGenListFiltered(){
  const listEl=document.getElementById('licenseGenList');
  if(!listEl || !_licenseAllCache) return;
  const q=(document.getElementById('licenseGenSearch')?.value||'').trim().toLowerCase();
  const all=_licenseAllCache;
  let keys = Object.keys(all);
  if(q){
    keys = keys.filter(k=>{
      const d=all[k]||{};
      return k.toLowerCase().includes(q) || String(d.note||'').toLowerCase().includes(q);
    });
  }
  if(!keys.length){ listEl.textContent = q ? '검색 결과가 없어요' : '아직 발급된 키가 없어요'; return; }
  listEl.innerHTML='';
  keys.reverse().forEach(k=>{
      const d=all[k];
      const row=document.createElement('div');
      row.style.cssText='padding:4px 0;border-bottom:1px solid rgba(201,165,123,.15);display:flex;justify-content:space-between;align-items:center;gap:6px;';
      const statusTxt = d.valid===false ? '🚫 회수됨' : (d.redeemedAt?'✅ 사용됨':'⬜ 미사용');
      const left=document.createElement('span');
      left.innerHTML = `<span style="font-family:'Courier New',monospace;">${k}</span>`;
      const right=document.createElement('span');
      right.style.cssText='text-align:right;flex-shrink:0;display:flex;align-items:center;gap:6px;';
      right.innerHTML = `<span>${statusTxt} ${d.note?('· '+d.note):''}</span>`;
      if(d.valid!==false){
        const revokeBtn=document.createElement('button');
        revokeBtn.textContent='회수'; revokeBtn.style.cssText='flex-shrink:0;padding:2px 8px;font-size:10.5px;cursor:pointer;color:var(--win-error);';
        revokeBtn.onclick=async ()=>{
          if(!confirm(k+' 키를 회수할까요? 이 키를 쓰던 사람은 다음 접속 시 라이선스가 풀려요.')){ window.focus(); return; } window.focus();
          revokeBtn.disabled=true; revokeBtn.textContent='회수 중...';
          try{ await window.firebaseAPI.revokeLicense(k); toast('회수했어요'); renderLicenseGenList(); }
          catch(e){ toast('회수 실패'); revokeBtn.disabled=false; revokeBtn.textContent='회수'; }
        };
        right.appendChild(revokeBtn);
      } else {
        const delBtn=document.createElement('button');
        delBtn.textContent='삭제'; delBtn.style.cssText='flex-shrink:0;padding:2px 8px;font-size:10.5px;cursor:pointer;color:var(--win-error);';
        delBtn.onclick=async ()=>{
          if(!confirm(k+' 키를 목록에서 완전히 삭제할까요? (되돌릴 수 없어요)')){ window.focus(); return; } window.focus();
          delBtn.disabled=true; delBtn.textContent='삭제 중...';
          try{ await window.firebaseAPI.deleteLicense(k); toast('삭제했어요'); renderLicenseGenList(); }
          catch(e){ toast('삭제 실패'); delBtn.disabled=false; delBtn.textContent='삭제'; }
        };
        right.appendChild(delBtn);
      }
      row.appendChild(left); row.appendChild(right);
      listEl.appendChild(row);
    });
}
document.getElementById('lcLicenseGen').onclick=()=>{
  const o=document.getElementById('licenseGenOverlay'); o.classList.add('on'); o.style.display='flex';
  if(typeof window._lxHideWin==='function') window._lxHideWin();   // 일괄 창만 보이던 채로 닫혔어도 발급 창부터 연다
  document.getElementById('licenseGenResult').style.display='none';
  document.getElementById('licenseGenNote').value='';
  renderLicenseGenList();
  subscribeLicenseReqList();
};

/* 대기 중인 라이선스 요청 목록 — 관리자 화면 열려있는 동안 실시간 갱신 */
let _licenseReqSubStarted=false;
let _licensePendingCache = [];   // 일괄 발급용 — 현재 대기중 요청 스냅샷
function subscribeLicenseReqList(){
  if(_licenseReqSubStarted || !window.firebaseAPI || !window.firebaseAPI.subscribeLicenseRequests) return;
  _licenseReqSubStarted=true;
  window.firebaseAPI.subscribeLicenseRequests(renderLicenseReqList);
}
function renderLicenseReqList(all){
  const listEl=document.getElementById('licenseReqList'); if(!listEl) return;
  const pending=Object.keys(all||{}).filter(id=>all[id].status==='pending');
  _licensePendingCache = pending.map(id=>({ id, name:(all[id].name||'') }));   // 일괄 발급용 캐시
  const bulkBtn=document.getElementById('licenseBulkBtn');
  if(bulkBtn) bulkBtn.style.display = pending.length>=2 ? 'inline-block' : 'none';   // 2건 이상일 때만 노출
  if(!pending.length){ listEl.textContent='대기 중인 요청이 없어요'; return; }
  listEl.innerHTML='';
  pending.forEach(id=>{
    const req=all[id];
    const row=document.createElement('div');
    row.style.cssText='padding:5px 0;border-bottom:1px solid rgba(201,165,123,.15);display:flex;justify-content:space-between;align-items:center;gap:6px;';
    /* 🛡️ `req.name` 은 `licenseRequests/$reqId`(`.write:true`)에서 온 **남의 문자열**이고
         여기는 관리자 화면이다. 이스케이프가 아예 없었다 — `_chatEsc` 로 막는다
         (지금 `_chatEsc` 는 공용 `escHtml` 의 별칭이다). */
    row.innerHTML = `<span>🙋 <b>${_chatEsc(req.name||'(이름 없음)')}</b></span>`;
    const btn=document.createElement('button');
    btn.textContent='발급'; btn.style.cssText='flex-shrink:0;padding:3px 10px;font-size:11px;cursor:pointer;';
    btn.onclick=async ()=>{
      btn.disabled=true; btn.textContent='발급 중...';
      try{
        const key=_genLicenseKey();
        await window.firebaseAPI.approveLicenseRequest(id, key, '요청: '+(req.name||''));
        toast(req.name+' 님에게 발급했어요');
        renderLicenseGenList();
      }catch(e){ toast('발급 실패'); btn.disabled=false; btn.textContent='발급'; }
    };
    const rejectBtn=document.createElement('button');
    rejectBtn.textContent='거절'; rejectBtn.style.cssText='flex-shrink:0;padding:3px 10px;font-size:11px;cursor:pointer;color:var(--win-error);';
    rejectBtn.onclick=async ()=>{
      if(!confirm(req.name+' 님의 요청을 거절할까요? (거절해도 상대는 다시 요청할 수 있어요)')){ window.focus(); return; } window.focus();
      rejectBtn.disabled=true; rejectBtn.textContent='거절 중...';
      try{ await window.firebaseAPI.rejectLicenseRequest(id); toast(req.name+' 님의 요청을 거절했어요'); }
      catch(e){ toast('거절 실패'); rejectBtn.disabled=false; rejectBtn.textContent='거절'; }
    };
    row.appendChild(btn);
    row.appendChild(rejectBtn);
    listEl.appendChild(row);
  });
}
document.getElementById('licenseGenClose').onclick=()=>{
  const o=document.getElementById('licenseGenOverlay'); o.classList.remove('on'); o.style.display='none';
};
// 🔍 발급된 키 검색 — 입력할 때마다 캐시에서 즉시 필터 (재조회 없음)
document.getElementById('licenseGenSearch')?.addEventListener('input', ()=>{ _renderLicenseGenListFiltered(); });
// 📦 대기 요청 전체 일괄 발급 — 각각 키를 새로 만들어 순서대로 승인
document.getElementById('licenseBulkBtn')?.addEventListener('click', async ()=>{
  const targets=_licensePendingCache.slice();
  if(!targets.length) return;
  if(!confirm('대기 중인 요청 '+targets.length+'건에 전부 키를 발급할까요?')){ window.focus(); return; } window.focus();
  const bulkBtn=document.getElementById('licenseBulkBtn');
  bulkBtn.disabled=true; bulkBtn.textContent='발급 중...';
  let ok=0, fail=0;
  for(const t of targets){
    try{
      const key=_genLicenseKey();
      await window.firebaseAPI.approveLicenseRequest(t.id, key, '요청: '+t.name);
      ok++;
    }catch(e){ fail++; }
  }
  bulkBtn.disabled=false; bulkBtn.textContent='전체 일괄 발급';
  toast('일괄 발급 완료 — 성공 '+ok+'건'+(fail?(', 실패 '+fail+'건'):''));
  renderLicenseGenList();
});
document.getElementById('licenseGenBtn').onclick=async ()=>{
  if(!window.firebaseAPI){ toast('네트워크 연결을 확인해 주세요'); return; }
  const note=document.getElementById('licenseGenNote').value.trim();
  const key=_genLicenseKey();
  const btn=document.getElementById('licenseGenBtn');
  btn.disabled=true; btn.textContent='발급 중...';
  try{
    await window.firebaseAPI.createLicense(key, note);
    document.getElementById('licenseGenKeyText').textContent=key;
    document.getElementById('licenseGenResult').style.display='block';
    renderLicenseGenList();
  }catch(e){ toast(_saveFailMsg(e, '발급 실패 — 네트워크를 확인해 주세요')); }
  btn.disabled=false; btn.textContent='새 키 발급';
};
document.getElementById('licenseGenCopyBtn').onclick=()=>{
  const text=document.getElementById('licenseGenKeyText').textContent;
  try{ navigator.clipboard.writeText(text); toast('복사됐어요'); }
  catch(e){ toast('복사 실패 — 직접 드래그해서 복사해 주세요'); }
};

/* ★ 친구코드로 라이선스 발급 — 코드 보유자를 찾아 키를 생성하고, 그 유저의 수령함(보상)으로 발송.
   유저는 수령함에서 키를 받아 라이선스 등록창에 입력하면 프리미엄이 된다(기존 검증 구조 그대로 사용). */
(function bindLicenseGrantByCode(){
  const btn  = document.getElementById('licenseGrantBtn');
  const codeInp = document.getElementById('licenseGrantCode');
  const msgEl = document.getElementById('licenseGrantMsg');
  if(!btn || !codeInp) return;
  const showMsg=(text,isErr)=>{
    if(!msgEl) return;
    msgEl.textContent=text;
    msgEl.style.color = isErr ? 'var(--win-error)' : 'var(--ink-soft)';
    msgEl.style.display = text ? 'block' : 'none';
  };
  const submit = async ()=>{
    if(!window.firebaseAPI || !firebaseAPI.lookupFriendCode || !firebaseAPI.createLicense || !firebaseAPI.sendInboxMessage){
      showMsg('네트워크 연결이 필요해요', true); return;
    }
    let code=(codeInp.value||'').trim().toUpperCase();
    if(!code){ showMsg('친구코드를 입력해 주세요', true); return; }
    // 뒷 4자리만 입력해도 되게 접두어 자동 보완 (친구 추가와 동일 규칙)
    let candidates;
    if(/^[A-Z0-9]{4}$/.test(code)){ candidates=['MATE-'+code, 'COZY-'+code]; }
    else if(/^(MATE|COZY)-[A-Z0-9]{4}$/.test(code)){ candidates=[code]; }
    else { candidates=[code]; }
    btn.disabled=true; showMsg('확인 중…', false);
    try{
      // 코드 → uid 조회 (여러 후보 순차 시도)
      let uid=null;
      for(const c of candidates){
        try{ const u=await firebaseAPI.lookupFriendCode(c); if(u){ uid=u; break; } }catch(_){}
      }
      if(!uid){ showMsg('해당 친구코드를 가진 유저를 찾을 수 없어요', true); btn.disabled=false; return; }
      // 유저 닉네임 조회 — note에 넣어 목록에서 이름으로 검색 가능하게
      let _userName=null;
      try{ if(firebaseAPI.getUserNameById) _userName = await firebaseAPI.getUserNameById(uid); }catch(_){}
      // 키 생성 + 라이선스 등록
      const key=_genLicenseKey();
      const note = _userName ? (_userName+' · 친구코드 '+code) : ('친구코드 발급: '+code);
      await firebaseAPI.createLicense(key, note);
      // 유저 수령함(보상)으로 키 발송
      const title='🎫 라이선스가 도착했어요';
      const body='아래 키를 [라이선스 등록] 창에 입력하면 프리미엄 기능을 쓸 수 있어요.\n\n'+key+'\n\n(설정 → 라이선스 등록)';
      const r=await firebaseAPI.sendInboxMessage(uid, 'reward', title, body);
      if(r && r.ok!==false){
        showMsg('발급 완료 — 해당 유저 수령함(보상)으로 보냈어요', false);
        codeInp.value='';
        renderLicenseGenList();
        toast('📮 라이선스를 '+code+' 유저에게 발급했어요');
      }else{
        showMsg('수령함 전송에 실패했어요 (키는 생성됨: '+key+')', true);
      }
    }catch(e){
      showMsg(_saveFailMsg(e, '오류가 났어요 — 인터넷 연결을 확인해 주세요'), true);
    }
    btn.disabled=false;
  };
  btn.addEventListener('click', submit);
  codeInp.addEventListener('keydown', e=>{ if(e.key==='Enter') submit(); });
})();

return { renderLicenseGenList };   // 📄 엑셀 일괄 발급이 발급 뒤 목록을 다시 그릴 때
}

const api = { createAdminLicense };
if(typeof window !== 'undefined') window.TwAdminLicense = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
