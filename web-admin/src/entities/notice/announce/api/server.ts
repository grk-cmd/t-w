import { notPorted } from '@/shared/api';
import type { AnnouncePort } from './port';

// API 판은 D12-2b 에서 — 그때까지 부르면 «아직 API 판이 없어요».
export const createServerAnnouncePort = (): AnnouncePort => notPorted('announce');
