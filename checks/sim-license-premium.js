/* ═══ 🔑 sim-license-premium.js — 프리미엄 판정(account/license-premium.js · 0.13 앱 묶음 D8-1) ═══
   [무엇을 지키나] 프리미엄은 서버 확인(GET /v1/me 의 premium)만 따른다. 확인 전의 false 는 «모름» 이라, 모르는 동안 전용 자산을 접으면
     프리미엄 사용자의 책상이 켤 때마다 기본으로 떨어졌다 돌아온다(방으로도 나간다). 그래서 판정 모듈 · 계정 핵심 상태 · 전용 자산 접기를 진짜로 이어서 돌려 본다.
   ・1절: 켤 때 반영 — 프리미엄 참/거짓 · 켤 때 라이선스 요청 0 · 새 PC 자동 기기 등록 없음
   ・2절: 알림(license) — 다른 기기에서 바뀐 것 반영 · 겹쳐 와도 요청이 쌓이지 않음 · 못 받으면 지금 값 그대로(혼자 다시 안 함) · 두 번 시작 무시
   ・3절: 키 등록 · 이 기기 해제 — 서버 확인으로만 성공 · 해제한 기기는 자동 등록 안 함 · 키를 넣으면 풀림
   ・4절: ★ 모름 동안 접기 0번 — 계정 핵심 상태 + 전용 자산 접기를 실제로 이어 붙여: 프리미엄은 한 번도 접히지 않고, 아님은 확인 뒤 접힌다
   ・5절: 배선 — 프리미엄을 바꾸는 곳 하나 · 쓰기 응답(PATCH /v1/me)을 따르지 않음 · 시작은 켜는 차례 한 곳
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
  LP: pick('license-premium.js', 'account'), AS: pick('account-state.js', 'account'), PA: pick('premium-assets.js', 'character'),
  APP: read('app.js') || read('parts/app.js') || read('app/parts/app.js'),
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
  const e = { sets: [], notes: [], calls: [], meQ: (o.me || []).slice(), custom: 0, handlers: [], premium: !!o.premium };
  const meFn = async () => { e.calls.push('me'); const v = e.meQ.length > 1 ? e.meQ.shift() : e.meQ[0]; if(v instanceof Error) throw v; return v; };
  const licenseApi = {
    mine: async () => { e.calls.push('mine'); const v = typeof o.mine === 'function' ? o.mine() : o.mine; if(v instanceof Error) throw v; return v === undefined ? null : v; },
    putDevice: async (id, name) => { e.calls.push('put:' + id + ':' + name); return lic([id]); },   // 앱은 부르지 않는다 — 불리면 «자동 등록 없음» 판정이 빨강
    /* o.regPremium · o.remPremium — 쓰기 응답의 premium(이 기기 판정). 주지 않으면 칸 없음(«모름» — 옛 서버) */
    register: async (key, dev) => { e.calls.push('register:' + key + ':' + dev.id + ':' + dev.name); if(o.register instanceof Error) throw o.register; if(o.onRegister) o.onRegister(e); return withPremium(lic([dev.id]), o.regPremium); },
    removeDevice: async (id) => { e.calls.push('remove:' + id); if(o.remove instanceof Error) throw o.remove; return withPremium(lic([]), o.remPremium); },
    reasonOf: (err) => (err && err.code === 'LICENSE_OWNED_BY_OTHER' ? '이미 다른 계정에 등록된 키예요' : null),
  };
  const mod = load(src, 'createLicensePremium')({
    userApi: { me: meFn }, licenseApi, deviceId: () => ID, deviceName: () => NAME,
    setPremium: (v) => { e.sets.push(v); e.premium = !!v; }, isPremium: () => e.premium,
    rtOn: (kind, fn) => { e.handlers.push([kind, fn]); return () => {}; },
    notifyError: (code, err) => e.notes.push(code + (err && err.code ? ':' + err.code : '')),
    reasonOf: () => '서버 문구', resetCustomStatus: () => { e.custom++; },
  });
  e.mod = mod;
  e.push = () => e.handlers.filter(([k]) => k === 'license').forEach(([, f]) => f({ kind: 'license' }));
  return e;
}

async function judge(S){
  const rows = [];
  const t = (ok, msg) => rows.push([!!ok, msg]);
  const LP = S.LP;

  /* 1. 켤 때 반영 */
  {
    let e = env(LP, { me: [ME(true)], mine: lic([ID]) });
    const r = await e.mod.start(ME(true));
    t(r === true && e.sets.join() === 'true' && !e.calls.includes('mine') && !e.calls.includes('me'), '프리미엄 참 → 알린다(참) 한 번 · 내 라이선스를 읽지도 확인을 다시 묻지도 않는다');
    t(e.handlers.length === 1 && e.handlers[0][0] === 'license', '  서버 알림 license 를 건다(한 번)');

    e = env(LP, { me: [ME(false)], mine: lic(['dev-other001']) });
    t((await e.mod.start(ME(false))) === false && e.sets.join() === 'false' && e.calls.length === 0 && e.notes.length === 0,
      '★ 프리미엄이 아님 → 아님(거짓) 한 번 · 켤 때 라이선스 읽기(GET /v1/me/license) · 기기 등록 · 다시 확인 요청 0 · 알림 없음');
    e = env(LP, { me: [ME(false)], mine: lic(['dev-other001']) });
    await e.mod.start(ME(false)); e.push(); await tick(); await tick(); await tick();
    t(!e.calls.some((c) => c === 'mine' || c.startsWith('put:') || c.startsWith('register:')), '★ 라이선스는 있는데 이 기기만 목록에 없는 새 PC → 아님으로 둔다. 자동 기기 등록 없음(알림 뒤에도) — 등록은 키를 직접 넣을 때만');
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
    t(e.premium === true && e.sets.join() === 'true' && e.notes.length === 1, '알림 뒤 못 받음 → 지금 값 그대로 + 오류 번호 한 번 · 혼자 다시 묻지 않는다');
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
    t(r3.ok === false && r3.registered === true && /다시 켜/.test(r3.reason) && e.sets.join() === 'false', '등록은 됐는데 서버가 아직 «아님» → 성공이라 하지 않는다');

    e = env(LP, { me: [ME(false)], mine: lic([ID]), premium: true });
    const d = await e.mod.deactivate();
    t(d.ok === true && e.calls.join() === 'mine,remove:' + ID + ',me' && e.custom === 1 && e.sets.join() === 'false', '이 기기에서 해제 — 읽고 → 서버 목록에서 이 기기만 빼고 → 확인(아님) · 커스텀 상태를 기본으로');
    t(!e.calls.some((c) => c.startsWith('put:')), '  해제 직후에도 이 기기를 다시 등록하지 않는다(자동 등록이 없으니 되돌려질 길이 없다)');

    e = env(LP, { me: [ME(false)], mine: null, premium: false });
    const d2 = await e.mod.deactivate();
    t(d2.ok === true && !e.calls.some((c) => c.startsWith('remove:')), '라이선스가 없으면 뺄 것이 없다(빼기 요청 0)');

    e = env(LP, { me: [ME(false)], mine: null, regPremium: true });
    const w1 = await e.mod.activate('KEY');
    t(w1.ok === true && e.calls.join() === 'mine,register:KEY:' + ID + ':' + NAME && e.sets.join() === 'true', '★ 등록 응답에 premium 이 있으면 그것으로 반영 — GET /v1/me 를 다시 묻지 않는다(요청 둘)');
    e = env(LP, { me: [ME(true)], mine: null, regPremium: false });
    const w2 = await e.mod.activate('KEY');
    t(w2.ok === false && /다시 켜/.test(w2.reason) && e.sets.join() === 'false' && !e.calls.includes('me'), '  등록 응답 premium:false → 성공이라 하지 않는다(GET 없이)');
    e = env(LP, { me: [ME(true)], mine: lic([ID]), remPremium: false, premium: true });
    const w3 = await e.mod.deactivate();
    t(w3.ok === true && e.calls.join() === 'mine,remove:' + ID && e.sets.join() === 'false' && e.custom === 1, '★ 해제 응답 premium 으로 반영 — GET /v1/me 없이(서버 GET 은 아직 참이어도 따르지 않음)');
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

  /* 4. ★ 모름 동안 접기 0번 — 진짜 account-state + premium-assets 를 이어서 */
  {
    const any = new Proxy(function(){}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : any), apply: () => any, construct: () => any, set: () => true, has: () => true });
    const boot = async (o) => {
      const world = { premium: false, saves: 0, pushes: 0, redraws: [] };
      const win = {};
      const asApi = new Function('window', 'companion', 'localStorage', 'setTimeout', 'module', S.AS + '\nreturn window.TwAccountState;')(win, any, any, (f) => f(), undefined).createAccountState({ isPremium: () => world.premium, isAdmin: () => false, setIsPremium: (v) => { world.premium = v; } });
      const desk = { id: 'desk_gaming', licenseOnly: true };
      const def = { deskCatalogId: 'desk_gaming', deskScale: 1, deskLenX: 1, deskColor: 0 };
      const seat = { isMe: true, charDef: def };
      const PA = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'addEventListener', 'removeEventListener', 'module',
        o.paSrc + '\nreturn window.TwPremiumAssets;')({}, any, { getItem: () => null, setItem(){}, removeItem(){} }, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined).createPremiumAssets({
        DEFAULT_DESK_OVERRIDE_ID: '__d__', Presence: () => ({ active: () => true, updateDef: () => { world.pushes++; } }),
        applyDeskCatalogRefToSeat: (s, d) => { world.redraws.push(d.deskCatalogId); }, cBase: () => null, deskItemDef: () => ({}), deskPartAnchorOf: () => null, equipDeskItem: () => {},
        findMySeat: () => seat, isAdmin: () => false, isPremium: () => world.premium, licenseAssetBlocked: (it) => asApi.licenseAssetBlocked(it), saveSlots: () => { world.saves++; },
        savedDesks: () => [desk], savedItems: () => [], seats: [seat], slots: () => [def], toast: () => {},
      });
      asApi.onPremiumChanged(() => { PA.restoreLicenseHeldAssets(); PA.pruneUnownedLicenseAssets(); });   // license-gate.js _refreshPremiumGatedUI 와 같은 순서
      // 판정 모듈의 setPremium 을 진짜 계정 핵심 상태(위)로 잇는다
      const mod = load(LP, 'createLicensePremium')({
        userApi: { me: async () => ME(o.premium) }, licenseApi: { mine: async () => null, putDevice: async () => lic([ID]), register: async () => lic([ID]), removeDevice: async () => lic([]), reasonOf: () => null },
        deviceId: () => ID, deviceName: () => NAME, setPremium: (v) => asApi._setPremium(v), isPremium: () => world.premium,
        rtOn: () => () => {}, notifyError: () => {}, reasonOf: () => '', resetCustomStatus: () => {},
      });
      // 켜기 순서 — ① 슬롯 불러오기(onLoaded)가 접기를 부른다(서버 확인 전) ② 카탈로그 도착이 또 부른다 ③ 서버 확인이 온다
      const early = [PA.pruneUnownedLicenseAssets(), PA.pruneUnownedLicenseAssets()];
      const snapshotBefore = JSON.stringify(def);
      await mod.start(ME(o.premium));
      return { world, def, early, snapshotBefore, asApi };
    };
    const good = await boot({ premium: true, paSrc: S.PA });
    t(good.early.join() === '0,0' && good.snapshotBefore === JSON.stringify({ deskCatalogId: 'desk_gaming', deskScale: 1, deskLenX: 1, deskColor: 0 }) && good.world.saves === 0 && good.world.pushes === 0 && good.world.redraws.length === 0,
      '★ 서버가 확인해 주기 전(모름)에 슬롯 불러오기 · 카탈로그 도착이 접기를 불러도 접지도 · 저장도 · 방에 내보내지도 · 다시 그리지도 않는다');
    t(good.def.deskCatalogId === 'desk_gaming' && !('deskLicenseHold' in good.def) && good.world.saves === 0 && good.world.pushes === 0 && good.asApi.premiumKnown() === true,
      '★ 프리미엄 사용자 — 확인이 와도 책상은 한 번도 접히지 않는다(깜빡임 · 방 전파 0)');
    const none = await boot({ premium: false, paSrc: S.PA });
    t(none.early.join() === '0,0' && none.def.deskCatalogId === null && none.def.deskLicenseHold === 'desk_gaming' && none.world.saves === 1,
      '프리미엄이 아닌 사용자 — 모르는 동안은 그대로, 확인이 «아님» 이면 그때 접는다(건너뛴 접기가 사라지지 않는다)');
    const broken = await boot({ premium: true, paSrc: S.PA.replace('if(!licenseAssetBlocked({ licenseOnly: true })) return 0;', '') });
    t(S.PA.includes('if(!licenseAssetBlocked({ licenseOnly: true })) return 0;') && (broken.world.pushes > 0 || broken.def.deskCatalogId === null), '  ↳ 깨 보기: 모름 가드를 지우면 프리미엄 사용자도 접힌다(= 위 판정이 빨강이 된다)');
  }

  /* 5. 배선 */
  {
    const A = S.APP, strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
    const lpc = strip(LP);
    t(!/\bupdateMe\b|\bpatchMe\b|\bmeCache\b|premiumGraceSec|tw\.licenseKey|LICENSE_KEY_STORAGE/.test(lpc), '프리미엄은 GET /v1/me 확인에서만 — 쓰기 응답(PATCH) · 이 PC 의 사본 · 저장된 키 · 24시간 유예를 따르지 않는다');
    const setCalls = (A.match(/_setPremium\(/g) || []).length;
    t(setCalls === 1 && /setPremium: \(v\)=>acctStateMod\._setPremium\(v\),/.test(A), 'app.js 에서 _setPremium 을 잇는 곳은 판정 모듈 하나');
    t((A.match(/licensePremiumMod\.start\(/g) || []).length === 1 && /licensePremium: \(code, me\)=>licensePremiumMod\.start\(me\),/.test(A), '시작은 켜는 차례 한 곳(계정 확인이 준 me 로) — 만들 때 요청 · 구독 없음');
    t(!/loadLicenseFromStorage|startLicenseVerify|redeemLicense|verifyLicense/.test(A), '옛 길(이 PC 키로 먼저 켜기 · Firebase 로 재검증)이 app.js 에 없다');
    t(/made = true|createLicensePremium/.test(A) && !/licensePremiumMod\.(refresh|activate|deactivate)\(/.test(A.replace('activate: (key)=>licensePremiumMod.activate(key),', '')), '  버튼은 모듈(license-key.js · license-request.js)이 부른다 — app.js 는 첫 실행 키 올리기(D8-3)가 쓰는 activate 한 줄만');
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
    ['켤 때 새 PC 를 자동 등록함', mut('LP', (s) => s.replace("function settle(me){\n    setPremium", "function settle(me){\n    if(me.premium !== true) licenseApi.mine().then(() => licenseApi.putDevice(deps.deviceId(), deps.deviceName()));\n    setPremium"))],
    ['로그인 풀림도 오류 번호로 알림', mut('LP', (s) => s.replace("if(e && e.kind === 'auth') return;", ""))],
    ['알림이 겹치면 요청이 쌓임', mut('LP', (s) => s.replace("if(running){ again = true; return running; }", ""))],
    ['도는 중에 온 알림을 버림(한 번 더 안 받음)', mut('LP', (s) => s.replace("while(again){ again = false; r = await once(null); }", ""))],
    ['등록 뒤 확인 없이 성공', mut('LP', (s) => s.replace("return premium ? { ok: true } : { ok: false, registered: true, reason: NOT_CONFIRMED };", "return { ok: true };"))],
    ['쓰기 응답 premium 을 버리고 늘 다시 물음', mut('LP', (s) => s.replace("if(!l || typeof l.premium !== 'boolean') return lane(null);", "return lane(null);"))],
    ['쓰기 응답에 premium 이 없어도 다시 묻지 않음', mut('LP', (s) => s.replace("if(!l || typeof l.premium !== 'boolean') return lane(null);", "if(!l) return lane(null);"))],
    ['도는 확인 중 쓰기 응답 뒤 다시 묻지 않음', mut('LP', (s) => s.replace("if(running) again = true;\n", ""))],
    ['해제가 서버를 안 부름', mut('LP', (s) => s.replace("after = await licenseApi.removeDevice(deps.deviceId());", "after = null;"))],
    ['쓰기 응답 사본(meCache)으로 프리미엄 판정', mut('LP', (s) => s.replace("let me = given || null;", "let me = given || (deps.meCache && deps.meCache()) || null;").replace("setPremium(me.premium === true);", "setPremium(me.premium === true || deps.meCache);"))],
    ['첫 확인이 같은 값이면 조용', mut('AS', (s) => s.replace('isPremium() === v && wasKnown', 'isPremium() === v'))],
    ['전용 자산 접기가 «모름» 을 안 봄', mut('PA', (s) => s.replace('if(!licenseAssetBlocked({ licenseOnly: true })) return 0;', ''))],
  ];
  for(const [name, S2] of breaks){
    let r2; try{ r2 = await judge(S2); }catch(_){ r2 = [[false, '던짐']]; }
    const changed = Object.keys(S2).some((k) => S2[k] !== SRC[k]);
    chk(changed && r2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
  }
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { say('  ✗ 검사가 던졌다: ' + (e && e.stack || e)); process.exit(1); });
