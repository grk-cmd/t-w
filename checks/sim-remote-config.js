/* ═══ ⚙️ sim-remote-config.js — 원격 설정(방 상한 · 정원 · 가입 스위치 · 방 서버 · 최소 버전 · 제보 상한) ═══════════════
   [왜] 운영 값을 앱 릴리스 없이 바꾸려고. 쓰기 원본은 Firebase config/*(웹 관리자), 앱은 읽기 사본 API(GET /v1/config)를 먼저 읽는다.
   1. remote-config.js 실행 — 기본값(300 · 10 · true · 꺼짐 · 5) · 범위 밖 · 타입이 다른 값 무시 · 바뀔 때만 알림 · ready 시간 초과
   2. 읽는 차례 — API → 못 받으면 Firebase config 칸 → 저장값(최소 버전 제외) → 기본값 · 다시 읽기 · 허용 목록 · 서버 주소 · firebase-init 배선
   3. 규칙 — 누구나 읽기 · 관리자만 쓰기 · 범위 · 타입 · 모르는 칸 거절 · 제보 하루 상한 100 · 방 서버 시간값(timing)
   4. app.js 배선 — 박힌 상수 없음 · 사용처가 설정값 · 부팅 스위치는 첫 답을 기다림 · 화면 숫자 다시 그리기
   5. 방 서버 길(_startRoomOnServer) 빈 방 열기 상한 — 실행 · 되살리기(주소록) · 시크릿룸 · 만들기 · 있는 방은 검사 안 함
   6. html — 스크립트 순서 · 기본 표시 300 · 최대 N명 자리 · CSP(API · 방 서버 와일드카드)
   [실행] 러너 스테이징(평평한 폴더) 또는 checks/ 에서. */
'use strict';
const { joinRenderer: _joinRenderer } = require('./sim-renderer-src.js');   // 앱 FSD 로 옮긴 모듈을 «옮기기 전 app.js 글» 로 되살려 읽는다
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const DIRS = ['.', 'parts', 'app', path.join('app', 'parts'), '..', path.join('..', 'app'), path.join('..', 'app', 'parts')];
const read = (f) => { for(const d of DIRS){ try{ return fs.readFileSync(path.join(d, f), 'utf8'); }catch(_){} } return null; };
const where = (f) => { for(const d of DIRS){ const p = path.join(d, f); if(fs.existsSync(p)) return p; } return null; };
const RC = read('remote-config.js'), APP = _joinRenderer(read('app.js')), FI = read('firebase-init.js'),
  HTML = read('desk-companion-prototype.html'), RULES_TXT = read('firebase-database-rules.json');
for(const [n, v] of [['remote-config.js', RC], ['app.js', APP], ['firebase-init.js', FI], ['desk-companion-prototype.html', HTML], ['firebase-database-rules.json', RULES_TXT]]){
  if(!v){ say('  ? 원본 못 찾음 — ' + n); process.exit(2); }
}
function takeFn(src, head){
  const i = src.indexOf(head);
  if(i < 0) return null;
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){
    const c = src[j];
    if(c === '{') d++;
    else if(c === '}'){ d--; if(d === 0) return src.slice(i, j + 1); }
  }
  return null;
}
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const RCM = require(path.resolve(where('remote-config.js')));

(async () => {
  const memStore = (init) => { const m = Object.assign({}, init || {}); return { m, getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; };
  const DATA = { version: 7, roomLimits: { workingroom: 500, togetherroom: 400 }, roomMaxPeople: 12, flags: { inviteGate: false, existingSignup: false },
    roomServer: { on: true, default: 'rooms', defaultPercent: 20, servers: { rooms: 'wss://rooms.togetherworking.duckdns.org' }, limits: { workingroom: 9 }, registerIndex: true },
    roomServerTiming: { x: 1 }, minVersion: { app: '0.11.4', room: '0.11.5' }, bugDailyMax: 9 };
  const ENV = { version: 7, syncedAt: '2026-10-14T00:00:00Z', config: DATA };   // GET /v1/config 의 data
  const okRes = (data, status) => ({ ok: (status || 200) < 300, status: status || 200, json: async () => ({ success: true, data }) });
  const mkFetch = (fn) => { const calls = []; const f = async (url, init) => { calls.push({ url, init }); return fn(url, init, calls.length); }; f.calls = calls; return f; };
  const API = require(path.resolve(where('api-client.js')));
  const mkApi = (f) => API.createApiClient({ baseUrl: 'https://api.togetherworking.duckdns.org', fetch: f, backoffMs: 0 });
  const quiet = async (fn) => { const w = console.warn; console.warn = () => {}; try{ return await fn(); }finally{ console.warn = w; } };

  say('── 1. remote-config.js — 기본값 · 범위 · 타입');
  {
    const D = RCM.DEFAULTS;
    chk(D.roomLimits.workingroom === 300 && D.roomLimits.togetherroom === 300 && D.roomMaxPeople === 10 && D.inviteGate === true && D.existingSignup === true,
      '기본값 — 방 상한 300 · 정원 10 · 초대 게이트 켜짐 · 가입 강제 켜짐(#157 그대로)');
    chk(D.roomServer.on === false && D.minVersion.app === null && D.minVersion.room === null && D.bugDailyMax === 5,
      '  ↳ 방 서버 꺼짐(전원 Firebase) · 최소 버전 없음(막지 않음) · 제보 하루 5건');
    chk(Object.isFrozen(D) && Object.isFrozen(D.roomLimits) && Object.isFrozen(D.roomServer), '  ↳ 기본값은 얼려 둔다(실수로 바뀌지 않게)');
    const s = RCM.createRemoteConfig();
    chk(s.roomLimitOf('workingroom') === 300 && s.maxPeople() === 10 && s.inviteGate() === true && s.existingSignup() === true && s.roomServer().on === false && s.minAppVer() === null && s.minRoomVer() === null && s.bugDailyMax() === 5,
      '설정이 하나도 없으면(아직 못 받음) 기본값');
    chk(s.roomLimitOf('???') === 300, '  ↳ 모르는 채널은 워킹룸 상한');
    const L = RCM.cleanRoomLimits;
    chk(JSON.stringify(L({ workingroom: 500, togetherroom: 1 })) === '{"workingroom":500,"togetherroom":1}' && L({ workingroom: 10000 }).workingroom === 10000, '방 상한 1~10000 정수는 그대로');
    chk([0, -1, 10001, 2.5, '400', NaN, Infinity, null, true].every((v) => L({ workingroom: v }).workingroom === 300), '  ↳ 범위 밖 · 소수 · 문자열 · NaN · 무한 · null · 불리언 → 300');
    chk(L({ workingroom: 400 }).togetherroom === 300 && L(null).workingroom === 300 && L('x').workingroom === 300 && L([1]).workingroom === 300, '  ↳ 한 칸만 있으면 나머지는 300 · 객체가 아니면 둘 다 300');
    const P = RCM.cleanMaxPeople;
    chk(P(2) === 2 && P(50) === 50 && [1, 0, 51, 9.5, '12', null, undefined, false].every((v) => P(v) === 10), '정원 2~50 정수만(나머지 10)');
    const F = RCM.cleanFlag;
    chk(F(false, true) === false && F('false', true) === true && F(0, true) === true && F(null, true) === true, '스위치는 불리언만 — "false" · 0 · null 은 기본값(true)');
    const B = RCM.cleanBugDailyMax;
    chk(B(1) === 1 && B(100) === 100 && [0, 101, 2.5, '7', null].every((v) => B(v) === 5), '제보 하루 상한 1~100 정수만(나머지 5)');
    const V = RCM.cleanMinVersion;
    chk(JSON.stringify(V({ app: ' 0.11.4 ', room: 7 })) === '{"app":"0.11.4","room":null}' && V({ app: 'x'.repeat(21) }).app === null && V(null).app === null && V({ app: '' }).app === null,
      '최소 버전 — 20자까지 글자만(숫자 · 빈 글자 · 너무 긴 값 · 없음 → 없음)');
    const S = RCM.cleanRoomServer;
    const rs = S({ on: true, default: 'rooms', defaultPercent: 30, servers: { rooms: 'wss://a', 'BAD NAME': 'wss://b', n: 3 }, allow: { u1: 'rooms' } });
    chk(rs.on === true && rs.default === 'rooms' && rs.defaultPercent === 30 && JSON.stringify(rs.servers) === '{"rooms":"wss://a"}' && !('allow' in rs),
      '방 서버 — on · default · defaultPercent · servers(이름 형식 · 글자 값만) · 그 밖의 칸은 버린다');
    chk(S({ on: 'true' }).on === false && S({ defaultPercent: 101 }).defaultPercent === 0 && S({ defaultPercent: 2.5 }).defaultPercent === 0 && S({ default: 'X Y' }).default === null && S(null).on === false,
      '  ↳ on 은 true 만 · 틀린 비율 0 · 틀린 이름 null · 없으면 꺼짐');

    const seen = [];
    s.onChange((c, k) => seen.push(k));
    chk(s.set('roomLimits', { workingroom: 500, togetherroom: 400 }) === true && s.roomLimitOf('togetherroom') === 400 && seen.join() === 'roomLimits', '값을 받으면 바로 반영 · 알림 한 번');
    chk(s.set('roomLimits', { workingroom: 500, togetherroom: 400 }) === false && seen.length === 1, '  ↳ 같은 값이면 알리지 않는다');
    s.set('roomLimits', null);
    chk(s.roomLimitOf('workingroom') === 300 && seen.length === 2, '  ↳ 칸이 없어지면(null) 기본값으로 돌아간다');
    s.set('roomMaxPeople', 99);
    chk(s.maxPeople() === 10 && seen.length === 2, '  ↳ 범위 밖 값은 무시(기본값 그대로 · 알림 없음)');
    chk(s.set('nope', 1) === false && !('nope' in s.get()), '  ↳ 모르는 칸은 받지 않는다');
    s.apply(DATA, false);
    chk(s.maxPeople() === 12 && s.inviteGate() === false && s.existingSignup() === false && s.roomServer().default === 'rooms' && s.minAppVer() === '0.11.4' && s.minRoomVer() === '0.11.5' && s.bugDailyMax() === 9,
      'API 응답 한 벌(flags 는 두 칸으로 편다) — 칸마다 반영');
    const bad = RCM.createRemoteConfig();
    bad.onChange(() => { throw new Error('boom'); });
    let ok = true; await quiet(() => { try{ bad.set('roomMaxPeople', 5); }catch(_){ ok = false; } });
    chk(ok && bad.maxPeople() === 5, '  ↳ 반영하는 쪽이 터져도 값은 들어간다');
    const r = RCM.createRemoteConfig();
    const t0 = Date.now();
    const v = await r.ready(['inviteGate', 'existingSignup'], 80);
    chk(Date.now() - t0 >= 70 && v.inviteGate === true, 'ready — 답이 없으면 시간 초과 뒤 지금 값(기본값)으로 간다');
    chk(RCM.store && typeof RCM.store.start === 'function', '앱 한 벌(store)이 있다');
    // 방 서버 연결 시간 — 앱 쪽 두 칸만(서버 쪽 graceMs 등은 안 받음)
    const tmc = RCM.createRemoteConfig();
    chk(JSON.stringify(tmc.roomServerTiming()) === '{"joinWaitMs":10000,"clientGiveUpMs":90000}', '연결 시간 기본 — 입장 대기 10초 · 포기 90초');
    tmc.apply({ roomServerTiming: { joinWaitMs: 20000, clientGiveUpMs: 1000, graceMs: 45000 } }, false);
    chk(JSON.stringify(tmc.roomServerTiming()) === '{"joinWaitMs":20000,"clientGiveUpMs":90000}', '  ↳ 범위 밖 칸만 기본값 · 서버 쪽 칸(graceMs)은 받지 않는다');
    chk(JSON.stringify(RCM.TIMING_RANGES) === '{"joinWaitMs":[3000,60000,10000],"clientGiveUpMs":[15000,600000,90000]}'
      && RCM.FALLBACK_PATHS.rsJoinWait === 'config/roomServer/timing/joinWaitMs' && RCM.FALLBACK_PATHS.rsGiveUp === 'config/roomServer/timing/clientGiveUpMs',
      '  ↳ 범위(규칙 · API 와 같음) · Firebase 로 읽을 때는 두 칸만 한 칸씩');
  }

  say('── 2. 읽는 차례 — API → Firebase → 저장값 → 기본값 · 다시 읽기 · 허용 목록 · 배선');
  {
    const BASE = 'https://api.togetherworking.duckdns.org';
    chk(RCM.CONFIG_PATH === '/v1/config' && RCM.ALLOW_PATH === '/v1/config/room-server/allow/' && /^tw\./.test(RCM.CACHE_KEY),
      '경로 — /v1/config · /v1/config/room-server/allow/ · 저장 키는 tw. 접두사(주소 · 시간 제한 · 쉬기는 api-client.js — sim-api-client.js)');
    chk(RCM.REFRESH_MS === 5 * 60 * 1000 && RCM.STALE_MS === 60 * 1000 && RCM.FETCH_TIMEOUT_MS <= 3000 && API.TIMEOUT_MS <= 3000, '다시 읽기 5분 · 입장 때 1분 넘었으면 · API · Firebase 각각 3초 이하');

    // ① 정상 — API 만
    const FBV = { 'config/roomLimits': { workingroom: 250, togetherroom: 260 }, 'config/roomMaxPeople': 8, 'config/flags/inviteGate': false, 'config/bugDailyMax': 3,
      'config/roomServer/on': true, 'config/roomServer/default': 'rooms', 'config/roomServer/defaultPercent': 40, 'config/roomServer/servers/rooms': 'wss://rooms.togetherworking.duckdns.org',
      'config/roomServer/allow/u1': 'rooms', 'config/minAppVer': '0.11.4', 'config/minRoomVer': '0.11.2' };
    const fbRead = (log, vals) => async (p) => { log.push(p); return (p in vals) ? vals[p] : null; };
    let st = memStore(), fb = [];
    let f = mkFetch(() => okRes(ENV));
    let s = RCM.createRemoteConfig();
    await s.start({ api: mkApi(f), storage: st, fallbackRead: fbRead(fb, FBV) });
    s.stop();
    chk(f.calls.length === 1 && f.calls[0].url === BASE + '/v1/config' && !f.calls[0].init.headers.Authorization && f.calls[0].init.credentials === 'omit', '★ 켤 때 GET /v1/config 한 번 — 로그인 없이(토큰 · 쿠키 없음)');
    chk(s.roomLimitOf('workingroom') === 500 && s.maxPeople() === 12 && s.inviteGate() === false && s.minAppVer() === '0.11.4' && s.bugDailyMax() === 9 && s.answered() && s.source() === 'api', '  ↳ 받은 값 반영 · 첫 답 표시 · 출처 api');
    chk(fb.length === 0, '★ API 를 받으면 Firebase config 는 읽지 않는다(다운로드 절약)');
    const saved = JSON.parse(st.m['tw.remoteConfig'] || 'null');
    chk(saved && saved.data && saved.data.roomMaxPeople === 12, '  ↳ 받은 값을 이 PC 에 저장');
    chk((await s.serverAddr('rooms')) === 'wss://rooms.togetherworking.duckdns.org' && (await s.serverAddr('nope')) === null && fb.length === 0, '  ↳ API 판의 서버 주소는 응답의 servers 에서(Firebase 안 읽음)');

    // ② API 실패 → Firebase config 칸
    fb = [];
    const down = mkFetch(() => { throw new TypeError('Failed to fetch'); });
    st = memStore();
    s = RCM.createRemoteConfig();
    await quiet(() => s.start({ api: mkApi(down), storage: st, fallbackRead: fbRead(fb, FBV) }));
    s.stop();
    chk(s.roomLimitOf('togetherroom') === 260 && s.maxPeople() === 8 && s.inviteGate() === false && s.existingSignup() === true && s.bugDailyMax() === 3 && s.roomServer().on === true && s.roomServer().default === 'rooms' && s.source() === 'firebase',
      '★ API 실패 → Firebase config 칸을 직접 읽어 쓴다(#157 방식)');
    chk(s.minAppVer() === '0.11.4' && s.minRoomVer() === '0.11.2', '  ↳ 최소 버전도 Firebase 값(이번 실행에 받은 값이라 막는 데 쓴다)');
    chk(fb.length === Object.keys(RCM.FALLBACK_PATHS).length && fb.every((p) => p.startsWith('config/') && p.split('/').length >= 2 && !['config/roomServer', 'config/flags', 'config/roomServer/servers', 'config/roomServer/allow'].includes(p)),
      '  ↳ 칸 단위로만(config · roomServer · 목록 통째 읽기 없음) (' + fb.length + '칸)');
    chk((await s.serverAddr('rooms')) === 'wss://rooms.togetherworking.duckdns.org' && fb.includes('config/roomServer/servers/rooms'), '  ↳ Firebase 판의 서버 주소는 servers/{이름} 한 칸');
    const nfb = fb.length; await s.serverAddr('rooms');
    chk(fb.length === nfb, '    ↳ 5분 기억');
    chk(JSON.parse(st.m['tw.remoteConfig'] || 'null').data.roomMaxPeople === 8, '  ↳ Firebase 에서 받은 값도 저장값으로 남긴다');

    // ③ API · Firebase 둘 다 실패 → 저장값 → 기본값
    s = RCM.createRemoteConfig();
    await quiet(() => s.start({ api: mkApi(down), storage: memStore({ 'tw.remoteConfig': JSON.stringify({ data: DATA }) }), fallbackRead: async () => { throw new Error('offline'); } }));
    s.stop();
    chk(s.roomLimitOf('workingroom') === 500 && s.maxPeople() === 12 && s.inviteGate() === false && s.roomServer().on === true && s.bugDailyMax() === 9 && s.answered() && s.source() === 'cache',
      '★ API · Firebase 둘 다 실패 → 저장값(방 상한 · 정원 · 스위치 · 방 서버 · 제보 상한)');
    chk(s.minAppVer() === null && s.minRoomVer() === null, '★ 최소 버전은 저장값을 쓰지 않는다(못 받으면 막지 않는다)');
    s = RCM.createRemoteConfig();
    await quiet(() => s.start({ api: mkApi(down), storage: memStore(), fallbackRead: async () => { throw new Error('offline'); } }));
    s.stop();
    chk(s.roomLimitOf('workingroom') === 300 && s.maxPeople() === 10 && s.inviteGate() === true && s.existingSignup() === true && s.roomServer().on === false && s.bugDailyMax() === 5 && s.answered() && s.source() === 'default',
      '★ 처음 실행 · 둘 다 실패 → 기본값(300 · 10 · true · true · 방 서버 꺼짐 · 5)');
    const nCalls = down.calls.length; fb = [];
    s = RCM.createRemoteConfig();
    await quiet(() => s.start({ api: null, storage: memStore(), fallbackRead: fbRead(fb, FBV) }));
    s.stop();
    chk(down.calls.length === nCalls && s.maxPeople() === 8 && fb.length > 0, '  ↳ API 통로가 없으면 묻지 않고 Firebase 부터');
    // ④ 봉투 · 시간 초과
    const bads = [
      async () => ({ ok: true, status: 200, json: async () => ({ success: false, code: 'X' }) }),
      async () => ({ ok: false, status: 503, json: async () => ({}) }),
      async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('html'); } }),
      async () => ({ ok: true, status: 200, json: async () => ({ success: true }) }),
      async () => ({ ok: true, status: 200, json: async () => ({ success: true, data: { version: 1 } }) }),
      async () => ({ ok: false, status: 503, json: async () => ({ success: false, code: 'CONFIG_NOT_READY' }) }),
    ];
    let allOk = true;
    for(const fn of bads){
      const s2 = RCM.createRemoteConfig();
      await quiet(() => s2.start({ api: mkApi(mkFetch(fn)), storage: memStore() }));
      s2.stop();
      if(s2.maxPeople() !== 10 || !s2.answered()) allOk = false;
    }
    chk(allOk, '실패 봉투 · 5xx · 봉투 아닌 응답 · data 없음 · config 없음 · 사본 미준비(503 CONFIG_NOT_READY) → 못 받음으로(기본값 · 답은 받음)');
    const hang = RCM.createRemoteConfig();
    const t0 = Date.now();
    const w0 = console.warn; console.warn = () => {};
    hang.start({ api: mkApi(() => new Promise(() => {})), storage: memStore() });
    const v = await hang.ready(null, 300);
    hang.stop();
    chk(Date.now() - t0 < 1000 && v.roomMaxPeople === 10 && !hang.answered(), '★ API 가 멈춰도(답 없음) 부팅 대기는 ready 시간 상한까지만(초대 게이트 3초) — 기본값으로 간다');
    await new Promise((res) => setTimeout(res, API.TIMEOUT_MS + 200));
    console.warn = w0;
    chk(hang.answered(), '  ↳ 멈춘 요청도 API 시간 제한(api-client TIMEOUT_MS) 뒤 끊고 «못 받음» 으로 끝낸다');

    // ⑤ 다시 읽기 · 입장 때 STALE_MS
    let t = 1000, n = 0;
    f = mkFetch(() => { n++; return okRes({ version: n, config: Object.assign({}, DATA, { roomMaxPeople: 10 + n }) }); });
    s = RCM.createRemoteConfig();
    await s.start({ api: mkApi(f), storage: memStore(), now: () => t });
    s.stop();
    await s.refresh({ maxAgeMs: RCM.STALE_MS });
    chk(f.calls.length === 1, '입장 때 refresh({ maxAgeMs }) — 1분 안이면 다시 묻지 않는다');
    t += RCM.STALE_MS + 1;
    await s.refresh({ maxAgeMs: RCM.STALE_MS });
    chk(f.calls.length === 2 && s.maxPeople() === 12, '  ↳ 1분이 지났으면 한 번 더 묻고 바뀐 값을 쓴다');
    const ff = mkFetch(() => { throw new Error('down'); });
    const s3 = RCM.createRemoteConfig();
    await quiet(() => s3.start({ api: mkApi(ff), storage: memStore(), now: () => t }));
    s3.stop();
    await quiet(() => s3.refresh({ maxAgeMs: RCM.STALE_MS }));
    chk(ff.calls.length === 1, '  ↳ API 가 멈췄을 때도 1분 안에는 다시 기다리지 않는다(입장마다 시간 초과를 겪지 않게)');

    // ⑥ 허용 목록 — GET /v1/config/room-server/allow/{내 코드}(공개) → 못 받으면 Firebase allow/{내 코드}
    const isAllow = (url) => url.indexOf('/v1/config/room-server/allow/') >= 0;
    f = mkFetch((url) => okRes(isAllow(url) ? { userCode: 'u1', server: 'rooms' } : ENV));
    fb = [];
    s = RCM.createRemoteConfig();
    await s.start({ api: mkApi(f), storage: memStore(), now: () => t, fallbackRead: fbRead(fb, FBV) });
    s.stop();
    const name = await s.myServer('u1');
    const meCall = f.calls.find((c) => c.url === BASE + '/v1/config/room-server/allow/u1');
    chk(name === 'rooms' && meCall && !meCall.init.headers.Authorization && fb.length === 0, '★ 허용 목록 — GET /v1/config/room-server/allow/{내 코드}(공개 · 토큰 없음) → server · Firebase 안 읽음');
    await s.myServer('u1');
    chk(f.calls.filter((c) => isAllow(c.url)).length === 1, '  ↳ 1분 기억(입장마다 묻지 않음)');
    chk((await s.myServer(null)) === null, '  ↳ 내 코드가 없으면 묻지 않고 null');
    await s.myServer('u/../x');
    chk(f.calls.some((c) => c.url === BASE + '/v1/config/room-server/allow/u%2F..%2Fx'), '  ↳ 코드는 주소에 넣기 전에 인코딩(경로를 못 바꾼다)');
    fb = [];
    const s5 = RCM.createRemoteConfig();
    await s5.start({ api: mkApi(mkFetch((url) => (isAllow(url) ? { ok: false, status: 503, json: async () => ({ success: false, code: 'CONFIG_NOT_READY' }) } : okRes(ENV)))), storage: memStore(), fallbackRead: fbRead(fb, FBV) });
    s5.stop();
    chk((await s5.myServer('u1')) === 'rooms' && fb.join() === 'config/roomServer/allow/u1', '★ 허용 목록 API 를 못 받으면(503) Firebase allow/{내 코드} 한 칸');
    const s4 = RCM.createRemoteConfig();
    await s4.start({ api: mkApi(mkFetch((url) => okRes(isAllow(url) ? { userCode: 'u1', server: 'BAD NAME' } : ENV))), storage: memStore() });
    s4.stop();
    const s7 = RCM.createRemoteConfig();
    await s7.start({ api: mkApi(mkFetch((url) => okRes(isAllow(url) ? { userCode: 'u1', server: null } : ENV))), storage: memStore(), fallbackRead: fbRead(fb, FBV) });
    s7.stop();
    const s6 = RCM.createRemoteConfig();
    await quiet(() => s6.start({ api: mkApi(mkFetch(() => { throw new Error('down'); })), storage: memStore(), fallbackRead: async () => { throw new Error('denied'); } }));
    s6.stop();
    chk((await s4.myServer('u1')) === null && (await s7.myServer('u1')) === null && (await s6.myServer('u1')) === null, '  ↳ 이름 형식이 틀림 · server null(허용 아님 — Firebase 안 봄) · 둘 다 못 받음 → null');

    // ⑦ firebase-init 배선
    const fi = strip(FI);
    chk(/_rc\.start\(\{\s*api: \(window\.TwApi && window\.TwApi\.client\) \|\| null,/.test(fi),
      'firebase-init.js 가 store.start 로 앱 공통 API 통로(TwApi.client)를 잇는다');
    chk(/fallbackRead: \(path\) => get\(ref\(db, path\)\)\.then\(s => s\.val\(\)\),/.test(fi), '  ↳ 비상 길 읽기(칸 하나 get)');
    chk(!/store\.watch/.test(fi) && !/'config\//.test(fi) && !/ref\(db, 'config'\)/.test(fi), '  ↳ Firebase config 구독 · 박힌 경로 없음(옛 store.watch 지움)');
    chk(/readMin: \(\) => _rc \? _rc\.ready\(null, MIN_APP_VER_WAIT_MS\)\.then\(\(\) => _rc\.minAppVer\(\)\) : null,/.test(fi) && fi.indexOf('_rc.start(') < fi.indexOf('createAppVersionGate({'),
      '  ↳ 앱 최소 버전은 원격 설정의 첫 답(API 값만) — start 다음에 게이트');
    chk(/async getMinRoomVer\(\)\{\s*if\(!_rc\) return null;\s*try\{ await _rc\.refresh\(\{ maxAgeMs: window\.TwRemoteConfig\.STALE_MS \}\); \}catch\(_\)\{\}\s*return _rc\.minRoomVer\(\);/.test(fi),
      '  ↳ 방 입장 최소 버전 — 1분 넘었으면 다시 묻고 API 값(못 받으면 null = 통과)');
    chk(/Promise\.resolve\(_rc \? _rc\.minRoomVer\(\) : null\)\.then\(v => \{/.test(fi) && /aliveV2On\(v\)/.test(fi), '  ↳ 💓 새 하트비트도 같은 값');
    chk(/getDailyMax: \(\) => _rc \? _rc\.refresh\(\{ maxAgeMs: window\.TwRemoteConfig\.STALE_MS \}\)\.then\(\(\) => _rc\.bugDailyMax\(\)\) : null,/.test(fi), '  ↳ 제보 하루 상한도 원격 설정');
    chk(/const _cap = \(window\.TwRemoteConfig && window\.TwRemoteConfig\.store\) \? window\.TwRemoteConfig\.store\.maxPeople\(\) : 10;/.test(fi) && !/window\.MAX_PEOPLE/.test(fi),
      '  ↳ 정원 초과 자기 퇴장도 같은 store 의 정원(window.MAX_PEOPLE 안 씀)');
    chk(!/^\s*import\s/m.test(RC) && !/gstatic|getDatabase|require\(/.test(strip(RC)), 'remote-config.js 는 Firebase 를 import 하지 않는다(비상 읽기도 deps.fallbackRead)');
  }

  say('── 3. 규칙 — 읽기 · 쓰기 · validate');
  {
    const R = JSON.parse(RULES_TXT).rules;
    const cfg = R.config;
    const ADMIN = "auth != null && root.child('admins').child(auth.uid).val() === true";
    const run = (expr, val) => {
      const nd = { isNumber: () => typeof val === 'number', isBoolean: () => typeof val === 'boolean', isString: () => typeof val === 'string', val: () => val, exists: () => val != null };
      return Function('newData', 'return (' + expr + ');')(nd);
    };
    const rl = cfg.roomLimits, mp = cfg.roomMaxPeople, fl = cfg.flags;
    chk(rl && rl['.read'] === true && rl['.write'] === ADMIN && rl.$other && rl.$other['.validate'] === false, 'config/roomLimits — 누구나 읽기 · 관리자만 쓰기 · 모르는 칸 거절');
    const okL = [1, 300, 10000], badL = [0, 10001, 2.5, '300', true];
    chk(['workingroom', 'togetherroom'].every((ch) => okL.every((v) => run(rl[ch]['.validate'], v)) && badL.every((v) => !run(rl[ch]['.validate'], v))),
      '  ↳ 채널 둘 — 1~10000 정수만(0 · 10001 · 소수 · 문자열 · 불리언 거절)');
    chk(mp && mp['.read'] === true && mp['.write'] === ADMIN && [2, 10, 50].every((v) => run(mp['.validate'], v)) && [1, 51, 9.5, '10', false].every((v) => !run(mp['.validate'], v)),
      'config/roomMaxPeople — 누구나 읽기 · 관리자만 쓰기 · 2~50 정수만');
    chk(fl && fl['.write'] === ADMIN && !('.read' in fl) && fl.$other && fl.$other['.validate'] === false, 'config/flags — 관리자만 쓰기 · 통째 읽기 없음 · 모르는 칸 거절');
    chk(['inviteGate', 'existingSignup'].every((k) => fl[k] && fl[k]['.read'] === true && run(fl[k]['.validate'], true) && run(fl[k]['.validate'], false) && !run(fl[k]['.validate'], 'true') && !run(fl[k]['.validate'], 1)),
      '  ↳ inviteGate · existingSignup — 누구나 읽기 · 불리언만');
    chk(typeof cfg['.read'] === 'string' && /admins/.test(cfg['.read']) && cfg.minRoomVer['.read'] === true && cfg.bugDailyMax['.read'] === true, 'config 통째 읽기는 여전히 관리자만 · 옛 칸 그대로');
    const bpc = R.users.$userId.bugPostCount.$date['.validate'];
    chk(run(bpc, 100) && !run(bpc, 101) && run(bpc, 0) && /<= 100/.test(cfg.bugDailyMax['.validate']), '제보 하루 작성 수 상한 50 → 100 — config/bugDailyMax 범위(1~100)와 같다');
  }

  say('── 4. app.js 배선');
  {
    const a = strip(APP);
    chk(!/\bconst ROOM_LIMITS\b|\bROOM_LIMITS\b/.test(a) && !/\bMAX_ROOMS\b/.test(a), '박힌 방 상한(ROOM_LIMITS · MAX_ROOMS) 없음');
    chk(!/\bMAX_PEOPLE\b/.test(a) && !/window\.MAX_PEOPLE/.test(a), '박힌 정원(MAX_PEOPLE) 없음 — maxPeople()');
    chk(!/INVITE_GATE_ENABLED|EXISTING_SIGNUP_ENABLED/.test(a), '박힌 가입 스위치 없음 — inviteGateOn() · existingSignupOn()');
    chk(/function _rcStore\(\)\{ return \(typeof window !== 'undefined' && window\.TwRemoteConfig && window\.TwRemoteConfig\.store\) \|\| null; \}/.test(a), '설정은 window.TwRemoteConfig.store 한 벌');
    chk(/function roomLimitOf\(channel\)\{ const s = _rcStore\(\); return s \? s\.roomLimitOf\(channel\) : 300; \}/.test(a) &&
      /function maxPeople\(\)\{ const s = _rcStore\(\); return s \? s\.maxPeople\(\) : 10; \}/.test(a) &&
      /function inviteGateOn\(\)\{ const s = _rcStore\(\); return s \? s\.inviteGate\(\) : true; \}/.test(a), '  ↳ store 가 없어도(검사 · 옛 html) 기본값');
    const create = takeFn(a, 'async function doCreateRoomInChannel(');
    chk(create && /const limit = roomLimitOf\(channel\);/.test(create) && /toast\(_channelFullMsg\(channel\)\)/.test(create), '방 만들기 — 설정 상한');
    chk(/const _openLimit = roomLimitOf\(_openCh\);/.test(a) && /toast\(_channelFullMsg\(_openCh\)\)/.test(a), 'Firebase 빈 방 열기 — 설정 상한');
    const counts = a.match(/\$\{roomLimitOf\('(workingroom|togetherroom)'\)\}/g) || [];
    chk(counts.length === 6, '방 개수 표시 «n / 상한» 세 곳(구독 · 채널 화면 · 옛 API) × 2 = 6 — 설정 상한 (' + counts.length + ')');
    const jm = takeFn(a, 'function _roomServerJoinMessage(');
    chk(jm && /const ch = openCh \|\| /.test(jm) && /return _channelFullMsg\(ch\);/.test(jm), '방 서버 channelFull 문구 — 설정 상한 · 서버가 연 빈 방이면 그 채널');
    chk((a.match(/maxPeople\(\)/g) || []).length >= 15, '정원 사용처 전부 maxPeople() (' + (a.match(/maxPeople\(\)/g) || []).length + ')');
    const ig = takeFn(a, '(function initInviteGate(');
    chk(ig && /await _s\.ready\(\['inviteGate','existingSignup'\], REMOTE_FLAGS_WAIT_MS\)/.test(ig) && ig.indexOf('_s.ready(') < ig.indexOf('checkInviteGate()') && /const REMOTE_FLAGS_WAIT_MS = 3000;/.test(a),
      '부팅 스위치 — 첫 답을 최대 3초 기다린 뒤 초대 게이트(못 받으면 기본값 true)');
    chk(/if\(!inviteGateOn\(\)\)\{/.test(a) && /if\(!existingSignupOn\(\)\) return null;/.test(a), '  ↳ 게이트 · 가입 강제가 스위치 함수를 본다');

    // 화면 숫자 다시 그리기 — 가짜 DOM
    const els = {
      chCountWorking: { textContent: '12 / 300' }, chCountTogether: { textContent: '— / 300' },
      chMetaTogether: { textContent: '라이선스 · 최대 10명', querySelector: () => null },
    };
    const spans = [{ textContent: '10' }, { textContent: '10' }];
    const doc = { getElementById: (id) => els[id] || null, querySelectorAll: (q) => (q === '[data-tw-max-people]' ? spans : []) };
    const st = RCM.createRemoteConfig();
    const src = [takeFn(a, 'function roomLimitOf('), takeFn(a, 'function maxPeople('), takeFn(a, 'function _paintRoomLimits('), takeFn(a, 'function _paintMaxPeople('),
      'return { _paintRoomLimits, _paintMaxPeople };'].join('\n');
    const U = Function('document', '_rcStore', src)(doc, () => st);
    st.set('roomLimits', { workingroom: 450, togetherroom: 1000 }); st.set('roomMaxPeople', 12);
    U._paintRoomLimits(); U._paintMaxPeople();
    chk(els.chCountWorking.textContent === '12 / 450' && els.chCountTogether.textContent === '— / 1000', '설정이 바뀌면 «n / 상한» 의 상한만 바뀐다(읽기 없음)');
    chk(spans.every((x) => x.textContent === '12') && els.chMetaTogether.textContent === '라이선스 · 최대 12명', '  ↳ «최대 N명» 자리 · 투게더룸 카드 문구');
    chk(/s\.onChange\(\(c, key\)=>\{ if\(key === 'roomLimits'\) _paintRoomLimits\(\); else if\(key === 'roomMaxPeople'\) _paintMaxPeople\(\); \}\);/.test(a), '  ↳ onChange 에 묶여 있다');
  }

  say('── 5. 방 서버 길 빈 방 열기 — 상한');
  {
    const a = strip(APP);
    const need = ['async function _startRoomOnServer(', 'function _roomServerJoinMessage(', 'function _channelFullMsg(', 'function roomLimitOf(', 'function maxPeople(', 'function _myRoomLicensed('];
    const miss = need.filter((h) => !takeFn(a, h));
    chk(miss.length === 0, '함수들이 있다' + (miss.length ? ' — 없음: ' + miss.join(', ') : ''));
    if(miss.length) return finish();
    const SRC = [
      "const CHANNEL_NAMES = { workingroom: '워킹룸', togetherroom: '투게더룸' };",
      'const ROOM_SERVER_CONNECTING_TOAST_MS = 1000;',
      "const ROOM_SERVER_BUSY_MSG = '방 서버에 연결하지 못했어요 — 잠시 후 다시 시도해 주세요';",
      "const ROOM_CODE_RE = /^(COZY|WORK|PLAY)-([A-Z0-9]{4})$/;",
      "function _roomPrefixFor(ch){ return ch === 'togetherroom' ? 'PLAY-' : 'WORK-'; }",
      ...need.map((h) => takeFn(a, h)),
      'return _startRoomOnServer;',
    ].join('\n');
    function mk(o){
      o = o || {};
      const log = { toasts: [], counts: [], started: 0, peek: 0, ready: [] };
      const st = RCM.createRemoteConfig();
      if(o.limits) st.set('roomLimits', o.limits);
      const win = { _pendingRoomChannel: o.pending || null, _pendingRoomOpen: false };
      const net = {
        ensureReady: async (ms, ro) => { log.ready.push([ms || null, !!(ro && ro.retry)]); return o.notReady ? { ok: false, code: 'timeout' } : { ok: true }; },
        timing: () => ({ joinWaitMs: 10000, clientGiveUpMs: 90000 }),
        peek: async () => { log.peek++; return { exists: !!o.onServer }; },
      };
      const api = {
        resolveRoomServer: async () => ({ via: 'server', from: o.from || 'allow' }),
        checkRoomCapacity: async () => o.fbPeople || 0,
        checkSecretRoomEntry: async () => ({ count: 0, ownerIn: false }),
        getRoomCount: async (ch) => { log.counts.push(ch); if(o.countThrow) throw new Error('net'); return (o.count && ch in o.count) ? o.count[ch] : 0; },
      };
      const Presence = { start: async () => { log.started++; return o.joinFail ? { ok: false, code: o.joinFail } : { ok: true, others: 1, meta: null }; }, stop: async () => {} };
      const fn = Function('window', 'firebaseAPI', '_roomServerNet', 'Presence', 'makeServerProvider', '_clearHiddenSeats', 'getDisplayName', 'presenceChanged',
        'toast', 'refreshInviteUI', 'applyExtraSeatForMode', 'startRoom', '_rcStore', 'isPremium', 'isAdmin', 'console', SRC)(
        win, api, () => net, Presence, () => ({}), () => {}, () => '나', () => {},
        (m) => log.toasts.push(m), () => {}, () => {}, async () => {}, () => st, !!o.premium, false, { warn() {}, log() {} });
      return { go: (code, ctx) => fn(code, Object.assign({ isSecret: false, secretOwner: null, myDef: {} }, ctx || {})), log, win };
    }
    let t = mk({ count: { workingroom: 300 } });
    let r = await t.go('WORK-AB12');
    chk(r === 'stop' && t.log.started === 0 && t.log.counts.join() === 'workingroom' && /워킹룸이 지금 꽉 찼어요\(300\/300\)/.test(t.log.toasts[0] || ''),
      '★ 서버에도 Firebase 에도 사람이 없어 서버가 열 방 — 워킹룸 300/300 이면 막는다(기본 상한 300)');
    t = mk({ count: { workingroom: 299 } });
    chk((await t.go('WORK-AB12')) === 'done' && t.log.started === 1, '  ↳ 299 면 연다');
    t = mk({ count: { workingroom: 300 }, limits: { workingroom: 500, togetherroom: 300 } });
    chk((await t.go('WORK-AB12')) === 'done' && t.log.started === 1, '  ↳ 설정 상한 500 이면 300 개여도 연다(바뀐 값이 바로)');
    t = mk({ count: { workingroom: 20 }, limits: { workingroom: 20, togetherroom: 300 } });
    chk((await t.go('WORK-AB12')) === 'stop' && /\(20\/20\)/.test(t.log.toasts[0] || ''), '  ↳ 설정 상한 20 · 20 개면 막고 문구도 20');
    t = mk({ premium: true, count: { workingroom: 0, togetherroom: 300 } });
    chk((await t.go('PLAY-AB12')) === 'stop' && t.log.counts.join() === 'togetherroom' && /투게더룸이 지금 꽉 찼어요/.test(t.log.toasts[0] || ''), '  ↳ 보유자는 투게더룸으로 센다(Firebase 갈래와 같은 자격)');
    t = mk({ from: 'dir', count: { workingroom: 99999 } });
    chk((await t.go('WORK-AB12')) === 'done' && t.log.counts.length === 0 && t.log.peek === 0, '★ 되살리기 · 따라가기(주소록 roomDir 에 있는 방)는 세지 않는다');
    t = mk({ count: { workingroom: 99999, togetherroom: 99999 } });
    chk((await t.go('SCRT-AB12', { isSecret: true, secretOwner: 'u1' })) === 'done' && t.log.counts.length === 0, '  ↳ 시크릿룸은 상한 밖');
    t = mk({ onServer: true, count: { workingroom: 99999 } });
    chk((await t.go('WORK-AB12')) === 'done' && t.log.counts.length === 0, '  ↳ 서버에 이미 있는 방에 들어가면 세지 않는다');
    t = mk({ fbPeople: 3, count: { workingroom: 99999 } });
    chk((await t.go('WORK-AB12')) === 'firebase' && t.log.counts.length === 0, '  ↳ Firebase 에 사람이 있는 방이면 Firebase 로(세지 않음)');
    t = mk({ pending: 'workingroom', count: { workingroom: 99999 } });
    chk((await t.go('WORK-AB12')) === 'done' && t.log.counts.length === 0, '  ↳ [방 만들기] 는 doCreateRoomInChannel 이 이미 셌다(두 번 안 셈)');
    t = mk({ countThrow: true });
    chk((await t.go('WORK-AB12')) === 'done', '  ↳ 개수를 못 읽으면 막지 않는다(Firebase 갈래와 같은 태도)');
    t = mk({ count: { workingroom: 5 }, joinFail: 'channelFull', limits: { workingroom: 300, togetherroom: 77 }, premium: true });
    chk((await t.go('PLAY-AB12')) === 'stop' && /투게더룸이 지금 꽉 찼어요\(77\/77\)/.test(t.log.toasts[0] || ''), '방 서버가 channelFull 로 거절 — 문구는 그 채널 · 설정 상한');
    t = mk({ count: { workingroom: 300 } });
    t.win._pendingRoomOpen = true;
    await t.go('WORK-AB12');
    chk(t.win._pendingRoomChannel === null && t.win._pendingRoomOpen === false, '  ↳ 막으면 만들기 표시를 지운다(다음 입장에 따라붙지 않게)');
    // 이미 열린 방(주소록 roomDir) — 못 붙으면 Firebase 로 가지 않고 막는다
    const BUSY = '방 서버에 연결하지 못했어요 — 잠시 후 다시 시도해 주세요';
    t = mk({ from: 'dir', notReady: true });
    chk((await t.go('WORK-AB12')) === 'stop' && t.log.started === 0 && t.log.toasts.includes(BUSY) && JSON.stringify(t.log.ready) === '[[10000,true]]',
      '★ 주소록에 있는 방에 못 붙으면(입장 대기 10초 · 다시 붙어 보기) 막고 «잠시 후 다시 시도» — Firebase 로 안 간다');
    t = mk({ from: 'dir', joinFail: 'timeout' });
    chk((await t.go('WORK-AB12')) === 'stop' && t.log.toasts.includes(BUSY), '  ↳ 붙었는데 입장이 시간 초과여도 막는다');
    t = mk({ from: 'dir', joinFail: 'full' });
    chk((await t.go('WORK-AB12')) === 'stop' && /가득 찼어요/.test(t.log.toasts[0] || ''), '  ↳ 정원 등 거절은 지금 문구 그대로');
    t = mk({ notReady: true });
    chk((await t.go('WORK-AB12')) === 'firebase' && JSON.stringify(t.log.ready) === '[[null,false]]', '  ↳ 주소록에 없는 방(새 방 · peek)은 지금처럼 Firebase 로 — 갈릴 사람이 없다');
    t = mk({ pending: 'workingroom', notReady: true });
    chk((await t.go('WORK-AB12')) === 'firebase', '  ↳ [방 만들기] 도 서버에 못 붙으면 Firebase 로 연다');
  }

  say('── 6. html — 순서 · 기본 표시 · CSP');
  {
    const iRc = HTML.indexOf('<script src="parts/shared/remote-config.js"></script>'), iApp = HTML.indexOf('<script src="parts/app.js"></script>');
    const iApi = HTML.indexOf('<script src="parts/shared/api-client.js"></script>');
    chk(iRc > 0 && iApp > iRc && iApi > 0 && iApi < iRc, 'api-client.js → remote-config.js → app.js 차례로 싣는다(firebase-init.js 는 module 이라 그 뒤에 돈다)');
    chk(/id="chCountWorking">— \/ 300</.test(HTML) && /id="chCountTogether">— \/ 300</.test(HTML) && !/— \/ 250/.test(HTML), '방 개수 기본 표시 «— / 300»(기본 상한과 같다)');
    chk((HTML.match(/<span data-tw-max-people>10<\/span>/g) || []).length === 4 && !/최대 10명/.test(HTML), '«최대 10명» 네 곳이 설정을 따라가는 자리');
    const csp = [...HTML.matchAll(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/g)].map((m) => m[1]);
    const conn = csp.map((c) => (/connect-src ([^;]+);/.exec(c) || [])[1] || '');
    chk(csp.length === 2 && conn.every((c) => /(^| )wss:\/\/\*\.togetherworking\.duckdns\.org( |$)/.test(c) && /(^| )https:\/\/\*\.togetherworking\.duckdns\.org( |$)/.test(c)),
      'CSP 두 줄 — wss · https://*.togetherworking.duckdns.org');
    chk(/^https:\/\/[a-z0-9-]+\.togetherworking\.duckdns\.org$/.test(require(path.resolve(where('api-client.js'))).API_BASE_PROD), '  ↳ API 주소(api-client.js API_BASE_PROD)도 같은 https 와일드카드 안(CSP 를 따로 열지 않음)');
    chk(conn.every((c) => !/rooms(-dev)?\.togetherworking/.test(c) && !/\bws:\/\/\*|wss:\/\/\*\.duckdns|\*\.duckdns\.org|https?:\/\/\*( |$)/.test(c)), '  ↳ 다른 도메인은 그대로 막는다(duckdns 전체 · ws 와일드카드 없음)');
  }
  finish();
})().catch((e) => { fail++; say('  ✗ 예외: ' + (e && e.stack || e)); finish(); });

function finish(){
  say('\n' + pass + ' · ' + fail);
  process.exit(fail ? 1 : 0);
}
