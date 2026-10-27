/* sim-mh-bg-url.js — 🖼️ 마이홈 배경 그림 주소 규칙(myhome/mh-bg-url.js)
   [무엇을 지키나] 그림 주소는 safe-html 이 https 만 받는다. 그 전 판에서 http 주소로 저장한 GIF 배경이 업데이트 뒤 안 보였다.
     이제 http 는 https 로 바꿔 그리고, https 로도 못 받으면 주인에게만 «https 주소를 써 주세요» 를 띄운다.
   ・1절: 순수 함수 — httpsOf 입력 → 출력 · 경계값(빈 값 · 앞 공백 · 대문자 · data: · javascript:)
   ・2절: 불러 보기 — 바꾼 주소만 · 같은 주소는 한 번 · 못 받으면 onFail · 받으면 조용히
   ・3절: 실제 그리는 곳 — advApplyBg(바탕화면) · applyMyHomeBg(창 바깥)를 떼어 돌린다. 남의 집에서는 안내하지 않는다
   ・4절: 연결 — html 이 쓰는 모듈보다 먼저 싣는다 · 에러 번호가 표에 있다
   ・5절: 일부러 깨 보기
   [실행] node checks/run.js sim-mh-bg-url */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, path.basename(f)]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = {
  mod: read('myhome/mh-bg-url.js'), safe: read('shared/safe-html.js'), desk: read('myhome/myhome-desktop.js'),
  edit: read('myhome/myhome-edit.js'), html: read('desk-companion-prototype.html'), codes: read('shared/error-codes.js'),
};
for (const k of Object.keys(SRC)) if (SRC[k] == null) { say('  ? 원본 못 찾음 — ' + k); process.exit(2); }

const loadSafe = () => { const m = { exports: {} }; new Function('window', 'module', SRC.safe)(undefined, m); return m.exports; };
const SH = loadSafe();
const loadMod = (src) => { const m = { exports: {} }; new Function('window', 'module', 'TwSafeHtml', src)(undefined, m, SH); return m.exports; };
function grabFn(src, head){
  const i = src.indexOf(head);
  if (i < 0) return null;
  let k = src.indexOf('{', i + head.length - 1), d = 0;
  for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); }
  return null;
}
/* 그리는 곳 하나를 돌린다 — 남은 배경 글 · 불러 보기 부른 주소 */
function paint(where, src, mod, bg, visiting){
  const el = { style: { background: '' } };
  const probed = [];
  const B = Object.assign({}, mod, { probeOwnerBg: (u) => { probed.push(u); } });
  const doc = { getElementById: () => el };
  if (where === 'desk') {
    const fn = grabFn(src, 'function advApplyBg(){');
    if (!fn) throw new Error('advApplyBg 를 못 찾음');
    new Function('document', 'TwMhBgUrl', 'TwSafeHtml', 'advVisiting', 'advVisitBg', 'ADV', 'advApplyFolderHide', fn + '\nadvApplyBg();')(
      doc, B, SH, visiting, visiting ? bg : null, { bg: visiting ? null : bg }, () => {});
  } else {
    const fn = grabFn(src, 'function applyMyHomeBg(){');
    if (!fn) throw new Error('applyMyHomeBg 를 못 찾음');
    new Function('document', 'mhBgUrl', 'TwMhBgUrl', 'TwSafeHtml', '_myHomeData', '_mhViewingUserId', fn + '\napplyMyHomeBg();')(
      doc, B, B, SH, () => ({ bg }), () => (visiting ? 'friendUid' : null));
  }
  return { bg: el.style.background, probed };
}

const GIF = 'http://i.example.com/a.gif';
function judge(src){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  try {
    const M = loadMod(src.mod);
    t(M.httpsOf(GIF) === 'https://i.example.com/a.gif', 'http → https');
    t(M.httpsOf('  HTTP://i.example.com/a.gif') === 'https://i.example.com/a.gif', '  앞 공백 · 대문자 스킴도');
    t(M.httpsOf('https://i.example.com/a.gif') === 'https://i.example.com/a.gif', '  https 는 그대로');
    const PNG = 'data:image/png;base64,iVBORw0KGgo=';
    t(M.httpsOf(PNG) === PNG && M.httpsOf('') === '' && M.httpsOf(null) === null && M.httpsOf(undefined) === undefined, '  data: · 빈 값 · null 은 그대로');
    t(SH.cssUrl(M.httpsOf(GIF)) === 'url("https://i.example.com/a.gif")', '★ cssUrl(httpsOf()) — http GIF 배경이 https 로 그려진다');
    t(SH.cssUrl(M.httpsOf('javascript:alert(1)')) === '' && SH.cssUrl(M.httpsOf('http:/x')) === '' && SH.cssUrl(M.httpsOf('ftp://x/a.gif')) === '', '  씻기는 safe-html 그대로(javascript: · 이상한 주소 · ftp 는 빈 값)');
    t(!/http:\/\//.test(SH.cssUrl(M.httpsOf(GIF))), '  페이지에 http 주소가 들어가지 않는다');

    /* 2절 — 불러 보기 */
    const made = [];
    let fails = 0, offline = false;
    const probe = M.createBgProbe({ makeImage: () => { const im = {}; made.push(im); return im; }, onFail: () => { fails++; }, isOffline: () => offline });
    t(probe(GIF) === true && made.length === 1 && made[0].src === 'https://i.example.com/a.gif', '불러 보기 — 바꾼 https 주소로 한 번');
    t(probe(GIF) === false && probe(' ' + GIF) === false && made.length === 1, '  같은 주소는 다시 안 부른다(다시 그릴 때마다 요청 안 함)');
    made[0].onerror();
    t(fails === 1, '★ 못 받으면 onFail(안내)');
    t(probe('https://i.example.com/b.gif') === false && probe(PNG) === false && probe('') === false && probe(null) === false, '  원래 https · data: · 빈 값은 안 본다');
    t(probe('http://i.example.com/c.gif') === true && made.length === 2 && fails === 1 && typeof made[1].onload === 'undefined', '  받으면 조용히(onerror 만 건다)');
    offline = true;
    t(probe('http://i.example.com/d.gif') === true && made.length === 3, '  연결이 꺼져 있어도 한 번은 불러 본다');
    made[2].onerror();
    t(fails === 1, '★ 연결이 꺼져서 못 받았으면 «https 주소를 써 주세요» 를 띄우지 않는다');
    offline = false;
    t(probe('http://i.example.com/d.gif') === true && made.length === 4, '★  연결이 돌아온 뒤 다음 그리기에 다시 불러 본다');
    made[3].onerror();
    t(fails === 2, '  그때 못 받으면 안내');

    /* 3절 — 실제 그리는 곳 */
    for (const [where, s] of [['desk', src.desk], ['edit', src.edit]]) {
      const name = where === 'desk' ? '바탕화면(advApplyBg)' : '창 바깥(applyMyHomeBg)';
      const own = paint(where, s, M, { img: GIF }, false);
      t(own.bg.indexOf('url("https://i.example.com/a.gif")') === 0, '★ ' + name + ' — 내 http GIF 배경이 보인다');
      t(own.probed.length === 1 && own.probed[0] === GIF, '  ' + name + ' — 내 배경이면 불러 보기(안내 길)');
      const visit = paint(where, s, M, { img: GIF }, true);
      t(visit.bg.indexOf('url("https://i.example.com/a.gif")') === 0, '  ' + name + ' — 친구 집 http 배경도 보인다');
      t(visit.probed.length === 0, '★ ' + name + ' — 친구 집에서는 안내하지 않는다');
      const col = paint(where, s, M, { color: '#123456' }, false);
      t(col.bg === '#123456', '  ' + name + ' — 색 배경은 예전 그대로');
    }
  } catch (e) { t(false, '돌려 보다 던짐 — ' + String(e.message || e).slice(0, 120)); }
  return r;
}

say('── 1~3. 규칙 · 불러 보기 · 그리는 곳');
judge(SRC).forEach(([ok, msg]) => chk(ok, msg));

say('── 4. 연결');
const at = (s) => SRC.html.indexOf('<script src="parts/' + s + '"');
chk(at('myhome/mh-bg-url.js') > at('shared/safe-html.js') && at('shared/safe-html.js') > 0 && at('myhome/mh-bg-url.js') > at('shared/error-codes.js'), 'html — safe-html · error-codes 뒤에 싣는다');
chk(at('myhome/mh-bg-url.js') < at('myhome/myhome-edit.js') && at('myhome/mh-bg-url.js') < at('myhome/myhome-desktop.js') && at('myhome/mh-bg-url.js') < at('app.js'), 'html — myhome-edit · myhome-desktop · app.js 보다 먼저');
const codes = { exports: {} };
new Function('window', 'module', SRC.codes)(undefined, codes);
chk(!!codes.exports.CODES['E-MH-02'] && /https/.test(codes.exports.CODES['E-MH-02'].msg), '에러 번호 E-MH-02 가 표에 있고 «https» 안내를 담는다');
chk(/TwErrorCodes\.notify\('E-MH-02'/.test(SRC.mod), '모듈의 안내는 E-MH-02 로 낸다');

say('── 5. 일부러 깨 보기');
const breaks = [
  ['바꾸기 없음(예전처럼 http 를 버림)', 'mod', "  if(typeof u !== 'string' || !HTTP_RE.test(u)) return u;\n  return 'https://' + u.trim().slice(7);", '  return u;'],
  ['같은 주소를 매번 부름', 'mod', '    if(!u || seen.has(u)) return false;', '    if(!u) return false;'],
  ['연결이 꺼진 실패도 안내', 'mod', '      if(deps.isOffline()){ seen.delete(u); return; }\n', ''],
  ['바탕화면이 예전 씻기(cssUrl)를 바로 부름', 'desk', 'TwSafeHtml.cssUrl(TwMhBgUrl.httpsOf(bg.img))', 'TwSafeHtml.cssUrl(bg.img)'],
  ['바탕화면이 친구 집에서도 안내', 'desk', 'if(bg && !advVisiting) TwMhBgUrl.probeOwnerBg', 'if(bg) TwMhBgUrl.probeOwnerBg'],
  ['창 바깥이 예전 씻기(cssUrl)를 바로 부름', 'edit', 'TwSafeHtml.cssUrl(mhBgUrl.httpsOf(bg.img))', 'TwSafeHtml.cssUrl(bg.img)'],
  ['창 바깥이 친구 집에서도 안내', 'edit', 'if(bg && !_mhViewingUserId()) mhBgUrl.probeOwnerBg', 'if(bg) mhBgUrl.probeOwnerBg'],
];
for (const [name, key, a, b] of breaks) {
  const s2 = Object.assign({}, SRC, { [key]: SRC[key].replace(a, b) });
  const changed = s2[key] !== SRC[key];
  const red = changed && judge(s2).some(([ok]) => !ok);
  chk(red, name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
