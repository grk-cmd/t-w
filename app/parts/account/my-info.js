/* my-info.js — 🪪 [내 정보] 화면 — 머리(사진 · 닉네임 · 레벨 별 색) · 🏆 전체 랭킹 · 보관함 · 휴지통 · 계정 탭 연결
   app.js «🪪 [내 정보] — 런처 화면 전환» · «🏆 [내 정보] 전체 랭킹 1~100위» 두 구역의 본문을 그대로 옮긴 모듈이다(앱 FSD 17번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다. 두 구역은 한 화면([내 정보] 페이지 — 머리 · 별 색 · 보관함 · 휴지통 · 이름 바꾸기 · 랭킹)이라 한 파일에 둔다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도 · 덩이 2개를 원래 차례로 · 사이에 빈 줄 하나). 바뀐 줄은 15줄 —
     CHARS_BOX_MAX · EXP_CELLS · EXP_SEC_PER_CELL · EXP_SEC_PER_LEVEL · FOCUS_CYCLE_SEC · FOCUS_LEVEL_CAP_HOURS · STAR_PALETTE · _acctDetached · _focusTotalSec · _myHomeData · curSlot 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다). 대입은 setCurSlot(…).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 36개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: _charsLinkedMaybeShow · _lbPush · _miIsOpen · _miSlotThumb · closeMyInfo · openMyInfo — app.js 는 myInfoMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwMyInfo — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-my-info.js */
(function(){

function createMyInfo(deps){
const CHARS_BOX_MAX = deps.CHARS_BOX_MAX;   // 읽는 함수
const EXP_CELLS = deps.EXP_CELLS;   // 읽는 함수
const EXP_SEC_PER_CELL = deps.EXP_SEC_PER_CELL;   // 읽는 함수
const EXP_SEC_PER_LEVEL = deps.EXP_SEC_PER_LEVEL;   // 읽는 함수
const FOCUS_CYCLE_SEC = deps.FOCUS_CYCLE_SEC;   // 읽는 함수
const FOCUS_LEVEL_CAP_HOURS = deps.FOCUS_LEVEL_CAP_HOURS;   // 읽는 함수
const MY_FRIEND_CODE_KEY = deps.MY_FRIEND_CODE_KEY;
const _acctRelaunchAfterDetach = deps._acctRelaunchAfterDetach;   // 🪪 신원을 놓은 뒤 앱 다시 켜기(account-state.js)
const CHARS_LINKED_KEY = deps.CHARS_LINKED_KEY;   // «연동됨» 안내 표시 — 계정(account.js)이 옮길 때 적는다
const charsMod = deps.charsMod;   // 읽는 함수
const MY_USER_ID_KEY = deps.MY_USER_ID_KEY;
const STAR_PALETTE = deps.STAR_PALETTE;   // 읽는 함수
const USER_NAME_MAX = deps.USER_NAME_MAX;
const _acctDetached = deps._acctDetached;   // 읽는 함수
const _charsActive = deps._charsActive;
const _charsBoxGet = deps._charsBoxGet;
const _charsBoxOnlyCount = deps._charsBoxOnlyCount;
const _charsBoxToDesk = deps._charsBoxToDesk;
const _charsBoxTrash = deps._charsBoxTrash;
const _charsBoxTrashMany = deps._charsBoxTrashMany;
const _charsCachedUid = deps._charsCachedUid;
const _charsDeleteWords = deps._charsDeleteWords;
const _charsDeskGet = deps._charsDeskGet;
const _charsIsTomb = deps._charsIsTomb;
const _charsMoveMsg = deps._charsMoveMsg;
const _charsRestore = deps._charsRestore;
const _charsSync = deps._charsSync;
const _charsTrashView = deps._charsTrashView;
const _focusTotalSec = deps._focusTotalSec;   // 읽는 함수
const _licenseSnapForPush = deps._licenseSnapForPush;
const _loginDoGoogle = deps._loginDoGoogle;
const _loginDoLogout = deps._loginDoLogout;
const _loginDoDeleteAccount = deps._loginDoDeleteAccount;
const _myHomeData = deps._myHomeData;   // 읽는 함수
const _pushLevelIfChanged = deps._pushLevelIfChanged;
const _slotsNow = deps._slotsNow;
const closeGearMenu = deps.closeGearMenu;
const commitUserName = deps.commitUserName;
const curSlot = deps.curSlot;   // 읽는 함수
const focusCycleOf = deps.focusCycleOf;
const getDisplayName = deps.getDisplayName;
const getFocusLevel = deps.getFocusLevel;
const getMyLoginEmail = deps.getMyLoginEmail;
const getMyUserId = deps.getMyUserId;
const getStarColor = deps.getStarColor;
const getUserName = deps.getUserName;
const lvStarStr = deps.lvStarStr;
const myFocusShow = deps.myFocusShow;
const openCodeModal = deps.openCodeModal;
const plMod = deps.plMod;
const refreshAccountTab = deps.refreshAccountTab;
const renderLauncher = deps.renderLauncher;
const saveCurSlot = deps.saveCurSlot;
const setStarColor = deps.setStarColor;
const slots = deps.slots;
const toast = deps.toast;
const setCurSlot = deps.setCurSlot;   // 쓰는 함수
const MI_IMG_OK = /^(data:image\/|https?:)/i;
let _miTab = 'box', _miBusy = false;
let _miBoxAsk = null, _miTrashRows = null, _miTrashErr = false, _miTrashFullShown = false;   // 🗑️ 개정 49
const _miPick = new Set(); let _miBulkAsk = false;                                              // 🧺 D2 가득 참 — 고른 것 · 되묻기(개정 51)
function openMyInfo(tab){
  const pg = document.getElementById('lcMyInfo'); if(!pg) return;
  try{ closeGearMenu(); }catch(_){}
  pg.style.display = 'block'; pg.scrollTop = 0;
  _miNameEditEnd();
  _miStarOpen = false;                              // 🌟 별 색 구획은 열 때마다 닫힌 채 시작한다(시안 v2 · 개정 69)
  _miRenderHead();
  _miSetTab(tab);
  _miTrashLoad();                                   // 휴지통 탭 글자 «휴지통 N» — 보관함이 열린 PC 에서만 읽는다
}
function closeMyInfo(){
  const pg = document.getElementById('lcMyInfo'); if(!pg) return;
  _miNameEditEnd();
  _miBoxAsk = null; _miTrashFullShown = false; _miPick.clear(); _miBulkAsk = false;
  _miStarOpen = false;
  pg.style.display = 'none';
  try{ renderLauncher(); }catch(_){}
}
function _miIsOpen(){ const pg = document.getElementById('lcMyInfo'); return !!(pg && pg.style.display !== 'none'); }
function _miSetTab(tab){
  const $e = id => document.getElementById(id);
  const trashOn = _miTrashOn();
  _miTab = (tab === 'acct' || (tab === 'trash' && trashOn)) ? tab : 'box';
  const tt = $e('miTabTrash'); if(tt) tt.style.display = trashOn ? '' : 'none';
  const pg = $e('lcMyInfo'); if(pg) pg.classList.toggle('mi-noscroll', _miTab === 'acct');   // 계정 탭은 스크롤바 숨김(개정 53)   // 휴지통 탭 = 보관함이 열려야(스위치 · 첫 채택 뒤)
  const pb = $e('miPageBox'), pa = $e('miPageAcct'), pt = $e('miPageTrash');
  if(pb) pb.style.display = _miTab === 'box' ? 'block' : 'none';
  if(pa) pa.style.display = _miTab === 'acct' ? 'block' : 'none';
  if(pt) pt.style.display = _miTab === 'trash' ? 'block' : 'none';
  [['miTabBox','box'], ['miTabTrash','trash'], ['miTabAcct','acct']].forEach(([id, k]) => {
    const b = $e(id); if(!b) return;
    const on = k === _miTab;
    b.style.background = on ? '#fff' : 'var(--win-face)';
    b.style.borderColor = on ? 'var(--win-lo) var(--win-hi) var(--win-hi) var(--win-lo)' : 'var(--win-hi) var(--win-lo-2) var(--win-lo-2) var(--win-hi)';
    b.style.boxShadow = on ? 'inset 1px 1px 0 #000' : 'inset -1px -1px 0 var(--win-lo),inset 1px 1px 0 var(--win-face-2)';
    b.style.fontWeight = on ? 'bold' : 'normal';
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  if(_miTab === 'acct'){ try{ refreshAccountTab(); }catch(_){} }
  else if(_miTab === 'trash') _miRenderTrash();
  else _miRenderBox();
}

const LB_TOP_N = 100, LB_CACHE_MS = 60*1000;
/* 순수 — rows: [{uid, sec, ts}] → 내 순위(1~100) | null */
function rankOf(rows, uid){
  if(!Array.isArray(rows) || !uid) return null;
  const ok = rows.filter(r => r && typeof r.uid === 'string' && isFinite(Number(r.sec)));
  const tsOf = r => { const t = Number(r.ts); return (isFinite(t) && t > 0) ? t : Infinity; };
  ok.sort((a, b) => (Number(b.sec) - Number(a.sec)) || (tsOf(a) - tsOf(b)) || (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
  const i = ok.slice(0, LB_TOP_N).findIndex(r => r.uid === uid);
  return i < 0 ? null : i + 1;
}
/* 순수 — 순위 → 보일 모양. null = 자리 비움. 1~3위는 메달 + 큰 글자 · 1위만 왕관·후광. */
function rankLabel(rank){
  const n = Number(rank);
  if(!Number.isInteger(n) || n < 1 || n > LB_TOP_N) return null;
  const MED = { 1:'🥇', 2:'🥈', 3:'🥉' };
  return { text: (MED[n] ? MED[n] + ' ' : '') + n + '위', top: n <= 3, crown: n === 1 };
}
let _lbSent = null;              // {uid, sec} — 이번 부팅에서 올렸거나 서버와 같다고 확인한 값(같으면 다시 안 부름)
let _miRankCache = null;         // {uid, at, rank}
let _miRankSeq = 0;
function _lbPush(uid, sec){
  if(!uid || !(window.firebaseAPI && firebaseAPI.setLeaderboardSec)) return;
  const v = Math.floor(Number(sec) || 0);
  if(_lbSent && _lbSent.uid === uid && _lbSent.sec === v) return;
  const p = firebaseAPI.setLeaderboardSec(uid, v);
  if(p && p.then) p.then(r => {
    if(!r || !r.ok) return;                                   // 다음 동기화가 다시 시도한다
    _lbSent = { uid, sec: v };
    if(!r.same) _miRankCache = null;                          // 내 값이 바뀌었다 — 다음에 열 때 새로 읽는다
  }).catch(()=>{});
}
function _miApplyRank(rank){
  const $e = id => document.getElementById(id);
  const L = rankLabel(rank);
  const box = $e('miRank'), v = $e('miRankV');
  if(box) box.style.display = L ? '' : 'none';
  if(v){ v.textContent = L ? L.text : ''; v.classList.toggle('top', !!(L && L.top)); }
  const halo = $e('miHalo'), crown = $e('miCrown');
  if(halo) halo.style.display = (L && L.crown) ? '' : 'none';
  if(crown) crown.style.display = (L && L.crown) ? '' : 'none';
  const bar = $e('miTopBar'); if(bar) bar.style.marginBottom = (L && L.crown) ? '22px' : '8px';   // 후광이 사진 위로 삐져나오는 만큼 — 1위일 때만
}
/* 🌐 내 순위 — API 한 줄(fetchMyRank) 먼저, 못 받으면(undefined) 예전처럼 100줄 받아 rankOf. 실패 = undefined. */
async function _lbFetchRank(uid){
  if(firebaseAPI.fetchMyRank){ const r = await firebaseAPI.fetchMyRank(uid); if(r !== undefined) return r; }
  const rows = await firebaseAPI.fetchLeaderboardTop();
  return Array.isArray(rows) ? rankOf(rows, uid) : undefined;
}
function _miRenderRank(){
  let uid = null; try{ uid = (typeof _acctDetached() !== 'undefined' && _acctDetached()) ? null : getMyUserId(); }catch(_){}
  const c = _miRankCache;
  const same = !!(c && uid && c.uid === uid);
  _miApplyRank(same ? c.rank : null);                        // 같은 계정이면 옛 값을 먼저 그대로(깜빡임 없음)
  if(!uid || !(window.firebaseAPI && firebaseAPI.fetchLeaderboardTop)) return;
  if(same && Date.now() - c.at < LB_CACHE_MS) return;
  const seq = ++_miRankSeq;
  let p; try{ p = _lbFetchRank(uid); }catch(_){ p = null; }
  if(!(p && p.then)) return;
  p.then(rank => {
    if(seq !== _miRankSeq) return;
    if(rank === undefined){ _miRankCache = null; if(_miIsOpen()) _miApplyRank(null); return; }   // 실패 — 조용히 비움
    _miRankCache = { uid, at: Date.now(), rank };
    if(_miIsOpen()) _miApplyRank(rank);
  }).catch(() => { if(seq === _miRankSeq && _miIsOpen()) _miApplyRank(null); });
}
function _miRenderHead(){
  const $e = id => document.getElementById(id);
  const nick = $e('miNick'); if(nick){ let n = ''; try{ n = getDisplayName(); }catch(_){} nick.textContent = n; }
  /* 🏅 레벨 배지 — 친구 목록 배지와 **같은 함수**(plMod.fillLv → .mh-flv + lvBadgeClass). 모양·티어 색을 여기서 따로 만들지 않는다. */
  const lv = $e('miLv'); if(lv){ let n = 1, st = null; try{ n = getFocusLevel(); st = myFocusShow(); }catch(_){} plMod.fillLv(lv, n, st); }
  const code = $e('miCode'); if(code){ let c = null; try{ c = localStorage.getItem(MY_FRIEND_CODE_KEY); }catch(_){} code.textContent = c || '—'; }
  const p = _miRenderAvatar(); if(p && p.catch) p.catch(()=>{});
  _miRenderStar();                                  // 🌟 별 색 구획 — 이름표 미리보기에 닉네임이 들어간다(개정 69)
  _miRenderRank();                                  // 🏆 전체 랭킹 — 비동기 · 60초 캐시 · 실패하면 비움(개정 73)
}
/* 🌟 별 색 구획 (시안 v2 확정 · 2026-09-23 · CHECKS 개정 69) — 머리의 레벨 배지(#miLvBtn)를 누르면 머리 아래에 열린다.
     · 999시간 전: 잠긴 상자 — «N시간 남았어요» + 막대. 배지를 누를 이유가 999 전에도 생긴다.
     · 회차: 왼쪽 실제 이름표(별 + 이번 바퀴 레벨 + 닉네임)·바 미리보기, 오른쪽 16칸. 누르면 바로 저장되고 미리보기가 바뀐다.
   ★ --pre-c 는 #miStar 한 곳에 얹는다 — 이름표 별과 바의 공통 조상이다(두 군데 칠하면 언젠가 한쪽만 바뀐다).
   ★ 색 칸은 DOM 으로 만들고 색은 CSS 변수(--sw)로만 넣는다 — 속성 문자열 보간 없음. */
let _miStarOpen = false;
function _miStarToggle(){ _miStarOpen = !_miStarOpen; _miRenderStar(); }
function _miRenderStar(){
  const $e = id => document.getElementById(id);
  const sec = $e('miStar'), btn = $e('miLvBtn'); if(!sec) return;
  if(btn) btn.setAttribute('aria-expanded', _miStarOpen ? 'true' : 'false');
  sec.style.display = _miStarOpen ? 'block' : 'none';
  if(!_miStarOpen) return;
  const total = Math.max(0, Number(_focusTotalSec()) || 0);
  const c = focusCycleOf(total);
  const on = $e('miStarOn'), lock = $e('miStarLock'), sub = $e('miStarSub');
  if(c.cycle > 0){
    if(on) on.style.display = 'flex';
    if(lock) lock.style.display = 'none';
    if(sub) sub.textContent = c.cycle + '회차 · 이름표 별과 바가 같이 바뀌어요';
    const col = getStarColor();
    sec.style.setProperty('--pre-c', col);
    let nick = ''; try{ nick = getDisplayName(); }catch(_){}
    const st = $e('miStarNpStar'), tx = $e('miStarNpText'), fill = $e('miStarFill');
    if(st) st.textContent = lvStarStr(c.cycle);
    if(tx) tx.textContent = c.lv + ' ' + nick;
    if(fill) fill.style.width = (Math.floor((total % EXP_SEC_PER_LEVEL()) / EXP_SEC_PER_CELL()) / EXP_CELLS() * 100) + '%';
    const pal = $e('miStarPal');
    if(pal){
      if(!pal.children.length){
        STAR_PALETTE().forEach(([hex, name]) => {
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'mi-star-sw'; b.setAttribute('role', 'radio');
          b.setAttribute('aria-label', name); b.title = name; b.dataset.c = hex;
          b.style.setProperty('--sw', hex);
          b.onclick = () => { if(!setStarColor(hex)) return; _miRenderHead(); _pushLevelIfChanged(); };   // 머리 배지 · 구획 · 프로필(친구 목록) · 방은 좌석 루프가 다음 프레임에
          pal.appendChild(b);
        });
      }
      [...pal.children].forEach(b => b.setAttribute('aria-checked', b.dataset.c === col ? 'true' : 'false'));
    }
  } else {
    if(on) on.style.display = 'none';
    if(lock) lock.style.display = 'flex';
    let lv = 1; try{ lv = getFocusLevel(); }catch(_){}
    if(sub) sub.textContent = 'Lv.' + lv + ' / ' + FOCUS_LEVEL_CAP_HOURS();
    const left = $e('miStarLeft'), meter = $e('miStarMeter');
    if(left) left.textContent = Math.max(1, Math.ceil(c.leftSec / 3600)).toLocaleString('ko-KR') + '시간 남았어요';
    if(meter) meter.style.width = Math.min(100, Math.floor(total / FOCUS_CYCLE_SEC() * 100)) + '%';
  }
}
/* 마이홈 프로필 사진(mhAvatarBig 과 같은 값) — 채팅 창 _refreshChatProfile 과 같은 순서: 마이홈 캐시 → 서버 한 번. */
async function _miRenderAvatar(){
  const img = document.getElementById('miAvatarImg'), ph = document.getElementById('miAvatarPh');
  let av = (typeof _myHomeData() !== 'undefined' && _myHomeData() && _myHomeData().avatar) ? _myHomeData().avatar : null;
  if(!av && window.firebaseAPI && firebaseAPI.getMyHome){
    try{
      const data = (firebaseAPI.fetchAvatar ? { avatar: await firebaseAPI.fetchAvatar(getMyUserId()) } : await firebaseAPI.getMyHome(getMyUserId())) || {};   // 사진 한 칸만(home 통째 아님)
      if(data.avatar){ av = data.avatar; if(typeof _myHomeData() !== 'undefined' && _myHomeData()) _myHomeData().avatar = data.avatar; }
    }catch(_){}
  }
  const ok = !!av && MI_IMG_OK.test(String(av));
  if(img){ if(ok) img.src = av; img.style.display = ok ? 'block' : 'none'; }
  if(ph) ph.style.display = ok ? 'none' : 'block';
}
function _miNameEditStart(){
  const $e = id => document.getElementById(id);
  const row = $e('miNameRow'), ed = $e('miNameEditRow'), inp = $e('miNameInput'); if(!row || !ed || !inp) return;
  let n = ''; try{ n = getUserName(); }catch(_){}
  inp.maxLength = USER_NAME_MAX;
  inp.value = (n === '나') ? '' : n;
  row.style.display = 'none'; ed.style.display = 'flex';
  try{ inp.focus(); inp.select(); }catch(_){}
}
function _miNameEditEnd(){
  const row = document.getElementById('miNameRow'), ed = document.getElementById('miNameEditRow');
  if(row) row.style.display = 'flex'; if(ed) ed.style.display = 'none';
}
function _miNameSave(){
  const inp = document.getElementById('miNameInput'); if(!inp) return;
  commitUserName(inp.value);   // ★ 저장 입구는 이것 하나(결정 7)
  _miNameEditEnd(); _miRenderHead();
}
function _miCopyCode(){
  let c = null; try{ c = localStorage.getItem(MY_FRIEND_CODE_KEY); }catch(_){}
  if(!c){ toast('친구 코드가 아직 없어요'); return; }
  const done = () => toast('친구 코드를 복사했어요');
  try{
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(c).then(done, () => toast('복사하지 못했어요'));
    else toast('복사하지 못했어요');
  }catch(_){ toast('복사하지 못했어요'); }
}
function _miSlotThumb(def){
  if(!def) return null;
  for(const v of [def.thumbUrl, def.thumb, def.faceUrl, def._faceUrl, def.face]){
    if(typeof v === 'string' && MI_IMG_OK.test(v)) return v;
  }
  return null;
}
/* 보관함에 든 항목 — 슬롯 표 밖의 산 항목만, 최근 고친 것부터. */
function _miBoxItems(){
  if(!_charsActive()) return null;
  const box = _charsBoxGet(), on = new Set(_charsDeskGet().filter(Boolean)), out = [];
  for(const cid in box){
    const e = box[cid];
    if(!e || _charsIsTomb(e) || on.has(cid)) continue;
    let def = null; try{ def = typeof e.def === 'string' ? JSON.parse(e.def) : null; }catch(_){}
    out.push({ cid, mtime: Number(e.mtime) || 0, def });
  }
  out.sort((a, b) => b.mtime - a.mtime);
  return out;
}
function _miRenderBox(){
  const $e = id => document.getElementById(id);
  const list = $e('miBoxList'), empty = $e('miBoxEmpty'), cnt = $e('miBoxCount'); if(!list) return;
  const items = _miBoxItems();
  list.innerHTML = '';
  if(cnt) cnt.textContent = (items ? items.length : 0) + '/' + CHARS_BOX_MAX();
  const full = _miRenderBoxFull(items);
  if(!items || !items.length){
    if(empty){
      empty.style.display = 'block';
      empty.textContent = !items
        ? '보관함은 계정 연동이 끝나면 열려요. 로그인한 채로 잠시 기다려 주세요.'
        : '보관함이 비어 있어요. 런처 톱니의 [보관함 이동]으로 넣은 캐릭터가 여기 들어와요.';
    }
    return;
  }
  if(empty) empty.style.display = 'none';
  for(const it of items){
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:7px;padding:4px 5px;background:#fff;border:1px solid;border-color:var(--win-lo-2) var(--win-hi) var(--win-hi) var(--win-lo-2);';
    if(full){                                                                   // D2 — 줄마다 체크칸(한꺼번에 휴지통으로)
      const ck = document.createElement('input');
      ck.type = 'checkbox'; ck.checked = _miPick.has(it.cid); ck.setAttribute('aria-label', '고르기');
      ck.style.cssText = 'flex:none;margin:0;';
      ck.onchange = () => { if(ck.checked) _miPick.add(it.cid); else _miPick.delete(it.cid); _miBulkAsk = false; _miRenderBox(); };
      row.appendChild(ck);
    }
    const th = document.createElement('div');
    th.style.cssText = 'width:34px;height:34px;flex:none;display:flex;align-items:center;justify-content:center;background:var(--win-select-bg);overflow:hidden;';
    const src = _miSlotThumb(it.def);
    if(src){ const im = document.createElement('img'); im.src = src; im.alt = ''; im.draggable = false; im.style.cssText = 'width:100%;height:100%;object-fit:contain;'; th.appendChild(im); }
    else { th.textContent = '🙂'; th.style.fontSize = '18px'; }
    const tx = document.createElement('span');
    tx.style.cssText = 'flex:1;min-width:0;font-size:10.5px;color:var(--ink-soft);';
    const d = new Date(it.mtime);
    tx.textContent = it.mtime ? ('마지막 수정 ' + (d.getMonth() + 1) + '/' + d.getDate()) : '';
    const up = document.createElement('button');
    up.type = 'button'; up.className = 'lc-btn'; up.textContent = '슬롯에 올리기';
    up.style.cssText = 'width:auto;margin:0;padding:3px 8px;font-size:10.5px;flex:none;';
    up.onclick = () => _miBoxUp(it.cid, up);
    if(_miBulkAsk) up.disabled = true;                                           // 한꺼번에 옮기기를 묻는 동안
    /* 🗑️ [휴지통 이동] — 시안 D2 의 붉은 아이콘을 줄마다. 되묻기는 그 줄 안에서(한 번에 한 줄). */
    const tb = document.createElement('button');
    tb.type = 'button'; tb.setAttribute('aria-label', '휴지통 이동'); tb.title = '휴지통 이동';
    tb.style.cssText = 'flex:none;background:none;border:0;padding:2px 3px;margin:0;cursor:pointer;line-height:0;';
    tb.appendChild(_miTrashIcon(14));
    tb.onclick = () => { _miBoxAsk = (_miBoxAsk === it.cid) ? null : it.cid; _miBulkAsk = false; _miRenderBox(); };
    row.appendChild(th); row.appendChild(tx); row.appendChild(up); row.appendChild(tb);
    if(_miBoxAsk === it.cid){
      row.style.flexWrap = 'wrap'; row.style.borderColor = '#B22222';
      up.disabled = true;
      const q = document.createElement('div');
      q.style.cssText = 'width:100%;font-size:10.5px;color:#B22222;margin-top:2px;';
      q.textContent = _charsDeleteWords().ask;
      const bar = document.createElement('div');
      bar.style.cssText = 'width:100%;display:flex;gap:4px;justify-content:flex-end;';
      const yes = document.createElement('button'), no = document.createElement('button');
      yes.type = no.type = 'button'; yes.className = no.className = 'lc-btn';
      yes.textContent = '옮기기'; no.textContent = '취소';
      yes.style.cssText = 'width:auto;margin:0;padding:3px 10px;font-size:10.5px;color:#B22222;';
      no.style.cssText = 'width:auto;margin:0;padding:3px 10px;font-size:10.5px;';
      yes.onclick = () => _miBoxTrash(it.cid);
      no.onclick = () => { _miBoxAsk = null; _miRenderBox(); };
      bar.appendChild(yes); bar.appendChild(no);
      row.appendChild(q); row.appendChild(bar);
    }
    list.appendChild(row);
  }
}
/* 붉은 휴지통 아이콘(시안 D2 와 같은 선) — 휴지통은 어디서나 #B22222(설계 §7). */
function _miTrashIcon(px){
  const NS = 'http://www.w3.org/2000/svg', sv = document.createElementNS(NS, 'svg');
  sv.setAttribute('width', px); sv.setAttribute('height', px); sv.setAttribute('viewBox', '0 0 24 24');
  sv.setAttribute('fill', 'none'); sv.setAttribute('stroke', '#B22222'); sv.setAttribute('stroke-width', '2'); sv.setAttribute('aria-hidden', 'true');
  const pa = document.createElementNS(NS, 'path'); pa.setAttribute('d', 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13'); sv.appendChild(pa);
  return sv;
}
/* 🧺 D2 보관함 가득 참 (개정 51 · 시안 D2 를 [내 정보] 모양으로) — 보관함(슬롯 밖)이 20 이상이면
   노란 경고(n/20 · 몇 개를 옮겨야 하는지) · 줄마다 체크칸 · «고른 캐릭터 k» · [선택한 캐릭터 휴지통으로 (k)] → 되묻기 → 한꺼번에 묘비.
   20 아래로 내려가면 다 접히고 고른 것도 비운다. 막히는 것(20 문턱)은 _charsBoxOnlyCount >= 20 그대로 — 1개만 빼면 풀린다.
   돌려주는 값: 가득 찼나. */
function _miRenderBoxFull(items){
  const $e = id => document.getElementById(id);
  const n = items ? items.length : 0, full = !!items && n >= CHARS_BOX_MAX();
  const have = new Set((items || []).map(it => it.cid));
  for(const c of Array.from(_miPick)) if(!full || !have.has(c)) _miPick.delete(c);
  if(!full || !_miPick.size) _miBulkAsk = false;
  const k = _miPick.size, need = n - CHARS_BOX_MAX() + 1;
  const box = $e('miBoxFull'), head = $e('miBoxFullHead'), text = $e('miBoxFullText');
  if(box) box.style.display = full ? 'block' : 'none';
  if(full && head) head.textContent = '보관함이 가득 찼어요 · ' + n + '/' + CHARS_BOX_MAX();
  if(full && text) text.textContent = need + '개 이상 휴지통으로 옮겨야 새 캐릭터 만들기 · 보관함 이동 · 복원을 할 수 있어요. 지금 있는 캐릭터는 그대로 써도 돼요.';
  const pk = $e('miBoxPicked'); if(pk){ pk.style.display = full ? 'inline' : 'none'; pk.textContent = '고른 캐릭터 ' + k; }
  const bulk = $e('miBoxBulk'); if(bulk) bulk.style.display = full ? 'block' : 'none';
  const btn = $e('miBoxBulkBtn');
  if(btn){ btn.textContent = ''; btn.appendChild(_miTrashIcon(11)); btn.appendChild(document.createTextNode(' 선택한 캐릭터 휴지통으로 (' + k + ')')); btn.style.display = _miBulkAsk ? 'none' : ''; }
  const ask = $e('miBoxBulkAsk'), at = $e('miBoxBulkAskText');
  if(ask) ask.style.display = (full && _miBulkAsk) ? 'block' : 'none';
  if(at) at.textContent = k + '개를 휴지통으로 옮길까요? 3일 뒤 사라져요';
  return full;
}
function _miBoxBulkStart(){
  if(!_miPick.size){ toast('휴지통으로 옮길 캐릭터를 골라 주세요'); return; }
  _miBoxAsk = null; _miBulkAsk = true; _miRenderBox();
}
async function _miBoxTrashBulk(){
  if(_miBusy || !_miPick.size) return;
  const r = _charsBoxTrashMany(Array.from(_miPick));
  _miPick.clear(); _miBulkAsk = false;
  if(!r.ok){ toast('휴지통으로 옮기지 못했어요 — 다시 눌러 주세요'); _miRenderBox(); return; }
  toast('휴지통으로 옮겼어요 (' + r.n + ')' + (r.fail ? ' · 못 옮긴 것 ' + r.fail : ''));
  _miRenderBox();
  _miBusy = true;
  try{ await _charsSync('box-trash'); }catch(_){}
  _miBusy = false;
  _miTrashLoad();
}
/* 보관함 줄 [휴지통 이동] → [옮기기]. 묘비만 바꾸고(_charsBoxTrash) 바로 한 번 동기화해서 휴지통 줄이 서버에 생기게 한다. */
async function _miBoxTrash(cid){
  if(_miBusy) return;
  _miBoxAsk = null;
  const r = _charsBoxTrash(cid);
  if(!r.ok){ toast(r.why === 'dirty' ? _charsMoveMsg(r) : '휴지통으로 옮기지 못했어요 — 다시 눌러 주세요'); _miRenderBox(); return; }
  toast(_charsDeleteWords().done);
  _miRenderBox();
  _miBusy = true;
  try{ await _charsSync('box-trash'); }catch(_){}
  _miBusy = false;
  _miTrashLoad();
}
/* 🗑️ 휴지통 탭 (시안 E · 개정 49) — 줄 고르기는 _charsTrashView(순수), 여기는 읽고 그리기만. */
function _miTrashOn(){ return _charsActive(); }
async function _miTrashLoad(){
  if(!_miTrashOn()){ _miTrashRows = null; _miTrashErr = false; _miRenderTrashTab(); return; }
  const uid = _charsCachedUid();
  let t = null;
  if(uid && window.firebaseAPI && firebaseAPI.loadCharsTrashAll){ try{ t = await firebaseAPI.loadCharsTrashAll(uid); }catch(_){ t = null; } }
  _miTrashErr = (t === null);
  _miTrashRows = _miTrashErr ? [] : _charsTrashView(t, _charsBoxGet(), _slotsNow());
  _miRenderTrashTab();
  if(_miIsOpen() && _miTab === 'trash') _miRenderTrash();
}
function _miRenderTrashTab(){
  const b = document.getElementById('miTabTrash'); if(!b) return;
  const n = (_miTrashRows && _miTrashRows.length) || 0;
  b.textContent = n ? ('휴지통 ' + n) : '휴지통';
}
function _miRenderTrash(){
  const $e = id => document.getElementById(id);
  const list = $e('miTrashList'), empty = $e('miTrashEmpty'), cnt = $e('miTrashCount'); if(!list) return;
  const rows = _miTrashRows || [];
  list.innerHTML = '';
  if(cnt) cnt.textContent = String(rows.length);
  const full = $e('miTrashFull'); if(full && !_miTrashFullShown) full.style.display = 'none';
  if(!rows.length){
    if(empty){
      empty.style.display = 'block';
      empty.textContent = _miTrashRows === null ? '휴지통을 읽는 중이에요.'
        : _miTrashErr ? '휴지통을 읽지 못했어요 — 네트워크를 확인하고 탭을 다시 눌러 주세요.'
        : '휴지통이 비어 있어요. 옮긴 캐릭터는 3일, 연동 교체로 바뀐 이전 모습은 10일 동안 여기 남아요.';
    }
    return;
  }
  if(empty) empty.style.display = 'none';
  for(const it of rows){
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:7px;padding:4px 5px;background:#fff;border:1px solid;border-color:var(--win-lo-2) var(--win-hi) var(--win-hi) var(--win-lo-2);';
    const th = document.createElement('div');
    th.style.cssText = 'width:34px;height:34px;flex:none;display:flex;align-items:center;justify-content:center;background:var(--win-select-bg);overflow:hidden;';
    let def = null; try{ def = JSON.parse(it.def); }catch(_){}
    const src = _miSlotThumb(def);
    if(src){ const im = document.createElement('img'); im.src = src; im.alt = ''; im.draggable = false; im.style.cssText = 'width:100%;height:100%;object-fit:contain;'; th.appendChild(im); }
    else { th.textContent = '🙂'; th.style.fontSize = '18px'; }
    const tx = document.createElement('span');
    tx.style.cssText = 'flex:1;min-width:0;font-size:10.5px;color:var(--ink-soft);';
    const tag = document.createElement('span');
    tag.style.cssText = 'display:inline-block;font-size:10px;padding:0 4px;margin-right:4px;border:1px solid #B22222;color:#B22222;';
    tag.textContent = it.why === 'overwritten' ? '연동 교체' : '옮김';
    const d = new Date(it.until);
    tx.appendChild(tag); tx.appendChild(document.createTextNode((d.getMonth() + 1) + '/' + d.getDate() + ' 사라져요'));
    const rb = document.createElement('button');
    rb.type = 'button'; rb.className = 'lc-btn'; rb.textContent = '복원';
    rb.style.cssText = 'width:48px;margin:0;padding:3px 0;font-size:10.5px;flex:none;text-align:center;';   // 폭 고정(시안 E)
    rb.onclick = () => _miTrashRestore(it, rb);
    row.appendChild(th); row.appendChild(tx); row.appendChild(rb);
    list.appendChild(row);
  }
}
/* [복원] — 무조건 보관함으로. 20 이면 위 붉은 상자(시안 ③)를 띄우고 버튼은 그대로 둔다. */
async function _miTrashRestore(row, btn){
  if(_miBusy) return;
  const full = document.getElementById('miTrashFull');
  if(_charsBoxOnlyCount() >= CHARS_BOX_MAX()){
    const n = document.getElementById('miTrashFullN'); if(n) n.textContent = _charsBoxOnlyCount() + '/' + CHARS_BOX_MAX();
    if(full) full.style.display = 'block'; _miTrashFullShown = true;
    return;
  }
  _miTrashFullShown = false; if(full) full.style.display = 'none';
  _miBusy = true;
  if(btn){ btn.disabled = true; btn.textContent = '…'; }
  let r = { ok: false };
  try{ r = await _charsRestore(row); }catch(_){ r = { ok: false, why: 'err' }; }
  _miBusy = false;
  if(r.ok) toast('보관함으로 복원했어요');
  else if(r.why === 'full'){ if(full) full.style.display = 'block'; _miTrashFullShown = true; }
  else toast(r.why === 'off' ? _charsMoveMsg(r) : '복원하지 못했어요 — 네트워크를 확인하고 다시 눌러 주세요');
  await _miTrashLoad();
  if(!r.ok && btn){ btn.disabled = false; btn.textContent = '복원'; }
}
/* [슬롯에 올리기] — 빈 슬롯 첫 칸으로. 도는 동안 한 번만. */
async function _miBoxUp(cid, btn){
  if(_miBusy) return;
  _miBusy = true;
  if(btn){ btn.disabled = true; btn.textContent = '올리는 중…'; }
  let r = { ok: false };
  try{ r = await _charsBoxToDesk(cid); }catch(_){ r = { ok: false, why: 'err' }; }
  _miBusy = false;
  if(r.ok){ setCurSlot(r.slot); try{ saveCurSlot(); renderLauncher(); }catch(_){} toast('슬롯에 올렸어요'); }
  else toast(_charsMoveMsg(r));
  _miRenderBox();
}
function _miCodeLoad(){
  if(slots.every(s => s)){ toast('캐릭터가 모두 찼습니다'); return; }   // 옛 런처 [캐릭터 불러오기]의 판정 그대로
  openCodeModal();
}
(function initMyInfoUI(){
  const bind = ()=>{
    const $e = id => document.getElementById(id);
    const on = (id, fn) => { const el = $e(id); if(el) el.onclick = fn; };
    on('miBack', () => closeMyInfo());
    on('miLvBtn', () => _miStarToggle());           // 🌟 레벨 배지 = 별 색 구획 여닫기(개정 69)
    on('miTabBox', () => _miSetTab('box'));
    on('miTabAcct', () => _miSetTab('acct'));
    on('miTabTrash', () => { _miTrashFullShown = false; _miSetTab('trash'); _miTrashLoad(); });
    on('miBoxBulkBtn', () => _miBoxBulkStart());
    on('miBoxBulkYes', () => _miBoxTrashBulk());
    on('miBoxBulkNo', () => { _miBulkAsk = false; _miRenderBox(); });
    on('miNameEdit', () => _miNameEditStart());
    on('miNameSave', () => _miNameSave());
    on('miNameCancel', () => _miNameEditEnd());
    on('miCopy', () => _miCopyCode());
    on('miCodeLoad', () => _miCodeLoad());
    const inp = $e('miNameInput');
    if(inp) inp.onkeydown = e => { if(e.key === 'Enter') _miNameSave(); else if(e.key === 'Escape') _miNameEditEnd(); };
  };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once:true });
  else bind();
})();

(function initAccountLoginUI(){
  const $ = id => document.getElementById(id);
  const say = (text, ok)=>{
    const el = $('acctLoginMsg'); if(!el) return;
    el.style.display = text ? 'block' : 'none';
    el.textContent = text || '';
    el.style.color = ok ? 'var(--win-ok, #2a7a3f)' : 'var(--win-error)';
  };

  const runLogin = async (btn, msgFn)=>{
    if(btn){ btn.disabled = true; btn.textContent = '로그인 중…'; }
    let r;
    try{ r = await _loginDoGoogle(); }
    catch(e){ r = { ok:false, reason:'로그인 중 오류가 났어요' }; }
    if(btn){ btn.disabled = false; btn.textContent = '구글 계정으로 로그인'; }
    if(!r || !r.ok){
      // 취소는 오류가 아니다 — 조용히 지운다.
      msgFn(r && r.canceled ? '' : ((r && r.reason) || '로그인에 실패했어요'), false);
      return r;
    }
    if(r.switched){
      /* 갈아탔다 — 여기서 그냥 이어 쓰면 옛 uid 로 걸린 구독이 살아 있어 두 계정이 섞인다.
         계정 연동이 이미 같은 이유로 같은 결론을 냈다. 재시작 안내로 멈춘다. */
      msgFn('✅ 로그인됐어요! 앱을 완전히 종료했다가 다시 실행하면 이 계정으로 시작돼요.', true);
      if(btn) btn.disabled = true;
    } else {
      msgFn('✅ ' + (r.email || '') + ' 계정과 연결됐어요.', true);
    }
    return r;
  };

  const bind = ()=>{
    /* [개정 16] 로그인 전 얼굴의 [구글 계정으로 로그인](acctGoogleBtn)은 걷었다 — 게이트(H · I · K)가 대신한다.
       runLogin 은 아래 게이트 구글 버튼이 계속 쓴다. */

    // ── 로그아웃: 버튼 → 확인 → 완료(종료 안내). 계정 연동 해제와 같은 3단계.
    /* ── 🚪 [2026-09-20 · §2 제보 1] 로그아웃 출구.
       예전엔 검문에 걸리면 같은 한 줄이 계속 떴고, 막히는 원인이 계속되면 영원히 못 나갔다.
       ① 사유를 가른다 — 아직 올리는 중(timeout) · 서버가 거부(denied) · 확인 못 함(unknown) · 오프라인.
       ② **두 번째 실패에서만** [그래도 로그아웃] 이 열린다. 누르면 바로 실행(확인 한 번 더 없음 — 버튼 자체가
          두 번째에만 나오므로 충분하다는 결정). 열릴 때 «이 컴퓨터에만 있는 것» 을 **항목 이름과 개수로** 전부 적는다.
       ③ 확인 상자를 열 때마다 처음부터 — 실패 횟수·버튼 글자·강제 버튼을 되돌린다. */
    let _logoutFails = 0;
    const forceBtn = $('acctLogoutForce');
    const showForce = (on) => { if(forceBtn) forceBtn.style.display = on ? 'block' : 'none'; };
    const logoutFailMsg = (r, second) => {
      const kind = (r && r.kind) || 'denied';
      const items = (r && r.items && r.items.length) ? r.items.map(i => i.label).join(' · ') : '캐릭터 · 뽑은 파츠 · 누적 시간';
      if(!second){
        if(kind === 'offline') return '⚠️ 네트워크 연결이 필요해요 — 연결한 뒤 다시 눌러 주세요.';
        if(kind === 'timeout') return '⏳ 아직 서버에 올리는 중이에요. 캐릭터 사진이 크면 시간이 걸려요 — 잠시 후 다시 눌러 주세요.';
        if(kind === 'unknown') return '❓ 서버에 올라갔는지 확인하지 못했어요. 네트워크를 확인한 뒤 다시 눌러 주세요.';
        return '⚠️ ' + ((r && r.reason) || '서버에 올리지 못했어요') + '. 네트워크와 로그인 상태를 확인한 뒤 다시 눌러 주세요.';
      }
      return '⚠️ 두 번 다 서버에 올리지 못했어요. 계정과 데이터는 서버에 그대로 있어요. 이 컴퓨터에만 있는 것: ' + items + ' — [그래도 로그아웃]을 누르면 이것만 사라져요.'
        + (kind === 'timeout' ? ' 아직 올리는 중일 수 있어요 — 그래도 나가면 마지막 몇 분이 사라질 수 있어요.' : '');
    };
    const lBtn = $('acctLogoutBtn');
    const yes = $('acctLogoutYes');
    const resetLogoutBox = () => {
      _logoutFails = 0;
      if(yes){ yes.disabled = false; yes.textContent = '로그아웃'; }
      showForce(false);
      say('', false);
    };
    if(lBtn) lBtn.onclick = ()=>{
      lBtn.style.display = 'none';
      resetLogoutBox();
      const cf = $('acctLogoutConfirm'); if(cf) cf.style.display = 'block';
    };
    const cancel = $('acctLogoutCancel');
    if(cancel) cancel.onclick = ()=>{
      const cf = $('acctLogoutConfirm'); if(cf) cf.style.display = 'none';
      resetLogoutBox();
      if(lBtn) lBtn.style.display = 'block';
    };
    const afterLogout = () => {
      const cf = $('acctLogoutConfirm'); if(cf) cf.style.display = 'none';
      const dn = $('acctLogoutDone');    if(dn) dn.style.display = 'block';
      /* 자동으로 껐다 켠다 → 부팅 시 게이트가 돌아 시작 화면이 나온다.
         못 하는 판(구버전 앱)에서는 위 안내가 그대로 남아 수동 종료를 받는다. */
      _acctRelaunchAfterDetach(null);
    };
    const runLogout = async (btn, force) => {
      if(yes) yes.disabled = true;
      if(forceBtn) forceBtn.disabled = true;
      const _t = btn ? btn.textContent : ''; if(btn) btn.textContent = '정리 중…';
      let r; try{ r = await _loginDoLogout(force ? { force:true } : undefined); }catch(_){ r = { ok:false, reason:'로그아웃 중 오류가 났어요', kind:'unknown' }; }
      if(btn) btn.textContent = _t;
      if(forceBtn) forceBtn.disabled = false;
      if(!r || !r.ok){
        /* 🛂 검문에 걸렸다 — 아무것도 안 지웠다. 몇 번째인지에 따라 다른 말을 하고, 두 번째부터 출구를 연다. */
        _logoutFails++;
        if(yes){ yes.disabled = false; yes.textContent = '다시 시도'; }
        say(logoutFailMsg(r, _logoutFails >= 2), false);
        if(_logoutFails >= 2) showForce(true);
        return;
      }
      afterLogout();
    };
    if(yes) yes.onclick = () => runLogout(yes, false);
    if(forceBtn) forceBtn.onclick = () => runLogout(forceBtn, true);
    const quit = $('acctLogoutQuit');
    if(quit) quit.onclick = ()=>{ if(window.companion && companion.quitApp) companion.quitApp(); };

    /* ── 🗑️ 회원 탈퇴: 버튼 → 고지 · 확인 → 완료(다시 시작). 고지 글은 HTML 에 고정해 두고(서버에 닿지 않아도 읽을 수 있게),
       열 때 미리 보기로 «지울 곳 몇 곳 · 파일 몇 개» 한 줄만 더한다. [탈퇴하기]는 체크 + «탈퇴» 입력이 다 맞을 때만 켜진다. */
    const dBtn = $('acctDeleteBtn'), dBox = $('acctDeleteConfirm'), dYes = $('acctDeleteYes');
    const dAgree = $('acctDeleteAgree'), dWord = $('acctDeleteWord'), dCount = $('acctDeleteCount');
    const dSay = (text) => { const el = $('acctDeleteMsg'); if(!el) return; el.style.display = text ? 'block' : 'none'; el.textContent = text || ''; };
    let _delBusy = false, _delSeq = 0;
    const delReady = () => !!(dAgree && dAgree.checked && dWord && dWord.value.trim() === '탈퇴');
    const delSync = () => { if(dYes) dYes.disabled = _delBusy || !delReady(); };
    const delShowCount = (p) => {
      if(!dCount) return;
      if(!p || !p.ok){ dCount.style.display = 'none'; return; }
      const files = (p.storage && p.storage.count) || 0;
      dCount.textContent = '서버에서 지울 곳 ' + (p.dbCount || 0) + '곳 · 올린 파일 ' + files + '개'
        + (p.warnings && p.warnings.length ? ' — ' + p.warnings.join(' · ') : '');
      dCount.style.display = 'block';
    };
    if(dBtn) dBtn.onclick = () => {
      dBtn.style.display = 'none';
      if(dAgree) dAgree.checked = false;
      if(dWord) dWord.value = '';
      if(dYes) dYes.textContent = '탈퇴하기';
      dSay(''); delShowCount(null); delSync();
      if(dBox) dBox.style.display = 'block';
      const cancelBtn = $('acctDeleteCancel'); if(cancelBtn) try{ cancelBtn.focus(); }catch(_){}
      const seq = ++_delSeq;
      const api = window.firebaseAPI && firebaseAPI.accountDelete;
      if(api) api.preview().then(p => { if(seq === _delSeq) delShowCount(p); }).catch(()=>{});
    };
    if(dAgree) dAgree.onchange = delSync;
    if(dWord){ dWord.oninput = delSync; dWord.onkeydown = (e) => { if(e.key === 'Enter' && dYes && !dYes.disabled) dYes.click(); }; }
    const dCancel = $('acctDeleteCancel');
    if(dCancel) dCancel.onclick = () => {
      if(_delBusy) return;
      _delSeq++;
      if(dBox) dBox.style.display = 'none';
      dSay('');
      if(dBtn) dBtn.style.display = 'block';
    };
    if(dYes) dYes.onclick = async () => {
      if(_delBusy || !delReady()) return;
      _delBusy = true; delSync(); dSay('');
      if(dCancel) dCancel.disabled = true;
      dYes.textContent = '지우는 중…';
      let r; try{ r = await _loginDoDeleteAccount(dWord.value); }catch(_){ r = { ok:false, reason:'탈퇴 중 오류가 났어요 — 다시 눌러 주세요' }; }
      _delBusy = false;
      if(dCancel) dCancel.disabled = false;
      if(!r || !r.ok){
        dYes.textContent = '다시 시도';
        delSync();
        dSay('⚠️ ' + ((r && r.reason) || '탈퇴하지 못했어요') + ' 이 PC의 기록은 그대로예요.');
        return;
      }
      if(dBox) dBox.style.display = 'none';
      const dn = $('acctDeleteDone'); if(dn) dn.style.display = 'block';
      _acctRelaunchAfterDetach(null);
    };
    const dQuit = $('acctDeleteQuit');
    if(dQuit) dQuit.onclick = () => { if(window.companion && companion.quitApp) companion.quitApp(); };

    /* ── 🔁 [개정 16 · 설계 §6-⑤ 걷음] 계정 되찾기(acctRecover* · recCandidates · recGo) — 없앴다.
       «이 기기가 버린 uid» 로 결속을 되돌리던 출구였다. 계정 = 친구 코드 + 비밀번호/구글(H · K)이 된 뒤로는
       잘못 물릴 길(구글 로그인의 갈아타기)이 게이트로 닫혔다. firebase-init authRebindUserCode 는 §6-⑧ 묶음(CHECKS 개정 52)에서 걷었다. */

    // ── 초대 게이트 안의 구글 버튼 — 새 컴퓨터의 기존 유저가 초대 코드 없이 들어오는 문.
    const gate = $('inviteGateGoogleBtn');
    if(gate) gate.onclick = async ()=>{
      const gm = (t, ok)=>{
        const el = $('inviteGateLoginMsg'); if(!el) return;
        el.style.display = t ? 'block' : 'none';
        el.textContent = t || '';
        el.style.color = ok ? 'var(--ink-soft)' : 'var(--win-error)';
      };
      const r = await runLogin(gate, gm);
      if(!r || !r.ok){
        /* 🚪 이 계정에 묶인 코드가 없다 — 게이트 앞의 임시 코드를 묶어주는 대신 그렇게 말한다.
           예전에는 여기서 그 임시 코드를 **묶어버리고** 나서 거절했다. 유저 눈에는 똑같이
           거절 화면이지만, 그 한 번이 원래 컴퓨터의 계정을 빈 계정으로 갈아치우는 씨앗이었다. */
        if(r.needCode) gm('이 계정에는 아직 연결된 기록이 없어요. 초대 코드로 먼저 입장해 주세요.', false);
        return;
      }
      if(r.switched){
        /* 🔁 계정을 되찾았다 — 자동으로 껐다 켠다.
           [왜 통과시키지 않고 재시작하는가] 지금 이 세션은 로그아웃 직후 만들어진 **임시 유저
             코드**로 돌고 있다. 게이트만 닫고 이어 쓰면 그 임시 코드로 걸린 구독·프레즌스가
             그대로 살아서 두 계정이 섞인다. 계정 연동이 게이트에서 같은 결론을 냈다.
           ★ 재시작하면 부팅 때 uid 가 복원된 상태로 checkInviteGate 가 돌고, 위에서 이미
             _markInvitePassed() 를 찍었으므로 게이트를 조용히 지나간다 — 유저 눈에는
             '로그인했더니 알아서 들어가졌다'가 된다.
           ⚠️ 게이트 화면에는 종료 버튼이 없다. 여기서 자동 재시작을 안 하면 유저는 안내문만
             보고 앱을 손으로 껐다 켜야 한다(로그아웃 쪽은 자동인데 돌아오는 길만 수동이었다). */
        gm('✅ 로그인됐어요. 앱을 다시 시작하는 중이에요…', true);
        _acctRelaunchAfterDetach(()=> gm('✅ 로그인됐어요. 앱을 완전히 종료했다가 다시 실행해 주세요.', true));
        return;
      }
      if(r.alreadyOwner){
        /* ✅ 이 기기의 uid 가 그 구글 계정에 **이미** 묶여 있었다 = 정식 주인이다.
           ★ 여기서는 재시작이 필요 없다 — uid 가 바뀌지 않았으므로 지금 세션의 구독·프레즌스가
             그대로 맞다(재시작하는 위 경로는 uid 가 갈렸을 때의 얘기다).
           ★ 도장은 _loginDoGoogle 이 이미 찍었다. 게이트만 닫으면 된다. */
        gm('✅ ' + (r.email || '') + ' 계정으로 확인됐어요. 들어갈게요…', true);
        if(typeof window._inviteGatePass === 'function') window._inviteGatePass();
        else gm('✅ 확인됐어요. 앱을 완전히 종료했다가 다시 실행해 주세요.', true);
        return;
      }
      /* 이 구글 계정의 **첫 결속**이다 — 방금 묶였을 뿐 통과 자격은 아니다.
         재시작해도 못 들어가므로 '다시 실행해 주세요'라고 하면 껐다 켰다만 반복하게 된다. */
      gm('이 계정에는 아직 연결된 기록이 없어요. 초대 코드로 먼저 입장해 주세요.', false);
    };

    refreshAccountTab();
  };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once:true });
  else bind();

  /* 🔄 로그인된 기기는 부팅마다 스냅샷을 한 벌 새로 올린다(쓰기 1회).
     안 하면 스냅샷이 로그인 시점에 굳어서, 그 뒤 바꾼 이름·산 라이선스가 새 기기에 안 따라온다.
     ⚠️ 로그인 안 한 기기에서는 아무 일도 하지 않는다. */
  const push = ()=>{
    if(!getMyLoginEmail()) return;
    if(!(window.firebaseAPI && firebaseAPI.setAccountSnapshot)) return;
    /* 🎫 라이선스 칸은 _licenseSnapForPush 가 채운다 — 이 PC 에 없으면 계정 것을 받아 켜고, 계정 것을 null 로 덮지 않는다. */
    setTimeout(async ()=>{ try{ firebaseAPI.setAccountSnapshot(getMyUserId(), await _licenseSnapForPush()); }catch(_){} }, 6000);
  };

  /* 🔇 침묵 깨기 — "묶인 코드인데 로그인은 안 된" 기기에게 그렇다고 말해준다.
     [개정 16] 고치는 길은 재시작 → 부팅 게이트 K(설정 › 계정 로그인은 걷었다). 문구도 그렇게 바꿨다.
     [무엇을 막는가] 규칙이 users/{코드} 의 자기 소유 가지를 "주인이 없거나 나일 때"로 잠근 뒤,
       구글로 로그인해 둔 계정을 다른 컴퓨터에서 **계정 이전(비밀번호)** 으로만 열면 그 컴퓨터의
       쓰기가 전부 거부된다. 거부는 예외를 던지지 않는다 — 이름을 바꿔도, 마이홈을 꾸며도
       화면에는 반영되고 다음 부팅에 조용히 되돌아온다. 그게 가장 신고가 늦는 종류의 고장이다.
     ★ 막지 않는다. 알려주기만 한다 — 이 기기가 진짜 주인일 수도 있고(그냥 로그인만 안 한 것),
       고치는 방법도 [구글 계정으로 로그인] 한 번이다.
     ⚠️ 쓰기 1회가 아니라 **읽기 1회**다(userAuth/{코드} = 문자열 하나). 그리고 로그인한 기기에서는
       아예 돌지 않는다. */
  const warnUnbound = ()=>{
    if(getMyLoginEmail()) return;                        // 로그인돼 있으면 물어볼 것이 없다
    if(!(window.firebaseAPI && firebaseAPI.authOwnerOf)) return;
    let code = null; try{ code = localStorage.getItem(MY_USER_ID_KEY); }catch(_){}
    if(!code) return;
    setTimeout(async ()=>{
      let owner;
      try{ owner = await firebaseAPI.authOwnerOf(code); }catch(_){ return; }
      if(owner === undefined || owner === null) return;   // 조회 실패거나 주인 없음 — 둘 다 조용히
      toast('🔑 이 PC의 로그인이 풀려 있어 변경 내용이 저장되지 않아요 — 앱을 다시 시작하면 로그인 화면이 나와요');
    }, 9000);   // 부팅 직후 토스트가 겹치지 않게 스냅샷(6초)보다 뒤에 둔다
  };

  const boot = ()=>{ push(); warnUnbound(); };
  if(window.firebaseAPI) boot();
  else window.addEventListener('firebase-ready', boot, { once:true });
})();

/* 🔁 신원을 놓은 뒤 앱을 껐다 켠다 — 연동 해제와 로그아웃이 **함께 쓰는 한 자리.**
   [왜 여기 모으는가] 두 곳이 같은 일을 하는데 따로 쓰면 한쪽만 고쳐진다. 지우는 쪽도 이제
     함수 하나다(_detachAccountLocal · ACCOUNT_LOCAL_KEYS) — 예전엔 주석으로만 «같은 목록» 이었고
     그래서 두 곳이 똑같이 소지품을 빠뜨렸다(2026-09-16 제보 4).
   [왜 재시작인가] 게이트(checkInviteGate)는 부팅 때 한 번만 도는 검사다. 세션 도중에 신원을
     놓아도 화면은 그대로 남고, 그 상태로 계속 쓰면 getMyUserId() 가 그 자리에서 **새 유저 코드를
     만들어** 아무도 모르는 계정 앞으로 기록이 쌓인다. 껐다 켜야 게이트가 다시 돈다.
   ⚠️ 구버전 앱에는 relaunchApp 채널이 없다. 그때는 기존처럼 '지금 종료' 안내로 물러난다 —
     여기서 그냥 실패하면 유저는 버튼을 눌렀는데 아무 일도 안 일어나는 화면을 본다.
   @param onFallback 재시작을 못 할 때 부를 것(수동 종료 안내를 띄우는 쪽) */
/* 🧬 F · 캐릭터를 계정에 연동했어요 (설계 §7-F · 시안 F-1 · F-2 확정 · CHECKS 개정 57) — 묻지 않는 안내 창. 한 번만.
   [언제] 재시작 뒤 부팅 _charsBoot 가 성공한 다음(첫 채택까지 끝나 보관함이 열린 뒤). 표시가 다른 uid 것이면 버린다.
   [무엇] 옮긴 것 중 **지금도 살아 있는** 것만 센다 · 섬네일만(이름 없음 — 보관함과 같은 결정) · «마리» 없이 «개» ·
     보관함 N/20 과 (그 전 + 옮긴 것) · 20 이상이면 D2 와 같은 문구로 경고하고 [보관함 열기]를 기본 버튼으로.
   ★ 창을 띄우면 표시를 지운다(두 번 안 뜬다). 보관함이 아직 안 열렸으면(채택 전) 표시를 두고 다음 부팅에. */
function _charsLinkedMaybeShow(){
  let m = null; try{ m = JSON.parse(localStorage.getItem(CHARS_LINKED_KEY) || 'null'); }catch(_){ m = null; }
  if(!m) return false;
  const drop = () => { try{ localStorage.removeItem(CHARS_LINKED_KEY); }catch(_){} };
  if(typeof m !== 'object' || m.to !== getMyUserId() || !Array.isArray(m.cids)){ drop(); return false; }
  if(!(typeof charsMod()._charsActive === 'function' && charsMod()._charsActive())) return false;
  const ov = document.getElementById('charsLinkedOverlay');
  if(!ov) return false;
  const box = charsMod()._charsBoxGet(), desk = charsMod()._charsDeskGet(), on = new Set(desk.filter(Boolean));
  const live = m.cids.filter(c => box[c] && !charsMod()._charsIsTomb(box[c]) && typeof box[c].def === 'string');
  if(!live.length){ drop(); return false; }
  const total = charsMod()._charsBoxOnlyCount(box, desk), moved = live.filter(c => !on.has(c)).length;
  const full = total >= charsMod().CHARS_BOX_MAX, need = total - charsMod().CHARS_BOX_MAX + 1;
  const $e = id => document.getElementById(id);
  const set = (id, t) => { const el = $e(id); if(el) el.textContent = t; };
  set('clCount', live.length + '개');
  let code = null; try{ code = localStorage.getItem(MY_FRIEND_CODE_KEY); }catch(_){}
  const chip = $e('clCode'), chipWrap = $e('clCodeWrap');
  if(chip) chip.textContent = code || '';
  if(chipWrap) chipWrap.style.display = code ? 'inline' : 'none';
  const th = $e('clThumbs');
  if(th){
    th.textContent = '';
    for(const c of live){
      let def = null; try{ def = JSON.parse(box[c].def); }catch(_){}
      const cell = document.createElement('div'); cell.className = 'cl-th';
      const src = _miSlotThumb(def);
      if(src){ const im = document.createElement('img'); im.src = src; im.alt = ''; im.loading = 'lazy'; cell.appendChild(im); }
      th.appendChild(cell);
    }
  }
  set('clBox', total + ' / ' + charsMod().CHARS_BOX_MAX);
  set('clSplit', (total - moved) + ' + ' + moved);
  const cnt = $e('clCnt'); if(cnt) cnt.classList.toggle('full', full);
  const warn = $e('clFull');
  if(warn){ warn.style.display = full ? 'block' : 'none';
    warn.textContent = '보관함이 가득 찼어요. ' + need + '개 이상 휴지통으로 옮겨야 새 캐릭터 만들기 · 보관함 이동 · 복원을 할 수 있어요. 지금 있는 캐릭터는 그대로 써도 돼요.'; }
  const note = $e('clNote'); if(note) note.style.display = full ? 'none' : 'block';
  const openB = $e('clOpen'), okB = $e('clOk');
  if(openB) openB.classList.toggle('ghost', !full);
  if(okB) okB.classList.toggle('ghost', full);
  const close = () => { ov.style.display = 'none'; };
  if(okB) okB.onclick = close;
  if(openB) openB.onclick = () => {
    close();
    const lc = document.getElementById('launcher');
    if(lc && lc.classList.contains('on')) openMyInfo('box');
    else toast('런처의 [내 정보] › 보관함에서 볼 수 있어요');
  };
  drop();
  ov.style.display = 'flex';
  return true;
}

return {
  _charsLinkedMaybeShow,
  _lbPush,
  _miIsOpen,
  _miSlotThumb,
  closeMyInfo,
  openMyInfo,
};
}

const api = { createMyInfo };
if(typeof window !== 'undefined') window.TwMyInfo = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
