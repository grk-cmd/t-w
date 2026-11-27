/* xmas-letter.js — 🎄 마니또 편지 창(일회성 — 다음 업데이트에서 걷는다 · 이슈 #963) (검사 sim-xmas-letter.js)
   책임: 트리 창 아래 [편지 쓰기 (n/1)] · [편지 열람] 단추 · 그 위에 겹쳐 뜨는 편지 창(✕ · Esc) ·
     ✍️ 쓰기(12/24 23:59 까지 — 맡긴 편지 목록 · 수정 · 삭제(거두기) · 새 편지 · 반송된 편지의 사유 · 다시 쓰기 · 추천곡) ·
     📬 열람(12/25 부터 — 봉투 · 열기 · 추천곡 · 신고 · 읽음 표시) · 런처 [크리스마스] 빨간 점(안 읽은 받은 편지).
   서버는 net(xmas-api.js — 내 몫만 읽고 쓴다), 날짜 · 칸 규칙은 rules(TwXmasRules) · 날짜 한 벌은 schedule()(서버 값), 뮤직바는 song(TwXmasSong).
   ★ 받은 편지 · 추천곡 제목은 남이 쓴 값 — textContent 로만 넣는다.
   ★ 받은 편지는 다시 묻지 않는다(폴링 없음) — 편지 창을 열 때 한 번 · 알림함에 안 읽은 «받은 편지» 알림이 보이면 창(xmas-window)이 무작위로 기다렸다 checkGot 한 번.
     마감이 지났는데 짝 짓기 전(matched=false)이면 «배달하는 중» 을 그리고 기다린다(알림이 오면 읽는다). 계정이 바뀌면 앞 계정의 점을 지운다.
   ★ 읽음 표시는 이 PC(localStorage 'tw.xmasGotRead.{uid}' — 번호 몇 개)에만.
   classic script(window.TwXmasLetter) — xmas-window.js 보다 먼저 싣는다. xmas-window.js 가 `createXmasLetter(deps)` 한 번. */
(function(){
'use strict';

const READ_KEY = 'tw.xmasGotRead.';

/**
 * @param {{ doc?:Document, win?:Window, rules:any, net:()=>any, song:any, serverNow:()=>number, schedule:()=>any,
 *           toast:(msg:string)=>void, notifyError:(code:string, err?:any)=>void, escRegisterWindow:Function,
 *           storage:Storage|null, onDot:(on:boolean)=>void }} deps
 */
function createXmasLetter(deps){
  const doc = deps.doc || document;
  const rules = deps.rules;
  const net = deps.net;
  const serverNow = deps.serverNow;
  const schedule = deps.schedule;
  const toast = deps.toast;
  const notifyError = deps.notifyError;
  const $ = (id) => doc.getElementById(id);

  const lw = $('xmasLetter'), btn = $('xmasLetterBtn');
  if (!lw || !btn) throw new Error('xmas-letter: #xmasLetter · #xmasLetterBtn 이 html 에 없다');

  let letters = [], returned = [], got = [], editing = null, draftSong = null, openedN = null, busy = false, seq = 0, refSeq = 0;
  let viewing = null;   // 편지 창이 그리는 칸 'write' · 'got' · null
  let gotTrying = false, gen = 0;   // gen — 세션 reset 마다 올린다(앞 계정의 늦은 답을 버린다)

  /* ── 읽음 표시(이 PC) ── */
  const readKey = () => READ_KEY + (net().me() || '');
  function readSet(){
    try { const st = deps.storage; return rules.readSetOf(st ? st.getItem(readKey()) : ''); } catch (_) { return new Set(); }
  }
  function markRead(n){
    const set = readSet(); set.add(n);
    try { const st = deps.storage; if (st) st.setItem(readKey(), rules.readSetStr(set)); } catch (_) {}
    deps.onDot(rules.hasUnread(got, set));
  }

  /* ── 단추(트리 창 아래) ── */
  function paintBtn(){
    const now = serverNow(), s = schedule();
    if (rules.lettersArrived(now, s)){ btn.textContent = '편지 열람'; btn.hidden = false; }
    else if (rules.letterOpen(now, s)){ btn.textContent = '편지 쓰기 (' + letters.length + '/' + rules.LETTER_MAX + ')'; btn.hidden = false; }
    else btn.hidden = true;
    btn.classList.toggle('xm-dot', rules.lettersArrived(now, s) && rules.hasUnread(got, readSet()));
  }
  /** 트리 창을 열 때 — 쓰는 기간이면 맡긴 수(n/1)를 위해 내 편지함을 한 번 읽는다 */
  async function refresh(){
    if (rules.letterOpen(serverNow(), schedule())){
      const my = ++refSeq;
      const r = await net().myLetters();
      if (my !== refSeq || isOpen()) return;   // 편지 창이 열렸으면 그쪽이 읽은 값이 맞다
      if (r.ok){ letters = rules.myLettersOf(r.letters); returned = rules.returnedOf(r.returned); }
    }
    paintBtn();
  }

  /* ── 받은 편지 한 번 읽기(빨간 점) — 알림을 본 뒤 창이 부른다. 다시 묻지 않는다 ── */
  /** 받은 편지 한 번 읽기 → 읽었나(true) · 못 읽었나(false — 부른 쪽이 다음 알림에 다시) */
  async function checkGot(){
    if (gotTrying) return false;
    const my = gen;
    gotTrying = true;
    const r = await net().got();
    gotTrying = false;
    if (my !== gen) return false;   // 그 사이 세션이 끝났다(계정 바뀜) — 앞 계정의 답은 버린다
    if (!r.ok) return false;        // 실패는 «없음» 으로 굳히지 않는다
    got = rules.gotOf(r.got);
    deps.onDot(rules.hasUnread(got, readSet()));
    paintBtn();
    if (isOpen() && viewing === 'got' && openedN == null) drawGot(r.matched);   // 열어 둔 봉투 칸(«배달하는 중» 포함)도 새로 그린다 — 읽는 편지는 그대로
    return true;
  }

  /* ── 편지 창 ── */
  const songW = deps.song.bar($('xmasLwSong'), { editable: true, onChange: (s) => { draftSong = s; } });
  const songG = deps.song.bar($('xmasLwGotSong'), {});
  const isOpen = () => lw.classList.contains('on');
  function setState(text){ const el = $('xmasLwState'); el.textContent = text || ''; el.hidden = !text; }
  function show(view){
    $('xmasLwWrite').hidden = view !== 'write';
    $('xmasLwGot').hidden = view !== 'got';
  }

  /* ✍️ 쓰기 */
  function ddayText(){
    const d = rules.ddayLeft(serverNow(), schedule());
    return (d === 0 ? '오늘 마감' : '마감까지 D-' + d) + ' · 12월 24일 23:59';
  }
  function item(text, sub, acts){
    const row = doc.createElement('div'); row.className = 'xm-kitem';
    const s = doc.createElement('span'); s.className = 'xm-ks'; s.textContent = text;
    row.appendChild(s);
    if (sub){ const w = doc.createElement('span'); w.className = 'xm-kwhy'; w.textContent = sub; row.appendChild(w); }
    acts.forEach(([label, fn]) => {
      const b = doc.createElement('button'); b.type = 'button'; b.className = 'win98raised'; b.textContent = label;
      b.onclick = fn; row.appendChild(b);
    });
    return row;
  }
  const firstLine = (t) => t.split('\n').find(x => x.trim()) || t;
  function renderWrite(){
    $('xmasLwCnt').textContent = letters.length + '/' + rules.LETTER_MAX;
    $('xmasLwDday').textContent = ddayText();
    const ret = $('xmasLwRet'); ret.textContent = '';
    returned.forEach(r => ret.appendChild(item('반송됨 · ' + firstLine(r.text), '사유: ' + r.why + ' · 고쳐서 다시 써 주세요', [
      ['다시 쓰기', () => edit({ lid: null, retLid: r.lid, text: r.text, song: r.song })],
      ['지우기', () => dismiss(r.lid)],
    ])));
    const list = $('xmasLwList'); list.textContent = '';
    letters.forEach((l, i) => list.appendChild(item((letters.length > 1 ? (i + 1) + '번째 편지' : '맡긴 편지') + ' · ' + firstLine(l.text), '', [
      ['수정', () => edit({ lid: l.lid, retLid: null, text: l.text, song: l.song })],
      ['삭제', () => withdraw(l.lid)],
    ])));
    const full = letters.length >= rules.LETTER_MAX;
    if (!editing && !letters.length && !returned.length){
      editing = { lid: null, retLid: null, fresh: true };   // 처음엔 바로 편지지를 편다
      $('xmasLwText').value = ''; draftSong = null; songW.set(null); checkText();
    }
    $('xmasLwEdit').hidden = !editing;
    $('xmasLwCancel').hidden = !editing || !!editing.fresh;
    $('xmasLwNewRow').hidden = !!editing || full;
    paintBtn();
  }
  function edit(e){
    if (!e.lid && letters.length >= rules.LETTER_MAX){ toast('편지는 ' + rules.LETTER_MAX + '통까지 맡길 수 있어요.'); return; }
    editing = { lid: e.lid, retLid: e.retLid };
    $('xmasLwText').value = e.text || '';
    draftSong = e.song || null; songW.set(draftSong);
    checkText(); renderWrite(); $('xmasLwText').focus();
  }
  function checkText(){
    const v = $('xmasLwText').value;
    $('xmasLwN').textContent = String(v.length);
    $('xmasLwKeep').disabled = busy || !rules.cleanLetter(v);
  }
  /** 쓰기 실패 — 마감 · 로그인 · 다른 PC 가 먼저 고침 · 서버 바쁨은 안내, 그 밖은 오류 코드 */
  function writeFailed(r){
    if (r.code === 'closed'){ toast('편지 마감이 지났어요.'); loadView(); return; }
    if (r.code === 'conflict'){ toast('다른 PC 에서 먼저 바꿨어요. 편지함을 다시 불러올게요.'); editing = null; songW.set(null); loadView(); return; }
    if (r.code === 'aborted'){ toast('서버가 바빠요. 잠시 뒤 다시 눌러 주세요.'); return; }
    if (r.code === 'auth'){ toast('로그인한 뒤 편지를 쓸 수 있어요.'); return; }
    notifyError('E-XMAS-05', r.err);
  }
  async function keep(){
    const text = rules.cleanLetter($('xmasLwText').value);
    if (!text || busy || !editing) return;
    const lid = editing.lid || rules.freeLetterId(letters);
    if (!lid){ toast('편지는 ' + rules.LETTER_MAX + '통까지 맡길 수 있어요.'); return; }
    const retLid = editing.retLid;
    busy = true; checkText();
    const g = gen;
    const r = await net().saveLetter(lid, text, draftSong, retLid);   // 반송된 편지면 서버가 같은 트랜잭션에서 반송 기록을 지운다
    busy = false; checkText();
    if (g !== gen) return;   // 그 사이 세션이 끝났다 — 앞 계정 답으로 그리거나 다시 읽지 않는다
    if (!r.ok){ writeFailed(r); return; }
    editing = null; songW.set(null);
    toast('편지를 맡겼어요. 25일 0시에 전달돼요.');
    await loadView();
  }
  async function withdraw(lid){
    if (busy) return;
    busy = true;
    const g = gen;
    const r = await net().removeLetter(lid);
    busy = false;
    if (g !== gen) return;   // 그 사이 세션이 끝났다 — 앞 계정 답으로 그리거나 다시 읽지 않는다
    if (!r.ok){ writeFailed(r); return; }
    if (editing && editing.lid === lid){ editing = null; songW.set(null); }
    toast('편지를 삭제했어요. 마감 전까지 다시 쓸 수 있어요.');
    await loadView();
  }
  async function dismiss(lid){
    if (busy) return;
    busy = true;
    const g = gen;
    const r = await net().clearReturned(lid);
    busy = false;
    if (g !== gen) return;   // 그 사이 세션이 끝났다 — 앞 계정 답으로 그리거나 다시 읽지 않는다
    if (!r.ok){ writeFailed(r); return; }
    if (editing && editing.retLid === lid) editing = null;
    await loadView();
  }
  $('xmasLwText').addEventListener('input', checkText);
  $('xmasLwKeep').onclick = keep;
  $('xmasLwCancel').onclick = () => { editing = null; songW.set(null); renderWrite(); };
  $('xmasLwNew').onclick = () => edit({ lid: null, retLid: null, text: '', song: null });

  /* 📬 열람 */
  function renderGot(){
    const has = got.length > 0;
    $('xmasLwNone').hidden = has;
    $('xmasLwEnvBox').hidden = !has || openedN != null;
    $('xmasLwOpened').hidden = openedN == null;
    if (!has) return;
    const set = readSet();
    $('xmasLwGotCnt').textContent = got.length + '통';
    const box = $('xmasLwEnvs'); box.textContent = '';
    got.forEach((g, i) => {
      const b = doc.createElement('button'); b.type = 'button';
      b.className = 'xm-env' + (set.has(g.n) ? ' read' : ' new');
      const bx = doc.createElement('span'); bx.className = 'xm-envbox';
      const seal = doc.createElement('span'); seal.className = 'xm-seal'; seal.textContent = '♥';
      bx.appendChild(seal);
      const t = doc.createElement('span'); t.className = 'xm-envt'; t.textContent = (i + 1) + '번째 편지' + (set.has(g.n) ? ' · 읽음' : '');
      b.appendChild(bx); b.appendChild(t);
      b.onclick = () => openLetter(g);
      box.appendChild(b);
    });
  }
  function openLetter(g){
    openedN = g.n;
    $('xmasLwGotText').textContent = g.text;
    $('xmasLwGotSongRow').hidden = !g.song;
    songG.set(g.song);
    markRead(g.n);
    renderGot();
  }
  $('xmasLwBack').onclick = () => { openedN = null; songG.set(null); renderGot(); };
  /* 신고는 이벤트 끝(1/1 0시)에 막힌다 — 받은 편지는 1/5 까지 보이므로 여기서 안내로 끝낸다(서버도 거절 · 오류 번호 아님) */
  const REPORT_ENDED = '크리스마스 이벤트가 끝나 신고할 수 없어요.';
  $('xmasLwReport').onclick = () => {
    if (!rules.eventOn(serverNow(), schedule())){ toast(REPORT_ENDED); return; }
    $('xmasLwRep').hidden = false; $('xmasLwRepNo').focus();
  };
  $('xmasLwRepNo').onclick = () => { $('xmasLwRep').hidden = true; };
  $('xmasLwRepYes').onclick = async () => {
    $('xmasLwRep').hidden = true;
    if (openedN == null) return;
    if (!rules.eventOn(serverNow(), schedule())){ toast(REPORT_ENDED); return; }   // 확인창을 연 채 끝을 넘긴 때
    const g = gen;
    const r = await net().reportLetter(openedN);
    if (g !== gen) return;   // 그 사이 세션이 끝났다 — 앞 계정 답으로 그리거나 다시 읽지 않는다
    if (r.ok) toast('신고했어요. 관리자가 확인할게요.');
    else if (r.code === 'dup') toast('이미 신고한 편지예요.');
    else if (r.code === 'auth') toast('로그인한 뒤 신고할 수 있어요.');
    else if (r.code === 'failed-precondition') toast(REPORT_ENDED);   // 서버 시각으로 이벤트가 끝났다(XMAS_ENDED)
    else if (r.code === 'gone') toast('이미 없는 편지예요.');       // 관리자가 지웠다(XMAS_RECEIVED_NOT_FOUND)
    else notifyError('E-XMAS-06', r.err);
  };

  /* 창 열기 · 불러오기 — 날짜로 쓰기 / 열람을 고른다 */
  async function loadView(){
    const my = ++seq;
    const now = serverNow(), s = schedule();
    const view = rules.lettersArrived(now, s) ? 'got' : rules.letterOpen(now, s) ? 'write' : null;
    if (!view){ close(); return; }
    $('xmasLwT').textContent = view === 'write' ? '✉️ 마니또 편지 쓰기' : '✉️ 받은 편지';
    show(null); setState('편지를 불러오는 중…');
    const r = view === 'write' ? await net().myLetters() : await net().got();
    if (my !== seq || !isOpen()) return;
    if (!r.ok){
      if (r.code === 'auth'){ setState('로그인한 뒤 편지를 쓰고 받을 수 있어요.'); return; }
      setState('편지를 불러오지 못했어요.'); notifyError('E-XMAS-04', r.err); return;
    }
    setState('');
    if (view === 'write'){ viewing = 'write'; letters = rules.myLettersOf(r.letters); returned = rules.returnedOf(r.returned); show('write'); renderWrite(); }
    else {
      got = rules.gotOf(r.got);
      deps.onDot(rules.hasUnread(got, readSet()));
      drawGot(r.matched);
    }
  }
  /** 열람 칸 그리기 — 짝 짓기 전(matched=false)이고 받은 편지가 없으면 «배달하는 중»(다시 묻지 않는다 · 알림이 오면 checkGot 이 다시 그린다) */
  function drawGot(matched){
    viewing = 'got';
    if (!got.length && matched === false){ show(null); setState('편지를 배달하는 중이에요. 도착하면 알림함에 알려 드릴게요.'); paintBtn(); return; }
    setState(''); show('got'); renderGot();
  }
  function open(){
    if (isOpen()) return;
    editing = null; openedN = null; draftSong = null;
    lw.classList.add('on');
    loadView();
  }
  function close(){
    if (!isOpen()) return;
    seq++; viewing = null;
    deps.song.stop();
    songW.set(null); songG.set(null);
    $('xmasLwRep').hidden = true;
    lw.classList.remove('on');
    paintBtn();
  }
  btn.onclick = open;
  $('xmasLwX').onclick = close;
  deps.escRegisterWindow({ key: 'xmasLetter', el: lw, isOpen, close });

  /** 세션이 끝나면(로그아웃 · 계정 바뀜) — 창을 닫고 앞 계정의 편지 · 받은 편지 · 빨간 점을 버린다 */
  function reset(){
    close();
    gen++; seq++; refSeq++;
    letters = []; returned = []; got = []; editing = null; openedN = null; draftSong = null; gotTrying = false; busy = false;
    deps.onDot(false);
    paintBtn();
  }

  return { open, close, isOpen, refresh, checkGot, paintBtn, reset };
}

const api = Object.freeze({ createXmasLetter });
if (typeof window !== 'undefined') window.TwXmasLetter = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
