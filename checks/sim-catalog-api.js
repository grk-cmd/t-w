/* ═══ 🧩 sim-catalog-api.js — 카탈로그를 서버 한 벌 GET /v2/catalog 에서(character/catalog-api.js) ═══════════════
   [왜] #887 이 서버에 없는 GET /v2/catalog/{parts·gachaParts·items·desks}?v= 를 만들었다. 서버 정본은 GET /v2/catalog 한 벌(ETag · no-cache)이다.
     이 검사는 한 벌을 앱의 세 목록(parts · items · desks)으로 펼치는 표 · 받기 · 알림 · 실패(Firebase 로 안 물러남)를 지킨다.
   1. 펼치기 — 서버 한 벌(CatalogResponse)의 칸이 옛 레코드 칸으로(가챠 · 전용 · 위치 · 파일 주소 · 순서 · 깨진 줄 · 모양이 틀린 한 벌)
   2. 받기 — 길은 GET /v2/catalog 하나 · 구독 셋이 요청 하나 · 새 객체 · 같은 값은 다시 안 넘김 · 늦은 구독자
   3. 알림 — realtime catalog 알림이 다시 받기 · 받는 중 알림은 한 번 더 · 연결이 ready 가 되면 실패했을 때만 다시
   4. 실패 — E-CHAR-26 으로 드러냄 · 지난 목록을 비우지 않음 · Firebase 로 안 물러남 · 타이머로 두드리지 않음
   5. 배선 — firebase-init(import · 만드는 줄 · 구독 셋) · 옛 길(/v2/catalog/{종류}) · catalogMeta 구독 · catalog-cache.js 가 없다
   6. 일부러 깨 보기
   [실행] 러너 스테이징(평평한 폴더) 또는 checks/ 에서. */
'use strict';
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const DIRS = ['.', 'parts', 'app', path.join('app', 'parts'), '..', path.join('..', 'app'), path.join('..', 'app', 'parts')];
const read = (f) => { for(const d of DIRS){ try{ return fs.readFileSync(path.join(d, f), 'utf8'); }catch(_){} } return null; };
const exists = (f) => DIRS.some((d) => fs.existsSync(path.join(d, f)));
const SRC = read('catalog-api.js'), FI = read('firebase-init.js'), ERR = read('error-codes.js');
for(const [n, v] of [['catalog-api.js', SRC], ['firebase-init.js', FI], ['error-codes.js', ERR]]){
  if(!v){ say('  ? 원본 못 찾음 — ' + n); process.exit(2); }
}
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const names = [...SRC.matchAll(/^export (?:const|function|async function) (\w+)/gm)].map((m) => m[1]);
const load = (src) => new Function(src.replace(/^export (const|function|async function) /gm, '$1 ') + '\nreturn {' + names.join(',') + '};')();
const M = load(SRC);
const BASE = 'https://api.together-working.com';
const H = (c) => c.repeat(64).slice(0, 64);
const assetUrl = (h, e) => BASE + '/v2/catalog/assets/' + h + '.' + e;
const flush = async () => { for(let i = 0; i < 12; i++) await Promise.resolve(); await new Promise((r) => setImmediate(r)); };

/* 서버 한 벌(CatalogResponse.Catalog) 표본 */
const listing = (o) => Object.assign({ state: 'ACTIVE', access: { kind: 'everyone', display: 'show' } }, o || {});
const mkData = () => ({
  categories: [], shelves: [], products: [], unlocks: [], season: 'SPRING',
  parts: [
    { partId: 'hat1', name: '모자', icon: '🎩', category: 'hat', model: H('a'), thumb: H('b'), glow: false, multi: true, standalone: false, stackable: false, stackableWorn: false,
      rideTop: true, noColor: false, animMode: 'loop', charType: 'default', defaultTransform: { scale: 1.2, pos: [0, 0.1, 0], rot: [0, 90, 0] }, hides: ['mask'], listing: listing(), locked: false, version: 3 },
    { partId: 'g1', name: '가챠 안경', icon: '👓', category: 'glasses', model: H('c'), glow: true, multi: false, standalone: true, stackable: false, stackableWorn: true,
      rideTop: false, noColor: true, animMode: '', charType: 'default', hides: [], listing: listing({ acquisition: { kind: 'GACHA', season: 'SUMMER' } }), version: 1 },
    { partId: 'g2', name: '상시 가챠', icon: '🎁', category: 'cape', model: H('d'), glow: false, multi: false, standalone: false, stackable: false, stackableWorn: true,
      rideTop: false, noColor: false, animMode: '', charType: 'default', hides: [], listing: listing({ acquisition: { kind: 'GACHA', season: 'ALWAYS' } }), version: 1 },
  ],
  desks: [
    { deskId: 'd1', name: '나무 책상', icon: '🪑', model: H('e'), thumb: H('f'), play: { playMode: 'auto', autoPlay: true, glow: false }, listing: listing(), version: 1 },
    { deskId: 'd2', name: '전용 책상', icon: '💎', model: H('1'), play: { playMode: 'click', autoPlay: false, glow: true },
      listing: listing({ access: { kind: 'entitlement', key: 'premium', display: 'show' } }), version: 2 },
  ],
  deskProps: [
    { deskPropId: 'i1', name: '컵', icon: '☕', model: H('2'), thumb: H('3'), play: { playMode: 'idle', autoPlay: false, glow: false }, attachTo: 'handL', defaultSize: 0.5, listing: listing(), version: 1 },
  ],
});

(async () => {
  say('── 1. 펼치기');
  {
    const u = M.unfoldCatalog(mkData(), assetUrl);
    chk(Object.keys(u).join() === 'parts,items,desks' && Object.keys(u.parts).join() === 'hat1,g1,g2' && Object.keys(u.desks).join() === 'd1,d2' && Object.keys(u.items).join() === 'i1',
      '★ 한 벌 → { parts · items · desks } — 서버 deskProps 가 items · 가챠 파츠는 parts 한 목록 안(옛 gachaParts 를 합친 모양)');
    const p = u.parts.hat1;
    chk(p.name === '모자' && p.icon === '🎩' && p.cat === 'hat' && p.multi === true && p.rideTop === true && p.animMode === 'loop' && p.charType === 'default' && p.hides.join() === 'mask' && p.gacha === undefined,
      '  ↳ 파츠 칸 — category → cat · 숨김 · 모양 깃발 · 가챠 아님은 gacha 칸이 없다');
    chk(p.glbUrl === assetUrl(H('a'), 'glb') && p.thumbUrl === assetUrl(H('b'), 'png') && p.order === 0 && u.parts.g2.order === 2,
      '★ 파일은 해시 → GET /v2/catalog/assets/{해시}.glb · .png 주소 · order = 서버 진열 순서(배열 순서)');
    chk(p.defaultXf && p.defaultXf.scale === 1.2 && p.defaultXf.pos.join() === '0,0.1,0' && p.defaultXf.rot.join() === '0,90,0' && Object.keys(p.defaultXf.color).length === 0 && !u.parts.g1.defaultXf,
      '  ↳ defaultTransform → defaultXf({ scale · pos · rot · color:{} }) · 없으면 칸 없음');
    chk(u.parts.g1.gacha === true && u.parts.g1.season === 'SUMMER' && u.parts.g2.gacha === true && u.parts.g2.season === '' && u.parts.g1.stackable === false && u.parts.g1.noColor === true,
      '★ 가챠 — gacha:true · season(ALWAYS 는 \'\' = 상시) · stackable 은 저장값 그대로(가챠 강제는 앱의 _normPartRec 몫)');
    chk(!('thumbUrl' in u.parts.g1), '  ↳ 썸네일 해시가 없으면 thumbUrl 칸이 없다');
    const d = u.desks.d1, d2 = u.desks.d2;
    chk(d.name === '나무 책상' && d.playMode === 'auto' && d.autoPlay === true && d.licenseOnly === false && d.glbUrl === assetUrl(H('e'), 'glb') && !('attachTo' in d),
      '  ↳ 책상 — 재생 방식 · 전용 아님 · 소품 칸(attachTo)은 없다');
    chk(d2.licenseOnly === true && d2.glow === true, '★ 진열 access.kind entitlement → licenseOnly:true(옛 깃발과 같은 뜻)');
    const it = u.items.i1;
    chk(it.attachTo === 'handL' && it.defaultSize === 0.5 && it.playMode === 'idle' && it.licenseOnly === false, '  ↳ 소품 — attachTo · defaultSize · 재생 방식');
    const bad = mkData(); bad.parts[0].model = 'ZZ'; bad.parts.push({ name: 'id 없음' }); bad.parts.push(null);
    const ub = M.unfoldCatalog(bad, assetUrl);
    chk(!('glbUrl' in ub.parts.hat1) && Object.keys(ub.parts).length === 3, '  ↳ 해시 모양이 아니면 주소를 만들지 않는다(틀린 주소 0) · id 없는 줄 · null 은 그 줄만 뺀다');
    let t = null; try{ M.unfoldCatalog({ parts: {}, desks: [], deskProps: [] }, assetUrl); }catch(e){ t = e; }
    let t2 = null; try{ M.unfoldCatalog(null, assetUrl); }catch(e){ t2 = e; }
    chk(t && t.code === 'SHAPE' && t2 && t2.code === 'SHAPE', '★ 한 벌의 모양이 틀리면(parts 가 배열 아님 · 빈 값) 던진다 — 빈 목록으로 꾸미지 않는다');
  }

  /* 가짜 API · 가짜 realtime */
  const mkEnv = (opts) => {
    const o = opts || {};
    const env = { calls: [], notes: [], warns: [], data: mkData(), fail: null, same: false };
    env.api = { baseUrl: () => BASE, get: async (p, op) => { env.calls.push({ p, op }); if(env.fail) throw env.fail; if(env.same && env.last) return env.last; env.last = JSON.parse(JSON.stringify(env.data)); return env.last; } };
    env.h = {}; env.st = [];
    env.rt = { on: (k, fn) => { env.h[k] = fn; return () => {}; }, onState: (fn) => { env.st.push(fn); return () => {}; } };
    env.make = (Mod) => (Mod || M).createCatalogApi({ api: env.api, rt: o.noRt ? null : env.rt, notifyError: (c, e) => env.notes.push([c, e]), warn: (...a) => env.warns.push(a.join(' ')) });
    return env;
  };

  say('── 2. 받기');
  {
    const env = mkEnv(); const cat = env.make();
    const got = { parts: [], items: [], desks: [] };
    cat.subscribe('parts', (v) => got.parts.push(v)); cat.subscribe('items', (v) => got.items.push(v)); cat.subscribe('desks', (v) => got.desks.push(v));
    await flush();
    chk(env.calls.length === 1 && env.calls[0].p === '/v2/catalog' && env.calls[0].op.timeoutMs === 8000, '★ 구독 셋이어도 요청 하나 — 길은 GET /v2/catalog(옛 /v2/catalog/{종류}?v= 아님) · 본문이 커서 시간 제한 8초');
    chk(got.parts.length === 1 && got.items.length === 1 && got.desks.length === 1 && got.parts[0].hat1 && got.items[0].i1 && got.desks[0].d2, '  ↳ 세 구독자가 제 종류의 전체 목록을 한 번씩 받는다');
    got.parts[0].hat1.glb = 'BASE64';   // 받는 쪽(resolveCatalogGlb)이 rec.glb 를 채워 넣는다
    let late = null; cat.subscribe('parts', (v) => { late = v; });
    chk(env.calls.length === 1 && late && late.hat1 && !('glb' in late.hat1), '★ 늦은 구독자는 새 요청 없이 지금 값을 바로 받는다 · 값은 늘 새 객체(앞 구독자가 glb 를 채워도 섞이지 않는다)');
    env.same = true; await cat.load(); await flush();
    chk(env.calls.length === 2 && got.parts.length === 1 && got.desks.length === 1, '★ 304(같은 객체가 온다)면 다시 넘기지 않는다');
    env.same = false; env.data.desks[0].name = '바뀐 책상'; await cat.load(); await flush();
    chk(got.desks.length === 2 && got.desks[1].d1.name === '바뀐 책상' && got.parts.length === 1 && got.items.length === 1, '  ↳ 바뀐 종류(책상)만 다시 넘긴다 · 같은 파츠 · 아이템은 그대로');
    const un = cat.subscribe('items', () => {}); un();
    chk(typeof un === 'function' && typeof cat.subscribe('x', () => {}) === 'function' && env.calls.length === 3, '  ↳ 해제 함수를 돌려준다 · 모르는 종류 · 콜백 없음은 요청하지 않는다');
  }

  say('── 3. 알림 — realtime catalog');
  {
    const env = mkEnv(); const cat = env.make(); const got = [];
    cat.subscribe('desks', (v) => got.push(v)); await flush();
    chk(typeof env.h.catalog === 'function' && env.st.length === 1, '★ 구독하면 realtime 허브의 catalog 알림 · 연결 상태를 건다');
    env.data.desks[1].name = '알림 뒤 책상'; env.h.catalog({ kind: 'catalog', resync: false }); await flush();
    chk(env.calls.length === 2 && got.length === 2 && got[1].d2.name === '알림 뒤 책상', '★ catalog 알림 → 다시 묻는다(ETag) · 바뀐 값을 넘긴다');
    env.h.catalog({ resync: true }); await flush();
    chk(env.calls.length === 3, '  ↳ 오래 끊겼다 붙은 알림(resync)도 같은 일');
    let release; env.api.get = async (p, op) => { env.calls.push({ p, op }); await new Promise((r) => { release = r; }); return JSON.parse(JSON.stringify(env.data)); };
    env.h.catalog({}); env.h.catalog({}); env.h.catalog({}); await flush();
    chk(env.calls.length === 4, '  ↳ 받는 중에 알림이 여럿 와도 요청은 하나');
    release(); await flush(); release && release(); await flush();
    chk(env.calls.length === 5, '  ↳ 받는 중에 온 알림은 끝난 뒤 한 번 더(놓치지 않는다)');
    env.api.get = async (p, op) => { env.calls.push({ p, op }); return JSON.parse(JSON.stringify(env.data)); };
    env.st[0]('ready'); await flush();
    chk(env.calls.length === 5, '  ↳ 받기에 실패한 적이 없으면 연결이 ready 가 되어도 다시 받지 않는다');
  }

  say('── 4. 실패 — 드러내고 물러나지 않는다');
  {
    const env = mkEnv(); const cat = env.make(); const got = [];
    env.fail = Object.assign(new Error('x'), { kind: 'unavailable', code: 'NETWORK' });
    cat.subscribe('parts', (v) => got.push(v)); await flush();
    chk(got.length === 0 && env.notes.length === 1 && env.notes[0][0] === 'E-CHAR-26' && env.notes[0][1] === env.fail, '★ 못 받으면 E-CHAR-26 으로 알린다 · 빈 목록을 넘기지 않는다(빈 카탈로그와 다르다)');
    env.fail = null; env.st[0]('ready'); await flush();
    chk(got.length === 1 && got[0].hat1 && env.notes.length === 1, '★ realtime 이 붙으면(ready) 실패했던 받기를 다시 한다 · 성공하면 알림 없음');
    env.fail = Object.assign(new Error('y'), { kind: 'noRoute', code: 'NOT_FOUND' });
    env.h.catalog({}); await flush();
    chk(got.length === 1 && got[0].hat1 && env.notes.length === 2, '  ↳ 길 없음(404 noRoute) 같은 실패도 지난 목록을 비우지 않고 번호로 알린다');
    const bad = mkEnv(); const cb = bad.make(); let n = 0;
    bad.data.parts = 'x'; cb.subscribe('parts', () => { n++; }); await flush();
    chk(n === 0 && bad.notes.length === 1 && bad.notes[0][1].code === 'SHAPE', '  ↳ 모양이 틀린 응답도 실패로 알린다(빈 목록으로 꾸미지 않는다)');
    const nort = mkEnv({ noRt: true }); const cn = nort.make(); let m = 0; cn.subscribe('items', () => { m++; }); await flush();
    chk(m === 1, '  ↳ realtime 이 없어도 처음 받기는 된다(알림만 못 듣는다)');
    const none = M.createCatalogApi({ notifyError: (c) => none.notes.push(c) }); none.notes = [];
    none.subscribe('parts', () => {}); await flush();
    chk(none.notes.join() === 'E-CHAR-26', '  ↳ API 통로가 없으면 던지지 않고 번호로 알린다');
    const code = strip(SRC);
    chk(!/setTimeout|setInterval/.test(code) && !/firebase|indexedDB|onValue/i.test(code) && !/^\s*import\s/m.test(code), '★ 타이머로 두드리지 않고 · Firebase · IndexedDB 를 모르고 · import 가 없다(통로는 deps)');
    chk(/'E-CHAR-26': \{/.test(ERR), '  ↳ E-CHAR-26 이 error-codes.js 표에 있다');
  }

  say('── 5. 배선');
  {
    const fi = strip(FI);
    chk(/import \{ createCatalogApi \} from "\.\/(?:(?:\.\.\/)?[\w-]+\/)?catalog-api\.js";/.test(FI), 'firebase-init.js 가 catalog-api.js 를 import 한다');
    chk(/const _catalogApi = createCatalogApi\(\{\s*api: window\.TwApi\.client,\s*rt: window\.TwRtHub\.store,\s*notifyError: \(\.\.\.a\) => window\.TwErrorCodes\.notify\(\.\.\.a\),\s*\}\);/.test(fi),
      '  ↳ 만드는 줄 — 로그인 없는 API 통로 · realtime 허브 · 오류 번호(부를 때 찾는다)');
    chk(/subscribeCatalogDesks\(onChange\)\{\s*return _catalogApi\.subscribe\('desks', onChange\);/.test(fi) && /subscribeCatalogItems\(onChange\)\{\s*return _catalogApi\.subscribe\('items', onChange\);/.test(fi)
      && /subscribeCatalogParts\(onChange\)\{\s*return _catalogApi\.subscribe\('parts', onChange\);/.test(fi), '  ↳ 책상 · 아이템 · 파츠 구독이 서버 한 벌에 이어진다');
    chk(!/\/v2\/catalog\/['"`]?\s*\+\s*kind|v2\/catalog\/(?:parts|gachaParts|items|desks)/.test(fi + strip(SRC)), '★ 옛 길 GET /v2/catalog/{종류}?v= 가 코드에 없다');
    chk(!/ref\(db,\s*['"`]catalogMeta/.test(fi) && !/onValue\([^)]*catalogMeta/.test(fi) && !/ref\(db,\s*['"`]catalog\/(?:parts|gachaParts|items|desks)['"`]\)[^;]{0,40}onValue/.test(fi), '★ Firebase catalogMeta 를 읽는 구독이 없다(쓰기쪽 올림은 옛 앱 호환이라 남는다)');
    chk(!exists('catalog-cache.js') && !/catalog-cache\.js/.test(fi), '  ↳ 옛 catalog-cache.js(버전 확인 · IndexedDB 캐시 · Firebase 로 물러나기)가 없다');
    chk(!/createApiCatalogFetch|firebaseGet/.test(fi), '  ↳ «API 실패면 Firebase get» 이 없다');
  }

  say('── 6. 일부러 깨 보기');
  {
    const run = async (Mod, tweak) => {   // 핵심 동작 묶음 — 하나라도 틀리면 false
      const env = mkEnv(); const cat = env.make(Mod); const got = []; let okAll = true;
      const ok = (c) => { if(!c) okAll = false; };
      cat.subscribe('parts', (v) => got.push(v)); cat.subscribe('desks', (v) => got.push(v)); await flush();
      ok(env.calls.length === 1 && env.calls[0].p === '/v2/catalog' && got.length === 2);
      got[0].hat1 && (got[0].hat1.glb = 'X'); let late = null; cat.subscribe('parts', (v) => { late = v; }); ok(late && !('glb' in late.hat1));
      env.same = true; await cat.load(); await flush(); ok(got.length === 2);
      env.same = false; env.data.desks[0].name = 'N'; await cat.load(); await flush(); ok(got.length === 3);
      env.h.catalog && env.h.catalog({}); await flush(); ok(env.calls.length >= 4);
      env.fail = new Error('x'); const before = env.notes.length; await cat.load(); await flush(); ok(env.notes.length === before + 1 && env.notes[before][0] === 'E-CHAR-26');
      env.fail = null; const c0 = env.calls.length; env.st[0] && env.st[0]('ready'); await flush(); ok(env.calls.length === c0 + 1);   // 실패한 뒤 연결이 붙으면 다시
      env.data.desks[0].name = 'M2'; env.h.catalog({}); await flush(); ok(got.some((v) => v.d1 && v.d1.name === 'M2'));   // 같은 객체 재사용이 아니라 바뀐 값이 온다
      /* 받는 중에 알림이 또 오면 끝난 뒤 한 번 더 */
      const ov = mkEnv(); const co = ov.make(Mod); let rel = []; const real = ov.api.get;
      ov.api.get = async (p, op) => { ov.calls.push({ p, op }); await new Promise((r) => rel.push(r)); return JSON.parse(JSON.stringify(ov.data)); };
      co.subscribe('desks', () => {}); await flush(); ov.h.catalog({}); ov.h.catalog({}); await flush();
      ok(ov.calls.length === 1); rel.shift()(); await flush(); await flush(); ok(ov.calls.length === 2); rel.forEach((r) => r()); await flush();
      return okAll;
    };
    chk(await run(M), '원본은 핵심 동작을 다 지킨다');
    const BREAKS = [
      ["api.get(CATALOG_PATH, {", "api.get(CATALOG_PATH + '/parts', {", '옛 길 /v2/catalog/{종류} 를 부름'],
      ["      if(text === last[kind]) continue;", "", '바뀌지 않은 종류도 다시 넘김'],
      ["try{ onData(clone(cur[kind])); }", "try{ onData(cur[kind]); }", '값을 복제하지 않고 같은 객체를 넘김'],
      ["catch(e){ failed = true; try{ notifyError('E-CHAR-26', e); }catch(_){}", "catch(e){ failed = true;", '실패를 번호로 안 알림'],
      ["rt.on('catalog', () => { load(); });", "", 'catalog 알림을 안 들음'],
      ["    if(data === raw && cur) return;", "    if(cur) return;", '바뀐 값도 304 처럼 넘김'],
      ["    if(running){ again = true; return running; }", "    if(running) return running;", '받는 중에 온 알림을 놓침'],
      ["if(s === 'ready' && failed) load();", "", '연결 복구 때 다시 안 받음'],
    ];
    const missed = [];
    for(const [from, to, what] of BREAKS){
      if(SRC.indexOf(from) < 0){ missed.push('글 못 찾음: ' + what); continue; }
      let good; try{ good = await run(load(SRC.split(from).join(to))); }catch(_){ good = false; }
      if(good) missed.push(what);
    }
    chk(!missed.length, '일부러 깨 본 ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — 못 잡음: ' + missed.join(' · ') : ''));
    const fb = FI.replace("return _catalogApi.subscribe('parts', onChange);", "return null;");
    chk(fb !== FI && !/subscribeCatalogParts\(onChange\)\{\s*return _catalogApi\.subscribe\('parts', onChange\);/.test(strip(fb)), '  깨 보기: 파츠 구독을 끊으면 배선 판정이 빨강');
  }

  say('\n' + pass + ' · ' + fail);
  process.exit(fail ? 1 : 0);
})().catch((e) => { fail++; say('  ✗ 예외: ' + (e && e.stack || e)); say('\n' + pass + ' · ' + fail); process.exit(1); });
