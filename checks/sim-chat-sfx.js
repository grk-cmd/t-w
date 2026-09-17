/* ═══ 🔔 sim-chat-sfx.js — 채팅 알림음 · 글자 크기 ▶ 서브메뉴 (2026-09-17 · 시안 확정) ═══════════════════
   [요청] 대화창 [설정]에 «알림음» 켜짐/꺼짐. 켜짐이면 소리 3종 중 하나를 고르는 줄이 나타나고(▷ 미리듣기),
     꺼짐이면 사라진다. «글자 크기» 는 «글자 크기 ▶» 로 바꾸고 마우스를 올리면 옆으로 4단이 펼쳐진다.
     대화창이 열려 있으면(최소화 포함) 울리지 않는다. 회사원 모드면 소리 없음(보는 사람 기준).
   ・1절: 상태·저장·게이트를 가짜 DOM 위에서 **실제로 돌린다** — 기본값 · 꺼짐 · 창 열림 · 간격 · 고른 소리.
   ・2절: 소리 풀 — _mkSndPool 로 만들고, prime 등록보다 먼저 만든다(once:true) · 회사원 모드 게이트는 풀 안.
   ・3절: 울리는 자리 — 상대 채팅이 화면에 뜬 분기 한 곳뿐(내 메시지 · chatLog 구독에는 없음).
   ・4절: HTML — 목록 id 가 CHAT_SFX_LIST 와 같다 · 서브메뉴가 #chatWindow 안 · :hover 로 열림 · fly 이름 안 씀.
   [실행] app.js · desk-companion-prototype.html 이 있는 폴더에서(chat-notify-*.mp3 는 있으면 본다). */
'use strict';
const fs = require('fs');
const SRC  = fs.readFileSync('app.js', 'utf8');
const HTML = fs.readFileSync('desk-companion-prototype.html', 'utf8');

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const grabFn = (name) => { const i = SRC.indexOf('function ' + name + '('); if(i < 0) return ''; let k = SRC.indexOf('{', i), d = 0; for(; k < SRC.length; k++){ if(SRC[k] === '{') d++; else if(SRC[k] === '}' && --d === 0) return SRC.slice(i, k + 1); } return ''; };
const grabConst = (name) => { const m = new RegExp('const ' + name + '\\s*=\\s*[^;]*;').exec(SRC); return m ? m[0] : ''; };

say('── 1. 상태 · 게이트 (실행)');
{
  const listM = /const CHAT_SFX_LIST = \[[\s\S]*?\];/.exec(SRC);
  const consts = ['CHAT_SFX_ON_KEY','CHAT_SFX_ID_KEY','CHAT_SFX_DEFAULT_ON','CHAT_SFX_DEFAULT_ID','CHAT_SFX_GAP_MS'].map(grabConst);
  const fns = ['_chatSfxOfficeLock','_chatSfxOn','_chatSfxId','_setChatSfxOn','_setChatSfxId','_applyChatSfxUI','_chatSfxPreview','_chatWinOpen','_chatNotifyIncoming'].map(grabFn);
  chk(!!listM && consts.every(Boolean) && fns.every(Boolean), '상수·함수가 전부 있다');
  chk(/let _chatSfxLast = 0;/.test(SRC), '  간격 판정용 _chatSfxLast');
  chk(/CHAT_SFX_ON_KEY\s*=\s*'tw\.chatSfx'/.test(SRC) && /CHAT_SFX_ID_KEY\s*=\s*'tw\.chatSfxId'/.test(SRC), '저장 키 tw.chatSfx · tw.chatSfxId (로컬)');
  if(!(listM && consts.every(Boolean) && fns.every(Boolean))){ say('  · 함수가 없어 실행 판정을 건너뜀'); }
  else {
  const env = { store:{}, played:[], focus:true, open:true, active:'input', now:1000,
    items:[1,2,3].map(n => ({ dataset:{ sfx:String(n) }, k:{ textContent:'' } })), tgChk:{ textContent:'' }, note:{ textContent:'' }, office:false, list:{ style:{ display:'' } } };
  const run = new Function('env', `
    const localStorage = { getItem:k => (k in env.store ? env.store[k] : null), setItem:(k,v)=>{ env.store[k]=String(v); } };
    const Date = { now:()=>env.now };
    env.tg = { title:'', cls:new Set(), classList:{ toggle:(c,v)=> v ? env.tg.cls.add(c) : env.tg.cls.delete(c) },
               querySelector:q => q === '.chk' ? env.tgChk : env.note };
    const _og = { get officeMode(){ return env.office; } };
    const ov = { style:{ display: '' }, contains:a => a === 'input' };
    const document = {
      hasFocus:()=>env.focus, get activeElement(){ return env.active; }, body:'body',
      getElementById:id => id==='chatOverlay' ? (ov.style.display = env.open ? 'block' : 'none', ov)
                        : id==='chatSfxToggle' ? env.tg
                        : id==='chatSfxList' ? env.list : null,
      querySelectorAll:()=>env.items.map(it => ({ dataset:it.dataset, querySelector:()=>it.k }))
    };
    ${listM ? listM[0].replace(/srcs:\[[^\]]*\]/g, 'srcs:[]') : ''}
    ${consts.join('\n')}
    let _chatSfxLast = 0;
    const _chatSfxPools = {}; CHAT_SFX_LIST.forEach(x=>{ _chatSfxPools[x.id] = { play:()=>env.played.push(x.id) }; });
    ${fns.join('\n').replace(/!!officeMode/, '!!_og.officeMode')}
    return { _chatSfxOn, _chatSfxId, _setChatSfxOn, _setChatSfxId, _applyChatSfxUI, _chatNotifyIncoming };`);
  const A = run(env);
  chk(A._chatSfxOn() === true && A._chatSfxId() === 1, '처음 쓰는 사람: 켜짐 · 알림음 1');
  env.store['tw.chatSfxId'] = '9';
  chk(A._chatSfxId() === 1, '  목록에 없는 id 가 저장돼 있으면 기본값으로');
  env.open = true; env.focus = true; env.active = 'input'; A._chatNotifyIncoming();
  chk(env.played.length === 0, '★ 대화창이 열려 있고 입력칸에 커서 — 안 울린다');
  env.focus = false; env.active = 'body'; env.now += 1000; A._chatNotifyIncoming();
  chk(env.played.length === 0, '★ 대화창이 열려 있으면 앱 포커스가 없어도 안 울린다');
  env.open = false; env.now += 1000; A._chatNotifyIncoming();
  chk(env.played.length === 1 && env.played[0] === 1, '★ 대화창이 닫혀 있으면 고른 소리(1)가 울린다');
  env.now += 100; A._chatNotifyIncoming();
  chk(env.played.length === 1, '  250ms 안에 또 오면 한 번만');
  env.focus = true; env.active = 'input'; env.now += 1000; A._chatNotifyIncoming();
  chk(env.played.length === 2, '  닫혀 있으면 포커스 상태와 무관하게 울린다');
  env.open = false;
  A._setChatSfxId(3); env.now += 1000; A._chatNotifyIncoming();
  chk(env.played[env.played.length - 1] === 3 && env.store['tw.chatSfxId'] === '3', '★ 고른 소리(알림음 3)로 바뀌고 저장된다');
  chk(env.items.map(i => i.k.textContent).join('') === '○○●', '  메뉴 표시 ○○●');
  A._setChatSfxOn(false); const n = env.played.length; env.now += 1000; A._chatNotifyIncoming();
  chk(env.played.length === n && env.store['tw.chatSfx'] === '0', '★ 꺼짐 — 안 울리고 저장된다');
  chk(env.list.style.display === 'none' && env.tgChk.textContent === '', '★ 꺼짐 — 소리 목록이 사라지고 ✓ 가 빠진다 (시안 B)');
  A._setChatSfxOn(true);
  chk(env.list.style.display === '' && env.tgChk.textContent === '✓', '  켜짐 — 목록이 돌아오고 ✓');
  env.office = true; A._applyChatSfxUI(); const m = env.played.length; env.open = false; env.now += 1000; A._chatNotifyIncoming();
  chk(env.tgChk.textContent === '' && env.list.style.display === 'none' && env.tg.cls.has('locked') && env.note.textContent === '회사원 모드',
      '★ 🏢 회사원 모드 — «꺼짐» 으로 보인다(✓ 없음 · 목록 숨김 · 흐림 · «회사원 모드»)');
  chk(env.played.length === m && env.store['tw.chatSfx'] === '1', '★ 🏢 울리지 않고, 저장값(켜짐)은 그대로다');
  env.office = false; A._applyChatSfxUI();
  chk(env.tgChk.textContent === '✓' && !env.tg.cls.has('locked') && env.note.textContent === '', '  🏢 모드를 끄면 원래 선택(켜짐)으로 돌아온다');
  }
}

say('── 2. 소리 풀');
{
  chk(/CHAT_SFX_LIST\.forEach\(x=>\{ _chatSfxPools\[x\.id\] = _mkSndPool\(/.test(SRC), '★ 풀은 _mkSndPool 로 만든다 (새 Audio 를 직접 만들지 않는다)');
  const poolAt = SRC.indexOf('_chatSfxPools[x.id] = _mkSndPool('), primeAt = SRC.indexOf("['pointerdown','keydown'].forEach(ev=>window.addEventListener(ev, ()=>{");
  chk(poolAt > 0 && primeAt > poolAt, '★ 자동재생 잠금 해제(prime, once) 등록보다 **먼저** 만든다');
  const sfxFns = grabFn('_chatNotifyIncoming') + grabFn('_chatSfxPreview');
  chk(!/new Audio/.test(sfxFns), '  알림음 함수 안에 new Audio 가 없다');
  const play = /P\.play = function\(\)\{[\s\S]*?\n  \};/.exec(SRC);
  chk(!!play && /officeMode/.test(play[0]), '★ 회사원 모드 게이트는 풀의 play 안 — 미리듣기까지 같은 규칙');
  const lst = (/const CHAT_SFX_LIST = \[[\s\S]*?\];/.exec(SRC) || [''])[0];
  chk([1,2,3].every(n => lst.indexOf("'parts/chat-notify-" + n + ".mp3', 'chat-notify-" + n + ".mp3'") >= 0), '  파일 경로 폴백 [parts/…, …] 세 벌');
  const have = [1,2,3].filter(n => fs.existsSync('chat-notify-' + n + '.mp3'));
  if(have.length) chk(have.length === 3, '  mp3 세 개가 app/parts 에 있다 [' + have.length + '/3]');
  else say('  · mp3 파일은 이 폴더에 없어서 건너뜀(저장소 러너는 app/parts 를 펼친다)');
}

say('── 3. 울리는 자리');
{
  const calls = SRC.split('_chatNotifyIncoming()').length - 1;
  chk(calls === 2, '★ 호출은 정의 1 + 부르는 자리 1 뿐 [' + calls + ']');
  const recv = (SRC.match(/const chat=friends\[id\]\.chat;[\s\S]*?\n    \}/) || [''])[0];
  chk(/_chatShown = true;[\s\S]*_chatShown = true;[\s\S]*if\(_chatShown && typeof _chatNotifyIncoming === 'function'\) _chatNotifyIncoming\(\);/.test(recv),
      '★ 상대 채팅 수신 분기에서, 날리기·말풍선이 **실제로 뜬 경우에만** 부른다');
  const sub = SRC.indexOf('firebaseAPI.subscribeChatLog(room');
  chk(sub > 0 && !/_chatNotifyIncoming/.test(SRC.slice(sub, sub + 300)), '  chatLog 구독에는 걸지 않았다 (한 줄에 두 번 울림 방지)');
  const send = grabFn('sendMyChat');
  chk(!!send && !/_chatNotifyIncoming|_chatSfx/.test(send), '  내가 보내는 자리(sendMyChat)에는 없다');
  chk(/_applyChatSfxUI\(\);\s*\/\/ 🔔/.test(SRC), '  대화창 배선 때 저장된 상태를 메뉴에 반영한다');
  const offT = SRC.slice(SRC.indexOf("document.getElementById('progOfficeModeToggle').onclick"), SRC.indexOf("document.getElementById('progOfficeModeToggle').onclick") + 6000);
  chk(/_applyChatSfxUI\(\)/.test(offT), '★ 🏢 회사원 모드를 켜고 끌 때 알림음 표시를 다시 그린다');
  const tgl = (SRC.match(/if\(sfxTg\) sfxTg\.addEventListener\('click'[\s\S]*?\n    \}\);/) || [''])[0];
  chk(/_chatSfxOfficeLock\(\)[\s\S]*return;[\s\S]*_setChatSfxOn/.test(tgl), '  🏢 잠긴 동안 눌러도 저장값을 안 바꾼다');
}

say('── 4. HTML');
{
  const dd = (HTML.match(/<div class="chat-dropdown" id="chatViewDropdown">[\s\S]*?\n        <\/div>\n      <\/div>/) || [''])[0];
  chk(dd.length > 0, '#chatViewDropdown 을 찾았다');
  const win = HTML.slice(HTML.indexOf('<div id="chatWindow">'), HTML.indexOf('<div class="chat-memberbar">'));
  chk(win.indexOf('id="chatFsSub"') > 0 && win.indexOf('id="chatSfxList"') > 0, '★ 서브메뉴·소리 목록이 #chatWindow 안에 있다 (클릭 통과 화이트리스트)');
  const ids = [...dd.matchAll(/data-sfx="(\d+)"/g)].map(m => +m[1]);
  chk(ids.join() === '1,2,3', '  data-sfx 1·2·3 = CHAT_SFX_LIST id');
  chk((dd.match(/class="chat-sfx-pv"/g) || []).length === 3, '  ▷ 미리듣기 셋');
  const htmlLabels = [...dd.matchAll(/data-sfx="\d+"><span class="chk"><\/span>([^<]+)</g)].map(m => m[1]).join('/');
  const srcLabels  = [...((/const CHAT_SFX_LIST = \[[\s\S]*?\];/.exec(SRC) || [''])[0]).matchAll(/label:'([^']+)'/g)].map(m => m[1]).join('/');
  chk(htmlLabels === '알림음 1/알림음 2/알림음 3' && srcLabels === htmlLabels, '  메뉴 이름 알림음 1·2·3 = CHAT_SFX_LIST label [' + htmlLabels + ']');
  const fs4 = [...dd.matchAll(/data-fs="(\d+)"/g)].map(m => +m[1]);
  chk(fs4.join() === '11,12,14,16' && /CHAT_FONT_ALLOWED = \[11, 12, 14, 16\]/.test(SRC), '  글자 크기 4단 그대로 (CHAT_FONT_ALLOWED 와 같다)');
  const subAt = dd.indexOf('id="chatFsSub"'), fsAt = dd.indexOf('data-fs="11"');
  chk(dd.indexOf('id="chatFsMenu"') < subAt && subAt < fsAt, '★ 4단은 «글자 크기 ▶» 줄의 **자식** 서브메뉴 안에 있다');
  chk(!/chat-dropdown-label">글자 크기/.test(dd), '  옛 평평한 «글자 크기» 소제목은 없다');
  chk(/\.chat-has-sub:hover > \.chat-submenu/.test(HTML) && /\.chat-submenu\{display:none;position:absolute;left:100%;/.test(HTML),
      '★ :hover 로 열리고 left:100% 로 틈 없이 붙는다');
  chk(/\.chat-submenu\{[^}]*border-radius:var\(--win-radius-el\) !important/.test(HTML), '  서브메뉴 베젤에 --win-radius-el (버블 테마)');
  chk(!/class="[^"]*\bfly\b/.test(dd) && !/\.chat-(submenu|sfx|has-sub)[\w-]*fly/.test(HTML), '  새 클래스에 fly 이름을 안 썼다 (날리기 전역 .fly)');
}

say(`\n결과: ${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
