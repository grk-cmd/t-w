/* 🎬 영상 겹침 실험 안내 — 설정 › 시스템의 «영상 겹침 실험» 칸 아래 한 칸.
   main.js 의 _labNotice() 가 고른 종류(r.notice)에 맞춰 글과 버튼을 그린다. 상태의 원본은 main 의 설정 파일이라
   여기는 아무것도 기억하지 않는다(부팅 토스트를 한 번만 띄우는 localStorage 표시 하나만).
   [왜 토스트만으로 두지 않나] 0.11.0 설정 초기화가 실험을 끈 것을 9초 토스트로만 알렸다 — 깜빡임이 돌아온 사람이
     무엇이 꺼졌는지 몰랐다(0.11.2 제보). 답할 때까지 설정 화면에 남긴다.
   ⚠️ 자동으로 다시 켜지 않는다 — 이유는 main.js 🎬 주석(초기화를 겪은 사람은 켜면 창이 안 보였던 사람일 수 있다). */
(function(){
  'use strict';
  const TOAST_KEY = 'tw.labVideoNoticeToast';   // 부팅 토스트를 띄운 종류 — 같은 종류는 한 번만

  /* act: 'on' · 'off' → setLabVideo, 'confirm' · 'dismiss' → labVideoNotice */
  const KINDS = {
    reset: {
      msg: '업데이트하면서 영상 겹침 실험이 꺼졌어요. 유튜브 · 디스코드 영상이 깜빡이거나 검게 보이면 다시 켜 보세요.',
      acts: [['on', '다시 켜기'], ['dismiss', '괜찮아요']],
      toast: '업데이트하면서 영상 겹침 실험이 꺼졌어요 — 설정 › 시스템에서 다시 켤 수 있어요',
    },
    'trial-reverted': {
      msg: '지난번에 다시 켠 뒤 «잘 보여요» 확인이 없어 꺼 두었어요(화면이 안 보였을 수 있어요). 다시 해 보려면 눌러 주세요.',
      acts: [['on', '다시 켜기'], ['dismiss', '괜찮아요']],
      toast: '영상 겹침 실험을 꺼 두었어요(확인이 없었어요) — 설정 › 시스템에서 다시 켤 수 있어요',
    },
    trial: {
      msg: '다시 켰어요. 캐릭터와 이 창이 잘 보이면 [잘 보여요] 를 눌러 주세요 — 안 누르면 다음 실행 때 꺼져요.',
      acts: [['confirm', '잘 보여요'], ['off', '끄기']],
    },
    wait: {
      msg: '그래픽 정보를 확인하는 중이에요 — 확인되면 저절로 적용돼요.',
      acts: [],
    },
    unknown: {
      msg: '이번 실행엔 적용되지 않았어요(그래픽 정보를 끝내 못 읽었어요). 프로그램을 다시 시작하면 다시 시도해요.',
      acts: [],
    },
    blocked: {
      msg: '이번 실행엔 적용되지 않았어요 — 이 PC 는 지금 그래픽 가속이 꺼져 있어요. 다시 시작하면 다시 확인해요.',
      acts: [],
    },
  };

  function view(kind){ return (kind && KINDS[kind]) || null; }

  /* box 를 다시 그린다. onAct(act) 는 부르는 쪽(app.js)이 IPC 를 부르고 결과로 다시 render 한다. */
  function render(box, r, onAct){
    if(!box) return null;
    const v = view(r && r.notice);
    box.textContent = '';
    if(!v){ box.style.display = 'none'; return null; }
    const p = document.createElement('div');
    p.textContent = v.msg;
    box.appendChild(p);
    if(v.acts.length){
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:6px;margin-top:6px;';
      v.acts.forEach(([act, label]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'fs-toggle-btn';
        b.textContent = label;
        b.dataset.act = act;
        b.onclick = () => { if(typeof onAct === 'function') onAct(act); };
        row.appendChild(b);
      });
      box.appendChild(row);
    }
    box.style.display = '';
    return v;
  }

  /* 부팅 2.5초 뒤 한 번 — 설정 화면을 안 여는 사람도 알게. 같은 종류는 한 번만(답은 설정 화면에서). */
  function bootToast(r, toast){
    const v = view(r && r.notice);
    if(!v || !v.toast || typeof toast !== 'function') return false;
    let seen = null;
    try{ seen = localStorage.getItem(TOAST_KEY); }catch(_){}
    if(seen === r.notice) return false;
    try{ localStorage.setItem(TOAST_KEY, r.notice); }catch(_){}
    toast(v.toast, null, 9000);
    return true;
  }

  window.LabVideoNotice = { KINDS, TOAST_KEY, view, render, bootToast };
})();
