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
    unb64: () => unb64
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
