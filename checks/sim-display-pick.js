/* sim-display-pick.js — 🖥 고른 모니터에 고정 — 주모니터를 바꿔도 · 모니터를 뺐다 꽂아도 «고른 그 모니터» 를 다시 찾는다(main.js)
   실행:  node sim-display-pick.js   (main.js 가 있는 폴더에서)
   ★ 왜 — 제보: 듀얼(일반 모니터 + 액정타블렛)에서 Windows 주모니터를 바꾸면, 설정에서 주모니터를 골라 둔 사람은 창이 새 주모니터로
     따라가고 보조 모니터를 골라 둔 사람은 안 따라갔다. 지문에 화면 좌표가 들어 있어 주모니터를 바꾸면(원점이 옮겨감) 안 맞고,
     그 뒤 대체 순서가 우연히 갈랐다. 이제 OS 가 준 모니터 이름(label)을 첫째 기준으로 «고른 그 모니터» 에 남는다(사용자 결정).
   ・1절: 실물 _pickRunDisplay 를 모니터 배치 흉내로 — 주모니터 바꾸기(두 방향) · 같은 모델 둘 · 이름 없음(옛 동작) · 옛 저장(이름 없음) ·
     고른 모니터를 뺌 → 대체(저장 안 덮음) → 다시 꽂음 · 이름 길이 상한
   ・2절: 실물 getRunDisplay — 찾으면 새 id · 지문 · 이름으로 저장 · 약한 대체는 안 덮음 · 옛 저장에 이름 채움
   ・3절: 배선(고를 때 이름 저장 · 읽기 · 쓰기 · 연결 · 해제도 같은 처리기) · 4절: 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const MAIN = (() => { for (const c of ['main.js', '../main.js']) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; })();
if (!MAIN) { say('  ? 원본 못 찾음 — main.js'); process.exit(2); }
function grab(src, name){
  const i = src.indexOf('function ' + name + '('); if (i < 0) return null;
  let k = src.indexOf('{', i), d = 0;
  for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); }
  return null;
}
const HELPERS = ['_displayKey', '_displaySize', '_displayName', '_displayShape', '_shapeOfKey', '_pickRunDisplay'];
function load(src){
  const fns = HELPERS.map(n => grab(src, n)); if (fns.some(f => !f)) return null;
  return new Function('const DISPLAY_NAME_MAX = 200;\n' + fns.join('\n') + '\nreturn { _displayKey, _displayName, _pickRunDisplay };')();
}
/* 모니터 하나 — 제보자 모양: 일반 모니터 1920x1080 · 액정타블렛 1920x1080(같은 해상도!) · 이름이 다르다 */
const D = (id, x, y, w, h, label, rot, sf) => ({ id, label, bounds: { x, y, width: w, height: h }, rotation: rot || 0, scaleFactor: sf || 1 });
function behave(src){
  const M = load(src); if (!M) return null;
  const r = {};
  // 처음: 일반(주, 0,0) · 액정(오른쪽 1920,0)
  const monA = D(1, 0, 0, 1920, 1080, 'DELL P2422H'), tabB = D(2, 1920, 0, 1920, 1080, 'Wacom Cintiq 16');
  /* 고를 때(moveToDisplay)처럼 — 고른 순간의 모니터 목록(atPick)에서 이름이 하나뿐이었는지도 저장한다 */
  const pick = (all, primaryId, chosen, atPick) => M._pickRunDisplay(all, primaryId, { id: chosen.id, key: M._displayKey(chosen), wasPrimary: chosen.id === primaryId,
    name: M._displayName(chosen), nameUnique: (atPick || all).filter(d => M._displayName(d) === M._displayName(chosen)).length === 1 });
  // 주모니터를 액정으로 바꿈 — 원점이 액정으로: 액정(0,0) · 일반(-1920,0). Windows 는 id 를 다시 줄 수 있다
  const swapA = D(7, -1920, 0, 1920, 1080, 'DELL P2422H'), swapB = D(8, 0, 0, 1920, 1080, 'Wacom Cintiq 16');
  const afterSwap = [swapB, swapA];
  const pA = pick(afterSwap, 8, monA, [monA, tabB]), pB = pick(afterSwap, 8, tabB, [monA, tabB]);
  r.keepA = pA.display === swapA && pA.strong;      // 일반(주였던 것)을 골랐다 — 주가 바뀌어도 일반에
  r.keepB = pB.display === swapB && pB.strong;      // 액정(보조였던 것)을 골랐다 — 주가 돼도 액정에
  // 같은 모델 둘 — 이름이 같으면 지문 · id · 모양으로
  const twin1 = D(1, 0, 0, 2560, 1440, 'LG 27GL850'), twin2 = D(2, 2560, 0, 2560, 1440, 'LG 27GL850');
  const pT = pick([twin1, twin2], 1, twin2);
  r.twinKey = pT.display === twin2 && /name\+key/.test(pT.stage);
  const twin2b = D(5, 2560, 0, 2560, 1440, 'LG 27GL850'), twin1b = D(6, 0, 0, 2560, 1440, 'LG 27GL850');
  const pT2 = M._pickRunDisplay([twin1b, twin2b], 6, { id: 99, key: '2560x1440|0,0|0|100', wasPrimary: true, name: 'LG 27GL850' });
  r.twinKey2 = pT2.display === twin1b;
  const twinRot = D(9, 0, 0, 1440, 2560, 'LG 27GL850', 90), twinFlat = D(10, 1440, 0, 2560, 1440, 'LG 27GL850');
  const pT3 = M._pickRunDisplay([twinFlat, twinRot], 10, { id: 77, key: '1440x2560|-2560,0|90|100', wasPrimary: false, name: 'LG 27GL850' });
  r.twinShape = pT3.display === twinRot && pT3.stage === 'name+shape';
  // 이름이 비어 있으면 옛 순서(지문 → id → …)
  const noName = [D(1, 0, 0, 1920, 1080, ''), D(2, 1920, 0, 1280, 1024, '')];
  const pN = M._pickRunDisplay(noName, 1, { id: 2, key: '1280x1024|1920,0|0|100', wasPrimary: false, name: null });
  r.noName = pN.display === noName[1] && pN.stage === 'key';
  // 옛 저장(이름 없음) — 지문으로 찾는다(옛 동작 그대로)
  const pOld = M._pickRunDisplay([monA, tabB], 1, { id: 2, key: M._displayKey(tabB), wasPrimary: false, name: null });
  r.oldSave = pOld.display === tabB && pOld.stage === 'key';
  // 고른 액정을 뺌 → 대체(약함 · 저장 안 덮음) → 다시 꽂음 → 액정으로
  const pOut = pick([monA], 1, tabB, [monA, tabB]);
  r.unplug = pOut.display === null || pOut.strong === false;
  const tabBack = D(12, 1920, 0, 1920, 1080, 'Wacom Cintiq 16');
  const pBack = pick([monA, tabBack], 1, tabB, [monA, tabB]);
  r.replug = pBack.display === tabBack && pBack.strong;
  // 같은 모델 둘 중 고른 쪽(오른쪽)을 뺌 — 남은 쪽이 이름 하나로 걸려 확정되면 안 된다(저장이 덮여 다시 꽂아도 안 돌아옴)
  const tw1 = D(1, 0, 0, 2560, 1440, 'LG 27GL850'), tw2 = D(2, 2560, 0, 2560, 1440, 'LG 27GL850');
  const pTwOut = pick([tw1], 1, tw2, [tw1, tw2]);
  r.twinUnplug = !pTwOut.strong;
  const tw2Back = D(15, 2560, 0, 2560, 1440, 'LG 27GL850');
  const pTwBack = pick([tw1, tw2Back], 1, tw2, [tw1, tw2]);
  r.twinReplug = pTwBack.display === tw2Back && pTwBack.strong;
  // 흔한 이름(EDID 못 읽음) 둘 — 해상도가 달라도 고른 쪽을 빼면 확정하지 않는다
  const g1 = D(1, 0, 0, 1920, 1080, 'Generic PnP Monitor'), g2 = D(2, 1920, 0, 1280, 1024, 'Generic PnP Monitor');
  r.genericUnplug = !pick([g1], 1, g2, [g1, g2]).strong;
  // 이름 하나뿐이었는데 해상도를 바꿈 — 그 모니터에 띄우되 저장은 덮지 않는다
  const resized = D(3, 0, 0, 2560, 1440, 'Wacom Cintiq 16');
  const pRs = pick([monA, resized], 1, tabB, [monA, tabB]);
  r.reshaped = pRs.display === resized && !pRs.strong;
  r.nameCap = (M._displayName({ label: '  ' + 'x'.repeat(300) + '  ' }) || '').length === 200 && M._displayName({ label: '   ' }) === null && M._displayName(null) === null;
  return r;
}

say('\n── 1절: 실물 _pickRunDisplay');
const b = behave(MAIN);
if (!b) chk(false, 'main.js 에서 ' + HELPERS.join(' · ') + ' 를 찾았다');
else {
  chk(b.keepA, '★ 주모니터(일반)를 골라 둔 뒤 액정을 주모니터로 바꿔도 창은 고른 일반 모니터에(이름 · 확실 — 저장 갱신)');
  chk(b.keepB, '★ 보조(액정)를 골라 둔 뒤 그 액정을 주모니터로 바꿔도 액정에 — 두 경우가 똑같이 «고른 모니터»');
  chk(b.twinKey && b.twinKey2, '같은 모델 둘(이름 같음) — 지문이 맞는 쪽');
  chk(b.twinShape, '  지문도 id 도 안 맞으면 모양(해상도 · 회전 · 배율 — 위치 뺌)이 하나로 가르는 쪽');
  chk(b.noName, '이름이 비어 있는 모니터 — 옛 순서(지문 → id → …) 그대로');
  chk(b.oldSave, '이름 없는 옛 저장 — 지문으로 찾는다(옛 동작 그대로)');
  chk(b.unplug, '고른 모니터를 빼면 약한 대체(저장을 덮지 않는다)');
  chk(b.replug, '  다시 꽂으면(id 새로) 이름으로 그 모니터에');
  chk(b.nameCap, '이름은 앞뒤 공백을 떼고 200자까지 · 빈 이름은 없음');
  chk(b.twinUnplug, '★ 같은 모델 둘 중 고른 쪽을 빼면 남은 쪽으로 확정하지 않는다(저장 보존)');
  chk(b.twinReplug, '  다시 꽂으면(id 새로) 고른 쪽으로 돌아간다');
  chk(b.genericUnplug, '★ 흔한 이름(«Generic PnP Monitor») 둘 — 고른 쪽을 빼도 확정하지 않는다');
  chk(b.reshaped, '이름은 하나뿐인데 해상도가 바뀜 — 그 모니터에 띄우되 저장은 덮지 않는다');
}

say('\n── 2절: 실물 getRunDisplay — 저장 갱신');
{
  const fns = HELPERS.map(n => grab(MAIN, n)).concat([grab(MAIN, 'getRunDisplay')]);
  if (fns.some(f => !f)) chk(false, 'getRunDisplay 를 찾았다');
  else {
    const run = (all, primary, saved) => {
      const st = { saves: 0 };
      const f = new Function('screen', '_diagLog', 'saveSettings', 'SETTINGS_PATH', 'S',
        'const DISPLAY_NAME_MAX = 200; let _runDisplayLogged = "";\nlet runDisplayId = S.id, runDisplayKey = S.key, runDisplayWasPrimary = S.wasPrimary, runDisplayName = S.name, runDisplayNameUnique = !!S.nameUnique;\n'
        + fns.join('\n') + '\nconst d = getRunDisplay(); return { d, id: runDisplayId, key: runDisplayKey, name: runDisplayName, uniq: runDisplayNameUnique };');
      const out = f({ getAllDisplays: () => all, getPrimaryDisplay: () => primary }, () => {}, () => { st.saves++; }, 'x', saved);
      out.saves = st.saves; return out;
    };
    const a = D(1, 0, 0, 1920, 1080, 'DELL P2422H'), t = D(2, 1920, 0, 1920, 1080, 'Wacom Cintiq 16');
    const sa = D(7, -1920, 0, 1920, 1080, 'DELL P2422H'), sb = D(8, 0, 0, 1920, 1080, 'Wacom Cintiq 16');
    const o1 = run([sb, sa], sb, { id: 1, key: '1920x1080|0,0|0|100', wasPrimary: true, name: 'DELL P2422H', nameUnique: true });
    chk(o1.d === sa && o1.id === 7 && o1.key === '1920x1080|-1920,0|0|100' && o1.saves === 1, '★ 주모니터를 바꾼 뒤 — 고른 일반 모니터로 · 새 id · 지문으로 저장(다음엔 바로 찾음)');
    const o2 = run([a, t], a, { id: 2, key: '1920x1080|1920,0|0|100', wasPrimary: false, name: null });
    chk(o2.d === t && o2.name === 'Wacom Cintiq 16' && o2.uniq === true && o2.saves === 1, '이름 없는 옛 저장 — 지문으로 찾고 이름을 채워 저장(다음 주모니터 변경부터 이름으로)');
    const o3 = run([a], a, { id: 2, key: '1920x1080|1920,0|0|100', wasPrimary: false, name: 'Wacom Cintiq 16', nameUnique: true });
    chk(o3.d === a && o3.saves === 0 && o3.name === 'Wacom Cintiq 16' && o3.id === 2, '고른 모니터가 빠졌을 때 — 주 모니터로 대신 · 저장은 그대로(다시 꽂으면 돌아감)');
    const o4 = run([a, t], a, { id: 2, key: '1920x1080|1920,0|0|100', wasPrimary: false, name: 'Wacom Cintiq 16', nameUnique: true });
    const tw1 = D(1, 0, 0, 2560, 1440, 'LG 27GL850');
    const o5 = run([tw1], tw1, { id: 2, key: '2560x1440|2560,0|0|100', wasPrimary: false, name: 'LG 27GL850', nameUnique: false });
    chk(o5.saves === 0 && o5.id === 2 && o5.key === '2560x1440|2560,0|0|100', '★ 같은 모델 둘 중 고른 쪽이 빠졌을 때 — 저장(id · 지문)을 덮지 않는다');
    chk(o4.d === t && o4.saves === 0, '  이미 맞으면 저장하지 않는다(자주 불린다)');
  }
}

say('\n── 3절: 배선');
const mv = MAIN.slice(MAIN.indexOf("ipcMain.handle('companion:moveToDisplay'"), MAIN.indexOf("ipcMain.handle('companion:moveToDisplay'") + 1500);
chk(/runDisplayName = _displayName\(target\);/.test(mv) && /runDisplayNameUnique = !!runDisplayName && all\.filter/.test(mv) && mv.indexOf('runDisplayNameUnique =') < mv.indexOf('saveSettings();'), '모니터를 고를 때 이름과 «그 이름이 하나뿐인가» 를 저장한다(저장 전에)');
chk(/typeof data\.runDisplayName === 'string'/.test(MAIN) && /\.slice\(0, DISPLAY_NAME_MAX\)/.test(MAIN) && /runDisplayWasPrimary, runDisplayName,/.test(MAIN), '  설정 파일 읽기(문자열 · 공백 · 200자) · 쓰기');
chk(/screen\.on\('display-metrics-changed', _onDisplaysChanged\);/.test(MAIN) && /screen\.on\('display-added', _onDisplaysChanged\);/.test(MAIN) && /screen\.on\('display-removed', _onDisplaysChanged\);/.test(MAIN),
  '★ 모니터 연결 · 해제도 같은 처리기 — 실행 중에 다시 찾아 옮긴다(예전엔 표시 설정 변경만)');
chk(/const d = getRunDisplay\(\);/.test(MAIN.slice(MAIN.indexOf('const _onDisplaysChanged = () => {'))), '  처리기는 실행 화면이면 getRunDisplay 로 다시 찾는다');

say('\n── 4절: 깨 보기');
const noNameFirst = behave(MAIN.replace("      if(!shape || _displayShape(byName[0]) === shape) return { display: byName[0], stage: 'name', strong: true };\n", ''));
chk(!!noNameFirst && (noNameFirst.keepA === false || noNameFirst.keepB === false), '이름 찾기를 빼면 1절 «주모니터를 바꿔도 고른 모니터» 가 빨강(제보 그대로)');
const noUniq = behave(MAIN.replace("    if(byName.length === 1 && saved.nameUnique === true){", "    if(byName.length === 1){"));
chk(!!noUniq && (noUniq.twinUnplug === false || noUniq.genericUnplug === false), '«하나뿐이었나» 조건을 빼면 1절 «같은 모델 · 흔한 이름 — 빼도 확정 안 함» 이 빨강(검증에서 잡힌 구멍)');
const looseTwin = behave(MAIN.replace("      const k = key && byName.find(d => _displayKey(d) === key);\n", "      const k = byName[0];\n"));
chk(!!looseTwin && looseTwin.twinKey === false, '같은 이름 중 아무거나 고르면 1절 «같은 모델 둘» 이 빨강');

say(`\n결과: ${pass}·${fail}`);
process.exit(fail ? 1 : 0);
