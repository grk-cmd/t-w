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
const fs = require('fs');
const SRC = fs.readFileSync('app.js', 'utf8');
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
chk(/DOMParser/.test(F_SANH),
    '★ 읽는 쪽 sanitize 가 DOMParser 를 쓴다');
chk(!/createElement\s*\(\s*['"]div['"]\s*\)/.test(F_SANH),
    '★ 읽는 쪽이 createElement(div).innerHTML 을 쓰지 않는다 — img 가 sanitize 전에 로드된다');
chk(/_mhSanitizeNode/.test(F_SANH),
    '   sanitizer 를 새로 만들지 않고 기존 것을 쓴다');
chk(/catch/.test(F_SANH) && !/catch[\s\S]{0,120}return\s+str\s*;/.test(F_SANH),
    '★ 실패 시 원본을 돌려주지 않는다');

/* 저장 쪽은 **일부러** 안 바꿨다 — 이미 화면에 붙은 편집기를 읽으므로 새 노출이 없고,
   innerText 로 글자수를 세는데 DOMParser 문서에는 레이아웃이 없어 innerText 가 안 나온다. */
chk(/createElement/.test(F_SAVE) && /innerText/.test(F_SAVE),
    '   _mhSaveRT 는 그대로다 (편집기를 읽는 쪽이라 바꿀 이유가 없다)');

/* IMG 정책이 한 곳에만 있는가 — 뒤집는 비용을 0 으로 두려고 상수로 뺐다 */
const L_POLICY = cutLine('const _MH_IMG_SRC');
chk(/'(any|storage-only|none)'/.test(L_POLICY),
    '   IMG 정책이 상수 한 줄이다: ' + L_POLICY.trim());

say('');

/* ── §2. sanitizer 의 판단 — 실제로 돌린다 ─────────────────────────── */
say('· §2 판단 (흉내 DOM 위에서 실제 실행)');

/* 아주 작은 DOM. element(1)·text(3) 만 있다. sanitizer 가 쓰는 것만 구현한다:
   nodeType · tagName · attributes · removeAttribute · setAttribute · childNodes ·
   firstChild · parentNode · insertBefore · remove */
function mkText(t){ return { nodeType: 3, _text: t, parentNode: null }; }
function mkEl(tag, attrs){
  const el = {
    nodeType: 1, tagName: tag.toUpperCase(), childNodes: [], parentNode: null,
    _attrs: Object.assign({}, attrs || {}),
    get attributes(){ return Object.keys(this._attrs).map(n => ({ name: n, value: this._attrs[n] })); },
    get firstChild(){ return this.childNodes[0] || null; },
    removeAttribute(n){ delete this._attrs[n]; },
    setAttribute(n, v){ this._attrs[n] = String(v); },
    getAttribute(n){ return Object.prototype.hasOwnProperty.call(this._attrs, n) ? this._attrs[n] : null; },
    remove(){ const p = this.parentNode; if (!p) return;
      const i = p.childNodes.indexOf(this); if (i >= 0) p.childNodes.splice(i, 1); this.parentNode = null; },
    insertBefore(node, ref){ const i = this.childNodes.indexOf(ref);
      if (node.parentNode) node.remove && node.remove();
      this.childNodes.splice(i < 0 ? this.childNodes.length : i, 0, node); node.parentNode = this; return node; },
    append(node){ this.childNodes.push(node); node.parentNode = this; return node; },
  };
  return el;
}
/* text 노드에도 remove 가 필요하다 (허용 안 된 태그 언래핑 중에 옮겨 다닌다) */
function fixText(t){
  t.remove = function(){ const p = this.parentNode; if (!p) return;
    const i = p.childNodes.indexOf(this); if (i >= 0) p.childNodes.splice(i, 1); this.parentNode = null; };
  return t;
}

/* 흉내 파서 — `<tag a="1" b='2'>`, `</tag>`, 글자. void 태그는 자식을 안 받는다. */
const VOID = new Set(['BR', 'IMG', 'HR', 'INPUT', 'META', 'LINK']);
function parse(html){
  const root = mkEl('body');
  let cur = root, i = 0;
  while (i < html.length){
    const lt = html.indexOf('<', i);
    if (lt < 0){ if (i < html.length) cur.append(fixText(mkText(html.slice(i)))); break; }
    if (lt > i) cur.append(fixText(mkText(html.slice(i, lt))));
    const gt = html.indexOf('>', lt);
    if (gt < 0){ cur.append(fixText(mkText(html.slice(lt)))); break; }
    let tag = html.slice(lt + 1, gt).trim();
    i = gt + 1;
    if (tag.startsWith('/')){                       // 닫는 태그
      const name = tag.slice(1).trim().toUpperCase();
      let p = cur; while (p && p.tagName !== name) p = p.parentNode;
      if (p && p.parentNode) cur = p.parentNode;
      continue;
    }
    if (tag.endsWith('/')) tag = tag.slice(0, -1);
    const m = /^([a-zA-Z0-9]+)\s*([\s\S]*)$/.exec(tag);
    if (!m) continue;
    const name = m[1].toUpperCase();
    const attrs = {};
    const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
    let a; while ((a = re.exec(m[2]))) attrs[a[1].toLowerCase()] = a[2] !== undefined ? a[2] : (a[3] !== undefined ? a[3] : (a[4] !== undefined ? a[4] : ''));
    const el = mkEl(name, attrs);
    cur.append(el);
    if (!VOID.has(name)) cur = el;
  }
  return root;
}
function serialize(node){
  if (node.nodeType === 3) return node._text;
  const attrs = Object.keys(node._attrs).map(n => ' ' + n + '="' + node._attrs[n] + '"').join('');
  const inner = node.childNodes.map(serialize).join('');
  if (VOID.has(node.tagName)) return '<' + node.tagName.toLowerCase() + attrs + '>';
  return '<' + node.tagName.toLowerCase() + attrs + '>' + inner + '</' + node.tagName.toLowerCase() + '>';
}

/* app.js 에서 sanitizer 일가를 그대로 떼어와 이 흉내 위에서 돌린다 */
const bundle = [
  cutLine('const _MH_ALLOWED_TAGS'),
  cutLine('const _MH_ALLOWED_ATTRS'),
  L_POLICY,
  cutLine('const _MH_IMG_HOSTS'),
  cutFn('_mhImgSrcOk'),
  cutFn('escHtml'),
  cutFn('_mhSanitizeNode'),
  F_SANH,
  'return { _mhSanitizeHtml, _mhSanitizeNode, _MH_IMG_SRC };',
].join('\n');

/* 정책값을 바꿔치기해서 같은 sanitizer 를 다시 만들 수 있다 — 상수가 진짜로 먹는지 보려면
   기본값 'any' 만으로는 알 수 없다('any' 는 즉시 true 라 아무 일도 안 하는 것과 구분이 안 된다). */
function build(policy){
  const src = policy ? bundle.replace(L_POLICY, "const _MH_IMG_SRC = '" + policy + "';") : bundle;
  return new Function('DOMParser', 'console', 'URL', src)(
    function DOMParserStub(){ return { parseFromString(s){ return { body: parse(s) }; } }; },
    { warn(){}, log(){}, error(){} },
    URL
  );
}
let API;
try { API = build(null); }
catch (e){ say('  ✗ sanitizer 를 떼어내 실행하지 못했습니다: ' + e.message); process.exit(1); }

/* body.innerHTML 흉내: parse → sanitizer 본체 → serialize */
function cleanWith(api, html){
  const body = parse(html);
  Array.from(body.childNodes).forEach(api._mhSanitizeNode);
  return body.childNodes.map(serialize).join('');
}
const clean = html => cleanWith(API, html);

const cases = [
  /* ⚠️ src 는 **절대 URL** 로 쓴다. sanitizer 의 스킴 검사(`^https?:|mailto:`)가 원래부터
       상대 URL 을 지운다 — `src="x"` 로 쓰면 onerror 가 지워진 것인지 src 가 지워진 것인지
       구분이 안 돼서 검사가 통과해도 아무것도 증명하지 못한다. */
  ['<img src="https://a.example/x.png" onerror="alert(1)">',
                                              /^<img src="https:\/\/a\.example\/x\.png">$/,
                                                                       'IMG 의 onerror 가 지워지고 src 는 남는다'],
  ['<img src="x" onerror="alert(1)">',        /^<img>$/,                '상대 URL src 는 스킴 검사가 지운다 (기존 동작)'],
  ['<img src="javascript:alert(1)">',         /^<img>$/,                'javascript: 스킴 src 가 지워진다'],
  ['<a href="javascript:alert(1)">t</a>',     /^<a>t<\/a>$/,            'javascript: 스킴 href 가 지워진다'],
  ['<a href="https://ok.example">t</a>',      /href="https:\/\/ok\.example"/, 'http(s) href 는 남는다'],
  ['<script>alert(1)</script>',               /^alert\(1\)$/,           'SCRIPT 태그가 언래핑돼 글자만 남는다'],
  ['<iframe src="https://evil"></iframe>',    /^$/,                     'IFRAME 이 사라진다'],
  ['<b onmouseover="x">굵게</b>',              /^<b>굵게<\/b>$/,          'on* 이벤트 속성이 지워진다'],
  ['<span style="color:red">색</span>',        /style="color:red"/,      '허용 style 은 남는다'],
  ['<span style="position:fixed;top:0">x</span>', /^<span>x<\/span>$/,  '허용 목록 밖 style 은 지워진다'],
  ['<b><img src="https://a.example/x.png" onerror="y"></b>',
                                              /^<b><img src="https:\/\/a\.example\/x\.png"><\/b>$/,
                                                                       '중첩된 자식까지 재귀로 씻는다'],
  ['<div data-x="1" id="a">t</div>',          /^<div>t<\/div>$/,        '화이트리스트 밖 속성이 지워진다'],
];
cases.forEach(([input, want, label]) => {
  let out;
  try { out = clean(input); } catch (e) { out = '‼ ' + e.message; }
  chk(want.test(out), label + '   [' + out + ']');
});

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
say('· §4 라이선스 요청 이름 (관리자 화면)');
chk(/🙋 <b>\$\{_chatEsc\(/.test(SRC),
    '★ req.name 이 이스케이프를 거친다 (licenseRequests 는 .write:true 다)');

say('');
if (fail){ say('✗ ' + fail + '건 실패'); process.exit(1); }
say('✓ 통과 — 읽는 쪽 sanitize 가 걸려 있고, 속성값 보간 두 곳이 사라졌다');
