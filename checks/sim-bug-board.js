/* sim-bug-board.js — 🐞 버그제보 게시판 검사
   실행:  node sim-bug-board.js   (firebase-database-rules.json · bug-board.js · bug-board-ui.js · firebase-init.js · app.js 와 같은 폴더에서)

   ★ 왜 이 검사가 있는가 — 비공개 제보를 **서버에서** 막는 구조라, 규칙 한 줄이 풀리면 화면은 멀쩡한데
     남의 비공개 글이 `/bugBoard/prv.json` 한 번으로 다 보인다. 화면 확인으로는 절대 안 잡힌다.
     그리고 우편함 tag 정규식에 bug 가 빠지면 답변 알림이 **조용히** 실패한다.

   ★ 무엇을 보는가 (핸드오프 ③ 확인 ①~⑤ + 순수 함수)
     §1 규칙 — ① prv · ans/prv 읽기가 관리자/본인 조건 ② ans 쓰기가 관리자 전용 ③ list 읽기에 limitToLast 상한
              ④ inbox tag 에 bug  + 목록에 title 은 공개 글만 · kakao 는 open.kakao.com 만 · 하루 작성 수 본인만
     §2 bug-board.js 를 실제로 돌린다 — ⑤ 비공개 글의 목록 줄에 title 이 없다 · 입력 확인 · 배지 수
     §3 연결 — firebase-init · 우편함 · 화면 스크립트 순서 · 비공개 행은 누를 수 없다
   ⚠️ 규칙을 **실제로 돌려 본 것**은 이 검사가 아니다(에뮬레이터 필요). 그 결과는 커밋 메시지에 남겼다. */
'use strict';
const fs = require('fs');
const say = console.log;
let fail = 0;
const pending = [];
const chk = (ok, msg) => { if (!ok) fail++; say((ok ? '  ✓ ' : '  ✗ ') + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const RULES = read('firebase-database-rules.json'), BB = read('bug-board.js'), UI = read('bug-board-ui.js');
const FB = read('firebase-init.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html');
if (!RULES || !BB || !UI || !FB || !APP || !HTML) { say('  ? 원본 못 찾음 — 규칙 · bug-board.js · bug-board-ui.js · firebase-init.js · app.js · HTML'); process.exit(2); }

const rules = JSON.parse(RULES).rules;
const at = (p) => p.split('/').reduce((o, k) => (o && o[k] !== undefined) ? o[k] : undefined, rules);
const S = (v) => String(v == null ? '' : v);
const ADMIN = /root\.child\('admins'\)\.child\(auth\.uid\)\.val\(\) === true/;

say('§1 규칙');
const bb = at('bugBoard') || {};
chk(!!at('bugBoard/list') && !!at('bugBoard/prv/$authUid') && !!at('bugBoard/ans/pub/$id') && !!at('bugBoard/ans/prv/$id') && !!at('bugBoard/likes/$id/$authUid'),
  'bugBoard 노드(list · pub · prv · ans · likes)가 있다');
chk(bb['.read'] === undefined && at('bugBoard/prv')['.read'] === undefined, 'bugBoard · prv 전체 읽기는 열려 있지 않다');
{
  const r = S(at('bugBoard/prv/$authUid')['.read']);
  chk(/auth\.uid === \$authUid/.test(r) && ADMIN.test(r) && /auth != null/.test(r), '① 비공개 글 읽기 = 본인 또는 관리자');
  const a = S(at('bugBoard/ans/prv/$id')['.read']);
  chk(/bugBoard\/list\/'\+\$id\+'\/authUid'\)\.val\(\) === auth\.uid/.test(a) && ADMIN.test(a), '① 비공개 답변 읽기 = 그 글의 글쓴이 또는 관리자');
}
for (const p of ['bugBoard/ans/pub/$id', 'bugBoard/ans/prv/$id']) {
  const w = S(at(p)['.write']);
  chk(ADMIN.test(w) && !/\|\|/.test(w), '② ' + p + ' 쓰기는 관리자만');
}
chk(S(bb['.write']) && ADMIN.test(S(bb['.write'])) && !/\|\|/.test(S(bb['.write'])), '  bugBoard 전체 쓰기도 관리자만');
{
  const lr = S(at('bugBoard/list')['.read']);
  const m = lr.match(/query\.limitToLast <= (\d+)/);
  chk(!!m && +m[1] <= 20 && /^query\.limitToLast <= \d+ && \(/.test(lr), '③ 목록 읽기는 limitToLast ≤ 20 쿼리만 (' + (m ? m[1] : '없음') + ')');
  chk(/query\.orderByChild == 'authUid' && auth != null && query\.equalTo == auth\.uid/.test(lr), '  「내 글」 은 내 uid 로만 모아 볼 수 있다');
  const idx = at('bugBoard/list')['.indexOn'] || [];
  chk(['ts', 'openTs', 'nts', 'authUid'].every(k => idx.includes(k)), '  쓰는 정렬 넷에 색인이 있다');
}
{
  const tag = S(at('inbox/$uid/$msgId')['.validate']);
  chk(/matches\(\/\^\(notice\|update\|reward\|bug\)\$\/\)/.test(tag), '④ 우편함 tag 에 bug 가 있다 (없으면 알림이 조용히 실패)');
}
{
  const v = S(at('bugBoard/list/$id')['.validate']);
  chk(/!newData\.child\('title'\)\.exists\(\) \|\| \(newData\.child\('vis'\)\.val\(\) === 'pub'/.test(v), '목록의 title 은 공개 글일 때만 받는다');
  chk(!!at('bugBoard/list/$id/$other') && at('bugBoard/list/$id/$other')['.validate'] === 'false', '  목록에 정해지지 않은 칸은 못 넣는다');
  const w = S(at('bugBoard/list/$id')['.write']);
  chk(/newData\.child\('status'\)\.val\(\) === 'new'/.test(w) && /!newData\.child\('notice'\)\.exists\(\)/.test(w), '  글쓴이는 상태 · 공지를 정하지 못한다');
  const k = S(at('bugBoard/ans/pub/$id/$rid')['.validate']);
  chk(k.includes("matches(/^https:\\/\\/open\\.kakao\\.com\\//)") && /length <= 300/.test(k), 'kakao 는 https://open.kakao.com/ · 300자');
  chk(/vis'\)\.val\(\) === 'pub'/.test(k), '  비공개 글에는 공개 답변을 못 단다');
  const ln = S(at('bugBoard/list/$id/likeN')['.write']);
  chk(/=== \(data\.exists\(\) \? data\.val\(\) : 0\) \+ 1/.test(ln) && /likes\/'\+\$id\+'\/'\+auth\.uid\)\.val\(\) === true/.test(ln), '👍 수는 +1 만 · 내 공감 표시와 짝으로만');
  chk(/userAuth/.test(S(at('users/$userId/bugPostCount')['.write'])) && /userAuth/.test(S(at('users/$userId/bugSeen')['.write'])), '하루 작성 수 · 본 시각은 본인만');
  const wn = w.split('||')[0];
  chk(/newData\.child\('ts'\)\.val\(\) === now && newData\.child\('openTs'\)\.val\(\) === now/.test(wn) && !/now \+ 60000/.test(w), '글쓴이의 새 글 ts · openTs 는 서버 시각만 (PC 시계와 무관)');
  chk(!/contains\('운영'\)|contains\('admin'\)/.test(w), '제보 글의 이름은 따로 막지 않는다 (막는 곳은 프로필 이름)');
  const ba = S((at('bugBoard/list/$id/byAdmin') || {})['.validate']);
  chk(/newData\.val\(\) === true/.test(ba) && ADMIN.test(ba), '🛡 byAdmin 은 true 만 · 관리자만 넣는다');
  const dm = at('config/bugDailyMax') || {};
  chk(dm['.read'] === true && ADMIN.test(S(dm['.write'])) && /newData\.val\(\) >= 1 && newData\.val\(\) <= 100 && newData\.val\(\) % 1 === 0/.test(S(dm['.validate'])) && /admins/.test(S(at('config')['.read'])),
    '하루 상한 config/bugDailyMax — 누구나 읽기 · 관리자만 쓰기 · 1~100 정수 · config 통째 읽기는 관리자만');
}

say('§2 bug-board.js (실행)');
const M = new Function(BB.replace(/^export (function|const) /mg, '$1 ') +
  '\nreturn { BUG_CATS, BUG_DAILY_MAX, BUG_PAGE, KAKAO_RE, checkPost, listEntry, contentEntry, unseenCount, ymd, dailyMaxOf, BUG_DAILY_MAX_PATH, createBugBoard };')();
const who = { name: '에이', code: 'CA', authUid: 'uA' };
const prv = M.listEntry({ vis: 'prv', cat: 'bug', title: '비밀 제목', body: 'b' }, who, 1000);
chk(!('title' in prv) && !JSON.stringify(prv).includes('비밀 제목'), '⑤ 비공개 글의 목록 줄에는 제목이 없다');
const pub = M.listEntry({ vis: 'pub', cat: 'bug', title: '공개 제목', body: 'b' }, who, 1000);
chk(pub.title === '공개 제목' && pub.status === 'new' && pub.openTs === 1000, '  공개 글은 제목 · 접수 · 미해결 표시');
const nt = M.listEntry({ vis: 'pub', cat: 'etc', title: '공지', body: 'b', notice: true }, who, 1000);
chk(nt.notice === true && nt.nts === 1000 && !('openTs' in nt), '  공지는 nts 로 고정 · 미해결 목록에 안 낀다');
{
  // 정적: 목록 줄을 만드는 곳에서 title 은 vis === 'pub' 분기 안에서만
  const le = (BB.match(/export function listEntry\([\s\S]*?\n\}/) || [''])[0];
  const titleLines = le.split('\n').filter(l => /\.title\b/.test(l) && !/^\s*\/[*\/]/.test(l));
  chk(titleLines.length === 1 && /if\(p\.vis === 'pub'\) e\.title =/.test(titleLines[0]), '⑤ (정적) listEntry 의 title 쓰기는 공개 분기 한 줄뿐');
}
chk(M.checkPost({ vis: 'pub', cat: 'bug', title: '', body: 'x' }) && M.checkPost({ vis: 'pub', cat: 'zzz', title: 't', body: 'x' })
  && M.checkPost({ vis: 'prv', cat: 'bug', title: 't', body: 'x', notice: true }) && M.checkPost({ vis: 'pub', cat: 'bug', title: 'x'.repeat(61), body: 'x' })
  && M.checkPost({ vis: 'pub', cat: 'bug', title: 't', body: 'x' }) === null, '입력 확인 — 빈 제목 · 없는 분류 · 비공개 공지 · 61자 거부, 정상은 통과');
const ruleCats = (S(at('bugBoard/list/$id')['.validate']).match(/cat'\)\.val\(\)\.matches\(\/\^\(([^)]*)\)\$\/\)/) || [, ''])[1].split('|');
chk(M.BUG_CATS.map(c => c[0]).join('|') === ruleCats.join('|'), '분류 목록이 규칙과 같다 (' + ruleCats.join(',') + ')');
chk(M.BUG_DAILY_MAX === 5 && M.BUG_PAGE === 20, '하루 기본 5건 · 20개 단위');
chk(/const whoName = \(it\) =>/.test(UI) && /it\.byAdmin === true \|\| it\.notice/.test(UI) && (UI.match(/whoName\(it\)/g) || []).length >= 3 && /🛡 운영자 답변/.test(UI),
  '🛡 — 글 이름 옆(byAdmin · 공지, 이름으로 가르지 않음) · 운영자 답변');
chk(/api\(\)\.loadDailyMax\(\)/.test(UI) && /api\(\)\.dailyMax\(\)/.test(UI), '게시판을 열 때 상한을 한 번 읽고 «오늘 n건 남음» 에 쓴다');
chk(M.unseenCount([{ id: 'a', lastReplyTs: 5 }, { id: 'b', lastReplyTs: 5 }, { id: 'c' }], { a: 9 }) === 1, '배지 = lastReplyTs > bugSeen[id] 개수');
chk(M.dailyMaxOf(7) === 7 && M.dailyMaxOf(null) === 5 && M.dailyMaxOf('7') === 5 && M.dailyMaxOf(0) === 5 && M.dailyMaxOf(101) === 5 && M.dailyMaxOf(2.5) === 5
  && M.BUG_DAILY_MAX_PATH === 'config/bugDailyMax', '하루 상한 = config/bugDailyMax (없거나 이상하면 5)');
{
  // createPost 를 가짜 deps 로 — 서버 시각 · 작성 수는 예전대로(앱이 읽고 +1) · 상한은 설정값 · 관리자 글 byAdmin
  const run = async (count, who, max) => {
    const writes = [], tx = [];
    const SV = { '.sv': 'timestamp' };
    const bb = M.createBugBoard({ db: {}, ref: (_, p) => p || '',
      get: async (p) => ({ val: () => (/bugPostCount/.test(p) ? count : p === 'config/bugDailyMax' ? max : null) }),
      update: async (_, w) => { writes.push(w); }, push: () => ({ key: 'k1' }), runTransaction: async (p, fn) => { tx.push([p, fn(count)]); },
      query: () => null, orderByChild: () => null, limitToLast: () => null, endBefore: () => null, equalTo: () => null,
      authUid: () => 'uA', now: () => 1000, serverTs: () => SV });
    const loaded = await bb.loadDailyMax();
    const r = await bb.createPost({ vis: 'pub', cat: 'bug', title: 't', body: 'b' }, who);
    return { r, writes, tx, SV, loaded };
  };
  // 결과는 맨 끝 판정 전에 모은다(pending)
  pending.push(run(2, { name: '에이', code: 'CA' }).then(({ r, writes, tx, SV, loaded }) => {
    const e = writes[0] && writes[0]['bugBoard/list/k1'];
    chk(r.ok && loaded === 5 && e && e.ts === SV && e.openTs === SV && !('byAdmin' in e), '새 글 ts · openTs = serverTimestamp · 설정값 없으면 상한 5 · 글쓴이 글엔 byAdmin 없음');
    chk(tx.length === 1 && /^users\/CA\/bugPostCount\/\d{4}-\d{2}-\d{2}$/.test(tx[0][0]) && tx[0][1] === 3, '  ↳ 하루 작성 수는 예전대로 앱이 +1 (users/{code}/bugPostCount/{날짜})');
  }));
  pending.push(run(5, { name: '에이', code: 'CA' }, 7).then(({ r, loaded }) => chk(r.ok && loaded === 7, '상한을 7 로 올리면 6번째 글도 된다')));
  pending.push(run(7, { name: '에이', code: 'CA' }, 7).then(({ r, writes }) => chk(!r.ok && /하루 7건/.test(r.reason) && !writes.length, '  ↳ 7건이면 막고 이유에 상한을 적는다')));
  pending.push(run(5, { name: '에이', code: 'CA' }).then(({ r, writes }) => chk(!r.ok && /하루 5건/.test(r.reason) && !writes.length, '설정값이 없으면 5건에서 막는다')));
  pending.push(run(9, { name: '운영자', code: 'CA', isAdmin: true }).then(({ r, writes, tx }) => {
    chk(r.ok && writes[0]['bugBoard/list/k1'].byAdmin === true && tx.length === 0, '관리자는 상한 없음 · 글에 byAdmin(🛡) · 작성 수 안 셈');
  }));
  pending.push(run(0, { name: '운영팀', code: 'CA' }).then(({ r }) => chk(r.ok, '제보 글쓰기는 이름을 따로 막지 않는다 (막는 곳은 프로필 이름)')));
}
chk(M.KAKAO_RE.test('https://open.kakao.com/o/x') && !M.KAKAO_RE.test('http://open.kakao.com/o/x') && !M.KAKAO_RE.test('https://open.kakao.com.evil.io/'), '오픈카톡 링크 판정');

say('§3 연결');
chk(/import \{ createBugBoard \} from "\.\/bug-board\.js"/.test(FB) && /bugBoard: createBugBoard\(/.test(FB), 'firebase-init 은 연결만 (bugBoard: createBugBoard)');
chk(/tag==='bug'\) \? tag : 'notice'/.test(FB) && /rec\.bugId = /.test(FB), 'sendInboxMessage 가 bug · bugId 를 보낸다');
chk(/m\.tag === 'bug' && m\.bugId && typeof window\._bugBoardOpen === 'function'/.test(APP), '우편함에서 누르면 그 글을 연다');
chk(/sendInboxMessage\(post\.it\.code, 'bug', '접수된 제보에 답변이 달렸어요'/.test(UI), '답변 등록 → 글쓴이 우편함 알림');
const iApp = HTML.indexOf('<script src="parts/app.js"></script>'), iUi = HTML.indexOf('<script src="parts/bug-board-ui.js"></script>');
chk(iApp > 0 && iUi > iApp, 'bug-board-ui.js 는 app.js 뒤에 싣는다');
chk(/class="bb-row locked"/.test(UI) && !/class="bb-row locked" data-id/.test(UI) && /\.bb-row\.locked\{[^}]*cursor:not-allowed/.test(HTML), '남의 비공개 행은 data-id 가 없어 누를 수 없다 (not-allowed)');
chk(/prvOnly \? ' checked disabled'/.test(UI), '비공개 글이면 답변 공개 범위가 비공개로 묶인다');
const noC = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
chk(!/\b(alert|confirm|prompt)\(/.test(noC(UI)), 'alert · confirm · prompt 를 쓰지 않는다');
chk(!/innerHTML[^;]*\+\s*(it|ct|a|post)\.(title|body|text|name|env|kakao)\b/.test(UI), '사용자 문자열은 esc() 를 거쳐 innerHTML 에 들어간다');

Promise.all(pending).catch(e => chk(false, '검사가 던졌다: ' + (e && e.stack || e))).then(() => {
  say('');
  say(fail ? '문제 ' + fail + '건' : '전부 통과 ✅ — 비공개 제보는 서버에서 막히고, 답변 알림이 우편함으로 간다');
  process.exit(fail ? 1 : 0);
});
