/* sim-checks-manifest.js — CHECKS.md §3 표 읽기(manifest.js)가 같은 이름이 두 번 나온 줄을 알려 주는가.
   뒤 줄이 앞 줄을 조용히 덮으면 옛 해시 줄이 남아도 아무도 모른다(#1061 에서 지운 sim-room-parity.js 옛 줄). */
'use strict';
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };

const SRC = path.join(__dirname, 'manifest.js');
if(!fs.existsSync(SRC)){ say('  ? 원본 못 찾음 — manifest.js'); process.exit(2); }

function load(text){
  const m = { exports: {} };
  new Function('module', 'exports', 'require', text)(m, m.exports, require);
  return m.exports.parseManifest;
}
const ORIG = fs.readFileSync(SRC, 'utf8');
const parse = load(ORIG);

const T = (rows) => ['| 이름 | 줄 | 해시 |', '|---|---|---|', ...rows].join('\n');
const A = '| **sim-a.js** | 10 | **aaaaaaaaaaaa** |';
const B = '| **sim-b.js** | 20 | **bbbbbbbbbbbb** |';
const A_OLD = '| **sim-a.js** | 9 | **000000000000** ';

say('── 1. 표 읽기');
{
  const r = parse(T([A, B]));
  chk(r.map.get('sim-a.js') === 'aaaaaaaaaaaa' && r.map.get('sim-b.js') === 'bbbbbbbbbbbb', '이름 → 해시 · 굵게 표시를 벗김');
  chk(r.dupes.length === 0, '겹친 이름 없으면 dupes 비었음');
  chk(parse('').map.size === 0 && parse('').dupes.length === 0, '빈 글 → 빈 표');
  chk(parse(T(['| 설명 | 아무거나 | 없음 |'])).map.size === 0, '.js · .py 가 아닌 줄 · 해시 없는 줄은 건너뜀');
}

say('── 2. 같은 이름 두 번');
{
  const r = parse(T([A_OLD, B, A]));
  chk(r.dupes.length === 1 && r.dupes[0] === 'sim-a.js', '옛 줄이 남으면 dupes 에 그 이름(꼬리 | 가 없는 줄도)');
  chk(r.map.get('sim-a.js') === 'aaaaaaaaaaaa', '대조 값은 뒤 줄(지금 run.js 와 같음)');
  chk(parse(T([A, A, A])).dupes.length === 2, '세 번이면 두 번 알림');
}

say('── 3. run.js 를 임시 폴더에서 실제로 돌린다(--list · 정본 대조)');
const os = require('os');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const RUN_SRC = fs.readFileSync(path.join(__dirname, 'run.js'), 'utf8');
const SIM_X = "console.log('  ✓ x'); console.log('1 통과 · 0 실패');\n";
const sha12 = (t) => crypto.createHash('sha256').update(t).digest('hex').slice(0, 12);
const ROW_X = `| **sim-x.js** | 2 | **${sha12(SIM_X)}** |`;
const ROW_X_OLD = '| **sim-x.js** | 1 | **000000000000** ';
function runList(rows, runSrc = RUN_SRC){
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-manifest-'));
  const dir = path.join(root, 'checks');
  try {
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'run.js'), runSrc);
    fs.writeFileSync(path.join(dir, 'manifest.js'), ORIG);
    fs.writeFileSync(path.join(dir, 'sim-x.js'), SIM_X);
    fs.writeFileSync(path.join(dir, 'CHECKS.md'), T(rows) + '\n');
    const r = spawnSync(process.execPath, [path.join(dir, 'run.js'), '--list'], { cwd: root, encoding: 'utf8', timeout: 60000 });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
const notListed = (o) => !/manifest\.js/.test(o) && /검사 1개/.test(o);
{
  const clean = runList([ROW_X]);
  chk(clean.code === 0, '깨끗한 표 → 종료 코드 0');
  chk(notListed(clean.out), '출력 어디에도 manifest.js 가 없고 검사는 sim-x.js 하나(목록에 들면 «표에 없다» 줄도 찍힌다)');
  const dup = runList([ROW_X_OLD, ROW_X]);
  chk(dup.code === 1 && /sim-x\.js — 표에 두 번 있다/.test(dup.out), '같은 이름 옛 줄(꼬리 | 없음) → «표에 두 번 있다» · 종료 코드 1');
}

say('── 4. mutation test');
{
  const noDup = ORIG.replace('if (map.has(name)) dupes.push(name);', '');
  chk(noDup !== ORIG && load(noDup)(T([A_OLD, A])).dupes.length === 0, '겹침 알림을 지우면 위 2절이 빨강(옛 줄을 못 잡음)');
  const firstWins = ORIG.replace('map.set(name, hash);', 'if (!map.has(name)) map.set(name, hash);');
  chk(firstWins !== ORIG && load(firstWins)(T([A_OLD, A])).map.get('sim-a.js') === '000000000000', '앞 줄을 남기게 바꾸면 대조 값이 옛 해시가 된다(2절이 잡음)');
  const RUN_DUP = 'for (const name of read.dupes){ bad++;';
  const noBad = RUN_SRC.includes(RUN_DUP) ? RUN_SRC.replace(RUN_DUP, 'for (const name of read.dupes){') : null;
  const NOT = "new Set(['run.js', 'manifest.js'])";
  const listed = RUN_SRC.includes(NOT) ? RUN_SRC.replace(NOT, "new Set(['run.js'])") : null;
  chk(listed !== null && !notListed(runList([ROW_X], listed).out), 'run.js 사본의 NOT_CHECKS 에서 manifest.js 를 빼면 3절 «목록에 없음» 판정이 빨강' + (listed ? '' : ' — 바꿀 글을 못 찾음'));
  chk(noBad !== null && runList([ROW_X_OLD, ROW_X], noBad).code === 0, 'run.js 사본에서 겹침의 bad++ 를 지우면 3절 판정(종료 코드 1)이 빨강' + (noBad ? '' : ' — 바꿀 글을 못 찾음'));
}

say(`\n${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
