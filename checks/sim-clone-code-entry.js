/* sim-clone-code-entry.js — 🔑 복제 코드 "입구" 검사 (제보 1의 재발 방지)
   실행:  node sim-clone-code-entry.js   (app.js · desk-companion-prototype.html · smoke.js 와 같은 폴더에서)

   ★ 왜 이 검사가 있는가 — 제보 1("슬롯이 전부 비어 있으면 복제 코드가 안 먹힌다")의 정체는
     암호도, 크립토도, 이미지도 아니었다. **코드를 넣는 입구가 둘인데 받는 형식이 달랐던 것**이다.

       ① 런처 [캐릭터 불러오기] → #codeOverlay      → decryptCode      → DCC1 만 받음
       ② 빈 슬롯 [＋] → 종족 선택의 코드 패널        → decryptCommission → DCM1 만 받음

     ②는 **빈 슬롯에서만 열리는 창**이다. 그래서 여기에 캐릭터 복제 코드(DCC1)를 넣으면
     decryptCommission 이 첫 줄에서 'format' 을 던지고, catch 가
     "등록 실패: 코드나 비밀번호를 확인해 주세요" 를 띄운다 —
     유저 눈에는 정확히 "슬롯이 비었을 때만, 같은 파일·같은 암호인데 코드나 암호가 틀렸다"가 된다.
     캐릭터가 하나라도 있으면 ①을 쓰게 되니 정상 동작하고, "임시 캐릭터를 만들었다 지운다"는
     우회법도 그래서 통했다.

   ★ 무엇을 보는가 (두 층)
     §1 소스·마크업 대조 — 등록 구현이 **한 벌**인가 · ②가 DCC1 을 받는가 ·
        오진을 부르던 '코드나 …' 뭉뚱그린 문구가 돌아오지 않았는가 · 슬롯 수를 숫자로 박지 않았는가
     §2 런타임 — ②에 DCC1 을 넣으면 [＋]로 고른 그 칸에 정말 들어가는가.
        그리고 **옛 경로(decryptCommission)에 DCC1 을 넣으면 실제로 튕기는지**까지 확인해서,
        이 검사가 재현하려는 함정이 진짜였음을 함께 남긴다.

   ⚠ 이 검사는 암복호 자체는 보지 않는다(스텁). 형식 갈래와 슬롯 배정만 본다.
   ⚠ smoke.js 의 스텁을 빌려 쓴다 — 같은 폴더에 있어야 한다. */
'use strict';
const fs = require('fs'), vm = require('vm');

const SRC  = fs.readFileSync('app.js', 'utf8');
const HTML = fs.readFileSync('desk-companion-prototype.html', 'utf8');
const say = console.log;
let fail = 0;
const chk = (c, m) => { say((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };

say('=== 🔑 복제 코드 입구 검사 (제보 1) ===');
say('');

/* ── §1. 소스·마크업 대조 ─────────────────────────────────────────── */
say('· §1 소스 대조 — 입구가 둘이어도 등록은 한 벌인가');

// (ㄱ) 등록 구현이 하나인가
const defCount = (SRC.match(/function\s+importCloneCode\s*\(/g) || []).length;
chk(defCount === 1, 'importCloneCode 정의가 하나다 (' + defCount + '개)');

const callers = (SRC.match(/importCloneCode\s*\(/g) || []).length - defCount;
chk(callers >= 2, '호출부가 둘 이상이다 — 두 입구가 같은 구현을 쓴다 (' + callers + '곳)');

// (ㄴ) 종족 선택 패널이 DCC1 을 받는가
const commBlock = (SRC.match(/getElementById\('commImpGo'\)\.onclick[\s\S]*?\n};/) || [''])[0];
chk(commBlock.length > 0, "commImpGo 핸들러를 찾았다");
chk(/\^DCC1\\\./.test(commBlock) && /importCloneCode/.test(commBlock),
    '★ 종족 선택 코드 패널이 DCC1 을 받아 importCloneCode 로 넘긴다 (제보 1의 수정)');
chk(/\^DCM1\\\./.test(commBlock), '커미션 코드(DCM1) 경로는 그대로 남아 있다');
chk(/\^DCK1\\\./.test(commBlock), '책상·아이템 코드(DCK1)는 어디로 가야 하는지 알려준다');

// (ㄷ) 오진을 부르던 뭉뚱그린 문구가 돌아오지 않았는가
chk(!/코드나 비밀번호를 확인해 주세요/.test(commBlock),
    "★ '코드나 비밀번호' 로 뭉뚱그리지 않는다 — 형식은 위에서 이미 갈랐다");

// (ㄹ) 진단 로그는 살아 있는가 (다음 제보의 첫 단서)
chk(/\[복제코드\] 불러오기 실패/.test(SRC), '[복제코드] 실패 로그가 남아 있다');
chk(/\[커미션코드\] 등록 실패/.test(SRC), '[커미션코드] 실패 로그가 있다');

// (ㅁ) 슬롯 수를 숫자로 박은 자리 — 3→5 확장 때 조용히 남았던 종류
chk(/_raceTargetSlot\s*=.*target\s*<\s*CHAR_SLOT_MAX/.test(SRC),
    '★ [＋]의 슬롯 상한이 CHAR_SLOT_MAX 다 (3 이 박혀 있으면 4·5번 칸이 null 로 흐른다)');
chk(/target\s*<\s*0\s*\|\|\s*target\s*>=\s*CHAR_SLOT_MAX/.test(SRC),
    '★ 신규 저장의 슬롯 상한이 CHAR_SLOT_MAX 다 (2 가 박혀 있으면 4·5번 칸 캐릭터가 사라진다)');
chk(!/saved\.length\s*<\s*3\b/.test(SRC),
    '친구 추가 창의 [＋ 새로 만들기] 조건에도 3 이 박혀 있지 않다');

// (ㅂ) 마크업 — 유저가 무엇을 넣는 칸인지 알 수 있는가
const panel = (HTML.match(/id="raceCommCodePanel"[\s\S]*?<\/div>\s*<\/div>/) || [''])[0];
chk(/DCC1/.test(panel), '패널 안내/placeholder 가 DCC1(복제 코드)도 받는다고 말한다');
chk(/DCM1/.test(panel), '커미션 코드(DCM1)도 여전히 안내된다');
chk(!/코드 입력하기 \(커미션 캐릭터\)/.test(HTML),
    '버튼 이름이 더 이상 "커미션 캐릭터" 전용으로 읽히지 않는다');

say('');

/* ── §2. 런타임 ──────────────────────────────────────────────────── */
say('· §2 런타임 — 빈 칸 [＋]에서 DCC1 을 넣으면');

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

/* 스텁 — 암복호와 화면 그리기는 이 검사의 관심사가 아니다.
   ⚠ decryptCode 는 **DCC1 이면 성공**하도록만 흉내낸다. 형식 갈래가 제대로 걸리는지가 요점. */
const probe = `
;globalThis.__K = (()=>{
  const toasts = [];
  toast = (m)=>{ toasts.push(String(m)); };
  renderLauncher = ()=>{};
  saveSlots = ()=>{};
  saveCurSlot = ()=>{};
  decryptCode = async (code)=>{
    if(!/^DCC1\\./.test(code)) throw new Error('format');
    return { type:'creator', skin:0, face:{}, blink:{}, top:'#fff', bot:'#fff' };
  };
  return {
    toasts,
    slots,
    setCur:(v)=>{ curSlot = v; },
    getCur:()=>curSlot,
    setRaceTarget:(v)=>{ _raceTargetSlot = v; },
    importCloneCode,
    decryptCommission,
    commGo: document.getElementById('commImpGo').onclick,
    setCommFields:(c,p)=>{ document.getElementById('commImpCode').value=c;
                           document.getElementById('commImpPass').value=p; },
    MAX: CHAR_SLOT_MAX,
  };
})();`;

const _log = console.log, _warn = console.warn;
console.log = () => {}; console.warn = () => {};
try { vm.runInThisContext(SRC + probe, { filename: 'app.js' }); }
catch (e) { console.log = _log; say('  ✗ app.js 평가 실패: ' + (e && e.stack || e)); process.exit(1); }
console.log = _log; console.warn = _warn;

const K = globalThis.__K;
const DCC = 'DCC1.' + 'A'.repeat(64);
const DCM = 'DCM1.' + 'A'.repeat(64);
const DCK = 'DCK1.desk.' + 'A'.repeat(64);

function reset(target){
  for (let i = 0; i < K.MAX; i++) K.slots[i] = null;
  K.toasts.length = 0;
  K.setCur(0);
  K.setRaceTarget(target);
  K.setCommFields('', '');
}
const lastToast = () => K.toasts[K.toasts.length - 1] || '(없음)';

(async () => {
  /* ── (ㄱ) 옛 경로가 정말 튕겼는지 — 이 검사가 재현하려는 함정 ───────── */
  reset(0);
  let threw = null;
  try { await K.decryptCommission(DCC, 'pw'); } catch (e) { threw = e && e.message; }
  chk(threw === 'format',
      '★ 옛 경로(decryptCommission)는 DCC1 을 형식 오류로 튕긴다 — 제보의 함정이 실재했다');

  /* ── (ㄴ) 지금 코드: 빈 칸 3번 [＋]에서 DCC1 ─────────────────────── */
  reset(2);
  K.setCommFields(DCC, 'pw');
  await K.commGo();
  chk(!!K.slots[2], '★ [＋]로 고른 3번 칸에 캐릭터가 들어갔다');
  chk(K.slots.filter(Boolean).length === 1, '다른 칸은 건드리지 않았다');
  chk(K.getCur() === 2, '보고 있는 칸도 그 칸으로 옮겨진다');
  chk(!/코드나|비밀번호를 확인/.test(K.toasts.join('|')),
      '실패 문구가 안 뜬다 (' + lastToast() + ')');

  /* ── (ㄷ) [＋]가 5번 칸이어도 — 3→5 확장 잔재가 남으면 여기서 갈린다 ── */
  reset(K.MAX - 1);
  K.setCommFields(DCC, 'pw');
  await K.commGo();
  chk(!!K.slots[K.MAX - 1], '★ 마지막 칸(' + K.MAX + '번)도 그 칸에 그대로 들어간다');

  /* ── (ㄹ) forceSlot 이 없으면 예전 규칙(현재 칸 → 없으면 첫 빈 칸) ──── */
  reset(null);
  K.setCur(1);
  await K.importCloneCode(DCC, 'pw', null);
  chk(!!K.slots[1], '칸이 확정되지 않았으면 보고 있는 빈 칸에 들어간다');

  reset(null);
  K.slots[0] = { type: 'creator' };
  K.setCur(0);
  await K.importCloneCode(DCC, 'pw', null);
  chk(!!K.slots[1] && K.slots.filter(Boolean).length === 2,
      '보고 있는 칸이 차 있으면 첫 빈 칸으로 간다 (덮어쓰지 않는다)');

  /* ── (ㅁ) 이미 찬 칸이 forceSlot 으로 들어와도 덮어쓰지 않는다 ──────── */
  reset(0);
  K.slots[0] = { type: 'creator' };
  const before = K.slots[0];
  await K.importCloneCode(DCC, 'pw', 0);
  chk(K.slots[0] === before, '★ 확정된 칸이 이미 차 있으면 덮어쓰지 않는다');
  chk(!!K.slots[1], '   대신 빈 칸으로 비켜 간다');

  /* ── (ㅂ) 형식별 안내가 갈라지는가 ─────────────────────────────── */
  reset(0);
  K.setCommFields(DCK, 'pw');
  await K.commGo();
  chk(/책상·아이템/.test(lastToast()), '책상·아이템 코드는 그렇게 말해 준다 (' + lastToast() + ')');
  chk(!K.slots.some(Boolean), '   그리고 아무 칸도 안 건드린다');

  reset(0);
  K.setCommFields('그냥아무거나', 'pw');
  await K.commGo();
  chk(/형식/.test(lastToast()), '형식이 아니면 암호 탓을 하지 않는다 (' + lastToast() + ')');

  reset(0);
  K.setCommFields(DCM, 'pw');
  await K.commGo();
  chk(!/형식이 아니에요/.test(lastToast()), 'DCM1 은 여전히 커미션 경로로 내려간다 (' + lastToast() + ')');

  say('');
  if (fail) { say('문제 ' + fail + '건'); process.exit(1); }
  say('전부 통과 ✅ — 두 입구가 같은 등록 구현을 쓰고, [＋]로 고른 칸이 그대로 지켜진다');
  process.exit(0);   // app.js 가 띄운 타이머·구독이 남아 프로세스가 안 끝나는 것을 막는다
})();
