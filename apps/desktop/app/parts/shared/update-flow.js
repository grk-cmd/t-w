/* update-flow.js — 🔄 켤 때 업데이트 흐름: 업데이트 창 → 공지 창 → 로그인 (검사 sim-update-flow.js)
   [순서] 로그인보다 먼저, 계정 없이 — ① 서버 설정 minVersion.app(GET /v1/config · 공개) ② 새 판 확인(main.js electron-updater, 렌더러가 checkUpdate 로 묻는다)
     · 강제(이 앱 < minVersion.app): «업데이트가 필요해요» — [업데이트] 만 · 닫기 없음 · 로그인으로 넘어가지 않는다.
     · 선택(새 판 있음): «새 버전이 나왔어요» — [업데이트] [나중에]. 버전만 보이고 공지 본문은 넣지 않는다(공지는 앱 버전과 묶이지 않는다).
     · 그 뒤 안 본 «업데이트 안내» 공지 창(deps.noticeOnce · showNotice) → 로그인(runBeforeLogin 이 풀린다). 한 번에 하나, 아무것도 없으면 바로 로그인.
   [켜 둔 동안] 새 판을 다 받으면 런처 작은 띠(desktop-run.js updateReadyBanner)가 그대로 — 이 모듈은 «나중에» 를 누른 사람에게도 띠가 보이도록 단계가 끝난 뒤(whenStageDone)에 건다.
     관리자가 최소 버전을 올리면 원격 설정 바뀜 알림(deps.onMinChange)에서 바로 강제 창 — 새 주기 요청 없음.
   [못 받으면] 최소 버전을 못 읽거나(오프라인 · 시간 초과) 버전을 모르면(웹 · 검사) 막지 않는다 — 잘못 막는 쪽이 못 막는 쪽보다 크다.
     새 판 확인은 버전 · 최소 버전을 읽는 일과 따로, 켤 때 한 번은 늘 묻는다. 답이 시간 안에 안 오면 «없음» 으로 보고 넘어간다. 실패 뒤 혼자 다시 묻지 않는다 — 강제 창의 [다시 시도] 를 누를 때만 다시 확인한다.
   [맥] 자동 설치가 없다 — 주 단추는 [다운로드 페이지 열기](main 이 알려 준 릴리스 주소를 시스템 브라우저로 · 강제는 창 유지 · 선택은 열고 다음 단계로), 선택 창 본문은 «받아 설치해 주세요».
   deps: readMin() 최소 버전 문자열(또는 그 Promise) · 없으면 null / getMin() 지금 값(동기) / onMinChange(fn) → 해제 함수 / getVersion() 이 앱 버전(Promise 가능) /
     companion preload 의 window.companion(onUpdateStatus · installUpdate · checkUpdate · openBrowser) · 없으면 null / ui { show(view, press), update(view), hide() } (createUpdateDom) /
     noticeOnce(fn) 공지를 처음 받았을 때 fn(공지) 한 번 · showNotice(공지, done) 보여 주고 닫히면 done() — 보일 게 없어도 done() /
     timeoutMs 최소 버전 읽기 상한 · updateWaitMs 새 판 확인 답 상한 · noticeWaitMs 공지 받기 상한
   Firebase 를 모른다. classic script(window.TwUpdateFlow) — app.js 보다 먼저 싣고, app.js 가 만든다. */
(function(){
'use strict';

const VER_MAX = 20;                                 // remote-config.js VER_MAX 와 같다
const MIN_READ_TIMEOUT_MS = 8000;
const UPDATE_WAIT_MS = 6000;
const NOTICE_WAIT_MS = 4000;
// 저장소 이름이 바뀌면 package.json build.publish 와 같이 바꾼다
const RELEASES_URL = 'https://github.com/grk-cmd/t-w/releases/latest';
const OVERLAY_ID = 'appVerGateOverlay';             // app.js UI_HIT_SEL 에도 있어야 클릭을 받는다
const STAGE = Object.freeze({ NONE: 'none', OPTIONAL: 'optional', FORCE: 'force' });
// 이미 받는 중이거나 받았거나 새 판을 알고 있는 상태 — 강제로 바뀌어도 다시 묻지 않는다
const BUSY_OR_READY = Object.freeze(['checking', 'available', 'downloading', 'downloaded', 'mac-available']);
// 새 판 확인의 «답» 이 된 상태 — 이게 오면 켤 때 기다림이 끝난다(checking 은 답이 아니다)
const ANSWERED = Object.freeze(['available', 'downloading', 'downloaded', 'mac-available', 'none', 'error']);
const FAIL_NOTE = '업데이트를 받지 못하면 아래 링크에서 직접 받아 설치해 주세요.';   // 강제 · 선택 창 공통 — 링크는 RELEASES_URL
const ACT = Object.freeze({ INSTALL: 'install', OPEN: 'open', RETRY: 'retry', WAIT: 'wait', UPDATE: 'update', LATER: 'later' });

// "0.10.3" · "v0.10.3" · "0.10.3-beta.1" → [0,10,3]. 모양이 아니면 null — 모르는 값으로는 막지 않는다.
function parseVer(v){
  if(typeof v !== 'string' || v.length > VER_MAX) return null;
  const m = /^v?(\d{1,4})(?:\.(\d{1,4}))?(?:\.(\d{1,4}))?(?:-[0-9A-Za-z.+-]*)?$/.exec(v.trim());
  return m ? [m[1], m[2], m[3]].map(n => parseInt(n || '0', 10)) : null;
}

// my < min 일 때만 true. 둘 중 하나라도 못 읽으면 false. 꼬리(-beta)는 보지 않는다(0.10.3-beta.1 은 0.10.3 과 같다).
function isBelow(my, min){
  const a = parseVer(my), b = parseVer(min);
  if(!a || !b) return false;
  for(let i = 0; i < 3; i++){ if(a[i] !== b[i]) return a[i] < b[i]; }
  return false;
}

/* 어느 창인가 — 강제 > 선택 > 없음. 모르는 값(버전 · 최소 · 새 판)은 그 판단을 건너뛴다. */
function stageOf(my, min, latest){
  if(!parseVer(my)) return STAGE.NONE;
  if(min != null && min !== '' && isBelow(my, String(min))) return STAGE.FORCE;
  if(latest != null && isBelow(my, String(latest))) return STAGE.OPTIONAL;
  return STAGE.NONE;
}

/* 업데이트 상태(main 이 보낸 것) → 주 단추. wantUpdate = 선택 창에서 [업데이트] 를 이미 눌렀다(받기가 끝나면 바로 설치). */
function mainButton(up, wantUpdate){
  const u = up || {};
  if(u.status === 'downloaded') return { label: '지금 재시작해서 업데이트', action: ACT.INSTALL };
  if(u.status === 'mac-available' && u.url) return { label: '다운로드 페이지 열기', action: ACT.OPEN, url: u.url };
  if(u.status === 'downloading') return { label: '새 버전 받는 중… ' + (Number(u.percent) || 0) + '%', action: ACT.WAIT };
  if(u.status === 'checking' || u.status === 'available') return wantUpdate ? { label: '새 버전 받는 중…', action: ACT.WAIT } : { label: '업데이트', action: ACT.UPDATE };
  if(u.status === 'error') return { label: '다시 시도', action: ACT.RETRY };
  return { label: '다운로드 페이지 열기', action: ACT.OPEN, url: RELEASES_URL };
}

function viewOf(kind, my, min, latest, up, wantUpdate){
  const u = up || {};
  if(kind === STAGE.FORCE){
    return {
      kind,
      title: '업데이트가 필요해요',
      body: '이 버전(' + my + ')은 더 이상 쓸 수 없어요. ' + min + ' 이상으로 업데이트하면 그대로 이어서 쓸 수 있어요 — 캐릭터 · 친구 · 기록은 계정에 남아 있어요.',
      buttons: [mainButton(u, true)],   // 강제 창엔 «나중에» 가 없다 — 확인 중 · 새 판 있음은 눌러도 할 일이 없으니 받는 중으로
      note: u.status === 'error' ? FAIL_NOTE : '',
      linkUrl: RELEASES_URL,
    };
  }
  const main = mainButton(u, wantUpdate);
  // 맥은 앱이 설치해 주지 않는다 — «업데이트할까요?» 대신 직접 받아 설치하라고 쓴다
  const ask = u.status === 'mac-available' ? '다운로드 페이지에서 받아 설치해 주세요.' : '지금 업데이트할까요?';
  return {
    kind,
    title: '새 버전 ' + latest,
    body: '새 버전 ' + latest + '이 나왔어요. ' + ask + ' (지금 버전 ' + my + ')',
    buttons: [main, { label: '나중에', action: ACT.LATER }],
    note: u.status === 'error' ? FAIL_NOTE : '',
    linkUrl: u.status === 'error' ? RELEASES_URL : null,   // 안내가 가리키는 링크를 같이 보인다
  };
}

function withTimeout(p, ms){
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    Promise.resolve(p).then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

/** @param {object} deps 머리말 참고 */
function createUpdateFlow(deps){
  const { readMin, getMin, onMinChange, getVersion, ui, noticeOnce, showNotice } = deps;
  const companion = deps.companion || null;
  const timeoutMs = deps.timeoutMs || MIN_READ_TIMEOUT_MS;
  const updateWaitMs = deps.updateWaitMs || UPDATE_WAIT_MS;
  const noticeWaitMs = deps.noticeWaitMs || NOTICE_WAIT_MS;

  let my = null;            // 이 앱 버전 — 읽은 뒤에만
  let up = null;            // 마지막 업데이트 상태
  let latest = null;        // 알려진 새 판(main 의 available · downloaded · mac-available 에서)
  let shown = null;         // 지금 떠 있는 창 { kind, min }
  let wantUpdate = false;   // 선택 창에서 [업데이트] 를 눌렀다 — 받기가 끝나면 바로 설치
  let laterResolve = null;  // 선택 창이 닫히길 기다리는 쪽
  let updateAnswer = null;  // 새 판 확인 답을 기다리는 쪽
  let forced = false;       // 강제 창이 떴다 — 이후 선택 · 공지 단계로 가지 않는다
  let stageDone = false;
  const doneWaiters = [];

  const redraw = () => {
    if(!shown) return;
    ui.update(viewOf(shown.kind, my, shown.min, latest, up, wantUpdate));
  };

  function open(url){ if(companion) companion.openBrowser(url); }

  if(companion){
    companion.onUpdateStatus((info) => {
      up = info || null;
      if(up && up.version && (up.status === 'available' || up.status === 'downloaded' || up.status === 'mac-available')) latest = up.version;
      if(up && up.status === 'downloaded' && wantUpdate && shown && !forced) companion.installUpdate();
      redraw();
      if(updateAnswer && up && ANSWERED.includes(up.status)){ const f = updateAnswer; updateAnswer = null; f(); }
    });
  }

  function showWindow(kind, min){
    shown = { kind, min };
    ui.show(viewOf(kind, my, min, latest, up, wantUpdate), press);
  }
  function closeWindow(){
    shown = null; wantUpdate = false;
    ui.hide();
    if(laterResolve){ const f = laterResolve; laterResolve = null; f(); }
  }

  /* 단추 · 링크 하나가 부른다 — 창이 없으면 아무것도 안 한다 */
  function press(action){
    if(!shown) return;
    if(action === 'link') return open(RELEASES_URL);
    const b = viewOf(shown.kind, my, shown.min, latest, up, wantUpdate).buttons.find(x => x.action === action);
    if(!b) return;
    if(action === ACT.LATER) return closeWindow();
    if(action === ACT.INSTALL){ if(companion) companion.installUpdate(); return; }
    if(action === ACT.OPEN){
      open(b.url);
      if(shown.kind === STAGE.OPTIONAL) closeWindow();   // 맥 — 브라우저로 보냈으니 다음 단계로
      return;
    }
    if(action === ACT.UPDATE){ wantUpdate = true; redraw(); return; }   // 윈도우 — 이미 받는 중이니 끝나면 설치
    if(action === ACT.RETRY){
      // 상태는 main 이 다시 보낸다(checking → downloading …) — 여기서 지어내지 않는다
      if(companion) companion.checkUpdate(); else open(RELEASES_URL);
    }
  }

  /* 최소 버전이 이 앱보다 높으면 강제 창 — 켤 때와 켜 둔 동안(원격 설정 바뀜) 같은 판단 한 곳 */
  function enforce(min){
    if(stageOf(my, min, null) !== STAGE.FORCE) return false;
    forced = true;
    if(shown && shown.kind === STAGE.OPTIONAL) shown = null;
    if(laterResolve){ const f = laterResolve; laterResolve = null; f(); }
    showWindow(STAGE.FORCE, String(min));
    return true;
  }

  /* 켜 둔 동안 — 최소 버전이 올라가면 바로 강제 창. 버전을 읽기 전(켜는 중)에는 켜는 흐름이 보므로 건너뛴다. */
  onMinChange(() => {
    if(!my) return;
    const was = forced;
    if(!enforce(getMin()) || was) return;
    if(updateAnswer) return;   // 켤 때 이미 묻고 답을 기다리는 중이다 — 또 묻지 않는다
    /* 켜 둔 동안 강제로 바뀜 — 받기가 안 돌고 있으면(윈도우 자동 받기가 이미 끝났거나 안 시작됨) 한 번 묻는다 */
    const st = up && up.status;
    if(companion && !BUSY_OR_READY.includes(st)) companion.checkUpdate();
  });

  /* 새 판 확인 — 켤 때 정확히 한 번 묻는다(버전 · 최소 버전을 읽는 일과 따로 — 못 읽어도 업데이트 받기는 막지 않는다).
     답(또는 시간 초과)을 기다리는 Promise 를 돌려준다. 판단 자리는 main 의 startUpdateCheck 한 곳. */
  function askUpdate(){
    if(!companion) return Promise.resolve();
    return new Promise((resolve) => {
      const t = setTimeout(() => { updateAnswer = null; resolve(); }, updateWaitMs);
      updateAnswer = () => { clearTimeout(t); resolve(); };
      companion.checkUpdate();
    });
  }
  /* 읽기 하나 — 실패 · 시간 초과는 null (하나가 늦어도 다른 하나는 산다) */
  const readOr = (fn) => withTimeout(Promise.resolve().then(fn), timeoutMs).catch(() => null);

  function waitNotice(){
    return new Promise((resolve) => {
      let got = false;
      const t = setTimeout(() => { if(!got) resolve(); }, noticeWaitMs);   // 못 받았으면 넘어간다 — 늦게 받으면 그때 따로 뜬다
      noticeOnce((n) => { got = true; clearTimeout(t); showNotice(n, resolve); });
    });
  }

  function finish(){
    stageDone = true;
    for(const f of doneWaiters.splice(0)) f();
  }

  /* 로그인 시작 전 — 풀리면 { proceed:true }. 강제 창이 떴으면 { proceed:false } (로그인으로 넘어가지 않는다) */
  async function runBeforeLogin(){
    const answer = askUpdate();
    const [ver, min] = await Promise.all([readOr(getVersion), readOr(readMin)]);
    my = ver;
    if(!parseVer(my)){ finish(); await waitNotice(); return end(STAGE.NONE); }   // 버전을 모르면(웹 · 검사) 업데이트 창 없이 공지부터 — 새 판 확인은 이미 물었다
    if(enforce(min)) return { proceed: false, stage: STAGE.FORCE };
    await answer;
    if(forced) return { proceed: false, stage: STAGE.FORCE };   // 기다리는 사이 최소 버전이 올랐다
    let stage = STAGE.NONE;
    if(stageOf(my, null, latest) === STAGE.OPTIONAL){
      stage = STAGE.OPTIONAL;
      await new Promise((resolve) => { laterResolve = resolve; showWindow(STAGE.OPTIONAL, null); });
      if(forced) return { proceed: false, stage: STAGE.FORCE };
    }
    finish();
    await waitNotice();
    return end(stage);
  }
  /* 로그인 직전 — 공지를 기다리는 사이 최소 버전이 올라 강제 창이 떴으면 로그인으로 넘기지 않는다 */
  function end(stage){ return forced ? { proceed: false, stage: STAGE.FORCE } : { proceed: true, stage }; }

  return {
    runBeforeLogin,
    press,
    /* 업데이트 창 단계가 끝난 뒤 한 번 — 끝났으면 바로 */
    whenStageDone(fn){ if(stageDone) fn(); else doneWaiters.push(fn); },
    isForced: () => forced,
    current: () => (shown ? shown.kind : null),
  };
}

/*
 * 화면 — 한 장을 두 가지로 쓴다(강제: 단추 하나 · 선택: 단추 둘). 값은 전부 textContent 로 넣는다(서버에서 온 버전 문자열을 HTML 로 해석하지 않게).
 * z-index 는 다른 게이트(가입 · 로그인 필요)보다 위 — 업데이트가 먼저다.
 */
function createUpdateDom(doc){
  let els = null;
  let btns = [];
  function build(onPress){
    const ov = doc.createElement('div');
    ov.id = OVERLAY_ID;
    ov.style.cssText = 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);-webkit-app-region:no-drag;';
    const box = doc.createElement('div');
    box.style.cssText = 'background:var(--win-face,#d4d0c8);border:2px solid;border-color:var(--win-hi,#fff) var(--win-lo-2,#404040) var(--win-lo-2,#404040) var(--win-hi,#fff);'
      + 'box-shadow:3px 3px 0 rgba(0,0,0,.35);width:340px;max-width:92vw;font-family:Tahoma,\'Malgun Gothic\',sans-serif;';
    const title = doc.createElement('div');
    title.style.cssText = 'font-weight:bold;font-size:12px;color:#fff;padding:5px 8px;background:linear-gradient(90deg,var(--win-title-a,#0a246a),var(--win-title-b,#a6caf0));';
    const inner = doc.createElement('div');
    inner.style.cssText = 'padding:14px;display:flex;flex-direction:column;gap:9px;';
    const body = doc.createElement('div');
    body.style.cssText = 'font-size:12px;line-height:1.55;color:var(--ink,#222);';
    const row = doc.createElement('div');
    row.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
    const note = doc.createElement('div');
    note.style.cssText = 'font-size:10.5px;line-height:1.5;color:var(--ink-soft,#555);';
    const link = doc.createElement('a');
    link.href = '#';
    link.textContent = '다운로드 페이지에서 직접 받기';
    link.style.cssText = 'font-size:10.5px;color:#0645ad;text-align:center;';
    link.onclick = (e) => { if(e && e.preventDefault) e.preventDefault(); onPress('link'); };
    inner.appendChild(body); inner.appendChild(row); inner.appendChild(note); inner.appendChild(link);
    box.appendChild(title); box.appendChild(inner); ov.appendChild(box);
    (doc.body || doc.documentElement).appendChild(ov);
    els = { ov, title, body, row, note, link, onPress };
    btns = [];
  }
  function paint(v){
    if(!els) return;
    els.ov.style.display = 'flex';
    els.title.textContent = v.title;
    els.body.textContent = v.body;
    while(btns.length < v.buttons.length){
      const b = doc.createElement('button');
      b.className = 'lc-btn';
      b.style.cssText = 'margin-top:0;';
      const i = btns.length;
      b.onclick = () => els.onPress(els.actions[i]);
      els.row.appendChild(b); btns.push(b);
    }
    els.actions = v.buttons.map(b => b.action);
    btns.forEach((b, i) => {
      const spec = v.buttons[i];
      b.style.display = spec ? '' : 'none';
      if(spec){ b.textContent = spec.label; b.disabled = spec.action === ACT.WAIT; }
    });
    els.note.textContent = v.note || '';
    els.note.style.display = v.note ? '' : 'none';
    els.link.style.display = v.linkUrl ? '' : 'none';
  }
  return {
    show(v, onPress){ if(!els) build(onPress); else els.onPress = onPress; paint(v); },
    update: paint,
    hide(){ if(els) els.ov.style.display = 'none'; },
  };
}

const api = { VER_MAX, MIN_READ_TIMEOUT_MS, UPDATE_WAIT_MS, NOTICE_WAIT_MS, RELEASES_URL, OVERLAY_ID, STAGE, ACT,
  parseVer, isBelow, stageOf, mainButton, viewOf, createUpdateFlow, createUpdateDom };
if(typeof window !== 'undefined') window.TwUpdateFlow = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
