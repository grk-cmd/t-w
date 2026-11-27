// API 판 카탈로그 응답 줄 — 서버 JSON 처럼 없는 칸은 아예 싣지 않는다.
/** 서버 JSON 처럼 `undefined` 칸은 아예 없앤다(NON_NULL). */
const json = <T extends object>(o: T): T => JSON.parse(JSON.stringify(o)) as T;

export const listing = (state = 'ACTIVE', acquisition?: string) => ({
  state,
  access: { kind: 'EVERYONE', display: 'ALL' },
  ...(acquisition ? { acquisition: { kind: acquisition } } : {}),
});

export const part = (id: string, over: Record<string, unknown> = {}) =>
  json({
    partId: id,
    name: `${id} 이름`,
    icon: '🎩',
    category: 'hat',
    model: 'm',
    listing: listing('ACTIVE', 'GIVEN'),
    version: 2,
    equipCount: 7,
    ...over,
  });

export const category = (code: string, over: Record<string, unknown> = {}) =>
  json({
    code,
    builtin: true,
    group: 'HEAD',
    label: '모자',
    icon: '🎩',
    bone: 'head',
    position: 0,
    version: 3,
    defaultLabel: '모자',
    defaultIcon: '🎩',
    overridden: false,
    ...over,
  });
