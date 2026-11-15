import type { UpdateNotice } from '../model/updateNotice';

/** 업데이트 공지 — 앱이 켜질 때 한 번 팝업한다. 하나만 있다. */
export interface UpdateNoticePort {
  get(): Promise<UpdateNotice | null>;
  publish(title: string, body: string): Promise<void>;
  clear(): Promise<void>;
}
