/*
 * PR 머지 → 할 일 완료 — todoMergeDone(HTTPS) 의 로직. GitHub Actions(todo-merge.yml)가 main 에 머지된 PR 의
 * 본문 «할 일: <id>» 를 읽어 부른다. 진행 중으로 바꾸는 일은 하지 않는다 — 머지됐을 때 완료로만.
 *   adminTodos/{id}: status done · release(비어 있을 때만) · 메모에 «PR #N 머지» 한 줄 · rev + 1 · updatedBy = 봇
 *   adminLog/{id}:   todo.update 한 줄(웹 · 터미널과 같은 모양)
 * Admin SDK 는 규칙을 거치지 않는다 — 규칙 adminTodos/$id 가 하던 rev + 1 · 만든 사람/시각 고정은 트랜잭션 안에서 지킨다.
 * 할 일을 새로 만들지 않는다. 없는 id 는 건너뛴다. 이미 완료 + 버전이 있으면 손대지 않는다.
 */
'use strict';
const crypto = require('crypto');

const TODO_ROOT = 'adminTodos';
const LOG_ROOT = 'adminLog';
// 웹 관리자가 이 uid 를 «GitHub 머지» 로 보여 준다(web-admin entities/admin/name BOT_NAMES).
const BOT_UID = 'github-merge';
// 규칙 adminTodos/$id · adminLog 와 같다.
const ID_RE = /^[A-Za-z0-9_-]{1,32}$/;
const RELEASE_RE = /^\d+\.\d+\.\d+(-[a-z]+\.\d+)?$/;
const RELEASE_MAX = 20;
const MEMO_MAX = 2000;
const LOG_TARGET_MAX = 60;
const LOG_DETAIL_MAX = 120;
const IDS_MAX = 10;
const PR_MAX = 1e7;
const STATUS = { todo: '할 일', doing: '진행 중', done: '완료' };

/** 요청 본문 검사 — 맞으면 { ids, pr, release }, 아니면 { error }. */
function parseRequest(body){
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: '본문이 JSON 객체가 아님' };
  const { ids, pr, release } = body;
  if (!Array.isArray(ids) || !ids.length) return { error: 'ids 가 비었음' };
  if (ids.length > IDS_MAX) return { error: `ids 는 ${IDS_MAX}개까지` };
  if (ids.some((id) => typeof id !== 'string' || !ID_RE.test(id))) return { error: 'id 모양이 틀림' };
  if (!Number.isInteger(pr) || pr < 1 || pr > PR_MAX) return { error: 'pr 은 양의 정수' };
  if (typeof release !== 'string' || release.length > RELEASE_MAX || !RELEASE_RE.test(release)) return { error: 'release 모양이 틀림' };
  return { ids: [...new Set(ids)], pr, release };
}

/** 공유 비밀 비교 — 길이가 달라도 같은 시간이 걸리게 해시끼리 견준다. 비밀이 비어 있으면 늘 거절. */
function tokenOk(given, secret){
  if (typeof secret !== 'string' || !secret || typeof given !== 'string' || !given) return false;
  const h = (s) => crypto.createHash('sha256').update(s).digest();
  return crypto.timingSafeEqual(h(given), h(secret));
}

/** Authorization: Bearer <비밀> 에서 비밀만. */
function bearer(header){
  const m = /^Bearer\s+(\S+)$/.exec(typeof header === 'string' ? header.trim() : '');
  return m ? m[1] : '';
}

/**
 * 머지 완료 값 — 지금 서버 값(raw)에서 상태 · 버전 · 메모만 바꾸고 rev + 1. 바꿀 것이 없으면 null.
 * 버전은 비어 있을 때만 채운다(사람이 미리 적어 둔 버전 — 예: 다음 minor — 을 덮지 않는다).
 * 메모가 2000자를 넘게 되면 메모만 건너뛴다(완료가 더 중요하다).
 */
function mergeDoneValue(raw, o, nowMs){
  if (!raw || typeof raw !== 'object' || typeof raw.rev !== 'number' || typeof raw.title !== 'string') return null;
  const hasRelease = typeof raw.release === 'string' && raw.release !== '';
  if (raw.status === 'done' && hasRelease) return null;
  const out = { ...raw };
  const line = `PR #${o.pr} 머지`;
  const memo = typeof raw.memo === 'string' ? raw.memo : '';
  if (!memo.split('\n').includes(line)){
    const next = memo ? memo + '\n' + line : line;
    if (next.length <= MEMO_MAX) out.memo = next;
  }
  out.status = 'done';
  if (!hasRelease) out.release = o.release;
  out.updatedBy = BOT_UID;
  out.updatedAt = nowMs;
  out.rev = raw.rev + 1;
  return out;
}

/** 작업 기록 detail — 웹 todoChanges · 터미널 changeText 와 같은 말. */
function changeText(prev, v, pr){
  const out = [];
  if (prev.status !== v.status) out.push(`${STATUS[prev.status] || prev.status} → ${STATUS[v.status]}`);
  if ((prev.memo || '') !== (v.memo || '')) out.push('메모');
  if ((prev.release || '') !== (v.release || '')) out.push(`릴리스 ${prev.release || '없음'} → ${v.release || '없음'}`);
  return (out.join(' · ') || '변경 없음') + ` · PR #${pr} 머지`;
}

function logEntry(title, detail, nowMs, rnd = Math.random){
  const id = 'a' + nowMs.toString(36) + rnd().toString(36).slice(2, 8);
  return [`${LOG_ROOT}/${id}`, {
    at: nowMs, by: BOT_UID, action: 'todo.update',
    target: String(title).slice(0, LOG_TARGET_MAX),
    detail: String(detail).slice(0, LOG_DETAIL_MAX),
  }];
}

/** 한 건 — 트랜잭션으로 읽은 그대로 위에 rev + 1. 결과: done · already · missing · failed. */
async function completeOne(db, id, o, nowMs){
  const ref = db.ref(`${TODO_ROOT}/${id}`);
  const first = await ref.get();
  if (!first.exists()) return { id, result: 'missing' };
  let prev = null, next = null;
  const r = await ref.transaction((cur) => {
    // 여러 번 불릴 수 있다 — 마지막 호출의 값만 남긴다.
    prev = null; next = null;
    // 캐시가 비어 첫 호출이 null 일 수 있다 — null 을 그대로 두면 서버 값으로 다시 불린다.
    if (cur === null) return null;
    prev = cur;
    next = mergeDoneValue(cur, o, nowMs);
    return next === null ? undefined : next;   // undefined = 쓰지 않고 그만
  });
  if (!prev) return { id, result: 'missing' };
  if (!next) return { id, result: 'already' };
  if (!r || !r.committed) return { id, result: 'failed' };
  const [logPath, log] = logEntry(next.title, changeText(prev, next, o.pr), nowMs);
  try { await db.ref(logPath).set(log); }
  catch (e) { console.warn('[todoMergeDone] 작업 기록 못 남김', id, e && e.message); }
  return { id, result: 'done', release: next.release };
}

/** 요청 하나 — 상태 코드와 돌려줄 본문. db 는 검사에서 바꿔 끼운다. */
async function handleTodoMerge(db, req, secret, nowMs){
  if (req.method !== 'POST') return { status: 405, body: { error: 'POST 만' } };
  if (!tokenOk(bearer(req.headers && req.headers.authorization), secret)) return { status: 401, body: { error: '인증 실패' } };
  const p = parseRequest(req.body);
  if (p.error) return { status: 400, body: { error: p.error } };
  const results = [];
  for (const id of p.ids) results.push(await completeOne(db, id, p, nowMs));
  return { status: 200, body: { results } };
}

module.exports = {
  BOT_UID, IDS_MAX, ID_RE, RELEASE_RE,
  parseRequest, tokenOk, bearer, mergeDoneValue, changeText, logEntry, completeOne, handleTodoMerge,
};
