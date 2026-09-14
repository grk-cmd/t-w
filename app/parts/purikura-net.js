/* purikura-net.js — 📷 스티커사진 · 하루 정원과 방 통신
   ────────────────────────────────────────────────────────────────────────────
   app.js 와 같은 폴더에 두고 app.js **앞에** 부른다:
       <script src="purikura-net.js"></script>
       <script src="app.js"></script>

   ★ 이 파일이 존재하는 이유
     스티커사진의 서버비는 전부 이 계층이 정한다. 화면은 얼마든지 바꿔도 되지만
     여기 상수 넷을 잘못 만지면 요금이 10배가 된다. 그래서 화면과 **완전히 분리**해서
     따로 두고, sim-purikura-net.js 로 이 파일만 따로 검사한다.
     THREE 도 DOM 도 안 쓴다 — 그래야 node 에서 그대로 굴려볼 수 있다.

   ★ 절대 건드리면 안 되는 설계 셋 (계산 근거는 handoff-purikura-1.md)
     ① 좌표는 rooms/{code}/_photo/p 라는 **별도 노드**에 쓴다. (이름의 밑줄까지가 규칙이다 — base() 주석)
        기존 프리즌스 페이로드(_basePayload)에 얹으면 구독자가 방 전원 8명이 되고
        페이로드도 50B → 385B 로 커진다. 실측 기준 **세션당 1.7원 → 24.4원(14배)**.
        "가장 쉬운 구현"이 "가장 비싼 길"인 자리라 여기가 제일 위험하다.
     ② 안 움직이면 안 보낸다(DEAD_X/DEAD_D). 항상 보내면 1.7원 → 3.3원.
     ③ 점프·포즈는 **연속 값이 아니라 사건**이다. "언제 눌렀다"만 한 번 보내면
        나머지는 각 클라이언트가 똑같이 계산한다. 초당 10번 점프 높이를 보낼 이유가 없다.

   ★ 필요한 어댑터 (parts/firebase-init.js 에 추가해야 한다 — 지금은 없다)
        firebaseAPI.pkGet(path)                  → Promise<value>
        firebaseAPI.pkSet(path, value)           → Promise
        firebaseAPI.pkUpdate(path, obj)          → Promise
        firebaseAPI.pkRemove(path)               → Promise
        firebaseAPI.pkTransaction(path, fn)      → Promise<{committed, value}>
        firebaseAPI.pkOnValue(path, cb)          → 해제 함수
        firebaseAPI.pkOnDisconnectRemove(path)   → Promise
     serverNow() 는 이미 있다(그대로 쓴다).
   ──────────────────────────────────────────────────────────────────────────── */
'use strict';

var Purikura = (function(){

/* ══ 요금을 정하는 상수 — 바꾸기 전에 handoff 의 표를 볼 것 ══════════════ */
var CAP_PER_DAY = 400;      // 하루 전체 촬영 횟수. 400 × 1.82원 ≈ 월 22,000원
/* ⚠️ 이 숫자를 고치면 **firebase-database-rules.json 의 photoQuota 상한도 같이 고쳐야 한다**
     (`newData.child('n').val() <= 400`). 규칙 쪽이 낮으면 그 숫자에서 쓰기가 거부되는데,
     화면에는 「닫혔어요」가 아니라 «시작 버튼이 그냥 안 먹는다»로 나온다.
     sim-purikura-rules.js §2 가 두 값이 같은지 굴려서 확인한다 — 고친 뒤 반드시 돌릴 것. */
var MAX_SLOTS   = 4;        // 한 세션 인원(선착순)
var SEND_MIN_MS = 100;      // 좌표 전송 간격 = 10Hz. 6Hz(167) 로 내리면 세션당 1.70→1.07원
var DEAD_X      = 0.012;    // 이보다 덜 움직이면 안 보낸다 (월드 단위, 캐릭터 키=1.7)
var DEAD_D      = 0.012;
var POS_Q       = 100;      // 좌표를 정수로 만드는 배율. 소수점을 그대로 보내면 자릿수가 는다
var GAZE_Q      = 100;      // 시선(-1~1)을 정수로 만드는 배율 — 두 자리면 충분하다
var YAW_Q       = 50;       // 몸 회전(-π~π)의 배율. 50 이면 1.1° 단위 — 눈으로 구분이 안 되는 정밀도이고,
                            // 100 으로 올리면 가장 긴 경우가 규칙의 길이 상한 24 를 넘긴다
var FREEZE_MS   = 400;      // 셔터 직전 정지 시간 — 늦게 오는 최종 좌표를 기다린다
var SLOT_TTL_MS = 15 * 60000;  // 이 시간이 지난 세션은 죽은 것으로 보고 걷어낸다
/* 💓 자리가 살아 있다고 알리는 간격.
   [무엇을 푸는가] 예전에는 slots 의 at 이 open() 때 한 번만 찍히고 **갱신되지 않았다.**
     그래서 15분 넘게 촬영 중인 사람도 다음에 들어오는 사람 눈에는 「죽은 세션」이라,
     그 트랜잭션이 살아 있는 사람들을 통째로 걷어냈다. 그 순간 0번 자리가 남에게 넘어가고
     **방장이 둘이 된다** — 제보 「간헐적으로 내가 고른 배경이 남한테 적용이 안 된다」의 뿌리다.
   ★ TTL 의 1/3 이다. 세 번을 내리 놓쳐야 잘린다 — 잠깐 끊긴 것으로 자리를 잃지 않는다.
   ⚠️ 요금: 한 번에 slots 노드(4인 기준 249B)를 구독자 4명이 받는다. 5분 간격이면
     30분 세션당 0.16원, 정원 400 을 매일 꽉 채워도 월 2천원 미만이다.
     간격을 줄이면 그만큼 는다 — 1분으로 내리면 다섯 배다.
   ⚠️ SLOT_TTL_MS 를 고치면 이 값도 같이 볼 것. 이 값이 TTL 보다 커지면 하트비트가 있으나 마나다. */
var BEAT_MS = 5 * 60000;

/* ══ 시트 기하 — 시안 v9 가 정한 값 ═══════════════════════════════════
   ★ 왜 요금 계층에 기하가 들어와 있나
     화면과 검사기와 규칙이 **같은 숫자**를 봐야 하기 때문이다. 이 값들이 갈라지면
     「무대에 보이는 것」과 「사진에 찍히는 것」이 달라지는데, 그건 화면에 표시가 안 난다
     — 다 찍고 나서야 발이 잘린 걸 알게 되는 종류다. THREE 도 DOM 도 안 쓰는 순수 계산이라
     여기 두면 node 로 그대로 검사할 수 있다(sim-purikura-stage.js).
   ⚠️ 여백 40 은 「어디나 같다」가 규칙이다. 바깥 테두리와 컷 사이가 다르면 올린 프레임의
     규격 계산(frameSpec)이 컷마다 달라진다. */
var SHEET_W = 1200, SHEET_H = 1600, GUTTER = 40;
var STAGE_W_MAX = 700, STAGE_H_MAX = 420;      // 창 안에 들어가는 무대 한계(px)
/* 🖼️ **테두리까지 합친** 폭의 상한.
   ★ 2026-08-29: 가로형에서 가로 스크롤이 생기던 것을 여기서 막는다.
     [무엇을 놓쳤나] 위 두 값은 «무대(캔버스)»의 크기다. 그런데 화면에 놓이는 것은 무대만이
       아니다 — 여백(기본 프레임)이 무대 둘레에 **테두리로 한 겹 더** 둘러진다
       (_pkSyncFrame 의 borderWidth = GUTTER × 무대÷컷). 그 두 겹을 안 세면 실제 폭이
       무대보다 5~11% 크고, 그만큼 창(본문 578px)을 넘어 스크롤이 생긴다.
     [왜 컷마다 다른가] 테두리 비율은 GUTTER ÷ 컷 폭이라 **컷이 잘게 나뉠수록 두껍다.**
       가로 1·2컷은 컷 폭이 1520 이라 5%지만, 가로 4컷은 740 이라 11% 다. 그래서
       «무대 폭 하나»로는 못 맞추고 이 계산이 필요하다.
   ⚠️ 이 상한은 세로형에는 닿지 않는다(세로는 높이가 먼저 걸려 306~309px 다). 그래서
     세로형의 크기는 예전 그대로이고, 줄어드는 것은 가로형뿐이다.
   ⚠️ 578 이 아니라 560 인 것은 창 본문의 좌우 여백 몫이다. 578 에 딱 맞추면 여백이 0 이 되어
     테두리가 창 벽에 붙는다. */
var STAGE_BOX_W = 560;

/* 컷 배치. 기준은 **세로형**이고 가로형은 이것을 90도 돌린다 —
   시트의 가로세로와 칸 배치(cols/rows)를 **함께** 맞바꾼다. 둘 중 하나만 바꾸면
   회전이 아니라 다른 배치가 된다. */
var LAYOUT = { 1:{cols:1, rows:1}, 2:{cols:2, rows:1}, 4:{cols:2, rows:2} };

/* ══ 카메라 — 시안 purikura-design-camera-v2-3d.html 의 확정값 ═══════════
   ★ 2026-08 에 «살짝 위에서 내려다보는» 각으로 바꿨다. 셀카 각이다.
     [예전] 1.32 · 0° — 렌즈가 키(1.7)보다 낮아서 최근접에서 머리가 80px 나갔다.
       다가갈수록 얼굴만 남는 그 클로즈업이 프리쿠라의 성질이었다.
     [지금] 1.65 · 16° — 렌즈가 키보다 살짝 낮고 아래로 기운다.
       얻은 것: 기본 거리에서 발이 화면 안으로 들어오고(426 → 274px), 넷이 겹치는 정도가 3% → 0%.
       내준 것: 최근접의 클로즈업이 약해졌다(머리가 80px 나가던 것이 22px 로 줄었다).
     ⚠️ 1.55 에서는 **가만히 서 있어도 정수리가 7px 잘렸다.** 1.65 에서 +10px 로 들어온다 —
       여유가 10px 뿐이라, 여기서 각을 키우거나 렌즈를 낮추면 다시 잘린다.
   ⚠️ PITCH 는 **0 이 아니어서** 기하가 한 겹 복잡해졌다. 깊이는 이제 거리 d 가 아니다 —
     camDepth() 를 거쳐야 한다. 좌우 한계·겹침·화면 높이가 전부 그 값을 쓴다.
   ⚠️ 각을 주면 화면이 아래를 보므로 **위쪽 여유가 줄었다.** 점프한 머리가 정점에서 화면 밖으로
     나간다(기본 거리 228px) — 16° 에서는 어떤 점프 높이로도 못 넣는다(0.2 이하 제외).
     이건 각을 고르면서 «정해진 것»이지 고장이 아니다. 되돌리려면 각부터 다시 정할 것.
   ⚠️ NEAR(앞으로 갈 수 있는 한계)는 0.90 → **0.45** 로 풀었다(2026-08-29 요청).
     0.90 은 사람 키(1.7) 기준으로 «얼굴이 화면을 채우는» 자리였는데, 동물처럼 작게 서는
     캐릭터는 거기까지 가도 여전히 멀어 보인다. 0.45 면 같은 자리에서 두 배로 크게 잡힌다.
     ⚠️ 더 줄이지 말 것 — 0.35 부터는 렌즈가 몸통(깊이 ±0.12) 안으로 들어가기 시작해서
       뒷면이 잘리고 화면이 하얗게 빈다. 0.45 는 그 앞의 마지막 안전한 자리다.
     ⚠️ 가까울수록 좌우로 움직일 수 있는 «월드» 폭은 줄어든다 — 원근 때문이지 고장이 아니다.
       다만 «화면에서 보이는» 이동 폭은 최근접에서도 남는다(xLimit 의 NEAR_SPAN).
       예전에는 여기가 0 이라 최근접이 가운데 고정이었다.
   ⚠️ 바꾸려면 시안부터 고칠 것. sim-purikura-stage.js §2 가 이 값들을 매번 다시 잰다. */
var CAM_FOV = 35, CAM_HEIGHT = 1.65, CAM_PITCH = 16, CAM_NEAR = 0.45, CAM_FAR = 5.4;
/* 🎚️ 촬영 중에 방장이 ▲▼ 로 움직이는 범위. 위의 둘은 «기본값»이고, 여기는 «어디까지»다.
   ⚠️ 최대 높이 2.60 은 «기본 각(16°)에서 발이 아직 화면 안»인 마지막 자리다(398 / 420).
     더 올리면 발부터 잘린다 — 올리려면 그 숫자를 먼저 다시 잴 것.
   ⚠️ 최소 0.50 은 «동물 눈높이»를 위해 연 값이다(2026-08-29 요청). 여기까지 내리면 렌즈가
     사람 무릎 아래라, **각을 함께 0 근처로 내려야 쓸모가 있다** — 0.50 에 각 16° 를 그대로 두면
     화면이 바닥을 보게 되어 사람 머리가 205px 나간다. 낮은 렌즈에는 낮은 각이 한 세트다.
   ⚠️ 한계 «안»이라도 조합에 따라 잘린다(1.40 + 26° 면 머리가 나간다). 그건 막지 않는다 —
     이 손잡이는 이 화면에서 드물게 **결과가 무대에 즉시 보이는** 것이라, 눈이 먼저 안다.
   큰 눈금(우클릭)은 작은 눈금의 6배·2.5배다 — 한 번에 «확 바꾸는» 쪽이라 딱 떨어질 필요는 없다. */
var CAM_H_MIN = 0.50, CAM_H_MAX = 2.60, CAM_H_STEP = 0.05, CAM_H_BIG = 0.30;
var CAM_P_MIN = 0,    CAM_P_MAX = 26,   CAM_P_STEP = 2,    CAM_P_BIG = 5;
/* 값이 한계를 넘지 않게 자른다. 소수점은 두 자리로 접는다 —
   0.05 를 더해 가면 부동소수 찌꺼기가 붙어서 전송 자릿수가 늘고, 규칙의 길이 검사에도 걸린다. */
function camClampH(v){ return Math.max(CAM_H_MIN, Math.min(CAM_H_MAX, Math.round((+v || 0) * 100) / 100)); }
function camClampP(v){ return Math.max(CAM_P_MIN, Math.min(CAM_P_MAX, Math.round(+v || 0))); }
var CHAR_H  = 1.7;      // 캐릭터 키(월드 단위)
/* 🐾 동물은 이만큼 더 크게 세운다.
   [왜] 무대는 모든 캐릭터를 «전체 높이»로 1.7 에 맞춘다(_pkCloneChar). 그런데 동물은 귀가 위로
     솟아 있어서 그 귀 끝까지 1.7 이 되고, 결과적으로 **얼굴과 몸이 사람보다 작게** 남는다.
     실행 화면의 ANIMAL_RUN_SCALE(40%)과는 다른 이야기다 — 저건 책상 옆에 앉은 크기이고,
     여기는 «같은 무대에 나란히 섰을 때»의 크기다.
   ⚠️ 키우면 귀가 화면 위로 나간다. 지금(1.30)은 기본 거리 81px · 가장 멀리 58px 이 잘린다.
     1.15 면 34/22px, 1.20 이면 50/34px, 1.40 이면 113/82px 이다 —
     눈으로 보고 고를 값이라 여기 한 곳에만 적는다.
   ⚠️ 여기서 더 키워도 «작다»가 남으면 배율 문제가 아니다. 그때는 전체 높이가 아니라
     **귀와 꼬리를 뺀 몸**을 재서 맞춰야 한다 — 그건 이 한 줄이 아니라 _pkCloneChar 를 고치는 일이다.
   ⚠️ 나란히 서는 인원 계산(fitCount)은 사람 어깨 폭 기준이다. 동물이 커지면 그만큼 더 겹치는데,
     지금은 넷이 0% 라 여유가 있다. 이 값을 크게 올리면 §2 의 겹침부터 다시 볼 것. */
var ANIMAL_H = 1.30;
/* 🐾 동물의 점프 «높이» 배율. 사람의 절반이다(2026-08-29 요청).
   ★ 높이 = v0² ÷ 2g 이므로, 높이를 절반으로 하려면 **초속은 √0.5 배**다.
     화면 쪽이 이 값의 제곱근을 초속에 곱한다 — 여기 적힌 것은 «높이»의 비율이다.
   ⚠️ 점프는 «눌렀다»만 오가고 궤적은 각자 계산한다. 그래서 이 값은 **모두의 화면에서 같아야**
     한다 — 남이 동물인지도 좌석(charDef.animal)에서 다 같이 읽으므로 사진이 안 갈린다.
   ⚠️ 체공은 초속에 비례하므로 √0.5 배(약 0.38초)로 함께 짧아진다. 낮게 뛰면서 오래 떠 있으면
     떠 있는 것처럼 보인다 — 둘이 같이 줄어야 «작게 폴짝»이 된다. */
var ANIMAL_JUMP = 0.5;
var BODY_W  = 0.618;    // 어깨 폭. 나란히 몇 명이 서는지를 이 값으로 센다

/* ══ 어느 방향에 어느 컷을 허용하는가 ═════════════════════════════════
   ★ 세로형 2컷은 **뺐다.** 무대가 149×420 이라 4명이 서면 53% 가 겹친다 — 뒷사람이
     앞사람에 통째로 가려진다. 나머지 다섯 조합은 4명이 3% 이하로만 겹쳐서 그대로 둔다.
     (근거는 fitCount() 로 직접 세어볼 수 있다. sim-purikura-stage.js §2 가 이 표를 굴린다.)
   ⚠️ 그래서 「가로형은 세로형을 90도 돌린 것」이라는 v9 의 대칭이 컷 **목록**에서만 깨진다.
     기하(cellRects)는 여전히 정확히 돌린 값이다 — 깨진 것은 고를 수 있는 가짓수뿐이다.
     방향을 바꿀 때 지금 고른 컷이 사라질 수 있으므로 fallbackCut() 을 쓸 것. */
function cutsFor(orient){ return orient === 'l' ? [1, 2, 4] : [1, 4]; }
function cutAllowed(orient, n){ return cutsFor(orient).indexOf(n | 0) >= 0; }
/* 방향을 바꿨을 때 지금 컷을 그대로 쓸 수 있으면 그대로, 아니면 가장 가까운 허용값.
   ⚠️ 여기서 1 로 떨어뜨리지 말 것 — 세로 2컷에서 가로로 갔다가 돌아오면 4컷이 되는 게
     「2 → 4」한 칸 이동이고, 1 로 보내면 고른 적 없는 값으로 튄다. */
function fallbackCut(orient, n){
  var list = cutsFor(orient), v = n | 0;
  if(list.indexOf(v) >= 0) return v;
  for(var i = 0; i < list.length; i++) if(list[i] >= v) return list[i];   // 위로 붙인다
  return list[list.length - 1];
}

function sheetW(orient){ return orient === 'l' ? SHEET_H : SHEET_W; }
function sheetH(orient){ return orient === 'l' ? SHEET_W : SHEET_H; }
function gridOf(orient, n){
  var L = LAYOUT[n] || LAYOUT[1];
  return orient === 'l' ? { cols:L.rows, rows:L.cols } : { cols:L.cols, rows:L.rows };
}
/* 컷 사각형 목록. k=1 이면 실제 저장 크기, k<1 이면 화면 크기. */
function cellRects(orient, n, k){
  k = (k === undefined) ? 1 : k;
  var L = gridOf(orient, n), g = GUTTER * k, W = sheetW(orient) * k, H = sheetH(orient) * k;
  var cw = (W - g * (L.cols + 1)) / L.cols, ch = (H - g * (L.rows + 1)) / L.rows;
  var out = [];
  for(var r = 0; r < L.rows; r++) for(var c = 0; c < L.cols; c++)
    out.push([g + c * (cw + g), g + r * (ch + g), cw, ch]);
  return out;
}
/* 올릴 프레임 한 장의 규격(px). 컷은 전부 같은 크기라 첫 칸만 재면 된다. */
function frameSpec(orient, n){
  var r = cellRects(orient, n, 1);
  return [Math.round(r[0][2]), Math.round(r[0][3])];
}
/* 무대 크기 — **컷 비율과 정확히 같아야 한다.** 안 맞추면 보이는 것과 찍히는 것이 달라진다.
   ⚠️ 높이만 고정하면 가로로 긴 컷(가로 2컷 = 1520×540)에서 폭이 1182px 이 되어 창을 넘는다.
     긴 변 쪽에도 상한을 걸어 두 방향 모두 들어오게 한다. */
function stageSize(orient, n){
  var s = frameSpec(orient, n), ratio = s[0] / s[1];
  var h = STAGE_H_MAX, w = Math.round(h * ratio);
  if(w > STAGE_W_MAX){ w = STAGE_W_MAX; h = Math.round(w / ratio); }
  /* 테두리 두 겹까지 합친 폭이 창을 넘으면 여기서 한 번 더 줄인다.
     ⚠️ 테두리는 무대 폭에 비례하므로(GUTTER × 무대÷컷) 한 번의 나눗셈으로 정확히 떨어진다 —
       반복해서 줄일 필요가 없다. 내림인 것은 반올림으로 1px 이 넘어 나가는 것을 막기 위해서다. */
  var box = 1 + 2 * GUTTER / s[0];
  if(w * box > STAGE_BOX_W){ w = Math.floor(STAGE_BOX_W / box); h = Math.round(w / ratio); }
  return { w:w, h:h, ratio:ratio };
}
/* 화면에서 이 무대가 실제로 차지하는 폭 — 테두리 두 겹을 포함한다.
   ★ 자리 계산(손잡이를 옆에 둘지 아래로 접을지)은 이 값을 봐야 한다. 무대 폭만 보면
     테두리가 두꺼운 컷에서 계산이 어긋난다 — 화면이 넘치고 나서야 안다.
   ⚠️ 반올림은 _pkSyncFrame 의 borderWidth 와 **같은 식**이어야 한다. 다르면 1~2px 이 갈린다. */
function stageBoxW(orient, n){
  var st = stageSize(orient, n), s = frameSpec(orient, n);
  return st.w + 2 * Math.round(GUTTER * st.w / s[0]);
}
/* 세로 화각으로부터의 초점거리(px). 무대 높이에만 달렸다. */
function focalPx(orient, n){
  var st = stageSize(orient, n);
  return (st.h / 2) / Math.tan(CAM_FOV * Math.PI / 360);
}
/* ★ 렌즈가 보는 «깊이». 각이 0 이면 거리 d 와 같지만, 기울면 달라진다.
   ⚠️ 좌우 한계·겹침·화면 높이가 전부 이 값을 써야 한다. d 를 그대로 쓰면 각을 준 만큼
     계산이 틀어지고, 그 결과는 «가장자리에서 몸이 살짝 잘린다»로 나타난다 — 눈에 잘 안 띈다.
   기준 높이는 **몸통 한가운데(키의 절반)** 다. 발밑을 기준으로 잡으면 깊이가 5% 넓게 나와서
   한계가 그만큼 헐거워진다. */
function camDepth(d, camH, camP){
  var H = (camH === undefined) ? CAM_HEIGHT : camH;
  var p = ((camP === undefined) ? CAM_PITCH : camP) * Math.PI / 180;
  return (H - CHAR_H / 2) * Math.sin(p) + d * Math.cos(p);
}
/* 거리 d 에서 화면 좌우로 쓸 수 있는 월드 폭의 절반. 좌표를 여기서 자른다.
   ★ 화면 px 이 아니라 **월드 단위**로 잘라야 한다 — 멀수록 같은 px 이 더 넓은 월드에 해당한다. */
function halfWorld(orient, n, d, camH, camP){
  var st = stageSize(orient, n);
  return (st.w / 2) * camDepth(d, camH, camP) / focalPx(orient, n);
}
/* 높이 worldY · 거리 d 에 있는 점이 무대에서 세로 몇 px 에 찍히는가(0 = 화면 위끝).
   ★ 「무엇이 잘리는가」를 재는 유일한 출처다. 화면(THREE)과 검사기가 각각 계산하면
     각을 바꿨을 때 한쪽만 고쳐진다 — 그러면 검사는 통과하는데 사진에서만 머리가 잘린다. */
function projY(orient, n, worldY, d, camH, camP){
  var H = (camH === undefined) ? CAM_HEIGHT : camH;
  var p = ((camP === undefined) ? CAM_PITCH : camP) * Math.PI / 180;
  var sp = Math.sin(p), cp = Math.cos(p);
  var st = stageSize(orient, n), f = focalPx(orient, n);
  var zc = (H - worldY) * sp + d * cp;               // 렌즈가 보는 방향으로의 깊이
  var yc = (worldY - H) * cp + d * sp;               // 화면 세로축 성분
  return st.h / 2 - yc * f / zc;
}
/* 🚶 그 거리에서 «가운데로부터 좌우로 갈 수 있는 거리»(월드). 좌표를 여기서 자른다.
   ★ 예전에는 몸통 반폭(BODY_W/2)을 통째로 뺐다 — «몸이 전부 화면 안»이라는 뜻이라 좁았다.
     실제 스티커사진은 가장자리에 몸이 조금 걸쳐 나가는 것이 자연스럽다.
     그래서 **반만** 남긴다(EDGE_KEEP) — 어깨 한쪽이 살짝 나가는 자리까지 열어 준다.
     거리 4.2 에서 0.67 → 0.82, 거리 2.0 에서는 0.18 → 0.34 로 두 배 가까이 넓어진다.
   ★ 2026-08-29: «가까이 오면 좌우로 못 간다»를 풀었다(NEAR_SPAN).
     [무엇이 문제였나] 위 식은 «화면 반폭에서 어깨 몫을 뺀 나머지»다. 그래서 몸이 화면보다
       커지는 거리부터는 뺄 값이 남는 값보다 커져 **0 이 되고, 최근접(0.45)에서는 가운데 고정**이었다.
       세로형 기준 화면 반폭 0.15 · 몸통 반폭 0.31 — 애초에 몸이 화면의 두 배라 «어깨를 넣는다»가
       성립하지 않는 구간이다. 클로즈업에서는 얼굴을 한쪽으로 밀어 두는 구도가 오히려 자연스럽다.
     [어떻게 풀었나] 어깨 기준과 **화면 비율 기준** 둘 중 넓은 쪽을 쓴다. NEAR_SPAN 은
       «화면 반폭의 몇 %까지 중심축이 갈 수 있는가»다. 멀리서는 어깨 기준이 항상 더 넓어서
       (거리 4.2 에서 84%) 이 바닥값이 아예 개입하지 않는다 — **기존 구도는 그대로다.**
   ⚠️ 1.0 이 천장이다 — 중심축이 화면 끝에 정확히 서는 자리라, 넘기면 몸 «가운데»가 프레임 밖으로
     나가고 그때부터는 「움직이는데 아무것도 안 보인다」가 된다. 0.85 는 그 앞에 15% 를 남긴 값이다.
   ★ 2026-08-29(둘째 판): **세로형만 더 넓혔다**(0.70 → 0.85).
     [왜 방향마다 다른가] 이 값은 «화면 반폭 대비»라 방향에 따라 실제 폭이 크게 다르다.
       세로 4컷의 화면 반폭은 153px 이고 가로 4컷은 288px 이다 — 같은 0.70 이라도 세로에서는
       107px, 가로에서는 202px 이라 세로만 좁게 느껴진다. 그래서 세로만 올린다.
     ⚠️ 가로형은 0.70 그대로다. 가로는 애초에 어깨 기준이 거의 항상 이겨서 이 바닥값이
       최근접 부근에서만 잠깐 쓰인다 — 올려도 얻는 것이 없고 화면 끝만 헐거워진다.
   ⚠️ 늘리는 것은 여기 한 곳이다. 화면이 따로 빼면 «내 화면에서만» 더 갈 수 있게 되고,
     그러면 남의 화면에서는 가장자리에서 툭 멈춘 것처럼 보인다. */
var EDGE_KEEP = 0.5;      // 몸통 반폭 중 화면 안에 남길 비율 (1 = 몸 전부, 0.5 = 절반)
var NEAR_SPAN_P = 0.85;   // 세로형 — 가까울 때 보장하는 이동 폭(화면 반폭 대비)
var NEAR_SPAN_L = 0.70;   // 가로형 — 같은 뜻이지만 화면이 넓어서 이 값으로 충분하다
function nearSpan(orient){ return orient === 'l' ? NEAR_SPAN_L : NEAR_SPAN_P; }
function xLimit(orient, n, d, camH, camP){
  var hw = halfWorld(orient, n, d, camH, camP);
  return Math.max(0, hw * nearSpan(orient), hw - (BODY_W / 2) * EDGE_KEEP);
}
/* 거리 d 에서 나란히 설 수 있는 인원. 세로 2컷을 뺀 근거가 이 함수다. */
function fitCount(orient, n, d){
  return Math.floor(2 * halfWorld(orient, n, d) / BODY_W);
}

/* ══ 뒷배경 — 캐릭터 뒤에 깔리는 판 ═══════════════════════════════════
   ★ 왜 여기에 있나
     이 판은 **컷 «안»이라 사진에 그대로 찍힌다**(여백을 칠하는 기본 프레임과 다른 층이다).
     그리고 그리는 자리가 셋이다 — 로비의 작은 미리보기 · 무대 · 캡처. 셋이 따로 그리면
     «고른 것»과 «찍힌 것»이 갈라지는데, 그건 다 찍고 나서야 안다. 그래서 함수는 여기 하나다.
   ⚠️ 좌표는 전부 **0~1 비율**이다. 무대(306×420)와 캡처(540×740)는 크기가 다르고 비율만 같다.
     px 로 적으면 캡처에서 그라데이션 중심이 어긋난다 — 화면에는 표시가 안 나는 종류다.
   ⚠️ 이 판은 **방 전체가 같아야 한다.** 캡처는 각자 자기 화면에서 뜨므로 각자 고르게 두면
     같은 촬영인데 사람마다 다른 사진이 나온다. 그래서 meta 를 탄다(setConfig).
   ★ 시안 purikura-design-bg-v2.html 에서 확정한 값들이다. 바꾸려면 시안부터 고칠 것. */
var BG_SKY  = { top:'#4a97fb', low:'#dbebff', glow:0.95 };
var BG_SEPIA= { inn:'#8a5230', mid:'#4a2b1a', out:'#1c1310',
                cy:0.60,      // 빛의 높이 (0=위, 1=아래)
                core:0.06,    // 가운데 밝은 «면»의 크기
                fall:0.54 };  // 어둠이 시작되는 자리 — 0.86 에서 이미 가장 어둡다
/* 목록 순서가 곧 로비에 놓이는 순서다. */
var BGS = [
  { id:'white', name:'하양',   sub:'기본',        flat:'#ffffff' },
  { id:'sky',   name:'하늘',   sub:'그라데이션',  flat:null },
  { id:'sepia', name:'세피아', sub:'그라데이션',  flat:null },
  { id:'blue',  name:'파랑',   sub:'단색',        flat:'#428DDB' },
  { id:'red',   name:'다홍',   sub:'단색',        flat:'#C84C52' },
  { id:'gray',  name:'연회색', sub:'단색',        flat:'#C4CCD7' }
];
function bgList(){ return BGS; }
function bgOf(id){ for(var i=0;i<BGS.length;i++) if(BGS[i].id === id) return BGS[i]; return BGS[0]; }
function bgAllowed(id){ return !!bgOf(id) && bgOf(id).id === id; }

/* ══ 뒷배경을 «여럿» 고르기 ══════════════════════════════════════════════
   하나만 고르면 넉 장이 같은 배경이고, 둘 이상이면 컷마다 섞인다.
   ★ 주고받는 모양은 쉼표로 이은 낱말 하나다('sky,red'). 필드를 새로 만들지 않고
     meta.bg 를 넓힌 것이라, 구버전 앱은 목록에서 못 찾아 «하양»으로 떨어질 뿐 안 깨진다.
   ★★ 섞는 것은 «각자 주사위를 굴리는 것»이 아니다. 사진은 넷이 각자 자기 화면에서 뜨므로
     각자 굴리면 **같은 촬영인데 사람마다 배경이 다른 사진**이 나온다. 그리고 그건 다 찍고
     각자 저장한 뒤에야 안다. → 방 하나에 씨앗 하나(meta.startedAt)를 두고 «계산»으로 뽑는다.
     점프 궤적을 각자 계산하는 것과 같은 방식이고, 그래서 **컷마다 드는 쓰기가 0회**다.
   ⚠️ 씨앗이 아직 없을 때(0)도 값을 내야 한다 — 그때는 목록 순서대로 돈다. 촬영을 시작하면
     startedAt 이 도착하면서 제 순서로 바뀐다. */
var BG_MAX = 6;
function bgParse(v){
  if(typeof v !== 'string' || !v) return ['white'];
  var out = [], parts = v.split(',');
  for(var i = 0; i < parts.length && out.length < BG_MAX; i++){
    var id = parts[i].trim();
    if(bgAllowed(id) && out.indexOf(id) < 0) out.push(id);   // 모르는 값과 중복은 버린다
  }
  return out.length ? out : ['white'];
}
function bgJoin(list){ return bgParse((list || []).join(',')).join(','); }
/* 씨앗에서 0~1. 작고 결정적인 난수 하나 — 방 전원이 같은 값을 본다. */
function bgRnd(seed){
  var t = (seed | 0) + 0x6D2B79F5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
/* ★ «골고루» 방식 — 고른 것을 한 번씩 다 쓰고 나서 다시 섞는다.
   [왜 완전 무작위가 아닌가] 컷마다 따로 뽑으면 둘을 골랐을 때 넉 장이 전부 같은 색으로 나올 확률이
     12.5% 다. 여덟 번에 한 번쯤 «섞으라고 했는데 다 똑같다»가 나온다 —
     사람이 「랜덤」이라는 말에 기대하는 것은 보통 이쪽(골고루)이다.
   ⚠️ 컷 i 하나만 물어봐도 0..i 를 다시 굴려서 낸다. 상태를 들고 있지 않아야
     늦게 들어온 사람도 같은 값을 낸다. */
function bgForCut(list, cutIdx, seed){
  var pool = bgParse((list || []).join(','));
  if(pool.length === 1) return pool[0];
  var bag = [], n = 0, pick = 'white';
  for(var i = 0; i <= (cutIdx | 0); i++){
    if(!bag.length){
      bag = pool.slice();
      for(var j = bag.length - 1; j > 0; j--){          // 피셔–예이츠, 씨앗으로
        var k = Math.floor(bgRnd(seed + (n++) * 104729) * (j + 1));
        var t = bag[j]; bag[j] = bag[k]; bag[k] = t;
      }
    }
    pick = bag.shift();
  }
  return pick;
}
/* 단색이면 그 색, 그라데이션이면 null. 무대는 단색일 때 텍스처 없이 clearColor 만 쓴다. */
function bgFlat(id){ return bgOf(id).flat; }
/* 배경 한 장을 그린다. **로비 미리보기·무대·캡처가 전부 이 함수 하나를 부른다.** */
function drawBg(g, w, h, id){
  var b = bgOf(id);
  if(b.flat){ g.fillStyle = b.flat; g.fillRect(0,0,w,h); return; }
  if(b.id === 'sky'){
    var lin = g.createLinearGradient(0,0,0,h);
    lin.addColorStop(0, BG_SKY.top); lin.addColorStop(1, BG_SKY.low);
    g.fillStyle = lin; g.fillRect(0,0,w,h);
    /* 아래 가운데에서 퍼지는 흰 빛 — 증명사진 배경지의 그 느낌이 여기서 나온다 */
    var r = g.createRadialGradient(w*0.5, h*1.0, 0, w*0.5, h*1.0, Math.max(w,h)*1.15);
    r.addColorStop(0,    'rgba(255,255,255,' + BG_SKY.glow + ')');
    r.addColorStop(0.55, 'rgba(255,255,255,' + (BG_SKY.glow*0.35).toFixed(3) + ')');
    r.addColorStop(1,    'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0,0,w,h);
    return;
  }
  /* 세피아 — 어두운 가장자리를 «넓게» 만드는 방법은 반지름을 줄이는 것이 아니라
     **정지점을 앞으로 당기는 것**이다. 반지름만 줄이면 밝은 원이 작아질 뿐 가장자리는
     여전히 서서히 어두워진다. 0.86 에서 이미 가장 어두운 색에 도달하므로 그 바깥은 전부 같은 어둠이다. */
  var s = g.createRadialGradient(w*0.5, h*BG_SEPIA.cy, 0, w*0.5, h*BG_SEPIA.cy, Math.max(w,h)*0.80);
  s.addColorStop(0,              BG_SEPIA.inn);
  s.addColorStop(BG_SEPIA.core,  BG_SEPIA.inn);
  s.addColorStop(BG_SEPIA.fall,  BG_SEPIA.mid);
  s.addColorStop(0.86,           BG_SEPIA.out);
  s.addColorStop(1,              BG_SEPIA.out);
  g.fillStyle = s; g.fillRect(0,0,w,h);
}

/* ══ 📷 필터 ═══════════════════════════════════════════════════════════
   ★ 왜 여기에 있나 (뒷배경·꾸미기와 정확히 같은 이유다)
     캡처는 **무대와 다른 해상도**로 렌더한다(세로 4컷: 무대 306×420 · 사진 540×740).
     그래서 «픽셀에 기대는 필터»는 화면과 사진이 다르게 나온다 — 도트가 잘아지고 번짐이 약해진다.
     화면에서는 멀쩡한데 **내려받은 파일만 다르고, 저장하고 나서야 안다.**
     → 그리는 규칙을 여기 한 곳에 두고, 무대와 캡처가 **같은 함수를 배율(k)만 바꿔** 부른다.
       k 는 filterScale() 이 정한다. 무대는 1, 캡처는 1.76 이다.
   ⚠️ 여기서 캔버스를 «만들지» 않는다 — 만드는 일은 DOM 이 있는 쪽 몫이라 mk(w,h) 로 받는다.
     (펜의 needsScratch 와 같은 관례다. 그래야 node 로 이 파일만 굴려볼 수 있다.)
   ⚠️ 필터는 컷 «안»에 걸린다 — 뒷배경과 같은 층이고, 여백(기본 프레임)과 올린 프레임에는 안 걸린다.
     그 둘은 캡처 대상 밖이라 애초에 이 함수를 안 지난다.
   ⚠️ 세기(강도)는 안 연다. 슬라이더를 열면 방 전체가 맞춰야 할 값이 하나 더 늘고,
     끌 때마다 쓰기가 나가서 «시선처럼 얹기»를 따로 설계해야 한다. 여섯을 각각 한 자리로 고정한다. */
var PS1_BLOCK  = 3;      // 도트 한 칸(무대 기준 px). 캡처에서는 k 를 곱해 커진다
var PS1_LEVELS = 16;     // 채널당 색 단계 — app.js 의 _PS1_LEVELS(도트 모드)와 같은 값이다
var SOFT_BLUR  = 5.5;    // 뽀샤시 번짐 반경(무대 기준 px)
var SOFT_MIX   = 0.62;   // 번진 판을 얹는 세기
/* ══ 색감 필터 표 ══════════════════════════════════════════════════════
   ★ 여기 있는 것들은 **색만 만진다.** 그래서 배율 k 가 아예 안 들어가고, 무대와 사진이
     저절로 같아진다 — 이 화면에서 제일 안전한 종류다(뽀샤시·PS1 은 크기가 있어서 k 를 탄다).
   ★ 값은 색감 조정판(purikura-color-tuner.html)에서 눈으로 맞춘 그대로다. 여기 말고
     다른 데 색을 적지 않는다 — 새 색감 필터가 생기면 **이 표에 한 줄 더**가 전부다.
   ⚠️ wash 는 [합성방식, 색, 세기] 다. 순서가 곧 얹는 순서라 바꾸면 결과가 달라진다.
   ⚠️ 「만화」는 뺐다(2026-08). 여섯 중 그것만 원본 해상도 픽셀 루프를 돌아서 매 프레임
     비용이 혼자 컸다. 되살릴 일이 있으면 handoff 의 그 절을 먼저 읽을 것. */
var GRADES = {
  mono: { css:'grayscale(1) contrast(1.22)', wash:[] },
  dawn: { css:'contrast(0.82) saturate(2.50) hue-rotate(-11deg)',
          wash:[ ['screen','rgb(0,26,44)',1], ['screen','#7ac6ff',0.40] ] },
  vint: { css:'contrast(0.80) saturate(2.50) hue-rotate(-2deg)',
          wash:[ ['screen','rgb(48,48,48)',1] ] }
};
/* 목록 순서가 곧 줄에 놓이는 순서다. 첫 칸은 반드시 'none' — 끄는 길이 맨 앞에 있어야 한다.
   뒤 셋(흑백·새벽·빈티지)이 «색감» 묶음이라 같은 성격끼리 붙여 둔다. */
var FILTERS = [
  { id:'none', name:'없음',   sub:'기본'     },
  { id:'soft', name:'뽀샤시', sub:'부드럽게' },
  { id:'ps1',  name:'PS1',    sub:'도트'     },
  { id:'mono', name:'흑백',   sub:'모노'     },
  { id:'dawn', name:'새벽',   sub:'푸른빛'   },
  { id:'vint', name:'빈티지', sub:'색바램'   }
];
function filterList(){ return FILTERS; }
function filterOf(id){ for(var i=0;i<FILTERS.length;i++) if(FILTERS[i].id === id) return FILTERS[i]; return FILTERS[0]; }
function filterAllowed(id){ for(var i=0;i<FILTERS.length;i++) if(FILTERS[i].id === id) return true; return false; }
/* 남이 보낸 값을 받을 때 쓴다. 목록에서 빠진 필터(구버전이 보내는 'toon')는 «없음»으로 접는다.
   ⚠️ 그냥 무시하면 내 화면에는 «내가 마지막에 보던 필터»가 그대로 남는다 — 그러면 같은 촬영인데
     사람마다 다른 사진이 나온다. 모르는 값은 한 곳(없음)으로 모으는 것이 맞다. */
function filterIn(id){ return filterAllowed(id) ? id : 'none'; }
/* ★ 캡처가 무대보다 몇 배 큰가. 이 한 줄이 「화면과 사진이 같아 보이는」 이유 전부다. */
function filterScale(orient, n){ return frameSpec(orient, n)[0] / stageSize(orient, n).w; }

/* 필터 한 겹. g 에는 이미 그림이 들어 있고, src 는 그 그림을 담은 캔버스다(g.canvas 와 같아도 된다).
   ⚠️ 색감 필터(GRADES)에는 k 가 안 들어간다 — 색만 만지므로 해상도와 무관하다. 그게 정상이다. */
function applyFilter(g, src, w, h, id, k, mk){
  var f = filterOf(id);
  if(f.id === 'none') return false;
  k = k || 1;
  if(f.id === 'soft'){
    var s = mk(w, h), sg = s.getContext('2d');
    sg.clearRect(0, 0, w, h);                      // 딴 캔버스를 돌려 쓰므로 지난 판을 지우고 쓴다
    sg.filter = 'blur(' + (SOFT_BLUR*k).toFixed(2) + 'px) brightness(1.18) saturate(0.92)';
    sg.drawImage(src, 0, 0, w, h);
    sg.filter = 'none';
    g.save();
    g.globalCompositeOperation = 'lighten'; g.globalAlpha = SOFT_MIX;
    g.drawImage(s, 0, 0, w, h);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 0.10;
    g.fillStyle = '#fff0f4'; g.fillRect(0, 0, w, h);
    g.restore();
    return true;
  }
  if(f.id === 'ps1'){
    /* 작게 줄인 판에서만 계산한다 — 매 프레임 도는 자리라 원본 해상도로 돌리면 무겁다.
       ★ 블록 크기에 k 를 곱하는 이 한 줄이 「사진에서만 도트가 잘아지는」 것을 막는다. */
    var blk = Math.max(1, Math.round(PS1_BLOCK * k));
    var sw = Math.max(2, Math.round(w/blk)), sh = Math.max(2, Math.round(h/blk));
    /* ⚠️ 이 캔버스는 매 프레임 getImageData 를 당한다. 미리 알려 주지 않으면 브라우저가
       GPU 쪽에 두고 매번 되읽어 오면서 경고를 띄우고 실제로도 느리다. */
    var c = mk(sw, sh), cg = c.getContext('2d', { willReadFrequently: true }) || c.getContext('2d');
    cg.clearRect(0, 0, sw, sh);
    cg.drawImage(src, 0, 0, w, h, 0, 0, sw, sh);
    var d = cg.getImageData(0, 0, sw, sh), p = d.data;
    var bay = [0,8,2,10, 12,4,14,6, 3,11,1,9, 15,7,13,5];   // app.js 의 4×4 Bayer 그대로
    for(var y=0; y<sh; y++) for(var x=0; x<sw; x++){
      var i = (y*sw + x) * 4, t = bay[(y%4)*4 + (x%4)] / 16;
      for(var ch=0; ch<3; ch++){
        var v = p[i+ch]/255 + (t - 0.5)/PS1_LEVELS;
        v = Math.floor(v*PS1_LEVELS + 0.5)/PS1_LEVELS * 255;
        p[i+ch] = v < 0 ? 0 : (v > 255 ? 255 : v);
      }
    }
    cg.putImageData(d, 0, 0);
    g.save();
    g.imageSmoothingEnabled = false;               // 도트가 뭉개지면 도트가 아니다
    g.globalCompositeOperation = 'copy';
    g.drawImage(c, 0, 0, sw, sh, 0, 0, w, h);
    g.restore();
    return true;
  }
  /* 색감 필터 — 표 한 줄로 끝난다. 네이티브 필터 한 줄 + 덧칠 몇 장이 전부라 픽셀 루프가 없다. */
  var gr = GRADES[f.id];
  if(!gr) return false;
  /* ⚠️ 자기 캔버스를 자기 위에 그리지 않는다. 「원본을 읽으면서 같은 자리에 쓴다」는
     브라우저마다 결과가 갈리는 자리라, 딴 캔버스를 한 번 거쳐서 확실하게 만든다. */
  var t = mk(w, h), tg = t.getContext('2d');
  tg.clearRect(0, 0, w, h);
  tg.filter = gr.css;
  tg.drawImage(src, 0, 0, w, h);
  tg.filter = 'none';
  g.save();
  g.globalCompositeOperation = 'copy';
  g.drawImage(t, 0, 0, w, h);
  g.restore();
  gr.wash.forEach(function(L){
    g.save();
    g.globalCompositeOperation = L[0];
    g.globalAlpha = L[2];
    g.fillStyle = L[1];
    g.fillRect(0, 0, w, h);
    g.restore();
  });
  return true;
}

/* 줄에 들어갈 축소판의 «내용». 무대를 3D 로 다시 그릴 수는 없으므로 뒷배경 위에 실루엣만 놓는다.
   ⚠️ 이 축소판에는 배율을 안 먹인다(k=1). 40px 안에서 비율대로 줄이면 도트가 0.4px 이 되어
     「없음」과 구별이 안 된다 — 축소판은 «느낌»을 고르는 자리고, 진짜 크기는 무대에서 본다. */
function drawFilterSample(g, w, h, bgId){
  drawBg(g, w, h, bgId);
  var u = h*0.62, y0 = h*0.92;
  [[0.34, 0.86, '#f6dcc6', '#8fbf9a'], [0.66, 0.78, '#eecdb0', '#c98f8f']].forEach(function(o){
    var cx = w*o[0], s = u*o[1];
    g.fillStyle = 'rgba(0,0,0,.16)';
    g.beginPath(); g.ellipse(cx, y0, s*0.20, s*0.045, 0, 0, 6.284); g.fill();
    g.fillStyle = o[3];
    g.fillRect(cx - s*0.16, y0 - s*0.58, s*0.32, s*0.58);
    g.fillStyle = o[2];
    g.beginPath(); g.arc(cx, y0 - s*0.76, s*0.175, 0, 6.284); g.fill();
    g.fillStyle = '#20232b';
    g.beginPath(); g.arc(cx - s*0.06, y0 - s*0.78, s*0.022, 0, 6.284); g.fill();
    g.beginPath(); g.arc(cx + s*0.06, y0 - s*0.78, s*0.022, 0, 6.284); g.fill();
  });
}

/* ══ 꾸미기 — 펜과 스티커 ═════════════════════════════════════════════
   ★ 왜 여기에 있나 (기하와 같은 이유다 — 요금과는 상관이 없다)
     이 덩이는 **틀려도 화면에 표시가 안 나는** 종류를 하나 더 갖고 있다.
     화면(360px)에 그린 것과 저장(1200px)에 그린 것이 **다른 함수로** 그려지면,
     화면에서는 멀쩡한데 내려받은 파일만 선이 어긋난다. 그리고 그건 저장하고 나서야 안다.
     → 그리는 규칙을 여기 한 곳에 두고, 화면과 저장이 **같은 함수를 배율만 바꿔** 부른다.
     THREE 도 DOM 도 안 쓴다. ctx 는 «2D 컨텍스트처럼 생긴 것»이면 되므로 node 에서
     가짜 ctx 로 호출 순서를 그대로 검사할 수 있다(sim-purikura-deco.js §2).
   ⚠️ 여기서 캔버스를 «만들지» 않는다. 만드는 일(scratch)은 DOM 이 있는 쪽 몫이고,
     여기는 «딴 캔버스가 필요한가»(needsScratch)만 알려준다. */

var DECO_DISP = 0.30;      // 화면 배율. 시트 1200×1600 → 360×480 (시안 v9 의 값)
var HIST_MAX  = 60;        // 되돌리기 칸 수
var STK_BOX   = 48;        // 스티커 상자(px, 저장 좌표 아님 — 화면 좌표다)
var STK_FONT  = 40;        // 글리프 크기. 저장할 때 1/DECO_DISP 를 곱한다
var STK_MIN   = 0.35, STK_MAX = 9;
var PEN_W_MIN = 2, PEN_W_MAX = 22, PEN_W_DEF = 7;

var PEN_TYPES = [
  { id:'solid',   name:'기본'   },
  { id:'rainbow', name:'무지개' },
  { id:'outline', name:'외곽선' },
  { id:'hollow',  name:'속 빈'  },
  { id:'glow',    name:'글로우' }
];
/* 🖍️ 펜 팔레트.
   ★ 2026-08-29: 「색이 탁하다」를 고쳤다 — 채도를 92% 로 **통일**했다.
     [무엇이 문제였나] 색마다 채도가 제각각이었다. 노랑 90% · 주황 86% 인데 초록은 38%,
       보라 46% 였다. 그래서 어떤 색은 쨍하고 어떤 색은 가라앉아, 한 팔레트로 안 보였다.
     [92% 는 어디서 왔나] 임의로 고른 값이 아니다. **무지개 펜이 쓰는 값과 같다**
       (penRainbowOne 의 hsl(h 92% 58%)). 같은 창 안에서 무지개만 쨍했던 것이 원인이라,
       거기에 맞추는 것이 팔레트 전체를 한 벌로 만드는 유일한 기준점이었다.
     [색은 안 바꿨다] 색상(H)은 예전 그대로다 — 344·35·53·110·212·266.
       채도와 명도만 맞췄으므로 «쓰던 분홍이 사라졌다» 가 되지 않는다.
   ⚠️ 초록의 외곽선이 하양 → 검정으로 **뒤집힌다.** 채도를 올리면 밝기도 올라
     outlineInk 의 경계(0.6)를 넘기 때문이다 — 고장이 아니라 그 함수가 하는 일이다.
     되돌리려면 초록만 명도를 52% 로 낮추면 되지만, 그러면 그 색만 어두워 보인다.
   ⚠️ 늘리거나 줄일 때는 CSS 도 같이 봐야 한다. 팔레트 칸은 6열 고정이라(.pk-palette 의
     repeat(6,1fr)) 8개는 2줄로 떨어진다. 7개나 9개로 만들면 마지막 줄이 비뚤어진다. */
var PEN_COLORS = ['#f63166','#f6a431','#f6df31','#52f631','#318df6','#8731f6','#2b2b2b','#ffffff'];
var STICKERS   = ['💖','⭐','🌈','🎀','✨','🍓','🐰','☁️','🍭','👑','🌸','💫'];

/* 획 여러 개를 «한 겹»으로 묶는다 ───────────────────────────────────
   [제보] 선을 하나 그을 때마다 층이 진다. 외곽선·속 빈·글로우가 특히 심하다.
   [원인] 획마다 따로 그렸다. 나중 획의 **외곽선이 먼저 획의 몸통 위에** 얹히고,
     속 빈 펜은 나중 획이 먼저 획을 뚫어 버리고, 글로우는 겹친 자리만 두 번 발광한다.
     무지개는 몸통뿐이라 겹쳐도 티가 안 났다 — 그것만 멀쩡해 보였던 이유다.
   [해결] 같은 설정(종류·색·굵기)으로 **이어** 그은 획을 한 묶음으로 모아 효과를 묶음에 한 번 건다.
   ⚠️ 색이나 굵기를 바꾸면 묶음이 끊긴다. 그게 맞다 — 다른 색 획 사이에 외곽선이 보이는 것이
     외곽선 펜의 정상 동작이다. */
function strokeGroups(list){
  var gs = [];
  (list || []).forEach(function(s){
    var last = gs[gs.length - 1];
    /* 무지개는 획마다 색이 도는 시작점(hue0)이 달라 묶을 수 없다 — 원래 겹쳐도 멀쩡하다 */
    if(last && s.t !== 'rainbow' && last[0].t === s.t && last[0].c === s.c && last[0].w === s.w) last.push(s);
    else gs.push([s]);
  });
  return gs;
}
/* 속 빈 펜만 딴 캔버스를 거친다. destination-out 을 시트에 바로 쓰면 **밑의 사진까지 뚫린다.** */
function needsScratch(type){ return type === 'hollow'; }
/* 외곽선의 색 — 밝은 펜에는 검정, 어두운 펜에는 하양. */
function outlineInk(hex){
  var n = parseInt(String(hex).slice(1), 16);
  var l = (0.2126*(n>>16&255) + 0.7152*(n>>8&255) + 0.0722*(n&255)) / 255;
  return l > 0.6 ? '#1a1a1a' : '#ffffff';
}
/* 묶음의 모든 획을 **하나의 경로**로 잇는다. 한 번의 stroke() 로 그려야
   그림자·합성이 묶음 전체에 한 번만 걸린다.
   ★ 점은 언제나 «저장 해상도(1200×1600) 좌표»다. k 만 곱해서 줄인다 —
     화면 좌표로 담으면 저장할 때 배율이 두 번 곱해져 선이 어긋난다(실제로 그랬다). */
function penPath(g, group, k){
  g.beginPath();
  group.forEach(function(s){
    var p = s.p;
    if(!p || !p.length) return;
    if(p.length === 1){ g.moveTo(p[0][0]*k, p[0][1]*k); g.lineTo(p[0][0]*k + 0.01, p[0][1]*k); return; }
    g.moveTo(p[0][0]*k, p[0][1]*k);
    for(var i = 1; i < p.length; i++) g.lineTo(p[i][0]*k, p[i][1]*k);
  });
}
function penRainbowOne(g, s, k){
  var w = Math.max(1, s.w*k), p = s.p;
  g.lineWidth = w;
  if(p.length === 1){
    g.fillStyle = 'hsl(' + s.hue0 + ' 92% 58%)';
    g.beginPath(); g.arc(p[0][0]*k, p[0][1]*k, w/2, 0, 7); g.fill(); return;
  }
  var d = 0;
  for(var i = 1; i < p.length; i++){
    var a = [p[i-1][0]*k, p[i-1][1]*k], b = [p[i][0]*k, p[i][1]*k];
    d += Math.hypot(b[0]-a[0], b[1]-a[1]);
    g.strokeStyle = 'hsl(' + ((s.hue0 + d*1.1) % 360) + ' 92% 58%)';
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
  }
}
/* 묶음 하나를 ctx 에 그린다. **화면도 저장도 이 함수 하나**를 배율만 바꿔 부른다. */
function penRender(g, group, k){
  var s0 = group[0], w = Math.max(1, s0.w*k);
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';

  if(s0.t === 'rainbow'){
    group.forEach(function(s){ penRainbowOne(g, s, k); });
  }
  else if(s0.t === 'outline'){
    /* 바깥선을 **묶음 전체에 먼저** 다 깔고, 그 위에 몸통을 다 얹는다.
       순서를 획마다 번갈아 하면 그게 바로 층이 지는 그 증상이다. */
    var ow = Math.max(1.5, w*0.34);
    g.strokeStyle = outlineInk(s0.c);
    g.lineWidth = w + ow*2; penPath(g, group, k); g.stroke();
    g.strokeStyle = s0.c; g.lineWidth = w; penPath(g, group, k); g.stroke();
  }
  else if(s0.t === 'hollow'){
    var inner = Math.max(0.5, w - Math.max(2.2, w*0.42)*2);
    g.strokeStyle = s0.c; g.lineWidth = w; penPath(g, group, k); g.stroke();
    g.globalCompositeOperation = 'destination-out';
    g.lineWidth = inner; penPath(g, group, k); g.stroke();      // 합집합을 한 번에 뚫는다
    g.globalCompositeOperation = 'source-over';
  }
  else if(s0.t === 'glow'){
    g.shadowColor = s0.c; g.strokeStyle = s0.c;
    g.shadowBlur = w*2.2; g.lineWidth = w*0.72;
    penPath(g, group, k); g.stroke(); g.stroke();               // 겹친 자리만 더 밝아지지 않는다
    g.shadowBlur = w*1.1; g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(1, w*0.3);
    penPath(g, group, k); g.stroke();
  }
  else{
    g.strokeStyle = s0.c; g.lineWidth = w; penPath(g, group, k); g.stroke();
  }
  g.restore();
}
function stkClamp(s){ return Math.max(STK_MIN, Math.min(STK_MAX, s)); }
function penWClamp(w){ return Math.max(PEN_W_MIN, Math.min(PEN_W_MAX, Math.round(w))); }

/* ══ 날짜 — 하루의 경계는 한국 시간 자정 ═══════════════════════════════ */
var DAY_MS  = 86400000;
var KST_OFF = 9 * 3600 * 1000;

/* 오늘이 며칠인가를 하나의 숫자로. 값은 「KST 일 번호 × 하루(ms)」다.
   ★ 이 모양이어야 서버 규칙이 검증할 수 있다 —
     하루(ms)의 배수이고, now+9h 보다 작고, now+9h-24h 보다 크다.
     규칙에는 floor() 가 없어서 "몫"을 직접 못 구한다. 그래서 클라이언트가 계산한 값을
     이 세 조건으로 **검사만** 한다. 그러면 내일 칸에 미리 써두는 짓을 막을 수 있다. */
function kstDay(nowMs){ return Math.floor((nowMs + KST_OFF) / DAY_MS) * DAY_MS; }

/* 다음에 열리는 시각(UTC ms) = 다음 KST 자정 */
function reopenAt(nowMs){ return kstDay(nowMs) + DAY_MS - KST_OFF; }

/* 안내 문구. 여는 시각을 상수로 박지 않고 reopenAt 에서 뽑는다 —
   나중에 여는 시각을 바꾸면 문구가 저절로 따라온다. */
function closedMessage(nowMs){
  var t = reopenAt(nowMs);
  var h = Math.floor(((t + KST_OFF) % DAY_MS) / 3600000);
  return '📷 스티커사진이 문을 닫았어요. 내일 ' + h + '시에 열려요.';
}

/* ══ 좌표 인코딩 ═══════════════════════════════════════════════════════
   한 사람의 좌표는 문자열 하나다: "좌우,거리" (둘 다 정수).
   필드를 둘로 나누면 JSON 키가 하나 더 붙는데, 경로 오버헤드가 지배적인
   구간이라 필드 수를 줄이는 쪽이 이득이다. */
/* 좌표 + 시선을 한 문자열로.
   ★ 시선(gz·gp)은 **덤으로만 실린다.** 좌표 때문에 나가는 메시지에 얹기만 하고,
     시선이 바뀌었다고 새 메시지를 만들지 않는다(sendPos 의 데드밴드는 좌표만 본다).
     → 마우스를 아무리 흔들어도 **쓰기 횟수가 안 는다.** 이 화면의 요금은 그대로다.
   ⚠️ 옛 클라이언트가 읽어도 안 깨진다 — parseInt 가 쉼표에서 멈춰서 wx·d 는 그대로 나온다.
     반대로 옛 클라이언트가 두 칸만 써도 여기서 시선 0 으로 읽힌다. 규칙도 세 번째·네 번째 칸을
     «있어도 되고 없어도 되는» 것으로 두었다. */
function encPos(wx, d, gz, gp, yaw){
  var s = Math.round(wx * POS_Q) + ',' + Math.round(d * POS_Q);
  /* 꼬리 셋은 **한 덩이**다 — 있거나 없거나. 반쪽만 열어두면 받는 쪽이 어느 축인지 못 정한다. */
  if(gz || gp || yaw){
    s += ',' + Math.round((gz || 0) * GAZE_Q) +
         ',' + Math.round((gp || 0) * GAZE_Q) +
         ',' + Math.round((yaw || 0) * YAW_Q);
  }
  return s;
}
function decPos(s){
  if(typeof s !== 'string') return null;
  var f = s.split(',');
  if(f.length < 2) return null;
  var a = parseInt(f[0], 10), b = parseInt(f[1], 10);
  if(!isFinite(a) || !isFinite(b)) return null;
  var has = (f.length > 4);
  var gz = has ? parseInt(f[2], 10) : 0;
  var gp = has ? parseInt(f[3], 10) : 0;
  var yw = has ? parseInt(f[4], 10) : 0;
  if(!isFinite(gz)) gz = 0;
  if(!isFinite(gp)) gp = 0;
  if(!isFinite(yw)) yw = 0;
  return { wx: a / POS_Q, d: b / POS_Q, gz: gz / GAZE_Q, gp: gp / GAZE_Q, yaw: yw / YAW_Q };
}

/* ══ 하루 정원 ═════════════════════════════════════════════════════════
   전역 노드 하나(photoQuota = {day, n})를 트랜잭션으로 올린다.
   ⚠️ 클라이언트 카운터로는 못 막는다 — 규칙에서 "정확히 1 증가 · CAP_PER_DAY 이하 · 날짜는 서버 시각"
     을 검사해야 실제로 막힌다. firebase-rules-purikura.json 참고. */
function quotaNext(cur, day){
  if(!cur || typeof cur.day !== 'number' || cur.day < day) return { day: day, n: 1 };  // 새 날 = 초기화
  if(cur.day > day) return null;                       // 내 시계가 뒤에 있다 — 쓰지 않는다
  var n = cur.n | 0;
  if(n >= CAP_PER_DAY) return null;                    // 오늘치 소진
  return { day: day, n: n + 1 };
}
function quotaLeft(cur, day){
  /* ★ 저장된 날이 오늘이 아니면 아직 아무도 안 찍은 것이다 —
     자정이 지나면 아무도 쓰기를 안 해도 숫자가 저절로 되살아나야 한다.
     여기서 day 를 안 보면 새벽에 "0회 남음"이 그대로 떠 있는다. */
  if(!cur || typeof cur.day !== 'number' || cur.day !== day) return CAP_PER_DAY;
  return Math.max(0, CAP_PER_DAY - (cur.n | 0));
}
function quotaUsed(cur, day){ return CAP_PER_DAY - quotaLeft(cur, day); }

/* 화면에 쓸 문구. 두 가지 모양을 같은 곳에서 만든다 —
   두 군데서 각자 조립하면 언젠가 한쪽만 고쳐진다. */
function quotaLabel(cur, day){
  var left = quotaLeft(cur, day);
  return left + ' / ' + CAP_PER_DAY;                    // 예: "395 / 400"
}
function nthLabel(n){
  return n + '번째 · ' + Math.max(0, CAP_PER_DAY - n) + '회 남음';   // 예: "5번째 · 195회 남음"
}

/* ══ 세션 ══════════════════════════════════════════════════════════════ */
function makeSession(api, opts){
  opts = opts || {};
  var room = null, slot = -1, myId = null, myName = '';
  var unsubPos = null, unsubMeta = null, unsubEv = null, unsubShot = null;
  /* 🪑 지금 자리 배치. adoptSlots() 로 «바깥에서» 받는다 — 이 계층은 slots 를 직접 구독하지 않는다.
     [왜 구독하지 않나] app.js 가 이미 같은 노드를 구독하고 있다(PK.unslots). 여기서 하나 더 걸면
       읽기가 두 배가 되는데, 얻는 것은 «같은 값»뿐이다. 그래서 값만 넘겨받는다 — 추가 요금 0원.
     ⚠️ 이걸 안 받으면 hostSlot 이 영영 -1 이라 **아무도 방장이 아니게 된다.**
       app.js 쪽 구독 콜백에서 반드시 adoptSlots 를 부를 것. */
  var slotsSnap = null, hostSlot = -1;
  var beatTimer = 0;
  var lastSent = { wx: null, d: null, t: 0 };
  /* 전송 간격을 재는 시계. 기본은 벽시계이고, 검사에서는 가짜 시계를 넣는다.
     ⚠️ 서버 시각(serverNow)을 쓰면 안 된다 — 그쪽은 오프셋 보정이 늦게 붙어서
       입장 직후 몇 초 동안 간격 계산이 튄다. 간격은 내 기기 안에서만 재면 된다. */
  var clock = opts.clock || Date.now;
  var peers = {};                 // slot → {wx,d}
  var meta  = null;
  var onPeers = opts.onPeers || function(){};
  var onMeta  = opts.onMeta  || function(){};
  var onEvent = opts.onEvent || function(){};
  var onShot  = opts.onShot  || function(){};

  /* ⚠️⚠️ 노드 이름의 밑줄은 장식이 아니다 — 이걸 `photo` 로 바꾸면 ①번 규칙이 통째로 무너진다.
     [왜] firebase-init.js 의 방 프리즌스 리스너가 `orderByKey().startAt('m')` 으로 걸려 있다.
       방 자식은 세 종류라는 전제였다 — `_meta`(0x5F) · `chatLog`(0x63) · 멤버('m', 0x6D).
       'p' 는 'm' 보다 뒤라, `photo` 라고 이름 붙이면 **방에 있는 사람 전원(최대 8명)의
       프리즌스 스냅샷에 이 노드가 통째로 딸려온다.** 좌표가 10Hz 로 바뀌므로 그때마다
       slots·meta·frames URL 까지 전부 다시 내려간다 — 별도 노드로 뺀 의미가 사라지고
       핸드오프 §2 ①의 1.70원 → 24.36원 이 그대로 재현된다.
     [게다가] 멤버를 세는 자리 셋이 전부 '_ 로 시작하면 멤버가 아니다' 로 짜여 있다
       (_roomOccupants · getRoomCounts 의 shallow 훑기 · 첫 스냅샷 청소).
       `photo` 는 그 셋을 다 통과해서 **유령 멤버 한 명**으로 세어진다.
     → 그래서 `_meta` 와 같은 반의 이름을 쓴다. sim-purikura-rules.js §3 이 이걸 지킨다. */
  function base(){ return 'rooms/' + room + '/_photo'; }
  function P(sub){ return base() + '/' + sub; }
  function now(){ return api.serverNow ? api.serverNow() : Date.now(); }

  /* ── 하루 정원 확인 (읽기만 — 문 앞에서 안내를 띄우는 용도) ── */
  function checkQuota(){
    return api.pkGet('photoQuota').then(function(cur){
      var day = kstDay(now());
      var left = quotaLeft(cur, day);
      return { ok: left > 0, left: left, used: quotaUsed(cur, day), cap: CAP_PER_DAY,
               label: quotaLabel(cur, day),
               reopenAt: reopenAt(now()), message: left > 0 ? '' : closedMessage(now()) };
    });
  }

  /* ── 정원 한 칸 쓰기. **촬영 시작 순간에** 부른다.
       ⚠️ 방을 여는 순간에 쓰면 안 된다 — 들어왔다 그냥 나가는 사람이 하루치를 갉아먹는다. */
  function takeQuota(){
    var day = kstDay(now());
    return api.pkTransaction('photoQuota', function(cur){
      return quotaNext(cur, day);
    }).then(function(r){
      if(r && r.committed){
        var n = r.value ? (r.value.n | 0) : 0;
        return { ok: true, n: n, left: Math.max(0, CAP_PER_DAY - n), nth: nthLabel(n) };
      }
      /* 여기로 오는 경우가 실제로 있다 — 두 방이 동시에 마지막 한 장을 노리면
         한쪽만 통과한다. 시작 버튼 자리에서 걸리는 게 그나마 가장 나은 지점이다. */
      return { ok: false, left: 0, message: closedMessage(now()), reopenAt: reopenAt(now()),
               reason: 'closed' };
    });
  }

  /* ── 문 앞에서 방을 들여다본다 (읽기만) ──
     ★ **자리를 잡기 전에** 봐야 한다. open() 은 트랜잭션으로 먼저 자리를 집으므로, 잡고 나서
       되돌리면 그 짧은 사이에 남이 못 들어온다. 그래서 읽기 두 번을 먼저 쓴다.

     ★ 「방장이 나가면 초기화」의 구현이 `hostAlive` 다 — 되돌리는 쓰기가 없다.
       방장이 나가면 onDisconnect 가 `slots/0` 을 지우므로 busy 가 저절로 풀린다.
       브라우저가 강제 종료돼서 `meta.state` 가 'shooting' 인 채로 남아도 방이 영영 잠기지 않는다.
       ⚠️ meta 를 지우는 방식으로 만들면 이 자기복구가 없어진다. 하지 말 것.

     ⚠️ **이미 들어와 있던 사람은 막지 않는다**(mine). 안 그러면 촬영 중에 새로고침한 사람이
       자기 방에 다시 못 들어온다 — open() 은 같은 uid 면 그 자리를 그대로 돌려준다.

     ⚠️ slot.at 은 들어올 때 한 번만 적고 심장박동을 안 뛴다. 그래서 TTL 이 지나면 살아 있는
       방장도 죽은 것으로 보인다. busy 는 `state==='shooting'` 일 때만 서는데 촬영 구간은
       길어야 몇 분이라 실제로 걸리지 않는다. 심장박동을 새로 만들 이유가 없다.

     ⚠️ 여는 순간과 실제 입장 사이에는 틈이 있다(읽고 → 잡는다). 그 사이에 방장이 촬영을
       시작하면 늦게 들어간다 — 그건 원래 되는 경우다(_pkOnShot 이 옛 신호를 흘린다). */
  function peek(roomCode, myUserId){
    var pre = 'rooms/' + roomCode + '/_photo/';
    return Promise.all([ api.pkGet(pre + 'meta'), api.pkGet(pre + 'slots') ]).then(function(r){
      var meta = r[0] || {}, slots = r[1] || {}, t = now();
      var live = function(v){ return !!(v && typeof v.at === 'number' && (t - v.at) < SLOT_TTL_MS); };
      var hostAlive = live(slots['0'] || slots[0]);
      var mine = false;
      for(var k in slots) if(live(slots[k]) && myUserId && slots[k].uid === myUserId) mine = true;
      /* 서버는 lobby|shooting|done 세 값을 쓴다. 앱의 'deco' 가 서버의 'done' 이다 —
         꾸미는 중에는 촬영이 끝난 것이므로 방을 다시 연다. */
      var state = meta.state || 'lobby';
      return { state: state, hostAlive: hostAlive, mine: mine,
               busy: (state === 'shooting') && hostAlive && !mine };
    }).catch(function(e){
      /* ⚠️ 못 읽었으면 **막지 않는다.** 읽기 한 번이 실패했다고 문을 잠그면, 통신이 잠깐
         흔들린 사람은 아무 이유도 모른 채 못 들어온다. 막는 쪽이 더 나쁜 고장이다. */
      console.warn('[스티커사진] 방 상태를 못 읽었어요 — 그냥 들어갑니다', e);
      return { state: 'lobby', hostAlive: false, mine: false, busy: false, unknown: true };
    });
  }

  /* ── 자리 잡기 (선착순 4). 트랜잭션으로 slots 통째를 다룬다 —
       칸마다 따로 쓰면 두 사람이 같은 칸을 동시에 집는다. ── */
  function open(roomCode, me){
    room = roomCode; myId = me.userId; myName = me.name || '';
    var t = now();
    return api.pkTransaction(P('slots'), function(cur){
      cur = cur || {};
      /* 죽은 세션 걷어내기 — 브라우저가 꺼지면 onDisconnect 가 지우지만,
         그것마저 못 돌았을 때를 위해 오래된 자리는 여기서 무효로 본다. */
      var live = {};
      for(var k in cur){
        var v = cur[k];
        if(v && typeof v.at === 'number' && (t - v.at) < SLOT_TTL_MS) live[k] = v;
      }
      /* 이미 들어와 있으면 그 자리를 그대로 쓴다(새로고침·재접속) */
      for(var k2 in live) if(live[k2] && live[k2].uid === myId){ live[k2].at = t; return live; }
      for(var i = 0; i < MAX_SLOTS; i++){
        if(!live[i]){ live[i] = { uid: myId, name: myName, at: t }; return live; }
      }
      return undefined;                       // 만석 — 트랜잭션 취소
    }).then(function(r){
      if(!r || !r.committed) return { ok: false, reason: 'full' };
      var v = r.value || {};
      /* 트랜잭션 결과가 곧 지금의 자리 배치다 — 구독이 도착하기 전에도 방장 판정이 서야 한다.
         ⚠️ 이걸 안 채우면 창을 연 직후 hostSlot 이 -1 이라 방장조차 단추가 잠긴 채로 시작한다. */
      adoptSlots(v);
      if(slot < 0) return { ok: false, reason: 'full' };
      /* 브라우저가 꺼져도 자리와 좌표는 사라진다 */
      var p1 = api.pkOnDisconnectRemove(P('slots/' + slot));
      var p2 = api.pkOnDisconnectRemove(P('p/' + slot));
      subscribe();
      startBeat();                     // 💓 이때부터 «살아 있다»를 알린다
      return Promise.all([p1, p2]).then(function(){
        return { ok: true, slot: slot, host: isHost() };
      });
    });
  }

  /* 촬영 창이 열려 있는 동안만 남은 횟수를 지켜본다.
     ⚠️ 접속자 전원이 상시 구독하게 만들지 말 것. 비용 자체는 월 500원대로 작지만,
       아무도 안 보는 화면을 위해 하루 400번의 갱신을 전원에게 뿌리는 구조가 된다.
       창을 연 사람만 보면 월 9원이다. */
  function watchQuota(cb){
    return api.pkOnValue('photoQuota', function(cur){
      var day = kstDay(now());
      cb({ left: quotaLeft(cur, day), used: quotaUsed(cur, day), cap: CAP_PER_DAY,
           label: quotaLabel(cur, day), ok: quotaLeft(cur, day) > 0 });
    });
  }

/* 🪑 자리 배치를 받아 «내 자리»와 «방장 자리»를 다시 낸다.
   ★ 방장 = **살아 있는 자리 중 가장 작은 번호.** 예전에는 그냥 0번이었는데, 0번이 나가면
     남은 사람은 아무도 승계하지 못해 방이 통째로 멎었다(단추가 전부 잠기고 촬영을 시작할 수 없다).
     자리를 옮기지 않고 «정의»만 바꾼 것이라 좌표 노드(p/$i)도 onDisconnect 예약도 그대로다.
   ★ slot 도 여기서 다시 찾는다. 예전에는 open() 이 정한 값이 **끝까지 갱신되지 않아서**,
     자리를 잃은 뒤에도 스스로를 방장으로 알고 남의 칸에 좌표를 계속 썼다.
   ⚠️ 빈 스냅샷은 무시한다 — 구독이 붙는 순간이나 통신이 흔들릴 때 잠깐 비어서 오는데,
     그걸 그대로 받으면 멀쩡한 세션이 자기 자리를 잃는다.
   ⚠️ 규칙도 **같은 식**을 본다(firebase-database-rules.json 의 meta .write).
     한쪽만 고치면 화면은 방장이라는데 서버가 거부하는, 예전과 똑같은 상태로 돌아간다. */
  function adoptSlots(o){
    var n = 0, k;
    for(k in (o || {})) n++;
    if(!n) return;
    slotsSnap = o;
    var mine = -1, host = -1;
    for(var i = 0; i < MAX_SLOTS; i++){
      var v = o[i];
      if(!v || !v.uid) continue;
      if(host < 0) host = i;
      if(v.uid === myId) mine = i;
    }
    hostSlot = host;
    slot = mine;                      // 내 자리가 사라졌으면 -1 — sendPos 도 하트비트도 그 자리에서 멎는다
    if(slot < 0) stopBeat();
  }
  function hostUid(){
    for(var i = 0; i < MAX_SLOTS; i++){
      var v = slotsSnap && slotsSnap[i];
      if(v && v.uid) return v.uid;
    }
    return null;
  }
  /* isHost 는 **자리 배치를 받은 뒤에만** 참이 된다.
     ⚠️ hostSlot < 0 (아직 못 받음)일 때 slot===0 으로 참을 주면, 예전의 「방장이 둘」이 그대로 돌아온다.
       못 받은 동안은 방장이 아닌 편이 안전하다 — 단추가 잠깐 잠길 뿐, 남의 설정을 덮어쓰지는 않는다. */
  function isHost(){ return slot >= 0 && hostSlot >= 0 && slot === hostSlot; }
  function mySlot(){ return slot; }
  function hostSlotIdx(){ return hostSlot; }

  /* 💓 자리가 살아 있다고 알린다 — slots/{내자리}/at 한 칸만 쓴다.
     ★ 좌표 전송에 얹지 않는다. sendPos 는 «안 움직이면 안 보낸다»가 규칙이라,
       가만히 서서 프레임을 고르는 15분 동안 한 번도 안 나간다 — 그때가 바로 잘리는 때다.
     ⚠️ 규칙은 손 안 대도 통과한다. slots/$i 의 .validate 는 **병합된** 노드를 보므로
       at 만 써도 uid 가 그대로 남아 hasChildren(['uid','at']) 을 만족한다. */
  function beat(){
    if(!room || slot < 0) return Promise.resolve(false);
    return api.pkSet(P('slots/' + slot + '/at'), now()).then(function(){ return true; })
      .catch(function(e){ console.warn('[스티커사진] 자리 갱신 실패', e); return false; });
  }
  function startBeat(){
    stopBeat();
    if(typeof setInterval !== 'function') return;      // node 검사 환경에서 꺼 둘 수 있게
    beatTimer = setInterval(beat, BEAT_MS);
  }
  function stopBeat(){
    if(beatTimer){ try{ clearInterval(beatTimer); }catch(_){} beatTimer = 0; }
  }

  /* ── 구독 ──
     ⚠️ 구독은 photo 아래 **필요한 가지만** 건다. photo 통째로 구독하면
       프레임 URL·메타까지 좌표가 바뀔 때마다 다시 내려온다. */
  function subscribe(){
    unsubscribe();
    unsubPos = api.pkOnValue(P('p'), function(obj){
      peers = {};
      obj = obj || {};
      for(var k in obj){
        var v = decPos(obj[k]);
        if(v && (+k) !== slot) peers[+k] = v;     // 내 것은 되받지 않는다
      }
      onPeers(peers);
    });
    unsubMeta = api.pkOnValue(P('meta'), function(m){ meta = m || null; onMeta(meta); });
    unsubEv   = api.pkOnValue(P('ev'), function(o){
      o = o || {};
      for(var k in o) if((+k) !== slot && o[k]) onEvent(+k, o[k]);
    });
    unsubShot = api.pkOnValue(P('shot'), function(s){ if(s) onShot(s); });
  }
  function unsubscribe(){
    [unsubPos, unsubMeta, unsubEv, unsubShot].forEach(function(f){ if(f) try{ f(); }catch(_){} });
    unsubPos = unsubMeta = unsubEv = unsubShot = null;
  }

  /* ── 방장만 정하는 값 ──
     ★★ meta 로 나가는 쓰기는 **예외 없이 host: myId 를 함께 쓴다.**
       [왜] 새 규칙은 「host 로 적힌 사람이 지금 방장 자리(살아 있는 자리 중 가장 작은 번호)의
         주인인가」 하나만 본다. 그래서 부분 갱신(필터·카메라·컷·시작·끝)이 host 를 빼먹으면
         병합된 값에 **옛 방장**이 남아 그 쓰기가 통째로 거부된다 — 승계 직후가 딱 그 상황이다.
       [옛 규칙과의 차이] 예전에는 「host 를 그대로 두면 누구나 쓸 수 있다」는 가지가 있었다.
         그것 때문에 자리를 잃은 옛 방장이 계속 meta 를 덮어썼고, 「마지막에 host 를 쥔 쪽만
         쓸 수 있는」 상태가 되어 둘이 번갈아 고르면 되었다 안 되었다 했다.
       ⚠️ 이 규약을 깨는 meta 쓰기를 새로 만들면 그 하나만 조용히 거부된다.
         sim-purikura-host.js 가 «모든 pkUpdate(meta) 에 host 가 있는가»를 센다. */
  function setConfig(cfg){
    if(!isHost()) return Promise.resolve(false);
    /* ⚠️ 여기서 걸러야 한다 — 세로 2컷은 규칙이 거부하므로, 안 거르면 쓰기가 통째로 실패하고
       화면은 "아무 반응 없음"이 된다. 화면과 규칙 사이에서 이 계층이 먼저 막는다. */
    if(!cutAllowed(cfg.orient, cfg.cuts)) return Promise.resolve(false);
    /* 뒷배경도 여기서 먼저 거른다 — 규칙이 목록에 없는 값을 거부하므로, 안 거르면 쓰기가
       통째로 실패해서 «방향·컷까지 같이» 안 바뀐다(한 번의 update 라 전부 아니면 전무다). */
    /* 뒷배경은 이제 «목록»이다. 모르는 값이 섞여 있으면 여기서 통째로 막는다 —
       규칙에만 맡기면 쓰기가 실패해서 방향·컷까지 같이 안 바뀐다(한 번의 update 다). */
    if(cfg.bg && bgJoin(String(cfg.bg).split(',')) !== String(cfg.bg)) return Promise.resolve(false);
    /* 필터도 같은 이유로 여기서 먼저 거른다 — meta 는 $other:false 라 모르는 값이면 통째로 실패한다. */
    if(cfg.filter && !filterAllowed(cfg.filter)) return Promise.resolve(false);
    return api.pkUpdate(P('meta'), {
      host: myId, orient: cfg.orient, cuts: cfg.cuts, basic: cfg.basic,
      bg: cfg.bg || 'white', filter: cfg.filter || 'none',
      camH: camClampH(cfg.camH === undefined ? CAM_HEIGHT : cfg.camH),
      camP: camClampP(cfg.camP === undefined ? CAM_PITCH : cfg.camP),
      state: 'lobby'
    }).then(function(){ return true; });
  }
  /* 📷 필터만 바꾼다 — **촬영 중에 부르는 길이 이것 하나다.**
     ⚠️ 촬영 중에 setConfig 를 부르면 안 된다. 저쪽은 state:'lobby' 를 함께 쓰기 때문에
       방 전원이 촬영 중에 로비로 되돌아가고, 카운트다운도 셔터도 그 자리에서 끊긴다.
       그래서 이 함수는 **한 칸만** 쓴다. 컷당 많아야 몇 번이라 점프·포즈와 같은 값싼 쓰기다. */
  /* 🎚️ 카메라만 바꾼다 — 필터와 **같은 이유**로 setConfig 를 안 쓴다(저쪽은 state:'lobby' 를 함께 쓴다).
     ⚠️ 부르는 쪽에서 **모아서** 부를 것. ▲ 를 열 번 누르면 열 번 쓰게 된다. */
  function setCam(h, p){
    if(!isHost()) return Promise.resolve(false);
    return api.pkUpdate(P('meta'), { host: myId, camH: camClampH(h), camP: camClampP(p) })
      .then(function(){ return true; });
  }
  function setFilter(id){
    if(!isHost()) return Promise.resolve(false);
    if(!filterAllowed(id)) return Promise.resolve(false);
    return api.pkUpdate(P('meta'), { host: myId, filter: id }).then(function(){ return true; });
  }
  /* 지금 찍는 컷과 그 컷의 카운트다운이 **언제 시작됐는지**를 방장이 적는다.
     ★ 카운트다운을 각자 자기 타이머로 세면 기기마다 1~2초씩 어긋나고, 그러면 늦은 사람은
       셔터가 터진 뒤에도 움직이고 있다. 시작 시각 하나만 공유하면 전부 같은 숫자를 본다.
       컷당 쓰기 1회 — 최대 4회다. */
  function setCut(i, atMs){
    if(!isHost()) return Promise.resolve(false);
    /* ⚠️ 0 은 «아직 안 눌렀다»는 신호다 — || 로 떨어뜨리면 안 된다.
       그렇게 두면 기다리는 구간을 알리려고 부른 setCut(i, 0) 이 «지금 시각»을 써서,
       남은 사람들이 방장은 아직 누르지도 않았는데 혼자 카운트다운을 시작한다. */
    var at = (atMs === 0) ? 0 : (atMs || now());
    return api.pkUpdate(P('meta'), { host: myId, state:'shooting', cut:(i|0), cutAt:at })
      .then(function(){ return true; });
  }
  function setDone(){
    if(!isHost()) return Promise.resolve(false);
    return api.pkUpdate(P('meta'), { host: myId, state:'done' }).then(function(){ return true; });
  }
  /* 프레임은 **URL 만** 올린다. 이미지 자체를 RTDB 에 실으면 다운로드 단가가 40배다
     ($5/GB vs $0.12/GB). app.js 의 ROOM_FACE_SEND_DATAURL=false 와 같은 이유. */
  function setFrameUrl(i, url){
    if(!isHost()) return Promise.resolve(false);
    var o = {}; o[i] = url || null;
    return api.pkUpdate(P('frames'), o).then(function(){ return true; });
  }
  function start(){
    if(!isHost()) return Promise.resolve({ ok: false, reason: 'not-host' });
    return takeQuota().then(function(q){
      if(!q.ok) return q;
      /* ⚠️ cut·cutAt 을 여기서 **비운다.** 지난 촬영의 값이 노드에 그대로 남아 있는데,
         이제는 방장이 «촬영» 을 누를 때까지 기다리는 구간이 길어서 그 사이에 남은 사람들이
         옛 cutAt 을 보고 혼자 카운트다운을 시작한다. cutAt:0 이 곧 «아직 안 눌렀다»는 표시다. */
      return api.pkUpdate(P('meta'), { host: myId, state: 'shooting', startedAt: now(), cut: 0, cutAt: 0 })
        .then(function(){ return { ok: true }; });
    });
  }

  /* ── 좌표 ──
     보낸 값과 견줘서 **실제로 달라졌을 때만** 쓴다. 이게 ②번 규칙이다.
     force=true 는 셔터 직전 최종 좌표 — 이때는 데드밴드도 간격도 무시한다. */
  /* gz·gp(시선)·yaw(몸 회전)는 **보낼지 말지를 정하지 않는다.** 데드밴드는 좌표만 본다 —
     시선까지 보면 마우스를 흔드는 동안 10Hz 로 계속 쓰게 되어 세션 요금이 두 배가 된다.
     ⚠️ 대신 이 값들이 실려 나가는 자리가 둘 있다:
       ① 셔터 직전의 force 전송 — **사진에 남는 것은 이 값이다.** 그것만 맞으면 넷이 «같은 사진»을 갖는다.
       ② 몸을 다 돌리고 손을 뗀 순간의 force 전송 — 점프·포즈처럼 «한 동작에 쓰기 1회»다.
         회전은 눈에 크게 띄어서, 남들이 셔터까지 못 보고 있으면 «안 돌아갔다»로 읽힌다. */
  function sendPos(wx, d, force, gz, gp, yaw){
    if(slot < 0) return false;
    var t = clock();
    if(!force){
      if(t - lastSent.t < SEND_MIN_MS) return false;
      if(lastSent.wx !== null &&
         Math.abs(wx - lastSent.wx) < DEAD_X &&
         Math.abs(d  - lastSent.d ) < DEAD_D) return false;
    }
    lastSent.wx = wx; lastSent.d = d; lastSent.t = t;
    api.pkSet(P('p/' + slot), encPos(wx, d, gz, gp, yaw));
    return true;
  }

  /* ── 사건(점프·포즈) ──
     ★ 값이 아니라 "눌렀다"를 보낸다. 점프 궤적은 받는 쪽이 같은 식으로 계산한다.
       그래서 점프 한 번에 쓰기가 1회다(연속으로 보내면 10Hz × 1초 = 10회). */
  function sendEvent(kind, value){
    if(slot < 0) return false;
    api.pkSet(P('ev/' + slot), { k: kind, v: (value === undefined ? null : value), ts: clock() });
    return true;
  }

  /* ── 셔터 ──
     방장이 신호를 쓴다. 받은 쪽은 그 자리에 멈추고 최종 좌표를 한 번 더 보낸 뒤,
     FREEZE_MS 를 기다렸다가 찍는다. 그래야 넷이 **같은 사진**을 갖는다. */
  function fireShutter(cutIndex){
    if(!isHost()) return Promise.resolve(false);
    return api.pkSet(P('shot'), { n: cutIndex, at: now() }).then(function(){ return true; });
  }
  function freezeMs(){ return FREEZE_MS; }

  /* ── 정리 ──
     ⚠️ 마지막 사람이 나가면 photo 노드를 통째로 지운다.
       안 지우면 프레임 URL·메타가 방에 영원히 남아 다음 사람이 물려받는다
       (app.js 의 _finalCleanup 이 _meta 를 조건 없이 지우는 것과 같은 이유). */
  function close(){
    unsubscribe();
    stopBeat();
    slotsSnap = null; hostSlot = -1;
    if(!room || slot < 0){ room = null; slot = -1; return Promise.resolve(); }
    var s = slot, r = room;
    slot = -1;
    /* ⚠️ **예약을 먼저 푼다.** onDisconnect 는 «경로»에 걸려 있지 «내 자리»에 걸린 것이 아니다.
       자리를 놓고도 예약이 남아 있으면, 그 칸을 물려받은 다음 사람의 자리를 내 브라우저가
       꺼질 때 지운다 — 방장 칸이면 **남의 방에서 방장이 갑자기 사라진다.**
       ★ release() 가 생기면서 이게 실제로 일어나는 일이 됐다. 꾸미기는 몇 분씩 걸리고,
         그동안 새로 온 사람이 slot 0 을 잡는다. 그 사람이 내 예약의 사정권에 들어온다.
       ⚠️ 실패해도 계속 간다 — 예약 취소가 안 됐다고 자리까지 못 놓으면 방이 잠긴다.
       ⚠️ 옛 firebase-init(취소 어댑터가 없는 판)에서도 죽지 않게 있는지 보고 부른다. */
    var unarm = api.pkOnDisconnectCancel
      ? Promise.all([
          api.pkOnDisconnectCancel('rooms/' + r + '/_photo/slots/' + s),
          api.pkOnDisconnectCancel('rooms/' + r + '/_photo/p/' + s)
        ]).catch(function(e){ console.warn('[스티커사진] onDisconnect 취소 실패', e); })
      : Promise.resolve();
    /* ⚠️ **순서가 있다.** p·ev 의 쓰기 권한은 «내 자리(slots/$i)가 아직 있는가»로 정해진다.
       셋을 한꺼번에 지우면 자리가 먼저 지워지는 경우가 생기고, 그때 p·ev 삭제가
       permission_denied 로 거부되어 **좌표와 사건 노드가 방에 그대로 남는다**(콘솔 제보).
       자리를 마지막에 놓는다 — 그것이 곧 «문을 잠그는» 동작이다. */
    return unarm.then(function(){
      return Promise.all([
        api.pkRemove('rooms/' + r + '/_photo/p/' + s),
        api.pkRemove('rooms/' + r + '/_photo/ev/' + s)
      ]);
    }).then(function(){
      return api.pkRemove('rooms/' + r + '/_photo/slots/' + s);
    }).then(function(){
      return api.pkGet('rooms/' + r + '/_photo/slots');
    }).then(function(rest){
      var any = false;
      for(var k in (rest || {})) { any = true; break; }
      if(!any) return api.pkRemove('rooms/' + r + '/_photo');   // 마지막 사람
    }).then(function(){
      room = null; peers = {}; meta = null;
      lastSent = { wx: null, d: null, t: 0 };
    });
  }

  /* ── 자리 반납 (꾸미기로 넘어갈 때) ──
     ★ 하는 일은 close() 와 **완전히 같다.** 이름을 따로 두는 이유는 부르는 쪽의 뜻이 다르기
       때문이다 — close 는 「창을 닫는다」, release 는 「촬영은 끝났으니 방을 넘긴다」.

     ★ 왜 반납해야 하나 — 안 놓으면 방장이 slot 0 을 붙잡은 채 꾸미기를 하고, 그동안 들어온
       사람은 방장이 못 되어 「촬영 시작」을 **아무도 못 누른다.** 방을 다시 여는 것만으로는
       모자라고 자리까지 비워야 한다.

     ⚠️ 꾸미기는 서버에 아무것도 안 남긴다(통신이 없다) — 그래서 놓아도 잃을 것이 없다.
     ⚠️ 프레임 올리기(setFrameUrl)는 slot===0 을 보지만 **로비에서만** 부르므로 안 겹친다. */
  function release(){ return close(); }

  return {
    checkQuota: checkQuota, takeQuota: takeQuota, watchQuota: watchQuota,
    peek: peek, open: open, close: close, release: release,
    isHost: isHost, mySlot: mySlot, hostSlot: hostSlotIdx, hostUid: hostUid,
    adoptSlots: adoptSlots, beat: beat,
    setConfig: setConfig, setFilter: setFilter, setCam: setCam, setFrameUrl: setFrameUrl, start: start,
    setCut: setCut, setDone: setDone,
    sendPos: sendPos, sendEvent: sendEvent,
    fireShutter: fireShutter, freezeMs: freezeMs,
    peersNow: function(){ return peers; },
    metaNow: function(){ return meta; }
  };
}

return {
  makeSession: makeSession,
  /* 아래는 검사기와 UI 가 같이 쓰는 순수 함수들 */
  kstDay: kstDay, reopenAt: reopenAt, closedMessage: closedMessage,
  quotaNext: quotaNext, quotaLeft: quotaLeft, quotaUsed: quotaUsed,
  quotaLabel: quotaLabel, nthLabel: nthLabel,
  encPos: encPos, decPos: decPos,
  /* 시트 기하 — 화면·검사기·규칙이 같은 숫자를 보게 하는 유일한 출처 */
  cutsFor: cutsFor, cutAllowed: cutAllowed, fallbackCut: fallbackCut,
  sheetW: sheetW, sheetH: sheetH, gridOf: gridOf, cellRects: cellRects,
  frameSpec: frameSpec, stageSize: stageSize, stageBoxW: stageBoxW, focalPx: focalPx,
  halfWorld: halfWorld, fitCount: fitCount, camDepth: camDepth, projY: projY,
  xLimit: xLimit, EDGE_KEEP: EDGE_KEEP,
  nearSpan: nearSpan, NEAR_SPAN_P: NEAR_SPAN_P, NEAR_SPAN_L: NEAR_SPAN_L,
  /* 꾸미기 — 화면과 저장이 같은 함수를 배율만 바꿔 부르게 하는 출처 */
  /* 뒷배경 — 로비 미리보기·무대·캡처가 같은 그림을 보게 하는 유일한 출처 */
  BEAT_MS: BEAT_MS, SLOT_TTL_MS: SLOT_TTL_MS,
  bgList: bgList, bgOf: bgOf, bgAllowed: bgAllowed, bgFlat: bgFlat, drawBg: drawBg,
  bgParse: bgParse, bgJoin: bgJoin, bgForCut: bgForCut, BG_MAX: BG_MAX,
  BG_SKY: BG_SKY, BG_SEPIA: BG_SEPIA,
  /* 필터 — 무대와 캡처가 «같은 함수를 배율만 바꿔» 부르게 하는 유일한 출처 */
  filterList: filterList, filterOf: filterOf, filterAllowed: filterAllowed,
  filterScale: filterScale, applyFilter: applyFilter, drawFilterSample: drawFilterSample,
  PS1_BLOCK: PS1_BLOCK, PS1_LEVELS: PS1_LEVELS, SOFT_BLUR: SOFT_BLUR,
  GRADES: GRADES, filterIn: filterIn,
  strokeGroups: strokeGroups, needsScratch: needsScratch, outlineInk: outlineInk,
  penPath: penPath, penRender: penRender,
  stkClamp: stkClamp, penWClamp: penWClamp,
  PEN_TYPES: PEN_TYPES, PEN_COLORS: PEN_COLORS, STICKERS: STICKERS,
  DECO_DISP: DECO_DISP, HIST_MAX: HIST_MAX,
  STK_BOX: STK_BOX, STK_FONT: STK_FONT, STK_MIN: STK_MIN, STK_MAX: STK_MAX,
  PEN_W_MIN: PEN_W_MIN, PEN_W_MAX: PEN_W_MAX, PEN_W_DEF: PEN_W_DEF,
  SHEET_W: SHEET_W, SHEET_H: SHEET_H, GUTTER: GUTTER,
  STAGE_W_MAX: STAGE_W_MAX, STAGE_H_MAX: STAGE_H_MAX, STAGE_BOX_W: STAGE_BOX_W,
  CAM_FOV: CAM_FOV, CAM_HEIGHT: CAM_HEIGHT, CAM_PITCH: CAM_PITCH,
  CAM_H_MIN: CAM_H_MIN, CAM_H_MAX: CAM_H_MAX, CAM_H_STEP: CAM_H_STEP, CAM_H_BIG: CAM_H_BIG,
  CAM_P_MIN: CAM_P_MIN, CAM_P_MAX: CAM_P_MAX, CAM_P_STEP: CAM_P_STEP, CAM_P_BIG: CAM_P_BIG,
  camClampH: camClampH, camClampP: camClampP,
  CAM_NEAR: CAM_NEAR, CAM_FAR: CAM_FAR,
  CHAR_H: CHAR_H, BODY_W: BODY_W, ANIMAL_H: ANIMAL_H, ANIMAL_JUMP: ANIMAL_JUMP,
  CAP_PER_DAY: CAP_PER_DAY, MAX_SLOTS: MAX_SLOTS,
  SEND_MIN_MS: SEND_MIN_MS, DEAD_X: DEAD_X, DEAD_D: DEAD_D, FREEZE_MS: FREEZE_MS,
  POS_Q: POS_Q, GAZE_Q: GAZE_Q, YAW_Q: YAW_Q
};
})();

if(typeof module !== 'undefined' && module.exports) module.exports = Purikura;
