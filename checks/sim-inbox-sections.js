/* sim-inbox-sections.js — 📩 우편함 칸 나누기 규칙(inbox-sections.js — 우편 · 소식 · 순서 · 안 읽은 수 · 처음 칸)
   실행:  node sim-inbox-sections.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — 우편함 그리기 · 탭 배지 · 처음 열 칸이 같은 판단을 쓴다. 한쪽만 고치면 배지 수와 목록이 어긋난다.
   ★ 사용자 결정: 모두에게 보낸 «📩 우편»(이벤트 보상)은 우편 칸 · 📌 고정 소식은 어떤 종류를 골라도 맨 위 · 처음엔 안 읽은 우편이 있으면 우편, 없으면 소식.
   ・1절: 순수 함수 입력 → 출력 · 경계값(빈 값 · null · 모르는 태그 · 옛 필터 값 · 같은 시각) · 받은 값을 고치지 않는다
   ・2절: 연결 — html 이 myhome-inbox.js · app.js 보다 먼저 싣는다 · smoke 가 싣는다 · 수령함 모듈이 받아 부른다
   ・3절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, 'checks/' + f, path.basename(f)]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('myhome/inbox-sections.js'), INBOX = read('myhome/myhome-inbox.js'), HTML = read('desk-companion-prototype.html'), SMOKE = read('smoke.js');
if (!MOD || !INBOX || !HTML || !SMOKE) { say('  ? 원본 못 찾음 — inbox-sections.js · myhome-inbox.js · desk-companion-prototype.html · smoke.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
const J = JSON.stringify;
const load = (src) => { const win = {}; new Function('window', 'module', src)(win, undefined); return win; };

/* 개인 우편(_src personal) + 모두에게 보낸 것(_src broadcast) — myhome-inbox.js 의 _inboxMerged 가 만드는 모양 */
const MERGED = () => ({
  p1: { _src: 'personal', tag: 'reward', ts: 30, read: false },
  p2: { _src: 'personal', tag: 'bug', ts: 50, read: true },
  p3: { _src: 'personal', tag: 'notice', ts: 10, read: false },     // 나한테만 온 공지 — 우편 칸
  p4: { _src: 'personal', ts: 5, read: true },                       // 태그 없음 — 공지로 본다(우편 칸)
  b1: { _src: 'broadcast', tag: 'notice', ts: 40, read: false },
  b2: { _src: 'broadcast', tag: 'update', ts: 60, read: true },
  b3: { _src: 'broadcast', tag: 'update', ts: 1, read: false, pinned: true },
  b4: { _src: 'broadcast', tag: 'reward', ts: 45, read: false },     // 모두에게 보낸 우편 — 우편 칸(사용자 결정)
  b5: { _src: 'broadcast', tag: 'weird', ts: 20, read: true },       // 모르는 태그 — 공지(소식 칸)
  b6: { _src: 'broadcast', tag: 'notice', ts: 40, read: true },      // b1 과 같은 시각
});

function judge(mod){
  const r = {};
  try {
    const win = load(mod), S = win.TwInboxSections;
    r.only = Object.keys(win).join() === 'TwInboxSections';
    r.consts = J(S.SECS) === J(['mail', 'news']) && J(S.CATS) === J(['all', 'notice', 'update']) && Object.isFrozen(S.SECS) && Object.isFrozen(S.CATS);
    r.tagOf = S.tagOf({ tag: 'update' }) === 'update' && S.tagOf({ tag: 'reward' }) === 'reward' && S.tagOf({ tag: 'bug' }) === 'bug'
      && S.tagOf({ tag: 'notice' }) === 'notice' && S.tagOf({ tag: 'weird' }) === 'notice' && S.tagOf({}) === 'notice' && S.tagOf(null) === 'notice';
    r.sectionOf = S.sectionOf({ _src: 'broadcast', tag: 'notice' }) === 'news' && S.sectionOf({ _src: 'broadcast', tag: 'update' }) === 'news'
      && S.sectionOf({ _src: 'broadcast' }) === 'news' && S.sectionOf({ _src: 'broadcast', tag: 'weird' }) === 'news'
      && S.sectionOf({ _src: 'broadcast', tag: 'reward' }) === 'mail' && S.sectionOf({ _src: 'broadcast', tag: 'bug' }) === 'mail'
      && S.sectionOf({ _src: 'personal', tag: 'notice' }) === 'mail' && S.sectionOf({ _src: 'personal', tag: 'update' }) === 'mail' && S.sectionOf({ tag: 'update' }) === 'mail' && S.sectionOf(null) === 'mail';
    r.norm = S.normSec('news') === 'news' && S.normSec('help') === 'mail' && S.normSec('x') === 'mail' && S.normSec(undefined) === 'mail'
      && S.normCat('update') === 'update' && S.normCat('reward') === 'all' && S.normCat('gift') === 'all' && S.normCat(null) === 'all';
    const M = MERGED(), before = J(M);
    r.mail = J(S.mailIds(M)) === J(['p2', 'b4', 'p1', 'p3', 'p4']);
    r.newsAll = J(S.newsIds(M, 'all')) === J(['b3', 'b2', 'b1', 'b6', 'b5']) || J(S.newsIds(M, 'all')) === J(['b3', 'b2', 'b6', 'b1', 'b5']);
    r.newsNotice = J(S.newsIds(M, 'notice').filter(x => x !== 'b6' && x !== 'b1')) === J(['b3', 'b5']) && S.newsIds(M, 'notice').length === 4 && S.newsIds(M, 'notice')[0] === 'b3';
    r.newsUpdate = J(S.newsIds(M, 'update')) === J(['b3', 'b2']);
    r.newsOld = J(S.newsIds(M, 'gift')) === J(S.newsIds(M, 'all'));
    const P = { a: { _src: 'personal', tag: 'reward', ts: 1, pinned: true }, b: { _src: 'personal', tag: 'reward', ts: 9 } };
    r.mailPin = J(S.mailIds(P)) === J(['a', 'b']);
    r.empty = J(S.mailIds({})) === '[]' && J(S.mailIds(null)) === '[]' && J(S.newsIds(undefined, 'all')) === '[]';
    r.unread = J(S.unread(M)) === J({ mail: 3, news: 2, notice: 1, update: 1, total: 5 }) && J(S.unread(null)) === J({ mail: 0, news: 0, notice: 0, update: 0, total: 0 });
    r.first = S.firstSec(M) === 'mail' && S.firstSec({ x: { _src: 'personal', read: true }, y: { _src: 'broadcast', tag: 'notice' } }) === 'news' && S.firstSec({}) === 'news' && S.firstSec(null) === 'news';
    r.pure = J(M) === before;
  } catch (e) { r.err = String(e && e.stack || e).split('\n').slice(0, 2).join(' / '); }
  return r;
}
function wiring(inbox, html, smoke){
  const r = {};
  const order = [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*\bsrc="parts\/([^"]+\.js)"/g)].map(m => m[1]);
  const at = order.indexOf('myhome/inbox-sections.js');
  r.order = at >= 0 && at < order.indexOf('myhome/myhome-inbox.js') && at < order.indexOf('app.js');
  const iP = smoke.indexOf("PRELOAD.push('inbox-sections.js');"), iI = smoke.indexOf("PRELOAD.push('myhome-inbox.js');");
  r.smoke = iP > 0 && iP < iI;
  const code = strip(inbox);
  r.takes = /const inboxSec = TwInboxSections;/.test(code);
  r.calls = ['normSec', 'normCat', 'unread', 'mailIds', 'newsIds', 'tagOf', 'firstSec'].filter(n => !new RegExp('\\binboxSec\\.' + n + '\\(').test(code));
  /* 같은 판단을 수령함 모듈에 다시 쓰지 않는다 — 소식 고르기 · 고정 먼저 정렬 · 태그 이름 고르기 */
  r.dup = [/_src === 'broadcast' && \(/, /pa !== pb/, /tag==='update'\|\|m\.tag==='reward'/, /\.tag \|\| 'notice'/].filter(re => re.test(code)).map(String);
  return r;
}

const R = judge(MOD), W = wiring(INBOX, HTML, SMOKE);
say('── 1. 순수 함수');
chk(!R.err && R.only && R.consts, '싣기만 하면 window.TwInboxSections 하나 · 칸 셋 · 종류 셋(바꿀 수 없음)' + (R.err ? ' — ' + R.err : ''));
chk(R.tagOf, '태그 — update · reward · bug 는 그대로 · 나머지(없음 · 모르는 값 · null)는 공지');
chk(R.sectionOf, '★ 칸 — 모두에게 보낸 공지 · 업데이트(태그 없음 · 모르는 태그 포함)만 소식 · 모두에게 보낸 우편 · 개인 우편은 전부 우편');
chk(R.norm, '모르는 칸은 우편 · 모르는 종류(옛 reward · gift)는 전체');
chk(R.mail && R.mailPin, '우편 칸 — 📌 먼저 · 최신순 · 모두에게 보낸 우편도 · 소식은 빠짐');
chk(R.newsAll, '소식 칸 «전체» — 📌 먼저 · 최신순 · 모르는 태그도');
chk(R.newsNotice && R.newsUpdate, '★ 공지 · 업데이트를 골라도 📌 고정 소식은 맨 위에 늘 보인다');
chk(R.newsOld, '  옛 필터 값이면 전체로 본다');
chk(R.empty, '빈 값 · null 도 선다(빈 목록)');
chk(R.unread, '안 읽은 수 — 우편 · 소식 · 공지 · 업데이트 · 합계(빈 값은 0)');
chk(R.first, '처음 칸 — 안 읽은 우편이 있으면 우편 · 없으면 소식(빈 값도)');
chk(R.pure, '받은 값을 고치지 않는다');
say('── 2. 연결');
chk(W.order, 'html 이 inbox-sections.js 를 myhome-inbox.js · app.js 보다 먼저 싣는다');
chk(W.smoke, 'smoke 가 myhome-inbox.js 보다 먼저 싣는다');
chk(W.takes && !W.calls.length, '수령함 모듈이 받아 부른다' + (W.calls.length ? ' — 안 부름: ' + W.calls.join(' · ') : ''));
chk(!W.dup.length, '같은 판단을 수령함 모듈에 다시 쓰지 않는다' + (W.dup.length ? ' — ' + W.dup.join(' · ') : ''));

say('── 3. 일부러 깨 보기');
const BREAKS = [
  ['MOD', "return (t === 'notice' || t === 'update') ? 'news' : 'mail';", "return (t === 'notice' || t === 'update' || t === 'reward') ? 'news' : 'mail';", '모두에게 보낸 우편이 소식으로', 'sectionOf'],
  ['MOD', "if(!m || m._src !== 'broadcast') return 'mail';", "if(!m) return 'mail';", '개인 공지가 소식으로', 'sectionOf'],
  ['MOD', "(m[id].pinned || c === 'all' || tagOf(m[id]) === c)", "(c === 'all' || tagOf(m[id]) === c)", '종류를 고르면 고정 소식이 사라짐', 'newsNotice'],
  ['MOD', 'if(pa !== pb) return pb - pa;', '', '📌 고정을 먼저 안 둠', 'mailPin'],
  ['MOD', "return CATS.indexOf(c) >= 0 ? c : 'all';", 'return c;', '옛 필터 값을 그대로 둠', 'norm'],
  ['MOD', "return unread(merged).mail > 0 ? 'mail' : 'news';", "return 'mail';", '처음 칸을 늘 우편으로', 'first'],
  ['MOD', "if(m[id].read) return;\n    out.total++;", 'out.total++;', '읽은 것도 셈', 'unread'],
  ['MOD', "return (t === 'update' || t === 'reward' || t === 'bug') ? t : 'notice';", 'return t;', '모르는 태그를 그대로', 'tagOf'],
  ['MOD', 'const SECS = Object.freeze(', 'const SECS = (', '칸 목록을 바꿀 수 있음', 'consts'],
  ['INBOX', 'const ids = inboxSec.newsIds(merged, _inboxFilter);', 'const ids = Object.keys(merged).filter(id=>merged[id]._src === \'broadcast\' && (merged[id].tag));', '수령함이 소식 판단을 다시 씀', 'W'],
  ['HTML', '<script src="parts/myhome/inbox-sections.js"></script>', '', 'html 이 안 실음', 'W'],
];
const missed = [];
for (const [where, from, to, what, key] of BREAKS) {
  const src = { MOD, INBOX, HTML }[where];
  if (src.indexOf(from) < 0) { chk(false, '깨 볼 글을 못 찾음 — ' + what); continue; }
  const bad = src.split(from).join(to);
  let caught;
  if (where === 'MOD') { const r = judge(bad); caught = !!r.err || r[key] === false; }
  else { const w = where === 'INBOX' ? wiring(bad, HTML, SMOKE) : wiring(INBOX, bad, SMOKE); caught = !w.order || !w.takes || w.calls.length > 0 || w.dup.length > 0; }
  if (!caught) missed.push(what);
}
chk(!missed.length, '일부러 깨 본 ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — 못 잡음: ' + missed.join(' · ') : ''));

say('\n통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
