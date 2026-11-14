/* license-ui.js — 🔑 설정 › 라이선스 구획 그리기 — 기기 목록 화면(license-screen.js view())을 DOM 에 옮긴다
   [왜] 구획의 «무엇을 보이나» 는 license-screen.js view() 가 정한다(상태 여섯 — 불러오는 중 · 못 받음 · 라이선스 없음 · 등록됨 · 이 기기만 없음 · 회수됨).
     이 파일은 그 한 벌을 칸에 그리기만 한다 — 단추의 동작은 license-key.js 가 건다. 서버가 준 기기 이름은 textContent 로만 넣는다(남이 정한 글).
   ★ 밖에서 부르는 이름: refreshLicenseUI(그리기) · openLicenseUI(opts)(창 열기 = 받기 + 그리기) — app.js 는 licenseUiMod.이름 으로 부른다.
   ⚠️ document · window 등 브라우저 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwLicenseUi — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-license-ui.js(모듈 모양) · checks/sim-license-screen.js(상태 · 그리기) */
(function(){

function createLicenseUi(deps){
const isPremium = deps.isPremium;   // 읽는 함수
const licenseScreenMod = deps.licenseScreenMod;   // 🔑 license-screen.js — view() · open()

const licUiEl = (id) => document.getElementById(id);
const licUiShow = (id, on, disp) => { const el = licUiEl(id); if(el) el.style.display = on ? (disp || 'block') : 'none'; };
const LIC_SEG = 'display:flex;align-items:center;gap:6px;padding:4px 0;border-top:1px solid var(--win-lo-2);font-size:11px;color:var(--ink);';
const LIC_SMALL = 'font-size:10.5px;color:var(--ink-soft);';
const LIC_TITLES = {
  registered: '✅ 라이선스가 등록되어 있어요.',
  unregistered: '이 계정에는 라이선스가 있어요 — 이 기기는 아직 등록되지 않았어요.',
  revoked: '⚠️ 사용이 중지된 라이선스예요.',
};

/* 기기 한 줄 — 이름 · «이 기기» 표시 · 마지막 사용 · 등록일 · 다른 기기만 [빼기] */
function licDeviceRow(d, canAct){
  const row = document.createElement('div');
  row.style.cssText = LIC_SEG;
  const info = document.createElement('div');
  info.style.cssText = 'flex:1;min-width:0;';
  const name = document.createElement('div');
  name.style.cssText = 'font-weight:bold;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
  name.textContent = (d.name || '이름 없는 기기') + (d.here ? ' · 이 기기' : '');
  const meta = document.createElement('div');
  meta.style.cssText = LIC_SMALL;
  meta.textContent = '마지막 사용 ' + (d.lastSeen || '-') + ' · 등록 ' + (d.registered || '-');
  info.appendChild(name); info.appendChild(meta);
  row.appendChild(info);
  if(!d.here){
    const btn = document.createElement('button');
    btn.type = 'button'; btn.textContent = '빼기'; btn.className = 'licDeviceRemoveBtn';
    btn.style.cssText = 'background:none;border:none;color:var(--win-error);font-size:11px;cursor:pointer;text-decoration:underline;padding:0;';
    btn.disabled = !canAct;
    btn.onclick = () => { licenseScreenMod.removeDevice(d.id); };
    row.appendChild(btn);
  }
  return row;
}

/* --- 라이선스 구획 그리기 --- */
function refreshLicenseUI(){
  const v = licenseScreenMod.view();
  const lbl = licUiEl('lcLicenseLbl');
  if(lbl) lbl.textContent = isPremium() ? '🔓 라이선스 등록됨' : '🔑 라이선스 등록';

  const waiting = v.mode === 'loading' || v.mode === 'failed';
  licUiShow('licenseStatusBox', waiting);
  const st = licUiEl('licenseStatusMsg');
  if(st) st.textContent = v.mode === 'failed' ? '라이선스 정보를 못 불러왔어요' : '라이선스 정보를 불러오는 중이에요';
  licUiShow('licenseRetryBtn', v.mode === 'failed');

  licUiShow('licenseAdminNote', v.admin && v.mode === 'none');

  const hasLic = v.mode === 'registered' || v.mode === 'unregistered' || v.mode === 'revoked';
  licUiShow('licenseActiveBox', hasLic);
  const title = licUiEl('licenseActiveTitle'); if(title) title.textContent = LIC_TITLES[v.mode] || '';
  const withDevices = v.mode === 'registered' || v.mode === 'unregistered';
  licUiShow('licenseDeviceHead', withDevices);
  const head = licUiEl('licenseDeviceHead');
  if(head && withDevices) head.textContent = '내 기기 ' + v.devices.length + (v.limit ? ' / ' + v.limit : '') + '대';
  const list = licUiEl('licenseDeviceList');
  if(list){
    list.textContent = '';
    if(withDevices) for(const d of v.devices) list.appendChild(licDeviceRow(d, v.canAct));
  }
  const full = v.mode === 'unregistered' && v.full;
  licUiShow('licenseDeviceNote', full);
  const note = licUiEl('licenseDeviceNote'); if(note) note.textContent = '기기를 모두 썼어요 — 하나를 빼면 등록할 수 있어요';
  licUiShow('licenseRegisterThisBtn', v.mode === 'unregistered');
  const reg = licUiEl('licenseRegisterThisBtn'); if(reg) reg.disabled = !v.canAct || full;
  licUiShow('licenseDeactivateBtn', v.mode === 'registered');
  const deact = licUiEl('licenseDeactivateBtn'); if(deact) deact.disabled = !v.canAct;

  const keyOn = v.mode === 'none' || v.mode === 'revoked';
  licUiShow('licenseKeyBox', keyOn);
  const err = licUiEl('licenseErrorMsg');
  if(err){ err.textContent = keyOn ? v.keyMsg : ''; err.style.display = keyOn && v.keyMsg ? 'block' : 'none'; }
  const submit = licUiEl('licenseSubmitBtn');
  if(submit){ submit.disabled = !v.canAct; submit.textContent = v.busy ? '확인 중...' : '확인'; }
  const input = licUiEl('licenseKeyInput'); if(input) input.disabled = !v.canAct;
}
/* 설정 라이선스 구획을 열 때 — 받기(GET /v1/me/license)를 시작하고 지금 상태를 그린다(받는 동안은 «불러오는 중»). 받기가 끝나면 screen 이 다시 그리게 한다 */
function openLicenseUI(opts){
  const p = licenseScreenMod.open(opts);
  refreshLicenseUI();
  return p;
}
licenseScreenMod.onChange(refreshLicenseUI);

return {
  refreshLicenseUI,
  openLicenseUI,
};
}

const api = { createLicenseUi };
if(typeof window !== 'undefined') window.TwLicenseUi = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
