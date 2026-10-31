/* app-boot.js — 🚀 켜는 순서 한 곳 (검사 sim-app-boot.js)
   0.13 의 켜는 순서는 한 줄이다: ① 계정 없이 돌아도 되는 것(창 · 테마 · 그리기 · 입력 · 원격 설정 · 점검 · 카탈로그)은 바로 →
   ② 계정 확인(license-gate.js checkInviteGate → login-flow.js confirm) → 서버 계정으로 이 PC 맞추기(account.js _enterAccount — 계정 코드 확정) →
   ③ 안 바뀐 계정이면 게이트가 nav 로 «계정에 들어감»(NAV.ACCOUNT_ENTERED)을 알리고, 이 모듈이 한 번 —
   옛 PC 값 옮기기(migrateLegacy) → 계정 칸 열기 → realtime 연결 → 계정 기능 시작(아래 STEPS 표 순서).
   로그인 필요 · 가입 필요 · 서버 안 됨이면 ③은 돌지 않는다. 계정이 바뀌었으면(switched) 앱을 다시 켜므로 그때도 돌지 않는다 — 다시 켠 뒤 새로 돈다.
   ★ 게이트가 이 모듈을 직접 부르지 않고 nav 로 부탁한다 — 이 모듈은 모든 계정 기능을 부르는 맨 위층이라, 아래 층(게이트)이 부르면 서로 부르는 순환이 된다(sim-dep-cycles).
   기능 모듈은 «만들기» 와 «시작» 을 나눠 내놓는다. 만들 때 요청 · 구독 · 타이머 · 계정 칸 읽기를 하지 않고, 시작은 여기서만 부른다.
   ★ 시작 함수는 한 번만 부른다 — begin 을 두 번 부르면 두 번째는 아무것도 안 하고 false(콘솔 경고).
   ★ 로그아웃 차례(멈추기 → 올리기 → 지우기 → 다시 켜기)는 account.js 에 한 곳으로 있다 — 이 모듈은 건드리지 않는다. */
(function(){
'use strict';

/* 들어간 뒤 계정 기능을 시작하는 차례 — 이 표의 순서가 정본이다(deps.starts 의 이름과 어긋나면 만들 때 던진다) */
const STEPS = [
  'focusTotal',      // 포커스 누적 읽기(계정 칸) — 아래 포커스 기능이 읽는 값이라 맨 먼저
  'focusShare',      // 📊 오늘 기록 전시(오늘치가 읽힌 뒤)
  'focusLevel',      // 포커스 레벨 서버 맞추기(부팅 · 주기 · 닫힐 때)
  'weeklyChal',      // 👑 달성표 서버 맞추기
  'gacha',           // 🎰 가챠 보유분 서버 맞추기
  'slotSync',        // ☁️ 슬롯 기기 간 동기
  'chars',           // 🧬 캐릭터 보관함 동기
  'mhInit',          // 🏠 마이홈 시작(접속 표시 · 프로필 · 친구 · 요청 · 우편)
  'scheduler',       // 📅 일정 알림 받기
  'roomInvite',      // 🙋 방 초대 받기
  'desktopBg',       // 🖥️ 마이홈 바탕화면 배경 맞추기
  'playlist',        // 🎵 플레이리스트 받기
  'licenseVerify',   // 🔑 저장된 라이선스 키 재검증
  'licenseRequest',  // 📨 보낸 라이선스 요청 지켜보기
  'firstRun',        // 0.13 첫 실행(이 PC 의 옛 값 올리고 지우기)
];

/** @param {{
 *   twNav: { on: (name: string, fn: Function) => void, NAV: Record<string, string> },   // 창 열기 통로(shared/nav.js) — NAV.ACCOUNT_ENTERED 를 여기서 받는다
 *   migrateLegacy: (code: string) => unknown,                  // 옛 PC 값을 이 계정 칸으로(shared/account-store.js)
 *   openAccountStore: (code: string) => boolean,               // 계정 칸 열기(옮기기 직후 — 열기 전엔 읽기 null · 쓰기 거절)
 *   goOnline: () => void,                                      // realtime 연결(login-flow.js goOnline)
 *   starts: Record<string, (code: string, me: object) => unknown>,   // STEPS 이름마다 하나 — 계정 기능의 시작 함수(없거나 남으면 만들 때 던진다)
 * }} deps */
function createAppBoot(deps){
const twNav = deps.twNav;
const migrateLegacy = deps.migrateLegacy;
const openAccountStore = deps.openAccountStore;
const goOnline = deps.goOnline;
const starts = deps.starts;

  for(const name of STEPS){
    if(typeof starts[name] !== 'function') throw new Error('[app-boot] 시작 함수가 없어요: ' + name);
  }
  for(const name of Object.keys(starts)){
    if(!STEPS.includes(name)) throw new Error('[app-boot] 차례 표에 없는 시작이에요: ' + name);
  }

  let began = false;
  /* 한 칸이 던져도 다음 칸은 돈다(기능끼리 서로 몰랐던 때와 같다) */
  function guard(label, fn){
    try{ Promise.resolve(fn()).catch((e)=>console.warn('[app-boot] ' + label + ' 실패', e)); }
    catch(e){ console.warn('[app-boot] ' + label + ' 실패', e); }
  }

  /* 서버가 계정을 돌려주고 이 PC 를 맞춘 뒤(_enterAccount ok · switched 아님) 게이트가 알리면 한 번 — 옛 값 옮기기 → realtime → 기능 시작.
     @return 돌렸으면 true · 계정 없음(me 비었음) 또는 이미 돌았으면 false */
  function begin(me){
    if(!me || !me.userCode) return false;
    if(began){ console.warn('[app-boot] 이미 시작했어요 — 두 번째 시작은 무시해요'); return false; }
    began = true;
    const code = me.userCode;
    guard('옛 값 옮기기', () => migrateLegacy(code));
    guard('계정 칸 열기', () => openAccountStore(code));   // 옮긴 뒤에야 연다 — 먼저 쓴 값이 옛 값을 가리지 않게
    guard('realtime 연결', () => goOnline());
    for(const name of STEPS) guard(name, () => starts[name](code, me));
    return true;
  }

  twNav.on(twNav.NAV.ACCOUNT_ENTERED, begin);

  return { begin };
}

window.TwAppBoot = { STEPS, createAppBoot };
})();
