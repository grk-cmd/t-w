/* license-key.js — 🔑 라이선스 구획의 단추 연결 — [확인](키 등록) · [이 기기에서 해제] · [이 기기 등록] · [다시 시도]
   동작 · 결과 문구 · 오류 번호는 license-screen.js 가 한다 — 이 파일은 단추를 거는 일만 한다(검사 sim-license-key.js · 동작은 sim-license-screen.js).
   ★ 밖에서 부르는 이름: 없음 — 만들 때 건다.
   ⚠️ document · window 등 브라우저 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwLicenseKey — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103). */
(function(){

function createLicenseKey(deps){
const screen = deps.screen;   // 🔑 license-screen.js
const el = (id) => document.getElementById(id);

el('licenseSubmitBtn').onclick = async () => {
  const input = el('licenseKeyInput');
  const r = await screen.submitKey(input.value);
  if(r && r.ok) input.value = '';   // 등록됐다 — 입력칸은 이제 보이지 않으니 키를 남기지 않는다
};
el('licenseDeactivateBtn').onclick = () => { screen.removeThisDevice(); };
el('licenseRegisterThisBtn').onclick = () => { screen.registerThisDevice(); };
el('licenseRetryBtn').onclick = () => { screen.open(); };
el('licenseKeyInput').addEventListener('keydown', e=>{ if(e.key==='Enter') el('licenseSubmitBtn').click(); });

return {

};
}

const api = { createLicenseKey };
if(typeof window !== 'undefined') window.TwLicenseKey = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
