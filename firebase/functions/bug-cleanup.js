/*
 * 🐞 버그 제보 정리 — 해결(수정 완료 · 재현 안 됨)된 뒤 30일이 지난 제보를 통째로 지운다(처리방침 5항). 매일 서울 새벽 한 번.
 * 해결 시각(doneTs)은 이 함수가 «해결» 을 처음 본 날 적는다 — 상태는 웹 관리자 · 글쓴이(앱 · 옛 앱) 여러 길에서 바뀌어서,
 *   쓰는 쪽마다 시각을 넣게 하면 한 길만 빠져도 그 제보는 영영 안 지워진다. 그래서 지우는 날이 하루 늦을 수는 있다.
 * 다시 미해결로 바뀐 제보는 doneTs 를 지운다(다시 해결되면 그날부터 다시 센다). 공지는 건드리지 않는다.
 * 지우는 경로는 웹 관리자 entities/bug-board deleteWrite 와 같다 — checks/sim-bug-cleanup.js 가 두 글을 맞대 본다.
 * 회원 탈퇴의 제보 삭제(account-delete.js)도 같은 bugPaths 를 쓴다.
 */
'use strict';

const DAY_MS = 24 * 3600 * 1000;
const KEEP_MS = 30 * DAY_MS;
const ROOT = 'bugBoard';
const LIST = ROOT + '/list';
const DONE_STATUS = ['fixed', 'norepro'];   // 웹 관리자 BugStatus 중 «해결» — isOpen 의 나머지
const RUN_MAX = 200;                        // 한 번에 지우는 상한 — 넘으면 다음 날 이어서
const ADMIN_LOG = 'adminLog';
const LOG_ACTION = 'bug.autoClean';         // 웹 관리자 AUDIT_ACTIONS 와 같은 이름
const LOG_BY = 'bugCleanup';
const LOG_TARGET_MAX = 60, LOG_DETAIL_MAX = 120;

const isDone = (row) => !!row && DONE_STATUS.includes(row.status);
const isNotice = (row) => !!row && (row.notice != null || row.nts != null);

/* 제보 하나를 지우는 경로 — 목록 줄 · 내용 · 답변 · 글쓴이 답글 · 공감. 그날 번호 카운터(seq)는 두어 번호가 다시 쓰이지 않게 한다. */
function bugPaths(id, row){
  if (!id || !row) return [];
  const content = row.vis === 'pub' ? ROOT + '/pub/' + id
    : (typeof row.authUid === 'string' && row.authUid ? ROOT + '/prv/' + row.authUid + '/' + id : null);
  return [
    LIST + '/' + id,
    content,
    ROOT + '/ans/pub/' + id, ROOT + '/ans/prv/' + id,
    ROOT + '/rep/pub/' + id, ROOT + '/rep/prv/' + id,
    ROOT + '/likes/' + id,
  ].filter(Boolean);
}

/* 순수 판정 — rows: { id: 목록 줄 } → 할 일. 시각은 now 하나로만 본다. */
function planBugCleanup(rows, now){
  const stamp = [], unstamp = [], remove = [];
  for (const [id, row] of Object.entries(rows || {})){
    if (!row || typeof row !== 'object' || isNotice(row)) continue;
    const has = typeof row.doneTs === 'number';
    if (!isDone(row)){ if (row.doneTs != null) unstamp.push(id); continue; }
    if (!has){ stamp.push(id); continue; }
    if (now - row.doneTs >= KEEP_MS) remove.push(id);
  }
  remove.sort((a, b) => rows[a].doneTs - rows[b].doneTs);
  return { stamp, unstamp, remove: remove.slice(0, RUN_MAX), more: Math.max(0, remove.length - RUN_MAX) };
}

function logId(nowMs, rand){
  return 'a' + Number(nowMs).toString(36) + (rand || Math.random)().toString(36).slice(2, 8);
}

/* 한 번 돌기 — 해결 줄(openTs 없음)과 doneTs 가 있는 줄만 받는다(미해결 · 해결 표시 없는 줄은 안 받는다). */
async function runBugCleanup(db, now, rand){
  const [noOpen, stamped] = await Promise.all([
    db.ref(LIST).orderByChild('openTs').equalTo(null).get(),
    db.ref(LIST).orderByChild('doneTs').startAt(0).get(),
  ]);
  const rows = Object.assign({}, noOpen.val() || {}, stamped.val() || {});
  const plan = planBugCleanup(rows, now);
  const patch = {};
  for (const id of plan.stamp) patch[LIST + '/' + id + '/doneTs'] = now;
  for (const id of plan.unstamp) patch[LIST + '/' + id + '/doneTs'] = null;
  for (const id of plan.remove) for (const p of bugPaths(id, rows[id])) patch[p] = null;
  if (plan.remove.length){
    const nos = plan.remove.map((id) => rows[id].no || id);
    patch[ADMIN_LOG + '/' + logId(now, rand)] = {
      at: now, by: LOG_BY, action: LOG_ACTION,
      target: (nos.slice(0, 3).join(', ') + (nos.length > 3 ? ' 외 ' + (nos.length - 3) + '건' : '')).slice(0, LOG_TARGET_MAX),
      detail: ('해결 뒤 30일 지난 제보 ' + nos.length + '건 자동 삭제' + (plan.more ? ' · 남은 ' + plan.more + '건은 다음 날' : '')).slice(0, LOG_DETAIL_MAX),
    };
  }
  if (Object.keys(patch).length) await db.ref().update(patch);
  return { stamped: plan.stamp.length, unstamped: plan.unstamp.length, removed: plan.remove.length, more: plan.more };
}

module.exports = { runBugCleanup, planBugCleanup, bugPaths, KEEP_MS, DONE_STATUS, RUN_MAX, LOG_ACTION };
