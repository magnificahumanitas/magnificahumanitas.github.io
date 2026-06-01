// Transparent at-rest encryption helpers. The key is generated non-extractable so its
// raw bytes can never leave JS; it is persisted as a CryptoKey *object* (see brokerStore).
//
// THREAT MODEL: AES-GCM at-rest encryption with a non-extractable per-device key protects
// against disk/profile forensics. It does NOT defend against malicious same-origin
// JavaScript running on the page — that code can use the key handle to decrypt. Nothing
// purely client-side can prevent that.
const enc = new TextEncoder()
const dec = new TextDecoder()

export async function generateKey() {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, /* extractable */ false, ['encrypt', 'decrypt'])
}

// -> { iv: Uint8Array(12), ciphertext: ArrayBuffer }
export async function encrypt(key, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext))
  return { iv, ciphertext }
}

// { iv, ciphertext } -> string. Throws on auth failure (tampered / wrong key).
export async function decrypt(key, { iv, ciphertext }) {
  const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return dec.decode(buf)
}
