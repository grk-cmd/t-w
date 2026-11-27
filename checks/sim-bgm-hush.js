/* sim-bgm-hush.js — 🔇 듣던 유튜브 BGM 재우기 · 되살리기(parts/shared/bgm-hush.js)를 실제로 돌려 본다
   실행: node checks/run.js sim-bgm-hush
   ・1절 재우기 — 나던 쪽만(플레이리스트 · 마이홈) · pauseBgm 한 번 · ▶ 표시 내림 · 나던 것이 없으면 null
   ・2절 되살리기 — 재웠던 쪽만 · 그 사이 사용자가 다시 틀었으면 안 건드림 · null 이면 아무것도 안 함 · companion 없음
   ・3절 배선 — html · smoke 순서 · 스티커사진 창이 이 모듈을 쓴다(옛 몸통이 두 벌로 남지 않음)
   ・4절 mutation test */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = read('shared/bgm-hush.js'), HTML = read('desk-companion-prototype.html'), SMOKE = read('smoke.js'), PKUI = read('purikura/purikura-ui.js');
if(!SRC || !HTML || !SMOKE || !PKUI){ say('  ? 원본 못 찾음'); process.exit(2); }
const load = (src) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w.TwBgmHush; };

function world(src, o){
  const e = Object.assign({ pl: false, home: false, pause: 0, resume: 0, render: 0, noCompanion: false, throwing: false }, o || {});
  const c = { pauseBgm(){ e.pause++; if(e.throwing) throw new Error('x'); }, resumeBgm(){ e.resume++; if(e.throwing) throw new Error('x'); } };
  e.H = load(src).createBgmHush({ companion: () => (e.noCompanion ? null : c), plPlaying: () => e.pl, setPlPlaying: (v) => { e.pl = v; }, plRender: () => { e.render++; },
    homePlaying: () => e.home, setHomePlaying: (v) => { e.home = v; } });
  return e;
}
const J = JSON.stringify;

function judge(src){
  const r = []; const t = (ok, msg) => r.push([!!ok, msg]);
  let e = world(src, { pl: true });
  let h = e.H.hush();
  t(J(h) === '{"pl":true,"home":false}' && e.pause === 1 && e.pl === false && e.render === 1, '플레이리스트가 나던 중 — pauseBgm 한 번 · ▶ 표시를 내리고 다시 그린다 · { pl:true }');
  e.H.unhush(h);
  t(e.resume === 1 && e.pl === true && e.render === 2 && e.home === false, '  ↳ 되살리기 — resumeBgm 한 번 · 재웠던 플레이리스트만 다시 켠다');
  e = world(src, { home: true }); h = e.H.hush();
  t(J(h) === '{"pl":false,"home":true}' && e.pause === 1 && e.home === false && e.render === 0, '마이홈 BGM 이 나던 중 — 그쪽 표시만 내린다');
  e.H.unhush(h);
  t(e.resume === 1 && e.home === true && e.pl === false, '  ↳ 되살리기 — 마이홈 쪽만');
  e = world(src, {}); h = e.H.hush();
  t(h === null && e.pause === 0, '나던 것이 없으면 재우지 않는다(null · pauseBgm 안 부름)');
  e.H.unhush(h); e.H.unhush(undefined);
  t(e.resume === 0, '  ↳ null 을 되살려도 아무것도 안 한다');
  e = world(src, { pl: true }); h = e.H.hush(); e.pl = true;   // 그 사이 사용자가 직접 다시 틀었다
  e.H.unhush(h);
  t(e.resume === 0, '★ 그 사이 사용자가 다시 틀었으면 되살리지 않는다(두 소리가 겹치지 않게)');
  e = world(src, { pl: true }); h = e.H.hush(); e.home = true; e.H.unhush(h);
  t(e.resume === 0 && e.pl === false, '  ↳ 다른 쪽(마이홈)을 틀었어도 마찬가지');
  e = world(src, { pl: true, noCompanion: true }); h = e.H.hush();
  t(h === null && e.pl === true, '재생 창을 못 쓰면(companion 없음) 재우지 않고 표시도 그대로');
  e = world(src, { pl: true, throwing: true }); let threw = false;
  try{ h = e.H.hush(); e.H.unhush(h); }catch(_){ threw = true; }
  t(!threw && e.pause === 1 && e.resume === 1 && e.pl === true, 'pauseBgm · resumeBgm 이 던져도 서지 않는다');
  const a = world(src, { pl: true }), ha = a.H.hush(), hb = a.H.hush();
  t(J(ha) === '{"pl":true,"home":false}' && hb === null, '상태를 들지 않는다 — 이미 재운 뒤 다시 물으면 null(부르는 쪽이 들고 있다)');
  return r;
}

say('── 1 · 2절 재우기 · 되살리기');
judge(SRC).forEach(([ok, msg]) => chk(ok, msg));

say('── 3절 배선');
{
  const at = (s, x) => s.indexOf(x);
  const iH = at(HTML, '<script src="parts/shared/bgm-hush.js"></script>');
  chk(iH > 0 && iH < at(HTML, '<script src="parts/purikura/purikura-ui.js"></script>') && iH < at(HTML, '<script src="parts/app.js"></script>'), 'html — bgm-hush.js 를 purikura-ui.js · app.js 보다 먼저');
  const sH = at(SMOKE, "PRELOAD.push('bgm-hush.js');");
  chk(sH > 0 && sH < at(SMOKE, "PRELOAD.push('purikura-ui.js');"), 'smoke PRELOAD — bgm-hush.js 를 purikura-ui.js 보다 먼저');
  chk(/const pkBgmHush = TwBgmHush\.createBgmHush\(\{/.test(PKUI) && /function _pkHushOthers\(\)\{ PK\.hushed = pkBgmHush\.hush\(\); \}/.test(PKUI) && /pkBgmHush\.unhush\(h\);/.test(PKUI)
    && !/companion\.pauseBgm\(\)|companion\.resumeBgm\(\)/.test(PKUI), '★ 스티커사진 창은 이 모듈을 쓴다 — pauseBgm · resumeBgm 을 직접 부르는 옛 몸통이 없다');
}

say('── 4절 mutation test');
{
  const muts = [
    ['다시 튼 것을 안 보고 되살림', SRC.replace('    if(plPlaying() || homePlaying()) return;\n', '')],
    ['나던 것이 없어도 재움', SRC.replace('    if(!pl && !home) return null;\n', '')],
    ['▶ 표시를 안 내림', SRC.replace('    if(pl){ setPlPlaying(false); plRender(); }\n', '')],
    ['마이홈 쪽을 안 되살림', SRC.replace('    if(h.home) setHomePlaying(true);\n', '')],
    ['재운 쪽이 아니어도 플레이리스트를 켬', SRC.replace('    if(h.pl){ setPlPlaying(true); plRender(); }', '    setPlPlaying(true); plRender();')],
  ];
  for(const [name, m] of muts){
    let red = false;
    try{ red = judge(m).some(([ok]) => !ok); }catch(_){ red = true; }
    chk(m !== SRC && red, name + ' → 빨강' + (m === SRC ? ' — 바꿀 글을 못 찾음' : ''));
  }
}

say(`\n${fail ? '✗' : '✓'} ${pass} 통과 · ${fail} 실패`);
console.log(pass + ' · ' + fail);
process.exit(fail ? 1 : 0);
