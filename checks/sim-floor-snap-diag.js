/* ═══ 🩺 sim-floor-snap-diag.js — 🩺 바닥 맞춤 진단 모듈 구조 (2026-10-16 신설 · 구역 떼기 C · w1) ═══════════════
   app.js 의 바닥 맞춤 진단 본문 을 parts/character/floor-snap-diag.js 로 옮겼다(글자 그대로 · 바뀐 줄 2 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(4절 — 가짜 좌석으로 보고서).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(없음)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 3줄 그대로 · 부르는 곳은 floorSnapDiagMod.이름 · html(app.js 앞)
   ・4절: 동작 — 순수 판정 · 가짜 객체로 입력 → 출력 · 경계값(옮기기 전 app.js 글로도 같은 판정이 돈다)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · floor-snap-diag.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["floor-snap-diag.js","parts/character/floor-snap-diag.js","app/parts/character/floor-snap-diag.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — floor-snap-diag.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = ["findMySeat"];
const VAL_DEPS = ["charMeasureMod"];
const GET_DEPS = ["wardrobeMod"];
const SET_DEPS = [];
const EXPORTS = [];
const MOVED = ["_floorSnapProbe","floorSnapReport"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  charMeasureMod: charMeasureMod,","  findMySeat: (...a)=>findMySeat(...a),","  wardrobeMod: ()=>wardrobeMod,"];

/* 아무 이름 · 아무 부름이나 받아 주는 가짜 — 만들 때 하는 일(버튼 연결 · 저장값 읽기)이 던지지 않는지만 본다.
   then 도 받는다 — 만들 때 부르는 서버 요청(.then 잇기)이 던지지 않게(풀리지는 않는다) */
function anything(){
  const f = function(){ return P; };
  const P = new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? (() => '') : k === 'then' ? (() => P) : k === 'length' ? 0 : P, apply: () => P, construct: () => P, set: () => true, has: () => true });
  return P;
}
function build(src){
  const any = anything();
  const deps = {};
  FN_DEPS.forEach(n => { deps[n] = () => any; });
  VAL_DEPS.forEach(n => { deps[n] = any; });
  GET_DEPS.forEach(n => { deps[n] = () => any; });
  SET_DEPS.forEach(n => { deps['set' + n.replace(/^_+/, '').replace(/^./, c => c.toUpperCase())] = () => {}; });
  const win = new Proxy({}, { get: (t, k) => k in t ? t[k] : any, set: (t, k, v) => { t[k] = v; return true; } });
  const store = {};
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'addEventListener', 'removeEventListener', 'module', 'MutationObserver', 'ResizeObserver',
    src + '\nreturn window.TwFloorSnapDiag;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined, class { observe(){} disconnect(){} }, class { observe(){} disconnect(){} });
  return api.createFloorSnapDiag(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwFloorSnapDiag = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwFloorSnapDiag(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("FLOOR_SNAP_DIAG_MOD_OFF") && app.includes("const floorSnapDiagMod = TwFloorSnapDiag.createFloorSnapDiag({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const floorSnapDiagMod = TwFloorSnapDiag\\.createFloorSnapDiag\\(\\{\\n([\\s\\S]*?)\\n?\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = (mk ? mk.split('\n') : []).map(kindOf);   // deps 가 하나도 없으면 «({\n});»
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  /* 같은 이름의 딴 지역 변수가 app.js 에 따로 있는 이름(예: 함수 안 let)은 이 판정에서 뺀다 — 설정 localSame */
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:]|\\(\\)\\{\\})').test(A.replace(/const floorSnapDiagMod = [\s\S]*?\n\}\);/, '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''")));   // 따옴표 글자 안의 이름(안내 문구)은 부르는 곳이 아니다
  t(!bare.length, '부르는 곳은 floorSnapDiagMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/character/floor-snap-diag.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/character/floor-snap-diag.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/character/floor-snap-diag.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  /* deps 가 없는 모듈이면 거꾸로 한 줄을 끼워 넣어 본다(키 수가 어긋나야 잡힌다) */
  ['deps 하나 빠짐', null, GLUE.length ? (a => { const i = a.indexOf("const floorSnapDiagMod = TwFloorSnapDiag.createFloorSnapDiag({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }) : (a => a.replace("const floorSnapDiagMod = TwFloorSnapDiag.createFloorSnapDiag({", "const floorSnapDiagMod = TwFloorSnapDiag.createFloorSnapDiag({" + '\n  _extra: 1,')), null],
  ['전역 이름 안 걺', m => m.replace('window.TwFloorSnapDiag = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],

  ['만들 때 던짐', m => m.replace('function createFloorSnapDiag(deps){', 'function createFloorSnapDiag(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
/* ── 4. 동작 — 가짜 좌석(실제 three)으로 보고서를 굴려 콘솔 줄 · 돌려주는 글 · 불일치 경고를 본다(옮기기 전 app.js 글로도 같은 판정) */
say('── 4. 동작 — 바닥 맞춤 보고서');
{
  const tp = ['vendor/three/three.min.js', 'three.min.js', 'app/vendor/three/three.min.js'].find(p => fs.existsSync(p));
  const THREE = require(require('path').resolve(tp));
  const logs = [], warns = [];
  const con = { log: (...a) => logs.push(a.map(String).join(' ')), warn: (...a) => warns.push(a.map(String).join(' ')) };
  const mesh = (y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)); m.position.y = y; return m; };
  function mkSeat(depth, key){
    const g = new THREE.Group(); const model = new THREE.Group(); model.name = 'gltf'; g.add(model);
    model.add(mesh(0.5));
    const w = new THREE.Group(); w.name = '__partWrap_tub'; w.add(mesh(0.5 - depth)); model.add(w);   // 월드 min.y = -depth
    const s = { group: g, userScale: 1, userZ: 0 }; s[key || 'gltfRoot'] = model; return s;
  }
  function load(me, prev){
    const win = {};
    const wd = { wdPreviewBase: () => prev, wdScene: () => null };
    if(typeof MOD === 'string' && MOD){
      new Function('window', 'module', 'THREE', 'console', MOD)(win, undefined, THREE, con);
      /* measureUnderfootDepth 는 char-measure.js — 옮기기 전 글을 그대로 굴려 준다 */
      const a = SRC_M.indexOf('function measureUnderfootDepth('), b = SRC_M.indexOf('\n}\n', a) + 3;
      const mud = new Function('THREE', 'console', 'const FLOOR_SNAP_MAX = 1.2, FLOOR_SNAP_MIN = 0.005;\n' + SRC_M.slice(a, b) + '\nreturn measureUnderfootDepth;')(THREE, con);
      win.TwFloorSnapDiag.createFloorSnapDiag({ charMeasureMod: { measureUnderfootDepth: mud }, findMySeat: () => me, wardrobeMod: () => wd });
      return { report: win.floorSnapReport, win };   // 밖으로는 window.floorSnapReport 하나만(콘솔에서 부른다)
    }
    const a = SRC.indexOf("/* 🎩 '머리가 아니라 머리에 얹힌 것'"), b = SRC.indexOf('\n', SRC.indexOf('try{ window.floorSnapReport = floorSnapReport; }'));
    const r = new Function('THREE', 'console', 'window', 'findMySeat', 'wardrobeMod', SRC.slice(a, b) + '\nreturn floorSnapReport;')(THREE, con, win, () => me, wd);
    return { report: r, win };
  }
  const SRC_M = (typeof MOD === 'string' && MOD) ? ([ 'char-measure.js', 'parts/character/char-measure.js', 'app/parts/character/char-measure.js' ].map(f => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } }).find(Boolean) || '') : SRC;
  let L = load(mkSeat(0.3), mkSeat(0.3, 'root'));
  logs.length = 0; warns.length = 0;
  const ret = L.report();
  chk(ret === '위 로그를 복사해서 보내주세요' && typeof L.win.floorSnapReport === 'function', '돌려주는 글 · window.floorSnapReport 를 건다');
  chk(logs.some(l => l.startsWith('[바닥맞춤] 실행화면') && l.includes('depth=0.3000') && l.includes('모델노드=gltf')) && logs.some(l => l.startsWith('[바닥맞춤] 꾸미기/보관함 미리보기') && l.includes('depth=0.3000')), '실행 화면(gltfRoot) · 미리보기(root) 좌석 줄 — 모델 · 발밑 깊이');
  chk(logs.some(l => l.includes('⬇ 바닥아래') && l.includes('__partWrap_tub') && l.includes('[모델 안 → 바닥맞춤 대상]')), '  파츠 wrapper 줄 — 바닥 아래 · 모델 안');
  chk(warns.length === 0, '  두 쪽 깊이가 같으면 경고 없음');
  L = load(mkSeat(0.3), mkSeat(0.1, 'root')); logs.length = 0; warns.length = 0; L.report();
  chk(warns.length === 1 && warns[0].includes('실행 depth=0.3000') && warns[0].includes('미리보기 depth=0.1000'), '두 쪽 깊이가 다르면 경고 한 줄');
  L = load(null, null); logs.length = 0; warns.length = 0;
  chk(L.report() === '위 로그를 복사해서 보내주세요' && logs.filter(l => l.includes('좌석 없음')).length === 2, '좌석이 없으면 «좌석 없음» 두 줄 · 던지지 않는다');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
