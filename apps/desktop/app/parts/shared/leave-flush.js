/* leave-flush.js — 떠나기 전(로그아웃 · 앱 끄기) 못 올린 저장을 기다린다 · 상한 8초 (검사 sim-leave-flush.js)
   [왜] 캐릭터는 서버가 원본이고 고침을 3초 묶음으로 올린다 — 고친 직후 끄면 그 고침이 사라진다. 로그아웃은 이미 올리고 기다렸다(8초 상한).
     끄기도 같은 기다림을 쓰도록 한 벌로 모았다(로그아웃 account.js · 끄기 답 answerQuit).
   끄기 순서: main 이 끄기를 한 번 붙잡고 묻는다(apps/desktop/quit-hold.js) → 여기 answerQuit 가 올릴 것만 올리고(없으면 바로) 답한다 → main 이 다시 끈다.
   ★ 타이머는 이 파일이 실린 곳의 것을 쓴다 — 검사가 가짜 시계로 굴린다. */
(function(){
'use strict';

const LEAVE_FLUSH_MAX_MS = 8000;   // 올리기를 기다리는 상한 — 캐릭터 저장은 그림 올리기가 딸려 느릴 수 있다(시간 자체가 규칙이라 타이머를 쓴다)

/* 일(함수) 여럿을 함께 돌리고, 모두 끝나거나 상한이 지나면 돌아온다. 던지거나 실패한 일도 끝난 것으로 본다 — 무엇이 남았는지는 부르는 쪽이 따로 센다.
   @return Promise<{ timedOut }> */
async function flushWithin(jobs){
  const runs = [];
  for(const job of jobs){ try{ runs.push(Promise.resolve(job())); }catch(_){} }
  if(!runs.length) return { timedOut: false };
  let timer = null;
  const timedOut = await Promise.race([
    Promise.allSettled(runs).then(() => false),
    new Promise(res => { timer = setTimeout(() => res(true), LEAVE_FLUSH_MAX_MS); }),
  ]);
  clearTimeout(timer);
  return { timedOut };
}

/* 렌더러 — main 이 끄기 전에 물으면 jobs 를 올리고(상한 8초) 답한다. companion 이 없으면(브라우저 미리보기 · 검사) 걸지 않는다. */
function answerQuit(companion, jobs){
  if(!companion) return;
  companion.onQuitFlush(async () => {
    await flushWithin(jobs);
    companion.quitFlushDone();
  });
}

const api = { LEAVE_FLUSH_MAX_MS, flushWithin, answerQuit };
window.TwLeaveFlush = api;
})();
