/* ═══ 🔐 functions/index.js — Together Working Cloud Functions ═══════════════════════════════
   [회원가입 설계 §4 (가) · §7-C2 · 개정 14] 비밀번호 바꾸기 함수.
   [설계 결정 10 · 개정 18 · CHECKS 개정 50] 휴지통 청소 예약 함수 — 아래 cleanTrash.
   [설계 §5-N+1 · 개정 26 · CHECKS 개정 58] 이관 창 재기 **읽기만 · 일회용** 함수 — 아래 countSlotsWindow(N+1 배포 뒤 걷는다).
   roomStats · roomStatsOnOpen · roomStatsOnClose — 열린 방 개수 요약(1분마다 · 방이 열리고 닫힐 때). 로직은 room-stats.js.
   dailyActive — 일일 접속 집계(DAU · 방문 수). accountSnap 쓰기마다 metrics/daily/{서울 날짜} 에 적는다. 로직은 daily-active.js.
   visitPing — IP 기준 일일 방문자(호출형 · 로그인 없이). 앱이 켜질 때 한 번 부른다. IP 는 해시로만 적는다. 로직은 visit-ping.js.
     비밀 값 METRICS_IP_SALT 가 있어야 배포된다: firebase functions:secrets:set METRICS_IP_SALT (길고 무작위한 값).
   usageSnapshot — 사용량(비용) 기록(매시간). Cloud Monitoring 하루 합계를 metrics/usage/{서울 날짜} 에. 로직은 usage-snapshot.js.

   changePassword (호출형 · onCall)
     · 로그인 필수 — request.auth 가 없으면 unauthenticated. 익명 세션도 거절.
     · **지금 비밀번호를 묻지 않는다** — 로그인돼 있는 PC 가 본인 증거다(되찾기 코드 없음).
     · 그 계정에 password 제공자가 있어야 한다(구글만 있는 계정은 앱에서 C3 «비밀번호 만들기» — 함수 없이).
     · 6자 이상 · 128자 이하.
     · Admin SDK 로 바꾼 뒤 refresh token 을 끊는다 → 다른 PC 는 다음 부팅에 K(이 PC는 로그인이 필요해요).
       바꾼 이 PC 도 끊기므로 앱(firebase-init authChangePassword)이 새 비밀번호로 곧바로 다시 로그인한다.
     · 데이터베이스는 건드리지 않는다(userAuth · authUsers 결속은 authUid 기준이라 그대로다).

   ⚠️ 리전은 RTDB 와 같은 asia-southeast1. 바꾸면 앱 firebase-init.js FUNCTIONS_REGION 과
     desk-companion-prototype.html CSP connect-src 의 함수 호스트를 같이 바꾼다.
   ⚠️ 이 파일은 `firebase init functions` 가 만든 functions/index.js 를 **통째로 바꿔 넣는** 판이다.
     package.json · node_modules 는 init 이 만든 그대로 쓴다(firebase-functions · firebase-admin 둘만 쓴다).
   ⚠️ cleanTrash 는 **예약 함수**라 Cloud Scheduler 를 쓴다(Blaze · 한 달 작업 3개까지 무료). 처음 배포할 때
     Cloud Scheduler API 를 켜라는 질문이 나오면 «예». 배포: firebase deploy --only functions */
'use strict';
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onValueCreated, onValueDeleted, onValueWritten } = require('firebase-functions/v2/database');
const { setGlobalOptions } = require('firebase-functions/v2');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
/* ⚠️ firebase-admin/database 는 맨 위에서 require 하지 않는다 — 배포 때 CLI 가 이 파일을 10초 안에 읽어야 하는데
   («User code failed to load … Timeout after 10000»), 데이터베이스 모듈은 무거워서 느린 PC 에선 그 안에 못 끝난다.
   cleanTrash 가 돌 때 처음 한 번만 읽는다(runCleanTrash 안). */

initializeApp();
setGlobalOptions({ region: 'asia-southeast1', maxInstances: 5 });

const PW_MIN = 6;
const PW_MAX = 128;

exports.changePassword = onCall(async (request) => {
  const auth = request.auth;
  if (!auth || !auth.uid) throw new HttpsError('unauthenticated', '로그인이 필요해요');
  const provider = auth.token && auth.token.firebase && auth.token.firebase.sign_in_provider;
  if (provider === 'anonymous') throw new HttpsError('permission-denied', '가입이 끝나지 않은 계정이에요');

  const pw = request.data && request.data.password;
  if (typeof pw !== 'string' || pw.length < PW_MIN || pw.length > PW_MAX) {
    throw new HttpsError('invalid-argument', `비밀번호는 ${PW_MIN}자 이상 ${PW_MAX}자 이하로 정해 주세요`);
  }

  const adminAuth = getAuth();
  let user;
  try { user = await adminAuth.getUser(auth.uid); }
  catch (e) { throw new HttpsError('permission-denied', '계정을 찾지 못했어요'); }   // not-found 는 앱이 «함수 배포 전» 으로 읽는다
  const hasPw = (user.providerData || []).some(p => p && p.providerId === 'password');
  if (!hasPw) throw new HttpsError('failed-precondition', '비밀번호가 없는 계정이에요');

  await adminAuth.updateUser(auth.uid, { password: pw });
  await adminAuth.revokeRefreshTokens(auth.uid);
  console.log('[changePassword] 바꿈', auth.uid);   // 비밀번호는 절대 로그에 남기지 않는다
  return { ok: true };
});

/* ═══ 🗑️ cleanTrash — 휴지통 청소 (설계 결정 10 · §2-2 개정 5 · CHECKS 개정 50) ════════════════════════════
   users/{uid}/trash/{cid}/{mtime} = { def, why, at }
     why 'deleted'     (옮김)      at + 3일  이 지나면 지운다
     why 'overwritten' (연동 교체) at + 10일 이 지나면 지운다
   · 앱은 휴지통을 **지울 수 없다**(규칙 잎 «없을 때만 쓰기») — 지우는 것은 이 함수(Admin SDK · 규칙 밖)와 콘솔뿐.
     그래서 규칙은 바꾸지 않는다.
   · 기한은 앱의 _charsTrashView 와 **같은 값**이다(앱은 기한 지난 줄을 화면에서만 숨기고, 여기서 실제로 지운다).
     한쪽만 바꾸면 «화면에선 사라졌는데 서버엔 남음» 이나 «사라진다고 적은 날보다 먼저 지움» 이 생긴다.
   · 모양이 틀린 줄(why 가 두 값이 아님 · at 이 숫자가 아님)은 **지우지 않고 센다** — 무엇인지 모르는 것을 지우지 않는다.
   · 사람 목록: RTDB REST 의 shallow(키만 · 본문 없음)로 users 아래 uid 만 받는다. 못 받으면 friendCodes ∪ userAuth 로.
     users 를 Admin SDK 로 통째 읽으면 모든 사람의 모든 데이터를 내려받는다 — 하지 않는다.
   · 한 사람의 지울 줄은 **한 번의 update(null)** 로(경로 여럿 · 원자적). 한 사람이 실패해도 다음 사람은 계속한다.
   · 매일 04:00(서울). 아무 줄도 안 지웠으면 한 줄만 남긴다. 캐릭터 내용(def)은 로그에 남기지 않는다. */
const TRASH_TTL = { deleted: 3 * 24 * 60 * 60 * 1000, overwritten: 10 * 24 * 60 * 60 * 1000 };
const CID_RE = /^c[a-z0-9]{6,24}$/;

/* 순수 — 한 사람의 휴지통 → 지울 경로 목록 · 모양 틀린 줄 수. ★ 따로 export 하지 않는다 — 배포가 내보낸 객체를 함수 묶음으로 읽는다. */
function trashExpiredPaths(trash, now){
  const paths = []; let odd = 0, kept = 0;
  if (!trash || typeof trash !== 'object') return { paths, odd, kept };
  for (const cid in trash){
    const per = trash[cid];
    if (!CID_RE.test(cid) || !per || typeof per !== 'object'){ odd++; continue; }
    for (const mt in per){
      const t = per[mt];
      const ttl = t && TRASH_TTL[t.why];
      if (!ttl || typeof t.at !== 'number' || !isFinite(t.at)){ odd++; continue; }
      if (t.at + ttl <= now) paths.push('trash/' + cid + '/' + mt);
      else kept++;
    }
  }
  return { paths, odd, kept };
}

async function listUserIds(db){
  try{
    const url = String(db.ref().toString()).replace(/\/$/, '') + '/users.json?shallow=true';
    const cred = require('firebase-admin/app').getApp().options.credential;
    const tok = cred && await cred.getAccessToken();
    const res = await fetch(url, { headers: tok ? { Authorization: 'Bearer ' + tok.access_token } : {} });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    if (j && typeof j === 'object') return { ids: Object.keys(j), via: 'shallow' };
    return { ids: [], via: 'shallow' };
  }catch(e){
    console.warn('[cleanTrash] shallow 목록 실패 — friendCodes ∪ userAuth 로', String(e && e.message || e));
    const ids = new Set();
    const [fc, ua] = await Promise.all([ db.ref('friendCodes').get(), db.ref('userAuth').get() ]);
    const f = fc.val() || {}; for (const k in f){ const u = f[k] && f[k].userId; if (typeof u === 'string' && u) ids.add(u); }
    const a = ua.val() || {}; for (const k in a) ids.add(k);
    return { ids: Array.from(ids), via: 'fallback' };
  }
}

async function runCleanTrash(db, now){
  const { ids, via } = await listUserIds(db);
  let users = 0, removed = 0, odd = 0, kept = 0, failed = 0;
  for (const uid of ids){
    if (typeof uid !== 'string' || !uid || /[.#$\[\]\/]/.test(uid)) continue;
    let trash;
    try{ trash = (await db.ref('users/' + uid + '/trash').get()).val(); }
    catch(e){ failed++; continue; }
    if (!trash) continue;
    const r = trashExpiredPaths(trash, now);
    odd += r.odd; kept += r.kept;
    if (!r.paths.length) continue;
    const patch = {}; for (const p of r.paths) patch[p] = null;
    try{ await db.ref('users/' + uid).update(patch); users++; removed += r.paths.length; }
    catch(e){ failed++; console.warn('[cleanTrash] 지우기 실패', uid, String(e && e.message || e)); }
  }
  const sum = { via, scanned: ids.length, users, removed, kept, odd, failed };
  console.log('[cleanTrash]', JSON.stringify(sum));
  return sum;
}

exports.cleanTrash = onSchedule({ schedule: 'every day 04:00', timeZone: 'Asia/Seoul', timeoutSeconds: 540, retryCount: 0 },
  async () => {
    const { getDatabase } = require('firebase-admin/database');   // 늦게 읽기 — 위 ⚠️
    await runCleanTrash(getDatabase(), Date.now());
  });


/* ═══ 📏 countSlotsWindow — 이관 창 재기 · **읽기만 · 일회용** (설계 §5-N+1 · 개정 26 · CHECKS 개정 58) ════════════
   [무엇을 재나] «옛 앱(N 이전)이 아직 slots 를 쓰고 있는 계정이 몇인가». N+1 은 slots 쓰기를 멈추고 되돌이를 걷는다 —
     그 뒤에 옛 앱이 slots 를 바꾸면 그 변경은 어디에도 안 들어온다. 그래서 옛 앱이 다 빠졌는지를 **세고** 걷는다.
   [신호] 새 앱은 chars 를 쓸 때 charsMeta/ts 를 **같은 update 안에서** 찍는다(firebase-init saveCharsEntries). 옛 앱은 slots 만 쓴다.
     · slots.ts > max(charsMeta.migratedAt, charsMeta.ts) + 10분  → 새 앱이 마지막으로 쓴 뒤에 옛 앱이 썼다 = **old**
       (새 앱에서 chars 올리기만 실패한 계정도 old 로 잡힌다 — 창을 **늦게** 닫는 쪽의 오판이라 안전하다)
     · charsMeta.migratedAt 없음(slots 는 있음)                → 새 앱을 한 번도 안 켠 계정 = **unmigrated**
       (N+1 에서도 첫 이관(loadSlotsRemote · loadSlotsPrevRemote)은 남기므로 창을 막지 않는다 — 설계 개정 26 D1)
     · slots.ts 없음                                         → noSlots      · 그 밖 → new
   [닫혔다고 보는 조건 셋] ① config/minRoomVer 를 N 버전으로 올렸다 ② N 배포 뒤 14일 ③ 일주일 간격 두 번 실행에서 oldWriter7d = 0.
   · uid 마다 slots/ts · charsMeta 두 값만 읽는다 — slots 본문(칸당 최대 15만 자)은 안 읽는다. **아무것도 쓰지 않는다.**
   · 로그: {via, scanned, noSlots, unmigrated, old7d, old, newest, latestOldAt} — 계정 내용은 남기지 않는다. latestOldAt 은 old 중 가장 최근 slots.ts(ISO).
   · 일정은 1월 1일 05:10 — 저절로 돌 일은 거의 없다(돌아도 읽기만). Scheduler «강제 실행» 으로만 쓴다
     (firebase-schedule-countSlotsWindow-asia-southeast1). N+1 배포 뒤 이 블록을 걷는다. */
const SLOTS_WINDOW_TOL_MS = 10 * 60 * 1000;
const SLOTS_WINDOW_RECENT_MS = 7 * 24 * 60 * 60 * 1000;

/* 순수 — 한 계정의 갈래. ★ 따로 export 하지 않는다(cleanTrash 와 같은 이유). */
function slotsWindowClass(slotsTs, meta, now){
  const st = Number(slotsTs);
  if (!(st > 0)) return 'noSlots';
  const migratedAt = meta && Number(meta.migratedAt);
  if (!(migratedAt > 0)) return 'unmigrated';
  const newest = Math.max(migratedAt, Number(meta.ts) || 0);
  if (st > newest + SLOTS_WINDOW_TOL_MS) return (st > now - SLOTS_WINDOW_RECENT_MS) ? 'old7d' : 'old';
  return 'new';
}

async function runCountSlotsWindow(db, now){
  const { ids, via } = await listUserIds(db);
  const sum = { via, scanned: ids.length, noSlots: 0, unmigrated: 0, old7d: 0, old: 0, newest: 0, failed: 0 };
  let latestOld = 0;
  for (const uid of ids){
    if (typeof uid !== 'string' || !uid || /[.#$\[\]\/]/.test(uid)) continue;
    let st, meta;
    try{
      [st, meta] = await Promise.all([
        db.ref('users/' + uid + '/slots/ts').get().then(s => s.val()),
        db.ref('users/' + uid + '/charsMeta').get().then(s => s.val()),
      ]);
    }catch(e){ sum.failed++; continue; }
    const k = slotsWindowClass(st, meta, now);
    if (k === 'new') sum.newest++; else sum[k]++;
    if (k === 'old7d' || k === 'old') latestOld = Math.max(latestOld, Number(st) || 0);
  }
  const out = Object.assign({}, sum, { latestOldAt: latestOld ? new Date(latestOld).toISOString() : null });
  console.log('[countSlotsWindow]', JSON.stringify(out));
  return out;
}

exports.countSlotsWindow = onSchedule({ schedule: '10 5 1 1 *', timeZone: 'Asia/Seoul', timeoutSeconds: 540, retryCount: 0 },
  async () => {
    const { getDatabase } = require('firebase-admin/database');   // 늦게 읽기 — 맨 위 ⚠️
    await runCountSlotsWindow(getDatabase(), Date.now());
  });


// 열린 방 개수 요약 — room-stats.js
exports.roomStats = onSchedule({ schedule: 'every 1 minutes', timeoutSeconds: 60, retryCount: 0, maxInstances: 1 },
  async () => {
    const { getDatabase } = require('firebase-admin/database');   // 배포 때 로딩 시간 제한 때문에 여기서 require
    await require('./room-stats').runRoomStats(getDatabase(), Date.now());
  });

// 방이 열리면(roomIndex 줄 생성) 바로 다시 센다. 하트비트(줄 수정)에는 반응하지 않는다.
exports.roomStatsOnOpen = onValueCreated({ ref: '/roomIndex/{room}', timeoutSeconds: 60, maxInstances: 2 },
  async () => {
    const { getDatabase } = require('firebase-admin/database');   // 배포 때 로딩 시간 제한 때문에 여기서 require
    await require('./room-stats').runRoomStats(getDatabase(), Date.now(), { drop: false });
  });

// 마지막 사람이 나가면 앱이 roomIndex 줄을 지운다(firebase-init.js _finalCleanup). 그때 바로 다시 센다.
// 서버(roomStats 청소)가 지운 건 건너뛴다 — 청소가 이미 셌고, 한 번에 수백 줄을 지우면 그만큼 다시 돈다.
// 강제 종료 · 절전처럼 줄을 지울 사람이 없는 방은 1분 주기가 처리한다.
exports.roomStatsOnClose = onValueDeleted({ ref: '/roomIndex/{room}', timeoutSeconds: 60, maxInstances: 2 },
  async (event) => {
    if (event.authType === 'admin') return;
    const { getDatabase } = require('firebase-admin/database');   // 배포 때 로딩 시간 제한 때문에 여기서 require
    await require('./room-stats').runRoomStats(getDatabase(), Date.now(), { drop: false });
  });

// 앱이 부팅마다 accountSnap/{코드} 를 쓴다 — 그 쓰기를 그날의 접속으로 센다(daily-active.js). 지우기는 세지 않는다.
exports.dailyActive = onValueWritten({ ref: '/accountSnap/{userId}', timeoutSeconds: 60, maxInstances: 5 },
  async (event) => {
    const { getDatabase } = require('firebase-admin/database');   // 배포 때 로딩 시간 제한 때문에 여기서 require
    await require('./daily-active').runDailyActive(getDatabase(), event, Date.parse(event.time) || Date.now());
  });

/* 사용량(비용) 기록 — Cloud Monitoring 에서 어제 · 오늘(서울)의 RTDB · 함수 · Storage · Hosting 하루 합계를 받아
   metrics/usage/{날짜} 에 적는다(usage-snapshot.js). 함수 서비스 계정에 Monitoring 읽기(roles/monitoring.viewer)가 있어야 한다.
   토큰은 Admin SDK 기본 자격 증명(cleanTrash 의 shallow 목록과 같은 방법)으로 받는다. */
exports.usageSnapshot = onSchedule({ schedule: 'every 60 minutes', timeZone: 'Asia/Seoul', timeoutSeconds: 120, retryCount: 0, maxInstances: 1 },
  async () => {
    const { getDatabase } = require('firebase-admin/database');   // 배포 때 로딩 시간 제한 때문에 여기서 require
    const app = require('firebase-admin/app').getApp();
    const tok = await app.options.credential.getAccessToken();
    const cfg = JSON.parse(process.env.FIREBASE_CONFIG || '{}');
    const project = cfg.projectId || process.env.GCLOUD_PROJECT;
    await require('./usage-snapshot').runUsageSnapshot({
      db: getDatabase(), fetch, token: tok.access_token, project, bucket: cfg.storageBucket || null,
    }, Date.now());
  });

/* IP 기준 일일 방문자 — 앱(visit-ping.js)이 켜질 때 한 번 부른다. 로그인하지 않은 사람도 세야 해서 인증을 보지 않는다.
   누구나 부를 수 있으므로 돌려주는 것은 늘 { ok: true } 하나다. 지표가 앱을 막지 않게 실패도 밖으로 던지지 않는다.
   data.ver(앱 버전)는 받기만 하고 쓰지 않는다 — 무엇이 오든(없음 · 틀린 모양) 거절하지 않고 그대로 센다. */
const METRICS_IP_SALT = defineSecret('METRICS_IP_SALT');
exports.visitPing = onCall({ secrets: [METRICS_IP_SALT], timeoutSeconds: 10, maxInstances: 5, enforceAppCheck: false },
  async (request) => {
    try {
      const { getDatabase } = require('firebase-admin/database');   // 배포 때 로딩 시간 제한 때문에 여기서 require
      await require('./visit-ping').runVisitPing(getDatabase(), request, Date.now(), METRICS_IP_SALT.value());
    } catch (e) {
      console.warn('[visitPing] 못 적음', e && e.message);   // IP 는 로그에 남기지 않는다
    }
    return { ok: true };
  });
