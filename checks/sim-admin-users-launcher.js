/* ═══ 🧰 sim-admin-users-launcher.js — 관리자 5번 모듈 둘 (2026-10-14 신설 · 관리자 코드 admin 폴더 5번) ═══════════════
   app.js 의 관리자 몫 두 덩이를 parts/admin/ 으로 옮겼다. 동작은 그대로여야 한다 — 가짜 DOM 위에서 굴린다.
     admin-users.js    — 📊 전체 통계 · 🎟️ 초대권 지급(사용자 초대 창 bindInviteUI 안쪽에 있던 것)
     admin-launcher.js — 🛑 전체 방 종료 · 🧹 유령 방 청소 · ⚙️ 게임 설정 편집 · 📢 광고 배너 편집
   ・1절: 통계 · 초대권 — 만들 때 버튼 · 통계 읽기 · 한 명 지급(친추코드 → uid → 장수) · 장수 상한 · 전체 지급은 두 번 눌러야
   ・2절: 런처 도구 — 관리자 아니면 막힘(다시 대입된 isAdmin 을 읽음) · 방 종료는 «종료» 입력 · 게임 설정 1~999 · 지금 설정에 합쳐 저장 · 광고 배너 저장 · 게시
   ・3절: app.js 연결 — 본문이 안 남음 · 사용자 쪽은 남음 · 빈 껍데기 · deps · 원래 자리(초대 창 안 · 런처 구역) · html
   ・4절: 일부러 깨 보기
   [실행] app.js · desk-companion-prototype.html · admin-users.js · admin-launcher.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
/* 🎟️ 초대 창(bindInviteUI)은 초대장 구역과 함께 license-gate.js 로 옮겼다(앱 FSD 31번) — 사용자 쪽에 남았는지는 그 파일에서 본다 */
const LGATE = [ 'license-gate.js', 'parts/account/license-gate.js', 'app/parts/account/license-gate.js' ].map(read).find(Boolean) || '';
/* 📢 광고 배너 · ⚙️ 게임 설정의 사용자 쪽(그리기 · 구독)은 ad-banner.js 로 옮겼다(앱 FSD 43번) — 남았는지는 그 파일에서 본다 */
const ADB = [ 'ad-banner.js', 'parts/ad-banner.js', 'app/parts/ad-banner.js' ].map(read).find(Boolean) || '';
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const part = (n) => [n, 'parts/admin/' + n, 'app/parts/admin/' + n].map(read).find(Boolean);
const M = { users: part('admin-users.js'), launcher: part('admin-launcher.js') };
if(!M.users){ say('  ? 원본 못 찾음 — admin-users.js'); process.exit(2); }
if(!M.launcher){ say('  ? 원본 못 찾음 — admin-launcher.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');

function makeDom(){
  const els = {};
  const mk = (id) => ({ id, style: {}, value: '', textContent: '', innerHTML: '', disabled: false, title: '', _on: {}, onclick: null,
    classList: { _s: new Set(), add(c){ this._s.add(c); }, remove(c){ this._s.delete(c); }, contains(c){ return this._s.has(c); } },
    addEventListener(t, f){ (this._on[t] = this._on[t] || []).push(f); }, focus(){},
    fire(t, ev){ return Promise.all((this._on[t] || []).map(f => f(Object.assign({ preventDefault(){}, target: null }, ev || {})))); } });
  const document = { getElementById: (id) => els[id] || (els[id] = mk(id)) };
  return { els: new Proxy(els, { get: (o, id) => document.getElementById(id) }), document };
}
function build(src, glob, deps, fbOver){
  const calls = [], toasts = [], store = {};
  const rec = (name, ret) => async (...a) => { calls.push([name, ...a]); return typeof ret === 'function' ? ret(...a) : ret; };
  const fb = Object.assign({
    getAdminStats: rec('getAdminStats', { totalUsers: 12, premiumUsers: 3, licValid: 4, licUsed: 2 }), setUserCount: rec('setUserCount'),
    grantInvites: rec('grantInvites', { ok: true, invitesLeft: 5 }), grantInvitesAll: rec('grantInvitesAll', { ok: true, granted: 9, skipped: 1 }),
    revokeInvitesAll: rec('revokeInvitesAll', { revoked: 2, taken: 3, skipped: 0 }), lookupFriendCode: rec('lookupFriendCode', (c) => c === 'MATE-AAAA' ? 'u1' : null),
    closeAllRooms: rec('closeAllRooms', { ok: true, count: 3, failed: 0 }), cleanGhostRooms: rec('cleanGhostRooms', { ok: true, cleaned: 1, failed: 0 }),
    publishGameConfig: rec('publishGameConfig'), publishAdBanner: rec('publishAdBanner', { ok: true }),
  }, fbOver || {});
  const D = makeDom();
  const win = { firebaseAPI: fb, _animalUnlockLevel: 50 };
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const api = new Function('window', 'document', 'firebaseAPI', 'localStorage', 'navigator', 'setTimeout', 'clearTimeout', 'console', 'module', src + '\nreturn window.' + glob + ';')(
    win, D.document, fb, ls, { clipboard: { writeText(){} } }, () => 0, () => {}, { error(){}, warn(){} }, undefined);
  const out = api['create' + glob.replace(/^Tw/, '')](Object.assign({ toast: (m) => toasts.push(m) }, deps));
  return { out, calls, toasts, els: D.els, store };
}

async function judgeAll(m, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  /* 1. 통계 · 초대권 */
  let U;
  try{ U = build(m.users, 'TwAdminUsers', { inviteGrantMax: 3 }); }catch(e){ t(false, '통계 · 초대권 모듈을 만들 수 없다 — ' + e.message); }
  if(U){
    const e = U.els;
    t((e.lcTotalStats._on.click || []).length === 1 && (e.lcInviteGrant._on.click || []).length === 1 && (e.inviteGrantOk._on.click || []).length === 1
      && (e.inviteGrantAll._on.click || []).length === 1 && (e.inviteGrantAll._on.contextmenu || []).length === 1 && U.out && !Object.keys(U.out).length && U.calls.length === 0,
      '통계 · 초대권 — 만들 때 버튼 다섯 · 빈 반환 · 서버 안 부름');
    await e.lcTotalStats.fire('click');
    t(U.calls.some(c => c[0] === 'getAdminStats') && /12명/.test(e.totalStatsBody.innerHTML) && e.totalStatsOverlay.style.display === 'flex', '통계 — 창을 열고 가입 · 프리미엄 수를 읽는다');
    await e.lcInviteGrant.fire('click');
    for(let i = 0; i < 5; i++) await e.inviteGrantPlus.fire('click');
    t(e.inviteGrantCount.textContent === '3', '초대권 장수 — INVITE_GRANT_MAX(3) 에서 멈춘다');
    e.inviteGrantCode.value = ' mate-aaaa '; await e.inviteGrantOk.fire('click');
    t(U.calls.some(c => c[0] === 'lookupFriendCode' && c[1] === 'MATE-AAAA') && U.calls.some(c => c[0] === 'grantInvites' && c[1] === 'u1' && c[2] === 3), '한 명 지급 — 친추코드(대문자 · 공백 빼고) → uid → 장수');
    await e.inviteGrantAll.fire('click');
    const n1 = U.calls.filter(c => c[0] === 'grantInvitesAll').length;
    await e.inviteGrantAll.fire('click');
    t(n1 === 0 && U.calls.filter(c => c[0] === 'grantInvitesAll').length === 1, '전체 지급 — 첫 클릭은 걸기만 · 두 번째에 지급');
  }
  /* 2. 런처 도구 */
  const st = { admin: false, cfg: { animalUnlockLevel: 70, other: 'x' } };
  let Ln, banners = 0;
  try{ Ln = build(m.launcher, 'TwAdminLauncher', { asyncPrompt: async () => st.answer, refreshAdBanner: () => { banners++; }, adBannerKey: 'tw.adBanner',
    isAdmin: () => st.admin, gameCfg: () => st.cfg }); }catch(e){ t(false, '런처 도구 모듈을 만들 수 없다 — ' + e.message); }
  if(Ln){
    const e = Ln.els;
    t(['lcCloseAllRooms', 'lcCleanGhostRooms', 'lcGameCfg', 'gameCfgCloseBtn', 'gameCfgSaveBtn', 'lcAdBannerEdit', 'adBannerCloseBtn', 'adBannerSaveBtn']
      .every(id => typeof e[id].onclick === 'function') && Ln.out && !Object.keys(Ln.out).length && Ln.calls.length === 0, '런처 도구 — 만들 때 버튼 여덟 · 빈 반환 · 서버 안 부름');
    st.answer = '종료'; await e.lcCloseAllRooms.onclick(); await e.lcCleanGhostRooms.onclick();
    t(!Ln.calls.length && Ln.toasts.filter(x => /관리자만/.test(x)).length === 2, '관리자 아니면 방 종료 · 유령 방 청소가 막힌다');
    st.admin = true;
    st.answer = '종 료'; await e.lcCloseAllRooms.onclick();
    t(!Ln.calls.some(c => c[0] === 'closeAllRooms'), '방 종료 — «종료» 와 다르면 안 한다');
    st.answer = ' 종료 '; await e.lcCloseAllRooms.onclick(); await e.lcCleanGhostRooms.onclick();
    t(Ln.calls.some(c => c[0] === 'closeAllRooms') && Ln.calls.some(c => c[0] === 'cleanGhostRooms'), '다시 대입된 isAdmin(true)을 읽고 — «종료» 면 방 종료 · 유령 방 청소');
    st.cfg = { animalUnlockLevel: 80, other: 'y' };
    e.lcGameCfg.onclick();
    t(String(e.gameCfgAnimalLv.value) === '80', '게임 설정 창 — 지금 서버 값(다시 대입된 뒤)을 보여 준다');
    e.gameCfgAnimalLv.value = '1000'; await e.gameCfgSaveBtn.onclick();
    t(!Ln.calls.some(c => c[0] === 'publishGameConfig'), '게임 설정 — 1~999 밖이면 안 저장');
    e.gameCfgAnimalLv.value = '33'; await e.gameCfgSaveBtn.onclick();
    const g = Ln.calls.find(c => c[0] === 'publishGameConfig');
    t(g && g[1].animalUnlockLevel === 33 && g[1].other === 'y', '게임 설정 — 지금 설정에 합쳐 저장(다른 칸 유지)');
    e.adBannerImgInput0.value = ' https://a/x.png '; e.adBannerLinkInput0.value = 'https://a'; e.adBannerImgInput1.value = ''; e.adBannerImgInput2.value = '';
    e.adBannerSaveBtn.onclick();
    const pb = Ln.calls.find(c => c[0] === 'publishAdBanner');
    t(pb && pb[1].length === 1 && pb[1][0].img === 'https://a/x.png' && JSON.parse(Ln.store['tw.adBanner']).length === 1 && banners === 1, '광고 배너 — 빈 칸 빼고 저장 · 서버 게시 · 다시 그리기');
  }
  /* 3. app.js 연결 */
  const A = strip(app);
  t(!/bindTotalStats|getAdminStats\(|inviteGrantAll|closeAllRooms\(|cleanGhostRooms\(|publishGameConfig\(|publishAdBanner\(|'lcAdBannerEdit'/.test(A), 'app.js 에 옮긴 본문이 남지 않았다');
  t(['function _applyGameCfg(cfg)', 'subscribeAdBanner(', 'function refreshAdBanner()'].every(x => A.includes(x) || ADB.includes(x)) && (/\(function bindInviteUI\(\)\{/.test(A) || /\(function bindInviteUI\(\)\{/.test(LGATE)),
    '사용자 쪽(게임 설정 구독 · 배너 그리기 · 서버 배너 구독 · 초대 창 — 초대 창은 license-gate.js)은 관리자 모듈 밖에 남았다');
  t(/const ADMIN_USERS_OFF = \{\};/.test(app) && /const ADMIN_LAUNCHER_OFF = \{\};/.test(app), '모듈이 없으면 빈 껍데기 둘');
  const block = (name) => ((app.match(new RegExp('const ' + name + ' = \\(typeof \\w+ === \'undefined\'\\) \\? \\w+ : \\w+\\.create\\w+\\(\\{\\n([\\s\\S]*?)\\n\\s*\\}\\);')) || [])[1] || '')
    .split('\n').map(l => l.trim()).filter(Boolean);
  const du = block('adminUsers'), dl = block('adminLauncher');
  t(/^toast: \(\.\.\.a\)=>toast\(\.\.\.a\),\|inviteGrantMax: (?:licenseGateMod\.)?INVITE_GRANT_MAX,$/.test(du.join('|')), 'deps — 통계 · 초대권: toast · INVITE_GRANT_MAX(초대장 모듈이 내놓는 상수)');
  t(dl.length === 6 && dl.includes('isAdmin: ()=>isAdmin,') && (dl.includes('gameCfg: ()=>_gameCfg,') || dl.includes('gameCfg: ()=>adBannerMod._gameCfg(),')) && (dl.includes('adBannerKey: AD_BANNER_KEY,') || dl.includes('adBannerKey: adBannerMod.AD_BANNER_KEY,')),
    'deps — 런처 도구 여섯 · isAdmin · _gameCfg 는 읽는 함수(다시 대입되는 let)');
  /* 만드는 줄은 초대장 모듈(license-gate.js) 만드는 줄 바로 뒤 — 사이에 주석 · 빈 껍데기 줄 말고는 없다(부팅 때 초대 창 묶기 직후 한 번 만드는 차례 그대로) */
  const iLG = app.indexOf('const licenseGateMod = '), iLGEnd = iLG >= 0 ? app.indexOf('\n});', iLG) + 4 : -1, iUsers = app.indexOf('const adminUsers =');
  const gap = iLGEnd > 3 && iUsers > iLGEnd ? app.slice(iLGEnd, iUsers).replace(/\/\*[\s\S]*?\*\//g, '').replace(/const ADMIN_USERS_OFF = \{\};.*\n/, '').trim() : '?';
  t(iLG > 0 && gap === '', '통계 · 초대권 만드는 줄은 초대장 모듈 만드는 줄 바로 뒤');
  const iApply = app.indexOf('function _applyGameCfg(cfg)'), iL = app.indexOf('const adminLauncher ='), iSub = app.indexOf('subscribeAdBanner(');
  /* 사용자 쪽이 ad-banner.js 로 갔으면 — 런처 도구 만드는 줄은 그 모듈 만드는 줄 바로 뒤(AD_BANNER_KEY 를 모듈에서 받는다) */
  const iAdb = app.indexOf('TwAdBanner.createAdBanner('), iAdbEnd = iAdb > 0 ? app.indexOf('\n});', iAdb) + 4 : -1;
  const adbGap = iAdbEnd > 3 && iL > iAdbEnd ? app.slice(iAdbEnd, iL).replace(/\/\*[\s\S]*?\*\//g, '').replace(/const ADMIN_LAUNCHER_OFF = \{\};.*\n/, '').trim() : '?';
  t((iApply > 0 && iL > iApply && iL < iSub) || (iApply < 0 && iSub < 0 && adbGap === ''), '런처 도구 만드는 줄은 게임 설정 구독과 서버 배너 구독 사이(원래 자리) — 사용자 쪽을 옮겼으면 그 모듈 만드는 줄 바로 뒤');
  const iA = html.indexOf('<script src="parts/app.js"></script>');
  t(['admin-users', 'admin-launcher'].every(n => { const i = html.indexOf('<script src="parts/admin/' + n + '.js"></script>'); return i > 0 && i < iA; }), 'html — 둘 다 app.js 보다 먼저');
  return r;
}

(async () => {
  const rows = await judgeAll(M, SRC, HTML);
  const heads = { 0: '── 1. 📊 통계 · 🎟️ 초대권 지급', 5: '── 2. 🧰 런처 도구', 13: '── 3. app.js 연결' };
  rows.forEach(([ok, msg], i) => { if(heads[i]) say(heads[i]); chk(ok, msg); });
  say('── 4. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
  const breaks = [
    ['초대권 상한이 안 걸림', { users: s => s.replace('if(_grantN<INVITE_GRANT_MAX){ _grantN++; renderN(); }', '{ _grantN++; renderN(); }') }],
    ['전체 지급이 한 번에', { users: s => s.replace("if(_armed !== 'grant'){ arm('grant', `⚠️ 정말 전체에게 ${_grantN}장씩? (다시 클릭)`); return; }", '') }],
    ['관리자 확인을 값으로 붙잡음', { launcher: s => s.replace('const isAdmin = deps.isAdmin;', 'const isAdmin = ((v)=>()=>v)(deps.isAdmin());') }],
    ['«종료» 확인 빠짐', { launcher: s => s.replace("if(String(typed).trim() !== '종료'){ toast('입력이 일치하지 않아 취소했어요'); return; }", '') }],
    ['게임 설정이 다른 칸을 지움', { launcher: s => s.replace('Object.assign({}, _gameCfg(), { animalUnlockLevel:n })', '{ animalUnlockLevel:n }') }],
    ['배너를 서버에 안 올림', { launcher: s => s.replace('firebaseAPI.publishAdBanner(slides).then(', 'Promise.resolve({ok:true}).then(') }],
    ['html 줄 빠짐', { html: s => s.replace('<script src="parts/admin/admin-launcher.js"></script>', '') }],
    ['app.js 에 본문이 남음', { app: s => s + "\n(function bindTotalStats(){})();" }],
    ['deps 하나 빠짐', { app: s => s.replace(/  gameCfg: \(\)=>(?:adBannerMod\.)?_gameCfg(?:\(\))?,\n/, '') }],
  ];
  for(const [name, f] of breaks){
    const m2 = { users: f.users ? f.users(M.users) : M.users, launcher: f.launcher ? f.launcher(M.launcher) : M.launcher };
    const a2 = f.app ? f.app(SRC) : SRC, h2 = f.html ? f.html(HTML) : HTML;
    const changed = m2.users !== M.users || m2.launcher !== M.launcher || a2 !== SRC || h2 !== HTML;
    let rows2; try{ rows2 = await judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
    chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
  }
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
