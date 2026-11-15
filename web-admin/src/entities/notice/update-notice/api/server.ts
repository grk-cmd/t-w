import { notPorted } from '@/shared/api';
import type { UpdateNoticePort } from './port';

// API 판은 D12-2b 에서 — 그때까지 부르면 «아직 API 판이 없어요».
export const createServerUpdateNoticePort = (): UpdateNoticePort => notPorted('update-notice');
