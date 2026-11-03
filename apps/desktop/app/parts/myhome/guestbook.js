/* guestbook.js — 📖 방명록 — 새 글 배지(자기 홈) · 독립 팝업 창(웹박수 · 폭죽 · 글 목록 · 쓰기)
   화면만 맡는다 — 받기 · 쓰기 · 알림 걸기는 guestbook-feed.js(서버 /v1/guestbooks 는 guestbook-api.js)가 한다.
   앱 FSD 4번으로 app.js 에서 옮긴 모듈이고, 0.13 에서 Firebase 구독을 걷고 서버 원본으로 바꿨다.

   ★ 밖으로 내놓는 이름은 예전처럼 window 고리다(_mhGbStartWatch · _mhGbStopWatch · _mhGbRefreshBadge · _mhGbMarkAllRead ·
     _mhReSubscribeGuestbook · openMyGuestbook). 부르는 곳(마이홈 열기 · 닫기 · 친구 홈 관람 · 런처로 돌아가기)은 고치지 않았다.
     createGuestbook 은 같은 함수들을 반환값으로도 내놓는다(검사 · 앞으로 옮길 곳이 쓴다).
   ★ 💬 showChatBubble(머리 위 말풍선)은 방명록이 아니라 app.js 에 남겼다(일곱 구역이 쓴다).
   ★ createGuestbook 은 app.js 의 원래 자리에서 부른다. 만들 때 바로 도는 것(#mhGuestbookBtn 클릭 연결 · window 고리 등록)이
     예전과 같은 순서 · 같은 때에 돈다. 서버에 요청하는 것은 없다 — 마이홈을 열 때(startWatch) · 창을 열 때(open)부터다.
   ⚠️ 쓸 수 있는지(친구인지)는 서버가 준 canWrite 만 본다 — 이 파일에서 친구 목록으로 다시 판정하지 말 것.
   ⚠️ 방명록 창은 main.js 가 blur 에서 닫기도 한다 — 창이 닫히면 pagehide 로 feed.closeBook()(받은 것 비우기 · «보는 중» 떼기)을 부른다.
   ⚠️ document 는 전역 이름으로 쓴다(이 파일은 app.js 앞에 싣는 classic script). 전역 이름은 TwGuestbook —
     크로미움 내장 전역과 겹치는 이름(Scheduler 같은)을 쓰면 typeof 가드가 늘 통과한다(#103).
   검사: checks/sim-guestbook.js — 만들 때 배선 · 배지 · 창 열기(받는 중 · 못 받음 · 외부인 · 관람) · 쓰기 · 삭제 · 박수 · 폭죽 · app.js 배선 · html 순서.
         자식 창 테마 규약은 sim-child-theme 이 이 파일을 읽어 본다. */
(function(){

function createGuestbook(deps){
const getMyUserId = deps.getMyUserId;
const getDisplayName = deps.getDisplayName;
const toast = deps.toast;
const escHtml = deps.escHtml;
const applyThemeToChildDoc = deps.applyThemeToChildDoc;   // 🎨 별도 창 = 별도 document — 테마 토큰을 넣어 준다
const watchMaintenanceInput = deps.watchMaintenanceInput; // 🛠 이 창에서 누른 서버 동작에도 점검 창(maintenance-gate.js)
const _mhViewingUserId = deps.mhViewingUserId;            // 👀 친구 홈 관람 중이면 그 사람 uid — app.js 의 let(다시 대입된다)
const _mhViewingDisplayName = deps.mhViewingDisplayName;
const feed = deps.feed;                                   // 📖 받기 · 쓰기 · 알림 한 벌(guestbook-feed.js)
const errorText = deps.errorText;                         // 오류 번호 → 사용자에게 보이는 글(TwErrorCodes.toastText) — 창 안 안내줄용
const notifyError = deps.notifyError;                     // TwErrorCodes.notify — 박수 그림 올리기 실패(옛 길)에만 직접 쓴다
const setClapImage = deps.setClapImage;                   // 🖼 박수 그림 올리기 — 서버에 그림 길이 생길 때까지 옛 길 그대로(app.js 가 연결)

/* ============================================================ 📖 방명록 새 글 뱃지 (자기 홈 관점)
   ── 마이홈이 열려있을 때만 «마지막으로 방명록 창을 연 뒤 새 글 수» 를 서버에서 받아 방명록 버튼(#mhGuestbookBtn)
      우측 상단에 빨간 뱃지(개수)를 표시. 글 목록은 받지 않는다 — 숫자 하나(열 때 · 서버 알림 때).
   ── 관람 모드(_mhViewingUserId != null)에서는 자기 홈이 아니라 친구 홈을 보고 있으므로 뱃지 숨김.
      관람 전환 시 refresh만 호출해서 즉시 반영. */
(function bindGuestbookBadge(){
  function _updateBadge(){
    const badge = document.getElementById('mhGuestbookBadge'); if(!badge) return;
    const n = feed.badgeCount();
    // 관람 중이면 뱃지 숨김 (친구 홈에는 자기 방명록 새 글 뱃지가 뜨면 안 됨)
    if(_mhViewingUserId() || n <= 0){ badge.classList.add('hidden'); return; }
    badge.textContent = n > 99 ? '99+' : String(n);
    badge.classList.remove('hidden');
  }
  feed.onChange((e)=>{ if(e.kind === 'badge') _updateBadge(); });
  function start(){ feed.startBadge(getMyUserId()); }
  function stop(){ feed.stopBadge(); }
  // 방명록 창을 열면 새 글을 모두 읽은 걸로 간주 — 뱃지 즉시 해제. 관람 중엔 스킵.
  function markAllRead(){
    if(_mhViewingUserId()) return;
    feed.markRead();
  }
  window._mhGbStartWatch    = start;
  window._mhGbStopWatch     = stop;
  window._mhGbRefreshBadge  = _updateBadge;
  window._mhGbMarkAllRead   = markAllRead;
})();

/* ============================================================ 📖 방명록 팝업 (웹박수 + 글 목록)
   — 내 홈이면 홈 주인(나) 관점: 웹박수 이미지 · 폭죽은 내가 바꾼다. 친구 홈 관람 중이면 그 친구 방명록 — 박수·글만. */
/* ============================================================ 📖 방명록 — 독립 팝업 창 (요청사항: 마이홈과 분리, 마이홈이 닫혀도 방명록은 유지)
   window.open('mhGuestbook') → main.js의 setWindowOpenHandler가 Win98풍 프레임리스 창으로 열어줌.
   페이지 마크업은 opener(여기)에서 직접 그려넣고, 서버에서 받은 방명록(feed.view())을 opener 가 그린다
   (같은 origin의 자식 창이라 DOM을 직접 조작 가능 — 별도 스크립트 파일 필요 없음). */
(function bindGuestbook(){
  let _gbWin=null;
  // 마이홈2-B: 관람 모드면 방명록/박수도 그 친구 것을 보여줌 — helper 함수들을 IIFE 상단에 두어 submit(내부)에서도 참조 가능하게.
  function _gbTargetId(){ return _mhViewingUserId() ? _mhViewingUserId() : getMyUserId(); }
  /* 입력칸 ↔ 안내줄 갈아끼우기 — 쓸 수 있는지는 서버가 준 canWrite 다(주인이거나 주인의 친구).
     🚪 친구가 아닌 사람도 공개된 남의 홈을 구경할 수 있지만 방명록 **작성**은 친구만 한다 — 모르는 사람이 글을 남길 수 있으면
       공개를 켜는 것이 곧 낙서장을 여는 일이 된다.
     ⚠️ 받는 중 · 못 받음에는 입력칸도 안내줄도 보이지 않는다(받기 전에 쓰게 하지 않는다). 받으면 feed 알림이 다시 칠한다. */
  function _gbApplyWriteUI(d){
    if(!d) return;
    const v = feed.view();
    const row = d.getElementById('gbInputRow'), note = d.getElementById('gbGuestNote');
    if(row) row.style.display = (v && v.canWrite) ? 'flex' : 'none';
    if(note) note.style.display = (v && !v.canWrite) ? 'block' : 'none';
  }
  /* 홈 주인이 바뀌면(내 홈 ↔ 친구 홈 관람) 열려 있던 방명록 창을 닫는다.
     예전엔 창은 그대로 두고 데이터만 갈아끼웠는데, 창 겉모습(제목·이미지등록 링크)은 이전 주인인 채
     새 주인의 데이터가 렌더되면서 "친구 방명록에 내 웹박수 이미지가 잠깐 보이는" 혼합 상태가 됐다(제보 증상).
     서버 요청은 하지 않는다 — 새 주인의 방명록은 창을 열 때 받는다. */
  let _gbCurrentTarget = null;
  function _gbSubscribeIfNeeded(){
    const target = _gbTargetId();
    if(_gbCurrentTarget === target) return;
    if(_gbCurrentTarget !== null && _gbAlive()){ try{ _gbWin.close(); }catch(_){} }
    _gbWin = null;   // ★ 죽은 프록시도 여기서 반드시 버린다 — 남겨두면 다음 open()이 "이미 열려있음"으로 오판한다
    feed.closeBook();
    _gbCurrentTarget = target;
  }
  window._mhReSubscribeGuestbook = _gbSubscribeIfNeeded;
  feed.onChange((e)=>{
    if(e.kind !== 'book') return;
    if(!_gbAlive()){ if(_gbWin){ _gbWin = null; feed.closeBook(); } return; }   // 창이 이미 죽었다(main.js 의 blur 닫기) — 받아 둔 것·«보는 중» 을 거둔다
    renderClap(); renderList(); _gbApplyWriteUI(gbDoc());
  });

  function relTime(ts){
    const d=Date.now()-(ts||0);
    if(d<60e3) return '방금';
    if(d<3600e3) return Math.floor(d/60e3)+'분 전';
    if(d<86400e3) return Math.floor(d/3600e3)+'시간 전';
    if(d<172800e3) return '어제';
    return Math.floor(d/86400e3)+'일 전';
  }
  /* 🎆 폭죽 이모지는 자유 입력이다 — 정해둔 목록에서 고르는 게 아니라 뭐든 넣을 수 있다.
     ⚠️ 대신 **한 글자만** 남긴다. 문장이 들어오면 조각마다 글자가 길어져 폭죽이 아니라 글자 뭉치가 된다.
     👨‍👩‍👧 처럼 ZWJ로 이어붙인 이모지는 코드포인트가 여럿이라 slice로 자르면 반쪽이 남는다 —
     Intl.Segmenter(grapheme)로 '사람 눈에 한 글자'를 집고, 없는 환경에서는 코드포인트 단위로 떨어진다. */
  function gbFirstGrapheme(s){
    const t=String(s==null?'':s).trim();
    if(!t) return '';
    try{
      if(typeof Intl!=='undefined' && Intl.Segmenter){
        for(const g of new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(t)) return g.segment;
      }
    }catch(_){}
    return Array.from(t)[0] || '';
  }
  const GB_HTML = '<!doctype html><html><head><meta charset="utf-8"><style>'+
    /* 🎨 [2026-09-15 제보 5] 테마 토큰. --win-*·--acc-* 는 창을 열 때 applyThemeToChildDoc 가 메인 문서에서 읽어
       <style id=twThemeTokens> 로 넣어 준다. 아래는 방명록 **고유색** — 기본 테마는 예전 값 그대로, 버블은 액센트로.
       모든 var() 에 예전 값을 폴백으로 둬서 토큰이 안 들어와도 옛 모습 그대로다. */
    'html{--gb-clap:#1440c8;--gb-label:#c0392b;--gb-link:#2a4fa8;--gb-rule:#f2f2f2;--gb-note:#eee;}'+
    'html[data-theme=bubble]{--gb-clap:var(--acc-d);--gb-label:var(--acc-d);--gb-link:var(--acc-d);--gb-rule:var(--acc-tint);--gb-note:var(--acc-tint);}'+
    /* 피치·민트는 --acc-d 가 너무 옅어 흰 글씨가 안 읽힌다 — 한 단계 진하게 */
    'html[data-theme=bubble][data-accent=c4]{--gb-clap:#E39BB5;--gb-label:#C9708F;--gb-link:#C9708F;}'+
    'html[data-theme=bubble][data-accent=c5]{--gb-clap:#7CC4B0;--gb-label:#5FA894;--gb-link:#5FA894;}'+
    'body{margin:0;overflow:hidden;background:var(--win-face-grad,none),var(--win-face,#c0c0c0);font-family:var(--win-font,Tahoma,"Malgun Gothic",sans-serif);height:100vh;box-sizing:border-box;'+
    'border:2px solid;border-color:var(--win-hi,#fff) var(--win-lo-2,#404040) var(--win-lo-2,#404040) var(--win-hi,#fff);border-radius:var(--win-radius,0px) var(--win-radius,0px) 0 0;color:var(--win-ink,#000);display:flex;flex-direction:column;}'+
    /* [2026-09-16 제보 5 후속 · 시안 A] 플레이리스트 바(#myPlHead)와 같은 문법으로.
       ① margin 을 뺀다 — 2px 여백이 있으면 창 테두리와 바 사이에 흰 선이 보여 «붙어 있지 않은» 인상이 된다.
       ② 아래 모서리는 사각(위만 --win-radius-2px). 창 body 가 위만 둥근 것과 짝을 맞춘다.
       ③ 글씨 흰 그림자 + 바 아래 안쪽 그림자 — 플레이리스트 바의 입체감이 이 두 줄에서 나온다.
       ⚠️ 기본(각진) 테마에서는 --win-radius 가 0 이라 모서리 값이 전부 0 이 되고, 그림자 두 줄만 남는다.
         그 두 줄은 본창 타이틀바(.win98titlebar)도 테마와 무관하게 쓰고 있어 어긋나지 않는다. */
    '#gbTitle{height:22px;padding:4px 5px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;box-sizing:border-box;'+
    'background:var(--win-title-grad,linear-gradient(90deg,#000080,#1084D0));color:var(--win-title-ink,#fff);border-radius:max(0px,calc(var(--win-radius,0px) - 2px)) max(0px,calc(var(--win-radius,0px) - 2px)) 0 0;font-size:11.5px;font-weight:bold;user-select:none;-webkit-app-region:drag;'+
    'text-shadow:0 1px 0 rgba(255,255,255,.5);box-shadow:inset 0 -1px 0 rgba(0,0,0,.10);}'+
    '#gbClose{width:16px;height:14px;font-size:9px;line-height:1;cursor:pointer;padding:0;flex-shrink:0;-webkit-app-region:no-drag;'+
    'background:var(--win-btn-grad,none),var(--win-face,#c0c0c0);border:1px solid;border-color:var(--win-hi,#fff) var(--win-lo-2,#404040) var(--win-lo-2,#404040) var(--win-hi,#fff);border-radius:var(--win-radius-el,0px);color:var(--win-ink,#000);}'+
    '#gbBody{flex:1;min-height:0;margin:0 4px 4px;padding:10px;background:#fff;display:flex;flex-direction:column;gap:8px;overflow:hidden;position:relative;border-radius:var(--win-radius-sm,0px);}'+
    '#gbClapBox{width:100%;height:150px;flex-shrink:0;cursor:pointer;overflow:hidden;background:var(--gb-clap,#1440c8);border-radius:var(--win-radius-sm,0px);'+
    'display:flex;align-items:center;justify-content:center;text-align:center;color:#fff;font-size:15px;font-weight:bold;line-height:1.7;}'+
    '#gbClapBox img{width:100%;height:100%;object-fit:contain;background:#fff;display:block;}'+
    '#gbClapTotal{font-size:14px;font-weight:bold;color:var(--win-ink,#111);letter-spacing:.5px;flex-shrink:0;}'+
    '#gbClapRow{display:flex;align-items:center;justify-content:space-between;flex-shrink:0;gap:6px;}'+
    '#gbClapRight{display:flex;align-items:center;gap:5px;flex-shrink:0;}'+
    '#gbClapFwLbl{font-size:10px;color:var(--win-ink-soft,#666);}'+
    '#gbClapEmoji{width:34px;text-align:center;font-size:14px;line-height:1.2;padding:2px 0;background:#fff;'+
    'font-family:"Segoe UI Emoji","Apple Color Emoji",Tahoma,sans-serif;'+
    'border:1px solid;border-color:var(--win-lo-2,#404040) var(--win-hi,#fff) var(--win-hi,#fff) var(--win-lo-2,#404040);border-radius:var(--win-radius-sm,0px);}'+
    /* 🎆 폭죽 조각 — #gbBody(position:relative) 기준 절대배치. 클릭 지점에서 사방으로 흩어졌다가
       살짝 아래로 떨어지며 사라진다. 조각마다 각도·거리·회전·시간이 다르다(--dx/--dy/--r/--d). */
    '.gb-fw{position:absolute;left:0;top:0;pointer-events:none;z-index:5;will-change:transform,opacity;'+
    'animation:gbFw var(--d,900ms) cubic-bezier(.12,.72,.32,1) forwards;}'+
    '@keyframes gbFw{'+
    '0%{transform:translate(var(--x),var(--y)) scale(.35) rotate(0deg);opacity:0;}'+
    '14%{opacity:1;}'+
    '58%{transform:translate(calc(var(--x) + var(--dx)),calc(var(--y) + var(--dy))) scale(1.1) rotate(var(--r));opacity:1;}'+
    '100%{transform:translate(calc(var(--x) + var(--dx) * 1.16),calc(var(--y) + var(--dy) + 52px)) scale(.85) rotate(var(--r));opacity:0;}'+
    '}'+
    '#gbImgSet{font-size:10px;color:var(--gb-link,#2a4fa8);text-decoration:underline;cursor:pointer;}'+
    '.gb-del{margin-left:6px;color:#c0392b;cursor:pointer;font-size:10px;text-decoration:underline;flex-shrink:0;}'+
    '#gbListLabel{font-size:11px;font-weight:bold;color:var(--gb-label,#c0392b);border-bottom:1px solid var(--gb-rule,#eee);padding-bottom:3px;flex-shrink:0;}'+
    '#gbList{flex:1;min-height:60px;overflow-y:auto;display:flex;flex-direction:column;gap:7px;}'+
    '.gb-row{border-bottom:1px solid var(--gb-rule,#f2f2f2);padding-bottom:5px;}'+
    '.gb-head{display:flex;justify-content:space-between;align-items:center;font-size:11px;}'+
    '.gb-head b{color:var(--gb-link,#2a4fa8);} .gb-head span{color:#aaa;font-size:9.5px;}'+
    '.gb-text{font-size:11px;color:var(--win-ink,#333);margin-top:2px;line-height:1.5;word-break:break-word;}'+
    '.gb-empty{color:#999;font-size:10.5px;text-align:center;padding:16px 0;}'+
    '.gb-retry{color:var(--gb-link,#2a4fa8);text-decoration:underline;cursor:pointer;}'+
    /* 📣 창 안 안내줄 — 실패 신호가 부모 창 토스트로만 나가던 것을 여기서도 보여준다.
       외부인 안내(#gbGuestNote)와 같은 자리·같은 테두리를 쓰되 색만 경고색이다. */
    '#gbMsg{display:none;flex-shrink:0;font-size:11px;line-height:1.45;color:#7a2718;background:#fbe6de;'+
    'border:1px solid;border-color:var(--win-lo-2,#404040) var(--win-hi,#fff) var(--win-hi,#fff) var(--win-lo-2,#404040);border-radius:var(--win-radius-sm,0px);padding:5px 6px;}'+
    '#gbInputRow{display:flex;gap:5px;flex-shrink:0;}'+
    /* 🚪 외부인 안내 — 입력칸 자리에 대신 들어간다. 자리를 비우면 창 아래가 뭉텅 잘린 것처럼 보인다. */
    '#gbGuestNote{display:none;flex-shrink:0;font-size:10.5px;line-height:1.6;color:var(--win-ink-soft,#555);'+
    'text-align:center;padding:6px 4px;background:var(--gb-note,#eee);border:1px solid;border-color:var(--win-lo-2,#404040) var(--win-hi,#fff) var(--win-hi,#fff) var(--win-lo-2,#404040);border-radius:var(--win-radius-sm,0px);}'+
    '#gbInput{flex:1;min-width:0;font-family:var(--win-font,Tahoma,"Malgun Gothic",sans-serif);font-size:11px;padding:4px 6px;'+
    'border:1px solid;border-color:var(--win-lo-2,#404040) var(--win-hi,#fff) var(--win-hi,#fff) var(--win-lo-2,#404040);border-radius:var(--win-radius-sm,0px);}'+
    '#gbSubmit{font-size:11px;padding:4px 10px;cursor:pointer;color:var(--win-ink,#222);background:var(--win-btn-grad,none),var(--win-face,#c0c0c0);'+
    'border:1px solid;border-color:var(--win-hi,#fff) var(--win-lo-2,#404040) var(--win-lo-2,#404040) var(--win-hi,#fff);border-radius:var(--win-radius-el,0px);}'+
    '</style></head><body>'+
    '<div id="gbTitle"><span id="gbTitleText">방명록</span><button id="gbClose">\u2715</button></div>'+
    '<div id="gbBody">'+
    '<div id="gbClapBox" title="클릭하면 박수(TOTAL CLAP)가 1 올라가요 — 하루 5번까지">'+
    '<span id="gbClapHint">웹박수 이미지<br>클릭하면 total 누적</span><img id="gbClapImg" style="display:none;" draggable="false"></div>'+
    '<div id="gbClapRow"><div id="gbClapTotal">TOTAL CLAP : 0</div>'+
    '<div id="gbClapRight"><span id="gbClapFwLbl">폭죽</span>'+
    '<input id="gbClapEmoji" type="text" placeholder="🎉" '+
    'title="박수를 누르면 여기 넣은 것이 폭죽처럼 터져요 — 아무 이모지나 넣을 수 있고, 비우면 꺼져요&#10;(Windows 키 + . 로 이모지 창)">'+
    '<span id="gbImgSet">이미지 등록</span></div></div>'+
    '<div id="gbListLabel">방명록</div><div id="gbList"></div>'+
    '<div id="gbMsg"></div>'+
    '<div id="gbInputRow"><input id="gbInput" type="text" maxlength="100" placeholder="방명록 남기기..."><button id="gbSubmit" type="button">등록</button></div>'+
    '<div id="gbGuestNote">친구만 방명록을 남길 수 있어요.<br>마이홈 › 친구에서 친구를 맺어보세요.</div>'+
    '<input id="gbClapImgFile" type="file" accept="image/*" style="display:none;">'+
    '</div></body></html>';
  /* 🩺 창이 정말 살아있는지 — `.closed` 하나만 믿지 않는다.
     [경위] 방명록 창은 **main.js가 blur 이벤트에서 닫는다**(main.js `win.on('blur', … win.close())`).
       renderer가 스스로 닫은 경우(✕·ESC)와 달리, 메인 프로세스가 닫은 창은 opener가 들고 있는
       프록시의 `closed` 가 그대로 false 로 남을 수 있다. 그러면 open() 이 "이미 열려 있음"으로
       판단해 focus() 만 부르고 끝나서 **버튼을 눌러도 아무 일도 안 일어난다**(제보 증상).
       main.js 634줄 주석의 최소화-복원 사고와 같은 종류다 — 거기선 창이 살아 있었고, 여기선 죽어 있다.
     ★ 그래서 문서를 실제로 만져본다. 창이 죽었으면 document 접근이 던지거나 빈 문서가 나온다.
       판정을 여기 한 곳으로 모아 gbDoc()·open()·_gbSubscribeIfNeeded() 가 같은 답을 보게 한다. */
  function _gbAlive(){
    try{
      if(!_gbWin || _gbWin.closed) return false;
      const d = _gbWin.document;
      return !!(d && d.getElementById && d.getElementById('gbBody'));
    }catch(_){ return false; }
  }
  function gbDoc(){ return _gbAlive() ? _gbWin.document : null; }
  /* 📣 방명록 창 안에서 말하기 ─────────────────────────────────────────────
     [경위] 이 창의 실패 신호는 전부 toast() 였다. 그런데 toast 는 **메인 창의 #toast** 에 그려진다.
       방명록은 별도 OS 창이라 앞에 떠 있는 동안 그 토스트는 뒤에 가려진다 — 유저 눈에는
       "등록 버튼을 눌러도 아무 일도 안 일어난다" 로만 보인다(제보 증상).
     ★ 그래서 창 안에도 같은 말을 띄운다. toast 는 **없애지 않는다** — 마이홈 창을 보고 있는
       동안 실패하는 경로(구독 콜백 등)도 있어서 두 곳 다 필요하다.
     ⚠️ 성공은 여기 띄우지 않는다. 글이 목록에 뜨는 것 자체가 성공 신호다. */
  let _gbMsgTimer = null;
  function gbSay(msg){
    toast(msg);
    gbShow(msg);
  }
  /* 창 안 안내줄만 — 오류 번호 알림(TwErrorCodes.notify)이 이미 토스트를 띄웠을 때 */
  function gbShow(msg){
    const d=gbDoc(); if(!d) return;
    const el=d.getElementById('gbMsg'); if(!el) return;
    el.textContent=msg; el.style.display='block';
    if(_gbMsgTimer){ try{ clearTimeout(_gbMsgTimer); }catch(_){} }
    _gbMsgTimer = setTimeout(gbClearMsg, 8000);   // 계속 남아 목록을 좁히지 않게
  }
  function gbClearMsg(){
    if(_gbMsgTimer){ try{ clearTimeout(_gbMsgTimer); }catch(_){} _gbMsgTimer=null; }
    const d=gbDoc(); if(!d) return;
    const el=d.getElementById('gbMsg'); if(el){ el.textContent=''; el.style.display='none'; }
  }
  /* 🎆 폭죽 — 홈 주인이 골라둔 이모지를 클릭 지점에서 터뜨린다.
     ★ 조각은 반드시 스스로 지운다. animationend에서 remove하지 않으면 박수를 누를 때마다
       노드가 쌓여 창이 점점 무거워진다(방명록 창은 열어둔 채로 오래 쓴다).
     ⚠️ 이모지가 없는 홈(emoji가 빈 값)에서는 아무 것도 안 한다. em 을 주면(방금 고른 것을 서버 답 전에 미리 보기) 그 이모지로. */
  function gbBurst(cx, cy, em0){
    const d=gbDoc(); if(!d) return;
    const v0=feed.view();
    const em=(em0!=null ? em0 : (v0 && v0.clap.emoji)) || ''; if(!em) return;
    const stage=d.getElementById('gbBody'); if(!stage) return;
    const r=stage.getBoundingClientRect();
    const box=d.getElementById('gbClapBox');
    const br=box?box.getBoundingClientRect():r;
    // 클릭 좌표가 없으면(선택만 바꿔 미리보기 할 때) 박수 이미지 한가운데서 터뜨린다
    const x=(cx==null? (br.left-r.left+br.width/2) : (cx-r.left));
    const y=(cy==null? (br.top -r.top +br.height/2) : (cy-r.top));
    const N=16;
    for(let i=0;i<N;i++){
      const a=(Math.PI*2*i/N)+(Math.random()-0.5)*0.36;
      const dist=44+Math.random()*50;
      const s=d.createElement('span');
      s.className='gb-fw'; s.textContent=em;
      s.style.setProperty('--x', Math.round(x)+'px');
      s.style.setProperty('--y', Math.round(y)+'px');
      s.style.setProperty('--dx', Math.round(Math.cos(a)*dist)+'px');
      s.style.setProperty('--dy', Math.round(Math.sin(a)*dist)+'px');
      s.style.setProperty('--r', Math.round(Math.random()*200-100)+'deg');
      s.style.setProperty('--d', Math.round(760+Math.random()*440)+'ms');
      s.style.fontSize=Math.round(13+Math.random()*13)+'px';
      s.addEventListener('animationend', ()=>{ try{ s.remove(); }catch(_){} });
      stage.appendChild(s);
    }
  }
  function renderClap(){
    const d=gbDoc(); if(!d) return;
    const v=feed.view(), clap=v && v.clap;
    const hint=d.getElementById('gbClapHint'), img=d.getElementById('gbClapImg');
    const clapSrc = clap && TwSafeHtml.safeUrl(clap.img, 'image');   // 그 집 주인이 올린 웹박수 그림 — 허용된 그림 주소만
    if(clapSrc){ if(img){img.src=clapSrc; img.style.display='block';} if(hint) hint.style.display='none'; }
    else { if(img) img.style.display='none'; if(hint) hint.style.display='block'; }
    const t=d.getElementById('gbClapTotal'); if(t) t.textContent='TOTAL CLAP : '+((clap&&clap.count)||0);
    /* 🎆 폭죽 이모지 동기화. ⚠️ 지금 그 칸에 타이핑 중이면 건드리지 않는다 — 서버 알림으로 다시 받은 값이
       방금 친 글자를 옛 값으로 덮어써서 "입력이 씹힌다"가 된다. */
    const emIn=d.getElementById('gbClapEmoji');
    if(emIn && d.activeElement !== emIn) emIn.value=(clap && clap.emoji) || '';
  }
  function renderList(){
    const d=gbDoc(); if(!d) return;
    const listEl=d.getElementById('gbList'); if(!listEl) return;
    const v=feed.view();
    listEl.innerHTML='';
    if(!v){   // 받는 중 · 못 받음 — «글이 없다» 와 가른다
      const box=d.createElement('div'); box.className='gb-empty';
      if(feed.status()!==feed.STATUS.LOADING){
        box.textContent='방명록을 불러오지 못했어요 ';
        const retry=d.createElement('span'); retry.className='gb-retry'; retry.textContent='다시 시도';
        retry.onclick=()=>{ feed.refreshBook({ manual:true }); };
        box.appendChild(retry);
      } else box.textContent='불러오는 중…';
      listEl.appendChild(box);
      return;
    }
    if(!v.entries.length){ listEl.innerHTML='<div class="gb-empty">아직 방명록이 없어요 — 첫 글을 남겨보세요!</div>'; return; }
    v.entries.forEach(en=>{   // 서버가 최신 글이 위로 준다
      const row=d.createElement('div'); row.className='gb-row';
      row.innerHTML='<div class="gb-head"><b>'+escHtml(en.name||'(이름 없음)')+'</b><span class="gb-meta"><span>'+relTime(en.ts)+'</span></span></div>'
        +'<div class="gb-text">'+escHtml(en.text||'')+'</div>';
      // ★ 내가 쓴 글(서버가 준 mine)만 삭제 링크 표시 — 글쓴이를 모르는 옛 글은 아무도 못 지운다
      if(en.mine){
        const del=d.createElement('span'); del.className='gb-del'; del.textContent='삭제';
        del.onclick=async ()=>{
          const r=await feed.remove(en.id);
          if(!r.ok && r.reason==='failed') gbShow(errorText(r.code || 'E-SYS-01'));   // 오류 번호 알림은 feed 가 이미 띄웠다
        };
        row.querySelector('.gb-meta').appendChild(del);
      }
      listEl.appendChild(row);
    });
  }
  const submit=async ()=>{
    const d=gbDoc(); if(!d) return;
    const inp=d.getElementById('gbInput');
    const text=(inp&&inp.value||'').trim().slice(0,100); if(!text) return;
    /* 🚪 쓸 수 없는 사람은 여기서 한 번 더 막는다 — 입력칸을 숨기는 것만으로는 부족하다(자식 창의 DOM은 콘솔로 되살릴 수 있다).
       진짜 막는 곳은 서버다(canWrite 가 아니면 NOT_FRIEND 로 거절). */
    const r=await feed.write(text);   // 마이홈2-B: 친구 마이홈 관람 중이면 그 친구 방명록에 남김. 아니면 내 방명록에.
    if(r.ok){ if(inp) inp.value=''; gbClearMsg(); return; }
    if(r.reason==='blocked'){ gbSay('친구만 방명록을 남길 수 있어요'); if(inp) inp.value=''; return; }
    if(r.reason==='failed') gbShow(errorText(r.code || 'E-SYS-01'));   // 오류 번호 알림은 feed 가 이미 띄웠다
    // closed · gone · stale — 창이 닫혔거나 계정이 바뀌는 중이다 — 조용히
  };
  function open(){
    // 방명록 창을 여는 순간이 "새 글을 확인하는 순간" — 자기 홈 뱃지의 lastRead를 지금 시각으로 갱신하고 뱃지 즉시 해제.
    //   이미 창이 열려있는 상태에서 재활성화(focus)만 하는 경우에도 동일하게 처리 (재클릭도 확인으로 간주).
    window._mhGbMarkAllRead();
    // 이미 떠 있으면 앞으로만 가져온다(받은 것은 feed 알림이 이미 그렸다).
    if(_gbAlive()){ try{ _gbWin.focus(); }catch(_){} return; }
    _gbWin = null;   // 죽은 프록시는 여기서 버린다(main.js가 blur로 닫은 창)
    feed.closeBook();   // 그 창이 열어 둔 방명록 · «보는 중» 도 거둔다
    /* ★ 홈 주인 전환을 **창을 만들기 전에** 끝낸다.
       [경위] 예전엔 창을 먼저 만들고 마지막에 _gbSubscribeIfNeeded() 를 불렀다. 그런데 그 함수는
         홈 주인이 바뀌었으면 "열려 있던 창"을 닫는데, 그 대상이 **방금 만든 창**이 된다 —
         관람 중에 _gbCurrentTarget 이 한 박자 늦은 상태(openFriendHomeView 가 중간에 예외로 빠진 경우 등)면
         창이 열리자마자 스스로 닫혔다. 증상은 "친구 홈에서만 버튼이 안 눌린다"로 보인다.
       ★ 순서를 뒤집으면 닫을 대상은 항상 '이전 창'뿐이라 이 경로가 구조적으로 사라진다. */
    _gbSubscribeIfNeeded();
    // ★ frameName을 매번 고유하게 — 같은 이름을 재사용하면 닫힌 창의 죽은 프록시가 반환돼
    //   "닫고 다시 열면 안 나오는" 문제가 있었음. 위치는 main.js(savedGbPos)가 기억해줌.
    _gbWin = window.open('', 'mhGuestbook_'+Date.now(), 'width=320,height=560');
    if(!_gbWin){ toast('방명록 창을 열 수 없어요'); return; }
    // 방명록 창을 확실히 앞으로 가져오기 — 열자마자 blur된 상태로 마이홈 창 뒤에 가려지는 문제 방지
    try{ _gbWin.focus(); }catch(_){}
    setTimeout(()=>{ try{ _gbWin.focus(); }catch(_){} }, 50);   // 초기 페인트 완료 후 한 번 더 앞으로
    const d=_gbWin.document;
    d.open(); d.write(GB_HTML); d.close();
    applyThemeToChildDoc(d);   // 🎨 [제보 5] 별도 창 = 별도 document — 메인의 data-theme 이 안 온다
    watchMaintenanceInput(d);  // d.close() 뒤에 — document.open 이 리스너를 지운다
    /* 창이 닫히면(✕ · ESC · main.js 의 blur 닫기) 받아 둔 방명록을 비우고 서버에 «보는 중» 을 뗀다. 다시 연 새 창을 닫지 않게 이 창일 때만. */
    const thisWin = _gbWin;
    thisWin.addEventListener('pagehide', ()=>{ if(_gbWin === thisWin){ _gbWin = null; feed.closeBook(); } });
    d.getElementById('gbTitleText').textContent = (_mhViewingUserId() ? _mhViewingDisplayName() : getDisplayName())+' 님의 방명록';
    d.getElementById('gbClose').onclick=()=>{ try{ _gbWin.close(); }catch(_){} };
    // ⎋ ESC로도 닫힘(요청사항). 마이홈 클릭으로 닫히는 건 별도 코드가 아니라 main.js의 blur-닫힘이 담당 —
    //   마이홈을 누르면 포커스가 메인 창으로 넘어가 방명록이 blur → 자동으로 닫힌다.
    //   (예전엔 메인 창이 포커스 없이 z순서만 올라와 blur가 안 나 "뒤에 깔린 채 열려있는" 상태가 됐다 —
    //    main.js의 parent 지정으로 그 경로 자체가 막혔다.)
    d.addEventListener('keydown', e=>{ if(e.key==='Escape'){ try{ _gbWin.close(); }catch(_){} } });
    // 관람 중엔 "이미지 등록" 링크 숨김 (남의 방명록 이미지는 못 바꿈)
    const imgSetEl=d.getElementById('gbImgSet');
    if(imgSetEl) imgSetEl.style.display = _mhViewingUserId() ? 'none' : '';
    /* 🎆 폭죽 이모지 — 자유 입력. 이미지와 같은 규칙으로 홈 주인만 바꾼다(관람 중엔 라벨까지 숨김).
       손님도 터지는 건 보므로, 값만 못 바꾸는 것이지 연출이 사라지는 게 아니다. */
    const emIn=d.getElementById('gbClapEmoji'), emLbl=d.getElementById('gbClapFwLbl');
    if(emIn){
      const hide = _mhViewingUserId() ? 'none' : '';
      emIn.style.display = hide; if(emLbl) emLbl.style.display = hide;
      /* ⚠️ 저장은 change(=Enter 또는 포커스 이탈)에서만 한다. input 마다 쓰면 한 글자 칠 때마다
         네트워크가 나가고, 이모지 입력기가 조합 중인 반쪽 값까지 서버에 올라간다. */
      emIn.onchange=async ()=>{
        const v=gbFirstGrapheme(emIn.value);
        emIn.value=v;                                   // 두 글자 이상 넣었으면 잘린 결과를 눈으로 보여준다
        const cur=feed.view();
        if(v === ((cur && cur.clap.emoji) || '')) return; // 안 바뀌었으면 조용히 넘어간다(포커스만 스쳐도 저장되지 않게)
        // 서버 응답을 기다리지 않고 먼저 터뜨려 본다 — 무엇이 터질지 눈으로 확인시킨다.
        if(v) gbBurst(null, null, v);
        const r=await feed.setEmoji(v);
        if(r.ok){ toast(v ? (v+' 폭죽으로 바꿨어요') : '폭죽을 껐어요'); return; }
        if(r.reason==='failed') gbShow(errorText(r.code || 'E-SYS-01'));   // 오류 번호 알림은 feed 가 이미 띄웠다
        renderClap();   // 저장하지 못했다 — 입력칸을 서버 값으로 되돌린다
      };
      // Enter로도 확정되게 — 입력 상자에 커서를 둔 채 창을 닫으면 change가 안 나는 경우가 있다
      emIn.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); emIn.blur(); } });
    }
    // 웹박수 — 클릭하면 TOTAL CLAP +1 (하루 몫 · 셈은 서버 — 남은 수는 서버가 준 todayLeft).
    //   이미지 등록/변경은 아래 "이미지 등록" 링크로 분리(파일 입력은 opener 쪽 hidden input 재사용).
    d.getElementById('gbClapBox').onclick=async (ev)=>{
      if(feed.clapBusy()){ toast('박수를 보내는 중이에요 — 잠시만요 👏'); return; }   // 응답을 기다리는 동안은 또 보내지 않는다
      /* 🎆 폭죽은 서버 응답 전에 터뜨린다 — 네트워크를 기다리면 손가락을 뗀 한참 뒤에 터져서
         내가 누른 것과 연결이 안 된다. 오늘 몫이 없다고 서버가 알려 준 홈에서는 터뜨리지 않는다. */
      const v0=feed.view();
      if(v0 && v0.clap.todayLeft > 0){ try{ gbBurst(ev && ev.clientX, ev && ev.clientY); }catch(_){} }
      const r=await feed.clap();
      if(r.ok){ toast('👏 박수! ('+(r.dailyMax - r.todayLeft)+'/'+r.dailyMax+')'); return; }
      if(r.reason==='limit') toast('오늘은 이 홈에 박수를 다 쳤어요 👏');
      else if(r.reason==='failed') gbShow(errorText(r.code || 'E-SYS-01'));   // 오류 번호 알림은 feed 가 이미 띄웠다
    };
    d.getElementById('gbImgSet').onclick=()=>{
      if(window.companion && companion.gbHold) companion.gbHold();   // 파일 다이얼로그로 포커스가 빠져도 방명록이 안 닫히게 유예
      // ★ 자식창의 input을 자식창 자체에서 click() — opener의 input을 원격 클릭하면 사용자 gesture 컨텍스트가
      //   자식창에 있어서 opener 쪽 파일 다이얼로그가 뜨지 않는 문제(요청사항 3번)를 해결.
      const f = d.getElementById('gbClapImgFile'); if(f){ f.value=''; f.click(); }
    };
    // 파일 선택되면 400px 리사이즈 후 Firebase에 저장 — 로직은 opener의 함수를 재사용하되 이벤트만 자식창에서
    d.getElementById('gbClapImgFile').addEventListener('change', ()=>{
      const f=d.getElementById('gbClapImgFile'); const file=f.files[0]; if(!file) return;
      const img=new Image(); const reader=new FileReader();
      reader.onload=e=>{ img.onload=()=>{
        const MAX=400;   // 요청사항: 웹박수 이미지 400×400 기준 — 넘으면 비율 유지 리사이즈
        const scale=Math.min(1, MAX/Math.max(img.width,img.height));
        const c=document.createElement('canvas');
        c.width=Math.round(img.width*scale); c.height=Math.round(img.height*scale);
        c.getContext('2d').drawImage(img,0,0,c.width,c.height);
        const data=c.toDataURL('image/jpeg',0.85);
        /* TODO: 박수 그림 올리기는 서버에 그림 길이(Storage 주소를 PATCH /v1/me/guestbook 의 clapImageUrl 로)가 생길 때까지 옛 길이다. */
        Promise.resolve(setClapImage(getMyUserId(), data))
          .then(()=>{ toast('웹박수 이미지를 등록했어요'); feed.refreshBook(); })
          .catch((e)=>{ notifyError('E-GB-06', e); gbShow(errorText('E-GB-06')); });
      }; img.src=e.target.result; };
      reader.readAsDataURL(file);
    });
    const inp=d.getElementById('gbInput');
    d.getElementById('gbSubmit').onclick=submit;
    inp.addEventListener('keydown', e=>{ if(e.key==='Enter') submit(); });
    inp.addEventListener('input', gbClearMsg);   // 다시 쓰기 시작하면 지난 안내는 치운다
    /* 서버에서 받는다 — 받는 중에는 입력칸 · 안내줄이 모두 숨고, 받으면 feed 알림이 그린다(🚪 친구가 아니면 입력칸 대신 안내줄) */
    _gbApplyWriteUI(d);
    renderClap();
    if(!feed.openBook(_gbTargetId())) renderList();   // 내 코드가 없으면 받을 수 없다 — «불러오지 못했어요»
  }
  window.openMyGuestbook=open;   // 다른 곳(친구 홈 방문 등)에서 재사용 가능
  document.getElementById('mhGuestbookBtn')?.addEventListener('click', open);
  // 웹박수 이미지 파일 선택은 방명록 창 안의 input(gbClapImgFile)이 처리 — opener의 hidden input은
  //   이제 사용하지 않지만, 다른 곳(예전 링크)에서 참조할 가능성 대비 markup은 그대로 남겨둠.
})();

/* 위 두 IIFE 가 window 에 건 고리를 반환값으로도 내놓는다 — 같은 함수다(부르는 곳은 예전처럼 window 고리). */
return {
  open: window.openMyGuestbook,                    // 📖 방명록 창 열기(마이홈 #mhGuestbookBtn)
  startWatch: window._mhGbStartWatch,              // 🏠 마이홈 열기 — 새 글 수 받기 시작
  stopWatch: window._mhGbStopWatch,                // 🏠 마이홈 닫기 · 런처로 — 알림 떼고 배지 숨김
  refreshBadge: window._mhGbRefreshBadge,          // 👀 관람 시작 · 끝 — 배지만 다시 계산
  markAllRead: window._mhGbMarkAllRead,            // 창을 열면 새 글 다 읽음
  reSubscribe: window._mhReSubscribeGuestbook,     // 👀 홈 주인이 바뀌면 열린 창을 닫는다(새 주인 것은 창을 열 때 받는다)
};
}

const api = { createGuestbook };
if(typeof window !== 'undefined') window.TwGuestbook = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
