// Versioned, origin-checked message protocol shared by the iframe client and the
// github.io top-frame broker. Pure — no DOM, no postMessage here.

export const V = 1
export const SOURCE_APP = 'mh-ann'        // iframe -> broker
export const SOURCE_BROKER = 'mh-ann-broker' // broker -> iframe

export const MSG = {
  HELLO: 'hello', LIST: 'list', PUT: 'put', DELETE: 'delete',
  HELLO_ACK: 'hello-ack', LIST_RESULT: 'list-result',
  PUT_ACK: 'put-ack', DELETE_ACK: 'delete-ack', ERROR: 'error',
}
const KNOWN_TYPES = new Set(Object.values(MSG))

const DEFAULTS = {
  broker: 'https://magnificahumanitas.github.io',
  app: 'https://magnificahumanitas.taila932a4.ts.net',
}
// Tests/harness may override via globalThis.__MH_ORIGINS__ = { broker, app }.
export const brokerOrigin = () => globalThis.__MH_ORIGINS__?.broker ?? DEFAULTS.broker
export const appOrigin = () => globalThis.__MH_ORIGINS__?.app ?? DEFAULTS.app

export const makeAppMsg = (type, reqId, payload = null) =>
  ({ source: SOURCE_APP, v: V, type, reqId, payload })
export const makeBrokerMsg = (type, reqId, payload = null) =>
  ({ source: SOURCE_BROKER, v: V, type, reqId, payload })

// Returns the message if it is a well-formed envelope from expectedSource, else null.
export function parse(data, expectedSource) {
  if (!data || typeof data !== 'object') return null
  if (data.source !== expectedSource) return null
  if (data.v !== V) return null
  if (!KNOWN_TYPES.has(data.type)) return null
  if (typeof data.reqId !== 'string' || data.reqId.length === 0) return null
  return data
}

export const originAllowed = (origin, expected) => origin === expected
