/* license-premium.js — 🔑 프리미엄 판정 — 서버 확인(GET /v1/me 의 premium)을 isPremium 에 반영 · 키 등록 · 이 기기 해제 (검사 sim-license-premium.js)
   [왜] 프리미엄은 서버가 «이 계정 + 이 기기가 등록돼 있음 + 키 유효» 로 판정한다. 앱은 확인 응답만 따른다 —
     이 PC 에 적어 둔 키로 미리 켜지도, 24시간 유예로 버티지도 않는다(0.13 은 서버에 못 닿으면 앱이 «서버에 연결할 수 없어요» 화면에서 멈춘다).
   [반영 자리] 프리미엄은 GET /v1/me 의 응답과 라이선스 쓰기(키 등록 · 이 기기 해제)의 응답 premium(이 기기 판정)에서만 반영한다 —
     PATCH /v1/me 같은 다른 쓰기 응답은 따르지 않는다. 라이선스 쓰기 응답에 premium 이 없으면(«모름») GET /v1/me 를 한 번 더 묻는다.
     부르는 곳 셋: ① 계정 확인 뒤 켜는 차례(app-boot 의 licensePremium) ② 서버 알림 license(키 등록 · 회수 · 기기 변경 — 다른 기기에서 바뀐 것 포함) ③ 키 등록 · 이 기기 해제 직후.
   [모름] 확인 전의 false 는 «아님» 이 아니라 «모름» — account-state.js premiumKnown. 모르는 동안은 전용 자산 접기를 건너뛴다(premium-assets.js).
   [기기 등록] 앱이 알아서 등록하지 않는다 — 기기는 «키를 직접 넣을 때» 등록되고, 프리미엄은 «이미 목록에 있는 기기» 만 켜진다.
     라이선스는 있는데 이 기기만 목록에 없는 새 PC 는 «아님» 으로 둔다(기기 관리 화면에서 등록 — D8-2). 켤 때 라이선스 목록을 읽지 않는다.
   [겹침] 확인은 한 줄로만 돈다 — 도는 중에 또 부르면 끝난 뒤 최신으로 한 번 더(알림이 몰려도 요청이 쌓이지 않는다). 실패해도 혼자 다시 하지 않는다(다음 알림 · 앱 켜기).
   [실패] 번호는 사용자가 누른 동작(키 등록 · 이 기기 해제) 뒤의 확인 실패에만 E-LIC-01 을 띄운다(이 기기 해제 실패는 license-key.js 가 E-LIC-02). 서버 알림 · 켤 때로 받다 실패하면 아무것도 안 띄우고 지금 값 그대로.
     로그인이 풀린 실패(kind auth)는 로그인 흐름이 다루므로 어느 쪽도 알리지 않는다.
   [계정 바뀜] reset() — 알림 구독을 풀고 · 시작 표시 · 도는 확인을 비우고 · «모름» 으로 되돌린다(늦게 온 옛 답은 gen 이 달라 버린다). S-4(세션 dispose)가 부를 자리.
   deps: userApi.me() · licenseApi(mine · register · removeDevice · reasonOf) · deviceId() · deviceName() · setPremium(v) · isPremium() ·
         rtOn(kind, fn) → 해제 함수 · resetKnown()(프리미엄을 «모름» 으로 되돌림 — 알림 없이) · notifyError · reasonOf(err)(공통 문구) · resetCustomStatus()(프리미엄을 놓을 때 커스텀 상태를 기본으로)
   내놓는 것: start(me) · refresh() · activate(key) · deactivate() · reset()
   classic script — license-api.js · user-api.js 다음 · app.js 보다 먼저 싣는다(window.TwLicensePremium). */
(function(){
'use strict';

const KIND = 'license';   // realtime 알림 종류(rt-hub.js KINDS)
const NOT_CONFIRMED = '등록은 됐는데 이 기기에서 아직 확인하지 못했어요 — 잠시 뒤 다시 확인해 주세요';
const EMPTY_KEY = '라이선스 키를 입력해 주세요';

/** @param {{ userApi: { me: () => Promise<any> },
 *   licenseApi: { mine: Function, register: Function, removeDevice: Function, reasonOf: (e: any) => string | null },
 *   deviceId: () => string, deviceName: () => string,
 *   setPremium: (v: boolean) => void, isPremium: () => boolean,
 *   rtOn: (kind: string, fn: Function) => Function, notifyError: (code: string, err: any) => unknown,
 *   reasonOf: (e: any) => string, resetCustomStatus: () => void }} deps */
function createLicensePremium(deps){
  const userApi = deps.userApi;
  const licenseApi = deps.licenseApi;
  const setPremium = deps.setPremium;
  const isPremium = deps.isPremium;
  let started = false;
  let running = null, again = false;   // 확인 한 줄 — 도는 중에 부르면 끝난 뒤 한 번 더
  let loud = false;   // 이번 확인에 사용자 동작(쓰기 뒤 확인)이 섞였나 — 실패하면 번호를 띄운다
  let notified = false;   // 이번 동작에서 번호를 띄웠나(입력칸에 같은 실패를 또 적지 않게)
  let gen = 0;   // reset 마다 올라간다 — await 뒤에 견줘 옛 계정의 늦은 답을 버린다
  let unsub = null;

  function fail(e){
    console.warn('[라이선스] 확인하지 못했어요', e);
    if(e && e.kind === 'auth') return;   // 로그인이 풀렸다 — 로그인 흐름 몫
    if(!loud) return;   // 알림 · 켤 때 받다 실패 — 번호 없이 지금 값 그대로
    notified = true;
    deps.notifyError('E-LIC-01', e);   // 번호는 글자 그대로(sim-error-codes 가 찾는다)
  }

  /* 서버 확인(me)을 그대로 반영한다 — 기기 등록은 하지 않는다(키를 직접 넣을 때만 · 이미 목록에 있는 기기만 프리미엄).
     끝나면 premiumKnown 이 참이다. 던지지 않는다. */
  function settle(me){
    setPremium(me.premium === true);
    return me.premium === true;
  }

  async function once(given, g){
    let me = given || null;
    try{ if(!me) me = await userApi.me(); }
    catch(e){ if(g === gen) fail(e); return isPremium(); }   // 못 받음 — 지금 값 그대로(혼자 다시 받지 않는다)
    if(!me || g !== gen) return isPremium();   // reset 뒤에 온 옛 답은 버린다
    return settle(me);
  }
  /* 한 줄로 돈다 — 첫 바퀴는 given(이미 받은 확인)을 쓰고, 겹친 부름은 새로 받는다 */
  function lane(given, byUser){
    if(byUser) loud = true;
    if(running){ again = true; return running; }
    const g = gen;
    const p = (async () => {
      let r = await once(given, g);
      while(again && g === gen){ again = false; r = await once(null, g); }
      return r;
    })().finally(() => { if(running === p){ running = null; loud = false; } });
    running = p;
    return p;
  }

  /* 라이선스 쓰기 응답의 premium 으로 반영 — 없으면 서버에 다시 묻는다. 도는 확인이 있으면 끝난 뒤 최신으로 한 번 더(늦게 온 옛 답이 덮지 않게) */
  function fromWrite(l){
    if(!l || typeof l.premium !== 'boolean') return lane(null, true);
    if(running) again = true;
    return Promise.resolve(settle(l));
  }

  /* 서버가 계정을 돌려준 뒤 한 번(켜는 차례 licensePremium) — 받아 둔 확인으로 반영하고 license 알림을 건다. 두 번째 부름은 무시 */
  function start(me){
    if(started){ console.warn('[라이선스] 이미 시작했어요'); return Promise.resolve(isPremium()); }
    started = true;
    unsub = deps.rtOn(KIND, () => { lane(null); });
    return lane(me);
  }
  /* 계정이 바뀌거나 세션을 놓을 때 — 알림을 풀고 «모름» 으로 되돌린다(다음 계정 확인이 다시 정한다) */
  function reset(){
    if(unsub){ try{ unsub(); }catch(_){} }
    unsub = null; started = false; gen++; running = null; again = false; loud = false; notified = false;
    deps.resetKnown();
  }
  /* 지금 서버에 다시 묻는다 → 프리미엄 여부(못 받으면 지금 값) */
  function refresh(){ return lane(null); }

  /* 키 등록 — 돌려주는 것 { ok, reason?, err?, registered? }. ok 는 서버가 «이 기기에서 프리미엄» 이라고 확인해 준 경우만(registered — 등록은 됐는데 확인이 안 됨 · err — 요청 실패 원본) */
  async function activate(key){
    const k = String(key || '').trim().toUpperCase();
    if(!k) return { ok: false, reason: EMPTY_KEY };
    let l;
    try{
      await licenseApi.mine();   // 읽은 토큰 주인에 쓰기를 묶는다(등록한 키가 다른 계정으로 가지 않게)
      l = await licenseApi.register(k, { id: deps.deviceId(), name: deps.deviceName() });
    }catch(e){ return { ok: false, err: e, reason: licenseApi.reasonOf(e) || deps.reasonOf(e) }; }   // err — 첫 실행 키 올리기가 서버 code · 로그인 풀림을 가른다
    notified = false;
    const premium = await fromWrite(l);
    return premium ? { ok: true } : { ok: false, registered: true, notified, reason: NOT_CONFIRMED };   // notified — 확인 실패 번호를 이미 띄웠다
  }
  /* 이 기기에서 해제 — 서버 목록에서 이 기기를 뺀다(다른 기기 · 키는 그대로). 돌려주는 것 { ok, reason? } */
  async function deactivate(){
    let after = null;
    try{
      const lic = await licenseApi.mine();
      if(lic) after = await licenseApi.removeDevice(deps.deviceId());
    }catch(e){ return { ok: false, err: e, reason: licenseApi.reasonOf(e) || deps.reasonOf(e) }; }
    deps.resetCustomStatus();
    await fromWrite(after);
    return { ok: true };
  }

  return { start, refresh, activate, deactivate, reset };
}

const api = { KIND, createLicensePremium };
if(typeof window !== 'undefined') window.TwLicensePremium = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
