// 에뮬레이터 DB 를 규칙 없이(owner) 읽고 쓰는 도우미 — 테스트 데이터를 넣고 화면이 쓴 결과를 확인하는 데만 쓴다.
export const PROJECT = 'demo-tw';
// 에뮬레이터는 규칙 파일을 프로젝트 기본 DB(<프로젝트>-default-rtdb)에만 건다 — 다른 이름이면 규칙 없이 열린다.
const NAMESPACE = `${PROJECT}-default-rtdb`;
const DB = `http://127.0.0.1:9000`;
const OWNER = { Authorization: 'Bearer owner' };

function url(path: string) {
  return `${DB}/${path.replace(/^\/+/, '')}.json?ns=${NAMESPACE}`;
}

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(url(path), {
    method,
    headers: { ...OWNER, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

export const dbGet = <T = unknown>(path: string) => call('GET', path) as Promise<T | null>;
export const dbSet = (path: string, value: unknown) => call('PUT', path, value);
export const dbUpdate = (path: string, value: Record<string, unknown>) => call('PATCH', path, value);

/** DB 를 비우고 관리자 등록과 넘겨준 데이터만 다시 넣는다. 테스트마다 같은 상태에서 시작하려고. */
export async function resetDb(adminUid: string, data: Record<string, unknown> = {}) {
  await dbSet('', { admins: { [adminUid]: true }, ...data });
}
