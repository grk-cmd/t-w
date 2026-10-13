/* ═══ 🧩 sim-renderer-src.js — «옮기기 전 app.js 글» 을 되살리는 검사용 도우미 (2026-10-14 신설 · 앱 FSD 2차) ═══════════════
   [왜] 앱 FSD 로 app.js 구역을 모듈(app/parts/*.js)로 옮기면, app.js 글에서 함수 몸통 · 문구를 찾던 옛 검사들이 «없다» 로 빨개진다.
     판정은 그대로 두고 읽는 글만 옮기기 전 모양으로 돌려주면 옛 검사가 같은 뜻으로 돈다. 검사마다 몇 줄씩 덧대지 않게 한 곳에 모은다.
   [쓰는 법] const { joinRenderer } = require('./sim-renderer-src.js');  const APP = joinRenderer(fs.readFileSync('app.js', 'utf8'));
   [되살리기] 아래 MODULES 마다 —
     ① app.js 의 부르는 자리 «mod.이름» 에서 «mod.» 를 뗀다(읽는 함수로 내놓은 이름은 «mod.이름()» → «이름»)
     ② 모듈 글에서 deps 받는 줄(const X = deps.X;)을 빼고, 읽는 함수 «X()» → «X», 쓰는 함수 «setX(v)» → «x = v» 로 되돌린다
        (어느 이름이 읽는 · 쓰는 함수인지는 app.js 의 만드는 줄 — «X: ()=>X,» · «setX: (v)=>{ x = v; },» — 에서 읽는다)
     ③ app.js 뒤에 되돌린 모듈 글을 잇는다(모듈 파일이 없으면 — 옮기기 전 판 — app.js 그대로)
   ⚠️ 새 구역을 옮길 때마다 MODULES 에 한 줄을 더한다(fsdmove 로 옮긴 모듈만 — 1차 모듈은 각 검사가 이미 따로 읽는다).
   [직접 실행] 되살리기가 맞는지 스스로 본다(모듈마다 deps 줄 · mod. 이 안 남고, 옛 이름 선언이 다시 보인다). */
'use strict';
const fs = require('fs');
const MODULES = [
  { file: 'my-info.js', mod: 'myInfoMod', glob: 'TwMyInfo', sample: 'function openMyInfo(' },   // 앱 FSD 17번
  { file: 'chars.js', mod: 'charsMod', glob: 'TwChars', sample: 'function _charsSync(' },       // 앱 FSD 18번
  { file: 'slot-sync.js', mod: 'slotSyncMod', glob: 'TwSlotSync', sample: 'function _slotsSeenSet(' },   // 앱 FSD 19번
];
const readPart = (name) => { for(const p of [name, 'parts/' + name, 'app/parts/' + name]){ try{ return fs.readFileSync(p, 'utf8'); }catch(_){} } return null; };
const esc = (s) => s.replace(/[$]/g, '\\$');

function joinRenderer(app){
  if(typeof app !== 'string') return app;
  /* ① 모듈 글을 되살린다(deps 줄 빼기 · 읽는 함수 · 쓰는 함수) ② 그다음 app.js 와 모듈 글 모두에서 «mod.» 를 뗀다 —
     옮긴 모듈끼리 부르는 자리(예: 슬롯 동기화 → charsMod._chars…)도 옮기기 전 글로 돌아간다 */
  const parts = [];
  const retGet = [], retSet = [];
  for(const m of MODULES){
    const txt = readPart(m.file); if(!txt) continue;
    const i = app.indexOf('const ' + m.mod + ' = (typeof ' + m.glob);
    const j = i >= 0 ? app.indexOf('\n});', i) : -1;
    const glue = i >= 0 ? app.slice(i, j) : '';
    const getters = [...glue.matchAll(/^  ([\w$]+): \(\)=>(?:[\w$]+\.)?([\w$]+)(?:\(\))?,$/gm)].map(x => x[1]);   // 키 = 모듈 안 이름(오른쪽이 다른 모듈의 읽는 함수여도)
    const setters = [...glue.matchAll(/^  ([\w$]+): \(v\)=>\{ ([\w$]+) = v; \},$/gm)].map(x => [x[1], x[2]]);
    for(const x of txt.matchAll(/^  ([\w$]+): \(\)=>([\w$]+),/gm)) retGet.push([m.mod, x[1]]);
    for(const x of txt.matchAll(/^  ([\w$]+): \(v\)=>\{ ([\w$]+) = v; \},/gm)) retSet.push([m.mod, x[1], x[2]]);
    /* 껍데기(IIFE · createX(deps){ … return {…} })를 벗기고 본문만 — 옮긴 선언이 옛 자리처럼 꼭대기에 선다(함수를 돌려 보는 검사용) */
    const h = txt.match(/\nfunction create[\w$]*\(deps\)\{\n/);
    const r = txt.lastIndexOf('\nreturn {');
    let body = (h && r > h.index) ? txt.slice(h.index + h[0].length, r) : txt;
    body = body.replace(/^const [\w$]+ = deps\.[\w$]+;.*\n/gm, '').replace(/^const [\w$]+ = deps\.[\w$]+, [\w$]+ = deps\.[\w$]+;.*\n/gm, '');
    if(getters.length) body = body.replace(new RegExp('\\b(' + getters.map(esc).join('|') + ')\\(\\)', 'g'), '$1');
    for(const [set, name] of setters) body = body.replace(new RegExp('\\b' + esc(set) + '\\(([^()]*)\\)', 'g'), name + ' = $1');
    parts.push([i, body]);
  }
  /* 옛 app.js 의 차례대로 잇는다(만드는 줄 자리 = 옛 본문 자리) — 앞 모듈의 꼭대기 선언을 뒤 모듈이 읽을 수 있다 */
  parts.sort((a, b) => a[0] - b[0]);
  let all = app + (parts.length ? '\n' + parts.map(x => x[1]).join('\n') : '');
  for(const [mod, n] of retGet) all = all.replace(new RegExp('\\b' + esc(mod) + '\\.' + esc(n) + '\\(\\)', 'g'), n);
  for(const [mod, set, name] of retSet) all = all.replace(new RegExp('\\b' + esc(mod) + '\\.' + esc(set) + '\\(([^()]*)\\)', 'g'), name + ' = $1');
  for(const m of MODULES) all = all.replace(new RegExp('\\b' + esc(m.mod) + '\\.', 'g'), '');
  return all;
}
module.exports = { joinRenderer, MODULES };

if(require.main === module){
  let pass = 0, fail = 0;
  const chk = (ok, msg) => { ok ? pass++ : fail++; console.log('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
  const app = readPart('app.js');
  if(!app){ console.log('  ? 원본 못 찾음 — app.js'); process.exit(2); }
  const J = joinRenderer(app);
  for(const m of MODULES){
    const txt = readPart(m.file);
    if(!txt){ console.log('  ? 원본 못 찾음 — ' + m.file); process.exit(2); }
    const code = J.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
    chk(!new RegExp('\\b' + esc(m.mod) + '\\.').test(code), m.file + ' — 부르는 자리의 «' + m.mod + '.» 가 안 남는다(주석 빼고)');
    chk(J.includes(m.sample), m.file + ' — 옛 선언(' + m.sample + '…)이 다시 보인다');
  }
  chk(!/^const [\w$]+ = deps\.[\w$]+;/m.test(J.slice(J.indexOf('\n', app.length - 200))), '되살린 모듈 글에 deps 받는 줄이 없다');
  chk(joinRenderer(undefined) === undefined, 'app.js 가 없으면 건드리지 않는다');
  console.log(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
}
