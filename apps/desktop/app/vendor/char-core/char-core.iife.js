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
    CLONE_CODE_PREFIX: () => CLONE_CODE_PREFIX,
    CLONE_TEX_SIZE: () => CLONE_TEX_SIZE,
    THREE_REVISION: () => THREE_REVISION,
    VERSION: () => VERSION,
    b64: () => b64,
    clonePayload: () => clonePayload,
    createCharCore: () => createCharCore,
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
