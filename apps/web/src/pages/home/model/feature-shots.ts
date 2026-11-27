/** 기능마다 옆에 보일 앱 화면 — 도움말 사이트(firebase/hosting/help/img)에 올린 캡처를 가져다 쓴다.
    순서는 문구의 features 와 같다(언어마다 같은 순서 · 개수는 시험이 본다) */
export const FEATURE_SHOTS = [
  { src: '/features/focus.webp', w: 260, h: 170 },
  { src: '/features/room.webp', w: 884, h: 784 },
  { src: '/features/myhome.webp', w: 1140, h: 840 },
  { src: '/features/dress.webp', w: 720, h: 1024 },
  { src: '/features/purikura.webp', w: 894, h: 566 },
  { src: '/features/touch.webp', w: 248, h: 236 },
] as const;
