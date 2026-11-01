/* sim-help-search.js — 🔍 도움말 검색(hosting/help/search.js · search.json · scripts/build-help-search.js)
   ・1절: 검색표가 최신 — 원본(편 · docs/help-search/words.json · faq.json)에서 다시 만든 것과 커밋된 것이 같다 · 소제목 id · FAQ 자리가 실제로 있다
   ・2절: 질문 → 답 — 실제 검색표로 사람이 칠 만한 질문을 돌려 맞는 편 · 소제목이 맨 위에 오는가
   ・3절: 낱말 다루기 — 말끝 떼기 · 군말 빼기 · 띄어쓰기 합치기 · 거미줄 무게 · 토막 · 주소
   ・4절: 경계 — 빈 질문 · 군말뿐 · 모르는 말 · 아주 긴 질문 · HTML · 목록 겹침 · 한 편 상한
   ・5절: 깨 보기 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

// 스테이징(checks/run.js)에선 검사와 원본이 한 폴더, 저장소에서 바로 돌리면 한 층 위가 루트다.
const ROOT = fs.existsSync(path.join(__dirname, 'scripts', 'build-help-search.js')) ? __dirname : path.join(__dirname, '..');
const DIR = path.join(ROOT, 'hosting', 'help');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { if (ok){ pass++; say('  ✓ ' + msg); } else { fail++; say('  ✗ ' + msg); } };

const GEN = path.join(ROOT, 'scripts', 'build-help-search.js');
if (!fs.existsSync(GEN) || !fs.existsSync(path.join(DIR, 'search.js'))){ say('  ? 원본 못 찾음 — scripts/build-help-search.js · hosting/help/search.js'); process.exit(2); }
const { build, withIds } = require(GEN);
const SRC = fs.readFileSync(path.join(DIR, 'search.js'), 'utf8');
/* search.js 를 화면 없이 불러 규칙(core)만 받는다 — 고친 글로도 불러 깨 보기에 쓴다 */
const load = (src) => { const m = { exports: {} }; new Function('module', 'window', 'document', src)(m, undefined, undefined); return m.exports; };
const C = load(SRC);
const IX = JSON.parse(fs.readFileSync(path.join(DIR, 'search.json'), 'utf8'));
const P = C.prepare(IX);

say('── 1. 검색표가 최신');
const files = build(ROOT);
for (const [rel, content] of Object.entries(files)){
  const p = path.join(ROOT, rel);
  const cur = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
  chk(cur === content, `${rel} — 원본에서 다시 만든 것과 같다 (다르면 npm run help:build)`);
}
const toc = JSON.parse(fs.readFileSync(path.join(DIR, 'toc.json'), 'utf8'));
const slugs = toc.flatMap(g => g.pages.map(p => p.slug));
const html = Object.fromEntries(slugs.map(s => [s, fs.readFileSync(path.join(DIR, s + '.html'), 'utf8')]));
html.faq = fs.readFileSync(path.join(DIR, 'faq.html'), 'utf8');   // 편 없는 FAQ 는 FAQ 페이지의 그 질문 자리(fN)로 간다
chk(slugs.every(s => IX.chunks.some(c => c.p === s)), '목차의 편 ' + slugs.length + '개 모두 검색표에 조각이 있다');
const badAnchor = IX.chunks.concat(IX.faq).filter(c => c.a && !html[c.p].includes(' id="' + c.a + '"'));
chk(badAnchor.length === 0, '조각 · FAQ 가 가리키는 소제목 id 가 그 편에 있다' + (badAnchor.length ? ' — ' + badAnchor.map(c => c.p + '#' + c.a).join(', ') : ''));
const dupId = slugs.filter(s => { const ids = [...html[s].matchAll(/ id="(s\d+)"/g)].map(m => m[1]); return new Set(ids).size !== ids.length; });
chk(dupId.length === 0, '  한 편 안에서 소제목 id 가 겹치지 않는다');
chk(IX.faq.length >= 5 && IX.faq.every(f => f.q.length && f.t && IX.pages.some(p => p.s === f.p)), 'FAQ ' + IX.faq.length + '개 — 질문 · 답 · 편이 다 있다');
const heads = ['index'].concat(slugs).map(s => (fs.readFileSync(path.join(DIR, s + '.html'), 'utf8').match(/<header class="bar">[\s\S]*?<\/header>/) || [''])[0]);
chk(new Set(heads).size === 1 && /href="\/" aria-current="page">도움말<\/a><a href="\/faq">FAQ</.test(heads[0]), '위 띠(헤더)가 목차 · 편 모두 같은 모양 — [도움말](지금) · [FAQ] 탭');
const FAQH = fs.readFileSync(path.join(DIR, 'faq.html'), 'utf8');
chk((FAQH.match(/<h2 id="f\d+">/g) || []).length === IX.faq.length && /href="\/faq" aria-current="page"/.test(FAQH), 'FAQ 페이지 — 질문마다 소제목 하나 · [FAQ] 탭이 지금');
const ixBytes = Buffer.byteLength(fs.readFileSync(path.join(DIR, 'search.json')));
chk(ixBytes < 300 * 1024, '  검색표 ' + Math.round(ixBytes / 1024) + 'KB — 300KB 아래(검색창을 처음 누를 때 한 번 받는다)');
const THEME = fs.readFileSync(path.join(DIR, 'theme.js'), 'utf8');
const carryOf = (search) => { const a = {}; new Function('document', 'location', 'URLSearchParams', THEME)({ documentElement: { setAttribute: (k, v) => { a[k] = v; } }, addEventListener(){} }, { search }, URLSearchParams); return a['data-carry']; };
chk(carryOf('?theme=bubble&embed=1') === 'theme=bubble&embed=1' && carryOf('') === undefined && carryOf('?theme=evil') === undefined, '  theme.js 가 링크에 붙이는 것을 data-carry 로 남긴다(검색 결과 링크도 같은 것 · 모르는 테마는 안 실음)');

/* 화면 쪽을 가짜 문서로 한 번 돌린다 — 앱 칸 안(data-embed)이면 검색창을 만들러 띠를 찾지도 않는다 */
const mountRun = (embed) => { const asked = []; new Function('module', 'window', 'document', SRC)(undefined, {}, {
  readyState: 'complete', documentElement: { hasAttribute: (k) => k === 'data-embed' && embed, getAttribute: () => null },
  querySelector: (sel) => { asked.push(sel); return null; }, addEventListener(){} }); return asked; };
chk(mountRun(true).length === 0 && mountRun(false).includes('.bar'), '앱 칸 안(?embed=1)에서는 검색창을 안 만든다 · 웹에서는 위 띠에 단다');
chk(/\[data-embed\] \.bar\{display:none\}/.test(fs.readFileSync(path.join(DIR, 'help.css'), 'utf8')), '  앱 칸 안에서는 위 띠([도움말] [FAQ] 탭)를 숨긴다');

say('── 2. 질문 → 답');
const sysAnchor = (IX.chunks.find(c => c.p === '1' && /› 시스템$/.test(c.h)) || {}).a;
const CASES = [
  ['버전은 어디서 확인하나요?', (r) => r.answer.faq && r.answer.p === '1' && r.answer.a === sysAnchor, '버전 FAQ → 1편 › 시스템'],
  ['버전 확인', (r) => r.answer.faq && r.answer.p === '1', '버전 FAQ'],
  ['첫 화면에서 버전', (r) => r.answer.faq && r.answer.p === '1', '버전 FAQ(띄어 쓴 «첫 화면»)'],
  ['캐릭터 옷 어떻게 바꿔', (r) => r.answer.p === '4-1', '4-1. 꾸미기'],
  ['친구 추가하는 법', (r) => r.answer.faq && r.answer.p === '7', '친구 FAQ → 7. 마이홈'],
  ['노래 지우기', (r) => r.answer.p === '3-1', '3-1. 플레이리스트'],
  ['가챠 뽑기', (r) => r.answer.p === '9', '9. 가챠'],
  ['회사에서 몰래 쓰고 싶어', (r) => r.answer.p === '1-2', '1-2. 회사원 모드'],
  ['레벨 올리는 법', (r) => r.answer.p === '8', '8. 레벨 해금'],
  ['런처로 가려면', (r) => r.answer.p === '4', '4. 드롭다운 메뉴 › « 런처로'],
  ['다른 컴퓨터에서 쓰려면', (r) => r.answer.p === '1', '1편 › 로그인 수단'],
  ['아바타 염색', (r) => r.answer.p === '2', '거미줄로만 닿는 말(아바타 → 캐릭터 · 염색 → 색상)'],
  ['맥 설치', (r) => r.answer.faq && r.answer.p === 'faq', '맥 설치 FAQ(편 없음 → FAQ 페이지)'],
  ['손상되었다고 나와요', (r) => r.answer.faq && /손상/.test(r.answer.h), '맥 «손상» FAQ'],
  ['버전 정', (r) => r.answer.faq && r.answer.p === '1', '치는 중인 한 글자(정)가 앞 낱말(버전)을 덮지 않는다'],
  ['올라타기 내려오기', (r) => r.answer.p === '2-1', '2-1편 › 올라타기(올라 → 레벨로 새지 않음)'],
];
for (const [q, ok, want] of CASES){
  const r = C.search(P, q);
  chk(!!r.answer && ok(r), `«${q}» → ${want}` + (r.answer && !ok(r) ? ` (나온 것: ${C.where(r.answer)})` : r.answer ? '' : ' (못 찾음)'));
}

say('── 3. 낱말 다루기');
chk(C.stem('버전은') === '버전' && C.stem('확인하나요') === '확인' && C.stem('바꾸려면') === '바꾸' && C.stem('투게더룸으로') === '투게더룸', '말끝 떼기 — 버전은 · 확인하나요 · 바꾸려면 · 투게더룸으로');
chk(C.stem('옷을') === '옷' && C.stem('귀는') === '귀' && C.stem('가') === '가' && C.stem('이') === '이' && C.stem('방이') === '방이', '  두 글자는 은 · 는 · 을 · 를 만 뗀다(방이 → 방이 · 한 글자는 그대로)');
chk(C.terms('버전은 어디서 확인하나요?').join() === '버전' && C.terms('어떻게 해요').length === 0, '  군말(어디서 · 확인 · 어떻게)과 말끝만 있는 낱말(해요)은 뺀다');
chk(C.terms('노래 노래를 노래').join() === '노래', '  같은 낱말은 한 번');
const jt = (q) => C.joinSpaced(P.graph, C.terms(q)).join();
chk(jt('첫 화면') === '첫화면' && jt('메인 화면 설정') === '메인화면,설정' && jt('친구 추가') === '친구추가', '띄어쓰기 — 붙인 말이 거미줄 마디면 하나로(첫 화면 · 메인 화면 · 친구 추가)');
chk(jt('노래 지우기') === '노래,지우기', '  거미줄에 없으면 그대로 둘');
const G = C.graphOf([{ k: 0.9, w: ['가', '나'] }, ['나', '다'], { k: 5, w: ['라', '마'] }]);
chk(G['가']['나'] === 0.9 && G['나']['가'] === 0.9 && G['나']['다'] === 0.6 && G['라']['마'] === 0.6, '거미줄 무게 — 묶음 k(0.9) · 없으면 0.6 · 0 ~ 1 밖이면 0.6');
const G2 = C.graphOf([{ k: 0.9, w: ['가', '나'] }, ['가', '나']]);
chk(G2['가']['나'] === 0.9, '  두 묶음에 같이 있으면 무거운 쪽');
const ex = (g, t) => Object.fromEntries(C.expand(g, t).map(e => [e.w, e.k]));
const E1 = ex(C.graphOf([['바꾸', '변경']]), '바꾸');
const E2 = ex(C.graphOf([['바꾸', '변경']]), '바꾸면서');
chk(E1['바꾸'] === 1 && E1['변경'] === 0.6 && E2['바꾸면서'] === 1 && E2['바꾸'] === 0.9 && Math.abs(E2['변경'] - 0.54) < 1e-9, '  넓히기 — 그대로 1 · 앞만 같은 마디 0.9 · 그 이웃은 곱(0.54)');
const segs = C.snippet('가나다라마 바사아 자차카', ['바사'], 6);
chk(segs.some(s => s.m && s.t === '바사') && segs.map(s => s.t).join('').replace(/…/g, '').length <= 6, '토막 — 맞은 곳 둘레 · 맞은 낱말 표시 · 길이 상한');
chk(C.snippet('가나다', ['없음'], 10).map(s => s.t).join('') === '가나다', '  안 맞으면 앞에서부터');
const mk = (t, w) => C.snippet(t, w, 200).filter(s => s.m).map(s => s.t).join('|');
chk(mk('시스템 탭 «프로그램 정보» 에서', ['프로그램정보']) === '프로그램 정보' && mk('상의 · 하의 상의', ['의상']) === '', '  표시 — 네 글자부터 띄어쓰기 넘어 표시(프로그램 정보) · 짧은 낱말은 안 넘음(하의 상의 ≠ 의상)');
chk(C.href('4-1', 's3', 'theme=bubble&embed=1') === '/4-1?theme=bubble&embed=1#s3' && C.href('9', '', '') === '/9' && C.href('index', '', 'embed=1') === '/?embed=1', '주소 — 편 · 테마 · 소제목 자리');

say('── 4. 경계');
for (const q of ['', '   ', null, undefined, '?!…']) chk(!C.search(P, q).answer, `  빈 질문 «${q}» — 답 없음`);
chk(!C.search(P, '어떻게 해요').answer && !C.search(P, 'qwzx').answer, '군말뿐 · 모르는 말 — 답 없음(못 찾음 안내)');
chk(!C.search(P, 'a').answer && !C.search(P, '7').answer && C.search(P, '버전 a').terms.join() === '버전' && C.search(P, 'f1').terms.join() === 'f1', '영문 · 숫자 한 글자(a · 7)는 낱말로 안 친다(f1 처럼 두 글자는 그대로)');
chk(!C.expand(P.graph, '올라타기').some(e => e.w === '레벨업'), '  거미줄에 그대로 있는 낱말(올라타기)은 앞만 같은 짧은 마디(올라)로 안 넓힌다');
const long = C.search(P, '캐릭터 '.repeat(100) + '버전');
chk(long.terms.length <= 8 && !long.terms.includes('버전'), '아주 긴 질문 — 앞 ' + C.MAX_Q + '자 · 낱말 8개까지만 본다');
let threw = false; try { C.search(P, '<img src=x onerror=alert(1)> "\'&'); } catch (_) { threw = true; }
chk(!threw && C.terms('<b>버전</b>').join() === 'b,버전', 'HTML 섞인 질문 — 터지지 않고 글자로만 본다');
let shapeOk = true, why = '';
for (const q of ['캐릭터', '꾸미기 색', '방 만들기', '친구', '설정', '마이홈 스티커', '초대장']){
  const r = C.search(P, q);
  if (!r.answer) continue;
  const all = [r.answer].concat(r.list);
  const keys = all.map(d => d.p + '#' + d.a);
  const per = {}; all.forEach(d => { per[d.p] = (per[d.p] || 0) + 1; });
  if (new Set(keys).size !== keys.length){ shapeOk = false; why = q + ' — 같은 자리가 두 번'; }
  if (r.list.length > C.LIST){ shapeOk = false; why = q + ' — 목록이 ' + r.list.length; }
  if (Object.values(per).some(n => n > C.PER_PAGE)){ shapeOk = false; why = q + ' — 한 편이 ' + C.PER_PAGE + '개 넘음'; }
}
chk(shapeOk, '결과 — 같은 자리 두 번 없음 · 목록 ' + C.LIST + '줄 · 한 편 ' + C.PER_PAGE + '개까지' + (why ? ' (' + why + ')' : ''));

say('── 5. 깨 보기 — 하나라도 못 잡으면 빨강');
const page1 = html['1'];
chk(withIds(page1.replace(/ id="s\d+"/g, '')) === page1, '소제목 id 는 다시 매겨도 같다');
chk(withIds(page1.replace('<h2 id="s1">', '<h2 id="s1">새 소제목</h2>\n<h2>')) !== page1, '  편에 소제목을 더하고 다시 안 만들면 1절이 잡는다');
const P0 = C.prepare(Object.assign({}, IX, { words: [] }));
chk(!C.search(P0, '아바타 염색').answer, '  거미줄을 비우면 «아바타 염색» 을 못 찾는다(2절이 잡는다)');
const PF = C.prepare(Object.assign({}, IX, { faq: [] }));
chk(!(C.search(PF, '버전은 어디서 확인하나요?').answer || {}).faq, '  FAQ 를 비우면 버전 질문이 FAQ 로 안 온다(2절이 잡는다)');
const noStop = load(SRC.replace('.forEach(function(w){ STOP[w] = 1; });', '.forEach(function(){});'));
chk(noStop.terms('버전은 어디서 확인하나요?').length > 1, '  군말 빼기를 끄면 3절이 잡는다');
const noJoin = load(SRC.replace('if(i + 1 < ts.length && graph[ts[i] + ts[i + 1]])', 'if(false)'));
chk(noJoin.joinSpaced(P.graph, C.terms('첫 화면')).join() !== '첫화면', '  띄어쓰기 합치기를 끄면 3절이 잡는다');
const SRC_SAVED = SRC;
const embedOpen = SRC.replace("if(document.documentElement.hasAttribute('data-embed')) return;", '');
chk(embedOpen !== SRC_SAVED && (() => { const asked = []; new Function('module', 'window', 'document', embedOpen)(undefined, {}, { readyState: 'complete', documentElement: { hasAttribute: () => true, getAttribute: () => null }, querySelector: (q) => { asked.push(q); return null; }, addEventListener(){} }); return asked.includes('.bar'); })(), '  칸 안 막기를 빼면 앱에 검색창이 생긴다(위 검사가 잡는다)');
const noExact = load(SRC.replace('var exact = !!graph[t];', 'var exact = false;'));
chk(noExact.expand(P.graph, '올라타기').some(e => e.w === '레벨업'), '  꼭 맞는 마디 우선을 빼면 4절이 잡는다');
const noOne = load(SRC.replace("ts = ts.filter(function(t){ return !(t.length === 1 && /[0-9a-z]/.test(t)); });", ''));
chk(!!noOne.search(noOne.prepare(IX), 'a').answer, '  영문 한 글자 빼기를 끄면 4절이 잡는다');
const noCap = load(SRC.replace('|| (perPage[s.d.p] || 0) >= PER_PAGE ', ''));
const capHit = ['캐릭터', '꾸미기 색', '방 만들기', '친구', '설정', '마이홈 스티커'].some(q => { const r = noCap.search(noCap.prepare(IX), q); const per = {}; [r.answer].concat(r.list).filter(Boolean).forEach(d => { per[d.p] = (per[d.p] || 0) + 1; }); return Object.values(per).some(n => n > C.PER_PAGE); });
chk(capHit, '  한 편 상한을 빼면 4절이 잡는다');
/* FAQ 소제목 오타는 만들 때 멈춘다 — 임시 폴더에 원본 한 벌을 두고 faq 만 틀리게 */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'help-search-'));
try {
  const H = path.join(tmp, 'hosting', 'help'); fs.mkdirSync(H, { recursive: true });
  const D = path.join(tmp, 'docs', 'help-search'); fs.mkdirSync(D, { recursive: true });
  for (const f of ['toc.json', 'index.html'].concat(slugs.map(s => s + '.html'))) fs.copyFileSync(path.join(DIR, f), path.join(H, f));
  fs.copyFileSync(path.join(ROOT, 'docs', 'help-search', 'words.json'), path.join(D, 'words.json'));
  const faq = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'help-search', 'faq.json'), 'utf8'));
  const bad = (f) => { fs.writeFileSync(path.join(D, 'faq.json'), JSON.stringify(f)); try { build(tmp); return false; } catch (_) { return true; } };
  chk(!bad(faq), '  원본 그대로면 임시 폴더에서도 만들어진다');
  chk(bad(faq.map((f, i) => i ? f : Object.assign({}, f, { section: '없는 소제목' }))), '  FAQ 소제목 오타 — 만들 때 멈춘다');
  chk(bad(faq.map((f, i) => i ? f : Object.assign({}, f, { page: '99' }))), '  FAQ 편 오타 — 만들 때 멈춘다');
  fs.writeFileSync(path.join(D, 'faq.json'), JSON.stringify(faq.map((f, i) => i ? f : Object.assign({}, f, { a: '<img src=x onerror=alert(1)>' }))));
  const evil = build(tmp)['hosting/help/faq.html'];
  chk(!evil.includes('<img src=x') && evil.includes('&lt;img src=x'), '  FAQ 답에 HTML 을 적어도 글자로만 나온다');
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }

say('');
say(fail ? ('✗ ' + fail + '건 어긋남 · 통과 ' + pass) : ('✅ 전부 통과 ' + pass + ' — 도움말 검색은 맞는 자리를 찾아 준다'));
process.exit(fail ? 1 : 0);
