/* 마당 해금 · 입장 화면 채널 고르기 — 순수 로직만 굴린다 (DOM 없음) */
let fail=0; const say=console.log;
const chk=(c,m)=>{ if(!c) fail++; say((c?'  ✓ ':'  ✗ ')+m); };

/* ── 마당 ── */
const LOT=5, YARD_HOURS=500, CAP_HOURS=999;
const STAGES=[{n:'4 × 5',hw:2,hh:2},{n:'6 × 8',hw:2,hh:3},{n:'8 × 10',hw:3,hh:4}];
const lotHouseBox=st=>({x:Math.floor((LOT-st.hw)/2),y:LOT-1-st.hh,w:st.hw,h:st.hh});
const signBox=()=>({x:Math.floor((LOT-2)/2),y:LOT-1,w:2,h:1});
const inBox=(b,x,y)=>x>=b.x&&x<b.x+b.w&&y>=b.y&&y<b.y+b.h;
const isYard=(st,x,y)=>!inBox(lotHouseBox(st),x,y)&&!inBox(signBox(),x,y);
const yardCells=st=>{let n=0;for(let y=0;y<LOT;y++)for(let x=0;x<LOT;x++)if(isYard(st,x,y))n++;return n;};
const open=(h,st)=>h>=YARD_HOURS&&st===STAGES.length-1;

say('【1】 마당 해금 조건 — 시간 AND 평수 최대');
chk(!open(0,2),           '0시간 · 최대평수 → 잠김');
chk(!open(499,2),         '499시간 → 잠김 (1시간 모자라도 안 열린다)');
chk( open(500,2),         '500시간 · 최대평수 → 열림');
chk(!open(620,1),         '620시간인데 평수가 최대가 아니면 잠김');
chk(!open(999,0),         '999시간이어도 평수 최소면 잠김');
chk( open(999,2),         '999시간(누적 상한) · 최대평수 → 열림');
say('');
say('【2】 1000시간이 아닌 이유');
chk(YARD_HOURS<=CAP_HOURS, 'YARD_HOURS('+YARD_HOURS+') ≤ 누적 상한('+CAP_HOURS+') — 도달 가능하다');
chk(!(1000<=CAP_HOURS),    '1000시간으로 걸면 상한 999를 넘어 아무도 도달 못 한다');
say('');
say('【3】 마당 칸수 — 평수를 올리면 마당이 줄어든다');
STAGES.forEach((st,i)=>say('  '+st.n+' → 마당 '+yardCells(st)+'칸'+(i===2?'  ← 해금 대상':'')));
chk(yardCells(STAGES[2])===11, '최대 평수에서 11칸 (25 − 집 12 − 간판 2)');
chk(yardCells(STAGES[0])>yardCells(STAGES[2]), '집이 작을 때 여백이 더 크다 — 그래서 「최대 평수」 조건이 필요하다');
say('');

/* ── 입장 화면 ── */
const CH_CAP=60, MY_CH=1;
let CHANNELS=[{no:1,now:24},{no:2,now:9}];
const chFull=c=>c.now>=CH_CAP;
const canEnter=c=>!chFull(c)||c.no===MY_CH;
let pickCh=MY_CH;
function settle(){ const pc=CHANNELS.find(x=>x.no===pickCh); if(!pc||!canEnter(pc)) pickCh=MY_CH; return pickCh; }

say('【4】 채널 고르기');
pickCh=2; chk(settle()===2, '여유 있는 2채널을 고를 수 있다');
CHANNELS[1].now=60;
chk(settle()===1, '2채널이 만원이 되면 내 집 채널(1)로 되돌아간다');
CHANNELS[0].now=60; pickCh=1;
chk(settle()===1, '★ 내 집 채널은 만원이어도 고를 수 있다 — 자기 집에 못 들어가는 것이 최악이다');
chk(canEnter(CHANNELS[0])&&!canEnter(CHANNELS[1]), '만원 판정은 내 집만 예외');
say('');
say('【5】 룸메이트 정원');
const CREW_MAX=3, LIC=500, LOTS=192, FEE=22000/12, COST=199373;
const homes=Math.ceil(LIC/CREW_MAX), rev=homes*FEE;
say('  최대 '+CREW_MAX+'인 → 최악 '+homes+'채 필요 · 분양률 '+Math.round(homes/LOTS*100)+'%');
chk(homes<=LOTS, '필요 집수가 부지 '+LOTS+'개 안에 든다');
chk((rev-COST)/rev>=0.20, '만석 이익률 '+((rev-COST)/rev*100).toFixed(1)+'% ≥ 20%');
const h8=Math.ceil(LIC/8), r8=h8*FEE;
chk((r8-COST)/r8<0.20, '8인이면 '+h8+'채뿐이라 '+((r8-COST)/r8*100).toFixed(1)+'% — 20% 미달');
say('');
if(fail){ say('문제 '+fail+'건'); process.exit(1); }
say('전부 통과 ✅');
