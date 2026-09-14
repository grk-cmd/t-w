/* sim-purikura-stage.js — 📷 촬영 창 + 무대 검사
   실행:  node sim-purikura-stage.js   (app.js · desk-companion-prototype.html 과 같은 폴더에서)

   ★ 왜 이 검사가 있는가
     이 화면의 사고는 **전부 화면에 표시가 안 난다.** 무대 비율이 컷 비율과 어긋나도 무대는
     멀쩡히 보이고, 캡처가 빈 그림을 줘도 셔터는 터지고, 프레임 업로드가 실패해도 사진은 찍힌다.
     제보가 오는 시점은 「다 찍고 나서」이거나 「요금 고지서」다. 그래서 눈 대신 이 파일이 본다.

   ★ 무엇을 보는가
     §1 기하  — 무대 비율 = 컷 비율 · 여백 40 일관 · 무대가 창 안에 들어오는가
     §2 인원  — 허용한 다섯 조합에 4명이 실제로 서는가 (세로 2컷을 뺀 근거를 다시 센다)
     §3 규칙  — 규칙식을 **실제로 실행해서** 세로 2컷이 거부되는가
     §4 소스  — app.js·HTML 이 규약 다섯을 지키는가 (전용 렌더러·창 층·키 잠금·캡처 대상·업로드)

   ⚠️ 실제 화면의 생김새는 여기서 못 본다 — 그건 눈으로 볼 것. 여기서 지키는 것은 규약뿐이다. */
'use strict';
const fs = require('fs');
const P = require('./purikura-net.js');
const SRC  = fs.readFileSync('app.js', 'utf8');
const HTML = fs.readFileSync('desk-companion-prototype.html', 'utf8');
const INIT = fs.readFileSync('firebase-init.js', 'utf8');
const RULES = JSON.parse(fs.readFileSync('firebase-database-rules.json', 'utf8'));
const say = console.log;
let fail = 0;
const chk = (c, m) => { say((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };

/* ── 함수 본문 떼어내기 ────────────────────────────────────────────────────
   ★ 「A 뒤 N 글자 안에 B 가 있는가」로 보지 않는다. 그 창은 **주석 한 줄에 밀린다** —
     2026-09 에 `openPurikura … watchQuota` 가 1800 창을 2322자로 넘겨 빨개졌는데 코드는
     멀쩡했다. 중괄호를 세어 본문 전체를 떼면 거리와 무관해지고, 동시에 «다른 함수에 있는
     같은 이름»을 잘못 세는 일도 없어진다.
   ⚠️ 못 찾으면 빈 문자열을 준다 — 부르는 쪽이 ✗ 로 떨어지므로 조용히 통과하지는 않는다. */
const _bodies = {};
function bodyOf(name){
  if (_bodies[name] !== undefined) return _bodies[name];
  const i = SRC.indexOf('function ' + name + '(');
  if (i < 0) return (_bodies[name] = '');
  let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++){
    if (SRC[k] === '{') d++;
    else if (SRC[k] === '}' && --d === 0) return (_bodies[name] = SRC.slice(i, k + 1));
  }
  return (_bodies[name] = '');
}

say('=== 📷 스티커사진 촬영 창 + 무대 검사 ===');
say('');

/* ── §1. 기하 ──────────────────────────────────────────────────────── */
say('· §1 기하 — 「무대 비율 = 컷 비율」이 지켜지는가');
{
  const combos = [];
  ['p','l'].forEach(o => P.cutsFor(o).forEach(n => combos.push([o,n])));

  chk(P.cutsFor('p').join(',') === '1,4', '세로형 컷은 1·4 다 (2컷은 뺐다)');
  chk(P.cutsFor('l').join(',') === '1,2,4', '가로형 컷은 1·2·4 다');
  chk(!P.cutAllowed('p', 2), '★ 세로형 2컷은 허용되지 않는다');

  let ratioOk = true, boundOk = true, gutOk = true;
  combos.forEach(([o,n]) => {
    const spec = P.frameSpec(o,n), st = P.stageSize(o,n);
    /* 반올림 때문에 딱 떨어지지는 않는다 — 1px 안쪽이면 같은 비율로 본다. */
    if (Math.abs(st.w/st.h - spec[0]/spec[1]) > 0.01) ratioOk = false;
    if (st.w > P.STAGE_W_MAX || st.h > P.STAGE_H_MAX) boundOk = false;
    /* 여백은 어디나 같아야 한다 — 바깥 테두리와 컷 사이가 다르면 컷마다 규격이 달라진다. */
    const r = P.cellRects(o,n,1), W = P.sheetW(o), H = P.sheetH(o);
    const g = P.GUTTER;
    r.forEach(c => {
      if (Math.abs(c[0] - g) > 0.5 && Math.abs(c[0] - (g + (W - g*3)/2 + g)) > 0.5 &&
          Math.abs((W - (c[0]+c[2])) - g) > 0.5) gutOk = false;
      if (c[1] < g - 0.5) gutOk = false;
      if (c[0] + c[2] > W - g + 0.5) gutOk = false;
      if (c[1] + c[3] > H - g + 0.5) gutOk = false;
    });
  });
  chk(ratioOk, '★ 다섯 조합 모두 무대 비율이 컷 비율과 같다 (다르면 보이는 것과 찍히는 것이 갈라진다)');
  chk(boundOk, '무대가 창 안에 들어온다 (' + P.STAGE_W_MAX + '×' + P.STAGE_H_MAX + ' 이내)');
  chk(gutOk,   '컷이 여백 ' + P.GUTTER + ' 안쪽에 들어가 있다');

  /* 가로형은 세로형을 90도 돌린 것 — 같은 컷 수라면 규격이 정확히 뒤집혀야 한다.
     ★ 컷 «목록»은 갈라졌지만 «기하»는 안 갈라졌다는 것을 여기서 지킨다. */
  let flipOk = true;
  [1,4].forEach(n => {
    const a = P.frameSpec('p',n), b = P.frameSpec('l',n);
    if (a[0] !== b[1] || a[1] !== b[0]) flipOk = false;
  });
  chk(flipOk, '★ 같은 컷 수면 가로형 규격이 세로형의 정확히 뒤집힌 값이다');

  const s4 = P.frameSpec('p',4);
  chk(s4[0] === 540 && s4[1] === 740, '세로 4컷 프레임은 540×740 이다 (시안 v9 의 값)');
}
say('');

/* ── §2. 인원 ──────────────────────────────────────────────────────── */
say('· §2 인원 — 허용한 조합에 4명이 실제로 서는가');
{
  const rows = [];
  ['p','l'].forEach(o => P.cutsFor(o).forEach(n => {
    const cap = 2 * P.halfWorld(o,n,P.CAM_FAR) / P.BODY_W;   // 몇 몸통이 들어가나
    rows.push([o,n,cap]);
  }));
  rows.forEach(([o,n,cap]) => {
    const over = Math.max(0, (P.MAX_SLOTS - cap) / P.MAX_SLOTS * 100);
    chk(over <= 5, (o==='p'?'세로':'가로') + n + '컷 — 4명 겹침 ' + over.toFixed(0) + '% (5% 이하)');
  });
  /* 뺀 조합이 실제로 왜 못 쓰는지도 같이 센다. 이 숫자가 이 결정의 근거다 —
     나중에 무대 상한이나 여백을 바꾸면 여기가 먼저 깨져서 다시 판단하게 된다. */
  const capP2 = 2 * P.halfWorld('p',2,P.CAM_FAR) / P.BODY_W;
  const overP2 = (P.MAX_SLOTS - capP2) / P.MAX_SLOTS * 100;
  chk(overP2 > 30, '★ 세로 2컷은 4명이 ' + overP2.toFixed(0) + '% 겹친다 — 뺀 이유가 그대로다');

  /* 최근접에서 머리가 잘리는 것은 **의도**다. 잘리지 않게 되면 카메라 값이 바뀐 것이므로 알려야 한다.
     ★ 재는 식을 여기 다시 적지 않는다. `projY` 가 「무엇이 잘리는가」의 유일한 출처이고,
       화면(THREE)도 그것을 쓴다 — 검사기가 따로 계산하면 각을 바꿨을 때 한쪽만 고쳐져서
       **검사는 통과하는데 사진에서만 머리가 잘린다**(purikura-net.js `projY` 주석).
     ⚠️ 2026-09 에 실제로 그 일이 났다. 예전 식은 `st.h/2 + (CAM_HEIGHT-CHAR_H)*f/CAM_NEAR` 로
       **기울기(CAM_PITCH)가 없었다.** 각이 0 → 16° 로 바뀌자 +136px(머리가 화면 안)이라는
       틀린 답을 내고 빨개졌다. 실제로는 -64px 로 나가 있었다. */
  const headY = P.projY('p', 4, P.CHAR_H, P.CAM_NEAR);
  /* ⚠️ 부호를 뒤집어 찍지 말 것. 예전 줄은 실패할 때도 `(-136px)` 로 찍혀서 «136px 나갔는데
     왜 빨간가» 로 읽혔다 — 실제로는 +136px, 즉 **화면 안에** 있어서 빨간 것이었다. */
  chk(headY < 0, '★ 최근접에서 머리가 화면 위로 나간다 ('
      + (headY < 0 ? Math.round(-headY) + 'px 나감' : '안 나감 — 화면 안쪽 ' + Math.round(headY) + 'px')
      + ') — 클로즈업은 의도다');
  /* ⚠️ 여기에 **CAM_PITCH 가 빠져 있었다.** 각이 0 에서 16 으로 바뀌는 동안 이 줄은 아무 말도
     안 했다 — 못 박는 목록에 없는 값은 조용히 움직인다. 값을 늘리면 반드시 여기에도 적을 것. */
  chk(P.CAM_FOV === 35 && P.CAM_HEIGHT === 1.65 && P.CAM_PITCH === 16
      && P.CAM_NEAR === 0.45 && P.CAM_FAR === 5.4,
      '카메라 확정값이 그대로다 (35° · 1.65 · 16° · 0.45 · 5.4 — 시안 purikura-design-camera-v2-3d)');
}
say('');

/* ── §3. 규칙 ──────────────────────────────────────────────────────── */
say('· §3 규칙 — 세로 2컷을 서버가 거부하는가 (식을 실제로 실행한다)');
{
  const meta = RULES.rules.rooms['$room']._photo.meta;

  /* newData.parent() 를 흉내내야 한다 — 이번 규칙이 형제 노드를 본다.
     ⚠️ 실제 RTDB 는 «쓰지 않은 형제»를 기존 값으로 채워서 본다. 그 동작까지 흉내낸다. */
  function snap(val, parent){
    const s = {
      exists(){ return val !== null && val !== undefined; },
      val(){ return val; },
      isNumber(){ return typeof val === 'number'; },
      isString(){ return typeof val === 'string'; },
      child(k){ return snap(val && val[k] !== undefined ? val[k] : null, s); },
      parent(){ return parent || snap(null, null); }
    };
    return s;
  }
  function runChild(expr, metaObj, key, now){
    const m = snap(metaObj, null);
    return new Function('newData','data','now','return (' + expr + ');')(m.child(key), snap(null,null), now);
  }

  chk(runChild(meta.cuts['.validate'], {orient:'l', cuts:2}, 'cuts', Date.now()),
      '가로형 2컷은 통과한다');
  chk(!runChild(meta.cuts['.validate'], {orient:'p', cuts:2}, 'cuts', Date.now()),
      '★ 세로형 2컷은 거부된다');
  chk(runChild(meta.cuts['.validate'], {orient:'p', cuts:4}, 'cuts', Date.now()) &&
      runChild(meta.cuts['.validate'], {orient:'p', cuts:1}, 'cuts', Date.now()),
      '세로형 1컷·4컷은 통과한다');
  /* ★ 반대 방향도 막혀 있어야 한다. .validate 는 «쓰인 노드»에만 돌기 때문에, cuts 쪽만 걸면
     이미 2컷인 방에서 orient 만 'p' 로 바꾸는 길이 열린 채 남는다. */
  chk(!runChild(meta.orient['.validate'], {orient:'p', cuts:2}, 'orient', Date.now()),
      '★ 이미 2컷인 방을 세로형으로 바꾸는 것도 거부된다 (반대 방향 구멍)');
  chk(runChild(meta.orient['.validate'], {orient:'p', cuts:4}, 'orient', Date.now()),
      '4컷인 방은 세로형으로 바꿀 수 있다');

  chk(!!meta.cut && !!meta.cutAt, '컷 진행(cut·cutAt)에 검증이 붙어 있다');
  chk(meta['$other'] && meta['$other']['.validate'] === false,
      '★ meta 에 모르는 자식을 못 넣는다 (검증 없는 필드가 새는 통로를 막는다)');
  const now = Date.now();
  chk(!new Function('newData','now','return (' + meta.cutAt['.validate'] + ');')(snap(now + 600000, null), now),
      '★ cutAt 을 미래로 못 쓴다 (미리 적어두고 셔터를 당기는 길)');

  /* 계층이 화면보다 먼저 막는지도 같이 본다 — 안 막으면 쓰기가 조용히 실패하고 화면은 무반응이 된다. */
  chk(/cutAllowed\(cfg\.orient,\s*cfg\.cuts\)/.test(fs.readFileSync('purikura-net.js','utf8')),
      '★ setConfig 가 허용되지 않는 조합을 먼저 거른다 (규칙에만 맡기면 화면이 무반응이 된다)');
}
say('');

/* ── §4. 소스 대조 ─────────────────────────────────────────────────── */
say('· §4 소스 — 창·키·캡처·업로드의 규약');
{
  /* ① 캡처는 전용 렌더러로. 메인 renderer 에는 preserveDrawingBuffer 가 없어 빈 그림이 나온다. */
  const rig = /PK\.renderer\s*=\s*new THREE\.WebGLRenderer\(\{([^}]*)\}\)/.exec(SRC);
  chk(!!rig && /preserveDrawingBuffer:\s*true/.test(rig[1]),
      '★ 무대 렌더러에 preserveDrawingBuffer 가 있다 (없으면 toDataURL 이 빈 그림을 준다)');
  chk(/_pkCapture[\s\S]{0,600}PK\.renderer\.domElement\.toDataURL/.test(SRC),
      '★ 캡처는 무대 렌더러에서 뜬다 (메인 renderer 가 아니다)');
  chk(!/_pkCapture[\s\S]{0,600}\bcamera\b/.test(SRC),
      '★ 캡처가 메인 카메라를 안 쓴다 (화각이 갈리면 보이는 것과 찍히는 것이 달라진다)');

  /* ② 무대 크기는 계층 하나가 정한다. 여기서 다시 계산하면 갈라진다. */
  chk(/_pkSizeStage[\s\S]{0,400}stageSize\(/.test(SRC),
      '무대 크기를 Purikura.stageSize 에서 받는다 (화면이 따로 계산하지 않는다)');

  /* ③ 프레임 두 겹은 캡처 대상 밖이다. #pkStage 에 그리면 사진에 구워진다. */
  const sync = /function _pkSyncFrame\(\)[\s\S]*?\n\}/.exec(SRC);
  chk(!!sync && /pkStageOv/.test(sync[0]) && !/getElementById\('pkStage'\)\.getContext/.test(sync[0]),
      "★ 프레임은 오버레이(#pkStageOv)와 테두리에만 그린다 (#pkStage 에 그리면 사진에 두 겹이 된다)");

  /* ④ 창 층·키 잠금 — 한쪽만 넣으면 조용히 어긋난다. */
  chk(/_WIN_Z_LAYERS\s*=\s*\[[^\]]*'pkOverlay'/.test(SRC),
      '#pkOverlay 가 창 층 사다리에 있다 (없으면 눌러도 앞으로 안 나온다)');
  chk(/OPEN_MODAL_SEL\s*=\s*'[^']*#pkOverlay\.on/.test(SRC),
      '★ #pkOverlay.on 이 F 키 잠금 목록에 있다 (없으면 촬영 중 F5 로 대화창이 열린다)');
  chk(/_pkIsOpen\(\)\)\s*return;/.test(SRC),
      "★ 'b' 조준 단축키가 촬영 중에는 안 먹는다");
  chk(/_pkKey[\s\S]{0,400}_pkTyping\(\)\)\s*return/.test(SRC),
      '★ 입력칸에 포커스가 있으면 키를 안 가져간다 (안 그러면 어디서도 글자를 못 친다)');
  chk(/escRegisterWindow\(\{[\s\S]{0,200}key:'purikura'/.test(SRC),
      '촬영 창이 ESC 사다리에 태워져 있다');
  chk(/state === 'shooting'[\s\S]{0,160}return false/.test(bodyOf('closePurikura'))
      && /PK\.cutIdx >= 0 \|\| PK\.frozen/.test(bodyOf('closePurikura')),
      '★ 세는 중에는 창이 안 닫힌다 (방장이 나가면 남은 사람의 카운트다운이 안 끝난다)');

  /* ⑤ 업로드 실패를 dataURL 로 삼키면 RTDB 다운로드 단가가 40배가 된다. */
  const up = /async pkUploadFrame\([\s\S]*?\n    \},/.exec(INIT);
  chk(!!up && !/return dataUrl/.test(up[0]) && /throw/.test(up[0]),
      '★ pkUploadFrame 이 실패를 dataURL 로 안 삼킨다 (삼키면 이미지가 RTDB 로 간다 — 단가 40배)');
  chk(/_uploadDataUrlIfNeeded/.test(INIT) && !(up && /_uploadDataUrlIfNeeded/.test(up[0])),
      '프레임 업로드가 _uploadDataUrlIfNeeded 를 쓰지 않는다 (그쪽은 폴백이 있다)');
  const fr = RULES.rules.rooms['$room']._photo.frames['$i']['.validate'];
  chk(/https/.test(fr), '규칙도 frames 에 https URL 만 받는다 (두 겹으로 막는다)');

  /* ⑥ 정원 구독은 창이 열려 있는 동안만. 전원 상시 구독이면 월 9원이 528원이 된다.
     ⚠️ 예전에는 `openPurikura[\s\S]{0,1800}watchQuota\(` 처럼 **글자 수로 창을 잡았다.**
       주석이 늘자 2322자로 벌어져 빨개졌는데, 코드는 한 글자도 안 틀렸다(2026-09).
       글자 수는 사람이 주석 한 줄을 더 쓰는 것만으로 어긋난다 — 함수 본문을 통째로 본다. */
  chk(/watchQuota\(/.test(bodyOf('openPurikura')),
      '★ watchQuota 는 촬영 창을 연 사람만 건다 (전원 상시 구독이면 월 9원 → 528원)');
  chk(/unwatchQuota/.test(bodyOf('closePurikura')),
      '창을 닫을 때 정원 구독을 해제한다');

  /* ⑦ HTML 쪽 — 세 겹의 순서와 시작 z. */
  chk(/#pkOverlay\{[^}]*z-index:82/.test(HTML),
      '#pkOverlay 의 시작 z 가 82 다 (낮추면 처음 한 번은 안 올라온다)');
  chk(HTML.indexOf('id="pkStage"') < HTML.indexOf('id="pkStageOv"'),
      '★ #pkStage 가 #pkStageOv 보다 앞이다 (뒤집히면 프레임이 무대를 덮는다)');
  chk(/#pkOverlay\{[^}]*pointer-events:none/.test(HTML),
      '오버레이가 빈 곳의 클릭을 통과시킨다 (#chatOverlay 와 같은 방식)');
  /* ⚠️ Electron 은 «우리 창 위인가»를 이 선택자 목록으로 판정한다. 빠지면 창이 보이는데
     클릭이 뒤 바탕화면으로 뚫린다 — «떠 있는데 안 눌린다»가 된다. body 에 붙는 창을 새로
     만들면 반드시 여기에 추가할 것(마이홈 색 팝업·좌석 우클릭 메뉴가 실제로 겪었다). */
  chk(/UI_HIT_SEL\s*=\s*'[^']*#pkOverlay/.test(SRC),
      '★ #pkOverlay 가 클릭 통과 화이트리스트에 있다 (빠지면 보이는데 안 눌린다)');
}
say('');

/* ── §5. 런타임 ────────────────────────────────────────────────────── */
say('· §5 런타임 — 방향을 바꿀 때 컷이 어디로 가는가');
{
  chk(P.fallbackCut('l', 2) === 2, '가로형에서 2컷은 그대로다');
  chk(P.fallbackCut('p', 2) === 4, '★ 세로형으로 가면 2컷 → 4컷 (1컷으로 떨어뜨리지 않는다)');
  chk(P.fallbackCut('p', 4) === 4 && P.fallbackCut('p', 1) === 1, '1·4 는 방향을 바꿔도 그대로다');

  /* 좌표 자르기 — 멀수록 더 넓게 움직일 수 있어야 한다. 화면 px 로 자르면 이게 뒤집힌다. */
  const near = P.halfWorld('l',1,P.CAM_NEAR), far = P.halfWorld('l',1,P.CAM_FAR);
  chk(far > near, '★ 멀수록 좌우로 더 넓게 움직인다 (월드 좌표로 자른다는 뜻)');
}
say('');

if (fail) { say('✗ ' + fail + '건 어긋남'); process.exit(1); }
say('전부 통과 ✅ — 무대가 컷과 같은 것을 보고 있다');
