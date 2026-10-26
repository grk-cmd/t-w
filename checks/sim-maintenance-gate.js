/* ═══ 🛠 sim-maintenance-gate.js — 서버 점검 창(maintenance-gate.js) ═══════════════
   ・1절: 순수 — maintenanceOf(on 이 정확히 true 일 때만 · 시각 · 문구 상한) · endsAtText(오늘 / 다른 날) · viewOf(단추)
   ・2-1절: 사람이 누른 동작 — 입력 시각 1초 판정(로컬 클릭 3초 뒤 뒤쪽 요청 · «확인» 뒤 요청은 창 없음 · 클릭 직후 요청은 창)
   ・2절: 창 — 점검 중이어도 사람이 누른 동작일 때만 · 뒤에서 혼자 낸 요청은 조용히 · 떠 있는 창은 바뀐 끝 시각으로 다시 · 끝나면 다시 켜기를 묻는다(본 적 없으면 안 물음) · 단추
   ・3절: 고리 — 범용 통로(data-gateway.js)가 요청마다 한 번 · API 통로(api-client.js)는 실제로 보낼 때만 · 오류 번호 토스트는 점검 중 조용히(기록은 남김)
   ・4절: 연결 · 규칙 — html 싣는 순서 · 클릭 통과 목록 · firebase-init 구독 · config/maintenance 누구나 읽기 · 관리자만 쓰기 · 모양
   ・5절: 깨 보기 — 사람이 누른 동작 확인을 빼거나 · 판정 폭을 5초로 · 창 안 입력도 세거나 · 오류 토스트 조용히를 빼거나 · on 판정을 느슨하게 하면 빨강
   [실행] node checks/run.js sim-maintenance-gate */
'use strict';
const fs = require('fs');
const { stripReadGate } = require('./sim-rules-src.js');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = (f) => { const s = read(f); if(s == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } return s; };
const SRC = need('maintenance-gate.js');
const GW = need('data-gateway.js');
const AC = need('api-client.js');
const EC = need('error-codes.js');
const FI = need('firebase-init.js');
const HTML = need('desk-companion-prototype.html');
const DR = need('desktop-run.js');
const RULES = JSON.parse(stripReadGate(need('firebase-database-rules.json'))).rules;
const quiet = { warn(){}, log(){} };
const asModule = (src) => { const mod = { exports: {} }; new Function('window', 'document', 'module', 'console', src)(undefined, undefined, mod, quiet); return mod.exports; };
const asWindow = (src, name) => { const w = {}; new Function('window', 'module', 'console', src)(w, undefined, quiet); return w[name]; };

/* 가짜 창 · 사람 동작 — 부른 것을 적는다 */
function rig(M, active){
  const shows = [], calls = [];
  let hidden = 0, onPress = null;
  const state = { active: !!active };
  const g = M.createMaintenance({
    userActive: () => state.active,
    ui: { show: (v, p) => { shows.push(v); onPress = p; }, hide: () => { hidden++; } },
    relaunch: () => calls.push('relaunch'),
    now: () => new Date(2026, 10, 18, 9, 0).getTime(),
  });
  return { g, shows, calls, state, hidden: () => hidden, press: (a) => onPress(a) };
}

function run(M, label){
  const fails0 = fail;
  say('── 1. 순수' + label);
  chk(M.maintenanceOf(null) === null && M.maintenanceOf({ on: false }) === null && M.maintenanceOf({ on: 'true' }) === null && M.maintenanceOf({ on: 1 }) === null && M.maintenanceOf([]) === null,
      'on 이 정확히 true 가 아니면 점검 아님(없음 · false · 글자 · 숫자 · 배열)');
  const m = M.maintenanceOf({ on: true, endsAt: new Date(2026, 10, 18, 12, 5).getTime(), message: '  ' + 'x'.repeat(M.MESSAGE_MAX + 50) });
  chk(m && m.endsAt > 0 && m.message.length === M.MESSAGE_MAX, '  ↳ 시각 · 문구는 상한 ' + M.MESSAGE_MAX + '자에서 자른다');
  const m2 = M.maintenanceOf({ on: true, endsAt: -1, message: 3 });
  chk(m2 && m2.endsAt === null && m2.message === '', '  ↳ 틀린 시각 · 문구는 비운다(점검은 그대로)');
  const now = new Date(2026, 10, 18, 9, 0).getTime();
  chk(M.endsAtText(new Date(2026, 10, 18, 12, 5).getTime(), now) === '12:05' && M.endsAtText(new Date(2026, 10, 19, 1, 0).getTime(), now) === '11월 19일 01:00',
      'endsAtText — 오늘이면 시:분 · 다른 날이면 날짜까지');
  const v = M.viewOf({ endsAt: new Date(2026, 10, 18, 12, 0).getTime(), message: '' }, now);
  chk(v.title === '서버 점검 중' && v.body.split('\n')[1] === '12:00쯤 끝날 예정이에요.' && v.buttons.length === 1 && v.buttons[0].action === 'close', 'viewOf 점검 중 — 기본 문구 · 줄 바꿔 끝 시각 · 단추 «확인» 하나');
  const e = M.viewOf(null, now);
  chk(e.buttons.map(b => b.action).join() === 'relaunch,close', 'viewOf 끝남 — «지금 다시 켜기» · «나중에»');

  say('── 2. 창' + label);
  let r = rig(M, true);
  chk(r.g.touch() === false && r.shows.length === 0 && r.g.on() === false, '점검 아님 — 눌러도 창 없음');
  r.g.onValue({ on: true, message: '점검해요' });
  chk(r.shows.length === 0 && r.g.on() === true, '점검이 켜지는 순간엔 창을 띄우지 않는다(로컬 기능은 그대로)');
  r.state.active = false;
  chk(r.g.touch() === false && r.shows.length === 0, '★ 앱이 뒤에서 혼자 낸 요청 — 창 없음');
  r.state.active = true;
  chk(r.g.touch() === true && r.shows.length === 1 && r.shows[0].body.indexOf('점검해요') === 0, '★ 사람이 누른 동작이 서버에 닿으면 — 점검 창(관리자 문구)');
  r.g.onValue({ on: true, message: '점검해요', endsAt: new Date(2026, 10, 18, 14, 30).getTime() });
  chk(r.shows.length === 2 && r.shows[1].body.split('\n')[1] === '14:30쯤 끝날 예정이에요.', '★ 창이 떠 있는 동안 관리자가 끝 시각을 늘리면 바로 다시 그린다');
  r.press('close');
  chk(r.hidden() === 1 && r.calls.length === 0, '  ↳ «확인» 은 닫기만');
  r.g.onValue({ on: true, message: '점검해요', endsAt: new Date(2026, 10, 18, 15, 0).getTime() });
  chk(r.shows.length === 2, '  ↳ 닫은 뒤 바뀐 시각은 창을 다시 띄우지 않는다(다음에 누를 때 새 시각)');
  r.g.onValue(null);
  chk(r.shows.length === 3 && r.shows[2].title === '점검이 끝났어요' && r.g.on() === false, '★ 끝나면 다시 켜기를 묻는다');
  r.press('relaunch');
  chk(r.calls.join() === 'relaunch' && r.hidden() === 2, '  ↳ «지금 다시 켜기» 는 앱을 다시 켠다');
  r.g.onValue(null);
  chk(r.shows.length === 3, '  ↳ 꺼진 값이 또 와도 다시 묻지 않는다');
  const r2 = rig(M, true);
  r2.g.onValue(null); r2.g.onValue({ on: false });
  chk(r2.shows.length === 0, '켤 때부터 점검이 아니었으면 묻지 않는다');
  const r3 = rig(M, true);
  r3.g.onValue({ on: true }); r3.g.onValue(null);
  chk(r3.shows.length === 1 && r3.shows[0].title === '점검이 끝났어요', '끝남 창이 떠 있고');
  r3.g.onValue({ on: true, message: '다시 점검' });
  chk(r3.shows.length === 2 && r3.shows[1].title === '서버 점검 중', '  ↳ 그 사이 점검이 다시 켜지면 점검 글로 바꿔 그린다(끝남 창이 남지 않게)');

  say('── 2-1. 사람이 누른 동작' + label);
  let t = 0; const clock = M.createInputClock({ now: () => t });
  chk(clock.active() === false, '입력이 없으면 아님');
  const g = M.createMaintenance({ userActive: clock.active, ui: { show(){}, hide(){} }, relaunch(){}, now: () => t });
  g.onValue({ on: true });
  t = 10000; clock.note(false); t += 3000;
  chk(g.touch() === false, '★ (가) 로컬 클릭 3초 뒤 뒤쪽 요청(꾸미기 저장 디바운스) — 창 없음');
  t = 20000; clock.note(false);
  chk(g.touch() === true, '★ (다) 클릭 직후 같은 틱 요청 — 창');
  t = 30000; clock.note(true); t += 200;
  chk(g.touch() === false, '★ (나) 점검 창 «확인» 을 누른 직후 뒤쪽 요청(하트비트) — 창 없음');
  t = 40000; clock.note(false); t += M.ACTIVE_MS;
  chk(g.touch() === true && M.ACTIVE_MS <= 1000, '  ↳ 판정 폭 경계(' + M.ACTIVE_MS + 'ms)는 안쪽');
  return fail === fails0;
}

const M = asModule(SRC);
run(M, '');

say('── 3. 고리');
{
  const G = asWindow(GW, 'TwDataGateway');
  let ops = 0; const sdkCalls = [];
  const sdk = {};
  for(const k of ['get', 'set', 'update', 'remove', 'onValue']) sdk[k] = (...a) => { sdkCalls.push(k); return k === 'onValue' ? () => {} : Promise.resolve(); };
  sdk.push = (r, v) => { sdkCalls.push('push'); const c = { key: 'k1', toString: () => 'a/k1' }; return v === undefined ? c : Promise.resolve(c); };
  const gw = G.createDataGateway({ sdk, routes: () => [], myCode: () => 'u1', canServer: () => true, queryOf: () => undefined, serverFirst: (s, a, b) => b(),
    post: () => Promise.resolve(), stream: () => () => {}, notifyError: () => {}, onOp: () => { ops++; } });
  const R = { toString: () => 'https://x/users/u1/a' };
  gw.get(R); gw.set(R, 1); gw.update(R, { a: 1 }); gw.remove(R); gw.onValue(R, () => {}); gw.push(R, 1);
  chk(ops === 6 && sdkCalls.length === 6, '범용 통로 — get · set · update · remove · onValue · push 마다 한 번(push 속 set 은 또 세지 않음) · ' + ops);
  const gw0 = G.createDataGateway({ sdk, routes: () => [], myCode: () => 'u1', canServer: () => true, queryOf: () => undefined, serverFirst: (s, a, b) => b(), post: () => Promise.resolve(), stream: () => () => {}, notifyError: () => {} });
  let threw = false; try{ gw0.get(R); }catch(_){ threw = true; }
  chk(!threw, '  ↳ onOp 를 안 넘겨도 그대로 돈다');
}
(async () => {
  {
    const A = asModule(AC);
    let reqs = 0, fetches = 0;
    const fetch = async () => { fetches++; return { status: 200, ok: true, json: async () => ({ success: true, data: { v: 1 } }) }; };
    const c = A.createApiClient({ baseUrl: 'https://api.together-working.com', fetch, onRequest: () => { reqs++; } });
    await c.get('/v1/x', { cacheMs: 60000 });
    await c.get('/v1/x', { cacheMs: 60000 });
    await c.post('/v1/y', {});
    chk(reqs === 2 && fetches === 2, 'API 통로 — 실제로 보낼 때만(캐시에서 준 것은 안 셈) · get · post · ' + reqs);
  }
  {
    const E = asModule(EC);
    let muted = true; const toasts = [];
    const N = E.createErrorNotice({ now: () => 1, toast: (m) => toasts.push(m), muted: () => muted });
    const w = console.warn; console.warn = () => {};
    const shown = N.notify('E-FR-01');
    muted = false;
    const shown2 = N.notify('E-FR-01');
    console.warn = w;
    chk(shown === false && toasts.length === 1 && N.recent().length === 2, '오류 번호 — 점검 중엔 토스트 없이 기록만 · 끝나면 그대로 띄운다');
  }

  say('── 4. 연결 · 규칙');
  const at = (s) => HTML.indexOf('<script src="parts/shared/' + s + '"');
  chk(at('maintenance-gate.js') > 0 && at('maintenance-gate.js') < at('error-codes.js') && at('maintenance-gate.js') < at('api-client.js'),
      'html — error-codes.js · api-client.js 보다 먼저 싣는다(firebase-init.js 는 module 이라 늘 뒤에 돈다)');
  const hit = (DR.match(/const UI_HIT_SEL = '([^']*)'/) || [])[1] || '';
  chk(hit.split(',').map(s => s.trim()).includes('#' + M.GATE_ID), '클릭 통과 목록(UI_HIT_SEL)에 #' + M.GATE_ID + ' — 투명 창에서도 단추를 누른다');
  chk(/onValue\(ref\(db, window\.TwMaintenance\.MAINTENANCE_PATH\), \(s\) => _mt\.onValue\(s\.val\(\)\), \(\) => \{\}\)/.test(FI) && /onOp: \(\) => _mt\.touch\(\)/.test(FI) && /onRequest: \(\) => _mt\.touch\(\)/.test(FI),
      'firebase-init — config/maintenance 구독 · 범용 통로 · 로그인 API 통로에 고리');
  chk(/onRequest: \(\) => \{ window\.TwMaintenance\.store\.touch\(\); \}/.test(AC) && /muted: \(\)=>window\.TwMaintenance\.store\.on\(\)/.test(EC), '  ↳ 공용 API 통로 · 오류 번호 한 벌에도');
  const n = (RULES.config || {}).maintenance || {};
  chk(n['.read'] === true && /admins/.test(n['.write'] || '') && /auth\.uid/.test(n['.write'] || ''), '★ config/maintenance — 누구나 읽기(로그인 전 · 점검 중) · 관리자만 쓰기');
  const ev = (rule, v) => { try{ return !!new Function('newData', 'return (' + rule + ');')(nd(v)); }catch(_){ return false; } };
  const nd = (v) => ({ isBoolean: () => typeof v === 'boolean', isNumber: () => typeof v === 'number', isString: () => typeof v === 'string', val: () => v,
    hasChildren: (ks) => !!v && typeof v === 'object' && ks.every(k => k in v), child: (k) => nd(v && typeof v === 'object' ? v[k] : undefined) });
  chk(ev(n['.validate'], { on: true }) && ev(n['.validate'], { on: false }) && !ev(n['.validate'], { on: 'true' }) && !ev(n['.validate'], {}), '  ↳ on 은 참 / 거짓 필수');
  chk(ev(n.endsAt['.validate'], 1) && !ev(n.endsAt['.validate'], 0) && ev(n.message['.validate'], 'x'.repeat(M.MESSAGE_MAX)) && !ev(n.message['.validate'], 'x'.repeat(M.MESSAGE_MAX + 1)) && n.$other['.validate'] === false,
      '  ↳ endsAt 양수 · message ' + M.MESSAGE_MAX + '자까지 · 다른 칸 거절');

  say('── 5. 깨 보기');
  const broke = (src, from, to) => { const s = src.replace(from, to); return s === src ? null : s; };
  const saved = [pass, fail];
  const quietRun = (MM) => { const log = console.log; console.log = () => {}; const p0 = pass, f0 = fail; let ok; try{ ok = run(MM, ''); }finally{ console.log = log; } pass = p0; fail = f0; return ok; };
  const b1 = broke(SRC, 'if(!cur || !userActive()) return false;', 'if(!cur) return false;');
  chk(b1 && !quietRun(asModule(b1)), '사람이 누른 동작 확인을 빼면 빨강(뒤에서 혼자 낸 요청에도 창)');
  const b2 = broke(SRC, "raw.on !== true", "!raw.on");
  chk(b2 && !quietRun(asModule(b2)), 'on 판정을 느슨하게 하면 빨강');
  const b3 = broke(SRC, 'if(was){', 'if(true){');
  chk(b3 && !quietRun(asModule(b3)), '본 적 없는데 다시 켜기를 물으면 빨강');
  const b5 = broke(SRC, 'const ACTIVE_MS = 1000;', 'const ACTIVE_MS = 5000;');
  chk(b5 && !quietRun(asModule(b5)), '판정 폭을 5초로 되돌리면 빨강(뒤쪽 요청에 창)');
  const b6 = broke(SRC, 'note(inGate){ if(!inGate) last = now(); }', 'note(inGate){ last = now(); }');
  chk(b6 && !quietRun(asModule(b6)), '점검 창 안 입력도 세면 빨강(«확인» 뒤 창이 다시 뜸)');
  const b4 = broke(EC, '    if(d.muted && d.muted()) return false;', '');
  { const E = b4 && asModule(b4); const t = []; const w = console.warn; console.warn = () => {};
    const s = E && E.createErrorNotice({ now: () => 1, toast: (m) => t.push(m), muted: () => true }).notify('E-FR-01'); console.warn = w;
    chk(b4 && s === true, '오류 토스트 조용히를 빼면 빨강'); }
  void saved;

  say('');
  say(fail ? ('✗ ' + fail + '건 어긋남 · 통과 ' + pass) : ('✅ 전부 통과 ' + pass));
  console.log(pass + ' · ' + fail);
  process.exit(fail ? 1 : 0);
})();
