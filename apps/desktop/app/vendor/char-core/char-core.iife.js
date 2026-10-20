/* @tw/char-core 0.1.0 — 생성 파일 · 고치지 말 것(packages/char-core 에서 npm run build) */
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
    THREE_REVISION: () => THREE_REVISION,
    VERSION: () => VERSION,
    createCharCore: () => createCharCore
  });
  var THREE_REVISION = "128";
  var VERSION = "0.1.0";
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
