#!/usr/bin/env node
/* ═══ 📋 scripts/todo.js — 관리자 «할 일»을 터미널 · Claude Code 에서 ═══
   같이 일하는 사람들이 같은 일을 겹쳐 하지 않게 — 작업 전에 찾아보고(find · brief), 시작할 때 등록(start),
   머지되면 완료 + 릴리스 버전(done). 웹 관리자 📋 할 일 화면과 같은 데이터(API 서버 `/v2/admin/todos`). 앱에 실리지 않는 관리용 도구.

   node scripts/todo.js setup [<친구 코드>]          처음 한 번: 관리자 계정(친구 코드 + 비밀번호)으로 로그인해 이 PC 에 저장
   node scripts/todo.js brief                       진행 중인 할 일 한 화면(세션 시작 훅) — 실패하면 아무것도 안 찍음
   node scripts/todo.js list [--mine] [--doing] [--all]
   node scripts/todo.js find <낱말...>              제목 · 메모 · 제보 번호에서 찾기(대소문자 무시) — 겹치는 일 확인
   node scripts/todo.js start "<제목>" --type feat|bug [--memo ..] [--report B-MMDD-n]... [--release x.y.z] [--dry-run]
   node scripts/todo.js done <id> [--release x.y.z] [--memo ..] [--dry-run]
   어느 명령이든 --dev 를 붙이면 dev API(api-dev · together-working-dev).

   권한: API 는 관리자 계정의 Firebase ID 토큰만 받는다. setup 이 친구 코드 + 비밀번호로 Firebase Auth REST 에 로그인해
   refresh token 을 ~/.config/tw-todo/auth-<prod|dev>.json(권한 600 · 저장소 밖)에 두고, 명령마다 그것으로 ID 토큰(1시간)을 받는다.
   비밀번호는 저장하지 않는다. 비밀번호를 바꾸면 refresh token 이 끊긴다 — setup 을 다시.
   요청 · 응답 모양은 api/README.md «ops» 와 apps/admin entities/admin/todo/api/server.ts 와 같아야 한다. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');

const ENVS = {
  prod: { api: 'https://api.together-working.com', configKey: 'PROD' },
  dev: { api: 'https://api-dev.together-working.com', configKey: 'DEV' },
};
const TODOS = '/v2/admin/todos';
const ADMINS = '/v2/admin/admins';
// Firebase 웹 apiKey 는 앱 설정 한 곳에서 읽는다(공개 식별자 — 사본을 두지 않게).
const FIREBASE_CONFIG = path.join(__dirname, '..', 'apps', 'desktop', 'app', 'parts', 'firebase-config.js');
const SIGN_IN_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword';
const REFRESH_URL = 'https://securetoken.googleapis.com/v1/token';

// 서버 AdminTodo · AdminTodoContent 와 같다.
const ID_RE = /^[A-Za-z0-9_-]{1,36}$/;
const TITLE_MAX = 120;
const MEMO_MAX = 2000;
const NAME_MAX = 40;
const REPORT_RE = /^B-[0-9]{4}-[0-9]{1,6}$/;
const REPORTS_MAX = 30;
const RELEASE_RE = /^\d+\.\d+\.\d+(-[a-z]+\.\d+)?$/;
const PAGE_MAX = 200;
const STATUS = { todo: '할 일', doing: '진행 중', done: '완료' };
const TYPES = { feat: '🆕', bug: '🐞' };
// ID 토큰이 이만큼 안 남았으면 미리 새로 받는다(요청 도중 만료되지 않게).
const TOKEN_SKEW_MS = 60e3;
// 세션 시작 훅은 3초 안에 끝나야 한다 — 넘으면 조용히 그만둔다.
const BRIEF_MS = 2800;
const NOT_ADMIN = '관리자 계정만 쓸 수 있어요 — 웹 관리자에 들어가는 계정의 친구 코드로 node scripts/todo.js setup 해 주세요';
const NEED_SETUP = '먼저 관리자 계정으로 로그인해 주세요 — node scripts/todo.js setup';

class TodoError extends Error {}

/* ═══ 순수 함수 — checks/sim-todo-cli.js 가 그대로 부른다 ═══ */

/** 서버 할 일 한 줄 → 화면 줄. 약속과 다른 칸은 짐작으로 채우지 않고 던진다(웹 toTodoRow 와 같은 기준). */
function toTodo(w){
  const bad = (f) => new TodoError(`서버 응답 모양이 달라요 — 할 일 ${w && w.todoId} 의 ${f}`);
  if(!w || typeof w !== 'object' || typeof w.todoId !== 'string') throw bad('todoId');
  if(typeof w.title !== 'string') throw bad('title');
  if(!Object.hasOwn(STATUS, w.status)) throw bad('status');
  if(w.type !== null && !Object.hasOwn(TYPES, w.type)) throw bad('type');
  for(const k of ['memo', 'assignee', 'assigneeName', 'release']) if(w[k] !== null && typeof w[k] !== 'string') throw bad(k);
  if(!Array.isArray(w.reports) || w.reports.some(r => typeof r !== 'string')) throw bad('reports');
  if(!Number.isInteger(w.version)) throw bad('version');
  const updatedAt = Date.parse(w.updatedAt);
  if(!Number.isFinite(updatedAt)) throw bad('updatedAt');
  return {
    id: w.todoId,
    title: w.title,
    memo: w.memo ?? '',
    status: w.status,
    type: w.type,
    assignee: w.assignee,
    assigneeName: w.assigneeName ?? '',
    reports: w.reports,
    release: w.release ?? '',
    updatedAt,
    version: w.version,
  };
}

/** 할 일 쪽 → { items, nextCursor, counts }. counts 는 첫 쪽에만 있다. */
function toPage(w){
  if(!w || typeof w !== 'object' || !Array.isArray(w.items)) throw new TodoError('서버 응답 모양이 달라요 — 할 일 쪽의 items');
  if(w.nextCursor !== null && typeof w.nextCursor !== 'string') throw new TodoError('서버 응답 모양이 달라요 — 할 일 쪽의 nextCursor');
  return { items: w.items.map(toTodo), nextCursor: w.nextCursor, counts: w.counts ?? null };
}

const RELEASE_HINT = '릴리스 버전은 0.13.1 · 0.14.0-beta.1 모양으로 적어 주세요';

/** start 의 본문(POST) — 상태 «진행 중» · 작업자는 나. requestId 는 다시 보내도 한 건만 생기게. */
function startBody(o, me, requestId = crypto.randomUUID()){
  const title = String(o.title || '').trim();
  if(!title) throw new TodoError('제목을 적어 주세요 — start "제목" --type bug');
  if(title.length > TITLE_MAX) throw new TodoError(`제목은 ${TITLE_MAX}자까지예요 (지금 ${title.length}자)`);
  if(!Object.hasOwn(TYPES, o.type)) throw new TodoError('--type feat 또는 bug 를 붙여 주세요 (새 기능 feat · 버그 수정 bug)');
  const memo = String(o.memo || '').trim();
  if(memo.length > MEMO_MAX) throw new TodoError(`메모는 ${MEMO_MAX}자까지예요`);
  const reports = [...new Set(o.reports || [])];
  const bad = reports.find(r => !REPORT_RE.test(r));
  if(bad) throw new TodoError(`제보 번호 모양이 틀려요: ${bad} (B-MMDD-n — 웹 관리자 🐞 제보에 보이는 고정 번호)`);
  if(reports.length > REPORTS_MAX) throw new TodoError(`제보는 ${REPORTS_MAX}개까지예요`);
  const release = String(o.release || '').trim();
  if(release && !RELEASE_RE.test(release)) throw new TodoError(RELEASE_HINT);
  const name = String(me.name || '').trim().slice(0, NAME_MAX);
  return {
    requestId,
    title,
    memo: memo || null,
    status: 'doing',
    type: o.type,
    assignee: me.uid,
    assigneeName: name || null,
    reports,
    release: release || null,
  };
}

/**
 * done 의 본문(PATCH) — 서버는 칸 묶음을 통째로 받으니 지금 값을 그대로 싣고 상태 · 버전 · 메모만 바꾼다.
 * 메모는 덮지 않고 뒤에 한 줄 덧붙인다(남이 적어 둔 것을 지우지 않게). version 은 읽은 값 — 남이 먼저 고쳤으면 409.
 */
function doneBody(t, o){
  const release = String(o.release || '').trim();
  if(release && !RELEASE_RE.test(release)) throw new TodoError(RELEASE_HINT);
  let memo = t.memo;
  const add = String(o.memo || '').trim();
  // 같은 줄이 이미 있으면(같은 명령을 두 번) 다시 붙이지 않는다.
  if(add && !memo.split('\n').includes(add)){
    memo = memo ? memo + '\n' + add : add;
    if(memo.length > MEMO_MAX) throw new TodoError(`메모가 ${MEMO_MAX}자를 넘어요 — 덧붙일 메모를 줄여 주세요`);
  }
  return {
    version: t.version,
    title: t.title,
    memo: memo || null,
    status: 'done',
    type: t.type,
    assignee: t.assignee,
    assigneeName: t.assignee ? (t.assigneeName || null) : null,
    reports: t.reports,
    release: release || t.release || null,
  };
}

/** 이미 완료 · 같은 버전 · 같은 메모면 보낼 것이 없다. */
const doneIsNoop = (t, body) => t.status === 'done' && (t.release || null) === body.release && (t.memo || null) === body.memo;

/** list 거르기 → 쿼리(거르기는 서버가 한다). 기본은 완료 빼고. */
function listQuery(f){
  const q = {};
  if(f.doing) q.status = 'doing';
  else if(!f.all) q.status = 'todo,doing';
  if(f.mine) q.assignee = 'me';
  return q;
}

/** 낱말 나누기 — 공백 · 쉼표. 대소문자 무시. */
const words = (q) => String(q || '').toLowerCase().split(/[\s,]+/).filter(Boolean);

const ORDER = { doing: 0, todo: 1, done: 2 };
/** 겹치는 할 일 찾기 — 낱말이 제목 · 메모 · 제보 번호에 몇 개 들어 있나. 많이 맞은 것 · 안 끝난 것 먼저. */
function findTodos(list, q){
  const ws = words(q);
  if(!ws.length) return [];
  return list.map(t => {
    const hay = [t.title, t.memo, ...t.reports].join('\n').toLowerCase();
    return { t, hits: ws.filter(w => hay.includes(w)).length };
  }).filter(x => x.hits > 0)
    .sort((a, b) => b.hits - a.hits || ORDER[a.t.status] - ORDER[b.t.status] || b.t.updatedAt - a.t.updatedAt)
    .map(x => x.t);
}

const ymd = (ms) => {
  if(!ms) return '';
  const d = new Date(ms + 9 * 3600e3);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
};

const who = (t, names, meUid) => t.assignee ? (t.assignee === meUid ? '나' : (names[t.assignee] || t.assigneeName || '관리자')) : '작업자 없음';

/** 한 줄 — 🆕 [진행 중] 제목 · 작업자 · 0.13.1 · 11/23 · id */
function line(t, names, meUid){
  const badge = TYPES[t.type] || '·';
  return [`${badge} [${STATUS[t.status]}] ${t.title}`, who(t, names, meUid), t.release || null, ymd(t.updatedAt), t.id].filter(Boolean).join(' · ');
}

/** 세션 시작 요약 — 진행 중만. 없으면 한 줄. */
function briefText(list, names, meUid){
  const doing = list.filter(t => t.status === 'doing');
  if(!doing.length) return '📋 진행 중인 할 일 없음 — 작업을 시작하면 /todo 로 등록해 주세요';
  const rows = doing.slice(0, 15).map(t =>
    `- ${TYPES[t.type] || '·'} ${t.title} · ${who(t, names, meUid)}${t.release ? ' · ' + t.release : ''} (${t.id})`);
  if(doing.length > rows.length) rows.push(`- … 외 ${doing.length - rows.length}건 (node scripts/todo.js list --doing)`);
  return [`📋 진행 중인 할 일 ${doing.length}건 — 같은 일을 시작하기 전에 확인 (/todo)`].concat(rows).join('\n');
}

/** 인자 — 값 있는 옵션 · 여러 번 받는 옵션 · 켜기 옵션. */
function parseArgs(argv){
  const VALUE = ['--memo', '--report', '--release', '--type'];
  const out = { cmd: argv[0] || 'help', pos: [], reports: [], flags: new Set() };
  for(let i = 1; i < argv.length; i++){
    const a = argv[i];
    if(VALUE.includes(a)){
      const v = argv[i + 1];
      if(v === undefined || v.startsWith('--')) throw new TodoError(`${a} 뒤에 값을 적어 주세요`);
      i++;
      if(a === '--report') out.reports.push(v);
      else out[a.slice(2)] = v;
    } else if(a.startsWith('--')) out.flags.add(a.slice(2));
    else out.pos.push(a);
  }
  return out;
}

/** 저장된 ID 토큰을 그대로 써도 되나(만료 TOKEN_SKEW_MS 전까지). */
const tokenFresh = (auth, now = Date.now()) => !!auth && typeof auth.idToken === 'string' && Number(auth.idTokenExp) - TOKEN_SKEW_MS > now;

/** 저장 파일 → 쓸 수 있는 모양이면 그대로, 아니면 null. */
function toAuth(v){
  if(!v || typeof v !== 'object') return null;
  if(typeof v.uid !== 'string' || !v.uid || typeof v.refreshToken !== 'string' || !v.refreshToken) return null;
  return { uid: v.uid, name: typeof v.name === 'string' ? v.name : '', code: typeof v.code === 'string' ? v.code : '',
    refreshToken: v.refreshToken, idToken: typeof v.idToken === 'string' ? v.idToken : null, idTokenExp: Number(v.idTokenExp) || 0 };
}

/** 응답 봉투 `{ success, data, code, message }` → data, 실패면 알아들을 말로 던진다. */
function unwrap(status, body){
  if(body && body.success === true) return body.data;
  const code = body && body.code;
  if(status === 401) throw new TodoError('로그인이 풀렸어요 — node scripts/todo.js setup 을 다시 해 주세요');
  if(status === 403) throw new TodoError(NOT_ADMIN);
  if(status === 409) throw new TodoError('방금 다른 사람이 이 할 일을 바꿨어요 — 다시 실행해 주세요');
  if(code === 'OPS_TODO_NOT_FOUND') throw new TodoError('그 할 일이 없어요 — node scripts/todo.js find <낱말> 로 찾아보세요');
  throw new TodoError(`API 가 거절했어요 (${status}${code ? ' ' + code : ''}) ${String((body && body.message) || '').slice(0, 200)}`);
}

/* ═══ 밖과 닿는 곳 — 로그인 파일 · Firebase Auth REST · API ═══ */

function authFile(env){
  if(process.env.TW_TODO_AUTH) return process.env.TW_TODO_AUTH;
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(base, 'tw-todo', `auth-${env}.json`);
}

function readAuth(env){
  try { return toAuth(JSON.parse(fs.readFileSync(authFile(env), 'utf8'))); } catch(_){ return null; }
}

/** 600 으로 새 파일에 쓰고 바꿔 끼운다(쓰다 끊겨도 반쪽 파일이 남지 않게 · 처음부터 남이 못 읽게). */
function writeAuth(env, auth){
  const file = authFile(env);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(auth, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(tmp, file);
  fs.chmodSync(file, 0o600);
  return file;
}

function apiKey(env){
  if(process.env.TW_TODO_FIREBASE_KEY) return process.env.TW_TODO_FIREBASE_KEY;
  const src = fs.readFileSync(FIREBASE_CONFIG, 'utf8');
  const m = new RegExp(`const ${ENVS[env].configKey}\\s*=\\s*\\{[^}]*?apiKey:\\s*"([^"]+)"`).exec(src);
  if(!m) throw new TodoError(`Firebase apiKey 를 못 찾았어요 (${path.relative(process.cwd(), FIREBASE_CONFIG)})`);
  return m[1];
}

async function postJson(url, body, timeoutMs, form){
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' },
      body: form ? new URLSearchParams(body).toString() : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch(_){ throw new TodoError('로그인 서버에 닿지 못했어요 — 인터넷 연결을 확인해 주세요'); }
  return { status: res.status, body: await res.json().catch(() => null) };
}

/** 친구 코드 + 비밀번호 → 로그인(앱과 같은 이메일 모양 `{코드 소문자}@tw.local`). */
async function signIn(env, code, password, timeoutMs){
  const r = await postJson(`${SIGN_IN_URL}?key=${encodeURIComponent(apiKey(env))}`,
    { email: code.toLowerCase() + '@tw.local', password, returnSecureToken: true }, timeoutMs);
  if(r.status !== 200 || !r.body || !r.body.idToken) throw new TodoError('친구 코드나 비밀번호가 맞지 않아요');
  return { uid: r.body.localId, idToken: r.body.idToken, refreshToken: r.body.refreshToken,
    idTokenExp: Date.now() + Number(r.body.expiresIn || 3600) * 1000 };
}

/** refresh token → 새 ID 토큰. 끊겼으면(비밀번호 바꿈 · 계정 끊김) setup 을 다시. */
async function refresh(env, auth, timeoutMs){
  const r = await postJson(`${REFRESH_URL}?key=${encodeURIComponent(apiKey(env))}`,
    { grant_type: 'refresh_token', refresh_token: auth.refreshToken }, timeoutMs, true);
  if(r.status !== 200 || !r.body || !r.body.id_token) throw new TodoError('로그인이 풀렸어요 — node scripts/todo.js setup 을 다시 해 주세요');
  if(r.body.user_id !== auth.uid) throw new TodoError('저장된 로그인의 계정이 달라요 — node scripts/todo.js setup 을 다시 해 주세요');
  const next = { ...auth, idToken: r.body.id_token, refreshToken: r.body.refresh_token || auth.refreshToken,
    idTokenExp: Date.now() + Number(r.body.expires_in || 3600) * 1000 };
  writeAuth(env, next);
  return next;
}

function makeApi(env, timeoutMs, token){
  const base = process.env.TW_TODO_API || ENVS[env].api;
  async function call(method, p, { query, body } = {}){
    const qs = query ? '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])) : '';
    const headers = { Authorization: 'Bearer ' + await token() };
    if(body !== undefined) headers['Content-Type'] = 'application/json';
    let res;
    try {
      res = await fetch(base + p + qs, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch(_){ throw new TodoError(`API 에 닿지 못했어요 (${base}) — 인터넷 연결 · 서버 상태를 확인해 주세요`); }
    return unwrap(res.status, await res.json().catch(() => null));
  }
  return {
    get: (p, query) => call('GET', p, { query }),
    post: (p, body) => call('POST', p, { body }),
    patch: (p, body) => call('PATCH', p, { body }),
  };
}

/** 명령마다 — 저장된 로그인으로 ID 토큰(필요할 때 한 번만 새로). */
function session(env, timeoutMs){
  const auth = readAuth(env);
  let cur = auth;
  let pending = null;
  const token = async () => {
    if(!cur) throw new TodoError(NEED_SETUP);
    if(tokenFresh(cur)) return cur.idToken;
    pending = pending || refresh(env, cur, timeoutMs).then(a => (cur = a));
    return (await pending).idToken;
  };
  return { me: auth, api: makeApi(env, timeoutMs, token) };
}

/** 쪽을 끝까지 이어 받는다(할 일은 몇십~몇백 건). 첫 쪽의 counts 도 같이. */
async function fetchAll(api, query){
  const items = [];
  let cursor = null, counts = null, first = true;
  do {
    const page = toPage(await api.get(TODOS, { ...query, cursor, limit: PAGE_MAX }));
    if(first) counts = page.counts;
    first = false;
    items.push(...page.items);
    cursor = page.nextCursor;
  } while(cursor);
  return { items, counts };
}

async function adminNames(api){
  const rows = await api.get(ADMINS).catch(() => null);
  const out = {};
  if(Array.isArray(rows)) for(const r of rows) if(r && typeof r.authUid === 'string' && typeof r.name === 'string') out[r.authUid] = r.name;
  return out;
}

function needMe(s){
  if(!s.me) throw new TodoError(NEED_SETUP);
  return s.me;
}

/** 터미널에서 한 줄 묻기 — hidden 이면 친 글자를 보이지 않는다. */
function ask(question, hidden){
  if(!process.stdin.isTTY) throw new TodoError('setup 은 터미널에서 직접 실행해 주세요(비밀번호를 묻습니다)');
  return new Promise((resolve) => {
    const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if(hidden) rl._writeToOutput = (s) => { if(s.startsWith(question)) process.stdout.write(question); };
    rl.question(question, (a) => { rl.close(); if(hidden) process.stdout.write('\n'); resolve(a.trim()); });
  });
}

/* ═══ 명령 ═══ */

async function cmdSetup(env, o){
  const code = o.pos[0] || await ask('친구 코드: ');
  if(!code) throw new TodoError('친구 코드를 적어 주세요');
  const password = await ask('비밀번호(보이지 않음): ', true);
  if(!password) throw new TodoError('비밀번호를 적어 주세요');
  const login = await signIn(env, code, password, 15000);
  const api = makeApi(env, 15000, async () => login.idToken);
  const me = await api.get(`${ADMINS}/me`);   // 관리자가 아니면 403 → NOT_ADMIN · 저장하지 않는다
  const name = me && typeof me.name === 'string' ? me.name : '';
  const file = writeAuth(env, { uid: login.uid, name, code: code.toLowerCase(), ...login });
  console.log(`✓ 로그인을 저장했어요: ${name || code} (${file} — 권한 600 · 저장소 밖 · 비밀번호는 저장 안 함)`);
}

async function cmdList(env, o){
  const s = session(env, 15000);
  const f = { mine: o.flags.has('mine'), doing: o.flags.has('doing'), all: o.flags.has('all') };
  const [{ items, counts }, names] = await Promise.all([fetchAll(s.api, listQuery(f)), adminNames(s.api)]);
  const meUid = s.me && s.me.uid;
  if(!items.length) console.log('해당하는 할 일이 없어요');
  for(const t of items) console.log(line(t, names, meUid));
  if(!f.all && !f.doing && counts && counts.done) console.log(`(완료 ${counts.done}건은 --all 로)`);
}

async function cmdFind(env, o){
  const q = o.pos.join(' ');
  if(!words(q).length) throw new TodoError('찾을 낱말을 적어 주세요 — find 채팅 이모티콘');
  const s = session(env, 15000);
  const [{ items }, names] = await Promise.all([fetchAll(s.api, {}), adminNames(s.api)]);
  const hits = findTodos(items, q);
  if(!hits.length) return console.log(`«${q}» — 겹치는 할 일 없음`);
  console.log(`«${q}» — 겹칠 수 있는 할 일 ${hits.length}건:`);
  for(const t of hits.slice(0, 20)) console.log('  ' + line(t, names, s.me && s.me.uid));
}

async function cmdStart(env, o){
  const s = session(env, 15000);
  const me = needMe(s);
  const body = startBody({ title: o.pos.join(' '), type: o.type, memo: o.memo, reports: o.reports, release: o.release }, me);
  if(o.flags.has('dry-run')){
    console.log(`(미리 보기 — 보내지 않음)\nPOST ${TODOS}`);
    return console.log(JSON.stringify(body, null, 2));
  }
  const t = toTodo(await s.api.post(TODOS, body));
  console.log(`✓ 등록: ${TYPES[t.type]} ${t.title} (진행 중 · ${me.name || '나'})`);
  console.log(`  id: ${t.id}  ← PR 본문에 «할 일: ${t.id}» · 머지되면 node scripts/todo.js done ${t.id} --release <버전>`);
}

async function cmdDone(env, o){
  const s = session(env, 15000);
  needMe(s);
  const id = o.pos[0];
  if(!id || !ID_RE.test(id)) throw new TodoError('할 일 id 를 적어 주세요 — done <id> --release 0.13.1');
  const t = toTodo(await s.api.get(`${TODOS}/${id}`));
  const body = doneBody(t, { release: o.release, memo: o.memo });
  if(doneIsNoop(t, body)) return console.log('이미 완료돼 있어요 — 바꿀 것이 없어요');
  if(!body.release) console.error('(릴리스 버전 없이 완료 — 실려 나갈 버전을 알면 --release 0.13.1 을 붙여 주세요)');
  if(o.flags.has('dry-run')){
    console.log(`(미리 보기 — 보내지 않음)\nPATCH ${TODOS}/${id}`);
    return console.log(JSON.stringify(body, null, 2));
  }
  const done = toTodo(await s.api.patch(`${TODOS}/${id}`, body));
  console.log(`✓ 완료: ${done.title}${done.release ? ' · ' + done.release : ''}`);
}

async function cmdBrief(env, timeoutMs){
  const s = session(env, timeoutMs);
  if(!s.me) return;   // setup 안 한 사람(관리자가 아님)은 조용히
  const [{ items }, names] = await Promise.all([fetchAll(s.api, { status: 'doing' }), adminNames(s.api)]);
  console.log(briefText(items, names, s.me.uid));
}

const HELP = `할 일 — 겹치지 않게 확인 · 등록 · 완료
  node scripts/todo.js setup [<친구 코드>]          처음 한 번: 관리자 계정으로 로그인(비밀번호를 묻는다)
  node scripts/todo.js brief                        진행 중인 할 일 요약
  node scripts/todo.js list [--mine] [--doing] [--all]
  node scripts/todo.js find <낱말...>               겹치는 일 찾기
  node scripts/todo.js start "<제목>" --type feat|bug [--memo ..] [--report B-MMDD-n] [--release x.y.z] [--dry-run]
  node scripts/todo.js done <id> [--release x.y.z] [--memo ..] [--dry-run]
  --dev 를 붙이면 dev API.`;

async function main(argv){
  const brief = argv[0] === 'brief';
  // 세션 시작 훅 — 어떤 실패든 조용히 · 늦으면 그냥 끝낸다(관리자가 아닌 사람 · 오프라인에서 훅이 걸리지 않게).
  if(brief) setTimeout(() => process.exit(0), BRIEF_MS).unref();
  try {
    const o = parseArgs(argv);
    const env = o.flags.has('dev') ? 'dev' : 'prod';
    if(brief) return await cmdBrief(env, BRIEF_MS - 300);
    const run = { setup: cmdSetup, list: cmdList, find: cmdFind, start: cmdStart, done: cmdDone }[o.cmd];
    if(!run){ console.log(HELP); return; }
    await run(env, o);
  } catch(e){
    if(brief) return;
    console.error('✗ ' + (e instanceof TodoError ? e.message : (e && e.stack) || e));
    process.exitCode = 1;
  }
}

if(require.main === module) main(process.argv.slice(2));

module.exports = {
  ENVS, TITLE_MAX, MEMO_MAX, RELEASE_RE, REPORT_RE, TYPES, STATUS, TodoError,
  toTodo, toPage, startBody, doneBody, doneIsNoop, listQuery, words, findTodos, briefText, line, parseArgs,
  tokenFresh, toAuth, unwrap, authFile, writeAuth, apiKey, main,
};
