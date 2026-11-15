import type { Announce } from '../model/announce';

/** 상단 공지(확성기) — 앱이 캐릭터 머리 위에 1분 동안 띄운다. */
export interface AnnouncePort {
  /** 서버에서 «지금 떠 있는 공지» 를 읽을 수 있나 — 못 읽는 판은 이 화면에서 보낸 것만 알고, 끄기는 늘 열어 둔다. */
  readonly readsCurrent: boolean;
  /** 지금 떠 있는(또는 마지막) 공지. 없으면 null. */
  get(): Promise<Announce | null>;
  publish(text: string): Promise<void>;
  clear(): Promise<void>;
  /** 서버 시각 − 이 PC 시각(ms) — 남은 시간을 서버 시계로 잰다. */
  serverTimeOffset(): Promise<number>;
}
