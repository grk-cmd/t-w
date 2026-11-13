/* ═══ 🧹 sim-account-switch.js — 같은 PC 계정 전환 시 소지품 정리 (제보 4 · 2026-09-16) ═══════════
   [무엇을 지키나] 로그아웃이 신원 6개만 지우고 소지품(라이선스·누적시간·가챠·슬롯·플레이리스트)을
     남겨서, 같은 노트북에서 A→B 로 로그인하면 B 에게 A 의 프리미엄이 열리고(①) A 의 캐릭터가
     B 프로필로 올라가고(②) B 레벨이 A 것으로 뛰고(③) A 가 뽑은 가챠가 B 계정에 실렸다(④).
   ・1절: 목록 한 벌 — ACCOUNT_LOCAL_KEYS 에 제보의 다섯 자리가 다 있고, 로그아웃·연동해제 둘 다 같은 함수를 쓴다.
   ・2절: app.js 본문을 떼어 와 돌린다 — 지운 뒤 남은 키 · 기기 설정은 남는다 · 메모리도 비운다 ·
          검문(서버에 못 올린 캐릭터·파츠·시간이 있으면 아무것도 안 지운다 · 읽기 실패도 막는다).
          ⑧ 🚪 **로그아웃 출구**(§2 제보 1 · 2026-09-20 추가) — 검문이 null(확인 못 함)과 0(거부)을 가르고,
            첫 실패에서 끝내지 않고 전 항목을 이름·개수로 세고, 8초 상한에 걸린 뒤의 «없다» 는 timeout 이고,
            force 면 검문에 걸려도 목록 한 벌·메모리 전부 지우고 기기 세션도 놓는다.
            부르는 쪽은 정적으로 — [그래도 로그아웃] 은 두 번째 실패에서만 열리고 바로 실행한다.
   ・4절: 플레이리스트 — 원본은 서버(playlist-api.js). firebase-init 에 옛 읽기가 없고, 로그인 때 서버 사본을 당겨 오던 옛 이어받기(_restoreOwnedDataAfterTransfer)는 0.13 에서 걷었다.
   ・(3절 · 5절은 걷었다 — 포커스 올리기는 계정 세션이 끝나면 아무것도 못 보내고(sim-focus-progress.js) 해금 안내 우편은 서버 알림이다)
   [실행] app.js · firebase-init.js 가 있는 폴더에서. 판정 줄은 맨 끝. */
'use strict';
const fs = require('fs');
/* 🎵 플레이리스트는 parts/status/playlist.js 로 옮겼다(앱 FSD 16번) — 렌더러 쪽 한 벌 = app.js + 그 파일.
   app.js(로그아웃 · 계정 이어받기)는 그 상태를 plMod.st(상태 묶음)로 읽고 쓴다 — 아래 스텁도 같은 모양(PL_ST)으로 흉내 낸다.
   ⚠️ 그 파일이 없으면 «못 찾음» 으로 멈춘다 — app.js 만 보고 빨개지거나 초록인 척하지 않게. */
const PL_FILE = ['playlist.js', 'parts/status/playlist.js', 'app/parts/status/playlist.js'].find(c => fs.existsSync(c));
if (!PL_FILE) { console.log('  ? 원본 못 찾음 — playlist.js'); process.exit(2); }
const { joinRenderer: _joinRenderer } = require('./sim-renderer-src.js');   // 앱 FSD 로 옮긴 모듈을 «옮기기 전 app.js 글» 로 되살려 읽는다
const SRC = _joinRenderer(fs.readFileSync('app.js', 'utf8')) + '\n' + fs.readFileSync(PL_FILE, 'utf8');
/* 상태 묶음 흉내 — 이름 쌍 [st 칸, 스텁의 let] 을 getter · setter 로 */
const PL_ST = pairs => '{ ' + pairs.map(([k, v]) => 'get ' + k + '(){ return ' + v + '; }, set ' + k + '(x){ ' + v + ' = x; }').join(', ') + ' }';
const PL_ST_ALL = PL_ST([['sets','_plSets'],['cur','_plCur'],['bio','_plBio'],['homePublic','_plHomePublic'],['private','_plPrivate'],['pubSig','_plPubSig'],
  ['sel','_plSel'],['now','_plNow'],['nowSet','_plNowSet'],['view','_plView'],['nowView','_plNowView']]);
const PL_ST_MEM = PL_ST([['sets','_plSets'],['cur','_plCur'],['bio','_plBio'],['homePublic','_plHomePublic'],['private','_plPrivate'],['pubSig','_plPubSig']]);
const FI  = fs.readFileSync('firebase-init.js', 'utf8');

let pass = 0, fail = 0, huhs = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const huh = (msg) => { huhs++; say('  ? ' + msg); };
function grabFn(src, name, kw){
  const i = src.indexOf((kw || 'function ') + name + '(');
  if(i < 0) return null;
  let k = src.indexOf('{', i), d = 0;
  for(; k < src.length; k++){
    if(src[k] === '{') d++;
    else if(src[k] === '}' && --d === 0) return src.slice(i, k + 1);
  }
  return null;
}
function grabBlock(src, from, to){
  const a = src.indexOf(from); if(a < 0) return null;
  const b = src.indexOf(to, a); if(b < 0) return null;
  return src.slice(a, b + to.length);
}
/* app.js 의 키 상수 값을 실제 선언에서 읽는다 — 여기 박아 두면 이름이 바뀔 때 검사가 조용히 낡는다. */
function constVal(name){
  const m = SRC.match(new RegExp('\\b' + name + '\\s*=\\s*\'([^\']+)\'')); return m ? m[1] : null;
}
const K = {};
['MY_USER_ID_KEY','MY_FRIEND_CODE_KEY','LOGIN_EMAIL_KEY','LOGIN_UID_KEY',   // (개정 56) MY_PREV_USER_IDS_KEY 걷음
 'MY_FRIEND_CODE_PREV_KEY','LICENSE_KEY_STORAGE','LICENSE_REQ_ID_KEY','FOCUS_TODAY_SEC_KEY',
 'FOCUS_TODAY_DATE_KEY',
 'CHAL_KEY','LICENSE_OPTOUT_KEY',   // (개정 238) 목록에 들어온 뒤 여기 없어 2절이 «?» 로 통째 안 돌았다
 'CUR_SLOT_KEY','EXTRA_SEAT_KEY',
 'USER_NAME_KEY','CUSTOM_STATUS_KEY','MY_AD_BANNER_KEY','BELL_SEEN_KEY','INBOX_BC_READ_KEY','BONK_DAY_KEY',
].forEach(n => { K[n] = constVal(n); });
const missingConst = Object.keys(K).filter(n => !K[n]);
if(missingConst.length) huh('상수 값을 못 읽음: ' + missingConst.join(' '));

/* ── 1. 목록 한 벌 ── */
say('── 1. ACCOUNT_LOCAL_KEYS — 제보의 다섯 자리 · 두 경로가 같은 함수');
const listSrc = (SRC.match(/const ACCOUNT_LOCAL_KEYS = \(\)=>\[([\s\S]*?)\n\];/) || [])[1] || '';
chk(!!listSrc, '★ ACCOUNT_LOCAL_KEYS 가 있다 (지움 목록은 코드 한 벌이어야 한다 — 주석으로 «같은 목록» 이면 또 새는 자리)');
const has = n => new RegExp('\\b' + n + '\\b').test(listSrc);
chk(!has('LICENSE_KEY_STORAGE') && !has('LICENSE_OPTOUT_KEY') && has('LICENSE_REQ_ID_KEY'), '① 라이선스 옛 키 · 해제 표시는 로그아웃이 지우지 않는다(첫 실행이 서버에 올린 뒤에야 지움 — 프리미엄은 서버 판정이라 남아도 열리지 않는다) · 요청 번호만 지운다');
chk(!has('FOCUS_TODAY_SEC_KEY') && !has('FOCUS_TODAY_DATE_KEY') && !/focusTotalSec|focusSyncedSec|focusPendingSec|starColor|danceNotified|ideskNotified|DANCE_NOTIFIED|DANCE_REPAIR/.test(listSrc), '③ 오늘치 · 못 올린 집중 시간은 계정별 칸(shared/account-store.js)이라 지움 목록에 없다 — 걷은 옛 키(누적 · 마크 · 별 색 · 해금 안내 기록)는 첫 실행이 지운다');
chk(!has('GACHA_OWNED_KEY') && !has('GACHA_TS_KEY') && !has('GACHA_BONUS_KEY') && !/tw\.gacha/.test(listSrc), '④ 가챠는 서버가 원본이라 이 PC 에 지울 값이 없다(지움 목록에 없다)');
chk(!has('LS_KEY') && !/deskFriends\./.test(listSrc), '② 캐릭터는 서버가 원본이라 이 PC 에 지울 슬롯 저장본·ts 가 없다(지움 목록에 없다)');
chk(/'tw\.roomFaceUrls'/.test(listSrc) && /'tw\.slotGlbUrls'/.test(listSrc), '  업로드 캐시 둘 — users/{uid}/ 경로라 다른 uid 가 물려받으면 남의 Storage 를 가리킨다');
chk(/'tw\.playlistSets'/.test(listSrc) && /'tw\.playlist'/.test(listSrc), '  플레이리스트 세 벌 + 옛 거울');
chk(/'tw\.playlistEditTs'/.test(listSrc) && /'tw\.playlistBackup'/.test(listSrc), '  플레이리스트 옛 고친 시각 · 백업 키 — 예전 판이 남긴 것도 로그아웃에서 지운다');
/* 개정 56 (회원가입 설계 §6-②) — «버린 uid» 목록을 걷었다. 목록에서 빠지고, 예전 판이 남긴 값은 부팅에 한 번 지운다. */
chk(!/MY_PREV_USER_IDS_KEY/.test(listSrc) && !/\bMY_PREV_USER_IDS_KEY\s*=/.test(SRC), '  «버린 uid» 목록은 걷었다 — 상수도 목록 항목도 없다 (개정 56)');
chk(/try\{ localStorage\.removeItem\('tw\.myPrevUserIds'\); \}catch\(_\)\{\}/.test(SRC), '  ↳ 예전 판이 남긴 tw.myPrevUserIds 는 부팅에 한 번 지운다');
chk(has('MY_FRIEND_CODE_PREV_KEY'), '  버린 코드 진단 기록 — 다음 사람에게는 남의 코드다');
chk(has('CHAL_KEY'), '  달성표');
chk(!/'tw\.theme'|'tw\.playlistVol'|SAVED_PARTS_KEY|PRESET_KEY/.test(listSrc), '  기기 설정·카탈로그·프리셋은 목록에 없다 (이 컴퓨터의 것)');
const fOut = grabFn(SRC, '_loginDoLogout', 'async function ') || '';
chk(/_detachAccountLocal\((opt)?\)/.test(fOut), '★ 로그아웃이 _detachAccountLocal 을 부른다 (§2 이후엔 opt 를 그대로 넘긴다)');
/* ★ 개정 45(회원가입 설계 개정 16) — 계정 연동 해제(acctUnlinkYes)를 걷었다. 신원을 놓는 입구는 로그아웃 하나다.
     옛 판정 셋(«해제도 같은 함수» · «해제 쪽 removeItem 없음» · «옛 주석 사라짐»)은 대상이 없어져 아래 둘로 바꿨다. */
chk(!/getElementById\('acctUnlinkYes'\)/.test(SRC), '★ 연동 해제 입구가 없다 (개정 45 — 로그인(H·K)이 기기 이동을 대신)');
{
  const callers = (SRC.match(/_detachAccountLocal\(/g) || []).length - (SRC.match(/function _detachAccountLocal\(/g) || []).length;
  chk(callers === 1 && /_detachAccountLocal\(opt\)/.test(fOut), '★ _detachAccountLocal 을 부르는 곳은 로그아웃 하나다 (' + callers + '곳) — 지움 목록이 두 벌이 될 입구가 없다');
}
{
  const a = fOut.indexOf('_detachAccountLocal'), b = fOut.indexOf('loginFlowMod.logout()');
  chk(a >= 0 && b > a, '★ 로그인 놓기(loginFlowMod.logout — realtime 끄기 · signOut)는 검문 **뒤** — 앞이면 세션 없는 push 가 거부돼 로그아웃이 늘 막힌다');
  chk(/if\(!r\.ok\) return r/.test(fOut), '  검문에 걸리면 signOut 도 안 한다 (세션도 로컬도 그대로)');
}

/* ── 2. 본문 실행 — 지움 · 남김 · 검문 ── */
say('── 2. _detachAccountLocal — 지운 뒤 남은 키 · 기기 설정 · 메모리 · 검문');
const fList = grabBlock(SRC, 'const ACCOUNT_LOCAL_KEYS = ()=>[', '\n];');
const fPref = grabBlock(SRC, "const ACCOUNT_LOCAL_KEY_PREFIXES = [", "];");
const fFlush = grabFn(SRC, '_acctFlushToServer', 'async function ');
const fPre = grabFn(SRC, '_acctPreflight', 'async function ');
const fWipe = /let _acctDetached = false;/.test(SRC) ? ('let _acctDetached = false;\n' + (grabFn(SRC, '_wipeAccountLocal') || '')) : null;
const fDet = grabFn(SRC, '_detachAccountLocal', 'async function ');
const tmo = [(SRC.match(/const ACCT_FLUSH_TIMEOUT_MS = \d+;/) || [])[0], (SRC.match(/const PRESENCE_OFF_WAIT_MS = \d+;/) || [])[0], grabFn(SRC, '_presenceOff')].every(Boolean)
  ? [(SRC.match(/const ACCT_FLUSH_TIMEOUT_MS = \d+;/) || [])[0], (SRC.match(/const PRESENCE_OFF_WAIT_MS = \d+;/) || [])[0], grabFn(SRC, '_presenceOff')].join('\n') : null;
if(!fList || !fPref || !fFlush || !fPre || !fWipe || !fDet || !tmo){
  huh('본문을 못 떼어 옴 — list:' + !!fList + ' flush:' + !!fFlush + ' pre:' + !!fPre + ' wipe:' + !!fWipe + ' det:' + !!fDet);
}else{
  function mkEnv(o){
    const env = Object.assign({
      ls: new Map(), calls: [], unsaved: 0,
      unsent: 0,
      apiOn: true,
    }, o || {});
    const localStorage = {
      getItem: k => env.ls.has(k) ? env.ls.get(k) : null,
      setItem: (k, v) => env.ls.set(k, String(v)),
      removeItem: k => env.ls.delete(k),
      key: i => Array.from(env.ls.keys())[i] || null,
      get length(){ return env.ls.size; },
    };
    const firebaseAPI = env.apiOn ? {
      releaseDeviceSession: async () => { env.calls.push('release'); },
      setMyPresenceState: (uid, on) => { env.calls.push('presence:' + uid + ':' + on); return env.presenceHang ? new Promise(() => {}) : Promise.resolve(); },
      deviceSessionLost: () => !!env.lost,
    } : null;
    const window = { firebaseAPI };
    const decl = Object.keys(K).map(n => 'const ' + n + " = '" + K[n] + "';").join('\n') + "\nconst ME_CACHE_KEY = 'tw.me';\n" + [
      "const sessionLost=()=>!!env.lost;   /* 다른 기기에 밀렸나 */",
      "const accountLegacyStore={ migrateLegacy:(c)=>{ env.calls.push('migrate:'+c); return {}; } };",
      "const flushFocus=async()=>{ env.calls.push('flush:focus:logout'); }; const unsentSec=()=>env.unsent;",
      "const gachaMod={ resetMemory(){ env.calls.push('gacha:reset'); } };",
      /* 👑 달성표는 weekly-challenge.js 모듈 — app.js 는 weeklyChal.syncChalToServer · resetMemory 로 부른다. 메모리 칸은 여기 let 이 대신한다 */
      "const weeklyChal={ syncChalToServer:async(r)=>{ env.calls.push('flush:chal:'+r); }, resetMemory(){ env.calls.push('chal:reset'); chalRec = _chalBlank(); _chalDirty = false; } };",
      /* 🧬 옷장은 closet.js 모듈 — 못 올린 고침만 올리고(flushSlots) 검문에서 센다(unsavedCount) · 로그아웃은 메모리를 비운다(resetCloset) */
      "const closetMod=()=>({ flushSlots:async()=>{ env.calls.push('flush:slots:logout'); }, waitFlush:async()=>{}, unsavedCount:()=>{ env.calls.push('unsaved'); return env.unsaved; }, resetCloset(){ env.calls.push('closet:reset'); } });",
      "const setTimeout=(fn,ms)=>{ if(env.fastTimeout && typeof fn==='function') fn(); return 0; };",
      "const firebaseAPI = window.firebaseAPI;   /* 본문이 bare 이름으로도 부른다(releaseDeviceSession) */",
      "let _focusTodaySec = 100; const setFocusTodaySec=(v)=>{ _focusTodaySec = v; };",
      "let chalRec = { ts: 1, days: [1] }, _chalDirty = true; const _chalBlank=()=>({ ts:0 });",
      "let extraSeatSlots = [1,2];",
      "let _plSets = [{name:'a',items:[{id:'x'}]}], _plCur = 1, _plBio = 'hi', _plHomePublic = true, _plPrivate = true, _plPubSig = 'sig';",
      /* 🎵 플레이리스트는 playlist.js 모듈(앱 FSD 16번) — app.js 는 plMod.st(상태 묶음) · plMod.blankSets 로 쓴다. 메모리 칸은 위 let 이 대신한다 */
      "const getMyUserId=()=>'ME01'; const plMod={ flushPending:async(u)=>{ env.calls.push('flush:pl:'+(u||'')); }, blankSets:()=>[{name:'',items:[]},{name:'',items:[]},{name:'',items:[]}], reset:()=>{ env.plReset = (env.plReset || 0) + 1; _plSets = [{name:'',items:[]},{name:'',items:[]},{name:'',items:[]}]; _plBio = ''; _plHomePublic = false; _plPrivate = false; _plPubSig = null; }, st:" + PL_ST_MEM + " };",
    ].join('\n');
    const body = [tmo, fList, fPref, fFlush, fPre, fWipe, env.det || fDet].join('\n');
    const f = new Function('env', 'localStorage', 'window', decl + '\n' + body +
      "\nreturn { detach:_detachAccountLocal, wipe:_wipeAccountLocal, keys:ACCOUNT_LOCAL_KEYS, mem:()=>({ today:_focusTodaySec, chalDirty:_chalDirty, chalTs:chalRec.ts, extra:extraSeatSlots, sets:_plSets, sig:_plPubSig, detached:_acctDetached }) };");
    env.m = f(env, localStorage, window);
    env.LS = localStorage;
    return env;
  }
  const fillA = e => {
    e.LS.setItem(K.MY_USER_ID_KEY, 'uA'); e.LS.setItem(K.LOGIN_EMAIL_KEY, 'a@x'); e.LS.setItem('tw.me', '{}');
    e.LS.setItem(K.LICENSE_KEY_STORAGE, 'LIC-A'); e.LS.setItem(K.FOCUS_TODAY_SEC_KEY, '60');
    e.LS.setItem('tw.slotGlbUrls', '{}'); e.LS.setItem('tw.roomFaceUrls', '{"face:h":"https://st/u/A"}'); e.LS.setItem('tw.playlistSets', '[]'); e.LS.setItem('tw.playlistEditTs', '9000');
    e.LS.setItem(K.MY_FRIEND_CODE_PREV_KEY, '["MATE-OLD1"]'); e.LS.setItem(K.CHAL_KEY, '{}'); e.LS.setItem(K.USER_NAME_KEY, 'A');
    e.LS.setItem('tw_chat_read:COZY-1', '5'); e.LS.setItem('tw_chat_join:COZY-1', '1');
    /* 기기 설정 — 남아야 한다 */
    e.LS.setItem('tw.theme', 'dark'); e.LS.setItem('tw.playlistVol', '40'); e.LS.setItem('tw.savedParts', '[]'); e.LS.setItem('tw.deskPresets', '[]');
  };

  (async () => {
    /* ① 정상 — 전부 올라간 상태에서 로그아웃 */
    say('· ① 서버에 다 올라간 기기 — 지운 뒤 소지품 0 · 기기 설정은 그대로');
    let e = mkEnv(); fillA(e);
    let r = await e.m.detach();
    chk(r && r.ok === true, '★ 검문 통과');
    const flushed = e.calls.filter(c => c.startsWith('flush:')).map(c => c.split(':')[1]).sort().join(',');
    chk(flushed === 'chal,focus,pl,slots', '  지우기 **전에** 넷(목록 포함)을 올렸다 — 가챠는 서버가 원본이라 올릴 것이 없다 (' + flushed + ')');
    chk(e.calls.indexOf('unsaved') > e.calls.lastIndexOf('flush:slots:logout') , '  검문(못 올린 고침 세기)은 올린 뒤에 온다');
    const left = e.m.keys().filter(k => e.LS.getItem(k) !== null);
    chk(left.length === 0, '★ 목록의 키가 하나도 안 남았다' + (left.length ? ' — 남음: ' + left.join(' ') : ''));
    chk(e.LS.getItem('tw_chat_read:COZY-1') === null && e.LS.getItem('tw_chat_join:COZY-1') === null, '  방별 읽음·입장 표시(접두어 키)도 지웠다');
    chk(e.LS.getItem('tw.theme') === 'dark' && e.LS.getItem('tw.playlistVol') === '40' && e.LS.getItem('tw.savedParts') === '[]' && e.LS.getItem('tw.deskPresets') === '[]',
        '★ 테마·볼륨·카탈로그·프리셋은 남았다 (이 컴퓨터의 것)');
    const m = e.m.mem();
    chk(m.today === 0 && e.calls.includes('gacha:reset'), '★ 메모리도 비웠다 — 오늘치 = 0 · 가챠는 gachaMod.resetMemory');
    chk(m.chalDirty === false && m.chalTs === 0 && e.calls.includes('chal:reset'), '  달성표 dirty=false (beforeunload 의 _chalSave 가 지운 키를 도로 안 쓴다 · weeklyChal.resetMemory)');
    chk(e.calls.includes('closet:reset') && m.extra.length === 0 && m.sig === null && m.sets.every(s => !s.items.length), '  옷장 메모리·추가 좌석·플레이리스트 지문 초기화');
    chk(e.plReset === 1 && e.LS.getItem('tw.playlistEditTs') === null, '  ☁️ 플레이리스트를 비우고 받기 전까지 안 올림(plMod.reset) · 옛 고친 시각 키도 지움');
    chk(m.detached === true, '  _acctDetached 가 섰다 (3절의 근거)');

    /* ② 슬롯 push 가 거부된 기기 — 아무것도 안 지운다 */
    say('· ② 서버에 못 올린 캐릭터 고침이 남았다 — 로그아웃을 막고 아무것도 안 지운다');
    e = mkEnv({ unsaved: 1 }); fillA(e);
    r = await e.m.detach();
    chk(r && r.ok === false && /캐릭터/.test(r.reason || ''), '★ ok:false + 이유가 캐릭터를 가리킨다 (' + (r && r.reason) + ')');
    chk(e.LS.getItem(K.MY_USER_ID_KEY) === 'uA' && e.LS.getItem(K.LICENSE_KEY_STORAGE) === 'LIC-A' && e.LS.getItem('tw.roomFaceUrls') !== null, '★ 신원도 소지품도 그대로 (막힌 로그아웃은 삭제가 아니다)');
    chk(e.m.mem().today === 100 && e.m.mem().detached === false, '  메모리도 그대로');

    /* ④ 누적 시간이 안 올라갔다 */
    say('· ④ 집중 시간 미반영');
    /* 위 mkEnv 의 flush 스텁은 올린 걸로 치므로 정상 기기는 늘 통과한다.
       여기선 **못 올린 몫이 남은 채**(쓰기가 거부된 기기)로 돌린다. */
    const g = new Function('env', 'localStorage', 'window',
      Object.keys(K).map(n => 'const ' + n + " = '" + K[n] + "';").join('\n') + '\n' +
      "const accountLegacyStore={ migrateLegacy:()=>({}) }; const sessionLost=()=>false; const ME_CACHE_KEY='tw.me';\n" +
      "const flushFocus=async()=>{}; const unsentSec=()=>env.unsent; const setFocusTodaySec=()=>{}; const gachaMod={ resetMemory(){} }; const weeklyChal={ syncChalToServer:async()=>{}, resetMemory(){} }; const closetMod=()=>({ flushSlots:async()=>{}, unsavedCount:()=>0, resetCloset(){} });\n" +
      "const clearTimeout=()=>{}; const setTimeout=()=>0;\n" +
      "let _focusTodaySec=0;\n" +
      "let chalRec={ts:0}, _chalDirty=false; const _chalBlank=()=>({ts:0}); let extraSeatSlots=[];\n" +
      "let _plSets=[], _plCur=0, _plBio='', _plHomePublic=false, _plPrivate=false, _plPubSig=null; const getMyUserId=()=>'ME01'; const plMod={ flushPending:async(u)=>{ env.calls.push('flush:pl:'+(u||'')); }, blankSets:()=>[], st:" + PL_ST_MEM + " };\n" +
      [tmo, fList, fPref, fFlush, fPre, fWipe, fDet].join('\n') + "\nreturn _detachAccountLocal;");
    const FB_MIN = { deviceSessionLost: () => false, setMyPresenceState: () => Promise.resolve() };   // 늘 있는 둘 — 검문 뒤 presence «꺼짐» 이 부른다
    const lsOf = env => ({ getItem:k=>env.ls.has(k)?env.ls.get(k):null, setItem:(k,v)=>env.ls.set(k,String(v)), removeItem:k=>env.ls.delete(k), key:i=>Array.from(env.ls.keys())[i]||null, get length(){ return env.ls.size; } });
    let env4 = { ls: new Map([[K.MY_USER_ID_KEY, 'uA']]), unsent: 3600 };
    r = await g(env4, lsOf(env4), { firebaseAPI: FB_MIN })();
    chk(r && r.ok === false && /집중 시간/.test(r.reason || ''), '★ 올리기 뒤에도 못 올린 몫이 2분을 넘으면 막는다 (' + (r && r.reason) + ')');
    env4 = { ls: new Map([[K.MY_USER_ID_KEY, 'uA']]), unsent: 121 };
    r = await g(env4, lsOf(env4), { firebaseAPI: FB_MIN })();
    chk(r && r.ok === false, '  경계 — 121초는 막는다');
    env4 = { ls: new Map([[K.MY_USER_ID_KEY, 'uA']]), unsent: 120 };
    r = await g(env4, lsOf(env4), { firebaseAPI: FB_MIN })();
    chk(r && r.ok === true, '  경계 — 120초는 통과 (왕복 사이에 쌓인 폭)');
    env4 = { ls: new Map([[K.MY_USER_ID_KEY, 'uA']]), unsent: 0 };
    r = await g(env4, lsOf(env4), { firebaseAPI: FB_MIN })();
    chk(r && r.ok === true, '  못 올린 몫이 없으면 통과');

    /* ⑤ uid 가 없는 기기 — 검문 없이 그냥 지운다 */
    say('· ⑤ uid 없는 기기(이미 놓았거나 새 기기)');
    e = mkEnv({ unsaved: 1 }); e.LS.setItem(K.LICENSE_REQ_ID_KEY, 'REQ-?');
    r = await e.m.detach();
    /* (개정 238) chal:reset 은 메모리 비우기 — 서버 호출이 아니다 */
    chk(r && r.ok === true && e.calls.filter(c => c !== 'release' && !/:reset$/.test(c)).length === 0 && e.LS.getItem(K.LICENSE_REQ_ID_KEY) === null, '  올릴 곳이 없으니 서버를 안 부르고 지운다(기기 세션 놓기만 — 내 것일 때만 지우는 호출이라 무해)');

    /* ⑥ 오프라인 — firebaseAPI 없음 */
    e = mkEnv({ apiOn: false }); fillA(e);
    r = await e.m.detach();
    chk(r && r.ok === false && /네트워크/.test(r.reason || ''), '  firebaseAPI 가 없으면 막는다 (' + (r && r.reason) + ')');

    /* ⑥-2 presence «꺼짐» — signOut 뒤에는 onDisconnect 가 돌지 않아 로그아웃한 사람이 접속중으로 남던 것 */
    say('· ⑥-2 로그아웃 전에 presence «꺼짐»');
    e = mkEnv(); fillA(e);
    await e.m.detach();
    const iP = e.calls.indexOf('presence:uA:false');
    chk(iP >= 0 && !e.calls.includes('release') && e.calls.indexOf('unsaved') < iP, '★ 검문을 지난 뒤 presence 를 «꺼짐» 으로 쓴다(로그인이 남아 있을 때) — 기기 세션은 realtime 이 정하므로 따로 놓지 않는다');
    e = mkEnv({ unsaved: 1 }); fillA(e);
    await e.m.detach();
    chk(!e.calls.some(c => c.startsWith('presence:')), '  막힌 로그아웃은 presence 를 안 건드린다');
    e = mkEnv({ lost: true }); fillA(e);
    await e.m.detach();
    chk(!e.calls.some(c => c.startsWith('presence:')), '★ 다른 기기에 밀려난 기기는 안 쓴다 — 그 칸은 이긴 쪽 것');
    e = mkEnv({ presenceHang: true, fastTimeout: true }); fillA(e);
    r = await e.m.detach();
    chk(r && r.ok === true && e.calls.includes('chal:reset'), '  쓰기가 끝나지 않아도(오프라인) 기다림 상한 뒤 로그아웃은 이어진다(지우기까지 간다)');
    e = mkEnv({ apiOn: false }); fillA(e);
    r = await e.m.detach({ force: true });
    chk(r && r.ok === true && e.LS.getItem(K.MY_USER_ID_KEY) === null, '  firebaseAPI 가 없는 강제 로그아웃도 «꺼짐» 쓰기에서 던지지 않고 지운다');
    const noOff = fDet.replace('if(uid) await _presenceOff(uid);', '');
    e = mkEnv({ det: noOff }); fillA(e);
    await e.m.detach();
    chk(noOff !== fDet && !e.calls.includes('presence:uA:false'), '  깨 보기 — «꺼짐» 쓰기를 빼면 위 ★ 가 빨강(그 판정이 이 줄을 본다)');

    /* ⑦ 대기 중인 캐릭터 고침(3초 묶음)은 로그아웃이 기다리지 않고 바로 올린다 */
    e = mkEnv({}); fillA(e);
    await e.m.detach();
    chk(e.calls.indexOf('flush:slots:logout') >= 0, '  로그아웃은 못 올린 캐릭터 고침을 묶음 시간을 기다리지 않고 바로 올린다(closet.flushSlots)');

    /* ⑧ 🚪 [2026-09-20 · §2 제보 1] 출구 — 사유를 가르고, 전 항목을 세고, 강제 갈래는 부르는 쪽이 두 번째에만 연다 */
    say('· ⑧ 🚪 로그아웃 출구 — 사유 갈래 · 전 항목 · 강제');
    e = mkEnv({ unsaved: 1 }); fillA(e);
    r = await e.m.detach();
    chk(r && r.kind === 'denied' && /올리지 못했어요/.test(r.reason || ''), '★ 못 올린 고침이 남았으면 «올리지 못했어요» (denied)');
    e = mkEnv({ unsaved: 2 }); fillA(e);
    r = await e.m.detach();
    chk(r && r.items && r.items.length === 1, '★ 걸린 항목을 이름과 개수로 말한다 — 캐릭터 하나 묶음 (' + (r && r.items ? r.items.length : 0) + '개)');
    chk(r && r.items && r.items[0].label === '캐릭터 2개', '  항목에 **이름과 개수**가 있다 — «서버에 못 올린 것: 캐릭터 2개» (' + (r && r.items ? r.items.map(i => i.label).join(' · ') : '') + ')');
    chk(e.LS.getItem(K.MY_USER_ID_KEY) === 'uA', '  여전히 아무것도 안 지웠다');
    e = mkEnv({ unsaved: 1, fastTimeout: true }); fillA(e);
    r = await e.m.detach();
    chk(r && r.kind === 'timeout' && r.timedOut === true, '★ 8초 상한에 걸린 뒤의 «없다» 는 timeout — «아직 올리는 중» 이라고 말할 재료');
    e = mkEnv({ apiOn: false, unsaved: 1 }); fillA(e);
    r = await e.m.detach();
    chk(r && r.kind === 'offline' && r.items && r.items.length >= 1 && /캐릭터/.test(r.items[0].label), '  오프라인이어도 «무엇이 사라지는지» 는 옷장이 센다(못 올린 고침 수)');
    /* 강제 */
    e = mkEnv({ unsaved: 1 }); fillA(e);
    r = await e.m.detach({ force: true });
    chk(r && r.ok === true, '★ force 면 검문에 걸려도 지운다');
    chk(e.m.keys().filter(k => e.LS.getItem(k) !== null).length === 0 && e.m.mem().detached === true, '  강제로 지워도 목록 한 벌·메모리 전부 — 반쪽 로그아웃은 없다');
    chk(e.calls.indexOf('unsaved') >= 0 && !e.calls.includes('release'), '  강제로 지울 때도 검문(unsaved)은 한 번 해 본다 — 기기 세션은 realtime 이 정하므로 따로 놓지 않는다');
    chk(e.calls.filter(c => c.startsWith('flush:')).length === 4, '  강제여도 올리기는 한 번 더 해 본다(공짜다)');
    /* 부르는 쪽 — 정적 */
    const uiBlk = grabBlock(SRC, "let _logoutFails = 0;", "if(forceBtn) forceBtn.onclick") || '';
    chk(!!uiBlk && /_logoutFails >= 2\) showForce\(true\)/.test(uiBlk), '★ [그래도 로그아웃] 은 **두 번째 실패에서만** 열린다 — 첫 실패엔 «다시 시도» 뿐');
    chk(/runLogout\(forceBtn, true\)/.test(uiBlk + 'if(forceBtn) forceBtn.onclick = () => runLogout(forceBtn, true);') && /_loginDoLogout\(force \? \{ force:true \}/.test(uiBlk), '  강제 버튼은 바로 실행한다(확인 한 번 더 없음 — 버튼 자체가 두 번째에만 나온다)');
    chk(/kind === 'timeout'/.test(uiBlk) && /kind === 'unknown'/.test(uiBlk) && /kind === 'offline'/.test(uiBlk), '  타임아웃·확인 못 함·오프라인·거부가 **다른 문구**다');
    chk(/resetLogoutBox\(\)/.test(uiBlk) && /lBtn\.onclick[\s\S]{0,80}resetLogoutBox\(\)/.test(uiBlk), '  확인 상자를 열 때마다 횟수·버튼·강제를 처음으로 되돌린다');
    let html = ''; try{ html = require('fs').readFileSync('desk-companion-prototype.html', 'utf8'); }catch(_){}
    if(html) chk(/id="acctLogoutForce"[^>]*display:none/.test(html), '  마크업의 [그래도 로그아웃] 은 처음엔 숨겨져 있다(app.js 만 연다)');
    else huh('desk-companion-prototype.html 없음 — 마크업 검사 생략');

    part4(); done();
  })().catch(err => { huh('2절 실행 오류: ' + (err && err.stack || err)); part4(); done(); });
}

/* ── 4. 플레이리스트 세 벌 복원 ── */
function part4(){
  say('── 4. 플레이리스트 — 옛 읽기 · 옛 이어받기가 없다');
  chk(!/fetchMyPlaylistSets|fetchPlaylistOf|_plPickSet/.test(FI), '★ firebase-init 에 옛 플레이리스트 읽기(한 벌 무작위 · 내 세 벌)가 없다 — 서버 길(playlist-api.js)로 옮겼다');
  chk(!/function _restoreOwnedDataAfterTransfer\(/.test(SRC), '  로그인 때 서버 사본을 당겨 오던 옛 이어받기(_restoreOwnedDataAfterTransfer)는 0.13 에서 걷었다 — 서버에서 받는 길(plMod.pull)이 맡는다');
}

function done(){
  /* 4절의 비동기 조각이 끝나길 잠깐 기다린다 — 스텁 await 몇 개뿐이라 한 틱이면 된다 */
  setTimeout(() => {
    say('');
    say('sim-account-switch.js: ' + pass + ' 통과 · ' + fail + ' 실패' + (huhs ? ' · ' + huhs + ' 의문' : ''));
    process.exitCode = fail ? 1 : 0;
  }, 50);
}
