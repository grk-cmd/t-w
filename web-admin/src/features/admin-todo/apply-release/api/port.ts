import type { Versioned } from '@/shared/api';
import type { ApplyOptions, ApplyResult, FixTarget, TplVars } from '../model/applyRelease';
import type { ReleaseTemplate } from '../model/releaseTpl';

/** 🏷 릴리스 반영 — 완료 · 출시된 할 일에 걸린 제보를 «수정 완료» 로 + 답변 틀. */
export interface ApplyReleasePort {
  /** 틀 입력 곁 안내 — 문제없으면 null. 판정이 서버 몫인 판은 늘 null. */
  check(template: string): string | null;
  /** 틀 → 답변 글. */
  fill(template: string, vars: TplVars): string;
  /** 관리자끼리 쓰는 답변 틀. 화면이 캐시에 이 모양 그대로 두었다가 저장할 때 돌려준다. */
  template(): Promise<Versioned<ReleaseTemplate>>;
  /** 틀 저장(null 이면 지워서 기본 문구로) — 화면이 읽은 틀을 그대로 받는다. */
  saveTemplate(from: Versioned<ReleaseTemplate>, template: string | null): Promise<void>;
  /** 확인 창에 보일 반영 대상 제보 — 오래된 글부터. */
  preview(latest: string): Promise<FixTarget[]>;
  apply(targets: readonly FixTarget[], opts: ApplyOptions): Promise<ApplyResult>;
}
