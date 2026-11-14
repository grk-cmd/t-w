/* ═══ 🧸 sim-mallang-store.js — 말랑이 칸 상태 주인 (0.13 앱 묶음 D7-3) ═══
   [왜] 말랑이 칸(등록 · 켜고 끄기 · 지우기 · 내 집 · 남의 집)의 원본이 서버가 됐다. 저장은 통째 PUT 하나(판 version)라
     겹쳐 보내면 409 로 내 고침이 사라지고, 늦게 온 답이 새 집 · 새 계정 화면을 덮는다. 그래서 진짜 모듈을 가짜 서버 길 위에서 돌려 순서를 본다.
   ・1절: 받기 — 받기 전 고치기 잠금(요청 0) · 받은 칸(서버 번호 그대로) · 빈 칸 ≠ 못 받음 · 못 받음 E-GIFT-01 · 공통 code 는 공통 번호
   ・2절: 저장 — 저장 중 고침 두 번 → PUT 두 번(겹치지 않음 · 두 번째가 최신 · 앞 답이 고친 칸을 덮지 않음) · 끝나면 서버 칸 그대로 · 지우면 뒤 칸이 당겨짐
   ・3절: 409 · 실패 — 409 → 잠그고 GET 한 번 · 서버 것으로 · 알림 · 실패 → 화면 그대로 · 번호 한 번 · 혼자 다시 안 보냄 · flush 한 번
   ・4절: 등록 — 올리기 실패면 칸 그대로(E-GIFT-02 · PUT 0) · 올리는 중 또 → busy · 가득 → full · 성공은 PUT 뒤에 ok
   ・5절: 보는 집 · 계정 — 집 gen(앞 집 답이 늦게 와도 버림) · 없는 사람은 «없음»(번호 없음) · 내 집은 내 칸 · reset 뒤 답 버림 · 주인 바뀜은 조용히 · 저장 중 받기 요청 0
   ・6절: 배선 — html · smoke 순서 · app.js 가 만드는 줄 · Firebase · 로컬 저장 · 타이머 없음
   ・7절: 일부러 깨 보기
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
  ST: pick(P('mallang-store.js', 'myhome')), GIFT: pick(P('gift-api.js', 'myhome')), AE: pick(P('api-errors.js', 'shared')),
  APP: pick(['app.js', 'parts/app.js', 'app/parts/app.js', 'apps/desktop/app/parts/app.js']),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html', 'apps/desktop/app/desk-companion-prototype.html']),
  SMOKE: pick(['smoke.js', 'checks/smoke.js']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const loadMod = (src) => { const m = { exports: {} }; new Function('window', 'module', src)(undefined, m); return m.exports; };
const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
const flush = async () => { for(let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r)); };
const apiErr = (status, code) => Object.assign(new Error(code || String(status)), { status, code: code || '', kind: status >= 500 || status === 0 ? 'unavailable' : (status === 401 || status === 403) ? 'auth' : 'request' });
const slot = (i, name, on) => ({ slot: i, imageUrl: 'https://img/' + name + '.png', enabled: on !== false });

/* 가짜 서버 길 — 부른 것을 적고, 답은 손으로 푼다(hold) 또는 바로(auto) */
function mk(S, server){
  const log = [], waits = [];
  const srv = Object.assign({ slots: [slot(0, 'a'), slot(1, 'b')], version: 3, auto: true }, server || {});
  const answer = (fn) => new Promise((res, rej) => {
    const go = () => { try{ const v = fn(); if(v instanceof Error) rej(v); else res(v); }catch(e){ rej(e); } };
    if(srv.auto) go(); else waits.push(go);
  });
  const copy = () => ({ slots: srv.slots.map((x) => Object.assign({}, x)), version: srv.version });
  const api = {
    fetchMine: () => { log.push('GET mine'); return answer(() => (srv.mineErr ? srv.mineErr : copy())); },
    fetchOf: (code) => { log.push('GET of ' + code); return answer(() => (srv.ofErr && srv.ofErr[code]) || { slots: (srv.of && srv.of[code]) || [], version: 1 }); },
    uploadImage: (d) => { log.push('POST image'); return answer(() => (srv.upErr ? srv.upErr : 'https://img/up' + log.length + '.png')); },
    saveMallangs: (version, slots) => {
      const body = JSON.stringify(slots.map((x) => [x.imageUrl.replace('https://img/', ''), x.enabled]));
      log.push('PUT v' + version + ' ' + body);
      return answer(() => (srv.putErr ? srv.putErr : copyAfter(slots)));
    },
    reset: () => { log.push('api reset'); },
  };
  function copyAfter(slots){ srv.version++; srv.slots = slots.map((x, i) => ({ slot: i, imageUrl: x.imageUrl, enabled: x.enabled })); return copy(); }
  const st = loadMod(S.ST).createMallangStore({ api, giftLib: loadMod(S.GIFT), errs: loadMod(S.AE),
    apiErrors: { notify: (e) => log.push('common ' + (e && e.code)) }, notifyError: (c) => log.push('error ' + c), toast: (m) => log.push('toast ' + m) });
  let changes = 0; st.onChange(() => { changes++; });
  const release = async (n) => { for(let i = 0; i < (n || 1); i++){ const go = waits.shift(); if(go) go(); await flush(); } };
  return { st, log, srv, waits, release, changes: () => changes };
}
const names = (st) => st.mine().slots.map((x) => x.imageUrl.replace('https://img/', '').replace('.png', '') + (x.enabled ? '' : '(꺼짐)') + (x.slot === undefined ? '' : '#' + x.slot)).join(',');
const count = (log, re) => log.filter((l) => re.test(l)).length;

async function judge(S){
  say('── 1. 받기');
  {
    const e = mk(S);
    chk(await e.st.toggle(0) === 'locked' && await e.st.remove(0) === 'locked' && await e.st.add('data:x') === 'locked' && e.log.length === 0, '받기 전엔 켜고 끄기 · 지우기 · 등록이 잠김(요청 0)');
    chk(e.st.mine().load === 'idle', '  처음은 idle');
    const ok = await e.st.pullMine();
    chk(ok && e.st.mine().load === 'ready' && names(e.st) === 'a#0,b#1' && e.st.mine().version === 3 && count(e.log, /^GET mine$/) === 1, '받으면 ready · 서버 칸(번호 그대로) · 판');
    const empty = mk(S, { slots: [] });
    chk(await empty.st.pullMine() && empty.st.mine().load === 'ready' && empty.st.mine().slots.length === 0, '빈 칸은 ready + 빈 배열(«말랑이 없음»)');
    const down = mk(S, { mineErr: apiErr(503, 'X') });
    chk(!(await down.st.pullMine()) && down.st.mine().load === 'failed' && down.log.includes('error E-GIFT-01'), '못 받음 → failed · E-GIFT-01(빈 칸과 다른 상태)');
    chk(await down.st.toggle(0) === 'locked', '  못 받은 동안 고치기 잠금');
    const prem = mk(S, { mineErr: apiErr(403, 'PREMIUM_REQUIRED') });
    await prem.st.pullMine();
    chk(prem.log.includes('common PREMIUM_REQUIRED') && !prem.log.includes('error E-GIFT-01'), '공통 code 는 공통 번호(그 자리 번호 대신)');
    const send = mk(S, { mineErr: apiErr(503, 'X') });
    chk(!(await send.st.pullMine({ site: 'sendOpen' })) && send.log.includes('error E-GIFT-07'), '보내기 창 열기의 받기 실패는 E-GIFT-07');
    const hold = mk(S, { auto: false });
    const p1 = hold.st.pullMine(), p2 = hold.st.pullMine();
    chk(p1 === p2 && count(hold.log, /^GET mine$/) === 1, '받는 중에 또 받기 → 같은 약속(요청 1)');
    await hold.release();
  }

  say('── 2. 저장');
  {
    const e = mk(S, { auto: false });
    const pl = e.st.pullMine(); await e.release(); await pl;
    const t1 = e.st.toggle(1);
    chk(names(e.st) === 'a#0,b(꺼짐)#1' && e.st.mine().saving, '켜고 끄기 — 화면 칸을 먼저 바꾸고 저장 중');
    const t2 = e.st.remove(0);
    chk(count(e.log, /^PUT/) === 1 && names(e.st) === 'b(꺼짐)', '저장 중 또 고침 → 아직 PUT 1(겹치지 않음) · 화면은 최신(지운 뒤 남은 칸의 서버 번호는 답이 올 때까지 모름)');
    await e.release();
    chk(count(e.log, /^PUT/) === 2 && e.log.filter((l) => /^PUT/.test(l))[1] === 'PUT v4 [["b.png",false]]', '앞 저장이 끝나면 최신 칸 · 새 판으로 한 번 더');
    chk(names(e.st) === 'b(꺼짐)', '  앞 저장의 답이 그 사이 고친 칸을 덮지 않는다');
    await e.release();
    const [r1, r2] = await Promise.all([t1, t2]);
    chk(r1 === 'ok' && r2 === 'ok' && names(e.st) === 'b(꺼짐)#0' && e.st.mine().version === 5 && !e.st.mine().saving, '끝나면 서버가 돌려준 칸(번호 0부터)을 그대로 받는다 · 둘 다 ok');
    chk(count(e.log, /^PUT/) === 2 && count(e.log, /^GET/) === 1, '  요청은 GET 1 · PUT 2 뿐');
    const d = mk(S, { slots: [slot(0, 'a'), slot(1, 'b'), slot(2, 'c')] });
    await d.st.pullMine(); await d.st.remove(0);
    chk(names(d.st) === 'b#0,c#1', '지우면 뒤 칸이 앞으로 당겨진다(지금 화면 그대로)');
  }

  say('── 3. 409 · 실패');
  {
    const e = mk(S, { putErr: apiErr(409, 'CONCURRENT_UPDATE') });
    await e.st.pullMine();
    e.srv.slots = [slot(0, 'z')]; e.srv.version = 9;   // 다른 기기가 먼저 고침
    const r = await e.st.toggle(0);
    chk(r === 'conflict' && count(e.log, /^GET mine$/) === 2 && names(e.st) === 'z#0' && e.st.mine().version === 9, '409 → 다시 받아 서버 것으로(내 고침은 버림)');
    chk(e.log.includes('toast 다른 기기에서 바꾼 내용을 받아왔어요') && !e.log.some((l) => /^error/.test(l)), '  «다른 기기에서 바꾼 내용을 받아왔어요» · 오류 번호 없음');
    const h = mk(S, { putErr: apiErr(409, 'CONCURRENT_UPDATE'), auto: false });
    const hp = h.st.pullMine(); await h.release(); await hp;
    const hr = h.st.toggle(0);
    await h.release();
    chk(h.st.mine().load === 'loading' && await h.st.toggle(0) === 'locked', '  다시 받는 동안 고치기 잠금');
    await h.release(); await hr;

    const f = mk(S, { putErr: apiErr(503, 'X') });
    await f.st.pullMine();
    const fr = await f.st.toggle(0);
    await flush();
    chk(fr === 'failed' && names(f.st) === 'a(꺼짐)#0,b#1' && count(f.log, /^PUT/) === 1 && count(f.log, /^error E-GIFT-03$/) === 1, '실패 → 화면은 고친 대로 · E-GIFT-03 한 번 · 혼자 다시 보내지 않음');
    await f.st.toggle(1);
    chk(count(f.log, /^PUT/) === 2 && count(f.log, /^error E-GIFT-03$/) === 1, '  이어지는 실패는 번호 한 번(다음 고침이 다시 보냄)');
    chk(await f.st.pullMine() && count(f.log, /^GET mine$/) === 1, '  못 올린 고침이 있으면 받기가 화면을 덮지 않는다(요청 0)');
    f.srv.putErr = null;
    chk(await f.st.flush() === 'ok' && count(f.log, /^PUT/) === 3, 'flush — 못 올린 고침을 한 번 올린다');
    chk(await f.st.flush() === 'none' && count(f.log, /^PUT/) === 3, '  올릴 것이 없으면 요청 0');
    f.srv.putErr = apiErr(503, 'X');
    await f.st.toggle(0);
    chk(count(f.log, /^error E-GIFT-03$/) === 2, '  성공 뒤 다시 실패하면 번호를 다시 알린다');
    const inv = mk(S, { putErr: apiErr(400, 'GIFT_MALLANG_INVALID') });
    await inv.st.pullMine(); await inv.st.toggle(0);
    chk(inv.log.includes('error E-GIFT-03'), 'GIFT_MALLANG_INVALID 도 E-GIFT-03');
    const sv = mk(S, { auto: false });
    const sp = sv.st.pullMine(); await sv.release(); await sp;
    const sf = sv.st.toggle(0);
    const fl = sv.st.flush();
    chk(fl === sf, 'flush — 저장 중이면 그 저장의 끝을 기다린다');
    await sv.release(); await fl;
  }

  say('── 4. 등록');
  {
    const e = mk(S);
    await e.st.pullMine();
    const r = await e.st.add('data:image/png;base64,AA');
    const puts = e.log.filter((l) => /^PUT/.test(l));
    chk(r === 'ok' && e.log.indexOf('POST image') < e.log.indexOf(puts[0]) && /"up\d+\.png",true\]\]$/.test(puts[0]) && e.st.mine().slots.length === 3 && e.st.mine().slots[2].slot === 2,
      '올리기 → 칸 끝에 더해 저장 → 서버 칸 · ok 는 PUT 뒤');
    const up = mk(S, { upErr: apiErr(503, 'X') });
    await up.st.pullMine();
    const ur = await up.st.add('data:x');
    chk(ur === 'uploadFailed' && up.log.includes('error E-GIFT-02') && count(up.log, /^PUT/) === 0 && names(up.st) === 'a#0,b#1' && !up.st.mine().uploading, '올리기 실패 → 칸 그대로 · E-GIFT-02 · 저장 요청 0');
    const b = mk(S, { auto: false });
    const bp = b.st.pullMine(); await b.release(); await bp;
    const a1 = b.st.add('data:x');
    chk(b.st.mine().uploading && await b.st.add('data:y') === 'busy' && count(b.log, /^POST/) === 1, '올리는 중 또 등록 → busy(요청 1)');
    await b.release(); await b.release(); await a1;
    const full = mk(S, { slots: [slot(0, 'a'), slot(1, 'b'), slot(2, 'c'), slot(3, 'd')] });
    await full.st.pullMine();
    chk(await full.st.add('data:x') === 'full' && count(full.log, /^POST/) === 0, '칸 4개 가득 → full(요청 0)');
  }

  say('── 5. 보는 집 · 계정');
  {
    const e = mk(S, { auto: false, of: { A: [slot(0, 'fa')], B: [slot(0, 'fb'), slot(1, 'fb2')] } });
    const pa = e.st.openView('A', false), pb = e.st.openView('B', false);
    e.waits.reverse();   // B 답이 먼저, A 답이 뒤에
    await e.release(2);
    chk(await pa === false && await pb === true && e.st.view().owner === 'B' && e.st.view().slots.length === 2, '집을 빨리 옮김 — 늦게 온 앞 집(A) 답은 버린다');
    const c = mk(S, { auto: false, of: { A: [slot(0, 'fa')] } });
    const pc = c.st.openView('A', false); c.st.closeView(); await c.release();
    chk(await pc === false && c.st.view().slots.length === 0, '닫는 중에 온 답은 아무것도 그리지 않는다');
    const nf = mk(S, { ofErr: { X: apiErr(404, 'USER_NOT_FOUND') } });
    chk(await nf.st.openView('X', false) && nf.st.view().load === 'ready' && nf.st.view().slots.length === 0 && !nf.log.some((l) => /^error|^common/.test(l)), '없는 사람 → «말랑이 없음»(번호 없음)');
    const bad = mk(S, { ofErr: { Y: apiErr(503, 'X') } });
    await bad.st.openView('Y', false);
    chk(bad.st.view().load === 'failed' && bad.log.includes('error E-GIFT-01'), '그 집 칸 못 받음 → failed · E-GIFT-01');
    const me = mk(S);
    chk(await me.st.openView('ME', true) && me.st.view().mine && me.st.view().slots.length === 2 && count(me.log, /^GET mine$/) === 1 && count(me.log, /^GET of/) === 0, '내 집은 내 칸을 가리킨다(GET /v1/me/mallangs)');

    const r = mk(S, { auto: false });
    const rp = r.st.pullMine(); await r.release(); await rp;
    const rt = r.st.toggle(0);
    r.st.reset();
    await r.release();
    chk(await rt === 'stale' && r.st.mine().load === 'idle' && r.st.mine().slots.length === 0 && !r.log.some((l) => /^error|^toast/.test(l)) && r.log.includes('api reset'), '계정을 놓음(reset) → 늦게 온 저장 답은 버림 · 상태 idle · 주인 기억 비움');
    const r2 = mk(S, { auto: false });
    const r2p = r2.st.pullMine(); r2.st.reset(); await r2.release();
    chk(await r2p === false && r2.st.mine().load === 'idle', '  reset 전에 나간 받기의 답도 버림');
    const own = mk(S, { putErr: Object.assign(new Error('x'), { code: 'OWNER_CHANGED' }) });
    await own.st.pullMine();
    chk(await own.st.toggle(0) === 'stale' && !own.log.some((l) => /^error|^common/.test(l)), '주인이 바뀜(OWNER_CHANGED) → 조용히 버림');
    const busy = mk(S, { auto: false });
    const bp = busy.st.pullMine(); await busy.release(); await bp;
    busy.st.toggle(0);
    chk(await busy.st.pullMine() === true && count(busy.log, /^GET mine$/) === 1, '저장 중 내 칸 받기 → 받지 않고 지금 칸(요청 0)');
    await busy.release();
  }

  say('── 6. 배선');
  {
    const h = S.HTML, tag = (f) => h.indexOf('<script src="parts/' + f + '"></script>');
    chk(tag('myhome/gift-api.js') > 0 && tag('myhome/mallang-store.js') > tag('myhome/gift-api.js') && tag('myhome/mallang.js') > tag('myhome/mallang-store.js') && tag('app.js') > tag('myhome/mallang-store.js'),
      'html — gift-api.js → mallang-store.js → mallang.js · app.js');
    chk(/PRELOAD\.push\('mallang-store\.js'\)/.test(S.SMOKE) && S.SMOKE.indexOf("PRELOAD.push('mallang-store.js')") > S.SMOKE.indexOf("PRELOAD.push('gift-api.js')"), 'smoke PRELOAD 에 mallang-store.js(gift-api.js 뒤)');
    const A = strip(S.APP);
    const iApi = A.indexOf('const giftApiMod = TwGiftApi.createGiftApi({ authed: TwApi.authed'), iSt = A.indexOf('const mallangStoreMod = TwMallangStore.createMallangStore('), iMl = A.indexOf('const mallangMod = TwMallang.createMallang(');
    chk(iApi > 0 && iSt > iApi && iMl > iSt && (A.match(/TwMallangStore\.createMallangStore\(/g) || []).length === 1, 'app.js — 서버 길 → 칸 상태 주인 → 말랑이 화면 차례로 한 번');
    chk(/addEventListener\('beforeunload', \(\)=>\{ mallangStoreMod\.flush\(\); \}\)/.test(A), '  앱을 끌 때 못 올린 고침 한 번(flush)');
    const ST = strip(S.ST);
    chk(!/firebase|localStorage|setTimeout|setInterval/.test(ST), '칸 상태 주인은 Firebase · 로컬 저장 · 타이머를 쓰지 않는다(자동 재시도 없음)');
  }
}

(async () => {
  await judge(SRC0);
  say('── 7. 일부러 깨 보기');
  const S = SRC0;
  const breaks = [
    ['저장 중 고침을 끝난 뒤 안 보냄(again 빠짐)', S.ST.replace("if(saving){ again = true; return saveP; }", "if(saving){ return saveP; }"), 'again'],
    ['저장 중에도 겹쳐 보냄', S.ST.replace("if(saving){ again = true; return saveP; }", ""), '겹침'],
    ['앞 저장 답이 고친 칸을 덮음', S.ST.replace("if(!again){ mineSt.slots = got.slots; res = 'ok'; break; }", "mineSt.slots = got.slots; if(!again){ res = 'ok'; break; }"), '덮음'],
    ['409 에서 다시 받지 않음', S.ST.replace("await pullMine({ merged: true });", ""), '409'],
    ['실패 번호를 매번', S.ST.replace("        if(!failing){\n", "        if(true){\n"), '한 번'],
    ['집 gen 비교 빠짐', S.ST.replace("if(g !== gen || vg !== viewSt.gen) return false;\n      viewSt.slots", "if(g !== gen) return false;\n      viewSt.slots"), 'gen'],
    ['reset 뒤 답을 안 버림', S.ST.replace("      if(g !== gen) return 'stale';\n      mineSt.version = got.version;", "      mineSt.version = got.version;"), 'reset'],
    ['저장 중에도 받아 덮음', S.ST.replace("if(saving || again || failing) return Promise.resolve(mineSt.load === LOAD.READY);", ""), '덮지 않음'],
    ['받기 전에도 고침', S.ST.replace("const editable = () => mineSt.load === LOAD.READY;", "const editable = () => true;"), '잠금'],
    ['올리기 busy 빠짐', S.ST.replace("if(uploading) return 'busy';", ""), 'busy'],
    ['없는 사람에 번호', S.ST.replace("if(f.kind === KIND.MISSING){ viewSt.slots = []; viewSt.load = LOAD.READY; }", "if(false){}"), '없음'],
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
