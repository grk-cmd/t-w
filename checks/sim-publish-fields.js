/* sim-publish-fields.js — 🗂️ 카탈로그 배포에서 필드가 조용히 증발하지 않는지 검증
   실행:  node sim-publish-fields.js   (app.js · smoke.js 와 같은 폴더에서)

   ★ 왜 이 검사가 있는가 — **같은 사고가 다섯 번 났다.**
     `firebaseAPI.publishPart` 는 set() = **노드 전체 교체**다. 페이로드에 안 실은 필드는
     서버에서 그냥 사라진다. 그런데 **로컬 rec 는 안 사라진다.**
       → 관리자 화면에서는 멀쩡해 보이고, **다른 유저에게만** 값이 안 간다.
       → 콘솔에도 아무것도 안 남는다. 그래서 매번 제보가 쌓인 뒤에야 발견됐다.

     실제로 증발했던 것들:
       stackable  파츠가 '일반'으로 둔갑해 같은 칸의 기존 모자를 밀어냄
       animMode   ▶ 재생 방식이 되돌아감
       noColor    가챠 중복 수 판정이 다시 4개로
       defaultXf  관리자가 정한 기본 위치/크기/회전이 다른 유저에게 안 감
       order      파츠를 한 번 수정하면 목록 맨 뒤로 밀림
       gacha·season  썸네일 일괄 재생성 한 번에 가챠 파츠가 꾸미기 창에 그냥 뜸

   ★ 무엇을 보는가 (두 층)
     §1 소스 대조 — "파츠 rec 에 쓰는 필드" ⊆ "PART_PUBLISH_FIELDS".
        새 필드를 rec 에 추가하고 목록에 안 넣으면 **여기서 걸린다.** 이 검사가 있었다면
        위의 다섯 건이 전부 코드 리뷰 전에 잡혔다.
     §2 런타임 — buildPartPublishData 가 실제로 그 필드들을 싣는지, 그리고 배포→구독
        왕복(mergeCatalogIntoSavedParts) 뒤에도 값이 살아 있는지.

   ⚠ 이 검사는 **보내는 쪽만** 본다. Firebase 규칙(.validate)이 그 필드를 받아주는지는
     여기서 알 수 없다 — 새 필드를 넣을 때 firebase-database-rules.json 도 같이 볼 것.
   ⚠ smoke.js 의 스텁을 빌려 쓴다 — 같은 폴더에 있어야 한다. */
'use strict';
const fs = require('fs'), vm = require('vm');

const SRC = fs.readFileSync('app.js', 'utf8');
const say = console.log;
let fail = 0;
const chk = (c, m) => { say((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };

say('=== 🗂️ 카탈로그 배포 필드 증발 검사 ===');
say('');

/* ── §1. 소스 대조 ───────────────────────────────────────────────────
   파츠 등록/수정 핸들러가 rec 에 쓰는 필드 이름을 소스에서 긁어, 배포 목록과 대조한다.
   ⚠ 정규식으로 소스를 읽는다 — 코드 모양이 크게 바뀌면 아래 앵커부터 고쳐야 한다.
     그래서 "못 찾음"을 통과로 처리하지 않고 **실패**로 만든다(조용히 무력화되지 않게). */
say('· §1 소스 대조 — rec 에 쓰는 필드가 전부 PART_PUBLISH_FIELDS 에 있는가');

// (ㄱ) 배포 목록 자체를 읽어온다
const listM = SRC.match(/const\s+PART_PUBLISH_FIELDS\s*=\s*\[([\s\S]*?)\]\s*;/);
chk(!!listM, 'PART_PUBLISH_FIELDS 목록을 찾았다');
const PUBLISH_FIELDS = listM
  ? [...listM[1].matchAll(/'([A-Za-z_$][\w$]*)'/g)].map(m => m[1])
  : [];
chk(PUBLISH_FIELDS.length >= 10, '목록이 비어 있지 않다 (' + PUBLISH_FIELDS.length + '개)');

// (ㄴ) 신규 등록에서 만드는 rec 객체 리터럴
const newRecM = SRC.match(/const\s+rec\s*=\s*\{\s*id\s*,\s*cat\s*:\s*_partRegCat([\s\S]{0,400}?)\}\s*;/);
chk(!!newRecM, '신규 등록의 rec 리터럴을 찾았다');
const newRecFields = newRecM
  ? [...('cat,' + newRecM[1]).matchAll(/(?:^|[,{\s])([A-Za-z_$][\w$]*)\s*(?:[,:}])/g)].map(m => m[1])
  : [];

// (ㄷ) 수정 경로의 rec.X = ... 대입 + if 로 붙는 것들
const editBlockM = SRC.match(/if\s*\(\s*rec\s*\)\s*\{\s*rec\.name\s*=[\s\S]{0,600}?defaultXf\s*\)\s*rec\.defaultXf\s*=\s*defaultXf\s*;/);
chk(!!editBlockM, '수정 경로의 rec 대입 블록을 찾았다');
const editRecFields = editBlockM
  ? [...editBlockM[0].matchAll(/\brec\.([A-Za-z_$][\w$]*)\s*=/g)].map(m => m[1])
  : [];

/* rec 에는 있지만 카탈로그로 보낼 필요가 **없는** 필드. 여기 넣는 것은 "안 보내도 되는 이유"를
   한 줄로 댈 수 있을 때만이다 — 그 이유를 못 대면 목록에 넣는 게 맞다. */
const NOT_PUBLISHED = {
  id: '노드 키 자체다(publishPart 의 첫 인자)',
  fromCatalog: '수신 쪽이 붙이는 표식이다 — 서버에 있을 값이 아니다',
  thumbUrl: 'Storage 업로드 결과라 서버가 채운다',
};

const recFields = [...new Set([...newRecFields, ...editRecFields])]
  .filter(f => !(f in NOT_PUBLISHED));
const missing = recFields.filter(f => !PUBLISH_FIELDS.includes(f));

chk(recFields.length >= 10, 'rec 필드를 읽어냈다 (' + recFields.length + '개: ' + recFields.join(', ') + ')');
chk(missing.length === 0,
    '★ rec 에 쓰는 필드가 전부 배포 목록에 있다' +
    (missing.length ? ' — 빠진 것: ' + missing.join(', ') : ''));
if (missing.length) {
  say('    ↳ 이 필드는 set() 에서 서버에서만 사라진다. 로컬은 멀쩡해서 관리자는 못 느낀다.');
  say('    ↳ PART_PUBLISH_FIELDS 에 이름을 넣고 buildPartPublishData 에서 실을 것.');
}

// (ㄹ) 배포하는 자리가 전부 빌더를 쓰는가 — 손으로 나열한 페이로드가 남아 있으면 안 된다
//   ⚠ `unpublishPart(` 도 문자열로는 걸리므로 앞 글자를 보고 걸러낸다.
//   페이로드는 두 모양 다 인정한다: 인자에 바로 부르거나(빌더가 그 자리에 보이거나),
//   변수로 받아 넘기거나(그 변수가 빌더로 만들어졌으면 OK).
const publishCalls = [...SRC.matchAll(/(.)publishPart\(([\s\S]{0,200})/g)]
  .filter(m => !/[A-Za-z]/.test(m[1]));
chk(publishCalls.length >= 2, 'publishPart 호출을 찾았다 (' + publishCalls.length + '곳)');
const usesBuilder = (tail) => {
  if (/buildPartPublishData/.test(tail)) return true;
  const argM = tail.match(/^[^,]*,\s*([A-Za-z_$][\w$]*)\s*\)/);
  if (!argM) return false;
  return new RegExp('(?:const|let|var)\\s+' + argM[1] + '\\s*=\\s*buildPartPublishData').test(SRC);
};
const handRolled = publishCalls.filter(m => !usesBuilder(m[2]));
chk(handRolled.length === 0,
    '★ 모든 배포가 buildPartPublishData 를 쓴다 (손으로 나열한 페이로드가 없다)' +
    (handRolled.length ? ' — ' + handRolled.length + '곳이 직접 만든다' : ''));
say('');

/* ── §2. 런타임 ──────────────────────────────────────────────────── */
say('· §2 런타임 — 빌더가 실제로 값을 싣고, 왕복해도 살아남는가');

let smokeSrc = fs.readFileSync('smoke.js', 'utf8');
smokeSrc = smokeSrc.slice(0, smokeSrc.indexOf('/* ── 실행'))
  .split('\n').filter(l => !/require\(|const FILE =|if \(!FILE\)|process\.exit/.test(l)).join('\n');
vm.runInThisContext(smokeSrc, { filename: 'smoke-stubs.js' });

const realST = require('timers').setTimeout;
globalThis.setTimeout = (fn, ms) => realST(fn, ms || 0);
globalThis.setInterval = () => 0;
globalThis.clearTimeout = require('timers').clearTimeout;
globalThis.HTMLCanvasElement = class {};
globalThis.Image = class {
  constructor(){ this.naturalWidth = 512; this.naturalHeight = 512; }
  set src(v){ this._src = v; realST(() => { if (this.onload) this.onload(); }, 0); }
  get src(){ return this._src; }
};
globalThis.HTMLImageElement = globalThis.Image;

const probe = `
;globalThis.__P = { buildPartPublishData, PART_PUBLISH_FIELDS,
                    mergeCatalogIntoSavedParts, getSavedParts: () => savedParts };`;

const _log = console.log, _warn = console.warn;
console.log = () => {}; console.warn = () => {};
try { vm.runInThisContext(SRC + probe, { filename: 'app.js' }); }
catch (e) { console.log = _log; say('  ✗ app.js 평가 실패: ' + (e && e.stack || e)); process.exit(1); }
console.log = _log; console.warn = _warn;

const P = globalThis.__P;

/* 모든 필드가 채워진 파츠 — 여기서 하나라도 빠지면 다른 유저가 그 값을 잃는다 */
const FULL = {
  id: 'p_full', cat: 'hat', name: '고양이귀', icon: '🐱', glb: 'data:glb;base64,AAA',
  order: 7, glow: true, multi: true, charType: 'default', hides: ['top'],
  standalone: true, stackable: true, animMode: 'active',
  gacha: true, season: 'winter', noColor: true,
  defaultXf: { scale: 1.4, pos: [0, 0.12, -0.03], rot: [0, 0.5, 0] },
  thumbnail: 'data:image/png;base64,THUMB',
  fromCatalog: true, thumbUrl: 'https://storage.test/old.png',
};

const built = P.buildPartPublishData(FULL);

chk(built.gacha === true, '★ gacha 가 실린다 (빠지면 가챠 파츠가 꾸미기 창에 그냥 뜬다)');
chk(built.season === 'winter', '★ season 이 실린다');
chk(!!built.defaultXf && built.defaultXf.scale === 1.4, '★ defaultXf 가 실린다 (제보: 기본값이 남에게 안 감)');
chk(built.order === 7, '★ order 가 실린다 (빠지면 수정 후 목록 맨 뒤로 밀린다)');
chk(built.stackable === true && built.animMode === 'active' && built.noColor === true,
    '예전에 증발했던 셋(stackable·animMode·noColor)도 그대로 실린다');
chk(built.thumbnail === FULL.thumbnail, 'thumbnail 이 실린다');
chk(built.fromCatalog === undefined, 'fromCatalog(수신 쪽 표식)는 안 실린다');
chk(built.thumbUrl === undefined, 'thumbUrl(서버가 채우는 값)은 안 실린다');
chk(built.id === undefined, 'id 는 안 실린다(노드 키다)');

/* undefined 를 실으면 Firebase 가 **쓰기 전체를 거부**한다 — 한 필드 때문에 배포가 통째로 실패한다 */
chk(Object.values(built).every(v => v !== undefined), '★ undefined 인 값이 하나도 없다 (Firebase 가 거부한다)');

/* 값이 없는 파츠 — 없는 것은 실리지 않아야 한다(빈 값으로라도 실으면 옛 값을 덮는다) */
const BARE = P.buildPartPublishData({ id: 'p_bare', cat: 'glasses', name: '안경', glb: 'g' });
chk(BARE.defaultXf === undefined && BARE.noColor === undefined && BARE.order === undefined,
    '값이 없는 선택 필드는 아예 빠진다');
chk(BARE.gacha === false && BARE.season === '' && BARE.animMode === '',
    '항상 싣는 필드는 기본값으로라도 채워진다 (빠지면 서버에서 사라진다)');

/* 배포 → 구독 왕복. 관리자가 보낸 것이 다른 유저의 savedParts 로 그대로 돌아오는가 */
P.mergeCatalogIntoSavedParts({ p_full: built });
const back = P.getSavedParts().find(p => p.id === 'p_full');
chk(!!back, '왕복 후 카탈로그에서 파츠가 돌아온다');
chk(back && back.defaultXf && back.defaultXf.scale === 1.4,
    '★ 다른 유저 쪽 rec 에 defaultXf 가 살아 있다 (= 착용할 때 그 위치에서 시작한다)');
chk(back && back.gacha === true && back.season === 'winter', '가챠 여부·시즌도 살아 있다');
chk(back && back.order === 7, 'order 도 살아 있다');

/* 반대 증명 — 한 필드를 빼고 배포하면 그 유저에게서 정말 사라진다.
   이게 이 검사가 존재하는 이유다. 로컬만 보면 절대 안 보인다. */
const dropped = Object.assign({}, built); delete dropped.defaultXf;
P.mergeCatalogIntoSavedParts({ p_full: dropped });
const after = P.getSavedParts().find(p => p.id === 'p_full');
chk(after && after.defaultXf === undefined,
    '★ 한 번이라도 빼고 배포하면 그 값은 **정말 사라진다** (set()=전체 교체의 증거)');

say('');
if (fail) {
  say('✗ ' + fail + '개 실패');
  say('  필드를 하나 늘릴 때 할 일은 셋이다: rec 에 넣기 · PART_PUBLISH_FIELDS 에 이름 넣기 ·');
  say('  firebase-database-rules.json 이 그 필드를 받는지 보기.');
  process.exit(1);
}
say('전부 통과 ✅ — 배포 페이로드가 rec 의 필드를 하나도 안 흘린다');
process.exit(0);
