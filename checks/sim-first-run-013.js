/* sim-first-run-013.js — 🚚 0.13 첫 실행(account/first-run-013.js) 검사 — 가짜 단계 · 가짜 저장소로 그대로 돌린다
   ・1절: 차례 — 로그인 → 캐릭터 → 라이선스 → 포커스 → 지우기 · 단계가 없으면 만들 때 던짐
   ・2절: 멈춤 — 한 단계라도 실패 · 기다림 · 던짐이면 거기서 멈추고 아무것도 안 지움 · 다음 실행에 처음부터
   ・3절: 지우기 — 단계들이 돌려준 키만(겹치면 한 번) · 다 끝나면 «이 계정으로 끝냄» · 같은 계정은 건너뜀 · 다른 계정은 다시
   ・4절: 다시 해도 같게 — 도는 중에 또 부르면 같은 약속 · 내 코드 없으면 안 돎
   ・5절: 자리 — pendingStep 은 늘 기다림(지우기를 막음) · loginStep 은 서버 계정 확인 뒤에만 · 로그인 키 목록 · mallangStep 은 이 PC 의 tw.mallang.* 만
   ・6절: 배선 — html(app.js 앞) · app.js 가 라이선스 단계를 채움 · 로그아웃이 옛 키를 안 지움
   ・6b절: 라이선스 키 단계(D8-3) — 키 없음 · 성공 · 서버 거절 갈래 · 해제 표시 · 네트워크
   ・6c절: 포커스 옛 누적 단계(D5-2) — 둘 다 있고 차가 양수 → 한 번 올림 · 마크 없음 → 안 올리고 지움 · 실패 → 아무것도 안 지우고 멈춤 · 이 PC 칸 · 계정 칸 둘 다 훑음
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
  const step = (name) => async () => { if((name === 'gacha' || name === 'mallang' || name === 'myhome' || name === 'focus') && !plan[name]) return { ok: true, wipe: [] }; order.push(name); const p = plan[name]; if(typeof p === 'function') return p(); return p; };
  let code = (uc === undefined) ? 'u1234567890' : uc;
  const fr = F.createFirstRun({ steps: { login: step('login'), gacha: step('gacha'), mallang: step('mallang'), myhome: step('myhome'), legacySync: step('legacySync'), licenseKey: step('licenseKey'), focus: step('focus') }, storage, userCode: () => code, log: { warn(){} } });
  return { F, fr, store, order, setCode: (c) => { code = c; } };
}
const OK = (w) => ({ ok: true, wipe: w || [] });

async function judge(S){
  say('── 1. 차례');
  {
    const e = mk(S, { login: OK(['a']), gacha: OK(['g']), mallang: OK(['m']), myhome: OK(['h']), legacySync: OK(['b']), licenseKey: OK([]), focus: OK(['f']) });
    const r = await e.fr.run();
    chk(r.ok && e.order.join() === 'login,gacha,mallang,myhome,legacySync,licenseKey,focus', '로그인 → 가챠 옛 키 → 말랑이 옛 칸 → 마이홈 옛 키 → 캐릭터 → 라이선스 → 포커스 옛 누적 차례로');
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
    {
      const keys = ['tw.bookmarks', 'gbClap:u1234567890:2026-11-13', 'gbClap:', 'tw.u.u1234567890.mhGbLastRead:u9', 'tw.mhGbLastRead:u9', 'tw.advZ.v2', 'x.gbClap:y'];
      const st = { length: keys.length, key: (i) => keys[i], getItem: (k) => (keys.indexOf(k) >= 0 ? '1' : null) };
      const hs = await F.myhomeStep(st)();
      chk(hs.ok === true && hs.wipe.join() === 'tw.bookmarks,gbClap:u1234567890:2026-11-13', 'myhomeStep — 이 PC 의 책장 사본(tw.bookmarks)과 박수 셈(gbClap:{주인}:{날짜})만 지우라고 한다(올리지 않음 · 읽음 시각 · 바탕화면 칸 · 다른 키는 그대로)');
      const none = await F.myhomeStep({ length: 0, key: () => null, getItem: () => null })();
      chk(none.ok === true && none.wipe.length === 0, '  ↳ 없으면 지울 것 없이 통과');
      const e4 = mk(S, { login: OK(), myhome: () => F.myhomeStep({ length: 2, key: (i) => ['gbClap:u1:d', 'keep'][i], getItem: (k) => (k === 'tw.bookmarks' ? null : '1') })(), legacySync: OK(), licenseKey: OK() });
      e4.store.set('gbClap:u1:d', '3');
      const r4 = await e4.fr.run();
      chk(r4.ok && !e4.store.has('gbClap:u1:d') && e4.store.has('keep'), '  ↳ 다 끝나면 그 키를 지운다');
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

  say('── 6c. 포커스 옛 누적 단계(D5-2)');
  {
    const F = load(S.FR);
    const cell = (c, k) => 'tw.u.' + c + '.' + k.replace(/^tw\./, '');
    const mkF = (entries, accrueFn, uc) => {
      const store = new Map(Object.entries(entries)), calls = [];
      const storage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
      const step = F.focusStep({ storage, userCode: () => (uc === undefined ? 'u1234567890' : uc), cellName: cell, accrue: async (n) => { calls.push(n); return accrueFn ? accrueFn(n) : { ok: true }; } });
      return { step, calls, store };
    };
    let e = mkF({ 'tw.focusTotalSec': '5000', 'tw.focusSyncedSec': '3000', 'tw.starColor': '#fff', 'tw.danceNotified': '[]', 'tw.danceNotifiedFix': '[]', 'tw.ideskNotified': '[]', keep: '1' });
    let r = await e.step();
    chk(r.ok === true && e.calls.join() === '2000', '누적 5000 · 마크 3000 → 올리지 않은 2000 을 한 번 올린다(누적 전체가 아니다)');
    chk(r.wipe.slice().sort().join() === ['tw.danceNotified', 'tw.danceNotifiedFix', 'tw.focusSyncedSec', 'tw.focusTotalSec', 'tw.ideskNotified', 'tw.starColor'].join(), '  ↳ 누적 · 마크 · 별 색 · 해금 안내 기록 셋을 지우라고 한다(다른 키는 아님)');
    e = mkF({ 'tw.focusTotalSec': '5000' }); r = await e.step();
    chk(r.ok === true && e.calls.length === 0 && r.wipe.join() === 'tw.focusTotalSec', '마크가 없으면 보내지 않고 지운다(어디까지 올렸는지 모른다 — 서버 값이 원본)');
    e = mkF({ 'tw.focusTotalSec': '3000', 'tw.focusSyncedSec': '3000' }); r = await e.step();
    chk(r.ok === true && e.calls.length === 0 && r.wipe.length === 2, '차가 0 이면 보내지 않고 지운다');
    e = mkF({ 'tw.focusTotalSec': '1000', 'tw.focusSyncedSec': '3000' }); r = await e.step();
    chk(r.ok === true && e.calls.length === 0, '마크가 누적보다 크면(서버가 더 앞섬) 보내지 않는다');
    e = mkF({ keep: '1' }); r = await e.step();
    chk(r.ok === true && e.calls.length === 0 && r.wipe.length === 0, '옛 키가 하나도 없으면 아무것도 안 한다');
    e = mkF({ 'tw.focusTotalSec': 'abc', 'tw.focusSyncedSec': '1' }); r = await e.step();
    chk(r.ok === true && e.calls.length === 0, '깨진 글은 올리지 않는다');
    e = mkF({ 'tw.focusTotalSec': '5000', 'tw.focusSyncedSec': '3000' }, () => ({ ok: false, reason: '서버' })); r = await e.step();
    chk(r.ok === false && !r.wipe && /올리기 실패/.test(r.reason), '★ 올리기 실패 → 멈춤 · 지우라는 말 없음(다음 실행에 다시)');
    e = mkF({ 'tw.focusTotalSec': '5000', 'tw.focusSyncedSec': '3000' }, () => { throw new Error('boom'); }); r = await e.step();
    chk(r.ok === false && !r.wipe, '  ↳ 던져도 같다');
    e = mkF({ 'tw.u.u1234567890.focusTotalSec': '9000', 'tw.u.u1234567890.focusSyncedSec': '8000', 'tw.starColor': '#fff' }); r = await e.step();
    chk(e.calls.join() === '1000' && r.wipe.includes('tw.u.u1234567890.focusTotalSec') && r.wipe.includes('tw.u.u1234567890.focusSyncedSec') && r.wipe.includes('tw.starColor'), '0.13 시험판이 계정 칸으로 옮겨 둔 값도 읽고(1000) 그 칸 · PC 칸 둘 다 지운다');
    e = mkF({ 'tw.focusTotalSec': '5000', 'tw.focusSyncedSec': '3000' }, null, null); r = await e.step();
    chk(r.ok === true && e.calls.join() === '2000', '내 코드가 없으면 계정 칸은 건너뛰고 PC 칸만 본다');
    /* 첫 실행 전체 — 실패하면 키가 남고 멈추며, 다음 실행에 성공하면 지운다 */
    const store = new Map([['tw.focusTotalSec', '5000'], ['tw.focusSyncedSec', '3000']]); let ok = false, n = 0;
    const storage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
    const fr = F.createFirstRun({ steps: { login: async () => OK(), gacha: async () => OK(), mallang: async () => OK(), myhome: async () => OK(), legacySync: async () => OK(), licenseKey: async () => OK(),
      focus: F.focusStep({ storage, userCode: () => 'u1234567890', cellName: cell, accrue: async () => { n++; return { ok }; } }) }, storage, userCode: () => 'u1234567890', log: { warn(){} } });
    const a1 = await fr.run();
    chk(!a1.ok && a1.at === 'focus' && store.has('tw.focusTotalSec') && store.has('tw.focusSyncedSec') && !store.has('tw.firstRun013'), '★ 첫 실행 — 올리기 실패면 두 키가 남고 거기서 멈춘다');
    ok = true; const a2 = await fr.run();
    chk(a2.ok && n === 2 && !store.has('tw.focusTotalSec') && !store.has('tw.focusSyncedSec') && store.get('tw.firstRun013') === 'u1234567890', '  ↳ 다음 실행에 성공하면 두 키를 지우고 끝낸다');
    const a = S.APP.indexOf('const firstRunMod = TwFirstRun013.createFirstRun(');
    const blk = a < 0 ? '' : S.APP.slice(a, a + 1800);
    chk(/focus: TwFirstRun013\.focusStep\(/.test(blk) && /accrue: \(sec\)=>focusProgressMod\.legacyAccrue\(sec\)/.test(blk), 'app.js — 포커스 단계를 진척 모듈의 옛 누적 올리기에 잇는다');
    const list = (S.ACC.match(/const ACCOUNT_LOCAL_KEYS = \(\)=>\[([\s\S]*?)\n\];/) || [])[1] || '';
    chk(list && !/starColor|DANCE_|danceNotified|ideskNotified|focusTotalSec|focusSyncedSec/.test(list), '로그아웃 지움 목록에 걷은 포커스 키가 없다(첫 실행이 지운다)');
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
    const fr = F.createFirstRun({ steps: { login: async () => OK(), gacha: async () => OK(), mallang: async () => OK(), myhome: async () => OK(), legacySync: async () => OK(), focus: async () => OK(),
      licenseKey: F.licenseKeyStep({ storage, activate: async () => { n++; return fails ? { ok: false, err: Object.assign(new Error('net'), { code: 'NETWORK' }) } : { ok: true }; } }) },
      storage, userCode: () => 'u1234567890', log: { warn(){} }, notify: (m) => notes.push(m) });
    const a1 = await fr.run();
    chk(!a1.ok && a1.at === 'licenseKey' && store.has('tw.licenseKey') && !store.has('tw.firstRun013') && n === 1, '네트워크 실패 → 첫 실행이 멈추고 키가 남는다');
    fails = false; const a2 = await fr.run();
    chk(a2.ok && n === 2 && !store.has('tw.licenseKey') && store.get('tw.firstRun013') === 'u1234567890', '  ↳ 다음 실행에 등록 한 번 더 → 성공 → 지움 · 끝냄');
    const notes2 = []; store.set('tw.licenseKey', 'K2'); store.delete('tw.firstRun013');
    const fr2 = F.createFirstRun({ steps: { login: async () => OK(), gacha: async () => OK(), mallang: async () => OK(), myhome: async () => OK(), legacySync: async () => OK(), focus: async () => OK(),
      licenseKey: F.licenseKeyStep({ storage, activate: async () => ({ ok: false, err: err(API.CODE.NOT_FOUND) }) }) },
      storage, userCode: () => 'u1234567890', log: { warn(){} }, notify: (m) => notes2.push(m) });
    const b = await fr2.run();
    chk(b.ok && notes2.length === 1 && notes2[0] === F.LICENSE_NOTICE.UNUSABLE && !store.has('tw.licenseKey'), '끝까지 돈 뒤에만 안내 한 번(멈춘 실행에는 안내 없음)');
    chk(notes.length === 0, '  ↳ 안내가 없는 결과엔 notify 0');
    const seen = []; store.set('tw.licenseKey', 'K3'); store.delete('tw.firstRun013');
    const fr3 = F.createFirstRun({ steps: { login: async () => OK(), gacha: async () => OK(), mallang: async () => OK(), myhome: async () => OK(), legacySync: async () => OK(), focus: async () => OK(),
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
  ['FR', "const STEPS = Object.freeze(['login', 'gacha', 'mallang', 'myhome', 'legacySync', 'licenseKey', 'focus']);", "const STEPS = Object.freeze(['login', 'gacha', 'mallang', 'myhome', 'licenseKey', 'legacySync', 'focus']);", '차례가 바뀜'],
  ['FR', "const STEPS = Object.freeze(['login', 'gacha', 'mallang', 'myhome', 'legacySync', 'licenseKey', 'focus']);", "const STEPS = Object.freeze(['login', 'gacha', 'myhome', 'legacySync', 'licenseKey', 'focus']);", '말랑이 단계가 빠짐'],
  ['FR', "const STEPS = Object.freeze(['login', 'gacha', 'mallang', 'myhome', 'legacySync', 'licenseKey', 'focus']);", "const STEPS = Object.freeze(['login', 'gacha', 'mallang', 'legacySync', 'licenseKey', 'focus']);", '마이홈 단계가 빠짐'],
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
  ['FR', "delta = Math.floor(total - synced);", "delta = Math.floor(total);", '마크를 안 빼고 누적 전체를 올림'],
  ['FR', "if(isFinite(total) && isFinite(synced)){ delta = Math.floor(total - synced); break; }", "if(isFinite(total)){ delta = Math.floor(total - (synced || 0)); break; }", '마크가 없어도 올림'],
  ['FR', "if(!r || r.ok !== true) return { ok: false, reason: '포커스 옛 누적 올리기 실패", "if(false) return { ok: false, reason: '포커스 옛 누적 올리기 실패", '올리기 실패해도 지움'],
  ['FR', "if(uc) places.unshift((k) => deps.cellName(uc, k));", "", '계정 칸을 안 훑음'],
  ['FR', "'tw.starColor', 'tw.danceNotified', 'tw.danceNotifiedFix', 'tw.ideskNotified']);", "'tw.starColor']);", '해금 안내 기록을 안 지움'],
  ['APP', "focus: TwFirstRun013.focusStep(", "focus: async ()=>({ ok: true, wipe: [] }) || TwFirstRun013.focusStep(", '포커스 단계를 안 채움'],
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
