/* sim-demoji-catalog.js — 😊 기본 이모티콘 목록(demoji-catalog.js) — 채팅 · 말풍선 · 마이홈 바탕화면이 같이 읽는 맨 아래 표
   실행:  node sim-demoji-catalog.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — 목록이 채팅 모듈(chat-ui.js) 안에 있으면 마이홈 바탕화면이 채팅을 바라보게 되고,
     채팅 쪽에서 마이홈까지 이어지는 길이 있어 순환이 된다(sim-dep-cycles). 그래서 목록은 맨 아래 이 파일 한 곳에 두고,
     읽는 파일보다 먼저 싣는다. 받는 쪽은 [demoji:id] 를 이 표에서만 찾으므로, id · 명령어가 겹치거나 그림 파일이 없으면
     조용히 안 그려진다.
   ・1절: 표 — 33개 · id 와 명령어가 겹치지 않음 · BY_ID · BY_CMD 가 목록과 같음 · 바꿀 수 없음 · 그림 파일이 다 있음
   ・2절: 한 곳 — 목록 글(파일 이름 줄)은 이 파일에만 · chat-ui 는 deps 로 받음 · 마이홈 바탕화면은 TwDemojiCatalog 로 읽음
   ・3절: HTML 순서(읽는 파일 · app.js 보다 먼저)
   ・4절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, path.basename(f)]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('chat/demoji-catalog.js'), HTML = read('desk-companion-prototype.html'), APP = read('app.js');
if (!MOD || !HTML || !APP) { say('  ? 원본 못 찾음 — demoji-catalog.js · desk-companion-prototype.html · app.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
/* 그림 폴더 — 저장소 루트(app/emoji/default) · 러너 스테이징(emoji/default) 어느 쪽이든 */
const EMOJI_DIR = ['app/emoji/default', 'emoji/default'].find(d => fs.existsSync(d)) || null;

function load(mod) { const win = {}; new Function('window', 'module', mod)(win, undefined); return win.TwDemojiCatalog; }
function judge(mod, html, files) {
  const r = {};
  try {
    const C = load(mod);
    r.n = C.LIST.length;
    r.uniq = new Set(C.LIST.map(d => d.id)).size === r.n && new Set(C.LIST.map(d => d.cmd)).size === r.n;
    r.maps = Object.keys(C.BY_ID).length === r.n && Object.keys(C.BY_CMD).length === r.n && C.LIST.every(d => C.BY_ID[d.id] === d && C.BY_CMD[d.cmd] === d);
    r.shape = C.LIST.every(d => /^d\d{2}$/.test(d.id) && d.cmd && /^d\d{2}\.(png|gif|webp)$/.test(d.file) && d.w > 0 && d.h > 0) && C.DIR === 'emoji/default/';
    r.frozen = Object.isFrozen(C) && Object.isFrozen(C.LIST) && Object.isFrozen(C.BY_ID) && Object.isFrozen(C.BY_CMD) && C.LIST.every(d => Object.isFrozen(d));
    r.missing = EMOJI_DIR ? C.LIST.filter(d => !fs.existsSync(path.join(EMOJI_DIR, d.file))).map(d => d.file) : null;
  } catch (e) { r.err = String(e && e.message || e); }
  /* 목록 글은 이 파일에만 — 다른 파일에 {id:'d01',…file:'d01.png'} 같은 줄이 다시 생기면 두 벌이 된다 */
  r.dup = files.filter(([f, t]) => f !== 'chat/demoji-catalog.js' && /\{\s*id\s*:\s*'d\d{2}'\s*,\s*cmd\s*:/.test(t)).map(([f]) => f);
  const order = [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*\bsrc="parts\/([^"]+\.js)"/g)].map(m => m[1]);
  const at = order.indexOf('chat/demoji-catalog.js');
  const users = files.filter(([f, t]) => f !== 'chat/demoji-catalog.js' && /\bTwDemojiCatalog\b/.test(strip(t))).map(([f]) => f);
  r.late = at < 0 ? ['(demoji-catalog.js 를 안 싣는다)'] : users.filter(f => order.indexOf(f) >= 0 && order.indexOf(f) < at);
  r.users = users;
  return r;
}

const ORDER = [...HTML.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*\bsrc="parts\/([^"]+\.js)"/g)].map(m => m[1]);
const FILES = ORDER.map(f => [f, f === 'app.js' ? APP : read(f)]).filter(([, t]) => t);
const R = judge(MOD, HTML, FILES);
const CU = (FILES.find(([f]) => f === 'chat/chat-ui.js') || [])[1] || '';
const MHD = (FILES.find(([f]) => f === 'myhome/myhome-desktop.js') || [])[1] || '';

say('── 1. 표');
chk(!R.err && R.n === 33, '기본 이모티콘 33개' + (R.err ? ' — ' + R.err : ' (지금 ' + R.n + ')'));
chk(R.uniq, 'id · 명령어가 서로 겹치지 않는다(겹치면 뒤의 것이 앞의 것을 가린다)');
chk(R.maps, 'BY_ID · BY_CMD 가 목록과 같은 물건을 가리킨다');
chk(R.shape, '칸 모양 — id dNN · 명령어 · 파일 dNN.png|gif|webp · 크기 · 폴더 emoji/default/');
chk(R.frozen, '표 · 목록 · 찾기 표 · 항목 모두 바꿀 수 없다(읽는 쪽이 고쳐 쓰지 못하게)');
if (R.missing === null) say('  · 그림 폴더가 스테이징에 없다 — 파일 확인은 건너뜀');
else chk(!R.missing.length, '그림 파일 ' + R.n + '개가 다 있다' + (R.missing.length ? ' — 없음: ' + R.missing.join(' · ') : ''));

say('── 2. 한 곳');
chk(!R.dup.length, '목록 글은 demoji-catalog.js 에만' + (R.dup.length ? ' — 또 있는 곳: ' + R.dup.join(' · ') : ''));
chk(/^const demojiCatalog = deps\.demojiCatalog;/m.test(CU) && /^const DEMOJI_LIST = demojiCatalog\.LIST;$/m.test(CU), 'chat-ui.js 는 deps 로 받아 쓴다(내놓는 DEMOJI_* 이름은 그대로)');
chk(/^const demojiCatalog = TwDemojiCatalog;/m.test(APP) && /^  demojiCatalog: demojiCatalog,$/m.test(APP), 'app.js 가 TwDemojiCatalog 를 그대로 받아 만드는 줄에 넘긴다');
chk(/TwDemojiCatalog\.BY_ID\[id\]/.test(MHD) && /TwDemojiCatalog\.BY_CMD\[cmd\]/.test(MHD) && !/chatUiMod\.DEMOJI_|(?<![\w.])DEMOJI_BY_/.test(strip(MHD)), '마이홈 바탕화면은 TwDemojiCatalog 로 읽는다(채팅 모듈을 바라보지 않는다)');

say('── 3. 싣는 순서');
chk(R.users.length >= 2 && !R.late.length, '읽는 파일 ' + R.users.length + '개(' + R.users.join(' · ') + ')보다 먼저 싣는다' + (R.late.length ? ' — 먼저 실리는 것: ' + R.late.join(' · ') : ''));

say('── 4. 일부러 깨 보기');
chk(judge(MOD.replace("{id:'d02',cmd:'ㄱ-'", "{id:'d01',cmd:'ㄱ-'"), HTML, FILES).uniq === false, 'id 가 겹치면 빨강');
chk(judge(MOD.replace("const api = Object.freeze({", "const api = ({"), HTML, FILES).frozen === false, '표를 얼리지 않으면 빨강');
const dupFiles = FILES.map(([f, t]) => [f, f === 'chat/chat-ui.js' ? t + "\nconst X = [{id:'d01',cmd:'...',file:'d01.png',w:19,h:19}];\n" : t]);
chk(judge(MOD, HTML, dupFiles).dup.includes('chat/chat-ui.js'), '다른 파일에 목록 글이 다시 생기면 빨강');
const line = '<script src="parts/chat/demoji-catalog.js"></script>';
const lateHtml = HTML.indexOf(line) < 0 ? HTML : HTML.replace(line, '').replace('<script src="parts/app.js"></script>', '<script src="parts/app.js"></script>\n' + line);
chk(judge(MOD, lateHtml, FILES).late.length > 0, 'app.js 뒤에 실으면 빨강');

say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
