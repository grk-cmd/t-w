/* bug-board-ui.js — 🐞 버그제보 게시판 화면 (검사 sim-bug-board.js)
   책임: 마이홈 「버그제보」 탭 안에서 목록 → 상세 → 글쓰기 세 화면을 바꿔 끼운다 · 탭 «새 답변» 배지.
     데이터는 서버(bug-api.js) — 화면은 provider 가 준 칸만 보고 경로 · 서버 이름을 모른다. 규칙 · 문구는 bug-board.js.
   ★ 비공개 글 — 남에게는 제목과 «익명» 만 보이고 누를 수 없다. 본문 · 답변은 서버가 막는다(남이 열면 «비공개 제보예요»).
   ★ 답변 알림은 우편함 tag 'bug' + bugId(글 번호). 우편함에서 누르면 window._bugBoardOpen(번호) 로 이 글이 열린다 ·
     새 답변 우편이 오면 window._bugBoardRefreshBadge(번호) — 배지를 다시 받고, 그 글을 보고 있으면 글도 다시 받는다.
   ★ 탭 배지 = 서버 «안 본 답변이 있는 내 글 수». 시작은 app-boot STEPS 의 bugBadge(start) · 내 글을 열면 서버에 «봤음» 뒤 다시 받는다.
     realtime 이 오래 끊겼다 붙으면(notification resync) 한 번 다시 받는다. 타이머로 되풀이하지 않는다.
   ★ 실패는 갈래(bug-api.js failOf)로 — 안내(번호 없음) · 공통(api-errors.js) · 그 밖은 그 자리 번호(E-BUG-01~07). 다시 보내지 않는다.
   ★ 늦은 답 버리기 — 목록 · 글 · 남은 수 받기마다 번호(gen)를 쥐고, 그사이 다른 필터 · 다른 글 · reset 이면 버린다.
   ★ 📝 임시저장 — 이 PC 에만(localStorage tw.bugDrafts · 규칙은 bug-board.js drafts*) 최대 3개 · 계정마다. 쓰던 글이 있을 때 떠나면 «임시저장할까요?».
   ★ 🔎 비슷한 제보 — [등록] 전에 미해결 · 최근 글 제목과 견줘(bug-board.js similarPosts) 비슷하면 창으로 보이고 그래도 올릴지 고른다. 못 받으면 창 없이 올린다.
   ⚠️ 확인창·메뉴를 따로 띄우지 않는다(전부 탭 안 화면 — «비슷한 제보» · «저장할까요?» 창도 게시판 안을 덮는 칸). alert/confirm 금지(audit 검사 4).
   ★ 관리자(앱 창 그대로 · 속만 서버) — [답변 등록] 은 글을 열 때 받은 lastAnswerIso 를 seenLastAnswerAt 으로 실어 보낸다(겹치면 409 → 글 다시 받고 쓴 글은 칸에 둔다).
     [🔗 오픈카톡 링크] 는 설정 bug.report 를 열 때 받아(판 version) 저장 때 그 판 · 안내 글을 그대로 싣는다. 답변 칸 [💬 오픈카톡] 의 기본 주소는 원격 설정(deps.bugReportLink).
     관리자 판정은 서버 — isAdmin 은 화면을 가리는 깃발이고, 서버가 아니라고 하면 실패 번호가 난다.
   classic script — bug-board.js · bug-api.js 다음 · app.js 보다 먼저 싣는다(window.TwBugBoardUi). app.js 가 createBugBoardUi(deps) 로 만든다. */
(function(){
'use strict';

/** @param {{
 *   bugApi: ReturnType<typeof window.TwBugApi.createBugApi>,   // 🌐 서버 경로 · 배지 수(bug-api.js)
 *   lib: typeof window.TwBugBoard,                               // 규칙 · 상수 · 문구(bug-board.js)
 *   apiErrors: { notify: (err: any, table: object) => any },    // 공통 code 번호 알림(TwApiErrors.store) — 기능 표는 bugApi.ERRORS
 *   notifyError: (code: string, err?: any) => boolean,          // TwErrorCodes.notify
 *   toast: (msg: string) => void, escHtml: (s: string) => string, safeHtml: { linkify: Function, safeUrl: Function },
 *   isAdmin: () => boolean,                                      // 화면을 가리는 깃발(관리자 판정은 서버)
 *   bugReportLink: () => string,                                 // 답변 칸 [💬 오픈카톡] 기본 주소(원격 설정 bugReport.link — 없으면 '')
 *   rtOn: (kind: string, fn: Function) => Function,              // realtime 알림 걸기(TwRtHub.store.on)
 *   getMyUserId: () => string,                                   // 내 유저 코드 — 📝 임시저장 주인(계정마다 따로)
 * }} deps */
function createBugBoardUi(deps){
const bugApi = deps.bugApi;
const lib = deps.lib;
const apiErrors = deps.apiErrors;
const notifyError = deps.notifyError;
const toast = deps.toast;
const escHtml = deps.escHtml;
const safeHtml = deps.safeHtml;
const isAdmin = deps.isAdmin;
const bugReportLink = deps.bugReportLink;
const rtOn = deps.rtOn;
const getMyUserId = deps.getMyUserId;
const mhHooks = TwMyHomeHooks;   // 🪝 마이홈 고리판 — 마이홈을 닫거나 탭을 옮길 때 쓰던 글을 묻는 LEAVE_GUARD 를 건다

  const $ = (id) => document.getElementById(id);
  const esc = (s) => escHtml(String(s == null ? '' : s));
  const linked = (s) => safeHtml.linkify(s);   // 본문 · 답변 · 답글 — 주소는 눌러서 기본 브라우저로(아래 openDetailLink)
  const admin = () => !!isAdmin();
  const KIND = bugApi.KIND;

  /* 그 자리 번호 — 부르는 곳마다 하나(번호는 글자 그대로 — sim-error-codes 가 찾는다) */
  const SITE = Object.freeze({
    list: (e) => notifyError('E-BUG-01', e),     // 목록 · 다음 쪽
    post: (e) => notifyError('E-BUG-02', e),     // 글 열기
    write: (e) => notifyError('E-BUG-03', e),    // [등록]
    reply: (e) => notifyError('E-BUG-04', e),    // [답글 등록]
    like: (e) => notifyError('E-BUG-05', e),     // 👍
    vis: (e) => notifyError('E-BUG-06', e),      // 공개 범위 바꾸기
    quota: (e) => notifyError('E-BUG-07', e),    // 글쓰기 «오늘 N건 남음»
    answer: (e) => notifyError('E-BUG-20', e),   // 관리자 [답변 등록]
    cfgLoad: (e) => notifyError('E-BUG-21', e),  // 관리자 링크 폼 열기
    cfgSave: (e) => notifyError('E-BUG-22', e),  // 관리자 링크 [저장]
  });
  /* 실패 하나를 알린다 — 안내 갈래는 errEl 칸(없으면 토스트)에 문구 · 공통은 공통 번호 · 그 밖은 그 자리 번호. 갈래를 돌려준다 */
  function report(e, site, errEl){
    const f = bugApi.failOf(e);
    if(f.kind === KIND.GUIDE || f.kind === KIND.PRIVATE){
      const text = lib.GUIDE_TEXT[f.code] || '';
      if(errEl) errEl.textContent = text; else toast(text);
    }else if(f.kind === KIND.COMMON) apiErrors.notify(e, bugApi.ERRORS);
    else SITE[site](e);
    return f;
  }

  let ready = false;          // 계정 기능을 시작했나(start) — 로그인 전 · reset 뒤엔 받지 않는다
  let rtHooked = false;
  let filter = 'all', cursors = [null], nextCursor = null;
  let rows = [];              // 지금 목록에 그린 줄(봤음 뒤 «새 답변» 표시를 끄려고)
  let listGen = 0, postGen = 0, quotaGen = 0;
  let cur = null;             // 연 글 { number, post(받았으면) }
  let busy = false;           // [등록] · [답글] · [답변] · [바꾸기] · 👍 — 한 번에 하나
  let linkCfg = null;         // 관리자 링크 폼을 열 때 받은 bug.report { version, notice, link }
  let linkBusy = false, linkGen = 0;
  let epoch = 0;              // reset 마다 오른다 — 계정을 놓기 전에 누른 쓰기의 답이 와도 화면을 고치지 않게

  function fmtDate(ts, withTime){
    if(!ts) return '';
    const d = new Date(ts), p = (n) => String(n).padStart(2, '0');
    const day = d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate());
    return withTime ? day + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) : day;
  }
  const catName = (k) => { const c = lib.BUG_CATS.find(x => x[0] === k); return c ? c[1] : '기타'; };
  const chip = (it) => it.notice
    ? '<span class="bb-chip notice">공지</span>'
    : '<span class="bb-chip ' + esc(it.status) + '">' + esc(lib.BUG_STATUS[it.status] || '접수') + '</span>';
  const canSeePrv = (it) => it.mine || admin();
  // 🛡 운영진 글 — 이름이 아니라 byAdmin(서버가 관리자 글에만 단다)으로 가른다. 공지도 관리자만 쓴다. 비공개 글은 늘 «익명».
  const whoName = (it) => ((it.vis === 'prv' || it.anon) ? esc(lib.BUG_ANON) : esc(TwPersonName.shown(it.name))) + ((it.byAdmin === true || it.notice) ? ' <span class="bb-adm" title="운영진">🛡</span>' : '');
  const backBtn = '<button class="bb-btn bb-back" type="button" data-act="back">◀ 목록</button>';
  const retryHtml = (text, act) => '<div class="bb-empty">' + esc(text) + ' <button class="bb-btn" type="button" data-act="' + esc(act) + '">다시 시도</button></div>';

  function show(view){
    $('bbListView').style.display = view === 'list' ? '' : 'none';
    $('bbDetailView').style.display = view === 'detail' ? '' : 'none';
    $('bbWriteView').style.display = view === 'write' ? '' : 'none';
    hideSimilar(); hideLeave();   // 화면을 바꾸면 덮는 칸(비슷한 제보 · 저장할까요?)도 닫는다
    const pg = $('mhPageBugreport'); if(pg) pg.scrollTop = 0;
  }

  /* ── 목록 ───────────────────────────────────────────── */
  function rowHtml(it){
    if(it.vis === 'prv' && !canSeePrv(it)){
      return '<div class="bb-row locked" title="글쓴이와 관리자만 볼 수 있어요">' + chip(it) +
        '<div class="bb-main"><div class="bb-title"><span class="bb-tag">[비공개]</span>🔒 ' + esc(it.title || '비공개 제보예요') + '</div></div>' +
        '<div class="bb-who">' + whoName(it) + '<br>' + fmtDate(it.createdAt) + '</div></div>';
    }
    const tag = it.notice ? '📌' : (it.vis === 'pub' ? '[공개]' : '[비공개]');
    const isNew = it.mine && it.unseen;
    return '<div class="bb-row' + (it.notice ? ' notice' : '') + '" data-id="' + esc(it.number) + '">' + chip(it) +
      '<div class="bb-main"><div class="bb-title"><span class="bb-tag">' + tag + '</span><span class="bb-tt">' + esc(it.title || '(제목 없음)') + '</span>' +
      (isNew ? '<span class="bb-new">새 답변</span>' : '') +
      ((admin() && it.authorReplied) ? '<span class="bb-new mine">✍ 글쓴이 답글</span>' : '') + '</div>' +
      (it.notice ? '' : '<div class="bb-sub">' + esc(catName(it.cat)) + ' · 👍' + Number(it.likeN || 0) + ' · 답변 ' + Number(it.ansN || 0) + '</div>') +
      '</div><div class="bb-who">' + whoName(it) + '<br>' + fmtDate(it.createdAt) + '</div></div>';
  }
  /* 빈 목록 문구. 2쪽부터 빈 것은 앞 쪽이 꽉 차서 [다음] 이 켜졌는데 더 없던 경우다 */
  function emptyText(f, page){
    if(page > 1) return f === 'open' ? '더 이전 미해결 제보가 없어요' : '더 이전 제보가 없어요';
    return f === 'mine' ? '아직 쓴 제보가 없어요' : f === 'open' ? '미해결 제보가 없어요' : '아직 제보가 없어요';
  }
  function setPager(page){
    $('bbPageNo').textContent = String(page);
    $('bbPrev').disabled = page <= 1;
    $('bbNext').disabled = !nextCursor;
  }
  /* 한 쪽 받기 — 전체 1쪽이면 공지를 따로 받아 위에(공지 실패는 공지 칸만 비움 · 번호 없음 — 목록이 주인) */
  async function loadList(){
    const box = $('bbRows'); if(!box) return;
    document.querySelectorAll('#bbListView .bb-flt').forEach(b => b.classList.toggle('on', b.dataset.f === filter));
    const page = cursors.length;
    const g = ++listGen;
    nextCursor = null;
    if(!ready){ rows = []; box.innerHTML = '<div class="bb-empty">로그인 뒤에 볼 수 있어요</div>'; setPager(page); return; }
    box.innerHTML = '<div class="bb-empty">불러오는 중…</div>';
    setPager(page);
    const f = filter;
    const notesP = (f === 'all' && page === 1)
      ? bugApi.notices().catch((e) => { console.warn('[버그제보] 공지 받기 실패', e); return []; })
      : Promise.resolve([]);
    let res, notes;
    try{ [res, notes] = await Promise.all([bugApi.list(f, cursors[cursors.length - 1], lib.BUG_PAGE), notesP]); }
    catch(e){
      if(g !== listGen) return;
      rows = [];
      box.innerHTML = retryHtml('목록을 불러오지 못했어요', 'retry');
      report(e, 'list');
      return;
    }
    if(g !== listGen) return;   // 그사이 필터 · 쪽이 바뀌었거나 reset — 늦은 답은 버린다
    nextCursor = res.next;
    rows = notes.concat(res.items);
    box.innerHTML = rows.length ? rows.map(rowHtml).join('') : '<div class="bb-empty">' + emptyText(f, page) + '</div>';
    box.scrollTop = 0;   // 목록은 #bbRows 안에서 스크롤한다(창 높이 고정) — 쪽을 넘기면 맨 위부터
    setPager(page);
  }

  /* ── 상세 ───────────────────────────────────────────── */
  async function openPost(number){
    const box = $('bbDetailView'); if(!box) return;
    show('detail');
    const g = ++postGen;
    cur = { number, post: null };
    if(!ready){ box.innerHTML = backBtn + '<div class="bb-empty">로그인 뒤에 볼 수 있어요</div>'; return; }
    box.innerHTML = backBtn + '<div class="bb-empty">불러오는 중…</div>';
    let d;
    try{ d = await bugApi.detail(number); }
    catch(e){
      if(g !== postGen) return;
      const f = bugApi.failOf(e);
      if(f.kind === KIND.MISSING) box.innerHTML = backBtn + '<div class="bb-empty">지워졌거나 없는 제보예요</div>';
      else if(f.kind === KIND.PRIVATE) box.innerHTML = backBtn + '<div class="bb-empty">🔒 비공개 제보예요</div>';
      else{ box.innerHTML = backBtn + retryHtml('제보를 불러오지 못했어요', 'reload'); report(e, 'post'); }
      return;
    }
    if(g !== postGen) return;   // 그사이 다른 글을 열었거나 reset
    cur.post = d;
    if(d.mine && d.answeredAt) markSeen(number);   // 운영자 답변이 달린 내 글만 «봤음» 이 뜻이 있다
    const h = [];
    h.push(backBtn);
    h.push('<div class="bb-dhead">' + chip(d) + '<span class="bb-tag">' + (d.notice ? '📌' : d.vis === 'pub' ? '[공개]' : '[비공개]') + '</span>' + esc(d.title || '(제목 없음)') + '</div>');
    // 글 번호(B-MMDD-n)는 관리자에게만 — 커밋 · PR 에서 제보를 가리키는 번호다.
    h.push('<div class="bb-dmeta">' + (admin() ? '<span class="bb-no">' + esc(d.number) + '</span> · ' : '') +
      whoName(d) + ' · ' + fmtDate(d.createdAt, true) + (d.notice ? '' : ' · ' + esc(catName(d.cat))) + '</div>');
    h.push('<div class="bb-body">' + linked(d.body) + '</div>');
    if(d.env) h.push('<div class="bb-env">🖥 ' + esc(d.env) + '</div>');
    if(d.vis === 'pub' && !d.notice){
      h.push('<button class="bb-btn bb-like' + (d.liked ? ' on' : '') + '" type="button" data-act="like"' + (d.liked ? ' disabled' : '') + '>👍 나도 겪었어요 ' + Number(d.likeN || 0) + '</button>');
    }
    d.comments.forEach(a => {
      if(a.byAuthor){
        const stName = a.st ? (lib.BUG_AUTHOR_STATUS.find(x => x[0] === a.st) || [])[1] : '';
        h.push('<div class="bb-ans mine"><div class="bb-ans-h">✍ 글쓴이 답글<span class="bb-ans-v">' + fmtDate(a.at, true) + '</span>' +
          (stName ? '<span class="bb-ans-st">상태 → <b>' + esc(stName) + '</b></span>' : '') + '</div><div class="bb-ans-t">' + linked(a.text) + '</div></div>');
        return;
      }
      h.push('<div class="bb-ans' + (a.vis === 'prv' ? ' prv' : '') + '"><div class="bb-ans-h">🛡 운영자 답변<span class="bb-ans-v">' +
        (a.vis === 'prv' ? '🔒 비공개' : '공개') + ' · ' + fmtDate(a.at, true) + '</span></div><div class="bb-ans-t">' + linked(a.text) + '</div>' +
        ((a.kakao && lib.KAKAO_RE.test(a.kakao)) ? '<div class="bb-kakao"><button type="button" data-kakao="' + esc(a.kakao) + '">💬 오픈카톡으로 이야기하기</button><small>' + esc(a.kakao) + '</small></div>' : '') +
        '</div>');
    });
    if(admin()) h.push(adminForm(d));
    else if(d.canReply) h.push(visForm(d) + authorForm(d));
    box.innerHTML = h.join('');
  }
  /* 봤음 — 서버에 적은 뒤 배지를 다시 받고 그 줄의 «새 답변» 을 끈다. 실패는 조용히(다음에 열 때 다시) */
  function markSeen(number){
    bugApi.seen(number).then(() => {
      rows.forEach(r => { if(r.number === number) r.unseen = false; });
      refreshBadge();
    }).catch((e) => console.warn('[버그제보] 봤음 실패', e));
  }
  function adminForm(it){
    const prvOnly = it.vis === 'prv';
    const opts = Object.keys(lib.BUG_STATUS).map(k => '<option value="' + esc(k) + '"' + (k === it.status ? ' selected' : '') + '>' + esc(lib.BUG_STATUS[k]) + '</option>').join('');
    return '<div class="bb-admin"><div class="bb-ans-h">답변 달기 (관리자)</div>' +
      '<textarea id="bbAText" maxlength="' + lib.BUG_ANS_MAX + '" placeholder="답변 내용"></textarea>' +
      '<div class="bb-row2">' +
      '<label><input type="radio" name="bbAVis" value="pub"' + (prvOnly ? ' disabled' : ' checked') + '> 공개</label>' +
      '<label><input type="radio" name="bbAVis" value="prv"' + (prvOnly ? ' checked disabled' : '') + '> 비공개</label>' +
      '<select id="bbAStatus">' + opts + '</select>' +
      '<button class="bb-btn" type="button" id="bbAKakaoBtn" data-act="kakao">💬 오픈카톡</button>' +
      '<span class="bb-sp"></span><button class="bb-btn" type="button" data-act="answer">답변 등록</button></div>' +
      (prvOnly ? '<div class="bb-hint">비공개 글이라 답변도 비공개로만 달려요.</div>' : '') +
      '<div class="bb-kk" id="bbAKk">💬 답변 아래에 오픈카톡 버튼이 붙어요 · 링크 <input id="bbAKakao" type="text" maxlength="300"><span class="bb-kk-x" data-act="kakaoX" title="취소">✕</span></div>' +
      '<div class="bb-err" id="bbAErr"></div><div class="bb-hint">등록하면 글쓴이 알림함에 알림이 가요.</div></div>';
  }
  /* 공개 범위 바꾸기 — 운영자 답변 · 내 답글 전까지만(bug-board.js canChangeVis · 서버 같은 조건). 못 바꾸면 버튼을 흐리게 두고 까닭을 적는다. */
  function visForm(it){
    const to = it.vis === 'pub' ? 'prv' : 'pub';
    const can = lib.canChangeVis(it);
    return '<div class="bb-row2 bb-vis"><button class="bb-btn" type="button" data-act="vis" data-vis="' + esc(to) + '"' + (can ? '' : ' disabled') + '>' +
      (to === 'prv' ? '🔒 비공개로 바꾸기' : '🌐 공개로 바꾸기') + '</button>' +
      '<span class="bb-hint">' + esc(can ? lib.BUG_VIS_NOTE : lib.BUG_VIS_LOCKED) + '</span></div><div class="bb-err" id="bbVErr"></div>';
  }
  async function submitVis(btn){
    if(busy || !cur || !cur.post) return;
    const number = cur.number, err = $('bbVErr');
    busy = true; btn.disabled = true; err.textContent = '';
    const at = epoch;
    let r;
    try{ r = await bugApi.setVis(number, cur.post.version, btn.dataset.vis); }
    catch(e){
      if(at !== epoch) return;
      busy = false;
      if(!cur || cur.number !== number) return;
      btn.disabled = false;
      if(bugApi.failOf(e).kind === KIND.CONFLICT){   // 그사이 글이 바뀌었다(번호 없음) — 다시 받아 버튼을 새로 정한다
        toast('다른 곳에서 바꾼 내용을 받아왔어요');
        openPost(number);
        return;
      }
      report(e, 'vis', err);
      return;
    }
    if(at !== epoch) return;
    busy = false;
    toast(r.vis === 'prv' ? '비공개로 바꿨어요' : '공개로 바꿨어요');
    if(cur && cur.number === number) openPost(number);
  }
  /* 글쓴이 답글 칸 — 상태는 늘 하나를 고른다(기본 «해결 안 됨» — 답글을 다는 건 대개 아직 안 고쳐져서다).
     «그대로» 버튼은 해결 안 됨과 같은 뜻으로 읽혀 뺐다. 고른 버튼은 눌린 모양(.on). */
  const AUTHOR_DEFAULT_ST = 'unfixed';
  function authorForm(it){
    return '<div class="bb-admin mine"><div class="bb-ans-h">✍ 답글 달기 (글쓴이)</div>' +
      '<textarea id="bbRText" maxlength="' + lib.BUG_ANS_MAX + '" placeholder="업데이트 후에도 그런지, 더 알려 줄 내용"></textarea>' +
      '<div class="bb-row2"><span class="bb-k">상태</span>' +
      lib.BUG_AUTHOR_STATUS.map(s => '<button class="bb-btn bb-rst' + (s[0] === AUTHOR_DEFAULT_ST ? ' on' : '') + '" type="button" data-act="rst" data-st="' + esc(s[0]) + '">' + esc(s[1]) + '</button>').join('') +
      '</div><div class="bb-row2">' +
      (it.vis === 'prv' ? '<span class="bb-hint">비공개 글이라 답글도 글쓴이 · 관리자만 봐요.</span>' : '<span class="bb-hint">공개 글이라 답글도 모두에게 보여요.</span>') +
      '<span class="bb-sp"></span><button class="bb-btn" type="button" data-act="reply">답글 등록</button></div>' +
      '<div class="bb-err" id="bbRErr"></div></div>';
  }
  async function submitReply(btn){
    if(busy || !cur || !cur.post) return;
    const number = cur.number, box = $('bbDetailView'), err = $('bbRErr');
    const text = $('bbRText').value.trim();
    if(!text){ err.textContent = '답글을 적어 주세요'; return; }
    const on = box.querySelector('.bb-rst.on');
    busy = true; btn.disabled = true; err.textContent = '';
    const at = epoch;
    try{ await bugApi.reply(number, { text, status: on ? on.dataset.st : AUTHOR_DEFAULT_ST }); }
    catch(e){
      if(at !== epoch) return;
      busy = false; btn.disabled = false;
      if(cur && cur.number === number) report(e, 'reply', err);
      return;
    }
    if(at !== epoch) return;
    busy = false; btn.disabled = false;
    toast('답글을 등록했어요');
    if(cur && cur.number === number) openPost(number);
  }
  /* 관리자 [답변 등록] — 본 마지막 답변 시각(seenLastAnswerAt)을 실어 보낸다. 겹치면(BUG_ANSWER_CONFLICT) 글을 다시 받고 쓴 글은 칸에 둔다.
     알림은 서버가 글쓴이에게 보낸다 — 앱은 우편을 쓰지 않는다. */
  async function submitAnswer(btn){
    if(busy || !cur || !cur.post || !admin()) return;
    const number = cur.number, post = cur.post, err = $('bbAErr');
    const text = $('bbAText').value.trim();
    if(!text){ err.textContent = '답변을 적어 주세요'; return; }
    const kakao = $('bbAKk').classList.contains('on') ? $('bbAKakao').value.trim() : '';
    if(kakao && !lib.KAKAO_RE.test(kakao)){ err.textContent = lib.KAKAO_LINK_RULE; return; }
    const box = $('bbDetailView'), picked = box.querySelector('input[name="bbAVis"]:checked');
    const a = { seenLastAnswerAt: post.lastAnswerIso, text, status: $('bbAStatus').value, kakaoLink: kakao,
      vis: post.vis === 'prv' ? 'prv' : (picked ? picked.value : 'pub') };
    busy = true; btn.disabled = true; err.textContent = '';
    const at = epoch;
    try{ await bugApi.answer(number, a); }
    catch(e){
      if(at !== epoch) return;
      busy = false; btn.disabled = false;
      if(!cur || cur.number !== number) return;
      if(bugApi.failOf(e).kind === KIND.CONFLICT){   // 다른 관리자가 먼저 답했다(번호 없음) — 새 답변을 보여 주고 쓴 글은 그대로
        toast(lib.ANSWER_CONFLICT_TEXT);
        await openPost(number);
        if(at === epoch && cur && cur.number === number && $('bbAText')){
          $('bbAText').value = text;
          if($('bbAKakao') && kakao){ $('bbAKakao').value = kakao; $('bbAKk').classList.add('on'); }
        }
        return;
      }
      report(e, 'answer', err);   // 쓴 글은 칸에 그대로
      return;
    }
    if(at !== epoch) return;
    busy = false; btn.disabled = false;
    toast('답변을 등록했어요');
    if(cur && cur.number === number) openPost(number);
  }
  async function likePost(btn){
    if(busy || !cur || !cur.post) return;
    const number = cur.number;
    busy = true; btn.disabled = true;
    const at = epoch;
    let r;
    try{ r = await bugApi.like(number); }
    catch(e){
      if(at !== epoch) return;
      busy = false; btn.disabled = false;
      report(e, 'like');
      return;
    }
    if(at !== epoch) return;
    busy = false;
    // 서버가 돌려준 수로 그린다 — 본 뒤에 다른 사람이 누른 것까지 맞는다
    if(cur && cur.number === number && cur.post){ cur.post.liked = r.liked; cur.post.likeN = r.likeN; }
    btn.classList.toggle('on', r.liked); btn.disabled = r.liked; btn.textContent = '👍 나도 겪었어요 ' + r.likeN;
  }

  /* ── 글쓰기 ─────────────────────────────────────────── */
  function openWrite(){
    if(!ready){ toast('로그인 뒤에 쓸 수 있어요'); return; }
    const sel = $('bbWCat');
    if(!sel.options.length) sel.innerHTML = lib.BUG_CATS.map(c => '<option value="' + esc(c[0]) + '">' + esc(c[1]) + '</option>').join('');
    $('bbWTitle').value = ''; $('bbWBody').value = ''; $('bbWErr').textContent = '';
    document.querySelectorAll('input[name="bbWVis"]').forEach(r => { r.disabled = false; r.checked = r.value === 'pub'; });
    $('bbWEnv').checked = true; $('bbWNotice').checked = false;
    loaded = null; writeSeq++;
    show('write');
    renderDrafts();
    $('bbWTitle').focus();
    showQuota();
  }
  /* 오늘 남은 제보 수 — 서버가 센다(서울 자정 기준 · 관리자는 상한 없음 = dailyMax null). 다 썼으면 등록 단추를 끈다.
     못 받으면 단추는 켜 둔다(서버가 [등록] 때 다시 막는다) · 번호 E-BUG-07. */
  async function showQuota(){
    const btn = $('bbWSubmit');
    btn.disabled = false; btn.textContent = '등록';
    const g = ++quotaGen;
    if(admin()) return;
    let q;
    try{ q = await bugApi.quota(); }
    catch(e){ if(g === quotaGen && $('bbWriteView').style.display !== 'none') report(e, 'quota'); return; }
    if(g !== quotaGen || $('bbWriteView').style.display === 'none' || q.dailyMax == null) return;
    const left = q.dailyMax - q.usedToday;
    if(left <= 0){
      btn.disabled = true;
      $('bbWErr').textContent = '오늘은 제보를 ' + q.dailyMax + '건 모두 썼어요 — 내일 다시 써 주세요';
    }else btn.textContent = '등록 (오늘 ' + left + '건 남음)';
  }
  async function envString(){
    let ver = '';
    try{ if(window.companion && companion.getAppVersion) ver = await companion.getAppVersion(); }catch(_){}
    const ua = navigator.userAgent || '';
    const os = /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '기타 OS';
    return (ver ? 'v' + ver + ' · ' : '') + os;
  }
  /* 🔎 비슷한 제보 창 — 제목이 비슷한 글(bug-board.js similarPosts)을 목록 줄 모양 그대로 보여 준다.
     [그래도 제보하기] 는 비교 없이 다시 올리기 · [취소] · × · Esc 는 쓰던 글을 그대로 두고 창만 닫는다.
     ⚠️ 여닫힘은 .on — ESC 스택(shared/win-stack.js ESC_YIELD_SEL)이 이 칸이 «보이는 동안» 마이홈을 닫지 않고 양보한다. */
  function showSimilar(title, items){
    $('bbSimLead').textContent = '쓰신 제목 «' + title + '» 와 비슷한 제보가 이미 올라와 있어요.';
    $('bbSimRows').innerHTML = items.map(rowHtml).join('');
    $('bbSimilar').classList.add('on');
    $('bbSimCancel').focus();
  }
  function hideSimilar(){ $('bbSimilar').classList.remove('on'); }
  // 보이는 동안만 «열림» — 마이홈을 닫거나 다른 탭으로 옮기면 숨은 채 남은 칸이 Esc 를 가로채지 않게
  const similarOpen = () => $('bbSimilar').classList.contains('on') && $('bbSimilar').offsetParent !== null;
  /* 미해결 · 최근 글을 한 쪽씩(각 BUG_SIMILAR_FETCH) 받아 제목이 비슷한 것. 한쪽만 받아도 그것으로 본다 · 둘 다 못 받으면 던진다 */
  async function similarTo(title){
    const got = await Promise.allSettled(['open', 'all'].map(f => bugApi.list(f, null, lib.BUG_SIMILAR_FETCH)));
    const ok = got.filter(x => x.status === 'fulfilled');
    if(!ok.length) throw got[0].reason;
    const items = [].concat(...ok.map(x => x.value.items)).map(it => Object.assign({ id: it.number }, it));
    return lib.similarPosts(title, items);
  }
  /* 📝 임시저장 — loaded = 지금 폼에 불러온 임시글(그대로면 «고친 것 없음» · 다시 저장하면 그 칸을 덮는다 · 등록하면 지운다) */
  let loaded = null;
  let writeSeq = 0;   // 글쓰기를 새로 열 때마다 — 비슷한 제보를 찾는 동안 나갔다 다시 열면 늦게 온 결과를 버린다
  const draftOwner = () => getMyUserId() || '';
  const formNow = () => ({ cat: $('bbWCat').value, title: $('bbWTitle').value, body: $('bbWBody').value,
    vis: (document.querySelector('input[name="bbWVis"]:checked') || {}).value === 'prv' ? 'prv' : 'pub' });
  const writing = () => $('bbWriteView').style.display !== 'none';
  const dirty = () => writing() && lib.draftDirty(formNow(), loaded);
  function draftsLoad(){ let raw = null; try{ raw = localStorage.getItem(lib.BUG_DRAFT_KEY); }catch(_){} return lib.draftsRead(raw, draftOwner()); }
  function draftsStore(list){
    try{ localStorage.setItem(lib.BUG_DRAFT_KEY, lib.draftsWrite(list, draftOwner())); return true; }
    catch(e){ notifyError('E-BUG-08', e); return false; }
  }
  function renderDrafts(){
    const box = $('bbDrafts'); if(!box) return;
    const list = draftsLoad();
    box.classList.toggle('on', list.length > 0);
    box.innerHTML = list.length ? '<div class="bb-drafts-head">📝 임시저장 ' + list.length + '/' + lib.BUG_DRAFT_MAX + '</div>' + list.map(d =>
      '<div class="bb-draft' + (loaded && loaded.id === d.id ? ' on' : '') + '" data-did="' + esc(d.id) + '">' +
      '<button class="bb-draft-open" type="button" data-dact="open" title="불러오기">' + esc(d.title.trim() || '(제목 없음)') + '</button>' +
      '<span class="bb-draft-ts">' + fmtDate(d.ts, true) + '</span>' +
      '<button class="bb-draft-x" type="button" data-dact="del" title="지우기" aria-label="지우기">×</button></div>').join('') : '';
  }
  /* 저장 — 성공하면 true. 비었거나 3개가 찼으면 err 칸에 까닭 */
  function saveDraft(errEl, inPrompt){
    if(!draftOwner()){ errEl.textContent = '로그인한 뒤에 임시저장할 수 있어요'; return false; }
    const list = draftsLoad();
    const r = lib.draftsSave(list, Object.assign(formNow(), { id: loaded ? loaded.id : null }), Date.now(), Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    if(!r.ok){
      errEl.textContent = r.reason !== 'full' ? '저장할 내용이 없어요'
        : inPrompt ? '임시저장이 ' + lib.BUG_DRAFT_MAX + '개 차 있어요 — [계속 쓰기] 로 돌아가 목록에서 하나를 지운 뒤 저장해 주세요'
        : '임시저장은 ' + lib.BUG_DRAFT_MAX + '개까지예요 — 위 목록에서 하나를 지운 뒤 저장해 주세요';
      return false;
    }
    if(!draftsStore(r.list)) return false;
    loaded = r.list.find(x => x.id === r.id) || null;
    errEl.textContent = '';
    renderDrafts();
    toast('📝 임시저장했어요 (' + r.list.length + '/' + lib.BUG_DRAFT_MAX + ')');
    return true;
  }
  function fillForm(d){
    const sel = $('bbWCat'); if([].some.call(sel.options, o => o.value === d.cat)) sel.value = d.cat;   // 없는 분류면 지금 값 그대로
    $('bbWTitle').value = d.title; $('bbWBody').value = d.body;
    document.querySelectorAll('input[name="bbWVis"]').forEach(r => { r.checked = r.value === d.vis; });
    loaded = d; $('bbWErr').textContent = '';
    renderDrafts();
  }
  /* 📝 «저장할까요?» — 쓰던 글이 있을 때만 묻고, 고르면 next() 로 이어 간다 */
  let leaveNext = null;
  const LEAVE_BTNS = { save: '임시저장하고 나가기', drop: '저장 안 하고 나가기' };
  function askLeave(lead, next, btns){
    if(!dirty()){ next(); return; }
    writeSeq++;   // 비슷한 제보를 찾는 중이었으면 그 등록은 무른다(떠나려고 했으니)
    leaveNext = next;
    $('bbLeaveLead').textContent = lead;
    $('bbLeaveSave').textContent = (btns || LEAVE_BTNS).save; $('bbLeaveDrop').textContent = (btns || LEAVE_BTNS).drop;
    $('bbLeaveErr').textContent = '';
    $('bbLeave').classList.add('on');
    $('bbLeaveStay').focus();
  }
  function hideLeave(){ $('bbLeave').classList.remove('on'); leaveNext = null; }
  const leaveOpen = () => $('bbLeave').classList.contains('on') && $('bbLeave').offsetParent !== null;
  function leaveGo(save){
    const next = leaveNext;
    if(save && !saveDraft($('bbLeaveErr'), true)) return;   // 저장 못 하면(3개 · 저장 실패) 창에 남아 까닭을 보인다
    hideLeave();
    if(next) next();
  }
  /* 🪝 마이홈을 닫거나 탭을 옮길 때(myhome-ui.js) — 버그제보 탭이 보이고 쓰던 글이 있을 때만 묻는다.
     고른 뒤엔 목록으로 바꾸고 이어 가므로, 이어 가는 길(탭 옮기기)이 고리를 다시 불러도 쓰던 글이 없어 묻지 않는다 */
  mhHooks.on(mhHooks.HOOK.LEAVE_GUARD, (next) => {
    const pg = $('mhPageBugreport');
    if(!pg || !pg.classList.contains('on') || !dirty()) return false;
    askLeave(leaveLead(), () => { show('list'); next(); });   // 고른 뒤 게시판은 목록으로 — 돌아왔을 때 버린 글이 남아 있지 않게
    return true;
  });
  const leaveLead = () => '임시저장할까요? 임시저장은 이 PC 에만 ' + lib.BUG_DRAFT_MAX + '개까지 남아요.';
  async function submitWrite(btn, skipSimilar){
    if(busy) return;
    const err = $('bbWErr');
    const notice = admin() && $('bbWNotice').checked;
    const p = {
      cat: $('bbWCat').value, title: $('bbWTitle').value, body: $('bbWBody').value,
      vis: notice ? 'pub' : ((document.querySelector('input[name="bbWVis"]:checked') || {}).value || 'pub'),
      notice,
    };
    const bad = lib.checkPost(p); if(bad){ err.textContent = bad; return; }
    if(!notice && !skipSimilar){
      btn.disabled = true; err.textContent = '';
      const seq = writeSeq;
      let sim = [];
      try{ sim = await similarTo(p.title); }catch(e){ console.warn('[버그제보] 비슷한 제보 받기 실패', e); sim = []; }   // 못 받으면 창 없이 올린다 — 비교는 안내라 올리기를 막지 않는다
      btn.disabled = false;
      if(!writing() || seq !== writeSeq) return;   // 찾는 동안 떠났거나 글쓰기를 새로 열었으면 올리지도 띄우지도 않는다
      if(sim.length){ showSimilar(p.title.trim(), sim); return; }
    }
    busy = true; btn.disabled = true; err.textContent = '';
    if($('bbWEnv').checked) p.env = (await envString()).slice(0, lib.BUG_ENV_MAX);
    const at = epoch;
    let r;
    try{ r = await bugApi.write(p); }
    catch(e){
      if(at !== epoch) return;   // 그사이 계정을 놓았다(reset)
      busy = false; btn.disabled = false;
      report(e, 'write', err);   // 입력은 그대로 둔다
      return;
    }
    if(at !== epoch) return;
    busy = false; btn.disabled = false;
    toast(notice ? '📌 공지를 등록했어요' : '🐞 제보를 등록했어요');
    if(loaded){ draftsStore(lib.draftsRemove(draftsLoad(), loaded.id)); loaded = null; }   // 올린 임시글은 지운다
    cursors = [null];
    openPost(r.number);
  }

  /* ── 배지 ───────────────────────────────────────────── */
  function renderBadge(){
    const n = bugApi.badgeCount() || 0;
    const tab = document.querySelector('#myHomeTabs .mh-tab[data-tab="bugreport"]');
    if(tab){
      let badge = tab.querySelector('.mh-tab-badge');
      if(n > 0){
        if(!badge){ badge = document.createElement('span'); badge.className = 'mh-tab-badge'; tab.appendChild(badge); }
        badge.textContent = n > 9 ? '9+' : String(n);
        badge.style.display = 'inline-block';
      }else if(badge) badge.style.display = 'none';
    }
    const dot = $('bbMineDot'); if(dot) dot.classList.toggle('on', n > 0);
  }
  /* 배지 수 한 번 받기 — 못 받으면 이전 값 그대로(번호 없음 — 신호 · 시작에 이은 받기라 사용자가 누른 일이 아니다) */
  function refreshBadge(){
    if(!ready) return Promise.resolve();
    return bugApi.refreshBadge().then(renderBadge, (e) => console.warn('[버그제보] 배지 받기 실패', e));
  }

  /* ── 탭 들어올 때 · 우편함에서 열 때 · 새 답변 우편 ───────── */
  function enter(){
    if(dirty()){ askLeave(leaveLead(), () => { show('list'); enter(); }); return; }   // 쓰던 중에 탭을 다시 누르면 먼저 묻는다
    show('list');
    refreshBadge();
    loadList();
  }
  window._bugBoardRefreshBadge = function(number){
    refreshBadge();
    const box = $('bbDetailView');
    if(number && cur && cur.number === number && box && box.style.display !== 'none') openPost(number);   // 보고 있는 글에 답변이 왔다
  };
  window._bugBoardOpen = function(number){
    const tab = document.querySelector('#myHomeTabs .mh-tab[data-tab="bugreport"]');
    if(tab && !tab.classList.contains('on')) tab.click();   // 탭 바인딩이 enter() 를 부른다
    askLeave(leaveLead(), () => openPost(number));   // 버그제보 탭에서 쓰던 글이 있으면 먼저 묻는다
  };

  /* 상세 화면 안 바깥 주소 — 오픈카톡 버튼 · 글 속 주소 칸(linkify). 누른 것이 그 둘이면 기본 브라우저로 넘기고 true.
     data-url 은 화면에 그린 값이라 열기 전에 safeUrl 로 한 번 더 거른다(main 도 http(s) 만 연다). */
  function openDetailLink(e){
    const k = e.target.closest('[data-kakao]');
    if(k){
      const url = k.dataset.kakao;
      if(lib.KAKAO_RE.test(url) && window.companion && companion.openBrowser) companion.openBrowser(url);
      return true;
    }
    const ln = e.target.closest('.ext-link[data-url]');
    if(ln){
      const url = safeHtml.safeUrl(ln.dataset.url, 'link');
      if(url && window.companion && companion.openBrowser) companion.openBrowser(url);
      return true;
    }
    return false;
  }
  function bind(){
    const board = $('bbBoard'); if(!board) return;
    const tab = document.querySelector('#myHomeTabs .mh-tab[data-tab="bugreport"]');
    if(tab) tab.addEventListener('click', enter);
    document.querySelectorAll('#bbListView .bb-flt').forEach(b => b.addEventListener('click', () => {
      filter = b.dataset.f; cursors = [null]; loadList();
    }));
    $('bbPrev').addEventListener('click', () => { if(cursors.length > 1){ cursors.pop(); loadList(); } });
    $('bbNext').addEventListener('click', () => { if(nextCursor != null){ cursors.push(nextCursor); loadList(); } });
    $('bbWriteBtn').addEventListener('click', openWrite);
    $('bbWCancel').addEventListener('click', () => askLeave(leaveLead(), () => show('list')));
    $('bbWDraft').addEventListener('click', () => saveDraft($('bbWErr')));
    $('bbDrafts').addEventListener('click', (e) => {
      const b = e.target.closest('[data-dact]'), row = e.target.closest('.bb-draft[data-did]'); if(!b || !row) return;
      const id = row.dataset.did;
      if(b.dataset.dact === 'del'){
        if(draftsStore(lib.draftsRemove(draftsLoad(), id))){ if(loaded && loaded.id === id) loaded = null; renderDrafts(); }
        return;
      }
      const d = draftsLoad().find(x => x.id === id); if(!d) return;
      if(loaded && loaded.id === id){
        if(!dirty()) return;
        askLeave('고친 내용이 있어요 — 임시저장할까요, 아니면 저장해 둔 글로 되돌릴까요?', () => fillForm(draftsLoad().find(x => x.id === id) || d), { save: '고친 내용 임시저장', drop: '고친 것 버리고 되돌리기' });
        return;
      }
      askLeave('지금 쓰던 글을 임시저장하고 «' + (d.title.trim() || '제목 없음') + '» 을 불러올까요?', () => fillForm(draftsLoad().find(x => x.id === id) || d), { save: '임시저장하고 불러오기', drop: '저장 안 하고 불러오기' });
    });
    $('bbLeaveSave').addEventListener('click', () => leaveGo(true));
    $('bbLeaveDrop').addEventListener('click', () => leaveGo(false));
    $('bbLeaveStay').addEventListener('click', hideLeave);
    $('bbLeaveX').addEventListener('click', hideLeave);
    $('bbWSubmit').addEventListener('click', (e) => submitWrite(e.currentTarget));
    $('bbSimGo').addEventListener('click', () => { hideSimilar(); submitWrite($('bbWSubmit'), true); });
    $('bbSimCancel').addEventListener('click', hideSimilar);
    $('bbSimX').addEventListener('click', hideSimilar);
    $('bbSimRows').addEventListener('click', (e) => {
      const row = e.target.closest('.bb-row[data-id]'); if(!row) return;
      hideSimilar(); askLeave(leaveLead(), () => openPost(row.dataset.id));
    });
    // Esc 는 이 창만 닫는다 — ESC 스택은 ESC_YIELD_SEL 로 양보하고 여기서 받는다
    document.addEventListener('keydown', (e) => {
      if(e.key !== 'Escape' || e.defaultPrevented) return;   // ESC 스택이 이 키로 마이홈 닫기(→ 저장할까요?)를 이미 했으면 방금 연 창을 닫지 않는다
      if(leaveOpen()){ e.preventDefault(); hideLeave(); }   // «저장할까요?» 에서 Esc = 계속 쓰기
      else if(similarOpen()){ e.preventDefault(); hideSimilar(); }
    }, true);
    $('bbWNotice').addEventListener('change', (e) => {
      // 공지는 공개 글이다 — 고르는 동안 공개 범위를 공개로 묶는다
      document.querySelectorAll('input[name="bbWVis"]').forEach(r => { r.disabled = e.target.checked; if(e.target.checked && r.value === 'pub') r.checked = true; });
    });
    $('bbRows').addEventListener('click', (e) => {
      if(e.target.closest('[data-act="retry"]')){ loadList(); return; }
      const row = e.target.closest('.bb-row[data-id]'); if(row) openPost(row.dataset.id);
    });
    $('bbDetailView').addEventListener('click', (e) => {
      if(openDetailLink(e)) return;
      const el = e.target.closest('[data-act]'); if(!el) return;
      const act = el.dataset.act;
      if(act === 'back'){ show('list'); loadList(); }
      else if(act === 'reload'){ if(cur) openPost(cur.number); }
      else if(act === 'like') likePost(el);
      else if(act === 'answer') submitAnswer(el);
      else if(act === 'reply') submitReply(el);
      else if(act === 'vis') submitVis(el);
      else if(act === 'rst'){ el.parentNode.querySelectorAll('.bb-rst').forEach(b => b.classList.toggle('on', b === el)); }
      else if(act === 'kakao'){
        const kk = $('bbAKk'), on = !kk.classList.contains('on');
        kk.classList.toggle('on', on); el.classList.toggle('on', on);
        if(on && !$('bbAKakao').value) $('bbAKakao').value = bugReportLink();
      }
      else if(act === 'kakaoX'){ $('bbAKk').classList.remove('on'); $('bbAKakaoBtn').classList.remove('on'); }
    });
  }
  bind();

  /* ── 관리자 오픈카톡 기본 링크 폼(설정 bug.report) ───────────── */
  function bindReportLink(){
    const editBtn = $('mhBugEditBtn'), form = $('mhBugEditForm'), linkIn = $('mhBugLinkInput');
    const saveBtn = $('mhBugSaveBtn'), cancelBtn = $('mhBugCancelBtn'), msgEl = $('mhBugEditMsg');
    if(!editBtn || !form) return;
    const showMsg = (text, isErr) => {
      msgEl.textContent = text;
      msgEl.style.color = isErr ? 'var(--win-error)' : 'var(--ink-soft)';
      msgEl.style.display = text ? 'block' : 'none';
    };
    const closeForm = () => { form.style.display = 'none'; };
    const fill = (c) => { linkCfg = c; linkIn.value = c.link; };
    editBtn.addEventListener('click', async () => {
      if(!admin() || linkBusy) return;
      if(form.style.display !== 'none'){ closeForm(); return; }
      linkBusy = true; showMsg('', false);
      const g = ++linkGen;
      try{
        const c = await bugApi.reportConfig();
        if(g !== linkGen) return;
        fill(c);
        form.style.display = 'block';
        linkIn.focus();
      }catch(e){
        if(g === linkGen) report(e, 'cfgLoad');   // 폼은 열지 않는다
      }finally{
        if(g === linkGen) linkBusy = false;
      }
    });
    cancelBtn.addEventListener('click', () => { linkGen++; linkBusy = false; closeForm(); });
    saveBtn.addEventListener('click', async () => {
      if(!admin()){ toast('관리자만 수정할 수 있어요'); return; }
      if(linkBusy || !linkCfg) return;
      const link = linkIn.value.trim();
      if(link && !lib.KAKAO_RE.test(link)){ showMsg(lib.KAKAO_LINK_RULE, true); return; }
      linkBusy = true; saveBtn.disabled = true; showMsg('저장 중…', false);
      const g = ++linkGen;
      try{
        fill(await bugApi.saveReportLink(linkCfg, link));
        if(g !== linkGen) return;
        showMsg('', false);
        toast('오픈카톡 기본 링크를 저장했어요');
        closeForm();
      }catch(e){
        if(g !== linkGen) return;
        if(bugApi.failOf(e).kind === KIND.CONFLICT){   // 그사이 다른 곳에서 바꿨다 — 다시 받아 칸을 채운다
          try{ fill(await bugApi.reportConfig()); showMsg(lib.CONFIG_CONFLICT_TEXT, false); }
          catch(e2){ if(g === linkGen){ showMsg('', false); report(e2, 'cfgLoad'); } }
        }else{ showMsg('', false); report(e, 'cfgSave'); }
      }finally{
        if(g === linkGen){ linkBusy = false; saveBtn.disabled = false; }
      }
    });
  }
  bindReportLink();

  /* 계정 기능 시작(app-boot STEPS bugBadge) — 배지 한 번 받기 · realtime 이 오래 끊겼다 붙으면 한 번 다시 받기 */
  function start(){
    ready = true;
    if(!rtHooked){
      rtHooked = true;
      rtOn('notification', (n) => { if(n && n.resync) refreshBadge(); });
    }
    return refreshBadge();
  }
  /* 계정을 놓을 때 — 배지 · 목록 · 연 글을 비우고 진행 중인 받기 답을 버린다. 쓰던 글은 버린다(다른 계정 이름으로 올라가지 않게) · 임시저장은 계정마다라 두지만 불러온 표시는 비운다 */
  function reset(){
    ready = false; busy = false;
    loaded = null; writeSeq++;
    bugApi.reset();
    epoch++; listGen++; postGen++; quotaGen++;
    linkGen++; linkBusy = false; linkCfg = null;
    { const f = $('mhBugEditForm'); if(f) f.style.display = 'none'; }
    filter = 'all'; cursors = [null]; nextCursor = null; rows = []; cur = null;
    if($('bbBoard')){
      show('list');
      $('bbRows').innerHTML = '<div class="bb-empty">로그인 뒤에 볼 수 있어요</div>';
      $('bbDetailView').innerHTML = '';
      setPager(1);
    }
    renderBadge();
  }

  return { start, reset, refreshBadge };
}

const out = { createBugBoardUi };
if(typeof window !== 'undefined') window.TwBugBoardUi = out;
if(typeof module !== 'undefined' && module.exports) module.exports = out;
})();

