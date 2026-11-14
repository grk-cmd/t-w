import { notPorted } from '@/shared/api';
import type { MinVersionPort } from './port';

// API 판은 D12-1b 에서 — 그때까지 부르면 «아직 API 판이 없어요».
export const createServerMinVersionPort = (): MinVersionPort => notPorted('min-version');
