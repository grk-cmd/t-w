/* sim-help-deploy-guard.js — 도움말 사이트(hosting:help)는 main 최신에서만 올라간다
   실행:  node checks/run.js sim-help-deploy-guard
   ★ 지키는 것
     1절: 판정(judge) — main · GitHub main 과 같은 커밋 · 도움말 폴더 깨끗 셋이 다 맞을 때만 통과 · 경계(빈 값 · 브랜치 없음)
     2절: 진짜 git 으로 돌린다 — 임시 원격(bare) + 복제본에서 predeploy 와 같은 자리(firebase/)에서 스크립트를 실행해 종료 코드를 본다
          (main 최신 → 0 · 다른 브랜치 · 받지 않음(뒤처짐) · 올리지 않은 커밋(앞섬) · 도움말 폴더 고침 → 1)
     3절: 배선 — firebase.json 의 help 칸 predeploy 가 이 스크립트를 부른다(mutation test 포함) */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync, spawnSync } = require('child_process');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const pick = (...c) => c.find((p) => fs.existsSync(p)) || null;
const GUARD = pick('scripts/help-deploy-guard.js', 'firebase/scripts/help-deploy-guard.js', path.join(__dirname, '../firebase/scripts/help-deploy-guard.js'));
const CFG = pick('firebase.json', 'firebase/firebase.json', path.join(__dirname, '../firebase/firebase.json'));
if (!GUARD || !CFG) { say('  ? 원본 못 찾음 — help-deploy-guard.js · firebase.json'); process.exit(2); }
const SRC = fs.readFileSync(GUARD, 'utf8');
const load = (src) => { const m = { exports: {} }; new Function('module', 'exports', 'require', src)(m, m.exports, require); return m.exports; };

say('── 1. 판정');
const G = load(SRC);
const OK = { branch: 'main', head: 'a1', originHead: 'a1', dirty: '' };
const judgeAll = (J) => [
  J(OK).ok === true,
  J(Object.assign({}, OK, { branch: 'release/0.14.0' })).ok === false,
  J(Object.assign({}, OK, { originHead: 'b2' })).ok === false,
  J(Object.assign({}, OK, { originHead: null })).ok === false,
  J(Object.assign({}, OK, { head: null })).ok === false,
  J(Object.assign({}, OK, { dirty: ' M firebase/hosting/help/link.html' })).ok === false,
  J(Object.assign({}, OK, { dirty: '  \n' })).ok === true,
  J(null).ok === false,
];
const R = judgeAll(G.judge);
chk(R[0], 'main · GitHub 과 같은 커밋 · 폴더 깨끗 → 통과');
chk(R[1], '다른 브랜치(release/0.14.0) → 멈춤');
chk(R[2] && R[3] && R[4], 'GitHub main 과 다름 · GitHub main 을 못 읽음 · 지금 커밋을 못 읽음 → 멈춤');
chk(R[5] && R[6], '도움말 폴더에 고침이 있으면 멈춤(빈 줄 · 공백만은 고침이 아님)');
chk(R[7], '상태가 없으면 멈춤');
chk(/git checkout main/.test(G.judge(Object.assign({}, OK, { branch: 'x' })).why) && /git pull/.test(G.judge(Object.assign({}, OK, { originHead: 'b' })).why), '  멈출 때 할 일을 한국어로 알려 준다');
for (const [label, from, to] of [
  ['브랜치 확인을 빼면', "if(!s || s.branch !== BRANCH) return", 'if(!s) return'],
  ['같은 커밋 확인을 빼면', "if(s.head !== s.originHead) return", 'if(false) return'],
  ['폴더 고침 확인을 빼면', "if(String(s.dirty || '').trim()) return", 'if(false) return'],
]) {
  const m = SRC.replace(from, to);
  chk(m !== SRC && !judgeAll(load(m).judge).every(Boolean), '  mutation test: ' + label + ' 위 판정이 빨강');
}

say('── 2. 진짜 git 으로 돌린다');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-help-guard-'));
const sh = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const id = ['-c', 'user.name=sim', '-c', 'user.email=sim@example.invalid'];
let gitOk = true;
try { sh(['--version'], tmp); } catch (_) { gitOk = false; }
if (!gitOk) { chk(false, 'git 을 찾지 못함'); }
else {
  const origin = path.join(tmp, 'origin.git'), work = path.join(tmp, 'work'), other = path.join(tmp, 'other');
  sh(['init', '-q', '--bare', '-b', 'main', origin], tmp);
  sh(['clone', '-q', origin, work], tmp);
  fs.mkdirSync(path.join(work, 'firebase', 'hosting', 'help'), { recursive: true });
  fs.mkdirSync(path.join(work, 'firebase', 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(work, 'firebase', 'scripts', 'help-deploy-guard.js'), SRC);
  fs.writeFileSync(path.join(work, 'firebase', 'hosting', 'help', 'link.html'), 'v1\n');
  sh(['checkout', '-q', '-b', 'main'], work);
  sh(['add', '-A'], work); sh([...id, 'commit', '-q', '-m', 'v1'], work); sh(['push', '-q', 'origin', 'main'], work);
  const run = (dir) => spawnSync(process.execPath, ['scripts/help-deploy-guard.js'], { cwd: path.join(dir, 'firebase'), encoding: 'utf8' });
  let r = run(work);
  chk(r.status === 0, 'main 최신 · 깨끗 → 0(올린다)');
  fs.writeFileSync(path.join(work, 'firebase', 'hosting', 'help', 'link.html'), 'v1-local\n');
  r = run(work);
  chk(r.status === 1 && /커밋하지 않은 고침/.test(r.stderr), '도움말 폴더에 커밋 안 한 고침 → 1');
  sh(['checkout', '-q', '--', '.'], work);
  sh(['checkout', '-q', '-b', 'release/0.14.0'], work);
  r = run(work);
  chk(r.status === 1 && /release\/0\.14\.0/.test(r.stderr), '★ 다른 브랜치(release/0.14.0) → 1 · 브랜치 이름을 알려 준다');
  sh(['checkout', '-q', 'main'], work);
  sh(['clone', '-q', origin, other], tmp);
  fs.writeFileSync(path.join(other, 'firebase', 'hosting', 'help', 'link.html'), 'v2\n');
  sh(['add', '-A'], other); sh([...id, 'commit', '-q', '-m', 'v2'], other); sh(['push', '-q', 'origin', 'main'], other);
  r = run(work);
  chk(r.status === 1 && /git pull/.test(r.stderr), '★ GitHub main 이 앞서 있는데 받지 않음(오래된 폴더) → 1');
  sh(['pull', '-q', 'origin', 'main'], work);
  chk(run(work).status === 0, '  받은 뒤에는 → 0');
  fs.writeFileSync(path.join(work, 'firebase', 'hosting', 'help', 'link.html'), 'v3\n');
  sh(['add', '-A'], work); sh([...id, 'commit', '-q', '-m', 'v3'], work);
  chk(run(work).status === 1, '올리지 않은 커밋이 있음(앞섬) → 1');
}
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}

say('── 3. 배선');
const cfgOk = (txt) => { let c; try { c = JSON.parse(txt); } catch (_) { return false; }
  const h = (Array.isArray(c.hosting) ? c.hosting : []).find((x) => x && x.target === 'help');
  return !!h && Array.isArray(h.predeploy) && h.predeploy.includes('node scripts/help-deploy-guard.js'); };
const CFG_SRC = fs.readFileSync(CFG, 'utf8');
chk(cfgOk(CFG_SRC), 'firebase.json — help 칸 predeploy 가 이 스크립트를 부른다(firebase/ 에서 도는 경로)');
chk(!cfgOk(CFG_SRC.replace('"predeploy": ["node scripts/help-deploy-guard.js"],', '')), '  mutation test: predeploy 줄을 빼면 위 판정이 빨강');

say('');
say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
