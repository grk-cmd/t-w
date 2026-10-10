/* ═══ 📋 sim-todo-cli.js — 터미널 할 일 도구 scripts/todo.js (2026-10-10 신설) ═══════════════════════════
   같이 일하는 사람들의 Claude Code 가 작업 전에 할 일(adminTodos)을 찾아보고 · 등록하고 · 머지 뒤 완료 + 버전.
   이 도구는 gcloud 토큰(IAM)으로 REST 를 불러 **규칙을 거치지 않는다** — 규칙 adminTodos/$id 가 하던 검사를 스스로 한다.
   ・1절: start 값 — 진행 중 · 작업자 나 · 종류(feat|bug) 필수 · 서버 시각 · rev 0 · 빈 칸은 안 둠
   ・2절: done 값 — 남의 칸 그대로 · rev + 1 · 만든 사람/시각 고정 · 메모 덧붙이기 · 같은 줄 두 번 안 붙임
   ・3절: checkValue — 규칙과 같은 모양 검사(모르는 칸 · 길이 · rev · 고친 사람 · 서버 시각)
   ・4절: 규칙 파일과 상수가 같다(제목 120 · 메모 2000 · 버전 모양)
   ・5절: find — 대소문자 무시 · 한글 · 많이 맞은 것 먼저 / list 거르기 / brief 요약 · 종류 배지
   ・6절: brief 는 관리자가 아니어도(gcloud 없음 · DB 못 닿음) 조용히 0 으로 3초 안에 끝난다
   [실행] scripts/todo.js · firebase-database-rules.json 이 있는 폴더(저장소 루트 · 스테이징)에서. */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
for(const f of ['scripts/todo.js', 'firebase-database-rules.json']) if(read(f) == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); }
const T = require(path.resolve('scripts/todo.js'));
const me = { uid: 'U1', name: '미희' };
const throws = (fn, re) => { try{ fn(); return false; }catch(e){ return e instanceof T.TodoError && re.test(e.message); } };
const SV = (v) => !!v && v['.sv'] === 'timestamp';

say('── 1. start 값');
{
  const v = T.startValue({ title: '  할 일 도구  ', type: 'feat', memo: ' 메모 ', reports: ['abcdefghij0123456789', 'abcdefghij0123456789'] }, me);
  chk(v.title === '할 일 도구' && v.memo === '메모', '제목 · 메모 앞뒤 공백을 걷는다');
  chk(v.status === 'doing' && v.assignee === 'U1' && v.assigneeName === '미희', '진행 중 · 작업자는 나 · 이름표');
  chk(v.type === 'feat', '종류 칸');
  chk(v.createdBy === 'U1' && v.updatedBy === 'U1' && v.rev === 0, '만든 · 고친 사람은 나 · rev 0');
  chk(SV(v.createdAt) && SV(v.updatedAt), '시각은 서버 시각({".sv":"timestamp"}) — 내 컴퓨터 시계 아님');
  chk(JSON.stringify(v.reports) === '{"abcdefghij0123456789":true}', '제보는 겹치지 않게 {id: true}');
  const bare = T.startValue({ title: '버그', type: 'bug' }, { uid: 'U1', name: '' });
  chk(!('memo' in bare) && !('reports' in bare) && !('release' in bare) && !('assigneeName' in bare), '빈 메모 · 제보 · 버전 · 이름은 칸을 두지 않는다(규칙이 빈 글자를 안 받음)');
  chk(throws(() => T.startValue({ title: '제목' }, me), /--type feat 또는 bug/), '종류가 없으면 묻지 않고 오류 «--type feat 또는 bug»');
  chk(throws(() => T.startValue({ title: '제목', type: 'chore' }, me), /--type/), '종류는 feat · bug 만');
  chk(throws(() => T.startValue({ title: ' ', type: 'feat' }, me), /제목/), '빈 제목은 거절');
  chk(throws(() => T.startValue({ title: 'x'.repeat(121), type: 'feat' }, me), /120자/), '제목 120자 넘으면 거절');
  chk(throws(() => T.startValue({ title: 'x', type: 'feat', reports: ['짧음'] }, me), /제보 id/), '제보 id 모양이 틀리면 거절');
  chk(throws(() => T.startValue({ title: 'x', type: 'feat', release: 'v0.11' }, me), /릴리스/), '버전 모양이 틀리면 거절');
  chk(T.checkValue('tabc', v, null, 'U1') === null, '만든 값은 규칙 검사를 통과');
}

say('── 2. done 값');
{
  const raw = { title: '채팅', memo: '처음 메모', status: 'doing', type: 'bug', assignee: 'U2', assigneeName: '서',
    reports: { abcdefghij0123456789: true }, createdBy: 'U2', createdAt: 5, updatedBy: 'U2', updatedAt: 9, rev: 3 };
  const v = T.doneValue(raw, { release: '0.11.3', memo: 'PR #99' }, me);
  chk(v.status === 'done' && v.release === '0.11.3', '완료 · 릴리스 버전');
  chk(v.rev === 4, 'rev 는 지금 값 + 1');
  chk(v.createdBy === 'U2' && v.createdAt === 5, '만든 사람 · 시각은 그대로');
  chk(v.assignee === 'U2' && v.assigneeName === '서' && v.type === 'bug' && v.reports === raw.reports, '작업자 · 종류 · 제보는 남의 것 그대로');
  chk(v.updatedBy === 'U1' && SV(v.updatedAt), '고친 사람은 나 · 서버 시각');
  chk(v.memo === '처음 메모\nPR #99', '메모는 덮지 않고 한 줄 덧붙인다');
  chk(T.doneValue({ ...raw, memo: v.memo, rev: 4 }, { memo: 'PR #99' }, me).memo === v.memo, '같은 줄은 두 번 안 붙인다');
  chk(raw.status === 'doing' && raw.rev === 3, '읽은 값은 건드리지 않는다');
  chk(T.checkValue('tOld', v, raw, 'U1') === null, '완료 값은 규칙 검사를 통과');
  chk(!('release' in T.doneValue({ ...raw }, {}, me)), '버전을 안 주면 칸을 두지 않는다');
  chk(throws(() => T.doneValue(raw, { release: '1.2' }, me), /릴리스/), '버전 모양이 틀리면 거절');
}

say('── 3. checkValue — 규칙과 같은 검사');
{
  const prev = { createdBy: 'U2', createdAt: 5, rev: 3 };
  const ok = T.doneValue({ title: 't', status: 'doing', createdBy: 'U2', createdAt: 5, updatedBy: 'U2', updatedAt: 1, rev: 3 }, {}, me);
  chk(T.checkValue('t1', ok, prev, 'U1') === null, '바른 값은 통과');
  chk(/rev/.test(T.checkValue('t1', { ...ok, rev: 5 }, prev, 'U1')), 'rev + 2 는 거절(남이 먼저 고친 것을 덮지 않게)');
  chk(/만든/.test(T.checkValue('t1', { ...ok, createdBy: 'U1' }, prev, 'U1')), '만든 사람을 바꾸면 거절');
  chk(/만든/.test(T.checkValue('t1', { ...ok, createdAt: 6 }, prev, 'U1')), '만든 시각을 바꾸면 거절');
  chk(/모르는 칸/.test(T.checkValue('t1', { ...ok, extra: 1 }, prev, 'U1')), '모르는 칸은 거절');
  chk(/빠진 칸/.test(T.checkValue('t1', { ...ok, title: undefined }, prev, 'U1')), '필수 칸이 빠지면 거절');
  chk(/고친 사람/.test(T.checkValue('t1', ok, prev, 'U9')), '고친 사람이 내가 아니면 거절');
  chk(/서버 시각/.test(T.checkValue('t1', { ...ok, updatedAt: 123 }, prev, 'U1')), '고친 시각이 숫자면 거절(서버 시각만)');
  chk(/종류/.test(T.checkValue('t1', { ...ok, type: 'x' }, prev, 'U1')), '종류는 feat · bug');
  chk(/작업자 이름만/.test(T.checkValue('t1', { ...ok, assignee: undefined, assigneeName: '서' }, prev, 'U1')), '작업자 없이 이름만은 거절');
  chk(/id/.test(T.checkValue('t/1', ok, prev, 'U1')), 'id 모양(1~32자 · 영문 숫자 _ -)');
  const fresh = T.startValue({ title: 'x', type: 'feat' }, me);
  chk(/rev 0/.test(T.checkValue('t2', { ...fresh, rev: 1 }, null, 'U1')), '새 할 일은 rev 0');
  chk(/내가 만든/.test(T.checkValue('t2', { ...fresh, createdBy: 'U2' }, null, 'U1')), '새 할 일의 만든 사람은 나');
  chk(/2000자/.test(T.checkValue('t2', { ...fresh, memo: 'x'.repeat(2001) }, null, 'U1')), '메모 2000자 상한');
}

say('── 4. 규칙 파일과 같은 상수');
{
  const R = JSON.parse(read('firebase-database-rules.json')).rules.adminTodos.$id;
  chk(R.title['.validate'].includes(`<= ${T.TITLE_MAX}`), `제목 상한 ${T.TITLE_MAX} = 규칙`);
  chk(R.memo['.validate'].includes(`<= ${T.MEMO_MAX}`), `메모 상한 ${T.MEMO_MAX} = 규칙`);
  chk(R.updatedAt['.validate'].includes('=== now') && R['.validate'].includes("newData.child('createdAt').val() === now"), '규칙도 서버 시각을 요구한다(그래서 .sv)');
  chk(R['.validate'].includes("data.child('rev').val() + 1"), '규칙도 rev + 1');
  for(const s of ['0.11.3', '0.12.0-beta.1']) chk(T.RELEASE_RE.test(s), `버전 ${s} 받음`);
  for(const s of ['v0.11.3', '0.11', '0.11.3-beta']) chk(!T.RELEASE_RE.test(s), `버전 ${s} 거절`);
  chk(/^t[0-9a-z]+$/.test(T.newId()) && T.newId().length <= 32, '새 id 는 웹과 같은 모양(t + 시각 + 난수 · 32자 안)');
}

say('── 5. find · list · brief');
{
  const raw = {
    a: { title: '채팅 이모티콘 버튼', status: 'doing', type: 'bug', assignee: 'U2', assigneeName: '서', createdBy: 'U2', createdAt: 1, updatedBy: 'U2', updatedAt: 30, rev: 0 },
    b: { title: 'Room Server 이어 붙기', memo: '끊긴 동안 채팅', status: 'todo', createdBy: 'U1', createdAt: 1, updatedBy: 'U1', updatedAt: 20, rev: 0 },
    c: { title: '캐릭터 용량', status: 'done', type: 'feat', release: '0.11.2', assignee: 'U1', createdBy: 'U1', createdAt: 1, updatedBy: 'U1', updatedAt: 10, rev: 2 },
    bad: { title: 3, status: 'doing', rev: 0 },
  };
  const list = T.toTodos(raw);
  chk(list.length === 3 && list.map(t => t.id).join() === 'a,b,c', '모양이 틀린 것은 빼고 진행 중 → 할 일 → 완료');
  chk(T.findTodos(list, 'ROOM').map(t => t.id).join() === 'b', '대소문자 무시');
  chk(T.findTodos(list, '채팅').map(t => t.id).join() === 'a,b', '한글 · 메모까지 찾는다');
  chk(T.findTodos(list, '채팅 이모티콘').map(t => t.id)[0] === 'a', '많이 맞은 것 먼저');
  chk(T.findTodos(list, '용량').map(t => t.id).join() === 'c', '완료된 것도 찾는다(이미 끝난 일인지)');
  chk(T.findTodos(list, '  ').length === 0, '빈 낱말은 아무것도');
  chk(T.filterTodos(list, {}, 'U1').map(t => t.id).join() === 'a,b', 'list 기본은 완료 빼고');
  chk(T.filterTodos(list, { all: true }, 'U1').length === 3, '--all 은 완료까지');
  chk(T.filterTodos(list, { doing: true }, 'U1').map(t => t.id).join() === 'a', '--doing 은 진행 중만');
  chk(T.filterTodos(list, { mine: true, all: true }, 'U1').map(t => t.id).join() === 'c', '--mine 은 작업자가 나');
  const b = T.briefText(list, { U2: '서' }, 'U1');
  chk(/진행 중인 할 일 1건/.test(b) && /🐞 채팅 이모티콘 버튼 · 서 \(a\)/.test(b) && !/용량|Room/.test(b), 'brief 는 진행 중만 · 종류 배지 · 작업자 · id');
  chk(/0\.11\.2/.test(T.line(list[2], {}, 'U1')) && /🆕 \[완료\]/.test(T.line(list[2], {}, 'U1')) && /· 나 ·/.test(T.line(list[2], {}, 'U1')), 'list 줄 — 종류 배지 · 상태 · 나 · 버전');
  chk(/진행 중인 할 일 없음/.test(T.briefText([], {}, null)), '진행 중이 없으면 한 줄');
  const o = T.parseArgs(['start', '제목', '하나', '--type', 'bug', '--report', 'r1', '--report', 'r2', '--dry-run']);
  chk(o.pos.join(' ') === '제목 하나' && o.type === 'bug' && o.reports.join() === 'r1,r2' && o.flags.has('dry-run'), '인자 — 제목 · 종류 · 제보 여러 개 · 미리 보기');
  chk(throws(() => T.parseArgs(['start', 'x', '--type']), /값을/), '값이 빠진 옵션은 오류');
}

say('── 6. brief 는 관리자가 아니어도 조용히');
{
  const t0 = Date.now();
  const r = spawnSync(process.execPath, ['scripts/todo.js', 'brief'], {
    encoding: 'utf8', timeout: 10000,
    env: { PATH: '', TW_TODO_DB: 'http://127.0.0.1:1', TW_TODO_ME: path.resolve('없는-파일.json') },
  });
  chk(r.status === 0 && r.stdout === '' && r.stderr === '', 'gcloud 없음 → 아무것도 안 찍고 0');
  const r2 = spawnSync(process.execPath, ['scripts/todo.js', 'brief'], {
    encoding: 'utf8', timeout: 10000,
    env: { PATH: '', TW_TODO_TOKEN: 'x', TW_TODO_DB: 'http://127.0.0.1:1', TW_TODO_ME: path.resolve('없는-파일.json') },
  });
  chk(r2.status === 0 && r2.stdout === '' && r2.stderr === '', 'DB 에 못 닿음 → 아무것도 안 찍고 0');
  chk(Date.now() - t0 < 6000, '둘 다 금방 끝난다(훅 3초 상한 안)');
  const r3 = spawnSync(process.execPath, ['scripts/todo.js', 'list'], {
    encoding: 'utf8', timeout: 10000, env: { PATH: '', TW_TODO_DB: 'http://127.0.0.1:1' },
  });
  chk(r3.status === 1 && /gcloud 가 없어요|관리자 계정만/.test(r3.stderr), 'brief 가 아닌 명령은 한국어로 이유를 말하고 1');
}

say(`\n결과: ${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
