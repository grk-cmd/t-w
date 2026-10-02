/* ═══ 📂 sim-mhd-hidefolders.js — 마이홈 바탕화면 «환경 설정» 정리 · 폴더 숨기기 · 그림 아이콘 (2026-10-02 · 시안 확정) ═══════
   [요청] ① 배경 네 줄을 [배경화면 변경 ▶] 하나로 묶고 옆으로 펼친다(색상 · 파일 · URL · 배경 초기화).
          ② [폴더 숨기기] — 외부 앱 폴더(북마크·말랑이 등)를 가린다. **방문자 화면에서도** 가린다.
          ③ 위 두 줄 옆 아이콘은 뗀다 · 문구는 «배경화면 변경».
          ④ 북마크 아이콘을 그림 파일로(addFolder 의 iconSrc · 상대 경로만).
   ・1절: 마크업 · CSS · 배선(정적).
   ・2절: advApplyFolderHide — 내 집은 내 설정, 남의 집은 **그 집 주인** 설정. ✔ 표시는 내 설정만.
   ・3절: 서버 기록 — 켜졌을 때만 hideFolders 칸을 싣는다(규칙 변경 없음) · 배경을 초기화해도 같이 간다 · 다른 기기 값을 받아 온다.
   ・4절: iconSrc 걸러내기 — 바깥 주소 · 상위 폴더 · 스크립트는 받지 않는다.
   [실행] myhome-desktop.js · firebase-database-rules.json 이 있는 폴더에서. */
'use strict';
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
  chk(/class="adv-icon mhd-app" id="'\+a\.iconId\+'"/.test(code), '② 외부 앱 폴더만 mhd-app 표식(캐릭터세팅 등 기본 아이콘은 안 숨는다)');
  chk(!/id="advIconChar"[^']*mhd-app/.test(code), '기본 아이콘(캐릭터세팅)에는 표식이 없다');
  const ab = strip(grabFn('advApplyBg'));
  chk(/advApplyFolderHide\(\);\s*\}$/.test(ab.trim()), '② 배경을 칠할 때마다(내 집 · 남의 집 전환 · 서버 맞춤) 같이 맞춘다');
  chk(/hideFolders:!!d\.hideFolders/.test(code), '켜짐은 이 기기에도 남는다(advLoad)');
  const iClick = code.indexOf("el('advEnvHideFolders').addEventListener('click'");
  const clk = code.slice(iClick, code.indexOf('});', iClick));
  chk(iClick > 0 && /ADV\.hideFolders = !ADV\.hideFolders;/.test(clk) && /ADV\.bgTs = Date\.now\(\);/.test(clk) && /advSaveBgRemote\(\)/.test(clk), '★ 누르면 고른 시각을 찍고 서버에 올린다(다른 기기 맞춤에서 이긴다)');
  chk(MHD.indexOf('북마크') < 0, "이 파일에 '북마크' 글자 없음(sim-bookmark 와 같은 약속)");
}

say('── 2. advApplyFolderHide — 누구 설정을 따르나');
{
  const env = {};
  const F = new Function('env', `
    const document = { getElementById: (id) => id === 'advDesktop' ? env.d : (id === 'advEnvHideFolders' ? env.b : null) };
    let ADV = env.ADV, advVisiting = env.visiting, advVisitBg = env.visitBg;
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

say('── 3. 서버 기록');
{
  const env = { saved: [] };
  const save = new Function('env', `
    const window = { firebaseAPI: { saveAdvBg: (uid, rec) => { env.saved.push(rec); return { ok:true }; } } };
    const firebaseAPI = window.firebaseAPI; const getMyUserId = () => 'u1'; const console = { log(){}, warn(){} };
    const Promise = { resolve: (v) => ({ then: (f) => ({ catch(){} }) }) };
    let ADV = env.ADV;
    ${grabFn('advSaveBgRemote')}
    advSaveBgRemote();
  `);
  env.ADV = { bg:{ color:'#123' }, bgTs:10, hideFolders:true }; save(env);
  chk(env.saved[0].color === '#123' && env.saved[0].ts === 10 && env.saved[0].hideFolders === true, '켜짐 → 배경 기록에 hideFolders:true 를 같이 싣는다');
  env.ADV = { bg:null, bgTs:11, hideFolders:true }; save(env);
  chk(env.saved[1].cleared === true && env.saved[1].hideFolders === true, '★ 배경 초기화 상태여도 숨김은 실린다(cleared 기록)');
  env.ADV = { bg:{ color:'#123' }, bgTs:12, hideFolders:false }; save(env);
  chk(!('hideFolders' in env.saved[2]), '꺼짐 → 칸을 아예 안 싣는다(옛 기록 모양 그대로)');
  /* 규칙 — advBg .validate 는 img·color 만 본다(새 칸 때문에 쓰기가 거부되지 않는다) */
  let rules = null; try{ rules = JSON.parse(fs.readFileSync('firebase-database-rules.json', 'utf8')); }catch(_){}
  const find = (o) => { if(!o || typeof o !== 'object') return null; if(o.advBg) return o.advBg; for(const k in o){ const r = find(o[k]); if(r) return r; } return null; };
  const adv = find(rules);
  chk(adv && !/hideFolders|\$other/.test(JSON.stringify(adv)), '규칙 변경 없음 — advBg 는 img·color 만 검사한다(hideFolders 칸이 막히지 않는다)');

  /* advPullBg — 다른 기기에서 켠 숨김을 받아 온다 */
  const pull = new Function('env', `
    const window = { firebaseAPI: { getAdvBgEx: async () => ({ ok:true, bg: env.srv }) } };
    const firebaseAPI = window.firebaseAPI; const console = { log(){}, warn(){} };
    let ADV = env.ADV, advVisiting = false;
    const advSave = () => {}, advSaveBgRemote = () => { env.up++; }, advApplyBg = () => { env.applied++; };
    ${grabFn('advPullBg')}
    return advPullBg;
  `);
  return (async () => {
    env.ADV = { bg:{ color:'#123' }, bgTs:100, hideFolders:false }; env.srv = { color:'#123', ts:200, hideFolders:true }; env.up = 0; env.applied = 0;
    await pull(env)('u1');
    chk(env.ADV.hideFolders === true && env.applied === 1, '★ 다른 기기에서 더 최근에 숨김 → 이 기기도 숨김(배경이 같아도 맞춘다)');
    env.ADV = { bg:{ color:'#123' }, bgTs:300, hideFolders:true }; env.srv = { color:'#123', ts:200 }; env.up = 0; env.applied = 0;
    await pull(env)('u1');
    chk(env.ADV.hideFolders === true && env.up === 1, '이 기기가 더 최근 → 이 기기 값을 올린다');
    env.ADV = { bg:{ color:'#123' }, bgTs:100, hideFolders:true }; env.srv = { color:'#123', ts:200 }; env.up = 0; env.applied = 0;
    await pull(env)('u1');
    chk(env.ADV.hideFolders === false, '다른 기기에서 다시 보이게 했으면(칸 없음) → 이 기기도 보임');
    part4();
  })();
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
