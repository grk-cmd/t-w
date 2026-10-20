export type InboxTag = 'notice' | 'update' | 'reward';

export interface InboxMessage {
  tag: InboxTag;
  title: string;
  body: string;
}

/**
 * 한 사람에게 보내는 메시지 — 공용 공지(InboxMessage)에 없는 «버그 답변» 알림까지.
 * bug 는 앱 수령함에서 누르면 bugId 의 글을 연다(앱 sendInboxMessage 와 같은 모양).
 */
export interface PersonalMessage {
  tag: InboxTag | 'bug';
  title: string;
  body: string;
  bugId?: string;
}

export const INBOX_BUG_ID_MAX = 40; // 규칙 inbox/$uid/$msgId bugId

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
