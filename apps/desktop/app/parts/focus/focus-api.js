/* focus-api.js — ⏱ 포커스 · 👑 달성표 · 📱 폰 연결 api provider (검사 sim-focus-api.js)
   책임: 내 진척 읽기(GET /v1/me/focus) · 집중 시간 올리기(POST …/accruals) · 별 색(PATCH /v1/me/focus) ·
     달성표 한 주 읽기(GET …/challenges/{주} · 이번 주는 …/current) · 한 벌 저장(PUT) · 오늘 달성(POST …/challenges/today) · 보상 칸 받기(POST …/{주}/rewards/{칸}) ·
     폰 키 만들기 · 끊기(POST · DELETE …/mobile-link). 서버 모양을 화면이 쓰는 모양으로 맞추는 곳은 여기뿐이다(날 경계 dayEndsAt 은 ms).
   신원: 늘 토큰의 «나» — 본문에 내 코드 · 레벨 · 양을 싣지 않는다(레벨 · 회차 · 보상 양은 서버가 센다).
   deps: authed — 로그인 API 통로(TwApi.authed — get(path, { auth, onOwner }) · post · put · patch · del(…, { expectOwner }) → Promise<data>)
         warn(...a)(진단 로그)
   내보냄: createFocusApi(deps) → {
     fetchProgress(uid) → Promise<{ totalSec, level, cycle, cycleLevel, starColor, today }> — 못 읽으면 던진다. today = { day, isoWeek, dayEndsAt(ms) }(서버 «오늘» · 06:00 한국 경계)
     accrue(uid, deltaSec) → Promise<{ status, progress?, acceptedSec?, err? }> — deltaSec 는 1 ~ 604800 정수(아니면 요청 없이 failed)
     setStarColor(uid, starColor) → Promise<{ status, progress?, err? }>
     fetchChallenge(uid, isoWeek) → Promise<달성표 한 벌> — isoWeek 가 없으면 이번 주(서버 시계). 못 읽으면 던진다(PREMIUM_REQUIRED 포함 — failOf 로 가른다)
     saveChallenge(uid, isoWeek, body) → Promise<{ status, challenge?, err? }> — body 는 editBody 가 모양을 맞춘다
     markToday(uid) → Promise<{ status, challenge?, err? }>
     claimReward(uid, isoWeek, slot) → Promise<{ status, amount?, err? }>
     issueMobileKey(uid) → Promise<{ status, key?, err? }> · unlinkMobile(uid) → Promise<{ status, err? }>
       status = 'ok' | 'stale'(읽은 뒤 로그인한 사람이 바뀌었거나 읽은 적이 없어 보내지 않았다) | 'failed'(err = 서버가 준 오류)
     reset() — 읽은 토큰 주인 기억을 비운다(계정을 놓을 때)
   }
     순수: progressOf · challengeOf · editBody · failOf · KIND · PATHS · LIMITS (TwFocusApi 위)
   ⚠️ 쓰기는 «읽은 토큰의 주인» 과 묶는다(expectOwner) — 진척 쓰기는 진척을 읽은 주인에, 달성표 쓰기는 달성표를 읽은 주인에. 읽은 적이 없으면 요청 0 · 'stale'.
   ⚠️ 보내는 줄 세우기(한 번에 하나 · 늦은 답 버림)는 부르는 쪽 몫이다 — 이 파일은 요청 하나를 보내고 답을 맞출 뿐이다.
   ⚠️ 보상 양 · 레벨 · 회차 · 오늘 판정은 서버가 센다 — 앱이 센 값을 보내지 않는다(P1).
   검사: checks/sim-focus-api.js */
(function(){
'use strict';

const enc = encodeURIComponent;
const BASE = '/v1/me/focus';
const PATHS = Object.freeze({
  progress: BASE,
  accruals: BASE + '/accruals',
  challenge: (week) => BASE + '/challenges/' + enc(week),
  current: BASE + '/challenges/current',
  today: BASE + '/challenges/today',
  reward: (week, slot) => BASE + '/challenges/' + enc(week) + '/rewards/' + enc(slot),
  mobileLink: BASE + '/mobile-link',
});
/* 서버 상한과 같은 값 — 넘기면 서버가 FOCUS_INVALID_DELTA 로 거절한다 */
const LIMITS = Object.freeze({ DELTA_MIN: 1, DELTA_MAX: 604800 });
const OWNER_CHANGED_CODE = 'OWNER_CHANGED';   // api-client.js — 쓰기 직전 토큰 주인이 읽을 때와 달라졌다
const BAD_DELTA_CODE = 'FOCUS_INVALID_DELTA';

/* 서버 코드 → 화면이 할 일의 갈래.
   premium = 프리미엄 아님(실패가 아니라 잠긴 화면) · notYet · nothing = 조용히(번호 없음) · notStarted · skipped = 오늘 달성을 조용히 다시 받기
   · conflict = 판이 어긋남(그 주를 다시 받기) · stale = 계정이 바뀌는 중이거나 읽기 전(조용히 버림) · site = 그 자리의 E-FOCUS 번호 */
const KIND = Object.freeze({ PREMIUM: 'premium', NOT_YET: 'notYet', NOTHING: 'nothing', NOT_STARTED: 'notStarted', SKIPPED: 'skipped', CONFLICT: 'conflict', STALE: 'stale', SITE: 'site' });
const KIND_OF = Object.freeze({
  PREMIUM_REQUIRED: KIND.PREMIUM,
  FOCUS_REWARD_NOT_YET: KIND.NOT_YET,
  FOCUS_REWARD_NOTHING: KIND.NOTHING,
  FOCUS_CHALLENGE_NOT_STARTED: KIND.NOT_STARTED,
  FOCUS_CHALLENGE_SKIPPED: KIND.SKIPPED,
  CONCURRENT_UPDATE: KIND.CONFLICT,
  OWNER_CHANGED: KIND.STALE,
});
function failOf(err){
  const code = (err && err.code) || '';
  return { kind: KIND_OF[code] || KIND.SITE, code };
}

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const nat = (v) => (typeof v === 'number' && isFinite(v) && v >= 0) ? Math.floor(v) : undefined;
const str = (v) => (typeof v === 'string' && v) ? v : undefined;
const shapeError = () => Object.assign(new Error('응답 모양이 달라요'), { code: 'SHAPE' });

/* 서버 «오늘» → { day, isoWeek, dayEndsAt(ms) }. 모양이 틀리면 undefined */
function todayOf(t){
  if(!isObj(t)) return undefined;
  const day = str(t.day), isoWeek = str(t.isoWeek), end = Date.parse(t.dayEndsAt);
  if(!day || !isoWeek || !isFinite(end)) return undefined;
  return { day, isoWeek, dayEndsAt: end };
}

/* 서버 진척 → 화면 진척. 모양이 틀리면 undefined */
function progressOf(d){
  if(!isObj(d)) return undefined;
  const totalSec = nat(d.totalSec), level = nat(d.level), cycle = nat(d.cycle), cycleLevel = nat(d.cycleLevel), today = todayOf(d.today);
  if(totalSec === undefined || level === undefined || cycle === undefined || cycleLevel === undefined || typeof d.starColor !== 'string' || !today) return undefined;
  return { totalSec, level, cycle, cycleLevel, starColor: d.starColor, today };
}

const slotsOf = (a) => Array.isArray(a) ? a.filter((r) => isObj(r) && typeof r.slot === 'string' && nat(r.amount) !== undefined).map((r) => ({ slot: r.slot, amount: nat(r.amount) })) : undefined;
const textsOf = (a) => Array.isArray(a) ? a.filter((x) => typeof x === 'string') : undefined;
const dayOf = (v) => typeof v === 'string' && v ? v : null;

/* 서버 달성표 한 벌 → 화면 한 벌. 모양이 틀리면 undefined. 목표(Goal)는 서버 모양 그대로 둔다 */
function challengeOf(d){
  if(!isObj(d)) return undefined;
  const version = nat(d.version), today = todayOf(d.today), rewards = slotsOf(d.rewards), claimable = slotsOf(d.claimable), uncounted = textsOf(d.uncountedDays);
  if(!str(d.isoWeek) || version === undefined || !today || !rewards || !claimable || !uncounted || !Array.isArray(d.days)) return undefined;
  const days = [];
  for(const x of d.days){ if(isObj(x) && typeof x.date === 'string' && x.date) days.push({ date: x.date, done: x.done === true }); }
  const goal = (g) => isObj(g) && typeof g.kind === 'string' ? g : null;
  return {
    isoWeek: d.isoWeek, version,
    weekdayGoal: goal(d.weekdayGoal), weekendGoal: goal(d.weekendGoal), pendingGoal: goal(d.pendingGoal),
    pendingPhase: dayOf(d.pendingPhase), pendingFrom: dayOf(d.pendingFrom),
    autoNext: d.autoNext === true, autoNextWeekend: d.autoNextWeekend === true,
    skippedWeekday: d.skippedWeekday === true, skippedWeekend: d.skippedWeekend === true,
    weekdayStartedOn: dayOf(d.weekdayStartedOn), weekendStartedOn: dayOf(d.weekendStartedOn),
    days, uncountedDays: uncounted, rewards, claimable, today,
  };
}

/* 화면 한 벌 → PUT 본문. 고치는 칸만(days · rewards · claimable · today · 시작일 · pendingFrom 은 서버가 정한다 — 싣지 않는다) */
function editBody(version, c){
  const o = isObj(c) ? c : {};
  const g = (x) => isObj(x) ? x : null;
  return {
    version,
    weekdayGoal: g(o.weekdayGoal), weekendGoal: g(o.weekendGoal), pendingGoal: g(o.pendingGoal),
    pendingPhase: o.pendingGoal ? (o.pendingPhase || null) : null,
    autoNext: o.autoNext === true, autoNextWeekend: o.autoNextWeekend === true,
    skippedWeekday: o.skippedWeekday === true, skippedWeekend: o.skippedWeekend === true,
  };
}

function createFocusApi(deps){
  const authed = deps.authed;
  const warn = deps.warn;
  const owners = new Map();   // 'progress:uid' · 'challenge:uid' → 마지막으로 읽을 때 쓴 토큰의 주인

  async function read(kind, uid, path){
    if(!uid){ const e = new Error('내 코드 없음'); e.code = 'NO_USER'; throw e; }
    let who;
    const d = await authed.get(path, { auth: true, onOwner: (w) => { who = w; } });
    owners.set(kind + ':' + uid, who);
    return d;
  }

  /* 쓰기 한 번 — 읽은 적 없으면 보내지 않는다. send({ expectOwner }) 의 답을 { status, data } 로 */
  async function write(kind, uid, what, send){
    const key = kind + ':' + uid;
    if(!uid || !owners.has(key)) return { status: 'stale' };
    try{
      const data = await send({ expectOwner: owners.get(key) });
      return { status: 'ok', data };
    }catch(e){
      if(e && e.code === OWNER_CHANGED_CODE){ owners.delete(key); return { status: 'stale' }; }
      warn('[포커스] ' + what + ' 실패', (e && (e.code || e.message)) || e);
      return { status: 'failed', err: e };
    }
  }
  const failed = (err) => ({ status: 'failed', err });

  async function progressWrite(uid, what, send){
    const r = await write('progress', uid, what, send);
    if(r.status !== 'ok') return r;
    const p = progressOf(r.data);
    return p ? { status: 'ok', progress: p, data: r.data } : failed(shapeError());
  }
  async function challengeWrite(uid, what, send){
    const r = await write('challenge', uid, what, send);
    if(r.status !== 'ok') return r;
    const c = challengeOf(r.data);
    return c ? { status: 'ok', challenge: c } : failed(shapeError());
  }

  return {
    async fetchProgress(uid){
      const p = progressOf(await read('progress', uid, PATHS.progress));
      if(!p) throw shapeError();
      return p;
    },
    async accrue(uid, deltaSec){
      if(!Number.isInteger(deltaSec) || deltaSec < LIMITS.DELTA_MIN || deltaSec > LIMITS.DELTA_MAX) return failed(Object.assign(new Error(BAD_DELTA_CODE), { code: BAD_DELTA_CODE, kind: 'request' }));
      const r = await progressWrite(uid, '집중 시간 올리기', (o) => authed.post(PATHS.accruals, { deltaSec }, o));
      if(r.status !== 'ok') return r;
      const accepted = nat(r.data.acceptedSec);
      return accepted === undefined ? failed(shapeError()) : { status: 'ok', progress: r.progress, acceptedSec: accepted };
    },
    async setStarColor(uid, starColor){
      const r = await progressWrite(uid, '별 색 바꾸기', (o) => authed.patch(PATHS.progress, { starColor }, o));
      return r.status === 'ok' ? { status: 'ok', progress: r.progress } : r;
    },
    async fetchChallenge(uid, isoWeek){
      const c = challengeOf(await read('challenge', uid, isoWeek ? PATHS.challenge(isoWeek) : PATHS.current));
      if(!c) throw shapeError();
      return c;
    },
    saveChallenge(uid, isoWeek, body){
      return challengeWrite(uid, '달성표 저장', (o) => authed.put(PATHS.challenge(isoWeek), body, o));
    },
    markToday(uid){
      return challengeWrite(uid, '오늘 달성', (o) => authed.post(PATHS.today, undefined, o));
    },
    async claimReward(uid, isoWeek, slot){
      const r = await write('challenge', uid, '보상 받기', (o) => authed.post(PATHS.reward(isoWeek, slot), undefined, o));
      if(r.status !== 'ok') return r;
      const amount = isObj(r.data) ? nat(r.data.amount) : undefined;
      return amount === undefined ? failed(shapeError()) : { status: 'ok', amount };
    },
    async issueMobileKey(uid){
      const r = await write('progress', uid, '폰 키 만들기', (o) => authed.post(PATHS.mobileLink, undefined, o));
      if(r.status !== 'ok') return r;
      const key = isObj(r.data) ? str(r.data.key) : undefined;
      return key ? { status: 'ok', key } : failed(shapeError());
    },
    async unlinkMobile(uid){
      const r = await write('progress', uid, '폰 연결 끊기', (o) => authed.del(PATHS.mobileLink, o));
      return r.status === 'failed' ? failed(r.err) : { status: r.status };
    },
    reset(){ owners.clear(); },
  };
}

const api = { createFocusApi, progressOf, challengeOf, editBody, failOf, KIND, PATHS, LIMITS };
if(typeof window !== 'undefined') window.TwFocusApi = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
