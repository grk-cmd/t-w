/* ═══ 🩺 sim-run-diag-minute.js — 1분 진단 줄 모듈(launcher/run-diag-minute.js) ═══════════════
   app.js 의 1분 타이머 덩이([비용] 줄 · [프레임] 줄)를 parts/launcher/run-diag-minute.js 로 옮겼다(글자 그대로 · 바뀐 줄 둘 — 읽는 함수 · deps 로 받은 몸 숨김 판정).
   줄 모양은 sim-frame-budget · sim-gpu-timer · sim-run-cost-diag 가 «옮기기 전 app.js 글» 로 본다. 여기서는 모듈 모양 · 연결 · 한 번 돌려 본 동작을 본다.
   ・1절: 만들 때 — 던지지 않는다 · 60초 타이머 하나 · 내놓는 이름(없음)
   ・2절: 돌려 보기 — 실행 화면이 아니어도 1분 몫(히트 맵 그림자 운행 포함)을 비운다 · 실행 화면이면 [비용] → [프레임] 두 줄 · 그 뒤에 [지도] 줄들(판정이 없던 분은 없음) · 다시 대입되는 값은 그때 값 · 프레임 상한 모듈이 없으면 아무것도 안 한다
   ・3절: app.js 연결 — 1분 타이머가 app.js 에 안 남음 · deps 15줄 그대로 · 만드는 줄은 쓰는 값 선언 뒤 · html(app.js 앞)
   ・4절: 일부러 깨 보기
   [실행] 스테이징(node checks/run.js run-diag-minute) 또는 저장소 루트에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = ['app.js', 'app/parts/app.js'].map(read).find(Boolean), HTML = ['desk-companion-prototype.html', 'app/desk-companion-prototype.html'].map(read).find(Boolean);
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ['run-diag-minute.js', 'parts/launcher/run-diag-minute.js', 'app/parts/launcher/run-diag-minute.js'].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — run-diag-minute.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const EXPORTS = [];
const GLUE = ['  Presence: Presence,', '  _FB: _FB,', '  _bodyHidden: (...a)=>hiddenSeatsMod._bodyHidden(...a),', '  _frameBudget: _frameBudget,', '  _frameCap: (...a)=>_frameCap(...a),',
  '  _frameJsStats: _frameJsStats,', '  _gpuTimer: _gpuTimer,', '  _renderQuality: ()=>_renderQuality,', '  _runLowered: ()=>_runLowered,', '  canvas: canvas,', '  hitShadow: hitShadow,', '  key: key,',
  '  renderer: renderer,', '  runCost: runCost,', '  scene: scene,', '  seats: seats,'];
const MAKE = 'const runDiagMinuteMod = TwRunDiagMinute.createRunDiagMinute({';
const DECLS = ['const hitShadow = TwHitShadow.createHitShadow();', 'const _FB = FrameBudget;', 'const _frameBudget = ', 'const _gpuTimer = ', 'const _frameJsStats = ', 'const runCost = TwRunCostDiag.page;', 'const Presence = ', 'const hiddenSeatsMod = '];   // 값으로 넘기는 것 — 만드는 줄보다 먼저

/* 가짜 환경에서 만들고 타이머를 손으로 한 번씩 돌린다. noFB = 프레임 상한 모듈 없음(_frameBudget null) */
function build(src, opt){
  opt = opt || {};
  const timers = [], notes = [], took = { m: 0, gpu: 0, js: 0, run: 0, map: 0 }, seen = {};
  const st = { quality: 'auto', lowered: false };
  const body = { classList: { contains: (c) => c === 'runmode' && !!opt.runmode } };
  const companion = { diagNote: (s) => notes.push(s) };
  const win = { companion, _activeChannel: 2 };
  const seats = [{ id: 1 }, { id: 2 }];
  const deps = {
    Presence: { roomCode: () => 'ROOM', serverProvider: () => null },
    _FB: { diagLine: (m) => '[프레임] cap=' + m.cap + ' pr=' + m.pr + ' ' + m.w + 'x' + m.h + ' q=' + m.q + ' lowered=' + m.lowered },
    _bodyHidden: (s) => s.id === 2,
    _frameBudget: opt.noFB ? null : { takeMinute: (t) => { took.m++; return {}; } },
    _frameCap: (t) => 30,
    _frameJsStats: { take: () => { took.js++; return 'js'; } },
    _gpuTimer: { take: () => { took.gpu++; return 'gpu'; } },
    _renderQuality: () => st.quality,
    _runLowered: () => st.lowered,
    canvas: { width: 800, height: 600 },
    hitShadow: { take: () => { took.map++; return opt.mapLines || []; } },
    key: { castShadow: !!opt.shadow },
    renderer: { getPixelRatio: () => 1.5, info: { render: { calls: 42 } } },
    runCost: { take: () => { took.run++; return 'run'; } },
    scene: {},
    seats,
  };
  const TwRunCostDiag = {
    countSeats: (s, f) => { seen.seats = s; seen.hidden = s.filter(f).length; return 'S'; },
    roomKind: (code, ch, srv) => { seen.room = [code, ch, srv]; return 'K'; },
    line: (run, s, room) => '[비용] ' + run + ' ' + s + ' ' + room,
  };
  const TwGpuTimer = { countCasters: () => 7, suffix: (cost) => ' · ' + cost.gpu + '/' + cost.js + '/' + cost.calls + '/' + cost.casters };
  const TwHitShadow = { lines: (r) => r.slice() };   // take() 가 준 것을 그대로 줄로
  const api = new Function('window', 'document', 'companion', 'performance', 'TwRunCostDiag', 'TwGpuTimer', 'TwHitShadow', 'setInterval', 'module', src + '\nreturn window.TwRunDiagMinute;')(
    win, { body }, companion, { now: () => 1234 }, TwRunCostDiag, TwGpuTimer, TwHitShadow, (fn, ms) => { timers.push({ fn, ms }); return 1; }, undefined);
  const out = api.createRunDiagMinute(deps);
  return { out, timers, notes, took, seen, st, tick: () => timers[0] && timers[0].fn() };
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let b = null, err = null;
  try{ b = build(mod); }catch(e){ err = e; }
  t(!err && b && b.out && typeof b.out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(b && b.timers.length === 1 && b.timers[0].ms === 60000, '만들 때 60초 타이머 하나' + (b ? ' — 받은 값: ' + b.timers.map(x => x.ms).join(',') : ''));
  t(b && b.out && EXPORTS.every(n => n in b.out) && Object.keys(b.out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개');
  t(/window\.TwRunDiagMinute = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwRunDiagMinute(Tw 접두사)');
  /* 2절 — 돌려 보기 */
  let off = null, on = null, nofb = null, sh = null, mp = null;
  try{
    off = build(mod); off.tick();
    on = build(mod, { runmode: true }); on.st.quality = 'sharp'; on.st.lowered = true; on.tick();
    nofb = build(mod, { runmode: true, noFB: true }); nofb.tick();
    sh = build(mod, { runmode: true, shadow: true }); sh.tick();
    mp = build(mod, { runmode: true, mapLines: ['[지도] a', '[지도✗] b'] }); mp.tick();
  }catch(_){}
  t(off && off.notes.length === 0 && off.took.m === 1 && off.took.gpu === 1 && off.took.js === 1 && off.took.run === 1 && off.took.map === 1, '실행 화면이 아니면 적지 않지만 1분 몫(프레임 · GPU · JS · 비용 · 지도)은 비운다');
  t(mp && mp.notes.length === 4 && mp.notes[2] === '[지도] a' && mp.notes[3] === '[지도✗] b' && on && on.notes.length === 2, '  [지도] 줄들은 [프레임] 뒤에 받은 차례대로 · 없으면(판정 없던 분) 안 적는다' + (mp ? ' — ' + JSON.stringify(mp.notes).slice(0, 120) : ''));
  t(on && on.notes.length === 2 && /^\[비용\] run S K$/.test(on.notes[0]) && /^\[프레임\] /.test(on.notes[1]), '실행 화면이면 [비용] 줄 → [프레임] 줄 두 줄' + (on ? ' — ' + JSON.stringify(on.notes).slice(0, 160) : ''));
  t(on && /cap=30 pr=1\.5 800x600 q=sharp lowered=true/.test(on.notes[1] || ''), '  [프레임] 줄 — 상한 · 배율 · 캔버스 · 화질 · 낮춤은 적는 그때 값(읽는 함수)');
  t(on && / · gpu\/js\/42\/0$/.test(on.notes[1] || '') && sh && / · gpu\/js\/42\/7$/.test(sh.notes[1] || ''), '  그림자 수는 빛이 그림자를 만들 때만 센다(아니면 0)');
  t(on && on.seen.seats && on.seen.seats.length === 2 && on.seen.hidden === 1 && JSON.stringify(on.seen.room) === JSON.stringify(['ROOM', 2, false]), '  [비용] 줄 — 좌석 · 몸 숨김 판정 · 방 종류(코드 · 채널 · 서버 provider 여부)');
  t(nofb && nofb.notes.length === 0 && nofb.took.gpu === 0 && nofb.took.run === 0 && nofb.took.map === 0, '프레임 상한 모듈이 없으면(null) 아무것도 안 한다(옮기기 전과 같음)');
  /* 3절 — 연결 */
  const A = strip(app);
  t(!/\},\s*60000\);/.test(A) && !/takeMinute\(/.test(A) && !/companion\.diagNote\(_FB\.diagLine/.test(A), 'app.js 에 1분 타이머 · takeMinute · [프레임] 줄이 안 남았다');
  const mk = (app.match(/const runDiagMinuteMod = TwRunDiagMinute\.createRunDiagMinute\(\{\n([\s\S]*?)\n\}\);/) || [])[1] || '';
  t(mk === GLUE.join('\n'), 'deps ' + GLUE.length + '개 — 그대로(함수 2 · 읽는 함수 2 · 값 12)');
  const i = app.indexOf(MAKE), late = DECLS.filter(d => { const k = app.indexOf(d); return k < 0 || k > i; });
  t(i > 0 && !late.length, '만드는 줄은 값으로 넘기는 선언 뒤(TDZ 없음)' + (late.length ? ' — ' + late.join(' · ') : ''));
  const M = strip(mod);
  t(!/hiddenSeatsMod/.test(M) && !/\bm\.q = _renderQuality;/.test(M) && !/m\.lowered = _runLowered;/.test(M), '모듈은 숨김 모듈을 직접 안 부르고 · 다시 대입되는 값은 이름() 으로 읽는다');
  const iM = html.indexOf('<script src="parts/launcher/run-diag-minute.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/launcher/run-diag-minute.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 4) say('── 2. 돌려 보기'); if(i === 11) say('── 3. app.js 연결'); chk(ok, msg); });
say('── 4. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/launcher/run-diag-minute.js"></script>', '')],
  ['deps 하나 빠짐', null, a => a.replace('\n  key: key,\n', '\n'), null],
  ['전역 이름 안 걺', m => m.replace('window.TwRunDiagMinute = api;', ''), null, null],
  ['만들 때 던짐', m => m.replace('function createRunDiagMinute(deps){', 'function createRunDiagMinute(deps){ throw new Error("깨 봄");'), null, null],
  ['실행 화면 확인을 비우기 앞으로', m => m.replace("    if(!document.body.classList.contains('runmode')) return;\n", '').replace('    const t = performance.now();\n', "    if(!document.body.classList.contains('runmode')) return;\n    const t = performance.now();\n"), null, null],
  ['두 줄 차례 바뀜', m => { const a = m.match(/\n    companion\.diagNote\(TwRunCostDiag\.line[^\n]*/)[0], b = m.match(/\n    companion\.diagNote\(_FB\.diagLine[^\n]*/)[0]; return m.replace(a, '\u0000').replace(b, a).replace('\u0000', b); }, null, null],
  ['읽는 함수를 값처럼 씀', m => m.replace('m.q = _renderQuality();', 'm.q = _renderQuality;'), null, null],
  ['[지도] 줄을 안 적음', m => m.replace(/\n    for\(const l of TwHitShadow\.lines\(hitMapMin\)\) companion\.diagNote\(l\);[^\n]*/, ''), null, null],
  ['지도 몫을 실행 화면일 때만 비움', m => m.replace('    const hitMapMin = hitShadow.take();\n', '').replace("    if(!(window.companion && companion.diagNote)) return;\n", "    if(!(window.companion && companion.diagNote)) return;\n    const hitMapMin = hitShadow.take();\n"), null, null],
  ['그림자 조건 빠짐', m => m.replace('cost.casters = key.castShadow ? TwGpuTimer.countCasters(scene) : 0;', 'cost.casters = TwGpuTimer.countCasters(scene);'), null, null],
  ['app.js 에 1분 타이머가 다시 생김', null, a => a + '\nsetInterval(()=>{}, 60000);', null],
  ['만드는 줄이 값 선언보다 앞', null, a => { const i = a.indexOf('/* 🩺 1분 진단 줄'), j = a.indexOf('\n});', a.indexOf(MAKE)) + 4; const blk = a.slice(i, j); const rest = a.slice(0, i) + a.slice(j); const k = rest.indexOf('const _FB = FrameBudget;'); return rest.slice(0, k) + blk + '\n' + rest.slice(k); }, null],
];
for(const [name, fm, fa, fh] of breaks){
  let m2 = MOD, a2 = SRC, h2 = HTML;
  try{ m2 = fm ? fm(MOD) : MOD; a2 = fa ? fa(SRC) : SRC; h2 = fh ? fh(HTML) : HTML; }catch(_){}
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
