/* ═══ 🔑 sim-license-screen.js — 설정 › 라이선스 구획: 기기 목록 화면(account/license-screen.js · license-ui.js · 0.13 앱 묶음 D8-2) ═══
   [무엇을 지키나] 창을 열면 내 라이선스를 한 번 받고(GET), 누른 동작 하나는 요청 하나로 끝난다. 받기 전 · 못 받음 · 동작 중에는 단추가 잠기고,
     실패는 번호(받기 E-LIC-03 · 해제 E-LIC-02 · 빼기 E-LIC-04 · 이 기기 등록 E-LIC-05 · 키 등록 E-LIC-06)로 한 번, 사용자가 고칠 수 있는 실패는 입력칸 아래 문구로 알린다.
     판정 모듈(license-premium.js)은 진짜를 붙여 «프리미엄 반영» 까지 같이 본다.
   ・1절: 창 열기 — 받기 1번 · 상태 여섯(불러오는 중 · 못 받음 · 없음 · 등록됨 · 이 기기만 없음 · 회수됨) · «이 기기» 는 id 가 같을 때만 · 기기 상한은 서버 값 · 관리자 한 줄
   ・2절: 못 받음 — 번호 한 번(두 번 실패해도 한 번) · 성공하면 풀림 · 알림으로 받다 실패하면 번호 없음 · 로그인 풀림은 조용
   ・3절: 알림 — 구획이 보일 때만 다시 받는다 · 동작 중에 온 알림은 끝난 뒤 · 받기가 겹치면 합친다
   ・4절: 동작 — 키 등록(빈 칸 · 고칠 수 있는 실패 · 못 고치는 실패 · 로그인 풀림) · 이 기기 해제 · 다른 기기 빼기(이 기기는 거절) · 이 기기 등록(가득 참 안내) · 받기 전 · busy 면 요청 0 + 토스트
   ・5절: 계정 바뀜 — reset 뒤 늦은 답 버림 · 알림 구독 해제
   ・6절: 그리기 — 상태마다 보이는 칸 · 단추 잠김 · 기기 이름은 textContent
   ・7절: 배선 — app.js 가 모듈을 만든다 · html 차례
   ・8절: 일부러 깨 보기
   [실행] 러너 스테이징(평면)에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
console.warn = () => {};
const pick = (n, d) => [n, 'parts/' + d + '/' + n, 'app/parts/' + d + '/' + n].map(read).find(Boolean);
const SRC = {
  LS: pick('license-screen.js', 'account'), LP: pick('license-premium.js', 'account'), UI: pick('license-ui.js', 'account'),
  HTML: read('desk-companion-prototype.html') || read('app/desk-companion-prototype.html'),
  APP: read('app.js') || read('parts/app.js') || read('app/parts/app.js'),
};
for(const k of Object.keys(SRC)) if(!SRC[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const tick = () => new Promise((r) => setImmediate(r));
const ticks = async (n) => { for(let i = 0; i < (n || 4); i++) await tick(); };
const apiErr = (status, code, kind) => Object.assign(new Error(code || String(status)), { status, code: code || '', kind: kind || (status >= 500 ? 'unavailable' : 'request') });
const HERE = 'dev-here0001', OTHER = 'dev-other001', THIRD = 'dev-third001';
const dev = (id, name) => ({ deviceId: id, name: name || 'Mac', registeredAt: '2026-11-01T03:00:00Z', lastSeenAt: '2026-11-14T06:20:00Z' });
const L = (ids, o) => Object.assign({ licenseId: 'L1', status: 'VALID', devices: ids.map((i) => dev(i)), premium: ids.includes(HERE), deviceLimit: 3 }, o || {});
function load(src, name, extra){ const w = {}; const m = { exports: {} }; new Function('window', 'module', 'document', 'localStorage', src)(w, m, extra && extra.document, extra && extra.localStorage); return m.exports[name]; }

/* 가짜 서버 통로 + 판정 모듈(진짜) + 화면(진짜). o.mine: 받을 때마다 꺼내 쓰는 답(Error 면 던짐) */
function env(S, o){
  o = o || {};
  const e = { calls: [], notes: [], toasts: [], sets: [], handlers: [], unsubs: 0, shown: o.shown !== false, admin: !!o.admin, changes: 0, holds: {} };
  const mineQ = (o.mine === undefined ? [L([HERE])] : Array.isArray(o.mine) ? o.mine : [o.mine]).slice();
  const hold = (name) => (e.holds[name] ? e.holds[name].p : null);
  const licenseApi = {
    mine: async () => { e.calls.push('mine'); const h = hold('mine'); if(h) await h; const v = mineQ.length > 1 ? mineQ.shift() : mineQ[0]; if(v instanceof Error) throw v; return v === undefined ? null : v; },
    register: async (key, d) => { e.calls.push('register:' + key + ':' + d.id); const h = hold('write'); if(h) await h; if(o.register instanceof Error) throw o.register; return o.registered || L([HERE, OTHER]); },
    putDevice: async (id) => { e.calls.push('put:' + id); const h = hold('write'); if(h) await h; if(o.put instanceof Error) throw o.put; return o.putResult || L([HERE, OTHER]); },
    removeDevice: async (id) => { e.calls.push('remove:' + id); const h = hold('write'); if(h) await h; if(o.remove instanceof Error) throw o.remove; return o.removed || L(id === HERE ? [OTHER] : [HERE], { premium: id === HERE ? false : true }); },
    reasonOf: (err) => (err && err.code === 'LICENSE_OWNED_BY_OTHER' ? '이미 다른 계정에 등록된 키예요' : err && err.code === 'LICENSE_NOT_FOUND' ? '등록되지 않은 키예요' : null),
    isDeviceFull: (err) => !!err && err.code === 'LICENSE_DEVICE_FULL',
  };
  const rtOn = (kind, fn) => { const h = [kind, fn]; e.handlers.push(h); return () => { e.unsubs++; const i = e.handlers.indexOf(h); if(i >= 0) e.handlers.splice(i, 1); }; };
  const notifyError = (code, err) => e.notes.push(code + (err && err.code ? ':' + err.code : ''));
  const premium = load(S.LP, 'createLicensePremium')({
    userApi: { me: async () => ({ premium: false }) }, licenseApi, deviceId: () => HERE, deviceName: () => 'Mac',
    setPremium: (v) => e.sets.push(v), isPremium: () => false, rtOn, resetKnown: () => {}, notifyError, reasonOf: () => '서버 문구', resetCustomStatus: () => {},
  });
  const screen = load(S.LS, 'createLicenseScreen')({
    licenseApi, licensePremium: premium, deviceId: () => HERE, isAdmin: () => e.admin, isShown: () => e.shown, rtOn, notifyError, toast: (m) => e.toasts.push(m),
  });
  screen.onChange(() => { e.changes++; });
  e.screen = screen;
  e.push = () => e.handlers.filter(([k]) => k === 'license').forEach(([, f]) => f({ kind: 'license' }));
  e.holdOn = (name) => { const h = {}; h.p = new Promise((r) => { h.release = r; }); e.holds[name] = h; };
  e.release = (name) => { const h = e.holds[name]; delete e.holds[name]; if(h) h.release(); };
  return e;
}
const writes = (e) => e.calls.filter((c) => c !== 'mine');
const mines = (e) => e.calls.filter((c) => c === 'mine').length;

async function judge(S){
  const rows = [];
  const t = (ok, msg) => rows.push([!!ok, msg]);
  const mode = (e) => e.screen.view().mode;

  /* 1. 창 열기 */
  {
    let e = env(S, { mine: L([HERE, OTHER]) });
    t(mode(e) === 'loading' && e.screen.view().canAct === false, '열기 전 → «불러오는 중» · 단추 잠김');
    const p = e.screen.open();
    t(e.screen.state().load === 'loading' && mode(e) === 'loading', '열면 받는 중 → «불러오는 중» · 단추 잠김');
    await p;
    const v = e.screen.view();
    t(mines(e) === 1 && v.mode === 'registered' && v.canAct && v.devices.length === 2, '★ 창 열기 = 받기 한 번 · 이 기기가 목록에 있으면 «등록됨» · 단추 열림');
    t(v.devices.find((d) => d.id === HERE).here === true && v.devices.find((d) => d.id === OTHER).here === false, '  «이 기기» 표시는 id 가 같은 줄만(이름이 같아도 아님 — 둘 다 «Mac»)');
    t(v.limit === 3 && v.full === false, '  기기 상한은 서버 값(deviceLimit) 그대로 · 2 / 3 이면 가득 아님');
    t(v.devices[0].lastSeen !== '' && /^\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}$/.test(v.devices[0].lastSeen), '  마지막 사용 · 등록일은 읽을 수 있는 글로');

    e = env(S, { mine: L([HERE, OTHER, THIRD], { deviceLimit: 3 }) });
    await e.screen.open();
    t(e.screen.view().full === true && e.screen.view().mode === 'registered', '기기 3 / 3 → 가득 참');
    e = env(S, { mine: L([HERE, OTHER], { deviceLimit: undefined }) });
    await e.screen.open();
    t(e.screen.view().limit === null && e.screen.view().full === false, '★ 서버가 상한을 안 주면 «모름» — 앱이 숫자를 정하지 않는다(가득 참을 미리 판단하지 않음)');

    e = env(S, { mine: L([OTHER, THIRD]) });
    await e.screen.open();
    t(e.screen.view().mode === 'unregistered' && e.screen.view().canAct, '라이선스는 있는데 이 기기가 목록에 없음 → «이 기기 등록» 상태');
    e = env(S, { mine: L([OTHER, THIRD, 'dev-fourth01']) });
    await e.screen.open();
    t(e.screen.view().mode === 'unregistered' && e.screen.view().full === true, '  기기가 가득 차 있으면 full(등록 단추 잠금 근거)');

    e = env(S, { mine: null });
    await e.screen.open();
    t(e.screen.view().mode === 'none' && e.screen.view().admin === false && e.screen.state().load === 'ready', '라이선스 없음(null) → «없음»(키 입력) — 못 받음과 다르다 · 번호 0');
    e = env(S, { mine: null, admin: true });
    await e.screen.open();
    t(e.screen.view().mode === 'none' && e.screen.view().admin === true, '관리자 → 같은 «없음» 에 관리자 표시(해제 단추는 «등록됨» 에만 있다)');
    e = env(S, { mine: L([HERE], { status: 'REVOKED', premium: false }) });
    await e.screen.open();
    t(e.screen.view().mode === 'revoked' && e.screen.view().canAct, '회수됨(REVOKED) → «사용이 중지된 라이선스» · 다른 키를 넣을 수 있다');
    e = env(S, { mine: L([HERE, OTHER]) });
    await e.screen.open(); await e.screen.open({ ifNeeded: true });
    t(mines(e) === 1, '탭만 다시 누름(ifNeeded) → 이미 받았으면 다시 받지 않는다');
    await e.screen.open();
    t(mines(e) === 2, '  창을 다시 열면(ifNeeded 없이) 다시 받는다');
  }

  /* 2. 못 받음 */
  {
    let e = env(S, { mine: [apiErr(0, '', 'unavailable'), apiErr(0, '', 'unavailable'), L([HERE])] });
    await e.screen.open();
    t(e.screen.view().mode === 'failed' && e.screen.view().canAct === false && e.notes.join() === 'E-LIC-03', '★ 못 받음 → «못 불러왔어요» · 단추 잠김 · 번호 E-LIC-03 한 번');
    await e.screen.open();
    t(e.notes.length === 1 && e.screen.view().mode === 'failed', '  두 번째도 실패 → 번호는 한 번만(이어지는 같은 실패)');
    await e.screen.open();
    t(e.screen.view().mode === 'registered' && e.screen.view().canAct, '  [다시 시도] 로 받으면 풀린다');
    e = env(S, { mine: [apiErr(0, '', 'unavailable'), L([HERE]), apiErr(0, '', 'unavailable')] });
    await e.screen.open(); await e.screen.open(); await e.screen.open();
    t(e.notes.length === 2, '  성공하고 나면 다음 실패는 다시 번호를 띄운다(2번)');
    e = env(S, { mine: [apiErr(401, 'AUTH_REQUIRED', 'auth')] });
    await e.screen.open();
    t(e.screen.view().mode === 'failed' && e.notes.length === 0, '로그인이 풀린 실패(kind auth) → 번호 없음(로그인 흐름 몫)');
    e = env(S, { mine: [L([HERE]), apiErr(0, '', 'unavailable')] });
    await e.screen.open(); e.push(); await ticks();
    t(e.screen.view().mode === 'failed' && e.notes.length === 0, '★ 서버 알림으로 받다 실패 → 번호 0(상태만 «못 불러왔어요»)');
  }

  /* 3. 알림 */
  {
    let e = env(S, { mine: [L([HERE]), L([HERE, OTHER])] });
    await e.screen.open();
    e.push(); await ticks();
    t(mines(e) === 2 && e.screen.view().devices.length === 2, '★ 구획이 보이는 중에 license 알림 → 다시 받아 목록이 바뀐다(다른 기기에서 한 일)');
    e.shown = false; e.push(); await ticks();
    t(mines(e) === 2, '  구획이 안 보이면 알림을 받지 않는다(요청 0 — 다음 열기가 받는다)');
    e = env(S, { mine: [L([HERE]), L([HERE, OTHER])] });
    await e.screen.open();
    e.shown = false; e.push(); await ticks();
    e.shown = true; await e.screen.open({ ifNeeded: true });
    t(mines(e) === 2 && e.screen.view().devices.length === 2, '★ 구획이 안 보이는 동안 알림이 왔으면 → 라이선스 탭을 누를 때(ifNeeded) 다시 받는다(낡은 목록이 남지 않음)');
    await e.screen.open({ ifNeeded: true });
    t(mines(e) === 2, '  다시 받은 뒤에는 탭을 눌러도 또 받지 않는다');
    e = env(S, { mine: [L([HERE]), L([HERE, OTHER])] });
    e.holdOn('mine');
    const ph = e.screen.open(); e.shown = false; e.push(); e.release('mine'); await ph; await ticks();
    e.shown = true; await e.screen.open({ ifNeeded: true });
    t(mines(e) === 2 && e.screen.view().devices.length === 2, '★ 받는 도중에 구획이 숨고 알림이 왔어도 → 받기가 끝난 뒤 탭을 누르면 다시 받는다(받기 시작 뒤의 알림은 지우지 않음)');
    e = env(S, { mine: L([HERE]) });
    e.push(); await ticks();
    t(mines(e) === 0 && e.handlers.length === 0, '  한 번도 안 열었으면 알림도 안 건다(요청 0 · 구독 0)');
    e = env(S, { mine: L([HERE]) });
    await e.screen.open(); await e.screen.open();
    t(e.handlers.filter(([k]) => k === 'license').length === 1, '  알림 구독은 한 번만(여러 번 열어도)');

    e = env(S, { mine: L([HERE]) });
    e.holdOn('mine');
    const p1 = e.screen.open(); const p2 = e.screen.open(); e.push(); e.push();
    e.release('mine'); await p1; await p2; await ticks();
    t(mines(e) <= 2, '받는 중에 또 부르거나 알림이 몰려도 요청이 쌓이지 않는다(받는 중 1 + 끝난 뒤 한 번 더 = 최대 2 · 실제 ' + mines(e) + ')');

    e = env(S, { mine: [L([HERE]), L([HERE, OTHER])] });
    await e.screen.open();
    e.holdOn('write');
    const w = e.screen.removeDevice(OTHER);
    e.push(); await ticks();
    t(mines(e) === 1, '★ 동작 중에 온 알림은 바로 받지 않는다(받은 옛 목록이 쓰기 답을 덮지 않게)');
    e.release('write'); await w; await ticks();
    t(mines(e) === 2, '  동작이 끝나면 그제야 한 번 받는다');
  }

  /* 4. 동작 */
  {
    let e = env(S, { mine: null });
    await e.screen.open();
    const r0 = await e.screen.submitKey('   ');
    t(r0.ok === false && writes(e).length === 0 && e.screen.view().keyMsg === '라이선스 키를 입력해 주세요', '빈 키 → 요청 0 · 입력칸 아래 문구');
    const r1 = await e.screen.submitKey('abcd-1234');
    t(r1.ok === true && e.calls.slice(-1)[0] === 'register:ABCD-1234:' + HERE && mines(e) === 1, '★ 키 등록 → 요청 하나(읽기 다시 0 — 창 열기에서 읽은 주인으로 묶음) · 키는 대문자로 · 이 기기 id 와 함께');
    t(e.screen.view().mode === 'registered' && e.screen.view().devices.length === 2 && e.toasts.slice(-1)[0].includes('등록됐어요') && e.sets.join() === 'true', '  응답이 곧 새 목록(다시 받기 없음) · 프리미엄 반영(응답 premium) · 토스트');

    e = env(S, { mine: null, register: apiErr(409, 'LICENSE_OWNED_BY_OTHER') });
    await e.screen.open();
    const r2 = await e.screen.submitKey('K');
    t(r2.ok === false && e.notes.length === 0 && e.screen.view().keyMsg === '이미 다른 계정에 등록된 키예요' && e.screen.view().mode === 'none', '★ 사용자가 고칠 수 있는 실패(남의 키) → 번호 0 · 입력칸 아래 서버 code 문구');
    e = env(S, { mine: null, register: apiErr(503, 'UNAVAILABLE', 'unavailable') });
    await e.screen.open();
    await e.screen.submitKey('K');
    t(e.notes.join() === 'E-LIC-06:UNAVAILABLE' && e.screen.view().keyMsg === '', '★ 고칠 수 없는 실패(5xx · 네트워크) → 번호 E-LIC-06 한 번 · 입력칸에 문구 없음');
    e = env(S, { mine: null, register: apiErr(401, 'AUTH_REQUIRED', 'auth') });
    await e.screen.open();
    await e.screen.submitKey('K');
    t(e.notes.length === 0 && e.screen.view().keyMsg === '', '  로그인이 풀린 실패 → 번호도 문구도 없음');

    e = env(S, { mine: L([HERE, OTHER]) });
    await e.screen.open();
    const d1 = await e.screen.removeThisDevice();
    t(d1.ok === true && e.calls.slice(-1)[0] === 'remove:' + HERE && mines(e) === 1 && e.sets.join() === 'false', '★ 이 기기에서 해제 → 삭제 요청 하나(읽기 0) · 응답 premium(거짓) 반영');
    t(e.screen.view().mode === 'unregistered' && e.screen.view().devices.length === 1 && e.toasts.slice(-1)[0].includes('해제'), '  목록에서 이 기기가 빠져 «이 기기만 없음» 으로 · 토스트');
    e = env(S, { mine: L([HERE, OTHER]), remove: apiErr(503, 'UNAVAILABLE', 'unavailable') });
    await e.screen.open(); await e.screen.removeThisDevice();
    t(e.notes.join() === 'E-LIC-02:UNAVAILABLE' && e.screen.view().devices.length === 2, '해제 실패 → E-LIC-02 · 목록 그대로');
    e = env(S, { mine: L([HERE, OTHER]), remove: apiErr(401, 'AUTH_REQUIRED', 'auth') });
    await e.screen.open(); await e.screen.removeThisDevice();
    t(e.notes.length === 0, '  로그인 풀림이면 번호 없음');

    e = env(S, { mine: L([HERE, OTHER]) });
    await e.screen.open();
    const o1 = await e.screen.removeDevice(OTHER);
    t(o1.ok === true && e.calls.slice(-1)[0] === 'remove:' + OTHER && e.screen.view().devices.length === 1 && e.sets.length === 0, '★ 다른 기기 빼기 → 요청 하나 · 목록 다시 그림 · 이 기기 프리미엄은 건드리지 않는다(반영 0)');
    const n0 = e.calls.length;
    const o2 = await e.screen.removeDevice(HERE);
    t(o2.ok === false && e.calls.length === n0, '  이 기기를 «빼기» 로 빼려 하면 거절(요청 0 — 이 기기는 «이 기기에서 해제» 로만)');
    e = env(S, { mine: L([HERE, OTHER]), remove: apiErr(503, 'UNAVAILABLE', 'unavailable') });
    await e.screen.open(); await e.screen.removeDevice(OTHER);
    t(e.notes.join() === 'E-LIC-04:UNAVAILABLE' && e.screen.view().devices.length === 2, '  빼기 실패 → E-LIC-04 · 목록 그대로');

    e = env(S, { mine: L([OTHER]), putResult: L([HERE, OTHER]) });
    await e.screen.open();
    const g1 = await e.screen.registerThisDevice();
    t(g1.ok === true && e.calls.slice(-1)[0] === 'put:' + HERE && e.screen.view().mode === 'registered' && e.sets.join() === 'true', '★ 이 기기 등록 → PUT 하나 · «등록됨» 으로 · 프리미엄 반영(응답 premium)');
    e = env(S, { mine: L([OTHER]), put: apiErr(409, 'LICENSE_DEVICE_FULL') });
    await e.screen.open();
    const g2 = await e.screen.registerThisDevice();
    t(g2.ok === false && g2.full === true && e.notes.length === 0 && e.toasts.slice(-1)[0].includes('기기를 모두 썼어요'), '★ 서버가 «기기를 모두 썼다» 로 거절 → 번호 0 · «하나를 빼 주세요» 안내');
    e = env(S, { mine: L([OTHER]), put: apiErr(503, 'UNAVAILABLE', 'unavailable') });
    await e.screen.open(); await e.screen.registerThisDevice();
    t(e.notes.join() === 'E-LIC-05:UNAVAILABLE', '  그 밖의 실패 → E-LIC-05');

    /* 받기 전 · busy */
    e = env(S, { mine: L([HERE, OTHER]) });
    const nr = await e.screen.removeDevice(OTHER);
    t(nr.ok === false && nr.why === 'not-ready' && e.calls.length === 0, '★ 받기 전(열기 전)에 누르면 요청 0');
    e = env(S, { mine: [apiErr(0, '', 'unavailable')] });
    await e.screen.open(); const n1 = e.calls.length;
    await e.screen.registerThisDevice(); await e.screen.submitKey('K');
    t(e.calls.length === n1, '  못 받은(failed) 상태에서도 요청 0');
    e = env(S, { mine: L([HERE, OTHER]) });
    await e.screen.open();
    e.holdOn('write');
    const b1 = e.screen.removeDevice(OTHER);
    const b2 = await Promise.race([e.screen.removeThisDevice(), ticks(3).then(() => ({ ok: true, why: 'timeout' }))]);
    t(b2.ok === false && b2.why === 'busy' && writes(e).length === 1 && e.toasts.slice(-1)[0].includes('처리 중'), '★ 동작 중에 다른 단추 → 요청 0 + «처리 중이에요» 토스트(앞 동작만 간다)');
    t(e.screen.view().canAct === false && e.screen.view().busy === true, '  동작 중에는 단추가 잠긴다');
    e.release('write'); await b1;
    t(e.screen.view().canAct === true && e.screen.view().busy === false, '  끝나면 다시 열린다');
    e = env(S, { mine: [L([HERE, OTHER])] });
    await e.screen.open();
    e.holdOn('mine'); const pp = e.screen.open();
    const rr = await Promise.race([e.screen.removeDevice(OTHER), ticks(3).then(() => ({ ok: true }))]);
    t(rr.ok === false && writes(e).length === 0, '  받는 중에 쓰기를 누르면 요청 0(받은 옛 목록이 쓰기 답을 덮지 않게)');
    e.release('mine'); await pp;
  }

  /* 5. 계정 바뀜 */
  {
    let e = env(S, { mine: L([HERE, OTHER]) });
    e.holdOn('mine');
    const p = e.screen.open();
    e.screen.reset();
    e.release('mine'); await p; await ticks();
    t(e.screen.state().load === 'idle' && e.screen.state().lic === null, '★ 받는 중에 reset → 늦게 온 옛 계정의 목록은 버린다(idle · 목록 없음)');
    e = env(S, { mine: L([HERE, OTHER]) });
    await e.screen.open();
    e.holdOn('write');
    const w = e.screen.removeDevice(OTHER);
    e.screen.reset();
    e.release('write'); await w; await ticks();
    t(e.screen.state().lic === null && e.toasts.length === 0 && e.notes.length === 0, '★ 쓰기를 기다리는 중에 reset → 옛 계정의 쓰기 답은 목록에도 토스트에도 안 간다');
    e = env(S, { mine: L([HERE]) });
    await e.screen.open();
    e.screen.reset();
    t(e.unsubs === 1 && e.handlers.length === 0, '★ reset → 알림 구독을 푼다');
    await e.screen.open();
    t(e.handlers.length === 1 && e.screen.view().mode === 'registered', '  reset 뒤 다시 열면 다시 걸고 새로 받는다');
  }
  return rows;
}

/* 6. 그리기 — license-ui.js 를 진짜로 돌린다(가짜 DOM) */
function fakeDom(){
  const els = {};
  const mk = (id) => ({ id, style: {}, children: [], disabled: false, _text: '', className: '', classList: { s: new Set(), toggle(c, on){ on ? this.s.add(c) : this.s.delete(c); }, add(c){ this.s.add(c); }, remove(c){ this.s.delete(c); }, contains(c){ return this.s.has(c); } },
    get textContent(){ return this._text; }, set textContent(v){ this._text = String(v); if(v === '') this.children = []; },
    appendChild(c){ this.children.push(c); return c; }, addEventListener(){}, value: '' });
  return { els, document: { getElementById: (id) => els[id] || (els[id] = mk(id)), createElement: () => mk('') } };
}
const SHOWN = (el) => !!el && el.style.display !== 'none';
async function drawRows(S){
  const rows = [];
  const t = (ok, msg) => rows.push([!!ok, msg]);
  const run = async (o, fn) => {
    const e = env(S, o);
    const f = fakeDom();
    const ls = { getItem: () => null };
    const ui = load(S.UI, 'createLicenseUi', { document: f.document, localStorage: ls })({ isPremium: () => !!o.premium, licReqMod: () => ({ LICENSE_REQ_ID_KEY: 'k', _showLicenseReqState(){} }), screen: e.screen });
    await fn(e, f, ui);
  };
  const D = (f, id) => f.els[id];
  await run({ mine: L([HERE, OTHER]) }, async (e, f, ui) => {
    ui.refreshLicenseUI();
    t(SHOWN(D(f, 'licenseStatusBox')) && D(f, 'licenseStatusMsg').textContent.includes('불러오는 중') && !SHOWN(D(f, 'licenseActiveBox')) && !SHOWN(D(f, 'licenseKeyBox')) && D(f, 'licenseSubmitBtn').disabled === true, '불러오는 중 → 상태 줄만 · 키 입력 · 기기 목록은 안 보임 · 단추 잠김');
    await ui.openLicenseUI(); await ticks();
    t(!SHOWN(D(f, 'licenseStatusBox')) && SHOWN(D(f, 'licenseActiveBox')) && SHOWN(D(f, 'licenseDeactivateBtn')) && !SHOWN(D(f, 'licenseRegisterThisBtn')) && !SHOWN(D(f, 'licenseKeyBox')), '★ 등록됨 → 기기 목록 · [이 기기에서 해제] 만(키 입력 · [이 기기 등록] 없음)');
    const rowsEl = D(f, 'licenseDeviceList').children;
    t(rowsEl.length === 2 && D(f, 'licenseDeviceHead').textContent === '내 기기 2 / 3대', '  기기 줄 2개 · «내 기기 2 / 3대»');
    const here = rowsEl.find((r) => r.children[0].children[0].textContent.includes('이 기기'));
    const other = rowsEl.find((r) => !r.children[0].children[0].textContent.includes('이 기기'));
    t(here && here.children.length === 1 && other && other.children.length === 2 && other.children[1].textContent === '빼기', '  «이 기기» 줄에는 [빼기] 가 없고 다른 기기 줄에만 있다');
  });
  await run({ mine: [apiErr(0, '', 'unavailable')] }, async (e, f, ui) => {
    await ui.openLicenseUI(); await ticks();
    t(SHOWN(D(f, 'licenseStatusBox')) && D(f, 'licenseStatusMsg').textContent.includes('못 불러왔어요') && SHOWN(D(f, 'licenseRetryBtn')) && !SHOWN(D(f, 'licenseKeyBox')) && !SHOWN(D(f, 'licenseActiveBox')), '못 받음 → «못 불러왔어요» + [다시 시도] · 나머지는 숨김');
  });
  await run({ mine: null }, async (e, f, ui) => {
    await ui.openLicenseUI(); await ticks();
    t(SHOWN(D(f, 'licenseKeyBox')) && !SHOWN(D(f, 'licenseActiveBox')) && !SHOWN(D(f, 'licenseAdminNote')) && D(f, 'licenseSubmitBtn').disabled === false, '라이선스 없음 → 키 입력칸 + [확인] 만(관리자 줄 없음)');
    await e.screen.submitKey(' '); await ticks();
    t(SHOWN(D(f, 'licenseErrorMsg')) && D(f, 'licenseErrorMsg').textContent === '라이선스 키를 입력해 주세요', '  빈 키 → 입력칸 아래 문구가 보인다');
  });
  await run({ mine: null, admin: true }, async (e, f, ui) => {
    await ui.openLicenseUI(); await ticks();
    t(SHOWN(D(f, 'licenseAdminNote')) && SHOWN(D(f, 'licenseKeyBox')), '관리자(라이선스 없음) → 관리자 한 줄 + 키 입력칸');
  });
  await run({ mine: L([OTHER, THIRD, 'dev-fourth01']) }, async (e, f, ui) => {
    await ui.openLicenseUI(); await ticks();
    t(SHOWN(D(f, 'licenseRegisterThisBtn')) && D(f, 'licenseRegisterThisBtn').disabled === true && SHOWN(D(f, 'licenseDeviceNote')) && !SHOWN(D(f, 'licenseDeactivateBtn')), '★ 이 기기만 없음 + 가득 참 → [이 기기 등록] 잠김 · «기기를 모두 썼어요 — 하나를 빼면 등록할 수 있어요» · 해제 단추 없음');
  });
  await run({ mine: L([OTHER]) }, async (e, f, ui) => {
    await ui.openLicenseUI(); await ticks();
    t(SHOWN(D(f, 'licenseRegisterThisBtn')) && D(f, 'licenseRegisterThisBtn').disabled === false && !SHOWN(D(f, 'licenseDeviceNote')), '이 기기만 없음(자리 있음) → [이 기기 등록] 열림');
  });
  await run({ mine: L([HERE], { status: 'REVOKED', premium: false }) }, async (e, f, ui) => {
    await ui.openLicenseUI(); await ticks();
    t(SHOWN(D(f, 'licenseActiveBox')) && D(f, 'licenseActiveTitle').textContent.includes('중지') && SHOWN(D(f, 'licenseKeyBox')) && !SHOWN(D(f, 'licenseDeactivateBtn')) && D(f, 'licenseDeviceList').children.length === 0, '회수됨 → «사용이 중지된 라이선스예요» + 키 입력칸 · 기기 목록 · 해제 없음');
  });
  await run({ mine: [L([HERE, OTHER])] }, async (e, f, ui) => {
    await ui.openLicenseUI(); await ticks();
    e.holdOn('write');
    const w = e.screen.removeDevice(OTHER); await tick();
    t(D(f, 'licenseDeactivateBtn').disabled === true && D(f, 'licenseDeviceList').children.some((r) => r.children[1] && r.children[1].disabled === true), '동작 중 → 해제 · 빼기 단추 잠김');
    e.release('write'); await w; await ticks();
    t(D(f, 'licenseDeactivateBtn').disabled === false, '  끝나면 다시 열림');
  });
  await run({ mine: [L([HERE, OTHER])] }, async (e, f, ui) => {
    e.screen = e.screen;
    const hostile = L([HERE], {}); hostile.devices[0].name = '<img src=x onerror=alert(1)>';
    const e2 = env(S, { mine: hostile }); const f2 = fakeDom();
    const ui2 = load(S.UI, 'createLicenseUi', { document: f2.document, localStorage: { getItem: () => null } })({ isPremium: () => true, licReqMod: () => ({ LICENSE_REQ_ID_KEY: 'k', _showLicenseReqState(){} }), screen: e2.screen });
    await ui2.openLicenseUI(); await ticks();
    t(f2.els.licenseDeviceList.children[0].children[0].children[0].textContent.includes('<img') && !/innerHTML/.test(S.UI.replace(/\/\*[\s\S]*?\*\//g, '')), '서버가 준 기기 이름은 textContent 로만 넣는다(innerHTML 없음)');
  });
  return rows;
}

function wiringRows(S){
  const rows = [];
  const t = (ok, msg) => rows.push([!!ok, msg]);
  const A = S.APP, H = S.HTML;
  t(/const licenseScreenMod = TwLicenseScreen\.createLicenseScreen\(\{/.test(A) && A.indexOf('const licenseScreenMod') < A.indexOf('const licenseUiMod') && A.indexOf('const licensePremiumMod') < A.indexOf('const licenseScreenMod'), 'app.js 가 화면 모듈을 만든다 — 판정 모듈 뒤 · 그리는 모듈(license-ui) 앞');
  const mk = (A.match(/const licenseScreenMod = TwLicenseScreen\.createLicenseScreen\(\{\n([\s\S]*?)\n\}\);/) || [])[1] || '';
  t(/licensePremium: licensePremiumMod,/.test(mk) && /licenseApi: TwLicenseApi\.store,/.test(mk) && /rtOn: \(kind, fn\)=>TwRtHub\.store\.on\(kind, fn\),/.test(mk) && /isAdmin: \(\)=>isAdmin,/.test(mk), '  deps — 판정 모듈 · provider · 알림 구독 · 관리자(읽는 함수)');
  const iP = H.indexOf('<script src="parts/account/license-premium.js"></script>'), iS = H.indexOf('<script src="parts/account/license-screen.js"></script>'), iU = H.indexOf('<script src="parts/account/license-ui.js"></script>'), iA = H.indexOf('<script src="parts/app.js"></script>');
  t(iP > 0 && iS > iP && iU > iS && iA > iU, 'html — license-screen.js 는 license-premium.js 다음 · license-ui.js · app.js 보다 먼저');
  t(/openLicenseUI: \(\.\.\.a\)=>licenseUiMod\.openLicenseUI\(\.\.\.a\),/.test(A) && !/refreshLicenseUI: \(\.\.\.a\)=>licenseUiMod\.refreshLicenseUI\(\.\.\.a\),\n  refreshOfficeChipUI/.test(A), '설정 창(program-settings)은 열 때 openLicenseUI(받기 + 그리기)를 부른다');
  const ids = ['licenseStatusBox', 'licenseStatusMsg', 'licenseRetryBtn', 'licenseAdminNote', 'licenseActiveBox', 'licenseActiveTitle', 'licenseDeviceHead', 'licenseDeviceList', 'licenseDeviceNote', 'licenseRegisterThisBtn', 'licenseDeactivateBtn', 'licenseKeyBox', 'licenseKeyInput', 'licenseErrorMsg', 'licenseSubmitBtn'];
  const miss = ids.filter((i) => !new RegExp('id="' + i + '"').test(H));
  t(!miss.length, 'html 에 구획의 칸이 다 있다' + (miss.length ? ' — 없음: ' + miss.join(' · ') : ''));
  return rows;
}

(async () => {
  const rows = (await judge(SRC)).concat(await drawRows(SRC), wiringRows(SRC));
  rows.forEach(([ok, msg]) => chk(ok, msg));
  say('── 8. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
  const mut = (k, f) => Object.assign({}, SRC, { [k]: f(SRC[k]) });
  const breaks = [
    ['받기 전에도 동작이 나감', mut('LS', (s) => s.replace("if(load !== 'ready'){ deps.toast(MSG.LOADING); return { ok: false, why: 'not-ready' }; }", ""))],
    ['동작 중에도 다른 동작이 나감', mut('LS', (s) => s.replace("if(busy || pulling){ deps.toast(MSG.BUSY); return { ok: false, why: 'busy' }; }", ""))],
    ['받는 중에도 쓰기가 나감', mut('LS', (s) => s.replace("if(busy || pulling){", "if(busy){"))],
    ['받기 실패 번호를 매번 띄움', mut('LS', (s) => s.replace("&& !failShown){ failShown = true;", "){ failShown = true;"))],
    ['알림으로 받다 실패해도 번호를 띄움', mut('LS', (s) => s.replace("if(loud && !authLost(e)", "if(!authLost(e)"))],
    ['reset 뒤 옛 목록을 반영', mut('LS', (s) => s.replace("if(g !== gen) return false;   // reset 뒤에 온 옛 답은 버린다", ""))],
    ['reset 이 알림 구독을 안 풂', mut('LS', (s) => s.replace("if(unsub){ try{ unsub(); }catch(_){} }", ""))],
    ['받는 도중 온 알림 표시를 받기 성공이 지움', mut('LS', (s) => s.replace("    lic = licFrom(l); load = 'ready';", "    stale = false; lic = licFrom(l); load = 'ready';"))],
    ['안 보일 때 온 알림을 잊음', mut('LS', (s) => s.replace("if(!deps.isShown()){ stale = true; return; }", "if(!deps.isShown()) return;"))],
    ['안 보이는 구획도 알림으로 받음', mut('LS', (s) => s.replace("if(!deps.isShown()){ stale = true; return; }", ""))],
    ['동작 중 알림을 바로 받음', mut('LS', (s) => s.replace("if(busy){ pullAfterBusy = true; return; }\n    pull(false);", "pull(false);"))],
    ['이 기기를 «빼기» 로 뺄 수 있음', mut('LS', (s) => s.replace("if(!id || id === deps.deviceId()) return { ok: false, why: 'self' };", ""))],
    ['기기 가득 거절에도 번호를 띄움', mut('LS', (s) => s.replace("if(api.isDeviceFull(r.err)){", "if(false){"))],
    ['못 고치는 등록 실패를 입력칸에만 적음', mut('LS', (s) => s.replace("deps.notifyError('E-LIC-06', r.err);", "keyMsg = 'x';"))],
    ['고칠 수 있는 실패에도 번호를 띄움', mut('LS', (s) => s.replace("if(fixable || !r.err){", "if(false){"))],
    ['로그인 풀림에도 번호를 띄움', mut('LS', (s) => s.split("const authLost = (e) => !!e && e.kind === 'auth';").join("const authLost = (e) => false;"))],
    ['«이 기기» 를 이름으로 가림', mut('LS', (s) => s.replace("here: d.deviceId === here", "here: d.name === 'Mac'"))],
    ['앱이 기기 상한 3 을 박음', mut('LS', (s) => s.replace("const limit = lic.deviceLimit;", "const limit = 3;"))],
    ['쓰기 전에 읽기를 또 함', mut('LS', (s) => s.replace("premium.activate(k, { ownerKnown: true })", "premium.activate(k)"))],
    ['기기 이름을 innerHTML 로', mut('UI', (s) => s.replace("name.textContent = (d.name || '이름 없는 기기')", "name.innerHTML = (d.name || '이름 없는 기기')"))],
    ['동작 중에도 단추가 열려 있음', mut('UI', (s) => s.replace("if(deact) deact.disabled = !v.canAct;", ""))],
    ['가득 차도 [이 기기 등록] 이 열림', mut('UI', (s) => s.replace("reg.disabled = !v.canAct || full;", "reg.disabled = !v.canAct;"))],
    ['등록된 기기 줄에 이 기기 [빼기] 가 보임', mut('UI', (s) => s.replace("if(!d.here){", "if(true){"))],
    ['html 줄 빠짐', mut('HTML', (s) => s.replace('<script src="parts/account/license-screen.js"></script>', ''))],
  ];
  for(const [name, S2] of breaks){
    const changed = Object.keys(S2).some((k) => S2[k] !== SRC[k]);
    let r2; try{ r2 = (await judge(S2)).concat(await drawRows(S2), wiringRows(S2)); }catch(_){ r2 = [[false, '던짐']]; }
    chk(changed && r2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
  }
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { say('  ✗ 검사가 던졌다: ' + (e && e.stack || e)); process.exit(1); });
