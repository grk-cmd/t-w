/* focus-level.js — ⭐ 포커스 레벨 표시 · 오늘치 쌓기 · 태블릿
   책임: 집중한 초를 오늘치 · 이번 실행 시간에 더하고 서버에 올릴 몫으로 넘긴다(addFocusSeconds) · 서버가 준 레벨 · 별 색을 읽는 이름을 한 곳에 모은다
     (getFocusLevel · myFocusShow · myStarOut · getStarColor · setStarColor — 값의 주인은 focus-progress.js) · 남의 별 모양 받기(starFromRemote) · 별 문자열(lvStarStr) · 📱 태블릿·폰 포커싱 연결.
   레벨 · 회차를 앱이 누적에서 세지 않는다 · 해금 안내 우편은 서버 알림이 한다 · 프로필(Firebase)에 레벨 · 별을 쓰지 않는다.
   ★ 📱 폰 연결은 서버 길이다 — 폰 상태는 realtime `mobileFocus`(on · app · at) 그대로, 키 만들기 · 끊기는 focus-api.js(POST · DELETE /v1/me/focus/mobile-link).
     키 원문은 만들 때 한 번만 오므로 계정 칸 tw.mobileKey 에 둔다(QR 다시 보기). 키 만들기 · 끊기는 «읽은 진척의 주인» 과 묶이므로(expectOwner) 먼저 진척을 받은 뒤에 부른다.
   ★ 밖에서 부르는 이름: STAR_PALETTE · _mobileBubbleText · _mobileCleanApp · _mobileOn · _mobileRoomLabel · startMobile · _seatMobileApp · addFocusSeconds · focusCycleOf · formatHMS · getFocusLevel · getStarColor · lvStarStr · myFocusShow · myStarOut · setStarColor · starFromRemote — app.js 는 focusLevelMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwFocusLevel — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-focus-level.js · sim-focus-progress.js · sim-mobile-focus.js */
(function(){

function createFocusLevel(deps){
const FOCUS_CYCLE_CAP = deps.FOCUS_CYCLE_CAP;
const FOCUS_CYCLE_SEC = deps.FOCUS_CYCLE_SEC;
const FOCUS_LEVEL_CAP_HOURS = deps.FOCUS_LEVEL_CAP_HOURS;
const Presence = deps.Presence;
const _acctDetached = deps._acctDetached;   // 읽는 함수
const progress = deps.progress;   // 서버 진척(focus-progress.js createFocusProgress) — 레벨 · 회차 · 별 색 · 미전송분
const _focusSessionSec = deps._focusSessionSec;   // 읽는 함수
const findMySeat = deps.findMySeat;
const getMyUserId = deps.getMyUserId;
const focusApi = deps.focusApi;   // focus-api.js createFocusApi — 진척과 같은 하나(읽은 주인을 같이 쓴다)
const focusStore = deps.focusStore;   // 계정 칸 get/set/remove(shared/account-store.js)
const notifyError = deps.notifyError;   // TwErrorCodes.notify
const rtOnMessage = deps.rtOnMessage;   // (type, fn) => 해제 함수 — realtime 허브 onMessage
const toast = deps.toast;
const wdDraftDef = deps.wdDraftDef;   // 읽는 함수
const setFocusSessionSec = deps.setFocusSessionSec;   // 쓰는 함수
const addFocusToday = deps.addFocusToday;   // 오늘 시간에 더한다(날 경계는 focus-total.js 가 서버 날로 정한다)
const _focusTotalStarted = deps._focusTotalStarted;   // 읽는 함수 — 계정 칸의 오늘치를 읽은 뒤에만 더하고 쓴다
function addFocusSeconds(sec){
  if(!(sec>0)) return;
  if(!_focusTotalStarted()) return;   // 계정 확인 전 — 쌓지도 쓰지도 않는다
  addFocusToday(sec);
  setFocusSessionSec(_focusSessionSec() + (sec));
  progress.addSeconds(sec);   // 서버에 올릴 몫(미전송분)으로 — 레벨 · 별은 서버가 준 값이다
}
/* ★ 레벨 · 회차 · 별 색은 서버 값이다(focus-progress.js). 해금 레벨은 서버 레벨(999 에서 멈춤) · 표시용 «이번 바퀴» 레벨과 별은 myFocusShow. */
const getFocusLevel = () => progress.getFocusLevel();
const myFocusShow = () => progress.myFocusShow();
/* 방에 싣는 모양 — 회차가 없으면 null(= 지운다 · 옛 판은 모름) */
function myStarOut(){
  const s = myFocusShow();
  return s ? { cyc: s.cyc, clv: s.lv, starC: s.color } : { cyc: null, clv: null, starC: null };
}
const getStarColor = () => progress.getStarColor();
const setStarColor = (c) => progress.setStarColor(c);
const STAR_PALETTE = progress.STAR_PALETTE;
function _starColorOk(c){ return STAR_PALETTE.some(p => p[0] === c); }
/* 누적초 → { cycle: 채운 바퀴 수, lv: 이번 바퀴 안의 레벨(1~999), leftSec: 다음 바퀴까지 남은 초 } */
function focusCycleOf(sec){
  const t = Math.max(0, Math.floor(Number(sec) || 0));
  const inCycle = t % FOCUS_CYCLE_SEC;
  return { cycle: Math.floor(t / FOCUS_CYCLE_SEC), lv: 1 + Math.floor(inCycle / 3600), leftSec: FOCUS_CYCLE_SEC - inCycle };
}
/* 회차 → 별 문자열. ☆ = 1회 · ★ = 2회(반 칸 둘이 한 칸). 1:☆ 2:★ 3:☆★ 4:★★ …
   ☆ 는 홀수일 때만 맨 앞에 하나 — 앞머리만 보면 홀짝이 읽힌다. 6글자를 넘으면(13회차부터) «★×13» 으로 접는다
   (안 접으면 이름표가 옆 캐릭터와 겹친다). 0 이하는 빈 문자열. */
function lvStarStr(n){
  n = Math.max(0, Math.floor(Number(n) || 0));
  if(!n) return '';
  const s = '\u2606'.repeat(n % 2) + '\u2605'.repeat(Math.floor(n / 2));
  return s.length > 6 ? '\u2605\u00d7' + n : s;
}
/* 받는 모양 — 남의 값(프리즌스 · 프로필 · 명함)을 표시용 star 로. 범위 밖 · 모르는 색은 버리거나 첫 색으로.
   ★ 색은 **팔레트 안의 값만** 통과한다 — _lvBadge 가 이 값을 style 문자열에 넣는다. */
function starFromRemote(o){
  if(!o) return null;
  const cyc = Math.min(FOCUS_CYCLE_CAP, parseInt(o.cyc, 10) || 0);
  if(!(cyc >= 1)) return null;
  const lv = Math.max(1, Math.min(FOCUS_LEVEL_CAP_HOURS, parseInt(o.clv, 10) || 1));
  return { cyc, lv, color: _starColorOk(o.starC) ? o.starC : STAR_PALETTE[0][0] };
}

/* 💾 꾸미기를 연 채 앱을 끄면 — 닫는 것이 곧 저장이라 여기서 닫아 준다. 슬롯 저장은 파츠 받기를 기다리기 전에 도니
   종료 전에 끝난다(_commitWdDraftNow). 계정을 놓은 뒤(_wipeAccountLocal)에는 지운 칸을 도로 쓰지 않게 건너뛴다. */
window.addEventListener('beforeunload', ()=>{
  if(_acctDetached() || !wdDraftDef()) return;
  const wp = document.getElementById('wardrobePanel');
  if(wp && wp.classList.contains('on')){ try{ window.closeWardrobe(); }catch(_){} }
});

function formatHMS(sec){ sec=Math.max(0,Math.floor(sec));
  const h=String(Math.floor(sec/3600)).padStart(2,'0'), m=String(Math.floor((sec%3600)/60)).padStart(2,'0'), s=String(sec%60).padStart(2,'0');
  return h+':'+m+':'+s; }

/* 📱 폰 · 태블릿 포커싱 — 기기 자동화(iOS 단축어 · MacroDroid)가 앱 열림 · 닫힘을 서버에 알리면 서버가 realtime 으로 «mobileFocus» 를 보낸다.
   MOBILE_MAX_ON_MS 는 «닫힘» 이 안 온 경우(방전 · 강제 종료)의 안전 상한이다(서버 시각 `at` 기준). */
const MOBILE_MAX_ON_MS = 4*60*60*1000;
const MOBILE_KEY_CELL = 'tw.mobileKey';   // 계정 칸 — 이 PC 가 만든 키 원문(서버는 원문을 저장하지 않아 QR 다시 보기에 필요)
const MOBILE_KEY_RE = /^[A-Z2-9]{24}$/;
const MOBILE_APP_MAX = 40;
const MOBILE_TICK_MS = 60*1000;
const MOBILE_EMPTY = Object.freeze({ on:false, app:'', since:0, seen:false });
let _mobileFocus = MOBILE_EMPTY;   // seen = 이번 실행에 폰 신호를 한 번이라도 받았다
let _mobileKey = null;             // startMobile 이 계정 칸에서 읽는다(만들 때는 계정 칸을 읽지 않는다)
let mobCode = null, mobGen = 0, mobBusy = false;   // 로그인한 계정 · 계정 바뀜 순번(늦은 답 버림) · 키 만들기 · 끊기 중
let _mobileWasOnTick = false;
function _mobileNow(){ try{ if(window.firebaseAPI && firebaseAPI.serverNow) return firebaseAPI.serverNow(); }catch(_){} return Date.now(); }
/* 폰이 지금 «포커싱 어플을 쓰는 중» 인가 — 켜짐 + 상한 안. */
function _mobileOn(){
  const m = _mobileFocus;
  if(!m || !m.on || !m.since) return false;
  return (_mobileNow() - m.since) < MOBILE_MAX_ON_MS;
}
/* 좌석이 띄울 앱 이름 — 남은 받은 값(remoteMobile), 나는 지금 판정. 자리추가 좌석은 안 띄운다. */
function _seatMobileApp(seat){
  if(!seat) return '';
  if(seat.remote) return seat.remoteMobile || '';
  const mine = findMySeat();
  return (seat.isMe || seat === mine) ? _mobileRoomLabel() : '';
}
/* 방에 싣는 값 · 머리 위 말풍선 글자 — 꺼져 있으면 빈 문자열. */
function _mobileRoomLabel(){ return _mobileOn() ? (_mobileFocus.app || '태블릿·폰') : ''; }
function _mobileBubbleText(app){ return app ? ('📱 ' + String(app).slice(0, MOBILE_APP_MAX)) : null; }
function _mobileCleanApp(v){
  if(typeof v !== 'string') return '';
  return v.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, MOBILE_APP_MAX);
}
/* 계정 칸의 키 — 새 값은 키 글자 그대로. 0.12 가 PC 칸에 남긴 { u, k } 도 읽는다(서버가 옛 키를 같은 비밀로 옮겨 받는다). 이 계정 것이 아니면 없는 것 */
function _mobileLoadKey(code){
  const raw = focusStore.get(MOBILE_KEY_CELL);
  if(typeof raw !== 'string') return null;
  if(MOBILE_KEY_RE.test(raw)) return raw;
  try{
    const o = JSON.parse(raw);
    if(o && o.u === code && typeof o.k === 'string' && MOBILE_KEY_RE.test(o.k)) return o.k;
  }catch(_){}
  return null;
}
function _mobileLinkUrl(uid, key){
  // ★ 키는 # 뒤 — 호스팅 서버 로그에 안 남는다(§4-⑤)
  return 'https://help.together-working.com/link#u=' + encodeURIComponent(uid) + '&k=' + encodeURIComponent(key);
}
/* 폰 상태 → 전역. v = { on, app, at } (realtime mobileFocus · at = 서버 시각 ms) · null 이면 비움 */
function _mobileApplyState(v){
  const wasOn = _mobileOn(), wasLabel = _mobileRoomLabel();
  if(!v){
    _mobileFocus = MOBILE_EMPTY;
  } else {
    const on = v.on === true, at = Number(v.at) || 0;
    _mobileFocus = { on, app:_mobileCleanApp(v.app), since: on ? (at || _mobileNow()) : 0, seen:true };
  }
  if(wasOn !== _mobileOn() || wasLabel !== _mobileRoomLabel()) _mobileChanged();
  try{ _mobRenderPanel(); }catch(_){}
}
/* 켜짐/꺼짐이 바뀌면 방에 바로 싣는다(다음 상태 틱을 기다리면 몇 초 늦다). */
function _mobileChanged(){
  try{ if(typeof Presence !== 'undefined' && Presence.broadcastNow) Presence.broadcastNow(); }catch(_){}
}
/* 상한을 넘기는 순간은 새 값이 오지 않으므로 1분마다 한 번 본다(표시 «N분째» 갱신 겸). */
function _mobileTick(){
  const on = _mobileOn();
  if(on !== _mobileWasOnTick){ _mobileWasOnTick = on; _mobileChanged(); }
  try{ _mobRenderPanel(); }catch(_){}
}
/* 계정이 바뀔 때(session.onReset) — 폰 상태 · 키 · 진행 중이던 요청을 비운다(타이머 · 구독은 세션이 푼다) */
function _mobileReset(){
  mobGen++;
  mobCode = null; mobBusy = false; _mobileKey = null; _mobileWasOnTick = false;
  _mobCloseWindow();
  _mobSetBusy(false);
  _mobileApplyState(null);
}
/* 🚀 계정 확인 뒤 한 번(launcher/app-boot.js) — 계정 칸의 키를 읽고, 서버 신호(realtime)와 1분 틱을 건다. 서버에 따로 묻지 않는다(ready 뒤 서버가 4시간 안의 마지막을 보내 준다) */
function startMobile(code, me, session){
  if(mobCode) return;
  mobCode = code;
  session.onReset(_mobileReset);
  _mobileKey = _mobileLoadKey(code);
  session.on(rtOnMessage('mobileFocus', (m)=>{ if(m && mobCode) _mobileApplyState({ on:m.on, app:m.app, at:m.at }); }));   // 계정이 바뀐 뒤(mobCode 없음)에 늦게 온 신호는 버린다
  session.setInterval(_mobileTick, MOBILE_TICK_MS);
  try{ _mobRenderPanel(); }catch(_){}
}
/* ── 📱 설정 › 포커싱어플 칸 + QR 창 (시안 ①~③) ─────────────────────────────
   ★ 그리는 곳은 _mobRenderPanel 하나. 상태가 바뀔 때 · 1분마다 · 창을 열 때 부른다.
   ⚠️ 확인은 2단계 누르기(이 파일 관례) — 네이티브 확인창은 투명 오버레이에서 안 보인다(audit 검사 4). */
function _mobRenderPanel(){
  const st = document.getElementById('fsMobSt'); if(!st) return;
  const main = document.getElementById('fsMobMain'), sub = document.getElementById('fsMobSub');
  const qr = document.getElementById('fsMobQr'), un = document.getElementById('fsMobUnlink'), note = document.getElementById('fsMobNote');
  const paired = !!_mobileKey;
  let cls = 'off', m = '연결 안 됨', sb = '';
  if(_mobileOn()){
    const min = Math.max(0, Math.floor((_mobileNow() - _mobileFocus.since) / 60000));
    cls = 'use'; m = '📱 ' + (_mobileFocus.app || '태블릿·폰') + ' 사용 중';
    sb = (min < 1 ? '방금 시작' : (min + '분째')) + ' · 포커스 시간이 쌓이고 있어요';
  } else if(paired && _mobileFocus.seen){
    cls = 'rest'; m = '연결됨 · 폰에서 쉬는 중';
  } else if(paired){
    sb = '폰에서 [신호 보내 보기]를 눌러 보세요';
  }
  st.className = 'fs-mob-st ' + cls;
  if(main){ main.textContent = m; main.title = m; }
  if(sub){ sub.textContent = sb; sub.style.display = sb ? '' : 'none'; }
  if(qr) qr.textContent = paired ? 'QR 다시 보기' : 'QR로 연결하기';
  if(un && !un._armed){ un.style.display = paired ? '' : 'none'; un.textContent = '연결 끊기'; }
  if(note) note.style.display = paired ? '' : 'none';
}
function _mobDrawQr(text){
  const cv = document.getElementById('mobLinkQr'); if(!cv || !window.TWQR) return false;
  let q; try{ q = TWQR.make(text, 'M'); }catch(_){ return false; }
  const px = Math.max(1, Math.floor(cv.width / q.n)), off = Math.floor((cv.width - px*q.n)/2);
  const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = '#000';
  for(let r = 0; r < q.n; r++) for(let c = 0; c < q.n; c++) if(q.dark(r, c)) g.fillRect(off + c*px, off + r*px, px, px);
  return true;
}
function _mobFillWindow(){
  const uid = mobCode, key = _mobileKey;
  const k = document.getElementById('mobLinkKey');
  if(k) k.textContent = key ? ('••••-' + key.slice(-4)) : '••••';
  if(uid && key && !_mobDrawQr(_mobileLinkUrl(uid, key))) toast('QR 을 그리지 못했어요 — 앱을 다시 시작해 보세요');
}
/* 만들기 · 끊기 중에는 단추를 잠근다(둘이 겹치지 않게) */
function _mobSetBusy(b){
  mobBusy = b;
  ['fsMobQr', 'fsMobUnlink', 'mobLinkRenew'].forEach((id)=>{ const e = document.getElementById(id); if(e) e.disabled = b; });
}
/* 서버 길(focus-api.js)은 «읽은 진척의 주인» 과 묶여 있어 읽기 전에는 요청 없이 stale 이다 — 먼저 진척을 받는다(받는 중이면 기다린다 · 못 받으면 false) */
async function _mobServer(run, fail){
  const g = mobGen, uid = mobCode;
  if(!uid || mobBusy) return null;
  _mobSetBusy(true);
  try{
    if(!(await progress.whenReady())){
      if(g === mobGen) fail(new Error('진척을 받지 못했어요'));
      return null;
    }
    if(g !== mobGen) return null;
    const r = await run(uid);
    if(g !== mobGen || r.status === 'stale') return null;   // 계정이 바뀌는 중 — 조용히 버린다
    if(r.status !== 'ok'){ fail(r.err); return null; }
    return r;
  }finally{
    if(g === mobGen) _mobSetBusy(false);
  }
}
/* 서버에 새 키를 만들어(예전 폰은 끊김) 계정 칸에 기억한다. 성공하면 폰 상태를 비운다. */
async function _mobMakeKey(){
  if(!mobCode){ toast('로그인한 뒤에 연결할 수 있어요'); return false; }
  const r = await _mobServer((uid)=>focusApi.issueMobileKey(uid), (e)=>notifyError('E-FOCUS-08', e));
  if(!r) return false;
  _mobileKey = r.key;
  focusStore.set(MOBILE_KEY_CELL, r.key);
  _mobileApplyState(null);
  return true;
}
async function _mobUnlink(){
  const r = await _mobServer((uid)=>focusApi.unlinkMobile(uid), (e)=>notifyError('E-FOCUS-09', e));
  if(!r) return;
  _mobileKey = null;
  focusStore.remove(MOBILE_KEY_CELL);
  _mobileApplyState(null);
  _mobCloseWindow();
  toast('📱 폰 연결을 끊었어요');
}
async function _mobOpenWindow(){
  const ov = document.getElementById('mobLinkOverlay'); if(!ov) return;
  if(!_mobileKey && !(await _mobMakeKey())) return;
  ov.classList.add('on');
  _mobFillWindow();
  _mobRenderPanel();
}
function _mobCloseWindow(){ const ov = document.getElementById('mobLinkOverlay'); if(ov) ov.classList.remove('on'); }
/* 2단계 누르기 — 처음 누르면 글자가 바뀌고, 4초 안에 한 번 더 누르면 실행. */
function _mobArm(btn, armedText, run){
  if(!btn) return;
  btn.onclick = ()=>{
    if(mobBusy) return;
    if(btn._armed){ clearTimeout(btn._armed); btn._armed = 0; btn.textContent = btn._idleText; run(); return; }
    btn._idleText = btn.textContent; btn.textContent = armedText;
    btn._armed = setTimeout(()=>{ btn._armed = 0; btn.textContent = btn._idleText; }, 4000);
  };
}
{
  const q = document.getElementById('fsMobQr'); if(q) q.onclick = ()=>{ _mobOpenWindow(); };
  _mobArm(document.getElementById('fsMobUnlink'), '한 번 더 누르면 끊겨요', ()=>{ _mobUnlink(); });
  _mobArm(document.getElementById('mobLinkRenew'), '한 번 더 누르면 바뀌어요', async ()=>{
    if(await _mobMakeKey()){ _mobFillWindow(); toast('새 키를 만들었어요 — 폰에서 다시 설정해 주세요'); }
  });
  const c = document.getElementById('mobLinkCopy');
  if(c) c.onclick = ()=>{
    const key = _mobileKey; if(!key) return;
    try{ navigator.clipboard.writeText(key).then(()=>toast('연결 키를 복사했어요'), ()=>toast('복사하지 못했어요')); }catch(_){ toast('복사하지 못했어요'); }
  };
  const x = document.getElementById('mobLinkClose'); if(x) x.onclick = _mobCloseWindow;
  const d = document.getElementById('mobLinkDone');  if(d) d.onclick = _mobCloseWindow;
  try{ _mobRenderPanel(); }catch(_){}
}

return {
  STAR_PALETTE,
  _mobileBubbleText,
  _mobileCleanApp,
  _mobileOn,
  _mobileRoomLabel,
  startMobile,
  _seatMobileApp,
  addFocusSeconds,
  focusCycleOf,
  formatHMS,
  getFocusLevel,
  getStarColor,
  lvStarStr,
  myFocusShow,
  myStarOut,
  setStarColor,
  starFromRemote,
};
}

const api = { createFocusLevel };
if(typeof window !== 'undefined') window.TwFocusLevel = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
