/* sim-char-z.js — 🐾 캐릭터 앞뒤(z) 규약 검사 (핸드오프 4절 ㈏ "책상을 옮긴다")
   실행:  node sim-char-z.js   (app.js 와 같은 폴더에서)

   ★ 왜 이 검사가 있는가 — 동물이 사람보다 "조금 높게" 떠 보였다.
     [실측] 사람·동물 **둘 다 발 박스가 정확히 y=0** 이었다. 그런데 화면에서는 갈렸다.
     정체는 y 가 아니라 **z** 였다. 예전 `seatCharZ` 는 캐릭터의 앞뒤 자리에
     동물 배율(0.4)과 평준화 배율(k)을 곱했다 →
         사람 z = -0.47 · 동물 z = -0.188  (차이 0.282)
     카메라가 +z 에서 pitch 0.09 로 내려다보므로 바닥 위의 같은 점도 멀수록 화면에서 위로
     잡힌다: 0.282 × sin(0.09) ≒ 0.025 = 캐릭터 키의 4~5%. 딱 "조금 높게"다.

   ★ 이 검사의 요점은 **"캐릭터 z 는 좌석마다 같다"** 는 한 줄이다.
     sim-char-foot.js 가 "네 화면이 같은 발바닥 보정을 쓴다"를 지키듯, 이건
     "배율은 캐릭터가 아니라 책상이 진다"를 지킨다. 이 원칙이 무너지는 순간
     같은 바닥에 선 캐릭터들이 다시 서로 다른 줄에 그려진다.

   ★ 무엇을 보는가 (세 층)
     §1 소스 대조 — seatCharZ 가 배율을 안 곱하는가 · 보정을 다시 거는 자리가 넷 다인가 ·
        평준화에서 **조건 없이** 부르는가 · deskPosBase 에 보정항이 안 섞이는가
     §2 런타임 — seatDeskZCorr·syncSeatDeskZ 를 app.js 에서 **원본 그대로 떼어내** 숫자로 돌린다.
        사람·k=1 → 정확히 0 (한 픽셀도 안 움직인다) · 동물 → 간격 보존 · undefined → 1 로 읽힘
     §3 규약 — 실행의 캐릭터↔책상 간격과 꾸미기 미리보기의 간격이 **같은 식인가.**
        (나중에 한쪽만 고치는 걸 막는다 — 그게 이 코드에서 반복된 사고다)

   ⚠ three.js·DOM 은 안 본다. 여기서 지키는 것은 규약과 산수뿐이다.
   ⚠ **합격 판정은 눈으로 볼 것** — 실행 화면 콘솔에서 좌석별 발점을 화면 픽셀로 투영해
     그 값이 전부 같으면 성공이다(핸드오프 2절 끝의 스니펫). */
'use strict';
const fs = require('fs');
const SRC = fs.readFileSync('app.js', 'utf8');
const say = console.log;
let fail = 0;
const chk = (c, m) => { say((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };

/* 함수 하나를 중괄호 짝맞추기로 떼어낸다 (sim-char-foot.js 와 같은 방식) */
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

const CHAR_Z = +(/const\s+CHAR_Z\s*=\s*(-?[\d.]+)/.exec(SRC) || [])[1];
const ANIM   = +(/const\s+ANIMAL_RUN_SCALE\s*=\s*([\d.]+)/.exec(SRC) || [])[1];
const near = (a, b) => Math.abs(a - b) < 1e-12;

say('=== 🐾 캐릭터 앞뒤(z) 규약 검사 ===');
say('');

/* ── §1. 소스 대조 ───────────────────────────────────────────────── */
say('· §1 소스 대조 — 배율이 캐릭터에 다시 붙지 않았는가');

chk(isFinite(CHAR_Z) && isFinite(ANIM),
    '상수를 읽었다 (CHAR_Z = ' + CHAR_Z + ' · ANIMAL_RUN_SCALE = ' + ANIM + ')');

const charZ = cut('seatCharZ');
chk(!/ANIMAL_RUN_SCALE/.test(charZ),
    '★ seatCharZ 가 동물 배율을 안 곱한다 — 좌석마다 깊이가 갈리던 원인');
chk(!/seatEqK/.test(charZ),
    '★ seatCharZ 가 평준화 배율(k)을 안 곱한다 — 사람끼리도 갈리던 원인');
chk(/return\s+CHAR_Z\s*;/.test(charZ),
    '★ seatCharZ 는 CHAR_Z 하나를 돌려준다 (좌석마다 같다)');

chk((SRC.match(/function\s+syncSeatDeskZ\s*\(/g) || []).length === 1,
    'syncSeatDeskZ 정의가 하나다');
chk((SRC.match(/function\s+seatDeskZCorr\s*\(/g) || []).length === 1,
    'seatDeskZCorr 정의가 하나다 — 보정항 공식이 한 벌');

/* 보정을 다시 거는 자리 넷 — 하나만 빠져도 그 경로에서만 발선이 갈린다.
   ⚠️ 이 넷이 이 작업의 전부다. 새 경로가 생기면 여기에 줄을 더할 것. */
[
  ['setDeskPos',        '책상을 옮길 때(기즈모 드래그 포함)'],
  ['setDeskScale',      'animCorr·eqK 가 화면에 반영되는 유일한 길목'],
  ['syncSeatEqualize',  '평준화를 켜고 끌 때'],
  ['applyCharToSeat',   '캐릭터를 갈아끼울 때(인간↔동물)'],
].forEach(([n, why]) => {
  chk(/syncSeatDeskZ\s*\(/.test(cut(n)), '★ ' + n + ' 가 보정을 다시 건다 — ' + why);
});

/* 함정(ㄱ) — deskPosBase 는 '책상을 옮겨본 적 있는 사람'에게만 있다.
   그 조건 안에 보정이 갇히면 대부분의 유저에게 안 걸린다. */
{
  const eq = cut('syncSeatEqualize');
  const call = eq.indexOf('syncSeatDeskZ(');
  const guard = eq.indexOf('if(_pb)');
  chk(call > -1 && (guard === -1 || call > eq.indexOf('setDeskPos(seat.desk, _pb)')),
      '★ 평준화에서는 **조건 없이** 부른다 — deskPosBase 가 없는 좌석(대부분)도 보정받는다');
}

/* 함정(ㄴ) — 보정항은 파생값이다. base 에 섞이면 열 때마다 누적된다. */
{
  const body = cut('syncSeatDeskZ') + cut('seatDeskZCorr');
  chk(!/deskPosBase\s*(\.\w+)?\s*=[^=]/.test(body),
      '★ deskPosBase 에 쓰지 않는다 — 보정이 저장값에 누적되지 않는다');
  chk(/position\.z\s*=/.test(cut('syncSeatDeskZ')),
      '   보정은 position.z 에만 얹는다');
}

/* 함정(ㄷ) — position 을 바꾼 뒤 파츠 상쇄를 안 갱신하면 책상 위 파츠만 어긋난다. */
chk(/syncDeskPartAnchor\s*\(/.test(cut('syncSeatDeskZ')),
    '★ 파츠 상쇄(syncDeskPartAnchor)를 이어서 부른다 — 네 경로가 이 한 줄을 함께 쓴다');

/* 되돌아오면 안 되는 것 — 발바닥(y) 보정은 이 작업과 무관하다. 실측이 이미 맞다고 말한다. */
chk(/charFootFix/.test(SRC), '🦶 발바닥 보정(charFootFix)은 그대로 살아 있다 — y 는 건드리지 않았다');

say('');

/* ── §2. 런타임 ──────────────────────────────────────────────────── */
say('· §2 런타임 — 떼어낸 보정 공식에 실제 값을 넣어 본다');

let pinCalls = 0;
/* ⚠️ 떼어낼 함수를 **app.js 가 부르는 것 전부** 같이 떼어내야 한다.
     syncSeatDeskZ 가 나중에 seatDeskPosMul 을 부르기 시작했는데 여기 목록에 없어서
     이 검사가 ReferenceError 로 죽어 있었다 — 검사가 죽으면 지키는 게 없는 것과 같다.
     app.js 쪽에서 헬퍼가 하나 늘면 이 줄에도 한 칸 늘려야 한다. */
const { seatDeskZCorr, syncSeatDeskZ, seatDeskPosMul } = new Function(
  'CHAR_Z', 'syncDeskPartAnchor',
  cut('seatDeskPosMul') + '\n' + cut('seatDeskZCorr') + '\n' + cut('syncSeatDeskZ') +
  '\n;return { seatDeskZCorr, syncSeatDeskZ, seatDeskPosMul };'
)(CHAR_Z, () => { pinCalls++; });

const desk = (ud) => ({ position:{ x:0, y:0, z:0 }, userData: ud || {} });

// (ㄱ) 가장 흔한 경우 — 사람 · 평준화 꺼짐. **한 픽셀도 안 움직여야 한다.**
{
  const d = desk({ animCorr:1, eqK:1, deskPosBase:{ x:0, y:0, z:0 } });
  syncSeatDeskZ(d);
  chk(near(seatDeskZCorr(d), 0), '★ 사람·k=1 → 보정항이 정확히 0 (' + seatDeskZCorr(d) + ')');
  chk(near(d.position.z, 0), '   책상도 제자리 — 대부분의 유저에게 아무 변화가 없다');
}

// (ㄴ) 동물 · k=1 — 4-2 검산표 그대로
{
  const d = desk({ animCorr:ANIM, eqK:1, deskPosBase:{ x:0, y:0, z:0 } });
  syncSeatDeskZ(d);
  const want = CHAR_Z * (1 - ANIM);                 // -0.47 × 0.6 = -0.282
  chk(near(seatDeskZCorr(d), want), '★ 동물·k=1 → CHAR_Z×(1−0.4) = ' + want.toFixed(3));
  chk(near(d.position.z, want), '   책상이 그만큼 뒤로 간다 (' + d.position.z.toFixed(3) + ')');
  // ★ 이 검사의 심장 — 간격이 보존되는가
  const gapOld = 0 - CHAR_Z * ANIM * 1;             // 옛 규약: 책상 0, 캐릭터 -0.188
  const gapNew = d.position.z - CHAR_Z;             // 새 규약: 캐릭터 -0.47
  chk(near(gapOld, gapNew),
      '★ 캐릭터↔책상 간격이 그대로다 (' + gapOld.toFixed(3) + ' = ' + gapNew.toFixed(3) + ')');
  chk(d.position.z > CHAR_Z, '   책상이 캐릭터보다 카메라 쪽이라는 앞뒤 관계도 그대로다');
}

// (ㄷ) 평준화 — 사람끼리도 k 가 다르면 갈렸다. 같은 식이 그쪽도 고친다.
{
  [0.7, 1.3].forEach(k => {
    const d = desk({ animCorr:1, eqK:k, deskPosBase:{ x:0, y:0, z:0 } });
    syncSeatDeskZ(d);
    const gapOld = 0 - CHAR_Z * 1 * k, gapNew = d.position.z - CHAR_Z;
    chk(near(gapOld, gapNew), '★ 평준화 k=' + k + ' 에서도 간격이 보존된다');
  });
}

// (ㄹ) 동물 + 평준화 + 책상을 옮겨둔 사람 — 세 항이 한꺼번에 걸리는 최악의 경우
{
  const k = 1.25, base = { x:0.1, y:0.05, z:0.3 };
  const d = desk({ animCorr:ANIM, eqK:k, deskPosBase:base });
  syncSeatDeskZ(d);
  /* ★ 간격의 정체 = (책상 원위치 − CHAR_Z) × (animCorr × eqK).
       position.z = base.z·A·K + CHAR_Z(1 − A·K) 이므로 CHAR_Z 를 빼면 위 식이 그대로 남는다.
       즉 **좌석이 통째로 몇 배로 줄든 간격도 같은 배로 준다** — 그게 보존의 뜻이다.
     ⚠️ 예전 이 줄은 base.z 에 eqK 만 곱했다(`base.z*k`). 그 사이 app.js 가 deskPos 에
       animCorr 까지 곱하도록 고쳐졌는데, 이 검사가 ReferenceError 로 죽어 있어서 아무도 몰랐다.
       '검사가 죽어 있는 동안 규약이 바뀐' 사례다 — 실패를 방치하면 이렇게 된다. */
  const want = (base.z - CHAR_Z) * (ANIM * k), gapNew = d.position.z - CHAR_Z;
  chk(near(want, gapNew), '★ 동물+평준화+옮겨둔 책상 — 간격이 (원위치−CHAR_Z)×배율 로 보존된다 (' + gapNew.toFixed(3) + ')');
  chk(base.z === 0.3 && base.x === 0.1,
      '★ deskPosBase 는 손대지 않았다 (' + base.z + ') — 다음에 열 때 밀리지 않는다');
}

// (ㅁ) 값이 없을 때 — 생성기(cDesk)·런처(lHolder.desk)·아직 def 가 안 얹힌 좌석
{
  chk(near(seatDeskZCorr(desk({})), 0), 'animCorr·eqK 가 없으면(undefined) 1 로 읽는다 → 보정 0');
  chk(near(seatDeskZCorr(desk({ animCorr:0, eqK:0 })), 0), '0 이나 이상값도 1 로 읽는다 (0 으로 나눠 죽지 않는다)');
  const d = desk({});                       // base 도 보정도 없다 = 생성기 기즈모가 쓰는 상태
  d.position.z = 0.42;                      // 기즈모가 직접 써 둔 값
  syncSeatDeskZ(d);
  chk(near(d.position.z, 0.42),
      '★ base 도 보정도 없으면 position.z 를 안 건드린다 — 기즈모가 직접 쓴 값을 0 으로 덮지 않는다');
  chk(seatDeskZCorr(null) === 0, 'null 이어도 0 (모델이 아직 안 붙은 프레임)');
}

// (ㅂ) 파츠 상쇄가 매번 따라 도는가
{
  pinCalls = 0;
  syncSeatDeskZ(desk({ animCorr:ANIM, eqK:1, deskPosBase:{ x:0, y:0, z:0 } }));
  chk(pinCalls === 1, '★ 부를 때마다 파츠 상쇄가 한 번 따라 돈다 (' + pinCalls + '회)');
}

say('');

/* ── §3. 규약 대조 ───────────────────────────────────────────────── */
say('· §3 규약 — 실행과 꾸미기 미리보기가 같은 간격을 그리는가');

/* 미리보기는 캐릭터를 z=0 에 두고 **간격만** 인코딩한다: 책상 z = -CHAR_Z·a − xf.z (+deskPos.z)
   실행은 ㈏ 이후 캐릭터가 CHAR_Z, 책상이 deskPos.z·k + CHAR_Z(1−a·k) 다.
   k=1(내 캐릭터만 그리는 미리보기와 같은 조건)에서 두 간격이 같아야 한다. */
chk(/-\s*CHAR_Z\s*\*\s*_wdAnim/.test(SRC),
    '미리보기가 여전히 -CHAR_Z×동물배율 로 간격을 인코딩한다 (규약이 안 바뀌었다)');
[[1, 0], [ANIM, 0], [ANIM, 0.3], [1, -0.2]].forEach(([a, dz]) => {
  const d = desk({ animCorr:a, eqK:1, deskPosBase:{ x:0, y:0, z:dz } });
  syncSeatDeskZ(d);
  const run     = d.position.z - CHAR_Z;      // 실행 간격
  /* ⚠️ dz 에도 배율을 곱한다. 예전엔 두 화면 **모두** deskPos 를 원본 단위로 더했고, 똑같이
       틀렸기 때문에 서로는 일치했다(앞 핸드오프의 "두 식이 일치한다"가 이 상태다).
       그 뒤 양쪽이 함께 고쳐졌다 — 미리보기는 `deskPos × _wdAnim`, 실행은 `deskPos × animCorr·eqK`.
       k=1 이므로 여기서는 `a` 하나가 그 짝이다. */
  const preview = -CHAR_Z * a + dz * a;       // 미리보기 간격 (xf.z 는 폐기되어 0)
  chk(near(run, preview),
      '★ a=' + a + ' · deskPos.z=' + dz + ' → 두 화면의 간격이 같다 (' + run.toFixed(3) + ')');
});

say('');
if (fail){ say('문제 ' + fail + '건'); process.exit(1); }
say('전부 통과 ✅ — 캐릭터는 좌석마다 같은 깊이에 서고, 배율은 책상이 진다');
say('⚠ 최종 판정은 실행 화면에서 좌석별 발점의 화면Y픽셀이 전부 같은지 눈으로 볼 것');
process.exit(0);
