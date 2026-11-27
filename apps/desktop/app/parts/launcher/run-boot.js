/* run-boot.js — 🚀 켜는 차례 표 한 곳(앱 FSD · app.js 분리 F3 · 검사 sim-run-boot.js)
   app.js 의 INIT 덩이(좌석 탭 · 앱 모드 · 관리자 버튼 · 라이선스 글 · 기본 몸 불러오기 · 프레임 루프 · 런처 루프 · 얼굴 복구 점검 · 창 크기 맞춤)가
   «파일 안 자리» 로 차례를 정하던 것을 표로 옮긴다. 0.13 의 launcher/app-boot.js 와 같은 모양 — 차례는 STEPS 한 곳, 시작은 begin 한 번.
   ・계정 없이 도는 몫만 다룬다(계정 기능의 만들기 · 시작 — 마이홈 시작 · 캐릭터 슬롯 받기 포함 — 은 launcher/app-boot.js 몫 — 겹치지 않게).
   ・starts 의 이름이 STEPS 와 어긋나면(없거나 남으면) 만들 때 던진다. baseBody 는 이 모듈이 직접 돌린다(아래).
   ・begin 을 두 번 부르면 두 번째는 아무것도 안 하고 false(콘솔 경고).
   ・한 칸이 던져도 다음 칸은 돈다.
   ⚠️ 모듈은 만들 때 일하지 않는다 — begin 이 부를 때만 돈다. 만드는 줄을 옮기면 차례가 바뀌던 옛 모양과 다르다.
   ★ 기본 몸 불러오기(baseBody): 못 불러오면(읽기가 false 이거나 던짐 — 앱에 든 파일이라 드물다, 설치가 깨졌을 때) 안내를 한 번 띄우고(onFailed) 대신 몸으로 계속 간다.
     불러온 뒤 피부를 읽고 런처를 그린다(캐릭터 슬롯은 계정 확인 뒤 서버에서 받는다 — app-boot 의 차례). 어느 단계가 던져도 런처는 그린다. */
(function(){
'use strict';

/* 켜는 차례 — 이 표의 순서가 정본이다. baseBody 외 이름마다 deps.starts 에 시작 함수 하나가 있어야 한다. */
const STEPS = [
  'seatTabs',       // 🪑 좌석 탭 그리기 · 손으로 고른 상태 비우기
  'appMode',        // 🖥️ 앱 모드(창 · 실행) 적용 · 데스크탑 실행 화면 클래스 — 창 모드를 main 에 한 번 알린다
  'adminUi',        // 🛠️ 관리자 전용 UI 는 기본 숨김
  'licenseLabel',   // 🔑 런처 라이선스 칸 글
  'baseBody',       // 🧍 기본 몸 불러오기 → 피부 → 런처 그리기 (이 모듈이 돌린다)
  'frameLoop',      // 🎞️ 프레임 루프 시작
  'launcherLoop',   // 🚀 런처 미리보기 루프 시작
  'faceHeal',       // 🛡️ 얼굴 자동 복구 주기 점검
  'resize',         // 📐 창 크기에 맞춘 좌석 배치 · resize 듣기
];

/** @param {{
 *   starts: Record<string, () => unknown>,   // STEPS 에서 baseBody 를 뺀 이름마다 하나 — 없거나 남으면 만들 때 던진다
 *   baseBody: {
 *     load: () => Promise<boolean>,          // 기본 몸 읽기(false = 못 읽음)
 *     loadSkins: () => unknown,              // 피부 읽기
 *     renderLauncher: () => void,            // 런처 그리기
 *     onFailed: () => void,                  // 못 읽었을 때 안내 한 번
 *   },
 * }} deps */
function createRunBoot(deps){
const starts = deps.starts;
const baseBody = deps.baseBody;

  for(const name of STEPS){
    if(name === 'baseBody') continue;
    if(typeof starts[name] !== 'function') throw new Error('[run-boot] 시작 함수가 없어요: ' + name);
  }
  for(const name of Object.keys(starts)){
    if(!STEPS.includes(name) || name === 'baseBody') throw new Error('[run-boot] 차례 표에 없는 시작이에요: ' + name);
  }
  for(const k of ['load', 'loadSkins', 'renderLauncher', 'onFailed']){
    if(!baseBody || typeof baseBody[k] !== 'function') throw new Error('[run-boot] 기본 몸 칸에 ' + k + ' 가 없어요');
  }

  let began = false;
  /* 기본 몸 → 피부 → 런처. 몸을 못 읽으면(false) · 읽다 던져도 안내를 한 번 하고, 던진 쪽은 피부 없이 런처만 그린다.
     피부 읽기가 던져도 런처는 그린다. */
  function runBaseBody(){
    return baseBody.load().then(ok=>{
      if(!ok) baseBody.onFailed();
      return baseBody.loadSkins();
    }, e=>{ baseBody.onFailed(); throw e; }).then(()=>{ baseBody.renderLauncher(); }).catch(()=>baseBody.renderLauncher());
  }
  /* 한 칸이 던져도 다음 칸은 돈다 */
  function guard(label, fn){
    try{ Promise.resolve(fn()).catch((e)=>console.warn('[run-boot] ' + label + ' 실패', e)); }
    catch(e){ console.warn('[run-boot] ' + label + ' 실패', e); }
  }

  /** 켜기 — 한 번만. @return 돌렸으면 true · 이미 돌았으면 false */
  function begin(){
    if(began){ console.warn('[run-boot] 이미 시작했어요 — 두 번째 시작은 무시해요'); return false; }
    began = true;
    for(const name of STEPS) guard(name, name === 'baseBody' ? runBaseBody : starts[name]);
    return true;
  }

  return { begin };
}

window.TwRunBoot = { STEPS, createRunBoot };
})();
