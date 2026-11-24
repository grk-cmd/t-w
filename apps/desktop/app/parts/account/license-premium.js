/* license-premium.js — 🔑 프리미엄 판정 — 서버 확인(GET /v2/me 의 premium)을 isPremium 에 반영 · 키 등록 · 이 기기 해제 (검사 sim-license-premium.js)
   [왜] 프리미엄은 서버가 «이 계정 + 이 기기가 등록돼 있음 + 키 유효» 로 판정한다. 앱은 확인 응답만 따른다 —
     이 PC 에 적어 둔 키로 미리 켜지도, 24시간 유예로 버티지도 않는다(0.13 은 서버에 못 닿으면 앱이 «서버에 연결할 수 없어요» 화면에서 멈춘다).
   [반영 자리] 프리미엄은 GET /v2/me 의 응답과 라이선스 쓰기(키 등록 · 이 기기 해제)의 응답 premium(이 기기 판정)에서만 반영한다 —
     PATCH /v2/me 같은 다른 쓰기 응답은 따르지 않는다. 라이선스 쓰기 응답에 premium 이 없으면(«모름») GET /v2/me 를 한 번 더 묻는다.
     부르는 곳 셋: ① 계정 확인 뒤 켜는 차례(app-boot 의 licensePremium · 첫 실행 뒤 licenseAutoRegister) ② 서버 알림 license(키 등록 · 회수 · 기기 변경 — 다른 기기에서 바뀐 것 포함) ③ 키 등록 · 이 기기 해제 직후.
   [모름] 확인 전의 false 는 «아님» 이 아니라 «모름» — account-state.js premiumKnown. 캐릭터 코드 불러오기만 이 «모름» 을 본다(char-code.js). 전용 자산 막기 · 접기는 카탈로그 레코드의 서버 locked 가 정한다.
   [자동 등록] 0.12 와 같게 — 켜고 첫 실행(firstRun)이 끝나거나 멈춘 뒤 한 번(autoRegisterAfter · app-boot 의 licenseAutoRegister) 프리미엄이 아니면 내 라이선스를 한 번 읽고, 라이선스가 유효한데 이 기기만 목록에 없으면
     [이 기기 등록] 과 같은 요청(PUT /v2/me/license/devices/{id})으로 등록하고 «계정에 등록된 라이선스를 이 PC에서도 켰어요» 를 띄운다.
     · 이 기기에서 해제한 라이선스는 다시 등록하지 않는다 — 해제할 때 tw.licenseOptOut 에 «id:라이선스 id» 를 적는다. 키를 넣거나 [이 기기 등록] 을 누르면 지운다.
       id 표시는 그 라이선스에만 걸린다 — 같은 PC 에 다른 계정이 들어오면 그 계정은 등록한다.
     · 0.12 가 남긴 값(해제한 키 글자)은 한 번만 쓴다 — 켜고 첫 확인에서 «라이선스가 유효한데 이 기기만 없음» 이면 «id:라이선스 id» 로 바꿔 적고(등록 안 함),
       그 밖(라이선스 없음 · 회수됨 · 이미 목록에 있음 · 이미 프리미엄)이면 지운다. 그래야 다른 계정에 남지 않는다.
       바꾸기 · 지우기는 저장값이 아직 그 0.12 값일 때만 한다(그사이 키 등록이 지웠으면 그대로).
     · 표시 이름과 뜻 읽기(parseOptOut)는 이 파일 한 곳 — 첫 실행(first-run-013.js 라이선스 키 단계)은 켤 때 본 값(optOutAtStart)을 deps 로 받는다.
     · 서버가 거절하면 다시 하지 않는다(다음 켜기에 한 번 더 해 본다). 번호는 없다.
       기기 가득(409 LICENSE_DEVICE_FULL)이면 안내 토스트([설정 열기] 달림 — deps.toastFull)를 라이선스마다 한 번만 — tw.licenseFullNoticed 에
       안내한 라이선스 id 를 최근 FULL_NOTICED_MAX 개까지 적고, 적힌 id 면 다시 띄우지 않는다(계정을 A → B → A 로 바꿔도 A 는 한 번).
       이 기기가 등록되면(자동 · [이 기기 등록] · 키 등록) 그 id 를 뺀다. 그 밖의 거절(5xx · 네트워크)은 콘솔에만.
     · 주인은 하나 — 이번 첫 실행의 라이선스 키 단계가 0.12 키로 등록을 해 봤으면(성공 · 기기 가득 — first-run-013.js licenseDone 이 참) 그쪽 몫이라 건너뛰고,
       아니면(0.12 키 없음 · 해제한 키 · 쓸 수 없는 키 · 첫 실행이 멈춤 · 이미 끝낸 계정) 자동 등록이 한다.
       첫 실행의 키 등록이 기기 가득으로 거절되면 activate 가 같은 기록에 적고 showFull 로 «지금 띄울지» 를 돌려준다 — 안내 글(FULL_NOTICE)도 이 파일 한 곳이다.
       설정 › 라이선스 화면의 [이 기기 등록] 은 그대로다(가득 차면 잠기고 «하나를 빼면 등록할 수 있어요»).
   [겹침] 확인은 한 줄로만 돈다 — 도는 중에 또 부르면 끝난 뒤 최신으로 한 번 더(알림이 몰려도 요청이 쌓이지 않는다). 실패해도 혼자 다시 하지 않는다(다음 알림 · 앱 켜기).
   [실패] 번호는 사용자가 누른 동작(키 등록 · 이 기기 해제) 뒤의 확인 실패에만 E-LIC-01 을 띄운다(이 기기 해제 실패는 license-screen.js 가 E-LIC-02). 서버 알림 · 켤 때로 받다 실패하면 아무것도 안 띄우고 지금 값 그대로.
     로그인이 풀린 실패(kind auth)는 로그인 흐름이 다루므로 어느 쪽도 알리지 않는다.
   [계정 바뀜] reset() — 알림 구독을 풀고 · 시작 표시 · 도는 확인을 비우고 · «모름» 으로 되돌린다(늦게 온 옛 답은 gen 이 달라 버린다). S-4(세션 dispose)가 부를 자리.
   deps: userApi.me() · licenseApi(mine · register · putDevice · removeDevice · reasonOf · isDeviceFull) · deviceId() · deviceName() · setPremium(v) · isPremium() ·
         rtOn(kind, fn) → 해제 함수 · resetKnown()(프리미엄을 «모름» 으로 되돌림 — 알림 없이) · notifyError · reasonOf(err)(공통 문구) · resetCustomStatus()(프리미엄을 놓을 때 커스텀 상태를 기본으로) ·
         storage(getItem · setItem · removeItem — 해제 표시 · 기기 가득 안내 기록) · toast(msg) · toastFull(msg)([설정 열기] 달린 토스트)
   내놓는 것: start(me) · autoRegisterAfter(took) · refresh() · activate(key, opts) · deactivate(opts) · registerDevice() · optOutAtStart() · reset(). 순수: parseOptOut(raw) · OPT_OUT_KEY
   classic script — license-api.js · user-api.js 다음 · app.js 보다 먼저 싣는다(window.TwLicensePremium). */
(function(){
'use strict';

const KIND = 'license';   // realtime 알림 종류(rt-hub.js KINDS)
const NOT_CONFIRMED = '등록은 됐는데 이 기기에서 아직 확인하지 못했어요 — 잠시 뒤 다시 확인해 주세요';
const EMPTY_KEY = '라이선스 키를 입력해 주세요';
const AUTO_ON = '🎫 계정에 등록된 라이선스를 이 PC에서도 켰어요';
const OPT_OUT_KEY = 'tw.licenseOptOut';
const FULL_NOTICE = '라이선스 기기를 모두 썼어요 — 설정 › 라이선스에서 하나를 빼면 이 PC를 등록할 수 있어요';
const FULL_NOTICED_KEY = 'tw.licenseFullNoticed';   // 기기 가득 안내를 띄운 라이선스 id 목록(JSON 배열)
const FULL_NOTICED_MAX = 8;
const OPT_OUT_ID = 'id:';   // 0.13 이 적는 값의 앞머리 — 없으면 0.12 가 남긴 값

/* 해제 표시 → null(없음) · { licenseId }(0.13) · { legacyKey }(0.12 — 해제한 키, 다듬고 대문자) */
function parseOptOut(raw){
  const v = typeof raw === 'string' ? raw.trim() : '';
  if(!v) return null;
  if(v.startsWith(OPT_OUT_ID)) return { licenseId: v.slice(OPT_OUT_ID.length) };
  return { legacyKey: v.toUpperCase() };
}

/** @param {{ userApi: { me: () => Promise<any> },
 *   licenseApi: { mine: Function, register: Function, putDevice: Function, removeDevice: Function, reasonOf: (e: any) => string | null, isDeviceFull: (e: any) => boolean },
 *   deviceId: () => string, deviceName: () => string,
 *   setPremium: (v: boolean) => void, isPremium: () => boolean,
 *   rtOn: (kind: string, fn: Function) => Function, resetKnown: () => void, notifyError: (code: string, err: any) => unknown,
 *   reasonOf: (e: any) => string, resetCustomStatus: () => void,
 *   storage: { getItem: Function, setItem: Function, removeItem: Function }, toast: (msg: string) => unknown, toastFull: (msg: string) => unknown }} deps */
function createLicensePremium(deps){
  const userApi = deps.userApi;
  const licenseApi = deps.licenseApi;
  const setPremium = deps.setPremium;
  const isPremium = deps.isPremium;
  const storage = deps.storage;
  let started = false;
  let running = null, again = false;   // 확인 한 줄 — 도는 중에 부르면 끝난 뒤 한 번 더
  let loud = false;   // 이번 확인에 사용자 동작(쓰기 뒤 확인)이 섞였나 — 실패하면 번호를 띄운다
  let notified = false;   // 이번 동작에서 번호를 띄웠나(입력칸에 같은 실패를 또 적지 않게)
  let gen = 0;   // reset 마다 올라간다 — await 뒤에 견줘 옛 계정의 늦은 답을 버린다
  let unsub = null;
  let seenAtStart = null;   // start 때 본 해제 표시(parseOptOut) — 첫 실행이 같은 값으로 가른다
  let rawAtStart = null, startP = null, autoAsked = false;   // 자동 등록은 start 뒤 · 첫 실행 뒤 한 번

  function fail(e){
    console.warn('[라이선스] 확인하지 못했어요', e);
    if(e && e.kind === 'auth') return;   // 로그인이 풀렸다 — 로그인 흐름 몫
    if(!loud) return;   // 알림 · 켤 때 받다 실패 — 번호 없이 지금 값 그대로
    notified = true;
    deps.notifyError('E-LIC-01', e);   // 번호는 글자 그대로(sim-error-codes 가 찾는다)
  }

  /* 서버 확인(me)을 그대로 반영한다. 끝나면 premiumKnown 이 참이다. 던지지 않는다. */
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
  function fromWrite(l, quiet){
    if(!l || typeof l.premium !== 'boolean') return lane(null, !quiet);
    if(running) again = true;
    return Promise.resolve(settle(l));
  }

  function optOut(){ try{ return storage.getItem(OPT_OUT_KEY); }catch(_){ return null; } }
  function setOptOut(licenseId){ try{ storage.setItem(OPT_OUT_KEY, OPT_OUT_ID + licenseId); }catch(_){} }
  function clearOptOut(){ try{ storage.removeItem(OPT_OUT_KEY); }catch(_){} }
  function fullNoticed(){
    let v = null; try{ v = JSON.parse(storage.getItem(FULL_NOTICED_KEY) || '[]'); }catch(_){ v = null; }
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  }
  function saveFullNoticed(ids){
    try{ if(ids.length) storage.setItem(FULL_NOTICED_KEY, JSON.stringify(ids.slice(-FULL_NOTICED_MAX))); else storage.removeItem(FULL_NOTICED_KEY); }catch(_){}
  }
  /* 이 기기가 등록됐다 — 그 라이선스의 기기 가득 안내 기록을 뺀다 */
  function registered(licenseId){
    const ids = fullNoticed();
    if(ids.includes(licenseId)) saveFullNoticed(ids.filter((x) => x !== licenseId));
  }
  /* 기기 가득 — 이 라이선스에 처음이면 적고 true(지금 띄울 차례) · 이미 안내했으면 false */
  function markFull(licenseId){
    if(typeof licenseId !== 'string' || !licenseId) return false;   // id 없는 라이선스 — 기억 · 안내 없음
    const ids = fullNoticed();
    if(ids.includes(licenseId)) return false;
    saveFullNoticed(ids.concat(licenseId));
    return true;
  }
  /* 0.12 값은 한 번만 쓴다 — 저장값이 아직 그 값일 때만 바꾸거나(licenseId) 지운다(null) */
  function settleLegacy(raw, licenseId){
    if(optOut() !== raw) return;
    if(licenseId) setOptOut(licenseId); else clearOptOut();
  }

  /* 켤 때 자동 등록(위 [자동 등록]) — 한 번만 해 본다. 던지지 않는다 */
  async function autoRegister(g, raw){
    const opt = parseOptOut(raw);
    const legacy = !!(opt && opt.legacyKey);
    let l;
    try{ l = await licenseApi.mine(); }
    catch(e){ console.warn('[라이선스] 내 라이선스를 못 읽어 자동 등록을 건너뛰어요', e); return isPremium(); }
    if(g !== gen) return isPremium();
    const missing = !!l && l.status === 'VALID' && !l.devices.some((d) => d.deviceId === deps.deviceId());   // 목록에 있는데 아님이면 서버 판정 그대로
    if(legacy){ settleLegacy(raw, missing ? l.licenseId : null); return isPremium(); }
    if(!missing) return isPremium();
    if(opt && opt.licenseId === l.licenseId) return isPremium();
    let put;
    try{ put = await licenseApi.putDevice(deps.deviceId(), deps.deviceName()); }
    catch(e){
      console.warn('[라이선스] 이 기기를 자동으로 등록하지 못했어요', e);
      if(g === gen && licenseApi.isDeviceFull(e) && markFull(l.licenseId)) deps.toastFull(FULL_NOTICE);
      return isPremium();
    }
    if(g !== gen) return isPremium();
    registered(l.licenseId);
    const on = await fromWrite(put, true);
    if(on && g === gen) deps.toast(AUTO_ON);
    return on;
  }

  /* 서버가 계정을 돌려준 뒤 한 번(켜는 차례 licensePremium) — 받아 둔 확인으로 반영하고 license 알림을 건다. 아니면 자동 등록을 한 번 해 본다. 두 번째 부름은 무시 */
  function start(me){
    if(started){ console.warn('[라이선스] 이미 시작했어요'); return Promise.resolve(isPremium()); }
    started = true;
    unsub = deps.rtOn(KIND, () => { lane(null); });
    const g = gen;
    const raw = optOut();
    seenAtStart = parseOptOut(raw); rawAtStart = raw;
    startP = lane(me).then((on) => {
      if(g === gen && on && seenAtStart && seenAtStart.legacyKey) settleLegacy(raw, null);
      return on;
    });
    return startP;
  }
  /* 첫 실행 뒤 한 번 — took: 이번 첫 실행이 0.12 키로 등록을 해 봤나(참이면 그쪽 몫). 프리미엄이 아니면 자동 등록을 한 번 해 본다. 두 번째 부름은 무시 */
  function autoRegisterAfter(took){
    if(!started || autoAsked) return Promise.resolve(isPremium());
    autoAsked = true;
    const g = gen, raw = rawAtStart;
    return Promise.all([startP, Promise.resolve(took).catch(() => false)]).then(([on, firstRunTook]) => {
      if(g !== gen || on || firstRunTook === true || isPremium()) return isPremium();
      return autoRegister(g, raw);
    });
  }
  /* start 때 본 해제 표시(시작 전이면 지금 값) — 첫 실행 라이선스 키 단계가 자동 등록과 같은 값으로 가르게 */
  function optOutAtStart(){ return started ? seenAtStart : parseOptOut(optOut()); }
  /* 계정이 바뀌거나 세션을 놓을 때 — 알림을 풀고 «모름» 으로 되돌린다(다음 계정 확인이 다시 정한다) */
  function reset(){
    if(unsub){ try{ unsub(); }catch(_){} }
    unsub = null; started = false; seenAtStart = null; rawAtStart = null; startP = null; autoAsked = false; gen++; running = null; again = false; loud = false; notified = false;
    deps.resetKnown();
  }
  /* 지금 서버에 다시 묻는다 → 프리미엄 여부(못 받으면 지금 값) */
  function refresh(){ return lane(null); }

  /* 키 등록 — 돌려주는 것 { ok, reason?, err?, registered?, lic? }. ok 는 서버가 «이 기기에서 프리미엄» 이라고 확인해 준 경우만(registered — 등록은 됐는데 확인이 안 됨 · err — 요청 실패 원본 · lic — 쓰기 응답의 내 라이선스).
     opts.ownerKnown — 부르는 쪽(설정 › 라이선스 화면)이 창 열기에서 이미 내 라이선스를 읽었다 → 쓰기 전 읽기를 건너뛴다(첫 실행 키 올리기는 창이 없어 한 번 읽는다) */
  async function activate(key, opts){
    const k = String(key || '').trim().toUpperCase();
    if(!k) return { ok: false, reason: EMPTY_KEY };
    let l, owned = null;
    const g = gen;   // 쓰기를 기다리는 동안 reset 되면 옛 계정의 답을 버린다
    try{
      if(!(opts && opts.ownerKnown)) owned = await licenseApi.mine();   // 읽은 토큰 주인에 쓰기를 묶는다(등록한 키가 다른 계정으로 가지 않게)
      l = await licenseApi.register(k, { id: deps.deviceId(), name: deps.deviceName() });
    }catch(e){
      const r = { ok: false, err: e, reason: licenseApi.reasonOf(e) || deps.reasonOf(e) };   // err — 첫 실행 키 올리기가 서버 code · 로그인 풀림을 가른다
      if(owned && g === gen && licenseApi.isDeviceFull(e)) r.showFull = markFull(owned.licenseId);   // 기기 가득 안내 기록은 자동 등록과 한 벌 — false 면 이미 안내했다
      return r;
    }
    if(g !== gen) return { ok: false, stale: true, notified: true, reason: '' };
    clearOptOut(); registered(l.licenseId);
    notified = false;
    const premium = await fromWrite(l);
    return premium ? { ok: true, lic: l } : { ok: false, registered: true, notified, reason: NOT_CONFIRMED, lic: l };   // notified — 확인 실패 번호를 이미 띄웠다
  }
  /* 이 기기에서 해제 — 서버 목록에서 이 기기를 뺀다(다른 기기 · 키는 그대로). 돌려주는 것 { ok, reason?, lic? } · opts.ownerKnown — activate 와 같다 */
  async function deactivate(opts){
    let after = null;
    const g = gen;
    try{
      if(opts && opts.ownerKnown) after = await licenseApi.removeDevice(deps.deviceId());
      else{
        const lic = await licenseApi.mine();
        if(lic) after = await licenseApi.removeDevice(deps.deviceId());
      }
    }catch(e){ return { ok: false, err: e, reason: licenseApi.reasonOf(e) || deps.reasonOf(e) }; }
    if(g !== gen) return { ok: false, stale: true, reason: '' };
    if(after) setOptOut(after.licenseId);
    deps.resetCustomStatus();
    await fromWrite(after);
    return { ok: true, lic: after };
  }
  /* 이 기기 등록 — 라이선스는 있는데 이 기기만 목록에 없을 때 [이 기기 등록] 을 누름. 쓰기 전 읽기는 화면이 창 열기에서 했다.
     돌려주는 것 { ok, err?, lic? } — 서버가 «기기를 모두 썼다» 로 거절하면 err.code 로 부르는 쪽이 가른다 */
  async function registerDevice(){
    const g = gen;
    let l;
    try{ l = await licenseApi.putDevice(deps.deviceId(), deps.deviceName()); }
    catch(e){ return { ok: false, err: e, reason: licenseApi.reasonOf(e) || deps.reasonOf(e) }; }
    if(g !== gen) return { ok: false, stale: true, reason: '' };
    clearOptOut(); registered(l.licenseId);
    await fromWrite(l);
    return { ok: true, lic: l };
  }

  return { start, autoRegisterAfter, refresh, activate, deactivate, registerDevice, optOutAtStart, reset };
}

const api = { KIND, AUTO_ON, FULL_NOTICE, OPT_OUT_KEY, FULL_NOTICED_KEY, FULL_NOTICED_MAX, parseOptOut, createLicensePremium };
if(typeof window !== 'undefined') window.TwLicensePremium = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
