// Cópia local do último save aberto (IndexedDB). Fica só neste navegador/aparelho.
// Qualquer falha (modo anônimo, armazenamento bloqueado) é ignorada: o app funciona sem isso.

// Nome antigo do app mantido de propósito: trocar faria o aparelho perder a cópia já guardada.
const DB = 'quetzal-save-viewer';
const STORE = 'saves';
const KEY = 'last';
// Histórico: versões anteriores de cada save (bytes + data), para comparar. Também só neste aparelho.
const HISTORY = 'history';
const HISTORY_MAX = 30; // versões guardadas por save (as mais antigas saem)

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      if (!db.objectStoreNames.contains(HISTORY)) db.createObjectStore(HISTORY, { autoIncrement: true }).createIndex('saveKey', 'saveKey');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn, store = STORE) {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const req = fn(t.objectStore(store));
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

/**
 * Versões guardadas de um save, da mais nova para a mais antiga.
 * @returns {Promise<Array<{id:number, saveKey:string, signature:string, name:string, bytes:ArrayBuffer, savedAt:number, saveIndex:number, total:number}>>}
 */
export async function listHistory(saveKey) {
  try {
    const db = await open();
    try {
      return await new Promise((resolve, reject) => {
        const out = [];
        const req = db.transaction(HISTORY).objectStore(HISTORY).index('saveKey').openCursor(IDBKeyRange.only(saveKey));
        req.onsuccess = () => {
          const c = req.result;
          if (c) { out.push({ ...c.value, id: c.primaryKey }); c.continue(); } else resolve(out.sort((a, b) => b.savedAt - a.savedAt));
        };
        req.onerror = () => reject(req.error);
      });
    } finally { db.close(); }
  } catch { return []; }
}

/** Guarda uma versão (se o conteúdo mudou desde a última) e apaga as mais antigas além do limite. */
export async function addHistory(entry) {
  try {
    const list = await listHistory(entry.saveKey);
    if (list[0] && list[0].signature === entry.signature) return false;
    await tx('readwrite', s => s.add(entry), HISTORY);
    for (const old of list.slice(HISTORY_MAX - 1)) await tx('readwrite', s => s.delete(old.id), HISTORY);
    return true;
  } catch { return false; }
}

/** Apaga o histórico de um save. */
export async function clearHistory(saveKey) {
  for (const e of await listHistory(saveKey)) {
    try { await tx('readwrite', s => s.delete(e.id), HISTORY); } catch { /* nada a fazer */ }
  }
}
