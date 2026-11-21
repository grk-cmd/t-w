import { describe, expect, it } from 'vitest';
import {
  assetKind,
  fetchReleaseDownloads,
  formatAge,
  isRateLimited,
  latestDownloads,
  parseReleases,
} from '@/entities/release';

const HOUR = 3_600_000;

const gh = (tag: string, publishedAt: string, assets: [string, number][], extra: object = {}) => ({
  tag_name: tag,
  published_at: publishedAt,
  draft: false,
  prerelease: false,
  body: '긴 릴리스 노트',
  assets: assets.map(([name, download_count]) => ({ name, download_count, size: 1 })),
  ...extra,
});

describe('릴리스 다운로드', () => {
  it('파일 이름으로 종류를 가른다 — 새 이름 · 옛 이름 dmg 둘 다, blockmap · zip 은 뺀다', () => {
    expect(assetKind('Together-Working-Setup-0.10.2.exe')).toBe('exe');
    expect(assetKind('Together-Working-Setup-0.10.2.exe.blockmap')).toBeNull();
    expect(assetKind('Together-Working-0.10.2-arm64.dmg')).toBe('dmgArm64');
    expect(assetKind('Together-Working-0.10.2-x64.dmg')).toBe('dmgX64');
    expect(assetKind('Together.Working-0.9.8-arm64.dmg')).toBe('dmgArm64');
    expect(assetKind('Together.Working-0.9.8-x64.dmg')).toBe('dmgX64');
    expect(assetKind('Together-Working-0.10.2-arm64.dmg.blockmap')).toBeNull();
    expect(assetKind('Together-Working-0.10.2-arm64-mac.zip')).toBeNull();
    expect(assetKind('latest.yml')).toBe('updateCheck');
    expect(assetKind('latest-mac.yml')).toBeNull();
    expect(assetKind('beta.yml')).toBeNull();
  });

  it('정식만 최근 순으로 5개 — 초안 · 베타는 빼고, 파일별 수를 합친다', () => {
    const raw = [
      gh('v0.10.3-beta.1', '2026-10-04T00:00:00Z', [['latest.yml', 9]], { prerelease: true }),
      gh('v0.10.3', '2026-10-05T00:00:00Z', [], { draft: true }),
      ...['0.9.0', '0.9.1', '0.9.2', '0.9.3'].map((v, i) => gh(`v${v}`, `2026-0${i + 1}-01T00:00:00Z`, [])),
      gh('v0.10.2', '2026-10-01T00:00:00Z', [
        ['Together-Working-Setup-0.10.2.exe', 120],
        ['Together-Working-Setup-0.10.2.exe.blockmap', 999],
        ['latest.yml', 3400],
        ['Together-Working-0.10.2-arm64.dmg', 30],
        ['Together.Working-0.10.2-x64.dmg', 7],
      ]),
    ];
    const rows = latestDownloads(parseReleases(raw));
    expect(rows.map((r) => r.version)).toEqual(['0.10.2', '0.9.3', '0.9.2', '0.9.1', '0.9.0']);
    expect(rows[0]).toEqual({
      version: '0.10.2',
      publishedAt: Date.parse('2026-10-01T00:00:00Z'),
      exe: 120,
      dmgArm64: 30,
      dmgX64: 7,
      dmg: 37,
      updateChecks: 3400,
    });
  });

  it('응답에서 쓰는 필드만 고르고, 모양이 다른 항목은 버린다', () => {
    expect(parseReleases({ message: 'Not Found' })).toEqual([]);
    expect(
      parseReleases([null, { name: '태그 없음' }, gh('v1.0.0', 'bad-date', [['latest.yml', 1]])]),
    ).toEqual([
      {
        tag: 'v1.0.0',
        publishedAt: null,
        draft: false,
        prerelease: false,
        assets: [{ name: 'latest.yml', downloads: 1 }],
      },
    ]);
  });

  it('공개 후 시간 — 이틀 전까지는 시간, 그 뒤로는 일', () => {
    expect(formatAge(0, 30 * 60_000)).toBe('1시간 안');
    expect(formatAge(0, 5 * HOUR)).toBe('5시간');
    expect(formatAge(0, 47 * HOUR)).toBe('47시간');
    expect(formatAge(0, 49 * HOUR)).toBe('2일');
    expect(formatAge(10, 0)).toBe('1시간 안');
  });

  it('403 · 429 는 요청 한도로, 그 밖의 실패는 그냥 실패로 본다', async () => {
    const reply = (status: number, body: unknown = []) =>
      (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
    const failed = async (status: number) => fetchReleaseDownloads(reply(status)).catch((e: unknown) => e);
    expect(isRateLimited(await failed(403))).toBe(true);
    expect(isRateLimited(await failed(429))).toBe(true);
    expect(isRateLimited(await failed(500))).toBe(false);
    expect(await fetchReleaseDownloads(reply(200, [gh('v1.0.0', '2026-01-01T00:00:00Z', [])]))).toHaveLength(
      1,
    );
  });
});
