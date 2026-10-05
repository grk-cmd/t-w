/*
 * 앱 버전(ver)을 presence 와 라이선스 요청에 싣는가 — 웹 관리자가 사용자 · 요청마다 버전을 본다.
 * 1. app-version.js 를 그대로 불러 돌린다 — 정상 · companion 없음 · 실패 · 이상한 값
 * 2. firebase-init.js — presence 를 통째로 쓰는 자리(set · onDisconnect().set) 전부 ver 를 싣는가 · 늦게 오면 메우는가
 * 3. 규칙 — presence/ver · licenseRequests ver 를 실제로 굴린다(없어도 통과 · 문자열 · 20자)
 * 4. accountSnap ver — 웹 관리자가 사용자 목록 한 번으로 버전을 센다. setAccountSnapshot 을 떼어 와 가짜 update 로 돌린다.
 */
'use strict';
const fs = require('fs');
const vm = require('vm');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = (...names) => { for(const n of names){ const s = read(n); if(s != null) return s; } say('  ? 원본 못 찾음 — ' + names[0]); process.exit(2); };
const AV = need('app-version.js', 'parts/app-version.js', 'app/parts/app-version.js');
const FI = need('firebase-init.js', 'parts/firebase-init.js', 'app/parts/firebase-init.js');
const RULES = JSON.parse(need('firebase-database-rules.json')).rules;
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const CODE = strip(FI);
const mod = new Function(AV.replace(/^export (function|const) /mg, '$1 ') + '\nreturn { createAppVersion, cleanAppVer, APP_VER_MAX };')();

(async () => {
  say('── 1. app-version.js');
  {
    const { createAppVersion, cleanAppVer, APP_VER_MAX } = mod;
    chk(APP_VER_MAX === 20, '길이 상한 20 — 규칙과 같다');
    chk(cleanAppVer('0.10.3') === '0.10.3' && cleanAppVer('0.10.3-beta.1') === '0.10.3-beta.1', '버전 모양 문자열은 그대로');
    chk([null, undefined, 3, '', 'x'.repeat(21), '0.1 <b>', {}].every(v => cleanAppVer(v) === null), '  ↳ 문자열이 아니거나 · 빈칸 · 21자 · 이상한 글자는 null');

    let got = [];
    const a = createAppVersion({ getVersion: async () => '0.10.3', onReady: v => got.push(v) });
    chk(a.get() === null && JSON.stringify(a.withVer({ online: true })) === '{"online":true}', '받기 전: ver 없이 그대로(옛 앱과 같은 모양)');
    chk(await a.ready === '0.10.3' && a.get() === '0.10.3', '★ 받은 뒤: get() = 버전');
    chk(JSON.stringify(a.withVer({ online: false, lastSeen: 1 })) === '{"online":false,"lastSeen":1,"ver":"0.10.3"}', '  ↳ withVer 가 ver 한 칸만 붙인다');
    chk(got.length === 1 && got[0] === '0.10.3', '  ↳ onReady 는 한 번');

    got = [];
    const b = createAppVersion({ getVersion: () => null, onReady: v => got.push(v) });
    chk(await b.ready === null && got.length === 0 && !('ver' in b.withVer({ online: true })), '★ companion 없음(웹 · 검사): ver 를 안 싣고 onReady 도 안 부른다');
    const c = createAppVersion({ getVersion: () => { throw new Error('x'); }, onReady: v => got.push(v) });
    const d = createAppVersion({ getVersion: () => Promise.reject(new Error('ipc')), onReady: v => got.push(v) });
    chk(await c.ready === null && await d.ready === null && got.length === 0, '  ↳ 던지거나 · 거부돼도 앱이 안 깨진다(null)');
    const e = createAppVersion({ getVersion: async () => 'x'.repeat(40) });
    chk(await e.ready === null, '  ↳ 규칙이 거절할 값(21자 이상)은 처음부터 안 싣는다');
    const f = createAppVersion({ getVersion: async () => '1.0.0', onReady: () => { throw new Error('boom'); } });
    chk(await f.ready === '1.0.0', '  ↳ onReady 가 던져도 ready 는 끝난다');
  }

  say('── 2. firebase-init.js — presence 를 통째로 쓰는 자리');
  {
    chk(/import \{ createAppVersion \} from "\.\/app-version\.js";/.test(CODE), 'app-version.js 를 불러온다');
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
      try{ return !!new Function('newData', 'return (' + expr + ');')(snap(v)); }
      finally{ delete String.prototype.matches; }
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

  say(`\n판정: 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
