/* ═══ 🩺 env-diag.js — 환경 · 자원 진단(켤 때 [환경] · [GPU 상세] 한 줄씩 · 1분마다 [자원] 한 줄) ══════════════
   «같은 앱이 어떤 PC 에선 CPU 0.2%, 어떤 PC 에선 4~22%» 제보를 진단 기록 두 장으로 가르려는 진단이다 —
   어떤 PC 인지(OS · CPU · 메모리 · 모니터 · 실제로 그리는 그래픽 장치)와, CPU · 메모리를 어느 프로세스가 쓰는지.
   main 만 싣는다. 순수 계산만 — 받은 값을 한 줄 글로 만든다(검사 sim-env-diag.js).
   ★ CPU 는 프로세스마다 «시작 뒤 쓴 CPU 초(cumulativeCPUUsage)» 의 차이로 셈한다 — percentCPUUsage 는
     «지난 호출 뒤 평균» 이라 다른 곳이 부르면 구간이 바뀌고, 코어 하나 기준인지 PC 전체 기준인지 문서에 없다.
     적는 % 는 작업 관리자와 같은 PC 전체 기준(코어 몫 ÷ 논리 프로세서 수). */
(function(){
'use strict';

const RES_TAG = '[자원]';
const KB_PER_MB = 1024;          // getAppMetrics 메모리 단위는 KB
const STR_MAX = 120;             // 장치 이름 같은 바깥 글의 길이 상한
const BUCKETS = [                // [자원] 줄에 적는 순서 · 이름
  ['main', '메인'], ['gpu', 'GPU'], ['view', '화면'], ['tabs', '다른 화면'], ['rest', '기타'],
];

const clip = (s) => String(s == null ? '' : s).replace(/[\r\n]+/g, ' ').slice(0, STR_MAX);
const num = (v) => (typeof v === 'number' && isFinite(v)) ? v : null;
const fix1 = (v) => (Math.round(v * 10) / 10).toFixed(1);

/* 켤 때 한 번 — e: { app, electron, chrome, os, osVer, arch, cpuModel, threads, ramBytes, displays:[{ w, h, scale, hz, primary, run }] }
   예) [환경] 앱 0.12.4 · Electron 44.9.3 · Chrome 140.0 · Windows 10.0.22631 x64 · CPU i5-13600K(논리 20) · RAM 31.8GB · 모니터 2대: 2560x1440 144Hz 배율1 주 / 1920x1080 60Hz 배율1.25 실행 */
function envLine(e){
  const x = e || {};
  const ram = num(x.ramBytes);
  const disps = Array.isArray(x.displays) ? x.displays : [];
  const disp = disps.map(d => {
    const scale = num(d && d.scale) || 1;
    const w = num(d && d.w), h = num(d && d.h), hz = num(d && d.hz);
    return (w && h ? Math.round(w * scale) + 'x' + Math.round(h * scale) : '크기 모름')
      + ' ' + (hz ? Math.round(hz) + 'Hz' : 'Hz 모름') + ' 배율' + (Math.round(scale * 100) / 100)
      + (d && d.primary ? ' 주' : '') + (d && d.run ? ' 실행' : '');
  });
  return '[환경] 앱 ' + clip(x.app || '모름') + ' · Electron ' + clip(x.electron || '모름') + ' · Chrome ' + clip(x.chrome || '모름')
    + ' · ' + clip(x.os || 'OS 모름') + ' ' + clip(x.osVer || '') + ' ' + clip(x.arch || '')
    + ' · CPU ' + clip(x.cpuModel || '모름') + '(논리 ' + (num(x.threads) || '모름') + ')'
    + ' · RAM ' + (ram ? fix1(ram / 1073741824) + 'GB' : '모름')
    + ' · 모니터 ' + (disp.length ? disp.length + '대: ' + disp.join(' / ') : '모름');
}

/* getGPUInfo('complete') 에서 «실제로 그리는 장치 · 화면 넘기는 길» 만 — Chromium 판마다 칸 자리가 달라서 여러 곳을 찾고 없으면 «모름».
   directComposition · supportsOverlays 는 Windows 에만 온다(맥은 «모름»).
   예) [GPU 상세] 그리는 장치 ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11) · directComposition=true · supportsOverlays=false · 겹친 그래픽=false · 화면 종류=D3D11 · 그리기 엔진=GaneshGL */
function gpuDetailLine(info){
  const i = info || {};
  const aux = i.auxAttributes || {};
  const ov = aux.overlayInfo || i.overlayInfo || {};
  const pick = (...vs) => { for(const v of vs) if(v !== undefined && v !== null && v !== '') return v; return '모름'; };
  const hybrid = (aux.optimus === true || aux.amdSwitchable === true) ? true
    : ((aux.optimus === false || aux.amdSwitchable === false) ? false : '모름');
  return '[GPU 상세] 그리는 장치 ' + clip(pick(aux.glRenderer, i.glRenderer))
    + ' · directComposition=' + pick(ov.directComposition, aux.directComposition)
    + ' · supportsOverlays=' + pick(ov.supportsOverlays, aux.supportsOverlays)
    + ' · 겹친 그래픽=' + hybrid
    + ' · 화면 종류=' + clip(pick(aux.displayType)) + ' · 그리기 엔진=' + clip(pick(aux.skiaBackendType));
}

/* os.cpus() 의 times 를 모두 더해 «바쁜 ms · 전체 ms» — 두 번 뺀 비율이 그 구간 PC 전체 CPU %(작업 관리자 «CPU» 와 같은 기준) */
function cpuTimes(cpus){
  let busy = 0, total = 0;
  for(const c of (Array.isArray(cpus) ? cpus : [])){
    const t = (c && c.times) || {};
    const idle = num(t.idle) || 0;
    const all = (num(t.user) || 0) + (num(t.nice) || 0) + (num(t.sys) || 0) + (num(t.irq) || 0) + idle;
    busy += all - idle; total += all;
  }
  return { busy, total };
}

/* 1분마다 — 프로세스를 메인 · GPU · 화면(우리 창) · 다른 화면(유튜브 · 자식 창) · 기타로 나눠 그 사이 쓴 CPU 코어 몫과 메모리를 낸다.
   같은 pid 가 다시 쓰일 수 있어 «pid + 만든 시각» 으로 알아본다. 첫 호출은 기준만 잡고 null(지난 값이 없다). */
function createResourceWatch(){
  let lastT = null, prev = new Map(), lastSys = null;
  function bucketOf(m, viewPid){
    if(m.type === 'Browser') return 'main';
    if(m.type === 'GPU') return 'gpu';
    if(m.type === 'Tab') return m.pid === viewPid ? 'view' : 'tabs';
    return 'rest';
  }
  /* sys: { cpu: cpuTimes(os.cpus()), freeBytes, totalBytes } — PC 전체(없으면 «모름») */
  function take(t, metrics, viewPid, sys){
    const list = Array.isArray(metrics) ? metrics : [];
    const out = { secs: lastT == null ? 0 : (t - lastT) / 1000, cpuKnown: true, b: {}, pcCpu: null, memUsed: null, memTotal: null };
    const sc = sys && sys.cpu;
    if(sc && lastSys && sc.total > lastSys.total) out.pcCpu = (sc.busy - lastSys.busy) / (sc.total - lastSys.total);
    if(sc) lastSys = sc;
    const free = num(sys && sys.freeBytes), tot = num(sys && sys.totalBytes);
    if(tot && free != null){ out.memUsed = tot - free; out.memTotal = tot; }
    BUCKETS.forEach(([k]) => { out.b[k] = { cores: 0, mb: 0, n: 0 }; });
    const next = new Map();
    for(const m of list){
      if(!m || typeof m !== 'object') continue;
      const key = m.pid + ':' + (m.creationTime || 0);
      const cum = num(m.cpu && m.cpu.cumulativeCPUUsage);
      next.set(key, cum);
      const b = out.b[bucketOf(m, viewPid)];
      b.n++;
      b.mb += (num(m.memory && m.memory.workingSetSize) || 0) / KB_PER_MB;
      if(cum == null){ out.cpuKnown = false; continue; }
      const was = prev.get(key);
      /* 지난번에 없던 프로세스: 그사이 새로 떴으면 처음부터 쓴 몫이 그대로 이 구간 몫, 아니면(첫 호출) 셈 못 함 */
      const born = lastT != null && num(m.creationTime) != null && m.creationTime >= lastT;
      const used = (was != null) ? cum - was : (born ? cum : null);
      if(used != null && used >= 0 && out.secs > 0) b.cores += used / out.secs;
    }
    const first = lastT == null;
    lastT = t; prev = next;
    return first ? null : out;
  }
  return { take };
}

/* [자원] 한 줄 — r: take 결과 · threads: 논리 프로세서 수 · mode: '실행 화면' | '런처' | '숨김'
   CPU % 는 모두 PC 전체 기준(작업 관리자와 같음) — 우리 앱 몫은 코어 몫 ÷ 논리 프로세서 수, 끝의 «PC 전체» 는 그 구간 모든 프로그램 합.
   예) [자원] 60초 · 실행 화면 · CPU 합 22.3% · 메인 7.0 · GPU 13.7 · 화면 1.6 · 다른 화면 0.0(0개) · 기타 0.0(2개) · 메모리 합 530MB · 메인 80 · GPU 120 · 화면 300 · 다른 화면 0 · 기타 30 · PC 전체 CPU 43.0% · PC 메모리 10.4/31.8GB */
function resourceLine(r, threads, mode){
  const head = RES_TAG + ' ' + (r && r.secs > 0 ? Math.round(r.secs) + '초' : '') + ' · ' + clip(mode || '모름');
  if(!r || !(r.secs > 0)) return head + ' · 기준 잡는 중';
  const n = num(threads) || 0;
  const pct = (cores) => n > 0 ? fix1(cores / n * 100) : '모름';
  let cpuSum = 0, mbSum = 0;
  const cpu = [], mem = [];
  BUCKETS.forEach(([k, name]) => {
    const b = r.b[k] || { cores: 0, mb: 0, n: 0 };
    cpuSum += b.cores; mbSum += b.mb;
    const cnt = (k === 'tabs' || k === 'rest') ? '(' + b.n + '개)' : '';
    cpu.push(name + ' ' + pct(b.cores) + cnt);
    mem.push(name + ' ' + Math.round(b.mb));
  });
  const gb = (b) => fix1(b / 1073741824);
  const pc = ' · PC 전체 CPU ' + (r.pcCpu != null ? fix1(r.pcCpu * 100) + '%' : '모름')
    + ' · PC 메모리 ' + (r.memTotal ? gb(r.memUsed) + '/' + gb(r.memTotal) + 'GB' : '모름');
  return head + ' · CPU ' + (r.cpuKnown ? '' : '(일부 모름) ') + '합 ' + pct(cpuSum) + '% · ' + cpu.join(' · ')
    + ' · 메모리 합 ' + Math.round(mbSum) + 'MB · ' + mem.join(' · ') + pc;
}

const api = { RES_TAG, KB_PER_MB, STR_MAX, BUCKETS, envLine, gpuDetailLine, cpuTimes, createResourceWatch, resourceLine };
if(typeof window !== 'undefined') window.TwEnvDiag = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
