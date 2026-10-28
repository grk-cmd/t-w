/* sim-first-run-013.js — 🚚 0.13 첫 실행(account/first-run-013.js) 검사 — 가짜 단계 · 가짜 저장소로 그대로 돌린다
   ・1절: 차례 — 로그인 → 캐릭터 → 라이선스 → 지우기 · 단계가 없으면 만들 때 던짐
   ・2절: 멈춤 — 한 단계라도 실패 · 기다림 · 던짐이면 거기서 멈추고 아무것도 안 지움 · 다음 실행에 처음부터
   ・3절: 지우기 — 단계들이 돌려준 키만(겹치면 한 번) · 다 끝나면 «이 계정으로 끝냄» · 같은 계정은 건너뜀 · 다른 계정은 다시
   ・4절: 다시 해도 같게 — 도는 중에 또 부르면 같은 약속 · 내 코드 없으면 안 돎
   ・5절: 자리 — pendingStep 은 늘 기다림(지우기를 막음) · loginStep 은 서버 계정 확인 뒤에만 · 로그인 키 목록
   ・6절: 배선 — html(app.js 앞)
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
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const load = (src) => { const m = { exports: {} }; new Function('module', 'window', src)(m, undefined); return m.exports; };

function mk(S, plan, uc){
  const F = load(S.FR);
  const store = new Map([['a', '1'], ['b', '1'], ['c', '1'], ['keep', '1']]);
  const storage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const order = [];
  const step = (name) => async () => { order.push(name); const p = plan[name]; if(typeof p === 'function') return p(); return p; };
  let code = (uc === undefined) ? 'u1234567890' : uc;
  const fr = F.createFirstRun({ steps: { login: step('login'), legacySync: step('legacySync'), licenseKey: step('licenseKey') }, storage, userCode: () => code, log: { warn(){} } });
  return { F, fr, store, order, setCode: (c) => { code = c; } };
}
const OK = (w) => ({ ok: true, wipe: w || [] });

async function judge(S){
  say('── 1. 차례');
  {
    const e = mk(S, { login: OK(['a']), legacySync: OK(['b']), licenseKey: OK([]) });
    const r = await e.fr.run();
    chk(r.ok && e.order.join() === 'login,legacySync,licenseKey', '로그인 → 캐릭터 → 라이선스 차례로');
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
    const e = mk(S, { login: OK(['a']), legacySync: () => F.pendingStep('캐릭터')(), licenseKey: OK() });
    await e.fr.run();
    chk(e.store.has('a') && e.order.indexOf('licenseKey') < 0, '  ↳ 채우기 전엔 지우기 · 뒤 단계가 돌지 않음');
    let isIn = false;
    const ls = F.loginStep(() => isIn);
    const a = await ls(); isIn = true; const b = await ls();
    chk(!a.ok && b.ok && b.wipe.join() === F.LOGIN_LEGACY_KEYS.join(), 'loginStep — 서버 계정 확인 뒤에만 · 로그인 키 목록');
    chk(['tw.inviteToken', 'tw.signupPending', 'tw.invitePassed'].every((k) => F.LOGIN_LEGACY_KEYS.indexOf(k) >= 0) && F.LOGIN_LEGACY_KEYS.indexOf('tw.deviceId') < 0 && F.LOGIN_LEGACY_KEYS.indexOf('tw.me') < 0,
      '  ↳ 옛 가입 · 초대 키만 — 기기 id · 내 계정 사본은 안 지움');
  }

  say('── 6. 배선');
  {
    const H = S.HTML;
    const i = H.indexOf('<script src="parts/account/first-run-013.js"></script>');
    chk(i > 0 && H.indexOf('<script src="parts/app.js"') > i, 'html — app.js 앞');
  }
}

(async () => {
await judge(SRC0);

say('── 7. 일부러 깨 보기');
const BREAKS = [
  ['FR', "const STEPS = Object.freeze(['login', 'legacySync', 'licenseKey']);", "const STEPS = Object.freeze(['login', 'licenseKey', 'legacySync']);", '차례가 바뀜'],
  ['FR', "        return { ok: false, at: name, pending: !!(r && r.pending), reason: (r && r.reason) || '' };", "        continue;", '실패해도 이어 감(올리기 전에 지움)'],
  ['FR', "      if(!r || r.ok !== true){", "      if(r && r.ok === false && !r.pending){", '기다림을 통과로 봄'],
  ['FR', "    try{ storage.setItem(DONE_KEY, uc); }catch(_){}", "", '끝냄을 안 적음(늘 다시 돎)'],
  ['FR', "    if(done === uc) return Promise.resolve({ ok: true, skipped: true, wiped: [] });", "    if(done) return Promise.resolve({ ok: true, skipped: true, wiped: [] });", '다른 계정도 건너뜀'],
  ['FR', "    if(running) return running;", "", '두 번 동시에 돎'],
  ['FR', "  for(const n of STEPS) if(typeof deps.steps[n] !== 'function') throw new Error('[0.13 첫 실행] 단계 없음 — ' + n);", "", '빠진 단계를 조용히'],
  ['FR', "function pendingStep(name){ return async () => ({ ok: false, pending: true,", "function pendingStep(name){ return async () => ({ ok: true, pending: true,", '기다림 자리가 통과'],
  ['FR', "const LOGIN_LEGACY_KEYS = Object.freeze(['tw.inviteToken', 'tw.signupPending', 'tw.invitePassed', 'tw.myFriendCodePrev']);", "const LOGIN_LEGACY_KEYS = Object.freeze(['tw.inviteToken', 'tw.signupPending', 'tw.invitePassed', 'tw.myFriendCodePrev', 'tw.deviceId']);", '기기 id 를 지움'],
  ['HTML', '<script src="parts/account/first-run-013.js"></script>', '', 'html 에 안 실음'],
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
