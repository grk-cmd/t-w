/* ═══ 💬 sim-chat-delete-log.js — 대화 기록 지움 남기기(functions/chat-delete-log.js · index.js chatLogDeleted · chatTabDeleted · 2026-10-19 신설) ═══
   [왜] 규칙상 대화 기록은 누구나 통째로 지울 수 있다. 방 서버 방 대화가 서버 함수 기록 없이 사라진 일(10-19 PLAY-BFBT)이 있어
     «누가 · 몇 줄» 을 남긴다. 지우기는 막지 않는다 · 대화 글은 로그에 싣지 않는다.
   ・1절: 요약 — 줄 수 · 보낸 사람 수 · 첫 · 마지막 시각 · 방장 지우기 표시 줄 · 누가(authType · authId) · 글은 안 실림
   ・2절: 트리거 — index.js 의 두 함수를 가짜 이벤트로 실제로 돌려 로그 한 줄이 찍히는지(경로 · 탭 이름)
   ・3절: 같은 값 — 표시 줄 · #일반 이름이 앱(chat-history.js · chat-tabs.js)과 같다
   [실행] 러너 스테이징(평평한 폴더) 또는 checks/ 에서. 함수 의존성은 필요 없다(2절이 가짜로 끼워 넣는다). */
'use strict';
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const DIRS = ['.', '..', 'functions', path.join('..', 'functions'), 'app', path.join('app', 'parts', 'chat'), path.join('..', 'app', 'parts', 'chat'), 'parts', path.join('parts', 'chat')];
const find = (f) => { for(const d of DIRS){ const p = path.join(d, f); if(fs.existsSync(p)) return p; } return null; };
const findFn = (f) => { for(const d of ['functions', path.join('..', 'functions')]){ const p = path.join(d, f); if(fs.existsSync(p)) return p; } return null; };
const LOG = findFn('chat-delete-log.js'), IDX = findFn('index.js'), HIST = find('chat-history.js'), TABS = find('chat-tabs.js');
for(const [n, v] of [['functions/chat-delete-log.js', LOG], ['functions/index.js', IDX], ['chat-history.js', HIST], ['chat-tabs.js', TABS]]){
  if(!v){ say('  ? 원본 못 찾음 — ' + n); process.exit(2); }
}
const M = require(path.resolve(LOG));

say('── 1. 요약');
{
  const before = {
    a: { name: '가', text: '비밀 글 하나', ts: 1000, uid: 'u1' },
    b: { name: '나', text: '비밀 글 둘', ts: 3000, uid: 'u2' },
    c: { name: '가', text: '셋', ts: 2000, uid: 'u1' },
  };
  const r = M.summarizeDeleted('PLAY-AB12', null, before, 'app_user', 'authX');
  chk(r.room === 'PLAY-AB12' && r.tab === 'general' && r.lines === 3 && r.senders === 2 && r.first === 1000 && r.last === 3000,
    '줄 수 3 · 보낸 사람 2 · 첫 · 마지막 시각 · 탭 없으면 #일반');
  chk(r.by === 'app_user' && r.authId === 'authX' && r.clearMark === false, '★ 누가 지웠나(authType · authId) · 표시 줄 없음');
  chk(!JSON.stringify(r).includes('비밀'), '★ 대화 글은 로그에 싣지 않는다');
  const withMark = M.summarizeDeleted('PLAY-AB12', 's1', { x: { name: '알림', text: '🗑', ts: 5, sys: 'clr' } }, 'admin', undefined);
  chk(withMark.clearMark && withMark.tab === 's1' && withMark.by === 'admin' && withMark.authId === null, '방장 지우기 표시 줄 · 탭 이름 · 관리자(함수) 지움은 authId 없음');
  const empty = M.summarizeDeleted('X', null, null, undefined, undefined);
  chk(empty.lines === 0 && empty.first === null && empty.by === 'unknown', '지우기 전 값이 없으면 0줄 · 모름');
}

say('── 2. 트리거(실제 index.js — firebase-functions · firebase-admin 은 가짜로 끼워 넣는다)');
{
  /* CI 스테이징에는 functions/node_modules 가 없다 — 두 패키지만 «등록 함수 = 처리기 그대로 돌려줌» 가짜로 바꿔 index.js 를 실제로 읽는다. */
  const Module = require('module');
  const origLoad = Module._load;
  const reg = () => function(...a){ const h = a[a.length - 1]; return { opts: a[0], run: typeof h === 'function' ? h : () => {} }; };
  const fake = new Proxy({}, { get: (_t, k) => (k === '__esModule' ? false : reg()) });
  Module._load = function(req, parent, isMain){
    if(/^firebase-(functions|admin)(\/|$)/.test(req)) return fake;
    return origLoad.call(this, req, parent, isMain);
  };
  let F = null, loadErr = null;
  try{ delete require.cache[path.resolve(IDX)]; F = require(path.resolve(IDX)); }catch(e){ loadErr = e; }
  Module._load = origLoad;
  chk(!!(F && F.chatLogDeleted && F.chatTabDeleted), 'index.js 에 chatLogDeleted · chatTabDeleted 가 있다' + (loadErr ? ' — 읽기 예외: ' + loadErr.message : ''));
  if(F && F.chatLogDeleted && F.chatTabDeleted){
    chk(F.chatLogDeleted.opts.ref === '/rooms/{room}/chatLog' && F.chatTabDeleted.opts.ref === '/rooms/{room}/_chatTab/{tab}' && F.chatLogDeleted.opts.retry === false,
      '듣는 경로 — rooms/{방}/chatLog · rooms/{방}/_chatTab/{탭} (다시 시도 없음)');
    const logs = [];
    const orig = console.log;
    console.log = (...a) => { logs.push(a.join(' ')); };
    const ev = (params, val, authType, authId) => ({ params, data: { val: () => val }, authType, authId });
    Promise.resolve()
      .then(() => F.chatLogDeleted.run(ev({ room: 'PLAY-BFBT' }, { m1: { name: 'a', text: 't', ts: 9, uid: 'u9' } }, 'app_user', 'auth9')))
      .then(() => F.chatTabDeleted.run(ev({ room: 'PLAY-BFBT', tab: 's2' }, {}, 'admin')))
      .then(() => {
        console.log = orig;
        const l0 = logs.find(s => s.startsWith('[chatDeleted]') && s.includes('"tab":"general"'));
        const l1 = logs.find(s => s.startsWith('[chatDeleted]') && s.includes('"tab":"s2"'));
        chk(!!l0 && l0.includes('"room":"PLAY-BFBT"') && l0.includes('"by":"app_user"') && l0.includes('"authId":"auth9"') && l0.includes('"lines":1'),
          '★ chatLog 통째 지움 → [chatDeleted] 한 줄(방 · #일반 · 누가 · 줄 수)');
        chk(!!l1 && l1.includes('"by":"admin"'), '★ _chatTab/{탭} 통째 지움 → 탭 이름으로 한 줄');
        finish();
      })
      .catch((e) => { console.log = orig; chk(false, '트리거 실행 예외 — ' + (e && e.message)); finish(); });
    return;
  }
}
finish();

function finish(){
  if(finish.done) return; finish.done = true;
  say('── 3. 같은 값');
  const hist = fs.readFileSync(HIST, 'utf8'), tabs = fs.readFileSync(TABS, 'utf8');
  chk(new RegExp("CLEAR_SYS = '" + M.CLEAR_SYS + "'").test(hist), '방장 지우기 표시 값이 chat-history.js 와 같다(' + M.CLEAR_SYS + ')');
  chk(new RegExp("GENERAL = '" + M.MAIN_TAB + "'").test(tabs), '#일반 이름이 chat-tabs.js 와 같다(' + M.MAIN_TAB + ')');
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
}
