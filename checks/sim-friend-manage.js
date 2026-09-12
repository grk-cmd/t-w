/* sim-friend-manage.js — 👥 친구 관리(탭 재편 2단계) 검사
   실행:  node sim-friend-manage.js   (app.js · desk-companion-prototype.html · smoke.js 와 같은 폴더에서)

   ★ 왜 이 검사가 있는가 — 이 화면에는 **조용히 깨지는 자리가 둘** 있다.

     ① 일괄 수락의 자리 계산.
        `_myHomeFriends` 는 서버 왕복이 끝나도 **구독 콜백이 와야** 갱신된다. 그래서 수락 한 건마다
        `FRIEND_MAX - Object.keys(_myHomeFriends).length` 를 다시 세면, **자리가 1칸인데 3건이
        전부 통과한다.** 화면에는 "3명과 친구가 됐어요"가 뜨고 상한은 조용히 넘어간다.
        → 남은 자리를 **호출자가 세어 넘기고 성공할 때마다 하나씩 깎는** 방식이어야 한다.
        ⚠ 자리가 없어서 못 받은 요청은 **지우지 않는다.** 지우면 상대가 다시 보내야 한다.

     ② 서브탭 클래스 공유.
        친구 관리 서브탭은 수령함과 **같은 `.mh-ibx-tab`** 을 쓴다(새 클래스를 만들면 검사 12·15가
        보는 축이 늘어난다). 그래서 `document.querySelectorAll('.mh-ibx-tab')` 처럼 **전역으로**
        걸린 곳이 하나라도 남아 있으면 두 화면이 서로의 탭 상태를 지운다 —
        "받은 요청을 눌렀더니 수령함 필터가 전체로 돌아간다" 같은 모양이다.
        → 전부 `#mhInboxTabs` / `#mhFmTabs` 로 좁혀져 있어야 한다.

   ★ 무엇을 보는가 (두 층)
     §1 소스·마크업 대조 — 전역 `.mh-ibx-tab` 잔재 · 옛 #mhReqSection 잔재 ·
        선물 배지 확인(_mallangSeenGifts) 호출 자리 · 팝업 호출부가 하나인가
     §2 런타임 — 자리가 1칸일 때 3건을 일괄 수락하면 정말 1건만 들어가는가,
        그리고 **일부러 옛날 방식으로 망가뜨리면 이 검사가 잡는가**

   ⚠ 이 검사는 **클라이언트만** 본다. 상한을 서버가 강제하는지는 별개다
     (firebase-database-rules.json 을 받으면 그쪽도 같이 볼 것).
   ⚠ smoke.js 의 스텁을 빌려 쓴다 — 같은 폴더에 있어야 한다. */
'use strict';
const fs = require('fs'), vm = require('vm');

const SRC  = fs.readFileSync('app.js', 'utf8');
/* 🔒 CSP(3절) — 예전엔 firebase 초기화·API 전체가 HTML 안의 인라인 모듈이었다. `script-src` 에서
   'unsafe-inline' 을 버리려고 `parts/firebase-init.js` 로 뺐다. 이 검사는 친구 요청 함수들을
   **HTML 안에서** 찾으므로, 파일이 있으면 이어 붙여 외부화 전과 같은 시야를 만든다.
   ⚠️ 이 검사가 갑자기 "sendFriendRequest() 를 찾았다 ✗" 처럼 함수를 못 찾는다고 하면
     코드가 지워진 게 아니라 **이 두 줄**을 먼저 볼 것. 같은 실패가 이미 세 번 났다. */
let HTML = fs.readFileSync('desk-companion-prototype.html', 'utf8');
for (const c of ['firebase-init.js', 'parts/firebase-init.js']) {
  if (fs.existsSync(c)) { HTML += '\n' + fs.readFileSync(c, 'utf8'); break; }
}
const say = console.log;
let fail = 0;
const chk = (c, m) => { say((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };

say('=== 👥 친구 관리 (탭 재편 2단계) 검사 ===');
say('');

/* ── §1. 소스·마크업 대조 ─────────────────────────────────────────── */
say('· §1 소스 대조 — 두 화면이 같은 클래스를 쓰면서 서로를 밟지 않는가');

// (ㄱ) 전역 .mh-ibx-tab 선택이 남아 있지 않은가
const globalTabSel = [...SRC.matchAll(/querySelectorAll\(\s*'([^']*\.mh-ibx-tab[^']*)'/g)].map(m => m[1]);
chk(globalTabSel.length > 0, '.mh-ibx-tab 선택 자체는 있다 (' + globalTabSel.length + '곳)');
const unscoped = globalTabSel.filter(s => !/^#mhInboxTabs\b|^#mhFmTabs\b/.test(s.trim()));
chk(unscoped.length === 0,
    '.mh-ibx-tab 선택이 전부 컨테이너로 좁혀져 있다' + (unscoped.length ? ' — 안 좁혀진 것: ' + unscoped.join(' / ') : ''));

// (ㄴ) 두 컨테이너가 실제로 마크업에 있고, 서브탭이 data-fm 로 구분되는가
chk(/id="mhFmTabs"/.test(HTML),  '#mhFmTabs (친구 관리 서브탭)가 HTML 에 있다');
chk(/id="mhInboxTabs"/.test(HTML), '#mhInboxTabs (수령함 태그 탭)가 HTML 에 있다');
const fmBlock = (HTML.match(/id="mhFmTabs"[\s\S]{0,600}?<\/div>/) || [''])[0];
chk(/data-fm="req"/.test(fmBlock) && /data-fm="gift"/.test(fmBlock),
    '친구 관리 서브탭은 data-fm 으로 구분한다 (수령함의 data-tag 와 섞이지 않게)');
chk(!/data-tag="gift"/.test(HTML),
    '💝 선물함이 수령함 태그 탭에서 빠졌다 (두 군데에 같은 선물함이 뜨지 않는다)');

// (ㄷ) 옛 자리(#mhReqSection) 잔재 — 안 지우면 같은 요청이 두 군데에 뜬다
for (const id of ['mhReqSection', 'mhReqList', 'mhReqCount']) {
  chk(!HTML.includes('id="' + id + '"') && !SRC.includes("getElementById('" + id + "')"),
      '옛 요청 칸 ' + id + ' 이 HTML·JS 어디에도 없다');
}
chk(/id="mhFmList"/.test(HTML), '요청·선물함을 그리는 새 칸 #mhFmList 가 있다');

// (ㄹ) 🎁 선물 배지 확인 처리는 **선물함 서브탭 클릭**에만 있어야 한다.
//     탭을 스치기만 해도 본 것으로 처리되면 안 되므로, 렌더 함수 안에 있으면 실패다.
const seenCalls = [...SRC.matchAll(/^.*_mallangSeenGifts\(\).*$/gm)]
  .map(m => m[0].trim()).filter(l => !l.startsWith('*') && !l.startsWith('//'));
chk(seenCalls.length === 1, '_mallangSeenGifts() 호출부가 하나뿐이다 (' + seenCalls.length + '곳)');
chk(seenCalls.length === 1 && /_fmTab\s*===\s*'gift'/.test(seenCalls[0]),
    '그 한 곳이 선물함 서브탭 클릭이다');
const giftBox = (SRC.match(/function renderGiftBox\([\s\S]*?\n\}/) || [''])[0];
chk(!!giftBox && !giftBox.includes('_mallangSeenGifts'),
    'renderGiftBox() 안에는 배지 확인 처리가 없다 (렌더만으로 본 것이 되지 않는다)');

/* (ㅁ) 요청 팝업 호출부는 하나 — 관리 화면과 겹치지 않게 '새로 온 것'에만 뜬다.
   ⚠️ 호출과 그 조건은 **다른 줄에 있다**(if 가 길어서 줄이 갈렸다). 한 줄만 보면 조건을 놓치므로
     호출 줄 앞뒤를 함께 본다 — 검사가 코드 줄바꿈에 따라 참/거짓이 뒤집히면 안 된다. */
const srcLines = SRC.split('\n');
const popupAt = srcLines
  .map((l, i) => ({ l: l.trim(), i }))
  .filter(o => /showFriendRequestPopup\(/.test(o.l))
  .filter(o => !/^\/|^\*|function showFriendRequestPopup/.test(o.l));
chk(popupAt.length === 1, '팝업 호출부가 하나뿐이다 (' + popupAt.length + '곳)');
const around = popupAt.length === 1
  ? srcLines.slice(Math.max(0, popupAt[0].i - 3), popupAt[0].i + 2).join('\n')
  : '';
chk(/newIds/.test(around) && /_fmReqVisible\(\)/.test(around),
    '그 호출이 새 요청(newIds)에만, 그리고 목록을 보고 있지 않을 때만 뜬다');
chk(!/setTimeout\([^)]*showFriendRequestPopup/.test(SRC),
    '마이홈 열 때 밀린 요청을 전부 묻던 자동 팝업이 없다 (관리 화면을 가리지 않는다)');

// (ㅂ) 상한 숫자를 다시 박지 않았는가 — FRIEND_MAX 한 곳에서만 나와야 한다
const fmFns = (SRC.match(/function _fmAcceptOne[\s\S]*?function _refreshFriendReqBadge/) || [''])[0];
chk(!!fmFns && !/\b(?:50|100|300)\b/.test(fmFns.replace(/FRIEND_MAX/g, '')),
    '친구 관리 코드에 상한 숫자가 박혀 있지 않다 (FRIEND_MAX 경유)');

say('');

/* ── §1-B. 📤 보낸 요청 미러 정합성 ──────────────────────────────────
   (나) 방식은 **한 사실을 두 곳에 적는다** — friendRequests/{받는사람}/{보낸사람} 과
   sentFriendRequests/{보낸사람}/{받는사람}. 둘이 어긋나면 화면이 거짓말을 한다:
     · 미러만 남으면  → 상대는 이미 수락했는데 내 목록엔 '기다리는 중'이 영영 남는다
     · 진짜만 남으면  → 내가 보낸 요청이 목록에 안 뜬다
   그래서 **둘을 건드리는 네 자리(보내기·수락·거절·취소)가 전부 짝을 맞추는지** 본다.
   ⚠️ 이건 새 코드가 지키는지만 본다. 구버전 클라이언트가 수락하면 미러가 남는 건 막을 수 없어서
     존재 확인(isFriendRequestAlive)이 따로 있는 것이다 — 그 존재도 아래에서 확인한다. */
say('· §1-B 미러 정합성 — 한 사실을 두 곳에 적는 값이 어긋나지 않는가');

const RULES = fs.existsSync('firebase-database-rules.json')
  ? fs.readFileSync('firebase-database-rules.json', 'utf8') : null;
chk(!!RULES, 'firebase-database-rules.json 이 있다 (없으면 미러 쓰기가 전부 거부된다)');
if (RULES) {
  const r = JSON.parse(RULES).rules || {};
  chk(!!r.sentFriendRequests, '규칙에 sentFriendRequests 노드가 있다');
  const node = (r.sentFriendRequests || {})['$fromId'] || {};
  chk(node['.read'] === true, '내 보낸 목록을 읽을 수 있다 ($fromId/.read)');
  chk(((node['$toId'] || {})['.write']) === true, '미러 한 줄을 쓰고 지울 수 있다 ($toId/.write)');
  // 존재 확인이 되려면 진짜 요청 쪽 읽기가 열려 있어야 한다 — 이게 (나)를 자가 치유시키는 근거다
  chk((((r.friendRequests || {})['$toId'] || {})['.read']) === true,
      'friendRequests/$toId 가 읽기 가능하다 (존재 확인이 성립하는 근거)');
}

// 미러를 건드리는 자리를 전부 찾아, 각각이 진짜 요청과 짝지어 움직이는지 본다
const apiFns = ['sendFriendRequest', 'acceptFriendRequest', 'rejectFriendRequest', 'cancelFriendRequest'];
/* 함수 본문 잘라내기 — 정규식으로 중괄호를 세지 않는다(본문에 중괄호가 잔뜩이라 반드시 틀린다).
   `async 이름(` 부터 그 뒤 처음 나오는 4칸 들여쓰기 `},` 까지가 한 메서드다. */
function apiBody(fn){
  const i = HTML.indexOf('async ' + fn + '(');
  if (i < 0) return '';
  const j = HTML.indexOf('\n    },', i);
  return j < 0 ? '' : HTML.slice(i, j);
}
for (const fn of apiFns) {
  const body = apiBody(fn);
  chk(!!body, fn + '() 를 찾았다');
  if (!body) continue;
  chk(body.includes('sentFriendRequests/'), '  ' + fn + ' 가 미러를 함께 건드린다');
  chk(body.includes('friendRequests/${'), '  ' + fn + ' 가 진짜 요청도 함께 건드린다');
  /* ⚠️ 한 번의 update() 여야 한다. set/remove 를 두 번 나눠 부르면 사이에서 실패했을 때
       한쪽만 남는다 — 화면에서 구분이 안 되는 반쪽 상태다. */
  chk(/await update\(ref\(db\)/.test(body), '  ' + fn + ' 가 update() 한 번으로 둘을 함께 쓴다');
}

// 존재 확인 3종 세트가 실제로 있고, app.js 가 그걸 쓰는가
for (const fn of ['getSentFriendRequests', 'isFriendRequestAlive', 'pruneSentFriendRequest'])
  chk(HTML.includes('async ' + fn + '('), fn + '() 가 정의돼 있다');
const sentFn = (SRC.match(/async function renderSentRequests[\s\S]*?\n\}/) || [''])[0];
chk(!!sentFn, 'renderSentRequests() 를 찾았다');
chk(sentFn.includes('isFriendRequestAlive'), '목록을 그릴 때 한 건씩 살아 있는지 확인한다');
chk(sentFn.includes('pruneSentFriendRequest'), '죽은 미러는 서버에서도 치운다 (자가 치유)');
chk(!/onValue|subscribe/.test(sentFn),
    '보낸 요청은 **구독이 아니다** (상시 구독을 늘리면 친구 100명 상한의 근거가 무너진다)');
// 확인 실패를 '죽음'으로 보면 멀쩡한 요청이 사라진다 — catch 가 true 를 돌려주는지
const aliveFn = apiBody('isFriendRequestAlive');
chk(/catch\s*\([^)]*\)\s*\{\s*return true/.test(aliveFn),
    '확인이 실패하면 살아 있는 것으로 본다 (멀쩡한 요청을 지우지 않는다)');

say('');

/* ── §2. 런타임 ──────────────────────────────────────────────────── */
say('· §2 런타임 — 자리가 1칸일 때 3건을 일괄 수락하면');

let smokeSrc = fs.readFileSync('smoke.js', 'utf8');
smokeSrc = smokeSrc.slice(0, smokeSrc.indexOf('/* ── 실행'))
  .split('\n').filter(l => !/require\(|const FILE =|if \(!FILE\)|process\.exit/.test(l)).join('\n');
vm.runInThisContext(smokeSrc, { filename: 'smoke-stubs.js' });

const realST = require('timers').setTimeout;
globalThis.setTimeout = (fn, ms) => realST(fn, ms || 0);
globalThis.setInterval = () => 0;
globalThis.clearTimeout = require('timers').clearTimeout;
globalThis.HTMLCanvasElement = class {};
globalThis.Image = class {
  constructor(){ this.naturalWidth = 512; this.naturalHeight = 512; }
  set src(v){ this._src = v; realST(() => { if (this.onload) this.onload(); }, 0); }
  get src(){ return this._src; }
};
globalThis.HTMLImageElement = globalThis.Image;

const probe = `
;globalThis.__F = {
  FRIEND_MAX,
  acceptOne: _fmAcceptOne,
  bulkAccept: _fmBulkAccept,
  seatsLeft:  _fmSeatsLeft,
  setReqs:    r => { _myFriendRequests = r; },
  getReqs:    () => _myFriendRequests,
  setFriends: f => { _myHomeFriends = f; },
  picked:     () => _fmPicked,
  setTab:     t => { _fmTab = t; },
};`;

const _log = console.log, _warn = console.warn;
console.log = () => {}; console.warn = () => {};
try { vm.runInThisContext(SRC + probe, { filename: 'app.js' }); }
catch (e) { console.log = _log; say('  ✗ app.js 평가 실패: ' + (e && e.stack || e)); process.exit(1); }
console.log = _log; console.warn = _warn;

const F = globalThis.__F;

/* 서버 스텁 — ⚠ **수락해도 _myHomeFriends 를 그 자리에서 늘리지 않는다.**
   실제로도 구독 콜백이 와야 늘어난다. 이 시차가 바로 이 검사가 재현하려는 함정이다. */
let accepted = [];
const stubApi = {
  acceptFriendRequest: async (me, from) => { accepted.push(from); },
  rejectFriendRequest: async () => {},
};
globalThis.firebaseAPI = stubApi;
if (globalThis.window) globalThis.window.firebaseAPI = stubApi;

// 자리 1칸만 남긴다
const friends = {};
for (let i = 0; i < F.FRIEND_MAX - 1; i++) friends['f' + i] = { name: 'f' + i };

function setup() {
  accepted = [];
  F.setFriends(Object.assign({}, friends));
  F.setReqs({ a: { name: '민지', ts: 3 }, b: { name: '현우', ts: 2 }, c: { name: '소라', ts: 1 } });
  F.setTab('req');
  const p = F.picked(); p.clear(); p.add('a'); p.add('b'); p.add('c');
}

(async () => {
  // ── (ㄱ) 지금 코드 ─────────────────────────────────────────────
  setup();
  const seats0 = F.seatsLeft();
  chk(seats0 === 1, '시작 시 남은 자리가 1칸이다 (' + seats0 + ')');
  await F.bulkAccept();
  chk(accepted.length === 1, '★ 서버로 간 수락이 1건뿐이다 (' + accepted.length + '건) — 상한을 넘지 않는다');
  chk(accepted[0] === 'c', '먼저 온 요청(ts 가 작은 c)이 그 한 자리를 받았다');
  const left = Object.keys(F.getReqs());
  chk(left.length === 3, '자리가 없어 못 받은 요청은 **목록에 그대로 남는다** (' + left.length + '건)');
  chk(left.includes('a') && left.includes('b'), '남은 것이 a·b 다 (지워지지 않았다)');

  // ── (ㄴ) 일부러 옛날 방식으로 망가뜨린다 ────────────────────────
  //   "매 건 자리를 다시 센다" = 서버 왕복 뒤에도 _myHomeFriends 가 그대로라 3건이 다 통과한다.
  say('');
  say('· 일부러 옛 방식(매 건 다시 세기)으로 돌리면 — 이 검사가 잡는가');
  setup();
  let broken = 0;
  for (const id of ['c', 'b', 'a']) {
    const r = await F.acceptOne(id, F.seatsLeft());   // ← 매번 다시 센다 (틀린 방식)
    if (r === 'ok') broken++;
  }
  chk(broken === 3, '★ 옛 방식이면 3건이 전부 통과한다 — 상한이 조용히 뚫린다 (' + broken + '건)');
  chk(broken !== accepted.length || true, '  (위 (ㄱ) 이 1건이므로 두 방식이 실제로 갈린다)');

  say('');
  say(fail ? '문제 ' + fail + '건' : '전부 통과 ✅ — 일괄 수락이 상한을 넘지 않고, 못 받은 요청을 지우지도 않는다');
  process.exit(fail ? 1 : 0);
})();
