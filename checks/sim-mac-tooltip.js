/* sim-mac-tooltip.js — 💬 맥 설명 말풍선(shared/mac-tooltip.js) — OS 툴팁이 «항상 위» 앱 창 뒤로 깔리는 맥에서 앱이 직접 그리는가
   실행:  node sim-mac-tooltip.js   (mac-tooltip.js · desk-companion-prototype.html · smoke.js 가 있는 폴더에서)
   ★ 왜 — 맥 OS 툴팁은 «화면 보호기» 단계(실행 화면 창)보다 낮아 뒤로 깔린다. 대신 그릴 때 title 을 떼어 두는데,
     되돌리지 않으면 설명이 영영 사라지고, 떼지 않으면 OS 툴팁이 같이 떠서(윈도우 · 다른 단계) 두 번 보인다.
   ・1절: isMac · place(커서 옆 · 화면 밖이면 접기) · 2절: 가짜 문서에서 install 을 실제로 — 올림 → title 떼기 → 잠깐 뒤 말풍선 → 내림 → 되돌리기 ·
     자식으로 옮김 · 다른 요소로 · 그 사이 코드가 title 을 새로 씀 · 누르기 · 빈 title · 두 번 걸기
   ・3절: 배선(맥에서만 스스로 건다 · 싣는 순서 · css · smoke) · 4절: 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, 'checks/' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('mac-tooltip.js') || read('shared/mac-tooltip.js'), HTML = read('desk-companion-prototype.html'), SMOKE = read('smoke.js');
if (!MOD || !HTML || !SMOKE) { say('  ? 원본 못 찾음 — mac-tooltip.js · desk-companion-prototype.html · smoke.js'); process.exit(2); }
const load = (src) => { const m = { exports: {} }; new Function('module', 'window', 'document', src)(m, undefined, undefined); return m.exports; };

/* 가짜 문서 — closest · contains · dataset · 속성 · 이벤트(캡처) · 타이머 */
function mkDoc(){
  const L = {}, timers = new Map(); let tid = 0;
  function El(tag, attrs, parent){
    const e = { tag, attrs: Object.assign({}, attrs), dataset: {}, parent: parent || null, children: [], isConnected: true, style: {}, offsetWidth: 120, offsetHeight: 24,
      cls: new Set(),
      hasAttribute: (k) => k in e.attrs, getAttribute: (k) => (k in e.attrs ? e.attrs[k] : null),
      setAttribute: (k, v) => { e.attrs[k] = String(v); }, removeAttribute: (k) => { delete e.attrs[k]; },
      contains: (o) => { for (let p = o; p; p = p.parent) if (p === e) return true; return false; },
      closest: (sel) => { for (let p = e; p; p = p.parent) { if (sel.split(',').some(s => (s === '[title]' && p.hasAttribute('title')) || (s === '[data-tw-tip]' && p.dataset.twTip != null))) return p; } return null; },
      classList: { add: (c) => e.cls.add(c), remove: (c) => e.cls.delete(c), contains: (c) => e.cls.has(c) },
      appendChild: (c) => { c.parent = e; e.children.push(c); return c; } };
    if (parent) parent.children.push(e);
    return e;
  }
  const body = El('body', {});
  const doc = { body, createElement: (t) => El(t, {}), addEventListener: (t, f) => { (L[t] = L[t] || []).push(f); } };
  const win = { innerWidth: 800, innerHeight: 600, navigator: { platform: 'MacIntel' },
    setTimeout: (f) => { const i = ++tid; timers.set(i, f); return i; }, clearTimeout: (i) => { timers.delete(i); },
    addEventListener: (t, f) => { (L['win:' + t] = L['win:' + t] || []).push(f); } };
  const fire = (t, o) => (L[t] || []).forEach(f => f(Object.assign({ clientX: 100, clientY: 100 }, o)));
  const tick = () => { const fs2 = [...timers.values()]; timers.clear(); fs2.forEach(f => f()); };
  const tip = () => body.children.find(c => c.attrs.id === 'twMacTip' || c.id === 'twMacTip');
  return { El, body, doc, win, fire, tick, tip, timers };
}

function behave(src){
  const M = load(src), r = {};
  const D = mkDoc();
  const btn = D.El('button', { title: '무작위 파도타기에서 내 목록 빼기' }, D.body);
  const ico = D.El('i', {}, btn);
  const other = D.El('span', { title: '다른 설명' }, D.body);
  const empty = D.El('span', { title: '' }, D.body);
  r.first = M.install(D.doc, D.win) === true;
  r.twice = M.install(D.doc, D.win) === false;
  D.fire('mouseover', { target: btn });
  r.lift = !btn.hasAttribute('title') && btn.dataset.twTip === '무작위 파도타기에서 내 목록 빼기';   // OS 툴팁이 안 뜨게 바로 뗀다
  r.wait = !D.tip() || !D.tip().cls.has('on');
  D.tick();
  const t = D.tip();
  r.show = !!t && t.cls.has('on') && t.textContent === '무작위 파도타기에서 내 목록 빼기' && t.style.left === '114px' && t.style.top === '120px';
  D.fire('mouseout', { target: btn, relatedTarget: ico }); D.fire('mouseover', { target: ico });
  r.child = t.cls.has('on') && !btn.hasAttribute('title');                    // 안쪽 자식으로 옮겨도 그대로
  D.fire('mousedown', { target: ico });
  r.press = !t.cls.has('on') && !btn.hasAttribute('title');                   // 누르면 말풍선만 접는다
  D.fire('mouseout', { target: ico, relatedTarget: D.body });
  r.restore = btn.getAttribute('title') === '무작위 파도타기에서 내 목록 빼기' && btn.dataset.twTip === undefined;
  D.fire('mouseover', { target: btn }); btn.setAttribute('title', '내 목록 넣기'); D.tick();
  r.liveText = D.tip().textContent === '내 목록 넣기';                         // 올려 둔 사이 코드가 바꾼 글
  D.fire('mouseover', { target: other });
  r.swap = btn.getAttribute('title') === '내 목록 넣기' && !other.hasAttribute('title') && !D.tip().cls.has('on');
  D.fire('mouseout', { target: other, relatedTarget: null });
  r.codeWins = (() => { D.fire('mouseover', { target: btn }); btn.setAttribute('title', '코드가 쓴 값'); D.fire('mouseout', { target: btn, relatedTarget: null }); return btn.getAttribute('title') === '코드가 쓴 값'; })();
  D.fire('mouseover', { target: empty });
  r.empty = empty.hasAttribute('title') && empty.getAttribute('title') === '' && D.timers.size === 0;
  r.place = (() => { const p = M.place; const a = p(100, 100, 120, 24, 800, 600), b = p(780, 590, 120, 24, 800, 600), c = p(10, 10, 900, 24, 800, 600);
    return a.x === 114 && a.y === 120 && b.x === 674 && b.y === 552 && c.x === 6; })();
  r.mac = M.isMac({ platform: 'MacIntel' }) && M.isMac({ platform: '', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)' })
    && !M.isMac({ platform: 'Win32', userAgent: 'Windows NT 10.0' }) && !M.isMac(null);
  return r;
}

say('\n── 1·2절: 실행');
const b = behave(MOD);
chk(b.mac, 'isMac — MacIntel · 맥 UA 는 맥, 윈도우 · 없음은 아님');
chk(b.place, 'place — 커서 오른쪽 아래 · 오른쪽 · 아래가 넘치면 접기 · 화면보다 넓으면 왼쪽 가장자리');
chk(b.first && b.twice, '한 문서에 한 번만 건다');
chk(b.lift, '★ 올리면 title 을 바로 떼어 둔다 — OS 툴팁(창 뒤로 깔림)이 안 뜨게');
chk(b.wait, '  바로 그리지 않고 잠깐 머문 뒤에');
chk(b.show, '★ 잠깐 뒤 같은 글을 앱 안 말풍선으로 — 커서 옆');
chk(b.child, '  안쪽 자식(아이콘)으로 옮겨도 그대로');
chk(b.press, '  누르면 말풍선만 접는다(title 은 나갈 때)');
chk(b.restore, '★ 나가면 title 을 되돌린다 — 설명이 사라지지 않는다');
chk(b.liveText, '  올려 둔 사이 코드가 title 을 바꾸면 말풍선도 새 글');
chk(b.swap, '  다른 요소로 옮기면 앞 요소 title 을 되돌리고 새 요소 것을 뗀다');
chk(b.codeWins, '  올려 둔 사이 코드가 쓴 title 은 나갈 때 덮지 않는다');
chk(b.empty, '  빈 title 은 건드리지 않는다(OS 도 안 띄운다)');

say('\n── 3절: 배선');
chk(/if\(isMac\(window\.navigator\)\) install\(document, window\);/.test(MOD), '맥에서만 싣자마자 스스로 건다(윈도우는 OS 툴팁 그대로)');
const iT = HTML.indexOf('<script src="parts/shared/mac-tooltip.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
chk(iT > 0 && iT < iA, '싣는 순서 — app.js 보다 먼저');
chk(/#twMacTip\{position:fixed;z-index:10000;display:none;pointer-events:none;/.test(HTML) && /#twMacTip\.on\{display:block;\}/.test(HTML), 'css — 모든 창 위(10000) · 누르기를 막지 않음 · on 일 때만 보임');
chk(SMOKE.indexOf("PRELOAD.push('mac-tooltip.js');") > 0, 'smoke PRELOAD 에 mac-tooltip.js');

say('\n── 4절: 깨 보기');
const b1 = behave(MOD.replace("    if(!cur.hasAttribute('title') && cur.dataset[KEY] != null) cur.setAttribute('title', cur.dataset[KEY]);\n", ''));
chk(!b1.restore, 'title 을 되돌리지 않으면 2절 «나가면 되돌린다» 가 빨강');
const b2 = behave(MOD.replace("    cur.removeAttribute('title');\n    timer = win.setTimeout(show, DELAY_MS);", '    timer = win.setTimeout(show, DELAY_MS);'));
chk(!b2.lift, '올릴 때 title 을 안 떼면 2절 «OS 툴팁이 안 뜨게» 가 빨강');
const b3 = behave(MOD.replace('    if(to && cur.contains(to)) return;   // 안쪽 자식으로 옮겨 간 것\n', ''));
chk(!b3.child, '자식으로 옮길 때 놓아 버리면 2절 «자식으로 옮겨도» 가 빨강');

say(`\n결과: ${pass}·${fail}`);
process.exit(fail ? 1 : 0);
