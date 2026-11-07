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
     §7 공개 범위 바꾸기 — 답변 · 답글 전 · 글쓴이만 · 본문은 그대로 옮기기만(규칙) · canChangeVis · setVis 실행 · 화면 · 깨 보기
     §9 임시저장 — 읽기(깨짐 · 다른 계정 · 빈 글 · 최근 순 · 3개) · 저장(빈 글 · 새 글 · 불러온 글 덮기 · 3개 참) · 지우기 · «쓰던 글» 판정 · 화면 배선(목록 · [임시저장] · 떠날 때 묻기 · 등록하면 지움 · Esc) · 계정 바꾸면 지움 · 깨 보기
     §10 임시저장 동작 — 게시판 화면 코드를 가짜 화면에 싣고 눌러 본다(3개 참 · 저장하고 나가기 · 고리 LEAVE_GUARD · 다시 불러오기 · 등록 · 찾는 동안 떠나기 · 탭 다시 누르기) · 깨 보기
     §8 비슷한 제보 — 제목 낱말 · 겹침 정도(실제 제보 제목 모양) · 고르기(공지 빼기 · 한 번만 · 3줄 · 순서) · 가짜 RTDB 로 받는 양(미해결 · 최근 각 20) · 화면 배선 · 깨 보기
   ⚠️ 규칙을 **실제로 돌려 본 것**은 이 검사가 아니다(에뮬레이터 필요). 그 결과는 커밋 메시지에 남겼다. */
'use strict';
const { stripReadGate } = require('./sim-rules-src.js');   // 옛 앱 읽기 막기 조건을 걷고 본다(개정 375)
const fs = require('fs');
const say = console.log;
let fail = 0;
const pending = [];
const chk = (ok, msg) => { if (!ok) fail++; say((ok ? '  ✓ ' : '  ✗ ') + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const RULES = stripReadGate(read('firebase-database-rules.json')), BB = read('bug-board.js'), UI = read('bug-board-ui.js');
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
  // 앞의 서버 봇 갈래(apiBots — API 읽기 사본)를 걷고 본다: 사람은 limitToLast ≤ 20 쿼리만
  const human = lr.replace("(auth != null && root.child('apiBots').child(auth.uid).val() === true) || (", '');
  chk(!!m && +m[1] <= 20 && /^query\.limitToLast <= \d+ && \(/.test(human), '③ 목록 읽기는 limitToLast ≤ 20 쿼리만 (' + (m ? m[1] : '없음') + ')');
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
  '\nreturn { BUG_DRAFT_KEY, BUG_DRAFT_MAX, draftsRead, draftsWrite, draftsSave, draftsRemove, draftDirty, draftIsEmpty, BUG_SIMILAR_MAX, BUG_SIMILAR_MIN, BUG_SIMILAR_FETCH, titleWords, titleSimilarity, similarPosts, BUG_STATUS, BUG_AUTHOR_STATUS, isOpenStatus, hasAuthorReply, BUG_CATS, BUG_DAILY_MAX, BUG_PAGE, BUG_MINE_MAX, BUG_ANON, KAKAO_RE, checkPost, listEntry, contentEntry, unseenCount, answerNoticeBody, pageOf, ymd, dailyMaxOf, createBugBoard, canChangeVis, BUG_VIS_NOTE, BUG_VIS_LOCKED };')();
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
chk(/m\.tag === 'bug' && m\.bugId\)\{\s*_inboxOpenId = null; window\._bugBoardOpen\(m\.bugId\)/.test(APP), '우편함에서 누르면 그 글을 연다');
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
  chk(M.BUG_STATUS.review === '검토중' && M.isOpenStatus('review') && !M.BUG_AUTHOR_STATUS.some(x => x[0] === 'review') && /\.bb-chip\.review\{/.test(HTML),
      '§6 «검토중»(review) — 관리자 상태 · 미해결 목록에 낀다 · 글쓴이 버튼엔 없다 · 칩 색');
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
  chk(/else if\(it\.authUid === myUid\(\) && !it\.notice\) h\.push\((visForm\(it, d\.answers\) \+ )?authorForm\(it\)\)/.test(UI) && /if\(admin\(\)\) h\.push\(adminForm\(it\)\);\n\s*else if/.test(UI), '§6 답글 칸은 내 글 · 공지 아님 · 관리자가 아닐 때(관리자는 답변 칸)');
  chk(/class="bb-new mine">✍ 글쓴이 답글/.test(UI) && /admin\(\) && C\(\)\.hasAuthorReply/.test(UI), '§6 관리자 목록 줄에 «✍ 글쓴이 답글»');
  chk(/✍ 글쓴이 답글<span class="bb-ans-v">/.test(UI) && /if\(a\.byAuthor\)/.test(UI), '§6 상세의 글쓴이 답글은 «🛡 운영자 답변» 과 따로 그린다');
  chk(!/'그대로'/.test(UI) && /const AUTHOR_DEFAULT_ST = 'unfixed';/.test(UI) && /const sts = C\(\)\.authorStatus \|\| \[\];/.test(UI) && /s\[0\] === AUTHOR_DEFAULT_ST \? ' on'/.test(UI),
    '§6 상태 버튼은 셋(확인 중 · 해결 안 됨 · 해결 완료) · «그대로» 없음 · 기본은 해결 안 됨');
  chk(/\.bb-chip\.unfixed\{/.test(HTML) && /\.bb-ans\.mine\{/.test(HTML) && /\.bb-row2 \.bb-rst\.on\{/.test(HTML), '§6 CSS — 해결 안 됨 칩 · 글쓴이 답글 · 고른 상태 버튼(오픈카톡 .bb-btn.on 보다 강하게)');
}


say('§7 공개 범위 바꾸기');
{
  const S7 = (x) => S(x || '');
  const vw = S7((at('bugBoard/list/$id/vis') || {})['.write']);
  const nw = S7((at('bugBoard/list/$id/name') || {})['.write']);
  const pw = S7((at('bugBoard/pub/$id') || {})['.write']);
  const qw = S7((at('bugBoard/prv/$authUid/$id') || {})['.write']);
  const GATE = ['bugBoard/ans/pub/', 'bugBoard/ans/prv/', 'bugBoard/rep/pub/', 'bugBoard/rep/prv/'];
  chk(/data\.parent\(\)\.child\('authUid'\)\.val\(\) === auth\.uid/.test(vw) && /!data\.parent\(\)\.child\('notice'\)\.exists\(\)/.test(vw)
    && GATE.every(g => vw.includes("!root.child('" + g + "'+$id).exists()")) && /!data\.parent\(\)\.child\('lastReplyTs'\)\.exists\(\)/.test(vw) && /!data\.parent\(\)\.child\('userReplyTs'\)\.exists\(\)/.test(vw),
    '§7 규칙 vis 쓰기 — 글쓴이 · 공지 아님 · 운영자 답변 · 글쓴이 답글(pub · prv 둘 다) 없음');
  chk(vw.includes("newData.parent().child('name').val() === '" + M.BUG_ANON + "'") && /newData\.val\(\) === 'prv' && .*child\('prv\/'\+auth\.uid\+'\/'\+\$id\)\.exists\(\) && !.*child\('pub\/'\+\$id\)\.exists\(\)/.test(vw)
    && /newData\.val\(\) === 'pub' && .*child\('pub\/'\+\$id\)\.exists\(\) && !.*child\('prv\/'\+auth\.uid\+'\/'\+\$id\)\.exists\(\)/.test(vw),
    '  ↳ 비공개로 가면 이름은 «익명»(앱 BUG_ANON 과 같은 글자) · 본문이 반대쪽 칸으로 옮겨진 묶음일 때만');
  chk(/newData\.parent\(\)\.child\('vis'\)\.val\(\) !== data\.parent\(\)\.child\('vis'\)\.val\(\)/.test(nw) && /authUid'\)\.val\(\) === auth\.uid/.test(nw),
    '§7 규칙 name 쓰기 — 글쓴이가 공개 범위를 함께 바꿀 때만(이름만 따로 못 바꾼다)');
  const eq = (w, src) => ['title', 'body', 'env'].every(k => w.includes("newData.child('" + k + "').val() === root.child('" + src + "+'/" + k + "').val()"));
  chk(eq(pw, "bugBoard/prv/'+auth.uid+'/'+$id") && eq(qw, "bugBoard/pub/'+$id") && pw.includes("!root.child('bugBoard/list/'+$id).exists() ||") && qw.includes("!root.child('bugBoard/list/'+$id).exists() ||"),
    '§7 규칙 본문 — 바꿀 때 새 칸은 옛 칸과 제목 · 본문 · 환경이 같아야(이 길로 글을 못 고친다) · 처음 쓸 때는 그대로');
  chk(/data\.exists\(\) && !newData\.exists\(\) && root\.child\('bugBoard\/list\/'\+\$id\+'\/authUid'\)\.val\(\) === auth\.uid && root\.child\('bugBoard\/list\/'\+\$id\+'\/vis'\)\.val\(\) === 'pub' && newData\.parent\(\)\.parent\(\)\.child\('list\/'\+\$id\+'\/vis'\)\.val\(\) === 'prv'/.test(pw)
    && /auth\.uid === \$authUid && data\.exists\(\) && !newData\.exists\(\) && .*vis'\)\.val\(\) === 'prv' && newData\.parent\(\)\.parent\(\)\.parent\(\)\.child\('list\/'\+\$id\+'\/vis'\)\.val\(\) === 'pub'/.test(qw),
    '  ↳ 옛 칸 지우기는 글쓴이가 그 묶음에서 공개 범위를 반대로 바꿀 때만');
  chk(/ADMIN|admins/.test(S7((at('bugBoard/ans/pub/$id') || {})['.write'])) && /admins/.test(S7((at('bugBoard/ans/prv/$id') || {})['.write'])),
    '  ↳ 운영자 답변 칸 쓰기는 그대로 관리자만(글쓴이가 옮기지 못하게 — 그래서 답변 전까지만)');

  const it0 = { vis: 'pub', authUid: 'uA', ts: 5 };
  chk(M.canChangeVis(it0, 'uA', []) && !M.canChangeVis(it0, 'uB', []) && !M.canChangeVis(it0, null, []) && !M.canChangeVis(null, 'uA', [])
    && !M.canChangeVis(Object.assign({}, it0, { notice: true }), 'uA', []) && !M.canChangeVis(Object.assign({}, it0, { lastReplyTs: 9 }), 'uA', [])
    && !M.canChangeVis(Object.assign({}, it0, { ansN: 1 }), 'uA', []) && !M.canChangeVis(Object.assign({}, it0, { userReplyTs: 9 }), 'uA', [])
    && !M.canChangeVis(it0, 'uA', [{ text: 'x' }]),
    '§7 canChangeVis — 내 글 · 공지 아님 · 답변(lastReplyTs · ansN · 상세 답변) · 내 답글(userReplyTs) 없을 때만');
  chk(/운영자 답변이나 내 답글이 달리기 전까지만/.test(M.BUG_VIS_NOTE) && /바꿀 수 없어요/.test(M.BUG_VIS_LOCKED), '  ↳ 안내 · 잠김 문구');

  const mkV = (item, me, content, fail) => {
    const writes = [];
    const bb = M.createBugBoard({ db: {}, ref: (_, p) => p || '',
      get: async (p) => ({ val: () => (p === 'bugBoard/list/v1' ? item : (p === 'bugBoard/pub/v1' || p === 'bugBoard/prv/uA/v1') ? content : null) }),
      update: async (_, w) => { if(fail) throw new Error(fail); writes.push(w); }, push: () => ({ key: 'k' }), runTransaction: async () => {},
      query: () => null, orderByChild: () => null, limitToLast: () => null, endBefore: () => null, equalTo: () => null,
      authUid: () => me, now: () => 1000, serverTs: () => ({ '.sv': 'timestamp' }) });
    return { bb, writes };
  };
  const C1 = { title: '제목', body: '본문', env: 'v0.12.2 · win' };
  pending.push((async () => {
    let t = mkV({ vis: 'pub', authUid: 'uA', name: '에이', ts: 5 }, 'uA', C1);
    let r = await t.bb.setVis('v1', 'prv', who);
    chk(r.ok && r.item.vis === 'prv' && JSON.stringify(t.writes[0]) === JSON.stringify({ 'bugBoard/list/v1/vis': 'prv', 'bugBoard/list/v1/name': M.BUG_ANON, 'bugBoard/prv/uA/v1': C1, 'bugBoard/pub/v1': null }),
      '§7 setVis(공개→비공개) — vis · 이름 «익명» · 본문을 prv 로 그대로 · pub 지움 한 묶음');
    t = mkV({ vis: 'prv', authUid: 'uA', name: '익명', ts: 5 }, 'uA', { title: '제목', body: '본문' });
    r = await t.bb.setVis('v1', 'pub', { name: '에이가 바꾼 이름이 이십 자를 넘게 길어요', code: 'CA' });
    const w2 = t.writes[0] || {};
    chk(r.ok && w2['bugBoard/list/v1/name'] === '에이가 바꾼 이름이 이십 자를 넘게 길어요'.slice(0, 20) && JSON.stringify(w2['bugBoard/pub/v1']) === JSON.stringify({ title: '제목', body: '본문' }) && w2['bugBoard/prv/uA/v1'] === null,
      '§7 setVis(비공개→공개) — 지금 이름(20자) · 본문을 pub 로 · prv 지움(환경 없으면 env 칸 없음)');
    for (const [extra, why] of [[{ lastReplyTs: 9 }, '운영자 답변이 있으면'], [{ userReplyTs: 9 }, '내 답글이 있으면'], [{ notice: true }, '공지면']]) {
      t = mkV(Object.assign({ vis: 'pub', authUid: 'uA', ts: 5 }, extra), 'uA', C1);
      r = await t.bb.setVis('v1', 'prv', who);
      chk(!r.ok && !t.writes.length, '§7 ' + why + ' 안 바꾼다(쓰기 없음)');
    }
    t = mkV({ vis: 'pub', authUid: 'uA', ts: 5 }, 'uB', C1);
    r = await t.bb.setVis('v1', 'prv', who);
    chk(!r.ok && !t.writes.length, '§7 남의 글은 못 바꾼다');
    t = mkV({ vis: 'pub', authUid: 'uA', ts: 5 }, 'uA', C1);
    r = await t.bb.setVis('v1', 'pub', who);
    chk(r.ok && !t.writes.length, '  ↳ 같은 공개 범위면 쓰지 않는다');
    t = mkV({ vis: 'pub', authUid: 'uA', ts: 5 }, 'uA', null);
    r = await t.bb.setVis('v1', 'prv', who);
    chk(!r.ok && !t.writes.length, '  ↳ 본문을 못 읽으면 쓰지 않는다(빈 글로 옮기지 않게)');
    t = mkV({ vis: 'pub', authUid: 'uA', ts: 5 }, 'uA', C1, 'PERMISSION_DENIED');
    r = await t.bb.setVis('v1', 'prv', who);
    chk(!r.ok && r.reason === M.BUG_VIS_LOCKED, '  ↳ 규칙이 거부하면(그사이 답변이 달림) 잠김 문구');
    // 깨 보기 — 잠김 조건 하나를 빼면 위 검사가 빨강이 나는지(답글 조건)
    const broken = new Function('return ' + M.canChangeVis.toString().replace('&& !it.userReplyTs ', ''))();
    chk(broken(Object.assign({}, it0, { userReplyTs: 9 }), 'uA', []) === true, '  ↳ 깨 보기 — 답글 조건을 빼면 잠긴 글이 바뀌게 된다(검사가 그 조건을 본다)');
  })());

  chk(/else if\(it\.authUid === myUid\(\) && !it\.notice\) h\.push\(visForm\(it, d\.answers\) \+ authorForm\(it\)\)/.test(UI), '§7 화면 — 바꾸기 버튼은 내 글 · 공지 아님 · 관리자 아닐 때(답글 칸 위)');
  chk(/data-act="vis"/.test(UI) && /else if\(act === 'vis'\) submitVis\(el\)/.test(UI) && /\(can \? '' : ' disabled'\)/.test(UI) && /C\(\)\.visNote : C\(\)\.visLocked/.test(UI),
    '  ↳ 못 바꾸면 버튼을 흐리게 · 안내 / 잠김 문구를 옆에');
  chk(/name="bbWVis" value="prv"> 비공개 \(나와 관리자만\)<\/label>\s*<div class="bb-hint">공개 범위는 운영자 답변이나 내 답글이 달리기 전까지만 바꿀 수 있어요\.<\/div>/.test(HTML),
    '  ↳ 제보 쓰기 창 «공개 범위» 아래에도 같은 안내');
}

say('§8 비슷한 제보');
{
  const W = M.titleWords;
  chk(W('레벨이 안 올라가요').join() === '레벨,올라가' && W('키보드 입력이 안돼요').join() === '키보드,입력' && W('라이선스 문의').join() === '라이선스',
    '제목 낱말 — 조사 · 말끝 · 흔한 말(문의 · 안돼요)을 뗀다');
  chk(W('').length === 0 && W(null).length === 0 && W('오류 버그 문제').length === 0 && W('!!! ???').length === 0, '  빈 제목 · 흔한 말뿐 · 기호뿐 → 낱말 없음');
  const S = M.titleSimilarity;
  chk(S('레벨이 안 올라가요', '레벨이 안올라요') >= M.BUG_SIMILAR_MIN && S('맥에서 키보드 인식 안됨', '키보드 인식 오류') >= M.BUG_SIMILAR_MIN
    && S('좌석 간격이 넓어요', '여전히 좌석 간격이 넓습니다') >= M.BUG_SIMILAR_MIN, '★ 띄어쓰기 · 말끝 · 앞뒤 말이 달라도 같은 문제는 비슷함(레벨 · 키보드 · 좌석 간격)');
  chk(S('레벨이 안 올라가요', '플레이리스트 재생이 안 돼요') < M.BUG_SIMILAR_MIN && S('친구 추가가 안돼요', '유튜브 영상이 검게 나와요') < M.BUG_SIMILAR_MIN
    && S('라이선스 문의', '') === 0 && S('', '') === 0, '  다른 문제 · 빈 제목은 비슷하지 않다');
  const items = [
    { id: 'a', ts: 5, status: 'checking', title: '레벨이 안올라요' },
    { id: 'b', ts: 9, status: 'fixed', title: '레벨이 안 올라요' },
    { id: 'c', ts: 7, status: 'norepro', title: '레벨이 안 오르는 것 같아요' },
    { id: 'd', ts: 8, status: 'new', title: '레벨이 안 올라요', notice: true },
    { id: 'e', ts: 6, status: 'new', title: '플레이리스트 재생이 안 돼요' },
    { id: 'f', ts: 4, status: 'fixed', title: '레벨 안 올라요' },
    { id: 'i', ts: 1, status: 'new', title: '레벨이 안 올라가요 ㅠ' },
    { id: 'b', ts: 9, status: 'fixed', title: '레벨이 안 올라요' },
    { id: 'g', ts: 3, status: 'new', title: '' }, { id: 'h', ts: 2, status: 'new' }, null,
  ];
  const got = M.similarPosts('레벨이 안 올라가요', items).map(it => it.id);
  chk(M.BUG_SIMILAR_MAX === 3 && got.length === 3 && !got.includes('d') && !got.includes('e') && new Set(got).size === 3, '★ 고르기 — 많아야 3줄 · 공지 · 다른 문제 · 제목 없는 글은 빼고 · 같은 글은 한 번만(' + got.join() + ')');
  const sc = got.map(id => S('레벨이 안 올라가요', items.find(x => x && x.id === id).title));
  chk(sc.every((v, i) => i === 0 || sc[i - 1] >= v), '  겹친 정도가 큰 것부터(같으면 최근 것)');
  chk(M.similarPosts('레벨이 안 올라가요', items, 1).length === 1 && M.similarPosts('', items).length === 0 && M.similarPosts('레벨', null).length === 0, '  상한 1 · 빈 제목 · 받은 글 없음');
  /* 깨 보기 — 규칙을 망가뜨린 모듈로 다시 고르면 위 판정이 깨지는가 */
  const mut = (from, to) => { if(!BB.includes(from)) return null; return new Function(BB.replace(from, to).replace(/^export (function|const) /mg, '$1 ') + '\nreturn { similarPosts, titleWords };')(); };
  const red = (X) => {
    if(!X) return false;   // 바꿔 칠 글을 못 찾음 — 조용히 «통과» 하지 않게 빨강
    const g = X.similarPosts('레벨이 안 올라가요', items).map(it => it.id), g2 = X.similarPosts('플레이리스트 재생 문제', items).map(it => it.id);
    return g.length !== 3 || g.includes('d') || g.includes('e') || new Set(g).size !== 3 || g2.join() !== 'e' || X.titleWords('키보드 입력이 안돼요').join() !== '키보드,입력' || X.titleWords('맥 키보드 입력 오류').join() !== '키보드,입력';
  };
  chk(!red({ similarPosts: M.similarPosts, titleWords: M.titleWords }), '  (깨 보기 기준) 지금 규칙은 통과');
  chk(red(mut("it.id && !it.notice && typeof", 'it.id && typeof')), '깨 보기: 공지를 안 빼면 빨강');
  chk(red(mut('.slice(0, lim).map(x => x.it)', '.map(x => x.it)')), '깨 보기: 3줄 상한을 빼면 빨강');
  chk(red(mut("!seen.has(it.id) && seen.add(it.id)", 'true')), '깨 보기: 같은 글을 두 번 넣으면 빨강');
  chk(red(mut("export const BUG_SIMILAR_MIN = 0.4;", 'export const BUG_SIMILAR_MIN = 0;')), '깨 보기: 문턱을 0 으로 내리면(다른 문제도 비슷함) 빨강');
  chk(red(mut("w.length >= 2 && !SIM_STOP.has(w)", 'w.length >= 2')), '깨 보기: 흔한 말을 안 떼면 빨강');
  pending.push((async () => {
    const DB = {};
    for (let i = 0; i < 60; i++) DB['p' + i] = { status: i % 3 ? 'fixed' : 'checking', title: i === 50 ? '레벨이 안올라요' : '다른 글 ' + i, ts: 1000 + i, ...(i % 3 ? {} : { openTs: 1000 + i }) };
    DB.n1 = { title: '레벨이 안 올라요', notice: true, ts: 2000, nts: 2000 };
    const reads = [];
    const deps = {
      db: {}, ref: (_, p) => ({ path: p || '' }), query: (r, ...cs) => ({ path: r.path, cs }),
      orderByChild: (k) => ({ t: 'o', k }), limitToLast: (n) => ({ t: 'l', n }), endBefore: (v) => ({ t: 'e', v }), equalTo: (v) => ({ t: 'q', v }),
      get: async (q) => {
        const o = q.cs.find(c => c.t === 'o'), l = q.cs.find(c => c.t === 'l');
        const ids = Object.keys(DB).filter(id => typeof DB[id][o.k] === 'number').sort((a, b) => DB[a][o.k] - DB[b][o.k]).slice(-l.n);
        reads.push({ path: q.path, k: o.k, n: l.n, got: ids.length });
        const out = {}; ids.forEach(id => { out[id] = DB[id]; }); return { val: () => (ids.length ? out : null) };
      },
      update: async () => {}, push: () => ({ key: 'k' }), runTransaction: async () => {}, authUid: () => 'uA', now: () => 1,
    };
    const bb = M.createBugBoard(deps);
    const r = await bb.similarTo('레벨이 안 올라가요');
    chk(r.length === 1 && r[0].id === 'p50', '★ similarTo — 미해결 · 최근 글에서 비슷한 글을 고른다(공지는 빼고 · 받은 두 목록이 겹쳐도 한 번)');
    chk(reads.length === 2 && reads.every(x => x.path === 'bugBoard/list' && x.n === M.BUG_SIMILAR_FETCH && x.got <= 20) && reads.map(x => x.k).sort().join() === 'openTs,ts' && M.BUG_SIMILAR_FETCH <= 20,
      '  받는 양 — 미해결(openTs) · 최근(ts) 각각 ' + M.BUG_SIMILAR_FETCH + '개 한 번씩(목록을 통째로 안 받는다 · 규칙 limitToLast ≤ 20)');
    reads.length = 0;
    chk((await bb.similarTo('오류 문제')).length === 0 && reads.length === 0, '  제목에 낱말이 없으면 받지도 않는다');
  })());
  /* 화면 배선 */
  const sw = (UI.match(/async function submitWrite\(btn, skipSimilar\)\{[\s\S]*?\n  \}/) || [''])[0];
  chk(/if\(!notice && !skipSimilar\)\{/.test(sw) && sw.indexOf('api().similarTo(p.title)') > sw.indexOf('api().checkPost(p)') && sw.indexOf('api().similarTo(p.title)') < sw.indexOf('api().createPost(p, who())'),
    '★ [등록] — 입력 확인 뒤 · 올리기 전에 비슷한 제보를 찾는다(공지 · [그래도 제보하기] 는 건너뜀)');
  chk(/catch\(_\)\{ sim = \[\]; \}/.test(sw) && /if\(sim\.length\)\{ showSimilar\(p\.title\.trim\(\), sim\); return; \}/.test(sw), '  못 받으면 창 없이 올리고 · 있으면 창을 띄우고 멈춘다');
  chk(/\$\('bbSimGo'\)\.addEventListener\('click', \(\) => \{ hideSimilar\(\); submitWrite\(\$\('bbWSubmit'\), true\); \}\);/.test(UI)
    && /\$\('bbSimCancel'\)\.addEventListener\('click', hideSimilar\);/.test(UI) && /\$\('bbSimX'\)\.addEventListener\('click', hideSimilar\);/.test(UI),
    '  [그래도 제보하기] = 비교 없이 올리기 · [취소] · × = 창만 닫기(쓰던 글 그대로)');
  chk(/\$\('bbSimRows'\)\.innerHTML = items\.map\(rowHtml\)\.join\(''\);/.test(UI) && /\$\('bbSimLead'\)\.textContent = /.test(UI), '  줄은 목록 줄 모양 그대로(상태 칩 · 비공개 잠금) · 안내 글은 textContent');
  const sh = (UI.match(/function show\(view\)\{[\s\S]*?\n  \}/) || [''])[0];
  chk(/hideSimilar\(\);/.test(sh) && /classList\.contains\('on'\) && \$\('bbSimilar'\)\.offsetParent !== null/.test(UI), '  화면을 바꾸면 닫는다 · «열림» 은 보이는 동안만(마이홈을 닫거나 탭을 옮기면 숨은 칸이 Esc 를 가로채지 않음)');
  chk(/const seq = writeSeq;/.test(sw) && sw.indexOf("if(!writing() || seq !== writeSeq) return;") > 0 && sw.indexOf("if(!writing() || seq !== writeSeq) return;") < sw.indexOf('if(sim.length)'), '  찾는 동안 떠났거나 글쓰기를 새로 열었으면(늦게 온 결과) 올리지도 띄우지도 않는다');
  /* ★ Esc — 진짜 ESC 스택(win-stack.js)과 이 화면의 Esc 처리기를 싣는 순서대로 걸고 눌러 본다 */
  const WS = read('win-stack.js');
  const escH = (UI.match(/document\.addEventListener\('keydown', \(e\) => \{\n\s*if\(e\.key !== 'Escape'\) return;\n[\s\S]*?\n\s*\}, true\);/) || [''])[0];
  const escRun = (wsSrc) => {
    const st = { mh: true, tab: true, sim: true }, closes = { mh: 0 };
    const L = [];
    const visible = () => st.sim && st.mh && st.tab;
    const doc = { addEventListener: (t, f) => { if (t === 'keydown') L.push(f); }, getElementById: () => null,
      querySelector: (sel) => sel.split(', ').some(x => x === '#myHomeOverlay.on #mhPageBugreport.on .bb-sim.on' && visible()) ? {} : null };
    const win = { __winPosResetters: [] };
    new Function('window', 'document', 'MutationObserver', wsSrc)(win, doc, class { observe(){} });
    win.TwWinStack.createWinStack({}).escRegisterWindow({ key: 'myHome', el: {}, isOpen: () => st.mh, close: () => { st.mh = false; closes.mh++; } });
    new Function('document', 'similarOpen', 'hideSimilar', 'leaveOpen', 'hideLeave', escH)(doc, visible, () => { st.sim = false; }, () => false, () => {});
    const press = () => { const e = { key: 'Escape', target: { tagName: 'DIV' }, defaultPrevented: false, preventDefault(){ this.defaultPrevented = true; }, stopPropagation(){} }; L.forEach(f => f(e)); };
    press(); const r1 = { sim: st.sim, mh: st.mh };
    press(); const r2 = { mh: st.mh };
    st.mh = true; st.sim = true; st.tab = false; press(); const r3 = { mh: st.mh };
    return { r1, r2, r3, n: L.length };
  };
  if (!WS || !escH) chk(false, '  Esc 흉내 — win-stack.js 나 Esc 처리기를 못 찾음');
  else {
    const R = escRun(WS);
    chk(R.n === 2 && R.r1.sim === false && R.r1.mh === true, '★ Esc 한 번 — «비슷한 제보» 창만 닫히고 마이홈 창은 그대로(ESC 스택이 양보)');
    chk(R.r2.mh === false, '  Esc 한 번 더 — 그때 마이홈 창이 닫힌다');
    chk(R.r3.mh === false, '  다른 마이홈 탭으로 옮긴 뒤(창이 숨음) Esc — 숨은 칸이 가로채지 않고 마이홈이 닫힌다');
    const noYield = WS.replace("  '#myHomeOverlay.on #mhPageBugreport.on .bb-sim.on',", '');
    chk(noYield !== WS && escRun(noYield).r1.mh === false, '  ↳ 깨 보기 — ESC_YIELD_SEL 줄을 빼면 Esc 한 번에 마이홈까지 닫힌다(빨강)');
  }
  const sim = (HTML.match(/<div id="bbSimilar"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/) || [''])[0];
  chk(HTML.indexOf('id="bbSimilar"') > HTML.indexOf('id="bbWriteView"') && /role="dialog"/.test(sim) && /id="bbSimRows"/.test(sim) && /그래도 제보하기/.test(sim) && /id="bbSimCancel"/.test(sim),
    '  html — 게시판 안을 덮는 칸(따로 창 없음) · 그래도 제보하기 · 취소');
}

say('§9 임시저장');
{
  chk(M.BUG_DRAFT_KEY === 'tw.bugDrafts' && M.BUG_DRAFT_MAX === 3, '이 PC 저장 키 tw. 접두사 · 최대 3개');
  const one = (id, ts, t, b) => ({ id, ts, cat: 'bug', title: t, body: b || '', vis: 'pub' });
  const raw = JSON.stringify({ owner: 'CA', items: [one('a', 1, '처음'), one('b', 3, '셋째'), one('c', 2, '', '본문만'), one('d', 4, '', ' '), one('e', 5, '다섯'), { id: 'f' }, null] });
  const R = M.draftsRead(raw, 'CA');
  chk(R.length === 3 && R.map(d => d.id).join() === 'e,b,c', '★ 읽기 — 빈 글 · 모양 틀린 줄은 버리고 · 최근 것부터 · 많아야 3개(' + R.map(d => d.id).join() + ')');
  chk(M.draftsRead(raw, 'CB').length === 0 && M.draftsRead(raw, '').length === 0, '★ 다른 계정(주인 코드가 다름) · 주인 모름이면 빈 것 — 앞 사람 글이 안 보인다');
  chk(M.draftsRead('{깨짐', 'CA').length === 0 && M.draftsRead(null, 'CA').length === 0 && M.draftsRead('[]', 'CA').length === 0, '  깨진 저장본 · 없음 → 빈 것(던지지 않음)');
  const big = M.draftsRead(JSON.stringify({ owner: 'CA', items: [one('x', 1, '가'.repeat(99), '나'.repeat(3000))] }), 'CA')[0];
  chk(big.title.length === 60 && big.body.length === 2000, '  제목 60 · 본문 2000 자까지만 남긴다');
  let L = [];
  chk(M.draftsSave(L, { title: ' ', body: '' }, 1, 'n0').ok === false && M.draftsSave(L, { title: ' ', body: '' }, 1, 'n0').reason === 'empty', '저장 — 빈 글은 저장하지 않는다');
  let r = M.draftsSave(L, { title: '하나', body: '', cat: 'bug', vis: 'prv' }, 10, 'n1'); L = r.list;
  r = M.draftsSave(L, { title: '둘', body: '' }, 20, 'n2'); L = r.list;
  r = M.draftsSave(L, { title: '셋', body: '' }, 30, 'n3'); L = r.list;
  chk(L.length === 3 && L[0].id === 'n3' && L.find(d => d.id === 'n1').vis === 'prv', '  새 글 셋 — 최근 것부터 · 공개 범위도 남긴다');
  const full = M.draftsSave(L, { title: '넷', body: '' }, 40, 'n4');
  chk(full.ok === false && full.reason === 'full', '★ 3개가 찼으면 새 글은 저장하지 않는다(«하나를 지운 뒤»)');
  r = M.draftsSave(L, { id: 'n1', title: '하나 고침', body: '본문' }, 50, 'n5');
  chk(r.ok && r.id === 'n1' && r.list.length === 3 && r.list[0].id === 'n1' && r.list[0].title === '하나 고침', '★ 불러온 글을 다시 저장하면 그 칸을 덮는다(3개가 차 있어도 · 맨 위로)');
  L = r.list;
  L = M.draftsRemove(L, 'n2');
  chk(L.length === 2 && !L.some(d => d.id === 'n2') && M.draftsRemove(L, 'zz').length === 2, '  지우기 — 그 글만 · 없는 id 는 그대로');
  const back = M.draftsRead(M.draftsWrite(L, 'CA'), 'CA');
  chk(back.length === 2 && back[0].id === 'n1' && back[0].body === '본문', '  저장본으로 쓰고 다시 읽으면 같다');
  const ld = { cat: 'bug', title: '제목', body: '본문', vis: 'pub' };
  chk(M.draftDirty({ title: '', body: ' ' }, null) === false && M.draftDirty({ title: '제목', body: '' }, null) === true
    && M.draftDirty(Object.assign({}, ld), ld) === false && M.draftDirty(Object.assign({}, ld, { body: '본문!' }), ld) === true && M.draftDirty(Object.assign({}, ld, { vis: 'prv' }), ld) === true,
    '★ «쓰던 글» — 비었으면 아님 · 새 글이면 맞음 · 불러온 그대로면 아님(안 묻는다) · 고쳤으면 맞음');
  /* 깨 보기 */
  const mutD = (from, to) => { if(!BB.includes(from)) return null; return new Function(BB.replace(from, to).replace(/^export (function|const) /mg, '$1 ') + '\nreturn { draftsRead, draftsSave, draftDirty };')(); };
  const redD = (X) => {
    if(!X) return false;
    const a = X.draftsRead(raw, 'CB').length !== 0;
    let l = []; for (const t of ['1', '2', '3']) l = X.draftsSave(l, { title: t }, Number(t), 'k' + t).list;
    const b = X.draftsSave(l, { title: '4' }, 4, 'k4').ok !== false;
    const c = X.draftDirty(Object.assign({}, ld), ld) !== false;
    return a || b || c;
  };
  chk(!redD({ draftsRead: M.draftsRead, draftsSave: M.draftsSave, draftDirty: M.draftDirty }), '  (깨 보기 기준) 지금 규칙은 통과');
  chk(redD(mutD('|| !owner || v.owner !== owner ', '')), '깨 보기: 주인 코드를 안 보면(앞 사람 글이 보임) 빨강');
  chk(redD(mutD('if(i < 0 && cur.length >= BUG_DRAFT_MAX) return', 'if(false) return')), '깨 보기: 3개 상한을 빼면 빨강');
  chk(redD(mutD("  if(!loaded) return true;\n", "  return true;\n")), '깨 보기: 불러온 그대로도 «쓰던 글» 로 보면(괜히 묻는다) 빨강');
  /* 화면 배선 */
  const fn = (name) => (UI.match(new RegExp('function ' + name + '\\([^)]*\\)\\{[\\s\\S]*?\\n  \\}')) || [''])[0];
  chk(/id="bbDrafts"/.test(HTML) && /id="bbWDraft"[^>]*>임시저장</.test(HTML) && HTML.indexOf('id="bbDrafts"') > HTML.indexOf('id="bbWriteView"') && HTML.indexOf('id="bbDrafts"') < HTML.indexOf('id="bbWCat"'),
    'html — 글쓰기 맨 위 📝 임시저장 목록 · [취소] 옆 [임시저장]');
  chk(/id="bbLeave" class="bb-sim"/.test(HTML) && /임시저장하고 나가기/.test(HTML) && /저장 안 하고 나가기/.test(HTML) && /계속 쓰기/.test(HTML), 'html — «📝 쓰던 제보가 있어요» 칸(임시저장하고 나가기 · 저장 안 하고 나가기 · 계속 쓰기)');
  chk(/localStorage\.getItem\(D\(\)\.KEY\)/.test(fn('draftsLoad')) && /D\(\)\.read\(raw, draftOwner\(\)\)/.test(fn('draftsLoad')) && /TwErrorCodes\.notify\('E-MH-04', e\)/.test(fn('draftsStore')),
    '  읽기 · 쓰기는 이 PC(localStorage) · 계정 코드로 거름 · 저장 실패는 E-MH-04');
  chk(/function askLeave\(lead, next, btns\)\{\n\s*if\(!dirty\(\)\)\{ next\(\); return; \}/.test(UI) && /\$\('bbWCancel'\)\.addEventListener\('click', \(\) => askLeave\(leaveLead\(\), \(\) => show\('list'\)\)\);/.test(UI)
    && /askLeave\(leaveLead\(\), \(\) => openPost\(row\.dataset\.id\)\)/.test(UI), '★ 떠날 때 묻기 — [취소] · 비슷한 글 보러 가기 · 쓰던 글이 없으면 묻지 않고 바로');
  chk(/if\(save && !saveDraft\(\$\('bbLeaveErr'\), true\)\) return;/.test(fn('leaveGo')), '  [임시저장하고 나가기] 가 실패하면(3개 참 · 저장 실패) 창에 남아 까닭을 보인다');
  chk(/async function enter\(\)\{\n\s*if\(dirty\(\)\)\{ askLeave\(leaveLead\(\), \(\) => \{ show\('list'\); enter\(\); \}\); return; \}/.test(UI), '  쓰던 중에 버그제보 탭을 다시 누르면 먼저 묻는다(목록으로 바로 가 글을 잃지 않게)');
  chk(/if\(loaded\)\{ draftsStore\(D\(\)\.remove\(draftsLoad\(\), loaded\.id\)\); loaded = null; \}/.test(fn('submitWrite')) && fn('submitWrite').indexOf('draftsStore(D().remove') > fn('submitWrite').indexOf("if(!r || !r.ok)"),
    '  등록에 성공하면 불러온 임시글을 지운다(실패면 남김)');
  chk(/loaded = null; writeSeq\+\+;/.test(fn('openWrite')) && /renderDrafts\(\);/.test(fn('openWrite')), '  글쓰기를 새로 열면 불러온 글 · 찾기 순번을 새로 · 목록을 그린다');
  chk(/if\(leaveOpen\(\)\)\{ e\.preventDefault\(\); hideLeave\(\); \}/.test(UI) && /hideSimilar\(\); hideLeave\(\);/.test(fn('show')), '  Esc · 화면 전환은 «저장할까요?» 를 닫는다(Esc = 계속 쓰기)');
  chk(/'tw\.bugDrafts',/.test(read('account.js') || ''), '★ 계정을 바꾸면 지운다(ACCOUNT_LOCAL_KEYS)');
  chk(/'#myHomeOverlay\.on #mhPageBugreport\.on \.bb-sim\.on'/.test(read('win-stack.js') || ''), '  ESC 스택은 덮는 칸 둘 다(.bb-sim.on)에 양보');
}

say('§10 임시저장 — 게시판 화면 코드를 가짜 화면에 통째로 싣고 눌러 본다');
{
  const END = UI.indexOf('})();\n\n/* ↓ app.js 에서 옮긴');
  const tick = () => new Promise(r => setImmediate(r));
  /* 게시판 IIFE 한 벌을 싣는다 — 버튼은 fire('click') · 고리판은 진짜 myhome-hooks.js */
  const boot = (src, owner) => {
    const els = {};
    const mkEl = (id) => {
      const L = {}, cls = new Set();
      const e = { id, value: '', textContent: '', innerHTML: '', disabled: false, scrollTop: 0, style: { display: '' }, dataset: {}, options: [], offsetParent: {},
        classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c), toggle: (c, on) => { (on === undefined ? !cls.has(c) : on) ? cls.add(c) : cls.delete(c); } },
        addEventListener: (t, f) => { (L[t] = L[t] || []).push(f); },
        fire: (t, ev) => (L[t] || []).forEach(f => f(Object.assign({ currentTarget: e, target: e, preventDefault(){} }, ev || {}))),
        focus(){}, click(){ e.fire('click'); }, querySelector: () => null, querySelectorAll: () => [], appendChild(){}, closest: () => null };
      return e;
    };
    const $ = (id) => els[id] || (els[id] = mkEl(id));
    $('bbWCat').options = [{ value: 'bug' }, { value: 'etc' }];
    $('mhPageBugreport').classList.add('on');
    const radios = [{ value: 'pub', checked: true }, { value: 'prv', checked: false }];
    const tab = mkEl('tab'); tab.classList.add('on');
    const docL = [];
    const doc = { readyState: 'complete', getElementById: $, addEventListener: (t, f, c) => docL.push([t, f]), createElement: () => mkEl('x'),
      querySelector: (sel) => sel === 'input[name="bbWVis"]:checked' ? (radios.find(r => r.checked) || null) : sel.includes('data-tab="bugreport"') ? tab : null,
      querySelectorAll: (sel) => sel === 'input[name="bbWVis"]' ? radios : [] };
    const store = {};
    const ls = { getItem: (k) => k in store ? store[k] : null, setItem: (k, v) => { if (st.lsFail) throw new Error('quota'); store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
    const st = { posts: [], opened: [], sim: [], gate: null, toasts: [], errs: [], lsFail: false, createOk: true };
    const D = { KEY: M.BUG_DRAFT_KEY, MAX: M.BUG_DRAFT_MAX, read: M.draftsRead, write: M.draftsWrite, save: M.draftsSave, remove: M.draftsRemove, dirty: M.draftDirty, empty: M.draftIsEmpty };
    const bbApi = {
      drafts: D, C: { cats: [['bug', '버그'], ['etc', '기타']], status: {}, page: 8, anon: '익명', kakaoRe: /^x$/, answerNoticeBody: () => '' },
      checkPost: (p) => (p.title.trim() ? null : '제목을 써 주세요'),
      similarTo: () => st.gate ? st.gate.then(() => st.sim) : Promise.resolve(st.sim),
      createPost: async (p) => { st.posts.push(p); return st.createOk ? { ok: true, id: 'P' + st.posts.length } : { ok: false, reason: '실패' }; },
      getPost: async (id) => { st.opened.push(id); return null; },
      dailyMax: () => 5, todayCount: async () => 0, loadDailyMax(){}, unseen: async () => ({ n: 0, ids: [] }),
      listPage: async () => ({ items: [], next: null }), notices: async () => [], migrateNotice: async () => ({ ok: true, skipped: true }),
    };
    const fapi = { bugBoard: bbApi, authCurrentUid: () => 'U1' };
    const win = { firebaseAPI: fapi };
    const HK = load(HOOKS_SRC);
    new Function('window', 'document', 'localStorage', 'firebaseAPI', 'TwMyHomeHooks', 'TwErrorCodes', 'escHtml', 'toast', 'getMyUserId', 'getDisplayName', 'isAdmin', 'navigator', 'setTimeout', src)(
      win, doc, ls, fapi, HK, { notify: (c) => st.errs.push(c) }, (s) => s, (m) => st.toasts.push(m), () => owner, () => '나', false, { userAgent: 'Windows' }, () => 0);
    const type = (title, body) => { $('bbWTitle').value = title; $('bbWBody').value = body || ''; };
    const saved = () => M.draftsRead(store[M.BUG_DRAFT_KEY] || null, owner);
    const view = () => $('bbWriteView').style.display !== 'none' ? 'write' : $('bbListView').style.display !== 'none' ? 'list' : 'detail';
    const ask = () => $('bbLeave').classList.contains('on');
    const draftClick = (id, act) => $('bbDrafts').fire('click', { target: { closest: (s) => s === '[data-dact]' ? { dataset: { dact: act || 'open' } } : s === '.bb-draft[data-did]' ? { dataset: { did: id } } : null } });
    const esc = () => docL.filter(([t]) => t === 'keydown').forEach(([, f]) => f({ key: 'Escape', preventDefault(){} }));
    const guard = (next) => HK.call(HK.HOOK.LEAVE_GUARD, next);
    return { $, st, store, saved, view, ask, type, draftClick, esc, guard, HK, tab };
  };
  const HOOKS_SRC = read('myhome/myhome-hooks.js');
  const load = (mod) => { const w = {}; new Function('window', 'module', mod)(w, undefined); return w.TwMyHomeHooks; };
  const SRC = UI.slice(0, END + 5);
  /* 한 바퀴 — 모든 시나리오를 돌려 결과 표를 낸다(깨 보기도 같은 표로) */
  const scenarios = async (src) => {
    const R = {};
    try {
      /* ① 3개가 찬 상태에서 새 글 — [임시저장하고 나가기] 는 실패하고 창에 남는다 · [저장 안 하고 나가기] 는 나간다 */
      { const T = boot(src, 'CA');
        for (const t of ['하나', '둘', '셋']) { T.$('bbWriteBtn').fire('click'); T.type(t); T.$('bbWDraft').fire('click'); }
        T.$('bbWriteBtn').fire('click'); T.type('넷');
        let went = 0; const g = T.guard(() => went++);
        R.fullAsk = g === true && T.ask() && went === 0;
        T.$('bbLeaveSave').fire('click');
        R.fullStay = T.ask() && went === 0 && /3개/.test(T.$('bbLeaveErr').textContent) && T.saved().length === 3;
        T.$('bbLeaveDrop').fire('click');
        R.dropGo = !T.ask() && went === 1 && T.view() === 'list' && T.saved().length === 3 && !T.saved().some(d => d.title === '넷');
        /* 다시 들어오면 버린 글이 없다(목록) · 고리는 쓰던 글이 없으니 안 묻는다 */
        R.noAgain = T.guard(() => went++) === false && went === 1;
      }
      /* ② [임시저장하고 나가기] — 저장 · 나감 · 이어 가는 길(next)이 고리를 다시 불러도 묻지 않는다(무한 물음 없음) */
      { const T = boot(src, 'CA');
        T.$('bbWriteBtn').fire('click'); T.type('제목', '본문');
        let inner = null, went = 0;
        T.guard(() => { went++; inner = T.guard(() => {}); });
        T.$('bbLeaveSave').fire('click');
        R.saveGo = went === 1 && !T.ask() && T.saved().length === 1 && T.saved()[0].body === '본문' && T.view() === 'list';
        T.$('bbWriteBtn').fire('click'); T.type('버릴 글');
        T.guard(() => { inner = T.guard(() => {}); }); T.$('bbLeaveDrop').fire('click');
        R.noLoop = inner === false && !T.ask();
        /* 버그제보 탭이 아니면(다른 탭) 묻지 않는다 */
        T.$('bbWriteBtn').fire('click'); T.type('또');
        T.$('mhPageBugreport').classList.remove('on');
        R.otherTab = T.guard(() => {}) === false && !T.ask();
        T.$('mhPageBugreport').classList.add('on');
        /* [계속 쓰기] · Esc — 창만 닫히고 글 · 화면 그대로, 나가지 않는다 */
        let w2 = 0; T.guard(() => w2++); T.$('bbLeaveStay').fire('click');
        const a = !T.ask() && w2 === 0 && T.$('bbWTitle').value === '또' && T.view() === 'write';
        T.guard(() => w2++); T.esc();
        R.stay = a && !T.ask() && w2 === 0 && T.$('bbWTitle').value === '또';
      }
      /* ③ 불러온 글 — 다시 저장하면 그 칸을 덮는다 · 고친 뒤 같은 글을 다시 누르면 «고친 내용 임시저장» → 저장본(고친 것)이 보인다 */
      { const T = boot(src, 'CA');
        T.$('bbWriteBtn').fire('click'); T.type('원래', '처음'); T.$('bbWDraft').fire('click');
        const id = T.saved()[0].id;
        T.$('bbWriteBtn').fire('click'); T.draftClick(id);
        R.load = !T.ask() && T.$('bbWTitle').value === '원래';
        T.type('원래', '고침'); T.draftClick(id);
        R.reAsk = T.ask() && T.$('bbLeaveSave').textContent === '고친 내용 임시저장';
        T.$('bbLeaveSave').fire('click');
        R.reSaved = T.saved().length === 1 && T.saved()[0].id === id && T.saved()[0].body === '고침' && T.$('bbWBody').value === '고침' && !T.ask();
        T.type('원래', '또 고침'); T.draftClick(id); T.$('bbLeaveDrop').fire('click');
        R.reDrop = T.$('bbWBody').value === '고침' && T.saved()[0].body === '고침';
        /* 등록 실패면 임시글을 남기고 · 성공하면 지운다 */
        T.st.createOk = false; T.$('bbWSubmit').fire('click'); await tick(); await tick();
        const kept = T.saved().length === 1;
        T.st.createOk = true; T.$('bbWSubmit').fire('click'); await tick(); await tick();
        R.submit = kept && T.st.posts.length === 2 && T.saved().length === 0;
      }
      /* ④ 비슷한 제보를 찾는 동안 떠나거나(마이홈 닫기) 다른 임시글을 불러오면 늦게 온 결과로 (옛 글을) 올리지 않는다 */
      { const T = boot(src, 'CA');
        T.$('bbWriteBtn').fire('click'); T.type('남겨 둔 글'); T.$('bbWDraft').fire('click');
        const id = T.saved()[0].id;
        let open; T.st.gate = new Promise(r => { open = r; });
        T.$('bbWriteBtn').fire('click'); T.type('찾는 중');
        T.$('bbWSubmit').fire('click');
        T.guard(() => {}); T.$('bbLeaveDrop').fire('click');
        open(); await tick(); await tick(); await tick();
        const left = T.st.posts.length === 0;
        T.st.gate = new Promise(r => { open = r; });
        T.$('bbWriteBtn').fire('click'); T.type('찾는 중');
        T.$('bbWSubmit').fire('click');
        T.draftClick(id); T.$('bbLeaveDrop').fire('click');
        open(); await tick(); await tick(); await tick();
        R.raceLeave = left && T.st.posts.length === 0 && T.$('bbWTitle').value === '남겨 둔 글' && !T.$('bbSimilar').classList.contains('on');
        /* 떠나지 않으면 그대로 올린다(비교 결과 없음) */
        T.st.gate = null; T.$('bbWriteBtn').fire('click'); T.type('찾는 중'); T.$('bbWSubmit').fire('click');
        await tick(); await tick(); await tick();
        R.raceStay = T.st.posts.length === 1;
      }
      /* ⑤ 로그인 안 함 · 저장 실패 — 저장하지 않고 까닭 · 오류 번호 */
      { const T = boot(src, '');
        T.$('bbWriteBtn').fire('click'); T.type('x'); T.$('bbWDraft').fire('click');
        R.noOwner = /로그인/.test(T.$('bbWErr').textContent) && !T.store[M.BUG_DRAFT_KEY];
        const U = boot(src, 'CA'); U.st.lsFail = true;
        U.$('bbWriteBtn').fire('click'); U.type('x'); U.guard(() => {}); U.$('bbLeaveSave').fire('click');
        R.lsFail = U.ask() && U.st.errs.includes('E-MH-04');
      }
      /* ⑥ 쓰던 중에 버그제보 탭을 다시 누르면 먼저 묻는다 · 쓰던 글이 없으면 바로 목록 */
      { const T = boot(src, 'CA');
        T.$('bbWriteBtn').fire('click'); T.type('탭');
        T.tab.fire('click');
        const a = T.ask() && T.view() === 'write';
        T.$('bbLeaveDrop').fire('click');
        T.$('bbWriteBtn').fire('click'); T.tab.fire('click');
        R.tabAgain = a && !T.ask() && T.view() === 'list';
      }
    } catch (e) { R.err = String(e && e.stack || e); }
    return R;
  };
  const LABEL = {
    fullAsk: '★ 쓰던 글이 있을 때 마이홈을 닫거나 탭을 옮기면(고리 LEAVE_GUARD) «임시저장할까요?» 를 띄우고 멈춘다',
    fullStay: '★ 3개가 찼을 때 [임시저장하고 나가기] — 저장하지 않고 창에 남아 까닭(3개)을 보인다 · 나가지 않는다',
    dropGo: '  [저장 안 하고 나가기] — 저장 없이 나가고 게시판은 목록으로',
    noAgain: '  나간 뒤엔 버린 글이 남지 않아 다시 묻지 않는다',
    saveGo: '★ [임시저장하고 나가기] — 저장한 뒤 나간다(마이홈 닫기 · 탭 옮기기가 이어진다)',
    noLoop: '  이어 가는 길(탭 옮기기)이 고리를 다시 불러도 묻지 않는다(무한 물음 없음)',
    otherTab: '  버그제보 탭이 아니면 묻지 않는다',
    stay: '  [계속 쓰기] · Esc — 묻는 창만 닫히고 글 · 화면 그대로',
    load: '  임시저장 줄을 누르면 그 글을 불러온다(쓰던 것 없으면 안 묻는다)',
    reAsk: '★ 불러온 글을 고친 뒤 같은 줄을 다시 누르면 묻는다(«고친 내용 임시저장»)',
    reSaved: '  고친 내용 임시저장 — 같은 칸을 덮고 화면엔 저장한 글(고친 것)이 보인다',
    reDrop: '  고친 것 버리고 되돌리기 — 저장해 둔 글로 돌아간다',
    submit: '★ 등록 실패면 임시글을 남기고 · 성공하면 지운다',
    raceLeave: '★ 비슷한 제보를 찾는 동안 떠나거나 다른 임시글을 불러오면 늦게 온 결과로 (옛 글을) 올리지 않는다',
    raceStay: '  떠나지 않으면 그대로 올린다',
    noOwner: '  로그인 전이면 저장하지 않고 «로그인한 뒤에» 를 보인다',
    lsFail: '  이 PC 저장이 실패하면 E-MH-04 · 묻는 창에 남는다',
    tabAgain: '  쓰던 중에 버그제보 탭을 다시 누르면 먼저 묻는다 · 쓰던 글이 없으면 바로 목록',
  };
  pending.push((async () => {
    const R = await scenarios(SRC);
    if (R.err) chk(false, '가짜 화면에서 던졌다: ' + R.err);
    for (const k of Object.keys(LABEL)) chk(R[k] === true, LABEL[k]);
    /* 깨 보기 — 한 줄씩 빼면 그 시나리오가 빨강 */
    const breaks = [
      ['if(save && !saveDraft($(\'bbLeaveErr\'), true)) return;', 'if(save) saveDraft($(\'bbLeaveErr\'), true);', 'fullStay', '3개 찼는데 저장 실패를 무시하고 나가면'],
      ["askLeave(leaveLead(), () => { show('list'); next(); });", 'askLeave(leaveLead(), next);', 'noLoop', '고른 뒤 목록으로 안 바꾸면(이어 가는 탭 옮기기가 또 묻는다)'],
      ['    writeSeq++;   // 비슷한', '    // 비슷한', 'raceLeave', '묻는 창이 찾기 순번을 안 올리면'],
      ['() => fillForm(draftsLoad().find(x => x.id === id) || d), { save: \'고친', '() => fillForm(d), { save: \'고친', 'reSaved', '다시 누를 때 저장본을 다시 읽지 않으면(옛 글이 보임)'],
      ['    if(dirty()){ askLeave(leaveLead(), () => { show(\'list\'); enter(); }); return; }', '', 'tabAgain', '탭 다시 누르기를 안 물으면'],
    ];
    for (const [from, to, key, what] of breaks) {
      if (!SRC.includes(from)) { chk(false, '깨 보기: 바꿀 줄을 못 찾음 — ' + what); continue; }
      const B = await scenarios(SRC.replace(from, to));
      chk(B[key] === false, '깨 보기: ' + what + ' 빨강(' + key + ')');
    }
  })());
}

Promise.all(pending).catch(e => chk(false, '검사가 던졌다: ' + (e && e.stack || e))).then(() => {
  say('');
  say(fail ? '문제 ' + fail + '건' : '전부 통과 ✅ — 비공개 제보 본문은 서버에서 막히고(제목만 공개 · 이름은 익명), 답변 알림이 우편함으로 간다');
  process.exit(fail ? 1 : 0);
});
