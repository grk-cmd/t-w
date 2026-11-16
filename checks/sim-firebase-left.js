/* ═══ 🧱 sim-firebase-left.js — 마지막 방어선: firebase-init.js 는 Auth · Storage · 점검 칸 읽기 말고는 Firebase 를 쓰지 않는다 ═══
   ・1절: 진짜 firebase-init.js — 데이터베이스 import 는 getDatabase · ref · get 셋 · 읽기는 config/maintenance 한 곳(`ref(db, …)` 한 번 · `_sdkGet` 한 번)
          · 쓰기 · 구독 · 트랜잭션 · onDisconnect 이름이 코드에 없다 · window.firebaseAPI 의 이름은 Auth · Storage · 토큰 · 대화 기록 연결뿐
   ・2절: 깨 보기 — 쓰기 import · DB 쓰기 호출 · 점검 말고 다른 경로 읽기 · 허용 밖 메서드를 일부러 넣으면 판정이 빨강을 내는지
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
const ALLOWED = new Set(['getIdToken', 'chatHistory', 'authReady', 'authCurrentUid', 'authCurrentEmail', 'authUser', 'authSignInWithGoogle',
  'authSignInWithFriendCode', 'authLinkGoogle', 'authSignOut', 'authProviders', 'authReload', 'authReauthPassword', 'authReauthGoogle',
  'uploadSlotGlb', 'uploadRoomFace', 'uploadUserImage', 'uploadAwayImg', 'deleteStorageUrl', 'uploadEmojiImage', 'pkUploadFrame']);

/* 위반 목록 — 비면 통과 */
function audit(src){
  const c = strip(src), bad = [];
  const dbImp = [...c.matchAll(/import\s*\{([^}]*)\}\s*from\s*"[^"]*firebase-database\.js"/g)];
  if(dbImp.length !== 1) bad.push('데이터베이스 import 가 한 줄이 아님: ' + dbImp.length);
  else{
    const names = dbImp[0][1].split(',').map(x => x.trim().split(/\s+as\s+/)[0]).filter(Boolean).sort().join(',');
    if(names !== 'get,getDatabase,ref') bad.push('데이터베이스 import 가 getDatabase · ref · get 셋이 아님: ' + names);
  }
  for(const w of ['set', 'update', 'remove', 'push', 'onValue', 'runTransaction', 'onDisconnect', 'onChildAdded', 'onChildChanged', 'serverTimestamp', 'goOffline', 'goOnline'])
    if(new RegExp('(^|[^\\w.$])' + w + '\\s*\\(').test(c) && !/uploadString/.test(w)) bad.push('DB 이름을 부름: ' + w + '(');
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

say('── 2. 깨 보기');
{
  const real = FI;
  const brk = [
    ['쓰기 import 를 더함', (s) => s.replace('import { getDatabase, ref as _dbRef, get as _sdkGet }', 'import { getDatabase, ref as _dbRef, get as _sdkGet, set as _sdkSet }')],
    ['DB 쓰기를 부름', (s) => s.replace('  window.firebaseAPI = {', "  set(ref(db, 'x'), 1);\n  window.firebaseAPI = {")],
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

say(`\n판정: 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
