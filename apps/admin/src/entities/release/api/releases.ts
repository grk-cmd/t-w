import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  latestDownloads,
  parseReleases,
  RELEASES_FETCHED,
  RELEASES_URL,
  type ReleaseDownloads,
} from '../model/release';

const RELEASES_KEY = ['github', 'releases'];

export class GithubHttpError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`GitHub ${status}`);
    this.status = status;
  }
}

/** 인증 없이 부르면 IP 당 시간 60번 — 넘으면 403(또는 429)이 온다. */
export const isRateLimited = (error: unknown) =>
  error instanceof GithubHttpError && (error.status === 403 || error.status === 429);

export async function fetchReleaseDownloads(fetcher: typeof fetch = fetch): Promise<ReleaseDownloads[]> {
  const res = await fetcher(`${RELEASES_URL}?per_page=${RELEASES_FETCHED}`, {
    headers: { Accept: 'application/vnd.github+json' },
    credentials: 'omit',
  });
  if (!res.ok) throw new GithubHttpError(res.status);
  return latestDownloads(parseReleases(await res.json()));
}

export function useReleaseDownloads() {
  return useQuery({ queryKey: RELEASES_KEY, queryFn: () => fetchReleaseDownloads() });
}

export function useRefreshReleaseDownloads() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: RELEASES_KEY });
}
