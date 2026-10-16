/* demoji-catalog.js — 😊 기본 이모티콘 목록(앱 번들 app/emoji/default/ — 모든 유저 공용 · Firebase 안 씀) (검사 sim-demoji-catalog.js)
   기록 · 전송에는 [demoji:id] 표시만 실리고, 받는 쪽마다 이 목록에서 그림을 찾는다(아는 id 만 그린다 — 안전).
   채팅(chat-ui.js) · 머리 위 말풍선 · 마이홈 바탕화면이 같이 읽는 고정 표라 맨 아래 이 파일에 둔다.
   채팅 모듈에 두면 마이홈 바탕화면이 채팅을 바라보게 되고, 채팅 쪽에서 마이홈까지 이어지는 길이 있어 순환이 된다(checks/sim-dep-cycles.js).
   읽는 파일보다 먼저 싣는 classic script — window.TwDemojiCatalog = { DIR · LIST · BY_ID · BY_CMD }. */
(function(){
const DIR = 'emoji/default/';
const LIST = Object.freeze([
  {id:'d01',cmd:'...',file:'d01.png',w:19,h:19},
  {id:'d02',cmd:'ㄱ-',file:'d02.gif',w:48,h:48},
  {id:'d03',cmd:'ㅃ',file:'d03.gif',w:38,h:38},
  {id:'d04',cmd:'ㅉ',file:'d04.gif',w:50,h:50},
  {id:'d05',cmd:'ㅌㅆ',file:'d05.webp',w:50,h:50},
  {id:'d06',cmd:'개죽',file:'d06.png',w:50,h:50},
  {id:'d07',cmd:'놉',file:'d07.webp',w:40,h:40},
  {id:'d08',cmd:'뇨롱',file:'d08.png',w:50,h:50},
  {id:'d09',cmd:'담',file:'d09.gif',w:29,h:23},
  {id:'d10',cmd:'땅',file:'d10.webp',w:46,h:38},
  {id:'d11',cmd:'망',file:'d11.gif',w:50,h:50},
  {id:'d12',cmd:'뭐임',file:'d12.gif',w:50,h:50},
  {id:'d13',cmd:'부비',file:'d13.gif',w:50,h:43},
  {id:'d14',cmd:'붂',file:'d14.gif',w:50,h:50},
  {id:'d15',cmd:'분노',file:'d15.png',w:50,h:50},
  {id:'d16',cmd:'불',file:'d16.gif',w:50,h:49},
  {id:'d17',cmd:'뽀',file:'d17.gif',w:50,h:50},
  {id:'d18',cmd:'썩소',file:'d18.gif',w:50,h:50},
  {id:'d19',cmd:'애환',file:'d19.gif',w:50,h:50},
  {id:'d20',cmd:'오덕',file:'d20.gif',w:50,h:50},
  {id:'d21',cmd:'우삼',file:'d21.gif',w:50,h:50},
  {id:'d22',cmd:'절',file:'d22.gif',w:50,h:50},
  {id:'d23',cmd:'제길',file:'d23.gif',w:50,h:50},
  {id:'d24',cmd:'감탄',file:'d24.png',w:19,h:19},
  {id:'d25',cmd:'춤',file:'d25.webp',w:100,h:56},
  {id:'d26',cmd:'컥',file:'d26.gif',w:50,h:50},
  {id:'d27',cmd:'큐',file:'d27.png',w:19,h:19},
  {id:'d28',cmd:'키라',file:'d28.gif',w:50,h:50},
  {id:'d29',cmd:'피식',file:'d29.png',w:19,h:19},
  {id:'d30',cmd:'핳',file:'d30.png',w:19,h:19},
  {id:'d31',cmd:'흠',file:'d31.png',w:19,h:19},
  {id:'d32',cmd:'팸',file:'d32.gif',w:50,h:50},
  {id:'d33',cmd:'헉',file:'d33.png',w:50,h:50}
].map(d => Object.freeze(d)));
const BY_ID = {}, BY_CMD = {};
LIST.forEach(d => { BY_ID[d.id] = d; BY_CMD[d.cmd] = d; });

const api = Object.freeze({ DIR, LIST, BY_ID: Object.freeze(BY_ID), BY_CMD: Object.freeze(BY_CMD) });
if(typeof window !== 'undefined') window.TwDemojiCatalog = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
