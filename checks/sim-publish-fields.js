/* sim-publish-fields.js — 🗂️ 파츠를 서버 카탈로그에 쓸 때 칸이 조용히 증발하지 않는지 (D11-4)
   실행:  node sim-publish-fields.js   (admin/catalog-admin-api.js · character/catalog-api.js · admin/admin-part-register.js 가 있는 폴더에서)

   ★ 왜 이 검사가 있는가 — 파츠 쓰기(PUT /v2/admin/catalog/parts/{id})는 물건 한 건을 통째로 바꾼다. 본문에 안 실은 칸은 서버에서 사라지는데
     로컬 rec 는 안 사라져서, 관리자 화면에서는 멀쩡하고 다른 사용자에게만 값이 안 가는 사고가 다섯 번 났다
     (stackable · animMode · noColor · defaultXf · gacha·season). 옛 Firebase 판에서는 PART_PUBLISH_FIELDS 가 이 일을 했다.
   ★ 무엇을 보는가
     §1 본문 칸 — partBody 가 만드는 칸이 서버 CatalogRequest 의 PART_FIELDS 안이다(모르는 칸을 보내면 서버가 400) · 값이 undefined 인 칸이 없다
     §2 소스 대조 — 등록 창이 savePart 에 넘기는 칸 ⊆ partBody 가 읽는 칸, 그리고 partBody 가 읽는 칸 ⊆ 등록 창이 넘기는 칸(+ 서버에서 받은 되돌림 칸) —
        새 칸을 한쪽에만 넣으면 여기서 걸린다
     §3 왕복 — 본문 → 서버가 돌려주는 줄 → 앱 rec(unfoldCatalog) 로 값이 살아 있다 · 한 칸을 빼고 쓰면 정말 사라진다(이 검사가 있는 까닭)
   ⚠ 이 검사는 보내는 쪽만 본다. 서버가 그 칸을 받아주는지는 서버 정본(CatalogRequest.PART_FIELDS)과 맞춘 목록으로만 본다. */
'use strict';
const fs = require('fs');
const read = (names) => names.map((f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } }).find(Boolean);
const CAA = read(['catalog-admin-api.js', 'parts/admin/catalog-admin-api.js', 'app/parts/admin/catalog-admin-api.js']);
const CAT = read(['catalog-api.js', 'parts/character/catalog-api.js', 'app/parts/character/catalog-api.js']);
const REG = read(['admin-part-register.js', 'parts/admin/admin-part-register.js', 'app/parts/admin/admin-part-register.js']);
if(!CAA || !CAT || !REG){ console.log('  ? 원본 못 찾음 — catalog-admin-api.js · catalog-api.js · admin-part-register.js'); process.exit(2); }
const say = console.log;
let fail = 0;
const chk = (c, m) => { say((c ? '  ✓ ' : '  ✗ ') + m); if(!c) fail++; };

/* 서버 정본 — CatalogRequest.kt 의 PART_FIELDS(origin/dev) */
const SERVER_PART_FIELDS = ['version', 'name', 'icon', 'category', 'model', 'thumb', 'glow', 'multi', 'standalone', 'stackable', 'rideTop', 'noColor', 'animMode', 'charType', 'defaultTransform', 'hides', 'listing'];

const load = (src, extra) => { const m = { exports: {} }; new Function('window', 'module', src)({}, m); return m.exports; };
const caa = load(CAA);
const names = [...CAT.matchAll(/^export (?:const|function|async function) (\w+)/gm)].map((m) => m[1]);
const cat = new Function(CAT.replace(/^export (const|function|async function) /gm, '$1 ') + '\nreturn {' + names.join(',') + '};')();

const H = (c) => c.repeat(64);
/* 모든 칸이 채워진 파츠 — 여기서 하나라도 빠지면 다른 사용자가 그 값을 잃는다 */
const FULL = {
  name: '고양이귀', icon: '🐱', category: 'hat', modelHash: H('a'), thumbHash: H('b'),
  glow: true, multi: true, standalone: true, stackable: true, rideTop: true, noColor: true, animMode: 'active', charType: 'commission',
  defaultXf: { scale: 1.4, pos: [0, 0.12, -0.03], rot: [0, 0.5, 0], color: {} }, hides: ['top', 'mask'], gacha: true, season: 'winter',
  listingAccess: { kind: 'entitlement', key: 'premium', display: 'hide' },
};

say('=== 🗂️ 서버 카탈로그 쓰기 칸 검사 ===');
say('· §1 본문 칸');
const body = caa.partBody(FULL);
chk(caa.PART_FIELDS.join() === SERVER_PART_FIELDS.join(), '앱의 PART_FIELDS 목록이 서버 정본과 같다');
chk(Object.keys(body).every((k) => SERVER_PART_FIELDS.includes(k)), '★ 본문 칸이 전부 서버가 받는 칸이다(모르는 칸 0 — 보내면 400)' + (Object.keys(body).filter((k) => !SERVER_PART_FIELDS.includes(k)).length ? ' — ' + Object.keys(body).filter((k) => !SERVER_PART_FIELDS.includes(k)).join(', ') : ''));
chk(Object.values(body).every((v) => v !== undefined), '★ undefined 인 칸이 없다');
chk(body.listing.state === 'ACTIVE' && body.listing.acquisition.kind === 'GACHA' && body.listing.acquisition.season === 'WINTER' && body.listing.access.display === 'hide' && body.listing.access.kind === 'entitlement',
  '진열 — 곧바로 ACTIVE · 가챠 시즌은 서버 이름(WINTER · 상시는 ALWAYS) · 서버 진열 권한은 앱이 모르는 표시(hide)까지 그대로');
chk(caa.partBody(Object.assign({}, FULL, { season: '' })).listing.acquisition.season === 'ALWAYS' && caa.partBody(Object.assign({}, FULL, { gacha: false })).listing.acquisition.kind === 'GIVEN', '  ↳ 상시 가챠 = ALWAYS · 가챠가 아니면 GIVEN');
const bare = caa.partBody({ name: 'n', category: 'hat', modelHash: H('c'), hides: [] });
chk(!('noColor' in bare) && !('thumb' in bare) && !('defaultTransform' in bare) && bare.listing.access.kind === 'everyone' && bare.animMode === 'always',
  '값이 없는 선택 칸(noColor · thumb · defaultTransform)은 아예 빠진다 · 권한 없으면 모두 · 재생은 always');

say('· §2 소스 대조 — 등록 창이 넘기는 칸 ↔ 본문이 읽는 칸');
const bodySrc = (CAA.match(/function partBody\(f\)\{[\s\S]*?\n\}/) || [''])[0];
const fieldsSrc = (CAA.match(/function partFieldsOf\(rec, over\)\{[\s\S]*?\n\}/) || [''])[0];
const reads = new Set([...bodySrc.matchAll(/\bf\.(\w+)/g)].map((m) => m[1]).concat([...(CAA.match(/function listingOf\(f\)\{[\s\S]*?\n\}/) || [''])[0].matchAll(/\bf\.(\w+)/g)].map((m) => m[1])));
chk(bodySrc && reads.size >= 15, 'partBody 가 읽는 칸을 읽어냈다 (' + reads.size + '개: ' + [...reads].join(', ') + ')');
const callM = REG.match(/catalogAdmin\.savePart\(id, \{([\s\S]*?)\}, \{ create: !editing \}\)/);
chk(!!callM, '등록 창의 savePart 호출을 찾았다');
const passed = callM ? [...callM[1].matchAll(/(?:^|[\s,])(\w+)\s*[:,]/g)].map((m) => m[1]) : [];
const FILE_FIELDS = ['glb', 'thumbPng'];
const READ_ONLY_BY_SERVER = ['licenseOnly'];   // 책상 · 소품만 쓰는 칸(파츠는 권한을 서버 줄 그대로 되돌린다)
const extra = passed.filter((k) => !reads.has(k) && !FILE_FIELDS.includes(k));
const unsent = [...reads].filter((k) => !passed.includes(k) && !READ_ONLY_BY_SERVER.includes(k));
chk(extra.length === 0, '★ 등록 창이 넘기는 칸을 본문이 전부 읽는다(넘겼는데 버려지는 칸 0)' + (extra.length ? ' — ' + extra.join(', ') : ''));
chk(unsent.length === 0, '★ 본문이 읽는 칸을 등록 창이 전부 넘긴다(빠지면 서버에서 그 칸이 기본값으로 돌아간다)' + (unsent.length ? ' — ' + unsent.join(', ') : ''));
const rf = new Set([...fieldsSrc.matchAll(/(\w+): rec\.\w+/g)].map((m) => m[1]));
chk([...reads].filter((k) => k !== 'licenseOnly' && k !== 'modelHash' || true).every((k) => k === 'licenseOnly' || rf.has(k)), '서버 줄(rec)에서 되돌려 쓰는 partFieldsOf 도 본문이 읽는 칸을 전부 싣는다(썸네일 다시 굽기 · 고치기)');

say('· §3 왕복 — 본문 → 서버 줄 → 앱 rec');
/* 서버가 돌려주는 한 줄 모양으로 바꿔 한 벌에 넣고 unfoldCatalog 로 푼다 */
const asServer = (b) => ({
  partId: 'p1', name: b.name, icon: b.icon, category: b.category, model: b.model, thumb: b.thumb, glow: b.glow, multi: b.multi, standalone: b.standalone,
  stackable: b.stackable, stackableWorn: b.stackable, rideTop: b.rideTop, noColor: b.noColor === true, animMode: b.animMode, charType: b.charType,
  defaultTransform: b.defaultTransform, hides: b.hides, listing: b.listing, version: 5,
});
const fold = (b) => cat.unfoldCatalog({ categories: [], shelves: [], products: [], unlocks: [], desks: [], deskProps: [], season: 'WINTER', parts: [asServer(b)] }, (h, e) => 'https://x/' + h + '.' + e).parts.p1;
const back = fold(body);
chk(back.defaultXf && back.defaultXf.scale === 1.4 && back.defaultXf.pos[1] === 0.12, '★ 다른 사용자 쪽 rec 에 defaultXf 가 살아 있다(= 착용할 때 그 위치에서 시작한다)');
chk(back.gacha === true && back.season === 'winter' && back.stackable === true && back.animMode === 'active' && back.noColor === true && back.rideTop === true && back.charType === 'commission',
  '가챠 · 시즌(앱 이름 소문자) · stackable · animMode · noColor · rideTop · charType 이 살아 있다');
chk(back.hides.join() === 'top,mask' && back.cat === 'hat' && back.modelHash === H('a') && back.thumbHash === H('b') && back.version === 5 && back.listingAccess.display === 'hide', 'hides · 카테고리 · 파일 해시 · version · 진열 권한도 살아 있다');
const again = caa.partBody(caa.partFieldsOf(back));
chk(JSON.stringify(again) === JSON.stringify(body), '★ 서버 줄(rec)을 그대로 되돌려 써도 본문이 같다(썸네일 다시 굽기가 다른 칸을 바꾸지 않는다)');
const dropped = Object.assign({}, body); delete dropped.defaultTransform;
chk(fold(dropped).defaultXf === undefined, '★ 한 칸이라도 빼고 쓰면 그 값은 정말 사라진다(PUT = 물건 전체 교체의 증거)');

say('');
if(fail){ say('✗ ' + fail + '개 실패'); say('  칸을 하나 늘릴 때 할 일: 등록 창 savePart 에 넣기 · catalog-admin-api.js partBody · partFieldsOf 에 넣기 · catalog-api.js 가 그 칸을 풀어 주는지 보기.'); process.exit(1); }
say('전부 통과 ✅ — 서버 쓰기가 파츠 칸을 하나도 안 흘린다');
process.exit(0);
