// API 판 — 설정 키 `user.inviteGate`(참 · 거짓). «기존 사용자 가입» 스위치는 서버에 없다(로그인 없는 계정을 컷오버 때 지움).
import { opsConfigClient, PortError, wireBool, type Api } from '@/shared/api';
import { SIGNUP_FLAG_DEFAULT, type SignupFlag } from '../model/signupFlag';
import type { SignupFlagPort } from './port';

const FLAGS: readonly SignupFlag[] = ['inviteGate'];
const KEY = 'user.inviteGate';

export function createServerSignupFlagPort(api: Api | null): SignupFlagPort {
  const config = opsConfigClient(api);
  return {
    flags: FLAGS,
    async get() {
      const { effective, version } = await config.read(KEY);
      // `existingSignup` 은 서버에 없는 스위치다 — 화면이 이 판에서는 보이지 않는다(`flags`).
      return {
        value: { inviteGate: wireBool(effective, KEY), existingSignup: SIGNUP_FLAG_DEFAULT },
        version,
      };
    },
    async set(flag, from, value) {
      if (flag !== 'inviteGate') throw new PortError('invalid', '서버에 없는 스위치예요');
      await config.write(KEY, from.version, value);
    },
  };
}
