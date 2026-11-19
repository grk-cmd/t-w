/* sim-e2e-cutover-guard.js — e2e cutover-012(운영 0.12.3 을 이 PC 에뮬레이터에 붙여 돌림)의 켜기 전 문지기
   실행: node checks/run.js e2e-cutover-guard
   [왜] 그 묶음은 운영 앱을 운영 설정 그대로 켠다. 주소 표(apps/desktop/tools/e2e-local/scenarios/cutover-012/_route012.js)에서
     한 줄만 빠져도 시험 요청이 진짜 운영 서버(RTDB · Auth · API)로 나간다 — webRequest 의 redirect 는 wss 에 듣지 않아 실제로 한 번 나갔다.
     그래서 앱을 켜기 전에 문지기(guard)가 표를 보고, 앱이 쓸 수 있는 Firebase · 우리 백엔드 이름이 이름 풀이 · https · wss 모두
     이 PC 로만 가거나 막히는지 확인하고, 아니면 켜지 않는다.
   [무엇을 본다] 1절: 표 그대로면 문지기가 통과. 2절: 이름 풀이 규칙 읽기(EXCLUDE 가 먼저 · 처음 맞는 MAP).
     3절: 주소 판정(https 돌리기 · 그대로 · 막기 · wss · http). 4절: 일부러 깸 — 돌리는 표에서 한 줄씩 빼기 · 모두 못 풀게 하는 규칙 빼기 ·
     RTDB 를 중계 밖으로 · 받는 곳을 이 PC 밖으로 · googleapis 를 진짜 DNS 로 · 표지 이름 빼기 · 확인용 wss 열기 → 문지기가 거절(빨강이 나는지).
     네트워크는 쓰지 않는다(표 · 함수만). 크로미움이 정말 그렇게 푸는지는 시나리오가 켜기 전에 확인용 실행으로 본다(_kit.js guardLaunch). */
'use strict';
const fs = require('fs');
const path = require('path');

const REL = path.join('tools', 'e2e-local', 'scenarios', 'cutover-012', '_route012.js');
const file = [REL, path.join(__dirname, '..', 'apps', 'desktop', REL)].find((f) => fs.existsSync(f));
if (!file) { console.log('  ? 원본 못 찾음 — ' + REL); process.exit(2); }
const R = require(path.resolve(file));

let pass = 0, fail = 0;
const chk = (ok, msg) => { if (ok) pass++; else fail++; console.log(`  ${ok ? '✓' : '✗'} ${msg}`); };

const PORT = 41234;
const O = { api: 'http://127.0.0.1:41001', auth: 'http://127.0.0.1:41002', db: 'http://127.0.0.1:41003', storage: 'http://127.0.0.1:41004' };
const RULES = R.resolverRules(PORT);
const g = (over) => R.guard(Object.assign({ relayPort: PORT, o: O }, over || {}));

console.log('── 1. 표 그대로');
const ok = g();
chk(ok.length === 0, '문지기 통과' + (ok.length ? ': ' + ok.join(' / ') : ''));
for (const h of ['identitytoolkit.googleapis.com', 'securetoken.googleapis.com', 'firebasestorage.googleapis.com', 'api.together-working.com', 'asia-southeast1-together-working.cloudfunctions.net', R.RTDB_HOST])
  chk(R.GUARD_HOSTS.some((x) => x.host === h && x.routed), `${h} 를 «이 PC 로 돌려야 하는 이름» 으로 본다`);
for (const h of ['s-gke-apse1-nssi2-0.asia-southeast1.firebasedatabase.app', 'together-working-default-rtdb.firebaseio.com'])
  chk(R.GUARD_HOSTS.some((x) => x.host === h && !x.routed), `${h}(돌리지 않는 Firebase 이름)도 본다`);

console.log('\n── 2. 이름 풀이 규칙 읽기');
chk(R.resolveRule(R.RTDB_HOST, RULES) === '127.0.0.1:' + PORT, '운영 RTDB 이름 → 중계');
chk(R.resolveRule(R.SENTINEL_HOST, RULES) === '127.0.0.1:9', '표지 이름 → 127.0.0.1:9');
for (const h of ['identitytoolkit.googleapis.com', 'api.together-working.com', 'x.firebaseio.com', 'anything.example'])
  chk(R.resolveRule(h, RULES) === '~NOTFOUND', `${h} → ~NOTFOUND`);
chk(R.resolveRule('www.gstatic.com', RULES) === null && R.resolveRule('localhost', RULES) === null, 'www.gstatic.com · localhost 는 그대로(EXCLUDE)');
chk(R.resolveRule('a.b', ['MAP a.b 1.1.1.1:1', 'MAP * ~NOTFOUND']) === '1.1.1.1:1', '처음 맞는 MAP 이 이긴다');
chk(R.resolveRule('a.b', ['EXCLUDE a.b', 'MAP a.b 1.1.1.1:1']) === null, 'EXCLUDE 가 MAP 보다 먼저');
chk(R.resolveRule('x.y.z', ['MAP *.y.z ~NOTFOUND']) === '~NOTFOUND' && R.resolveRule('y.z', ['MAP *.y.z ~NOTFOUND']) === null, '*.꼬리 는 그 아래 이름만');

console.log('\n── 3. 주소 판정');
const c = (u) => R.classify(u, O);
chk(c('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=k').to === O.auth + '/identitytoolkit.googleapis.com/v1/accounts:lookup?key=k', 'Auth → 에뮬레이터(원래 호스트를 앞에)');
chk(c('https://api.together-working.com/v1/config').to === O.api + '/v1/config', 'API → stub');
chk(c(`https://${R.RTDB_HOST}/.lp?x=1`).to === O.db + '/.lp?x=1', 'RTDB https → 에뮬레이터');
chk(c('https://asia-southeast1-together-working.cloudfunctions.net/visitPing').to === O.api + '/__fn/asia-southeast1-together-working.cloudfunctions.net/visitPing', '함수 → stub');
chk(c('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js').kind === 'pass', 'SDK 파일만 그대로');
chk(c('https://www.gstatic.com/other.js').kind === 'block', 'gstatic 의 다른 길은 막음');
chk(c('https://firestore.googleapis.com/x').kind === 'block' && c('https://example.com/').kind === 'block', '표에 없는 https 는 막음');
chk(c(`wss://${R.RTDB_HOST}/.ws`).kind === 'relay', 'wss 는 운영 RTDB 이름만(이름 풀이가 중계로)');
chk(c('wss://s-gke-apse1-nssi2-0.asia-southeast1.firebasedatabase.app/.ws').kind === 'block' && c('wss://x.together-working.com/').kind === 'block', '그 밖의 wss 는 막음');
chk(c('ws://127.0.0.1:8787/').kind === 'local' && c('http://localhost:1/').kind === 'local', '이 PC 의 ws · http 는 둠');
chk(c('http://api.together-working.com/').kind === 'block' && c('ws://example.com/').kind === 'block', '밖의 ws · http 는 막음');

console.log('\n── 4. 일부러 깸 → 문지기 거절');
for (const r of R.ROUTES) chk(g({ routes: R.ROUTES.filter((x) => x !== r) }).length > 0, `돌리는 표에서 «${r.host}» 를 뺌 → 거절`);
chk(g({ rules: RULES.filter((x) => x !== 'MAP * ~NOTFOUND') }).length > 0, '«모두 못 풀게» 규칙을 뺌 → 거절');
chk(g({ rules: RULES.filter((x) => !x.startsWith('MAP ' + R.RTDB_HOST)) }).length > 0, 'RTDB 를 중계로 보내는 규칙을 뺌 → 거절');
chk(g({ rules: RULES.map((x) => x.startsWith('MAP ' + R.RTDB_HOST) ? `MAP ${R.RTDB_HOST} 8.8.8.8:443` : x) }).length > 0, 'RTDB 를 이 PC 밖 주소로 → 거절');
chk(g({ rules: ['EXCLUDE *.googleapis.com', ...RULES] }).length > 0, 'googleapis 를 진짜 DNS 로 → 거절');
chk(g({ rules: RULES.filter((x) => !x.includes(R.SENTINEL_HOST)) }).length > 0, '표지 이름 규칙을 뺌 → 거절');
chk(g({ o: Object.assign({}, O, { auth: 'https://identitytoolkit.googleapis.com' }) }).length > 0, 'Auth 받는 곳을 진짜 주소로 → 거절');
chk(g({ routes: [...R.ROUTES, { host: '*.firebaseio.com', to: 'outside' }], o: Object.assign({}, O, { outside: 'https://together-working-default-rtdb.firebaseio.com' }) }).length > 0, '돌리는 곳이 이 PC 밖인 줄을 더함 → 거절');
chk(g({ hosts: [...R.GUARD_HOSTS, { host: 'www.gstatic.com' }] }).length > 0, '그대로 보내는 이름(gstatic)을 볼 목록에 넣으면 → 거절(문지기가 «그대로» 를 잡는다)');

console.log(`\n${fail ? '✗' : '✓'} ${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
