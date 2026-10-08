/*
 * 앱 최소 버전 — 이 앱 버전이 config/minAppVer 보다 낮으면 «업데이트해 주세요» 화면으로 앱 전체를 막는다.
 *
 * [왜] config/minRoomVer 는 방 입장만 막는다. 규칙을 잠그거나 데이터 모양을 바꾸면 방 밖 기능(마이홈 · 꾸미기 · 일정)도
 *   옛 앱에서 조용히 깨지므로, 그 전에 옛 앱을 업데이트로 보낼 장치가 따로 필요하다.
 * [언제 막나] 켤 때 한 번 config/minAppVer 하나만 읽는다(문자열 몇 바이트). 읽지 못하면(오프라인 · 거부 · 시간 초과)
 *   막지 않는다 — 잘못 막는 쪽이 못 막는 쪽보다 크다. 버전을 모르는 환경(웹 · 검사)도 막지 않는다.
 * [업데이트] 이미 있는 자동 업데이트 흐름(main.js electron-updater · 맥은 릴리스 안내)을 그대로 쓴다.
 *   윈도우는 켜고 3초 뒤 저절로 받기 시작하므로 받기가 끝나면 «지금 재시작해서 업데이트» 가 된다.
 *   맥 · 실패 · 아직 모름이면 다운로드 페이지를 시스템 브라우저로 연다.
 * ⚠️ 이 코드가 든 판(0.10.3~)부터만 효과가 있다. 그보다 옛 앱은 이 값을 읽지 않는다.
 *
 * Firebase 를 직접 import 하지 않는다 — deps 로 받는다(검사 sim-app-version-gate.js).
 *   readMin()      config/minAppVer 값(또는 그 Promise)
 *   getVersion()   이 앱 버전(또는 그 Promise) · 모르면 null
 *   companion      preload 의 window.companion(onUpdateStatus · installUpdate · checkUpdate · openBrowser) · 없으면 null
 *   ui             { show(view), update(view) } — createAppVersionGateDom(document) 가 만든다
 *   timeoutMs      읽기 대기 상한(기본 MIN_APP_VER_TIMEOUT_MS)
 */
export const MIN_APP_VER_PATH = 'config/minAppVer';
export const MIN_APP_VER_MAX = 20;                 // 규칙 config/minAppVer 의 길이 상한과 같다
export const MIN_APP_VER_TIMEOUT_MS = 8000;
// 저장소 이름이 바뀌면 package.json build.publish 와 같이 바꾼다
export const RELEASES_URL = 'https://github.com/grk-cmd/t-w/releases/latest';
export const GATE_ID = 'appVerGateOverlay';        // app.js UI_HIT_SEL 에도 있어야 클릭을 받는다

// "0.10.3" · "v0.10.3" · "0.10.3-beta.1" → [0,10,3]. 모양이 아니면 null — 모르는 값으로는 막지 않는다.
export function parseVer(v){
  if(typeof v !== 'string' || v.length > MIN_APP_VER_MAX) return null;
  const m = /^v?(\d{1,4})(?:\.(\d{1,4}))?(?:\.(\d{1,4}))?(?:-[0-9A-Za-z.+-]*)?$/.exec(v.trim());
  return m ? [m[1], m[2], m[3]].map(n => parseInt(n || '0', 10)) : null;
}

// my < min 일 때만 true. 둘 중 하나라도 못 읽으면 false. 꼬리(-beta)는 보지 않는다(0.10.3-beta.1 은 0.10.3 과 같다).
export function isBelow(my, min){
  const a = parseVer(my), b = parseVer(min);
  if(!a || !b) return false;
  for(let i = 0; i < 3; i++){ if(a[i] !== b[i]) return a[i] < b[i]; }
  return false;
}

function withTimeout(p, ms){
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    Promise.resolve(p).then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

// 업데이트 상태 → 화면 단추. action: install(재시작 설치) · open(브라우저로 받기) · retry(다시 확인) · wait(받는 중)
export function viewOf(my, min, up){
  const u = up || {};
  let button;
  if(u.status === 'downloaded') button = { label: '지금 재시작해서 업데이트', action: 'install' };
  else if(u.status === 'mac-available' && u.url) button = { label: '새 버전 받으러 가기', action: 'open', url: u.url };
  else if(u.status === 'downloading') button = { label: '새 버전 받는 중… ' + (Number(u.percent) || 0) + '%', action: 'wait' };
  else if(u.status === 'checking' || u.status === 'available') button = { label: '새 버전 받는 중…', action: 'wait' };
  else if(u.status === 'error') button = { label: '다시 시도', action: 'retry' };
  else button = { label: '다운로드 페이지 열기', action: 'open', url: RELEASES_URL };
  return {
    title: '업데이트해 주세요',
    body: '이 버전(' + my + ')은 더 이상 쓸 수 없어요. ' + min + ' 이상으로 업데이트하면 그대로 이어서 쓸 수 있어요 — 캐릭터 · 친구 · 기록은 계정에 남아 있어요.',
    button,
    note: u.status === 'error' ? '자동 업데이트가 안 되면 아래 링크에서 직접 받아 설치해 주세요.' : '',
    linkUrl: RELEASES_URL,
  };
}

export function createAppVersionGate(deps){
  const { readMin, getVersion, ui } = deps;
  const companion = deps.companion || null;
  const timeoutMs = deps.timeoutMs || MIN_APP_VER_TIMEOUT_MS;
  let blocked = null;        // { my, min } — 막았을 때만
  let up = null;             // 마지막 업데이트 상태 — 막기 전에 온 것도 기억한다(윈도우는 켜고 3초 뒤 받기 시작)

  const view = () => viewOf(blocked.my, blocked.min, up);
  const redraw = () => { if(blocked && ui && ui.update){ try{ ui.update(view()); }catch(_){} } };

  if(companion && typeof companion.onUpdateStatus === 'function'){
    try{ companion.onUpdateStatus((info) => { up = info || null; redraw(); }); }catch(_){}
  }

  function open(url){
    if(companion && typeof companion.openBrowser === 'function'){ try{ companion.openBrowser(url); }catch(_){} }
  }

  // 단추 하나 · 링크 하나가 부른다. 막혀 있지 않으면 아무것도 안 한다.
  function press(kind){
    if(!blocked) return;
    if(kind === 'link') return open(RELEASES_URL);
    const b = view().button;
    if(b.action === 'install' && companion && typeof companion.installUpdate === 'function'){ try{ companion.installUpdate(); }catch(_){} return; }
    if(b.action === 'open') return open(b.url);
    if(b.action === 'retry'){
      // checkUpdate 가 없으면(웹 · 검사) 다운로드 페이지로
      // 상태는 main 이 다시 보낸다(checking → downloading …) — 여기서 지어내지 않는다(맥은 새 버전이 없으면 아무것도 안 온다)
      if(companion && typeof companion.checkUpdate === 'function'){ try{ companion.checkUpdate(); }catch(_){} }
      else open(RELEASES_URL);
    }
  }

  // 막았으면 { blocked:true, my, min }, 아니면 { blocked:false, why }. 실패는 전부 «안 막음».
  async function start(){
    let my, min;
    try{
      [my, min] = await withTimeout(Promise.all([getVersion(), readMin()]), timeoutMs);
    }catch(_){ return { blocked: false, why: 'read-failed' }; }
    if(min == null || min === '') return { blocked: false, why: 'no-min' };
    if(!parseVer(my)) return { blocked: false, why: 'no-version' };
    if(!isBelow(my, String(min))) return { blocked: false, why: 'ok' };
    blocked = { my, min: String(min) };
    if(ui && ui.show){ try{ ui.show(view(), press); }catch(_){} }
    return { blocked: true, my, min: String(min) };
  }

  return { start, press, isBlocked: () => !!blocked };
}

/*
 * 화면 — 닫기 단추 없음. 값은 전부 textContent 로 넣는다(DB 에서 온 버전 문자열을 HTML 로 해석하지 않게).
 * z-index 는 다른 게이트(가입 · 로그인 필요)보다 위 — 업데이트가 먼저다.
 */
export function createAppVersionGateDom(doc){
  let els = null;
  function build(onPress){
    const ov = doc.createElement('div');
    ov.id = GATE_ID;
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
    const btn = doc.createElement('button');
    btn.className = 'lc-btn';
    btn.style.cssText = 'margin-top:0;';
    btn.onclick = () => onPress('button');
    const note = doc.createElement('div');
    note.style.cssText = 'font-size:10.5px;line-height:1.5;color:var(--ink-soft,#555);';
    const link = doc.createElement('a');
    link.href = '#';
    link.textContent = '다운로드 페이지에서 직접 받기';
    link.style.cssText = 'font-size:10.5px;color:#0645ad;text-align:center;';
    link.onclick = (e) => { if(e && e.preventDefault) e.preventDefault(); onPress('link'); };
    inner.appendChild(body); inner.appendChild(btn); inner.appendChild(note); inner.appendChild(link);
    box.appendChild(title); box.appendChild(inner); ov.appendChild(box);
    (doc.body || doc.documentElement).appendChild(ov);
    els = { ov, title, body, btn, note };
  }
  function paint(v){
    if(!els) return;
    els.title.textContent = v.title;
    els.body.textContent = v.body;
    els.btn.textContent = v.button.label;
    els.btn.disabled = v.button.action === 'wait';
    els.note.textContent = v.note || '';
    els.note.style.display = v.note ? '' : 'none';
  }
  return {
    show(v, onPress){ if(!els) build(onPress); paint(v); },
    update: paint,
  };
}
