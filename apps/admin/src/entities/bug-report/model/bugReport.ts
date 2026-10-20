// 앱의 «버그 제보» 탭이 bugReport/current 를 구독해 공지와 [제보하기] 링크를 보여 준다.
export interface BugReport {
  notice: string;
  link?: string;
  ts: number;
}

export const BUG_NOTICE_MAX = 600; // 규칙 bugReport/current .validate
export const BUG_LINK_MAX = 300;

// 아직 아무도 저장하지 않았을 때 앱이 대신 보여 주는 글 — 앱 BUG_REPORT_DEFAULT_NOTICE 와 같다.
export const BUG_DEFAULT_NOTICE =
  '버그를 발견하셨나요?\n\n' +
  '아래 [제보하기] 버튼을 눌러 오픈채팅방으로 들어와 알려주세요.\n' +
  '어떤 상황에서 문제가 생겼는지 자세히 적어주시면 큰 도움이 됩니다.';

/** 입력이 잘못됐으면 알려 줄 문장, 괜찮으면 null. 링크는 비워 둘 수 있다(앱의 [제보하기] 가 꺼진다). */
export function checkBugReport(notice: string, link: string): string | null {
  if (!notice.trim()) return '공지 내용을 입력해 주세요';
  const url = link.trim();
  if (url && !/^https?:\/\//i.test(url)) return '링크는 http:// 또는 https:// 로 시작해야 해요';
  return null;
}
