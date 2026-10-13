/* admin-users.js — 📊 전체 통계(가입 · 프리미엄 · 카운터 보정) · 🎟️ 초대권 지급(한 명 · 전체 · 우클릭 전체 회수) (관리자)
   app.js «🎟️ 초대장» 의 사용자 초대 창(bindInviteUI) 안쪽에 있던 관리자 몫을 그대로 옮긴 관리자 모듈이다(관리자 코드 admin 폴더 5번).
   동작은 옮기기 전과 같다. 사용자가 쓰는 초대 코드 발급 · 복사는 app.js 에 남겼다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(바깥 함수 안이라 두 칸 들여쓴 그대로). 바뀐 줄은 없다 —
     그 바깥 함수의 지역 이름은 쓰지 않는다(파서로 확인). toast 는 화살표로, INVITE_GRANT_MAX(앞에서 선언한 const)는 값으로 받는다.
   ★ 밖에서 부르는 이름은 없다 — 버튼 연결을 만들 때 건다.
   검사: checks/sim-admin-users-launcher.js
   ⚠️ document · window · firebaseAPI · localStorage · navigator 는 예전처럼 전역 이름으로 쓴다(이 파일은 app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwAdminUsers — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103). */
(function(){

function createAdminUsers(deps){
const toast = deps.toast;
const INVITE_GRANT_MAX = deps.inviteGrantMax;   // 한 번에 줄 수 있는 초대권 상한
  // 📊 관리자: 전체 통계 (가입 유저 수 / 프리미엄 유저 수)
  (function bindTotalStats(){
    const btn = document.getElementById('lcTotalStats');
    const ov  = document.getElementById('totalStatsOverlay');
    const body= document.getElementById('totalStatsBody');
    const closeBtn = document.getElementById('totalStatsClose');
    const refreshBtn = document.getElementById('totalStatsRefresh');
    if(!btn || !ov) return;
    const load = async ()=>{
      if(body) body.innerHTML = '<div style="text-align:center;color:var(--ink-soft);">불러오는 중…</div>';
      if(!window.firebaseAPI || !firebaseAPI.getAdminStats){ if(body) body.innerHTML='<div style="color:#c33;">네트워크 연결이 필요해요</div>'; return; }
      try{
        const st = await firebaseAPI.getAdminStats();
        if(body) body.innerHTML =
          '<div style="display:flex;justify-content:space-between;"><span>👥 가입 유저</span><b>'+st.totalUsers+'명</b></div>' +
          '<div style="border-top:1px solid var(--win-lo);margin:6px 0;"></div>' +
          '<div style="display:flex;justify-content:space-between;"><span>👑 프리미엄 유저</span><b>'+st.premiumUsers+'명</b></div>' +
          '<div style="display:flex;justify-content:space-between;color:var(--ink-soft);font-size:11px;"><span>&nbsp;&nbsp;└ 유효 라이선스 키</span><span>'+st.licValid+'개 (사용 '+st.licUsed+')</span></div>' +
          '<div style="border-top:1px solid var(--win-lo);margin:8px 0 6px;"></div>' +
          '<div style="display:flex;gap:6px;align-items:center;font-size:11px;color:var(--ink-soft);">' +
            '<span>카운터 보정:</span>' +
            '<input id="totalStatsSetInput" type="number" min="0" style="width:70px;font-size:11px;padding:2px 4px;" placeholder="'+st.totalUsers+'">' +
            '<button id="totalStatsSetBtn" class="lc-btn ghost" style="min-width:44px;font-size:11px;padding:3px 8px;margin:0;">설정</button>' +
          '</div>';
        const setBtn = document.getElementById('totalStatsSetBtn');
        if(setBtn) setBtn.onclick = async ()=>{
          const v = parseInt((document.getElementById('totalStatsSetInput')||{}).value, 10);
          if(!isFinite(v) || v < 0){ toast('0 이상의 숫자를 입력하세요'); return; }
          if(firebaseAPI.setUserCount){ await firebaseAPI.setUserCount(v); toast('가입 수를 '+v+'명으로 설정했어요'); load(); }
        };
      }catch(e){ if(body) body.innerHTML='<div style="color:#c33;">통계를 불러오지 못했어요</div>'; }
    };
    btn.addEventListener('click', ()=>{ ov.style.display='flex'; load(); });
    if(closeBtn) closeBtn.addEventListener('click', ()=>{ ov.style.display='none'; });
    if(refreshBtn) refreshBtn.addEventListener('click', load);
    ov.addEventListener('mousedown', e=>{ if(e.target===ov) ov.style.display='none'; });
  })();

  // 관리자: 유저에게 초대권 추가 지급 — 친추코드 + 장수를 한 창에서 입력
  const grantBtn    = document.getElementById('lcInviteGrant');
  const grantOv     = document.getElementById('inviteGrantOverlay');
  const grantCode   = document.getElementById('inviteGrantCode');
  const grantCount  = document.getElementById('inviteGrantCount');
  const grantMinus  = document.getElementById('inviteGrantMinus');
  const grantPlus   = document.getElementById('inviteGrantPlus');
  const grantOk     = document.getElementById('inviteGrantOk');
  const grantCancel = document.getElementById('inviteGrantCancel');
  const grantMsg    = document.getElementById('inviteGrantMsg');
  if(grantBtn && grantOv && grantCode && grantCount && grantOk){
    let _grantN = 1;
    const renderN = ()=>{
      grantCount.textContent = String(_grantN);
      grantMinus.disabled = _grantN <= 1;
      grantPlus.disabled  = _grantN >= INVITE_GRANT_MAX;
      grantMinus.style.opacity = _grantN <= 1 ? '.4' : '';
      grantPlus.style.opacity  = _grantN >= INVITE_GRANT_MAX ? '.4' : '';
    };
    const showMsg = (text, isErr)=>{
      if(!grantMsg) return;
      grantMsg.textContent = text;
      grantMsg.style.color = isErr ? 'var(--win-error)' : 'var(--ink-soft)';
      grantMsg.style.display = text ? 'block' : 'none';
    };
    const closeGrant = ()=>{ grantOv.style.display='none'; };

    grantBtn.addEventListener('click', ()=>{
      if(!window.firebaseAPI || !firebaseAPI.grantInvites){ toast('네트워크 연결이 필요해요'); return; }
      grantCode.value = ''; _grantN = 1; renderN(); showMsg('', false);
      grantOv.style.display = 'flex';
      setTimeout(()=>grantCode.focus(), 50);
    });
    if(grantMinus) grantMinus.addEventListener('click', ()=>{ if(_grantN>1){ _grantN--; renderN(); } });
    if(grantPlus)  grantPlus.addEventListener('click',  ()=>{ if(_grantN<INVITE_GRANT_MAX){ _grantN++; renderN(); } });
    if(grantCancel) grantCancel.addEventListener('click', closeGrant);

    // 📢 전체 유저 일괄 지급 — confirm() 대신 2단계 클릭(Electron 투명창 confirm 멈춤 방지)
    const grantAllBtn = document.getElementById('inviteGrantAll');
    if(grantAllBtn){
      // _armed: 첫 클릭으로 걸린 쪽 — 'grant'(좌클릭 지급) · 'revoke'(우클릭 전체 회수). 다른 쪽을 누르면 그쪽으로 새로 건다.
      let _armed = null, _armT = null;
      grantAllBtn.title = '우클릭 두 번: 전체 유저 초대권을 0장으로 회수';
      const disarm = ()=>{ _armed=null; grantAllBtn.textContent='전체 유저에게 지급'; if(_armT){clearTimeout(_armT);_armT=null;} };
      const arm = (mode, text)=>{ disarm(); _armed = mode; grantAllBtn.textContent = text; _armT = setTimeout(disarm, 4000); };   // 4초 내 재클릭 없으면 해제
      grantOv.addEventListener('mousedown', e=>{ if(e.target!==grantAllBtn && _armed) disarm(); });
      const failMsg = (e, what)=>{
        const msg = String((e && e.message) || e || '');
        console.error('[invite] ' + what + ' 실패', e);
        showMsg(/permission|denied/i.test(msg) ? '권한 거부 — DB 규칙을 확인해 주세요' : ('실패: ' + msg.slice(0,80)), true);
      };
      grantAllBtn.addEventListener('contextmenu', async e=>{
        e.preventDefault();
        if(!window.firebaseAPI || !firebaseAPI.revokeInvitesAll){ toast('네트워크 연결이 필요해요'); return; }
        if(_armed !== 'revoke'){ arm('revoke', '⚠️ 정말 전체 초대권을 0장으로? (다시 우클릭)'); return; }
        disarm();
        grantAllBtn.disabled = true; showMsg('전체 회수 중… (유저 수에 따라 수십 초 걸릴 수 있어요)', false);
        try{
          const r = await firebaseAPI.revokeInvitesAll();
          closeGrant();
          toast(`🧹 전체 회수 완료 — ${r.revoked}명에게서 ${r.taken}장 (건너뜀 ${r.skipped}명${r.failed ? ` · 실패 ${r.failed}명` : ''})`);
        }catch(e){ failMsg(e, '전체 회수'); }
        grantAllBtn.disabled = false;
      });
      grantAllBtn.addEventListener('click', async ()=>{
        if(!window.firebaseAPI || !firebaseAPI.grantInvitesAll){ toast('네트워크 연결이 필요해요'); return; }
        if(_armed !== 'grant'){ arm('grant', `⚠️ 정말 전체에게 ${_grantN}장씩? (다시 클릭)`); return; }
        disarm();
        grantAllBtn.disabled = true; showMsg('전체 지급 중… (유저 수에 따라 수십 초 걸릴 수 있어요)', false);
        try{
          const r = await firebaseAPI.grantInvitesAll(_grantN);
          if(r && r.ok){
            closeGrant();
            toast(`📢 전체 지급 완료 — ${r.granted}명에게 ${_grantN}장씩 (제외 ${r.skipped}명)`);
          } else showMsg('전체 지급에 실패했어요', true);
        }catch(e){
          // ★ 예전엔 무조건 "네트워크 오류"라 원인이 가려졌다(실제로는 DB 규칙 거부였음) — 실제 사유를 그대로 보여준다.
          failMsg(e, '전체 지급');
        }
        grantAllBtn.disabled = false;
      });
    }

    const submitGrant = async ()=>{
      const code = (grantCode.value||'').trim().toUpperCase();
      if(!code){ showMsg('친추코드를 입력해 주세요', true); return; }
      grantOk.disabled = true; showMsg('확인 중…', false);
      try{
        const uid = await firebaseAPI.lookupFriendCode(code);
        if(!uid){ showMsg('해당 친추코드를 가진 유저를 찾을 수 없어요', true); grantOk.disabled=false; return; }
        const r = await firebaseAPI.grantInvites(uid, _grantN);
        if(r && r.ok){
          closeGrant();
          toast(`초대권 ${_grantN}장 지급 완료 (현재 ${r.invitesLeft}장)`);
        } else {
          showMsg((r && r.reason) || '지급에 실패했어요', true);
        }
      }catch(e){
        showMsg('네트워크 오류 — 인터넷 연결을 확인해 주세요', true);
      }
      grantOk.disabled = false;
    };
    grantOk.addEventListener('click', submitGrant);
    grantCode.addEventListener('keydown', e=>{ if(e.key==='Enter') submitGrant(); });
  }

return {};   // 밖에서 부르는 이름 없음 — 전부 만들 때 건다
}

const api = { createAdminUsers };
if(typeof window !== 'undefined') window.TwAdminUsers = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
