/* ═══ 🛠️ sim-admin-api.js — 앱 관리자 서버 길 provider (0.13 앱 묶음 D11-1) ═══
   [왜] 앱 관리자 창의 확성기 · 업데이트 공지 · 런처 배너 · 방 종료 · 관리자 확인이 Firebase 직접 쓰기 대신 서버 관리자 API(/v1/admin/...)를 쓴다.
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
    const r = o[m]; const v = typeof r === 'function' ? r(path, a) : r;
    if(v instanceof Error) throw v;
    return v;
  };
  const ids = { n: 0, idFor: (k) => 'req-' + k.length + '-' + (o.sameId ? 1 : ++ids.n), settle: (k) => settled.push(k) };
  const board = o.board || { updateNotice: { id: 'u-7', title: '제목', body: '본문', ts: 5 } };
  const m = load(src).createAdminApi({ authed: { get: call('get'), post: call('post'), put: call('put'), del: call('del') }, pending: ids,
    fetchBoard: async () => { log.push(['BOARD']); if(board instanceof Error) throw board; return board; } });
  return { m, log, settled };
}

async function judge(S){
  const LIB = S.API;

  say('── 1. 요청 모양');
  {
    const t = mk(LIB, { get: { name: '관리자', grantedAt: 'x', version: 4 } });
    const me = await t.m.me();
    chk(t.log[0][0] === 'GET' && t.log[0][1] === '/v1/admin/admins/me' && me.name === '관리자' && me.version === 4, '관리자 확인 — GET /v1/admin/admins/me → { name, version }');
    chk(await mk(LIB, { get: { name: null, version: 1 } }).m.me().then((x) => x.name === ''), '  이름이 없어도(null) 확인은 통한다');

    const a = mk(LIB, { post: null, del: null });
    await a.m.announce('가'.repeat(200));
    const ap = a.log[0];
    chk(ap[0] === 'POST' && ap[1] === '/v1/admin/notices/announcements' && ap[2].text.length === 140 && /^req-/.test(ap[2].requestId) && Object.keys(ap[2]).sort().join() === 'requestId,text',
      '확성기 켜기 — POST …/announcements { requestId, text≤140 } (켜는 시간은 서버가 정하니 앱이 안 보낸다)');
    await a.m.clearAnnouncement();
    chk(a.log[1][0] === 'DELETE' && a.log[1][1] === '/v1/admin/notices/announcements/current', '확성기 끄기 — DELETE …/announcements/current');

    const u = mk(LIB, { post: null, del: null });
    await u.m.publishUpdateNotice('t'.repeat(70), 'b'.repeat(900));
    const up = u.log[0];
    chk(up[1] === '/v1/admin/notices/update-notices' && up[2].title.length === 60 && up[2].body.length === 800 && /^req-/.test(up[2].requestId) && Object.keys(up[2]).sort().join() === 'body,requestId,title',
      '업데이트 공지 올리기 — POST …/update-notices { requestId, title≤60, body≤800 }');
    const cur = await u.m.currentUpdateNotice();
    chk(u.log[1][0] === 'BOARD' && cur.id === 'u-7' && cur.title === '제목', '지금 업데이트 공지 — 공지 한 판에서 id 를 받는다');
    chk(await mk(LIB, { board: { updateNotice: null } }).m.currentUpdateNotice() === null, '  공지가 없으면 null(실패가 아니라 «없음»)');
    chk(await mk(LIB, { board: { updateNotice: { id: '', title: 'x', body: 'y', ts: 1 } } }).m.currentUpdateNotice() === null, '  id 가 비면 내릴 수 없으니 null');
    let bt = null; try{ await mk(LIB, { board: apiErr(503, 'X') }).m.currentUpdateNotice(); }catch(e){ bt = e; }
    chk(bt && bt.status === 503, '  못 받으면 던진다(없음으로 숨기지 않는다)');
    await u.m.withdrawUpdateNotice('a/b');
    chk(u.log[2][0] === 'DELETE' && u.log[2][1] === '/v1/admin/notices/update-notices/a%2Fb', '업데이트 공지 내리기 — DELETE …/update-notices/{id} (id 로 — «지금 것» 이 아니다)');

    const b = mk(LIB, { get: { version: 6, slides: [{ imageUrl: 'https://x/a.png', linkUrl: 'https://x/l' }, null] }, put: null });
    const bn = await b.m.fetchBanner();
    chk(b.log[0][1] === '/v1/admin/notices/launcher-banner' && bn.version === 6 && bn.slides.length === 1 && bn.slides[0].img === 'https://x/a.png' && bn.slides[0].link === 'https://x/l',
      '배너 읽기 — GET …/launcher-banner → { version, slides:[{ img, link }] }');
    await b.m.replaceBanner(6, [{ img: 'https://x/a.png', link: 'https://x/l' }]);
    chk(b.log[1][0] === 'PUT' && b.log[1][1] === '/v1/admin/notices/launcher-banner' && JSON.stringify(b.log[1][2]) === '{"version":6,"slides":[{"imageUrl":"https://x/a.png","linkUrl":"https://x/l"}]}',
      '배너 저장 — PUT { version(읽은 판), slides:[{ imageUrl, linkUrl }] }');
    await b.m.replaceBanner(7, []);
    chk(JSON.stringify(b.log[2][2]) === '{"version":7,"slides":[]}', '  빈 목록 = 배너 숨기기');

    const r = mk(LIB, { post: { closed: ['A1', 'B2'], missing: ['C3'] } });
    const cr = await r.m.closeAllRooms();
    chk(r.log[0][0] === 'POST' && r.log[0][1] === '/v1/admin/rooms/close' && JSON.stringify(r.log[0][2]) === '{"all":true}' && cr.closed === 2 && cr.missing === 1,
      '방 종료 — POST /v1/admin/rooms/close { all:true } → 닫은 방 수 · 이미 없던 방 수');
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
    chk(t409.action === 'refetch' && shown.join() === 'E-NET-05', '409 CONCURRENT_UPDATE 는 공통 표 그대로 — 다시 받기');
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
    chk(/const adminApi = TwAdminApi\.createAdminApi\(\{ authed: TwApi\.authed, pending: TwRequestId\.createPending\(\), fetchBoard: \(\)=>noticeApi\.fetchBoard\(\) \}\);/.test(A), 'app.js — 로그인 통로(authed) · 요청 번호 · 공지 한 판 읽기를 넘겨 만든다');
  }
}

async function runAll(){
  const S = SRC0;
  await judge(S);
  say('── 5. 일부러 깨 보기');
  const breaks = [
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
