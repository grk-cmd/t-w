/* ═══ ☁️ sim-slot-sync.js — ☁️ 슬롯(캐릭터) 기기 간 동기화 · 연동 UI(런처 띠 · 계정 탭 기기 연동 구획) 모듈 구조 (2026-10-14 신설 · 앱 FSD 19번) ═══════════════
   app.js 의 «☁️ 슬롯 기기 간 동기화» · «☁️ 연동 UI» 두 구역 본문 을 parts/character/slot-sync.js 로 옮겼다(글자 그대로 · 바뀐 줄 3 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(sim-slot-sync.js · sim-slot-conflict.js 등).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(SLOTS_LASTSYNC_KEY · SLOTS_LOSS_KEY · SLOTS_PUSHFAIL_KEY · SLOTS_SEEN_KEY · SLOTS_SYNC_INTERVAL_MS · SLOTS_TS_KEY · SLOTS_TS_SKEW_TOL_MS · SLOT_GLB_CACHE_KEY · SLOT_IMG_FIELDS · SLOT_JSON_MAX · _slotFromServerObj · _slotGlbCacheLoad · _slotGlbCacheSave · _slotToServerObj · _slotsBackupSave · _slotsConflict · setSlotsConflict · _slotsFilledCount · _slotsHasLocal · _slotsNow · _slotsPushTimer · setSlotsPushTimer · _slotsRenderAcctSync · _slotsRenderBand · _slotsSchedulePush · _slotsSeen · setSlotsSeen · _slotsTouch · _slotsTs · setSlotsTs · syncSlotsToServer)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 19줄 그대로 · 부르는 곳은 slotSyncMod.이름 · html(app.js 앞)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · slot-sync.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["slot-sync.js","parts/character/slot-sync.js","app/parts/character/slot-sync.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — slot-sync.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = ["_quickHash","_roomFaceCacheLoad","_roomFaceCacheSave","_srvNow","_storageFaceUrlOne","_warnServerWriteDenied","getMyUserId","loadSlots","renderCharSlots","renderLauncher","slotToObj","toast"];
const VAL_DEPS = ["CHAR_SLOT_MAX","LS_KEY","_blinkEverDrawn","_faceEverDrawn","slots"];
const GET_DEPS = ["charsMod","creatorOpen"];
const SET_DEPS = [];
const EXPORTS = ["SLOTS_LASTSYNC_KEY","SLOTS_LOSS_KEY","SLOTS_PUSHFAIL_KEY","SLOTS_SEEN_KEY","SLOTS_SYNC_INTERVAL_MS","SLOTS_TS_KEY","SLOTS_TS_SKEW_TOL_MS","SLOT_GLB_CACHE_KEY","SLOT_IMG_FIELDS","SLOT_JSON_MAX","_slotFromServerObj","_slotGlbCacheLoad","_slotGlbCacheSave","_slotToServerObj","_slotsBackupSave","_slotsConflict","setSlotsConflict","_slotsFilledCount","_slotsHasLocal","_slotsNow","_slotsPushTimer","setSlotsPushTimer","_slotsRenderAcctSync","_slotsRenderBand","_slotsSchedulePush","_slotsSeen","setSlotsSeen","_slotsTouch","_slotsTs","setSlotsTs","syncSlotsToServer"];
const MOVED = ["SLOTS_TS_KEY","SLOT_GLB_CACHE_KEY","SLOTS_SYNC_INTERVAL_MS","SLOTS_PUSH_DEBOUNCE_MS","SLOT_JSON_MAX","SLOTS_TS_SKEW_TOL_MS","SLOTS_BAK_KEY","SLOTS_BAK_META_KEY","SLOTS_SEEN_KEY","_slotsTs","_slotsSeen","_slotsConflict","_slotsConflictHandler","_slotsSeenSet","_slotsSyncing","_slotsSyncPending","_slotsPushTimer","_slotsNow","_slotsHasLocal","_slotsFilledCount","_slotsBakMeta","_slotsBackupSave","slotsBackupInfo","restoreSlotsBackup","_slotsTouch","_slotsSchedulePush","_slotGlbCacheLoad","_slotGlbCacheSave","_storageGlbUrlOne","_fetchB64","_fetchImgDataUrl","SLOT_IMG_FIELDS","_slotToServerObj","_slotFromServerObj","_slotsAdoptFromServer","_slotsPushToServer","_slotsConflictNote","slotsConflictInfo","resolveSlotsConflict","SLOTS_LOSS_KEY","SLOTS_LASTSYNC_KEY","SLOTS_PUSHFAIL_KEY","_slotsJsonGet","_slotsJsonSet","_slotsNoteSync","_slotsNotePushFail","_slotsDismissLoss","_slotsFmtWhen","_slotsRefreshUI","_SLOTS_BTN_OPEN","_slotsBtn","_slotsRestoreFromUI","restoreSlotsPrevRemote","_slotsRenderBand","_slotsRenderAcctSync","_slotsShowConflictDlg","_slotsForcedMode","syncSlotsToServer"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  CHAR_SLOT_MAX: CHAR_SLOT_MAX,","  LS_KEY: LS_KEY,","  _blinkEverDrawn: _blinkEverDrawn,","  _faceEverDrawn: _faceEverDrawn,","  _quickHash: (...a)=>_quickHash(...a),","  _roomFaceCacheLoad: (...a)=>_roomFaceCacheLoad(...a),","  _roomFaceCacheSave: (...a)=>_roomFaceCacheSave(...a),","  _srvNow: (...a)=>_srvNow(...a),","  _storageFaceUrlOne: (...a)=>_storageFaceUrlOne(...a),","  _warnServerWriteDenied: (...a)=>_warnServerWriteDenied(...a),","  charsMod: ()=>charsMod,","  creatorOpen: ()=>creatorOpen,","  getMyUserId: (...a)=>getMyUserId(...a),","  loadSlots: (...a)=>loadSlots(...a),","  renderCharSlots: (...a)=>renderCharSlots(...a),","  renderLauncher: (...a)=>renderLauncher(...a),","  slotToObj: (...a)=>slotToObj(...a),","  slots: slots,","  toast: (...a)=>toast(...a),"];

/* 아무 이름 · 아무 부름이나 받아 주는 가짜 — 만들 때 하는 일(버튼 연결 · 저장값 읽기)이 던지지 않는지만 본다.
   then 도 받는다 — 만들 때 부르는 서버 요청(.then 잇기)이 던지지 않게(풀리지는 않는다) */
function anything(){
  const f = function(){ return P; };
  const P = new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? (() => '') : k === 'then' ? (() => P) : k === 'length' ? 0 : P, apply: () => P, construct: () => P, set: () => true, has: () => true });
  return P;
}
function build(src){
  const any = anything();
  const deps = {};
  FN_DEPS.forEach(n => { deps[n] = () => any; });
  VAL_DEPS.forEach(n => { deps[n] = any; });
  GET_DEPS.forEach(n => { deps[n] = () => any; });
  SET_DEPS.forEach(n => { deps['set' + n.replace(/^_+/, '').replace(/^./, c => c.toUpperCase())] = () => {}; });
  const win = new Proxy({}, { get: (t, k) => k in t ? t[k] : any, set: (t, k, v) => { t[k] = v; return true; } });
  const store = {};
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'module',
    src + '\nreturn window.TwSlotSync;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, undefined);
  return api.createSlotSync(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwSlotSync = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwSlotSync(Tw 접두사)');
  const A = strip(app);
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(app.includes("const SLOT_SYNC_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기") && app.includes("const slotSyncMod = (typeof TwSlotSync === 'undefined') ? SLOT_SYNC_MOD_OFF : TwSlotSync.createSlotSync({"), '모듈이 없으면 빈 껍데기 · 만드는 줄');
  const mk = (app.match(new RegExp('const slotSyncMod = \\(typeof TwSlotSync === \'undefined\'\\) \\? SLOT_SYNC_MOD_OFF : TwSlotSync\\.createSlotSync\\(\\{\\n([\\s\\S]*?)\\n\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = mk.split('\n').map(kindOf);
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  const bare = EXPORTS.filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:])').test(A.replace(/const slotSyncMod = [\s\S]*?\n\}\);/, '')));
  t(!bare.length, '부르는 곳은 slotSyncMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/character/slot-sync.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/character/slot-sync.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/character/slot-sync.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  ['deps 하나 빠짐', null, a => { const i = a.indexOf("const slotSyncMod = (typeof TwSlotSync === 'undefined') ? SLOT_SYNC_MOD_OFF : TwSlotSync.createSlotSync({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }, null],
  ['전역 이름 안 걺', m => m.replace('window.TwSlotSync = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* app.js 에 남은 부르는 자리 하나를 옛 이름으로 되돌린다 — 첫 이름을 부르던 곳이 다른 모듈로 옮겨 갔을 수 있어 남은 이름 중에서 고른다 */
  ['부르는 곳이 옛 이름', null, a => { const n = EXPORTS.find(x => a.includes('slotSyncMod.' + x)); return n ? a.replace('slotSyncMod.' + n, n) : a; }, null],
  ['만들 때 던짐', m => m.replace('function createSlotSync(deps){', 'function createSlotSync(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
