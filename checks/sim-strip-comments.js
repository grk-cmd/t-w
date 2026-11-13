/* ═══ 🧹 sim-strip-comments.js — 검사가 손 색 · 글꼴을 세기 전에 주석을 지우는 한 벌(검사용 도우미) ═══════════════
   [왜] 정규식으로 블록 주석을 지우면 문자열 속 'image/*' · accept="image/*" 의 «슬래시 별» 을 주석 시작으로 읽어
     다음 «별 슬래시» 까지 통째로 지워 그 사이 손 색 · 글꼴을 못 셌다. 같은 정규식이 검사마다 따로 있어서(sim-ui-tokens ·
     sim-font-hangul) 한 곳을 고쳐도 다른 곳은 그대로였다 — 여기 한 벌을 둘 다 부른다.
   [쓰는 법] const { stripCss, stripJs } = require('./sim-strip-comments.js');
     · stripJs(src)  — JS: 블록 주석 · 한 줄 주석(슬래시 둘)을 지운다
     · stripCss(src) — HTML · CSS: <!-- --> · 블록 주석만 지운다(url(http:…) 의 슬래시 둘을 주석으로 안 본다)
     지운 자리는 같은 길이의 공백으로 채운다(줄바꿈은 남김 — 줄 번호가 그대로).
   ⚠️ 따옴표('…' "…" `…`) 안은 건너뛴다. '…' "…" 는 줄이 바뀌면 끝난 것으로 본다 — 정규식 안의 따옴표(/'/g) · 글 속
     작은따옴표에 읽기가 꼬여도 그 줄에서 멈춘다. 따옴표 밖의 역슬래시 다음 글자도 그대로 둔다 — 정규식 /^https?:\/\//i 의
     «\/ /» 를 한 줄 주석으로 읽지 않게.
   [직접 실행] 판정 · 일부러 깨 보기. 검사: 이 파일 자체. */
'use strict';

const blank = (m) => m.replace(/[^\n]/g, ' ');

/** @param {string} src @param {boolean} lineComments */
function stripComments(src, lineComments){
  let out = '', q = null;
  for(let i = 0; i < src.length; ){
    const c = src[i], d = src[i + 1];
    if(c === '\\'){ out += c + (d === undefined ? '' : d); i += 2; continue; }
    if(q){
      if(c === q || (c === '\n' && q !== '`')) q = null;
      out += c; i++; continue;
    }
    if(c === "'" || c === '"' || c === '`'){ q = c; out += c; i++; continue; }
    if(c === '/' && d === '*'){ const e = src.indexOf('*/', i + 2), end = e < 0 ? src.length : e + 2; out += blank(src.slice(i, end)); i = end; continue; }
    if(lineComments && c === '/' && d === '/'){ const e = src.indexOf('\n', i), end = e < 0 ? src.length : e; out += blank(src.slice(i, end)); i = end; continue; }
    out += c; i++;
  }
  return out;
}
const stripCss = (s) => stripComments(s.replace(/<!--[\s\S]*?-->/g, blank), false);
const stripJs = (s) => stripComments(s, true);

module.exports = { blank, stripComments, stripCss, stripJs };

/* 판정 — api 를 받아 [ok, 이름] 목록. 깨 보기는 이 파일 글을 바꿔 다시 싣고 같은 판정을 돌린다. */
function judge(api){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const s1 = "fi.accept='image/*';\nel.style.color='#777';\n/* #888 */ x = 1; // #999\n";
  const j1 = api.stripJs(s1);
  t(j1.includes('#777') && !j1.includes('#888') && !j1.includes('#999') && j1.split('\n').length === 4 && j1.length === s1.length, "JS — 'image/*' 뒤 손 색도 남는다 · 진짜 주석(블록 · 한 줄)은 지운다 · 줄 수 · 길이 그대로");
  const c1 = api.stripCss('<input accept="image/*">\n<style>.a{color:#666;} /* #555 */</style><!-- #444 -->');
  t(c1.includes('#666') && !c1.includes('#555') && !c1.includes('#444'), 'HTML — accept="image/*" 뒤도 남는다 · <!-- --> · 블록 주석은 지운다');
  const j2 = api.stripJs("a = 'it\\'s /* #777 */';\nb = `x /* #666 */`;");
  t(j2.includes('/* #777 */') && j2.includes('/* #666 */'), '따옴표 안(역슬래시로 감싼 따옴표 · 템플릿)의 주석 모양은 안 지운다');
  t(api.stripCss('.b{background:url(http://x/a.png);color:#333}').includes('#333'), 'HTML · CSS 는 슬래시 둘을 주석으로 안 본다(url(http:…))');
  t(api.stripJs("r = /^https?:\\/\\//i; x = '#777';").includes('#777') && api.stripJs("r = /^image\\//; y = 1; // #999").includes('y = 1') , '정규식의 «\\/ /» 는 한 줄 주석이 아니다');
  t(!api.stripJs("x = /'/g;\n/* #888 */ y = 2;").includes('#888'), "짝 안 맞는 따옴표(정규식 /'/g)는 그 줄에서 끝 — 다음 줄 주석은 지운다");
  t(api.stripJs('') === '' && api.stripCss('') === '' && api.stripJs('/* 안 닫힘 #777').trim() === '', '경계 — 빈 글 · 안 닫힌 블록 주석은 끝까지 지운다');
  return r;
}

if(require.main === module){
  const fs = require('fs');
  let pass = 0, fail = 0;
  const chk = (ok, msg) => { ok ? pass++ : fail++; console.log('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
  console.log('── 1. 판정');
  judge(module.exports).forEach(([ok, m]) => chk(ok, m));
  console.log('── 2. 일부러 깨 보기');
  const SRC = fs.readFileSync(__filename, 'utf8');
  const load = (src) => { const m = { exports: {} }; new Function('module', 'require', src.slice(0, src.indexOf('module.exports = {')) + 'module.exports = { blank, stripComments, stripCss, stripJs };')(m, require); return m.exports; };
  const BREAKS = [
    ['따옴표를 안 봄', `    if(c === "'" || c === '"' || c === '\`'){ q = c; out += c; i++; continue; }\n`, ''],
    ['템플릿(백틱)을 따옴표로 안 봄', `c === '"' || c === '\`'){ q = c;`, `c === '"'){ q = c;`],
    ['역슬래시를 안 건너뜀', "    if(c === '\\\\'){ out += c + (d === undefined ? '' : d); i += 2; continue; }\n", ''],
    ['줄바꿈에서 따옴표를 안 끝냄', " || (c === '\\n' && q !== '`')", ''],
    ['HTML 도 슬래시 둘을 지움', 'stripComments(s.replace(/<!--[\\s\\S]*?-->/g, blank), false)', 'stripComments(s.replace(/<!--[\\s\\S]*?-->/g, blank), true)'],
    ['<!-- --> 를 안 지움', "s.replace(/<!--[\\s\\S]*?-->/g, blank)", 's'],
  ];
  for(const [name, a, b] of BREAKS){
    if(SRC.indexOf(a) < 0){ chk(false, '깨 볼 글을 못 찾음 — ' + name); continue; }
    let rows;
    try{ rows = judge(load(SRC.replace(a, b))); }catch(e){ rows = [[false, String(e)]]; }
    chk(rows.some(([ok]) => !ok), name + ' → 빨강');
  }
  console.log(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
}
