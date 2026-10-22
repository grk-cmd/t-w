/* sim-focus-gate-self.js — 😴 투게더워킹 창이 앞에 오면 잠들던 것(제보 8) — 직전 상태를 둔다
   ・1절: 진짜 _applyActiveAppState 를 가짜 환경에서 돌린다 — 포커싱 어플 → 투게더워킹: 깨어 있음 유지 · 브라우저 → 투게더워킹: 잠듦 유지 ·
          투게더워킹이 앞인 동안 포커스 시간은 안 쌓임 · 피규어 모드 · 폰 켜짐은 예전처럼 이긴다 · isSelf 없는 옛 main 은 예전 그대로
   ・2절: main.js — 활성 창 상태에 isSelf(우리 앱 = SELF_EXE) 를 싣는다
   ・3절: 깨 보기 */
'use strict';
const { joinRenderer } = require('./sim-renderer-src.js');
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const APP = read('app.js'), MAIN = read('main.js');
if(!APP || !MAIN){ say('  ? 원본 못 찾음 — app.js · main.js'); process.exit(2); }
const SRC = joinRenderer(APP);

function grabFn(name, src){
  const m = new RegExp('function\\s+' + name + '\\s*\\(').exec(src);
  if(!m) return null;
  let i = src.indexOf('{', m.index), d = 0;
  for(let j = i; j < src.length; j++){ if(src[j] === '{') d++; else if(src[j] === '}'){ d--; if(!d) return src.slice(m.index, j + 1); } }
  return null;
}

function behave(fnSrc){
  const r = {};
  if(!fnSrc) return null;
  const mk = (o) => {
    const env = Object.assign({ now: 100000, added: 0, mob: false }, o || {});
    const ctx = { env, performance: { now: () => env.now }, console };
    vm.createContext(ctx);
    vm.runInContext(`
      let lastActivity = 0, figureMode = ${env.figure ? 'true' : 'false'}, focusGateSleep = true, _penAppFocused = false;
      function focusWindowMs(){ return 1500; }
      const focusLevelMod = { _mobileOn: () => env.mob, addFocusSeconds: (d) => { env.added += d; } };
      const _mobileOn = focusLevelMod._mobileOn, addFocusSeconds = focusLevelMod.addFocusSeconds;   // joinRenderer 는 옮기기 전 이름으로 되살린다
      const weeklyChal = { focusTick(){}, setKeyPlatform(){} };
      let _focusLastTick = performance.now(), _focusWasActive = false;
      ${fnSrc}
      this.api = { apply: _applyActiveAppState, act: (t) => { lastActivity = t; }, get: () => ({ gate: focusGateSleep, was: _focusWasActive }) };`, ctx);
    return ctx;
  };
  const REG = { hasAnyRegistered: true, isFocusedAppRegistered: true, isSelf: false };
  const BROWSER = { hasAnyRegistered: true, isFocusedAppRegistered: false, isSelf: false };
  const SELF = { hasAnyRegistered: true, isFocusedAppRegistered: false, isSelf: true };
  // 포커싱 어플(깨어 있음) → 투게더워킹: 깨어 있음 유지 · 그동안 안 쌓임
  { const c = mk(), A = c.api, E = c.env;
    A.act(E.now); A.apply(REG); E.now += 1000; A.act(E.now); A.apply(REG);
    const before = E.added;
    A.apply(SELF); E.now += 1000; A.act(E.now); A.apply(SELF); E.now += 1000; A.act(E.now); A.apply(SELF);
    const g = A.get();
    r.keepAwake = before > 0 && g.gate === false && g.was === false && E.added === before;   // 투게더워킹 창으로 넘어간 뒤로는 한 초도 안 쌓인다
  }
  // 브라우저(잠듦) → 투게더워킹: 잠듦 유지
  { const c = mk(), A = c.api;
    A.apply(BROWSER); A.apply(SELF);
    r.keepSleep = A.get().gate === true && A.get().was === false; }
  // 처음부터 투게더워킹(런처) — 처음 값(잠듦) 그대로
  { const c = mk(), A = c.api;
    A.apply(SELF); r.bootSelf = A.get().gate === true; }
  // 등록한 앱이 하나도 없음 + 투게더워킹 — 직전(잠듦) 유지
  { const c = mk(), A = c.api;
    A.apply({ hasAnyRegistered: false, isFocusedAppRegistered: false, isSelf: true }); r.noReg = A.get().gate === true; }
  // 피규어 모드 · 폰 켜짐은 투게더워킹이 앞이어도 예전처럼 깨운다
  { const c = mk({ figure: true }), A = c.api; A.apply(SELF); const f = A.get().gate === false;
    const c2 = mk({ mob: true }), A2 = c2.api; A2.apply(BROWSER); c2.env.mob = true; A2.apply(SELF); const m = A2.get().gate === false && A2.get().was === true;
    r.wins = f && m; }
  // isSelf 없는 옛 main(같은 앱 · 다른 판이 섞일 일은 없지만) — 예전 그대로 재움
  { const c = mk(), A = c.api;
    A.apply(REG); A.apply({ hasAnyRegistered: true, isFocusedAppRegistered: false }); r.legacy = A.get().gate === true; }
  // 투게더워킹 → 다시 브라우저 / 포커싱 어플 — 예전처럼 따른다
  { const c = mk(), A = c.api;
    A.apply(REG); A.apply(SELF); A.apply(BROWSER); const s1 = A.get().gate === true;
    A.apply(SELF); A.apply(REG); r.leave = s1 && A.get().gate === false; }
  return r;
}

say('── 1. _applyActiveAppState 를 실제로 돌린다');
const FN = grabFn('_applyActiveAppState', SRC);
const R = behave(FN);
chk(!!R, '_applyActiveAppState 를 찾았다');
if(R){
  chk(R.keepAwake, '포커싱 어플 → 투게더워킹 창: 깨어 있음 유지 · 그동안 포커스 시간은 안 쌓인다');
  chk(R.keepSleep, '브라우저(등록 안 됨) → 투게더워킹 창: 잠듦 유지');
  chk(R.bootSelf, '  켜자마자 투게더워킹 창(런처) — 처음 값 그대로');
  chk(R.noReg, '  등록한 앱이 없어도 투게더워킹 창은 직전 상태를 둔다');
  chk(R.wins, '피규어 모드 · 폰 켜짐은 투게더워킹 창이 앞이어도 예전처럼 깨운다');
  chk(R.legacy, 'isSelf 가 없는 상태(옛 main)는 예전 그대로 재운다');
  chk(R.leave, '투게더워킹 창을 떠나면 다음 창을 예전처럼 따른다');
}

say('── 2. main.js');
{
  const m = /lastActiveState = \{ exeName, key: activeKey, keyAlt: activeKeyAlt, isFocusedAppRegistered, hasAnyRegistered: focusApps\.some\(Boolean\), isPenApp: penNow, isSelf: !!exeName && exeName === SELF_EXE \};/.test(MAIN);
  chk(m && /const SELF_EXE = sysinput\.selfProcName\(\);/.test(MAIN), '활성 창 상태에 isSelf — 우리 앱 이름(sysinput.selfProcName · win 실행 파일 · mac 번들 id)과 같을 때만');
}

say('── 3. 깨 보기');
{
  const b1 = FN && FN.includes('const keepGate = state.isSelf === true && !figureMode && !mobOn;') ? behave(FN.replace('const keepGate = state.isSelf === true && !figureMode && !mobOn;', 'const keepGate = false;')) : null;
  chk(b1 && !b1.keepAwake, '투게더워킹 창을 «등록 안 된 앱» 으로 보면(옛 동작) 1절이 빨강');
  const b2 = FN && FN.includes('&& !figureMode && !mobOn;') ? behave(FN.replace('&& !figureMode && !mobOn;', ';')) : null;
  chk(b2 && !b2.wins, '피규어 모드 · 폰 켜짐까지 막으면 1절이 빨강');
}

say('');
say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
