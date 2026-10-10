/* ═══ ⌨️ sim-key-input.js — 글자 단축키 · 한글 조합 Enter (개정 83 신설) ═══════════════════════════
   🍎 2026-10-04 Mac 제보: 한글 상태에서 T(파츠 보관함)가 안 열림 · 채팅 끝 글자가 한 번 더 나감.
   ・1절: hotkeyLetter — 영문 글자는 그대로, 한글('ㅅ')·Process 는 물리 키(KeyT)로
   ・2절: 조합 중 Enter 는 window 캡처에서 끊긴다 — 칸의 keydown 까지 안 간다 · 확정 뒤 Enter 는 간다
   ・3절: 쓰는 곳 — 글자 단축키가 e.key 로 직접 비교하지 않는다 · key-input.js 가 app.js 보다 먼저 로드
   [실행] key-input.js · app.js · animal.js · desk-companion-prototype.html 이 있는 폴더에서. */
'use strict';
const fs = require('fs');
const vm = require('vm');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const KI = read('key-input.js'), APP = read('app.js'), ANIMAL = read('animal.js'), HTML = read('desk-companion-prototype.html');
if(!KI || !APP || !ANIMAL || !HTML){ say('  ? 원본 못 찾음 — key-input.js · app.js · animal.js · desk-companion-prototype.html'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

/* key-input.js 를 가짜 window 에 올린다 — 캡처 리스너를 잡아 두고 흉내 이벤트를 흘린다. */
const captured = [];
const sandbox = { window: { addEventListener: (type, fn, capture) => captured.push({ type, fn, capture }) } };
vm.createContext(sandbox);
vm.runInContext(KI + '\nthis.hotkeyLetter = hotkeyLetter; this.isImeComposing = isImeComposing;', sandbox);
const { hotkeyLetter, isImeComposing } = sandbox;

say('── 1. hotkeyLetter');
chk(hotkeyLetter({ key: 't', code: 'KeyT' }) === 't' && hotkeyLetter({ key: 'T', code: 'KeyT' }) === 't', '영문 t · T → t');
chk(hotkeyLetter({ key: 'ㅅ', code: 'KeyT' }) === 't', '★ 한글 상태(ㅅ) → 물리 키로 t');
chk(hotkeyLetter({ key: 'Process', code: 'KeyT', keyCode: 229 }) === 't', '조합 중(Process) → t');
chk(hotkeyLetter({ key: 'k', code: 'KeyT' }) === 'k', '영문 배열이 다르면(드보락 등) 찍힌 글자를 따른다');
chk(hotkeyLetter({ key: 'Enter', code: 'Enter' }) === '' && hotkeyLetter({ key: '1', code: 'Digit1' }) === '' && hotkeyLetter(null) === '', '글자 키가 아니면 빈 값');

say('── 2. 조합 중 Enter');
const guard = captured.find((l) => l.type === 'keydown' && l.capture === true);
chk(!!guard, 'window keydown 캡처 리스너가 있다');
const fire = (ev) => { let stopped = false, prevented = false;
  guard.fn({ ...ev, stopImmediatePropagation: () => { stopped = true; }, preventDefault: () => { prevented = true; } });
  return { stopped, prevented }; };
{
  const a = fire({ key: 'Enter', isComposing: true, keyCode: 229 });
  chk(a.stopped && !a.prevented, '★ 조합 중 Enter 는 칸까지 안 간다 — 기본 동작(글자 확정)은 막지 않는다');
  chk(!fire({ key: 'Enter', isComposing: false, keyCode: 13 }).stopped, '확정 뒤 Enter 는 그대로 간다');
  chk(!fire({ key: 'ㅅ', isComposing: true, keyCode: 229 }).stopped, 'Enter 가 아닌 조합 키는 건드리지 않는다');
  chk(isImeComposing({ keyCode: 229 }) && !isImeComposing({ key: 'Enter' }), 'isImeComposing — isComposing 또는 keyCode 229');
  /* 흉내: mac 순서(조합 중 Enter → 확정 → 다시 Enter)에서 한 번만 보낸다 */
  const sent = []; let val = '안녕';
  const field = (ev) => { if(ev.key === 'Enter'){ sent.push(val); val = ''; } };
  const press = (ev) => { if(!fire(ev).stopped) field(ev); };
  press({ key: 'Enter', isComposing: true, keyCode: 229 });
  press({ key: 'Enter', isComposing: false, keyCode: 13 });
  chk(sent.length === 1 && sent[0] === '안녕', '흉내 — «안녕» 한 번만 보낸다 (가드 없는 칸이어도)');
}

say('── 3. 쓰는 곳');
{
  const code = strip(APP) + '\n' + strip(ANIMAL);
  chk(!/\b(e|ev)\.key\s*[!=]==?\s*'[a-zA-Z]'/.test(code), '글자 단축키를 e.key 로 직접 비교하는 곳이 없다');
  chk(/const letter = \(e\.ctrlKey \|\| e\.metaKey \|\| e\.altKey\) \? '' : hotkeyLetter\(e\);/.test(code)
      && /case 't':\s*gachaMod\.toggleGachaInv\(\);/.test(code), 'T(파츠 보관함)는 hotkeyLetter 로 · 수정키가 없을 때만 (🎰 보관함은 gacha.js — app.js 는 gachaMod.toggleGachaInv)');
  chk(/hotkeyLetter\(e\) !== 'b'/.test(code) && /hotkeyLetter\(e\)==='e'/.test(code), 'B(조준) · Ctrl+E(관리자 끄기)도');
  chk(['c', 'x', 'z'].every((k) => new RegExp("hotkeyLetter\\(e\\)==='" + k + "' && isDrawStep\\(\\)").test(code)), '생성기 C · X · Z');
  chk(/const k = hotkeyLetter\(e\);/.test(strip(ANIMAL)) && ['z', 'c', 'x', 'g'].every((k) => new RegExp("k==='" + k + "'").test(strip(ANIMAL))), '동물 생성기 Z · C · X · G');
  const iKey = HTML.indexOf('src="parts/key-input.js"'), iApp = HTML.indexOf('src="parts/app.js"'), iAnimal = HTML.indexOf('src="parts/animal.js"');
  chk(iKey > 0 && iKey < iApp && iKey < iAnimal, 'key-input.js 가 app.js · animal.js 보다 먼저 로드된다');
  chk(!/function hotkeyLetter|function isImeComposing/.test(APP), '판정 함수는 key-input.js 한 곳에만');
}

say(fail ? `\n✗ 실패 ${fail}건 (통과 ${pass})` : `\n✓ 전부 통과 (${pass})`);
process.exit(fail ? 1 : 0);
