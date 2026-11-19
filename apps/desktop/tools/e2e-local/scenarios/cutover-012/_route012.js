/* _route012.js — cutover-012 의 주소 표 한 벌(electron · 네트워크 없음). _main012.js(시험 앱 main)와 켜기 전 문지기(guard)가 같이 읽는다.
   검사: checks/sim-e2e-cutover-guard.js(표에서 한 줄을 빼면 문지기가 켜기를 거절하는지까지).

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
  { host: 's-gke-apse1-nssi2-0.asia-southeast1.firebasedatabase.app' },   // RTDB 가 handshake 로 넘겨주는 안쪽 이름 모양
  { host: 'together-working-dev-default-rtdb.asia-southeast1.firebasedatabase.app' },
  { host: 'together-working-default-rtdb.firebaseio.com' },
  { host: 'firestore.googleapis.com' },
  { host: 'firebaseinstallations.googleapis.com' },
  { host: 'together-working.firebaseapp.com' },
  { host: 'together-working.web.app' },
  { host: 'api-dev.together-working.com' },
  { host: 'realtime.together-working.com' },
  { host: 'rooms.togetherworking.duckdns.org' },
  { host: 'api.github.com' },
  { host: 'github.com' },
];

const matchHost = (pat, h) => pat === '*' || pat === h || (pat.startsWith('*.') && h.endsWith(pat.slice(1)));

// 표지 이름 — .invalid 라 밖의 DNS 가 답하지 않는다. 확인용 실행이 이 이름이 127.0.0.1 로 풀리는지로 «크로미움이 규칙을 쓴다» 를 먼저 본다
const SENTINEL_HOST = 'tw-e2e-guard.invalid';
// 확인용 실행이 열어 보는 wss — 막혀야 한다(이름 풀이도 ~NOTFOUND 라 막기를 놓쳐도 밖에 닿지 않는다)
const PROBE_WSS = ['wss://s-gke-apse1-nssi2-0.asia-southeast1.firebasedatabase.app/.ws?v=5', 'wss://together-working-default-rtdb.firebaseio.com/.ws?v=5'];

function resolverRules(relayPort){
  return [`MAP ${SENTINEL_HOST} 127.0.0.1:9`, `MAP ${RTDB_HOST} 127.0.0.1:${relayPort}`, 'EXCLUDE localhost', 'EXCLUDE 127.0.0.1', ...PASS_HOSTS.map((h) => 'EXCLUDE ' + h), 'MAP * ~NOTFOUND'];
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
function guard({ relayPort, o, rules = resolverRules(relayPort), routes = ROUTES, hosts = GUARD_HOSTS }){
  const bad = [];
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

module.exports = { RTDB_HOST, SENTINEL_HOST, PROBE_WSS, HELP_HOST, PASS_RE, LOCAL_RE, ROUTES, GUARD_HOSTS, resolverRules, resolveRule, classify, guard, matchHost };
