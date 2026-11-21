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

say('── 3. run.js 가 겹침을 빨강으로 센다');
{
  const run = fs.readFileSync(path.join(__dirname, 'run.js'), 'utf8');
  chk(/require\('\.\/manifest\.js'\)\.parseManifest/.test(run), 'run.js 가 manifest.js 로 표를 읽는다(읽기 규칙 한 벌)');
  chk(/for \(const name of read\.dupes\)\{ bad\+\+/.test(run), 'run.js 가 dupes 마다 bad 를 올린다(종료 코드 1)');
  chk(/NOT_CHECKS = new Set\(\[[^\]]*'manifest\.js'/.test(run), 'manifest.js 는 검사 목록에서 빠진다');
}

say('── 4. mutation test');
{
  const noDup = ORIG.replace('if (map.has(name)) dupes.push(name);', '');
  chk(noDup !== ORIG && load(noDup)(T([A_OLD, A])).dupes.length === 0, '겹침 알림을 지우면 위 2절이 빨강(옛 줄을 못 잡음)');
  const firstWins = ORIG.replace('map.set(name, hash);', 'if (!map.has(name)) map.set(name, hash);');
  chk(firstWins !== ORIG && load(firstWins)(T([A_OLD, A])).map.get('sim-a.js') === '000000000000', '앞 줄을 남기게 바꾸면 대조 값이 옛 해시가 된다(2절이 잡음)');
}

say(`\n${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
