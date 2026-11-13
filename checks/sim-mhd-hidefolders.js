/* ═══ 📂 sim-mhd-hidefolders.js — 마이홈 바탕화면 «환경 설정» 정리 · 폴더 숨기기 · 그림 아이콘 (2026-10-02 · 시안 확정) ═══════
   [요청] ① 배경 네 줄을 [배경화면 변경 ▶] 하나로 묶고 옆으로 펼친다(색상 · 파일 · URL · 배경 초기화).
          ② [폴더 숨기기] — 외부 앱 폴더(북마크·말랑이 등)를 가린다. **방문자 화면에서도** 가린다.
          ③ 위 두 줄 옆 아이콘은 뗀다 · 문구는 «배경화면 변경».
          ④ 북마크 아이콘을 그림 파일로(addFolder 의 iconSrc · 상대 경로만).
   ・1절: 마크업 · CSS · 배선(정적).
   ・2절: advApplyFolderHide — 내 집은 내 설정, 남의 집은 **그 집 주인** 설정. ✔ 표시는 내 설정만.
   ・3절: 서버 기록 — 상태 주인이 통째 PUT(sim-myhome-store) · 여기서는 옛 길이 없고 부르는 자리만 본다.
   ・4절: iconSrc 걸러내기 — 바깥 주소 · 상위 폴더 · 스크립트는 받지 않는다.
   [실행] myhome-desktop.js · firebase-database-rules.json 이 있는 폴더에서. */
'use strict';
globalThis.TwSafeHtml = require([__dirname, process.cwd()].flatMap(d => ['safe-html.js', 'parts/shared/safe-html.js', 'app/parts/shared/safe-html.js'].map(p => require('path').join(d, p))).find(p => require('fs').existsSync(p)));   // 🛡️ 모듈이 부르는 공용 씻기 — 진짜 파일
const fs = require('fs');
const MHD = fs.readFileSync('myhome-desktop.js', 'utf8');

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const grabFn = (name, src = MHD) => { const re = new RegExp('(async )?function ' + name + '\\('); const m = re.exec(src); if(!m) return ''; const i = m.index; let k = src.indexOf('{', i), d = 0; for(; k < src.length; k++){ if(src[k] === '{') d++; else if(src[k] === '}' && --d === 0) return src.slice(i, k + 1); } return ''; };
const code = strip(MHD);

say('── 1. 마크업 · CSS · 배선');
{
  const menu = code.slice(code.indexOf("'<div id=\"advEnvMenu\">'"), code.indexOf("'<div id=\"advUrlBox\">"));
  chk(/<button type="button" class="hd">배경화면 변경<span>▶<\/span><\/button>/.test(menu), '③ 첫 줄 «배경화면 변경 ▶» — 앞 아이콘 없음');
  chk(/<button id="advEnvHideFolders" type="button">폴더 숨기기<\/button>/.test(menu), '③ «폴더 숨기기» — 앞 아이콘 없음');
  chk(['advEnvColor','advEnvFile','advEnvImg','advEnvReset'].every(id => menu.indexOf('id="' + id + '"') > menu.indexOf('class="mhd-fly"')), '① 색상·파일·URL·배경 초기화는 옆 펼침(mhd-fly) 안 — id 그대로(연결 안 바뀜)');
  chk(/>📁 파일</.test(menu) && />🌐 URL</.test(menu) && />↺ 배경 초기화</.test(menu), '① 줄인 문구(파일 · URL · 배경 초기화)');
  chk(!/class=\\?["']fly["'\s\\]/.test(menu), "맨 '.fly' 클래스 없음(sim-mhd-envsub 와 같은 함정 — 채팅 날리기 규칙)");
  chk(/#advDesktop\.mhd-hide-folders \.mhd-app\{display:none !important;\}/.test(code), '② 숨기기는 클래스 하나로 — 인라인 display(setFolderVisible)보다 우선');
  chk(/class="adv-icon mhd-app" id="'\+esc\(a\.iconId\)\+'"/.test(code), '② 외부 앱 폴더만 mhd-app 표식(캐릭터세팅 등 기본 아이콘은 안 숨는다)');
  chk(!/id="advIconChar"[^']*mhd-app/.test(code), '기본 아이콘(캐릭터세팅)에는 표식이 없다');
  const ab = strip(grabFn('advApplyBg'));
  chk(/advApplyFolderHide\(\);\s*\}$/.test(ab.trim()), '② 배경을 칠할 때마다(내 집 · 남의 집 전환 · 서버 맞춤) 같이 맞춘다');
  chk(!/hideFolders:!!d\.hideFolders/.test(code) && /const mhdDesk = \(\) => myhomeStore\.mine\(\)\.desktop;/.test(code), '켜짐의 원본은 서버(상태 주인의 바탕화면) — 이 기기 저장본(advLoad)은 읽지 않는다');
  const iClick = code.indexOf("el('advEnvHideFolders').addEventListener('click'");
  const clk = code.slice(iClick, code.indexOf('toast(', iClick));
  chk(iClick > 0 && /const hide = !mhdDesk\(\)\.hideFolders;/.test(clk) && /myhomeStore\.setDesktop\(\{ hideFolders: hide \}\);/.test(clk), '★ 누르면 상태 주인에 숨김만 넘긴다(저장 · 다른 기기 맞춤 · 409 는 상태 주인 몫)');
  chk(MHD.indexOf('북마크') < 0, "이 파일에 '북마크' 글자 없음(sim-bookmark 와 같은 약속)");
}

say('── 2. advApplyFolderHide — 누구 설정을 따르나');
{
  const env = {};
  const F = new Function('env', `
    const document = { getElementById: (id) => id === 'advDesktop' ? env.d : (id === 'advEnvHideFolders' ? env.b : null) };
    const mhdDesk = () => env.ADV; let advVisiting = env.visiting, advVisitBg = env.visitBg;
    ${grabFn('advApplyFolderHide')}
    advApplyFolderHide();
  `);
  const run = (mine, visiting, ownerBg) => {
    const cls = new Set();
    env.d = { classList: { toggle: (c, on) => { if(on) cls.add(c); else cls.delete(c); } } };
    env.b = { textContent: '' };
    env.ADV = { hideFolders: mine }; env.visiting = visiting; env.visitBg = ownerBg;
    F(env);
    return { hidden: cls.has('mhd-hide-folders'), label: env.b.textContent };
  };
  let r = run(true, false, null);
  chk(r.hidden && r.label === '✔ 폴더 숨기기', '내 집 · 켜짐 → 숨김 · ✔ 표시');
  r = run(false, false, null);
  chk(!r.hidden && r.label === '폴더 숨기기', '내 집 · 꺼짐 → 보임');
  r = run(false, true, { color:'#fff', ts:1, hideFolders:true });
  chk(r.hidden, '★ 남의 집 · 주인이 숨김 → 방문자 화면에서도 숨김(요청)');
  r = run(true, true, { color:'#fff', ts:1 });
  chk(!r.hidden && r.label === '✔ 폴더 숨기기', '남의 집 · 주인은 안 숨김 → 내가 켜 둬도 보임 · ✔ 는 내 설정만');
  r = run(false, true, null);
  chk(!r.hidden, '주인 기록이 없음(구버전·조회 실패) → 보임');
  r = run(false, true, { cleared:true, ts:5, hideFolders:true });
  chk(r.hidden, '주인이 배경을 초기화했어도 숨김은 그대로 따라온다');
}

say('── 3. 서버 기록 — 상태 주인(sim-myhome-store 5-2)이 통째 PUT 한다. 여기서는 부르는 자리만');
{
  chk(!/advSaveBgRemote|advPullBg|saveAdvBg|getAdvBg/.test(code), '옛 서버 길(advBg 기록 · 고른 시각 맞춤)이 남아 있지 않다');
  const sb = strip(grabFn('advSetBg'));
  chk(/myhomeStore\.setDesktop\(\{ bg: bg \|\| null \}\);/.test(sb) && /advApplyBg\(\);/.test(sb), '배경을 바꾸면 상태 주인에 넘기고 바로 다시 칠한다(색 · 파일 · URL · 초기화가 모두 여기로)');
  const vb = code.slice(code.indexOf('window._advApplyVisitUI = function'));
  chk(/const vw = myhomeStore\.view\(\);\s*advVisitBg = \(vw && vw\.desktop\) \? vw\.desktop : null;/.test(vb) && !/firebaseAPI/.test(vb.slice(0, 1800)), '남의 집은 openView 가 받아 둔 그 집 바탕화면을 쓴다(요청 0 · Firebase 읽기 없음)');
  return Promise.resolve().then(part4);
}

function part4(){
  say('── 4. iconSrc 걸러내기');
  const m = /const _src = (\(typeof o\.iconSrc === 'string'[^\n]*?\)) \? o\.iconSrc : '';/.exec(MHD);
  chk(!!m, 'addFolder 의 iconSrc 걸러내기 줄을 찾았다');
  if(m){
    const ok = (v) => new Function('o', 'return ' + m[1] + ';')({ iconSrc: v });
    chk(ok('parts/icons/bookmark-books.svg') && ok('icons/a.png') && ok('b.webp'), '앱 안 상대 경로 svg·png·webp 는 받는다');
    chk(!ok('https://evil.example/a.svg') && !ok('//evil/a.svg') && !ok('file:///C:/a.svg'), '★ 바깥 주소는 안 받는다');
    chk(!ok('../secret/a.svg') && !ok('parts/../../a.png'), '★ 상위 폴더로 나가는 경로는 안 받는다');
    chk(!ok('parts/x.js') && !ok('a.svg" onerror="x') && !ok('') && !ok(null), '스크립트·따옴표 섞인 값·빈 값은 안 받는다');
  }
  chk(/im\.onerror=\(\)=>\{ box\.textContent=a\.icon\|\|'📁'; \};/.test(code), '그림을 못 읽으면 원래 글자 아이콘으로(빈 칸이 남지 않게)');
  chk(/const im=document\.createElement\('img'\);/.test(code), '그림은 DOM 으로 만든다(문자열로 끼우지 않는다)');
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
}
