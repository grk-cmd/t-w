/* sim-seat-pin.js — 🪑 방에서 내 자리 «맨 오른쪽 고정» (seat-pin.js · app.js 배선 · html)
   실행:  node sim-seat-pin.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — 되돌린 #58 의 «맨 오른쪽 고정» 만 다시 넣었다. 고정이 새면 친구 책상을 끌어 내 오른쪽으로 보낼 수 있고,
     반대로 «줄 안에 함께»(기본)까지 고정되면 예전처럼 자리를 못 바꾼다. 혼자일 때는 어느 쪽이든 예전 그대로여야 한다.
   ・1절: 판정 — 저장값 · 고정이 걸리는 조건(방에 다른 사람) · 0번으로 옮기기 · 끌기 자리
   ・2절: 배선 — layoutSeats 첫머리 · 책상 끌기 · 버튼 · html 순서 · 카메라는 안 건드림 */
'use strict';
const { joinRenderer: _joinRenderer } = require('./sim-renderer-src.js');   // 앱 FSD 로 옮긴 모듈을 «옮기기 전 app.js 글» 로 되살려 읽는다
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('seat-pin.js'), APP = _joinRenderer(read('app.js')), HTML = read('desk-companion-prototype.html');
if (!MOD || !APP || !HTML) { say('  ? 원본 못 찾음 — seat-pin.js · app.js · desk-companion-prototype.html'); process.exit(2); }

say('── 1. 판정');
const win = {};
new Function('window', 'module', MOD)(win, undefined);
const P = win.TwSeatPin;
chk(!!P && P.MODE_KEY === 'tw.roomSeatMode', '싣기만 하면 window.TwSeatPin · 저장 키 tw.roomSeatMode(#58 과 같은 키)');
const ls = (v) => ({ getItem: () => v, setItem: (k, x) => { ls.last = [k, x]; } });
chk(P.loadMode(ls(null)) === 'row' && P.loadMode(ls('right')) === 'right' && P.loadMode(ls('???')) === 'row', '기본은 «줄 안에 함께» · 이상한 값도 기본');
chk(P.loadMode({ getItem: () => { throw new Error('x'); } }) === 'row', 'localStorage 가 던져도 기본');
P.saveMode(ls(null), 'right'); chk(ls.last && ls.last[1] === 'right', '저장');
chk(P.label('right') === '맨 오른쪽 고정' && P.label('row') === '줄 안에 함께' && P.next('row') === 'right' && P.next('right') === 'row', '버튼 글 · 번갈아 바꾸기');
const me = { isMe: true }, a = { remote: true, n: 'a' }, b = { remote: true, n: 'b' }, ex = { isExtra: true };
chk(!P.pinned('right', [me, ex]) && !P.pinned('row', [a, me]), '★ 혼자(자리 추가만) · «줄 안에 함께» 면 고정 안 걸림 — 예전 그대로');
let seats = [a, me, b];
chk(P.pinFirst(seats, 'right') === true && seats[0] === me && seats[1] === a && seats[2] === b, '★ 고정하면 나를 0번(맨 오른쪽)으로 · 나머지 순서는 그대로');
chk(P.pinFirst(seats, 'right') === false, '  이미 0번이면 그대로(좌석 탭을 다시 그리지 않음)');
seats = [a, me, b];
chk(P.pinFirst(seats, 'row') === false && seats[0] === a, '«줄 안에 함께» 면 옮기지 않음');
seats = [me, a, b];
chk(P.dragIndex(0, a, seats, 'right') === 1, '★ 남의 책상은 0번(내 자리)에 못 들어간다 — 1번으로');
chk(P.dragIndex(2, a, seats, 'right') === 2, '  그 밖의 자리는 그대로');
chk(P.dragIndex(2, me, seats, 'right') === 0, '★ 내 책상은 끌어도 제자리');
chk(P.dragIndex(0, a, seats, 'row') === 0 && P.dragIndex(2, me, seats, 'row') === 2, '«줄 안에 함께» 면 누구든 어디로든(예전 그대로)');

say('── 2. 배선');
const layout = (APP.match(/function layoutSeatRow\(\)\{[\s\S]*?const placed = /) || APP.match(/function layoutSeats\(\)\{[\s\S]*?const placed = /) || [''])[0];   // 본문은 seat-layout.js 의 layoutSeatRow(app.js 의 layoutSeats 는 부르기만)
chk(/TwSeatPin\.pinFirst\(seats, roomSeatMode\)/.test(layout) && /renderSeatTabs\(\)/.test(layout), 'layoutSeats 가 자리를 계산하기 전에 고정을 건다 · 옮겼으면 좌석 탭도');
chk(/idx = TwSeatPin\.dragIndex\(idx, drag\.seat, seats, roomSeatMode\)/.test(APP), '책상 끌기 자리가 고정을 지난다');
chk(/let roomSeatMode = window\.TwSeatPin \? TwSeatPin\.loadMode\(localStorage\) : 'row';/.test(APP), '부팅 때 저장값 읽기 · 모듈이 없으면 예전 그대로');
chk(/rsBtn\.onclick=\(\)=>\{\s*roomSeatMode = TwSeatPin\.next\(roomSeatMode\);\s*TwSeatPin\.saveMode\(localStorage, roomSeatMode\);\s*refreshToggleBtns\(\);\s*layoutSeats\(\);/.test(APP), '버튼 — 바꾸고 · 저장하고 · 글 바꾸고 · 다시 배치');
chk(/id="fsRoomSeatModeToggle"/.test(HTML) && /방에서 내 자리/.test(HTML), '설정 › 캐릭터 «방에서 내 자리» 버튼');
const iMod = HTML.indexOf('parts/room/seat-pin.js'), iApp = HTML.indexOf('parts/app.js"');
chk(iMod > 0 && iApp > iMod, 'seat-pin.js 를 app.js 보다 먼저 싣는다');
chk(!/roomSeatMode/.test((APP.match(/function applyCameraAndCanvas\([\s\S]*?\n\}/) || [''])[0]), '카메라 · 크기는 안 건드린다(되돌린 #58 의 자동 맞춤 · 휠 없음)');

say('\n' + (fail ? '✗ 통과 ' + pass + ' · 실패 ' + fail : '전부 통과 ✅ ' + pass + ' — 고르면 나는 늘 맨 오른쪽, 기본은 예전 그대로'));
process.exit(fail ? 1 : 0);
