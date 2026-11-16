/* ═══ 🫧 sim-away-start.js — 켤 때 자리비움 그림 · 크기를 서버(me.awayImage)에 맞추기 (startAwayPic) ═══════════════
   진짜 room/away-pic.js 의 startAwayPic(me) 를 가짜 저장소 · 가짜 Presence 위에서 불러, 서버 답 모양마다 이 기기의 그림 · 크기가 어떻게 되는지 본다.
   서버 계약(GET /v2/me): awayImage 는 그림이나 크기를 골랐을 때만 있고, 그림 없이 크기만 골랐으면 url 이 없다({ size }).
   ・1절: 그림 + 크기 — 둘 다 서버 값으로(저장소 · 방 알림까지)
   ・2절: 크기만(url 없음) — 이 기기의 옛 그림은 비우고 크기는 서버 값으로
   ・3절: awayImage 없음 — 이 기기의 옛 그림을 비운다(관리자가 내렸거나 다른 기기에서 지움) · 크기는 이 기기 값 그대로
   ・4절: 서버에 크기가 없으면(그림만 · 고른 적 없음) 이 기기 크기를 그대로 둔다 · 같은 값이면 다시 쓰지 않는다 · 모양이 틀린 값(다른 사이트 주소 · 60/80/100 밖)은 받지 않는다
   ・5절: 일부러 깨 보기
   [실행] 러너 스테이징(평면)에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const MOD0 = ['away-pic.js', 'parts/room/away-pic.js', 'app/parts/room/away-pic.js'].map(read).find(Boolean);
if(!MOD0){ console.log('  ? 원본 못 찾음 — away-pic.js'); process.exit(2); }

const URL1 = 'https://firebasestorage.googleapis.com/v0/b/x/o/away%2Fu1%2Fa.png?alt=media';
const URL2 = 'https://firebasestorage.googleapis.com/v0/b/x/o/away%2Fu1%2Fb.png?alt=media';

/* 아무 이름이나 받아 주는 가짜 DOM — 화면 그리기(_awayRenderUI)가 던지지 않게만 */
function anything(){
  const f = function(){ return P; };
  const P = new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? (() => '') : k === 'then' ? (() => P) : k === 'length' ? 0 : P, apply: () => P, construct: () => P, set: () => true, has: () => true });
  return P;
}
/* 이 기기 상태(저장소)로 만들어 startAwayPic 을 부른다 */
function run(src, local, me){
  const any = anything();
  const store = {};
  if(local.url) store['tw.awayImg'] = local.url;
  if(local.size) store['tw.awaySz'] = String(local.size);
  const sets = [];
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); sets.push(['set', k, String(v)]); }, removeItem: (k) => { delete store[k]; sets.push(['remove', k]); } };
  const pres = [];
  const Presence = { setAwayImg: (u) => pres.push(['img', u]), setAwaySz: (p) => pres.push(['sz', p]) };
  const deps = { Presence, _loadImgCors: () => any, _premiumOn: () => true, camera: any, findMySeat: () => null, getMyUserId: () => 'u1', measureBodyBox: () => any, measureHeadBoxNoParts: () => any,
    officeMode: () => false, renderer: any, seats: [], toast: () => {}, userApi: () => any };
  const win = new Proxy({}, { get: (t, k) => k in t ? t[k] : any, set: (t, k, v) => { t[k] = v; return true; } });
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'module', 'TwSafeHtml', 'THREE',
    src + '\nreturn window.TwAwayPic;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, undefined, any, any);
  const m = api.createAwayPic(deps);
  const before = { url: m.awayImgUrl(), sz: m.awayImgSz() };
  sets.length = 0; pres.length = 0;
  m.startAwayPic(me);
  return { m, before, url: m.awayImgUrl(), sz: m.awayImgSz(), store, sets, pres };
}

function judge(src){
  say('── 1. 그림 + 크기');
  {
    const r = run(src, {}, { userCode: 'u1', awayImage: { url: URL1, size: 100 } });
    chk(r.before.url === '' && r.before.sz === 80, '  (처음 이 기기: 그림 없음 · 기본 80)');
    chk(r.url === URL1 && r.sz === 100, '★ 서버의 그림 · 크기가 이 기기 값이 된다');
    chk(r.store['tw.awayImg'] === URL1 && r.store['tw.awaySz'] === '100', '  이 기기 저장소에도 적는다(다음 켤 때 서버가 안 닿아도 같은 모습)');
    chk(JSON.stringify(r.pres) === JSON.stringify([['img', URL1], ['sz', 100]]), '  방에 보이는 값도 맞춘다(그림 → 크기)');
    const r2 = run(src, { url: URL2, size: 60 }, { userCode: 'u1', awayImage: { url: URL1, size: 100 } });
    chk(r2.url === URL1 && r2.sz === 100, '  이 기기에 다른 그림 · 크기가 있어도 서버 값이 이긴다(계정을 따라감)');
  }
  say('── 2. 크기만 고른 계정(url 없음)');
  {
    for(const [label, awayImage] of [['url 키 없음', { size: 60 }], ['url null', { url: null, size: 60 }]]){
      const r = run(src, { url: URL1, size: 100 }, { userCode: 'u1', awayImage });
      chk(r.url === '' && r.sz === 60, '★ ' + label + ' — 이 기기의 옛 그림은 비우고 크기는 서버 값 60');
      chk(!('tw.awayImg' in r.store) && r.store['tw.awaySz'] === '60', '  저장소도 그림은 지우고 크기만 남는다');
      chk(r.pres.some(p => p[0] === 'img' && p[1] === '') && r.pres.some(p => p[0] === 'sz' && p[1] === 60), '  방에 보이는 값도 «그림 없음 · 60»');
    }
  }
  say('── 3. awayImage 없음');
  {
    for(const [label, me] of [['null', { userCode: 'u1', awayImage: null }], ['키 없음', { userCode: 'u1' }]]){
      const r = run(src, { url: URL1, size: 100 }, me);
      chk(r.url === '' && !('tw.awayImg' in r.store), '★ ' + label + ' — 이 기기의 옛 그림을 비운다(서버가 기준 · 관리자가 내렸거나 다른 기기에서 지움)');
      chk(r.sz === 100 && r.store['tw.awaySz'] === '100' && !r.pres.some(p => p[0] === 'sz'), '  크기는 이 기기 값 그대로(서버에 크기가 없다 — 건드리지 않는다)');
    }
    const r0 = run(src, {}, { userCode: 'u1', awayImage: null });
    chk(r0.sets.length === 0 && r0.pres.length === 0, '  이 기기도 비었으면 아무것도 쓰지 않는다');
    const rn = run(src, {}, null);
    chk(rn.url === '' && rn.sz === 80, '  me 가 비어도 던지지 않는다');
  }
  say('── 4. 서버에 크기가 없음 · 같은 값 · 모양이 틀린 값');
  {
    const r = run(src, { url: URL2, size: 100 }, { userCode: 'u1', awayImage: { url: URL1 } });
    chk(r.url === URL1 && r.sz === 100 && !r.pres.some(p => p[0] === 'sz'), '★ 그림만 있고 크기가 없으면 — 그림은 서버 값 · 크기는 이 기기 값 100 그대로');
    const same = run(src, { url: URL1, size: 100 }, { userCode: 'u1', awayImage: { url: URL1, size: 100 } });
    chk(same.sets.length === 0 && same.pres.length === 0, '  서버와 같으면 다시 쓰지 않는다 · 방에도 다시 알리지 않는다');
    for(const bad of [75, '100', 0, null, NaN]){
      const b = run(src, { size: 100 }, { userCode: 'u1', awayImage: { size: bad } });
      chk(b.sz === 100 && !b.pres.some(p => p[0] === 'sz'), '  60 · 80 · 100 이 아닌 크기(' + String(bad) + ')는 받지 않는다 — 이 기기 값 그대로');
    }
    const ev = run(src, { url: URL1 }, { userCode: 'u1', awayImage: { url: 'https://evil.example/a.png', size: 80 } });
    chk(ev.url === '' && !('tw.awayImg' in ev.store), '  우리 저장소 주소가 아닌 그림은 받지 않는다(없는 것으로 본다 — 옛 그림은 비움)');
    const long = run(src, {}, { userCode: 'u1', awayImage: { url: URL1 + 'x'.repeat(500), size: 80 } });
    chk(long.url === '', '  500자를 넘는 주소는 받지 않는다');
  }
}

(function(){
  judge(MOD0);
  say('── 5. 일부러 깨 보기');
  const BREAKS = [
    ["if(srv !== awayImgUrl){ _awaySetLocal(srv); _awayRenderUI(null); }", "", '서버 그림을 이 기기에 안 맞춘다'],
    ["const srv = (a && _awayUrlOk(a.url)) ? a.url : '';", "const srv = (a && _awayUrlOk(a.url)) ? a.url : awayImgUrl;", '서버에 그림이 없어도 이 기기 그림을 둔다'],
    ["if(a && _awaySzOk(a.size) && a.size !== awayImgSz){ _awaySzSetLocal(a.size); _awayRenderUI(null); }", "", '서버 크기를 안 맞춘다'],
    ["if(a && _awaySzOk(a.size) && a.size !== awayImgSz){", "if(!a || a.size !== awayImgSz){", '서버에 크기가 없으면 이 기기 크기를 지운다'],
    ["if(srv !== awayImgUrl){", "if(true){", '같은 값에도 다시 쓴다'],
  ];
  const missed = [];
  for(const [from, to, what] of BREAKS){
    if(MOD0.indexOf(from) < 0){ chk(false, '깨 볼 글을 못 찾음 — ' + what); continue; }
    quiet = true; qfail = 0;
    try{ judge(MOD0.split(from).join(to)); }catch(_){ qfail++; }
    quiet = false;
    if(qfail === 0) missed.push(what);
  }
  chk(!missed.length, '일부러 깨 본 ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — 못 잡음: ' + missed.join(' · ') : ''));
  console.log(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
