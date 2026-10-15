/* ═══ 🧩 sim-renderer-src.js — «옮기기 전 app.js 글» 을 되살리는 검사용 도우미 (2026-10-14 신설 · 앱 FSD 2차) ═══════════════
   [왜] 앱 FSD 로 app.js 구역을 모듈(app/parts/*.js)로 옮기면, app.js 글에서 함수 몸통 · 문구를 찾던 옛 검사들이 «없다» 로 빨개진다.
     판정은 그대로 두고 읽는 글만 옮기기 전 모양으로 돌려주면 옛 검사가 같은 뜻으로 돈다. 검사마다 몇 줄씩 덧대지 않게 한 곳에 모은다.
   [쓰는 법] const { joinRenderer } = require('./sim-renderer-src.js');  const APP = joinRenderer(fs.readFileSync('app.js', 'utf8'));
   [되살리기] 아래 MODULES 마다 —
     ① app.js 의 부르는 자리 «mod.이름» 에서 «mod.» 를 뗀다(읽는 함수로 내놓은 이름은 «mod.이름()» → «이름»)
     ② 모듈 글에서 deps 받는 줄(const X = deps.X;)을 빼고, 읽는 함수 «X()» → «X», 쓰는 함수 «setX(v)» → «x = v» 로 되돌린다
        (어느 이름이 읽는 · 쓰는 함수인지는 app.js 의 만드는 줄 — «X: ()=>X,» · «setX: (v)=>{ x = v; },» — 에서 읽는다)
     ③ app.js 뒤에 되돌린 모듈 글을 잇는다(모듈 파일이 없으면 — 옮기기 전 판 — app.js 그대로)
   ⚠️ 새 구역을 옮길 때마다 MODULES 에 한 줄을 더한다(fsdmove 로 옮긴 모듈만 — 1차 모듈은 각 검사가 이미 따로 읽는다).
   [직접 실행] 되살리기가 맞는지 스스로 본다(모듈마다 deps 줄 · mod. 이 안 남고, 옛 이름 선언이 다시 보인다). */
'use strict';
const fs = require('fs');
const MODULES = [
  { file: 'my-info.js', mod: 'myInfoMod', glob: 'TwMyInfo', sample: 'function openMyInfo(' },   // 앱 FSD 17번
  { file: 'chars.js', mod: 'charsMod', glob: 'TwChars', sample: 'function _charsSync(' },       // 앱 FSD 18번
  { file: 'slot-sync.js', mod: 'slotSyncMod', glob: 'TwSlotSync', sample: 'function _slotsSeenSet(' },   // 앱 FSD 19번
  { file: 'away-pic.js', mod: 'awayPicMod', glob: 'TwAwayPic', sample: 'function _awaySzOk(' },   // 앱 FSD 22번
  { file: 'myhome-ui.js', mod: 'myHomeUiMod', glob: 'TwMyHomeUi', sample: 'function renderMhProfileRail(' },   // 앱 FSD 22번
  { file: 'tricks.js', mod: 'tricksMod', glob: 'TwTricks', sample: 'function _eggCountCmd(' },   // 앱 FSD 25번
  { file: 'ride-bench.js', mod: 'rideBenchMod', glob: 'TwRideBench', sample: 'function _checkCircusBalance(' },   // 앱 FSD 30번
  { file: 'part-paint.js', mod: 'partPaintMod', glob: 'TwPartPaint', sample: 'function _wdPicSection(' },   // 앱 FSD 21번
  { file: 'focus-level.js', mod: 'focusLevelMod', glob: 'TwFocusLevel', sample: 'function _pushLevelIfChanged(' },   // 앱 FSD 26번
  { file: 'chat-ui.js', mod: 'chatUiMod', glob: 'TwChatUi', sample: 'function _chatFlySendGate(' },   // 앱 FSD 24번
  { file: 'license-gate.js', mod: 'licenseGateMod', glob: 'TwLicenseGate', sample: 'function _rcStore(' },   // 앱 FSD 31번
  { file: 'account.js', mod: 'accountMod', glob: 'TwAccount', sample: 'function getMyLoginEmail(' },   // 앱 FSD 23번
  { file: 'wardrobe.js', mod: 'wardrobeMod', glob: 'TwWardrobe', sample: 'function ensureWdPreview(' },   // 앱 FSD 29번
  { file: 'settings-panel.js', mod: 'settingsMod', glob: 'TwSettingsPanel', sample: 'function loadAdBannerSlides(' },   // 앱 FSD 27번
  { file: 'desktop-run.js', mod: 'desktopRunMod', glob: 'TwDesktopRun', sample: 'function showUpdateReadyBanner(' },   // 앱 FSD 32번
  { file: 'room-entry.js', mod: 'roomEntryMod', glob: 'TwRoomEntry', sample: 'function _roomServerNet(' },   // 앱 FSD 33번
  { file: 'overhead.js', mod: 'overheadMod', glob: 'TwOverhead', sample: 'function applyChipOrientation(' },   // 앱 FSD 34번
  { file: 'room-sync.js', mod: 'roomSyncMod', glob: 'TwRoomSync', sample: 'function _srvNow(' },   // 앱 FSD 35번
  { file: 'status-chip.js', mod: 'statusChipMod', glob: 'TwStatusChip', sample: 'function hexToRgba(' },   // 앱 FSD 36번
  { file: 'premium-assets.js', mod: 'premiumMod', glob: 'TwPremiumAssets', sample: 'function _wdLicenseDesks(' },   // 앱 FSD 37번
  { file: 'char-code.js', mod: 'charCodeMod', glob: 'TwCharCode', sample: 'function downloadBlob(' },   // 앱 FSD 38번
  { file: 'dice-games.js', mod: 'diceMod', glob: 'TwDiceGames', sample: 'function _diceSvg(' },   // 앱 FSD 39번
  { file: 'program-settings.js', mod: 'progSettingsMod', glob: 'TwProgramSettings', sample: 'function commitUserName(' },   // 앱 FSD 40번
  { file: 'chat-prefs.js', mod: 'chatPrefsMod', glob: 'TwChatPrefs', sample: 'function _clampChatOpacity(' },   // 앱 FSD 41번
  { file: 'rich-text.js', mod: 'richTextMod', glob: 'TwRichText', sample: 'function _mhImgSrcOk(' },   // 앱 FSD 42번
  { file: 'win-stack.js', mod: 'winStackMod', glob: 'TwWinStack', sample: 'function _winZOf(' },   // 앱 FSD 42번
  { file: 'sfx.js', mod: 'sfxMod', glob: 'TwSfx', sample: 'function _mkSndPool(' },   // 앱 FSD 42번
  { file: 'face-heal.js', mod: 'faceHealMod', glob: 'TwFaceHeal', sample: 'function _repairSkinCanvases(' },   // 앱 FSD 43번
  { file: 'slot-save.js', mod: 'slotSaveMod', glob: 'TwSlotSave', sample: 'function _slotImgToDataUrl(' },   // 앱 FSD 43번
  { file: 'interaction-desk.js', mod: 'iDeskMod', glob: 'TwInteractionDesk', sample: 'function _trickTurns(' },   // 앱 FSD 43번
  { file: 'ad-banner.js', mod: 'adBannerMod', glob: 'TwAdBanner', sample: 'function refreshAdBanner(' },   // 앱 FSD 43번
  { file: 'license-request.js', mod: 'licReqMod', glob: 'TwLicenseRequest', sample: 'function _showLicenseReqState(' },   // 앱 FSD 43번
  { file: 'fn-keys.js', mod: 'fnKeysMod', glob: 'TwFnKeys', sample: '(function bindHotkeys(){' },   // 앱 FSD 43번
  { file: 'hidden-seats.js', mod: 'hiddenSeatsMod', glob: 'TwHiddenSeats', sample: 'function _reportHiddenSave(' },   // 앱 FSD 43번
  { file: 'theme-ui.js', mod: 'themeUiMod', glob: 'TwThemeUi', sample: 'function _themeChildCss(' },   // 앱 FSD 44번
  { file: 'myhome-sticker-layout.js', mod: 'mhStLayoutMod', glob: 'TwMyHomeStickerLayout', sample: 'function _mhOpenStickerAnim(' },   // 앱 FSD 44번
  { file: 'myhome-diag.js', mod: 'mhDiagMod', glob: 'TwMyHomeDiag', sample: 'window.__mhClickDiag = function(){' },   // 앱 FSD 44번
  { file: 'myhome-state.js', mod: 'mhStateMod', glob: 'TwMyHomeState', sample: 'function _mhHomeFromServer(' },   // 모듈 순환 끊기 4 — visit 에서 공용 상태를
  { file: 'myhome-visit.js', mod: 'mhVisitMod', glob: 'TwMyHomeVisit', sample: 'async function openFriendHomeView(' },   // 앱 FSD 44번
  { file: 'exp-bar.js', mod: 'expBarMod', glob: 'TwExpBar', sample: 'function expTierClass(' },   // 앱 FSD 45번
  { file: 'focus-share.js', mod: 'focusShareMod', glob: 'TwFocusShare', sample: 'function _focusShowText(' },   // 앱 FSD 45번
  { file: 'focus-total.js', mod: 'focusTotalMod', glob: 'TwFocusTotal', sample: 'function _todayStr(' },   // 앱 FSD 45번
  { file: 'commission.js', mod: 'commissionMod', glob: 'TwCommission', sample: 'function resizeImgBlobTo(' },   // 앱 FSD 45번
  { file: 'code-crypto.js', mod: 'codeCryptoMod', glob: 'TwCodeCrypto', sample: 'function _b64(' },   // 앱 FSD 45번
  { file: 'add-friend.js', mod: 'addFriendMod', glob: 'TwAddFriend', sample: 'function drawFaceThumb(' },   // 앱 FSD 46번
  { file: 'floaters.js', mod: 'floatersMod', glob: 'TwFloaters', sample: 'function spriteChar(' },   // 앱 FSD 46번
  { file: 'roulette.js', mod: 'rouletteMod', glob: 'TwRoulette', sample: 'function _rollRoulette(' },   // 앱 FSD 46번
  { file: 'chat-lock.js', mod: 'chatLockMod', glob: 'TwChatLock', sample: 'function _chatRoomCode(' },   // 앱 FSD 46번
  { file: 'device-lost.js', mod: 'deviceLostMod', glob: 'TwDeviceLost', sample: 'function _onDeviceSessionLost(' },   // 앱 FSD 46번
  { file: 'demoji-palette.js', mod: 'demojiPalMod', glob: 'TwDemojiPalette', sample: 'function _buildDemojiPalette(' },   // 앱 FSD 46번
  { file: 'outside-close.js', mod: 'outsideCloseMod', glob: 'TwOutsideClose', sample: 'const OUTSIDE_CLOSE_OVERLAYS=[' },   // 앱 FSD 47번
  { file: 'launcher-chrome.js', mod: 'launcherChromeMod', glob: 'TwLauncherChrome', sample: '(function bindLauncherTitlebar(){' },   // 앱 FSD 47번
  { file: 'myhome-links.js', mod: 'mhLinksMod', glob: 'TwMyHomeLinks', sample: '(function bindMyHomeExternalLinks(){' },   // 앱 FSD 47번
  { file: 'async-prompt.js', mod: 'asyncPromptMod', glob: 'TwAsyncPrompt', sample: 'function asyncPrompt(' },   // 앱 FSD 47번
  { file: 'myhome-page.js', mod: 'mhPageMod', glob: 'TwMyHomePage', sample: 'function loadMyHomePage(' },   // 앱 FSD 47번
  { file: 'theme.js', mod: 'themeMod', glob: 'TwTheme', sample: 'function getTheme(' },   // 앱 FSD 48번
  { file: 'asset-code.js', mod: 'assetCodeMod', glob: 'TwAssetCode', sample: 'function encryptBytes(' },   // 앱 FSD 48번
  { file: 'license-key.js', mod: 'licenseKeyMod', glob: 'TwLicenseKey', sample: 'document.getElementById(\'licenseSubmitBt' },   // 앱 FSD 48번
  { file: 'license-ui.js', mod: 'licenseUiMod', glob: 'TwLicenseUi', sample: 'function refreshLicenseUI(' },   // 앱 FSD 48번
  { file: 'race-picker.js', mod: 'racePickerMod', glob: 'TwRacePicker', sample: 'function initRacePreview(' },   // 앱 FSD 48번
  { file: 'wardrobe-panel.js', mod: 'wdPanelMod', glob: 'TwWardrobePanel', sample: '(function bindWardrobe(){' },   // 앱 FSD 48번
  { file: 'lv-tier.js', mod: 'lvTierMod', glob: 'TwLvTier', sample: 'function lvTierNum(' },   // 앱 FSD 48번
  { file: 'myhome-init.js', mod: 'mhInitMod', glob: 'TwMyHomeInit', sample: 'function _warnOwnerWriteDenied(' },   // 앱 FSD 44번 남은 몫
];
const readPart = (name) => { for(const p of [name, 'parts/' + name, 'app/parts/' + name]){ try{ return fs.readFileSync(p, 'utf8'); }catch(_){} } return null; };
const esc = (s) => s.replace(/[$]/g, '\\$');
/* «이름(…)» 부름을 괄호 짝을 맞춰 찾아 «바꿀(인자글)» 로 — 인자에 괄호가 있어도(setX(Math.min(a, b))) 된다 */
function replaceCalls(text, name, make){
  const re = new RegExp('\\b' + name.replace(/[.$]/g, '\\$&') + '\\(', 'g');
  let out = '', last = 0, m;
  while((m = re.exec(text))){
    let d = 1, k = m.index + m[0].length;
    for(; k < text.length && d; k++){ const c = text[k]; if(c === '(') d++; else if(c === ')') d--; }
    if(d) break;
    out += text.slice(last, m.index) + make(text.slice(m.index + m[0].length, k - 1));
    last = k; re.lastIndex = k;
  }
  return out + text.slice(last);
}

function joinRenderer(app){
  if(typeof app !== 'string') return app;
  /* 옛 전역 이름 잇기 줄(«// 옛 전역 이름» 표지)은 먼저 지운다 — «mod.» 를 떼면 자기 자신을 부르는 함수가 된다(자리 계산 전에) */
  app = app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n');
  /* 다른 모듈 만드는 줄의 쓰는 함수가 옮긴 모듈의 쓰는 함수를 거치면(«setX: (v)=>{ mod.setX(v); },») 옛 모양 «x = v» 로 먼저 돌린다 —
     그래야 아래 ②에서 그 모듈 본문의 setX(…) 도 «x = …» 로 되살아난다 */
  const allSet = {};
  for(const m of MODULES){ const t = readPart(m.file); if(!t) continue; for(const x of t.matchAll(/^  ([\w$]+): \(v\)=>\{ ([\w$]+) = v; \},/gm)) allSet[m.mod + '.' + x[1]] = x[2]; }
  app = app.replace(/\(v\)=>\{ ([\w$]+\.[\w$]+)\(v\); \}/g, (all, key) => allSet[key] ? '(v)=>{ ' + allSet[key] + ' = v; }' : all);
  /* ① 모듈 글을 되살린다(deps 줄 빼기 · 읽는 함수 · 쓰는 함수) ② 그다음 app.js 와 모듈 글 모두에서 «mod.» 를 뗀다 —
     옮긴 모듈끼리 부르는 자리(예: 슬롯 동기화 → charsMod._chars…)도 옮기기 전 글로 돌아간다 */
  const parts = [];
  const retGet = [], retSet = [];
  for(const m of MODULES){
    const txt = readPart(m.file); if(!txt) continue;
    const i = app.indexOf('const ' + m.mod + ' = (typeof ' + m.glob);
    const j = i >= 0 ? app.indexOf('\n});', i) : -1;
    const glue = i >= 0 ? app.slice(i, j) : '';
    const getters = [...glue.matchAll(/^  ([\w$]+): \(\)=>(?:[\w$]+\.)?([\w$]+)(?:\(\))?,$/gm)].map(x => x[1]);   // 키 = 모듈 안 이름(오른쪽이 다른 모듈의 읽는 함수여도)
    const setters = [...glue.matchAll(/^  ([\w$]+): \(v\)=>\{ ([\w$]+) = v; \},$/gm)].map(x => [x[1], x[2]]);
    for(const x of txt.matchAll(/^  ([\w$]+): \(\)=>([\w$]+),/gm)) retGet.push([m.mod, x[1]]);
    for(const x of txt.matchAll(/^  ([\w$]+): \(v\)=>\{ ([\w$]+) = v; \},/gm)) retSet.push([m.mod, x[1], x[2]]);
    /* 껍데기(IIFE · createX(deps){ … return {…} })를 벗기고 본문만 — 옮긴 선언이 옛 자리처럼 꼭대기에 선다(함수를 돌려 보는 검사용) */
    const h = txt.match(/\nfunction create[\w$]*\(deps\)\{\n/);
    const r = txt.lastIndexOf('\nreturn {');
    let body = (h && r > h.index) ? txt.slice(h.index + h[0].length, r) : txt;
    body = body.replace(/^const [\w$]+ = deps\.[\w$]+;.*\n/gm, '').replace(/^const [\w$]+ = deps\.[\w$]+, [\w$]+ = deps\.[\w$]+;.*\n/gm, '');
    if(getters.length) body = body.replace(new RegExp('\\b(' + getters.map(esc).join('|') + ')\\(\\)', 'g'), '$1');
    for(const [set, name] of setters) body = replaceCalls(body, set, (arg) => name + ' = ' + arg);
    parts.push([m, i, j, body]);
  }
  /* 만드는 줄(«const mod = (typeof Tw… ({ … });») 자리에 본문을 그대로 끼운다 — 옛 본문 자리 그대로라 부팅 때 바로 읽는 줄도
     옛 차례대로 선언을 본다(뒤에서부터 끼워 앞 자리가 안 흔들리게). 만드는 줄을 못 찾으면 맨 끝에 잇는다. */
  let all = app, tail = [];
  for(const [m, i, j, body] of parts.slice().sort((a, b) => b[1] - a[1])){
    if(i >= 0 && j > i) all = all.slice(0, i) + body + all.slice(j + 4);   // '\n});' 까지
    else tail.push(body);
  }
  if(tail.length) all += '\n' + tail.join('\n');
  for(const [mod, n] of retGet) all = all.replace(new RegExp('\\b' + esc(mod) + '\\.' + esc(n) + '\\(\\)', 'g'), n);
  for(const [mod, set, name] of retSet) all = replaceCalls(all, mod + '.' + set, (arg) => name + ' = ' + arg);
  for(const m of MODULES) all = all.replace(new RegExp('\\b' + esc(m.mod) + '\\.', 'g'), '');
  return all;
}
module.exports = { joinRenderer, MODULES };

if(require.main === module){
  let pass = 0, fail = 0;
  const chk = (ok, msg) => { ok ? pass++ : fail++; console.log('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
  const app = readPart('app.js');
  if(!app){ console.log('  ? 원본 못 찾음 — app.js'); process.exit(2); }
  const J = joinRenderer(app);
  for(const m of MODULES){
    const txt = readPart(m.file);
    if(!txt){ console.log('  ? 원본 못 찾음 — ' + m.file); process.exit(2); }
    const code = J.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
    chk(!new RegExp('\\b' + esc(m.mod) + '\\.').test(code), m.file + ' — 부르는 자리의 «' + m.mod + '.» 가 안 남는다(주석 빼고)');
    chk(J.includes(m.sample), m.file + ' — 옛 선언(' + m.sample + '…)이 다시 보인다');
  }
  chk(!/^const [\w$]+ = deps\.[\w$]+;/m.test(J.slice(J.indexOf('\n', app.length - 200))), '되살린 모듈 글에 deps 받는 줄이 없다');
  chk(joinRenderer(undefined) === undefined, 'app.js 가 없으면 건드리지 않는다');
  console.log(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
}
