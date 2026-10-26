/* maintenance-gate.js — 🛠 서버 점검: Firebase config/maintenance 가 켜진 동안 서버를 쓰는 기능을 누르면 «서버 점검 중» 창 (검사 sim-maintenance-gate.js)
   [왜] 점검 동안은 규칙이 이 한 칸 말고 Firebase 를 다 막고 API 도 멈춘다. 이 PC 에서만 도는 기능(책상 · 꾸미기 · 뽀모도로)은 그대로 두고,
     서버에 닿는 요청을 «사람이 방금 누른 동작» 이 낼 때만 창을 띄운다. 앱이 뒤에서 혼자 내는 요청(친구 목록 · 원격 설정 · 구독)은 조용히 넘긴다
     — 요청마다 띄우면 창이 끝없이 뜬다. 점검 중엔 오류 번호 토스트도 내지 않는다(error-codes.js muted).
     원격 설정(API 먼저)으로 읽지 않는 까닭 — 점검 중엔 API 가 없다.
   [사람이 누른 동작] navigator.userActivation.isActive(클릭 · 키 뒤 몇 초) — 모르는 환경이면 늘 «아님»(창 없음).
   [끝나면] 권한이 거부된 onValue 구독은 다시 붙지 않아서 앱을 다시 켜야 친구 · 우편 · 방이 이어진다.
     로컬 기능을 쓰는 중일 수 있으니 저절로 끄지 않고 [지금 다시 켜기] [나중에] 를 묻는다. 이번 실행에 점검을 본 적이 없으면 묻지 않는다.
   [못 읽음] 모르는 모양은 «점검 아님» — 잘못 막는 쪽이 못 막는 쪽보다 크다(app-version-gate.js 와 같다).
   deps: userActive() · ui({ show(view, onPress) · hide() }) · relaunch() · now()
   내놓는 것: createMaintenance(deps) → { onValue(값) · touch() · on() } · 앱 한 벌 store(firebase-init 이 onValue 를 잇고, 요청 문 · api-client 가 touch)
   classic script — error-codes.js · api-client.js 보다 먼저 싣는다(window.TwMaintenance). Firebase 를 모른다. */
(function(){
'use strict';

const MAINTENANCE_PATH = 'config/maintenance';
const GATE_ID = 'maintGateOverlay';          // desktop-run.js UI_HIT_SEL 에도 있어야 클릭을 받는다
const MESSAGE_MAX = 200;                     // 규칙 config/maintenance/message 와 같은 값

const DEFAULT_BODY = '더 좋은 서비스를 위해 서버를 점검하고 있어요.';
const NOTE = '이 PC 에서만 도는 기능(책상 · 꾸미기 · 뽀모도로)은 그대로 쓸 수 있어요. 캐릭터 · 친구 · 기록은 계정에 그대로 남아 있어요.';

/* config/maintenance 값 → 점검이면 { endsAt, message }, 아니면 null. on 이 정확히 true 일 때만 점검. */
function maintenanceOf(raw){
  if(!raw || typeof raw !== 'object' || raw.on !== true) return null;
  const endsAt = (typeof raw.endsAt === 'number' && isFinite(raw.endsAt) && raw.endsAt > 0) ? raw.endsAt : null;
  const message = (typeof raw.message === 'string') ? raw.message.trim().slice(0, MESSAGE_MAX) : '';
  return { endsAt, message };
}

const pad2 = (n) => (n < 10 ? '0' : '') + n;
/* 끝나는 시각 — 오늘이면 «15:30», 다른 날이면 «10월 27일 15:30» (이 PC 시간대). */
function endsAtText(endsAt, nowMs){
  const d = new Date(endsAt), t = new Date(nowMs);
  const hm = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  const sameDay = d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
  return sameDay ? hm : (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + hm;
}

/* 창 글 — m 이 있으면 점검 중(단추 «확인»), null 이면 끝남(단추 «지금 다시 켜기» · «나중에»). */
function viewOf(m, nowMs){
  if(!m) return { title: '점검이 끝났어요', body: '앱을 다시 켜면 친구 · 우편 · 방이 다시 이어져요.', note: '', buttons: [{ label: '지금 다시 켜기', action: 'relaunch' }, { label: '나중에', action: 'close' }] };
  const ends = m.endsAt ? '\n' + endsAtText(m.endsAt, nowMs) + '쯤 끝날 예정이에요.' : '';
  return { title: '서버 점검 중', body: (m.message || DEFAULT_BODY) + ends, note: NOTE, buttons: [{ label: '확인', action: 'close' }] };
}

/** @param {{ userActive: () => boolean, ui: { show: (view: object, onPress: (action: string) => void) => void, hide: () => void }, relaunch: () => void, now?: () => number }} deps */
function createMaintenance(deps){
  const userActive = deps.userActive;
  const ui = deps.ui;
  const relaunch = deps.relaunch;
  const now = deps.now || (() => Date.now());
  let cur = null;             // 지금 점검이면 { endsAt, message }
  let seen = false;           // 이번 실행에 점검을 본 적이 있는가 — 없으면 끝나도 다시 켜기를 묻지 않는다
  let open = false;           // 점검 창이 떠 있는가 — 떠 있으면 관리자가 바꾼 끝 시각 · 문구를 바로 다시 그린다

  function press(action){
    open = false;
    ui.hide();
    if(action === 'relaunch') relaunch();
  }

  function onValue(raw){
    const m = maintenanceOf(raw);
    if(m){ cur = m; seen = true; if(open) ui.show(viewOf(m, now()), press); return; }
    const was = !!cur;
    cur = null;
    if(was && seen){ open = false; ui.show(viewOf(null, now()), press); }
  }

  /* 서버 요청이 나가기 직전에 부른다 — 점검 중이고 사람이 방금 누른 동작일 때만 창. 이미 떠 있으면 글만 새로. */
  function touch(){
    if(!cur || !userActive()) return false;
    open = true;
    ui.show(viewOf(cur, now()), press);
    return true;
  }

  return { onValue, touch, on: () => !!cur };
}

/* 창 — 바탕을 덮지 않는 작은 창(로컬 기능은 계속 쓴다). 관리자가 쓴 문구는 textContent 로만 넣는다.
   z-index 는 업데이트 화면(app-version-gate.js 100000)보다 아래 — 둘 다 뜨면 할 수 있는 일(업데이트)이 위. */
function createMaintenanceDom(doc){
  let els = null;
  function build(){
    const ov = doc.createElement('div');
    ov.id = GATE_ID;
    ov.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:99990;-webkit-app-region:no-drag;'
      + 'background:var(--win-face,#d4d0c8);border:2px solid;border-color:var(--win-hi,#fff) var(--win-lo-2,#404040) var(--win-lo-2,#404040) var(--win-hi,#fff);'
      + 'box-shadow:3px 3px 0 rgba(0,0,0,.35);width:320px;max-width:92vw;font-family:Tahoma,\'Malgun Gothic\',sans-serif;';
    const title = doc.createElement('div');
    title.style.cssText = 'font-weight:bold;font-size:12px;color:#fff;padding:5px 8px;background:linear-gradient(90deg,var(--win-title-a,#0a246a),var(--win-title-b,#a6caf0));';
    const inner = doc.createElement('div');
    inner.style.cssText = 'padding:14px;display:flex;flex-direction:column;gap:9px;';
    const body = doc.createElement('div');
    body.style.cssText = 'font-size:12px;line-height:1.55;color:var(--ink,#222);white-space:pre-wrap;';
    const note = doc.createElement('div');
    note.style.cssText = 'font-size:10.5px;line-height:1.5;color:var(--ink-soft,#555);';
    const row = doc.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;justify-content:flex-end;';
    inner.appendChild(body); inner.appendChild(note); inner.appendChild(row);
    ov.appendChild(title); ov.appendChild(inner);
    (doc.body || doc.documentElement).appendChild(ov);
    els = { ov, title, body, note, row };
  }
  return {
    show(v, onPress){
      if(!els) build();
      els.title.textContent = v.title;
      els.body.textContent = v.body;
      els.note.textContent = v.note || '';
      els.note.style.display = v.note ? '' : 'none';
      els.row.textContent = '';
      for(const b of v.buttons){
        const btn = doc.createElement('button');
        btn.className = 'lc-btn';
        btn.style.marginTop = '0';
        btn.textContent = b.label;
        btn.onclick = () => onPress(b.action);
        els.row.appendChild(btn);
      }
      els.ov.style.display = '';
    },
    hide(){ if(els) els.ov.style.display = 'none'; },
  };
}

const api = { MAINTENANCE_PATH, GATE_ID, MESSAGE_MAX, maintenanceOf, endsAtText, viewOf, createMaintenance, createMaintenanceDom };
/* 렌더러에서는 한 벌을 만들어 둔다 — 창은 처음 띄울 때 만든다(document 는 그때 있다). */
if(typeof window !== 'undefined' && typeof document !== 'undefined'){
  api.store = createMaintenance({
    userActive: () => !!(window.navigator && window.navigator.userActivation && window.navigator.userActivation.isActive),
    ui: createMaintenanceDom(document),
    relaunch: () => window.companion.relaunchApp(),
  });
  window.TwMaintenance = api;
}
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
