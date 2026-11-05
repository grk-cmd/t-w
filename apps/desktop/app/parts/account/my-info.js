/* my-info.js — 🪪 [내 정보] 화면 — 머리(사진 · 닉네임 · 레벨 별 색) · 보관함 · 휴지통 · 계정 탭 연결
   app.js «🪪 [내 정보] — 런처 화면 전환» 구역 본문을 옮긴 모듈이다(앱 FSD 17번 — docs/APP_FSD_MAP.md). 함께 옮겼던 🏆 전체 랭킹은 걷었다.
   ★ app.js 에서 받는 값 —
     EXP_CELLS · EXP_SEC_PER_CELL · EXP_SEC_PER_LEVEL · FOCUS_CYCLE_SEC · FOCUS_LEVEL_CAP_HOURS · STAR_PALETTE · _acctDetached · _focusTotalSec · _myHomeData · curSlot 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다). 대입은 setCurSlot(…).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 36개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 보관함 · 휴지통은 서버 원본 옷장(closet.js — closetMod())이 준 목록을 그린다. 이 PC 에 보관함 사본은 없다.
   ★ 밖에서 부르는 이름: _miBoxChanged · _miIsOpen · _miSlotThumb · closeMyInfo · openMyInfo — app.js 는 myInfoMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwMyInfo — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-my-info.js */
(function(){

function createMyInfo(deps){
const EXP_CELLS = deps.EXP_CELLS;   // 읽는 함수
const EXP_SEC_PER_CELL = deps.EXP_SEC_PER_CELL;   // 읽는 함수
const EXP_SEC_PER_LEVEL = deps.EXP_SEC_PER_LEVEL;   // 읽는 함수
const FOCUS_CYCLE_SEC = deps.FOCUS_CYCLE_SEC;   // 읽는 함수
const FOCUS_LEVEL_CAP_HOURS = deps.FOCUS_LEVEL_CAP_HOURS;   // 읽는 함수
const MY_FRIEND_CODE_KEY = deps.MY_FRIEND_CODE_KEY;
const _acctRelaunchAfterDetach = deps._acctRelaunchAfterDetach;   // 🪪 신원을 놓은 뒤 앱 다시 켜기(account-state.js)
const closetMod = deps.closetMod;   // 읽는 함수 — 서버 원본 옷장(character/closet.js)
const STAR_PALETTE = deps.STAR_PALETTE;   // 읽는 함수
const USER_NAME_MAX = deps.USER_NAME_MAX;
const _acctDetached = deps._acctDetached;   // 읽는 함수
const _focusTotalSec = deps._focusTotalSec;   // 읽는 함수
const _loginDoLogout = deps._loginDoLogout;
const _loginDoDeleteAccount = deps._loginDoDeleteAccount;
const _withdrawPreview = deps._withdrawPreview;   // 탈퇴 미리보기(GET /v1/me/withdrawal-preview — account.js)
const _myHomeData = deps._myHomeData;   // 읽는 함수
const _pushLevelIfChanged = deps._pushLevelIfChanged;
const closeGearMenu = deps.closeGearMenu;
const commitUserName = deps.commitUserName;
const curSlot = deps.curSlot;   // 읽는 함수
const focusCycleOf = deps.focusCycleOf;
const getDisplayName = deps.getDisplayName;
const getFocusLevel = deps.getFocusLevel;
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
  /* 탭을 옮기면 열려 있던 탈퇴 안내는 접는다 — 돌아왔을 때 계정 탭이 사라진 채로 남지 않게(지우는 중이면 그대로) */
  const li = $e('acctLoggedIn'), dc = $e('acctDeleteCancel');
  if(li && li.classList.contains('acct-deleting') && dc && !dc.disabled && $e('acctDeleteConfirm') && $e('acctDeleteConfirm').style.display !== 'none') dc.click();
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

function _miRenderHead(){
  const $e = id => document.getElementById(id);
  const nick = $e('miNick'); if(nick){ let n = ''; try{ n = getDisplayName(); }catch(_){} nick.textContent = n; }
  /* 🏅 레벨 배지 — 친구 목록 배지와 **같은 함수**(plMod.fillLv → .mh-flv + lvBadgeClass). 모양·티어 색을 여기서 따로 만들지 않는다. */
  const lv = $e('miLv'); if(lv){ let n = 1, st = null; try{ n = getFocusLevel(); st = myFocusShow(); }catch(_){} plMod.fillLv(lv, n, st); }
  const code = $e('miCode'); if(code){ let c = null; try{ c = localStorage.getItem(MY_FRIEND_CODE_KEY); }catch(_){} code.textContent = c || '—'; }
  const p = _miRenderAvatar(); if(p && p.catch) p.catch(()=>{});
  _miRenderStar();                                  // 🌟 별 색 구획 — 이름표 미리보기에 닉네임이 들어간다(개정 69)
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
  const avSrc = TwSafeHtml.safeUrl(av, 'image');   // 허용된 그림 주소만(shared/safe-html.js)
  const ok = !!avSrc;
  if(img){ if(ok) img.src = avSrc; img.style.display = ok ? 'block' : 'none'; }
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
    const s = TwSafeHtml.safeUrl(v, 'image');
    if(s) return s;
  }
  return null;
}
/* 보관함에 든 항목 — 서버가 준 머리(섬네일)로 그린다. 최근 고친 것부터. 받기 전/못 받음이면 null(모름 — 빈 보관함과 다르다). */
function _miBoxItems(){ return closetMod().boxItems(); }
function _miRenderBox(){
  const $e = id => document.getElementById(id);
  const list = $e('miBoxList'), empty = $e('miBoxEmpty'), cnt = $e('miBoxCount'); if(!list) return;
  const items = _miBoxItems();
  list.innerHTML = '';
  if(cnt) cnt.textContent = (items ? items.length : 0) + '/' + closetMod().BOX_MAX;
  const full = _miRenderBoxFull(items);
  if(!items || !items.length){
    if(empty){
      empty.style.display = 'block';
      empty.textContent = '';
      if(!items){
        const failed = closetMod().state() === 'failed';
        empty.textContent = failed ? '보관함을 못 불러왔어요 — ' : '보관함을 불러오는 중이에요.';
        if(failed){
          const rb = document.createElement('button');
          rb.type = 'button'; rb.className = 'lc-btn'; rb.id = 'miBoxRetry'; rb.textContent = '다시 시도';
          rb.style.cssText = 'width:auto;margin:0;padding:3px 8px;font-size:10.5px;';
          rb.onclick = () => { closetMod().pullCloset(true); };
          empty.appendChild(rb);
        }
      }else empty.textContent = '보관함이 비어 있어요. 런처 톱니의 [보관함 이동]으로 넣은 캐릭터가 여기 들어와요.';
    }
    return;
  }
  if(empty) empty.style.display = 'none';
  for(const it of items){
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:7px;padding:4px 5px;background:#fff;border:1px solid;border-color:var(--win-lo-2) var(--win-hi) var(--win-hi) var(--win-lo-2);';
    if(full){                                                                   // D2 — 줄마다 체크칸(한꺼번에 휴지통으로)
      const ck = document.createElement('input');
      ck.type = 'checkbox'; ck.checked = _miPick.has(it.avatarId); ck.setAttribute('aria-label', '고르기');
      ck.style.cssText = 'flex:none;margin:0;';
      ck.onchange = () => { if(ck.checked) _miPick.add(it.avatarId); else _miPick.delete(it.avatarId); _miBulkAsk = false; _miRenderBox(); };
      row.appendChild(ck);
    }
    const th = document.createElement('div');
    th.style.cssText = 'width:34px;height:34px;flex:none;display:flex;align-items:center;justify-content:center;background:var(--win-select-bg);overflow:hidden;';
    const src = _miSlotThumb(it);
    if(src){ const im = document.createElement('img'); im.src = src; im.alt = ''; im.draggable = false; im.style.cssText = 'width:100%;height:100%;object-fit:contain;'; th.appendChild(im); }
    else { th.textContent = '🙂'; th.style.fontSize = '18px'; }
    const tx = document.createElement('span');
    tx.style.cssText = 'flex:1;min-width:0;font-size:10.5px;color:var(--ink-soft);';
    const d = new Date(it.mtime);
    tx.textContent = it.mtime ? ('마지막 수정 ' + (d.getMonth() + 1) + '/' + d.getDate()) : '';
    const up = document.createElement('button');
    up.type = 'button'; up.className = 'lc-btn'; up.textContent = '슬롯에 올리기';
    up.style.cssText = 'width:auto;margin:0;padding:3px 8px;font-size:10.5px;flex:none;';
    up.onclick = () => _miBoxUp(it.avatarId, up);
    if(_miBulkAsk) up.disabled = true;                                           // 한꺼번에 옮기기를 묻는 동안
    /* 🗑️ [휴지통 이동] — 시안 D2 의 붉은 아이콘을 줄마다. 되묻기는 그 줄 안에서(한 번에 한 줄). */
    const tb = document.createElement('button');
    tb.type = 'button'; tb.setAttribute('aria-label', '휴지통 이동'); tb.title = '휴지통 이동';
    tb.style.cssText = 'flex:none;background:none;border:0;padding:2px 3px;margin:0;cursor:pointer;line-height:0;';
    tb.appendChild(_miTrashIcon(14));
    tb.onclick = () => { _miBoxAsk = (_miBoxAsk === it.avatarId) ? null : it.avatarId; _miBulkAsk = false; _miRenderBox(); };
    row.appendChild(th); row.appendChild(tx); row.appendChild(up); row.appendChild(tb);
    if(_miBoxAsk === it.avatarId){
      row.style.flexWrap = 'wrap'; row.style.borderColor = '#B22222';
      up.disabled = true;
      const q = document.createElement('div');
      q.style.cssText = 'width:100%;font-size:10.5px;color:#B22222;margin-top:2px;';
      q.textContent = closetMod().deleteWords().ask;
      const bar = document.createElement('div');
      bar.style.cssText = 'width:100%;display:flex;gap:4px;justify-content:flex-end;';
      const yes = document.createElement('button'), no = document.createElement('button');
      yes.type = no.type = 'button'; yes.className = no.className = 'lc-btn';
      yes.textContent = '옮기기'; no.textContent = '취소';
      yes.style.cssText = 'width:auto;margin:0;padding:3px 10px;font-size:10.5px;color:#B22222;';
      no.style.cssText = 'width:auto;margin:0;padding:3px 10px;font-size:10.5px;';
      yes.onclick = () => _miBoxTrash(it.avatarId);
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
/* 🧺 D2 보관함 가득 참 (시안 D2 를 [내 정보] 모양으로) — 보관함(슬롯 밖)이 20 이상이면
   노란 경고(n/20 · 몇 개를 옮겨야 하는지) · 줄마다 체크칸 · «고른 캐릭터 k» · [선택한 캐릭터 휴지통으로 (k)] → 되묻기 → 한꺼번에 휴지통(요청 하나).
   20 아래로 내려가면 다 접히고 고른 것도 비운다. 막히는 것(20 문턱)은 서버 규격 그대로 — 1개만 빼면 풀린다.
   돌려주는 값: 가득 찼나. */
function _miRenderBoxFull(items){
  const $e = id => document.getElementById(id);
  const MAX = closetMod().BOX_MAX;
  const n = items ? items.length : 0, full = !!items && n >= MAX;
  const have = new Set((items || []).map(it => it.avatarId));
  for(const c of Array.from(_miPick)) if(!full || !have.has(c)) _miPick.delete(c);
  if(!full || !_miPick.size) _miBulkAsk = false;
  const k = _miPick.size, need = n - MAX + 1;
  const box = $e('miBoxFull'), head = $e('miBoxFullHead'), text = $e('miBoxFullText');
  if(box) box.style.display = full ? 'block' : 'none';
  if(full && head) head.textContent = '보관함이 가득 찼어요 · ' + n + '/' + MAX;
  if(full && text) text.textContent = need + '개 이상 휴지통으로 옮겨야 보관함 이동 · 복원을 할 수 있어요. 지금 있는 캐릭터는 그대로 써도 돼요.';
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
  _miBusy = true;
  let r;
  try{ r = await closetMod().trashBox(Array.from(_miPick)); }finally{ _miBusy = false; }
  _miPick.clear(); _miBulkAsk = false;
  if(!r.ok){ closetMod().reportFail(r); _miRenderBox(); return; }
  toast('휴지통으로 옮겼어요 (' + r.n + ')' + (r.fail ? ' · 못 옮긴 것 ' + r.fail : ''));
  _miRenderBox();
  _miTrashLoad();
}
/* 보관함 줄 [휴지통 이동] → [옮기기] — 서버에 요청 하나. */
async function _miBoxTrash(avatarId){
  if(_miBusy) return;
  _miBoxAsk = null;
  _miBusy = true;
  let r;
  try{ r = await closetMod().trashBox([avatarId]); }finally{ _miBusy = false; }
  if(!r.ok){ closetMod().reportFail(r); _miRenderBox(); return; }
  toast(closetMod().deleteWords().done);
  _miRenderBox();
  _miTrashLoad();
}
/* 🗑️ 휴지통 탭 — 서버가 준 줄(기한 안만)을 그린다. 휴지통은 앱이 비울 수 없고 기한(옮김 3일 · 연동 교체 10일)이 지나면 서버가 정리한다. */
function _miTrashOn(){ return closetMod().state() === 'ready'; }
async function _miTrashLoad(){
  if(!_miTrashOn()){ _miTrashRows = null; _miTrashErr = false; _miRenderTrashTab(); return; }
  let rows = null;
  try{ rows = await closetMod().trashRows(); }catch(e){ rows = null; }
  _miTrashErr = (rows === null);
  _miTrashRows = _miTrashErr ? [] : rows;
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
    const src = _miSlotThumb(it);
    if(src){ const im = document.createElement('img'); im.src = src; im.alt = ''; im.draggable = false; im.style.cssText = 'width:100%;height:100%;object-fit:contain;'; th.appendChild(im); }
    else { th.textContent = '🙂'; th.style.fontSize = '18px'; }
    const tx = document.createElement('span');
    tx.style.cssText = 'flex:1;min-width:0;font-size:10.5px;color:var(--ink-soft);';
    const tag = document.createElement('span');
    tag.style.cssText = 'display:inline-block;font-size:10px;padding:0 4px;margin-right:4px;border:1px solid #B22222;color:#B22222;';
    tag.textContent = it.why === 'overwritten' ? '연동 교체' : '옮김';
    const d = new Date(it.expiresAt);
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
  if(closetMod().boxCount() >= closetMod().BOX_MAX){
    const n = document.getElementById('miTrashFullN'); if(n) n.textContent = closetMod().boxCount() + '/' + closetMod().BOX_MAX;
    if(full) full.style.display = 'block'; _miTrashFullShown = true;
    return;
  }
  _miTrashFullShown = false; if(full) full.style.display = 'none';
  _miBusy = true;
  if(btn){ btn.disabled = true; btn.textContent = '…'; }
  let r = { ok: false };
  try{ r = await closetMod().restore(row.trashId); }catch(_){ r = { ok: false, why: 'err' }; }
  _miBusy = false;
  if(r.ok) toast('보관함으로 복원했어요');
  else if(r.why === 'full'){ if(full) full.style.display = 'block'; _miTrashFullShown = true; }
  else closetMod().reportFail(r);
  await _miTrashLoad();
  if(!r.ok && btn){ btn.disabled = false; btn.textContent = '복원'; }
}
/* [슬롯에 올리기] — 빈 슬롯 첫 칸으로. 도는 동안 한 번만. */
async function _miBoxUp(avatarId, btn){
  if(_miBusy) return;
  _miBusy = true;
  if(btn){ btn.disabled = true; btn.textContent = '올리는 중…'; }
  let r = { ok: false };
  try{ r = await closetMod().boxToSlot(avatarId); }catch(_){ r = { ok: false, why: 'err' }; }
  _miBusy = false;
  if(r.ok){ setCurSlot(r.slot); try{ saveCurSlot(); renderLauncher(); }catch(_){} toast('슬롯에 올렸어요'); }
  else closetMod().reportFail(r);
  _miRenderBox();
}
/* 옷장이 바뀌었다(받기 · 옮기기 · 저장) — [내 정보]가 열려 있으면 보관함 줄을 다시 그린다 */
function _miBoxChanged(){ if(_miIsOpen() && _miTab === 'box') _miRenderBox(); _miRenderTrashTab(); }
function _miCodeLoad(){
  if(!closetMod().requireReady()) return;   // 옷장을 받기 전엔 저장 자리를 모른다
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

  const bind = ()=>{
    /* 로그인 · 가입은 게이트(license-gate.js)가 한다 — 여기는 로그아웃 · 탈퇴. */

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
      dCount.textContent = '지울 항목 ' + p.items + '개' + (p.files == null ? '' : ' · 파일 ' + p.files + '개');   // 파일 수를 셀 수 없으면(null) 그 칸은 뺀다
      dCount.style.display = 'block';
    };
    /* 탈퇴 안내를 여는 동안 계정 탭(로그인 수단 ~ 로그아웃)을 숨기고 그 자리에 보인다 — CSS #acctLoggedIn.acct-deleting */
    const delMode = (on) => { const li = $('acctLoggedIn'); if(li) li.classList.toggle('acct-deleting', !!on); };
    if(dBtn) dBtn.onclick = () => {
      dBtn.style.display = 'none';
      delMode(true);
      if(dAgree) dAgree.checked = false;
      if(dWord) dWord.value = '';
      if(dYes) dYes.textContent = '탈퇴하기';
      dSay(''); delShowCount(null); delSync();
      if(dBox) dBox.style.display = 'block';
      const pg = $('lcMyInfo'), zone = $('acctDeleteZone');
      if(pg && zone) try{ pg.scrollTop = Math.max(0, zone.offsetTop - 8); }catch(_){}   // 안내 머리가 보이게
      const cancelBtn = $('acctDeleteCancel'); if(cancelBtn) try{ cancelBtn.focus(); }catch(_){}
      const seq = ++_delSeq;
      _withdrawPreview().then(p => { if(seq === _delSeq) delShowCount(p); }).catch(()=>{});
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
      delMode(false);
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

    refreshAccountTab();
  };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once:true });
  else bind();

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
return {
  _miBoxChanged,
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
