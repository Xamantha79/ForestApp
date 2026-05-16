import { openDB } from 'idb';

const DB_NAME = 'forest-app-db';
const STORE_NAME = 'offline-programs';

export const initDB = async () => {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    },
  });
};

export const saveOfflineProgram = async (program: any) => {
  const db = await initDB();
  return db.add(STORE_NAME, program);
};

export const getOfflinePrograms = async () => {
  const db = await initDB();
  return db.getAll(STORE_NAME);
};

export const clearOfflinePrograms = async () => {
  const db = await initDB();
  return db.clear(STORE_NAME);
};

export const deleteOfflineProgram = async (id: number) => {
  const db = await initDB();
  return db.delete(STORE_NAME, id);
};
