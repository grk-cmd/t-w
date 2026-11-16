/*
 * 앱 버전(ver)을 presence 에 싣는가 — 웹 관리자가 사용자마다 버전을 본다.
 * 1. app-version.js 를 그대로 불러 돌린다 — 정상 · companion 없음 · 실패 · 이상한 값
 * 2. firebase-init.js — 판을 realtime 연결에 잇는다 · presence 쓰기는 없다
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

  say('── 2. firebase-init.js — 이 판을 realtime 연결에 잇는다(Firebase presence 쓰기는 걷었다)');
  {
    chk(/import \{ createAppVersion \} from "\.\/(?:(?:\.\.\/)?[\w-]+\/)?app-version\.js";/.test(CODE), 'app-version.js 를 불러온다');
    chk(/getVersion: \(\) => \(window\.companion && window\.companion\.getAppVersion\) \? window\.companion\.getAppVersion\(\) : null/.test(CODE),
      '★ companion 이 없으면 getAppVersion 을 부르지 않는다');
    chk(/getVersion: \(\) => _appVer\.ready/.test(CODE) && !/_createMyPresence|createMyPresence|onDisconnect\(/.test(CODE), '★ realtime 연결의 hello 가 이 판을 싣는다 · presence 쓰기 · onDisconnect 는 없다');
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
    /* 0.13 — 앱은 accountSnap 을 쓰지 않는다(계정 사본을 걷었다 · 서버가 원본). 규칙 칸은 옛 앱 몫으로 남아 있어 아래만 본다. */
    chk(!/setAccountSnapshot|_acctSnapClean/.test(FI.replace(/\/\*[\s\S]*?\*\//g, '')), '0.13 앱은 accountSnap 에 쓰지 않는다(setAccountSnapshot 걷음)');

    const as = (RULES.accountSnap || {}).$userId || {};
    const vv = (as.ver || {})['.validate'];
    chk(typeof vv === 'string' && !!as.$other && as.$other['.validate'] === false, '규칙 accountSnap/$userId/ver 가 있다($other:false 는 그대로)');
    const ok = (v) => { try{ return !!new Function('newData', 'return (' + vv + ');')({ isString: () => typeof v === 'string', val: () => v }); }catch(_){ return false; } };
    chk(ok('0.10.3') && ok('x'.repeat(20)) && !ok('x'.repeat(21)) && !ok(103), '  ↳ 문자열 20자까지 · 숫자 거절 (없으면 이 규칙이 안 돈다 — 옛 앱 통과)');
  }

  say(`\n판정: 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
