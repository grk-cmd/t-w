/* xmas-tree.js — 🎄 크리스마스 3D 트리(일회성 — 다음 업데이트에서 걷는다 · 이슈 #963) (검사 sim-xmas-tree.js)
   책임: 트리 · 장식 그리기(PS1 도트 — 저해상도로 그린 뒤 색 단계 + 4×4 Bayer 디더) · 끌어 돌리기 · 휠 확대 · 한마디 라벨 ·
     이스터에그(10번 누르기 · 흔들기) · 내 장식 반짝임. 서버 · 창 틀은 모른다(xmas-window.js 가 장식 목록을 넘긴다).
   수명: open() 에서 렌더러 · 장면을 만들고 rAF 를 돌리며, close() 에서 rAF 를 멈추고 텍스처 · 지오메트리 · 렌더러를 버린다
     (창마다 WebGL 컨텍스트를 하나 잡으므로 닫을 때 꼭 dispose — 컨텍스트 수 한도).
   ★ 장식은 화면에서 늘 같은 크기(sizeAttenuation:false). 내 장식은 깊이를 안 보고 맨 나중에 그려 늘 앞(각자 자기 것이 앞).
   ★ 이스터에그로 떨어진 장식은 이 화면에서만 — 저장하지 않는다(창을 다시 열면 원래대로).
   deps: THREE(r128) · rules(TwXmasRules) · ps1Dither(TwPs1Dither — BAYER4 · PS1 표와 한 값).
   classic script(window.TwXmasTree) — xmas-window.js · app.js 보다 먼저 싣는다. */
(function(){
'use strict';

/* 기본 장식 — 16칸 도트 그림(앱에 박힌 그림이라 서버에서 받지 않는다 · o 는 테두리). 16칸에 다 차지 않아도 baseCanvas 가 가운데로 놓는다 */
const BASE_DOTS = {
  bulb: [['.......oo.......', '......oYYo......', '.....oyyyYo.....', '....orrrrrro....', '...opppprrrro...', '..opwwwprrrrro..', '..opwwwprrrrro..', '.orppwwprrrrddo.', '.orrppprrrrdddo.', '.orrrrrrrrddddo.', '..orrrrrrddddo..', '..orrrrrdddddo..', '...orrrdddddo...', '....ordddddo....', '.....oooooo.....'], { o: '#5a1a22', r: '#d8434b', d: '#a82a35', p: '#ee7a7f', w: '#fff1f1', y: '#f2c14e', Y: '#b98a1f' }],
  star: [['.......o........', '......oyo.......', '......oyo.......', '.....oywyo......', '.....oywyo......', 'oooooowwwoooooo.', 'oyyyyyywwyyyyyo.', '.oyyyyywwyyyyo..', '..oyyyyyyYYYo...', '...oyyyyYYYo....', '...oyyyyYYYo....', '..oyyyyoYYYYo...', '..oyyyo.oYYYo...', '.oyyo....oYYYo..', '.ooo......oooo..'], { o: '#7a5310', y: '#f6c945', Y: '#d9a024', w: '#fff3c4' }],
  sock: [['.oooooooooo.....', '.owwwwwwwwo.....', '.owwwwwwwwo.....', '.oWWWWWWWWo.....', '..orrrrrrdo.....', '..orrgGrrdo.....', '..orgGgrrdo.....', '..orrrrrrdo.....', '..orrrrrrdoooo..', '..orrrrrrrrrrdo.', '..ohhrrrrrrrttdo', '..ohhhrrrrrrttto', '...ohhrrrrrrtto.', '....ooooooooooo.'], { o: '#4a1518', w: '#f4f7fc', W: '#c8d2e2', r: '#cf3a43', d: '#a52a33', h: '#f4f7fc', t: '#f4f7fc', g: '#2f8a52', G: '#4fb26e' }],
  cane: [['.....oooooo.....', '....owwrrwwo....', '...owwroowrro...', '...owro..orwo...', '...orro..owwo...', '....oo...owro...', '.........orro...', '.........orwo...', '.........owwo...', '.........owro...', '.........orro...', '.........orwo...', '.........owwo...', '.........owro...', '.........orro...', '..........oo....'], { o: '#5a1a22', r: '#d8434b', w: '#f6f8fc' }],
  gift: [['....oo....oo....', '...oyyo..oyyo...', '....oYyooyYo....', '.oooooyyyyooooo.', 'ollllllyyllllllo', 'ollllllyyllllllo', 'oLLLLLLyyLLLLLLo', '.obbbbbyybbbbBo.', '.obbbbbyybbbbBo.', '.obbbbbyybbbbBo.', '.obbbbbyybbbbBo.', '.obbbbbyybbbbBo.', '.obbbbbyybbbbBo.', '.obbbbbyybbbbBo.', '..oooooooooooo..'], { o: '#1c2c5c', b: '#4e7bd8', B: '#3a5fb0', l: '#6d94e6', L: '#3a5fb0', y: '#f2c14e', Y: '#c99522' }],
};
/** 점 그림(행 글자열 · '.' 은 빈칸)을 size 칸 가운데에 놓으려면 옮길 칸 수 — 남는 칸이 홀수면 왼쪽 · 위로 반 칸 */
function dotsOffset(rows, size){
  let x0 = size, x1 = -1, y0 = size, y1 = -1;
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.'){ if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }));
  if (x1 < 0) return { x: 0, y: 0 };
  return { x: Math.floor((size - (x1 - x0 + 1)) / 2) - x0, y: Math.floor((size - (y1 - y0 + 1)) / 2) - y0 };
}
/** 기본 장식 그림 캔버스(16px) — 창 아래 고르기 단추도 같은 그림을 쓴다 */
function baseCanvas(kind, doc){
  const rows = BASE_DOTS[kind];
  if (!rows) return null;
  const c = doc.createElement('canvas'); c.width = c.height = 16;
  const g = c.getContext('2d');
  if (!g) return c;
  const o = dotsOffset(rows[0], 16);   // 점 그림이 16칸 한쪽에 치우쳐 있어도 가운데에 놓는다(장식 고르기 칸 · 트리 장식)
  rows[0].forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.'){ g.fillStyle = rows[1][ch]; g.fillRect(x + o.x, y + o.y, 1, 1); } }));
  return c;
}

const ORN_SIZE = 0.05;        // 화면 크기 고정(sizeAttenuation:false) 장식 크기
/* 스프라이트 셰이더 끝(gl_Position 뒤) — scale 은 이미 화면 고정 크기의 월드 길이(-z 곱한 값) */
const ORN_DEPTH_GLSL = 'vec4 twPop = projectionMatrix * vec4(mvPosition.xy, mvPosition.z + 0.6 * max(scale.x, scale.y), 1.0); gl_Position.z = twPop.z / twPop.w * gl_Position.w;';
/* 장식은 카메라를 보는 판이라 비스듬한 잎 면에 반쯤 박혀 가려진다 — 깊이만 판 반지름만큼 카메라 쪽으로 당긴다
   (화면 크기 · 자리는 그대로 · 트리 뒤쪽 장식은 여전히 가려진다) */
function popOut(sh){
  sh.vertexShader = sh.vertexShader.replace('#include <logdepthbuf_vertex>', ORN_DEPTH_GLSL + '\n#include <logdepthbuf_vertex>');
}
const LOW_H = 300;            // 세로 300 도트로 그린 뒤 키운다
const LEVELS = 31;            // 색 단계(연하게 — 장식 그림이 잘 보이게)
const ZOOM_MAX = 3, LOOK_Y0 = 1.9, VIEW_BOTTOM = -0.3, VIEW_TOP = 6.0, CAM_DIST = 9.2;
const GROUND_Y = -0.1;

/**
 * @param {{ THREE:any, rules:any, ps1Dither:any, doc?:Document, win?:Window }} deps
 */
function createXmasTree(deps){
  const THREE = deps.THREE;
  const rules = deps.rules;
  const ps1Dither = deps.ps1Dither;
  const doc = deps.doc || document;
  const win = deps.win || window;
  const SLOTS = rules.slotPositions(rules.TREE_MAX);

  let S = null;   // 열려 있을 때만 — { renderer, scene, cam, tree, rt, post, … }
  let onReport = null, onSay = null;

  /* PS1 꼭짓점 흔들림 — 트리 몸통만(장식은 또렷하게) */
  function ps1Snap(m, snap){
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uSnap = snap;
      sh.vertexShader = 'uniform vec2 uSnap;\n' + sh.vertexShader.replace('#include <project_vertex>',
        '#include <project_vertex>\n  gl_Position.xy = floor(gl_Position.xy / gl_Position.w * uSnap) / uSnap * gl_Position.w;');
    };
    return m;
  }
  function postMaterial(rt){
    const B = ps1Dither.BAYER4;
    return new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: rt.texture }, uRes: { value: new THREE.Vector2(4, 4) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: [
        'uniform sampler2D tDiffuse; uniform vec2 uRes; varying vec2 vUv;',
        'float bayer(vec2 p){ int i = int(mod(p.y,4.0))*4 + int(mod(p.x,4.0)); float m[16];',
        '  ' + B.map((v, i) => 'm[' + i + ']=' + Number(v).toFixed(1) + ';').join(''),
        '  float t = 0.; for(int k=0;k<16;k++){ if(k==i) t = m[k]; } return t/16.; }',
        'void main(){ vec2 p = floor(vUv*uRes); vec3 c = texture2D(tDiffuse, (p+0.5)/uRes).rgb;',
        '  float L = ' + LEVELS.toFixed(1) + '; c = floor((c + (bayer(p)-0.5)*0.5/L) * L + 0.5) / L; gl_FragColor = vec4(clamp(c,0.,1.), 1.0); }',
      ].join('\n'),
      depthTest: false, depthWrite: false,
    });
  }

  function build(canvas){
    const renderer = TwGlContext.make(canvas, { canvas, antialias: false }, 'preview', { label: '크리스마스 트리' });   // 3D 를 못 만들면 그 자리에 안내(E-SYS-06) · null
    if (!renderer) return null;
    renderer.setPixelRatio(1);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0d1424');
    scene.fog = new THREE.Fog('#0d1424', 9, 18);
    const cam = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
    cam.position.set(0, 2.1, CAM_DIST); cam.lookAt(0, LOOK_Y0, 0);
    scene.add(new THREE.AmbientLight(0x8fa1c2, 0.55));
    const key = new THREE.DirectionalLight(0xfff1d6, 0.9); key.position.set(3, 6, 5); scene.add(key);
    const snap = { value: new THREE.Vector2(160, 120) };
    const tree = new THREE.Group(); scene.add(tree);
    const pine = ps1Snap(new THREE.MeshLambertMaterial({ color: '#2f7a4a' }), snap);
    rules.TIERS.forEach(t => { const m = new THREE.Mesh(new THREE.ConeGeometry(t.r, t.h, 8, 1), pine); m.position.y = t.y + t.h / 2; tree.add(m); });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.8, 6), ps1Snap(new THREE.MeshLambertMaterial({ color: '#6b4a2e' }), snap));
    trunk.position.y = 0.3; tree.add(trunk);
    const top = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), ps1Snap(new THREE.MeshBasicMaterial({ color: '#f2c14e' }), snap));
    top.position.y = 4.85; tree.add(top);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(6, 10), ps1Snap(new THREE.MeshLambertMaterial({ color: '#dfe7f4' }), snap));
    ground.rotation.x = -Math.PI / 2; ground.position.y = GROUND_Y; scene.add(ground);
    const SN = 260, sp = new Float32Array(SN * 3);
    for (let i = 0; i < SN; i++){ sp[i * 3] = (Math.random() - 0.5) * 12; sp[i * 3 + 1] = Math.random() * 8; sp[i * 3 + 2] = (Math.random() - 0.5) * 8; }
    const snowGeo = new THREE.BufferGeometry(); snowGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    scene.add(new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: '#eef3fb', size: 0.06 })));
    const rt = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    const post = postMaterial(rt);
    const postScene = new THREE.Scene(), postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post));
    return { canvas, renderer, scene, cam, tree, top, rt, post, postScene, postCam, snap, snowGeo, sp, SN, ray: new THREE.Raycaster(),
      orns: new Map(), texes: [], falling: [], yaw: 0.4, vel: 0.004, drag: null, zoom: 1, lookY: LOOK_Y0, sel: null,
      taps: rules.createTaps(), shake: rules.createShake(), raf: 0, ro: null, off: [] };
  }

  function size(){
    if (!S) return;
    const w = S.canvas.clientWidth || 1, h = S.canvas.clientHeight || 1;
    S.renderer.setSize(w, h, false);
    const lw = Math.max(1, Math.round(LOW_H * w / h));
    S.rt.setSize(lw, LOW_H); S.post.uniforms.uRes.value.set(lw, LOW_H); S.snap.value.set(lw / 2, LOW_H / 2);
    S.cam.aspect = w / h; S.cam.updateProjectionMatrix();
  }
  function half(z){ return Math.tan(S.cam.fov * Math.PI / 360) * CAM_DIST / z; }
  function applyCam(){
    if (S.zoom <= 1){ S.zoom = 1; S.lookY = LOOK_Y0; }
    else S.lookY = Math.min(VIEW_TOP - half(S.zoom), Math.max(VIEW_BOTTOM + half(S.zoom), S.lookY));
    S.cam.zoom = S.zoom; S.cam.position.y = S.lookY + 0.2; S.cam.lookAt(0, S.lookY, 0); S.cam.updateProjectionMatrix();
  }

  function texOf(src){
    const t = (src instanceof win.HTMLCanvasElement) ? new THREE.CanvasTexture(src) : new THREE.Texture(src);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.needsUpdate = true;
    S.texes.push(t);
    return t;
  }
  function addOrnament(o){
    const p = SLOTS[o.slot];
    if (!p) return;
    const src = o.img || baseCanvas(o.k, doc) || baseCanvas('bulb', doc);
    const mat = new THREE.SpriteMaterial({ map: texOf(src), transparent: true, alphaTest: 0.5, sizeAttenuation: false,
      depthTest: !o.mine, depthWrite: !o.mine, fog: !o.mine });
    mat.onBeforeCompile = popOut;
    const s = new THREE.Sprite(mat);
    s.position.set(p.x, p.y, p.z); s.scale.setScalar(ORN_SIZE);
    s.renderOrder = o.mine ? 999 : 0;
    s.userData = { slot: o.slot, word: o.word || '', mine: !!o.mine, blinkAt: o.mine && o.blink ? performance.now() : -Infinity };
    S.tree.add(s); S.orns.set(o.slot, s);
  }
  function clearOrnaments(){
    for (const s of S.orns.values()){ if (s.parent) s.parent.remove(s); s.material.dispose(); }
    S.orns.clear(); S.falling = []; hideSay();
    for (const t of S.texes) t.dispose();
    S.texes = [];
  }

  /* 한마디 라벨 — 누른 장식 위(회사원 모드 라벨 모양 · 글자는 textContent 로만) */
  function hideSay(){ if (S) S.sel = null; if (onSay) onSay(null); }
  const _v = () => new THREE.Vector3();
  function sayPos(){
    if (!S || !S.sel || !onSay) return;
    const v = S.sel.getWorldPosition(_v()).project(S.cam);
    onSay({ word: S.sel.userData.word, x: (v.x + 1) / 2 * S.canvas.clientWidth, y: (1 - v.y) / 2 * S.canvas.clientHeight });
  }
  /** 누른 자리의 장식 · 몸통 — 누르기는 내 장식(늘 앞)을 먼저, othersOnly(신고)면 남의 장식만 */
  function hitAt(cx, cy, othersOnly){
    const r = S.canvas.getBoundingClientRect();
    S.ray.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), S.cam);
    const hits = S.ray.intersectObjects(S.tree.children.filter(o => o.isSprite));
    const h = othersOnly ? hits.find(x => !x.object.userData.mine) : (hits.find(x => x.object.userData.mine) || hits[0]);
    return { orn: h ? h.object : null, trunk: !h && S.ray.intersectObjects(S.tree.children.filter(o => o.isMesh)).length > 0 };
  }

  /* 이스터에그 — 떨어지기(이 화면에서만) */
  function dropOne(o, wait, fling){
    if (o === S.sel) hideSay();
    S.scene.attach(o);
    const out = new THREE.Vector3(o.position.x, 0, o.position.z).normalize();
    const v = out.clone().multiplyScalar(0.01 + Math.random() * 0.03);
    if (fling) v.add(new THREE.Vector3(-out.z, 0, out.x).multiplyScalar(fling * (0.03 + Math.random() * 0.04)));
    v.y = Math.random() * 0.04;
    S.falling.push({ s: o, v, wait });
  }
  const hanging = () => S.tree.children.filter(o => o.isSprite);
  function stepFall(){
    for (const f of S.falling){
      if (f.wait > 0){ f.wait -= 1; continue; }
      f.v.y -= 0.004; f.s.position.add(f.v);
      if (f.s.position.y < GROUND_Y + 0.05){ f.s.position.y = GROUND_Y + 0.05; f.v.y *= -0.35; f.v.x *= 0.7; f.v.z *= 0.7; if (Math.abs(f.v.y) < 0.01) f.v.set(0, 0, 0); }
    }
  }

  function bindInput(){
    const c = S.canvas;
    const on = (ev, fn, o) => { c.addEventListener(ev, fn, o); S.off.push(() => c.removeEventListener(ev, fn, o)); };
    let downAt = null;
    on('pointerdown', (e) => { S.drag = { x: e.clientX, y: e.clientY }; downAt = [e.clientX, e.clientY]; S.vel = 0; c.setPointerCapture(e.pointerId); c.classList.add('drag'); });
    on('pointermove', (e) => {
      if (!S.drag) return;
      const d = e.clientX - S.drag.x, dy = e.clientY - S.drag.y;
      S.drag.x = e.clientX; S.drag.y = e.clientY;
      S.yaw += d * 0.01; S.vel = d * 0.0015;
      if (S.zoom > 1){ S.lookY += dy * 0.02 / S.zoom; applyCam(); }
      let n = S.shake.feed(d, performance.now());
      if (n){ const left = hanging(); n = Math.min(n, left.length); while (n-- > 0){ const i = Math.floor(Math.random() * left.length); dropOne(left.splice(i, 1)[0], Math.random() * 6, -Math.sign(d)); } }
    });
    const end = (e) => {
      S.drag = null; c.classList.remove('drag');
      if (e && e.button !== 0){ downAt = null; return; }   // 우클릭은 신고(contextmenu) 몫 — 한마디 라벨을 같이 띄우지 않는다
      if (!downAt || !e || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) >= 5){ downAt = null; return; }
      downAt = null;
      const h = hitAt(e.clientX, e.clientY);
      if (h.orn && h.orn.userData.word){ S.sel = h.orn; sayPos(); return; }
      hideSay();
      if (h.trunk && hanging().length){
        S.tree.position.x = 0.04; win.setTimeout(() => { if (S) S.tree.position.x = 0; }, 80);
        if (S.taps.tap(performance.now())) hanging().forEach(o => dropOne(o, Math.random() * 40 + o.position.y * 6, 0));
      }
    };
    on('pointerup', end); on('pointercancel', () => { S.drag = null; c.classList.remove('drag'); downAt = null; });
    on('wheel', (e) => {
      e.preventDefault();
      const r = c.getBoundingClientRect(), ny = 1 - 2 * (e.clientY - r.top) / r.height;
      const yAt = S.lookY + ny * half(S.zoom);
      S.zoom = Math.min(ZOOM_MAX, Math.max(1, S.zoom * Math.exp(-Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 120) * 0.0012)));
      S.lookY = yAt - ny * half(S.zoom); applyCam();
    }, { passive: false });
    // 우클릭 = 장식 신고(이름은 안 보이니 장식 자리로 신고 — 관리자는 건 사람을 본다)
    on('contextmenu', (e) => {
      e.preventDefault();
      const o = hitAt(e.clientX, e.clientY, true).orn;   // 신고는 남의 장식만 — 내 장식이 앞에 겹쳐도 뒤의 것을 고른다
      if (o && onReport) onReport(o.userData.slot);
    });
  }

  function frame(t){
    if (!S) return;
    S.raf = win.requestAnimationFrame(frame);
    if (!S.drag){ S.yaw += S.vel || 0.003; S.vel *= 0.97; if (Math.abs(S.vel) < 0.003) S.vel = 0; }
    S.tree.rotation.y = S.yaw; S.top.rotation.y = -S.yaw * 2 + t * 0.001;
    for (const s of S.orns.values()) if (s.userData.mine) s.material.opacity = rules.blinkOpacity(t - s.userData.blinkAt);
    for (let i = 0; i < S.SN; i++){ S.sp[i * 3 + 1] -= 0.01; if (S.sp[i * 3 + 1] < 0) S.sp[i * 3 + 1] = 8; }
    S.snowGeo.attributes.position.needsUpdate = true;
    stepFall();
    S.renderer.setRenderTarget(S.rt); S.renderer.render(S.scene, S.cam);
    S.renderer.setRenderTarget(null); S.renderer.render(S.postScene, S.postCam);
    sayPos();
  }

  /** 창이 열릴 때 — 캔버스에 렌더러를 만들고 돌린다(이미 열려 있으면 그대로) */
  function open(canvas){
    if (S) return;
    S = build(canvas);
    if (!S) return;   // 3D 를 못 만듦 — 안내는 gl-context 가 캔버스 자리에 띄웠다
    bindInput();
    S.ro = new win.ResizeObserver(size); S.ro.observe(canvas);
    size(); applyCam();
    S.raf = win.requestAnimationFrame(frame);
  }
  /** 창을 닫을 때 — 멈추고 모두 버린다(떨어진 장식도 원래대로 — 다시 열면 새로 그린다) */
  function close(){
    if (!S) return;
    win.cancelAnimationFrame(S.raf);
    if (S.ro) S.ro.disconnect();
    S.off.forEach(f => f());
    clearOrnaments();
    S.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.dispose) o.material.dispose(); });
    S.postScene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    S.post.dispose(); S.rt.dispose(); S.renderer.dispose();
    S = null;
    if (onSay) onSay(null);
  }
  /** 장식 목록 바꾸기 — [{ slot, k, img(Image|Canvas)|null, word, mine, blink }] */
  function setOrnaments(list){
    if (!S) return;
    clearOrnaments();
    for (const o of list || []) addOrnament(o);
  }

  return {
    open, close, setOrnaments,
    isOpen: () => !!S,
    onReport: (fn) => { onReport = fn; },
    onSay: (fn) => { onSay = fn; },
  };
}

const api = Object.freeze({ createXmasTree, baseCanvas, dotsOffset, popOut, BASE_KINDS: Object.freeze(Object.keys(BASE_DOTS)) });
if (typeof window !== 'undefined') window.TwXmasTree = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
