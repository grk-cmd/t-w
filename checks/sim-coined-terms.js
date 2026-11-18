/* sim-coined-terms.js — 주석 · 문서에 지어낸 용어(CLAUDE.md «업계 표준 기술 용어» 나쁜 예)가 새로 늘지 않는가
   실행:  node checks/run.js sim-coined-terms
          node checks/sim-coined-terms.js --write-baseline   (저장소 루트에서 — 고쳐서 줄었거나, 까닭이 있어 늘 때)
   ★ 왜 — 번역체 · 새로 지은 비유는 읽는 사람이 무엇을 가리키는지 못 알아듣는다. 리뷰 교훈 «지어낸 용어 · 번역체» 가운데
     뜻이 하나뿐이라 기계로 가를 수 있는 낱말만 여기서 막는다(길 · 칸 · 줄 · 걷기처럼 일상 뜻이 있는 낱말은 사람이 본다).
   ・1절: git 추적 파일의 주석(JS · TS — typescript 파서로 주석만 · Python · YAML · 셸 — # 뒤)과 Markdown 전체에서 낱말을 세어
          기준선(checks/coined-terms-baseline.json · «파일 × 낱말» 개수)과 견준다 — 늘면 빨강 · 줄었으면 기준선을 내리라고 빨강.
   ・2절: mutation test — 주석의 낱말은 세고 · 문자열 · 코드 이름은 안 센다 · 기준선보다 하나 늘면 빨강 · 하나 줄면 빨강.
   ⚠️ 코드의 문자열(검사 출력 문구 등)은 세지 않는다 — 주석 · 문서만. */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };

/* [낱말, 찾는 식, 대신 쓸 말] — CLAUDE.md «업계 표준 기술 용어» 의 나쁜 예 가운데 뜻이 하나뿐인 것 */
const TERMS = [
  ['씨앗', /씨앗/g, 'restore snapshot(파일로 저장되는 스냅샷)'],
  ['깨 보기', /깨 ?(보기|봄|본|봤|보고|보면|보니|보자|봐)/g, 'mutation test / break test'],
  ['톱니', /톱니/g, 'ratchet'],
  ['빚', /빚(?!어|은|는다|다|고)/g, 'tech debt'],
];
const SELF = ['checks/sim-coined-terms.js', 'checks/coined-terms-baseline.json'];
const SKIP_DIR = /(^|\/)(node_modules|vendor|dist|build)\//;
const MAX_BYTES = 4 * 1024 * 1024;

const nodePaths = (process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean);
const ROOT = [process.cwd(), path.resolve(__dirname, '..'), ...nodePaths.map((p) => path.dirname(p))]
  .find((d) => fs.existsSync(path.join(d, '.git')) && fs.existsSync(path.join(d, 'checks', 'CHECKS.md')));
if(!ROOT){ say('  ? 원본 못 찾음 — git 저장소(checks/CHECKS.md 가 있는 곳)'); process.exit(2); }
let ts = null;
for(const from of [ROOT, __dirname, process.cwd(), ...nodePaths]){
  try { ts = require(require.resolve('typescript', { paths: [from] })); break; } catch (_) { /* 다음 자리 */ }
}
if(!ts){
  if(process.env.CI){ say('  ✗ typescript 를 못 찾음 — checks.yml 의 설치 줄을 확인'); process.exit(1); }
  say("  ? 원본 못 찾음 — Cannot find module 'typescript' (저장소 루트에서 npm install)"); process.exit(2);
}
const BASELINE = path.join(ROOT, 'checks', 'coined-terms-baseline.json');

/** JS · TS 주석 글 — 구문 트리의 모든 토큰 앞뒤 주석을 모은다(문자열 · 정규식 안의 // 는 주석이 아니다) */
function jsComments(file, text){
  const kind = /\.tsx$/.test(file) ? ts.ScriptKind.TSX : /\.ts$/.test(file) ? ts.ScriptKind.TS : /\.jsx$/.test(file) ? ts.ScriptKind.JSX : ts.ScriptKind.JS;
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const seen = new Set();
  const out = [];
  const add = (ranges) => { for(const r of ranges || []) if(!seen.has(r.pos)){ seen.add(r.pos); out.push(text.slice(r.pos, r.end)); } };
  const visit = (node) => {
    add(ts.getLeadingCommentRanges(text, node.getFullStart()));
    add(ts.getTrailingCommentRanges(text, node.getEnd()));
    for(const c of node.getChildren(sf)) visit(c);
  };
  visit(sf);
  return out.join('\n');
}
/** 셋 중 하나로 «사람이 읽는 글» 만 꺼낸다 — 다루지 않는 파일은 null */
function proseOf(file, text){
  if(/\.(m|c)?[jt]sx?$/.test(file)) return jsComments(file, text);
  if(/\.md$/.test(file)) return text;
  if(/\.(py|ya?ml|sh)$/.test(file)) return text.split('\n').map((l) => { const m = /(^|\s)#(.*)$/.exec(l); return m ? m[2] : ''; }).join('\n');
  return null;
}
function countText(text){
  const c = {};
  for(const [name, re] of TERMS){ const n = (text.match(re) || []).length; if(n) c[name] = n; }
  return c;
}
function scanRepo(root){
  const r = spawnSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if(r.status !== 0) return null;
  const counts = {};
  let read = 0;
  for(const f of r.stdout.split('\0').filter(Boolean)){
    if(SELF.includes(f) || SKIP_DIR.test(f)) continue;
    const abs = path.join(root, f);
    let st; try { st = fs.statSync(abs); } catch (_) { continue; }
    if(!st.isFile() || st.size > MAX_BYTES) continue;
    const prose = proseOf(f, fs.readFileSync(abs, 'utf8'));
    if(prose === null) continue;
    read++;
    const c = countText(prose);
    if(Object.keys(c).length) counts[f] = c;
  }
  return { read, counts };
}
/** 기준선과 견줌 → { more: [...], fewer: [...] } */
function compare(counts, base){
  const more = [], fewer = [];
  const files = new Set([...Object.keys(counts), ...Object.keys(base)]);
  for(const f of files){
    const a = counts[f] || {}, b = base[f] || {};
    for(const name of new Set([...Object.keys(a), ...Object.keys(b)])){
      const now = a[name] || 0, was = b[name] || 0;
      if(now > was) more.push({ f, name, now, was });
      if(now < was) fewer.push({ f, name, now, was });
    }
  }
  return { more, fewer };
}
const sorted = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));

const res = scanRepo(ROOT);
if(process.argv.includes('--write-baseline')){
  if(!res){ say('  ✗ git ls-files 실패'); process.exit(1); }
  fs.writeFileSync(BASELINE, JSON.stringify(sorted(res.counts), null, 2) + '\n');
  say(`기준선을 썼다 — ${Object.keys(res.counts).length}개 파일 · ${path.relative(ROOT, BASELINE)}`);
  process.exit(0);
}

say('1절 — 저장소 주석 · 문서');
chk(!!res && res.read > 100, '추적 파일을 읽었다' + (res ? ` — ${res.read}개` : ' — git ls-files 실패'));
let base = null;
try { base = JSON.parse(fs.readFileSync(BASELINE, 'utf8')); } catch (_) { /* 아래에서 빨강 */ }
chk(!!base, '기준선을 읽었다 — checks/coined-terms-baseline.json');
if(res && base){
  const { more, fewer } = compare(res.counts, base);
  const hint = (name) => (TERMS.find((t) => t[0] === name) || [])[2];
  for(const m of more.slice(0, 20)) say(`      ${m.f} «${m.name}» ${m.was} → ${m.now} — 대신 ${hint(m.name)}`);
  chk(more.length === 0, '기준선보다 는 곳 0' + (more.length ? ` — ${more.length}곳(표준 용어로 바꿀 것 · 코드 이름 · 인용이라 꼭 필요하면 PR «왜» 에 적고 --write-baseline)` : ''));
  for(const m of fewer.slice(0, 10)) say(`      ${m.f} «${m.name}» ${m.was} → ${m.now}`);
  chk(fewer.length === 0, '기준선에 낡은 줄 없음' + (fewer.length ? ` — ${fewer.length}곳 줄었다. node checks/sim-coined-terms.js --write-baseline 로 내릴 것` : ''));
  const gone = Object.keys(base).filter((f) => !fs.existsSync(path.join(ROOT, f)));
  chk(gone.length === 0, '기준선이 가리키는 파일이 다 있다' + (gone.length ? ' — ' + gone.join(' · ') : ''));
}

say('2절 — mutation test');
const cases = [
  ['a.js', '// 정렬 ' + '씨앗' + ' 파일\nconst x = 1;', { '씨앗': 1 }],
  ['a.js', "/* 기준선 " + '톱니' + " */ chk(ok, '깨 ' + '봄'); const s = '" + '씨앗' + "';", { '톱니': 1 }],
  ['a.ts', 'const r = /깨 ?봄/; // 이 줄은 ' + '깨 보기' + '\nfunction f(){ /* ' + '빚' + ' 갚기 */ }', { '깨 보기': 1, '빚': 1 }],
  ['a.tsx', 'export const A = () => <div>{/* ' + '씨앗' + ' */}</div>;', { '씨앗': 1 }],
  ['a.py', "x = '" + '씨앗' + "'  # " + '톱니' + ' 기준선', { '톱니': 1 }],
  ['a.md', '# 안내\n' + '깨 보기' + '(mutation test) · 그릇을 빚어 만든다', { '깨 보기': 1 }],
  ['a.js', '// 코드 이름 restoreSnapshot · ratchet · mutation test 는 괜찮다', {}],
];
for(const [file, text, want] of cases){
  const got = countText(proseOf(file, text));
  chk(JSON.stringify(sorted(got)) === JSON.stringify(sorted(want)), `${file} · ${text.slice(0, 36).replace(/\n/g, ' ')} → ${JSON.stringify(want)}` + (JSON.stringify(sorted(got)) === JSON.stringify(sorted(want)) ? '' : ' — 실제 ' + JSON.stringify(got)));
}
const b0 = { 'x.js': { '톱니': 1 } };
const up = compare({ 'x.js': { '톱니': 2 } }, b0);
chk(up.more.length === 1 && up.fewer.length === 0, '기준선보다 하나 늘면 빨강');
const other = compare({ 'x.js': { '씨앗': 1 } }, b0);
chk(other.more.length === 1 && other.fewer.length === 1, '하나 지우고 다른 낱말을 넣어도 빨강(낱말마다 센다)');
const down = compare({}, b0);
chk(down.more.length === 0 && down.fewer.length === 1, '줄면 낡은 줄로 빨강(기준선을 내리라고)');

say(`통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
