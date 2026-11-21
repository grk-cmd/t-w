/* ═══ 🔄 sim-app-version-sync.js — 계정 단위 판 맞추기 (0.13) ═══════════════════════════════
   계정에 들어간 뒤 이 앱 판을 서버에 알리고(POST /v2/me/app-version), 서버가 «더 새 판을 쓰는 기기가 있다» 고 답하면 업데이트 안내로 막는다.
   진짜 account/app-version-sync.js 를 가짜 authed · 가짜 세션 위에서 돌려 입력 → 출력으로 판정한다.
   ・1절: 알리기 — 요청 한 번 · 본문은 { version } 만(계정 코드 · 기기 값 없음) · 판 글자 틀림 · 판 모름은 요청 0 · 경고 한 줄
   ・2절: 답 — behind 참이면 block(내 판 · 가장 높은 판) · 거짓이면 안 막음
   ・3절: 못 알려도 안 막음(경고는 남김) — 닿지 못함 · 401 · 모양이 다른 답 · 던지는 getVersion · 다시 보내지 않음
   ・4절: 세션 — 답이 오기 전에 세션이 끝났으면 그 답을 버린다(막지 않음 · 경고 없음)
   ・5절: 연결 — html 에 일반 script 로 싣기 · app-boot 차례 appVersion 한 곳 · app.js 가 update-flow forceAccount 에 잇는다 · 앱 판은 sharedAppVersion 한 벌(rt-bind) · 가입 전(익명) 로그인은 계정 확인에서 걸러져 이 차례에 오지 않는다
   ・6절: mutation test
   [실행] 러너 스테이징(평면)에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (name, dir) => [name, 'parts/' + dir + '/' + name, 'app/parts/' + dir + '/' + name].map(read).find(Boolean);
const { joinRenderer } = require('./sim-renderer-src.js');
const SRC0 = {
  SYNC: pick('app-version-sync.js', 'account'),
  BOOT: pick('app-boot.js', 'launcher'),
  BIND: pick('rt-bind.js', 'realtime'),
  LOGIN: pick('login-flow.js', 'account'),
  APP: ['app.js', 'parts/app.js', 'app/parts/app.js'].map(read).find(Boolean),
  HTML: ['desk-companion-prototype.html', 'app/desk-companion-prototype.html'].map(read).find(Boolean),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
SRC0.APP = joinRenderer(SRC0.APP);
const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
const load = (src) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w.TwAppVersionSync; };
const apiErr = (status, code, kind) => Object.assign(new Error(code || String(status)), { status, code: code || '', kind: kind || (status >= 500 ? 'unavailable' : 'request') });

/* 가짜 authed · 세션 — 답(값 · 던질 Error · 함수)을 정한다 */
function mk(src, answer, opt){
  const o = opt || {};
  const log = [], blocks = [], warns = [];
  let alive = true;
  const authed = { post: async (path, body) => { log.push({ path, body }); if(o.endSession) alive = false; const a = typeof answer === 'function' ? answer() : answer; if(a instanceof Error) throw a; return a; } };
  const M = load(src);
  const sync = M.createAppVersionSync({
    authed,
    getVersion: o.getVersion || (async () => ('ver' in o ? o.ver : '0.12.3')),
    block: (my, highest) => { blocks.push([my, highest]); },
    warn: (...a) => warns.push(a),
  });
  const session = { alive: () => alive };
  return { sync, session, end: () => { alive = false; }, log, blocks, warns, M };
}

function judge(S){
  return (async () => {
    say('── 1. 알리기');
    {
      const t = mk(S.SYNC, { highest: '0.12.3', behind: false });
      const r = await t.sync.start(t.session);
      chk(t.log.length === 1 && t.log[0].path === '/v2/me/app-version', '계정에 들어간 뒤 한 번 — POST /v2/me/app-version');
      chk(JSON.stringify(t.log[0].body) === '{"version":"0.12.3"}', '  본문은 { version } 만 — 계정 코드 · 기기 값을 싣지 않는다(계정은 토큰으로 서버가 정한다)');
      chk(r.state === 'ok' && t.blocks.length === 0 && t.warns.length === 0, '  같은 판이면 안 막는다(ok) · 경고도 없다');
      for(const bad of [null, undefined, '']){
        const u = mk(S.SYNC, { highest: '9', behind: true }, { ver: bad });
        const q = await u.sync.start(u.session);
        chk(u.log.length === 0 && u.blocks.length === 0 && q.state === 'skipped' && u.warns.length === 1, '  판을 모르거나 글자가 틀리면(' + JSON.stringify(bad) + ') 요청 0 · 안 막음 · 경고 한 줄');
      }
      const v = mk(S.SYNC, { highest: '0.12.3', behind: false }, { ver: '0.12.4-beta.1' });
      await v.sync.start(v.session);
      chk(v.log[0].body.version === '0.12.4-beta.1', '  시험 판(-beta.1)도 그대로 알린다');
    }

    say('── 2. 답');
    {
      const t = mk(S.SYNC, { highest: '0.12.4', behind: true });
      const r = await t.sync.start(t.session);
      chk(r.state === 'behind' && JSON.stringify(t.blocks) === '[["0.12.3","0.12.4"]]', '★ behind 참 → 막는다 — block(내 판, 가장 높은 판) 한 번');
      chk(t.log.length === 1, '  막은 뒤에도 요청은 한 번');
      const f = mk(S.SYNC, { highest: '0.12.4', behind: false }, { ver: '0.12.4' });
      const q = await f.sync.start(f.session);
      chk(q.state === 'ok' && f.blocks.length === 0, '★ behind 거짓 → 안 막는다');
    }

    say('── 3. 못 알려도 안 막는다 — 숨기지 않고 경고 한 줄');
    {
      const cases = [
        ['닿지 못함(5xx)', apiErr(503, 'X', 'unavailable')], ['시간 초과', apiErr(0, 'TIMEOUT', 'unavailable')],
        ['401', apiErr(401, 'USER_CODE_NOT_BOUND', 'auth')], ['토큰 없음', apiErr(0, 'NO_TOKEN', 'auth')],
        ['429', apiErr(429, 'TOO_MANY_REQUESTS')],
        ['응답이 비었음', null], ['behind 가 글자', { highest: '0.12.4', behind: 'true' }], ['highest 없음', { behind: true }], ['highest 빈 글자', { highest: '', behind: true }],
        ['배열 응답', [1]],
      ];
      for(const [label, ans] of cases){
        const t = mk(S.SYNC, ans);
        const r = await t.sync.start(t.session);
        chk(r.state === 'skipped' && t.blocks.length === 0 && t.log.length === 1 && t.warns.length === 1, label + ' → 안 막음 · 경고 한 줄 · 다시 보내지 않음(요청 1)');
      }
      const g = mk(S.SYNC, { highest: '9', behind: true }, { getVersion: async () => { throw new Error('ipc'); } });
      const r = await g.sync.start(g.session);
      chk(r.state === 'skipped' && g.log.length === 0 && g.blocks.length === 0 && g.warns.length === 1, '판을 읽다 던져도 안 막음 · 요청 0 · 경고 한 줄');
    }

    say('── 3-2. 창을 못 띄우면 경고');
    {
      const t = mk(S.SYNC, { highest: '0.12.4', behind: true });
      const sy = t.M.createAppVersionSync({ authed: { post: async () => ({ highest: '0.12.4', behind: true }) }, getVersion: async () => '0.12.3', block: () => false, warn: (...a) => t.warns.push(a) });
      const r = await sy.start(t.session);
      chk(r.state === 'behind' && t.warns.length === 1, '★ block 이 false(창을 못 띄움)면 경고 한 줄 · 상태는 behind');
      const ok = await t.sync.start(t.session);
      chk(ok.state === 'behind' && t.warns.length === 1, '  block 이 undefined(대역)이면 경고 없음 — 위 한 줄은 앞 호출 몫');
    }

    say('── 4. 세션이 끝났으면 답을 버린다');
    {
      const t = mk(S.SYNC, { highest: '0.12.4', behind: true }, { endSession: true });
      const r = await t.sync.start(t.session);
      chk(r.state === 'stale' && t.blocks.length === 0, '★ 답이 오기 전에 로그아웃 · 계정 바뀜 → behind 여도 막지 않는다(옛 계정의 답이 새 로그인을 막지 않게)');
      const f = mk(S.SYNC, apiErr(503, 'X', 'unavailable'), { endSession: true });
      const q = await f.sync.start(f.session);
      chk(q.state === 'stale' && f.warns.length === 0, '  끝난 세션의 실패는 경고도 없다');
      const e = mk(S.SYNC, { highest: '9', behind: true });
      e.end();
      const z = await e.sync.start(e.session);
      chk(z.state === 'stale' && e.log.length === 0, '  이미 끝난 세션이면 요청 0');
    }

    say('── 5. 연결');
    {
      const H = S.HTML, a = H.indexOf('<script src="parts/account/app-version-sync.js"></script>'), c = H.indexOf('<script src="parts/shared/api-client.js"></script>'), ap = H.indexOf('<script src="parts/app.js"');
      chk(c > 0 && a > c && (ap < 0 || a < ap), 'html — 일반 script 로 api-client.js 다음 · app.js 앞에 싣는다');
      const boot = strip(S.BOOT);
      const steps = boot.slice(boot.indexOf('const STEPS = ['), boot.indexOf('];', boot.indexOf('const STEPS = [')));
      chk(/'licensePremium'[\s\S]*'appVersion'[\s\S]*'adminMode'/.test(steps), 'app-boot — 차례 표에 appVersion 한 칸(계정 확인 뒤 · 다른 계정 기능과 같은 차례)');
      const code = strip(S.APP);
      const i = code.indexOf('TwAppVersionSync.createAppVersionSync({');
      const blk = i >= 0 ? code.slice(i, code.indexOf('});', i) + 3) : '';
      chk(i > code.indexOf('const updateFlowMod = TwUpdateFlow.createUpdateFlow({') && /authed: TwApi\.authed/.test(blk) && /getVersion: \(\)=>window\.TwAppVersion\.ready/.test(blk) && /block: \(my, highest\)=>updateFlowMod\.forceAccount\(highest\)/.test(blk), 'app.js — 로그인 통로(TwApi.authed) · 앱 판 한 벌(TwAppVersion) · 업데이트 흐름 forceAccount 를 잇는다');
      chk(/appVersion: \(code, me, session\)=>appVersionSyncMod\.start\(session\)/.test(code), '★ 시작은 app-boot starts 의 appVersion 한 곳(세션을 넘긴다)');
      chk((code.match(/appVersionSyncMod\.start\(/g) || []).length === 1, '  다른 자리에서 또 알리지 않는다(켤 때 한 번 · 다시 보내는 타이머 없음)');
      chk(/window\.TwAppVersion = appVer;/.test(strip(S.BIND)) && /sharedAppVersion\(window\)/.test(strip(S.BIND)), '앱 판은 sharedAppVersion 한 벌(rt-bind 가 같은 것을 내놓는다 — IPC 를 또 부르지 않는다)');
      chk(/if\(!u \|\| u\.anonymous\) return \{ state: STATE\.LOGIN, me: null \};/.test(strip(S.LOGIN)), '가입 전(익명) 로그인은 계정 확인이 «로그인 필요» · me 없음으로 걸러 이 차례에 오지 않는다(sim-app-boot 3절 — me 없으면 시작 0)');
      chk(!/firebaseAPI|import\(|localStorage/.test(strip(S.SYNC)), 'app-version-sync.js 는 Firebase · 저장소를 모른다');
    }
  })();
}

(async () => {
  await judge(SRC0);

  say('── 6. mutation test');
  const BREAKS = [
    ['SYNC', "{ version: my }", "{ version: my, device: 'x' }", '본문에 다른 값을 싣는다'],
    ['SYNC', "if(!data.behind) return { state: STATE.OK };", "", 'behind 거짓도 막는다'],
    ['SYNC', "if(block(my, data.highest) === false) warn(", "if(false) warn(", '막아야 할 때 안 막는다'],
    ['SYNC', "typeof data.behind !== 'boolean' || ", "", '글자 behind 를 믿는다'],
    ['SYNC', "if(!my){", "if(false){", '판을 몰라도 알린다'],
    ['SYNC', "=== false) warn(", "=== false) (0, function(){})(", '창을 못 띄워도 말이 없다'],
    ['SYNC', "warn('[판 맞추기] 알리지 못해 건너뜀'", "(0, function(){})('[판 맞추기] 알리지 못해 건너뜀'", '못 알린 것을 삼킨다'],
    ['SYNC', "warn('[판 맞추기] 알리지 못해 건너뜀', (e && (e.code || e.kind || e.message)) || e);", "block(my, 'x'); warn('[판 맞추기] 알리지 못해 건너뜀');", '못 닿으면 막는다'],
    ['SYNC', "    if(!session.alive()) return { state: STATE.STALE };\n    if(!isObj(data)", "    if(!isObj(data)", '끝난 세션의 답으로 막는다'],
    ['BOOT', "  'appVersion',", "", '차례 표에서 뺀다'],
    ['APP', "appVersion: (code, me, session)=>appVersionSyncMod.start(session),", "", 'app.js 가 시작을 안 건다'],
    ['APP', "=>updateFlowMod.forceAccount(highest),", "=>{},", '막아야 할 때 창을 안 띄운다'],
    ['APP', "window.TwAppVersion.ready", "(window.companion ? window.companion.getAppVersion() : null)", '앱 판을 IPC 로 또 읽는다'],
    ['BIND', "window.TwAppVersion = appVer;", "", 'rt-bind 가 앱 판 한 벌을 안 내놓는다'],
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
  chk(caught.length === BREAKS.length && !missed.length, 'mutation test ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — 못 잡음: ' + missed.join(' · ') : ''));

  console.log(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
