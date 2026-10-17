/* sim-seat-refit.js — 🪑 파츠 구성이 바뀐 뒤 좌석 다시 맞추기 한 벌(room/seat-refit.js — refitSeatAfterParts)
   실행:  node sim-seat-refit.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — «파츠가 바뀌었다 → 장착 끝 기다리기 → fitModel → layoutSeats → 올라탄 사람 높이» 가 길마다 따로 쓰여 있어서
     어떤 길은 거부를 안 받고(.then 에 catch 없음 · await 에 try 없음) 어떤 길은 올라탄 사람 높이를 안 쟀다. 한 함수로 묶고 길마다 그 함수를 부르게 고정한다.
   ・1절: 순서 — 기다리기 → (같은 좌석인지) → fitModel → layoutSeats(원할 때만) → 올라탄 사람 높이 · 장착이 실패해도 다시 맞춘다 · 모델 없음 · 낡은 좌석
   ・2절: 길마다 이 함수를 부른다 — 꾸미기 저장 두 곳 · 친구 파츠 변경 · 좌석 다시 짓기 · 카탈로그 늦게 붙은 파츠 · 관리자 다시 등록 / 옛 «.then(fitModel)» 이 남지 않음 / html · app.js 연결
   ・3절: 파츠 떼기 — 다음 프레임에 한 번(같은 프레임 여러 번 → 한 번) · 실행 화면 좌석만 · 진짜 app.js 떼기 함수가 부른다 · 가챠 회수 · 카탈로그 삭제 · 관리자 삭제 · 친구 화면 빼기가 그 함수를 지난다
     [제보] 칠판(rideTop)을 낀 사람 위에 동물이 탄 채 칠판을 빼면, 남의 화면에서 동물이 재실행 전까지 떠 있었다 — 떼는 길에 높이 다시 재기가 없었다.
   ・4절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, path.basename(f)]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = {
  MOD: read('room/seat-refit.js'), APP: read('app.js'), HTML: read('desk-companion-prototype.html'),
  WD: read('character/wardrobe.js'), RE: read('room/room-entry.js'), CS: read('character/catalog-sync.js'), AP: read('admin/admin-part-register.js'),
};
if (Object.values(SRC).some(v => !v)) { say('  ? 원본 못 찾음 — seat-refit.js · app.js · desk-companion-prototype.html · wardrobe.js · room-entry.js · catalog-sync.js · admin-part-register.js'); process.exit(2); }

function build(mod, seats) {
  const log = [], frames = [];
  const win = {};
  const warn = console.warn; console.warn = () => log.push('warn');
  try { new Function('window', 'module', mod)(win, undefined); } finally { console.warn = warn; }
  const m = win.TwSeatRefit.createSeatRefit({
    fitModel: (s) => log.push('fit:' + s.n),
    layoutSeats: () => log.push('layout'),
    requestFrame: (fn) => frames.push(fn),
    seats: seats || [],
  });
  m.onRefitted((s) => log.push('ride:' + s.n));   // app.js 가 거는 올라탄 사람 높이 다시 재기 자리
  const frame = async () => { const f = frames.splice(0); f.forEach(fn => fn()); await new Promise(r => setTimeout(r, 0)); };
  return { m, log, frames, frame };
}
/* app.js 의 떼기 두 함수 + _refitAfterUnequip 를 그대로 꺼내 가짜 좌석에서 돌린다 */
const grabFn = (src, name) => { const i = src.indexOf('function ' + name + '('); if (i < 0) return ''; let k = src.indexOf('{', i), d = 0;
  for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } return ''; };
async function quiet(fn) { const w = console.warn; const out = []; console.warn = () => out.push(1); try { return [await fn(), out.length]; } finally { console.warn = w; } }

async function judge(src) {
  const r = {};
  try {
    const seat = { n: 'a', gltfRoot: {} };
    let b = build(src.MOD);
    const wait = new Promise(res => setTimeout(() => { b.log.push('equipped'); res(); }, 5));
    r.ret = (await b.m.refitSeatAfterParts(seat, { wait, layout: true })) === true;
    r.order = b.log.join(',') === 'equipped,fit:a,layout,ride:a';
    b = build(src.MOD); await b.m.refitSeatAfterParts(seat, {}); r.noLayout = b.log.join(',') === 'fit:a,ride:a';
    b = build(src.MOD); const [ok, warns] = await quiet(() => b.m.refitSeatAfterParts(seat, { wait: Promise.reject(new Error('glb')), layout: true }));
    r.rejectStill = ok === true && warns === 1 && b.log.join(',') === 'fit:a,layout,ride:a';
    b = build(src.MOD); r.stale = (await b.m.refitSeatAfterParts(seat, { isCurrent: () => false, layout: true })) === false && b.log.length === 0;
    b = build(src.MOD); r.noModel = (await b.m.refitSeatAfterParts({ n: 'x', gltfRoot: null }, { layout: true })) === false && b.log.length === 0;
    b = build(src.MOD); r.noSeat = (await b.m.refitSeatAfterParts(null)) === false && b.log.length === 0;
    /* fitModel 이 던져도 올라탄 사람 높이는 잰다(예전 길도 각자 try 로 감쌌다) */
    const win = {}; new Function('window', 'module', src.MOD)(win, undefined);
    const lg = [];
    const m2 = win.TwSeatRefit.createSeatRefit({ fitModel: () => { throw new Error('x'); }, layoutSeats: () => lg.push('layout') });
    m2.onRefitted(() => { throw new Error('y'); });   // 거는 쪽이 던져도 다음 할 일은 돈다
    m2.onRefitted(() => lg.push('ride'));
    await m2.refitSeatAfterParts(seat, { layout: true }); r.fitThrows = lg.join(',') === 'ride';
    /* 남의 머리에 탄 좌석이면 그 대상 위 높이도 다시 잰다 */
    b = build(src.MOD); await b.m.refitSeatAfterParts({ n: 'r', gltfRoot: {}, ridingOn: { n: 'h' } }); r.riding = b.log.join(',') === 'fit:r,ride:r,ride:h';
    /* 3절 — 떼기는 다음 프레임에 한 번 */
    const A = { n: 'A', gltfRoot: {} }, B = { n: 'B', gltfRoot: {} }, P = { n: 'P', gltfRoot: {} };
    const list = [A, B];
    b = build(src.MOD, list);
    b.m.requestRefit(A); b.m.requestRefit(A); b.m.requestRefit(B); b.m.requestRefit(A);
    r.oneFrame = b.frames.length === 1 && b.log.length === 0;   // 부른 자리에서는 바로 안 잰다(기본 메쉬가 돌아온 뒤)
    await b.frame(); r.once = b.log.join(',') === 'fit:A,ride:A,fit:B,ride:B';
    b.m.requestRefit(A); r.again = b.frames.length === 1; await b.frame(); r.againRun = b.log.join(',') === 'fit:A,ride:A,fit:B,ride:B,fit:A,ride:A';
    b = build(src.MOD, list); b.m.requestRefit(P); b.m.requestRefit(null); r.onlySeats = b.frames.length === 0; await b.frame(); r.onlySeatsRun = b.log.length === 0;
    b = build(src.MOD, list); b.m.requestRefit(A); await b.m.refitSeatAfterParts(A); await b.frame(); r.dropPending = b.log.join(',') === 'fit:A,ride:A';
    const list2 = [A]; b = build(src.MOD, list2); b.m.requestRefit(A); list2.length = 0; await b.frame(); r.leftSeat = b.log.length === 0;
    /* 진짜 app.js 떼기 함수 */
    const body = ['_refitAfterUnequip', 'unequipPartFromSeat', 'unequipStackablePart'].map(n => grabFn(src.APP, n)).join('\n');
    const U = new Function('env', 'const asked = []; const seatRefitMod = { requestRefit: (s) => asked.push(s.n) };'
      + 'const _invalidatePendingEquip = () => {}, _disposeWrapperFromSeat = () => {}, _sweepOrphanPartWrappers = () => {};\n'
      + body + '\nreturn { unequipPartFromSeat, unequipStackablePart, asked };');
    let u = U(); const S1 = { n: 's1', stackedPartObjs: { hat: { board: {} } } };
    u.unequipStackablePart(S1, 'hat', 'board'); r.uStack = u.asked.join() === 's1';
    u = U(); u.unequipStackablePart({ n: 's2', stackedPartObjs: {} }, 'hat', 'board'); u.unequipPartFromSeat({ n: 's3' }, 'hat'); r.uNone = u.asked.length === 0;
    u = U(); u.unequipPartFromSeat({ n: 's4', equippedPartObjs: { hat: {} } }, 'hat'); u.unequipPartFromSeat({ n: 's5', stackedPartObjs: { hat: { a: {} } } }, 'hat'); u.unequipPartFromSeat({ n: 's6', stackedPartObjs: { hat: { a: {} } } }, 'hat', false);
    r.uPart = u.asked.join() === 's4,s5';   // 겹쳐 단 파츠를 두고 바꾸는 교체(false)는 뗀 것이 없으면 안 부른다
    const U2 = new Function('const seatRefitMod = undefined;' + grabFn(src.APP, '_refitAfterUnequip') + '\nreturn _refitAfterUnequip;');
    try { U2()({ n: 'x' }); r.uSafe = true; } catch (_) { r.uSafe = false; }
  } catch (e) { r.err = String(e && e.message || e); }
  /* 2절 — 길마다 */
  const CALL = /refitSeatAfterParts\(\s*(\w+)\s*,\s*\{\s*wait:\s*([^\n]*)/g;
  const calls = (t) => [...t.matchAll(CALL)].map(m => ({ seat: m[1], rest: m[2] }));
  const wd = calls(src.WD);
  r.wdNow = wd.some(c => c.seat === 'mySeat' && /^applyEquippedPartsToSeat\(mySeat, def\)/.test(c.rest)) && /await refitSeatAfterParts\(mySeat,/.test(src.WD);
  r.wdOwner = wd.some(c => c.seat === 'seat' && /^applyEquippedPartsToSeat\(seat, src\)/.test(c.rest)) && /await refitSeatAfterParts\(seat,/.test(src.WD);
  r.re = calls(src.RE).some(c => c.seat === 's' && /^applyEquippedPartsToSeat\(s, fdef\), layout: true, isCurrent: \(\)=>s\.charDef===fdef/.test(c.rest));
  r.app = calls(src.APP).some(c => c.seat === 'seat' && /^applyEquippedPartsToSeat\(seat, def\), layout: true, isCurrent: \(\)=>seat\.charDef===def/.test(c.rest));
  r.cs = calls(src.CS).some(c => c.seat === 's' && /^Promise\.all\(_pending\./.test(c.rest) && /layout: true/.test(c.rest));
  r.ap = calls(src.AP).some(c => c.seat === 's' && /^Promise\.resolve\(equipPartOnSeat\(s, c, rec,/.test(c.rest));
  /* 옛 모양 — 장착 뒤 .then 안에서 fitModel 을 직접 부르던 줄이 실행 화면 좌석 길에 남지 않는다(생성기 미리보기 fitCreator 는 다른 함수) */
  const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  r.noOldThen = [src.APP, src.RE, src.CS, src.AP].every(t => !/\.then\(\(\)=>\{[^}]{0,200}\bfitModel\(/.test(strip(t)));
  r.noOldAwait = !/await applyEquippedPartsToSeat\((mySeat|seat), (def|src)\);/.test(strip(src.WD));
  r.deps = [src.WD, src.RE, src.CS, src.AP].every(t => /^const refitSeatAfterParts = deps\.refitSeatAfterParts;$/m.test(t));
  const order = [...src.HTML.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*\bsrc="parts\/([^"]+\.js)"/g)].map(m => m[1]);
  r.html = order.indexOf('room/seat-refit.js') >= 0 && order.indexOf('room/seat-refit.js') < order.indexOf('app.js');
  const iMk = src.APP.indexOf('const seatRefitMod = TwSeatRefit.createSeatRefit({'), iRb = src.APP.indexOf('const rideBenchMod = TwRideBench.createRideBench(');
  r.made = iMk > 0 && iRb > 0 && iRb < iMk;
  /* 올라탄 사람 높이 다시 재기는 만든 바로 뒤에 알림으로 건다(rideBenchMod 를 deps 로 받으면 새 순환 — sim-dep-cycles) */
  r.hook = /\nseatRefitMod\.onRefitted\(\(s\)=>rideBenchMod\._remeasureRideHeadTop\(s\)\);/.test(src.APP) && !/rideBenchMod/.test(src.MOD.replace(/\/\*[\s\S]*?\*\//g, ''));
  r.passed = (src.APP.match(/\n  refitSeatAfterParts: \(\.\.\.a\)=>seatRefitMod\.refitSeatAfterParts\(\.\.\.a\),/g) || []).length === 4;
  const mk = (src.APP.match(/const seatRefitMod = TwSeatRefit\.createSeatRefit\(\{\n([\s\S]*?)\n\}\);/) || [])[1] || '';
  r.mkDeps = /^  requestFrame: \(\.\.\.a\)=>requestAnimationFrame\(\.\.\.a\),$/m.test(mk) && /^  seats: seats,$/m.test(mk);
  /* 떼는 길 — 가챠 회수 · 카탈로그 삭제 · 관리자 삭제는 떼기 함수를 부르고, 친구 화면 빼기는 pruneSeatPartsAgainstDef(→ 떼기 함수)를 지난다 */
  const GA = read('character/gacha.js') || '';
  const pg = grabFn(GA, 'pruneUnownedGachaParts'), mc = grabFn(src.CS, 'mergeCatalogIntoSavedParts'), dp = grabFn(src.AP, 'deletePart'), pr = grabFn(src.APP, 'pruneSeatPartsAgainstDef');
  r.paths = /unequipStackablePart\(s, h\.cat, h\.id\)/.test(pg) && /unequipPartFromSeat\(s, h\.cat\)/.test(pg)
    && /unequipPartFromSeat\(s,c\)/.test(mc) && /unequipStackablePart\(s, c, id\)/.test(dp) && /unequipPartFromSeat\(s, c\)/.test(dp)
    && /unequipPartFromSeat\(seat, cat, false\)/.test(pr) && /unequipStackablePart\(seat, cat, id\)/.test(pr) && /pruneSeatPartsAgainstDef\(s, fdef\)/.test(src.RE);
  return r;
}

(async () => {
  const R = await judge(SRC);
  say('── 1. 순서');
  chk(!R.err && R.ret && R.order, '장착이 끝난 뒤 fitModel → layoutSeats → 올라탄 사람 높이 순서로 한 번씩' + (R.err ? ' — ' + R.err : ''));
  chk(R.noLayout, 'layout 을 안 주면 layoutSeats 는 안 부른다(꾸미기 저장 · 관리자 다시 등록 길과 같게)');
  chk(R.rejectStill, '★ 장착이 실패(거부)해도 경고 한 줄 남기고 다시 맞춘다 — 예전엔 거부되면 그 자리 그대로 남았다');
  chk(R.stale, '기다리는 사이 그 좌석의 캐릭터가 바뀌었으면(isCurrent 거짓) 아무것도 안 한다 — 낡은 좌석에 뒤늦게 발사 금지');
  chk(R.noModel && R.noSeat, '좌석 · 모델이 없으면 맨 앞에서 돌아간다');
  chk(R.fitThrows, 'fitModel 이 던져도 올라탄 사람 높이는 잰다(layoutSeats 는 같은 try 라 건너뜀 — 예전 줄과 같다) · 건 할 일 하나가 던져도 다음 것은 돈다');

  say('── 2. 길마다 이 함수를 부른다');
  chk(R.wdNow && R.wdOwner, '꾸미기 저장 — 주 캐릭터 · 원래 주인 두 곳(await)');
  chk(R.re, '친구 파츠 변경(room-entry.js) — layout · 같은 def 인지 확인');
  chk(R.app, '좌석 다시 짓기(app.js applyCharToSeat) — layout · 같은 def 인지 확인');
  chk(R.cs, '카탈로그가 늦게 와 붙은 파츠(catalog-sync.js) — 다 붙은 뒤 · layout');
  chk(R.ap, '관리자 파츠 다시 등록(admin-part-register.js) — 다시 붙인 뒤');
  chk(R.noOldThen && R.noOldAwait, '장착 뒤 fitModel 을 직접 부르던 옛 줄이 남지 않는다');
  chk(R.deps && R.passed, '네 모듈은 deps 로 받는다 · app.js 가 넷 다 넘긴다');
  chk(R.html && R.made, 'html — seat-refit.js 를 app.js 보다 먼저 · app.js 는 rideBenchMod 뒤에서 만든다');
  chk(R.hook, 'app.js 가 만든 바로 뒤 올라탄 사람 높이 다시 재기(_remeasureRideHeadTop)를 onRefitted 로 건다 — 모듈은 rideBenchMod 를 모른다');
  chk(R.riding, '남의 머리에 탄 좌석을 다시 맞추면 그 대상(ridingOn) 위 높이도 다시 잰다 — 판단은 이 모듈 한 곳');

  say('── 3. 파츠 떼기 — 다음 프레임에 한 번');
  chk(R.oneFrame && R.once, '★ 같은 프레임에 여러 번 떼도 프레임 하나 · 좌석마다 한 번(fitModel → 높이 다시 재기) · 부른 자리에서는 바로 안 잰다');
  chk(R.again && R.againRun, '  다음 프레임에 또 떼면 또 한 번');
  chk(R.onlySeats && R.onlySeatsRun && R.leftSeat, '  실행 화면 좌석만 — 미리보기 좌석 · 그 사이 나간 좌석은 안 맞춘다');
  chk(R.dropPending, '  그 프레임 전에 장착 뒤 다시 맞추기가 돌았으면 프레임 몫은 건너뛴다(두 번 안 잰다)');
  chk(R.uStack && R.uNone && R.uPart, '★ 진짜 app.js 떼기 함수 — 무언가 뗐을 때만 다시 맞추기를 부탁한다(겹쳐 단 파츠 · 일반 파츠 · 카테고리 통째)');
  chk(R.uSafe, '  다시 맞추기 모듈이 아직 없을 때 떼도 떼기는 끝난다');
  chk(R.mkDeps, '  app.js 는 requestAnimationFrame · 실행 화면 좌석(seats)을 넘긴다');
  chk(R.paths, '가챠 회수 · 카탈로그 삭제 · 관리자 파츠 삭제 · 친구 화면 파츠 빼기(pruneSeatPartsAgainstDef)가 그 떼기 함수를 지난다');

  say('── 4. 일부러 깨 보기');
  const BREAK = [
    ['순서가 바뀜(올라탄 사람 높이를 fitModel 앞에서)', { MOD: SRC.MOD.replace("  try{ fitModel(seat); if(o.layout) layoutSeats(); }catch(_){}\n  _notifyRefitted(seat);", "  _notifyRefitted(seat);\n  try{ fitModel(seat); if(o.layout) layoutSeats(); }catch(_){}") }, 'order'],
    ['거부를 안 받음', { MOD: SRC.MOD.replace(/try\{ await o\.wait; \}catch\(e\)\{[^}]*\}/, 'await o.wait;') }, 'rejectStill'],
    ['낡은 좌석 확인 빠짐', { MOD: SRC.MOD.replace('if(o.isCurrent && !o.isCurrent()) return false;', '') }, 'stale'],
    ['올라탄 사람 높이 알림 빠짐', { MOD: SRC.MOD.replace('  try{ fitModel(seat); if(o.layout) layoutSeats(); }catch(_){}\n  _notifyRefitted(seat);', '  try{ fitModel(seat); if(o.layout) layoutSeats(); }catch(_){}') }, 'order'],
    ['탄 대상 높이 다시 재기 빠짐', { MOD: SRC.MOD.replace('  if(seat.ridingOn) _notifyRefitted(seat.ridingOn);\n', '') }, 'riding'],
    ['같은 프레임 여러 번 → 여러 번', { MOD: SRC.MOD.replace('  if(_frameAsked) return;\n', '') }, 'oneFrame'],
    ['떼자마자 바로 잼(다음 프레임 아님)', { MOD: SRC.MOD.replace('  requestFrame(_runPending);', '  _runPending();') }, 'oneFrame'],
    ['미리보기 좌석도 맞춤', { MOD: SRC.MOD.replace("  if(!seat || !seats.includes(seat)) return;", "  if(!seat) return;").replace("  list.forEach(seat => { if(seats.includes(seat)) refitSeatAfterParts(seat); });", "  list.forEach(seat => refitSeatAfterParts(seat));") }, 'onlySeats'],
    ['겹쳐 단 파츠를 떼도 안 부름', { APP: SRC.APP.replace('  _sweepOrphanPartWrappers(seat);\n  _refitAfterUnequip(seat);\n}', '  _sweepOrphanPartWrappers(seat);\n}') }, 'uStack'],
    ['카테고리를 떼도 안 부름', { APP: SRC.APP.replace('  if(removed) _refitAfterUnequip(seat);\n', '') }, 'uPart'],
    ['모듈이 없을 때 떼기가 던짐', { APP: SRC.APP.replace('  try{ seatRefitMod.requestRefit(seat); }catch(_){}', '  seatRefitMod.requestRefit(seat);') }, 'uSafe'],
    ['app.js 가 높이 다시 재기를 안 검', { APP: SRC.APP.replace(/\nseatRefitMod\.onRefitted\([^\n]*/, '') }, 'hook'],
    ['꾸미기 저장이 옛 줄로', { WD: SRC.WD.replace('await refitSeatAfterParts(mySeat, { wait: applyEquippedPartsToSeat(mySeat, def) });', 'await applyEquippedPartsToSeat(mySeat, def);\n  try{ if(mySeat && mySeat.gltfRoot) fitModel(mySeat); }catch(_){}') }, 'wdNow'],
    ['친구 파츠 변경이 옛 .then 으로', { RE: SRC.RE.replace(/refitSeatAfterParts\(s, \{ wait: applyEquippedPartsToSeat\(s, fdef\)[^\n]*/, 'applyEquippedPartsToSeat(s, fdef).then(()=>{ try{ if(s && s.charDef===fdef && s.gltfRoot){ fitModel(s); layoutSeats(); } }catch(_){} });') }, 're'],
    ['관리자 다시 등록이 함수를 안 부름', { AP: SRC.AP.replace(/refitSeatAfterParts\(s, \{ wait: Promise\.resolve\(equipPartOnSeat\(s, c, rec, \{ stackableXf \}\)\) \}\);/, 'Promise.resolve(equipPartOnSeat(s, c, rec, { stackableXf })).then(()=>{ try{ if(s && s.gltfRoot) fitModel(s); }catch(_){} }).catch(()=>{});') }, 'ap'],
    ['html 줄 빠짐', { HTML: SRC.HTML.replace(/<script src="parts\/room\/seat-refit\.js"><\/script>/, '') }, 'html'],
  ];
  for (const [name, patch, key] of BREAK) {
    const src = Object.assign({}, SRC, patch);
    const changed = Object.keys(patch).every(k => patch[k] !== SRC[k]);
    const r = await judge(src);
    chk(changed && !r[key], name + ' → 빨강');
  }
  say('\n' + (fail ? '✗' : '✓') + ' sim-seat-refit: ' + pass + ' 통과 · ' + fail + ' 실패');
  process.exit(fail ? 1 : 0);
})();
