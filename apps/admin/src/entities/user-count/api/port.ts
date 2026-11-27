/** 가입한 사람 수. */
export interface UserCountPort {
  get(): Promise<number>;
}
