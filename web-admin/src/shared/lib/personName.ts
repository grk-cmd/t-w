// 서버는 이름이 없는 사람을 null 로 준다. NO_NAME 은 화면에 그릴 때만 쓰고, 모델 · 포트 · 저장하는 값에는 넣지 않는다.

/** 이름이 없는 사람을 화면에 보일 placeholder. */
export const NO_NAME = '이름 없음';

// 옛 앱은 이름을 정하지 않은 사람의 name 에 이 글자를 저장했다.
const LEGACY_NO_NAME = '(이름 없음)';

/** 실제 이름 — 앞뒤 공백을 지운 값. null · 빈 문자열 · 공백뿐 · 옛 placeholder 이면 null. */
export function realName(name: string | null | undefined): string | null {
  const n = name?.trim();
  return n && n !== LEGACY_NO_NAME ? n : null;
}

/** 화면에 그릴 이름 — realName 이 null 이면 NO_NAME. */
export function shownName(name: string | null | undefined): string {
  return realName(name) ?? NO_NAME;
}
