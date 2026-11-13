/* sim-bug-board.js — 🐞 버그제보 게시판 검사(규칙 · 화면)
   실행:  node sim-bug-board.js   (firebase-database-rules.json · bug-board.js · bug-api.js · bug-board-ui.js · app.js 와 같은 폴더에서)

   ★ 왜 이 검사가 있는가 — 0.13 에서 게시판의 원본은 서버(/v1/bugs*)다. 화면은 provider(bug-api.js — 검사 sim-bug-api.js)가 준 칸만 보고,
     실패는 갈래 · 번호로, 늦게 온 답은 버리고, 같은 쓰기를 두 번 보내지 않아야 한다. 화면을 몇 개 눌러 봐서는 «늦은 답 덮어씀» · «연타 두 번 올라감» 이 안 잡힌다.
     컷오버 전까지 Firebase 규칙(bugBoard/*)은 그대로 배포돼 있어 §1 이 그 규칙을 계속 본다.

   ★ 무엇을 보는가
     §1 규칙 — ① prv · ans/prv 읽기가 관리자/본인 조건 ② ans 쓰기가 관리자 전용 ③ list 읽기에 limitToLast 상한 ④ inbox tag 에 bug …(컷오버 전 Firebase 규칙)
     §2 bug-board.js 를 실제로 돌린다 — 입력 확인 · 공개 범위 버튼 조건 · 분류 · 상태가 서버 이름과 같다 · 안내 문구가 갈래 표를 다 덮는다
     §3 연결 — html 순서 · app.js 가 만들고 bugBadge 로 시작 · Firebase 길(bugBoard) 걷음 · 우편함에서 글 열기
     §4 화면을 가짜 DOM · 가짜 provider 로 굴린다 — 로그인 전 · 시작(배지 한 번 · 타이머 0) · 목록 상태(받음 · 빈 · 못 받음 · 공지 실패) · 필터 gen ·
        글(없음 · 비공개 · 못 받음 · 봤음) · 글 gen · 글쓰기(남은 수 · 연타 · 429 안내 · 그 밖 번호) · 답글 · 👍(서버가 돌려준 수로) · 공개 범위 · reset · 새 답변 우편 · 관리자 표시
     §5 창이 안 늘어난다 — 버그제보 페이지 높이 고정(440px) · 목록은 #bbRows 안에서 스크롤 · [이전]/[다음] 은 안 줄어든다
     §4 끝 — 관리자 [답변 등록](본 시각 · 겹침 · 쓴 글 보존 · 번호) · 오픈카톡 기본 링크 폼(열 때 판 · 저장 · 겹침 · E-BUG-21 · 22)
     §6 상세 화면의 바깥 주소 열기(openDetailLink) — 다시 거르기 · 오픈카톡만
     §7 일부러 깨 보기 */
'use strict';
const { stripReadGate } = require('./sim-rules-src.js');   // 옛 앱 읽기 막기 조건을 걷고 본다(개정 375)
const fs = require('fs');
const vm = require('vm');
const say = console.log;
let fail = 0, quiet = false, qfail = 0;
const chk = (ok, msg) => { if (quiet) { if (!ok) qfail++; return; } if (!ok) fail++; say((ok ? '  ✓ ' : '  ✗ ') + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, 'parts/support/' + f, 'parts/shared/' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const RULES = stripReadGate(read('firebase-database-rules.json')), BB = read('bug-board.js'), UI = read('bug-board-ui.js'), BAPI = read('bug-api.js');
const AE = read('api-errors.js'), SHS = read('safe-html.js');
/* 📩 수령함은 parts/myhome/myhome-inbox.js — 우편함에서 글 열기를 거기서 본다 */
const MI = read('myhome-inbox.js'); if (!MI) { console.log('  ? 원본 못 찾음 — myhome-inbox.js'); process.exit(2); }
const FB = read('firebase-init.js'), APP = read('app.js') + '\n' + MI, HTML = read('desk-companion-prototype.html'), BOOT = read('app-boot.js');
if (!RULES || !BB || !UI || !BAPI || !AE || !SHS || !FB || !APP || !HTML || !BOOT) { say('  ? 원본 못 찾음 — 규칙 · bug-board.js · bug-api.js · bug-board-ui.js · api-errors.js · safe-html.js · firebase-init.js · app.js · app-boot.js · HTML'); process.exit(2); }
const loadMod = (src) => { const mod = { exports: {} }; new Function('module', 'window', src)(mod, undefined); return mod.exports; };
const M = loadMod(BB), BLIB = loadMod(BAPI), ERRS = loadMod(AE), SH = loadMod(SHS);

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
chk(M.checkPost({ vis: 'pub', cat: 'bug', title: '', body: 'x' }) === '제목을 적어 주세요' && !!M.checkPost({ vis: 'pub', cat: 'zzz', title: 't', body: 'x' })
  && !!M.checkPost({ vis: 'prv', cat: 'bug', title: 't', body: 'x', notice: true }) && !!M.checkPost({ vis: 'pub', cat: 'bug', title: 'x'.repeat(61), body: 'x' })
  && !!M.checkPost({ vis: 'pub', cat: 'bug', title: 't', body: 'x'.repeat(2001) }) && M.checkPost({ vis: 'pub', cat: 'bug', title: 'x'.repeat(60), body: 'x'.repeat(2000) }) === null,
  '입력 확인 — 빈 제목 · 없는 분류 · 비공개 공지 · 61자 · 2001자 거부, 상한(60 · 2000)은 통과');
chk(M.canChangeVis({ mine: true, notice: false, comments: [] }) && !M.canChangeVis({ mine: true, notice: false, comments: [{}] })
  && !M.canChangeVis({ mine: false, notice: false, comments: [] }) && !M.canChangeVis({ mine: true, notice: true, comments: [] }) && !M.canChangeVis(null),
  '공개 범위 버튼 — 내 글 · 공지 아님 · 운영자 답변 · 내 답글이 하나도 없을 때만(서버와 같은 조건)');
/* 서버 분류 · 상태 이름(GET /v1/bugs 응답 값)의 소문자가 화면 열쇠다 — 하나라도 어긋나면 그 분류 · 상태 글이 «기타» · «접수» 로 보인다 */
const SERVER_CATS = ['BUG', 'UI', 'ROOM', 'CHAT', 'MYHOME', 'SUGGEST', 'ETC'], SERVER_ST = ['NEW', 'CHECKING', 'REVIEW', 'FIXED', 'NOREPRO', 'UNFIXED'];
chk(M.BUG_CATS.map(c => c[0].toUpperCase()).join() === SERVER_CATS.join() && M.BUG_CATS.find(c => c[0] === 'suggest')[1] === '건의', '분류 일곱 — 서버 이름과 같다 · «건의» 그대로');
chk(Object.keys(M.BUG_STATUS).map(k => k.toUpperCase()).sort().join() === SERVER_ST.slice().sort().join() && M.BUG_STATUS.review === '검토중', '상태 여섯 — 서버 이름과 같다 · «검토중» 그대로');
chk(M.BUG_AUTHOR_STATUS.map(x => x[0]).join('|') === 'checking|unfixed|fixed' && M.BUG_AUTHOR_STATUS.find(x => x[0] === 'fixed')[1] === '해결 완료', '글쓴이 버튼 — 확인 중 · 해결 안 됨 · 해결 완료(서버가 글쓴이에게 받는 셋)');
{
  const ruleCats = (S(at('bugBoard/list/$id')['.validate']).match(/cat'\)\.val\(\)\.matches\(\/\^\(([^)]*)\)\$\/\)/) || [, ''])[1].split('|');
  chk(M.BUG_CATS.map(c => c[0]).join('|') === ruleCats.join('|'), '분류 목록이 (컷오버 전) 규칙과도 같다 (' + ruleCats.join(',') + ')');
}
chk(M.BUG_PAGE === 8 && M.BUG_PAGE <= BLIB.LIMIT_MAX, '한 쪽 8개(지금 화면 그대로 · 서버 limit 상한 안)');
{
  const guideCodes = Object.keys(BLIB.ERRORS).filter(k => BLIB.ERRORS[k].action === BLIB.KIND.GUIDE || BLIB.ERRORS[k].action === BLIB.KIND.PRIVATE);
  const miss = guideCodes.filter(k => !M.GUIDE_TEXT[k]);
  chk(guideCodes.length >= 9 && !miss.length, '안내 갈래 code 마다 문구가 있다(' + guideCodes.length + '개)' + (miss.length ? ' — 빠짐 ' + miss.join(' · ') : ''));
}
chk(M.KAKAO_RE.test('https://open.kakao.com/o/x') && !M.KAKAO_RE.test('http://open.kakao.com/o/x') && !M.KAKAO_RE.test('https://open.kakao.com.evil.io/'), '오픈카톡 링크 판정');

say('§3 연결');
{
  const idx = (f) => HTML.indexOf('<script src="parts/' + f + '"></script>');
  const iB = idx('support/bug-board.js'), iA = idx('support/bug-api.js'), iU = idx('support/bug-board-ui.js'), iApp = idx('app.js');
  const iAc = idx('shared/api-client.js'), iRid = idx('shared/request-id.js'), iNr = idx('shared/net-ready.js');
  chk(iB > 0 && iA > iB && iU > iA && iApp > iU && iAc > 0 && iAc < iA && iRid > 0 && iRid < iA && iNr > 0 && iNr < iU,
    'html — api-client · request-id → bug-board.js → bug-api.js → bug-board-ui.js(net-ready 뒤) → app.js');
  chk(!/bugBoard\s*:|createBugBoard|support\/bug-board\.js/.test(FB) && !/firebaseAPI\.bugBoard/.test(APP + UI), 'Firebase 길 걷음 — firebase-init 에 bugBoard 연결 없음 · 부르는 곳 0');
  chk(/const bugBoardUi = TwBugBoardUi\.createBugBoardUi\(\{/.test(APP) && /bugApi: TwBugApi\.createBugApi\(\{ authed: TwApi\.authed, errs: TwApiErrors, pending: \(\)=>TwRequestId\.createPending\(\) \}\)/.test(APP),
    'app.js 가 게시판을 만든다 — provider 는 로그인 통로 · 공통 표 · 요청 번호 기억');
  chk(/bugBadge: \(\)=>bugBoardUi\.start\(\)/.test(APP) && /'mhInit',[^\n]*\n\s*'bugBadge',/.test(BOOT), '시작은 app-boot STEPS 의 bugBadge(mhInit 다음) 한 곳');
  chk(/bugBoardReset: \(\.\.\.a\)=>bugBoardUi\.reset\(\.\.\.a\)/.test(APP), '계정을 놓을 때 reset(account.js 가 부른다)');
  chk(/m\.tag === 'bug' && m\.bugId\)\{\s*_inboxOpenId = null; window\._bugBoardOpen\(m\.bugId\)/.test(APP), '우편함에서 누르면 그 글을 연다');
  const noC = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  const board = UI.slice(0, UI.indexOf('/* ↓ app.js 에서 옮긴'));
  chk(!/\b(alert|confirm|prompt)\(/.test(noC(board)) && !/typeof\s+isAdmin/.test(board), 'alert · confirm · prompt 없음 · typeof isAdmin 가드 없음(deps 로 받는다)');
  chk(!/innerHTML[^;]*\+\s*(it|d|a|cur)\.(title|body|text|name|env|kakao)\b/.test(board), '사용자 문자열은 esc() · linked() 를 거쳐 innerHTML 에 들어간다');
  chk(/class="bb-row locked"/.test(board) && !/class="bb-row locked" data-id/.test(board) && /\.bb-row\.locked\{[^}]*cursor:not-allowed/.test(HTML), '남의 비공개 행은 data-id 가 없어 누를 수 없다 (not-allowed)');
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
  chk(/box\.scrollTop = 0/.test(UI), '§5 쪽을 넘기면 목록 스크롤을 맨 위로');
}

/* ── §4 화면 굴리기 — 가짜 DOM(필요한 만큼) · 가짜 provider(진짜 failOf · 진짜 api-errors) ── */
const flush = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise(r => setImmediate(r)); };
const apiErr = (status, code) => Object.assign(new Error(code), { status, code, kind: status >= 500 ? 'unavailable' : (status === 401 || status === 403) ? 'auth' : 'request' });
const defer = () => { let res, rej; const p = new Promise((a, b) => { res = a; rej = b; }); return { p, res, rej }; };
const row = (n, o) => Object.assign({ number: n, vis: 'pub', cat: 'bug', title: '제목' + n, status: 'new', notice: false, byAdmin: false, anon: false, name: '에이',
  mine: false, likeN: 0, ansN: 0, createdAt: 1, answeredAt: 0, authorReplied: false, unseen: false }, o || {});
const post = (n, o) => Object.assign(row(n), { body: '본문' + n, env: null, canReply: false, liked: false, version: 1, comments: [], likeN: 3, lastAnswerIso: null }, o || {});
function mkEl(id) {
  const cls = new Set();
  return { id, style: { display: '' }, dataset: {}, innerHTML: '', textContent: '', value: '', disabled: false, checked: false, options: [], scrollTop: 0, className: '',
    classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c), toggle: (c, f) => { const on = f === undefined ? !cls.has(c) : !!f; on ? cls.add(c) : cls.delete(c); return on; } },
    _L: {}, addEventListener(t, fn) { (this._L[t] || (this._L[t] = [])).push(fn); }, focus() {}, querySelector() { return null; }, appendChild() {} };
}
function boot(src) {
  const env = { admin: false, timers: 0, toasts: [], codes: [], common: [], rt: [] };
  const els = {}; const el = (id) => els[id] || (els[id] = mkEl(id));
  const flts = ['all', 'mine', 'open'].map(f => { const b = mkEl('flt-' + f); b.dataset.f = f; return b; });
  const tab = mkEl('tab'); tab.kids = [];
  tab.querySelector = (s) => tab.kids.find(c => c.className === 'mh-tab-badge') || null;
  tab.appendChild = (c) => tab.kids.push(c);
  tab.click = () => { tab.classList.add('on'); (tab._L.click || []).forEach(f => f()); };
  el('bbDetailView').querySelector = (s) => s === '.bb-rst.on' ? { dataset: { st: 'unfixed' } } : null;
  const document = {
    readyState: 'complete', addEventListener() {}, getElementById: el, createElement: () => mkEl('new'),
    querySelector: (s) => s === '#myHomeTabs .mh-tab[data-tab="bugreport"]' ? tab : s === 'input[name="bbWVis"]:checked' ? { value: 'pub' } : null,
    querySelectorAll: (s) => s === '#bbListView .bb-flt' ? flts : [],
  };
  const ctx = { document, console: { warn() {}, log() {} }, navigator: { userAgent: 'Windows' }, TwNetReady: { whenNetReady() {} },
    setTimeout: () => { env.timers++; return 0; }, setInterval: () => { env.timers++; return 0; },
    Math, JSON, String, Number, Array, Object, Promise, Map, Set, Date, Boolean, Error, RegExp };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'bug-board-ui.js' });
  const calls = [], impl = {};
  const n = (k) => calls.filter(c => c[0] === k).length;
  const api = { KIND: BLIB.KIND, ERRORS: BLIB.ERRORS, failOf: (e) => BLIB.failOf(e, ERRS), badge: null, resets: 0,
    badgeCount: () => api.badge, reset: () => { api.resets++; api.badge = null; },
    refreshBadge: () => { calls.push(['badge']); return Promise.resolve(impl.badge ? impl.badge() : 2).then(v => { api.badge = v; return v; }); } };
  const DEF = { list: { items: [], next: null }, notices: [], detail: post('B-1'), write: { number: 'B-9' }, reply: undefined, answer: undefined, reportConfig: { version: 3, notice: '안내', link: 'https://open.kakao.com/o/a' }, saveReportLink: { version: 4, notice: '안내', link: 'https://open.kakao.com/o/new' }, setVis: { vis: 'prv', version: 2 }, like: { likeN: 9, liked: true }, seen: undefined, quota: { dailyMax: 5, usedToday: 0 } };
  for (const k of Object.keys(DEF)) api[k] = (...a) => { calls.push([k, ...a]); return Promise.resolve().then(() => impl[k] ? impl[k](...a) : DEF[k]); };
  const ui = ctx.TwBugBoardUi.createBugBoardUi({ bugApi: api, lib: M, apiErrors: { notify: (e) => env.common.push(e.code) }, notifyError: (c) => { env.codes.push(c); return true; },
    toast: (m) => env.toasts.push(m), escHtml: (s) => SH.text(s), safeHtml: SH, isAdmin: () => env.admin, bugReportLink: () => env.link || '', rtOn: (k, fn) => { env.rt.push([k, fn]); return () => {}; } });
  const clickAct = (act, ds) => { const b = mkEl('btn'); b.dataset = Object.assign({ act }, ds || {}); els.bbDetailView._L.click[0]({ target: { closest: (s) => s === '[data-act]' ? b : null } }); return b; };
  const clickRow = (id) => els.bbRows._L.click[0]({ target: { closest: (s) => s === '.bb-row[data-id]' ? { dataset: { id } } : null } });
  return { env, el, ui, api, impl, calls, n, ctx, flts, tab, clickAct, clickRow };
}

async function judgeUi(src) {
  if (!quiet) say('§4 화면 굴리기');
  {
    const b = boot(src);
    b.tab.click(); await flush();
    chk(/로그인 뒤에 볼 수 있어요/.test(b.el('bbRows').innerHTML) && b.n('list') === 0 && b.n('badge') === 0, '로그인 전(시작 전) — «로그인 뒤에 볼 수 있어요» · 요청 0');
    b.el('bbWriteBtn')._L.click[0](); await flush();
    chk(b.env.toasts.includes('로그인 뒤에 쓸 수 있어요') && b.n('quota') === 0, '  글쓰기도 «로그인 뒤에» · 요청 0');
    await b.ui.start(); await flush();
    chk(b.n('badge') === 1 && b.env.rt.length === 1 && b.env.rt[0][0] === 'notification' && b.tab.kids[0] && b.tab.kids[0].textContent === '2' && b.el('bbMineDot').classList.contains('on'),
      '시작(bugBadge) — 배지 한 번 받아 탭 · 내 글 점에 그림 · realtime 알림 하나 건다');
    b.env.rt[0][1]({ kind: 'notification', resync: false }); await flush();
    const before = b.n('badge');
    b.env.rt[0][1]({ kind: 'notification', resync: true }); await flush();
    chk(before === 1 && b.n('badge') === 2, '  realtime 이 오래 끊겼다 붙으면(resync) 한 번 더 받는다 · 그냥 알림은 안 받는다(우편 쪽이 부른다)');
    b.impl.badge = () => 0; await b.ui.refreshBadge();
    chk(b.tab.kids[0].style.display === 'none' && !b.el('bbMineDot').classList.contains('on'), '  0 이면 배지 · 점이 안 보인다');
    chk(b.env.timers === 0, '타이머 0 — 배지를 되풀이해서 받지 않는다(부팅 setTimeout 걷음)');
  }
  {
    const b = boot(src); await b.ui.start();
    b.impl.list = (f) => ({ items: [row('B-1', { mine: true, unseen: true }), row('B-2', { vis: 'prv', anon: true, title: '남의 비밀' })], next: 'c1' });
    b.impl.notices = () => [row('N-1', { notice: true, byAdmin: true, title: '공지글' })];
    b.tab.click(); await flush();
    const h = b.el('bbRows').innerHTML;
    chk(h.indexOf('공지글') >= 0 && h.indexOf('공지글') < h.indexOf('제목B-1') && /새 답변/.test(h) && b.calls.find(c => c[0] === 'list').slice(1).join() === 'all,,8',
      '전체 1쪽 — 공지(따로 받음)가 위 · 내 글의 «새 답변» · list(all, 커서 없음, 8)');
    chk(/class="bb-row locked"[^>]*>[\s\S]*남의 비밀[\s\S]*익명/.test(h) && !/data-id="B-2"/.test(h), '  남의 비공개 글 — 제목 · «익명» 만 · 누를 수 없음');
    chk(b.el('bbNext').disabled === false && b.el('bbPrev').disabled === true && b.el('bbPageNo').textContent === '1', '  다음 쪽 있음 → [다음] 켜짐 · 1쪽이라 [이전] 꺼짐');
    b.el('bbNext')._L.click[0](); await flush();
    chk(b.calls.filter(c => c[0] === 'list').pop()[2] === 'c1' && b.n('notices') === 1 && b.el('bbPageNo').textContent === '2', '  [다음] — 서버 커서로 · 2쪽엔 공지를 다시 받지 않는다');
    b.impl.notices = () => { throw apiErr(503, 'X'); };
    b.el('bbPrev')._L.click[0](); await flush();
    chk(/제목B-1/.test(b.el('bbRows').innerHTML) && b.env.codes.length === 0 && b.env.common.length === 0, '공지 받기 실패 — 목록은 그대로 · 번호 없음(목록이 주인)');
  }
  {
    const b = boot(src); await b.ui.start();
    b.impl.list = () => { throw apiErr(400, 'BUG_INVALID'); };
    b.tab.click(); await flush();
    chk(/목록을 불러오지 못했어요/.test(b.el('bbRows').innerHTML) && /data-act="retry"/.test(b.el('bbRows').innerHTML) && b.env.codes.join() === 'E-BUG-01' && b.el('bbNext').disabled,
      '못 받음 — «목록을 불러오지 못했어요 [다시 시도]» + E-BUG-01 한 번 · [다음] 꺼짐');
    b.impl.list = () => ({ items: [], next: null });
    b.el('bbRows')._L.click[0]({ target: { closest: (s) => s === '[data-act="retry"]' ? {} : null } }); await flush();
    chk(/아직 제보가 없어요/.test(b.el('bbRows').innerHTML), '  [다시 시도] → 다시 받기 · 빈 목록은 «아직 제보가 없어요»(못 받음과 다른 화면)');
    b.flts[1]._L.click[0](); await flush();
    chk(/아직 쓴 제보가 없어요/.test(b.el('bbRows').innerHTML) && b.flts[1].classList.contains('on'), '  내 글 빈 목록 — «아직 쓴 제보가 없어요»');
    b.impl.list = () => { throw apiErr(401, 'AUTH_REQUIRED'); };
    b.flts[0]._L.click[0](); await flush();
    chk(b.env.common.join() === 'AUTH_REQUIRED' && b.env.codes.join() === 'E-BUG-01', '  공통 code(로그인 풀림)는 공통 번호로 · E-BUG-01 은 더 안 낸다');
  }
  {
    const b = boot(src); await b.ui.start();
    const slow = defer();
    b.impl.list = (f) => f === 'all' ? slow.p : { items: [row('M-1', { mine: true })], next: null };
    b.tab.click(); await flush();
    b.flts[1]._L.click[0](); await flush();
    slow.res({ items: [row('A-1')], next: 'zz' }); await flush();
    chk(/제목M-1/.test(b.el('bbRows').innerHTML) && !/제목A-1/.test(b.el('bbRows').innerHTML) && b.el('bbNext').disabled, '필터 gen — 늦게 온 옛 필터(전체) 답은 버린다(내 글 화면 · [다음] 그대로)');
  }
  {
    const b = boot(src); await b.ui.start();
    const cases = [[apiErr(404, 'BUG_NOT_FOUND'), /지워졌거나 없는 제보예요/], [apiErr(403, 'BUG_PRIVATE'), /비공개 제보예요/]];
    for (const [e, re] of cases) { b.impl.detail = () => { throw e; }; b.clickRow('B-1'); await flush(); chk(re.test(b.el('bbDetailView').innerHTML) && b.env.codes.length === 0, '글 열기 ' + e.code + ' — ' + re.source + ' · 번호 없음'); }
    b.impl.detail = () => { throw apiErr(400, 'BUG_INVALID'); };
    b.clickRow('B-1'); await flush();
    chk(/제보를 불러오지 못했어요/.test(b.el('bbDetailView').innerHTML) && /data-act="reload"/.test(b.el('bbDetailView').innerHTML) && b.env.codes.join() === 'E-BUG-02', '  그 밖 — «못 불러왔어요 [다시 시도]» + E-BUG-02');
    b.impl.detail = (n) => post(n, { mine: true, answeredAt: 5, canReply: true });
    b.clickAct('reload'); await flush();
    chk(b.n('seen') === 1 && b.calls.find(c => c[0] === 'seen')[1] === 'B-1' && b.n('badge') === 2 && /본문B-1/.test(b.el('bbDetailView').innerHTML), '  [다시 시도] → 받음 · 답변 달린 내 글이면 봤음 한 번 → 배지 다시 받기');
    b.impl.detail = (n) => post(n, { mine: false, answeredAt: 5 });
    b.clickRow('B-2'); await flush();
    chk(b.n('seen') === 1, '  남의 글은 봤음을 보내지 않는다');
    const slow = defer();
    b.impl.detail = (n) => n === 'B-5' ? slow.p : post(n);
    b.clickRow('B-5'); b.clickRow('B-6'); await flush();
    slow.res(post('B-5')); await flush();
    chk(/본문B-6/.test(b.el('bbDetailView').innerHTML) && !/본문B-5/.test(b.el('bbDetailView').innerHTML), '글 gen — 늦게 온 앞 글(B-5) 답은 버린다');
    b.impl.detail = (n) => post(n, { mine: true, canReply: true });
    b.clickRow('B-7'); await flush();
    const dc = b.n('detail');
    b.ctx._bugBoardRefreshBadge('B-8'); await flush();
    const other = b.n('detail');
    b.ctx._bugBoardRefreshBadge('B-7'); await flush();
    chk(other === dc && b.n('detail') === dc + 1, '새 답변 우편 — 배지 다시 받기 · 보고 있는 그 글이면 글도 다시 받는다(다른 글이면 안 받음)');
  }
  {
    const b = boot(src); await b.ui.start();
    b.impl.quota = () => ({ dailyMax: 5, usedToday: 5 });
    b.el('bbWriteBtn')._L.click[0](); await flush();
    chk(b.el('bbWSubmit').disabled === true && /5건 모두 썼어요/.test(b.el('bbWErr').textContent), '글쓰기 — 다 썼으면 [등록] 꺼짐 · 안내');
    b.impl.quota = () => ({ dailyMax: 5, usedToday: 2 });
    b.el('bbWriteBtn')._L.click[0](); await flush();
    chk(b.el('bbWSubmit').disabled === false && b.el('bbWSubmit').textContent === '등록 (오늘 3건 남음)', '  «등록 (오늘 3건 남음)»');
    b.impl.quota = () => { throw apiErr(400, 'BUG_INVALID'); };
    b.el('bbWriteBtn')._L.click[0](); await flush();
    chk(b.env.codes.join() === 'E-BUG-07' && b.el('bbWSubmit').disabled === false && b.el('bbWSubmit').textContent === '등록', '  남은 수 못 받음 — E-BUG-07 · [등록] 은 켜 둔다');
    b.env.admin = true; const q0 = b.n('quota');
    b.el('bbWriteBtn')._L.click[0](); await flush();
    chk(b.n('quota') === q0, '  관리자는 남은 수를 묻지 않는다(상한 없음)');
    b.env.admin = false; b.env.codes.length = 0;
    b.el('bbWTitle').value = ''; b.el('bbWBody').value = 'b'; b.el('bbWCat').value = 'bug'; b.el('bbWEnv').checked = false;
    const submit = () => b.el('bbWSubmit')._L.click[0]({ currentTarget: b.el('bbWSubmit') });
    await submit();
    chk(b.n('write') === 0 && b.el('bbWErr').textContent === '제목을 적어 주세요', '[등록] 입력 확인에 걸리면 요청 0');
    b.el('bbWTitle').value = 't';
    const slow = defer(); b.impl.write = () => slow.p;
    submit(); submit(); await flush();
    chk(b.n('write') === 1 && b.calls.find(c => c[0] === 'write')[1].cat === 'bug', '[등록] 연타 — 보내는 동안 한 번만');
    slow.res({ number: 'B-1113-1' }); await flush();
    chk(b.env.toasts.includes('🐞 제보를 등록했어요') && b.calls.filter(c => c[0] === 'detail').pop()[1] === 'B-1113-1', '  성공 — 토스트 · 그 글을 연다');
    b.impl.write = () => { throw apiErr(429, 'BUG_DAILY_LIMIT'); };
    await submit(); await flush();
    chk(b.el('bbWErr').textContent === M.GUIDE_TEXT.BUG_DAILY_LIMIT && b.env.codes.length === 0 && b.el('bbWTitle').value === 't', '  429 하루 상한 — 안내 문구(번호 없음) · 입력 그대로');
    b.impl.write = () => { throw apiErr(400, 'BUG_INVALID'); };
    await submit(); await flush();
    chk(b.env.codes.join() === 'E-BUG-03' && b.el('bbWSubmit').disabled === false, '  그 밖 — E-BUG-03 한 번 · [등록] 다시 켬');
  }
  {
    const b = boot(src); await b.ui.start();
    b.impl.detail = (n) => post(n, { mine: true, canReply: true, version: 7 });
    b.clickRow('B-1'); await flush();
    const h = b.el('bbDetailView').innerHTML;
    chk(/답글 달기/.test(h) && /data-act="vis" data-vis="prv">/.test(h) && /data-act="like"/.test(h), '내 글 — 답글 칸 · 공개 범위 버튼(답변 없으면 켜짐) · 👍');
    b.el('bbRText').value = '';
    b.clickAct('reply'); await flush();
    chk(b.n('reply') === 0 && b.el('bbRErr').textContent === '답글을 적어 주세요', '[답글] 빈 글이면 요청 0');
    b.el('bbRText').value = ' 아직 그래요 ';
    const slow = defer(); b.impl.reply = () => slow.p;
    b.clickAct('reply'); b.clickAct('reply'); await flush();
    const rc = b.calls.find(c => c[0] === 'reply');
    chk(b.n('reply') === 1 && rc[1] === 'B-1' && rc[2].text === '아직 그래요' && rc[2].status === 'unfixed', '[답글] 연타 한 번 · 고른 상태(기본 «해결 안 됨»)와 함께');
    const d0 = b.n('detail'); slow.res(); await flush();
    chk(b.env.toasts.includes('답글을 등록했어요') && b.n('detail') === d0 + 1, '  성공 — 글 다시 받기');
    b.impl.reply = () => { throw apiErr(429, 'BUG_REPLY_TOO_SOON'); };
    b.el('bbRText').value = 'x'; b.clickAct('reply'); await flush();
    chk(b.el('bbRErr').textContent === '잠시 뒤에 다시 등록해 주세요' && b.env.codes.length === 0, '  10초 간격 — 안내(번호 없음)');
    b.impl.reply = () => { throw apiErr(400, 'BUG_INVALID'); };
    b.clickAct('reply'); await flush();
    chk(b.env.codes.join() === 'E-BUG-04', '  그 밖 — E-BUG-04');
    b.env.codes.length = 0;
    b.impl.like = () => { throw apiErr(400, 'BUG_INVALID'); };
    let lb = b.clickAct('like'); await flush();
    chk(b.env.codes.join() === 'E-BUG-05' && lb.disabled === false, '👍 실패 — E-BUG-05 · 버튼 다시 켬 · 다시 보내지 않음(' + b.n('like') + '번)');
    b.impl.like = undefined;
    lb = b.clickAct('like'); await flush();
    chk(b.n('like') === 2 && lb.textContent === '👍 나도 겪었어요 9' && lb.classList.contains('on') && lb.disabled === true,
      '  성공 — 눌린 모양 · 서버가 돌려준 수(본 수 3 + 1 이 아니라 9)');
    b.env.codes.length = 0;
    b.impl.setVis = () => { throw apiErr(409, 'BUG_VIS_LOCKED'); };
    b.clickAct('vis', { vis: 'prv' }); await flush();
    chk(b.calls.find(c => c[0] === 'setVis').slice(1).join() === 'B-1,7,prv' && b.el('bbVErr').textContent === M.BUG_VIS_LOCKED && b.env.codes.length === 0,
      '공개 범위 — setVis(번호, 받은 판, prv) · 답변이 그새 달림(BUG_VIS_LOCKED) → 안내');
    const d1 = b.n('detail');
    b.impl.setVis = () => { throw apiErr(409, 'CONCURRENT_UPDATE'); };
    b.clickAct('vis', { vis: 'prv' }); await flush();
    chk(b.n('detail') === d1 + 1 && b.env.codes.length === 0 && b.env.common.length === 0, '  그사이 글이 바뀜(CONCURRENT_UPDATE) → 번호 없이 글 다시 받기');
    b.impl.setVis = () => { throw apiErr(400, 'BUG_INVALID'); };
    b.clickAct('vis', { vis: 'prv' }); await flush();
    chk(b.env.codes.join() === 'E-BUG-06', '  그 밖 — E-BUG-06');
    b.impl.setVis = undefined;
    b.clickAct('vis', { vis: 'prv' }); await flush();
    chk(b.env.toasts.includes('비공개로 바꿨어요'), '  성공 — 토스트 · 글 다시 받기');
    b.impl.detail = (n) => post(n, { mine: true, canReply: true, comments: [{ id: 'c1', byAuthor: false, text: '답', kakao: null, vis: 'pub', st: '', at: 2 }] });
    b.clickRow('B-1'); await flush();
    chk(/data-act="vis" data-vis="prv" disabled>/.test(b.el('bbDetailView').innerHTML) && /운영자 답변이나 내 답글이 달린 글은/.test(b.el('bbDetailView').innerHTML), '  답변이 달린 글은 버튼을 흐리게 · 까닭');
  }
  {
    const b = boot(src); await b.ui.start();
    const slow = defer(); b.impl.list = () => slow.p;
    b.tab.click(); await flush();
    b.el('bbWriteBtn')._L.click[0](); await flush();
    chk(b.el('bbWriteView').style.display === '', '  (글쓰기 열림)');
    b.ui.reset();
    slow.res({ items: [row('X-1')], next: null }); await flush();
    chk(b.api.resets === 1 && !/제목X-1/.test(b.el('bbRows').innerHTML) && /로그인 뒤에 볼 수 있어요/.test(b.el('bbRows').innerHTML) && b.el('bbWriteView').style.display === 'none',
      'reset — provider reset · 늦게 온 목록 답 버림 · 글쓰기 닫힘');
    chk(!b.tab.kids.length || b.tab.kids[0].style.display === 'none', '  배지 안 보임');
    b.tab.click(); await flush();
    chk(b.n('list') === 1, '  reset 뒤엔(다음 시작 전) 받지 않는다');
  }
  {
    const b = boot(src); b.env.admin = true; await b.ui.start();
    b.impl.list = () => ({ items: [row('B-3', { vis: 'prv', anon: true, authorReplied: true })], next: null });
    b.tab.click(); await flush();
    chk(/data-id="B-3"/.test(b.el('bbRows').innerHTML) && /✍ 글쓴이 답글/.test(b.el('bbRows').innerHTML), '관리자 — 비공개 글도 누를 수 있고 «✍ 글쓴이 답글» 표시');
    b.impl.detail = (n) => post(n);
    b.clickRow('B-3'); await flush();
    chk(/class="bb-no">B-3</.test(b.el('bbDetailView').innerHTML) && /답변 달기 \(관리자\)/.test(b.el('bbDetailView').innerHTML), '  글 번호 · 답변 칸(관리자)');
  }
  {
    /* 관리자 [답변 등록] — 본 마지막 답변 시각을 실어 보낸다 · 겹치면 글 다시 받고 쓴 글은 칸에 둔다 */
    const b = boot(src); b.env.admin = true; await b.ui.start();
    b.impl.detail = (n) => post(n, { lastAnswerIso: '2026-11-10T02:00:00Z' });
    b.clickRow('B-3'); await flush();
    b.el('bbAText').value = '  '; b.el('bbAStatus').value = 'fixed';
    b.clickAct('answer'); await flush();
    chk(b.n('answer') === 0 && b.el('bbAErr').textContent === '답변을 적어 주세요', '관리자 [답변 등록] — 빈 글이면 요청 0');
    b.el('bbAText').value = ' 고쳤어요 ';
    const slow = defer(); b.impl.answer = () => slow.p;
    b.clickAct('answer'); b.clickAct('answer'); await flush();
    const ac = b.calls.find(c => c[0] === 'answer');
    chk(b.n('answer') === 1 && ac[1] === 'B-3' && JSON.stringify(ac[2]) === JSON.stringify({ seenLastAnswerAt: '2026-11-10T02:00:00Z', text: '고쳤어요', status: 'fixed', kakaoLink: '', vis: 'pub' }),
      '  연타 한 번 · answer(번호, { 글을 열 때 받은 시각 · 글 · 상태 · 링크 없음 · 공개 })');
    const d0 = b.n('detail'); slow.res(); await flush();
    chk(b.env.toasts.includes('답변을 등록했어요') && b.n('detail') === d0 + 1 && b.env.codes.length === 0, '  성공 — 토스트 · 글 다시 받기 · 알림은 서버 몫(앱이 우편을 쓰지 않는다)');
    b.env.toasts.length = 0;
    b.el('bbAText').value = '내가 쓴 답';
    b.impl.answer = () => { throw apiErr(409, 'BUG_ANSWER_CONFLICT'); };
    b.impl.detail = (n) => { b.el('bbAText').value = ''; return post(n, { lastAnswerIso: '2026-11-10T03:00:00Z' }); };   // 다시 그리면 칸이 비는 것을 흉내
    const d1 = b.n('detail');
    b.clickAct('answer'); await flush();
    chk(b.env.toasts.join() === M.ANSWER_CONFLICT_TEXT && b.n('detail') === d1 + 1 && b.el('bbAText').value === '내가 쓴 답' && b.env.codes.length === 0 && b.env.common.length === 0,
      '  다른 관리자가 먼저 답함(409) — 번호 없이 안내 · 글 다시 받기 · 쓴 글은 칸에 그대로');
    b.impl.answer = () => { throw apiErr(400, 'BUG_PRIVATE_ANSWER_ONLY'); };
    b.clickAct('answer'); await flush();
    chk(b.el('bbAErr').textContent === M.GUIDE_TEXT.BUG_PRIVATE_ANSWER_ONLY && b.env.codes.length === 0, '  비공개 글의 공개 답변(400) — 안내(번호 없음)');
    b.impl.answer = () => { throw apiErr(400, 'BUG_INVALID'); };
    b.clickAct('answer'); await flush();
    chk(b.env.codes.join() === 'E-BUG-20' && b.el('bbAText').value === '내가 쓴 답', '  그 밖 — E-BUG-20 · 쓴 글 그대로');
    b.impl.answer = () => { throw apiErr(401, 'AUTH_REQUIRED'); };
    b.env.codes.length = 0; b.clickAct('answer'); await flush();
    chk(b.env.common.join() === 'AUTH_REQUIRED' && b.env.codes.length === 0, '  공통 code(로그인 풀림)는 공통 번호로');
    b.impl.answer = undefined; b.el('bbAKakao').value = 'http://evil.example/'; b.el('bbAKk').classList.add('on');
    const a0 = b.n('answer'); b.clickAct('answer'); await flush();
    chk(b.n('answer') === a0 && b.el('bbAErr').textContent === M.KAKAO_LINK_RULE, '  오픈카톡 주소가 아니면 요청 0 · 안내');
    b.el('bbAKakao').value = 'https://open.kakao.com/o/x'; b.clickAct('answer'); await flush();
    chk(b.calls.filter(c => c[0] === 'answer').pop()[2].kakaoLink === 'https://open.kakao.com/o/x', '  링크 칸이 켜져 있으면 링크를 같이 보낸다');
    b.impl.detail = (n) => post(n, { vis: 'prv' }); b.clickRow('B-4'); await flush();
    b.el('bbAText').value = '비공개 답'; b.el('bbAKk').classList.remove('on'); b.clickAct('answer'); await flush();
    chk(b.calls.filter(c => c[0] === 'answer').pop()[2].vis === 'prv', '  비공개 글은 늘 비공개 답변으로 보낸다');
    b.env.link = 'https://open.kakao.com/o/default'; b.el('bbAKakao').value = '';
    b.clickAct('kakao'); await flush();
    chk(b.el('bbAKakao').value === 'https://open.kakao.com/o/default' && b.n('reportConfig') === 0, '  [💬 오픈카톡] — 원격 설정의 기본 주소로 칸 채움(요청 0)');
    b.env.admin = false; const a1 = b.n('answer'); b.clickAct('answer'); await flush();
    chk(b.n('answer') === a1, '  관리자가 아니면(화면 깃발) 보내지 않는다');
  }
  {
    /* 관리자 오픈카톡 기본 링크 폼 — 열 때 받고(판) · 저장 때 그 판 · 그사이 바뀌면 다시 받아 칸 채움 */
    const b = boot(src); await b.ui.start();
    const form = b.el('mhBugEditForm'), input = b.el('mhBugLinkInput'), msg = b.el('mhBugEditMsg');
    const open = async () => { b.el('mhBugEditBtn')._L.click[0](); await flush(); };
    const save = async () => { b.el('mhBugSaveBtn')._L.click[0](); await flush(); };
    form.style.display = 'none';
    await open();
    chk(b.n('reportConfig') === 0 && form.style.display === 'none', '링크 폼 — 관리자가 아니면 열지 않고 요청 0');
    b.env.admin = true; await open();
    chk(b.n('reportConfig') === 1 && form.style.display === 'block' && input.value === 'https://open.kakao.com/o/a', '  관리자 — 열 때 설정을 받아 칸에 지금 링크');
    input.value = 'http://evil.example/'; await save();
    chk(b.n('saveReportLink') === 0 && msg.textContent === M.KAKAO_LINK_RULE, '  오픈카톡 주소가 아니면 저장 요청 0');
    input.value = ' https://open.kakao.com/o/new '; await save();
    const sc = b.calls.find(c => c[0] === 'saveReportLink');
    chk(sc[1].version === 3 && sc[1].notice === '안내' && sc[2] === 'https://open.kakao.com/o/new' && form.style.display === 'none' && b.env.toasts.includes('오픈카톡 기본 링크를 저장했어요'),
      '  저장 — 열 때 받은 판 · 안내 글을 그대로 넘긴다 · 토스트 · 폼 닫음');
    await open();
    b.impl.saveReportLink = () => { throw apiErr(409, 'CONCURRENT_UPDATE'); };
    b.impl.reportConfig = () => ({ version: 9, notice: '새 안내', link: 'https://open.kakao.com/o/other' });
    input.value = 'https://open.kakao.com/o/mine'; b.env.codes.length = 0; await save();
    chk(input.value === 'https://open.kakao.com/o/other' && msg.textContent === M.CONFIG_CONFLICT_TEXT && form.style.display === 'block' && b.env.codes.length === 0 && b.env.common.length === 0,
      '  그사이 다른 곳에서 바꿈(409) — 다시 받아 칸 채움 · «다른 곳에서 바꾼 내용을 받아왔어요» · 번호 없음');
    b.impl.saveReportLink = () => { throw apiErr(400, 'OPS_INVALID_VALUE'); };
    input.value = 'https://open.kakao.com/o/z'; await save();
    chk(b.env.codes.join() === 'E-BUG-22' && b.el('mhBugSaveBtn').disabled === false, '  그 밖 — E-BUG-22 · [저장] 다시 켬');
    form.style.display = 'none'; b.impl.reportConfig = () => { throw apiErr(400, 'BUG_INVALID'); }; b.env.codes.length = 0;
    await open();
    chk(b.env.codes.join() === 'E-BUG-21' && form.style.display === 'none', '  설정 받기 실패 — E-BUG-21 · 폼은 열지 않는다');
    b.impl.reportConfig = undefined; await open();
    chk(form.style.display === 'block', '  (다시 엶)');
    b.ui.reset();
    chk(form.style.display === 'none', '  reset — 폼을 닫는다');
  }
}

say('§6 바깥 주소 열기');
{
  /* 누르기 처리(openDetailLink)를 꺼내 실제로 부른다 — 가짜 companion · 진짜 safe-html */
  const grab = (src, name) => { const i = src.indexOf('function ' + name + '('); if (i < 0) return null; let k = src.indexOf('{', i), d = 0; for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } return null; };
  const runLink = (uiSrc, target, hasCompanion = true) => {
    const fn = grab(uiSrc, 'openDetailLink'); if (!fn) return null;
    const opened = [];
    const win = hasCompanion ? { companion: { openBrowser: (u) => opened.push(u) } } : {};
    const f = new Function('window', 'companion', 'lib', 'safeHtml', fn + '\nreturn openDetailLink;')(win, win.companion, M, SH);
    let handled, threw = false;
    try { handled = f({ target: target }); } catch (_) { threw = true; }
    return { opened, handled, threw };
  };
  const tgt = (sel, ds) => ({ closest: (q) => (q === sel ? { dataset: ds } : null) });
  const link = (u) => tgt('.ext-link[data-url]', { url: u });
  const ok = runLink(UI, link('https://x.example/a?b=1&c=2'));
  chk(!!ok && ok.handled && ok.opened.join() === 'https://x.example/a?b=1&c=2', '주소 칸을 누르면 그 주소를 기본 브라우저(openBrowser)로 한 번 — 처리했다고 돌려준다');
  const bad = ['javascript:alert(1)', '', 'https://x.example/' + 'a'.repeat(2049), '//evil.example/x'].map(u => runLink(UI, link(u)));
  chk(bad.every(r => r && r.handled && r.opened.length === 0), '  javascript: · 빈 값 · 상한 넘음 · 스킴 없는 주소는 열지 않는다(다시 거름)');
  const kk = runLink(UI, tgt('[data-kakao]', { kakao: 'https://open.kakao.com/o/abc' })), kkBad = runLink(UI, tgt('[data-kakao]', { kakao: 'https://evil.example' }));
  chk(!!kk && kk.opened.join() === 'https://open.kakao.com/o/abc' && kkBad.opened.length === 0, '  오픈카톡 버튼은 오픈카톡 주소만');
  const none = runLink(UI, { closest: () => null }), noComp = runLink(UI, link('https://x.example/a'), false);
  chk(!!none && none.handled === false && !!noComp && !noComp.threw && noComp.handled, '  다른 곳을 누르면 false(버튼 처리로) · companion 이 없어도 던지지 않는다');
  const broke = runLink(UI.replace("const url = safeHtml.safeUrl(ln.dataset.url, 'link');", 'const url = ln.dataset.url;'), link('javascript:alert(1)'));
  chk(!!broke && broke.opened.length === 1, '  깨 보기 — 다시 거르기를 빼면 javascript: 가 열린다 → 위 판정이 빨강');
  chk(/\$\('bbDetailView'\)\.addEventListener\('click', \(e\) => \{\n\s*if\(openDetailLink\(e\)\) return;/.test(UI), '  상세 화면 누르기가 이 처리를 먼저 거친다');
  chk(/const linked = \(s\) => safeHtml\.linkify\(s\);/.test(UI) && /'<div class="bb-body">' \+ linked\(d\.body\)/.test(UI) && (UI.match(/<div class="bb-ans-t">' \+ linked\(a\.text\)/g) || []).length === 2,
    '본문 · 운영자 답변 · 글쓴이 답글의 주소는 linkify 로 누를 수 있는 칸이 된다');
}
chk(/\.ext-link\{[^}]*cursor:pointer/.test(HTML), '  주소 칸 모양(.ext-link — 밑줄 · 손가락)은 공용 스타일');

(async () => {
  await judgeUi(UI);
  say('§7 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
  const breaks = [
    ['목록 gen 비교를 뺌', UI.replace('if(g !== listGen) return;   // 그사이', 'if(false) return;   // 그사이'), '늦은 옛 필터 답이 덮음'],
    ['글 gen 비교를 뺌', UI.replace('if(g !== postGen) return;   // 그사이', 'if(false) return;   // 그사이'), '늦은 앞 글 답이 덮음'],
    ['[등록] busy 를 뺌', UI.replace("    if(busy) return;\n    const err = $('bbWErr');", "    const err = $('bbWErr');"), '연타 두 번'],
    ['시작에 배지 타이머를 넣음', UI.replace('    return refreshBadge();\n  }', '    setTimeout(refreshBadge, 5000);\n    return refreshBadge();\n  }'), '자동 되풀이'],
    ['목록 실패 번호를 뺌', UI.replace("      report(e, 'list');\n", ''), '못 받음이 조용함'],
    ['👍 를 본 수 + 1 로 그림', UI.replace("btn.textContent = '👍 나도 겪었어요 ' + r.likeN;", "btn.textContent = '👍 나도 겪었어요 ' + (Number(cur.post.likeN || 0) + 1);"), '서버 수를 안 봄'],
    ['답변에 본 시각을 안 실음', UI.replace('seenLastAnswerAt: post.lastAnswerIso', 'seenLastAnswerAt: null'), '겹침을 서버가 못 가림'],
    ['겹친 뒤 쓴 글을 안 되살림', UI.replace("          $('bbAText').value = text;\n", ''), '쓴 글이 사라짐'],
    ['답변 busy 를 뺌', UI.replace('    if(busy || !cur || !cur.post || !admin()) return;\n    const number = cur.number, post', '    if(!cur || !cur.post || !admin()) return;\n    const number = cur.number, post'), '연타 두 번'],
    ['답변 쓰기가 관리자 깃발을 안 봄', UI.replace('!cur.post || !admin()) return;\n    const number = cur.number, post', '!cur.post) return;\n    const number = cur.number, post'), '일반 사용자 화면이 보냄'],
    ['링크 저장에 열 때 받은 판을 안 넘김', UI.replace('bugApi.saveReportLink(linkCfg, link)', 'bugApi.saveReportLink({ version: 0, notice: linkCfg.notice }, link)'), '두 관리자가 덮어씀'],
    ['링크 폼 reset 이 안 닫음', UI.replace("{ const f = $('mhBugEditForm'); if(f) f.style.display = 'none'; }", ''), '다른 계정에 폼이 남음'],
    ['reset 이 provider 를 안 비움', UI.replace('    bugApi.reset();\n', ''), '앞 계정 배지 · 번호가 남음'],
  ];
  for (const [name, src, what] of breaks) {
    if (src === UI) { chk(false, name + ' — 바꿀 글을 못 찾음'); continue; }
    quiet = true; qfail = 0;
    try { await judgeUi(src); } catch (_) { qfail++; }
    quiet = false;
    chk(qfail > 0, name + ' → 빨강(' + what + ')');
  }
  say('');
  say(fail ? '문제 ' + fail + '건' : '전부 통과 ✅ — 버그제보 게시판은 서버 길로 받고 쓰며, 늦은 답 · 연타 · 실패를 화면이 갈래대로 다룬다');
  process.exit(fail ? 1 : 0);
})();
