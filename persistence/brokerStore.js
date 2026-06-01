// The durable storage engine: an encrypted IndexedDB key-value store for annotations.
// Records are stored as { id, iv, ciphertext }; the plaintext annotation JSON lives inside
// the ciphertext. The AES-GCM key is generated non-extractable and persisted as a CryptoKey
// object in a separate `meta` store (structured clone keeps non-extractable keys usable
// across reloads). Used directly by localBackend (in-iframe) and inside the github.io broker.
//
// THREAT MODEL: at-rest encryption guards against disk/profile forensics; it does NOT
// defend against malicious same-origin JavaScript, which can use the key handle to decrypt.
import { generateKey, encrypt, decrypt } from './crypto.js'

const DB_VERSION = 1
const STORE = 'records'   // { id, iv, ciphertext }
const META = 'meta'       // key 'cryptoKey' -> CryptoKey object

function openDb(name) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx(db, store, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode)
    const os = t.objectStore(store)
    let out
    Promise.resolve(fn(os)).then((v) => { out = v })
    t.oncomplete = () => resolve(out)
    t.onerror = () => reject(t.error)
    t.onabort = () => reject(t.error)
  })
}
const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })

async function importRaw(raw) {
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

// Persist a device key. Prefer an opaque non-extractable CryptoKey (best at-rest
// protection: raw bytes never touch JS or disk). Some engines — notably WebKit/Safari and
// therefore iOS — cannot structured-clone a CryptoKey into IndexedDB and throw
// DataCloneError; there we fall back to persisting raw AES bytes and re-importing them.
// On that path the key bytes live in IndexedDB, so at-rest encryption is obfuscation
// rather than forensic-grade (documented in the threat model).
async function loadOrCreateKey(db) {
  const existing = await tx(db, META, 'readonly', (os) => reqP(os.get('cryptoKey')))
  if (existing) {
    if (typeof CryptoKey !== 'undefined' && existing instanceof CryptoKey) return existing
    if (existing.raw) return importRaw(existing.raw)
  }
  const opaque = await generateKey()
  try {
    await tx(db, META, 'readwrite', (os) => reqP(os.put(opaque, 'cryptoKey')))
    return opaque
  } catch {
    // WebKit/Safari path: CryptoKey is not cloneable into IDB.
    const exKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
    const raw = await crypto.subtle.exportKey('raw', exKey)
    await tx(db, META, 'readwrite', (os) => reqP(os.put({ raw }, 'cryptoKey')))
    return importRaw(raw)
  }
}

export async function createBrokerStore(name = 'mh-annotations') {
  const db = await openDb(name)
  let key = await loadOrCreateKey(db)

  const store = {
    systemicFailure: false,

    async list() {
      const rows = await tx(db, STORE, 'readonly', (os) => reqP(os.getAll()))
      const annotations = []
      let skippedCorrupt = 0
      for (const row of rows) {
        try {
          annotations.push(JSON.parse(await decrypt(key, { iv: row.iv, ciphertext: row.ciphertext })))
        } catch { skippedCorrupt++ }
      }
      // Systemic = there were rows but every one failed to decrypt.
      store.systemicFailure = rows.length > 0 && annotations.length === 0
      if (store.systemicFailure) return { annotations: [], skippedCorrupt, systemic: true }
      return { annotations, skippedCorrupt, systemic: false }
    },

    async put(annotation) {
      const { iv, ciphertext } = await encrypt(key, JSON.stringify(annotation))
      await tx(db, STORE, 'readwrite', (os) => reqP(os.put({ id: annotation.id, iv, ciphertext })))
    },

    async delete(id) {
      await tx(db, STORE, 'readwrite', (os) => reqP(os.delete(id)))
    },

    async ensurePersisted() {
      try {
        if (!globalThis.navigator?.storage?.persist) return false
        if (await navigator.storage.persisted()) return true
        return await navigator.storage.persist()
      } catch { return false }
    },

    close() { db.close() },

    // --- test-only helpers (safe to ship; only reachable from tests) ---
    async _rawRow(id) { return tx(db, STORE, 'readonly', (os) => reqP(os.get(id))) },
    async _corruptRow(id) {
      const row = await store._rawRow(id)
      const b = new Uint8Array(row.ciphertext); b[0] ^= 0xff
      await tx(db, STORE, 'readwrite', (os) => reqP(os.put({ ...row, ciphertext: b.buffer })))
    },
    async _replaceKeyWithFresh() {
      key = await generateKey()
      await tx(db, META, 'readwrite', (os) => reqP(os.put(key, 'cryptoKey')))
    },
  }
  return store
}
