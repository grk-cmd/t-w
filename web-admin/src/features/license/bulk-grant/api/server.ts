import { notPorted } from '@/shared/api';
import type { BulkGrantPort } from './port';

// API 판은 D12-4b 에서 — 그때까지 부르면 «아직 API 판이 없어요».
export const createServerBulkGrantPort = (): BulkGrantPort => notPorted('license/bulk-grant');
