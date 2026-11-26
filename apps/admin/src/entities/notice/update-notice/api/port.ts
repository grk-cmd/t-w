import type { UpdateNotice } from '../model/updateNotice';

/** 업데이트 공지 — 앱이 켜질 때 한 번 팝업한다. 하나만 있다. */
export interface UpdateNoticePort {
  get(): Promise<UpdateNotice | null>;
  publish(title: string, body: string): Promise<void>;
  /** 화면이 본 공지를 내린다 — 그 사이 새 공지가 올라왔으면 엉뚱한 것을 내리지 않고 서버가 거절한다(`notFound`). */
  clear(notice: UpdateNotice): Promise<void>;
}
