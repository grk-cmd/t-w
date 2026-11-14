/* ═══ 📚 sim-bookshelf-store.js — 책장 상태 주인 (0.13 앱 묶음 D2-4) ═══
   [왜] 책장(추가 · 고치기 · 빼기 · 순서 · 👀 공개)의 원본이 서버가 됐다. 저장은 통째 PUT 하나(판 version)라 겹쳐 보내면 409 로 내 고침이 사라지고,
     늦게 온 답이 새 집 · 새 계정 화면을 덮는다. 그래서 진짜 모듈을 가짜 서버 길 위에서 돌려 순서를 본다.
   ・1절: 받기 — 받기 전 고치기 잠금(요청 0) · 서랍 열기 GET 1 · 다시 열기(ready) 0 · 빈 책장 ≠ 못 받음 · 못 받음 E-MH-26 한 번 · 다시 시도 GET 1 · 모듈만 만들면 요청 0
   ・2절: 저장 — PUT 통째(책 목록) · 저장 중 고침 두 번 → PUT 둘(겹치지 않음 · 두 번째가 최신) · 응답 책으로 다시 그림 · 50권 → 요청 0
   ・3절: 409 · 실패 — 409 → 잠그고 GET 1 · 서버 것 · 알림 · 실패 E-MH-27 한 번 · 혼자 다시 안 보냄 · flush
   ・4절: 구경 — 공개 책 · 없는 사람(missing) · 못 받음(번호 없음 → 다시 시도가 또 실패하면 E-MH-26) · 집 gen · 닫는 중 답 버림
   ・5절: 계정 — reset 뒤 늦은 답 버림 · 주인 바뀜은 조용히 · 그림 올리기
   ・6절: 배선 · 7절: 일부러 깨 보기
   [실행] 러너 스테이징(평면)에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find(Boolean);
const P = (f, dir) => [f, 'parts/' + dir + '/' + f, 'app/parts/' + dir + '/' + f, 'apps/desktop/app/parts/' + dir + '/' + f];
const SRC0 = {
  ST: pick(P('bookshelf-store.js', 'myhome')), API: pick(P('myhome-api.js', 'myhome')), AE: pick(P('api-errors.js', 'shared')),
  APP: pick(['app.js', 'parts/app.js', 'app/parts/app.js', 'apps/desktop/app/parts/app.js']),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html', 'apps/desktop/app/desk-companion-prototype.html']),
  SMOKE: pick(['smoke.js', 'checks/smoke.js']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const loadMod = (src) => { const m = { exports: {} }; new Function('window', 'module', src)(undefined, m); return m.exports; };
const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
const flush = async () => { for(let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r)); };
const apiErr = (status, code) => Object.assign(new Error(code || String(status)), { status, code: code || '', kind: status >= 500 || status === 0 ? 'unavailable' : (status === 401 || status === 403) ? 'auth' : 'request' });
const book = (id, o) => Object.assign({ id, url: '', title: id, w: 'thin', h: 'short', color: '#8f5a4a', tcolor: '#ffffff', hideTitle: false, pub: false, at: 1000 }, o || {});

/* 가짜 서버 길 — 부른 것을 적고, 답은 손으로 푼다(hold) 또는 바로(auto) */
function mk(S, server){
  const log = [], waits = [];
  const srv = Object.assign({ books: [book('a'), book('b')], version: 3, auto: true }, server || {});
  const answer = (fn) => new Promise((res, rej) => {
    const go = () => { try{ const v = fn(); if(v instanceof Error) rej(v); else res(v); }catch(e){ rej(e); } };
    if(srv.auto) go(); else waits.push(go);
  });
  const copy = () => ({ books: srv.books.map((x) => Object.assign({}, x)), version: srv.version });
  const api = {
    fetchBookshelf: () => { log.push('GET mine'); return answer(() => (srv.mineErr ? srv.mineErr : copy())); },
    fetchBookshelfOf: (code) => { log.push('GET of ' + code); return answer(() => (srv.ofErr && srv.ofErr[code]) || { books: (srv.of && srv.of[code]) || [] }); },
    uploadImage: () => { log.push('POST image'); return answer(() => (srv.upErr ? srv.upErr : 'https://img/up' + log.length + '.webp')); },
    putBookshelf: (version, books) => {
      log.push('PUT v' + version + ' ' + books.map((x) => x.id + (x.pub ? '+' : '')).join(','));
      return answer(() => (srv.putErr ? srv.putErr : after(books)));
    },
    reset: () => { log.push('api reset'); },
  };
  function after(books){ srv.version++; srv.books = books.map((x) => Object.assign({}, x, { at: 5000 })); return copy(); }
  const lib = loadMod(S.API);
  const st = loadMod(S.ST).createBookshelfStore({ api, lib, errs: loadMod(S.AE),
    apiErrors: { notify: (e) => log.push('common ' + (e && e.code)) }, notifyError: (c) => log.push('error ' + c), toast: (m) => log.push('toast ' + m) });
  let changes = 0; st.onChange(() => { changes++; });
  const release = async (n) => { for(let i = 0; i < (n || 1); i++){ const go = waits.shift(); if(go) go(); await flush(); } };
  return { st, log, srv, waits, release, changes: () => changes };
}
const ids = (list) => list.map((x) => x.id + (x.pub ? '+' : '')).join(',');
const count = (log, re) => log.filter((l) => re.test(l)).length;

async function judge(S){
  say('── 1. 받기');
  {
    const e = mk(S);
    chk(e.log.length === 0 && e.st.mine().load === 'idle', '만들기만 하면 요청 0 · 처음은 idle');
    chk(await e.st.put([book('x')]) === 'locked' && e.log.length === 0, '받기 전엔 고칠 수 없다(요청 0)');
    const ok = await e.st.pullMine();
    chk(ok && e.st.mine().load === 'ready' && ids(e.st.mine().books) === 'a,b' && e.st.mine().version === 3 && count(e.log, /^GET mine$/) === 1, '서랍을 열면 GET 1 · ready · 서버 책 · 판');
    await e.st.pullMine();
    chk(count(e.log, /^GET mine$/) === 1, '다시 열어도(ready) 요청 0');
    const empty = mk(S, { books: [] });
    chk(await empty.st.pullMine() && empty.st.mine().load === 'ready' && empty.st.mine().books.length === 0, '빈 책장은 ready + 빈 배열(못 받음과 다름)');
    const down = mk(S, { mineErr: apiErr(503, 'X') });
    chk(!(await down.st.pullMine()) && down.st.mine().load === 'failed' && count(down.log, /^error E-MH-26$/) === 1, '못 받음 → failed · E-MH-26 한 번');
    chk(await down.st.put([book('x')]) === 'locked', '  못 받은 동안 고치기 잠금');
    down.srv.mineErr = null;
    chk(await down.st.pullMine() && down.st.mine().load === 'ready' && count(down.log, /^GET mine$/) === 2, '[다시 시도] → GET 1 더 · ready');
    const prem = mk(S, { mineErr: apiErr(403, 'PREMIUM_REQUIRED') });
    await prem.st.pullMine();
    chk(prem.log.includes('common PREMIUM_REQUIRED') && !prem.log.includes('error E-MH-26'), '공통 code 는 공통 번호');
    const hold = mk(S, { auto: false });
    const p1 = hold.st.pullMine(), p2 = hold.st.pullMine();
    chk(p1 === p2 && count(hold.log, /^GET mine$/) === 1 && hold.st.mine().load === 'loading', '받는 중에 또 받기 → 같은 약속(요청 1)');
    await hold.release();
  }

  say('── 2. 저장');
  {
    const e = mk(S, { auto: false });
    const pl = e.st.pullMine(); await e.release(); await pl;
    const t1 = e.st.put([book('b'), book('a')]);
    chk(ids(e.st.mine().books) === 'b,a' && e.st.mine().saving, '순서 바꾸기 — 화면 책을 먼저 바꾸고 저장 중');
    const t2 = e.st.put([book('b'), book('a', { pub: true })]);
    chk(count(e.log, /^PUT/) === 1 && ids(e.st.mine().books) === 'b,a+', '저장 중 또 고침 → 아직 PUT 1(겹치지 않음) · 화면은 최신');
    await e.release();
    chk(count(e.log, /^PUT/) === 2 && e.log.filter((l) => /^PUT/.test(l))[1] === 'PUT v4 b,a+', '앞 저장이 끝나면 최신 책 · 새 판으로 한 번 더');
    chk(ids(e.st.mine().books) === 'b,a+', '  앞 저장의 답이 그 사이 고친 책을 덮지 않는다');
    await e.release();
    const [r1, r2] = await Promise.all([t1, t2]);
    chk(r1 === 'ok' && r2 === 'ok' && e.st.mine().version === 5 && !e.st.mine().saving && e.st.mine().books[0].at === 5000, '끝나면 서버가 돌려준 책(서버가 넣은 시각 포함)으로 다시 그린다 · 둘 다 ok');
    chk(count(e.log, /^PUT/) === 2 && count(e.log, /^GET/) === 1, '  요청은 GET 1 · PUT 2 뿐');
    const full = mk(S, { books: Array.from({ length: 50 }, (_, i) => book('k' + i)) });
    await full.st.pullMine();
    chk(await full.st.put(full.st.mine().books.concat([book('z')])) === 'full' && count(full.log, /^PUT/) === 0 && full.st.mine().books.length === 50, '50권에 한 권 더 → full(요청 0 · 화면 그대로)');
    chk(await full.st.put(full.st.mine().books.slice(1)) === 'ok' && count(full.log, /^PUT/) === 1, '  50권에서 빼기는 된다');
    const old = mk(S, { books: Array.from({ length: 52 }, (_, i) => book('k' + i)) });
    await old.st.pullMine();
    chk(await old.st.put(old.st.mine().books.slice().reverse()) === 'ok', '  50권을 넘은 옛 책장도 순서는 바꿀 수 있다');
  }

  say('── 3. 409 · 실패');
  {
    const e = mk(S, { putErr: apiErr(409, 'CONCURRENT_UPDATE') });
    await e.st.pullMine();
    e.srv.books = [book('z')]; e.srv.version = 9;   // 다른 기기가 먼저 고침
    const r = await e.st.put([book('b'), book('a')]);
    chk(r === 'conflict' && count(e.log, /^GET mine$/) === 2 && ids(e.st.mine().books) === 'z' && e.st.mine().version === 9, '409 → 다시 받아 서버 것으로(내 고침은 버림)');
    chk(e.log.includes('toast 다른 기기에서 바꾼 내용을 받아왔어요') && !e.log.some((l) => /^error/.test(l)), '  «다른 기기에서 바꾼 내용을 받아왔어요» · 오류 번호 없음');
    const h = mk(S, { putErr: apiErr(409, 'CONCURRENT_UPDATE'), auto: false });
    const hp = h.st.pullMine(); await h.release(); await hp;
    const hr = h.st.put([book('b'), book('a')]);
    await h.release();
    chk(h.st.mine().load === 'loading' && await h.st.put([book('a')]) === 'locked', '  다시 받는 동안 고치기 잠금');
    await h.release(); await hr;

    const f = mk(S, { putErr: apiErr(503, 'X') });
    await f.st.pullMine();
    const fr = await f.st.put([book('b'), book('a')]);
    await flush();
    chk(fr === 'failed' && ids(f.st.mine().books) === 'b,a' && count(f.log, /^PUT/) === 1 && count(f.log, /^error E-MH-27$/) === 1, '실패 → 화면은 고친 대로 · E-MH-27 한 번 · 혼자 다시 보내지 않음');
    await f.st.put([book('a'), book('b')]);
    chk(count(f.log, /^PUT/) === 2 && count(f.log, /^error E-MH-27$/) === 1, '  이어지는 실패는 번호 한 번(다음 고침이 다시 보냄)');
    chk(await f.st.pullMine() && count(f.log, /^GET mine$/) === 1, '  못 올린 고침이 있으면 받기가 화면을 덮지 않는다(요청 0)');
    f.srv.putErr = null;
    chk(await f.st.flush() === 'ok' && count(f.log, /^PUT/) === 3, 'flush — 못 올린 고침을 한 번 올린다');
    chk(await f.st.flush() === 'none' && count(f.log, /^PUT/) === 3, '  올릴 것이 없으면 요청 0');
    f.srv.putErr = apiErr(503, 'X');
    await f.st.put([book('b')]);
    chk(count(f.log, /^error E-MH-27$/) === 2, '  성공 뒤 다시 실패하면 번호를 다시 알린다');
    const inv = mk(S, { putErr: apiErr(400, 'MYHOME_INVALID_LINK') });
    await inv.st.pullMine(); await inv.st.put([book('a')]);
    chk(inv.log.includes('error E-MH-27'), 'MYHOME_INVALID_LINK 도 E-MH-27');
    const sv = mk(S, { auto: false });
    const sp = sv.st.pullMine(); await sv.release(); await sp;
    const sf = sv.st.put([book('a')]);
    const fl = sv.st.flush();
    chk(fl === sf, 'flush — 저장 중이면 그 저장의 끝을 기다린다');
    await sv.release(); await fl;
  }

  say('── 4. 구경');
  {
    const e = mk(S, { auto: false, of: { A: [book('fa')], B: [book('fb'), book('fb2')] } });
    const pa = e.st.openView('A'), pb = e.st.openView('B');
    e.waits.reverse();   // B 답이 먼저, A 답이 뒤에
    await e.release(2);
    chk(await pa === false && await pb === true && e.st.view().owner === 'B' && ids(e.st.view().books) === 'fb,fb2', '집을 빨리 옮김 — 늦게 온 앞 집(A) 답은 버린다');
    const c = mk(S, { auto: false, of: { A: [book('fa')] } });
    const pc = c.st.openView('A'); c.st.closeView(); await c.release();
    chk(await pc === false && c.st.view().books.length === 0 && c.st.view().load === 'idle', '닫는 중에 온 답은 아무것도 그리지 않는다');
    const none = mk(S, { of: { E: [] } });
    chk(await none.st.openView('E') && none.st.view().load === 'ready' && none.st.view().books.length === 0, '공개 책 0권 → ready + 빈 배열(폴더를 숨길 근거)');
    const nf = mk(S, { ofErr: { X: apiErr(404, 'USER_NOT_FOUND') } });
    chk(await nf.st.openView('X') && nf.st.view().load === 'missing' && !nf.log.some((l) => /^error|^common/.test(l)), '없는 사람 → missing(번호 없음 — 폴더 숨김)');
    const bad = mk(S, { ofErr: { Y: apiErr(503, 'X') } });
    await bad.st.openView('Y');
    chk(bad.st.view().load === 'failed' && !bad.log.some((l) => /^error/.test(l)), '그 집 책 못 받음 → failed · 시작할 때는 번호 없음(폴더는 보이고 서랍에 «다시 시도»)');
    await bad.st.retryView();
    chk(bad.st.view().load === 'failed' && count(bad.log, /^error E-MH-26$/) === 1 && count(bad.log, /^GET of Y$/) === 2, '[다시 시도] 가 또 실패하면 E-MH-26 · GET 1 더');
    bad.srv.ofErr = {}; bad.srv.of = { Y: [book('p')] };
    await bad.st.retryView();
    chk(bad.st.view().load === 'ready' && ids(bad.st.view().books) === 'p', '  다시 시도가 되면 공개 책이 보인다');
    const tw = mk(S, { of: { A: [book('p')] } });
    await tw.st.pullMine(); await tw.st.openView('A');
    chk(ids(tw.st.mine().books) === 'a,b' && ids(tw.st.view().books) === 'p', '내 책장과 보는 집 책은 따로 든다');
  }

  say('── 5. 계정 · 그림 올리기');
  {
    const r = mk(S, { auto: false });
    const rp = r.st.pullMine(); await r.release(); await rp;
    const rt = r.st.put([book('b'), book('a')]);
    r.st.reset();
    await r.release();
    chk(await rt === 'stale' && r.st.mine().load === 'idle' && r.st.mine().books.length === 0 && !r.log.some((l) => /^error|^toast/.test(l)) && r.log.includes('api reset'), '계정을 놓음(reset) → 늦게 온 저장 답은 버림 · 상태 idle · 주인 기억 비움');
    const r2 = mk(S, { auto: false });
    const r2p = r2.st.pullMine(); r2.st.reset(); await r2.release();
    chk(await r2p === false && r2.st.mine().load === 'idle', '  reset 전에 나간 받기의 답도 버림');
    const own = mk(S, { putErr: Object.assign(new Error('x'), { code: 'OWNER_CHANGED' }) });
    await own.st.pullMine();
    chk(await own.st.put([book('a')]) === 'stale' && !own.log.some((l) => /^error|^common/.test(l)), '주인이 바뀜(OWNER_CHANGED) → 조용히 버림');
    const busy = mk(S, { auto: false });
    const bp = busy.st.pullMine(); await busy.release(); await bp;
    busy.st.put([book('a')]);
    chk(await busy.st.pullMine() === true && count(busy.log, /^GET mine$/) === 1, '저장 중 내 책장 받기 → 받지 않고 지금 책(요청 0)');
    await busy.release();
    const up = mk(S);
    const u = await up.st.uploadImage('data:image/webp;base64,AA');
    chk(u.ok && /^https:\/\/img\/up/.test(u.url) && count(up.log, /^PUT/) === 0, '그림 올리기 → 주소만 돌려준다(저장은 put — PUT 0)');
    const uf = mk(S, { upErr: apiErr(503, 'X') });
    const uu = await uf.st.uploadImage('data:x');
    chk(uu.ok === false && !uu.stale && !uu.notified && !uf.log.some((l) => /^error/.test(l)), '올리기 실패 → { ok:false } · 번호는 부르는 화면 몫(여기선 없음)');
    const uc = mk(S, { upErr: apiErr(403, 'PREMIUM_REQUIRED') });
    const ucr = await uc.st.uploadImage('data:x');
    chk(ucr.ok === false && ucr.notified === true && uc.log.some((l) => /^common/.test(l)), '  공통 번호(PREMIUM_REQUIRED)는 store 가 알리고 notified — 화면이 E-MH-24 를 또 안 띄운다');
    const us = mk(S, { auto: false });
    const upp = us.st.uploadImage('data:x'); us.st.reset(); await us.release();
    chk((await upp).stale === true, '올리는 사이 reset → stale');
  }

  say('── 6. 배선');
  {
    const h = S.HTML, tag = (f) => h.indexOf('<script src="parts/' + f + '"></script>');
    chk(tag('myhome/myhome-api.js') > 0 && tag('myhome/bookshelf-store.js') > tag('myhome/myhome-api.js') && tag('myhome/bookmark.js') > tag('myhome/bookshelf-store.js') && tag('app.js') > tag('myhome/bookmark.js'),
      'html — myhome-api.js → bookshelf-store.js → bookmark.js · app.js 보다 먼저');
    chk(S.SMOKE.indexOf("PRELOAD.push('bookshelf-store.js')") > S.SMOKE.indexOf("PRELOAD.push('myhome-api.js')") && S.SMOKE.indexOf("PRELOAD.push('bookmark.js')") > S.SMOKE.indexOf("PRELOAD.push('bookshelf-store.js')"), 'smoke PRELOAD 에 bookshelf-store.js · bookmark.js(myhome-api.js 뒤)');
    const A = strip(S.APP);
    const iApi = A.indexOf('const bookshelfApiMod = TwMyHomeApi.createMyHomeApi({ authed: TwApi.authed'), iSt = A.indexOf('const bookshelfStoreMod = TwBookshelfStore.createBookshelfStore('), iBm = A.indexOf('TwBookmark.createBookmark({');
    chk(iApi > 0 && iSt > iApi && iBm > iSt && (A.match(/TwBookshelfStore\.createBookshelfStore\(/g) || []).length === 1, 'app.js — 서버 길 → 책장 상태 주인 → 서랍 차례로 한 번');
    chk(/addEventListener\('beforeunload', \(\)=>\{ bookshelfStoreMod\.flush\(\); \}\)/.test(A), '  앱을 끌 때 못 올린 고침 한 번(flush)');
    const ST = strip(S.ST);
    chk(!/firebase|localStorage|setTimeout|setInterval/.test(ST), '책장 상태 주인은 Firebase · 로컬 저장 · 타이머를 쓰지 않는다(4초 뒤 받기 · 자동 재시도 없음)');
  }
}

(async () => {
  await judge(SRC0);
  say('── 7. 일부러 깨 보기');
  const S = SRC0;
  const breaks = [
    ['저장 중 고침을 끝난 뒤 안 보냄(again 빠짐)', S.ST.replace("if(saving){ again = true; return saveP; }", "if(saving){ return saveP; }"), 'again'],
    ['저장 중에도 겹쳐 보냄', S.ST.replace("if(saving){ again = true; return saveP; }", ""), '겹침'],
    ['앞 저장 답이 고친 책을 덮음', S.ST.replace("if(!again){ mineSt.books = got.books; res = 'ok'; break; }", "mineSt.books = got.books; if(!again){ res = 'ok'; break; }"), '덮음'],
    ['409 에서 다시 받지 않음', S.ST.replace("await pullMine({ merged: true });", ""), '409'],
    ['실패 번호를 매번', S.ST.replace("        if(!failing){\n", "        if(true){\n"), '한 번'],
    ['집 gen 비교 빠짐', S.ST.replace("if(g !== gen || vg !== viewSt.gen) return false;\n    viewSt.books", "if(g !== gen) return false;\n    viewSt.books"), 'gen'],
    ['reset 뒤 답을 안 버림', S.ST.replace("      if(g !== gen) return 'stale';\n      mineSt.version = got.version;", "      mineSt.version = got.version;"), 'reset'],
    ['받기 전에도 고침', S.ST.replace("const editable = () => mineSt.load === LOAD.READY;", "const editable = () => true;"), '잠금'],
    ['ready 인데 또 받음(저장 중 받기 포함)', S.ST.replace("if(mineSt.load === LOAD.READY && !(opts && opts.merged)) return Promise.resolve(true);", ""), '다시 열기 0 · 덮지 않음'],
    ['없는 사람에 번호', S.ST.replace("if(f.kind === KIND.MISSING){ viewSt.load = LOAD.MISSING; viewSt.books = []; }", "if(false){}"), '없음'],
    ['구경 시작 실패에도 번호', S.ST.replace("if(numbered) report(e, 'load');", "report(e, 'load');"), '번호'],
    ['50권 상한 빠짐', S.ST.replace("if(books.length > BOOKS && books.length > mineSt.books.length) return Promise.resolve('full');", ""), 'full'],
  ];
  for(const [name, src, what] of breaks){
    if(src === S.ST){ chk(false, name + ' — 바꿀 글을 못 찾음'); continue; }
    quiet = true; qfail = 0;
    /* 깨진 판은 답을 영영 기다릴 수 있다 — 2초 안에 안 끝나면 그것도 빨강 */
    let timer;
    const late = new Promise((r) => { timer = setTimeout(() => { qfail++; r(); }, 2000); });
    try{ await Promise.race([judge(Object.assign({}, S, { ST: src })), late]); }catch(_){ qfail++; }
    clearTimeout(timer);
    quiet = false;
    chk(qfail > 0, name + ' → 빨강(' + what + ')');
  }
  say('\n통과 ' + pass + ' · 실패 ' + fail);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('  ✗ 실행 오류 — ' + (e && e.stack || e)); process.exit(1); });
