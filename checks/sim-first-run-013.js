/* sim-first-run-013.js — 🚚 0.13 첫 실행(account/first-run-013.js) 검사 — 가짜 단계 · 가짜 저장소로 그대로 돌린다
   ・1절: 차례 — 로그인 → 캐릭터 → 라이선스 → 지우기 · 단계가 없으면 만들 때 던짐
   ・2절: 멈춤 — 한 단계라도 실패 · 기다림 · 던짐이면 거기서 멈추고 아무것도 안 지움 · 다음 실행에 처음부터
   ・3절: 지우기 — 단계들이 돌려준 키만(겹치면 한 번) · 다 끝나면 «이 계정으로 끝냄» · 같은 계정은 건너뜀 · 다른 계정은 다시
   ・4절: 다시 해도 같게 — 도는 중에 또 부르면 같은 약속 · 내 코드 없으면 안 돎
   ・5절: 자리 — pendingStep 은 늘 기다림(지우기를 막음) · loginStep 은 서버 계정 확인 뒤에만 · 로그인 키 목록 · mallangStep 은 이 PC 의 tw.mallang.* 만
   ・6절: 배선 — html(app.js 앞) · app.js 가 라이선스 단계를 채움 · 로그아웃이 옛 키를 안 지움
   ・6b절: 라이선스 키 단계(D8-3) — 키 없음 · 성공 · 서버 거절 갈래 · 해제 표시 · 네트워크
   ・7절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find((v) => v != null);
const SRC0 = {
  FR: pick(['first-run-013.js', 'parts/account/first-run-013.js', 'app/parts/account/first-run-013.js']),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
  APP: pick(['parts/app.js', 'app/parts/app.js']),
  ACC: pick(['parts/account/account.js', 'app/parts/account/account.js']),
  API: pick(['parts/account/license-api.js', 'app/parts/account/license-api.js']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const load = (src) => { const m = { exports: {} }; new Function('module', 'window', src)(m, undefined); return m.exports; };

function mk(S, plan, uc){
  const F = load(S.FR);
  const store = new Map([['a', '1'], ['b', '1'], ['c', '1'], ['keep', '1']]);
  const storage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const order = [];
  const step = (name) => async () => { if((name === 'gacha' || name === 'mallang') && !plan[name]) return { ok: true, wipe: [] }; order.push(name); const p = plan[name]; if(typeof p === 'function') return p(); return p; };
  let code = (uc === undefined) ? 'u1234567890' : uc;
  const fr = F.createFirstRun({ steps: { login: step('login'), gacha: step('gacha'), mallang: step('mallang'), legacySync: step('legacySync'), licenseKey: step('licenseKey') }, storage, userCode: () => code, log: { warn(){} } });
  return { F, fr, store, order, setCode: (c) => { code = c; } };
}
const OK = (w) => ({ ok: true, wipe: w || [] });

async function judge(S){
  say('── 1. 차례');
  {
    const e = mk(S, { login: OK(['a']), gacha: OK(['g']), mallang: OK(['m']), legacySync: OK(['b']), licenseKey: OK([]) });
    const r = await e.fr.run();
    chk(r.ok && e.order.join() === 'login,gacha,mallang,legacySync,licenseKey', '로그인 → 가챠 옛 키 → 말랑이 옛 칸 → 캐릭터 → 라이선스 차례로');
    let threw = false;
    try{ e.F.createFirstRun({ steps: { login: async () => OK() }, storage: {}, userCode: () => 'u1' }); }catch(_){ threw = true; }
    chk(threw, '단계가 빠지면 만들 때 던짐(조용히 건너뛰지 않음)');
  }

  say('── 2. 멈춤');
  {
    for(const [what, bad] of [['실패', { ok: false, reason: 'x' }], ['기다림', { ok: false, pending: true }], ['던짐', () => { throw new Error('boom'); }], ['빈 답', null]]){
      const e = mk(S, { login: OK(['a']), legacySync: bad, licenseKey: OK(['c']) });
      const r = await e.fr.run();
      chk(!r.ok && r.at === 'legacySync' && e.order.join() === 'login,legacySync' && e.store.has('a') && e.store.has('c') && !e.store.has('tw.firstRun013'),
        '캐릭터 단계 ' + what + ' — 거기서 멈춤 · 아무것도 안 지움 · 끝냄 표시 없음');
    }
    const e = mk(S, { login: OK(['a']), legacySync: { ok: false, pending: true }, licenseKey: OK() });
    await e.fr.run(); await e.fr.run();
    chk(e.order.join() === 'login,legacySync,login,legacySync', '다음 실행에 처음부터 다시');
  }

  say('── 3. 지우기');
  {
    const e = mk(S, { login: OK(['a', 'b']), legacySync: OK(['b']), licenseKey: OK(['c', '', 7]) });
    const r = await e.fr.run();
    chk(r.ok && r.wiped.join() === 'a,b,c' && !e.store.has('a') && !e.store.has('b') && !e.store.has('c') && e.store.has('keep'), '돌려준 키만 지움(겹치면 한 번 · 빈 값 · 글자 아님은 버림)');
    chk(e.store.get('tw.firstRun013') === 'u1234567890', '다 끝나면 «이 계정으로 끝냄»');
    const n = e.order.length;
    const r2 = await e.fr.run();
    chk(r2.ok && r2.skipped && e.order.length === n, '같은 계정은 건너뜀');
    e.setCode('u9999999999');
    await e.fr.run();
    chk(e.order.length === n + 3, '다른 계정이면 다시');
  }

  say('── 4. 다시 해도 같게');
  {
    let release;
    const gate = new Promise((r) => { release = r; });
    const e = mk(S, { login: async () => { await gate; return OK(); }, legacySync: OK(), licenseKey: OK() });
    const p1 = e.fr.run(), p2 = e.fr.run();
    chk(p1 === p2, '도는 중에 또 부르면 같은 약속');
    release(); await p1;
    chk(e.order.filter((x) => x === 'login').length === 1, '  ↳ 한 번만 돎');
    const e2 = mk(S, { login: OK(), legacySync: OK(), licenseKey: OK() }, null);
    const r = await e2.fr.run();
    chk(!r.ok && e2.order.length === 0, '내 코드가 없으면 안 돎');
  }

  say('── 5. 자리');
  {
    const F = load(S.FR);
    const p = await F.pendingStep('캐릭터')();
    chk(p.ok === false && p.pending === true, 'pendingStep — 늘 기다림');
    const gs = await F.gachaStep()();
    chk(gs.ok === true && gs.wipe.join() === 'tw.gachaOwned,tw.gachaOwnedTs,tw.gachaBonus' && F.GACHA_LEGACY_KEYS.join() === gs.wipe.join(), 'gachaStep — 올릴 것 없이 이 PC 가챠 옛 키 셋만 지우라고 한다(서버가 원본)');
    const e = mk(S, { login: OK(['a']), legacySync: () => F.pendingStep('캐릭터')(), licenseKey: OK() });
    await e.fr.run();
    chk(e.store.has('a') && e.order.indexOf('licenseKey') < 0, '  ↳ 채우기 전엔 지우기 · 뒤 단계가 돌지 않음');
    let isIn = false;
    const ls = F.loginStep(() => isIn);
    const a = await ls(); isIn = true; const b = await ls();
    chk(!a.ok && b.ok && b.wipe.join() === F.LOGIN_LEGACY_KEYS.join(), 'loginStep — 서버 계정 확인 뒤에만 · 로그인 키 목록');
    {
      const keys = ['tw.mallang.u1234567890', 'tw.mallang.anon', 'tw.mallangGiftHidden', 'tw.mallang.', 'tw.gachaOwned', 'x.tw.mallang.y'];
      const st = { length: keys.length, key: (i) => keys[i] };
      const ms = await F.mallangStep(st)();
      chk(ms.ok === true && ms.wipe.join() === 'tw.mallang.u1234567890,tw.mallang.anon', 'mallangStep — 이 PC 의 말랑이 옛 칸 백업(tw.mallang.{코드|anon})만 지우라고 한다(올리지 않음 · 선물 치움 키 · 다른 키는 그대로)');
      const none = await F.mallangStep({ length: 0, key: () => null })();
      chk(none.ok === true && none.wipe.length === 0, '  ↳ 없으면 지울 것 없이 통과');
      const e3 = mk(S, { login: OK(), mallang: () => F.mallangStep({ length: 2, key: (i) => ['tw.mallang.u1', 'keep'][i] })(), legacySync: OK(), licenseKey: OK() });
      e3.store.set('tw.mallang.u1', '[]');
      const r3 = await e3.fr.run();
      chk(r3.ok && !e3.store.has('tw.mallang.u1') && e3.store.has('keep'), '  ↳ 다 끝나면 그 키를 지운다');
    }
    chk(['tw.inviteToken', 'tw.signupPending', 'tw.invitePassed'].every((k) => F.LOGIN_LEGACY_KEYS.indexOf(k) >= 0) && F.LOGIN_LEGACY_KEYS.indexOf('tw.deviceId') < 0 && F.LOGIN_LEGACY_KEYS.indexOf('tw.me') < 0,
      '  ↳ 옛 가입 · 초대 키만 — 기기 id · 내 계정 사본은 안 지움');
  }

  say('── 6. 배선');
  {
    const H = S.HTML;
    const i = H.indexOf('<script src="parts/account/first-run-013.js"></script>');
    chk(i > 0 && H.indexOf('<script src="parts/app.js"') > i, 'html — app.js 앞');
    const a = S.APP.indexOf('const firstRunMod = TwFirstRun013.createFirstRun(');
    const blk = a < 0 ? '' : S.APP.slice(a, a + 1200);
    chk(/licenseKey: TwFirstRun013\.licenseKeyStep\(/.test(blk) && !/pendingStep/.test(blk), 'app.js — 라이선스 단계를 진짜 함수로 채움(기다림 아님)');
    chk(/notify: \(msg, action\)=>\{ if\(action === 'openSettings'\) toast\(msg, undefined, \d+, \{ label: '설정 열기', onClick: \(\)=>twNav\.go\(twNav\.NAV\.PROGRAM_SETTINGS, 'license'\) \}\); else toast\(msg\); \},/.test(blk), 'app.js — 안내는 토스트로 · 기기 가득 안내에는 [설정 열기](설정 › 라이선스)');
    const list = (S.ACC.match(/const ACCOUNT_LOCAL_KEYS = \(\)=>\[([\s\S]*?)\n\];/) || [])[1] || '';
    chk(list && !/LICENSE_KEY_STORAGE|LICENSE_OPTOUT_KEY/.test(list), '로그아웃 지움 목록에 옛 라이선스 키 · 해제 표시가 없다(올리기 전에 지우면 잃는다)');
  }

  say('── 6b. 라이선스 키 단계(D8-3)');
  {
    const F = load(S.FR);
    const API = load(S.API);
    const err = (code, kind) => Object.assign(new Error(code), { code, kind: kind || 'http' });
    const mkStep = (kv, behavior) => {
      const store = new Map(Object.entries(kv));
      const calls = { act: [] };
      const step = F.licenseKeyStep({
        storage: { getItem: (k) => (store.has(k) ? store.get(k) : null) },
        activate: async (k) => { calls.act.push(k); if(behavior.reg) return { ok: false, err: behavior.reg, reason: 'x' }; if(behavior.notConfirmed) return { ok: false, registered: true, reason: 'nc' }; return { ok: true }; },
      });
      return { step, calls };
    };
    const KEY = { 'tw.licenseKey': ' abcd-1234 ' };
    let e = mkStep({}, {}); let r = await e.step();
    chk(r.ok === true && r.wipe.length === 0 && !r.notice && e.calls.act.length === 0, '키 없음 → 통과 · 지울 것 없음 · 요청 0');
    e = mkStep({ 'tw.licenseOptOut': '1' }, {}); r = await e.step();
    chk(r.ok === true && r.wipe.join() === 'tw.licenseOptOut' && e.calls.act.length === 0, '키 없고 해제 표시만 있음 → 그것만 지움');
    e = mkStep(KEY, {}); r = await e.step();
    chk(r.ok === true && r.wipe.join() === 'tw.licenseKey' && !r.notice && e.calls.act.length === 1 && e.calls.act[0] === 'abcd-1234', '키 있음 → 키 등록 함수(activate) 한 번(앞뒤 공백 다듬음) → 지움');
    e = mkStep(KEY, { notConfirmed: true }); r = await e.step();
    chk(r.ok === true && r.wipe.join() === 'tw.licenseKey' && !r.notice, '등록은 됐는데 확인이 늦음 → 지움(서버엔 이미 올라감)');
    e = mkStep({ 'tw.licenseKey': 'K', 'tw.licenseOptOut': '1' }, {}); r = await e.step();
    chk(r.ok === true && r.wipe.join() === 'tw.licenseKey,tw.licenseOptOut' && e.calls.act.length === 0, '해제했던 PC(OptOut 있음) → 올리지 않고(요청 0) 둘 다 지움');
    for(const n of ['OWNED_BY_OTHER', 'NOT_FOUND', 'REVOKED']){
      e = mkStep(KEY, { reg: err(API.CODE[n]) }); r = await e.step();
      chk(r.ok === true && r.wipe.join() === 'tw.licenseKey' && r.notice === F.LICENSE_NOTICE.UNUSABLE && !r.action, n + ' → 지움 + 안내 하나(쓸 수 없는 옛 키 — 갈 곳 없음)');
    }
    e = mkStep(KEY, { reg: err(API.CODE.ALREADY_HAVE) }); r = await e.step();
    chk(r.ok === true && r.wipe.join() === 'tw.licenseKey' && !r.notice, 'ALREADY_HAVE → 안내 없이 지움(이미 이 계정에 라이선스가 있다)');
    e = mkStep(KEY, { reg: err(API.CODE.DEVICE_FULL) }); r = await e.step();
    chk(r.ok === true && r.wipe.join() === 'tw.licenseKey' && r.notice === F.LICENSE_NOTICE.DEVICE_FULL && /설정/.test(r.notice) && r.action === 'openSettings', 'DEVICE_FULL → 지움 + 기기 관리 안내 + [설정 열기](action)');
    for(const [what, beh] of [['네트워크', { reg: Object.assign(new Error('net'), { code: 'NETWORK' }) }], ['서버 5xx', { reg: err('INTERNAL') }], ['로그인 풀림', { reg: err('X', 'auth') }], ['로그인 풀림(읽기 전)', { reg: err('NOT_READ', 'auth') }]]){
      e = mkStep(KEY, beh); r = await e.step();
      chk(r.ok === false && !r.wipe && !r.notice, what + ' → 멈춤 · 아무것도 안 지움(다음 실행에 다시)');
    }
    /* 이어 붙이기 — 멈추면 키가 남고 다음 실행에 POST 한 번 */
    const store = new Map([['tw.licenseKey', 'K1'], ['x', '1']]); let n = 0, fails = true; const notes = [];
    const storage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
    const fr = F.createFirstRun({ steps: { login: async () => OK(), gacha: async () => OK(), mallang: async () => OK(), legacySync: async () => OK(),
      licenseKey: F.licenseKeyStep({ storage, activate: async () => { n++; return fails ? { ok: false, err: Object.assign(new Error('net'), { code: 'NETWORK' }) } : { ok: true }; } }) },
      storage, userCode: () => 'u1234567890', log: { warn(){} }, notify: (m) => notes.push(m) });
    const a1 = await fr.run();
    chk(!a1.ok && a1.at === 'licenseKey' && store.has('tw.licenseKey') && !store.has('tw.firstRun013') && n === 1, '네트워크 실패 → 첫 실행이 멈추고 키가 남는다');
    fails = false; const a2 = await fr.run();
    chk(a2.ok && n === 2 && !store.has('tw.licenseKey') && store.get('tw.firstRun013') === 'u1234567890', '  ↳ 다음 실행에 등록 한 번 더 → 성공 → 지움 · 끝냄');
    const notes2 = []; store.set('tw.licenseKey', 'K2'); store.delete('tw.firstRun013');
    const fr2 = F.createFirstRun({ steps: { login: async () => OK(), gacha: async () => OK(), mallang: async () => OK(), legacySync: async () => OK(),
      licenseKey: F.licenseKeyStep({ storage, activate: async () => ({ ok: false, err: err(API.CODE.NOT_FOUND) }) }) },
      storage, userCode: () => 'u1234567890', log: { warn(){} }, notify: (m) => notes2.push(m) });
    const b = await fr2.run();
    chk(b.ok && notes2.length === 1 && notes2[0] === F.LICENSE_NOTICE.UNUSABLE && !store.has('tw.licenseKey'), '끝까지 돈 뒤에만 안내 한 번(멈춘 실행에는 안내 없음)');
    chk(notes.length === 0, '  ↳ 안내가 없는 결과엔 notify 0');
    const seen = []; store.set('tw.licenseKey', 'K3'); store.delete('tw.firstRun013');
    const fr3 = F.createFirstRun({ steps: { login: async () => OK(), gacha: async () => OK(), mallang: async () => OK(), legacySync: async () => OK(),
      licenseKey: F.licenseKeyStep({ storage, activate: async () => ({ ok: false, err: err(API.CODE.DEVICE_FULL) }) }) },
      storage, userCode: () => 'u1234567890', log: { warn(){} }, notify: (m, a) => seen.push([m, a]) });
    const c = await fr3.run();
    chk(c.ok && seen.length === 1 && seen[0][0] === F.LICENSE_NOTICE.DEVICE_FULL && seen[0][1] === 'openSettings' && c.notices.join() === F.LICENSE_NOTICE.DEVICE_FULL, '기기 가득 안내는 notify 에 갈 곳(openSettings)을 같이 넘긴다 · 돌려주는 notices 는 글 그대로');
  }
}

(async () => {
await judge(SRC0);

say('── 7. 일부러 깨 보기');
const BREAKS = [
  ['FR', "const STEPS = Object.freeze(['login', 'gacha', 'mallang', 'legacySync', 'licenseKey']);", "const STEPS = Object.freeze(['login', 'gacha', 'mallang', 'licenseKey', 'legacySync']);", '차례가 바뀜'],
  ['FR', "const STEPS = Object.freeze(['login', 'gacha', 'mallang', 'legacySync', 'licenseKey']);", "const STEPS = Object.freeze(['login', 'gacha', 'legacySync', 'licenseKey']);", '말랑이 단계가 빠짐'],
  ['FR', "if(typeof k === 'string' && k.length > MALLANG_LEGACY_PREFIX.length && k.indexOf(MALLANG_LEGACY_PREFIX) === 0) wipe.push(k);", "if(typeof k === 'string' && k.indexOf('tw.mallang') === 0) wipe.push(k);", '말랑이 접두가 선물 치움 키까지 지움'],
  ['FR', "const GACHA_LEGACY_KEYS = Object.freeze(['tw.gachaOwned', 'tw.gachaOwnedTs', 'tw.gachaBonus']);", "const GACHA_LEGACY_KEYS = Object.freeze(['tw.gachaOwned', 'tw.gachaOwnedTs']);", '가챠 옛 키를 덜 지움'],
  ['FR', "        return { ok: false, at: name, pending: !!(r && r.pending), reason: (r && r.reason) || '' };", "        continue;", '실패해도 이어 감(올리기 전에 지움)'],
  ['FR', "      if(!r || r.ok !== true){", "      if(r && r.ok === false && !r.pending){", '기다림을 통과로 봄'],
  ['FR', "    try{ storage.setItem(DONE_KEY, uc); }catch(_){}", "", '끝냄을 안 적음(늘 다시 돎)'],
  ['FR', "    if(done === uc) return Promise.resolve({ ok: true, skipped: true, wiped: [] });", "    if(done) return Promise.resolve({ ok: true, skipped: true, wiped: [] });", '다른 계정도 건너뜀'],
  ['FR', "    if(running) return running;", "", '두 번 동시에 돎'],
  ['FR', "  for(const n of STEPS) if(typeof deps.steps[n] !== 'function') throw new Error('[0.13 첫 실행] 단계 없음 — ' + n);", "", '빠진 단계를 조용히'],
  ['FR', "function pendingStep(name){ return async () => ({ ok: false, pending: true,", "function pendingStep(name){ return async () => ({ ok: true, pending: true,", '기다림 자리가 통과'],
  ['FR', "const LOGIN_LEGACY_KEYS = Object.freeze(['tw.inviteToken', 'tw.signupPending', 'tw.invitePassed', 'tw.myFriendCodePrev']);", "const LOGIN_LEGACY_KEYS = Object.freeze(['tw.inviteToken', 'tw.signupPending', 'tw.invitePassed', 'tw.myFriendCodePrev', 'tw.deviceId']);", '기기 id 를 지움'],
  ['HTML', '<script src="parts/account/first-run-013.js"></script>', '', 'html 에 안 실음'],
  ['FR', "    if(!key || optOut) return { ok: true, wipe: allWipe };", "    if(!key) return { ok: true, wipe: allWipe };", '해제 표시(OptOut)를 안 봄'],
  ['FR', "if(!e || e.kind === 'auth' || !Object.keys(LICENSE_CODE).some((n) => LICENSE_CODE[n] === code)) return", "if(false) return", '실패해도 지움(네트워크 · 로그인 풀림)'],
  ['FR', "    if(code === LICENSE_CODE.ALREADY_HAVE) return { ok: true, wipe: allWipe };", "", 'ALREADY_HAVE 에도 안내'],
  ['FR', "if(r && (r.ok === true || r.registered === true)) return", "if(r && r.ok === true) return", '등록은 됐는데 확인이 늦으면 멈춤(안 지워 두 번 올림)'],
  ['FR', "if(deps.notify) for(const n of notices)", "if(deps.notify) for(const n of notices.concat(notices))", '안내가 두 번'],
  ['FR', "deps.notify(n.msg, n.action)", "deps.notify(n.msg)", '갈 곳(action)을 안 넘김'],
  ['FR', "action: 'openSettings' } : {", "} : {", '기기 가득 안내에 갈 곳 없음'],
  ['APP', "licenseKey: TwFirstRun013.licenseKeyStep(", "licenseKey: TwFirstRun013.pendingStep(", '라이선스 단계를 안 채움'],
  ['ACC', "  LICENSE_REQ_ID_KEY,   // 🎫 옛 값 지움", "  acctStateMod.LICENSE_KEY_STORAGE, LICENSE_REQ_ID_KEY,   // 🎫 옛 값 지움", '로그아웃이 옛 키를 지움'],
];
const caught = [];
for(const [where, from, to, what] of BREAKS){
  if(SRC0[where].indexOf(from) < 0){ chk(false, '깨 볼 글을 못 찾음 — ' + what); continue; }
  const S = Object.assign({}, SRC0); S[where] = S[where].split(from).join(to);
  quiet = true; qfail = 0;
  try{ await judge(S); }catch(_){ qfail++; }
  quiet = false;
  caught.push([what, qfail]);
}
const missed = caught.filter(([, k]) => k === 0).map(([w]) => w);
chk(caught.length === BREAKS.length && !missed.length, '일부러 깨 본 ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — 못 잡음: ' + missed.join(' · ') : ''));

console.log(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
