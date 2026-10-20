/* sim-bump-version.js — 🔖 앱 버전 올리기(scripts/bump-version.js · 워크플로 release-start.yml 의 bump)
   실행:  node sim-bump-version.js   (러너 스테이징 또는 저장소 루트에서 · git · npm 이 있어야 한다)
   ★ 왜 이 검사가 있는가 — 앱이 apps/desktop 으로 옮겨 가(#431) 버전 커밋 · 태그를 이 스크립트가 직접 만든다.
     태그가 주석 태그가 아니면 «git push --follow-tags» 가 조용히 안 올리고, 커밋 이름이 달라지면 릴리스 기록이 어긋난다.
   ・1절: 진짜 git 저장소(임시)에서 돌려 본다 — 숫자 · lock · 커밋 이름 · 주석 태그 · 베타 번호 · prerelease --preid
   ・2절: 거절 — 더러운 작업 트리 · 이상한 인자(셸에 들어갈 글) · 빈 인자
   ・3절: 일부러 깨 보기 — 가벼운 태그 · lock 빠짐 · 더러운 트리 통과 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, path.join(__dirname, f), path.join(__dirname, '..', f)]) { try { return fs.readFileSync(c, 'utf8'); } catch (_) {} } return null; };
const SRC = read('scripts/bump-version.js');
if (!SRC) { say('  ? 원본 못 찾음 — scripts/bump-version.js'); process.exit(2); }
try { execSync('git --version && npm --version', { stdio: 'ignore' }); } catch (_) { say('  ? git · npm 이 없다 — 돌리지 못함'); process.exit(2); }

function load(src) { const module = { exports: {} }; new Function('module', 'exports', 'require', '__dirname', src.replace(/^#!.*\n/, ''))(module, module.exports, require, __dirname); return module.exports; }

/* 임시 저장소 — apps/desktop 에 package.json · lock 만 두고 첫 커밋 */
function repo(version) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-bump-'));
  const app = path.join(d, 'apps', 'desktop');
  fs.mkdirSync(app, { recursive: true });
  fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify({ name: 'together-working', version }, null, 2) + '\n');
  fs.writeFileSync(path.join(app, 'package-lock.json'), JSON.stringify({ name: 'together-working', version, lockfileVersion: 3, requires: true,
    packages: { '': { name: 'together-working', version } } }, null, 2) + '\n');
  const g = (c) => execSync(c, { cwd: d, encoding: 'utf8' });
  g('git init -q'); g('git config user.name t'); g('git config user.email t@t'); g('git config commit.gpgsign false'); g('git config tag.gpgsign false');
  g('git add -A'); g('git commit -q -m init');
  return { d, g, ver: () => JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8')).version,
    lockVer: () => JSON.parse(fs.readFileSync(path.join(app, 'package-lock.json'), 'utf8')).version };
}
const rm = (d) => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} };
const throws = (fn) => { try { fn(); return false; } catch (_) { return true; } };

/* 구현 하나를 받아 판정 표를 돌려준다 — 3절에서 깨진 구현에도 같은 판정을 돌린다 */
function judge(M) {
  const r = {};
  const a = repo('0.11.3');
  try {
    r.patch = M.bump(['patch'], a.d);
    r.patchFile = a.ver(); r.patchLock = a.lockVer();
    r.patchMsg = a.g('git log -1 --format=%s').trim();
    r.patchTagType = a.g('git cat-file -t v0.11.4').trim();
    r.patchTagMsg = a.g('git tag -n1 v0.11.4').trim();
    r.patchClean = a.g('git status --porcelain').trim() === '';
    r.beta = M.bump(['0.11.5-beta.0'], a.d);
    r.betaTag = a.g('git tag -l v0.11.5-beta.0').trim();
    r.pre = M.bump(['prerelease', '--preid=beta'], a.d);
    fs.writeFileSync(path.join(a.d, 'dirty.txt'), 'x');
    r.dirty = throws(() => M.bump(['patch'], a.d));
    r.dirtyVer = a.ver();
  } catch (e) { r.err = String(e && e.message || e); }
  finally { rm(a.d); }
  const b = repo('1.0.0');
  try {
    r.badArgs = ['patch; touch hacked', '$(touch hacked)', '', 'v1.2.3', '1.2', 'minor --git-tag-version'].map(x => throws(() => M.bump(x ? x.split(' ') : [], b.d)));
    r.badOpt = throws(() => M.bump(['prerelease', '--preid=beta;x'], b.d));
    r.hacked = fs.existsSync(path.join(b.d, 'hacked')) || fs.existsSync(path.join(b.d, 'apps', 'desktop', 'hacked'));
    r.afterBad = b.ver();
  } catch (e) { r.err2 = String(e && e.message || e); }
  finally { rm(b.d); }
  return r;
}
const ok = (r) => !r.err && !r.err2 && r.patch === '0.11.4' && r.patchFile === '0.11.4' && r.patchLock === '0.11.4'
  && r.patchMsg === 'chore: 0.11.4' && r.patchTagType === 'tag' && /chore: 0\.11\.4/.test(r.patchTagMsg) && r.patchClean
  && r.beta === '0.11.5-beta.0' && r.betaTag === 'v0.11.5-beta.0' && r.pre === '0.11.5-beta.1'
  && r.dirty && r.dirtyVer === '0.11.5-beta.1'
  && r.badArgs.every(Boolean) && r.badOpt && !r.hacked && r.afterBad === '1.0.0';
const bad = (r) => !ok(r);

say('── 1절 · 진짜 git 저장소에서 돌려 본다');
const R = judge(load(SRC));
if (R.err || R.err2) say('  · 던진 것: ' + (R.err || R.err2));
chk(R.patch === '0.11.4' && R.patchFile === '0.11.4', 'patch → apps/desktop/package.json 0.11.3 → 0.11.4');
chk(R.patchLock === '0.11.4', 'package-lock.json 버전도 같이 오른다');
chk(R.patchMsg === 'chore: 0.11.4', '커밋 이름 «chore: 0.11.4»(예전 npm version -m "chore: %s" 와 같다)');
chk(R.patchTagType === 'tag', '태그 v0.11.4 는 주석 태그 — push --follow-tags 가 올린다');
chk(/chore: 0\.11\.4/.test(R.patchTagMsg || ''), '태그 메시지 «chore: 0.11.4»');
chk(R.patchClean, '끝난 뒤 작업 트리가 깨끗하다(lock 까지 커밋)');
chk(R.beta === '0.11.5-beta.0' && R.betaTag === 'v0.11.5-beta.0', '번호 직접 지정(베타) → v0.11.5-beta.0');
chk(R.pre === '0.11.5-beta.1', 'prerelease --preid=beta → 0.11.5-beta.1');

say('── 2절 · 거절');
chk(R.dirty && R.dirtyVer === '0.11.5-beta.1', '작업 트리가 더러우면 거절하고 숫자를 안 바꾼다');
chk(Array.isArray(R.badArgs) && R.badArgs.every(Boolean), '이상한 인자(셸 글 · 빈 값 · v 붙음 · 두 마디 · 다른 옵션) 거절');
chk(R.badOpt, '--preid 에 다른 글이 붙으면 거절');
chk(R.hacked === false && R.afterBad === '1.0.0', '거절한 인자는 아무것도 실행하지 않는다(파일 안 생김 · 숫자 그대로)');

say('── 3절 · 일부러 깨 보기');
const MUT = [
  ['가벼운 태그', /git tag -a v\$\{v\} -m "chore: \$\{v\}"/, 'git tag v${v}'],
  ['lock 을 안 올림', /\$\{APP_DIR\}\/package\.json \$\{APP_DIR\}\/package-lock\.json/, '${APP_DIR}/package.json'],
  ['더러운 트리 통과', /if\(run\('git status --porcelain', root\)\.trim\(\)\) throw/, 'if(false) throw'],
  ['인자 검사 없음', /if\(!kind \|\| !KIND_RE\.test\(kind\) \|\| !opts\.every\(o => OPT_RE\.test\(o\)\)\) throw new Error\(USAGE\);/, ''],
];
for (const [name, re, to] of MUT) {
  if (!re.test(SRC)) { chk(false, `깨 보기 자리를 못 찾음 — ${name}`); continue; }
  let r; try { r = judge(load(SRC.replace(re, to))); } catch (e) { r = { err: String(e) }; }
  chk(bad(r), `${name} → 빨강`);
}

say(`\n  결과: 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
