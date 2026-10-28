/* sim-mh-sanitize.js — 🛡️ 남의 bio·게시글이 **읽는 쪽에서** 씻기는가 (저장형 XSS)
   실행:  node sim-mh-sanitize.js   (app.js 와 같은 폴더에서)

   ★ 왜 이 검사가 있는가 — sanitize(`_mhSanitizeNode`)가 예전엔 **저장 경로에만** 걸려 있었다:
         _mhSaveRT()  → sanitize 를 탄다        ← 내 편집기에서 저장할 때
         _mhLoadRT()  → HTML 로 보이면 원본 그대로 return   ← 그릴 때
     그런데 `_mhLoadRT` 가 그리는 `_myHomeData` 는 **남의 마이홈을 볼 때 남의 데이터**다.
     RTDB `users/$uid/home` 은 `.write:true` + 타입·길이 검사뿐이고, 이 앱에는 Firebase Auth 가
     없어서(규칙 파일에 `auth` 0회) 소유자를 증명할 방법이 없다 — **규칙으로는 막을 수 없다.**
     즉 저장 경로를 건너뛰고 심은 HTML 이 그것을 구경하는 사람 화면에서 그대로 실행됐다.
     **읽는 쪽 sanitize 가 이 구조에서 유일한 방어선이다.** 그래서 이 검사가 그것을 지킨다.

   ★ 이 검사가 지키는 규약 넷
     ① `_mhLoadRT` 의 HTML 분기는 반드시 `_mhSanitizeHtml` 을 거친다
     ② 순서는 heal → 판정 → sanitize (앞에 넣으면 아홉 겹 `&amp;` 제보가 되살아난다)
     ③ 읽는 쪽 sanitize 는 `DOMParser` 로 한다 — `createElement('div').innerHTML` 은 안 된다.
        문서에 안 붙은 div 라도 크롬은 그 안의 `<img>` 를 로드해서 `onerror` 가 sanitize 보다
        먼저 터지고 IP 도 그때 나간다. DOMParser 문서는 브라우징 컨텍스트가 없어 조용하다
     ④ sanitize 가 실패하면 **원본을 돌려주지 않는다** (씻지 못한 HTML 을 그리는 게 막으려던 일)

   ⚠ 아래 §2 의 파서는 **흉내**다. 실제 파싱은 브라우저가 한다 — 여기서 보는 것은 파싱이 아니라
     sanitizer 의 **판단**이다(어떤 태그·속성을 남기고 지우는가). 그래서 공격 문자열은
     이 흉내 파서가 다룰 수 있는 문법 안에서만 쓴다. 파싱 자체의 기묘한 경우
     (`<img/src=x`, 주석 안 태그 등)는 여기서 못 본다 — 그건 DOMParser 를 믿는 부분이다. */
'use strict';
const { joinRenderer: _joinRenderer } = require('./sim-renderer-src.js');   // 앱 FSD 로 옮긴 모듈을 «옮기기 전 app.js 글» 로 되살려 읽는다
const fs = require('fs');
/* 📩 수령함 · 💝 선물함 · 👥 마이홈 친구 목록은 parts/myhome/myhome-inbox.js 로 옮겼다(앱 FSD 15번) — 렌더러 쪽 한 벌 = app.js + 그 파일.
   ⚠️ 그 파일이 없으면 «못 찾음» 으로 멈춘다 — app.js 만 보고 빨개지거나 초록인 척하지 않게. */
let MI = null; try{ MI = fs.readFileSync('myhome-inbox.js', 'utf8'); }catch(_){ console.log('  ? 원본 못 찾음 — myhome-inbox.js'); process.exit(2); }
const SRC = _joinRenderer(fs.readFileSync('app.js', 'utf8')) + '\n' + MI;
const say = console.log;
let fail = 0;
const chk = (c, m) => { say((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };

/* ── 함수를 원본에서 떼어낸다 (중괄호 짝맞추기) ───────────────────────── */
function cutFn(name){
  const i = SRC.indexOf('function ' + name + '(');
  if (i < 0) throw new Error(name + ' 를 못 찾음');
  let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++){
    if (SRC[k] === '{') d++;
    else if (SRC[k] === '}'){ d--; if (d === 0) return SRC.slice(i, k + 1); }
  }
  throw new Error(name + ' 의 끝을 못 찾음');
}
function cutLine(startsWith){
  const line = SRC.split('\n').find(l => l.trim().startsWith(startsWith));
  if (!line) throw new Error(startsWith + ' 를 못 찾음');
  return line;
}
const F_LOAD = cutFn('_mhLoadRT');
const F_SAVE = cutFn('_mhSaveRT');
const F_SANH = cutFn('_mhSanitizeHtml');

say('=== 🛡️ 마이홈 리치텍스트 — 읽는 쪽 sanitize ===');
say('');

/* ── §1. 배선 — 부르는 자리와 순서 ─────────────────────────────────── */
say('· §1 배선');

chk(/_mhSanitizeHtml\s*\(/.test(F_LOAD),
    '★ _mhLoadRT 가 _mhSanitizeHtml 을 부른다 (구멍 ② 회귀 차단)');
chk(!/return\s+s\s*;/.test(F_LOAD),
    '★ HTML 분기가 원본(`return s`)을 그대로 돌려주지 않는다');
{
  const iHeal = F_LOAD.indexOf('_mhHealEntities');
  const iSan  = F_LOAD.indexOf('_mhSanitizeHtml');
  chk(iHeal >= 0 && iSan > iHeal,
      '★ 순서가 heal → sanitize 다 (뒤집히면 아홉 겹 &amp; 가 되살아난다)');
}
chk(/_mhPurify\s*\(/.test(F_SANH),
    '★ 읽는 쪽 sanitize 가 DOMPurify(_mhPurify)를 쓴다 — 손으로 짠 DOM 고치기가 아니다');
chk(!/createElement\s*\(\s*['"]div['"]\s*\)/.test(F_SANH),
    '★ 읽는 쪽이 createElement(div).innerHTML 을 쓰지 않는다 — img 가 sanitize 전에 로드된다');
chk(/catch/.test(F_SANH) && !/catch[\s\S]{0,120}return\s+str\s*;/.test(F_SANH),
    '★ 실패 시 원본을 돌려주지 않는다');
chk(/_mhPurify\s*\(\s*el\.innerHTML\s*\)/.test(F_SAVE),
    '★ 저장 쪽도 같은 DOMPurify 로 씻는다');
chk(!/function _mhSanitizeNode/.test(SRC),
    '★ 손으로 짠 _mhSanitizeNode 가 없다(다시 만들지 않는다)');

/* IMG 정책이 한 곳에만 있는가 — 뒤집는 비용을 0 으로 두려고 상수로 뺐다 */
const L_POLICY = cutLine('const _MH_IMG_SRC');
chk(/'(any|storage-only|none)'/.test(L_POLICY),
    '   IMG 정책이 상수 한 줄이다: ' + L_POLICY.trim());

say('');

/* ── §2. 판단 — 진짜 DOM(jsdom) 위에서 진짜 DOMPurify 로 돌린다 ─────────
   흉내 파서로는 실제 파싱 · 씻기를 다 볼 수 없다. 그래서 앱이 싣는 파일 둘(vendor/dompurify · parts/shared/rich-text.js)을 그대로 jsdom 창에 싣는다. */
say('· §2 판단 (jsdom + vendor DOMPurify 실제 실행)');
const path = require('path');
/* 러너는 app/ 아래 폴더를 임시 폴더 바로 밑에 펼친다 — 그 자리와 저장소 자리를 다 본다. */
const APP = [__dirname, path.resolve(__dirname, '..', 'app')].find(d => fs.existsSync(path.join(d, 'vendor', 'dompurify', 'purify.min.js')));
if (!APP){ console.log('  ? 원본 못 찾음 — vendor/dompurify/purify.min.js'); process.exit(2); }
let JSDOM;
try { ({ JSDOM } = require('jsdom')); } catch (e) { say('  ✗ jsdom 을 못 불러옴 — npm install 필요: ' + e.message); process.exit(1); }
const PURIFY_SRC = fs.readFileSync(path.join(APP, 'vendor', 'dompurify', 'purify.min.js'), 'utf8');
const RT_SRC = fs.readFileSync(path.join(APP, 'parts', 'shared', 'rich-text.js'), 'utf8');
function build(policy){
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' });
  const w = dom.window;
  w.eval(PURIFY_SRC);
  w.eval(policy ? RT_SRC.replace(L_POLICY, "const _MH_IMG_SRC = '" + policy + "';") : RT_SRC);
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  return w.TwRichText.createRichText({ escHtml: esc, DOMPurify: () => w.DOMPurify });
}
let API;
try { API = build(null); }
catch (e){ say('  ✗ rich-text 모듈을 jsdom 에 싣지 못했습니다: ' + e.message); process.exit(1); }
const cleanWith = (api, html) => api._mhLoadRT(html);
const clean = html => cleanWith(API, html);

const cases = [
  /* ⚠️ src 는 **절대 URL** 로 쓴다 — 상대 URL 은 스킴 검사가 원래부터 지워 무엇이 지워졌는지 구분이 안 된다. */
  ['<img src="https://a.example/x.png" onerror="alert(1)">',
                                              /^<img src="https:\/\/a\.example\/x\.png">$/,
                                                                       'IMG 의 onerror 가 지워지고 src 는 남는다'],
  ['<img src="x" onerror="alert(1)">',        /^<img>$/,                '상대 URL src 는 스킴 검사가 지운다'],
  ['<img src="javascript:alert(1)">',         /^<img>$/,                'javascript: 스킴 src 가 지워진다'],
  ['<a href="javascript:alert(1)">t</a>',     /^<a>t<\/a>$/,            'javascript: 스킴 href 가 지워진다'],
  ['<a href="https://ok.example">t</a>',      /href="https:\/\/ok\.example"/, 'http(s) href 는 남는다'],
  ['<script>alert(1)</script>t',              /^t$/,                    'SCRIPT 는 내용째 사라진다'],
  ['<iframe src="https://evil"></iframe>',    /^$/,                     'IFRAME 이 사라진다'],
  ['<b onmouseover="x">굵게</b>',              /^<b>굵게<\/b>$/,          'on* 이벤트 속성이 지워진다'],
  ['<span style="color:red">색</span>',        /style="color:red"/,      '허용 style 은 남는다'],
  ['<span style="position:fixed;top:0">x</span>', /^<span>x<\/span>$/,  '허용 목록 밖 style 은 지워진다'],
  ['<b><img src="https://a.example/x.png" onerror="y"></b>',
                                              /^<b><img src="https:\/\/a\.example\/x\.png"><\/b>$/,
                                                                       '중첩된 자식까지 씻는다'],
  ['<div data-x="1" id="a">t</div>',          /^<div>t<\/div>$/,        '화이트리스트 밖 속성이 지워진다'],
  ['<font color="#ff0000" size="5" style="background-color:#ffff00">셋</font>',
                                              /^<font color="#ff0000" size="5" style="background-color:#ffff00">셋<\/font>$/,
                                                                       '★ 편집기가 만든 FONT 의 color · size · 배경색이 그대로 남는다'],
  ['<a href="https://ok.example" style="color:red">t</a>', /^<a href="https:\/\/ok\.example">t<\/a>$/, '태그마다 허용 속성만 — A 의 style 은 지워진다'],
  ['<section><img src="https://a.example/x.png" onerror="y"></section>',
                                              /^<img src="https:\/\/a\.example\/x\.png">$/,
                                                                       '★ 허용 밖 태그 안 내용 — 경우 1'],
  ['<section><section><b onclick="y">t</b></section></section>',
                                              /^<b>t<\/b>$/,            '★ 허용 밖 태그 안 내용 — 경우 2'],
  ['<svg><g onload="y"></g></svg>t',          /^t$/,                    '★ SVG 는 사라진다'],
  ['<math><mi><mglyph><style><img src=x onerror=y></style></mglyph></mi></math>',
                                              /^(?![\s\S]*onerror)/,     '★ 이름공간을 섞은 변이(mXSS)에도 onerror 가 남지 않는다'],
];
cases.forEach(([input, want, label]) => {
  let out;
  try { out = clean(input); } catch (e) { out = '‼ ' + e.message; }
  chk(want.test(out), label + '   [' + out + ']');
});

say('');
say('· §2-A 저장 길 — _mhSaveRT 를 jsdom 편집기 칸으로 직접 돌린다(jsdom 엔 innerText 가 없어 textContent 로 흉내)');
{
  const dom = new JSDOM('<!doctype html><body><div id="ed"></div></body>', { runScripts: 'outside-only' });
  const w = dom.window;
  Object.defineProperty(w.HTMLElement.prototype, 'innerText', { get(){ return this.textContent; }, configurable: true });
  w.eval(PURIFY_SRC); w.eval(RT_SRC);
  const rt = w.TwRichText.createRichText({ escHtml: t => String(t), DOMPurify: () => w.DOMPurify });
  const ed = w.document.getElementById('ed');
  ed.innerHTML = '<font color="#ff0000" size="5">색</font><b onclick="y">굵게</b><section><img src="https://a.example/x.png" onerror="y"></section>';
  const saved = rt._mhSaveRT(ed, 100);
  chk(/<font color="#ff0000" size="5">색<\/font>/.test(saved) && !/onclick|onerror|section/.test(saved), '★ 저장할 때도 씻고 서식은 남긴다   [' + saved + ']');
  ed.innerHTML = '<b>가나다라마</b>바사';
  chk(rt._mhSaveRT(ed, 3) === '<b>가나다</b>', '   글자 수 자르기(3)가 그대로다');
}

say('');
say('· §2-B IMG 정책 상수가 장식이 아닌가 (세 값을 다 돌린다)');
{
  const EXT = '<img src="https://cdn.example/a.png">';
  const OURS = '<img src="https://firebasestorage.googleapis.com/v0/b/x/o/a.png">';
  chk(/src="https:\/\/cdn\.example/.test(clean(EXT)),
      "   'any'(지금 값) — 외부 이미지가 통과한다 = 기존 저장이 안 깨진다");
  const only = build('storage-only');
  chk(!/src=/.test(cleanWith(only, EXT)) && /src="https:\/\/firebasestorage/.test(cleanWith(only, OURS)),
      "★ 'storage-only' — 외부는 막고 우리 Storage 는 통과한다");
  const none = build('none');
  chk(cleanWith(none, OURS) === '' && cleanWith(none, EXT) === '',
      "★ 'none' — IMG 가 통째로 사라진다");
}
{
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' });
  dom.window.eval(RT_SRC);
  const noPurify = dom.window.TwRichText.createRichText({ escHtml: t => String(t), DOMPurify: () => undefined });
  const out = noPurify._mhLoadRT('<b onclick="y">t</b>');
  chk(!/<|onclick/.test(out), '★ DOMPurify 가 없으면 태그를 걷고 글자만(원본을 돌려주지 않는다)   [' + out + ']');
}

say('');

/* ── §3. 속성값 보간 — 친구 목록 한 줄 ─────────────────────────────── */
say('· §3 친구 목록 아바타 (구멍 ①)');

const iRow = SRC.indexOf('mh-favatar');
const ROW = SRC.slice(iRow - 900, iRow + 1800);
chk(!/mh-favatar[^\n]*title="[^"]*\$\{/.test(ROW),
    '★ title 이 속성 문자열 보간이 아니다 (_mhEsc 는 " 를 안 막는다)');
chk(!/<img src="\$\{\s*f\.avatar/.test(ROW),
    '★ img src 가 속성 문자열 보간이 아니다 (여기는 이스케이프가 아예 없었다)');
chk(/avatarEl\.title\s*=/.test(ROW),
    '   title 을 프로퍼티로 넣는다');
chk(/createElement\(\s*['"]img['"]\s*\)[\s\S]{0,200}\.src\s*=/.test(ROW),
    '   아바타 이미지를 createElement + .src 로 붙인다');

say('');

/* ── §4. 남의 이름을 그리는 나머지 자리 ───────────────────────────── */
say('· §4 라이선스 요청 이름 (관리자 화면 — admin/admin-license.js 로 옮김 · 관리자 코드 admin 폴더 3번)');
const LIC = ['admin-license.js', 'parts/admin/admin-license.js', 'app/parts/admin/admin-license.js']
  .map(f => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } }).find(Boolean);
if(!LIC){ console.log('  ? 원본 못 찾음 — admin-license.js'); process.exit(2); }
chk(/🙋 <b>\$\{_chatEsc\(/.test(LIC),
    '★ req.name 이 이스케이프를 거친다 (licenseRequests 는 .write:true 다)');

say('');
/* ⚠️ 마지막 줄은 러너가 읽는다 — run.js 의 FAIL_LINE 은 **줄 전체가 그 말일 때만**,
     PASS_LINE 은 `전부 통과` 라는 말로 가른다. 설명은 윗줄에 두고 판정만 마지막에 남긴다.
     옛 판은 `✗ N건 실패` · `✓ 통과 —…` 였는데 둘 다 그 틀에 안 맞아 종료코드로만 갈렸다. */
if (fail){ say('✗ 실패 ' + fail + '건'); process.exit(1); }
say('  읽는 쪽 sanitize 가 걸려 있고, 속성값 보간 두 곳이 사라졌다');
say('전부 통과 ✅');
