/* sim-hook-guards.js — 🪝 부팅 때 늘 걸리는 window 고리는 가드 없이 부른다(구조 정리 4단계 2)
   실행:  node sim-hook-guards.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — `if(typeof window._mhApplyBg==='function') window._mhApplyBg()` 같은 가드는, 고리를 거는 모듈이
     안 실리거나 이름이 바뀌어도 조용히 아무 일도 안 하게 만든다(배경이 안 바뀌는데 오류도 없다). 아래 고리들은
     거는 모듈이 부팅 때 만들어지며 바로 걸고, 실제 앱에서 «걸리기 전에 읽힌 적 0» 을 확인했다(PR 본문). 그래서 가드를 걷고,
     다시 생기지 않게 여기서 막는다. 창을 열 때만 걸리는 고리(_mhCancelNameEdit 등)는 이 표에 넣지 않는다 — 그 가드는 필요하다.
   ・1절: 고리마다 거는 곳이 정해진 한 파일 · 부르는 곳이 있다
   ・2절: 부르는 곳에 typeof 가드가 없다
   ・3절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, path.basename(f)]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const HTML = read('desk-companion-prototype.html');
if (!HTML) { say('  ? 원본 못 찾음 — desk-companion-prototype.html'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

/* 고리 → 거는 파일. 도메인마다 가드를 걷으면서 늘린다 */
const HOOKS = {
  /* 🏠 마이홈 */
  _mhApplyBg: 'myhome/myhome-edit.js', _mhApplyTheme: 'myhome/myhome-edit.js', commitMyHomePage: 'myhome/myhome-edit.js',
  _bgmDestroy: 'myhome/myhome-edit.js', _mhDsClose: 'myhome/myhome-edit.js',
  /* _mhBgmPlaying · _mhBgmSetPlaying · _mhBgmRefresh 는 window 고리가 아니라 마이홈 고리판(myhome-hooks.js — sim-myhome-hooks.js)에 건다(순환 끊기 8) */
  _mhSyncBgmBounds: 'myhome/myhome-ui.js', openMyHome: 'myhome/myhome-ui.js',
  _mhFitWindow: 'myhome/myhome-sticker-layout.js',
  _mhGbStartWatch: 'myhome/guestbook.js', _mhGbStopWatch: 'myhome/guestbook.js', _mhGbRefreshBadge: 'myhome/guestbook.js',
  _mhGbRefreshWriteUI: 'myhome/guestbook.js', _mhGbMarkAllRead: 'myhome/guestbook.js', _mhReSubscribeGuestbook: 'myhome/guestbook.js',
  _mallangOnOpen: 'myhome/mallang.js', _mallangOnClose: 'myhome/mallang.js', _mallangSeenGifts: 'myhome/mallang.js',
  _mallangOpenGift: 'myhome/mallang.js', _mallangGiftOrder: 'myhome/mallang.js', _mallangIsGiftHidden: 'myhome/mallang.js',
  _mallangDeleteGift: 'myhome/mallang.js',
  _bugBoardOpen: 'support/bug-board-ui.js', _bugBoardRefreshBadge: 'support/bug-board-ui.js',
  /* 🕒 포커스 · 🎨 꾸미기 · 🚪 방 · 🎵 플레이리스트 · 🛠️ 관리자(4단계 2-2 — app.js 안의 부름은 구역 떼기와 겹치지 않게 그 작업 뒤에) */
  _focusLogClamp: 'focus/focus-log.js', refreshWardrobe: 'character/wardrobe-panel.js',
  _onRoomMeta: 'chat/chat-prefs.js', _onHostSucceeded: 'room/room-entry.js', _onRoomDisbanded: 'room/room-entry.js',
  _gachaRestorePos: 'character/gacha.js', _plApplyPos: 'status/playlist.js', _plSyncBgmBounds: 'status/playlist.js',
  _lxHideWin: 'admin/admin-license-bulk.js',
};

function judge(files) {
  const r = { badOwner: [], noCaller: [], guarded: [] };
  for (const [n, owner] of Object.entries(HOOKS)) {
    const esc = n.replace(/\$/g, '\\$');
    const defRe = new RegExp('window\\.' + esc + '\\s*=(?!=)');
    const defs = files.filter(([, t]) => defRe.test(t)).map(([f]) => f);
    if (!(defs.length === 1 && defs[0] === owner)) r.badOwner.push(n + '(' + (defs.join(' · ') || '없음') + ')');
    const callRe = new RegExp('(?<![\\w$.])(?<!function\\s)(?:window\\.)?' + esc + '\\(');
    if (!files.some(([, t]) => callRe.test(t))) r.noCaller.push(n);
    const gRe = new RegExp("typeof\\s+(?:window\\.)?" + esc + "\\s*===?\\s*'function'");
    for (const [f, t] of files) if (gRe.test(t)) r.guarded.push(f + ' ' + n);
  }
  return r;
}

const ORDER = [...HTML.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*\bsrc="parts\/([^"]+\.js)"/g)].map(m => m[1]);
const FILES = ORDER.map(f => [f, read(f)]).filter(([, t]) => t).map(([f, t]) => [f, strip(t)]);
const R = judge(FILES);

say('── 1. 거는 곳 · 부르는 곳 (고리 ' + Object.keys(HOOKS).length + '개)');
chk(!R.badOwner.length, '고리마다 거는 곳은 정해진 한 파일' + (R.badOwner.length ? ' — 어긋남: ' + R.badOwner.join(', ') : ''));
chk(!R.noCaller.length, '고리마다 부르는 곳이 있다(안 쓰는 고리는 표에서 뺀다)' + (R.noCaller.length ? ' — ' + R.noCaller.join(' · ') : ''));

say('── 2. 가드 없음');
chk(!R.guarded.length, '부르는 곳에 typeof 가드가 없다 — 고리가 없으면 그 자리에서 드러난다' + (R.guarded.length ? ' — ' + R.guarded.join(', ') : ''));

say('── 3. 일부러 깨 보기');
const g = FILES.map(([f, t]) => [f, f === 'myhome/myhome-page.js' ? t + "\nif(typeof window._mhApplyBg==='function') window._mhApplyBg();\n" : t]);
chk(judge(g).guarded.length > 0, '가드가 다시 생기면 빨강');
const d = FILES.map(([f, t]) => [f, f === 'myhome/myhome-page.js' ? t + '\nwindow._mhApplyBg = ()=>{};\n' : t]);
chk(judge(d).badOwner.some(x => x.startsWith('_mhApplyBg')), '다른 파일이 같은 고리를 또 걸면 빨강');
const gone = FILES.map(([f, t]) => [f, f === 'myhome/mallang.js' ? t.replace(/window\._mallangGiftOrder\s*=/g, 'window._mallangGiftOrderX =') : t]);
chk(judge(gone).badOwner.some(x => x.startsWith('_mallangGiftOrder(')), '거는 줄이 없어지면 빨강');

say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
