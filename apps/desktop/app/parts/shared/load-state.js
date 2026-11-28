/* load-state.js — 📦 서버 값 하나를 받는 틀(받기 전 · 받는 중 · 받음 · 못 받음) (검사 sim-load-state.js)
   [왜] CLAUDE.md «모르는 값을 그럴듯한 값으로 바꾸지 않는다» 를 코드로 지키는 자리다. 서버 값을 못 받았을 때 기본값(레벨 1 · 빈 목록)을 돌려주면
     부르는 쪽은 «모름» 과 «그 값» 을 가를 수 없다(B-1128-2 — 레벨 297 인 사람이 받기 전 1 로 잠김). 그래서 value() 는 받은 뒤에만 값을, 그 밖엔 null 을 준다.
     못 받은 채 남지 않게, 못 받은 상태일 때만 API 복귀 알림(shared/api-health.js onRecover)에 한 번 다시 받는다 — 기능마다 타이머를 두지 않는다.
     한 번은 «실패 한 묶음에 한 번» 이다 — 복귀로 다시 받다 또 실패하면 다음 복귀엔 다시 받지 않고, [다시 시도] · 조용한 받기(load) · reset 의 실패 뒤에만 다시 연다
     (그 endpoint 만 계속 실패하는데 다른 요청이 성공해 복귀가 이어지면 끝없이 돌기 때문).
   [모양] createLoadState({ fetch, onValue?, onChange?, health?, notifyOnce?, notifyRetry?, note? }) →
     state() — 'idle' | 'loading' | 'ready' | 'failed' · value() — ready 가 아니면 null(기본값을 돌려주지 않는다)
     load(why?) — 받는다(why 는 진단 글자 — 'start' · 'quiet' 등). 받는 중에 또 부르면 같은 약속. → Promise<'ready' | 'failed' | 'skipped'>
     retry() — 사용자가 누른 [다시 시도]. ready · loading 이면 아무것도 안 한다. 실패하면 notifyRetry(err)
     refresh() — 받은 뒤 같은 값을 한 번 더(하루가 바뀐 때 등). ready 일 때만 · 겹치면 하나 · 실패하면 failed · 번호 없음(그 뒤는 복귀 알림이 다시 받는다)
     reset() — 세션이 끝날 때. 늦게 온 답은 아무것도 바꾸지 못한다(gen) · idle · 값 null · 첫 실패 알림 표시를 비운다
   알림: notifyOnce(err) — reset 뒤 처음 실패 한 번(켤 때 받기 실패 등). 그 뒤 실패(조용한 다시 받기 · 복귀 다시 받기)는 진단만 — 사용자 [다시 시도] 만 notifyRetry.
   진단(note — 부르는 쪽이 머리를 붙인다): 받기 시작(why) · 받음(why) · 못 받음(why) code= name= · 복귀로 다시 받음 · 새로 받음 · 새로 못 받음. 오류 글 · 값은 적지 않는다.
   ★ 복귀 구독은 처음 load 때 건다(만들 때는 요청 · 구독 · 타이머 0). health 가 없으면 복귀 다시 받기도 없다.
   ★ DOM · 타이머 없음. 지금 쓰는 곳은 포커스 진척(focus/focus-progress.js) 하나 — 다른 서버 값은 뒤 PR 에서 옮긴다.
   classic script(window.TwLoadState) — 쓰는 모듈 · app.js 보다 먼저 싣는다. */
(function(){
'use strict';

const ERR_CODE = /^[A-Z0-9_]{1,40}$/, ERR_NAME = /^[A-Za-z]{1,40}$/;
/* 진단에 적는 오류 모양 — 서버 code(대문자 모양) · 오류 이름만 */
function errTag(e){
  const c = e && typeof e.code === 'string' && ERR_CODE.test(e.code) ? e.code : '-';
  const n = e && typeof e.name === 'string' && ERR_NAME.test(e.name) ? e.name : '-';
  return 'code=' + c + ' name=' + n;
}

/** @param {{
 *   fetch: () => Promise<any>,                                  // 값 하나 받기 — 못 받으면 던진다
 *   onValue?: (v: any, kind: 'load'|'refresh') => void,        // 받은 값(ready 가 된 뒤에 부른다)
 *   onChange?: () => void,                                      // 상태가 바뀔 때
 *   health?: { onRecover: (fn: () => void) => unknown },        // API 복귀 알림(shared/api-health.js)
 *   notifyOnce?: (err: any) => unknown,                         // reset 뒤 처음 실패 한 번
 *   notifyRetry?: (err: any) => unknown,                        // 사용자 [다시 시도] 실패
 *   note?: (line: string) => unknown,                           // 진단 한 줄
 * }} deps */
function createLoadState(deps){
  const fetchFn = deps.fetch;
  const onValue = deps.onValue || (() => {});
  const onChange = deps.onChange || (() => {});
  const health = deps.health || null;
  const notifyOnce = deps.notifyOnce || (() => {});
  const notifyRetry = deps.notifyRetry || (() => {});
  const note = deps.note || (() => {});

  let st = 'idle', val = null, gen = 0, run = null, refreshing = null;
  let notified = false, bound = false;
  let recoverArmed = false;   // 복귀 다시 받기를 아직 안 썼다 — 실패 한 묶음에 한 번(복귀로 다시 받다 실패하면 [다시 시도] · 조용한 받기 · reset 뒤에만 다시 연다)

  function say(line){ try{ note(line); }catch(_){} }
  function changed(){ try{ onChange(); }catch(e){ console.warn('[load-state] 알림 실패', e); } }
  function failedOnce(e, why){
    if(why === 'user') notifyRetry(e);
    else if(!notified){ notified = true; notifyOnce(e); }
  }
  function recovered(){
    if(st !== 'failed' || !recoverArmed) return;   // 받는 중 · 받음 · 받기 전 · 이 실패 묶음에서 이미 한 번 썼으면 아무것도 안 한다
    recoverArmed = false;
    say('복귀로 다시 받음');
    load('recover');
  }

  function load(why){
    if(run) return run;
    if(!bound && health){ bound = true; health.onRecover(recovered); }
    const g = gen, w = why || 'quiet';
    st = 'loading';
    say('받기 시작(' + w + ')');
    changed();
    run = (async () => {
      try{
        const v = await fetchFn();
        if(g !== gen) return 'skipped';
        val = v; st = 'ready';
        say('받음(' + w + ')');
        try{ onValue(v, 'load'); }catch(e){ console.warn('[load-state] 값 받기 실패', e); }
        return 'ready';
      }catch(e){
        if(g !== gen) return 'skipped';
        st = 'failed';
        if(w !== 'recover') recoverArmed = true;   // 복귀로 다시 받다 실패한 것이면 다음 복귀엔 다시 받지 않는다(끝없이 돌지 않게)
        say('못 받음(' + w + ') ' + errTag(e));
        failedOnce(e, w);
        return 'failed';
      }finally{
        if(g === gen){ run = null; changed(); }
      }
    })();
    return run;
  }
  function retry(){
    if(st === 'ready' || st === 'loading') return Promise.resolve(st);
    return load('user');
  }
  function refresh(){
    if(st !== 'ready' || run) return refreshing || Promise.resolve();
    if(refreshing) return refreshing;
    const g = gen;
    refreshing = (async () => {
      try{
        const v = await fetchFn();
        if(g !== gen) return;
        val = v;
        say('새로 받음');
        try{ onValue(v, 'refresh'); }catch(e){ console.warn('[load-state] 값 받기 실패', e); }
      }catch(e){
        if(g !== gen) return;
        st = 'failed'; recoverArmed = true;
        say('새로 못 받음 ' + errTag(e));   // 번호는 안 띄운다 — 받은 뒤의 «한 번 더» 는 사용자가 한 일이 아니다(포커스 설계 7절) · 복귀 때 다시 받는다
      }finally{
        if(g === gen){ refreshing = null; changed(); }
      }
    })();
    return refreshing;
  }
  function reset(){
    gen++;
    st = 'idle'; val = null; run = null; refreshing = null; notified = false; recoverArmed = false;
  }

  return { state: () => st, value: () => (st === 'ready' ? val : null), load, retry, refresh, reset };
}

const api = { createLoadState, errTag };
if(typeof window !== 'undefined') window.TwLoadState = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
