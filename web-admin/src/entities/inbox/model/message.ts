export interface InboxMessage {
  tag: 'reward' | 'notice';
  title: string;
  body: string;
}

export function licenseGrantMessage(key: string): InboxMessage {
  return {
    tag: 'reward',
    title: '🎫 라이선스가 도착했어요',
    body: `아래 키를 [라이선스 등록] 창에 입력하면 프리미엄 기능을 쓸 수 있어요.\n\n${key}\n\n(설정 → 라이선스 등록)`,
  };
}
