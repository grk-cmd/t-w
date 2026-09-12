/* sim-char-foot.js — 🦶 발바닥 피봇 보정 검사 (핸드오프 5절 결정 반영)
   실행:  node sim-char-foot.js   (app.js 와 같은 폴더에서)

   ★ 왜 이 검사가 있는가 — 사람 캐릭터가 바닥에서 0.02 떠 있었다.
     [실측] 실행 사람 발 0.0202(wrap 0.42) · 0.0245(wrap 0.51)
            0.0202 ÷ 0.42 = 0.0481 · 0.0245 ÷ 0.51 = 0.0480  → **같다**
     크기와 무관한 로컬 상수라는 뜻이고, 정체는 **사람 GLB 의 피봇이 메쉬 바닥보다
     0.048(로컬) 아래**에 있는 것이었다. 파츠도 원피스도 발밑 보정도 아니었다.
     동물은 buildAnimalBase 가 절차적으로 만들어 거의 정확히 0 이라 이 증상이 없었다.

   ★ 이 검사의 요점은 **네 곳이 짝이라는 것**이다.
     fitModel · fitCreator('edit') · fitCreator('app') · refreshWdPreviewChar 는 모두
     "모델 원점 = 발바닥"을 전제로 높이(xf.y)를 얹는다. 한 곳만 보정하면
     **이번에 맞춰 놓은 생성기↔실행 높이가 그 양만큼 다시 갈린다.**
     그래서 §1 은 넷 전부가 charFootFix 를 부르는지만 본다. 이게 이 파일의 존재 이유다.

   ★ 무엇을 보는가 (두 층)
     §1 소스 대조 — 보정 함수가 한 벌인가 · 네 곳이 전부 그걸 부르는가 ·
        예전의 `position.y = 0`(피봇=발바닥 전제)이 되돌아오지 않았는가 ·
        발밑 파츠 보정(measureUnderfootDepth)과 섞이지 않았는가
     §2 런타임 — charFootFix 를 **app.js 에서 원본 그대로 떼어내** 숫자로 돌린다.
        사람(0.048 뜸)·동물(≈0)·이상한 커미션(여분 메쉬로 박스가 튄 경우)을 넣어 본다.

   ⚠ three.js 는 쓰지 않는다. charFootFix 는 박스의 min/max 만 보는 순수 산수라 그럴 필요가 없다.
   ⚠ 실제 화면 좌표(0.0202)는 여기서 재지 못한다 — 그건 눈으로 볼 것. 여기서 지키는 것은
     "넷이 같은 값을 쓴다"는 규약뿐이다. */
'use strict';
const fs = require('fs');
const SRC = fs.readFileSync('app.js', 'utf8');
const say = console.log;
let fail = 0;
const chk = (c, m) => { say((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };

say('=== 🦶 발바닥 피봇 보정 검사 ===');
say('');

/* ── §1. 소스 대조 ───────────────────────────────────────────────── */
say('· §1 소스 대조 — 네 화면이 같은 보정을 쓰는가');

const defCount = (SRC.match(/function\s+charFootFix\s*\(/g) || []).length;
chk(defCount === 1, 'charFootFix 정의가 하나다 (' + defCount + '개)');

/* 함수 하나를 중괄호 짝맞추기로 떼어낸다 */
function cut(name){
  const i = SRC.indexOf('function ' + name + '(');
  if (i < 0) throw new Error(name + ' 를 못 찾음');
  let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++){
    if (SRC[k] === '{') d++;
    else if (SRC[k] === '}'){ d--; if (d === 0) return SRC.slice(i, k + 1); }
  }
  throw new Error(name + ' 의 끝을 못 찾음');
}

const sites = [
  ['fitModel',              cut('fitModel')],
  ['fitCreator',            cut('fitCreator')],
  ['refreshWdPreviewChar',  cut('refreshWdPreviewChar')],
];
sites.forEach(([n, body]) => {
  chk(/charFootFix\s*\(/.test(body), '★ ' + n + ' 가 charFootFix 를 부른다');
});

// fitCreator 는 **두 갈래**(edit · app)다 — 한 갈래만 고치면 얼굴 편집과 책상 단계가 갈린다
const creator = cut('fitCreator');
chk((creator.match(/charFootFix\s*\(/g) || []).length >= 2,
    "★ fitCreator 의 두 갈래('edit'·'app') 가 **둘 다** 보정을 받는다");

// 예전 전제가 되돌아오지 않았는가 — 이 두 줄이 정확히 그 자리였다
chk(!/m\.position\.y\s*=\s*0\s*;/.test(cut('fitModel')),
    "fitModel 에 `m.position.y = 0` 이 돌아오지 않았다");
chk(!/g\.position\.y\s*=\s*0\s*;/.test(creator),
    "fitCreator 에 `g.position.y = 0` 이 돌아오지 않았다");

// 발밑 파츠 보정은 **별개**다 — 섞으면 욕조 깊이만큼 두 번 들린다
chk(cut('fitModel').includes('measureUnderfootDepth'),
    '발밑 파츠 보정(measureUnderfootDepth)은 그대로 남아 있다');
chk(!/charFootFix[\s\S]{0,80}measureUnderfootDepth/.test(cut('charFootFix')),
    '   그리고 charFootFix 안으로 끌려 들어가지 않았다 (두 번 들리지 않는다)');

// 파츠를 세면 모자·욕조에 따라 발 높이가 달라진다 — 몸 박스여야 한다
chk(/charFootFix\(measureCharBox\(|charFootFix\(b2\)/.test(SRC),
    '보정에 넘기는 박스가 몸 박스(measureCharBox / b2)다 — 파츠가 섞이지 않는다');

say('');

/* ── §2. 런타임 ──────────────────────────────────────────────────── */
say('· §2 런타임 — 떼어낸 charFootFix 에 실제 박스를 넣어 본다');

const RATIO = +(/FOOT_FIX_MAX_RATIO\s*=\s*([\d.]+)/.exec(SRC) || [])[1];
chk(isFinite(RATIO), '상한 비율을 읽었다 (몸 높이의 ' + (RATIO * 100).toFixed(0) + '%)');

let warned = [];
const F = new Function('FOOT_FIX_MAX_RATIO', 'console',
  cut('charFootFix') + '\n;return charFootFix;')(RATIO, { warn: m => warned.push(String(m)) });

const box = (lo, hi) => ({ min: { y: lo }, max: { y: hi }, isEmpty(){ return this.max.y < this.min.y; } });
const near = (a, b) => Math.abs(a - b) < 1e-9;

// (ㄱ) 사람 — 피봇이 발바닥보다 0.048 아래. 정규화 키는 1.45.
{
  const d = F(box(0.048, 1.498));
  chk(near(d, -0.048), '★ 사람: 0.048 떠 있으면 그만큼 내린다 (' + d + ')');
  // 실행 화면 환산 — wrap 0.42 면 실측 0.0202 가 사라진다
  chk(Math.abs(0.048 * 0.42 - 0.0202) < 0.0005,
      '   실측과 앞뒤가 맞는다 (0.048 × wrap 0.42 = ' + (0.048 * 0.42).toFixed(4) + ' ≒ 0.0202)');
}

// (ㄴ) 동물 — 절차적으로 만들어 거의 0. 살짝 파묻힌 경우도 같은 식으로 올라온다.
{
  chk(near(F(box(0, 1.45)), 0), '동물: 이미 0 이면 아무것도 안 한다');
  const d = F(box(-0.0018, 1.4482));
  chk(near(d, 0.0018), '동물: 살짝 파묻혀 있으면 그만큼 올린다 (' + d + ')');
}

// (ㄷ) 커미션 — 안 보이는 여분 메쉬로 박스가 튄 경우. 따라가면 캐릭터가 통째로 솟는다.
{
  warned = [];
  const d = F(box(-0.9, 1.45));                   // 바닥이 -0.9 (키의 38%)
  chk(d === 0, '★ 박스가 비정상적으로 튀면 보정을 포기한다 (' + d + ') — 조용히 틀리지 않는다');
  chk(warned.length === 1 && /발바닥/.test(warned[0]), '   그리고 콘솔에 이유를 남긴다');
}

// (ㄹ) 경계 — 상한 바로 안쪽은 보정하고 바깥쪽은 포기한다
{
  const h = 1.45, inside = h * RATIO * 0.99, outside = h * RATIO * 1.01;
  chk(near(F(box(-inside, h - inside)), inside), '상한 바로 안쪽은 보정한다');
  chk(F(box(-outside, h - outside)) === 0, '상한 바로 바깥쪽은 포기한다');
}

// (ㅁ) 빈 박스·이상값에 안 죽는다 — 모델이 아직 안 붙은 프레임이 실제로 있다
{
  chk(F(box(Infinity, -Infinity)) === 0, '빈 박스면 0 (모델이 아직 안 붙은 프레임)');
  chk(F(null) === 0, 'null 이어도 0');
  chk(F(box(NaN, NaN)) === 0, 'NaN 이어도 0');
}

say('');
if (fail){ say('문제 ' + fail + '건'); process.exit(1); }
say('전부 통과 ✅ — 네 화면이 같은 발바닥 규약을 쓴다');
process.exit(0);
