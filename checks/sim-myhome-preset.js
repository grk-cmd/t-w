/* sim-myhome-preset.js — 👑 디자인 프리셋 규칙(myhome-preset.js — 지금 디자인 → 칸 · 칸 → 지금 디자인 · 저장본 씻기 · 그림 키 · 그림 올릴 이름)
   실행:  node sim-myhome-preset.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — 이 판단이 디자인 스튜디오의 저장 · 불러오기 · 이름 · 칸 그리기 · IMG 올리기에 흩어져 있었다.
     칸에 담는 것과 칸에서 꺼내는 것이 어긋나면 불러온 디자인이 «초기화» 처럼 보인다(B-1013-8). 판단은 이 모듈 한 곳에만.
   ★ B-1013-8: 1번 칸에 그림 배경 저장 → 2번 칸에서 배경을 색으로 → 1번 불러오면 기본 배경. 칸이 색만 담아서였다.
     이제 칸은 색 · 그림 통째(img:true) · 그림은 칸마다 다른 파일. 표시 없는 옛 칸은 예전 규칙(색만 · 그림 그대로).
   ・1절: 순수 함수 입력 → 출력 · 경계값(빈 값 · 객체 저장본 · 상한 · 틀린 번호 · data: 그림) · 받은 값을 고치지 않는다
   ・1-2절: 제보 순서 그대로 · 옛 앱(그림 담기 전 판)이 새 저장본을 읽고 · 불러오고 · 다시 써도 깨지지 않는다
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
    /* 그림까지 담은 칸(img:true) — 바깥 그림을 살린다 · data: 그림은 버린다 · 표시는 true 만 */
    const v2 = P.normalize([{ name: 'a', theme: { tab: '#1', tabImg: 'https://i/t' }, bg: { img: 'https://i/b' }, img: true },
      { name: 'b', theme: {}, bg: { img: 'data:x', color: '#2' }, img: true }, { name: 'c', bg: { img: 'https://i/c' }, img: 'yes' }]);
    r.normV2 = J(v2[0]) === '{"name":"a","theme":{"tab":"#1","tabImg":"https://i/t"},"bg":{"img":"https://i/b"},"img":true}'
      && J(v2[1]) === '{"name":"b","theme":{},"bg":{"color":"#2"},"img":true}' && J(v2[2]) === '{"name":"c","theme":{},"bg":null}';
    /* 고른 칸 */
    r.cur = P.cur(2) === 2 && P.cur('1') === 1 && P.cur(3) === 0 && P.cur(-1) === 0 && P.cur(null) === 0 && P.cur(undefined) === 0 && P.cur('x') === 0;
    /* 지금 디자인 → 칸 */
    const home = { theme: { tab: '#111', tabImg: 'https://i/t', tabText: '', left: '#222', roomImg: 'data:old' }, bg: { color: '#333' } };
    const before = J(home);
    const s1 = P.snapshot(home, keys, '봄');
    r.snap = J(s1) === '{"name":"봄","theme":{"tab":"#111","tabImg":"https://i/t","left":"#222"},"bg":{"color":"#333"},"img":true}';
    r.snapImgBg = J(P.snapshot({ theme: null, bg: { img: 'https://i/b' } }, keys)) === '{"name":"","theme":{},"bg":{"img":"https://i/b"},"img":true}'
      && J(P.snapshot({ bg: { img: 'data:x' } }, keys)) === '{"name":"","theme":{},"bg":null,"img":true}'
      && J(P.snapshot(null, keys)) === '{"name":"","theme":{},"bg":null,"img":true}';
    r.snapPure = J(home) === before && s1.theme !== home.theme && s1.bg !== home.bg;
    /* 칸 → 지금 디자인 — 그림까지 담은 칸은 통째로 */
    const curV = { theme: { tab: '#999', tabImg: 'https://i/t2', name: '#888' }, bg: { color: '#777' } };
    const pv = { name: '', theme: { tab: '#111', tabImg: 'https://i/t' }, bg: { img: 'https://i/bg' }, img: true };
    const v = P.apply(curV, pv, keys);
    r.applyV2 = J(v) === '{"theme":{"tab":"#111","tabImg":"https://i/t"},"bg":{"img":"https://i/bg"}}' && v.theme !== pv.theme && v.bg !== pv.bg
      && J(P.apply(curV, { theme: null, bg: null, img: true }, keys)) === '{"theme":{},"bg":null}' && J(curV.theme) === '{"tab":"#999","tabImg":"https://i/t2","name":"#888"}';
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
    r.slot = P.uploadSlot(0, 'bg') === 'p0_bg' && P.uploadSlot(1, 'tabImg') === 'p1_tabImg' && P.uploadSlot('2', 'roomImg') === 'p2_roomImg'
      && P.uploadSlot(7, 'bg') === 'p0_bg' && P.uploadSlot(null, 'bg') === 'p0_bg' && /^[a-zA-Z0-9_-]+$/.test(P.uploadSlot(2, 'roomImg'));
    /* 1-2. 제보 순서(B-1013-8): 1번에 그림 배경 저장 → 2번 칸에서 배경을 색으로 바꿔 저장 → 1번 불러오기 */
    const d = { theme: { tab: '#1' }, bg: { img: 'https://st/design_p0_bg.jpg' } };
    const arr = P.normalize(null);
    arr[0] = P.snapshot(d, keys, '');
    d.bg = { color: '#abcdef' };
    arr[1] = P.snapshot(d, keys, '');
    const back = P.normalize(JSON.parse(J({ 0: arr[0], 1: arr[1] })));   // 저장 → RTDB → 다시 읽기
    const got = P.apply(d, back[0], keys);
    r.report = J(got.bg) === '{"img":"https://st/design_p0_bg.jpg"}' && J(P.apply(got, back[1], keys).bg) === '{"color":"#abcdef"}';
    /* 옛 앱(그림 담기 전 판 — 이 파일의 옛 규칙과 같은 글)이 새 저장본을 읽는다 */
    const oldNorm = (raw) => { const out = [null, null, null]; if(!raw || typeof raw !== 'object') return out;
      for(let i = 0; i < 3; i++){ const p = raw[i]; if(!p || typeof p !== 'object') continue;
        out[i] = { name: String(p.name || '').slice(0, 8), theme: (p.theme && typeof p.theme === 'object') ? p.theme : {}, bg: (p.bg && p.bg.color) ? { color: p.bg.color } : null }; }
      return out; };
    const oldApply = (h, p) => { const next = {}; Object.keys(h.theme || {}).forEach(k => { if(keys.has(k)) next[k] = h.theme[k]; });
      Object.keys(p.theme || {}).forEach(k => { if(!keys.has(k)) next[k] = p.theme[k]; });
      return { theme: next, bg: (h.bg && h.bg.img) ? h.bg : ((p.bg && p.bg.color) ? { color: p.bg.color } : null) }; };
    const saved = JSON.parse(J({ 0: arr[0], 2: arr[1] }));
    const o = oldNorm(saved);
    const oa = oldApply({ theme: { tabImg: 'https://i/mine' }, bg: { img: 'https://i/mybg' } }, o[0]);
    r.oldReads = o[0] && o[0].name === '' && !('img' in o[0]) && o[0].bg === null && o[1] === null && o[2].bg.color === '#abcdef'
      && J(oa) === '{"theme":{"tabImg":"https://i/mine","tab":"#1"},"bg":{"img":"https://i/mybg"}}';
    /* 옛 앱이 다른 칸에 저장하며 배열을 다시 쓰면(img 표시 · 바깥 그림이 빠진다) → 새 앱은 그 칸을 옛 칸으로 본다(그림 그대로 · 지우지 않음) */
    const rewritten = P.normalize(JSON.parse(J(o)));
    const ra = P.apply({ theme: { tabImg: 'https://i/mine' }, bg: { img: 'https://i/mybg' } }, rewritten[0], keys);
    r.oldWrites = !('img' in rewritten[0]) && J(ra) === '{"theme":{"tabImg":"https://i/mine","tab":"#1"},"bg":{"img":"https://i/mybg"}}';
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
chk(R.normEmpty && R.normObj && R.normCut, '저장본 씻기 — 늘 3칸 · 빈 자리 객체 저장본 · 넷째 칸 버림 · 이름 8자 · 이상한 theme · 표시 없는 칸의 bg 그림은 버린다');
chk(R.normV2, '  그림까지 담은 칸(img:true)은 바깥 그림을 살린다 · data: 그림은 버리고 색으로 · 표시는 true 만');
chk(R.cur, '고른 칸 — 0~2 만 · 문자열 숫자 · 틀린 값은 0');
chk(R.snap && R.snapImgBg, '★ 지금 디자인 → 칸 — 색 · 그림 키 · 바깥 그림 통째 + img 표시(빈 값 · data: 그림은 뺌)');
chk(R.snapPure, '  받은 디자인을 고치지 않는다(새 값)');
chk(R.applyV2, '★ 칸 → 지금 디자인 — 그림까지 담은 칸은 색 · 그림 통째로(칸에 없는 것은 지움 · 새 값)');
chk(R.apply && R.applyColorBg, '  표시 없는 옛 칸 — 예전처럼 색만 통째로 · 그림 키 · 깔린 바깥 그림은 그대로 · 그림 없으면 칸의 배경색(없으면 비움)');
chk(R.applyPure && R.applyNull, '  받은 값을 고치지 않는다 · 빈 디자인도 선다');
chk(R.slot, '그림 올릴 이름 — 고른 칸 번호 + 키(p0_bg · p1_tabImg) · 틀린 번호는 0 · 파일 이름에 쓸 수 있는 글자만');
say('── 1-2. 제보 순서 · 옛 앱');
chk(R.report, '★ B-1013-8 — 1번(그림 배경) 저장 → 2번(배경색) 저장 → 1번 불러오면 1번 그림 배경 · 2번은 그 색');
chk(R.oldReads, '옛 앱이 새 저장본을 읽어도 선다 — 그 칸은 색만 칸으로 보이고 불러오면 옛 규칙(지금 그림 그대로)');
chk(R.oldWrites, '옛 앱이 배열을 다시 쓴 칸은 새 앱이 옛 칸으로 본다 — 불러와도 지금 그림을 안 지운다');
say('── 2. 연결');
chk(W.order, 'html 이 myhome-preset.js 를 myhome-edit.js · app.js 보다 먼저 싣는다');
chk(W.takes && !W.calls.length, '편집 묶음이 이 모듈을 받아 판단을 부른다' + (W.calls.length ? ' — 안 부르는 것: ' + W.calls.join(' · ') : ''));
chk(!W.dup.length, '편집 묶음에 같은 판단을 다시 쓰지 않는다' + (W.dup.length ? ' — 남은 것: ' + W.dup.join(' · ') : ''));
say('── 3. 일부러 깨 보기');
chk(!judge(MOD.replace("if(t[k] && (!keys.has(k) || _storable(t[k]))) theme[k] = t[k];", "if(!keys.has(k) && t[k]) theme[k] = t[k];")).snap, '칸에 그림 키를 안 담으면(예전 색만) 빨강');
chk(!judge(MOD.replace("    bg   : _bgOf(h.bg, true),", "    bg   : _bgOf(h.bg, false),")).report, '칸에 바깥 그림을 안 담으면 제보 순서가 빨강');
chk(!judge(MOD.replace("if(t[k] && (!keys.has(k) || _storable(t[k]))) theme[k] = t[k];", 'if(t[k]) theme[k] = t[k];')).snap, 'data: 그림까지 칸에 담으면 빨강');
chk(!judge(MOD.replace("function uploadSlot(slot, key){ return 'p' + cur(slot) + '_' + String(key); }", 'function uploadSlot(slot, key){ return String(key); }')).slot, '그림 올릴 이름에 칸 번호를 빼면 빨강');
chk(!judge(MOD.replace("  if(preset.img === true){", '  if(true){')).oldWrites, '표시 없는 옛 칸까지 통째로 얹으면(지금 그림을 지움) 빨강');
chk(!judge(MOD.replace("Object.keys(curTheme).forEach(k=>{ if(keys.has(k)) theme[k] = curTheme[k]; });", '')).apply, '불러올 때 지금 그림을 안 살리면 빨강');
chk(!judge(MOD.replace("return (n >= 0 && n < MAX) ? n : 0;", 'return n;')).cur, '고른 칸 번호를 안 거르면 빨강');
const lateHtml = HTML.replace('<script src="parts/myhome/myhome-preset.js"></script>', '').replace('<script src="parts/app.js"></script>', '<script src="parts/app.js"></script>\n<script src="parts/myhome/myhome-preset.js"></script>');
chk(!wiring(EDIT, lateHtml).order, 'myhome-preset.js 를 app.js 뒤로 옮기면 빨강');
chk(wiring(EDIT + '\nfunction x(imgKeys){ return imgKeys.has(1); }\n', HTML).dup.length > 0, '편집 묶음에 그림 키 걸러내기를 다시 쓰면 빨강');

say('\n' + (fail ? '✗ 통과 ' + pass + ' · 실패 ' + fail : '전부 통과 ✅ ' + pass + ' — 디자인 프리셋 판단은 myhome-preset.js 한 곳'));
process.exit(fail ? 1 : 0);
