/* 부지 32개 · 팝업 범위 · 끌어서 깔기 — 순수 로직만 */
let fail=0; const say=console.log;
const chk=(c,m)=>{ if(!c) fail++; say((c?'  ✓ ':'  ✗ ')+m); };

const TW=27, TH=42, TS=32, CH_CAP=40;
const LOTX=[2,7,16,21], LOTY=[1,6,11,16,21,26,31,36];
const AVX=[12,13,14];
const LOTS=[]; LOTY.forEach(ly=>LOTX.forEach(lx=>LOTS.push({x:lx,y:ly})));

say('【1】 부지 32개가 세계 안에 들어가는가');
chk(LOTS.length===32, '부지 '+LOTS.length+'개 (4열 × 8줄)');
const last=LOTS[LOTS.length-1];
chk(last.y+4 <= TH-2, '마지막 부지 아래끝 y='+(last.y+4)+' ≤ 테두리 안쪽 '+(TH-2));
chk(LOTS.every(L=>L.x+3 <= TW-2), '모든 부지가 가로 테두리 안 (폭 4칸)');
chk(LOTS.every(L=>!AVX.some(a=>a>=L.x&&a<L.x+4)), '중앙 대로(12·13·14)를 부지가 밟지 않는다');
/* 부지끼리 겹치지 않는가 */
let overlap=0;
for(let i=0;i<LOTS.length;i++)for(let j=i+1;j<LOTS.length;j++){
  const A=LOTS[i],B=LOTS[j];
  if(A.x<B.x+4&&B.x<A.x+4&&A.y<B.y+5&&B.y<A.y+5) overlap++;}
chk(overlap===0, '부지끼리 안 겹친다 (간판 줄 포함해 5칸 높이)');
chk(!LOTS.some(L=>13>=L.y&&15<L.y+5&&L.x<=14&&12<L.x+4), '분수(12-14, 13-15)와 안 겹친다');
say('');

say('【2】 채널 · 정원');
const CHANNELS=[{no:1,now:14},{no:2,now:11},{no:3,now:9},{no:4,now:7},{no:5,now:4},{no:6,now:2}];
chk(CHANNELS.length===6, '채널 6개');
chk(CH_CAP===40, '정원 40');
chk(LOTS.length*CHANNELS.length===192, '부지 총량 '+LOTS.length*CHANNELS.length+'개');
const tot=CHANNELS.reduce((a,c)=>a+c.now,0);
chk(CHANNELS.every(c=>c.now<CH_CAP), '초기값이 전부 정원 미만 (만원 상태로 시작하지 않는다)');
say('  현재 동접 합 '+tot+'명 · 채널당 평균 '+(tot/6).toFixed(1)+'명  ← 평균 10명 안팎 가정과 맞다');
chk(Math.abs(tot/6-10)<3, '채널당 평균이 10명 안팎');
say('');

say('【3】 팝업 범위 — 집 칸 / 빈 터 칸에서만');
const STAGES=[{hw:2,hh:2},{hw:2,hh:3},{hw:3,hh:4}];
const houseBox=(L,st)=>({ox:L.x+Math.floor((4-st.hw)/2),oy:L.y+(4-st.hh),w:st.hw,h:st.hh});
const inLot=(L,tx,ty)=>tx>=L.x&&tx<L.x+4&&ty>=L.y&&ty<L.y+5;
function popup(L,st,empty,tx,ty){
  if(!inLot(L,tx,ty)) return 'walk';
  if(empty) return ty<L.y+4 ? 'popup' : 'walk';
  const B=houseBox(L,st);
  return (tx>=B.ox&&tx<B.ox+B.w&&ty>=B.oy&&ty<B.oy+B.h) ? 'popup' : 'walk';
}
const L=LOTS[0];                            /* {x:2,y:1} · 부지는 x 2..5, y 1..5 */
[2,0].forEach(si=>{ const B=houseBox(L,STAGES[si]);
  say('  평수 '+(si===2?'최대':'최소')+' → 집 상자 x '+B.ox+'..'+(B.ox+B.w-1)+
      ' · y '+B.oy+'..'+(B.oy+B.h-1)); });
const st=STAGES[2];                         /* 집 3×4 → x 2..4, y 1..4 */
chk(popup(L,st,false,2,1)==='popup', '집 칸(2,1) → 팝업');
chk(popup(L,st,false,4,4)==='popup', '집 칸(4,4) → 팝업 (집이 x 2..4 를 덮는다)');
chk(popup(L,st,false,5,2)==='walk',  '마당(5,2) → 걷기 ← 지나가려는데 팝업이 뜨면 안 된다');
chk(popup(L,st,false,3,5)==='walk',  '간판 줄(3,5) → 걷기');
chk(popup(L,st,true, 3,2)==='popup', '빈 터(3,2) → 팝업');
chk(popup(L,st,true, 3,5)==='walk',  '빈 터의 간판 줄(3,5) → 걷기');
const s0=STAGES[0];                         /* 집 2×2 → x 3..4, y 3..4 */
chk(popup(L,s0,false,3,3)==='popup','작은 집(2×2)의 집 칸(3,3) → 팝업');
chk(popup(L,s0,false,2,1)==='walk', '작은 집일 때 위쪽(2,1)은 마당 → 걷기');
chk(popup(L,s0,false,2,3)==='walk', '작은 집은 가운데로 몰리므로 (2,3)도 마당 → 걷기');
say('  ⚠️ 동네 부지는 폭 4칸이라 최대 평수(집 3칸)에서 마당이 x=5 한 줄뿐이다 —');
say('     집 외관(폭 5칸, 마당 11칸)과 다르다. 마당 배치 전에 통일해야 하는 자리.');
say('');

say('【4】 끌어서 쭉 깔기 — 같은 자리를 두 번 만지지 않는가');
const DOT=16; let placed=[];
const legal=(x,y)=>x>=0&&y>=0&&x<6*DOT&&y<4*DOT&&!placed.some(p=>p.x===x&&p.y===y);
function strokeAcross(pts,mode){
  const seen=new Set(); let acted=0;
  pts.forEach(([x,y])=>{ const k=x+','+y; if(seen.has(k)) return; seen.add(k);
    if(mode==='put'){ if(legal(x,y)){ placed.push({x,y}); acted++; } }
    else { const i=placed.findIndex(p=>p.x===x&&p.y===y); if(i>=0){ placed.splice(i,1); acted++; } }});
  return {acted,seen:seen.size};
}
let pts=[]; for(let i=0;i<5;i++) pts.push([i*DOT,0]);
pts.push([2*DOT,0],[2*DOT,0]);                       /* 같은 자리 재방문 */
let r=strokeAcross(pts,'put');
chk(r.acted===5, '5칸을 끌면 5장 깔린다 (재방문 2회는 무시)');
chk(r.seen===5,  '지나간 자리는 5개로 셈');
r=strokeAcross([[0,0],[1*DOT,0],[9*DOT,0]],'put');   /* 이미 있음 2 + 세계 밖 1 */
chk(r.acted===0, '이미 깐 자리와 밖으로 나가는 자리는 조용히 건너뛴다');
r=strokeAcross([[0,0],[1*DOT,0]],'erase');
chk(r.acted===2 && placed.length===3, '끌어서 치우면 2장이 지워진다 (남은 '+placed.length+'장)');
say('  ★ 끌기 방향은 누른 순간에 정해진다 — 안 그러면 깔다가 첫 장을 지나며 자기가 깐 것을 지운다');
say('');
if(fail){ say('문제 '+fail+'건'); process.exit(1); }
say('전부 통과 ✅');
