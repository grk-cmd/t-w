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
   ⚠️ 확인창·메뉴를 따로 띄우지 않는다(전부 탭 안 화면). alert/confirm 금지(audit 검사 4).
   TODO(D9-4): 관리자 [답변 등록] 은 아직 서버 길이 없다 — 다음 묶음이 POST /v1/admin/bugs/{number}/answers 로 잇는다.
   classic script — bug-board.js · bug-api.js 다음 · app.js 보다 먼저 싣는다(window.TwBugBoardUi). app.js 가 createBugBoardUi(deps) 로 만든다. */
(function(){
'use strict';

/** @param {{
 *   bugApi: ReturnType<typeof window.TwBugApi.createBugApi>,   // 🌐 서버 길 · 배지 수(bug-api.js)
 *   lib: typeof window.TwBugBoard,                               // 규칙 · 상수 · 문구(bug-board.js)
 *   apiErrors: { notify: (err: any, table: object) => any },    // 공통 code 번호 알림(TwApiErrors.store) — 기능 표는 bugApi.ERRORS
 *   notifyError: (code: string, err?: any) => boolean,          // TwErrorCodes.notify
 *   toast: (msg: string) => void, escHtml: (s: string) => string, safeHtml: { linkify: Function, safeUrl: Function },
 *   isAdmin: () => boolean,                                      // 화면을 가리는 깃발(관리자 판정은 서버)
 *   rtOn: (kind: string, fn: Function) => Function,              // realtime 알림 걸기(TwRtHub.store.on)
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
const rtOn = deps.rtOn;

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
  let busy = false;           // [등록] · [답글] · [바꾸기] · 👍 — 한 번에 하나
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
  const whoName = (it) => ((it.vis === 'prv' || it.anon) ? esc(lib.BUG_ANON) : esc(it.name)) + ((it.byAdmin === true || it.notice) ? ' <span class="bb-adm" title="운영진">🛡</span>' : '');
  const backBtn = '<button class="bb-btn bb-back" type="button" data-act="back">◀ 목록</button>';
  const retryHtml = (text, act) => '<div class="bb-empty">' + esc(text) + ' <button class="bb-btn" type="button" data-act="' + esc(act) + '">다시 시도</button></div>';

  function show(view){
    $('bbListView').style.display = view === 'list' ? '' : 'none';
    $('bbDetailView').style.display = view === 'detail' ? '' : 'none';
    $('bbWriteView').style.display = view === 'write' ? '' : 'none';
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
  /* TODO(D9-4): 관리자 답변 — 서버 길(POST /v1/admin/bugs/{number}/answers · seenLastAnswerAt)로 잇는 일은 다음 묶음이다. 지금은 등록하지 않고 까닭만 적는다. */
  function submitAnswer(){
    const err = $('bbAErr'); if(err) err.textContent = '답변 등록은 아직 서버로 옮기는 중이에요';
  }
  async function likePost(btn){
    if(busy || !cur || !cur.post) return;
    const number = cur.number, n = Number(cur.post.likeN || 0);
    busy = true; btn.disabled = true;
    const at = epoch;
    try{ await bugApi.like(number); }
    catch(e){
      if(at !== epoch) return;
      busy = false; btn.disabled = false;
      report(e, 'like');
      return;
    }
    if(at !== epoch) return;
    busy = false;
    // 서버는 한 사람 한 번만 센다 — 누를 수 있던 버튼(아직 안 누름)이니 본 수 + 1
    if(cur && cur.number === number && cur.post){ cur.post.liked = true; cur.post.likeN = n + 1; }
    btn.classList.add('on'); btn.textContent = '👍 나도 겪었어요 ' + (n + 1);
  }

  /* ── 글쓰기 ─────────────────────────────────────────── */
  function openWrite(){
    if(!ready){ toast('로그인 뒤에 쓸 수 있어요'); return; }
    const sel = $('bbWCat');
    if(!sel.options.length) sel.innerHTML = lib.BUG_CATS.map(c => '<option value="' + esc(c[0]) + '">' + esc(c[1]) + '</option>').join('');
    $('bbWTitle').value = ''; $('bbWBody').value = ''; $('bbWErr').textContent = '';
    document.querySelectorAll('input[name="bbWVis"]').forEach(r => { r.disabled = false; r.checked = r.value === 'pub'; });
    $('bbWEnv').checked = true; $('bbWNotice').checked = false;
    show('write');
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
  async function submitWrite(btn){
    if(busy) return;
    const err = $('bbWErr');
    const notice = admin() && $('bbWNotice').checked;
    const p = {
      cat: $('bbWCat').value, title: $('bbWTitle').value, body: $('bbWBody').value,
      vis: notice ? 'pub' : ((document.querySelector('input[name="bbWVis"]:checked') || {}).value || 'pub'),
      notice,
    };
    const bad = lib.checkPost(p); if(bad){ err.textContent = bad; return; }
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
    openPost(number);
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
    $('bbWCancel').addEventListener('click', () => show('list'));
    $('bbWSubmit').addEventListener('click', (e) => submitWrite(e.currentTarget));
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
        if(on && !$('bbAKakao').value) $('bbAKakao').value = window._bugReportLink();
      }
      else if(act === 'kakaoX'){ $('bbAKk').classList.remove('on'); $('bbAKakaoBtn').classList.remove('on'); }
    });
  }
  bind();

  /* 계정 기능 시작(app-boot STEPS bugBadge) — 배지 한 번 받기 · realtime 이 오래 끊겼다 붙으면 한 번 다시 받기 */
  function start(){
    ready = true;
    if(!rtHooked){
      rtHooked = true;
      rtOn('notification', (n) => { if(n && n.resync) refreshBadge(); });
    }
    return refreshBadge();
  }
  /* 계정을 놓을 때 — 배지 · 목록 · 연 글을 비우고 진행 중인 받기 답을 버린다. 쓰던 글은 버린다(다른 계정 이름으로 올라가지 않게) */
  function reset(){
    ready = false; busy = false;
    bugApi.reset();
    epoch++; listGen++; postGen++; quotaGen++;
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

/* ↓ app.js 에서 옮긴 🐞 버그 제보 탭(오픈카톡 기본 링크) — 앱 FSD 5번 · docs/APP_FSD_MAP.md.
   ★ 글자 그대로(들여쓰기도) 옮겼다. 위 게시판 IIFE 밖 맨 앞 칸이라 예전처럼 전역 이름(_bugReportConf · window._bugReportLink)이다.
   ★ 이 파일은 app.js 앞에 싣는다(게시판은 app.js 가 만든다). firebase-init.js(type="module")는 classic 스크립트가 다 돈 뒤에 돌아 «firebase-ready» 를 기다리는 구독 시작 때가 예전과 같다.
     버튼 연결도 사람이 누를 수 있기 전에 끝난다. window._bugReportLink 는 위 답변 칸의 [💬 오픈카톡] 이 누를 때 부른다.
   ⚠️ app.js 의 isAdmin · toast · _saveFailMsg 를 누를 때 전역 이름으로 찾는다(TODO(D9-4): 서버 설정 bug.report 로 옮길 때 deps 로). */
/* ═══════════════════ 🐞 버그 제보 탭 — 오픈카톡 기본 링크 ═══════════════════
   게시판 화면은 parts/bug-board-ui.js 다. 여기는 bugReport/current 만 맡는다.
   ★ 예전 공지(notice)는 첫 공지글로 옮겨졌다(bug-board.js migrateNotice). current.link 는
     답변에 붙는 [💬 오픈카톡] 의 기본 주소로 계속 쓴다. 편집은 관리자만(.admin-only + 저장 때 isAdmin 재확인). */
let _bugReportConf = null;   // { notice, link, ts }
window._bugReportLink = ()=> (_bugReportConf && _bugReportConf.link) || '';

(function bindBugReport(){
  const editBtn   = document.getElementById('mhBugEditBtn');
  const form      = document.getElementById('mhBugEditForm');
  const linkIn    = document.getElementById('mhBugLinkInput');
  const saveBtn   = document.getElementById('mhBugSaveBtn');
  const cancelBtn = document.getElementById('mhBugCancelBtn');
  const msgEl     = document.getElementById('mhBugEditMsg');

  const showMsg = (text, isErr)=>{
    if(!msgEl) return;
    msgEl.textContent = text;
    msgEl.style.color = isErr ? 'var(--win-error)' : 'var(--ink-soft)';
    msgEl.style.display = text ? 'block' : 'none';
  };
  const closeForm = ()=>{ if(form) form.style.display = 'none'; };

  if(editBtn){
    editBtn.addEventListener('click', ()=>{
      if(!isAdmin) return;   // .admin-only로 숨겨져 있지만 한 번 더 확인
      if(form && form.style.display !== 'none'){ closeForm(); return; }
      if(linkIn) linkIn.value = window._bugReportLink();
      showMsg('', false);
      if(form) form.style.display = 'block';
      if(linkIn) linkIn.focus();
    });
  }
  if(cancelBtn) cancelBtn.addEventListener('click', closeForm);

  if(saveBtn){
    saveBtn.addEventListener('click', async ()=>{
      if(!isAdmin){ toast('관리자만 수정할 수 있어요'); return; }
      if(!window.firebaseAPI || !firebaseAPI.setBugReport){ toast('네트워크 연결이 필요해요'); return; }
      const link = (linkIn ? linkIn.value : '').trim();
      if(link && !/^https:\/\/open\.kakao\.com\//.test(link)){ showMsg('오픈카톡 링크는 https://open.kakao.com/ 으로 시작해야 해요', true); return; }
      /* ⚠️ 규칙이 notice 를 필수로 본다(웹 관리자도 같은 노드를 쓴다) — 있던 글을 그대로 실어 보낸다. */
      const notice = (_bugReportConf && _bugReportConf.notice) || '버그 제보는 버그제보 게시판에 남겨 주세요.';
      saveBtn.disabled = true; showMsg('저장 중…', false);
      try{
        await firebaseAPI.setBugReport(notice, link);
        toast('오픈카톡 기본 링크를 저장했어요');
        closeForm();
      }catch(e){
        showMsg(_saveFailMsg(e, '저장에 실패했어요 — 인터넷 연결을 확인해 주세요'), true);
      }
      saveBtn.disabled = false;
    });
  }

  const sub = ()=>{
    if(!window.firebaseAPI || !firebaseAPI.subscribeBugReport) return;
    firebaseAPI.subscribeBugReport(conf=>{ _bugReportConf = conf; });
  };
  TwNetReady.whenNetReady(sub);
})();
