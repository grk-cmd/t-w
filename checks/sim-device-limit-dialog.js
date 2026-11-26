/* sim-device-limit-dialog.js — 🖥️ «등록할 수 있는 PC를 다 썼어요» 확인창(account/device-limit-dialog.js) — 디자인 시스템 확인창 규칙대로 실제로 눌러 본다
   실행:  node sim-device-limit-dialog.js   (러너 스테이징 또는 저장소 루트에서)
   ・1절: 모양 — 앱이 쓰는 글(TEXT · 화면 글)에 대수(숫자)가 없다(상한은 서버가 정한다) · role=alertdialog + aria-labelledby · 제목 질문(받은 글을 글자로만) · 이모지 없음 · 260px · 버튼 [취소] · [지우고 사용](오른쪽 정렬) · 기본 포커스 취소 ·
          껍데기 app-popup-ov(클릭 통과 목록) · 기기 안내 화면과 같은 층(--z-gate-device)
   ・2절: 누르기 — [지우고 사용] true · [취소] false · Esc false · 닫히면 창이 사라진다 · 새로 물으면 앞 창은 취소로 닫힌다
   ・3절: 연결 — app.js · html · smoke PRELOAD · 클릭 통과
   ・4절: mutation test */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'apps/desktop/app/parts/' + f, path.basename(f), 'apps/desktop/app/' + f, 'app/' + f, 'checks/' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('account/device-limit-dialog.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html'), SMOKE = read('smoke.js');
const RUN = read('launcher/desktop-run.js') || '';
if (!MOD || !APP || !HTML) { say('  ? 원본 못 찾음 — device-limit-dialog.js · app.js · desk-companion-prototype.html'); process.exit(2); }

/* 아주 작은 가짜 DOM — 만들기 · 붙이기 · 떼기 · 글 · 속성 · 키 이벤트 · 포커스 */
function fakeDoc() {
  const doc = { focused: null, body: null };
  const mk = (tag) => {
    const e = { tag, children: [], parent: null, attrs: {}, style: { cssText: '' }, className: '', id: '', _text: '', listeners: {}, onclick: null,
      appendChild(c) { c.parent = e; e.children.push(c); return c; },
      remove() { if (e.parent) { e.parent.children = e.parent.children.filter((x) => x !== e); e.parent = null; } },
      setAttribute(k, v) { e.attrs[k] = String(v); }, getAttribute(k) { return e.attrs[k]; },
      addEventListener(t, fn) { (e.listeners[t] = e.listeners[t] || []).push(fn); },
      focus() { doc.focused = e; },
      get textContent() { return e._text + e.children.map((c) => c.textContent).join(''); }, set textContent(v) { e._text = String(v); e.children = []; },
      set innerHTML(_) { throw new Error('innerHTML 을 쓰지 않는다'); },
    };
    return e;
  };
  doc.createElement = mk;
  doc.body = mk('body');
  return doc;
}
const all = (e) => [e].concat(...e.children.map(all));
function open(src, q) {
  const win = {};
  new Function('window', 'module', src)(win, undefined);
  const doc = fakeDoc();
  const D = win.TwDeviceLimitDialog.createDeviceLimitDialog({ document: doc });
  const p = D.ask(q);
  const ov = doc.body.children[0];
  const els = ov ? all(ov) : [];
  const btn = (a) => els.find((e) => e.attrs['data-a'] === a);
  const box = els.find((e) => e.attrs.role);
  return { win, doc, D, p, ov, els, btn, box };
}
/* 답을 기다린다 — 안 풀리면(깨진 판) '__hang'. 기다리지 않으면 풀리지 않는 약속에서 검사가 말없이 끝난다 */
const settle = (p) => Promise.race([p, new Promise((r) => setTimeout(() => r('__hang'), 50))]);
const Q = '가장 오래된 기기 Windows PC (11월 3일 등록) · 마지막 사용 11월 10일 — 이 기기를 지우고 이 PC를 쓸까요?';

async function judge(src) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let w;
  try { w = open(src, Q); } catch (e) { t(false, '열다 던짐 — ' + e.message); return r; }
  /* 1 */
  const label = w.box && w.box.attrs['aria-labelledby'];
  const head = label && w.els.find((e) => e.id === label);
  t(w.box && w.box.attrs.role === 'alertdialog' && head && head.textContent === Q, '★ role=alertdialog · aria-labelledby 가 제목 질문(받은 글 그대로 — 글자로만 넣는다)');
  const no = w.btn('no'), ok = w.btn('ok');
  t(no && ok && no.textContent === '취소' && ok.textContent === '지우고 사용' && no.parent === ok.parent && no.parent.children.indexOf(no) < no.parent.children.indexOf(ok) && /justify-content:flex-end/.test(no.parent.style.cssText),
    '★ 버튼 [취소] · [지우고 사용] — 오른쪽 정렬 · 실행이 오른쪽(디자인 시스템 확인창)');
  t(w.doc.focused === no, '  기본 포커스는 [취소] — Enter 한 번에 기기가 지워지지 않게');
  t(w.ov.textContent === '등록할 수 있는 PC를 다 썼어요' + Q + '취소지우고 사용' && !/\p{Extended_Pictographic}/u.test(w.ov.textContent) && /width:260px/.test(w.box.style.cssText),
    '  제목줄 «등록할 수 있는 PC를 다 썼어요» · 질문 · 버튼 둘뿐(덧붙이는 설명 없음) · 이모지 없음 · 확인창 폭 260px(디자인 시스템)');
  const own = Object.values(w.win.TwDeviceLimitDialog.TEXT).join('') + w.ov.textContent.replace(Q, '');
  t(!/\d/.test(own), '★ 앱이 쓰는 글에 대수가 없다 — 상한은 서버가 정한다(받은 질문 글은 빼고 본다)');
  t(w.ov.className === 'app-popup-ov' && /pointer-events:none/.test(w.ov.style.cssText) && /z-index:var\(--z-gate-device\)/.test(w.ov.style.cssText) && /pointer-events:auto/.test(w.box.style.cssText),
    '  껍데기 app-popup-ov(클릭 통과 목록) · 화면 전체를 막지 않음 · 기기 안내 화면과 같은 층(뒤에 붙어 그 위에 뜬다)');
  /* 2 */
  ok.onclick();
  t((await settle(w.p)) === true && w.doc.body.children.length === 0 && !w.D.isOpen(), '[지우고 사용] → true · 창이 사라진다');
  w = open(src, Q); w.btn('no').onclick();
  t((await settle(w.p)) === false && w.doc.body.children.length === 0, '[취소] → false · 창이 사라진다');
  w = open(src, Q);
  let prevented = false;
  (w.box.listeners.keydown || []).forEach((fn) => fn({ key: 'Escape', preventDefault() { prevented = true; }, stopPropagation() {} }));
  t((await settle(w.p)) === false && prevented && w.doc.body.children.length === 0, 'Esc → 취소(false)');
  w = open(src, Q);
  const p2 = w.D.ask('두 번째');
  t((await settle(w.p)) === false && w.doc.body.children.length === 1 && w.D.isOpen(), '  새로 물으면 앞 창은 취소로 닫히고 새 창 하나만');
  all(w.doc.body.children[0]).find((e) => e.attrs['data-a'] === 'ok').onclick();
  t((await settle(p2)) === true, '  새 창의 답은 새 약속으로');
  return r;
}

(async () => {
  say('── 1~2. 실제로 열고 눌러 본다');
  (await judge(MOD)).forEach(([ok, msg]) => chk(ok, msg));

  say('── 3. 연결');
  chk(/const deviceLimitDialog = TwDeviceLimitDialog\.createDeviceLimitDialog\(\{ document: document \}\);/.test(APP), 'app.js — 확인창을 하나 만든다(묻는 글은 등록 쪽이 준다)');
  const order = [...HTML.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*\bsrc="parts\/([^"]+\.js)"/g)].map((x) => x[1]);
  chk(order.indexOf('account/device-limit-dialog.js') > 0 && order.indexOf('account/device-limit-dialog.js') < order.indexOf('app.js'), 'html — device-limit-dialog.js 를 app.js 보다 먼저 싣는다');
  chk(!SMOKE || /PRELOAD\.push\([^)]*'device-limit-dialog\.js'/.test(SMOKE), 'smoke PRELOAD 에 device-limit-dialog.js');
  chk(!RUN || /\.app-popup-ov/.test(RUN), '클릭 통과 목록(UI_HIT_SEL)이 .app-popup-ov 를 받는다');

  say('── 4. mutation test — 빨강이 나야 한다');
  const breaks = [
    ['기본 포커스가 실행', (m) => m.replace('      try{ no.focus(); }catch(_){}', '      try{ ok.focus(); }catch(_){}')],
    ['버튼 순서가 뒤바뀜', (m) => m.replace('      acts.appendChild(no); acts.appendChild(ok);', '      acts.appendChild(ok); acts.appendChild(no);')],
    ['Esc 가 안 먹음', (m) => m.replace("if(e.key === 'Escape'){", "if(e.key === 'NoSuchKey'){")],
    ['취소가 true', (m) => m.replace('      no.onclick = () => close(false);', '      no.onclick = () => close(true);')],
    ['역할 표시 없음', (m) => m.replace("      box.setAttribute('role', 'alertdialog');\n", '')],
    ['확인창에 이모지', (m) => m.replace("  title: '등록할 수 있는 PC를 다 썼어요',", "  title: '🖥️ 등록할 수 있는 PC를 다 썼어요',")],
    ['제목에 대수', (m) => m.replace("  title: '등록할 수 있는 PC를 다 썼어요',", "  title: 'PC 5대가 다 찼어요',")],
    ['단추에 대수', (m) => m.replace("  ok: '지우고 사용',", "  ok: '지우고 5대째로 사용',")],
    ['폭이 확인창과 다름', (m) => m.replace('width:260px;', 'width:300px;')],
    ['클릭 통과 목록에서 빠짐', (m) => m.replace("      ov.className = 'app-popup-ov';", "      ov.className = 'x';")],
  ];
  for (const [name, fm] of breaks) {
    const m2 = fm(MOD);
    if (m2 === MOD) { chk(false, name + ' — 바꿀 글을 못 찾음'); continue; }
    let red = false;
    try { red = (await judge(m2)).some(([ok]) => !ok); } catch (_) { red = true; }
    chk(red, name);
  }
  say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
  process.exit(fail ? 1 : 0);
})();
