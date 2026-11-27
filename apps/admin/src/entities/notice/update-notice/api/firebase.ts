// Firebase 판 — 지금 코드 그대로: updateNotice/current 를 읽고 쓴다.
import { withAudit, type Db } from '@/shared/api';
import { NOTICE_BODY_MAX, NOTICE_TITLE_MAX, type UpdateNotice } from '../model/updateNotice';
import type { UpdateNoticePort } from './port';

const PATH = 'updateNotice/current';

export function getUpdateNotice(db: Db): Promise<UpdateNotice | null> {
  return db.get<UpdateNotice>(PATH);
}

export function publishUpdateNotice(db: Db, title: string, body: string): Promise<void> {
  const value = {
    title: title.trim().slice(0, NOTICE_TITLE_MAX),
    body: body.trim().slice(0, NOTICE_BODY_MAX),
    ts: db.now(),
  };
  return db.commit(withAudit(db, { [PATH]: value }, 'notice.update', value.title));
}

export function clearUpdateNotice(db: Db): Promise<void> {
  return db.commit(withAudit(db, { [PATH]: null }, 'notice.updateClear', '업데이트 공지'));
}

export function createFirebaseUpdateNoticePort(db: Db): UpdateNoticePort {
  return {
    get: () => getUpdateNotice(db),
    publish: (title, body) => publishUpdateNotice(db, title, body),
    clear: () => clearUpdateNotice(db),
  };
}
