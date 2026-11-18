/* sim-app-hosts.js — 앱(설치본에 들어가는 apps/desktop 파일)에 바깥 주소를 새로 박지 않았는가
   실행:  node checks/run.js sim-app-hosts
          node checks/sim-app-hosts.js --write-baseline   (저장소 루트에서 — 사용자 확인을 받은 새 주소를 올릴 때 · 줄었을 때)
   ★ 왜 — 앱에 박힌 주소는 바꾸려면 앱을 다시 내야 하고, 옛 앱은 옛 주소를 계속 본다. 리뷰 교훈 «앱에 바깥 주소를 새로 박음» 을
     검사로 옮겼다: 새 호스트는 기준선(checks/app-hosts-baseline.json)을 고쳐야 통과한다 — 그 PR «왜» 에 사용자 확인을 적는다.
     남의 기본 주소(*.web.app · *.firebaseapp.com)는 기준선과 상관없이 빨강(맞춤 도메인 *.together-working.com 을 붙인다).
   ・1절: 설치본에 드는 파일(맨 위 *.js · app/** 의 js · html · css · json — app/vendor · app/licenses 는 남의 것이라 뺌)의
          코드 · 마크업에서 http(s) · ws(s) 호스트를 모아 기준선과 견준다(JS 주석 속 주소는 세지 않는다).
   ・2절: mutation test — 주소 뽑기 · 주석 빼기 · 새 호스트 빨강 · 기본 주소 빨강 · 줄면 빨강. */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };

const OURS = /(^|\.)together-working\.com$/;
const DEFAULT_HOST = /(^|\.)(web\.app|firebaseapp\.com)$/;
const URL_RE = /\b(?:https?|wss?):\/\/([A-Za-z0-9*.-]+\.[A-Za-z]{2,}|localhost|127\.0\.0\.1)(?=[:/'"`\s)\]>,;]|$)/g;
const SHIPPED = (f) => /^apps\/desktop\/[^/]+\.js$/.test(f)
  || (/^apps\/desktop\/app\//.test(f) && /\.(js|html|css|json)$/.test(f) && !/^apps\/desktop\/app\/(vendor|licenses)\//.test(f));

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
const BASELINE = path.join(ROOT, 'checks', 'app-hosts-baseline.json');

/** JS 에서 주석을 같은 길이의 공백으로 지운다(문자열 · 정규식 안의 // 는 그대로) */
function stripJsComments(text){
  const sf = ts.createSourceFile('x.js', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const ranges = new Map();
  const add = (rs) => { for(const r of rs || []) ranges.set(r.pos, r.end); };
  const visit = (node) => {
    add(ts.getLeadingCommentRanges(text, node.getFullStart()));
    add(ts.getTrailingCommentRanges(text, node.getEnd()));
    for(const c of node.getChildren(sf)) visit(c);
  };
  visit(sf);
  let out = text;
  for(const [a, b] of ranges) out = out.slice(0, a) + out.slice(a, b).replace(/[^\n]/g, ' ') + out.slice(b);
  return out;
}
function hostsOf(file, text){
  const code = /\.js$/.test(file) ? stripJsComments(text) : text;
  const out = new Set();
  for(const m of code.matchAll(URL_RE)) out.add(m[1].toLowerCase());
  return out;
}
function scanRepo(root){
  const r = spawnSync('git', ['ls-files', '-z', 'apps/desktop'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if(r.status !== 0) return null;
  const hosts = {};
  let read = 0;
  for(const f of r.stdout.split('\0').filter(SHIPPED)){
    let text; try { text = fs.readFileSync(path.join(root, f), 'utf8'); } catch (_) { continue; }
    read++;
    for(const h of hostsOf(f, text)) (hosts[h] = hosts[h] || []).push(f);
  }
  return { read, hosts };
}
function judge(hosts, base){
  const now = Object.keys(hosts);
  return {
    added: now.filter((h) => !base.includes(h)),
    gone: base.filter((h) => !now.includes(h)),
    defaults: now.filter((h) => DEFAULT_HOST.test(h)),
  };
}

const res = scanRepo(ROOT);
if(process.argv.includes('--write-baseline')){
  if(!res){ say('  ✗ git ls-files 실패'); process.exit(1); }
  fs.writeFileSync(BASELINE, JSON.stringify(Object.keys(res.hosts).sort(), null, 2) + '\n');
  say(`기준선을 썼다 — 호스트 ${Object.keys(res.hosts).length}개 · ${path.relative(ROOT, BASELINE)}`);
  process.exit(0);
}

say('1절 — 설치본에 드는 파일의 바깥 주소');
chk(!!res && res.read > 50 && res.hosts['api.together-working.com'], '설치본 파일을 읽었다' + (res ? ` — ${res.read}개 · 호스트 ${Object.keys(res.hosts).length}개` : ' — git ls-files 실패'));
let base = null;
try { base = JSON.parse(fs.readFileSync(BASELINE, 'utf8')); } catch (_) { /* 아래에서 빨강 */ }
chk(Array.isArray(base), '기준선을 읽었다 — checks/app-hosts-baseline.json');
if(res && Array.isArray(base)){
  const j = judge(res.hosts, base);
  for(const h of j.added) say(`      새 호스트 ${h}${OURS.test(h) ? '' : ' (우리 도메인 아님)'} — ${res.hosts[h].slice(0, 3).join(' · ')}`);
  chk(j.added.length === 0, '기준선 밖 새 호스트 0' + (j.added.length ? ' — 사용자에게 묻고(우리 도메인 *.together-working.com 으로) PR «왜» 에 확인을 적은 뒤 --write-baseline' : ''));
  chk(j.defaults.length === 0, '남의 기본 주소(*.web.app · *.firebaseapp.com) 0' + (j.defaults.length ? ' — ' + j.defaults.join(' · ') + '(맞춤 도메인을 붙일 것)' : ''));
  chk(j.gone.length === 0, '기준선에 낡은 줄 없음' + (j.gone.length ? ' — 더는 없음: ' + j.gone.join(' · ') + '(--write-baseline 로 내릴 것)' : ''));
}

say('2절 — mutation test');
const pick = (f, t) => [...hostsOf(f, t)].sort().join(',');
chk(pick('a.js', "fetch('https://api.together-working.com/me'); const w = 'wss://rt.together-working.com:443/ws';") === 'api.together-working.com,rt.together-working.com', 'JS 문자열 주소를 뽑는다');
chk(pick('a.js', "// 참고 https://docs.example.com/x\n/* https://old.example.org */ const a = 1;") === '', 'JS 주석 속 주소는 안 센다');
chk(pick('a.js', "const re = /https:\\/\\/x/; const s = '// https://cdn.example.net/a.js';") === 'cdn.example.net', '문자열 안의 // 는 주석이 아니다');
chk(pick('a.html', "<meta http-equiv=\"Content-Security-Policy\" content=\"connect-src https://*.googleapis.com\"><!-- https://x.example.io -->") === '*.googleapis.com,x.example.io', 'html 은 통째로 본다(CSP 의 * 호스트 포함)');
const b0 = ['api.together-working.com'];
const add1 = judge({ 'api.together-working.com': ['a'], 'evil.example.com': ['b'] }, b0);
chk(add1.added.join() === 'evil.example.com', '새 호스트를 넣으면 빨강');
const def1 = judge({ 'api.together-working.com': ['a'], 'tw.web.app': ['b'] }, ['api.together-working.com', 'tw.web.app']);
chk(def1.defaults.join() === 'tw.web.app', '기준선에 올려도 *.web.app 은 빨강');
const gone1 = judge({}, b0);
chk(gone1.gone.join() === 'api.together-working.com', '줄면 낡은 줄로 빨강');

say(`통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
