/* sim-xmas-net.js — 🎄 크리스마스 서버 읽기 · 쓰기(parts/xmas/xmas-net.js · 일회성)를 가짜 DB 로 돌려 본다
   실행: node checks/run.js sim-xmas-net
   ・1절 읽는 경로 — 하위 경로만(트리 목록 · 그림 한 자리 · 지금 트리 · 내 자리) · 통째 읽기 없음
   ・2절 내 자리 · 지금 트리 — 로그인 없음 · 아직 아무도 안 걸었으면 트리 1 · 실패는 { ok:false }
   ・3절 장식 걸기 — 함수 xmasHang 이름 · 받은 값 · 실패 code(functions/ 접두사 걷기)
   ・4절 신고 — 내 이름 칸 · 서버 시각 · 메모 40자 · 두 번째(권한 거절)는 dup
   ・5절 firebase-init 연결 · 깨 보기 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const find = (c) => c.find(p => fs.existsSync(p));
const NP = find(['xmas-net.js', 'parts/xmas/xmas-net.js', 'app/parts/xmas/xmas-net.js', 'apps/desktop/app/parts/xmas/xmas-net.js']);
const FP = find(['firebase-init.js', 'parts/firebase-init.js', 'app/parts/firebase-init.js', 'apps/desktop/app/parts/firebase-init.js']);
if (!NP || !FP) { say('  ? 원본 못 찾음 — xmas-net.js · firebase-init.js'); process.exit(2); }
const N = require(path.resolve(NP));
const FBI = fs.readFileSync(FP, 'utf8');

const SV_TS = { '.sv': 'timestamp' };
function mk(data, opts){
  const o = opts || {};
  const reads = [], writes = [], calls = [];
  const get = async (r) => { reads.push(r.path); if (o.failRead && o.failRead(r.path)) throw new Error('net'); const v = r.path.split('/').reduce((a, k) => (a && typeof a === 'object' ? a[k] : undefined), data); return { val: () => (v === undefined ? null : v) }; };
  const set = async (r, v) => { if (o.failWrite) throw Object.assign(new Error('PERMISSION_DENIED'), { code: 'PERMISSION_DENIED' }); writes.push([r.path, v]); };
  const net = N.createXmasNet({ db: {}, ref: (db, p) => ({ path: p }), get, set, serverTimestamp: () => SV_TS,
    authUid: () => (o.uid === undefined ? 'authMe00001' : o.uid),
    callFn: async (name, d) => { calls.push([name, d]); if (o.callErr) throw o.callErr; return { data: o.ret || { tree: 2, slot: 7, moved: true, changed: false } }; } });
  return { net, reads, writes, calls };
}

(async () => {
say('── 1절 읽는 경로');
{
  const D = { xmasMeta: { cur: 3, cnt: 12, matchedAt: null }, xmasMine: { authMe00001: { t: 2, s: 5 } }, xmasTrees: { 2: { o: { 5: { k: 'img', v: 2 } } } }, xmasImg: { 2: { 5: { v: 2, d: 'data:image/png;base64,AA' } } } };
  const m = mk(D);
  await m.net.where(); await m.net.tree(2); await m.net.img(2, 5);
  chk(m.reads.join() === 'xmasMeta/cur,xmasMine/authMe00001,xmasTrees/2/o,xmasImg/2/5', '읽는 경로 — ' + m.reads.join(' · '));
  chk(!m.reads.some(p => /^xmas(Trees|Img|Meta)$|^xmasImg\/\d+$/.test(p)), '트리 · 그림 · 메타를 통째로 읽지 않는다(그림은 한 자리씩)');
  const w = await m.net.where();
  chk(w.ok && w.cur === 3 && w.mine.t === 2 && w.mine.s === 5, '지금 트리 · 내 자리');
  const t = await m.net.tree(2); chk(t.ok && t.o[5].v === 2, '장식 목록');
  const i = await m.net.img(2, 5); chk(i.ok && i.v === 2 && /^data:image\/png/.test(i.d), '그림 한 자리');
}

say('── 2절 내 자리 · 지금 트리 · 실패');
{
  const m0 = mk({}, { uid: null }); const w0 = await m0.net.where();
  chk(!w0.ok && w0.code === 'auth' && m0.reads.length === 0, '로그인 없음 — 읽지 않고 auth');
  const m1 = mk({}); const w1 = await m1.net.where();
  chk(w1.ok && w1.cur === 1 && w1.mine === null, '아직 아무도 안 걸었으면 트리 1 · 내 자리 없음');
  const m2 = mk({ xmasMine: { authMe00001: { busy: 123 } } }); const w2 = await m2.net.where();
  chk(w2.ok && w2.mine === null, '«거는 중» 표시만 있으면 내 자리 없음으로');
  const m3 = mk({}, { failRead: (p) => p === 'xmasMeta/cur' }); const w3 = await m3.net.where();
  chk(!w3.ok && w3.code === 'read', '읽기 실패는 { ok:false, code:read } — «없음» 과 나눈다');
  const t3 = await mk({}).net.tree(2); chk(t3.ok && JSON.stringify(t3.o) === '{}', '빈 트리는 { ok:true, o:{} }');
  chk(!(await mk({}).net.tree(0)).ok, '트리 번호가 틀리면 거절');
  const i3 = await mk({}).net.img(9, 9); chk(i3.ok && i3.d === null, '없는 그림은 d:null');
}

say('── 3절 장식 걸기');
{
  const m = mk({});
  const r = await m.net.hang({ kind: 'star', word: '안녕', preview: 1 });
  chk(m.calls[0][0] === 'xmasHang' && m.calls[0][1].kind === 'star', '함수 xmasHang 에 그대로 보낸다');
  chk(r.ok && r.tree === 2 && r.slot === 7 && r.moved === true && r.changed === false, '받은 값 — 트리 · 자리 · 옮김');
  const e1 = await mk({}, { callErr: Object.assign(new Error('잠시 뒤'), { code: 'functions/aborted' }) }).net.hang({ kind: 'star' });
  chk(!e1.ok && e1.code === 'aborted' && e1.msg === '잠시 뒤', '실패 code — functions/ 접두사를 걷는다');
  const e2 = await mk({}, { callErr: new Error('x') }).net.hang({ kind: 'star' });
  chk(!e2.ok && e2.code === 'call', 'code 없는 실패는 call');
}

say('── 4절 신고');
{
  const m = mk({});
  const r = await m.net.reportOrnament(2, 7, '  ' + '가'.repeat(60) + ' ');
  chk(r.ok && m.writes[0][0] === 'xmasReports/o-2-7/authMe00001', '내 이름 칸(로그인 uid)에 쓴다');
  chk(m.writes[0][1].ts === SV_TS && m.writes[0][1].note.length === 40, '서버 시각 · 메모 40자');
  const m2 = mk({}); await m2.net.reportOrnament(2, 7); chk(!('note' in m2.writes[0][1]), '메모가 없으면 칸을 안 만든다');
  const d = await mk({}, { failWrite: true }).net.reportOrnament(2, 7);
  chk(!d.ok && d.code === 'dup', '두 번째 신고(규칙이 막음)는 dup');
  const a = await mk({}, { uid: null }).net.reportOrnament(2, 7); chk(!a.ok && a.code === 'auth', '로그인 없음은 auth');
}

say('── 5절 연결 · 깨 보기');
chk(/xmas: window\.TwXmasNet\.createXmasNet\(\{ db, ref, get, set, serverTimestamp, authUid: /.test(FBI) && /callFn: async \(name, data\) => \{ const mod = await import\(FUNCTIONS_SDK_URL\); return mod\.httpsCallable\(mod\.getFunctions\(fbApp, FUNCTIONS_REGION\), name\)\(data\); \}/.test(FBI), 'firebase-init — firebaseAPI.xmas 로 만든다(함수 리전 · SDK 같은 길)');
{
  // 깨 보기 — 트리를 통째로 읽으면 1절이 잡는다
  const reads = []; const get = async (r) => { reads.push(r.path); return { val: () => null }; };
  const bad = { tree: async (t) => get({ path: 'xmasTrees/' + t }) };
  await bad.tree(2);
  chk(/^xmasTrees\/\d+$/.test(reads[0]), '깨 보기 — 트리 통째 읽기(xmasTrees/2)는 위 검사의 «통째로 읽지 않는다» 모양에 걸린다');
}

say(`\n${fail ? '✗' : '✓'} ${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
