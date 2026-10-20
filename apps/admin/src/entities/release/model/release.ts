// 루트 package.json 의 build.publish(github owner/repo) 와 같은 값 — 앱이 이 저장소에서 업데이트를 받는다.
// web-admin 은 루트 파일을 import 하지 않으므로 여기 한 곳에 옮겨 적는다. 저장소를 옮기면 같이 고친다.
export const RELEASE_REPO = 'grk-cmd/t-w';
export const RELEASES_URL = `https://api.github.com/repos/${RELEASE_REPO}/releases`;
export const RELEASES_SHOWN = 5;
// 베타(prerelease)가 정식 사이에 여럿 끼어도 정식 5개를 채울 만큼 받는다.
export const RELEASES_FETCHED = 30;

export interface ReleaseAsset {
  name: string;
  downloads: number;
}

/** GitHub 응답에서 쓰는 필드만 골라 둔 릴리스. */
export interface Release {
  tag: string;
  publishedAt: number | null;
  draft: boolean;
  prerelease: boolean;
  assets: ReleaseAsset[];
}

export interface ReleaseDownloads {
  version: string;
  publishedAt: number | null;
  exe: number;
  dmgArm64: number;
  dmgX64: number;
  dmg: number;
  /** latest.yml 을 받아 간 수 — Windows 자동 업데이트가 새 버전을 확인할 때마다 하나씩 는다. */
  updateChecks: number;
}

type AssetKind = 'exe' | 'dmgArm64' | 'dmgX64' | 'updateCheck';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** 응답(unknown) → Release[]. 모양이 다른 항목은 버린다. */
export function parseReleases(raw: unknown): Release[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRecord).flatMap((r) => {
    if (typeof r.tag_name !== 'string') return [];
    const published = typeof r.published_at === 'string' ? Date.parse(r.published_at) : NaN;
    const assets = Array.isArray(r.assets) ? r.assets.filter(isRecord) : [];
    return [
      {
        tag: r.tag_name,
        publishedAt: Number.isNaN(published) ? null : published,
        draft: r.draft === true,
        prerelease: r.prerelease === true,
        assets: assets.flatMap((a) =>
          typeof a.name === 'string'
            ? [{ name: a.name, downloads: typeof a.download_count === 'number' ? a.download_count : 0 }]
            : [],
        ),
      },
    ];
  });
}

/**
 * 파일 이름 → 종류. 이름은 electron-builder artifactName 을 따른다:
 * `Together-Working-Setup-X.exe` · `Together-Working-X-arm64.dmg`(옛 릴리스는 `Together.Working-…` —
 * GitHub 가 이름의 공백을 '.' 로 바꿨다). blockmap(차등 업데이트용) · zip 은 세지 않는다.
 */
export function assetKind(name: string): AssetKind | null {
  const n = name.toLowerCase();
  if (n === 'latest.yml') return 'updateCheck';
  if (n.endsWith('.exe')) return 'exe';
  if (n.endsWith('.dmg')) return n.endsWith('-arm64.dmg') ? 'dmgArm64' : 'dmgX64';
  return null;
}

export function releaseDownloads(release: Release): ReleaseDownloads {
  const sum: Record<AssetKind, number> = { exe: 0, dmgArm64: 0, dmgX64: 0, updateCheck: 0 };
  for (const a of release.assets) {
    const kind = assetKind(a.name);
    if (kind) sum[kind] += a.downloads;
  }
  return {
    version: release.tag.replace(/^v/, ''),
    publishedAt: release.publishedAt,
    exe: sum.exe,
    dmgArm64: sum.dmgArm64,
    dmgX64: sum.dmgX64,
    dmg: sum.dmgArm64 + sum.dmgX64,
    updateChecks: sum.updateCheck,
  };
}

/** 정식 릴리스만(초안 · 베타 제외) 최근 순으로 limit 개. */
export function latestDownloads(releases: Release[], limit = RELEASES_SHOWN): ReleaseDownloads[] {
  return releases
    .filter((r) => !r.draft && !r.prerelease)
    .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0))
    .slice(0, limit)
    .map(releaseDownloads);
}

/** 공개 후 지난 시간 — 이틀 전까지는 시간, 그 뒤로는 일. */
export function formatAge(publishedAt: number, now: number): string {
  const hours = Math.floor(Math.max(0, now - publishedAt) / 3_600_000);
  if (hours < 1) return '1시간 안';
  if (hours < 48) return `${hours}시간`;
  return `${Math.floor(hours / 24)}일`;
}
