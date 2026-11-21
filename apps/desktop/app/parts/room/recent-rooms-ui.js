/* recent-rooms-ui.js — 🕘 로비 코드 칸을 누르면 위로 펼쳐지는 «최근 들어간 방» 목록(최대 3개).
   칸이 비어 있을 때만 보이고, 글자를 치면 접힌다(코드를 직접 넣는 길을 가리지 않게). 줄을 누르면 그 방으로 바로 들어간다.
   시크릿룸 줄은 코드가 «SCRT-****» 다(recent-rooms.js 가 진짜 코드를 저장하지 않는다) — 누르면 코드 4자리를 물어 그 코드로 들어간다(맞는지는 서버가 가른다).
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
 *   joinRoom: (code: string) => void,
 *   secretMask: string,
 *   secretCodeFrom: (typed: unknown) => string|null,
 *   askCode: (o: { title: string, message: string, placeholder: string, maxLength: number, validate: (v: string) => string|null }) => Promise<string|null>,
 * }} deps
 */
function createRecentRoomsUi(deps){
  const doc = deps.document;
  const recent = deps.recent;
  const agoText = deps.agoText;
  const now = deps.now;
  const joinRoom = deps.joinRoom;
  const secretMask = deps.secretMask;         // 시크릿룸 줄의 코드(recent-rooms.js SECRET_MASK)
  const secretCodeFrom = deps.secretCodeFrom; // 친 글 → SCRT-XXXX | null(같은 파일 — 방 코드 모양은 room-entry isRoomCode)
  const askCode = deps.askCode;               // 인앱 입력 창(shared/async-prompt.js)

  const ASK = Object.freeze({ title: '🔒 시크릿룸 입장', message: '이 시크릿룸의 코드 4자리를 입력해 주세요', placeholder: '코드 4자리', bad: '코드 4자리를 입력해 주세요' });
  /* 시크릿룸 줄 — 코드를 물어 그 코드로 들어간다. 취소하면 아무 일도 없다 */
  function joinSecret(){
    return Promise.resolve(askCode({ title: ASK.title, message: ASK.message, placeholder: ASK.placeholder, maxLength: 9,
      validate: (v) => (secretCodeFrom(v) ? null : ASK.bad) })).then((v) => {
      const code = (v == null) ? null : secretCodeFrom(v);
      if(code) joinRoom(code);
    });
  }

  const input = doc.getElementById('inviteCode');
  const box = doc.getElementById('lobbyRecent');

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
      b.addEventListener('click', () => { hide(); if(r.code === secretMask) joinSecret(); else joinRoom(r.code); });
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
