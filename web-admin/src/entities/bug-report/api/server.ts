// API 판 — 설정 키 `bug.report` = { notice(1~600자), link(0~300자 · 비면 앱의 [제보하기] 꺼짐 · 오픈채팅 주소) }.
// 저장 시각 칸(`ts`)은 서버에 없다 — 화면은 `ts` 가 없으면 «마지막 저장» 줄을 숨긴다.
import { opsConfigClient, wireObject, wireString, type Api } from '@/shared/api';
import { BUG_LINK_MAX, BUG_NOTICE_MAX, type BugReport } from '../model/bugReport';
import type { BugReportPort } from './port';

const KEY = 'bug.report';

export function createServerBugReportPort(api: Api | null): BugReportPort {
  const config = opsConfigClient(api);
  return {
    async get() {
      const { effective, version } = await config.read(KEY);
      const v = wireObject(effective, KEY);
      const report: BugReport = {
        notice: wireString(v.notice, `${KEY}.notice`),
        link: wireString(v.link, `${KEY}.link`),
      };
      return { value: report, version };
    },
    async save(from, notice, link) {
      await config.write(KEY, from.version, {
        notice: notice.trim().slice(0, BUG_NOTICE_MAX),
        link: link.trim().slice(0, BUG_LINK_MAX),
      });
    },
  };
}
