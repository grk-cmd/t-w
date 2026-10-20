/* @tw/char-core 0.2.0 — 생성 파일 · 고치지 말 것(packages/char-core 에서 npm run build) */
"use strict";
var TwCharCore = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.ts
  var index_exports = {};
  __export(index_exports, {
    BASE_HEIGHT: () => BASE_HEIGHT,
    CANVAS_SZ: () => CANVAS_SZ,
    CLONE_CODE_PREFIX: () => CLONE_CODE_PREFIX,
    CLONE_TEX_SIZE: () => CLONE_TEX_SIZE,
    FACE_SYM_SUM: () => FACE_SYM_SUM,
    HUE_GLSL: () => HUE_GLSL,
    SKIN_COLORS: () => SKIN_COLORS,
    THREE_REVISION: () => THREE_REVISION,
    VERSION: () => VERSION,
    b64: () => b64,
    clonePayload: () => clonePayload,
    createBody: () => createBody,
    createCharCore: () => createCharCore,
    createFace: () => createFace,
    createParts: () => createParts,
    createTone: () => createTone,
    decodeCloneCode: () => decodeCloneCode,
    decryptPayload: () => decryptPayload,
    defFromPayload: () => defFromPayload,
    deriveKey: () => deriveKey,
    encodeCloneCode: () => encodeCloneCode,
    encryptPayload: () => encryptPayload,
    unb64: () => unb64,
    uvFill: () => uv_fill_exports
  });

  // src/clone-code.ts
  var CLONE_CODE_PREFIX = "DCC1.";
  var CLONE_TEX_SIZE = 256;
  var KDF_ITERATIONS = 15e4;
  var SALT_LEN = 16;
  var IV_LEN = 12;
  function b64(buf) {
    const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let s = "";
    for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s);
  }
  function unb64(str) {
    const s = atob(str);
    const b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b;
  }
  async function deriveKey(pass, salt) {
    const km = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: KDF_ITERATIONS, hash: "SHA-256" },
      km,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }
  var ANIMAL_TEX = ["animalBody", "animalEarPaintL", "animalEarPaintR", "animalBlink", "animalEarBlinkL", "animalEarBlinkR"];
  var urlOnly = (v) => typeof v === "string" && !v.startsWith("data:") ? v : null;
  async function clonePayload(def, opts) {
    const tex = def.animal ? await Promise.all(ANIMAL_TEX.map((k) => opts.shrinkDataUrl(def[k], CLONE_TEX_SIZE))) : ANIMAL_TEX.map(() => null);
    const or = (v, d) => v || d;
    return JSON.stringify({
      t: "creator",
      skin: or(def.skin, 0),
      top: def.top,
      bot: def.bot,
      xf: or(def.xf, null),
      decor: or(def.decor, null),
      deskColor: or(def.deskColor, null),
      deskItems: or(def.deskItems, null),
      deskGlb: or(def.deskGlb, null),
      deskCatalogId: or(def.deskCatalogId, null),
      deskScale: or(def.deskScale, null),
      deskPos: or(def.deskPos, null),
      customItems: or(def.customItems, null),
      isCommission: or(def.isCommission, false),
      commName: or(def.commName, null),
      commGlb: or(def.commGlb, null),
      animal: or(def.animal, false),
      animalFace: or(def.animalFace, 0),
      animalScl: or(def.animalScl, null),
      animalEarL: or(def.animalEarL, null),
      animalEarR: or(def.animalEarR, null),
      animalEarAdj: or(def.animalEarAdj, null),
      animalBody: tex[0],
      animalEarPaintL: tex[1],
      animalEarPaintR: tex[2],
      animalBlink: tex[3],
      animalEarBlinkL: tex[4],
      animalEarBlinkR: tex[5],
      earL: or(def.earL, null),
      earR: or(def.earR, null),
      earAdj: or(def.earAdj, null),
      earPicL: urlOnly(def.earPicL),
      earPicR: urlOnly(def.earPicR),
      face: def.face.toDataURL("image/png"),
      blink: def.blink.toDataURL("image/png")
    });
  }
  async function encryptPayload(payload, pass) {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
    const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
    const key = await deriveKey(pass, salt);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(payload)));
    const blob = new Uint8Array(SALT_LEN + IV_LEN + ct.length);
    blob.set(salt, 0);
    blob.set(iv, SALT_LEN);
    blob.set(ct, SALT_LEN + IV_LEN);
    return CLONE_CODE_PREFIX + b64(blob);
  }
  async function encodeCloneCode(def, pass, opts) {
    return encryptPayload(await clonePayload(def, opts), pass);
  }
  async function decryptPayload(code, pass) {
    if (typeof code !== "string" || !code.startsWith(CLONE_CODE_PREFIX)) throw new Error("format");
    const blob = unb64(code.slice(CLONE_CODE_PREFIX.length).replace(/\s+/g, ""));
    const salt = blob.slice(0, SALT_LEN);
    const iv = blob.slice(SALT_LEN, SALT_LEN + IV_LEN);
    const ct = blob.slice(SALT_LEN + IV_LEN);
    const key = await deriveKey(pass, salt);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    const o = JSON.parse(new TextDecoder().decode(pt));
    if (o.t !== "creator") throw new Error("type");
    return o;
  }
  var DESK_FIELDS = ["xf", "decor", "deskColor", "deskItems", "deskGlb", "deskCatalogId", "deskScale", "deskPos", "customItems"];
  var EAR_FIELDS = ["earL", "earR", "earAdj", "earPicL", "earPicR"];
  function defFromPayload(o) {
    const d = { type: "creator", skin: o.skin || 0, face: o.face, blink: o.blink, top: o.top, bot: o.bot };
    for (const k of DESK_FIELDS) if (o[k]) d[k] = o[k];
    if (o.isCommission) {
      d.isCommission = true;
      d.commName = o.commName || null;
      d.commGlb = o.commGlb || null;
    }
    if (!o.animal) {
      for (const k of EAR_FIELDS) if (o[k]) d[k] = o[k];
    } else {
      d.animal = true;
      d.animalFace = o.animalFace || 0;
      for (const k of ["animalScl", "animalEarL", "animalEarR", "animalEarAdj", "animalBody", "animalEarPaintL", "animalEarPaintR", "animalBlink"]) d[k] = o[k] || null;
      d.animalEarBlinkL = o.animalEarBlinkL || o.animalEarPaintL || null;
      d.animalEarBlinkR = o.animalEarBlinkR || o.animalEarPaintR || null;
    }
    return d;
  }
  async function decodeCloneCode(code, pass) {
    return defFromPayload(await decryptPayload(code, pass));
  }

  // src/uv-fill.ts
  var uv_fill_exports = {};
  __export(uv_fill_exports, {
    FILL_PAD_PX: () => FILL_PAD_PX,
    LAYOUT_CACHE_MAX: () => LAYOUT_CACHE_MAX,
    canvasLayout: () => canvasLayout,
    fillIsland: () => fillIsland,
    fillIslandOwned: () => fillIslandOwned,
    fillMesh: () => fillMesh,
    fillMeshOwned: () => fillMeshOwned,
    fillTriangles: () => fillTriangles,
    islandIds: () => islandIds,
    islandIndex: () => islandIndex,
    islandTriangles: () => islandTriangles,
    paintOwned: () => paintOwned,
    triangleAtUv: () => triangleAtUv,
    uvTriangles: () => uvTriangles
  });
  var FILL_PAD_PX = 1.5;
  function uvTriangles(geometry, size) {
    const g = geometry, a = g && g.attributes, uv = a && a.uv;
    if (!g || !uv || !uv.count) return [];
    const idx = g.index;
    const n = idx ? idx.count : uv.count;
    const get = (i) => idx ? idx.getX(i) : i;
    const out = [];
    for (let t = 0; t + 2 < n; t += 3) {
      const i0 = get(t), i1 = get(t + 1), i2 = get(t + 2);
      const tri = [uv.getX(i0) * size, uv.getY(i0) * size, uv.getX(i1) * size, uv.getY(i1) * size, uv.getX(i2) * size, uv.getY(i2) * size];
      if (tri.every((v) => isFinite(v))) out.push(tri);
    }
    return out;
  }
  function fillMesh(ctx, geometry, size, opts) {
    return fillTriangles(ctx, uvTriangles(geometry, size), opts);
  }
  function fillTriangles(ctx, tris, opts) {
    const o = opts || {};
    if (!tris || !tris.length) return 0;
    ctx.save();
    ctx.globalCompositeOperation = o.erase ? "destination-out" : "source-over";
    ctx.fillStyle = o.color || "#000000";
    ctx.strokeStyle = o.color || "#000000";
    ctx.lineJoin = "round";
    ctx.lineWidth = ((o.pad != null ? o.pad : FILL_PAD_PX) + (o.erase ? 1 : 0)) * 2;
    ctx.beginPath();
    tris.forEach((t) => {
      ctx.moveTo(t[0], t[1]);
      ctx.lineTo(t[2], t[3]);
      ctx.lineTo(t[4], t[5]);
      ctx.closePath();
    });
    ctx.fill();
    if (ctx.lineWidth > 0) ctx.stroke();
    ctx.restore();
    return tris.length;
  }
  var UV_KEY_Q = 1e5;
  var islandCache = typeof WeakMap !== "undefined" ? /* @__PURE__ */ new WeakMap() : null;
  function triCount(g) {
    const uv = g && g.attributes && g.attributes.uv;
    if (!g || !uv || !uv.count) return 0;
    return Math.floor((g.index ? g.index.count : uv.count) / 3);
  }
  var vIdx = (g, i) => g.index ? g.index.getX(i) : i;
  function islandIds(geometry) {
    const g = geometry, n = triCount(g);
    if (!g || !n) return null;
    const hit = islandCache && islandCache.get(g);
    if (hit) return hit;
    const uv = g.attributes.uv, vc = uv.count;
    const par = new Int32Array(vc);
    for (let i = 0; i < vc; i++) par[i] = i;
    const find = (x) => {
      while (par[x] !== x) {
        par[x] = par[par[x]];
        x = par[x];
      }
      return x;
    };
    const join = (a, b) => {
      a = find(a);
      b = find(b);
      if (a !== b) par[b] = a;
    };
    const seen = /* @__PURE__ */ new Map();
    for (let i = 0; i < vc; i++) {
      const u = uv.getX(i), v = uv.getY(i);
      if (!isFinite(u) || !isFinite(v)) continue;
      const k = Math.round(u * UV_KEY_Q) + "," + Math.round(v * UV_KEY_Q);
      const s = seen.get(k);
      if (s !== void 0) join(s, i);
      else seen.set(k, i);
    }
    for (let t = 0; t < n; t++) {
      const a = vIdx(g, t * 3);
      join(a, vIdx(g, t * 3 + 1));
      join(a, vIdx(g, t * 3 + 2));
    }
    const out = new Int32Array(n);
    for (let t = 0; t < n; t++) out[t] = find(vIdx(g, t * 3));
    if (islandCache) islandCache.set(g, out);
    return out;
  }
  function triangleAtUv(geometry, u, v) {
    const g = geometry, n = triCount(g);
    if (!g || !n || !isFinite(u) || !isFinite(v)) return -1;
    const uv = g.attributes.uv, E = 1e-6;
    for (let t = 0; t < n; t++) {
      const i0 = vIdx(g, t * 3), i1 = vIdx(g, t * 3 + 1), i2 = vIdx(g, t * 3 + 2);
      const ax = uv.getX(i0), ay = uv.getY(i0), bx = uv.getX(i1), by = uv.getY(i1), cx = uv.getX(i2), cy = uv.getY(i2);
      const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
      if (!(Math.abs(d) > 1e-12)) continue;
      const l1 = ((by - cy) * (u - cx) + (cx - bx) * (v - cy)) / d;
      const l2 = ((cy - ay) * (u - cx) + (ax - cx) * (v - cy)) / d;
      if (l1 >= -E && l2 >= -E && 1 - l1 - l2 >= -E) return t;
    }
    return -1;
  }
  function pickFace(ids, geometry, faceIndex, uv) {
    let f = typeof faceIndex === "number" && faceIndex >= 0 && faceIndex < ids.length ? faceIndex | 0 : -1;
    if (f < 0 && uv) f = triangleAtUv(geometry, uv.x, uv.y);
    return f;
  }
  function islandTriangles(geometry, size, faceIndex, uv) {
    const ids = islandIds(geometry);
    if (!ids) return [];
    const f = pickFace(ids, geometry, faceIndex, uv);
    if (f < 0) return [];
    const id = ids[f], g = geometry, a = g.attributes.uv, out = [];
    let area = 0;
    for (let t = 0; t < ids.length; t++) {
      if (ids[t] !== id) continue;
      const i0 = vIdx(g, t * 3), i1 = vIdx(g, t * 3 + 1), i2 = vIdx(g, t * 3 + 2);
      const tri = [a.getX(i0) * size, a.getY(i0) * size, a.getX(i1) * size, a.getY(i1) * size, a.getX(i2) * size, a.getY(i2) * size];
      if (!tri.every((v) => isFinite(v))) continue;
      area += triArea(tri);
      out.push(tri);
    }
    return area > 0.5 ? out : [];
  }
  var triArea = (t) => Math.abs((t[2] - t[0]) * (t[5] - t[1]) - (t[4] - t[0]) * (t[3] - t[1])) / 2;
  function fillIsland(ctx, geometry, size, faceIndex, uv, opts) {
    return fillTriangles(ctx, islandTriangles(geometry, size, faceIndex, uv), opts);
  }
  var geoSeq = 0;
  var geoIds = typeof WeakMap !== "undefined" ? /* @__PURE__ */ new WeakMap() : null;
  var gid = (g) => {
    if (!geoIds) return 0;
    let v = geoIds.get(g);
    if (!v) {
      v = ++geoSeq;
      geoIds.set(g, v);
    }
    return v;
  };
  var LAYOUT_CACHE_MAX = 6;
  var layouts = /* @__PURE__ */ new Map();
  function raster(tris, size, lab, val) {
    let hit = 0;
    for (const t of tris) {
      const [x0, y0, x1, y1, x2, y2] = t;
      const d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
      if (!(Math.abs(d) > 1e-9)) continue;
      const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2))), maxX = Math.min(size - 1, Math.ceil(Math.max(x0, x1, x2)));
      const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2))), maxY = Math.min(size - 1, Math.ceil(Math.max(y0, y1, y2)));
      for (let y = minY; y <= maxY; y++) {
        const py = y + 0.5;
        for (let x = minX; x <= maxX; x++) {
          const px = x + 0.5;
          const l1 = ((y1 - y2) * (px - x2) + (x2 - x1) * (py - y2)) / d;
          const l2 = ((y2 - y0) * (px - x2) + (x0 - x2) * (py - y2)) / d;
          if (l1 >= 0 && l2 >= 0 && 1 - l1 - l2 >= 0) {
            const k = y * size + x;
            if (!lab[k]) {
              lab[k] = val;
              hit++;
            }
          }
        }
      }
    }
    return hit;
  }
  function canvasLayout(size, geos) {
    const list = [];
    (geos || []).forEach((g) => {
      if (g && list.indexOf(g) < 0 && triCount(g)) list.push(g);
    });
    const key = size + "|" + list.map(gid).join(",");
    const cached = layouts.get(key);
    if (cached) {
      layouts.delete(key);
      layouts.set(key, cached);
      return cached;
    }
    const islands = [], index = /* @__PURE__ */ new Map();
    list.forEach((g) => {
      const ids = islandIds(g), a = g.attributes.uv, by = /* @__PURE__ */ new Map();
      for (let t = 0; t < ids.length; t++) {
        const i0 = vIdx(g, t * 3), i1 = vIdx(g, t * 3 + 1), i2 = vIdx(g, t * 3 + 2);
        const tri = [a.getX(i0) * size, a.getY(i0) * size, a.getX(i1) * size, a.getY(i1) * size, a.getX(i2) * size, a.getY(i2) * size];
        if (!tri.every((v) => isFinite(v))) continue;
        const id = ids[t];
        let arr = by.get(id);
        if (!arr) by.set(id, arr = []);
        arr.push(tri);
      }
      by.forEach((tris, root) => {
        index.set(gid(g) + ":" + root, islands.length);
        islands.push({ geo: g, root, tris });
      });
    });
    const n = size * size, owner = new Int16Array(n), q = new Int32Array(n);
    let qt = 0;
    islands.forEach((isl, i) => {
      let area = 0;
      isl.tris.forEach((t) => {
        area += triArea(t);
      });
      isl.area = area;
      if (area <= 0.5 || !raster(isl.tris, size, owner, i + 1)) {
        for (const t of isl.tris)
          for (let v = 0; v < 6; v += 2) {
            const x = Math.max(0, Math.min(size - 1, Math.floor(t[v]))), y = Math.max(0, Math.min(size - 1, Math.floor(t[v + 1]))), k = y * size + x;
            if (!owner[k]) owner[k] = i + 1;
          }
      }
    });
    for (let k = 0; k < n; k++) if (owner[k]) q[qt++] = k;
    for (let qh = 0; qh < qt; qh++) {
      const k = q[qh], x = k % size, y = k / size | 0, L = owner[k];
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= size) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (!dx && !dy || xx < 0 || xx >= size) continue;
          const kk = yy * size + xx;
          if (owner[kk]) continue;
          owner[kk] = L;
          q[qt++] = kk;
        }
      }
    }
    const layout = { size, islands, index, owner };
    layouts.set(key, layout);
    while (layouts.size > LAYOUT_CACHE_MAX) layouts.delete(layouts.keys().next().value);
    return layout;
  }
  function islandIndex(layout, geometry, faceIndex, uv) {
    const ids = islandIds(geometry);
    if (!ids) return -1;
    const f = pickFace(ids, geometry, faceIndex, uv);
    if (f < 0) return -1;
    const i = layout.index.get(gid(geometry) + ":" + ids[f]);
    return i == null || !(layout.islands[i].area > 0.5) ? -1 : i;
  }
  function rgb(c) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(c || "").trim());
    const v = m ? parseInt(m[1], 16) : 0;
    return [v >> 16 & 255, v >> 8 & 255, v & 255];
  }
  function paintOwned(ctx, layout, picks, opts) {
    const o = opts || {}, c3 = rgb(o.color), size = layout.size, own = layout.owner, want = new Uint8Array(layout.islands.length + 1);
    picks.forEach((i) => {
      if (i >= 0) want[i + 1] = 1;
    });
    const img = ctx.getImageData(0, 0, size, size), d = img.data;
    let c = 0;
    for (let k = 0; k < own.length; k++) {
      if (!want[own[k]]) continue;
      const i = k * 4;
      c++;
      if (o.erase) {
        d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0;
      } else {
        d[i] = c3[0];
        d[i + 1] = c3[1];
        d[i + 2] = c3[2];
        d[i + 3] = 255;
      }
    }
    if (c) ctx.putImageData(img, 0, 0);
    return c;
  }
  function fillIslandOwned(ctx, size, geometry, faceIndex, uv, peers, opts) {
    const L = canvasLayout(size, [geometry].concat(peers || []));
    const i = islandIndex(L, geometry, faceIndex, uv);
    return i < 0 ? 0 : paintOwned(ctx, L, [i], opts);
  }
  function fillMeshOwned(ctx, size, geometry, peers, opts) {
    const L = canvasLayout(size, [geometry].concat(peers || []));
    const picks = [];
    L.islands.forEach((isl, i) => {
      if (isl.geo === geometry && isl.area > 0.5) picks.push(i);
    });
    return picks.length ? paintOwned(ctx, L, picks, opts) : 0;
  }

  // src/body.ts
  var BASE_HEIGHT = 1.4;
  function createBody(deps) {
    const { THREE } = deps;
    if (!THREE) throw new Error("char-core: deps.THREE 가 필요하다");
    if (!deps.gltf) throw new Error("char-core: deps.gltf 가 필요하다");
    const warn = deps.warn || ((m, e) => console.warn(m, e));
    let baseScene = null;
    let baseAnims = [];
    let meshMinY = null;
    let meshHeight = null;
    function loadBase(buf) {
      return new Promise((res) => {
        if (!buf) {
          res(false);
          return;
        }
        deps.gltf.parse(buf, "", (gltf) => {
          baseScene = gltf.scene;
          baseAnims = gltf.animations || [];
          baseScene.traverse((o) => {
            if (o.isMesh) o.frustumCulled = false;
          });
          measureBaseGeometry();
          res(true);
        }, (e) => {
          warn("base GLB parse fail", e);
          res(false);
        });
      });
    }
    function instantiateBase(customScene) {
      const src = customScene || baseScene;
      if (!src || !THREE.SkeletonUtils) return null;
      const root = THREE.SkeletonUtils.clone(src);
      let faceMat = null, upMat = null, loMat = null, faceMesh = null, upMesh = null, loMesh = null;
      let glassesMesh = null, hatMesh = null, hatMat = null, maskMesh = null, onepieceMesh = null, wingMesh = null, handLMesh = null, handRMesh = null, capeMesh = null;
      const litMats = [];
      const has = (str, word) => new RegExp("(?:^|[^a-z])" + word + "(?:$|[^a-z])", "i").test(str);
      root.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = false;
        o.frustumCulled = false;
        const cm = o.material && o.material.clone ? o.material.clone() : o.material;
        o.material = cm;
        const nm = (cm && cm.name || "").toLowerCase();
        const meshName = (o.name || "").toLowerCase();
        if (cm) {
          litMats.push(cm);
          deps.fixMatLighting(cm);
        }
        const hasBoth = (word) => has(nm, word) || has(meshName, word);
        if (nm.includes("face") || meshName.includes("head")) {
          faceMat = cm;
          faceMesh = o;
        } else if (!upMesh && (nm.includes("upper") || nm.includes("up_cloth") || nm.includes("up_clothes"))) {
          upMat = cm;
          upMesh = o;
        } else if (!loMesh && (nm.includes("lower") || nm.includes("low_cloth") || nm.includes("low_clothes"))) {
          loMat = cm;
          loMesh = o;
        } else if (!glassesMesh && (nm.includes("glass") || meshName.includes("glass"))) {
          glassesMesh = o;
        } else if (!capeMesh && hasBoth("cape")) {
          capeMesh = o;
        } else if (!hatMesh && (hasBoth("hat") || hasBoth("cap"))) {
          hatMesh = o;
          hatMat = cm;
        } else if (!maskMesh && hasBoth("mask")) {
          maskMesh = o;
        } else if (!onepieceMesh && (nm.includes("dress") || meshName.includes("dress"))) {
          onepieceMesh = o;
        } else if (!wingMesh && hasBoth("wing")) {
          wingMesh = o;
        } else if (!handLMesh && hasBoth("left")) {
          handLMesh = o;
        } else if (!handRMesh && hasBoth("right")) {
          handRMesh = o;
        }
      });
      return { root, faceMat, upMat, loMat, faceMesh, upMesh, loMesh, glassesMesh, hatMesh, hatMat, maskMesh, onepieceMesh, wingMesh, handLMesh, handRMesh, capeMesh, litMats };
    }
    function normalizeModel(group, targetH, scaleMul = 1) {
      group.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(group);
      const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
      let s = targetH / (size.y || 1);
      s *= scaleMul;
      group.scale.setScalar(s);
      group.position.set(-c.x * s, -box.min.y * s, -c.z * s);
      return s;
    }
    function calcMeshBox(group) {
      const box = new THREE.Box3(), tmp = new THREE.Box3();
      group.updateMatrixWorld(true);
      group.traverse((o) => {
        if (o.isMesh && o.geometry) {
          if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
          if (o.geometry.boundingBox) {
            tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
            box.union(tmp);
          }
        }
      });
      return box;
    }
    function measureBaseGeometry() {
      const inst = instantiateBase();
      if (!inst || !inst.root) return;
      normalizeModel(inst.root, BASE_HEIGHT);
      inst.root.updateMatrixWorld(true);
      const box = calcMeshBox(inst.root);
      if (!box.isEmpty()) {
        meshMinY = box.min.y;
        meshHeight = box.max.y - box.min.y;
      }
    }
    function buildFacePatchGeo(R, half, seg) {
      const geo = new THREE.PlaneGeometry(half * 2, half * 2, seg, seg);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i);
        pos.setZ(i, Math.sqrt(Math.max(1e-4, R * R - x * x - y * y)));
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
      return geo;
    }
    function buildCreatorBase(fTex, bTex, skinColor, top, bot) {
      const g = new THREE.Group();
      const skin = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.85 });
      const topMat = new THREE.MeshStandardMaterial({ color: top, roughness: 0.85 });
      const botMat = new THREE.MeshStandardMaterial({ color: bot, roughness: 0.85 });
      const lower = new THREE.Mesh(new THREE.SphereGeometry(0.4, 28, 28), botMat);
      lower.scale.set(1, 0.7, 0.9);
      lower.position.y = 0.4;
      lower.castShadow = true;
      g.add(lower);
      const upper = new THREE.Mesh(new THREE.SphereGeometry(0.44, 28, 28), topMat);
      upper.scale.set(1, 0.92, 0.92);
      upper.position.y = 0.72;
      upper.castShadow = true;
      g.add(upper);
      [-0.42, 0.42].forEach((x) => {
        const a = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 16), topMat);
        a.scale.set(0.7, 0.7, 1.1);
        a.position.set(x, 0.64, 0.2);
        a.castShadow = true;
        g.add(a);
      });
      const head = new THREE.Group();
      head.position.y = 1.18;
      g.add(head);
      const hm = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 32), skin);
      hm.castShadow = true;
      head.add(hm);
      const faceMat = new THREE.MeshStandardMaterial({ map: fTex, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 });
      faceMat.name = "Face";
      const face = new THREE.Mesh(buildFacePatchGeo(0.421, 0.27, 22), faceMat);
      head.add(face);
      return { group: g, faceMat, topMat, botMat, skinMat: skin, face, fT: fTex, bT: bTex };
    }
    function assemble(o) {
      const fT = o.faceTex, bT = o.blinkTex;
      const inst = instantiateBase(o.customScene);
      if (inst) {
        deps.setFaceMap(inst.faceMat, fT);
        if (o.recolor) {
          if (inst.upMat) inst.upMat.color.set(o.top);
          if (inst.loMat) inst.loMat.color.set(o.bot);
          if (inst.hatMat && inst.hatMat.color) inst.hatMat.color.set(o.top);
        }
        deps.applyLightPreset(inst);
        normalizeModel(inst.root, BASE_HEIGHT, o.scaleMul);
        if (o.onRoot) o.onRoot(inst.root);
        const wrap = new THREE.Group();
        wrap.add(inst.root);
        return {
          group: wrap,
          root: inst.root,
          faceMat: inst.faceMat,
          upMat: inst.upMat,
          loMat: inst.loMat,
          fT,
          bT,
          faceMesh: inst.faceMesh,
          upMesh: inst.upMesh,
          loMesh: inst.loMesh,
          glassesMesh: inst.glassesMesh,
          hatMesh: inst.hatMesh,
          hatMat: inst.hatMat,
          maskMesh: inst.maskMesh,
          onepieceMesh: inst.onepieceMesh,
          wingMesh: inst.wingMesh,
          handLMesh: inst.handLMesh,
          handRMesh: inst.handRMesh,
          capeMesh: inst.capeMesh
        };
      }
      const b = buildCreatorBase(fT, bT, o.skinColor, o.top, o.bot);
      return { group: b.group, root: b.group, faceMat: b.faceMat, fT, bT };
    }
    return {
      loadBase,
      instantiateBase,
      normalizeModel,
      calcMeshBox,
      measureBaseGeometry,
      buildFacePatchGeo,
      buildCreatorBase,
      assemble,
      baseScene: () => baseScene,
      baseAnims: () => baseAnims,
      baseMeshMinY: () => meshMinY,
      baseMeshHeight: () => meshHeight
    };
  }

  // src/face.ts
  var CANVAS_SZ = 512;
  var FACE_SYM_SUM = 0.36;
  var SKIN_COLORS = ["#FFE0BD", "#F1C898", "#E0AC69", "#C68642", "#8D5524"];
  var BLANK_PROBE_SZ = 32;
  function createFace(deps) {
    if (!deps || typeof deps.makeCanvas !== "function") throw new Error("char-core: deps.makeCanvas 가 필요하다");
    const warn = deps.warn || ((...a) => console.warn(...a));
    function newCanvas() {
      const c = deps.makeCanvas();
      c.width = c.height = CANVAS_SZ;
      return c;
    }
    let probe = null;
    function isBlankDraw(cv) {
      try {
        const c = cv;
        if (!c || typeof c.getContext !== "function" || !c.width || !c.height) return false;
        if (!probe) {
          probe = deps.makeCanvas();
          probe.width = probe.height = BLANK_PROBE_SZ;
        }
        const x = probe.getContext("2d", { willReadFrequently: true });
        x.clearRect(0, 0, BLANK_PROBE_SZ, BLANK_PROBE_SZ);
        x.drawImage(c, 0, 0, BLANK_PROBE_SZ, BLANK_PROBE_SZ);
        const d = x.getImageData(0, 0, BLANK_PROBE_SZ, BLANK_PROBE_SZ).data;
        for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return false;
        return true;
      } catch (_) {
        return false;
      }
    }
    function snapCanvas(src) {
      const c = newCanvas();
      c.getContext("2d").drawImage(src, 0, 0);
      return c;
    }
    const skinCanvases = SKIN_COLORS.map((col) => {
      const cv = newCanvas();
      const x = cv.getContext("2d");
      x.fillStyle = col;
      x.fillRect(0, 0, CANVAS_SZ, CANVAS_SZ);
      return cv;
    });
    const skinCanvasFor = (i) => skinCanvases[i] || skinCanvases[0];
    const skinColorFor = (i) => SKIN_COLORS[i] || SKIN_COLORS[0];
    let skipWarned = false;
    function compositeFace(skinIdx, drawCv) {
      const cv = newCanvas();
      const x = cv.getContext("2d");
      x.drawImage(skinCanvasFor(skinIdx), 0, 0);
      if (deps.isDrawable(drawCv)) x.drawImage(drawCv, 0, 0);
      else if (!skipWarned) {
        skipWarned = true;
        warn("[얼굴] 그림 레이어가 캔버스/이미지가 아니라 건너뜁니다 — 피부색만 보입니다. 받은 값:", Object.prototype.toString.call(drawCv), drawCv);
      }
      return cv;
    }
    return { CANVAS_SZ, FACE_SYM_SUM, SKIN_COLORS, newCanvas, isBlankDraw, snapCanvas, skinCanvases, skinCanvasFor, skinColorFor, compositeFace };
  }

  // src/tone.ts
  var HUE_GLSL = `
vec3 twRgb2Hsv(vec3 c){
  vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}
vec3 twHsv2Rgb(vec3 c){
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
vec3 twHueShift(vec3 rgb, float hue, float sat, float val){
  vec3 hsv = twRgb2Hsv(rgb);
  hsv.x = hue;
  /* 채도는 0 이 중립. 양수는 진한 쪽을 따라가고(흑백 텍스처에 색), 음수는 원본에 (1+sat) 을 곱해 내린다(-1 = 회색).
     ⚠️ 음수 쪽을 max() 로 하면 절대 안 내려간다. */
  hsv.y = (sat >= 0.0) ? max(hsv.y, sat * 0.9) : hsv.y * (1.0 + sat);
  hsv.y = clamp(hsv.y, 0.0, 1.0);
  /* 밝기는 덮어쓰기가 아니라 배율 — 픽셀마다 다른 명암에 곱해야 무늬가 산다. val=1.0 이 중립. */
  hsv.z = clamp(hsv.z * val, 0.0, 1.0);
  return twHsv2Rgb(hsv);
}
`;
  function createTone(deps) {
    const { THREE } = deps;
    if (!THREE) throw new Error("char-core: deps.THREE 가 필요하다");
    if (typeof deps.flatEmissive !== "number" || !isFinite(deps.flatEmissive)) throw new Error("char-core: deps.flatEmissive 가 필요하다");
    const FLAT = deps.flatEmissive;
    const PART_TEX_FLAT = FLAT;
    function setFaceMap(mat, tex) {
      if (!mat || !tex) return;
      mat.map = tex;
      mat.emissiveMap = tex;
      mat.needsUpdate = true;
    }
    function applyLightPresetToInstance(inst) {
      if (!inst) return;
      const flat = FLAT;
      if (inst.faceMat) {
        inst.faceMat.emissiveMap = inst.faceMat.map;
        inst.faceMat.emissive.setScalar(flat);
        inst.faceMat.needsUpdate = true;
      }
      for (const k of ["upMat", "loMat", "hatMat"]) {
        const m = inst[k];
        if (!m) continue;
        if (m.map && m.emissiveMap !== m.map) {
          m.emissiveMap = m.map;
          m.needsUpdate = true;
        }
        m.emissive.copy(m.color).multiplyScalar(flat);
      }
      if (inst.litMats) {
        inst.litMats.forEach((m) => {
          if (m === inst.faceMat || m === inst.upMat || m === inst.loMat) return;
          if (!m || !m.emissive) return;
          if (m.map && m.emissiveMap !== m.map) {
            m.emissiveMap = m.map;
            m.needsUpdate = true;
          }
          if (m.color) m.emissive.copy(m.color).multiplyScalar(flat);
          else m.emissive.setScalar(flat);
          m.needsUpdate = true;
        });
      }
    }
    function applyPartMatTone(m) {
      if (!m) return;
      deps.fixMatLighting(m);
      if (m.map) m.emissiveMap = m.map;
      const flat = m.map ? PART_TEX_FLAT : FLAT;
      if (m.emissive) m.emissive.copy(m.color || new THREE.Color(16777215)).multiplyScalar(flat);
      m.userData = m.userData || {};
      m.userData.baseFlat = flat;
      m.needsUpdate = true;
    }
    function baseFlatOf(mat) {
      return mat && mat.userData && mat.userData.baseFlat != null ? mat.userData.baseFlat : FLAT;
    }
    function rgbHexToHsv(hex) {
      const c = new THREE.Color(hex);
      const hsl = { h: 0, s: 0, l: 0 };
      c.getHSL(hsl);
      const v = hsl.l + hsl.s * Math.min(hsl.l, 1 - hsl.l);
      const s = v === 0 ? 0 : 2 * (1 - hsl.l / v);
      return { h: hsl.h, s: Math.min(1, Math.max(0, s)), v };
    }
    function hsvToHex(h, sv, v) {
      const c = new THREE.Color();
      c.setHSL(h, Math.max(0, Math.min(1, sv)), Math.max(0, Math.min(1, 0.5 * (v == null ? 1 : v))));
      return "#" + c.getHexString();
    }
    function isHueTintMesh(mesh) {
      return !!(mesh && mesh.material && mesh.material.map);
    }
    function hueOBC(u) {
      return (shader) => {
        shader.uniforms.uHue = u.uHue;
        shader.uniforms.uSat = u.uSat;
        shader.uniforms.uVal = u.uVal;
        shader.uniforms.uOn = u.uOn;
        shader.fragmentShader = "uniform float uHue;\nuniform float uSat;\nuniform float uVal;\nuniform float uOn;\n" + HUE_GLSL + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <map_fragment>",
          "#include <map_fragment>\n  if(uOn > 0.5){ diffuseColor.rgb = twHueShift(diffuseColor.rgb, uHue, uSat, uVal); }"
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <emissivemap_fragment>",
          "#include <emissivemap_fragment>\n  if(uOn > 0.5){ totalEmissiveRadiance = twHueShift(totalEmissiveRadiance, uHue, uSat, uVal); }"
        );
      };
    }
    function ensureHueUniforms(mat) {
      if (mat.userData && mat.userData._hueU) return mat.userData._hueU;
      mat.userData = mat.userData || {};
      const u = { uHue: { value: 0 }, uSat: { value: 0 }, uVal: { value: 1 }, uOn: { value: 0 } };
      mat.userData._hueU = u;
      mat.onBeforeCompile = hueOBC(u);
      mat.needsUpdate = true;
      return u;
    }
    function applyHueTint(mesh, hex, hsvOpt) {
      if (!mesh || !mesh.material || !mesh.material.map) return false;
      const u = ensureHueUniforms(mesh.material);
      if (!hex && !hsvOpt) {
        u.uOn.value = 0;
        return true;
      }
      if (hsvOpt) {
        u.uHue.value = hsvOpt.h || 0;
        u.uSat.value = hsvOpt.s == null ? 0 : hsvOpt.s;
        u.uVal.value = hsvOpt.v == null ? 1 : hsvOpt.v;
      } else {
        const hsv = rgbHexToHsv(hex);
        u.uHue.value = hsv.h;
        u.uSat.value = hsv.s;
        u.uVal.value = 1;
      }
      u.uOn.value = 1;
      return true;
    }
    return {
      FLAT_EMISSIVE: FLAT,
      setFaceMap,
      applyLightPresetToInstance,
      applyPartMatTone,
      baseFlatOf,
      rgbHexToHsv,
      hsvToHex,
      isHueTintMesh,
      hueOBC,
      ensureHueUniforms,
      applyHueTint
    };
  }

  // src/parts.ts
  var COL_RE = /_col(\d*)/i;
  function createParts(deps) {
    const { THREE } = deps;
    if (!THREE) throw new Error("char-core: deps.THREE 가 필요하다");
    if (!deps.tone) throw new Error("char-core: deps.tone 이 필요하다");
    const log = deps.log || ((m) => console.log(m));
    const warn = deps.warn || ((m, e) => console.warn(m, e));
    const cloneScene = (scene) => THREE.SkeletonUtils ? THREE.SkeletonUtils.clone(scene) : scene.clone(true);
    function prepMaterial(o) {
      o.castShadow = true;
      o.frustumCulled = false;
      const m = o.material && o.material.clone ? o.material.clone() : o.material;
      o.material = m;
      if (m) {
        deps.applyPartMatTone(m);
        if (m.transparent) {
          o.renderOrder = 10;
          deps.forceOpaqueAlphaOutput(m);
        }
      }
      return m;
    }
    function addColorGroup(groups, o, m, meshNameFirst) {
      const colMatch = (meshNameFirst ? o.name.match(COL_RE) : o.name && o.name.match(COL_RE)) || m && m.name && m.name.match(COL_RE);
      if (!colMatch) return;
      const key = "col" + (colMatch[1] || "1");
      if (m && m.color) o.userData.origColor = m.color.getHexString();
      (groups[key] = groups[key] || []).push(o);
    }
    function prepareScene(scene, cat, hooks = {}) {
      const obj = cloneScene(scene);
      const colorGroups = {};
      const picMeshes = [];
      obj.traverse((o) => {
        if (!o.isMesh) return;
        const m = prepMaterial(o);
        if (deps.meshIsPic(o)) {
          if (deps.picRepairUV(o) && hooks.onPicUvRepaired) hooks.onPicUvRepaired(o);
          picMeshes.push(o);
          return;
        }
        if (m && m.map && deps.uvLooksBroken(o) && hooks.onUvBroken) hooks.onUvBroken(o);
        addColorGroup(colorGroups, o, m, true);
      });
      obj.name = "__part_" + cat;
      obj.traverse((o) => {
        if (o.isBone) {
          o.userData = o.userData || {};
          o.userData._partAdopted = true;
        }
      });
      return { obj, colorGroups, picMeshes };
    }
    function collectCharBones(charRoot, into = {}) {
      for (const k in into) delete into[k];
      if (charRoot) charRoot.traverse((o) => {
        if (o.isBone && !(o.userData && o.userData._partAdopted) && !into[o.name]) into[o.name] = o;
      });
      return into;
    }
    function hasSkinnedChar(charRoot) {
      let has = false;
      if (charRoot) charRoot.traverse((o) => {
        if (o.isSkinnedMesh && !String(o.name || "").startsWith("__part")) has = true;
      });
      return has;
    }
    function skinnedMeshesOf(obj) {
      const out = [];
      obj.traverse((o) => {
        if (o.isSkinnedMesh) out.push(o);
      });
      return out;
    }
    function isRiggedPart(skinnedMeshes, charBones, o) {
      return !o.standalone && skinnedMeshes.length > 0 && skinnedMeshes.some((sm) => {
        if (!sm.skeleton) return false;
        const total = sm.skeleton.bones.length;
        const matched = sm.skeleton.bones.filter((b) => !!charBones[b.name]).length;
        if (total === 0) return false;
        if (matched === total && o.rigFamilyMatches) return true;
        return matched >= Math.max(2, Math.ceil(total / 2));
      });
    }
    function rebindRigged(skinnedMeshes, charBones) {
      const bindCenter = new THREE.Vector3();
      let bcCount = 0;
      const adoptedBones = [];
      skinnedMeshes.forEach((sm) => {
        sm.userData._origBind = sm.bindMatrix.clone();
        if (sm.geometry) {
          sm.geometry.computeBoundingBox();
          const c0 = sm.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(sm.userData._origBind);
          bindCenter.add(c0);
          bcCount++;
        }
        const src = sm.skeleton;
        const mapped = src.bones.map((b) => {
          if (charBones[b.name]) return charBones[b.name];
          let host = null, p = b.parent;
          while (p) {
            if (p.isBone && charBones[p.name]) {
              host = charBones[p.name];
              break;
            }
            p = p.parent;
          }
          (host || charBones["spine"] || Object.values(charBones)[0])?.add(b);
          b.userData._partAdopted = true;
          adoptedBones.push(b);
          return b;
        });
        sm.bind(new THREE.Skeleton(mapped, src.boneInverses.map((m4) => m4.clone())), sm.bindMatrix);
        sm.frustumCulled = false;
      });
      if (bcCount) bindCenter.multiplyScalar(1 / bcCount);
      return { bindCenter, adoptedBones };
    }
    function wrapPart(obj, cat, isRigged) {
      const bb = new THREE.Box3().setFromObject(obj);
      const center = isRigged ? new THREE.Vector3() : bb.getCenter(new THREE.Vector3());
      if (!isRigged) obj.position.sub(center);
      const wrapper = new THREE.Group();
      wrapper.name = "__partWrap_" + cat;
      wrapper.add(obj);
      wrapper.userData.baseCenter = center.clone();
      return { wrapper, bb, center };
    }
    function charBoneBindInverses(modelRoot) {
      const out = {};
      if (!modelRoot) return out;
      modelRoot.traverse((o) => {
        if (!o.isSkinnedMesh || !o.skeleton) return;
        if (String(o.name || "").indexOf("__part") === 0) return;
        if (o.userData && o.userData._origBind) return;
        let p = o, isPart = false;
        while (p && p !== modelRoot) {
          if (typeof p.name === "string" && p.name.indexOf("__partWrap_") === 0) {
            isPart = true;
            break;
          }
          p = p.parent;
        }
        if (isPart) return;
        const sk = o.skeleton;
        (sk.bones || []).forEach((b, i) => {
          if (!b || !b.name || out[b.name]) return;
          const inv = sk.boneInverses && sk.boneInverses[i];
          if (inv) out[b.name] = inv;
        });
      });
      return out;
    }
    function isLegacyAuthorCompensation(pos, ao) {
      if (!ao || !pos) return false;
      const L2 = ao.lengthSq();
      if (!(L2 > 1e-6)) return false;
      const dot = (+pos[0] || 0) * ao.x + (+pos[1] || 0) * ao.y + (+pos[2] || 0) * ao.z;
      return -dot / L2 >= 0.5;
    }
    function computeAuthorOffset(bb, center, bone, modelRoot, cat, charBones, defaultOffsets) {
      try {
        if (!bb || bb.isEmpty() || !center || !bone || !modelRoot) return null;
        const size = bb.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        if (!(maxDim > 1e-6)) return null;
        modelRoot.updateMatrixWorld(true);
        const bp = new THREE.Vector3();
        const binds = charBoneBindInverses(modelRoot);
        const m4 = new THREE.Matrix4();
        const bonePos = (nm, cb) => {
          const inv = binds[nm];
          if (inv) return bp.setFromMatrixPosition(m4.copy(inv).invert());
          cb.getWorldPosition(bp);
          modelRoot.worldToLocal(bp);
          return bp;
        };
        let dNear = Infinity, nearName = "", boneSpread = 0;
        for (const nm in charBones || {}) {
          const cb = charBones[nm];
          if (!cb) continue;
          bonePos(nm, cb);
          const bl = bp.length();
          if (bl > boneSpread) boneSpread = bl;
          const dd = center.distanceTo(bp);
          if (dd < dNear) {
            dNear = dd;
            nearName = nm;
          }
        }
        if (!isFinite(dNear)) return null;
        const dOrigin = center.length();
        const ok = boneSpread > maxDim * 0.5 && dOrigin > maxDim * 0.5 && dNear < dOrigin * 0.5;
        if (!ok) {
          if (dOrigin > maxDim * 0.5) log("[파츠 저작오프셋] " + cat + " — 보정 안 함(원점 기준 저작으로 판정). 최근접본 " + (nearName || "?") + "까지 " + dNear.toFixed(3) + " / 원점거리 " + dOrigin.toFixed(3) + " (임계 " + (dOrigin * 0.5).toFixed(3) + ") / 본 퍼짐 " + boneSpread.toFixed(3) + " / 파츠크기 " + maxDim.toFixed(3));
          return null;
        }
        const boneLocal = bone.getWorldPosition(new THREE.Vector3());
        modelRoot.worldToLocal(boneLocal);
        const bindInv = binds[bone.name];
        let want;
        if (bindInv) want = center.clone().applyMatrix4(bindInv);
        else {
          want = modelRoot.localToWorld(center.clone());
          bone.worldToLocal(want);
        }
        const off = center.clone().sub(want);
        if (!isFinite(off.x) || !isFinite(off.y) || !isFinite(off.z)) return null;
        const dOff = defaultOffsets[cat];
        if (dOff && isLegacyAuthorCompensation([dOff.x, dOff.y, dOff.z], off)) {
          log("[파츠 저작오프셋] " + cat + " — PART_DEFAULT_OFFSET(" + dOff.x + ", " + dOff.y + ", " + dOff.z + ")이 이미 같은 양을 눌러 맞춰둔 카테고리라 보정 생략(이중 보정 방지). 계산된 상쇄량은 (" + off.x.toFixed(3) + ", " + off.y.toFixed(3) + ", " + off.z.toFixed(3) + ")");
          return null;
        }
        log("[파츠 저작오프셋] " + cat + " — 캐릭터에 씌운 채 저작된 파츠로 판정, 상쇄 적용 (" + off.x.toFixed(3) + ", " + off.y.toFixed(3) + ", " + off.z.toFixed(3) + ") | 파츠중심 (" + center.x.toFixed(3) + ", " + center.y.toFixed(3) + ", " + center.z.toFixed(3) + ") / 부착본 " + (bone.name || "?") + " (" + boneLocal.x.toFixed(3) + ", " + boneLocal.y.toFixed(3) + ", " + boneLocal.z.toFixed(3) + ") / 최근접본 " + (nearName || "?") + "까지 " + dNear.toFixed(3) + " < 원점거리 " + dOrigin.toFixed(3) + "×0.5 / 파츠크기 " + maxDim.toFixed(3));
        return off;
      } catch (e) {
        warn("[파츠 저작오프셋] 계산 실패 — 보정 생략", e);
        return null;
      }
    }
    function riggedBaseCenter(wrapper, skinnedMeshes, charRoot) {
      wrapper.updateMatrixWorld(true);
      const skinBB = new THREE.Box3();
      skinnedMeshes.forEach((sm) => {
        sm.updateMatrixWorld(true);
        const bb = new THREE.Box3().setFromObject(sm);
        if (bb.isEmpty()) return;
        if (skinBB.isEmpty()) skinBB.copy(bb);
        else skinBB.union(bb);
      });
      if (skinBB.isEmpty()) return null;
      const local = skinBB.getCenter(new THREE.Vector3()).clone();
      charRoot.worldToLocal(local);
      return local;
    }
    function prepareExtra(scene, cat, i) {
      const obj = cloneScene(scene);
      const colorGroups = {};
      obj.traverse((o) => {
        if (!o.isMesh) return;
        const m = prepMaterial(o);
        addColorGroup(colorGroups, o, m, false);
      });
      obj.name = "__part_" + cat + "_i" + i;
      const bb = new THREE.Box3().setFromObject(obj);
      const center = bb.getCenter(new THREE.Vector3());
      obj.position.sub(center);
      const wrapper = new THREE.Group();
      wrapper.name = "__partWrap_" + cat + "_i" + i;
      wrapper.add(obj);
      wrapper.userData.baseCenter = center.clone();
      return { wrapper, obj, colorGroups };
    }
    function applyXfToWrapper(wrp, xf, cat, o) {
      if (!wrp || !wrp.userData || !wrp.userData.baseCenter) return;
      if (!xf) xf = o.defaultXf();
      const ahdy = +wrp.userData.animalHeadDy || 0;
      const rot = xf.rot, pos = xf.pos;
      if (wrp.userData.rigged) {
        const bc = wrp.userData.rigBindCenter || new THREE.Vector3();
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2]));
        const M = new THREE.Matrix4().compose(
          new THREE.Vector3(bc.x + pos[0], bc.y + pos[1] + ahdy, bc.z + pos[2]),
          q,
          new THREE.Vector3(xf.scale, xf.scale, xf.scale)
        ).multiply(new THREE.Matrix4().makeTranslation(-bc.x, -bc.y, -bc.z));
        (wrp.userData.rigSkinnedMeshes || []).forEach((sm) => {
          if (sm.userData._origBind) sm.bindMatrix.copy(M).multiply(sm.userData._origBind);
        });
        const c = wrp.userData.baseCenter || new THREE.Vector3();
        wrp.position.set(c.x + pos[0], c.y + pos[1] + ahdy, c.z + pos[2]);
        wrp.rotation.set(rot[0], rot[1], rot[2]);
        wrp.scale.setScalar(xf.scale);
      } else {
        const c = wrp.userData.baseCenter;
        wrp.position.copy(c);
        const ao = wrp.userData.authorOff || null;
        if (ao) wrp.position.sub(ao);
        const dOff = o.defaultOffsets[cat];
        if (dOff) {
          wrp.position.x += dOff.x;
          wrp.position.y += dOff.y;
          wrp.position.z += dOff.z;
        }
        if (wrp.userData._aoLegacy === void 0) wrp.userData._aoLegacy = !!(ao && isLegacyAuthorCompensation(pos, ao));
        const legacy = wrp.userData._aoLegacy;
        wrp.position.x += pos[0] + (legacy ? ao.x : 0);
        wrp.position.y += pos[1] + (legacy ? ao.y : 0) + ahdy;
        wrp.position.z += pos[2] + (legacy ? ao.z : 0);
        wrp.rotation.set(rot[0], rot[1], rot[2]);
        wrp.scale.setScalar(xf.scale);
      }
      wrp.updateMatrix();
      wrp.updateMatrixWorld(true);
      if (xf.color && wrp.userData.colorGroups) {
        for (const key in wrp.userData.colorGroups) {
          const c = xf.color[key];
          if (c) wrp.userData.colorGroups[key].forEach((m) => {
            if (!m.material) return;
            if (deps.tone.isHueTintMesh(m)) {
              deps.tone.applyHueTint(m, c, xf.colorHSV && xf.colorHSV[key]);
              m.material.needsUpdate = true;
              return;
            }
            if (m.material.color) m.material.color.set(c);
            if (m.material.emissive) m.material.emissive.set(c).multiplyScalar(deps.tone.baseFlatOf(m.material));
            m.material.needsUpdate = true;
          });
        }
      }
      if (o.applyPic) o.applyPic(wrp, xf.pic);
    }
    return {
      applyXfToWrapper,
      prepareScene,
      collectCharBones,
      hasSkinnedChar,
      skinnedMeshesOf,
      isRiggedPart,
      rebindRigged,
      wrapPart,
      charBoneBindInverses,
      isLegacyAuthorCompensation,
      computeAuthorOffset,
      riggedBaseCenter,
      prepareExtra
    };
  }

  // src/index.ts
  var THREE_REVISION = "128";
  var VERSION = "0.2.0";
  function createCharCore(deps) {
    const THREE = deps?.THREE;
    if (!THREE) throw new Error("char-core: deps.THREE 가 필요하다");
    if (THREE.REVISION !== THREE_REVISION) {
      throw new Error(`char-core: three r${THREE_REVISION} 에 맞춘 판이다 — 받은 것 r${THREE.REVISION}`);
    }
    return Object.freeze({ version: VERSION, threeRevision: THREE.REVISION });
  }
  return __toCommonJS(index_exports);
})();
