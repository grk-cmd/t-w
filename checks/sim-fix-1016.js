/* sim-fix-1016.js — 🐞 버그 제보 묶음(2026-10-16 접수분 · 난이도 «하») 검사
   실행:  node sim-fix-1016.js   (저장소 루트에서 · 러너는 app/ 을 펼친 자리에서)
   제보마다 절 하나 — «고친 자리가 그대로 있는가» 와, 할 수 있는 건 «옛 모양이면 증상이 나고 새 모양이면 안 나는가» 를 흉내로 본다.
   (§1 도트 렌더 색은 main 이 먼저 같은 방식으로 고쳐 그쪽 검사가 지킨다 — 이 파일에서 뺐다)   §2 알림콩 — 새 글 없이 뜨고 안 꺼짐   §6 좌석 메뉴 + T — 가챠 창이 저장 · 닫힘
   §10 상태 이모지가 동물 뒤로   §11 캐릭터 편집 위로 마이홈 패널   §12 날기 — 꾸미기 착용 시 보이지 않는 천장 */
'use strict';
const fs = require('fs');
const say = console.log;
let pass = 0, fail = 0;
const chk = (ok, msg) => { ok ? pass++ : fail++; say((ok ? '  ✓ ' : '  ✗ ') + msg); };
const read = (...cands) => { for (const c of cands) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const need = (rel) => { const s = read('app/' + rel, rel, rel.replace(/^parts\/[^/]+\//, 'parts/'), rel.split('/').pop()); if (s == null) { say('  ? 원본 못 찾음 — ' + rel); process.exit(2); } return s; };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

const CHAT = need('parts/chat/chat-ui.js');
const APP = need('parts/app.js');
const STATUS = need('parts/status/status-chip.js');
const TRICKS = need('parts/room/tricks.js');
const MEASURE = need('parts/character/char-measure.js');
const BODY = need('parts/character/body-measure.js');   // 몸 박스 재기 한 규칙 — measureCharBox 가 deps 로 받는다
const SEATMENU = need('parts/room/seat-menu.js');   // 좌석 우클릭 메뉴(구역 떼기 w4 로 app.js 에서 옮김 — 판정 무변경)
const HTML = need('desk-companion-prototype.html');
const THREE_SRC = read('app/vendor/three/three.min.js', 'vendor/three/three.min.js', 'three.min.js');
let THREE = null;
if (THREE_SRC) { const m = { exports: {} }; new Function('module', 'exports', THREE_SRC)(m, m.exports); THREE = m.exports; }

say('§2 알림콩 — 읽음 표시는 서버 시각 순서(ts → id)로');
{
  const grab = (re) => { const m = CHAT.match(re); return m ? m[0] : ''; };
  const src = [
    grab(/function _chatMsgKey\(m\)\{[\s\S]*?\n\}/),
    grab(/const CHAT_MARK_RE = [^\n]+/),
    grab(/function _chatMsgTs\(m\)[^\n]+/),
    grab(/function _chatMarkOf\(m\)[^\n]+/),
    grab(/function _chatIsAfter\(m, mark\)\{[\s\S]*?\n\}/),
    grab(/function _chatLastOf\(list\)\{[\s\S]*?\n\}/),
  ];
  chk(src.every(Boolean), '읽음 표시 도우미 여섯을 찾았다(_chatMsgKey · CHAT_MARK_RE · _chatMsgTs · _chatMarkOf · _chatIsAfter · _chatLastOf)');
  const F = new Function(src.join('\n') + '\nreturn { _chatMsgKey, _chatMarkOf, _chatIsAfter, _chatLastOf };')();
  // 서버 시각(ts) 순 목록 — B 의 PC 시계가 앞서 있어 B 의 옛 메시지 id 가 뒤 메시지들보다 크다.
  const list = [
    { id: '-N0000A1', ts: 1000 }, { id: '-N9999B1', ts: 2000 }, { id: '-N0000A2', ts: 3000 }, { id: '-N0000A3', ts: 4000 },
  ];
  const lastOld = list[list.length - 1];
  const oldMark = F._chatMsgKey(lastOld);
  const oldUnread = list.filter((m) => F._chatMsgKey(m) > oldMark).length;
  chk(oldUnread === 1, '흉내: 고치기 전(마지막 id 저장 · id 비교) — 다 읽고 닫아도 시계 앞선 사람의 옛 글 1개가 영영 안 읽음(알림콩)');
  const mark = F._chatMarkOf(F._chatLastOf(list));
  chk(/^T4000:/.test(mark), '★ 새 표시는 «T<ts>:<id>» — 목록의 가장 나중(ts) 메시지');
  chk(list.filter((m) => F._chatIsAfter(m, mark)).length === 0, '★ 다 읽은 뒤 안 읽은 수 0 — 알림콩이 꺼진다');
  const more = list.concat([{ id: '-N0000A4', ts: 5000 }]);
  chk(more.filter((m) => F._chatIsAfter(m, mark)).length === 1, '  ↳ 진짜 새 글 1개는 센다(시계가 뒤처진 id 라도)');
  const skewAhead = [{ id: '-Nzzzz', ts: 4500 }, { id: '-N0001', ts: 6000 }];
  const m2 = F._chatMarkOf(skewAhead[0]);
  chk(F._chatIsAfter(skewAhead[1], m2), '  ↳ 시계 앞선 사람 글을 읽은 뒤 온 새 글도 센다(«가장 큰 id» 방식이면 놓친다)');
  chk(F._chatIsAfter({ id: '-N5', ts: 4000 }, 'T4000:-N4') && !F._chatIsAfter({ id: '-N3', ts: 4000 }, 'T4000:-N4'), '  ↳ 같은 ts 면 id 로 가른다(chat-history.js chatOrder 와 같은 규칙)');
  chk(F._chatIsAfter({ id: '-N2' }, '-N1') && !F._chatIsAfter({ id: '-N0' }, '-N1'), '옛 표시(id 만)는 예전 규칙으로 비교한다');
  chk(F._chatLastOf([{ id: '-Nb', ts: 30 }, { id: '-Na', ts: 50 }, { id: '-Nc', ts: 10 }]).id === '-Na', '_chatLastOf 는 목록 순서가 어긋나 와도 가장 나중 ts 를 고른다');
  const C = strip(CHAT);
  const mr = (C.match(/function _markChatRead\(\)\{[\s\S]*?\n\}/) || [''])[0];
  chk(/_chatLastOf\(_chatLogCache\(\)\)/.test(mr) && /!CHAT_MARK_RE\.test\(old\)/.test(mr) && /_chatIsAfter\(last, old\)/.test(mr), '_markChatRead — 가장 나중 메시지로 · 옛 형식은 덮고 · 새 형식은 뒤로 물리지 않는다');
  chk(!/_chatMsgKey\(m\) > marker/.test(C) && /_chatIsAfter\(m, marker\)/.test(C), '알림콩 구독(창 닫힘)이 새 비교로 센다');
  chk(/_chatIsAfter\(m, mark\)\)\.length/.test(C), '다른 탭 안 읽음도 새 비교로 센다');
  chk(/_chatIsAfter\(m, _chatReadMarker\)/.test(C), '읽음 구분선도 같은 비교');
  chk(/_chatMinSinceKey = last \? _chatMarkOf\(last\) : null/.test(C) && /_chatIsAfter\(m, _chatMinSinceKey\)/.test(C), '접은 대화창의 알림콩도 같은 비교');
}

say('§6 좌석 우클릭 메뉴가 열린 채 단축키 — 메뉴(투명 뒷판)부터 닫는다');
{
  const fn = (strip(SEATMENU).match(/function _seatCtxMenu\(ev, seat\)\{[\s\S]*?\n\}/) || [''])[0];
  const h = (fn.match(/onEsc = e=>\{[\s\S]*?\n  \};/) || [''])[0];
  chk(!!h, 'onEsc 처리기를 찾았다');
  const run = (key) => { let closed = 0, stopped = 0; const close = () => closed++; const f = new Function('close', 'return ' + h.replace(/^onEsc = /, '').replace(/;$/, ''))(close); f({ key, stopPropagation: () => stopped++ }); return { closed, stopped }; };
  const t = run('t'), esc = run('Escape'), sh = run('Shift'), ctl = run('Control'), f2 = run('F2');
  chk(t.closed === 1 && t.stopped === 0, '★ T — 메뉴를 닫고 키는 흘려보낸다(가챠 창이 뒷판 밑에 깔리지 않는다)');
  chk(f2.closed === 1 && f2.stopped === 0, '  ↳ F2 등 다른 단축키도 같다');
  chk(esc.closed === 1 && esc.stopped === 1, 'Esc — 닫고 삼킨다(예전과 같다)');
  chk(sh.closed === 0 && ctl.closed === 0, '조합 키(Shift · Ctrl)만 눌렀을 땐 닫지 않는다');
  chk(/backdrop\.style\.cssText = 'position:fixed;inset:0;z-index:9998;/.test(fn), '  ↳ 뒷판(9998)은 그대로 — 바깥 클릭으로 닫는 장치');
}

say('§10 상태 이모지(책상 위) — 동물 몸에 가리지 않는다');
{
  const fn = (strip(STATUS).match(/function ensureSeatDeskEmoji\(seat\)\{[\s\S]*?\n\}/) || [''])[0];
  chk(/new THREE\.SpriteMaterial\(\{[^}]*depthTest:false/.test(fn), '★ 이모지 스프라이트 depthTest:false');
  chk(/sp\.renderOrder=850/.test(fn), '  ↳ renderOrder 850 그대로 — 몸보다 나중에 그린다');
}

say('§11 캐릭터 편집 위로 마이홈 패널이 비침');
{
  const css = HTML.match(/<style[\s\S]*?<\/style>/g) || [];
  const all = css.join('\n');
  chk(/body:has\(#creatorOverlay\.on\) #myHomeOverlay, body:has\(#creatorOverlay\.on\) #mhGbOverlay\{visibility:hidden;\}/.test(all), '★ 편집창이 켜진 동안 마이홈 · 방명록 창을 숨긴다(CSS :has)');
  const zOf = (sel) => { const m = all.match(new RegExp(sel.replace('#', '#') + '\\{[^}]*z-index:(\\d+)')); return m ? Number(m[1]) : null; };
  chk(zOf('#creatorOverlay') === 55 && zOf('#codeOverlay') === 56, '  ↳ 편집창(55) 자리는 그대로 — 편집 중 여는 코드 창(56)이 위에 남는다');
  chk(zOf('#myHomeOverlay') > 55 && zOf('#mhGbOverlay') > 55, '  ↳ 숨기는 두 창은 편집창보다 위층이라 숨겨야 한다(옮기면 이 검사를 다시 본다)');
}

say('§12 날기 — 기준점 높이는 몸만 잰다');
{
  const T = strip(TRICKS);
  const fn = (T.match(/function _flyProbeY\(seat\)\{[\s\S]*?\n\}/) || [''])[0];
  chk(/measureCharBox\(seat\.gltfRoot\)/.test(fn) && /measureBodyBox\(seat\.rig, null, _flyBox\)/.test(fn), '★ 몸(gltfRoot)을 measureCharBox 로 · 비면 예전처럼 rig 째(measureBodyBox 옵션 없음 — 몸 재기는 body-measure.js 한 곳)');
  chk(/const measureCharBox = deps\.measureCharBox;/.test(T) && /measureCharBox: \(\.\.\.a\)=>charMeasureMod\.measureCharBox\(\.\.\.a\),/.test((APP.match(/const tricksMod = TwTricks\.createTricks\(\{[\s\S]*?\n\}\);/) || [''])[0]), '  ↳ app.js 가 tricks 에 measureCharBox(char-measure.js)를 넘긴다');
  if (!THREE) { say('  · three.min.js 가 없어 흉내는 건너뜀'); }
  else {
    /* 진짜 body-measure.js · char-measure.js 를 같은 three 위에서 만든다 — measureCharBox 도 measureBodyBox 를 거친다 */
    const bmWin = {}; new Function('window', 'module', 'THREE', BODY)(bmWin, undefined, THREE);
    const bm = bmWin.TwBodyMeasure.createBodyMeasure({});
    const cmWin = {}; new Function('window', 'module', 'THREE', 'console', MEASURE)(cmWin, undefined, THREE, { warn(){}, log(){} });
    const measureCharBox = cmWin.TwCharMeasure.createCharMeasure({ measureBodyBox: (...a)=>bm.measureBodyBox(...a) }).measureCharBox;
    const _flyBox = new THREE.Box3(), _flyW = new THREE.Vector3();
    const probe = new Function('THREE', '_flyBox', '_flyW', 'measureCharBox', 'measureBodyBox', 'seatScale', 'ANIMAL_RUN_SCALE', 'FLY_PROBE_FALLBACK', fn + '\nreturn _flyProbeY;')(THREE, _flyBox, _flyW, measureCharBox, bm.measureBodyBox, () => 1, 0.6, 0.35);
    const mkSeat = (withItem) => {
      const rig = new THREE.Group();
      const body = new THREE.Group(); rig.add(body);
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.45, 0.3)); torso.position.y = 0.725; body.add(torso);
      if (withItem) {
        const wrap = new THREE.Group(); wrap.name = '__partWrap_halo'; body.add(wrap);
        const tall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, 0.2)); tall.position.y = 3.5; wrap.add(tall);
      }
      return { rig, gltfRoot: body, charDef: {} };
    };
    const plain = probe(mkSeat(false)), item = probe(mkSeat(true));
    chk(Math.abs(plain - 0.725) < 0.01, '흉내: 아이템 없음 — 기준점 = 몸 가운데(0.725)');
    chk(Math.abs(item - plain) < 0.01, '★ 키 큰 아이템을 써도 기준점이 몸 가운데 그대로 — 화면 가운데에서 천장에 막히지 않는다');
    const rigWhole = (() => { const s = mkSeat(true); s.rig.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(s.rig); return (b.min.y + b.max.y) / 2; })();
    chk(rigWhole > 2, '  ↳ 고치기 전(rig 째)이면 기준점이 ' + rigWhole.toFixed(2) + ' — 몸 위로 한참 떠서 천장에 일찍 닿았다');
    const empty = { rig: new THREE.Group(), gltfRoot: new THREE.Group(), charDef: {} };
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)); m.position.y = 0.5; empty.rig.add(m);
    chk(Math.abs(probe(empty) - 0.5) < 0.01, '몸 상자가 비면 rig 째로 잰다(예전 동작)');
  }
}

say(`\n${pass} · ${fail}`);
say(fail ? `실패 ${fail}건` : `전부 통과 (${pass})`);
process.exit(fail ? 1 : 0);
