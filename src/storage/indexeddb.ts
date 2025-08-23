/**
 * @file IndexedDB-backed FileIO for browsers
 */
import type { FileIO } from "./types";
import { toUint8 } from "../util/bin";

type IDBReq<T> = IDBRequest<T>;

function requireIDB(): IDBFactory {
  const idb = (globalThis as unknown as { indexedDB?: IDBFactory }).indexedDB;
  if (!idb) {
    throw new Error("indexedDB not available");
  }
  return idb;
}

function openDB(dbName: string, storeName: string): Promise<IDBDatabase> {
  const idb = requireIDB();
  return new Promise((resolve, reject) => {
    const req = idb.open(dbName, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db: IDBDatabase, store: string, mode: IDBTransactionMode) {
  const t = db.transaction(store, mode);
  return t.objectStore(store);
}

function reqToPromise<T>(req: IDBReq<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Create a FileIO backed by IndexedDB.
 *
 * @param options Optional database and store names.
 * @returns A FileIO implementation persisting data in IndexedDB.
 */
export function createIndexedDBFileIO(options?: { dbName?: string; storeName?: string }): FileIO {
  const dbName = options?.dbName ?? "vcdb_fileio";
  const storeName = options?.storeName ?? "files";
  const state: { promise: Promise<IDBDatabase> | null } = { promise: null };
  function getDB() {
    if (!state.promise) {
      state.promise = openDB(dbName, storeName);
    }
    return state.promise;
  }
  return {
    async read(path: string): Promise<Uint8Array> {
      const db = await getDB();
      const r = reqToPromise<ArrayBuffer | undefined>(
        tx(db, storeName, "readonly").get(path) as IDBReq<ArrayBuffer | undefined>,
      );
      const res = await r;
      if (res == null) {
        throw new Error(`file not found: ${path}`);
      }
      return new Uint8Array(res);
    },
    async write(path: string, data: Uint8Array | ArrayBuffer): Promise<void> {
      const db = await getDB();
      await reqToPromise(tx(db, storeName, "readwrite").put(toUint8(data).buffer, path));
    },
    async append(path: string, data: Uint8Array | ArrayBuffer): Promise<void> {
      const db = await getDB();
      const store = tx(db, storeName, "readwrite");
      const existing =
        (await reqToPromise<ArrayBuffer | undefined>(store.get(path) as IDBReq<ArrayBuffer | undefined>)) ??
        new ArrayBuffer(0);
      const a = new Uint8Array(existing);
      const b = toUint8(data);
      const merged = new Uint8Array(a.length + b.length);
      merged.set(a, 0);
      merged.set(b, a.length);
      await reqToPromise(store.put(merged.buffer, path));
    },
    async atomicWrite(path: string, data: Uint8Array | ArrayBuffer): Promise<void> {
      const db = await getDB();
      await reqToPromise(tx(db, storeName, "readwrite").put(toUint8(data).buffer, path));
    },
    async del(path: string): Promise<void> {
      const db = await getDB();
      await reqToPromise(tx(db, storeName, "readwrite").delete(path));
    },
  };
}
