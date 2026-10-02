/* ═══ 🫧 sim-away-follow.js — 자리비움 그림 자리 · 비행 (2026-10-02 제보 셋) ═══════════════════════════════════
   [제보] ① 머리 위에 올린(올라탄) 자리비움 그림이 연 날리는 것처럼 한참 떠 있다.
          ② 가끔 그림이 자기 자리에서 옆으로 벗어나 있다.
          ③ 자리비움인 사람을 💣 로 날리면 그림이 버벅이며 날아간다.
   [고침] ① 아래 캐릭터 꼭대기를 «맨 머리» 측정(measureHeadBoxNoParts)으로 — 모자·숨은 장식·바인드포즈 파츠가 안 끼게.
          ② 가로·앞뒤는 상자 가운데가 아니라 rig 원점(발밑 피봇) · 월드 목표점을 group 로컬로 **역변환**(group 이 돌아도 맞게).
          ③ 비행 중엔 다시 재지 않고, 잴 때 남긴 rig 기준 오프셋(_awayOff)으로 **매 프레임** rig 를 따라간다.
   ・1절: 배선(정적) — sim-fix-0923 이 지키는 옛 줄과 나란히 새 줄이 있는가.
   ・2절: _awayImgFollow 동작 — 날아가는 동안 매 프레임 붙어 간다 · 숨은 그림 · 오프셋 없는 좌석은 안 건드린다.
   ・3절: _awayImgFrame 동작 — 작은 THREE 흉내로 «group 이 돈 좌석» · «상자 가운데가 옆으로 끌린 좌석» · «모자 쓴 아래 캐릭터» 를 재 본다.
   [실행] app.js 가 있는 폴더에서. */
'use strict';
const fs = require('fs');
const SRC = fs.readFileSync('app.js', 'utf8');

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const grabFn = (name) => { const i = SRC.indexOf('function ' + name + '('); if(i < 0) return ''; let k = SRC.indexOf('{', i), d = 0; for(; k < SRC.length; k++){ if(SRC[k] === '{') d++; else if(SRC[k] === '}' && --d === 0) return SRC.slice(i, k + 1); } return ''; };
const CODE = strip(SRC);
const FR = strip(grabFn('_awayImgFrame'));
const FO = strip(grabFn('_awayImgFollow'));

say('── 1. 배선');
{
  chk(!!FR && !!FO, '_awayImgFrame · _awayImgFollow 를 찾았다');
  chk(/\(\(now - seat\._awayFitAt\) > 500 && !seat\.fly\)/.test(FR), '★ 비행 중엔 다시 재지 않는다(도는 몸을 재면 크기·가운데가 튄다)');
  chk(/seat\.rig\.getWorldPosition\(_rw\); cx = _rw\.x; cz = _rw\.z;/.test(FR), '② 가로·앞뒤 = rig 원점(상자 가운데 아님)');
  chk(/measureHeadBoxNoParts\(_host\.gltfRoot, null, _host\)/.test(FR) && /if\(_hb && !_hb\.isEmpty\(\)\) _awayHostBox\.copy\(_hb\);/.test(FR), '① 아래 캐릭터 꼭대기 = 맨 머리 측정 · 비면 예전 상자');
  const iOld = FR.indexOf('sp.position.set(cx - _awayGW.x, fy + h/2 - _awayGW.y, cz - _awayGW.z);');
  const iInv = FR.indexOf('seat.group.worldToLocal(_t); sp.position.copy(_t);');
  chk(iOld > 0 && iInv > iOld, '② 옛 줄(sim-fix-0923 이 지킴) **뒤에서** group 로컬 역변환으로 덮어쓴다');
  chk(/seat\._awayOff\.copy\(sp\.position\)\.sub\(seat\.rig\.position\);/.test(FR) && FR.indexOf('_awayOff.copy') > iInv, '③ 오프셋은 최종 위치에서 잰다');
  const iFly = CODE.indexOf('_updateFlyingSeats(now, dt);'), iFol = CODE.indexOf('_awayImgFollow(); }catch(_){}');
  chk(iFly > 0 && iFol > iFly && iFol - iFly < 300, '★ 매 프레임 _updateFlyingSeats **바로 뒤**에서 따라간다(이번 프레임 비행 좌표)');
  chk(!/rig\.add\(sp\)|rig\.add\(seat\._awaySprite\)/.test(CODE), '그림을 rig 자식으로 옮기지 않는다(비행 스핀을 같이 받아 발을 축으로 돈다)');
}

/* ── 작은 THREE 흉내 — 이 검사가 쓰는 것만 ───────────────────────────── */
class V3 { constructor(x=0,y=0,z=0){ this.x=x; this.y=y; this.z=z; }
  set(x,y,z){ this.x=x; this.y=y; this.z=z; return this; } copy(v){ this.x=v.x; this.y=v.y; this.z=v.z; return this; }
  add(v){ this.x+=v.x; this.y+=v.y; this.z+=v.z; return this; } sub(v){ this.x-=v.x; this.y-=v.y; this.z-=v.z; return this; } }
class Box { constructor(){ this.min=new V3(Infinity,Infinity,Infinity); this.max=new V3(-Infinity,-Infinity,-Infinity); }
  setFromObject(o){ const b=o.__box; this.min.copy(b.min); this.max.copy(b.max); return this; }
  copy(b){ this.min.copy(b.min); this.max.copy(b.max); return this; } isEmpty(){ return this.max.x < this.min.x; } }
const box = (x0,y0,z0,x1,y1,z1) => { const b=new Box(); b.min.set(x0,y0,z0); b.max.set(x1,y1,z1); return b; };
/* group: 월드 위치 p · Y축 회전 ry. worldToLocal = R⁻¹(v − p) */
const mkGroup = (p, ry=0) => ({ p, ry, updateMatrixWorld(){}, getWorldPosition(o){ return o.copy(this.p); },
  worldToLocal(v){ const dx=v.x-this.p.x, dy=v.y-this.p.y, dz=v.z-this.p.z, c=Math.cos(-this.ry), s=Math.sin(-this.ry);
    v.x = c*dx + s*dz; v.y = dy; v.z = -s*dx + c*dz; return v; },
  localToWorld(v){ const c=Math.cos(this.ry), s=Math.sin(this.ry), x=c*v.x + s*v.z, z=-s*v.x + c*v.z; v.x=x+this.p.x; v.y+=this.p.y; v.z=z+this.p.z; return v; } });
const near = (a, b, e=1e-6) => Math.abs(a-b) < e;

say('── 2. _awayImgFollow — 날아가는 동안 매 프레임');
{
  const seats = [];
  const follow = new Function('seats', grabFn('_awayImgFollow') + '\nreturn _awayImgFollow;')(seats);
  const mk = (vis, off) => ({ rig:{ position:new V3(0,0,0) }, _awayOff: off ? new V3(0.1, 1.2, -0.05) : null, _awaySprite:{ visible:vis, position:new V3(9,9,9) } });
  const A = mk(true, true), B = mk(false, true), C = mk(true, false);
  seats.push(A, B, C, null);
  let ok = true;
  for(let f = 1; f <= 60; f++){                     // 1초 비행 — 매 프레임 rig 가 포물선으로 움직인다
    A.rig.position.set(f*0.07, 0.04*f - 0.0006*f*f, f*0.01);
    follow();
    const sp = A._awaySprite.position, r = A.rig.position;
    if(!(near(sp.x, r.x + 0.1) && near(sp.y, r.y + 1.2) && near(sp.z, r.z - 0.05))) ok = false;
  }
  chk(ok, '★ 60프레임 내내 그림 = rig + 오프셋(0.5초마다 순간이동하던 버벅임 없음)');
  chk(B._awaySprite.position.x === 9, '숨은 그림은 안 건드린다');
  chk(C._awaySprite.position.x === 9, '아직 안 잰(오프셋 없는) 좌석은 안 건드린다');
}

say('── 3. _awayImgFrame — 자리 재기');
{
  const env = {};
  const make = new Function('env', 'THREE', `
    var seats = env.seats, _awayTex = env.tex, AWAY_PIC_SCREEN_PX = 150;
    var _awayBox = null, _awayGW = null, _awayHostBox = null, _awayHostP = null, _awayHostS = null;
    function _awayWorldForPx(){ return env.h; }
    function _awayPxFor(){ return 80; }   // 개정 76 — 주인이 고른 크기(60·80·100). 이 검사는 크기를 보지 않는다(env.h 가 정한다)
    function measureHeadBoxNoParts(root){ return root.__head || null; }
    ${grabFn('_awayImgFrame')}
    return _awayImgFrame;
  `);
  const THREE = { Vector3: V3, Box3: Box,
    SpriteMaterial: function(o){ Object.assign(this, o); }, Sprite: function(m){ this.material = m; this.position = new V3(); this.scale = new V3(); this.visible = false; } };
  const tex = new Map([['u', { tex:{} }]]);
  const seatOf = (gp, ry, rigLocal, bodyBox) => {
    const group = mkGroup(gp, ry); group.add = (sp) => { group.child = sp; };
    const rig = { position: rigLocal, updateMatrixWorld(){}, getWorldPosition(o){ return group.localToWorld(o.copy(rigLocal)); }, __box: bodyBox };
    return { group, rig, bodyWrap: { __box: bodyBox } };
  };
  const world = (seat) => seat.group.localToWorld(new V3().copy(seat._awaySprite.position));

  /* (a) 바닥 — 상자가 한쪽으로 뻗은 파츠 때문에 옆으로 끌린 좌석. 그림은 rig 원점 위에 서야 한다. */
  env.seats = []; env.tex = tex; env.h = 0.8;
  let S = seatOf(new V3(2, 0, 0), 0, new V3(0, 0, 0), box(1.6, 0, -0.2, 3.4, 1.5, 0.2));  // 가운데 x=2.5(옆으로 0.5 끌림)
  env.seats.push(S); let F = make(env, THREE); F(S, 'u', 1000);
  let w = world(S);
  chk(near(w.x, 2) && near(w.z, 0), '② 옆으로 뻗은 파츠가 있어도 그림 가로·앞뒤 = 캐릭터 발밑(rig 원점)');
  chk(near(w.y, 0 + 0.4), '높이는 예전 그대로 — 발밑 + 그림 반');
  chk(S._awaySprite.visible === true && S._awayOff && near(S._awayOff.y, S._awaySprite.position.y - S.rig.position.y), '③ 잴 때 rig 기준 오프셋을 남긴다');

  /* (b) 올라탄 좌석 — group 이 고개 기울기·상대 회전을 받아 90° 돈 상태. 아래 캐릭터는 모자를 써서 상자 꼭대기가 높다. */
  const host = seatOf(new V3(5, 0, 0), 0, new V3(0, 0, 0), box(4.6, 0, -0.3, 5.4, 2.6, 0.3));   // 모자 포함 꼭대기 2.6
  host.gltfRoot = { __head: box(4.7, 1.2, -0.25, 5.3, 1.7, 0.25) };                           // 맨 머리 꼭대기 1.7
  const rider = seatOf(new V3(5.3, 1.7, 0), Math.PI / 2,   // 팔을 걸친 자세라 group 이 상대 가운데에서 0.3 비껴 있다
    new V3(0, 0, 0), box(4.8, 1.4, -0.2, 5.2, 2.4, 0.2));
  rider.ridingOn = host;
  env.seats = [host, rider]; F = make(env, THREE); F(rider, 'u', 1000);
  w = world(rider);
  chk(near(w.y, 1.7 + 0.4), '★ ① 그림 밑변 = 아래 캐릭터 **맨 머리** 꼭대기(모자 2.6 이 아니라 1.7) — 연처럼 뜨지 않는다');
  chk(near(w.x, 5) && near(w.z, 0), '★ ② group 이 90° 돌아 있어도 그림은 아래 캐릭터 정가운데(역변환)');
  /* 같은 좌석을 옛 방식(월드 차만 빼기)으로 놓았다면 어디였나 — 이 검사가 «정말 차이를 잡는지» 확인 */
  const naive = rider.group.localToWorld(new V3(5 - 5.3, 2.1 - 1.7, 0 - 0));
  chk(!(near(naive.x, 5) && near(naive.z, 0)), '(검사 자체 확인) 옛 방식(월드 차만 빼기)이었다면 이 좌석에서 옆으로 비껴났다 — 이 검사가 그 차이를 잡는다');

  /* (c) 아래 캐릭터도 자리비움(몸 숨김 → 맨 머리 측정이 빈 상자) → 예전 상자로 */
  host.gltfRoot = { __head: new Box() };
  F = make(env, THREE); rider._awayFitAt = 0; F(rider, 'u', 2000);
  chk(near(world(rider).y, 2.6 + 0.4), '맨 머리 측정이 비면 예전 상자 꼭대기로 물러선다(그림이 사라지지 않게)');

  /* (c2) 개정 76 — 아래 캐릭터도 자리비움 그림이 보이면 그 그림 윗변 위에 쌓인다(탑 위 그림) */
  host.gltfRoot = { __head: box(4.7, 1.2, -0.25, 5.3, 1.7, 0.25) };
  host._awaySprite = { visible: true, getWorldPosition: (o) => o.set(5, 0.3, 0), getWorldScale: (o) => o.set(0.6, 0.6, 1) };
  F = make(env, THREE); rider._awayFitAt = 0; F(rider, 'u', 3000);
  w = world(rider);
  chk(near(w.y, 0.3 + 0.3 + 0.4) && near(w.x, 5) && near(w.z, 0), '(개정 76) 아래 캐릭터 그림이 보이면 그 그림 윗변 · 가운데에 쌓인다 — 역변환은 그대로');
  delete host._awaySprite;

  /* (d) 비행 중에는 0.5초가 지나도 다시 재지 않는다 */
  S = seatOf(new V3(0, 0, 0), 0, new V3(0, 0, 0), box(-0.4, 0, -0.2, 0.4, 1.5, 0.2));
  env.seats = [S]; F = make(env, THREE); F(S, 'u', 1000);
  const fit0 = S._awayFitAt; S.fly = {}; S.rig.position.set(3, 2, 0); S.rig.__box = box(2, 1, -1, 4, 3, 1);
  F(S, 'u', 1000 + 2000);
  chk(S._awayFitAt === fit0, '★ 비행 중 2초가 지나도 다시 재지 않는다(돌고 있는 몸을 안 잰다)');
  delete S.fly; F(S, 'u', 1000 + 4000);
  chk(S._awayFitAt === 5000, '착지하면 다시 잰다');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
