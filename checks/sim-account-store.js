/* sim-account-store.js — 🗂️ 계정별 로컬 칸(shared/account-store.js) 검사 (#582)
   ・1절: 키 표 — 기기 공용 / 계정별이 겹치지 않음 · 옮긴 키는 계정별 표 안 · 접두사
   ・2절: 칸 — 계정 A / B 가 안 섞임 · 계정이 바뀌면 같은 코드로 다른 칸 · 지우기도 제 칸만
   ・3절: 로그인 전(코드 없음 · 모양 밖) — 읽기 null · 쓰기 false · 저장소에 아무것도 안 씀
   ・4절: 기기 공용 키 · 모르는 키는 던진다(계정과 무관 — 계정 칸에 안 들어간다)
   ・5절: migrateLegacy — 한 번만 · 이미 있는 값 안 덮음 · 코드 없으면 PC 칸 그대로 · 못 쓰면 옛 칸 보존 · 나중에 더해진 키만 새로
   ・6절: 옮겨 쓰는 모듈 — 포커스 누적(focus-total.js 실물)이 계정마다 따로 · 바탕화면 · 포커스 레벨은 PC 칸을 더는 직접 안 읽음
   ・7절: 배선 — app.js 가 getMyUserId 로 만든다 · html 차례 · smoke PRELOAD
   ・8절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find((v) => v != null);
const at = (f, dir) => [f, 'parts/' + dir + '/' + f, 'app/parts/' + dir + '/' + f];
const SRC0 = {
  STORE: pick(at('account-store.js', 'shared')),
  TOTAL: pick(at('focus-total.js', 'focus')),
  LEVEL: pick(at('focus-level.js', 'focus')),
  MHD: pick(at('myhome-desktop.js', 'myhome')),
  BOOT: pick(at('myhome-desktop-boot.js', 'myhome')),
  APP: pick(['app.js', 'parts/app.js', 'app/parts/app.js']),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
  SMOKE: pick(['smoke.js']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }

const mem = () => {
  const o = {};
  return { o, getItem: (k) => (k in o ? o[k] : null), setItem: (k, v) => { o[k] = String(v); }, removeItem: (k) => { delete o[k]; } };
};
const A = 'uaaaaaaaa1', B = 'ubbbbbbbb2';
const load = (src) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w.TwAccountStore; };

function judge(S){
  let M = null;
  try{ M = load(S.STORE); }catch(e){ chk(false, '싣다 던짐 — ' + e.message); return; }
  if(!M || typeof M.createAccountStore !== 'function'){ chk(false, 'window.TwAccountStore.createAccountStore 가 없다'); return; }
  const mk = (st, codeRef) => M.createAccountStore({ storage: st, getAccountCode: () => codeRef.v });

  say('── 1. 키 표');
  {
    const dup = M.ACCOUNT_KEYS.filter((k) => M.DEVICE_KEYS.includes(k));
    chk(!dup.length, '기기 공용 표와 계정별 표가 겹치지 않는다' + (dup.length ? ' — ' + dup.join(' · ') : ''));
    chk(new Set(M.ACCOUNT_KEYS).size === M.ACCOUNT_KEYS.length && new Set(M.DEVICE_KEYS).size === M.DEVICE_KEYS.length, '표 안에 같은 이름이 두 번 없다');
    chk(M.MOVED_KEYS.every((k) => M.ACCOUNT_KEYS.includes(k)), '옮긴 키(MOVED_KEYS)는 모두 계정별 표 안에 있다');
    const bad = M.ACCOUNT_KEYS.concat(M.DEVICE_KEYS).filter((k) => !/^(tw[._]|deskFriends\.)/.test(k));
    chk(!bad.length, '이름이 tw. / tw_ / 옛 deskFriends. 로 시작한다' + (bad.length ? ' — ' + bad.join(' · ') : ''));
    chk(['tw.focusTotalSec', 'tw.focusTodaySec', 'tw.focusTodayDate', 'tw.focusSyncedSec', 'tw.advZ.v2'].every((k) => M.MOVED_KEYS.includes(k)), '#582 의 포커스 누적 · 바탕화면 키가 옮긴 표에 있다');
    chk(M.DEVICE_KEYS.includes('tw.deviceId') && M.DEVICE_KEYS.includes('tw.myUserId'), '기기 id · 계정 코드 자리는 기기 공용(계정 칸에 둘 수 없다)');
  }

  say('── 2. 계정 A / B 칸');
  {
    const st = mem(), code = { v: A }, s = mk(st, code);
    chk(s.set('tw.focusTotalSec', 100) === true && s.get('tw.focusTotalSec') === '100', 'A 로 쓰면 A 로 읽힌다(글자로 돌려준다)');
    chk('tw.u.' + A + '.focusTotalSec' in st.o, '칸 이름은 tw.u.<계정코드>.<이름> — 앞 tw. 는 뗀다');
    code.v = B;
    chk(s.get('tw.focusTotalSec') === null, '★ 계정을 B 로 바꾸면 A 의 값이 안 보인다');
    s.set('tw.focusTotalSec', 7);
    code.v = A;
    chk(s.get('tw.focusTotalSec') === '100', '★ B 가 써도 A 의 값은 그대로(코드는 부를 때마다 읽는다)');
    s.remove('tw.focusTotalSec'); code.v = B;
    chk(s.get('tw.focusTotalSec') === '7', 'A 칸을 지워도 B 칸은 그대로');
    chk(Object.keys(st.o).every((k) => k.startsWith('tw.u.')), 'PC 공용 칸(계정 코드 없는 이름)에는 아무것도 안 썼다');
    s.set('tw.mhRecentColors.fore', '["#fff"]');
    chk(s.get('tw.mhRecentColors.fore') === '["#fff"]', '접두사 키(tw.mhRecentColors.<종류>)도 쓴다');
  }

  say('── 3. 로그인 전');
  for(const [what, v] of [['코드 null', null], ['빈 글', ''], ['모양 밖(점 · 슬래시)', 'u1/../x.y'], ['모양 밖(너무 짧음)', 'u12'], ['글자 아님', 123]]){
    const st = mem(), s = mk(st, { v });
    const r = [s.get('tw.focusTotalSec'), s.set('tw.focusTotalSec', 5), s.remove('tw.focusTotalSec')];
    chk(r[0] === null && r[1] === false && r[2] === false && !Object.keys(st.o).length, what + ' — 읽기 null · 쓰기 false · 지우기 false · 저장소 0건');
  }

  say('── 4. 기기 공용 · 모르는 키');
  {
    const s = mk(mem(), { v: A });
    for(const k of ['tw.deviceId', 'tw.myUserId', 'tw.renderQuality', 'tw.noSuchKey', 'x', '', null]){
      let threw = false; try{ s.get(k); }catch(_){ threw = true; }
      let threw2 = false; try{ s.set(k, 1); }catch(_){ threw2 = true; }
      chk(threw && threw2, '던진다(조용히 안 넘어간다) — ' + String(k));
    }
    let threw = false; try{ s.get('tw.mhRecentColors.'); }catch(_){ threw = true; }
    chk(threw, '접두사만 있는 이름은 키가 아니다');
  }

  say('── 5. migrateLegacy');
  {
    const st = mem(); const code = { v: null }; const s = mk(st, code);
    st.o['tw.focusTotalSec'] = '5000'; st.o['tw.advZ.v2'] = '{"x":1}'; st.o['tw.deviceId'] = 'dev-12345678'; st.o['tw.chal'] = '{"keep":1}';
    const r0 = s.migrateLegacy(null);
    chk(r0.skipped === 'no-code' && st.o['tw.focusTotalSec'] === '5000' && !(MIG(M) in st.o), '코드 없음 — 아무것도 안 하고 PC 칸 그대로(표시도 안 남김)');
    const r1 = s.migrateLegacy(A);
    chk(r1.moved.includes('tw.focusTotalSec') && r1.moved.includes('tw.advZ.v2'), '그 계정으로 옮긴다');
    code.v = A;
    chk(s.get('tw.focusTotalSec') === '5000' && s.get('tw.advZ.v2') === '{"x":1}', '옮긴 값을 계정 칸에서 읽는다');
    chk(!('tw.focusTotalSec' in st.o) && !('tw.advZ.v2' in st.o), 'PC 칸에서는 지운다(다음 계정이 주워 가지 못하게)');
    chk(st.o['tw.deviceId'] === 'dev-12345678', '기기 공용 값은 건드리지 않는다');
    chk(st.o['tw.chal'] === '{"keep":1}', '아직 옮기지 않은 계정별 키(MOVED_KEYS 밖)는 PC 칸에 그대로 — 옛 모듈이 아직 읽는다');
    st.o['tw.focusTotalSec'] = '9999';   // 두 번째 계정이 같은 PC 칸을 다시 채웠다고 치고
    const r2 = s.migrateLegacy(B);
    chk(r2.skipped === 'already' && st.o['tw.focusTotalSec'] === '9999' && !('tw.u.' + B + '.focusTotalSec' in st.o), '★ 두 번 돌지 않는다 — 두 번째 계정에는 안 옮겨진다');
  }
  {
    const st = mem(); const s = mk(st, { v: A });
    st.o['tw.focusTotalSec'] = '1'; st.o['tw.u.' + A + '.focusTotalSec'] = '777';
    const r = s.migrateLegacy(A);
    chk(st.o['tw.u.' + A + '.focusTotalSec'] === '777' && r.kept.includes('tw.focusTotalSec') && !r.moved.includes('tw.focusTotalSec'), '★ 계정 칸에 이미 값이 있으면 덮지 않는다');
    chk(!('tw.focusTotalSec' in st.o), '  ↳ 안 덮은 PC 값도 치운다(남기면 다른 계정이 주워 간다)');
  }
  {
    const st = mem(); const real = st.setItem; st.o['tw.focusTotalSec'] = '42';
    st.setItem = (k, v) => { if(k.startsWith('tw.u.')) throw new Error('quota'); real(k, v); };
    const s = mk(st, { v: A });
    s.migrateLegacy(A);
    chk(st.o['tw.focusTotalSec'] === '42', '★ 계정 칸에 못 쓰면 옛 칸을 지우지 않는다');
    st.setItem = real;
    const r = s.migrateLegacy(A);
    chk(r.moved.includes('tw.focusTotalSec'), '  ↳ 다음에 다시 시도해 옮긴다(처리함에 올리지 않았다)');
  }
  {
    const st = mem(); const s = mk(st, { v: A });
    st.o[MIG(M)] = JSON.stringify(M.MOVED_KEYS.filter((k) => k !== 'tw.advZ.v2'));   // 나중 판이 키를 더한 경우
    st.o['tw.focusTotalSec'] = '1'; st.o['tw.advZ.v2'] = '{"a":1}';
    const r = s.migrateLegacy(A);
    chk(r.moved.length === 1 && r.moved[0] === 'tw.advZ.v2' && st.o['tw.focusTotalSec'] === '1', '이미 처리한 키는 건드리지 않고 새로 더해진 키만 옮긴다');
    st.o[MIG(M)] = '깨진 글'; st.o['tw.focusTotalSec'] = '3';
    chk(mk(st, { v: B }).migrateLegacy(B).moved.length >= 1, '처리함 표시가 깨졌으면 처음부터(값을 잃지 않는 쪽)');
  }

  say('── 6. 옮겨 쓰는 모듈');
  {
    // 실물 focus-total.js — 계정마다 다른 누적
    const st = mem(); const code = { v: A }; const store = mk(st, code);
    const totalApi = (() => { const w = {}; new Function('window', 'module', 'localStorage', S.TOTAL)(w, undefined, null); return w.TwFocusTotal; })();
    const fresh = () => totalApi.createFocusTotal({ focusTotalStore: store });
    const a1 = fresh();
    chk(a1._loadFocusTotalSec() === 0, '새 계정 A 는 0 에서 시작');
    store.set(a1.FOCUS_TOTAL_KEY, 3600); store.set(a1.FOCUS_TODAY_DATE_KEY, a1._focusDayStr()); store.set(a1.FOCUS_TODAY_SEC_KEY, 60);
    chk(fresh()._loadFocusTotalSec() === 3600 && fresh()._focusTodaySec() === 60, 'A 의 누적 · 오늘치를 다시 켜면 읽는다');
    code.v = B;
    chk(fresh()._loadFocusTotalSec() === 0 && fresh()._focusTodaySec() === 0, '★ 같은 PC 에서 B 로 바꾸면 A 의 누적 · 오늘치가 안 넘어온다');
    code.v = null;
    chk(fresh()._loadFocusTotalSec() === 0, '로그인 전에는 0(PC 공용 칸을 안 읽는다)');
    chk(!Object.keys(st.o).some((k) => !k.startsWith('tw.u.')), 'focus-total 은 PC 공용 칸에 아무것도 안 썼다');
    code.v = A; a1._rolloverFocusToday();
    chk(Object.keys(st.o).every((k) => k.startsWith('tw.u.' + A + '.')), '날짜 넘김 정리도 A 칸에만 쓴다');
  }
  {
    const raw = (src, keys) => keys.filter((k) => new RegExp('localStorage\\.(?:get|set|remove)Item\\(\\s*' + k + '\\b').test(src));
    chk(!raw(S.TOTAL, ['FOCUS_TOTAL_KEY', 'FOCUS_TODAY_SEC_KEY', 'FOCUS_TODAY_DATE_KEY']).length, 'focus-total.js 는 누적 세 칸을 localStorage 로 직접 안 만진다');
    chk(!raw(S.LEVEL, ['FOCUS_TOTAL_KEY', 'FOCUS_TODAY_SEC_KEY', 'FOCUS_TODAY_DATE_KEY', 'FOCUS_SYNCED_KEY']).length, 'focus-level.js 는 누적 · 마크를 localStorage 로 직접 안 만진다');
    chk(!raw(S.MHD, ['ADV_KEY', 'ADV_KEY_V1']).length && /advStore\.set\(ADV_KEY/.test(S.MHD) && /advStore\.get\(ADV_KEY\)/.test(S.MHD), 'myhome-desktop.js 는 바탕화면 저장을 계정 칸으로만 한다');
    chk(/const advStore = deps\.advStore;/.test(S.MHD) && !/accountStoreMod/.test(S.MHD.replace(/\/\*[\s\S]*?\*\//g, '')), 'myhome-desktop.js 는 계정 칸을 deps 로 받는다(전역 이름 accountStoreMod 를 읽지 않는다)');
    chk(/createMyHomeDesktop\(\{ advStore: accountStoreMod \}\)/.test(S.BOOT), '만드는 줄(myhome-desktop-boot.js)이 계정 칸을 넘긴다');
    const iD = S.HTML.indexOf('parts/myhome/myhome-desktop.js'), iB = S.HTML.indexOf('parts/myhome/myhome-desktop-boot.js');
    chk(iD > 0 && iB > iD && S.HTML.slice(iD, iB).split('<script').length === 2, 'html — boot 는 myhome-desktop.js 바로 다음');
    chk(/const focusLevelStore = deps\.focusLevelStore;/.test(S.LEVEL) && /const focusTotalStore = deps\.focusTotalStore;/.test(S.TOTAL), '모듈은 계정 칸을 deps 로 받는다');
  }

  say('── 7. 배선');
  {
    chk(/const accountStoreMod = TwAccountStore\.createAccountStore\(\{ storage: localStorage, getAccountCode: getMyUserId \}\);/.test(S.APP), 'app.js — getMyUserId(부를 때마다 읽는 함수)로 만든다');
    chk(/createFocusTotal\(\{\n  focusTotalStore: accountStoreMod,/.test(S.APP) && /createFocusLevel\(\{\n  focusLevelStore: accountStoreMod,/.test(S.APP), 'app.js — 포커스 두 모듈에 같은 한 벌을 넘긴다');
    const iS = S.HTML.indexOf('<script src="parts/shared/account-store.js"></script>'), iA = S.HTML.indexOf('<script src="parts/app.js"></script>');
    chk(iS > 0 && iA > iS, 'html — account-store.js 를 app.js 보다 먼저 싣는다');
    chk(S.APP.indexOf('const accountStoreMod =') < S.APP.indexOf('const focusTotalMod ='), 'app.js — 쓰는 모듈보다 먼저 만든다(TDZ)');
    chk(/PRELOAD\.push\('account-store\.js'\)/.test(S.SMOKE), 'smoke PRELOAD 에 있다');
  }
}
function MIG(M){ return M.MIGRATED_KEY; }

judge(SRC0);

say('── 8. 일부러 깨 보기');
const BREAKS = [
  ['STORE', "function cellName(code, key){ return CELL_PREFIX + code + '.' + key.replace(/^tw\\./, ''); }", "function cellName(code, key){ return key; }", '계정 코드를 칸 이름에 안 넣음(PC 한 칸)'],
  ['STORE', "return validCode(code) ? cellName(code, key) : null;", "return validCode(code) ? cellName(code, key) : key;", '로그인 전에 PC 칸을 씀'],
  ['STORE', "const CODE_RE = /^u[0-9a-z]{8,40}$/i;", "const CODE_RE = /^.*$/;", '코드 모양을 안 봄(점 · 슬래시)'],
  ['STORE', "if(!isAccountKey(key)) throw new Error('[계정 칸] 계정별 키가 아니다 — ' + key);", "", '모르는 키 · 기기 공용 키를 받음'],
  ['STORE', "if(have !== null) res.kept.push(k);", "if(false) res.kept.push(k);", '계정 칸 값을 덮어씀'],
  ['STORE', "const todo = MOVED_KEYS.filter(k => !done.includes(k));", "const todo = MOVED_KEYS.slice();", '두 번 돎'],
  ['STORE', "try{ storage.removeItem(k); }catch(_){}\n      }\n      handled.push(k);", "}\n      handled.push(k);", '옮기고 PC 칸을 안 지움'],
  ['STORE', "catch(_){ continue; }   // 못 쓰면 옛 칸을 지우지 않고 다음에 다시", "catch(_){}", '못 써도 옛 칸을 지움'],
  ['STORE', "'tw.focusSyncedSec', 'tw.advZ.v2', 'tw.advZ.v1']);\n\nfunction isAccountKey", "'tw.advZ.v1']);\n\nfunction isAccountKey", '옮긴 표에서 마크 빠짐'],
  ['TOTAL', "function _loadFocusTotalSec(){ try{ return parseFloat(focusTotalStore.get(FOCUS_TOTAL_KEY))||0; }", "function _loadFocusTotalSec(){ try{ return parseFloat(localStorage.getItem(FOCUS_TOTAL_KEY))||0; }", '누적을 다시 PC 칸에서 읽음'],
  ['LEVEL', "focusLevelStore.set(FOCUS_TOTAL_KEY,String(_focusTotalSec()));", "localStorage.setItem(FOCUS_TOTAL_KEY,String(_focusTotalSec()));", '레벨 모듈이 PC 칸에 씀'],
  ['MHD', "function advSave(){ try{ advStore.set(ADV_KEY,", "function advSave(){ try{ localStorage.setItem(ADV_KEY,", '바탕화면이 PC 칸에 저장'],
  ['APP', "getAccountCode: getMyUserId }", "getAccountCode: ()=>null }", '계정 코드를 안 넘김'],
  ['BOOT', 'createMyHomeDesktop({ advStore: accountStoreMod })', 'createMyHomeDesktop({})', 'deps 를 안 넘김'],
  ['HTML', '<script src="parts/shared/account-store.js"></script>', '', 'html 에 안 실음'],
];
const caught = [];
for(const [where, from, to, what] of BREAKS){
  if(SRC0[where].indexOf(from) < 0){ chk(false, '깨 볼 글을 못 찾음 — ' + what); continue; }
  const S = Object.assign({}, SRC0); S[where] = S[where].split(from).join(to);
  quiet = true; qfail = 0;
  try{ judge(S); }catch(_){ qfail++; }
  quiet = false;
  caught.push([what, qfail]);
}
const missed = caught.filter(([, k]) => k === 0).map(([w]) => w);
chk(caught.length === BREAKS.length && !missed.length, '일부러 깨 본 ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — 못 잡음: ' + missed.join(' · ') : ''));

console.log(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
