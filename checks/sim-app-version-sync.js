/* ═══ 🔄 sim-app-version-sync.js — 계정 단위 판 맞추기 (0.12.4) ═══════════════════════════════
   켤 때 이 앱 판을 서버에 알리고(POST /v2/me/app-version), 서버가 «더 새 판을 쓰는 기기가 있다» 고 답하면 업데이트 안내로 막는다.
   진짜 account/app-version-sync.js 를 가짜 authed 위에서 돌려 입력 → 출력으로 판정한다.
   ・1절: 알리기 — 요청 한 번 · 본문은 { version } 만(계정 코드 · 기기 값 없음) · 판 글자 틀림 · 판 모름은 요청 0
   ・2절: 답 — behind 참이면 block(내 판 · 가장 높은 판) · 거짓이면 안 막음
   ・3절: 못 알려도 안 막음 — 닿지 못함 · 401(가입 전) · 모양이 다른 답 · 던지는 getVersion · 다시 보내지 않음
   ・4절: 연결 — html 에 일반 script 로 싣기(firebase-init 는 module 이라 그 뒤) · firebase-init 가 로그인 복원 뒤 로그인이 있을 때만 알리고 게이트에 잇는다
   ・5절: 일부러 깨 보기
   [실행] 러너 스테이징(평면)에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (name, dir) => [name, 'parts/' + dir + '/' + name, 'app/parts/' + dir + '/' + name].map(read).find(Boolean);
const SRC0 = { SYNC: pick('app-version-sync.js', 'account') };
SRC0.FI = ['firebase-init.js', 'parts/firebase-init.js', 'app/parts/firebase-init.js'].map(read).find(Boolean);
SRC0.HTML = ['desk-companion-prototype.html', 'app/desk-companion-prototype.html'].map(read).find(Boolean);
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
const load = (src) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w.TwAppVersionSync; };
const apiErr = (status, code, kind) => Object.assign(new Error(code || String(status)), { status, code: code || '', kind: kind || (status >= 500 ? 'unavailable' : 'request') });

/* 가짜 authed — 답(값 · 던질 Error · 함수)을 정한다 */
function mk(src, answer, opt){
  const o = opt || {};
  const log = [], blocks = [], warns = [];
  const authed = { post: async (path, body) => { log.push({ path, body }); const a = typeof answer === 'function' ? answer() : answer; if(a instanceof Error) throw a; return a; } };
  const M = load(src);
  const sync = M.createAppVersionSync({
    authed,
    getVersion: o.getVersion || (async () => ('ver' in o ? o.ver : '0.12.3')),
    block: (my, highest) => { blocks.push([my, highest]); },
    warn: (...a) => warns.push(a),
  });
  return { sync, log, blocks, warns, M };
}

function judge(S){
  return (async () => {
    say('── 1. 알리기');
    {
      const t = mk(S.SYNC, { highest: '0.12.3', behind: false });
      const r = await t.sync.report();
      chk(t.log.length === 1 && t.log[0].path === '/v2/me/app-version', '켤 때 한 번 — POST /v2/me/app-version');
      chk(JSON.stringify(t.log[0].body) === '{"version":"0.12.3"}', '  본문은 { version } 만 — 계정 코드 · 기기 값을 싣지 않는다(계정은 토큰으로 서버가 정한다)');
      chk(r.state === 'ok' && t.blocks.length === 0, '  같은 판이면 안 막는다(ok)');
      for(const bad of [null, undefined, '', 'x'.repeat(21), '0.12 3', 123]){
        const u = mk(S.SYNC, { highest: '9', behind: true }, { ver: bad });
        const q = await u.sync.report();
        chk(u.log.length === 0 && u.blocks.length === 0 && q.state === 'skipped', '  판을 모르거나 글자가 틀리면(' + JSON.stringify(bad) + ') 요청 0 · 안 막음');
      }
      const v = mk(S.SYNC, { highest: '0.12.3', behind: false }, { ver: '0.12.4-beta.1' });
      await v.sync.report();
      chk(v.log[0].body.version === '0.12.4-beta.1', '  시험 판(-beta.1)도 그대로 알린다');
    }

    say('── 2. 답');
    {
      const t = mk(S.SYNC, { highest: '0.12.4', behind: true });
      const r = await t.sync.report();
      chk(r.state === 'behind' && JSON.stringify(t.blocks) === '[["0.12.3","0.12.4"]]', '★ behind 참 → 막는다 — block(내 판, 가장 높은 판) 한 번');
      chk(t.log.length === 1, '  막은 뒤에도 요청은 한 번');
      const f = mk(S.SYNC, { highest: '0.12.4', behind: false }, { ver: '0.12.4' });
      const q = await f.sync.report();
      chk(q.state === 'ok' && f.blocks.length === 0, '★ behind 거짓 → 안 막는다');
    }

    say('── 3. 못 알려도 안 막는다');
    {
      const cases = [
        ['닿지 못함(5xx)', apiErr(503, 'X', 'unavailable')], ['시간 초과', apiErr(0, 'TIMEOUT', 'unavailable')],
        ['가입 전 계정(401)', apiErr(401, 'USER_CODE_NOT_BOUND', 'auth')], ['토큰 없음', apiErr(0, 'NO_TOKEN', 'auth')],
        ['429', apiErr(429, 'TOO_MANY_REQUESTS')],
        ['응답이 비었음', null], ['behind 가 글자', { highest: '0.12.4', behind: 'true' }], ['highest 없음', { behind: true }], ['highest 빈 글자', { highest: '', behind: true }],
        ['배열 응답', [1]],
      ];
      for(const [label, ans] of cases){
        const t = mk(S.SYNC, ans);
        const r = await t.sync.report();
        chk(r.state === 'skipped' && t.blocks.length === 0 && t.log.length === 1, label + ' → 안 막음 · 다시 보내지 않음(요청 1)');
      }
      const g = mk(S.SYNC, { highest: '9', behind: true }, { getVersion: async () => { throw new Error('ipc'); } });
      const r = await g.sync.report();
      chk(r.state === 'skipped' && g.log.length === 0 && g.blocks.length === 0, '판을 읽다 던져도 안 막음 · 요청 0');
      const w = mk(S.SYNC, apiErr(503, 'X', 'unavailable'));
      await w.sync.report();
      chk(w.warns.length === 1, '  못 알린 까닭은 콘솔에 한 줄(사용자 안내 · 오류 번호 없음 — 켜는 길을 서버에 묶지 않는다)');
    }

    say('── 4. 연결');
    {
      const H = S.HTML, a = H.indexOf('<script src="parts/account/app-version-sync.js"></script>'), c = H.indexOf('<script src="parts/shared/api-client.js"></script>'), f = H.indexOf('<script type="module" src="parts/firebase-init.js"></script>');
      chk(c > 0 && a > c && f > 0, 'html — 일반 script 로 api-client.js 다음에 싣는다(firebase-init.js 는 module 이라 모든 일반 script 뒤에 돈다)');
      const code = strip(S.FI);
      chk(/const _verGate = createAppVersionGate\(\{/.test(code) && /_verGate\.start\(\)/.test(code), 'firebase-init — 최소 버전 게이트를 쥐어 둔다(같은 화면을 쓴다)');
      const i = code.indexOf('window.TwAppVersionSync.createAppVersionSync({'), j = code.indexOf('const _authApi = window.TwApi.authed;');
      const blk = i >= 0 ? code.slice(i, code.indexOf('});', i) + 3) : '';
      chk(i > j && j > 0 && /authed: _authApi/.test(blk) && /getVersion: \(\) => _appVer\.ready/.test(blk) && /block: \(my, highest\) => \{ _verGate\.blockForAccount\(my, highest\); \}/.test(blk), '  로그인 통로(_authApi) · 앱 판 · 게이트 막기를 잇는다');
      chk(/_whenAuthReady\(\)\.then\(\(\) => \{ if\(auth && auth\.currentUser && !auth\.currentUser\.isAnonymous\) return _verSync\.report\(\); \}\);/.test(code), '★ 로그인 복원이 끝난 뒤 · 로그인이 있고 익명이 아닐 때만 알린다(한 번 — 가입 전 로그인에는 요청 0)');
      chk(!/setInterval\([^)]*_verSync|_verSync\.report\(\)[^;]*setTimeout/.test(code), '  다시 보내는 타이머가 없다(다음에 켤 때 다시)');
      chk(!/config\/minAppVer/.test(strip(S.SYNC)) && !/firebaseAPI|import\(|localStorage/.test(strip(S.SYNC)), 'app-version-sync.js 는 Firebase · 저장소를 모른다');
    }
  })();
}

(async () => {
  await judge(SRC0);

  say('── 5. 일부러 깨 보기');
  const BREAKS = [
    ['SYNC', "{ version: my }", "{ version: my, device: 'x' }", '본문에 다른 값을 싣는다'],
    ['SYNC', "if(!data.behind) return { state: STATE.OK };", "", 'behind 거짓도 막는다'],
    ['SYNC', "block(my, data.highest);", "", '막아야 할 때 안 막는다'],
    ['SYNC', "typeof data.behind !== 'boolean' || ", "", '글자 behind 를 믿는다'],
    ['SYNC', "if(typeof my !== 'string' || !VER_RE.test(my)) return", "if(false) return", '판을 몰라도 알린다'],
    ['SYNC', "catch(e){ warn(", "catch(e){ block(my, 'x'); warn(", '못 닿으면 막는다'],
    ['FI', "if(auth && auth.currentUser && !auth.currentUser.isAnonymous) return _verSync.report();", "return _verSync.report();", '로그인 없어도 알린다'],
    ['FI', " && !auth.currentUser.isAnonymous", "", '익명 로그인에도 알린다'],
    ['FI', "_whenAuthReady().then(() => { if(auth", "Promise.resolve().then(() => { if(auth", '로그인 복원을 안 기다린다'],
    ['HTML', '<script src="parts/account/app-version-sync.js"></script>', '', 'html 에 안 싣는다'],
  ];
  const caught = [];
  for(const [where, from, to, what] of BREAKS){
    if(SRC0[where].indexOf(from) < 0){ chk(false, '깨 볼 글을 못 찾음 — ' + what); continue; }
    const S = Object.assign({}, SRC0); S[where] = S[where].split(from).join(to);
    quiet = true; qfail = 0;
    try{ await judge(S); }catch(_){ qfail++; }
    quiet = false;
    caught.push([what, qfail]);
  }
  const missed = caught.filter(([, k]) => k === 0).map(([w]) => w);
  chk(caught.length === BREAKS.length && !missed.length, '일부러 깨 본 ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — 못 잡음: ' + missed.join(' · ') : ''));

  console.log(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
