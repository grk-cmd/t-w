/* sim-fix-1016b.js — 🐞 버그 제보 묶음(2026-10-16 접수분 · 난이도 «중») 검사
   실행:  node sim-fix-1016b.js   (저장소 루트에서 · 러너는 app/ 을 펼친 자리에서)
   §9  보관함 이동 — 동기화가 슬롯을 새로 깔면 슬롯은 남고 보관함에도 들어가 복제
   §13 다른 앱 더블클릭 — 고착 회복 사다리 3단계가 남의 앱 위 클릭에도 0.8초 클릭받기를 걸어 투게더워킹이 앞으로 */
'use strict';
const fs = require('fs');
const say = console.log;
let pass = 0, fail = 0;
const chk = (ok, msg) => { ok ? pass++ : fail++; say((ok ? '  ✓ ' : '  ✗ ') + msg); };
const read = (...cands) => { for (const c of cands) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const need = (rel, ...more) => { const s = read('app/' + rel, rel, rel.replace(/^parts\/[^/]+\//, 'parts/'), rel.split('/').pop(), ...more); if (s == null) { say('  ? 원본 못 찾음 — ' + rel); process.exit(2); } return s; };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

const LC = need('parts/launcher/launcher-controls.js');
const DR = need('parts/launcher/desktop-run.js');
const MAIN = (() => { const s = read('main.js', '../main.js'); if (s == null) { say('  ? 원본 못 찾음 — main.js'); process.exit(2); } return s; })();

/* §9 (보관함 이동 — 동기화가 슬롯을 새로 깔면 복제) 는 서버 원본으로 없어졌다 — 앱이 서버에 옮기고 된 뒤에만 칸을 당기므로 슬롯을 새로 까는 동기화가 없다.
   판정은 sim-closet(서버가 된 뒤 당김 · 한 번에 하나) · sim-launcher-controls(실패하면 칸 그대로) 가 한다. */
{
  return Promise.resolve().then(() => {

    say('§13 고착 회복 사다리 3단계 — 우리 UI 위 클릭일 때만');
    const D = strip(DR);
    const kick = (D.match(/window\.__mouseKick = function\(offOverlay, onUI\)\{[\s\S]*?\n    \};/) || [''])[0];
    chk(!!kick, '__mouseKick(offOverlay, onUI) 를 찾았다');
    chk(/window\.__mouseKick\(state && state\.offOverlay, state && state\.onUI\)/.test(D), '  ↳ 전역 클릭이 onUI 를 넘긴다');
    const POLICY = (() => { const t = need('parts/launcher/click-through-policy.js'); const m = { exports: {} }; new Function('module', 'window', t)(m, undefined); return m.exports; })();
    const mk = () => {
      const log = [];
      const env = {
        _ignoreSent: true, _ignoring: true, _lastKickAt: 0, _lastMoveSeen: 1, _lastPokePen: false, _lastPokeAt: 0, _kickStage: 0, _probeTimer: null,
        _penSkipLoggedAt: 0, _offSkipLoggedAt: 0, _offUiSkipLoggedAt: 0,
      };
      let t = 100000;
      /* 사다리 판단은 click-through-policy.js(kickStep)로 묶였다 — 진짜 정책 모듈을 같이 싣는다(판정 무변경) */
      const api = new Function('env', 'log', 'clock', 'clickPolicy',
        'let { _ignoreSent, _ignoring, _lastKickAt, _lastMoveSeen, _lastPokePen, _lastPokeAt, _kickStage, _probeTimer, _penSkipLoggedAt, _offSkipLoggedAt, _offUiSkipLoggedAt } = env;\n'
        + 'const performance = { now: () => clock() }; const console = { warn: () => {} }; const window = {};\n'
        + 'const _penAppFocused = () => false; const setTimeout = () => 1; const clearTimeout = () => {};\n'
        + "const _sendIgnore = (v, why) => { log.push((v ? 'ignore' : 'take') + (why ? ':' + why : '')); _ignoreSent = v; };\n"
        + kick + '\nreturn { kick: window.__mouseKick, stage: () => _kickStage };')(env, log, () => t, POLICY);
      return { api, log, tick: (ms) => { t += ms; } };
    };
    const clickN = (onUI, n) => { const k = mk(); for (let i = 0; i < n; i++){ k.api.kick(false, onUI); k.tick(1600); } return k; };
    const off = clickN(false, 6), on = clickN(true, 6), legacy = clickN(undefined, 6);
    chk(!off.log.some((x) => /^take/.test(x)), '★ 남의 앱 위 클릭(onUI=false)을 여러 번 해도 0.8초 클릭받기(take)를 걸지 않는다');
    chk(off.log.filter((x) => x === 'ignore').length === 2, '  ↳ 1 · 2단계 재무장(통과 그대로)은 예전처럼 돈다');
    chk(on.log.some((x) => x === 'take:kick3'), '우리 UI 위 클릭(onUI=true)이면 3단계가 예전처럼 돈다');
    chk(legacy.log.some((x) => x === 'take:kick3'), '  ↳ 흉내: onUI 를 안 보내는 옛 main(undefined)이면 남의 앱 위에서도 3단계 — 이게 제보의 증상');
    const ux = (MAIN.match(/const _onGlobalMouseDown = \(e\) => \{[\s\S]*?\n  \};/) || [''])[0];
    chk(/onUI = _ptOnOurUI\(pt\.x - _mainWinScreenBounds\.x, pt\.y - _mainWinScreenBounds\.y\)/.test(ux) && /offOverlay, onUI \}\);/.test(ux), 'main 전역 mousedown 이 onUI(우리 UI 위인가 · 창 기준 좌표)를 실어 보낸다');
    chk(/if\(_mainWinScreenBounds && \(_lastCharBounds \|\| _lastRegions\.length\)\)/.test(ux), '  ↳ UI 자리를 모르면 보내지 않는다(undefined → 렌더러는 예전처럼)');
  }).then(() => {
    say(`\n${pass} · ${fail}`);
    say(fail ? `실패 ${fail}건` : `전부 통과 (${pass})`);
    process.exit(fail ? 1 : 0);
  }).catch((e) => { say('  ✗ 검사가 던졌다: ' + (e && e.stack || e)); process.exit(1); });
}
