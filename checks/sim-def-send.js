/* sim-def-send.js — 🐾 입장 시 전송되는 def 가 슬롯의 def 와 어긋나지 않는지 검증
   실행:  node sim-def-send.js   (app.js · smoke.js 와 같은 폴더에서)

   ★ 제보 재현 시도 — "A캐릭터를 골라서 입장해도 다른 분들께는 다른 캐릭터로 보인다.
     동물을 골랐는데 인간으로 보였다. **이후 캐릭터를 수정하거나 변경하면 제대로 적용된다.**"

     '수정하면 정상'이라는 증상은 곧 "join 이 보낸 def ≠ updateDef 가 보낸 def" 라는 가설이다.
     보내는 쪽에서 그 차이가 날 수 있는 층은 셋뿐이다:
       (1) ensureRoomFaceUrls   — Storage 업로드 + localStorage URL 캐시
       (2) serializeDefForNetwork — URL 이 있으면 dataURL 을 삭제
       (3) _diffRoomPayload      — 바뀐 필드만 전송
     이 검증기는 세 층을 실제로 통과시켜 **join 페이로드와 updateDef 페이로드를 바이트 비교**한다.
     둘이 같다면 보내는 쪽은 용의선상에서 빠지고, 조사는 받는 쪽(applyCharToSeat 폴백)으로 넘어간다.

   ⚠ 여기서 통과한다고 제보가 해결된 것은 아니다 — '보내는 쪽은 아니다'까지만 말한다.
   ⚠ smoke.js 의 스텁을 빌려 쓴다 — 같은 폴더에 있어야 한다. */
'use strict';
const fs = require('fs'), vm = require('vm');

let smokeSrc = fs.readFileSync('smoke.js', 'utf8');
smokeSrc = smokeSrc.slice(0, smokeSrc.indexOf('/* ── 실행'))
  .split('\n').filter(l => !/require\(|const FILE =|if \(!FILE\)|process\.exit/.test(l)).join('\n');
vm.runInThisContext(smokeSrc, { filename: 'smoke-stubs.js' });

const realST = require('timers').setTimeout;
globalThis.setTimeout  = (fn, ms) => realST(fn, ms || 0);
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
;globalThis.__P = { Presence, slots, loadSlots, LS_KEY, serializeDefForNetwork,
                    setCurSlot: n => { curSlot = n; } };`;

/* app.js 는 [def-diag] 등을 console.log 로 계속 찍는다 — 검사 결과만 보이게 계속 막아 두고,
   이 파일의 출력은 붙잡아 둔 원본(say)으로만 낸다. */
const say = console.log;
console.log = () => {}; console.warn = () => {};
try { vm.runInThisContext(fs.readFileSync('app.js', 'utf8') + probe, { filename: 'app.js' }); }
catch (e) { console.log = say; say('✗ app.js 평가 실패: ' + (e && e.stack || e)); process.exit(1); }

const P = globalThis.__P;
const LS = globalThis.localStorage;
let fail = 0;
const chk = (c, m) => { say((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };

/* ── 전송 가로채기 ─────────────────────────────────────────────────
   firebaseAPI 를 통째로 스텁해서 joinRoom / updateMe 에 실제로 도착한 값을 붙잡는다.
   (Presence → makeFirebaseProvider 경로를 그대로 태운다 — 여기가 검증 대상이다) */
let sent = null;
function installApi(uploadOk){
  globalThis.window.firebaseAPI = {
    uploadRoomFace: async (uid, key) => uploadOk ? { ok: true, url: 'https://storage.test/' + key + '.png' } : { ok: false },
    joinRoom: (room, me) => { sent = { how: 'join', payload: me }; return 'm_test'; },
    updateMe: (p) => { sent = { how: 'update', payload: p }; },
    leaveRoom: async () => {},
    poke: () => {},
  };
}
globalThis.getMyUserId = () => 'u_test';

const D = t => 'data:image/png;base64,' + t + 'A'.repeat(400);
const HUMAN = { skin: 1, top: '#111', bot: '#222', face: D('HFACE'), blink: D('HBLINK') };
const ANIMAL = {
  skin: 2, top: '#aaa', bot: '#bbb', face: D('AFACE'), blink: D('ABLINK'),
  animal: true, animalFace: 2, animalEarL: 'cat', animalEarR: 'cat',
  animalBody: D('ABODY'), animalEarPaintL: D('AEARL'),
  animalEarPaintR: D('AEARR'), animalBlink: D('ABLNK'),
};

const clearFaceCache = () => { try { LS.removeItem('tw.roomFaceUrls'); } catch (_) {} };

async function seedAndEnter(slotArr, idx){
  LS.setItem(P.LS_KEY, JSON.stringify(slotArr));
  P.slots.fill(null);   // 🧍 슬롯 개수는 app.js 의 CHAR_SLOT_MAX 를 따른다 — 여기에 숫자를 박지 않는다
  await P.loadSlots();
  P.setCurSlot(idx);
  sent = null;
  await P.Presence.start('TESTROOM', P.slots[idx], '나', () => {});
  return sent;
}

(async () => {
  say('=== 🐾 방으로 나가는 def 검증 (제보: 입장 시 다른 캐릭터로 보임) ===');
  say('');

  /* ── 1. 동물 슬롯으로 입장 ── */
  say('· 동물 슬롯(2번 칸)으로 입장한다');
  clearFaceCache(); installApi(true);
  const joinSent = await seedAndEnter([HUMAN, ANIMAL, null], 1);
  const jdef = joinSent && joinSent.payload && joinSent.payload.def;
  chk(joinSent && joinSent.how === 'join', 'joinRoom 으로 전송됐다');
  chk(!!jdef, 'def 가 페이로드에 실렸다');
  chk(jdef && jdef.animal === true, 'animal 플래그가 살아 있다 (이게 빠지면 받는 쪽은 인간을 그린다)');
  chk(jdef && jdef.animalFace === 2, 'animalFace(얼굴형)가 그대로다');
  chk(jdef && jdef.animalEarL === 'cat' && jdef.animalEarR === 'cat', '좌/우 귀 종류가 그대로다');
  chk(jdef && typeof jdef.animalBodyUrl === 'string', '몸 페인트가 Storage URL 로 실렸다');
  chk(jdef && jdef.animalBody === undefined, '무거운 dataURL 원본은 빠졌다(URL 이 있을 때만)');
  say('');

  /* ── 2. 같은 def 를 updateDef 로 다시 보낸다 — 제보 가설의 핵심 ── */
  say('· 같은 캐릭터를 updateDef("수정")로 다시 보낸다');
  sent = null;
  P.Presence.updateDef(P.slots[1]);
  await new Promise(r => realST(r, 60));
  const udef = sent && sent.payload && sent.payload.def;
  chk(sent && sent.how === 'update', 'updateMe 로 전송됐다');
  chk(!!udef, '델타에 def 가 들어 있다 (_diffRoomPayload 가 def 를 떨어뜨리지 않는다)');
  chk(udef && JSON.stringify(udef) === JSON.stringify(jdef),
      '입장 def 와 수정 def 가 **완전히 같다** ← 제보의 "수정하면 정상"을 보내는 쪽으로 설명할 수 없다');
  say('');

  /* ── 3. 값이 하나도 안 바뀌어도 def 는 통과해야 한다 ── */
  say('· 아무것도 안 바꾸고 updateDef 를 한 번 더 부른다');
  sent = null;
  P.Presence.updateDef(P.slots[1]);
  await new Promise(r => realST(r, 60));
  chk(sent && sent.payload && sent.payload.def,
      '델타가 비어도 def 는 항상 통과한다(같은 값이라고 생략되면 재전송 요청이 먹통이 된다)');
  say('');

  /* ── 4. Storage 업로드가 실패해도 캐릭터 종류는 살아야 한다 ── */
  say('· Storage 업로드가 전부 실패하는 상황');
  clearFaceCache(); installApi(false);
  const failSent = await seedAndEnter([HUMAN, ANIMAL, null], 1);
  const fdef = failSent && failSent.payload && failSent.payload.def;
  chk(fdef && fdef.animal === true, '업로드가 실패해도 animal 플래그는 남는다');
  chk(fdef && typeof fdef.animalBody === 'string',
      'URL 이 없으면 dataURL 원본이 폴백으로 실린다(받는 쪽에 대체 수단이 남는다)');
  say('');

  /* ── 5. 인간 슬롯 — 동물 필드가 섞여 나가지 않는다 ── */
  say('· 인간 슬롯(1번 칸)으로 입장한다');
  clearFaceCache(); installApi(true);
  const hSent = await seedAndEnter([HUMAN, ANIMAL, null], 0);
  const hdef = hSent && hSent.payload && hSent.payload.def;
  chk(hdef && !hdef.animal, 'animal 이 켜져 있지 않다');
  chk(hdef && hdef.animalBodyUrl === undefined && hdef.animalBlinkUrl === undefined,
      '옆 칸 동물의 페인트 URL 이 새어 들어오지 않는다');
  say('');

  /* ── 6. 로컬 전용 필드는 방으로 나가면 안 된다 ── */
  say('· 로컬 전용 필드 제거');
  const bulky = Object.assign({}, ANIMAL, { thumb: D('THUMB'), partXfMemory: { hat: { s: 1 } }, _imgBroken: ['얼굴'] });
  const out = P.serializeDefForNetwork(bulky);
  chk(out.thumb === undefined, 'thumb(런처 아이콘용 3D 스냅샷)이 빠진다');
  chk(out.partXfMemory === undefined, 'partXfMemory(생성기 편집 메모리)가 빠진다');
  chk(out._imgBroken === undefined, '_imgBroken(로컬 복원 실패 표식)이 빠진다');
  say('');

  /* ── 7. 파츠를 **뺐을 때** 그 제거가 def 로 나가는가 ────────────────
     ★ 핸드오프 8-1 확인점 3. 제보 4의 "빼도 상대에겐 계속 착용"이 여기서 나는지 본다.
       위 1~6절은 전부 '무엇이 실렸는가'만 봤다 — 사라진 것을 보는 검사가 하나도 없었다.
     ⚠ 여기서 통과해도 무혐의가 아니다. 이 검사가 덮는 것은 딱 두 층이다:
         serializeDefForNetwork 가 빈 카테고리를 지우지 않는가 · _diffRoomPayload 가 def 를 통과시키는가.
       **덮지 못하는 것**: updateMe 가 RTDB 에 어떻게 쓰는가(update 가 def 자식을 통째로
       갈아끼우는가, 아니면 병합하는가)와 받는 쪽 syncFriendSeats/prune. 그 둘은 app.js 밖이다. */
  say('· 파츠를 빼고 updateDef 를 보낸다 (제보 4: "빼도 상대에겐 계속 착용")');
  clearFaceCache(); installApi(true);
  const WORN = Object.assign({}, HUMAN, {
    equippedParts: { hat: [{ id: 'h1' }, { id: 'h2' }], glasses: { id: 'g1' } },
  });
  const wSent = await seedAndEnter([WORN, null, null], 0);
  const wdef = wSent && wSent.payload && wSent.payload.def;
  chk(wdef && wdef.equippedParts && Array.isArray(wdef.equippedParts.hat)
      && wdef.equippedParts.hat.length === 2, '입장 def 에 모자 2개가 실렸다(🔗 stackable)');
  chk(wdef && wdef.equippedParts && wdef.equippedParts.glasses, '입장 def 에 안경도 실렸다');

  // (ㄱ) stackable 한 개만 뺀다 — 카테고리는 살아 있고 id 하나만 사라지는 경우
  P.slots[0].equippedParts = { hat: [{ id: 'h1' }], glasses: { id: 'g1' } };
  sent = null;
  P.Presence.updateDef(P.slots[0]);
  await new Promise(r => realST(r, 60));
  const d1 = sent && sent.payload && sent.payload.def;
  chk(d1 && d1.equippedParts && d1.equippedParts.hat && d1.equippedParts.hat.length === 1,
      '★ 모자 하나를 빼면 남은 한 개만 나간다 (h2 가 사라진 목록이 그대로 전송된다)');

  // (ㄴ) 카테고리를 통째로 뺀다 — 키 자체가 사라지는 경우
  P.slots[0].equippedParts = { glasses: { id: 'g1' } };
  sent = null;
  P.Presence.updateDef(P.slots[0]);
  await new Promise(r => realST(r, 60));
  const d2 = sent && sent.payload && sent.payload.def;
  chk(d2 && d2.equippedParts && d2.equippedParts.hat === undefined,
      '★ 모자 카테고리를 통째로 빼면 def 에서 hat 키가 사라진다');
  chk(d2 && d2.equippedParts && !!d2.equippedParts.glasses, '남은 안경은 그대로 간다');

  // (ㄷ) 전부 뺀다 — equippedParts 가 비는 경우
  P.slots[0].equippedParts = {};
  sent = null;
  P.Presence.updateDef(P.slots[0]);
  await new Promise(r => realST(r, 60));
  const d3 = sent && sent.payload && sent.payload.def;
  chk(!!d3, '★ 다 벗어도 def 는 여전히 전송된다 (여기서 전송이 생략되면 상대는 영영 벗은 걸 못 본다)');
  chk(d3 && d3.equippedParts && Object.keys(d3.equippedParts).length === 0,
      '빈 equippedParts 가 그대로 나간다');
  say('  ↳ ⚠ 여기까지는 보내는 쪽 두 층뿐이다. RTDB 쓰기 방식과 받는 쪽은 이 검사 밖이다.');
  say('');

  say(fail ? ('✗ ' + fail + '개 실패') : '✓ 전부 통과 — 보내는 쪽(ensureRoomFaceUrls · serializeDefForNetwork · _diffRoomPayload)은');
  if (!fail) say('  입장과 수정에서 **같은 def** 를 만든다. 제보의 원인은 받는 쪽에서 찾아야 한다.');
  process.exit(fail ? 1 : 0);
})();
