/* ═══ 🏠 sim-myhome-wire.js — 마이홈 화면을 상태 주인(myhome-store.js)에 잇는 배선 (0.13 앱 묶음 D2-2b) ═══
   [왜] 마이홈 페이지의 원본이 서버가 되면서 화면 파일 열다섯이 «고친 사본(_myHomeData 를 직접 고침) → firebaseAPI.saveMyHome» 에서
     «상태 주인의 동작 함수 → 서버(PATCH · PUT)» 로 바뀌었다. 이 검사는 그 이음 자리가 한 곳씩인지, 옛 길이 안 남았는지,
     그리고 상태 · 읽기 창구 · 친구 홈 구경이 진짜 상태 주인 위에서 맞게 도는지 본다(저장 줄 · 409 · 올리기 규칙 자체는 sim-myhome-store).
   ・1절: 배선 — app.js 가 서버 길(api)과 상태 주인을 상태 창구 · 화면보다 먼저 만든다 · 앱 끄기 flush · 로그아웃 flush → reset · firebase-init 에 옛 길(getMyHome · saveMyHome)이 없다
   ・2절: 화면이 값을 직접 고치지 않는다 — 마이홈 화면 파일에 «_myHomeData().X = » · «delete …stickers[» 같은 직접 쓰기가 없다 · 옛 saveMyHome · commit 인자 없음
   ・3절: 진짜 상태 주인 위에서 — 받기 → 읽기 창구가 얼린 값 · 친구 홈 구경은 내 홈을 건드리지 않고 돌아오면 그대로(백업 · 복원 없음) · 사진은 store.avatar() 한 곳
   ・4절: 일부러 깨 보기
   [실행] 러너 스테이징(평면). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) fail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, 'parts/myhome/' + f, 'app/parts/myhome/' + f, 'parts/account/' + f, 'app/parts/account/' + f, 'app/parts/shared/' + f]) { try{ return fs.readFileSync(c, 'utf8'); }catch(_){} } return null; };
const need = ['app.js', 'account.js', 'firebase-init.js', 'myhome-store.js', 'myhome-state.js', 'myhome-page.js', 'myhome-visit.js', 'myhome-edit.js', 'myhome-sticker.js', 'myhome-sticker-layout.js', 'myhome-api.js', 'api-errors.js', 'myhome-sticker-rules.js', 'chat-ui.js', 'my-info.js', 'playlist.js'];
const SRC = {};
for(const f of need){ SRC[f] = read(f) || read('chat/' + f) || read('status/' + f); if(!SRC[f]){ console.log('  ? 원본 못 찾음 — ' + f); process.exit(2); } }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
const loadMod = (src) => { const m = { exports: {} }; new Function('window', 'module', src)({}, m); return m.exports; };
const flush = async () => { for(let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r)); };
const clone = (v) => JSON.parse(JSON.stringify(v));

function wiring(S){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const app = S['app.js'];
  const iApi = app.indexOf('const myhomeApiMod = TwMyHomeApi.createMyHomeApi('), iSt = app.indexOf('const myhomeStoreMod = TwMyHomeStore.createMyHomeStore('), iState = app.indexOf('const mhStateMod = TwMyHomeState.createMyHomeState(');
  t(iApi > 0 && iSt > iApi && iState > iSt && (app.match(/TwMyHomeStore\.createMyHomeStore\(/g) || []).length === 1, 'app.js — 서버 길(api) → 상태 주인 → 상태 창구 순서 · 상태 주인은 한 곳에서만 만든다');
  const mk = (app.match(/TwMyHomeStore\.createMyHomeStore\(\{([\s\S]*?)\n\}\);/) || [])[1] || '';
  t(/api: myhomeApiMod,/.test(mk) && /lib: TwMyHomeApi,/.test(mk) && /previewOn: \(\)=>!!window\._mhPreviewMode,/.test(mk) && /rules: TwMyHomeStickerRules,/.test(mk), '  deps — 서버 길 · 라이브러리 · 미리보기 깃발 · 스티커 규칙');
  t(/myhomeStoreMod\.onChange\(\(\)=>\{\n  if\(!myHomeOpen\) return;[\s\S]*?mhPageMod\.renderMyHomePage\(\)/.test(app), '값이 바뀌면 열려 있는 마이홈만 다시 그린다(같은 값이면 안 그림)');
  t(/beforeunload', \(\)=>\{ myhomeStoreMod\.flush\(\); \}/.test(app), '앱을 끌 때 못 올린 고침을 한 번 올린다(flush · 결과는 안 기다림)');
  const acc = strip(S['account.js']);
  const iF = acc.indexOf('myhomeStore.flush()'), iR = acc.indexOf('myhomeStore.reset()');
  t(iF > 0 && iR > iF && /myhomeStore: myhomeStoreMod,/.test(app), '로그아웃 — 못 올린 고침을 올린 뒤(flush) 계정을 놓을 때 비운다(reset · 늦은 답 버림)');
  t(/window\.commitMyHomePage\(true\); myhomeStoreMod\.flush\(\)/.test(app), '런처로 돌아갈 때도 마이홈 마지막 저장 뒤 flush');
  const fi = strip(S['firebase-init.js']);
  t(!/getMyHome|saveMyHome|_myHomeLimits/.test(fi), 'firebase-init.js — 옛 마이홈 길(getMyHome · saveMyHome)이 없다');
  t(!/(?:firebaseAPI\.)?(?:getMyHome|saveMyHome)\b/.test(strip(app) + ['chat-ui.js', 'my-info.js', 'playlist.js'].map((f) => strip(S[f])).join('')), '화면 · 모듈 어디서도 옛 길을 부르지 않는다');
  for(const [f, tag] of [['chat-ui.js', 'ensureMyHome({ site: \'quiet\' })'], ['my-info.js', 'ensureMyHome({ site: \'quiet\' })']]) t(S[f].includes(tag) && /myhomeAvatar\(\)/.test(S[f]), '사진 — ' + f + ' 는 상태 주인의 avatar() 를 읽고 없으면 한 번 받는다');
  t(/const av = myhomeAvatar\(\);/.test(S['playlist.js']) && /myhomeAvatar: \(\)=>myhomeStoreMod\.avatar\(\),/.test(app), '  플레이리스트 명함 사진도 같은 곳');
  return r;
}
function direct(S){
  const r = [];
  const files = ['myhome-edit.js', 'myhome-sticker.js', 'myhome-sticker-layout.js', 'myhome-page.js', 'myhome-visit.js'];
  const bad = [];
  for(const f of files){
    const t = strip(S[f]);
    if(/(?:_myHomeData\(\)|\bdata)(?:\.[A-Za-z_$]+)+\s*=(?!=)/.test(t.replace(/\bconst data\b/g, '')) && /_myHomeData\(\)(?:\.[A-Za-z_$]+)+\s*=(?!=)/.test(t)) bad.push(f);
    if(/delete\s+_myHomeData\(\)/.test(t) || /_myHomeData\(\)\.stickers\[[^\]]+\]\s*=(?!=)/.test(t)) bad.push(f + ':지움/붙임');
    if(/firebaseAPI\.(?:save|get)MyHome|commitMyHomePage\(\s*true\s*\)/.test(t)) bad.push(f + ':옛 저장');
  }
  r.push([!bad.length, '화면 파일은 마이홈 값을 직접 고치지 않는다 — 상태 주인의 동작 함수로만' + (bad.length ? ' — ' + bad.join(' · ') : '')]);
  const app = strip(S['app.js']);
  r.push([!/mhStateMod\._myHomeData\(\)\.\w+(?:\[[^\]]*\])?\s*=(?!=)|delete mhStateMod\._myHomeData/.test(app), 'app.js 도 마찬가지(스티커 × 버튼은 상태 주인 removeSticker)']);
  r.push([/animSpeed/.test(app) && !/animSpd/.test(app + S['myhome-sticker-layout.js']), '스티커 움직임 속도 칸 이름은 animSpeed 하나(옛 animSpd 없음)']);
  return r;
}

async function runReal(S, o){
  o = o || {};
  const lib = loadMod(S['myhome-api.js']);
  const log = [];
  const srv = { page: { version: 3, avatar: 'https://a/me.png', bio: '내 소개', postTitle: '제목', post: '글', bgm: null, bg: null, stickers: [], theme: null, presets: [null, null, null], presetCur: 0 }, desktop: { version: 1, bg: null, hideFolders: false, folderPos: {} } };
  const friend = { page: { avatar: null, bio: '친구 소개', postTitle: '', post: '', bgm: null, bg: null, stickers: [], theme: null, presets: [null, null, null], presetCur: 0 }, desktop: { bg: null, hideFolders: false, folderPos: {} } };
  const api = {
    fetchMine: async () => { log.push('GET mine'); return lib.homeOf(clone(srv)); },
    fetchOf: async (c) => { log.push('GET of ' + c); const h = lib.homeOf(clone(friend)); return { page: h.page, desktop: h.desktop }; },
    patchPage: async (v, f) => { log.push('PATCH ' + JSON.stringify(Object.keys(f))); return v + 1; }, putDesign: async (v) => v + 1, uploadImage: async () => 'https://a/u.png', reset: () => {},
  };
  const store = loadMod(S['myhome-store.js']).createMyHomeStore({ api, lib, errs: loadMod(S['api-errors.js']), apiErrors: { notify: () => {} }, notifyError: () => true, toast: () => {}, previewOn: () => false, rules: loadMod(S['myhome-sticker-rules.js']) });
  const win = {};
  const stMod = new Function('window', 'module', S['myhome-state.js'] + '\nreturn window.TwMyHomeState;')(win, undefined);
  const st = stMod.createMyHomeState({ _myHomeFriends: () => ({}), myhomeStore: store });
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  t(st._myHomeLoaded() === false && st._myHomeData().bio === '', '받기 전 — 안 불러옴 · 빈 페이지');
  await store.pullMine();
  const d = st._myHomeData();
  t(st._myHomeLoaded() === true && d.bio === '내 소개' && Object.isFrozen(d) && store.avatar() === 'https://a/me.png', '받은 뒤 — 읽기 창구가 받은 값(얼린 값) · 내 사진은 store.avatar() 한 곳');
  await store.openView('F1', '친구');
  t(st._mhViewingUserId() === 'F1' && st._myHomeData().bio === '친구 소개' && st._mhViewingDisplayName() === '친구' && store.avatar() === 'https://a/me.png', '친구 홈 구경 — 창구는 그 집 · 내 사진은 그대로');
  t(await store.setField('bio', '남의 집에서 고침') === 'locked' && !log.some((l) => /^PATCH/.test(l)), '  구경 중엔 고칠 수 없다(요청 0)');
  store.closeView();
  t(st._mhViewingUserId() === null && st._myHomeData().bio === '내 소개' && !log.some((l) => /GET mine/.test(l) && log.filter((x) => x === 'GET mine').length > 1), '돌아오면 내 홈 그대로 — 백업 · 복원 없이 · 다시 받지 않는다');
  await store.setField('bio', '고침'); await flush();
  t(st._myHomeData().bio === '고침' && log.filter((l) => /^PATCH/.test(l)).join() === 'PATCH ["bio"]', '내 홈은 상태 주인으로 고치고 읽기 창구가 바로 따라간다(PATCH 글 칸만)');
  if(o.noFlush) return r;
  store.reset();
  t(st._myHomeLoaded() === false && st._myHomeData().bio === '' && store.avatar() === null, '계정을 놓으면(reset) 읽기 창구도 비워진다');
  return r;
}

(async () => {
  say('── 1. 배선');
  wiring(SRC).forEach(([ok, m]) => chk(ok, m));
  say('── 2. 화면은 값을 직접 고치지 않는다');
  direct(SRC).forEach(([ok, m]) => chk(ok, m));
  say('── 3. 진짜 상태 주인 위에서');
  (await runReal(SRC)).forEach(([ok, m]) => chk(ok, m));
  say('── 4. 일부러 깨 보기');
  const cases = [
    ['상태 주인을 상태 창구보다 뒤에 만들면', (S) => { S['app.js'] = S['app.js'].replace('const myhomeStoreMod = TwMyHomeStore.createMyHomeStore(', 'const myhomeStoreLate = TwMyHomeStore.createMyHomeStore('); return wiring(S); }],
    ['로그아웃에서 reset 을 빼면', (S) => { S['account.js'] = S['account.js'].split('myhomeStore.reset()').join('void 0'); return wiring(S); }],
    ['앱 끌 때 flush 를 빼면', (S) => { S['app.js'] = S['app.js'].replace("{ myhomeStoreMod.flush(); }", '{ }'); return wiring(S); }],
    ['firebase-init 에 옛 saveMyHome 이 남으면', (S) => { S['firebase-init.js'] += '\nasync saveMyHome(){}\n'; return wiring(S); }],
    ['채팅 사진이 옛 getMyHome 을 부르면', (S) => { S['chat-ui.js'] += '\nfirebaseAPI.getMyHome(1);\n'; S['app.js'] += ''; return wiring(S); }],
    ['화면이 마이홈 값을 직접 고치면', (S) => { S['myhome-edit.js'] += '\n_myHomeData().bio = "x";\n'; return direct(S); }],
    ['스티커 지우기를 직접 하면', (S) => { S['myhome-sticker.js'] += '\ndelete _myHomeData().stickers[sid];\n'; return direct(S); }],
    ['읽기 창구가 store 대신 사본을 들면', async (S) => { S['myhome-state.js'] = S['myhome-state.js'].replace('_myHomeData: ()=>myhomeStore.page(),', '_myHomeData: ()=>({ bio: "" }),'); return runReal(S, { noFlush: true }); }],
  ];
  for(const [name, fn] of cases){
    const S = Object.assign({}, SRC);
    let rows; try{ rows = await fn(S); }catch(_){ rows = [[false, '던짐']]; }
    chk(rows.some(([ok]) => !ok), name + ' → 빨강');
  }
  console.log('\n판정: ' + (fail ? '✗ 빨강 ' + fail : '통과') + ' (' + pass + ' ✓)');
  process.exit(fail ? 1 : 0);
})();
