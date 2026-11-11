/* sim-chat-last-by-ts.js — 💬 대화 «마지막 N줄» 은 서버 시각(ts) 순으로 자른다 (B-1103-4)
   실행:  node sim-chat-last-by-ts.js   (firebase-init.js 와 같은 폴더에서)
   [왜] push key 는 보낸 PC 시계로 만들어진다. «마지막 N줄» 을 key 순으로 자르면, 시계가 늦은 사람이 방금 보낸 글은
     key 가 옛것이라 대화가 N줄을 넘는 순간부터 «마지막» 밖으로 밀려 아예 안 온다 — 공용 투게더룸에서 «내 채팅만 대화창에 안 남음».
   §1 firebase-init.js 의 subscribeChatSince(처음 받기) · subscribeChatLog(배지 · 탭 안 읽은 수)를 꺼내
      가짜 RTDB(정렬 · startAt · limitToLast 를 실제 규칙대로 계산)에 돌린다 — 시계가 늦은 사람의 새 글이 들어오는가
   §2 깨 보기 — 정렬을 빼고(key 순) 돌리면 그 글이 빠진다 */
'use strict';
const fs = require('fs');
const say = console.log;
let fail = 0;
const chk = (ok, msg) => { if (!ok) fail++; say((ok ? '  ✓ ' : '  ✗ ') + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const FI = read('firebase-init.js');
if (!FI) { say('  ? 원본 못 찾음 — firebase-init.js'); process.exit(2); }

/* firebaseAPI 객체 안의 메서드 한 벌을 글 그대로 꺼낸다(다음 «\n    }, » 까지) */
function method(src, head){
  const i = src.indexOf('    ' + head);
  if (i < 0) return null;
  const j = src.indexOf('\n    },', i);
  return j < 0 ? null : src.slice(i + 4, j + 6);
}

/* 가짜 RTDB — query 조건을 모아 두었다가 구독할 때 실제 규칙대로 고른다(orderByChild 가 없으면 key 순) */
function fakeDb(rows){
  const keyOrder = (a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0);
  const pick = (q) => {
    const by = q.orderBy;
    let l = rows.slice().sort(by ? (a, b) => (a.v[by] - b.v[by]) || keyOrder(a, b) : keyOrder);
    if (q.startAt != null) l = l.filter(r => r.v[by] >= q.startAt);
    if (q.last != null) l = l.slice(-q.last);
    return l;
  };
  const snapOf = (l) => ({ val: () => (l.length ? Object.fromEntries(l.map(r => [r.k, r.v])) : null) });
  return {
    ref: (_db, path) => ({ path }),
    query: (r, ...cs) => Object.assign({ path: r.path }, ...cs),
    orderByChild: (p) => ({ orderBy: p }),
    limitToLast: (n) => ({ last: n }),
    startAt: (v) => ({ startAt: v }),
    onChildAdded: (q, cb) => { pick(q).forEach(r => cb({ key: r.k, val: () => r.v })); return () => {}; },
    onChildChanged: () => () => {},
    onValue: (q, cb) => { cb(snapOf(pick(q))); },
    off: () => {},
  };
}
function build(src, rows){
  const D = fakeDb(rows);
  const order = (a, b) => (a.ts - b.ts) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const body = 'return {' + method(src, 'subscribeChatLog(room, onChange, limit, tabId){') + ',\n' + method(src, 'subscribeChatSince(room, tabId, since, onMsg, onReady, limit){') + '};';
  return new Function('ref', 'db', 'query', 'orderByChild', 'limitToLast', 'startAt', 'onChildAdded', 'onChildChanged', 'onValue', 'off', '_chatLogPath', '_chatOrder', body)(
    D.ref, {}, D.query, D.orderByChild, D.limitToLast, D.startAt, D.onChildAdded, D.onChildChanged, D.onValue, D.off, (room) => 'rooms/' + room + '/chatLog', order);
}

/* 대화 120줄 — 친구 글은 key · ts 가 함께 늘고, 끝에 «내» 글 하나: ts 는 가장 새것인데 key 는 시계가 10분 늦어 옛것 */
const rows = [];
for (let i = 0; i < 120; i++) rows.push({ k: 'K' + String(1000 + i), v: { name: '친구', text: 't' + i, ts: 1e6 + i * 1000 } });
const MINE = { k: 'K0500', v: { name: '나', text: '내 새 글', ts: 1e6 + 200 * 1000 } };
rows.push(MINE);

function runBoth(src){
  const api = build(src, rows);
  const since = []; api.subscribeChatSince('ROOM-AAAA', null, null, (m) => since.push(m), null, 100);
  let log = null; api.subscribeChatLog('ROOM-AAAA', (l) => { log = l; }, 20);
  return { since, log };
}

say('§1 지금 firebase-init.js');
const okSrc = method(FI, 'subscribeChatLog(room, onChange, limit, tabId){') && method(FI, 'subscribeChatSince(room, tabId, since, onMsg, onReady, limit){');
chk(!!okSrc, '두 구독 함수를 꺼냈다');
const a = runBoth(FI);
chk(a.since.length === 100 && a.since.some(m => m.id === MINE.k), '처음 받기(마지막 100줄) — 시계가 늦은 내 새 글이 들어 있다');
chk(a.since.every(m => m.ts >= 1e6 + 21 * 1000), '  ↳ 잘린 것은 가장 옛 ts 21줄(key 순이 아니라 시각 순)');
chk(Array.isArray(a.log) && a.log.length === 20 && a.log[a.log.length - 1].id === MINE.k, '배지 · 탭 안 읽은 수(마지막 20줄) — 내 새 글이 맨 끝');

say('§2 깨 보기');
const broken = FI.replace(/orderByChild\('ts'\), limitToLast\(/g, 'limitToLast(');
const b = runBoth(broken);
chk(broken !== FI && !b.since.some(m => m.id === MINE.k) && !b.log.some(m => m.id === MINE.k), 'key 순으로 자르면 내 새 글이 둘 다에서 빠진다');

say('');
say(fail ? '문제 ' + fail + '건' : '전부 통과 ✅ — 시계가 늦은 사람의 새 글도 «마지막 N줄» 안에 든다');
process.exit(fail ? 1 : 0);
