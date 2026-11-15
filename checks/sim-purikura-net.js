/* sim-purikura-net.js — 📷 스티커사진 · 순수 계산 검사(하루 경계 문구 · 좌표 인코딩 · 정원 문구)
   실행: node sim-purikura-net.js   (purikura-net.js 와 같은 폴더에서)

   ★ 0.13 — 세션(자리 · 방장 · 좌표 보내기)과 하루 정원은 서버가 맡고, 그 통신은 purikura-rt.js 다(sim-purikura-rt.js 가 본다).
     이 파일에 남은 것은 THREE 도 DOM 도 통신도 안 쓰는 계산이라 여기서는 그 계산만 굴린다. 요금을 정하던 Firebase 시절의 약속
     (트랜잭션 정원 · 하트비트 · 죽은 자리 걷기)은 서버로 넘어가 이 검사에서 걷었다 — 대신 «그 길이 없다» 를 §5 에서 지킨다.

   ★ 무엇을 보는가
     §1 하루 경계가 한국 시간 자정인가 · 안내 문구가 여는 시각을 따라가는가
     §2 좌표 인코딩 — 시선을 덤으로 얹기 · 옛 값 읽기 · 길이 상한
     §3 정원 문구 — 서버 답의 숫자를 문구로만 옮긴다(경계값)
     §4 자리 수 · 보내는 간격 상수
     §5 통신이 없다 — Firebase 길 · 세션 만들기가 이 파일에 없다 */
'use strict';
const P = require('./purikura-net.js');
/* ⚠️ 하루 상한을 **숫자로 적지 않는다.** 예전에는 200 을 스무 군데에 박아 뒀는데, 상한이
   400 으로 바뀌자 검사가 열다섯 줄을 한꺼번에 틀렸다고 우겼다 — 코드는 멀쩡한데 검사만 낡은,
   audit 검사 17 이 막으려는 바로 그 모양이다. 상한은 purikura-net.js 한 곳에서만 나오고
   (CAP_PER_DAY), 규칙 파일의 400 과 맞는지는 sim-purikura-rules.js 가 따로 본다. */

let fail = 0;
const say = console.log;
const chk = (c, m) => { say((c ? '  ✓ ' : '  ✗ ') + m); if(!c) fail++; };
const KST = 9 * 3600 * 1000, DAY = 86400000;
/* 한국 시간 문자열 → UTC ms */
const kst = s => Date.parse(s + '+09:00');

(function(){
say('=== 📷 스티커사진 · 순수 계산 ===\n');

/* ── §1 다시 여는 안내 ──────────────────────────────────────────── */
say('· §1 다시 여는 안내는 서버가 준 시각에서 뽑는다 (앱은 날짜를 세지 않는다 — D7)');
{
  chk(P.kstDay === undefined && P.reopenAt === undefined, '★ 앱 쪽 하루 경계 계산(kstDay · reopenAt)이 없다 — 하루 경계는 서버 정원 답의 reopenAt');
  chk(/내일 0시/.test(P.closedMessage(kst('2026-03-16T00:00:00'))), '안내 문구: ' + P.closedMessage(kst('2026-03-16T00:00:00')));
  chk(/내일 3시에 열려요/.test(P.closedMessage(kst('2026-03-16T03:00:00'))), '서버가 여는 시각을 바꾸면 문구가 따라온다(3시)');
  chk(P.closedMessage(null) === '📷 스티커사진이 문을 닫았어요. 내일 다시 열려요.' && P.closedMessage(NaN).indexOf('다시 열려요') > 0, '시각을 모르면 «내일 다시 열려요»');
}
say('');

/* ── §2 시선 인코딩 ───────────────────────────────────────────── */
say('· §2 시선을 좌표 문자열에 얹기');
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

/* ── §3 정원 문구 ──────────────────────────────────────────────── */
say('· §3 서버 답의 숫자를 문구로만 옮긴다');
{
  chk(P.quotaText(395, 400) === '395 / 400', '남은 횟수 칸: ' + P.quotaText(395, 400));
  chk(P.quotaText(0, 400) === '0 / 400' && P.quotaText(400, 400) === '400 / 400', '경계값 — 다 쓰면 0 / 상한 · 하나도 안 쓰면 상한 / 상한');
  chk(P.quotaText(-3, 400) === '0 / 400', '음수는 0 으로 — 화면에 «-3 / 400» 이 뜨지 않는다');
  chk(P.startedText(5, 395) === '5번째 · 395회 남음', '차감 직후 문구: ' + P.startedText(5, 395));
  chk(P.startedText(400, 0) === '400번째 · 0회 남음', '마지막 한 장: ' + P.startedText(400, 0));
  chk(P.startedText(7, -1) === '7번째 · 0회 남음', '음수 남은 횟수는 0');
  chk(P.quotaText(12, 100) === '12 / 100', '상한은 서버 답에서 온다 — 앱에 400 을 박아 두지 않는다');
}
say('');

/* ── §4 자리 수 · 보내는 간격 ───────────────────────────────────── */
say('· §4 보내는 쪽(purikura-rt.js)이 읽는 상수');
{
  chk(P.MAX_SLOTS === 4, '한 세션 4명');
  chk(P.SEND_MIN_MS === 100 && 1000 / P.SEND_MIN_MS <= 20, '★ 좌표는 10Hz — 서버가 자리마다 초당 20 을 넘으면 버리니 그 안이다');
  chk(P.DEAD_X > 0 && P.DEAD_D > 0 && P.DEAD_X < 0.05, '안 움직임을 가르는 폭(데드밴드)이 있다');
  chk(P.FREEZE_MS === 400, '셔터 직전 정지 400ms');
}
say('');

/* ── §5 통신이 없다 ─────────────────────────────────────────────── */
say('· §5 Firebase 길 · 세션 만들기가 이 파일에 없다');
{
  const src = require('fs').readFileSync(require('path').join(__dirname, 'purikura-net.js'), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  chk(typeof P.makeSession === 'undefined' && !/makeSession/.test(code), '★ makeSession 이 없다(세션은 서버 — purikura-rt.js)');
  chk(!/\bpk(?:Get|Set|Update|Remove|Transaction|OnValue|OnDisconnect\w*)\b|firebaseAPI|serverNow/.test(code), '★ pk* 어댑터 · firebaseAPI 를 안 쓴다');
  chk(['BEAT_MS', 'SLOT_TTL_MS', 'CAP_PER_DAY', 'quotaNext', 'quotaLeft', 'quotaUsed', 'quotaLabel', 'nthLabel'].every((k) => typeof P[k] === 'undefined'),
    '★ 하트비트 · 자리 유효 시간 · 앱의 정원 상한 · 트랜잭션 정원 계산이 없다(서버가 센다)');
}
say('');

if(fail){ say('문제 ' + fail + '건'); process.exit(1); }
say('전부 통과 ✅ — 순수 계산이 서버 규약과 맞다');
process.exit(0);
})();
