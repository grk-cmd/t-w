/*
 * 일일 접속 집계 — accountSnap/{userCode} 쓰기 하나를 «그날의 방문 1번 + 그날 접속한 사람 1명» 으로 적는다.
 *   metrics/daily/{YYYY-MM-DD}/u/{userCode} = true   (고유 사용자 — 키 수가 DAU, 여러 날을 합치면 WAU · MAU)
 *   metrics/daily/{YYYY-MM-DD}/visits      += 1      (중복 포함 실행 수)
 * 앱은 부팅 6초 뒤마다 accountSnap 을 쓴다(firebase-init setAccountSnapshot). 그래서 앱을 고치지 않고 서버에서 센다.
 * accountSnap 은 로그인 계정에 묶인 사람만 쓸 수 있다(규칙) — 지표는 «로그인 연결된 사용자 기준» 이다.
 * 라이선스 등록 · 가입 직후에도 accountSnap 을 한 번 더 쓰므로 방문 수에 조금 더 잡힌다(부팅 쓰기에 비해 적다).
 * 날짜는 서울(UTC+9 · 서머타임 없음) 기준이다 — 광고 계약서의 «하루» 가 한국 날짜라서.
 */
'use strict';
const USER_CODE_RE = /^u[0-9a-z]{8,40}$/;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const METRICS_DAILY = 'metrics/daily';

function kstDateKey(ms){
  return new Date(Number(ms) + KST_OFFSET_MS).toISOString().slice(0, 10);
}

// increment 는 검사에서 바꿔 끼우려고 받는다. firebase-admin/database 는 무거워서 쓸 때 처음 읽는다(index.js 맨 위 ⚠️).
function dailyActiveUpdates(userCode, nowMs, increment){
  if (typeof userCode !== 'string' || !USER_CODE_RE.test(userCode)) return null;
  const inc = increment || ((n) => require('firebase-admin/database').ServerValue.increment(n));
  const base = METRICS_DAILY + '/' + kstDateKey(nowMs);
  return {
    [base + '/u/' + userCode]: true,
    [base + '/visits']: inc(1),
  };
}

// 지우기(after 없음)는 세지 않는다. 다중 경로 update 한 번이라 고유 사용자와 방문 수가 어긋나지 않는다.
async function runDailyActive(db, event, nowMs, increment){
  const after = event && event.data && event.data.after;
  if (!after || !after.exists()) return null;
  const updates = dailyActiveUpdates(event.params && event.params.userId, nowMs, increment);
  if (!updates) return null;
  await db.ref().update(updates);
  return updates;
}

module.exports = { kstDateKey, dailyActiveUpdates, runDailyActive, USER_CODE_RE, METRICS_DAILY };
