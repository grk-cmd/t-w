import type { Db } from '@/shared/api';
import { INBOX_BODY_MAX, INBOX_BUG_ID_MAX, INBOX_TITLE_MAX, type PersonalMessage } from '../model/message';

function messageId(): string {
  return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** 수령함 메시지 한 통을 쓸 내용 — 키 발급과 한 묶음으로 보내 «키만 남고 배달은 안 된» 상태가 생기지 않게 한다. */
export function inboxMessageWrite(uid: string, message: PersonalMessage) {
  return {
    [`inbox/${uid}/${messageId()}`]: {
      tag: message.tag,
      title: message.title.slice(0, INBOX_TITLE_MAX),
      body: message.body.slice(0, INBOX_BODY_MAX),
      ts: Date.now(),
      read: false,
      ...(message.bugId ? { bugId: message.bugId.slice(0, INBOX_BUG_ID_MAX) } : {}),
    },
  };
}

export function sendInboxMessage(db: Db, uid: string, message: PersonalMessage): Promise<void> {
  return db.commit(inboxMessageWrite(uid, message));
}
