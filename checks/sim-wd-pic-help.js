/* sim-wd-pic-help.js — 꾸미기 ✎ 그리기 줄의 단축키 · 도움말 접기 (part-paint.js _buildWdPicSection)
   [무엇을 지키나] 그리기 줄의 안내 글(단축키 · 귀 안내)은 기본으로 접혀 있고, 제목 옆 ⓘ 로 펴고 접는다. 펼침은 이 PC 에 기억한다.
     펴 둔 채 두면 미리보기 창 높이가 고정이라 캐릭터 보는 칸이 그만큼 준다.
   진짜 _buildWdPicSection 글을 part-paint.js 에서 꺼내 가짜 DOM 위에서 돌린다.
   ・1절: 기본은 접힘 · ⓘ 누르면 폄 · 기억 · 다시 그려도 그대로 · 귀 안내도 접힌 칸 안 · 저장소가 막혀도 그린다
   ・2절: CSS — 접힌 칸은 display:none(.wd-pic-help 가 flex 라 hidden 속성만으로는 안 숨는다) · ⓘ 모양은 설정 창 ⓘ 와 같은 규칙
   ・3절: mutation test
   [실행] 저장소 루트에서 node checks/run.js sim-wd-pic-help */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const MOD = ['part-paint.js', 'parts/character/part-paint.js', 'app/parts/character/part-paint.js', 'apps/desktop/app/parts/character/part-paint.js'].map(read).find(Boolean);
const HTML = ['desk-companion-prototype.html', 'app/desk-companion-prototype.html', 'apps/desktop/app/desk-companion-prototype.html'].map(read).find(Boolean);
if(!MOD || !HTML){ say('  ? 원본 못 찾음 — part-paint.js · desk-companion-prototype.html'); process.exit(2); }

function el(tag){
  return { tag, children: [], attrs: {}, style: {}, className: '', id: '', hidden: false, textContent: '', innerHTML: '', disabled: false,
    classList: { toggle(){}, add(){}, remove(){} },
    appendChild(c){ this.children.push(c); return c; },
    setAttribute(k, v){ this.attrs[k] = String(v); },
    getAttribute(k){ return k in this.attrs ? this.attrs[k] : null; } };
}
const find = (root, pred) => { if(pred(root)) return root; for(const c of root.children){ const f = find(c, pred); if(f) return f; } return null; };
const textOf = (root) => root.textContent + root.innerHTML + root.children.map(textOf).join('');

/* 진짜 함수 글을 꺼내 쓴다 — 키 이름도 모듈의 상수 그대로 */
function load(mod){
  const i = mod.indexOf('function _buildWdPicSection(){');
  const j = mod.indexOf('\n}\n', i);
  const key = (/const WD_PIC_HELP_KEY = '([^']+)';/.exec(mod) || [])[1];
  if(i < 0 || j < 0) throw new Error('_buildWdPicSection 을 못 찾음');
  const fn = new Function('_wdPicSection', '_wdPic', 'savedParts', 'wdPaintTool', 'TwSafeHtml', 'buildFreeColorPicker', '_wdPicSetSym', '_wdPicSetEraser',
    '_wdPicUndo', '_wdPicRedo', '_wdPicClear', 'exitWdPicMode', 'WD_PIC_HELP_KEY', 'localStorage', 'document',
    mod.slice(i, j + 2) + '\nreturn _buildWdPicSection;');
  return { fn, key };
}
function run(mod, o){
  o = o || {};
  const { fn, key } = load(mod);
  const sec = el('div');
  const store = o.store || {};
  const ls = o.blocked ? { getItem(){ throw new Error('blocked'); }, setItem(){ throw new Error('blocked'); } }
    : { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  const doc = { createElement: el, removeEventListener(){}, addEventListener(){}, body: el('body') };
  const pic = { ear: !!o.ear, sym: false, symOk: true, color: '#e33', size: 6, wrp: null };
  const build = fn(() => sec, pic, () => [], null, { cssColor: (c) => c }, () => el('div'), () => {}, () => {},
    () => {}, () => {}, () => {}, () => {}, key, ls, doc);
  build();
  const info = find(sec, (e) => e.className === 'wd-pic-info');
  const help = find(sec, (e) => e.id === 'wdPicHelp');
  return { sec, info, help, store, key, rebuild: () => { sec.children = []; build(); return { info: find(sec, (e) => e.className === 'wd-pic-info'), help: find(sec, (e) => e.id === 'wdPicHelp') }; } };
}

function judge(mod, html){
  const r = [], t = (ok, msg) => r.push([!!ok, msg]);
  let a;
  try{ a = run(mod); }catch(e){ t(false, '그리기 줄 그리기 — ' + String(e.message || e).slice(0, 80)); return r; }
  t(a.info && a.help, 'ⓘ 버튼과 접는 칸(#wdPicHelp)을 그린다');
  if(!a.info || !a.help) return r;
  t(a.info.getAttribute('aria-controls') === 'wdPicHelp' && a.info.type === 'button', '  ⓘ 는 접는 칸을 가리키는 버튼(aria-controls)');
  t(a.help.hidden === true && a.info.getAttribute('aria-expanded') === 'false', '★ 처음(기억 없음)에는 접혀 있다');
  t(/Ctrl\+Z/.test(textOf(a.help)) && !a.sec.children.some((c) => c !== a.help && /Ctrl\+Z/.test(textOf(c))), '  단축키 안내는 접는 칸 안에만 있다');
  t(/취소/.test(textOf(a.sec)) && /완료/.test(textOf(a.sec)), '  [취소] · [완료] 는 접는 칸 밖(늘 보임)');
  t(/^tw\./.test(a.key || ''), '  기억 키는 tw. 접두사(' + a.key + ')');
  a.info.onclick();
  t(a.help.hidden === false && a.info.getAttribute('aria-expanded') === 'true' && a.store[a.key] === '1', '★ ⓘ 를 누르면 펴지고 이 PC 에 기억한다');
  let b = a.rebuild();
  t(b.help.hidden === false, '  다시 그려도(다음 그리기) 펴진 채');
  b.info.onclick();
  t(b.help.hidden === true && a.store[a.key] === '0', '  다시 누르면 접히고 기억한다');
  b = a.rebuild();
  t(b.help.hidden === true, '  다시 그려도 접힌 채');
  let e;
  try{ e = run(mod, { ear: true }); }catch(_){ e = null; }
  t(e && /귀를 눌러/.test(textOf(e.help)) && !e.sec.children.some((c) => c !== e.help && /귀를 눌러/.test(textOf(c))), '귀에 그릴 때 귀 안내도 접는 칸 안');
  let bl;
  try{ bl = run(mod, { blocked: true }); }catch(_){ bl = null; }
  t(bl && bl.help && bl.help.hidden === true, '저장소가 막혀도 던지지 않고 접힌 채 그린다');
  t(/\.wd-pic-help\[hidden\]\{display:none;?\}/.test(html) && /\.wd-pic-help\{display:flex/.test(html), 'CSS — 접힌 칸은 display:none(.wd-pic-help 의 flex 가 hidden 속성을 이기지 않게)');
  t(/#focusSettingsPanel \.fs-info, #wdPicSection \.wd-pic-info\{/.test(html) && /#focusSettingsPanel \.fs-info\[aria-expanded="true"\], #wdPicSection \.wd-pic-info\[aria-expanded="true"\]\{/.test(html), 'CSS — ⓘ 모양은 설정 창 ⓘ 와 같은 규칙(따로 베끼지 않음)');
  return r;
}

say('── 1 · 2. 그리기 줄 도움말 접기');
judge(MOD, HTML).forEach(([ok, msg]) => chk(ok, msg));
say('── 3. mutation test — 하나라도 못 잡으면 빨강');
for(const [name, m, h] of [
  ['처음부터 펴짐', MOD.replace("_helpOpen = localStorage.getItem(WD_PIC_HELP_KEY) === '1';", "_helpOpen = localStorage.getItem(WD_PIC_HELP_KEY) !== '0';"), HTML],
  ['기억 안 함', MOD.replace("    try{ localStorage.setItem(WD_PIC_HELP_KEY, on ? '1' : '0'); }catch(_){}\n", ''), HTML],
  ['안내가 접는 칸 밖', MOD.replace('  help.appendChild(hint);\n', '  sec.appendChild(hint);\n'), HTML],
  ['접힌 칸이 안 숨음', MOD, HTML.replace('  .wd-pic-help[hidden]{display:none;}\n', '')],
]){
  const changed = m !== MOD || h !== HTML;
  let rows; try{ rows = judge(m, h); }catch(_){ rows = [[false, '던짐']]; }
  chk(changed && rows.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
