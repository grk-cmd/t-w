/* ═══ ⏱ sim-focus-api.js — 포커스 · 달성표 · 폰 연결 api provider (0.13 앱 묶음 D5-1) ═══
   [왜] 포커스 누적 · 달성표 · 폰 키가 Firebase 대신 우리 서버(/v1/me/focus*)를 쓴다. 서버 모양을 화면 모양으로 맞추는 곳이 provider 하나라 실제로 불러서 판정한다.
   ・1절: 읽기 — 진척 · 달성표 경로 · 모양 맞춤(날 경계 ms) · 모양 틀림은 던짐 · 이번 주(current) · PREMIUM_REQUIRED 는 던져서 갈래로
   ・2절: 쓰기 — 경로 · 메서드 · 본문 · 읽은 토큰의 주인과 묶음(읽은 적 없으면 요청 0) · 서버 거절은 failed + err · 상한 밖 deltaSec 는 요청 0 · 갈래(failOf)
   ・3절: 배선 — html 순서 · smoke · 오류 번호 표
   ・4절: 일부러 깨 보기
   [실행] 러너 스테이징(평면)에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find(Boolean);
const SRC0 = {
  API: pick(['focus-api.js', 'parts/focus/focus-api.js', 'app/parts/focus/focus-api.js']),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
  SMOKE: pick(['smoke.js']),
  EC: pick(['error-codes.js', 'parts/shared/error-codes.js', 'app/parts/shared/error-codes.js']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const load = (src) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w.TwFocusApi; };

const apiErr = (status, code) => Object.assign(new Error(code || String(status)), { status, code: code || '', kind: status >= 500 ? 'unavailable' : 'request' });
const TODAY = { day: '2026-11-14', isoWeek: '2026-W46', dayEndsAt: '2026-11-14T21:00:00Z' };
const prog = (o) => Object.assign({ totalSec: 7200, level: 2, cycle: 0, cycleLevel: 2, starColor: 'gold', today: TODAY }, o || {});
const chal = (o) => Object.assign({
  isoWeek: '2026-W46', version: 3, weekdayGoal: { kind: 'TIME', hours: 2 }, weekendGoal: null, pendingGoal: null, pendingPhase: null, pendingFrom: null,
  autoNext: true, autoNextWeekend: false, skippedWeekday: false, skippedWeekend: false, weekdayStartedOn: '2026-11-10', weekendStartedOn: null,
  days: [{ date: '2026-11-10', done: true }], uncountedDays: ['2026-11-11'], rewards: [{ slot: 'WEEKDAY_EARLY', amount: 1 }], claimable: [{ slot: 'WEEKDAY_EARLY', amount: 1 }], today: TODAY,
}, o || {});

function fake(routes, who){
  const log = [];
  const run = async (method, path, body, opts) => {
    log.push({ method, path, body, opts });
    const key = method + ' ' + path;
    if(!(key in routes)) throw apiErr(404, 'NOT_FOUND');
    const r = routes[key];
    const v = typeof r === 'function' ? r(body) : r;
    if(v instanceof Error) throw v;
    if(method === 'GET' && opts && opts.onOwner) opts.onOwner(who || 'ME01');
    return v;
  };
  return { log, get: (p, o) => run('GET', p, undefined, o), put: (p, b, o) => run('PUT', p, b, o), patch: (p, b, o) => run('PATCH', p, b, o), post: (p, b, o) => run('POST', p, b, o), del: (p, o) => run('DELETE', p, undefined, o) };
}
const mk = (src, routes, who) => {
  const authed = fake(routes, who), warns = [];
  const m = load(src).createFocusApi({ authed, warn: (...a) => warns.push(a.join(' ')) });
  return { m, authed, warns };
};
const W = '/v1/me/focus/challenges/2026-W46';
const ROUTES = () => ({
  'GET /v1/me/focus': prog(), 'POST /v1/me/focus/accruals': prog({ totalSec: 7800, acceptedSec: 600 }), 'PATCH /v1/me/focus': (b) => prog({ starColor: b.starColor }),
  ['GET ' + W]: chal(), 'GET /v1/me/focus/challenges/current': chal(), ['PUT ' + W]: chal({ version: 4 }), 'POST /v1/me/focus/challenges/today': chal({ version: 5 }),
  ['POST ' + W + '/rewards/WEEKDAY_EARLY']: { amount: 1 }, 'POST /v1/me/focus/mobile-link': { key: 'KEY123' }, 'DELETE /v1/me/focus/mobile-link': null,
});

async function judge(S){
  const LIB = S.API;
  say('── 1. 읽기');
  {
    const { m, authed } = mk(LIB, ROUTES());
    const p = await m.fetchProgress('ME01');
    chk(authed.log[0].path === '/v1/me/focus' && authed.log[0].method === 'GET' && authed.log[0].opts.auth === true, '진척 — GET /v1/me/focus · 로그인 통로로');
    chk(p.totalSec === 7200 && p.level === 2 && p.cycle === 0 && p.cycleLevel === 2 && p.starColor === 'gold', '  누적 · 레벨 · 회차 · 회차 안 레벨 · 별 색 — 서버 값 그대로');
    chk(p.today.day === '2026-11-14' && p.today.isoWeek === '2026-W46' && p.today.dayEndsAt === Date.parse('2026-11-14T21:00:00Z'), '  서버 «오늘» — 날 · 주 · 경계(ms · 한국 06:00 = 21:00Z)');
    for(const [name, bad] of [['null', null], ['totalSec 음수', prog({ totalSec: -1 })], ['level 글자', prog({ level: 'x' })], ['today 없음', prog({ today: undefined })], ['경계 시각 틀림', prog({ today: Object.assign({}, TODAY, { dayEndsAt: 'x' }) })], ['starColor 없음', prog({ starColor: undefined })]]){
      const b = mk(LIB, { 'GET /v1/me/focus': bad });
      let t = null; try{ await b.m.fetchProgress('ME01'); }catch(x){ t = x; }
      chk(t && t.code === 'SHAPE', '모양이 틀리면(' + name + ') 던진다');
    }
    let t1 = null; try{ await m.fetchProgress(''); }catch(x){ t1 = x; }
    chk(t1 && t1.code === 'NO_USER', '내 코드가 없으면 요청 없이 던진다');
    const down = mk(LIB, { 'GET /v1/me/focus': apiErr(503, 'X') });
    let t2 = null; try{ await down.m.fetchProgress('ME01'); }catch(x){ t2 = x; }
    chk(t2 && t2.status === 503, '못 읽으면 던진다(빈 진척으로 숨기지 않는다)');
    authed.log.length = 0;
    const c = await m.fetchChallenge('ME01', '2026-W46');
    chk(authed.log[0].path === W && c.version === 3 && c.weekdayGoal.kind === 'TIME' && c.weekendGoal === null && c.autoNext === true && c.days.length === 1 && c.days[0].done === true, '달성표 — GET …/challenges/{주} · 판 · 목표(없으면 null) · 날');
    chk(c.uncountedDays[0] === '2026-11-11' && c.claimable[0].slot === 'WEEKDAY_EARLY' && c.rewards[0].amount === 1 && c.weekdayStartedOn === '2026-11-10' && c.today.dayEndsAt > 0, '  안 센 날 · 받을 칸 · 보상 · 시작일 · 서버 오늘');
    authed.log.length = 0;
    await m.fetchChallenge('ME01');
    chk(authed.log[0].path === '/v1/me/focus/challenges/current', '  주를 안 주면 이번 주(current)');
    for(const [name, bad] of [['version 없음', chal({ version: undefined })], ['days 없음', chal({ days: null })], ['claimable 없음', chal({ claimable: undefined })], ['today 없음', chal({ today: null })]]){
      const b = mk(LIB, { ['GET ' + W]: bad });
      let t = null; try{ await b.m.fetchChallenge('ME01', '2026-W46'); }catch(x){ t = x; }
      chk(t && t.code === 'SHAPE', '  모양이 틀리면(' + name + ') 던진다');
    }
    const lock = mk(LIB, { ['GET ' + W]: apiErr(403, 'PREMIUM_REQUIRED') });
    let t3 = null; try{ await lock.m.fetchChallenge('ME01', '2026-W46'); }catch(x){ t3 = x; }
    chk(t3 && load(LIB).failOf(t3).kind === 'premium', '프리미엄이 아니면 던지고 갈래는 premium(실패 번호가 아니라 잠긴 화면)');
  }
  say('── 2. 쓰기');
  {
    const { m, authed } = mk(LIB, ROUTES());
    chk((await m.accrue('ME01', 600)).status === 'stale' && (await m.markToday('ME01')).status === 'stale' && (await m.issueMobileKey('ME01')).status === 'stale' && authed.log.length === 0, '읽은 적 없으면 쓰기는 요청 0 · stale');
    await m.fetchProgress('ME01'); authed.log.length = 0;
    const a = await m.accrue('ME01', 600);
    const g = authed.log[0];
    chk(a.status === 'ok' && a.progress.totalSec === 7800 && a.acceptedSec === 600 && g.method === 'POST' && g.path === '/v1/me/focus/accruals' && JSON.stringify(g.body) === JSON.stringify({ deltaSec: 600 }) && g.opts.expectOwner === 'ME01', '올리기 — POST …/accruals { deltaSec } 만 · 읽은 주인에 묶음');
    const noAcc = mk(LIB, Object.assign(ROUTES(), { 'POST /v1/me/focus/accruals': prog() }));
    await noAcc.m.fetchProgress('ME01');
    chk((await noAcc.m.accrue('ME01', 60)).err.code === 'SHAPE', 'acceptedSec 없는 답은 failed · SHAPE');
    const acc2 = mk(LIB, Object.assign(ROUTES(), { 'POST /v1/me/focus/accruals': Object.assign(prog(), { acceptedSec: 500 }) }));
    await acc2.m.fetchProgress('ME01');
    chk((await acc2.m.accrue('ME01', 600)).acceptedSec === 500, '  받아 준 몫(acceptedSec)을 그대로 돌려준다');
    authed.log.length = 0;
    for(const d of [0, -5, 604801, 1.5, NaN, '60', undefined]){
      const r = await m.accrue('ME01', d);
      chk(r.status === 'failed' && r.err.code === 'FOCUS_INVALID_DELTA', '  deltaSec ' + String(d) + ' 는 요청 없이 failed');
    }
    chk(authed.log.length === 0 && (await m.accrue('ME01', 1)).status === 'ok' && (await m.accrue('ME01', 604800)).status === 'ok', '  경계 1 · 604800 은 보낸다');
    authed.log.length = 0;
    const s = await m.setStarColor('ME01', 'blue');
    chk(s.status === 'ok' && s.progress.starColor === 'blue' && authed.log[0].method === 'PATCH' && authed.log[0].path === '/v1/me/focus' && JSON.stringify(authed.log[0].body) === JSON.stringify({ starColor: 'blue' }), '별 색 — PATCH /v1/me/focus { starColor }');
    authed.log.length = 0;
    const k = await m.issueMobileKey('ME01');
    chk(k.status === 'ok' && k.key === 'KEY123' && authed.log[0].method === 'POST' && authed.log[0].path === '/v1/me/focus/mobile-link' && authed.log[0].opts.expectOwner === 'ME01', '폰 키 만들기 — POST …/mobile-link → 키');
    authed.log.length = 0;
    const u = await m.unlinkMobile('ME01');
    chk(u.status === 'ok' && authed.log[0].method === 'DELETE' && authed.log[0].path === '/v1/me/focus/mobile-link', '폰 연결 끊기 — DELETE …/mobile-link');
    chk((await m.markToday('ME01')).status === 'stale', '달성표를 읽기 전 오늘 달성은 보내지 않는다(달성표 주인은 따로 읽는다)');
    await m.fetchChallenge('ME01', '2026-W46'); authed.log.length = 0;
    const body = { version: 3, weekdayGoal: { kind: 'TIME', hours: 3 }, weekendGoal: null, pendingGoal: null, pendingPhase: null, autoNext: true, autoNextWeekend: false, skippedWeekday: false, skippedWeekend: false };
    const sv = await m.saveChallenge('ME01', '2026-W46', body);
    chk(sv.status === 'ok' && sv.challenge.version === 4 && authed.log[0].method === 'PUT' && authed.log[0].path === W && authed.log[0].body === body && authed.log[0].opts.expectOwner === 'ME01', '달성표 저장 — PUT …/{주} 한 벌 · 답의 한 벌');
    authed.log.length = 0;
    const td = await m.markToday('ME01');
    chk(td.status === 'ok' && td.challenge.version === 5 && authed.log[0].method === 'POST' && authed.log[0].path === '/v1/me/focus/challenges/today' && authed.log[0].body === undefined, '오늘 달성 — POST …/challenges/today · 본문 없음(오늘 판정 · 양은 서버)');
    authed.log.length = 0;
    const rw = await m.claimReward('ME01', '2026-W46', 'WEEKDAY_EARLY');
    chk(rw.status === 'ok' && rw.amount === 1 && authed.log[0].path === W + '/rewards/WEEKDAY_EARLY' && authed.log[0].body === undefined, '보상 칸 — POST …/{주}/rewards/{칸} → { amount } · 본문 없음(양을 앱이 보내지 않는다)');
    const eb = load(LIB).editBody(7, chal({ pendingGoal: { kind: 'TIME', hours: 1 }, pendingPhase: 'WEEKDAY' }));
    chk(eb.version === 7 && !('days' in eb) && !('rewards' in eb) && !('today' in eb) && !('weekdayStartedOn' in eb) && !('pendingFrom' in eb) && eb.pendingPhase === 'WEEKDAY' && eb.autoNext === true && eb.weekdayGoal.hours === 2, '한 벌 본문 — 고치는 칸만(기록 · 보상 · 시작일은 서버가 정함)');
    chk(load(LIB).editBody(1, chal()).pendingPhase === null, '  다음 날 목표가 없으면 단계도 null');

    const sc = mk(LIB, Object.assign(ROUTES(), { 'POST /v1/me/focus/challenges/today': apiErr(409, 'FOCUS_CHALLENGE_NOT_STARTED'), ['POST ' + W + '/rewards/WEEKDAY_EARLY']: apiErr(409, 'FOCUS_REWARD_NOT_YET'), ['PUT ' + W]: apiErr(409, 'CONCURRENT_UPDATE') }));
    await sc.m.fetchChallenge('ME01', '2026-W46');
    const F = load(LIB).failOf;
    const t = await sc.m.markToday('ME01'), r = await sc.m.claimReward('ME01', '2026-W46', 'WEEKDAY_EARLY'), p = await sc.m.saveChallenge('ME01', '2026-W46', body);
    chk(t.status === 'failed' && F(t.err).kind === 'notStarted' && F(r.err).kind === 'notYet' && F(p.err).kind === 'conflict' && sc.warns.length === 3, '서버 거절은 던지지 않고 failed + err · 갈래(notStarted · notYet · conflict) · 진단 기록');
    chk(F({ code: 'FOCUS_REWARD_NOTHING' }).kind === 'nothing' && F({ code: 'FOCUS_CHALLENGE_SKIPPED' }).kind === 'skipped' && F({ code: 'PREMIUM_REQUIRED' }).kind === 'premium' && F({ code: 'OWNER_CHANGED' }).kind === 'stale' && F({ status: 503 }).kind === 'site' && F(null).kind === 'site', '  갈래 표 — 그 밖은 site(그 자리의 번호)');

    const ow = mk(LIB, ROUTES());
    await ow.m.fetchProgress('ME01');
    ow.authed.post = async () => { throw Object.assign(new Error('x'), { code: 'OWNER_CHANGED', kind: 'auth' }); };
    chk((await ow.m.accrue('ME01', 60)).status === 'stale' && (await ow.m.accrue('ME01', 60)).status === 'stale' && ow.warns.length === 0, '쓰기 직전 주인이 바뀌면 stale · 기억을 버려 다시 읽기 전엔 안 보낸다 · 실패로 알리지 않는다');
    ow.m.reset();
    chk((await mk(LIB, ROUTES()).m.setStarColor('ME01', 'x')).status === 'stale', 'reset 뒤에는 읽기 전까지 쓰지 않는다');
  }
  say('── 3. 배선');
  {
    const tag = (f) => S.HTML.indexOf('<script src="parts/' + f + '"></script>');
    chk(tag('focus/focus-api.js') > 0 && tag('focus/focus-api.js') < tag('app.js'), 'html — focus-api.js 가 app.js 보다 먼저');
    chk(/PRELOAD\.push\('focus-api\.js'\)/.test(S.SMOKE), 'smoke PRELOAD 에 있다');
    const mod = { exports: {} }; new Function('window', 'module', S.EC)(undefined, mod);
    chk(['01', '02', '03', '04', '05', '06', '07', '08', '09'].every((n) => mod.exports.CODES['E-FOCUS-' + n]), '오류 번호 E-FOCUS-01~09 가 표에 있다');
  }
}

async function runAll(){
  const S = SRC0;
  await judge(S);
  say('── 4. 일부러 깨 보기');
  const breaks = [
    ['진척 경로 틀림', S.API.replace("progress: BASE,", "progress: BASE + '/x',"), '/v1/me/focus'],
    ['올리기 경로 틀림', S.API.replace("'/accruals'", "'/accrual'"), 'accruals'],
    ['날 경계를 글자로 둠', S.API.replace("return { day, isoWeek, dayEndsAt: end };", "return { day, isoWeek, dayEndsAt: t.dayEndsAt };"), '경계(ms)'],
    ['쓰기가 주인을 안 묶음', S.API.replace("const data = await send({ expectOwner: owners.get(key) });", "const data = await send({});"), '읽은 주인'],
    ['읽기 전에도 보냄', S.API.replace("if(!uid || !owners.has(key)) return { status: 'stale' };", "if(!uid) return { status: 'stale' };"), '요청 0'],
    ['상한을 안 봄', S.API.replace("deltaSec > LIMITS.DELTA_MAX", "false"), '604800'],
    ['받아 준 몫을 안 돌려줌', S.API.replace("acceptedSec: accepted", "acceptedSec: deltaSec"), 'acceptedSec'],
    ['오늘 달성에 본문을 실음', S.API.replace("authed.post(PATHS.today, undefined, o)", "authed.post(PATHS.today, { done: true }, o)"), '본문 없음'],
    ['보상에 양을 실음', S.API.replace("authed.post(PATHS.reward(isoWeek, slot), undefined, o)", "authed.post(PATHS.reward(isoWeek, slot), { amount: 9 }, o)"), '양을 앱이 보내지'],
    ['보상 경로 틀림', S.API.replace("'/rewards/'", "'/reward/'"), 'rewards'],
    ['저장 메서드 틀림', S.API.replace("authed.put(PATHS.challenge(isoWeek)", "authed.post(PATHS.challenge(isoWeek)"), 'PUT'],
    ['프리미엄 갈래를 지움', S.API.replace("PREMIUM_REQUIRED: KIND.PREMIUM,", ""), 'premium'],
    ['모양 틀림을 통과시킴', S.API.replace("version === undefined || !today || !rewards", "version === undefined || !rewards"), '모양'],
    ['서버가 정할 칸을 본문에 실음', S.API.replace("    version,\n    weekdayGoal: g(o.weekdayGoal)", "    version, days: o.days,\n    weekdayGoal: g(o.weekdayGoal)"), '고치는 칸만'],
  ];
  for(const [name, src, what] of breaks){
    if(src === S.API){ chk(false, name + ' — 바꿀 글을 못 찾음'); continue; }
    quiet = true; qfail = 0;
    try{ await judge(Object.assign({}, S, { API: src })); }catch(_){ qfail++; }
    quiet = false;
    chk(qfail > 0, name + ' → 빨강(' + what + ')');
  }
  say('\n통과 ' + pass + ' · 실패 ' + fail);
  process.exit(fail ? 1 : 0);
}
runAll();
