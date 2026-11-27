/* sim-public-secrets.js — 공개 저장소에 비밀값 · 서버 내부 정보가 없는가
   실행:  node checks/run.js sim-public-secrets
   ★ 왜 — 이 저장소는 공개다. 서버(t-w-server)는 비공개라, 서버 내부 경로 · 토큰 · 운영 키가 문서 · 주석 · 로그 문자열
     어디에든 한 번 들어오면 기록(git history)에 남는다. 리뷰 교훈 «공개 저장소에 서버 내부 · 비밀값» 을 검사로 옮겼다.
   ・1절: git 이 추적하는 파일 전부(글 파일만)를 패턴으로 훑어 허용 목록 밖 걸림 0 · 허용 목록이 낡지 않음.
   ・2절: mutation test — 패턴마다 걸릴 예 · 안 걸릴 예(예시 값은 이 파일이 걸리지 않게 조각을 이어 만든다) ·
          임시 git 저장소에 비밀값 파일을 하나 넣으면 빨강.
   ⚠️ 패턴은 «모양» 만 본다(토큰 형식 · 사설 IP · 클라우드 내부 호스트 · 서버 내부 API 경로 · 서버 파일 경로).
     진짜 비밀이 아닌데 걸리면 ALLOW 에 파일 · 패턴 · 까닭을 적는다. 진짜면 지우고, 이미 커밋됐으면 그 값을 폐기 · 교체한다. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };

const PATTERNS = [
  ['AWS 액세스 키', /\b(AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['GitHub 토큰', /\bgh[pousr]_[A-Za-z0-9]{36,}|\bgithub_pat_[A-Za-z0-9_]{22,}/],
  ['Slack 토큰', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['개인 키', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['sk- API 키', /\bsk-(ant-|proj-|live_)?[A-Za-z0-9_-]{24,}/],
  ['Google API 키', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['비밀번호가 든 DB 주소', /\b(postgres(ql)?|mysql|mongodb(\+srv)?|redis):\/\/[^\s:@/'"]+:[^\s@'"]+@/],
  ['사설 IP', /\b(10\.\d{1,3}|192\.168|172\.(1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b/],
  ['클라우드 내부 호스트 · ARN', /\b[a-z0-9-]+\.(compute|rds|elb|cache)\.amazonaws\.com\b|\b[a-z0-9-]+\.(ec2|compute)\.internal\b|\barn:aws:[a-z0-9-]+:/],
  ['서버 내부 API 경로', /\/internal\/(v\d+\/)?[a-z]/],
  ['서버 파일 경로', /(^|[\s'"`(=])\/(srv|opt)\/(?!homebrew\b)[A-Za-z0-9_.-]+|\/home\/(ubuntu|ec2-user)\b|\/etc\/[a-z0-9_-]+\/[A-Za-z0-9_.-]+\.(env|conf|ya?ml|json|pem|key)\b/],
  ['값이 박힌 비밀 이름', /\b[A-Z0-9_]*(SECRET|TOKEN|PASSWORD|PRIVATE_KEY|API_KEY)[A-Z0-9_]*\s*[=:]\s*['"]?(?=[A-Za-z0-9+_=-]*\d)[A-Za-z0-9+_=-]{16,}/],
];

/* 걸려도 되는 것 — [파일, 패턴 이름, 까닭] */
const ALLOW = [
  ['apps/desktop/app/parts/firebase-config.js', 'Google API 키', 'Firebase 웹 설정의 apiKey 는 앱에 실려 나가는 공개 식별자다(권한은 DB 규칙 · 서버가 지킨다)'],
  ['checks/sim-visit-ping.js', '사설 IP', '검사의 예시 입력'],
  ['checks/sim-native-peek.js', '서버 파일 경로', '검사의 예시 입력(설치본 resources 자리)'],
];

const MAX_BYTES = 4 * 1024 * 1024;
/** 한 파일 글에서 걸린 것 [{ file, line, name, text }] */
function scanText(file, text){
  const hits = [];
  const lines = text.split('\n');
  for(let i = 0; i < lines.length; i++){
    for(const [name, re] of PATTERNS){
      const m = re.exec(lines[i]);
      if(m) hits.push({ file, line: i + 1, name, text: m[0].trim().slice(0, 12) + '…' });
    }
  }
  return hits;
}
/** git 저장소 root 의 추적 파일 전부를 훑는다 — 바이너리(NUL) · 큰 파일은 건너뛴다 */
function scanRepo(root){
  const r = spawnSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if(r.status !== 0) return null;
  const files = r.stdout.split('\0').filter(Boolean);
  const hits = [];
  let read = 0;
  for(const f of files){
    const abs = path.join(root, f);
    let st; try { st = fs.statSync(abs); } catch (_) { continue; }
    if(!st.isFile() || st.size > MAX_BYTES) continue;
    const buf = fs.readFileSync(abs);
    if(buf.includes(0)) continue;
    read++;
    hits.push(...scanText(f, buf.toString('utf8')));
  }
  return { files: files.length, read, hits };
}
const allowed = (h) => ALLOW.some(([f, n]) => f === h.file && n === h.name);

/* ── 저장소 찾기 — 러너는 스테이징(평면 사본 · .git 없음)에서 돌리고 NODE_PATH 로 저장소 node_modules 를 넘긴다 ── */
const nodePaths = (process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean);
const ROOT = [process.cwd(), path.resolve(__dirname, '..'), ...nodePaths.map((p) => path.dirname(p))]
  .find((d) => fs.existsSync(path.join(d, '.git')) && fs.existsSync(path.join(d, 'checks', 'CHECKS.md')));
if(!ROOT){ say('  ? 원본 못 찾음 — git 저장소(checks/CHECKS.md 가 있는 곳)'); process.exit(2); }

say('1절 — 저장소 추적 파일 훑기');
const res = scanRepo(ROOT);
chk(!!res && res.read > 100, '추적 파일을 읽었다' + (res ? ` — ${res.read}/${res.files}개(바이너리 · 큰 파일 뺌)` : ' — git ls-files 실패'));
if(res){
  const bad = res.hits.filter((h) => !allowed(h));
  for(const h of bad.slice(0, 20)) say(`      ${h.file}:${h.line} ${h.name} — ${h.text}`);
  chk(bad.length === 0, '허용 목록 밖 걸림 0' + (bad.length ? ` — ${bad.length}건(진짜면 지우고 그 값을 폐기 · 교체 · 아니면 ALLOW 에 까닭)` : ''));
  const stale = ALLOW.filter(([f, n]) => !res.hits.some((h) => h.file === f && h.name === n));
  chk(stale.length === 0, '허용 목록이 낡지 않았다' + (stale.length ? ' — 더는 안 걸림: ' + stale.map(([f, n]) => f + ' · ' + n).join(' / ') : ''));
}

say('2절 — mutation test(패턴마다 걸릴 예 · 안 걸릴 예)');
const j = (...a) => a.join('');
const cases = [
  ['AWS 액세스 키', j('const k = "AK', 'IA', 'ABCDEFGHIJKLMNOP";'), true],
  ['GitHub 토큰', j('token: gh', 'p_', 'a'.repeat(36)), true],
  ['Slack 토큰', j('xo', 'xb-', '1234567890-abc'), true],
  ['개인 키', j('-----BEGIN ', 'RSA PRIVATE', ' KEY-----'), true],
  ['sk- API 키', j('key = "s', 'k-ant-', 'a1'.repeat(14), '"'), true],
  ['Google API 키', j('AI', 'za', 'B'.repeat(35)), true],
  ['JWT', j('Bearer ey', 'JhbGciOiJIUzI1NiJ9.ey', 'JzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop'), true],
  ['비밀번호가 든 DB 주소', j('postgres', '://tw:hunter2', '@db.example.com/tw'), true],
  ['사설 IP', j('fetch("http://10', '.0.12.7:8080/x")'), true],
  ['사설 IP', j('host 192', '.168.0.20'), true],
  ['클라우드 내부 호스트 · ARN', j('ip-10-0-0-1.ec2', '.internal'), true],
  ['클라우드 내부 호스트 · ARN', j('arn', ':aws:', 'secretsmanager:ap-2:1:secret:x'), true],
  ['서버 내부 API 경로', j("post('/inter", "nal/v2/notify')"), true],
  ['서버 파일 경로', j('cat /s', 'rv/deploy/run.sh'), true],
  ['서버 파일 경로', j('/et', 'c/app/prod.env'), true],
  ['값이 박힌 비밀 이름', j('ADMIN_', 'TOKEN=', 'a8f3k2m9q7x1z5b4c6d0'), true],
  [null, 'desk-companion-prototype.html · task-runner-option-list-long-name', false],
  [null, 'firebasejs/10.12.2/firebase-app.js · v1.2.3.4 · https://api.together-working.com/me', false],
  [null, "const internalNote = 1; fetch('/me/internal-state'); GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}", false],
  [null, "const TOKEN_KEY = 'tw.authToken'; /etc/passwd 같은 입력 · RESET_PASSWORD_FN = 'adminResetPassword'", false],
  [null, "MY_SECRET_PATH = '/v2/me/secret-room'; /opt/homebrew/bin/gh", false],
];
for(const [name, text, bad] of cases){
  const hits = scanText('x.js', text);
  const ok = bad ? hits.some((h) => h.name === name) : hits.length === 0;
  chk(ok, `${bad ? '걸림' : '안 걸림'} ${name || ''} · ${text.slice(0, 40).replace(/[A-Za-z0-9]{8,}/g, (s) => s.slice(0, 4) + '…')}` + (ok ? '' : ' — 실제 ' + (hits.map((h) => h.name).join(' · ') || '없음')));
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-sim-secrets-'));
try {
  const git = (...a) => spawnSync('git', a, { cwd: tmp, encoding: 'utf8' });
  git('init', '-q');
  fs.writeFileSync(path.join(tmp, 'ok.md'), '# 안내\n주소는 https://api.together-working.com\n');
  git('add', '.');
  const before = scanRepo(tmp);
  chk(!!before && before.hits.length === 0, '임시 저장소: 깨끗하면 걸림 0');
  fs.writeFileSync(path.join(tmp, 'leak.js'), j("const url = 'http://192", ".168.1.5", "/inter", "nal/v2/rooms';\n"));
  git('add', '.');
  const after = scanRepo(tmp);
  chk(!!after && after.hits.filter((h) => h.file === 'leak.js').length === 2, '임시 저장소: 사설 IP · 내부 경로가 든 파일을 넣으면 둘 다 걸림');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

say(`통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
