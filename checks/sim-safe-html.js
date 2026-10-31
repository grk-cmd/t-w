/* sim-safe-html.js — 🛡️ 남이 쓸 수 있는 값이 화면(HTML · 속성 · 주소 · CSS)에 «친 그대로 보이고 HTML 로는 안 읽히는가»
   실행:  node sim-safe-html.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 — 닉네임 «초마 <뚱쟁이>» · «병준이<3» · «>_<» 는 진짜 이름이다. 지우거나 거절하지 않고 그대로 보이게 하되
     마크업으로 읽히면 안 된다. 예전에는 escape 가 파일마다 따로 있었고(따옴표 ' 를 안 막는 것) 몇 곳은 날값을
     innerHTML · src 에 붙였다. 손으로 적은 파일 목록은 새 파일을 놓친다 — 그래서 전부를 파서로 훑는다.
   ・1절: shared/safe-html.js 를 실제로 불러 — 다섯 글자 왕복 · 진짜 이름이 같은 글자로 보임 · safeUrl 거절 / 허용 · cssUrl 따옴표 못 빠져나감
   ・2절: app/parts/**.js · app/*.html 의 <script> · main.js · preload.js 를 typescript 파서로 읽어
     innerHTML · outerHTML · insertAdjacentHTML 에 넣는 식, `.src` · `.href` · setAttribute(src|href) · `style.background*` 에 넣는 식,
     마크업 글자 안 src="…" · href="…" · url(…) 바로 뒤의 값을 끝(잎)까지 따라간다.
     잎이 글자 · 숫자 리터럴 / TwSafeHtml 함수(text · attr · safeUrl · cssUrl) / 그 별칭(escHtml · _chatEsc · 리치 텍스트 _mhLoadRT · _mhPurify — DOMPurify) /
     숫자를 돌려주는 것 / 같은 파일 안 상수 표 가 아니면 빨강. 예외는 아래 ALLOW 에 «이유» 와 함께만(파일|식 글자).
   ・3절: 깨 보기 — 날값을 붙인 가짜 파일 · 약한 escape · 위험한 주소가 빨강이 나는지 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };

/* 러너는 저장소 밖 임시 폴더에서 돌린다 — 저장소의 node_modules 를 찾아간다(sim-global-names.js 와 같은 길) */
let ts;
for (const d of [__dirname, path.join(__dirname, '..'), process.env.INIT_CWD, process.env.PWD, process.cwd()].filter(Boolean)) {
  try { ts = require(require.resolve('typescript', { paths: [d] })); break; } catch (_) {}
}
if (!ts) {
  if (process.env.CI) { say('  ✗ typescript 를 못 찾음 — checks.yml 의 설치 줄을 확인'); process.exit(1); }
  say('  ? 원본 못 찾음 — typescript(npm install 로 깔린다)'); process.exit(2);
}
const BASE = ['.', 'app'].map(d => path.resolve(d)).find(d => fs.existsSync(path.join(d, 'desk-companion-prototype.html')) && fs.existsSync(path.join(d, 'parts')));
if (!BASE) { say('  ? 원본 못 찾음 — desk-companion-prototype.html 과 parts/ 폴더'); process.exit(2); }
const SAFE_PATH = path.join(BASE, 'parts', 'shared', 'safe-html.js');
if (!fs.existsSync(SAFE_PATH)) { say('  ? 원본 못 찾음 — parts/shared/safe-html.js'); process.exit(2); }

/* ── 예외 — 한 번 눈으로 본 자리. «파일이름|식 글자»(공백은 한 칸으로) → 이유.
   새로 적기 전에 «이 글자가 다른 사람에게서 올 수 있는가» 를 먼저 답할 것. 올 수 있으면 적지 말고 TwSafeHtml 로 감싼다.
   ⚠️ «남은 구멍» 은 알고 남긴 자리다 — 고치면 지운다(안 쓰는 줄이 남으면 빨강). */
const ALLOW = {};
const allow = (file, reason, exprs) => exprs.forEach(e => { ALLOW[file + '|' + e] = reason; });
allow('myhome-desktop.js', '🧟 모험 시나리오 · 지도 · 전투 — 이 파일 상수 표(ADV_WORLD · 스토리 비트 · 선택지 · ADV_THEMES)의 고정 마크업을 씨앗으로 이 기기에서 만든 글. 남의 이름 · 수는 넣을 때 esc', [
  'ADV_COMBAT.log', 'ADV._campLog', 'b.cls', 'b.label', 'b.pool[Math.floor(Math.random()*b.pool.length)]', 'bd.t', 'beat.text', 'beat.text(st)', 'beat.text(stForText)',
  'branch.txt', 'branch.txt(st)', 'c.fail.txt', 'c.fail()', 'c.label', 'c.noItem()', 'c.ok()', 'c.pre()', 'c.result||[]', 'c.resultNoWeapon||c.result||[]', 'c.run()',
  'cbg', 'cc', 'cedge', 'ev.intro', 'f.bg', 'f.inner', 'gauge.label', 'gauge.meterCls', 'label', 'sceneIntro(sc)', 'sg.lv', 'sg.txt']);
allow('myhome-desktop.js', '아이템 설명 — advItemTipHtml 이 상수 표로 만든 마크업을 esc 로 data-tip 에 넣었다가 꺼낸 것', ["el.getAttribute('data-tip')"]);
allow('myhome-desktop.js', '다른 앱 모듈이 MYHOME_DESKTOP.addFolder 로 넘긴 앱 안 그림 경로(상대 경로 — safeUrl 은 상대 경로를 막는다)', ['a.iconSrc']);
allow('myhome-desktop.js', '⚠️ 남은 구멍 — 파티 방장이 보낸 진행 비트 마크업(storyHtml)을 받은 그대로 그린다. 마크업 대신 비트 id 를 보내야 고쳐진다(동작 변경 — 따로 결정)', [
  'lm.storyHtml']);
allow('weekly-challenge.js', '👑 달성표 주기 표(상수 — 요일 이름 · 주기 이름 · 기준 수) · 팝업 버튼(부르는 곳 글자) · 시간 글(formatHMS 숫자) · 보상 안내(_chalRewardLine 고정 글)', [
  '_chalCurPh().name', 'b.a', 'b.t', 'd', 'formatHMS(goal)', 'formatHMS(t.sec || 0)', 'line.t', 'ph.label', 'ph.label[0]', 'ph.label[i]', 'ph.label[idx]', 'ph.name', 'ph.need1']);
allow('fx-preview.html', '개발용 효과 미리보기 페이지 — 고정 표(FX_KINDS) · 이 페이지 슬라이더 값만', ['k', 'S.anchor', 'S.every', 'S.kind', 'S.mode', 'S.seats', 't.lab']);
allow('help-tab.js', '📘 도움말 틀 주소 — help-site.js pageUrl 이 고정 출처(HELP_ORIGIN) + 편 이름 정규식(SLUG_RE)으로 거른 값 + 앱 테마 표로만 만든다(페이지 알림의 편 이름도 readMessage 가 같은 정규식으로 거른다)', ['helpSite.pageUrl(page, _theme)']);
allow('purikura-ui.js', '📷 판 모양 고정 표(세로형 · 가로형 · 컷 수 — purikura-net.js 숫자)', ['g.cols', 'g.rows', 'hint', 'label', 'n']);
allow('purikura-ui.js', '이 기기 카메라로 찍은 사진(canvas data:)', ['d']);
allow('chat-ui.js', '다른 파일의 씻은 마크업 도우미 — overhead.js _officeDemojiHtml(씻은 글에서 아는 이모티콘만 그림) · 주사위 SVG(숫자) · _chatLinkify(씻은 글에서 주소만 a)', ['_officeDemojiHtml(html)', '_diceSvg(parseInt(n,10),26)', '_chatLinkify(t)']);
allow('overhead.js', '주사위 SVG — 1~6 숫자로 만든 고정 그림', ['_diceSvg(parseInt(n,10), 30)']);
allow('overhead.js', '회사원 모드 라벨 — _officeLabelHtml 이 이스케이프해 만든 HTML(닉네임 span)', ['text']);
allow('seat-panel.js', '다른 파일이 만든 좌석 안내 마크업(내 캐릭터 정보)', ['html']);
allow('paint-tools.js', '그리기 도구 아이콘 SVG 상수 표', ['ICON[t]']);
allow('myhome-edit.js', '👑 디자인 스튜디오 항목 표(_MH_DS_ROWS 상수)', ['row.label']);
allow('bookmark.js', '끌기 그림자 — 이미 씻어 칠한 원래 칸의 배경을 그대로 옮김', ['src.style.background']);
allow('ride-bench.js', '상호작용 책상 카탈로그(INTERACTION_DESKS)의 앱 안 그림 경로(상대 경로)', ['def.thumb']);
allow('toast.js', '부르는 곳이 넘기는 앱 안 아이콘 경로', ['iconSrc']);
allow('noise.js', '소리 노드(.src 라는 이름의 칸일 뿐 주소 아님)', ['ctx.createBufferSource()']);
allow('app.js', 'loadImg — 얼굴 · 피부 캔버스 저장본(data:) · 앱 안 그림을 그리는 공용 로더(img 는 스크립트를 안 돌린다 · 상대 경로가 있어 safeUrl 불가)', ['src']);
allow('room-sync.js', '얼굴 그림 로더 — 이 기기가 만든 data: 얼굴 · 앱 안 그림(app.js loadImg 와 같은 까닭)', ['src']);
allow('commission.js', '커미션 zip 에서 이 기기가 풀어 만든 blob: 주소', ['faceUrl', 'blinkUrl']);
allow('app.js', '수령함 공지 본문 — inboxMod.linkifyText 가 먼저 escHtml 로 씻은 글에서 주소만 a 로 감싼다(myhome-inbox.js)', ["inboxMod.linkifyText(notice.body || '')"]);
allow('mallang.js', '이 기기 사용자가 방금 고른 파일(FileReader · 파일 창)', ['dataUrl', 'inp.files[0]']);

/* ── 1절: 함수 실행 ───────────────────────────────────────────── */
say('\n── 1절: safe-html.js 실행');
const SH = require(SAFE_PATH);
chk(typeof SH.text === 'function' && typeof SH.attr === 'function' && typeof SH.safeUrl === 'function' && typeof SH.cssUrl === 'function', '내놓는 것 넷(text · attr · safeUrl · cssUrl)');
chk(Object.isFrozen(SH), '얼린 객체 — 실행 중에 바꿔 끼우지 못함');
/* 브라우저가 마크업을 읽어 보이는 글자로 바꾸는 것(엔티티 풀기)을 흉내 — text 의 결과를 이걸로 풀면 원래 글자여야 한다 */
const unent = (s) => s.replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[e]);
const FIVE = '& < > " \'';
chk(SH.text(FIVE) === '&amp; &lt; &gt; &quot; &#39;', '다섯 글자를 모두 막는다');
chk(!/[<>"']/.test(SH.text(FIVE)) && unent(SH.text(FIVE)) === FIVE, '다섯 글자 왕복 — 풀면 친 그대로');
for (const name of ['초마 <뚱쟁이>', '병준이<3', '>_<', 'a&b "c" \'d\'']) {
  chk(unent(SH.text(name)) === name && !/[<>]/.test(SH.text(name)), `진짜 이름 «${name}» — 지우지 않고 같은 글자로 보임 · 태그로 안 읽힘`);
}
chk(SH.text('&amp;') === '&amp;amp;', '이미 엔티티처럼 보이는 글도 친 그대로 보이게(한 번 더 막음)');
chk(SH.text(null) === '' && SH.text(undefined) === '' && SH.text(0) === '0' && SH.text(12) === '12', '없음은 빈 글 · 숫자 0 은 «0»');
chk(SH.text('') === '' && SH.attr('') === '', '빈 글은 빈 글');
chk(SH.attr('a\u0000b\u0007c\u007fd') === 'abcd', 'attr — 보이지 않는 제어 글자를 뺀다');
chk(SH.attr('줄1\n줄2\t탭') === '줄1\n줄2\t탭', 'attr — 줄바꿈 · 탭은 남긴다(title 여러 줄)');
chk(SH.attr('x" onmouseover="y') === 'x&quot; onmouseover=&quot;y', 'attr — 따옴표로 속성을 못 빠져나간다');
chk(SH.attr("x' onclick='y").indexOf("'") < 0, "attr — 작은따옴표로도 못 빠져나간다");

const BAD_URLS = ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', '\tjavascript:alert(1)', ' javascript:alert(1)', 'java\tscript:alert(1)', 'vbscript:msgbox(1)',
  'file:///C:/Windows/win.ini', 'data:text/html,<script>alert(1)</script>', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png,notbase64<', '//evil.example/x.png',
  '/etc/passwd', 'emoji/x.png', 'blob:https://x/y', 'ftp://x/y', '', '   ', null, undefined, 12, {}];
for (const k of ['image', 'link']) {
  const leaked = BAD_URLS.filter(u => SH.safeUrl(u, k) !== '');
  chk(!leaked.length, `safeUrl(${k}) — 위험 · 상대 주소 ${BAD_URLS.length}개 모두 ''` + (leaked.length ? ' — 샘: ' + leaked.map(String).join(' · ') : ''));
}
chk(SH.safeUrl('https://firebasestorage.googleapis.com/v0/b/x/o/a.png?alt=media', 'image') === 'https://firebasestorage.googleapis.com/v0/b/x/o/a.png?alt=media', 'image — https 는 그대로(호스트는 아직 안 좁힘)');
const PNG = 'data:image/png;base64,iVBORw0KGgo=';
chk(SH.safeUrl(PNG, 'image') === PNG, 'image — data:image/png base64 는 그대로');
chk(['jpeg', 'webp', 'gif'].every(t => SH.safeUrl('data:image/' + t + ';base64,AAAA', 'image') !== ''), 'image — jpeg · webp · gif 도');
chk(SH.safeUrl('http://x.example/a.png', 'image') === '', 'image — http 는 안 받음');
chk(SH.safeUrl(PNG, 'link') === '', 'link — data: 는 안 받음');
chk(SH.safeUrl('http://x.example/a', 'link') === 'http://x.example/a' && SH.safeUrl('https://x.example/a?b=1#c', 'link') === 'https://x.example/a?b=1#c', 'link — http · https 는 받음');
chk(SH.safeUrl('  https://x.example/a  ', 'link') === 'https://x.example/a', 'link — 앞뒤 공백은 떼고 받음(붙여 넣은 링크)');
chk(SH.safeUrl('https://x.example/' + 'a'.repeat(2048), 'link') === '', 'link — 길이 상한을 넘으면 거절');
chk(SH.safeUrl('https://x.example/' + 'a'.repeat(2000), 'link') !== '', 'link — 상한 안이면 받음(경계)');
chk(SH.safeUrl('https://x.example/a', 'other') === '', '모르는 kind 는 거절');
chk(!/["<>\s]/.test(SH.safeUrl('https://x.example/a"b<c>d e', 'image')), 'https 결과에 따옴표 · 꺾쇠 · 공백이 남지 않는다(정규화)');
chk(SH.cssUrl(PNG) === 'url("' + PNG + '")', 'cssUrl — url("…") 통째로');
chk(SH.cssUrl('javascript:alert(1)') === '' && SH.cssUrl('//evil/x') === '' && SH.cssUrl(null) === '', 'cssUrl — 허용 안 되면 빈 글');
for (const u of ['https://x.example/a")%3Bbackground:red', 'https://x.example/a\\"),url(https://evil', 'https://x.example/a\n")']) {
  const c = SH.cssUrl(u);
  const inner = c.slice(5, -2);
  chk(c.startsWith('url("') && c.endsWith('")') && !/(^|[^\\])"/.test(inner) && !/[\n\r]/.test(inner), `cssUrl — 따옴표 · 역슬래시 · 줄바꿈으로 못 빠져나감 (${JSON.stringify(u).slice(0, 40)})`);
}

/* linkify — 글 속 주소만 누를 칸으로, 나머지는 text 로 */
const L = (x) => SH.linkify(x);
const linkOf = (h) => (h.match(/data-url="([^"]*)"/g) || []).map(x => x.slice(10, -1));
chk(L('안녕 <b>') === '안녕 &lt;b&gt;' && L(null) === '' && L('') === '', 'linkify — 주소가 없으면 text 와 같다(빈 값 · null 포함)');
chk(L('보세요 https://x.example/a?b=1&c=2') === '보세요 <span class="ext-link" data-url="https://x.example/a?b=1&amp;c=2">https://x.example/a?b=1&amp;c=2</span>', 'linkify — 주소를 ext-link 칸으로(& 는 씻는다)');
chk(L('여기 https://x.example/a. 그리고') === '여기 <span class="ext-link" data-url="https://x.example/a">https://x.example/a</span>. 그리고', '  문장 끝 마침표는 주소에서 뺀다');
chk(L('(https://x.example/a)') === '(<span class="ext-link" data-url="https://x.example/a">https://x.example/a</span>)', '  괄호 안 주소 — 닫는 괄호는 글로');
chk(linkOf(L('http://a.example/1 그리고 https://b.example/2')).join() === 'http://a.example/1,https://b.example/2', '  여러 개 · http 도');
chk(L('javascript:alert(1) ftp://x.example/a //evil.example') === SH.text('javascript:alert(1) ftp://x.example/a //evil.example'), '  http(s) 가 아닌 주소는 글 그대로(칸 안 만듦)');
const evil = L('https://x.example/"onmouseover="alert(1) <img src=x onerror=alert(1)>');
chk(evil === '<span class="ext-link" data-url="https://x.example/">https://x.example/</span>&quot;onmouseover=&quot;alert(1) &lt;img src=x onerror=alert(1)&gt;', '  따옴표 · 꺾쇠에서 주소가 끝나고 나머지는 글 — 칸 밖으로 못 빠져나간다');
chk(!/<(?!\/?span\b)/.test(evil) && (evil.match(/<span /g) || []).length === 1, '  만든 태그는 ext-link span 하나뿐');
chk(L('https://x.example/' + 'a'.repeat(2100)) === SH.text('https://x.example/' + 'a'.repeat(2100)), '  길이 상한을 넘는 주소는 글 그대로');

/* ── 2절: 파서로 전부 훑기 ───────────────────────────────────── */
const HTML_SAFE_FN = /^(?:(?:window\.)?(?:TwSafeHtml|safeHtml)\.(?:text|attr|cssColor|safeUrl|cssUrl|linkify)|(?:deps\.)?(?:escHtml|_chatEsc)|(?:richTextMod\.)?(?:_mhLoadRT|_mhSanitizeHtml|_mhPurify)|encodeURIComponent)$/;
const URL_SAFE_FN = /^(?:(?:window\.)?(?:TwSafeHtml|safeHtml)\.safeUrl|URL\.createObjectURL|encodeURIComponent|[\w$.]*\.toDataURL)$/;
const CSS_SAFE_FN = /^(?:window\.)?(?:TwSafeHtml|safeHtml)\.(?:cssUrl|cssColor)$/;
const NUM_FN = /^(?:Number|parseInt|parseFloat|Math\.\w+|Date\.now|[\w$.\[\]()]*\.(?:toFixed|toLocaleString|getTime|getFullYear|getMonth|getDate|getDay|getHours|getMinutes|getSeconds|indexOf|lastIndexOf|charCodeAt|findIndex))$/;
/* 이 기기 사용자가 방금 고른 파일(FileReader · 파일 고르기 창)의 data: 주소 — 남이 넣을 수 없는 값. 주소 자리에서만 */
const OWN_FILE_URL = /^(?:\w+\.target\.result|fr\.result|reader\.result|await companion\.pickImage\(\))$/;
const UPPER = /^_?[A-Z][A-Z0-9_]{2,}$/;
const PASS_METHODS = new Set(['trim', 'trimStart', 'trimEnd', 'toLowerCase', 'toUpperCase', 'slice', 'substring', 'substr', 'padStart', 'padEnd', 'normalize', 'toString']);
/* 앞 글자가 이것으로 끝나면 다음 값은 «주소 자리» — 씻기(text)로는 모자라고 safeUrl 이어야 한다 */
const URL_ATTR_TAIL = /(?:\s(?:src|href|action|formaction|poster|background)\s*=\s*["']?|url\(\s*["']?)$/i;

function collapse(s) { return s.replace(/\s+/g, ' ').trim(); }

/* 한 파일을 읽어 빨강 자리 [{ line, kind, expr }] 를 돌려준다 */
function scanSource(fileName, text) {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const out = [];
  const isFn = (n) => ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n) || ts.isGetAccessor(n) || ts.isSetAccessor(n) || ts.isConstructorDeclaration(n);
  const scopeOf = (n) => { let p = n.parent; while (p && !(isFn(p) || p === sf)) p = p.parent; return p || sf; };
  const lineOf = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  let sinkLine = 0;
  const report = (n, kind) => out.push({ line: lineOf(n), sink: sinkLine, kind, expr: collapse(n.getText(sf)) });

  /* 이름 → 선언(함수 범위 따라 바깥으로). 같은 범위 안의 블록은 가리지 않는다(근사 — 같은 이름이 둘이면 둘 다 본다) */
  const declCache = new Map();
  function declsIn(scope, name) {
    const key = scope.pos + ':' + scope.end + ':' + name;
    if (declCache.has(key)) return declCache.get(key);
    const r = [];
    if (scope !== sf && scope.parameters) scope.parameters.forEach(p => { if (ts.isIdentifier(p.name) && p.name.text === name) r.push({ param: p, fn: scope }); });
    (function walk(n) {
      if (n !== scope && isFn(n)) { if (ts.isFunctionDeclaration(n) && n.name && n.name.text === name) r.push({ fnDecl: n }); return; }
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name) r.push({ varDecl: n });
      if (ts.isVariableDeclaration(n) && !ts.isIdentifier(n.name)) (function b(x) { if (ts.isIdentifier(x)) { if (x.text === name) r.push({ opaque: n }); } else if (x.elements) x.elements.forEach(e => e.name && b(e.name)); })(n.name);
      if (ts.isCatchClause(n) && n.variableDeclaration && ts.isIdentifier(n.variableDeclaration.name) && n.variableDeclaration.name.text === name) r.push({ opaque: n });
      ts.forEachChild(n, walk);
    })(scope);
    declCache.set(key, r);
    return r;
  }
  function resolve(id) {
    let s = scopeOf(id);
    while (true) {
      const r = declsIn(s, id.text);
      if (r.length) return { scope: s, decls: r };
      if (s === sf) return null;
      s = scopeOf(s);
    }
  }
  /* 그 이름에 다시 넣는 곳(= · +=) — 선언 범위 안 전부(안쪽 함수 포함 · 같은 이름을 새로 선언한 안쪽 범위는 근사로 같이) */
  function assignsTo(scope, name) {
    const r = [];
    (function walk(n) {
      if (ts.isBinaryExpression(n) && ts.isIdentifier(n.left) && n.left.text === name && (n.operatorToken.kind === ts.SyntaxKind.EqualsToken || n.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken || n.operatorToken.kind === ts.SyntaxKind.QuestionQuestionEqualsToken || n.operatorToken.kind === ts.SyntaxKind.BarBarEqualsToken)) r.push(n.right);
      ts.forEachChild(n, walk);
    })(scope);
    return r;
  }
  function pushesTo(scope, name) {
    const r = [];
    (function walk(n) {
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && ['push', 'unshift'].includes(n.expression.name.text) && ts.isIdentifier(n.expression.expression) && n.expression.expression.text === name) r.push(...n.arguments);
      ts.forEachChild(n, walk);
    })(scope);
    return r;
  }
  /* 리터럴로만 된 객체 · 배열(상수 표) */
  function deepLiteral(n) {
    while (ts.isParenthesizedExpression(n)) n = n.expression;
    if (ts.isCallExpression(n) && /^Object\.freeze$/.test(n.expression.getText(sf)) && n.arguments[0]) return deepLiteral(n.arguments[0]);
    if (ts.isStringLiteral(n) || ts.isNumericLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || n.kind === ts.SyntaxKind.TrueKeyword || n.kind === ts.SyntaxKind.FalseKeyword || n.kind === ts.SyntaxKind.NullKeyword) return true;
    if (ts.isPrefixUnaryExpression(n) && ts.isNumericLiteral(n.operand)) return true;
    if (ts.isArrayLiteralExpression(n)) return n.elements.every(deepLiteral);
    if (ts.isObjectLiteralExpression(n)) return n.properties.every(p => ts.isPropertyAssignment(p) && deepLiteral(p.initializer));
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) return deepLiteral(n.left) && deepLiteral(n.right);
    return false;
  }
  /* 그 이름 아래에 값을 넣는 곳이 있는가(a.b = · a[k] = · a.push( …) — 없으면 실행 중에 안 바뀌는 표 */
  const mutCache = new Map();
  function mutated(scope, name) {
    const key = scope.pos + ':' + name;
    if (mutCache.has(key)) return mutCache.get(key);
    let hit = false;
    const rootName = (x) => { while (ts.isPropertyAccessExpression(x) || ts.isElementAccessExpression(x) || ts.isParenthesizedExpression(x)) x = x.expression; return ts.isIdentifier(x) ? x.text : null; };
    (function walk(n) {
      if (hit) return;
      if (ts.isBinaryExpression(n) && n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && n.operatorToken.kind <= ts.SyntaxKind.LastAssignment && !ts.isIdentifier(n.left) && rootName(n.left) === name) hit = true;
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && ['push', 'unshift', 'splice', 'assign'].includes(n.expression.name.text)) {
        if (rootName(n.expression.expression) === name) hit = true;
        if (n.expression.name.text === 'assign' && n.arguments[0] && rootName(n.arguments[0]) === name) hit = true;
      }
      ts.forEachChild(n, walk);
    })(scope);
    mutCache.set(key, hit);
    return hit;
  }
  /* 상수 표에서 꺼낸 값인가 — a.b[c].d 의 뿌리가 ① 같은 파일의 const 리터럴 표(안 바뀜) ② 그런 값을 받은 const
     ③ 다른 파일 · 모듈의 대문자 상수(이름 규칙: xMod.DEMOJI_DIR · ChatTabs.NAME_MAX · UI_ICON[k]) */
  function isConstRef(n, depth) {
    depth = depth || 0;
    if (depth > 6) return false;
    while (ts.isParenthesizedExpression(n)) n = n.expression;
    if (deepLiteral(n)) return true;
    if (ts.isBinaryExpression(n) && (n.operatorToken.kind === ts.SyntaxKind.BarBarToken || n.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)) return isConstRef(n.left, depth + 1) && isConstRef(n.right, depth + 1);
    if (ts.isConditionalExpression(n)) return isConstRef(n.whenTrue, depth + 1) && isConstRef(n.whenFalse, depth + 1);
    const segs = [];
    let r = n;
    while (ts.isPropertyAccessExpression(r) || ts.isElementAccessExpression(r) || ts.isParenthesizedExpression(r) || (ts.isCallExpression(r) && r.arguments.length === 0 && segs.length)) {
      if (ts.isPropertyAccessExpression(r)) segs.unshift(r.name.text);
      r = r.expression;
    }
    if (ts.isCallExpression(r) && r.arguments.length === 0) r = r.expression;   // chatUiMod().DEMOJI_DIR
    if ((ts.isObjectLiteralExpression(r) || ts.isArrayLiteralExpression(r)) && deepLiteral(r)) return true;   // {a:'Ⓐ'}[k]
    if (!ts.isIdentifier(r)) return false;
    if (segs.length && UPPER.test(segs[0]) && !resolveConst(r)) return true;   // 모듈의 대문자 상수
    const res = resolve(r);
    if (!res) return UPPER.test(r.text);
    if (!res.decls.length || !res.decls.every(d => d.varDecl && d.varDecl.initializer && (d.varDecl.parent.flags & ts.NodeFlags.Const))) return false;
    if (mutated(res.scope, r.text)) return false;
    return res.decls.every(d => {
      const init = d.varDecl.initializer;
      if (deepLiteral(init)) return true;
      if (UPPER.test(r.text) && (ts.isObjectLiteralExpression(init) || ts.isArrayLiteralExpression(init))) return true;   // 대문자 표 — 안 바뀌면 상수
      return init !== n && isConstRef(init, depth + 1);
    });
  }
  function resolveConst(id) { const res = resolve(id); return !!res && res.decls.some(d => d.varDecl && d.varDecl.initializer && deepLiteral(d.varDecl.initializer)); }
  const rootIsConstTable = (n) => isConstRef(n, 0);
  const isLit = (n) => ts.isStringLiteral(n) || ts.isNumericLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || n.kind === ts.SyntaxKind.TrueKeyword || n.kind === ts.SyntaxKind.FalseKeyword || n.kind === ts.SyntaxKind.NullKeyword || n.kind === ts.SyntaxKind.UndefinedKeyword || n.kind === ts.SyntaxKind.RegularExpressionLiteral;
  /* 이어 붙임(+ · 템플릿)을 조각으로 — 앞 글자에 따라 다음 조각의 자리(주소 자리)가 정해진다 */
  function pieces(n, acc) {
    while (ts.isParenthesizedExpression(n)) n = n.expression;
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) { pieces(n.left, acc); pieces(n.right, acc); return acc; }
    if (ts.isTemplateExpression(n)) { acc.push({ lit: n.head.text }); n.templateSpans.forEach(s => { acc.push({ expr: s.expression }); acc.push({ lit: s.literal.text }); }); return acc; }
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) { acc.push({ lit: n.text }); return acc; }
    acc.push({ expr: n });
    return acc;
  }
  const MAX_DEPTH = 14;
  /* mode: 'html'(마크업) · 'url'(주소 첫머리) · 'css'(배경 값 첫머리) · 'plain'(무엇이든 됨) */
  function check(n, env) {
    if (!n || env.mode === 'plain') return;
    if (env.depth > MAX_DEPTH) return report(n, env.mode);
    while (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isNonNullExpression(n)) n = n.expression;
    if (isLit(n)) return;
    if ((ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) || ts.isTemplateExpression(n)) {
      let tail = env.tail;
      let started = env.started;
      let afterUrlExpr = false;   // 주소 자리 첫 값 바로 뒤에 붙은 값(글자 없이) — 길 조각이라 씻기만 하면 된다
      for (const p of pieces(n, [])) {
        if (p.lit != null) { tail = (tail + p.lit).slice(-80); if (p.lit) { started = true; afterUrlExpr = false; } continue; }
        let mode = env.mode;
        if (mode === 'html' && URL_ATTR_TAIL.test(tail) && !afterUrlExpr) { mode = 'url'; afterUrlExpr = true; }
        else if (mode === 'html' && afterUrlExpr) mode = 'html';
        else if (mode === 'css') mode = /url\(\s*["']?$/i.test(tail) ? 'url' : (started ? 'plain' : 'css');
        else if (mode === 'url') mode = started ? 'plain' : 'url';   // 앞 글자가 주소 첫머리를 정했으면 뒤는 길 조각일 뿐
        check(p.expr, { ...env, mode, tail, started: false });
        started = true;
      }
      return;
    }
    if (ts.isBinaryExpression(n)) {
      const k = n.operatorToken.kind;
      if (k === ts.SyntaxKind.AmpersandAmpersandToken) return check(n.right, env);   // a && b — a 가 나오는 건 거짓 값(빈 글 · 0 · null)일 때뿐
      if (k === ts.SyntaxKind.BarBarToken || k === ts.SyntaxKind.QuestionQuestionToken) { check(n.left, env); check(n.right, env); return; }
      if (k === ts.SyntaxKind.CommaToken) return check(n.right, env);
      if (k === ts.SyntaxKind.EqualsToken) return check(n.right, env);
      return;   // 셈 · 비교 — 숫자나 참거짓
    }
    if (ts.isConditionalExpression(n)) { check(n.whenTrue, env); check(n.whenFalse, env); return; }
    if (ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n) || ts.isTypeOfExpression(n) || ts.isVoidExpression(n) || ts.isDeleteExpression(n)) return;
    if (ts.isIdentifier(n)) return checkIdent(n, env);
    if (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) {
      if (ts.isPropertyAccessExpression(n) && n.name.text === 'length') return;
      if (rootIsConstTable(n)) return;
      if (ts.isElementAccessExpression(n) && ts.isIdentifier(n.expression) && isArrayVar(n.expression)) return checkItems(n.expression, env);   // 배열 칸
      if (env.mode === 'url' && OWN_FILE_URL.test(collapse(n.getText(sf)))) return;
      return report(n, env.mode);
    }
    if (ts.isCallExpression(n)) return checkCall(n, env);
    if (ts.isAwaitExpression(n)) { if (env.mode === 'url' && OWN_FILE_URL.test(collapse(n.getText(sf)))) return; return report(n, env.mode); }
    return report(n, env.mode);
  }
  /* 배열 메서드 콜백의 둘째 매개변수(첨자) */
  function isIndexParam(p) {
    const fn = p.parent;
    if (!fn || fn.parameters.indexOf(p) !== 1) return false;
    const call = fn.parent;
    return !!call && ts.isCallExpression(call) && call.arguments[0] === fn && ts.isPropertyAccessExpression(call.expression) && ['forEach', 'map', 'filter', 'some', 'every', 'findIndex', 'find', 'flatMap'].includes(call.expression.name.text);
  }
  function elemParamRecv(p) {
    const fn = p.parent;
    if (!fn || !fn.parameters || fn.parameters.indexOf(p) !== 0) return null;
    const call = fn.parent;
    if (!call || !ts.isCallExpression(call) || call.arguments[0] !== fn || !ts.isPropertyAccessExpression(call.expression)) return null;
    return ['forEach', 'map', 'filter', 'some', 'every', 'find', 'flatMap'].includes(call.expression.name.text) ? call.expression.expression : null;
  }
  function isArrayVar(id) {
    const res = resolve(id);
    return !!res && res.decls.length > 0 && res.decls.every(d => d.varDecl && d.varDecl.initializer && ts.isArrayLiteralExpression(d.varDecl.initializer));
  }
  /* 매개변수가 이름 있는 함수(function f · const f = (…) =>)의 것이면, 이 파일에서 그 함수를 부르는 곳의 인자를 따라간다.
     함수를 값으로 넘기는 곳(콜백 · window 에 걸기)이 있으면 모르는 곳에서 불릴 수 있어 빨강 */
  function checkCallers(d, id, env) {
    const fn = d.fn;
    let nameNode = null;
    if (ts.isFunctionDeclaration(fn) && fn.name) nameNode = fn.name;
    else if ((ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) && fn.parent && ts.isVariableDeclaration(fn.parent) && ts.isIdentifier(fn.parent.name)) nameNode = fn.parent.name;
    if (!nameNode) return false;
    const idx = fn.parameters.indexOf(d.param);
    const key = 'c:' + fn.pos + ':' + idx + ':' + env.mode;
    if (env.seen.has(key)) return true;
    env.seen.add(key);
    const calls = [];
    let escaped = false;
    (function walk(n) {
      if (escaped) return;
      const pp = n.parent;
      const isName = pp && (((ts.isPropertyAssignment(pp) || ts.isPropertyAccessExpression(pp) || ts.isMethodDeclaration(pp) || ts.isVariableDeclaration(pp) || ts.isParameter(pp) || ts.isBindingElement(pp) || ts.isFunctionDeclaration(pp)) && pp.name === n));
      if (ts.isIdentifier(n) && n.text === nameNode.text && n !== nameNode && !isName) {
        const r = resolve(n);
        const same = r && r.decls.some(x => x.fnDecl === fn || (x.varDecl && x.varDecl.initializer === fn));
        if (same) {
          if (n.parent && ts.isCallExpression(n.parent) && n.parent.expression === n) calls.push(n.parent);
          else if (!(n.parent && ts.isTypeOfExpression(n.parent))) escaped = true;
        }
      }
      ts.forEachChild(n, walk);
    })(sf);
    if (escaped || !calls.length) return false;
    for (const c of calls) {
      const a = c.arguments[idx];
      if (!a) { if (d.param.initializer) check(d.param.initializer, { ...env, depth: env.depth + 1 }); continue; }
      if (ts.isSpreadElement(a)) return false;
      check(a, { ...env, bind: null, depth: env.depth + 1 });
    }
    return true;
  }
  function checkIdent(id, env) {
    if (id.text === 'undefined' || id.text === 'NaN' || id.text === 'Infinity') return;
    const res = resolve(id);
    if (!res) { if (UPPER.test(id.text)) return; return report(id, env.mode); }   // 다른 파일의 대문자 상수
    for (const d of res.decls) {
      if (d.param) {
        const b = env.bind ? env.bind.get(d.param) : undefined;
        if (b === undefined) {
          if (isIndexParam(d.param)) continue;                 // forEach((x, i) => …) 의 i — 숫자
          const er = elemParamRecv(d.param);
          if (er && isConstRef(er)) continue;                  // 상수 표.forEach(row => …) 의 row
          if (checkCallers(d, id, env)) continue;              // 이름 있는 함수 — 이 파일에서 부르는 곳의 인자를 본다
          return report(id, env.mode);
        }
        if (b.sub) { check(b.sub, { ...b.env, mode: env.mode, tail: env.tail, started: env.started, depth: env.depth + 1 }); continue; }
        if (b.elemOf) { if (rootIsConstTable(b.elemOf) || (ts.isArrayLiteralExpression(b.elemOf) && deepLiteral(b.elemOf))) continue; return report(id, env.mode); }
        if (b.expr === null) continue;   // 넘기지 않은 인자 — undefined
        check(b.expr, { ...b.env, mode: env.mode, tail: env.tail, started: env.started, depth: env.depth + 1 });
        continue;
      }
      if (d.varDecl) {
        const key = 'v:' + d.varDecl.pos + ':' + env.mode;
        if (env.seen.has(key)) continue;
        env.seen.add(key);
        const fo = d.varDecl.parent && d.varDecl.parent.parent;
        if (fo && (ts.isForOfStatement(fo) || ts.isForInStatement(fo))) {
          if (rootIsConstTable(fo.expression) || (ts.isArrayLiteralExpression(fo.expression) && deepLiteral(fo.expression))) continue;
          return report(id, env.mode);
        }
        if (d.varDecl.initializer) check(d.varDecl.initializer, env);
        for (const r of assignsTo(res.scope, id.text)) check(r, env);
        continue;
      }
      return report(id, env.mode);
    }
  }
  /* 함수 몸 — return 식을 인자를 매개변수에 묶어서 따라간다 */
  function checkReturns(fn, args, env, callEnv) {
    const bind = new Map(env.bind || []);
    (fn.parameters || []).forEach((p, i) => {
      if (args === 'opaque') return;
      if (args && args.sub) { bind.set(p, { sub: args.sub, env: callEnv }); return; }
      if (args && args.elemOf) { if (i === 0) bind.set(p, { elemOf: args.elemOf }); else bind.set(p, { expr: null, env: callEnv }); return; }
      const a = args ? args[i] : undefined;
      if (a) bind.set(p, { expr: a, env: callEnv });
      else if (p.initializer) bind.set(p, { expr: p.initializer, env: callEnv });
      else bind.set(p, { expr: null, env: callEnv });
    });
    const sub = { ...env, bind, depth: env.depth + 1 };
    if (fn.body && !ts.isBlock(fn.body)) return check(fn.body, sub);
    (function r(m) {
      if (m !== fn && isFn(m)) return;
      if (ts.isReturnStatement(m) && m.expression) check(m.expression, sub);
      ts.forEachChild(m, r);
    })(fn.body || fn);
  }
  function fnOf(id) {
    const res = resolve(id);
    if (!res || res.decls.length !== 1) return null;
    const d = res.decls[0];
    if (d.fnDecl) return d.fnDecl;
    if (d.varDecl && d.varDecl.initializer && (ts.isArrowFunction(d.varDecl.initializer) || ts.isFunctionExpression(d.varDecl.initializer))) return d.varDecl.initializer;
    return null;
  }
  /* 별칭 — const esc = deps.escHtml · const safeHtml = TwSafeHtml 같은 것 */
  function aliasText(id) {
    const res = resolve(id);
    if (!res || res.decls.length !== 1 || !res.decls[0].varDecl || !res.decls[0].varDecl.initializer) return null;
    if (assignsTo(res.scope, id.text).length) return null;
    return collapse(res.decls[0].varDecl.initializer.getText(sf));
  }
  /* 부르는 이름 — 글자 그대로와 별칭을 푼 것 둘 다(const esc = deps.escHtml · const d = new Date(t) 의 d.getHours) */
  function calleeText(c) {
    const t = collapse(c.getText(sf));
    if (ts.isIdentifier(c)) { const a = aliasText(c); if (a) return [t, a]; }
    if (ts.isPropertyAccessExpression(c) && ts.isIdentifier(c.expression)) { const a = aliasText(c.expression); if (a) return [t, a + '.' + c.name.text]; }
    return [t];
  }
  function isSafeCall(cts, mode) {
    return cts.some(ct => {
      if (NUM_FN.test(ct)) return true;
      if (mode === 'html') return HTML_SAFE_FN.test(ct);
      if (mode === 'url') return URL_SAFE_FN.test(ct);
      if (mode === 'css') return CSS_SAFE_FN.test(ct);
      return false;
    });
  }
  function checkCall(n, env) {
    const c = n.expression;
    const ct = calleeText(c);
    if (isSafeCall(ct, env.mode)) return;
    if (ct[0] === 'String' && n.arguments[0]) return check(n.arguments[0], env);   // String(x) 은 x 그대로
    if (ts.isPropertyAccessExpression(c) && c.name.text === 'reduce' && n.arguments[1] && ts.isNumericLiteral(n.arguments[1])) return;   // 숫자로 시작한 합
    /* 마크업 자리에 주소를 넣을 때 text/attr(safeUrl(x)) 도 된다 */
    if (env.mode === 'url' && ct.some(x => HTML_SAFE_FN.test(x)) && n.arguments[0]) return check(n.arguments[0], env);   // text(x) 는 스킴을 안 바꾼다 — x 가 주소로 안전해야
    if (ts.isPropertyAccessExpression(c)) {
      const m = c.name.text, recv = c.expression;
      if (PASS_METHODS.has(m)) return check(recv, env);
      if (m === 'repeat') return check(recv, env);
      if (m === 'concat') { check(recv, env); n.arguments.forEach(a => check(a, env)); return; }
      if (m === 'replace' || m === 'replaceAll') {
        check(recv, env);
        const rep = n.arguments[1];
        if (!rep) return;
        if (isFn(rep)) return checkReturns(rep, { sub: recv }, env, env);   // 바꾸는 함수의 인자는 받는 글자의 조각
        return check(rep, env);
      }
      if (m === 'join' || m === 'map') {
        if (m === 'join' && n.arguments[0]) check(n.arguments[0], env);
        return checkItems(m === 'join' ? recv : n, env);
      }
    }
    if (ts.isIdentifier(c)) {
      const fn = fnOf(c);
      if (fn) {
        const key = 'f:' + fn.pos + ':' + n.pos + ':' + env.mode;
        if (env.seen.has(key)) return;
        env.seen.add(key);
        return checkReturns(fn, n.arguments, env, env);
      }
    }
    return report(n, env.mode);
  }
  /* 배열의 칸 — .map(fn) 의 돌려준 값 · 배열 리터럴 · push 로 넣은 값 · filter/slice 는 원래 배열 */
  function checkItems(arr, env) {
    while (ts.isParenthesizedExpression(arr)) arr = arr.expression;
    if (ts.isArrayLiteralExpression(arr)) { arr.elements.forEach(e => check(ts.isSpreadElement(e) ? e.expression : e, env)); return; }
    if (ts.isCallExpression(arr) && ts.isPropertyAccessExpression(arr.expression)) {
      const m = arr.expression.name.text, recv = arr.expression.expression;
      if (m === 'map' && arr.arguments[0]) {
        const f = arr.arguments[0];
        if (isFn(f)) return checkReturns(f, { elemOf: recv }, env, env);
        if (ts.isIdentifier(f)) { const fn = fnOf(f); if (fn) return checkReturns(fn, { elemOf: recv }, env, env); }
        return report(arr, env.mode);
      }
      if (['filter', 'slice', 'reverse', 'sort', 'concat'].includes(m)) return checkItems(recv, env);
    }
    if (ts.isIdentifier(arr)) {
      const res = resolve(arr);
      if (!res) return report(arr, env.mode);
      const key = 'a:' + arr.text + ':' + res.scope.pos + ':' + env.mode;
      if (env.seen.has(key)) return;
      env.seen.add(key);
      if (rootIsConstTable(arr)) return;
      for (const d of res.decls) {
        if (!d.varDecl) return report(arr, env.mode);
        if (d.varDecl.initializer) checkItems(d.varDecl.initializer, env);
      }
      for (const r of assignsTo(res.scope, arr.text)) checkItems(r, env);
      for (const a of pushesTo(res.scope, arr.text)) check(a, env);
      return;
    }
    return report(arr, env.mode);
  }
  const start = (mode) => ({ mode, tail: '', started: false, depth: 0, seen: new Set(), bind: null });
  (function visit(n) {
    if (ts.isBinaryExpression(n) || ts.isCallExpression(n)) sinkLine = lineOf(n);
    if (ts.isBinaryExpression(n) && (n.operatorToken.kind === ts.SyntaxKind.EqualsToken || n.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken)) {
      const L = n.left;
      const prop = ts.isPropertyAccessExpression(L) ? L.name.text : (ts.isElementAccessExpression(L) && ts.isStringLiteral(L.argumentExpression) ? L.argumentExpression.text : null);
      if (prop === 'innerHTML' || prop === 'outerHTML') check(n.right, start('html'));
      else if ((prop === 'src' || prop === 'href') && n.operatorToken.kind === ts.SyntaxKind.EqualsToken) check(n.right, start('url'));
      else if (/^background(?:Image)?$/.test(prop || '') && ts.isPropertyAccessExpression(L) && ts.isPropertyAccessExpression(L.expression) && L.expression.name.text === 'style') check(n.right, start('css'));
    }
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const m = n.expression.name.text;
      if (m === 'insertAdjacentHTML') check(n.arguments[1], start('html'));
      if (m === 'setAttribute' && n.arguments[0] && ts.isStringLiteral(n.arguments[0]) && /^(?:src|href)$/i.test(n.arguments[0].text)) check(n.arguments[1], start('url'));
      if (m === 'setProperty' && n.arguments[0] && ts.isStringLiteral(n.arguments[0]) && /^background(?:-image)?$/.test(n.arguments[0].text) && ts.isPropertyAccessExpression(n.expression.expression) && n.expression.expression.name.text === 'style') check(n.arguments[1], start('css'));
    }
    ts.forEachChild(n, visit);
  })(sf);
  /* 같은 자리를 여러 길로 만나면 한 번만 */
  const uniq = new Map();
  for (const h of out) uniq.set(h.line + '|' + h.sink + '|' + h.kind + '|' + h.expr, h);
  return [...uniq.values()];
}

/* ── 다른 escape 를 새로 만들지 않았는가 — & · < 를 엔티티로 바꾸는 replace 가 safe-html.js 밖에 있으면 빨강 ── */
function homeMadeEscapes(fileName, text) {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const hits = [];
  (function visit(n) {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && /^replace(All)?$/.test(n.expression.name.text) && n.arguments.length >= 2) {
      const a0 = n.arguments[0], a1 = n.arguments[1];
      /* 찾는 글이 맨 < 나 & 를 잡고(정규식을 실제로 돌려 본다), 바꾸는 쪽이 엔티티를 만든다 = 집에서 만든 escape */
      let catches = false;
      if (ts.isRegularExpressionLiteral(a0)) {
        const m = a0.text.match(/^\/([\s\S]*)\/([a-z]*)$/);
        try { const re = new RegExp(m[1], m[2].replace('g', '')); catches = re.test('<') || re.test('&'); } catch (_) {}
      } else if (ts.isStringLiteral(a0)) catches = a0.text === '<' || a0.text === '&';
      if (catches && /&(?:lt|amp|#60|#x3c);/i.test(a1.getText(sf))) hits.push({ line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, expr: collapse(n.getText(sf)).slice(0, 90) });
      else if (catches && ts.isIdentifier(a1)) {   // .replace(/[&<>]/g, c => MAP[c]) 의 MAP 을 이름으로 넘긴 꼴
        const t = text.slice(Math.max(0, n.getStart(sf) - 400), n.getStart(sf));
        if (new RegExp(a1.text + '\\s*=\\s*\\{[^}]*&(?:lt|amp);').test(t)) hits.push({ line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, expr: collapse(n.getText(sf)).slice(0, 90) });
      }
    }
    ts.forEachChild(n, visit);
  })(sf);
  return hits;
}
/* 엔티티를 «푸는» 쪽(&lt; → <)이나 마크업이 아닌 글(정규식 · 파일 형식)을 만드는 자리 — 이유와 함께만 */
const ESCAPE_ALLOW = {};

function walkFiles(d, out) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== 'vendor' && e.name !== 'node_modules') walkFiles(p, out); }
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}
function htmlScripts(html) {
  /* 줄 번호가 html 과 같게 — <script> 몸 밖은 줄바꿈만 남기고 비운다 */
  let out = '', last = 0;
  for (const m of html.matchAll(/(<script(?![^>]*\bsrc=)[^>]*>)([\s\S]*?)<\/script>/gi)) {
    const bodyStart = m.index + m[1].length;
    out += html.slice(last, bodyStart).replace(/[^\n]/g, '') + m[2] + ';';
    last = bodyStart + m[2].length;
  }
  return out + html.slice(last).replace(/[^\n]/g, '');
}

say('\n── 2절: parts/ 전체 · html <script> · main.js · preload.js 를 파서로 훑기');
const files = walkFiles(path.join(BASE, 'parts'), []).filter(f => path.resolve(f) !== path.resolve(SAFE_PATH));
const extra = [];
for (const f of fs.readdirSync(BASE).filter(f => f.endsWith('.html'))) extra.push([f, htmlScripts(fs.readFileSync(path.join(BASE, f), 'utf8'))]);
for (const name of ['main.js', 'preload.js']) {
  const p = [path.join(BASE, '..', name), path.join(BASE, name)].find(x => fs.existsSync(x));
  if (p) extra.push([name, fs.readFileSync(p, 'utf8')]);
}
const allSrc = files.map(f => [path.basename(f), fs.readFileSync(f, 'utf8')]).concat(extra);
chk(files.length >= 150 && allSrc.some(([n]) => n === 'app.js') && allSrc.some(([n]) => n === 'main.js') && allSrc.some(([n]) => n === 'desk-companion-prototype.html'),
  `파일을 다 읽었다 — parts/ ${files.length}개(손으로 적은 목록 아님) + html ${extra.filter(([n]) => n.endsWith('.html')).length}개 + main.js · preload.js`);
for (const must of ['purikura-ui.js', 'mallang.js', 'myhome-desktop.js', 'chat-ui.js', 'settings-panel.js']) chk(allSrc.some(([n]) => n === must), `시야에 ${must}`);

const hits = [];
const usedAllow = new Set();
let sinkFiles = 0;
for (const [name, text] of allSrc) {
  let h;
  try { h = scanSource(name, text); } catch (e) { hits.push(name + ' — 파서가 못 읽음: ' + e.message); continue; }
  if (/innerHTML|insertAdjacentHTML|outerHTML/.test(text)) sinkFiles++;
  for (const x of h) {
    const key = name + '|' + x.expr;
    if (ALLOW[key]) { usedAllow.add(key); continue; }
    hits.push(`${name}:${x.line} [${x.kind}${x.sink !== x.line ? ' ← ' + x.sink : ''}] ${x.expr.slice(0, 120)}`);
  }
}
chk(!hits.length, `HTML · 주소 · CSS 자리에 안 씻은 값 0곳 (마크업을 만드는 파일 ${sinkFiles}개 · 예외 ${Object.keys(ALLOW).length}개)` + (hits.length ? '\n      ' + hits.join('\n      ') : ''));
const stale = Object.keys(ALLOW).filter(k => !usedAllow.has(k));
chk(!stale.length, '예외 목록에 이제 안 쓰는 줄 없음(고쳤으면 지운다)' + (stale.length ? ' — ' + stale.join(' · ') : ''));
chk(Object.values(ALLOW).every(v => typeof v === 'string' && v.length >= 2), '예외마다 이유가 적혀 있다');

const esc = [];
for (const [name, text] of allSrc) {
  if (ESCAPE_ALLOW[name]) continue;
  for (const x of homeMadeEscapes(name, text)) esc.push(`${name}:${x.line} ${x.expr}`);
}
chk(!esc.length, '다른 escape 를 새로 만들지 않았다 — 엔티티로 바꾸는 replace 는 safe-html.js 에만' + (esc.length ? '\n      ' + esc.join('\n      ') : ''));

/* app.js 의 옛 이름은 공용 함수를 부르는 별칭일 뿐(다른 escape 가 아님) */
const appSrc = (allSrc.find(([n]) => n === 'app.js') || [])[1] || '';
const escBody = (appSrc.match(/function\s+escHtml\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/) || [])[1] || '';
chk(/TwSafeHtml\.text\(/.test(escBody) && !/replace\(/.test(escBody), 'app.js escHtml 은 TwSafeHtml.text 를 부르는 별칭');
chk(/function\s+_chatEsc\s*\([^)]*\)\s*\{\s*return\s+escHtml\(/.test(appSrc), 'app.js _chatEsc 도 같은 별칭');

/* 싣는 순서 — html 과 smoke 가 app.js · 쓰는 모듈보다 먼저 */
const HTML = fs.readFileSync(path.join(BASE, 'desk-companion-prototype.html'), 'utf8');
const iSafe = HTML.indexOf('<script src="parts/shared/safe-html.js"'), iApp = HTML.indexOf('<script src="parts/app.js"');
const firstUser = ['parts/myhome/mallang.js', 'parts/myhome/myhome-desktop.js', 'parts/purikura/purikura-ui.js'].map(s => HTML.indexOf('<script src="' + s + '"')).filter(i => i >= 0);
chk(iSafe > 0 && iSafe < iApp && firstUser.every(i => iSafe < i), 'html — safe-html.js 를 app.js · 쓰는 모듈보다 먼저 싣는다');
const smokeP = [path.join(__dirname, 'smoke.js'), 'smoke.js', path.join('checks', 'smoke.js')].find(x => fs.existsSync(x));
chk(!!smokeP && /PRELOAD\.push\('safe-html\.js'\)/.test(fs.readFileSync(smokeP, 'utf8')), 'smoke.js PRELOAD 에 safe-html.js');

/* main.js — 새 창은 앱이 여는 자식 창(방명록 · 디자인 스튜디오)만 · http(s) 는 기본 브라우저로. 처리기를 꺼내 실제로 불러 본다 */
const mainSrc = (allSrc.find(([n]) => n === 'main.js') || [])[1] || '';
function loadOpenHandler(src) {
  const sf = ts.createSourceFile('main.js', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let fnText = null, helper = '';
  (function v(n) {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'setWindowOpenHandler' && n.arguments[0]) fnText = n.arguments[0].getText(sf);
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === '_isChildDoc' && n.initializer) helper = 'const _isChildDoc = ' + n.initializer.getText(sf) + ';';
    ts.forEachChild(n, v);
  })(sf);
  if (!fnText) return null;
  return (shell) => new Function('shell', 'mainWindow', 'savedGbPos', 'savedDsPos', helper + '\nreturn (' + fnText + ');')(shell, { id: 'main' }, null, null);
}
function openCases(src) {
  const mk = loadOpenHandler(src);
  if (!mk) return null;
  const opened = [];
  const h = mk({ openExternal: (u) => opened.push(u) });
  const run = (d) => { opened.length = 0; const r = h(d); return { act: r && r.action, w: r && r.overrideBrowserWindowOptions && r.overrideBrowserWindowOptions.width, parent: r && r.overrideBrowserWindowOptions && r.overrideBrowserWindowOptions.parent, ext: opened.slice() }; };
  return {
    gb: run({ url: 'about:blank', frameName: 'mhGuestbook_1729' }),
    gbEmpty: run({ url: '', frameName: 'mhGuestbook_1' }),
    ds: run({ url: 'about:blank', frameName: 'mhDesign_1729' }),
    web: run({ url: 'https://example.com/ad', frameName: '_blank' }),
    webNoName: run({ url: 'http://example.com/', frameName: '' }),
    blankOther: run({ url: 'about:blank', frameName: 'evil' }),
    remoteAsChild: run({ url: 'https://evil.example/', frameName: 'mhGuestbook_1' }),
    file: run({ url: 'file:///C:/Windows/win.ini', frameName: '' }),
    js: run({ url: 'javascript:alert(1)', frameName: 'x' }),
  };
}
const oc = openCases(mainSrc);
chk(!!oc, 'main.js setWindowOpenHandler 를 꺼내 불렀다');
if (oc) {
  chk(oc.gb.act === 'allow' && oc.gb.w === 320 && oc.gb.parent && oc.gbEmpty.act === 'allow', '📖 방명록 창(빈 문서 · mhGuestbook…) 은 연다 — 320 폭 · 메인의 자식');
  chk(oc.ds.act === 'allow' && oc.ds.w === 340, '👑 디자인 스튜디오 창(mhDesign…) 은 연다 — 340 폭');
  chk(oc.web.act === 'deny' && oc.web.ext[0] === 'https://example.com/ad' && oc.webNoName.act === 'deny' && oc.webNoName.ext.length === 1, 'http(s) 새 창은 막고 기본 브라우저로');
  chk(oc.blankOther.act === 'deny' && !oc.blankOther.ext.length, '모르는 이름의 빈 창은 막는다');
  chk(oc.remoteAsChild.act === 'deny' && oc.remoteAsChild.ext.length === 1, '원격 주소는 자식 창 이름을 달아도 앱 창으로 안 연다(기본 브라우저로)');
  chk(oc.file.act === 'deny' && !oc.file.ext.length && oc.js.act === 'deny' && !oc.js.ext.length, 'file: · javascript: 는 막고 아무것도 안 연다');
  /* 깨 보기 — 맨 끝 막기를 옛 «그 외 allow» 로 되돌리면 빨강이 나야 한다 */
  const broken = mainSrc.replace(/(setWindowOpenHandler[\s\S]*?)return \{ action:'deny' \};\n  \}\);/, "$1return { action:'allow' };\n  });");
  const ob = broken !== mainSrc && openCases(broken);
  chk(!!ob && ob.blankOther.act === 'allow', '깨 보기 — 그 밖의 창을 allow 로 되돌리면 «모르는 이름의 빈 창» 이 열림 → 위 판정이 빨강');
}

/* ── 3절: 깨 보기 ────────────────────────────────────────────── */
say('\n── 3절: 깨 보기');
const red = (src, why) => chk(scanSource('fake.js', src).length > 0, '깨 보기 — ' + why + ' → 빨강');
const green = (src, why) => { const h = scanSource('fake.js', src); chk(!h.length, '안 깨짐 — ' + why + (h.length ? ' (잡힘: ' + h.map(x => x.expr).join(' · ') + ')' : '')); };
red("function f(el, m){ el.innerHTML = '<div>' + m.name + '</div>'; }", '날값 이름을 innerHTML 에');
red("function f(el, m){ el.innerHTML = `<b>${m.name}</b>`; }", '템플릿으로 날값');
red("function f(el, m){ let h = ''; h += '<i>' + m.name + '</i>'; el.innerHTML = h; }", '변수에 모았다가');
red("function f(el, list){ el.innerHTML = list.map(x => '<li>' + x.name + '</li>').join(''); }", 'map · join 으로');
red("function f(el, m){ el.insertAdjacentHTML('beforeend', m.msg); }", 'insertAdjacentHTML');
red("function f(el, m){ el.outerHTML = m.html; }", 'outerHTML');
red("function f(el, item){ el.innerHTML = '<img src=\"' + TwSafeHtml.text(item.url) + '\">'; }", '주소 자리에 text 만(javascript: 는 안 막힘)');
red("function f(im, item){ im.src = item.url; }", '.src 에 날 주소');
red("function f(a, u){ a.href = u; }", '.href 에 날 주소');
red("function f(a, u){ a.setAttribute('href', u); }", "setAttribute('href')");
red("function f(el, u){ el.style.backgroundImage = 'url(' + u + ')'; }", 'style 배경 url( 에 날 주소');
red("function f(el, u){ el.style.background = u; }", 'style.background 에 날값');
red("function f(el, m){ el.innerHTML = '<div style=\"background:url(' + m.pic + ')\"></div>'; }", '마크업 안 url( 에 날 주소');
red("function row(a){ return '<td>' + a + '</td>'; } function f(el, m){ el.innerHTML = row(m.name); }", '도우미 함수로 넘긴 날값');
red("function esc(s){ return String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'})[c]); } function f(el, m){ el.innerHTML = esc(m.name); }", '집에서 만든 escape(공용이 아님)');
chk(homeMadeEscapes('fake.js', "function esc(s){ return String(s).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;'})[c]); }").length === 1, '깨 보기 — 집에서 만든 escape 함수 → 빨강');
green("function f(el, m){ el.innerHTML = '<div>' + TwSafeHtml.text(m.name) + '</div>'; }", 'TwSafeHtml.text 로 감쌈');
green("const safeHtml = TwSafeHtml; function f(el, m){ el.innerHTML = `<b title=\"${safeHtml.attr(m.t)}\">${safeHtml.text(m.name)}</b>`; }", '별칭 safeHtml');
green("const escHtml = deps.escHtml; function f(el, m){ el.innerHTML = '<i>' + escHtml(m.name) + '</i>'; }", 'deps.escHtml 별칭');
green("function f(el, list){ el.innerHTML = list.map(x => '<li>' + TwSafeHtml.text(x.name) + '</li>').join(''); }", 'map 안에서 씻음');
green("function f(el, n){ el.innerHTML = '<span>' + (n|0) + '개 · ' + n.length + ' · ' + Math.round(n) + '</span>'; }", '숫자');
green("const ICON = { a: '★', b: '☆' }; function f(el, k){ el.innerHTML = '<i>' + ICON[k] + '</i>'; }", '상수 표');
green("function f(el, ok){ el.innerHTML = ok ? '<b>예</b>' : '<i>아니오</i>'; }", '글자 리터럴 삼항');
green("function row(a){ return '<td>' + a + '</td>'; } function f(el, m){ el.innerHTML = row(TwSafeHtml.text(m.name)); }", '도우미 함수에 씻어서 넘김');
green("function f(im, u){ const s = TwSafeHtml.safeUrl(u, 'image'); if(s) im.src = s; }", 'safeUrl 을 거친 src');
green("function f(el, u){ el.innerHTML = '<img src=\"' + TwSafeHtml.attr(TwSafeHtml.safeUrl(u, 'image')) + '\">'; }", '마크업 주소 자리에 attr(safeUrl())');
green("function f(el, u){ el.style.backgroundImage = TwSafeHtml.cssUrl(u); }", 'cssUrl 배경');
green("function f(im, d){ im.src = 'emoji/default/' + d.file; }", '앞 글자가 주소를 정한 길 조각');
green("function f(im, c){ im.src = c.toDataURL('image/png'); }", '캔버스 그림 주소');
green("function f(el){ el.innerHTML = ''; }", '비우기');
green("function f(el, t){ el.innerHTML = TwSafeHtml.text(t).replace(/\\n/g, '<br>'); }", '씻은 뒤 줄바꿈만 <br>');

{
  /* linkify 가 주소를 씻지 않고 붙이면 빨강 — safe-html.js 글을 바꿔 다시 싣는다 */
  const src = fs.readFileSync(SAFE_PATH, 'utf8');
  const load = (code) => { const m = { exports: {} }; new Function('module', 'window', code)(m, undefined); return m.exports; };
  const raw = load(src.replace("attr(url) + '\">' + text(raw)", "url + '\">' + raw"));
  chk(!raw.linkify('https://x.example/a?b=1&c=2').includes('&amp;'), '깨 보기 — linkify 가 주소를 안 씻으면 & 가 날로 들어감 → 위 «& 는 씻는다» 가 빨강');
  const noFilter = load(src.replace("const url = safeUrl(raw, 'link');", 'const url = raw;'));
  chk(noFilter.linkify('https://x.example/' + 'a'.repeat(2100)) !== SH.linkify('https://x.example/' + 'a'.repeat(2100)), '깨 보기 — safeUrl 을 빼면 상한 넘는 주소도 칸이 됨 → 위 판정이 빨강');
}
say(`\n결과: ${pass}·${fail}`);
process.exit(fail ? 1 : 0);
