/* open-on-show.js — 🪟 창이 보이면 그 창의 기능을 시작해 달라고 부탁한다 (검사 sim-open-on-show.js)
   [왜] 플레이리스트는 켤 때 받지 않고 그 창을 처음 열 때 받는다(app-boot OPEN 칸). 여는 길이 여럿이라(버튼 · 단축키 · 다른 창에서 넘어옴)
     부르는 자리를 늘리지 않고, 창의 class · style 이 바뀔 때 «보이나» 를 보고 open(이름) 을 부른다. 두 번째부터는 app-boot 가 무시한다.
   deps: open(name) — app-boot open · MutationObserver(없으면 window 것) · targets [{ name, el, shown(el) }]
   내놓는 것: start() — 지켜보기를 건다(이미 보이면 바로 부른다). 만들 때는 아무것도 하지 않는다.
   classic script(window.TwOpenOnShow) — app.js 보다 먼저 싣고, app.js 가 app-boot 를 만든 뒤 만든다. */
(function(){
'use strict';

/** @param {{ open: (name: string) => void, MutationObserver?: Function, targets: Array<{ name: string, el: Element, shown: (el: Element) => boolean }> }} deps */
function createOpenOnShow(deps){
  const open = deps.open;
  const targets = deps.targets;
  const MO = deps.MutationObserver || window.MutationObserver;
  for(const t of targets){
    if(!t || !t.el) throw new Error('[open-on-show] 지켜볼 창이 없어요: ' + (t && t.name));
  }
  function check(t){ if(t.shown(t.el)) open(t.name); }
  function start(){
    for(const t of targets){
      new MO(() => check(t)).observe(t.el, { attributes: true, attributeFilter: ['class', 'style'] });
      check(t);
    }
  }
  return { start };
}

const api = { createOpenOnShow };
if(typeof window !== 'undefined') window.TwOpenOnShow = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
