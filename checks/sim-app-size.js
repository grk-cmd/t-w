/* ═══ 📏 sim-app-size.js — app.js · firebase-init.js 가 더 커지지 않는가 (앱 FSD 1단계) ═══════════════
   [왜] 새 로직은 app/parts/<도메인>.js 모듈로 만든다(CLAUDE.md 구조 표 · 코드 컨벤션). 그런데 app.js(렌더러 본체)와
     firebase-init.js(연결)에 덧붙이는 게 늘 제일 쉬워서 두 파일이 계속 자랐다. 옮기는 일은 한 번에 못 하니
     «지금 크기» 를 기준선(app-size-baseline.json)으로 두고 **늘어나는 것만** 막는다. 지도: docs/APP_FSD_MAP.md
   ・1절: 파일 줄 수가 상한(cap) 이하. 상한 = 기준선을 쓸 때의 줄 수 + 여유(headroom · 급한 고침용).
   ・2절: 구역 머리(`/* ═══ 제목` · `/* ══ 제목` · `/* ==== 제목` · firebase-init 은 들여쓴 것까지)가 기준선 목록에 있는 것뿐.
     새 구역 = 새 기능을 이 파일에 쌓는 신호라 막는다. 구역이 빠진 것(모듈로 옮김)은 알리기만 한다.
   ・3절: 톱니(ratchet) — 줄 수가 상한보다 headroom + ratchet 넘게 작아졌으면 상한을 같은 PR 에서 내린다(빨강).
     옮겨 낸 만큼 상한도 따라 내려가야 다음 사람이 그 자리를 다시 채우지 않는다.
   ・4절: 판정 함수 자체 — 상한 넘음 · 새 구역 · 톱니가 빨강이 되는지 가짜 글로 돌려 본다.
   [기준선 다시 쓰기] 저장소 루트에서 `node checks/sim-app-size.js --write-baseline`
     — 상한은 내려가기만 한다(올리려면 --allow-increase) · 새 구역 머리를 넣으려면 --allow-new-section.
     둘 다 «정말 이 파일이어야 하는가» 를 PR 본문에 적고 쓴다.
   [실행] 러너 스테이징(평평한 폴더 + parts/) 또는 저장소 루트에서. */
'use strict';
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };

const DIRS = ['.', 'parts', 'app', path.join('app', 'parts')];
const find = (f) => { for(const d of DIRS){ const p = path.join(d, f); if(fs.existsSync(p)) return p; } return null; };
const BASE_FILE = path.join(__dirname, 'app-size-baseline.json');
const RULE = '새 로직은 app/parts/<도메인>.js 모듈로 (CLAUDE.md 구조 표)';

/* 파일마다 — indent: 구역 머리로 보는 들여쓰기 칸 수(firebase-init 은 전부 init 함수 안이라 4칸까지)
   headroom: 상한을 쓸 때 얹는 여유 · ratchet: 상한보다 이만큼 더 줄면 상한을 내리라고 빨강 */
const FILES = {
  'app.js': { indent: 0, headroom: 200, ratchet: 500 },
  'firebase-init.js': { indent: 4, headroom: 100, ratchet: 200 },
};

const lineCount = (src) => (src.match(/\n/g) || []).length + (src && !src.endsWith('\n') ? 1 : 0);  // wc -l 과 같게
function sectionsOf(src, indent){
  const head = new RegExp('^ {0,' + indent + '}(?:/\\*|//)\\s*(?:═{2,}|={3,})');
  const clean = (s) => s.replace(/\/\*|\*\/|\/\/|[═=]{2,}/g, ' ').replace(/\s+/g, ' ').trim();
  const lines = src.split('\n'), out = [];
  lines.forEach((l, i) => { if(head.test(l)) out.push(clean(l) || clean(lines[i + 1] || '')); });
  return out;
}
/* 판정 — 4절이 가짜 글로 같은 함수를 돌린다 */
function judge(src, spec, base){
  const lines = lineCount(src), secs = sectionsOf(src, spec.indent);
  const known = new Set(base.sections);
  return {
    lines, secs,
    over: lines > base.cap,
    added: secs.filter(t => !known.has(t)),
    removed: base.sections.filter(t => !secs.includes(t)),
    slack: base.cap - lines,
    stale: base.cap - lines > spec.headroom + spec.ratchet,
  };
}

const now = {};
for(const name of Object.keys(FILES)){
  const p = find(name);
  if(!p){ say('  ? 원본 없음 — ' + name); process.exit(2); }
  now[name] = fs.readFileSync(p, 'utf8');
}

if(process.argv.includes('--write-baseline')){
  let old = {};
  try{ old = JSON.parse(fs.readFileSync(BASE_FILE, 'utf8')).files || {}; }catch(_){}
  const out = {}, bad = [];
  for(const [name, spec] of Object.entries(FILES)){
    const lines = lineCount(now[name]), secs = sectionsOf(now[name], spec.indent);
    const prev = old[name];
    const cap = lines + spec.headroom;
    if(prev && cap > prev.cap && !process.argv.includes('--allow-increase')) bad.push(name + ' 상한 ' + prev.cap + ' → ' + cap + ' (올리려면 --allow-increase)');
    const added = prev ? secs.filter(t => !prev.sections.includes(t)) : [];
    if(added.length && !process.argv.includes('--allow-new-section')) bad.push(name + ' 새 구역 ' + added.map(t => '«' + t + '»').join(' · ') + ' (넣으려면 --allow-new-section)');
    out[name] = { cap: prev && cap > prev.cap && !process.argv.includes('--allow-increase') ? prev.cap : cap, lines, sections: secs };
  }
  if(bad.length){ say('  ✗ 기준선을 안 썼다 — ' + RULE + '\n    ' + bad.join('\n    ')); process.exit(1); }
  fs.writeFileSync(BASE_FILE, JSON.stringify({
    note: 'sim-app-size.js 기준선 — 상한(cap)은 내려가기만 한다. 코드를 모듈로 옮겨 줄었으면 같은 PR 에서 --write-baseline 으로 내린다. 지도: docs/APP_FSD_MAP.md',
    files: out,
  }, null, 2) + '\n');
  say('  ✓ 기준선을 썼다 — ' + BASE_FILE);
  for(const [n, v] of Object.entries(out)) say('    ' + n + ' ' + v.lines + '줄 · 상한 ' + v.cap + ' · 구역 ' + v.sections.length + '개');
  process.exit(0);
}

let base = null;
try{ base = JSON.parse(fs.readFileSync(BASE_FILE, 'utf8')).files; }catch(e){ chk(false, '기준선 파일을 못 읽었다 — ' + BASE_FILE); }

if(base){
  for(const [name, spec] of Object.entries(FILES)){
    const b = base[name];
    if(!b){ chk(false, name + ' — 기준선에 없다'); continue; }
    const r = judge(now[name], spec, b);
    say('── ' + name + ' (' + r.lines + '줄 · 상한 ' + b.cap + ' · 구역 ' + r.secs.length + '개)');
    chk(!r.over, '1. 줄 수가 상한 이하' + (r.over ? '\n    ' + name + ' 가 상한(' + b.cap + '줄)을 넘었어요 — ' + RULE : ''));
    chk(r.added.length === 0, '2. 새 구역 머리 없음' + (r.added.length
      ? '\n    ' + name + ' 에 새 구역이 생겼어요: ' + r.added.map(t => '«' + t + '»').join(' · ') + '\n    ' + RULE
        + '\n    (이름만 바꿨으면 --write-baseline --allow-new-section)' : ''));
    if(r.removed.length) say('    ↓ 빠진 구역 ' + r.removed.length + '개 — 모듈로 옮겼으면 기준선을 다시 써 둘 것(--write-baseline): ' + r.removed.slice(0, 3).map(t => '«' + t + '»').join(' · '));
    chk(!r.stale, '3. 상한이 지금 크기에 붙어 있다(여유 ' + r.slack + '줄 ≤ ' + (spec.headroom + spec.ratchet) + ')'
      + (r.stale ? '\n    ' + name + ' 가 ' + (r.slack - spec.headroom) + '줄 줄었어요 — 같은 PR 에서 상한을 내려 주세요: node checks/sim-app-size.js --write-baseline' : ''));
  }
}

say('── 4. 판정 자체 (가짜 글)');
{
  const spec = { indent: 0, headroom: 2, ratchet: 3 };
  const src = '/* ═══ 가 ═══ */\nx();\n/* ═══════\n   나\n   ═══════ */\ny();\n';
  const b = { cap: 8, sections: ['가', '나'] };
  const ok = judge(src, spec, b);
  chk(ok.lines === 6 && !ok.over && !ok.added.length && !ok.stale && ok.secs.join() === '가,나', '그대로면 통과 · 테두리만 있는 머리는 다음 줄이 제목');
  chk(judge(src + 'z();\nw();\nv();\n', spec, b).over, '상한을 넘으면 빨강');
  chk(judge(src + '/* ═══ 다 ═══ */\n', spec, b).added.join() === '다', '새 구역 머리는 빨강');
  chk(judge('  /* ═══ 안쪽 ═══ */\n' + src, spec, b).added.length === 0, '들여쓴 머리는 indent 밖이면 구역이 아니다');
  chk(judge('/* ═══ 가 ═══ */\n', spec, b).removed.join() === '나', '빠진 구역은 알리기만');
  chk(judge('/* ═══ 가 ═══ */\n', spec, { cap: 20, sections: ['가'] }).stale, '상한보다 headroom + ratchet 넘게 줄면 빨강(톱니)');
}

say(`\n통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
