/* admin-users.js — 📊 전체 통계(가입 · 프리미엄 · 유효 키) · 🎟️ 초대권 지급(한 명 · 전체 · 우클릭 전체 회수) (관리자)
   원본은 서버다 — admin-api.js(adminApi)가 GET /v2/admin/metrics/totals · POST /v2/admin/invite-quotas/grants · revocations 를 부른다. 이 파일은 화면만.
   서버가 하는 일: 총계 세기(가입 수 손보정 카운터는 없다) · 친구코드 → 사람 찾기 · 전원 지급 · 회수 · 남은 장 수. 앱은 «누구에게 몇 장» 만 보낸다.
   ★ 한 번에 하나(busy) — 같은 단추를 연타해도 요청은 한 번. 지급은 같은 내용을 답 못 받고 다시 누르면 같은 요청 번호로 나간다(서버가 한 번만).
   ★ 받은 통계 답은 그 차례(gen)일 때만 그린다. 실패해도 혼자 다시 보내지 않는다.
   ★ 밖에서 부르는 이름은 없다 — 버튼 연결을 만들 때 건다. 사용자가 쓰는 초대 코드 발급 · 복사는 app.js 에 남겼다.
   deps: toast · inviteGrantMax — 한 번에 줄 수 있는 초대권 상한 · adminApi(admin-api.js) · apiErrors(TwApiErrors.store) · notifyError — 번호 알림(TwErrorCodes.notify)
   검사: checks/sim-admin-users-launcher.js
   ⚠️ document · window · navigator 는 예전처럼 전역 이름으로 쓴다(이 파일은 app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwAdminUsers — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103). */
(function(){

function createAdminUsers(deps){
const toast = deps.toast;
const INVITE_GRANT_MAX = deps.inviteGrantMax;   // 한 번에 줄 수 있는 초대권 상한
const adminApi = deps.adminApi;
const apiErrors = deps.apiErrors;
const notifyError = deps.notifyError;
/* 실패 하나 알리기 — 이 기능 표 · 공통 표는 그대로, 그 밖은 그 자리 번호(site) */
const fail = (e, onSite) => { const k = adminApi.notifyFail(e, apiErrors, onSite); if(k === 'refetch') onSite(); return k; };   // 이 창에는 다시 받을 목록이 없어 판이 달라져도 번호로 알린다
  // 📊 관리자: 전체 통계 (가입 유저 수 / 프리미엄 유저 수 / 유효 키) — 서버 총계
  (function bindTotalStats(){
    const btn = document.getElementById('lcTotalStats');
    const ov  = document.getElementById('totalStatsOverlay');
    const body= document.getElementById('totalStatsBody');
    const closeBtn = document.getElementById('totalStatsClose');
    const refreshBtn = document.getElementById('totalStatsRefresh');
    if(!btn || !ov) return;
    let gen = 0;
    const row = (label, value, small)=>{
      const d = document.createElement('div'); d.style.cssText = 'display:flex;justify-content:space-between;' + (small ? 'color:var(--ink-soft);font-size:11px;' : '');
      const l = document.createElement('span'); l.textContent = label; const v = document.createElement(small ? 'span' : 'b'); v.textContent = value;
      d.appendChild(l); d.appendChild(v); return d;
    };
    const rule = (m)=>{ const d = document.createElement('div'); d.style.cssText = 'border-top:1px solid var(--win-lo);margin:' + m + ';'; return d; };
    const load = async ()=>{
      const g = ++gen;
      if(body){ body.textContent = ''; const w = document.createElement('div'); w.style.cssText = 'text-align:center;color:var(--ink-soft);'; w.textContent = '불러오는 중…'; body.appendChild(w); }
      let st;
      try{ st = await adminApi.totals(); }
      catch(e){
        if(g !== gen) return;
        fail(e, () => notifyError('E-ADM-25', e));
        if(body){ body.textContent = ''; const m = document.createElement('div'); m.style.color = '#c33'; m.textContent = '통계를 불러오지 못했어요'; body.appendChild(m); }
        return;
      }
      if(g !== gen || !body) return;
      body.textContent = '';
      body.appendChild(row('👥 가입 유저', st.users + '명'));
      body.appendChild(rule('6px 0'));
      body.appendChild(row('👑 프리미엄 유저', st.premiumUsers + '명'));
      body.appendChild(row('  └ 유효 라이선스 키', st.licValid + '개 (사용 ' + st.licUsed + ')', true));
    };
    btn.addEventListener('click', ()=>{ ov.style.display='flex'; load(); });
    if(closeBtn) closeBtn.addEventListener('click', ()=>{ gen++; ov.style.display='none'; });
    if(refreshBtn) refreshBtn.addEventListener('click', load);
    ov.addEventListener('mousedown', e=>{ if(e.target===ov){ gen++; ov.style.display='none'; } });
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
    let busy = false;   // 지급 · 회수 요청 중 — 한 번에 하나
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
      grantAllBtn.addEventListener('contextmenu', async e=>{
        e.preventDefault();
        if(busy) return;
        if(_armed !== 'revoke'){ arm('revoke', '⚠️ 정말 전체 초대권을 0장으로? (다시 우클릭)'); return; }
        disarm();
        busy = true; grantAllBtn.disabled = true; showMsg('전체 회수 중… (유저 수에 따라 시간이 걸릴 수 있어요)', false);
        try{
          const r = await adminApi.revokeInvites('all');
          showMsg('', false); closeGrant();
          toast(`🧹 전체 회수 완료 — ${r.changed}명`);
        }catch(err){ showMsg('전체 회수에 실패했어요', true); fail(err, () => notifyError('E-ADM-27', err)); }
        finally{ busy = false; grantAllBtn.disabled = false; }
      });
      grantAllBtn.addEventListener('click', async ()=>{
        if(busy) return;
        if(_armed !== 'grant'){ arm('grant', `⚠️ 정말 전체에게 ${_grantN}장씩? (다시 클릭)`); return; }
        disarm();
        busy = true; grantAllBtn.disabled = true; showMsg('전체 지급 중… (유저 수에 따라 시간이 걸릴 수 있어요)', false);
        try{
          const r = await adminApi.grantInvites('all', _grantN);
          showMsg('', false); closeGrant();
          toast(`📢 전체 지급 완료 — ${r.changed}명에게 ${_grantN}장씩`);
        }catch(err){ showMsg('전체 지급에 실패했어요', true); fail(err, () => notifyError('E-ADM-26', err)); }
        finally{ busy = false; grantAllBtn.disabled = false; }
      });
    }

    const submitGrant = async ()=>{
      if(busy) return;
      const code = (grantCode.value||'').trim().toUpperCase();
      if(!code){ showMsg('친추코드를 입력해 주세요', true); return; }
      busy = true; grantOk.disabled = true; showMsg('확인 중…', false);
      try{
        const r = await adminApi.grantInvites(code, _grantN);   // 친구코드로 사람을 찾는 일은 서버가 한다
        if(r.changed < 1){ showMsg('지급이 반영되지 않았어요', true); }
        else{
          showMsg('', false); closeGrant();
          toast(`초대권 ${_grantN}장 지급 완료` + (r.left !== null ? ` (현재 ${r.left}장)` : ''));
        }
      }catch(err){
        if(err && err.code === 'USER_NOT_FOUND') showMsg('해당 친추코드를 가진 유저를 찾을 수 없어요', true);
        else{ showMsg('지급에 실패했어요', true); fail(err, () => notifyError('E-ADM-26', err)); }
      }
      finally{ busy = false; grantOk.disabled = false; }
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
