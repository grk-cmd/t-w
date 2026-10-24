/* ═══ 🎁 sim-mallang-gift.js — 말랑이 선물 보내기 · 그림 사본 ═══════════════════════
   [무엇을 지키나] sendMallangGift 는 보낼 그림을 받아 선물 전용 경로로 다시 올린다. 받기가 404 · 오류 페이지 · 빈 응답이면
     그것을 그림처럼 올리지 않고 원본 주소를 그대로 보낸다(받은 사람 칸이 깨진 그림이 되지 않게).
   ・1절: 가짜 SDK · fetch 위에서 실제로 돌린다 — 그림이면 사본 주소 · 404 / html / 빈 응답 / 받기 실패면 원본 주소 · 늘 전송은 된다
   ・2절: 일부러 깨 보기 — 거르는 줄을 빼면 빨강
   [실행] firebase-init.js 가 있는 폴더에서. */
'use strict';
const fs = require('fs');
const FB = fs.readFileSync('firebase-init.js', 'utf8');

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
/* `async name(args){ … },` 메서드 본문을 중괄호 짝으로 뗀다 */
function grabMethod(src, name){
  const i = src.indexOf('\n    async ' + name + '(');
  if(i < 0) return null;
  let k = src.indexOf('{', i), d = 0;
  for(; k < src.length; k++){ if(src[k] === '{') d++; else if(src[k] === '}' && --d === 0) return src.slice(i + 5, k + 1); }
  return null;
}

const ORIG = 'https://example.test/mallang.png';
/* 응답 하나로 보내 보고 실제로 쓴 imgUrl 과 올린 횟수를 돌려준다 */
async function send(method, resp){
  const writes = [], ups = [];
  const env = {
    push: () => ({ key: 'g1' }), ref: (_db, p) => p, db: {},
    set: async (_r, v) => { writes.push(v); },
    runTransaction: async () => {},
    _uploadDataUrlIfNeeded: async (p, d) => { ups.push(p); return 'https://store.test/' + p; },
    fetch: async () => { if(resp === 'throw') throw new Error('net'); return { ok: resp.ok, blob: async () => ({ size: resp.size, type: resp.type }) }; },
    FileReader: function(){ this.readAsDataURL = () => { this.result = 'data:image/png;base64,AA'; this.onload(); }; },
  };
  const api = new Function(...Object.keys(env), 'return {' + method + '};')(...Object.values(env));
  const r = await api.sendMallangGift('uA', 'A', 'uB', ORIG, '2026-10-24', '');
  return { r, url: writes[0] && writes[0].imgUrl, ups: ups.length };
}
async function judge(method){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  if(!method){ t(false, 'firebase-init.js 에서 sendMallangGift 를 못 찾음'); return r; }
  try{
    const img = await send(method, { ok: true, size: 120, type: 'image/png' });
    const nf = await send(method, { ok: false, size: 60, type: 'image/png' });
    const html = await send(method, { ok: true, size: 900, type: 'text/html' });
    const empty = await send(method, { ok: true, size: 0, type: 'image/png' });
    const net = await send(method, 'throw');
    t(img.r.ok && img.ups === 1 && img.url === 'https://store.test/users/uB/giftimg/g1.png', '★ 그림이면 — 선물 전용 경로에 사본을 올리고 그 주소를 보낸다');
    t(nf.r.ok && nf.ups === 0 && nf.url === ORIG, '★ 404 — 올리지 않고 원본 주소(전송은 된다)');
    t(html.r.ok && html.ups === 0 && html.url === ORIG, '  그림이 아닌 응답(오류 페이지) — 원본 주소');
    t(empty.r.ok && empty.ups === 0 && empty.url === ORIG, '  빈 응답 — 원본 주소');
    t(net.r.ok && net.ups === 0 && net.url === ORIG, '  받기 실패 — 원본 주소(예전과 같다)');
  }catch(e){ t(false, '보내 보다 던짐 — ' + String(e.message || e).slice(0, 80)); }
  return r;
}

(async () => {
  const M = grabMethod(FB, 'sendMallangGift');
  say('── 1. 보내 본다');
  (await judge(M)).forEach(([ok, msg]) => chk(ok, msg));
  say('── 2. 일부러 깨 보기');
  const breaks = [
    ['거르는 줄 없음', m => m.replace(/\n[^\n]*if\(!res\.ok \|\| !blob[^\n]*/, '')],
    ['응답 코드를 안 봄', m => m.replace('!res.ok || ', '')],
    ['종류를 안 봄', m => m.replace(" || !/^image\\//.test(blob.type || '')", '')],
  ];
  for(const [name, fm] of breaks){
    const m2 = M ? fm(M) : M;
    const rows = m2 && m2 !== M ? await judge(m2) : [[true, '']];
    chk(m2 !== M && rows.some(([ok]) => !ok), name + (m2 !== M ? '' : ' — 바꿀 글을 못 찾음'));
  }
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
