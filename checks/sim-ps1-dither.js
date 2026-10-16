/* sim-ps1-dither.js — 🕹️ PS1 디더 규칙(shared/ps1-dither.js) — 도트 모드 셰이더와 스티커사진 PS1 필터가 한 값을 읽는지
   ・1절: 값 · 순수 함수 — 색 단계 · Bayer 표(0~15 한 번씩) · 임계값 격자 되풀이 · 스냅 경계값(0 · 1 · 단계 배수 · 밖으로 나감)
   ・2절: 도트 모드 — dot-render.js 가 만든 셰이더 글의 Bayer 16칸 · 색 단계가 공용 값이고, 공백을 빼면 묶기 전 글과 같다
   ・3절: 스티커사진 — purikura-net.js applyFilter('ps1') 결과가 묶기 전 식(제 Bayer 표 · 16단계)과 픽셀까지 같다 · 제 값을 따로 안 든다
   ・3절 끝: 숨은 전제 — 두 쪽이 TwPs1Dither 가 «먼저 실려 있다» 고 믿는다 → html 이 ps1-dither.js 를 둘보다 먼저 · app.js 가 deps 로 넘긴다
   ・4절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const pick = (names) => names.map(f => { try{ return [f, fs.readFileSync(f, 'utf8')]; }catch(_){ return null; } }).find(Boolean);
const D_ = pick(['ps1-dither.js', 'parts/shared/ps1-dither.js', 'app/parts/shared/ps1-dither.js']);
const R_ = pick(['dot-render.js', 'parts/shared/dot-render.js', 'app/parts/shared/dot-render.js']);
const N_ = pick(['purikura-net.js', 'parts/purikura/purikura-net.js', 'app/parts/purikura/purikura-net.js']);
const H_ = pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']), A_ = pick(['app.js', 'parts/app.js', 'app/parts/app.js']);
if(!D_ || !R_ || !N_ || !H_ || !A_){ say('  ? 원본 못 찾음 — ps1-dither.js · dot-render.js · purikura-net.js · desk-companion-prototype.html · app.js'); process.exit(2); }
const OLD_BAYER = [0,8,2,10, 12,4,14,6, 3,11,1,9, 15,7,13,5], OLD_LEVELS = 16;   // 묶기 전 두 곳에 따로 있던 값
const load = (src) => { const win = {}, mod = { exports: {} }; new Function('window', 'module', src)(win, mod); return win.TwPs1Dither || mod.exports; };

function judge(dSrc, rSrc, nSrc, html, app){
  const r = []; const t = (ok, msg) => r.push([!!ok, msg]);
  let D; try{ D = load(dSrc); }catch(e){ t(false, '공용 모듈을 싣는다 — ' + e.message); return r; }
  /* 1. 값 · 순수 함수 */
  t(D && D.PS1_LEVELS === OLD_LEVELS && Object.isFrozen(D) && Object.isFrozen(D.BAYER4), '색 단계 16 · 내보내는 것과 표는 얼려 있다');
  t(D.BAYER4.length === 16 && [...D.BAYER4].sort((a, b) => a - b).every((v, i) => v === i) && D.BAYER4.every((v, i) => v === OLD_BAYER[i]), 'Bayer 표 — 0~15 가 한 번씩 · 묶기 전 표와 같은 순서');
  t(D.bayerThreshold(0, 0) === 0 && D.bayerThreshold(1, 0) === 0.5 && D.bayerThreshold(0, 3) === 15 / 16 && D.bayerThreshold(4, 4) === D.bayerThreshold(0, 0) && D.bayerThreshold(7, 6) === D.bayerThreshold(3, 2), '임계값 — 0 · 0.5 · 15/16 · 4칸마다 되풀이');
  const q = D.ditherQuantize;
  t(q(0, 0.5) === 0 && q(1, 0.5) === 1 && q(0.5, 0.5) === 0.5, '스냅 — 가운데 임계값이면 0 · 1 · 0.5 는 그대로');
  t(q(0, 0) === 0 && q(1, 15 / 16) === 1 && q(1 / 32, 0) === 0 && q(1 / 32 + 1e-9, 1) === 1 / 16, '스냅 경계 — 반 단계에서 갈린다');
  let multiples = true, inRange = true, sameAsOld = true;
  for(let v = 0; v <= 255; v++) for(let k = 0; k < 16; k++){
    const tt = OLD_BAYER[k] / 16, got = q(v / 255, tt);
    if(Math.abs(got * 16 - Math.round(got * 16)) > 1e-9) multiples = false;
    if(got < -1 / 16 - 1e-12 || got > 1 + 1 / 16 + 1e-12) inRange = false;
    let o = v / 255 + (tt - 0.5) / OLD_LEVELS; o = Math.floor(o * OLD_LEVELS + 0.5) / OLD_LEVELS;   // 묶기 전 스티커사진 식 그대로
    if(got !== o) sameAsOld = false;
  }
  t(multiples && inRange, '0~255 × 임계값 16개 — 결과는 늘 1/16 배수 · 한 단계 넘게 밖으로 안 나간다(자르기는 부르는 쪽)');
  t(sameAsOld, '  묶기 전 식과 비트까지 같다(연산 순서 그대로)');
  /* 2. 도트 모드 셰이더 글 */
  let frag = '';
  try{
    const win = {}; new Function('window', 'module', 'THREE', rSrc)(win, undefined, { NearestFilter: 1003 });
    const m = { userData: {}, onBeforeCompile: function(){} };
    const R = win.TwDotRender.createDotRender({ scene: { traverse: (cb) => cb({ isMesh: true, material: m }) }, ps1Dither: D });
    R.applyPS1Shader(true);
    const sh = { fragmentShader: 'void main(){\n#include <dithering_fragment>\n}' }; m.onBeforeCompile(sh); frag = sh.fragmentShader;
  }catch(e){ frag = ''; t(false, '도트 셰이더 글 만들기 — ' + e.message); }
  t(D.BAYER4.every((v, i) => frag.includes('_bayer[' + i + ']=' + v.toFixed(1) + ';')) && frag.includes('float _levels = ' + D.PS1_LEVELS.toFixed(1) + ';'), '도트 셰이더 — Bayer 16칸 · 색 단계가 공용 값');
  const OLD_ROWS = '_bayer[0]=0.0;  _bayer[1]=8.0;  _bayer[2]=2.0;  _bayer[3]=10.0;\n  _bayer[4]=12.0; _bayer[5]=4.0;  _bayer[6]=14.0; _bayer[7]=6.0;\n  _bayer[8]=3.0;  _bayer[9]=11.0; _bayer[10]=1.0; _bayer[11]=9.0;\n  _bayer[12]=15.0;_bayer[13]=7.0; _bayer[14]=13.0;_bayer[15]=5.0;';
  const ns = (s) => s.replace(/\s+/g, '');
  const rows = (frag.match(/_bayer\[0\][\s\S]*?_bayer\[15\]=[\d.]+;/) || [''])[0];
  t(rows && ns(rows) === ns(OLD_ROWS), '  공백을 빼면 묶기 전 셰이더 글과 같다');
  t(!/_bayer\[\d+\]=\d/.test(rSrc) && !/_PS1_LEVELS = 16/.test(rSrc), '  dot-render.js 에 제 Bayer 숫자 · 16 을 따로 안 든다');
  /* 3. 스티커사진 PS1 필터 */
  let P = null; try{ global.TwPs1Dither = D; const mod = { exports: {} }; new Function('module', 'window', nSrc + '\n;module.exports = Purikura;')(mod, undefined); P = mod.exports; }catch(e){ t(false, 'purikura-net.js 싣기 — ' + e.message); }
  if(P){
    const W = 48, H = 36, k = 1, blk = Math.max(1, Math.round(P.PS1_BLOCK * k)), sw = Math.max(2, Math.round(W / blk)), sh = Math.max(2, Math.round(H / blk));
    const SRC = new Uint8ClampedArray(sw * sh * 4); for(let i = 0; i < SRC.length; i++) SRC[i] = (i * 37 + 11) % 256;
    let OUT = null;
    const mk = () => ({ getContext: () => ({ clearRect(){}, drawImage(){}, getImageData: () => ({ data: new Uint8ClampedArray(SRC) }), putImageData: (d) => { OUT = d.data; } }) });
    const g = { save(){}, restore(){}, drawImage(){} };
    try{ P.applyFilter(g, {}, W, H, 'ps1', k, mk); }catch(e){ OUT = null; }
    const want = new Uint8ClampedArray(SRC);
    for(let y = 0; y < sh; y++) for(let x = 0; x < sw; x++){
      const i = (y * sw + x) * 4, tt = OLD_BAYER[(y % 4) * 4 + (x % 4)] / 16;
      for(let c = 0; c < 3; c++){ let v = want[i + c] / 255 + (tt - 0.5) / OLD_LEVELS; v = Math.floor(v * OLD_LEVELS + 0.5) / OLD_LEVELS * 255; want[i + c] = v < 0 ? 0 : (v > 255 ? 255 : v); }
    }
    t(OUT && OUT.length === want.length && OUT.every((v, i) => v === want[i]), '스티커사진 PS1 — 결과 픽셀이 묶기 전 식과 하나하나 같다(' + sw + '×' + sh + ')');
  }
  t(!/\[0,8,2,10/.test(nSrc.replace(/\s/g, '')) && !/PS1_LEVELS\s*=/.test(nSrc) && /TwPs1Dither/.test(nSrc), '  purikura-net.js 에 제 Bayer 표 · 색 단계를 따로 안 든다(공용을 읽는다)');
  /* 숨은 전제 — purikura-net.js 는 부를 때 전역 TwPs1Dither 를, dot-render.js 는 deps 로 받는다. 둘 다 «먼저 실려 있다» 가 html 순서에만 기대므로 여기서 묶어 둔다 */
  const at = (f) => html.indexOf('<script src="parts/' + f + '"></script>');
  const iD = at('shared/ps1-dither.js'), iN = at('purikura/purikura-net.js'), iR = at('shared/dot-render.js'), iA = at('app.js');
  t(iD > 0 && iD < iN && iD < iR && iR < iA, '숨은 전제 — html 이 ps1-dither.js 를 purikura-net.js · dot-render.js 보다 먼저 싣는다');
  t(/const dotRenderMod = TwDotRender\.createDotRender\(\{[^}]*\n  ps1Dither: TwPs1Dither,\n/.test(app), '  app.js 가 dot-render 에 ps1Dither: TwPs1Dither 를 넘긴다');
  return r;
}

say('── 1~3. 값 · 도트 셰이더 · 스티커사진 필터');
const rows = judge(D_[1], R_[1], N_[1], H_[1], A_[1]);
rows.forEach(([ok, msg]) => chk(ok, msg));
say('── 4. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 에서 ps1-dither.js 를 뒤로', null, null, null, h => h.replace(/<script src="parts\/shared\/ps1-dither\.js"><\/script>[^\n]*\n/, '').replace('<script src="parts/app.js"></script>', '<script src="parts/shared/ps1-dither.js"></script>\n<script src="parts/app.js"></script>')],
  ['공용 색 단계를 바꿈', d => d.replace('const PS1_LEVELS = 16;', 'const PS1_LEVELS = 8;'), null, null],
  ['공용 표 한 칸을 바꿈', d => d.replace('[0,8,2,10,', '[0,8,10,2,'), null, null],
  ['스냅 식의 흔드는 양을 바꿈', d => d.replace('(v + (t - 0.5) / PS1_LEVELS)', '(v + (t - 0.25) / PS1_LEVELS)'), null, null],
  ['도트 쪽이 제 16 을 다시 듦', null, r => r.replace('const _PS1_LEVELS = ps1Dither.PS1_LEVELS;', 'const _PS1_LEVELS = 16;'), null],
  ['스티커사진이 제 표를 다시 듦', null, null, n => n.replace('var D = TwPs1Dither;', 'var D = TwPs1Dither; var bay = [0,8,2,10, 12,4,14,6, 3,11,1,9, 15,7,13,5];')],
];
for(const [name, fd, fr, fn, fh] of breaks){
  const d2 = fd ? fd(D_[1]) : D_[1], r2 = fr ? fr(R_[1]) : R_[1], n2 = fn ? fn(N_[1]) : N_[1], h2 = fh ? fh(H_[1]) : H_[1];
  const changed = d2 !== D_[1] || r2 !== R_[1] || n2 !== N_[1] || h2 !== H_[1];
  let rows2; try{ rows2 = judge(d2, r2, n2, h2, A_[1]); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
