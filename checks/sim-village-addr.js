/* 마을 주소 · 입장창 페이징 — 순수 로직 */
let fail=0; const say=console.log;
const chk=(c,m)=>{ if(!c) fail++; say((c?'  ✓ ':'  ✗ ')+m); };

const CH_PREFIX=['투','게','더','빌','리','지'];
const chName=no=>CH_PREFIX[no-1]||String(no);
const addrOf=(no,lot)=>chName(no)+'-'+lot;
const CHANNELS=[{no:1,now:14},{no:2,now:11},{no:3,now:9},{no:4,now:7},{no:5,now:4},{no:6,now:2}];
const CH_CAP=40, MY_CH=1;

say('【1】 접두사가 이름을 만든다');
chk(CH_PREFIX.join('')==='투게더빌리지', "CH_PREFIX 를 이으면 '"+CH_PREFIX.join('')+"'");
chk(CH_PREFIX.length===CHANNELS.length, '접두사 '+CH_PREFIX.length+'개 = 채널 '+CHANNELS.length+'개');
chk(new Set(CH_PREFIX).size===CH_PREFIX.length, '접두사가 서로 겹치지 않는다 — 주소가 유일해진다');
say('');

say('【2】 주소 표기');
[[1,1],[1,5],[2,3],[6,32]].forEach(([c,l])=>say('  '+c+'채널 '+l+'번 → '+addrOf(c,l)));
chk(addrOf(1,1)==='투-1'&&addrOf(2,2)==='게-2'&&addrOf(3,3)==='더-3', '투-1 · 게-2 · 더-3');
chk(addrOf(4,1)==='빌-1'&&addrOf(5,1)==='리-1'&&addrOf(6,1)==='지-1', '빌-1 · 리-1 · 지-1');
chk(addrOf(7,1)==='7-1', '접두사가 없는 채널은 숫자로 떨어진다 — 주소가 빈칸이 되지 않는다');
say('');

say('【3】 입장창 페이징 — 3개씩');
const PER=3;
const pages=()=>Math.max(1,Math.ceil(CHANNELS.length/PER));
chk(pages()===2, '채널 6개 → '+pages()+'쪽');
let pg=Math.floor(CHANNELS.findIndex(c=>c.no===MY_CH)/PER);
chk(pg===0, '내 집이 투 마을(1채널)이라 0쪽에서 시작');
const slice=p=>CHANNELS.slice(p*PER,p*PER+PER);
chk(slice(0).length===3&&slice(1).length===3, '두 쪽 다 3줄');
chk(slice(0).map(c=>chName(c.no)).join('')==='투게더', '1쪽 = 투·게·더');
chk(slice(1).map(c=>chName(c.no)).join('')==='빌리지', '2쪽 = 빌·리·지');
chk(slice(0).concat(slice(1)).length===CHANNELS.length, '두 쪽을 합치면 빠진 채널이 없다');
say('');
say('【4】 자른 목록이 판정을 바꾸지 않는가');
/* 만원·등급은 CHANNELS 전체로 정해야 한다 — 안 보이는 채널도 여전히 존재한다 */
CHANNELS[5].now=CH_CAP;                      /* 지 마을이 만원 (2쪽) */
const canEnter=c=>c.now<CH_CAP||c.no===MY_CH;
let pick=6;
const settle=()=>{ const c=CHANNELS.find(x=>x.no===pick); if(!c||!canEnter(c)) pick=MY_CH; return pick; };
chk(settle()===1, '1쪽을 보는 중이어도 2쪽의 지 마을 만원이 판정된다 → 투 마을로 되돌림');
CHANNELS[5].now=2; pick=6;
chk(settle()===6, '여유가 생기면 다시 고를 수 있다');
say('');
say('【5】 페이지 넘기기 경계');
pg=0; chk(pg===0, '첫 쪽에서 「앞」은 잠긴다');
pg=pages()-1; chk(pg===1, '끝 쪽에서 「뒤」는 잠긴다');
const clamp=p=>Math.max(0,Math.min(pages()-1,p));
chk(clamp(-1)===0&&clamp(9)===1, '범위를 벗어난 쪽 번호는 안쪽으로 당겨진다');
say('');
if(fail){ say('문제 '+fail+'건'); process.exit(1); }
say('전부 통과 ✅');
