/* sim-exp-bar-color.js — ⭐ 경험치 바가 홈 바탕에 묻히지 않는가
   실행:  node sim-exp-bar-color.js   (desk-companion-prototype.html 과 같은 폴더에서)

   ★ 왜 이 검사가 있는가 — 제보: "21레벨부터 나오는 은색 게이지가 기본 테마에서 안 보인다."
     안 찬 구간은 `--win-face`(홈 바탕)이다. 기본 테마에서 그 값이 #C0C0C0 인데 t2 바가
     #AFB8C0 이었다 — **색 거리 ΔE 6.3.** 다른 색을 칠한 게 아니라 같은 색을 칠하고 있었다.

   ★ 재는 것은 **밝기 대비가 아니라 색 거리(ΔE76)** 다. 이게 이 파일의 요점이다.
     처음엔 WCAG 명도 대비로 짰는데, 그 지표는 **채도가 높은 색이 회색 위에서 얼마나 잘 보이는지를
     크게 과소평가한다.** 실제로 t3(금색 #E0AA22)은 명도 대비가 1.16 이라 t2 의 옛 값(1.11)과
     거의 같게 나왔지만, 색 거리로는 **70.7** 로 아주 멀다 — 회색 홈 위의 노란 띠는 잘 보인다.
     명도만 보고 금색까지 손댔다면 t1(갈색)과 밝기가 겹치는 새 사고를 만들었을 것이다.
     ⚠️ 그래서 이 검사에 명도 대비를 다시 끌어오지 말 것. 참고로 함께 찍기만 한다.

   ★ **두 테마를 함께 넘겨야 한다.**
       기본 홈 #C0C0C0 (중간 회색) · 버블 홈 #EEF1EA (거의 흰색)
     한쪽만 보고 고르면 반대쪽에서 사라진다. '밝은 은색(#F2F5F8)' 안이 그래서 버려졌다 —
     기본에서는 ΔE 18.8 로 보이지만 버블에서 **5.4** 다(옛 t2 가 앓던 그 병을 반대 테마에서).

   ⚠ 여기서 재는 것은 색 거리뿐이다. '은색으로 읽히는가'는 눈으로 볼 일이다.
   ⚠ t7 이상은 대상이 아니다 — 그라데이션·다색이고 lvglow 로 홈 밖까지 빛이 샌다. */
'use strict';
const fs = require('fs');
const HTML = fs.readFileSync('desk-companion-prototype.html', 'utf8');
const say = console.log;
let fail = 0;
const chk = (c, m) => { say((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };

/* 문턱 — 제보에서 유도한 값이다. 앓던 값 6.3(과 반대 테마의 5.4)은 확실히 걸러야 하고,
   지금 멀쩡한 티어 중 가장 가까운 것이 34.8 이다. 그 사이에 넉넉히 둔다. */
const MIN_DE = 25;
const MIN_NEIGHBOR_DE = 25;   // 티어끼리도 이만큼은 떨어져 있어야 '다른 색'으로 읽힌다

function lab(hex){
  const h = hex.replace('#', '');
  const f = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const [r, g, b] = [0, 2, 4].map(i => f(parseInt(h.slice(i, i + 2), 16) / 255));
  const X = (r*0.4124 + g*0.3576 + b*0.1805) / 0.95047;
  const Y =  r*0.2126 + g*0.7152 + b*0.0722;
  const Z = (r*0.0193 + g*0.1192 + b*0.9505) / 1.08883;
  const k = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [k(X), k(Y), k(Z)];
  return [116*fy - 16, 500*(fx - fy), 200*(fy - fz)];
}
const dE = (a, b) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]));
/* 참고용으로만 찍는 명도 대비 — 판정에 쓰지 않는다(머리말 참고). */
function contrast(a, b){
  const rel = hex => {
    const h = hex.replace('#', '');
    const v = [0, 2, 4].map(i => {
      const c = parseInt(h.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126*v[0] + 0.7152*v[1] + 0.0722*v[2];
  };
  const [x, y] = [rel(a), rel(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/* 홈 바탕은 소스에서 읽는다 — 테마 값이 바뀌면 이 검사도 함께 따라와야 한다.
   숫자를 여기 박아두면 테마를 손본 다음 세션에 조용히 낡는다. */
function face(re, name){
  const m = re.exec(HTML);
  if(!m) throw new Error(name + ' 의 --win-face 를 못 찾음');
  return m[1];
}
const FACE_CLASSIC = face(/--win-face:\s*(#[0-9A-Fa-f]{6})/, '기본 테마');
const FACE_BUBBLE  = face(/--win-face:var\(--acc-face,\s*(#[0-9A-Fa-f]{6})\)/, '버블 테마');

/* 티어 토큰에서 --lv-bar 를 읽는다. 단색(#hex)인 티어만 잡힌다. */
const bars = {};
const reBlock = /\.mh-flv\.(t\d+),\s*\.seat-exp\.\1\{([\s\S]*?)\}/g;
let m;
while((m = reBlock.exec(HTML))){
  const hex = /--lv-bar:\s*(#[0-9A-Fa-f]{6})\s*;/.exec(m[2]);
  if(hex) bars[m[1]] = hex[1];
}
const tiers = Object.keys(bars).sort((a, b) => +a.slice(1) - +b.slice(1));

say('=== ⭐ 경험치 바 색 검사 (색 거리 ΔE76) ===');
say('');
say('· 홈 바탕 — 기본 ' + FACE_CLASSIC + ' · 버블 ' + FACE_BUBBLE + ' · 문턱 ΔE ' + MIN_DE);
chk(tiers.length >= 6, '단색 바 티어를 읽었다 (' + tiers.length + '개)');
say('');

/* 표를 먼저 다 찍는다 — "통과했는데 실은 아무것도 안 봤다"가 이 종류 검사에서 제일 위험하다. */
say('· 티어별 (괄호는 참고용 명도 대비 — 판정에 안 쓴다)');
tiers.forEach(t=>{
  say('    ' + t.padEnd(4) + bars[t]
    + '  기본 ΔE ' + dE(bars[t], FACE_CLASSIC).toFixed(1).padStart(5)
    + ' (' + contrast(bars[t], FACE_CLASSIC).toFixed(2) + ')'
    + '  버블 ΔE ' + dE(bars[t], FACE_BUBBLE).toFixed(1).padStart(5)
    + ' (' + contrast(bars[t], FACE_BUBBLE).toFixed(2) + ')');
});
say('');

say('· 판정 — 홈 바탕에 묻히지 않는가');
tiers.forEach(t=>{
  const c = dE(bars[t], FACE_CLASSIC), b = dE(bars[t], FACE_BUBBLE);
  chk(c >= MIN_DE && b >= MIN_DE,
      t + ' (기본 ' + c.toFixed(1) + ' · 버블 ' + b.toFixed(1) + ')');
});

say('');
say('· 판정 — 제보의 그 자리');
chk(bars.t2 !== '#AFB8C0', '★ t2 가 옛 값(#AFB8C0)으로 되돌아가지 않았다');
chk(dE('#AFB8C0', FACE_CLASSIC) < MIN_DE,
    '   그 값이 실제로 문턱 아래다 (ΔE ' + dE('#AFB8C0', FACE_CLASSIC).toFixed(1) + ') — 문턱이 헐거워지지 않았다');
chk(dE('#F2F5F8', FACE_BUBBLE) < MIN_DE,
    '★ 밝은 은색(#F2F5F8)도 문턱 아래로 잡힌다 (버블 ΔE ' + dE('#F2F5F8', FACE_BUBBLE).toFixed(1)
      + ') — 밝은 쪽으로 도망가면 걸린다');
chk(lab(bars.t2)[0] < lab(FACE_CLASSIC)[0],
    '   그래서 t2 는 홈 바탕보다 어두운 쪽에 있다');

say('');
say('· 판정 — 티어끼리도 다른 색인가 (문턱 ΔE ' + MIN_NEIGHBOR_DE + ')');
{
  let worst = null;
  for(let i = 0; i < tiers.length; i++){
    for(let j = i + 1; j < tiers.length; j++){
      const d = dE(bars[tiers[i]], bars[tiers[j]]);
      if(!worst || d < worst.d) worst = { a:tiers[i], b:tiers[j], d };
    }
  }
  chk(worst && worst.d >= MIN_NEIGHBOR_DE,
      '★ 가장 가까운 두 티어도 떨어져 있다 — ' + worst.a + ' ↔ ' + worst.b
      + ' ΔE ' + worst.d.toFixed(1));
  /* ⚠️ 이 판정이 있는 이유: 바를 보이게 만들려고 어둡게 밀다 보면 언젠가 t1(갈색)과
     겹친다. 실제로 "금색을 짙게" 안을 검토했을 때 t1 과의 거리가 그 이유로 무너졌다. */
}

say('');
if (fail){ say('문제 ' + fail + '건'); process.exit(1); }
say('전부 통과 ✅ — 바가 홈 바탕에 묻히지 않고, 티어끼리도 다른 색이다');
process.exit(0);
