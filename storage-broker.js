// REFERENCE COPY — deploy this file plus ./persistence/ into the magnificahumanitas.github.io
// repo (same convention as github-pages-wrapper.html). Loaded as <script type="module">.
//
// Owns the durable, FIRST-PARTY annotation store for the framed app. Uses the SAME
// protocol + encrypted engine as the app, imported (not duplicated) to prevent drift.
//
// SECURITY / THREAT MODEL: replies ONLY to appOrigin(); validates every message's origin
// and envelope. At-rest encryption (non-extractable AES-GCM key in IndexedDB) protects
// against disk/profile forensics. It does NOT defend against malicious same-origin
// JavaScript running on github.io — nothing purely client-side can.
import * as P from './persistence/protocol.js'
import { createBrokerStore } from './persistence/brokerStore.js'

// Register the listener SYNCHRONOUSLY at module load so a HELLO that arrives while the
// store is still initializing is never lost; the handler awaits storeReady per-message.
const storeReady = (async () => {
  const store = await createBrokerStore('mh-annotations')
  await store.ensurePersisted()
  return store
})()

window.addEventListener('message', async (ev) => {
  if (ev.origin !== P.appOrigin()) return
  const m = P.parse(ev.data, P.SOURCE_APP)
  if (!m) return
  const send = (type, payload) => ev.source.postMessage(P.makeBrokerMsg(type, m.reqId, payload), P.appOrigin())
  try {
    const store = await storeReady
    if (m.type === P.MSG.HELLO) send(P.MSG.HELLO_ACK, { persisted: await store.ensurePersisted() })
    else if (m.type === P.MSG.LIST) send(P.MSG.LIST_RESULT, await store.list())
    else if (m.type === P.MSG.PUT) { await store.put(m.payload); send(P.MSG.PUT_ACK, null) }
    else if (m.type === P.MSG.DELETE) { await store.delete(m.payload.id); send(P.MSG.DELETE_ACK, null) }
  } catch (e) { send(P.MSG.ERROR, { message: String(e?.message || e) }) }
})
