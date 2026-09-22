/* ═══ 🛟 sim-slot-sync-ui.js — 3-7-2 연동 UI: 런처 띠 · 계정 탭 «기기 연동» · ④ 충돌 대화상자 (2026-09-20 · 시안 확정) ═══
   [무엇을 지키나] 3-7 에서 캐릭터 4개를 잃은 순간 화면에 나간 말은 «받아왔어요» 하나였고, 되돌릴 자리가 없었다.
     시안(캔버스 «3-7-2 시안»)대로 세 자리를 만들었다 —
       A안 띠(런처 · 그림 바로 위 · 세 상태) · B안 구획(계정 탭 · 마지막 연동/개수 · 되돌리기 · 올리기 실패) · ④ 대화상자.
   ・1절: 마크업 — 세 자리와 id 가 있다.
   ・2절: 배선 — renderLauncher → 띠, refreshAccountTab → 구획, adopt 가 손실을 기록, push 가 실패 사유를 기록,
          기록 셋이 ACCOUNT_LOCAL_KEYS 에 있다(로그아웃 = 정리), 되돌리기·유지하기·다시 올리기가 각각 맞는 함수로 간다.
   ・3절: 문구 — 시안 그대로(줄어든 교체 · 백업 없음 · 되돌린 직후 · 평상시) · «되돌릴 수 있는 기한» 줄은 없다(근거 없는 줄).
   [실행] app.js · desk-companion-prototype.html 이 있는 폴더에서. 판정 줄은 맨 끝. */
'use strict';
const fs = require('fs');
if(!fs.existsSync('app.js') || !fs.existsSync('desk-companion-prototype.html')) process.exit(2);
const SRC = fs.readFileSync('app.js', 'utf8');
const HTML = fs.readFileSync('desk-companion-prototype.html', 'utf8');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
function grabFn(src, name, kw){
  const i = src.indexOf((kw || 'function ') + name + '(');
  if(i < 0) return null;
  let k = src.indexOf('{', i), d = 0;
  for(; k < src.length; k++){ if(src[k] === '{') d++; else if(src[k] === '}' && --d === 0) return src.slice(i, k + 1); }
  return null;
}

say('── 1. 마크업 — 세 자리');
const band = /<div id="lcSyncBand"[^>]*>/.exec(HTML);
chk(!!band && HTML.indexOf('id="lcSyncBand"') < HTML.indexOf('<div class="lc-stage">') && HTML.indexOf('id="lcSyncBand"') > HTML.indexOf('id="lcGearMenu"'), '★ 런처 띠가 그림(lc-stage) **바로 위**에 있다 — 사라진 것을 보는 그 자리(A안)');
chk(!!band && /display:none/.test(band[0]), '  띠는 기본 숨김 — app.js 가 기록이 있을 때만 연다');
const acctI = HTML.indexOf('id="acctSyncBox"');
/* ★ 개정 45(회원가입 설계 개정 16 · 시안 C4) — 구획이 [내 정보 › 계정](#miPageAcct)으로 옮겨 갔고, C4 순서는
     로그인 수단·비밀번호(#acctMethods) → **기기 연동** → [이 컴퓨터에서 로그아웃]. 옛 판정(로그아웃 상자 다음 · 되찾기 앞)은 되찾기를 걷어 대상이 없다. */
chk(acctI > 0 && acctI > HTML.indexOf('id="miPageAcct"') && acctI > HTML.indexOf('<div id="acctMethods"') && acctI < HTML.indexOf('<button id="acctLogoutBtn"'), '★ «기기 연동» 구획이 [내 정보 › 계정] 안 · 비밀번호 다음 · [로그아웃] 앞에 있다(C4)');
chk(/id="acctSyncFail"[^>]*display:none/.test(HTML) && /id="acctSyncHint"/.test(HTML), '  올리기 실패 상자(숨김) · 안내 한 줄');
chk(/30분마다 저절로 맞춰져요/.test(HTML), '  안내 문구가 시안 그대로');
const dlgI = HTML.indexOf('id="slotConflictDlg"');
chk(dlgI > 0 && /id="slotConflictDlg"[^>]*display:none[^>]*position:fixed/.test(HTML), '★ ④ 대화상자가 전역 오버레이(숨김)로 있다');
['scdLocalN', 'scdServerN', 'scdLocalAt', 'scdServerAt', 'scdKeepServer', 'scdKeepMine', 'scdLater', 'scdMsg'].forEach(id => chk(HTML.indexOf('id="' + id + '"') > dlgI, '  ' + id));
chk(HTML.indexOf('id="scdKeepServer"') < HTML.indexOf('id="scdKeepMine"'), '  다른 PC(계정) 버튼이 왼쪽, 현재 PC 가 오른쪽(시안 순서)');
chk(/캐릭터가 양쪽에서 바뀌었어요/.test(HTML) && /고르지 않은 쪽은 백업으로 남아요/.test(HTML) && /나중에 결정/.test(HTML), '  문구가 시안 그대로');
chk(!/confirm\(/.test(grabFn(SRC, '_slotsShowConflictDlg') || 'confirm('), '  네이티브 confirm 을 안 쓴다(투명 창에서 안 뜬다 — 캐릭터 삭제와 같은 이유)');

say('── 2. 배선');
const rl = grabFn(SRC, 'renderLauncher') || '';
chk(/_slotsRenderBand\(\)/.test(rl), '★ renderLauncher 가 띠를 그린다 — 런처를 열 때마다');
const rat = grabFn(SRC, 'refreshAccountTab') || '';
chk(/_slotsRenderAcctSync\(\)/.test(rat), '★ refreshAccountTab 이 구획을 그린다 — 탭을 열 때마다');
const adopt = grabFn(SRC, '_slotsAdoptFromServer', 'async function ') || '';
chk(/if\(prevCount > nextCount\)\{[\s\S]*?_slotsJsonSet\(SLOTS_LOSS_KEY, \{ kind: 'loss', from: prevCount, to: nextCount, at: _slotsNow\(\), bak: !!bakSaved \}\);/.test(adopt), '★ 칸이 줄어드는 교체가 손실 기록을 남긴다(from·to·bak 있음/없음)');
chk(/_slotsNoteSync\(true, \{ serverCount: nextCount \}\)/.test(adopt), '  받아 적으면 «마지막 연동 · 계정 개수» 를 적는다');
const push = grabFn(SRC, '_slotsPushToServer', 'async function ') || '';
chk((push.match(/_slotsNotePushFail\(/g) || []).length === 3, '★ 올리기 실패 세 갈래(그림 · 너무 큼 · 거부)가 사유를 남긴다');
chk(/_slotsJsonSet\(SLOTS_PUSHFAIL_KEY, null\); _slotsNoteSync\(true, \{ serverCount: Object\.keys\(s\)\.length \}\)/.test(push), '  올리기 성공이 실패 기록을 지우고 개수를 적는다');
const sync = grabFn(SRC, 'syncSlotsToServer', 'async function ') || '';
chk(/_slotsNoteSync\(false, \{ why: '서버를 읽지 못했어요' \}\)/.test(sync) && /_slotsNoteSync\(true\);\s*\n\s*return;/.test(sync), '  읽기 실패·«같음» 도 마지막 연동에 적힌다(연동이 도는지 볼 수 있게)');
const keys = SRC.slice(SRC.indexOf('const ACCOUNT_LOCAL_KEYS'), SRC.indexOf('const ACCOUNT_LOCAL_KEYS') + 5000);
chk(/SLOTS_LOSS_KEY, SLOTS_LASTSYNC_KEY, SLOTS_PUSHFAIL_KEY,/.test(keys), '★ 기록 셋이 ACCOUNT_LOCAL_KEYS 에 — 다음 계정이 남의 «5개가 1개로» 를 보면 안 된다');
chk(!/SLOTS_BAK_KEY,/.test(keys), '  백업 키는 여전히 목록 밖(3-7-1 결정 그대로)');
const bandFn = grabFn(SRC, '_slotsRenderBand') || '';
chk(/lcSyncRestore.*_slotsRestoreFromUI/.test(bandFn) && /\['lcSyncKeep', 'lcSyncClose', 'lcSyncOk'\]\.forEach/.test(bandFn) && /_slotsDismissLoss\(\)/.test(bandFn), '★ [되돌리기] → 되돌리기, [유지하기]·[닫기]·[확인] → 기록만 접는다(아무것도 안 바꾼다)');
const dis = grabFn(SRC, '_slotsDismissLoss') || '';
chk(/dismissed = true/.test(dis) && !/removeItem|restore|_slotsTouch/.test(dis), '  접기는 dismissed 표시뿐 — 백업도 저장본도 안 건드린다');
const acctFn = grabFn(SRC, '_slotsRenderAcctSync') || '';
chk(/acctSyncRetry[\s\S]*?syncSlotsToServer\('retry'\)/.test(acctFn) && !/_slotsTouch/.test(acctFn), '★ [지금 다시 올리기] 는 ts 를 새로 찍지 않고 동기화만 다시 부른다 — 실패한 push 는 이미 «로컬이 최신» 이라 그 갈래로 다시 간다');
chk(/acctSyncPick[\s\S]*?_slotsShowConflictDlg\(_slotsConflict\)/.test(acctFn), '  ④ 를 [나중에 결정] 로 미룬 사람의 길 — 구획의 [고르기] 가 대화상자를 다시 연다');
const restore = grabFn(SRC, 'restoreSlotsBackup', 'async function ') || '';
chk(/_slotsJsonSet\(SLOTS_LOSS_KEY, \{ kind: 'restored', to: _slotsFilledCount\(bak\), at: _slotsNow\(\) \}\)/.test(restore), '  되돌리면 «되돌린 직후» 기록(띠 ③)');

say('── 3. 문구 — 시안 그대로');
chk(/캐릭터 ' \+ loss\.from \+ '개가 다른 컴퓨터의 ' \+ loss\.to \+ '개로 바뀌었어요/.test(bandFn) && /'되돌리기', \{ bold: true \}/.test(bandFn) && /'유지하기'/.test(bandFn), '  ① 줄어든 교체 — «N개가 다른 컴퓨터의 M개로 바뀌었어요» [되돌리기] [유지하기]');
chk(/백업을 남기지 못했어요/.test(bandFn) && /저장 공간이 모자랐어요/.test(bandFn) && /'닫기'/.test(bandFn) && !/어떻게 해야 하나요/.test(bandFn), '  ② 백업 없음 — 사유 한 줄 + [닫기] 만');
chk(/개로 되돌렸어요 — 다른 컴퓨터가 켜져 있으면 다시 바뀔 수 있어요/.test(bandFn) && /'확인'/.test(bandFn), '  ③ 되돌린 직후 — [확인]');
chk(/캐릭터가 연동됐어요\./.test(acctFn) && /'마지막 연동'/.test(acctFn) && /'계정에 저장된 캐릭터'/.test(acctFn), '  평상시 — «캐릭터가 연동됐어요.» · 마지막 연동 · 개수(이 기기 N개)');
chk(/직전의 이 컴퓨터 상태/.test(acctFn) && /개로 되돌리기'/.test(acctFn), '  줄어든 교체 — 설명 + [N개로 되돌리기]');
chk(!/되돌릴 수 있는 기한/.test(acctFn) && !/다음 연동 전까지/.test(acctFn + bandFn + HTML), '★ «되돌릴 수 있는 기한 — 다음 연동 전까지» 줄은 없다 — 백업은 연동으로 사라지지 않고 되돌리기는 맞바꾸기라 기한이 없다');
chk(/올리기가 한 번 실패했어요/.test(acctFn) && /'지금 다시 올리기'/.test(acctFn), '  올리기 실패 — 사유 · 시각 · [지금 다시 올리기]');
chk(/이 컴퓨터의 캐릭터 ' \+ prevCount \+ '개가 다른 컴퓨터의 ' \+ nextCount \+ '개로 바뀌었어요 — 시작 화면에서 되돌릴 수 있어요/.test(adopt), '  토스트도 분실일 땐 분실이라고 말한다(«받아왔어요» 아님)');

say('');
say('통과 ' + pass + ' · 실패 ' + fail + ' · 검사못함 0');
process.exit(fail ? 1 : 0);
