/* ═══ 🎁 sim-mallang-gift.js — 선물 보내기 창 (0.13 앱 묶음 D7-5) — 옛 «사본 로직 뜯어 돌리기» 를 갈음 ═══
   [왜] 보내기가 서버 길(POST /v1/gifts/{code})이 됐다. 그림 사본 · 하루 한도 · 정원 판정은 서버가 하고, 앱은 창 · 요청 번호(requestId) · 격자 잠금만 맡는다.
     진짜 mallang.js · mallang-store.js · gift-box.js · request-id.js 를 가짜 DOM · 가짜 서버 길 위에서 돌려 부른 요청 · 화면을 본다.
   ・1절: 열기 — 내 칸 · 오늘 보낸 수 · 상대 집 선물 수를 나란히 받는다 · 남은 횟수 · 칸이 비면 안내 · 내 칸 실패 E-GIFT-07(창 안 엶) · 남은 수 실패 «확인하지 못했어요» + 막지 않음
   ・2절: 보내기 — 본문은 요청 번호 · 고른 칸의 서버 번호 · 메시지만 · 성공은 안내 + 창 닫음 · 보내는 동안 격자 전체 잠김(다른 칸으로 두 번 안 감)
   ・3절: 요청 번호 — 닿지 못함 → 같은 번호 · 서버가 거절 → 새 번호 · 성공 → 새 번호
   ・4절: 실패 — 안내 코드는 서버 문구(번호 0) · 503 은 E-GIFT-08 · 격자는 다시 켜짐
   ・5절: 정원 · 한도 — 상대 가득 → 격자 흐림 · 눌러도 요청 0 · 남은 0 → 요청 0
   ・6절: 칸 저장이 끝나면 격자를 다시 그림 · 저장 중인 새 칸(서버 번호 없음)은 보내지 않음
   ・7절: 옛 길 걷음 · 일부러 깨 보기
   [실행] 러너 스테이징(평면)에서. */
'use strict';
const fs = require('fs');
const vm = require('vm');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find(Boolean);
const P = (f, dir) => [f, 'parts/' + dir + '/' + f, 'app/parts/' + dir + '/' + f, 'apps/desktop/app/parts/' + dir + '/' + f];
const SRC0 = {
  ML: pick(P('mallang.js', 'myhome')), STORE: pick(P('mallang-store.js', 'myhome')), BOX: pick(P('gift-box.js', 'myhome')), GIFT: pick(P('gift-api.js', 'myhome')),
  AE: pick(P('api-errors.js', 'shared')), SAFE: pick(P('safe-html.js', 'shared')), RETRY: pick(P('img-retry.js', 'shared')), RID: pick(P('request-id.js', 'shared')),
  FB: pick(['firebase-init.js', 'parts/firebase-init.js', 'app/parts/firebase-init.js', 'apps/desktop/app/parts/firebase-init.js']),
  APP: pick(['app.js', 'parts/app.js', 'app/parts/app.js', 'apps/desktop/app/parts/app.js']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const loadMod = (src, extra) => { const m = { exports: {} }; new Function('window', 'module', 'TwSafeHtml', src)(undefined, m, extra); return m.exports; };
const flush = async () => { for(let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r)); };
const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
const apiErr = (status, code, msg) => Object.assign(new Error(msg || code || String(status)), { status, code: code || '', kind: status === 0 ? 'network' : status >= 500 ? 'unavailable' : (status === 401 || status === 403) ? 'auth' : 'request' });

function mkEnv(S, o){
  o = o || {};
  const log = [], byId = {}, store = new Map();
  const mk = (tag) => {
    const cls = new Set(), L = {};
    const el = {
      tagName: String(tag).toUpperCase(), style: {}, children: [], parentElement: null, _id: '', textContent: '', title: '', _html: '', dataset: {}, value: '',
      get id(){ return this._id; }, set id(v){ this._id = v; byId[v] = el; },
      classList: { add: (...a) => a.forEach(c => cls.add(c)), remove: (...a) => a.forEach(c => cls.delete(c)), contains: c => cls.has(c),
        toggle: (c, on) => { const v = on === undefined ? !cls.has(c) : !!on; v ? cls.add(c) : cls.delete(c); return v; } },
      set className(v){ cls.clear(); String(v).split(/\s+/).filter(Boolean).forEach(c => cls.add(c)); }, get className(){ return [...cls].join(' '); },
      get innerHTML(){ return el._html; },
      set innerHTML(v){ el._html = String(v); el.children = []; for(const m of el._html.matchAll(/id="([^"]+)"/g)){ const c = mk('div'); c.id = m[1]; el.appendChild(c); } },
      appendChild(c){ c.parentElement = el; el.children.push(c); return c; },
      remove(){ if(el.parentElement) el.parentElement.children = el.parentElement.children.filter(x => x !== el); el.parentElement = null; if(byId[el._id] === el) delete byId[el._id]; },
      addEventListener(t, fn){ (L[t] = L[t] || []).push(fn); },
      fire(t, ev){ (L[t] || []).forEach(fn => fn(Object.assign({ preventDefault(){}, stopPropagation(){}, button: 0 }, ev || {}))); },
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 580 }),
      querySelector: (q) => (q[0] === '#' ? (byId[q.slice(1)] || null) : null),
    };
    return el;
  };
  const win = mk('div'); win.id = 'myHomeWin';
  const room = mk('div'); room.id = 'mhRoomPreview';
  class FakeImage { constructor(){ this.naturalWidth = 100; this.naturalHeight = 100; } set src(v){ this._src = v; } get src(){ return this._src; } }
  const srv = Object.assign({ slots: [{ slot: 0, imageUrl: 'https://x.example/m0.png', enabled: true }, { slot: 2, imageUrl: 'https://x.example/m2.png', enabled: false }],
    count: 3, dailyMax: 10, visible: 4, cap: 30, sendErr: null, sentErr: null, visErr: null, mineErr: null, hold: false }, o.srv || {});
  const holds = [];
  const rec = (name, fn) => async (...a) => { log.push(('api ' + name + ' ' + a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')).trimEnd()); return fn(...a); };
  const GL = loadMod(S.GIFT), AE = loadMod(S.AE);
  const copyMine = () => ({ slots: srv.slots.map(x => Object.assign({}, x)), version: 1 });
  const giftApi = {
    fetchMine: rec('fetchMine', async () => { if(srv.mineErr) throw srv.mineErr; return copyMine(); }),
    fetchOf: rec('fetchOf', async () => ({ slots: [], version: 1 })),
    uploadImage: rec('uploadImage', async () => 'https://x.example/new.png'),
    saveMallangs: rec('saveMallangs', async (v, sl) => ({ slots: sl.map((x, i) => ({ slot: i, imageUrl: x.imageUrl, enabled: x.enabled })), version: v + 1 })),
    reset(){},
  };
  const sendBodies = [];
  const boxApi = {
    fetchBox: rec('fetchBox', async () => ({ items: [], unseenCount: 0, starCount: 0, boxKeep: 30, starMax: 20 })),
    markSeen: async () => {}, star: async () => {}, hide: async () => {}, remove: async () => {},
    fetchSentToday: rec('fetchSentToday', async () => { if(srv.sentErr) throw srv.sentErr; return { count: srv.count, dailyMax: srv.dailyMax }; }),
    fetchVisible: rec('fetchVisible', async () => { if(srv.visErr) throw srv.visErr; return { items: [], visibleCount: srv.visible, recipientCap: srv.cap }; }),
    send: async (code, body) => {
      sendBodies.push({ code, requestId: body.requestId, slot: body.mallang && body.mallang.slot, message: body.message });
      log.push('api send ' + code + ' slot=' + (body.mallang && body.mallang.slot) + ' msg=' + (body.message || ''));
      if(srv.hold) await new Promise(r => holds.push(r));
      if(srv.sendErr) throw srv.sendErr;
      srv.count++;
      return { giftId: 'gid', sentToday: srv.count, dailyMax: srv.dailyMax };
    },
    reset(){},
  };
  const ctx = {
    console: { log(){}, warn(){}, error(){} }, Math, JSON, String, Number, Array, Object, Set, Promise, Date, Error,
    document: { getElementById: (id) => byId[id] || null, createElement: mk, head: mk('head'), querySelector: () => null, querySelectorAll: () => [] },
    Image: FakeImage, localStorage: { getItem: () => null, setItem(){} },
    requestAnimationFrame: () => 1, cancelAnimationFrame(){}, setTimeout: () => 0, clearTimeout(){}, addEventListener(){}, removeEventListener(){},
  };
  ctx.window = ctx;
  ctx.TwSafeHtml = loadMod(S.SAFE);
  ctx.TwImgRetry = loadMod(S.RETRY, ctx.TwSafeHtml);
  vm.createContext(ctx);
  vm.runInContext(S.ML, ctx, { filename: 'mallang.js' });
  const ids = loadMod(S.RID).createPending();
  const mallangStore = loadMod(S.STORE).createMallangStore({ api: giftApi, giftLib: GL, errs: AE, apiErrors: { notify: (e) => log.push('common ' + (e && e.code)) },
    notifyError: (c) => log.push('error ' + c), toast: (m) => log.push('toast ' + m) });
  const giftBox = loadMod(S.BOX).createGiftBox({ api: boxApi, giftLib: GL, errs: AE, apiErrors: { notify: (e) => log.push('common ' + (e && e.code)) },
    notifyError: (c) => log.push('error ' + c), toast: (m) => log.push('toast ' + m), rtOn: () => () => {}, requestIds: ids });
  const m = ctx.TwMallang.createMallang({ toast: (t) => log.push('toast ' + t), getMyUserId: () => 'me', premiumOn: () => o.premium !== false, mallangStore, giftBox });
  const cells = () => (byId.mlGiftGrid ? byId.mlGiftGrid.children : []);
  const note = () => (byId.mlGift ? byId.mlGift.innerHTML : '');
  return { m, log, byId, srv, sendBodies, holds, mallangStore, giftBox, cells, note, grid: () => byId.mlGiftGrid };
}
const count = (log, re) => log.filter((l) => re.test(l)).length;
const open = async (e) => { await e.m.openGift('F1', '친구'); await flush(); };
const click = async (e, i) => { const c = e.cells()[i]; if(c) c.fire('click'); await flush(); };

async function judge(S){
  say('── 1. 열기');
  {
    const e = mkEnv(S);
    await open(e);
    chk(e.log.slice(0, 3).sort().join() === ['api fetchMine', 'api fetchSentToday', 'api fetchVisible F1'].sort().join(), '내 칸 · 오늘 보낸 수 · 상대 집 선물 수를 나란히 받는다(셋 · 지금과 같음)');
    chk(!!e.byId.mlGift && e.cells().length === 2, '창이 열리고 내 칸 전부(꺼진 칸 포함)가 격자에 있다');
    chk(/오늘 남은 횟수: <b>7\/10<\/b>/.test(e.note()), '남은 횟수 = 서버 dailyMax − 오늘 보낸 수');
    chk(!e.grid().classList.contains('off'), '  상대 집에 자리가 있으면 격자는 켜져 있다');
    const empty = mkEnv(S, { srv: { slots: [] } });
    await open(empty);
    chk(!empty.byId.mlGift && empty.log.includes('toast 먼저 내 말랑이를 등록하세요'), '칸이 비면 «먼저 내 말랑이를 등록하세요» · 창 안 엶');
    const down = mkEnv(S, { srv: { mineErr: apiErr(503, 'X') } });
    await open(down);
    chk(!down.byId.mlGift && down.log.includes('error E-GIFT-07'), '내 칸을 못 받으면 E-GIFT-07 · 창 안 엶');
    const sentDown = mkEnv(S, { srv: { sentErr: apiErr(503, 'X') } });
    await open(sentDown);
    chk(!!sentDown.byId.mlGift && /확인하지 못했어요/.test(sentDown.note()) && !sentDown.log.some((l) => l.startsWith('error')), '남은 수를 못 받으면 «확인하지 못했어요» 만 적고 창은 연다(번호 0)');
    await click(sentDown, 0);
    chk(count(sentDown.log, /^api send/) === 1, '  막지 않는다 — 보내기는 나간다(판정은 서버)');
    const visDown = mkEnv(S, { srv: { visErr: apiErr(503, 'X') } });
    await open(visDown);
    chk(!!visDown.byId.mlGift && !visDown.grid().classList.contains('off') && !visDown.log.some((l) => l.startsWith('error')), '상대 수를 못 받아도 막지 않는다(번호 0)');
    const no = mkEnv(S, { premium: false });
    await open(no);
    chk(!no.byId.mlGift && no.log.length === 1 && no.log[0] === 'toast 👑 말랑이 선물은 라이선스 보유자 전용이에요', '라이선스가 없으면 안내만 · 요청 0');
  }

  say('── 2. 보내기');
  {
    const e = mkEnv(S, { srv: { hold: true } });
    await open(e);
    e.byId.mlGiftMsg.value = '  안녕  ';
    await click(e, 1);
    chk(e.sendBodies.length === 1 && e.sendBodies[0].slot === 2 && e.sendBodies[0].code === 'F1' && /^[A-Za-z0-9_-]{8,64}$/.test(e.sendBodies[0].requestId), '고른 칸의 서버 번호(0 · 2 처럼 빌 수 있음) · 받는 사람 코드 · 요청 번호로 보낸다');
    chk(e.grid().classList.contains('off'), '보내는 동안 격자 전체가 흐리다');
    await click(e, 0);
    chk(e.sendBodies.length === 1, '  다른 칸을 눌러도 두 번째 요청은 나가지 않는다');
    e.holds.shift()(); await flush();
    chk(!e.byId.mlGift && e.log.includes('toast 🎁 친구에게 말랑이를 보냈어요!'), '성공 — 안내 · 창 닫음');
    chk(count(e.log, /^api send/) === 1 && !e.log.some((l) => l.startsWith('error')), '  요청은 한 번 · 번호 0');
  }

  say('── 3. 요청 번호');
  {
    const e = mkEnv(S, { srv: { sendErr: apiErr(0, 'NETWORK') } });
    await open(e);
    await click(e, 0); await click(e, 0);
    chk(e.sendBodies.length === 2 && e.sendBodies[0].requestId === e.sendBodies[1].requestId, '닿지 못했으면 같은 요청 번호로 다시(두 번 만들지 않는다)');
    chk(e.log.includes('error E-GIFT-08') && !e.grid().classList.contains('off'), '  실패는 E-GIFT-08 · 격자는 다시 켜짐');
    e.srv.sendErr = apiErr(429, 'GIFT_DAILY_LIMIT', '오늘은 더 보낼 수 없어요 (하루 10번)');
    await click(e, 0);
    chk(e.sendBodies[2].requestId === e.sendBodies[0].requestId, '  (닿지 못한 뒤 다시 보낸 것도 같은 번호)');
    await click(e, 0);
    chk(e.sendBodies[3].requestId !== e.sendBodies[2].requestId, '서버가 거절했으면(4xx) 번호를 버린다 — 다음 보내기는 새 번호');
    e.srv.sendErr = null;
    await click(e, 0);
    const okId = e.sendBodies[4].requestId;
    chk(!e.byId.mlGift && okId !== e.sendBodies[3].requestId, '  성공하면 창이 닫힌다');
    await open(e); await click(e, 0);
    chk(e.sendBodies[5].requestId !== okId, '성공한 일의 번호는 다음 보내기에 다시 쓰지 않는다');
  }

  say('── 4. 실패 화면');
  {
    const e = mkEnv(S, { srv: { sendErr: apiErr(429, 'GIFT_DAILY_LIMIT', '오늘은 더 보낼 수 없어요 (하루 10번)') } });
    await open(e); await click(e, 0);
    chk(e.log.includes('toast 오늘은 더 보낼 수 없어요 (하루 10번)') && !e.log.some((l) => l.startsWith('error')), '안내 코드는 서버 문구를 토스트로 · 번호 0');
    chk(!!e.byId.mlGift && !e.grid().classList.contains('off'), '  창은 남고 격자는 다시 켜짐');
    const c = mkEnv(S, { srv: { sendErr: apiErr(503, 'GIFT_IMAGE_COPY_FAILED') } });
    await open(c); await click(c, 0);
    chk(c.log.includes('error E-GIFT-08') && !c.log.some((l) => l.startsWith('toast ') && /가득|한도/.test(l)), '그림 사본을 못 만든 503 → E-GIFT-08(원본 주소로 보내지 않는다)');
    for(const code of ['GIFT_RECIPIENT_FULL', 'GIFT_NOT_FRIEND', 'GIFT_SELF', 'GIFT_NO_MALLANG', 'GIFT_MESSAGE_INVALID']){
      const g = mkEnv(S, { srv: { sendErr: apiErr(409, code, '서버문구-' + code) } });
      await open(g); await click(g, 0);
      chk(g.log.includes('toast 서버문구-' + code) && !g.log.some((l) => l.startsWith('error')), '  ' + code + ' → 서버 문구 · 번호 0');
    }
    const p = mkEnv(S, { srv: { sendErr: apiErr(403, 'PREMIUM_REQUIRED') } });
    await open(p); await click(p, 0);
    chk(p.log.includes('common PREMIUM_REQUIRED') && !p.log.includes('error E-GIFT-08'), '  PREMIUM_REQUIRED 는 공통 번호');
  }

  say('── 5. 정원 · 한도');
  {
    const e = mkEnv(S, { srv: { visible: 30 } });
    await open(e);
    chk(/가득 찼어요 \(30\/30\)/.test(e.note()) && e.grid().classList.contains('off'), '상대가 가득(visibleCount ≥ recipientCap) → 가득 안내 · 격자 흐림');
    await click(e, 0);
    chk(count(e.log, /^api send/) === 0 && e.log.includes('toast 🎁 상대 마이홈이 가득 찼어요 (30마리)'), '  눌러도 요청 0(핸들러도 막는다)');
    const z = mkEnv(S, { srv: { count: 10 } });
    await open(z); await click(z, 0);
    chk(count(z.log, /^api send/) === 0 && z.log.includes('toast 오늘은 더 보낼 수 없어요 (하루 10번)') && /7\/10|0\/10/.test(z.note()), '남은 횟수 0 → 요청 0 · 안내(숫자는 서버 dailyMax)');
  }

  say('── 6. 칸 저장 · 새 칸');
  {
    const e = mkEnv(S);
    await open(e);
    const before = e.cells()[0];
    await e.mallangStore.toggle(0); await flush();
    chk(e.cells().length === 2 && e.cells()[0] !== before, '칸 저장이 끝나면 창이 격자를 다시 그린다(옛 칸으로 보내지 않게)');
    const n = mkEnv(S, { srv: { slots: [{ slot: 0, imageUrl: 'https://x.example/m0.png', enabled: true }] } });
    await open(n);
    n.mallangStore.mine();
    await n.mallangStore.add('data:image/png;base64,AAAA'); await flush();
    await click(n, 1);
    chk(count(n.log, /^api send/) === 1 && n.sendBodies[0].slot === 1, '저장이 끝난 새 칸은 서버 번호로 보낸다');
    const closeFirst = mkEnv(S, { srv: { hold: true } });
    await open(closeFirst); await click(closeFirst, 0);
    closeFirst.byId.mlGift.querySelector('#mlGiftClose').fire('click');
    closeFirst.holds.shift()(); await flush();
    chk(!closeFirst.byId.mlGift && !closeFirst.log.some((l) => l.startsWith('toast 🎁')), '보내는 중에 창을 닫으면 늦은 답이 화면을 건드리지 않는다');
  }

  say('── 7. 옛 길 걷음');
  wiring(S, true);
}

function wiring(S, loud){
  let ok = true;
  const t = (c, msg) => { if(!c) ok = false; if(loud) chk(c, msg); };
  const ml = strip(S.ML), fb = strip(S.FB), app = strip(S.APP);
  t(!/firebaseAPI|fbReady|getDisplayName|todayStr|DAILY_LIMIT|GIFT_SEND_CAP/.test(ml), 'mallang.js — Firebase · 앱이 세던 하루 한도 · 정원 상수 · 보낸 사람 이름이 글에 없다');
  t(!/(getMallangGiftCount|sendMallangGift|getMallangGifts)\s*\(/.test(fb) && !/mallangGift/i.test(fb), 'firebase-init.js — 선물 메서드(보내기 · 하루 수 · 받은 선물)가 하나도 없다');
  const box = (S.APP.match(/const giftBoxMod = TwGiftBox\.createGiftBox\(\{([\s\S]*?)\n\}\);/) || [])[1] || '';
  t(/requestIds: TwRequestId\.createPending\(\)/.test(box), 'app.js — 보내기 요청 번호는 TwRequestId.createPending() 한 벌(gift-box 가 받는다)');
  const call = (S.APP.match(/const mallangMod = TwMallang\.createMallang\(\{([\s\S]*?)\n\}\);/) || [])[1] || '';
  t(!/getDisplayName/.test(call), '  말랑이 화면 deps 에 내 이름이 없다(보낸 사람은 서버가 토큰에서 정한다)');
  t(/giftBox\.send\(/.test(ml) && /giftBox\.fetchSentToday\(\)/.test(ml) && /giftBox\.fetchVisible\(friendId\)/.test(ml), '  보내기 창은 giftBox 의 보내기 · 오늘 보낸 수 · 상대 집 선물 수를 부른다');
  t(/maxlength="'\+MSG_MAX\+'"/.test(ml) && /const MSG_MAX = giftBox\.MESSAGE_MAX;/.test(ml), '  메시지 길이 상한은 서버 값 한 곳(giftBox.MESSAGE_MAX)');
  return ok;
}

process.on('unhandledRejection', () => { if(quiet) qfail++; else { fail++; console.log('  ✗ 처리 안 된 오류'); } });   // 깨 본 글이 누름 처리기에서 던지면 그것도 «잡힌 것»
(async () => {
  await judge(SRC0);
  say('── 8. 일부러 깨 보기');
  const run = async (name, patch, fn) => {
    quiet = true; qfail = 0;
    try{ await fn(Object.assign({}, SRC0, patch)); }catch(_){ qfail++; }
    const caught = qfail > 0; quiet = false;
    chk(caught, name + ' → 빨강');
  };
  await run('보내는 동안 격자를 안 잠그면', { ML: SRC0.ML.replace("if(giftPop !== p || p.busy) return;", "if(giftPop !== p) return;") }, async (S) => {
    const e = mkEnv(S, { srv: { hold: true } }); await open(e); await click(e, 0); await click(e, 1);
    chk(e.sendBodies.length === 1, '두 번째 요청 0');
  });
  await run('거절 뒤에도 같은 요청 번호를 쓰면', { BOX: SRC0.BOX.replace("if(typeof status === 'number' && status >= 400 && status < 500) requestIds.settle(key);", '') }, async (S) => {
    const e = mkEnv(S, { srv: { sendErr: apiErr(429, 'GIFT_DAILY_LIMIT', 'x') } }); await open(e); await click(e, 0); await click(e, 0);
    chk(e.sendBodies[0].requestId !== e.sendBodies[1].requestId, '새 번호');
  });
  await run('닿지 못했는데 번호를 버리면', { BOX: SRC0.BOX.replace("if(typeof status === 'number' && status >= 400 && status < 500) requestIds.settle(key);", 'requestIds.settle(key);') }, async (S) => {
    const e = mkEnv(S, { srv: { sendErr: apiErr(0, 'NETWORK') } }); await open(e); await click(e, 0); await click(e, 0);
    chk(e.sendBodies[0].requestId === e.sendBodies[1].requestId, '같은 번호');
  });
  await run('성공한 뒤에도 번호를 안 버리면', { BOX: SRC0.BOX.replace("      requestIds.settle(key);\n      return g !== gen ? { ok: false, kind: 'stale'", "      return g !== gen ? { ok: false, kind: 'stale'") }, async (S) => {
    const e = mkEnv(S); await open(e); await click(e, 0); await open(e); await click(e, 0);
    chk(e.sendBodies[0].requestId !== e.sendBodies[1].requestId, '새 번호');
  });
  await run('칸 번호를 화면 차례로 바꾸면', { BOX: SRC0.BOX.replace("mallang: o && o.mallang,", "mallang: { slot: 0 },") }, async (S) => {
    const e = mkEnv(S); await open(e); await click(e, 1);
    chk(e.sendBodies[0].slot === 2, '서버 번호');
  });
  await run('상대가 가득인데 안 막으면', { ML: SRC0.ML.replace("if(giftFull(p)){ toast('🎁 상대 마이홈이 가득", "if(false){ toast('🎁 상대 마이홈이 가득") }, async (S) => {
    const e = mkEnv(S, { srv: { visible: 30 } }); await open(e); await click(e, 0);
    chk(e.sendBodies.length === 0, '요청 0');
  });
  await run('남은 수 실패가 보내기를 막으면', { ML: SRC0.ML.replace("if(giftRemain(p) === 0)", "if(giftRemain(p) === null || giftRemain(p) === 0)") }, async (S) => {
    const e = mkEnv(S, { srv: { sentErr: apiErr(503, 'X') } }); await open(e); await click(e, 0);
    chk(e.sendBodies.length === 1, '보내기는 나감');
  });
  await run('안내 코드까지 번호로 띄우면', { BOX: SRC0.BOX.replace("if(f.kind === KIND.GUIDE) return { ok: false, kind: 'guide', message: f.message };", "") }, async (S) => {
    const e = mkEnv(S, { srv: { sendErr: apiErr(429, 'GIFT_DAILY_LIMIT', '서버문구') } }); await open(e); await click(e, 0);
    chk(!e.log.some((l) => l.startsWith('error')), '번호 0');
  });
  await run('칸 저장 뒤 격자를 안 다시 그리면', { ML: SRC0.ML.replace("giftOff = mallangStore.onChange(()=>{ if(giftPop === p) renderGiftGrid(p); });", "giftOff = null;") }, async (S) => {
    const e = mkEnv(S); await open(e); const b = e.cells()[0]; await e.mallangStore.toggle(0); await flush();
    chk(e.cells()[0] !== b, '다시 그림');
  });
  await run('내 칸 실패에도 창을 열면', { ML: SRC0.ML.replace("if(!ok || seq !== houseSeq) return;", "if(seq !== houseSeq) return;").replace("if(!mallangStore.mine().slots.length){", "if(false){") }, async (S) => {
    const e = mkEnv(S, { srv: { mineErr: apiErr(503, 'X') } }); await open(e);
    chk(!e.byId.mlGift, '창 안 엶');
  });
  const w = (patch) => !wiring(Object.assign({}, SRC0, patch), false);
  chk(w({ FB: SRC0.FB + "\nasync function sendMallangGift(){}" }), '옛 Firebase 보내기가 다시 생기면 빨강');
  chk(w({ ML: SRC0.ML + "\nfirebaseAPI.getMallangGifts('x');" }), 'mallang.js 가 Firebase 를 다시 부르면 빨강');

  say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
  process.exit(fail ? 1 : 0);
})().catch((err) => { console.log('  ✗ 실행 오류 — ' + (err && err.stack || err)); process.exit(1); });
