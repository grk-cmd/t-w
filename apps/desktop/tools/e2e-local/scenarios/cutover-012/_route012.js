/* _route012.js — cutover-012 의 주소 표 한 벌(electron · 네트워크 없음). _main012.js(시험 앱 main)와 켜기 전 문지기(guard)가 같이 읽는다.
   검사: checks/sim-e2e-cutover-guard.js — 이 파일의 함수를 직접 부르고, 이 파일 글을 고친 mutation test 가 빨강인지까지 본다.

   ・Chromium 스위치(switches · applySwitches) — no-proxy-server: 시스템 프록시(HTTP · SOCKS · PAC)가 있으면 Chromium 은 이름을 스스로 풀지 않고
     프록시에 CONNECT <이름>:443 을 보내 host-resolver-rules 가 듣지 않는다. 그래서 프록시를 끄고, 확인용 실행이 DIRECT 인지 본다
   ・인증서(certDecision · certVerifier) — 운영 RTDB 이름은 이 실행이 만든 중계 인증서(지문 고정)만 받는다. 진짜 Firebase 인증서도 거절한다(두 번째 그물)

   ・이름 풀이(host-resolver-rules) — 운영 RTDB 이름만 이 PC 의 TLS 중계로, localhost · 127.0.0.1 · SDK 받는 곳(www.gstatic.com) 말고는
     모든 이름을 못 풀게(~NOTFOUND) 한다. webRequest 를 거치지 않거나 막기를 놓친 요청(wss 포함)도 진짜 서버에 닿지 못하는 마지막 그물이다
   ・https 처리기 — ROUTES 에 있는 호스트만 이 PC 주소로 돌리고, SDK 받는 곳만 그대로 보내고, 그 밖은 막는다
   ・ws · wss · http — wss 는 운영 RTDB 이름(이름 풀이가 중계로 보냄)만, ws · http 는 이 PC 주소만. 그 밖은 막는다 */
'use strict';

const RTDB_HOST = 'together-working-default-rtdb.asia-southeast1.firebasedatabase.app';
const HELP_HOST = 'help.together-working.com';
const PASS_HOSTS = ['www.gstatic.com'];
const PASS_RE = /^https:\/\/www\.gstatic\.com\/firebasejs\//;
const LOCAL_RE = /^(127\.0\.0\.1|localhost)$/;

// 돌릴 호스트 → 받는 곳(o 의 이름). tag 는 net.txt 에 남길 표시
const ROUTES = [
  { host: 'api.together-working.com', to: 'api', tag: (u) => u.pathname },
  { host: 'identitytoolkit.googleapis.com', to: 'auth', prefix: true },
  { host: 'securetoken.googleapis.com', to: 'auth', prefix: true },
  { host: RTDB_HOST, to: 'db', tag: (u) => 'rtdb' + u.pathname },
  { host: 'firebasestorage.googleapis.com', to: 'storage' },
  { host: '*.cloudfunctions.net', to: 'api', fn: true },
];

// 앱이 쓸 수 있는 Firebase · 우리 백엔드 이름 — 문지기가 하나하나 «이 PC 로만 · 아니면 막힘» 인지 본다.
// routed: 앱이 돌아가려면 이 PC 로 돌려져 있어야 하는 이름(표에서 빠지면 켜기 전에 알린다)
const GUARD_HOSTS = [
  { host: RTDB_HOST, routed: true },
  { host: 'identitytoolkit.googleapis.com', routed: true },
  { host: 'securetoken.googleapis.com', routed: true },
  { host: 'firebasestorage.googleapis.com', routed: true },
  { host: 'asia-southeast1-together-working.cloudfunctions.net', routed: true },
  { host: 'api.together-working.com', routed: true },
  { host: 's-gke-apse1-nssi2-0.asia-southeast1.firebasedatabase.app' },   // Firebase(Google) 공용 서버 이름 — RTDB 가 handshake 로 넘겨주는 안쪽 이름
  { host: 'together-working-dev-default-rtdb.asia-southeast1.firebasedatabase.app' },
  { host: 'together-working-default-rtdb.firebaseio.com' },
  { host: 'firestore.googleapis.com' },
  { host: 'firebaseinstallations.googleapis.com' },
  { host: 'together-working.firebaseapp.com' },
  { host: 'together-working.web.app' },
  { host: 'api-dev.together-working.com' },
  { host: 'realtime.together-working.com' },
  { host: 'rooms.togetherworking.duckdns.org' },
  { host: 'rooms-dev.togetherworking.duckdns.org' },
  { host: 'api.github.com' },
  { host: 'github.com' },
];

const matchHost = (pat, h) => pat === '*' || pat === h || (pat.startsWith('*.') && h.endsWith(pat.slice(1)));

// 표지 이름 — .invalid 라 밖의 DNS 가 답하지 않는다. 확인용 실행이 이 이름이 127.0.0.1 로 풀리는지로 «크로미움이 규칙을 쓴다» 를 먼저 본다
const SENTINEL_HOST = 'tw-e2e-guard.invalid';
// 확인용 실행이 열어 보는 wss — 막혀야 한다(이름 풀이도 ~NOTFOUND 라 막기를 놓쳐도 밖에 닿지 않는다)
const PROBE_WSS = ['wss://s-gke-apse1-nssi2-0.asia-southeast1.firebasedatabase.app/.ws?v=5', 'wss://together-working-default-rtdb.firebaseio.com/.ws?v=5'];
// 확인용 실행이 프록시 판정(resolveProxy)을 묻는 주소 — 둘 다 DIRECT 여야 다음 단계로 간다
const PROBE_PROXY = [`wss://${RTDB_HOST}/`, `https://${RTDB_HOST}/`];
// 확인용 실행이 중계로 열어 보는 wss — 열려야 한다(인증서 고정이 중계 인증서를 받는지)
const PROBE_RELAY_WSS = `wss://${RTDB_HOST}/.ws?v=5&ns=together-working-default-rtdb`;

function resolverRules(relayPort){
  return [`MAP ${SENTINEL_HOST} 127.0.0.1:9`, `MAP ${RTDB_HOST} 127.0.0.1:${relayPort}`, 'EXCLUDE localhost', 'EXCLUDE 127.0.0.1', ...PASS_HOSTS.map((h) => 'EXCLUDE ' + h), 'MAP * ~NOTFOUND'];
}

// 시험 앱 · 확인용 실행 main 에 거는 Chromium 스위치 — [이름, 값?]. 이 목록이 한 벌이다(sim 이 no-proxy-server 를 본다)
function switches(relayPort){
  return [['host-resolver-rules', resolverRules(relayPort).join(', ')], ['no-proxy-server']];
}
function applySwitches(commandLine, relayPort){
  for(const [name, value] of switches(relayPort)) value === undefined ? commandLine.appendSwitch(name) : commandLine.appendSwitch(name, value);
}

/* 인증서 판정 — 운영 RTDB 이름은 고정한 지문(중계 인증서 · _kit.js selfCert)과 같을 때만 0(받음), 다르면 -2(거절 — 진짜 Firebase 인증서 포함).
   그 밖의 이름은 -3(Chromium 이 원래대로 확인 — SDK 받는 www.gstatic.com 등) */
function certDecision(host, seen, pinned){
  if(host !== RTDB_HOST) return -3;
  return pinned && seen === pinned ? 0 : -2;
}
// setCertificateVerifyProc 에 거는 함수. note(host, 지문, 판정) — 판정을 기록하는 곳(없으면 안 남김)
function certVerifier(pinned, note){
  return (req, cb) => {
    const seen = req.certificate && req.certificate.fingerprint;
    const r = certDecision(req.hostname, seen, pinned);
    if(note && req.hostname === RTDB_HOST) note(req.hostname, seen, r);
    cb(r);
  };
}

/* host-resolver-rules 를 크로미움처럼 읽는다 — EXCLUDE 에 맞으면 그대로(null = 진짜 DNS), 아니면 처음 맞는 MAP 의 값. 맞는 것이 없으면 null */
function resolveRule(host, rules){
  const parsed = rules.map((r) => r.trim().split(/\s+/));
  if(parsed.some(([k, p]) => k === 'EXCLUDE' && matchHost(p, host))) return null;
  const m = parsed.find(([k, p]) => k === 'MAP' && matchHost(p, host));
  return m ? m[2] : null;
}

/* 주소 하나를 어떻게 다루나 — { kind: 'route', to, tag } · 'help' · 'pass' · 'relay'(wss → 이름 풀이가 중계로) · 'local' · 'block'.
   o: { api, auth, db, storage } — 받는 곳 주소(http://127.0.0.1:포트) */
function classify(raw, o, routes = ROUTES){
  let u; try { u = new URL(raw); } catch(_){ return { kind: 'block' }; }
  if(['file:', 'data:', 'blob:', 'devtools:', 'chrome-extension:'].includes(u.protocol)) return { kind: 'local' };
  if(u.protocol === 'https:'){
    const r = routes.find((x) => matchHost(x.host, u.hostname));
    if(r){
      const base = o[r.to];
      const to = r.fn ? base + '/__fn/' + u.hostname + u.pathname
        : r.prefix ? base + '/' + u.hostname + u.pathname + u.search
        : base + u.pathname + u.search;
      return { kind: 'route', to, tag: r.tag ? r.tag(u) : u.hostname + u.pathname };
    }
    if(u.hostname === HELP_HOST) return { kind: 'help' };
    if(PASS_RE.test(raw)) return { kind: 'pass' };
    return { kind: 'block' };
  }
  if(u.protocol === 'wss:') return u.hostname === RTDB_HOST ? { kind: 'relay' } : { kind: 'block' };
  if(u.protocol === 'ws:' || u.protocol === 'http:') return LOCAL_RE.test(u.hostname) ? { kind: 'local' } : { kind: 'block' };
  return { kind: 'block' };
}

/* 켜기 전 문지기 — GUARD_HOSTS 의 이름마다 이름 풀이 · https · wss 가 이 PC 로만 가거나 막히는지. 문제를 글로 돌려준다(빈 배열 = 켜도 됨) */
function guard({ relayPort, o, fingerprint, rules = resolverRules(relayPort), routes = ROUTES, hosts = GUARD_HOSTS, sw = switches(relayPort) }){
  const bad = [];
  if(!sw.some(([n]) => n === 'no-proxy-server')) bad.push('no-proxy-server 스위치가 없음 — 시스템 프록시가 있으면 이름 풀이 규칙을 건너뛴다');
  const hr = sw.find(([n]) => n === 'host-resolver-rules');
  if(!hr || hr[1] !== rules.join(', ')) bad.push('host-resolver-rules 스위치가 문지기가 본 규칙과 다름');
  if(!/^sha256\/[A-Za-z0-9+/]{43}=$/.test(fingerprint || '')) bad.push('중계 인증서 지문이 없음 — 운영 RTDB 이름의 인증서를 고정할 수 없다');
  else if(certDecision(RTDB_HOST, 'sha256/' + 'A'.repeat(43) + '=', fingerprint) === 0) bad.push('운영 RTDB 이름에 다른 인증서도 받음');
  const localUrl = (s) => { try { return LOCAL_RE.test(new URL(s).hostname); } catch(_){ return false; } };
  for(const k of ['api', 'auth', 'db', 'storage']) if(!localUrl(o[k])) bad.push(`받는 곳 ${k} 가 이 PC 주소가 아님: ${o[k]}`);
  if(resolveRule(SENTINEL_HOST, rules) !== '127.0.0.1:9') bad.push(`표지 이름 ${SENTINEL_HOST} 규칙이 없음 — 확인용 실행이 규칙이 걸렸는지 볼 수 없다`);
  for(const url of PROBE_WSS) if(classify(url, o, routes).kind !== 'block') bad.push(`확인용 wss ${url} 를 막지 않음`);
  for(const { host, routed } of hosts){
    const dns = resolveRule(host, rules);
    const wantDns = host === RTDB_HOST ? `127.0.0.1:${relayPort}` : '~NOTFOUND';
    if(dns !== wantDns) bad.push(`${host} 이름 풀이가 ${dns || '진짜 DNS'} (기대 ${wantDns})`);
    const h = classify(`https://${host}/.guard`, o, routes);
    if(h.kind === 'route' && !localUrl(h.to)) bad.push(`${host} https 를 이 PC 밖으로 돌림: ${h.to}`);
    if(h.kind === 'pass' || h.kind === 'local') bad.push(`${host} https 를 그대로 보냄`);
    if(routed && h.kind !== 'route') bad.push(`${host} 가 돌리는 표에 없음 — 앱이 이 PC 의 에뮬레이터 · stub 에 못 닿는다`);
    const w = classify(`wss://${host}/.ws`, o, routes);
    if(w.kind !== 'block' && !(w.kind === 'relay' && host === RTDB_HOST && dns === wantDns)) bad.push(`${host} wss 를 막지 않음`);
  }
  return bad;
}

/* 확인용 실행(_main012.js probe)이 남긴 줄을 판정한다 — 문제를 글로(빈 배열 = 켜도 됨).
   PROXY: 운영 RTDB 의 wss · https 가 DIRECT 여야 한다(프록시면 이름 풀이 규칙이 안 듣는다) · DNS: 표지 이름이 규칙대로 풀린 뒤 RTDB 만 127.0.0.1, 나머지는 못 풂 ·
   CERT: 중계 인증서를 받음(0) · WSS: RTDB 는 중계로 열림, 막을 wss 는 ERROR */
function probeProblems(lines, fingerprint){
  const why = [];
  const kv = (tag) => Object.fromEntries(lines.filter((l) => l.startsWith(tag + ' ')).map((l) => { const [, k, ...v] = l.split(' '); return [k, v.join(' ')]; }));
  if(!lines.includes('PROBE-END')) why.push('확인용 실행이 끝나지 않음');
  const px = kv('PROXY');
  for(const u of PROBE_PROXY) if(px[u] !== 'DIRECT') why.push(`${u} 프록시 판정이 DIRECT 가 아님(${px[u] || '안 물음'})`);
  const dns = kv('DNS');
  if(dns[SENTINEL_HOST] !== '127.0.0.1') why.push(`표지 이름이 규칙대로 안 풀림(${dns[SENTINEL_HOST]}) — Chromium 이 규칙을 안 쓴다`);
  else for(const { host } of GUARD_HOSTS){
    const v = dns[host];
    if(host === RTDB_HOST ? v !== '127.0.0.1' : !/NAME_NOT_RESOLVED/.test(v || '')) why.push(`${host} → ${v || '안 물음'}`);
  }
  const cert = lines.filter((l) => l.startsWith('CERT '));
  if(!cert.length || !cert.every((l) => l === `CERT ${RTDB_HOST} ${fingerprint} 0`)) why.push('운영 RTDB 이름의 인증서 판정이 «고정 지문 · 받음» 이 아님: ' + (cert.join(' | ') || '없음'));
  const ws = kv('WSS');
  if(ws[PROBE_RELAY_WSS] !== 'OPEN') why.push(`중계 wss → ${ws[PROBE_RELAY_WSS] || '안 열어 봄'}`);
  for(const url of PROBE_WSS) if(ws[url] !== 'ERROR') why.push(`막을 wss ${url} → ${ws[url] || '안 열어 봄'}`);
  return why;
}

module.exports = { RTDB_HOST, SENTINEL_HOST, PROBE_WSS, PROBE_PROXY, PROBE_RELAY_WSS, HELP_HOST, PASS_RE, LOCAL_RE, ROUTES, GUARD_HOSTS,
  resolverRules, resolveRule, classify, guard, matchHost, switches, applySwitches, certDecision, certVerifier, probeProblems };
