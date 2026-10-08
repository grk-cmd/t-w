/* ═══ 🐞 버그제보 게시판 화면 — parts/bug-board-ui.js ═══════════════════════════════
   마이홈 「버그제보」 탭 안에서 목록 → 상세 → 글쓰기 세 화면을 바꿔 끼운다. 데이터는 firebaseAPI.bugBoard(bug-board.js).
   ★ 비공개 글 — 남에게는 한 줄(「🔒 비공개 제보예요」)만, 누를 수 없다. 내용은 서버 규칙이 막고 여기는 모양만 맞춘다.
   ★ 답변 알림은 우편함 tag 'bug' + bugId. 우편함에서 누르면 window._bugBoardOpen(id) 로 이 글이 열린다.
   ★ 탭 배지 = 내 글 중 lastReplyTs > bugSeen[id] 개수. 글을 열면 bugSeen[id] = 지금.
   ⚠️ app.js 뒤에 싣는다 — isAdmin · toast · escHtml · getMyUserId · getDisplayName 을 그대로 쓴다.
   ⚠️ 확인창·메뉴를 따로 띄우지 않는다(전부 탭 안 화면). alert/confirm 금지(audit 검사 4). */
(function(){
  'use strict';
  const $ = (id) => document.getElementById(id);
  const api = () => (window.firebaseAPI && firebaseAPI.bugBoard) || null;
  const C = () => (api() && api().C) || { cats: [], status: {}, page: 20, kakaoRe: /^https:\/\/open\.kakao\.com\// };
  const esc = (s) => escHtml(String(s == null ? '' : s));
  const myUid = () => { try{ return firebaseAPI.authCurrentUid(); }catch(_){ return null; } };
  const admin = () => (typeof isAdmin !== 'undefined') && !!isAdmin;
  const who = () => ({ name: getDisplayName(), code: getMyUserId(), isAdmin: admin() });

  let filter = 'all', cursors = [null], nextCursor = null;
  let unseenIds = new Set();
  const titleCache = new Map();   // 비공개 글 제목(글쓴이 · 관리자만 읽힌다)
  let migrated = false;

  function fmtDate(ts, withTime){
    if(!ts) return '';
    const d = new Date(ts), p = (n) => String(n).padStart(2, '0');
    const day = d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate());
    return withTime ? day + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) : day;
  }
  const catName = (k) => { const c = C().cats.find(x => x[0] === k); return c ? c[1] : '기타'; };
  const chip = (it) => it.notice
    ? '<span class="bb-chip notice">공지</span>'
    : '<span class="bb-chip ' + esc(it.status) + '">' + esc(C().status[it.status] || '접수') + '</span>';
  const canSeePrv = (it) => it.authUid === myUid() || admin();

  function show(view){
    $('bbListView').style.display = view === 'list' ? '' : 'none';
    $('bbDetailView').style.display = view === 'detail' ? '' : 'none';
    $('bbWriteView').style.display = view === 'write' ? '' : 'none';
    const pg = $('mhPageBugreport'); if(pg) pg.scrollTop = 0;
  }

  /* ── 목록 ───────────────────────────────────────────── */
  function rowHtml(it){
    const mine = it.authUid === myUid();
    if(it.vis === 'prv' && !canSeePrv(it)){
      return '<div class="bb-row locked" title="글쓴이와 관리자만 볼 수 있어요">' + chip(it) +
        '<div class="bb-main"><div class="bb-title"><span class="bb-tag">[비공개]</span>🔒 비공개 제보예요</div></div>' +
        '<div class="bb-who">' + esc(it.name) + '<br>' + fmtDate(it.ts) + '</div></div>';
    }
    const tag = it.notice ? '📌' : (it.vis === 'pub' ? '[공개]' : '[비공개]');
    const title = it.vis === 'pub' ? (it.title || '(제목 없음)') : (titleCache.get(it.id) || '…');
    const isNew = mine && unseenIds.has(it.id);
    return '<div class="bb-row' + (it.notice ? ' notice' : '') + '" data-id="' + esc(it.id) + '">' + chip(it) +
      '<div class="bb-main"><div class="bb-title"><span class="bb-tag">' + tag + '</span><span class="bb-tt" data-tid="' + esc(it.id) + '">' + esc(title) + '</span>' +
      (isNew ? '<span class="bb-new">새 답변</span>' : '') + '</div>' +
      (it.notice ? '' : '<div class="bb-sub">' + esc(catName(it.cat)) + ' · 👍' + (it.likeN || 0) + ' · 답변 ' + (it.ansN || 0) + '</div>') +
      '</div><div class="bb-who">' + esc(it.name) + '<br>' + fmtDate(it.ts) + '</div></div>';
  }
  /* 비공개 글 제목은 행마다 따로 읽는다(목록 노드에는 없다 — 누구나 읽는 곳이라). */
  function fillPrvTitles(items){
    items.filter(it => it.vis === 'prv' && canSeePrv(it) && !titleCache.has(it.id)).forEach(it => {
      api().prvTitle(it).then(t => {
        titleCache.set(it.id, t || '(제목 없음)');
        const el = document.querySelector('#bbRows .bb-tt[data-tid="' + CSS.escape(it.id) + '"]');
        if(el) el.textContent = titleCache.get(it.id);
      });
    });
  }
  async function loadList(){
    const rows = $('bbRows'); if(!rows) return;
    document.querySelectorAll('#bbListView .bb-flt').forEach(b => b.classList.toggle('on', b.dataset.f === filter));
    if(!api()){ rows.innerHTML = '<div class="bb-empty">서버에 연결하는 중이에요…</div>'; return; }
    rows.innerHTML = '<div class="bb-empty">불러오는 중…</div>';
    const page = cursors.length;
    try{
      const [res, notes] = await Promise.all([
        api().listPage(filter, cursors[cursors.length - 1]),
        (filter === 'all' && page === 1) ? api().notices() : Promise.resolve([]),
      ]);
      nextCursor = res.next;
      const all = notes.concat(res.items);
      rows.innerHTML = all.length ? all.map(rowHtml).join('')
        : '<div class="bb-empty">' + (filter === 'mine' ? '아직 쓴 제보가 없어요' : filter === 'open' ? '미해결 제보가 없어요' : '아직 제보가 없어요') + '</div>';
      fillPrvTitles(all);
    }catch(e){
      rows.innerHTML = '<div class="bb-empty">목록을 불러오지 못했어요 — 네트워크를 확인해 주세요</div>';
      nextCursor = null;
    }
    $('bbPageNo').textContent = String(page);
    $('bbPrev').disabled = page <= 1;
    $('bbNext').disabled = !nextCursor;
    document.querySelector('#bbListView .bb-pager').style.display = filter === 'mine' ? 'none' : '';
  }

  /* ── 상세 ───────────────────────────────────────────── */
  async function openPost(id){
    const box = $('bbDetailView'); if(!box || !api()) return;
    show('detail');
    box.innerHTML = '<button class="bb-btn bb-back" type="button" data-act="back">◀ 목록</button><div class="bb-empty">불러오는 중…</div>';
    let d = null;
    try{ d = await api().getPost(id); }catch(_){}
    if(!d || !d.item){ box.innerHTML = '<button class="bb-btn bb-back" type="button" data-act="back">◀ 목록</button><div class="bb-empty">글을 찾지 못했어요</div>'; return; }
    const it = d.item, ct = d.content;
    if(it.vis === 'prv' && !canSeePrv(it)){ box.innerHTML = '<button class="bb-btn bb-back" type="button" data-act="back">◀ 목록</button><div class="bb-empty">🔒 비공개 제보예요</div>'; return; }
    if(it.authUid === myUid()){
      api().setSeen(getMyUserId(), id).then(refreshBadge);
      unseenIds.delete(id);
    }
    const title = ct ? ct.title : (it.title || '(제목 없음)');
    if(it.vis === 'prv' && ct) titleCache.set(id, ct.title);
    const h = [];
    h.push('<button class="bb-btn bb-back" type="button" data-act="back">◀ 목록</button>');
    h.push('<div class="bb-dhead">' + chip(it) + '<span class="bb-tag">' + (it.notice ? '📌' : it.vis === 'pub' ? '[공개]' : '[비공개]') + '</span>' + esc(title) + '</div>');
    // 고정 번호(B-MMDD-n · 서버 함수가 붙인다)는 관리자에게만 — 커밋 · PR 에서 제보를 가리키는 번호다.
    h.push('<div class="bb-dmeta">' + ((admin() && it.no) ? '<span class="bb-no">' + esc(it.no) + '</span> · ' : '') +
      esc(it.name) + ' · ' + fmtDate(it.ts, true) + (it.notice ? '' : ' · ' + esc(catName(it.cat))) + '</div>');
    h.push('<div class="bb-body">' + esc(ct ? ct.body : '(내용을 불러오지 못했어요)') + '</div>');
    if(ct && ct.env) h.push('<div class="bb-env">🖥 ' + esc(ct.env) + '</div>');
    if(it.vis === 'pub' && !it.notice){
      h.push('<button class="bb-btn bb-like' + (d.liked ? ' on' : '') + '" type="button" data-act="like"' + (d.liked ? ' disabled' : '') + '>👍 나도 겪었어요 ' + (it.likeN || 0) + '</button>');
    }
    d.answers.forEach(a => {
      h.push('<div class="bb-ans' + (a.vis === 'prv' ? ' prv' : '') + '"><div class="bb-ans-h">운영자 답변<span class="bb-ans-v">' +
        (a.vis === 'prv' ? '🔒 비공개' : '공개') + ' · ' + fmtDate(a.ts, true) + '</span></div><div class="bb-ans-t">' + esc(a.text) + '</div>' +
        ((a.kakao && C().kakaoRe.test(a.kakao)) ? '<div class="bb-kakao"><button type="button" data-kakao="' + esc(a.kakao) + '">💬 오픈카톡으로 이야기하기</button><small>' + esc(a.kakao) + '</small></div>' : '') +
        '</div>');
    });
    if(admin()) h.push(adminForm(it));
    box.innerHTML = h.join('');
    box._post = { id, it, title };
  }
  function adminForm(it){
    const prvOnly = it.vis === 'prv';
    const opts = Object.keys(C().status).map(k => '<option value="' + k + '"' + (k === it.status ? ' selected' : '') + '>' + esc(C().status[k]) + '</option>').join('');
    return '<div class="bb-admin"><div class="bb-ans-h">답변 달기 (관리자)</div>' +
      '<textarea id="bbAText" maxlength="' + (C().ansMax || 1000) + '" placeholder="답변 내용"></textarea>' +
      '<div class="bb-row2">' +
      '<label><input type="radio" name="bbAVis" value="pub"' + (prvOnly ? ' disabled' : ' checked') + '> 공개</label>' +
      '<label><input type="radio" name="bbAVis" value="prv"' + (prvOnly ? ' checked disabled' : '') + '> 비공개</label>' +
      '<select id="bbAStatus">' + opts + '</select>' +
      '<button class="bb-btn" type="button" id="bbAKakaoBtn" data-act="kakao">💬 오픈카톡</button>' +
      '<span class="bb-sp"></span><button class="bb-btn" type="button" data-act="answer">답변 등록</button></div>' +
      (prvOnly ? '<div class="bb-hint">비공개 글이라 답변도 비공개로만 달려요.</div>' : '') +
      '<div class="bb-kk" id="bbAKk">💬 답변 아래에 오픈카톡 버튼이 붙어요 · 링크 <input id="bbAKakao" type="text" maxlength="300"><span class="bb-kk-x" data-act="kakaoX" title="취소">✕</span></div>' +
      '<div class="bb-err" id="bbAErr"></div><div class="bb-hint">등록하면 글쓴이 우편함에 알림이 가요.</div></div>';
  }
  async function submitAnswer(btn){
    const box = $('bbDetailView'), post = box._post; if(!post || !admin()) return;
    const err = $('bbAErr');
    const kkOn = $('bbAKk').classList.contains('on');
    const kakao = kkOn ? $('bbAKakao').value.trim() : '';
    if(kkOn && !C().kakaoRe.test(kakao)){ err.textContent = '오픈카톡 링크는 https://open.kakao.com/ 으로 시작해야 해요'; return; }
    const vis = (document.querySelector('input[name="bbAVis"]:checked') || {}).value || 'prv';
    btn.disabled = true; err.textContent = '';
    let r = null;
    try{ r = await api().addAnswer(post.id, { text: $('bbAText').value, vis, status: $('bbAStatus').value, kakao }); }catch(e){ r = { ok: false, reason: '등록하지 못했어요 — 권한이나 네트워크를 확인해 주세요' }; }
    btn.disabled = false;
    if(!r || !r.ok){ err.textContent = (r && r.reason) || '등록하지 못했어요'; return; }
    // 글쓴이 우편함 알림 — 실패해도 답변은 남아 있다(조용히 넘기지 않고 알린다)
    try{
      await firebaseAPI.sendInboxMessage(post.it.code, 'bug', '접수된 제보에 답변이 달렸어요',
        post.title + (r.kakao ? '\n💬 오픈카톡 연결이 함께 왔어요' : ''), { bugId: post.id });
    }catch(_){ toast('답변은 등록됐지만 알림을 보내지 못했어요'); }
    toast('답변을 등록했어요');
    openPost(post.id);
  }
  async function likePost(btn){
    const post = $('bbDetailView')._post; if(!post) return;
    btn.disabled = true;
    const r = await api().like(post.id).catch(() => null);
    if(r && r.ok){ btn.classList.add('on'); btn.textContent = '👍 나도 겪었어요 ' + r.n; }
    else { btn.disabled = false; toast('누르지 못했어요 — 이미 눌렀거나 네트워크 문제예요'); }
  }

  /* ── 글쓰기 ─────────────────────────────────────────── */
  function openWrite(){
    if(!api() || !myUid()){ toast('서버에 연결된 뒤에 쓸 수 있어요'); return; }
    const sel = $('bbWCat');
    if(!sel.options.length) sel.innerHTML = C().cats.map(c => '<option value="' + c[0] + '">' + esc(c[1]) + '</option>').join('');
    $('bbWTitle').value = ''; $('bbWBody').value = ''; $('bbWErr').textContent = '';
    document.querySelectorAll('input[name="bbWVis"]').forEach(r => { r.disabled = false; r.checked = r.value === 'pub'; });
    $('bbWEnv').checked = true; $('bbWNotice').checked = false;
    show('write');
    $('bbWTitle').focus();
    showQuota();
  }
  /* 오늘 남은 제보 수 — 서버 함수가 센 값을 읽기만 한다. 다 썼으면 등록 단추를 끈다. 관리자는 제한 없음. */
  async function showQuota(){
    const btn = $('bbWSubmit');
    btn.disabled = false; btn.textContent = '등록';
    if(admin()) return;
    const max = C().dailyMax || 5;
    const n = await api().todayCount(getMyUserId());
    if($('bbWriteView').style.display === 'none') return;
    if(n >= max){
      btn.disabled = true;
      $('bbWErr').textContent = '오늘은 제보를 ' + max + '건 모두 썼어요 — 내일 다시 써 주세요';
    }else btn.textContent = '등록 (오늘 ' + (max - n) + '건 남음)';
  }
  /* 등록 뒤 서버 함수가 한도를 넘은 글을 지웠는지 — 잠시 뒤 한 번 본다. 지워졌으면 알리고 목록으로. */
  function checkKept(id){
    setTimeout(async () => {
      let it = null;
      try{ it = await api().getItem(id); }catch(_){ return; }
      if(it) return;
      toast('하루 제보 수를 넘어 이 제보는 접수되지 않았어요');
      const box = $('bbDetailView');
      if(box && box._post && box._post.id === id && box.style.display !== 'none'){ show('list'); loadList(); }
    }, 6000);
  }
  async function envString(){
    let ver = '';
    try{ if(window.companion && companion.getAppVersion) ver = await companion.getAppVersion(); }catch(_){}
    const ua = navigator.userAgent || '';
    const os = /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '기타 OS';
    return (ver ? 'v' + ver + ' · ' : '') + os;
  }
  async function submitWrite(btn){
    const err = $('bbWErr');
    const notice = admin() && $('bbWNotice').checked;
    const p = {
      cat: $('bbWCat').value, title: $('bbWTitle').value, body: $('bbWBody').value,
      vis: notice ? 'pub' : ((document.querySelector('input[name="bbWVis"]:checked') || {}).value || 'pub'),
      notice,
    };
    const bad = api().checkPost(p); if(bad){ err.textContent = bad; return; }
    if($('bbWEnv').checked) p.env = await envString();
    btn.disabled = true; err.textContent = '';
    let r = null;
    try{ r = await api().createPost(p, who()); }catch(e){ r = { ok: false, reason: '등록하지 못했어요 — 네트워크를 확인해 주세요' }; }
    btn.disabled = false;
    if(!r || !r.ok){ err.textContent = (r && r.reason) || '등록하지 못했어요'; return; }
    toast(notice ? '📌 공지를 등록했어요' : '🐞 제보를 등록했어요');
    cursors = [null];
    openPost(r.id);
    if(!admin()) checkKept(r.id);
  }

  /* ── 배지 ───────────────────────────────────────────── */
  async function refreshBadge(){
    if(!api() || !myUid()) return;
    let n = 0;
    try{ const r = await api().unseen(getMyUserId()); n = r.n; unseenIds = new Set(r.ids); }catch(_){ return; }
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

  /* ── 탭 들어올 때 · 우편함에서 열 때 ───────────────────── */
  async function enter(){
    show('list');
    if(admin() && !migrated && api()){
      migrated = true;
      try{ const r = await api().migrateNotice(who()); if(r && r.ok && !r.skipped) toast('예전 버그제보 공지를 첫 공지글로 옮겼어요'); }catch(_){}
    }
    await refreshBadge();
    loadList();
  }
  window._bugBoardRefreshBadge = refreshBadge;
  window._bugBoardOpen = function(id){
    const tab = document.querySelector('#myHomeTabs .mh-tab[data-tab="bugreport"]');
    if(tab && !tab.classList.contains('on')) tab.click();   // 탭 바인딩이 enter() 를 부른다
    openPost(id);
  };

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
      const row = e.target.closest('.bb-row[data-id]'); if(row) openPost(row.dataset.id);
    });
    $('bbDetailView').addEventListener('click', (e) => {
      const k = e.target.closest('[data-kakao]');
      if(k){
        const url = k.dataset.kakao;
        if(C().kakaoRe.test(url) && window.companion && companion.openBrowser) companion.openBrowser(url);
        return;
      }
      const el = e.target.closest('[data-act]'); if(!el) return;
      const act = el.dataset.act;
      if(act === 'back'){ show('list'); loadList(); }
      else if(act === 'like') likePost(el);
      else if(act === 'answer') submitAnswer(el);
      else if(act === 'kakao'){
        const kk = $('bbAKk'), on = !kk.classList.contains('on');
        kk.classList.toggle('on', on); el.classList.toggle('on', on);
        if(on && !$('bbAKakao').value) $('bbAKakao').value = (window._bugReportLink && window._bugReportLink()) || '';
      }
      else if(act === 'kakaoX'){ $('bbAKk').classList.remove('on'); $('bbAKakaoBtn').classList.remove('on'); }
    });
    /* 부팅 뒤 배지 한 번 — 로그인(uid)이 늦게 붙으므로 몇 번만 다시 본다. 붙으면 끝(반복 폴링 아님). */
    let tries = 0;
    const boot = () => { if(api() && myUid()) refreshBadge(); else if(++tries < 8) setTimeout(boot, 5000); };
    setTimeout(boot, 6000);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
