/* sfx.js — 🔊 효과음 공장(_mkSndPool) — 때리기 · 클릭음 · 채팅 · 뽀모도로 알림음 풀
   app.js «🔊 효과음 공장» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 42번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 때리기 소리 상수(BONK_SND_VOL · BONK_SND_SRC)는 tricks.js 에서 이리로 옮겼다 — 소리 공장(아래층)이 위층 tricks 를 부르던 순환 끊기(checks/sim-dep-cycles.js).
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 1줄 —
     officeMode 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 0개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: CHAT_SFX_DEFAULT_ID · CHAT_SFX_DEFAULT_ON · CHAT_SFX_GAP_MS · CHAT_SFX_ID_KEY · CHAT_SFX_LIST · CHAT_SFX_ON_KEY · _bonkSnd · _chatSfxPools · _clickSnd · _pomoSnd — app.js 는 sfxMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwSfx — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-sfx.js */
(function(){

function createSfx(deps){
const officeMode = deps.officeMode;   // 읽는 함수
/* 🔊 효과음 — 회사원 모드면 소리를 내지 않는다.
   ★ 게이트는 **보는 사람 기준**이다(사양 9번). 내가 회사원 모드면 남이 남을 때리는 것도 조용해야
     하므로, 때리는 쪽이 아니라 재생하는 쪽에서 본다.
   ★ 인스턴스를 **미리 여러 개 만들어 두고 돌려 쓴다.** 이유가 둘이다:
     ① 하나만 재사용하면 연타의 두 번째 소리가 안 난다(아직 재생 중인 것을 다시 play 해도 무시된다)
     ② 때릴 때마다 cloneNode 로 새로 만들면 그 인스턴스는 **버퍼가 비어 있어** 첫 소리가 늦거나
        아예 안 난다 — 제보의 "잘 안 들린다"에 이것도 섞여 있었다.
   ⚠️ 그래서 `preload='auto'` 로 미리 받아 두고, 재생은 `currentTime=0` 되감기로 한다. */
/* 🔊 음량 — **1.0 이다.** BGM(_advBgm 등)의 0.5 를 베끼면 안 된다.
   ⚠️ 처음에 0.5 로 뒀다가 "소리가 잘 안 들린다" 제보를 받았다. 재 보니 이유가 둘이었다:
     ① 파일 자체의 최대 진폭이 -4.8 dBFS 였다(잘라 만든 파일이라 여유가 남아 있었다)
     ② 거기에 0.5(=-6 dB)를 더 곱해 실효 -10.8 dBFS 가 됐다
   파일은 -1.4 dBFS 로 노멀라이즈했고(같은 길이·같은 128kbps·페이드 유지), 여기는 1.0 으로 둔다.
   ★ BGM 은 **밑에 깔리는** 소리이고 타격음은 **뚫고 나와야 하는** 소리다 — 같은 값을 쓸 이유가 없다.
   ⚠️ 전역 효과음 음량 설정이 아직 없다. 생기면 이 상수 자리를 그 값으로 갈아끼울 것(8절 ③). */
const BONK_SND_VOL   = 0.5;
/* 🔊 파일 경로 폴백 — mystery-au.js 선례(['parts/x.mp3','x.mp3']). 검사 폴더에서도 돌게. */
const BONK_SND_SRC   = ['parts/bonk.mp3', 'bonk.mp3'];
const BONK_SND_POOL = 3;        // 연타 겹침 수. 스쿼시가 1.7초인데 소리는 0.6초라 3개면 넉넉하다
/* 🔊 효과음 한 벌 만들기 — 위 주석의 교훈(풀·preload·자동재생 잠금)을 **한 곳에** 담는다.
   ★ 소리를 새로 넣을 때마다 같은 함정을 다시 밟지 않으려고 공장으로 뺐다. 실제로 이 파일에는
     같은 실수를 두 번 할 자리가 이미 둘이다(때리기 · 캐릭터 클릭).
   ★ 게이트는 **보는 사람 기준**이다 — 회사원 모드면 어떤 소리도 내지 않는다(사양 9번).
   ⚠️ prime 은 앱 수명에 한 번이다. 만들어진 모든 벌이 같이 풀려야 하므로 등록도 여기서 한다. */
const _sndPools = [];
function _mkSndPool(tag, srcs, vol, size){
  const P = { tag, srcs, vol, size, list:null, turn:0, idx:0, primed:false };
  P.init = function(){
    if(P.list) return P.list;
    try{
      if(typeof Audio === 'undefined') return null;
      P.list = [];
      for(let i = 0; i < P.size; i++){
        const a = new Audio(P.srcs[P.idx]);
        a.preload = 'auto';
        a.volume = P.vol;
        a.addEventListener('error', ()=>{
          // 경로 폴백 — 다음 후보로 갈아탄다(검사 폴더처럼 parts/ 가 없는 배치)
          if(P.idx + 1 < P.srcs.length){ P.idx++; P.list = null; }
        });
        try{ a.load(); }catch(_){}
        P.list.push(a);
      }
    }catch(_){ P.list = null; }
    return P.list;
  };
  /* 🔓 첫 사용자 제스처에서 음량 0 으로 한 번 재생해 **자동재생 잠금을 풀어 둔다.**
     ★ 이게 없으면 "내가 때리면 소리가 나는데 **남이 나를 때리면 조용한**" 증상이 남는다.
       내가 때릴 때는 클릭 안에서 play() 가 불려 통과하지만, 남이 때린 걸 받는 시점에는 내 쪽에
       제스처가 없어서 브라우저가 거부한다(NotAllowedError). 증상이 전파 버그처럼 보여서
       poke 쪽을 한참 뒤지게 된다 — 소리 문제인 줄 모른다.
     ⚠️ 거부되면 콘솔에 이유를 남긴다. 조용히 삼키면 다음에 또 원인을 못 찾는다. */
  P.prime = function(){
    if(P.primed) return;
    const pool = P.init();
    if(!pool || !pool.length) return;
    P.primed = true;
    pool.forEach(a=>{
      try{
        a.volume = 0;
        const back = ()=>{ try{ a.pause(); a.currentTime = 0; }catch(_){} a.volume = P.vol; };
        const pr = a.play();
        if(pr && pr.then) pr.then(back).catch(e=>{ back(); try{ console.warn('[' + P.tag + '-snd] 잠금 해제 거부 — ' + ((e && e.name) || e)); }catch(_){} });
        else back();
      }catch(e){ a.volume = P.vol; }
    });
  };
  /* 재생 — 풀에서 다음 인스턴스를 꺼내 되감아 튼다. 연타해도 앞 소리를 끊지 않는다. */
  P.play = function(){
    try{
      if(typeof officeMode() !== 'undefined' && officeMode()) return;
      const pool = P.init();
      if(!pool || !pool.length) return;
      const a = pool[P.turn % pool.length];
      P.turn++;
      a.volume = P.vol;
      try{ a.currentTime = 0; }catch(_){}
      const pr = a.play();
      if(pr && pr.catch) pr.catch(()=>{});
    }catch(_){}
  };
  _sndPools.push(P);
  return P;
}
const _bonkSnd  = _mkSndPool('bonk',  BONK_SND_SRC,  BONK_SND_VOL,  BONK_SND_POOL);
/* 🖱 캐릭터 클릭음 — 쓰다듬(triggerPet)과 같은 자리에서 난다.
   ★ 풀이 때리기보다 크다(5). 클릭은 훨씬 빨리 연타되고, 하나짜리를 돌려 쓰면 두 번째 소리가
     아예 안 난다("연속으로 누르면 연속으로 들리게" 가 이 숫자에 걸려 있다).
   ★ 음량은 **여기 한 숫자**로 조절한다. 0 ~ 1 이고 1 이 이 파일이 낼 수 있는 최대다 —
     Audio.volume 은 1 을 넘길 수 없어서, 1 에서도 작으면 상수가 아니라 mp3 자체를 키워야 한다
     (그때는 파일을 노멀라이즈하거나 WebAudio GainNode 로 증폭하는 수밖에 없다).
   ★ 눈금 — 0.35 는 배경음처럼 깔리는 정도, 0.6(지금)은 또렷하게 들리는 정도, 0.85 이상은
     연타할 때 귀에 찬다. 0.05 단위로는 차이를 못 느낀다.
   ⚠️ 파일은 `parts/click.mp3` 에 둔다(없으면 같은 폴더의 click.mp3 로 떨어진다 — 때리기와 같은 관례). */
const CLICK_SND_VOL  = 0.6;
const CLICK_SND_SRC  = ['parts/click.mp3', 'click.mp3'];
const CLICK_SND_POOL = 5;
const _clickSnd = _mkSndPool('click', CLICK_SND_SRC, CLICK_SND_VOL, CLICK_SND_POOL);
/* 🔔 채팅 알림음 (2026-09-17 · 시안 확정) — 대화창 [설정] › 알림음.
   ★ 소리는 셋 중 하나를 고른다. 풀은 **소리마다 하나씩, 여기서 미리** 만든다 — 바로 아래
     prime 등록이 once:true 라, 나중에 만든 풀은 자동재생 잠금 해제를 못 받아
     «남의 메시지가 와도 조용하다» 가 된다(때리기에서 이미 겪은 그 증상).
   ★ 게이트 셋: ① 꺼짐 ② 대화창이 열려 있음(보고 있는 중) ③ 회사원 모드(_mkSndPool.play 안 — 보는 사람 기준).
   ★ 울리는 자리는 **한 곳**, 상대 채팅이 화면에 뜨는 순간이다(syncFriendSeats 의 말풍선·날리기 분기).
     friends 에는 내 좌석이 없으므로 내 메시지에는 울리지 않는다.
   ⚠ 저장은 로컬(tw.chatSfx · tw.chatSfxId) — 글자 크기와 같은 성격이라 서버에 안 올린다.
   ⚠ 목록의 id 는 HTML #chatSfxList 의 data-sfx 와 같아야 한다. 파일은 app/parts/ 에 둔다. */
const CHAT_SFX_LIST = [
  { id:1, label:'알림음 1', srcs:['parts/chat-notify-1.mp3', 'chat-notify-1.mp3'] },
  { id:2, label:'알림음 2', srcs:['parts/chat-notify-2.mp3', 'chat-notify-2.mp3'] },
  { id:3, label:'알림음 3', srcs:['parts/chat-notify-3.mp3', 'chat-notify-3.mp3'] },
];
const CHAT_SFX_ON_KEY      = 'tw.chatSfx';     // '1' 켜짐 · '0' 꺼짐 · 없음 = 기본값
const CHAT_SFX_ID_KEY      = 'tw.chatSfxId';
const CHAT_SFX_DEFAULT_ON  = true;             // 처음 쓰는 사람은 켜진 채로 시작한다
const CHAT_SFX_DEFAULT_ID  = 1;
const CHAT_SFX_VOL         = 0.6;              // 클릭음과 같은 눈금(«또렷하게 들리는 정도»)
const CHAT_SFX_POOL        = 2;                // 두 사람이 거의 동시에 말해도 둘 다 들리게
const CHAT_SFX_GAP_MS      = 250;              // 이보다 촘촘하면 한 번만 — 여럿이 몰아 치면 귀가 따갑다
const _chatSfxPools = {};
CHAT_SFX_LIST.forEach(x=>{ _chatSfxPools[x.id] = _mkSndPool('chat' + x.id, x.srcs, CHAT_SFX_VOL, CHAT_SFX_POOL); });
/* 🍅 뽀모도로 알림음 (2026-10-02 · 지정 파일 beep-alarm) — 집중 끝 · 휴식 끝 둘 다 이 소리. 3.5초짜리라 풀은 하나면 된다.
   ★ 여기(prime 등록 **위**)에서 만든다 — 아래 once:true 등록보다 늦게 만든 풀은 자동재생 잠금 해제를 못 받아
     창을 안 보고 있을 때 울려야 할 알람이 조용해진다(채팅 알림음 주석과 같은 이유).
   ⚠️ 파일은 app/parts/pomodoro-alarm.mp3. 회사원 모드면 울리지 않는다(_mkSndPool.play 의 공통 게이트). */
const POMO_SND_SRC = ['parts/pomodoro-alarm.mp3', 'pomodoro-alarm.mp3'];
const _pomoSnd = _mkSndPool('pomo', POMO_SND_SRC, 0.6, 1);
try{
  ['pointerdown','keydown'].forEach(ev=>window.addEventListener(ev, ()=>{
    _sndPools.forEach(P=>{ try{ P.prime(); }catch(_){} });
  }, { once:true, capture:true }));
}catch(_){}

return {
  CHAT_SFX_DEFAULT_ID,
  CHAT_SFX_DEFAULT_ON,
  CHAT_SFX_GAP_MS,
  CHAT_SFX_ID_KEY,
  CHAT_SFX_LIST,
  CHAT_SFX_ON_KEY,
  _bonkSnd,
  _chatSfxPools,
  _clickSnd,
  _pomoSnd,
};
}

const api = { createSfx };
if(typeof window !== 'undefined') window.TwSfx = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
