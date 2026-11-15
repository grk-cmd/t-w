/* app-boot.js — 🚀 켜는 순서 한 곳 (검사 sim-app-boot.js)
   0.13 의 켜는 순서는 한 줄이다: ① 계정 없이 돌아도 되는 것(창 · 테마 · 그리기 · 입력 · 원격 설정 · 점검 · 카탈로그)은 바로 →
   ② 계정 확인(license-gate.js checkInviteGate → login-flow.js confirm) → 서버 계정으로 이 PC 맞추기(account.js _enterAccount — 계정 코드 확정) →
   ③ 안 바뀐 계정이면 게이트가 nav 로 «계정에 들어감»(NAV.ACCOUNT_ENTERED)을 알리고, 이 모듈이 한 번 —
   옛 PC 값 옮기기(migrateLegacy) → 계정 칸 열기 → realtime 연결 → 계정 기능 시작(아래 STEPS 표 순서).
   로그인 필요 · 가입 필요 · 서버 안 됨이면 ③은 돌지 않는다. 계정이 바뀌었으면(switched) 앱을 다시 켜므로 그때도 돌지 않는다 — 다시 켠 뒤 새로 돈다.
   ★ 게이트가 이 모듈을 직접 부르지 않고 nav 로 부탁한다 — 이 모듈은 모든 계정 기능을 부르는 맨 위층이라, 아래 층(게이트)이 부르면 서로 부르는 순환이 된다(sim-dep-cycles).
   맨 앞 칸 userLocal 은 «이 계정이 이 PC 에서 고른 것» 을 계정 칸에서 읽어 채운다(user-local.js) — 모듈이 만들 때 읽던 값이라 다른 기능보다 먼저.
   기능 모듈은 «만들기» 와 «시작» 을 나눠 내놓는다. 만들 때 요청 · 구독 · 타이머 · 계정 칸 읽기를 하지 않고, 시작은 여기서만 부른다.
   ★ 이 모듈이 로그인 세션(shared/session.js)을 만들어 들고 있다(getSession) — 계정 칸 열기는 세션이 하고, 시작 함수는 세 번째 인자로 받는다. 받아 쓰는 기능: focusLevel(startFocus — onReset).
   ★ 시작 함수는 세션마다 한 번만 부른다 — 살아 있는 세션이 있을 때 begin 을 또 부르면 아무것도 안 하고 false(콘솔 경고). end 로 세션이 끝난 뒤의 begin 은 새 세션.
   ★ 끄는 차례도 이 모듈 한 곳이다 — end(why) · NAV.ACCOUNT_LEAVE(게이트 · 계정 탭 · realtime 끊김 화면이 부탁한다).
     ① 올리기 · 검문(why 가 logout 일 때만 — 실패면 아무것도 안 하고 멈춘다) → ② 연결 놓기(방 나가기 → bye) → ③ 창 모두 닫기 → ④ 세션 끝내기(dispose — 타이머 · 구독 · 비우기 훅 · 계정 칸 닫기) → ⑤ 신원 놓기(로그인 · 이 PC 신원 · 대화 저장 · 탈퇴면 이 계정 칸) → ⑥ 끝난 뒤 화면(afterEnd).
     ④ 가 ⑤ 앞이다 — 세션의 구독 · 접속 표시가 옛 로그인으로 마지막 쓰기를 하고 풀린 뒤에 로그인을 놓는다. 올리기 · 연결 · 신원의 안쪽 일은 아래 층(account.js · login-flow.js)이 하고 이 모듈은 차례만 정한다.
     ⑥ 은 아직 앱을 다시 켠다(S-4d 가 로그인 화면으로 바꾼다). */
(function(){
'use strict';

/* 들어간 뒤 계정 기능을 시작하는 차례 — 이 표의 순서가 정본이다(deps.starts 의 이름과 어긋나면 만들 때 던진다) */
const STEPS = [
  'userLocal',       // 🗂️ 이 계정이 이 PC 에서 고른 것(현재 슬롯 · 꾸미기 보기 설정 …)을 계정 칸에서 읽어 채움 — 만들 때 읽던 값이라 맨 먼저(user-local.js)
  'focusTotal',      // 포커스 누적 읽기(계정 칸) — 아래 포커스 기능이 읽는 값이라 맨 먼저
  'focusShare',      // 📊 오늘 기록 전시(오늘치가 읽힌 뒤)
  'focusLevel',      // ⏱ 포커스 진척 받기 · 못 올린 집중 시간 올리기(focus-progress.js startFocus — 세션을 받아 쓴다)
  'weeklyChal',      // 👑 달성표 서버 맞추기
  'pomodoro',        // 🍅 뽀모도로 설정 · 진행 읽기(계정 칸)
  'gacha',           // 🎰 가챠 보유분 서버 맞추기
  'closet',          // 🧬 옷장(슬롯 5칸 · 보관함 · 휴지통) 서버에서 받기
  'mhInit',          // 🏠 마이홈 시작(접속 표시 · 프로필 · 친구 · 요청 · 우편)
  'gift',            // 🎁 선물 서버 신호 듣기(요청 0 — 받기는 마이홈을 열 때) · 계정을 놓을 때 비우기
  'bugBadge',        // 🐞 버그제보 탭 «새 답변» 배지 한 번 받기
  'scheduler',       // 📅 일정 알림 받기
  'roomInvite',      // 🙋 방 초대 받기
  'desktopBg',       // 🖥️ 마이홈 바탕화면 배경 맞추기
  'playlist',        // 🎵 플레이리스트 받기
  'licensePremium',  // 🔑 프리미엄 판정 반영(서버 확인) · 라이선스 알림 받기
  'firstRun',        // 0.13 첫 실행(이 PC 의 옛 값 올리고 지우기)
];

/* 끝내는 까닭 — logout(사용자 누름 · 올리기 함) · withdraw(탈퇴 · 올릴 것 없음) · gone(서버가 내보냄 4007) · auth(로그인이 풀림 4001 두 번) */
const END_WHYS = Object.freeze(['logout', 'withdraw', 'gone', 'auth']);

/** @param {{
 *   twNav: { on: (name: string, fn: Function) => void, NAV: Record<string, string> },   // 창 열기 통로(shared/nav.js) — NAV.ACCOUNT_ENTERED · NAV.ACCOUNT_LEAVE 를 여기서 받는다
 *   migrateLegacy: (code: string) => unknown,                  // 옛 PC 값을 이 계정 칸으로(shared/account-store.js)
 *   newSession: (me: object) => { openStore: () => boolean, dispose: () => boolean },   // 로그인 세션 만들기(shared/session.js) — 계정 칸 열기는 세션이 한다(옮기기 직후 — 열기 전엔 읽기 null · 쓰기 거절). 못 열면 기능을 시작하지 않는다
 *   goOnline: () => void,                                      // realtime 연결(login-flow.js goOnline)
 *   flushCheck: () => Promise<{ ok: boolean }>,                // ① 못 올린 것 올리기 + 검문(account.js) — ok 가 아니면 부르는 쪽이 사유를 보여 준다
 *   releaseConnection: (why: string) => Promise<void>,         // ② 방 나가기 → bye{why}(account.js — 접속 표시 끄기 + login-flow.js release)
 *   closeWindows: () => string[],                              // ③ 창 모두 닫기(win-stack closeAll) — 못 닫은 창 이름
 *   releaseIdentity: (why: string, code: string) => Promise<void>,   // ⑤ 신원 놓기(account.js) — 탈퇴면 code 의 계정 칸도 지운다
 *   afterEnd: (why: string) => void,                           // ⑥ 끝난 뒤 화면
 *   notifyError: (code: string, detail?: unknown) => void,     // 오류 번호(error-codes.js)
 *   starts: Record<string, (code: string, me: object, session: object) => unknown>,   // STEPS 이름마다 하나 — 계정 기능의 시작 함수(없거나 남으면 만들 때 던진다)
 * }} deps */
function createAppBoot(deps){
const twNav = deps.twNav;
const migrateLegacy = deps.migrateLegacy;
const newSession = deps.newSession;
const goOnline = deps.goOnline;
const flushCheck = deps.flushCheck;
const releaseConnection = deps.releaseConnection;
const closeWindows = deps.closeWindows;
const releaseIdentity = deps.releaseIdentity;
const afterEnd = deps.afterEnd;
const notifyError = deps.notifyError;
const starts = deps.starts;

  for(const name of STEPS){
    if(typeof starts[name] !== 'function') throw new Error('[app-boot] 시작 함수가 없어요: ' + name);
  }
  for(const name of Object.keys(starts)){
    if(!STEPS.includes(name)) throw new Error('[app-boot] 차례 표에 없는 시작이에요: ' + name);
  }

  let session = null;   // 이번 로그인의 세션 — 기능은 starts 의 세 번째 인자로 받는다. 살아 있는 세션 하나가 «시작했다» 의 뜻이다
  let ending = null;    // 끝내는 중이면 그 까닭(END_WHYS) — 끝나면 null
  /* 한 칸이 던져도 다음 칸은 돈다(기능끼리 서로 몰랐던 때와 같다) */
  function guard(label, fn){
    try{ Promise.resolve(fn()).catch((e)=>console.warn('[app-boot] ' + label + ' 실패', e)); }
    catch(e){ console.warn('[app-boot] ' + label + ' 실패', e); }
  }

  /* 서버가 계정을 돌려주고 이 PC 를 맞춘 뒤(_enterAccount ok · switched 아님) 게이트가 알리면 한 번 — 옛 값 옮기기 → realtime → 기능 시작.
     @return 돌렸으면 true · 계정 없음(me 비었음) 또는 이미 돌았으면 false */
  function begin(me){
    if(!me || !me.userCode) return false;
    if(ending){ console.warn('[app-boot] 계정에서 나가는 중이라 시작하지 않아요(' + ending + ')'); return false; }
    if(session){ console.warn('[app-boot] 이미 시작했어요 — 두 번째 시작은 무시해요'); return false; }
    const code = me.userCode;
    guard('옛 값 옮기기', () => migrateLegacy(code));
    let opened = false;   // 옮긴 뒤에야 연다 — 먼저 쓴 값이 옛 값을 가리지 않게. 못 열면(코드가 어긋남 — 정상 흐름에선 없다) 기능을 시작하지 않는다
    try{ session = newSession(me); opened = session.openStore() === true; }catch(e){ console.warn('[app-boot] 계정 칸 열기 실패', e); }
    if(!opened){
      console.warn('[app-boot] 계정 칸을 열지 못해 계정 기능을 시작하지 않아요');
      if(session){ session.dispose(); session = null; }
      notifyError('E-ACC-05');
      return false;
    }
    guard('realtime 연결', () => goOnline());
    for(const name of STEPS) guard(name, () => starts[name](code, me, session));
    return true;
  }

  /* 계정에서 나간다 — 위 머리 주석의 차례. why 가 logout 이고 ① 이 막으면 아무것도 하지 않고 { ok:false, …검문 결과 }(세션 · 연결 · 로그인 그대로).
     opt.force — 두 번째 누름(S-Q1 (나)) · ① 이 막아도 경고만 남기고 계속한다. logout 에서만 뜻이 있다.
     세션이 없으면(계정 칸 열기 전 · 이미 끝남) ② ~ ④ 는 건너뛰고 ⑤ 부터 한다.
     ⚠️ 한 칸이 던지면 그대로 던진다(숨기지 않는다) — 부르는 쪽이 보인다. 이미 끝내는 중이면 { ok:false, busy:true }.
     @return Promise<{ ok:true } | { ok:false, busy:true } | { ok:false, … }> */
  async function end(why, opt){
    if(!END_WHYS.includes(why)) throw new Error('[app-boot] 끝내는 까닭을 몰라요: ' + why);
    if(ending){ console.warn('[app-boot] 이미 끝내는 중이에요(' + ending + ') — ' + why + ' 은(는) 무시해요'); return { ok:false, busy:true }; }
    ending = why;
    try{
      const s = session;
      if(s){
        if(why === 'logout'){
          const chk = await flushCheck();
          if(!chk.ok){
            if(!(opt && opt.force)) return chk;
            console.warn('[app-boot] 올리기 · 검문에 걸렸지만 강제로 나가요', chk);
          }
        }
        await releaseConnection(why);
        closeWindows();
        session = null;
        s.dispose();
      }
      await releaseIdentity(why, s ? s.code : null);
    }finally{
      ending = null;
    }
    afterEnd(why);
    return { ok:true };
  }

  twNav.on(twNav.NAV.ACCOUNT_ENTERED, begin);
  twNav.on(twNav.NAV.ACCOUNT_LEAVE, (a) => end(a.why, a));

  return { begin, end, getSession: () => session };
}

window.TwAppBoot = { STEPS, END_WHYS, createAppBoot };
})();
