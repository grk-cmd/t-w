/* sim-xmas-server.js — 🎄 크리스마스 이벤트 서버(functions/xmas.js · 규칙 xmas*) 를 실제로 돌려 본다(일회성 · 이슈 #963)
   실행: node checks/run.js sim-xmas-server
   ・1절 장식 걸기 검사 — 종류 · 64px PNG 만 · 한마디 30자 · 금칙어 · 제어 문자
   ・2절 자리 잡기 — 트리당 300 · 다 차면 다음 트리 · 여럿이 동시에 걸어도 넘지 않음 · 바꾸기는 같은 자리 · 판 +1 · 끝난 뒤 거절 · 익명 거절
   ・3절 편지 짝 짓기 — 쓴 만큼 받음 · 자기 편지 안 받음 · 한 사람뿐이면 못 보냄 · 무작위 · 한 번만 · 알림함
   ・4절 관리자 지우기 — 관리자만 · 장식(주인 · 내 자리까지) · 받은 편지
   ・4-2절 관리자 편지 반송 — 관리자만 · 마감 1분 전까지 · 짝 짓기 전 · 사유 넷 · 관리자가 본 편지만(ts) · 동시에 한 번 · 원래 글 남김 · 알림함 · 짝 짓기 제외
   ・5절 규칙식 — 편지 본인 · 마감 · 5칸 · 모양 / 신고 본인 · 한 번 · 받은 사람만 / 트리 읽기 내 트리 · 지금 트리만 / 함수만 쓰는 칸
   ・6절 index.js 연결 · 일부러 깨 보기
   실제 서버 판정은 에뮬레이터(firebase/scripts/rules-emu-check.js)에서 본다. */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const find = (cands) => cands.find(p => fs.existsSync(p));
const XP = find(['functions/xmas.js', 'firebase/functions/xmas.js']);
const FXP = find(['functions/index.js', 'firebase/functions/index.js']);
const RP = find(['firebase-database-rules.json', 'firebase/firebase-database-rules.json']);
if (!XP || !FXP || !RP) { say('  ? 원본 못 찾음 — functions/xmas.js · functions/index.js · firebase-database-rules.json'); process.exit(2); }
const X = require(path.resolve(XP));
const FX = fs.readFileSync(FXP, 'utf8');
const RULES = JSON.parse(fs.readFileSync(RP, 'utf8')).rules;

/* ── 가짜 DB — 경로 → 값. transaction 은 RTDB 처럼 «지금 값» 으로 부르고 undefined 면 안 씀. 다중 경로 update · null 지우기 */
function fakeDb(init){
  const data = JSON.parse(JSON.stringify(init || {}));
  const get = (p) => { let v = data; for (const k of p.split('/').filter(Boolean)) { if (v == null || typeof v !== 'object') return null; v = v[k]; } return v === undefined ? null : v; };
  const set = (p, val) => {
    const ks = p.split('/').filter(Boolean); let v = data;
    for (let i = 0; i < ks.length - 1; i++) { if (v[ks[i]] == null || typeof v[ks[i]] !== 'object') v[ks[i]] = {}; v = v[ks[i]]; }
    if (val === null || val === undefined) delete v[ks[ks.length - 1]]; else v[ks[ks.length - 1]] = JSON.parse(JSON.stringify(val));
  };
  const db = {
    data, get, writes: 0,
    ref: (p = '') => ({
      get: async () => { const at = JSON.parse(JSON.stringify(p ? get(p) : data)); return { val: () => at }; },   // 읽은 그 순간 값(진짜 RTDB 처럼 — 늦게 읽으면 동시 요청의 경쟁이 가려진다)
      update: async (w) => { db.writes++; for (const [k, v] of Object.entries(w)) set((p ? p + '/' : '') + k, v); },
      remove: async () => set(p, null),
      transaction: async (fn) => {
        const nv = fn(get(p) == null ? null : JSON.parse(JSON.stringify(get(p))));
        if (nv === undefined) return { committed: false, snapshot: { val: () => get(p) } };
        set(p, nv); const at = JSON.parse(JSON.stringify(get(p))); return { committed: true, snapshot: { val: () => at } };   // 커밋한 그 값(진짜 RTDB 처럼)
      },
    }),
  };
  return db;
}
const req = (uid, data, prov) => ({ auth: uid ? { uid, token: { firebase: { sign_in_provider: prov || 'google.com' } } } : null, data });
const NOW = X.LETTER_DEADLINE_MS - 86400000 * 10;   // 12/15 쯤
async function rejects(p, code){ try { await p; return false; } catch (e) { return !code || e.httpsCode === code; } }

/* 64px PNG data URL 만들기(IHDR 만 맞으면 된다) */
function png(w, h){
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8); b.write('IHDR', 12, 'ascii'); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20);
  return 'data:image/png;base64,' + b.toString('base64');
}

(async () => {
say('── 1절 장식 걸기 검사');
chk(X.parseHang({ kind: 'star', word: '  메리\n크리스마스  ' }).w === '메리 크리스마스', '한마디 — 줄바꿈 · 앞뒤 공백 정리');
chk(X.parseHang({ kind: 'img', img: png(64, 64) }).d === png(64, 64), '64px PNG 는 받는다');
for (const [d, why] of [[{ kind: 'tree' }, '모르는 종류'], [{ kind: 'img', img: png(65, 64) }, '65px'], [{ kind: 'img', img: 'data:image/jpeg;base64,AAAA' }, 'PNG 아님'],
  [{ kind: 'img' }, '그림 없음'], [{ kind: 'img', img: png(64, 64) + 'A'.repeat(20000) }, '너무 큼'], [{ kind: 'star', word: 'ㅋ'.repeat(31) }, '한마디 31자']]) {
  let threw = false; try { X.parseHang(d); } catch (e) { threw = e.httpsCode === 'invalid-argument'; }
  chk(threw, '거절 — ' + why);
}
{ let threw = false; try { X.parseHang({ kind: 'star', word: '나쁜말' }, (w) => w.includes('나쁜')); } catch (e) { threw = true; }
  chk(threw, '금칙어가 든 한마디는 거절'); }
chk(X.parseHang({ kind: 'star', word: 'ㅋ'.repeat(30) }).w.length === 30, '30자까지는 받는다');

say('── 2절 자리 잡기');
{
  const db = fakeDb();
  const r1 = await X.handleHang(db, req('authAAAA0001', { kind: 'star', word: '안녕', preview: 1 }), NOW);
  chk(r1.tree === 1 && r1.slot === 0 && !r1.moved, '처음 건 사람 — 트리 1 · 자리 0');
  chk(db.get('xmasOwners/1/0') === 'authAAAA0001' && db.get('xmasMine/authAAAA0001').t === 1 && db.get('xmasTrees/1/o/0').w === '안녕', '주인 · 내 자리 · 한마디 기록');
  const r2 = await X.handleHang(db, req('authAAAA0001', { kind: 'img', img: png(32, 32) }), NOW);
  chk(r2.slot === 0 && r2.changed && db.get('xmasTrees/1/o/0').v === 2 && db.get('xmasTrees/1/o/0').k === 'img' && !db.get('xmasTrees/1/o/0').w, '바꾸기 — 같은 자리 · 판 +1 · 한마디 지움');
  chk(db.get('xmasImg/1/0').v === 2, '  ↳ 그림 칸에도 같은 판');
  await X.handleHang(db, req('authAAAA0001', { kind: 'bulb' }), NOW);
  chk(db.get('xmasImg/1/0') === null, '  ↳ 기본 장식으로 바꾸면 그림 칸은 지운다');
  chk(db.get('xmasMeta').cnt === 1, '바꾸기는 자리를 새로 잡지 않는다');
  // 트리 채우기 — 동시에(Promise.all) 300명
  const many = []; for (let i = 1; i < X.TREE_MAX + 4; i++) many.push(X.handleHang(db, req('authBBBB' + String(i).padStart(4, '0'), { kind: 'gift', preview: 1 }), NOW));
  const rs = await Promise.all(many);
  const t1 = Object.keys(db.get('xmasTrees/1/o')).length, t2 = Object.keys(db.get('xmasTrees/2/o') || {}).length;
  chk(t1 === X.TREE_MAX && t2 === 4, `트리 1 은 ${X.TREE_MAX}개에서 멈추고 나머지는 트리 2 (${t1} · ${t2})`);
  chk(rs.filter(r => r.moved).length === 4 && rs.filter(r => r.moved).every(r => r.tree === 2), '보던 트리(1)가 찼으면 moved — 앱이 «다른 트리로 이동할게요»');
  chk(new Set(rs.map(r => r.tree + '/' + r.slot)).size === rs.length, '같은 자리를 두 사람이 받지 않는다');
  chk(await rejects(X.handleHang(db, req(null, { kind: 'star' }), NOW), 'unauthenticated'), '로그인 없음 거절');
  chk(await rejects(X.handleHang(db, req('authCCCC0001', { kind: 'star' }, 'anonymous'), NOW), 'permission-denied'), '익명 로그인 거절');
  chk(await rejects(X.handleHang(db, req('authCCCC0001', { kind: 'star' }), X.EVENT_END_MS), 'failed-precondition'), '1월 1일 0시부터 거절');
  // 같은 사람이 처음 걸기를 동시에 두 번
  const dbTwice = fakeDb();
  const two = await Promise.allSettled([X.handleHang(dbTwice, req('authDDDD0002', { kind: 'star' }), NOW), X.handleHang(dbTwice, req('authDDDD0002', { kind: 'bulb' }), NOW)]);
  chk(two.filter(r => r.status === 'fulfilled').length === 1 && two.some(r => r.status === 'rejected' && r.reason.httpsCode === 'aborted') && dbTwice.get('xmasMeta').cnt === 1,
    '같은 사람이 처음 걸기를 동시에 두 번 — 하나만 통과 · 자리 1개');
  const db2 = fakeDb({ xmasMine: { authDDDD0001: { busy: NOW - 1000 } } });
  chk(await rejects(X.handleHang(db2, req('authDDDD0001', { kind: 'star' }), NOW), 'aborted'), '거는 중(1초 전)에 또 보내면 다시 눌러 달라고(자리 두 개 안 잡음)');
  const db4 = fakeDb({ xmasMine: { authDDDD0003: { busy: NOW - X.BUSY_STALE_MS } }, xmasMeta: { cur: 1, cnt: 7 } });
  const r4 = await X.handleHang(db4, req('authDDDD0003', { kind: 'star' }), NOW);
  chk(r4.tree === 1 && r4.slot === 7 && db4.get('xmasMine/authDDDD0003').s === 7, '«거는 중» 이 60초 넘게 남았으면(함수가 시간 초과로 끝남) 다시 걸 수 있다');
  const db5 = fakeDb({ xmasMine: { authDDDD0004: { busy: true } } });
  chk((await X.handleHang(db5, req('authDDDD0004', { kind: 'star' }), NOW)).slot === 0, '  ↳ 시각이 없는 옛 표시도 오래된 것으로');
  chk(X.liveBusy({ busy: NOW - X.BUSY_STALE_MS + 1 }, NOW) && !X.liveBusy({ busy: NOW - X.BUSY_STALE_MS }, NOW), '  ↳ 경계 — 60초 직전은 거는 중 · 60초부터 오래됨');
  // 바꾸기를 동시에 두 번 — 판이 겹치지 않는다
  const db6 = fakeDb({ xmasMine: { authDDDD0005: { t: 1, s: 2 } }, xmasTrees: { 1: { o: { 2: { k: 'star', v: 4 } } } } });
  await Promise.all([X.handleHang(db6, req('authDDDD0005', { kind: 'img', img: png(8, 8) }), NOW), X.handleHang(db6, req('authDDDD0005', { kind: 'img', img: png(9, 9) }), NOW)]);
  chk(db6.get('xmasTrees/1/o/2').v === 6 && db6.get('xmasImg/1/2').v === 6, '바꾸기를 동시에 두 번 — 판이 4 → 5 → 6 (겹치지 않음 · 그림 칸도 같은 판)');
  // 자리 잡기 실패 → 거는 중 표시 걷기
  const db3 = fakeDb();
  const orig = db3.ref; db3.ref = (p) => { const r = orig(p); if (p === 'xmasMeta') r.transaction = async () => ({ committed: false }); return r; };
  await rejects(X.handleHang(db3, req('authEEEE0001', { kind: 'star' }), NOW));
  chk(db3.get('xmasMine/authEEEE0001') === null, '자리를 못 잡으면 «거는 중» 표시를 걷는다(영영 막히지 않게)');
  chk(X.nextSeat({ cur: 3, cnt: X.TREE_MAX }).seat.t === 4 && X.nextSeat(null).seat.t === 1, 'nextSeat — 다 찼으면 다음 트리 · 처음은 1');
}

say('── 3절 편지 짝 짓기');
{
  let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const count = (arr) => arr.reduce((m, a) => (m.set(a, (m.get(a) || 0) + 1), m), new Map());
  let ok = true, selfOk = true;
  for (let trial = 0; trial < 300; trial++) {
    const people = 2 + Math.floor(rnd() * 30);
    const authors = []; for (let i = 0; i < people; i++) { const k = 1 + Math.floor(rnd() * 5); for (let j = 0; j < k; j++) authors.push('p' + i); }
    const m = Math.max(...count(authors).values());
    const recv = X.matchLetters(authors, rnd);
    if (2 * m <= authors.length) {
      const cw = count(authors), cr = count(recv);
      for (const [a, n] of cw) if (cr.get(a) !== n) ok = false;
      if (recv.some(r => r == null)) ok = false;
    }
    recv.forEach((r, i) => { if (r === authors[i]) selfOk = false; });
  }
  chk(ok, '쓴 만큼 받는다(무작위 300번 · 2~31명 · 1~5통)');
  chk(selfOk, '자기 편지는 절대 안 받는다');
  chk(X.matchLetters(['a', 'a', 'a'], rnd).every(r => r === null), '쓴 사람이 한 명뿐이면 못 보낸다');
  const big = X.matchLetters(['a', 'a', 'a', 'a', 'a', 'b'], rnd);
  chk(big.filter(r => r === 'b').length === 1 && big[5] === 'a', '한 사람이 너무 많이 썼으면(사람이 아주 적을 때) 자기 몫만 못 보낸다');
  const seeded = (k) => () => ((k = (k * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const outs = new Set(); for (let k = 1; k <= 20; k++) outs.add(X.matchLetters(['a', 'b', 'c', 'd', 'e', 'f'], seeded(k)).join());
  chk(outs.size > 5, `무작위 — 섞는 값이 다르면 짝도 다르다(20번에 ${outs.size}가지)`);
  chk(X.lettersOf({ u1: { l1: { text: ' 안녕 ', song: { id: 'abcdefghijk', title: 't' } }, l9: { text: 'x' }, l2: { text: '  ' } } }).length === 1, 'lettersOf — 모양 틀린 칸 · 빈 글은 버린다');

  const db = fakeDb({
    xmasLetters: { uA: { l1: { text: 'A1', ts: 1 }, l2: { text: 'A2', ts: 1, song: { id: 'abcdefghijk', title: '캐롤' } } }, uB: { l1: { text: 'B1', ts: 1 } }, uC: { l1: { text: 'C1', ts: 1 } } },
    authUsers: { uA: { userCode: 'ucodeaaaa01' }, uB: { userCode: 'ucodebbbb01' } },
  });
  const res = await X.runMatch(db, X.LETTER_DEADLINE_MS, rnd);
  const got = (u) => Object.keys(db.get('xmasGot/' + u) || {}).length;
  chk(res.sent === 4 && got('uA') === 2 && got('uB') === 1 && got('uC') === 1, `4통 → A 2통 · B · C 1통씩 (A ${got('uA')} · B ${got('uB')} · C ${got('uC')})`);
  const fromOf = (u, n) => String(db.get('xmasGotFrom/' + u + '/' + n)).split('/')[0];
  chk(['uA', 'uB', 'uC'].every(u => Object.keys(db.get('xmasGot/' + u) || {}).every(n => fromOf(u, n) !== u)), '받은 편지 보낸 사람 기록(관리자용) — 자기 것 없음');
  const all = ['uA', 'uB', 'uC'].flatMap(u => Object.values(db.get('xmasGot/' + u) || {}));
  chk(all.some(g => g.song && g.song.id === 'abcdefghijk') && all.every(g => !g.from), '추천곡은 같이 · 받은 편지에 보낸 사람 칸은 없다');
  chk(db.get('inbox/ucodeaaaa01/xmas2026').tag === 'xmas' && db.get('inbox/ucodeaaaa01/xmas2026').title === X.INBOX_TITLE, '알림함 «익명의 편지가 왔어요»');
  chk(db.get('inbox/ucodebbbb01/xmas2026') && !Object.keys(db.data.inbox).some(k => !/^ucode/.test(k)), '  ↳ 친구코드가 없는 사람은 알림만 건너뛴다(편지는 받음)');
  const again = await X.runMatch(db, X.LETTER_DEADLINE_MS + 1000, rnd);
  chk(again.skipped === 'already' && got('uA') === 2, '두 번 돌아도 한 번만(matchedAt)');
}

say('── 4절 관리자 지우기');
{
  const db = fakeDb({ admins: { adm1: true }, xmasTrees: { 1: { o: { 5: { k: 'img', v: 3 } } } }, xmasImg: { 1: { 5: { v: 3, d: 'x' } } },
    xmasOwners: { 1: { 5: 'uOwn000001' } }, xmasMine: { uOwn000001: { t: 1, s: 5 } }, xmasReports: { 'o-1-5': { uRep000001: { ts: 1 } } },
    xmasGot: { uGot000001: { 1: { text: 'x' } } }, xmasGotFrom: { uGot000001: { 1: 'uA/l1' } } });
  chk(await rejects(X.handleAdminRemove(db, req('notadmin01', { tree: 1, slot: 5 })), 'permission-denied'), '관리자가 아니면 거절');
  await X.handleAdminRemove(db, req('adm1', { tree: 1, slot: 5 }));
  chk(!db.get('xmasTrees/1/o/5') && !db.get('xmasImg/1/5') && !db.get('xmasOwners/1/5') && !db.get('xmasMine/uOwn000001') && !db.get('xmasReports/o-1-5'),
    '장식 지우기 — 장식 · 그림 · 주인 · 그 사람 내 자리 · 신고 묶음');
  await X.handleAdminRemove(db, req('adm1', { got: 'uGot000001', n: 1 }));
  chk(!db.get('xmasGot/uGot000001/1') && db.get('xmasGotFrom/uGot000001/1') === 'uA/l1', '받은 편지 지우기 — 보낸 사람 기록은 남긴다');
  chk(await rejects(X.handleAdminRemove(db, req('adm1', { tree: 'x' })), 'invalid-argument'), '대상이 틀리면 거절');
}

say('── 4-2절 관리자 편지 반송');
{
  const T0 = X.LETTER_DEADLINE_MS - 3600000;
  const mk = () => fakeDb({ admins: { adm1: true }, authUsers: { uWri000001: { userCode: 'ucodewri001' } },
    xmasLetters: { uWri000001: { l2: { text: '나쁜 말', ts: 1, song: { id: 'abcdefghijk', title: '곡' } }, l3: { text: '괜찮은 글', ts: 1 } } } });
  let db = mk();
  chk(await rejects(X.handleAdminReturn(db, req('notadmin01', { uid: 'uWri000001', lid: 'l2', reason: 'abuse', ts: 1 }), T0), 'permission-denied'), '관리자가 아니면 거절');
  chk(await rejects(X.handleAdminReturn(db, req('adm1', { uid: 'uWri000001', lid: 'l2', reason: 'abuse', ts: 1 }), X.LETTER_DEADLINE_MS), 'failed-precondition'), '마감(12/25 0시)부터는 반송 못 함');
  chk(await rejects(X.handleAdminReturn(db, req('adm1', { uid: 'uWri000001', lid: 'l2', reason: 'abuse', ts: 1 }), X.LETTER_DEADLINE_MS - X.RETURN_CUTOFF_MS), 'failed-precondition')
    && !!db.get('xmasLetters/uWri000001/l2'), '  ↳ 마감 1분 전부터 막는다(짝 짓기 뒤에 반송이 끝나지 않게)');
  chk(await rejects(X.handleAdminReturn(db, req('adm1', { uid: 'uWri000001', lid: 'l2', reason: ['abuse'], ts: 1 }), T0), 'invalid-argument'), '사유가 글자가 아니면 거절');
  chk(await rejects(X.handleAdminReturn(db, req('adm1', { uid: 'uWri000001', lid: 'l2', reason: 'abuse' }), T0), 'invalid-argument'), '관리자가 본 편지 시각(ts)이 없으면 거절');
  chk(await rejects(X.handleAdminReturn(db, req('adm1', { uid: 'uWri000001', lid: 'l2', reason: 'bad', ts: 1 }), T0), 'invalid-argument'), '모르는 사유 거절');
  chk(await rejects(X.handleAdminReturn(db, req('adm1', { uid: 'uWri000001', lid: 'l2', reason: 'etc', note: '  ', ts: 1 }), T0), 'invalid-argument'), '기타는 사유를 적어야');
  chk(await rejects(X.handleAdminReturn(db, req('adm1', { uid: 'uWri000001', lid: 'l9', reason: 'abuse', ts: 1 }), T0), 'invalid-argument'), '편지 칸 모양이 틀리면 거절');
  chk(await rejects(X.handleAdminReturn(db, req('adm1', { uid: 'uWri000001', lid: 'l1', reason: 'abuse', ts: 1 }), T0), 'not-found'), '없는 편지는 not-found');
  const r = await X.handleAdminReturn(db, req('adm1', { uid: 'uWri000001', lid: 'l2', reason: 'abuse', ts: 1 }), T0);
  const ret = db.get('xmasReturned/uWri000001/l2');
  chk(r.ok && !db.get('xmasLetters/uWri000001/l2') && db.get('xmasLetters/uWri000001/l3'), '반송 — 그 편지만 맡긴 목록에서 빠진다(칸이 비어 다시 쓸 수 있음)');
  chk(ret && ret.reason === 'abuse' && ret.text === '나쁜 말' && ret.song.id === 'abcdefghijk' && ret.ts === T0 && !ret.note, '  ↳ 사유 · 원래 글 · 추천곡을 남긴다(고쳐 다시 쓰게)');
  const ib = db.get('inbox/ucodewri001/xmasretl2' + T0);
  chk(ib && ib.tag === 'xmas' && ib.title === '편지가 반송됐어요' && /욕설 · 비방/.test(ib.body) && /12월 24일 23:59/.test(ib.body), '  ↳ 알림함 «편지가 반송됐어요» · 사유 · 다시 쓰기 안내');
  db = mk();
  await X.handleAdminReturn(db, req('adm1', { uid: 'uWri000001', lid: 'l3', reason: 'etc', note: '  전화번호가 들어 있어요 '.repeat(3), ts: 1 }), T0);
  const r3 = db.get('xmasReturned/uWri000001/l3');
  chk(r3.note && r3.note.length <= 40 && r3.note.startsWith('전화번호') && /기타 — 전화번호/.test(db.get('inbox/ucodewri001/xmasretl3' + T0).body), '기타 — 관리자가 적은 말(40자까지)이 알림에 같이');
  const db7 = fakeDb({ admins: { adm1: true }, xmasLetters: { uNoCode001: { l1: { text: 'x', ts: 1 } } } });
  const r7 = await X.handleAdminReturn(db7, req('adm1', { uid: 'uNoCode001', lid: 'l1', reason: 'spam', ts: 1 }), T0);
  chk(r7.notified === false && db7.get('xmasReturned/uNoCode001/l1') && !db7.data.inbox, '친구코드가 없으면 알림만 건너뛴다(반송 표시는 남음)');
  // 관리자가 본 뒤 쓴 사람이 같은 칸을 고쳐 다시 맡김 → 보지 않은 새 글은 반송하지 않는다
  const dbC = mk(); dbC.data.xmasLetters.uWri000001.l2 = { text: '고친 글', ts: 5 };
  chk(await rejects(X.handleAdminReturn(dbC, req('adm1', { uid: 'uWri000001', lid: 'l2', reason: 'abuse', ts: 1 }), T0), 'failed-precondition')
    && dbC.get('xmasLetters/uWri000001/l2').text === '고친 글' && !dbC.get('xmasReturned/uWri000001/l2') && !dbC.data.inbox, '그새 고쳐 다시 맡긴 편지는 반송하지 않는다(새 글 · 알림 그대로)');
  const dbM = mk(); dbM.data.xmasMeta = { matchedAt: 1 };
  chk(await rejects(X.handleAdminReturn(dbM, req('adm1', { uid: 'uWri000001', lid: 'l2', reason: 'abuse', ts: 1 }), T0), 'failed-precondition'), '짝 짓기가 끝났으면 반송 못 함');
  const dbD = mk();
  const both = await Promise.allSettled([X.handleAdminReturn(dbD, req('adm1', { uid: 'uWri000001', lid: 'l2', reason: 'abuse', ts: 1 }), T0), X.handleAdminReturn(dbD, req('adm1', { uid: 'uWri000001', lid: 'l2', reason: 'spam', ts: 1 }), T0 + 1)]);
  chk(both.filter(r => r.status === 'fulfilled').length === 1 && Object.keys(dbD.data.inbox.ucodewri001).length === 1, '두 관리자가 동시에 반송해도 한 번만 · 알림 한 통');
  // 반송된 편지는 짝 짓기에 안 들어간다
  const db8 = mk(); await X.handleAdminReturn(db8, req('adm1', { uid: 'uWri000001', lid: 'l2', reason: 'abuse', ts: 1 }), T0);
  chk(X.lettersOf(db8.get('xmasLetters')).every(l => l.text !== '나쁜 말'), '반송된 편지는 짝 짓기 대상에서 빠진다');
}

say('── 5절 규칙식');
{
  function snap(tree, p){
    const v = p.split('/').filter(Boolean).reduce((o, k) => (o && typeof o === 'object') ? o[k] : undefined, tree);
    const s = {
      exists: () => v !== undefined && v !== null, val: () => (v === undefined ? null : v),
      isString: () => typeof v === 'string', isNumber: () => typeof v === 'number', isBoolean: () => typeof v === 'boolean',
      hasChildren: (ks) => !!v && typeof v === 'object' && (!ks || ks.every(k => v[k] !== undefined && v[k] !== null)),
      child: (c) => snap(tree, p + '/' + c), parent: () => snap(tree, p.split('/').filter(Boolean).slice(0, -1).join('/')),
    };
    return s;
  }
  function run(expr, env){
    if (expr === true || expr === false) return expr;
    const P = String.prototype; P.matches = function (re) { return re.test(String(this)); }; P.beginsWith = P.startsWith;
    const names = Object.keys(env.vars);
    try {
      const f = new Function('root', 'data', 'newData', 'auth', 'now', ...names, '"use strict"; return (' + expr + ');');
      const auth = env.auth || { get uid(){ throw new Error('no auth'); }, get token(){ throw new Error('no auth'); } };
      return !!f(snap(env.root, ''), snap(env.root, env.path), snap(env.after, env.path), auth, env.now, ...names.map(n => env.vars[n]));
    } catch (_) { return false; } finally { delete P.matches; delete P.beginsWith; }
  }
  const au = (uid, prov) => ({ uid, token: { firebase: { sign_in_provider: prov || 'google.com' } } });
  const L = RULES.xmasLetters.$authUid.$lid;
  const letterOk = (uid, owner, lid, val, now, existing) => {
    const p = 'xmasLetters/' + owner + '/' + lid;
    const root = existing ? { xmasLetters: { [owner]: { [lid]: existing } } } : {};
    const after = { xmasLetters: { [owner]: { [lid]: val } } };
    const env = { root, after, path: p, auth: uid ? au(uid) : null, now, vars: { $authUid: owner, $lid: lid } };
    return run(L['.write'], env) && (val == null || (run(L['.validate'], env) && (!val.song || run(L.song['.validate'], Object.assign({}, env, { path: p + '/song' })))));
  };
  const T = X.LETTER_DEADLINE_MS - 1000;
  const good = { text: '안녕', ts: T };
  chk(letterOk('uMe0000001', 'uMe0000001', 'l1', good, T), '편지 — 본인 · 마감 전 · 모양 맞음 → 쓴다');
  chk(letterOk('uMe0000001', 'uMe0000001', 'l5', Object.assign({ song: { id: 'abcdefghijk', title: '곡' } }, good), T), '  ↳ 5번째 칸 · 추천곡 같이');
  chk(!letterOk('uMe0000001', 'uMe0000001', 'l6', good, T), '6번째 칸은 거절(5통까지)');
  chk(!letterOk('uOther0001', 'uMe0000001', 'l1', good, T), '남의 칸은 거절');
  chk(!letterOk(null, 'uMe0000001', 'l1', good, T), '로그인 없음 거절');
  chk(!letterOk('uMe0000001', 'uMe0000001', 'l1', good, X.LETTER_DEADLINE_MS), '마감(12/25 0시)부터 거절');
  chk(!letterOk('uMe0000001', 'uMe0000001', 'l1', null, X.LETTER_DEADLINE_MS, good), '  ↳ 마감 뒤엔 거두기(지우기)도 못 한다');
  chk(letterOk('uMe0000001', 'uMe0000001', 'l1', null, T, good), '마감 전 거두기는 된다');
  chk(!letterOk('uMe0000001', 'uMe0000001', 'l1', { text: 'x'.repeat(501), ts: T }, T), '501자 거절');
  chk(!letterOk('uMe0000001', 'uMe0000001', 'l1', Object.assign({ song: { id: 'bad', title: 'x' } }, good), T), '추천곡 id 모양이 틀리면 거절');
  chk(!letterOk('uMe0000001', 'uMe0000001', 'l1', Object.assign({ from: 'x' }, good), T) || L.$other['.validate'] === false, '모르는 칸 거절');
  { const env = { root: {}, after: { xmasLetters: { uMe0000001: { l1: good } } }, path: 'xmasLetters/uMe0000001/l1', auth: au('uMe0000001', 'anonymous'), now: T, vars: { $authUid: 'uMe0000001', $lid: 'l1' } };
    chk(!run(L['.write'], env), '익명 로그인 거절'); }

  const R = RULES.xmasReports.$key.$authUid;
  const repOk = (uid, key, existing, now) => {
    const p = 'xmasReports/' + key + '/' + uid;
    const env = { root: existing ? { xmasReports: { [key]: { [uid]: { ts: 1 } } } } : {}, after: { xmasReports: { [key]: { [uid]: { ts: now } } } }, path: p,
      auth: au(uid), now, vars: { $key: key, $authUid: uid } };
    return run(R['.write'], env) && run(R['.validate'], env) && run(RULES.xmasReports.$key['.validate'], env);
  };
  chk(repOk('uRep000001', 'o-3-12', false, T), '장식 신고 — 본인 이름 칸에 한 번');
  chk(!repOk('uRep000001', 'o-3-12', true, T), '  ↳ 두 번은 안 된다');
  chk(repOk('uRep000001', 'g-uRep000001-2', false, T), '받은 편지 신고 — 받은 사람 본인만');
  chk(!repOk('uRep000001', 'g-uOther0001-2', false, T), '  ↳ 남이 받은 편지는 신고 못 함');
  chk(!repOk('uRep000001', 'o-0-1', false, T) && !repOk('uRep000001', 'x-1-1', false, T), '모양이 틀린 대상 거절');

  const TR = RULES.xmasTrees.$t['.read'];
  const readTree = (uid, t, root) => run(TR, { root, after: root, path: 'xmasTrees/' + t, auth: au(uid), now: T, vars: { $t: String(t) } });
  const rootA = { xmasMeta: { cur: 3 }, xmasMine: { uMe0000001: { t: 1, s: 4 } } };
  chk(readTree('uMe0000001', 1, rootA), '트리 읽기 — 내가 장식을 단 트리');
  chk(readTree('uNew000001', 3, rootA), '  ↳ 지금 채우는 트리(걸기 전 미리 보기)');
  chk(!readTree('uMe0000001', 2, rootA), '  ↳ 다른 트리는 못 본다');
  chk(readTree('uNew000001', 1, {}), '  ↳ 아직 아무도 안 걸었으면 트리 1');
  chk(RULES.xmasImg.$t['.read'] === TR, '그림 칸 읽기도 같은 규칙');
  chk(RULES.xmasMeta['.write'] === false && RULES.xmasTrees.$t['.write'] === false && RULES.xmasImg.$t['.write'] === false && RULES.xmasMine.$authUid['.write'] === false
    && RULES.xmasGot.$authUid['.write'] === false && RULES.xmasGotFrom['.write'] === false && RULES.xmasOwners['.write'] === false, '함수만 쓰는 칸은 앱이 못 쓴다');
  chk(/admins/.test(RULES.xmasOwners['.read']) && /admins/.test(RULES.xmasGotFrom['.read']) && !RULES.xmasOwners.$t['.read'], '건 사람 · 보낸 사람은 관리자만 읽는다');
  chk(/auth\.uid === \$authUid/.test(RULES.xmasGot.$authUid['.read']) && /auth\.uid === \$authUid/.test(RULES.xmasMine.$authUid['.read']), '받은 편지 · 내 자리는 본인만 읽는다');
  const RT = RULES.xmasReturned.$authUid.$lid;
  const retW = (uid, owner, after) => run(RT['.write'], { root: { xmasReturned: { [owner]: { l2: { reason: 'abuse', ts: 1, text: 'x' } } } }, after,
    path: 'xmasReturned/' + owner + '/l2', auth: au(uid), now: T, vars: { $authUid: owner, $lid: 'l2' } });
  chk(retW('uMe0000001', 'uMe0000001', {}), '반송 표시 — 본인이 지운다(다시 쓰면 앱이 걷음)');
  chk(!retW('uMe0000001', 'uMe0000001', { xmasReturned: { uMe0000001: { l2: { reason: 'abuse', ts: 2, text: 'y' } } } }), '  ↳ 본인도 만들거나 고치지는 못한다(함수만)');
  chk(!retW('uOther0001', 'uMe0000001', {}), '  ↳ 남이 지우기는 막힘');
  chk(/auth\.uid === \$authUid/.test(RULES.xmasReturned.$authUid['.read']) && /admins/.test(RULES.xmasReturned['.read']), '반송 표시 읽기 — 본인 · 관리자');
  const inboxTag = RULES.inbox.$uid.$msgId['.validate'];
  chk(/\|xmas\)/.test(inboxTag), '알림함에 xmas 꼬리표 — 앱이 읽음 표시를 쓸 수 있게');
  chk(String(L['.write']).includes(String(X.LETTER_DEADLINE_MS)) && String(R['.write']).includes(String(X.EVENT_END_MS)), '규칙의 마감 · 끝 시각이 함수와 같은 숫자');

  say('── 6절 index.js 연결 · 깨 보기');
  chk(/exports\.xmasHang = onCall\(/.test(FX) && /require\('\.\/xmas'\)\.handleHang\(/.test(FX), 'xmasHang 연결');
  chk(/exports\.xmasMatch = onSchedule\(\{ schedule: '0 0 25 12 \*', timeZone: 'Asia\/Seoul'/.test(FX) && /runMatch\(/.test(FX), 'xmasMatch — 12/25 0시 서울');
  chk(/exports\.xmasAdminRemove = onCall\(/.test(FX) && /handleAdminRemove\(/.test(FX), 'xmasAdminRemove 연결');
  chk(/exports\.xmasAdminReturn = onCall\(/.test(FX) && /handleAdminReturn\(/.test(FX), 'xmasAdminReturn 연결');
  chk(!/^const .*require\('firebase-admin\/database'\)/m.test(FX), 'firebase-admin/database 를 맨 위에서 읽지 않는다');
  // 깨 보기 — 짝 짓기를 «밀지 않게» 바꾸면 자기 편지를 받는다
  const broken = (authors) => authors.slice();
  chk(broken(['a', 'b']).some((r, i) => r === ['a', 'b'][i]), '깨 보기 — 밀지 않으면 자기 편지를 받는다(위 검사가 잡는 모양)');
  // 깨 보기 — «거는 중» 을 시각 없이 보면(옛 모양) 오래된 표시가 영영 막는다
  const brokenLive = (m) => !!(m && m.busy);
  chk(brokenLive({ busy: NOW - X.BUSY_STALE_MS * 100 }) && !X.liveBusy({ busy: NOW - X.BUSY_STALE_MS * 100 }, NOW), '깨 보기 — 시각을 안 보면 오래된 «거는 중» 이 영영 막는다(위 검사가 잡는 모양)');
  // 깨 보기 — 규칙 마감을 지우면 마감 뒤 쓰기가 통과한다
  const L2 = Object.assign({}, L, { '.write': String(L['.write']).replace(/ && now < \d+/, '') });
  const env = { root: {}, after: { xmasLetters: { uMe0000001: { l1: good } } }, path: 'xmasLetters/uMe0000001/l1', auth: au('uMe0000001'), now: X.LETTER_DEADLINE_MS + 1, vars: { $authUid: 'uMe0000001', $lid: 'l1' } };
  chk(run(L2['.write'], env) && !run(L['.write'], env), '깨 보기 — 규칙에서 마감을 빼면 마감 뒤 쓰기가 통과한다');
}

say(`\n${fail ? '✗' : '✓'} ${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
