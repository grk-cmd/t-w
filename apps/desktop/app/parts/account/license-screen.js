/* license-screen.js — 🔑 설정 › 라이선스 구획의 상태 · 동작 — 내 라이선스(기기 목록) 받기 · 키 등록 · 이 기기 해제 · 다른 기기 빼기 · 이 기기 등록 (검사 sim-license-screen.js)
   [왜] 프리미엄 판정(license-premium.js)은 «이 기기가 지금 프리미엄인가» 하나다. 이 파일은 사용자가 설정 창에서 보는 «내 라이선스 · 기기 목록» 의 상태를 쥐고,
     창 열기 = 받기(GET /v1/me/license) 한 번 · 누른 동작 하나 = 쓰기 하나로 목록을 다시 그린다(쓰기 응답이 곧 새 목록 — 다시 찾기 없음).
   [상태] load: idle(아직 안 열었다) · loading · ready · failed — 받기 전(idle · loading)과 못 받음(failed)에는 단추를 잠근다. lic: null(라이선스 없음 — 못 받음과 다르다) | { licenseId, status, devices[], deviceLimit }.
     «이 기기» 는 deviceId() 와 기기 id 를 견줘 앱이 계산한다 · 기기 상한은 서버 deviceLimit(앱에 숫자를 박지 않는다 — 없으면 «모름» 이라 가득 참을 미리 판단하지 않고 서버 거절을 따른다).
   [겹침] 동작은 한 번에 하나(busy) — 앞 동작이 끝나기 전 누르면 요청 0 · «처리 중이에요» 토스트. 받기는 한 줄로 합친다(도는 중에 또 부르면 끝난 뒤 한 번 더).
     동작 중에 서버 알림으로 받기가 오면 동작이 끝난 뒤로 미룬다. 계정이 바뀌면(reset) gen 이 올라 늦은 답을 버린다.
   [번호] 사용자가 연 · 누른 일의 요청 실패는 번호 — 받기 E-LIC-03 · 이 기기 해제 E-LIC-02 · 기기 빼기 E-LIC-04 · 이 기기 등록 E-LIC-05 · 키 등록(사용자가 못 고치는 실패) E-LIC-06.
     서버 알림으로 받다 실패하면 번호 없이 failed 만 · 같은 받기 실패는 한 번만(성공하면 풀림). 로그인이 풀린 실패(kind auth)는 로그인 흐름 몫이라 알리지 않는다.
     사용자가 고칠 수 있는 서버 code(없는 키 · 남의 키 · 회수된 키 · 이미 라이선스 있음 · 기기 가득)는 번호 없이 입력칸 아래 문구(license-api.js reasonOf).
   deps: licenseApi(mine · removeDevice · reasonOf · isDeviceFull) · licensePremium(activate · deactivate · registerDevice) · deviceId() · isAdmin() · isShown()(설정 라이선스 구획이 보이는 중인가) ·
         rtOn → 해제 함수를 돌려줌 · notifyError · toast
   내놓는 것: open(opts) · state() · view() · submitKey(key) · removeThisDevice() · removeDevice(id) · registerThisDevice() · onChange(fn) · reset(). 순수: fmtTime(iso)
   classic script — license-api.js · license-premium.js 다음 · app.js 보다 먼저 싣는다(window.TwLicenseScreen). */
(function(){
'use strict';

const KIND = 'license';   // realtime 알림 종류(rt-hub.js KINDS)
const MSG = Object.freeze({
  BUSY: '처리 중이에요 — 잠시만 기다려 주세요',
  LOADING: '라이선스 정보를 불러오는 중이에요',
  EMPTY_KEY: '라이선스 키를 입력해 주세요',
  REGISTERED: '🎉 라이선스가 등록됐어요! 꾸미기를 이용할 수 있어요',
  DEACTIVATED: '이 기기에서 라이선스가 해제됐어요',
  REMOVED: '기기를 뺐어요',
  DEVICE_ADDED: '이 기기를 등록했어요',
  DEVICE_FULL: '기기를 모두 썼어요 — 하나를 빼면 등록할 수 있어요',
});
const pad = (n) => String(n).padStart(2, '0');

/* 서버 시각(ISO) → «2026.11.14 15:20»(이 PC 시간대) · 읽을 수 없으면 '' */
function fmtTime(iso){
  const d = new Date(iso);
  if(!iso || isNaN(d.getTime())) return '';
  return d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

/** @param {{ licenseApi: { mine: Function, removeDevice: Function, reasonOf: (e: any) => string | null, isDeviceFull: (e: any) => boolean },
 *   licensePremium: { activate: Function, deactivate: Function, registerDevice: Function },
 *   deviceId: () => string, isAdmin: () => boolean, isShown: () => boolean,
 *   rtOn: (kind: string, fn: Function) => Function, notifyError: (code: string, err: any) => unknown, toast: (msg: string) => unknown }} deps */
function createLicenseScreen(deps){
  const api = deps.licenseApi;
  const premium = deps.licensePremium;
  let load = 'idle';
  let lic = null;
  let busy = false;
  let keyMsg = '';   // 입력칸 아래 문구(사용자가 고칠 수 있는 것)
  let gen = 0;   // reset 마다 올라간다 — await 뒤에 견줘 옛 계정의 늦은 답을 버린다
  let pulling = null, again = false, pullLoud = false;
  let pullAfterBusy = false;
  let stale = false;   // 구획이 안 보이는 동안 서버 알림이 왔다 — 목록이 낡았을 수 있어 다음 열기 · 탭 누름이 다시 받는다
  let failShown = false;   // 받기 실패 번호를 이미 띄웠나 — 이어지는 같은 실패는 한 번만(성공하면 풀림)
  let unsub = null;
  let listener = null;

  const changed = () => { if(listener){ try{ listener(); }catch(e){ console.warn('[라이선스 화면] 다시 그리기 실패', e); } } };
  const authLost = (e) => !!e && e.kind === 'auth';   // 로그인이 풀린 실패 — 로그인 흐름 몫

  function licFrom(l){
    return l ? { licenseId: l.licenseId, status: l.status, devices: l.devices.slice(), deviceLimit: l.deviceLimit == null ? null : l.deviceLimit } : null;
  }

  /* 받기 — 한 줄로 합친다. loud: 사용자가 연 · 누른 받기(실패하면 번호) · 서버 알림으로 받다 실패하면 번호 없이 failed 만 */
  function pull(loud){
    if(loud) pullLoud = true;
    if(pulling){ again = true; return pulling; }
    const g = gen;
    const run = async () => {
      let r = await once(g);
      while(again && g === gen){ again = false; r = await once(g); }
      return r;
    };
    const p = run().finally(() => { if(pulling === p){ pulling = null; pullLoud = false; } });
    pulling = p;
    return p;
  }
  async function once(g){
    if(load !== 'ready'){ load = 'loading'; changed(); }
    const loud = pullLoud; pullLoud = false;
    stale = false;   // 이 받기가 시작한 뒤에 안 보이는 채로 알림이 오면 다시 걸린다 — 성공해도 그것은 지우지 않는다
    let l;
    try{ l = await api.mine(); }
    catch(e){
      if(g !== gen) return false;
      console.warn('[라이선스 화면] 내 라이선스를 못 받았어요', e);
      load = 'failed';
      if(loud && !authLost(e) && !failShown){ failShown = true; deps.notifyError('E-LIC-03', e); }
      changed();
      return false;
    }
    if(g !== gen) return false;   // reset 뒤에 온 옛 답은 버린다
    failShown = false;
    lic = licFrom(l); load = 'ready';
    changed();
    return true;
  }

  /* 설정 라이선스 구획을 열 때 — 창 열기 = 받기. opts.ifNeeded: 이미 받았거나 받는 중이면 다시 받지 않는다(탭만 바꿔 누른 경우) */
  function open(opts){
    if(!unsub) unsub = deps.rtOn(KIND, onNotify);
    if(opts && opts.ifNeeded && !stale && (load === 'ready' || load === 'loading')) return pulling || Promise.resolve(true);
    if(busy){ pullAfterBusy = true; return Promise.resolve(false); }   // 쓰는 중에 받으면 옛 목록이 쓰기 답을 덮는다 — 끝난 뒤에
    return pull(true);
  }
  /* 서버 license 알림 — 구획이 보이는 중에만 받는다(안 보이면 다음 열기가 받는다) */
  function onNotify(){
    if(load === 'idle') return;
    if(!deps.isShown()){ stale = true; return; }
    if(busy){ pullAfterBusy = true; return; }
    pull(false);
  }

  /* 동작 한 번 — 받기 전 · 동작 중이면 요청 0 */
  async function act(run){
    if(load !== 'ready'){ deps.toast(MSG.LOADING); return { ok: false, why: 'not-ready' }; }
    if(busy || pulling){ deps.toast(MSG.BUSY); return { ok: false, why: 'busy' }; }   // 받는 중에 쓰면 받은 옛 목록이 쓰기 답을 덮는다
    busy = true; changed();
    const g = gen;
    let r;
    try{ r = await run(g); }
    finally{
      if(g === gen){
        busy = false;
        changed();
        if(pullAfterBusy){ pullAfterBusy = false; pull(false); }
      }
    }
    return r;
  }

  /* 키 등록 — 돌려주는 것 { ok, reason? } */
  function submitKey(key){
    const k = String(key || '').trim();
    if(!k){ keyMsg = MSG.EMPTY_KEY; changed(); return Promise.resolve({ ok: false, reason: MSG.EMPTY_KEY }); }
    return act(async (g) => {
      keyMsg = '';
      const r = await premium.activate(k, { ownerKnown: true });
      if(g !== gen || r.stale) return { ok: false, stale: true };
      if(r.lic) lic = licFrom(r.lic);   // 등록은 됐다 — 확인이 늦어도 목록은 서버 것
      if(r.ok){ deps.toast(MSG.REGISTERED); return { ok: true }; }
      if(r.registered){ if(!r.notified) keyMsg = r.reason || ''; return { ok: false, registered: true, reason: r.reason }; }   // 확인 실패 번호(E-LIC-01)를 이미 띄웠으면 입력칸에 또 적지 않는다
      if(authLost(r.err)) return { ok: false };
      const fixable = r.err ? api.reasonOf(r.err) : null;
      if(fixable || !r.err){ keyMsg = fixable || r.reason || ''; return { ok: false, reason: keyMsg }; }
      deps.notifyError('E-LIC-06', r.err);
      return { ok: false, err: r.err };
    });
  }
  /* 이 기기에서 해제 */
  function removeThisDevice(){
    return act(async (g) => {
      const r = await premium.deactivate({ ownerKnown: true });
      if(g !== gen || r.stale) return { ok: false, stale: true };
      if(r.ok){ if(r.lic) lic = licFrom(r.lic); deps.toast(MSG.DEACTIVATED); return { ok: true }; }
      if(!authLost(r.err)) deps.notifyError('E-LIC-02', r.err);
      return { ok: false, err: r.err };
    });
  }
  /* 다른 기기 빼기 — 이 기기는 «이 기기에서 해제» 로만 뺀다(프리미엄 판정을 같이 다시 정해야 해서) */
  function removeDevice(deviceId){
    const id = String(deviceId || '');
    return act(async (g) => {
      if(!id || id === deps.deviceId()) return { ok: false, why: 'self' };
      let l;
      try{ l = await api.removeDevice(id); }
      catch(e){
        if(g !== gen) return { ok: false, stale: true };
        if(!authLost(e)) deps.notifyError('E-LIC-04', e);
        return { ok: false, err: e };
      }
      if(g !== gen) return { ok: false, stale: true };
      lic = licFrom(l); deps.toast(MSG.REMOVED);
      return { ok: true };
    });
  }
  /* 이 기기 등록 — 라이선스는 있는데 이 기기가 목록에 없을 때 */
  function registerThisDevice(){
    return act(async (g) => {
      const r = await premium.registerDevice();
      if(g !== gen || r.stale) return { ok: false, stale: true };
      if(r.ok){ if(r.lic) lic = licFrom(r.lic); deps.toast(MSG.DEVICE_ADDED); return { ok: true }; }
      if(authLost(r.err)) return { ok: false };
      if(api.isDeviceFull(r.err)){ deps.toast(MSG.DEVICE_FULL); return { ok: false, full: true }; }
      deps.notifyError('E-LIC-05', r.err);
      return { ok: false, err: r.err };
    });
  }

  /* 화면이 그릴 것 한 벌 — mode: loading(idle 포함) · failed · none(라이선스 없음) · revoked · registered(이 기기 등록됨) · unregistered(있는데 이 기기 없음) */
  function view(){
    const admin = !!deps.isAdmin();
    const base = { admin, busy, keyMsg, canAct: load === 'ready' && !busy, devices: [], limit: null, full: false };
    if(load === 'idle' || load === 'loading') return Object.assign(base, { mode: 'loading', canAct: false });
    if(load === 'failed') return Object.assign(base, { mode: 'failed', canAct: false });
    if(!lic) return Object.assign(base, { mode: 'none' });
    if(lic.status === 'REVOKED') return Object.assign(base, { mode: 'revoked' });
    const here = deps.deviceId();
    const devices = lic.devices.map((d) => ({ id: d.deviceId, name: d.name, here: d.deviceId === here, lastSeen: fmtTime(d.lastSeenAt), registered: fmtTime(d.registeredAt) }));
    const mine = devices.some((d) => d.here);
    const limit = lic.deviceLimit;
    return Object.assign(base, { mode: mine ? 'registered' : 'unregistered', devices, limit, full: limit != null && devices.length >= limit });
  }
  function state(){ return { load, lic: licFrom(lic), busy }; }
  function onChange(fn){ listener = fn || null; }
  /* 계정이 바뀌거나 세션을 놓을 때 — 알림을 풀고 비운다(늦게 온 옛 답은 gen 이 달라 버린다). S-4(세션 dispose)가 부를 자리 */
  function reset(){
    if(unsub){ try{ unsub(); }catch(_){} }
    unsub = null; load = 'idle'; lic = null; busy = false; keyMsg = ''; gen++;
    pulling = null; again = false; pullLoud = false; pullAfterBusy = false; failShown = false; stale = false;
    changed();
  }

  return { open, state, view, submitKey, removeThisDevice, removeDevice, registerThisDevice, onChange, reset };
}

const api = { KIND, MSG, fmtTime, createLicenseScreen };
if(typeof window !== 'undefined') window.TwLicenseScreen = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
