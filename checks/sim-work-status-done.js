/* sim-work-status-done.js — 📋 현황판 «작업완료» 바꾸기(scripts/work-status-done.js · 워크플로 work-status-done.yml)
   실행:  node sim-work-status-done.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — 머지마다 Actions 가 main 의 현황판을 고쳐 커밋한다. 엉뚱한 줄 · 다른 표를 고치면
     사람이 적은 «작업중» 줄이 조용히 사라지거나 바뀐다.
   ・1절: 판 이름 · 한국 날짜
   ・2절: 표 바꾸기 — 맞는 줄 · 없는 줄 · 두 줄 중 하나 · 다른 표의 같은 브랜치 · main base · 빈 표 · 칸 수 다름 · 백틱
   ・3절: 일부러 깨 보기
   워크플로(.github/)는 스테이징에 없어 여기서 보지 않는다 — 판단은 전부 이 스크립트에 두고 워크플로는 부르기만 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, path.join(__dirname, f), path.join(__dirname, '..', f)]) { try { return fs.readFileSync(c, 'utf8'); } catch (_) {} } return null; };
const SRC = read('scripts/work-status-done.js');
if (!SRC) { say('  ? 원본 못 찾음 — scripts/work-status-done.js'); process.exit(2); }

function load(src) { const module = { exports: {} }; new Function('module', 'exports', 'require', src.replace(/^#!.*\n/, ''))(module, module.exports, require); return module.exports; }

const BOARD = [
  '# 현황판', '',
  '## 진행 중 — 검토중 · 작업중 · 작업완료',
  '| 상태 | 묶음 | 담당 | 판 | 브랜치 | 내용 | 건드리는 파일 | PR |',
  '|---|---|---|---|---|---|---|---|',
  '| 작업중 | 하네스 | 갑 | main | harness/a | 일 하나 | x.js | |',
  '| 검토중 | 앱 | 을 | 0.12.0 | `feat/b` | 일 둘 | y.js | #9 |',
  '| 작업중 | 앱 | 병 | 0.12.0 | feat/c | 칸 안에 | 막대 | z.js | |',
  '',
  '## 대기',
  '| 상태 | 묶음 | 담당 | 판 | 브랜치 | 내용 | 건드리는 파일 | PR |',
  '|---|---|---|---|---|---|---|---|',
  '| 작업중 | 앱 | 정 | main | harness/a | 다른 표 | w.js | |',
  '',
].join('\n');
const EMPTY = BOARD.replace(/\| 작업중 \| 하네스[^\n]*\n\| 검토중[^\n]*\n\| 작업중 \| 앱 \| 병[^\n]*\n/, '');
const IN = { head: 'harness/a', base: 'release/0.12.0', pr: '401', date: '2026-10-19' };

/* 구현 하나를 받아 판정 표를 돌려준다 — 3절에서 깨진 구현에도 같은 판정을 돌린다 */
function judge(M) {
  const r = {};
  try {
    const a = M.markDone(BOARD, IN);
    const L = a.text.split('\n'), B = BOARD.split('\n');
    r.hit = a.hits === 1 && L[5] === '| 작업완료(0.12.0) | 하네스 | 갑 | main | harness/a | 일 하나 | x.js | #401 · 2026-10-19 |';
    r.onlyThat = L.length === B.length && L.every((l, i) => i === 5 || l === B[i]);
    r.otherTable = L[12] === B[12];
    const b = M.markDone(BOARD, { ...IN, head: 'feat/b', base: 'main' });
    r.backtickMain = b.hits === 1 && b.text.split('\n')[6] === '| 작업완료(main) | 앱 | 을 | 0.12.0 | `feat/b` | 일 둘 | y.js | #401 · 2026-10-19 |';
    const n = M.markDone(BOARD, { ...IN, head: 'feat/zzz' });
    r.none = n.hits === 0 && n.text === BOARD && /없음/.test(n.reason);
    const c = M.markDone(BOARD, { ...IN, head: 'feat/c' });
    r.badCells = c.hits === 0 && c.text === BOARD;
    const e = M.markDone(EMPTY, IN);
    r.empty = e.hits === 0 && e.text === EMPTY;
    const p = M.markDone(BOARD, { ...IN, head: 'harness' });
    r.exact = p.hits === 0;
    const z = M.markDone(BOARD, { ...IN, pr: '' });
    r.missing = z.hits === 0 && z.text === BOARD;
    r.board = M.boardOf('release/0.12.0') === '0.12.0' && M.boardOf('main') === 'main' && M.boardOf('hotfix/x') === 'hotfix/x';
    r.kst = M.kstDate(new Date('2026-10-19T15:30:00Z')) === '2026-10-20' && M.kstDate(new Date('2026-10-19T14:59:00Z')) === '2026-10-19';
  } catch (e) { r.err = String(e && e.message || e); }
  return r;
}
const bad = (r) => !!r.err || Object.values(r).some(v => v === false);

const R = judge(load(SRC));
say('── 1. 판 이름 · 날짜');
chk(R.board, 'release/X.Y.Z → X.Y.Z · main · hotfix 는 그대로' + (R.err ? ' — ' + R.err : ''));
chk(R.kst, '날짜는 한국 시각(UTC 15시 = 다음 날)');

say('── 2. 표 바꾸기');
chk(R.hit, '브랜치 칸이 맞는 줄 — 상태 «작업완료(판)» · PR «#번호 · 날짜»');
chk(R.onlyThat, '두 줄 중 그 줄만 바뀌고 나머지 글은 그대로(줄 수도 같다)');
chk(R.otherTable, '다른 표(대기)의 같은 브랜치 줄은 안 바꾼다');
chk(R.backtickMain, '백틱 친 브랜치 칸도 맞고 · main base 는 «작업완료(main)»');
chk(R.none, '맞는 줄이 없으면 글 그대로 · «없음» 까닭');
chk(R.badCells, '칸 수가 머리와 다른 줄(칸 안 `|`)은 건드리지 않는다');
chk(R.empty, '빈 표면 아무것도 안 바꾼다');
chk(R.exact, '브랜치 이름 앞부분만 같아서는 안 맞는다');
chk(R.missing, '입력(PR 번호 등)이 빠지면 안 바꾼다');

say('── 3. 깨 보기');
const MUT = [
  ['칸 수 확인 빼기', /if\(c\.length !== head0\.length\) continue;/, ''],
  ['절 경계 무시(다른 표까지)', /if\(!c\) break;/, 'if(!c) continue;'],
  ['백틱 안 벗기기', /bare\(c\[ix\.branch\]\)/, 'c[ix.branch]'],
  ['판 이름 그대로', /return m \? m\[1\] : base;/, 'return base;'],
  ['UTC 날짜', /now\.getTime\(\) \+ 9 \* 3600 \* 1000/, 'now.getTime()'],
  ['앞부분만 같아도 맞음', /bare\(c\[ix\.branch\]\) !== head/, '!bare(c[ix.branch]).startsWith(head)'],
];
for (const [name, re, to] of MUT) {
  if (!re.test(SRC)) { chk(false, `깨 보기 자리를 못 찾음 — ${name}`); continue; }
  let r; try { r = judge(load(SRC.replace(re, to))); } catch (e) { r = { err: String(e) }; }
  chk(bad(r), `${name} → 빨강`);
}

say(`\n  결과: 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
