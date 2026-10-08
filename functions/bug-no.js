/*
 * 버그 제보 서버 관리 — bugBoard/list/{id} 가 새로 생기면 (1) 하루 작성 수를 세고 (2) 고정 번호를 붙인다.
 *   users/{code}/bugPostCount/{YYYY-MM-DD} = 그날(서울) 그 사람이 낸 제보 수. 함수만 쓴다(규칙상 클라이언트는 읽기만).
 *     BUG_DAILY_MAX 를 넘는 글은 목록 줄 · 내용을 한 묶음으로 지운다. 관리자 글 · 공지는 세지 않는다.
 *   bugBoard/seq/{YYYY-MM-DD} = 그날(서울) 마지막으로 준 번호 n. 트랜잭션으로 +1 만 — 글을 지워도 줄지 않아 번호가 다시 쓰이지 않는다.
 *   bugBoard/list/{id}/no    = «B-1009-3». 커밋 · PR 에서 이 번호로 제보를 가리킨다(웹 관리자 🐞 제보에 보인다).
 * 번호는 받아들인 글에만 준다 — 한도를 넘어 지운 글은 번호를 쓰지 않는다. 빈 번호는 지운 글 · 번호를 받는 사이 지워진 글뿐.
 * 날짜는 글의 ts(규칙상 서버 시각)로 정한다. ts 가 없거나 지금과 하루 넘게 어긋나면(옛 글 · 관리자 글) 함수가 돈 시각으로.
 * 이미 no 가 있으면 아무것도 안 한다. 함수는 Admin SDK 라 규칙을 거치지 않는다.
 * firebase-admin 은 무거워서 여기서 require 하지 않는다(index.js 맨 위 ⚠️) — db 를 받는다.
 */
'use strict';
const BUG_ROOT = 'bugBoard';
const BUG_LIST = BUG_ROOT + '/list';
const BUG_SEQ = BUG_ROOT + '/seq';
const BUG_DAILY_MAX = 5;   // 앱 bug-board.js BUG_DAILY_MAX 와 같게
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
// 규칙 bugBoard/list/$id/no 와 같은 모양
const BUG_NO_RE = /^B-\d{4}-\d{1,4}$/;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const CODE_RE = /^[A-Za-z0-9_-]{1,40}$/;

function kstDay(ms){
  return new Date(Number(ms) + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 번호 · 작성 수를 셀 날짜(서울) — 글의 ts 가 그럴듯하면 그 날, 아니면 지금. */
function bugNoDay(ts, nowMs){
  const ok = typeof ts === 'number' && Number.isFinite(ts) && Math.abs(ts - nowMs) <= DAY_MS;
  return kstDay(ok ? ts : nowMs);
}

/** «2026-10-09» + 3 → «B-1009-3» */
function formatBugNo(day, n){
  const [, mm, dd] = String(day).split('-');
  return `B-${mm}${dd}-${n}`;
}

/** seq 트랜잭션 — 숫자가 아니면 0 에서 시작. */
const nextSeq = (cur) => (typeof cur === 'number' && cur >= 0 ? Math.floor(cur) : 0) + 1;

/** 하루 작성 수 트랜잭션 — 이미 한도면 그만두기(undefined), 아니면 +1. */
const countUp = (cur) => {
  const n = typeof cur === 'number' && cur >= 0 ? Math.floor(cur) : 0;
  return n >= BUG_DAILY_MAX ? undefined : n + 1;
};

/**
 * list/{id} 트랜잭션 — 글이 없으면 null 그대로(지워진 글에 no 만 덩그러니 생기지 않게),
 * 이미 no 가 있으면 건드리지 않는다(undefined = 그만두기), 아니면 no 를 붙인다.
 * ⚠️ 처음 부를 때 cur 는 로컬 추측(null)일 수 있다 — null 을 돌려주면 서버 값과 다를 때 진짜 값으로 다시 불린다.
 */
function attachNo(cur, no){
  if (cur == null || typeof cur !== 'object') return null;
  if (cur.no) return undefined;
  return Object.assign({}, cur, { no });
}

/** 한도를 넘은 글 지우기 — 목록 줄과 내용(공개 · 비공개 자리)을 한 묶음으로. 답변 · 공감은 아직 있을 수 없다. */
function rejectWrite(id, post){
  const w = { [BUG_LIST + '/' + id]: null };
  if (post && post.vis === 'prv'){
    if (typeof post.authUid === 'string' && ID_RE.test(post.authUid)) w[BUG_ROOT + '/prv/' + post.authUid + '/' + id] = null;
  } else {
    w[BUG_ROOT + '/pub/' + id] = null;
  }
  return w;
}

async function isAdmin(db, uid){
  if (typeof uid !== 'string' || !ID_RE.test(uid)) return false;
  const snap = await db.ref('admins/' + uid).get();
  return !!snap && snap.val() === true;
}

/**
 * 결과: { no } 번호를 붙임 · { rejected: true } 한도를 넘어 지움 · null 할 일 없음(이미 번호 · 지워진 글 · 이상한 값).
 */
async function runBugNo(db, event, nowMs){
  const id = event && event.params && event.params.id;
  if (typeof id !== 'string' || !ID_RE.test(id)) return null;
  const snap = event.data;
  const val = snap && typeof snap.val === 'function' ? snap.val() : null;
  if (!val || typeof val !== 'object' || val.no) return null;
  const day = bugNoDay(val.ts, nowMs);

  if (!val.notice && !(await isAdmin(db, val.authUid))){
    const code = val.code;
    const cnt = CODE_RE.test(String(code || ''))
      ? await db.ref('users/' + code + '/bugPostCount/' + day).transaction(countUp)
      : null;
    if (!cnt || !cnt.committed){
      await db.ref().update(rejectWrite(id, val));
      return { rejected: true };
    }
  }

  const seq = await db.ref(BUG_SEQ + '/' + day).transaction(nextSeq);
  if (!seq || !seq.committed) return null;
  const no = formatBugNo(day, seq.snapshot.val());
  const r = await db.ref(BUG_LIST + '/' + id).transaction((cur) => attachNo(cur, no));
  if (!r || !r.committed) return null;
  const after = r.snapshot && r.snapshot.val();
  return after && after.no === no ? { no } : null;
}

/**
 * 백필 계획 — no 가 없는 글을 날짜(서울)별로 ts 순(같으면 키 순)으로 줄 세워, 그날 seq 다음부터 번호를 준다.
 * list: { id: 글 } · seq: { 'YYYY-MM-DD': n }. 돌려주는 updates 는 루트 update 한 번으로 쓴다.
 * ts 가 숫자가 아닌 글은 날짜를 모르니 건너뛴다(skipped). 하루 작성 수는 건드리지 않는다(지난 글이라).
 */
function planBackfill(list, seq){
  const byDay = new Map();
  const skipped = [];
  for (const [id, v] of Object.entries(list || {})){
    if (!v || typeof v !== 'object' || v.no) continue;
    if (!ID_RE.test(id) || typeof v.ts !== 'number' || !Number.isFinite(v.ts)){ skipped.push(id); continue; }
    const day = kstDay(v.ts);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push({ id, ts: v.ts });
  }
  const updates = {};
  const assigned = [];
  for (const day of [...byDay.keys()].sort()){
    const posts = byDay.get(day).sort((a, b) => a.ts - b.ts || (a.id < b.id ? -1 : 1));
    let n = nextSeq((seq || {})[day]) - 1;
    for (const p of posts){
      n++;
      const no = formatBugNo(day, n);
      updates[BUG_LIST + '/' + p.id + '/no'] = no;
      assigned.push({ id: p.id, day, no });
    }
    updates[BUG_SEQ + '/' + day] = n;
  }
  return { updates, assigned, skipped };
}

module.exports = {
  BUG_LIST, BUG_SEQ, BUG_NO_RE, BUG_DAILY_MAX,
  kstDay, bugNoDay, formatBugNo, nextSeq, countUp, attachNo, rejectWrite, runBugNo, planBackfill,
};
