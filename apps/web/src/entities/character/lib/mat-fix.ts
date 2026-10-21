import type { MeshStandardMaterial } from 'three';

/** GLB 재질 조명 고치기 — 앱 `_fixGlbMatLighting`(apps/desktop app.js)과 같은 규칙. 환경맵 없는 장면에서 금속 · AO · 구운 빛 · 정점색이 화면을 깎는다.
    ⚠️ 앱 규칙이 바뀌면 같이 — 시험(tests/app-parity.test.ts)이 앱 원본과 견준다. */
export function fixMatLighting(m: MeshStandardMaterial | null | undefined) {
  if (!m) return;
  let changed = false;
  if (m.isMeshStandardMaterial && !m.metalnessMap && m.metalness > 0.6) {
    m.metalness = 0.1;
    if (m.roughness < 0.2) m.roughness = 0.6;
    changed = true;
  }
  if (m.aoMap) {
    m.aoMap = null;
    changed = true;
  }
  if (m.lightMap) {
    m.lightMap = null;
    changed = true;
  }
  if (m.vertexColors) {
    m.vertexColors = false;
    changed = true;
  }
  if (changed) m.needsUpdate = true;
}
