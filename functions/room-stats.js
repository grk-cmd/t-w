/* ═══ 📊 functions/room-stats.js — 열린 방 개수를 서버가 세어 둔다 (2026-10-03 · RTDB 트래픽 분석 §2-1) ═══════════════
   [왜] 방 창·F1 멀티모드 탭을 열어 둔 사람마다 30초마다 roomIndex **전체**(455줄 · 약 24KB)를 받아
        각자 세고 있었다 — 다운로드 1위(약 29%). 화면에 필요한 건 채널별 숫자 둘뿐이다.
   [하는 일] 1분마다
     ① roomIndex 를 한 번 읽어 살아 있는 방(lastSeen 90초 이내 · SCRT- 제외)을 채널별로 센다
        → roomStats = { workingroom, togetherroom, open:[랜덤 참여 후보 코드], at } (약 수백 바이트).
        기준은 앱 getRoomCounts · findRandomRooms 와 **같다**(고칠 때 같이 고친다).
     ② lastSeen 이 10분 넘게 지난 줄을 지운다 — 방이 강제 종료·절전으로 끝나면 줄이 남아 쌓였다
        (실측 455줄 중 248줄). 옛 버전 앱은 계속 roomIndex 전체를 읽으므로 그 몫도 줄어든다.
   · 지우기는 줄마다 트랜잭션 — 읽은 뒤 누가 그 코드로 다시 들어와 lastSeen 을 고쳤으면 지우지 않는다.
   · 지운 방 사람들이 절전에서 깨어나면 하트비트가 줄을 다시 만든다. 이 판 앱은 그때 channel · open 도 같이 싣는다
     (app/parts/room-index.js). 옛 판 앱은 { lastSeen } 만 써서 그 방은 워킹룸 · 랜덤 참여 아님으로 보인다 —
     옛 판이 줄어들수록 사라지는 어긋남이다.
   · 앱은 roomStats 가 없거나 3분 넘게 낡았으면 예전처럼 roomIndex 를 직접 센다(배포 전·함수 장애 대비).
   · 정원 검사(방 만들기·빈 방 승격)는 roomStats 를 쓰지 않는다 — 1분 늦은 숫자로 정원을 넘기면 안 된다.
   · 비용: 1분에 roomIndex 한 번(약 24KB) — 하루 약 35MB. Cloud Scheduler 작업이 4개째라 월 $0.10. */
'use strict';
const ROOM_LIVE_MS = 90 * 1000;              // 앱 getRoomCounts 의 STALE 과 같은 값
const ROOM_INDEX_DROP_MS = 10 * 60 * 1000;   // 하트비트 30초 — 살아 있는 방이 이만큼 조용할 일은 없다
const ROOM_OPEN_MAX = 30;                    // 랜덤 참여 후보는 섞어서 이만큼만 싣는다
const ROOM_DROP_MAX = 300;                   // 한 번에 지우는 줄 상한(밀린 첫 실행 대비)

/* 순수 — roomIndex 값 → 요약 + 지울 코드. 랜덤 섞기는 rnd 로 받는다(검사에서 고정). */
function roomStatsFrom(idx, now, rnd){
  const out = { workingroom: 0, togetherroom: 0, open: [], at: now };
  const drop = [];
  for (const code in (idx || {})){
    const e = idx[code];
    if (!e || typeof e !== 'object') continue;
    const seen = Number(e.lastSeen);
    if (!Number.isFinite(seen)) continue;
    if (now - seen >= ROOM_INDEX_DROP_MS){ drop.push(code); continue; }
    if (code.indexOf('SCRT-') === 0) continue;               // 🔒 시크릿룸은 정원에 안 잡힌다(앱과 같음)
    if (now - seen >= ROOM_LIVE_MS) continue;
    const ch = (e.channel === 'togetherroom') ? 'togetherroom' : 'workingroom';
    out[ch]++;
    if (ch === 'workingroom' && e.open === true) out.open.push(code);   // 투게더룸은 랜덤 참여 대상 아님
  }
  const r = rnd || Math.random;
  for (let i = out.open.length - 1; i > 0; i--){ const j = Math.floor(r() * (i + 1)); const t = out.open[i]; out.open[i] = out.open[j]; out.open[j] = t; }
  out.open = out.open.slice(0, ROOM_OPEN_MAX);
  return { stats: out, drop: drop.slice(0, ROOM_DROP_MAX) };
}

async function runRoomStats(db, now){
  const idx = (await db.ref('roomIndex').get()).val() || {};
  const { stats, drop } = roomStatsFrom(idx, now);
  await db.ref('roomStats').set(stats);
  let dropped = 0, kept = 0, failed = 0;
  const cutoff = now - ROOM_INDEX_DROP_MS;
  for (const code of drop){
    try{
      /* ⚠️ 첫 호출의 cur 는 로컬 캐시 추측값(대개 null)이다. 여기서 그만두면(undefined) 서버 값을 못 보고 끝난다 —
         null 을 돌려주면 서버 값이 다를 때 진짜 값으로 다시 불린다. */
      const r = await db.ref('roomIndex/' + code).transaction(cur => {
        if (cur === null) return null;
        if (Number(cur.lastSeen) < cutoff) return null;
        return;   // undefined = 그만둠 — 그새 누가 다시 들어와 lastSeen 을 고쳤다
      }, undefined, false);
      if (r.committed) dropped++; else kept++;
    }catch(e){ failed++; }
  }
  const sum = { live: stats.workingroom + stats.togetherroom, working: stats.workingroom, together: stats.togetherroom,
                open: stats.open.length, rows: Object.keys(idx).length, dropped, kept, failed };
  if (dropped || failed) console.log('[roomStats]', JSON.stringify(sum));   // 1분마다라 조용할 땐 안 찍는다
  return sum;
}

module.exports = { roomStatsFrom, runRoomStats, ROOM_LIVE_MS, ROOM_INDEX_DROP_MS, ROOM_OPEN_MAX, ROOM_DROP_MAX };
