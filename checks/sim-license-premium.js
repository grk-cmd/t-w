/* ═══ 🔑 sim-license-premium.js — 프리미엄 판정(account/license-premium.js · 0.13 앱 묶음 D8-1) ═══
   [무엇을 지키나] 프리미엄은 서버 확인(GET /v2/me 의 premium)만 따른다. 확인 전의 false 는 «모름» 이라, 모르는 동안 전용 자산을 접으면
     프리미엄 사용자의 책상이 켤 때마다 기본으로 떨어졌다 돌아온다(방으로도 나간다). 그래서 판정 모듈 · 계정 핵심 상태 · 전용 자산 접기를 진짜로 이어서 돌려 본다.
   ・1절: 켤 때 반영 — 프리미엄 참이면 라이선스 요청 0 · 아니면 자동 등록(0.12 와 같게): 성공 → 프리미엄 + 토스트 한 번 · 해제 표시 → 요청 없음 · 라이선스 없음 → 읽기만 ·
          0.12 해제 표시는 한 번만 쓰고(바꾸거나 지움) 다른 계정에 안 남음 · 기기 가득 → 안내 토스트 라이선스마다 한 번(A → B → A · 최근 8개) · 그 밖 거절 → 다시 안 함 · 토스트 · 번호 0 · PUT 중 reset → 반영 0 ·
          0.12 키가 남은 PC → 자동 등록은 비켜서고 첫 실행(진짜 first-run-013.js)이 등록 · 기기 가득이면 둘이 나란히 돌아도 요청 하나 · 안내 하나
   ・2절: 알림(license) — 다른 기기에서 바뀐 것 반영 · 겹쳐 와도 요청이 쌓이지 않음 · 못 받으면 지금 값 그대로(혼자 다시 안 함) · 두 번 시작 무시
   ・3절: 키 등록 · 이 기기 해제 — 서버 확인으로만 성공 · 해제하면 해제 표시를 적음 · 키 등록 · [이 기기 등록] 은 지움
   ・4절: ★ 모름 동안 접기 0번 — 계정 핵심 상태 + 전용 자산 접기를 실제로 이어 붙여: 프리미엄은 한 번도 접히지 않고, 아님은 확인 뒤 접힌다
   ・5절: 배선 — 프리미엄을 바꾸는 곳 하나 · 쓰기 응답(PATCH /v2/me)을 따르지 않음 · 시작은 켜는 차례 한 곳
   ・6절: 일부러 깨 보기
   [실행] 러너 스테이징(평면)에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
console.warn = () => {};   // 판정 모듈이 실패를 콘솔에 남긴다 — 검사 출력에는 필요 없다
const pick = (n, d) => [n, 'parts/' + d + '/' + n, 'app/parts/' + d + '/' + n].map(read).find(Boolean);
const SRC = {
  LS: pick('license-screen.js', 'account'),
  LP: pick('license-premium.js', 'account'), AS: pick('account-state.js', 'account'), PA: pick('premium-assets.js', 'character'),
  APP: read('app.js') || read('parts/app.js') || read('app/parts/app.js'),
  FR: pick('first-run-013.js', 'account'),
};
for(const k of Object.keys(SRC)) if(!SRC[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const apiErr = (status, code, kind) => Object.assign(new Error(code || String(status)), { status, code: code || '', kind: kind || (status >= 500 ? 'unavailable' : 'request') });
const ME = (premium) => ({ userCode: 'u12345678', friendCode: 'MATE-AAAA', version: 1, premium, admin: false });
const lic = (ids, status) => ({ licenseId: 'L', status: status || 'VALID', devices: ids.map((id) => ({ deviceId: id, name: 'Mac', registeredAt: '', lastSeenAt: '' })) });
const withPremium = (l, p) => (p === undefined ? l : Object.assign(l, { premium: p }));
const ID = 'dev-mine0001', NAME = 'Mac';
const tick = () => new Promise((r) => setImmediate(r));

function load(src, name){ const w = {}; const m = { exports: {} }; new Function('window', 'module', src)(w, m); return m.exports[name]; }

/* 판정 모듈 한 벌 + 가짜들. me: 켤 때/다시 물을 때 서버가 줄 답(차례대로) · lic: 내 라이선스 읽기 답 */
function env(src, o){
  o = o || {};
  const e = { sets: [], notes: [], calls: [], meQ: (o.me || []).slice(), custom: 0, handlers: [], unsubs: 0, known0: 0, premium: !!o.premium, toasts: [], fulls: [], store: o.store || new Map(o.opt ? [['tw.licenseOptOut', o.opt]] : []) };
  if(o.legacyKey) e.store.set('tw.licenseKey', o.legacyKey === true ? 'K2' : o.legacyKey);
  const meFn = async () => { e.calls.push('me'); const v = e.meQ.length > 1 ? e.meQ.shift() : e.meQ[0]; if(v instanceof Error) throw v; return v; };
  const licenseApi = {
    mine: async () => { e.calls.push('mine'); const v = await (typeof o.mine === 'function' ? o.mine(e) : o.mine); if(v instanceof Error) throw v; return v === undefined ? null : v; },
    putDevice: async (id, name) => { e.calls.push('put:' + id + ':' + name); if(o.onPut) await o.onPut(e); if(o.putError instanceof Error) throw o.putError; return withPremium(lic([id]), e.putPremium === undefined ? undefined : e.putPremium); },
    /* o.regPremium · o.remPremium — 쓰기 응답의 premium(이 기기 판정). 주지 않으면 칸 없음(«모름» — 옛 서버) */
    register: async (key, dev) => { e.calls.push('register:' + key + ':' + dev.id + ':' + dev.name); if(o.register instanceof Error) throw o.register; if(o.onRegister) await o.onRegister(e); return withPremium(lic([dev.id]), o.regPremium); },
    removeDevice: async (id) => { e.calls.push('remove:' + id); if(o.remove instanceof Error) throw o.remove; return withPremium(lic([]), o.remPremium); },
    reasonOf: (err) => (err && err.code === 'LICENSE_OWNED_BY_OTHER' ? '이미 다른 계정에 등록된 키예요' : null),
    isDeviceFull: (err) => !!err && err.code === 'LICENSE_DEVICE_FULL',
  };
  const mod = load(src, 'createLicensePremium')({
    userApi: { me: meFn }, licenseApi, deviceId: () => ID, deviceName: () => NAME,
    setPremium: (v) => { e.sets.push(v); e.premium = !!v; }, isPremium: () => e.premium,
    rtOn: (kind, fn) => { const h = [kind, fn]; e.handlers.push(h); return () => { e.unsubs++; const i = e.handlers.indexOf(h); if(i >= 0) e.handlers.splice(i, 1); }; },
    resetKnown: () => { e.known0++; e.premium = false; },
    notifyError: (code, err) => e.notes.push(code + (err && err.code ? ':' + err.code : '')),
    reasonOf: () => '서버 문구', resetCustomStatus: () => { e.custom++; },
    storage: { getItem: (k) => (e.store.has(k) ? e.store.get(k) : null), setItem: (k, v) => { e.store.set(k, String(v)); }, removeItem: (k) => { e.store.delete(k); } },
    toast: (m) => { e.toasts.push(m); },
    toastFull: (m) => { e.toasts.push(m); e.fulls.push(m); },
  });
  e.mod = mod;
  e.boot = async (me, took) => { const r = await mod.start(me); const a = await mod.autoRegisterAfter(took === true); return r || a; };   // 켜는 차례 — licensePremium 칸 → … → firstRun → licenseAutoRegister 칸
  e.push = () => e.handlers.filter(([k]) => k === 'license').forEach(([, f]) => f({ kind: 'license' }));
  return e;
}

async function judge(S){
  const rows = [];
  let e2;
  const t = (ok, msg) => rows.push([!!ok, msg]);
  const LP = S.LP;

  /* 1. 켤 때 반영 */
  {
    let e = env(LP, { me: [ME(true)], mine: lic([ID]) });
    const r = await e.boot(ME(true));
    t(r === true && e.sets.join() === 'true' && !e.calls.includes('mine') && !e.calls.includes('me'), '프리미엄 참 → 알린다(참) 한 번 · 내 라이선스를 읽지도 확인을 다시 묻지도 않는다');
    t(e.handlers.length === 1 && e.handlers[0][0] === 'license', '  서버 알림 license 를 건다(한 번)');

    const AUTO = '🎫 계정에 등록된 라이선스를 이 PC에서도 켰어요';
    const puts = (x) => x.calls.filter((c) => c.startsWith('put:')).length;
    e = env(LP, { me: [ME(true)], mine: lic(['dev-other001']) });
    e.putPremium = true;
    let r1 = await e.boot(ME(false));
    e.push(); await tick(); await tick(); await tick();
    t(r1 === true && e.calls.slice(0, 2).join() === 'mine,put:' + ID + ':' + NAME && e.sets.slice(0, 2).join() === 'false,true' && e.premium === true,
      '★ 라이선스는 있는데 이 기기만 목록에 없는 새 PC → 읽고 · [이 기기 등록] 과 같은 PUT 하나 → 프리미엄 켬(0.12 와 같게)');
    t(e.toasts.length === 1 && e.toasts[0] === AUTO && e.notes.length === 0 && puts(e) === 1, '  ↳ 토스트 «' + AUTO + '» 한 번 · 알림 뒤에도 다시 등록하지 않는다');

    e = env(LP, { me: [ME(true)], mine: lic(['dev-other001']) });
    await e.boot(ME(false)); await tick();
    t(e.calls.filter((c) => c === 'me').length === 1 && e.premium === true && e.toasts.length === 1, '  ↳ PUT 응답에 premium 이 없으면 GET /v2/me 로 한 번 더 묻고 켠다');

    e = env(LP, { me: [ME(false)], mine: lic(['dev-other001']), opt: 'id:L' });
    t((await e.boot(ME(false))) === false && puts(e) === 0 && e.toasts.length === 0 && e.sets.join() === 'false', '★ 이 라이선스를 이 기기에서 해제했다(tw.licenseOptOut = id:라이선스 id) → 등록 0 · 토스트 0');
    e = env(LP, { me: [ME(false)], mine: lic(['dev-other001']), opt: 'ABCD-EFGH-JKLM-NPQR' });
    await e.boot(ME(false));
    t(puts(e) === 0 && e.toasts.length === 0 && e.store.get('tw.licenseOptOut') === 'id:L', '★ 0.12 가 남긴 해제 표시(키 글자) → 등록 0 · 지금 라이선스 id 로 바꿔 적는다');
    e = env(LP, { me: [ME(false)], mine: lic(['dev-other001']), opt: 'id:OTHER' });
    e.putPremium = true;
    await e.boot(ME(false));
    t(puts(e) === 1 && e.premium === true && e.toasts.length === 1, '  ↳ 다른 라이선스를 해제한 표시(다른 계정 · 새 라이선스) → 등록한다');

    e = env(LP, { me: [ME(false)], mine: null });
    t((await e.boot(ME(false))) === false && e.calls.join() === 'mine' && e.toasts.length === 0 && e.notes.length === 0, '★ 계정에 라이선스가 없음 → 읽기 하나뿐 · 등록 0 · 토스트 0');
    e = env(LP, { me: [ME(false)], mine: lic(['dev-other001'], 'REVOKED') });
    await e.boot(ME(false));
    t(puts(e) === 0 && e.toasts.length === 0, '  ↳ 회수된 라이선스 → 등록 0');
    e = env(LP, { me: [ME(false)], mine: lic([ID]) });
    await e.boot(ME(false));
    t(puts(e) === 0 && e.toasts.length === 0 && e.premium === false, '  ↳ 이 기기가 이미 목록에 있는데 아님 → 서버 판정 그대로(등록 0)');
    e = env(LP, { me: [ME(false)], mine: apiErr(503, '', 'unavailable') });
    await e.boot(ME(false));
    t(puts(e) === 0 && e.notes.length === 0 && e.toasts.length === 0, '  ↳ 라이선스를 못 읽음 → 등록 0 · 번호 0');

    /* 0.12 해제 표시는 한 번만 — 바꾸지 않는 갈래에서는 지운다(다른 계정에 남지 않게) */
    const LEG = 'abcd-efgh-jkLM-NPQR ';
    {
      const store = new Map([['tw.licenseOptOut', LEG]]);
      e = env(LP, { me: [ME(false)], mine: null, store });
      await e.boot(ME(false));
      t(!store.has('tw.licenseOptOut') && puts(e) === 0, '★ 0.12 해제 표시 + 계정에 라이선스 없음 → 표시를 지운다(등록 0)');
      e = env(LP, { me: [ME(false)], mine: lic(['dev-other001']), store });
      e.putPremium = true;
      await e.boot(ME(false));
      t(puts(e) === 1 && e.premium === true && e.toasts.length === 1, '  ↳ 같은 PC 에 다음 계정(유효 · 이 기기 없음) → 앞 계정의 0.12 표시에 막히지 않고 자동 등록');
    }
    for(const [what, o2, pre] of [['회수됨', { mine: lic(['dev-other001'], 'REVOKED') }, false], ['이미 목록에 있음', { mine: lic([ID]) }, false], ['이미 프리미엄', { mine: lic([ID]) }, true]]){
      const store = new Map([['tw.licenseOptOut', LEG]]);
      e = env(LP, Object.assign({ me: [ME(pre)], store }, o2));
      await e.boot(ME(pre));
      t(!store.has('tw.licenseOptOut') && puts(e) === 0, '  ↳ 0.12 표시 + ' + what + ' → 지운다');
    }
    {
      const store = new Map([['tw.licenseOptOut', LEG]]);
      e = env(LP, { me: [ME(false)], mine: apiErr(503, '', 'unavailable'), store });
      await e.boot(ME(false));
      t(store.get('tw.licenseOptOut') === LEG, '  ↳ 라이선스를 못 읽음 → 0.12 표시 그대로(다음 켜기에 가른다)');
      e = env(LP, { me: [ME(false)], store, mine: (x) => { x.store.delete('tw.licenseOptOut'); return lic(['dev-other001']); } });
      await e.boot(ME(false));
      t(!store.has('tw.licenseOptOut') && puts(e) === 0, '★ 읽는 사이 키 등록이 표시를 지웠다 → 옛 값을 다시 적지 않는다');
      store.set('tw.licenseOptOut', LEG);
      e = env(LP, { me: [ME(false)], mine: null, store });
      const pend = e.boot(ME(false));
      const seen = e.mod.optOutAtStart();
      await pend;
      t(seen && seen.legacyKey === 'ABCD-EFGH-JKLM-NPQR' && !store.has('tw.licenseOptOut') && e.mod.optOutAtStart() === seen, '★ optOutAtStart — 켤 때 본 0.12 값(다듬고 대문자)을 지운 뒤에도 그대로 준다(첫 실행이 같은 값으로 가른다)');
    }

    /* 기기 가득 — 안내 토스트 라이선스마다 한 번 */
    {
      const FULL = '라이선스 기기를 모두 썼어요 — 설정 › 라이선스에서 하나를 빼면 이 PC를 등록할 수 있어요';
      const store = new Map();
      e = env(LP, { me: [ME(false)], mine: lic(['a', 'b', 'c']), putError: apiErr(409, 'LICENSE_DEVICE_FULL'), store });
      const rr = await e.boot(ME(false));
      e.push(); e.push(); await tick(); await tick(); await tick(); await tick();
      t(rr === false && puts(e) === 1 && e.toasts.join() === FULL && e.notes.length === 0 && e.premium === false && e.fulls.length === 1 && store.get('tw.licenseFullNoticed') === '["L"]',
        '★ 기기 가득(409 LICENSE_DEVICE_FULL) → PUT 한 번뿐 · 안내 토스트 «' + FULL + '» 한 번 · 번호 0 · 아님 그대로');
      e = env(LP, { me: [ME(false)], mine: lic(['a', 'b', 'c']), putError: apiErr(409, 'LICENSE_DEVICE_FULL'), store });
      await e.boot(ME(false));
      t(puts(e) === 1 && e.toasts.length === 0, '★ 다음 켜기 — 같은 라이선스 → 다시 해 보지만 안내는 다시 안 띄운다');
      e = env(LP, { me: [ME(true)], mine: lic([ID]), store }); e.putPremium = true;
      await e.mod.registerDevice();
      t(!store.has('tw.licenseFullNoticed'), '★ [이 기기 등록] 이 되면 안내 기록을 지운다');
      store.set('tw.licenseFullNoticed', '["L"]');
      e = env(LP, { me: [ME(false)], mine: lic(['dev-other001']), store }); e.putPremium = true;
      await e.boot(ME(false));
      t(!store.has('tw.licenseFullNoticed'), '  ↳ 자동 등록이 되어도 지운다');
      store.set('tw.licenseFullNoticed', '["L"]');
      e = env(LP, { me: [ME(true)], mine: null, regPremium: true, store });
      await e.mod.activate('KEY');
      t(!store.has('tw.licenseFullNoticed'), '  ↳ 키 등록이 되어도 지운다');

      /* 계정 A → B → A — 안내한 라이선스를 여럿 기억한다 */
      const licOf = (id) => Object.assign(lic(['a', 'b', 'c']), { licenseId: id });
      const fullStart = async (id) => { const x = env(LP, { me: [ME(false)], mine: licOf(id), putError: apiErr(409, 'LICENSE_DEVICE_FULL'), store }); await x.boot(ME(false)); return x.fulls.length; };
      store.clear();
      const ab = [await fullStart('A'), await fullStart('B'), await fullStart('A'), await fullStart('B')];
      t(ab.join() === '1,1,0,0' && store.get('tw.licenseFullNoticed') === '["A","B"]', '★ 계정 A → B → A → B(둘 다 기기 가득) → 라이선스마다 한 번씩만(' + ab.join() + ')');
      e = env(LP, { me: [ME(true)], mine: Object.assign(lic([ID]), { licenseId: 'A' }), store }); e.putPremium = true;
      await e.mod.registerDevice();
      t(store.get('tw.licenseFullNoticed') === '["A","B"]', '  ↳ [이 기기 등록] 은 응답의 라이선스 id 만 뺀다(응답 L — A · B 는 그대로)');
      store.set('tw.licenseFullNoticed', '["A","L","B"]');
      e = env(LP, { me: [ME(true)], mine: lic([ID]), store }); e.putPremium = true;
      await e.mod.registerDevice();
      t(store.get('tw.licenseFullNoticed') === '["A","B"]', '  ↳ 등록된 라이선스(L)만 목록에서 뺀다');
      store.clear();
      for(let i = 1; i <= 9; i++) await fullStart('X' + i);
      const kept = JSON.parse(store.get('tw.licenseFullNoticed'));
      t(kept.length === 8 && kept[0] === 'X2' && kept[7] === 'X9', '★ 기억은 최근 8개까지(9개째에 가장 오래된 것을 뺀다)');
      store.set('tw.licenseFullNoticed', '깨진 값');
      t((await fullStart('A')) === 1 && store.get('tw.licenseFullNoticed') === '["A"]', '  ↳ 깨진 기록은 빈 것으로 본다');
    }

    /* 0.12 키(tw.licenseKey)가 남은 PC — 첫 실행이 등록을 맡는다 */
    {
      const FR = load(S.FR, 'licenseKeyStep');
      const LPX = (() => { const m = { exports: {} }; new Function('window', 'module', LP)({}, m); return m.exports; })();
      const side = async (store, opts) => {
        const x = env(LP, Object.assign({ me: [ME(false)], mine: lic(['a', 'b', 'c']), legacyKey: true, register: apiErr(409, 'LICENSE_DEVICE_FULL'), putError: apiErr(409, 'LICENSE_DEVICE_FULL'), store }, opts || {}));
        const step = FR({ storage: { getItem: (k) => (store.has(k) ? store.get(k) : null) }, activate: (k) => x.mod.activate(k),
          optOut: () => x.mod.optOutAtStart(), optOutKey: LPX.OPT_OUT_KEY, fullNotice: LPX.FULL_NOTICE });
        await x.mod.start(ME(false));   // licensePremium 칸
        let tookIs; const took = new Promise((ok) => { tookIs = ok; });
        const auto = x.mod.autoRegisterAfter(took);   // licenseAutoRegister 칸 — 첫 실행이 끝나기를 기다린다
        const r = await step(); tookIs(!!(r && r.took)); await auto;
        if(r && r.notice) x.toasts.push(r.notice);   // 첫 실행 notify 가 띄우는 토스트
        if(r && r.ok) for(const k of r.wipe || []) store.delete(k);   // 첫 실행이 끝나며 지운다
        return { x, r };
      };
      const store = new Map();
      let { x, r } = await side(store);
      const writes = x.calls.filter((c) => c.startsWith('put:') || c.startsWith('register:'));
      t(writes.length === 1 && writes[0].startsWith('register:K2') && x.toasts.length === 1 && x.toasts[0] === LPX.FULL_NOTICE && r.action === 'openSettings',
        '★ 0.12 키 + 기기 가득 · 자동 등록과 첫 실행이 나란히 돎 → 쓰기 요청 하나(첫 실행의 키 등록) · 안내 하나([설정 열기] 달린 같은 글) — ' + writes.join(' ') + ' · 토스트 ' + x.toasts.length);
      t(store.get('tw.licenseFullNoticed') === '["L"]', '  ↳ 첫 실행의 기기 가득도 같은 기억에 적는다');
      x = env(LP, { me: [ME(false)], mine: lic(['a', 'b', 'c']), putError: apiErr(409, 'LICENSE_DEVICE_FULL'), store });
      await x.boot(ME(false));
      t(puts(x) === 1 && x.toasts.length === 0, '  ↳ 키를 지운 다음 켜기 — 자동 등록이 해 보지만 같은 라이선스라 안내 0');
      ({ x, r } = await side(store));
      t(x.toasts.length === 0 && !r.notice, '  ↳ 이미 안내한 라이선스면 첫 실행도 안내 0(showFull false)');
      x = env(LP, { me: [ME(false)], mine: lic(['dev-other001']) });
      await x.boot(ME(false), true);
      t(x.calls.length === 0, '★ 첫 실행이 0.12 키로 등록을 해 봤다(took) → 자동 등록 요청 0(주인은 첫 실행)');
      x = env(LP, { me: [ME(false)], mine: lic(['dev-other001']) }); x.putPremium = true;
      await x.boot(ME(false), false);
      t(puts(x) === 1 && x.toasts.length === 1, '  ↳ 첫 실행이 등록하지 않았다(키 없음 · 해제한 키 · 멈춤) → 자동 등록이 한다');
      x = env(LP, { me: [ME(false)], mine: lic(['dev-other001']) });
      await x.mod.start(ME(false)); await tick(); await tick();
      t(x.calls.length === 0, '★ start 만으로는 요청 0 — 자동 등록은 첫 실행 뒤 칸(autoRegisterAfter)에서');
      x = env(LP, { me: [ME(false)], mine: lic(['dev-other001']), putError: apiErr(503, '', 'unavailable') });
      await x.boot(ME(false)); await x.mod.autoRegisterAfter(false);
      t(puts(x) === 1 && x.calls.filter((c) => c === 'mine').length === 1, '  ↳ autoRegisterAfter 를 두 번 불러도 한 번만(실패한 뒤에도 다시 안 함)');
      x = env(LP, { me: [ME(false)], mine: lic(['dev-other001']) }); x.putPremium = true;
      await x.mod.autoRegisterAfter(false);
      t(x.calls.length === 0, '  ↳ start 전에 부르면 아무것도 안 함');
      {
        x = env(LP, { me: [ME(false)], mine: lic(['dev-other001']) }); x.putPremium = true;
        await x.mod.start(ME(false));
        let done; const firstRun = new Promise((r) => { done = r; });
        const auto = x.mod.autoRegisterAfter(firstRun);
        x.mod.reset(); done(false); await auto; await tick();
        t(x.calls.length === 0 && x.toasts.length === 0, '★ 첫 실행을 기다리는 동안 계정이 바뀜(reset) → 요청 0 · 토스트 0');
      }

      /* 키 단계는 기기 가득(took)으로 끝났는데 뒤 단계가 멈춤 — 진짜 first-run-013.js createFirstRun 으로 */
      {
        const FRM = (() => { const m = { exports: {} }; new Function('window', 'module', S.FR)({}, m); return m.exports; })();
        const store = new Map([['tw.licenseKey', 'K2']]);
        const sto = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
        const OKS = async () => ({ ok: true, wipe: [] });
        const bootAll = async (stall) => {
          const y = env(LP, { me: [ME(false)], mine: lic(['a', 'b', 'c']), register: apiErr(409, 'LICENSE_DEVICE_FULL'), putError: apiErr(409, 'LICENSE_DEVICE_FULL'), store });
          const fr = FRM.createFirstRun({ steps: { login: OKS, gacha: OKS, mallang: OKS, myhome: OKS, legacySync: OKS, chal: OKS,
            licenseKey: FRM.licenseKeyStep({ storage: sto, activate: (k) => y.mod.activate(k), optOut: () => y.mod.optOutAtStart(), optOutKey: LPX.OPT_OUT_KEY, fullNotice: LPX.FULL_NOTICE }),
            focus: async () => (stall ? { ok: false, reason: '멈춤' } : OKS()) }, storage: sto, userCode: () => 'u12345678', log: { warn(){} }, notify: (m) => y.toasts.push(m) });
          await y.mod.start(ME(false));                       // licensePremium 칸
          const run = fr.run();                               // firstRun 칸
          await y.mod.autoRegisterAfter(fr.licenseDone());   // licenseAutoRegister 칸
          await run;
          return y;
        };
        let y = await bootAll(true);
        const w1 = y.calls.filter((c) => c.startsWith('put:') || c.startsWith('register:'));
        t(w1.length === 1 && w1[0].startsWith('register:K2') && y.toasts.length === 1 && y.toasts[0] === LPX.FULL_NOTICE,
          '★ 키 단계 기기 가득 + 뒤 단계 멈춤 → 자동 등록의 덧 요청 0(쓰기는 첫 실행의 키 등록 하나) · 기기 가득 안내 한 번 — ' + w1.join(' ') + ' · 토스트 ' + y.toasts.length);
        y = await bootAll(false);
        t(y.toasts.length === 0 && !y.calls.some((c) => c.startsWith('put:')), '  ↳ 다음 켜기(멈춤 풀림) — 첫 실행이 키를 다시 올려도 같은 라이선스라 안내 0 · 자동 등록 0');
      }
    }
    e = env(LP, { me: [ME(false)], mine: lic(['a', 'b', 'c']), putError: apiErr(503, '', 'unavailable') });
    const r5 = await e.boot(ME(false));
    e.push(); e.push(); await tick(); await tick(); await tick(); await tick();
    t(r5 === false && puts(e) === 1 && e.toasts.length === 0 && e.notes.length === 0 && e.premium === false && !e.store.has('tw.licenseFullNoticed'),
      '★ 그 밖 거절(5xx) → PUT 한 번뿐(알림 뒤에도 다시 안 함) · 토스트 0 · 번호 0 · 아님 그대로');

    {
      let release; const slow = new Promise((r) => { release = r; });
      e = env(LP, { me: [ME(true)], mine: lic(['dev-other001']), onPut: () => slow });
      e.putPremium = true;
      const p = e.boot(ME(false)); await tick(); await tick();
      e.mod.reset(); release(); await p; await tick();
      t(puts(e) === 1 && e.toasts.length === 0 && e.premium === false && !e.sets.includes(true), '★ PUT 을 기다리는 동안 계정이 바뀜(reset) → 프리미엄 반영 0 · 토스트 0');
    }

    {
      let release; const slow = new Promise((r) => { release = r; });
      const store = new Map();
      e = env(LP, { me: [ME(false)], mine: lic(['a', 'b', 'c']), putError: apiErr(409, 'LICENSE_DEVICE_FULL'), onPut: () => slow, store });
      const p = e.boot(ME(false)); await tick(); await tick(); await tick();
      e.mod.reset(); release(); await p; await tick();
      t(puts(e) === 1 && e.toasts.length === 0 && !store.has('tw.licenseFullNoticed'), '★ 기기 가득으로 거절되는 PUT 을 기다리는 동안 계정이 바뀜(reset) → 옛 세션의 기억 쓰기 0 · 토스트 0');
    }
    for(const bad of ['', undefined]){
      const store = new Map();
      e = env(LP, { me: [ME(false)], mine: Object.assign(lic(['a', 'b', 'c']), { licenseId: bad }), putError: apiErr(409, 'LICENSE_DEVICE_FULL'), store });
      await e.boot(ME(false));
      e2 = env(LP, { me: [ME(false)], mine: Object.assign(lic(['a', 'b', 'c']), { licenseId: bad }), register: apiErr(409, 'LICENSE_DEVICE_FULL'), store });
      const ra = await e2.mod.activate('KEY');
      t(e.toasts.length === 0 && !store.has('tw.licenseFullNoticed') && ra.showFull === false, '★ 라이선스 id 가 ' + JSON.stringify(bad) + ' → 기기 가득 기억 · 안내 없음([null] 같은 값을 적지 않는다 · 첫 실행도 안내 0)');
    }

    {
      let release; const slow = new Promise((r) => { release = r; });
      e = env(LP, { me: [ME(false)], mine: () => slow });
      const p = e.boot(ME(false)); await tick();
      e.mod.reset(); release(lic(['dev-other001'])); await p; await tick();
      t(puts(e) === 0 && e.toasts.length === 0, '★ 라이선스를 읽는 동안 계정이 바뀜(reset) → 옛 계정으로 등록 0');
    }
  }

  /* 2. 알림 */
  {
    let e = env(LP, { me: [ME(false)], mine: null });
    await e.mod.start(ME(true));
    e.push(); await tick(); await tick(); await tick();
    t(e.sets.join() === 'true,false' && e.premium === false, '다른 기기에서 키가 회수됨(license 알림) → 서버에 다시 묻고 아님으로 바꾼다');

    e = env(LP, { me: [ME(true)], mine: null });
    await e.mod.start(ME(true));
    let n = 0; const orig = e.calls.push.bind(e.calls);
    e.calls.push = (c) => { if(c === 'me') n++; return orig(c); };
    for(let i = 0; i < 10; i++) e.push();
    await tick(); await tick(); await tick(); await tick();
    t(n <= 2, '★ 알림이 몰려 와도 확인 요청이 쌓이지 않는다(도는 중에는 끝난 뒤 한 번 더 — 열 번 → ' + n + '번)');

    /* 도는 중에 온 알림은 버리지 않는다 — 첫 확인(옛 답 true)이 도는 사이 키가 회수되면, 끝난 뒤 최신(false)으로 한 번 더 받아야 한다 */
    {
      let release; const slow = new Promise((r) => { release = r; });
      e = env(LP, { me: [slow, ME(false)], mine: null });
      await e.mod.start(ME(true));
      e.push(); await tick();
      e.push(); await tick();
      release(ME(true)); await tick(); await tick(); await tick(); await tick();
      t(e.premium === false && e.calls.filter((c) => c === 'me').length === 2 && e.sets.join() === 'true,true,false',
        '★ 확인이 도는 중에 온 알림 → 끝난 뒤 최신으로 한 번 더 받는다(옛 답 «참» 에 머물지 않음 — me 2번 · ' + e.sets.join() + ')');
    }

    e = env(LP, { me: [apiErr(0, '', 'unavailable')], mine: null });
    await e.mod.start(ME(true));
    e.push(); await tick(); await tick(); await tick();
    t(e.premium === true && e.sets.join() === 'true' && e.notes.length === 0, '★ 알림 뒤 못 받음 → 지금 값 그대로 · 오류 번호 0(신호로 받다 실패는 조용) · 혼자 다시 묻지 않는다');
    const meCalls = e.calls.filter((c) => c === 'me').length;
    await tick(); await tick();
    t(e.calls.filter((c) => c === 'me').length === meCalls, '  (실패 뒤 요청이 더 가지 않음)');

    e = env(LP, { me: [ME(true)], mine: null });
    await e.mod.start(ME(true));
    await e.mod.start(ME(true));
    t(e.handlers.length === 1 && e.sets.length === 1, '두 번 시작해도 알림은 한 번만 건다');

    e = env(LP, { me: [apiErr(401, 'AUTH_REQUIRED', 'auth')], mine: null, premium: true });
    await e.mod.start(ME(true)); e.push(); await tick(); await tick(); await tick();
    t(e.premium === true && e.notes.length === 0, '로그인이 풀린 실패(kind auth)는 알리지 않는다 — 로그인 흐름 몫');

    /* 사용자 동작 뒤 확인 실패 → 번호 한 번(알림 · 입력칸에 같은 실패를 또 적지 않게 notified) */
    e = env(LP, { me: [apiErr(0, '', 'unavailable')], mine: null, premium: false });
    const ur = await e.mod.activate('KEY');
    t(ur.ok === false && ur.registered === true && ur.notified === true && e.notes.length === 1 && e.notes[0].startsWith('E-LIC-01'), '★ 키 등록 뒤 확인 실패 → 번호 한 번 · notified(입력칸 문구 중복 없음)');
    const lastLoud = e.notes.length;
    e.push(); await tick(); await tick(); await tick();
    t(e.notes.length === lastLoud, '  ↳ 그 뒤 알림으로 받다 실패하면 번호 안 늘어난다(동작 뒤 한 번뿐)');

    e = env(LP, { me: [ME(true)], mine: null, regPremium: true, onRegister: (x) => { x.mod.reset(); } });
    const us = await e.mod.activate('KEY');
    t(us.ok === false && us.stale === true && e.sets.length === 0 && e.notes.length === 0, '★ 키 등록 응답을 기다리는 동안 reset → 옛 계정의 쓰기 답은 반영 0 · 번호 0');

    /* D8-2 — 설정 › 라이선스 화면이 창 열기에서 이미 읽었다(ownerKnown) → 쓰기 전 읽기 0 · 응답의 내 라이선스(lic)를 돌려준다 */
    e = env(LP, { me: [ME(true)], mine: lic([ID]), regPremium: true });
    const ok1 = await e.mod.activate('key', { ownerKnown: true });
    t(ok1.ok === true && ok1.lic && ok1.lic.devices[0].deviceId === ID && !e.calls.includes('mine') && e.calls.join() === 'register:KEY:' + ID + ':' + NAME, '★ 화면이 읽어 둔 뒤의 키 등록 → 쓰기 전 읽기(mine) 0 · 요청 하나 · 응답의 내 라이선스를 돌려줌(첫 실행은 ownerKnown 없이 부르면 읽기 1)');
    e = env(LP, { me: [ME(true)], mine: lic([ID]), regPremium: true });
    await e.mod.activate('key');
    t(e.calls[0] === 'mine', '  ↳ ownerKnown 없이 부르면(첫 실행 키 올리기) 쓰기 전에 한 번 읽는다');
    e = env(LP, { me: [ME(true)], mine: lic([ID]), remPremium: false });
    const dk = await e.mod.deactivate({ ownerKnown: true });
    t(dk.ok === true && dk.lic && dk.lic.devices.length === 0 && e.calls.join() === 'remove:' + ID && e.sets.join() === 'false' && e.custom === 1, '★ 해제(ownerKnown) → 읽기 0 · 삭제 하나 · 응답 premium 으로 반영(거짓) · 커스텀 상태 기본으로');
    {
      e = env(LP, { me: [ME(true)], mine: lic([ID]) });
      e.putPremium = true;
      const calls = e.calls;
      const rd = await e.mod.registerDevice();
      t(rd.ok === true && rd.lic && calls.some((c) => c === 'put:' + ID + ':' + NAME) && !calls.includes('mine'), '★ 이 기기 등록 → 이 기기 id · 이름으로 PUT 하나 · 읽기 0 · 응답의 내 라이선스를 돌려줌(프리미엄은 응답 premium 으로 반영)');
      e = env(LP, { me: [ME(true)], mine: lic([ID]), putError: apiErr(409, 'LICENSE_DEVICE_FULL') });
      const rf = await e.mod.registerDevice();
      t(rf.ok === false && rf.err && rf.err.code === 'LICENSE_DEVICE_FULL' && e.notes.length === 0 && e.sets.length === 0, '  ↳ 등록 거절 → 오류 원본을 돌려줌(번호는 부르는 화면이 가른다) · 프리미엄 반영 0');
    }

    e = env(LP, { me: [apiErr(401, 'AUTH_REQUIRED', 'auth')], mine: null });
    const ua = await e.mod.activate('KEY');
    t(ua.ok === false && e.notes.length === 0, '  ↳ 동작 뒤 확인이 로그인 풀림이면 번호 없음(로그인 흐름 몫)');

    /* reset — 알림 해제 · 모름으로 · 늦은 답 버림 · 다시 시작 가능 */
    e = env(LP, { me: [ME(true)], mine: null });
    await e.mod.start(ME(true));
    e.mod.reset();
    t(e.unsubs === 1 && e.handlers.length === 0 && e.known0 === 1, '★ reset → 알림 구독을 푼다 · «모름» 으로 되돌린다(남은 구독 0)');
    e.push(); await tick(); await tick();
    t(!e.calls.includes('me'), '  ↳ reset 뒤 license 알림 → GET 0');
    {
      let release; const slow = new Promise((r) => { release = r; });
      e = env(LP, { me: [slow], mine: null });
      await e.mod.start(ME(true)); e.push(); await tick();
      e.mod.reset(); release(ME(true)); await tick(); await tick(); await tick();
      t(e.sets.join() === 'true' && e.premium === false, '★ reset 뒤 늦게 온 옛 답 → 반영 0(setPremium 더 안 부름)');
      const again = await e.mod.start(ME(false));
      t(again === false && e.handlers.length === 1, '  ↳ reset 뒤 다시 시작하면 구독을 새로 건다');
    }

    e = env(LP, { me: [ME(false)], mine: null });
    t((await e.mod.refresh()) === false && e.sets.join() === 'false', 'refresh — 지금 서버에 묻고 반영한다');
  }

  /* 3. 키 등록 · 이 기기 해제 */
  {
    let e = env(LP, { me: [ME(true)], mine: null });
    const r = await e.mod.activate('  abcd-1234 ');
    t(r.ok === true && e.calls.join() === 'mine,register:ABCD-1234:' + ID + ':' + NAME + ',me' && e.sets.join() === 'true', '키 등록 — 읽고(주인 기억) → 대문자로 등록 → 서버 확인이 참이어야 성공');

    e = env(LP, { me: [ME(true)], mine: null });
    const r0 = await e.mod.activate('   ');
    t(r0.ok === false && r0.reason && e.calls.length === 0, '빈 키 → 요청 0');

    e = env(LP, { me: [ME(true)], mine: null, register: apiErr(409, 'LICENSE_OWNED_BY_OTHER') });
    const r1 = await e.mod.activate('KEY');
    t(r1.ok === false && r1.err && r1.err.code === 'LICENSE_OWNED_BY_OTHER' && r1.reason === '이미 다른 계정에 등록된 키예요' && e.sets.length === 0 && e.calls.every((c) => c !== 'me'), '다른 계정의 키 → 표의 문구 · 프리미엄을 바꾸지 않는다');

    e = env(LP, { me: [ME(true)], mine: null, register: apiErr(503, '', 'unavailable') });
    const r2 = await e.mod.activate('KEY');
    t(r2.ok === false && r2.reason === '서버 문구', '그 밖 실패 → 공통 문구');

    e = env(LP, { me: [ME(false)], mine: null });
    const r3 = await e.mod.activate('KEY');
    t(r3.ok === false && r3.registered === true && /잠시 뒤/.test(r3.reason) && !/다시 켜/.test(r3.reason) && e.sets.join() === 'false', '등록은 됐는데 서버가 아직 «아님» → 성공이라 하지 않는다');

    e = env(LP, { me: [ME(false)], mine: lic([ID]), premium: true });
    const d = await e.mod.deactivate();
    t(d.ok === true && e.calls.join() === 'mine,remove:' + ID + ',me' && e.custom === 1 && e.sets.join() === 'false', '이 기기에서 해제 — 읽고 → 서버 목록에서 이 기기만 빼고 → 확인(아님) · 커스텀 상태를 기본으로');
    t(!e.calls.some((c) => c.startsWith('put:')) && e.store.get('tw.licenseOptOut') === 'id:L', '  ↳ 해제 표시(id:라이선스 id)를 적는다 — 다음에 켜도 자동 등록하지 않는다 · 해제 직후 다시 등록 0');
    e = env(LP, { me: [ME(false)], mine: lic(['dev-other001']), remPremium: false, premium: true });
    await e.mod.deactivate({ ownerKnown: true });
    e.mod.reset(); await e.boot(ME(false));
    t(!e.calls.some((c) => c.startsWith('put:')) && e.toasts.length === 0, '★ 해제 → 다음 켜기 → 자동 등록 0(0.12 «이 기기에서 해제» 와 같게)');
    e = env(LP, { me: [ME(true)], mine: null, regPremium: true, opt: 'id:L' });
    await e.mod.activate('KEY');
    t(!e.store.has('tw.licenseOptOut'), '  ↳ 키를 넣으면 해제 표시를 지운다');
    e = env(LP, { me: [ME(true)], mine: lic([ID]), opt: 'id:L' }); e.putPremium = true;
    await e.mod.registerDevice();
    t(!e.store.has('tw.licenseOptOut'), '  ↳ [이 기기 등록] 을 누르면 해제 표시를 지운다');
    e = env(LP, { me: [ME(true)], mine: lic([ID]), opt: 'id:L', putError: apiErr(409, 'LICENSE_DEVICE_FULL') });
    await e.mod.registerDevice();
    t(e.store.get('tw.licenseOptOut') === 'id:L', '  ↳ [이 기기 등록] 이 거절되면 해제 표시는 그대로');

    e = env(LP, { me: [ME(false)], mine: null, premium: false });
    const d2 = await e.mod.deactivate();
    t(d2.ok === true && !e.calls.some((c) => c.startsWith('remove:')), '라이선스가 없으면 뺄 것이 없다(빼기 요청 0)');

    e = env(LP, { me: [ME(false)], mine: null, regPremium: true });
    const w1 = await e.mod.activate('KEY');
    t(w1.ok === true && e.calls.join() === 'mine,register:KEY:' + ID + ':' + NAME && e.sets.join() === 'true', '★ 등록 응답에 premium 이 있으면 그것으로 반영 — GET /v2/me 를 다시 묻지 않는다(요청 둘)');
    e = env(LP, { me: [ME(true)], mine: null, regPremium: false });
    const w2 = await e.mod.activate('KEY');
    t(w2.ok === false && /잠시 뒤/.test(w2.reason) && e.sets.join() === 'false' && !e.calls.includes('me'), '  등록 응답 premium:false → 성공이라 하지 않는다(GET 없이)');
    e = env(LP, { me: [ME(true)], mine: lic([ID]), remPremium: false, premium: true });
    const w3 = await e.mod.deactivate();
    t(w3.ok === true && e.calls.join() === 'mine,remove:' + ID && e.sets.join() === 'false' && e.custom === 1, '★ 해제 응답 premium 으로 반영 — GET /v2/me 없이(서버 GET 은 아직 참이어도 따르지 않음)');
    {
      let release; const slow = new Promise((r) => { release = r; }).then(() => ME(true));
      e = env(LP, { me: [slow, ME(false)], mine: null, regPremium: false });
      const p0 = e.mod.refresh();   // 도는 확인(늦게 끝남 — 등록 전의 «참»)
      const pa = e.mod.activate('KEY');
      await tick();   // 등록 응답이 도는 확인보다 먼저 온다
      release(); await Promise.all([p0, pa]);
      t(e.premium === false && e.calls.filter((c) => c === 'me').length === 2, '★ 도는 확인 중에 쓰기 응답이 오면 끝난 뒤 한 번 더 묻는다 — 늦게 온 옛 답이 마지막 값이 되지 않게');
    }
    const boom = apiErr(503, '', 'unavailable');
    e = env(LP, { me: [ME(false)], mine: lic([ID]), remove: boom, premium: true });
    const d3 = await e.mod.deactivate();
    t(d3.ok === false && d3.err === boom && e.custom === 0 && e.sets.length === 0, '해제 실패 → 아무것도 안 바꾼다(커스텀 상태 · 프리미엄) · 오류(err)를 돌려줘 부르는 쪽이 번호로 알린다');
  }

  /* 4. ★ 서버 locked 를 받기 전엔 접기 0번 — 진짜 account-state + premium-assets 를 이어서(레코드는 카탈로그가 와야 생기고, 서버가 사람마다 locked 를 정해 싣는다) */
  {
    const any = new Proxy(function(){}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : any), apply: () => any, construct: () => any, set: () => true, has: () => true });
    const boot = async (o) => {
      const world = { premium: false, saves: 0, pushes: 0, redraws: [], recs: [] };
      const win = {};
      const asApi = new Function('window', 'companion', 'localStorage', 'setTimeout', 'module', S.AS + '\nreturn window.TwAccountState;')(win, any, any, (f) => f(), undefined).createAccountState({ isPremium: () => world.premium, isAdmin: () => false, setIsPremium: (v) => { world.premium = v; } });
      const def = { deskCatalogId: 'desk_gaming', deskScale: 1, deskLenX: 1, deskColor: 0 };
      const seat = { isMe: true, charDef: def };
      const PA = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'addEventListener', 'removeEventListener', 'module',
        o.paSrc + '\nreturn window.TwPremiumAssets;')({}, any, { getItem: () => null, setItem(){}, removeItem(){} }, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined).createPremiumAssets({
        DEFAULT_DESK_OVERRIDE_ID: '__d__', Presence: () => ({ active: () => true, updateDef: () => { world.pushes++; } }),
        applyDeskCatalogRefToSeat: (s, d) => { world.redraws.push(d.deskCatalogId); }, cBase: () => null, deskItemDef: () => ({}), deskPartAnchorOf: () => null, equipDeskItem: () => {},
        findMySeat: () => seat, isAdmin: () => false, isPremium: () => world.premium, licenseAssetBlocked: (it) => asApi.licenseAssetBlocked(it), saveSlots: () => { world.saves++; },
        savedDesks: () => world.recs, savedItems: () => [], seats: [seat], slots: () => [def], toast: () => {},
      });
      // 판정 모듈의 setPremium 을 진짜 계정 핵심 상태(위)로 잇는다
      const mod = load(LP, 'createLicensePremium')({
        userApi: { me: async () => ME(o.premium) }, licenseApi: { mine: async () => null, putDevice: async () => lic([ID]), register: async () => lic([ID]), removeDevice: async () => lic([]), reasonOf: () => null },
        deviceId: () => ID, deviceName: () => NAME, setPremium: (v) => asApi._setPremium(v), isPremium: () => world.premium,
        rtOn: () => () => {}, notifyError: () => {}, reasonOf: () => '', resetCustomStatus: () => {},
        storage: { getItem: () => null, setItem(){}, removeItem(){} }, toast: () => {}, toastFull: () => {},
      });
      // 켜기 순서 — ① 슬롯 불러오기(onLoaded)가 접기를 부른다(서버 확인 전) ② 카탈로그 도착이 또 부른다 ③ 서버 확인이 온다
      const early = [PA.pruneUnownedLicenseAssets(), PA.pruneUnownedLicenseAssets()];
      const snapshotBefore = JSON.stringify(def);
      await mod.start(ME(o.premium));
      const mid = [PA.pruneUnownedLicenseAssets()];   // 서버 확인은 왔지만 카탈로그가 아직 — 레코드가 없다
      world.recs = [{ id: 'desk_gaming', licenseOnly: true, locked: !o.premium }];   // 카탈로그 도착 — 서버가 이 사람에게 정한 locked
      PA.restoreLicenseHeldAssets(); PA.pruneUnownedLicenseAssets();   // catalog-sync 가 부르는 순서
      return { world, def, early, mid, snapshotBefore, asApi };
    };
    const good = await boot({ premium: true, paSrc: S.PA });
    t(good.early.join() === '0,0' && good.mid.join() === '0' && good.world.saves === 0 && good.world.pushes === 0 && good.world.redraws.length === 0,
      '★ 카탈로그(locked)가 오기 전에 슬롯 불러오기 · 서버 확인이 접기를 불러도 접지도 · 저장도 · 방에 내보내지도 · 다시 그리지도 않는다');
    t(good.def.deskCatalogId === 'desk_gaming' && !('deskLicenseHold' in good.def) && good.world.saves === 0 && good.world.pushes === 0,
      '★ 프리미엄 사용자 — 서버가 locked:false 로 주니 책상은 한 번도 접히지 않는다(깜빡임 · 방 전파 0)');
    const none = await boot({ premium: false, paSrc: S.PA });
    t(none.early.join() === '0,0' && none.mid.join() === '0' && none.def.deskCatalogId === null && none.def.deskLicenseHold === 'desk_gaming' && none.world.saves === 0,
      '프리미엄이 아닌 사용자 — locked 를 받기 전은 그대로, 서버가 locked:true 로 주면 그때 화면에서만 접는다(저장 0)');
    const broken = await boot({ premium: true, paSrc: S.PA.split('rec.locked === true').join('rec.licenseOnly') });
    t(S.PA.includes('rec.locked === true') && (broken.world.pushes > 0 || broken.def.deskCatalogId === null), '  ↳ 깨 보기: 분류(licenseOnly)로 접으면 프리미엄 사용자도 접힌다(= 위 판정이 빨강이 된다)');
  }

  /* 5. 배선 */
  {
    const A = S.APP, strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
    const lpc = strip(LP);
    t(!/\bupdateMe\b|\bpatchMe\b|\bmeCache\b|premiumGraceSec|tw\.licenseKey|LICENSE_KEY_STORAGE/.test(lpc), '프리미엄은 GET /v2/me 확인에서만 — 쓰기 응답(PATCH) · 이 PC 의 사본 · 저장된 키 · 24시간 유예를 따르지 않는다');
    const setCalls = (A.match(/_setPremium\(/g) || []).length;
    t(setCalls === 1 && /setPremium: \(v\)=>acctStateMod\._setPremium\(v\),/.test(A), 'app.js 에서 _setPremium 을 잇는 곳은 판정 모듈 하나');
    t((A.match(/licensePremiumMod\.start\(/g) || []).length === 1 && /licensePremium: \(code, me, session\)=>\{ session\.onReset\(\(\)=>licensePremiumMod\.reset\(\)\); return licensePremiumMod\.start\(me\); \}/.test(A), '시작은 켜는 차례 한 곳(계정 확인이 준 me 로) · 세션이 끝나면 reset 을 부른다 — 만들 때 요청 · 구독 없음');
    t(!/loadLicenseFromStorage|startLicenseVerify|redeemLicense|verifyLicense/.test(A), '옛 길(이 PC 키로 먼저 켜기 · Firebase 로 재검증)이 app.js 에 없다');
    t(/premium\.deactivate\(\{ ownerKnown: true \}\);\n\s*if\(g !== gen \|\| r\.stale\) return/.test(S.LS), '  reset 으로 버린 늦은 답(stale)은 부르는 쪽이 알리지 않는다(설정 › 라이선스 화면 해제)');
    t(/made = true|createLicensePremium/.test(A) && !/licensePremiumMod\.(refresh|activate|deactivate)\(/.test(A.replace('activate: (key)=>licensePremiumMod.activate(key),', '')), '  버튼은 모듈(license-screen.js)이 부른다 — app.js 는 첫 실행 키 올리기(D8-3)가 쓰는 activate 한 줄만');
  }
  return rows;
}

(async () => {
  const rows = await judge(SRC);
  rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1~5. 판정 모듈을 실제로 돌려 본다'); chk(ok, msg); });
  say('── 6. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
  const mut = (k, f) => Object.assign({}, SRC, { [k]: f(SRC[k]) });
  const breaks = [
    ['프리미엄을 확인 응답이 오기 전에 먼저 켬', mut('LP', (s) => s.replace("function settle(me){\n    setPremium(me.premium === true);", "function settle(me){\n    setPremium(true);\n    setPremium(me.premium === true);"))],
    ['켤 때 자동 등록을 안 함', mut('LP', (s) => s.replace("      return autoRegister(g, raw);\n", "      return on;\n"))],
    ['자동 등록 성공에 토스트를 안 띄움', mut('LP', (s) => s.replace("if(on && g === gen) deps.toast(AUTO_ON);", ""))],
    ['자동 등록 실패에도 토스트를 띄움', mut('LP', (s) => s.replace("console.warn('[라이선스] 이 기기를 자동으로 등록하지 못했어요', e);", "deps.toast(AUTO_ON);"))],
    ['자동 등록 실패를 오류 번호로 알림', mut('LP', (s) => s.replace("const on = await fromWrite(put, true);", "const on = await fromWrite(put);").replace("console.warn('[라이선스] 이 기기를 자동으로 등록하지 못했어요', e);", "deps.notifyError('E-LIC-05', e);"))],
    ['기기 가득 안내를 라이선스마다 한 번이 아니라 켤 때마다', mut('LP', (s) => s.replace("if(ids.includes(licenseId)) return false;", ""))],
    ['기기 가득 안내를 안 띄움', mut('LP', (s) => s.replace("if(g === gen && licenseApi.isDeviceFull(e) && markFull(l.licenseId)) deps.toastFull(FULL_NOTICE);", ""))],
    ['5xx 에도 기기 가득 안내', mut('LP', (s) => s.replace("if(g === gen && licenseApi.isDeviceFull(e) && markFull(l.licenseId))", "if(g === gen && markFull(l.licenseId))"))],
    ['기기 가득 안내를 [설정 열기] 없는 토스트로', mut('LP', (s) => s.replace("deps.toastFull(FULL_NOTICE);", "deps.toast(FULL_NOTICE);"))],
    ['기기 가득 기억이 하나뿐(A → B → A 에 또 뜸)', mut('LP', (s) => s.replace("saveFullNoticed(ids.concat(licenseId));", "saveFullNoticed([licenseId]);"))],
    ['기기 가득 기억이 끝없이 늘어남', mut('LP', (s) => s.replace("JSON.stringify(ids.slice(-FULL_NOTICED_MAX))", "JSON.stringify(ids)"))],
    ['등록되면 기억을 통째로 지움(다른 라이선스 기억도)', mut('LP', (s) => s.replace("if(ids.includes(licenseId)) saveFullNoticed(ids.filter((x) => x !== licenseId));", "saveFullNoticed([]);"))],
    ['자동 등록 뒤 안내 기록을 안 지움', mut('LP', (s) => s.replace("    registered(l.licenseId);\n    const on", "    const on"))],
    ['[이 기기 등록] 뒤 안내 기록을 안 지움', mut('LP', (s) => s.replace("clearOptOut(); registered(l.licenseId);\n    await fromWrite(l);", "clearOptOut();\n    await fromWrite(l);"))],
    ['키 등록이 해제 표시를 안 지움', mut('LP', (s) => s.replace("clearOptOut(); registered(l.licenseId);\n    notified = false;", "registered(l.licenseId);\n    notified = false;"))],
    ['[이 기기 등록] 이 해제 표시를 안 지움', mut('LP', (s) => s.replace("clearOptOut(); registered(l.licenseId);\n    await fromWrite(l);", "registered(l.licenseId);\n    await fromWrite(l);"))],
    ['첫 실행이 0.12 키로 등록했어도 자동 등록함(요청 · 안내 두 벌)', mut('LP', (s) => s.replace("firstRunTook === true || ", ""))],
    ['첫 실행을 기다린 뒤 reset 을 안 봄', mut('LP', (s) => s.replace("if(g !== gen || on || firstRunTook === true || isPremium()) return isPremium();", "if(on || firstRunTook === true || isPremium()) return isPremium();"))],
    ['첫 실행 뒤 단계가 멈추면 took 을 잃음', mut('FR', (s) => s.replace("reason: (r && r.reason) || '', took };", "reason: (r && r.reason) || '' };"))],
    ['첫 실행 뒤 단계가 멈추면 기기 가득 안내가 안 뜸', mut('FR', (s) => s.replace("        tell(notices.filter((n) => n.took));\n", ""))],
    ['첫 실행 전에 start 에서 바로 자동 등록', mut('LP', (s) => s.replace("      return on;\n    });\n    return startP;", "      return on || autoRegister(g, raw);\n    });\n    return startP;"))],
    ['autoRegisterAfter 를 두 번 부르면 두 번 함', mut('LP', (s) => s.replace("if(!started || autoAsked) return", "if(!started) return"))],
    ['기기 가득 거절이 reset 뒤에도 옛 세션 기억 · 안내를 씀', mut('LP', (s) => s.replace("if(g === gen && licenseApi.isDeviceFull(e) && markFull(l.licenseId))", "if(licenseApi.isDeviceFull(e) && markFull(l.licenseId))"))],
    ['라이선스 id 가 비어도 기억에 적음', mut('LP', (s) => s.replace("    if(typeof licenseId !== 'string' || !licenseId) return false;   // id 없는 라이선스 — 기억 · 안내 없음\n", ""))],
    ['첫 실행의 기기 가득을 같은 기억에 안 적음', mut('LP', (s) => s.replace("if(owned && g === gen && licenseApi.isDeviceFull(e)) r.showFull = markFull(owned.licenseId);", ""))],
    ['첫 실행이 showFull 을 안 봄(이미 안내한 라이선스에 또)', mut('FR', (s) => s.replace("r.showFull === false ?", "false ?"))],
    ['0.12 표시를 안 바꾸는 갈래에서 안 지움', mut('LP', (s) => s.replace("if(licenseId) setOptOut(licenseId); else clearOptOut();", "if(licenseId) setOptOut(licenseId);"))],
    ['이미 프리미엄일 때 0.12 표시를 안 지움', mut('LP', (s) => s.replace("if(g === gen && on && seenAtStart && seenAtStart.legacyKey) settleLegacy(raw, null);", ""))],
    ['0.12 표시를 그사이 바뀌었어도 덮어씀', mut('LP', (s) => s.replace("if(optOut() !== raw) return;", ""))],
    ['optOutAtStart 가 켤 때 값이 아니라 지금 값', mut('LP', (s) => s.replace("return started ? seenAtStart : parseOptOut(optOut());", "return parseOptOut(optOut());"))],
    ['PUT 중 reset 뒤에도 반영', mut('LP', (s) => s.replace("    if(g !== gen) return isPremium();\n    registered(l.licenseId);", "    registered(l.licenseId);"))],
    ['알림마다 자동 등록을 다시 함', mut('LP', (s) => s.replace("unsub = deps.rtOn(KIND, () => { lane(null); });", "unsub = deps.rtOn(KIND, () => { lane(null).then((on) => (on ? on : autoRegister(gen))); });"))],
    ['해제 표시를 안 봄', mut('LP', (s) => s.replace("if(opt && opt.licenseId === l.licenseId) return isPremium();", ""))],
    ['0.12 해제 표시를 안 봄', mut('LP', (s) => s.replace("if(legacy){ settleLegacy(raw, missing ? l.licenseId : null); return isPremium(); }", ""))],
    ['해제할 때 표시를 안 적음', mut('LP', (s) => s.replace("if(after) setOptOut(after.licenseId);", ""))],
    ['라이선스 상태를 안 봄(회수된 것도 등록)', mut('LP', (s) => s.replace("l.status === 'VALID' && ", ""))],
    ['자동 등록이 reset 뒤 옛 계정 답을 씀', mut('LP', (s) => s.replace("    if(g !== gen) return isPremium();\n    const missing", "    const missing"))],
    ['로그인 풀림도 오류 번호로 알림', mut('LP', (s) => s.replace("if(e && e.kind === 'auth') return;", ""))],
    ['알림이 겹치면 요청이 쌓임', mut('LP', (s) => s.replace("if(running){ again = true; return running; }", ""))],
    ['도는 중에 온 알림을 버림(한 번 더 안 받음)', mut('LP', (s) => s.replace("while(again && g === gen){ again = false; r = await once(null, g); }", ""))],
    ['신호 실패에도 번호를 띄움', mut('LP', (s) => s.replace("if(!loud) return;", ""))],
    ['해제 화면이 버린 답(stale)에도 E-LIC-02 를 띄움', mut('LS', (s) => s.split(' || r.stale').join(''))],
    ['쓰기 응답이 reset 뒤에도 반영됨', mut('LP', (s) => s.replace("if(g !== gen) return { ok: false, stale: true, notified: true, reason: '' };", ""))],
    ['reset 이 알림 구독을 안 풂', mut('LP', (s) => s.replace("if(unsub){ try{ unsub(); }catch(_){} }", ""))],
    ['reset 뒤 옛 답을 반영', mut('LP', (s) => s.replace("if(!me || g !== gen) return isPremium();", "if(!me) return isPremium();"))],
    ['reset 이 모름으로 안 되돌림', mut('LP', (s) => s.replace("deps.resetKnown();", ""))],
    ['등록 뒤 확인 없이 성공', mut('LP', (s) => s.replace("return premium ? { ok: true, lic: l } : { ok: false, registered: true, notified, reason: NOT_CONFIRMED, lic: l };   // notified — 확인 실패 번호를 이미 띄웠다", "return { ok: true };"))],
    ['쓰기 응답 premium 을 버리고 늘 다시 물음', mut('LP', (s) => s.replace("if(!l || typeof l.premium !== 'boolean') return lane(null, !quiet);", "return lane(null, !quiet);"))],
    ['쓰기 응답에 premium 이 없어도 다시 묻지 않음', mut('LP', (s) => s.replace("if(!l || typeof l.premium !== 'boolean') return lane(null, !quiet);", "if(!l) return lane(null, !quiet);"))],
    ['도는 확인 중 쓰기 응답 뒤 다시 묻지 않음', mut('LP', (s) => s.replace("if(running) again = true;\n", ""))],
    ['해제가 서버를 안 부름', mut('LP', (s) => s.split("after = await licenseApi.removeDevice(deps.deviceId());").join("after = null;"))],
    ['쓰기 응답 사본(meCache)으로 프리미엄 판정', mut('LP', (s) => s.replace("let me = given || null;", "let me = given || (deps.meCache && deps.meCache()) || null;").replace("setPremium(me.premium === true);", "setPremium(me.premium === true || deps.meCache);"))],
    ['전용 자산 접기가 서버 locked 대신 분류를 봄', mut('PA', (s) => s.split('rec.locked === true').join('rec.licenseOnly'))],
  ];
  for(const [name, S2] of breaks){
    let r2; try{ r2 = await judge(S2); }catch(_){ r2 = [[false, '던짐']]; }
    const changed = Object.keys(S2).some((k) => S2[k] !== SRC[k]);
    chk(changed && r2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
  }
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { say('  ✗ 검사가 던졌다: ' + (e && e.stack || e)); process.exit(1); });
