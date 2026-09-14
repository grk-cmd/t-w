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
/* 한 검사에 주는 시간. `app.js` 를 평가하는 검사가 안 죽는 일이 있어서(runOne 주석) 반드시 둔다.
   느린 기계에서 진짜로 모자라면 `--timeout=120`. */
const TIMEOUT = 1000 * (+(args.find(a => a.startsWith('--timeout=')) || '').split('=')[1] || 60);
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
  for (const e of fs.readdirSync(CHECKS, { withFileTypes: true })){
    /* ⚠️ 폴더는 건너뛴다. 재귀 옵션 없이 cpSync 에 폴더를 주면 던지고, 그러면
       **한 바퀴가 통째로 안 돈다.** 스테이징은 평면이어야 하므로 폴더는 애초에 대상이 아니다
       (`checks/tools/` 처럼 손으로 돌리는 도구를 두는 자리). */
    if (e.isDirectory() || e.name === 'run.js') continue;
    fs.cpSync(path.join(CHECKS, e.name), path.join(dir, e.name));
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

/* ── 검사가 제 발로 찍은 끝줄 ──────────────────────────────────────────────
   요약 줄(`통과 N · 실패 N`)로 끝내지 않는 검사가 절반이 넘는다. 쓰는 말은 네 갈래다:
     `✓ 전부 통과` · `전부 통과 ✅ — …` · `✗ 실패 N건` · `✗ N건 어긋남` · `N개 실패`
   종료코드만 보면 초록·빨강은 갈리지만 **몇 개를 봤는지**가 안 남고, 무엇보다 끊겼을 때
   (`status === null`) 종료코드 자체가 없어서 결과를 통째로 버리게 된다.

   ⚠️ 반드시 **마지막 몇 줄 안에서만** 본다. 절 끝마다 `플레이 경로 전부 통과 ✅` 처럼 찍는
     검사가 있어서, 출력 전체를 훑으면 실패한 검사가 초록으로 둔갑한다.
   ⚠️ 실패 쪽은 **줄 전체가 그 말일 때만** 센다. 숫자만 주우면 본문에 걸린다 —
     `sim-seat-opacity.js` 의 마지막 줄은 `옛 코드 실패 1건 / 새 코드 실패 0건` 이라는
     **설명문**이고, 양끝을 안 묶으면 통과한 검사가 `실패 1건` 으로 둔갑한다(실측).
     표식(✗·❌)으로만 가르는 것도 안 된다 — `문제 3건` 처럼 표식 없이 끝내는 검사가 있다.
   ⚠️ 통과 쪽은 느슨하게 본다. `§2 전부 통과 ✅` · `평준화 배율 전부 통과 ✅` 처럼 앞에 말이
     붙는다. 실패 쪽을 **먼저** 보므로 절 끝의 그 말이 최종 판정을 덮지 않는다. */
const FAIL_LINE = /^\s*[✗❌]?\s*(?:실패\s*(\d+)\s*건|문제\s*(\d+)\s*건|(\d+)\s*건\s*어긋남|(\d+)\s*개\s*실패)\s*$/;
const PASS_LINE = /전부 통과/;
function verdict(out){
  const tail = out.split('\n').filter(l => l.trim()).slice(-3);
  for (const l of tail){
    const m = l.match(FAIL_LINE);
    if (m) return { fail: +(m[1] || m[2] || m[3] || m[4]) };
  }
  return tail.some(l => PASS_LINE.test(l)) ? { fail: 0 } : null;
}

/* ── 한 개 돌리기 ──────────────────────────────────────────────────────────
   ⚠️ 종료 코드만 보면 안 된다. 검사들은 0=통과 · 1=실패 · 2=검사못함 을 쓰는데,
     "원본을 못 찾음" 도 그 코드로 나온다. 출력을 같이 읽어야 그 둘이 갈린다. */
function runOne(file, cwd){
  const py = file.endsWith('.py');
  /* ⚠️ Windows 에서 python 의 stdout 기본 인코딩이 cp949 라 한글이 깨져서 온다. 깨지면
     "원본이 없다" 는 제 말(아래 blocked 판정)이 안 읽혀서 **가짜 빨강**이 된다. 강제한다. */
  /* ★ `PYTHONUNBUFFERED` 가 없으면 **아래 파일 받기가 통째로 헛돈다.**
       파이썬은 stdout 이 터미널이 아닐 때(=여기처럼 파일일 때) 블록 버퍼로 돈다. SIGKILL 은
       버퍼를 안 비우므로 audit.py 가 19절을 다 찍고 섰든 1절에서 섰든 **로그가 0바이트**다 —
       실제로 `(한 줄도 못 찍고 섰다)` 로 왔다. 그 한 줄이 "어디서 섰나" 의 유일한 단서다. */
  const env = py ? Object.assign({}, process.env,
    { PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1', PYTHONUNBUFFERED: '1' }) : process.env;
  const tries = py ? [['python3', [file]], ['python', [file]]] : [[process.execPath, [file]]];
  /* ★ 출력을 파이프가 아니라 **파일**로 받는다.
       파이프로 받으면 시간초과로 죽일 때 아직 안 비워진 버퍼가 통째로 날아간다. Windows 에서
       실측했다 — 다 돌고 안 죽은 검사 셋이 출력 한 줄 없이 `시간초과` 로 왔다. 그러면
       "다 돌고 안 죽음" 과 "진짜 멈춤" 을 가를 수가 없다(아래 lingered 판정이 죽는다).
     파일은 쓰는 즉시 디스크에 남으므로 강제 종료돼도 그때까지 찍은 것이 그대로 있다. */
  /* ⚠️ 로그는 스테이징 **밖**에 쓴다. 안에 쓰면 검사가 폴더를 훑을 때 제 로그를 원본으로 본다. */
  const logs = cwd + '-logs';
  try { fs.mkdirSync(logs, { recursive: true }); } catch (_){}
  const of = path.join(logs, file + '.out'), ef = path.join(logs, file + '.err');
  let r = null;
  for (const [cmd, a] of tries){
    const ofd = fs.openSync(of, 'w'), efd = fs.openSync(ef, 'w');
    try { r = spawnSync(cmd, a, { cwd, env, stdio: ['ignore', ofd, efd],
                                  timeout: TIMEOUT, killSignal: 'SIGKILL' }); }
    finally { fs.closeSync(ofd); fs.closeSync(efd); }
    if (!r.error) break;
  }
  if (r && r.error && !/ETIMEDOUT/i.test(String(r.error.message))){
    return { file, skipped: true, note: py ? 'python 없음' : String(r.error.message) };
  }
  const slurp = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch (_){ return ''; } };
  const so = slurp(of), se = slurp(ef);
  const out = so + se;
  const sum = [...out.matchAll(/통과\s*(\d+)\s*·\s*실패\s*(\d+)(?:\s*·\s*검사못함\s*(\d+))?/g)].pop();
  /* ★ 판정은 **stdout 과 stderr 를 따로** 읽는다. 이어붙이면 안 된다 —
       `verdict` 는 마지막 세 줄만 보는데, 이어붙이면 stderr 가 통째로 뒤에 붙어
       **검사가 제 발로 찍은 판정 줄을 밀어낸다.** stderr 세 줄이면 그것만으로 사라진다(실측).
       그러면 ① 초록이 `종료코드 0` 으로 떨어져 몇 개를 쟀는지가 안 남고
             ② 빨강이 센 실패 건수가 집계에서 새고
             ③ 무엇보다 **끊긴 것이 `시간초과` 로 둔갑한다** — `timedOut` 이 `!end` 를 보기 때문.
       ③ 이 바로 `sim-fly-replay` · `sim-gacha-prune` 사고다. 그때 `status === null` 쪽만
       고쳤고 이 자리는 남아 있었다. 지금도 그 둘은 「다 돌고 안 죽어서 끊음」이라
       stderr 세 줄만 늘면 그대로 재발한다.
     ⚠️ stderr 쪽 **실패 선언은 그대로 이기게 둔다.** stdout 의 통과만 보면 stderr 로
       빨강을 찍는 검사를 초록으로 덮는다. 순서는 「stderr 의 실패 → stdout → stderr」. */
  const vso = verdict(so), vse = verdict(se);
  const end = (vse && vse.fail > 0) ? vse : (vso || vse);
  /* ★ 끊긴 것과 **멈춘 것**은 다르다.
       `app.js` 를 통째로 평가하는 검사는 할 일을 다 끝내고도 렌더러가 남긴 타이머 때문에
       node 가 안 죽는다. spawnSync 는 프로세스가 끝나야 출력을 주므로, 밖에서 보면 멈춘 것과
       똑같이 보인다 — 실제로 sim-fly-replay 에서 러너가 통째로 섰다.
     ⇒ 끊되, **제 발로 끝을 찍었으면 그 결과를 쓴다.** 다 돌고 안 죽은 것뿐이다.
       끝줄도 없이 끊겼을 때만 시간초과로 센다. */
  const killed = r.status === null || !!r.signal || (r.error && /ETIMEDOUT/i.test(String(r.error.message)));
  /* ⚠️ `killed` 를 같이 봐야 한다. 끊긴 프로세스의 `status` 는 **null** 이라, 여기서 `status === 0`
       만 보면 끝줄이 멀쩡히 찍혀 있어도 못 쓴다 — `sim-fly-replay` · `sim-gacha-prune` 이
       마지막 줄에 `✓ 전부 통과` 를 남기고도 시간초과 셋 안에 묻혀 있던 이유가 이 한 줄이었다. */
  const allPass = !sum && !!end && end.fail === 0 && (r.status === 0 || killed);
  return {
    file, code: r.status, out, allPass,
    lingered: killed && !!(sum || end), timedOut: killed && !sum && !end,
    pass: sum ? +sum[1] : null,
    /* 요약 줄이 없으면 끝줄이 센 실패 수를 쓴다. 안 그러면 **끊긴 빨강**이 집계에서 샌다. */
    fail: sum ? +sum[2] : (end ? end.fail : null),
    huh: sum && sum[3] ? +sum[3] : 0,
  };
}

/* ── 원본이 없어서 못 돈 것인가 ────────────────────────────────────────────
   ★ **원본이 없어 못 돈 것**과 **규칙이 깨진 것**을 섞지 않는다. 섞으면 원본 한 벌이 안
     갖춰진 체크아웃에서 빨강 50개가 나오고 그 안에 진짜 빨강이 묻힌다.
   ⚠️ 위 CORE 목록으로 가르지 않는다. 검사들이 읽는 원본은 그보다 많고(`mystery-au.js` ·
     `togetherland-ui-mockup.html` · `tw-settings.json` …) 목록으로 가르면 그 바깥이 전부
     가짜 빨강이 된다. **못 찾았다고 말하는 출력 자체**로 가른다.

   ⚠️⚠️ 그런데 `못 찾` 이라는 말만 보면 **반대로 샌다.** 검사가 제 판정문에 그 말을 쓴다 —
     `✓ 파일을 못 찾으면 다음 후보로 갈아탄다` 같은 줄이다. 이것 하나 때문에
     `sim-purikura-deco.js` 가 **빨강인데 `원본 없음` 으로 찍혀** 집계 밖으로 빠져 있었다.
     (두 번째 바퀴에서 `purikura-net.js` 를 받아 끝까지 돌고 `✗ N건 어긋남` 을 찍은 뒤였다.)
   ⇒ 한글 문구는 ① **통과 판정줄(✓/✅)이 아니고** ② 그 줄이 **파일 이름**을 대고
     ③ 그 파일이 스테이징에 **정말 없을 때만** 센다. node 가 직접 뱉은 ENOENT 는 그대로 믿는다.
   ⚠️ `?` 로 시작하는 줄까지 버리면 안 된다. `? main.js 를 못 찾음 — main.js 가 있는 폴더에서
     실행할 것` 이 원본없음의 **유일한 증거**인 검사가 여럿이다(오버레이 둘 · pl-loop …).
     통과줄만 버리고 나머지는 ②③ 으로 거른다 — 그래야 그 둘이 안 뒤집힌다.

   돌려주는 값: 없는 원본 이름 · `''`(원본없음은 확실한데 이름을 못 뽑음) · `null`(원본 문제 아님) */
function missingSource(out, cwd){
  const hard = (out.match(/open '([^']+)'|path: '([^']+)'|Cannot find module '([^']+)'/) || []).slice(1).find(Boolean);
  if (hard) return path.basename(hard);
  if (/ENOENT|MODULE_NOT_FOUND/.test(out)) return '';
  for (const line of out.split('\n')){
    if (/^\s*[✓✅]/.test(line)) continue;
    if (!/못 찾|찾지 못|찾을 수 없|있는 폴더에서 실행/.test(line)) continue;
    for (const n of line.match(/[\w.\-]+\.(?:js|json|html|py)\b/g) || []){
      if (!fs.existsSync(path.join(cwd, path.basename(n)))) return path.basename(n);
    }
  }
  return null;
}

/* ★ 첫 바퀴와 두 번째 바퀴가 **같은 함수**로 가른다. 따로 두면 반드시 갈린다 — `render` 를
     한 함수로 모은 것과 같은 이유고, 같은 실수를 두 번 하지 않으려고 여기도 모았다. */
function classify(r, cwd){
  if (r.skipped) return r;
  const a = (r.pass === null && r.code !== 0 && !r.allPass) ? missingSource(r.out, cwd) : null;
  r.blocked = a !== null;
  r.want = a || null;
  return r;
}

/* ── 빨강인가 ──────────────────────────────────────────────────────────────
   ★ **이 파일에서 빨강을 정하는 자리는 여기 하나뿐이다.** 화면(`render`) · 원문 출력 ·
     마지막 집계가 전부 이걸 부른다.
     한 번 모았는데도 또 갈렸던 자리다 — `render` 는 한 함수로 모았지만 `red` 와 `okCount` 가
     제 조건을 따로 갖고 있어서, **요약 줄이 `실패 0` 인데 종료코드가 1** 인 검사가
     화면엔 ✓ 로 찍히고 집계에서는 초록에도 빨강에도 안 들어갔다(합성 시험으로 실측).
     그래서 아래 집계는 "빨강이 아닌 것" 으로만 초록을 센다 —
     **초록+빨강+원본없음+시간초과+건너뜀 = 전체**가 구조적으로 맞는다.

   판정 순서가 곧 규칙이다:
     ① 못 돈 것(건너뜀·원본없음·시간초과)은 빨강이 아니다 — 결과를 못 본 것이다.
     ② 실패를 셌으면 빨강.
     ③ 제 발로 `전부 통과` 를 찍었으면 초록. (끊겨서 종료코드가 null 이어도 그렇다)
     ④ 나머지는 종료코드로 가른다. 단 **끊긴 것(`lingered`)의 null 은 실패가 아니다.** */
function isRed(r){
  if (r.skipped || r.blocked || r.timedOut) return false;
  if (r.fail > 0) return true;
  if (r.allPass) return false;
  return r.code !== 0 && !r.lingered;
}

/* ── 한 줄 표시 ────────────────────────────────────────────────────────────
   ★ 첫 바퀴와 두 번째 바퀴가 **같은 함수**를 쓴다. 따로 두었더니 두 번째 바퀴에서
     `종료코드 1` 인 검사가 ✓ 로 찍혔다 — 집계는 맞는데 눈으로 본 것이 틀렸다.
     같은 사실을 두 자리에서 판정하면 반드시 이렇게 갈린다. */
function render(r){
  if (r.skipped) return `  ·    ${r.file.padEnd(26)} 건너뜀 (${r.note})`;
  const bad = isRed(r);
  const mark = r.blocked ? '·' : r.timedOut ? '⏱' : bad ? '✗' : '✓';
  /* 요약 줄이 없는 검사는 끝줄이 센 실패 수를 쓴다. `종료코드 1` 보다 그쪽이 훨씬 많은 말을
     하고, 끊긴 검사는 종료코드가 아예 `null` 이라 그대로 두면 `종료코드 null` 이 찍힌다. */
  const base = r.allPass ? '전부 통과'
    : r.pass === null ? (r.fail > 0 ? `실패 ${r.fail}건` : `종료코드 ${r.code}`)
    : `${r.pass} · ${r.fail}${r.huh ? ' · ' + r.huh : ''}`
      /* 요약 줄은 `실패 0` 인데 종료코드가 1 인 경우. 검사가 요약 밖에서 따로 실패를 세고
         나간 것이다 — 숫자만 믿으면 초록으로 둔갑한다. 위 ④ 가 빨강으로 잡고, 여기서 왜인지 적는다. */
      + (r.fail === 0 && !r.lingered && r.code !== 0 ? `  (요약은 실패 0 인데 종료코드 ${r.code})` : '');
  const score = r.blocked ? `원본 없음${r.want ? ' — ' + r.want : ''}`
    : r.timedOut ? `시간초과 ${TIMEOUT / 1000}초 — 결과를 못 봤다`
    : r.lingered ? `${base}  (다 돌고 안 죽어서 끊음)`
    : base;
  return `  ${mark}    ${r.file.padEnd(26)} ${score}`;
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
  if (r.skipped){ say(render(r)); continue; }
  classify(r, dir);
  say(render(r));
}

/* ── 두 번째 바퀴 ──────────────────────────────────────────────────────────
   `원본 없음 — mallang.js` 처럼 **검사가 없다고 이름을 대 준** 원본은 저장소 어딘가에 있을 수
   있다(`app/parts/` 처럼 한 층 더 깊은 자리). 첫 바퀴에서는 그 이름을 모르니 못 올렸다.
   ⇒ 이름을 알게 된 지금 올려서, **그 검사들만** 다시 돈다.

   ★ **한 바퀴로는 모자란다.** 검사는 없는 원본을 **하나씩** 댄다 — 첫 줄에서 멈추기 때문이다.
     `sim-purikura-stage.js` 는 `purikura-net.js` 를 받고 나서야 `firebase-init.js` 가 없다고
     말했고, 바퀴가 하나뿐이던 판은 그 파일이 `app/parts/` 에 **있는데도** 「원본 없음」이라고
     답했다(2026-09-13 실측). 원본이 있는데 없다고 하는 것은 빨강을 놓치는 것과 같다.
   ⇒ 새 이름이 안 나올 때까지 돈다. 상한을 둔다 — 서로가 서로를 부르는 경우에 안 멈출 수 있다.
     상한에 걸리면 그 사실을 말한다. 조용히 멈추면 다시 「원본이 있는데 없다」가 된다. */
const MAX_ROUNDS = 5;
const tried = new Set();
let round = 1;
while (round < MAX_ROUNDS){
  const named = [...new Set(results.filter(r => r.blocked && r.want).map(r => r.want))]
    .filter(n => !tried.has(n));
  if (!named.length) break;
  const got = [];
  for (const name of named){
    tried.add(name);
    if (fs.existsSync(path.join(dir, name))) continue;
    let hits = [];
    try { hits = findDeep(ROOT, name, [], 0); } catch (_){}
    if (hits.length === 1){ fs.cpSync(hits[0], path.join(dir, name)); got.push([name, hits[0]]); }
  }
  if (!got.length) break;
  round++;
  say(`\n── ${round}번째 바퀴 — 깊은 자리에서 찾은 원본`);
  for (const [n, h] of got) say(`  ✓ ${n} — ${path.relative(ROOT, h)}`);
  /* ★ 다시 돌릴 대상은 `원본 없음` 만이 아니다.
       원본이 없을 때 **못 찾았다는 말 대신 그냥 빨개지는** 검사가 있다 — `sim-purikura-rules.js`
       는 `✗ firebase-init.js 를 읽었다` 로 시작해 6건을 쏟는다. 그건 빨강이 아니라 못 본 것이다.
       그런 검사는 blocked 가 아니라 red 로 찍혀서, 원본을 나중에 찾아 줘도 영영 안 고쳐졌다.
     ⇒ 이번에 올린 파일 **이름이 출력에 적혀 있으면** 빨강이어도 다시 돌린다. 이름을 댄 것은
       그 검사 자신이므로 헛돌 일이 없고, 대지 않은 검사는 건드리지 않는다. */
  const fresh = got.map(g => g[0]);
  for (let i = 0; i < results.length; i++){
    const r = results[i];
    if (r.skipped) continue;
    const mentions = !r.blocked && r.out && fresh.some(n => r.out.includes(n));
    if (!r.blocked && !mentions) continue;
    const again = classify(runOne(r.file, dir), dir);
    results[i] = again;
    say(render(again) + (mentions && !r.blocked ? '   ← 빨강이었는데 원본을 못 봤던 것이다' : ''));
  }
}
if (round >= MAX_ROUNDS && results.some(r => r.blocked && r.want)){
  say(`\n★ ${MAX_ROUNDS}바퀴를 돌고도 이름이 계속 나온다 — 아래 \`원본 없음\` 은 "정말 없다"가 아니다.`);
}

const red = results.filter(isRed);
if (red.length){
  say(`\n── 빨간 검사 원문`);
  for (const r of red){
    say(`\n┄┄ ${r.file} ┄┄`);
    say(r.out.split('\n').filter(l => /✗|\?/.test(l)).join('\n') || r.out.trim().slice(-2000));
  }
}

/* 시간초과는 결과가 없지만 **어디까지 갔는지**는 남아 있다(출력을 파일로 받으므로).
   마지막 몇 줄이 "다 돌고 안 죽음" 과 "중간에 섬" 을 가르는 유일한 단서다. */
const stuck = results.filter(r => r.timedOut);
if (stuck.length){
  say(`\n── 시간초과 — 마지막으로 찍힌 줄`);
  for (const r of stuck){
    const tail = r.out.split('\n').filter(l => l.trim()).slice(-4);
    say(`\n┄┄ ${r.file} ┄┄`);
    say(tail.length ? tail.join('\n') : '  (한 줄도 못 찍고 섰다 — 원본을 읽는 중이거나 평가 중이다)');
  }
}

if (OPT.keep) say(`\n스테이징을 남겼다: ${dir}`);
else { for (const d of [dir, dir + '-logs']) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_){} } }

/* ★ 조건을 여기서 다시 쓰지 않는다. 다시 쓰는 순간 또 갈린다 — 그게 위 `isRed` 주석의 사고다.
     못 돈 것을 빼고 빨강을 빼면 남는 것이 초록이다. 그래서 아래 합은 항상 전체와 같다. */
const okCount = results.filter(r => !r.skipped && !r.blocked && !r.timedOut && !isRed(r)).length;
const late = results.filter(r => r.timedOut).length;
const blocked = results.filter(r => r.blocked).length;
say(`\n검사 ${results.length}개 · 초록 ${okCount} · 빨강 ${red.length}`
  + ` · 원본없음 ${blocked}${late ? ' · 시간초과 ' + late : ''}`
  + ` · 건너뜀 ${results.filter(r => r.skipped).length}`);
if (late) say(`★ 시간초과 ${late}개 — 결과를 못 본 것이다. 초록도 빨강도 아니다. \`--timeout=120\` 으로 다시 볼 것.`);
if (blocked){
  const want = [...new Set(results.filter(r => r.want).map(r => r.want))].sort();
  say(`★ 원본없음 ${blocked}개는 검사 잘못이 아니다 — 없는 원본: ${(want.length ? want : absent).join(' · ')}`);
}
if (v.bad) say(`★ 정본과 다른 검사 ${v.bad}개 — 위 초록은 근거로 못 쓴다.`);
process.exit(red.length || late || v.bad ? 1 : 0);
