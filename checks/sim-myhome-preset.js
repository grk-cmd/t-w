/* sim-myhome-preset.js — 👑 디자인 프리셋 규칙(myhome-preset.js — 지금 디자인 → 칸 · 칸 → 지금 디자인 · 저장본 씻기 · 그림 키 · 그림 올릴 이름)
   실행:  node sim-myhome-preset.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — 이 판단이 디자인 스튜디오의 저장 · 불러오기 · 이름 · 칸 그리기 · IMG 올리기에 흩어져 있었다.
     칸에 담는 것과 칸에서 꺼내는 것이 어긋나면 불러온 디자인이 «초기화» 처럼 보인다(B-1013-8). 판단은 이 모듈 한 곳에만.
   ・1절: 순수 함수 입력 → 출력 · 경계값(빈 값 · 객체 저장본 · 상한 · 틀린 번호) · 받은 값을 고치지 않는다
   ・2절: 연결 — html 이 myhome-edit.js · app.js 보다 먼저 싣는다 · 편집 묶음이 이 모듈을 부른다(같은 판단을 다시 쓰지 않는다)
   ・3절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, path.basename(f)]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('myhome/myhome-preset.js'), EDIT = read('myhome/myhome-edit.js'), HTML = read('desk-companion-prototype.html');
if (!MOD || !EDIT || !HTML) { say('  ? 원본 못 찾음 — myhome-preset.js · myhome-edit.js · desk-companion-prototype.html'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
const J = JSON.stringify;
const load = (src) => { const win = {}; new Function('window', 'module', src + '\nreturn window.TwMyHomePreset;')(win, undefined); return win; };

/* 디자인 스튜디오 항목 표 모양(그룹 줄 · 바깥 배경 special · imgKey 를 따로 준 줄 · 그림 없는 줄) */
const ROWS = {
  home: [{ group: '바깥' }, { key: 'outer', img: true, special: 'bg' }, { key: 'tab', img: true }, { key: 'tabText' }, { key: 'roomBg', img: true, imgKey: 'roomImg' }],
  friend: [{ key: 'fList', img: true }, { group: '그룹', img: true }],
};

function judge(mod){
  const r = {};
  try {
    const win = load(mod), P = win.TwMyHomePreset;
    r.only = Object.keys(win).join() === 'TwMyHomePreset';
    r.consts = P.MAX === 3 && P.NAME_MAX === 8;
    /* 그림 키 */
    const keys = P.imgKeys(ROWS);
    r.imgKeys = J([...keys].sort()) === J(['fListImg', 'outerImg', 'roomImg', 'tabImg']) && P.imgKeys(null).size === 0 && P.imgKeys({ a: null }).size === 0;
    r.imgKeyOf = P.imgKeyOf({ key: 'tab' }) === 'tabImg' && P.imgKeyOf({ key: 'roomBg', imgKey: 'roomImg' }) === 'roomImg';
    /* 저장본 씻기 */
    const n0 = P.normalize(null), n1 = P.normalize('x');
    r.normEmpty = J(n0) === '[null,null,null]' && J(n1) === '[null,null,null]' && J(P.normalize([])) === '[null,null,null]';
    const obj = P.normalize({ 2: { name: '겨울', theme: { tab: '#fff' } }, 3: { name: '넘침' } });
    r.normObj = J(obj) === J([null, null, { name: '겨울', theme: { tab: '#fff' }, bg: null }]);
    const cut = P.normalize([{ name: '봄봄봄봄봄봄봄봄봄봄', theme: 'x', bg: { color: '#1', img: 'https://i/b' } }, 5, { name: 0, bg: { img: 'https://i/c' } }]);
    r.normCut = cut[0].name === '봄봄봄봄봄봄봄봄' && J(cut[0].theme) === '{}' && J(cut[0].bg) === '{"color":"#1"}' && cut[1] === null && J(cut[2]) === '{"name":"","theme":{},"bg":null}';
    /* 고른 칸 */
    r.cur = P.cur(2) === 2 && P.cur('1') === 1 && P.cur(3) === 0 && P.cur(-1) === 0 && P.cur(null) === 0 && P.cur(undefined) === 0 && P.cur('x') === 0;
    /* 지금 디자인 → 칸 */
    const home = { theme: { tab: '#111', tabImg: 'https://i/t', tabText: '', left: '#222' }, bg: { color: '#333' } };
    const before = J(home);
    const s1 = P.snapshot(home, keys, '봄');
    r.snap = J(s1) === '{"name":"봄","theme":{"tab":"#111","left":"#222"},"bg":{"color":"#333"}}';
    r.snapImgBg = J(P.snapshot({ theme: null, bg: { img: 'https://i/b' } }, keys)) === '{"name":"","theme":{},"bg":null}' && J(P.snapshot(null, keys)) === '{"name":"","theme":{},"bg":null}';
    r.snapPure = J(home) === before && s1.theme !== home.theme && s1.bg !== home.bg;
    /* 칸 → 지금 디자인 */
    const cur = { theme: { tab: '#999', tabImg: 'https://i/t2', name: '#888' }, bg: { img: 'https://i/bg' } };
    const curBefore = J(cur);
    const preset = { name: '', theme: { tab: '#111', left: '#222', tabImg: 'https://i/섞임' }, bg: { color: '#333' } };
    const a1 = P.apply(cur, preset, keys);
    r.apply = J(a1.theme) === '{"tabImg":"https://i/t2","tab":"#111","left":"#222"}' && a1.bg === cur.bg;
    const a2 = P.apply({ theme: { tab: '#1' }, bg: { color: '#2' } }, preset, keys);
    r.applyColorBg = J(a2.bg) === '{"color":"#333"}' && a2.bg !== preset.bg && J(P.apply({ bg: { color: '#2' } }, { theme: {}, bg: null }, keys)) === '{"theme":{},"bg":null}';
    r.applyPure = J(cur) === curBefore && a1.theme !== cur.theme && J(preset.theme) === '{"tab":"#111","left":"#222","tabImg":"https://i/섞임"}';
    r.applyNull = J(P.apply(null, { theme: null, bg: null }, keys)) === '{"theme":{},"bg":null}';
    /* 그림 올릴 이름 */
    r.slot = P.uploadSlot('bg') === 'bg' && P.uploadSlot('tabImg') === 'tabImg' && P.uploadSlot('roomImg') === 'roomImg';
  } catch (e) { r.err = String(e && e.stack || e).split('\n').slice(0, 2).join(' / '); }
  return r;
}
function wiring(edit, html){
  const r = {};
  const order = [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*\bsrc="parts\/([^"]+\.js)"/g)].map(m => m[1]);
  const at = order.indexOf('myhome/myhome-preset.js');
  r.order = at >= 0 && at < order.indexOf('myhome/myhome-edit.js') && at < order.indexOf('app.js');
  const code = strip(edit);
  r.takes = /const mhPreset = TwMyHomePreset;/.test(code);
  r.calls = ['normalize', 'cur', 'snapshot', 'apply', 'imgKeys', 'imgKeyOf', 'uploadSlot'].filter(n => !new RegExp('\\bmhPreset\\.' + n + '\\(').test(code));
  /* 같은 판단을 편집 묶음에 다시 쓰지 않는다 — 그림 키 걸러내기 · 저장본 배열 만들기 · 그림 키 이름 짓기 · 올릴 이름 */
  r.dup = [/imgKeys\.has\(/, /new Array\(MH_PRESET_MAX\)/, /row\.imgKey \|\|/, /isBg \? 'bg' : String\(imgKey\)/].filter(re => re.test(code)).map(String);
  return r;
}

const R = judge(MOD), W = wiring(EDIT, HTML);
say('── 1. 순수 함수');
chk(!R.err && R.only && R.consts, '싣기만 하면 window.TwMyHomePreset 하나 · 칸 3 · 이름 8자' + (R.err ? ' — ' + R.err : ''));
chk(R.imgKeys && R.imgKeyOf, '그림 키 — 항목 표에서 뽑는다(그룹 줄 빼고 · imgKey 를 따로 준 줄 · 빈 표는 빈 집합)');
chk(R.normEmpty && R.normObj && R.normCut, '저장본 씻기 — 늘 3칸 · 빈 자리 객체 저장본 · 넷째 칸 버림 · 이름 8자 · 이상한 theme · bg 그림은 버린다');
chk(R.cur, '고른 칸 — 0~2 만 · 문자열 숫자 · 틀린 값은 0');
chk(R.snap && R.snapImgBg, '★ 지금 디자인 → 칸 — 색만(그림 키 · 빈 색 · 바깥 그림 뺌)');
chk(R.snapPure, '  받은 디자인을 고치지 않는다(새 값)');
chk(R.apply && R.applyColorBg, '★ 칸 → 지금 디자인 — 색은 통째로 갈리고 그림 키 · 깔린 바깥 그림은 그대로 · 그림 없으면 칸의 배경색(없으면 비움)');
chk(R.applyPure && R.applyNull, '  받은 값을 고치지 않는다 · 빈 디자인도 선다');
chk(R.slot, '그림 올릴 이름 — 바깥 배경 bg · 그 밖 그림 키 그대로');
say('── 2. 연결');
chk(W.order, 'html 이 myhome-preset.js 를 myhome-edit.js · app.js 보다 먼저 싣는다');
chk(W.takes && !W.calls.length, '편집 묶음이 이 모듈을 받아 판단을 부른다' + (W.calls.length ? ' — 안 부르는 것: ' + W.calls.join(' · ') : ''));
chk(!W.dup.length, '편집 묶음에 같은 판단을 다시 쓰지 않는다' + (W.dup.length ? ' — 남은 것: ' + W.dup.join(' · ') : ''));
say('── 3. 일부러 깨 보기');
chk(!judge(MOD.replace("if(!keys.has(k) && t[k]) theme[k] = t[k];", 'theme[k] = t[k];')).snap, '칸에 그림 키를 담으면 빨강');
chk(!judge(MOD.replace("Object.keys(curTheme).forEach(k=>{ if(keys.has(k)) theme[k] = curTheme[k]; });", '')).apply, '불러올 때 지금 그림을 안 살리면 빨강');
chk(!judge(MOD.replace("return (n >= 0 && n < MAX) ? n : 0;", 'return n;')).cur, '고른 칸 번호를 안 거르면 빨강');
const lateHtml = HTML.replace('<script src="parts/myhome/myhome-preset.js"></script>', '').replace('<script src="parts/app.js"></script>', '<script src="parts/app.js"></script>\n<script src="parts/myhome/myhome-preset.js"></script>');
chk(!wiring(EDIT, lateHtml).order, 'myhome-preset.js 를 app.js 뒤로 옮기면 빨강');
chk(wiring(EDIT + '\nfunction x(imgKeys){ return imgKeys.has(1); }\n', HTML).dup.length > 0, '편집 묶음에 그림 키 걸러내기를 다시 쓰면 빨강');

say('\n' + (fail ? '✗ 통과 ' + pass + ' · 실패 ' + fail : '전부 통과 ✅ ' + pass + ' — 디자인 프리셋 판단은 myhome-preset.js 한 곳'));
process.exit(fail ? 1 : 0);
