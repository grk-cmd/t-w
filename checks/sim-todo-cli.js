/* ═══ 📋 sim-todo-cli.js — 터미널 할 일 도구 scripts/todo.js ═══════════════════════════
   같이 일하는 사람들의 Claude Code 가 작업 전에 할 일을 찾아보고 · 등록하고 · 머지 뒤 완료 + 버전.
   이 도구는 API 서버 `/v2/admin/todos` 를 관리자 Firebase ID 토큰으로 부른다(api/README.md «ops» 와 같은 모양).
   ・1절: start 본문 — 진행 중 · 작업자 나 · 종류(feat|bug) 필수 · requestId · 빈 칸은 null · 제보는 B-MMDD-n
   ・2절: done 본문 — 남의 칸 그대로 · 읽은 version · 메모 덧붙이기 · 같은 줄 두 번 안 붙임 · 바꿀 것 없음
   ・3절: 응답 읽기 — 약속과 다른 칸은 던진다 · 봉투 실패 → 한국어 이유(401 · 403 · 409 · 404)
   ・4절: find — 대소문자 무시 · 한글 · 제보 번호 · 많이 맞은 것 먼저 / list 쿼리 / brief 요약 · 종류 배지
   ・5절: 로그인 파일 — 모양 · 토큰 만료 판정 · 권한 600
   ・6절: brief 는 관리자가 아니어도(setup 안 함 · API 못 닿음) 조용히 0 으로 3초 안에 끝난다
   ・7절: 가짜 API 서버로 list · find · start · done 을 실제로 돌린다(쪽 이어 받기 · 미리 보기는 안 보냄 · 409 · 403)
   [실행] node checks/run.js todo-cli */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
if(!fs.existsSync('scripts/todo.js')){ say('  ? 원본 못 찾음 — scripts/todo.js'); process.exit(2); }
const SCRIPT = path.resolve('scripts/todo.js');
const T = require(SCRIPT);
const me = { uid: 'U1', name: '미희' };
const throws = (fn, re) => { try{ fn(); return false; }catch(e){ return e instanceof T.TodoError && re.test(e.message); } };
const wire = (o = {}) => ({ todoId: 'tabc', title: '채팅', memo: null, status: 'doing', type: 'bug', assignee: 'U2', assigneeName: '서',
  reports: ['B-1122-3'], release: null, createdBy: 'U2', createdAt: '2026-11-22T01:00:00Z', updatedBy: 'U2', updatedAt: '2026-11-22T02:00:00Z', version: 3, ...o });

say('── 1. start 본문');
{
  const v = T.startBody({ title: '  할 일 도구  ', type: 'feat', memo: ' 메모 ', reports: ['B-1122-3', 'B-1122-3'] }, me, 'r1');
  chk(v.title === '할 일 도구' && v.memo === '메모', '제목 · 메모 앞뒤 공백을 뗀다');
  chk(v.status === 'doing' && v.assignee === 'U1' && v.assigneeName === '미희', '진행 중 · 작업자는 나 · 이름');
  chk(v.type === 'feat' && v.requestId === 'r1', '종류 · requestId(다시 보내도 한 건)');
  chk(JSON.stringify(v.reports) === '["B-1122-3"]', '제보 번호는 겹치지 않게');
  chk(!('version' in v) && !('createdBy' in v), '만들기는 version · 만든 사람을 싣지 않는다(서버가 토큰으로 정함)');
  const bare = T.startBody({ title: '버그', type: 'bug' }, { uid: 'U1', name: '' });
  chk(bare.memo === null && bare.release === null && bare.assigneeName === null && bare.reports.length === 0, '빈 메모 · 버전 · 이름은 null · 제보는 빈 배열');
  chk(/^[0-9a-f-]{36}$/.test(bare.requestId) && bare.requestId !== T.startBody({ title: '버그', type: 'bug' }, me).requestId, 'requestId 는 실행마다 새 uuid');
  chk(throws(() => T.startBody({ title: '제목' }, me), /--type feat 또는 bug/), '종류가 없으면 오류 «--type feat 또는 bug»');
  chk(throws(() => T.startBody({ title: '제목', type: 'chore' }, me), /--type/), '종류는 feat · bug 만');
  chk(throws(() => T.startBody({ title: ' ', type: 'feat' }, me), /제목/), '빈 제목은 거절');
  chk(throws(() => T.startBody({ title: 'x'.repeat(121), type: 'feat' }, me), /120자/), '제목 120자 넘으면 거절');
  chk(!throws(() => T.startBody({ title: 'x'.repeat(120), type: 'feat' }, me), /./), '  120자는 받는다');
  chk(throws(() => T.startBody({ title: 'x', type: 'feat', reports: ['abcdefghij0123456789'] }, me), /B-MMDD-n/), '옛 20자 제보 id 는 거절 — 고정 번호 B-MMDD-n');
  chk(throws(() => T.startBody({ title: 'x', type: 'feat', reports: Array.from({ length: 31 }, (_, i) => `B-1122-${i + 1}`) }, me), /30개/), '제보 30개 상한');
  chk(throws(() => T.startBody({ title: 'x', type: 'feat', release: 'v0.13' }, me), /릴리스/), '버전 모양이 틀리면 거절');
  chk(throws(() => T.startBody({ title: 'x', type: 'feat', release: '0.13.0-beta.123456789' }, me), /릴리스/) &&
    !throws(() => T.startBody({ title: 'x', type: 'feat', release: '0.13.0-beta.12345678' }, me), /./), '버전 20자 상한(서버와 같음) — 21자는 거절');
}

say('── 2. done 본문');
{
  const t = T.toTodo(wire({ memo: '처음 메모' }));
  const v = T.doneBody(t, { release: '0.13.1', memo: 'PR #99' });
  chk(v.status === 'done' && v.release === '0.13.1', '완료 · 릴리스 버전');
  chk(v.version === 3, '읽은 version 그대로(남이 먼저 고쳤으면 서버가 409)');
  chk(v.assignee === 'U2' && v.assigneeName === '서' && v.type === 'bug' && v.reports.join() === 'B-1122-3' && v.title === '채팅', '작업자 · 종류 · 제보 · 제목은 남의 것 그대로(칸 묶음을 통째로 보낸다)');
  chk(v.memo === '처음 메모\nPR #99', '메모는 덮지 않고 한 줄 덧붙인다');
  const again = T.doneBody({ ...t, memo: v.memo, status: 'done', release: '0.13.1' }, { release: '0.13.1', memo: 'PR #99' });
  chk(again.memo === v.memo && T.doneIsNoop({ ...t, memo: v.memo, status: 'done', release: '0.13.1' }, again), '같은 명령 두 번 — 같은 줄은 안 붙고 «바꿀 것 없음»');
  chk(!T.doneIsNoop(t, v), '  처음 완료는 보낸다');
  chk(T.doneBody({ ...t, release: '0.13.0' }, {}).release === '0.13.0', '버전을 안 주면 원래 버전을 둔다');
  const plain = T.toTodo(wire());
  chk(T.doneBody(plain, {}).release === null && T.doneBody(plain, {}).memo === null, '  메모 · 버전이 둘 다 없으면 null');
  chk(throws(() => T.doneBody(t, { release: '1.2' }), /릴리스/), '버전 모양이 틀리면 거절');
  chk(throws(() => T.doneBody({ ...t, memo: 'x'.repeat(1995) }, { memo: '여섯글자넘음' }), /2000자/), '덧붙여 2000자를 넘으면 거절');
}

say('── 3. 응답 읽기');
{
  const t = T.toTodo(wire());
  chk(t.id === 'tabc' && t.memo === '' && t.release === '' && t.version === 3 && t.updatedAt === Date.parse('2026-11-22T02:00:00Z'), '서버 줄 → 화면 줄(null 은 빈 글 · 시각은 ms)');
  chk(T.toTodo(wire({ type: null, assignee: null, assigneeName: null })).type === null, 'type · assignee null 은 «없음»');
  for(const [k, v] of [['status', 'open'], ['type', 'chore'], ['version', '3'], ['reports', null], ['memo', 3], ['updatedAt', 'x'], ['title', null]])
    chk(throws(() => T.toTodo(wire({ [k]: v })), new RegExp(k)), `${k} 가 약속과 다르면 던진다(짐작으로 채우지 않음)`);
  chk(throws(() => T.toPage({ items: [], nextCursor: 1 }), /nextCursor/) && throws(() => T.toPage({}), /items/), '쪽 모양이 다르면 던진다');
  chk(T.unwrap(200, { success: true, data: { a: 1 } }).a === 1, '성공 봉투 → data');
  chk(throws(() => T.unwrap(401, { success: false, code: 'AUTH_REQUIRED' }), /setup 을 다시/), '401 → setup 다시');
  chk(throws(() => T.unwrap(403, { success: false, code: 'FORBIDDEN' }), /관리자 계정만/), '403 → 관리자만');
  chk(throws(() => T.unwrap(409, { success: false, code: 'OPS_CONCURRENT_UPDATE' }), /다른 사람이/), '409 → 남이 먼저 바꿈 · 다시 실행');
  chk(throws(() => T.unwrap(404, { success: false, code: 'OPS_TODO_NOT_FOUND' }), /할 일이 없어요/), '404 OPS_TODO_NOT_FOUND → 없음');
  chk(throws(() => T.unwrap(502, null), /502/), '봉투가 없는 실패도 상태 번호를 말한다');
}

say('── 4. find · list · brief');
{
  const list = [
    T.toTodo(wire({ todoId: 'a', title: '채팅 이모티콘 버튼', reports: [], updatedAt: '2026-11-22T03:00:00Z' })),
    T.toTodo(wire({ todoId: 'b', title: 'Room Server 이어 붙기', memo: '끊긴 동안 채팅', status: 'todo', type: null, assignee: null, assigneeName: null, reports: [] })),
    T.toTodo(wire({ todoId: 'c', title: '캐릭터 용량', status: 'done', type: 'feat', release: '0.13.0', assignee: 'U1', reports: ['B-1120-7'] })),
  ];
  chk(T.findTodos(list, 'ROOM').map(t => t.id).join() === 'b', '대소문자 무시');
  chk(T.findTodos(list, '채팅').map(t => t.id).join() === 'a,b', '한글 · 메모까지 찾는다');
  chk(T.findTodos(list, '채팅 이모티콘').map(t => t.id)[0] === 'a', '많이 맞은 것 먼저');
  chk(T.findTodos(list, 'b-1120-7').map(t => t.id).join() === 'c', '제보 번호로도 찾는다 · 완료된 것도(이미 끝난 일인지)');
  chk(T.findTodos(list, '  ').length === 0, '빈 낱말은 아무것도');
  chk(JSON.stringify(T.listQuery({})) === '{"status":"todo,doing"}', 'list 기본은 완료 빼고(서버가 거른다)');
  chk(JSON.stringify(T.listQuery({ all: true })) === '{}', '--all 은 완료까지');
  chk(JSON.stringify(T.listQuery({ doing: true, all: true })) === '{"status":"doing"}', '--doing 은 진행 중만');
  chk(JSON.stringify(T.listQuery({ mine: true })) === '{"status":"todo,doing","assignee":"me"}', '--mine 은 assignee=me(서버가 토큰으로)');
  const b = T.briefText(list, { U2: '서' }, 'U1');
  chk(/진행 중인 할 일 1건/.test(b) && /🐞 채팅 이모티콘 버튼 · 서 \(a\)/.test(b) && !/용량|Room/.test(b), 'brief 는 진행 중만 · 종류 배지 · 작업자 · id');
  const l = T.line(list[2], {}, 'U1');
  chk(/0\.13\.0/.test(l) && /🆕 \[완료\]/.test(l) && /· 나 ·/.test(l), 'list 줄 — 종류 배지 · 상태 · 나 · 버전');
  chk(/^· \[할 일\] .* · 작업자 없음/.test(T.line(list[1], {}, 'U1')), '종류 · 작업자 없는 줄');
  chk(/진행 중인 할 일 없음/.test(T.briefText([], {}, null)), '진행 중이 없으면 한 줄');
  const o = T.parseArgs(['start', '제목', '하나', '--type', 'bug', '--report', 'B-1122-1', '--report', 'B-1122-2', '--dry-run', '--dev']);
  chk(o.pos.join(' ') === '제목 하나' && o.type === 'bug' && o.reports.join() === 'B-1122-1,B-1122-2' && o.flags.has('dry-run') && o.flags.has('dev'), '인자 — 제목 · 종류 · 제보 여러 개 · 미리 보기 · dev');
  chk(throws(() => T.parseArgs(['start', 'x', '--type']), /값을/), '값이 빠진 옵션은 오류');
  chk(T.ENVS.prod.api === 'https://api.together-working.com' && T.ENVS.dev.api === 'https://api-dev.together-working.com', '주소 — 운영 api · --dev 는 api-dev');
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-todo-'));
const NOW = Date.now();
const authObj = (o = {}) => ({ uid: 'U1', name: '미희', code: 'cozy-xfun', refreshToken: 'rt', idToken: 'it', idTokenExp: NOW + 3600e3, ...o });

say('── 5. 로그인 파일');
{
  chk(T.tokenFresh(authObj(), NOW) === true, '1시간 남은 토큰은 그대로 쓴다');
  chk(T.tokenFresh(authObj({ idTokenExp: NOW + 30e3 }), NOW) === false, '1분 안에 끝나면 미리 새로 받는다');
  chk(T.tokenFresh(authObj({ idToken: null }), NOW) === false, '  토큰이 없으면 새로');
  chk(T.toAuth(authObj()).uid === 'U1' && T.toAuth({ uid: 'U1' }) === null && T.toAuth(null) === null, '모양 — uid · refreshToken 이 없으면 «로그인 안 함»');
  const prev = process.env.TW_TODO_AUTH;
  process.env.TW_TODO_AUTH = path.join(tmp, 'sub', 'auth.json');
  const file = T.writeAuth('prod', authObj());
  if(prev === undefined) delete process.env.TW_TODO_AUTH; else process.env.TW_TODO_AUTH = prev;
  if(process.platform !== 'win32') chk((fs.statSync(file).mode & 0o777) === 0o600, '파일 권한 600(남이 못 읽게)');
  chk(JSON.parse(fs.readFileSync(file, 'utf8')).refreshToken === 'rt' && !fs.readdirSync(path.dirname(file)).some(f => f.endsWith('.tmp')), '바꿔 끼우기 — 임시 파일이 남지 않는다');
  chk(!/password/i.test(fs.readFileSync(file, 'utf8')), '비밀번호 칸은 없다');
  const d = T.authFile('dev');
  chk(/tw-todo[\\/]auth-dev\.json$/.test(d) && !d.startsWith(path.resolve('.')), '기본 자리 ~/.config/tw-todo/auth-<env>.json(저장소 밖) · env 마다 따로');
}

/** 비동기로 실행 — 가짜 서버가 같은 프로세스에서 응답해야 해서 spawnSync 를 쓰지 않는다. */
function run(args, env){
  return new Promise((resolve) => {
    const c = spawn(process.execPath, [SCRIPT, ...args], { env: { PATH: process.env.PATH, HOME: tmp, ...env } });
    let out = '', err = '';
    c.stdout.on('data', d => out += d); c.stderr.on('data', d => err += d);
    const t0 = Date.now();
    c.on('close', (status) => resolve({ status, out, err, ms: Date.now() - t0 }));
  });
}

(async () => {
  say('── 6. brief 는 관리자가 아니어도 조용히');
  {
    const none = path.join(tmp, '없는-파일.json');
    const r = await run(['brief'], { TW_TODO_AUTH: none, TW_TODO_API: 'http://127.0.0.1:1' });
    chk(r.status === 0 && r.out === '' && r.err === '', 'setup 안 함 → 아무것도 안 찍고 0');
    const f = path.join(tmp, 'auth-ok.json');
    fs.writeFileSync(f, JSON.stringify(authObj()), { mode: 0o600 });
    const r2 = await run(['brief'], { TW_TODO_AUTH: f, TW_TODO_API: 'http://127.0.0.1:1' });
    chk(r2.status === 0 && r2.out === '' && r2.err === '', 'API 에 못 닿음 → 아무것도 안 찍고 0');
    chk(r.ms + r2.ms < 6000, '둘 다 금방 끝난다(훅 3초 상한 안)');
    const r3 = await run(['list'], { TW_TODO_AUTH: none, TW_TODO_API: 'http://127.0.0.1:1' });
    chk(r3.status === 1 && /먼저 관리자 계정으로 로그인/.test(r3.err), 'brief 가 아닌 명령은 한국어로 이유를 말하고 1 — «먼저 … setup»');
    const r4 = await run(['setup', 'cozy-xfun'], { TW_TODO_AUTH: none });
    chk(r4.status === 1 && /터미널에서 직접/.test(r4.err) && !fs.existsSync(none), 'setup 은 터미널이 아니면 비밀번호를 묻지 않고 멈춘다 · 파일을 만들지 않는다');
  }

  say('── 7. 가짜 API 서버로 실제로 돌리기');
  const todos = new Map([
    ['t1', wire({ todoId: 't1', title: '채팅 이모티콘 버튼', reports: [] })],
    ['t2', wire({ todoId: 't2', title: '방 이어 붙기', status: 'todo', assignee: 'U1', assigneeName: '미희', reports: ['B-1122-9'], version: 0 })],
  ]);
  const seen = [];
  let forbid = false, stale = false, refreshMode = 'ok', refreshCalls = 0;
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', d => raw += d);
    req.on('end', () => {
      const u = new URL(req.url, 'http://x');
      if(u.pathname === '/token'){
        // Firebase securetoken 흉내 — grant_type=refresh_token 폼.
        refreshCalls++;
        const form = new URLSearchParams(raw);
        res.writeHead(refreshMode === 'bad' ? 400 : 200, { 'Content-Type': 'application/json' });
        if(refreshMode === 'bad') return res.end(JSON.stringify({ error: { message: 'INVALID_REFRESH_TOKEN' } }));
        return res.end(JSON.stringify({ id_token: 'it2', refresh_token: 'rt2', expires_in: '3600',
          user_id: refreshMode === 'otherUser' ? 'U9' : 'U1', grant: form.get('grant_type'), rt: form.get('refresh_token') }));
      }
      const body = raw ? JSON.parse(raw) : undefined;
      seen.push({ method: req.method, path: u.pathname, q: Object.fromEntries(u.searchParams), auth: req.headers.authorization, body });
      const send = (status, o) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
      const ok = (data) => send(200, { success: true, data, message: null });
      if(forbid) return send(403, { success: false, data: null, code: 'FORBIDDEN', message: '권한' });
      if(u.pathname === '/v2/admin/admins') return ok([{ authUid: 'U2', name: '서버이름' }, { authUid: 'U1', name: '미희' }]);
      if(u.pathname === '/v2/admin/todos' && req.method === 'GET'){
        // 한 쪽에 한 건씩 — 이어 받기를 본다. status 거르기는 서버 몫.
        const st = u.searchParams.get('status');
        const all = [...todos.values()].filter(t => !st || st.split(',').includes(t.status));
        const i = Number(u.searchParams.get('cursor') || 0);
        return ok({ items: all.slice(i, i + 1), nextCursor: i + 1 < all.length ? String(i + 1) : null,
          total: i ? null : all.length, counts: i ? null : { todo: 1, doing: 1, done: 4 }, releases: i ? null : [] });
      }
      if(u.pathname === '/v2/admin/todos' && req.method === 'POST'){
        const t = wire({ ...body, todoId: '019a-new', createdBy: 'U1', updatedBy: 'U1', version: 0 });
        delete t.requestId;
        todos.set(t.todoId, t);
        return ok(t);
      }
      const id = u.pathname.split('/')[4];
      const cur = todos.get(id);
      if(!cur) return send(404, { success: false, data: null, code: 'OPS_TODO_NOT_FOUND', message: '없음' });
      if(req.method === 'GET') return ok(cur);
      if(req.method === 'PATCH'){
        if(stale || body.version !== cur.version) return send(409, { success: false, data: null, code: 'OPS_CONCURRENT_UPDATE', message: '충돌' });
        const next = { ...cur, ...body, version: cur.version + 1, updatedBy: 'U1' };
        todos.set(id, next);
        return ok(next);
      }
      send(405, { success: false, data: null, code: 'METHOD', message: '' });
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const f = path.join(tmp, 'auth-ok.json');
  const env = { TW_TODO_AUTH: f, TW_TODO_API: `http://127.0.0.1:${server.address().port}` };
  try {
    const b = await run(['brief'], env);
    chk(/진행 중인 할 일 1건/.test(b.out) && /채팅 이모티콘 버튼 · 서버이름 \(t1\)/.test(b.out), 'brief — 진행 중 · 작업자 이름은 관리자 목록에서');
    chk(seen.some(s => s.path === '/v2/admin/todos' && s.q.status === 'doing') && seen.every(s => s.auth === 'Bearer it'), '  status=doing 으로 묻고 · 저장된 ID 토큰을 싣는다');
    seen.length = 0;
    const l = await run(['list', '--mine'], env);
    chk(l.status === 0 && /t1/.test(l.out) && /\[할 일\] 방 이어 붙기 · 나/.test(l.out) && /완료 4건은 --all/.test(l.out), 'list — 쪽을 끝까지 이어 받는다 · 나 · 완료 수는 첫 쪽 counts');
    chk(seen.filter(s => s.method === 'GET' && s.path === '/v2/admin/todos').map(s => s.q.cursor || '-').join() === '-,1' &&
      seen.every(s => s.path !== '/v2/admin/todos' || (s.q.assignee === 'me' && s.q.status === 'todo,doing' && s.q.limit === '200')), '  커서 이어 받기 · assignee=me · limit 200');
    const fd = await run(['find', 'b-1122-9'], env);
    chk(/겹칠 수 있는 할 일 1건/.test(fd.out) && /t2/.test(fd.out), 'find — 전부 받아 제보 번호로 찾는다');
    seen.length = 0;
    const dry = await run(['start', '새 버그', '--type', 'bug', '--report', 'B-1123-1', '--dry-run'], env);
    chk(dry.status === 0 && /미리 보기/.test(dry.out) && /"B-1123-1"/.test(dry.out) && seen.length === 0, 'start --dry-run — 본문만 보이고 아무것도 보내지 않는다');
    const st = await run(['start', '새 버그', '--type', 'bug', '--report', 'B-1123-1'], env);
    const post = seen.find(s => s.method === 'POST');
    chk(st.status === 0 && /id: 019a-new/.test(st.out) && post && post.body.assignee === 'U1' && post.body.status === 'doing' && /^[0-9a-f-]{36}$/.test(post.body.requestId), 'start — POST(진행 중 · 작업자 나 · requestId) · 서버가 준 id 를 알려 준다');
    seen.length = 0;
    const dn = await run(['done', 't1', '--release', '0.13.1', '--memo', 'PR #9'], env);
    const patch = seen.find(s => s.method === 'PATCH');
    chk(dn.status === 0 && /완료: 채팅 이모티콘 버튼 · 0\.13\.1/.test(dn.out) && patch.body.version === 3 && patch.body.assignee === 'U2' && patch.body.memo === 'PR #9', 'done — 읽은 version 으로 PATCH · 남의 작업자 그대로 · 메모');
    const dn2 = await run(['done', 't1', '--release', '0.13.1', '--memo', 'PR #9'], env);
    chk(dn2.status === 0 && /바꿀 것이 없어요/.test(dn2.out), '  같은 done 두 번 — 보내지 않는다');
    // mutation test — 읽은 뒤 남이 먼저 고친 상황: GET 은 옛 version 을 주고 PATCH 때 서버 값은 이미 올라가 있다.
    stale = true;
    const cf = await run(['done', 't2', '--release', '0.13.1'], env);
    chk(cf.status === 1 && /다른 사람이 이 할 일을 바꿨어요/.test(cf.err) && todos.get('t2').status === 'todo', 'mutation test — 남이 먼저 고쳤으면(409) 덮지 않고 «다시 실행»');
    stale = false;

    // refresh — 거의 모든 실행이 이 길(ID 토큰은 1시간).
    const ex = path.join(tmp, 'auth-expired.json');
    const exEnv = { ...env, TW_TODO_AUTH: ex, TW_TODO_REFRESH_URL: env.TW_TODO_API + '/token', TW_TODO_FIREBASE_KEY: 'k' };
    const expired = () => fs.writeFileSync(ex, JSON.stringify(authObj({ idToken: 'old', idTokenExp: NOW - 1 })), { mode: 0o600 });
    expired(); seen.length = 0; refreshCalls = 0; refreshMode = 'ok';
    const rf = await run(['list'], exEnv);
    const saved = JSON.parse(fs.readFileSync(ex, 'utf8'));
    chk(rf.status === 0 && refreshCalls === 1 && seen.length > 1 && seen.every(x => x.auth === 'Bearer it2'), '만료된 토큰 → list 한 번에 교환 1번 · 새 토큰을 Bearer 로(여러 요청이 같이 나가도)');
    chk(saved.idToken === 'it2' && saved.refreshToken === 'rt2' && saved.idTokenExp > NOW && (process.platform === 'win32' || (fs.statSync(ex).mode & 0o777) === 0o600), '  파일은 새 값 · 0600');
    expired(); const before = fs.readFileSync(ex, 'utf8'); refreshMode = 'otherUser'; seen.length = 0;
    const ou = await run(['list'], exEnv);
    chk(ou.status === 1 && /계정이 달라요/.test(ou.err) && fs.readFileSync(ex, 'utf8') === before && seen.length === 0, '교환 결과의 user_id 가 다르면 «계정이 달라요» 로 1 · 파일 그대로 · API 는 안 부른다');
    const oub = await run(['brief'], exEnv);
    chk(oub.status === 0 && oub.out === '' && oub.err === '', '  brief 는 조용히 0');
    refreshMode = 'bad';
    const bd = await run(['list'], exEnv);
    chk(bd.status === 1 && /setup 을 다시/.test(bd.err) && fs.readFileSync(ex, 'utf8') === before, 'refresh token 이 끊겼으면(400) «setup 다시» · 파일 그대로');
    const bdb = await run(['brief'], exEnv);
    chk(bdb.status === 0 && bdb.out === '' && bdb.err === '', '  brief 는 조용히 0');
    refreshMode = 'ok';
    if(process.platform !== 'win32'){
      fs.chmodSync(f, 0o644);
      const pm = await run(['list'], env);
      chk(pm.status === 0 && (fs.statSync(f).mode & 0o777) === 0o600 && /600 으로 고쳤어요/.test(pm.err), '로그인 파일 권한이 열려 있으면 600 으로 고치고 한 줄 알린다');
    }
    forbid = true;
    const fb = await run(['list'], env);
    chk(fb.status === 1 && /관리자 계정만/.test(fb.err), '관리자가 아니면(403) «관리자 계정만»');
    const fb2 = await run(['brief'], env);
    chk(fb2.status === 0 && fb2.out === '' && fb2.err === '', '  brief 는 403 이어도 조용히');
  } finally {
    server.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  say(`\n결과: ${pass} 통과 · ${fail} 실패`);
  process.exit(fail ? 1 : 0);
})();
