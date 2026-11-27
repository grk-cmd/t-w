/* 💡 화면 밝기 예산 · GLB 재질 고치기 — 앱(실행 화면 · 생성기 · 미리보기)과 웹 생성기가 같은 한 벌을 쓴다.
   흰 면(알베도 1.0)이 받는 빛 = 앰비언트(0.95 × 주광) + 정수리 키(주광 × 키 배율, 위를 보는 면만)
     + 정면 필(주광 × 필 배율, 카메라를 보는 면만) + 플랫 emissive(모든 면).
   합이 1.0 을 넘는 면은 «알베도 × 합» 이 1 을 넘는 곳부터 255 로 잘려 밝은 계조가 사라진다.
   ★ 화면 밝기의 손잡이는 TONE_FRONT_TOTAL 하나 — 플랫 몫이 남는 예산을 받아 가므로 다른 상수는 «어디에 얼마를» 만 바꾼다. */

/** 생성기 · 실행 화면 공용 조명 프리셋 — b 밝기 · h 빛 색상(HSL) · e 노출 */
export const LIGHT_PRESET: Readonly<{ b: number; h: number; e: number }> = Object.freeze({ b: 1.2, h: 0.09, e: 0.46 });

/** 주광 세기(= b × e) */
export const MAIN_LIGHT_INT = LIGHT_PRESET.b * LIGHT_PRESET.e;

/** 정수리 키 배율 — 위를 보는 면이 정면보다 얼마나 더 받는가. 올리면 흰 윗면이 먼저 잘린다. */
export const KEY_LIGHT_MUL = 0.29;

/** 정면 필 배율 — 카메라를 보는 면. 올리면 플랫 몫이 그만큼 줄어 정면 밝기는 그대로 · 측면 대비만 세진다. */
export const FILL_LIGHT_MUL = 0.29;

/** 카메라를 보는 흰 면이 받는 빛의 총합(1.0 = 텍스처 값 그대로). 밝기 제보는 이 숫자 하나만 옮긴다.
    ⚠️ 1.16 에서 측면 몫이 1.0 이 된다 — 더 올리면 밝아지지 않고 계조만 사라진다. */
export const TONE_FRONT_TOTAL = 1.05;

/** 예산에서 남는 플랫 emissive 몫 — 조명이 예산을 넘으면 0(음수로 안 내려간다) */
export function flatEmissive(mainLightInt: number, fillLightMul: number, total: number = TONE_FRONT_TOTAL): number {
  return Math.max(0, total - 0.95 * mainLightInt - mainLightInt * fillLightMul);
}

export const FLAT_EMISSIVE = flatEmissive(MAIN_LIGHT_INT, FILL_LIGHT_MUL);

/** 생성기 미리보기 빛의 채도 · 명도(색상은 LIGHT_PRESET.h). 실행 화면 빛은 거의 백색이라 따로다. */
export const CREATOR_LIGHT_SL: Readonly<{ s: number; l: number }> = Object.freeze({ s: 0.45, l: 0.85 });

/** 재질 고치기가 보는 몫 — three MeshStandardMaterial 의 일부 */
export interface LitMaterialLike {
  name?: string;
  isMeshStandardMaterial?: boolean;
  metalness?: number;
  roughness?: number;
  metalnessMap?: unknown;
  aoMap?: unknown;
  lightMap?: unknown;
  vertexColors?: boolean;
  needsUpdate?: boolean;
}

/** GLB 재질을 이 장면(환경맵 없음 · 밝기 대부분이 앰비언트 + emissive)에 맞게 눕힌다. 캐릭터 · 파츠 · 아이템 · 책상이 모두 지난다.
    - metalness: glTF 기본값이 1 이라 손 안 댄 재질은 완전 금속 → 환경맵이 없어 조명을 못 받는다. metalnessMap 이 있으면 제작자가 칠한 금속이라 둔다.
    - aoMap: 앰비언트에만 곱해져 그 파츠만 회색으로 앉는다. lightMap: 씬 조명과 이중으로 얹힌다.
    - vertexColors: 확산광에만 곱해지고 emissive 몫엔 안 곱해져 톤이 어긋난다(옷 색도 코드가 정한다).
    log 를 주면 고친 것 · 못 고친 금속(metalnessMap)을 한 줄씩 남긴다 — «이 파츠만 어둡다» 를 콘솔에서 바로 찾게. */
export function fixMatLighting(m: LitMaterialLike | null | undefined, log?: (msg: string) => void): void {
  if (!m) return;
  const found: string[] = [];
  // 칸이 없으면 고칠 일도 없다 — 금속도는 0, 거칠기는 1 로 본다
  const metal = m.metalness ?? 0;
  if (m.isMeshStandardMaterial && !m.metalnessMap && metal > 0.6) {
    found.push('metalness ' + metal.toFixed(2) + '→0.1');
    m.metalness = 0.1;
    if ((m.roughness ?? 1) < 0.2) m.roughness = 0.6; // 완전 매끈이면 하이라이트만 튄다
  }
  if (m.aoMap) {
    found.push('aoMap 제거(앰비언트를 깎고 있었음)');
    m.aoMap = null;
  }
  if (m.lightMap) {
    found.push('lightMap 제거');
    m.lightMap = null;
  }
  if (m.vertexColors) {
    found.push('vertexColors 끔(확산광만 깎여 톤이 어긋남)');
    m.vertexColors = false;
  }
  const name = m.name || '(이름 없음)';
  if (found.length) {
    m.needsUpdate = true;
    log?.('[재질 정규화] ' + name + ' — ' + found.join(' · '));
  }
  // 고치지 않고 알리기만 — 제작자가 의도했을 수 있다
  if (m.isMeshStandardMaterial && m.metalnessMap && metal > 0.6) {
    log?.(
      '[재질 주의] ' + name +
        ' — metalnessMap 이 있어 금속도를 안 건드렸습니다. 이 파츠가 어둡게 나오면 제작 툴에서 Metallic 을 0 으로 두고 다시 내보내 주세요',
    );
  }
}
