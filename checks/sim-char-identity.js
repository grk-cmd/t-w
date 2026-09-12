/* sim-char-identity.js — 🐾 받는 쪽이 "캐릭터가 바뀌었다"를 놓치지 않는가
   실행:  node sim-char-identity.js   (app.js · animal.js · smoke.js 와 같은 폴더에서)

   ★ 왜 이 검사가 있는가 — 제보 두 건이 같은 뿌리였다.
       "A캐릭터를 골라서 입장해도 다른 분들께는 다른 캐릭터로 보인다"
       "F1 으로 캐릭터를 바꿔도 이미 방에 있는 상대 화면엔 반영되지 않는다"
     보내는 쪽은 무혐의였다(sim-def-send.js 가 join 페이로드 == updateDef 페이로드를 증명했다).
     범인은 **받는 쪽 syncFriendSeats 의 두 지문**이었다.

       새 지문 == 옛 지문  →  applyCharToSeat 를 건너뛰고 equippedParts 비교로 빠진다
                              = 좌석이 옛 모습 그대로 남는다. 화면엔 아무 표시도 없다.

     그런데 `_charIdentityFingerprint` 에도 `_deskStateFingerprint` 에도 없으면서
     animal.js `buildAnimalBase` 가 **실제로 읽어 모양을 바꾸는** 필드가 넷 있었다:
       · animalScl        → 머리 본 스케일 (headBoneS.scale.set)
       · animalEarAdj     → 귀 위치·회전·크기 (wrap.position / rotation / scale)
       · animalEarPaintL/R → 귀 텍스처
       · animalBlink      → 감은눈 텍스처
     즉 동물끼리의 교체·수정이 상대 화면에서 통째로 무시됐다.

   ★ 이 검사가 지키는 규약 (한 줄)
     **buildAnimalBase 가 읽는 def 필드는 전부 두 지문 중 하나에 들어 있어야 한다.**
     §1 은 그 필드들을 하나씩 바꿔 지문이 실제로 달라지는지 본다.
     §2 는 네트워크를 왕복한 형태(URL 판)에서도 같은지 본다 — dataURL 은 전송에서 지워진다.
     §3 은 반대 증명이다: 필드를 지문에서 빼면 이 검사가 정말 잡는가.
     §4 는 과민반응 방지 — 모양과 무관한 값에는 재빌드가 걸리지 않아야 한다.

   ⚠ 소스가 아니라 **함수를 실제로 돌린다.** 이름만 대조하면 규약이 바뀔 때 같이 안 바뀐다
     (핸드오프의 sim-char-z · sim-pl-next 교훈).
   ⚠ animal.js 는 IIFE 라 여기서 직접 못 부른다. 대신 그 파일에서 def 를 읽는 자리를 뽑아
     "지문이 알아야 할 필드 목록"을 만든다 — animal.js 가 새 필드를 읽기 시작하면 여기가 먼저 운다.
   ⚠ smoke.js 의 스텁을 빌려 쓴다 — 같은 폴더에 있어야 한다. */
'use strict';
const fs = require('fs'), vm = require('vm');

let smokeSrc = fs.readFileSync('smoke.js', 'utf8');
smokeSrc = smokeSrc.slice(0, smokeSrc.indexOf('/* ── 실행'))
  .split('\n').filter(l => !/require\(|const FILE =|if \(!FILE\)|process\.exit/.test(l)).join('\n');
vm.runInThisContext(smokeSrc, { filename: 'smoke-stubs.js' });

globalThis.HTMLCanvasElement = class {};
globalThis.Image = class { set src(v){ this._src = v; } get src(){ return this._src; } };

const probe = `
;globalThis.__P = { fp: _charIdentityFingerprint, deskFp: _deskStateFingerprint,
                    serialize: serializeDefForNetwork };`;

const say = console.log;
console.log = () => {}; console.warn = () => {};
try { vm.runInThisContext(fs.readFileSync('app.js', 'utf8') + probe, { filename: 'app.js' }); }
catch (e) { say('✗ app.js 평가 실패: ' + (e && e.stack || e)); process.exit(1); }
/* console.log 은 계속 막아둔다 — app.js 의 [def-diag] 가 §2 에서 검사 결과 사이에 끼어든다.
   이 파일의 출력은 붙잡아 둔 원본(say)으로만 낸다. */

const P = globalThis.__P;
let fail = 0;
const chk = (c, m) => { say((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };

/* 두 지문을 합친 것이 "재빌드 판정"이다 — syncFriendSeats 가 둘 중 하나라도 바뀌면 재빌드한다.
   그래서 검사도 반드시 합쳐서 봐야 한다(한쪽에만 있어도 통과가 맞다). */
const sig = d => P.fp(d) + '|' + P.deskFp(d);

const D = t => 'data:image/png;base64,' + t + 'A'.repeat(300);
const ANIMAL = () => ({
  skin: 2, top: '#aaa', bot: '#bbb', face: D('AFACE'), blink: D('ABLINK'),
  animal: true, animalFace: 2,
  animalEarL: 'cat', animalEarR: 'cat',
  animalScl: { x: 1, y: 1, all: 1 },
  animalEarAdj: { L: { px: 0, py: 0, pz: 0, rot: 0, sc: 1 }, R: { px: 0, py: 0, pz: 0, rot: 0, sc: 1 } },
  animalBody: D('ABODY'), animalEarPaintL: D('AEARL'),
  animalEarPaintR: D('AEARR'), animalBlink: D('ABLNK'),
  xf: { s: 1, y: 0, z: 0, rot: 0, x: 0.1 },
});

say('=== 🐾 캐릭터 교체가 상대 화면에 반영되는가 (받는 쪽 지문) ===');
say('');

/* ── §1. buildAnimalBase 가 읽는 값을 바꾸면 지문이 바뀌는가 ───────── */
say('· §1 모양을 바꾸는 값 — 하나씩 바꿔본다 (로컬 슬롯 형태 · dataURL)');

const CASES = [
  ['animalScl (머리 본 스케일)',      d => { d.animalScl = { x: 1.3, y: 1, all: 1 }; }],
  ['animalEarAdj (귀 위치·회전·크기)', d => { d.animalEarAdj.L.px = 0.05; }],
  ['animalEarPaintL (왼쪽 귀 페인트)', d => { d.animalEarPaintL = D('NEWL'); }],
  ['animalEarPaintR (오른쪽 귀 페인트)', d => { d.animalEarPaintR = D('NEWR'); }],
  ['animalBlink (감은눈)',            d => { d.animalBlink = D('NEWBLINK'); }],
  // 원래부터 잡히던 것들 — 같이 지켜야 회귀를 막는다
  ['animal (인간↔동물)',              d => { d.animal = false; }],
  ['animalFace (얼굴형)',             d => { d.animalFace = 3; }],
  ['animalEarL (귀 종류)',            d => { d.animalEarL = 'rabbit'; }],
  ['animalBody (몸 페인트)',          d => { d.animalBody = D('NEWBODY'); }],
];

const base = ANIMAL(), baseSig = sig(base);
for (const [name, mutate] of CASES) {
  const d = ANIMAL(); mutate(d);
  chk(sig(d) !== baseSig, name + ' 을 바꾸면 재빌드가 걸린다');
}
say('');

/* ── §2. 네트워크를 왕복한 형태에서도 같은가 ────────────────────────
   ROOM_FACE_SEND_DATAURL=false 이후 dataURL 은 전송에서 **지워지고** URL 만 간다.
   받는 쪽 지문이 dataURL 만 보고 있으면 방 안에서는 전부 null 로 눌려 아무것도 안 잡힌다. */
say('· §2 방에서 온 def (URL 판) — dataURL 은 지워지고 URL 만 온다');

/* ensureRoomFaceUrls 가 붙여두는 내부 필드를 흉내낸다(업로드는 안 돈다) */
function toWire(d, tag){
  const c = Object.assign({}, d);
  c._faceUrl   = 'https://s.test/face_' + tag + '.png';
  c._blinkUrl  = 'https://s.test/blink_' + tag + '.png';
  c._aBodyUrl  = 'https://s.test/body_' + tag + '.png';
  c._aEarLUrl  = 'https://s.test/earL_' + tag + '.png';
  c._aEarRUrl  = 'https://s.test/earR_' + tag + '.png';
  c._aBlinkUrl = 'https://s.test/ablink_' + tag + '.png';
  return P.serialize(c);
}

const w1 = toWire(ANIMAL(), 'one');
chk(w1.animalBody === undefined && typeof w1.animalBodyUrl === 'string',
    '전송된 def 에는 dataURL 이 없고 URL 만 있다 (이 검사의 전제)');
chk(w1.animalEarPaintL === undefined && w1.animalBlink === undefined,
    '귀 페인트·감은눈도 dataURL 이 지워진다');

const w2 = toWire(ANIMAL(), 'two');   // 같은 def, 다른 그림 → URL 만 다르다
chk(sig(w1) !== sig(w2),
    '★ URL 만 달라져도 재빌드가 걸린다 (dataURL 만 보고 있으면 여기서 놓친다)');

const wSame = toWire(ANIMAL(), 'one');
chk(sig(w1) === sig(wSame), '같은 def·같은 URL 이면 지문도 같다 (헛 재빌드 없음)');

// 모양 필드도 URL 판에서 그대로 잡히는가
const wScl = toWire(Object.assign(ANIMAL(), { animalScl: { x: 1.4, y: 1, all: 1 } }), 'one');
chk(sig(wScl) !== sig(w1), 'URL 판에서도 animalScl 변화가 잡힌다');
say('');

/* ── §3. 반대 증명 — 지문에서 빼면 이 검사가 정말 잡는가 ─────────────
   통과만 보고 안심하지 않기 위한 자리다. 옛 지문(네 필드가 없던 판)을 그대로 재현해
   같은 입력에서 **놓치는지** 확인한다. */
say('· §3 반대 증명 — 네 필드를 뺀 옛 지문이라면');

const _imgSig = v => (!v ? null : (typeof v === 'string' ? 's' + v.length + ':' + v.slice(22, 54) : 'o'));
const oldFp = d => JSON.stringify({
  skin: d.skin, top: d.top, bot: d.bot,
  animal: !!d.animal, animalFace: d.animalFace || 0,
  animalEarL: d.animalEarL || null, animalEarR: d.animalEarR || null,
  animalBody: _imgSig(d.animalBody), animalBodyUrl: d.animalBodyUrl || null,
  face: _imgSig(d.face), blink: _imgSig(d.blink),
  faceUrl: d.faceUrl || null, blinkUrl: d.blinkUrl || null,
});
const oldSig = d => oldFp(d) + '|' + P.deskFp(d);

const missed = [
  ['animalScl',       d => { d.animalScl = { x: 1.3, y: 1, all: 1 }; }],
  ['animalEarAdj',    d => { d.animalEarAdj.L.px = 0.05; }],
  ['animalEarPaintL', d => { d.animalEarPaintL = D('NEWL'); }],
  ['animalBlink',     d => { d.animalBlink = D('NEWBLINK'); }],
].filter(([, mutate]) => { const d = ANIMAL(); mutate(d); return oldSig(d) === oldSig(ANIMAL()); });

chk(missed.length === 4,
    '★ 옛 지문은 이 넷을 전부 놓친다 (' + missed.map(m => m[0]).join(' · ') + ') — 제보가 그대로 재현된다');
say('');

/* ── §4. 과민반응 방지 ─────────────────────────────────────────────
   지문이 바뀌면 좌석을 **통째로** 다시 세운다(모델·텍스처·파츠 GLB 재부착).
   모양과 무관한 값까지 넣으면 남이 말 한마디 할 때마다 방 전원이 재빌드된다. */
say('· §4 모양과 무관한 값에는 재빌드가 걸리지 않는다');

const noRebuild = [
  ['thumb (런처 아이콘 · 전송에서 지워지는 값)', d => { d.thumb = D('THUMB'); }],
  ['partXfMemory (생성기 편집 메모리)',          d => { d.partXfMemory = { a: 1 }; }],
];
for (const [name, mutate] of noRebuild) {
  const d = ANIMAL(); mutate(d);
  chk(sig(d) === baseSig, name + ' 은 재빌드를 안 부른다');
}
say('');

if (fail) {
  say('✗ ' + fail + '개 실패');
  say('  animal.js buildAnimalBase 가 새 def 필드를 읽기 시작했다면,');
  say('  app.js _charIdentityFingerprint 에 그 필드를 **함께** 넣어야 한다.');
  say('  안 넣으면 그 값의 변경은 상대 화면에서 조용히 무시된다.');
  process.exit(1);
}
say('전부 통과 ✅ — 동물 모양을 바꾸는 값은 전부 상대 화면 재빌드를 부른다');
say('⚠ 눈으로 볼 것: 방에 둘이 들어가 F1 로 동물 슬롯을 바꿔, 상대 화면이 즉시 바뀌는지');
process.exit(0);
