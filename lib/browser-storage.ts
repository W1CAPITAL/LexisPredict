/**
 * @fileOverview Motor de Armazenamento Local de Alta Capacidade (IndexedDB)
 * Utilizado para salvar vídeos e imagens de wallpaper sem estourar a cota do localStorage.
 * Proprietário: W1 Capital | Fundador: Davi Alves Figueredo
 */

const DB_NAME = 'LexisPredictStorage';
const STORE_NAME = 'assets';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject('IndexedDB não suportado');
      return;
    }
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const browserStorage = {
  async saveAsset(key: string, data: string | Blob): Promise<boolean> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(data, key);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error('Falha ao salvar asset no IndexedDB:', e);
      return false;
    }
  },

  async getAsset(key: string): Promise<string | Blob | null> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      return null;
    }
  },

  async removeAsset(key: string): Promise<void> {
    try {
      const db = await openDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      transaction.objectStore(STORE_NAME).delete(key);
    } catch (e) {}
  }
};
