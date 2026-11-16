/* ═══ 🛠️ sim-admin-api.js — 앱 관리자 서버 길 provider (0.13 앱 묶음 D11-1) ═══
   [왜] 앱 관리자 창의 확성기 · 업데이트 공지 · 런처 배너 · 방 종료 · 관리자 확인이 Firebase 직접 쓰기 대신 서버 관리자 API(/v2/admin/...)를 쓴다.
     요청 모양(경로 · 본문 칸 이름 · 판(version) · 요청 번호)이 서버 계약과 맞아야 하므로 provider 를 실제로 불러 판정한다.
   ・1절: 요청 모양 — 관리자 확인 · 확성기(켜기 140자 · 끄기) · 업데이트 공지(올리기 60 · 800자 · 내리기는 id 로 · 지금 id 는 공지 한 판에서) ·
        배너(읽기 → 화면 모양 · 저장은 읽은 판 + imageUrl · linkUrl) · 방 종료({all:true} → 닫은 방 수)
   ・2절: 요청 번호 — 닿지 못하면 같은 번호 · 서버가 답했으면 버림 / 모양 틀림은 던짐 / 실패는 그대로 던짐(빈 값으로 숨기지 않음)
   ・3절: 오류 표 — 서버 code 마다 오류 번호 · 진짜 api-errors.js 로 번역(409 는 다시 받기)
   ・4절: 배선 — html 순서 · smoke · app.js 가 로그인 통로로 만듦 · 걷은 Firebase 관리자 쓰기가 firebase-init 에 없음
   ・5절: 일부러 깨 보기
   [실행] 러너 스테이징(평면)에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find(Boolean);
const SRC0 = {
  API: pick(['admin-api.js', 'parts/admin/admin-api.js', 'app/parts/admin/admin-api.js']),
  ERRS: pick(['api-errors.js', 'parts/shared/api-errors.js', 'app/parts/shared/api-errors.js']),
  CODES: pick(['error-codes.js', 'parts/shared/error-codes.js', 'app/parts/shared/error-codes.js']),
  FI: pick(['firebase-init.js', 'parts/firebase-init.js', 'app/parts/firebase-init.js']),
  APP: pick(['app.js', 'parts/app.js', 'app/parts/app.js']),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
  SMOKE: pick(['smoke.js']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const load = (src) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w.TwAdminApi; };
const loadErrors = (src) => { const m = { exports: {} }; new Function('window', 'module', src)(undefined, m); return m.exports; };
const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');

const apiErr = (status, code) => Object.assign(new Error(code || String(status)), { status, code: code || '', kind: status >= 500 ? 'unavailable' : (status === 401 || status === 403 ? 'auth' : 'request') });

function mk(src, o){
  const log = [], settled = [];
  const call = (m) => async (path, a) => {
    log.push([m === 'del' ? 'DELETE' : m.toUpperCase(), path, m === 'del' || m === 'get' ? undefined : a]);
    if(m === 'del' || m === 'get') log[log.length - 1][3] = a;
    const r = o[m]; const v = typeof r === 'function' ? r(path, a) : r;
    if(v instanceof Error) throw v;
    return v;
  };
  const ids = { n: 0, idFor: (k) => 'req-' + k.length + '-' + (o.sameId ? 1 : ++ids.n), settle: (k) => settled.push(k) };
  const board = o.board || { updateNotice: { id: 'u-7', title: '제목', body: '본문', ts: 5 } };
  const m = load(src).createAdminApi({ authed: { get: call('get'), post: call('post'), put: call('put'), patch: call('patch'), del: call('del') }, pending: ids, errs: o.errs,
    fetchBoard: async () => { log.push(['BOARD']); if(board instanceof Error) throw board; return board; } });
  return { m, log, settled };
}

async function judge(S){
  const LIB = S.API;

  say('── 1. 요청 모양');
  {
    const t = mk(LIB, { get: { name: '관리자', grantedAt: 'x', version: 4 } });
    const me = await t.m.me();
    chk(t.log[0][0] === 'GET' && t.log[0][1] === '/v2/admin/admins/me' && me.name === '관리자' && me.version === 4, '관리자 확인 — GET /v2/admin/admins/me → { name, version }');
    chk(await mk(LIB, { get: { name: null, version: 1 } }).m.me().then((x) => x.name === ''), '  이름이 없어도(null) 확인은 통한다');

    const a = mk(LIB, { post: null, del: null });
    await a.m.announce('가'.repeat(200));
    const ap = a.log[0];
    chk(ap[0] === 'POST' && ap[1] === '/v2/admin/notices/announcements' && ap[2].text.length === 140 && /^req-/.test(ap[2].requestId) && Object.keys(ap[2]).sort().join() === 'requestId,text',
      '확성기 켜기 — POST …/announcements { requestId, text≤140 } (켜는 시간은 서버가 정하니 앱이 안 보낸다)');
    await a.m.clearAnnouncement();
    chk(a.log[1][0] === 'DELETE' && a.log[1][1] === '/v2/admin/notices/announcements/current', '확성기 끄기 — DELETE …/announcements/current');

    const u = mk(LIB, { post: null, del: null });
    const noId = await u.m.publishUpdateNotice('t'.repeat(70), 'b'.repeat(900));
    const up = u.log[0];
    chk(up[1] === '/v2/admin/notices/update-notices' && up[2].title.length === 60 && up[2].body.length === 800 && /^req-/.test(up[2].requestId) && Object.keys(up[2]).sort().join() === 'body,requestId,title',
      '업데이트 공지 올리기 — POST …/update-notices { requestId, title≤60, body≤800 }');
    const withId = mk(LIB, { post: { id: 'n-7', title: 't', body: 'b', publishedAt: '2026-11-01T00:00:00Z' }, del: null });
    chk(await withId.m.publishUpdateNotice('t', 'b') === 'n-7' && noId === null, '  올리기가 응답의 새 공지 id 를 돌려준다(없으면 null — 이미 올라갔으니 던지지 않는다)');
    const cur = await u.m.currentUpdateNotice();
    chk(u.log[1][0] === 'BOARD' && cur.id === 'u-7' && cur.title === '제목', '지금 업데이트 공지 — 공지 한 판에서 id 를 받는다');
    chk(await mk(LIB, { board: { updateNotice: null } }).m.currentUpdateNotice() === null, '  공지가 없으면 null(실패가 아니라 «없음»)');
    chk(await mk(LIB, { board: { updateNotice: { id: '', title: 'x', body: 'y', ts: 1 } } }).m.currentUpdateNotice() === null, '  id 가 비면 내릴 수 없으니 null');
    let bt = null; try{ await mk(LIB, { board: apiErr(503, 'X') }).m.currentUpdateNotice(); }catch(e){ bt = e; }
    chk(bt && bt.status === 503, '  못 받으면 던진다(없음으로 숨기지 않는다)');
    await u.m.withdrawUpdateNotice('a/b');
    chk(u.log[2][0] === 'DELETE' && u.log[2][1] === '/v2/admin/notices/update-notices/a%2Fb', '업데이트 공지 내리기 — DELETE …/update-notices/{id} (id 로 — «지금 것» 이 아니다)');

    const b = mk(LIB, { get: { version: 6, slides: [{ imageUrl: 'https://x/a.png', linkUrl: 'https://x/l' }, null] }, put: null });
    const bn = await b.m.fetchBanner();
    chk(b.log[0][1] === '/v2/admin/notices/launcher-banner' && bn.version === 6 && bn.slides.length === 1 && bn.slides[0].img === 'https://x/a.png' && bn.slides[0].link === 'https://x/l',
      '배너 읽기 — GET …/launcher-banner → { version, slides:[{ img, link }] }');
    await b.m.replaceBanner(6, [{ img: 'https://x/a.png', link: 'https://x/l' }]);
    chk(b.log[1][0] === 'PUT' && b.log[1][1] === '/v2/admin/notices/launcher-banner' && JSON.stringify(b.log[1][2]) === '{"version":6,"slides":[{"imageUrl":"https://x/a.png","linkUrl":"https://x/l"}]}',
      '배너 저장 — PUT { version(읽은 판), slides:[{ imageUrl, linkUrl }] }');
    await b.m.replaceBanner(7, []);
    chk(JSON.stringify(b.log[2][2]) === '{"version":7,"slides":[]}', '  빈 목록 = 배너 숨기기');

    const r = mk(LIB, { post: { closed: ['A1', 'B2'], missing: ['C3'] } });
    const cr = await r.m.closeAllRooms();
    chk(r.log[0][0] === 'POST' && r.log[0][1] === '/v2/admin/rooms/close' && JSON.stringify(r.log[0][2]) === '{"all":true}' && cr.closed === 2 && cr.missing === 1,
      '방 종료 — POST /v2/admin/rooms/close { all:true } → 닫은 방 수 · 이미 없던 방 수');
  }

  say('── 2. 요청 번호 · 실패');
  {
    const t = mk(LIB, { post: null });
    await t.m.announce('점검');
    chk(t.settled.length === 1, '서버가 답했으니 요청 번호를 버린다(같은 글을 또 보내면 새 번호)');
    const net = mk(LIB, { post: new Error('NETWORK'), sameId: true });
    let e1 = null; try{ await net.m.announce('점검'); }catch(e){ e1 = e; }
    chk(e1 && net.settled.length === 0, '닿지 못하면 던지고 번호를 남긴다(다시 눌러도 같은 번호 — 두 번 켜지지 않게)');
    const rej = mk(LIB, { post: apiErr(400, 'INVALID_REQUEST') });
    let e2 = null; try{ await rej.m.publishUpdateNotice('a', 'b'); }catch(e){ e2 = e; }
    chk(e2 && e2.code === 'INVALID_REQUEST' && rej.settled.length === 1, '서버가 거절했으면 그대로 던지고 번호는 버린다(고쳐 다시 보내면 새 번호)');
    for(const [what, bad] of [['방 종료', { post: { closed: 'x', missing: [] } }], ['방 종료', { post: null }], ['배너', { get: { version: 'x', slides: [] } }], ['배너', { get: { slides: [] } }], ['배너', { get: null }], ['관리자 확인', { get: null }]]){
      const x = mk(LIB, bad); let er = null;
      try{ await (what === '방 종료' ? x.m.closeAllRooms() : what === '배너' ? x.m.fetchBanner() : x.m.me()); }catch(e){ er = e; }
      chk(er && er.code === 'SHAPE', what + ' — 모양이 틀린 응답(' + JSON.stringify(bad) + ')은 던진다');
    }
    const down = mk(LIB, { get: apiErr(403, 'ACCESS_DENIED') });
    let e3 = null; try{ await down.m.me(); }catch(e){ e3 = e; }
    chk(e3 && e3.status === 403 && e3.code === 'ACCESS_DENIED', '관리자가 아니면 403 ACCESS_DENIED 를 그대로 던진다');
  }

  say('── 2-2. 라이선스 · 대기 요청 · 통계 · 초대권 (D11-3)');
  {
    const item = { licenseId: 'L1', key: 'AAAA-BBBB', status: 'VALID', note: '메모', ownerUserCode: 'u1', ownerName: '말랑', firstRedeemedAt: '2026-11-01T00:00:00Z', version: 7, devices: [] };
    const a = mk(LIB, { get: { items: [item], nextCursor: 'c2', total: 41 } });
    const pg = await a.m.listLicenses({ q: 'a b', cursor: 'c1' });
    chk(a.log[0][0] === 'GET' && a.log[0][1] === '/v2/admin/licenses?q=a%20b&cursor=c1' && pg.total === 41 && pg.next === 'c2' && pg.items[0].id === 'L1' && pg.items[0].used === true && pg.items[0].version === 7,
      '키 목록 — GET /v2/admin/licenses?q&cursor(검색 · 쪽 · 총 수는 서버) → 화면 줄(id · 판 · 사용됨)');
    chk(await mk(LIB, { get: { items: [{ key: 'x' }] } }).m.listLicenses({}).then(() => false, (e) => e.code === 'SHAPE'), '  모양이 틀리면 던진다(빈 목록으로 보이지 않는다)');
    const b = mk(LIB, { post: [{ friendCode: 'MATE-9K2M', ok: true, code: null, licenseId: 'L2', key: 'KKKK' }] });
    const iss = await b.m.issueLicenses([{ friendCode: 'MATE-9K2M', note: 'n'.repeat(150) }], true);
    chk(b.log[0][0] === 'POST' && b.log[0][1] === '/v2/admin/licenses' && /^req-/.test(b.log[0][2].requestId) && b.log[0][2].reissue === true && b.log[0][2].grants[0].friendCode === 'MATE-9K2M' && b.log[0][2].grants[0].note.length === 100
      && iss[0].key === 'KKKK' && iss[0].ok === true && !('key' in b.log[0][2].grants[0]), '발급 — POST /v2/admin/licenses { requestId, grants, reissue } · 메모 100자 · 키는 서버가 돌려준다(앱이 만들지 않는다)');
    chk(await mk(LIB, {}).m.issueLicenses([], false).then(() => false, (e) => e.code === 'INVALID_REQUEST') && await mk(LIB, {}).m.issueLicenses(new Array(501).fill({}), false).then(() => false, (e) => e.code === 'INVALID_REQUEST'), '  줄 0개 · 501개는 요청 없이 던진다(상한 500)');
    const c = mk(LIB, { post: apiErr(503, 'X') });
    await c.m.issueLicenses([{}], false).catch(() => {});
    chk(c.settled.length === 1, '  서버가 답했으면 요청 번호를 버린다');
    const c2 = mk(LIB, { post: Object.assign(new Error('n'), { kind: 'unavailable' }) });
    await c2.m.issueLicenses([{}], false).catch(() => {});
    chk(c2.settled.length === 0, '  닿지 못했으면 번호를 남긴다 — 다시 누르면 같은 번호');
    const d = mk(LIB, { post: [{ friendCode: 'MATE-9K2M', found: true, name: '말랑', hasValidLicense: true }, { friendCode: 'COZY-9K2M', found: false, hasValidLicense: false }] });
    const pv = await d.m.previewLicenses(['MATE-9K2M', 'COZY-9K2M']);
    chk(d.log[0][1] === '/v2/admin/licenses/preview' && d.log[0][2].friendCodes.length === 2 && pv[0].found && pv[0].name === '말랑' && pv[0].hasValid && !pv[1].found, '엑셀 미리보기 — POST …/licenses/preview { friendCodes } → 있는 사람 · 이름 · 이미 유효한 키(서버 판정)');
    const e1 = mk(LIB, { patch: null, del: null });
    await e1.m.revokeLicense('L1', 7); await e1.m.deleteLicense('L1', 7);
    chk(e1.log[0][0] === 'PATCH' && e1.log[0][1] === '/v2/admin/licenses/L1' && e1.log[0][2].version === 7 && e1.log[0][2].status === 'REVOKED' && e1.log[1][0] === 'DELETE' && e1.log[1][1] === '/v2/admin/licenses/L1?version=7',
      '회수 — PATCH …/{licenseId} { version, status } · 삭제 — DELETE …/{licenseId}?version= (키 원문은 경로에 없다)');
    const f = mk(LIB, { get: { items: [{ id: 'R1', requesterUserCode: 'u9', name: '요청자', createdAt: 'x' }], nextCursor: null }, post: null });
    const rq = await f.m.pendingRequests(null);
    await f.m.approveRequest('R1'); await f.m.rejectRequest('R2');
    chk(f.log[0][1] === '/v2/admin/license-requests' && rq.items[0].id === 'R1' && rq.items[0].name === '요청자' && f.log[1][1] === '/v2/admin/license-requests/R1/approve' && f.log[2][1] === '/v2/admin/license-requests/R2/reject', '대기 요청 — GET …/license-requests · POST …/{id}/approve · reject');
    const g = mk(LIB, { post: [{ id: 'R1', ok: true }, { id: 'R2', ok: false, code: 'LICENSE_REQUEST_NOT_FOUND' }] });
    const ba = await g.m.approveRequests(['R1', 'R2']);
    chk(g.log[0][1] === '/v2/admin/license-requests/bulk-approve' && g.log[0][2].ids.join() === 'R1,R2' && ba[1].ok === false && ba[1].code === 'LICENSE_REQUEST_NOT_FOUND', '일괄 승인 — POST …/bulk-approve { ids } → 줄마다 ok · 까닭');
    const h = mk(LIB, { get: { users: 12, premiumUsers: 3, licenses: { valid: 4, used: 2 } } });
    const tt = await h.m.totals();
    chk(h.log[0][1] === '/v2/admin/metrics/totals' && tt.users === 12 && tt.premiumUsers === 3 && tt.licValid === 4 && tt.licUsed === 2, '통계 — GET /v2/admin/metrics/totals(서버 총계 · 앱이 세지 않는다)');
    const i = mk(LIB, { post: { changed: 1, invitesLeft: 5 } });
    const gi = await i.m.grantInvites('MATE-9K2M', 2); const ri = await i.m.revokeInvites('all', '2026-07-18T00:00:00Z');
    chk(i.log[0][1] === '/v2/admin/invite-quotas/grants' && /^req-/.test(i.log[0][2].requestId) && i.log[0][2].target === 'MATE-9K2M' && i.log[0][2].n === 2 && gi.left === 5
      && i.log[1][1] === '/v2/admin/invite-quotas/revocations' && i.log[1][2].target === 'all' && i.log[1][2].joinedSince === '2026-07-18T00:00:00Z' && !('requestId' in i.log[1][2]) && ri.changed === 1, '초대권 — POST …/invite-quotas/grants { requestId, target, n } · …/revocations { target, joinedSince? } (사람 찾기는 서버)');
    chk(await mk(LIB, {}).m.grantInvites('', 1).then(() => false, (e) => e.code === 'INVALID_REQUEST') && await mk(LIB, {}).m.grantInvites('x', 0).then(() => false, (e) => e.code === 'INVALID_REQUEST'), '  대상 없음 · 0장은 요청 없이 던진다');
    const AE = loadErrors(S.ERRS);
    const fo = (code, status) => mk(LIB, { errs: { translate: AE.createApiErrors({ notifyError: () => true }).translate, COMMON: AE.COMMON } }).m.failOf(Object.assign(new Error(code), { code, status, kind: 'request' }));
    chk(fo('CONCURRENT_UPDATE', 409) === 'refetch' && fo('LICENSE_NOT_FOUND', 404) === 'refetch' && fo('LICENSE_REQUEST_NOT_FOUND', 404) === 'refetch' && fo('TOO_MANY_REQUESTS', 429) === 'common' && fo('ACCESS_DENIED', 403) === 'notice' && fo('SOMETHING_ELSE', 400) === 'site',
      '실패 갈래 — 판이 달라짐 · 이미 없음 = refetch · 공통 code = common · 이 기능 표 = notice · 그 밖 = site');
  }

  say('── 3. 오류 표');
  {
    const api = load(S.API), AE = loadErrors(S.ERRS);
    const want = { ACCESS_DENIED: 'E-ADM-05', NOTICE_INVALID_URL: 'E-ADM-01', NOTICE_TOO_MANY_SLIDES: 'E-ADM-02', NOTICE_NOT_FOUND: 'E-ADM-03', ROOM_REALTIME_UNAVAILABLE: 'E-ADM-04' };
    const shown = [];
    const store = AE.createApiErrors({ notifyError: (c) => { shown.push(c); return true; } });
    for(const [code, num] of Object.entries(want)){
      shown.length = 0;
      const t = store.notify(Object.assign(new Error(code), { code, kind: code === 'ROOM_REALTIME_UNAVAILABLE' ? 'unavailable' : 'request', status: 400 }), api.ERRORS);
      chk(shown.join() === num && t.action === 'notice', code + ' → ' + num + '(공통 표보다 먼저 — 5xx 로 와도 code 로 가른다)');
    }
    shown.length = 0;
    const t409 = store.notify(Object.assign(new Error('c'), { code: 'CONCURRENT_UPDATE', kind: 'request', status: 409 }), api.ERRORS);
    chk(t409.action === 'refetch' && shown.length === 0, '409 CONCURRENT_UPDATE → 다시 받기 · 번호 없음(부르는 쪽이 «받아왔어요» 문구 — 기능 표가 공통 E-NET-05 를 덮는다)');
    shown.length = 0;
    const net = store.notify(Object.assign(new Error('n'), { code: 'NETWORK', kind: 'unavailable', status: 0 }), api.ERRORS);
    chk(net.action === 'offline' && shown.join() === 'E-NET-07', '닿지 못함은 공통 표 그대로');
    const CODES = loadErrors(S.CODES).CODES;
    chk(Object.values(want).every((n) => CODES[n] && CODES[n].msg), '표의 번호가 error-codes.js 표에 문구와 함께 있다');
  }

  say('── 4. 배선');
  {
    const h = S.HTML, tag = (f) => h.indexOf('<script src="parts/' + f + '"></script>');
    chk(tag('admin/admin-api.js') > 0 && tag('admin/admin-api.js') < tag('admin/admin-notice.js') && tag('admin/admin-api.js') < tag('admin/admin-launcher.js') && tag('admin/admin-api.js') < tag('admin/admin-mode.js') && tag('admin/admin-api.js') < tag('app.js'),
      'html — admin-api.js 가 쓰는 관리자 모듈들 · app.js 보다 먼저');
    chk(/PRELOAD\.push\('admin-api\.js'\)/.test(S.SMOKE), 'smoke PRELOAD');
    const A = strip(S.APP);
    chk(/const adminApi = TwAdminApi\.createAdminApi\(\{ authed: TwApi\.authed, pending: TwRequestId\.createPending\(\), fetchBoard: \(\)=>noticeApi\.fetchBoard\(\), errs: TwApiErrors \}\);/.test(A), 'app.js — 로그인 통로(authed) · 요청 번호 · 공지 한 판 읽기 · 공통 오류 표를 넘겨 만든다');
    const FI = strip(S.FI);
    chk(!/\b(publishAnnounce|clearAnnounce|publishUpdateNotice|clearUpdateNotice|getUpdateNotice|publishAdBanner|publishGameConfig|closeAllRooms)\s*\(/.test(FI), 'firebase-init 에 걷은 관리자 쓰기(확성기 · 업데이트 공지 · 배너 · 게임 설정 · 방 종료)가 없다');
    chk(!/\bfirebaseAPI\.(publishAnnounce|clearAnnounce|publishUpdateNotice|clearUpdateNotice|getUpdateNotice|publishAdBanner|publishGameConfig|closeAllRooms)\b/.test(A), 'app.js 가 걷은 Firebase 관리자 쓰기를 안 부른다');
    chk(/subscribeGameConfig\s*\(/.test(FI), '  게임 설정 읽기(subscribeGameConfig)는 남았다 — 사용자 앱이 아직 거기서 읽는다');
  }
}

async function runAll(){
  const S = SRC0;
  await judge(S);
  say('── 5. 일부러 깨 보기');
  const breaks = [
    ['발급에 요청 번호 없음', { API: S.API.replace("{ requestId, grants: body, reissue: !!reissue }", "{ grants: body, reissue: !!reissue }") }, 'requestId'],
    ['회수에 판 안 실음', { API: S.API.replace("{ version, status: 'REVOKED' }", "{ status: 'REVOKED' }") }, 'version'],
    ['삭제 판을 경로에', { API: S.API.replace("'?version=' + encodeURIComponent(version)", "''") }, '삭제 — DELETE'],
    ['메모 상한 없음', { API: S.API.replace(".slice(0, LIMITS.LICENSE_NOTE)", "") }, '메모 100자'],
    ['통계를 앱이 셈', { API: S.API.replace("licValid: num(d.licenses.valid)", "licValid: 0") }, '통계'],
    ['초대권 회수에 요청 번호', { API: S.API.replace("const body = { target: t };", "const body = { target: t, requestId: 'x' };") }, 'revocations'],
    ['확성기 상한 없음', { API: S.API.replace(".slice(0, LIMITS.ANNOUNCE)", "") }, '≤140'],
    ['확성기에 켜는 시간을 실음', { API: S.API.replace("{ requestId, text: t }", "{ requestId, text: t, duration: 60000 }") }, '켜는 시간'],
    ['공지 제목 상한 없음', { API: S.API.replace(".slice(0, LIMITS.UPDATE_TITLE)", "") }, 'title≤60'],
    ['요청 번호 없이 올림', { API: S.API.replace("{ requestId, title: t, body: b }", "{ title: t, body: b }") }, 'requestId'],
    ['내리기를 «지금 것» 으로', { API: S.API.replace("encodeURIComponent(id)", "'current'") }, 'id 로'],
    ['공지 id 를 못 받음', { API: S.API.replace("return (u && u.id) ? { id: u.id, title: u.title, body: u.body, ts: u.ts } : null;", "return u ? { id: '', title: u.title, body: u.body, ts: u.ts } : null;") }, 'id 가 비면'],
    ['배너 저장에 판 안 실음', { API: S.API.replace("{ version, slides: slides.map(", "{ slides: slides.map(") }, '읽은 판'],
    ['배너 칸 이름이 옛 모양', { API: S.API.replace("({ imageUrl: s.img, linkUrl: s.link })", "({ img: s.img, link: s.link })") }, 'imageUrl'],
    ['배너 읽기에서 칸 이름 안 맞춤', { API: S.API.replace("img: str(s.imageUrl), link: str(s.linkUrl)", "img: str(s.img), link: str(s.link)") }, '화면 모양'],
    ['방 종료가 전체가 아님', { API: S.API.replace("{ all: true }", "{ all: false }") }, 'all:true'],
    ['방 종료 수를 목록 그대로', { API: S.API.replace("closed: d.closed.length", "closed: d.closed") }, '닫은 방 수'],
    ['모양 틀림을 빈 값으로', { API: S.API.replace("if(!out) throw shapeError();\n    return out;", "return out || { version: 0, slides: [] };") }, '모양이 틀린'],
    ['거절돼도 번호 유지', { API: S.API.replace("if(e && e.status) ids.settle(key); throw e;", "throw e;") }, '번호는 버린다'],
    ['닿지 못해도 번호 버림', { API: S.API.replace("if(e && e.status) ids.settle(key); throw e;", "ids.settle(key); throw e;") }, '번호를 남긴다'],
    ['ACCESS_DENIED 가 공통 번호로', { API: S.API.replace("'E-ADM-05'", "'E-NET-02'") }, 'E-ADM-05'],
    ['걷은 Firebase 쓰기가 남음', { FI: S.FI + "\n    async publishAnnounce(text){ return 1; }," }, '걷은 관리자 쓰기'],
    ['html 순서 틀림', { HTML: S.HTML.replace('<script src="parts/admin/admin-api.js"></script>', '') }, 'html'],
  ];
  for(const [name, over, what] of breaks){
    const key = Object.keys(over)[0];
    if(over[key] === S[key]){ chk(false, name + ' — 바꿀 글을 못 찾음'); continue; }
    quiet = true; qfail = 0;
    try{ await judge(Object.assign({}, S, over)); }catch(_){ qfail++; }
    quiet = false;
    chk(qfail > 0, name + ' → 빨강(' + what + ')');
  }
  say('\n통과 ' + pass + ' · 실패 ' + fail);
  process.exit(fail ? 1 : 0);
}
runAll();
