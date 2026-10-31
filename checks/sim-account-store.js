/* sim-account-store.js — 🗂️ 계정별 로컬 칸(shared/account-store.js) 검사 (#582)
   ・1절: 키 표 — 기기 공용 / 계정별이 겹치지 않음 · 옮긴 키는 계정별 표 안 · 접두사
   ・2절: 칸 — 계정 A / B 가 안 섞임 · 계정이 바뀌면 같은 코드로 다른 칸 · 지우기도 제 칸만
   ・3절: 로그인 전(코드 없음 · 모양 밖) — 읽기 null · 쓰기 false · 저장소에 아무것도 안 씀
   ・4절: 기기 공용 키 · 모르는 키는 던진다(계정과 무관 — 계정 칸에 안 들어간다)
   ・5절: migrateLegacy — 한 번만 · 이미 있는 값 안 덮음 · 코드 없으면 PC 칸 그대로 · 못 쓰면 옛 칸 보존 · 나중에 더해진 키만 새로
   ・6절: 옮겨 쓰는 모듈 — 포커스 누적(focus-total.js 실물)이 계정마다 따로 · 바탕화면 · 포커스 레벨은 PC 칸을 더는 직접 안 읽음
   ・6c절: migrateLegacy 를 부르는 곳 — 부팅 때 읽는 모듈보다 먼저(코드 없으면 안 함) · 로그아웃은 올리기 앞 · 플레이리스트 마지막 올리기 뒤 지우기
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
  SHARE: pick(at('focus-share.js', 'focus')),
  MHD: pick(at('myhome-desktop.js', 'myhome')),
  BOOT: pick(at('myhome-desktop-boot.js', 'myhome')),
  ACC: pick(at('account.js', 'account')),
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

async function judge(S){
  let M = null;
  try{ M = load(S.STORE); }catch(e){ chk(false, '싣다 던짐 — ' + e.message); return; }
  if(!M || typeof M.createAccountStore !== 'function'){ chk(false, 'window.TwAccountStore.createAccountStore 가 없다'); return; }
  const mk = (st, codeRef, lock, closed) => {
    const s0 = M.createAccountStore({ storage: st, getAccountCode: () => codeRef.v, isWriteLocked: () => !!(lock && lock.v) });
    if(closed) return s0;
    /* 계정 확인을 통과해 열린 뒤(app-boot)와 같게 — 이 검사들은 코드를 바꿔 가며 쓰므로 부를 때마다 지금 코드로 연다 */
    const op = () => { const w0 = console.warn; console.warn = () => {}; const keep = codeRef.v; if(!keep) codeRef.v = A; s0.open(codeRef.v); codeRef.v = keep; console.warn = w0; };   // 코드가 아직 없는 PC 도 «연 뒤» 모양으로(코드 없음은 열림과 별개로 거절돼야 한다)
    return Object.assign({}, s0, { get: (k) => { op(); return s0.get(k); }, set: (k, v) => { op(); return s0.set(k, v); }, remove: (k) => { op(); return s0.remove(k); } });
  };

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
    const fresh = () => { const m = totalApi.createFocusTotal({ focusTotalStore: store }); m.startFocusTotal(); return m; };   // 계정 확인 뒤 app-boot 가 부르는 시작까지
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

  say('── 5b. 열림 — 계정 확인 전(닫힘)에는 읽기 null · 쓰기 거절 · 키마다 경고 한 번 / 열린 뒤 정상');
  {
    const st = mem(); const code = { v: A };
    st.o['tw.focusTotalSec'] = '1800000';
    const warns = []; const w0 = console.warn; console.warn = (...a) => warns.push(a.join(' '));
    const s = mk(st, code, null, true);
    const g1 = s.get('tw.focusTotalSec'), g2 = s.get('tw.focusTotalSec'), w1 = s.set('tw.focusTotalSec', 3), w2 = s.set('tw.focusTotalSec', 4), rm = s.remove('tw.focusTotalSec'), g3 = s.get('tw.advZ.v2');
    console.warn = w0;
    chk(g1 === null && g2 === null && g3 === null && w1 === false && w2 === false && rm === false, '닫힘 — 읽기 null · set · remove 거절');
    chk(Object.keys(st.o).join() === 'tw.focusTotalSec' && st.o['tw.focusTotalSec'] === '1800000', '  ↳ 아무것도 쓰지 않았고 옛 PC 값도 그대로');
    chk(warns.length === 2 && warns.every((m) => /계정 확인 전 접근/.test(m)) && /focusTotalSec/.test(warns[0]) && /advZ\.v2/.test(warns[1]), '  ↳ 경고는 키마다 한 번(focusTotalSec · advZ.v2 — 두 번째부터는 조용)');
    s.migrateLegacy(A);
    chk(st.o['tw.u.' + A + '.focusTotalSec'] === '1800000' && !('tw.focusTotalSec' in st.o), '  ↳ 확인 전에 쓰려던 값이 없으니 옛 값이 그대로 옮겨진다(kept · 삭제 사고 없음)');
    console.warn = () => {};
    const opened = s.open(A);
    console.warn = w0;
    chk(opened === true && s.get('tw.focusTotalSec') === '1800000' && s.set('tw.focusTotalSec', 5) === true && s.get('tw.focusTotalSec') === '5', '열린 뒤 — 옮겨진 값을 읽고 쓴다');
    const lock = { v: true };
    const s2 = mk(mem(), code, lock, true); console.warn = () => {}; s2.open(A); console.warn = w0;
    chk(s2.set('tw.focusTotalSec', 1) === false, '  ↳ 열린 뒤에도 계정을 놓은 틈(isWriteLocked)은 여전히 쓰기 거절');
    const s3 = mk(mem(), { v: A }, null, true); const w3 = []; console.warn = (...a) => w3.push(a.join(' '));
    const bad = s3.open(B) === false && s3.open('x') === false && s3.open(null) === false;
    console.warn = w0;
    chk(bad && w3.length === 3 && s3.get('tw.focusTotalSec') === null && s3.set('tw.focusTotalSec', 1) === false, '다른 코드 · 모양이 틀린 코드로는 열지 않고 경고(닫힌 채)');
    const dev = mk(mem(), { v: null }, null, true);
    chk((() => { try{ dev.get('tw.deviceId'); return false; }catch(_){ return true; } })(), '기기 공용 키는 계정 칸이 아니라 이전처럼 던진다(열림과 상관없음)');
  }

  say('── 6b. 확인 전 — 계정 칸 주인 모듈(포커스 누적 · 레벨 · 오늘 기록 전시 · 바탕화면)은 읽지도 쓰지도 않고, 확인 뒤에야 옛 PC 값이 화면 값이 된다');
  {
    const A1 = 'uaaaaaaaa1';
    const anyF = new Proxy(function(){}, { get: (t, k) => k === Symbol.toPrimitive ? (() => '') : k === 'then' ? undefined : anyF, apply: () => anyF, construct: () => anyF, has: () => true });
    const quietly = (fn) => { const w0 = console.warn; console.warn = () => {}; try{ return fn(); }finally{ console.warn = w0; } };
    const mkWorld = (openFirst) => quietly(() => {
      const st = mem(); st.setItem('tw.focusTotalSec', '1800000'); st.setItem('tw.focusTodaySec', '600'); st.setItem('tw.advZ.v2', JSON.stringify({ slots: [{}, {}, {}], active: 1, bg: { color: '#123456' } }));
      const io = [];
      const spy = { getItem: (k) => { io.push('R ' + k); return st.getItem(k); }, setItem: (k, v) => { io.push('W ' + k); st.setItem(k, v); }, removeItem: (k) => { io.push('D ' + k); st.removeItem(k); } };
      const store = load(S.STORE).createAccountStore({ storage: spy, getAccountCode: () => A1, isWriteLocked: () => false });
      const T = (() => { const w = {}; new Function('window', 'module', 'localStorage', S.TOTAL)(w, undefined, null); return w.TwFocusTotal; })();
      const total = T.createFocusTotal({ focusTotalStore: store });
      st.setItem('tw.focusTodayDate', total._focusDayStr());
      const W = { st, io, store, total, profiles: [], pushes: [], tot: 0, today: 0 };
      const levelDeps = new Proxy({
        focusLevelStore: store, focusTotalStarted: () => total.started(),
        FOCUS_TODAY_DATE_KEY: total.FOCUS_TODAY_DATE_KEY, FOCUS_TODAY_SEC_KEY: total.FOCUS_TODAY_SEC_KEY, FOCUS_TOTAL_KEY: total.FOCUS_TOTAL_KEY,
        FOCUS_TOTAL_CAP_SEC: total.FOCUS_TOTAL_CAP_SEC, FOCUS_LEVEL_CAP_HOURS: total.FOCUS_LEVEL_CAP_HOURS, FOCUS_CYCLE_SEC: total.FOCUS_CYCLE_SEC, FOCUS_CYCLE_CAP: total.FOCUS_CYCLE_CAP,
        _focusDayStr: (...a) => total._focusDayStr(...a), _focusTotalSec: () => W.tot, _focusTodaySec: () => W.today, _focusSessionSec: () => 0,
        setFocusTotalSec: (v) => { W.tot = v; }, setFocusTodaySec: (v) => { W.today = v; }, setFocusSessionSec: () => {},
        getMyUserId: () => A1, getDisplayName: () => 'n', _acctDetached: () => false,
      }, { get: (t, k) => (k in t ? t[k] : anyF) });
      const fa = { setMyProfile: (...a) => { W.profiles.push(a); return Promise.resolve(); } };
      const win = new Proxy({ firebaseAPI: fa }, { get: (t, k) => (k in t ? t[k] : anyF), set: (t, k, v) => { t[k] = v; return true; } });
      const doc = { getElementById: () => null, addEventListener(){}, createElement: () => anyF, body: anyF };
      W.lvl = new Function('window', 'document', 'localStorage', 'firebaseAPI', 'module', 'setTimeout', 'setInterval', S.LEVEL + '\nreturn window.TwFocusLevel;')(win, doc, null, fa, undefined, () => 0, () => 0).createFocusLevel(levelDeps);
      W.share = new Function('window', 'document', 'setInterval', 'Presence', S.SHARE + '\nreturn window.TwFocusShare;')(win, doc, () => 0, undefined).createFocusShare({
        Presence: { setFocusShow: (c) => W.pushes.push(c) }, _lsSet: () => {}, _rolloverFocusToday: () => total._rolloverFocusToday(),
        officeMode: () => false, toast: () => {}, userStatus: () => '' });
      if(openFirst){ store.migrateLegacy(A1); store.open(A1); }   // 열렸지만(옮김 뒤) 모듈은 아직 시작 전
      io.length = 0;
      return W;
    });
    const pre = (W) => quietly(() => { W.lvl.addFocusSeconds(5); W.lvl._pushLevelIfChanged(); W.total._rolloverFocusToday(); W.share._focusShowPush(true); });   // 활성 앱 신호 한 번 + 오늘 기록 전시 한 번
    const W1 = mkWorld(false); pre(W1);
    chk(W1.io.length === 0 && W1.profiles.length === 0 && W1.tot === 0, '★ 확인 전 — 계정 칸이 닫혀 있다: 활성 앱 신호 · 오늘 기록 전시 한 번에 읽기 · 쓰기 0건 · 누적 0 · setMyProfile 0');
    chk(W1.st.o['tw.focusTotalSec'] === '1800000' && Object.keys(W1.st.o).every((k) => !k.startsWith('tw.u.')), '  ↳ 옛 PC 칸 값은 그대로이고 계정 칸은 비어 있다');
    const W2 = mkWorld(true); pre(W2);
    chk(W2.io.length === 0 && W2.profiles.length === 0 && W2.tot === 0, '★ 칸이 열렸어도 모듈이 시작 전이면 입구에서 끝낸다 — 읽기 · 쓰기 0건 · 누적 0 · setMyProfile 0(활성 앱 판정 쪽 가드 없이 포커스 모듈 입구 한 곳)');
    const W3 = mkWorld(false);
    quietly(() => { W3.store.migrateLegacy(A1); W3.store.open(A1); W3.total.startFocusTotal(); W3.tot = W3.total._loadFocusTotalSec(); });   // app-boot begin: 옮기기 → 열기 → 시작
    chk(W3.tot === 1800000 && W3.total._focusTodaySec() === 600 && W3.total.started(), '★ begin 뒤 — 옛 PC 칸 값(누적 1800000 · 오늘 600)이 화면 값으로 보인다');
    quietly(() => W3.lvl.addFocusSeconds(5));
    chk(W3.tot === 1800005 && W3.st.o['tw.u.' + A1 + '.focusTotalSec'] === '1800005', '  ↳ 시작 뒤에는 누적에 더하고 계정 칸에 쓴다');
    const grabF = (src, head) => { const i = src.indexOf(head); if(i < 0) return ''; let k = src.indexOf('{', i), d = 0; for(; k < src.length; k++){ if(src[k] === '{') d++; else if(src[k] === '}' && --d === 0) return src.slice(i, k + 1); } return ''; };
    const advLine = (S.MHD.match(/^const ADV = [^\n]*$/m) || [''])[0];
    const reads = [];
    const advStore = { get: (k) => { reads.push(k); return W3.st.getItem('tw.u.' + A1 + '.' + k.replace(/^tw\./, '')); }, set: () => { reads.push('W'); return true; } };
    let advRun = null;
    try{ advRun = new Function('advStore', 'FolderFree', 'ADV_KEY', 'ADV_KEY_V1', 'localStorage',
      grabF(S.MHD, 'function blankSlot(') + '\n' + grabF(S.MHD, 'function advDefault(') + '\n' + grabF(S.MHD, 'function advLoad(') + '\n' + advLine + '\nreturn ADV;')(advStore, undefined, 'tw.advZ.v2', 'tw.advZ.v1', null); }catch(_){}
    chk(/advDefault\(\)/.test(advLine) && reads.length === 0 && !!advRun && advRun.bg === null, '★ 바탕화면 — 만들 때 계정 칸을 읽지 않고 빈 기본값(받는 중 상태)으로 선다');
    chk(/function advSave\(\)\{\n  if\(!advStarted\) return;/.test(S.MHD), '  ↳ 시작 전 advSave 는 쓰지 않는다(빈 기본값이 저장본을 덮지 못한다)');
    chk(/function startFocusShare\(\)\{\n  _focusShowPush\(true\);/.test(S.SHARE), '  ↳ 오늘 기록 전시의 처음 한 번 보내기는 시작 함수 안에만 있다');
  }

  say('── 6c. migrateLegacy 를 부르는 곳 — 읽는 모듈보다 먼저 · 코드 없으면 안 함 · 로그아웃은 올리기 앞 · 지우기보다 앞');
  {
    // ① 부팅 — app.js 의 그 줄을 실물 글로 뽑아 진짜 계정 칸 위에서 돌린다
    /* 0.13 — 옮기기는 계정 확인 뒤 app-boot 가 서버가 돌려준 코드로 한다(읽는 모듈의 시작보다 앞 — 순서는 sim-app-boot.js). app.js 는 그 연결 한 줄만 둔다. */
    const line = (S.APP.match(/^ {2}migrateLegacy: \(code\)=>accountStoreMod\.migrateLegacy\(code\),$/m) || [])[0];
    chk(!!line && S.APP.split(line).length === 2, '① app.js 에 옮기기 연결이 한 줄 있다(app-boot 가 서버 계정 코드로 부른다)');
    chk(!/^accountStoreMod\.migrateLegacy\(getMyUserId\(\)\);$/m.test(S.APP) && S.APP.indexOf('const accountStoreMod =') < S.APP.indexOf('const appBoot =') && S.APP.indexOf('const appBoot =') > S.APP.indexOf('const focusTotalMod ='), '  ↳ 확인 전(저장된 코드)으로 옮기는 줄은 없다 · 계정 칸을 만든 뒤에 연결한다');
    const mkBoot = (code) => {
      const st = mem(); st.setItem('tw.focusTotalSec', '7777'); st.setItem('tw.advZ.v2', '{"a":1}');
      const M = load(S.STORE);
      const store = M.createAccountStore({ storage: st, getAccountCode: () => code, isWriteLocked: () => false });
      if(line) new Function('accountStoreMod', 'return ' + line.trim().replace(/^migrateLegacy: /, '').replace(/,$/, ''))(store)(code);
      if(code){ const w0 = console.warn; console.warn = () => {}; store.open(code); console.warn = w0; }   // app-boot 가 옮긴 직후 여는 것까지
      return { st, store };
    };
    let b = mkBoot(null);
    chk(b.st.o['tw.focusTotalSec'] === '7777' && !(MIG(load(S.STORE)) in b.st.o) && Object.keys(b.st.o).every((k) => !k.startsWith('tw.u.')), '★ 로그인 전(코드 없는 PC) — 아무것도 옮기지 않고 PC 칸 그대로(다음에 코드가 생기면 그때)');
    b = mkBoot(A);
    chk(b.st.o['tw.u.' + A + '.focusTotalSec'] === '7777' && !('tw.focusTotalSec' in b.st.o) && b.st.o['tw.u.' + A + '.advZ.v2'] === '{"a":1}', '★ 코드가 있는 PC — 그 계정 칸으로 옮기고 PC 칸은 비운다');
    chk(b.store.get('tw.focusTotalSec') === '7777', '  ↳ 읽는 모듈이 곧바로 옮긴 값을 본다');
    b.st.setItem('tw.focusTotalSec', '1'); b.store.migrateLegacy(A);
    chk(b.st.o['tw.u.' + A + '.focusTotalSec'] === '7777', '  ↳ 두 번째는 덮지 않는다');

    // ② 로그아웃 — _loginDoLogout 을 실물 글로 돌려 부른 차례를 본다
    const any = (() => { const f = function(){ return P; }; const P = new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? (() => '') : k === 'then' ? undefined : k === 'length' ? 0 : P, apply: () => P, construct: () => P, set: () => true, has: () => true }); return P; })();
    const st = mem(); st.setItem('tw.myUserId', A);
    const rec = [];
    const deps = {};
    (S.ACC.match(/deps\.([\w$]+)/g) || []).forEach((m) => { deps[m.slice(5)] = any; });
    Object.assign(deps, {
      MY_USER_ID_KEY: 'tw.myUserId', getMyUserId: () => st.getItem('tw.myUserId'),
      accountLegacyStore: { migrateLegacy: (c) => { rec.push('migrate:' + c); return {}; } },
      plMod: { st: {}, reset(){}, flushPending: () => new Promise((r) => setTimeout(() => { rec.push('plFlushDone'); r(); }, 5)) },
      setAcctDetached: (v) => { if(v) rec.push('wipe'); },
      focusLevelMod: () => ({ DANCE_NOTIFIED_KEY: 'x1', DANCE_REPAIR_KEY: 'x2' }),
      acctStateMod: { INVITE_PASS_KEY: 'x3', LICENSE_KEY_STORAGE: 'x4', LICENSE_OPTOUT_KEY: 'x5' },
      LOGIN_EMAIL_KEY: 'x6', LOGIN_UID_KEY: 'x7',
    });
    const win = { firebaseAPI: { deviceSessionLost: () => true, authSignOut(){}, chatHistory: { wipeAll(){} } } };
    let acc = null;
    try{
      acc = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'setTimeout', 'module',
        S.ACC + '\nreturn window.TwAccount;')(win, any, st, any, win.firebaseAPI, (f) => 0, undefined).createAccount(deps);
    }catch(e){ chk(false, 'account.js 를 만들지 못했다 — ' + e.message); }
    if(acc){
      const lo = await acc._loginDoLogout({ force: true });
      chk(lo && lo.ok, '로그아웃이 끝난다');
      chk(rec.join() === 'migrate:' + A + ',plFlushDone,wipe', '★ 차례: 옛 값 옮기기 → 플레이리스트 마지막 올리기가 끝남 → 지우기(wipe)  [' + rec.join(' → ') + ']');
    }
    st.o = {}; 
    const accOut = async () => {
      const r2 = []; deps.accountLegacyStore = { migrateLegacy: (c) => { r2.push('migrate:' + c); return {}; } };
      const a2 = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'setTimeout', 'module', S.ACC + '\nreturn window.TwAccount;')(win, any, st, any, win.firebaseAPI, (f) => 0, undefined).createAccount(deps);
      await a2._loginDoLogout({ force: true }); return r2;
    };
    chk((await accOut()).length === 0, '  ↳ 로그인 전(이 PC 에 코드 없음)의 로그아웃은 옮기기를 부르지 않는다');
  }

  say('── 7. 배선');
  {
    chk(/const accountStoreMod = TwAccountStore\.createAccountStore\(\{ storage: localStorage, getAccountCode: getMyUserId, isWriteLocked: \(\)=>acctStateMod\._acctDetached\(\) \}\);/.test(S.APP), 'app.js — getMyUserId(부를 때마다 읽는 함수)로 만든다');
    chk(/createFocusTotal\(\{\n  focusTotalStore: accountStoreMod,/.test(S.APP) && /createFocusLevel\(\{\n  focusLevelStore: accountStoreMod,/.test(S.APP), 'app.js — 포커스 두 모듈에 같은 한 벌을 넘긴다');
    const iS = S.HTML.indexOf('<script src="parts/shared/account-store.js"></script>'), iA = S.HTML.indexOf('<script src="parts/app.js"></script>');
    chk(iS > 0 && iA > iS, 'html — account-store.js 를 app.js 보다 먼저 싣는다');
    chk(S.APP.indexOf('const accountStoreMod =') < S.APP.indexOf('const focusTotalMod ='), 'app.js — 쓰는 모듈보다 먼저 만든다(TDZ)');
    chk(/PRELOAD\.push\('account-store\.js'\)/.test(S.SMOKE), 'smoke PRELOAD 에 있다');
  }
}
function MIG(M){ return M.MIGRATED_KEY; }

(async () => {
await judge(SRC0);

say('── 8. 일부러 깨 보기');
const BREAKS = [
  ['APP', "  migrateLegacy: (code)=>accountStoreMod.migrateLegacy(code),\n", "  migrateLegacy: (code)=>{},\n", '부팅 때 옛 값을 안 옮김'],
  ['ACC', "  if(uid) accountLegacyStore.migrateLegacy(uid);\n", "", '로그아웃이 옛 값을 안 옮김'],
  ['ACC', "  if(uid) accountLegacyStore.migrateLegacy(uid);\n  if(uid){\n    const fl = await _acctFlushToServer();", "  if(uid){\n    const fl = await _acctFlushToServer();\n    accountLegacyStore.migrateLegacy(uid);", '로그아웃이 올린 뒤에 옮김(순서 뒤집기)'],
  ['ACC', "const fl = await _acctFlushToServer();", "const fl = (_acctFlushToServer(), { timedOut:false });", '플레이리스트 마지막 올리기를 안 기다리고 지움'],
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
  ['MHD', "  try{ advStore.set(ADV_KEY, JSON.stringify(ADV)); }catch(_){}\n}", "  try{ localStorage.setItem(ADV_KEY, JSON.stringify(ADV)); }catch(_){}\n}", '바탕화면이 PC 칸에 저장'],
  ['APP', "getAccountCode: getMyUserId, isWriteLocked", "getAccountCode: ()=>null, isWriteLocked", '계정 코드를 안 넘김'],
  ['STORE', "if(!cell || closedFor(key) || isWriteLocked()) return false;\n    try{ storage.setItem", "if(!cell || closedFor(key)) return false;\n    try{ storage.setItem", '놓은 틈에도 set 이 통과'],
  ['STORE', "if(!cell || closedFor(key) || isWriteLocked()) return false;\n    try{ storage.setItem", "if(!cell || isWriteLocked()) return false;\n    try{ storage.setItem", '닫힌 동안에도 set 이 통과'],
  ['STORE', "    if(!cell || closedFor(key)) return null;", "    if(!cell) return null;", '닫힌 동안에도 get 이 통과'],
  ['STORE', "if(!validCode(code) || code !== getAccountCode()){", "if(!validCode(code)){", '다른 코드로도 열림'],
  ['MHD', "  try{ advStore.set(ADV_KEY, JSON.stringify(ADV)); }catch(_){}\n}", "  try{ localStorage.setItem(ADV_KEY, JSON.stringify(ADV)); }catch(_){}\n}", '바탕화면 저장이 PC 칸(동작 판정)'],
  ['TOTAL', "  if(!_started) return _focusTodaySec;   // 계정 칸이", "  // ", '오늘치 롤오버가 확인 전에도 계정 칸을 읽고 씀'],
  ['LEVEL', "  if(!focusTotalStarted()) return;   // 계정 확인 전", "  // ", '누적 더하기가 확인 전에도 돎'],
  ['LEVEL', "  if(!focusTotalStarted()) return;   // 누적을 읽기 전의 0 으로", "  // ", '레벨 올림이 확인 전에도 프로필을 씀'],
  ['MHD', "const ADV = advDefault();", "const ADV = advLoad();", '바탕화면을 만들 때 읽음'],
  ['MHD', "  if(!advStarted) return;\n", "", '시작 전에도 advSave'],
  ['SHARE', "function startFocusShare(){\n  _focusShowPush(true);", "function startFocusShare(){\n  ", '오늘 기록 전시 첫 보내기가 시작 밖'],
  ['STORE', "    if(opened) return false;", "    return false;", '열림 장치를 끔(늘 열림)'],
  ['BOOT', 'createMyHomeDesktop({ advStore: accountStoreMod })', 'createMyHomeDesktop({})', 'deps 를 안 넘김'],
  ['HTML', '<script src="parts/shared/account-store.js"></script>', '', 'html 에 안 실음'],
];
const caught = [];
for(const [where, from, to, what] of BREAKS){
  if(SRC0[where].indexOf(from) < 0){ chk(false, '깨 볼 글을 못 찾음 — ' + what); continue; }
  const S = Object.assign({}, SRC0); S[where] = S[where].split(from).join(to);
  quiet = true; qfail = 0;
  try{ await judge(S); }catch(_){ qfail++; }
  quiet = false;
  caught.push([what, qfail]);
}
const missed = caught.filter(([, k]) => k === 0).map(([w]) => w);
chk(caught.length === BREAKS.length && !missed.length, '일부러 깨 본 ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — 못 잡음: ' + missed.join(' · ') : ''));

console.log(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('✗ 검사 자체가 죽음: ' + (e && e.stack || e)); process.exit(1); });
