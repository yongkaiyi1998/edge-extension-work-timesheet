function open() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("quick-timesheet", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("templates");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function templateGet(key) {
  if (!key) return null;
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("templates");
    const r = tx.objectStore("templates").get(key);
    tx.oncomplete = () => {
      db.close();
      resolve(r.result ?? null);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
export async function templatePut(bytes) {
  const key = crypto.randomUUID();
  const db = await open();
  await new Promise((resolve, reject) => {
    const tx = db.transaction("templates", "readwrite");
    tx.objectStore("templates").put(bytes, key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || Error("Template write aborted."));
  });
  db.close();
  return key;
}
