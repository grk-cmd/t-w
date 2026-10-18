/*
 * 앱 버전(ver)을 presence 와 라이선스 요청에 싣는가 — 웹 관리자가 사용자 · 요청마다 버전을 본다.
 * 1. app-version.js 를 그대로 불러 돌린다 — 정상 · companion 없음 · 실패 · 이상한 값
 * 2. firebase-init.js — presence 를 통째로 쓰는 자리(set · onDisconnect().set) 전부 ver 를 싣는가 · 늦게 오면 메우는가
 * 3. 규칙 — presence/ver · licenseRequests ver 를 실제로 굴린다(없어도 통과 · 문자열 · 20자)
 * 4. accountSnap ver — 웹 관리자가 사용자 목록 한 번으로 버전을 센다. setAccountSnapshot 을 떼어 와 가짜 update 로 돌린다.
 * 5. presence 쓰기를 실제로 돌린다 — 버전이 늦게 · 못 · 영영 안 와도 online:true · inRoom 을 ver 없이 쓰는 일이 없는가
 *    (규칙은 online:true 인데 ver 가 없으면 옛 앱으로 보고 그 사람의 읽기 · 쓰기를 막는다) · 깨 보기.
 */
'use strict';
const fs = require('fs');
const vm = require('vm');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = (...names) => { for(const n of names){ const s = read(n); if(s != null) return s; } say('  ? 원본 못 찾음 — ' + names[0]); process.exit(2); };
const AV = need('app-version.js', 'parts/shared/app-version.js', 'app/parts/shared/app-version.js');
const FI = need('firebase-init.js', 'parts/firebase-init.js', 'app/parts/firebase-init.js');
const RULES = JSON.parse(need('firebase-database-rules.json')).rules;
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const CODE = strip(FI);
const mod = new Function(AV.replace(/^export (function|const) /mg, '$1 ') + '\nreturn { createAppVersion, cleanAppVer, APP_VER_MAX, APP_VER_UNKNOWN };')();

(async () => {
  say('── 1. app-version.js');
  {
    const { createAppVersion, cleanAppVer, APP_VER_MAX, APP_VER_UNKNOWN } = mod;
    const UNK = APP_VER_UNKNOWN;
    chk(APP_VER_MAX === 20, '길이 상한 20 — 규칙과 같다');
    chk(typeof UNK === 'string' && cleanAppVer(UNK) === UNK, '모를 때 싣는 값도 규칙 모양(문자열 · 20자 이하 · 허용 글자)');
    chk(cleanAppVer('0.10.3') === '0.10.3' && cleanAppVer('0.10.3-beta.1') === '0.10.3-beta.1', '버전 모양 문자열은 그대로');
    chk([null, undefined, 3, '', 'x'.repeat(21), '0.1 <b>', {}].every(v => cleanAppVer(v) === null), '  ↳ 문자열이 아니거나 · 빈칸 · 21자 · 이상한 글자는 null');

    let got = [];
    const a = createAppVersion({ getVersion: async () => '0.10.3', onReady: v => got.push(v) });
    chk(a.get() === null && a.withVer({ online: true }).ver === UNK, '★ 받기 전: get() 은 null 이지만 쓰는 객체엔 «모름» ver — ver 없는 online:true 는 규칙이 옛 앱으로 막는다');
    chk(await a.ready === '0.10.3' && a.get() === '0.10.3', '★ 받은 뒤: get() = 버전');
    chk(JSON.stringify(a.withVer({ online: false, lastSeen: 1 })) === '{"online":false,"lastSeen":1,"ver":"0.10.3"}', '  ↳ withVer 가 ver 한 칸만 붙인다');
    chk(got.length === 1 && got[0] === '0.10.3', '  ↳ onReady 는 한 번');

    got = [];
    const b = createAppVersion({ getVersion: () => null, onReady: v => got.push(v) });
    chk(await b.ready === null && got.length === 0 && b.withVer({ online: true }).ver === UNK, '★ companion 없음(웹 · 검사): ready 는 null · onReady 안 부름 · 그래도 ver 는 «모름» 으로 싣는다');
    const c = createAppVersion({ getVersion: () => { throw new Error('x'); }, onReady: v => got.push(v) });
    const d = createAppVersion({ getVersion: () => Promise.reject(new Error('ipc')), onReady: v => got.push(v) });
    chk(await c.ready === null && await d.ready === null && got.length === 0, '  ↳ 던지거나 · 거부돼도 앱이 안 깨진다(null)');
    chk(c.withVer({ online: false, inRoom: false }).ver === UNK && d.withVer({ online: true }).ver === UNK, '  ↳ 못 받아도 쓰는 객체엔 ver 가 있다');
    const e = createAppVersion({ getVersion: async () => 'x'.repeat(40) });
    chk(await e.ready === null && e.withVer({}).ver === UNK, '  ↳ 규칙이 거절할 값(21자 이상)은 처음부터 안 싣는다(«모름» 으로)');
    const f = createAppVersion({ getVersion: async () => '1.0.0', onReady: () => { throw new Error('boom'); } });
    chk(await f.ready === '1.0.0', '  ↳ onReady 가 던져도 ready 는 끝난다');
  }

  say('── 2. firebase-init.js — presence 를 통째로 쓰는 자리');
  {
    chk(/import \{ createAppVersion \} from "\.\/(?:(?:\.\.\/)?[\w-]+\/)?app-version\.js";/.test(CODE), 'app-version.js 를 불러온다');
    chk(/getVersion: \(\) => \(window\.companion && window\.companion\.getAppVersion\) \? window\.companion\.getAppVersion\(\) : null/.test(CODE),
      '★ companion 이 없으면 getAppVersion 을 부르지 않는다');
    // presence ref 로 하는 set · onDisconnect().set 을 모두 찾는다 — 하나라도 ver 없이 쓰면 그 순간 버전이 지워진다.
    const sets = [...CODE.matchAll(/(?:onDisconnect\(_myPresenceRef\)\.set|[^.\w]set)\(\s*_myPresenceRef\s*,?|onDisconnect\(_myPresenceRef\)\.set\(/g)];
    const odSets = [...CODE.matchAll(/onDisconnect\(_myPresenceRef\)\.set\(([^\n]*)/g)].map(m => m[1]);
    const plainSets = [...CODE.matchAll(/[^.\w]set\(_myPresenceRef,\s*([^\n]*)/g)].map(m => m[1]);
    chk(sets.length >= 4 && odSets.length >= 3 && plainSets.length >= 2,
      `presence 를 통째로 쓰는 자리 — onDisconnect().set ${odSets.length} · set ${plainSets.length}`);
    chk(odSets.every(s => /^_appVer\.withVer\(/.test(s)), '★ onDisconnect().set 전부 ver 를 싣는다 — 꺼진 뒤에도 버전이 남는다');
    chk(plainSets.every(s => /^_appVer\.withVer\(/.test(s)), '★ set 전부 ver 를 싣는다');
    chk(!/ref\(db,\s*`users\/\$\{[^}]+\}\/presence`\)\s*,/.test(CODE.replace(/get\(ref\(db,\s*`users\/\$\{[^}]+\}\/presence`\)\)/g, '')),
      '  ↳ _myPresenceRef 를 거치지 않고 presence 를 직접 쓰는 곳은 없다');
    chk((CODE.match(/_presenceWritten = true;/g) || []).length === plainSets.length, '  ↳ set 하는 자리마다 «썼다» 표시');
    const ready = (CODE.match(/onReady: \(ver\) => \{([\s\S]*?)\n    \},/) || [])[1] || '';
    chk(/if\(!_myPresenceRef \|\| !_presenceWritten\) return;/.test(ready), '★ 버전이 늦게 오면 — presence 를 이미 썼을 때만 메운다');
    chk(/update\(_myPresenceRef, \{ ver \}\)/.test(ready), '  ↳ ver 만 update(부분 쓰기 — online · room 은 그대로)');
    chk(/onDisconnect\(_myPresenceRef\)\.set\(_appVer\.withVer\(/.test(ready), '  ↳ onDisconnect 도 ver 를 실어 다시 건다');
    const req = (CODE.match(/async requestLicense\(name\)\{([\s\S]*?)\n    \},/) || [])[1] || '';
    chk(/await _appVer\.ready;/.test(req) && /set\(ref\(db, `licenseRequests\/\$\{reqId\}`\), _appVer\.withVer\(\{/.test(req),
      '★ 라이선스 요청에도 ver — 버전을 받은 뒤에 쓴다');
  }

  say('── 3. 규칙 — 실제로 굴린다');
  {
    const at = p => p.split('/').reduce((o, k) => (o && o[k] !== undefined) ? o[k] : undefined, RULES);
    const snap = (val) => ({
      exists: () => val !== null && val !== undefined,
      val: () => val,
      isString: () => typeof val === 'string',
      isBoolean: () => typeof val === 'boolean',
      isNumber: () => typeof val === 'number',
      hasChildren: (ks) => ks.every(k => val && val[k] !== undefined),
      child: (k) => snap(val && val[k] !== undefined ? val[k] : null),
    });
    const run = (expr, v) => {
      if(typeof expr !== 'string') return expr === undefined || expr === true;
      String.prototype.matches = function(re){ return re.test(String(this)); };   // eslint-disable-line no-extend-native
      String.prototype.beginsWith = String.prototype.startsWith;                  // eslint-disable-line no-extend-native
      // 경로 키 형식 조건(개정 319)이 있어 경로 변수엔 정상 키를 넣는다 — 여기서 보는 것은 값 조건이다
      try{ return !!new Function('newData', '$reqId', '$userId', 'return (' + expr + ');')(snap(v), '-Nabc123', 'umu00pdxvk6d9x8mx'); }
      finally{ delete String.prototype.matches; delete String.prototype.beginsWith; }
    };
    const pres = at('users/$userId/presence') || {};
    const presOk = (v) => run(pres['.validate'], v) && (v.ver === undefined || run((pres.ver || {})['.validate'], v.ver));
    chk(!!pres.ver && typeof pres.ver['.validate'] === 'string', 'users/$userId/presence/ver 규칙이 있다');
    chk(presOk({ online: true, lastSeen: 1, room: null, inRoom: false }), '★ 옛 앱(ver 없음) presence 는 그대로 통과');
    chk(presOk({ online: false, lastSeen: 1, ver: '0.10.3' }), '★ 새 앱 presence(ver) 통과');
    chk(!presOk({ online: true, ver: 103 }) && !presOk({ online: true, ver: 'x'.repeat(21) }) && presOk({ online: true, ver: 'x'.repeat(20) }),
      '  ↳ 숫자 · 21자는 거절, 20자까지');
    chk(!pres['.write'] || !/ver/.test(pres['.write']), '  ↳ 쓰기 권한은 그대로(ver 때문에 바뀐 것 없음)');

    const lr = at('licenseRequests/$reqId') || {};
    const base = { name: '홍길동', status: 'pending', requestedAt: 1 };
    chk(run(lr['.validate'], base), '★ 옛 앱 요청(ver 없음) 통과');
    chk(run(lr['.validate'], { ...base, ver: '0.10.3' }), '★ 새 앱 요청(ver) 통과');
    chk(!run(lr['.validate'], { ...base, ver: 3 }) && !run(lr['.validate'], { ...base, ver: 'x'.repeat(21) }), '  ↳ 숫자 · 21자는 거절');
    chk(run(lr['.validate'], { ...base, friendCode: 'MATE-AB12', ver: '0.10.3' }) && !run(lr['.validate'], { ...base, friendCode: 'bad', ver: '0.10.3' }),
      '  ↳ 친구코드 조건은 그대로');
  }

  say('── 4. accountSnap ver (부팅마다 쓰는 계정 요약)');
  {
    const grab = (head) => { const i = FI.indexOf(head); if(i < 0) return null; let k = FI.indexOf('{', i), d = 0;
      for(; k < FI.length; k++){ if(FI[k] === '{') d++; else if(FI[k] === '}' && --d === 0) return FI.slice(i, k + 1); } return null; };
    const fClean = grab('function _acctSnapClean('), fSet = grab('async setAccountSnapshot(');
    chk(!!fClean && !!fSet, '_acctSnapClean · setAccountSnapshot 을 찾았다');
    const mk = (ver, deny) => {
      const writes = [];
      const c = { Date: { now: () => 5000 }, Number, db: {}, ref: (d, p) => ({ p: p || '/' }),
        _appVer: { ready: Promise.resolve(ver), get: () => ver },
        update: async (r, patch) => { const v = JSON.parse(JSON.stringify(patch)); writes.push(v);
          if(deny(v)) throw new Error('PERMISSION_DENIED'); } };
      vm.createContext(c);
      vm.runInContext(fClean + '\nthis.api = {' + fSet + '};', c);
      return { api: c.api, writes };
    };
    let t = mk('0.10.3', () => false);
    let w = fClean && fSet ? await t.api.setAccountSnapshot('U1', { license: 'K', name: 'n' }) : {};
    const s1 = t.writes[0] && t.writes[0]['accountSnap/U1'];
    chk(w.ok && t.writes.length === 1 && s1 && s1.ver === '0.10.3' && s1.license === 'K', '★ setAccountSnapshot 이 accountSnap 에 ver 를 싣는다');
    t = mk(null, () => false);
    await t.api.setAccountSnapshot('U2', { license: 'K' });
    chk(t.writes.length === 1 && t.writes[0]['accountSnap/U2'].ver === null, '  ↳ 버전을 모르면 ver 없이(null = 안 씀)');
    // 규칙 배포 전($other:false) — ver 가 있으면 거절되는 서버
    t = mk('0.10.3', (v) => !!(v['accountSnap/U3'] && v['accountSnap/U3'].ver));
    w = await t.api.setAccountSnapshot('U3', { license: 'K' });
    chk(w.ok && t.writes.length === 2 && t.writes[1]['accountSnap/U3'].ver === null && t.writes[1]['accountSnap/U3'].license === 'K',
      '★ 규칙이 ver 를 모르는 서버면 ver 를 빼고 다시 써서 라이선스는 남긴다');
    t = mk(null, () => true);
    w = await t.api.setAccountSnapshot('U4', { license: 'K' });
    chk(!w.ok && t.writes.length === 1, '  ↳ ver 가 없는데 거절되면 다시 쓰지 않는다(ok:false)');

    const as = (RULES.accountSnap || {}).$userId || {};
    const vv = (as.ver || {})['.validate'];
    chk(typeof vv === 'string' && !!as.$other && as.$other['.validate'] === false, '규칙 accountSnap/$userId/ver 가 있다($other:false 는 그대로)');
    const ok = (v) => { try{ return !!new Function('newData', 'return (' + vv + ');')({ isString: () => typeof v === 'string', val: () => v }); }catch(_){ return false; } };
    chk(ok('0.10.3') && ok('x'.repeat(20)) && !ok('x'.repeat(21)) && !ok(103), '  ↳ 문자열 20자까지 · 숫자 거절 (없으면 이 규칙이 안 돈다 — 옛 앱 통과)');
  }

  say('── 5. presence 쓰기를 실제로 돌린다 — 버전이 늦어도 · 못 받아도 ver 없는 online:true 는 없다');
  {
    const grab = (src, head) => { const i = src.indexOf(head); if(i < 0) return null; let k = src.indexOf('{', i), d = 0;
      for(; k < src.length; k++){ if(src[k] === '{') d++; else if(src[k] === '}' && --d === 0) return src.slice(i, k + 1); } return null; };
    const SRC = {
      sync: grab(CODE, 'function _syncPresenceRoom('),
      av: grab(CODE, 'const _appVer = createAppVersion('),
      on: grab(CODE, 'setMyPresenceOnline(userId){'),
      st: grab(CODE, 'setMyPresenceState(userId, online){'),
    };
    chk(Object.values(SRC).every(Boolean), '_syncPresenceRoom · _appVer · setMyPresenceOnline · setMyPresenceState 를 찾았다');
    const tick = async (n = 6) => { for(let i = 0; i < n; i++) await new Promise(r => setImmediate(r)); };
    const defer = () => { let res, rej; const p = new Promise((a, b) => { res = a; rej = b; }); return { p, res, rej }; };
    // 서버 흉내: set 은 통째 · update 는 합치기 · onDisconnect payload 는 따로 적어 둔다
    const mkWorld = (opts) => {
      const o = Object.assign({ src: SRC, createAppVersion: mod.createAppVersion }, opts);
      const w = { log: [], node: null, od: null, connected: [], ticks: [] };
      const save = (kind, v) => { const val = JSON.parse(JSON.stringify(v)); w.log.push({ kind, v: val });
        if(kind === 'set') w.node = val; else if(kind === 'update') w.node = Object.assign({}, w.node || {}, val);
        else if(kind === 'od') w.od = val;
        if(kind !== 'od') w.log[w.log.length - 1].node = JSON.parse(JSON.stringify(w.node)); return Promise.resolve(); };
      const c = {
        Date: { now: () => 1000 }, Promise, JSON, Object, db: {},
        window: { companion: o.companion },
        createAppVersion: o.createAppVersion,
        ref: (d, p) => ({ p }),
        set: (r, v) => save('set', v), update: (r, v) => save('update', v),
        onDisconnect: () => ({ set: (v) => save('od', v), cancel: () => Promise.resolve() }),
        onValue: (r, cb) => { if(r.p === '.info/connected') w.connected.push(cb); },
        setInterval: (fn) => { w.ticks.push(fn); return 1; },
        _whenAuthReady: () => o.auth,
      };
      vm.createContext(c);
      vm.runInContext('let _myPresenceRef = null, _presenceRoom = null, _presenceOnline = true, _presenceInRoom = false;\n'
        + 'let _presenceWritten = false;\n' + o.src.sync + '\n' + o.src.av + ');\n'
        + 'this.api = {' + o.src.on + ',\n' + o.src.st + ',\n_syncPresenceRoom };', c);
      w.api = c.api;
      w.connect = () => w.connected.forEach(cb => cb({ val: () => true }));
      return w;
    };
    // ver 없이 online:true · inRoom 을 쓰는 것 — payload 든 합쳐진 노드든 onDisconnect 든 하나라도 있으면 막힌다
    const bad = (v) => !!v && (v.online === true || 'inRoom' in v) && !(typeof v.ver === 'string' && v.ver);
    const leaks = (w) => w.log.filter(e => bad(e.v) || bad(e.node)).length;
    const companion = (fn) => ({ getAppVersion: fn });
    const UNK = mod.APP_VER_UNKNOWN;

    // 시나리오: 켜기 → 연결 → (버전) → 로그인 → 방 들어가기 → 수동 오프라인 · 온라인 → 6시간 틱
    const play = async (w, ctl) => {
      w.api.setMyPresenceOnline('U1');
      w.connect(); await tick();
      const beforeVer = w.log.length;
      if(ctl.authFirst){ ctl.auth.res(); await tick(); }
      w.api._syncPresenceRoom('COZY-AB12'); await tick();
      w.api.setMyPresenceState('U1', false); await tick();
      w.api.setMyPresenceState('U1', true); await tick();
      const midLog = w.log.length;
      if(ctl.ver) { ctl.ver(); await tick(); }
      if(!ctl.authFirst){ ctl.auth.res(); await tick(); }
      w.ticks.forEach(f => f()); await tick();
      return { beforeVer, midLog };
    };

    // ① 바로 옴(평소)
    {
      const auth = defer();
      const w = mkWorld({ companion: companion(async () => '0.11.3'), auth: auth.p });
      await tick();   // 버전은 켤 때 받아 둔다(IPC)
      await play(w, { auth });
      const sets = w.log.filter(e => e.kind === 'set').length, ods = w.log.filter(e => e.kind === 'od').length;
      chk(leaks(w) === 0 && w.log.every(e => e.v.ver === '0.11.3'), '★ 평소: 모든 쓰기에 진짜 버전');
      chk(sets === 4 && ods === 2 && w.node.online === true && w.node.inRoom === true && w.node.ver === '0.11.3',
        `  ↳ 쓰기 수 예전 그대로(set ${sets} · onDisconnect ${ods}) · 마지막 노드 온라인 · 방 · 버전`);
    }
    // ② 늦게 옴 — 연결 · 방 · 수동 토글이 버전보다 먼저
    {
      const auth = defer(), v = defer();
      const w = mkWorld({ companion: companion(() => v.p), auth: auth.p });
      const r = await play(w, { auth, authFirst: true, ver: () => v.res('0.11.3') });
      const pre = w.log.slice(0, r.midLog), post = w.log.slice(r.midLog);
      chk(leaks(w) === 0, '★ 늦게 옴: ver 없는 online:true · inRoom 쓰기 0');
      chk(pre.length > 0 && pre.every(e => e.v.ver === UNK), `  ↳ 받기 전 쓰기(${pre.length})는 «모름» ver 를 싣는다`);
      chk(pre.filter(e => e.kind === 'set').length === 3,
        '★ 로그인이 먼저 끝나도 처음 쓰기는 버전을 기다린다(받기 전 set = 연결 1 · 수동 토글 2)');
      chk(post.some(e => e.kind === 'update' && e.v.ver === '0.11.3' && Object.keys(e.v).length === 1)
        && post.some(e => e.kind === 'od' && e.v.ver === '0.11.3') && w.node.ver === '0.11.3' && w.od.ver === '0.11.3',
        '  ↳ 받은 뒤 ver 를 메우고 onDisconnect 도 진짜 버전으로 다시 건다');
    }
    // ③ 못 받음(IPC 거부) · ④ companion 없음 · ⑤ 영영 안 옴
    for(const [name, comp, hang] of [
      ['못 받음(거부)', companion(() => Promise.reject(new Error('ipc'))), false],
      ['companion 없음', undefined, false],
      ['영영 안 옴', companion(() => new Promise(() => {})), true],
    ]){
      const auth = defer();
      const w = mkWorld({ companion: comp, auth: auth.p });
      await play(w, { auth });
      chk(leaks(w) === 0 && w.log.length > 0 && w.log.every(e => e.v.ver === UNK) && w.node.online === true && w.node.ver === UNK && w.od.ver === UNK,
        `★ ${name}: 모든 쓰기 · onDisconnect 에 «모름» ver — 지금 앱이 옛 앱으로 막히지 않는다` + (hang ? '(연결 쪽이 씀)' : ''));
    }
    // ⑥ 수동 토글이 맨 먼저(setMyPresenceOnline 전) · 오프라인 쓰기
    {
      const auth = defer(), v = defer();
      const w = mkWorld({ companion: companion(() => v.p), auth: auth.p });
      w.api.setMyPresenceState('U1', false); await tick();
      chk(leaks(w) === 0 && w.log.length === 2 && w.log.every(e => e.v.ver === UNK && e.v.online === false && (e.kind === 'od' || e.v.inRoom === false)),
        '★ 오프라인 쓰기(inRoom:false 포함)도 ver 를 싣는다 — ver 없는 오프라인 + inRoom 은 규칙이 거절');
    }
    // ⑦ 규칙으로 굴린다 — 합쳐진 노드가 presence 규칙을 통과하는가 · 옛 앱 판정에 안 걸리는가
    {
      const pres = (RULES.users && RULES.users.$userId && RULES.users.$userId.presence) || {};
      const onV = (pres.online || {})['.validate'];
      const parentSnap = (o) => ({ child: (k) => ({ exists: () => o[k] !== undefined && o[k] !== null }) });
      const onlineOk = (o) => { try{ return !!new Function('newData', 'return (' + onV + ');')({
        isBoolean: () => typeof o.online === 'boolean', val: () => o.online, parent: () => parentSnap(o) }); }catch(_){ return false; } };
      const oldApp = (o) => o.online === true && !o.ver;   // users/$userId .read 의 옛 앱 판정과 같은 모양
      const auth = defer(), v = defer();
      const w = mkWorld({ companion: companion(() => v.p), auth: auth.p });
      await play(w, { auth, authFirst: true, ver: () => v.res('0.11.3') });
      const nodes = w.log.filter(e => e.node).map(e => e.node);
      chk(typeof onV === 'string' && nodes.length > 0 && nodes.every(onlineOk) && !nodes.some(oldApp) && onlineOk(w.od),
        `★ 쓰는 노드 ${nodes.length}개 전부 online 규칙 통과 · 옛 앱 판정에 안 걸림`);
      chk(!onlineOk({ online: false, inRoom: false }) && onlineOk({ online: false }) && onlineOk({ online: true }),
        '  ↳ (규칙 확인) ver 없는 오프라인 + inRoom 은 거절 · 그것만 빼면 통과');
    }
    // 깨 보기
    {
      const auth = defer(), v = defer();
      const oldAV = (deps) => { const a = mod.createAppVersion(deps); return { ...a, withVer: (obj) => a.get() ? { ...obj, ver: a.get() } : obj }; };
      const w = mkWorld({ companion: companion(() => v.p), auth: auth.p, createAppVersion: oldAV });
      await play(w, { auth, authFirst: true, ver: () => v.res('0.11.3') });
      chk(leaks(w) > 0, `깨 보기: 예전 withVer(모르면 ver 뺌)로 돌리면 새는 쓰기가 잡힌다(${leaks(w)}건)`);
    }
    {
      const auth = defer(), v = defer();
      const src = Object.assign({}, SRC, { sync: SRC.sync.replace('_appVer.withVer({ room', '({ room') });
      const w = mkWorld({ src, companion: companion(() => v.p), auth: auth.p });
      await play(w, { auth, authFirst: true, ver: () => v.res('0.11.3') });
      chk(src.sync !== SRC.sync && leaks(w) > 0, '깨 보기: 방 바꿀 때 update 에서 ver 를 빼면 잡힌다');
    }
    {
      const auth = defer(), v = defer();
      const src = Object.assign({}, SRC, { on: SRC.on.replace('.then(() => _appVer.ready)', '') });
      const w = mkWorld({ src, companion: companion(() => v.p), auth: auth.p });
      const r = await play(w, { auth, authFirst: true, ver: () => v.res('0.11.3') });
      const preSets = w.log.slice(0, r.midLog).filter(e => e.kind === 'set').length;
      chk(src.on !== SRC.on && preSets !== 3, `깨 보기: 버전 기다리기를 빼면 처음 쓰기가 버전보다 먼저 나간다(받기 전 set ${preSets})`);
    }
  }

  say(`\n판정: 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
