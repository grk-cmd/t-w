import { encodeCloneCode, type DataUrlSource } from '@tw/char-core';

/** 웹에서 만든 캐릭터 — 코드에 싣는 칸은 앱 생성기와 같다(피부 · 얼굴 그림 · 감은눈 그림 · 상의 · 하의 색). 파츠 · 책상은 싣지 않는다. */
export interface WebCharacter {
  skin: number;
  face: DataUrlSource;
  blink: DataUrlSource;
  top: string;
  bot: string;
}

/** 앱에서의 크기 · 높이 · 돌림 — 앱 생성기의 처음 값과 같게 싣는다(없으면 앱이 1배로 띄워 앱에서 만든 캐릭터보다 훨씬 크다).
    값의 정본은 앱 creator-state.js 의 cXform 처음 값 — 시험이 둘이 같은지 본다. */
export const CREATOR_XF = { s: 0.7, y: 0, z: 0, rot: 0, x: 0 } as const;

/** 비밀번호 규칙은 앱과 같다 — 비어 있지만 않으면 된다(앱 «코드 입력하기» 가 같은 규칙으로 받는다) */
export const passwordOk = (p: string) => p.length > 0;

/** DCC1 코드 만들기 — 앱 «코드 입력하기» 가 읽는 바로 그 모양(코어 encodeCloneCode). */
export function makeCloneCode(ch: WebCharacter, password: string): Promise<string> {
  if (!passwordOk(password)) return Promise.reject(new Error('비밀번호가 비었다'));
  // 줄이기는 동물 그림에만 쓰인다 — 웹은 사람만이라 받은 그대로 돌려준다
  return encodeCloneCode({ ...ch, xf: { ...CREATOR_XF } }, password, {
    shrinkDataUrl: async (u) => (typeof u === 'string' ? u : null),
  });
}
