/*
 * 버그 제보 고정 번호(B-MMDD-n) 검사. functions/bug-no.js 를 그대로 불러 가짜 DB 로 돌린다.
 * 1. 날짜 · 모양  2. 처리기(카운터 +1 · 붙이기 · 이미 있음 · 지워진 글 · 이상한 ts)  3. 지워도 번호가 다시 안 쓰인다
 * 4. 백필 계획  5. index.js 연결  6. 규칙(no 모양 · 글쓴이는 no 못 넣음 · seq 클라이언트 못 씀)  7. 앱은 관리자에게만 보인다
 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f]) { try{ return fs.readFileSync(c, 'utf8'); }catch(_){} } return null; };
const need = (f) => { const s = read(f); if(s == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } return s; };
const RULES = need('firebase-database-rules.json');
const FX = need('functions/index.js');
need('functions/bug-no.js');
const UI = need('bug-board-ui.js');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

// 경로 → 값 가짜 DB. transaction 은 RTDB 처럼 «처음엔 로컬 추측(null)» 으로 한 번 부르고, 서버 값과 다르면 진짜 값으로 다시 부른다.
function fakeDb(data){
  const ref = (p) => ({
    get: async () => ({ val: () => (data[p] === undefined ? null : data[p]) }),
    // 루트 update — 값이 null 이면 그 경로와 아래를 지운다
    update: async (w) => {
      for (const [k, v] of Object.entries(w)){
        if (v === null){ for (const key of Object.keys(data)) if (key === k || key.startsWith(k + '/')) delete data[key]; }
        else data[k] = v;
      }
    },
    transaction: async (fn) => {
      let cur = null;
      for (let i = 0; i < 2; i++){
        const next = fn(cur === null ? null : JSON.parse(JSON.stringify(cur)));
        const server = data[p] === undefined ? null : data[p];
        if (next === undefined) return { committed: false, snapshot: { val: () => server } };
        if (JSON.stringify(cur) !== JSON.stringify(server)){ cur = server; continue; }
        if (next === null) delete data[p]; else data[p] = next;
        return { committed: true, snapshot: { val: () => (next === null ? null : next) } };
      }
      throw new Error('transaction 두 번 넘게');
    },
  });
  return { ref };
}
const ev = (id, v) => ({ params: { id }, data: { val: () => v } });
const noOf = (r) => (r && r.no) || null;

(async () => {
  const f = require(path.resolve('functions/bug-no.js'));
  const KST = (y, m, d, h) => Date.UTC(y, m - 1, d, h - 9);   // 서울 시각 → ms
  const NOW = KST(2026, 10, 9, 15);

  say('── 1. 날짜 · 모양');
  chk(f.kstDay(KST(2026, 10, 9, 0)) === '2026-10-09' && f.kstDay(KST(2026, 10, 9, 0) - 1) === '2026-10-08', '서울 자정으로 날짜를 가른다');
  chk(f.formatBugNo('2026-10-09', 3) === 'B-1009-3' && f.BUG_NO_RE.test('B-1009-3') && f.BUG_NO_RE.test('B-0101-1234') && !f.BUG_NO_RE.test('B-1009-12345'), '«B-MMDD-n» 모양');
  chk(f.bugNoDay(KST(2026, 10, 9, 1), NOW) === '2026-10-09' && f.bugNoDay(undefined, NOW) === '2026-10-09' && f.bugNoDay('x', NOW) === '2026-10-09'
      && f.bugNoDay(KST(2020, 1, 1, 12), NOW) === '2026-10-09' && f.bugNoDay(KST(2026, 10, 8, 23), NOW) === '2026-10-08',
      'ts 가 그럴듯하면 그 날 · 없거나 하루 넘게 어긋나면 지금');
  chk(f.nextSeq(null) === 1 && f.nextSeq(4) === 5 && f.nextSeq('x') === 1 && f.nextSeq(-3) === 1, '카운터는 +1 만 (없거나 이상하면 1부터)');

  // 글쓴이가 쓴 글 모양(규칙상 code · authUid 가 있다). 사람마다 코드를 바꿔 하루 한도에 걸리지 않게.
  const post = (h, extra) => Object.assign({ ts: KST(2026, 10, 9, h), vis: 'pub', authUid: 'uA', code: 'C' + h }, extra || {});

  say('── 2. 처리기 (runBugNo)');
  {
    const data = { 'bugBoard/list/a': post(10), 'bugBoard/list/b': post(11, { vis: 'prv' }) };
    const db = fakeDb(data);
    const na = noOf(await f.runBugNo(db, ev('a', data['bugBoard/list/a']), NOW));
    const nb = noOf(await f.runBugNo(db, ev('b', data['bugBoard/list/b']), NOW));
    chk(na === 'B-1009-1' && nb === 'B-1009-2', '그날 순서대로 1 · 2');
    chk(data['bugBoard/list/a'].no === 'B-1009-1' && data['bugBoard/list/a'].vis === 'pub' && data['bugBoard/seq/2026-10-09'] === 2, '  ↳ 글에 no 를 붙이고 다른 칸은 그대로 · 카운터 2');
    const again = await f.runBugNo(db, ev('a', data['bugBoard/list/a']), NOW);
    chk(again === null && data['bugBoard/seq/2026-10-09'] === 2 && data['users/C10/bugPostCount/2026-10-09'] === 1, '이미 no 가 있으면 아무것도 안 한다 (카운터 · 작성 수도 그대로)');
    data['bugBoard/list/c'] = post(12, { no: 'B-1009-9' });
    await f.runBugNo(db, ev('c', post(12)), NOW);
    chk(data['bugBoard/list/c'].no === 'B-1009-9', '이벤트 뒤에 누가 먼저 붙였어도 덮지 않는다');
    const gone = await f.runBugNo(db, ev('d', post(13)), NOW);
    chk(gone === null && data['bugBoard/list/d'] === undefined, '번호를 받는 사이 지워진 글엔 no 만 덩그러니 생기지 않는다');
    data['bugBoard/list/e'] = post(14, { ts: 'odd' });
    chk(noOf(await f.runBugNo(db, ev('e', data['bugBoard/list/e']), NOW)) === 'B-1009-5', 'ts 가 이상하면 지금 날짜로 (빈 번호 4 다음)');
    chk(await f.runBugNo(db, ev('a/b', { ts: 1 }), NOW) === null && await f.runBugNo(db, ev('x', null), NOW) === null, '키 모양이 이상하거나 값이 없으면 안 한다');
  }

  say('── 3. 지워도 번호는 다시 안 쓰인다');
  {
    const data = { 'bugBoard/list/a': post(10) };
    const db = fakeDb(data);
    await f.runBugNo(db, ev('a', data['bugBoard/list/a']), NOW);
    delete data['bugBoard/list/a'];
    data['bugBoard/list/b'] = post(11);
    chk(noOf(await f.runBugNo(db, ev('b', data['bugBoard/list/b']), NOW)) === 'B-1009-2', 'B-1009-1 을 지운 뒤 새 글은 B-1009-2');
    data['bugBoard/list/z'] = { ts: KST(2026, 10, 10, 1), vis: 'pub', authUid: 'uA', code: 'CZ' };
    chk(noOf(await f.runBugNo(db, ev('z', data['bugBoard/list/z']), NOW + 86400000)) === 'B-1010-1', '날이 바뀌면 1부터');
  }

  say('── 3-b. 하루 작성 수 (서버가 센다)');
  {
    const data = { 'admins/uBoss': true };
    const db = fakeDb(data);
    const mk = (id, h, extra) => {
      const v = Object.assign({ ts: KST(2026, 10, 9, h), vis: 'pub', authUid: 'uA', code: 'CA' }, extra || {});
      data['bugBoard/list/' + id] = v;
      data[(v.vis === 'prv' ? 'bugBoard/prv/uA/' : 'bugBoard/pub/') + id] = { title: 't', body: 'b' };
      return v;
    };
    const res = [];
    for (let i = 1; i <= f.BUG_DAILY_MAX; i++) res.push(noOf(await f.runBugNo(db, ev('p' + i, mk('p' + i, 9)), NOW)));
    chk(res.join() === 'B-1009-1,B-1009-2,B-1009-3,B-1009-4,B-1009-5' && data['users/CA/bugPostCount/2026-10-09'] === f.BUG_DAILY_MAX && f.BUG_DAILY_MAX === 5,
        '한 사람 하루 5건까지 받고 users/{code}/bugPostCount/{서울 날짜} 에 센다');
    const over = await f.runBugNo(db, ev('p6', mk('p6', 10, { vis: 'prv' })), NOW);
    chk(over && over.rejected && data['bugBoard/list/p6'] === undefined && data['bugBoard/prv/uA/p6'] === undefined, '6번째 글은 목록 줄 · 내용(비공개 자리)까지 지운다');
    chk(data['bugBoard/seq/2026-10-09'] === 5 && data['users/CA/bugPostCount/2026-10-09'] === 5, '  ↳ 지운 글은 번호도 작성 수도 쓰지 않는다 (받아들인 글 번호는 빈칸 없이)');
    const pubOver = await f.runBugNo(db, ev('p7', mk('p7', 10)), NOW);
    chk(pubOver.rejected && data['bugBoard/pub/p7'] === undefined, '  ↳ 공개 글이면 pub 자리를 지운다');
    chk(noOf(await f.runBugNo(db, ev('n1', mk('n1', 11, { notice: true }), NOW), NOW)) === 'B-1009-6', '공지는 세지 않는다');
    chk(noOf(await f.runBugNo(db, ev('b1', mk('b1', 11, { authUid: 'uBoss' })), NOW)) === 'B-1009-7' && data['users/CA/bugPostCount/2026-10-09'] === 5, '관리자 글은 세지 않는다');
    chk(noOf(await f.runBugNo(db, ev('o1', mk('o1', 11, { code: 'CB' })), NOW)) === 'B-1009-8', '다른 사람은 따로 센다');
    const bad = await f.runBugNo(db, ev('q1', mk('q1', 11, { code: 'a/b' })), NOW);
    chk(bad.rejected && data['bugBoard/list/q1'] === undefined, '코드 모양이 이상하면(셀 수 없으면) 받지 않는다');
    chk(noOf(await f.runBugNo(db, ev('t1', mk('t1', 11)), NOW + 86400000)) === 'B-1010-1', '다음 날(서울)은 다시 5건');
    chk(f.countUp(null) === 1 && f.countUp(4) === 5 && f.countUp(5) === undefined && f.countUp(9) === undefined, 'countUp — 한도면 트랜잭션을 그만둔다');
  }

  say('── 4. 백필 계획 (planBackfill)');
  {
    const list = {
      x2: { ts: KST(2026, 10, 8, 9) }, x1: { ts: KST(2026, 10, 8, 9) }, x0: { ts: KST(2026, 10, 8, 8) },
      y1: { ts: KST(2026, 10, 9, 9) }, done: { ts: KST(2026, 10, 9, 8), no: 'B-1009-1' }, bad: { vis: 'pub' }, nul: null,
    };
    const p = f.planBackfill(list, { '2026-10-09': 1 });
    chk(p.assigned.map(a => a.id + '=' + a.no).join(',') === 'x0=B-1008-1,x1=B-1008-2,x2=B-1008-3,y1=B-1009-2', '날짜별 ts 순(같으면 키 순) · 그날 카운터 다음부터 · 번호 있는 글은 건너뜀');
    chk(p.updates['bugBoard/seq/2026-10-08'] === 3 && p.updates['bugBoard/seq/2026-10-09'] === 2 && p.updates['bugBoard/list/y1/no'] === 'B-1009-2'
        && !('bugBoard/list/done/no' in p.updates), '  ↳ 쓰기 = 글마다 no + 날짜마다 카운터 (루트 update 한 번)');
    chk(p.skipped.join() === 'bad', '  ↳ ts 없는 글은 건너뛰고 알려 준다');
    chk(Object.keys(f.planBackfill({ done: { ts: 1, no: 'B-0101-1' } }, {}).updates).length === 0, '  ↳ 다 붙어 있으면 쓸 것이 없다 (두 번 돌려도 같다)');
    const B = strip(need('scripts/backfill-bug-no.js'));
    chk(/require\('\.\.\/functions\/bug-no'\)/.test(B) && /planBackfill/.test(B), '백필 도구는 함수와 같은 계산(bug-no.js)을 쓴다');
    chk(/'--write'/.test(B) && /if \(!WRITE\)/.test(B) && /if \(!PROJECT\)/.test(B), '  ↳ 기본은 미리 보기 · --project 없으면 멈춘다');
    chk(/moved\.length/.test(B), '  ↳ 쓰기 직전 카운터를 다시 읽어 바뀌었으면 멈춘다');
  }

  say('── 5. index.js 연결');
  {
    const CODE = strip(FX);
    const m = CODE.match(/exports\.bugNo = onValueCreated\(\{ ref: '\/bugBoard\/list\/\{id\}'[\s\S]*?\n  \}\);/);
    chk(!!m, 'bugNo = onValueCreated(/bugBoard/list/{id})');
    chk(!!m && /retry: false/.test(m[0]) && /maxInstances: \d+/.test(m[0]), '  ↳ 다시 시도 안 함 · 인스턴스 상한');
    chk(!!m && /require\('\.\/bug-no'\)\.runBugNo\(getDatabase\(\), event,/.test(m[0]) && /require\('firebase-admin\/database'\)/.test(m[0]), '  ↳ 처리는 bug-no.js · firebase-admin 은 실행할 때 읽는다');
    chk(/bugNo — 버그 제보 고정 번호/.test(FX), '  ↳ 머리 주석의 함수 목록에도 적었다');
    chk(!/^const[^\n]*require\(/m.test(strip(need('functions/bug-no.js'))), 'bug-no.js 는 맨 위에서 아무것도 require 하지 않는다');
  }

  say('── 6. 규칙');
  {
    const rules = JSON.parse(RULES).rules;
    const bb = rules.bugBoard;
    const it = bb.list.$id;
    chk(/!newData\.child\('no'\)\.exists\(\)/.test(it['.write'].split('||')[0]), '글쓴이는 새 글에 no 를 넣지 못한다 (관리자 · 함수만)');
    chk(it['.validate'].includes("newData.child('no').val().matches(/^B-[0-9]{4}-[0-9]{1,4}$/)") && !!it.no && it.$other['.validate'] === 'false', 'no 는 «B-MMDD-n» 모양만 · 다른 칸은 여전히 거절');
    chk(!!bb.seq && !JSON.stringify(bb.seq).includes('.read') && !JSON.stringify(bb.seq).includes('.write') && bb['.read'] === undefined, 'bugBoard/seq — 읽기 · 쓰기 규칙 없음 (관리자 전체 쓰기만 · 함수는 규칙 밖)');
    chk(/admins/.test(bb['.write']) && !/\|\|/.test(bb['.write']), '  ↳ bugBoard 전체 쓰기(지우기 포함)는 관리자만');
    const reWrite = new RegExp(f.BUG_NO_RE.source.replace(/\\d/g, '[0-9]'));
    chk(it['.validate'].includes(reWrite.source), '함수의 번호 모양이 규칙과 같다');
  }

  say('── 7. 앱');
  {
    const U = strip(UI);
    chk(/\(admin\(\) && it\.no\) \? '<span class="bb-no">' \+ esc\(it\.no\)/.test(U), '상세 머리에 고정 번호 — 관리자에게만 · esc 거침');
    const APP = (read('bug-board.js') || '') + (read('firebase-init.js') || '');
    chk(!!APP && !/bugBoard\/seq/.test(APP) && !/\bno:/.test(strip(read('bug-board.js') || '')), '앱은 번호를 만들거나 카운터를 만지지 않는다');
  }

  say(`\n${pass} · ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { say('  ✗ 검사가 던졌다: ' + (e && e.stack || e)); process.exit(1); });
