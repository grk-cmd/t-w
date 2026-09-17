/* ═══ 🎁 sim-deco-parts.js — 꾸미기 파츠 표시 켜짐/꺼짐 (2026-09-17 요청 · 시안 확정) ═══════════════════════
   [무엇을 지키나] 설정 › 캐릭터 › «좌석 크기 평준화» 아래 «꾸미기 파츠 표시». 끄면 **내 화면에서만** 나 포함 전 좌석의
     꾸미기 파츠(캐릭터에 붙는 wrapper)가 안 보인다. 책상 위(bone:'desk') 카테고리는 그대로. 서버에 안 쓴다.
   ・1절: 상태·저장(tw.decoParts, 기본 켜짐) · 판정 함수를 실제로 돌린다(책상 위만 예외 · 가짜 좌석 traverse).
   ・2절: applyClothVisibility — 꺼짐이면 «파츠 없음» 으로 hides 를 계산한다(모자만 사라진 대머리 방지) · wrapper 적용이 그 안에 있다.
   ・3절: 토글 배선(전 좌석 재적용 · 서버 쓰기 없음) · refreshToggleBtns · HTML 행 위치(평준화 바로 아래).
   [실행] app.js · desk-companion-prototype.html 이 있는 폴더에서. */
'use strict';
const fs = require('fs');
const SRC  = fs.readFileSync('app.js', 'utf8');
const HTML = fs.readFileSync('desk-companion-prototype.html', 'utf8');

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const grabFn = (name) => { const i = SRC.indexOf('function ' + name + '('); if(i < 0) return ''; let k = SRC.indexOf('{', i), d = 0; for(; k < SRC.length; k++){ if(SRC[k] === '{') d++; else if(SRC[k] === '}' && --d === 0) return SRC.slice(i, k + 1); } return ''; };

say('── 1. 상태 · 판정 함수');
{
  chk(/let decoPartsVisible = true;/.test(SRC) && /localStorage\.getItem\('tw\.decoParts'\) !== '0'/.test(SRC), '기본 켜짐 · tw.decoParts 로 저장(내 화면 전용)');
  const show = grabFn('_decoWrapperShow'), apply = grabFn('applyDecoPartsVisibility');
  chk(!!show && !!apply, '_decoWrapperShow · applyDecoPartsVisibility 가 있다');
  const env = { vis: null };
  const run = new Function('env', show + '\n' + apply +
    "\nconst PART_CATS=[{cat:'hat',bone:'head'},{cat:'wing',bone:'spine'},{cat:'deskitem',bone:'desk'}];" +
    "const isDeskPartCat=(info)=>!!(info&&info.bone==='desk');" +
    "return (v, seat)=>{ decoPartsVisible = v; applyDecoPartsVisibility(seat); return seat; };")(env);
  const mk = (cat, extra) => ({ visible: true, userData: extra ? {} : { __twPartWrap: true, cat } });
  const seat = () => { const w = [mk('hat'), mk('wing'), mk('deskitem'), mk('hat', true), { visible: true, userData: {} }]; return { group: { traverse: (f) => w.forEach(f) }, w }; };
  let s = run(false, seat());
  chk(s.w[0].visible === false && s.w[1].visible === false, '★ 꺼짐: 모자·날개 wrapper 숨김');
  chk(s.w[2].visible === true, '★ 꺼짐이어도 책상 위(deskitem) 는 보인다 — 책상 아이템은 요청 범위 밖');
  chk(s.w[3].visible === true && s.w[4].visible === true, '  표식 없는 오브젝트(본체 메시·동물 귀)는 안 건드린다');
  s = run(true, seat());
  chk(s.w.every(o => o.visible === true), '  켜짐: 전부 보인다');
  /* 꺼진 채 좌석을 다시 만들어도(wrapper 새로 생김) 같은 함수가 다시 지나가므로 숨긴다 — 2절이 그 자리를 본다. */
}

say('── 2. applyClothVisibility — 꺼짐이면 파츠 없음으로 센다');
{
  const f = strip(grabFn('applyClothVisibility'));
  chk(/applyDecoPartsVisibility\(seat\);/.test(f), '★ wrapper 적용이 applyClothVisibility 안에 있다(부착·해제·재조립 뒤 늘 지나는 자리)');
  chk(/const eq = \(decoPartsVisible \? \(seat\.charDef && seat\.charDef\.equippedParts\) : null\) \|\| \{\};/.test(f), '★ 꺼짐이면 eq = {} — 파츠가 숨기던 기본 메시(머리카락·상의)가 돌아온다');
  chk(f.indexOf('applyDecoPartsVisibility') < f.indexOf('const eq ='), '  wrapper 적용이 hides 계산보다 먼저');
  /* 부착 함수 끝에서 applyClothVisibility 를 부르는 기존 줄이 살아 있다 — 새 wrapper 도 같은 길로 숨는다 */
  chk(/_sweepOrphanPartWrappers\(seat\);[\s\S]{0,200}applyClothVisibility\(seat\);/.test(strip(SRC)), '  부착 끝에서 applyClothVisibility 를 부른다(기존 줄) — 새로 붙는 파츠도 설정을 따른다');
}

say('── 3. 토글 · 버튼 · HTML');
{
  const code = strip(SRC);
  const i = code.indexOf("document.getElementById('fsDecoPartsToggle');\n  if(dpBtn) dpBtn.onclick");
  const t = code.slice(i, i + 500);
  chk(i >= 0 && /decoPartsVisible = !decoPartsVisible;/.test(t) && /localStorage\.setItem\('tw\.decoParts'/.test(t), '토글: 뒤집고 저장');
  chk(/seats\.forEach\(s => applyClothVisibility\(s\)\)/.test(t), '★ 전 좌석(나·친구·추가 좌석)에 바로 적용');
  chk(!/firebaseAPI|Presence\./.test(t), '  서버 쓰기 없음(내 화면 전용)');
  chk(/fsDecoPartsToggle'\);\s*if\(dpBtn\)\{ dpBtn\.textContent = decoPartsVisible\?'켜짐':'꺼짐'/.test(code), '  refreshToggleBtns 가 켜짐/꺼짐을 그린다');
  const a = HTML.indexOf('id="fsSeatEqToggle"'), b = HTML.indexOf('id="fsDecoPartsToggle"');
  chk(a >= 0 && b > a && b - a < 600, '★ HTML: «좌석 크기 평준화» 바로 아래');
  chk(/<span>꾸미기 파츠 표시<\/span>/.test(HTML) && /id="fsDecoPartsToggle"[^>]*>켜짐</.test(HTML), '  이름 «꾸미기 파츠 표시» · 기본 켜짐');
  chk(/끄면 내 화면에서만 나와 상대의 꾸미기 파츠가 안 보여요/.test(HTML), '  안내 한 줄(시안)');
}

say('\n결과: 통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
