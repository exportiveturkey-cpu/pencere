import { Project } from "../types";

const DB_NAME = "alumetric_offline_db";
const DB_VERSION = 1;
const STORE_PROJECTS = "projects";
const STORE_KV = "key_val";

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB is not supported in this environment"));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result as IDBDatabase;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_KV)) {
        db.createObjectStore(STORE_KV, { keyPath: "key" });
      }
    };

    request.onsuccess = (event: any) => {
      resolve(event.target.result);
    };

    request.onerror = (event: any) => {
      console.warn("IndexedDB open error:", event.target.error);
      reject(event.target.error);
    };
  });

  return dbPromise;
}

export const idb_saveProject = async (project: Project): Promise<void> => {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, "readwrite");
      const store = tx.objectStore(STORE_PROJECTS);
      const req = store.put(project);
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e);
    });
  } catch (err) {
    console.warn("IndexedDB saveProject failed:", err);
  }
};

export const idb_saveProjects = async (projects: Project[]): Promise<void> => {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, "readwrite");
      const store = tx.objectStore(STORE_PROJECTS);
      projects.forEach(p => {
        if (p && p.id) {
          store.put(p);
        }
      });
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e);
    });
  } catch (err) {
    console.warn("IndexedDB saveProjects failed:", err);
  }
};

export const idb_getProjects = async (): Promise<Project[]> => {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, "readonly");
      const store = tx.objectStore(STORE_PROJECTS);
      const req = store.getAll();
      req.onsuccess = () => {
        const result = (req.result || []) as Project[];
        resolve(result);
      };
      req.onerror = (e) => reject(e);
    });
  } catch (err) {
    console.warn("IndexedDB getProjects failed:", err);
    return [];
  }
};

export const idb_deleteProject = async (projectId: string): Promise<void> => {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, "readwrite");
      const store = tx.objectStore(STORE_PROJECTS);
      const req = store.delete(projectId);
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e);
    });
  } catch (err) {
    console.warn("IndexedDB deleteProject failed:", err);
  }
};

export const idb_set = async (key: string, value: any): Promise<void> => {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_KV, "readwrite");
      const store = tx.objectStore(STORE_KV);
      const req = store.put({ key, value });
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e);
    });
  } catch (err) {
    console.warn("IndexedDB set KV failed:", err);
  }
};

export const idb_get = async (key: string): Promise<any> => {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_KV, "readonly");
      const store = tx.objectStore(STORE_KV);
      const req = store.get(key);
      req.onsuccess = () => {
        resolve(req.result ? req.result.value : null);
      };
      req.onerror = (e) => reject(e);
    });
  } catch (err) {
    console.warn("IndexedDB get KV failed:", err);
    return null;
  }
};
