/* ═══ ⚙️ sim-remote-config.js — 원격 설정(GET /v1/config 하나 — 방 상한 · 정원 · 연결 시간 · 최소 버전 · 금칙어 · 초대 게이트 · 제보 · 박수 · 선물) ═══════════════
   [왜] 운영 값을 앱 릴리스 없이 바꾸려고. 0.13 은 서버가 원본 — 앱은 GET /v1/config 하나만 읽는다(Firebase config 칸은 안 읽음).
   1. remote-config.js 실행 — 기본값 · 범위 밖 · 타입이 다른 값 무시 · 서버 묶음 모양 풀기 · 바뀔 때만 알림 · ready 시간 초과
   2. 읽는 차례 — API → 저장값(최소 버전 제외 · 옛 모양 저장값 무시) → 기본값 · ETag 304 · 다시 읽기 · realtime 알림 config · firebase-init 배선
   3. 규칙 — 누구나 읽기 · 관리자만 쓰기 · 범위 · 타입 · 모르는 칸 거절 · 제보 하루 상한 100(Firebase 쪽 — 규칙을 걷는 묶음이 같이 걷는다)
   4. app.js 배선 — 박힌 상수 없음 · 사용처가 설정값 · 부팅 스위치는 첫 답을 기다림 · 화면 숫자 다시 그리기
   5. 입장 거절 문구 — 서버가 판정한 channelFull · full 의 숫자가 설정값(만들기 · 빈 방 · 시크릿룸)
   6. html — 스크립트 순서 · 기본 표시 · CSP
   7. 일부러 깨 보기
   [실행] 러너 스테이징(평평한 폴더) 또는 checks/ 에서. */
'use strict';
const { stripReadGate } = require('./sim-rules-src.js');   // 옛 앱 읽기 막기 조건을 걷고 본다(개정 375)
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
  HTML = read('desk-companion-prototype.html'), RULES_TXT = stripReadGate(read('firebase-database-rules.json'));
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
  /* GET /v1/config 의 data — 서버가 앱에 주는 묶음 모양 */
  const DATA = { room: { limits: { workingroom: 500, togetherroom: 400 }, maxPeople: 12, timing: { joinWaitMs: 20000, clientGiveUpMs: 1000 }, minVersion: '0.13.1', bannedWords: ['나쁜말'] },
    app: { minVersion: '0.13.0' }, user: { inviteGate: false }, bug: { dailyMax: 9 }, guestbook: { clapDailyMax: 7 }, gift: { dailySendMax: 3 } };
  const okRes = (data, status, hdr) => ({ ok: (status || 200) < 300, status: status || 200, headers: { get: (k) => (hdr || {})[k] || null }, json: async () => ({ success: true, data }) });
  const mkFetch = (fn) => { const calls = []; const f = async (url, init) => { calls.push({ url, init }); return fn(url, init, calls.length); }; f.calls = calls; return f; };
  const API = require(path.resolve(where('api-client.js')));
  const mkApi = (f) => API.createApiClient({ baseUrl: 'https://api.together-working.com', fetch: f, backoffMs: 0 });
  const quiet = async (fn) => { const w = console.warn; console.warn = () => {}; try{ return await fn(); }finally{ console.warn = w; } };

  say('── 1. remote-config.js — 기본값 · 범위 · 타입 · 묶음 모양');
  {
    const D = RCM.DEFAULTS;
    chk(D.roomLimits.workingroom === 300 && D.roomLimits.togetherroom === 300 && D.roomMaxPeople === 10 && D.inviteGate === true && D.bugDailyMax === 5 && D.clapDailyMax === 5 && D.giftDailySendMax === 10,
      '기본값 — 방 상한 300 · 정원 10 · 초대 게이트 켜짐 · 제보 5 · 박수 5 · 선물 10(서버 설정 키 기본값과 같다)');
    chk(D.minVersion.app === null && D.minVersion.room === null && JSON.stringify(D.roomServerTiming) === '{"joinWaitMs":10000,"clientGiveUpMs":90000}', '  ↳ 최소 버전 없음(막지 않음) · 연결 시간 10초 · 90초');
    chk(Object.isFrozen(D) && Object.isFrozen(D.roomLimits) && Object.isFrozen(D.minVersion), '  ↳ 기본값은 얼려 둔다(실수로 바뀌지 않게)');
    const s = RCM.createRemoteConfig();
    chk(s.roomLimitOf('workingroom') === 300 && s.maxPeople() === 10 && s.inviteGate() === true && s.existingSignup() === true && s.minAppVer() === null && s.minRoomVer() === null && s.bugDailyMax() === 5
      && s.clapDailyMax() === 5 && s.giftDailySendMax() === 10 && JSON.stringify(s.bannedWords()) === '[]', '설정이 하나도 없으면(아직 못 받음) 기본값');
    chk(s.roomLimitOf('???') === 300, '  ↳ 모르는 채널은 워킹룸 상한');
    chk(!('roomServer' in s) && !('sources' in s) && !('dataRoutes' in s) && !('friendsApi' in s) && !('myServer' in s) && !('serverAddr' in s) && !('FALLBACK_PATHS' in RCM),
      '★ 0.13 서버에 없는 칸(방 서버 · 기능 스위치 · 범용 통로 · 친구 스위치 · 허용 목록 · Firebase 칸 목록)은 없다');
    const L = RCM.cleanRoomLimits;
    chk(JSON.stringify(L({ workingroom: 500, togetherroom: 1 })) === '{"workingroom":500,"togetherroom":1}' && L({ workingroom: 10000 }).workingroom === 10000, '방 상한 1~10000 정수는 그대로');
    chk([0, -1, 10001, 2.5, '400', NaN, Infinity, null, true].every((v) => L({ workingroom: v }).workingroom === 300), '  ↳ 범위 밖 · 소수 · 문자열 · NaN · 무한 · null · 불리언 → 300');
    chk(L({ workingroom: 400 }).togetherroom === 300 && L(null).workingroom === 300 && L('x').workingroom === 300 && L([1]).workingroom === 300, '  ↳ 한 칸만 있으면 나머지는 300 · 객체가 아니면 둘 다 300');
    const P = RCM.cleanMaxPeople;
    chk(P(2) === 2 && P(50) === 50 && [1, 0, 51, 9.5, '12', null, undefined, false].every((v) => P(v) === 10), '정원 2~50 정수만(나머지 10)');
    const F = RCM.cleanFlag;
    chk(F(false, true) === false && F('false', true) === true && F(0, true) === true && F(null, true) === true, '스위치는 불리언만 — "false" · 0 · null 은 기본값(true)');
    chk(RCM.cleanBugDailyMax(1) === 1 && RCM.cleanBugDailyMax(100) === 100 && [0, 101, 2.5, '7', null].every((v) => RCM.cleanBugDailyMax(v) === 5), '제보 하루 상한 1~100 정수만(나머지 5)');
    chk(RCM.cleanClapDailyMax(1) === 1 && RCM.cleanClapDailyMax(100) === 100 && [0, 101, 1.5].every((v) => RCM.cleanClapDailyMax(v) === 5)
      && RCM.cleanGiftDailySendMax(100) === 100 && [0, 101, '3'].every((v) => RCM.cleanGiftDailySendMax(v) === 10), '박수 · 선물 하루 상한 1~100 정수만(나머지 5 · 10)');
    const V = RCM.cleanMinVersion;
    chk(JSON.stringify(V({ app: ' 0.11.4 ', room: 7 })) === '{"app":"0.11.4","room":null}' && V({ app: 'x'.repeat(21) }).app === null && V(null).app === null && V({ app: '' }).app === null,
      '최소 버전 — 20자까지 글자만(숫자 · 빈 글자 · 너무 긴 값 · 없음 → 없음)');
    chk(JSON.stringify(RCM.cleanBannedWords(['나쁜말', '', 3, '가'.repeat(21), '욕'])) === '["나쁜말","욕"]' && JSON.stringify(RCM.cleanBannedWords({ 0: '가' })) === '[]', '금칙어 — 글자 칸만 · 20자까지 · 배열만(서버는 배열로 준다)');
    const f = RCM.fieldsOf(DATA);
    chk(JSON.stringify(f.roomLimits) === JSON.stringify(DATA.room.limits) && f.roomMaxPeople === 12 && f.inviteGate === false && f.bugDailyMax === 9 && f.clapDailyMax === 7 && f.giftDailySendMax === 3
      && f.minVersion.app === '0.13.0' && f.minVersion.room === '0.13.1' && f.roomServerTiming.joinWaitMs === 20000 && f.bannedWords[0] === '나쁜말', '★ 서버 묶음 모양 풀기 — room · app · user · bug · guestbook · gift 를 칸마다');
    chk(JSON.stringify(RCM.fieldsOf(null).minVersion) === '{}' && RCM.fieldsOf({ room: 3 }).roomLimits === undefined, '  ↳ 묶음이 없거나 객체가 아니면 그 칸은 없음(기본값으로)');

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
    chk(s.maxPeople() === 12 && s.inviteGate() === false && s.minAppVer() === '0.13.0' && s.minRoomVer() === '0.13.1' && s.bugDailyMax() === 9 && s.clapDailyMax() === 7 && s.giftDailySendMax() === 3
      && JSON.stringify(s.roomServerTiming()) === '{"joinWaitMs":20000,"clientGiveUpMs":90000}', 'API 응답 한 벌 — 칸마다 반영(연결 시간은 범위 밖 칸만 기본값)');
    chk(seen.includes('roomMaxPeople'), '  ↳ 정원이 바뀌면 roomMaxPeople 이름으로 알린다(화면 «최대 N명» 이 듣는 이름 그대로)');
    const bad = RCM.createRemoteConfig();
    bad.onChange(() => { throw new Error('boom'); });
    let ok = true; await quiet(() => { try{ bad.set('roomMaxPeople', 5); }catch(_){ ok = false; } });
    chk(ok && bad.maxPeople() === 5, '  ↳ 반영하는 쪽이 터져도 값은 들어간다');
    const r = RCM.createRemoteConfig();
    const t0 = Date.now();
    const v = await r.ready(['inviteGate', 'existingSignup'], 80);
    chk(Date.now() - t0 >= 70 && v.inviteGate === true, 'ready — 답이 없으면 시간 초과 뒤 지금 값(기본값)으로 간다');
    chk(RCM.store && typeof RCM.store.start === 'function', '앱 한 벌(store)이 있다');
  }

  say('── 2. 읽는 차례 — API → 저장값 → 기본값 · ETag · 다시 읽기 · 알림 · 배선');
  {
    const BASE = 'https://api.together-working.com';
    chk(RCM.CONFIG_PATH === '/v1/config' && /^tw\./.test(RCM.CACHE_KEY) && RCM.CACHE_VERSION === 2, '경로 /v1/config · 저장 키 tw. 접두사 · 저장 모양 2판');
    chk(RCM.REFRESH_MS === 5 * 60 * 1000 && RCM.STALE_MS === 60 * 1000 && API.TIMEOUT_MS <= 3000, '다시 읽기 5분 · 입장 때 1분 넘었으면 · API 3초 이하');

    // ① 정상
    let st = memStore();
    let f = mkFetch(() => okRes(DATA));
    let s = RCM.createRemoteConfig();
    await s.start({ api: mkApi(f), storage: st });
    s.stop();
    chk(f.calls.length === 1 && f.calls[0].url === BASE + '/v1/config' && !f.calls[0].init.headers.Authorization && f.calls[0].init.credentials === 'omit', '★ 켤 때 GET /v1/config 한 번 — 로그인 없이(토큰 · 쿠키 없음)');
    chk(s.roomLimitOf('workingroom') === 500 && s.maxPeople() === 12 && s.inviteGate() === false && s.minAppVer() === '0.13.0' && s.bugDailyMax() === 9 && s.answered() && s.source() === 'api', '  ↳ 받은 값 반영 · 첫 답 표시 · 출처 api');
    const saved = JSON.parse(st.m['tw.remoteConfig'] || 'null');
    chk(saved && saved.v === 2 && saved.data && saved.data.room.maxPeople === 12, '  ↳ 받은 묶음을 이 PC 에 저장(2판)');

    // ② 못 받음 → 저장값 → 기본값
    const down = mkFetch(() => { throw new TypeError('Failed to fetch'); });
    s = RCM.createRemoteConfig();
    await quiet(() => s.start({ api: mkApi(down), storage: memStore({ 'tw.remoteConfig': JSON.stringify({ v: 2, at: 1, data: DATA }) }) }));
    s.stop();
    chk(s.roomLimitOf('workingroom') === 500 && s.maxPeople() === 12 && s.inviteGate() === false && s.bugDailyMax() === 9 && s.answered() && s.source() === 'cache',
      '★ API 를 못 받으면 저장값(방 상한 · 정원 · 스위치 · 제보 상한)');
    chk(s.minAppVer() === null && s.minRoomVer() === null, '★ 최소 버전은 저장값을 쓰지 않는다(못 받으면 막지 않는다)');
    s = RCM.createRemoteConfig();
    await quiet(() => s.start({ api: mkApi(down), storage: memStore({ 'tw.remoteConfig': JSON.stringify({ data: { roomMaxPeople: 30, roomLimits: { workingroom: 9 } } }) }) }));
    s.stop();
    chk(s.maxPeople() === 10 && s.roomLimitOf('workingroom') === 300 && s.source() === 'default', '  ↳ 옛 판(평평한 칸 · 판 표시 없음)이 남긴 저장값은 읽지 않는다');
    s = RCM.createRemoteConfig();
    await quiet(() => s.start({ api: mkApi(down), storage: memStore() }));
    s.stop();
    chk(s.roomLimitOf('workingroom') === 300 && s.maxPeople() === 10 && s.inviteGate() === true && s.existingSignup() === true && s.bugDailyMax() === 5 && s.answered() && s.source() === 'default',
      '★ 처음 실행 · 못 받음 → 기본값');
    s = RCM.createRemoteConfig();
    await s.start({ api: null, storage: memStore() });
    s.stop();
    chk(s.answered() && s.source() === 'default', '  ↳ API 통로가 없으면 묻지 않고 기본값(답은 받은 것으로)');
    // ③ 봉투 · 모양 · 시간 초과
    const bads = [
      async () => ({ ok: true, status: 200, json: async () => ({ success: false, code: 'X' }) }),
      async () => ({ ok: false, status: 503, json: async () => ({}) }),
      async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('html'); } }),
      async () => ({ ok: true, status: 200, json: async () => ({ success: true }) }),
      async () => ({ ok: true, status: 200, json: async () => ({ success: true, data: { version: 1, config: { roomMaxPeople: 30 } } }) }),
      async () => ({ ok: false, status: 503, json: async () => ({ success: false, code: 'SERVER_ADMIN_ONLY' }) }),
    ];
    let allOk = true;
    for(const fn of bads){
      const s2 = RCM.createRemoteConfig();
      await quiet(() => s2.start({ api: mkApi(mkFetch(fn)), storage: memStore() }));
      s2.stop();
      if(s2.maxPeople() !== 10 || !s2.answered() || s2.source() !== 'default') allOk = false;
    }
    chk(allOk, '실패 봉투 · 5xx · 봉투 아닌 응답 · data 없음 · 옛 모양(config 칸) · 점검(503) → 못 받음으로(기본값 · 답은 받음)');
    const hang = RCM.createRemoteConfig();
    const t0 = Date.now();
    const w0 = console.warn; console.warn = () => {};
    hang.start({ api: mkApi(() => new Promise(() => {})), storage: memStore() });
    const v = await hang.ready(null, 300);
    hang.stop();
    chk(Date.now() - t0 < 1000 && v.roomMaxPeople === 10 && !hang.answered(), '★ API 가 멈춰도(답 없음) 부팅 대기는 ready 시간 상한까지만 — 기본값으로 간다');
    await new Promise((res) => setTimeout(res, API.TIMEOUT_MS + 200));
    console.warn = w0;
    chk(hang.answered(), '  ↳ 멈춘 요청도 API 시간 제한(api-client TIMEOUT_MS) 뒤 끊고 «못 받음» 으로 끝낸다');

    // ④ ETag · 다시 읽기 · 입장 때 STALE_MS
    let t = 1000;
    f = mkFetch((url, init) => (init.headers['If-None-Match'] === '"c1"' ? { ok: false, status: 304, headers: { get: () => null }, json: async () => { throw new Error('본문 없음'); } } : okRes(DATA, 200, { ETag: '"c1"' })));
    s = RCM.createRemoteConfig();
    await s.start({ api: mkApi(f), storage: memStore(), now: () => t });
    s.stop();
    await s.refresh({ maxAgeMs: RCM.STALE_MS });
    chk(f.calls.length === 1, '입장 때 refresh({ maxAgeMs }) — 1분 안이면 다시 묻지 않는다');
    t += RCM.STALE_MS + 1;
    await s.refresh({ maxAgeMs: RCM.STALE_MS });
    chk(f.calls.length === 2 && f.calls[1].init.headers['If-None-Match'] === '"c1"' && s.maxPeople() === 12 && s.source() === 'api', '★ 1분이 지났으면 한 번 더 — 같은 값이면 ETag 304(본문 없이) · 값 그대로');
    const ff = mkFetch(() => { throw new Error('down'); });
    const s3 = RCM.createRemoteConfig();
    await quiet(() => s3.start({ api: mkApi(ff), storage: memStore(), now: () => t }));
    s3.stop();
    await quiet(() => s3.refresh({ maxAgeMs: RCM.STALE_MS }));
    chk(ff.calls.length === 1, '  ↳ API 가 멈췄을 때도 1분 안에는 다시 기다리지 않는다(입장마다 시간 초과를 겪지 않게)');

    // ⑤ realtime 알림 config
    const hooks = {};
    const rt = { on: (kind, fn) => { hooks[kind] = fn; return () => {}; } };
    let n = 0;
    const fn = mkFetch(() => { n++; return okRes(Object.assign({}, DATA, { room: Object.assign({}, DATA.room, { maxPeople: 10 + n }) })); });
    s = RCM.createRemoteConfig();
    await s.start({ api: mkApi(fn), storage: memStore(), now: () => t, rt });
    s.stop();
    chk(typeof hooks.config === 'function' && Object.keys(hooks).join() === 'config', 'realtime 알림 — config 하나만 건다');
    await hooks.config({ kind: 'config', resync: false });
    await new Promise((res) => setTimeout(res, 0)); await s.refresh({ maxAgeMs: RCM.STALE_MS });
    chk(fn.calls.length === 2 && s.maxPeople() === 12, '★ 알림이 오면 1분 안이어도 바로 다시 묻는다(서버가 바꿨다)');

    // ⑥ firebase-init 배선
    const fi = strip(FI);
    chk(/_rc\.start\(\{\s*api: \(window\.TwApi && window\.TwApi\.client\) \|\| null,\s*storage: _lsOrNull\(\),\s*win: window,\s*rt: window\.TwRtHub\.store,/.test(fi),
      'firebase-init.js 가 store.start 로 앱 공통 API 통로(TwApi.client) · realtime 알림(TwRtHub.store)을 잇는다');
    chk(!/fallbackRead/.test(fi) && !/store\.watch/.test(fi) && !/'config\/(?!maintenance)/.test(fi) && !/ref\(db, 'config'\)/.test(fi), '  ↳ Firebase config 비상 읽기 · 구독 · 박힌 경로 없음(점검 칸만 — maintenance-gate.js)');
    chk(/readMin: \(\) => _rc \? _rc\.ready\(null, MIN_APP_VER_WAIT_MS\)\.then\(\(\) => _rc\.minAppVer\(\)\) : null,/.test(fi) && fi.indexOf('_rc.start(') < fi.indexOf('createAppVersionGate({'),
      '  ↳ 앱 최소 버전은 원격 설정의 첫 답(API 값만) — start 다음에 게이트');
    chk(!/getMinRoomVer/.test(fi) && /try\{ await s\.refresh\(\{ maxAgeMs: ROOM_VER_MAX_AGE_MS \}\); \}catch\(_\)\{\}\s*const min = s\.minRoomVer\(\);/.test(strip(APP)) && /const ROOM_VER_MAX_AGE_MS = 60 \* 1000;/.test(APP),
      '  ↳ 방 입장 최소 버전 — 방 입장(room-entry)이 store 를 바로 본다 · 1분 넘었으면 다시 묻고 API 값(못 받으면 null = 통과)');
    chk(/getDailyMax: \(\) => _rc \? _rc\.refresh\(\{ maxAgeMs: window\.TwRemoteConfig\.STALE_MS \}\)\.then\(\(\) => _rc\.bugDailyMax\(\)\) : null,/.test(fi), '  ↳ 제보 하루 상한도 원격 설정');
    chk(!/window\.MAX_PEOPLE/.test(fi) && !/_capturedMeta/.test(fi), '  ↳ firebase-init 에 정원 판정이 없다(정원 · 자기 퇴장은 서버 — window.MAX_PEOPLE 안 씀)');
    chk(!/^\s*import\s/m.test(RC) && !/gstatic|getDatabase|require\(|fallbackRead/.test(strip(RC)), 'remote-config.js 는 Firebase 를 모른다(import · 비상 읽기 없음)');
  }

  say('── 3. 규칙 — 읽기 · 쓰기 · validate');
  {
    const R = JSON.parse(RULES_TXT).rules;
    const cfg = R.config;
    const ADMIN = "auth != null && root.child('admins').child(auth.uid).val() === true";
    const run = (expr, val) => {
      const nd = { isNumber: () => typeof val === 'number', isBoolean: () => typeof val === 'boolean', isString: () => typeof val === 'string', val: () => val, exists: () => val != null };
      // 경로 키 형식 조건(개정 319)이 있어 경로 변수엔 정상 키를 넣는다 — 여기서 보는 것은 값 조건이다
      const P = String.prototype; P.matches = function (re) { return re.test(String(this)); }; P.beginsWith = P.startsWith;
      try { return Function('newData', '$date', 'return (' + expr + ');')(nd, '2026-10-17'); }
      finally { delete P.matches; delete P.beginsWith; }
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
    const cfm = takeFn(a, 'function _channelFullMsg(');
    chk(cfm && /const limit = roomLimitOf\(channel\)/.test(cfm), '꽉 찼을 때 문구 — 설정 상한(판정은 서버 channelFull)');
    const counts = a.match(/\$\{roomLimitOf\('(workingroom|togetherroom)'\)\}/g) || [];
    chk(counts.length === 0, '방 개수 «n / 상한» 표시는 없다 — 채널 카드는 방 목록 로비로 바뀌었다(상한은 만들기 · 빈 방 열기 검사만) (' + counts.length + ')');
    const jm = takeFn(a, 'function _roomJoinMessage(');
    chk(jm && /const ch = window\._pendingRoomChannel \|\| /.test(jm) && /return _channelFullMsg\(ch\);/.test(jm), '서버 channelFull 문구 — 설정 상한 · 만들기면 그 채널 · 빈 방이면 내 자격의 채널');
    chk((a.match(/maxPeople\(\)/g) || []).length >= 8, '정원 사용처 전부 maxPeople() (' + (a.match(/maxPeople\(\)/g) || []).length + ')');
    const ig = takeFn(a, '(function initInviteGate(');
    chk(ig && /await _s\.ready\(\['inviteGate','existingSignup'\], REMOTE_FLAGS_WAIT_MS\)/.test(ig) && ig.indexOf('_s.ready(') < ig.indexOf('checkInviteGate()') && /const REMOTE_FLAGS_WAIT_MS = 3000;/.test(a),
      '부팅 스위치 — 첫 답을 최대 3초 기다린 뒤 초대 게이트(못 받으면 기본값 true)');
    chk(/if\(!inviteGateOn\(\)\)\{/.test(a) && /if\(!existingSignupOn\(\)\) return null;/.test(a), '  ↳ 게이트 · 가입 강제가 스위치 함수를 본다');

    // 화면 숫자 다시 그리기 — 가짜 DOM(«최대 N명» 자리)
    const spans = [{ textContent: '10' }, { textContent: '10' }];
    const doc = { getElementById: () => null, querySelectorAll: (q) => (q === '[data-tw-max-people]' ? spans : []) };
    const st = RCM.createRemoteConfig();
    const src = [takeFn(a, 'function maxPeople('), takeFn(a, 'function _paintMaxPeople('), 'return { _paintMaxPeople };'].join('\n');
    const U = Function('document', '_rcStore', src)(doc, () => st);
    st.set('roomMaxPeople', 12);
    U._paintMaxPeople();
    chk(spans.every((x) => x.textContent === '12'), '설정이 바뀌면 «최대 N명» 자리만 바뀐다(읽기 없음)');
    chk(/s\.onChange\(\(c, key\)=>\{ if\(key === 'roomMaxPeople'\) _paintMaxPeople\(\); \}\);/.test(a), '  ↳ onChange 에 묶여 있다');
  }

  say('── 5. 입장 거절 문구 — 설정 상한(판정은 서버 · 0.13)');
  {
    const a = strip(APP);
    const need = ['function _roomJoinMessage(', 'function _channelFullMsg(', 'function roomLimitOf(', 'function maxPeople(', 'function _myRoomLicensed('];
    const miss = need.filter((h) => !takeFn(a, h));
    chk(miss.length === 0, '함수들이 있다' + (miss.length ? ' — 없음: ' + miss.join(', ') : ''));
    if(miss.length) return finish();
    const RS = (() => { const w = {}; Function('window', read('room-settings.js'))(w); return w.TwRoomSettings; })();
    const SRC = [
      "const CHANNEL_NAMES = { workingroom: '워킹룸', togetherroom: '투게더룸' };",
      "const ROOM_JOIN_BUSY_MSG = '서버에 연결하지 못했어요 — 잠시 후 다시 시도해 주세요';",
      "const ROOM_LOST_MSG = { version: 'VER' };",
      ...need.map((h) => takeFn(a, h)),
      'return _roomJoinMessage;',
    ].join('\n');
    const mk = (o) => {
      const st = RCM.createRemoteConfig();
      if(o.limits) st.set('roomLimits', o.limits);
      if(o.max) st.set('roomMaxPeople', o.max);
      return Function('window', '_rcStore', 'isPremium', 'isAdmin', 'roomSettings', SRC)({ _pendingRoomChannel: o.pending || null }, () => st, () => !!o.premium, () => false, RS);
    };
    chk(/투게더룸이 지금 꽉 찼어요\(77\/77\)/.test(mk({ premium: true, limits: { workingroom: 300, togetherroom: 77 } })('channelFull', false)), '★ channelFull — 빈 방(만들기 아님)이면 내 자격의 채널 · 설정 상한');
    chk(/워킹룸이 지금 꽉 찼어요\(20\/20\)/.test(mk({ pending: 'workingroom', premium: true, limits: { workingroom: 20, togetherroom: 300 } })('channelFull', false)), '  ↳ 만들기면 고른 채널');
    chk(/최대 12명/.test(mk({ max: 12 })('full', false)) && /방장 자리 제외 최대 11명/.test(mk({ max: 12 })('full', true)), '  ↳ 정원 문구도 설정값(시크릿룸은 방장 자리 빼고)');
    chk(mk({})('weird', false) === '서버에 연결하지 못했어요 — 잠시 후 다시 시도해 주세요' && mk({})('version', false) === 'VER', '  ↳ 모르는 코드는 «잠시 후 다시» · version 은 업데이트 안내');
  }

  say('── 6. html — 순서 · 기본 표시 · CSP');
  {
    const iRc = HTML.indexOf('<script src="parts/shared/remote-config.js"></script>'), iApp = HTML.indexOf('<script src="parts/app.js"></script>');
    const iApi = HTML.indexOf('<script src="parts/shared/api-client.js"></script>');
    chk(iRc > 0 && iApp > iRc && iApi > 0 && iApi < iRc, 'api-client.js → remote-config.js → app.js 차례로 싣는다(firebase-init.js 는 module 이라 그 뒤에 돈다)');
    chk(!/id="chCountWorking"/.test(HTML) && !/— \/ 250/.test(HTML), '채널 카드의 «n / 상한» 칸은 방 목록 로비로 바뀌어 없다(그리는 쪽은 칸이 없으면 건너뛴다 — 위 가짜 칸 시험)');
    chk((HTML.match(/<span data-tw-max-people>10<\/span>/g) || []).length === 2 && !/최대 10명/.test(HTML), '«최대 10명» 두 곳이 설정을 따라가는 자리(채널 카드 두 곳은 로비로 바뀌어 없다)');
    const csp = [...HTML.matchAll(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/g)].map((m) => m[1]);
    const conn = csp.map((c) => (/connect-src ([^;]+);/.exec(c) || [])[1] || '');
    const has = (c, pre, dom) => new RegExp('(^| )' + pre + ':\\/\\/\\*\\.' + dom.replace(/\./g, '\\.') + '( |$)').test(c);
    chk(csp.length === 2 && conn.every((c) => ['together-working.com', 'togetherworking.duckdns.org'].every((d) => has(c, 'wss', d) && has(c, 'https', d))),
      'CSP 두 줄 — wss · https://*.together-working.com(새 도메인) · *.togetherworking.duckdns.org(옛 주소 — 옛 설정값 · dev)');
    chk(/^https:\/\/[a-z0-9-]+\.together-working\.com$/.test(require(path.resolve(where('api-client.js'))).API_BASE_PROD), '  ↳ API 주소(api-client.js API_BASE_PROD)도 새 https 와일드카드 안(CSP 를 따로 열지 않음)');
    chk(conn.every((c) => !/rooms(-dev)?\.togetherworking/.test(c) && !/\bws:\/\/\*|wss:\/\/\*\.duckdns|\*\.duckdns\.org|https?:\/\/\*( |$)|\*\.com( |$)|\*-working/.test(c)), '  ↳ 다른 도메인은 그대로 막는다(duckdns 전체 · .com 전체 · ws 와일드카드 없음)');
  }
  say('── 7. 일부러 깨 보기');
  {
    const loadRc = (src) => { const m = { exports: {} }; new Function('module', 'window', 'console', src)(m, undefined, { warn(){} }); return m.exports; };
    async function probe(src){
      let bad = 0;
      const ok = (c) => { if(!c) bad++; };
      let M; try{ M = loadRc(src); }catch(_){ return 99; }
      try{
        const s1 = M.createRemoteConfig();
        await s1.start({ api: mkApi(mkFetch(() => okRes(DATA))), storage: memStore() }); s1.stop();
        ok(s1.maxPeople() === 12 && s1.minAppVer() === '0.13.0' && s1.minRoomVer() === '0.13.1' && s1.clapDailyMax() === 7 && s1.giftDailySendMax() === 3 && s1.inviteGate() === false);
        const s2 = M.createRemoteConfig();
        await s2.start({ api: mkApi(mkFetch(() => { throw new TypeError('x'); })), storage: memStore({ 'tw.remoteConfig': JSON.stringify({ v: 2, at: 1, data: DATA }) }) }); s2.stop();
        ok(s2.maxPeople() === 12 && s2.minAppVer() === null);
        const s3 = M.createRemoteConfig();
        await s3.start({ api: mkApi(mkFetch(() => { throw new TypeError('x'); })), storage: memStore({ 'tw.remoteConfig': JSON.stringify({ data: { room: { maxPeople: 30 } } }) }) }); s3.stop();
        ok(s3.maxPeople() === 10);
        const s4 = M.createRemoteConfig();
        await s4.start({ api: mkApi(mkFetch(() => okRes({ config: { roomMaxPeople: 30 } }))), storage: memStore() }); s4.stop();
        ok(s4.source() === 'default');
        const hooks = {}; let n = 0;
        const s5 = M.createRemoteConfig();
        await s5.start({ api: mkApi(mkFetch(() => { n++; return okRes(DATA); })), storage: memStore(), rt: { on: (k, fn) => { hooks[k] = fn; } } }); s5.stop();
        if(hooks.config) await hooks.config({}); await new Promise((r) => setTimeout(r, 0));
        ok(n === 2);
        ok(M.cleanTiming({ joinWaitMs: 2999 }).joinWaitMs === 10000 && M.cleanClapDailyMax(101) === 5);
      }catch(_){ bad++; }
      return bad;
    }
    chk((await probe(RC)) === 0, '원본은 핵심 동작을 다 지킨다');
    const BREAKS = [
      ["    for(const k of KEYS){ if(fromCache && k === 'minVersion') continue; set(k, f[k]); }", "    for(const k of KEYS){ set(k, f[k]); }", '저장값의 최소 버전으로 막음'],
      ["      if(!isObj(c) || c.v !== CACHE_VERSION || !looksLikeConfig(c.data)) return false;", "      if(!isObj(c)) return false;", '옛 모양 저장값을 읽음'],
      ["        if(!looksLikeConfig(data)) throw new Error('설정 모양이 아님');", "", '엉뚱한 응답을 받은 값으로 봄'],
      ["    if(opts.rt) opts.rt.on('config', () => { refresh(); });", "", 'realtime 알림을 안 들음'],
      ["    if(opts.rt) opts.rt.on('config', () => { refresh(); });", "    if(opts.rt) opts.rt.on('config', () => { refresh({ maxAgeMs: STALE_MS }); });", '알림이 와도 1분 안이면 안 물음'],
      ["    minVersion: { app: pick(d.app, 'minVersion'), room: pick(room, 'minVersion') },", "    minVersion: { app: pick(room, 'minVersion'), room: pick(room, 'minVersion') },", '앱 최소 버전을 방 칸에서 읽음'],
      ["    clapDailyMax: pick(d.guestbook, 'clapDailyMax'), giftDailySendMax: pick(d.gift, 'dailySendMax'),", "    clapDailyMax: pick(d.guestbook, 'dailyMax'), giftDailySendMax: pick(d.gift, 'dailyMax'),", '박수 · 선물 칸 이름이 틀림'],
      ["    inviteGate: pick(d.user, 'inviteGate'),", "    inviteGate: pick(d, 'inviteGate'),", '초대 게이트를 엉뚱한 자리에서 읽음'],
      ["const CLAP_DAILY_MIN = 1, CLAP_DAILY_MAX = 100;", "const CLAP_DAILY_MIN = 1, CLAP_DAILY_MAX = 1000;", '박수 상한 범위가 서버와 다름'],
      ["  joinWaitMs: Object.freeze([3000, 60000, 10000]),", "  joinWaitMs: Object.freeze([0, 60000, 10000]),", '입장 대기 범위가 서버와 다름'],
    ];
    const missed = [];
    for(const [from, to, what] of BREAKS){
      if(RC.indexOf(from) < 0){ missed.push('글 못 찾음: ' + what); continue; }
      if((await probe(RC.split(from).join(to))) === 0) missed.push(what);
    }
    chk(!missed.length, '일부러 깨 본 ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — 못 잡음: ' + missed.join(' · ') : ''));
  }
  finish();
})().catch((e) => { fail++; say('  ✗ 예외: ' + (e && e.stack || e)); finish(); });

function finish(){
  say('\n' + pass + ' · ' + fail);
  process.exit(fail ? 1 : 0);
}
