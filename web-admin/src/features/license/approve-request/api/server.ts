import { notPorted } from '@/shared/api';
import type { ApproveRequestPort } from './port';

// API 판은 D12-4b 에서 — 그때까지 부르면 «아직 API 판이 없어요».
export const createServerApproveRequestPort = (): ApproveRequestPort => notPorted('license/approve-request');
