/* ═══ 📚 마이홈 북마크 책장 — parts/bookmark.js (2026-09-23 · 개정 61 · 시안 «북마크 1~8» 확정) ═══════════
   마이홈 오른쪽 미니 바탕화면의 📚 «북마크» 폴더를 누르면, 마이홈 창 **오른쪽 바깥**에 원목 서재 서랍이 열린다.
   책등 50권 · 두께 2 × 높이 2 네 모양 · 색 자유 · 그림 선택 · 끌어서 순서 바꾸기(흐름식) · 누르면 기본 브라우저.

   ★ 붙는 방식 — `MYHOME_DESKTOP.addFolder` 하나뿐이다. myhome-desktop.js 에는 북마크라는 말이 한 번도 안 나온다
     (거기에 늘어난 것은 계약의 `host:'side'` 한 항목뿐). 이 파일을 지우고 HTML 의 <script> 한 줄을 빼면 끝난다.
   ★ 방문자 — 폴더 클릭은 myhome-desktop 쪽에서 이미 막고(advVisiting), 방문이 시작되면 등록된 창을 일괄로 닫는다.
     여기서는 onVisit 에서 서랍을 닫고 편집 창을 정리하기만 한다.
   ★ 저장 — **계정 연동**(사용자 확정). bookmarks/{uid} = { order:"id,id,…", items:{…}, ts }.
     · users/{uid} 아래가 아니다 — 그 자리는 `.read: true` 라 방문자 읽기를 규칙으로 막을 수 없다.
     · 선반 번호는 저장하지 않는다. 순서 하나만 저장하고 선반은 서랍 너비로 매번 계산한다(시안 4-3).
     · 같은 계정을 두 기기에서 고치면 **마지막에 저장한 쪽이 이긴다.** 책장은 슬롯처럼 충돌 판정을 둘 값이 아니다.
   ★ 책등 그림 — Storage `bookmarks/{uid}/{bid}_{시각}.webp`(세로 400px 로 줄여 WebP · 200KB 이하).
     로컬 IndexedDB 안을 버린 이유는 연동으로 정해졌기 때문이다(집 PC 에 꽂은 책이 회사 PC 에도 있어야 한다).
   ⚠️ 색 팔레트는 꾸미기 창 것을 **그대로 재사용**한다(app.js `buildFreeColorPicker` · `.wd-color-palette`).
     새로 그리지 말 것 — 그 클래스가 실행 화면 클릭 통과 화이트리스트(UI_HIT_SEL)에 이미 들어 있다.
   ⚠️ 링크는 http/https 만 연다. 여는 길은 `companion.openBrowser`(main.js · shell.openExternal) 한 곳이다 —
     window.open 으로 열면 실행 화면(투명 오버레이) 안에 브라우저 창이 생겨 캐릭터를 덮는다. */
(function(){
  'use strict';

  const BM_MAX = 50;                 // 책 상한
  const BM_TITLE_MAX = 14;           // 세로 제목
  const BM_URL_MAX = 300;
  const BM_IMG_PX = 400;             // 책등 그림 세로
  const BM_IMG_MAX_BYTES = 200 * 1024;
  const BM_KEY = 'tw.bookmarks';     // 로컬 사본(서버가 기준 · 오프라인에서도 보이게)
  const BM_DRAG_MIN = 4;             // 이보다 적게 끌면 클릭(링크 열기)
  const BM_W = { thin:22, thick:36 };
  const BM_H = { short:116, long:158 };
  const BM_SHELF_H = 170;            // 책 자리(158) + 선반(12)
  const BM_DEFAULT_COLOR = '#8f5a4a';
  const BM_DEFAULT_TCOLOR = '#ffffff';   // 제목 글자색(요청 · 책등 색에 따라 흰 글씨가 안 보일 수 있다)

  let bmData = { order:[], items:{}, ts:0 };
  /* 👀 구경 모드 — 남의 마이홈에 들어가 있는 동안에는 **그 사람의 공개 책장**을 그린다.
     ★ 공개 책은 서버에서도 따로 산다(bookmarksPub/{uid}) — 한 노드에 섞어 두면 규칙이 읽기를 못 갈라
       방문자가 비공개 책까지 받아 간다. 화면에서 가리는 것은 방어가 아니다.
     ★ 구경 모드에서는 [+ 추가] · 끌어서 순서 · 우클릭이 전부 빠지고, 공개 표시(노란 띠)도 안 그린다
       (전부 공개 책이라 뜻이 없다 · 사용자 요청). */
  let bmVisit = null;          // { uid, data } — 구경 중일 때만
  function bmView(){ return bmVisit ? bmVisit.data : bmData; }
  function bmReadOnly(){ return !!bmVisit; }
  let bmBody = null, bmShelf = null, bmAddBtn = null, bmCount = null;
  let bmOpen = false, bmLoaded = false;

  /* ── 저장소 ───────────────────────────────────────────────────────────── */
  function uid(){ try{ return (typeof getMyUserId === 'function') ? getMyUserId() : null; }catch(_){ return null; } }
  function api(){ return window.firebaseAPI || null; }
  function toastOf(t){ try{ if(typeof toast === 'function') toast(t); }catch(_){} }
  function bmNewId(){ return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function bmUrlOk(u){ return typeof u === 'string' && u.length <= BM_URL_MAX && /^https?:\/\//i.test(u); }
  /* 주소는 **선택**이다(요청). 주소 없는 책은 그냥 장식 — 눌러도 아무 일이 없다. */
  function bmUrlSlot(u){ return bmUrlOk(u) ? u : ''; }
  function bmImgOk(u){ return typeof u === 'string' && u.length <= 500 && u.indexOf('https://firebasestorage.googleapis.com/') === 0; }
  /* 서버·로컬 어느 쪽에서 온 것이든 한 곳에서 씻는다 — 남은 판·손댄 값이 그대로 화면에 오르지 않게. */
  function bmClean(raw){
    const out = { order:[], items:{}, ts:(raw && typeof raw.ts === 'number') ? raw.ts : 0 };
    const items = (raw && raw.items && typeof raw.items === 'object') ? raw.items : {};
    for(const id of Object.keys(items)){
      const it = items[id];
      if(!it || typeof it !== 'object') continue;
      out.items[id] = {
        url: bmUrlSlot(it.url),
        title: (typeof it.title === 'string') ? it.title.slice(0, BM_TITLE_MAX) : '',
        w: (it.w === 'thick') ? 'thick' : 'thin',
        h: (it.h === 'long') ? 'long' : 'short',
        color: (typeof it.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(it.color)) ? it.color : BM_DEFAULT_COLOR,
        tcolor: (typeof it.tcolor === 'string' && /^#[0-9a-fA-F]{6}$/.test(it.tcolor)) ? it.tcolor : BM_DEFAULT_TCOLOR,
        hideTitle: !!it.hideTitle,      // 그림을 넣어도 제목을 겹쳐 보일지 말지는 **고르는 것**이다(요청)
        pub: !!it.pub,                  // 👀 마이홈 방문자에게 보일 책(기본 꺼짐 — 있던 책은 전부 비공개로 시작)
        at: (typeof it.at === 'number') ? it.at : 0,
      };
      if(bmImgOk(it.img)) out.items[id].img = it.img;
    }
    const seen = new Set();
    const order = (typeof raw?.order === 'string') ? raw.order.split(',') : (Array.isArray(raw?.order) ? raw.order : []);
    order.forEach(id=>{ if(out.items[id] && !seen.has(id)){ seen.add(id); out.order.push(id); } });
    /* 순서에서 빠진 책은 버리지 않고 뒤에 붙인다 — 저장이 반쯤 끝난 판에서도 책이 사라지지 않게. */
    Object.keys(out.items).forEach(id=>{ if(!seen.has(id)) out.order.push(id); });
    out.order = out.order.slice(0, BM_MAX);
    return out;
  }
  function bmLoadLocal(){
    try{ bmData = bmClean(JSON.parse(localStorage.getItem(BM_KEY) || '{}')); }catch(_){ bmData = { order:[], items:{}, ts:0 }; }
  }
  function bmSaveLocal(){
    try{ localStorage.setItem(BM_KEY, JSON.stringify({ order:bmData.order.join(','), items:bmData.items, ts:bmData.ts })); }
    catch(_){ /* 용량이 차도 서버 사본이 기준이라 다음 부팅에 돌아온다 */ }
  }
  async function bmPull(){
    const u = uid(), a = api();
    if(!u || !a || !a.getBookmarks) return false;
    const r = await a.getBookmarks(u).catch(()=>null);
    if(!r || !r.ok) return false;
    if(r.data){ bmData = bmClean(r.data); bmSaveLocal(); }
    else if(bmData.order.length){ await bmPush(); }   // 서버가 비었고 이 기기에만 있으면 올린다
    bmLoaded = true;
    return true;
  }
  async function bmPush(){
    const u = uid(), a = api();
    bmData.ts = Date.now();
    bmSaveLocal(); bmRender();
    if(!u || !a || !a.saveBookmarks){ return false; }
    /* 빈 주소 칸은 서버로 보내지 않는다 — 규칙은 «있으면 http/https» 라서 빈 문자열은 거절된다(주소는 선택). */
    const strip = (k)=>{ const it = Object.assign({}, bmData.items[k]); if(!it.url) delete it.url; if(!it.img) delete it.img; return it; };
    const items = {};
    Object.keys(bmData.items).forEach(k=>{ items[k] = strip(k); });
    const r = await a.saveBookmarks(u, { order:bmData.order.join(','), items, ts:bmData.ts }).catch(()=>null);
    if(!r || !r.ok){ toastOf('책장을 저장하지 못했어요 — 이 기기에만 남아 있어요'); return false; }
    /* 👀 공개 사본 — 공개로 표시한 책만 따로 올린다(방문자는 이 노드만 읽는다). 하나도 없으면 노드를 지운다. */
    if(a.savePublicBookmarks){
      const pubOrder = bmData.order.filter(k=>bmData.items[k] && bmData.items[k].pub);
      const pubItems = {}; pubOrder.forEach(k=>{ pubItems[k] = strip(k); });
      await a.savePublicBookmarks(u, pubOrder.length ? { order:pubOrder.join(','), items:pubItems, ts:bmData.ts } : null).catch(()=>{});
    }
    return true;
  }

  /* ── 책장 그리기 ──────────────────────────────────────────────────────── */
  function bmStyle(){
    if(document.getElementById('bmStyle')) return;
    const st = document.createElement('style'); st.id = 'bmStyle';
    st.textContent = [
      /* ① 원목 서재 — 시안 6 의 다섯 안 중 채택본. 테마를 따라가는 책장(보드 7)은 보류다. */
      /* 창 껍데기 — 마이홈 창과 같은 테마를 입힌다(시안 4-2: 제목줄은 마이홈 창과 같은 그라데이션).
         ⚠️ myhome-desktop.js 의 .adv-titlebar 기본값은 미스테리au 때의 **붉은색**이다. 그 파일은 안 건드리고
           여기서 #bmWin 에만 덮는다 — 책장을 걷어내면 이 규칙도 파일과 함께 사라진다. */
      '#bmWin{background:var(--win-face);border-color:var(--win-hi) var(--win-lo-2) var(--win-lo-2) var(--win-hi);',
      '  border-radius:var(--win-radius-el);box-shadow:var(--win-drop-el, 3px 3px 0 rgba(0,0,0,.35));}',
      '#bmWin .adv-titlebar{background:linear-gradient(90deg,var(--win-title-a),var(--win-title-b));color:var(--win-title-ink,#fff);padding:5px 7px;font-size:12px;}',
      '#bmWin .adv-titlebar .x{background:var(--win-face);color:var(--ink);border-color:var(--win-hi) var(--win-lo-2) var(--win-lo-2) var(--win-hi);border-radius:var(--win-radius-el);}',
      '#bmWin .mhd-win-body{padding:0;background:linear-gradient(180deg,#3f2616,#5b3a22);}',
      '#bmShelf{position:relative;padding:0 10px;overflow-y:auto;height:100%;box-sizing:border-box;',
      '  background:repeating-linear-gradient(180deg, rgba(0,0,0,0) 0, rgba(0,0,0,0) ' + (BM_SHELF_H - 12) + 'px,',
      '    #8b5a2b ' + (BM_SHELF_H - 12) + 'px, #7a4d24 ' + (BM_SHELF_H - 4) + 'px, #2e1c0f ' + (BM_SHELF_H - 4) + 'px, #2e1c0f ' + BM_SHELF_H + 'px);}',
      '#bmRows{display:flex;flex-wrap:wrap;align-content:flex-start;gap:0;}',
      /* 책 사이는 좁게 붙인다(요청) — 칸마다 좌우 1px 씩, 실제 틈은 2px. 책장처럼 빽빽하게 꽂힌 모양이 된다. */
      '.bm-cell{height:' + (BM_SHELF_H - 12) + 'px;display:flex;align-items:flex-end;padding:0 1px;box-sizing:content-box;}',
      /* ⚠️ box-sizing:border-box — 테두리 1px 두 줄 때문에 «길게»(158) 가 선반 칸(158)을 2px 넘어 삐져나왔다(제보). */
      '.bm-book{position:relative;box-sizing:border-box;border:1px solid #2e1c0f;border-radius:2px 2px 0 0;cursor:pointer;overflow:hidden;',
      '  box-shadow:1px 2px 3px rgba(0,0,0,.45);transition:transform .14s ease-out;transform-origin:bottom center;}',
      /* ⚠️ 세로쓰기(vertical-rl)에서는 flex 축이 돌아간다 — align-items 가 **가로** 정렬이다.
         center 로 두어야 글자가 책등 한가운데 온다(제보: 오른쪽으로 쏠림). justify-content 는 위에서부터. */
      '.bm-book .bm-t{position:absolute;inset:6px 0 8px 0;writing-mode:vertical-rl;text-orientation:upright;',
      '  font:bold 11px Tahoma,"Malgun Gothic",sans-serif;color:#fff;text-shadow:0 1px 0 rgba(0,0,0,.6);',
      '  display:flex;align-items:center;justify-content:flex-start;letter-spacing:1px;overflow:hidden;}',
      '.bm-book .bm-i{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}',
      '.bm-book .bm-pub{position:absolute;left:0;right:0;bottom:0;height:5px;background:#ffd34d;}',
      /* 호버 — 기울이지 않고 **위로만** 뽑아 든다(요청). 책을 반쯤 빼는 모양. */
      '#bmShelf:not(.bm-dragging) .bm-book:hover{transform:translateY(-14px);}',
      '.bm-book.bm-ghosting{opacity:.35;border-style:dashed;}',
      '.bm-bar{width:4px;height:' + (BM_SHELF_H - 20) + 'px;background:#ffd34d;box-shadow:0 0 4px rgba(255,211,77,.8);align-self:flex-end;flex:none;}',
      '.bm-drag{position:fixed;z-index:9800;pointer-events:none;opacity:.9;transform:rotate(3deg);}',
      '#bmTop{display:flex;align-items:center;gap:6px;padding:6px 10px;background:rgba(0,0,0,.25);color:#f0e0cf;font-size:10.5px;flex:none;}',
      '#bmAdd{font-family:inherit;font-size:10.5px;font-weight:bold;padding:2px 8px;cursor:pointer;color:var(--ink);background:var(--win-face);',
      '  border:2px solid;border-color:var(--win-hi) var(--win-lo-2) var(--win-lo-2) var(--win-hi);border-radius:var(--win-radius-el);}',
      '#bmAdd:disabled{color:var(--win-lo);cursor:default;}',
      '#bmEmpty{color:#e7d3bf;font-size:11px;line-height:1.8;padding:18px 12px;text-align:center;}',
    ].join('\n');
    document.head.appendChild(st);
  }
  function bmBook(id){
    const it = bmView().items[id]; if(!it) return null;
    const cell = document.createElement('div'); cell.className = 'bm-cell'; cell.dataset.bid = id;
    const b = document.createElement('div'); b.className = 'bm-book';
    b.style.width = BM_W[it.w] + 'px'; b.style.height = BM_H[it.h] + 'px'; b.style.background = it.color;
    /* 그림과 제목은 **따로 논다**(요청) — 그림 위에 제목을 겹쳐 쓸 수 있고, [제목 숨기기]로 끌 수도 있다. */
    if(it.img){ const im = document.createElement('img'); im.className = 'bm-i'; im.src = it.img; im.alt = ''; im.draggable = false; b.appendChild(im); }
    if(it.title && !it.hideTitle){
      const t = document.createElement('div'); t.className = 'bm-t'; t.textContent = it.title;
      t.style.color = it.tcolor || BM_DEFAULT_TCOLOR;
      b.appendChild(t);
    }
    /* 👀 공개한 책은 아래에 노란 띠. 구경하는 사람에게는 안 그린다(요청). */
    if(it.pub && !bmReadOnly()){
      const bar = document.createElement('span');
      bar.className = 'bm-pub';
      b.appendChild(bar);
    }
    /* 툴팁 없음(시안 9) — title 속성도 넣지 않는다. 도메인도 제목도 안 띄운다. */
    cell.appendChild(b);
    return cell;
  }
  function bmRender(){
    if(!bmShelf) return;
    const rows = bmShelf.querySelector('#bmRows'); if(!rows) return;
    const view = bmView();
    rows.textContent = '';
    if(!view.order.length){
      const e = document.createElement('div'); e.id = 'bmEmpty';
      e.textContent = bmReadOnly() ? '공개된 책이 없어요.' : '책장이 비어 있어요.\n[+ 추가] 로 링크를 한 권씩 꽂아 보세요.';
      e.style.whiteSpace = 'pre-line';
      rows.appendChild(e);
    }else{
      view.order.forEach(id=>{ const c = bmBook(id); if(c) rows.appendChild(c); });
    }
    if(bmAddBtn) bmAddBtn.style.display = bmReadOnly() ? 'none' : '';
    if(bmAddBtn) bmAddBtn.disabled = view.order.length >= BM_MAX;
    if(bmCount){
      if(bmReadOnly()) bmCount.textContent = '👀 남의 책장 구경 중 · 공개된 책 ' + view.order.length;
      else{
        const pub = bmData.order.filter(id=>bmData.items[id] && bmData.items[id].pub).length;
        bmCount.textContent = '책 ' + bmData.order.length + ' / ' + BM_MAX + (pub ? '   👀 공개 ' + pub : '');
      }
    }
  }

  /* ── 링크 열기 ────────────────────────────────────────────────────────── */
  function bmOpenLink(id){
    const it = bmView().items[id]; if(!it) return;
    if(!bmUrlOk(it.url)){ toastOf('이 책에는 주소가 없어요 — 우클릭해서 넣을 수 있어요'); return; }
    try{
      if(window.companion && companion.openBrowser) companion.openBrowser(it.url);
      else toastOf('이 링크는 앱에서만 열 수 있어요');
    }catch(_){ toastOf('링크를 열지 못했어요'); }
  }

  /* ── 끌어서 순서 바꾸기(흐름식) ────────────────────────────────────────
     자유 배치는 하지 않는다. 바꿀 수 있는 것은 «몇 번째인가» 뿐이고, 선반은 너비로 계산된다. */
  let drag = null;
  function bmIndexAt(x, y){
    const cells = Array.from(bmShelf.querySelectorAll('.bm-cell'));
    let best = bmData.order.length, bestD = Infinity;
    cells.forEach((c, i)=>{
      const r = c.getBoundingClientRect();
      const cy = r.top + r.height / 2;
      const rowPenalty = Math.abs(cy - y) * 4;            // 같은 선반을 먼저 본다
      [[r.left, i], [r.right, i + 1]].forEach(([px, idx])=>{
        const d = Math.abs(px - x) + rowPenalty;
        if(d < bestD){ bestD = d; best = idx; }
      });
    });
    return best;
  }
  function bmShowBar(idx){
    const old = bmShelf.querySelector('.bm-bar'); if(old) old.remove();
    const rows = bmShelf.querySelector('#bmRows');
    const bar = document.createElement('div'); bar.className = 'bm-bar';
    const cells = rows.querySelectorAll('.bm-cell');
    if(idx >= cells.length) rows.appendChild(bar);
    else rows.insertBefore(bar, cells[idx]);
  }
  function bmDragStart(e, id, cell){
    drag = { id, cell, idx: bmData.order.indexOf(id), to: bmData.order.indexOf(id), ghost:null, raf:0 };
    bmShelf.classList.add('bm-dragging');
    cell.querySelector('.bm-book').classList.add('bm-ghosting');
    const src = cell.querySelector('.bm-book');
    const g = src.cloneNode(true); g.className = 'bm-book bm-drag';
    g.style.width = src.style.width; g.style.height = src.style.height; g.style.background = src.style.background;
    g.style.boxSizing = 'border-box';
    document.body.appendChild(g); drag.ghost = g;
    bmDragMove(e);
  }
  function bmDragMove(e){
    if(!drag) return;
    if(drag.ghost){ drag.ghost.style.left = (e.clientX - 10) + 'px'; drag.ghost.style.top = (e.clientY - 40) + 'px'; }
    drag.to = bmIndexAt(e.clientX, e.clientY);
    bmShowBar(drag.to);
    /* 가장자리에 대면 자동 스크롤 */
    const r = bmShelf.getBoundingClientRect();
    let dy = 0;
    if(e.clientY < r.top + 28) dy = -8;
    else if(e.clientY > r.bottom - 28) dy = 8;
    if(dy) bmShelf.scrollTop += dy;
  }
  function bmDragEnd(){
    if(!drag) return;
    const { id, to } = drag;
    if(drag.ghost) drag.ghost.remove();
    bmShelf.classList.remove('bm-dragging');
    const bar = bmShelf.querySelector('.bm-bar'); if(bar) bar.remove();
    drag = null;
    const from = bmData.order.indexOf(id);
    if(from < 0){ bmRender(); return; }
    let idx = to; if(idx > from) idx--;
    if(idx !== from){
      bmData.order.splice(from, 1);
      bmData.order.splice(Math.max(0, Math.min(bmData.order.length, idx)), 0, id);
      bmPush();
    }else bmRender();
  }
  function bmBindShelf(){
    bmShelf.addEventListener('pointerdown', e=>{
      if(e.button !== 0) return;
      if(bmReadOnly()){   // 👀 구경 모드 — 끌어서 순서 바꾸기는 없고, 누르면 링크만 열린다
        const c = e.target.closest && e.target.closest('.bm-cell');
        if(c){ e.preventDefault(); bmOpenLink(c.dataset.bid); }
        return;
      }
      const cell = e.target.closest && e.target.closest('.bm-cell'); if(!cell) return;
      const id = cell.dataset.bid;
      const sx = e.clientX, sy = e.clientY;
      let moved = false;
      const move = ev=>{
        if(!moved && (Math.abs(ev.clientX - sx) > BM_DRAG_MIN || Math.abs(ev.clientY - sy) > BM_DRAG_MIN)){
          moved = true; bmDragStart(ev, id, cell);
        }
        else if(moved) bmDragMove(ev);
      };
      const up = ()=>{
        window.removeEventListener('pointermove', move, true);
        window.removeEventListener('pointerup', up, true);
        if(moved) bmDragEnd();
        else bmOpenLink(id);      // 4px 아래로 떼면 클릭 = 링크 열기
      };
      window.addEventListener('pointermove', move, true);
      window.addEventListener('pointerup', up, true);
      e.preventDefault();
    });
    /* 우클릭 = 그 책 고치기·빼기. 목록 화면은 두지 않는다(시안에 없다). */
    bmShelf.addEventListener('contextmenu', e=>{
      const cell = e.target.closest && e.target.closest('.bm-cell'); if(!cell) return;
      e.preventDefault(); e.stopPropagation();
      if(bmReadOnly()) return;        // 👀 남의 책장은 고칠 수 없다
      bmBookMenu(e, cell.dataset.bid);
    });
  }

  /* 책 우클릭 — 공개 전환 · 고치기 · 빼기 한 자리(시안). */
  function bmBookMenu(ev, id){
    const it = bmData.items[id]; if(!it) return;
    const old = document.getElementById('bmBookMenu'); if(old) old.remove();
    const bd = document.createElement('div'); bd.id = 'bmBookMenu';
    /* ⚠️ [제보] body 에 직접 붙는 조각은 **클릭 통과 화이트리스트(app.js UI_HIT_SEL)** 에 걸리는 클래스를 달아야 한다.
       안 그러면 실행 화면(투명 오버레이)에서 이 자리가 «빈 곳» 으로 판정돼 클릭이 뒤 프로그램으로 새 나간다.
       책 꽂기 창과 같은 .app-popup-ov 를 쓴다(서랍 자체는 #myHomeWin 안이라 이미 걸린다). */
    bd.className = 'app-popup-ov';
    bd.style.cssText = 'position:fixed;inset:0;z-index:9760;background:transparent;';
    const m = document.createElement('div');
    m.style.cssText = 'position:fixed;min-width:132px;background:var(--win-face);border:2px solid;'
      + 'border-color:var(--win-hi) var(--win-lo-2) var(--win-lo-2) var(--win-hi);border-radius:var(--win-radius-el);'
      + 'box-shadow:2px 2px 4px rgba(0,0,0,.35);padding:3px 0;font:11px Tahoma,"Malgun Gothic",sans-serif;color:var(--ink);';
    m.style.left = Math.min(ev.clientX, Math.max(0, window.innerWidth - 150)) + 'px';
    m.style.top  = Math.min(ev.clientY, Math.max(0, window.innerHeight - 110)) + 'px';
    const close = ()=>bd.remove();
    const mk = (label, fn)=>{
      const b = document.createElement('div'); b.textContent = label;
      b.style.cssText = 'padding:4px 10px;cursor:pointer;';
      b.onmouseenter = ()=>{ b.style.background = 'var(--win-select)'; b.style.color = '#fff'; };
      b.onmouseleave = ()=>{ b.style.background = ''; b.style.color = 'var(--ink)'; };
      b.onclick = e=>{ e.stopPropagation(); close(); fn(); };
      m.appendChild(b); return b;
    };
    mk(it.pub ? '🔒 공개 끄기' : '👀 방문자에게 공개', ()=>{ it.pub = !it.pub; bmPush(); });
    mk('책등 수정', ()=>bmEditor(id));
    mk('빼기', ()=>{
      const img = it.img;
      delete bmData.items[id];
      bmData.order = bmData.order.filter(x=>x !== id);
      bmPush();
      const a = api(); if(img && a && a.deleteStorageUrl) a.deleteStorageUrl(img).catch(()=>{});
    });
    /* ⚠️ [제보] 덮개에 그냥 close 를 걸면 **메뉴 안을 누를 때도** 먼저 닫혀 버려서 줄이 눌리지 않는다.
       바깥을 누른 경우만 닫는다(줄의 click 은 그 뒤에 온다). */
    bd.addEventListener('pointerdown', e=>{ if(!m.contains(e.target)) close(); });
    bd.addEventListener('contextmenu', e=>{ e.preventDefault(); close(); });
    bd.appendChild(m); document.body.appendChild(bd);
  }

  /* ── 책 추가·수정 창 ──────────────────────────────────────────────────── */
  let bmEditOv = null;
  function bmEditorClose(){ if(bmEditOv){ try{ bmEditOv.remove(); }catch(_){} bmEditOv = null; } }   // 팔레트는 창과 함께 사라진다
  function bmField(label, el){
    const row = document.createElement('div'); row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:7px;';
    const l = document.createElement('span'); l.style.cssText = 'font-size:10.5px;color:var(--ink-soft);width:44px;flex:none;'; l.textContent = label;
    row.appendChild(l); row.appendChild(el); return row;
  }
  function bmSeg(values, cur, onPick){
    const box = document.createElement('div'); box.style.cssText = 'display:flex;gap:4px;';
    const btns = [];
    values.forEach(([v, label])=>{
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
      b.style.cssText = 'font-family:inherit;font-size:10.5px;padding:3px 9px;cursor:pointer;color:var(--ink);background:var(--win-face);border:2px solid;';
      const paint = ()=>{ b.style.borderColor = (b.dataset.on === '1')
        ? 'var(--win-lo-2) var(--win-hi) var(--win-hi) var(--win-lo-2)' : 'var(--win-hi) var(--win-lo-2) var(--win-lo-2) var(--win-hi)';
        b.style.background = (b.dataset.on === '1') ? '#bfbbb2' : 'var(--win-face)'; };
      b.dataset.on = (v === cur) ? '1' : '0'; paint();
      b.onclick = ()=>{ btns.forEach(x=>{ x.dataset.on = '0'; x._paint(); }); b.dataset.on = '1'; paint(); onPick(v); };
      b._paint = paint; btns.push(b); box.appendChild(b);
    });
    return box;
  }
  /* 파일 → 세로 400px WebP(200KB 이하). 자리비움 그림과 같은 방식·같은 이유. */
  function bmPrepImg(file){
    return new Promise(res=>{
      if(!file || !/^image\//.test(file.type || '')) return res({ err:'bad' });
      const fr = new FileReader();
      fr.onerror = ()=>res({ err:'bad' });
      fr.onload = ()=>{
        const img = new Image();
        img.onerror = ()=>res({ err:'bad' });
        img.onload = ()=>{
          if(!img.naturalWidth || !img.naturalHeight) return res({ err:'bad' });
          const k = Math.min(1, BM_IMG_PX / img.naturalHeight);
          const cv = document.createElement('canvas');
          cv.width = Math.max(1, Math.round(img.naturalWidth * k));
          cv.height = Math.max(1, Math.round(img.naturalHeight * k));
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          for(const q of [0.9, 0.8, 0.7, 0.55]){
            const d = cv.toDataURL('image/webp', q);
            if(d.indexOf('data:image/webp') !== 0) return res({ err:'bad' });
            if(Math.floor((d.length - d.indexOf(',') - 1) * 3 / 4) <= BM_IMG_MAX_BYTES) return res({ dataUrl:d });
          }
          res({ err:'big' });
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }
  function bmEditor(id){
    if(bmData.order.length >= BM_MAX && !id){
      toastOf('책장이 가득 찼어요 · 한 권을 빼 주세요'); return;
    }
    bmEditorClose();
    const cur = id ? bmData.items[id] : null;
    const draft = { url: cur ? cur.url : '', title: cur ? cur.title : '', w: cur ? cur.w : 'thin',
                    h: cur ? cur.h : 'short', color: cur ? cur.color : BM_DEFAULT_COLOR,
                    tcolor: cur ? (cur.tcolor || BM_DEFAULT_TCOLOR) : BM_DEFAULT_TCOLOR,
                    hideTitle: cur ? !!cur.hideTitle : false, pub: cur ? !!cur.pub : false,
                    img: cur ? (cur.img || '') : '' };
    const ov = document.createElement('div');
    ov.className = 'app-popup-ov';   // ⚠️ 클릭 통과 화이트리스트(UI_HIT_SEL) 매칭용
    /* 바깥은 어둡게 덮지 않는다(요청) — 뒤의 마이홈이 그대로 보인다. 클릭을 받아 닫기만 한다. */
    ov.style.cssText = 'position:fixed;inset:0;z-index:9750;background:transparent;display:flex;align-items:center;justify-content:center;';
    const box = document.createElement('div');
    box.style.cssText = 'width:300px;max-width:92vw;background:var(--win-face);border:2px solid;'
      + 'border-color:var(--win-hi) var(--win-lo-2) var(--win-lo-2) var(--win-hi);border-radius:var(--win-radius-el);'
      + 'box-shadow:4px 4px 0 rgba(0,0,0,.35);font-family:Tahoma,"Malgun Gothic",sans-serif;color:var(--ink);';
    const tb = document.createElement('div');
    tb.style.cssText = 'background:linear-gradient(90deg,var(--win-title-a),var(--win-title-b));color:#fff;padding:5px 8px;font-size:12px;font-weight:bold;';
    tb.textContent = id ? '📚 책 고치기' : '📚 책 꽂기';
    const body = document.createElement('div'); body.style.cssText = 'padding:12px 14px 14px;font-size:11px;';
    const inp = (val, max, ph)=>{ const e = document.createElement('input'); e.type = 'text'; e.value = val; e.maxLength = max; e.placeholder = ph || '';
      e.autocomplete = 'off'; e.style.cssText = 'flex:1;min-width:0;font-family:inherit;font-size:11px;padding:3px 5px;background:#fff;border:2px solid;'
      + 'border-color:var(--win-lo) var(--win-hi) var(--win-hi) var(--win-lo);'; return e; };
    const urlEl = inp(draft.url, BM_URL_MAX, 'https://');
    const titleEl = inp(draft.title, BM_TITLE_MAX, '책등에 세로로 (14자)');
    body.appendChild(bmField('주소', urlEl));
    body.appendChild(bmField('제목', titleEl));
    body.appendChild(bmField('두께', bmSeg([['thin','얇게'],['thick','두껍게']], draft.w, v=>{ draft.w = v; paint(); })));
    body.appendChild(bmField('높이', bmSeg([['short','짧게'],['long','길게']], draft.h, v=>{ draft.h = v; paint(); })));
    /* 색 두 자리(책등 · 제목 글자) — 꾸미기 창의 자유색 팔레트를 그대로 쓴다(새로 그리지 않는다).
       ★ 팔레트는 바깥을 누르면 닫힌다 — 팔레트 자체가 그 처리를 안 하므로 여는 쪽에서 붙였다 뗀다(제보).
       ★ 한 번에 하나만 열린다(다른 자리를 누르면 먼저 닫는다). */
    let palOff = null, palHost = null;
    const palClose = ()=>{
      if(palHost){ const p = palHost.querySelector('.wd-color-palette'); if(p) p.remove(); palHost = null; }
      if(palOff){ document.removeEventListener('pointerdown', palOff, true); palOff = null; }
    };
    function colorPick(label, key, ph){
      const row = document.createElement('div'); row.style.cssText = 'display:flex;align-items:center;gap:6px;position:relative;';
      const sw = document.createElement('button'); sw.type = 'button'; sw.setAttribute('aria-label', label + ' 고르기');
      sw.style.cssText = 'width:22px;height:22px;flex:none;cursor:pointer;border:1px solid;border-color:var(--win-lo-2) var(--win-hi) var(--win-hi) var(--win-lo-2);background:' + draft[key] + ';';
      const hex = inp(draft[key], 7, ph); hex.style.flex = 'none'; hex.style.width = '74px';
      row.appendChild(sw); row.appendChild(hex);
      sw.onclick = e=>{
        e.stopPropagation();
        const mine = (palHost === row);
        palClose();
        if(mine) return;
        if(typeof buildFreeColorPicker !== 'function'){ toastOf('색 팔레트를 불러오지 못했어요'); return; }
        const pop = buildFreeColorPicker(draft[key], c=>{ draft[key] = c; hex.value = c; sw.style.background = c; paint(); });
        pop.style.top = '26px'; pop.style.left = '0';
        row.appendChild(pop); palHost = row;
        palOff = ev=>{ if(!pop.contains(ev.target) && ev.target !== sw) palClose(); };
        document.addEventListener('pointerdown', palOff, true);
      };
      hex.addEventListener('change', ()=>{
        const v = hex.value.trim();
        if(/^#[0-9a-fA-F]{6}$/.test(v)){ draft[key] = v; sw.style.background = v; paint(); }
        else hex.value = draft[key];
      });
      return row;
    }
    body.appendChild(bmField('색', colorPick('책등 색', 'color', '#8f5a4a')));
    body.appendChild(bmField('글자색', colorPick('제목 글자색', 'tcolor', '#ffffff')));
    /* 제목 숨기기 — 그림만 보이게(요청). 그림이 없어도 끌 수 있다(민무늬 책등). */
    const hideRow = document.createElement('label'); hideRow.style.cssText = 'display:flex;align-items:center;gap:5px;cursor:pointer;font-size:10.5px;';
    const hideCb = document.createElement('input'); hideCb.type = 'checkbox'; hideCb.checked = !!draft.hideTitle;
    hideCb.addEventListener('change', ()=>{ draft.hideTitle = hideCb.checked; paint(); });
    hideRow.appendChild(hideCb); hideRow.appendChild(document.createTextNode('책등에 제목 숨기기'));
    body.appendChild(bmField('', hideRow));
    /* 👀 공개 — 마이홈에 들어온 누구에게나(요청). 기본 꺼짐. */
    const pubRow = document.createElement('label'); pubRow.style.cssText = hideRow.style.cssText;
    const pubCb = document.createElement('input'); pubCb.type = 'checkbox'; pubCb.checked = !!draft.pub;
    pubCb.addEventListener('change', ()=>{ draft.pub = pubCb.checked; });
    pubRow.appendChild(pubCb); pubRow.appendChild(document.createTextNode('마이홈 방문자에게 공개'));
    body.appendChild(bmField('', pubRow));
    /* 책등 그림 — 선택. 없으면 색 + 세로 제목. */
    const imgRow = document.createElement('div'); imgRow.style.cssText = 'display:flex;align-items:center;gap:4px;';
    const imgPick = document.createElement('button'); imgPick.type = 'button'; imgPick.textContent = '그림 등록';
    imgPick.style.cssText = 'font-family:inherit;font-size:10.5px;padding:3px 9px;cursor:pointer;color:var(--ink);background:var(--win-face);border:2px solid;border-color:var(--win-hi) var(--win-lo-2) var(--win-lo-2) var(--win-hi);';
    const imgDrop = document.createElement('button'); imgDrop.type = 'button'; imgDrop.textContent = '그림 빼기';
    imgDrop.style.cssText = imgPick.style.cssText; imgDrop.style.display = draft.img ? '' : 'none';
    const imgFile = document.createElement('input'); imgFile.type = 'file'; imgFile.accept = 'image/*'; imgFile.style.display = 'none';
    imgRow.appendChild(imgPick); imgRow.appendChild(imgDrop); imgRow.appendChild(imgFile);
    body.appendChild(bmField('그림', imgRow));
    const msg = document.createElement('div'); msg.style.cssText = 'font-size:10px;color:var(--ink-soft);line-height:1.55;margin:2px 0 8px;';
    msg.textContent = '주소는 비워 둬도 돼요(장식 책). 적을 땐 http/https 만 열려요. 그림은 세로 400px · 200KB 이하.';
    body.appendChild(msg);
    /* 미리보기 — 실제 책등과 같은 그림으로 그린다 */
    const prev = document.createElement('div'); prev.style.cssText = 'display:flex;justify-content:center;align-items:flex-end;height:170px;margin-bottom:10px;background:linear-gradient(180deg,#3f2616,#5b3a22);border:2px solid;border-color:var(--win-lo) var(--win-hi) var(--win-hi) var(--win-lo);';
    body.appendChild(prev);
    function paint(){
      prev.textContent = '';
      const b = document.createElement('div'); b.className = 'bm-book';
      b.style.cssText = 'position:relative;box-sizing:border-box;overflow:hidden;border:1px solid #2e1c0f;border-radius:2px 2px 0 0;box-shadow:1px 2px 3px rgba(0,0,0,.45);margin-bottom:12px;';
      b.style.width = BM_W[draft.w] + 'px'; b.style.height = BM_H[draft.h] + 'px'; b.style.background = draft.color;
      if(draft.img){ const im = document.createElement('img'); im.className = 'bm-i'; im.src = draft.img; im.alt = ''; b.appendChild(im); }
      if(titleEl.value && !draft.hideTitle){
        const t = document.createElement('div'); t.className = 'bm-t'; t.textContent = titleEl.value.slice(0, BM_TITLE_MAX);
        t.style.color = draft.tcolor; b.appendChild(t);
      }
      prev.appendChild(b);
    }
    titleEl.addEventListener('input', paint);
    imgPick.onclick = e=>{ e.stopPropagation(); imgFile.value = ''; imgFile.click(); };
    imgFile.addEventListener('change', async ()=>{
      const f = imgFile.files && imgFile.files[0]; if(!f) return;
      const u = uid(), a = api();
      if(!u || !a || !a.uploadBookmarkImg){ msg.textContent = '아직 준비 중이에요 — 잠시 뒤 다시 해 주세요.'; return; }
      msg.textContent = '그림을 올리는 중…';
      const prep = await bmPrepImg(f);
      if(prep.err){ msg.textContent = (prep.err === 'big') ? '그림이 너무 커요 — 줄여도 200KB 를 넘었어요.' : '그림 파일을 읽지 못했어요.'; return; }
      const up = await a.uploadBookmarkImg(u, id || 'new', prep.dataUrl);
      if(!up || !up.ok){ msg.textContent = '그림을 올리지 못했어요.'; return; }
      draft.img = up.url; imgDrop.style.display = ''; msg.textContent = '그림을 올렸어요.'; paint();
    });
    imgDrop.onclick = e=>{ e.stopPropagation(); draft.img = ''; imgDrop.style.display = 'none'; paint(); };
    const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:6px;justify-content:flex-end;';
    const mkb = (t, red)=>{ const b = document.createElement('button'); b.className = 'lc-btn'; b.type = 'button'; b.textContent = t;
      b.style.cssText = 'width:auto;margin:0;padding:4px 14px;font-size:11px;' + (red ? 'color:#B22222;' : ''); row.appendChild(b); return b; };
    if(id){
      const del = mkb('빼기', true);
      del.onclick = ()=>{
        const old = bmData.items[id] && bmData.items[id].img;
        delete bmData.items[id];
        bmData.order = bmData.order.filter(x=>x !== id);
        bmEditorClose(); bmPush();
        const a = api(); if(old && a && a.deleteStorageUrl) a.deleteStorageUrl(old).catch(()=>{});
      };
    }
    const ok = mkb('저장'), no = mkb('취소');
    no.onclick = bmEditorClose;   // [취소]와 Esc 만 버린다
    ok.onclick = ()=>bmEditorSave();
    /* 바깥을 누르면 **자동 저장**(요청). 주소를 적었는데 형식이 틀릴 때만 창을 열어 둔 채 알려 준다. */
    function bmEditorSave(){
      const u = urlEl.value.trim();
      /* 주소는 비워 둬도 저장된다(요청). 적었는데 형식이 틀린 경우만 막는다 — 오타를 조용히 버리지 않기 위해. */
      if(u && !bmUrlOk(u)){ msg.textContent = 'http:// 또는 https:// 로 시작하는 주소만 꽂을 수 있어요. (비워 두면 장식 책이 돼요)'; return; }
      const bid = id || bmNewId();
      const oldImg = (id && bmData.items[id] && bmData.items[id].img) || '';
      bmData.items[bid] = { url:bmUrlSlot(u), title:titleEl.value.trim().slice(0, BM_TITLE_MAX), w:draft.w, h:draft.h,
                            color:draft.color, tcolor:draft.tcolor, hideTitle:!!draft.hideTitle, pub:!!draft.pub,
                            at:(id && bmData.items[id] ? bmData.items[id].at : Date.now()) };
      if(draft.img) bmData.items[bid].img = draft.img;
      if(!id){
        if(bmData.order.length >= BM_MAX){ toastOf('책장이 가득 찼어요 · 한 권을 빼 주세요'); return; }
        bmData.order.push(bid);
      }
      bmEditorClose(); bmPush();
      if(oldImg && oldImg !== draft.img){ const a = api(); if(a && a.deleteStorageUrl) a.deleteStorageUrl(oldImg).catch(()=>{}); }
    }
    body.appendChild(row);
    box.appendChild(tb); box.appendChild(body); ov.appendChild(box);
    ov.addEventListener('mousedown', e=>{ if(e.target === ov){ palClose(); bmEditorSave(); } });
    document.addEventListener('keydown', function esc(e){ if(e.key === 'Escape'){ bmEditorClose(); document.removeEventListener('keydown', esc, true); } }, true);
    document.body.appendChild(ov); bmEditOv = ov;
    paint(); urlEl.focus();
  }

  /* ── 붙이기 ───────────────────────────────────────────────────────────── */
  function mhdReady(fn){
    if(window.MYHOME_DESKTOP) window.MYHOME_DESKTOP.onReady(fn);
    else (window._MHD_PENDING = window._MHD_PENDING || []).push(fn);
  }
  bmLoadLocal();
  mhdReady(D=>{
    bmStyle();
    bmBody = D.createWindow({ id:'bmWin', title:'📚 북마크', host:'side', fill:false, visitable:true, onClose(){ bmOpen = false; bmEditorClose(); } });
    if(!bmBody) return;
    bmBody.style.cssText += 'display:flex;flex-direction:column;padding:0;';
    const top = document.createElement('div'); top.id = 'bmTop';
    bmCount = document.createElement('span');
    bmAddBtn = document.createElement('button'); bmAddBtn.id = 'bmAdd'; bmAddBtn.type = 'button'; bmAddBtn.textContent = '+ 추가';
    bmAddBtn.onclick = e=>{ e.stopPropagation(); bmEditor(null); };
    top.appendChild(bmAddBtn); top.appendChild(bmCount);
    bmShelf = document.createElement('div'); bmShelf.id = 'bmShelf';
    const rows = document.createElement('div'); rows.id = 'bmRows'; bmShelf.appendChild(rows);
    bmBody.appendChild(top); bmBody.appendChild(bmShelf);
    bmBindShelf(); bmRender();
    D.addFolder({
      id:'bookmark', label:'북마크', icon:'📚', slot:0, visitable:true,
      onOpen(){
        /* 폴더를 다시 누르면 닫힌다(요청) — 창 ✕ 와 같은 길로 닫는다. */
        if(D.isWindowOpen && D.isWindowOpen('bmWin')){ bmOpen = false; bmEditorClose(); D.closeWindow('bmWin'); return; }
        bmOpen = true;
        D.openWindow('bmWin');
        if(!bmVisit && !bmLoaded) bmPull().then(()=>bmRender()).catch(()=>{});
        bmRender();
      },
      /* 👀 남의 집 — 그 사람의 공개 책장으로 갈아 끼운다. 공개된 책이 없으면 폴더 자체를 감춘다(빈 서랍을 열게 하지 않는다). */
      onVisit(v, ownerId){
        bmOpen = false; bmEditorClose(); D.closeWindow('bmWin');
        if(!v){ bmVisit = null; if(D.setFolderVisible) D.setFolderVisible('bookmark', true); bmRender(); return; }
        bmVisit = { uid: ownerId || null, data: { order:[], items:{}, ts:0 } };
        if(D.setFolderVisible) D.setFolderVisible('bookmark', false);
        const a = api();
        if(!ownerId || !a || !a.getPublicBookmarks) return;
        a.getPublicBookmarks(ownerId).then(r=>{
          if(!bmVisit || bmVisit.uid !== ownerId) return;      // 그 사이 집을 나갔다
          bmVisit.data = bmClean((r && r.data) || {});
          if(D.setFolderVisible) D.setFolderVisible('bookmark', bmVisit.data.order.length > 0);
          bmRender();
        }).catch(()=>{});
      },
    });
    /* 부팅 때 한 번 받아 둔다 — 폴더를 누르는 순간 빈 책장이 잠깐 보이지 않게. */
    setTimeout(()=>{ if(!bmLoaded) bmPull().then(()=>bmRender()).catch(()=>{}); }, 4000);
  });
})();
