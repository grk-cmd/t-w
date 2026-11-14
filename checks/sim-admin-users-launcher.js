/* ═══ 🧰 sim-admin-users-launcher.js — 관리자 5번 모듈 둘 (2026-10-14 신설 · 관리자 코드 admin 폴더 5번) ═══════════════
   app.js 의 관리자 몫 두 덩이를 parts/admin/ 으로 옮겼다. 동작은 그대로여야 한다 — 가짜 DOM 위에서 굴린다.
     admin-users.js    — 📊 전체 통계 · 🎟️ 초대권 지급(사용자 초대 창 bindInviteUI 안쪽에 있던 것)
     admin-launcher.js — 🛑 전체 방 종료 · 🧹 유령 방 청소 · ⚙️ 게임 설정(멈춤) · 📢 광고 배너 편집 (0.13: 방 종료 · 배너는 서버 관리자 API — adminApi)
   ・1절: 통계 · 초대권 — 만들 때 버튼 · 통계 읽기 · 한 명 지급(친추코드 → uid → 장수) · 장수 상한 · 전체 지급은 두 번 눌러야
   ・2절: 런처 도구 — 관리자 아니면 막힘(다시 대입된 isAdmin 을 읽음) · 방 종료는 «종료» 입력 후 서버 · 연타 한 번 · 실패는 오류 번호 · 게임 설정은 멈춤(서버로 안 감) ·
        광고 배너는 열 때 서버에서 받고(받기 전엔 안 열림) 읽은 판으로 저장 · 저장하면 본인 런처 배너를 한 번 받음 · 409 는 다시 받아 채우고 번호 없이 문구 · 이 PC 사본 없음
   ・3절: app.js 연결 — 본문이 안 남음 · 사용자 쪽은 남음 · 빈 껍데기 · deps · 원래 자리(초대 창 안 · 런처 구역) · html
   ・4절: 일부러 깨 보기
   [실행] app.js · desk-companion-prototype.html · admin-users.js · admin-launcher.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
globalThis.TwSafeHtml = require([__dirname, process.cwd()].flatMap(d => ['safe-html.js', 'parts/shared/safe-html.js', 'app/parts/shared/safe-html.js'].map(p => require('path').join(d, p))).find(p => require('fs').existsSync(p)));   // 🛡️ 모듈이 부르는 공용 씻기 — 진짜 파일
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
/* 🎟️ 초대 창(bindInviteUI)은 초대장 구역과 함께 license-gate.js 로 옮겼다(앱 FSD 31번) — 사용자 쪽에 남았는지는 그 파일에서 본다 */
const LGATE = [ 'license-gate.js', 'parts/account/license-gate.js', 'app/parts/account/license-gate.js' ].map(read).find(Boolean) || '';
/* 📢 광고 배너 · ⚙️ 게임 설정의 사용자 쪽(그리기 · 구독)은 ad-banner.js 로 옮겼다(앱 FSD 43번) — 남았는지는 그 파일에서 본다 */
const ADB = [ 'ad-banner.js', 'parts/launcher/ad-banner.js', 'app/parts/launcher/ad-banner.js' ].map(read).find(Boolean) || '';
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
    cleanGhostRooms: rec('cleanGhostRooms', { ok: true, cleaned: 1, failed: 0 }),
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
  const st = { admin: false, shown: [], rooms: { closed: 3, missing: 0 }, banner: { version: 4, slides: [{ img: 'https://a/old.png', link: 'https://a/old' }] }, putErr: null, roomErr: null, fetchErr: null, hold: null, feed: 0 };
  const apiCalls = [];
  const adminApi = {
    ERRORS: { MARK: 1 },
    closeAllRooms: async () => { apiCalls.push(['closeAllRooms']); if(st.hold) await st.hold; if(st.roomErr) throw st.roomErr; return st.rooms; },
    fetchBanner: async () => { apiCalls.push(['fetchBanner']); if(st.fetchErr) throw st.fetchErr; return st.banner; },
    replaceBanner: async (v, slides) => { apiCalls.push(['replaceBanner', v, slides]); if(st.putErr) throw st.putErr; },
  };
  const apiErrors = { notify: (e, table) => { if(!(e && e.code === 'CONCURRENT_UPDATE')) st.shown.push([e && e.code, table && table.MARK]);   /* 409 는 기능 표가 번호 없이(notice null) — admin-api.js ERRORS · sim-admin-api.js */
    return { action: e && e.code === 'CONCURRENT_UPDATE' ? 'refetch' : 'notice' }; } };
  let Ln;
  try{ Ln = build(m.launcher, 'TwAdminLauncher', { asyncPrompt: async () => st.answer, isAdmin: () => st.admin, adminApi, apiErrors, refreshBanner: async () => { st.feed++; } }); }catch(e){ t(false, '런처 도구 모듈을 만들 수 없다 — ' + e.message); }
  if(Ln){
    const e = Ln.els;
    t(['lcCloseAllRooms', 'lcCleanGhostRooms', 'lcGameCfg', 'lcAdBannerEdit', 'adBannerCloseBtn', 'adBannerSaveBtn']
      .every(id => typeof e[id].onclick === 'function') && Ln.out && !Object.keys(Ln.out).length && Ln.calls.length === 0 && !apiCalls.length, '런처 도구 — 만들 때 버튼 여섯 · 빈 반환 · 서버 안 부름');
    st.answer = '종료'; await e.lcCloseAllRooms.onclick(); await e.lcCleanGhostRooms.onclick();
    t(!Ln.calls.length && !apiCalls.length && Ln.toasts.filter(x => /관리자만/.test(x)).length === 2, '관리자 아니면 방 종료 · 유령 방 청소가 막힌다');
    st.admin = true;
    st.answer = '종 료'; await e.lcCloseAllRooms.onclick();
    t(!apiCalls.length, '방 종료 — «종료» 와 다르면 안 한다');
    st.answer = ' 종료 '; await e.lcCloseAllRooms.onclick(); await e.lcCleanGhostRooms.onclick();
    t(apiCalls.filter(c => c[0] === 'closeAllRooms').length === 1 && Ln.calls.some(c => c[0] === 'cleanGhostRooms') && Ln.toasts.includes('방 3개를 종료했어요'),
      '다시 대입된 isAdmin(true)을 읽고 — «종료» 면 서버에 방 종료(닫은 수를 알림) · 유령 방 청소');
    st.roomErr = Object.assign(new Error('x'), { code: 'ROOM_REALTIME_UNAVAILABLE' }); st.shown.length = 0; const nToast = Ln.toasts.length;
    await e.lcCloseAllRooms.onclick();
    t(st.shown.length === 1 && st.shown[0][0] === 'ROOM_REALTIME_UNAVAILABLE' && st.shown[0][1] === 1 && Ln.toasts.length === nToast, '방 종료 실패 — 성공 토스트 없이 오류 번호(기능 표를 넘김)');
    st.roomErr = null;
    let release; st.hold = new Promise(r => { release = r; }); const n0 = apiCalls.filter(c => c[0] === 'closeAllRooms').length;
    const p1 = e.lcCloseAllRooms.onclick(); await new Promise(r => setImmediate(r)); const p2 = e.lcCloseAllRooms.onclick();
    release(); await p1; await p2; st.hold = null;
    t(apiCalls.filter(c => c[0] === 'closeAllRooms').length === n0 + 1, '방 종료 요청 중 한 번 더 눌러도 한 번만 나간다');
    const nBefore = Ln.toasts.length; e.lcGameCfg.onclick();
    t(Ln.toasts.length === nBefore + 1 && /게임 설정/.test(Ln.toasts[nBefore]) && e.gameCfgOverlay.style.display !== 'flex' && !apiCalls.some(c => /Game/.test(c[0])), '게임 설정 — 창을 열지 않고 «서버로 옮기는 중» 안내만(서버 · Firebase 에 안 씀)');
    /* 광고 배너 */
    st.fetchErr = Object.assign(new Error('x'), { code: 'NETWORK' }); st.shown.length = 0;
    await e.lcAdBannerEdit.onclick();
    t(e.adBannerOverlay.style.display !== 'flex' && st.shown.length === 1, '배너 — 못 받으면 창을 안 열고 오류 번호(받기 전에 고치지 못하게)');
    st.fetchErr = null;
    await e.lcAdBannerEdit.onclick();
    t(e.adBannerOverlay.classList.contains('on') && e.adBannerImgInput0.value === 'https://a/old.png' && e.adBannerLinkInput0.value === 'https://a/old' && e.adBannerImgInput1.value === '',
      '배너 — 열 때 서버에서 받아 칸을 채운다(이 PC 사본이 아니라)');
    e.adBannerImgInput0.value = ' https://a/x.png '; e.adBannerLinkInput0.value = 'https://a'; e.adBannerImgInput1.value = ''; e.adBannerImgInput2.value = '';
    await e.adBannerSaveBtn.onclick();
    const pb = apiCalls.find(c => c[0] === 'replaceBanner');
    t(pb && pb[1] === 4 && pb[2].length === 1 && pb[2][0].img === 'https://a/x.png' && pb[2][0].link === 'https://a' && !e.adBannerOverlay.classList.contains('on') && Ln.toasts.includes('배너가 저장됐어요 (1개)'),
      '배너 저장 — 빈 칸 빼고 · 읽은 판(4)을 싣고 · 성공하면 창을 닫는다');
    t(st.feed === 1, '  저장이 성공하면 관리자 본인 런처 배너를 한 번 받는다(서버 «모두에게» 알림은 0~60초 늦다)');
    t(!Object.keys(Ln.store).length, '  이 PC(localStorage)에는 아무것도 남기지 않는다');
    await e.lcAdBannerEdit.onclick(); e.adBannerImgInput0.value = ''; e.adBannerImgInput1.value = ''; e.adBannerImgInput2.value = '';
    await e.adBannerSaveBtn.onclick();
    t(apiCalls.filter(c => c[0] === 'replaceBanner').pop()[2].length === 0 && Ln.toasts.includes('배너가 숨겨졌어요'), '  전부 비우면 빈 목록으로 저장(배너 숨김)');
    await e.lcAdBannerEdit.onclick(); st.putErr = Object.assign(new Error('c'), { code: 'NOTICE_INVALID_URL' }); st.shown.length = 0;
    await e.adBannerSaveBtn.onclick();
    t(e.adBannerOverlay.classList.contains('on') && st.shown.length === 1 && st.shown[0][0] === 'NOTICE_INVALID_URL' && apiCalls.filter(c => c[0] === 'fetchBanner').length === 4 && st.feed === 2, '저장 실패 → 창 · 쓴 글 유지 + 오류 번호(다시 받지 않는다 · 사용자 배너도 안 받는다)');
    st.putErr = Object.assign(new Error('c'), { code: 'CONCURRENT_UPDATE' }); st.banner = { version: 9, slides: [{ img: 'https://b/new.png', link: 'https://b' }] }; st.shown.length = 0;
    const nT = Ln.toasts.length;
    await e.adBannerSaveBtn.onclick();
    t(e.adBannerImgInput0.value === 'https://b/new.png' && apiCalls.filter(c => c[0] === 'fetchBanner').length === 5 && e.adBannerOverlay.classList.contains('on')
      && st.shown.length === 0 && Ln.toasts.slice(nT).join() === '다른 곳에서 바꾼 내용을 받아왔어요', '409 — 덮어쓰지 않고 지금 서버 값으로 다시 채우고 번호 없이 «받아왔어요» 문구(Q10)');
    st.putErr = null; await e.adBannerSaveBtn.onclick();
    t(apiCalls.filter(c => c[0] === 'replaceBanner').pop()[1] === 9, '  다시 채운 뒤 저장은 새 판(9)을 싣는다');
  }
  /* 3. app.js 연결 */
  const A = strip(app);
  t(!/bindTotalStats|getAdminStats\(|inviteGrantAll|closeAllRooms\(|cleanGhostRooms\(|publishGameConfig\(|publishAdBanner\(|'lcAdBannerEdit'/.test(A), 'app.js 에 옮긴 본문이 남지 않았다');
  t(['function _applyGameCfg(cfg)', 'noticeFeed.onChange(', 'function refreshAdBanner()'].every(x => A.includes(x) || ADB.includes(x)) && (/\(function bindInviteUI\(\)\{/.test(A) || /\(function bindInviteUI\(\)\{/.test(LGATE)),
    '사용자 쪽(게임 설정 구독 · 배너 그리기 · 공지 한 판의 배너 받기 · 초대 창 — 초대 창은 license-gate.js)은 관리자 모듈 밖에 남았다');
  t(!/\bADMIN_USERS_OFF\b/.test(app) && !/\bADMIN_LAUNCHER_OFF\b/.test(app), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차)');
  const block = (name) => ((app.match(new RegExp('const ' + name + ' = (?:\\(typeof \\w+ === \'undefined\'\\) \\? \\w+ : )?\\w+\\.create\\w+\\(\\{\\n([\\s\\S]*?)\\n\\s*\\}\\);')) || [])[1] || '')
    .split('\n').map(l => l.trim()).filter(Boolean);
  const du = block('adminUsers'), dl = block('adminLauncher');
  t(/^toast: \(\.\.\.a\)=>toast\(\.\.\.a\),\|inviteGrantMax: (?:licenseGateMod\.)?INVITE_GRANT_MAX,$/.test(du.join('|')), 'deps — 통계 · 초대권: toast · INVITE_GRANT_MAX(초대장 모듈이 내놓는 상수)');
  t(dl.length === 6 && dl.includes('isAdmin: ()=>isAdmin,') && dl.includes('adminApi: adminApi,') && dl.includes('apiErrors: TwApiErrors.store,') && dl.includes('refreshBanner: ()=>noticeFeed.refresh(),'),
    'deps — 런처 도구 여섯 · isAdmin 은 읽는 함수(다시 대입되는 let) · adminApi · apiErrors · refreshBanner(저장 뒤 배너 받기)');
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
  const heads = { 0: '── 1. 📊 통계 · 🎟️ 초대권 지급', 5: '── 2. 🧰 런처 도구', 20: '── 3. app.js 연결' };
  rows.forEach(([ok, msg], i) => { if(heads[i]) say(heads[i]); chk(ok, msg); });
  say('── 4. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
  const breaks = [
    ['초대권 상한이 안 걸림', { users: s => s.replace('if(_grantN<INVITE_GRANT_MAX){ _grantN++; renderN(); }', '{ _grantN++; renderN(); }') }],
    ['전체 지급이 한 번에', { users: s => s.replace("if(_armed !== 'grant'){ arm('grant', `⚠️ 정말 전체에게 ${_grantN}장씩? (다시 클릭)`); return; }", '') }],
    ['관리자 확인을 값으로 붙잡음', { launcher: s => s.replace('const isAdmin = deps.isAdmin;', 'const isAdmin = ((v)=>()=>v)(deps.isAdmin());') }],
    ['«종료» 확인 빠짐', { launcher: s => s.replace("if(String(typed).trim() !== '종료'){ toast('입력이 일치하지 않아 취소했어요'); return; }", '') }],
    ['방 종료를 Firebase 로 되돌림', { launcher: s => s.replace('await adminApi.closeAllRooms();', 'await firebaseAPI.closeAllRooms();') }],
    ['방 종료 연타 잠금 없음', { launcher: s => s.replace('if(closing) return;', '') }],
    ['방 종료 실패를 성공처럼', { launcher: s => s.replace('}catch(e){ fail(e); }\n      finally{ closing = false; }', '}catch(e){ toast(`방 0개를 종료했어요`); }\n      finally{ closing = false; }') }],
    ['게임 설정 창이 다시 열림', { launcher: s => s.replace("_btn.onclick = ()=>{ toast(GAME_CFG_PAUSED_TEXT); };", "_btn.onclick = ()=>{ toast(GAME_CFG_PAUSED_TEXT); const o=document.getElementById('gameCfgOverlay'); o.style.display='flex'; };") }],
    ['배너를 이 PC 에 남김', { launcher: s => s.replace("bannerVersion = b.version;", "bannerVersion = b.version; localStorage.setItem('tw.adBanner', '1');") }],
    ['배너 저장에 판을 안 실음', { launcher: s => s.replace('adminApi.replaceBanner(bannerVersion, slides)', 'adminApi.replaceBanner(0, slides)') }],
    ['배너 못 받아도 창을 엶', { launcher: s => s.replace("    await loadBanner();\n    const o=$('adBannerOverlay');", "    try{ await loadBanner(); }catch(_){}\n    const o=$('adBannerOverlay');") }],
    ['배너 저장 뒤 사용자 배너를 안 받음', { launcher: s => s.replace("try{ Promise.resolve(refreshBanner()).catch(()=>{}); }catch(_){}", '') }],
    ['배너 409 에 문구 없음', { launcher: s => s.replace("await loadBanner(); toast('다른 곳에서 바꾼 내용을 받아왔어요');", 'await loadBanner();') }],
    ['배너 409 에 다시 안 받음', { launcher: s => s.replace("if(t.action === 'refetch'){", "if(false){") }],
    ['배너 저장 실패해도 창을 닫음', { launcher: s => s.replace("  }catch(e){\n    const t = fail(e);", "  }catch(e){\n    closeBanner();\n    const t = fail(e);") }],
    ['배너 기능 표를 안 넘김', { launcher: s => s.replace("const fail = (e)=>apiErrors.notify(e, adminApi.ERRORS);", "const fail = (e)=>apiErrors.notify(e);") }],
    ['html 줄 빠짐', { html: s => s.replace('<script src="parts/admin/admin-launcher.js"></script>', '') }],
    ['app.js 에 본문이 남음', { app: s => s + "\n(function bindTotalStats(){})();" }],
    ['deps 하나 빠짐', { app: s => s.replace('  adminApi: adminApi,\n  apiErrors: TwApiErrors.store,\n  refreshBanner', '  apiErrors: TwApiErrors.store,\n  refreshBanner') }],
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
