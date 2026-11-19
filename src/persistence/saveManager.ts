import type { SavePayload } from '../types/game';

const STORAGE_KEY = 'automoika_save_v2';
const IDB_NAME = 'automoika_db';
const IDB_STORE = 'saves';
const SAVE_VERSION = 2;

export function saveGameSync(payload: Omit<SavePayload, 'version' | 'savedAt'>): SavePayload {
  const full: SavePayload = {
    ...payload,
    version: SAVE_VERSION,
    savedAt: Date.now(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(full));
  } catch {
    // Ignore quota issues on private browsing
  }

  void writeToIndexedDB(full);
  return full;
}

export function loadGameSync(): SavePayload | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavePayload;
    if (!parsed || typeof parsed !== 'object' || parsed.version !== SAVE_VERSION) {
      return null;
    }
    if (!parsed.economy || !parsed.upgrades || !Array.isArray(parsed.workers)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function hasSavedGame(): boolean {
  return loadGameSync() !== null;
}

export function clearSavedGame(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  void clearIndexedDB();
}

function openDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function writeToIndexedDB(payload: SavePayload): Promise<void> {
  const db = await openDB();
  if (!db) return;
  try {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(payload, STORAGE_KEY);
  } catch {
    // ignore
  }
}

async function clearIndexedDB(): Promise<void> {
  const db = await openDB();
  if (!db) return;
  try {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(STORAGE_KEY);
  } catch {
    // ignore
  }
}
