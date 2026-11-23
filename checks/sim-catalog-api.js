/* ═══ 🧩 sim-catalog-api.js — 카탈로그를 서버 한 벌 GET /v2/catalog 에서(character/catalog-api.js) ═══════════════
   [왜] #887 이 서버에 없는 GET /v2/catalog/{parts·gachaParts·items·desks}?v= 를 만들었다. 서버 정본은 GET /v2/catalog 한 벌(ETag · no-cache)이다.
     이 검사는 한 벌을 앱의 세 목록(parts · items · desks)으로 펼치는 표 · 받기(로그인 통로 · 서버 locked 그대로) · 알림 · 실패(Firebase 로 안 물러남) · 로그인이 끝나면 비움을 지킨다.
   1. 펼치기 — 서버 한 벌(CatalogResponse)의 칸이 옛 레코드 칸으로(가챠 · 전용 · 위치 · 파일 주소 · 순서 · 깨진 줄 · 모양이 틀린 한 벌)
   1-B. 파일 주소 — files(해시 → Storage 다운로드 URL)의 맞는 URL(이 앱의 버킷 하나)을 쓰고, 없거나 틀린 URL(http · 다른 호스트 · 다른 판의 버킷 · 다른 해시)은 서버 파일 endpoint ·
        files 가 없으면 옛 모양 그대로 · 틀린 URL 은 앱 실행마다 한 번 warn(해시만 · URL 은 안 찍음) · 버킷은 firebase-config 의 storageBucket 하나
   2. 받기 — 길은 GET /v2/catalog 하나 · 구독 셋이 요청 하나 · 새 객체 · 같은 값은 다시 안 넘김 · 늦은 구독자
   3. 알림 — realtime catalog 알림이 다시 받기 · 받는 중 알림은 한 번 더 · 연결이 ready 가 되면 실패했을 때만 다시
   4. 실패 — E-CHAR-26 으로 드러냄 · 지난 목록을 비우지 않음 · Firebase 로 안 물러남 · 타이머로 두드리지 않음
   4-B. 로그인이 끝나면 — 마지막 구독자가 빠지면 값 · 알림 구독을 비운다(다음 로그인이 앞 사람의 locked 를 받지 않는다) · 늦게 온 앞 로그인의 답은 버린다
   5. 배선 — app.js(만드는 줄 · 로그인 통로) · app-boot 차례 'catalog' · html · Firebase 에는 카탈로그가 없다 · 옛 endpoint(/v2/catalog/{종류}) · catalogMeta 구독 · catalog-cache.js · catalog-source.js 가 없다
   6. mutation test(1-B 의 URL 검사 포함)
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
const SRC = read('catalog-api.js'), FC = read('firebase-config.js'), FI = read('firebase-init.js'), ERR = read('error-codes.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html'), BOOT = read('app-boot.js');
for(const [n, v] of [['catalog-api.js', SRC], ['firebase-config.js', FC], ['firebase-init.js', FI], ['error-codes.js', ERR], ['app.js', APP], ['html', HTML], ['app-boot.js', BOOT]]){
  if(!v){ say('  ? 원본 못 찾음 — ' + n); process.exit(2); }
}
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const load = (src) => { const m = { exports: {} }; new Function('window', 'module', src)(undefined, m); return m.exports; };   // classic script — module.exports 로 꺼낸다
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
    { deskId: 'd2', name: '전용 책상', icon: '💎', model: H('1'), play: { playMode: 'click', autoPlay: false, glow: true }, locked: true,
      listing: listing({ access: { kind: 'entitlement', key: 'premium', display: 'show' } }), version: 2 },
    { deskId: 'd3', name: '내가 쓸 수 있는 전용 책상', icon: '💠', model: H('4'), play: { playMode: 'click', autoPlay: false, glow: false }, locked: false,
      listing: listing({ access: { kind: 'entitlement', key: 'premium', display: 'show' } }), version: 1 },
  ],
  deskProps: [
    { deskPropId: 'i1', name: '컵', icon: '☕', model: H('2'), thumb: H('3'), play: { playMode: 'idle', autoPlay: false, glow: false }, attachTo: 'handL', defaultSize: 0.5, listing: listing(), version: 1 },
  ],
});

(async () => {
  say('── 1. 펼치기');
  {
    const u = M.unfoldCatalog(mkData(), assetUrl);
    chk(Object.keys(u).join() === 'parts,items,desks,categories,unlocks' && Object.keys(u.parts).join() === 'hat1,g1,g2' && Object.keys(u.desks).join() === 'd1,d2,d3' && Object.keys(u.items).join() === 'i1',
      '★ 한 벌 → { parts · items · desks } — 서버 deskProps 가 items · 가챠 파츠는 parts 한 목록 안(옛 gachaParts 를 합친 모양)');
    const p = u.parts.hat1;
    chk(p.name === '모자' && p.icon === '🎩' && p.cat === 'hat' && p.multi === true && p.rideTop === true && p.animMode === 'loop' && p.charType === 'default' && p.hides.join() === 'mask' && p.gacha === undefined,
      '  ↳ 파츠 칸 — category → cat · 숨김 · 모양 깃발 · 가챠 아님은 gacha field 가 없다');
    chk(p.glbUrl === assetUrl(H('a'), 'glb') && p.thumbUrl === assetUrl(H('b'), 'png') && p.order === 0 && u.parts.g2.order === 2,
      '★ 파일은 해시 → GET /v2/catalog/assets/{해시}.glb · .png 주소 · order = 서버 진열 순서(배열 순서)');
    chk(p.defaultXf && p.defaultXf.scale === 1.2 && p.defaultXf.pos.join() === '0,0.1,0' && p.defaultXf.rot.join() === '0,90,0' && Object.keys(p.defaultXf.color).length === 0 && !u.parts.g1.defaultXf,
      '  ↳ defaultTransform → defaultXf({ scale · pos · rot · color:{} }) · 없으면 칸 없음');
    chk(u.parts.g1.gacha === true && u.parts.g1.season === 'summer' && u.parts.g2.gacha === true && u.parts.g2.season === '' && u.parts.g1.stackable === false && u.parts.g1.noColor === true,
      '★ 가챠 — gacha:true · season(소문자 — gacha.js 가 읽는 이름 · ALWAYS 는 \'\' = 상시) · stackable 은 저장값 그대로(가챠 강제는 앱의 _normPartRec 몫)');
    chk(!('thumbUrl' in u.parts.g1), '  ↳ 썸네일 해시가 없으면 thumbUrl field 가 없다');
    chk(u.parts.hat1.version === 3 && u.parts.hat1.modelHash === H('a') && u.parts.hat1.thumbHash === H('b') && u.parts.hat1.listingAccess.kind === 'everyone' && !('thumbHash' in u.parts.g1)
      && u.desks.d2.version === 2 && u.desks.d2.listingAccess.kind === 'entitlement' && u.items.i1.modelHash === H('2'),
      '★ 관리자가 되돌려 보낼 칸 — version · 파일 해시 · 진열 권한을 레코드에 싣는다(없는 해시는 칸이 없다)');
    const dc = mkData();
    dc.categories = [
      { code: 'hat', builtin: true, group: 'HEAD', label: '모자', icon: '🎩', bone: 'head', position: 0, version: 0, defaultLabel: '모자', defaultIcon: '🎩', overridden: false },
      { code: 'cape', builtin: true, group: 'CLOTH', label: '겉옷', icon: '🧥', bone: 'spine', position: 1, version: 4, defaultLabel: '망토', defaultIcon: '🧣', overridden: true },
      { code: 'scarf', builtin: false, group: 'CLOTH', label: '목도리', icon: '🧶', bone: 'spine', position: 2, version: 2, overridden: false },
    ];
    dc.unlocks = [{ kind: 'ANIMAL_CHARACTER', key: 'animal', level: 40, label: '동물 캐릭터', version: 1 }, { kind: 'DANCE', key: '80', level: 80, label: '살랑살랑', version: 0 }];
    const uc = M.unfoldCatalog(dc, assetUrl);
    chk(JSON.stringify(uc.categories.customCats) === JSON.stringify([{ cat: 'scarf', label: '목도리', icon: '🧶', group: 'cloth', bone: 'spine' }])
      && JSON.stringify(uc.categories.catOverrides) === JSON.stringify({ cape: { label: '겉옷', icon: '🧥' } }),
      '★ 카테고리 — 운영이 더한 것은 customCats(group 소문자) · 기본 카테고리는 처음 값에서 바뀐 것만 catOverrides');
    chk(uc.unlocks.ANIMAL_CHARACTER.animal.level === 40 && uc.unlocks.DANCE['80'].level === 80, '★ 해금 — 종류 → 열쇠 → 레벨(동물 해금 레벨은 ANIMAL_CHARACTER · animal)');
    const nb = mkData(); delete nb.categories;
    let thrown = null; try{ M.unfoldCatalog(nb, assetUrl); }catch(e){ thrown = e; }
    chk(thrown && thrown.code === 'SHAPE', '  ↳ categories · unlocks 가 배열이 아니면 모양이 틀린 한 벌로 던진다');
    const d = u.desks.d1, d2 = u.desks.d2;
    chk(d.name === '나무 책상' && d.playMode === 'auto' && d.autoPlay === true && d.licenseOnly === false && d.glbUrl === assetUrl(H('e'), 'glb') && !('attachTo' in d),
      '  ↳ 책상 — 재생 방식 · 전용 아님 · 소품 칸(attachTo)은 없다');
    chk(d2.locked === true && d2.licenseOnly === true && d2.glow === true, '★ 두 칸 — 서버 locked:true → locked:true(막기 · 서버 값 그대로) · 진열 entitlement → licenseOnly:true(전용 분류)');
    chk(u.desks.d3.locked === false && u.desks.d3.licenseOnly === true && u.desks.d3.listingAccess.kind === 'entitlement' && d.locked === false && d.licenseOnly === false,
      '★ 진열이 전용이어도 서버 locked 가 거짓이면(이 사람은 쓸 수 있다) locked:false — 막기는 분류로 정하지 않는다. 분류(licenseOnly)는 그대로 true 라 «전용 책상» 탭에 그려진다');
    const nl = mkData(); delete nl.desks[0].locked; delete nl.deskProps[0].locked;
    chk(M.unfoldCatalog(nl, assetUrl).desks.d1.locked === false, '  ↳ locked field 가 없으면(null · 안 옴) 막지 않는다 — 서버가 «못 고름» 이라 한 것만 막는다');
    const it = u.items.i1;
    chk(it.attachTo === 'handL' && it.defaultSize === 0.5 && it.playMode === 'idle' && it.licenseOnly === false && it.locked === false, '  ↳ 소품 — attachTo · defaultSize · 재생 방식');
    const bad = mkData(); bad.parts[0].model = 'ZZ'; bad.parts.push({ name: 'id 없음' }); bad.parts.push(null);
    const ub = M.unfoldCatalog(bad, assetUrl);
    chk(!('glbUrl' in ub.parts.hat1) && Object.keys(ub.parts).length === 3, '  ↳ 해시 모양이 아니면 주소를 만들지 않는다(틀린 주소 0) · id 없는 줄 · null 은 그 줄만 뺀다');
    let t = null; try{ M.unfoldCatalog({ parts: {}, desks: [], deskProps: [] }, assetUrl); }catch(e){ t = e; }
    let t2 = null; try{ M.unfoldCatalog(null, assetUrl); }catch(e){ t2 = e; }
    chk(t && t.code === 'SHAPE' && t2 && t2.code === 'SHAPE', '★ 한 벌의 모양이 틀리면(parts 가 배열 아님 · 빈 값) 던진다 — 빈 목록으로 꾸미지 않는다');
  }

  say('── 1-B. 파일 주소 — files 의 Storage URL');
  const PROD_B = 'together-working.firebasestorage.app', DEV_B = 'together-working-dev.firebasestorage.app';
  {
    const SU = (h, ext, bucket) => 'https://firebasestorage.googleapis.com/v0/b/' + (bucket || PROD_B) + '/o/assets%2F' + h + '.' + ext + '?alt=media&token=tok-1';
    const withFiles = (files, bucket, onBad) => { const d = mkData(); d.files = files; return M.unfoldCatalog(d, assetUrl, { bucket: bucket === undefined ? PROD_B : bucket, onBad }); };
    const u = withFiles({ [H('a')]: SU(H('a'), 'glb'), [H('2')]: SU(H('2'), 'glb'), [H('3')]: SU(H('3'), 'webp') });
    chk(u.parts.hat1.glbUrl === SU(H('a'), 'glb') && u.items.i1.glbUrl === SU(H('2'), 'glb') && u.items.i1.thumbUrl === SU(H('3'), 'webp'),
      '★ files 에 이 앱 버킷의 맞는 URL 이 있으면 그 URL 을 그대로 쓴다(썸네일 확장자는 저장된 형식)');
    chk(u.parts.hat1.thumbUrl === assetUrl(H('b'), 'png') && u.desks.d1.glbUrl === assetUrl(H('e'), 'glb') && u.parts.hat1.modelHash === H('a'),
      '★ 맵에 없는 해시는 서버 파일 endpoint(GET /v2/catalog/assets/) 그대로 · 관리자 field(modelHash)는 해시 그대로');
    const dv = withFiles({ [H('a')]: SU(H('a'), 'glb', DEV_B), [H('2')]: SU(H('2'), 'glb') }, DEV_B);
    chk(dv.parts.hat1.glbUrl === SU(H('a'), 'glb', DEV_B) && dv.items.i1.glbUrl === assetUrl(H('2'), 'glb')
      && withFiles({ [H('a')]: SU(H('a'), 'glb', DEV_B) }).parts.hat1.glbUrl === assetUrl(H('a'), 'glb'),
      '★ 버킷은 이 앱의 것 하나 — dev 앱은 dev 버킷만 · 운영 앱은 운영 버킷만(다른 판의 버킷 URL 은 서버 파일 endpoint)');
    chk(withFiles({ [H('a')]: SU(H('a'), 'glb') }, '').parts.hat1.glbUrl === assetUrl(H('a'), 'glb') && M.unfoldCatalog(Object.assign(mkData(), { files: { [H('a')]: SU(H('a'), 'glb') } }), assetUrl).parts.hat1.glbUrl === assetUrl(H('a'), 'glb'),
      '  ↳ 버킷을 모르면(빈 값 · 안 넘김) files 를 쓰지 않는다');
    const BAD = [
      ['http', SU(H('a'), 'glb').replace('https:', 'http:')],
      ['다른 호스트', SU(H('a'), 'glb').replace('firebasestorage.googleapis.com', 'evil.example.com')],
      ['비슷한 호스트', SU(H('a'), 'glb').replace('firebasestorage.googleapis.com', 'firebasestorage.googleapis.com.evil.io')],
      ['googleapis 다른 이름', SU(H('a'), 'glb').replace('firebasestorage.', 'storage.')],
      ['포트', SU(H('a'), 'glb').replace('googleapis.com/', 'googleapis.com:8443/')],
      ['userinfo', SU(H('a'), 'glb').replace('https://', 'https://u:p@')],
      ['남의 버킷', SU(H('a'), 'glb', 'other-project.firebasestorage.app')],
      ['다른 판의 버킷', SU(H('a'), 'glb', DEV_B)],
      ['다른 해시의 파일', SU(H('b'), 'glb')],
      ['assets 밖 경로', SU(H('a'), 'glb').replace('assets%2F', 'users%2Fx%2F')],
      ['alt=media 없음', SU(H('a'), 'glb').replace('alt=media&', '')],
      ['글자 아님', 42],
      ['너무 김', SU(H('a'), 'glb') + 'x'.repeat(1000)],
      ['URL 아님', 'not a url'],
      ['javascript', 'javascript:alert(1)'],
    ];
    const leaked = BAD.filter(([, v]) => withFiles({ [H('a')]: v }).parts.hat1.glbUrl !== assetUrl(H('a'), 'glb')).map(([n]) => n);
    chk(!leaked.length, '★ 틀린 URL ' + BAD.length + '가지(http · 다른 호스트 · 남의 · 다른 판의 버킷 · 다른 해시 · 포트 · 경로 · alt …)는 쓰지 않고 서버 파일 endpoint 로' + (leaked.length ? ' — 샌 것: ' + leaked.join(' · ') : ''));
    const bads = []; withFiles({ [H('a')]: 'http://x', [H('2')]: SU(H('2'), 'glb') }, PROD_B, (h) => bads.push(h));
    chk(bads.join() === H('a'), '  ↳ 맵에 있는데 틀린 URL 만 onBad(해시)로 알린다(맞는 URL · 맵에 없는 해시는 알리지 않는다)');
    const plain = M.unfoldCatalog(mkData(), assetUrl);
    chk(JSON.stringify(withFiles(undefined)) === JSON.stringify(plain) && JSON.stringify(withFiles(null)) === JSON.stringify(plain) && JSON.stringify(withFiles([SU(H('a'), 'glb')])) === JSON.stringify(plain)
      && JSON.stringify(withFiles({})) === JSON.stringify(plain),
      '★ files 가 없거나(옛 서버) · 비었거나 · 맵이 아니면 옛 모양 그대로(모두 서버 파일 endpoint)');
    /* 받기 — 버킷은 deps.storageBucket() · 틀린 URL 경고는 앱 실행마다 한 번 · 해시만 */
    const warns = []; let d = mkData(); d.files = { [H('a')]: 'http://bad?token=SECRET', [H('2')]: SU(H('2'), 'glb') };
    const api = { baseUrl: () => BASE, get: async () => JSON.parse(JSON.stringify(d)) };
    const rt = { on: () => () => {}, onState: () => () => {} };
    const cat = M.createCatalogApi({ api, rt, notifyError: () => {}, warn: (...a) => warns.push(a.join(' ')), storageBucket: () => PROD_B });
    const got = []; cat.subscribe('items', (v) => got.push(v)); await flush();
    d = mkData(); d.files = { [H('a')]: 'http://bad2', [H('b')]: 'http://bad3' }; await cat.load(); await flush();
    chk(got[0] && got[0].i1.glbUrl === SU(H('2'), 'glb'), '★ 받기는 deps.storageBucket()(app.js — firebaseAPI.storageBucket) 버킷으로 files 를 쓴다');
    chk(warns.length === 1 && warns[0].includes(H('a')) && !/SECRET|http/.test(warns[0]), '★ 틀린 URL 은 앱 실행마다 warn 한 줄(해시만 · URL · 토큰은 찍지 않는다) · 다시 받아도 또 찍지 않는다 · 오류 번호 없음');
    chk(/storageBucket\(\)\{ return firebaseConfig\.storageBucket; \}/.test(strip(FI)) && /storageBucket: \(\)=>firebaseAPI\.storageBucket\(\),/.test(strip(APP))
      && /storageBucket: "together-working\.firebasestorage\.app"/.test(FC) && /storageBucket: "together-working-dev\.firebasestorage\.app"/.test(FC)
      && !/together-working(?:-dev)?\.firebasestorage\.app/.test(SRC),
      '  ↳ 버킷 판단은 firebase-config.js 한 곳(firebaseAPI.storageBucket → app.js → deps) · catalog-api.js 에 버킷 이름이 없다');
    const csp = (HTML.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/) || [])[1] || '';
    const dir = (n) => ((csp.match(new RegExp('(?:^|; )' + n + ' ([^;]*)')) || [])[1] || '').split(' ');
    chk(dir('connect-src').includes('https://*.googleapis.com') && dir('img-src').includes('https:'),
      '  ↳ CSP 가 Storage 호스트를 받는다 — GLB fetch(connect-src https://*.googleapis.com) · 썸네일 <img>(img-src https:)');
  }

  /* 가짜 API · 가짜 realtime */
  const mkEnv = (opts) => {
    const o = opts || {};
    const env = { calls: [], notes: [], warns: [], data: mkData(), fail: null, same: false };
    env.api = { baseUrl: () => BASE, get: async (p, op) => { env.calls.push({ p, op }); if(env.fail) throw env.fail; if(env.same && env.last) return env.last; env.last = JSON.parse(JSON.stringify(env.data)); return env.last; } };
    env.h = {}; env.st = []; env.offs = 0;
    env.rt = { on: (k, fn) => { env.h[k] = fn; return () => { env.offs++; delete env.h[k]; }; }, onState: (fn) => { env.st.push(fn); return () => { env.offs++; env.st.length = 0; }; } };
    env.make = (Mod) => (Mod || M).createCatalogApi({ api: env.api, rt: env.rt, notifyError: (c, e) => env.notes.push([c, e]), warn: (...a) => env.warns.push(a.join(' ')), storageBucket: () => PROD_B });
    return env;
  };

  say('── 2. 받기');
  {
    const env = mkEnv(); const cat = env.make();
    const got = { parts: [], items: [], desks: [] };
    cat.subscribe('parts', (v) => got.parts.push(v)); cat.subscribe('items', (v) => got.items.push(v)); cat.subscribe('desks', (v) => got.desks.push(v));
    await flush();
    chk(env.calls.length === 1 && env.calls[0].p === '/v2/catalog' && env.calls[0].op.timeoutMs === 8000, '★ 구독 셋이어도 요청 하나 — 길은 GET /v2/catalog(옛 /v2/catalog/{종류}?v= 아님) · 본문이 커서 시간 제한 8초');
    chk(env.calls[0].op.auth === true, '★ 로그인 읽기로 받는다(auth:true) — 서버가 보는 사람마다 locked 를 정한다');
    chk(got.parts.length === 1 && got.items.length === 1 && got.desks.length === 1 && got.parts[0].hat1 && got.items[0].i1 && got.desks[0].d2, '  ↳ 세 구독자가 제 종류의 전체 목록을 한 번씩 받는다');
    got.parts[0].hat1.glb = 'BASE64';   // 받는 쪽(resolveCatalogGlb)이 rec.glb 를 채워 넣는다
    let late = null; cat.subscribe('parts', (v) => { late = v; });
    chk(env.calls.length === 1 && late && late.hat1 && !('glb' in late.hat1), '★ 늦은 구독자는 새 요청 없이 지금 값을 바로 받는다 · 값은 늘 새 객체(앞 구독자가 glb 를 채워도 섞이지 않는다)');
    env.same = true; await cat.load(); await flush();
    chk(env.calls.length === 2 && got.parts.length === 1 && got.desks.length === 1, '★ 304(같은 객체가 온다)면 다시 넘기지 않는다');
    env.same = false; env.data.desks[0].name = '바뀐 책상'; await cat.load(); await flush();
    chk(got.desks.length === 2 && got.desks[1].d1.name === '바뀐 책상' && got.parts.length === 1 && got.items.length === 1, '  ↳ 바뀐 종류(책상)만 다시 넘긴다 · 같은 파츠 · 아이템은 그대로');
    const cg = []; cat.subscribe('categories', (v) => cg.push(v)); const ug = []; cat.subscribe('unlocks', (v) => ug.push(v));
    chk(cg.length === 1 && Array.isArray(cg[0].customCats) && ug.length === 1 && typeof ug[0] === 'object' && !!cat.current() && Array.isArray(cat.current().parts),
      '★ 카테고리 · 해금도 같은 한 벌에서 구독한다(요청 추가 없음) · current() 는 마지막으로 받은 서버 한 벌 그대로(관리자 쓰기가 version 을 읽는다)');
    chk(mkEnv().make().current() === null, '  ↳ 아직 못 받았으면 current() 는 null');
    const un = cat.subscribe('items', () => {}); un();
    chk(typeof un === 'function' && (() => { try{ cat.subscribe('x', () => {}); return false; }catch(_){ return true; } })() && env.calls.length === 3, '  ↳ 해제 함수를 돌려준다 · 모르는 종류는 던진다(요청하지 않는다)');
  }

  say('── 3. 알림 — realtime catalog');
  {
    const env = mkEnv(); const cat = env.make(); const got = [];
    cat.subscribe('desks', (v) => got.push(v)); await flush();
    chk(typeof env.h.catalog === 'function' && typeof env.h.license === 'function' && env.st.length === 1, '★ 구독하면 realtime 허브의 catalog · license 알림 · 연결 상태를 건다');
    env.data.desks[1].locked = false; env.h.license({ kind: 'license' }); await flush();
    chk(env.calls.length === 2 && got.length === 2 && got[1].d2.locked === false, '★ 내 라이선스가 바뀌었다는 알림(license) → 다시 받는다 — 서버가 정하는 locked 가 바뀌었다');
    env.data.desks[1].locked = true; env.data.desks[1].name = '바뀜'; env.calls.length = 1; got.length = 1;
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
    const code = strip(SRC).replace(/'[^'\n]*firebasestorage[^'\n]*'/g, "''");   // Storage 호스트 · 버킷 이름 글자는 Firebase SDK 가 아니다
    chk(!/setTimeout|setInterval/.test(code) && !/firebase|indexedDB|onValue/i.test(code) && !/^\s*import\s/m.test(code), '★ 타이머로 두드리지 않고 · Firebase · IndexedDB 를 모르고 · import 가 없다(통로는 deps)');
    chk(/'E-CHAR-26': \{/.test(ERR), '  ↳ E-CHAR-26 이 error-codes.js 표에 있다');
  }

  say('── 4-B. 로그인이 끝나면 비운다');
  {
    const env = mkEnv(); const cat = env.make(); const a = [], b = [];
    const u1 = cat.subscribe('parts', (v) => a.push(v)), u2 = cat.subscribe('desks', (v) => b.push(v)); await flush();
    chk(!!cat.current() && env.calls.length === 1, '로그인 중에는 받은 한 벌을 들고 있다');
    u1();
    chk(!!cat.current() && env.offs === 0, '★ 구독자가 하나라도 남아 있으면 비우지 않는다');
    u2();
    chk(cat.current() === null && env.offs === 3 && !env.h.catalog && !env.h.license && env.st.length === 0, '★ 마지막 구독자가 빠지면(세션이 끝남) 받은 값 · catalog · license · 연결 상태 구독을 모두 비운다');
    const c = []; env.data.desks[1].locked = false;   // 다음 사람 — 서버가 다르게 정해 준다
    cat.subscribe('desks', (v) => c.push(v)); await flush();
    chk(env.calls.length === 2 && c.length === 1 && c[0].d2.locked === false, '★ 다음 로그인은 새로 받는다 — 앞 사람의 locked 를 받지 않는다');
    /* 앞 로그인의 늦은 답 */
    const e2 = mkEnv(); const k2 = e2.make(); let rel = null; const got2 = [];
    e2.api.get = async (p, op) => { e2.calls.push({ p, op }); await new Promise((r) => { rel = r; }); return JSON.parse(JSON.stringify(e2.data)); };
    const un = k2.subscribe('parts', (v) => got2.push(v)); await flush(); un();
    rel(); await flush();
    chk(got2.length === 0 && k2.current() === null && e2.notes.length === 0, '★ 로그인이 끝난 뒤 늦게 온 답은 버린다 — 누구에게도 넘기지 않고 알림 · 목록도 남기지 않는다');
    const e3 = mkEnv(); const k3 = e3.make(); let rel3 = []; const got3 = [];
    e3.api.get = async (p, op) => { e3.calls.push({ p, op }); await new Promise((r) => rel3.push(r)); return JSON.parse(JSON.stringify(e3.data)); };
    const un3 = k3.subscribe('parts', () => {}); await flush(); un3();
    k3.subscribe('parts', (v) => got3.push(v)); await flush();
    rel3[0](); await flush();
    chk(got3.length === 0, '  ↳ 앞 로그인의 늦은 답이 다음 로그인 구독자에게 새지 않는다');
    rel3[1](); await flush();
    chk(got3.length === 1 && e3.calls.length === 2, '  ↳ 다음 로그인 자신의 요청 답은 받는다');
  }

  say('── 4-C. GLB 받기');
  {
    const env = mkEnv(); let asked = null;
    const bytes = new Uint8Array([71, 76, 66, 0, 255]);
    const ok = env.make === undefined ? null : M.createCatalogApi({ api: env.api, rt: env.rt, notifyError: () => {}, storageBucket: () => PROD_B, fetch: async (u, o) => { asked = [u, o]; return { ok: true, arrayBuffer: async () => bytes.buffer }; } });
    const b64 = await ok.fetchGlb('https://x/a.glb');
    chk(b64 === Buffer.from(bytes).toString('base64') && asked[0] === 'https://x/a.glb' && asked[1].cache === 'no-store', '★ 주소를 웹 캐시 없이 받아 base64 로 돌려준다');
    const bad = M.createCatalogApi({ api: env.api, rt: env.rt, notifyError: () => {}, storageBucket: () => PROD_B, fetch: async () => ({ ok: false, status: 404 }) });
    const e1 = await bad.fetchGlb('u').then(() => null, (e) => e), e2 = await bad.fetchGlb('').then(() => null, (e) => e);
    chk(e1 && /404/.test(e1.message) && e2 && /empty url/.test(e2.message), '  ↳ 못 받으면 · 주소가 비면 던진다(부르는 쪽 catalog-glb 가 실패 이유를 남긴다)');
  }

  say('── 5. 배선');
  {
    const fi = strip(FI), app = strip(APP);
    chk(!/createCatalogApi|subscribeCatalog|fetchCatalogGlb|catalogCurrent|reloadCatalog|_catalogApi|catalog-api/.test(fi), '★ firebase-init.js 에 카탈로그 읽기 · 구독 · GLB 받기가 없다 — Firebase 를 거치지 않는다');
    chk(/const catalogApiMod = TwCatalogApi\.createCatalogApi\(\{\s*api: TwApi\.authed,\s*rt: TwRtHub\.store,\s*notifyError: \(\.\.\.a\)=>TwErrorCodes\.notify\(\.\.\.a\),\s*fetch: \(\.\.\.a\)=>window\.fetch\(\.\.\.a\),\s*storageBucket: \(\)=>firebaseAPI\.storageBucket\(\),\s*\}\);/.test(app),
      '  ↳ app.js 가 로그인 통로(TwApi.authed) · realtime 허브 · 오류 번호 · 파일 받기 · 이 앱의 Storage 버킷으로 만든다');
    chk(/catalog: \(code, me, session\)=>catalogSyncMod\.start\(session\),/.test(app) && /catalog: \{ current: \(\)=>catalogApiMod\.current\(\), load: \(\)=>catalogApiMod\.load\(\) \},/.test(app), '  ↳ 로그인 뒤 app-boot 차례(catalog)가 구독을 세션에 맡긴다 · 관리자 쓰기는 같은 한 벌의 version 을 읽는다');
    const st = (BOOT.match(/const STEPS = \[([\s\S]*?)\];/) || [])[1] || '';
    chk(/'userLocal'[\s\S]*'catalog'/.test(st) && st.indexOf("'catalog'") > st.indexOf("'userLocal'"), '  ↳ 차례 표에서 catalog 는 저장 목록이 읽힌 뒤(userLocal 다음)');
    const iA = HTML.indexOf('<script src="parts/character/catalog-api.js">'), iApp = HTML.indexOf('<script src="parts/app.js">');
    chk(iA > 0 && iA < iApp && !/catalog-source\.js/.test(HTML), '  ↳ html 이 catalog-api.js 를 일반 스크립트로 app.js 앞에 싣는다 · catalog-source.js 는 없다');
    chk(!/catalogSrc|TwCatalogSource|catalogSourceMod/.test(app) && !exists('catalog-source.js'), '  ↳ 옛 provider 자리(catalog-source.js · catalogSrc* · «있으면 부르기» 가드)가 없다');
    chk(!/\/v2\/catalog\/['"`]?\s*\+\s*kind|v2\/catalog\/(?:parts|gachaParts|items|desks)/.test(fi + strip(SRC)), '★ 옛 endpoint GET /v2/catalog/{종류}?v= 가 코드에 없다');
    chk(!/ref\(db,\s*['"`]catalogMeta/.test(fi) && !/onValue\([^)]*catalogMeta/.test(fi) && !/ref\(db,\s*['"`]catalog\/(?:parts|gachaParts|items|desks)['"`]\)[^;]{0,40}onValue/.test(fi), '★ Firebase catalogMeta 를 읽는 구독이 없다(쓰기쪽 올림은 옛 앱 호환이라 남는다)');
    chk(!exists('catalog-cache.js') && !/catalog-cache\.js/.test(fi), '  ↳ 옛 catalog-cache.js(버전 확인 · IndexedDB 캐시 · Firebase 로 물러나기)가 없다');
    chk(!/createApiCatalogFetch|firebaseGet/.test(fi), '  ↳ «API 실패면 Firebase get» 이 없다');
    chk(/locked: d\.locked === true/.test(strip(SRC)) && !/locked:\s*licenseOnlyOf|locked:[^,}]*access/.test(strip(SRC)), '★ 막기 칸(locked)은 서버 값 그대로 — 진열 access 로 만들지 않는다(access.kind 는 분류 칸 licenseOnly 를 채울 때만 쓴다)');
  }

  say('── 6. mutation test');
  {
    const run = async (Mod, tweak) => {   // 핵심 동작 묶음 — 하나라도 틀리면 false
      const env = mkEnv(); const cat = env.make(Mod); const got = []; let okAll = true;
      const ok = (c) => { if(!c) okAll = false; };
      cat.subscribe('parts', (v) => got.push(v)); cat.subscribe('desks', (v) => got.push(v)); await flush();
      ok(env.calls.length === 1 && env.calls[0].p === '/v2/catalog' && env.calls[0].op.auth === true && got.length === 2);
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
      ["api.get(CATALOG_PATH, { auth: true,", "api.get(CATALOG_PATH + '/parts', { auth: true,", '옛 endpoint /v2/catalog/{종류} 를 부름'],
      ["api.get(CATALOG_PATH, { auth: true,", "api.get(CATALOG_PATH, {", '로그인 없이 받음(locked 가 사람마다 달라지지 않음)'],
      ["      if(text === last[kind]) continue;", "", '바뀌지 않은 종류도 다시 넘김'],
      ["try{ onData(clone(cur[kind])); }", "try{ onData(cur[kind]); }", '값을 복제하지 않고 같은 객체를 넘김'],
      ["failed = true; notifyError('E-CHAR-26', e);", "failed = true;", '실패를 번호로 안 알림'],
      ["rt.on('catalog', () => { load(); }),", "", 'catalog 알림을 안 들음'],
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
    chk(!missed.length, 'mutation test ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — 못 잡음: ' + missed.join(' · ') : ''));
    /* 비우기 · locked mutation test — 4-B 와 2 절의 판정이 빨강이 되는지 */
    const dropless = SRC.replace("    cur = null; raw = null; running = null; again = false; failed = false;\n", "");
    const de = mkEnv(), dk = load(dropless).createCatalogApi({ api: de.api, rt: de.rt, notifyError: () => {}, warn: () => {}, storageBucket: () => PROD_B });
    const du = dk.subscribe('parts', () => {}); await flush(); du();
    chk(dropless !== SRC && dk.current() !== null, '  mutation test: 로그인이 끝나도 값을 안 비우면 4-B 의 «비운다» 판정이 빨강');
    /* Storage URL 검사 mutation test — 검사 한 줄을 빼면 1-B 의 틀린 URL 이 새어 나와야 한다 */
    const SU = (h, host, bucket, proto) => (proto || 'https') + '://' + (host || 'firebasestorage.googleapis.com') + '/v0/b/' + (bucket || PROD_B) + '/o/assets%2F' + h + '.glb?alt=media&token=t';
    const leaks = (Mod, url) => { const d = mkData(); d.files = { [H('a')]: url }; return Mod.unfoldCatalog(d, assetUrl, { bucket: PROD_B }).parts.hat1.glbUrl === url; };
    const URL_BREAKS = [
      ["u.hostname !== STORAGE_HOST || ", "", SU(H('a'), 'evil.example.com'), '호스트를 안 봄'],
      ["u.protocol !== 'https:' || ", "", SU(H('a'), null, null, 'http'), 'https 를 안 봄'],
      ["m[1] !== bucket || ", "", SU(H('a'), null, DEV_B), '버킷을 안 봄(다른 판의 버킷)'],
      [" || m[2] !== hash) return null;", ") return null;", SU(H('b')), '다른 해시의 파일을 받음'],
    ];
    const urlMissed = [];
    for(const [from, to, url, what] of URL_BREAKS){
      if(SRC.indexOf(from) < 0){ urlMissed.push('글 못 찾음: ' + what); continue; }
      const Mut = load(SRC.split(from).join(to));
      if(leaks(M, url) || !leaks(Mut, url)) urlMissed.push(what);
    }
    chk(!urlMissed.length, '  mutation test: Storage URL 검사 ' + URL_BREAKS.length + '가지(호스트 · https · 버킷 · 해시)를 빼면 틀린 URL 이 샌다' + (urlMissed.length ? ' — 못 잡음: ' + urlMissed.join(' · ') : ''));
    const noFiles = load(SRC.replace("return url || assetUrl(hash, ext);", "return assetUrl(hash, ext);"));
    const df = mkData(); df.files = { [H('a')]: SU(H('a')) };
    chk(noFiles.unfoldCatalog(df, assetUrl, { bucket: PROD_B }).parts.hat1.glbUrl !== SU(H('a')), '  mutation test: files 를 안 쓰면 «맞는 URL 을 쓴다» 판정이 빨강');
    const warnMany = load(SRC.replace("if(badUrlWarned) return; ", ""));
    const ws = []; let wd = mkData(); wd.files = { [H('a')]: 'http://x' };
    const wc = warnMany.createCatalogApi({ api: { baseUrl: () => BASE, get: async () => JSON.parse(JSON.stringify(wd)) }, rt: { on: () => () => {}, onState: () => () => {} }, notifyError: () => {}, warn: (...a) => ws.push(a), storageBucket: () => PROD_B });
    wc.subscribe('parts', () => {}); await flush(); wd = mkData(); wd.files = { [H('a')]: 'http://y' }; await wc.load(); await flush();
    chk(ws.length === 2, '  mutation test: 경고를 한 번으로 막지 않으면 «앱 실행마다 한 번» 판정이 빨강');
    const own = SRC.replace("locked: d.locked === true,", "locked: licenseOnlyOf(d.listing),");
    chk(own !== SRC && load(own).unfoldCatalog(mkData(), assetUrl).desks.d3.locked === true, '  mutation test: 진열 access 로 locked 를 만들면 «서버 locked 그대로» 판정이 빨강');
  }

  say('\n' + pass + ' · ' + fail);
  process.exit(fail ? 1 : 0);
})().catch((e) => { fail++; say('  ✗ 예외: ' + (e && e.stack || e)); say('\n' + pass + ' · ' + fail); process.exit(1); });
