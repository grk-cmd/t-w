/* chat-notice.js — 📢 시크릿룸 공지(#공지 탭 · 고정 한 줄)
   채팅창의 «#공지» 탭에서 시크릿룸 방장이 공지를 쓰고 · 고치고 · 지우고 · 📌 고정한다. 고정한 공지 하나는 모든 채팅 탭 위에
   한 줄로 뜨고(길면 마우스를 올려 흘려 읽는다) 누르면 숨는다(다시 보려면 #공지 탭). 공지는 채팅 말풍선으로 나가지 않는다.
   ★ 데이터: rooms/{방}/_notice/{n1..n20} = { text(1~300자), ts, pin? } — 방에 영구 보관(대화 3일 보관과 무관 · 서버 정리도 안 건드린다).
     고정은 공지 안의 pin:true — 한 번에 하나(다른 것은 같은 묶음에서 지운다). 상한 20 = 자리 이름(규칙에 자식 수 세는 함수가 없다).
   ★ 쓰는 사람 = 시크릿룸 방장(고정 · 나가도 안 바뀜) — 앱이 막는다. 참여자는 읽기만. 시크릿룸이 아닌 방에는 탭도 줄도 없다.
   ⚠️ 서버에서 읽고 쓰는 것은 provider(deps) 한 곳 — 이 파일은 firebaseAPI 를 직접 부르지 않는다.
   ⚠️ 남이 쓸 수 있는 글이다 — 화면에 넣을 때는 반드시 deps.escHtml(TwSafeHtml.text) 을 거친다.
   classic script(window.TwChatNotice) — app.js 가 채팅 모듈(chat-ui.js)보다 먼저 createChatNotice(deps) 로 만든다.
   ⚠️ 채팅 모듈을 부르지 않는다 — 채팅 모듈이 onChange 로 «탭 줄 · 입력칸 다시 그리기» 를 걸어 둔다(한쪽으로만 — 순환 방지).
   검사: checks/sim-chat-notice.js */
(function(){

const TEXT_MAX = 300;
const SLOT_COUNT = 20;
const SLOTS = Array.from({ length: SLOT_COUNT }, (_, i) => 'n' + (i + 1));
const NOTICE_TAB = 'notice';          // 탭 줄의 id(저장 · 방송하지 않는다 — 채팅 탭이 아니라 보기 상태다)
const NOTICE_TAB_NAME = '공지';

/* 서버 사본 → [{ id, text, ts, pin }] — 고정한 것이 맨 위, 나머지는 새 글이 먼저. 모양이 틀린 칸은 버린다. */
function list(raw){
  const o = (raw && typeof raw === 'object') ? raw : {};
  const out = [];
  for(const id of SLOTS){
    const v = o[id];
    if(!v || typeof v.text !== 'string' || !v.text.trim()) continue;
    out.push({ id, text: v.text.slice(0, TEXT_MAX), ts: Number.isFinite(v.ts) ? v.ts : 0, pin: v.pin === true });
  }
  return out.sort((a, b) => (b.pin - a.pin) || (b.ts - a.ts) || (a.id < b.id ? -1 : 1));
}
/* 고정한 공지 — 둘 이상이면(동시에 고정한 경우) 가장 새 것. 없으면 null. */
function pinnedOf(items){
  const p = (items || []).filter(x => x.pin).sort((a, b) => b.ts - a.ts);
  return p.length ? p[0] : null;
}
/* 쓴 글 다듬기 — 줄바꿈 · 연속 공백을 한 칸으로, 앞뒤 공백 떼기, 300자까지. 문제가 있으면 { err }. */
function cleanText(raw){
  const t = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
  if(!t) return { err: '공지 내용을 적어 주세요' };
  if(t.length > TEXT_MAX) return { err: '공지는 ' + TEXT_MAX + '자까지예요' };
  return { text: t };
}
/* 고정을 옮길 때 pin 을 지워야 하는 다른 공지 id 들 */
function pinClearIds(items, id){ return (items || []).filter(x => x.pin && x.id !== id).map(x => x.id); }
/* 12.31 21:04 */
function timeText(ts){
  if(!Number.isFinite(ts) || ts <= 0) return '';
  const d = new Date(ts), p = (n) => String(n).padStart(2, '0');
  return (d.getMonth() + 1) + '.' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

/* ── 화면 조각(순수) — 남이 쓴 글이라 escHtml(TwSafeHtml.text) 을 거쳐서만 넣는다. st = { host, editId, delId } */
function pinHtml(p, escHtml){
  return '<span class="cp-ico">📌</span><span class="cp-clip"><span class="cp-text">' + escHtml(p.text) + '</span></span>';
}
function itemHtml(it, st, escHtml){
  if(st.editId === it.id){
    return '<div class="cn-item editing" data-id="' + escHtml(it.id) + '">' +
      '<input type="text" class="cn-edit-in" maxlength="' + TEXT_MAX + '" value="' + escHtml(it.text) + '">' +
      '<div class="cn-acts"><button type="button" data-act="save">저장</button><button type="button" data-act="cancel">취소</button></div></div>';
  }
  if(st.delId === it.id){
    return '<div class="cn-item deleting" data-id="' + escHtml(it.id) + '"><div class="cn-text">' + escHtml(it.text) + '</div>' +
      '<div class="cn-meta"><span>이 공지를 삭제할까요? 되돌릴 수 없어요</span><span class="cn-acts"><button type="button" data-act="delok">삭제</button><button type="button" data-act="cancel">취소</button></span></div></div>';
  }
  return '<div class="cn-item' + (it.pin ? ' pin' : '') + '" data-id="' + escHtml(it.id) + '">' +
    '<div class="cn-text">' + (it.pin ? '<span class="cn-pinmark">📌</span> ' : '') + escHtml(it.text) + '</div>' +
    '<div class="cn-meta"><span class="cn-ts">' + escHtml(timeText(it.ts)) + '</span>' +
    (st.host ? '<span class="cn-acts"><button type="button" data-act="pin" title="' + (it.pin ? '고정 풀기' : '이 공지를 위에 고정') + '">' + (it.pin ? '📌 풀기' : '📌 고정') + '</button>' +
      '<button type="button" data-act="edit" title="고치기">✎</button><button type="button" data-act="del" title="지우기">🗑</button></span>' : '') +
    '</div></div>';
}
function listHtml(items, st, escHtml){
  if(!items.length && st.failed) return '<div class="cn-empty">공지를 불러오지 못했어요<br><small>잠시 뒤 채팅창을 다시 열어 주세요</small></div>';
  if(!items.length){
    return '<div class="cn-empty">아직 공지가 없어요' + (st.host ? '<br><small>아래 입력칸에 쓰고 Enter 를 누르면 공지로 올라가요 · 채팅에는 안 나와요</small>' : '') + '</div>';
  }
  return items.map(it => itemHtml(it, st, escHtml)).join('');
}

/**
 * @param {{
 *   document: Document,
 *   escHtml: (s: unknown) => string,
 *   toast: (msg: string) => void,
 *   getMyUserId: () => string|null,
 *   roomCode: () => string|null,
 *   roomState: { isSecretCode(code: unknown): boolean, isHost(meta: unknown, me: unknown): boolean },
 *   provider: {
 *     subscribe(room: string, cb: (raw: object|null) => void): () => void,
 *     add(room: string, text: string): Promise<{ ok: boolean, id?: string, reason?: string }>,
 *     edit(room: string, id: string, text: string): Promise<{ ok: boolean }>,
 *     remove(room: string, id: string): Promise<{ ok: boolean }>,
 *     pin(room: string, id: string, on: boolean, clearIds: string[]): Promise<{ ok: boolean }>,
 *   },
 *
 *   notifyError: (code: string, err?: unknown) => void,
 * }} deps
 */
function createChatNotice(deps){
  const doc = deps.document;
  const escHtml = deps.escHtml;
  const toast = deps.toast;
  const getMyUserId = deps.getMyUserId;
  const roomCode = deps.roomCode;
  const roomState = deps.roomState;
  const provider = deps.provider;
  const notifyError = deps.notifyError;
  /* 방장 · 시크릿룸 판정은 방 안 [방 설정] · 채팅 잠금과 같은 한 곳(room-state.js) — 채팅 모듈을 거치지 않는다(순환 방지) */
  const isSecretRoom = () => roomState.isSecretCode(roomCode());
  const isHost = () => { try{ return roomState.isHost(window._roomMetaCache, getMyUserId()); }catch(_){ return false; } };
  /* 채팅 모듈이 «탭 줄 · 입력칸 안내문 다시 그리기» 를 걸어 둔다 — 이 모듈은 채팅 모듈을 모른다(onRoomChanged 와 같은 방식) */
  const changeFns = [];
  const onChange = (fn) => { changeFns.push(fn); };
  const changed = () => changeFns.forEach(f => f());

  let items = [];
  let unsub = null;
  let subRoom = null;
  let hiddenSig = null;     // 고정 줄을 눌러 숨긴 공지(id · 시각 · 글) — 다른 공지를 고정하거나 고치면 다시 뜬다
  let loadFailed = false;   // 서버 읽기 실패 — «공지 없음» 과 다르게 그린다
  let active = false;     // #공지 탭을 보고 있다
  let editId = null;      // 고치는 중인 공지
  let delId = null;       // 지울지 묻는 중인 공지(그 칸 안에서 «정말?» — 따로 창을 띄우지 않는다)

  const $ = (id) => doc.getElementById(id);
  const available = () => !!(isSecretRoom() && roomCode());

  function failed(r){
    if(r && r.reason) toast(r.reason);
    else notifyError('E-CHAT-01');
  }

  /* 고정 줄 — 시크릿룸 · 고정한 공지가 있고 · #공지 탭이 아닐 때만. 길면 마우스를 올려 흘려 읽는다(CSS 가 .long 에서 움직임). */
  function measurePin(){
    const el = $('chatPin'); if(!el) return;
    const t = el.querySelector('.cp-text'), c = el.querySelector('.cp-clip'); if(!t || !c) return;
    const over = t.scrollWidth - c.clientWidth;
    t.classList.toggle('long', over > 0);
    if(over > 0) t.style.setProperty('--cp-d', (-over - 4) + 'px');
  }
  const pinSig = (p) => p.id + '|' + p.ts + '|' + p.text;
  function hidePin(){
    const p = pinnedOf(items); if(!p) return;
    hiddenSig = pinSig(p); paintPin();
  }
  function paintPin(){
    const el = $('chatPin'); if(!el) return;
    let p = (available() && !active) ? pinnedOf(items) : null;
    if(p && pinSig(p) === hiddenSig) p = null;
    el.classList.toggle('on', !!p);
    if(!p){ el.textContent = ''; return; }
    el.title = '고정 공지 — 눌러서 숨기기 (공지 탭에서 다시 볼 수 있어요)';
    el.innerHTML = pinHtml(p, escHtml);
    measurePin();
  }

  function paintList(){
    const box = $('chatNotices'); if(!box) return;
    if(!active){ box.textContent = ''; return; }
    box.innerHTML = listHtml(items, { host: isHost(), editId, delId, failed: loadFailed }, escHtml);
    const inp = box.querySelector('.cn-edit-in');
    if(inp){ inp.focus(); inp.select(); }
  }
  function paint(){
    const win = $('chatWindow');
    if(win) win.classList.toggle('notice-mode', active);
    paintList();
    paintPin();
  }

  /* 채팅창을 열 때 · 방이 바뀔 때 — 시크릿룸이면 공지를 구독한다(창이 열려 있는 동안만). */
  function stop(){
    if(unsub){ try{ unsub(); }catch(_){} unsub = null; }
    subRoom = null; items = []; editId = null; delId = null; loadFailed = false; hiddenSig = null;
    if(active){ active = false; changed(); }
    paint();
  }
  function start(){
    const room = roomCode();
    if(!available()){ if(unsub || active || items.length) stop(); return; }
    if(unsub && subRoom === room) { paint(); return; }
    if(unsub){ try{ unsub(); }catch(_){} unsub = null; }
    subRoom = room; items = []; editId = null; delId = null; loadFailed = false;
    unsub = provider.subscribe(room, raw => {
      if(raw === null){   // 읽기 실패 — «공지 없음» 과 구분해 그린다 · 구독은 이미 끊겨서 다음 start() 가 다시 건다
        loadFailed = true; unsub = null; paint();
        return;
      }
      loadFailed = false;
      items = list(raw);
      if(editId && !items.some(x => x.id === editId)) editId = null;
      if(delId && !items.some(x => x.id === delId)) delId = null;
      paint();
      changed();   // 탭 줄의 공지 개수
    });
    paint();
  }

  function open(){
    if(!available()) return;
    active = true; editId = null; delId = null;
    paint(); changed();
    const inp = $('chatInput'); if(inp) setTimeout(() => inp.focus(), 0);
  }
  function close(){
    if(!active) return;
    active = false; editId = null; delId = null;
    paint(); changed();
  }
  const isActive = () => active && available();
  const hint = () => isHost() ? '공지 쓰기 — Enter 로 올려요(채팅에는 안 나와요)' : '방장만 공지를 쓸 수 있어요';
  const count = () => items.length;

  /* 입력칸 Enter — #공지 탭이면 채팅이 아니라 공지로 올린다. 처리했으면 true(호출한 쪽은 채팅 전송을 건너뛴다). */
  function submit(inp){
    if(!isActive()) return false;
    if(!isHost()){ toast('방장만 공지를 쓸 수 있어요'); return true; }
    const raw = inp.value;
    if(!String(raw).trim()) return true;
    const c = cleanText(raw);
    if(c.err){ toast(c.err); return true; }
    const room = roomCode(); if(!room) return true;
    inp.value = '';
    provider.add(room, c.text).then(r => {
      if(!(r && r.ok)){ if(!inp.value) inp.value = raw; failed(r); }
    }).catch(() => { if(!inp.value) inp.value = raw; failed(null); });
    return true;
  }

  async function saveEdit(id){
    const box = $('chatNotices'); const inp = box && box.querySelector('.cn-edit-in'); if(!inp) return;
    if(!isHost()){ toast('방장만 고칠 수 있어요'); return; }
    const c = cleanText(inp.value);
    if(c.err){ toast(c.err); inp.focus(); return; }
    const room = roomCode(); if(!room) return;
    const r = await provider.edit(room, id, c.text).catch(() => null);
    if(!(r && r.ok)){ failed(r); return; }
    editId = null; paint();
  }
  function askDelete(id){
    if(!isHost()) return;
    delId = id; editId = null; paintList();
  }
  async function doDelete(id){
    if(!isHost()){ toast('방장만 지울 수 있어요'); return; }
    const room = roomCode(); if(!room) return;
    delId = null;
    const r = await provider.remove(room, id).catch(() => null);
    if(!(r && r.ok)){ failed(r); paintList(); } else toast('🗑 공지를 지웠어요');
  }
  async function togglePin(id){
    if(!isHost()){ toast('방장만 고정할 수 있어요'); return; }
    const it = items.find(x => x.id === id); if(!it) return;
    const room = roomCode(); if(!room) return;
    const r = await provider.pin(room, id, !it.pin, pinClearIds(items, id)).catch(() => null);
    if(!(r && r.ok)) failed(r);
  }

  /* 단추 하나 — 화면 조각의 data-act 이름과 같다(검사가 직접 부른다) */
  function act(name, id){
    if(name === 'pin') togglePin(id);
    else if(name === 'edit'){ if(isHost()){ editId = id; delId = null; paintList(); } }
    else if(name === 'del') askDelete(id);
    else if(name === 'delok') doDelete(id);
    else if(name === 'save') saveEdit(id);
    else if(name === 'cancel'){ editId = null; delId = null; paintList(); }
  }

  function bind(){
    const box = $('chatNotices');
    if(box){
      box.addEventListener('mousedown', e => e.stopPropagation());
      box.addEventListener('contextmenu', e => { e.stopPropagation(); });
      box.addEventListener('click', e => {
        e.stopPropagation();
        const b = e.target.closest && e.target.closest('button[data-act]'); if(!b) return;
        const item = b.closest('.cn-item'); const id = item && item.dataset.id; if(!id) return;
        act(b.dataset.act, id);
      });
      box.addEventListener('keydown', e => {
        if(!(e.target.closest && e.target.closest('.cn-edit-in'))) return;
        e.stopPropagation();
        if(e.isComposing || e.keyCode === 229) return;   // 한글 조합 중 Enter 는 조합 확정에 쓴다
        const id = editId; if(!id) return;
        if(e.key === 'Enter'){ e.preventDefault(); saveEdit(id); }
        else if(e.key === 'Escape'){ editId = null; paintList(); }
      });
    }
    const pin = $('chatPin');
    if(pin){
      pin.addEventListener('mousedown', e => e.stopPropagation());
      pin.addEventListener('mouseenter', measurePin);   // 창이 숨어 있을 때 못 잰 길이를 올려 볼 때 다시
      pin.addEventListener('click', e => { e.stopPropagation(); hidePin(); });
    }
  }
  bind();

  return { start, stop, open, close, isActive, available, hint, count, submit, paint, onChange, act };
}

const api = Object.freeze({ TEXT_MAX, SLOT_COUNT, SLOTS, NOTICE_TAB, NOTICE_TAB_NAME, list, pinnedOf, cleanText, pinClearIds, timeText, pinHtml, itemHtml, listHtml, createChatNotice });
if(typeof window !== 'undefined') window.TwChatNotice = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
