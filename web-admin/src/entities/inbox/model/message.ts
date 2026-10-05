export type InboxTag = 'notice' | 'update' | 'reward';

export interface InboxMessage {
  tag: InboxTag;
  title: string;
  body: string;
}

export const INBOX_TITLE_MAX = 80; // 규칙 inbox · inboxBroadcast .validate
export const INBOX_BODY_MAX = 600;

// 앱 수령함의 태그 이름표(_inboxTagLabel)와 같다.
export const INBOX_TAG_LABEL: Record<InboxTag, string> = {
  notice: '📢 공지',
  update: '🆕 업데이트',
  reward: '📩 우편',
};

export function licenseGrantMessage(key: string): InboxMessage {
  return {
    tag: 'reward',
    title: '🎫 라이선스가 도착했어요',
    body: `아래 키를 [라이선스 등록] 창에 입력하면 프리미엄 기능을 쓸 수 있어요.\n\n${key}\n\n(설정 → 라이선스 등록)`,
  };
}
