/* sim-purikura-net.js — 📷 스티커사진 순수 계산(purikura-net.js) 검사 — 날짜 · 정원 셈 · 좌표 부호화
   실행: node sim-purikura-net.js   (purikura-net.js 와 같은 폴더에서)
     §1 하루 경계가 한국 시간 자정인가 · 안내 문구가 여는 시각을 따라가는가
     §2 정원 셈이 정확히 1씩 오르고 상한에서 멈추는가 · 날이 바뀌면 되살아나는가
     §3 좌표 · 시선 · 몸 회전을 한 줄로 싣고 읽는가(옛 두 칸 값도 안 깨진다)
     §4 남은 횟수 문구
   세션(자리 · 방장 · 좌표를 언제 보내는가 · 사건 · 나가기) · 정원 읽기는 세션 포트 검사 sim-purikura-rt.js 가 본다. */
'use strict';
const P = require('./purikura-net.js');
/* ⚠️ 하루 상한을 **숫자로 적지 않는다.** 예전에는 200 을 스무 군데에 박아 뒀는데, 상한이
   400 으로 바뀌자 검사가 열다섯 줄을 한꺼번에 틀렸다고 우겼다 — 코드는 멀쩡한데 검사만 낡은,
   audit 검사 17 이 막으려는 바로 그 모양이다. 상한은 purikura-net.js 한 곳에서만 나오고
   (CAP_PER_DAY), 규칙 파일의 400 과 맞는지는 sim-purikura-rules.js 가 따로 본다. */
const CAP = P.CAP_PER_DAY;

let fail = 0;
const say = console.log;
const chk = (c, m) => { say((c ? '  ✓ ' : '  ✗ ') + m); if(!c) fail++; };
const KST = 9 * 3600 * 1000, DAY = 86400000;
/* 한국 시간 문자열 → UTC ms */
const kst = s => Date.parse(s + '+09:00');

(function(){
say('=== 📷 스티커사진 · 순수 계산 ===\n');

/* ── §1 하루의 경계 ─────────────────────────────────────────────── */
say('· §1 하루의 경계는 한국 시간 자정인가');
{
  const a = P.kstDay(kst('2026-03-14T23:59:59'));
  const b = P.kstDay(kst('2026-03-15T00:00:01'));
  chk(a !== b, '★ 밤 12시를 지나면 날이 바뀐다');
  chk(P.kstDay(kst('2026-03-15T00:00:01')) === P.kstDay(kst('2026-03-15T23:00:00')),
      '같은 날 안에서는 값이 같다');
  chk(b - a === DAY, '하루 차이는 정확히 86400000');

  /* 서버 규칙이 검사할 세 조건 — 여기가 어긋나면 규칙이 쓰기를 전부 거부한다 */
  const now = kst('2026-03-15T14:00:00'), d = P.kstDay(now);
  chk(d % DAY === 0,        '★ 값이 하루(ms)의 배수다 (규칙 조건 ①)');
  chk(d <= now + KST,       '★ now+9h 보다 작다 (규칙 조건 ②)');
  chk(d >  now + KST - DAY, '★ now+9h-24h 보다 크다 (규칙 조건 ③)');

  const t = P.reopenAt(kst('2026-03-15T14:00:00'));
  chk(t === kst('2026-03-16T00:00:00'), '다시 여는 시각 = 다음 날 0시');
  chk(/내일 0시/.test(P.closedMessage(kst('2026-03-15T14:00:00'))),
      '안내 문구: ' + P.closedMessage(kst('2026-03-15T14:00:00')));
  chk(P.closedMessage(kst('2026-03-15T23:59:00')).indexOf('0시') > 0,
      '자정 직전에도 문구가 안 깨진다');
}
say('');

/* ── §2 하루 정원 ───────────────────────────────────────────────── */
say('· §2 하루 ' + CAP + '회에서 멈추는가');
{
  const day = P.kstDay(kst('2026-03-15T10:00:00'));
  chk(JSON.stringify(P.quotaNext(null, day)) === JSON.stringify({day:day, n:1}),
      '아무것도 없으면 1 로 시작한다');
  chk(P.quotaNext({day:day, n:7}, day).n === 8, '정확히 1 씩 오른다');
  chk(P.quotaNext({day:day, n:CAP-1}, day).n === CAP, (CAP-1) + ' → ' + CAP + ' 은 통과');
  chk(P.quotaNext({day:day, n:CAP}, day) === null, '★ ' + CAP + ' 에서 막힌다');
  chk(P.quotaNext({day:day, n:5000}, day) === null, '넘겨 들어와도 막힌다');

  const prev = day - DAY;
  chk(P.quotaNext({day:prev, n:CAP}, day).n === 1, '★ 날이 바뀌면 1 로 되살아난다');
  chk(P.quotaNext({day:prev, n:CAP}, day).day === day, '  날짜도 오늘로 바뀐다');
  chk(P.quotaNext({day:day + DAY, n:3}, day) === null,
      '★ 저장된 날이 미래면 아무것도 안 한다 (내 시계가 뒤에 있는 경우)');

  chk(P.quotaLeft(null, day) === CAP, '기록이 없으면 ' + CAP + ' 남음');
  chk(P.quotaLeft({day:day, n:CAP}, day) === 0, '다 쓰면 0');
  chk(P.quotaLeft({day:prev, n:CAP}, day) === CAP, '어제 기록은 오늘 남은 수에 안 센다');
}
say('');

/* ── §3 시선 인코딩 ───────────────────────────────────────────── */
say('· §3 시선을 좌표 문자열에 얹기');
{
  chk(P.encPos(-0.42, 1.31) === '-42,131', '시선이 없으면 예전과 똑같은 두 칸이다');
  chk(P.encPos(-0.42, 1.31, 0, 0, 0) === '-42,131',
      '★ 정면을 보고 정면으로 서 있으면 칸을 안 늘린다 (안 쓰는 사람에게 바이트를 안 물린다)');
  const five = P.encPos(-0.42, 1.31, 0.35, -0.2, 1.5);
  chk(five === '-42,131,35,-20,75', '★ 꼬리는 셋이 한 덩이다 (시선 둘 + 몸 회전) — ' + five);
  const d = P.decPos(five);
  chk(Math.abs(d.wx+0.42) < 1e-9 && Math.abs(d.d-1.31) < 1e-9, '읽어도 좌표가 그대로다');
  chk(Math.abs(d.gz-0.35) < 1e-9 && Math.abs(d.gp+0.2) < 1e-9, '시선도 그대로다');
  chk(Math.abs(d.yaw-1.5) < 0.02, '몸 회전도 그대로다 (' + P.YAW_Q + '단위 = ' +
      (180/Math.PI/P.YAW_Q).toFixed(1) + '° 눈금)');
  chk(P.encPos(1, 2, 0, 0, 0.6) === P.encPos(1, 2, 0.0, 0.0, 0.6),
      '몸만 돌려도 꼬리가 붙는다 (시선이 0 이어도 셋이 함께 간다)');
  const old = P.decPos('-42,131');
  chk(old.gz === 0 && old.gp === 0 && old.yaw === 0,
      '★ 두 칸만 온 값(옛 클라이언트)은 정면으로 읽는다 — 안 깨진다');
  const worst = P.encPos(-2.24, 5.4, -1, -1, -Math.PI);
  chk(worst.length <= 24,
      '★ 가장 긴 경우가 ' + worst.length + '자다 — 규칙의 길이 상한 24 안이다 (' + worst + ')');
  chk(P.decPos('rubbish') === null && P.decPos(null) === null, '이상한 값은 null 이다');
}
say('');

/* ── §4 남은 횟수 표시 ──────────────────────────────────────────── */
say('· §4 남은 횟수 문구');
{
  const day = P.kstDay(kst('2026-03-15T10:00:00'));
  const FULL = CAP + ' / ' + CAP;
  chk(P.quotaLabel(null, day) === FULL, '아무도 안 찍었으면 ' + FULL);
  chk(P.quotaLabel({day:day, n:5}, day) === (CAP-5) + ' / ' + CAP, '5회 찍었으면 ' + (CAP-5) + ' / ' + CAP);
  chk(P.quotaLabel({day:day, n:CAP}, day) === '0 / ' + CAP, '다 쓰면 0 / ' + CAP);
  chk(P.quotaLabel({day:day - DAY, n:CAP}, day) === FULL,
      '★ 자정이 지나면 아무도 안 써도 ' + CAP + ' 으로 돌아온다 (새벽에 0 이 그대로 떠 있으면 안 된다)');
  chk(P.nthLabel(5) === '5번째 · ' + (CAP-5) + '회 남음', '차감 직후 문구: ' + P.nthLabel(5));
  chk(P.nthLabel(CAP) === CAP + '번째 · 0회 남음', '마지막 한 장: ' + P.nthLabel(CAP));

}
say('');

if(fail){ say('문제 ' + fail + '건'); process.exit(1); }
say('전부 통과 ✅ — 날짜 · 정원 셈 · 좌표 부호화가 약속대로다');
process.exit(0);
})();
