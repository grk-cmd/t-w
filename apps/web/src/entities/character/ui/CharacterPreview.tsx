import { useEffect, useRef } from 'react';
import type { CharKit } from '../lib/char-kit';
import { CREATOR_LIGHT_SL, FILL_LIGHT_MUL, KEY_LIGHT_MUL, LIGHT_PRESET, MAIN_LIGHT_INT } from '@tw/char-core';

export interface PreviewLook {
  /** 피부 위에 그림을 얹은 얼굴 텍스처(512) — 장면이 이 캔버스를 텍스처로 쓴다 */
  faceTexture: HTMLCanvasElement;
  /** 얼굴 텍스처 캔버스를 지금 모습으로 다시 그린다 — 모습이 바뀔 때마다 새 함수(장면이 부르고 텍스처를 새로 올린다) */
  paintFace: () => void;
  top: string;
  bot: string;
}

const W = 300;
const H = 380;

/** 3D 미리보기 — 끌어서 돌린다. 장면은 한 번만 만들고 텍스처 · 색만 바꾼다. */
export function CharacterPreview({ kit, look, label }: { kit: CharKit; look: PreviewLook; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<ReturnType<typeof buildScene> | null>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const s = buildScene(kit, cv, look.faceTexture);
    sceneRef.current = s;
    return () => {
      s.dispose();
      sceneRef.current = null;
    };
    // 장면은 kit 이 바뀔 때만 만든다 — 모습(텍스처 · 색)은 아래 효과가 맞춘다
  }, [kit, look.faceTexture]);

  useEffect(() => {
    sceneRef.current?.update(look);
  }, [look]);

  return (
    <canvas ref={canvasRef} className="char-preview" width={W} height={H} role="img" aria-label={label} />
  );
}

function buildScene(kit: CharKit, cv: HTMLCanvasElement, faceCanvas: HTMLCanvasElement) {
  const { THREE } = kit;
  const renderer = new THREE.WebGLRenderer({
    canvas: cv,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setSize(W, H, false);

  const scene = new THREE.Scene();
  // 앱 생성기 미리보기와 같은 빛 — 숫자는 코어 한 벌
  const col = new THREE.Color().setHSL(LIGHT_PRESET.h, CREATOR_LIGHT_SL.s, CREATOR_LIGHT_SL.l);
  scene.add(new THREE.AmbientLight(col, 0.95 * MAIN_LIGHT_INT));
  const key = new THREE.DirectionalLight(col, MAIN_LIGHT_INT * KEY_LIGHT_MUL);
  key.position.set(0, 4, 0);
  scene.add(key);
  const fill = new THREE.DirectionalLight(col, MAIN_LIGHT_INT * FILL_LIGHT_MUL);
  fill.position.set(0.5, 1.0, 3);
  scene.add(fill);

  const faceTex = new THREE.CanvasTexture(faceCanvas);
  faceTex.flipY = false;
  faceTex.encoding = THREE.sRGBEncoding;
  const ch = kit.body.assemble({
    faceTex,
    blinkTex: faceTex,
    top: '#9dba8a',
    bot: '#d98e73',
    recolor: true,
    skinColor: '#FFE0BD',
  });
  scene.add(ch.group);

  const box = new THREE.Box3().setFromObject(ch.group);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
  const dist = (size.y / 2 / Math.tan((cam.fov * Math.PI) / 360)) * 1.15;
  let yaw = 0;
  const place = () => {
    cam.position.set(
      center.x + Math.sin(yaw) * dist,
      center.y + size.y * 0.05,
      center.z + Math.cos(yaw) * dist,
    );
    cam.lookAt(center);
  };
  place();

  let raf = 0;
  const draw = () => {
    raf = 0;
    renderer.render(scene, cam);
  };
  const request = () => {
    if (!raf) raf = requestAnimationFrame(draw);
  };

  // 끌어서 돌리기 — 놓으면 그 자리에 멈춘다(계속 그리지 않는다)
  let dragX: number | null = null;
  const down = (e: PointerEvent) => {
    dragX = e.clientX;
    cv.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    if (dragX === null) return;
    yaw -= (e.clientX - dragX) * 0.01;
    dragX = e.clientX;
    place();
    request();
  };
  const up = () => {
    dragX = null;
  };
  cv.addEventListener('pointerdown', down);
  cv.addEventListener('pointermove', move);
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  request();

  return {
    update(look: PreviewLook) {
      look.paintFace();
      faceTex.needsUpdate = true;
      if (ch.upMat) ch.upMat.color.set(look.top);
      if (ch.loMat) ch.loMat.color.set(look.bot);
      if (ch.hatMat && ch.hatMat.color) ch.hatMat.color.set(look.top);
      // 색을 바꾸면 emissive(평탄 조명 몫)도 그 색으로 다시 — 앱 생성기와 같다
      kit.tone.applyLightPresetToInstance({ upMat: ch.upMat, loMat: ch.loMat, hatMat: ch.hatMat });
      request();
    },
    dispose() {
      if (raf) cancelAnimationFrame(raf);
      cv.removeEventListener('pointerdown', down);
      cv.removeEventListener('pointermove', move);
      cv.removeEventListener('pointerup', up);
      cv.removeEventListener('pointercancel', up);
      faceTex.dispose();
      renderer.dispose();
    },
  };
}
