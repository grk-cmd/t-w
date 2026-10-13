/* ═══ ⚙️ sim-remote-config.js — 원격 설정(방 상한 · 정원 · 가입 스위치) ═══════════════
   [왜] 채널당 방 개수 상한 250 이 앱 코드에 박혀 있어 운영 사고(10-13) 때 바로 바꿀 수 없었다.
     config/roomLimits · config/roomMaxPeople · config/flags/{inviteGate, existingSignup} 를 앱이 구독한다.
   1. remote-config.js 실행 — 기본값(300 · 10 · true) · 범위 밖 · 타입이 다른 값 무시 · 바뀔 때만 알림 · 못 읽으면 그대로 · ready 시간 초과
   2. 구독 — 칸 넷만(config 통째 아님) · 끊기 · firebase-init 배선
   3. 규칙 — 누구나 읽기 · 관리자만 쓰기 · 범위 · 타입 · 모르는 칸 거절(식을 직접 돌려 본다) · 제보 하루 상한 100
   4. app.js 배선 — 박힌 상수 없음 · 사용처가 설정값 · 부팅 스위치는 첫 답을 기다림 · 화면 숫자 다시 그리기
   5. 방 서버 길(_startRoomOnServer) 빈 방 열기 상한 — 실행 · 되살리기(주소록) · 시크릿룸 · 만들기 · 있는 방은 검사 안 함
   6. html — 스크립트 순서 · 기본 표시 300 · 최대 N명 자리 · CSP 방 서버 와일드카드
   [실행] 러너 스테이징(평평한 폴더) 또는 checks/ 에서. */
'use strict';
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const DIRS = ['.', 'parts', 'app', path.join('app', 'parts'), '..', path.join('..', 'app'), path.join('..', 'app', 'parts')];
const read = (f) => { for(const d of DIRS){ try{ return fs.readFileSync(path.join(d, f), 'utf8'); }catch(_){} } return null; };
const where = (f) => { for(const d of DIRS){ const p = path.join(d, f); if(fs.existsSync(p)) return p; } return null; };
const RC = read('remote-config.js'), APP = read('app.js'), FI = read('firebase-init.js'),
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
  say('── 1. remote-config.js — 기본값 · 범위 · 타입');
  {
    const D = RCM.DEFAULTS;
    chk(D.roomLimits.workingroom === 300 && D.roomLimits.togetherroom === 300 && D.roomMaxPeople === 10 && D.inviteGate === true && D.existingSignup === true,
      '기본값 — 방 상한 300 · 정원 10 · 초대 게이트 켜짐 · 가입 강제 켜짐(상한만 250 → 300 · 나머지는 예전 그대로)');
    chk(Object.isFrozen(D) && Object.isFrozen(D.roomLimits), '  ↳ 기본값은 얼려 둔다(실수로 바뀌지 않게)');
    const s = RCM.createRemoteConfig();
    chk(s.roomLimitOf('workingroom') === 300 && s.roomLimitOf('togetherroom') === 300 && s.maxPeople() === 10 && s.inviteGate() === true && s.existingSignup() === true,
      '설정이 하나도 없으면(아직 못 받음) 기본값');
    chk(s.roomLimitOf('???') === 300, '  ↳ 모르는 채널은 워킹룸 상한');
    const L = RCM.cleanRoomLimits;
    chk(JSON.stringify(L({ workingroom: 500, togetherroom: 1 })) === '{"workingroom":500,"togetherroom":1}' && L({ workingroom: 10000 }).workingroom === 10000,
      '방 상한 1~10000 정수는 그대로');
    chk([0, -1, 10001, 2.5, '400', NaN, Infinity, null, true].every((v) => L({ workingroom: v }).workingroom === 300), '  ↳ 범위 밖 · 소수 · 문자열 · NaN · 무한 · null · 불리언 → 300');
    chk(L({ workingroom: 400 }).togetherroom === 300 && L(null).workingroom === 300 && L('x').workingroom === 300 && L(7).togetherroom === 300, '  ↳ 한 칸만 있으면 나머지는 300 · 객체가 아니면 둘 다 300');
    const P = RCM.cleanMaxPeople;
    chk(P(2) === 2 && P(50) === 50 && P(12) === 12, '정원 2~50 정수는 그대로');
    chk([1, 0, 51, 9.5, '12', null, undefined, false].every((v) => P(v) === 10), '  ↳ 범위 밖 · 소수 · 문자열 · 없음 → 10');
    const F = RCM.cleanFlag;
    chk(F(false, true) === false && F(true, true) === true && F('false', true) === true && F(0, true) === true && F(null, true) === true, '스위치는 불리언만 — "false" · 0 · null 은 기본값(true)');

    const seen = [];
    s.onChange((c, k) => seen.push(k));
    chk(s.set('roomLimits', { workingroom: 500, togetherroom: 400 }) === true && s.roomLimitOf('workingroom') === 500 && s.roomLimitOf('togetherroom') === 400 && seen.join() === 'roomLimits',
      '값을 받으면 바로 반영 · 알림 한 번');
    chk(s.set('roomLimits', { workingroom: 500, togetherroom: 400 }) === false && seen.length === 1, '  ↳ 같은 값이면 알리지 않는다');
    s.set('roomLimits', null);
    chk(s.roomLimitOf('workingroom') === 300 && seen.length === 2, '  ↳ 칸이 지워지면(null) 기본값으로 돌아간다');
    s.set('roomMaxPeople', 99);
    chk(s.maxPeople() === 10 && seen.length === 2, '  ↳ 범위 밖 값은 무시(기본값 그대로 · 알림 없음)');
    s.set('roomMaxPeople', 12); s.set('inviteGate', false); s.set('existingSignup', false);
    chk(s.maxPeople() === 12 && s.inviteGate() === false && s.existingSignup() === false && seen.slice(2).join() === 'roomMaxPeople,inviteGate,existingSignup', '  ↳ 정원 · 두 스위치도 같은 길');
    s.fail('roomMaxPeople');
    chk(s.maxPeople() === 12, '못 읽음(거부 · 끊김)이면 마지막 값 그대로');
    chk(s.set('nope', 1) === false && !('nope' in s.get()), '  ↳ 모르는 칸은 받지 않는다');
    const bad = RCM.createRemoteConfig();
    bad.onChange(() => { throw new Error('boom'); });
    const w0 = console.warn; console.warn = () => {};
    let ok = true; try{ bad.set('roomMaxPeople', 5); }catch(_){ ok = false; }
    console.warn = w0;
    chk(ok && bad.maxPeople() === 5, '  ↳ 반영하는 쪽이 터져도 값은 들어간다');

    const r = RCM.createRemoteConfig();
    const t0 = Date.now();
    const v = await r.ready(['inviteGate', 'existingSignup'], 80);
    chk(Date.now() - t0 >= 70 && v.inviteGate === true && v.existingSignup === true, 'ready — 답이 없으면 시간 초과 뒤 기본값(true)으로 간다');
    const r2 = RCM.createRemoteConfig();
    const p = r2.ready(['inviteGate', 'existingSignup'], 5000);
    let done = null; p.then((x) => { done = x; });
    r2.set('inviteGate', false); await new Promise((res) => setTimeout(res, 0));
    chk(done === null, '  ↳ 두 칸 다 답이 올 때까지 기다린다');
    r2.fail('existingSignup'); await new Promise((res) => setTimeout(res, 0));
    chk(done && done.inviteGate === false && done.existingSignup === true, '  ↳ 하나는 값 · 하나는 못 읽음이어도 바로 끝난다(값 · 기본값)');
    chk((await r2.ready(['inviteGate'], 1)).inviteGate === false, '  ↳ 이미 답이 있으면 곧장');
    chk(RCM.store && typeof RCM.store.watch === 'function', '앱 한 벌(store)이 있다');
  }

  say('── 2. 구독 — 칸 넷만 · 끊기 · firebase-init 배선');
  {
    const s = RCM.createRemoteConfig();
    const subs = [], offs = [];
    const off = s.watch((p, onVal, onErr) => { subs.push({ p, onVal, onErr }); return () => offs.push(p); });
    chk(subs.map((x) => x.p).sort().join() === 'config/flags/existingSignup,config/flags/inviteGate,config/roomLimits,config/roomMaxPeople',
      '경로 넷 — config/roomLimits · config/roomMaxPeople · config/flags/inviteGate · config/flags/existingSignup');
    chk(!subs.some((x) => x.p === 'config' || x.p === 'config/flags'), '  ↳ config · config/flags 를 통째로 구독하지 않는다');
    subs.find((x) => x.p === 'config/roomLimits').onVal({ workingroom: 700, togetherroom: 800 });
    subs.find((x) => x.p === 'config/roomMaxPeople').onErr(new Error('permission_denied'));
    chk(s.roomLimitOf('togetherroom') === 800 && s.maxPeople() === 10, '  ↳ 받은 칸은 반영 · 거부된 칸은 기본값');
    off();
    chk(offs.length === 4, '  ↳ 끊으면 넷 다 끊는다');
    const s2 = RCM.createRemoteConfig();
    s2.watch(() => { throw new Error('no db'); });
    chk((await s2.ready(null, 1000)).roomMaxPeople === 10, '  ↳ 구독 자체가 실패해도 기다리는 쪽이 서지 않는다(기본값)');
    const fi = strip(FI);
    chk(/window\.TwRemoteConfig\.store\.watch\(\(path, onVal, onErr\) => onValue\(ref\(db, path\), s => onVal\(s\.val\(\)\), onErr\)\)/.test(fi),
      'firebase-init.js 가 store.watch 로 onValue(ref(db, 경로)) 를 잇는다(취소 콜백 = 못 읽음)');
    chk(!/ref\(db, 'config'\)/.test(fi) && !/ref\(db, 'config\/flags'\)/.test(fi), '  ↳ config 통째 읽기 없음');
    chk(/const _cap = \(window\.TwRemoteConfig && window\.TwRemoteConfig\.store\) \? window\.TwRemoteConfig\.store\.maxPeople\(\) : 10;/.test(fi) && !/window\.MAX_PEOPLE/.test(fi),
      '  ↳ 정원 초과 자기 퇴장도 같은 store 의 정원(window.MAX_PEOPLE 안 씀)');
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
      'const ROOM_SERVER_FOLLOW_WAIT_MS = 3000;',
      "const ROOM_CODE_RE = /^(COZY|WORK|PLAY)-([A-Z0-9]{4})$/;",
      "function _roomPrefixFor(ch){ return ch === 'togetherroom' ? 'PLAY-' : 'WORK-'; }",
      ...need.map((h) => takeFn(a, h)),
      'return _startRoomOnServer;',
    ].join('\n');
    function mk(o){
      o = o || {};
      const log = { toasts: [], counts: [], started: 0, peek: 0 };
      const st = RCM.createRemoteConfig();
      if(o.limits) st.set('roomLimits', o.limits);
      const win = { _pendingRoomChannel: o.pending || null, _pendingRoomOpen: false };
      const net = {
        ensureReady: async () => ({ ok: true }),
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
  }

  say('── 6. html — 순서 · 기본 표시 · CSP');
  {
    const iRc = HTML.indexOf('<script src="parts/remote-config.js"></script>'), iApp = HTML.indexOf('<script src="parts/app.js"></script>');
    chk(iRc > 0 && iApp > iRc, 'remote-config.js 를 app.js 앞에 싣는다(firebase-init.js 는 module 이라 그 뒤에 돈다)');
    chk(/id="chCountWorking">— \/ 300</.test(HTML) && /id="chCountTogether">— \/ 300</.test(HTML) && !/— \/ 250/.test(HTML), '방 개수 기본 표시 «— / 300»(기본 상한과 같다)');
    chk((HTML.match(/<span data-tw-max-people>10<\/span>/g) || []).length === 4 && !/최대 10명/.test(HTML), '«최대 10명» 네 곳이 설정을 따라가는 자리');
    const csp = [...HTML.matchAll(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/g)].map((m) => m[1]);
    const conn = csp.map((c) => (/connect-src ([^;]+);/.exec(c) || [])[1] || '');
    chk(csp.length === 2 && conn.every((c) => /(^| )wss:\/\/\*\.togetherworking\.duckdns\.org( |$)/.test(c) && /(^| )https:\/\/\*\.togetherworking\.duckdns\.org( |$)/.test(c)),
      'CSP 두 줄 — wss · https://*.togetherworking.duckdns.org');
    chk(conn.every((c) => !/rooms(-dev)?\.togetherworking/.test(c) && !/\bws:\/\/\*|wss:\/\/\*\.duckdns|\*\.duckdns\.org|https?:\/\/\*( |$)/.test(c)), '  ↳ 다른 도메인은 그대로 막는다(duckdns 전체 · ws 와일드카드 없음)');
  }
  finish();
})().catch((e) => { fail++; say('  ✗ 예외: ' + (e && e.stack || e)); finish(); });

function finish(){
  say('\n' + pass + ' · ' + fail);
  process.exit(fail ? 1 : 0);
}
