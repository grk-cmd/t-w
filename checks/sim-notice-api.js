/* ═══ 📢 sim-notice-api.js — 공지 api provider (0.13 앱 묶음 D4) ═══
   [왜] 소식 · 업데이트 공지 · 런처 배너가 Firebase(inboxBroadcast · updateNotice · catalog/adBanner) 대신 우리 서버 공개 API(/v1/notices)를 쓴다.
     서버 모양(대문자 tag · publishedAt · imageUrl · linkUrl · 고정/최신 두 묶음)을 화면 모양(소문자 tag · ts · img · link · { id: 소식 })으로 맞추는 곳이 provider 하나라
     그 맞춤을 실제로 불러서 판정한다.
   ・1절: 읽기 — 경로 · 소식 맞춤(고정 + 최신을 id 로 합침 · 같은 id 한 번) · 업데이트 공지(시각 ms · 없으면 null) · 배너(그림 없는 칸은 뺌) · 더 있음 표시 · 모양 틀림은 던짐 · 못 읽으면 던짐(빈 값으로 숨기지 않음)
   ・2절: 관리자 쓰기 — 올리기 본문(대문자 tag · 상한 깎기 · 요청 번호) · 같은 글을 닿지 못해 다시 보내면 같은 번호 · 서버가 답했으면 번호를 버림 · 고정은 올린 글의 판으로 이어서 · 고정만 실패하면 'pinFailed' ·
        고정 · 내리기는 읽은 판을 실음 · 409 는 'conflict' · 실패는 'failed'
   ・3절: 배선 — firebase-init 에 옛 공지 읽기 · 구독이 없음 · 부르는 곳이 firebaseAPI 로 소식을 안 부름 · html · smoke
   ・4절: 일부러 깨 보기
   [실행] 러너 스테이징(평면)에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find(Boolean);
const SRC0 = {
  API: pick(['notice-api.js', 'parts/launcher/notice-api.js', 'app/parts/launcher/notice-api.js']),
  FI: pick(['firebase-init.js', 'parts/firebase-init.js', 'app/parts/firebase-init.js']),
  INBOX: pick(['myhome-inbox.js', 'parts/myhome/myhome-inbox.js', 'app/parts/myhome/myhome-inbox.js']),
  UI: pick(['myhome-ui.js', 'parts/myhome/myhome-ui.js', 'app/parts/myhome/myhome-ui.js']),
  INIT: pick(['myhome-init.js', 'parts/myhome/myhome-init.js', 'app/parts/myhome/myhome-init.js']),
  BANNER: pick(['ad-banner.js', 'parts/launcher/ad-banner.js', 'app/parts/launcher/ad-banner.js']),
  OVER: pick(['overhead.js', 'parts/room/overhead.js', 'app/parts/room/overhead.js']),
  APP: pick(['app.js', 'parts/app.js', 'app/parts/app.js']),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
  SMOKE: pick(['smoke.js']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const load = (src) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w.TwNoticeApi; };
const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');

const apiErr = (status, code) => Object.assign(new Error(code || String(status)), { status, code: code || '' });
const bc = (id, tag, o) => Object.assign({ id, tag, title: 'T' + id, body: 'B' + id, pinned: false, publishedAt: '2026-10-30T01:00:00Z', version: 3 }, o || {});
const board = (o) => Object.assign({
  updateNotice: { id: 'u-1', title: '업데이트', body: '본문', publishedAt: '2026-10-29T00:00:00Z' },
  launcherBanner: [{ imageUrl: 'https://x/a.png', linkUrl: 'https://x/l' }],
  broadcasts: { pinned: [bc('p1', 'NOTICE', { pinned: true })], latest: [bc('l1', 'UPDATE'), bc('l2', 'REWARD')], nextCursor: null },
}, o || {});

function mk(src, o){
  const log = [], warns = [], settled = [];
  const get = async (path) => { log.push(['GET', path]); if(o.get instanceof Error) throw o.get; return typeof o.get === 'function' ? o.get(path) : o.get; };
  const call = (m) => async (path, a, b) => {
    const body = m === 'del' ? undefined : a;
    log.push([m === 'del' ? 'DELETE' : m.toUpperCase(), path, body]);
    const r = o[m]; const v = typeof r === 'function' ? r(path, body) : r;
    if(v instanceof Error) throw v;
    return v;
  };
  const ids = { n: 0, idFor: (k) => 'req-' + k.length + '-' + (o.sameId ? 1 : ++ids.n), settle: (k) => settled.push(k) };
  const m = load(src).createNoticeApi({ get, write: { post: call('post'), patch: call('patch'), del: call('del') }, pending: ids, warn: (...a) => warns.push(a.join(' ')) });
  return { m, log, warns, settled };
}

async function judge(S){
  const LIB = S.API;

  say('── 1. 읽기');
  {
    const { m, log } = mk(LIB, { get: board() });
    const r = await m.fetchBoard();
    chk(log[0][1] === '/v1/notices', '경로 — /v1/notices 한 번에(소식 · 업데이트 공지 · 배너)');
    chk(Object.keys(r.broadcasts).sort().join() === 'l1,l2,p1', '고정 + 최신을 id 로 합친다(고정은 오래돼도 들어 있다)');
    chk(r.broadcasts.p1.tag === 'notice' && r.broadcasts.l1.tag === 'update' && r.broadcasts.l2.tag === 'reward', '  대문자 tag → 소문자(notice · update · reward)');
    chk(r.broadcasts.p1.pinned === true && r.broadcasts.l1.pinned === false && r.broadcasts.l1.ts === Date.parse('2026-10-30T01:00:00Z') && r.broadcasts.l1.version === 3 && r.broadcasts.l1.title === 'Tl1' && r.broadcasts.l1.body === 'Bl1', '  고정 · 시각(ms) · 판(version) · 제목 · 본문');
    chk(r.updateNotice.title === '업데이트' && r.updateNotice.body === '본문' && r.updateNotice.ts === Date.parse('2026-10-29T00:00:00Z'), '업데이트 공지 — 시각은 ms(«다시 보지 않기» 가 같은 값으로 가른다)');
    chk(r.banner.length === 1 && r.banner[0].img === 'https://x/a.png' && r.banner[0].link === 'https://x/l', '배너 — imageUrl → img · linkUrl → link');
    chk(r.hasMore === false, '다음 쪽이 없으면 hasMore:false');
    const dup = mk(LIB, { get: board({ broadcasts: { pinned: [bc('same', 'NOTICE', { pinned: true })], latest: [bc('same', 'NOTICE', { pinned: true })], nextCursor: 'C' } }) });
    const d = await dup.m.fetchBoard();
    chk(Object.keys(d.broadcasts).join() === 'same' && d.hasMore === true, '같은 id 가 두 묶음에 있어도 한 건 · 다음 쪽이 있으면 hasMore');
    const none = mk(LIB, { get: board({ updateNotice: null, launcherBanner: [{ imageUrl: '', linkUrl: 'x' }, null], broadcasts: { pinned: [], latest: [], nextCursor: null } }) });
    const n = await none.m.fetchBoard();
    chk(n.updateNotice === null && n.banner.length === 0 && Object.keys(n.broadcasts).length === 0, '없으면 null · 빈 배너 · 빈 소식 — «없음» 이지 실패가 아니다');
    const odd = mk(LIB, { get: board({ broadcasts: { pinned: [bc('', 'NOTICE'), bc('x', 'MYSTERY'), null], latest: [bc('ok', 'NOTICE')], nextCursor: null } }) });
    chk(Object.keys((await odd.m.fetchBoard()).broadcasts).join() === 'ok', '깨진 한 건(id 없음 · 모르는 종류)은 빼고 나머지는 보인다');
    const down = mk(LIB, { get: apiErr(503, 'X') });
    let t = null; try{ await down.m.fetchBoard(); }catch(e){ t = e; }
    chk(t && t.status === 503, '못 읽으면 던진다(빈 공지로 숨기지 않는다)');
    for(const bad of [null, {}, { launcherBanner: [], broadcasts: { pinned: 'x', latest: [] } }, { launcherBanner: 'x', broadcasts: {} }]){
      const b = mk(LIB, { get: bad });
      let t2 = null; try{ await b.m.fetchBoard(); }catch(e){ t2 = e; }
      chk(t2 && t2.code === 'SHAPE', '모양이 틀린 응답(' + JSON.stringify(bad) + ')은 던진다');
    }
  }

  say('── 2. 관리자 쓰기');
  {
    const o = { post: () => bc('new', 'UPDATE', { version: 1 }), patch: () => null, del: () => null };
    const { m, log, settled } = mk(LIB, o);
    chk(await m.sendBroadcast({ tag: 'update', title: 'x'.repeat(100), body: 'y'.repeat(700), pinned: false }) === 'ok', '올리기 → ok');
    const p = log.find((x) => x[0] === 'POST');
    chk(p[1] === '/v1/admin/notices/broadcasts' && p[2].tag === 'UPDATE' && p[2].title.length === 80 && p[2].body.length === 600 && /^req-/.test(p[2].requestId), '본문 — 대문자 tag · 제목 80 · 본문 600 으로 깎음 · 요청 번호');
    chk(settled.length === 1, '  서버가 답했으니 요청 번호를 버린다(같은 글을 또 올리면 새 번호)');
    chk(log.every((x) => x[0] !== 'PATCH'), '  고정을 안 켰으면 고정 요청 없음');
    await m.sendBroadcast({ tag: 'bogus', title: 'a', body: '', pinned: false });
    chk(log.filter((x) => x[0] === 'POST')[1][2].tag === 'NOTICE', '  모르는 종류는 공지로');
    const pin = mk(LIB, o);
    chk(await pin.m.sendBroadcast({ tag: 'notice', title: 'a', body: 'b', pinned: true }) === 'ok', '고정해서 올리기 → ok');
    const pt = pin.log.find((x) => x[0] === 'PATCH');
    chk(pt[1] === '/v1/admin/notices/broadcasts/new' && pt[2].pinned === true && pt[2].version === 1, '  올린 글의 판(version)으로 이어서 PATCH { version, pinned:true }');
    const pf = mk(LIB, Object.assign({}, o, { patch: apiErr(409, 'CONCURRENT_UPDATE') }));
    chk(await pf.m.sendBroadcast({ tag: 'notice', title: 'a', body: 'b', pinned: true }) === 'pinFailed', '올라는 갔는데 고정이 실패하면 pinFailed — 올리기 실패와 구별');
    const net = mk(LIB, Object.assign({}, o, { post: new Error('NETWORK'), sameId: true }));
    chk(await net.m.sendBroadcast({ tag: 'notice', title: 'a', body: 'b' }) === 'failed' && net.settled.length === 0 && net.warns.length === 1, '닿지 못하면 failed · 요청 번호를 남긴다(다시 눌러도 같은 번호 — 두 번 올라가지 않게)');
    const rej = mk(LIB, Object.assign({}, o, { post: apiErr(400, 'INVALID_REQUEST') }));
    chk(await rej.m.sendBroadcast({ tag: 'notice', title: 'a', body: 'b' }) === 'failed' && rej.settled.length === 1, '서버가 거절했으면 failed · 번호는 버린다(고쳐서 다시 올리면 새 번호)');
    const w = mk(LIB, o);
    chk(await w.m.setPinned('q/1', 5, true) === 'ok' && w.log[0][0] === 'PATCH' && w.log[0][1] === '/v1/admin/notices/broadcasts/q%2F1' && JSON.stringify(w.log[0][2]) === '{"version":5,"pinned":true}', '고정 → PATCH { version, pinned } · id 는 인코딩');
    chk(await w.m.remove('q', 5) === 'ok' && w.log[1][0] === 'DELETE' && w.log[1][1] === '/v1/admin/notices/broadcasts/q?version=5', '내리기 → DELETE …/{id}?version=');
    const c = mk(LIB, { patch: apiErr(409, 'CONCURRENT_UPDATE'), del: apiErr(409, 'CONCURRENT_UPDATE') });
    chk(await c.m.setPinned('q', 5, true) === 'conflict' && await c.m.remove('q', 5) === 'conflict' && c.warns.length === 0, '409 는 conflict — 덮어쓰지 않고 진단 로그도 안 남긴다');
    const f = mk(LIB, { patch: apiErr(403, 'ACCESS_DENIED') });
    chk(await f.m.setPinned('q', 5, false) === 'failed' && f.warns.length === 1, '그 밖 실패는 failed + 진단 한 줄');
  }

  say('── 3. 배선');
  {
    const FI = strip(S.FI);
    chk(!/\b(subscribeAnnounce|subscribeAdBanner|subscribeInboxBroadcast|sendInboxBroadcast|setInboxBroadcastPinned|deleteInboxBroadcast)\s*\(/.test(FI) && !/_subscribeBroadcast|_broadcastUpdate/.test(FI), 'firebase-init 에 옛 소식 · 확성기 · 배너 읽기와 소식 쓰기가 없다(서버가 원본)');
    const callers = [S.INBOX, S.UI, S.INIT, S.BANNER, S.OVER].map(strip).join('\n');
    chk(!/firebaseAPI\.(subscribeAnnounce|subscribeAdBanner|subscribeInboxBroadcast|sendInboxBroadcast|setInboxBroadcastPinned|deleteInboxBroadcast|getUpdateNotice)\b/.test(callers), '부르는 곳이 firebaseAPI 로 소식 · 확성기 · 배너를 안 부른다');
    const h = S.HTML, tag = (f) => h.indexOf('<script src="parts/' + f + '"></script>');
    chk(tag('launcher/notice-api.js') > 0 && tag('launcher/notice-feed.js') > tag('launcher/notice-api.js') && tag('app.js') > tag('launcher/notice-feed.js'), 'html — notice-api.js → notice-feed.js → app.js 순서');
    chk(/PRELOAD\.push\('notice-api\.js'\)/.test(S.SMOKE) && /PRELOAD\.push\('notice-feed\.js'\)/.test(S.SMOKE), 'smoke PRELOAD');
    chk(/TwNoticeApi\.createNoticeApi\(\{ get: \(path\)=>TwApi\.authed\.get\(path\), write: TwApi\.authed/.test(strip(S.APP)), 'app.js — 로그인 없는 읽기(get)와 관리자 쓰기 통로(authed)를 넘겨 만든다');
  }
}

async function runAll(){
  const S = SRC0;
  await judge(S);
  say('── 4. 일부러 깨 보기');
  const breaks = [
    ['고정을 합치지 않음', S.API.replace("!broadcastsOf(d.broadcasts.pinned, broadcasts) || ", ""), '고정 + 최신'],
    ['시각을 문자열로', S.API.replace("ts: msOf(b.publishedAt)", "ts: b.publishedAt"), '시각(ms)'],
    ['종류를 대문자 그대로', S.API.replace("const tag = str(b.tag).toLowerCase();", "const tag = str(b.tag);"), '소문자'],
    ['모양 틀림을 빈 값으로', S.API.replace("if(!out) throw shapeError();\n    return out;", "return out || { updateNotice: null, banner: [], broadcasts: {}, hasMore: false };"), '모양이 틀린'],
    ['제목 상한 없음', S.API.replace(".slice(0, LIMITS.TITLE)", ""), '제목 80'],
    ['고정에 판 안 실음', S.API.replace("{ version, pinned: !!pinned }", "{ pinned: !!pinned }"), '고정 → PATCH'],
    ['내리기에 판 안 실음', S.API.replace("?version=' + encodeURIComponent(version)", "'"), '내리기'],
    ['409 를 실패로', S.API.replace("if(e && e.status === CONFLICT_STATUS) return 'conflict';", ""), '409'],
    ['고정 실패를 올리기 성공으로', S.API.replace("return (await setPinned(made.id, m.version, true)) === 'ok' ? 'ok' : 'pinFailed';", "await setPinned(made.id, m.version, true); return 'ok';"), 'pinFailed'],
    ['거절돼도 번호 유지', S.API.replace("if(e && e.status) ids.settle(key);", ""), '번호는 버린다'],
    ['닿지 못해도 번호 버림', S.API.replace("if(e && e.status) ids.settle(key);", "ids.settle(key);"), '번호를 남긴다'],
  ];
  for(const [name, src, what] of breaks){
    if(src === S.API){ chk(false, name + ' — 바꿀 글을 못 찾음'); continue; }
    quiet = true; qfail = 0;
    try{ await judge(Object.assign({}, S, { API: src })); }catch(_){ qfail++; }
    quiet = false;
    chk(qfail > 0, name + ' → 빨강(' + what + ')');
  }
  say('\n통과 ' + pass + ' · 실패 ' + fail);
  process.exit(fail ? 1 : 0);
}
runAll();
