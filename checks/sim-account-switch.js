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
   ・3절: 신원을 놓은 뒤 beforeunload 의 syncFocusTotalToServer('quit') 가 임시 uid 를 만들어 올리지 않는다.
   ・4절: 플레이리스트 세 벌 복원 — fetchMyPlaylistSets(firebase-init) → _restoreOwnedDataAfterTransfer 가 세 벌을 앉힌다.
   ・5절: 춤 해금 안내 — 기록이 지워져도 수령함에 우편이 있으면 다시 안 보낸다(새 계정이면 보낸다).
   [실행] app.js · firebase-init.js 가 있는 폴더에서. 판정 줄은 맨 끝. */
'use strict';
const fs = require('fs');
const SRC = fs.readFileSync('app.js', 'utf8');
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
['MY_USER_ID_KEY','INVITE_PASS_KEY','MY_FRIEND_CODE_KEY','LOGIN_EMAIL_KEY','LOGIN_UID_KEY',   // (개정 56) MY_PREV_USER_IDS_KEY 걷음
 'MY_FRIEND_CODE_PREV_KEY','LICENSE_KEY_STORAGE','LICENSE_REQ_ID_KEY','FOCUS_TOTAL_KEY','FOCUS_TODAY_SEC_KEY',
 'FOCUS_TODAY_DATE_KEY','FOCUS_SYNCED_KEY','DANCE_NOTIFIED_KEY','DANCE_REPAIR_KEY','GACHA_OWNED_KEY','GACHA_TS_KEY',
 'GACHA_BONUS_KEY','CHAL_KEY','LS_KEY','SLOTS_TS_KEY',
 'SLOTS_SEEN_KEY','SLOTS_LOSS_KEY','SLOTS_LASTSYNC_KEY','SLOTS_PUSHFAIL_KEY',   // ★ 2026-09-22 개정 45 — 목록에 들어온 뒤(개정 30~31) 여기 없어 2절이 «?» 로 통째 안 돌았다
 'CUR_SLOT_KEY','SLOT_GLB_CACHE_KEY','EXTRA_SEAT_KEY',
 'USER_NAME_KEY','CUSTOM_STATUS_KEY','MY_AD_BANNER_KEY','BELL_SEEN_KEY','INBOX_BC_READ_KEY','BONK_DAY_KEY',
].forEach(n => { K[n] = constVal(n); });
const missingConst = Object.keys(K).filter(n => !K[n]);
if(missingConst.length) huh('상수 값을 못 읽음: ' + missingConst.join(' '));

/* ── 1. 목록 한 벌 ── */
say('── 1. ACCOUNT_LOCAL_KEYS — 제보의 다섯 자리 · 두 경로가 같은 함수');
const listSrc = (SRC.match(/const ACCOUNT_LOCAL_KEYS = \(\)=>\[([\s\S]*?)\n\];/) || [])[1] || '';
chk(!!listSrc, '★ ACCOUNT_LOCAL_KEYS 가 있다 (지움 목록은 코드 한 벌이어야 한다 — 주석으로 «같은 목록» 이면 또 새는 자리)');
const has = n => new RegExp('\\b' + n + '\\b').test(listSrc);
chk(has('LICENSE_KEY_STORAGE'), '① 라이선스 키 — 남으면 미보유자에게 프리미엄이 열린다');
chk(has('FOCUS_TOTAL_KEY') && has('FOCUS_SYNCED_KEY'), '③ 누적 시간 + 마크 — 남으면 max 바닥이 다음 계정 서버를 끌어올린다');
chk(has('GACHA_OWNED_KEY') && has('GACHA_TS_KEY') && has('GACHA_BONUS_KEY'), '④ 가챠 보유·시각·보너스');
chk(has('LS_KEY') && has('SLOTS_TS_KEY'), '② 캐릭터 슬롯 + ts — 남으면 슬롯 동기화가 다음 계정으로 push 한다');
chk(/'tw\.roomFaceUrls'/.test(listSrc) && has('SLOT_GLB_CACHE_KEY'), '  업로드 캐시 둘 — users/{uid}/ 경로라 다른 uid 가 물려받으면 남의 Storage 를 가리킨다');
chk(/'tw\.playlistSets'/.test(listSrc) && /'tw\.playlist'/.test(listSrc), '  플레이리스트 세 벌 + 옛 거울');
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
  const a = fOut.indexOf('_detachAccountLocal'), b = fOut.indexOf('authSignOut');
  chk(a >= 0 && b > a, '★ signOut 은 검문 **뒤** — 앞이면 세션 없는 push 가 거부돼 로그아웃이 늘 막힌다');
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
const tmo = (SRC.match(/const ACCT_FLUSH_TIMEOUT_MS = \d+;/) || [])[0];
if(!fList || !fPref || !fFlush || !fPre || !fWipe || !fDet || !tmo){
  huh('본문을 못 떼어 옴 — list:' + !!fList + ' flush:' + !!fFlush + ' pre:' + !!fPre + ' wipe:' + !!fWipe + ' det:' + !!fDet);
}else{
  function mkEnv(o){
    const env = Object.assign({
      ls: new Map(), calls: [], slotsTs: 123, srvGacha: { owned: { p1: 1 }, ts: 5 },
      total: 3600, mark: 3600, hasMark: true, localSlots: true, gacha: { p1: 1 },
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
      loadSlotsTs: async () => { env.calls.push('slotsTs'); return env.slotsTs; },
      loadGachaOwned: async () => { env.calls.push('gacha'); return env.srvGacha; },
      releaseDeviceSession: async () => { env.calls.push('release'); },
    } : null;
    const window = { firebaseAPI };
    const decl = Object.keys(K).map(n => 'const ' + n + " = '" + K[n] + "';").join('\n') + '\n' + [
      "const syncFocusTotalToServer=async(r)=>{ env.calls.push('flush:focus:'+r); env.mark = env.total; env.hasMark = true; };",
      "const syncGachaToServer=async(r)=>{ env.calls.push('flush:gacha:'+r); };",
      "const syncChalToServer=async(r)=>{ env.calls.push('flush:chal:'+r); };",
      "const syncSlotsToServer=async(r)=>{ env.calls.push('flush:slots:'+r); };",
      "let _slotsPushTimer = env.pushTimer || null; const clearTimeout=()=>{ env.calls.push('clearPushTimer'); };",
      "const setTimeout=(fn,ms)=>{ if(env.fastTimeout && typeof fn==='function') fn(); return 0; };",
      "const _slotsFilledCount=(raw)=>{ try{ const a=JSON.parse(raw||'null'); return Array.isArray(a)?a.filter(Boolean).length:0; }catch(_){ return 0; } };",
      "const _slotsHasLocal=()=>env.localSlots;",
      "const firebaseAPI = window.firebaseAPI;   /* 본문이 bare 이름으로도 부른다(releaseDeviceSession) */",
      "let gachaOwned = env.gacha; let _gachaTs = 9; let _gachaBonus = 2;",
      "let _focusTotalSec = env.total, _focusTodaySec = 100;",
      "const _hasFocusSyncedMark=()=>env.hasMark; const _getFocusSyncedMark=()=>env.mark;",
      "let chalRec = { ts: 1, days: [1] }, _chalDirty = true; const _chalBlank=()=>({ ts:0 });",
      "let _slotsTs = 7, extraSeatSlots = [1,2];",
      "let _plSets = [{name:'a',items:[{id:'x'}]}], _plCur = 1, _plBio = 'hi', _plHomePublic = true, _plPrivate = true, _plPubSig = 'sig';",
      "const _plBlankSets=()=>[{name:'',items:[]},{name:'',items:[]},{name:'',items:[]}];",
    ].join('\n');
    const body = [tmo, fList, fPref, fFlush, fPre, fWipe, fDet].join('\n');
    const f = new Function('env', 'localStorage', 'window', decl + '\n' + body +
      "\nreturn { detach:_detachAccountLocal, wipe:_wipeAccountLocal, keys:ACCOUNT_LOCAL_KEYS, mem:()=>({ total:_focusTotalSec, gacha:gachaOwned, gts:_gachaTs, bonus:_gachaBonus, chalDirty:_chalDirty, chalTs:chalRec.ts, slotsTs:_slotsTs, extra:extraSeatSlots, sets:_plSets, sig:_plPubSig, detached:_acctDetached }) };");
    env.m = f(env, localStorage, window);
    env.LS = localStorage;
    return env;
  }
  const fillA = e => {
    e.LS.setItem(K.MY_USER_ID_KEY, 'uA'); e.LS.setItem(K.LOGIN_EMAIL_KEY, 'a@x'); e.LS.setItem(K.INVITE_PASS_KEY, '1');
    e.LS.setItem(K.LICENSE_KEY_STORAGE, 'LIC-A'); e.LS.setItem(K.FOCUS_TOTAL_KEY, '3600'); e.LS.setItem(K.FOCUS_SYNCED_KEY, '3600');
    e.LS.setItem(K.GACHA_OWNED_KEY, '{"p1":1}'); e.LS.setItem(K.GACHA_TS_KEY, '9'); e.LS.setItem(K.LS_KEY, '[{"skin":1}]');
    e.LS.setItem(K.SLOTS_TS_KEY, '7'); e.LS.setItem('tw.roomFaceUrls', '{"face:h":"https://st/u/A"}'); e.LS.setItem('tw.playlistSets', '[]');
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
    chk(flushed === 'chal,focus,gacha,slots', '  지우기 **전에** 넷을 올렸다 (' + flushed + ')');
    chk(e.calls.indexOf('slotsTs') > e.calls.lastIndexOf('flush:slots:logout') , '  검문 읽기는 올린 뒤에 온다');
    const left = e.m.keys().filter(k => e.LS.getItem(k) !== null);
    chk(left.length === 0, '★ 목록의 키가 하나도 안 남았다' + (left.length ? ' — 남음: ' + left.join(' ') : ''));
    chk(e.LS.getItem('tw_chat_read:COZY-1') === null && e.LS.getItem('tw_chat_join:COZY-1') === null, '  방별 읽음·입장 표시(접두어 키)도 지웠다');
    chk(e.LS.getItem('tw.theme') === 'dark' && e.LS.getItem('tw.playlistVol') === '40' && e.LS.getItem('tw.savedParts') === '[]' && e.LS.getItem('tw.deskPresets') === '[]',
        '★ 테마·볼륨·카탈로그·프리셋은 남았다 (이 컴퓨터의 것)');
    const m = e.m.mem();
    chk(m.total === 0 && Object.keys(m.gacha).length === 0 && m.gts === 0 && m.bonus === 0, '★ 메모리도 비웠다 — 누적·가챠·시각·보너스 = 0');
    chk(m.chalDirty === false && m.chalTs === 0, '  달성표 dirty=false (beforeunload 의 _chalSave 가 지운 키를 도로 안 쓴다)');
    chk(m.slotsTs === 0 && m.extra.length === 0 && m.sig === null && m.sets.every(s => !s.items.length), '  슬롯 ts·추가 좌석·플레이리스트 지문 초기화');
    chk(m.detached === true, '  _acctDetached 가 섰다 (3절의 근거)');

    /* ② 슬롯 push 가 거부된 기기 — 아무것도 안 지운다 */
    say('· ② 캐릭터가 로컬에만 있다(서버 ts=0) — 로그아웃을 막고 아무것도 안 지운다');
    e = mkEnv({ slotsTs: 0 }); fillA(e);
    r = await e.m.detach();
    chk(r && r.ok === false && /캐릭터/.test(r.reason || ''), '★ ok:false + 이유가 캐릭터를 가리킨다 (' + (r && r.reason) + ')');
    chk(e.LS.getItem(K.MY_USER_ID_KEY) === 'uA' && e.LS.getItem(K.LICENSE_KEY_STORAGE) === 'LIC-A' && e.LS.getItem(K.LS_KEY) !== null, '★ 신원도 소지품도 그대로 (막힌 로그아웃은 삭제가 아니다)');
    chk(e.m.mem().total === 3600 && e.m.mem().detached === false, '  메모리도 그대로');

    /* ③ 읽기 실패 — 모르면 막는다 */
    say('· ③ 서버를 못 읽었다(null) — 막는다');
    e = mkEnv({ slotsTs: null }); fillA(e);
    r = await e.m.detach();
    chk(r && r.ok === false, '★ 읽기 실패도 «못 올렸다» 로 본다 — 네트워크 없는 순간에 지우지 않는다');
    e = mkEnv({ srvGacha: null }); fillA(e);
    r = await e.m.detach();
    chk(r && r.ok === false && /파츠/.test(r.reason || ''), '  가챠 읽기 실패도 막는다 (' + (r && r.reason) + ')');

    /* ④ 누적 시간이 안 올라갔다 */
    say('· ④ 누적 시간 미반영');
    /* 위 mkEnv 의 flush 스텁은 mark=total 로 맞추므로 정상 기기는 늘 통과한다.
       여기선 **마크를 안 옮기는 flush**(쓰기가 거부된 기기)로 바꿔 끼운다. */
    const g = new Function('env', 'localStorage', 'window',
      Object.keys(K).map(n => 'const ' + n + " = '" + K[n] + "';").join('\n') + '\n' +
      "const syncFocusTotalToServer=async()=>{}; const syncGachaToServer=async()=>{}; const syncChalToServer=async()=>{}; const syncSlotsToServer=async()=>{};\n" +
      "let _slotsPushTimer=null; const clearTimeout=()=>{}; const setTimeout=()=>0; const _slotsHasLocal=()=>false;\n" +
      "let gachaOwned={}; let _gachaTs=0; let _gachaBonus=0; let _focusTotalSec=env.total, _focusTodaySec=0;\n" +
      "const _hasFocusSyncedMark=()=>env.hasMark; const _getFocusSyncedMark=()=>env.mark;\n" +
      "let chalRec={ts:0}, _chalDirty=false; const _chalBlank=()=>({ts:0}); let _slotsTs=0, extraSeatSlots=[];\n" +
      "let _plSets=[], _plCur=0, _plBio='', _plHomePublic=false, _plPrivate=false, _plPubSig=null; const _plBlankSets=()=>[];\n" +
      [tmo, fList, fPref, fFlush, fPre, fWipe, fDet].join('\n') + "\nreturn _detachAccountLocal;");
    const lsOf = env => ({ getItem:k=>env.ls.has(k)?env.ls.get(k):null, setItem:(k,v)=>env.ls.set(k,String(v)), removeItem:k=>env.ls.delete(k), key:i=>Array.from(env.ls.keys())[i]||null, get length(){ return env.ls.size; } });
    let env4 = { ls: new Map([[K.MY_USER_ID_KEY, 'uA']]), total: 7200, mark: 3600, hasMark: true };
    r = await g(env4, lsOf(env4), { firebaseAPI: {} })();
    chk(r && r.ok === false && /누적 시간/.test(r.reason || ''), '★ 마크가 2분 넘게 뒤처지면 막는다 (' + (r && r.reason) + ')');
    env4 = { ls: new Map([[K.MY_USER_ID_KEY, 'uA']]), total: 7200, mark: 0, hasMark: false };
    r = await g(env4, lsOf(env4), { firebaseAPI: {} })();
    chk(r && r.ok === false, '  마크가 아예 없는데 누적이 있으면 막는다 (서버와 한 번도 안 맞춰봄)');
    env4 = { ls: new Map([[K.MY_USER_ID_KEY, 'uA']]), total: 7200, mark: 7150, hasMark: true };
    r = await g(env4, lsOf(env4), { firebaseAPI: {} })();
    chk(r && r.ok === true, '  50초 차이는 통과 (왕복 사이에 쌓인 폭)');

    /* ⑤ uid 가 없는 기기 — 검문 없이 그냥 지운다 */
    say('· ⑤ uid 없는 기기(이미 놓았거나 새 기기)');
    e = mkEnv({ slotsTs: 0 }); e.LS.setItem(K.LICENSE_KEY_STORAGE, 'LIC-?');
    r = await e.m.detach();
    chk(r && r.ok === true && e.calls.filter(c => c !== 'release').length === 0 && e.LS.getItem(K.LICENSE_KEY_STORAGE) === null, '  올릴 곳이 없으니 서버를 안 부르고 지운다(기기 세션 놓기만 — 내 것일 때만 지우는 호출이라 무해)');

    /* ⑥ 오프라인 — firebaseAPI 없음 */
    e = mkEnv({ apiOn: false }); fillA(e);
    r = await e.m.detach();
    chk(r && r.ok === false && /네트워크/.test(r.reason || ''), '  firebaseAPI 가 없으면 막는다 (' + (r && r.reason) + ')');

    /* ⑦ 대기 중인 슬롯 debounce push 를 먼저 흘린다 */
    e = mkEnv({ pushTimer: 42 }); fillA(e);
    await e.m.detach();
    chk(e.calls[0] === 'clearPushTimer' || e.calls.indexOf('clearPushTimer') >= 0, '  대기 중인 슬롯 push 타이머를 걷고 바로 올린다');

    /* ⑧ 🚪 [2026-09-20 · §2 제보 1] 출구 — 사유를 가르고, 전 항목을 세고, 강제 갈래는 부르는 쪽이 두 번째에만 연다 */
    say('· ⑧ 🚪 로그아웃 출구 — 사유 갈래 · 전 항목 · 강제');
    e = mkEnv({ slotsTs: null }); fillA(e);
    r = await e.m.detach();
    chk(r && r.kind === 'unknown' && /확인하지 못했어요/.test(r.reason || ''), '★ 읽기 실패(null)는 «확인하지 못했어요» — 「올리지 못했어요」와 다른 말이다(null 과 0 을 읽는 쪽에서 가른다)');
    e = mkEnv({ slotsTs: 0 }); fillA(e);
    r = await e.m.detach();
    chk(r && r.kind === 'denied' && /올리지 못했어요/.test(r.reason || ''), '★ 서버에 없음(0)은 «올리지 못했어요» (denied)');
    e = mkEnv({ slotsTs: 0, srvGacha: { owned: {} } }); fillA(e);
    e.LS.setItem(K.LS_KEY, '[{"skin":1},null,{"skin":2}]');
    r = await e.m.detach();
    chk(r && r.items && r.items.length === 2, '★ 첫 실패에서 끝내지 않고 **전 항목**을 센다 (' + (r && r.items ? r.items.length : 0) + '개)');
    chk(r && r.items && r.items[0].label === '캐릭터 2개' && /뽑은 파츠 1개/.test(r.items[1].label), '  항목에 **이름과 개수**가 있다 — «이 컴퓨터에만 있는 것: 캐릭터 2개 · 뽑은 파츠 1개» (' + (r && r.items ? r.items.map(i => i.label).join(' · ') : '') + ')');
    chk(e.LS.getItem(K.MY_USER_ID_KEY) === 'uA', '  여전히 아무것도 안 지웠다');
    e = mkEnv({ slotsTs: 0, fastTimeout: true }); fillA(e);
    r = await e.m.detach();
    chk(r && r.kind === 'timeout' && r.timedOut === true, '★ 8초 상한에 걸린 뒤의 «없다» 는 timeout — «아직 올리는 중» 이라고 말할 재료');
    e = mkEnv({ apiOn: false }); fillA(e);
    r = await e.m.detach();
    chk(r && r.kind === 'offline' && r.items && r.items.length >= 1 && /캐릭터/.test(r.items[0].label), '  오프라인이어도 «무엇이 사라지는지» 는 로컬에서 센다');
    /* 강제 */
    e = mkEnv({ slotsTs: 0 }); fillA(e);
    r = await e.m.detach({ force: true });
    chk(r && r.ok === true, '★ force 면 검문에 걸려도 지운다');
    chk(e.m.keys().filter(k => e.LS.getItem(k) !== null).length === 0 && e.m.mem().detached === true, '  강제로 지워도 목록 한 벌·메모리 전부 — 반쪽 로그아웃은 없다');
    chk(e.calls.indexOf('release') >= 0 && e.calls.indexOf('release') > e.calls.indexOf('slotsTs'), '  강제로 지운 뒤에도 기기 세션을 놓는다(releaseDeviceSession) — 안 놓으면 다음 사람이 «다른 기기에서 사용 중» 에 걸린다');
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

    part3(); part4(); part5(); done();
  })().catch(err => { huh('2절 실행 오류: ' + (err && err.stack || err)); part3(); part4(); part5(); done(); });
}

/* ── 3. 신원을 놓은 뒤 'quit' 동기화가 임시 uid 를 만들지 않는다 ── */
function part3(){
  say('── 3. syncFocusTotalToServer — 신원을 놓은 뒤에는 돌지 않는다');
  const f = grabFn(SRC, 'syncFocusTotalToServer', 'async function ');
  if(!f){ huh('syncFocusTotalToServer 를 못 찾음'); return; }
  const a = f.indexOf('if(typeof _acctDetached'), b = f.indexOf("typeof getMyUserId==='function'");
  chk(a > 0 && b > a, '★ _acctDetached 검사가 getMyUserId() **앞**에 있다 (뒤면 이미 임시 uid 가 발급된 뒤다)');
  chk(/window\.addEventListener\('beforeunload', \(\)=>\{ try\{ syncFocusTotalToServer\('quit'\)/.test(SRC), '  beforeunload 가 여전히 quit 동기화를 부른다 (이 경로가 있어서 3절이 필요하다)');
  /* 실제로 돌려본다 */
  try{
    const env = { minted: 0, calls: 0 };
    const run = new Function('env', 'window', 'localStorage',
      "const firebaseAPI = window.firebaseAPI; let _acctDetached = env.detached; let _focusSyncing=false; const FOCUS_LEVEL_CAP_HOURS=999; const FOCUS_TOTAL_CAP_SEC=999*3600; let _focusTotalSec=5000;\n" +
      "const getMyUserId=()=>{ env.minted++; return 'uTMP'; };\n" +
      "const _hasFocusSyncedMark=()=>false, _getFocusSyncedMark=()=>0, _setFocusSyncedMark=()=>{}, _focusSyncFailed=()=>{}, _pushLevelIfChanged=()=>{}, _notifyDanceUnlocks=()=>{}, getFocusLevel=()=>1;\n" +
      "let _focusSyncFailStreak=0, _focusLastSyncedVal=-1; const console={warn(){},log(){}};\n" +
      f + "\nreturn syncFocusTotalToServer;");
    const apiOf = (e) => ({ syncFocusTotal: async () => { e.calls++; return { ok:true, totalSec: 5000 }; } });
    (async () => {
      env.detached = true;
      await run(env, { firebaseAPI: apiOf(env) }, { getItem:()=>null, setItem(){} })('quit');
      chk(env.minted === 0 && env.calls === 0, '★ 놓은 뒤 quit: uid 발급 0 · 서버 호출 0');
      const env2 = { minted: 0, calls: 0, detached: false };
      await run(env2, { firebaseAPI: apiOf(env2) }, { getItem:()=>null, setItem(){} })('boot');
      chk(env2.minted === 1 && env2.calls === 1, '  평소(boot)는 예전 그대로 돈다 — sim-focus-sync.js 의 동작을 바꾸지 않았다');
    })();
  }catch(err){ huh('3절 실행 오류: ' + (err && err.message || err)); }
}

/* ── 4. 플레이리스트 세 벌 복원 ── */
function part4(){
  say('── 4. 플레이리스트 — 세 벌 전부 받아온다 (한 벌 무작위가 아니다)');
  const fSets = grabFn(FI, 'fetchMyPlaylistSets', 'async ');
  chk(!!fSets, '★ firebase-init 에 fetchMyPlaylistSets 가 있다');
  chk(fSets && /users\/\$\{uid\}\/playlist`/.test(fSets) && !/_plPickSet/.test(fSets), '  노드를 그대로 읽고 _plPickSet(무작위 한 벌)을 거치지 않는다');
  const fRestore = grabFn(SRC, '_restoreOwnedDataAfterTransfer', 'async function ') || '';
  chk(/fetchMyPlaylistSets/.test(fRestore), '★ _restoreOwnedDataAfterTransfer 가 fetchMyPlaylistSets 를 쓴다');
  chk(/_plNormalizeSets\(r\.sets\)/.test(fRestore), '  받은 세 벌이 부팅 로드와 같은 관문(_plNormalizeSets)을 지난다');
  chk(/fetchPlaylistOf/.test(fRestore), '  구버전 API(fetchMyPlaylistSets 없음)에서는 옛 길로 물러난다');
  if(!fSets) return;
  /* firebase-init 쪽 실행 — get/ref 스텁 */
  try{
    const node = { sets: { 0:{ name:'A', items:{ 0:{id:'v1',title:'one'} } }, 1:{ name:'', items:{} }, 2:{ name:'C', items:{ 0:{id:'v3',title:'three'}, 1:{id:'v4'} } } }, bio:'hey', homePublic:true, items:{ 0:{id:'v1'} } };
    const mk = (val) => new Function('get', 'ref', 'db', 'console', 'const o = {' + fSets + '}; return o.fetchMyPlaylistSets;')(async () => ({ val: () => val }), () => null, null, { warn(){} });
    (async () => {
      const r = await mk(node)('uB');
      chk(r && r.sets.length === 3 && r.sets[0].items[0].id === 'v1' && r.sets[2].items.length === 2 && r.sets[1].items.length === 0, '★ 세 벌 그대로 (0:1곡 · 1:빈 · 2:2곡)');
      chk(r.bio === 'hey' && r.homePublic === true, '  한마디·공개 여부도 실린다');
      const r2 = await mk({ items: { 0:{id:'old'} } })('uB');
      chk(r2 && r2.sets.length === 1 && r2.sets[0].items[0].id === 'old', '  sets 없는 옛 노드는 items 를 0번으로');
      chk((await mk(null)('uB')) === null, '  노드 없음 → null');
      /* app.js 쪽 실행 — 복원 함수 전체를 스텁 위에서 돌린다 */
      const fNorm = grabFn(SRC, '_plNormalizeSets'), fBlank = grabFn(SRC, '_plBlankSets'), fIdx = grabFn(SRC, '_plSetIdx'), fSig = grabFn(SRC, '_plPubSigOf');
      const env = { saved: 0, published: 0, gachaPull: 0, slotsPull: 0 };
      const run = new Function('env', 'window', 'firebaseAPI',
        "const PL_SETS=3, PL_MAX=20, PL_TITLE_MAX=16, PL_BIO_MAX=140; const console={warn(){}};\n" +
        "let _plSets=[{name:'옛',items:[{id:'z',url:'u',title:''}]},{name:'',items:[]},{name:'',items:[]}], _plCur=2, _plBio='', _plHomePublic=false, _plPrivate=false, _plPubSig=null, _plSel=0, _plNow=0, _plNowSet=0, _plView=null, _plNowView=null;\n" +
        "const _plMine=()=>_plSets[_plCur].items; const _plSave=()=>{ env.saved++; }; const _plPublish=()=>{ env.published++; }; const _plRender=()=>{};\n" +
        "const getMyUserId=()=>'uB'; const syncGachaToServer=async()=>{ env.gachaPull++; }; const syncSlotsToServer=async()=>{ env.slotsPull++; }; const _gachaInvOpen=()=>false;\n" +
        [fNorm, fBlank, fIdx, fSig, fRestore].join('\n') +
        "\nreturn async()=>{ await _restoreOwnedDataAfterTransfer(); return { sets:_plSets, cur:_plCur, bio:_plBio, pub:_plHomePublic, sig:_plPubSig }; };");
      const api = { fetchMyPlaylistSets: async () => ({ sets: r.sets, bio: r.bio, homePublic: r.homePublic }), fetchPlaylistOf: async () => { throw new Error('옛 길을 탔다'); } };
      const out = await run(env, { firebaseAPI: api }, api)();
      chk(out.sets.length === 3 && out.sets[0].name === 'A' && out.sets[0].items[0].url === 'https://www.youtube.com/watch?v=v1' && out.sets[2].items.length === 2, '★ 복원 뒤 로컬이 세 벌 다 서버 것 — 옛 프리셋이 안 남는다');
      chk(out.sets[1].items.length === 0, '  서버가 빈 벌은 로컬도 빈다 (이 기기 옛 목록으로 채우지 않는다)');
      chk(out.bio === 'hey' && out.pub === true && env.saved === 1, '  한마디·공개 여부 복원 + 저장 1회');
      chk(typeof out.sig === 'string' && env.published === 0, '  지문을 맞춰 두어 헛쓰기(_plPublish)가 안 나간다');
      chk(env.gachaPull === 1 && env.slotsPull === 1, '  가챠·슬롯 pull 은 그대로 이어서 돈다');
      /* 서버가 비었고 로컬에 곡이 있으면 올린다 */
      const env2 = { saved: 0, published: 0, gachaPull: 0, slotsPull: 0 };
      const api2 = { fetchMyPlaylistSets: async () => null };
      const out2 = await run(env2, { firebaseAPI: api2 }, api2)();
      chk(out2.sets[0].items[0].id === 'z' && env2.published === 1, '  저쪽이 비었으면 이 기기 목록을 올린다 (첫 업로드)');
    })();
  }catch(err){ huh('4절 실행 오류: ' + (err && err.message || err)); }
}

/* ── 5. 춤 해금 안내 — 수령함이 진짜다 ── */
function part5(){
  say('── 5. _danceUnlockPending — 기록이 없어도 수령함에 있으면 다시 안 보낸다');
  const f = grabFn(SRC, '_danceUnlockPending');
  if(!f){ huh('_danceUnlockPending 을 못 찾음'); return; }
  try{
    const run = new Function('env',
      "const DANCE_MOVES=[{cmd:'80',reqLevel:80},{cmd:'150',reqLevel:150}];\n" +
      "let _myInboxReady = env.ready; const _danceNotifiedSet=()=>new Set(env.done), _danceRepairSet=()=>new Set();\n" +
      "const _danceMailExists=(def)=>env.mail.has(def.cmd); const _markDanceNotified=(c)=>{ env.marked.push(c); };\n" +
      f + "\nreturn (lv)=>_danceUnlockPending(lv).map(d=>d.cmd);");
    let env = { ready: true, done: [], mail: new Set(['80']), marked: [] };
    let p = run(env)(200);
    chk(p.join(',') === '150' && env.marked.join(',') === '80', '★ 돌아온 계정: 우편 있는 80 은 건너뛰고 기록만 찍는다 · 150 은 보낸다');
    env = { ready: true, done: [], mail: new Set(), marked: [] };
    p = run(env)(200);
    chk(p.join(',') === '80,150', '  새 계정(우편 없음): 둘 다 보낸다 — 기록을 지운 덕에 안내가 간다');
    env = { ready: false, done: [], mail: new Set(['80']), marked: [] };
    p = run(env)(200);
    chk(p.join(',') === '80,150' && env.marked.length === 0, '  수령함이 아직 안 왔으면 예전처럼 보낸다 (못 받는 쪽이 더 나쁘다)');
    env = { ready: true, done: ['80'], mail: new Set(['80']), marked: [] };
    p = run(env)(100);
    chk(p.length === 0, '  기록 있고 우편 있고 — 평소처럼 안 보낸다');
  }catch(err){ huh('5절 실행 오류: ' + (err && err.message || err)); }
}

function done(){
  /* 3·4절의 비동기 조각이 끝나길 잠깐 기다린다 — 스텁 await 몇 개뿐이라 한 틱이면 된다 */
  setTimeout(() => {
    say('');
    say('sim-account-switch.js: ' + pass + ' 통과 · ' + fail + ' 실패' + (huhs ? ' · ' + huhs + ' 의문' : ''));
    process.exitCode = fail ? 1 : 0;
  }, 50);
}
