/* sim-purikura-net.js — 📷 스티커사진 · 하루 정원과 방 통신 검사
   실행: node sim-purikura-net.js   (purikura-net.js 와 같은 폴더에서)

   ★ 왜 이 검사가 있는가 — 이 계층은 **틀려도 화면에 아무 표시가 안 난다.**
     좌표를 남의 노드에 써도 그림은 똑같이 움직인다. 하루 정원이 안 걸려도
     어제까진 잘 돌아간다. 요금 고지서로 알게 되는 종류의 버그라, 눈으로 볼 방법이 없다.
     그래서 코드가 아니라 **요금을 정하는 약속** 쪽을 검사한다.

   ★ 무엇을 보는가
     §1 하루 경계가 한국 시간 자정인가 · 안내 문구가 여는 시각을 따라가는가
     §2 정원이 정확히 1씩 오르고 상한에서 멈추는가 · 날이 바뀌면 되살아나는가
     §3 좌표를 안 움직일 때 안 보내는가 (요금의 절반이 여기서 갈린다)
     §4 선착순 4자리 · 재접속 · 만석 · 죽은 자리 청소
     §5 점프·포즈가 사건 1회로 나가는가 (연속으로 보내면 쓰기가 10배)
     §6 좌표가 별도 노드로 가는가 · 마지막 사람이 나가면 치우는가
     §7 실제로 몇 바이트가 오가는가 (핸드오프의 계산과 맞는지) */
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

/* ⚠️ 전부 async 다. 앞선 판은 while 로 바쁜 대기를 걸었는데, 그러면 이벤트 루프가 막혀서
   Promise 가 **영원히 안 풀린다**(open() 이 undefined 로 나왔다). await 가 유일한 방법이다. */
let T = Date.parse('2026-03-15T10:00:00+09:00');   // 가짜 시계 — 검사가 실시간을 안 기다린다
const tick = ms => { T += ms; };

(async function(){
say('=== 📷 스티커사진 · 정원과 통신 ===\n');

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

/* ── §3 좌표를 언제 보내는가 ────────────────────────────────────── */
say('· §3 안 움직이면 안 보낸다 (요금의 절반이 여기서 갈린다)');
{
  const api = fakeApi();
  const s = P.makeSession(api, { clock: () => T });
  await s.open('RX', {userId:'me', name:'나'});

  api.writes = [];
  chk(s.sendPos(1.0, 3.0) === true, '첫 좌표는 보낸다');
  chk(s.sendPos(1.0, 3.0) === false, '★ 똑같은 자리는 안 보낸다');
  tick(120);
  chk(s.sendPos(1.0005, 3.0005) === false, '★ 눈에 안 보이는 움직임도 안 보낸다 (데드밴드)');
  tick(120);
  chk(s.sendPos(1.2, 3.0) === true, '실제로 움직이면 보낸다');
  chk(s.sendPos(9.9, 9.9) === false, '★ 100ms 안에는 아무리 움직여도 안 보낸다 (10Hz 상한)');
  tick(120);
  chk(s.sendPos(2.0, 4.0) === true, '간격이 지나면 다시 보낸다');
  chk(s.sendPos(2.0, 4.0, true) === true, '★ 셔터 직전(force)에는 데드밴드도 간격도 무시한다');
  chk(api.writes.length > 0 && api.writes.every(w => w.path.indexOf('/_photo/p/') > 0),
      '좌표는 전부 _photo/p 아래로만 갔다 (' + api.writes.length + '회)');

  /* 👀 시선은 «덤»이다 — 좌표 때문에 나가는 메시지에 얹기만 하고, 시선이 바뀌었다고
     새 메시지를 만들지 않는다. 여기가 깨지면 마우스를 흔드는 동안 10Hz 로 계속 쓰게 되어
     세션 요금이 두 배가 된다. 이 화면에서 요금이 늘 수 있는 유일한 통로다. */
  tick(500);
  s.sendPos(5.0, 4.0, false, 0, 0);          // 자리를 한 번 확정하고
  const before = api.writes.length;
  for(let i=0;i<20;i++){ tick(120); s.sendPos(5.0, 4.0, false, i/20, -i/20); }
  chk(api.writes.length === before,
      '★ 시선만 바뀌면 한 번도 안 보낸다 (' + (api.writes.length-before) + '회) — 마우스를 흔들어도 요금이 안 는다');
  tick(120);
  chk(s.sendPos(5.4, 4.0, false, 0.3, -0.2) === true, '좌표가 움직이면 그때 시선도 함께 실려 간다');
  const last = api.writes[api.writes.length-1];
  chk(P.decPos(last.value).gz === 0.3 && P.decPos(last.value).gp === -0.2,
      '★ 실려 간 값이 그대로 읽힌다');
  chk(s.sendPos(5.4, 4.0, true, -0.5, 0.1) === true,
      '★ 셔터 직전(force)에는 안 움직였어도 보낸다 — 사진에 남는 시선이 이 한 번이다');
}
say('');

/* ── §3-2 시선 인코딩 ───────────────────────────────────────────── */
say('· §3-2 시선을 좌표 문자열에 얹기');
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

/* ── §4 선착순 자리 ─────────────────────────────────────────────── */
say('· §4 선착순 4자리');
{
  const api = fakeApi();
  const mk = () => P.makeSession(api, {});
  const A = mk(), B = mk(), C = mk(), D = mk();
  const r = [];
  for(const [id, s] of [['a',A],['b',B],['c',C],['d',D]]) r.push(await s.open('R1', {userId:id, name:id}));
  chk(r[0].ok && r[0].slot === 0 && r[0].host === true, '★ 먼저 들어온 사람이 0번 = 시작 권한');
  chk(r[1].slot === 1 && r[1].host === false, '두 번째는 1번');
  chk(r[3].slot === 3, '네 번째는 3번');

  const e = await mk().open('R1', {userId:'e', name:'e'});
  chk(e.ok === false && e.reason === 'full', '★ 다섯 번째는 못 들어온다');

  /* 새로고침 — 같은 사람이 다시 열면 자기 자리를 그대로 받는다 */
  const again = await mk().open('R1', {userId:'b', name:'b'});
  chk(again.ok && again.slot === 1, '★ 같은 사람이 다시 열면 원래 자리(1번)로 돌아온다');

  /* 자리를 비우면 그 번호가 다시 열린다 */
  await C.close();
  const f = await mk().open('R1', {userId:'f', name:'f'});
  chk(f.ok && f.slot === 2, '나간 자리(2번)를 다음 사람이 받는다');

  /* 브라우저가 꺼져 onDisconnect 도 못 돈 죽은 자리 */
  api.db.rooms.R1._photo.slots['3'].at -= 20 * 60000;
  const g = await mk().open('R1', {userId:'g', name:'g'});
  chk(g.ok && g.slot === 3, '★ 15분 넘게 조용한 자리는 걷어내고 새 사람을 받는다');
}
say('');

/* ── §5 점프·포즈 ───────────────────────────────────────────────── */
say('· §5 점프·포즈는 사건 한 번으로 나간다');
{
  const api = fakeApi();
  const s = P.makeSession(api, { clock: () => T });
  await s.open('RX', {userId:'me', name:'나'});
  api.writes = [];
  s.sendEvent('jump');
  s.sendEvent('pose', 2);
  chk(api.writes.length === 2, '★ 점프 1회 + 포즈 1회 = 쓰기 2회 (연속 전송이면 10배가 된다)');
  chk(api.writes.every(w => /\/_photo\/ev\//.test(w.path)), '좌표와 다른 노드(ev)로 간다');
  chk(api.writes[1].value.k === 'pose' && api.writes[1].value.v === 2, '포즈 번호가 실린다');
}
say('');

/* ── §6 노드 위치와 뒷정리 ──────────────────────────────────────── */
say('· §6 좌표가 프리즌스에 섞이지 않는가 · 마지막 사람이 치우는가');
{
  const api = fakeApi();
  const A = P.makeSession(api, { clock: () => T }), B = P.makeSession(api, { clock: () => T });
  await A.open('R2', {userId:'a'});
  await B.open('R2', {userId:'b'});
  api.writes = [];
  A.sendPos(1, 3); B.sendPos(2, 4);
  chk(api.writes.every(w => w.path.indexOf('rooms/R2/_photo/') === 0),
      '★ 모든 쓰기가 rooms/{code}/_photo 안이다');
  chk(!api.writes.some(w => /\/_photo\//.test(w.path) === false),
      '★ 프리즌스 쪽(rooms/{code}/{member})으로 새는 쓰기가 없다');

  chk(api.subs.filter(p => p === 'rooms/R2/_photo').length === 0,
      '★ _photo 를 통째로 구독하지 않는다 (프레임·메타가 좌표마다 다시 내려온다)');
  chk(api.subs.indexOf('rooms/R2/_photo/p') >= 0, '좌표 가지만 따로 구독한다');

  await A.close();
  chk(!!(api.db.rooms.R2._photo && api.db.rooms.R2._photo.slots && api.db.rooms.R2._photo.slots['1']),
      '한 명 나가도 남은 사람 자리는 그대로');
  chk(api.db.rooms.R2._photo !== undefined, '아직 방이 살아 있다');
  await B.close();
  chk(api.db.rooms.R2._photo === undefined,
      '★ 마지막 사람이 나가면 _photo 를 통째로 지운다 (안 지우면 다음 사람이 남의 프레임을 물려받는다)');

  const od = api.onDis.filter(p => /_photo\/(slots|p)\//.test(p));
  chk(od.length >= 2, '자리와 좌표에 onDisconnect 가 걸려 있다 (' + od.length + '건)');
}
say('');

/* ── §7 실제 바이트 ─────────────────────────────────────────────── */
say('· §7 한 세션에 실제로 얼마나 오가는가');
{
  const api = fakeApi();
  const s = P.makeSession(api, { clock: () => T });
  await s.open('RZ', {userId:'me', name:'나'});
  api.writes = [];

  /* 60초 · 10Hz · 절반은 움직인다고 보고 걸어본다 */
  let wx = 0, d = 3, moving = true;
  for(let i = 0; i < 600; i++){
    if(i % 20 === 0) moving = !moving;
    if(moving){ wx += 0.05; d += (i % 40 < 20 ? 0.02 : -0.02); }
    tick(100);
    s.sendPos(wx, d);
  }
  const n = api.writes.length;
  const bytes = api.writes.reduce((a, w) =>
    a + w.path.length + JSON.stringify(w.value).length + 12, 0);   // 12 = 프레임 오버헤드 여유
  const perW = bytes / n;
  say('    1인 60초 → 쓰기 ' + n + '회 · ' + (bytes / 1024).toFixed(1) + 'KB (' + perW.toFixed(0) + 'B/회)');

  const sess = bytes * 4 * 4;                    // 4인 × 구독 4명
  const won  = sess / 1024 ** 3 * 5 * 1400;
  say('    4인 세션 다운로드 ' + (sess / 1024).toFixed(0) + 'KB → ' + won.toFixed(2) + '원');
  say('    하루 ' + CAP + '회 → 월 ' + (won * CAP * 30).toLocaleString('ko-KR', {maximumFractionDigits:0}) + '원 (프레임 별도)');

  chk(n <= 320, '★ 안 움직이는 동안은 안 보낸다 — 600틱 중 ' + n + '회만 나갔다');
  chk(perW < 90, '★ 1회 쓰기가 90B 미만이다 (' + perW.toFixed(0) + 'B) — 계산 전제와 맞는다');
  chk(won < 3, '★ 세션당 3원 미만');
}
say('');


/* ── §8 남은 횟수 표시 ──────────────────────────────────────────── */
say('· §8 남은 횟수를 보여주는 자리');
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

  const api = fakeApi();
  const s = P.makeSession(api, { clock: () => T });
  await s.open('RQ', {userId:'me'});

  let q = await s.checkQuota();
  chk(q.ok && q.left === CAP && q.label === FULL, '📷 를 누르면 읽어서 보여준다 — ' + q.label);

  /* 창을 열어 두는 동안 남이 찍으면 내 화면 숫자도 줄어야 한다 */
  const seen = [];
  const off = s.watchQuota(v => seen.push(v.label));
  chk(typeof off === 'function', '★ watchQuota 가 해제 함수를 그대로 돌려준다 (삼키면 구독이 영영 안 끊긴다)');
  chk(seen.length === 1 && seen[0] === FULL, '구독하면 지금 값이 바로 온다');
  await P.makeSession(api, { clock: () => T }).takeQuota();
  chk(seen[seen.length-1] === (CAP-1) + ' / ' + CAP, '★ 남이 찍으면 내 숫자도 따라 줄어든다');
  off();
  const before = seen.length;
  await P.makeSession(api, { clock: () => T }).takeQuota();
  chk(seen.length === before, '창을 닫으면 더 안 받는다 (상시 구독이 아니다)');

  /* 마지막 한 장을 두 방이 동시에 노리는 경우 */
  api.db.photoQuota = { day: day, n: CAP - 1 };
  const A = P.makeSession(api, { clock: () => T }), B = P.makeSession(api, { clock: () => T });
  const rA = await A.takeQuota(), rB = await B.takeQuota();
  chk(rA.ok === true && rA.n === CAP, '★ 먼저 누른 쪽만 통과 — ' + rA.nth);
  chk(rB.ok === false && /문을 닫았어요/.test(rB.message),
      '★ 늦은 쪽은 시작 버튼 자리에서 안내를 받는다 (촬영 도중이 아니라)');
  chk(api.db.photoQuota.n === CAP, '정원이 ' + CAP + ' 을 안 넘는다');
}
say('');

if(fail){ say('문제 ' + fail + '건'); process.exit(1); }
say('전부 통과 ✅ — 요금을 정하는 약속이 지켜지고 있다');
process.exit(0);
})();

/* ══ 흉내내기 ══════════════════════════════════════════════════════
   진짜 RTDB 는 안 띄운다. 이 검사가 보는 것은 "어디에 · 얼마나 자주 · 몇 바이트"라서
   저장소는 평범한 객체면 충분하다. */
function fakeApi(){
  const api = {
    db: {}, writes: [], subs: [], onDis: [], cbs: {},
    serverNow(){ return T; },
    pkGet(p){ return Promise.resolve(deep(api.db, p)); },
    pkSet(p, v){ api.writes.push({path:p, value:v}); setDeep(api.db, p, v); fire(p); return Promise.resolve(); },
    pkUpdate(p, o){
      api.writes.push({path:p, value:o});
      const cur = deep(api.db, p) || {};
      for(const k in o){ if(o[k] === null) delete cur[k]; else cur[k] = o[k]; }
      setDeep(api.db, p, cur); fire(p); return Promise.resolve();
    },
    pkRemove(p){ api.writes.push({path:p, value:null}); delDeep(api.db, p); fire(p); return Promise.resolve(); },
    pkTransaction(p, fn){
      const cur = deep(api.db, p);
      const next = fn(cur === undefined ? null : cur);
      if(next === null || next === undefined) return Promise.resolve({committed:false, value:cur});
      api.writes.push({path:p, value:next}); setDeep(api.db, p, next); fire(p);
      return Promise.resolve({committed:true, value:next});
    },
    pkOnValue(p, cb){
      /* ⚠️ 해제를 진짜로 구현해야 한다. 빈 함수를 돌려주면 "구독을 끊었는가"를
         검사할 방법이 사라지고, 모듈이 해제 함수를 삼켜도 검사가 통과한다. */
      api.subs.push(p);
      const list = (api.cbs[p] = api.cbs[p] || []);
      list.push(cb);
      cb(deep(api.db, p));
      return function(){ const i = list.indexOf(cb); if(i >= 0) list.splice(i, 1); };
    },
    pkOnDisconnectRemove(p){ api.onDis.push(p); return Promise.resolve(); }
  };
  function fire(p){ for(const k in api.cbs) if(p.indexOf(k) === 0 || k.indexOf(p) === 0)
    api.cbs[k].forEach(f => f(deep(api.db, k))); }
  return api;
}
function deep(o, p){ return p.split('/').reduce((a, k) => (a == null ? undefined : a[k]), o); }
function setDeep(o, p, v){
  const ks = p.split('/');
  for(let i = 0; i < ks.length - 1; i++){ if(typeof o[ks[i]] !== 'object' || o[ks[i]] === null) o[ks[i]] = {}; o = o[ks[i]]; }
  o[ks[ks.length - 1]] = v;
}
function delDeep(o, p){
  const ks = p.split('/');
  for(let i = 0; i < ks.length - 1; i++){ o = o[ks[i]]; if(!o) return; }
  delete o[ks[ks.length - 1]];
}

