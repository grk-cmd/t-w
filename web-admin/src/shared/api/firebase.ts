import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  connectAuthEmulator,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  connectDatabaseEmulator,
  get,
  getDatabase,
  limitToFirst,
  onValue,
  query,
  ref,
  remove,
  runTransaction,
  serverTimestamp,
  set,
  update,
} from 'firebase/database';
import { connectStorageEmulator, deleteObject, getStorage, ref as storageRef } from 'firebase/storage';
import { isPermissionDenied, type Db } from './db';
import type { Files } from './files';

const PROD_PROJECT_ID = 'together-working';

// e2e 빌드(VITE_E2E=1)에서만 에뮬레이터에 붙는다. 일반 빌드에서는 이 값이 false 로 굳어 아래 갈래가 빠진다.
const E2E = import.meta.env.VITE_E2E === '1';
const E2E_PROJECT_ID = 'demo-tw';
const E2E_HOST = '127.0.0.1';
const E2E_PORTS = { auth: 9099, database: 9000, storage: 9199 };
const E2E_CONFIG = {
  apiKey: 'demo-key',
  authDomain: `${E2E_PROJECT_ID}.firebaseapp.com`,
  projectId: E2E_PROJECT_ID,
  databaseURL: `http://${E2E_HOST}:${E2E_PORTS.database}?ns=${E2E_PROJECT_ID}-default-rtdb`,
  storageBucket: `${E2E_PROJECT_ID}.appspot.com`,
};

async function loadConfig() {
  if (E2E) return E2E_CONFIG;
  const res = await fetch('/__/firebase/init.json');
  if (!res.ok) throw new Error(`Firebase 설정을 받지 못했어요 (${res.status})`);
  return res.json();
}

export interface Firebase {
  projectId: string;
  isProd: boolean;
  db: Db;
  files: Files;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  onAuth(callback: (user: User | null) => void): () => void;
}

// 설정값을 코드에 두지 않는다. 배포된 프로젝트가 자기 설정을 돌려주므로 dev 에 올리면 dev, 운영에 올리면 운영에 붙는다.
export async function connectFirebase(): Promise<Firebase> {
  const config = await loadConfig();

  const app = initializeApp(config);
  const database = getDatabase(app);
  const auth = getAuth(app);
  const storage = getStorage(app);
  if (E2E) {
    connectAuthEmulator(auth, `http://${E2E_HOST}:${E2E_PORTS.auth}`, { disableWarnings: true });
    connectDatabaseEmulator(database, E2E_HOST, E2E_PORTS.database);
    connectStorageEmulator(storage, E2E_HOST, E2E_PORTS.storage);
  }
  const at = (path: string) => ref(database, path);

  // SDK 에는 shallow 가 없어 REST 로 묻는다. 규칙은 로그인한 사람으로 판정되게 ID 토큰을 auth= 로 싣는다.
  // e2e 의 databaseURL 은 «주소?ns=…» 꼴이라 그 질의를 살린 채 경로만 바꾼다.
  const shallowKeys = async (path: string): Promise<string[]> => {
    const url = new URL(config.databaseURL);
    url.pathname = `/${path.split('/').filter(Boolean).map(encodeURIComponent).join('/')}.json`;
    url.searchParams.set('shallow', 'true');
    const token = await auth.currentUser?.getIdToken();
    if (token) url.searchParams.set('auth', token);
    const res = await fetch(url);
    if (res.status === 401 || res.status === 403)
      throw Object.assign(new Error('Permission denied'), { code: 'PERMISSION_DENIED' });
    if (!res.ok) throw new Error(`${path} 키 목록을 받지 못했어요 (${res.status})`);
    const body: unknown = await res.json();
    return body && typeof body === 'object' ? Object.keys(body) : [];
  };

  const db: Db = {
    get: async (path) => (await get(at(path))).val(),
    set: (path, value) => set(at(path), value),
    update: (path, value) => update(at(path), value),
    remove: (path) => remove(at(path)),
    transaction: async <T>(path: string, change: (current: T | null) => T | undefined) => {
      const r = at(path);
      // 이 경로를 구독하지 않으면 SDK 캐시가 비어 첫 호출이 null 로 들어온다. 그걸 «값 없음» 으로 보고
      // 그만두면 안 되므로 첫 번째만 방금 읽은 서버 값으로 대신한다 — 틀렸으면 서버가 거절해 진짜 값으로 다시 부른다.
      const seed = (await get(r)).val() as T | null;
      let first = true;
      const result = await runTransaction(r, (current: T | null) => {
        const value = first && current === null ? seed : current;
        first = false;
        return change(value);
      });
      return { committed: result.committed, value: result.snapshot.val() as T | null };
    },
    commit: (updates) => update(ref(database), updates),
    shallowKeys,
    watch: (path, onChange, onError) => onValue(at(path), (snap) => onChange(snap.val()), onError),
    probe: async (path) => {
      await get(query(at(path), limitToFirst(1)));
    },
    now: serverTimestamp,
    // .info 는 이 기기에만 있는 경로라 get() 으로 읽으면 서버에 물어 «Invalid token in path» 로 거부된다 — 구독으로 한 번만 읽는다.
    serverTimeOffset: () =>
      new Promise((resolve, reject) =>
        onValue(at('.info/serverTimeOffset'), (snap) => resolve(Number(snap.val()) || 0), reject, {
          onlyOnce: true,
        }),
      ),
  };

  const files: Files = {
    deleteByUrl: async (url) => {
      try {
        await deleteObject(storageRef(storage, url));
      } catch (error) {
        if ((error as { code?: string }).code !== 'storage/object-not-found') throw error;
      }
    },
  };

  return {
    projectId: config.projectId,
    isProd: config.projectId === PROD_PROJECT_ID,
    db,
    files,
    signIn: async () => {
      await signInWithPopup(auth, new GoogleAuthProvider());
    },
    signOut: () => signOut(auth),
    onAuth: (callback) => onAuthStateChanged(auth, callback),
  };
}

// admins 노드는 규칙상 아무도 읽을 수 없다. 관리자에게만 열린 licenses 를 한 건 읽어 보는 것으로 가린다.
// 화면을 여는 기준일 뿐, 실제 권한은 언제나 규칙이 판정한다.
export async function isAdmin(db: Db): Promise<boolean> {
  try {
    await db.probe('licenses');
    return true;
  } catch (error) {
    if (isPermissionDenied(error)) return false;
    throw error;
  }
}
