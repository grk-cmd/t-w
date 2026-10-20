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

/** 규칙을 거쳐 쓰기 — 로그인한 사용자의 ID 토큰으로. 거부되면 HTTP 상태(401 등)를 그대로 돌려준다. */
export async function dbSetAs(idToken: string, path: string, value: unknown): Promise<number> {
  const res = await fetch(`${url(path)}&auth=${idToken}`, { method: 'PUT', body: JSON.stringify(value) });
  return res.status;
}

/** 규칙을 거쳐 읽기 — 거부되면 HTTP 상태(401 등)를 그대로 돌려준다. */
export async function dbGetAs(idToken: string, path: string): Promise<number> {
  const res = await fetch(`${url(path)}&auth=${idToken}`);
  return res.status;
}

const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';

/** 인증 에뮬레이터에 이메일 계정을 만들고 ID 토큰을 받는다. */
export async function signUpUser(email: string): Promise<{ uid: string; idToken: string }> {
  const res = await fetch(`${AUTH}/accounts:signUp?key=demo-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'e2e-password', returnSecureToken: true }),
  });
  if (!res.ok) throw new Error(`signUp ${email} → ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { localId: string; idToken: string };
  return { uid: body.localId, idToken: body.idToken };
}

const BUCKET = `${PROJECT}.appspot.com`;
const STORAGE = `http://127.0.0.1:9199/v0/b/${BUCKET}/o`;

/** Storage 에뮬레이터에 파일을 올리고, 앱이 awayImg 에 적는 꼴의 다운로드 URL 을 돌려준다(규칙이 이 접두어만 받는다). */
export async function uploadFile(path: string, body: Buffer, contentType = 'image/png'): Promise<string> {
  const res = await fetch(`${STORAGE}?name=${encodeURIComponent(path)}&uploadType=media`, {
    method: 'POST',
    headers: { ...OWNER, 'Content-Type': contentType },
    body: new Uint8Array(body),
  });
  if (!res.ok) throw new Error(`upload ${path} → ${res.status} ${await res.text()}`);
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(path)}?alt=media`;
}

export async function fileExists(path: string): Promise<boolean> {
  const res = await fetch(`${STORAGE}/${encodeURIComponent(path)}`, { headers: OWNER });
  return res.ok;
}
