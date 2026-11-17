// 사람 이름을 화면 글로 바꾸는 한 곳.
// 서버는 이름이 없는 사람을 null 로 준다. «이름 없음» 은 그릴 때만 붙이고 데이터 층(모델 · 포트 · 보내는 값)에는 적지 않는다.

/** 이름이 없는 사람을 그릴 글. */
export const NO_NAME = '이름 없음';

/** 화면에 그릴 이름 — 앞뒤 공백을 걷은 글, 없으면(null · undefined · 빈 글 · 공백뿐) «이름 없음». */
export function shownName(name: string | null | undefined): string {
  return name?.trim() || NO_NAME;
}
