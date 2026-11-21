import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDb, withAudit, type Db } from '@/shared/api';
import { NOTICE_BODY_MAX, NOTICE_TITLE_MAX, type UpdateNotice } from '../model/updateNotice';

const NOTICE_KEY = ['updateNotice'];
const PATH = 'updateNotice/current';

export function getUpdateNotice(db: Db): Promise<UpdateNotice | null> {
  return db.get<UpdateNotice>(PATH);
}

export function useUpdateNotice() {
  const db = useDb();
  return useQuery({ queryKey: NOTICE_KEY, queryFn: () => getUpdateNotice(db) });
}

export function useRefreshUpdateNotice() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: NOTICE_KEY });
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
