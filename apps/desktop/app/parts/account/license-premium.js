/* license-premium.js — 🔑 프리미엄 판정 — 서버 확인(GET /v1/me 의 premium)을 isPremium 에 반영 · 키 등록 · 이 기기 해제 (검사 sim-license-premium.js)
   [왜] 프리미엄은 서버가 «이 계정 + 이 기기가 등록돼 있음 + 키 유효» 로 판정한다. 앱은 확인 응답만 따른다 —
     이 PC 에 적어 둔 키로 미리 켜지도, 24시간 유예로 버티지도 않는다(0.13 은 서버에 못 닿으면 앱이 «서버에 연결할 수 없어요» 화면에서 멈춘다).
   [반영 자리] 프리미엄은 **GET /v1/me 의 응답**에서만 반영한다 — PATCH /v1/me 같은 쓰기 응답은 기기 머리 없이 premium:false 를 돌려줄 수 있어 따르지 않는다.
     부르는 곳 둘: ① 계정 확인 뒤 켜는 차례(app-boot 의 licensePremium) ② 서버 알림 license(키 등록 · 회수 · 기기 변경 — 다른 기기에서 바뀐 것 포함) · 키 등록 · 이 기기 해제 직후.
   [모름] 확인 전의 false 는 «아님» 이 아니라 «모름» — account-state.js premiumKnown. 모르는 동안은 전용 자산 접기를 건너뛴다(premium-assets.js).
   [이 기기 등록] 서버가 «아님» 이라 해도 라이선스가 있는 계정이고 이 기기만 목록에 없으면(새 PC) 기기를 등록하고 다시 확인한다(한 번).
     기기가 가득 차 있으면(LICENSE_DEVICE_FULL) 조용히 «아님» — 기기를 비우는 길은 설정 › 라이선스(D8-2). 판단은 settle 한 곳.
     ⚠️ 사용자가 «이 기기에서 해제» 한 PC 는 자동으로 다시 등록하지 않는다(해제 표시 deps.releasedKey — 키를 직접 넣으면 풀린다). 안 그러면 해제가 다음 확인에 되돌려진다.
   [겹침] 확인은 한 줄로만 돈다 — 도는 중에 또 부르면 끝난 뒤 최신으로 한 번 더(알림이 몰려도 요청이 쌓이지 않는다). 실패해도 혼자 다시 하지 않는다(다음 알림 · 앱 켜기).
   [실패] 확인 · 등록 실패는 E-LIC-01. 로그인이 풀린 실패(kind auth)는 로그인 흐름이 다루므로 알리지 않는다.
   deps: userApi.me() · licenseApi(mine · register · putDevice · removeDevice · reasonOf) · deviceId() · deviceName() · setPremium(v) · isPremium() · storage · releasedKey ·
         rtOn(kind, fn) → 해제 함수 · notifyError · reasonOf(err)(공통 문구) · resetCustomStatus()(프리미엄을 놓을 때 커스텀 상태를 기본으로)
   내놓는 것: start(me) · refresh() · activate(key) · deactivate()
   classic script — license-api.js · user-api.js 다음 · app.js 보다 먼저 싣는다(window.TwLicensePremium). */
(function(){
'use strict';

const KIND = 'license';   // realtime 알림 종류(rt-hub.js KINDS)
const DEVICE_FULL = 'LICENSE_DEVICE_FULL';
const NOT_CONFIRMED = '등록은 됐는데 이 기기에서 아직 확인하지 못했어요 — 앱을 다시 켜 주세요';
const EMPTY_KEY = '라이선스 키를 입력해 주세요';

/** @param {{ userApi: { me: () => Promise<any> },
 *   licenseApi: { mine: Function, register: Function, putDevice: Function, removeDevice: Function, reasonOf: (e: any) => string | null },
 *   deviceId: () => string, deviceName: () => string,
 *   setPremium: (v: boolean) => void, isPremium: () => boolean,
 *   storage: { getItem: Function, setItem: Function, removeItem: Function }, releasedKey: string,   // 이 기기 해제 표시(account-state.js LICENSE_OPTOUT_KEY)
 *   rtOn: (kind: string, fn: Function) => Function, notifyError: (code: string, err: any) => unknown,
 *   reasonOf: (e: any) => string, resetCustomStatus: () => void }} deps */
function createLicensePremium(deps){
  const userApi = deps.userApi;
  const licenseApi = deps.licenseApi;
  const setPremium = deps.setPremium;
  const isPremium = deps.isPremium;
  /* 이 기기 해제 표시 — 저장소가 막혀 있으면 표시 없음(= 자동 등록을 막지 못한다. 해제를 못 지키는 것보다 기기를 못 쓰는 쪽이 더 나쁘다) */
  const released = {
    isSet(){ try{ return !!deps.storage.getItem(deps.releasedKey); }catch(_){ return false; } },
    set(){ try{ deps.storage.setItem(deps.releasedKey, '1'); }catch(_){} },
    clear(){ try{ deps.storage.removeItem(deps.releasedKey); }catch(_){} },
  };
  let started = false;
  let running = null, again = false;   // 확인 한 줄 — 도는 중에 부르면 끝난 뒤 한 번 더

  function fail(e){
    console.warn('[라이선스] 확인하지 못했어요', e);
    if(e && e.kind === 'auth') return;   // 로그인이 풀렸다 — 로그인 흐름 몫
    deps.notifyError('E-LIC-01', e);   // 번호는 글자 그대로(sim-error-codes 가 찾는다)
  }

  /* 서버 확인(me)을 반영한다 — 위 [이 기기 등록]. 끝나면 premiumKnown 이 참이다(어느 갈래로든 setPremium 을 한 번은 부른다). 던지지 않는다. */
  async function settle(me){
    if(me.premium === true){ setPremium(true); return true; }
    let reconfirm = false;
    try{
      const lic = await licenseApi.mine();
      const id = deps.deviceId();
      if(lic && lic.status === 'VALID' && !released.isSet() && !lic.devices.some((d) => d.deviceId === id)){
        try{ await licenseApi.putDevice(id, deps.deviceName()); reconfirm = true; }
        catch(e){ if(!(e && e.code === DEVICE_FULL)) throw e; }   // 가득 참 — 아님 그대로
      }
      if(reconfirm){
        const fresh = await userApi.me();   // 프리미엄은 확인 응답에서만
        if(fresh) me = fresh;
      }
    }catch(e){ fail(e); }
    setPremium(me.premium === true);
    return me.premium === true;
  }

  async function once(given){
    let me = given || null;
    try{ if(!me) me = await userApi.me(); }
    catch(e){ fail(e); return isPremium(); }   // 못 받음 — 지금 값 그대로(혼자 다시 받지 않는다)
    if(!me) return isPremium();
    return settle(me);
  }
  /* 한 줄로 돈다 — 첫 바퀴는 given(이미 받은 확인)을 쓰고, 겹친 부름은 새로 받는다 */
  function lane(given){
    if(running){ again = true; return running; }
    running = (async () => {
      let r = await once(given);
      while(again){ again = false; r = await once(null); }
      return r;
    })().finally(() => { running = null; });
    return running;
  }

  /* 서버가 계정을 돌려준 뒤 한 번(켜는 차례 licensePremium) — 받아 둔 확인으로 반영하고 license 알림을 건다. 두 번째 부름은 무시 */
  function start(me){
    if(started){ console.warn('[라이선스] 이미 시작했어요'); return Promise.resolve(isPremium()); }
    started = true;
    deps.rtOn(KIND, () => { lane(null); });
    return lane(me);
  }
  /* 지금 서버에 다시 묻는다 → 프리미엄 여부(못 받으면 지금 값) */
  function refresh(){ return lane(null); }

  /* 키 등록 — 돌려주는 것 { ok, reason? }. ok 는 서버가 «이 기기에서 프리미엄» 이라고 확인해 준 경우만 */
  async function activate(key){
    const k = String(key || '').trim().toUpperCase();
    if(!k) return { ok: false, reason: EMPTY_KEY };
    try{
      await licenseApi.mine();   // 읽은 토큰 주인에 쓰기를 묶는다(등록한 키가 다른 계정으로 가지 않게)
      await licenseApi.register(k, { id: deps.deviceId(), name: deps.deviceName() });
    }catch(e){ return { ok: false, reason: licenseApi.reasonOf(e) || deps.reasonOf(e) }; }
    released.clear();   // 키를 직접 넣었다 — 이 기기를 쓰겠다는 뜻
    const premium = await lane(null);
    return premium ? { ok: true } : { ok: false, reason: NOT_CONFIRMED };
  }
  /* 이 기기에서 해제 — 서버 목록에서 이 기기를 뺀다(다른 기기 · 키는 그대로). 돌려주는 것 { ok, reason? } */
  async function deactivate(){
    try{
      const lic = await licenseApi.mine();
      if(lic){ await licenseApi.removeDevice(deps.deviceId()); released.set(); }
    }catch(e){ return { ok: false, reason: licenseApi.reasonOf(e) || deps.reasonOf(e) }; }
    deps.resetCustomStatus();
    await lane(null);
    return { ok: true };
  }

  return { start, refresh, activate, deactivate };
}

const api = { KIND, createLicensePremium };
if(typeof window !== 'undefined') window.TwLicensePremium = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
