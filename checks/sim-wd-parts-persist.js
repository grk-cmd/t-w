/* sim-wd-parts-persist.js — 💾 꾸미기 · 가챠 파츠가 재부팅하면 초기화되던 것 (app.js)
   실행:  node sim-wd-parts-persist.js   (app.js 가 있는 폴더에서)
   ★ 왜 이 검사가 있는가 — 꾸미기는 «닫는 것이 곧 저장» 인데 저장이 안 되는 길이 셋 있었다.
     (1) 다른 기기에서 고친 캐릭터를 받으면 slots[] 가 새 객체로 바뀌고 책상 위 좌석은 옛 객체를 쥔 채 남았다
         → 그 뒤 꾸미기 · 가챠 착용이 slots[] 밖에 저장돼 saveSlots 가 «안 바뀜» 으로 넘어갔다.
     (2) 저장(saveSlots)이 파츠 GLB 받기(applyEquippedPartsToSeat)를 기다린 뒤에 돌아, 그 사이 앱을 끄면 사라졌다.
     (3) 설정 패널 «런처로» · 생성기 열기 · 앱 종료는 꾸미기 창을 숨기기만 하고 저장하지 않았다.
   ・1절: _relinkSeatsToSlots 실행 — 같은 칸 · 비운 칸 · 남의 좌석 · 다른 객체 · 열린 초안
   ・2절: 받는 두 곳(_charsSync · 이 기기 첫 채택)이 loadSlots 뒤에 잇는다
   ・3절: 저장 순서 — 두 커밋 함수 모두 파츠 받기 전에 saveSlots
   ・4절: 창 숨기기 전에 closeWardrobe · 종료 때 저장 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const { joinRenderer: _joinRenderer } = require('./sim-renderer-src.js');   // 앱 FSD 로 옮긴 모듈을 «옮기기 전 app.js 글» 로 되살려 읽는다
const APP = _joinRenderer(read('app.js'));
if (!APP) { say('  ? 원본 못 찾음 — app.js'); process.exit(2); }
const grab = (name, async) => (APP.match(new RegExp((async ? 'async ' : '') + 'function ' + name + '\\([^)]*\\)\\{[\\s\\S]*?\\n\\}')) || [''])[0];
const noCmt = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

say('── 1. 좌석 다시 잇기 (_relinkSeatsToSlots)');
const relSrc = grab('_relinkSeatsToSlots');
chk(!!relSrc, '_relinkSeatsToSlots 를 꺼냈다');
/* 열린 초안 주인 바꾸기는 꾸미기(wardrobe.js relinkDraftSrc)가 슬롯 저장의 onSeatRelinked 알림으로 받는다(모듈 순환 끊기 3) — 그 둘을 같이 돌린다 */
const drSrc = grab('relinkDraftSrc');
chk(!!drSrc && /slotSaveMod\.onSeatRelinked\(\(old, cur\)=>wardrobeMod\.relinkDraftSrc\(old, cur\)\);|onSeatRelinked\(\(old, cur\)=>relinkDraftSrc\(old, cur\)\);/.test(APP), '  꾸미기가 «좌석 다시 이음» 알림에 걸려 있다(onSeatRelinked → relinkDraftSrc)');
const run = (env) => new Function('env', 'const {seats, slots} = env; let wdDraftDef = env.draft; const console = { warn(){} };\n'
  + drSrc + '\nconst _relinkFns = [relinkDraftSrc];\n' + relSrc + '\n_relinkSeatsToSlots(env.old, env.skip); return wdDraftDef;')(env);
if (relSrc) {
  const oA = { n: 'A' }, oB = { n: 'B' }, oC = { n: 'C' }, nA = { n: 'A2' }, nB = { n: 'B2' }, nC = { n: 'C2' };
  const me = { isMe: true, slot: 0, charDef: oA }, ex = { slot: 1, charDef: oB }, gone = { slot: 2, charDef: oC };
  const remote = { remote: true, slot: 0, charDef: oA }, noSlot = { slot: null, charDef: oA };
  const draft = { _srcDef: oA };
  const slots = [nA, nB, nC];
  run({ seats: [me, ex, gone, remote, noSlot], slots, old: [oA, oB, oC], skip: new Set([2]), draft });
  chk(me.charDef === nA && ex.charDef === nB, '★ 내 좌석 · 자리추가 좌석이 같은 칸의 새 객체로 이어진다 — 꾸미기 저장이 slots[] 에 들어간다');
  chk(gone.charDef === oC, '  비운 칸(skip)은 잇지 않는다 — 다른 기기에서 내린 캐릭터');
  chk(remote.charDef === oA && noSlot.charDef === oA, '  남의 좌석 · 칸 없는 좌석은 건드리지 않는다');
  chk(draft._srcDef === nA, '★ 열린 꾸미기 초안의 주인도 새 객체로 — 안 그러면 _commitWdDraftToOwner 가 «원래 캐릭터를 못 찾음» 으로 버린다');
  const other = { slot: 0, charDef: { n: 'X' } };
  run({ seats: [other], slots: [nA], old: [oA], skip: new Set(), draft: null });
  chk(other.charDef.n === 'X', '  좌석이 옛 칸 객체가 아닌 것을 쥐고 있으면(이미 다른 캐릭터) 그대로');
  const empty = { slot: 0, charDef: oA };
  run({ seats: [empty], slots: [null], old: [oA], skip: new Set(), draft: null });
  chk(empty.charDef === oA, '  새 칸이 비었으면 그대로(null 로 바꾸지 않는다)');
  let threw = false;
  try { run({ seats: [{ slot: 0, get charDef() { throw new Error('x'); } }], slots: [nA], old: [oA], skip: null, draft: null }); } catch (_) { threw = true; }
  chk(!threw, '  중간에 던져도 받기 흐름을 끊지 않는다');
}

say('── 2. 받는 곳이 loadSlots 뒤에 잇는다');
const relinkCalls = (src) => {
  const c = noCmt(src);
  const iCopy = c.indexOf('const _old = slots.slice();'), iNull = c.indexOf('slots[i] = null', iCopy), iLoad = c.indexOf('await loadSlots();', iNull), iRel = c.indexOf('_relinkSeatsToSlots(_old, new Set(p.unseat));', iLoad);
  return iCopy > 0 && iNull > iCopy && iLoad > iNull && iRel > iLoad;
};
chk(relinkCalls(grab('_charsSync', true) || APP.slice(APP.indexOf('async function _charsSync('), APP.indexOf('async function _charsSync(') + 9000)),
  '★ _charsSync(부팅 5초 · 30분마다) — 갈아 끼우기 전 사본 → loadSlots → 비운 칸 빼고 잇기');
{
  const i = APP.indexOf('async function _charsLocalAdopt(');
  chk(i > 0 && relinkCalls(APP.slice(i, i + 8000)), '  이 기기 첫 채택(_charsLocalAdopt)도 같다');
}

say('── 3. 저장 순서 — 파츠 받기 전에 saveSlots');
{
  const now = noCmt(grab('_commitWdDraftNow', true));
  const iPart = now.indexOf('def.partXfMemory ='), iSave = now.indexOf('saveSlots()', iPart), iApply = now.indexOf('applyEquippedPartsToSeat(mySeat, def)');   // 다시 맞추기 한 벌(refitSeatAfterParts)이 기다리는 장착
  chk(iPart > 0 && iSave > iPart && iApply > iSave, '★ _commitWdDraftNow — def 에 쓴 직후 저장, GLB 받기는 그 뒤 (꺼져도 남는다)');
  chk(now.indexOf('saveSlots()', iApply) > iApply, '  받은 뒤에도 한 번 더(적용 중 정리된 것 — 그대로면 saveSlots 가 아무것도 안 올린다)');
  const own = noCmt(grab('_commitWdDraftToOwner', true));
  const jPart = own.indexOf('src.partXfMemory ='), jSave = own.indexOf('saveSlots()', jPart), jApply = own.indexOf('applyEquippedPartsToSeat(seat, src)');
  chk(jPart > 0 && jSave > jPart && jApply > jSave, '  _commitWdDraftToOwner 도 같다');
}

say('── 4. 숨기기 전에 저장');
const closesFirst = (fnSrc) => {
  const c = noCmt(fnSrc);
  const iClose = c.indexOf("window.closeWardrobe();"), iHide = c.indexOf("wp.classList.remove('on')");
  return iClose > 0 && iHide > iClose && /wp\.classList\.contains\('on'\)/.test(c.slice(0, iClose));
};
chk(closesFirst(grab('backToLauncher')), '★ backToLauncher(설정 패널 «런처로») — 꾸미기가 열려 있으면 closeWardrobe(=저장) 후 숨김');
chk(closesFirst(grab('openCreator')), '  openCreator — 같다');
{
  const i = APP.indexOf('if(_acctDetached || !wdDraftDef) return;');
  const blk = i > 0 ? APP.slice(APP.lastIndexOf("window.addEventListener('beforeunload'", i), i + 400) : '';
  chk(i > 0 && /window\.closeWardrobe\(\)/.test(blk), '★ 앱을 끌 때(beforeunload) 꾸미기가 열려 있으면 닫으며 저장');
  chk(i > 0, '  계정을 놓은 뒤(_acctDetached)에는 건너뛴다 — 지운 칸을 도로 쓰지 않게');
}

say('');
say('통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
