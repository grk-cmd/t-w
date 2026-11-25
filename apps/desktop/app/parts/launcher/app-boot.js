/* app-boot.js — 🚀 켜는 순서 한 곳 (검사 sim-app-boot.js)
   0.13 의 켜는 순서는 한 줄이다: ① 계정 없이 돌아도 되는 것(창 · 테마 · 그리기 · 입력 · 원격 설정 · 점검 · 카탈로그)은 바로 →
   ② 계정 확인(license-gate.js checkInviteGate → login-flow.js confirm) → 서버 계정으로 이 PC 맞추기(account.js _enterAccount — 계정 코드 확정) →
   ③ 안 바뀐 계정이면 게이트가 nav 로 «계정에 들어감»(NAV.ACCOUNT_ENTERED)을 알리고, 이 모듈이 한 번 —
   옛 PC 값 옮기기(migrateLegacy) → 계정 칸 열기 → 업데이트 확인 통과(updateGate — 확인은 로그인과 같이 돈다 · 강제면 여기서 멈춤) →
   이 PC 등록(registerDevice — 계정마다 PC 는 서버가 정한 상한까지) → 첫 화면 읽기(FIRST) → realtime 연결 → 요청 없는 기능(READY) →
   첫 화면을 그린 뒤 안 보이는 읽기(LATER · 사이를 두고) · 창을 열 때(OPEN) — 아래 STEPS 표. 첫 화면 뒤 읽기가 2초 안에 안 끝나면 «접속 중…» 토스트를 띄우고 끝나면 내린다.
   등록을 [취소]하면(상한이 다 찬 계정에서 가장 오래된 기기를 지우지 않음) 등록하지 않고 로그인 화면으로(toLogin) — realtime · 기능을 시작하지 않는다.
   등록이 실패하면(서버에 못 닿음 — 번호는 등록 쪽이 알림) 그대로 이어 간다 — realtime 이 이 PC 를 들이지 않으면 기기 안내 화면이 [다시 등록]을 준다.
   로그인 필요 · 가입 필요 · 서버 안 됨이면 ③은 돌지 않는다. 계정이 바뀌었으면(switched) 앱을 다시 켜므로 그때도 돌지 않는다 — 다시 켠 뒤 새로 돈다.
   ★ 게이트가 이 모듈을 직접 부르지 않고 nav 로 부탁한다 — 이 모듈은 모든 계정 기능을 부르는 맨 위층이라, 아래 층(게이트)이 부르면 서로 부르는 순환이 된다(sim-dep-cycles).
   맨 앞 칸 userLocal 은 «이 계정이 이 PC 에서 고른 것» 을 계정 칸에서 읽어 채운다(user-local.js) — 모듈이 만들 때 읽던 값이라 다른 기능보다 먼저.
   기능 모듈은 «만들기» 와 «시작» 을 나눠 내놓는다. 만들 때 요청 · 구독 · 타이머 · 계정 칸 읽기를 하지 않고, 시작은 여기서만 부른다.
   ★ 이 모듈이 로그인 세션(shared/session.js)을 만들어 들고 있다(getSession) — 계정 칸 열기는 세션이 하고, 시작 함수는 세 번째 인자로 받는다. 받아 쓰는 기능: focusLevel(startFocus — onReset).
   ★ 시작 함수는 한 번만 부른다 — begin 을 두 번 부르면 두 번째는 아무것도 안 하고 false(콘솔 경고).
   ★ 로그아웃 차례(멈추기 → 올리기 → 지우기 → 다시 켜기)는 account.js 에 한 곳으로 있다 — 이 모듈은 건드리지 않는다. */
(function(){
'use strict';

/* 들어간 뒤 계정 기능을 시작하는 차례 — 이 표의 순서 · 때가 정본이다(deps.starts 의 이름과 어긋나면 만들 때 던진다).
   때(PHASE): FIRST = 이 PC 등록 뒤 곧바로(첫 화면에 보이는 것 — 캐릭터 · 카탈로그) · READY = 그 뒤 바로(요청 없는 것 · 구독만 거는 것) ·
     LATER = 첫 화면을 그린 뒤 하나씩 사이를 두고(안 보이는 읽기 — 한꺼번에 몰려 첫 화면 요청과 다투지 않게) · OPEN = 그 창을 처음 열 때(open(name)).
   ★ 업데이트 확인(로그인과 같이 돈다)이 «로그인으로 넘어가도 됨» 이어야 이 PC 등록(서버 쓰기)부터 시작한다 — 강제 업데이트면 서버 쓰기 · 계정 기능 0.
     FIRST 읽기는 등록 뒤다 — 카탈로그 locked · 옷장 답의 프리미엄 판정이 «등록된 이 기기» 를 본다. */
const PHASE = Object.freeze({ FIRST: 'first', READY: 'ready', LATER: 'later', OPEN: 'open' });
const STEPS = Object.freeze([
  ['userLocal', PHASE.FIRST],        // 🗂️ 이 계정이 이 PC 에서 고른 것(현재 슬롯 · 꾸미기 보기 설정 …)을 계정 칸에서 읽어 채움 — 만들 때 읽던 값이라 맨 먼저(user-local.js)
  ['catalog', PHASE.FIRST],          // 🧩 카탈로그 서버 한 벌 받기(저장 목록이 읽힌 뒤 — 합치기가 그 위에 얹힌다 · 서버가 이 사람의 locked 를 정한다)
  ['closet', PHASE.FIRST],           // 🧬 옷장(슬롯 5칸 · 보관함 · 휴지통) 서버에서 받기 — 첫 화면의 캐릭터
  ['focusTotal', PHASE.READY],       // 포커스 누적 읽기(계정 칸) — 아래 포커스 기능이 읽는 값이라 맨 먼저
  ['focusShare', PHASE.READY],       // 📊 오늘 기록 전시(오늘치가 읽힌 뒤)
  ['pomodoro', PHASE.READY],         // 🍅 뽀모도로 설정 · 진행 읽기(계정 칸)
  ['gift', PHASE.READY],             // 🎁 선물 서버 신호 듣기(요청 0 — 받기는 마이홈을 열 때) · 계정을 놓을 때 비우기
  ['roomInvite', PHASE.READY],       // 🙋 방 초대 받기(신호만)
  ['awayPic', PHASE.READY],          // 🫧 자리비움 그림 · 크기를 서버(me.awayImage)에 맞추기(요청 0 — 계정 확인의 답을 쓴다)
  ['desktopBg', PHASE.READY],        // 🖥️ 마이홈 바탕화면 배경 맞추기(계정 칸)
  ['licensePremium', PHASE.READY],   // 🔑 프리미엄 판정 반영(요청 0 — 계정 확인의 답) · 라이선스 알림 받기
  ['adminMode', PHASE.READY],        // 🔐 세션이 끝나면 관리자 모드 끄기(요청 0 — 세션 비우기에 걸기만)
  ['focusLevel', PHASE.LATER],       // ⏱ 포커스 진척 받기 · 못 올린 집중 시간 올리기(focus-progress.js startFocus — 세션을 받아 쓴다)
  ['weeklyChal', PHASE.LATER],       // 👑 달성표 서버 맞추기
  ['mhInit', PHASE.LATER],           // 🏠 마이홈 시작(접속 표시 · 친구 · 요청 · 우편)
  ['bugBadge', PHASE.LATER],         // 🐞 버그제보 탭 «새 답변» 배지 한 번 받기
  ['scheduler', PHASE.LATER],        // 📅 일정 알림 받기
  ['ddays', PHASE.LATER],            // 📌 디데이 보드 받기 — 🔔 알림 배지 · 알림 창이 마이홈 밖에서도 디데이를 센다
  ['gacha', PHASE.LATER],            // 🎰 가챠 보유분 서버 맞추기(못 가진 가챠 파츠 벗기기 pruneUnownedGachaParts 가 이 답을 쓴다)
  ['invites', PHASE.LATER],          // 🎟️ 런처 초대장 버튼의 남은 수 한 번 받기
  ['appVersion', PHASE.LATER],       // 🔄 이 PC 앱 판을 서버에 알리기 — 더 새 판을 쓰는 기기가 있으면 업데이트 창(account/app-version-sync.js)
  ['firstRun', PHASE.LATER],         // 0.13 첫 실행(이 PC 의 옛 값 올리고 지우기)
  ['licenseAutoRegister', PHASE.LATER],   // 🔑 계정 라이선스에 이 기기 자동 등록 — 첫 실행 뒤(0.12 키로 첫 실행이 등록했으면 건너뜀 · license-premium.js autoRegisterAfter)
  ['catalogGlb', PHASE.LATER],       // 🧩 카탈로그 GLB 를 다 받아 두기(catalog-sync.js fillGlb) — 맨 끝(약 8MB · 입은 파츠 · 책상은 그릴 때 먼저 받는다)
  ['playlist', PHASE.OPEN],          // 🎵 플레이리스트 받기 — 플레이리스트 창을 처음 열 때
]);
const LATER_GAP_MS = 120;            // LATER 칸 사이 — 12칸이 약 1.4초에 걸쳐 나간다
const PAINT_WAIT_MAX_MS = 3000;      // 첫 화면을 이보다 오래 못 그리면(캐릭터 그림이 느림) LATER 를 그냥 시작한다
const CONNECTING_TOAST_MS = 2000;    // 첫 화면 뒤 LATER 읽기가 이때까지 안 끝나면 «접속 중…» 을 띄운다(끝나면 내린다)
const CONNECTING_TEXT = '접속 중…';

/** @param {{
 *   twNav: { on: (name: string, fn: Function) => void, NAV: Record<string, string> },   // 창 열기 통로(shared/nav.js) — NAV.ACCOUNT_ENTERED 를 여기서 받는다
 *   migrateLegacy: (code: string) => unknown,                  // 옛 PC 값을 이 계정 칸으로(shared/account-store.js)
 *   newSession: (me: object) => { openStore: () => boolean, dispose: () => boolean, alive: () => boolean, setTimeout: Function },   // 로그인 세션 만들기(shared/session.js) — 계정 칸 열기는 세션이 한다(옮기기 직후 — 열기 전엔 읽기 null · 쓰기 거절). 못 열면 기능을 시작하지 않는다
 *   registerDevice: () => Promise<'ok' | 'canceled' | 'failed'>,   // 이 PC 등록(account/device-register.js ensure) — realtime 보다 먼저
 *   toLogin: () => unknown,                                    // 등록을 취소했을 때 — 로그인 화면으로(로그아웃 · 다시 켜기)
 *   updateGate: () => Promise<boolean>,                        // 켤 때 업데이트 · 공지 확인(update-flow.js runBeforeLogin)이 «로그인으로 넘어가도 됨» 인가 — 거짓이면(강제 업데이트) 등록 · 읽기 · 기능을 하나도 시작하지 않는다
 *   goOnline: () => void,                                      // realtime 연결(login-flow.js goOnline)
 *   whenPainted: () => Promise<unknown>,                       // 첫 화면(런처 캐릭터)을 그렸다 — 옷장 첫 받기가 끝남(closet.js)
 *   idle: () => Promise<unknown>,                              // 지금 나간 API 요청이 다 끝났다(api-client.js whenIdle)
 *   holdToast: (msg: string) => () => void,                    // 내릴 때까지 떠 있는 토스트(shared/toast.js hold) — 돌려준 함수로 내린다
 *   starts: Record<string, (code: string, me: object, session: object) => unknown>,   // STEPS 이름마다 하나 — 계정 기능의 시작 함수(없거나 남으면 만들 때 던진다)
 * }} deps */
function createAppBoot(deps){
const twNav = deps.twNav;
const migrateLegacy = deps.migrateLegacy;
const newSession = deps.newSession;
const goOnline = deps.goOnline;
const registerDevice = deps.registerDevice;
const toLogin = deps.toLogin;
const updateGate = deps.updateGate;
const whenPainted = deps.whenPainted;
const idle = deps.idle;
const holdToast = deps.holdToast;
const starts = deps.starts;
const NAMES = STEPS.map((s) => s[0]);
const of = (phase) => STEPS.filter((s) => s[1] === phase).map((s) => s[0]);

  for(const name of NAMES){
    if(typeof starts[name] !== 'function') throw new Error('[app-boot] 시작 함수가 없어요: ' + name);
  }
  for(const name of Object.keys(starts)){
    if(!NAMES.includes(name)) throw new Error('[app-boot] 차례 표에 없는 시작이에요: ' + name);
  }

  let began = false;
  let session = null;   // 이번 로그인의 세션 — 기능은 starts 의 세 번째 인자로 받는다
  let code = null, myMe = null;
  let ready = false;    // 업데이트 확인을 통과했다 — OPEN 칸은 그 뒤에만 시작한다
  const ran = new Set();      // 이번 세션에 시작한 칸
  const asked = new Set();    // 통과 전에 열어 달라고 한 OPEN 칸 — 통과하면 시작한다
  /* 한 칸이 던져도 다음 칸은 돈다(기능끼리 서로 몰랐던 때와 같다) — 돌려준 약속은 실패해도 경고만 */
  function guard(label, fn){
    try{ return Promise.resolve(fn()).catch((e)=>console.warn('[app-boot] ' + label + ' 실패', e)); }
    catch(e){ console.warn('[app-boot] ' + label + ' 실패', e); return Promise.resolve(); }
  }
  function run(name){
    if(ran.has(name)) return Promise.resolve();
    ran.add(name);
    return guard(name, () => starts[name](code, myMe, session));
  }
  const nap = (s, ms) => new Promise((r) => { if(!s.setTimeout(r, ms)) r(); });   // 세션이 끝나면(타이머를 안 받음) 바로 풀려 다음 줄에서 멈춘다
  /* 첫 화면을 그린 뒤(늦어도 PAINT_WAIT_MAX_MS) LATER 칸을 사이를 두고 하나씩 — 다 시작하고 나간 요청이 끝나면 풀린다.
     «접속 중…» 은 이 읽기만 잰다 — 첫 화면 뒤 CONNECTING_TOAST_MS 안에 안 끝나면 띄우고 끝나면(또는 세션이 끝나면) 내린다. 실패는 각 기능의 오류 번호 길 그대로 */
  async function later(s){
    await Promise.race([Promise.resolve(whenPainted()).catch(() => {}), nap(s, PAINT_WAIT_MAX_MS)]);
    if(!s.alive()) return;
    let release = null, over = false;
    const end = () => { over = true; if(release){ release(); release = null; } };
    s.setTimeout(() => { if(!over && s.alive()) release = holdToast(CONNECTING_TEXT); }, CONNECTING_TOAST_MS);
    s.onReset(end);
    try{
      for(const name of of(PHASE.LATER)){
        if(!s.alive()) return;
        run(name);
        await nap(s, LATER_GAP_MS);
      }
      if(s.alive()) await Promise.resolve(idle()).catch(() => {});
    }finally{ end(); }
  }

  /* 서버가 계정을 돌려주고 이 PC 를 맞춘 뒤(_enterAccount ok · switched 아님) 게이트가 알리면 한 번 — 옛 값 옮기기 → 등록 → 첫 화면 읽기 → (업데이트 확인 통과) → realtime → 나머지.
     @return Promise — 돌렸으면 true · 계정 없음(me 비었음) · 이미 돌았음 · 등록 취소 · 강제 업데이트면 false */
  async function begin(me){
    if(!me || !me.userCode) return false;
    if(began){ console.warn('[app-boot] 이미 시작했어요 — 두 번째 시작은 무시해요'); return false; }
    began = true;
    code = me.userCode; myMe = me;
    guard('옛 값 옮기기', () => migrateLegacy(code));
    let opened = false;   // 옮긴 뒤에야 연다 — 먼저 쓴 값이 옛 값을 가리지 않게. 못 열면(코드가 어긋남 — 정상 흐름에선 없다) 기능을 시작하지 않는다
    try{ session = newSession(me); opened = session.openStore() === true; }catch(e){ console.warn('[app-boot] 계정 칸 열기 실패', e); }
    if(!opened){
      console.warn('[app-boot] 계정 칸을 열지 못해 계정 기능을 시작하지 않아요');
      if(session){ session.dispose(); session = null; }
      return false;
    }
    const s = session;
    let go = false;
    try{ go = (await updateGate()) === true; }catch(e){ console.warn('[app-boot] 업데이트 확인 실패', e); }
    if(!go || !s.alive()){ console.warn('[app-boot] 업데이트 확인을 통과하지 못해 계정 기능을 시작하지 않아요'); return false; }   // 강제 업데이트 — 등록(서버 쓰기)도 하지 않는다
    let reg = 'failed';
    try{ reg = await registerDevice(); }catch(e){ console.warn('[app-boot] 이 PC 등록 실패', e); }
    if(reg === 'canceled'){
      session.dispose(); session = null;
      guard('로그인 화면', () => toLogin());
      return false;
    }
    ready = true;
    for(const name of of(PHASE.FIRST)) run(name);
    guard('realtime 연결', () => goOnline());
    for(const name of of(PHASE.READY)) run(name);
    for(const name of asked) run(name);
    asked.clear();
    later(s);
    return true;
  }
  /* OPEN 칸 — 그 창을 처음 열 때 부른다(두 번째부터 · 다른 칸 이름은 무시). 업데이트 확인 전이면 통과한 뒤 시작한다 */
  function open(name){
    if(!of(PHASE.OPEN).includes(name)) throw new Error('[app-boot] 열 때 시작하는 칸이 아니에요: ' + name);
    if(!session || !session.alive()) return;
    if(!ready){ asked.add(name); return; }
    run(name);
  }

  twNav.on(twNav.NAV.ACCOUNT_ENTERED, begin);

  return { begin, open, getSession: () => session };
}

window.TwAppBoot = { STEPS, PHASE, LATER_GAP_MS, PAINT_WAIT_MAX_MS, CONNECTING_TOAST_MS, CONNECTING_TEXT, createAppBoot };
})();
