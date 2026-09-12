#!/usr/bin/env node
/* ═══ 🧪 checks/run.js — 검사 러너 (스테이징 방식) ══════════════════════════════
   [왜 이게 있는가 — CHECKS.md §2 · §5]
     검사 53개가 원본을 찾는 방식이 두 갈래다.
       · `fs.readFileSync('app.js')`        → cwd 상대 (44개)
       · `path.join(__dirname, 'main.js')`  → 파일 위치 상대 (10개)
     그리고 둘 다 **평평한 폴더**를 가정한다. 저장소는 `main.js` 가 루트, 렌더러가 `app/`
     아래라 어느 쪽도 그대로는 안 맞는다.

   ⇒ 검사를 고치는 대신 **폴더를 만들어 준다.** 임시 폴더에 원본과 검사를 한 층으로 모아
     거기서 돌린다. cwd 와 __dirname 이 같은 곳을 가리키므로 두 갈래가 동시에 만족된다.

   ★ **검사 파일은 한 글자도 안 고친다.** 그게 이 방식을 고른 이유다 — 53개를 고치는 순간
     "받은 판이 진짜인가" 가 한 번 더 생기고, `CHECKS.md` 가 막으려는 것이 바로 그거다.

   ⚠️ 스테이징은 **저장소 밖**(OS 임시 폴더)에 만든다. 저장소 안에 두면 `.gitignore` ·
     `build.files` · 검사 자신의 파일 열거에 전부 끼어든다. 남겨 보려면 `--keep`.

   ⚠️ 원본 목록을 여기에 박아 두지 않는다. 루트와 `app/` 를 **있는 대로 펼친다.**
     박아 두면 원본이 하나 늘 때마다 이 파일이 조용히 낡는다 — 그게 3-① 의 증상이었다.

   실행:
     node checks/run.js              전부
     node checks/run.js sysinput     이름에 그 말이 든 것만
     node checks/run.js --list       목록과 정본 대조만
     node checks/run.js --hashes     CHECKS.md §3 에 붙일 표를 찍는다
     node checks/run.js --keep       스테이징을 안 지우고 경로를 알려 준다
     node checks/run.js --no-verify  정본 대조 건너뜀

   종료 코드: 0=전부 통과 · 1=실패 있음 · 2=돌리지도 못함(원본 없음·스테이징 실패)
*/
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const CHECKS = __dirname;
const ROOT = path.resolve(__dirname, '..');
const MANIFEST = path.join(CHECKS, 'CHECKS.md');

/* 스테이징에 올리지 않는 것. `checks` 자신은 따로 복사하므로 여기서 뺀다. */
const SKIP = new Set([
  'node_modules', '.git', '.github', 'dist', 'out', 'release',
  'checks', 'build', '디자인', '.vscode', '.idea',
]);

/* 검사들이 실제로 읽는 원본 — 없으면 그 검사가 통째로 헛돈다.
   ⚠️ 이 목록은 **스테이징 대상이 아니라 경고용**이다. 스테이징은 위 주석대로 통째로 펼친다. */
const CORE = [
  'app.js', 'main.js', 'preload.js', 'desk-companion-prototype.html',
  'overlay-win.js', 'sysinput-win.js', 'firebase-database-rules.json',
];

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const OPT = {
  list: flag('--list'), hashes: flag('--hashes'), keep: flag('--keep'),
  verify: !flag('--no-verify'),
};
const filters = args.filter(a => !a.startsWith('--'));

const say = console.log;
const sha12 = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 12);

/* ── 검사 목록 ─────────────────────────────────────────────────────────────
   `run.js` 자신은 검사가 아니다. 빼지 않으면 자기를 돌리다 무한히 들어간다. */
function listChecks(){
  return fs.readdirSync(CHECKS)
    .filter(f => (f.endsWith('.js') || f.endsWith('.py')) && f !== 'run.js')
    .filter(f => !filters.length || filters.some(q => f.includes(q)))
    .sort();
}

/* ── 정본 대조 ─────────────────────────────────────────────────────────────
   CHECKS.md §3 의 표에서 `| 이름 | 줄 | 해시 |` 를 줍는다. 굵게(**이름**) 와 꼬리말
   (★낡음 · ← …) 이 붙어 있어도 이름과 12자리만 본다. */
function readManifest(){
  if (!fs.existsSync(MANIFEST)) return null;
  const m = new Map();
  for (const line of fs.readFileSync(MANIFEST, 'utf8').split('\n')){
    const cell = line.split('|').map(s => s.trim());
    if (cell.length < 4) continue;
    const name = cell[1].replace(/\*\*/g, '').trim();
    const hash = (cell[3].match(/\b([0-9a-f]{12})\b/) || [])[1];
    if (name && hash && /\.(js|py)$/.test(name)) m.set(name, hash);
  }
  return m.size ? m : null;
}

function verify(files){
  const man = readManifest();
  if (!man){
    say('  ? CHECKS.md 를 못 읽었다 — 정본 대조 없이 돈다. 초록이어도 근거로 쓰지 말 것.');
    return { known: 0, bad: 0, missing: files.length };
  }
  let known = 0, bad = 0, missing = 0;
  for (const f of files){
    const want = man.get(f);
    const got = sha12(path.join(CHECKS, f));
    if (!want){ missing++; say(`  ? ${f} — 표에 없다. 정본인지 가려 줄 자리가 없다`); }
    else if (want !== got){ bad++; say(`  ✗ ${f} — 표 ${want} · 실물 ${got} ★ 판이 다르다`); }
    else known++;
  }
  /* 표에는 있는데 폴더에 없는 것도 알려 준다 — 빠진 검사는 조용한 초록이 된다. */
  for (const name of man.keys()){
    if (!files.includes(name) && !filters.length){ missing++; say(`  ? ${name} — 표에는 있는데 폴더에 없다`); }
  }
  if (!bad && !missing) say(`  ✓ ${known}개 전부 정본과 일치`);
  return { known, bad, missing };
}

/* ── 스테이징 ──────────────────────────────────────────────────────────────
   루트를 펼치고, 그다음 `app/` 을 같은 층에 펼친다. 이름이 겹치면 **루트가 이긴다**
   (`main.js` 는 루트 것이 진짜다). 마지막에 검사를 같이 넣어 __dirname 을 맞춘다. */
function mirror(from, into, staged){
  if (!fs.existsSync(from)) return;
  for (const name of fs.readdirSync(from)){
    if (SKIP.has(name) || staged.has(name)) continue;
    const src = path.join(from, name);
    const st = fs.statSync(src);
    if (st.isDirectory() && name === 'app' && from === ROOT) continue;  // 아래에서 내용을 펼친다
    fs.cpSync(src, path.join(into, name), { recursive: true });
    staged.add(name);
  }
}

function stage(){
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-checks-'));
  const staged = new Set();
  mirror(ROOT, dir, staged);
  mirror(path.join(ROOT, 'app'), dir, staged);
  for (const f of fs.readdirSync(CHECKS)){
    if (f === 'run.js') continue;
    fs.cpSync(path.join(CHECKS, f), path.join(dir, f));
  }
  return dir;
}

/* ── 깊은 곳에 있는 원본 끌어올리기 ────────────────────────────────────────
   스테이징은 루트와 `app/` 를 **한 층**만 펼친다. 원본이 `app/` 보다 더 깊이 있으면
   (`app/js/app.js` 같은) 하위 폴더째로 올라가 평면에는 안 보인다 — 검사는 "없다" 고 한다.
   ⚠️ 폴더 구조를 여기서 가정하지 않는다. **없다고 확인된 것만** 찾아서 올린다.
     둘 이상 나오면 고르지 않고 알려만 준다 — 어느 쪽이 진짜인지는 이 파일이 판단할 일이 아니다. */
function findDeep(dir, name, out, depth){
  if (depth > 6) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })){
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) findDeep(p, name, out, depth + 1);
    else if (e.name === name) out.push(p);
  }
  return out;
}

function hoist(dir){
  const still = [], notes = [];
  for (const name of CORE){
    if (fs.existsSync(path.join(dir, name))) continue;
    let hits = [];
    try { hits = findDeep(ROOT, name, [], 0); } catch (_){}
    if (hits.length === 1){
      fs.cpSync(hits[0], path.join(dir, name));
      notes.push(`  ✓ ${name} — ${path.relative(ROOT, hits[0])} 에서 끌어올림`);
    } else if (hits.length > 1){
      still.push(name);
      notes.push(`  ? ${name} — ${hits.length}곳에 있다. 어느 것인지 정해 줄 것: `
        + hits.map(h => path.relative(ROOT, h)).join(' · '));
    } else {
      still.push(name);
    }
  }
  return { still, notes };
}

/* ── 한 개 돌리기 ──────────────────────────────────────────────────────────
   ⚠️ 종료 코드만 보면 안 된다. 검사들은 0=통과 · 1=실패 · 2=검사못함 을 쓰는데,
     "원본을 못 찾음" 도 그 코드로 나온다. 출력을 같이 읽어야 그 둘이 갈린다. */
function runOne(file, cwd){
  const py = file.endsWith('.py');
  /* ⚠️ Windows 에서 python 의 stdout 기본 인코딩이 cp949 라 한글이 깨져서 온다. 깨지면
     "원본이 없다" 는 제 말(아래 blocked 판정)이 안 읽혀서 **가짜 빨강**이 된다. 강제한다. */
  const env = py ? Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }) : process.env;
  const tries = py ? [['python3', [file]], ['python', [file]]] : [[process.execPath, [file]]];
  let r = null;
  for (const [cmd, a] of tries){
    r = spawnSync(cmd, a, { cwd, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (!r.error) break;
  }
  if (r && r.error) return { file, skipped: true, note: py ? 'python 없음' : String(r.error.message) };
  const out = (r.stdout || '') + (r.stderr || '');
  const sum = [...out.matchAll(/통과\s*(\d+)\s*·\s*실패\s*(\d+)(?:\s*·\s*검사못함\s*(\d+))?/g)].pop();
  /* 요약 줄 대신 "전부 통과 ✅" 하나로 끝내는 검사가 있다(sim-town-32 · sim-village-addr 등).
     종료코드만 보면 ✓ 는 맞지만 몇 개를 봤는지가 안 남아서, 조용한 초록과 구분이 안 된다. */
  const allPass = !sum && r.status === 0 && /전부 통과/.test(out);
  return {
    file, code: r.status, out, allPass,
    pass: sum ? +sum[1] : null, fail: sum ? +sum[2] : null, huh: sum && sum[3] ? +sum[3] : 0,
  };
}

/* ── 본체 ─────────────────────────────────────────────────────────────────── */
const files = listChecks();
if (!files.length){ say('검사 파일이 없다 — checks/ 가 비었거나 필터가 아무것도 안 잡았다'); process.exit(2); }

if (OPT.hashes){
  say('| 파일 | 줄 | sha256[:12] |');
  say('|---|---|---|');
  for (const f of files){
    const p = path.join(CHECKS, f);
    say(`| ${f} | ${fs.readFileSync(p, 'utf8').split('\n').length - 1} | ${sha12(p)} |`);
  }
  process.exit(0);
}

say(`\n── 정본 대조 (CHECKS.md §3)`);
const v = OPT.verify ? verify(files) : (say('  · 건너뜀 (--no-verify)'), { bad: 0 });

if (OPT.list){
  say(`\n── 검사 ${files.length}개`);
  for (const f of files) say('  · ' + f);
  process.exit(v.bad ? 1 : 0);
}

say(`\n── 스테이징`);
let dir;
try { dir = stage(); }
catch (err){ say('  ✗ 스테이징 실패 — ' + (err && err.message)); process.exit(2); }
say(`  · ${dir}`);
const { still: absent, notes } = hoist(dir);
for (const n of notes) say(n);
if (absent.length){
  say(`  ? 원본 없음: ${absent.join(' · ')}`);
  say('    ★ 그 원본을 읽는 검사는 아래에서 `원본 없음` 으로 빠진다 — 빨강으로 세지 않는다.');
} else {
  say('  ✓ 원본 한 벌이 다 있다');
}

say(`\n── 실행 ${files.length}개`);
const results = [];
for (const f of files){
  const r = runOne(f, dir);
  results.push(r);
  if (r.skipped){ say(`  ·    ${f.padEnd(26)} 건너뜀 (${r.note})`); continue; }
  /* ★ **원본이 없어 못 돈 것**과 **규칙이 깨진 것**을 섞지 않는다.
       섞으면 원본 한 벌이 안 갖춰진 체크아웃에서 빨강 50개가 나오고 그 안에 진짜 빨강이
       묻힌다 — 3-① 이 겪은 것과 같은, 초록·빨강을 근거로 못 쓰는 상태다.
     ⚠️ 위 CORE 목록으로 가르지 않는다. 검사들이 읽는 원본은 그보다 많고(`mystery-au.js` ·
       `togetherland-ui-mockup.html` · `tw-settings.json` …) 목록으로 가르면 그 바깥이 전부
       가짜 빨강이 된다. **못 찾았다고 말하는 출력 자체**로 가른다.
     규칙이 깨진 검사는 반드시 요약 줄(`통과 N · 실패 N`)을 찍고 끝난다. 그게 없는데
       ENOENT 나 "못 찾음" 이 있으면 원본이 없는 것이다. */
  r.blocked = r.pass === null && r.code !== 0
    && (/ENOENT|MODULE_NOT_FOUND/.test(r.out) || /못 찾|찾지 못|찾을 수 없|있는 폴더에서 실행/.test(r.out));
  /* 없다고 말한 원본의 **이름만** 뽑는다 — 임시 폴더 경로가 붙어 오면 매번 달라져서 요약이 못 쓴다. */
  const hit = r.blocked && (r.out.match(/open '([^']+)'|path: '([^']+)'|Cannot find module '([^']+)'/) || []).slice(1).find(Boolean);
  r.want = hit ? path.basename(hit) : null;
  const mark = r.blocked ? '·' : (r.fail > 0 ? '✗' : (r.fail === 0 || r.code === 0) ? '✓' : '?');
  const score = r.blocked ? `원본 없음${r.want ? ' — ' + r.want : ''}`
    : r.allPass ? '전부 통과'
    : r.pass === null ? `종료코드 ${r.code}`
    : `${r.pass} · ${r.fail}${r.huh ? ' · ' + r.huh : ''}`;
  say(`  ${mark}    ${f.padEnd(26)} ${score}`);
}

const red = results.filter(r => !r.skipped && !r.blocked && (r.fail > 0 || (r.pass === null && r.code !== 0)));
if (red.length){
  say(`\n── 빨간 검사 원문`);
  for (const r of red){
    say(`\n┄┄ ${r.file} ┄┄`);
    say(r.out.split('\n').filter(l => /✗|\?/.test(l)).join('\n') || r.out.trim().slice(-2000));
  }
}

if (OPT.keep) say(`\n스테이징을 남겼다: ${dir}`);
else { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_){} }

const okCount = results.filter(r => !r.skipped && !r.blocked && r.code === 0).length;
const blocked = results.filter(r => r.blocked).length;
say(`\n검사 ${results.length}개 · 초록 ${okCount} · 빨강 ${red.length}`
  + ` · 원본없음 ${blocked} · 건너뜀 ${results.filter(r => r.skipped).length}`);
if (blocked){
  const want = [...new Set(results.filter(r => r.want).map(r => r.want))].sort();
  say(`★ 원본없음 ${blocked}개는 검사 잘못이 아니다 — 없는 원본: ${(want.length ? want : absent).join(' · ')}`);
}
if (v.bad) say(`★ 정본과 다른 검사 ${v.bad}개 — 위 초록은 근거로 못 쓴다.`);
process.exit(red.length || v.bad ? 1 : 0);
