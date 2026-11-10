/* ═══ 🔑 sim-license-api.js — 라이선스 provider(account/license-api.js · 0.13 앱 묶음 D8-1) ═══
   [왜] 라이선스가 Firebase(licenses/{key}) 대신 우리 서버 공개 API(/v1/me/license*)를 쓴다. 서버 모양을 앱 모양으로 맞추고 «없음 ≠ 못 읽음» 을 가르고
     쓰기를 읽은 토큰 주인에 묶는 곳이 provider 하나라 그 맞춤을 실제로 불러서 판정한다.
   ・1절: 기기 이름 — 일반 이름만(컴퓨터 이름 없음) · 서버 상한 안
   ・2절: 읽기 — 내 라이선스 모양 맞춤 · 라이선스 없음(null) ≠ 못 읽음(던짐) · 모양 틀림은 던짐 · 로그인 통로로
   ・3절: 쓰기 — 읽기 전에는 요청 0(NOT_READ) · 읽은 주인을 expectOwner 로 · 경로 · 본문 모양 · 기기 id 는 경로에서 인코딩 · 주인이 바뀌면 요청 0(OWNER_CHANGED)
   ・4절: 라이선스 요청 · 오류 문구 표
   ・5절: 배선 — html 순서(api-client 다음 · license-premium · app.js 보다 먼저) · smoke PRELOAD · Firebase 를 모름
   ・6절: 일부러 깨 보기
   [실행] 러너 스테이징(평면)에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find(Boolean);
const API = pick(['license-api.js', 'parts/account/license-api.js', 'app/parts/account/license-api.js']);
const HTML = pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']);
const SMOKE = pick(['smoke.js']);
if(!API || !HTML || !SMOKE){ console.log('  ? 원본 못 찾음 — license-api.js · desk-companion-prototype.html · smoke.js'); process.exit(2); }
const load = (src) => { const w = {}; const m = { exports: {} }; new Function('window', 'module', src)(w, m); return m.exports; };
const apiErr = (status, code, kind) => Object.assign(new Error(code || String(status)), { status, code: code || '', kind: kind || (status >= 500 ? 'unavailable' : 'request') });

const LIC = (over) => Object.assign({ licenseId: 'L-1', status: 'VALID', devices: [
  { deviceId: 'dev-aaaaaaaa', name: 'Mac', registeredAt: '2026-11-01T00:00:00Z', lastSeenAt: '2026-11-02T00:00:00Z' }] }, over || {});

/* 가짜 authed — 부른 것을 적고, 읽기에서 토큰 주인(who)을 알려 주고, 쓰기의 expectOwner 가 지금 주인과 다르면 요청 없이 OWNER_CHANGED 로 끝낸다(api-client.js 와 같은 규칙) */
function fake(routes, state){
  const log = [];
  const run = async (method, path, body, opts) => {
    if(opts && opts.expectOwner && opts.expectOwner !== state.who){ throw apiErr(0, 'OWNER_CHANGED', 'auth'); }
    log.push({ method, path, body, opts });
    const key = method + ' ' + path;
    if(!(key in routes)) throw apiErr(404, 'NOT_FOUND');
    const r = typeof routes[key] === 'function' ? routes[key](body) : routes[key];
    if(r instanceof Error) throw r;
    if(method === 'GET' && opts && opts.onOwner) opts.onOwner(state.who);
    return r;
  };
  return { log, get: (p, o) => run('GET', p, undefined, o), post: (p, b, o) => run('POST', p, b, o), put: (p, b, o) => run('PUT', p, b, o), del: (p, o) => run('DELETE', p, undefined, o) };
}

async function judge(src){
  const rows = [];
  const t = (ok, msg) => rows.push([!!ok, msg]);
  const M = load(src);
  const state = { who: 'tokA' };
  const mk = (routes) => { const authed = fake(routes, state); return { authed, api: M.createLicenseApi({ authed }) }; };

  /* 1. 기기 이름 */
  t(M.deviceNameOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130') === 'Windows PC', '기기 이름 — Windows → «Windows PC»');
  t(M.deviceNameOf('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Electron/33') === 'Mac', '  Mac → «Mac»');
  t(M.deviceNameOf('') === '내 기기' && M.deviceNameOf(null) === '내 기기' && M.deviceNameOf('Linux x86_64') === '내 기기', '  모르는 값 · 빈 값 → «내 기기»(컴퓨터 이름은 어느 갈래에도 없다)');
  t(['Windows', 'Macintosh', '', 'x'].every((u) => { const n = M.deviceNameOf(u); return n.length >= 1 && n.length <= M.DEVICE_NAME_MAX; }), '  서버 상한(1~' + M.DEVICE_NAME_MAX + '자) 안');

  /* 2. 읽기 */
  {
    const { authed, api } = mk({ 'GET /v1/me/license': LIC() });
    const r = await api.mine();
    t(authed.log[0].path === '/v1/me/license' && authed.log[0].opts.auth === true, '읽기 — /v1/me/license 를 로그인 통로로(내 코드는 경로에 없다)');
    t(r && r.licenseId === 'L-1' && r.status === 'VALID' && r.devices.length === 1 && r.devices[0].deviceId === 'dev-aaaaaaaa' && r.devices[0].name === 'Mac', '  내 라이선스 모양 — 상태 · 기기 목록');
    const none = mk({ 'GET /v1/me/license': null });
    t((await none.api.mine()) === null, '★ 라이선스 없음 → null (못 읽음과 다르다)');
    const down = mk({ 'GET /v1/me/license': apiErr(503, '', 'unavailable') });
    let threw = null; try{ await down.api.mine(); }catch(e){ threw = e; }
    t(!!threw && threw.kind === 'unavailable', '★ 못 읽음 → 던진다(null 로 바꾸지 않는다)');
    const revoked = mk({ 'GET /v1/me/license': LIC({ status: 'REVOKED' }) });
    t((await revoked.api.mine()).status === 'REVOKED', '  회수된 라이선스는 REVOKED 로');
    const bad = [{ licenseId: 'L', status: 'VALID' }, { licenseId: 'L', status: 'WHAT', devices: [] }, { licenseId: 'L', status: 'VALID', devices: [{ name: 'x' }] }, 'x', 7, [], { status: 'VALID', devices: [] }];
    let allThrow = true;
    for(const b of bad){ try{ await mk({ 'GET /v1/me/license': b }).api.mine(); allThrow = false; }catch(e){ if(e.code !== 'SHAPE') allThrow = false; } }
    const full = await mk({ 'GET /v1/me/license': LIC({ premium: true, deviceLimit: 3 }) }).api.mine();
    t(full.premium === true && full.deviceLimit === 3, '이 기기 판정 premium · 기기 상한 deviceLimit 을 서버 값 그대로(앱에 3 을 박지 않는다)');
    const off = await mk({ 'GET /v1/me/license': LIC({ premium: false, deviceLimit: 1 }) }).api.mine();
    t(off.premium === false && off.deviceLimit === 1, '  premium:false 는 «아님» · 상한 1 도 받는다(경계)');
    const odd = [{}, { premium: 'true', deviceLimit: '3' }, { premium: 1, deviceLimit: 0 }, { premium: null, deviceLimit: -1 }, { deviceLimit: 2.5 }];
    let allNull = true;
    for(const o of odd){ const r = await mk({ 'GET /v1/me/license': LIC(o) }).api.mine(); if(r.premium !== null || r.deviceLimit !== null) allNull = false; }
    t(allNull, '★ 칸이 없거나 모양이 틀리면 null(«모름») — 문자열 · 숫자 1 · 0 · 음수 · 소수를 판정 · 상한으로 읽지 않는다');
    t(allThrow, '★ 모양이 틀린 답(칸 없음 · 모르는 상태 · 기기 id 없음 · 문자열 · 배열)은 SHAPE 로 던진다 — 받은 값을 믿지 않는다');
  }

  /* 3. 쓰기 */
  {
    const routes = { 'GET /v1/me/license': LIC(), 'POST /v1/me/license': LIC(), 'PUT /v1/me/license/devices/dev-bbbbbbbb': LIC(), 'DELETE /v1/me/license/devices/dev-bbbbbbbb': LIC() };
    const { authed, api } = mk(routes);
    let e0 = null; try{ await api.putDevice('dev-bbbbbbbb', 'Mac'); }catch(e){ e0 = e; }
    t(!!e0 && e0.code === 'NOT_READ' && authed.log.length === 0, '★ 읽기 전 쓰기 → 요청 0 (NOT_READ) — 누구의 라이선스를 고치는지 모른다');
    state.who = 'tokA';
    await api.mine();
    await api.register('ABCD-1234', { id: 'dev-bbbbbbbb', name: 'Windows PC' });
    const post = authed.log[authed.log.length - 1];
    t(post.method === 'POST' && post.path === '/v1/me/license' && JSON.stringify(post.body) === JSON.stringify({ key: 'ABCD-1234', device: { id: 'dev-bbbbbbbb', name: 'Windows PC' } }) && post.opts.expectOwner === 'tokA',
      '키 등록 — POST /v1/me/license { key, device:{ id, name } } · 읽은 주인에 묶음');
    await api.putDevice('dev-bbbbbbbb', 'Mac');
    const put = authed.log[authed.log.length - 1];
    t(put.method === 'PUT' && put.path === '/v1/me/license/devices/dev-bbbbbbbb' && JSON.stringify(put.body) === JSON.stringify({ name: 'Mac' }) && put.opts.expectOwner === 'tokA', '이 기기 등록 — PUT …/devices/{id} { name } · 읽은 주인에 묶음');
    await api.removeDevice('dev-bbbbbbbb');
    const del = authed.log[authed.log.length - 1];
    t(del.method === 'DELETE' && del.path === '/v1/me/license/devices/dev-bbbbbbbb' && del.opts.expectOwner === 'tokA', '기기 빼기 — DELETE …/devices/{id} · 읽은 주인에 묶음');
    const before = authed.log.length;
    state.who = 'tokB';   // 읽은 뒤 로그인한 사람이 바뀜
    let e1 = null; try{ await api.putDevice('dev-bbbbbbbb', 'Mac'); }catch(e){ e1 = e; }
    t(!!e1 && e1.code === 'OWNER_CHANGED' && authed.log.length === before, '★ 읽은 뒤 로그인한 사람이 바뀌면 요청 0 (OWNER_CHANGED) — 앞 계정의 기기 목록을 새 계정 토큰으로 고치지 않는다');
    await api.mine();   // 새 주인으로 다시 읽으면 다시 쓸 수 있다
    await api.putDevice('dev-bbbbbbbb', 'Mac');
    t(authed.log[authed.log.length - 1].opts.expectOwner === 'tokB', '  다시 읽으면 새 주인에 묶여 쓴다');
    state.who = 'tokA';
    const odd = mk({ 'GET /v1/me/license': LIC(), 'PUT /v1/me/license/devices/a%2Fb%3Fc': LIC() });
    await odd.api.mine();
    let encoded = true; try{ await odd.api.putDevice('a/b?c', 'x'); }catch(e){ encoded = false; }
    t(encoded, '  기기 id 는 경로에서 인코딩한다(경로를 바꿔 다른 자원을 가리키지 못함)');
    const shapeBad = mk({ 'GET /v1/me/license': LIC(), 'PUT /v1/me/license/devices/dev-bbbbbbbb': { ok: 1 } });
    await shapeBad.api.mine();
    let sh = null; try{ await shapeBad.api.putDevice('dev-bbbbbbbb', 'x'); }catch(e){ sh = e; }
    t(!!sh && sh.code === 'SHAPE', '  쓰기 답의 모양이 틀려도 던진다');
  }

  /* 4. 요청 · 오류 문구 */
  {
    const { authed, api } = mk({ 'GET /v1/me/license-requests': { name: '민지', status: 'APPROVED' }, 'POST /v1/me/license-requests': null });
    const a = await api.myApplication();
    t(a && a.name === '민지' && a.status === 'APPROVED' && authed.log[0].opts.auth === true, '내 요청 — { name, status } (승인된 키는 여기 없다)');
    const none = mk({ 'GET /v1/me/license-requests': null });
    t((await none.api.myApplication()) === null, '  요청 없음 → null');
    const weird = mk({ 'GET /v1/me/license-requests': { name: 'x', status: 'EVIL' } });
    t((await weird.api.myApplication()).status === 'PENDING', '  모르는 상태는 «기다림» 으로(승인으로 읽지 않는다)');
    await api.apply('req-1', '민지');
    const p = authed.log[authed.log.length - 1];
    t(p.method === 'POST' && p.path === '/v1/me/license-requests' && JSON.stringify(p.body) === JSON.stringify({ requestId: 'req-1', name: '민지' }), '요청 보내기 — POST /v1/me/license-requests { requestId, name }');
    const { api: ra } = mk({});
    t(['LICENSE_NOT_FOUND', 'LICENSE_REVOKED', 'LICENSE_OWNED_BY_OTHER', 'LICENSE_ALREADY_HAVE', 'LICENSE_DEVICE_FULL'].every((c) => typeof ra.reasonOf({ code: c }) === 'string' && ra.reasonOf({ code: c }).length > 4), '오류 문구 — 서버 code 다섯 갈래에 한 줄씩');
    t(ra.reasonOf({ code: 'NOPE' }) === null && ra.reasonOf(null) === null && ra.reasonOf({ code: 'toString' }) === null, '  표에 없으면 null — 부르는 쪽이 공통 문구로(상속 이름도 표 항목으로 안 읽는다)');
  }

  /* 5. 배선 */
  const order = [...HTML.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*\bsrc="parts\/([^"]+\.js)"/g)].map((m) => m[1]);
  const i = (f) => order.indexOf(f);
  t(i('shared/api-client.js') >= 0 && i('account/license-api.js') > i('shared/api-client.js') && i('account/license-premium.js') > i('account/license-api.js') && i('account/license-premium.js') < i('app.js'), 'html — api-client → license-api → license-premium → app.js 순서');
  t(/PRELOAD\.push\([^)]*'license-api\.js'[^)]*'license-premium\.js'[^)]*\)/.test(SMOKE), 'smoke PRELOAD 에 license-api.js · license-premium.js');
  t(!/firebaseAPI|firebase/i.test(src.replace(/\/\*[\s\S]*?\*\//g, '')), 'Firebase 를 모른다(코드)');
  return rows;
}

(async () => {
  const rows = await judge(API);
  rows.forEach(([ok, msg]) => chk(ok, msg));
  say('── 6. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
  const breaks = [
    ['읽기 전 쓰기를 막는 줄을 지움', (s) => s.replace("if(!owner) throw", "if(false) throw")],
    ['쓰기에서 expectOwner 를 뺌', (s) => s.replace("return send({ expectOwner: owner });", "return send({});")],
    ['라이선스 없음을 던짐으로', (s) => s.replace("if(d === null || d === undefined) return null;\n    return licenseOrThrow(d);", "return licenseOrThrow(d);")],
    ['모르는 상태를 VALID 로 받음', (s) => s.replace("d.status === STATUS.REVOKED ? STATUS.REVOKED : ''", "d.status === STATUS.REVOKED ? STATUS.REVOKED : STATUS.VALID")],
    ['기기 id 를 인코딩하지 않음', (s) => s.replace("encodeURIComponent(id)", "id")],
    ['모르는 요청 상태를 승인으로', (s) => s.replace("d.status === 'APPROVED' ? 'APPROVED' : 'PENDING'", "d.status")],
    ['컴퓨터 이름을 그대로 보냄', (s) => s.replace("return '내 기기';", "return ua;")],
    ['premium 을 참 같은 값으로 읽음', (s) => s.replace("typeof d.premium === 'boolean' ? d.premium : null", "d.premium == null ? null : !!d.premium")],
    ['기기 상한 0 · 음수를 받음', (s) => s.replace("Number.isInteger(d.deviceLimit) && d.deviceLimit > 0", "Number.isInteger(d.deviceLimit)")],
    ['오류 문구 표가 상속 이름을 읽음', (s) => s.replace("Object.prototype.hasOwnProperty.call(REASONS, code) ? REASONS[code] : null", "REASONS[code] || null")],
  ];
  for(const [name, f] of breaks){
    const broken = f(API);
    let r2; try{ r2 = await judge(broken); }catch(_){ r2 = [[false, '던짐']]; }
    chk(broken !== API && r2.some(([ok]) => !ok), name + (broken !== API ? '' : ' — 바꿀 글을 못 찾음'));
  }
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { say('  ✗ 검사가 던졌다: ' + (e && e.stack || e)); process.exit(1); });
