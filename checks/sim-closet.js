/* ═══ 🧬 sim-closet.js — 옷장(character/closet.js) · 서버 원본 ═══════════════
   가짜 서버 길 · 가짜 slot-save 위에서 모듈을 통째로 굴린다.
   ・1절: 만들 때 — 요청 · 구독 · 타이머 · 저장소 접근 0 · startCloset 은 받기 한 번 + 서버 신호 한 번(두 번 불러도 한 번) · 주기 타이머 없음
   ・2절: 받기 — 슬롯 앉히기 · 같은 판은 그대로 · 못 받음(혼자 다시 안 함 · 번호는 누른 받기만) · 받기 전 쓰기 0 · 다른 기기에서 바뀐 칸 · 내 고침이 있는 칸은 덮지 않음 · 생성기 중 건너뜀
   ・3절: 쓰기 — 바뀐 칸만 3초 묶음(새 칸 만들기 · 있는 칸 고치기에 받은 판) · 빈 칸은 안 지움 · 이미지 복원 실패 칸 건너뜀 · 실패 번호(저장 · 크기 · 입을 수 없음) 한 번만 · 되풀이 없음 · 올리는 중 또 고침
   ・4절: 동작 — 보관함 이동(고침 먼저 올림 · 20 문턱 · 당기기) · 휴지통 · 슬롯에 올리기 · 여러 개 휴지통 · 휴지통 목록 · 되살리기 · 오류 이유
   ・5절: 계정 바뀜 — 비우면 진행 중인 받기 · 쓰기가 새 계정을 건드리지 않음
   ・6절: 0.13 첫 실행 올리기(legacySync)
   ・7절: 깨 보기
   [실행] 저장소 루트에서 node checks/run.js sim-closet */
'use strict';
const path = require('path');
const fs = require('fs');
const vm = require('vm');
let pass = 0, fail = 0, done = false;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const FILE = [__dirname, process.cwd()].flatMap(d => ['closet.js', 'parts/character/closet.js', 'app/parts/character/closet.js', 'apps/desktop/app/parts/character/closet.js']
  .map(p => path.join(d, p))).find(p => fs.existsSync(p));
if(!FILE){ say('  ? 원본 못 찾음 — closet.js'); process.exit(2); }
const SRC = fs.readFileSync(FILE, 'utf8');
const APPTXT = (() => { const f = ['app.js', 'parts/app.js', 'app/parts/app.js', 'apps/desktop/app/parts/app.js'].flatMap(p => [path.dirname(FILE), process.cwd(), __dirname].map(d => path.join(d, p))).find(p => fs.existsSync(p)); return f ? fs.readFileSync(f, 'utf8') : ''; })();
const flush = () => new Promise(r => setImmediate(r));
const apiErr = (kind, code) => Object.assign(new Error(kind), { kind, code: code || '' });
const clone = (v) => JSON.parse(JSON.stringify(v));

function loadMod(src, env){
  const ctx = { window: {}, JSON, Object, Array, Number, String, Error, Promise, Math, Date, Set, isFinite, console: { warn(){}, log(){} },
    setTimeout: (fn, ms) => { env.timers.push({ fn, ms }); return env.timers.length; }, clearTimeout: (t) => { env.timers[t - 1] = null; } };
  vm.createContext(ctx); vm.runInContext(src, ctx);
  return ctx.window.TwCloset;
}

/* 서버 한 벌 — 머리 · 슬롯 def. calls 는 부른 것 */
const HEAD = (id, place, slot, v) => ({ avatarId: id, place, slot: place === 'SLOT' ? slot : null, version: v || 1, thumbUrl: 't-' + id, faceUrl: 'f-' + id, updatedAt: 1000 + (v || 1), legacyCid: null });
function mkServer(opt){
  const o = opt || {};
  const srv = { slots: [null, null, null, null, null], avatars: [], defs: {}, calls: [], fail: {}, loadHold: null, trash: [] };
  const add = (id, place, slot, def, v) => { srv.avatars.push(HEAD(id, place, slot, v)); if(place === 'SLOT'){ srv.slots[slot] = id; srv.defs[id] = def || { skin: id }; } else srv.defs[id] = def || { skin: id }; };
  (o.slots || []).forEach((id, i) => { if(id) add(id, 'SLOT', i, null, 1); });
  (o.box || []).forEach(id => add(id, 'BOX', null, null, 1));
  const closet = () => clone({ slots: srv.slots, avatars: srv.avatars, defs: Object.fromEntries(srv.slots.filter(Boolean).map(id => [id, srv.defs[id]])) });
  const maybeFail = (name) => { if(srv.fail[name]) throw srv.fail[name]; };
  srv.api = {
    load: async () => { srv.calls.push('load'); if(srv.loadHold) await srv.loadHold; maybeFail('load'); return closet(); },
    fetchOne: async (id) => { srv.calls.push('fetchOne:' + id); maybeFail('fetchOne'); const h = srv.avatars.find(a => a.avatarId === id); return { def: srv.defs[id], version: h.version, place: h.place }; },
    create: async (slot, def) => { srv.calls.push('create:' + slot); maybeFail('create'); const id = 'new' + slot; add(id, 'SLOT', slot, def, 1); return { avatarId: id, version: 1 }; },
    update: async (id, base, def) => { srv.calls.push('update:' + id + ':' + base); maybeFail('update'); const h = srv.avatars.find(a => a.avatarId === id); h.version++; srv.defs[id] = def; return { version: h.version }; },
    move: async (id, to) => {
      srv.calls.push('move:' + id + ':' + to); maybeFail('move');
      const h = srv.avatars.find(a => a.avatarId === id);
      if(to === 'BOX'){
        const s = h.slot; h.place = 'BOX'; h.slot = null; srv.slots[s] = null;
        for(let k = s + 1; k < 5; k++){ if(srv.slots[k]){ const x = srv.avatars.find(a => a.avatarId === srv.slots[k]); x.slot = k - 1; srv.slots[k - 1] = srv.slots[k]; srv.slots[k] = null; } }
      }else{
        const s = srv.slots.indexOf(null); h.place = 'SLOT'; h.slot = s; srv.slots[s] = id;
      }
      return closet();
    },
    trash: async (ids) => {
      srv.calls.push('trash:' + ids.join(',')); maybeFail('trash');
      return ids.map(id => {
        const h = srv.avatars.find(a => a.avatarId === id); if(!h) return { id, ok: false, code: 'AVATAR_NOT_FOUND' };
        if(h.place === 'SLOT'){ const s = h.slot; srv.slots[s] = null; for(let k = s + 1; k < 5; k++){ if(srv.slots[k]){ const x = srv.avatars.find(a => a.avatarId === srv.slots[k]); x.slot = k - 1; srv.slots[k - 1] = srv.slots[k]; srv.slots[k] = null; } } }
        srv.avatars = srv.avatars.filter(a => a.avatarId !== id); srv.trash.push(id); return { id, ok: true, code: null };
      });
    },
    trashPage: async (o) => { srv.calls.push('trashPage:' + (o.cursor || '')); maybeFail('trashPage'); return srv.pages && srv.pages[o.cursor || ''] ? srv.pages[o.cursor || ''] : { items: [], nextCursor: null }; },
    restore: async (tid) => { srv.calls.push('restore:' + tid); maybeFail('restore'); add('r-' + tid, 'BOX', null, { skin: 'r' }, 1); return { avatarId: 'r-' + tid }; },
    legacySync: async (items) => { srv.calls.push('legacySync:' + items.length); srv.legacyItems = items; maybeFail('legacySync'); items.forEach((it, i) => { const id = 'lg' + i; if(it.slot !== null && it.slot !== undefined) add(id, 'SLOT', it.slot, it.def, 1); else add(id, 'BOX', null, it.def, 1); }); return closet(); },
    reset: () => { srv.calls.push('reset'); },
  };
  return srv;
}

function mkEnv(opt){
  const o = opt || {};
  const env = { timers: [], errs: [], toasts: [], renders: 0, replaced: 0, rt: {}, uid: o.uid === null ? null : 'u1', creator: false, caches: 0, uploads: [], ls: new Map(o.ls || []), relinked: [] };
  const srv = o.srv || mkServer(o);
  env.srv = srv;
  /* 가짜 slot-save — 계약 그대로: slots[] · lastOut · onSaved · applySlotObjs(arr, which) · pullForward · _relinkSeatsToSlots · slotsReplaced */
  const slots = [null, null, null, null, null];
  let last = new Array(5).fill(null);
  const savedFns = [];
  env.slotSave = {
    lastOut: () => last,
    onSaved: (fn) => savedFns.push(fn),
    applySlotObjs: async (arr, which) => { env.applied = (env.applied || []).concat([[...(which || [0, 1, 2, 3, 4])]]); const nl = last.slice(); for(const i of (which || [0, 1, 2, 3, 4])){ slots[i] = arr[i] ? clone(arr[i]) : null; nl[i] = arr[i] ? clone(arr[i]) : null; } last = nl; if(env.afterApply) env.afterApply(); },
    pullForward: (i) => { last = last.slice(); for(let k = i; k < 4; k++){ slots[k] = slots[k + 1]; last[k] = last[k + 1]; } slots[4] = null; last[4] = null; },
    _relinkSeatsToSlots: (old, skip) => { env.relinked.push([...skip]); },
    slotsReplaced: () => { env.replaced++; },
  };
  /* 사용자가 칸을 고치고 saveSlots 가 불린 것 */
  env.edit = (i, val) => { slots[i] = val ? clone(val) : null; const nl = last.slice(); nl[i] = val ? clone(val) : null; const was = JSON.stringify(last); last = nl; savedFns.forEach(fn => fn(last, JSON.stringify(last) !== was)); };
  env.slots = slots; env.srvEdit = srv;
  env.codec = {
    SLOT_JSON_MAX: 150000,
    _slotGlbCacheLoad: () => ({}), _slotGlbCacheSave: () => { env.caches++; },
    _slotToServerObj: async (uid, o2) => { env.uploads.push(uid); if(env.imgFail) return null; return Object.assign({}, o2, { via: 'srv' }, env.big ? { pad: 'x'.repeat(160000) } : {}); },
    _slotFromServerObj: async (def) => { env.fromEntered = true; if(env.fromHold) await env.fromHold; if(env.fromFail || (env.failSkin && def.skin === env.failSkin)) throw new Error('그림 받기 실패'); return Object.assign({}, def); },
  };
  const Mod = loadMod(SRC, env);
  env.mk = () => Mod.createCloset({
    CHAR_SLOT_MAX: 5, closetApi: srv.api, codec: env.codec, roomFaceCache: { load: () => ({}), save: () => {} }, slots, slotSave: env.slotSave,
    getMyUserId: () => env.uid, rtOn: (k, fn) => { (env.rt[k] = env.rt[k] || []).push(fn); env.subs = (env.subs || 0) + 1; return () => { env.rt[k] = env.rt[k].filter(x => x !== fn); env.unsubs = (env.unsubs || 0) + 1; }; }, toast: (m) => env.toasts.push(m),
    notifyError: (c, e) => env.errs.push(c), renderLauncher: () => { env.renders++; }, creatorOpen: () => env.creator,
    storage: { getItem: (k) => env.ls.has(k) ? env.ls.get(k) : null, setItem: (k, v) => env.ls.set(k, String(v)), removeItem: (k) => env.ls.delete(k), key: (i) => [...env.ls.keys()][i] || null, get length(){ return env.ls.size; } },
  });
  env.runTimers = async () => { const ts = env.timers.filter(Boolean); env.timers.length = 0; for(const t of ts){ t.fn(); await flush(); await flush(); await flush(); } };
  return env;
}
const ready = async (opt) => { const e = mkEnv(opt); const C = e.mk(); await C.pullCloset(false); return { e, C }; };

(async () => {
const sec = async (t, fn) => { say(t); try{ await fn(); }catch(x){ chk(false, '예외 — ' + String(x && x.stack || x).split('\n').slice(0, 3).join(' / ')); } };

await sec('── 1. 만들 때 · 시작', async () => {
  const e = mkEnv({ slots: ['a', 'b'] });
  const C = e.mk();
  chk(e.srv.calls.length === 0 && !Object.keys(e.rt).length && !e.timers.length && e.ls.size === 0 && C.state() === 'idle', '만들 때는 요청 · 서버 신호 구독 · 타이머 · 저장소 접근이 0 — 계정 확인 뒤 startCloset 이 한다');
  C.startCloset(); await flush(); await flush();
  chk(e.srv.calls.join() === 'load' && e.rt.avatars.length === 1 && C.state() === 'ready' && !e.timers.length, 'startCloset — 서버에서 한 번 받고 서버 신호(avatars)를 듣는다 · 주기 타이머 없음');
  C.startCloset(); await flush();
  chk(e.srv.calls.join() === 'load' && e.rt.avatars.length === 1, '  두 번 불러도 받기 · 구독은 한 번');
  const e2 = mkEnv({ uid: null, slots: ['a'] }); const C2 = e2.mk(); C2.startCloset(); await flush();
  chk(e2.srv.calls.length === 0 && C2.state() === 'idle', '내 코드가 없으면 받지 않는다(요청 0)');
});

await sec('── 2. 받기', async () => {
  let { e, C } = await ready({ slots: ['a', null, 'c'], box: ['x', 'y'] });
  chk(e.slots[0].skin === 'a' && e.slots[1] === null && e.slots[2].skin === 'c' && e.renders === 1 && e.replaced === 1, '슬롯 캐릭터를 서버 def 로 앉힌다 · 런처를 다시 그린다');
  chk(e.toasts.length === 0, '  처음 받을 때는 «다른 기기에서 받아왔어요» 안내가 없다');
  chk(C.boxCount() === 2 && C.boxItems().length === 2 && C.boxItems()[0].thumbUrl && C.test.known()[0].avatarId === 'a' && C.test.known()[0].version === 1, '  보관함 머리 · 칸마다 받은 판을 기억한다');
  e.srv.calls.length = 0; e.applied = [];
  await C.pullCloset(false);
  chk(!e.applied.length && e.srv.calls.join() === 'load', '같은 판이면 칸을 다시 앉히지 않는다(그림을 또 받지 않는다)');
  /* 다른 기기에서 a 를 고쳤다(판 2) */
  e.srv.avatars.find(a => a.avatarId === 'a').version = 2; e.srv.defs.a = { skin: 'a2' };
  await C.pullCloset(false);
  chk(e.applied.length === 1 && e.applied[0].join() === '0' && e.slots[0].skin === 'a2' && C.test.known()[0].version === 2 && e.relinked[e.relinked.length - 1].length === 0, '다른 기기에서 고친 칸만 다시 앉힌다(같은 캐릭터라 책상 위 좌석을 잇는다)');
  chk(e.toasts.some(t => /다른 기기에서 바꾼 캐릭터/.test(t)), '  받은 뒤에는 안내한다');
  /* 다른 기기에서 b 를 슬롯 1 에 새로 올렸다 · c 는 지웠다 */
  e.srv.slots[2] = null; e.srv.avatars = e.srv.avatars.filter(a => a.avatarId !== 'c');
  e.srv.avatars.push(HEAD('b', 'SLOT', 1, 1)); e.srv.slots[1] = 'b'; e.srv.defs.b = { skin: 'b' };
  await C.pullCloset(false);
  chk(e.slots[1].skin === 'b' && e.slots[2] === null && C.test.known()[2] === null && C.test.known()[1].avatarId === 'b', '새로 생긴 칸은 앉히고 다른 기기에서 지운 칸은 비운다');
  /* 내 고침이 아직 안 올라간 칸은 덮지 않는다 */
  e.edit(0, { skin: 'mine' });
  e.srv.avatars.find(a => a.avatarId === 'a').version = 3; e.srv.defs.a = { skin: 'a3' };
  await C.pullCloset(false);
  chk(e.slots[0].skin === 'mine' && C.test.known()[0].version === 2, '내 고침이 아직 안 올라간 칸은 덮지 않는다(올릴 때 서버가 앞 모습을 남긴다) · 받은 판도 그대로(낡은 판으로 올린다)');
  /* 생성기가 열려 있으면 칸 갈아 끼우기는 건너뛴다 */
  ({ e, C } = await ready({ slots: ['a'] }));
  e.creator = true; e.srv.avatars.find(a => a.avatarId === 'a').version = 2; e.srv.defs.a = { skin: 'a2' };
  await C.pullCloset(false);
  chk(e.slots[0].skin === 'a' && C.state() === 'ready', '생성기가 열려 있으면 칸을 갈아 끼우지 않는다(편집 중인 칸을 뺏지 않는다)');
  e.creator = false; await C.pullCloset(false);
  chk(e.slots[0].skin === 'a2', '  닫은 뒤 받기에서 앉힌다');
  /* 못 받음 */
  const f = mkEnv({ slots: ['a'] }); f.srv.fail.load = apiErr('unavailable', 'NETWORK');
  const CF = f.mk();
  let r = await CF.pullCloset(false);
  chk(r === 'failed' && CF.state() === 'failed' && f.errs.length === 0 && f.srv.calls.join() === 'load', '못 받음 — failed 로 남고 번호는 안 띄운다(시작 · 서버 신호)');
  await flush(); await f.runTimers();
  chk(f.srv.calls.join() === 'load' && !f.timers.filter(Boolean).length, '  혼자 다시 받지 않는다(타이머 · 되풀이 0)');
  r = await CF.pullCloset(true);
  chk(r === 'failed' && f.errs.join() === 'E-CHAR-16', '  사용자가 누른 받기가 실패하면 E-CHAR-16');
  delete f.srv.fail.load; r = await CF.pullCloset(true);
  chk(r === 'ready' && CF.state() === 'ready' && f.slots[0].skin === 'a', '  다시 시도 → ready');
  f.srv.fail.load = apiErr('unavailable'); await CF.pullCloset(false);
  chk(CF.state() === 'ready' && f.slots[0].skin === 'a', '받은 뒤 한 번 못 받아도 알던 값 · ready 그대로');
  /* 그림 받기 실패 */
  const g = mkEnv({ slots: ['a'] }); g.fromFail = true; const CG = g.mk();
  r = await CG.pullCloset(true);
  chk(r === 'failed' && g.errs.join() === 'E-CHAR-16' && g.slots[0] === null && CG.state() === 'failed', '그림을 못 받으면 못 받음(번호 · 칸은 비어 있되 서버 캐릭터를 지우지 않는다)');
  chk(g.srv.calls.join() === 'load', '  되풀이 요청 없음');
  /* 진행 중 요청 */
  ({ e, C } = await ready({ slots: ['a'] }));
  let release; e.srv.loadHold = new Promise(rs => { release = rs; });
  e.srv.calls.length = 0;
  const p1 = C.pullCloset(false); await flush();
  const p2 = await C.pullCloset(false);
  chk(p2 === 'skipped' && e.srv.calls.length === 1, '받는 중에 또 부르면 바로 보내지 않는다');
  e.srv.loadHold = null; release(); await p1; await flush(); await flush();
  chk(e.srv.calls.length === 2, '  끝나면 한 번 더 받는다');
  /* 서버 신호 */
  C.startCloset(); await flush(); await flush();
  e.srv.calls.length = 0; e.rt.avatars[0]({ kind: 'avatars' }); await flush(); await flush();
  chk(e.srv.calls.join() === 'load', '서버 신호(avatars) — 다시 받는다');
});

await sec('── 2-2. 한 칸 그림만 못 받음', async () => {
  const { e, C } = await ready({ slots: ['a', 'b'] });
  ['a', 'b'].forEach(id => { e.srv.avatars.find(x => x.avatarId === id).version = 2; e.srv.defs[id] = { skin: id + '2' }; });
  e.failSkin = 'b2'; await C.pullCloset(false);
  chk(e.slots[0].skin === 'a' && C.test.known()[0].version === 1, '한 칸이라도 그림을 못 받으면 어느 칸도 새 판으로 적지 않는다(화면도 그대로)');
  e.failSkin = null; await C.pullCloset(false);
  chk(e.slots[0].skin === 'a2' && e.slots[1].skin === 'b2', '  다시 받으면 두 칸 모두 새 모습으로 앉는다');
  e.srv.calls.length = 0; e.edit(1, { skin: 'b-mine' }); await e.runTimers(); await flush();
  chk(e.srv.defs.a.skin === 'a2' && !e.srv.calls.some(c => c.startsWith('update:a')), '  다른 칸을 고쳐도 옛 모습을 새 판 번호로 올려 덮지 않는다');
});

await sec('── 3. 쓰기', async () => {
  let { e, C } = await ready({ slots: ['a', null, 'c'] });
  e.srv.calls.length = 0;
  e.edit(0, { skin: 'a-edit' });
  chk(e.timers.filter(Boolean).length === 1 && e.timers.filter(Boolean)[0].ms === 3000 && e.srv.calls.length === 0, '고치면 3초 묶음 한 번을 예약한다(바로 쓰지 않는다)');
  e.edit(0, { skin: 'a-edit2' });
  chk(e.timers.filter(Boolean).length === 1, '  또 고쳐도 하나로 묶는다');
  await e.runTimers();
  chk(e.srv.calls.join() === 'update:a:1' && C.test.known()[0].version === 2 && e.uploads.length === 1 && e.srv.defs.a.skin === 'a-edit2' && e.srv.defs.a.via === 'srv', '바뀐 칸만 고친다 — 받은 판(1)을 실어 보낸다 · 서버 def 로 바꿔서');
  e.srv.calls.length = 0;
  e.edit(3, { skin: 'new3' });
  await e.runTimers();
  chk(e.srv.calls.join() === 'create:3' && C.test.known()[3].avatarId === 'new3' && C.boxCount() === 0, '새 칸은 만든다(칸 번호와 함께)');
  e.srv.calls.length = 0;
  e.edit(0, { skin: 'a-edit2' });   // 같은 값으로 다시 저장
  await e.runTimers();
  chk(e.srv.calls.length === 0, '같은 모양이면 쓰지 않는다');
  e.edit(1, null); e.edit(2, null);
  await e.runTimers();
  chk(e.srv.calls.length === 0 && e.srv.slots[2] === 'c', '화면에서 칸이 비어도 서버 캐릭터를 지우지 않는다(지우기는 휴지통 이동뿐)');
  /* 이미지 복원 실패 칸 */
  ({ e, C } = await ready({ slots: ['a'] }));
  e.edit(0, { skin: 'x' }); e.slots[0]._imgBroken = ['얼굴'];
  e.srv.calls.length = 0; await e.runTimers();
  chk(e.srv.calls.length === 0, '이미지 복원에 실패한 칸은 올리지 않는다(빈 그림이 서버에 굳지 않게)');
  /* 실패 번호 */
  ({ e, C } = await ready({ slots: ['a'] }));
  e.srv.fail.update = apiErr('request', 'AVATAR_ITEM_NOT_USABLE'); e.edit(0, { skin: 'y' });
  e.srv.calls.length = 0; await e.runTimers();
  chk(e.errs.join() === 'E-CHAR-19' && e.srv.calls.length === 1, '입을 수 없는 물건 → E-CHAR-19 · 한 번만 보낸다');
  e.edit(0, { skin: 'z' }); await e.runTimers();
  chk(e.errs.length === 1, '  이어지는 같은 실패는 다시 안 띄운다');
  chk(e.timers.filter(Boolean).length === 0, '  혼자 다시 보내지 않는다');
  e.srv.fail.update = null; e.edit(0, { skin: 'w' }); await e.runTimers();
  chk(C.test.known()[0].version === 2 && e.errs.length === 1, '  다음 고침이 되면 올라간다(그때 다시 실패하면 다시 알린다)');
  e.srv.fail.update = apiErr('unavailable', 'NETWORK'); e.edit(0, { skin: 'v' }); await e.runTimers();
  chk(e.errs.join() === 'E-CHAR-19,E-CHAR-17', '  서버에 닿지 않으면 E-CHAR-17');
  e.srv.fail.update = apiErr('auth', 'OWNER_CHANGED'); e.edit(0, { skin: 'u' }); await e.runTimers();
  chk(e.errs.length === 2, '  계정이 바뀌는 중(OWNER_CHANGED)은 조용히 버린다');
  ({ e, C } = await ready({ slots: ['a'] }));
  e.imgFail = true; e.edit(0, { skin: 'y' }); await e.runTimers();
  chk(e.errs.join() === 'E-CHAR-17' && !e.srv.calls.includes('update:a:1'), '그림을 못 올리면 보내지 않고 E-CHAR-17');
  ({ e, C } = await ready({ slots: ['a'] }));
  e.big = true; e.edit(0, { skin: 'y' }); await e.runTimers();
  chk(e.errs.join() === 'E-CHAR-18' && !e.srv.calls.includes('update:a:1'), '150000자를 넘으면 보내지 않고 E-CHAR-18');
  /* 올리는 중에 또 고침 */
  ({ e, C } = await ready({ slots: ['a'] }));
  let rel; const hold = new Promise(rs => { rel = rs; }); const origUpd = e.srv.api.update;
  e.srv.api.update = async (...a) => { await hold; return origUpd(...a); };
  e.edit(0, { skin: 's1' }); const run = e.runTimers(); await flush(); await flush();
  e.edit(0, { skin: 's2' });
  chk(e.timers.filter(Boolean).length === 0, '올리는 중에 또 고쳐도 그 사이에는 예약하지 않는다(한 번에 하나)');
  rel(); await run; await flush(); await flush();
  chk(e.timers.filter(Boolean).length === 1, '  끝난 뒤 최신으로 한 번 더 예약한다');
  e.srv.api.update = origUpd; await e.runTimers();
  chk(e.srv.defs.a.skin === 's2', '  최신 모양이 올라간다');
  /* 받기 전 쓰기 0 */
  const n = mkEnv({ slots: ['a'] }); const CN = n.mk();
  n.edit(0, { skin: 'q' });
  chk(n.timers.filter(Boolean).length === 0 && n.srv.calls.length === 0, '받기 전(idle)에는 쓰기를 예약하지도 않는다');
  const fl = await CN.flushSlots();
  chk(fl === false && n.srv.calls.length === 0, '  flushSlots 를 직접 불러도 보내지 않는다');
});

await sec('── 3-2. 앉히는 중 고친 칸(가챠 회수 등)', async () => {
  const strip = (e) => { e.afterApply = () => { if(e.slots[0] && e.slots[0].gacha){ e.afterApply = null; e.edit(0, { skin: 'a' }); } }; };
  const e = mkEnv({ slots: ['a'] }); e.srv.defs.a = { skin: 'a', gacha: 'g1' }; strip(e);
  const C = e.mk(); await C.pullCloset(false); await e.runTimers(); await flush();
  chk(e.srv.calls.filter(c => c.startsWith('update:a')).length === 1 && !e.srv.defs.a.gacha, '첫 받기 — 앉히며 벗긴 모습을 서버에 한 번 올린다(받은 모양을 서버 판으로 적고 받은 뒤 저장 예약)');
  e.srv.calls.length = 0; await C.pullCloset(false); await e.runTimers(); await flush();
  chk(!e.srv.calls.some(c => c.startsWith('update')), '  다음 받기에서 다시 쓰지 않는다(되풀이 없음)');
  const e2 = mkEnv({ slots: ['a'] }); const C2 = e2.mk(); await C2.pullCloset(false);
  e2.srv.avatars.find(a => a.avatarId === 'a').version = 2; e2.srv.defs.a = { skin: 'a', gacha: 'g1' }; strip(e2);
  await C2.pullCloset(false); await e2.runTimers(); await flush();
  chk(e2.srv.calls.filter(c => c.startsWith('update:a:2')).length === 1 && !e2.srv.defs.a.gacha, '  이미 받은 뒤 다시 받을 때도 벗긴 모습을 올린다');
  const e3 = mkEnv({ slots: ['a'] }); const C3 = e3.mk(); await C3.pullCloset(false); await e3.runTimers(); await flush();
  chk(!e3.srv.calls.some(c => c.startsWith('update') || c.startsWith('create')), '  고친 것이 없으면 받은 뒤 쓰지 않는다');
});

await sec('── 4. 동작', async () => {
  let { e, C } = await ready({ slots: ['a', 'b', 'c'], box: ['x'] });
  let r = await C.moveToBox(0);
  chk(r.ok && e.srv.calls.includes('move:a:BOX') && e.slots[0].skin === 'b' && e.slots[1].skin === 'c' && e.slots[2] === null && C.test.known()[0].avatarId === 'b' && C.boxCount() === 2,
      '보관함 이동 — 서버에 옮기고 뒤 칸을 당긴다(화면 · 받은 판 기억 · 보관함 수)');
  chk(!e.srv.calls.includes('load') || e.srv.calls.filter(c => c === 'load').length === 1, '  서버가 돌려준 배치와 같으면 다시 받지 않는다');
  /* 고침이 먼저 올라간다 */
  ({ e, C } = await ready({ slots: ['a', 'b'] }));
  e.edit(0, { skin: 'a-new' }); e.srv.calls.length = 0;
  r = await C.moveToBox(0);
  chk(r.ok && e.srv.calls.join() === 'update:a:1,move:a:BOX', '아직 못 올린 고침이 있으면 먼저 올린 뒤 옮긴다(옮기면 화면에서 사라지니까)');
  ({ e, C } = await ready({ slots: ['a'] }));
  e.edit(0, { skin: 'a-new' }); e.srv.fail.update = apiErr('unavailable', 'NETWORK'); e.srv.calls.length = 0;
  r = await C.moveToBox(0);
  chk(!r.ok && r.why === 'dirty' && !e.srv.calls.includes('move:a:BOX') && e.slots[0], '올리지 못하면 옮기지 않는다(why=dirty) · 칸은 그대로');
  /* 올리는 중에 보관함 이동 — 약속으로 기다렸다가(돌기 없음) 옮긴다 */
  ({ e, C } = await ready({ slots: ['a', 'b'] }));
  { let rl; const hold = new Promise(rs => { rl = rs; }); const ou = e.srv.api.update; e.srv.api.update = async (...a2) => { await hold; return ou(...a2); };
    e.edit(0, { skin: 'a-new' }); e.srv.calls.length = 0;
    const run = e.runTimers(); await flush(); await flush();
    const mv = C.moveToBox(0); await flush();
    chk(!e.srv.calls.includes('move:a:BOX'), '올리는 중에 보관함 이동 — 올리기가 끝나기를 기다린다(먼저 옮기지 않는다)');
    rl(); await run; r = await mv;
    chk(r.ok && e.srv.calls.join() === 'update:a:1,move:a:BOX' && e.timers.every(t => !t), '  끝난 뒤 옮긴다 — 올리기 한 번 · 이동 한 번'); }
  /* 올리는 중 다른 칸 이동 · 휴지통 — 칸 번호가 당겨지는 동안 쓰면 엉뚱한 캐릭터에 적힌다(재현: race.js) */
  for(const op of ['moveToBox', 'trashSlot']){
    ({ e, C } = await ready({ slots: ['a', 'b', 'c'] }));
    let rl; const hold = new Promise(rs => { rl = rs; }); const ou = e.srv.api.update; e.srv.api.update = async (...a2) => { await hold; return ou(...a2); };
    e.edit(2, { skin: 'c-edit' }); e.srv.calls.length = 0;
    const run = e.runTimers(); await flush(); await flush();
    const mv = C[op](0); await flush();
    chk(!e.srv.calls.some(c => /^(move|trash):/.test(c)), op + ' — 올리는 중에는 기다린다(먼저 칸을 당기지 않는다)');
    rl(); await run; r = await mv; await flush();
    chk(r.ok && e.srv.defs.c.skin === 'c-edit' && e.srv.defs.b.skin === 'b' && e.srv.defs.a.skin === 'a', '  고친 c 의 모습이 c 에 적힌다 — b · a 가 덮이지 않는다 (' + op + ')');
    chk(C.test.known()[1] && C.test.known()[1].avatarId === 'c' && C.test.known()[1].version === 2 && e.slots[1].skin === 'c-edit', '  당겨진 뒤 받은 판 기억도 c 의 칸(1번)에 맞는다');
  }
  /* 쓰는 동안 그 캐릭터가 옷장에서 빠졌다 — 적지 않고 다시 받는다 */
  ({ e, C } = await ready({ slots: ['a', 'b'] }));
  { let rl; const hold = new Promise(rs => { rl = rs; }); const ou = e.srv.api.update; e.srv.api.update = async (...a2) => { await hold; return ou(...a2); };
    e.edit(1, { skin: 'b-edit' }); const run = e.runTimers(); await flush(); await flush();
    C.test.known()[1].avatarId = 'zz'; rl(); e.srv.calls.length = 0;   // 기다리는 사이 칸 기억이 달라졌다(다른 길로 비워짐)을 흉내
    await run; await flush(); await flush();
    chk(e.srv.calls.includes('load'), '쓰는 동안 그 캐릭터가 기억에서 빠지면 엉뚱한 칸에 적지 않고 옷장을 다시 받는다'); }
  /* 늦게 온 낮은 판 — 방금 올린 고침을 덮지 않고 «다른 기기에서» 토스트도 없다 */
  ({ e, C } = await ready({ slots: ['a'] }));
  e.edit(0, { skin: 'a-new' }); await e.runTimers(); await flush();
  const stale = { slots: ['a', null, null, null, null], avatars: [HEAD('a', 'SLOT', 0, 1)], defs: { a: { skin: 'a' } } };
  e.srv.api.load = async () => clone(stale); e.toasts.length = 0;
  await C.pullCloset(false);
  chk(e.slots[0].skin === 'a-new' && C.test.known()[0].version === 2 && !e.toasts.some(t => /다른 기기/.test(t)), '늦게 온 받기 답(낮은 판)은 방금 올린 고침을 덮지 않는다 — 거짓 «다른 기기에서 바꾼…» 토스트도 없다');
  /* 새 캐릭터가 SLOT_TAKEN — 서버 것을 받아 앉히고 알린다 */
  ({ e, C } = await ready({ slots: [] }));
  e.edit(2, { skin: 'mine' });
  const oc = e.srv.api.create; e.srv.api.create = async (slot, def) => { e.srv.avatars.push(HEAD('other', 'SLOT', slot, 1)); e.srv.slots[slot] = 'other'; e.srv.defs.other = { skin: 'other' }; throw apiErr('request', 'AVATAR_SLOT_TAKEN'); };
  e.srv.calls.length = 0; await e.runTimers(); await flush(); await flush(); await flush();
  chk(e.errs.includes('E-CHAR-23') && e.slots[2] && e.slots[2].skin === 'other' && C.test.known()[2].avatarId === 'other', '다른 기기가 그 칸을 먼저 채웠다(SLOT_TAKEN) → E-CHAR-23 · 서버 캐릭터를 받아 앉힌다(되풀이 거절이 없다)');
  chk(e.srv.calls.filter(c => c.startsWith('create')).length === 0 || e.srv.calls.filter(c => c === 'create:2').length === 0, '  다시 만들기를 되풀이하지 않는다');
  /* 옷장이 ready 가 아니면 만들기 · 편집을 막는다 */
  { const n = mkEnv({ slots: ['a'] }); const CN = n.mk();
    chk(CN.requireReady() === false && n.srv.calls.join() === 'load', '받기 전(idle)에 만들기를 누르면 막고 받기를 다시 시작한다(다시 시도 · 사용자가 누른 받기)');
    await flush(); await flush();
    chk(CN.requireReady() === true, '  받은 뒤에는 열린다');
    const f = mkEnv({ slots: ['a'] }); f.srv.fail.load = apiErr('unavailable'); const CF = f.mk(); await CF.pullCloset(false);
    CF.requireReady(); await flush(); await flush();
    chk(f.errs.join() === 'E-CHAR-16', '  못 받은 상태에서 누르면 «다시 시도» — 실패하면 오류 번호(E-CHAR-16)');
    const l = mkEnv({ slots: ['a'] }); const CL = l.mk(); let rel; l.srv.loadHold = new Promise(rs => { rel = rs; }); CL.pullCloset(false); await flush();
    l.toasts.length = 0; chk(CL.requireReady() === false && l.toasts.some(t => /불러오는 중/.test(t)) && l.srv.calls.length === 1, '  받는 중에는 «불러오는 중» 안내만(요청 늘지 않음)'); rel(); await flush(); }
  /* 앱을 끌 때 — app.js 가 beforeunload 에서 flushSlots 를 한 번 부른다(기다리지 않음) */
  chk(/addEventListener\('beforeunload', \(\)=>\{ closetMod\.flushSlots\(\); \}\)/.test(APPTXT), '앱을 끌 때 못 올린 고침을 한 번 올려 본다 — app.js 가 beforeunload 에 flushSlots 를 건다');
  ({ e, C } = await ready({ slots: ['a'] }));
  e.edit(0, { skin: 'quit' }); e.srv.calls.length = 0; await C.flushSlots();
  chk(e.srv.calls.join() === 'update:a:1' && e.timers.every(t => !t || t.ms !== 3000 || true), '  flushSlots 를 직접 부르면 묶음 3초를 기다리지 않고 바로 올린다');
  /* 20 문턱 */
  const box20 = []; for(let i = 0; i < 20; i++) box20.push('bx' + i);
  ({ e, C } = await ready({ slots: ['a'], box: box20 }));
  e.srv.calls.length = 0;
  r = await C.moveToBox(0);
  chk(!r.ok && r.why === 'full' && e.srv.calls.length === 0, '보관함 20 이면 요청 없이 막는다(why=full)');
  chk(C.boxFull() === true && e.toasts.some(t => /가득 찼어요 \(20\/20\)/.test(t)), '  boxFull — 가득이면 true + 안내');
  const idle = mkEnv({ slots: ['a'] }).mk();
  chk(idle.boxFull() === false && idle.boxItems() === null, '받기 전에는 막지도 목록을 그리지도 않는다(boxItems null = 모름)');
  r = await idle.moveToBox(0);
  chk(!r.ok && r.why === 'off', '  받기 전 동작은 why=off');
  /* 서버 오류 이유 */
  for(const [code, kind, why] of [['AVATAR_BOX_FULL', 'request', 'full'], ['AVATAR_NOT_FOUND', 'request', 'gone'], ['', 'unavailable', 'net'], ['X', 'request', 'err']]){
    ({ e, C } = await ready({ slots: ['a'] })); e.srv.fail.move = apiErr(kind, code);
    r = await C.moveToBox(0);
    chk(!r.ok && r.why === why && e.slots[0], '이동 실패 ' + (code || kind) + ' → ' + why + ' · 칸은 그대로');
  }
  e.toasts.length = 0; e.errs.length = 0;
  C.reportFail({ why: 'full' }); C.reportFail({ why: 'busy' }); C.reportFail({ why: 'off' }); C.reportFail({ why: 'dirty' });
  chk(e.toasts.length === 4 && /가득/.test(e.toasts[0]) && e.errs.length === 0, 'reportFail — 가득 참 · 바쁨 · 받기 전 · 못 올린 고침은 안내(토스트) 그대로');
  C.reportFail({ why: 'net' }); C.reportFail({ why: 'err' }); C.reportFail({ why: 'img' }); C.reportFail({ why: 'zzz' });
  chk(e.errs.join() === 'E-CHAR-20,E-CHAR-21,E-CHAR-22,E-CHAR-21' && e.toasts.length === 4, '  요청 실패(닿지 못함 · 못 함 · 그림 받기 · 모르는 이유)는 오류 번호(E-CHAR-20~22)로 — 토스트가 아니다');
  /* 휴지통 */
  ({ e, C } = await ready({ slots: ['a', 'b'] }));
  r = await C.trashSlot(0);
  chk(r.ok && e.srv.calls.includes('trash:a') && e.slots[0].skin === 'b' && e.slots[1] === null && C.test.known()[0].avatarId === 'b', '휴지통 이동 — 서버에 보내고 뒤 칸을 당긴다');
  ({ e, C } = await ready({ slots: ['a'] }));
  e.edit(2, { skin: 'unsaved' }); e.srv.calls.length = 0;
  r = await C.trashSlot(2);
  chk(r.ok && e.srv.calls.length === 0 && e.slots[2] === null, '서버에 올린 적 없는 새 캐릭터는 화면에서만 지운다(요청 0)');
  ({ e, C } = await ready({ slots: ['a'] })); e.srv.fail.trash = apiErr('unavailable', 'NETWORK');
  r = await C.trashSlot(0);
  chk(!r.ok && r.why === 'net' && e.slots[0], '휴지통 실패 — 칸은 그대로');
  ({ e, C } = await ready({ slots: ['a'] }));
  const orig = e.srv.api.trash; e.srv.api.trash = async (ids) => ids.map(id => ({ id, ok: false, code: 'AVATAR_NOT_FOUND' }));
  r = await C.trashSlot(0);
  chk(r.ok && e.slots[0] === null, '이미 서버에 없다(AVATAR_NOT_FOUND)면 같은 결과 — 칸을 비운다'); e.srv.api.trash = orig;
  /* 보관함 → 슬롯 */
  ({ e, C } = await ready({ slots: ['a'], box: ['x', 'y'] }));
  r = await C.boxToSlot('x');
  chk(r.ok && r.slot === 1 && e.srv.calls.includes('move:x:SLOT') && e.slots[1].skin === 'x' && C.test.known()[1].avatarId === 'x' && C.boxCount() === 1 && e.renders >= 2, '슬롯에 올리기 — 첫 빈칸에 서버 def 로 앉힌다 · 런처를 다시 그린다');
  ({ e, C } = await ready({ slots: ['a', 'b', 'c', 'd', 'e'], box: ['x'] })); e.srv.calls.length = 0;
  r = await C.boxToSlot('x');
  chk(!r.ok && r.why === 'slotsfull' && e.srv.calls.length === 0, '슬롯이 꽉 차면 요청 없이 막는다');
  ({ e, C } = await ready({ slots: ['a'], box: ['x'] })); e.fromFail = true; e.srv.calls.length = 0;
  r = await C.boxToSlot('x');
  chk(!r.ok && r.why === 'img' && e.srv.calls.includes('load'), '그림을 못 받으면 why=img · 서버에서는 옮겨졌으니 목록을 다시 받는다(한 번)');
  ({ e, C } = await ready({ slots: ['a'], box: ['x'] }));
  r = await C.boxToSlot('nope');
  chk(!r.ok && r.why === 'gone', '보관함에 없는 캐릭터는 요청 없이 gone');
  /* 여러 개 휴지통 */
  ({ e, C } = await ready({ slots: ['a'], box: ['x', 'y', 'z'] })); e.srv.calls.length = 0;
  r = await C.trashBox(['x', 'y', 'a', 'nope']);
  chk(r.ok && r.n === 2 && r.fail === 0 && e.srv.calls.join() === 'trash:x,y' && C.boxCount() === 1, '보관함 여러 개 — 요청 하나 · 보관함 캐릭터만(슬롯 캐릭터 · 없는 id 는 거른다)');
  ({ e, C } = await ready({ slots: [], box: ['x', 'y'] }));
  const o2 = e.srv.api.trash; e.srv.api.trash = async (ids) => [{ id: 'x', ok: true }, { id: 'y', ok: false, code: 'AVATAR_NOT_FOUND2' }]; r = await C.trashBox(['x', 'y']);
  chk(r.ok && r.n === 1 && r.fail === 1, '  줄마다 결과 — 못 옮긴 것은 센다'); e.srv.api.trash = o2;
  /* 휴지통 목록 · 되살리기 */
  ({ e, C } = await ready({ slots: [] }));
  e.srv.pages = { '': { items: [{ trashId: 't1' }], nextCursor: 'c1' }, c1: { items: [{ trashId: 't2' }], nextCursor: 'c2' }, c2: { items: [{ trashId: 't3' }], nextCursor: 'c3' }, c3: { items: [{ trashId: 't4' }], nextCursor: 'c4' }, c4: { items: [{ trashId: 't5' }], nextCursor: null } };
  let rows = await C.trashRows();
  chk(rows.map(x => x.trashId).join() === 't1,t2,t3,t4' && e.srv.calls.filter(c => c.startsWith('trashPage')).length === 4, '휴지통 목록 — 쪽을 이어 받되 상한(네 쪽)');
  e.srv.fail.trashPage = apiErr('unavailable'); let th = null; try{ await C.trashRows(); }catch(x){ th = x; }
  chk(th && th.kind === 'unavailable', '  못 받으면 던진다(빈 휴지통 ≠ 못 읽음)');
  e.srv.calls.length = 0;
  r = await C.restore('t9');
  await flush(); await flush();
  chk(r.ok && r.avatarId === 'r-t9' && C.boxCount() === 1 && e.srv.calls.join() === 'restore:t9,load', '되살리기 — 서버가 avatarId 만 주면 옷장을 한 번 다시 받는다(판 · 시각 · 섬네일을 앱이 지어 넣지 않는다)');
  chk(C.test.heads().find(h => h.avatarId === 'r-t9').version === 1 && C.test.heads().find(h => h.avatarId === 'r-t9').thumbUrl === 't-r-t9', '  머리는 서버가 준 값 그대로');
  /* 서버가 move 처럼 옷장을 같이 돌려주는 모양 */
  { const q = await ready({ slots: [], box: ['x'] }); const orig = q.e.srv.api.restore;
    q.e.srv.api.restore = async (tid) => { const r0 = await orig(tid); return Object.assign(r0, { closet: { slots: [null, null, null, null, null], avatars: q.e.srv.avatars.map(a => clone(a)), defs: {} } }); };
    q.e.srv.calls.length = 0; const rr = await q.C.restore('t5'); await flush();
    chk(rr.ok && q.C.boxCount() === 2 && q.e.srv.calls.join() === 'restore:t5', '  서버가 옷장을 같이 주면 그대로 앉힌다 — 추가 요청 0'); }
  ({ e, C } = await ready({ slots: [], box: box20 })); e.srv.calls.length = 0;
  r = await C.restore('t1');
  chk(!r.ok && r.why === 'full' && e.srv.calls.length === 0, '  보관함이 20 이면 요청 없이 막는다');
  /* 한 번에 하나 */
  ({ e, C } = await ready({ slots: ['a', 'b'] }));
  let rl; const hh = new Promise(rs => { rl = rs; }); const om = e.srv.api.move; e.srv.api.move = async (...a) => { await hh; return om(...a); };
  const m1 = C.moveToBox(0); await flush();
  const m2 = await C.moveToBox(1);
  chk(!m2.ok && m2.why === 'busy', '동작 중에 또 누르면 busy — 서버에 두 번 가지 않는다');
  rl(); await m1;
});

await sec('── 5. 계정 바뀜', async () => {
  let { e, C } = await ready({ slots: ['a'] });
  let release; e.srv.loadHold = new Promise(rs => { release = rs; });
  e.srv.avatars.find(a => a.avatarId === 'a').version = 5; e.srv.defs.a = { skin: 'old-account' };
  const p = C.pullCloset(false); await flush();
  C.resetCloset(); release(); await p; await flush();
  chk(C.state() === 'idle' && C.test.known().every(k => k === null) && e.slots[0].skin === 'a', '지우는 사이 나간 받기의 답은 버린다(앞 계정 값이 새 계정에 앉지 않는다)');
  ({ e, C } = await ready({ slots: ['a'] }));
  e.edit(0, { skin: 'mid' });
  let rel; const hold = new Promise(rs => { rel = rs; }); const origUpd = e.srv.api.update; e.srv.api.update = async (...a) => { await hold; return origUpd(...a); };
  e.srv.calls.length = 0;
  const run = e.runTimers(); await flush(); await flush();
  C.resetCloset(); rel(); await run; await flush();
  chk(C.test.known().every(k => k === null) && C.state() === 'idle', '지우는 사이 나간 쓰기의 답은 새 계정 기억에 적히지 않는다');
  e.edit(0, { skin: 'after' });
  chk(e.timers.filter(Boolean).length === 0, '비운 뒤에는 쓰기를 예약하지 않는다(다시 받기 전)');
  C.startCloset(); await flush(); await flush();
  chk(C.state() === 'ready' && e.rt.avatars.length === 1, '다시 시작하면 받고 서버 신호를 건다');
  C.resetCloset(); C.startCloset(); await flush(); await flush();
  chk(e.rt.avatars.length === 1 && e.subs === 2 && e.unsubs === 1, '★ 계정이 바뀌면(reset) 서버 신호 구독을 풀고 새로 건다 — 구독이 겹치지 않는다');
});

await sec('── 5-2. 그림을 받는 사이 계정을 놓음', async () => {
  const e = mkEnv({ slots: ['a'] }); const C = e.mk(); let rel; e.fromHold = new Promise(r => { rel = r; });
  const p = C.pullCloset(false); for(let n = 0; n < 20 && !e.fromEntered; n++) await flush(); C.resetCloset(); e.fromHold = null; rel(); await p; await flush();
  chk(!e.slots[0] && C.state() === 'idle' && !C.test.known()[0], '옛 계정 캐릭터를 앉히지 않고 «받음» 으로 바꾸지 않는다');
});

await sec('── 6. 0.13 첫 실행 올리기', async () => {
  const slotsRaw = JSON.stringify([{ skin: 1 }, null, { skin: 3 }]);
  const box = { cB1: { def: JSON.stringify({ skin: 'b1' }), mtime: 500 }, cB2: { def: JSON.stringify({ skin: 'b2' }), mtime: 900 }, cD0: { def: JSON.stringify({ skin: 'on-desk' }), mtime: 1 }, tomb: { del: 5 }, bad: { def: '{깨짐', mtime: 2 } };
  const ls = [['deskFriends.slots.v1', slotsRaw], ['deskFriends.chars.v1', JSON.stringify(box)], ['deskFriends.chars.desk', JSON.stringify(['cD0', null, 'cD2'])], ['deskFriends.slots.ts', '777'], ['tw.gachaOwned', '{}'], ['tw.theme', 'x']];
  let { e, C } = await ready({ slots: [], ls });
  let r = await C.legacyStep();
  const items = e.srv.legacyItems;
  chk(r.ok && e.srv.calls.some(c => c === 'legacySync:4') && items.length === 4, '슬롯 둘 + 보관함 둘(묘비 · 깨진 def · 슬롯에도 있는 것은 뺀다)을 한 번에 올린다 (' + (items && items.length) + ')');
  chk(items[0].slot === 0 && items[0].legacyCid === 'cD0' && items[0].editedAt === 777 && items[0].def.via === 'srv' && items[1].slot === 2 && items[1].legacyCid === 'cD2', '  슬롯은 칸 번호 · 옛 cid(책상 표) · 서버 모양 def · 옛 고친 시각');
  chk(items[2].slot === null && items[2].legacyCid === 'cB2' && items[3].legacyCid === 'cB1', '  보관함은 칸 없이 최근 고친 순');
  chk(r.wipe.indexOf('deskFriends.slots.v1') >= 0 && r.wipe.indexOf('deskFriends.chars.v1') >= 0 && r.wipe.indexOf('tw.gachaOwned') < 0 && r.wipe.indexOf('tw.theme') < 0, '  올린 뒤 지울 키 — 옛 캐릭터 · 보관함 키만(가챠 키는 first-run 의 gacha 단계 몫 · 기기 설정은 안 건드린다)');
  chk(e.slots[0].skin === 1 && e.slots[2].skin === 3 && C.boxCount() === 2 && e.ls.get('tw.legacyCloset013') === 'u1', '  올린 결과를 바로 앉힌다 · 이 계정은 끝냈다고 적는다');
  e.srv.calls.length = 0;
  r = await C.legacyStep();
  chk(r.ok && e.srv.calls.length === 0, '다음 실행에는 건너뛴다(요청 0) — 다시 해도 같다');
  /* 서버가 이미 받았다 */
  ({ e, C } = await ready({ slots: [], ls })); e.srv.fail.legacySync = apiErr('request', 'AVATAR_LEGACY_SYNC_DONE');
  r = await C.legacyStep();
  chk(r.ok && r.wipe.length > 0, '서버가 이미 받았다(AVATAR_LEGACY_SYNC_DONE)면 같은 결과 — 지워도 된다');
  /* 실패 */
  ({ e, C } = await ready({ slots: [], ls })); e.srv.fail.legacySync = apiErr('unavailable', 'NETWORK');
  r = await C.legacyStep();
  chk(!r.ok && !r.wipe && /NETWORK/.test(r.reason), '올리기가 실패하면 멈춘다 — 아무것도 지우라고 하지 않는다');
  ({ e, C } = await ready({ slots: [], ls })); e.imgFail = true;
  r = await C.legacyStep();
  chk(!r.ok && !r.wipe && !e.srv.calls.some(c => c.startsWith('legacySync')), '그림을 못 올리면 보내지도 않고 멈춘다');
  const idle = mkEnv({ slots: [], ls }); const CI = idle.mk();
  r = await CI.legacyStep();
  chk(!r.ok && idle.srv.calls.length === 0, '옷장을 받기 전에는 올리지 않는다');
  /* 켜는 차례에서는 받기와 첫 실행이 같이 시작한다 — 받기가 끝난 뒤에 올린다(영영 «받기 전» 으로 멈추지 않는다) */
  {
    const e2 = mkEnv({ slots: [], ls }); const C2 = e2.mk();
    let rel; e2.srv.loadHold = new Promise(rs => { rel = rs; });
    C2.startCloset();
    const pr = C2.legacyStep();
    await flush();
    chk(!e2.srv.calls.some(c => c.startsWith('legacySync')), '받기가 도는 중에 불리면 기다린다(먼저 올리지 않는다)');
    e2.srv.loadHold = null; rel(); const rr = await pr;
    chk(rr.ok && e2.srv.calls.filter(c => c.startsWith('legacySync')).length === 1 && e2.srv.calls.indexOf('load') < e2.srv.calls.findIndex(c => c.startsWith('legacySync')), '  받기가 끝난 뒤 올린다 — 한 번');
  }
  ({ e, C } = await ready({ slots: [], ls: [['tw.theme', 'x']] }));
  r = await C.legacyStep();
  chk(r.ok && e.srv.calls.filter(c => c.startsWith('legacySync')).length === 0 && e.ls.get('tw.legacyCloset013') === 'u1', '옛 캐릭터가 없으면 올릴 것 없이 끝');
  /* 25 상한 */
  const bigBox = {}; for(let i = 0; i < 30; i++) bigBox['cc' + String(i).padStart(2, '0')] = { def: JSON.stringify({ skin: i }), mtime: i + 1 };
  ({ e, C } = await ready({ slots: [], ls: [['deskFriends.slots.v1', slotsRaw], ['deskFriends.chars.v1', JSON.stringify(bigBox)]] }));
  await C.legacyStep();
  chk(e.srv.legacyItems.length === 25 && e.srv.legacyItems[2].legacyCid === 'cc29', '25줄까지 — 슬롯이 먼저 · 남는 자리는 보관함 최근 순');
});

await sec('── 7. 깨 보기', async () => {
  const broke = (from, to) => { const s = SRC.replace(from, to); return s === SRC ? null : s; };
  const run = async (src, fn) => { const e = mkEnv({ slots: ['a', 'b'], box: ['x'] }); const M = loadMod(src, e); e.mk = () => M.createCloset({ CHAR_SLOT_MAX: 5, closetApi: e.srv.api, codec: e.codec, roomFaceCache: { load: () => ({}), save: () => {} }, slots: e.slots, slotSave: e.slotSave,
    getMyUserId: () => e.uid, rtOn: (k, f) => { (e.rt[k] = e.rt[k] || []).push(f); return () => {}; }, toast: (m) => e.toasts.push(m), notifyError: (c) => e.errs.push(c), renderLauncher: () => {}, creatorOpen: () => e.creator,
    storage: { getItem: (k) => e.ls.has(k) ? e.ls.get(k) : null, setItem: (k, v) => e.ls.set(k, String(v)), removeItem: (k) => e.ls.delete(k), key: (i) => [...e.ls.keys()][i] || null, get length(){ return e.ls.size; } } }); return fn(e); };
  let S = (() => { let t = SRC.replace("async function flushSlots(inner){\n  if(load !== 'ready') return false;", "async function flushSlots(inner){").replace("  if(load !== 'ready') return false;\n  if(flushing){ flushAgain = true; return false; }", "  if(flushing){ flushAgain = true; return false; }"); return t === SRC ? null : t; })();
  chk(S && await run(S, async (e) => { const C = e.mk(); e.edit(0, { skin: 'q' }); await C.flushSlots(); return e.srv.calls.some(c => c.startsWith('create') || c.startsWith('update')); }), '받기 전 쓰기 막이를 빼면 3절이 빨강이 된다');
  S = broke("await closetApi.update(id, k.version, so)", "await closetApi.update(k.avatarId, 0, so)");
  chk(S && await run(S, async (e) => { const C = e.mk(); await C.pullCloset(false); e.edit(0, { skin: 'q' }); await C.flushSlots(); return e.srv.calls.some(c => c === 'update:a:0'); }), '받은 판 대신 다른 값을 실으면 3절이 빨강이 된다');
  S = broke("if(k && k.avatarId === id && isDirty(i)) continue;", "");
  chk(S && await run(S, async (e) => { const C = e.mk(); await C.pullCloset(false); e.edit(0, { skin: 'mine' }); e.srv.avatars.find(a => a.avatarId === 'a').version = 3; e.srv.defs.a = { skin: 'a3' }; await C.pullCloset(false); return e.slots[0].skin === 'a3'; }), '내 고침 보호를 빼면 2절이 빨강이 된다');
  S = broke("if(boxCount() >= BOX_MAX) return { ok: false, why: 'full' };\n  busy = true;\n  try{\n    if(!(await settleSlot(i)))", "busy = true;\n  try{\n    if(!(await settleSlot(i)))");
  chk(S && await run(S, async (e) => { const box20 = []; for(let i = 0; i < 20; i++) box20.push('bx' + i); const e2 = mkEnv({ slots: ['a'], box: box20 }); const M = loadMod(S, e2);
    const C = M.createCloset({ CHAR_SLOT_MAX: 5, closetApi: e2.srv.api, codec: e2.codec, roomFaceCache: { load: () => ({}), save: () => {} }, slots: e2.slots, slotSave: e2.slotSave, getMyUserId: () => 'u1', rtOn: () => () => {}, toast(){}, notifyError(){}, renderLauncher(){}, creatorOpen: () => false,
      storage: { getItem: () => null, setItem(){}, removeItem(){}, key: () => null, length: 0 } });
    await C.pullCloset(false); e2.srv.calls.length = 0; await C.moveToBox(0); return e2.srv.calls.some(c => c.startsWith('move:')); }), '20 문턱을 빼면(요청이 나가면) 4절이 빨강이 된다');
  S = SRC.split("if(g !== gen){ res = 'skipped'; return res; }").join(""); if(S === SRC) S = null;
  chk(S && await run(S, async (e) => { const C = e.mk(); let rel; e.srv.loadHold = new Promise(r => { rel = r; }); const p = C.pullCloset(false); await flush(); C.resetCloset(); rel(); await p; await flush(); return C.state() !== 'idle'; }), '계정 바뀜 막이를 빼면 5절이 빨강이 된다');
  S = broke("if(again && res !== 'failed') pullCloset(false);", "if(again) pullCloset(false);");
  chk(S && await run(S, async (e) => { const C = e.mk(); let rel; e.srv.loadHold = new Promise(r => { rel = r; }); e.srv.fail.load = apiErr('unavailable'); const p = C.pullCloset(false); await flush(); await C.pullCloset(false); rel(); await p; await flush(); await flush(); return e.srv.calls.filter(c => c === 'load').length > 1; }), '실패 뒤 되풀이 금지를 빼면 2절이 빨강이 된다');
  S = (() => { const t = SRC.replace("  if(!inner) while(busy || pulling){ if(busy) await waitIdle(); else await waitPull(); }\n", "").replace(/  await quiet\(\);\n/g, "").replace("const at = known.findIndex(x => x && x.avatarId === id);", "const at = i;"); return t === SRC ? null : t; })();
  chk(S && await run(S, async (e) => { const C = e.mk(); await C.pullCloset(false); let rl; const hold = new Promise(r => { rl = r; }); const ou = e.srv.api.update; e.srv.api.update = async (...x) => { await hold; return ou(...x); };
    e.edit(2, { skin: 'c-edit' }); const run = e.runTimers(); await flush(); await flush(); const mv = C.trashSlot(0); rl(); await run; await mv; await flush(); const k = C.test.known(); return e.srv.defs.b.skin !== 'b' || (e.srv.defs.c && e.srv.defs.c.skin !== 'c-edit') || !k[1] || k[1].version !== 2 || (k[2] && k[2].avatarId === 'c'); }), '쓰기와 동작이 겹쳐도 되게 하면 엉뚱한 칸이 덮인다 — 4절이 빨강이 된다');
  S = broke("k.version >= head.version) continue;", "k.version === head.version) continue;");
  chk(S && await run(S, async (e) => { const C = e.mk(); await C.pullCloset(false); e.edit(0, { skin: 'a-new' }); await e.runTimers(); await flush(); e.srv.api.load = async () => clone({ slots: ['a', null, null, null, null], avatars: [HEAD('a', 'SLOT', 0, 1)], defs: { a: { skin: 'a' } } }); await C.pullCloset(false); return e.slots[0].skin !== 'a-new'; }), '낮은 판 건너뛰기를 빼면 방금 올린 고침이 덮인다 — 2절이 빨강이 된다');
  S = broke("if(!k && here && !taken.has(i)) continue;", "if(!k && here) continue;");
  chk(S && await run(S, async (e) => { const C = e.mk(); await C.pullCloset(false); e.edit(2, { skin: 'mine' }); e.srv.api.create = async (slot) => { e.srv.avatars.push(HEAD('other', 'SLOT', slot, 1)); e.srv.slots[slot] = 'other'; e.srv.defs.other = { skin: 'other' }; throw apiErr('request', 'AVATAR_SLOT_TAKEN'); }; await e.runTimers(); await flush(); await flush(); await flush(); return !e.slots[2] || e.slots[2].skin !== 'other'; }), 'SLOT_TAKEN 에 서버 것으로 안 앉히면 영영 저장되지 않는다 — 빨강');
  S = broke("if(unsubRt){ unsubRt(); unsubRt = null; }", "");
  chk(S && await run(S, async (e) => { const C = e.mk(); C.startCloset(); await flush(); C.resetCloset(); C.startCloset(); await flush(); return e.rt.avatars.length > 1; }), '구독을 안 풀면 계정이 바뀔 때 구독이 겹친다 — 5절이 빨강이 된다');
  S = broke("    else pullCloset(false);\n    return { ok: true, avatarId: r.avatarId };", "    return { ok: true, avatarId: r.avatarId };");
  chk(S && await run(S, async (e) => { const C = e.mk(); await C.pullCloset(false); e.srv.calls.length = 0; await C.restore('t9'); await flush(); return !e.srv.calls.includes('load'); }), '복원 뒤 옷장을 다시 받지 않으면(머리가 없다) 4절이 빨강이 된다');
  S = broke("if(load !== 'ready') await waitPull();", "");
  chk(S && await run(S, async (e) => { e.ls.set('deskFriends.slots.v1', JSON.stringify([{ skin: 1 }])); const C = e.mk(); let rel; e.srv.loadHold = new Promise(r => { rel = r; }); C.startCloset(); const p = C.legacyStep(); await flush(); e.srv.loadHold = null; rel(); const rr = await p; return rr.ok === false; }), '받기를 기다리지 않으면 첫 실행 올리기가 영영 멈춘다 — 6절이 빨강이 된다');
  const stripRun = async (src) => { const e = mkEnv({ slots: ['a'] }); e.srv.defs.a = { skin: 'a', gacha: 'g1' }; e.afterApply = () => { if(e.slots[0] && e.slots[0].gacha){ e.afterApply = null; e.edit(0, { skin: 'a' }); } };
    const M = loadMod(src, e); const C = M.createCloset({ CHAR_SLOT_MAX: 5, closetApi: e.srv.api, codec: e.codec, roomFaceCache: { load: () => ({}), save: () => {} }, slots: e.slots, slotSave: e.slotSave, getMyUserId: () => 'u1', rtOn: () => () => {}, toast(){}, notifyError(){}, renderLauncher(){}, creatorOpen: () => false,
      storage: { getItem: () => null, setItem(){}, removeItem(){}, key: () => null, length: 0 } });
    await C.pullCloset(false); await e.runTimers(); await flush(); return !e.srv.calls.some(c => c.startsWith('update:a')); };
  S = broke("  await slotSave.applySlotObjs(objs, which);\n", "  await slotSave.applySlotObjs(objs, which);\n  for(const i of which) if(known[i]) known[i].sig = sigOf(slotSave.lastOut()[i]);\n");
  chk(S && await stripRun(S), '앉힌 뒤 모양을 서버 판으로 적으면 벗긴 것이 안 올라간다 — 3-2절이 빨강이 된다');
  S = broke("if(did && !wasReady){ for(let i = 0; i < CHAR_SLOT_MAX; i++) if(isDirty(i)){ scheduleSave(); break; } }", "");
  chk(S && await stripRun(S), '첫 받기 뒤 저장 예약을 빼면 3-2절이 빨강이 된다');
  S = broke("    try{ objs[i] = await objOf(c.defs[id]); }", "    known[i] = { avatarId: id, version: head.version, sig: null };\n    try{ objs[i] = await objOf(c.defs[id]); }");
  chk(S && await run(S, async (e) => { const C = e.mk(); await C.pullCloset(false); ['a', 'b'].forEach(id => { e.srv.avatars.find(x => x.avatarId === id).version = 2; e.srv.defs[id] = { skin: id + '2' }; }); e.failSkin = 'b2'; await C.pullCloset(false); e.failSkin = null; await C.pullCloset(false); return e.slots[0].skin !== 'a2'; }), '받는 도중에 판을 적으면 못 받은 뒤 그 칸을 영영 건너뛴다 — 2-2절이 빨강이 된다');
  S = broke("  if(g !== gen) return false;                                      // 그림을 받는 사이 계정을 놓았다", "  if(false) return false; //");
  chk(S && await (async () => { const e = mkEnv({ slots: ['a'] }); const M = loadMod(S, e);
    const C = M.createCloset({ CHAR_SLOT_MAX: 5, closetApi: e.srv.api, codec: e.codec, roomFaceCache: { load: () => ({}), save: () => {} }, slots: e.slots, slotSave: e.slotSave, getMyUserId: () => 'u1', rtOn: () => () => {}, toast(){}, notifyError(){}, renderLauncher(){}, creatorOpen: () => false,
      storage: { getItem: () => null, setItem(){}, removeItem(){}, key: () => null, length: 0 } });
    let rel; e.fromHold = new Promise(r => { rel = r; }); const p = C.pullCloset(false); for(let n = 0; n < 20 && !e.fromEntered; n++) await flush(); C.resetCloset(); e.fromHold = null; rel(); await p; await flush(); return !!e.slots[0]; })(), '그림 받는 사이 계정 막이를 빼면 5-2절이 빨강이 된다');
  S = broke("setTimeout(() => { saveTimer = null; flushSlots(); }, SAVE_DEBOUNCE_MS)", "setTimeout(() => { saveTimer = null; flushSlots(); }, 0)");
  chk(S && await run(S, async (e) => { const C = e.mk(); await C.pullCloset(false); e.edit(0, { skin: 'q' }); return e.timers.filter(Boolean)[0].ms !== 3000; }), '묶음 시간을 없애면 3절이 빨강이 된다');
});

say('');
say(fail ? ('✗ ' + fail + '건 어긋남 · 통과 ' + pass) : ('✅ 전부 통과 ' + pass));
console.log(pass + ' · ' + fail);
done = true;
process.exit(fail ? 1 : 0);
})();
process.on('exit', () => { if(!done){ console.log('  ✗ 끝까지 못 돌았다\n' + pass + ' · ' + (fail + 1)); process.exitCode = 1; } });
