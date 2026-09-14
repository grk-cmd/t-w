/* sim-purikura-deco.js — 🎨 꾸미기 창 검사
   실행:  node sim-purikura-deco.js   (app.js · desk-companion-prototype.html 과 같은 폴더에서)

   ★ 왜 이 검사가 있는가
     이 화면의 사고는 **저장하고 나서야 보인다.** 화면(360px)에서는 선이 멀쩡한데
     내려받은 파일(1200px)만 어긋나 있거나, 속 빈 펜이 사진까지 뚫어 놨거나,
     스티커가 시트 밖으로 나가 그림에서만 사라져 있다. 화면을 아무리 들여다봐도 안 보인다.
     그래서 눈 대신 이 파일이 본다.

   ★ 무엇을 보는가
     §1 묶음  — 같은 설정으로 이어 그은 획이 **한 겹**이 되는가 (층이 지던 그 버그)
     §2 순서  — 펜 다섯을 **실제로 실행해서** 그리는 순서와 합성을 센다 (가짜 ctx)
     §3 좌표  — 획이 저장 좌표로만 담기는가 (배율은 그릴 때 한 번만 곱한다)
     §4 소스  — app.js·HTML 이 규약 여섯을 지키는가
                (화면=저장 같은 함수 · 딴 캔버스 · 통신 없음 · 저장 버튼 하나 · 키 · 닫기)

   ⚠️ 실제로 예쁜지는 여기서 못 본다 — 그건 눈으로 볼 것. 여기서 지키는 것은 규약뿐이다. */
'use strict';
const fs = require('fs');
const P = require('./purikura-net.js');
const SRC  = fs.readFileSync('app.js', 'utf8');
const HTML = fs.readFileSync('desk-companion-prototype.html', 'utf8');
const say = console.log;
let fail = 0;
const chk = (c, m) => { say((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };

/* 주석을 걷어낸 본문. **「없어야 한다」 검사는 반드시 이쪽을 본다** — app.js 주석에는
   하지 말라고 적어 둔 코드 조각이 그대로 인용돼 있어서(`v = pose + 4 같은 것`), 원문을 훑으면
   그 경고문 자체에 걸려 «되살아났다»고 오판한다. 실제로 2026-09-13 에 그렇게 헛짚었다. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/* ── 본문 떼기 ─────────────────────────────────────────────────────────────
   ★ **글자 수 창(`[\s\S]{0,2900}`)과 «바로 붙어 있어야 한다» 앵커를 쓰지 않는다.**
     2026-09-13 에 이 파일이 9건 빨강이었는데 코드는 한 줄도 안 틀렸었다. 셋이 원인이었다:
       ① `function _pkCloneChar(seat)` 로 시그니처를 박아 뒀는데 실물이 `(seat, out)` 이 됐다
          — 그 한 줄에서 5건이 줄줄이 떨어졌다.
       ② `CHAR_H * grow / h` 가 함수 시작에서 2980자째인데 창이 2920 이었다. 60자 차이다.
       ③ `classList.add('deco'); }\n  _pkClampWin()` 처럼 **인접**을 요구했는데 사이에
          주석 여덟 줄이 들어왔다. 호출은 멀쩡히 있다.
     셋 다 사람이 주석 한 줄을 더 쓰면 어긋나는 종류다(핸드오프 `handoff-checks-stale.md` §5-①).
   ⇒ 중괄호를 세어 **본문을 통째로** 뗀다. 인자는 세지 않는다. */
const bodyAt = (s, i) => {
  const b = s.indexOf('{', i);
  if (b < 0) return '';
  let d = 0;
  for (let k = b; k < s.length; k++) {
    if (s[k] === '{') d++;
    else if (s[k] === '}' && --d === 0) return s.slice(i, k + 1);
  }
  return s.slice(i);
};
/* 인자 목록을 안 본다 — 인자가 하나 늘어도 같은 함수다. */
const fnBody = (name, s) => {
  const m = new RegExp('function\\s+' + name + '\\s*\\(').exec(s || SRC);
  return m ? bodyAt(s || SRC, m.index) : '';
};
/* idx 를 감싸는 가장 가까운 함수의 본문. 「이 줄 뒤에 그 호출이 있는가」를 인접이 아니라
   **같은 함수 안인가**로 본다. */
const enclosingBody = (s, idx) => {
  const head = s.lastIndexOf('\nfunction ', idx);
  return head < 0 ? '' : bodyAt(s, head + 1);
};

/* 꾸미기 덩이만 잘라 본다 — app.js 다른 곳의 통신을 보고 «있다»고 오판하지 않기 위해서다. */
const DECO = (function(){
  const a = SRC.indexOf('function _pkOpenDeco(');
  const b = SRC.indexOf('function _pkStamp(');
  return (a >= 0 && b > a) ? SRC.slice(a, SRC.indexOf('}', SRC.indexOf('return d.getFullYear', b))) : '';
})();

say('=== 🎨 스티커사진 꾸미기 창 검사 ===');
say('');

/* ── §1. 묶음 ──────────────────────────────────────────────────────── */
say('· §1 묶음 — 같은 설정으로 이어 그으면 한 겹이 되는가');
{
  const S = (t,c,w,hue)=>({t:t, c:c, w:w, p:[[0,0],[10,10]], hue0:hue||0});

  let g = P.strokeGroups([S('outline','#e0567a',7), S('outline','#e0567a',7), S('outline','#e0567a',7)]);
  chk(g.length === 1 && g[0].length === 3,
      '★ 같은 종류·색·굵기로 이어 그은 획 셋이 한 묶음이다 (층이 지던 버그의 고침)');

  g = P.strokeGroups([S('outline','#e0567a',7), S('outline','#4a86c9',7)]);
  chk(g.length === 2, '색이 바뀌면 묶음이 끊긴다 (다른 색 사이에 외곽선이 보이는 게 정상이다)');

  g = P.strokeGroups([S('outline','#e0567a',7), S('outline','#e0567a',12)]);
  chk(g.length === 2, '굵기가 바뀌면 묶음이 끊긴다');

  g = P.strokeGroups([S('outline','#e0567a',7), S('hollow','#e0567a',7)]);
  chk(g.length === 2, '종류가 바뀌면 묶음이 끊긴다');

  g = P.strokeGroups([S('rainbow','#e0567a',7,10), S('rainbow','#e0567a',7,200)]);
  chk(g.length === 2, '★ 무지개는 묶이지 않는다 (획마다 색이 도는 시작점이 다르다 — 겹쳐도 원래 멀쩡했다)');

  g = P.strokeGroups([S('solid','#e0567a',7), S('outline','#e0567a',7), S('solid','#e0567a',7)]);
  chk(g.length === 3, '★ 사이에 다른 획이 끼면 앞뒤가 안 합쳐진다 (그리는 순서가 곧 겹치는 순서다)');

  chk(P.strokeGroups([]).length === 0 && P.strokeGroups(null).length === 0,
      '빈 목록에도 안 터진다 (첫 획 전에도 다시 그리기가 돈다)');
}
say('');

/* ── §2. 순서 ──────────────────────────────────────────────────────── */
say('· §2 순서 — 펜 다섯을 실제로 실행해 그리는 횟수와 합성을 센다');
{
  /* 가짜 2D 컨텍스트. 실제로 그리지는 않고 «무엇을 몇 번 불렀는가»만 적는다.
     ★ 이 검사가 잡으려는 것은 그림이 아니라 **횟수**다. 묶음 하나에 stroke() 가
       획 수만큼 나오면 그게 층이 지는 그 증상이다. */
  function fake(){
    const log = [], st = [];
    const g = {
      lineCap:'', lineJoin:'', lineWidth:0, strokeStyle:'', fillStyle:'',
      shadowColor:'', shadowBlur:0, globalCompositeOperation:'source-over',
      save(){ st.push(1); log.push('save'); },
      restore(){ st.pop(); log.push('restore'); },
      beginPath(){ log.push('begin'); }, moveTo(){}, lineTo(){}, arc(){},
      stroke(){ log.push('stroke:'+g.lineWidth.toFixed(2)+':'+g.strokeStyle+':'+g.globalCompositeOperation); },
      fill(){ log.push('fill:'+g.fillStyle); }
    };
    g._log = log; g._depth = ()=>st.length;
    return g;
  }
  const only = (g,k)=>g._log.filter(x=>x.indexOf(k) === 0);
  const two  = [{t:'x',c:'#e0567a',w:10,p:[[0,0],[10,0]],hue0:0},
                {t:'x',c:'#e0567a',w:10,p:[[20,0],[30,0]],hue0:0}];
  const grp  = t => two.map(s=>Object.assign({}, s, {t:t}));

  /* 기본 — 획이 둘이어도 stroke 는 한 번. 이어붙인 경로 하나를 한 번에 긋는다. */
  let g = fake(); P.penRender(g, grp('solid'), 1);
  chk(only(g,'stroke').length === 1, '★ 기본 펜 — 획 둘을 stroke() 한 번으로 긋는다');

  /* 외곽선 — 바깥선을 먼저 «다» 깔고 몸통을 «다» 얹는다. 획마다 번갈아 하면 층이 진다. */
  g = fake(); P.penRender(g, grp('outline'), 1);
  let s = only(g,'stroke');
  chk(s.length === 2, '★ 외곽선 펜 — 획이 둘이어도 stroke 는 두 번뿐이다 (바깥선 1 + 몸통 1)');
  chk(parseFloat(s[0].split(':')[1]) > parseFloat(s[1].split(':')[1]),
      '★ 바깥선이 몸통보다 굵고 **먼저** 그어진다 (순서가 뒤집히면 몸통이 가려진다)');
  chk(s[0].indexOf(P.outlineInk('#e0567a')) >= 0, '바깥선 색이 outlineInk 가 정한 값이다');
  g = fake(); P.penRender(g, grp('outline').map(x=>Object.assign({},x,{c:'#ffffff'})), 1);
  chk(only(g,'stroke')[0].indexOf('#1a1a1a') >= 0, '흰 펜의 바깥선은 검정이다 (하양 위 하양은 안 보인다)');

  /* 속 빈 — 뚫기는 «합집합에 한 번»이다. 획마다 뚫으면 나중 획이 먼저 획을 잘라먹는다. */
  g = fake(); P.penRender(g, grp('hollow'), 1);
  s = only(g,'stroke');
  chk(s.length === 2, '★ 속 빈 펜 — 몸통 1 + 뚫기 1 (획 수와 무관하다)');
  chk(s.filter(x=>x.indexOf('destination-out') > 0).length === 1,
      '★ destination-out 은 정확히 한 번만 걸린다 (합집합을 한 번에 뚫는다)');
  chk(g.globalCompositeOperation === 'source-over',
      '★ 뚫기 뒤 합성을 원래대로 돌려놓는다 (안 돌리면 다음에 그리는 것이 전부 지우개가 된다)');

  /* 글로우 — 겹친 자리만 두 번 발광하지 않게 묶음 전체를 두 번 긋는다(+ 심지 1). */
  g = fake(); P.penRender(g, grp('glow'), 1);
  chk(only(g,'stroke').length === 3, '★ 글로우 펜 — 발광 2 + 심지 1 (획 수와 무관하다)');

  /* 무지개 — 색이 도는 것이 목적이라 마디마다 긋는다. 대신 묶이지 않는다(§1). */
  g = fake(); P.penRender(g, [{t:'rainbow',c:'#fff',w:10,p:[[0,0],[10,0],[20,0]],hue0:0}], 1);
  chk(only(g,'stroke').length === 2, '무지개 펜 — 마디마다 색을 바꿔 긋는다 (점 3개 = 마디 2개)');
  g = fake(); P.penRender(g, [{t:'rainbow',c:'#fff',w:10,p:[[5,5]],hue0:0}], 1);
  chk(only(g,'fill').length === 1, '무지개로 점 하나를 찍으면 동그라미가 된다 (선이 없어도 자국이 남는다)');

  /* save/restore 짝 — 안 맞으면 다음에 그리는 것들이 앞의 설정을 물려받는다. */
  P.PEN_TYPES.forEach(t=>{
    const f = fake(); P.penRender(f, grp(t.id), 1);
    if(f._depth() !== 0) { chk(false, t.name + ' 펜의 save/restore 짝이 안 맞는다'); }
  });
  chk(true, '다섯 펜 모두 save/restore 짝이 맞는다 (안 맞으면 설정이 다음 획으로 샌다)');

  /* 점 하나짜리 획도 자국이 남아야 한다 — 톡 찍었는데 아무것도 안 생기면 «안 그려진다»가 된다. */
  g = fake(); P.penRender(g, [{t:'solid',c:'#000',w:10,p:[[5,5]],hue0:0}], 1);
  chk(only(g,'stroke').length === 1, '★ 점 하나만 찍어도 자국이 남는다 (아주 짧은 획)');
}
say('');

/* ── §3. 좌표 ──────────────────────────────────────────────────────── */
say('· §3 좌표 — 획은 저장 좌표로만 담고, 배율은 그릴 때 한 번만 곱한다');
{
  function trace(){
    const pts = [];
    return { pts:pts, ctx:{ beginPath(){}, moveTo(x,y){ pts.push([x,y]); }, lineTo(x,y){ pts.push([x,y]); } } };
  }
  const grp = [{t:'solid',c:'#000',w:7,p:[[100,200],[300,400]],hue0:0}];
  const a = trace(); P.penPath(a.ctx, grp, 1);
  const b = trace(); P.penPath(b.ctx, grp, P.DECO_DISP);
  chk(a.pts[0][0] === 100 && a.pts[1][1] === 400, 'k=1 이면 담은 좌표 그대로다 (저장 해상도)');
  chk(Math.abs(b.pts[0][0] - 100*P.DECO_DISP) < 1e-9 && Math.abs(b.pts[1][1] - 400*P.DECO_DISP) < 1e-9,
      '★ k=' + P.DECO_DISP + ' 면 정확히 그 배율만 곱한다 (화면용)');

  const s0 = { w: 7 / P.DECO_DISP };
  chk(Math.abs(s0.w * P.DECO_DISP - 7) < 1e-9,
      '★ 굵기도 좌표와 같은 단위다 (화면에서 고른 7 이 화면에 7 로 보인다)');

  /* 시트 크기 — 화면 배율이 시트 기하와 어긋나면 사진과 획이 따로 논다. */
  const W = Math.round(P.sheetW('p') * P.DECO_DISP), H = Math.round(P.sheetH('p') * P.DECO_DISP);
  chk(W === 360 && H === 480, '세로 시트 화면 크기가 360×480 이다 (시안 v9 의 값)');
  chk(Math.round(P.sheetW('l') * P.DECO_DISP) === 480, '가로 시트는 480 폭이다 — 창이 그만큼 넓어야 한다');
  chk(P.DECO_DISP > 0 && P.DECO_DISP < 1, '화면 배율은 1 미만이다 (저장이 화면보다 크다)');
}
say('');

/* ── §4. 소스 대조 ─────────────────────────────────────────────────── */
say('· §4 소스 — 화면·저장·통신·키의 규약');
{
  chk(DECO.length > 2000, '꾸미기 덩이를 app.js 에서 찾았다');

  /* ① 화면과 저장이 «같은 함수»를 배율만 바꿔 부른다. */
  const paint = /function _pkdPaint\(\)[\s\S]*?\n\}/.exec(SRC);
  const save  = /function _pkdSave\(\)[\s\S]*?\n\}/.exec(SRC);
  chk(!!paint && /strokeGroups\(PKD\.strokes\)\.forEach\(gp=>_pkdBlit\(g, gp, s\.D/.test(paint[0]),
      '화면은 strokeGroups → _pkdBlit 로 그린다');
  chk(!!save && /strokeGroups\(PKD\.strokes\)\.forEach\(gp=>_pkdBlit\(o, gp, 1/.test(save[0]),
      '★ 저장도 **같은 함수**를 배율 1 로 다시 부른다 (화면 그림을 확대하지 않는다)');
  chk(!!save && /out\.width = P\.sheetW\(PK\.orient\); out\.height = P\.sheetH\(PK\.orient\)/.test(save[0]),
      '★ 저장 캔버스는 시트 기하(1200×1600)에서 받는다 (여기서 다시 계산하지 않는다)');
  chk(!!save && /drawImage\(PK\.sheet, 0, 0\)\s*;/.test(save[0]),
      '★ 사진은 이미 저장 해상도인 것을 배율 없이 얹는다 (확대하면 뭉갠다)');
  chk(!/const\s+_?\w*DISP\s*=\s*0\.3/.test(SRC) && /P\.DECO_DISP/.test(DECO),
      '★ 화면 배율을 app.js 가 따로 안 적는다 (계층에서만 온다 — 갈라지면 커서와 선이 어긋난다)');

  /* ② 속 빈 펜만 딴 캔버스. 어느 펜이 그런지는 계층이 안다. */
  const blit = /function _pkdBlit\([\s\S]*?\n\}/.exec(SRC);
  chk(!!blit && /P\.needsScratch\(group\[0\]\.t\)/.test(blit[0]),
      "★ 딴 캔버스가 필요한 펜을 계층에 묻는다 (여기서 'hollow' 를 다시 적지 않는다)");
  chk(!!blit && /drawImage\(sc, 0, 0\)/.test(blit[0]),
      '★ 그 획은 딴 캔버스에 그린 뒤 통째로 얹는다 (시트에 바로 쓰면 사진까지 뚫린다)');

  /* ③ 통신이 없다 — 이 화면은 요금을 하나도 안 쓴다. */
  ['sendPos','sendEvent','setFrameUrl','pkSet(','pkUpdate(','pkUploadFrame','_uploadDataUrlIfNeeded','setCut(']
    .forEach(k => chk(DECO.indexOf(k) < 0, '꾸미기가 ' + k + ' 를 안 쓴다'));
  chk(!/firebaseAPI/.test(DECO),
      '★ 꾸미기 덩이 전체에 firebaseAPI 가 없다 (완성본은 서버에 안 올린다 — RTDB 단가 $5/GB)');
  chk(/a\.download = '스티커사진_/.test(SRC),
      '완성본은 내 컴퓨터로 내려받는다');

  /* ④ 저장 버튼은 하나뿐이다. 촬영이 끝난 자리에 하나 더 두면 어느 게 완성본인지 갈린다. */
  chk((SRC.match(/a\.download = '스티커사진/g) || []).length === 1,
      '★ 내려받기가 코드에 한 군데뿐이다 (둘이면 «어느 게 완성본인가»가 갈린다)');
  chk((HTML.match(/id="pkSaveBtn"/g) || []).length === 1, '저장 버튼이 화면에 하나뿐이다');
  chk(!/pkLockbar[\s\S]{0,300}download/.test(SRC), '촬영 끝난 자리에는 저장 버튼이 없다');

  /* ⑤ 키 — 겹치는 자리가 둘 있다(입력칸 · 캐릭터 만들기 창의 같은 조합). */
  const key = /function _pkdKey\(e\)\{[\s\S]*?\n\}/.exec(SRC);
  chk(!!key && /_pkTyping\(\)\) return/.test(key[0]),
      '★ 입력칸에 포커스가 있으면 Ctrl+Z 를 안 가져간다 (대화창이 같이 떠 있는 게 기본이다)');
  chk(!!key && /stopImmediatePropagation/.test(key[0]),
      '★ Ctrl+Z 를 여기서 멈춘다 (흘려보내면 캐릭터 만들기 창의 되돌리기가 같이 돈다)');
  chk(!!key && /e\.shiftKey \? _pkdRedo\(\) : _pkdUndo\(\)/.test(key[0]) && /'y'/.test(key[0]),
      'Ctrl+Shift+Z 와 Ctrl+Y 둘 다 앞으로 간다');
  chk(/window\.addEventListener\('keydown', _pkdKey, true\)/.test(SRC) &&
      /window\.removeEventListener\('keydown', _pkdKey, true\)/.test(SRC),
      '★ 키를 창이 열릴 때 걸고 닫을 때 뗀다 (안 떼면 닫힌 뒤에도 Ctrl+Z 를 먹는다)');

  /* ⑥ 되돌리기 — 상태를 통째로 찍고, 손을 뗀 순간에만 쌓는다. */
  const snap = /function _pkdSnapshot\(\)[\s\S]*?\n\}/.exec(SRC);
  chk(!!snap && /st: PKD\.strokes/.test(snap[0]) && /sk:/.test(snap[0]),
      '★ 획과 스티커를 **한 상태로** 찍는다 (따로 쌓으면 지운 순서가 엉킨다)');
  chk(/PKD\.hist\.length > P\.HIST_MAX/.test(SRC),
      '되돌리기 칸 수를 계층에서 받는다 (' + P.HIST_MAX + '칸)');
  chk(/_pkdPaint\(\); _pkdPenPreview\(\);[\s\S]{0,120}_pkdCommit\(\)/.test(SRC),
      '★ 빈 상태를 첫 칸으로 쌓는다 (없으면 첫 획을 Ctrl+Z 로 못 지운다)');
  chk(/pointerup[\s\S]{0,60}mode === 'move'\) _pkdCommit/.test(SRC),
      "★ 스티커는 **손을 뗀 순간**에만 쌓는다 (끄는 중에 쌓으면 Ctrl+Z 를 스무 번 눌러야 한다)");

  /* ⑦ 스티커가 시트 밖으로 못 나간다 — 나가면 화면에는 있는데 저장한 그림에는 없다. */
  chk(/clampC = \(x,y\)=>\[Math\.max\(0, Math\.min\(cv\.width/.test(SRC),
      '★ 스티커를 시트 안으로 가둔다 (밖으로 나가면 저장한 그림에서만 사라진다)');
  chk(/_pkP\(\)\.stkClamp\(/.test(SRC), '스티커 배율 한계를 계층에서 받는다');

  /* ⑧ 넘어가는 길과 닫는 길. */
  chk(/if\(!PK\.sheet\)\{[\s\S]{0,200}return;/.test(SRC),
      '★ 시트를 못 만들었으면 꾸미기로 안 넘어간다 (빈 시트에 스티커만 붙이게 된다)');
  chk(/_pkOpenDeco\(\);/.test(SRC) && /function _pkFinish[\s\S]{0,1400}_pkOpenDeco\(\)/.test(SRC),
      '촬영이 끝나면 꾸미기가 열린다');
  chk(/function _pkOpenDeco\(\)[\s\S]{0,400}_pkDisposeStage\(\)/.test(SRC),
      '★ 꾸미기로 넘어갈 때 무대를 버린다 (돌아갈 길이 없고 WebGL 컨텍스트가 남는다)');
  chk(/PK\.state === 'deco' && _pkdDirty\(\)/.test(SRC),
      '★ 저장 안 한 꾸미기를 닫을 때 한 번 되묻는다 (서버에 아무것도 안 남는다)');
  chk(!/\bconfirm\(/.test(DECO),
      '★ 되묻기에 브라우저 확인창을 안 쓴다 (Electron 에서 포커스가 멈춘다 — audit 검사 4)');
  chk(/_pkCloseDeco\(\);/.test(SRC) && /function closePurikura[\s\S]{0,900}_pkCloseDeep|function closePurikura[\s\S]{0,900}_pkCloseDeco\(\)/.test(SRC),
      '창을 닫을 때 꾸미기 상태를 정리한다');
  chk(/PK\.sheet = null; window\._pkSheet = null/.test(SRC),
      '★ 닫을 때 시트를 놓아준다 (1200×1600 캔버스가 창을 닫아도 남아 있으면 안 된다)');

  /* ⑨ HTML — 세 화면이 서로 배타이고, 꾸미기일 때만 창이 넓어진다. */
  chk(/#pkOverlay\.deco #pkLobby,#pkOverlay\.deco #pkStageWrap\{display:none/.test(HTML),
      '★ 꾸미기일 때 로비와 무대가 함께 숨는다 (하나만 숨기면 두 화면이 겹친다)');
  chk(/#pkOverlay\.deco #pkWin\{width:840px/.test(HTML),
      '★ 꾸미기일 때만 창이 840px 이다 (가로 시트 480px 이 600px 창에는 안 들어간다)');
  chk(/@media\(max-width:880px\)\{\.pk-edit\{grid-template-columns:1fr/.test(HTML),
      '창이 좁으면 옆줄이 아래로 내려간다 (시트가 잘리느니 낫다)');
  chk(HTML.indexOf('id="pkSheet"') < HTML.indexOf('id="pkModeBadge"'),
      '배지가 시트보다 뒤다 (앞이면 시트에 덮인다)');
  chk(/#pkSheetHost\.penmode \.pk-stk\{pointer-events:none/.test(HTML),
      '★ 그리는 동안 스티커가 클릭을 안 받는다 (안 그러면 선 대신 스티커가 끌려간다)');
  chk(/#pkSheetWrap\{[^}]*repeating-conic-gradient/.test(HTML),
      '시트 뒤가 체크무늬다 («투명» 프레임이 정말 뚫렸는지 여기서 보인다)');
  ['pkDeco','pkSheet','pkSheetHost','pkModeBadge','pkPalette','pkPenTypes','pkPenColors',
   'pkPenPreview','pkThick','pkThickVal','pkToolPen','pkToolMove',
   'pkUndoBtn','pkRedoBtn','pkClearBtn','pkSaveBtn'].forEach(id=>{
    if(HTML.indexOf('id="'+id+'"') < 0) chk(false, '#'+id+' 이 HTML 에 없다');
  });
  chk(true, '꾸미기가 쓰는 id 열여섯이 HTML 에 다 있다');

  /* ⑩ 스티커는 마크업이 아니라 textContent 로 넣는다 — 사용자 값이 아니어도 관례를 지킨다. */
  chk(/el\.querySelector\('\.pk-gl'\)\.textContent = ch/.test(SRC),
      '스티커 글리프를 textContent 로 넣는다 (마크업 보간을 안 늘린다)');
}
say('');

/* ── §5. 회사원 모드 ───────────────────────────────────────────────── */
say('· §5 회사원 모드 — 못 열고, 열려 있던 것도 접히는가');
{
  /* 🏢 게이트가 한 겹이면 반드시 샌다. 버튼은 «누른 사람에게 알리는» 자리이고,
     openPurikura 는 «어떤 경로로 들어와도 걸리는» 자리다. 둘은 역할이 다르다. */
  const btn = /const cam=document\.getElementById\('chatPhotoBtn'\);[\s\S]*?\n  \};/.exec(SRC);
  chk(!!btn && /if\(officeMode\)\{ toast\('🏢 회사원 모드에서는 쓸 수 없어요'\); return; \}/.test(btn[0]),
      '★ 📷 버튼이 회사원 모드에서 안내하고 멈춘다 (💣 와 같은 문구·같은 방식)');
  chk(!!btn && btn[0].indexOf('officeMode') < btn[0].indexOf('_purikura()'),
      '★ 게이트가 세션을 만들기 **전**이다 (뒤면 자리를 잡아 놓고 막는 꼴이 된다)');

  const open = /async function openPurikura\(\)\{[\s\S]*?_pkBuildStage\(\);/.exec(SRC);
  chk(!!open && /officeMode\)\{ toast\('🏢 회사원 모드에서는 쓸 수 없어요'\); return; \}/.test(open[0]),
      '★ openPurikura 안에도 그물이 있다 (문은 여기 하나뿐 — 다른 입구가 생겨도 샌다)');
  chk(!!open && /typeof officeMode !== 'undefined'/.test(open[0]),
      "officeMode 가 아직 없을 때도 안 터진다 (부팅 순서에 안 기댄다)");

  /* 버튼을 숨기지는 않는다 — 숨기면 이런 기능이 있다는 것 자체를 모르고 지나간다. */
  chk(!/chatPhotoBtn[\s\S]{0,200}style\.display\s*=/.test(SRC),
      '버튼을 숨기지 않는다 (숨기면 모드를 껐을 때 갑자기 생기는 것도 고장으로 읽힌다)');

  /* 켜는 순간 이미 열려 있던 창 — 못 열게만 막으면 모드의 목적이 통째로 무너진다. */
  const tog = /officeMode = !officeMode;[\s\S]*?refreshOfficeChipUI\(\);/.exec(SRC);
  chk(!!tog && /PK\.open/.test(tog[0]) && /closePurikura\(true\)/.test(tog[0]),
      '★ 모드를 켜면 떠 있던 📷 창을 접는다 (force — 되묻지 않는다)');
  chk(!!tog && /PK\.state === 'shooting'/.test(tog[0]) && tog[0].indexOf("'shooting'") < tog[0].indexOf('closePurikura(true)'),
      '★ 촬영 중에는 안 닫는다 (방장이 빠지면 남은 사람이 창을 닫지도 못하는 상태로 굳는다)');
  chk(!!tog && /_offNote/.test(tog[0]) && /'회사원 모드가 꺼졌어요'\) \+ _offNote\)/.test(SRC),
      '안내를 한 줄로 합친다 (toast 는 마지막 것만 남아서 따로 띄우면 안 보인다)');
  chk(!!tog && /catch\(_\)\{\}/.test(tog[0]),
      '창 정리가 실패해도 모드 자체는 켜진다 (여기서 터지면 모드가 안 켜진다)');
}
say('');

/* ── §6. 실기기 제보 넷 ────────────────────────────────────────────
   ★ 넷 다 «코드만 봐서는 안 보이고, 실기기에서만 보인» 것들이다. 다시 나지 않게 못 박는다. */
say('· §6 실기기에서 잡은 것 — 창 옮기기 · 프레임 미리보기 · 캐릭터 · 옆줄 폭');
{
  /* ① 창 옮기기. 앞으로 나오기(_WIN_Z_LAYERS)와 ⎋(escRegisterWindow)는 이미 있었다 —
     빠져 있던 것은 드래그뿐이다. */
  chk(/function _pkBindWinDrag\(\)/.test(SRC) && /_pkBindWinDrag\(\);/.test(SRC),
      '★ 타이틀바를 잡아 창을 옮길 수 있다');
  chk(/e\.target\.closest\('#pkCloseBtn'\)\) return;/.test(SRC),
      '★ 닫기 버튼은 드래그를 시작하지 않는다 (안 빼면 누를 때마다 창이 끌린다)');
  chk(/function _pkClampWin\(\)/.test(SRC) &&
      /addEventListener\('resize', \(\)=>\{ if\(PK\.open\) _pkClampWin\(\)/.test(SRC),
      '★ 화면 밖으로 나간 창을 데려온다 (창 크기가 바뀌면 «창이 사라졌다»가 된다)');
  {
    /* 인접(`}\n  _pkClampWin()`)을 요구하면 사이에 주석 한 줄만 들어와도 어긋난다 —
       실제로 그렇게 빨개졌다. 「꾸미기를 켠 그 함수가 다시 가두는가」로 본다. */
    const iDeco = SRC.indexOf("classList.add('deco')");
    const decoFn = iDeco < 0 ? '' : enclosingBody(SRC, iDeco);
    chk(!!decoFn && /_pkClampWin\(\)/.test(decoFn),
        '★ 꾸미기로 넓어질 때 다시 가둔다 (600 → 840px 라 오른쪽이 화면 밖으로 나간다)');
  }
  chk(!/localStorage[\s\S]{0,80}_pkWinPos|_lsSet\([^)]*pkWin/.test(SRC),
      '창 위치를 저장하지 않는다 (세션 동안만 — 폭이 두 가지라 옛 위치가 어긋난다)');
  chk(/escRegisterWindow\(\{[\s\S]{0,200}key:'purikura'/.test(SRC) &&
      /_WIN_Z_LAYERS\s*=\s*\[[^\]]*'pkOverlay'/.test(SRC),
      '⎋ 와 «누르면 앞으로»는 이미 사다리에 태워져 있다');

  /* ② 기본 프레임 미리보기 — 이름만 있으면 눌러 봐야 안다. */
  const bas = /function _pkPaintBasics\(\)[\s\S]*?\n\}/.exec(SRC);
  chk(!!bas && /cellRects\(PK\.orient, PK\.cuts, k\)/.test(bas[0]),
      '★ 미리보기가 «지금 고른 방향·컷 수» 그대로 그린다');
  chk(!!bas && /_pkFillGutter\(g, pw, ph, rects, PK_BASICS\[key\]\.ink\)/.test(bas[0]),
      '투명·하양·검정이 여백에 어떻게 나오는지 그려서 보여준다');
  chk(/function _pkFillGutter\(/.test(SRC) &&
      (SRC.match(/_pkFillGutter\(/g) || []).length === 3,
      '★ 여백 판을 그리는 자리가 하나다 (미리보기와 시트 합성이 같은 함수 — 갈라지면 결과가 다르다)');
  chk(/\.pk-fpv\{[^}]*repeating-conic-gradient/.test(HTML),
      '미리보기 뒤가 체크무늬다 («투명»이 진짜 뚫렸는지 여기서 보인다)');

  /* ③ 캐릭터가 안 보이던 것 — 연출이 키·발바닥 보정을 매 프레임 지웠다. */
  chk(/const pose = new THREE\.Group\(\); pose\.add\(g\);/.test(SRC) &&
      /holder\.add\(pose\)/.test(SRC),
      '★ 연출 전용 겹이 따로 있다 (holder > pose > g)');
  chk(/inner:pose/.test(SRC) && !/inner:g\b/.test(SRC),
      '★ 연출은 그 겹에만 건다 (g 에 직접 걸면 키·발바닥 보정이 첫 프레임에 날아간다)');
  const posefn = /function _pkPoseChar\(c\)\{[\s\S]*?\n\}/.exec(SRC);
  chk(!!posefn && /inner\.scale\.setScalar\(1\)/.test(posefn[0]),
      '연출은 항등 상태에서 시작한다 (겹이 있으므로 scale 을 1 로 두는 것이 맞다)');
  chk(!!posefn && !/g\.scale|g\.position\.y/.test(posefn[0]),
      '★ 연출이 보정 겹(g)의 크기·높이를 안 건드린다 — 건드리면 화면이 하얗게 빈다');
  /* 🐾 동물만 배율을 하나 더 곱한다(계층의 ANIMAL_H) — 나머지는 그대로 1.7 이다. */
  chk(/CHAR_H \* grow \/ h/.test(fnBody('_pkCloneChar')),
      '키를 1.7 로 맞추는 계산은 그대로다 (동물만 배율이 한 번 더 곱해진다)');
  chk(/charDef && seat\.charDef\.animal\) \? _pkP\(\)\.ANIMAL_H : 1/.test(SRC),
      '🐾 동물 여부는 charDef.animal 로 본다 (실행 화면과 같은 표시를 쓴다)');

  /* ④ 옆줄 버튼 폭 — 같은 특이도 규칙이 뒤에 와서 이겼다. */
  chk(/\.pk-side \.pk-palette button\{/.test(HTML) &&
      /\.pk-side \.pk-penrow button\{/.test(HTML) &&
      /\.pk-side \.pk-tools button\{/.test(HTML),
      '★ 팔레트·펜·도구 버튼 규칙이 `.pk-side` 로 특이도를 올렸다 (안 올리면 뒤 규칙이 이긴다)');
  chk(/\.pk-side \.pk-palette button\{[^}]*min-width:0/.test(HTML),
      '★ 칸이 내용보다 좁아질 수 있다 (min-width 를 안 풀면 여섯 칸이 250px 을 넘겨 스크롤이 생긴다)');
  chk(/\.pk-palette\{[^}]*repeat\(6,1fr\)/.test(HTML),
      '스티커는 여섯 칸이다 (250px ÷ 6 ≈ 37px — 한 화면에 들어온다)');
}
say('');

/* ── §7. 실기기 2차 ────────────────────────────────────────────────── */
say('· §7 실기기 2차 — 모드 자동 전환 · 펜 이름 · 프레임 미리보기 높이');
{
  /* ① 모드는 «누른 것»으로 정해진다. 버튼을 따로 누를 필요가 없다. */
  const build = /function _pkdBuildUI\(\)\{[\s\S]*?\n\}\nfunction _pkdSetPen/.exec(SRC);
  chk(!!build, '옆줄 만드는 덩이를 찾았다');
  chk(!!build && /_pkdPenPreview\(\); _pkdSetPen\(true\);\s*\/\/ 펜을 고른 것/.test(build[0]),
      '★ 펜 종류를 고르면 ✏️ 그리기로 바뀐다');
  chk(!!build && (build[0].match(/_pkdSetPen\(true\)/g) || []).length === 3,
      '★ 종류·색·굵기 셋 다 그리기로 바꾼다 (하나만 빠져도 «어떤 건 되고 어떤 건 안 된다»가 된다)');
  chk(!!build && /스티커를 누른 것 = 붙이고 옮기겠다는 뜻이다[\s\S]{0,120}_pkdSetPen\(false\)/.test(build[0]),
      '★ 스티커를 누르면 ✋ 옮기기로 바뀐다 (그리는 중이었으면 그리기가 꺼진다)');
  chk(/if\(PKD\.penOn\) _pkdSelect\(null\)/.test(SRC),
      '그리기로 바뀌면 골라 둔 스티커를 놓는다 (손잡이만 남아 떠 있으면 «안 지워진다»가 된다)');
  chk(/tp\.classList\.toggle\('on', PKD\.penOn\)/.test(SRC) && /pkToolPen/.test(HTML),
      '두 버튼은 남는다 — 지금 어느 모드인지 보여주고 손으로 되돌리는 길이다');

  /* ② 펜 이름이 세로로 접히지 않는다. */
  chk(/\.pk-side \.pk-penrow button\{[^}]*white-space:nowrap/.test(HTML),
      '★ 펜 이름이 가로로 한 줄이다 («기/본»으로 접히지 않는다)');
  chk(/\.pk-penrow\{[^}]*repeat\(5,1fr\)/.test(HTML),
      '펜 다섯이 한 줄에 들어간다 (250px ÷ 5 ≈ 47px)');

  /* ③ 프레임 미리보기 높이 — 컷 수만 바꿨는데 로비가 네 배로 길어지던 것. */
  const up = /function _pkPaintUp\(\)[\s\S]*?\n\}/.exec(SRC);
  chk(!!up && /THUMB_H_MAX/.test(up[0]) && /thumbMaxW = Math\.round\(THUMB_H_MAX \* W \/ H\)/.test(up[0]),
      '★ 미리보기 높이에 상한이 있다 (세로 1컷은 그냥 두면 780px 이 된다)');
  chk(!!up && /th\.style\.maxWidth = thumbMaxW/.test(up[0]) && /aspectRatio/.test(up[0]),
      '★ 높이를 직접 안 잡고 폭으로 묶는다 (둘 다 잡으면 비율이 깨진다)');
  chk(/\.pk-upcell \.pk-thumb\{[^}]*margin:0 auto/.test(HTML),
      '좁아진 미리보기가 칸 가운데에 온다');
  chk(!!up && /frameSpec\(PK\.orient, PK\.cuts\)/.test(up[0]) && !/THUMB_H_MAX[\s\S]{0,200}spec\.textContent/.test(up[0]),
      '★ 올릴 파일 규격은 안 건드렸다 (미리보기 크기와 규격은 다른 값이다)');

  /* 실제로 재 본다 — 컷 수를 바꿔도 미리보기 높이가 비슷해야 한다. */
  const CAP = 170, BODY = 574, PAD = 16, GAP = 7;
  const hs = [];
  ['p','l'].forEach(o=>P.cutsFor(o).forEach(n=>{
    const s = P.frameSpec(o,n);
    const cell = Math.round((BODY - (Math.min(n,4)-1)*GAP) / Math.min(n,4)) - PAD;
    const w = Math.min(Math.round(CAP*s[0]/s[1]), cell);
    hs.push([o, n, Math.round(w*s[1]/s[0])]);
  }));
  hs.forEach(([o,n,h])=>{
    if(h > CAP + 2) chk(false, (o==='p'?'세로':'가로')+n+'컷 미리보기가 '+h+'px 로 상한을 넘는다');
  });
  chk(true, '여섯 조합 모두 미리보기 높이가 ' + CAP + 'px 이하다');
  const p1 = hs.find(x=>x[0]==='p'&&x[1]===1)[2], p4 = hs.find(x=>x[0]==='p'&&x[1]===4)[2];
  chk(Math.abs(p1-p4) <= 20,
      '★ 세로 1컷(' + p1 + 'px)과 4컷(' + p4 + 'px)의 미리보기 높이가 비슷하다 — 컷 수를 바꿔도 로비가 안 늘어난다');
}
say('');

/* ── §8. 캐릭터 복제 ───────────────────────────────────────────────── */
say('· §8 복제 — userData 의 순환 구조에 걸려 넘어지지 않는가');
{
  /* THREE 의 Object3D.copy 가 하는 그 동작을 그대로 재현한다.
     장착 파츠 래퍼의 userData 에는 AnimationMixer 가 들어 있고, mixer._actions[0]._mixer 가
     자기 자신으로 돌아온다 — 그래서 복제가 통째로 던지고 무대가 하얗게 빈다. */
  const mixer = { _actions: [] };
  mixer._actions.push({ _mixer: mixer });          // ← 여기서 원이 닫힌다
  const node = { userData: { itemMixer: mixer, holder: {} }, children: [] };

  let threw = false;
  try{ JSON.parse(JSON.stringify(node.userData)); }catch(_){ threw = true; }
  chk(threw, '★ 순환이 있는 userData 는 JSON 복사에서 던진다 (THREE 가 복제할 때 하는 일이다)');

  const keep = node.userData; node.userData = {};
  let ok = true;
  try{ JSON.parse(JSON.stringify(node.userData)); }catch(_){ ok = false; }
  node.userData = keep;
  chk(ok, '비워 두면 안 던진다 — 그래서 복제 직전에 떼어놓는다');
  chk(node.userData === keep, '★ 되돌리면 원본이 그대로다 (안 되돌리면 실행 화면 파츠가 애니메이션을 잃는다)');

  /* 소스 쪽 — 떼어놓기·되돌리기가 실제로 그 모양인지 본다. */
  const clBody = fnBody('_pkCloneChar');
  const cl = clBody ? [clBody] : null;
  chk(!!cl, '_pkCloneChar 를 찾았다');
  chk(!!cl && /const stash = \[\];/.test(cl[0]) && /o\.userData = \{\};/.test(cl[0]),
      '★ 복제 직전에 userData 를 떼어놓는다');
  chk(!!cl && /finally\{ stash\.forEach\(p=>\{ p\[0\]\.userData = p\[1\]; \}\); \}/.test(cl[0]),
      '★ 되돌리기가 **finally** 에 있다 (catch 에 두면 복제가 성공한 경우에 안 돌아온다)');
  chk(!!cl && /catch\(e\)\{[^}]*g = null; \}/.test(cl[0]),
      '★ 복제가 실패하면 던지지 않고 g 를 null 로 둔다 (그래야 finally 가 원본을 되돌린다)');
  chk(!!cl && !/stash[\s\S]{0,200}g\.traverse/.test(cl[0]) && !/userData = p\[1\][\s\S]{0,400}복제본/.test(cl[0]),
      '복제본의 userData 는 빈 채로 둔다 (옮겨 담으면 거기서도 같은 순환이 생긴다)');
  chk(/if\(!g\) return null;/.test(SRC),
      '복제를 못 했으면 그 사람만 빠진다 (나머지는 그대로 선다)');

  /* ── 자세 — 자던 채로 찍히지 않게 ── */
  const np = /function _pkNeutralPose\(seat\)\{[\s\S]*?\n\}/.exec(SRC);
  chk(!!np, '_pkNeutralPose 를 찾았다');
  chk(!!cl && cl[0].indexOf('_pkNeutralPose(seat);') >= 0 &&
      cl[0].indexOf('_pkNeutralPose(seat);') < cl[0].indexOf('SkeletonUtils.clone(src)'),
      '★ 복제 **전에** 자세를 맞춘다 (복제는 그 순간의 뼈 각도를 그대로 가져온다)');
  chk(!!np && /seat\.faceMapOrig/.test(np[0]) && /setFaceMap/.test(np[0]),
      '★ 감긴 눈을 뜬다 (sleep·pet·dizzy 는 얼굴 «텍스처»를 바꿔 둔다 — 뼈가 아니다)');
  chk(!!np && /seat\.mixer/.test(np[0]) && /seat\.actions && seat\.actions\.idle/.test(np[0]),
      '클립이 있는 캐릭터는 idle 클립으로 갈아탄 결과를 쓴다');
  chk(!!np && /seat\.current = null;/.test(np[0]),
      '★ seat.current 를 비워 다음 프레임이 원래 상태로 되돌리게 한다');
  chk(!!np && /seat\.pose = Object\.assign\(\{\}, targetFor\('idle'\)\)/.test(np[0]) &&
      /animateRig\(seat, performance\.now\(\), 'shaking'\)/.test(np[0]) &&
      /seat\.pose = keep;/.test(np[0]),
      '★ 자세값은 idle 인데 상태만 shaking 이다 — 그 차이가 «팔을 늘어뜨린다» 하나뿐이다');
  chk(!!np && !/finally/.test(np[0]),
      '되돌리기가 없다 — 실행 화면의 frame() 이 다음 프레임에 다시 칠하므로 저절로 낫는다');
}
say('');

/* ── §9. 점프 ──────────────────────────────────────────────────────── */
say('· §9 점프 — 프레임 수와 무관한가, 얼마나 빠른가');
{
  const v0 = (/const PK_JUMP_V0\s*=\s*([\d.]+)/.exec(SRC) || [])[1];
  const gr = (/const PK_GRAVITY\s*=\s*([\d.]+)/.exec(SRC) || [])[1];
  chk(!!v0 && !!gr, '점프 초속·중력이 상수로 나와 있다 (' + v0 + ' · ' + gr + ')');

  /* ★ 2026-08: 높이를 «뛴 뒤 흐른 시간»에서 바로 낸다. 속도를 프레임마다 더해 가지 않는다.
     [왜] 더해 가면(오일러 적분) 프레임이 성길수록 정점이 낮아진다. 중력을 4배로 올려
       점프를 두 배 빠르게 만든 뒤로는 20fps(비포커스 절전)에서 12% 낮게 뛰었다 —
       「어떤 컴퓨터에서는 덜 뛴다」가 되는 자리다. 시각에서 내면 프레임 수와 무관하게 같다. */
  chk(/c\.jy = v0\*jt - 0\.5\*PK_GRAVITY\*jt\*jt;/.test(SRC),
      '★ 높이를 시각에서 바로 낸다 (프레임마다 더해 가지 않는다)');
  /* 🐾 동물은 절반 높이로 뛴다. 초속을 정하는 자리가 **하나**여야 한다 —
     내 점프와 남의 점프가 다른 값을 쓰면 같은 점프가 사람마다 다른 높이로 보인다. */
  chk(/function _pkJumpV0\(c\)\{[\s\S]{0,300}Math\.sqrt\(_pkP\(\)\.ANIMAL_JUMP\)/.test(SRC),
      '🐾 동물 점프 초속이 계층의 비율에서 나온다 (√ 를 곱한다 — 높이는 초속의 제곱이다)');
  chk((SRC.match(/_pkJumpV0\(c\)/g) || []).length === 2,
      '★ 초속을 정하는 자리가 하나다 (내 점프와 남의 점프가 같은 함수를 지난다)');
  chk(P.ANIMAL_JUMP === 0.5, '동물 점프가 사람의 절반 높이다');
  const av0 = (+v0) * Math.sqrt(P.ANIMAL_JUMP);
  say('    · 동물 — 초속 ' + av0.toFixed(2) + ' · 높이 ' + (av0*av0/(2*(+gr))).toFixed(2) +
      ' · 체공 ' + (2*av0/(+gr)).toFixed(2) + '초');
  chk(Math.abs((av0*av0/(2*(+gr))) / ((+v0)*(+v0)/(2*(+gr))) - 0.5) < 0.01,
      '★ 실제로 굴려도 높이가 정확히 절반이다');
  /* 낮게 뛰는 만큼 화면에도 더 남는다 — 동물은 정점에서 머리가 화면 안이어야 한다. */
  chk(P.projY('p',4,P.CHAR_H*P.ANIMAL_H*0.80 + (av0*av0/(2*(+gr))), P.CAM_FAR) <
      P.projY('p',4,P.CHAR_H*P.ANIMAL_H*0.80, P.CAM_FAR),
      '(당연) 뛰면 머리가 위로 간다');
  chk(!/c\.vy/.test(SRC),
      '★ 속도를 들고 있지 않다 — 점프 상태는 «언제 눌렀는가»(jt) 하나뿐이다');
  chk(!/c\.jy \+= c\.vy;/.test(SRC) && !/vy = 0\.115/.test(SRC),
      '★ 옛 프레임 단위 계산이 남아 있지 않다');
  chk((SRC.match(/\.jt = performance\.now\(\)/g) || []).length === 2,
      '★ 내 점프와 남의 점프가 같은 길로 시작한다 (다르면 사람마다 다른 높이로 찍힌다)');

  /* 실제로 굴려 본다 — 프레임 수가 달라도 높이가 같아야 한다. */
  function run(fps){
    const step = 1000/fps; let hi = 0, air = 0;
    for(let t=0; t<4000; t+=step){
      const jt = t/1000, jy = (+v0)*jt - 0.5*(+gr)*jt*jt;
      if(jy <= 0 && t > 0){ air = t/1000; break; }
      hi = Math.max(hi, jy);
    }
    return { hi:hi, air:air };
  }
  const a = run(60), b = run(20);
  chk(Math.abs(a.hi-b.hi)/a.hi < 0.02,
      '★ 60fps(' + a.hi.toFixed(2) + ')와 20fps(' + b.hi.toFixed(2) +
      ') 점프 높이가 같다 — 절전 모드에서도 똑같이 뛴다');
  chk(a.hi > 0.5, '점프가 눈에 보인다 (' + a.hi.toFixed(2) + ' = 키 1.7 의 ' + Math.round(a.hi/1.7*100) + '%)');

  /* ★ 빠르기 — «슬로모션 같다»는 제보로 두 배 빠르게 한 자리다.
     높이와 빠르기는 따로 정해진다: 중력을 k 배 · 초속을 √k 배로 하면 같은 높이에 k 배 빠르다.
     이 두 줄이 그 관계를 매번 다시 센다 — 한쪽만 만지면 여기가 먼저 깨진다. */
  const air = 2*(+v0)/(+gr);
  say('    · 체공 ' + air.toFixed(2) + '초 · 높이 ' + a.hi.toFixed(2) + ' (예전 1.00초 · 1.18)');
  chk(air > 0.40 && air < 0.70,
      '★ 체공이 0.40~0.70초다 (' + air.toFixed(2) + ') — 예전의 절반. 더 짧으면 뛴 것이 안 보인다');
  chk(Math.abs((+gr)/9.8 - 4) < 0.05,
      '중력이 9.8 의 4배다 (같은 높이에 두 배 빠르게 하는 짝)');
  chk(Math.abs(a.hi - 1.40) < 0.03,
      '★ 높이는 1.40 그대로다 (' + a.hi.toFixed(2) + ') — 빠르게 하면서 높이를 잃지 않았다');

  /* ★ 화면에 무엇이 남는가는 이제 **카메라 각**이 정한다(각 16°). 계층의 projY 하나로 잰다 —
     화면·검사기가 각각 계산하면 각을 바꿨을 때 한쪽만 고쳐진다. */
  const yBase = P.projY('p', 4, P.CHAR_H + a.hi, 4.2);
  const yFar  = P.projY('p', 4, P.CHAR_H + a.hi, P.CAM_FAR);
  say('    · 정점의 머리끝 — 기본 거리 ' + yBase.toFixed(0) + 'px · 가장 멀리 ' + yFar.toFixed(0) + 'px (0 보다 작으면 화면 밖)');
  /* ⚠️ 지금은 **어느 거리에서도 정점의 머리가 화면 밖**이다. 각 16° 를 고르면서 정해진 것이지
     고장이 아니다 — 16° 에서는 점프 높이를 0.2 까지 낮춰야 들어온다(그건 뛴 티가 안 난다).
     되돌리려면 카메라 각부터 다시 정할 것(purikura-design-camera-v2-3d.html). */
  chk(yBase < 0 && yFar < 0,
      '★ 정점의 머리는 화면 밖이다 — 각 16° 를 고르면서 «정해진 것»이다 (고장이 아니다)');
  /* ⚠️⚠️ 몸통도 안 남는다. 가장 멀리 물러나도 정점에서 어깨가 화면 밖이라
     **점프 사진에는 다리만 찍힌다.** 이건 각 16° 와 높이 1.40 을 «함께» 고른 결과이지,
     둘 중 하나만 보고는 안 보이던 것이다.
     → 되돌리는 길은 둘뿐이다: 점프 높이를 0.55 이하로 낮추거나, 카메라 각을 줄이거나.
       아래 줄이 그 «되돌릴 값»을 못 박아 둔다 — 카메라를 다시 만지면 여기가 같이 움직인다. */
  const shoulder = P.projY('p', 4, P.CHAR_H*0.80 + a.hi, P.CAM_FAR);
  say('    · 정점의 어깨 — 가장 멀리에서 ' + shoulder.toFixed(0) + 'px' +
      (shoulder < 0 ? '  ⚠️ 화면 밖 — 점프 사진에는 다리만 남는다' : ''));
  const SAFE_H = 0.30;   // ⚠️ 렌즈를 1.55 로 낮추면서 이 값도 0.55 → 0.30 으로 내려갔다
  chk(P.projY('p', 4, P.CHAR_H*0.80 + SAFE_H, P.CAM_FAR) > 0,
      '★ 점프 높이를 ' + SAFE_H + ' 로 낮추면 정점에도 어깨가 남는다 — 되돌릴 때 쓸 값이다');
}
say('');

/* ── §10. 조작 ─────────────────────────────────────────────────────── */
say('· §10 조작 — WASD 와 마우스 시선');
{
  /* ① WASD. 화살표와 «같은 자리»로 접어야 한다 — 두 갈래로 두면 한쪽만 고쳐진다. */
  const map = /const _PK_MOVE_KEY = \{[\s\S]*?\};/.exec(SRC);
  chk(!!map, '방향키 표를 찾았다');
  ['a','d','w','s','A','D','W','S','ArrowLeft','ArrowRight','ArrowUp','ArrowDown']
    .forEach(k=>{ if(!map || map[0].indexOf(k+':') < 0) chk(false, k + ' 가 방향키 표에 없다'); });
  chk(true, '★ 화살표와 WASD(대소문자)가 같은 표에 들어 있다');
  chk(!!map && /'ㅁ':'L'/.test(map[0]) && /'ㅈ':'U'/.test(map[0]),
      '★ 한글 자판에서도 먹는다 (한글 상태면 e.key 가 ㅁㄴㅇㄹ 로 온다 — 안 넣으면 «나만 안 된다»가 된다)');
  chk(/if\(PK\.keys\.L\)/.test(SRC) && /if\(PK\.keys\.U\)/.test(SRC) &&
      !/PK\.keys\.ArrowLeft/.test(SRC),
      '★ 이동은 방향 하나(L·R·U·D)만 본다 (키 이름을 그대로 두면 WASD 가 새 갈래가 된다)');
  const up = /function _pkKeyUp\(e\)\{[\s\S]*?\n\}/.exec(SRC);
  chk(!!up && /for\(const k in _PK_MOVE_KEY\)/.test(up[0]),
      '★ 뗄 때 같은 방향의 짝을 통째로 지운다 (Shift 로 대소문자가 갈리면 눌린 채 남아 혼자 걸어간다)');
  chk(/_pkTyping\(\)\) return/.test(SRC),
      '입력칸에 포커스가 있으면 WASD 를 안 가져간다 (대화창에 글자를 못 치게 된다)');
  chk(/A D<\/b> 좌우|<b>A D<\/b>/.test(HTML) && /<b>W<\/b>/.test(HTML),
      '무대 아래 안내에 WASD 가 적혀 있다');

  /* ② 시선 — 머리 «본»만, 무대 «안»에서만, 그리고 요금은 그대로. */
  const aim = /function _pkAimGaze\(c\)\{[\s\S]*?\n\}/.exec(SRC);
  chk(!!aim && /v\.project\(PK\.cam\)/.test(aim[0]),
      '★ 캐릭터가 화면 어디에 있는지도 함께 본다 (왼쪽에 선 사람은 오른쪽으로 고개를 돌려야 가운데를 본다)');
  chk(!!aim && /PK_GAZE_YAW/.test(aim[0]) && /PK_GAZE_PITCH/.test(aim[0]),
      '고개가 꺾이는 범위에 한계가 있다');
  const bind = /function _pkBindGaze\(\)\{[\s\S]*?\n\}/.exec(SRC);
  chk(!!bind && /window\.addEventListener\('pointermove'/.test(bind[0]),
      '★ 마우스를 **창 전체**에서 읽는다 (무대 안에서만 읽으면 조금만 밀어도 고개가 툭 돌아온다)');
  chk(!!bind && /PK\.state !== 'shooting'/.test(bind[0]) && /_pkTyping\(\)/.test(bind[0]),
      '★ 촬영 중이고 입력칸에 포커스가 없을 때만 읽는다 (글자를 치는 동안 두리번거리면 안 된다)');
  chk(!!bind && /window\._pkGazeBound/.test(bind[0]),
      '리스너를 한 번만 건다 (무대를 다시 만들 때마다 쌓이면 안 된다)');
  chk(/setBone\(c\.head\.bone, c\.head\.rest/.test(SRC),
      '★ 실행 화면과 **같은 함수**로 머리 본을 돌린다 (따로 만들면 같은 캐릭터가 화면마다 다르게 꺾인다)');
  chk(/bones:_pkFindBones\(g, seat\)/.test(SRC) && /function _pkFindBones\(g, seat\)/.test(SRC),
      '복제본에서 연출에 쓸 본을 이름으로 찾아 들고 있다');

  /* ③ 요금 — 여기가 이 기능의 유일한 위험이다. */
  chk(/pk\.sendPos\(me\.wx, me\.d, false, me\.gz, me\.gp, me\.yaw\)/.test(SRC),
      '시선과 몸 회전을 좌표 전송에 얹어 보낸다');
  chk(/_pkAimGaze\(me\); pk\.sendPos\(me\.wx, me\.d, true, me\.gz, me\.gp, me\.yaw\)/.test(SRC),
      '★ 셔터 직전에 지금 값을 한 번 확정해 보낸다 — 사진에 남는 값이 이것이다');
  chk(P.encPos(1, 2, 0, 0, 0) === P.encPos(1, 2),
      '★ 정면을 보고 정면으로 서 있으면 보내는 바이트가 예전과 같다 (계층이 칸을 안 늘린다)');
  /* 계층이 시선·회전으로는 전송을 «결정»하지 않는지 — 문장으로 확인한다. */
  const NET = fs.readFileSync('purikura-net.js', 'utf8');
  const sp = /function sendPos\(wx, d, force, gz, gp, yaw\)\{[\s\S]*?\n  \}/.exec(NET);
  const decide = sp ? sp[0].split('){')[1].split('lastSent.wx = wx')[0] : '';
  chk(!!sp && !/gz|gp|yaw/.test(decide),
      '★ 보낼지 말지를 정하는 데 시선·회전이 안 쓰인다 (쓰이면 마우스를 흔드는 동안 10Hz 로 계속 쓴다)');

  /* ④ 남의 시선은 부드럽게 따라온다 — 10Hz 를 그대로 넣으면 고개가 툭툭 꺾인다. */
  chk(/c\.gz \+= \(\(p\.gz\|\|0\) - c\.gz\) \* Math\.min\(1, dt\*12\)/.test(SRC),
      '남의 시선을 부드럽게 따라간다');

  /* ⑤ 몸 방향 — 기본은 정면, Q·E 로 돌린다. */
  chk(!!map && /q:'QL'/.test(map[0]) && /e:'QR'/.test(map[0]) &&
      /Q:'QL'/.test(map[0]) && /'ㅂ':'QL'/.test(map[0]),
      '★ Q·E 가 대소문자·한글까지 같은 표에 있다');
  chk(/const PK_BODY_YAW = /.test(SRC) &&
      /inner\.rotation\.y = PK_BODY_YAW \+ \(c\.yaw\|\|0\)/.test(SRC),
      '★ 몸이 기본으로 카메라를 본다 (모델에 구워진 기본 각을 되돌린다)');
  chk(/g\.rotation\.set\(0,0,0\);/.test(SRC),
      '★ 복제할 때 몸통 회전을 지운다 (춤 중이면 등 대고 누운 채로 굳는다)');
  chk(/function _pkWrapPi\(a\)/.test(SRC) && /_pkWrapPi\(me\.yaw \+/.test(SRC),
      '★ 각을 -π~π 로 접는다 (안 접으면 자릿수가 늘어 길이 상한에 걸린다)');
  chk(/c\.yaw = _pkWrapPi\(c\.yaw \+ _pkWrapPi\(\(p\.yaw\|\|0\) - c\.yaw\)/.test(SRC),
      '★ 남의 회전은 «가까운 쪽»으로 돈다 (그냥 빼면 +170° → -170° 가 340° 를 돈다)');
  chk(/PK\.turnDirty = true;/.test(SRC) && /moved = true/.test(SRC) &&
      !/QL \|\| PK\.keys\.QR\)\{[\s\S]{0,200}moved = true/.test(SRC),
      '★ 회전은 moved 로 안 친다 (치면 돌리는 동안 10Hz 쓰기가 계속 나간다)');
  chk(/mv === 'QL' \|\| mv === 'QR'[\s\S]{0,300}sendPos\([\s\S]{0,60}true, me\.gz, me\.gp, me\.yaw\)/.test(SRC),
      '★ 손을 뗄 때 한 번 보낸다 (점프·포즈와 같은 «한 동작에 쓰기 1회»)');
  chk(/<b>Q E<\/b>/.test(HTML), '무대 아래 안내에 Q E 가 적혀 있다');
}
say('');

/* ── §11. 자세 ─────────────────────────────────────────────────────── */
say('· §11 자세 — 기본은 팔 내림, 포즈는 둘');
{
  /* ① 기본 자세 = 드래그했을 때의 팔 처짐. 평소(앉은) 각은 책상에 손을 올린 각이라
     서 있는 무대에서는 팔이 앞으로 들린 것처럼 보인다. */
  const ap = /function _pkApplyPose\(c\)\{[\s\S]*?\n\}/.exec(SRC);
  chk(!!ap, '_pkApplyPose 를 찾았다');
  chk(!!ap && /base \+ SHAKE_ARM_DROOP/.test(ap[0]),
      '★ 기본 자세가 드래그했을 때와 같은 팔 처짐(SHAKE_ARM_DROOP)이다');
  chk(!!ap && /c\.armBase/.test(ap[0]) && /ANIMAL_HAND_REST/.test(SRC),
      '★ 팔 기본각을 좌석에서 가져온다 (동물은 사람과 값이 다르다)');

  /* ② 포즈는 둘뿐. 셋·넷은 «포즈»가 아니다.
     ⚠️ `_pkOwns` 의 목록으로 세면 안 된다 — 그건 «우리가 먹는 키» 지 포즈 목록이 아니다.
       키 3 은 눈 감기(blink)라 그 목록에 정당하게 들어 있고, 그것 때문에 이 줄이 빨개졌었다.
       포즈인지 아닌지는 **me.pose 에 값을 넣는 자리**가 가른다. */
  /* ⚠️ `=` 하나만 보면 `me.pose === +e.key` 라는 **비교**까지 세어진다. 대입만 센다. */
  const poseSets = (CODE.match(/me\.pose\s*=(?!=)/g) || []).length;
  chk(/if\(e\.key === '1' \|\| e\.key === '2'\)\{/.test(CODE) && poseSets === 1
      && !/e\.key === '4'/.test(CODE),
      "★ 포즈 키가 1·2 뿐이다 (3 은 눈 감기라 값이 따로다 · 4 는 없다 · 대입 자리 "
      + poseSets + '곳)');
  chk(!/pose\s*\+\s*4/.test(CODE),
      '  눈 감기를 pose 값에 끼워 보내지 않는다 (옛 클라이언트가 엉뚱한 포즈로 접는다 — app.js 주석의 경고)');
  chk(/e\.key === '1' \|\| e\.key === '2'/.test(SRC),
      '1·2 만 포즈로 받는다');
  chk(/\(me\.pose === \+e\.key\) \? 0 : \+e\.key/.test(SRC),
      '★ 같은 번호를 다시 누르면 기본 자세로 돌아온다 (푸는 길이 없으면 넉 장을 그 자세로 찍는다)');
  chk(/Math\.max\(0, Math\.min\(2, ev\.v \| 0\)\)/.test(SRC),
      '★ 남이 보낸 포즈 번호도 0~2 로 자른다 (옛 클라이언트가 3·4 를 보낼 수 있다)');
  chk(!/P===3/.test(SRC) && !/P===4 \? c\.t\*3\.2/.test(SRC),
      '옛 «기울기·회전으로 흉내내던» 포즈가 남아 있지 않다');

  /* ③ 자세 «값»은 실행 화면의 그 상수·그 함수에서 온다. */
  chk(!!ap && /_trickArmBase\(base, false, 1\)/.test(ap[0]) && /_trickArmSpread\(1\)/.test(ap[0]) &&
      /_trickLegPose\(c\.standLeft, 1\)/.test(ap[0]),
      '★ /150 자세를 실행 화면의 그 함수에서 가져온다 (숫자를 새로 적으면 무대만 옛 자세로 남는다)');
  chk(!!ap && /진행률을 1|e=1|, 1\)/.test(ap[0]),
      '진행률 1 = «다 잡은 자세»를 쓴다 — 움직임은 없다');
  chk(!!ap && !/Math\.sin|performance\.now|c\.t\b/.test(ap[0]),
      '★ 자세에 시간이 안 들어간다 (들어가면 셔터가 언제 터지냐에 따라 매번 다른 순간이 찍힌다)');

  /* ④ 머리는 시선이 마지막에 정한다 — 순서가 뒤집히면 포즈가 시선을 덮는다. */
  const pose = /function _pkPoseChar\(c\)\{[\s\S]*?\n\}/.exec(SRC);
  chk(!!pose && pose[0].indexOf('_pkApplyPose(c)') < pose[0].indexOf('_pkApplyGaze(c)'),
      '★ 포즈를 먼저, 시선을 나중에 건다 (뒤집으면 포즈가 고개를 덮어 마우스를 안 본다)');
  chk(/<b>1<\/b> 살랑살랑/.test(HTML) && !/1~4/.test(HTML.split('pk-keys')[1] || ''),
      '무대 아래 안내가 1·2 만 적고 있다');

  /* 👀 시선 — 기준점과 매핑. 둘 다 «캐릭터가 화면 어디에 있느냐»에 걸려 있어서,
     카메라를 낮추거나 동물처럼 키가 다른 캐릭터가 서면 조용히 어긋난다(제보 2026-08-29). */
  const aim2 = /function _pkAimGaze\(c\)\{[\s\S]*?\n\}/.exec(SRC);
  chk(!!aim2 && /const hb = c\.head && c\.head\.bone;/.test(aim2[0]) &&
      /v\.setFromMatrixPosition\(hb\.matrixWorld\)/.test(aim2[0]),
      '★ 시선의 기준점이 «진짜 머리 본»이다 (키로 짐작하면 동물은 가슴을 가리킨다)');
  chk(!!aim2 && /CHAR_H \* \(c\.grow \|\| 1\) \* 0\.9/.test(aim2[0]),
      '본이 없는 캐릭터의 짐작값도 그 캐릭터의 키를 쓴다 (동물은 더 크다)');
  chk(!!aim2 && /room = \(edge\)=>Math\.max\(0\.35, edge\)/.test(aim2[0]) &&
      /const vx = cl\(v\.x\), vy = cl\(v\.y\);/.test(aim2[0]),
      '★ «화면 끝까지 남은 만큼»으로 나눈다 — 위쪽에 서 있어도 끝에서 최대가 된다');
  chk(!!aim2 && !/cl\(dx\) \* PK_GAZE_YAW/.test(aim2[0]),
      '★ 옛 방식(차이를 그냥 ±1 로 자르기)이 남아 있지 않다');
  /* 실제로 굴려 본다 — 캐릭터가 화면 위쪽에 서 있을 때도 마우스를 올리면 고개가 «더» 들려야 한다. */
  const UP = 0.30, DN = 0.45, tilt = 16*Math.PI/180;
  const cl2 = u=>Math.max(-1, Math.min(1, u)), rm = e=>Math.max(0.35, e);
  function look(vy, my){
    const v2 = cl2(vy), n2 = (my - v2) / rm(my > v2 ? 1 - v2 : 1 + v2);
    return ((n2 > 0 ? -cl2(n2)*UP : -cl2(n2)*DN) - tilt);
  }
  chk(look(0.8, 1) < look(0.8, 0.8) - 0.05,
      '★ 위쪽에 선 캐릭터도 마우스를 천장으로 올리면 고개를 «더» 든다');
  chk(Math.abs(look(0.8, 1) - look(0, 1)) < 0.2,
      '서 있는 자리가 달라도 «천장을 볼 때»의 각이 크게 안 갈린다');
}
say('');

/* ── §12. 뒷배경 ───────────────────────────────────────────────────── */
say('· §12 뒷배경 — 고른 것과 찍히는 것이 같은가 · 컷마다 섞어도 넷이 같은가');
{
  /* ① 그리는 자리가 하나다. 로비 미리보기·무대·캡처가 같은 함수를 부른다. */
  chk(typeof P.drawBg === 'function' && P.bgList().length === 6,
      '★ 배경 여섯이 계층에 있다 — ' + P.bgList().map(b=>b.name).join(' · '));
  chk(/P\.drawBg\(cv\.getContext\('2d'\), 46, 62, b\.id\)/.test(SRC),
      '로비 미리보기가 계층의 drawBg 를 쓴다');
  chk(/P\.drawBg\(cv\.getContext\('2d'\), cv\.width, cv\.height, bg\)/.test(SRC),
      '★ 무대도 **같은 함수**를 쓴다 (따로 그리면 고른 것과 찍힌 것이 갈라진다)');
  chk((SRC.match(/P\.drawBg\(/g) || []).length === 2,
      '★ drawBg 를 부르는 자리가 둘뿐이다 (미리보기 · 무대) — 캡처는 무대를 그대로 찍는다');
  chk(!/#428DDB|#C84C52|#C4CCD7|#8a5230/i.test(SRC),
      '★ app.js 에 배경 색이 하나도 안 적혀 있다 (전부 계층에서 온다)');

  /* ② 단색은 텍스처를 안 만든다 — 판 한 장을 더 그릴 이유가 없다. */
  const ab = /function _pkApplyBg\(\)\{[\s\S]*?\n\}/.exec(SRC);
  chk(!!ab && /P\.bgFlat\(bg\)/.test(ab[0]) && /setClearColor\(new THREE\.Color\(flat\), 1\)/.test(ab[0]),
      '단색은 clearColor 로 끝낸다 (텍스처를 안 만든다)');
  chk(!!ab && /new THREE\.CanvasTexture\(cv\)/.test(ab[0]) && /tex\.encoding = THREE\.sRGBEncoding/.test(ab[0]),
      '★ 그라데이션은 CanvasTexture 다 (setClearColor 는 단색만 된다) · sRGB 를 맞춘다');
  chk(!!ab && /PK\.bgTex\.dispose/.test(ab[0]),
      '★ 옛 텍스처를 버린다 (배경을 여러 번 바꾸면 GPU 에 계속 쌓인다)');
  chk(/_pkApplyBg\(\);\s*\/\/ 비율이 바뀌었을 수 있다/.test(SRC),
      '★ 방향·컷이 바뀌면 그 비율로 다시 굽는다 (배경 텍스처는 화면에 늘여서 깔린다)');
  chk(/_pkDisposeStage[\s\S]{0,400}PK\.bgTex\.dispose/.test(SRC),
      '무대를 버릴 때 텍스처도 같이 버린다');

  /* ③ 방 전체가 같은 배경이어야 한다 — 캡처는 각자 자기 화면에서 뜬다. */
  chk(/setConfig\(\{orient:PK\.orient, cuts:PK\.cuts, basic:PK\.basic, bg:_pkBgStr\(\)[,}]/.test(SRC),
      '★ 배경이 meta 를 탄다 (각자 고르면 사람마다 다른 사진이 나온다)');
  chk((SRC.match(/bg:_pkBgStr\(\)[,}]/g) || []).length === 2,
      '★ 설정을 미는 자리 둘(들어올 때 · 바꿀 때) 다 배경을 싣는다');
  chk(/PK\.bgSel = _pkP\(\)\.bgParse\(m\.bg\)/.test(SRC),
      '★ 받은 배경을 bgParse 로 거른다 (모르는 값·중복이 섞여 와도 걸러진다)');
  const bgBranch = /if\(m\.bg && m\.bg !== _pkBgStr\(\)\)\{[\s\S]*?\n    \}/.exec(SRC);
  chk(!!bgBranch && !/changed = true/.test(bgBranch[0]),
      '★ 배경만 바뀌면 changed 를 안 세운다 — 올린 프레임이 안 지워진다 (규격이 그대로다)');
  const NET = fs.readFileSync('purikura-net.js', 'utf8');
  chk(/bgJoin\(String\(cfg\.bg\)/.test(NET),
      '★ setConfig 가 목록에 없는 배경을 먼저 거른다 (규칙에만 맡기면 방향·컷까지 같이 안 바뀐다)');

  /* ④ ★★ 컷마다 섞는 것 — 이 기능의 진짜 위험은 «각자 주사위를 굴리는 것»이다.
     사진은 넷이 각자 자기 화면에서 뜨므로, 각자 굴리면 같은 촬영인데 사람마다 배경이 다르다.
     그리고 그건 다 찍고 각자 저장한 뒤에야 안다. → 씨앗 하나에서 «계산»으로 뽑는지 실제로 굴려 본다. */
  chk(typeof P.bgForCut === 'function' && typeof P.bgParse === 'function',
      '컷별 배경을 내는 함수가 계층에 있다');
  chk(!/Math\.random/.test(String(P.bgForCut)),
      '★ 뽑는 데 Math.random 을 안 쓴다 (쓰면 사람마다 다른 배경으로 찍힌다)');
  let sameAll = true;
  for(let s2=0; s2<200; s2++){
    for(let i=0;i<4;i++){
      /* 넷이 «각각» 부른다고 치고 같은 값이 나오는지 — 상태를 안 들고 있어야 성립한다 */
      if(P.bgForCut(['sky','red','blue'], i, s2) !== P.bgForCut(['sky','red','blue'], i, s2)) sameAll = false;
    }
  }
  chk(sameAll, '★ 같은 씨앗·같은 컷이면 누가 몇 번 물어도 같은 값이다 (넷이 같은 사진을 갖는다)');
  chk(P.bgForCut(['blue'], 3, 12345) === 'blue',
      '하나만 고르면 넉 장이 다 그 배경이다 (지금까지와 같은 동작)');

  /* «골고루» — 완전 무작위가 아니다. 둘을 골라 4컷이면 반드시 둘씩 두 번 나온다.
     [왜] 컷마다 따로 뽑으면 넉 장이 전부 같은 색일 확률이 12.5% 다 —
       여덟 번에 한 번쯤 «섞으라고 했는데 다 똑같다»가 나온다. */
  let uneven = 0;
  for(let s3=0; s3<400; s3++){
    const cnt = {};
    for(let i=0;i<4;i++){ const v = P.bgForCut(['sky','red'], i, s3); cnt[v] = (cnt[v]||0)+1; }
    if(cnt.sky !== 2 || cnt.red !== 2) uneven++;
  }
  chk(uneven === 0,
      '★ 둘을 고르면 4컷이 반드시 2:2 다 (완전 무작위면 12.5% 확률로 넉 장이 같은 색이 된다)');
  let allSix = true;
  for(let s4=0; s4<200; s4++){
    const seen = {};
    for(let i=0;i<6;i++) seen[P.bgForCut(P.bgList().map(b=>b.id), i, s4)] = 1;
    if(Object.keys(seen).length !== 6) allSix = false;
  }
  chk(allSix, '여섯을 고르고 6컷을 찍으면 여섯이 한 번씩 다 나온다');
  /* 씨앗은 방장이 촬영을 시작하며 적는 시각이다 — 새 필드를 안 만든다. */
  chk(/PK\.seed = \+m\.startedAt/.test(SRC),
      '★ 씨앗은 meta.startedAt 이다 (새 필드를 안 만들고, 컷마다 드는 쓰기가 0회다)');
  chk(/_pkApplyBg\(\); _pkPaintFilter\(\);/.test(SRC),
      '★ 컷이 열릴 때 그 컷의 배경으로 다시 굽는다');
  /* ★★ «기다리는 동안»에도 그 컷의 배경이어야 한다. cutIdx 는 그때 -1 이라, 0 으로 떨어뜨리면
     컷마다 배경이 다른 방에서 **매번 1번 컷 배경으로 되돌아간다** — 「촬영을 눌러야만 배경이
     바뀐다」로 보였던 자리다(제보 2026-08-29). */
  chk(/function _pkCutNow\(\)\{[\s\S]{0,300}PK\.waitCut >= 0\) return PK\.waitCut;/.test(SRC),
      '★ 기다리는 중에는 «곧 찍을 컷»을 지금 컷으로 본다');
  chk(/return P\.bgForCut\(PK\.bgSel, _pkCutNow\(\), PK\.seed\);/.test(SRC) &&
      !/bgForCut\(PK\.bgSel, Math\.max\(0, PK\.cutIdx\)/.test(SRC),
      '★ 배경이 그 번호를 쓴다 (0 으로 떨어뜨리지 않는다)');
  chk(/i === _pkCutNow\(\) \? 'now'/.test(SRC),
      '점 표시도 같은 번호를 본다 — 기다리는 동안 어느 컷 차례인지 보인다');

  /* ⑤ 규칙 — 이제 «쉼표로 이은 목록»을 받아야 한다. 식을 실제로 실행한다. */
  const RULES = JSON.parse(fs.readFileSync('firebase-database-rules.json', 'utf8'));
  const meta = RULES.rules.rooms['$room']._photo.meta;
  chk(!!meta.bg && !!meta.bg['.validate'],
      '★ 규칙에 meta.bg 가 열려 있다 (안 열면 $other:false 가 거부해서 쓰기가 조용히 실패한다)');
  const bgv = String(meta.bg['.validate']);
  const re = new RegExp((/matches\(\/(.+)\/\)/.exec(bgv) || [])[1] || '$^');
  P.bgList().forEach(b=>{
    if(!re.test(b.id)) chk(false, '규칙이 배경 ' + b.id + ' 을 안 받는다');
  });
  chk(true, '규칙이 받는 낱말과 계층의 목록이 같다 (' + P.bgList().length + '종)');
  chk(re.test('sky,red') && re.test(P.bgList().map(b=>b.id).join(',')),
      '★ 규칙이 «쉼표로 이은 목록»을 받는다 (안 넓히면 둘 이상 고른 순간 방향·컷까지 같이 안 바뀐다)');
  chk(!re.test('sky,') && !re.test('') && !re.test('sky,nope'),
      '★ 잘린 목록·빈 값·모르는 낱말은 거부한다');
  chk(!re.test('none'),
      '기본 프레임의 값(none)이 배경 목록에 안 섞여 있다 (두 줄은 다른 층이다)');
  chk(meta['$other'] && meta['$other']['.validate'] === false,
      'meta 에 모르는 자식은 여전히 못 넣는다');
}
say('');

/* ── §13. 사건 중복 ────────────────────────────────────────────────── */
say('· §13 사건 — 남의 옛 점프가 다시 배달되지 않는가');
{
  /* ⚠️ ev 노드는 자리마다 한 칸씩 «남아 있다». 누구 하나가 쓰면 ev 전체가 바뀌어 구독이 다시
     돌고, 그때 남아 있던 남의 옛 사건이 통째로 다시 배달된다. → A 가 점프한 뒤 B 가 포즈만
     눌러도 A 가 한 번 더 뛴다. 본인 화면에서만 그러니 A 는 모른다. */
  const NET = fs.readFileSync('purikura-net.js', 'utf8');
  chk(/for\(var k in o\) if\(\(\+k\) !== slot && o\[k\]\) onEvent\(\+k, o\[k\]\)/.test(NET),
      '계층은 ev 가 바뀔 때마다 자리 전부를 다시 흘려보낸다 (그래서 화면이 걸러야 한다)');
  const oe = /function _pkOnPeerEvent\(slot, ev\)\{[\s\S]*?\n\}/.exec(SRC);
  chk(!!oe && /PK\.evSeen\[slot\] === ts/.test(oe[0]) && /PK\.evSeen\[slot\] = ts/.test(oe[0]),
      '★ 자리마다 마지막으로 본 시각을 기억하고 같은 것은 흘려보낸다');
  chk(!!oe && oe[0].indexOf('PK.evSeen[slot] = ts') < oe[0].indexOf("ev.k === 'jump'"),
      '★ 거르는 것이 **먼저**다 (뒤에 두면 이미 뛰고 나서 기억한다)');
  chk(/PK\.evSeen = \{\};/.test(SRC) && /evSeen:\{\}/.test(SRC),
      '창을 다시 열 때 기억을 비운다 (안 비우면 다음 촬영의 첫 점프가 씹힌다)');
  /* «땅에 있는가»의 판정도 시각으로 바뀌었다 — 뛰는 중이면 jt 가 살아 있다. */
  chk(/if\(ev\.k === 'jump' && !c\.jt\)/.test(SRC),
      '땅에 있을 때만 뛴다 (공중에서 또 받으면 뛴 시각이 밀려 두 번 올라간다)');
  chk(/e\.key === ' ' && !me\.jt/.test(SRC),
      '내 점프도 같은 판정을 쓴다 (한쪽만 고치면 나만 두 번 뛴다)');
}
say('');

/* ── §14. BGM ──────────────────────────────────────────────────────── */
say('· §14 BGM — 창이 열려 있는 동안만, 그리고 소리가 겹치지 않는가');
{
  chk(/const PK_BGM_SRC = \['parts\/purikura-bgm\.mp3', 'purikura-bgm\.mp3'\]/.test(SRC),
      '★ 경로 폴백이 있다 (parts/ 가 없는 배치에서도 돈다 — 때리기·클릭 소리와 같은 관례)');
  const el = /function _pkBgmEl\(\)\{[\s\S]*?\n\}/.exec(SRC);
  chk(!!el && /a\.loop = true/.test(el[0]),
      '★ 배경음이라 loop 이다 (효과음 풀 _mkSndPool 을 쓰지 않는다 — 겹쳐 날 일이 없다)');
  chk(!!el && /_pkBgmIdx \+ 1 < PK_BGM_SRC\.length/.test(el[0]),
      '파일을 못 찾으면 다음 후보로 갈아탄다');
  chk(!!el && /console\.warn/.test(el[0]),
      '★ 다 떨어지면 알린다 (조용히 삼키면 «소리가 안 난다»의 원인을 다음에 또 못 찾는다)');
  const st = /function _pkBgmStart\(\)\{[\s\S]*?\n\}/.exec(SRC);
  chk(!!st && /officeMode\) return;/.test(st[0]),
      '★ 회사원 모드에서는 소리를 안 낸다 (소리 내는 자리는 예외 없이 이 게이트를 지난다)');
  chk(!!st && /pr\.catch/.test(st[0]),
      '자동재생이 막히면 콘솔에 남긴다');

  /* 유튜브 BGM(마이홈·플레이리스트)은 창 하나를 공유한다 — 재우는 것은 한 번이면 된다. */
  const hush = /function _pkHushOthers\(\)\{[\s\S]*?\n\}/.exec(SRC);
  chk(!!hush && (hush[0].match(/companion\.pauseBgm/g) || []).length === 2,
      '★ 재우는 호출이 한 번뿐이다 (창을 공유하므로 두 번 부를 이유가 없다)');
  chk(!!hush && /_plPlaying = false/.test(hush[0]) && /_mhBgmSetPlaying/.test(hush[0]),
      '★ 양쪽의 «재생 중» 표시도 내린다 (안 내리면 ▶ 버튼이 재생 중인 척한다)');
  chk(!!hush && /PK\.hushed = \{ pl:pl, home:home \}/.test(hush[0]),
      '★ 누가 나고 있었는지 기억한다 (안 하면 안 듣던 것까지 켜 준다)');
  const un = /function _pkUnhushOthers\(\)\{[\s\S]*?\n\}/.exec(SRC);
  chk(!!un && /if\(plNow \|\| homeNow\) return;/.test(un[0]),
      '★ 그 사이에 직접 다시 튼 경우에는 안 건드린다 (또 resume 하면 두 소리가 겹친다)');
  chk(/_pkHushOthers\(\); _pkBgmStart\(\);/.test(SRC) && /_pkBgmStop\(\); _pkUnhushOthers\(\);/.test(SRC),
      '★ 열 때 «재우고 켜기», 닫을 때 «끄고 깨우기» 순서다');
  chk(/function closePurikura[\s\S]{0,900}_pkBgmStop\(\)/.test(SRC),
      '★ 창이 닫히는 모든 길에서 소리가 멎는다 (⎋·✕·회사원 모드 전부 closePurikura 를 지난다)');
  chk(/window\._mhBgmPlaying = function/.test(SRC) && /window\._mhBgmSetPlaying = function/.test(SRC),
      '마이홈이 «지금 나는 중인가»를 알려주는 창구를 열어 뒀다');
  chk(!/_mhBgmSetPlaying = function[\s\S]{0,140}companion\./.test(SRC),
      '★ 그 창구는 표시만 바꾼다 (거기서 companion 을 또 부르면 두 번 재워진다)');
}
say('');

if (fail) { say('✗ ' + fail + '건 어긋남'); process.exit(1); }
say('전부 통과 ✅ — 화면에 그린 것과 저장할 것이 같은 규칙을 보고 있다');
