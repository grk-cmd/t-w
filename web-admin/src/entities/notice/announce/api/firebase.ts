// Firebase 판 — 지금 코드 그대로: announce/current 를 읽고 쓴다.
import { withAudit, type Db } from '@/shared/api';
import { ANNOUNCE_DURATION, ANNOUNCE_TEXT_MAX, type Announce } from '../model/announce';
import type { AnnouncePort } from './port';

const PATH = 'announce/current';

export function getAnnounce(db: Db): Promise<Announce | null> {
  return db.get<Announce>(PATH);
}

// ts 는 서버 시각 — 관리자 PC 시계가 틀려도 모두에게 같은 1분이 되게.
export function publishAnnounce(db: Db, text: string): Promise<void> {
  const value = { text: text.trim().slice(0, ANNOUNCE_TEXT_MAX), ts: db.now(), duration: ANNOUNCE_DURATION };
  return db.commit(withAudit(db, { [PATH]: value }, 'notice.announce', value.text));
}

export function clearAnnounce(db: Db): Promise<void> {
  return db.commit(withAudit(db, { [PATH]: null }, 'notice.announceClear', '상단 공지'));
}

export function createFirebaseAnnouncePort(db: Db): AnnouncePort {
  return {
    get: () => getAnnounce(db),
    publish: (text) => publishAnnounce(db, text),
    clear: () => clearAnnounce(db),
    serverTimeOffset: () => db.serverTimeOffset(),
  };
}
