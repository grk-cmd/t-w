/* ═══ 🧱 sim-firebase-left.js — 마지막 방어선: firebase-init.js 는 Auth · Storage · 점검 칸 읽기 말고는 Firebase 를 쓰지 않는다 ═══
   ・1절: 진짜 firebase-init.js — 데이터베이스 import 는 getDatabase · ref · get 셋 · 읽기는 config/maintenance 한 곳(`ref(db, …)` 한 번 · `_sdkGet` 한 번)
          · 쓰기 · 구독 · 트랜잭션 · onDisconnect 이름이 코드에 없다 · window.firebaseAPI 의 이름은 Auth · Storage · 토큰 · 대화 기록 연결뿐
   ・2절: mutation test — 쓰기 import · DB 쓰기 호출 · 점검 말고 다른 경로 읽기 · 허용 밖 메서드를 일부러 넣으면 판정이 빨강을 내는지
   ・3절: html 의 CSP(두 줄 — 활성 1단계 · 주석 2단계)를 지시어 맵으로 풀어 기대 표와 **같은지**(주소가 늘어도 줄어도 빨강)
   ・4절: html <script> 목록 ↔ smoke.js(PRELOAD) — 목록에 없는 파일을 PRELOAD 가 싣지 않고 · html 이 싣는 파일이 디스크에 있고 · smoke 가 html 목록을 스스로 읽는다
   ・5절: mutation test — CSP 에 주소 하나를 더하거나 빼면 · html 에서 파일을 빼면 빨강
   [실행] node checks/run.js sim-firebase-left */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const DIRS = ['', 'parts/', 'app/parts/', 'apps/desktop/app/parts/'];
const FI = (() => { for(const d of DIRS){ const s = read(d + 'firebase-init.js'); if(s != null) return s; } say('  ? 원본 못 찾음 — firebase-init.js'); process.exit(2); })();
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

/* 허용 이름 — 로그인(Auth) · 파일(Storage) · 토큰 · 대화 기록 연결(이 PC IndexedDB) */
const ALLOWED = new Set(['getIdToken', 'chatHistory', 'authReady', 'authRestoring', 'authAnswered', 'authCurrentUid', 'authCurrentEmail', 'authUser', 'authSignInWithGoogle',
  'authSignInWithFriendCode', 'authLinkGoogle', 'authSignOut', 'authProviders', 'authReauthPassword', 'authReauthGoogle',
  'uploadSlotGlb', 'uploadRoomFace', 'uploadUserImage', 'uploadAwayImg', 'deleteStorageUrl', 'uploadEmojiImage', 'pkUploadFrame']);

/* 위반 목록 — 비면 통과 */
function audit(src){
  const c = strip(src), bad = [];
  const dbImp = [...c.matchAll(/import\s*\{([^}]*)\}\s*from\s*"[^"]*firebase-database\.js"/g)];
  if(dbImp.length !== 1) bad.push('데이터베이스 import 가 한 줄이 아님: ' + dbImp.length);
  else{
    const names = dbImp[0][1].split(',').map(x => x.trim().split(/\s+as\s+/)[0]).filter(Boolean).sort().join(',');
    if(names !== 'forceWebSockets,get,getDatabase,ref') bad.push('데이터베이스 import 가 getDatabase · ref · get · forceWebSockets 넷이 아님: ' + names);
  }
  for(const w of ['set', 'update', 'remove', 'push', 'onValue', 'runTransaction', 'onDisconnect', 'onChildAdded', 'onChildChanged', 'serverTimestamp', 'goOffline', 'goOnline'])
    if(new RegExp('(^|[^\\w.$])' + w + '\\s*\\(').test(c)) bad.push('DB 이름을 부름: ' + w + '(');
  if(!/(^|[^\w.$])forceWebSockets\(\)\s*;[\s\S]*?getDatabase\(\s*fbApp\s*\)/.test(c)) bad.push('getDatabase 전에 forceWebSockets() 를 부르지 않음');
  if((c.match(/\bref\(\s*db\b/g) || []).length !== 1) bad.push('ref(db, …) 가 한 번이 아님');
  if(!/ref\(\s*db,\s*window\.TwMaintenance\.MAINTENANCE_PATH\s*\)/.test(c)) bad.push('DB 읽기가 점검 칸(MAINTENANCE_PATH)이 아님');
  if((c.match(/\b_sdkGet\s*\(/g) || []).length !== 1) bad.push('DB get 이 한 번이 아님');
  const m = c.match(/window\.firebaseAPI\s*=\s*\{/);
  if(!m) bad.push('window.firebaseAPI 를 못 찾음');
  else{
    let i = m.index + m[0].length, d = 1, body = '';
    for(; i < c.length && d; i++){ const ch = c[i]; if(ch === '{') d++; else if(ch === '}') d--; if(d) body += ch; }
    // 최상위 이름만 — 4칸 들여쓴 줄의 `이름(` · `이름:`
    const keys = [...(body.replace(/\{[^{}]*\}/g, '{}')).matchAll(/(?:^|\n)\s{4}(?:async\s+)?([A-Za-z_]\w*)\s*(?:\(|:)/g)].map(x => x[1]);
    for(const k of keys) if(!ALLOWED.has(k)) bad.push('허용 밖 firebaseAPI 이름: ' + k);
    if(!keys.length) bad.push('firebaseAPI 이름을 하나도 못 읽음');
  }
  return bad;
}

say('── 1. 진짜 firebase-init.js');
{
  const bad = audit(FI);
  chk(bad.length === 0, 'DB 는 점검 칸 읽기 하나 · Auth · Storage 외 이름 없음' + (bad.length ? ' — ' + bad.join(' / ') : ''));
  chk(/_mt\.start\(\{ readServer:/.test(strip(FI)) && /readFlag:/.test(strip(FI)), '  ↳ 점검 칸 읽기는 _mt.start 의 readFlag 하나(서버 /v2/config 먼저 — Q1 둘 다)');
}

say('── 2. mutation test');
{
  const real = FI;
  const brk = [
    ['쓰기 import 를 더함', (s) => s.replace('get as _sdkGet, forceWebSockets }', 'get as _sdkGet, set as _sdkSet, forceWebSockets }')],
    ['DB 쓰기를 부름', (s) => s.replace('  window.firebaseAPI = {', "  set(ref(db, 'x'), 1);\n  window.firebaseAPI = {")],
    ['forceWebSockets 호출을 뺌', (s) => s.replace(/forceWebSockets\(\);/, '')],
    ['점검 말고 다른 경로를 읽음', (s) => s.replace('window.TwMaintenance.MAINTENANCE_PATH)).then', "'users/a')).then")],
    ['구독을 검', (s) => s.replace('  window.firebaseAPI = {', "  onValue(ref(db, 'x'), () => {});\n  window.firebaseAPI = {")],
    ['허용 밖 메서드를 더함', (s) => s.replace('    getIdToken(force){', '    lookupFriendCode(code){ return null; },\n    getIdToken(force){')],
    ['DB 읽기를 하나 더함', (s) => s.replace('  window.firebaseAPI = {', "  _sdkGet(ref(db, 'y'));\n  window.firebaseAPI = {")],
  ];
  for(const [what, f] of brk){
    const out = f(real);
    chk(out !== real && audit(out).length > 0, '일부러 깸 — ' + what + ' → 빨강');
  }
}

/* ── 3~5절 — CSP 기대 표 · html <script> ↔ smoke PRELOAD ── */
const HTML_FILE = (() => { for(const d of ['', 'app/', 'apps/desktop/app/']){ const f = d + 'desk-companion-prototype.html'; if(read(f) != null) return f; } say('  ? 원본 못 찾음 — desk-companion-prototype.html'); process.exit(2); })();
const HTML = read(HTML_FILE);
const SMOKE = (() => { for(const d of ['', 'checks/', '../checks/']){ const t = read(d + 'smoke.js'); if(t != null) return t; } say('  ? 원본 못 찾음 — smoke.js'); process.exit(2); })();

/* 기대 표(E-6) — 지시어 → 출처 목록. 'unsafe-inline' 만 1단계 · 2단계가 다르다 */
const CSP_BASE = {
  'default-src': ["'self'", 'file:'],
  'script-src': ["'self'", 'file:', 'https://www.gstatic.com'],
  'style-src': ["'self'", 'file:', "'unsafe-inline'"],
  'img-src': ["'self'", 'file:', 'data:', 'blob:', 'https:', 'http:'],
  'media-src': ["'self'", 'file:', 'data:', 'blob:'],
  'font-src': ["'self'", 'file:', 'data:'],
  /* 점검 칸 읽기(Q1 둘 다 — 서버에 못 닿을 때 Firebase config/maintenance)만 DB 주소를 남긴다 · *.googleapis.com 은 로그인 토큰 · Storage */
  'connect-src': ["'self'", 'data:', 'blob:', 'https://*.firebasedatabase.app', 'wss://*.firebasedatabase.app', 'https://*.googleapis.com', 'https://www.gstatic.com',
    'https://www.youtube.com', 'wss://*.together-working.com', 'https://*.together-working.com', 'ws://127.0.0.1:8787', 'ws://localhost:8787'],
  'worker-src': ["'self'", 'blob:'],
  'frame-src': ['https://help.together-working.com'],
  'object-src': ["'none'"],
  'base-uri': ["'none'"],
  'form-action': ["'none'"],
};
const cspMaps = (h) => [...h.matchAll(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/g)].map((m) => {
  const o = {};
  for(const part of m[1].split(';')){ const t = part.trim().split(/\s+/).filter(Boolean); if(t.length) o[t[0]] = t.slice(1).sort(); }
  return o;
});
const sortO = (o) => { const r = {}; for(const k of Object.keys(o).sort()) r[k] = o[k].slice().sort(); return r; };
function cspProblems(h){
  const maps = cspMaps(h), bad = [];
  if(maps.length !== 2) return ['CSP 줄이 둘이 아님: ' + maps.length];
  const want = [JSON.parse(JSON.stringify(CSP_BASE)), JSON.parse(JSON.stringify(CSP_BASE))];
  want[0]['script-src'].push("'unsafe-inline'");   // 1단계(활성)만 — 2단계(주석)는 빠진다
  maps.forEach((got, i) => {
    const w = sortO(want[i]), g = sortO(got);
    for(const k of new Set([...Object.keys(w), ...Object.keys(g)])){
      const a = w[k] || [], b = g[k] || [];
      const more = b.filter((x) => !a.includes(x)), less = a.filter((x) => !b.includes(x));
      if(more.length) bad.push((i + 1) + '단계 ' + k + ' 에 표 밖 주소: ' + more.join(' '));
      if(less.length) bad.push((i + 1) + '단계 ' + k + ' 에서 빠진 주소: ' + less.join(' '));
    }
  });
  return bad;
}
/* html <script> ↔ smoke — 반환: 위반 목록 */
function scriptProblems(h, smoke, exists){
  const bad = [];
  const live = h.replace(/<!--[\s\S]*?-->/g, '');
  const files = [...live.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
  const partsClassic = [...live.matchAll(/<script\b([^>]*)\bsrc="parts\/([^"]+\.js)"/g)].filter((m) => !/type="module"/.test(m[1])).map((m) => m[2]);
  const iApp = partsClassic.findIndex((x) => /(^|\/)app\.js$/.test(x));
  const before = new Set(partsClassic.slice(0, iApp < 0 ? 0 : iApp).map((x) => x.split('/').pop()));
  for(const f of files) if(!/^https?:/.test(f) && !exists(f)) bad.push('html 이 싣는 파일이 없음: ' + f);
  const pre = [...smoke.matchAll(/PRELOAD\.push\('([^']+)'\)/g)].map((m) => m[1]).concat(['human-ear.js', 'wd-ear.js']);
  for(const f of pre) if(!before.has(f)) bad.push('PRELOAD 에만 있고 html(app.js 앞 classic)에 없음: ' + f);
  if(!/function loadSiblingScripts/.test(smoke) || !/<script\\b/.test(smoke)) bad.push('smoke 가 html <script> 목록을 스스로 읽지 않음(html 에만 있는 파일을 놓침)');
  return bad;
}
const existsApp = (f) => { const base = HTML_FILE.replace(/[^/]*$/, ''); return fs.existsSync(base + f); };

say('── 3. CSP — 지시어 맵 = 기대 표(주소가 늘어도 줄어도 빨강)');
{
  const bad = cspProblems(HTML);
  chk(bad.length === 0, 'html CSP 두 줄(1단계 활성 · 2단계 주석)이 기대 표와 같다' + (bad.length ? ' — ' + bad.join(' / ') : ''));
  const maps = cspMaps(HTML), all = maps.map((m) => Object.values(m).flat().join(' ')).join(' ');
  chk(!/firebaseio\.com|cloudfunctions\.net|appspot\.com|duckdns/.test(all), '  ↳ 옛 실시간 DB(firebaseio) · 함수 · appspot · 옛 임시 도메인(duckdns) 주소가 없다');
  chk(maps.every((m) => !(m['script-src'] || []).some((x) => /firebasedatabase|firebaseio/.test(x))) && maps.every((m) => (m['connect-src'] || []).includes('https://*.firebasedatabase.app') && (m['connect-src'] || []).includes('wss://*.firebasedatabase.app')),
    '  ↳ DB 주소는 script-src 에 없고 connect-src(https · wss)에만 — 점검 칸 읽기가 막히지 않는다');
}

say('── 4. html <script> ↔ smoke PRELOAD');
{
  const bad = scriptProblems(HTML, SMOKE, existsApp);
  chk(bad.length === 0, 'PRELOAD 는 html 목록 안 · html 파일은 모두 디스크에 있다 · smoke 가 html 목록을 스스로 읽는다' + (bad.length ? ' — ' + bad.slice(0, 5).join(' / ') : ''));
}

say('── 5. mutation test — CSP · script 목록');
{
  const brkC = [
    ['connect-src 에 주소 하나를 더함', (h) => h.replace('https://www.youtube.com', 'https://www.youtube.com https://x.example')],
    ['script-src 에 DB 주소를 되살림', (h) => h.replace('https://www.gstatic.com;', 'https://www.gstatic.com https://*.firebasedatabase.app;')],
    ['connect-src 에서 DB wss 를 뺌(점검 칸 읽기가 막힘)', (h) => h.split(' wss://*.firebasedatabase.app').join('')],
    ['옛 임시 도메인을 되살림', (h) => h.replace('wss://*.together-working.com', 'wss://*.together-working.com wss://*.togetherworking.duckdns.org')],
    ['함수 주소를 되살림', (h) => h.replace('https://*.googleapis.com', 'https://*.googleapis.com https://asia-southeast1-together-working.cloudfunctions.net')],
  ];
  for(const [what, f] of brkC){ const out = f(HTML); chk(out !== HTML && cspProblems(out).length > 0, '일부러 깸 — ' + what + ' → 빨강'); }
  const live = HTML.replace(/<!--[\s\S]*?-->/g, '');
  const firstPart = (live.match(/<script src="parts\/shared\/safe-html\.js"><\/script>/) || [])[0];
  const brkS = [
    ['PRELOAD 에만 있는 파일(html 에서 뺌)', () => scriptProblems(HTML.split(firstPart).join(''), SMOKE, existsApp)],
    ['html 이 없는 파일을 싣음', () => scriptProblems(HTML.replace('</head>', '<script src="parts/shared/no-such-file.js"></script></head>'), SMOKE, existsApp)],
    ['smoke 가 html 목록 읽기를 잃음', () => scriptProblems(HTML, SMOKE.replace('function loadSiblingScripts', 'function loadNothing'), existsApp)],
  ];
  for(const [what, f] of brkS) chk(!!firstPart && f().length > 0, '일부러 깸 — ' + what + ' → 빨강');
}

say(`\n판정: 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
