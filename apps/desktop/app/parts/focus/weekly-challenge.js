/* weekly-challenge.js — 👑 달성표 화면(서랍 · 팝업) · 🎯 집중 시간 쌓기 · 🔁 반복 알림 — 상태는 chal-store.js (검사 sim-weekly-challenge.js)
   목표 · 기록 · 보상은 서버 한 주 한 벌이고(chal-store.js), 이 파일은 그 view() 를 그리고 사용자 누름을 store 의 동작으로 넘긴다.
   서랍 화면: 불러오는 중 / 못 불러왔어요 [다시 시도] / 프리미엄 잠김 → 종류 고르기(#chalPick) → 설정(#chalSetup) → 진행 중(#chalRun) · 지난 기록(#chalArc).
   ⚠️ 설정 화면은 _chalRender() 가 다시 그리지 않는다 — 틱이 입력 중인 칸을 덮어쓰면 글자가 사라진다. 설정은 열 때와 값이 바뀔 때만 그린다.
   ⚠️ 게이트: 버튼 클릭 · 🔁반복 알림 · 보상(서버) — isPremium 을 직접 읽지 않는다(TDZ) — premiumOn().
   deps: chalStore(chal-store.js createChalStore) · toast · escHtml · formatHMS · premiumOn · appMode
   내놓는 것: startChallenge(code, me, session)(app-boot) · open · isOpen · focusTick · setKeyPlatform · dayEnded · flush · calc(셈 — 검사용)
   ⚠️ 전역 이름은 TwWeeklyChallenge — 크로미움 내장 전역과 겹치는 이름을 쓰면 typeof 가드가 늘 통과한다(#103).
   검사: checks/sim-weekly-challenge.js · sim-chal-store.js */
(function(){

function createWeeklyChallenge(deps){
const store = deps.chalStore;
const toast = deps.toast;
const escHtml = deps.escHtml;
const formatHMS = deps.formatHMS;
const _premiumOn = deps.premiumOn;              // ⚠️ isPremium 을 직접 읽지 않는다(TDZ) — app.js 의 _premiumOn
const appMode = deps.appMode;                   // 'run' | … — app.js 의 appMode(다시 대입되는 let)
const { PHASE, CELL, ruleItems: _chalRuleItems } = TwChalStore;

const CHAL_RULE_MAX = TwChalStore.RULE_MAX;     // 📋규칙 한 요일당 최대 줄 수
const _chalPh = (key) => PHASE[key] || PHASE.wd;

let _chalPopOpen = false;

/* 🔑 판정 키 — main.js 의 keysOf 와 **같은 규칙**이다(main.js 'focusKeyOf/keysOf' 주석 참고).
   ⚠️ 두 벌이 있는 이유: 여기는 렌더러라 main.js 를 require 할 수 없고, 새 IPC 채널을 파면
     preload 를 고쳐야 한다(sim-ghost-cache-sync.js 의 preload 무수정 규칙).
     ⇒ **한쪽만 고치면 안 된다.** 규칙을 바꿀 땐 반드시 두 파일을 같이 고칠 것.
       sim-sysinput.js 6절이 두 벌이 같은 모양인지 지킨다.
   ★ 승격이 'win:' 고정인 이유도 main.js 와 같다 — key 없는 저장물은 Windows 것뿐이다. */
function _chalKeysOf(rec){
  if(!rec) return [];
  if(Array.isArray(rec.keys)) return rec.keys.filter(Boolean);
  if(rec.key)  return [rec.key];
  if(rec.exe)  return ['win:' + String(rec.exe).toLowerCase()];
  if(rec.name) return ['win:' + String(rec.name).toLowerCase()];
  return [];
}
/* 이 기기의 플랫폼 접두사. main 이 보내주는 활성 상태에서 배운다 — 렌더러가 스스로 OS 를
   판단하지 않는다(그러면 두 곳이 서로 다른 답을 낼 수 있다). 아직 못 받았으면 null. */
let _chalKeyPlatform = null;
/* 달성 조건이 **다른 플랫폼에서 등록된 것**인가. 조용히 안 세는 대신 화면에 말해 주기 위한 표식.
   ⚠️ 이 값이 true 인데 아무 말도 안 하면, 이 작업 전과 증상이 똑같아진다(0초씩 쌓이다 만다). */
let _chalKeyForeign = false;


/* 🎯집중 — _applyActiveAppState(500ms 폴링)에서 dt 를 그대로 받아 쌓는다. 판정 키가 맞으면 store 가 오늘 초에 더한다 */
function _chalFocusTick(state, dt){
  const g = store.liveGoal();
  if(!g || g.kind !== 'focus') return;
  const want = _chalKeysOf(g.cfg);
  if(!want.length) return;
  /* 조건이 이 기기에서 만들어진 것이 아니면 셀 수 없다 — 표식으로 남겨 화면이 말해 준다 */
  if(_chalKeyPlatform){
    _chalKeyForeign = !want.some(k => String(k).split(':')[0] === _chalKeyPlatform);
    if(_chalKeyForeign) return;
  }
  const now = state && state.key
    ? state.key
    : (state && state.exeName ? 'win:' + String(state.exeName).toLowerCase() : '');  // 구버전 main 대비
  /* `keyAlt` = 활성 창의 옛 규칙 키(main.js legacyKeyOf). mac 0.9.7~0.10.0 이 키를 `mac:google chrome.app` 모양으로 저장했다 — 둘 중 하나가 맞으면 센다.
     ⚠️ 옛 main 은 keyAlt 를 안 보낸다 — 없으면 now 하나로만 본다. */
  const alt = state && state.keyAlt ? String(state.keyAlt) : '';
  if(!now || !(want.includes(now) || (alt && want.includes(alt)))) return;
  store.addFocusSec(dt);
}


/* ── 팝업 두 개 — 기존 방 초대 팝업과 같은 배관(app-popup-ov)을 쓴다.
   ⚠️ app-popup-ov 클래스가 있어야 마우스 통과 화이트리스트(app.js 의 closest 목록)에 걸린다.
      빼면 실행 화면에서 클릭이 팝업을 뚫고 뒤로 나간다(audit 검사 2 와 같은 사고). */
function _chalPopup(titleHtml, bodyHtml, buttons){
  const ov = document.createElement('div');
  ov.className = 'app-popup-ov';
  ov.style.cssText = 'position:fixed;inset:0;z-index:9600;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;';
  const box = document.createElement('div');
  box.style.cssText = 'width:300px;background:var(--win-face);border:2px solid;'
    + 'border-color:var(--win-hi) var(--win-lo-2) var(--win-lo-2) var(--win-hi);'
    + 'border-radius:var(--win-radius-el);box-shadow:4px 4px 0 rgba(0,0,0,.35);';
  box.innerHTML =
    '<div style="background:linear-gradient(90deg, var(--win-title-a), var(--win-title-b));color:#fff;padding:5px 8px;font-size:12px;font-weight:bold;">' + titleHtml + '</div>'
    + '<div style="padding:16px 14px;color:var(--ink);font-size:12px;line-height:1.7;">' + bodyHtml + '</div>'
    + '<div style="display:flex;gap:6px;padding:0 14px 14px;justify-content:flex-end;">'
    + buttons.map(b => '<button class="lc-btn' + (b.ghost ? ' ghost' : '') + '" data-a="' + b.a + '" style="min-width:70px;">' + b.t + '</button>').join('')
    + '</div>';
  ov.appendChild(box); document.body.appendChild(ov);
  _chalPopOpen = true;
  return new Promise(res => {
    box.querySelectorAll('[data-a]').forEach(el => {
      el.onclick = () => { try{ ov.remove(); }catch(_){} _chalPopOpen = false; res(el.getAttribute('data-a')); };
    });
  });
}
function _chalShowRepeatPopup(){
  const g = store.liveGoal(), v = store.view();
  if(!g || g.kind !== 'repeat' || !v.rec) return;
  const t = v.rec, c = g.cfg;
  const body = '<b>' + escHtml(c.text || '할 일') + '</b>를 해야 해요!'
    + '<div style="font-size:10px;color:var(--ink-soft);margin-top:6px;">오늘 ' + (t.done|0) + ' / ' + (c.times|0) + '회 · 다음 알림 ' + (c.gap|0) + '시간 뒤</div>';
  _chalPopup('🔁 반복 알림', body, [{a:'ok',t:'했다'},{a:'no',t:'미룬다',ghost:true}]).then(a => { store.repeatAnswer(a === 'ok'); });   // 눌렀든 미뤘든 여기서부터 다시 잰다
}

function _chalShowSettlePopup(s, total, early, phKey, days){
  const ph = _chalPh(phKey);
  const names = (days || []).map((v,i) => v === CELL.OK ? ph.label[i] : null).filter(Boolean).join('·');
  const sub = (txt) => '<div style="font-size:10px;color:var(--ink-soft);margin-top:6px;">' + txt + '</div>';
  const rest = Math.max(0, (total | 0) - (early | 0));
  let line;
  if((total | 0) <= 0)  line = '이번 ' + ph.name + '은 보상을 못 받았어요.' + sub(ph.need1 + '일 이상 달성하면 뽑기 1회예요');
  else if(rest > 0)     line = '<b>가챠 뽑기 ' + rest + '회</b>를 받았어요.'
                             + sub(early ? ('먼저 받은 1회까지 이번 ' + ph.name + ' 합계 ' + total + '회예요') : '파츠 보관함(T)에서 뽑을 수 있어요');
  else                  line = '보상 <b>' + total + '회</b>는 이미 받았어요.' + sub('파츠 보관함(T)에서 뽑을 수 있어요');
  const body = (names ? (names + ' ') : '') + '<b>' + s + '일</b>을 지켰어요.<br>' + line;
  _chalPopup('🏅 이번 ' + ph.name + ' 달성표', body, [{a:'ok',t:'확인'}]);
}


/* ═══ 👑 달성표 — 화면 ═══════════════════════════════════════════════════════ */
let _chalDraft = null;      // {kind, phase, cfg, auto, editing} — 설정 화면이 떠 있는 동안만 존재
let _chalRuleDay = 0;       // 📋규칙 설정에서 지금 보고 있는 칸(주중 0=월 · 주말 0=토)
let _chalBusy = false;      // 저장 요청이 도는 중 — [시작] · [저장] 을 막는다
/* 세그먼트로 지금 **보고 있는** 단계. null = 지금 단계(라이브). 저장하지 않는다 — 이 창의 시선일 뿐이다. */
let _chalView = null;
/* ⚙ 설정(F1) → 포커싱 어플 슬롯 목록의 사본. 🎯집중은 여기 등록된 것 중에서만 고를 수 있다.
   null 은 «아직 안 물어봤다» · [] 는 «물어봤는데 없다» — 합치면 앱을 켜자마자 연 사람에게 «등록해 주세요» 가 잠깐 뜬다. */
let _chalFocusApps = null;
async function _chalRefreshFocusApps(){
  try{
    if(window.companion && companion.getFocusApps){
      const list = (await companion.getFocusApps()) || [];
      _chalFocusApps = list.filter(Boolean);
    }else _chalFocusApps = [];
  }catch(_){ _chalFocusApps = []; }
  try{ if(!_chalDraft && store.view().active === false) _chalRenderPick(store.view()); }catch(_){}
  return _chalFocusApps;
}
const _chalEl = id => document.getElementById(id);

function _chalOpen(on){
  const win = _chalEl('focusLogWin'); if(!win) return;
  win.classList.toggle('chal-on', !!on);
  if(on) win.classList.remove('pomo-on');   // 🍅 뽀모 서랍과 같은 자리 — 하나만 연다
  /* 열 때마다 서버에서 못 받은 상태면 다시 받고, 포커싱 어플 목록도 다시 읽는다(등록하고 돌아온 사람이 많다). 열 때는 늘 지금 단계를 보인다. */
  if(on){ _chalView = null; _chalRefreshFocusApps(); store.openDrawer(); _chalRender(); }
  try{ window._focusLogClamp(); }catch(_){}
}
function _chalIsOpen(){ const w = _chalEl('focusLogWin'); return !!(w && w.classList.contains('chal-on')); }
/* 눌렀는데 안 된 까닭을 한 줄로 */
function _chalWhy(r){
  const why = r && r.reason;
  if(why === 'loading') toast('달성표를 서버에서 불러오는 중이에요 — 잠시 뒤 다시 눌러 주세요');
  else if(why === 'premium') toast('👑 달성표는 프리미엄 전용이에요');
  else if(why === 'dayChanged') toast('날이 바뀌었어요 — 달성표를 닫았다 다시 열어 주세요');
}


function _chalRewardLine(s, r, phKey){
  const ph = _chalPh(phKey);
  const got = (s >= ph.early);                 // 선지급 1회가 이미 나갔다
  const n1 = ph.need1, n2 = ph.need2, due = ph.dueLabel;
  const sub = (txt) => ' <span class="chal-sub">' + txt + '</span>';
  if(s >= n2) return { t:'<b>뽑기 2회</b> 확정!' + (got ? sub('1회는 받았고, 남은 1회는 ' + due + '에') : ''), dim:false };
  if(s + r >= n2) return { t:'앞으로 <b>' + (n2 - s) + '번만 더</b> 달성하면 최대 <b>뽑기 2회</b>를 얻을 수 있어요!'
      + (got ? sub('1회는 이미 받았어요') : ''), dim:false };
  if(got) return { t:'<b>뽑기 1회를 받았어요</b>' + sub('이번 ' + ph.name + ' 2회는 어려워요'), dim:false };
  if(s >= n1) return { t:'<b>뽑기 1회</b> 확정 · ' + due + '에 드려요'
      + (s + r >= ph.early ? sub((ph.early - s) + '번만 더 하면 기다리지 않고 바로 받아요') : ''), dim:false };
  if(s + r >= n1) return { t:'앞으로 <b>' + (n1 - s) + '번만 더</b> 달성하면 <b>뽑기 1회</b>를 얻을 수 있어요!', dim:false };
  return { t:'이번 ' + ph.name + ' 보상은 어려워요', dim:true };
}
/* 트랙 중간 시작 안내 — 시작 요일에 따라 남는 날과 최대 보상이 달라진다.
   ⚠️ 주중 수요일 시작은 3일이라 **다 달성해도 4일에 못 미쳐 1회가 최대**다. 다만 그 1회는
     3일째를 채우는 순간 선지급되므로, 기다리지 않고 금요일에 손에 들어온다.
   ⚠️ 배열 길이는 그 페이즈의 칸 수와 같아야 한다(주중 5 · 주말 2). */
const CHAL_START_MSG = {
  wd: [
    '두 번까지 실패해도 <b>뽑기 2회</b>를 받을 수 있어요.',
    '한 번만 실패해도 보상은 <b>뽑기 1회</b>예요. 세 번 달성하면 그 자리에서 바로 받아요.',
    '<b>다 달성해도 보상은 뽑기 1회</b>예요. 대신 셋째 날을 채우는 순간 바로 받아요.',
    '<b>이틀 다 달성해야 겨우 뽑기 1회</b>예요. 그 1회는 토요일 아침에 드려요.',
    '<b>이번 주중은 보상을 받을 수 없어요.</b> 내일부터 주말 달성표를 시작할 수 있어요.',
  ],
  we: [
    '하루만 달성해도 <b>뽑기 1회</b>를 그 자리에서 받아요. 이틀 다 하면 <b>2회</b>예요.',
    '오늘 하루만 세요. 달성하면 <b>뽑기 1회</b>를 그 자리에서 받아요.',
  ],
};


function _chalRender(){
  const drawer = _chalEl('chalDrawer'); if(!drawer) return;
  const pick = _chalEl('chalPick'), setup = _chalEl('chalSetup'), run = _chalEl('chalRun'), arc = _chalEl('chalArc');
  if(!pick || !setup || !run) return;
  const v = store.view();
  /* 서버 한 벌을 받기 전 · 못 받음 · 프리미엄 잠김 — 서랍 대신 상태 줄만 */
  const stateBox = _chalEl('chalState'), stateMsg = _chalEl('chalStateMsg'), retry = _chalEl('chalRetryBtn');
  const notReady = v.load !== 'ready' || !v.phase;
  if(stateBox){
    stateBox.style.display = notReady ? 'block' : 'none';
    if(notReady && stateMsg) stateMsg.textContent = v.load === 'failed' ? '달성표를 못 불러왔어요'
      : (v.load === 'locked' || !v.premium ? '👑 달성표는 프리미엄 전용이에요' : '달성표를 불러오는 중이에요…');
    if(retry) retry.style.display = v.load === 'failed' ? 'inline-block' : 'none';
  }
  const seg = _chalEl('chalPhaseSeg');
  if(notReady){
    pick.style.display = setup.style.display = run.style.display = 'none';
    if(arc) arc.style.display = 'none';
    if(seg) seg.style.display = 'none';
    return;
  }
  const inSetup = !!_chalDraft;
  /* 세그먼트로 다른 단계를 보고 있으면 그건 지난 기록이다. ⚠️ 설정 화면에서는 세그먼트를 통째로 숨긴다 — 도중에 넘기면 draft 가 날아간다. */
  const viewing = (!inSetup && _chalView && _chalView !== v.phase) ? _chalView : null;
  const inRun = !inSetup && !viewing && v.active;
  pick.style.display  = (!inSetup && !viewing && !inRun) ? 'block' : 'none';
  setup.style.display = inSetup ? 'block' : 'none';
  run.style.display   = inRun ? 'block' : 'none';
  if(arc) arc.style.display = viewing ? 'block' : 'none';
  _chalRenderSeg(v, inSetup, viewing);
  if(inSetup) return;                 // 설정 화면은 여기서 다시 그리지 않는다
  if(viewing) _chalRenderArc(viewing);
  else if(inRun) _chalRenderRun(v);
  else _chalRenderPick(v);
}

/* 단계 세그먼트 — 지금 단계와 지난 기록을 오간다. 라벨에 '기록'이 붙은 쪽이 지난 기록이다. */
function _chalRenderSeg(v, hide, viewing){
  const seg = _chalEl('chalPhaseSeg'); if(!seg) return;
  seg.style.display = hide ? 'none' : 'flex';
  if(hide) return;
  const live = v.phase, cur = viewing || live;
  const bWd = _chalEl('chalPhWd'), bWe = _chalEl('chalPhWe');
  if(bWd){ bWd.classList.toggle('on', cur === 'wd'); bWd.textContent = '주중 · 월~금' + (live === 'wd' ? '' : ' 기록'); }
  if(bWe){ bWe.classList.toggle('on', cur === 'we'); bWe.textContent = '주말 · 토·일' + (live === 'we' ? '' : ' 기록'); }
}

/* 지난 단계 — 표와 결과만 보여주는 읽기 전용 화면. 지난 주말은 지난 주를 눌렀을 때 한 번 받는다 */
function _chalRenderArc(phKey){
  const ph = _chalPh(phKey), a = store.arcView(phKey);
  const head = _chalEl('chalArcHead'), wk = _chalEl('chalArcWeek'), sum = _chalEl('chalArcSum');
  if(a.state !== 'ready'){
    if(head) head.textContent = '지난 ' + ph.name + ' 기록';
    if(wk) wk.innerHTML = '';
    if(sum) sum.innerHTML = a.state === 'failed' ? '기록을 못 불러왔어요.' : (a.state === 'loading' ? '불러오는 중이에요…' : '아직 ' + ph.name + ' 달성표 기록이 없어요.');
    return;
  }
  if(head) head.textContent = a.range + ' · ' + ph.name;
  if(wk){
    wk.innerHTML = a.cells.map((c, i) => {
      const cls = c === CELL.OK ? ' ok' : (c === CELL.FAIL ? ' no' : '');
      const mark = c === CELL.OK ? '✓' : (c === CELL.FAIL ? '✗' : '·');
      return '<div class="chal-day"><div class="dn">' + ph.label[i]
        + '</div><div class="chal-cell' + cls + '">' + mark + '</div></div>';
    }).join('');
  }
  if(sum) sum.innerHTML = a.kind ? '<b>' + (a.s | 0) + '일</b> 달성 · ' + _chalCfgLabel(a.kind, a.cfg) + '<br>보상 <b>가챠 뽑기 ' + (a.tickets | 0) + '회</b>'
    : '이 ' + ph.name + '에는 목표가 없었어요.';
}

function _chalRenderPick(v){
  const phKey = v.phase, ph = _chalPh(phKey), we = (phKey === 'we');
  const idx = store.todayIdx(phKey);
  const autoBtn = _chalEl('chalAutoBtn'), autoLine = _chalEl('chalAutoLine'), warn = _chalEl('chalStartWarn');
  const lbl = _chalEl('chalPickLabel'), hint = _chalEl('chalPickHint');
  const last = v.goal, auto = v.auto;   // 쉬는 중이어도 목표는 남아 있다 — 자동 시작이 이어받는다
  if(lbl) lbl.textContent = '무엇을 ' + ph.n + '일 동안 이어갈까요';
  if(hint) hint.textContent = v.skipped
    ? '이번 ' + ph.name + '은 쉬고 있어요. 종류를 고르면 다시 시작해요.'
    : '이번 ' + ph.name + '에 하나만 골라요. 고른 종류는 ' + ph.label[ph.n - 1] + '요일까지 이어지고, 바꾸려면 포기하고 다시 시작해야 해요.';
  if(autoBtn){
    const can = !!last;
    autoBtn.disabled = !can;
    autoBtn.classList.toggle('off', !(can && auto));
    autoBtn.textContent = (can && auto) ? '자동 ✓' : '자동';
    autoBtn.title = '지난 ' + ph.name + ' 조건으로 매주 ' + ph.label[0] + '요일에 자동 시작';
  }
  if(autoLine){
    if(auto && last){
      autoLine.style.display = 'block';
      autoLine.innerHTML = '매주 ' + ph.label[0] + '요일에 <b>' + _chalCfgLabel(last.kind, last.cfg)
        + '</b>으로 알아서 시작해요. 끄려면 [자동]을 누르세요.';
    }else autoLine.style.display = 'none';
  }
  /* 🎯집중은 포커싱 어플이 하나도 없으면 고를 수 없다. 카드를 감추지 않고 흐리게 두고 이유를 붙인다. */
  const kf = _chalEl('chalKindFocus'), kfw = _chalEl('chalKindFocusWhy');
  const noApps = (_chalFocusApps !== null && _chalFocusApps.length === 0);
  if(kf) kf.classList.toggle('off', noApps);
  if(kfw) kfw.style.display = noApps ? 'block' : 'none';
  if(warn){
    const msgs = CHAL_START_MSG[phKey] || [];
    if(idx > 0){
      warn.style.display = 'block';
      warn.innerHTML = '오늘은 ' + ph.label[idx] + '요일이라 이번 ' + ph.name + '은 <b>' + (ph.n - idx) + '일('
        + ph.label.slice(idx).join('·') + ')</b>만 세요. ' + (msgs[idx] || '');
    }else if(idx === 0 && we){
      warn.style.display = 'block';           // 주말은 첫날부터 규칙이 다르니 늘 한 줄 붙인다
      warn.innerHTML = msgs[0] || '';
    }else warn.style.display = 'none';
  }
}


function _chalRenderRun(v){
  const phKey = v.phase, ph = _chalPh(phKey), idx = store.todayIdx(phKey);
  const days = v.cells, t = v.rec || {}, c = v.goal.cfg, kind = v.goal.kind;
  const s = v.s, r = v.r;
  const range = _chalEl('chalRunRange'), cnt = _chalEl('chalRunCount');
  if(range) range.innerHTML = '이번 ' + ph.name + ' · ' + v.range + (v.auto ? '<span class="chal-badge">자동</span>' : '');
  if(cnt) cnt.textContent = s + '일 달성';

  const wk = _chalEl('chalWeek');
  if(wk){
    /* 🎰 선지급 표식은 요일이 아니라 **몇 번째 ✓ 인가**에 붙는다 — 월요일을 놓치고 화·수·목을 채운 사람에게 수요일 칸이 아직 두 번째다. */
    const payAt = v.earlyGot ? ph.early : 0;
    let okSeen = 0;
    wk.innerHTML = days.map((d, i) => {
      const cls = d === CELL.OK ? ' ok' : d === CELL.FAIL ? ' no' : (d === CELL.NOW ? ' now' : '');
      const mark = d === CELL.OK ? '✓' : d === CELL.FAIL ? '✗' : (d === CELL.NOW ? '●' : '·');
      if(d === CELL.OK) okSeen++;
      const pay = (payAt && d === CELL.OK && okSeen === payAt) ? '<i class="chal-pay">1</i>' : '';
      return '<div class="chal-day' + (i === idx ? ' now' : '') + '"><div class="dn">' + ph.label[i]
        + '</div><div class="chal-cell' + cls + '">' + mark + pay + '</div></div>';
    }).join('');
  }

  const box = _chalEl('chalToday');
  if(box){
    if(kind === 'focus'){
      const goal = Math.max(1, (c.hours|0)) * 3600, cur = Math.min(goal, t.sec || 0);
      box.innerHTML = '<div class="t1">🎯 ' + escHtml(c.label || String(c.key || '').replace(/^[a-z]+:/, '') || '앱') + ' · 하루 ' + (c.hours|0) + '시간</div>'
        + '<div class="t2">오늘 ' + formatHMS(t.sec || 0) + ' / ' + formatHMS(goal) + '</div>'
        + '<div class="chal-bar"><i style="width:' + Math.round(cur / goal * 100) + '%"></i></div>';
    }else if(kind === 'repeat'){
      const n = c.times | 0, d = Math.min(n, t.done | 0);
      const left = t.fail ? '오늘은 시간이 모자라요 — 내일 다시'
        : (d >= n ? '오늘 다 했어요!' : '다음 알림 ' + (c.gap|0) + '시간 간격');
      box.innerHTML = '<div class="t1">🔁 ' + escHtml(c.text || '할 일') + '</div>'
        + '<div class="t2">오늘 ' + d + ' / ' + n + '회 · ' + left + '</div>'
        + '<div class="chal-dots">' + '✓'.repeat(d) + '○'.repeat(Math.max(0, n - d)) + '</div>';
    }else{
      const items = idx < 0 ? [] : _chalRuleItems(c, idx);
      const ck = t.checks || {};
      box.innerHTML = '<div class="t1">📋 오늘 ' + items.filter((_, i) => ck[i]).length + ' / ' + items.length + '</div>'
        + '<div class="chal-todolist" id="chalTodayChecks">'
        + items.map((x, i) => '<div data-i="' + i + '"' + (ck[i] ? ' class="done"' : '') + '>' + (ck[i] ? '☑' : '☐') + ' ' + escHtml(x) + '</div>').join('')
        + '</div>';
    }
  }
  const pend = _chalEl('chalPendNote');
  if(pend) pend.style.display = v.pending ? 'block' : 'none';
  const rw = _chalEl('chalReward');
  if(rw){ const line = _chalRewardLine(s, r, phKey); rw.innerHTML = line.t; rw.classList.toggle('dim', line.dim); }
  /* 서버에 적지 못한 것 — 사용자가 누르는 길(D5-Q3 · 오늘 달성 다시 적기) */
  const post = _chalEl('chalPostBtn'), claim = _chalEl('chalClaimBtn');
  if(post) post.style.display = (v.met && !v.posted && v.postFailed) ? 'inline-block' : 'none';
  if(claim) claim.style.display = (v.claimFailed && v.claimable.length) ? 'inline-block' : 'none';
}


function _chalCfgLabel(kind, cfg){
  const c = cfg || {};
  if(kind === 'focus')  return '🎯 ' + escHtml(String(c.label || String(c.key || '').replace(/^[a-z]+:/, '') || '앱').replace(/\.exe$/i, '')) + ' ' + (c.hours|0) + '시간';
  if(kind === 'repeat') return '🔁 ' + escHtml(c.text || '할 일') + ' 하루 ' + (c.times|0) + '회';
  if(kind === 'rule')   return '📋 요일별 체크표';
  return '';
}


/* ── 설정 화면 ────────────────────────────────────────────────────────────── */
function _chalDefaultCfg(kind, phKey){
  if(kind === 'focus')  return { key:'', label:'', hours:4 };
  if(kind === 'repeat') return { text:'', times:3, gap:2 };
  /* 📋규칙은 **그 페이즈의 칸 수만큼** 줄을 만든다 — 주말에 5칸을 만들면 화면에 없는 요일이 셋
     생기고, [시작] 검사가 그 빈 요일에 걸려 영영 시작이 안 된다(원인이 화면에 안 보인다). */
  const n = _chalPh(phKey).n, rules = [];
  for(let i = 0; i < n; i++) rules.push([]);
  return { rules:rules };
}
function _chalOpenSetup(kind, editing){
  const v = store.view(), phKey = v.phase;
  if(!phKey) return;
  const base = editing && v.goal ? ((v.pending && v.pending.cfg) || v.goal.cfg) : null;
  const auto = v.auto;
  _chalDraft = {
    kind: kind,
    phase: phKey,
    cfg: JSON.parse(JSON.stringify(base || _chalDefaultCfg(kind, phKey))),
    auto: !!auto,
    editing: !!editing,
  };
  /* 옛 저장(주말 개념이 없던 시절)이나 [자동]으로 되살린 조건은 rules 길이가 안 맞을 수 있다.
     ⚠️ 여기서 칸 수에 맞춰 두지 않으면 주말 화면이 rules[2..4] 를 못 그리고, 반대로 주중에서는
       없는 요일을 비어 있다고 판정해 [시작]이 막힌다. */
  if(kind === 'rule'){
    const n = _chalPh(phKey).n, rs = _chalDraft.cfg.rules || [];
    _chalDraft.cfg.rules = [];
    for(let i = 0; i < n; i++) _chalDraft.cfg.rules.push(Array.isArray(rs[i]) ? rs[i] : []);
  }
  _chalRuleDay = Math.max(0, store.todayIdx(phKey));
  _chalRenderSetup();
  _chalRender();
}
/* force=true 면 **입력 중인 칸까지** 값을 다시 써 넣는다.
   ⚠️ 평소(force 없음)에는 포커스가 있는 칸을 건드리지 않는다 — 타이핑하는 도중에 덮어쓰면
     글자가 사라지거나 커서가 맨 뒤로 튄다. ▲▼ 를 눌렀을 때와 blur 때만 force 로 부른다. */
function _chalRenderSetup(force){
  if(!_chalDraft) return;
  const k = _chalDraft.kind, c = _chalDraft.cfg;
  const show = (id, on) => { const e = _chalEl(id); if(e) e.style.display = on ? 'block' : 'none'; };
  show('chalSetFocus',  k === 'focus');
  show('chalSetRepeat', k === 'repeat');
  show('chalSetRule',   k === 'rule');
  const startBtn = _chalEl('chalStartBtn');
  if(startBtn) startBtn.textContent = _chalDraft.editing ? '저장' : '시작';
  const chk = _chalEl('chalAutoChk');
  if(chk){ const i = chk.querySelector('i'); if(i) i.textContent = _chalDraft.auto ? '✓' : ''; }

  if(k === 'focus'){
    const app = _chalEl('chalFocusApp'), hrs = _chalEl('chalFocusHours'), hint = _chalEl('chalFocusHint');
    /* 판정 키에서 보이는 이름을 뽑는다 — 'win:chrome.exe' → 'chrome'.
       옛 판본에서 창 제목이 label 로 저장된 사람도 여기서 같은 이름으로 보인다.
       (서버에 저장된 cfg 는 안 건드린다. 판정은 key 로만 하므로 표시만 맞추면 된다) */
    const k0 = (_chalKeysOf(c)[0] || '');
    /* 🍎 [2026-09-30] mac 키는 이제 번들 id(`mac:com.google.chrome`)라 키에서 뽑으면 사람이 못 읽는다.
         mac 은 고를 때 함께 저장한 표시 이름(cfg.label = 'Google Chrome')을 먼저 쓴다.
         옛 키(`google chrome.app`)는 label 이 없을 때만 키에서 뽑고 `.app` 을 뗀다. win 은 그대로다. */
    const shown = k0
      ? ((/^mac:/.test(k0) && c.label) ? String(c.label) : k0.replace(/^[a-z]+:/, '').replace(/\.(exe|app)$/i, ''))
      : (c.label || '');
    if(app) app.textContent = shown || '아직 안 골랐어요';
    _chalPutNum(hrs, c.hours, force);
    /* ★ 다른 플랫폼에서 등록한 조건이면 **말해 준다.** 여기서 침묵하면 시간이 0초씩 쌓이다 마는데
         에러도 안 나서, 사용자는 달성표가 고장 난 줄로만 안다(이 작업이 없애려던 증상 그대로). */
    const foreign = !!(k0 && _chalKeyPlatform && k0.split(':')[0] !== _chalKeyPlatform);
    if(hint) hint.textContent = foreign
      ? '이 조건은 다른 기기(' + k0.split(':')[0] + ')에서 등록한 거예요. 여기서는 셀 수 없으니 앱을 다시 골라 주세요.'
      : '다음 날 오전 6시가 되기 전까지 ' + (c.hours|0) + '시간을 채워 달성하세요!';
  }else if(k === 'repeat'){
    const tx = _chalEl('chalRepeatText'), tm = _chalEl('chalRepeatTimes'), gp = _chalEl('chalRepeatGap'), hint = _chalEl('chalRepeatHint');
    if(tx && document.activeElement !== tx) tx.value = c.text || '';
    _chalPutNum(tm, c.times, force);
    _chalPutNum(gp, c.gap, force);
    if(hint) hint.textContent = '실행 화면에 들어간 때부터 ' + (c.gap|0) + '시간마다 물어봐요. [했다]를 ' + (c.times|0) + '번 눌러야 그날 달성이에요.';
  }else{
    /* 요일 탭을 **여기서 만든다** — HTML 에 월~금 다섯 개를 박아두면 주말 설정에서
       수·목·금 탭이 남아 없는 칸을 편집하게 된다. 클릭은 컨테이너에 위임돼 있다. */
    const days = _chalEl('chalRuleDays');
    const lab = _chalPh(_chalDraft.phase).label;
    if(days) days.innerHTML = lab.map((d, i) => '<button class="chal-wday' + (i === _chalRuleDay ? ' on' : '')
      + '" type="button" data-d="' + i + '">' + d + '</button>').join('');
    _chalRenderRuleList();
  }
}
/* ── 숫자 칸(시간·회·간격) — ▲▼ 와 직접 입력 둘 다 ──────────────────────────
   ⚠️ **타이핑 도중에는 범위로 자르지 않는다.** 1~12 인 칸에서 '12'를 치려면 먼저 '1'을 쳐야 하는데
     그 순간 잘라 버리면 두 번째 글자를 칠 수 없다. 그래서 입력 중에는 숫자만 걸러 두고,
     포커스가 빠질 때(blur)·Enter·[시작] 에서 범위로 맞춘다.
   ⚠️ 다 지운 빈 칸도 허용한다 — 지우고 새로 치는 게 정상 조작이다. 비운 채로 나가면
     blur 에서 **원래 값으로 되돌린다**(0 으로 떨어뜨리지 않는다). */
function _chalPutNum(el, v, force){
  if(!el) return;
  if(!force && document.activeElement === el) return;   // 입력 중인 칸은 안 건드린다
  el.value = String(v | 0);
}
function _chalClampNum(raw, lo, hi, fallback){
  const n = parseInt(String(raw == null ? '' : raw).replace(/[^0-9]/g, ''), 10);
  if(!isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}
function _chalBindNum(id, get, set, lo, hi){
  const el = _chalEl(id); if(!el) return;
  el.addEventListener('input', ()=>{
    if(!_chalDraft) return;
    const raw = el.value.replace(/[^0-9]/g, '').slice(0, 2);   // 붙여넣기로 들어온 글자도 걸러낸다
    if(raw !== el.value) el.value = raw;
    if(raw === '') return;                                     // 다 지운 상태는 그대로 둔다
    const n = parseInt(raw, 10);
    if(n >= lo && n <= hi){ set(n); _chalRenderSetup(); }       // 범위 안일 때만 안내 문구를 따라 갱신
  });
  el.addEventListener('blur', ()=>{
    if(!_chalDraft) return;
    set(_chalClampNum(el.value, lo, hi, get() || lo));
    _chalRenderSetup(true);
  });
  el.addEventListener('keydown', e=>{
    if(!_chalDraft) return;
    if(e.key === 'Enter'){ e.preventDefault(); el.blur(); return; }
    // ▲▼ 버튼과 같은 조작을 키보드로도 — 숫자 칸에서 방향키는 이게 자연스럽다
    if(e.key === 'ArrowUp' || e.key === 'ArrowDown'){
      e.preventDefault();
      set(Math.max(lo, Math.min(hi, (get() | 0) + (e.key === 'ArrowUp' ? 1 : -1))));
      _chalRenderSetup(true);
    }
  });
}
function _chalRenderRuleList(){
  const box = _chalEl('chalRuleList'); if(!box || !_chalDraft) return;
  const rows = (_chalDraft.cfg.rules[_chalRuleDay] || []);
  /* 📋규칙은 **오늘 요일 탭만** 잠근다 — 오늘 판정에 쓰이는 값이라서다. 나머지 요일은 자유롭게 고친다. */
  const locked = _chalDraft.editing && _chalRuleDay === store.todayIdx(_chalDraft.phase);
  box.innerHTML = rows.map((x, i) =>
      /* `escHtml` 이 `"` 까지 막으므로 뒤에 붙어 있던 `.replace(/"/g,'&quot;')` 는 지웠다 —
         옛 헬퍼가 `"` 를 안 막는 걸 전제로 덧붙인 자리였다. 남겨도 찾을 `"` 가 없어 무해하지만,
         "여기는 따로 챙겨야 한다"는 잘못된 신호를 남긴다. */
      '<div class="li"><input type="text" maxlength="24" data-i="' + i + '" value="' + escHtml(x) + '"'
      + (locked ? ' disabled' : '') + '><span class="del" data-del="' + i + '">' + (locked ? '' : '✕') + '</span></div>').join('')
    + (locked ? '<div class="add" style="cursor:default;">오늘 것은 내일부터 바꿀 수 있어요</div>'
              : (rows.length < CHAL_RULE_MAX ? '<div class="add" data-add="1">＋</div>' : ''));
}


/* ── 바인딩 ──────────────────────────────────────────────────────────────── */
(function bindChal(){
  const btn = _chalEl('chalBtn'); if(!btn) return;
  const on = (id, fn) => { const e = _chalEl(id); if(e) e.onclick = fn; };

  btn.onclick = () => {
    /* ⚠️ 게이트 ① — isPremium 을 직접 읽으면 TDZ 로 앱이 통째로 안 켜진다. 반드시 _premiumOn(). */
    if(!_premiumOn()){ try{ toast('👑 달성표는 프리미엄 전용이에요'); }catch(_){} return; }
    if(_chalIsOpen()){ _chalOpen(false); return; }
    _chalDraft = null;
    if(store.load() === 'locked'){ toast('👑 달성표는 프리미엄 전용이에요'); return; }
    _chalOpen(true);
  };

  on('chalKindFocus',  async ()=>{
    /* 목록을 아직 안 읽었으면 여기서 읽고 판단한다 — 캐시가 비었다고 무조건 막으면
       열자마자 누른 사람이 억울하게 걸린다. */
    const list = (_chalFocusApps === null) ? await _chalRefreshFocusApps() : _chalFocusApps;
    if(!list.length){
      try{ toast('⚙ 설정(F1)의 포커싱 어플에 프로그램을 먼저 등록해 주세요'); }catch(_){}
      _chalRenderPick();
      return;
    }
    _chalOpenSetup('focus');
  });
  on('chalKindRepeat', ()=> _chalOpenSetup('repeat'));
  on('chalKindRule',   ()=> _chalOpenSetup('rule'));
  on('chalAutoBtn', async ()=>{
    const v = store.view();
    if(!v.goal) return;
    const r = await store.setAutoNext(v.phase, !v.auto);
    if(!r.ok) _chalWhy(r);
    _chalRender();
  });
  /* 페이즈 세그먼트 — 지금 트랙과 같은 쪽을 누르면 라이브로 돌아온다. */
  const segGo = (p) => {
    _chalView = (p === store.view().phase) ? null : p;
    _chalRender();
    try{ window._focusLogClamp(); }catch(_){}
  };
  on('chalRetryBtn', ()=>{ store.reload(true); _chalRender(); });
  on('chalPostBtn', async ()=>{ const r = await store.retryPost(); if(!r.ok) _chalWhy(r); _chalRender(); });
  on('chalClaimBtn', async ()=>{ const r = await store.claimNow(); if(!r.ok) _chalWhy(r); _chalRender(); });
  on('chalPhWd', ()=> segGo('wd'));
  on('chalPhWe', ()=> segGo('we'));
  on('chalAutoChk', ()=>{ if(!_chalDraft) return; _chalDraft.auto = !_chalDraft.auto; _chalRenderSetup(); });
  on('chalBackBtn', ()=>{ _chalDraft = null; _chalRender(); });

  // 🎯집중 — 앱 고르기. 목록은 companion 이 들고 있다(포커싱 어플 슬롯).
  on('chalFocusPick', async ()=>{
    const box = _chalEl('chalFocusList'); if(!box || !_chalDraft) return;
    if(box.style.display === 'block'){ box.style.display = 'none'; return; }
    const list = await _chalRefreshFocusApps();
    box.style.display = 'block';
    box.innerHTML = list.length
      ? list.map(a => {
          /* ★ **F1 설정과 같은 문법**으로 보여준다 — 굵은 글씨는 `.exe` 를 뗀 실행파일 이름,
               그 아래 작은 글씨가 창 제목이다(설정의 슬롯 표시도, 창 목록 고르기도 그렇다).
             ⚠️ 예전엔 창 제목을 주 이름으로 썼다. 창 제목에는 열어 둔 문서 이름이 붙어 그때그때
               바뀌므로, 같은 앱이 설정에서와 다른 이름으로 보였다 —
               "이름이 이상해서 딴 프로그램인 줄 알았다"는 제보가 여기서 나왔다. */
          const label = String(a.name || '').replace(/\.exe$/i, '');
          /* 지역 헬퍼 `attr` 을 지우고 escHtml 을 직접 쓴다 — 그 헬퍼는
               `escHtml` + `"` 덧붙임이었는데 이제 escHtml 하나로 같은 일이 끝난다. */
          return '<div class="li pick" data-key="' + escHtml(String(a.key || '')) + '" data-exe="' + escHtml(a.name) + '" data-label="' + escHtml(label) + '">'
            + '<b>' + escHtml(label) + '</b>'
            + (a.title ? '<span class="sub">' + escHtml(a.title) + '</span>' : '')
            + '</div>';
        }).join('')
      : '<div class="add" style="cursor:default;">⚙ 설정(F1)의 포커싱 어플에 프로그램을 먼저 등록해 주세요</div>';
    box.querySelectorAll('[data-exe]').forEach(el => {
      el.onclick = () => {
        if(!_chalDraft) return;
        /* ⚠️ 슬롯 **번호**를 저장하면 안 된다. 다른 슬롯을 해제하면 뒤 슬롯이 앞으로 당겨져서
           (main.js companion:clearFocusApp) 감시 대상이 조용히 다른 앱으로 바뀐다. 판정 키로 잡는다. */
        const exe = String(el.getAttribute('data-exe') || '').toLowerCase();
        _chalDraft.cfg.key = String(el.getAttribute('data-key') || '') || ('win:' + exe);   // 판정은 이 키 하나다(서버 goal.app)
        /* ⚠️ label 을 el.textContent 로 줍지 말 것 — 줄 안에 exe 이름(.sub)이 같이 들어 있어서
           "메모장Memo" 처럼 붙은 이름이 저장된다. data-label 로 따로 받는다. */
        _chalDraft.cfg.label = el.getAttribute('data-label') || exe.replace(/\.exe$/i, '');
        box.style.display = 'none';
        _chalRenderSetup();
      };
    });
  });
  const spin = (id, get, set, lo, hi) => on(id, ()=>{ if(!_chalDraft) return; set(Math.max(lo, Math.min(hi, get() + (id.endsWith('Up') ? 1 : -1)))); _chalRenderSetup(true); });
  spin('chalFocusUp',      ()=>_chalDraft.cfg.hours|0, v=>_chalDraft.cfg.hours=v, 1, 12);
  spin('chalFocusDn',      ()=>_chalDraft.cfg.hours|0, v=>_chalDraft.cfg.hours=v, 1, 12);
  spin('chalRepeatTimesUp',()=>_chalDraft.cfg.times|0, v=>_chalDraft.cfg.times=v, 1, 10);
  spin('chalRepeatTimesDn',()=>_chalDraft.cfg.times|0, v=>_chalDraft.cfg.times=v, 1, 10);
  spin('chalRepeatGapUp',  ()=>_chalDraft.cfg.gap|0,   v=>_chalDraft.cfg.gap=v,   1, 8);
  spin('chalRepeatGapDn',  ()=>_chalDraft.cfg.gap|0,   v=>_chalDraft.cfg.gap=v,   1, 8);
  // 같은 값을 ▲▼ 와 타이핑 양쪽으로 고칠 수 있게 한다. 범위는 위 spin 과 반드시 같아야 한다.
  _chalBindNum('chalFocusHours', ()=>_chalDraft.cfg.hours|0, v=>_chalDraft.cfg.hours=v, 1, 12);
  _chalBindNum('chalRepeatTimes',()=>_chalDraft.cfg.times|0, v=>_chalDraft.cfg.times=v, 1, 10);
  _chalBindNum('chalRepeatGap',  ()=>_chalDraft.cfg.gap|0,   v=>_chalDraft.cfg.gap=v,   1, 8);
  const rt = _chalEl('chalRepeatText');
  if(rt) rt.addEventListener('input', ()=>{ if(_chalDraft) _chalDraft.cfg.text = rt.value; });

  /* ⚠️ 요일 탭은 _chalRenderSetup 이 매번 다시 만든다(페이즈마다 개수가 다르다).
     그래서 버튼마다 onclick 을 걸면 다시 그린 순간 전부 죽는다 — 컨테이너에 위임한다. */
  const rd = _chalEl('chalRuleDays');
  if(rd) rd.addEventListener('click', e => {
    if(!_chalDraft) return;
    const b = e.target.closest && e.target.closest('[data-d]'); if(!b) return;
    _chalRuleDay = +b.getAttribute('data-d');
    _chalRenderSetup();
  });
  const rl = _chalEl('chalRuleList');
  if(rl){
    rl.addEventListener('click', e=>{
      if(!_chalDraft) return;
      const rows = _chalDraft.cfg.rules[_chalRuleDay] || (_chalDraft.cfg.rules[_chalRuleDay] = []);
      const del = e.target.getAttribute && e.target.getAttribute('data-del');
      if(del != null){ rows.splice(+del, 1); _chalRenderRuleList(); return; }
      if(e.target.getAttribute && e.target.getAttribute('data-add')){ if(rows.length < CHAL_RULE_MAX){ rows.push(''); _chalRenderRuleList(); } }
    });
    rl.addEventListener('input', e=>{
      if(!_chalDraft) return;
      const i = e.target.getAttribute && e.target.getAttribute('data-i');
      if(i != null) (_chalDraft.cfg.rules[_chalRuleDay] || [])[+i] = e.target.value;
    });
  }

  on('chalStartBtn', async ()=>{
    if(!_chalDraft || _chalBusy) return;
    const k = _chalDraft.kind, c = _chalDraft.cfg;
    /* ⚠️ 마지막 안전망 — 숫자 칸을 비우거나 범위 밖으로 둔 채 바로 [시작]을 누르는 경로가 있다. */
    if(k === 'focus')  c.hours = _chalClampNum(c.hours, 1, 12, 4);
    if(k === 'repeat'){ c.times = _chalClampNum(c.times, 1, 10, 3); c.gap = _chalClampNum(c.gap, 1, 8, 2); }
    if(k === 'focus' && !c.key){ try{ toast('잴 앱을 먼저 골라 주세요'); }catch(_){} return; }
    if(k === 'repeat' && !String(c.text || '').trim()){ try{ toast('지킬 일을 적어 주세요'); }catch(_){} return; }
    if(k === 'repeat') c.text = String(c.text).trim();
    if(k === 'rule'){
      /* 세는 요일 중 비어 있는 날이 있으면 시작을 막는다 — 빈 요일은 체크할 것이 없어 영영 달성이 안 된다. */
      const ph = _chalPh(_chalDraft.phase);
      const from = _chalDraft.editing ? 0 : Math.max(0, store.todayIdx(_chalDraft.phase));
      for(let i = from; i < ph.n; i++){
        if(!_chalRuleItems(c, i).length){ try{ toast(ph.label[i] + '요일 체크표가 비어 있어요'); }catch(_){} return; }
      }
      c.rules = c.rules.map(rows => (rows || []).map(x => String(x || '').trim()).filter(Boolean).slice(0, CHAL_RULE_MAX));
    }
    _chalBusy = true;
    const btn = _chalEl('chalStartBtn'); if(btn) btn.disabled = true;
    let r;
    try{ r = _chalDraft.editing ? await store.edit(_chalDraft.phase, k, c, _chalDraft.auto) : await store.start(_chalDraft.phase, k, c, _chalDraft.auto); }
    finally{ _chalBusy = false; if(btn) btn.disabled = false; }
    if(r.ok){
      /* [수정]은 다음 날 것부터 적용한다(서버가 그날 06:00 에 바꾼다). 오늘 판정에 쓰는 값을 그 자리에서 바꾸면 이미 지난 시간의 기준이 뒤바뀐다. */
      if(_chalDraft && _chalDraft.editing){ try{ toast('수정한 내용은 내일부터 적용돼요'); }catch(_){} }
      _chalDraft = null;
    }else{
      if(r.reason === 'dayChanged' || r.reason === 'conflict') _chalDraft = null;   // 오늘이 달라졌거나 서버 값으로 바뀌었다 — 초안은 더 맞지 않는다
      _chalWhy(r);
    }
    _chalRender();
    try{ window._focusLogClamp(); }catch(_){}
  });

  on('chalEditBtn', ()=>{ const v = store.view(); if(v.active) _chalOpenSetup(v.goal.kind, true); });
  on('chalGiveupBtn', ()=>{
    const v = store.view();
    if(!v.active) return;
    /* ⚠️ 포기는 반드시 한 번 묻는다. 서버에는 쉼으로 남고 이미 받은 뽑기는 그대로다. */
    _chalPopup('👑 달성표 포기', '이번 ' + _chalPh(v.phase).name + ' 달성표를 쉬어요. 남은 보상도 받을 수 없어요.'
      + '<br><span style="font-size:10px;color:var(--ink-soft);">이미 받은 뽑기는 그대로예요.</span><br>정말 포기할까요?',
      [{a:'ok',t:'포기하기'},{a:'no',t:'취소',ghost:true}]).then(async a=>{
      if(a !== 'ok') return;
      const r = await store.giveUp(v.phase);
      if(!r.ok) _chalWhy(r);
      _chalDraft = null; _chalRender();
    });
  });

  // 📋규칙 진행 화면 — 오늘 항목 체크
  const todayBox = _chalEl('chalToday');
  if(todayBox) todayBox.addEventListener('click', e=>{
    const row = e.target.closest && e.target.closest('[data-i]'); if(!row) return;
    const r = store.check(+row.getAttribute('data-i'));
    if(!r.ok) _chalWhy(r);
  });
})();


/* 서버 한 벌이 바뀔 때 · 일이 생길 때 — 서랍이 열려 있으면 다시 그린다 */
store.onChange(()=>{ if(_chalIsOpen()) _chalRender(); });
store.onEvent((e)=>{
  if(e.type === 'reset'){ _chalDraft = null; _chalView = null; _chalBusy = false; if(_chalIsOpen()) _chalRender(); }
  else if(e.type === 'conflict'){ _chalDraft = null; try{ toast('다른 기기에서 바꾼 내용을 받아왔어요'); }catch(_){} }
  else if(e.type === 'today'){ try{ toast('👑 오늘 달성! ' + e.count + '일째'); }catch(_){} }
  else if(e.type === 'repeatFail'){ try{ toast('오늘은 시간이 모자라요 — 내일 다시'); }catch(_){} }
  else if(e.type === 'repeatDue'){ if(!_chalPopOpen && _premiumOn()) _chalShowRepeatPopup(); }   // 게이트 ②
  else if(e.type === 'claimed'){
    if(e.settle) _chalShowSettlePopup(e.s, e.early + e.amount, e.early, e.phKey, e.cells);
    else try{ toast('🎰 뽑기 ' + e.amount + '회를 받았어요 — 파츠 보관함(T)에서 뽑을 수 있어요'); }catch(_){}
  }
});

return {
  startChallenge(code, me, session){ store.startChal(code, me, session); },   // 🚀 계정 확인 뒤 한 번(launcher/app-boot.js)
  dayEnded(){ store.dayEnded(); },                // focus-total onDayEnd — 하루가 바뀐 때
  flush(){ return store.flush(); },               // 로그아웃 올리기 — 도는 쓰기가 끝나기를 기다린다
  open: _chalOpen,                        // 🍅 뽀모 서랍을 열면 open(false) — 둘 중 하나만
  isOpen: _chalIsOpen,
  focusTick: _chalFocusTick,              // _applyActiveAppState(500ms) — 🎯집중 초
  setKeyPlatform(v){ _chalKeyPlatform = v; },   // 활성 앱 상태가 알려 주는 이 기기 플랫폼('win' · 'mac')
  /* 화면 없이 검사하는 셈 — sim-weekly-challenge.js */
  calc: { ruleItems:_chalRuleItems, rewardLine:_chalRewardLine, cfgLabel:_chalCfgLabel, keysOf:_chalKeysOf, clampNum:_chalClampNum },
};
}

const api = { createWeeklyChallenge };
if(typeof window !== 'undefined') window.TwWeeklyChallenge = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
