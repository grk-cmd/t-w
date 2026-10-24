/* ═══ 📝 sim-release-notes.js — 릴리스 메모 scripts/release-notes.js ═══════════════════════════
   정식 릴리스의 Releases 본문 = 사람이 쓴 공지 글(docs/release-notes/<버전>.md) + 접은 PR 목록.
   ・1절: 경로 — 정식 번호만 받는다(베타 · 이상한 값은 던짐)
   ・2절: 공지 글 읽기 — 없음 · 빈 파일 · 공백뿐은 null(빈 공지로 공개하지 않게) · 그 밖의 읽기 오류는 던짐
   ・3절: 본문 합치기 — 공지 글이 먼저 · PR 목록은 <details> 안 · 목록이 비면 접기 없음
   ・4절: 명령 — check 는 있으면 0 · 없으면 1, compose 는 본문을 찍는다(실제 프로세스로)
   ・5절: 깨 보기 — 빈 공지를 «있음» 으로 보거나 목록을 공지 위에 두면 빨강
   [실행] node checks/run.js sim-release-notes */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const SCRIPT = path.resolve('scripts/release-notes.js');
if(!fs.existsSync(SCRIPT)){ say('  ? 원본 못 찾음 — scripts/release-notes.js'); process.exit(2); }
const N = require(SCRIPT);
const throws = (fn) => { try{ fn(); return false; }catch(_){ return true; } };
const files = (map) => (f) => {
  if(f in map){ if(map[f] instanceof Error) throw map[f]; return map[f]; }
  const e = new Error('없음'); e.code = 'ENOENT'; throw e;
};
const P = path.join('docs', 'release-notes', '0.12.0.md');

say('── 1. 경로');
chk(N.notesPath('0.12.0') === P, '0.12.0 → docs/release-notes/0.12.0.md');
chk(throws(() => N.notesPath('0.12.1-beta.0')), '베타 번호는 받지 않는다');
chk(throws(() => N.notesPath('')) && throws(() => N.notesPath(undefined)) && throws(() => N.notesPath('../x')), '빈 값 · 경로 조각은 던진다');

say('── 2. 공지 글 읽기');
chk(N.readNotes('0.12.0', files({ [P]: '  ## 0.12.0\n- 가\n\n' })) === '## 0.12.0\n- 가', '앞뒤 공백을 걷고 돌려준다');
chk(N.readNotes('0.12.0', files({})) === null, '파일이 없으면 null');
chk(N.readNotes('0.12.0', files({ [P]: '' })) === null && N.readNotes('0.12.0', files({ [P]: ' \n\t\n' })) === null, '빈 파일 · 공백뿐도 null');
const denied = new Error('권한'); denied.code = 'EACCES';
chk(throws(() => N.readNotes('0.12.0', files({ [P]: denied }))), '없음이 아닌 읽기 오류는 던진다(«없음» 으로 덮지 않음)');

say('── 3. 본문 합치기');
const body = N.compose('## 0.12.0\n- 가', '* feat: a in #1\n');
chk(body.startsWith('## 0.12.0\n- 가\n'), '공지 글이 맨 위');
chk(/<details>\n<summary>[^<]+<\/summary>\n\n\* feat: a in #1\n\n<\/details>\n$/.test(body), 'PR 목록은 그 아래 <details> 안');
chk(N.compose('## 0.12.0', '') === '## 0.12.0\n' && N.compose('## 0.12.0', ' \n') === '## 0.12.0\n', 'PR 목록이 비면 접기를 붙이지 않는다');

say('── 4. 명령(실제 프로세스)');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'relnotes-'));
fs.mkdirSync(path.join(tmp, 'docs', 'release-notes'), { recursive: true });
fs.writeFileSync(path.join(tmp, P), '## 0.12.0\n- 가\n');
fs.writeFileSync(path.join(tmp, 'docs', 'release-notes', '0.12.1.md'), '\n');
fs.writeFileSync(path.join(tmp, 'gen.md'), '* fix: b in #2\n');
const run = (...a) => spawnSync(process.execPath, [SCRIPT, ...a], { cwd: tmp, encoding: 'utf8' });
let r = run('check', '0.12.0');
chk(r.status === 0, 'check: 공지 글이 있으면 0');
r = run('check', '0.13.0');
chk(r.status === 1 && /공지 글이 없다/.test(r.stderr), 'check: 없으면 1 · 무엇을 넣을지 알림');
r = run('check', '0.12.1');
chk(r.status === 1, 'check: 빈 파일도 1');
r = run('check', '0.12.1-beta.0');
chk(r.status === 1, 'check: 베타 번호는 1(정식만 부른다)');
r = run('compose', '0.12.0', 'gen.md');
chk(r.status === 0 && r.stdout.startsWith('## 0.12.0') && r.stdout.includes('* fix: b in #2') && r.stdout.includes('<details>'), 'compose: 공지 글 + 접은 PR 목록을 찍는다');
r = run('compose', '0.13.0', 'gen.md');
chk(r.status === 1 && r.stdout === '', 'compose: 공지 글이 없으면 아무것도 찍지 않고 1');
fs.rmSync(tmp, { recursive: true, force: true });

say('── 5. 깨 보기');
{
  const lax = (v, rf) => { try{ return String(rf(N.notesPath(v))); }catch(_){ return null; } };   // 빈 글도 «있음» 으로 보는 판
  chk(lax('0.12.0', files({ [P]: ' \n' })) !== null && N.readNotes('0.12.0', files({ [P]: ' \n' })) === null, '빈 공지를 «있음» 으로 보는 판은 2절 «빈 파일 null» 에 걸린다');
  const flipped = (notes, gen) => `<details>\n<summary>x</summary>\n\n${gen}\n</details>\n\n${notes}\n`;
  chk(!flipped('## 0.12.0', '* a').startsWith('## 0.12.0') && body.startsWith('## 0.12.0'), '목록을 공지 위에 두는 판은 3절 «공지 글이 맨 위» 에 걸린다');
}

say(`\n결과: ${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
