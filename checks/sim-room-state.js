/* sim-room-state.js — 🧭 방 공용 상태(room-state.js — 지금 채널 · 방 meta 사본)
   실행:  node sim-room-state.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — window._activeChannel · window._roomMetaCache 는 채팅 · 깜짝쇼 · 주사위 · 상태칩 · 숨기기 등 여러 모듈이 읽는다.
     처음 값이 바꾸는 쪽(room-entry)에만 있으면 읽는 모듈이 모두 room-entry 를 바라봐 순환이 되고(sim-dep-cycles), 부팅 직후엔 «없는» 값이었다.
     처음 값은 맨 아래 room-state.js 한 곳 · 읽는 모듈보다 먼저 싣는다 · 바꾸는 파일은 정해진 셋뿐.
   ・1절: 싣기만 하면 채널 1(워킹룸 — 나가기가 되돌리는 값과 같음) · meta null
   ・2절: HTML 이 읽는 · 바꾸는 파일 모두보다 먼저 싣는다 · 바꾸는 파일은 room-entry · chat-prefs · chat-ui 뿐
   ・3절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, path.basename(f)]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('room/room-state.js'), HTML = read('desk-companion-prototype.html');
if (!MOD || !HTML) { say('  ? 원본 못 찾음 — room-state.js · desk-companion-prototype.html'); process.exit(2); }
const NAMES = ['_activeChannel', '_roomMetaCache'];
const WRITERS = ['room/room-state.js', 'room/room-entry.js', 'chat/chat-prefs.js', 'chat/chat-ui.js'];
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

function judge(mod, html, files) {
  const r = {};
  const win = {};
  try { new Function('window', mod)(win); } catch (_) {}
  r.init = win._activeChannel === 1 && win._roomMetaCache === null && Object.prototype.hasOwnProperty.call(win, '_roomMetaCache');
  const order = [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*\bsrc="parts\/([^"]+\.js)"/g)].map(m => m[1]);
  const at = order.indexOf('room/room-state.js');
  const users = files.filter(([f, t]) => f !== 'room/room-state.js' && NAMES.some(n => new RegExp('\\b' + n + '\\b').test(strip(t)))).map(([f]) => f);
  r.late = at < 0 ? ['(room-state.js 를 안 싣는다)'] : users.filter(f => order.indexOf(f) >= 0 && order.indexOf(f) < at);
  r.users = users.length;
  r.writers = files.filter(([f, t]) => !WRITERS.includes(f) && NAMES.some(n => new RegExp('window\\.' + n + '\\s*=[^=]').test(strip(t)))).map(([f]) => f);
  return r;
}

const ORDER = [...HTML.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*\bsrc="parts\/([^"]+\.js)"/g)].map(m => m[1]);
const FILES = ORDER.map(f => [f, read(f)]).filter(([, t]) => t);
const R = judge(MOD, HTML, FILES);

say('── 1. 처음 값');
chk(R.init, '싣기만 하면 window._activeChannel = 1(워킹룸 · 나가기가 되돌리는 값) · window._roomMetaCache = null');

say('── 2. 싣는 순서 · 바꾸는 곳');
chk(FILES.length >= 100, 'HTML 이 싣는 parts/ 파일 ' + FILES.length + '개를 읽었다');
chk(R.users >= 10 && !R.late.length, '읽는 · 바꾸는 파일 ' + R.users + '개 모두보다 room-state.js 를 먼저 싣는다' + (R.late.length ? ' — 먼저 실리는 파일: ' + R.late.join(' · ') : ''));
chk(!R.writers.length, '값을 바꾸는 파일은 room-entry · chat-prefs · chat-ui 뿐(새로 바꾸는 곳은 여기 목록과 주석에 이유를 적는다)' + (R.writers.length ? ' — 그 밖: ' + R.writers.join(' · ') : ''));

say('── 3. 일부러 깨 보기');
const line = '<script src="parts/room/room-state.js"></script>';
const iLine = HTML.indexOf(line);
const lateHtml = iLine < 0 ? HTML : HTML.replace(line, '').replace('<script src="parts/app.js"></script>', '<script src="parts/app.js"></script>\n' + line);
chk(judge(MOD, lateHtml, FILES).late.length > 0, 'room-state.js 를 app.js 뒤로 옮기면 빨강');
chk(!judge(MOD.replace('window._roomMetaCache = null;', ''), HTML, FILES).init, '처음 값 한 줄을 빼면 빨강');
const extra = FILES.map(([f, t]) => [f, f === 'room/dice-games.js' ? t + '\nwindow._activeChannel = 2;\n' : t]);
chk(judge(MOD, HTML, extra).writers.includes('room/dice-games.js'), '다른 파일이 채널을 바꾸면 빨강');

say('\n' + (fail ? '✗ 통과 ' + pass + ' · 실패 ' + fail : '전부 통과 ✅ ' + pass + ' — 방 공용 상태는 room-state.js 한 곳에서 시작'));
process.exit(fail ? 1 : 0);
