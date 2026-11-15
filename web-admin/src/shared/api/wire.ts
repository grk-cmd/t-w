// API 판 응답을 읽는 엄격한 도우미 — 모양이 약속과 다르면 기본값 · 0 · 빈 값으로 덮지 않고 `PortError` 로 던진다.
import { PortError } from './backend';

/** 서버 응답이 약속한 모양이 아니다 — 화면은 «서버 응답이 이상해요» 로 알린다. */
export const WIRE_SHAPE_CODE = 'RESPONSE_SHAPE';

export function wireError(what: string, expected: string): PortError {
  return new PortError(
    'invalid',
    `서버 응답이 약속과 달라요 (${what}: ${expected} 가 와야 해요)`,
    WIRE_SHAPE_CODE,
  );
}

export function wireObject(value: unknown, what: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw wireError(what, '객체');
  return value as Record<string, unknown>;
}

export function wireArray(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value)) throw wireError(what, '목록');
  return value;
}

export function wireString(value: unknown, what: string): string {
  if (typeof value !== 'string') throw wireError(what, '글자');
  return value;
}

export function wireNullableString(value: unknown, what: string): string | null {
  if (value === null) return null;
  return wireString(value, what);
}

export function wireNumber(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw wireError(what, '숫자');
  return value;
}

export function wireBool(value: unknown, what: string): boolean {
  if (typeof value !== 'boolean') throw wireError(what, '참 · 거짓');
  return value;
}
