/* sim-bug-board.js — 🐞 버그제보 게시판 검사
   실행:  node sim-bug-board.js   (firebase-database-rules.json · bug-board.js · bug-board-ui.js · firebase-init.js · app.js 와 같은 폴더에서)

   ★ 왜 이 검사가 있는가 — 비공개 제보를 **서버에서** 막는 구조라, 규칙 한 줄이 풀리면 화면은 멀쩡한데
     남의 비공개 글이 `/bugBoard/prv.json` 한 번으로 다 보인다. 화면 확인으로는 절대 안 잡힌다.
     그리고 우편함 tag 정규식에 bug 가 빠지면 답변 알림이 **조용히** 실패한다.

   ★ 무엇을 보는가 (핸드오프 ③ 확인 ①~⑤ + 순수 함수)
     §1 규칙 — ① prv · ans/prv 읽기가 관리자/본인 조건 ② ans 쓰기가 관리자 전용 ③ list 읽기에 limitToLast 상한
              ④ inbox tag 에 bug  + 비공개 글 이름 «익명» 은 앱이 넣는다(규칙은 0.11.2 이하 앱 때문에 아직 안 본다) · kakao 는 open.kakao.com 만 · 하루 작성 수 본인만
     §2 bug-board.js 를 실제로 돌린다 — ⑤ 비공개 글의 목록 줄은 제목은 있고 이름은 «익명» · 입력 확인 · 배지 수
     §3 연결 — firebase-init · 우편함 · 화면 스크립트 순서 · 비공개 행은 누를 수 없다
     §4 쪽 넘김 — 가짜 RTDB(정렬 · endBefore · limitToLast 를 흉내)에 글 45개 + 공지 2개를 넣고 [다음] 으로 끝까지 걷는다.
        한 쪽은 BUG_PAGE(8)개 · 한 번에 20개 넘게 받지 않는다 · 빠짐 · 겹침 없음 · [이전] 은 같은 쪽 · 미해결도 같은 방식
     §5 창이 안 늘어난다 — 버그제보 페이지 높이 고정(440px) · 목록은 #bbRows 안에서 스크롤 · [이전]/[다음] 은 안 줄어든다
        (예전엔 min-height 만 있어 [전체] 한 쪽 + 공지만큼 마이홈 창이 세로로 화면 끝까지 늘어났다)
     §6 글쓴이 답글 — rep 노드 규칙(글쓴이만 · 서버 시각 · userReplyTs 짝 · 10초) · 글쓴이 상태 셋 · addReply 실행 · 화면
   ⚠️ 규칙을 **실제로 돌려 본 것**은 이 검사가 아니다(에뮬레이터 필요). 그 결과는 커밋 메시지에 남겼다. */
'use strict';
const fs = require('fs');
const say = console.log;
let fail = 0;
const pending = [];
const chk = (ok, msg) => { if (!ok) fail++; say((ok ? '  ✓ ' : '  ✗ ') + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const RULES = read('firebase-database-rules.json'), BB = read('bug-board.js'), UI = read('bug-board-ui.js');
/* 📩 수령함 · 💝 선물함 · 👥 마이홈 친구 목록은 parts/myhome/myhome-inbox.js 로 옮겼다(앱 FSD 15번) — 렌더러 쪽 한 벌 = app.js + 그 파일.
   ⚠️ 그 파일이 없으면 «못 찾음» 으로 멈춘다 — app.js 만 보고 빨개지거나 초록인 척하지 않게. */
const MI = read('myhome-inbox.js'); if (!MI) { console.log('  ? 원본 못 찾음 — myhome-inbox.js'); process.exit(2); }
const FB = read('firebase-init.js'), APP = read('app.js') + '\n' + MI, HTML = read('desk-companion-prototype.html');
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
  chk(/!newData\.child\('title'\)\.exists\(\) \|\| \(newData\.child\('title'\)\.isString\(\)/.test(v) && /title'\)\.val\(\)\.length <= 60/.test(v), '목록의 title 은 공개 · 비공개 모두 받는다(60자)');
  /* 0.11.2 이하 앱은 비공개 글에도 실명을 보낸다 — 규칙이 «익명» 을 요구하면 그 앱의 비공개 제보가 통째로 거부된다(#116 뒤 운영에서 남).
     사용자 대부분이 «익명» 을 보내는 앱으로 올라온 뒤 다시 넣는다(TODO: firebase-database-rules.json bugBoard/list/$id .write). */
  chk(!/newData\.child\('name'\)\.val\(\) === '익명'/.test(S(at('bugBoard/list/$id')['.write'])),
    '글쓴이 새 글 규칙은 아직 이름 «익명» 을 요구하지 않는다 — 옛 앱(0.11.2 이하)의 비공개 제보가 거부되지 않게');
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
  '\nreturn { BUG_STATUS, BUG_AUTHOR_STATUS, isOpenStatus, hasAuthorReply, BUG_CATS, BUG_DAILY_MAX, BUG_PAGE, BUG_MINE_MAX, BUG_ANON, KAKAO_RE, checkPost, listEntry, contentEntry, unseenCount, answerNoticeBody, pageOf, ymd, dailyMaxOf, createBugBoard };')();
const who = { name: '에이', code: 'CA', authUid: 'uA' };
const prv = M.listEntry({ vis: 'prv', cat: 'bug', title: '비밀 제목', body: 'b' }, who, 1000);
chk(prv.title === '비밀 제목' && prv.name === M.BUG_ANON && M.BUG_ANON === '익명' && !JSON.stringify(prv).includes('에이'), '⑤ 비공개 글의 목록 줄 — 제목은 보이고 이름은 «익명»(실명 없음)');
// 우편함은 누구나 읽고 우편함 주소가 글쓴이 코드다 — 비공개 글의 답변 알림에 제목이 실리면 «누가 그 글을 썼는지» 가 샌다
chk(!M.answerNoticeBody('prv', '비밀 제목', false).includes('비밀 제목') && !M.answerNoticeBody('prv', '비밀 제목', true).includes('비밀 제목'),
  '⑥ 비공개 글의 답변 알림(우편함) 본문에는 제목이 없다');
// ⑦ 쪽 넘김 — 공지가 섞여도 [다음] 이 켜진다(거르기 전 원본으로 센다)
{
  const raw = Array.from({ length: 20 }, (_, i) => ({ id: 'p' + i, ts: 1000 + i, status: 'new' }));
  raw[19].notice = true;
  const pg = M.pageOf('all', raw);
  chk(pg.items.length === 19 && pg.next === 1000, '⑦ 전체: 공지 1개 섞인 20개 → 19개 보이고 [다음] 켜짐(커서 = 가장 오래된 ts)');
  chk(M.pageOf('all', raw.slice(0, M.BUG_PAGE - 1)).next === null, '⑦ 전체: 한 쪽(' + M.BUG_PAGE + '개) 미만이면 끝');
  const open = raw.map((it, i) => Object.assign({}, it, { openTs: 2000 + i }));
  chk(M.pageOf('open', open).next === 2000, '⑦ 미해결: 꽉 차면 커서 = 가장 작은 openTs');
  const mixed = open.slice(0, M.BUG_PAGE - 3).concat(Array.from({ length: 5 }, (_, i) => ({ id: 'z' + i, ts: 1 + i })));
  chk(M.pageOf('open', mixed).next === null && M.pageOf('open', mixed).items.length === M.BUG_PAGE - 3, '⑦ 미해결: openTs 없는 글이 딸려 와도 끝으로 본다');
  chk(M.pageOf('mine', raw).next === null, '⑦ 내 글은 서버에서 쪽을 넘기지 않는다');
  chk(/mineCache\.slice\(from, from \+ n\)/.test(UI) && /const n = C\(\)\.page/.test(UI) && !/filter === 'mine' \? 'none'/.test(UI),
    '⑦ 내 글은 한 번에 받아 화면에서 한 쪽(BUG_PAGE)씩 나눈다 — [이전]/[다음] 을 숨기지 않는다');
  chk(/더 이전 제보가 없어요/.test(UI) && /emptyText\(filter, page\)/.test(UI), '⑦ 딱 한 쪽의 배수라 빈 2쪽이 나오면 «더 이전 제보가 없어요»');
}
chk(M.answerNoticeBody('pub', '공개 제목', true).startsWith('공개 제목') && M.answerNoticeBody('pub', '공개 제목', true).includes('오픈카톡'),
  '⑥ 공개 글은 제목 + 오픈카톡 안내');
chk(/answerNoticeBody\(post\.it\.vis/.test(UI) && !/post\.title \+ \(r\.kakao/.test(UI), '⑥ 화면은 answerNoticeBody 로 알림 본문을 만든다');
const pub = M.listEntry({ vis: 'pub', cat: 'bug', title: '공개 제목', body: 'b' }, who, 1000);
chk(pub.title === '공개 제목' && pub.status === 'new' && pub.openTs === 1000, '  공개 글은 제목 · 접수 · 미해결 표시');
const nt = M.listEntry({ vis: 'pub', cat: 'etc', title: '공지', body: 'b', notice: true }, who, 1000);
chk(nt.notice === true && nt.nts === 1000 && !('openTs' in nt), '  공지는 nts 로 고정 · 미해결 목록에 안 낀다');
{
  // 정적: 목록 줄의 이름은 비공개면 BUG_ANON — 실명이 들어가는 갈래는 공개 글뿐
  const le = (BB.match(/export function listEntry\([\s\S]*?\n\}/) || [''])[0];
  chk(/name: p\.vis === 'prv' \? BUG_ANON : String\(who\.name/.test(le), '⑤ (정적) listEntry 의 이름은 비공개면 BUG_ANON');
  chk(/limitToLast\(BUG_MINE_MAX\)/.test(BB) && M.BUG_MINE_MAX === 20, '  «내 글» 은 쪽 크기와 따로 최근 20개(새 답변 배지가 그 안에서 센다)');
  chk(/const whoName = \(it\) => \(it\.vis === 'prv' \? esc\(C\(\)\.anon\)/.test(UI), '  화면의 이름도 비공개 글이면 «익명»(옛 글에 실명이 남아 있어도)');
}
chk(M.checkPost({ vis: 'pub', cat: 'bug', title: '', body: 'x' }) && M.checkPost({ vis: 'pub', cat: 'zzz', title: 't', body: 'x' })
  && M.checkPost({ vis: 'prv', cat: 'bug', title: 't', body: 'x', notice: true }) && M.checkPost({ vis: 'pub', cat: 'bug', title: 'x'.repeat(61), body: 'x' })
  && M.checkPost({ vis: 'pub', cat: 'bug', title: 't', body: 'x' }) === null, '입력 확인 — 빈 제목 · 없는 분류 · 비공개 공지 · 61자 거부, 정상은 통과');
const ruleCats = (S(at('bugBoard/list/$id')['.validate']).match(/cat'\)\.val\(\)\.matches\(\/\^\(([^)]*)\)\$\/\)/) || [, ''])[1].split('|');
chk(M.BUG_CATS.map(c => c[0]).join('|') === ruleCats.join('|'), '분류 목록이 규칙과 같다 (' + ruleCats.join(',') + ')');
chk(M.BUG_DAILY_MAX === 5 && M.BUG_PAGE === 8, '하루 기본 5건 · 한 쪽 8개');
chk(/const whoName = \(it\) =>/.test(UI) && /it\.byAdmin === true \|\| it\.notice/.test(UI) && (UI.match(/whoName\(it\)/g) || []).length >= 3 && /🛡 운영자 답변/.test(UI),
  '🛡 — 글 이름 옆(byAdmin · 공지, 이름으로 가르지 않음) · 운영자 답변');
chk(/api\(\)\.loadDailyMax\(\)/.test(UI) && /api\(\)\.dailyMax\(\)/.test(UI), '게시판을 열 때 상한을 한 번 읽고 «오늘 n건 남음» 에 쓴다');
chk(M.unseenCount([{ id: 'a', lastReplyTs: 5 }, { id: 'b', lastReplyTs: 5 }, { id: 'c' }], { a: 9 }) === 1, '배지 = lastReplyTs > bugSeen[id] 개수');
chk(M.dailyMaxOf(7) === 7 && M.dailyMaxOf(null) === 5 && M.dailyMaxOf('7') === 5 && M.dailyMaxOf(0) === 5 && M.dailyMaxOf(101) === 5 && M.dailyMaxOf(2.5) === 5
  && !/config\/bugDailyMax/.test(BB.replace(/\/\*[\s\S]*?\*\//g, '')), '하루 상한 = 원격 설정 bugDailyMax(deps.getDailyMax · 없거나 이상하면 5) — Firebase config 를 읽지 않는다');
{
  // createPost 를 가짜 deps 로 — 서버 시각 · 작성 수는 예전대로(앱이 읽고 +1) · 상한은 설정값 · 관리자 글 byAdmin
  const run = async (count, who, max, getMaxThrows) => {
    const writes = [], tx = [];
    const SV = { '.sv': 'timestamp' };
    const bb = M.createBugBoard({ db: {}, ref: (_, p) => p || '',
      get: async (p) => ({ val: () => (/bugPostCount/.test(p) ? count : null) }),
      getDailyMax: async () => { if(getMaxThrows) throw new Error('net'); return max; },
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
  pending.push(run(5, { name: '에이', code: 'CA' }, 7, true).then(({ r, loaded }) => chk(!r.ok && loaded === 5, '  ↳ 설정을 못 받으면(오류) 5')));
  pending.push(run(9, { name: '운영자', code: 'CA', isAdmin: true }).then(({ r, writes, tx }) => {
    chk(r.ok && writes[0]['bugBoard/list/k1'].byAdmin === true && tx.length === 0, '관리자는 상한 없음 · 글에 byAdmin(🛡) · 작성 수 안 셈');
  }));
  pending.push(run(0, { name: '운영팀', code: 'CA' }).then(({ r }) => chk(r.ok, '제보 글쓰기는 이름을 따로 막지 않는다 (막는 곳은 프로필 이름)')));
}
chk(M.KAKAO_RE.test('https://open.kakao.com/o/x') && !M.KAKAO_RE.test('http://open.kakao.com/o/x') && !M.KAKAO_RE.test('https://open.kakao.com.evil.io/'), '오픈카톡 링크 판정');

say('§3 연결');
chk(/import \{ createBugBoard \} from "\.\/(?:(?:\.\.\/)?[\w-]+\/)?bug-board\.js"/.test(FB) && /bugBoard: createBugBoard\(/.test(FB), 'firebase-init 은 연결만 (bugBoard: createBugBoard)');
chk(/tag==='bug'\) \? tag : 'notice'/.test(FB) && /rec\.bugId = /.test(FB), 'sendInboxMessage 가 bug · bugId 를 보낸다');
chk(/m\.tag === 'bug' && m\.bugId && typeof window\._bugBoardOpen === 'function'/.test(APP), '우편함에서 누르면 그 글을 연다');
chk(/sendInboxMessage\(post\.it\.code, 'bug', '접수된 제보에 답변이 달렸어요'/.test(UI), '답변 등록 → 글쓴이 우편함 알림');
const iApp = HTML.indexOf('<script src="parts/app.js"></script>'), iUi = HTML.indexOf('<script src="parts/support/bug-board-ui.js"></script>');
chk(iApp > 0 && iUi > iApp, 'bug-board-ui.js 는 app.js 뒤에 싣는다');
chk(/class="bb-row locked"/.test(UI) && !/class="bb-row locked" data-id/.test(UI) && /\.bb-row\.locked\{[^}]*cursor:not-allowed/.test(HTML), '남의 비공개 행은 data-id 가 없어 누를 수 없다 (not-allowed)');
chk(/prvOnly \? ' checked disabled'/.test(UI), '비공개 글이면 답변 공개 범위가 비공개로 묶인다');
const noC = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
chk(!/\b(alert|confirm|prompt)\(/.test(noC(UI)), 'alert · confirm · prompt 를 쓰지 않는다');
chk(!/innerHTML[^;]*\+\s*(it|ct|a|post)\.(title|body|text|name|env|kakao)\b/.test(UI), '사용자 문자열은 esc() 를 거쳐 innerHTML 에 들어간다');

say('§4 쪽 넘김 (가짜 RTDB)');
{
  /* RTDB 정렬 흉내 — orderByChild 값이 없는 글(null)이 맨 앞, 그다음 숫자 오름차순, 같으면 키 순.
     endBefore(v) 는 v 보다 앞(= null 포함), limitToLast(n) 은 뒤에서 n 개. */
  const mk = (n0, extra) => {
    const DB = {};
    for (let i = 0; i < 45; i++) {
      const id = 'p' + String(i).padStart(2, '0');
      DB[id] = { vis: 'pub', status: i % 3 ? 'fixed' : 'new', cat: 'bug', title: '글 ' + i, ts: 10000 + i * 10 };
      if (DB[id].status === 'new') DB[id].openTs = DB[id].ts;
    }
    // 공지 둘 — 가장 최근 쪽에 끼워 둔다(1쪽에서 걸러져도 [다음] 이 켜져야 한다)
    DB.n1 = { vis: 'pub', status: 'new', cat: 'etc', title: '공지1', notice: true, ts: 10445, nts: 10445 };
    DB.n2 = { vis: 'pub', status: 'new', cat: 'etc', title: '공지2', notice: true, ts: 10305, nts: 10305 };
    return Object.assign(DB, extra || {});
  };
  const fake = (DB) => {
    const reads = [];
    const cmp = (k) => (a, b) => {
      const va = DB[a][k], vb = DB[b][k];
      const na = typeof va === 'number', nb = typeof vb === 'number';
      if (na !== nb) return na ? 1 : -1;
      if (na && va !== vb) return va - vb;
      return a < b ? -1 : a > b ? 1 : 0;
    };
    const deps = {
      db: {}, ref: (_, p) => ({ path: p || '' }),
      query: (r, ...cs) => ({ path: r.path, cs }),
      orderByChild: (k) => ({ t: 'o', k }), limitToLast: (n) => ({ t: 'l', n }), endBefore: (v) => ({ t: 'e', v }), equalTo: (v) => ({ t: 'q', v }),
      get: async (q) => {
        if (!q.cs || q.path !== 'bugBoard/list') return { val: () => null };
        const o = q.cs.find(c => c.t === 'o'), l = q.cs.find(c => c.t === 'l'), e = q.cs.find(c => c.t === 'e'), eq = q.cs.find(c => c.t === 'q');
        let ids = Object.keys(DB).sort(cmp(o.k));
        if (eq) ids = ids.filter(id => DB[id][o.k] === eq.v);
        if (e) ids = ids.filter(id => !(typeof DB[id][o.k] === 'number') || DB[id][o.k] < e.v);
        if (l) ids = ids.slice(-l.n);
        reads.push({ limit: l ? l.n : Infinity, got: ids.length });
        const out = {}; ids.forEach(id => { out[id] = DB[id]; });
        return { val: () => (ids.length ? out : null) };
      },
      update: async () => {}, push: () => ({ key: 'k' }), runTransaction: async () => {}, authUid: () => 'uA', now: () => 1,
    };
    return { bb: M.createBugBoard(deps), reads };
  };
  // [다음] 을 끝까지 누른다 — 화면(bug-board-ui.js)처럼 커서를 쌓는다
  const walk = async (bb, filter) => {
    const cursors = [null], pages = [];
    for (let guard = 0; guard < 10; guard++) {
      const r = await bb.listPage(filter, cursors[cursors.length - 1]);
      pages.push(r.items.map(it => it.id));
      if (r.next == null) break;
      cursors.push(r.next);
    }
    return { pages, cursors };
  };
  pending.push((async () => {
    const DB = mk();
    const { bb, reads } = fake(DB);
    const { pages, cursors } = await walk(bb, 'all');
    const ids = [].concat(...pages);
    const P = M.BUG_PAGE;
    chk(pages[0].length === P - 1 && !pages[0].some(id => /^n/.test(id)), '§4 전체 1쪽: 받은 ' + P + '개 중 공지 1개는 빼고 ' + (P - 1) + '개 (공지는 위에 따로 고정)');
    chk(pages.map(p => p.length).join(' · ') === '7 · 7 · 8 · 8 · 8 · 7', '§4 전체: 글 45개 + 공지 2개 → 7 · 7 · 8 · 8 · 8 · 7 여섯 쪽 (' + pages.map(p => p.length).join(' · ') + ')');
    chk(pages.every(p => p.length <= P), '§4 한 쪽에 ' + P + '개 넘게 안 보인다');
    chk(ids.length === 45 && new Set(ids).size === 45, '§4 전체: 45개가 빠짐 · 겹침 없이 다 나온다');
    chk(ids.every((id, i) => i === 0 || DB[ids[i - 1]].ts > DB[id].ts), '§4 전체: 쪽을 넘겨도 최근 → 오래된 순서가 이어진다');
    chk(reads.every(r => r.limit <= 20 && r.got <= 20), '§4 한 번에 20개 넘게 받지 않는다 (노드를 통째로 안 받는다 · 받은 수 ' + reads.map(r => r.got).join('/') + ')');
    const back = await bb.listPage('all', cursors[1]);
    chk(JSON.stringify(back.items.map(it => it.id)) === JSON.stringify(pages[1]), '§4 [이전] 으로 돌아와도 같은 쪽');
    const notes = await bb.notices();
    chk(notes.length === 2 && notes[0].id === 'n1', '§4 공지는 따로 읽어 맨 위(최근 것 먼저)');
  })());
  pending.push((async () => {
    const DB = mk();
    const { bb, reads } = fake(DB);
    const { pages } = await walk(bb, 'open');
    const ids = [].concat(...pages);
    const want = Object.keys(DB).filter(id => typeof DB[id].openTs === 'number');
    chk(ids.length === want.length && new Set(ids).size === want.length && ids.every(id => typeof DB[id].openTs === 'number'),
      '§4 미해결: ' + want.length + '개가 빠짐 · 겹침 없이 · 해결된 글은 안 섞인다');
    chk(reads.every(r => r.got <= 20), '§4 미해결도 한 번에 20개까지');
  })());
  pending.push((async () => {
    // 딱 한 쪽만큼이면 [다음] 이 한 번 켜지고 2쪽은 비어 «더 이전 제보가 없어요» (하나 더 미리 보지 않아서 생기는 헛걸음 한 번)
    const DB = {};
    for (let i = 0; i < M.BUG_PAGE; i++) DB['q' + i] = { vis: 'pub', status: 'fixed', cat: 'bug', ts: 500 + i };
    const { bb } = fake(DB);
    const { pages } = await walk(bb, 'all');
    chk(pages.length === 2 && pages[0].length === M.BUG_PAGE && pages[1].length === 0, '§4 딱 ' + M.BUG_PAGE + '개 → 1쪽 ' + M.BUG_PAGE + ' · 2쪽 빈 쪽에서 끝');
  })());
}

say('§5 창이 안 늘어난다 (CSS)');
{
  const rule = (sel) => {
    const re = new RegExp('(^|\\n)\\s*' + sel.replace(/[.*+?^${}()|[\]\\#]/g, '\\$&') + '\\{([^}]*)\\}');
    const m = HTML.match(re); return m ? m[2].replace(/\s+/g, '') : '';
  };
  const pg = rule('#mhPageBugreport'), rows = rule('#bbRows'), lv = rule('#bbListView'), board = rule('#bbBoard'), pager = rule('.bb-pager');
  const fr = (HTML.match(/#mhPageFriend\.on\{[^}]*height:(\d+)px/) || [])[1];
  chk(/(^|;)height:440px/.test(pg) && /overflow-y:auto/.test(pg) && fr === '440',
    '§5 버그제보 페이지 높이는 440px 로 고정(친구 탭과 같음) — min-height 만 두면 목록만큼 창이 늘어난다');
  chk(/height:100%/.test(board) && /display:flex/.test(lv) && /flex-direction:column/.test(lv) && /height:100%/.test(lv),
    '§5 목록 화면은 페이지 높이를 채우는 세로 flex');
  chk(/overflow-y:auto/.test(rows) && /flex:11(0|0px)/.test(rows), '§5 #bbRows 가 남은 높이를 받고 그 안에서 스크롤한다');
  chk(/flex-shrink:0/.test(pager) && /flex-shrink:0/.test(rule('.bb-bar')), '§5 [이전]/[다음] · 위 단추 줄은 줄어들지 않는다(늘 보인다)');
  chk(/rows\.scrollTop = 0/.test(UI), '§5 쪽을 넘기면 목록 스크롤을 맨 위로');
}

say('§6 글쓴이 답글');
{
  const AU = /bugBoard\/list\/'\+\$id\+'\/authUid'\)\.val\(\) === auth\.uid/;
  for (const v of ['pub', 'prv']) {
    const n = at('bugBoard/rep/' + v + '/$id/$rid') || {};
    const w = S(n['.write']);
    chk(AU.test(w) && /!data\.exists\(\)/.test(w) && new RegExp("vis'\\)\\.val\\(\\) === '" + v + "'").test(w) && /!root\.child\('bugBoard\/list\/'\+\$id\+'\/notice'\)\.exists\(\)/.test(w),
      '§6 rep/' + v + ' 쓰기 = 그 글의 글쓴이 · 새 답글만 · 글의 공개 범위 갈래 · 공지 아님');
    chk(/newData\.child\('ts'\)\.val\(\) === now/.test(w) && /child\('list\/'\+\$id\+'\/userReplyTs'\)\.val\(\) === now/.test(w), '  ↳ 답글 ts 는 서버 시각 · 같은 묶음에 userReplyTs === now 짝');
    const vd = S(n['.validate']);
    chk(/length <= 1000/.test(vd) && /st'\)\.val\(\)\.matches\(\/\^\(checking\|unfixed\|fixed\)\$\/\)/.test(vd) && (n.$other || {})['.validate'] === 'false', '  ↳ 1000자 · st 는 글쓴이 상태 셋만 · 다른 칸 못 넣음');
  }
  chk(S(at('bugBoard/rep/pub/$id')['.read']) === 'true' && AU.test(S(at('bugBoard/rep/prv/$id')['.read'])) && ADMIN.test(S(at('bugBoard/rep/prv/$id')['.read'])),
    '§6 비공개 글의 답글은 글쓴이 · 관리자만 읽는다 (공개 글은 누구나)');
  chk(at('bugBoard/rep')['.read'] === undefined && at('bugBoard/rep/prv')['.read'] === undefined, '  rep · rep/prv 통째 읽기는 열려 있지 않다');
  const ur = S(at('bugBoard/list/$id/userReplyTs')['.write']);
  chk(/data\.parent\(\)\.child\('authUid'\)\.val\(\) === auth\.uid/.test(ur) && /newData\.val\(\) === now/.test(ur) && /now - data\.val\(\) >= 10000/.test(ur) && /rep\/'\+data\.parent\(\)\.child\('vis'\)\.val\(\)/.test(ur),
    '§6 userReplyTs = 글쓴이만 · 서버 시각 · 10초에 한 번 · 답글이 있어야');
  const sw = S(at('bugBoard/list/$id/status')['.write']);
  chk(/matches\(\/\^\(checking\|unfixed\|fixed\)\$\/\)/.test(sw) && /userReplyTs'\)\.val\(\) === now/.test(sw) && /!data\.parent\(\)\.child\('notice'\)\.exists\(\)/.test(sw),
    '§6 글쓴이 상태 변경은 확인 중 · 해결 안 됨 · 해결 완료만 · 답글과 한 묶음 · 공지 아님 (접수 · 재현 안 됨은 관리자만)');
  const ow = S(at('bugBoard/list/$id/openTs')['.write']);
  chk(/newData\.val\(\) === data\.parent\(\)\.child\('ts'\)\.val\(\)/.test(ow) && /!newData\.exists\(\)/.test(ow) && /\(new\|checking\|unfixed\)/.test(ow), '  ↳ openTs 는 미해결이면 그 글의 ts, 아니면 지움 — 다른 값은 못 넣는다');
  const ruleSt = (S(at('bugBoard/list/$id')['.validate']).match(/status'\)\.val\(\)\.matches\(\/\^\(([^)]*)\)\$\/\)/) || [, ''])[1].split('|').sort().join('|');
  chk(Object.keys(M.BUG_STATUS).sort().join('|') === ruleSt, '§6 상태 목록이 규칙과 같다 (' + ruleSt + ')');
  chk(M.BUG_AUTHOR_STATUS.map(x => x[0]).join('|') === 'checking|unfixed|fixed' && M.BUG_AUTHOR_STATUS.find(x => x[0] === 'fixed')[1] === '해결 완료', '§6 글쓴이 버튼 — 확인 중 · 해결 안 됨 · 해결 완료(= fixed)');
  chk(M.isOpenStatus('unfixed') && M.isOpenStatus('new') && M.isOpenStatus('checking') && !M.isOpenStatus('fixed') && !M.isOpenStatus('norepro'), '§6 «해결 안 됨» 은 미해결 목록에 낀다');
  chk(M.hasAuthorReply({ userReplyTs: 9, lastReplyTs: 5 }) && M.hasAuthorReply({ userReplyTs: 9 }) && !M.hasAuthorReply({ userReplyTs: 5, lastReplyTs: 9 }) && !M.hasAuthorReply({}),
    '§6 관리자 «✍ 글쓴이 답글» = 운영자 마지막 답변보다 뒤');

  const SV = { '.sv': 'timestamp' };
  const mkBB = (item, me) => {
    const writes = [], reads = [];
    const bb = M.createBugBoard({ db: {}, ref: (_, p) => p || '',
      get: async (p) => { reads.push(p); return { val: () => (p === 'bugBoard/list/p1' ? item : p === 'bugBoard/rep/prv/p1' ? { r0: { text: '앞 답글', ts: 50, st: 'unfixed' } } : p === 'bugBoard/ans/prv/p1' ? { a0: { text: '운영', ts: 40 } } : null) }; },
      update: async (_, w) => { writes.push(w); }, push: () => ({ key: 'r1' }), runTransaction: async () => {},
      query: () => null, orderByChild: () => null, limitToLast: () => null, endBefore: () => null, equalTo: () => null,
      authUid: () => me, now: () => 1000, serverTs: () => SV });
    return { bb, writes, reads };
  };
  const base = { vis: 'prv', status: 'fixed', cat: 'bug', authUid: 'uA', code: 'CA', ts: 77, ansN: 1, lastReplyTs: 40 };
  pending.push((async () => {
    let t = mkBB(base, 'uA');
    let r = await t.bb.addReply('p1', { text: ' 아직 그대로예요 ', status: 'unfixed' });
    const w = t.writes[0] || {};
    chk(r.ok && JSON.stringify(w) === JSON.stringify({ 'bugBoard/rep/prv/p1/r1': { text: '아직 그대로예요', ts: SV, st: 'unfixed' }, 'bugBoard/list/p1/userReplyTs': SV, 'bugBoard/list/p1/status': 'unfixed', 'bugBoard/list/p1/openTs': 77 }),
      '§6 addReply(해결 안 됨) — 답글 · userReplyTs(서버 시각) · 상태 · openTs=글 ts 한 묶음, lastReplyTs · ansN 은 안 건드림');
    t = mkBB(Object.assign({}, base, { status: 'unfixed', openTs: 77 }), 'uA');
    await t.bb.addReply('p1', { text: '고쳐졌어요', status: 'fixed' });
    chk(t.writes[0]['bugBoard/list/p1/openTs'] === null && t.writes[0]['bugBoard/list/p1/status'] === 'fixed', '§6 해결 완료 → 미해결 목록에서 빠진다(openTs 지움)');
    t = mkBB(base, 'uA');
    await t.bb.addReply('p1', { text: '덧붙여요', status: '' });
    chk(Object.keys(t.writes[0]).join() === 'bugBoard/rep/prv/p1/r1,bugBoard/list/p1/userReplyTs' && !('st' in t.writes[0]['bugBoard/rep/prv/p1/r1']), '§6 상태 없이 부르면 답글 · userReplyTs 만 (데이터 함수 · 화면은 늘 하나를 고른다)');
    t = mkBB(base, 'uA');
    await t.bb.addReply('p1', { text: 'x', status: 'norepro' });
    chk(!('bugBoard/list/p1/status' in t.writes[0]), '  ↳ 글쓴이 상태 셋 밖(재현 안 됨)은 무시');
    t = mkBB(base, 'uB');
    r = await t.bb.addReply('p1', { text: 'x' });
    chk(!r.ok && !t.writes.length, '§6 남의 글에는 답글을 못 단다');
    t = mkBB(Object.assign({}, base, { vis: 'pub', notice: true }), 'uA');
    r = await t.bb.addReply('p1', { text: 'x' });
    chk(!r.ok && !t.writes.length, '  ↳ 공지에도 못 단다');
    t = mkBB(base, 'uA');
    r = await t.bb.addReply('p1', { text: '   ' });
    chk(!r.ok && !t.writes.length, '  ↳ 빈 답글은 안 보낸다');
    t = mkBB(Object.assign({}, base, { userReplyTs: 50 }), 'uA');
    const d = await t.bb.getPost('p1');
    chk(d.answers.map(a => (a.byAuthor ? '글쓴이' : '운영') + ':' + a.ts).join(',') === '운영:40,글쓴이:50' && d.answers[1].st === 'unfixed', '§6 상세 — 운영자 답변과 글쓴이 답글을 시간순으로');
    t = mkBB(base, 'uA');
    await t.bb.getPost('p1');
    chk(!t.reads.some(p => /rep\//.test(p)), '  ↳ 답글을 단 적 없는 글(userReplyTs 없음)은 rep 를 읽지 않는다');
  })());
  chk(/else if\(it\.authUid === myUid\(\) && !it\.notice\) h\.push\(authorForm\(it\)\)/.test(UI) && /if\(admin\(\)\) h\.push\(adminForm\(it\)\);\n\s*else if/.test(UI), '§6 답글 칸은 내 글 · 공지 아님 · 관리자가 아닐 때(관리자는 답변 칸)');
  chk(/class="bb-new mine">✍ 글쓴이 답글/.test(UI) && /admin\(\) && C\(\)\.hasAuthorReply/.test(UI), '§6 관리자 목록 줄에 «✍ 글쓴이 답글»');
  chk(/✍ 글쓴이 답글<span class="bb-ans-v">/.test(UI) && /if\(a\.byAuthor\)/.test(UI), '§6 상세의 글쓴이 답글은 «🛡 운영자 답변» 과 따로 그린다');
  chk(!/'그대로'/.test(UI) && /const AUTHOR_DEFAULT_ST = 'unfixed';/.test(UI) && /const sts = C\(\)\.authorStatus \|\| \[\];/.test(UI) && /s\[0\] === AUTHOR_DEFAULT_ST \? ' on'/.test(UI),
    '§6 상태 버튼은 셋(확인 중 · 해결 안 됨 · 해결 완료) · «그대로» 없음 · 기본은 해결 안 됨');
  chk(/\.bb-chip\.unfixed\{/.test(HTML) && /\.bb-ans\.mine\{/.test(HTML) && /\.bb-row2 \.bb-rst\.on\{/.test(HTML), '§6 CSS — 해결 안 됨 칩 · 글쓴이 답글 · 고른 상태 버튼(오픈카톡 .bb-btn.on 보다 강하게)');
}

Promise.all(pending).catch(e => chk(false, '검사가 던졌다: ' + (e && e.stack || e))).then(() => {
  say('');
  say(fail ? '문제 ' + fail + '건' : '전부 통과 ✅ — 비공개 제보 본문은 서버에서 막히고(제목만 공개 · 이름은 익명), 답변 알림이 우편함으로 간다');
  process.exit(fail ? 1 : 0);
});
