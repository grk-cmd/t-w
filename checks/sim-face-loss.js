/* sim-face-loss.js — 🖼️ 얼굴 이미지 로드 실패 시 원본이 지워지지 않는지 검증
   실행:  node sim-face-loss.js   (app.js · smoke.js 와 같은 폴더에서)

   ★ 제보 재현 — "켜뒀더니 얼굴이 사라지고, 껐다 켜니 피부색만 남았다"
     경로는 이렇다:
       (1) 부팅 loadSlots 에서 face 이미지 로드가 실패한다
       (2) 예전 코드는 그 칸을 통째로 버렸다(slots[i] 미할당)
       (3) 그 뒤 아무 saveSlots() — 파츠 장착·슬라이더·책상 아이템 등 수십 군데 —
           가 한 번 돌면 그 칸이 빈/null 로 저장되어 **원본이 영구 소실**된다
     이 검증기는 (1)을 강제로 일으키고, (3) 뒤에도 localStorage 원본이 살아 있는지 본다.
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

/* ── Image 스텁 — src 에 'BROKEN' 이 들어 있으면 로드 실패, 'ZERO' 면 크기 0으로 onload ── */
const GOOD = 'data:image/png;base64,GOODFACE';
const BAD  = 'data:image/png;base64,BROKEN';
globalThis.Image = class {
  constructor(){ this.naturalWidth = 512; this.naturalHeight = 512; this.width = 512; this.height = 512; }
  set src(v){
    this._src = v;
    this.__ink = !/BLANK/.test(String(v));   // 🖌️ 'BLANK' 가 든 원본만 «빈 그림»으로 취급한다
    realST(() => {
      if (typeof v === 'string' && v.includes('BROKEN')) { if (this.onerror) this.onerror(new Error('load failed')); return; }
      if (typeof v === 'string' && v.includes('ZERO')) { this.naturalWidth = 0; this.naturalHeight = 0; }
      if (this.onload) this.onload();
    }, 0);
  }
  get src(){ return this._src; }
};

/* Node 에는 이 두 생성자가 없다 — compositeFace 의 instanceof 검사가 ReferenceError 로 죽는다.
   실제 브라우저에선 정상 동작하는 코드이므로 여기서만 형식적으로 채워 준다. */
globalThis.HTMLCanvasElement = class {};
globalThis.HTMLImageElement  = globalThis.Image;

/* 🖌️ smoke.js 의 캔버스 스텁은 «무엇이 그려졌는지»를 모른다 — getImageData 가 늘 0 을 돌려주고
   toDataURL 은 늘 같은 빈 문자열이다. 그 위에서는 _isBlankDraw 가 항상 «비었다»고 답해서
   이 검증기가 통과해도 아무것도 증명하지 못한다(오히려 전부 통과처럼 보여 더 나쁘다).
   그래서 여기서만 캔버스에 «잉크가 있나» 한 칸을 달아 준다:
     · drawImage(잉크 있는 것)  → 잉크 생김      · clearRect → 잉크 사라짐
     · getImageData             → 알파로 반영     · toDataURL → INK / BLANK 로 구분
   이 한 칸이면 «런타임에 캔버스가 비었다»를 실제로 만들어 낼 수 있다. */
const INK_URL = 'data:image/png;base64,INK', BLANK_URL = 'data:image/png;base64,BLANK';
{
  const _create = globalThis.document.createElement;
  globalThis.document.createElement = function(tag){
    const n = _create.call(globalThis.document, tag);
    if(String(tag).toLowerCase() === 'canvas'){
      n.__ink = false;
      const _gc = n.getContext;
      n.getContext = function(){
        const c = _gc.apply(n, arguments);
        c.clearRect = ()=>{ n.__ink = false; return c; };
        c.fillRect  = ()=>{ n.__ink = true;  return c; };
        c.drawImage = (src)=>{ if(src && src.__ink) n.__ink = true; return c; };
        c.getImageData = ()=>({ data: new Uint8ClampedArray([0,0,0, n.__ink?255:0]), width:1, height:1 });
        return c;
      };
      n.toDataURL = ()=> n.__ink ? INK_URL : BLANK_URL;
    }
    return n;
  };
}

/* __P.allowBlankOnce 는 «생성기에서 사용자가 비운 채 저장을 확인했다»를 흉내 낸다.
   _blankFaceConfirmed 는 let 이라 밖에서 못 건드린다 — 같은 스코프인 이 probe 안에서만 대입할 수 있다. */
const probe = `
;globalThis.__P = { loadSlots, saveSlots, slots, LS_KEY, loadImg, MAX: CHAR_SLOT_MAX,
  isBlank: _isBlankDraw, faceMem: _faceEverDrawn,
  allowBlankOnce: ()=>{ _blankFaceConfirmed = true; },
  /* 진짜 THREE.CanvasTexture 는 tex.image 에 원본 캔버스를 담는다 — 복구가 그 자리에 다시 그린다.
     smoke 의 THREE 스텁은 무엇을 물어도 프록시를 돌려줘서 tex.image 가 캔버스가 아니다.
     그러면 «화면 텍스처가 비었다»를 만들 수조차 없으므로, 여기서만 실제 동작대로 채워 준다. */
  repair: repairBlankFaces, seats, compositeFace, skinCanvases,
  mkFaceTex: (cv)=>{ const t = mkFaceTex(cv); t.image = cv; return t; } };`;

const say = console.log;
let warns = [];
console.log = () => {}; console.warn = (...a) => { warns.push(a.map(String).join(' ')); };
try { vm.runInThisContext(fs.readFileSync('app.js', 'utf8') + probe, { filename: 'app.js' }); }
catch (e) { console.log = say; say('✗ app.js 평가 실패: ' + (e && e.stack || e)); process.exit(1); }
console.log = say;

const P = globalThis.__P;
const LS = globalThis.localStorage;
let fail = 0;
const chk = (c, m) => { say((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };

/* localStorage 에 심어 둘 '멀쩡한 저장본' — 1번 칸의 얼굴만 나중에 깨뜨린다.
   ⚠ 칸 수를 숫자로 박지 말 것. 예전엔 [slot,null,null] 3칸으로 심었는데, CHAR_SLOT_MAX 가
     3→5 로 늘면서 saveSlots 는 5칸을 쓰게 됐다. 그러면 '저장본이 변하지 않는다'(길이 3 vs 5)가
     내용은 멀쩡한데도 실패한다 — 슬롯 5칸 확장 잔재의 네 번째 자리였다(핸드오프 2절). */
function seed(faceSrc){
  const slot = { skin: 2, top: '#abc', bot: '#def', face: faceSrc, blink: GOOD, equippedParts: { hat: [{ id: 'h1' }] } };
  const arr = new Array(P.MAX).fill(null);
  arr[0] = slot;
  LS.setItem(P.LS_KEY, JSON.stringify(arr));
}

/* 칸 비우기 — 여기도 칸 수를 숫자로 박지 않는다 */
function clearSlots(){ for (let i = 0; i < P.MAX; i++) P.slots[i] = null; }

(async () => {
  say('=== 🖼️ 얼굴 이미지 로드 실패 보호 ===');
  say('');

  /* ── 1. 정상 경로부터 ── */
  say('· 정상: 얼굴·감은눈이 모두 로드된다');
  seed(GOOD); clearSlots(); warns = [];
  await P.loadSlots();
  chk(!!P.slots[0], '캐릭터가 복원된다');
  chk(!P.slots[0]._imgBroken, '깨짐 표식이 없다');
  P.saveSlots();
  chk(JSON.parse(LS.getItem(P.LS_KEY))[0].skin === 2, '저장이 정상적으로 돈다');
  say('');

  /* ── 2. 제보 경로: 얼굴 이미지 로드 실패 ── */
  say('· 제보 재현: 얼굴 이미지 로드가 실패한다');
  seed(BAD); clearSlots(); warns = [];
  await P.loadSlots();
  chk(!!P.slots[0], '★ 칸을 통째로 버리지 않는다 (예전엔 여기서 캐릭터가 사라졌다)');
  chk(!!(P.slots[0] && P.slots[0]._imgBroken), '깨짐 표식이 달린다 (' + (P.slots[0] && P.slots[0]._imgBroken) + ')');
  chk(P.slots[0].skin === 2 && !!P.slots[0].equippedParts, '옷·파츠 등 나머지 정보는 살아 있다');
  chk(warns.some(w => w.includes('얼굴')), '콘솔에 원인이 남는다');
  say('');

  say('· 그 상태에서 saveSlots() 가 돈다 (파츠 장착·슬라이더 등 수십 군데에서 부른다)');
  const before = LS.getItem(P.LS_KEY);
  P.saveSlots(); P.saveSlots(); P.saveSlots();
  const after = JSON.parse(LS.getItem(P.LS_KEY));
  chk(after[0] && after[0].face === BAD, '★ localStorage 의 원본이 그대로 살아 있다 (덮어쓰지 않음)');
  chk(before === LS.getItem(P.LS_KEY), '여러 번 불러도 저장본이 변하지 않는다');
  say('');

  say('· 원인이 사라지고 다시 켜면');
  seed(GOOD); clearSlots(); warns = [];
  await P.loadSlots();
  chk(!!P.slots[0] && !P.slots[0]._imgBroken, '저절로 정상 복원된다');
  say('');

  /* ── 3. 옛 저장본(3칸)을 물려받은 유저 ──
     위 seed 를 CHAR_SLOT_MAX 로 고치면서 '3칸짜리 저장본' 경우가 검사에서 빠졌다.
     그건 실제로 존재하는 상태다(5칸 확장 전에 저장한 유저). loadSlots 의 패딩과
     saveSlots 의 prev[i]===undefined 갈래가 여기서만 밟힌다. */
  say('· 옛 저장본(3칸)을 물려받았고 그 중 1번 칸 얼굴이 깨졌다');
  {
    const slot = { skin: 2, top: '#abc', bot: '#def', face: BAD, blink: GOOD, equippedParts: { hat: [{ id: 'h1' }] } };
    LS.setItem(P.LS_KEY, JSON.stringify([slot, null, null]));   // ← 여기만 일부러 3칸
    clearSlots(); warns = [];
    await P.loadSlots();
    chk(!!P.slots[0] && !!P.slots[0]._imgBroken, '3칸 저장본도 칸을 버리지 않는다');
    P.saveSlots(); P.saveSlots();
    const arr = JSON.parse(LS.getItem(P.LS_KEY));
    chk(arr[0] && arr[0].face === BAD, '★ 3칸 저장본의 원본도 덮어쓰지 않는다');
    chk(arr.length === P.MAX, '저장하면 ' + P.MAX + '칸으로 채워진다 (' + arr.length + '칸)');
    chk(arr.slice(1).every(x => x === null), '없던 칸은 null 로만 늘어난다 (가짜 캐릭터가 안 생긴다)');
  }
  say('');

  /* ── 4. 0크기 이미지(onerror 없이 onload) ── */
  say('· onerror 없이 크기 0으로 뜨는 이미지');
  let zeroFail = false;
  try { await P.loadImg('data:image/png;base64,ZERO'); } catch (e) { zeroFail = true; }
  chk(zeroFail, '★ 실패로 처리된다 (예전엔 빈 그림이 그대로 저장됐다)');
  say('');

  /* ── 5. ★ 이번 제보의 본체 — 실행 중에 캔버스 «내용»이 사라진다 ──
     부팅은 정상이었다(_imgBroken 이 안 붙는다). 그래서 3절까지의 보호막은 하나도 안 걸린다.
     예전에는 이 빈 캔버스가 slotToObj 를 그대로 통과해 빈 PNG 로 굳었고, 그게 영구 소실이었다. */
  say('· ★ 부팅은 정상이었는데 실행 중에 얼굴 캔버스가 비었다 (제보의 본체)');
  seed(GOOD); clearSlots(); warns = [];
  await P.loadSlots();
  P.saveSlots();                                        // 여기까지는 멀쩡한 저장
  chk(JSON.parse(LS.getItem(P.LS_KEY))[0].face === INK_URL, '정상 저장본이 먼저 만들어진다');
  chk(!P.slots[0]._imgBroken, '부팅 실패 표식은 없다 (기존 보호막은 여기서 안 걸린다)');

  P.slots[0].face.getContext('2d').clearRect(0, 0, 512, 512);   // 💥 실행 중 캔버스 내용 소실
  chk(P.isBlank(P.slots[0].face), '캔버스가 실제로 비었다 (실험 조건 확인)');

  warns = [];
  P.saveSlots(); P.saveSlots(); P.saveSlots();           // 가챠 정리·책상 아이템·슬라이더 등 자동 저장
  const t5 = JSON.parse(LS.getItem(P.LS_KEY))[0];
  chk(t5.face === INK_URL, '★ 원본이 빈 그림으로 덮이지 않는다');
  chk(t5.blink === INK_URL, '감은눈도 함께 지켜진다');
  chk(t5.skin === 2 && !!t5.equippedParts, '나머지 정보는 정상적으로 저장된다 (칸 통째 되돌리기 아님)');
  chk(warns.some(w => w.includes('막았습니다')), '콘솔에 막았다는 기록이 남는다');
  say('');

  /* ── 6. 오탐 검사 — «원래부터 빈 얼굴»은 막으면 안 된다 ──
     이 검사가 없으면 위 보호막이 조용히 과잉 작동해도 아무도 모른다. */
  say('· 원래부터 얼굴이 비어 있던 캐릭터');
  {
    const slot = { skin: 3, top: '#abc', bot: '#def', face: BLANK_URL, blink: BLANK_URL };
    const arr = new Array(P.MAX).fill(null); arr[0] = slot;
    LS.setItem(P.LS_KEY, JSON.stringify(arr));
    clearSlots(); await P.loadSlots();
    chk(P.faceMem[0] === false, '«그림이 있던 적 없음»으로 기억된다');
    P.saveSlots();
    chk(JSON.parse(LS.getItem(P.LS_KEY))[0].face === BLANK_URL, '★ 빈 상태 그대로 저장된다 (오탐 없음)');
  }
  say('');

  /* ── 7. 사용자가 «비운 채 저장»을 직접 확인한 경우 ──
     보호막이 사용자의 뜻까지 막아 버리면 «다 지우고 새로 시작»이 불가능해진다. */
  say('· 사용자가 생성기에서 «비운 채 저장»을 확인했다');
  seed(GOOD); clearSlots(); await P.loadSlots(); P.saveSlots();
  P.slots[0].face.getContext('2d').clearRect(0, 0, 512, 512);
  P.allowBlankOnce();
  P.saveSlots();
  chk(JSON.parse(LS.getItem(P.LS_KEY))[0].face === BLANK_URL, '★ 확인한 저장은 통과한다');

  say('· 그 허가는 한 번만 쓰인다');
  seed(GOOD); clearSlots(); await P.loadSlots(); P.saveSlots();
  P.allowBlankOnce();
  P.saveSlots();                                        // 허가가 여기서 소비된다 (그림은 아직 멀쩡)
  P.slots[0].face.getContext('2d').clearRect(0, 0, 512, 512);
  P.saveSlots();                                        // 그 다음 자동 저장은 다시 막혀야 한다
  chk(JSON.parse(LS.getItem(P.LS_KEY))[0].face === INK_URL, '★ 남은 허가가 뒤따르는 자동 저장을 통과시키지 않는다');

  say('');

  /* ── 8. 🛡️ 자동 복구 워치독 ──
     saveSlots 의 공백 방어는 «저장을 막는다». 그것만으로는 화면이 빈 채로 남는다 —
     저장이 한 번도 안 도는 동안에는 그 코드가 아예 실행되지 않기 때문이다.
     여기서 보는 것은 «아무 저장도 없이, 주기 점검만으로 화면이 돌아오는가» 하나다.
     ★ 좌석 텍스처까지 확인한다. def.face 만 되살아나면 데이터만 낫고 화면은 그대로 비어 있다. */
  say('· 🛡️ 실행 중 얼굴이 비면 저장 없이도 저절로 돌아온다');
  seed(GOOD); clearSlots(); await P.loadSlots(); P.saveSlots();
  {
    const d = P.slots[0];
    // 좌석 하나를 흉내 낸다 — 화면에 보이는 것은 def.face 가 아니라 합성 텍스처다.
    const seat = { remote:false, charDef:d,
      faceMapOrig: P.mkFaceTex(P.compositeFace(d.skin, d.face)),
      blinkTex:    P.mkFaceTex(P.compositeFace(d.skin, d.blink)) };
    P.seats.push(seat);
    chk(!P.isBlank(seat.faceMapOrig.image), '합성 텍스처가 처음엔 멀쩡하다 (실험 조건 확인)');

    // 💥 백킹스토어 회수 흉내 — 그림 캔버스도, 화면에 걸린 합성 텍스처도 함께 비운다
    d.face.getContext('2d').clearRect(0,0,512,512);
    d.blink.getContext('2d').clearRect(0,0,512,512);
    seat.faceMapOrig.image.getContext('2d').clearRect(0,0,512,512);
    seat.blinkTex.image.getContext('2d').clearRect(0,0,512,512);
    seat.faceMapOrig.needsUpdate = false;
    chk(P.isBlank(d.face) && P.isBlank(seat.faceMapOrig.image), '얼굴도 화면 텍스처도 비었다 (실험 조건 확인)');

    warns = [];
    const n = await P.repair();
    chk(n > 0, '★ 워치독이 복구했다고 보고한다 (' + n + '칸)');
    chk(!P.isBlank(d.face),  '★ 그림 캔버스가 저장본으로 되살아난다');
    chk(!P.isBlank(d.blink), '감은눈도 함께 되살아난다');
    chk(!P.isBlank(seat.faceMapOrig.image), '★ 화면에 걸린 합성 텍스처까지 다시 그려진다');
    chk(seat.faceMapOrig.needsUpdate === true, 'needsUpdate 가 서서 실제로 화면에 반영된다');
    chk(warns.some(w => w.includes('[얼굴복구]')), '정황과 함께 콘솔에 남는다');

    say('');
    say('· 멀쩡할 때는 아무 일도 하지 않는다 (4초마다 도는 점검이라 이게 중요하다)');
    warns = [];
    chk(await P.repair() === 0, '★ 복구할 것이 없으면 0 을 돌려주고 조용하다');
    chk(warns.length === 0, '멀쩡한데 콘솔을 더럽히지 않는다');

    say('');
    say('· 이미 손상된 저장본(원본도 빈 그림)에서 헛돌지 않는다');
    {
      const slot = { skin: 2, top: '#abc', bot: '#def', face: BLANK_URL, blink: BLANK_URL };
      const arr = new Array(P.MAX).fill(null); arr[0] = slot;
      LS.setItem(P.LS_KEY, JSON.stringify(arr));
      clearSlots(); P.seats.length = 0;
      await P.loadSlots();
      chk(await P.repair() === 0, '★ 되살릴 원본이 없는 칸은 후보로 잡지 않는다 (무한 복구 없음)');
    }
    P.seats.length = 0;
  }

  say('');
  if (fail) { say('문제 ' + fail + '건'); process.exit(1); }
  say('전부 통과 ✅');
  process.exit(0);
})().catch(e => { say('✗ 실험 자체가 죽음: ' + (e && e.stack || e)); process.exit(1); });
