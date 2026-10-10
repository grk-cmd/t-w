#!/usr/bin/env node
/* ═══ 📋 scripts/todo.js — 관리자 «할 일»(adminTodos)을 터미널 · Claude Code 에서 ═══
   같이 일하는 사람들이 같은 일을 겹쳐 하지 않게 — 작업 전에 찾아보고(find · brief), 시작할 때 등록(start),
   머지되면 완료 + 릴리스 버전(done). 웹 관리자 📋 할 일 화면과 같은 데이터다. 앱에 실리지 않는 관리용 도구.

   node scripts/todo.js setup [<uid 또는 이름>]     내 관리자 uid 를 이 컴퓨터에 저장(.claude/todo-me.json · 커밋 안 함)
   node scripts/todo.js brief                       진행 중인 할 일 한 화면(세션 시작 훅) — 실패하면 아무것도 안 찍음
   node scripts/todo.js list [--mine] [--doing] [--all]
   node scripts/todo.js find <낱말...>              제목 · 메모에서 찾기(대소문자 무시) — 겹치는 일 확인
   node scripts/todo.js start "<제목>" --type feat|bug [--memo ..] [--report <제보 id>]... [--release x.y.z] [--dry-run]
   node scripts/todo.js done <id> [--release x.y.z] [--memo ..] [--dry-run]
   어느 명령이든 --dev 를 붙이면 dev DB(together-working-dev).

   권한: `gcloud auth login` 한 관리자 Google 계정의 토큰(`gcloud auth print-access-token`)으로 REST 를 부른다.
   이 길은 보안 규칙을 거치지 않는다 — 그래서 규칙 adminTodos/$id 가 하던 검사(모양 · rev + 1 · 만든 사람/시각 고정 ·
   서버 시각)를 이 파일이 똑같이 하고, 덮어쓰기는 ETag(if-match)로 «읽은 값 그대로일 때만» 쓴다.
   모양은 web-admin/src/entities/admin/todo/model/adminTodo.ts 와 같아야 한다. */
'use strict';
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');

const DB_URLS = {
  prod: 'https://together-working-default-rtdb.asia-southeast1.firebasedatabase.app',
  dev: 'https://together-working-dev-default-rtdb.asia-southeast1.firebasedatabase.app',
};
const TODO_ROOT = 'adminTodos';
const NAMES_ROOT = 'adminNames';
const LOG_ROOT = 'adminLog';
const ME_FILE = 'todo-me.json';

// 규칙 adminTodos/$id 와 같다.
const ID_RE = /^[A-Za-z0-9_-]{1,32}$/;
const TITLE_MAX = 120;
const MEMO_MAX = 2000;
const NAME_MAX = 40;
const REPORT_ID_RE = /^[A-Za-z0-9_-]{20}$/;
const REPORTS_MAX = 30;
const RELEASE_RE = /^\d+\.\d+\.\d+(-[a-z]+\.\d+)?$/;
const RELEASE_MAX = 20;
const STATUS = { todo: '할 일', doing: '진행 중', done: '완료' };
const TYPES = { feat: '🆕', bug: '🐞' };
const KEYS = ['title', 'memo', 'status', 'type', 'assignee', 'assigneeName', 'reports', 'release',
  'createdBy', 'createdAt', 'updatedBy', 'updatedAt', 'rev'];
const REQUIRED = ['title', 'status', 'createdBy', 'createdAt', 'updatedBy', 'updatedAt', 'rev'];
// 규칙 adminLog — target 60자 · detail 120자.
const LOG_TARGET_MAX = 60;
const LOG_DETAIL_MAX = 120;
const SERVER_TIME = Object.freeze({ '.sv': 'timestamp' });
const isServerTime = (v) => !!v && typeof v === 'object' && v['.sv'] === 'timestamp';
// 세션 시작 훅은 3초 안에 끝나야 한다 — 넘으면 조용히 그만둔다.
const BRIEF_MS = 2800;
const NOT_ADMIN = '관리자 계정만 쓸 수 있어요 — gcloud auth login 으로 관리자 Google 계정에 로그인해 주세요';

class TodoError extends Error {}

/* ═══ 순수 함수 — checks/sim-todo-cli.js 가 그대로 부른다 ═══ */

const newId = (now = Date.now(), rnd = Math.random) => 't' + now.toString(36) + rnd().toString(36).slice(2, 8);

/** 읽은 값 → 할 일 한 건(웹 toTodo 와 같은 기준). 모양이 틀리면 null. */
function toTodo(id, v){
  if(!v || typeof v !== 'object') return null;
  if(typeof v.title !== 'string' || typeof v.rev !== 'number' || !Object.hasOwn(STATUS, v.status)) return null;
  return {
    id,
    title: v.title,
    memo: typeof v.memo === 'string' ? v.memo : '',
    status: v.status,
    type: Object.hasOwn(TYPES, v.type) ? v.type : '',
    assignee: typeof v.assignee === 'string' ? v.assignee : null,
    assigneeName: typeof v.assigneeName === 'string' ? v.assigneeName : '',
    reports: v.reports && typeof v.reports === 'object' ? Object.keys(v.reports).filter(k => REPORT_ID_RE.test(k)) : [],
    release: typeof v.release === 'string' && RELEASE_RE.test(v.release) ? v.release : '',
    createdBy: String(v.createdBy ?? ''),
    createdAt: typeof v.createdAt === 'number' ? v.createdAt : 0,
    updatedBy: String(v.updatedBy ?? ''),
    updatedAt: typeof v.updatedAt === 'number' ? v.updatedAt : 0,
    rev: v.rev,
  };
}

const ORDER = { doing: 0, todo: 1, done: 2 };
function toTodos(raw){
  if(!raw || typeof raw !== 'object') return [];
  return Object.entries(raw).map(([id, v]) => toTodo(id, v)).filter(Boolean)
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || b.updatedAt - a.updatedAt || (a.id < b.id ? -1 : 1));
}

/**
 * 쓸 값이 규칙 adminTodos/$id 를 통과하는지 — 문제가 있으면 그 이유, 없으면 null.
 * prev 는 지금 서버 값(새로 만들면 null). 서버 시각 자리는 {".sv":"timestamp"} 여야 한다.
 */
function checkValue(id, v, prev, me){
  if(!ID_RE.test(id)) return 'id 모양이 틀림';
  if(!v || typeof v !== 'object') return '값이 없음';
  for(const k of Object.keys(v)) if(!KEYS.includes(k)) return `모르는 칸: ${k}`;
  for(const k of REQUIRED) if(v[k] === undefined) return `빠진 칸: ${k}`;
  if(typeof v.title !== 'string' || !v.title.length || v.title.length > TITLE_MAX) return `제목은 1~${TITLE_MAX}자`;
  if(v.memo !== undefined && (typeof v.memo !== 'string' || !v.memo.length || v.memo.length > MEMO_MAX)) return `메모는 1~${MEMO_MAX}자`;
  if(!Object.hasOwn(STATUS, v.status)) return '상태는 todo · doing · done';
  if(v.type !== undefined && !Object.hasOwn(TYPES, v.type)) return '종류는 feat · bug';
  if(v.assignee !== undefined && (typeof v.assignee !== 'string' || !v.assignee)) return '작업자 uid 가 틀림';
  if(v.assigneeName !== undefined){
    if(typeof v.assigneeName !== 'string' || !v.assigneeName.length || v.assigneeName.length > NAME_MAX) return `작업자 이름은 1~${NAME_MAX}자`;
    if(v.assignee === undefined) return '작업자 이름만 있고 작업자가 없음';
  }
  if(v.reports !== undefined){
    if(!v.reports || typeof v.reports !== 'object') return '제보 칸 모양이 틀림';
    const ids = Object.keys(v.reports);
    if(ids.some(r => !REPORT_ID_RE.test(r) || v.reports[r] !== true)) return '제보 id 모양이 틀림';
    if(ids.length > REPORTS_MAX) return `제보는 ${REPORTS_MAX}개까지`;
  }
  if(v.release !== undefined && (typeof v.release !== 'string' || v.release.length > RELEASE_MAX || !RELEASE_RE.test(v.release))) return '릴리스 버전은 0.11.3 · 0.12.0-beta.1 모양으로';
  if(typeof v.createdBy !== 'string' || v.createdBy.length > 128) return '만든 사람이 틀림';
  if(v.updatedBy !== me) return '고친 사람은 나여야 함';
  if(!isServerTime(v.updatedAt)) return '고친 시각은 서버 시각이어야 함';
  if(!Number.isInteger(v.rev) || v.rev < 0) return 'rev 가 틀림';
  if(prev){
    if(v.rev !== prev.rev + 1) return 'rev 는 지금 값 + 1 이어야 함';
    if(v.createdBy !== prev.createdBy || v.createdAt !== prev.createdAt) return '만든 사람 · 시각은 바꿀 수 없음';
  } else {
    if(v.rev !== 0) return '새 할 일은 rev 0';
    if(v.createdBy !== me) return '새 할 일은 내가 만든 것이어야 함';
    if(!isServerTime(v.createdAt)) return '만든 시각은 서버 시각이어야 함';
  }
  return null;
}

/** start 의 값 — 상태 «진행 중» · 작업자는 나. */
function startValue(o, me){
  const title = String(o.title || '').trim();
  if(!title) throw new TodoError('제목을 적어 주세요 — start "제목" --type feat');
  if(title.length > TITLE_MAX) throw new TodoError(`제목은 ${TITLE_MAX}자까지예요 (지금 ${title.length}자)`);
  if(!Object.hasOwn(TYPES, o.type)) throw new TodoError('--type feat 또는 bug 를 붙여 주세요 (새 기능 feat · 버그 수정 bug)');
  const memo = String(o.memo || '').trim();
  if(memo.length > MEMO_MAX) throw new TodoError(`메모는 ${MEMO_MAX}자까지예요`);
  const reports = [...new Set(o.reports || [])];
  const bad = reports.find(r => !REPORT_ID_RE.test(r));
  if(bad) throw new TodoError(`제보 id 모양이 틀려요: ${bad} (20자 — 웹 관리자 제보 주소 끝)`);
  const release = String(o.release || '').trim();
  if(release && !RELEASE_RE.test(release)) throw new TodoError('릴리스 버전은 0.11.3 · 0.12.0-beta.1 모양으로 적어 주세요');
  const name = String(me.name || '').trim().slice(0, NAME_MAX);
  return {
    title,
    ...(memo ? { memo } : {}),
    status: 'doing',
    type: o.type,
    assignee: me.uid,
    ...(name ? { assigneeName: name } : {}),
    ...(reports.length ? { reports: Object.fromEntries(reports.map(r => [r, true])) } : {}),
    ...(release ? { release } : {}),
    createdBy: me.uid,
    createdAt: SERVER_TIME,
    updatedBy: me.uid,
    updatedAt: SERVER_TIME,
    rev: 0,
  };
}

/**
 * done 의 값 — 지금 서버 값(raw)을 그대로 두고 상태 · 버전 · 메모만, rev + 1.
 * 메모는 덮지 않고 뒤에 한 줄 덧붙인다(남이 적어 둔 것을 지우지 않게).
 */
function doneValue(raw, o, me){
  const release = String(o.release || '').trim();
  if(release && !RELEASE_RE.test(release)) throw new TodoError('릴리스 버전은 0.11.3 · 0.12.0-beta.1 모양으로 적어 주세요');
  const out = {};
  for(const k of KEYS) if(raw[k] !== undefined) out[k] = raw[k];
  const add = String(o.memo || '').trim();
  // 같은 줄이 이미 있으면(같은 명령을 두 번) 다시 붙이지 않는다.
  if(add && !String(out.memo || '').split('\n').includes(add)){
    const memo = out.memo ? out.memo + '\n' + add : add;
    if(memo.length > MEMO_MAX) throw new TodoError(`메모가 ${MEMO_MAX}자를 넘어요 — 덧붙일 메모를 줄여 주세요`);
    out.memo = memo;
  }
  out.status = 'done';
  if(release) out.release = release;
  out.updatedBy = me.uid;
  out.updatedAt = SERVER_TIME;
  out.rev = raw.rev + 1;
  return out;
}

/** 무엇이 바뀌었나 — 작업 기록 detail(웹 todoChanges 와 같은 말). */
function changeText(prev, v){
  if(!prev){
    const parts = [STATUS[v.status], `작업자 ${v.assigneeName || '나'}`];
    if(v.reports) parts.push(`제보 ${Object.keys(v.reports).length}건`);
    if(v.release) parts.push(`릴리스 ${v.release}`);
    return parts.join(' · ') + ' · 터미널';
  }
  const out = [];
  if(prev.status !== v.status) out.push(`${STATUS[prev.status]} → ${STATUS[v.status]}`);
  if((prev.memo || '') !== (v.memo || '')) out.push('메모');
  if((prev.release || '') !== (v.release || '')) out.push(`릴리스 ${prev.release || '없음'} → ${v.release || '없음'}`);
  return (out.join(' · ') || '변경 없음') + ' · 터미널';
}

function logEntry(action, target, detail, me, now = Date.now(), rnd = Math.random){
  const id = 'a' + now.toString(36) + rnd().toString(36).slice(2, 8);
  return [`${LOG_ROOT}/${id}`, {
    at: SERVER_TIME, by: me.uid, action,
    target: String(target).slice(0, LOG_TARGET_MAX),
    detail: String(detail).slice(0, LOG_DETAIL_MAX),
  }];
}

/** 낱말 나누기 — 공백 · 쉼표. 대소문자 무시. */
const words = (q) => String(q || '').toLowerCase().split(/[\s,]+/).filter(Boolean);

/** 겹치는 할 일 찾기 — 낱말이 제목 · 메모에 몇 개 들어 있나. 많이 맞은 것 · 안 끝난 것 먼저. */
function findTodos(list, q){
  const ws = words(q);
  if(!ws.length) return [];
  return list.map(t => {
    const hay = (t.title + '\n' + t.memo).toLowerCase();
    return { t, hits: ws.filter(w => hay.includes(w)).length };
  }).filter(x => x.hits > 0)
    .sort((a, b) => b.hits - a.hits || ORDER[a.t.status] - ORDER[b.t.status] || b.t.updatedAt - a.t.updatedAt)
    .map(x => x.t);
}

function filterTodos(list, f, meUid){
  return list.filter(t =>
    (f.all || f.doing || t.status !== 'done') &&
    (!f.doing || t.status === 'doing') &&
    (!f.mine || (!!meUid && t.assignee === meUid)));
}

const ymd = (ms) => {
  if(!ms) return '';
  const d = new Date(ms + 9 * 3600e3);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
};

/** 한 줄 — 🆕 [진행 중] 제목 · 작업자 · 0.11.3 · 10/10 · id */
function line(t, names, meUid){
  const who = t.assignee ? (t.assignee === meUid ? '나' : (names[t.assignee] || t.assigneeName || '관리자')) : '작업자 없음';
  const badge = TYPES[t.type] || '·';
  return [`${badge} [${STATUS[t.status]}] ${t.title}`, who, t.release || null, ymd(t.updatedAt), t.id].filter(Boolean).join(' · ');
}

/** 세션 시작 요약 — 진행 중만. 없으면 한 줄. */
function briefText(list, names, meUid){
  const doing = list.filter(t => t.status === 'doing');
  if(!doing.length) return '📋 진행 중인 할 일 없음 — 작업을 시작하면 /todo 로 등록해 주세요';
  const rows = doing.slice(0, 15).map(t => {
    const who = t.assignee ? (t.assignee === meUid ? '나' : (names[t.assignee] || t.assigneeName || '관리자')) : '작업자 없음';
    return `- ${TYPES[t.type] || '·'} ${t.title} · ${who}${t.release ? ' · ' + t.release : ''} (${t.id})`;
  });
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

/* ═══ 밖과 닿는 곳 — 토큰 · REST · 내 정보 파일 ═══ */

/** 내 정보 파일 — 워크트리에서도 같은 파일을 보게 git 공용 폴더(본 저장소) 옆 .claude/ 에 둔다. */
function meFile(){
  if(process.env.TW_TODO_ME) return process.env.TW_TODO_ME;
  const here = path.join(__dirname, '..');
  try {
    const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'],
      { cwd: here, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 1000 }).trim();
    if(common) return path.join(path.dirname(common), '.claude', ME_FILE);
  } catch(_){ /* git 이 없으면 이 저장소 */ }
  return path.join(here, '.claude', ME_FILE);
}

function readMe(){
  try {
    const v = JSON.parse(fs.readFileSync(meFile(), 'utf8'));
    return v && typeof v.uid === 'string' && v.uid ? { uid: v.uid, name: typeof v.name === 'string' ? v.name : '' } : null;
  } catch(_){ return null; }
}

function token(timeout){
  if(process.env.TW_TODO_TOKEN) return process.env.TW_TODO_TOKEN;
  try {
    return execFileSync('gcloud', ['auth', 'print-access-token'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout,
      // Windows 의 gcloud 는 gcloud.cmd — 셸을 거쳐야 찾는다.
      shell: process.platform === 'win32',
    }).trim();
  } catch(e){
    if(e.code === 'ENOENT' || /not (recognized|found)/i.test(String(e.stderr || ''))) throw new TodoError('gcloud 가 없어요 — Google Cloud CLI 를 설치하고 gcloud auth login 해 주세요 (https://cloud.google.com/sdk/docs/install)');
    throw new TodoError(NOT_ADMIN);
  }
}

function makeDb(dev, timeoutMs){
  const base = process.env.TW_TODO_DB || (dev ? DB_URLS.dev : DB_URLS.prod);
  let tok = null;
  const auth = () => (tok = tok || token(timeoutMs));
  async function call(method, p, { body, query = '', etag, ifMatch } = {}){
    const headers = { Authorization: 'Bearer ' + auth() };
    if(etag) headers['X-Firebase-ETag'] = 'true';
    if(ifMatch) headers['if-match'] = ifMatch;
    if(body !== undefined) headers['Content-Type'] = 'application/json';
    let res;
    try {
      res = await fetch(`${base}/${p}.json${query}`, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch(_){ throw new TodoError('DB 에 닿지 못했어요 — 인터넷 연결을 확인해 주세요'); }
    if(res.status === 401 || res.status === 403) throw new TodoError(NOT_ADMIN);
    if(res.status === 412) return { conflict: true };
    if(!res.ok) throw new TodoError(`DB 가 거절했어요 (${res.status}) ${(await res.text()).slice(0, 200)}`);
    return { value: await res.json(), etag: res.headers.get('etag') };
  }
  return {
    get: async (p) => (await call('GET', p)).value,
    getWithEtag: (p) => call('GET', p, { etag: true }),
    putIfMatch: (p, body, ifMatch) => call('PUT', p, { body, ifMatch }),
    patch: (p, body) => call('PATCH', p, { body }),
  };
}

async function loadAll(db){
  const [raw, names] = await Promise.all([db.get(TODO_ROOT), db.get(NAMES_ROOT).catch(() => null)]);
  const nameMap = {};
  if(names && typeof names === 'object') for(const [uid, v] of Object.entries(names)) if(v && typeof v.name === 'string') nameMap[uid] = v.name;
  return { list: toTodos(raw), names: nameMap };
}

function needMe(){
  const me = readMe();
  if(!me) throw new TodoError('먼저 내 관리자 계정을 정해 주세요 — node scripts/todo.js setup');
  return me;
}

/** 읽은 그대로일 때만 쓴다(ETag). 쓴 뒤 작업 기록은 따로 — 실패해도 할 일은 이미 저장됐다. */
async function writeTodo(db, id, value, prev, etag, me, action, dry){
  const bad = checkValue(id, value, prev, me.uid);
  if(bad) throw new TodoError('저장할 값이 규칙에 안 맞아요: ' + bad);
  const [logPath, log] = logEntry(action, value.title, changeText(prev, value), me);
  if(dry){
    console.log(`(미리 보기 — 쓰지 않음)\n${TODO_ROOT}/${id} =`);
    console.log(JSON.stringify(value, null, 2));
    console.log(`${logPath} =`, JSON.stringify(log));
    return false;
  }
  const r = await db.putIfMatch(`${TODO_ROOT}/${id}`, value, etag);
  if(r.conflict) throw new TodoError('방금 다른 사람이 이 할 일을 바꿨어요 — 다시 실행해 주세요');
  try { await db.patch('', { [logPath]: log }); }
  catch(_){ console.error('(작업 기록은 남기지 못했어요 — 할 일은 저장됨)'); }
  return true;
}

/* ═══ 명령 ═══ */

async function cmdSetup(db, o){
  const { names } = await loadAll(db);
  const want = o.pos[0];
  const pairs = Object.entries(names);
  if(!want){
    console.log('관리자 이름표(웹 관리자에서 이름을 정한 사람):');
    for(const [uid, name] of pairs) console.log(`  ${name}  ${uid}`);
    console.log('\n내 것을 골라: node scripts/todo.js setup <uid 또는 이름>');
    console.log('목록에 없으면 웹 관리자 오른쪽 위에서 이름을 먼저 정해 주세요.');
    return;
  }
  const hit = pairs.filter(([uid, name]) => uid === want || name === want);
  if(hit.length !== 1) throw new TodoError(hit.length ? `같은 이름이 여럿이에요 — uid 로 적어 주세요` : `«${want}» 를 관리자 이름표에서 못 찾았어요 — node scripts/todo.js setup 으로 목록을 보세요`);
  const [uid, name] = hit[0];
  if(await db.get(`admins/${uid}`) !== true) throw new TodoError('이 uid 는 관리자가 아니에요');
  const file = meFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ uid, name }, null, 2) + '\n');
  console.log(`✓ 저장했어요: ${name} (${file} — 커밋되지 않는 파일)`);
}

async function cmdList(db, o){
  const me = readMe();
  const { list, names } = await loadAll(db);
  const f = { mine: o.flags.has('mine'), doing: o.flags.has('doing'), all: o.flags.has('all') };
  if(f.mine && !me) throw new TodoError('--mine 은 setup 뒤에 쓸 수 있어요 — node scripts/todo.js setup');
  const rows = filterTodos(list, f, me && me.uid);
  if(!rows.length) return console.log('해당하는 할 일이 없어요');
  for(const t of rows) console.log(line(t, names, me && me.uid));
  if(!f.all && !f.doing) console.log(`(완료 ${list.filter(t => t.status === 'done').length}건은 --all 로)`);
}

async function cmdFind(db, o){
  const q = o.pos.join(' ');
  if(!words(q).length) throw new TodoError('찾을 낱말을 적어 주세요 — find 채팅 이모티콘');
  const me = readMe();
  const { list, names } = await loadAll(db);
  const hits = findTodos(list, q);
  if(!hits.length) return console.log(`«${q}» — 겹치는 할 일 없음`);
  console.log(`«${q}» — 겹칠 수 있는 할 일 ${hits.length}건:`);
  for(const t of hits.slice(0, 20)) console.log('  ' + line(t, names, me && me.uid));
}

async function cmdStart(db, o){
  const me = needMe();
  const value = startValue({ title: o.pos.join(' '), type: o.type, memo: o.memo, reports: o.reports, release: o.release }, me);
  const id = newId();
  const cur = await db.getWithEtag(`${TODO_ROOT}/${id}`);
  if(cur.value !== null) throw new TodoError('id 가 겹쳤어요 — 다시 실행해 주세요');
  const dry = o.flags.has('dry-run');
  if(await writeTodo(db, id, value, null, cur.etag, me, 'todo.create', dry)){
    console.log(`✓ 등록: ${TYPES[value.type]} ${value.title} (진행 중 · ${me.name || '나'})`);
    console.log(`  id: ${id}  ← PR 본문에 «할 일: ${id}» · 머지되면 node scripts/todo.js done ${id} --release <버전>`);
  }
}

async function cmdDone(db, o){
  const me = needMe();
  const id = o.pos[0];
  if(!id || !ID_RE.test(id)) throw new TodoError('할 일 id 를 적어 주세요 — done <id> --release 0.11.3');
  const cur = await db.getWithEtag(`${TODO_ROOT}/${id}`);
  const prev = toTodo(id, cur.value);
  if(!prev) throw new TodoError(`할 일 ${id} 가 없어요 — node scripts/todo.js find <낱말> 로 찾아보세요`);
  const value = doneValue(cur.value, { release: o.release, memo: o.memo }, me);
  if(prev.status === 'done' && (prev.release || '') === (value.release || '') && (cur.value.memo || '') === (value.memo || ''))
    return console.log('이미 완료돼 있어요 — 바꿀 것이 없어요');
  if(!value.release) console.error('(릴리스 버전 없이 완료 — 실려 나갈 버전을 알면 --release 0.11.3 을 붙여 주세요)');
  if(await writeTodo(db, id, value, cur.value, cur.etag, me, 'todo.update', o.flags.has('dry-run')))
    console.log(`✓ 완료: ${value.title}${value.release ? ' · ' + value.release : ''}`);
}

async function cmdBrief(db){
  const me = readMe();
  const { list, names } = await loadAll(db);
  console.log(briefText(list, names, me && me.uid));
}

const HELP = `할 일(adminTodos) — 겹치지 않게 확인 · 등록 · 완료
  node scripts/todo.js setup [<uid 또는 이름>]      처음 한 번: 내 관리자 계정 정하기
  node scripts/todo.js brief                        진행 중인 할 일 요약
  node scripts/todo.js list [--mine] [--doing] [--all]
  node scripts/todo.js find <낱말...>               겹치는 일 찾기
  node scripts/todo.js start "<제목>" --type feat|bug [--memo ..] [--report <제보 id>] [--release x.y.z] [--dry-run]
  node scripts/todo.js done <id> [--release x.y.z] [--memo ..] [--dry-run]
  --dev 를 붙이면 dev DB. 먼저 gcloud auth login (관리자 Google 계정).`;

async function main(argv){
  const brief = argv[0] === 'brief';
  // 세션 시작 훅 — 어떤 실패든 조용히 · 늦으면 그냥 끝낸다(관리자가 아닌 사람 · 오프라인에서 훅이 걸리지 않게).
  if(brief) setTimeout(() => process.exit(0), BRIEF_MS).unref();
  let o;
  try {
    o = parseArgs(argv);
    const db = makeDb(o.flags.has('dev'), brief ? BRIEF_MS - 300 : 15000);
    const run = { setup: cmdSetup, brief: cmdBrief, list: cmdList, find: cmdFind, start: cmdStart, done: cmdDone }[o.cmd];
    if(!run){ console.log(HELP); return; }
    await run(db, o);
  } catch(e){
    if(brief) return;
    console.error('✗ ' + (e instanceof TodoError ? e.message : (e && e.stack) || e));
    process.exitCode = 1;
  }
}

if(require.main === module) main(process.argv.slice(2));

module.exports = {
  TODO_ROOT, TITLE_MAX, MEMO_MAX, RELEASE_RE, TYPES, STATUS, SERVER_TIME, TodoError,
  newId, toTodo, toTodos, checkValue, startValue, doneValue, changeText, logEntry,
  words, findTodos, filterTodos, briefText, line, parseArgs, main,
};
