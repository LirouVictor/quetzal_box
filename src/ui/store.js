// Cópia local do último save aberto (IndexedDB). Fica só neste navegador/aparelho.
// Qualquer falha (modo anônimo, armazenamento bloqueado) é ignorada: o app funciona sem isso.

// Nome antigo do app mantido de propósito: trocar faria o aparelho perder a cópia já guardada.
const DB = 'quetzal-save-viewer';
const STORE = 'saves';
const KEY = 'last';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(req && req.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  } finally {
    db.close();
  }
}

/** @param {{name:string, bytes:ArrayBuffer}} save */
export async function rememberSave({ name, bytes }) {
  try { await tx('readwrite', s => s.put({ name, bytes, savedAt: Date.now() }, KEY)); return true; } catch { return false; }
}

/** @returns {Promise<{name:string, bytes:ArrayBuffer, savedAt:number}|null>} */
export async function loadRememberedSave() {
  try { return (await tx('readonly', s => s.get(KEY))) || null; } catch { return null; }
}

export async function forgetSave() {
  try { await tx('readwrite', s => s.delete(KEY)); } catch { /* nada a fazer */ }
}
