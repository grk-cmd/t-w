// 앱이 켜질 때 updateNotice/current 를 읽어 팝업한다. ts 는 «다시 보지 않기» 를 가르는 판 번호라 고쳐 쓰면 다시 뜬다.
export interface UpdateNotice {
  title: string;
  body: string;
  ts: number;
}

export const NOTICE_TITLE_MAX = 60; // 규칙 updateNotice/current .validate
export const NOTICE_BODY_MAX = 800;

/** 입력이 모자라면 알려 줄 문장, 괜찮으면 null. */
export function checkUpdateNotice(title: string, body: string): string | null {
  return title.trim() && body.trim() ? null : '제목과 본문을 모두 입력해 주세요';
}
