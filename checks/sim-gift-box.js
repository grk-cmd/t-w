/* ═══ 🎁 sim-gift-box.js — 선물 상태 주인 (0.13 앱 묶음 D7-3) — 옛 sim-gift-star.js 를 갈음 ═══
   [왜] 선물함(받기 · ⭐ · 치움 · 지우기 · 봤음)의 원본이 서버가 됐다. 받기와 쓰기가 겹치면 늦게 온 옛 답이 방금 누른 ⭐ 를 되돌리고,
     같은 선물을 연타하면 요청이 겹치며, 계정을 놓은 뒤 늦은 답이 새 계정 화면을 덮는다. 그래서 진짜 모듈을 가짜 서버 길 위에서 돌려 순서를 본다.
     ⭐ 는 서버에 남아 자동 정리(서버)가 지우지 않는다는 옛 검사의 뜻은 그대로 — 앱은 순서(⭐ 먼저)와 20 상한 안내만 맡는다.
   ・1절: 순서 — order() 순수 함수(⭐ 먼저 → 최신순 · 같은 시각은 받은 차례 · 원본 안 바꿈)
   ・2절: 받기 — idle → loading → ready · 값은 서버 숫자(받기 전 null) · 못 받음 failed · 누른 받기만 E-GIFT-04 · 받기 합치기(요청 1)
   ・3절: 한 줄 — 받기를 붙잡고 ⭐ → 받기 답(옛 값) 뒤에 ⭐ 가 남음 · 같은 id busy · 다른 id 는 줄에 섬 · 없는 선물 → 안내 + 받기 1번
   ・4절: 쓰기 — ⭐ 21번째 안내(요청 0) · 서버 GIFT_STAR_FULL · 치움 · 지우기 · ⭐ 는 지우기 요청 0 · 실패 번호(05 · 06) · 안내 코드는 번호 0
   ・5절: 봤음 · 서브탭 — 받기 → 안 본 게 있을 때만 봤음 · 봤음 실패는 번호 0 · 배지 남음
   ・6절: 신호 · 계정 — 신호 1번 → GET 1번 · idle 에서 신호 → 0 · reset 뒤 신호 → 0 · reset 뒤 늦은 답 버림
   ・7절: 그 집 선물 — 받음 · 없는 사람은 번호 0 · 실패는 notify 일 때만 E-GIFT-09
   ・8절: 배선 · 옛 길 걷음 — app.js 가 만드는 줄 · gift STEP · html · smoke · 옛 firebaseAPI 선물 메서드 · 로컬 치움 키가 없음 · 화면(확인창 · confirm 없음 · 상한 표시)
   ・9절: 일부러 깨 보기
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
  BOX: pick(P('gift-box.js', 'myhome')), GIFT: pick(P('gift-api.js', 'myhome')), AE: pick(P('api-errors.js', 'shared')),
  INBOX: pick(P('myhome-inbox.js', 'myhome')), UI: pick(P('myhome-ui.js', 'myhome')), ML: pick(P('mallang.js', 'myhome')), FB: pick(['firebase-init.js', 'parts/firebase-init.js', 'app/parts/firebase-init.js', 'apps/desktop/app/parts/firebase-init.js']),
  BOOT: pick(P('app-boot.js', 'launcher')), ACC: pick(P('account.js', 'account')), STORE: pick(P('account-store.js', 'shared')),
  APP: pick(['app.js', 'parts/app.js', 'app/parts/app.js', 'apps/desktop/app/parts/app.js']),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html', 'apps/desktop/app/desk-companion-prototype.html']),
  SMOKE: pick(['smoke.js', 'checks/smoke.js']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const loadMod = (src) => { const m = { exports: {} }; new Function('window', 'module', src)(undefined, m); return m.exports; };
const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
const flush = async () => { for(let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r)); };
const apiErr = (status, code, msg) => Object.assign(new Error(msg || code || String(status)), { status, code: code || '', kind: status >= 500 || status === 0 ? 'unavailable' : (status === 401 || status === 403) ? 'auth' : 'request' });
const gift = (id, t, o) => Object.assign({ id, senderName: '친구' + id, imageUrl: 'https://img/' + id + '.png', message: '', starred: false, hidden: false, sentAt: t }, o || {});
const count = (log, re) => log.filter((l) => re.test(l)).length;

/* 가짜 서버 길 — 부른 것을 적고, 답은 손으로 푼다(auto=false) 또는 바로 */
function mk(S, server){
  const log = [], waits = [], hooks = [];
  const srv = Object.assign({ items: [gift('a', 100), gift('b', 300, { starred: true }), gift('c', 200, { hidden: true })], unseen: 2, starMax: 20, boxKeep: 30, auto: true }, server || {});
  const answer = (fn) => new Promise((res, rej) => {
    const go = () => { try{ const v = fn(); if(v instanceof Error) rej(v); else res(v); }catch(e){ rej(e); } };
    if(srv.auto) go(); else waits.push(go);
  });
  const boxCopy = () => ({ items: srv.items.map((x) => Object.assign({}, x)), unseenCount: srv.unseen, starCount: srv.items.filter((x) => x.starred).length, boxKeep: srv.boxKeep, starMax: srv.starMax });
  const api = {
    fetchBox: () => { log.push('GET box'); const snap = srv.boxErr ? srv.boxErr : boxCopy(); return answer(() => snap); },
    markSeen: () => { log.push('POST seen'); return answer(() => (srv.seenErr ? srv.seenErr : (srv.unseen = 0, undefined))); },
    star: (id, on) => { log.push('PATCH ' + id + ' starred=' + on); return answer(() => (srv.starErr ? srv.starErr : undefined)); },
    hide: (id, on) => { log.push('PATCH ' + id + ' hidden=' + on); return answer(() => (srv.hideErr ? srv.hideErr : undefined)); },
    remove: (id) => { log.push('DELETE ' + id); return answer(() => (srv.delErr ? srv.delErr : undefined)); },
    fetchVisible: (code) => { log.push('GET visible ' + code); return answer(() => (srv.visErr ? srv.visErr : { items: [{ id: 'v1', imageUrl: 'https://img/v1.png', message: '' }], visibleCount: 1, recipientCap: 30 })); },
    reset: () => { log.push('api reset'); },
  };
  const rt = { fns: [] };
  const rtOn = (kind, fn) => { log.push('rtOn ' + kind); rt.fns.push(fn); return () => { log.push('rtOff ' + kind); const i = rt.fns.indexOf(fn); if(i >= 0) rt.fns.splice(i, 1); }; };
  const box = loadMod(S.BOX).createGiftBox({ api, giftLib: loadMod(S.GIFT), errs: loadMod(S.AE),
    apiErrors: { notify: (e) => log.push('common ' + (e && e.code)) }, notifyError: (c) => log.push('error ' + c), toast: (m) => log.push('toast ' + m), rtOn });
  let changes = 0; box.onChange(() => { changes++; });
  const release = async (n) => { for(let i = 0; i < (n || 1); i++){ await flush(); const go = waits.shift(); if(go) go(); await flush(); } };
  const signal = () => rt.fns.slice().forEach((f) => f({ kind: 'gifts' }));
  return { box, log, srv, waits, release, signal, rt, changes: () => changes };
}
const ids = (b) => b.box().items.map((x) => x.id + (x.starred ? '★' : '') + (x.hidden ? '(치움)' : '')).join(',');

async function judge(S){
  say('── 1. 순서');
  {
    const b = mk(S).box;
    const items = [gift('a', 100), gift('b', 300, { starred: true }), gift('c', 200), gift('d', 500, { starred: true }), gift('e', 200)];
    const before = JSON.stringify(items);
    chk(b.order(items).map((x) => x.id).join() === 'd,b,c,e,a', '⭐ 먼저(최신순) → 나머지 최신순 · 같은 시각(c · e)은 받은 차례');
    chk(JSON.stringify(items) === before, '  원본 배열을 안 바꾼다(순수)');
    chk(b.order([]).length === 0 && b.order(null).length === 0, '  빈 목록 · null 도 빈 배열');
  }

  say('── 2. 받기');
  {
    const e = mk(S);
    const b0 = e.box.box();
    chk(b0.load === 'idle' && b0.unseenCount === null && b0.starMax === null && b0.items.length === 0, '처음은 idle · 숫자는 null(모름 — 0 과 가른다)');
    chk(await e.box.pull(false) === 'ready' && e.box.box().load === 'ready' && ids(e.box) === 'a,b★,c(치움)' && e.box.box().unseenCount === 2 && e.box.box().starMax === 20 && e.box.box().boxKeep === 30, '받으면 ready · 서버 줄 · 서버 숫자(starMax · boxKeep · unseenCount)');
    chk(e.log.length === 1 && e.log[0] === 'GET box', '  요청은 GET 1');
    const empty = mk(S, { items: [], unseen: 0 });
    chk(await empty.box.pull(false) === 'ready' && empty.box.box().load === 'ready' && empty.box.box().unseenCount === 0, '빈 선물함은 ready + 0(못 받음과 다른 상태)');
    const down = mk(S, { boxErr: apiErr(503, 'X') });
    chk(await down.box.pull(true) === 'failed' && down.box.box().load === 'failed' && down.log.includes('error E-GIFT-04') && down.box.box().unseenCount === null, '누른 받기가 실패하면 failed · E-GIFT-04 · 숫자는 모름 그대로');
    const quietDown = mk(S, { boxErr: apiErr(503, 'X') });
    await quietDown.box.pull(false);
    chk(!quietDown.log.some((l) => l.startsWith('error')), '  누르지 않은 받기(신호 · 처음)의 실패는 번호 없음');
    const prem = mk(S, { boxErr: apiErr(403, 'PREMIUM_REQUIRED') });
    await prem.box.pull(true);
    chk(prem.log.includes('common PREMIUM_REQUIRED') && !prem.log.includes('error E-GIFT-04'), '  공통 code 는 공통 번호');
    const keep = mk(S);
    await keep.box.pull(false); keep.srv.boxErr = apiErr(503, 'X');
    await keep.box.pull(true);
    chk(keep.box.box().load === 'ready' && ids(keep.box) === 'a,b★,c(치움)' && keep.log.includes('error E-GIFT-04'), '  받은 적 있으면 다시 받기 실패해도 이전 값 그대로(ready)');
    const hold = mk(S, { auto: false });
    const p1 = hold.box.pull(false), p2 = hold.box.pull(true), p3 = hold.box.pull(false);
    chk(hold.box.box().load === 'loading', '받는 중이면 loading');
    await hold.release();
    await hold.release();
    chk(count(hold.log, /^GET box$/) <= 2 && p2 === p3, '받기 합치기 — 줄에 선 받기는 하나로(받는 중에 부르면 끝난 뒤 한 번 더)');
    await Promise.all([p1, p2]);
  }

  say('── 3. 한 줄 · busy');
  {
    const e = mk(S, { auto: false });
    const pl = e.box.pull(false); await e.release(); await pl;
    e.srv.auto = false;
    /* 옛 값을 든 받기를 붙잡고(서버는 a 가 ⭐ 아님) ⭐ 를 누른다 — 받기 답이 ⭐ 를 되돌리지 않아야 한다 */
    const p = e.box.pull(false);
    await flush();
    const s = e.box.star('a', true);
    chk(count(e.log, /PATCH/) === 0, '받기가 끝나기 전엔 ⭐ 요청이 안 나감(같은 줄)');
    e.srv.items.find((x) => x.id === 'a').starred = true;   // 서버는 ⭐ 를 적은 뒤의 모양
    await e.release(); await e.release(); await e.release();
    await Promise.all([p, s]);
    chk(await s === 'ok' && ids(e.box) === 'a★,b★,c(치움)', '받기 답이 온 뒤 ⭐ 가 남는다(옛 답이 되돌리지 않음)');
    const e2 = mk(S, { auto: false });
    const pl2 = e2.box.pull(false); await e2.release(); await pl2;
    const s1 = e2.box.star('a', true), s2 = e2.box.star('a', false);
    chk(await s2 === 'busy' && e2.box.isBusy('a') && !e2.box.isBusy('c'), '같은 선물에 또 누르면 busy(요청 없이) · 칸 흐림 표시');
    const h = e2.box.hide('c', false);
    chk(!e2.box.isBusy('b') && e2.box.isBusy('c'), '  다른 선물은 줄에 선다');
    await e2.release(); await e2.release();
    chk(await s1 === 'ok' && await h === 'ok' && !e2.box.isBusy('a') && count(e2.log, /PATCH/) === 2, '  끝나면 busy 풀림 · 요청은 각 1');
    const g = mk(S);
    await g.box.pull(false);
    const r = await g.box.star('zzz', true);
    chk(r === 'gone' && g.log.includes('toast ' + g.box.MSG.gone) && !g.log.some((l) => /PATCH/.test(l)), '화면에 없는 선물(이미 지워짐) → 안내 · 요청 0');
    await flush();
    chk(count(g.log, /^GET box$/) === 2, '  화면이 서버와 어긋났을 수 있다 → 받기 한 번');
    const notFound = mk(S, { starErr: apiErr(404, 'GIFT_NOT_FOUND') });
    await notFound.box.pull(false);
    const nr = await notFound.box.star('a', true); await flush();
    chk(nr === 'gone' && notFound.log.includes('toast ' + notFound.box.MSG.gone) && count(notFound.log, /^GET box$/) === 2 && !notFound.log.some((l) => l.startsWith('error')), '서버가 404 GIFT_NOT_FOUND → 안내 · 받기 한 번 · 번호 0');
  }

  say('── 4. 쓰기');
  {
    const e = mk(S);
    await e.box.pull(false);
    chk(await e.box.star('a', true) === 'ok' && ids(e.box) === 'a★,b★,c(치움)' && e.box.box().starCount === 2, '⭐ 켜기 — 칸 · 숫자가 바뀜(서버 재조회 없음)');
    chk(await e.box.star('a', false) === 'ok' && e.box.box().starCount === 1 && count(e.log, /^GET box$/) === 1, '  ⭐ 끄기');
    const full = mk(S, { items: Array.from({ length: 21 }, (_, i) => gift('g' + i, 1000 + i, { starred: i < 20 })) });
    await full.box.pull(false);
    const fr = await full.box.star('g20', true);
    chk(fr === 'full' && full.log.includes('toast 즐겨찾기는 20개까지예요') && !full.log.some((l) => /PATCH/.test(l)) && !full.log.some((l) => l.startsWith('error')), '⭐ 21번째 → 안내(starMax 숫자) · 요청 0 · 번호 0');
    const srvFull = mk(S, { starErr: apiErr(409, 'GIFT_STAR_FULL') });
    await srvFull.box.pull(false);
    chk(await srvFull.box.star('a', true) === 'full' && !srvFull.log.some((l) => l.startsWith('error')) && srvFull.log.includes('toast 즐겨찾기는 20개까지예요'), '서버가 GIFT_STAR_FULL → 안내 · 번호 0');
    const bad = mk(S, { starErr: apiErr(503, 'X') });
    await bad.box.pull(false);
    chk(await bad.box.star('a', true) === 'failed' && bad.log.includes('error E-GIFT-05') && ids(bad.box) === 'a,b★,c(치움)', '⭐ 실패 → E-GIFT-05 · 칸은 그대로');
    const hid = mk(S);
    await hid.box.pull(false);
    chk(await hid.box.hide('a', true) === 'ok' && ids(hid.box) === 'a(치움),b★,c(치움)' && hid.log.includes('PATCH a hidden=true'), '치움 — 서버에 hidden · 칸 반영');
    chk(await hid.box.hide('c', false) === 'ok' && ids(hid.box) === 'a(치움),b★,c', '  다시 부르기(hidden=false)');
    const hbad = mk(S, { hideErr: apiErr(503, 'X') });
    await hbad.box.pull(false);
    chk(await hbad.box.hide('a', true) === 'failed' && hbad.log.includes('error E-GIFT-05') && ids(hbad.box) === 'a,b★,c(치움)', '치움 실패 → E-GIFT-05 · 그대로(부르는 쪽이 다시 띄운다)');
    const del = mk(S);
    await del.box.pull(false);
    chk(await del.box.remove('a') === 'ok' && ids(del.box) === 'b★,c(치움)' && del.log.includes('DELETE a'), '지우기 — 서버 · 칸에서 빠짐');
    chk(await del.box.remove('b') === 'starred' && count(del.log, /DELETE/) === 1 && del.log.includes('toast ' + del.box.MSG.starred), '⭐ 는 지우기 요청 0 · 안내');
    const dbad = mk(S, { delErr: apiErr(503, 'X') });
    await dbad.box.pull(false);
    chk(await dbad.box.remove('a') === 'failed' && dbad.log.includes('error E-GIFT-06') && ids(dbad.box) === 'a,b★,c(치움)', '지우기 실패 → E-GIFT-06 · 그대로');
    const srvStar = mk(S, { delErr: apiErr(409, 'GIFT_STARRED') });
    await srvStar.box.pull(false);
    chk(await srvStar.box.remove('a') === 'starred' && !srvStar.log.some((l) => l.startsWith('error')), '서버가 GIFT_STARRED → 안내 · 번호 0');
    await flush();
    chk(count(srvStar.log, /^GET box$/) === 2, '  화면이 서버와 어긋났다 → 받기 한 번');
  }

  say('── 5. 봤음 · 서브탭');
  {
    const e = mk(S);
    chk(await e.box.openTab() === 'ready' && e.log.join() === 'GET box,POST seen' && e.box.box().unseenCount === 0, '서브탭 — 받기 → 안 본 게 있으면 봤음 · 배지 0');
    chk(await e.box.openTab() === 'ready' && count(e.log, /POST seen/) === 1, '  안 본 게 없으면 봤음을 안 보낸다');
    const bad = mk(S, { seenErr: apiErr(503, 'X') });
    await bad.box.openTab();
    chk(bad.box.box().unseenCount === 2 && !bad.log.some((l) => l.startsWith('error')), '봤음 실패 → 번호 0 · 배지 남음');
    bad.srv.seenErr = null;
    await bad.box.openTab();
    chk(bad.box.box().unseenCount === 0 && count(bad.log, /POST seen/) === 2, '  다음 누름에 한 번 더');
    const down = mk(S, { boxErr: apiErr(503, 'X') });
    chk(await down.box.openTab() === 'failed' && down.log.includes('error E-GIFT-04') && !down.log.some((l) => /POST seen/.test(l)), '받기가 실패하면 봤음을 안 보낸다 · E-GIFT-04');
    const order = mk(S, { auto: false });
    const t = order.box.openTab();
    await order.release();
    chk(order.log.join() === 'GET box,POST seen' || order.log.join() === 'GET box', '받기가 끝난 뒤에야 봤음(같은 줄에 차례로)');
    await order.release(); await t;
    chk(order.log.join() === 'GET box,POST seen' && order.box.box().unseenCount === 0, '  봤음이 끝난 뒤의 값이 0(받기 답이 배지를 다시 켜지 않음)');
  }

  say('── 6. 신호 · 계정');
  {
    const e = mk(S);
    chk(e.log.length === 0, '만들 때 구독 · 요청 없음');
    const off = e.box.listen();
    chk(e.log.join() === 'rtOn gifts' && e.box.listen() === off && count(e.log, /rtOn/) === 1, 'listen() 이 신호 `gifts` 를 한 번 건다(두 번 불러도 한 번)');
    e.signal(); await flush();
    chk(count(e.log, /^GET box$/) === 0, 'idle 에서 신호 → 요청 0');
    await e.box.pull(false);
    e.signal(); await flush();
    chk(count(e.log, /^GET box$/) === 2 && !e.log.some((l) => l.startsWith('error')), 'ready 에서 신호 1번 → GET 1번 · 번호 0');
    e.srv.boxErr = apiErr(503, 'X');
    e.signal(); await flush();
    chk(!e.log.some((l) => l.startsWith('error')), '  신호로 받다 실패해도 번호 0');
    e.box.reset();
    chk(e.box.box().load === 'idle' && e.box.box().unseenCount === null && e.log.includes('rtOff gifts') && e.log.includes('api reset'), 'reset → idle · 숫자 모름 · 구독 해제 · 길 reset');
    const n = count(e.log, /^GET box$/);
    e.signal(); await flush();
    chk(count(e.log, /^GET box$/) === n, '  reset 뒤 신호 → 요청 0');
    const late = mk(S, { auto: false });
    const p = late.box.pull(true);
    await flush();
    late.box.reset();
    await late.release();
    chk(await p === 'stale' && late.box.box().load === 'idle' && late.box.box().items.length === 0 && !late.log.some((l) => l.startsWith('error')), 'reset 뒤에 도착한 앞 계정의 받기 답은 버린다');
    const lateWrite = mk(S, { auto: false });
    const pl = lateWrite.box.pull(false); await lateWrite.release(); await pl;
    const w = lateWrite.box.star('a', true);
    await flush();
    lateWrite.box.reset();
    await lateWrite.release();
    chk(await w === 'stale' && lateWrite.box.box().items.length === 0, '  쓰는 중 reset → 늦은 답이 새 계정 칸을 바꾸지 않음');
    /* reset 때 옛 계정의 받기가 줄에 남아 있어도 새 계정의 «줄에 선 받기» 표시(합치기 · notify)를 지우지 않는다 */
    const old = mk(S, { auto: false });
    old.box.pull(false); await flush();                      // 받는 중(J0)
    old.box.pull(false);                                     // 줄에 선 옛 받기(J1)
    old.box.reset();
    old.box.pull(false); await flush();                      // 새 계정의 받기(J2 — 받는 중)
    const j3 = old.box.pull(true);                           // J2 뒤에 선 notify 받기(J3)
    old.waits.shift()(); await flush(); await flush();       // 옛 J0 이 끝나 옛 J1 이 시작한다
    const j4 = old.box.pull(false);
    chk(j4 === j3, 'reset 때 줄에 남은 옛 받기가 새 계정의 줄에 선 받기 표시를 지우지 않는다(뒤에 부른 받기가 J3 에 합쳐짐)');
    old.srv.boxErr = apiErr(503, 'X'); await old.release(5);
    chk(old.log.includes('error E-GIFT-04'), '  합쳐진 받기가 notify 를 지켜 실패하면 번호가 뜬다');
    const owner = mk(S, { starErr: Object.assign(new Error('x'), { code: 'OWNER_CHANGED', kind: 'owner' }) });
    await owner.box.pull(false);
    chk(await owner.box.star('a', true) === 'stale' && !owner.log.some((l) => l.startsWith('error') || l.startsWith('toast')), '주인이 바뀜(OWNER_CHANGED)은 조용히 버림');
  }

  say('── 7. 그 집 선물');
  {
    const e = mk(S);
    const r = await e.box.fetchVisible('F1', { notify: true });
    chk(r.ok && r.items.length === 1 && r.items[0].id === 'v1' && r.visibleCount === 1 && r.recipientCap === 30 && e.log.join() === 'GET visible F1', '받으면 선물 줄 · 수 · 정원(저장 안 함)');
    chk(e.box.box().load === 'idle', '  내 선물함 상태는 건드리지 않는다');
    const miss = mk(S, { visErr: apiErr(404, 'USER_NOT_FOUND') });
    const m = await miss.box.fetchVisible('F1', { notify: true });
    chk(!m.ok && m.kind === 'missing' && !miss.log.some((l) => l.startsWith('error')), '없는 사람은 번호 0');
    const bad = mk(S, { visErr: apiErr(503, 'X') });
    const b1 = await bad.box.fetchVisible('F1', { notify: true });
    const b2 = await bad.box.fetchVisible('F1');
    chk(!b1.ok && !b2.ok && count(bad.log, /error E-GIFT-09/) === 1, '실패는 notify 일 때만 E-GIFT-09');
  }

  say('── 8. 배선 · 옛 길 걷음');
  wiring(S, true);
}

function wiring(S, loud){
  let ok = true;
  const t = (c, msg) => { if(!c) ok = false; if(loud) chk(c, msg); };
  const A = strip(S.APP);
  t((A.match(/TwGiftBox\.createGiftBox\(/g) || []).length === 1, 'app.js 가 만드는 곳은 한 곳(const giftBoxMod)');
  const call = (S.APP.match(/const giftBoxMod = TwGiftBox\.createGiftBox\(\{([\s\S]*?)\n\}\);/) || [])[1] || '';
  const deps = call.split('\n').map((x) => x.trim()).filter((x) => x && !x.startsWith('//'));
  t(deps.length === 4 && /^api: giftApiMod, giftLib: TwGiftApi/.test(deps[0]) && deps.some((d) => /^rtOn: \(kind, fn\)=>TwRtHub\.store\.on\(kind, fn\),$/.test(d)), '  deps — api(gift-api) · giftLib · errs · apiErrors · notifyError · toast · rtOn(신호)');
  const iBox = A.indexOf('const giftBoxMod = '), iMl = A.indexOf('const mallangMod = TwMallang.createMallang(');
  const inboxAt = A.indexOf('TwMyHomeInbox.createMyHomeInbox('), uiAt = A.indexOf('TwMyHomeUi.createMyHomeUi(');
  t(iBox > 0 && iBox < iMl && iMl < inboxAt && iMl < uiAt, '  말랑이 화면 · 수령함 · 마이홈 창보다 먼저 만든다');
  t(/giftBox: giftBoxMod,/.test(S.APP.slice(S.APP.indexOf('const mallangMod = '), S.APP.indexOf('const mallangMod = ') + 600)), '  말랑이 화면 deps 에 giftBox');
  t([inboxAt, uiAt].every((i) => /\n  giftBox: giftBoxMod,\n/.test(A.slice(i, A.indexOf('\n});', i) + 4))), '  수령함 · 마이홈 창 deps 에 giftBox');
  t(/\n  giftBox: giftBoxMod,\n/.test(A.slice(A.indexOf('const accountMod = TwAccount.createAccount('), A.indexOf('\n});', A.indexOf('const accountMod = TwAccount.createAccount(')) + 4)) && /giftBox\.reset\(\)/.test(strip(S.ACC)), '  계정 모듈이 로그아웃 때 giftBox.reset()');
  t(/'mhInit',[^\n]*\n\s*'gift',/.test(S.BOOT), 'app-boot STEPS 에 gift(마이홈 시작 다음)');
  t(/gift: \(code, me, session\)=>\{[^}]*session\.on\(giftBoxMod\.listen\(\)\)[^}]*session\.onReset\(/.test(S.APP), '  gift 시작은 신호만 건다(listen) + 세션 reset(요청 0)');
  const H = S.HTML.replace(/<!--[\s\S]*?-->/g, '');
  const at = (f) => H.indexOf('<script src="parts/' + f + '"');
  t(at('myhome/gift-api.js') > 0 && at('myhome/gift-box.js') > at('myhome/gift-api.js') && at('myhome/gift-box.js') < at('myhome/mallang.js') && at('myhome/gift-box.js') < at('app.js'), 'html — gift-box.js 는 gift-api.js 뒤 · mallang.js · app.js 앞');
  t(/PRELOAD\.push\('gift-box\.js'\)/.test(S.SMOKE), 'smoke.js PRELOAD 에 gift-box.js');
  const noFb = strip(S.APP + S.INBOX + S.UI + S.ML);
  t(!/firebaseAPI\.(deleteMallangGift|setMallangGiftHidden|setMallangGiftStarred|getMallangGiftSeen|setMallangGiftSeen)/.test(noFb) && !/(deleteMallangGift|setMallangGiftHidden|setMallangGiftStarred|getMallangGiftSeen|setMallangGiftSeen)\s*\(/.test(strip(S.FB)),
    '옛 Firebase 선물 읽기 · 쓰기(삭제 · 치움 · ⭐ · 봤음)를 부르는 곳도 정의도 없다');
  t(!/mallangGiftHidden/.test(strip(S.ML + S.APP + S.STORE)) && !/giftOverflow|giftOrder|GIFT_STAR_MAX|GIFT_MAX\b/.test(strip(S.ML)), '이 PC 에 «치움» 을 적지 않는다 · 앱이 보관 한도를 넘으면 지우는 장치 · 상한 상수가 글에 없다');
  const inb = strip(S.INBOX);
  const paint = inb.slice(inb.indexOf('function _giftBoxPaint'), inb.indexOf('function _mhAsk'));
  const ask = inb.slice(inb.indexOf('function _mhAsk'), inb.indexOf('function _inboxMarkRead'));
  t(/closest\('\.gift-star'\)\)\{\s*ev\.stopPropagation\(\)/.test(paint), '화면 — ⭐ 클릭은 stopPropagation 후 칸 클릭(다시 부르기)으로 안 간다');
  t(/b\.starCount\+'\/'\+b\.starMax\+' · 보관 '\+items\.length\+'\/'\+b\.boxKeep/.test(paint), '  「⭐ n/starMax · 보관 m/boxKeep」 는 서버 숫자');
  t(/g\.starred === true\)\{\s*_mhAsk\([^)]*⭐를 먼저 풀어 주세요/.test(paint), '  ⭐ 칸 우클릭은 삭제 대신 안내');
  t(/getElementById\('myHomeWin'\)/.test(ask) && /win\.appendChild\(ov\)/.test(ask) && !/document\.body\.appendChild/.test(ask) && !/\bconfirm\(/.test(paint + ask), '  확인창은 #myHomeWin 의 자식 · confirm() 없음');
  t(/escHtml\(text\)/.test(ask) && /escHtml\(title\)/.test(ask) && /TwSafeHtml\.safeUrl\(g\.imageUrl, 'image'\)/.test(paint) && /escHtml\(tip\)/.test(paint), '  친구가 정한 값(이름 · 메시지 · 그림 주소)은 escHtml · safeUrl 을 거친다');
  const HTML0 = S.HTML;
  t(/id="mhGiftStat"/.test((HTML0.match(/<div id="mhFmTabs">[\s\S]*?<\/div>/) || [''])[0]), '  표시 칸(#mhGiftStat)은 서브탭 줄 안');
  return ok;
}

(async () => {
  await judge(SRC0);

  say('── 9. 일부러 깨 보기');
  {
    const run = async (name, src, fn) => {
      quiet = true; qfail = 0;
      try{ const S = Object.assign({}, SRC0, { BOX: src }); await fn(S); }catch(_){ qfail++; }
      const caught = qfail > 0; quiet = false;
      chk(caught, name + ' → 빨강');
    };
    const body = async (S) => {
      const e = mk(S, { auto: false });
      const pl = e.box.pull(false); await e.release(); await pl;
      e.srv.auto = false;
      const p = e.box.pull(false); await flush();
      const s = e.box.star('a', true); await flush();
      chk(count(e.log, /PATCH/) === 0, '줄');
      e.srv.items.find((x) => x.id === 'a').starred = true;
      await e.release(3); await Promise.all([p, s]);
      chk(ids(e.box) === 'a★,b★,c(치움)', '⭐ 남음');
    };
    await run('옛 받기가 새 받기 표시를 지우면', SRC0.BOX.replace("if(g !== gen) return 'stale';   // 옛 계정의 줄에 남은 받기 — 새 계정의 줄에 선 받기 표시(queued)를 건드리지 않는다\n      const n = queuedNotify;\n      queued = null; queuedNotify = false;", "const n = queuedNotify;\n      queued = null; queuedNotify = false;\n      if(g !== gen) return 'stale';"), async (S) => {
      const old = mk(S, { auto: false });
      old.box.pull(false); await flush(); old.box.pull(false); old.box.reset();
      old.box.pull(false); await flush(); const j3 = old.box.pull(true);
      old.waits.shift()(); await flush(); await flush();
      chk(old.box.pull(false) === j3, '합쳐짐');
    });
    await run('줄(lane)을 빼면', SRC0.BOX.replace('const p = laneTail.then(job); laneTail = p.catch(() => {}); return p;', 'return Promise.resolve().then(job);'), body);
    await run('gen 비교(reset 뒤 늦은 답)를 빼면', SRC0.BOX.replace(/if\(g !== gen\) return 'stale';\n    st\.items = got\.items;/, 'st.items = got.items;'), async (S) => {
      const late = mk(S, { auto: false }); const p = late.box.pull(true); await flush(); late.box.reset(); await late.release(); await p;
      chk(late.box.box().items.length === 0, '늦은 답 버림');
    });
    await run('busy 를 빼면', SRC0.BOX.replace("if(busy.has(id)) return Promise.resolve('busy');", ''), async (S) => {
      const e = mk(S, { auto: false }); const pl = e.box.pull(false); await e.release(); await pl;
      e.box.star('a', true); const r = await Promise.race([e.box.star('a', false), flush().then(() => 'x')]);
      chk(r === 'busy', '같은 id busy');
    });
    await run('⭐ 21번째 미리 막기를 빼면', SRC0.BOX.replace('st.starMax != null && st.starCount >= st.starMax', 'false'), async (S) => {
      const full = mk(S, { items: Array.from({ length: 21 }, (_, i) => gift('g' + i, 1000 + i, { starred: i < 20 })) });
      await full.box.pull(false); await full.box.star('g20', true);
      chk(!full.log.some((l) => /PATCH/.test(l)), '요청 0');
    });
    await run('⭐ 지우기 막기를 빼면', SRC0.BOX.replace("if(it.starred){ toast(MSG.starred); return 'starred'; }", ''), async (S) => {
      const d = mk(S); await d.box.pull(false); await d.box.remove('b');
      chk(!d.log.some((l) => /DELETE/.test(l)), '요청 0');
    });
    await run('idle 에서 신호를 받으면', SRC0.BOX.replace("if(st.load !== LOAD.IDLE) pull(false);", 'pull(false);'), async (S) => {
      const e = mk(S); e.box.listen(); e.signal(); await flush();
      chk(count(e.log, /GET box/) === 0, 'idle 신호 0');
    });
    await run('reset 이 구독을 안 풀면', SRC0.BOX.replace('    if(unsub) unsub();\n    emit();', '    emit();'), async (S) => {
      const e = mk(S); e.box.listen(); await e.box.pull(false); e.box.reset();
      chk(e.log.includes('rtOff gifts'), 'reset 이 구독을 푼다');
    });
    await run('안 본 게 없어도 봤음을 보내면', SRC0.BOX.replace('st.unseenCount > 0) await seen()', 'true) await seen()'), async (S) => {
      const e = mk(S, { unseen: 0 }); await e.box.openTab();
      chk(!e.log.some((l) => /POST seen/.test(l)), '봤음 0');
    });
    await run('순서에서 ⭐ 를 빼면', SRC0.BOX.replace("list.filter((x) => x.starred).sort(byNew).concat(list.filter((x) => !x.starred).sort(byNew))", 'list.sort(byNew)'), async (S) => {
      chk(mk(S).box.order([gift('a', 1, { starred: true }), gift('b', 2)])[0].id === 'a', '⭐ 먼저');
    });
    await run('안내 코드까지 번호로 띄우면', SRC0.BOX.replace("if(f.kind === KIND.GUIDE){", "if(false){"), async (S) => {
      const e = mk(S, { starErr: apiErr(409, 'GIFT_STAR_FULL') }); await e.box.pull(false); await e.box.star('a', true);
      chk(!e.log.some((l) => l.startsWith('error')), '번호 0');
    });
    const w = (patch) => !wiring(Object.assign({}, SRC0, patch), false);
    chk(w({ BOOT: SRC0.BOOT.replace("  'gift',", '') }), 'gift STEP 이 빠지면 빨강');
    chk(w({ INBOX: SRC0.INBOX + "\nfirebaseAPI.setMallangGiftStarred(1,2,3);" }), '옛 ⭐ 길을 다시 부르면 빨강');
    chk(w({ ML: SRC0.ML + "\nconst K = 'tw.mallangGiftHidden';" }), '이 PC «치움» 키가 다시 생기면 빨강');
    chk(w({ INBOX: SRC0.INBOX.replace("TwSafeHtml.safeUrl(g.imageUrl, 'image')", 'g.imageUrl') }), '그림 주소 safeUrl 을 빼면 빨강');
  }

  say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
  process.exit(fail ? 1 : 0);
})().catch((err) => { console.log('  ✗ 실행 오류 — ' + (err && err.stack || err)); process.exit(1); });
