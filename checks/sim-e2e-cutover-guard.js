/* sim-e2e-cutover-guard.js — e2e cutover-012(운영 0.12.3 을 이 PC 에뮬레이터에 붙여 돌림)의 켜기 전 문지기
   실행: node checks/run.js e2e-cutover-guard
   [왜] 그 묶음은 운영 앱을 운영 설정 그대로 켠다. 주소 표(apps/desktop/tools/e2e-local/scenarios/cutover-012/_route012.js)가 한 군데만 새도
     시험 요청이 진짜 운영 서버(RTDB · Auth · API)로 나간다 — webRequest 의 redirect 는 wss 에 듣지 않아 실제로 한 번 나갔다.
     시스템 프록시가 있으면 Chromium 은 이름을 스스로 풀지 않아 이름 풀이 규칙도 안 듣는다(그래서 no-proxy-server · DIRECT 확인 · 인증서 고정).
   [무엇을 본다] 1절: 표 그대로 — 문지기 통과 · 이름 풀이 규칙 읽기 · 주소 판정(이 PC 이름은 ^…$ 로만) · 스위치(no-proxy-server) ·
     인증서 판정(운영 RTDB 이름은 고정 지문만) · 확인용 실행 줄 판정(프록시 DIRECT · 이름 풀이 · 인증서 · wss).
     2절: 일부러 다르게 넣은 입력 — 돌리는 표에서 한 줄씩 빼기 · 규칙 빼기 · 받는 곳을 밖으로 등 → 문지기 거절.
     3절: mutation test — _route012.js 글을 고친 판(인증서를 모두 받음 · no-proxy-server 뺌 · DIRECT 요구 뺌 · 이 PC 이름의 ^…$ 뺌 ·
     Auth 줄 뺌 · «모두 못 풂» 규칙 뺌)을 불러 1절을 다시 돌리면 빨강이 나야 한다.
     네트워크 · Electron 은 쓰지 않는다. Chromium 이 정말 그렇게 하는지는 시나리오가 켜기 전에 확인용 실행으로 본다(_kit.js guardLaunch). */
'use strict';
const fs = require('fs');
const path = require('path');
const Module = require('module');

const REL = path.join('tools', 'e2e-local', 'scenarios', 'cutover-012', '_route012.js');
const file = [REL, path.join(__dirname, '..', 'apps', 'desktop', REL)].map((f) => path.resolve(f)).find((f) => fs.existsSync(f));
if (!file) { console.log('  ? 원본 못 찾음 — ' + REL); process.exit(2); }
const SRC = fs.readFileSync(file, 'utf8');
const load = (src) => { const m = new Module(file); m.filename = file; m.paths = []; m._compile(src, file); return m.exports; };

let pass = 0, fail = 0;
const chk = (ok, msg) => { if (ok) pass++; else fail++; console.log(`  ${ok ? '✓' : '✗'} ${msg}`); };

const PORT = 41234;
const O = { api: 'http://127.0.0.1:41001', auth: 'http://127.0.0.1:41002', db: 'http://127.0.0.1:41003', storage: 'http://127.0.0.1:41004' };
const FP = 'sha256/' + 'Q'.repeat(43) + '=';
const OTHER_FP = 'sha256/' + 'Z'.repeat(43) + '=';   // 진짜 Firebase 인증서 자리

/* 1절 판정 — 모듈 하나를 받아 [{ ok, msg }]. mutation test 는 같은 판정을 고친 판에 돌려 하나라도 빨강인지 본다 */
function cases(R) {
  const out = [];
  const t = (ok, msg) => out.push({ ok: !!ok, msg });
  const RULES = R.resolverRules(PORT);
  const g = (over) => R.guard(Object.assign({ relayPort: PORT, o: O, fingerprint: FP }, over || {}));
  const ok = g();
  t(ok.length === 0, '문지기 통과' + (ok.length ? ': ' + ok.join(' / ') : ''));
  for (const h of ['identitytoolkit.googleapis.com', 'securetoken.googleapis.com', 'firebasestorage.googleapis.com', 'api.together-working.com', 'asia-southeast1-together-working.cloudfunctions.net', R.RTDB_HOST])
    t(R.GUARD_HOSTS.some((x) => x.host === h && x.routed), `${h} 를 «이 PC 로 돌려야 하는 이름» 으로 본다`);
  for (const h of ['s-gke-apse1-nssi2-0.asia-southeast1.firebasedatabase.app', 'together-working-default-rtdb.firebaseio.com', 'rooms-dev.togetherworking.duckdns.org'])
    t(R.GUARD_HOSTS.some((x) => x.host === h && !x.routed), `${h}(돌리지 않는 이름)도 본다`);

  // 이름 풀이 규칙 읽기
  t(R.resolveRule(R.RTDB_HOST, RULES) === '127.0.0.1:' + PORT, '운영 RTDB 이름 → 중계');
  t(R.resolveRule(R.SENTINEL_HOST, RULES) === '127.0.0.1:9', '표지 이름 → 127.0.0.1:9');
  for (const h of ['identitytoolkit.googleapis.com', 'api.together-working.com', 'x.firebaseio.com', 'anything.example'])
    t(R.resolveRule(h, RULES) === '~NOTFOUND', `${h} → ~NOTFOUND`);
  t(R.resolveRule('www.gstatic.com', RULES) === null && R.resolveRule('localhost', RULES) === null, 'www.gstatic.com · localhost 는 그대로(EXCLUDE)');
  t(R.resolveRule('a.b', ['MAP a.b 1.1.1.1:1', 'MAP * ~NOTFOUND']) === '1.1.1.1:1', '처음 맞는 MAP 이 이긴다');
  t(R.resolveRule('a.b', ['EXCLUDE a.b', 'MAP a.b 1.1.1.1:1']) === null, 'EXCLUDE 가 MAP 보다 먼저');
  t(R.resolveRule('x.y.z', ['MAP *.y.z ~NOTFOUND']) === '~NOTFOUND' && R.resolveRule('y.z', ['MAP *.y.z ~NOTFOUND']) === null, '*.꼬리 는 그 아래 이름만');

  // 주소 판정
  const c = (u) => R.classify(u, O);
  t(c('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=k').to === O.auth + '/identitytoolkit.googleapis.com/v1/accounts:lookup?key=k', 'Auth → 에뮬레이터(원래 호스트를 앞에)');
  t(c('https://api.together-working.com/v1/config').to === O.api + '/v1/config', 'API → stub');
  t(c(`https://${R.RTDB_HOST}/.lp?x=1`).to === O.db + '/.lp?x=1', 'RTDB https → 에뮬레이터');
  t(c('https://asia-southeast1-together-working.cloudfunctions.net/visitPing').to === O.api + '/__fn/asia-southeast1-together-working.cloudfunctions.net/visitPing', '함수 → stub');
  t(c('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js').kind === 'pass', 'SDK 파일만 그대로');
  t(c('https://www.gstatic.com/other.js').kind === 'block', 'gstatic 의 다른 길은 막음');
  t(c('https://firestore.googleapis.com/x').kind === 'block' && c('https://example.com/').kind === 'block', '표에 없는 https 는 막음');
  t(c(`wss://${R.RTDB_HOST}/.ws`).kind === 'relay', 'wss 는 운영 RTDB 이름만(이름 풀이가 중계로)');
  t(c('wss://s-gke-apse1-nssi2-0.asia-southeast1.firebasedatabase.app/.ws').kind === 'block' && c('wss://x.together-working.com/').kind === 'block', '그 밖의 wss 는 막음');
  t(c('ws://127.0.0.1:8787/').kind === 'local' && c('http://localhost:1/').kind === 'local', '이 PC 의 ws · http 는 둠');
  t(c('http://api.together-working.com/').kind === 'block' && c('ws://example.com/').kind === 'block', '밖의 ws · http 는 막음');
  t(c('ws://localhost.example.com/').kind === 'block', 'ws://localhost.example.com 은 막음(이 PC 이름은 통째로만)');
  t(c('http://127.0.0.1.evil/').kind === 'block', 'http://127.0.0.1.evil 은 막음');
  t(!R.LOCAL_RE.test('127.0.0.1.nip.io') && !R.LOCAL_RE.test('xlocalhost') && R.LOCAL_RE.test('127.0.0.1'), 'main 의 Node 요청이 쓰는 이 PC 판정도 통째로만');
  t(g({ o: Object.assign({}, O, { db: 'http://127.0.0.1.nip.io:1' }) }).length > 0, '받는 곳이 127.0.0.1.nip.io → 문지기 거절');

  // 스위치
  const cl = [];
  R.applySwitches({ appendSwitch: (...a) => cl.push(a) }, PORT);
  t(cl.some((a) => a[0] === 'no-proxy-server' && a.length === 1), 'applySwitches 가 no-proxy-server 를 건다');
  t(cl.some((a) => a[0] === 'host-resolver-rules' && a[1] === RULES.join(', ')), 'applySwitches 가 문지기가 본 이름 풀이 규칙을 건다');
  t(g({ sw: R.switches(PORT).filter(([n]) => n !== 'no-proxy-server') }).length > 0, 'no-proxy-server 가 빠진 스위치 → 문지기 거절');

  // 인증서
  const verdict = (host, fp) => { let r; R.certVerifier(FP)({ hostname: host, certificate: fp === undefined ? undefined : { fingerprint: fp } }, (x) => { r = x; }); return r; };
  t(verdict(R.RTDB_HOST, FP) === 0, '운영 RTDB 이름 + 중계 인증서 → 받음');
  t(verdict(R.RTDB_HOST, OTHER_FP) === -2, '운영 RTDB 이름 + 다른 인증서(진짜 Firebase 자리) → 거절');
  t(verdict(R.RTDB_HOST, undefined) === -2, '운영 RTDB 이름 + 인증서 없음 → 거절');
  t(verdict('www.gstatic.com', OTHER_FP) === -3 && verdict('www.gstatic.com', FP) === -3, '그 밖의 이름은 Chromium 이 원래대로(-3) — 중계 인증서로 바꿔 받지 않는다');
  const notes = [];
  R.certVerifier(FP, (h, fp, r) => notes.push([h, fp, r]))({ hostname: R.RTDB_HOST, certificate: { fingerprint: OTHER_FP } }, () => {});
  t(notes.length === 1 && notes[0][2] === -2, '판정을 기록한다(CERT 줄)');
  t(g({ fingerprint: '' }).length > 0, '지문이 없으면 문지기 거절');

  // 확인용 실행 줄 판정
  const good = [
    ...R.PROBE_PROXY.map((u) => `PROXY ${u} DIRECT`),
    `DNS ${R.SENTINEL_HOST} 127.0.0.1`,
    ...R.GUARD_HOSTS.map(({ host }) => `DNS ${host} ${host === R.RTDB_HOST ? '127.0.0.1' : 'ERR net::ERR_NAME_NOT_RESOLVED'}`),
    `CERT ${R.RTDB_HOST} ${FP} 0`,
    `WSS ${R.PROBE_RELAY_WSS} OPEN`,
    ...R.PROBE_WSS.map((u) => `WSS ${u} ERROR`),
    'PROBE-END',
  ];
  const pp = (lines) => R.probeProblems(lines, FP);
  t(pp(good).length === 0, '확인용 실행 — 모두 맞으면 통과' + (pp(good).length ? ': ' + pp(good).join(' / ') : ''));
  t(R.PROBE_PROXY.includes(`wss://${R.RTDB_HOST}/`) && R.PROBE_PROXY.includes(`https://${R.RTDB_HOST}/`), '프록시 판정을 운영 RTDB 의 wss · https 둘 다 묻는다');
  t(pp(good.map((l) => l.startsWith('PROXY wss') ? l.replace('DIRECT', 'PROXY_127.0.0.1:8888') : l)).length > 0, 'wss 가 프록시로 나감 → 거절');
  t(pp(good.map((l) => l.startsWith('PROXY https') ? l.replace('DIRECT', 'SOCKS5_10.0.0.1:1080') : l)).length > 0, 'https 가 SOCKS 로 나감 → 거절');
  t(pp(good.filter((l) => !l.startsWith('PROXY '))).length > 0, '프록시 판정 줄이 없음 → 거절');
  t(pp(good.map((l) => l.startsWith('CERT ') ? `CERT ${R.RTDB_HOST} ${OTHER_FP} 0` : l)).length > 0, '다른 지문을 받음 → 거절');
  t(pp(good.filter((l) => !l.startsWith('CERT '))).length > 0, '인증서 판정 줄이 없음 → 거절');
  t(pp(good.map((l) => l === `WSS ${R.PROBE_RELAY_WSS} OPEN` ? `WSS ${R.PROBE_RELAY_WSS} ERROR` : l)).length > 0, '중계 wss 가 안 열림 → 거절');
  t(pp(good.map((l) => l === `WSS ${R.PROBE_WSS[0]} ERROR` ? `WSS ${R.PROBE_WSS[0]} OPEN` : l)).length > 0, '막을 wss 가 열림 → 거절');
  t(pp(good.map((l) => l.startsWith('DNS ' + R.SENTINEL_HOST) ? `DNS ${R.SENTINEL_HOST} ERR` : l)).length > 0, '표지 이름이 안 풀림 → 거절');
  t(pp(good.map((l) => l.startsWith('DNS api.together-working.com') ? 'DNS api.together-working.com 203.0.113.5' : l)).length > 0, 'API 이름이 진짜 주소로 풀림 → 거절');
  t(pp(good.filter((l) => l !== 'PROBE-END')).length > 0, '확인용 실행이 끝나지 않음 → 거절');
  return out;
}

console.log('── 1. 표 그대로');
const R = load(SRC);
for (const x of cases(R)) chk(x.ok, x.msg);

console.log('\n── 2. 일부러 다르게 넣은 입력 → 문지기 거절');
const RULES = R.resolverRules(PORT);
const g = (over) => R.guard(Object.assign({ relayPort: PORT, o: O, fingerprint: FP }, over || {}));
for (const r of R.ROUTES) chk(g({ routes: R.ROUTES.filter((x) => x !== r) }).length > 0, `돌리는 표에서 «${r.host}» 를 뺌 → 거절`);
chk(g({ rules: RULES.filter((x) => x !== 'MAP * ~NOTFOUND') }).length > 0, '«모두 못 풂» 규칙을 뺌 → 거절');
chk(g({ rules: RULES.filter((x) => !x.startsWith('MAP ' + R.RTDB_HOST)) }).length > 0, 'RTDB 를 중계로 보내는 규칙을 뺌 → 거절');
chk(g({ rules: RULES.map((x) => x.startsWith('MAP ' + R.RTDB_HOST) ? `MAP ${R.RTDB_HOST} 8.8.8.8:443` : x) }).length > 0, 'RTDB 를 이 PC 밖 주소로 → 거절');
chk(g({ rules: ['EXCLUDE *.googleapis.com', ...RULES] }).length > 0, 'googleapis 를 진짜 DNS 로 → 거절');
chk(g({ rules: RULES.filter((x) => !x.includes(R.SENTINEL_HOST)) }).length > 0, '표지 이름 규칙을 뺌 → 거절');
chk(g({ o: Object.assign({}, O, { auth: 'https://identitytoolkit.googleapis.com' }) }).length > 0, 'Auth 받는 곳을 진짜 주소로 → 거절');
chk(g({ routes: [...R.ROUTES, { host: '*.firebaseio.com', to: 'outside' }], o: Object.assign({}, O, { outside: 'https://together-working-default-rtdb.firebaseio.com' }) }).length > 0, '돌리는 곳이 이 PC 밖인 줄을 더함 → 거절');
chk(g({ hosts: [...R.GUARD_HOSTS, { host: 'www.gstatic.com' }] }).length > 0, '그대로 보내는 이름(gstatic)을 볼 목록에 넣으면 → 거절');

console.log('\n── 3. mutation test — _route012.js 글을 고친 판은 1절이 빨강이어야 한다');
const MUTANTS = [
  ['인증서를 모든 이름에 받음(cb(0))', /    cb\(r\);/, '    cb(0);'],
  ['인증서 판정이 늘 받음', /return pinned && seen === pinned \? 0 : -2;/, 'return 0;'],
  ['no-proxy-server 를 뺌', /, \['no-proxy-server'\]/, ''],
  ['확인용 실행의 DIRECT 요구를 뺌', /if\(px\[u\] !== 'DIRECT'\)/, 'if(false)'],
  ['이 PC 이름의 ^…$ 를 뺌', /const LOCAL_RE = \/\^\(127\\\.0\\\.0\\\.1\|localhost\)\$\/;/, 'const LOCAL_RE = /(127\\.0\\.0\\.1|localhost)/;'],
  ['돌리는 표에서 Auth(identitytoolkit) 줄을 뺌', /  \{ host: 'identitytoolkit\.googleapis\.com', to: 'auth', prefix: true \},\n/, ''],
  ['«모두 못 풂» 규칙을 뺌', /, 'MAP \* ~NOTFOUND'\]/, ']'],
];
for (const [name, re, to] of MUTANTS) {
  if (!re.test(SRC)) { chk(false, `mutation test «${name}» — 고칠 자리를 못 찾음(_route012.js 가 바뀜 · 이 표를 고친다)`); continue; }
  let red;
  try { red = cases(load(SRC.replace(re, to))).filter((x) => !x.ok); } catch (e) { red = [{ msg: '불러오기 실패 ' + e.message }]; }
  chk(red.length > 0, `mutation test «${name}» → 빨강 ${red.length}건${red.length ? ' (예: ' + red[0].msg.slice(0, 120) + ')' : ''}`);
}

console.log(`\n${fail ? '✗' : '✓'} ${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
