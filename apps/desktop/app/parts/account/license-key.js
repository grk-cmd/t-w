/* license-key.js — 🔑 라이선스 구획의 단추 연결 — [확인](키 등록) · [이 기기에서 해제] · [이 기기 등록] · [다시 시도]
   동작 · 결과 문구 · 오류 번호는 license-licenseScreenMod.js 가 한다 — 이 파일은 단추를 거는 일만 한다(검사 sim-license-key.js · 동작은 sim-license-licenseScreenMod.js).
   ★ 밖에서 부르는 이름: 없음 — 만들 때 건다.
   ⚠️ document · window 등 브라우저 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwLicenseKey — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103). */
(function(){

function createLicenseKey(deps){
const licenseScreenMod = deps.licenseScreenMod;   // 🔑 license-licenseScreenMod.js
const licKeyEl = (id) => document.getElementById(id);

licKeyEl('licenseSubmitBtn').onclick = async () => {
  const input = licKeyEl('licenseKeyInput');
  const r = await licenseScreenMod.submitKey(input.value);
  if(r && r.ok) input.value = '';   // 등록됐다 — 입력칸은 이제 보이지 않으니 키를 남기지 않는다
};
licKeyEl('licenseDeactivateBtn').onclick = () => { licenseScreenMod.removeThisDevice(); };
licKeyEl('licenseRegisterThisBtn').onclick = () => { licenseScreenMod.registerThisDevice(); };
licKeyEl('licenseRetryBtn').onclick = () => { licenseScreenMod.open(); };
licKeyEl('licenseKeyInput').addEventListener('keydown', e=>{ if(e.key==='Enter') licKeyEl('licenseSubmitBtn').click(); });

return {

};
}

const api = { createLicenseKey };
if(typeof window !== 'undefined') window.TwLicenseKey = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
