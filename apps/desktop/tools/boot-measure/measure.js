// measure.js — 켤 때 걸린 시간 재기 — node measure.js <e2e-local 폴더> <결과 폴더> [prep-cold|prep-update]
// 결과 폴더의 appdata 로 켜고, 측정 줄(__twMarks: begin · face · parts:n/m)과 렌더러 요청 기록(Resource Timing)을 모은다
'use strict';
const path = require('path'), fs = require('fs');
const E = path.resolve(process.argv[2]), OUT = path.resolve(process.argv[3]), PREP = process.argv[4] || '';
const lib = require(E + '/lib.js');
const SETTLE_MS = Number(process.env.SETTLE_MS || 15000);
(async () => {
  const A = lib.makeApp(OUT);
  const w = await A.launch();
  const t0 = Date.now();
  let res = null;
  try{
    // 파츠까지 다 붙거나(60초) 끝날 때까지 · SHOT_AT_MS 를 주면 begin 뒤 그 ms 에 화면을 한 장(«접속 중…» 토스트 확인)
    const shotAt = Number(process.env.SHOT_AT_MS || 0); let shotDone = !shotAt;
    for(;;){
      if(!shotDone){
        const b = await w.evaluate(() => { const m = (window.__twMarks || []).find((x) => x[0] === 'begin'); return m ? performance.now() - m[1] : -1; }).catch(() => -1);
        if(b >= shotAt){ shotDone = true; await w.screenshot({ path: OUT + '/shot-at-' + shotAt + '.png' }); fs.writeFileSync(OUT + '/shot-at-' + shotAt + '.txt', await w.evaluate(() => { const t = document.getElementById('toast'); return (t && t.classList.contains('on') ? 'on ' : 'off ') + (t ? t.textContent : ''); })); }
      }
      const m = await w.evaluate(() => window.__twMarks || []).catch(() => []);
      const done = m.some(x => /^parts:(\d+)\/\1$/.test(x[0]) && !/^parts:0\//.test(x[0]));
      if((done && shotDone) || Date.now() - t0 > 60000) break;
      await lib.wait(200);
    }
    if(process.env.SHOT) await w.screenshot({ path: OUT + '/shot-' + process.env.SHOT + '.png' });
    await lib.wait(SETTLE_MS);
    res = await w.evaluate(() => ({
      marks: window.__twMarks || [],
      res: performance.getEntriesByType('resource').filter(e => /^https?:/.test(e.name)).map(e => ({ n: e.name.replace(/^https?:\/\/[^/]+/, '').replace(/\?.*$/, '').slice(0, 200), h: e.name.split('/')[2], s: Math.round(e.startTime), e: Math.round(e.responseEnd), b: e.encodedBodySize || e.transferSize || 0, i: e.initiatorType })),
      toast: (document.getElementById('toast') || {}).textContent || '',
      closet: closetMod.state(),
    }));
    if(PREP === 'prep-cold'){
      // 다음 켤 때 «처음 켬» 이 되게 — GLB 영구 캐시 · HTTP 캐시 · 측정 줄을 지운다(로그인은 남긴다)
      await w.evaluate(() => new Promise(r => { const q = indexedDB.deleteDatabase('tw-glb-cache'); q.onsuccess = q.onerror = q.onblocked = () => r(); }));
      await w.evaluate(() => { for(const k of Object.keys(localStorage)) if(/etag/i.test(k)) localStorage.removeItem(k); });
      await A.app.evaluate(({ session }) => session.defaultSession.clearCache());
    }
    if(PREP === 'prep-update'){
      // 0.13.1 에서 올린 PC 흉내 — 영구 캐시 열쇠를 옛 주소(서버 파일 endpoint)로 바꾼다
      const n = await w.evaluate(() => new Promise((resolve) => {
        const rq = indexedDB.open('tw-glb-cache');
        rq.onsuccess = () => {
          const db = rq.result; const out = [];
          const tx = db.transaction('glb', 'readwrite'); const st = tx.objectStore('glb');
          st.openCursor().onsuccess = (ev) => {
            const c = ev.target.result;
            if(!c){ return; }
            const v = c.value; const m = /([0-9a-f]{64})/.exec(String(v.url || c.key));
            if(m){ out.push(1); const nv = Object.assign({}, v, { url: 'https://api-dev.together-working.com/v2/catalog/assets/' + m[1] + '.glb' }); if(nv.url !== v.url){ c.delete(); st.put(nv); } }
            c.continue();
          };
          tx.oncomplete = () => resolve(out.length);
        };
        rq.onerror = () => resolve(-1);
      }));
      res.prepUpdate = n;
      await A.app.evaluate(({ session }) => session.defaultSession.clearCache());
    }
  } finally {
    fs.writeFileSync(OUT + '/console.txt', A.logs.join('\n'));
    fs.writeFileSync(OUT + '/requests.txt', A.reqs.join('\n'));
    await A.quit();
  }
  const mk = (re) => { const x = res.marks.find(m => re.test(m[0])); return x ? Math.round(x[1]) : null; };
  const begin = mk(/^begin$/), face = mk(/^face$/), parts = mk(/^parts:([1-9]\d*)\/\1$/);
  const before = (t) => t == null ? null : res.res.filter(r => r.s < t);
  const api = (l) => l && l.filter(r => /^\/v2\//.test(r.n) && !/\/v2\/catalog\/assets\//.test(r.n));
  const glb = (l) => l && l.filter(r => /assets%2F[0-9a-f]{64}\.glb|\/v2\/catalog\/assets\/[0-9a-f]{64}\.glb/.test(r.n));
  const bf = before(face);
  const sum = {
    begin, face, parts, faceFromBegin: face && begin ? face - begin : null, partsFromBegin: parts && begin ? parts - begin : null,
    reqBeforeFace: bf && bf.length, apiBeforeFace: bf && api(bf).length, glbBeforeFace: bf && glb(bf).length,
    apiBeforeFaceList: bf && api(bf).map(r => r.n),
    glbTotal: glb(res.res).length, glbMB: +(glb(res.res).reduce((a, r) => a + r.b, 0) / 1e6).toFixed(2),
    reqTotal: res.res.length, apiTotal: api(res.res).length, marks: res.marks.map(m => m[0] + '@' + Math.round(m[1])), closet: res.closet, toast: res.toast, prepUpdate: res.prepUpdate,
  };
  fs.writeFileSync(OUT + '/measure.json', JSON.stringify({ sum, res: res.res }, null, 1));
  console.log(JSON.stringify(sum));
  process.exit(0);
})().catch((e) => { console.error('실패', e); process.exit(1); });
