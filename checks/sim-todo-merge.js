/* ═══ 📋 sim-todo-merge.js — PR 머지 → 할 일 완료 (2026-10-10 신설) ═══════════════════════════════
   GitHub Actions(todo-merge.yml)가 scripts/todo-merge.js 로 PR 본문 «할 일: <id>» 를 뽑아 Cloud Function todoMergeDone
   (functions/todo-merge.js)에 보낸다. 함수는 Admin SDK 라 규칙을 거치지 않는다 — 규칙이 하던 검사를 스스로 한다.
   ・1절: 본문 → id — 템플릿 주석 속 예시 id 는 안 집음 · 쉼표/공백 · 따옴표 · 자리표시 · 겹침 · 10개까지
   ・2절: 다음 버전 — 0.11.2 → 0.11.3 · 베타 0.12.0-beta.1 → 0.12.0 · 모양이 틀리면 null / 보낼 것 · 건너뛸 이유
   ・3절: 요청 검사 · 비밀 비교(빈 비밀은 늘 거절) · Bearer
   ・4절: 완료 값 — 진행 중 → 완료 · 버전은 비었을 때만 · 메모 한 줄(두 번 안 붙임 · 2000자 넘으면 메모만 건너뜀) · rev + 1 · 봇
   ・5절: 요청 처리 — 405 · 401 · 400 · 없는 id 건너뜀 · 이미 완료 + 버전이면 그대로 · 작업 기록 한 줄이 규칙 모양
   ・6절: 상수가 규칙 · 터미널 도구와 같다 · index.js 가 비밀과 함께 내보낸다
   ・7절: 스크립트 main — 설정 전이면 부르지 않고 끝 · 실패해도 던지지 않는다
   [실행] functions/todo-merge.js · scripts/todo-merge.js · firebase-database-rules.json 이 있는 폴더(저장소 루트 · 스테이징)에서. */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
for(const f of ['functions/todo-merge.js', 'functions/index.js', 'scripts/todo-merge.js', 'scripts/todo.js', 'firebase-database-rules.json'])
  if(read(f) == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); }
const F = require(path.resolve('functions/todo-merge.js'));
const S = require(path.resolve('scripts/todo-merge.js'));
const T = require(path.resolve('scripts/todo.js'));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

say('── 1. PR 본문 → 할 일 id');
{
  const tpl = '할 일: <!-- node scripts/todo.js start 로 받은 id (예: tmv1tiuezg94bz0) · 머지되면 done <id> --release <버전> -->\n\n## 무엇을';
  chk(eq(S.parseTodoIds(tpl), []), '템플릿 그대로(주석 속 예시 id)면 없음');
  chk(eq(S.parseTodoIds('할 일: tabc123 <!-- 설명 -->\n## 무엇을'), ['tabc123']), 'id 하나 · 같은 줄 주석은 걷음');
  chk(eq(S.parseTodoIds('할 일: tA, tB  tC，tD'), ['tA', 'tB', 'tC', 'tD']), '쉼표 · 공백 · 전각 쉼표로 여럿');
  chk(eq(S.parseTodoIds('할일: `tA`, "tB".'), ['tA', 'tB']), '«할일:» 붙여 쓴 것 · 따옴표 · 끝 마침표');
  chk(eq(S.parseTodoIds('- 할 일: tA\r\n본문\r\n할 일: tB tA'), ['tA', 'tB']), '목록 표시 · 여러 줄 · 겹치면 한 번');
  chk(eq(S.parseTodoIds('할 일: 없음'), []) && eq(S.parseTodoIds('할 일: -'), []) && eq(S.parseTodoIds('할 일: <id>'), []), '자리표시(없음 · - · <id>)는 안 집음');
  chk(eq(S.parseTodoIds('이 PR 은 할 일: 이 아니라\n무엇을: tA'), []), '«할 일:» 로 시작하는 줄만');
  chk(eq(S.parseTodoIds('할 일: ' + 'x'.repeat(33)), []), '33자는 id 모양이 아님');
  chk(S.parseTodoIds('할 일: ' + Array.from({ length: 15 }, (_, i) => 't' + i).join(' ')).length === 10, '10개까지만');
  chk(eq(S.parseTodoIds(null), []) && eq(S.parseTodoIds(''), []), '본문이 비어도 오류 없이 빈 목록');
}

say('── 2. 다음 버전 · 보낼 것');
{
  chk(S.nextRelease('0.11.2') === '0.11.3', '0.11.2 → 0.11.3');
  chk(S.nextRelease('1.9.9') === '1.9.10', '1.9.9 → 1.9.10');
  chk(S.nextRelease('0.12.0-beta.1') === '0.12.0', '베타 0.12.0-beta.1 → 0.12.0(정식에 실린다)');
  chk(S.nextRelease('v0.11') === null && S.nextRelease(undefined) === null, '모양이 틀리면 null');
  chk(['0.11.3', '1.9.10', '0.12.0'].every(v => F.RELEASE_RE.test(v)), '셈한 버전은 함수가 받는 모양');
  const env = { PR_BODY: '할 일: tA', PR_NUMBER: '101', TODO_MERGE_URL: 'https://x', TODO_MERGE_TOKEN: 'k' };
  chk(eq(S.plan(env, '0.11.2'), { body: { ids: ['tA'], pr: 101, release: '0.11.3' } }), '보낼 것 { ids, pr, release }');
  chk(/id 가 없음/.test(S.plan({ ...env, PR_BODY: '' }, '0.11.2').skip), 'id 가 없으면 건너뜀');
  chk(/설정 전/.test(S.plan({ ...env, TODO_MERGE_URL: '' }, '0.11.2').skip), '주소 변수가 없으면 건너뜀');
  chk(/설정 전/.test(S.plan({ ...env, TODO_MERGE_TOKEN: '' }, '0.11.2').skip), '비밀이 없으면(포크 PR 포함) 건너뜀');
  chk(/버전/.test(S.plan(env, null).skip), 'package.json 버전을 못 읽으면 건너뜀');
  chk(/PR 번호/.test(S.plan({ ...env, PR_NUMBER: 'x' }, '0.11.2').skip), 'PR 번호가 틀리면 건너뜀');
}

say('── 3. 요청 검사 · 비밀');
{
  const ok = F.parseRequest({ ids: ['tA', 'tA', 'tB'], pr: 7, release: '0.11.3' });
  chk(eq(ok, { ids: ['tA', 'tB'], pr: 7, release: '0.11.3' }), '맞는 요청 · 겹친 id 는 한 번');
  const bad = (b) => !!F.parseRequest(b).error;
  chk(bad(null) && bad([]) && bad('x'), '객체가 아니면 거절');
  chk(bad({ ids: [], pr: 1, release: '0.1.0' }), '빈 ids 거절');
  chk(bad({ ids: Array.from({ length: 11 }, (_, i) => 't' + i), pr: 1, release: '0.1.0' }), '11개 넘으면 거절');
  chk(bad({ ids: ['../x'], pr: 1, release: '0.1.0' }) && bad({ ids: [3], pr: 1, release: '0.1.0' }), 'id 모양(경로 문자 · 숫자) 거절');
  chk(bad({ ids: ['tA'], pr: 0, release: '0.1.0' }) && bad({ ids: ['tA'], pr: 1.5, release: '0.1.0' }) && bad({ ids: ['tA'], pr: '1', release: '0.1.0' }), 'pr 은 양의 정수만');
  chk(bad({ ids: ['tA'], pr: 1, release: 'v0.1' }) && bad({ ids: ['tA'], pr: 1, release: '1.2.3-beta.1' + '0'.repeat(10) }), 'release 모양 · 20자');
  chk(F.tokenOk('s3cret', 's3cret') && !F.tokenOk('s3cre', 's3cret') && !F.tokenOk('', ''), '비밀 비교 · 다른 길이 · 빈 값');
  chk(!F.tokenOk('x', undefined) && !F.tokenOk(undefined, 'x'), '함수 비밀이 설정 전이면 늘 거절');
  chk(F.bearer('Bearer abc') === 'abc' && F.bearer('bearer abc') === '' && F.bearer('Basic abc') === '' && F.bearer(undefined) === '', 'Authorization: Bearer 만');
  const src = read('functions/todo-merge.js');
  chk(/timingSafeEqual/.test(src), '같은 시간 비교(timingSafeEqual)');
}

say('── 4. 완료 값');
{
  const raw = { title: '채팅', memo: '처음', status: 'doing', type: 'bug', assignee: 'U2', assigneeName: '서',
    reports: { abcdefghij0123456789: true }, createdBy: 'U2', createdAt: 5, updatedBy: 'U2', updatedAt: 9, rev: 3 };
  const v = F.mergeDoneValue(raw, { pr: 12, release: '0.11.3' }, 1000);
  chk(v.status === 'done' && v.release === '0.11.3' && v.rev === 4, '진행 중 → 완료 · 버전 · rev + 1');
  chk(v.updatedBy === F.BOT_UID && v.updatedAt === 1000, '고친 사람은 봇 · 시각은 함수(서버) 시각');
  chk(v.createdBy === 'U2' && v.createdAt === 5 && v.assignee === 'U2' && v.type === 'bug' && eq(v.reports, raw.reports), '만든 사람/시각 · 작업자 · 종류 · 제보는 그대로');
  chk(v.memo === '처음\nPR #12 머지', '메모 뒤에 «PR #12 머지» 한 줄');
  chk(raw.status === 'doing' && raw.rev === 3, '읽은 값은 건드리지 않는다');
  const again = F.mergeDoneValue({ ...raw, memo: '처음\nPR #12 머지' }, { pr: 12, release: '0.11.3' }, 1000);
  chk(again.memo === '처음\nPR #12 머지', '같은 줄은 두 번 안 붙임');
  const planned = F.mergeDoneValue({ ...raw, release: '0.12.0' }, { pr: 12, release: '0.11.3' }, 1000);
  chk(planned.release === '0.12.0' && planned.status === 'done', '미리 적어 둔 버전은 덮지 않는다');
  chk(F.mergeDoneValue({ ...raw, status: 'done', release: '0.11.1' }, { pr: 12, release: '0.11.3' }, 1000) === null, '이미 완료 + 버전이면 바꿀 것 없음(null)');
  const fill = F.mergeDoneValue({ ...raw, status: 'done' }, { pr: 12, release: '0.11.3' }, 1000);
  chk(fill.release === '0.11.3' && fill.rev === 4, '완료인데 버전이 없으면 버전만 채움');
  const noMemo = F.mergeDoneValue({ ...raw, memo: undefined }, { pr: 3, release: '0.11.3' }, 1);
  chk(noMemo.memo === 'PR #3 머지', '메모가 없으면 그 한 줄');
  const full = F.mergeDoneValue({ ...raw, memo: 'x'.repeat(1995) }, { pr: 3, release: '0.11.3' }, 1);
  chk(full.memo.length === 1995 && full.status === 'done', '2000자를 넘게 되면 메모만 건너뛰고 완료는 한다');
  chk(F.mergeDoneValue(null, { pr: 1, release: '0.1.0' }, 1) === null && F.mergeDoneValue({ title: 'x' }, { pr: 1, release: '0.1.0' }, 1) === null, '모양이 틀린 값은 건드리지 않음');
  // 쓴 값은 터미널 도구의 규칙 검사(updatedBy 는 봇 · 서버 시각 자리는 숫자라 그 둘만 빼고)를 통과한다.
  const forRule = { ...v, updatedAt: T.SERVER_TIME };
  chk(T.checkValue('tabc', forRule, raw, F.BOT_UID) === null, '규칙 모양 검사 통과(rev + 1 · 모르는 칸 없음)');
  chk(F.changeText(raw, v, 12) === '진행 중 → 완료 · 메모 · 릴리스 없음 → 0.11.3 · PR #12 머지', '작업 기록 detail — 웹 · 터미널과 같은 말');
}

say('── 5. 요청 처리');
{
  // 가짜 DB — get · transaction(첫 호출은 캐시가 비어 null) · set.
  function fakeDb(data){
    const writes = [];
    const at = (p) => p.split('/').reduce((o, k) => (o == null ? undefined : o[k]), data);
    const put = (p, v) => { const ks = p.split('/'); let o = data; for(const k of ks.slice(0, -1)) o = (o[k] = o[k] || {}); o[ks[ks.length - 1]] = v; };
    return {
      writes,
      ref: (p) => ({
        get: async () => ({ exists: () => at(p) != null, val: () => at(p) }),
        transaction: async (fn) => {
          let r = fn(null);                       // 캐시 없음
          const cur = at(p) == null ? null : JSON.parse(JSON.stringify(at(p)));
          if(r === null && cur !== null) r = fn(cur);   // 서버 값으로 다시
          if(r === undefined) return { committed: false, snapshot: { val: () => cur } };
          if(r !== null){ put(p, r); writes.push([p, r]); }
          return { committed: true, snapshot: { val: () => r } };
        },
        set: async (v) => { put(p, v); writes.push([p, v]); },
      }),
    };
  }
  const todo = (name, o = {}) => ({ title: '할 일 ' + name, status: 'doing', createdBy: 'U1', createdAt: 1, updatedBy: 'U1', updatedAt: 2, rev: 0, ...o });
  const req = (body, extra = {}) => ({ method: 'POST', headers: { authorization: 'Bearer KEY' }, body, ...extra });
  const body = { ids: ['tA', 'tB', 'tC', 'tD'], pr: 55, release: '0.11.3' };
  (async () => {
    const data = { adminTodos: { tA: todo('A'), tC: todo('C', { status: 'done', release: '0.11.1' }), tD: todo('D', { status: 'done' }) } };
    const db = fakeDb(data);
    chk((await F.handleTodoMerge(db, req(body, { method: 'GET' }), 'KEY', 9)).status === 405, 'POST 가 아니면 405');
    chk((await F.handleTodoMerge(db, req(body, { headers: { authorization: 'Bearer NO' } }), 'KEY', 9)).status === 401, '비밀이 틀리면 401');
    chk((await F.handleTodoMerge(db, req(body), '', 9)).status === 401, '함수 비밀 설정 전이면 401');
    chk(db.writes.length === 0, '거절된 요청은 아무것도 안 씀');
    chk((await F.handleTodoMerge(db, req({ ...body, pr: -1 }), 'KEY', 9)).status === 400, '모양이 틀리면 400');
    const r = await F.handleTodoMerge(db, req(body), 'KEY', 9);
    chk(r.status === 200 && eq(r.body.results.map(x => x.id + ':' + x.result), ['tA:done', 'tB:missing', 'tC:already', 'tD:done']), '결과 — 완료 · 없음 · 이미 · 버전만 채움');
    chk(data.adminTodos.tA.status === 'done' && data.adminTodos.tA.rev === 1 && data.adminTodos.tA.release === '0.11.3', 'tA 완료 · rev 0 → 1');
    chk(!('tB' in data.adminTodos), '없는 할 일은 새로 만들지 않는다');
    chk(data.adminTodos.tC.rev === 0 && data.adminTodos.tC.release === '0.11.1', '이미 완료 + 버전이면 손대지 않음');
    chk(data.adminTodos.tD.release === '0.11.3' && data.adminTodos.tD.rev === 1, '완료인데 버전 없던 것은 버전만');
    const logs = db.writes.filter(([p]) => p.startsWith('adminLog/'));
    chk(logs.length === 2, '작업 기록은 바뀐 것마다 한 줄');
    const [lp, lv] = logs[0];
    chk(/^adminLog\/[A-Za-z0-9_-]{1,32}$/.test(lp), '기록 id 는 규칙 모양');
    chk(lv.action === 'todo.update' && lv.by === F.BOT_UID && lv.at === 9 && lv.target === '할 일 A' && lv.detail === '진행 중 → 완료 · 메모 · 릴리스 없음 → 0.11.3 · PR #55 머지', '기록 — todo.update · 봇 · 시각 · 제목 · 바뀐 것');
    chk(eq(Object.keys(lv).sort(), ['action', 'at', 'by', 'detail', 'target']) && lv.target.length <= 60 && lv.detail.length <= 120, '기록 칸 · 길이가 규칙과 같다');
    const again = await F.handleTodoMerge(db, req(body), 'KEY', 10);
    chk(again.body.results.every(x => x.result !== 'done'), '같은 머지를 다시 보내도 바뀌지 않음');
    const long = F.logEntry('가'.repeat(80), '나'.repeat(200), 5);
    chk(long[1].target.length === 60 && long[1].detail.length === 120, '긴 제목 · detail 은 잘라서');
    after();
  })().catch((e) => { chk(false, '5절 실행 중 오류 — ' + (e && e.stack)); after(); });
}

function after(){
  say('── 6. 상수 · 내보내기');
  {
    const rules = read('firebase-database-rules.json');
    chk(rules.includes('$id.matches(/^[A-Za-z0-9_-]{1,32}$/)') && String(F.ID_RE) === '/^[A-Za-z0-9_-]{1,32}$/' && String(S.ID_RE) === String(F.ID_RE), 'id 모양 — 규칙 · 함수 · 스크립트 같다');
    chk(String(F.RELEASE_RE) === String(T.RELEASE_RE), '버전 모양 — 터미널 도구와 같다');
    chk(S.IDS_MAX === F.IDS_MAX, '한 번에 보내는 개수 — 스크립트 · 함수 같다');
    const idx = read('functions/index.js');
    chk(/defineSecret\('TODO_MERGE_TOKEN'\)/.test(idx) && /exports\.todoMergeDone\s*=\s*onRequest\(\{\s*secrets:\s*\[TODO_MERGE_TOKEN\]/.test(idx), 'index.js — onRequest · 비밀 TODO_MERGE_TOKEN');
    chk(/maxInstances:\s*1/.test(idx.slice(idx.indexOf('exports.todoMergeDone'))), '인스턴스 1개까지');
    chk(F.BOT_UID === 'github-merge', '봇 uid — web-admin shared/lib/botNames.ts 와 같아야 함');
  }

  say('── 7. 스크립트 main');
  (async () => {
    const orig = globalThis.fetch, logs = [];
    const origLog = console.log;
    let called = 0;
    globalThis.fetch = async () => { called++; throw new Error('닿지 않음'); };
    console.log = (s) => logs.push(String(s));
    try {
      const vf = path.join(require('os').tmpdir(), 'tw-todo-merge-pkg.json');
      fs.writeFileSync(vf, JSON.stringify({ version: '0.11.2' }));
      await S.main({ PR_BODY: '할 일: tA', PR_NUMBER: '3', VERSION_FILE: vf });
      const skipped = called === 0 && logs.some(l => /건너뜀/.test(l));
      await S.main({ PR_BODY: '할 일: tA', PR_NUMBER: '3', VERSION_FILE: vf, TODO_MERGE_URL: 'https://x', TODO_MERGE_TOKEN: 'SECRETVALUE' });
      const warned = called === 1 && logs.some(l => /::warning::/.test(l));
      const leaked = logs.some(l => l.includes('SECRETVALUE'));
      globalThis.fetch = async (u, o) => { called++; return { ok: true, status: 200, text: async () => JSON.stringify({ results: [{ id: 'tA', result: 'done', release: '0.11.3' }] }), _o: o }; };
      await S.main({ PR_BODY: '할 일: tA', PR_NUMBER: '3', VERSION_FILE: vf, TODO_MERGE_URL: 'https://x', TODO_MERGE_TOKEN: 'SECRETVALUE' });
      const shown = logs.some(l => /tA: done · 0\.11\.3/.test(l));
      fs.unlinkSync(vf);
      console.log = origLog;
      chk(skipped, '설정 전이면 부르지 않고 «건너뜀» 만');
      chk(warned, '함수에 못 닿아도 던지지 않고 경고 한 줄');
      chk(shown, '결과를 id 마다 한 줄');
      chk(!leaked, '비밀 값은 로그에 안 찍힌다');
    } finally { console.log = origLog; globalThis.fetch = orig; }
    say(`\n통과 ${pass} · 실패 ${fail}`);
    if(fail){ say(`✗ 실패 ${fail}건`); process.exit(1); }
    say('✓ 전부 통과');
  })().catch((e) => { console.log('✗ 7절 오류 ' + (e && e.stack)); process.exit(1); });
}
