/* chat-focus.js — 📊 시크릿룸 #집중 탭(방 전체 집중 기록 · 오늘 / 이번 주 · 사람별 순위)
   채팅창의 «#집중» 탭을 열면 방 사람들이 «이 방 기록에 올리기» 를 켜고 쌓은 집중 시간이 보인다 — 방 전체 누적, 오늘 · 이번 주, 사람별 순위.
   ★ 올리는 것은 사람마다 켠다(켠 사람만 이름과 시간이 방 사람들에게 보인다 · 끄면 그 뒤로 안 올라가고, «내 기록 지우기» 로 지울 수 있다).
   ★ 데이터: rooms/{방}/_focus/{id} = { n, d:{YYYYMMDD:초}, o } — 올리기는 room-focus-sync.js · 서버 일은 room-focus-net.js. 이 파일은 읽고 그리기만 한다.
     하루 합은 최근 12주(84일)만 남기고, 더 오래된 날은 내 칸에서 o 로 합쳐 둔다(방 누적은 그대로 — 저장량이 일정하게).
   ★ 채팅 탭이 아니라 «보기 상태» — 저장 · 방송 · 안 읽음이 없다. 구독은 이 탭을 보는 동안만(방 전체 노드 하나 — 사람 수 × 최대 84일 × 작은 숫자).
   ⚠️ 서버 일은 provider(deps) 한 곳 — 이 파일은 firebaseAPI 를 직접 부르지 않는다.
   ⚠️ 남이 쓸 수 있는 값이다 — 이름은 화면에 넣을 때 반드시 deps.escHtml(TwSafeHtml.text) 을 거치고, 숫자는 모양을 걸러 읽는다.
   classic script(window.TwChatFocus) — app.js 가 채팅 모듈(chat-ui.js)보다 먼저 createChatFocus(deps) 로 만든다.
   ⚠️ 채팅 모듈을 부르지 않는다 — 채팅 모듈이 onChange 로 «탭 줄 · 입력칸 안내문 다시 그리기» 를 걸어 둔다(한쪽으로만 — 순환 방지).
   검사: checks/sim-chat-focus.js */
(function(){

const FOCUS_TAB = 'focus';
const FOCUS_TAB_NAME = '집중';
const KEEP_DAYS = 84;                 // 12주 — 이보다 오래된 날은 o 로 합친다
const DAY_MAX = 86400;
const NAME_MAX = 20;
const METRICS = ['today', 'week', 'total'];
const METRIC_LABEL = { today: '오늘', week: '이번 주', total: '누적' };

const dateOfKey = (k) => new Date(+k.slice(0, 4), +k.slice(4, 6) - 1, +k.slice(6, 8));
function keyOfDate(d){ return String(d.getFullYear()) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); }
function addDays(key, n){ const d = dateOfKey(key); d.setDate(d.getDate() + n); return keyOfDate(d); }
/* 이번 주의 월요일(달성표와 같은 «월요일 시작») */
function weekStartKey(todayKey){ const d = dateOfKey(todayKey); return addDays(todayKey, -((d.getDay() + 6) % 7)); }
const isDayKey = (k) => /^20\d{6}$/.test(k);
const okSec = (v, max) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max;

/* 서버 사본 → { roomTotal, roomToday, roomWeek, rows:[{ id, name, today, week, total }] } — 모양이 틀린 칸은 버린다. rows 는 정렬하지 않는다. */
function stats(raw, todayKey){
  const o = (raw && typeof raw === 'object') ? raw : {};
  const wk = weekStartKey(todayKey);
  const rows = [];
  let roomTotal = 0, roomToday = 0, roomWeek = 0;
  Object.keys(o).forEach(id => {
    const v = o[id]; if(!v || typeof v !== 'object') return;
    let today = 0, week = 0, total = okSec(v.o, 360000000) ? v.o : 0;
    const d = (v.d && typeof v.d === 'object') ? v.d : {};
    Object.keys(d).forEach(k => {
      if(!isDayKey(k) || !okSec(d[k], DAY_MAX)) return;
      total += d[k];
      if(k === todayKey) today += d[k];
      if(k >= wk && k <= todayKey) week += d[k];
    });
    if(total <= 0) return;
    const name = (typeof v.n === 'string' && v.n.trim()) ? v.n.trim().slice(0, NAME_MAX) : '이름 없음';
    rows.push({ id, name, today, week, total });
    roomTotal += total; roomToday += today; roomWeek += week;
  });
  return { roomTotal, roomToday, roomWeek, rows };
}
/* 순위 — 고른 기준이 큰 순 · 같으면 이름순. 그 기준이 0 인 사람은 뺀다. */
function rank(rows, metric){
  const m = METRICS.indexOf(metric) >= 0 ? metric : 'week';
  return rows.filter(r => r[m] > 0).sort((a, b) => (b[m] - a[m]) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}
/* 12주보다 오래된 날 합치기 계획 — 내 칸만. 없으면 null. { newO, keys } */
function compactPlan(node, todayKey){
  if(!node || typeof node !== 'object' || !node.d || typeof node.d !== 'object') return null;
  const cut = addDays(todayKey, -KEEP_DAYS);
  const keys = Object.keys(node.d).filter(k => isDayKey(k) && k < cut && okSec(node.d[k], DAY_MAX));
  if(!keys.length) return null;
  const sum = keys.reduce((s, k) => s + node.d[k], 0);
  return { newO: (okSec(node.o, 360000000) ? node.o : 0) + sum, keys };
}
/* 12시간 05분 · 5분 */
function fmtDur(sec){
  const m = Math.floor(Math.max(0, +sec || 0) / 60), h = Math.floor(m / 60);
  return h > 0 ? h + '시간 ' + String(m % 60).padStart(2, '0') + '분' : m + '분';
}

/* ── 화면 조각(순수) — st = 통계 · ui = { on, metric, delAsk, failed, loading, myId } */
function viewHtml(st, ui, escHtml){
  const h = [];
  h.push('<div class="cf-total"><div class="cf-total-l">방 전체 누적</div><div class="cf-total-v">' + escHtml(fmtDur(st.roomTotal)) + '</div></div>');
  h.push('<div class="cf-cards"><div class="cf-card"><span>오늘</span><b>' + escHtml(fmtDur(st.roomToday)) + '</b></div>' +
    '<div class="cf-card"><span>이번 주</span><b>' + escHtml(fmtDur(st.roomWeek)) + '</b></div></div>');
  h.push('<label class="cf-opt"><input type="checkbox" data-act="toggle"' + (ui.on ? ' checked' : '') + '> 내 집중 시간을 이 방 기록에 올리기' +
    '<small>켜면 이 방 사람들에게 내 이름과 집중 시간이 보여요 · 이 방에 있는 동안 쌓이는 시간만 올라가요</small></label>');
  h.push('<div class="cf-seg">' + METRICS.map(m => '<button type="button" data-act="metric" data-m="' + escHtml(m) + '"' + (ui.metric === m ? ' class="on"' : '') + '>' + escHtml(METRIC_LABEL[m]) + '</button>').join('') + '</div>');
  if(ui.failed){
    h.push('<div class="cf-empty">집중 기록을 불러오지 못했어요<br><small>잠시 뒤 탭을 다시 열어 주세요</small></div>');
  }else if(ui.loading){
    h.push('<div class="cf-empty">집중 기록을 불러오는 중이에요…</div>');
  }else{
    const rs = rank(st.rows, ui.metric);
    if(!rs.length){
      h.push('<div class="cf-empty">아직 ' + escHtml(METRIC_LABEL[ui.metric]) + ' 기록이 없어요<br><small>위에서 켜면 지금부터 쌓여요</small></div>');
    }else{
      const top = rs[0][ui.metric] || 1;
      h.push('<div class="cf-rank">' + rs.map((r, i) =>
        '<div class="cf-row' + (r.id === ui.myId ? ' me' : '') + '"><span class="cf-no">' + (i + 1) + '</span><span class="cf-name">' + escHtml(r.name) + '</span>' +
        '<span class="cf-bar"><i style="width:' + Math.max(2, Math.round(r[ui.metric] / top * 100)) + '%"></i></span>' +
        '<span class="cf-val">' + escHtml(fmtDur(r[ui.metric])) + '</span></div>').join('') + '</div>');
    }
  }
  h.push(ui.delAsk
    ? '<div class="cf-del">내 집중 기록을 이 방에서 지울까요? 되돌릴 수 없어요 <button type="button" data-act="wipeok">지우기</button><button type="button" data-act="cancel">취소</button></div>'
    : '<div class="cf-del"><button type="button" data-act="wipe">내 기록 지우기</button></div>');
  return h.join('');
}

/**
 * @param {{
 *   document: Document, escHtml: (s: string) => string, toast: (m: string) => void,
 *   getMyUserId: () => string, roomCode: () => string,
 *   roomState: { isSecretCode(code: string): boolean },
 *   provider: {
 *     subscribe(room: string, cb: (raw: object|null) => void): () => void,
 *     compact(room: string, uid: string, plan: { newO: number, keys: string[] }): Promise<{ok:boolean}>,
 *     removeMine(room: string, uid: string): Promise<{ok:boolean}>,
 *   },
 *   sync: { isOn(room: string): boolean, setOn(room: string, on: boolean): void },
 *   todayKey: () => string,
 *   notifyError: (code: string, err?: unknown) => void,
 * }} deps
 */
function createChatFocus(deps){
  const doc = deps.document;
  const escHtml = deps.escHtml;
  const toast = deps.toast;
  const getMyUserId = deps.getMyUserId;
  const roomCode = deps.roomCode;
  const roomState = deps.roomState;
  const provider = deps.provider;
  const sync = deps.sync;
  const todayKey = deps.todayKey;
  const notifyError = deps.notifyError;
  const changeFns = [];
  const onChange = (fn) => { changeFns.push(fn); };
  const changed = () => changeFns.forEach(f => f());

  let raw = {};
  let unsub = null;
  let subRoom = null;
  let loaded = false, loadFailed = false;
  let active = false;
  let metric = 'week';
  let delAsk = false;
  let compactedFor = '';   // 같은 합치기를 두 번 보내지 않게(구독이 여러 번 와도)

  const $ = (id) => doc.getElementById(id);
  const available = () => !!(roomState.isSecretCode(roomCode()) && roomCode());

  function paint(){
    const win = $('chatWindow');
    if(win) win.classList.toggle('focus-mode', active);
    const box = $('chatFocus'); if(!box) return;
    if(!active){ box.textContent = ''; return; }
    const room = roomCode();
    box.innerHTML = viewHtml(stats(raw, todayKey()), { on: sync.isOn(room), metric, delAsk, failed: loadFailed, loading: !loaded && !loadFailed, myId: getMyUserId() }, escHtml);
  }
  function maybeCompact(room){
    const me = getMyUserId(); if(!me || !raw || !raw[me]) return;
    const plan = compactPlan(raw[me], todayKey());
    if(!plan) return;
    const sig = room + '|' + plan.keys.join(',');
    if(sig === compactedFor) return;
    compactedFor = sig;
    provider.compact(room, me, plan).then(r => { if(!(r && r.ok)) compactedFor = ''; }).catch(() => { compactedFor = ''; });
  }
  function unsubscribe(){ if(unsub){ try{ unsub(); }catch(_){} unsub = null; } subRoom = null; }
  function subscribe(){
    const room = roomCode();
    if(!available()) return;
    if(unsub && subRoom === room) return;
    unsubscribe();
    subRoom = room; raw = {}; loaded = false; loadFailed = false; compactedFor = '';
    unsub = provider.subscribe(room, v => {
      if(v === null){ loadFailed = true; loaded = false; unsub = null; paint(); return; }   // 읽기 실패 — 구독은 이미 끊겼다(다음에 탭을 열 때 다시)
      loadFailed = false; loaded = true; raw = v;
      maybeCompact(room);
      paint();
    });
  }

  /* 창이 닫히거나 시크릿룸을 벗어나면 모두 놓는다 · 방이 바뀌면 보는 중이라도 새 방으로 다시 건다 */
  function stop(){
    unsubscribe();
    raw = {}; loaded = false; loadFailed = false; delAsk = false;
    if(active){ active = false; changed(); }
    paint();
  }
  function start(){
    if(!available()){ if(unsub || active) stop(); return; }
    if(active) subscribe();
    paint();
  }
  function open(){
    if(!available()) return;
    active = true; delAsk = false;
    subscribe(); paint(); changed();
    const inp = $('chatInput'); if(inp) setTimeout(() => inp.focus(), 0);
  }
  function close(){
    if(!active) return;
    active = false; delAsk = false;
    unsubscribe(); raw = {}; loaded = false; loadFailed = false;
    paint(); changed();
  }
  const isActive = () => active && available();
  const hint = () => '집중 기록 보기 — 글은 #일반 에서 써 주세요';
  /* 입력칸 Enter — #집중 탭에서는 쓸 곳이 없다. 처리했으면 true(채팅 전송 건너뜀). 친 글은 그대로 둔다. */
  function submit(){
    if(!isActive()) return false;
    toast('#집중 에서는 글을 쓸 수 없어요 — #일반 에서 이야기해요');
    return true;
  }

  function toggle(on){
    const room = roomCode(); if(!room) return;
    sync.setOn(room, on);
    paint();
  }
  async function wipe(){
    const room = roomCode(), me = getMyUserId(); if(!room || !me) return;
    delAsk = false;
    const r = await provider.removeMine(room, me).catch(() => null);
    if(!(r && r.ok)) notifyError('E-CHAT-02');
    else toast('내 집중 기록을 지웠어요');
    paint();
  }
  /* 단추 하나 — 화면 조각의 data-act 이름과 같다(검사가 직접 부른다) */
  function act(name, arg){
    if(name === 'toggle') toggle(!!arg);
    else if(name === 'metric'){ if(METRICS.indexOf(arg) >= 0){ metric = arg; paint(); } }
    else if(name === 'wipe'){ delAsk = true; paint(); }
    else if(name === 'wipeok') wipe();
    else if(name === 'cancel'){ delAsk = false; paint(); }
  }

  function bind(){
    const box = $('chatFocus'); if(!box) return;
    box.addEventListener('mousedown', e => e.stopPropagation());
    box.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('[data-act]'); if(!b) return;
      if(b.dataset.act === 'toggle') return;   // 체크칸은 change 로 받는다
      e.stopPropagation();
      act(b.dataset.act, b.dataset.m);
    });
    box.addEventListener('change', e => {
      const b = e.target; if(!(b && b.dataset && b.dataset.act === 'toggle')) return;
      act('toggle', b.checked);
    });
  }
  bind();

  return { start, stop, open, close, isActive, available, hint, submit, paint, onChange, act };
}

const api = Object.freeze({ FOCUS_TAB, FOCUS_TAB_NAME, KEEP_DAYS, METRICS, weekStartKey, addDays, stats, rank, compactPlan, fmtDur, viewHtml, createChatFocus });
if(typeof window !== 'undefined') window.TwChatFocus = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
