/*
 * IP 기준 일일 방문자 검사. functions/visit-ping.js 와 앱 visit-ping.js 를 그대로 불러 돌린다.
 * 1. 접속 IP 고르기  2. 해시(날마다 · 비밀마다 다름)  3. 쓰기 묶음 · 처리기(가짜 DB)  4. index.js 연결 · 규칙
 * 5. 앱 모듈(한 번 · 늦게 · 실패 삼킴 · 버전)  6. firebase-init.js 연결 · CSP
 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = (...names) => { for(const n of names){ const s = read(n); if(s != null) return s; } say('  ? 원본 못 찾음 — ' + names[0]); process.exit(2); };
const RULES = need('firebase-database-rules.json');
const FX = need('functions/index.js');
const VP = need('functions/visit-ping.js');
const AVP = need('visit-ping.js', 'parts/visit-ping.js', 'app/parts/visit-ping.js');
const FI = need('firebase-init.js', 'parts/firebase-init.js', 'app/parts/firebase-init.js');
const HTML = need('desk-companion-prototype.html', 'app/desk-companion-prototype.html');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const app = new Function(AVP.replace(/^export (function|const) /mg, '$1 ') + '\nreturn { createVisitPing, VISIT_PING_DELAY_MS, VISIT_PING_FLAG };')();

(async () => {
  const f = require(path.resolve('functions/visit-ping.js'));
  const T = (iso) => Date.parse(iso);
  const INC = (n) => ({ inc: n });
  const S = 'test-secret';

  say('── 1. 접속 IP (clientIp)');
  {
    chk(f.clientIp({ headers: { 'x-forwarded-for': ' 9.9.9.9 , 203.0.113.7 ' }, ip: '9.9.9.9' }) === '203.0.113.7', 'x-forwarded-for 맨 뒤(프런트엔드가 붙인 실제 주소) · 앞뒤 빈칸 걷음 — 맨 앞은 지어낼 수 있다');
    chk(f.clientIp({ headers: { 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 198.51.100.2' } }) === '198.51.100.2' && f.clientIp({ headers: { 'x-forwarded-for': '198.51.100.2' } }) === '198.51.100.2', '  ↳ 가짜 값을 앞에 몇 개 붙여도 같은 IP (dev 실측: "9.9.9.9,실제IP")');
    chk(f.clientIp({ headers: { 'x-forwarded-for': ['10.0.0.1', '198.51.100.2'] } }) === '198.51.100.2', '  ↳ 헤더가 배열로 와도 맨 뒤');
    chk(f.clientIp({ headers: {}, ip: '::ffff:192.0.2.5' }) === '192.0.2.5', '헤더가 없으면 rawRequest.ip · IPv6 에 싸인 IPv4(::ffff:) 는 벗긴다');
    chk(f.clientIp({ headers: { 'x-forwarded-for': '::FFFF:192.0.2.6' } }) === '192.0.2.6', '  ↳ 대문자 ::FFFF: 도');
    chk(f.clientIp({ headers: { 'x-forwarded-for': '2001:db8::1' } }) === '2001:db8::1', 'IPv6 는 그대로');
    chk(f.clientIp({ headers: { 'x-forwarded-for': '' }, ip: '' }) === null && f.clientIp({}) === null && f.clientIp(null) === null && f.clientIp(undefined) === null,
      '없거나 빈 값이면 null — 아무것도 안 쓴다');
  }

  say('── 2. 해시 (ipHash)');
  {
    const h = f.ipHash('203.0.113.7', '2026-10-07', S);
    chk(/^[0-9a-f]{16}$/.test(h) && f.IP_HASH_LEN === 16, '16자 16진수');
    chk(h === f.ipHash('203.0.113.7', '2026-10-07', S), '같은 IP · 같은 날 · 같은 비밀 → 같은 해시 (하루 1번)');
    chk(h === require('crypto').createHmac('sha256', S).update('2026-10-07|203.0.113.7').digest('hex').slice(0, 16), '  ↳ HMAC-SHA256(비밀, «날짜|IP») 앞 16자');
    chk(h !== f.ipHash('203.0.113.7', '2026-10-08', S), '날이 바뀌면 다른 해시 — 다른 날끼리 같은 사람을 이을 수 없다');
    chk(h !== f.ipHash('203.0.113.7', '2026-10-07', 'other'), '비밀이 다르면 다른 해시 — 비밀 없이 IPv4 전체를 돌려 맞출 수 없다');
    chk(h !== f.ipHash('203.0.113.8', '2026-10-07', S), '다른 IP 는 다른 해시');
  }

  say('── 3. 쓰기 묶음 · 처리기');
  {
    const now = T('2026-10-06T15:00:00Z');   // 서울 10-07 00:00
    const u = f.visitPingUpdates('203.0.113.7', now, S, INC);
    const hk = 'metrics/daily/2026-10-07/ip/' + f.ipHash('203.0.113.7', '2026-10-07', S);
    chk(JSON.stringify(u) === JSON.stringify({ [hk]: true, 'metrics/daily/2026-10-07/pings': { inc: 1 } }), 'IP 해시 표시 true + pings +1 — 두 경로뿐 · 서울 날짜');
    chk(!JSON.stringify(u).includes('203.0.113.7'), '★ IP 원문은 어디에도 안 적는다');
    chk(f.visitPingUpdates(null, now, S, INC) === null && f.visitPingUpdates('', now, S, INC) === null, 'IP 가 없으면 null');

    const mkDb = () => { const L = []; return { L, db: { ref: (p) => ({ update: async (v) => { L.push([p, v]); } }) } }; };
    const req = (xff) => ({ rawRequest: { headers: { 'x-forwarded-for': xff } }, data: { ver: '0.10.4' } });
    let { db, L } = mkDb();
    await f.runVisitPing(db, req('203.0.113.7'), now, S, INC);
    chk(L.length === 1 && L[0][0] === undefined && L[0][1][hk] === true, '한 번의 루트 update — 해시 표시와 pings 가 같이 되거나 같이 안 된다');
    await f.runVisitPing(db, req('203.0.113.7'), now, S, INC);
    chk(L.length === 2 && Object.keys(L[1][1])[0] === hk, '같은 날 다시 켜면 pings 는 또 세고 IP 표시는 같은 키(1명)');
    ({ db, L } = mkDb());
    await f.runVisitPing(db, req('203.0.113.7'), now, '', INC);
    chk(L.length === 0, '★ 비밀 값이 없으면(시크릿 설정 전) 적지 않는다 — 비밀 없는 해시는 되돌릴 수 있다');
    await f.runVisitPing(db, { rawRequest: { headers: {} } }, now, S, INC);
    await f.runVisitPing(db, {}, now, S, INC);
    chk(L.length === 0, 'IP 를 못 찾으면 적지 않는다');
    const top = strip(VP).split('\n').filter(l => /^const[^\n]*require\(/.test(l)).join('\n');
    chk(!/firebase-admin/.test(top), 'visit-ping.js 는 firebase-admin 을 맨 위에서 읽지 않는다 (배포 때 10초 로딩 제한)');
    chk(/require\('\.\/daily-active'\)/.test(VP) && !/KST_OFFSET_MS\s*=/.test(VP), '서울 날짜는 daily-active.js 의 kstDateKey 를 같이 쓴다');
  }

  say('── 4. index.js 연결 · 규칙');
  {
    const CODE = strip(FX);
    const m = CODE.match(/exports\.visitPing = onCall\(\{([^}]*)\},\s*async \(request\) => \{[\s\S]*?\n  \}\);/);
    chk(!!m, 'visitPing = onCall(호출형)');
    const opts = m ? m[1] : '';
    chk(/secrets: \[METRICS_IP_SALT\]/.test(opts) && /enforceAppCheck: false/.test(opts) && /timeoutSeconds: 10/.test(opts) && /maxInstances: 5/.test(opts),
      '  ↳ 비밀 METRICS_IP_SALT · App Check 안 봄 · 10초 · 인스턴스 5');
    chk(/const METRICS_IP_SALT = defineSecret\('METRICS_IP_SALT'\);/.test(CODE) && /\{ defineSecret \} = require\('firebase-functions\/params'\)/.test(CODE),
      '  ↳ defineSecret(firebase-functions/params)');
    chk(!!m && !/request\.auth/.test(m[0]) && !/HttpsError/.test(m[0]), '★ 인증을 보지 않는다 — 로그인하지 않은 사람도 센다 · 오류를 던지지 않는다');
    chk(!!m && /runVisitPing\(getDatabase\(\), request, Date\.now\(\), METRICS_IP_SALT\.value\(\)\)/.test(m[0]), '  ↳ 처리는 visit-ping.js 에 맡긴다');
    chk(!!m && /return \{ ok: true \};\s*\n  \}\);$/.test(m[0]) && (m[0].match(/return /g) || []).length === 1, '  ↳ 돌려주는 것은 늘 { ok: true } 하나 — 아무것도 새지 않는다');
    chk(!!m && /catch \(e\)/.test(m[0]), '  ↳ 실패도 삼킨다');
    chk(!!m && /require\('firebase-admin\/database'\)/.test(m[0]) && !/^const[^\n]*require\('firebase-admin\/database'\)/m.test(CODE), '  ↳ firebase-admin/database 는 실행할 때 읽는다');
    chk(!!m && !/console\.[a-z]+\([^)]*(ip|rawRequest|headers)/i.test(m[0]), '  ↳ IP 를 로그에 남기지 않는다');
    chk(/visitPing — IP 기준 일일 방문자/.test(FX), '  ↳ 머리 주석의 함수 목록에도 적었다');
    let rules = null; try{ rules = JSON.parse(RULES).rules; }catch(_){}
    const mr = rules && rules.metrics;
    chk(!!mr && /admins.*auth\.uid/.test(mr['.read']) && !JSON.stringify(Object.assign({}, mr, { improvements: undefined })).includes('.write'), '규칙: metrics(ip · pings 포함) 읽기 관리자만 · 쓰기 규칙 없음(함수만 쓴다)');
  }

  say('── 5. 앱 모듈 (visit-ping.js)');
  {
    const { createVisitPing, VISIT_PING_DELAY_MS, VISIT_PING_FLAG } = app;
    const mkWin = () => { const w = { timers: [], setTimeout: (fn, ms) => { w.timers.push({ fn, ms }); return 1; } }; return w; };
    const flush = () => new Promise(r => setTimeout(r, 0));
    chk(VISIT_PING_DELAY_MS >= 5000 && VISIT_PING_DELAY_MS <= 15000, '기본 대기 ' + VISIT_PING_DELAY_MS / 1000 + '초 — 부팅이 붐비는 때를 피한다');

    let w = mkWin(), calls = [];
    const p = createVisitPing({ callPing: async (d) => { calls.push(d); return { data: { ok: true } }; }, getVersion: async () => '0.10.4', win: w });
    chk(p.start() === true && calls.length === 0 && w.timers.length === 1 && w.timers[0].ms === VISIT_PING_DELAY_MS, '★ start 즉시 부르지 않고 대기 뒤에');
    w.timers[0].fn(); await flush(); await flush();
    chk(calls.length === 1 && JSON.stringify(calls[0]) === '{"ver":"0.10.4"}', '  ↳ 대기 뒤 한 번 — 버전만 싣는다');
    chk(p.start() === false && w.timers.length === 1, '★ 두 번째 start 는 아무것도 안 한다');
    const p2 = createVisitPing({ callPing: async (d) => { calls.push(d); }, getVersion: async () => 'x', win: w });
    chk(p2.start() === false && w.timers.length === 1 && w[VISIT_PING_FLAG] === true, '  ↳ 새로 만든 것도(firebase-init 재시도) 창 표시를 보고 그만둔다');

    w = mkWin(); calls = [];
    createVisitPing({ callPing: async (d) => { calls.push(d); }, getVersion: async () => null, win: w, delayMs: 5 }).start();
    chk(w.timers[0].ms === 5, 'delayMs 를 바꿔 끼울 수 있다');
    w.timers[0].fn(); await flush(); await flush();
    chk(calls.length === 1 && JSON.stringify(calls[0]) === '{}', '버전을 모르면 빈 data 로 부른다');

    let threw = 0, n = 0;
    const onErr = () => { threw++; };
    process.on('unhandledRejection', onErr);
    for (const bad of [
      { callPing: async () => { n++; throw new Error('not-found'); }, getVersion: async () => '1' },
      { callPing: () => { n++; throw new Error('sync'); }, getVersion: async () => '1' },
      { callPing: async () => { n++; }, getVersion: () => { throw new Error('ipc'); } },
      { callPing: async () => { n++; }, getVersion: () => Promise.reject(new Error('ipc')) },
    ]){
      w = mkWin();
      createVisitPing(Object.assign({ win: w }, bad)).start();
      w.timers[0].fn();
    }
    await flush(); await flush(); await flush();
    process.removeListener('unhandledRejection', onErr);
    chk(threw === 0 && n === 4, '★ 함수 실패 · 동기 예외 · 버전 실패 — 전부 삼킨다(앱에 아무 영향 없음) · 버전 실패해도 부른다');
    chk(!/setInterval|retry|for\s*\(|while\s*\(/.test(strip(AVP)), '다시 시도하지 않는다 — 반복 · 주기 호출 없음');
    chk(!/from\s+["']https:|firebase/i.test(strip(AVP).replace(/firebase-init/g, '')), 'Firebase 를 직접 불러오지 않는다 — 부르는 방법은 deps 로 받는다');
  }

  say('── 6. firebase-init.js 연결 · CSP');
  {
    const CODE = strip(FI);
    chk(/import \{ createVisitPing \} from "\.\/visit-ping\.js";/.test(CODE), 'visit-ping.js 를 불러온다');
    const w = CODE.match(/createVisitPing\(\{([\s\S]*?)\n  \}\)\.start\(\);/);
    chk(!!w, '만들자마자 start — 로그인을 기다리지 않는다');
    chk(!!w && /await import\(FUNCTIONS_SDK_URL\)/.test(w[1]) && /httpsCallable\(mod\.getFunctions\(fbApp, FUNCTIONS_REGION\), 'visitPing'\)\(data\)/.test(w[1]),
      '  ↳ 함수 SDK 는 부를 때 들여와 visitPing 을 부른다(changePassword 와 같은 리전 · 같은 판)');
    chk(!!w && /getVersion: \(\) => _appVer\.ready/.test(w[1]), '  ↳ 버전은 app-version 이 다듬은 값');
    chk(!!w && !/_whenAuthReady|auth\.currentUser/.test(w[1]), '  ↳ 로그인 상태를 보지 않는다');
    chk((CODE.match(/createVisitPing\(/g) || []).length === 1, '부르는 자리는 한 곳');
    chk(!/^\s*import[^\n]*firebase-functions\.js/m.test(FI), '★ 함수 SDK 는 맨 위에서 import 하지 않는다 — 못 받으면 파일 전체가 죽는다');
    const region = (FI.match(/const FUNCTIONS_REGION = '([^']+)'/) || [])[1];
    const csp = [...HTML.matchAll(/connect-src ([^;]+);/g)].map(x => x[1]);
    chk(!!region && csp.length > 0 && csp.every(c => c.includes('https://' + region + '-together-working.cloudfunctions.net')),
      'CSP connect-src 에 운영 함수 호스트(' + region + ') — 호출형 URL 이 막히지 않는다');
  }

  say(`\n${pass} · ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { say('  ✗ 검사가 던졌다: ' + (e && e.stack || e)); process.exit(1); });
