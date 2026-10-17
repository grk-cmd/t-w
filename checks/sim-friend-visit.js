/* sim-friend-visit.js — 🏠 친구 방에 놀러 가기 (friend-visit.js · app.js 배선 · html)
   실행:  node sim-friend-visit.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — 누르기 한 번에 지금 방에서 나가 다른 방으로 옮겨진다. 묻지 않고 가거나, 같은 방인데 나갔다 들어오거나,
     창을 띄운 사이 친구가 떠난 옛 코드로 가면 안 된다. 시크릿룸은 코드가 안 보이니 누를 칸도 없어야 한다.
   ・1절: 판정 · 창 — 가짜 DOM 위에서 실제로 돌린다(묻기 · 같은 방 · 코드 없음 · 취소 · 놀러 가기 · 그 사이 나감 · 나가고 이동)
   ・2절: 배선 — 코드는 _friendRoomTag 로만 · 누르기는 줄 선택과 따로 · 초대 창과 같은 틀 · html 순서 */
'use strict';
const { joinRenderer: _joinRenderer } = require('./sim-renderer-src.js');   // 앱 FSD 로 옮긴 모듈을 «옮기기 전 app.js 글» 로 되살려 읽는다
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
/* 📩 수령함 · 💝 선물함 · 👥 마이홈 친구 목록은 parts/myhome/myhome-inbox.js 로 옮겼다(앱 FSD 15번) — 렌더러 쪽 한 벌 = app.js + 그 파일.
   ⚠️ 그 파일이 없으면 «못 찾음» 으로 멈춘다 — app.js 만 보고 빨개지거나 초록인 척하지 않게. */
const MOD = read('friend-visit.js'), APP0 = _joinRenderer(read('app.js')), MI = read('myhome-inbox.js'), HTML = read('desk-companion-prototype.html');
if (!MOD || !APP0 || !MI || !HTML) { say('  ? 원본 못 찾음 — friend-visit.js · app.js · myhome-inbox.js · desk-companion-prototype.html'); process.exit(2); }
const APP = APP0 + '\n' + MI;

say('── 1. 판정 · 창 (실행)');
const win = {};
new Function('window', 'module', MOD)(win, undefined);
const V = win.TwFriendVisit;
chk(!!V && typeof V.createFriendVisit === 'function', '싣기만 하면 window.TwFriendVisit');
chk(V.decide('', 'WORK-AAAA') === 'none' && V.decide('PLAY-MFEG', 'PLAY-MFEG') === 'same' && V.decide('PLAY-MFEG', null) === 'ask' && V.decide('PLAY-MFEG', 'WORK-AB12') === 'ask',
  '판정 — 코드 없음 · 같은 방 · 방 밖 · 다른 방');

/* 가짜 DOM — 창 하나를 만들고 버튼을 누를 수 있을 만큼만 */
function mkEl(){
  const el = { style:{}, attrs:{}, children:[], className:'', innerHTML:'', removed:false, onclick:null, _keys:[],
    setAttribute(k, v){ this.attrs[k] = v; }, appendChild(c){ this.children.push(c); },
    remove(){ this.removed = true; }, addEventListener(t, f){ if(t === 'keydown') this._keys.push(f); },
    focus(){ env.focused = this; } };
  el.querySelector = (q) => { const k = (q.match(/data-a="(\w+)"/) || [])[1]; if(!k) return null; el._btn = el._btn || {}; return el._btn[k] = el._btn[k] || Object.assign(mkEl(), { k }); };
  return el;
}
const env = { toasts:[], started:[], left:0, focused:null, body:mkEl(), friend:null, my:null, inRoom:false, refreshed:[], onRefresh:null };
const document = { createElement: () => mkEl(), body: env.body };
const esc = (s) => String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
const tag = (f) => (f && f.room && String(f.room).indexOf('SCRT-') !== 0) ? String(f.room) : '';
const FV = V.createFriendVisit({ document, escHtml: esc, toast: (m) => env.toasts.push(m),
  getFriend: () => env.friend, refreshFriend: async (fid) => { env.refreshed.push(fid); if(env.onRefresh) env.onRefresh(); }, roomTagOf: tag, myRoom: () => env.my, inRoom: () => env.inRoom,
  leaveRoom: async () => { env.left++; env.inRoom = false; env.my = null; }, startRoom: (c) => env.started.push(c),
  channelName: (c) => /^PLAY-/.test(c) ? '투게더룸' : /^WORK-/.test(c) ? '워킹룸' : '' });
const lastBox = () => { const ov = env.body.children[env.body.children.length - 1]; return ov && ov.children[0]; };
const tick = () => new Promise(r => setTimeout(r, 0));

(async () => {
  env.friend = { name:'도굴<꾼>', room:'PLAY-MFEG' };
  FV.ask('f1');
  let ov = env.body.children[0], box = lastBox();
  chk(!!box && ov.className === 'app-popup-ov' && /pointer-events:none/.test(ov.style.cssText) && /pointer-events:auto/.test(box.style.cssText),
    '★ 창 — app-popup-ov 껍데기는 클릭 통과(none) · 상자만 받는다(초대 창과 같은 배관)');
  chk(/님이 있는 룸에 놀러 갈까요\?/.test(box.innerHTML) && /도굴&#60;꾼&#62;/.test(box.innerHTML) && /PLAY-MFEG/.test(box.innerHTML) && /투게더룸/.test(box.innerHTML),
    '★ 문구 «○○ 님이 있는 룸에 놀러 갈까요?» · 이름은 이스케이프 · 코드 · 채널 이름');
  chk(!/나가고 이동해요/.test(box.innerHTML), '  방 밖이면 «나가고 이동» 줄 없음');
  chk(env.focused && env.focused.k === 'no', '★ 기본 포커스는 [취소] — Enter 한 번에 방이 바뀌지 않게');
  chk(env.started.length === 0, '★ 묻기만 하고 아직 안 간다');
  box._btn.no.onclick();
  chk(ov.removed && env.started.length === 0, '[취소] — 창만 닫고 안 간다');

  FV.ask('f1'); ov = env.body.children[env.body.children.length - 1]; box = lastBox();
  box._keys.forEach(f => f({ key:'Escape', preventDefault(){}, stopPropagation(){} }));
  chk(ov.removed && env.started.length === 0, 'Esc — 취소와 같다');

  FV.ask('f1'); box = lastBox(); box._btn.ok.onclick(); await tick();
  chk(env.started.join() === 'PLAY-MFEG' && env.left === 0, '★ [놀러 가기] — 방 밖이면 바로 그 코드로 들어간다');

  env.started = []; env.my = 'WORK-AB12'; env.inRoom = true;
  FV.ask('f1'); box = lastBox();
  chk(/WORK-AB12/.test(box.innerHTML) && /나가고 이동해요/.test(box.innerHTML), '★ 다른 방에 있으면 «지금 있는 방(…)에서 나가고 이동해요»');
  box._btn.ok.onclick(); await tick();
  chk(env.left === 1 && env.started.join() === 'PLAY-MFEG', '★ 나간 뒤(doLeaveRoom) 들어간다 — 초대 수락과 같은 순서');

  env.started = []; env.left = 0; env.my = 'PLAY-MFEG'; env.inRoom = true; env.toasts = [];
  const n0 = env.body.children.length; FV.ask('f1');
  chk(env.body.children.length === n0 && /이미 .* 같은 방/.test(env.toasts[0] || '') && env.started.length === 0, '★ 같은 방이면 창 없이 알림만');

  env.my = null; env.inRoom = false; env.toasts = [];
  FV.ask('f1'); box = lastBox();
  env.friend = { name:'도굴꾼', room:'WORK-ZZZZ' };   // 창을 띄운 사이 다른 방으로 옮겼다
  box._btn.ok.onclick(); await tick();
  chk(env.started.length === 0 && /방을 나갔어요/.test(env.toasts[0] || ''), '★ 창을 띄운 사이 친구가 옮기거나 나갔으면 — 옛 코드로 안 가고 알림만');

  env.started = []; env.toasts = []; env.refreshed = [];
  env.friend = { name:'도굴꾼', room:'PLAY-MFEG' };
  FV.ask('f1'); box = lastBox();
  env.onRefresh = () => { env.friend = { name:'도굴꾼', room:null }; };   // 목록이 닫혀 있어 몰랐는데 — 누를 때 읽어 보니 나갔다
  box._btn.ok.onclick(); await tick();
  chk(env.refreshed.join() === 'f1' && env.started.length === 0 && /방을 나갔어요/.test(env.toasts[0] || ''), '★ [놀러 가기] 를 누를 때 그 친구의 접속 상태만 한 번 읽고 판정한다(목록이 닫혀 있으면 안 듣고 있다)');
  env.onRefresh = () => { throw new Error('offline'); }; env.toasts = [];
  env.friend = { name:'도굴꾼', room:'PLAY-MFEG' };
  FV.ask('f1'); box = lastBox(); box._btn.ok.onclick(); await tick();
  chk(env.started.join() === 'PLAY-MFEG', '  읽기가 실패하면 지난 값으로 간다');
  env.onRefresh = null; env.started = [];

  env.friend = { name:'비밀', room:'SCRT-ABCD' }; env.toasts = [];
  const n1 = env.body.children.length; FV.ask('f1');
  chk(env.body.children.length === n1 && env.started.length === 0, '시크릿룸 코드는 묻지도 가지도 않는다');

  say('── 2. 배선');
  chk(/roomTagOf: \(\.\.\.a\)=>inboxMod\.friendRoomTag\(\.\.\.a\)/.test(APP0) && /friendRoomTag: _friendRoomTag,/.test(MI), '★ 코드는 _friendRoomTag 로만 얻는다(시크릿룸 판정을 복사하지 않음 — myhome-inbox.js 의 그 함수를 inboxMod 로)');
  chk(/refreshFriend: fid => friendsSubMod\.refreshPresence\(\[fid\]\)/.test(APP0), '★ 그 친구만 한 번 읽기는 friends-sub refreshPresence([그 친구])');
  chk(/leaveRoom: \(\) => doLeaveRoom\(\{ wipeChat: true \}\), startRoom: c => startRoom\(c\)/.test(APP), '나가기 · 들어가기는 기존 문(doLeaveRoom · startRoom)');
  chk(/mh-fpill-code'\+\(friendVisit\?' go" title="클릭하면 놀러 가요':''\)/.test(APP), '코드 칸에 go 표시 · «클릭하면 놀러 가요» — 모듈이 없으면 예전 그대로');
  chk(/visitEl\.addEventListener\('click', e=>\{ e\.stopPropagation\(\); friendVisit\.ask\(fid\); \}\)/.test(APP), '★ 코드 누르기는 줄 선택(click)과 따로 — stopPropagation');
  chk(/\.mh-fpill-code\.go\{cursor:pointer;/.test(HTML) && /\.mh-fpill-code\.go:hover\{/.test(HTML), '눌리는 칸 표시(css)');
  chk(/var\(--win-title-a\)/.test(MOD) && /class="lc-btn ghost" data-a="no"/.test(MOD) && /class="lc-btn" data-a="ok"/.test(MOD) && /var\(--win-face\)/.test(MOD),
    '★ 앱 창과 같은 모양 — 테마 변수(--win-*) · 타이틀바 · lc-btn');
  const iMod = HTML.indexOf('parts/room/friend-visit.js'), iApp = HTML.indexOf('parts/app.js"');
  chk(iMod > 0 && iApp > iMod, 'friend-visit.js 를 app.js 보다 먼저 싣는다');

  say('\n' + (fail ? '✗ 통과 ' + pass + ' · 실패 ' + fail : '전부 통과 ✅ ' + pass + ' — 묻고 가고, 같은 방 · 떠난 방은 안 간다'));
  process.exit(fail ? 1 : 0);
})();
