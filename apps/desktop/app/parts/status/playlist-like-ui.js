/* playlist-like-ui.js — 👍 플레이리스트 반응 화면: 남의 목록이면 [💬 반응] → 창 옆 서랍(노래가 좋아요 👍) · 내 목록이면 👍 수만 (검사 sim-playlist-like.js)
   [왜] 무엇을 보일지(view)와 서버 읽기 · 쓰기(net)는 playlist-like.js — 여기는 그리기 · 열고 닫기만 한다.
   ★ 서랍은 #myPlaylistBox 의 자식이라 창을 끌면 같이 움직인다. 화면 오른쪽에 자리가 없으면 창 왼쪽에 붙는다.
     닫는 길: [💬 반응] 다시 누르기 · Esc · 서랍 바깥 누르기 · 목록이 바뀜(내 목록 · 다른 사람) · 창 닫기.
   ★ 읽기는 «누구의 몇 번 프리셋» 이 바뀔 때만 한 번(수 하나 · 내 표시 하나) — 다시 그릴 때마다 읽지 않는다.
   ⚠️ 남이 쓴 글은 없다(수 · 고정 문구뿐) — 그래도 textContent 로만 넣는다.
   받는 것(deps): likeRules(TwPlaylistLike — view · presetKey) · net(() => firebaseAPI.playlistLike — firebase-init 이 늦게 돌아서 부를 때 찾는다) ·
     getMyUserId · notifyError — 번호 · 오류를 받는다. 내보냄: { render(ctx), close() } — playlist.js 가 소개칸을 그릴 때 · 창을 닫을 때 부른다.
   app.js 보다 먼저 싣는 classic script(window.TwPlaylistLikeUi). */
(function(){
const DRAWER_GAP = 4;   // 창과 서랍 사이(px)

function createPlaylistLikeUi(deps){
  const likeRules = deps.likeRules;
  const net = deps.net;
  const getMyUserId = deps.getMyUserId;
  const notifyError = deps.notifyError;
  const $ = (id) => document.getElementById(id);

  let ctx = null;            // 마지막으로 그린 { ro, ownerId, myId, setIdx }
  let key = '';              // 'owner/preset' — 바뀌면 다시 읽는다
  let st = { loaded: false, failed: false, count: 0, mine: false, busy: false };
  let seq = 0;               // 늦게 온 읽기는 버린다
  let open = false;

  function keyOf(c){
    const k = c && likeRules.presetKey(c.setIdx);
    return (c && c.ownerId && k !== null) ? c.ownerId + '/' + k : '';
  }
  async function load(c){
    const my = ++seq;
    st = { loaded: false, failed: false, count: 0, mine: false, busy: false };
    let r = null;
    try{ r = await net().read(c.ownerId, c.setIdx, c.myId); }catch(_){ r = null; }
    if(my !== seq) return;
    st = r ? { loaded: true, failed: false, count: r.count, mine: r.mine, busy: false }
           : { loaded: true, failed: true, count: 0, mine: false, busy: false };
    paint();
  }

  function paint(){
    const row = $('myPlLikeRow'), cnt = $('myPlLikeCnt'), react = $('myPlReact');
    const v = likeRules.view(ctx, st);
    if(row) row.style.display = (v.mode === 'none' || (v.mode === 'count' && v.count === null)) ? 'none' : '';
    if(cnt){
      cnt.style.display = v.mode === 'count' ? '' : 'none';
      cnt.textContent = '👍 ' + (v.count == null ? 0 : v.count);
      cnt.title = '이 프리셋이 받은 «노래가 좋아요» 수 — 누가 눌렀는지는 안 보여요';
    }
    if(react){
      react.style.display = v.mode === 'react' ? '' : 'none';
      react.classList.toggle('on', open);
    }
    if(v.mode !== 'react' && open) close();
    const btn = $('myPlLikeBtn'), dc = $('myPlLikeDrawerCnt'), dr = $('myPlLikeDrawer');
    if(btn && v.mode === 'react'){
      btn.textContent = v.label;
      btn.disabled = !!v.disabled;
      btn.classList.toggle('done', !!v.locked);
    }
    if(dc) dc.textContent = (v.mode === 'react' && st.loaded && st.failed) ? '반응을 불러오지 못했어요' : '';   // 수는 주인만 본다 — 여기는 실패 안내만
    if(dr) dr.classList.toggle('on', open);
    if(open) place();
  }

  /* 창 오른쪽에 붙인다 — 자리가 없으면 왼쪽 */
  function place(){
    const box = $('myPlaylistBox'), dr = $('myPlLikeDrawer');
    if(!box || !dr) return;
    const b = box.getBoundingClientRect(), w = dr.offsetWidth || 0;
    const right = b.right + DRAWER_GAP + w <= window.innerWidth;
    dr.classList.toggle('left', !right);
  }

  function onKey(e){ if(open && e.key === 'Escape'){ e.stopPropagation(); close(); } }
  function onDown(e){
    const dr = $('myPlLikeDrawer'), react = $('myPlReact');
    if(!open || (dr && dr.contains(e.target)) || (react && react.contains(e.target))) return;
    close();
  }
  function setOpen(on){
    if(open === on) return;
    open = on;
    if(on){ document.addEventListener('keydown', onKey, true); document.addEventListener('mousedown', onDown, true); }
    else{ document.removeEventListener('keydown', onKey, true); document.removeEventListener('mousedown', onDown, true); }
    paint();
  }
  function close(){ setOpen(false); }

  async function sendLike(){
    const v = likeRules.view(ctx, st);
    if(v.mode !== 'react' || v.disabled) return;
    const c = ctx, my = seq;
    st = Object.assign({}, st, { busy: true }); paint();
    let r = null, err = null;
    try{ r = await net().like(c.ownerId, c.setIdx, c.myId); }catch(e){ err = e; }
    if(my !== seq) return;   // 그새 다른 목록으로 넘어갔다
    if(r && (r.ok || r.reason === 'already')){
      st = { loaded: true, failed: false, count: st.count, mine: true, busy: false };
    }else{
      st = Object.assign({}, st, { busy: false });
      notifyError('E-SYS-04', err || (r && r.reason));
    }
    paint();
  }

  /* playlist.js 가 소개칸을 그릴 때마다 부른다 — c = { ro, ownerId, setIdx } (myId 는 여기서 채운다) */
  function render(c){
    const next = Object.assign({}, c || {}, { myId: getMyUserId() });
    const k = keyOf(next);
    ctx = next;
    if(k !== key){ key = k; if(open) close(); if(k) load(next); else seq++; }
    paint();
  }

  const reactBtn = $('myPlReact');
  if(reactBtn) reactBtn.addEventListener('click', e => { e.stopPropagation(); setOpen(!open); });
  const likeBtn = $('myPlLikeBtn');
  if(likeBtn) likeBtn.addEventListener('click', e => { e.stopPropagation(); sendLike(); });

  return { render, close };
}

const api = Object.freeze({ createPlaylistLikeUi });
if(typeof window !== 'undefined') window.TwPlaylistLikeUi = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
