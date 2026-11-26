// API 판 — 설정 키 `app.minVersion` · `room.minVersion`(문자열 또는 null). 서버가 «공개된 최신 릴리스보다 높으면» 거절한다.
import { opsConfigClient, wireNullableString, type Api } from '@/shared/api';
import type { MinVersionKind } from '../model/minVersion';
import type { MinVersionPort } from './port';

const KEY: Record<MinVersionKind, string> = { room: 'room.minVersion', app: 'app.minVersion' };

export function createServerMinVersionPort(api: Api | null): MinVersionPort {
  const config = opsConfigClient(api);
  return {
    async get(kind) {
      const { effective, version } = await config.read(KEY[kind]);
      return { value: wireNullableString(effective, KEY[kind]), version };
    },
    async save(kind, from, version) {
      await config.write(KEY[kind], from.version, version.trim());
    },
  };
}
