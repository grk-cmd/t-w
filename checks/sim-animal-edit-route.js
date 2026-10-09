/* ═══ 🐾 sim-animal-edit-route.js — 동물 캐릭터 편집 순서: 모양 → 책상 → 좌석 (2026-10-09 신설) ═══════
   예전: 동물을 [캐릭터 수정] 하면 사람 생성기가 열리고 1~4단계가 막혀 «동물의 얼굴·표정은 동물 생성기에서…»
         토스트와 함께 책상(5)으로 튀었다. [이전] 을 눌러야 동물 생성기가 나왔다 — 순서가 거꾸로였다.
   ・1절: animal-edit-route.js 판정 표 — 동물 → 동물 생성기 먼저 · 동물 생성기에서 넘어오면 책상 ·
          책상에서 [이전] → 동물 생성기 · 사람 그대로 · 커미션 그대로(토스트 · 책상)
   ・2절: app.js 의 gotoStep 머리를 떼어 실제로 돌린다 — 동물 1~4 → 동물 생성기(토스트 없음) · 커미션 토스트 ·
          모듈이 없을 때(검사가 app.js 만 평가)도 예전처럼 책상
   ・3절: 배선 — openCreator 첫머리 · [이전] · animal.js 저장 뒤 fromAnimal · 재편집 탭 · html 순서
   ・4절: 동물 생성기 위 «책상 세팅» · «좌석 세팅» — 누르면 [다음 → 책상·좌석] 과 같은 저장 뒤 5 · 6단계 ·
          저장 자리를 못 정하는 새 동물(빈 칸 없음)은 흐리게 · 툴팁 · 감은눈 빈 채 저장 안 함
   [실행] app.js · animal.js · animal-edit-route.js · desk-companion-prototype.html 이 있는 폴더에서. */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const APP = read('app.js'), ANI = read('animal.js'), MOD = read('animal-edit-route.js'), HTML = read('desk-companion-prototype.html');
if(!APP || !ANI || !MOD || !HTML){ say('  ? 원본 못 찾음 — ' + [[APP, 'app.js'], [ANI, 'animal.js'], [MOD, 'animal-edit-route.js'], [HTML, 'desk-companion-prototype.html']].filter(x => !x[0]).map(x => x[1]).join(' ')); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
const A = strip(APP), N = strip(ANI);
const grab = (src, name) => { const i = src.indexOf('function ' + name + '('); if(i < 0) return ''; let k = src.indexOf('{', i), d = 0;
  for(; k < src.length; k++){ if(src[k] === '{') d++; else if(src[k] === '}' && --d === 0) return src.slice(i, k + 1); } return ''; };

const R = require(path.resolve('animal-edit-route.js'));
const HUMAN = { face: {} }, ANIMAL = { animal: true }, COMM = { isCommission: true };

say('── 1. 판정 표');
chk(R.entryRoute(ANIMAL, { kind: 'slot', edit: true, slot: 0 }) === 'animal', '런처 [캐릭터 수정] — 동물은 동물 생성기부터');
chk(R.entryRoute(ANIMAL, { kind: 'seat', seat: {} }) === 'animal', '좌석 [캐릭터 편집] — 동물은 동물 생성기부터');
chk(R.entryRoute(ANIMAL, { kind: 'slot', edit: true, slot: 0, fromAnimal: true }) === 'desk', '동물 생성기 마지막 [다음] → 책상(5)');
chk(R.entryRoute(ANIMAL, { kind: 'seat', seat: {}, fromAnimal: true }) === 'desk', '좌석 편집도 동물 생성기 다음은 책상');
chk(R.entryRoute(HUMAN, { kind: 'slot', edit: true, slot: 0 }) === 'paint', '사람 — 예전처럼 1단계부터');
chk(R.entryRoute(null, { kind: 'slot', edit: false }) === 'paint', '새로 만들기(원본 없음) — 1단계부터');
chk(R.entryRoute(COMM, { kind: 'slot', edit: true, slot: 0 }) === 'desk', '커미션 — 예전처럼 책상부터');
chk(R.prevRoute(ANIMAL, 5).animal === true, '동물 책상(5)에서 [이전] → 동물 생성기');
chk(R.prevRoute(ANIMAL, 6).step === 5 && !R.prevRoute(ANIMAL, 6).animal, '동물 좌석(6)에서 [이전] → 책상(5)');
chk([1, 2, 3, 4].every(n => R.stepRoute(ANIMAL, n).animal === true && !R.stepRoute(ANIMAL, n).toast), '동물 1~4단계 → 동물 생성기 · 토스트 없음');
chk([5, 6].every(n => R.stepRoute(ANIMAL, n).step === n), '동물 5 · 6 — 그대로');
chk([1, 2, 3, 4, 5, 6].every(n => R.stepRoute(HUMAN, n).step === n && !R.stepRoute(HUMAN, n).toast && !R.stepRoute(HUMAN, n).animal), '사람 1~6 — 그대로');
chk([1, 2, 3, 4].every(n => R.stepRoute(COMM, n).step === 5 && R.stepRoute(COMM, n).toast === '커미션 캐릭터는 수정할 수 없어요.'), '커미션 1~4 → 책상(5) · «커미션 캐릭터는 수정할 수 없어요.»');
chk(R.prevRoute(COMM, 5).step === 5 && !!R.prevRoute(COMM, 5).toast, '커미션 책상에서 [이전] — 예전처럼 토스트 · 책상에 머문다');
chk(R.prevRoute(HUMAN, 1).step === 1, '사람 1단계 [이전] — 1 아래로 안 간다');

say('── 2. gotoStep 머리를 실제로 돌린다');
const gs = grab(APP, 'gotoStep');
const head = gs.slice(0, gs.indexOf('crStep=n;'));
chk(head.length > 0 && !/동물 생성기에서 편집해요/.test(A), '옛 동물 토스트 «동물 생성기에서 편집해요 …» 가 없다');
const mk = (route, def) => {
  const log = { toast: [], reopen: [] };
  const fn = new Function('_editRoute', 'currentCreatorDef', 'toast', 'reopenAnimalFromCreator', 'isDeskSeatOnly', 'isCommissionEditing',
    head.replace(/^function gotoStep\(n\)\{/, 'return function(n){') + ' return n; };');
  const run = fn(route, def, (m) => log.toast.push(m), (t) => { log.reopen.push(t); return true; },
    () => !!(def && (def.animal || def.isCommission)), () => !!(def && def.isCommission));
  return { run, log };
};
{ const { run, log } = mk(R, ANIMAL); const r = run(4);
  chk(r === undefined && log.reopen.length === 1 && log.reopen[0] === 'blink' && !log.toast.length, '동물 4 → 동물 생성기(감은눈 탭) · 토스트 없음 · 단계 안 바꿈'); }
{ const { run, log } = mk(R, ANIMAL); chk(run(5) === 5 && !log.reopen.length && !log.toast.length, '동물 5 → 책상 그대로'); }
{ const { run, log } = mk(R, HUMAN); chk(run(2) === 2 && !log.reopen.length && !log.toast.length, '사람 2 → 2'); }
{ const { run, log } = mk(R, COMM); chk(run(3) === 5 && log.toast[0] === '커미션 캐릭터는 수정할 수 없어요.' && !log.reopen.length, '커미션 3 → 5 · 토스트'); }
{ const { run, log } = mk(null, ANIMAL); chk(run(4) === 5 && !log.reopen.length && !log.toast.length, '모듈 없음 — 동물은 예전처럼 책상(5)'); }
{ const { run, log } = mk(null, COMM); chk(run(1) === 5 && log.toast[0] === '커미션 캐릭터는 수정할 수 없어요.', '모듈 없음 — 커미션 토스트 그대로'); }

say('── 3. 배선');
const oc = grab(A, 'openCreator');
const iEntry = oc.indexOf("_editRoute.entryRoute(src, creatorMode)==='animal' && reopenAnimalFromCreator('face')) return;");
chk(iEntry > 0, "openCreator — 동물이면 동물 생성기(얼굴 탭)로 넘기고 끝");
chk(iEntry > oc.indexOf('currentCreatorDef = src;') && iEntry > oc.indexOf('creatorMode.cameFromLauncher ='), '…currentCreatorDef · cameFromLauncher 를 정한 뒤(런처 복귀 체인 · 좌석 모드를 animal.js 가 읽는다)');
chk(iEntry < oc.indexOf('faceC.getContext'), '…사람 생성기 상태를 건드리기 전');
chk(/document\.getElementById\('crPrev'\)\.addEventListener\('click',\(\)=>gotoStep\(Math\.max\(1,crStep-1\)\)\);/.test(A), '[이전] 은 gotoStep 하나로 — 동물 책상에서 누르면 gotoStep 이 동물 생성기로');
const ro = grab(A, 'reopenAnimalFromCreator');
chk(/classList\.remove\('on'\); creatorOpen=false;/.test(ro) && /window\.reopenAnimalCreator\(def, \{tab\}\)/.test(ro), 'reopenAnimalFromCreator — 사람 생성기를 닫고 같은 def 로 동물 생성기');
chk(/return false;/.test(ro), '…animal.js 가 없으면 false — 사람 생성기 책상으로 떨어진다');
chk((N.match(/openCreator\(\{kind:'slot', edit:true, slot:savedIdx, fromAnimal:true, startStep:_startStep\}\)/g) || []).length === 1, 'animal.js 슬롯 저장 뒤 — fromAnimal 로 책상부터');
chk((N.match(/openCreator\(\{kind:'seat', seat:seatRef, fromAnimal:true, startStep:_startStep\}\)/g) || []).length === 1, 'animal.js 좌석 저장 뒤 — fromAnimal 로 책상부터');
chk(!/openCreator\(\{(?![^}]*fromAnimal)[^}]*\}\)/.test(N), 'animal.js 의 openCreator 는 전부 fromAnimal (빠지면 동물 생성기 ↔ 생성기 맴돌기)');
chk(/window\.reopenAnimalCreator=function\(def, opts\)\{/.test(N) && /opts\.tab : 'blink'/.test(N), '재편집 탭 — opts.tab(처음 얼굴) · 없으면 감은눈');
chk(/_editSeat = \(typeof creatorMode!=='undefined' && creatorMode && creatorMode\.kind==='seat'\) \? creatorMode\.seat : null;/.test(N), '좌석 편집 — creatorMode.seat 을 그대로 이어받는다');
chk(/else saveAnimalSlot\(\);/.test(N) && /'다음 → 책상·좌석'/.test(N), '동물 생성기 마지막 탭 [다음 → 책상·좌석] = 저장 후 책상');
const iMod = HTML.indexOf('<script src="parts/animal-edit-route.js"></script>'), iApp = HTML.indexOf('<script src="parts/app.js"></script>');
chk(iMod > 0 && iMod < iApp, 'html — animal-edit-route.js 가 app.js 보다 먼저');

say('── 4. 동물 생성기 위 «책상 세팅» · «좌석 세팅»');
chk(R.deskStep({ fromAnimal: true }) === 5 && R.deskStep({ fromAnimal: true, startStep: 6 }) === 6 && R.deskStep(null) === 5, 'deskStep — 좌석 세팅으로 왔으면 6 · 아니면 책상 5');
const S = R.animalStageState;
chk(S({ editSrc: ANIMAL }, 'desk').enabled && S({ editSrc: ANIMAL }, 'desk').step === 5, '재편집 «책상 세팅» → 5');
chk(S({ editSrc: ANIMAL }, 'seat').enabled && S({ editSrc: ANIMAL }, 'seat').step === 6, '재편집 «좌석 세팅» → 6');
chk(S({ editSeat: {} }, 'seat').step === 6, '좌석 편집 — 누를 수 있다');
chk(S({ targetSlot: 2 }, 'desk').enabled, '새 동물 · 런처 [＋] 칸이 정해져 있으면 누를 수 있다');
chk(S({ targetSlot: 0 }, 'desk').enabled, '…0번 칸도(0 은 거짓값)');
chk(S({ targetSlot: null, hasEmptySlot: true }, 'desk').enabled, '새 동물 · 빈 칸이 있으면 누를 수 있다');
{ const st = S({ targetSlot: null, hasEmptySlot: false }, 'seat');
  chk(!st.enabled && st.title === R.NO_SLOT_MSG && /빈 자리가 없어요/.test(st.title), '새 동물 · 빈 칸 없음 — 흐리게 · 이유를 툴팁에'); }
chk(/<span data-stg="desk">책상 세팅<\/span><span data-stg="seat">좌석 세팅<\/span>/.test(ANI) && !/다음 단계에서 지원/.test(ANI), 'animal.js 머리 — 두 탭이 data-stg · 옛 «다음 단계에서 지원» 흐림 걷음');
chk(/id="anpStages"/.test(ANI), '…탭 줄 id anpStages(사람 생성기 cr-steps 와 같은 모양)');
const clickBlk = N.slice(N.indexOf("querySelectorAll('#anpStages span[data-stg]').forEach(sp=>{"), N.indexOf("const nextBtn=overlay.querySelector('#anpNextBtn');"));
chk(/if\(!st\.enabled\)\{ if\(typeof toast==='function'\) toast\(st\.title\); return; \}/.test(clickBlk), '누를 수 없으면 저장하지 않고 이유만 알린다');
chk(/if\(!_blinkTouched && !\(_editSrcDef && _editSrcDef\.animalBlink\)\) _copyPaintSide\('face','blink'\);/.test(clickBlk), '감은눈을 안 거쳤으면 감은눈 탭처럼 표정을 가져온다(빈 감은눈 저장 방지)');
chk(/saveAnimalSlot\(\{startStep: st\.step\}\);/.test(clickBlk), '…그 뒤 [다음 → 책상·좌석] 과 같은 saveAnimalSlot');
chk((N.match(/fromAnimal:true, startStep:_startStep\}\)/g) || []).length === 2, '저장 뒤 openCreator 두 곳(슬롯 · 좌석)이 startStep 을 넘긴다');
chk(/const _startStep = \(opts && opts\.startStep===6\) \? 6 : 5;/.test(N), 'saveAnimalSlot — startStep 없으면 5([다음] 버튼은 그대로)');
chk(/gotoStep\(_editRoute \? _editRoute\.deskStep\(creatorMode\) : 5\);/.test(A), 'openCreator 동물 가지 — deskStep 으로 5 · 6');
const op = grab(N, 'openPreview');
chk(op.indexOf('_syncAnimalStages();') > op.indexOf('buildOverlay();') && op.indexOf('buildOverlay();') >= 0, 'openPreview 마다 두 탭 상태를 다시 맞춘다(새 동물 · 재편집 · 좌석)');
const ss = grab(N, '_stageState');
chk(/editSeat:_editSeat, editSrc:_editSrcDef, targetSlot:_targetSlot, hasEmptySlot:empty/.test(ss) && /if\(!R\) return \{enabled:true/.test(ss), '_stageState — 저장 자리 판정과 같은 재료 · 모듈 없으면 누를 수 있다(저장이 다시 막음)');

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
