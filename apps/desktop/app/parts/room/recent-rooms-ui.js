/* recent-rooms-ui.js — 🕘 로비 코드 칸을 누르면 위로 펼쳐지는 «최근 들어간 방» 목록(최대 3개).
   칸이 비어 있을 때만 보이고, 글자를 치면 접힌다(코드를 직접 넣는 길을 가리지 않게). 줄을 누르면 그 방으로 바로 들어간다.
   글은 textContent 로만 넣는다 — 방 제목은 남이 정한 값이다.
   classic script(window.TwRecentRoomsUi) — app.js 가 방 입장 모듈 뒤에서 createRecentRoomsUi(deps) · 밖에서 부르는 이름 없음.
   검사: checks/sim-recent-rooms.js */
(function(){

/**
 * @param {{
 *   document: Document,
 *   recent: { list(): { code: string, title: string, at: number }[] },
 *   agoText: (ms: number) => string,
 *   now: () => number,
 *   joinRoom: (code: string) => Promise<void>,
 * }} deps
 */
function createRecentRoomsUi(deps){
  const doc = deps.document;
  const recent = deps.recent;
  const agoText = deps.agoText;
  const now = deps.now;
  const joinRoom = deps.joinRoom;

  const input = doc.getElementById('inviteCode');
  const box = doc.getElementById('lobbyRecent');

  let joining = false;   // 연결을 기다리는 사이 다른 줄을 또 눌러 입장이 겹치지 않게(로비 카드와 같은 막기)

  function hide(){ box.hidden = true; }

  function show(){
    const rows = input.value.trim() ? [] : recent.list();
    box.textContent = '';
    if(!rows.length){ hide(); return; }
    const head = doc.createElement('div');
    head.className = 'lb-recent-head';
    head.textContent = '최근 들어간 방';
    box.appendChild(head);
    const t = now();
    for(const r of rows){
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'lb-recent-row';
      const code = doc.createElement('b'); code.className = 'lb-recent-code'; code.textContent = r.code;
      const title = doc.createElement('span'); title.className = 'lb-recent-title'; title.textContent = r.title;
      const ago = doc.createElement('span'); ago.className = 'lb-recent-ago'; ago.textContent = agoText(t - r.at);
      b.appendChild(code); b.appendChild(title); b.appendChild(ago);
      b.title = r.code + (r.title ? ' · ' + r.title : '');
      // 누르는 동안 칸이 포커스를 잃어 목록이 먼저 닫히지 않게
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', async () => {
        hide();
        if(joining) return;
        joining = true;
        try{ await joinRoom(r.code); }finally{ joining = false; }
      });
      box.appendChild(b);
    }
    box.hidden = false;
  }

  input.addEventListener('focus', show);
  input.addEventListener('click', show);
  input.addEventListener('input', show);
  input.addEventListener('blur', hide);
  input.addEventListener('keydown', (e) => { if(e.key === 'Escape' && !box.hidden){ e.stopPropagation(); hide(); } });

  return { show, hide };
}

window.TwRecentRoomsUi = { createRecentRoomsUi };

})();
