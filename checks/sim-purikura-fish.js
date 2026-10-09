/* ═══ 🐟 sim-purikura-fish.js — 스티커사진 필터 «어안» (2026-10-08 신설 · 필터 시안 8 확정) ═══════════════
   ・1절: 필터 줄 — 일곱 칸 · 순서 없음 · 뽀샤시 · PS1 · 어안 · 흑백 · 새벽 · 빈티지
   ・2절: 좌표표 — 꽉 찬 어안(귀퉁이 = 귀퉁이) · 가운데 약 3.6배 · 비율로만 계산(무대 · 사진이 같은 모양) · (w,h)별 캐시
   ・3절: 다시 놓기 — 이웃 넷 섞기(계단 없음) · 가장자리 살짝 어둡게 · 투명도는 그대로
   ・4절: applyFilter 한 갈래 — 태그 붙은 딴 캔버스 · willReadFrequently · 결과 판 재사용
   ・5절: 업데이트 안 한 참가자 — 자리에 fx · 방장에게 «○○님은 업데이트가 필요해서 필터 없이 찍혀요» ·
          서버 규칙이 옛 판(fx 를 모름)이면 fx 없이 다시 잡는다 — 안 그러면 스티커사진 버튼이 반응 없음(2026-10-09 제보)
   ・6절: 규칙 — meta/filter 에 fish · slots/$i 에 fx
   ・7절: app.js · html 배선 — 줄 일곱 칸 · 자리가 바뀌면 안내를 다시
   ⚠️ 실제 무대 · 사진은 2026-10-08 헤드리스 크로미움에서 확인했다.
   [실행] purikura-net.js · firebase-database-rules.json · app.js · desk-companion-prototype.html 이 있는 폴더에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = ['purikura-net.js', 'firebase-database-rules.json', 'app.js', 'desk-companion-prototype.html'];
const SRC = {};
for(const f of need){ SRC[f] = read(f); if(SRC[f] == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } }
const P = require(require('path').resolve('purikura-net.js'));
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-3);
/* 절마다 따로 — 옛 코드(어안 없음)에 대면 멈추지 않고 그 절을 빨강 하나로 센다 */
const sec = (title, fn) => { say(title); try{ fn(); }catch(e){ chk(false, '이 절을 못 돌았다 — ' + e.message); } };
const later = [];   // 비동기 검사 — 맨 끝에서 기다린다

sec('── 1. 필터 줄', () => {
  const ids = P.filterList().map(f => f.id).join(',');
  chk(ids === 'none,soft,ps1,fish,mono,dawn,vint', '일곱 칸 · 모양 셋 다음에 색감 셋 (' + ids + ')');
  const fi = P.filterOf('fish');
  chk(fi.name === '어안' && fi.sub === '볼록렌즈', '이름 «어안» · 부제 «볼록렌즈»');
  chk(P.filterAllowed('fish') && P.filterIn('fish') === 'fish' && P.filterIn('toon') === 'none', '어안은 받고 · 빠진 «만화» 는 여전히 «없음» 으로 접는다');
  chk(P.FISH_S === 0.72 && near(1 / (1 - P.FISH_S), 3.57, 0.01), '렌즈 세기 0.72 고정 — 가운데 약 3.6배');
});

sec('── 2. 좌표표', () => {
  /* 결과 칸 (x,y) 가 원본 어디를 읽는가 — 표에서 거꾸로 꺼낸다 */
  const srcAt = (m, x, y) => { const j = y * m.w + x, i = m.i0[j]; return [i % m.w + m.ax[j], Math.floor(i / m.w) + m.ay[j]]; };
  const S = P.fishMap(306, 420), L = P.fishMap(540, 740), T = P.fishMap(46, 62);
  chk(P.fishMap(306, 420) === S, '같은 크기는 표를 다시 안 만든다(캐시)');
  chk(S.i0.length === 306 * 420 && L.i0.length === 540 * 740 && T.i0.length === 46 * 62, '무대 · 사진 · 축소판 세 벌');
  let c0 = srcAt(S, 0, 0), c1 = srcAt(S, 305, 419);
  chk(c0[0] < 1 && c0[1] < 1 && c1[0] > 304 && c1[1] > 418, '꽉 찬 어안 — 귀퉁이는 원본 귀퉁이를 읽는다(검은 테두리 없음)');
  let inside = true;
  for(let j = 0; j < S.i0.length; j++){ const i = S.i0[j]; if(i < 0 || i % 306 > 304 || Math.floor(i / 306) > 418 || !(S.ax[j] >= 0 && S.ax[j] <= 1) || !(S.ay[j] >= 0 && S.ay[j] <= 1)){ inside = false; break; } }
  chk(inside, '모든 칸이 원본 안을 읽는다 — 이웃 넷이 판 밖으로 안 나간다');
  /* 가운데 배율: 가운데에서 결과 10칸 = 원본 10 × (1-S) 칸 */
  const a = srcAt(S, 153, 210), b = srcAt(S, 163, 210);
  chk(near((b[0] - a[0]) / 10, 1 - P.FISH_S, 0.01), '가운데 배율 ' + (10 / (b[0] - a[0])).toFixed(2) + '배');
  /* 비율로만 — 무대와 사진에서 같은 비율 자리가 같은 비율 자리를 읽는다 */
  const rel = (m, fx, fy) => { const s = srcAt(m, Math.floor(fx * m.w), Math.floor(fy * m.h)); return [(s[0] + 0.5) / m.w, (s[1] + 0.5) / m.h]; };
  let worst = 0;
  [[0.2, 0.3], [0.5, 0.15], [0.8, 0.8], [0.35, 0.65], [0.95, 0.5]].forEach(([fx, fy]) => {
    const p = rel(S, fx, fy), q = rel(L, fx, fy);
    worst = Math.max(worst, Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1]));
  });
  chk(worst < 0.01, '무대(306×420)와 사진(540×740)이 같은 모양 — 비율 차 최대 ' + worst.toFixed(4));
  chk(!/FISH_S\s*\*\s*k|k\s*\*\s*FISH/.test(SRC['purikura-net.js']), '어안에는 배율 k 가 안 들어간다');
});

sec('── 3. 다시 놓기', () => {
  const W = 60, H = 80, n = W * H;
  const flat = new Uint8ClampedArray(n * 4).fill(255), out = new Uint8ClampedArray(n * 4);
  P.fishRemap(flat, out, W, H);
  const px = (d, x, y, c) => d[(y * W + x) * 4 + c];
  chk(px(out, 30, 40, 0) >= 253 && px(out, 0, 0, 0) < 220 && px(out, 0, 0, 0) > 200, '가장자리 살짝 어둡게 — 가운데 ' + px(out, 30, 40, 0) + ' · 귀퉁이 ' + px(out, 0, 0, 0));
  chk(px(out, 0, 0, 3) === 255, '투명도는 어둡게 하지 않는다');
  /* 가운데 근처 세로 경계(흰 | 검) — 키우면 경계가 여러 칸에 걸친다. 섞으면 중간값이 생긴다 */
  const edge = new Uint8ClampedArray(n * 4);
  for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){ const v = x < 31 ? 255 : 0, i = (y * W + x) * 4; edge[i] = edge[i + 1] = edge[i + 2] = v; edge[i + 3] = 255; }
  P.fishRemap(edge, out, W, H);
  let mids = 0;
  for(let x = 20; x < 40; x++){ const v = px(out, x, 40, 0); if(v > 10 && v < 245) mids++; }
  chk(mids >= 2, '이웃 넷을 섞는다 — 경계에 중간값 ' + mids + '칸(한 점만 집으면 0칸, 계단)');
});

sec('── 4. applyFilter', () => {
  const log = [];
  function fakeCanvas(w, h, tag){
    const cv = { width: w, height: h, tag, opts: null };
    const ctx = {
      canvas: cv, globalCompositeOperation: 'source-over',
      save(){}, restore(){},
      drawImage(){ log.push('draw:' + tag + ':' + this.globalCompositeOperation); },
      getImageData(x, y, ww, hh){ log.push('get:' + tag); return { data: new Uint8ClampedArray(ww * hh * 4).fill(200) }; },
      createImageData(ww, hh){ log.push('create:' + tag); return { data: new Uint8ClampedArray(ww * hh * 4) }; },
      putImageData(){ log.push('put:' + tag); },
    };
    cv.getContext = (k, o) => { if(cv.opts === null) cv.opts = o || {}; return ctx; };
    return cv;
  }
  const pool = {};
  const mk = (w, h, tag) => { const k = (tag || 'fx') + w + 'x' + h; return pool[k] || (pool[k] = fakeCanvas(w, h, tag || 'fx')); };
  const main = fakeCanvas(46, 62, 'main');
  chk(P.applyFilter(main.getContext('2d'), main, 46, 62, 'fish', 1, mk) === true, '어안 갈래가 그린다');
  const sc = pool['fish46x62'];
  chk(!!sc, '«fish» 태그로 딴 캔버스를 받는다(자기 자신을 돌려받지 않게)');
  chk(sc && sc.opts && sc.opts.willReadFrequently === true, 'getImageData 를 당하는 캔버스는 willReadFrequently');
  chk(log.indexOf('draw:main:copy') > log.indexOf('put:fish'), '다 놓은 판을 원래 캔버스에 copy 로 덮는다');
  const nCreate = log.filter(s => s === 'create:fish').length;
  P.applyFilter(main.getContext('2d'), main, 46, 62, 'fish', 1.76, mk);
  chk(nCreate === 1 && log.filter(s => s === 'create:fish').length === 1, '결과 판도 크기별로 한 장 — 매 프레임 새로 만들지 않는다');
});

sec('── 5. 업데이트 안 한 참가자', () => {
  const slots = { 0: { uid: 'me', name: '방장', at: 1, fx: 1 }, 1: { uid: 'u1', name: '새판', at: 1, fx: 1 }, 2: { uid: 'u2', name: '옛판', at: 1 } };
  chk(JSON.stringify(P.filterLaggards(slots, 'fish', 'me')) === '["옛판"]', 'fx 가 없는 자리만 «업데이트 필요»');
  chk(P.filterLaggards(slots, 'mono', 'me').length === 0 && P.filterLaggards(slots, 'none', 'me').length === 0, '옛 앱도 아는 필터면 아무도 안 알린다');
  chk(P.filterLaggards(null, 'fish', 'me').length === 0, '자리를 아직 못 받았으면 빈 목록');
  /* 가짜 서버 — oldRules 면 slots/$i 에 uid · name · at 밖의 칸이 있으면 쓰기를 통째로 거부한다($other 와 같다) */
  function fakeApi(oldRules){
    const db = {}, st = { rejects: 0 };
    const ok = () => Promise.resolve();
    return { db, st, serverNow: () => Date.now(),
      pkTransaction(p, fn){
        const next = fn(db[p] ? JSON.parse(JSON.stringify(db[p])) : null);
        if(next == null) return Promise.resolve({ committed: false, value: db[p] || null });
        if(oldRules && Object.keys(next).some(k => next[k] && Object.keys(next[k]).some(f => ['uid', 'name', 'at'].indexOf(f) < 0))){
          st.rejects++; return Promise.reject(new Error('PERMISSION_DENIED'));
        }
        db[p] = next; return Promise.resolve({ committed: true, value: next });
      },
      pkOnDisconnectRemove: ok, pkOnDisconnectCancel: ok, pkSet: ok, pkUpdate: ok, pkRemove: ok,
      pkGet: () => Promise.resolve(null), pkOnValue: () => function(){} };
  }
  const SLOTS = 'rooms/R1/_photo/slots';
  const mine = (db) => Object.values(db[SLOTS] || {}).find(v => v.uid === 'me');
  later.push((async () => {
    const a = fakeApi(false), s1 = P.makeSession(a, {});
    const r1 = await s1.open('R1', { userId: 'me', name: '나' });
    chk(r1 && r1.ok && mine(a.db) && mine(a.db).fx === P.FILTER_REV, '새 규칙 — 자리를 잡을 때 내 앱의 필터 판(fx)을 적는다');
    const r1b = await P.makeSession(a, {}).open('R1', { userId: 'me', name: '나' });
    chk(r1b && r1b.ok && mine(a.db).fx === P.FILTER_REV && Object.keys(a.db[SLOTS]).length === 1, '다시 들어와도 같은 자리 · fx 그대로');
    const b = fakeApi(true), s2 = P.makeSession(b, {});
    let r2 = null, threw = false;
    try{ r2 = await s2.open('R1', { userId: 'me', name: '나' }); }catch(_){ threw = true; }
    chk(!threw && r2 && r2.ok && r2.host === true, '★ 옛 규칙 — 거부돼도 들어간다(버튼이 반응 없던 제보)');
    chk(b.st.rejects === 1 && mine(b.db) && !('fx' in mine(b.db)), '거부되면 fx 없이 한 번 더 — 한 번만 다시 시도');
  })().catch(e => chk(false, '자리 잡기 검사를 못 돌았다 — ' + e.message)));
});

sec('── 6. 규칙', () => {
  const R = JSON.parse(SRC['firebase-database-rules.json']).rules;
  const ph = R.rooms.$room._photo;
  const run = (expr, val) => new Function('newData', 'return (' + expr + ');')({ val: () => val, isNumber: () => typeof val === 'number' });
  const fv = ph.meta.filter['.validate'];
  chk(P.filterList().every(f => run(fv, f.id)), '목록의 일곱 필터를 모두 받는다');
  chk(run(fv, 'toon') && !run(fv, 'fishy') && !run(fv, 'x'), '옛 앱의 «만화» 는 그대로 받고 · 모르는 값은 거부');
  const fxv = (ph.slots.$i.fx || {})['.validate'];
  chk(!!fxv && run(fxv, 1) && run(fxv, 0) && !run(fxv, '1') && !run(fxv, -1) && !run(fxv, 1000), 'slots/$i/fx — 숫자 0~99 만');
  chk(ph.slots.$i.$other && ph.slots.$i.$other['.validate'] === false, '그 밖의 칸은 여전히 막힌다');
});

sec('── 7. app.js · html', () => {
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
  const A = strip(SRC['app.js']), HTML = SRC['desk-companion-prototype.html'];
  chk(/P\.filterLaggards\(PK\.members, PK\.filter, getMyUserId\(\)\)/.test(A) && /'님은 업데이트가 필요해서 필터 없이 찍혀요'/.test(A), '방장 화면에 «○○님은 업데이트가 필요해서 필터 없이 찍혀요»');
  chk(/const lag = \(PK\.host && /.test(A), '안내는 방장에게만');
  chk(/_pkPaintSlots\(\);\s*_pkPaintFilterNote\(\);/.test(A), '자리가 바뀌면 안내를 다시 쓴다(축소판은 다시 안 그린다)');
  chk(/let r; try\{ r = await pk\.open\(room, \{ userId:getMyUserId\(\), name:getDisplayName\(\) \}\); \}\s*catch\(e\)\{ console\.warn\('\[스티커사진\] 자리 잡기 실패', e\); r = null; \}/.test(A),
    '자리 잡기가 던져도 «지금은 들어갈 수 없어요» 로 알린다(조용히 멈추지 않는다)');
  chk(/<div class="pk-bgrow pk-frow" id="pkFilterRowLobby">/.test(HTML) && /<div class="pk-bgrow pk-frow" id="pkFilterRow">/.test(HTML), '로비와 촬영 중 필터 줄이 같은 모양');
  chk(/\.pk-bgrow\.pk-frow\{grid-template-columns:repeat\(7,1fr\)/.test(HTML), '필터 줄은 일곱 칸 한 줄(뒷배경은 여섯 칸 그대로)');
});
Promise.all(later).then(() => {
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
});
